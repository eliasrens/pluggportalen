// ============================================================================
// Pluggporten – Guldrushen 💰 på SERVERN (functions/guldrush-core.js, #563)
// ----------------------------------------------------------------------------
// Allt som rör guld avgörs här (funktionsspec §6.6): eleven skriver ALDRIG
// guld, kistor, skydd eller händelser (firestore.rules nekar). Tre anropbara
// funktioner (index.js) kör kärnan med Admin SDK:t injicerat – samma mönster
// som login-core.js, så kärnan kan testas direkt mot Firestore-emulatorn med
// styrd klocka och slump (test/functions-guldrush-core.test.mjs).
//
// FLÖDET
//   answerQuestion  eleven svarar → servern rättar (multiplikation: räknar
//     om; quiz: mot det lärarskyddade facit grPrivate/snapshot) och skapar
//     answers/{attemptId} (create-only, aldrig två gånger). Quiz: servern
//     väljer elevens nästa fråga (grPlayers.nextQ) – ingen kan pröva sig fram
//     på samma fråga.
//   openChest       ett RÄTT svar → EN kista (answers/{attemptId}.chest sätts
//     i samma transaktion – en andra öppning nekas). Slumpen här (crypto).
//     Stöld/byte → grPlayers.pending; eleven väljer offer med chooseVictim.
//   chooseVictim    stöld/byte i EN transaktion som ändrar båda elevernas guld.
//     Trygghetsreglerna (guldrush-regler.js victimProblem) kontrolleras här:
//     stöldskydd 30 s, inte samma offer två gånger i rad, byte bara med någon
//     som har MER guld, sköld stoppar nästa. Ett manipulerat val nekas och
//     valet ligger kvar; inget val/för sent → servern slumpar; ingen möjlig →
//     vanlig guldkista (kistans fallback).
//   Alla tre: sessionen måste vara Guldrushen, status live och inom matchtiden
//     (startedAt + nedräkning ≤ nu < + matchlängd), annars nekas anropet.
//
// HÄNDELSEFLÖDET (designspec §9): varje utfall skriver grEvents/{autoId}
// { type, chest?, uid, name, classId, victim…?, amount, gold, at = serverns
// tid } i SAMMA transaktion. Ledningsbyte avgörs efteråt (noteLeader, egen
// liten transaktion mot grMeta/leader). Inga heta dokument: ett svar rör bara
// elevens egna dokument; en stöld de två elevernas.
//
// Kistkonfig + spelregler: ./guldrush/ = GENERERAD kopia av
// src/live/formats/guldrush/delat/ (npm run sync:guldrush).
//
// API (deps = { db, FieldValue, Timestamp, now?(), rng?() })
//   answerQuestion(deps, uid, { sid, attemptId, factorA?, factorB?, answer?,
//                  choiceIndex?, q? }) → { attemptId, correct, correctAnswer, nextQ }
//   openChest(deps, uid, { sid, attemptId, chestIndex }) → { chest, kind,
//                  delta, gold, shield, pending? }
//   chooseVictim(deps, uid, { sid, victimUid? }) → { result: "steal"|"swap"|
//                  "blocked"|"fallback", chest, victimUid?, amount, delta, gold }
//   noteLeader(deps, sid) → uid | null (ny ledare skriven)
//   GrError(code, message) – code = HttpsError-kod, message på svenska
// ============================================================================

import { GR_RULES } from "./guldrush/chests-config.js";
import {
  toMs, chestById, isVictimKind, rollChest, applySelfEffect, victimProblem, victimMessage,
  eligibleVictims, resolveVictim,
} from "./guldrush/guldrush-regler.js";

export const GR_FORMAT = "guldrush";
export const GR_MODES = ["multiplication_0_10", "plugga_quiz"];
const MULT = "multiplication_0_10";
const QUIZ = "plugga_quiz";
const SID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Fel med en HttpsError-kod (index.js översätter) och ett svenskt meddelande. */
export class GrError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const bad = (msg) => new GrError("invalid-argument", msg);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function refs(db, sid, uid) {
  const sess = db.collection("liveSessions").doc(sid);
  return {
    sess,
    player: sess.collection("players").doc(uid),
    gp: sess.collection("grPlayers").doc(uid),
    priv: sess.collection("grPrivate").doc("snapshot"),
    pub: sess.collection("grPublic").doc("questions"),
    meta: sess.collection("grMeta").doc("leader"),
    events: sess.collection("grEvents"),
    answer: (id) => sess.collection("answers").doc(id),
    gpOf: (id) => sess.collection("grPlayers").doc(id),
  };
}

function parseSid(raw) {
  const sid = raw?.sid;
  if (typeof sid !== "string" || !SID_RE.test(sid)) throw bad("Matchens id saknas.");
  return sid;
}

function parseAttempt(raw) {
  const id = raw?.attemptId;
  if (typeof id !== "string" || !ATTEMPT_RE.test(id)) throw bad("Svarets id saknas.");
  return id;
}

/** Sessionen måste finnas och vara Guldrushen. */
function sessionOf(snap) {
  if (!snap.exists) throw new GrError("not-found", "Matchen finns inte.");
  const s = snap.data();
  if (s.format !== GR_FORMAT) throw new GrError("failed-precondition", "Det här är ingen Guldrush-match.");
  return s;
}

/** Officiella tider ur startedAt (samma som reglerna och live-core sessionTimes). */
export function matchWindow(s) {
  const start = toMs(s?.startedAt);
  if (start == null) return null;
  const t0 = start + (Number(s.countdownSeconds) || 0) * 1000;
  return { t0, end: t0 + (Number(s.durationSeconds) || 0) * 1000 };
}

function assertLive(s, now) {
  const w = matchWindow(s);
  if (s.status !== "live" || !w) throw new GrError("failed-precondition", "Matchen pågår inte.");
  if (now < w.t0) throw new GrError("failed-precondition", "Matchen har inte börjat än.");
  if (now >= w.end) throw new GrError("failed-precondition", "Tiden är ute! ⏰");
}

/** Spelardokumentet (kärnans "Gå med", skapat under reglerna) = deltagare. */
function playerOf(snap, s) {
  const p = snap.exists ? snap.data() : null;
  if (!p || !(s.participatingClassIds || []).includes(p.classId)) {
    throw new GrError("permission-denied", "Gå med i matchen först.");
  }
  return p;
}

// --- Rättning ---------------------------------------------------------------

function parseInt0(v) {
  if (Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\s*\d{1,4}\s*$/.test(v)) return Number(v.trim());
  return null;
}

/** Multiplikation: facit räknas om här – samma fält som Klassmatchens svar. */
function gradeMult(s, raw) {
  const a = raw?.factorA;
  const b = raw?.factorB;
  if (!isInt(a, 0, 10) || !isInt(b, 0, 10)) throw bad("Ogiltig fråga.");
  const answer = parseInt0(raw?.answer);
  if (answer == null || answer > 9999) throw bad("Ogiltigt svar.");
  const doc = { mode: MULT, factorA: a, factorB: b, answer, correctAnswer: a * b, isCorrect: answer === a * b };
  if (s.answerKind === "choice") {
    if (!isInt(raw?.choiceIndex, 0, 3)) throw bad("Välj ett av alternativen.");
    Object.assign(doc, { answerKind: "choice", choiceIndex: raw.choiceIndex });
  } else if (raw?.choiceIndex != null) {
    throw bad("Den här matchen har skriv själv – inga alternativ.");
  }
  return doc;
}

/** Quiz: mot det lärarskyddade facit, bara den fråga servern gett eleven. */
function gradeQuiz(s, raw, g, pub, priv) {
  const questions = pub?.questions || [];
  const facit = priv?.facit || [];
  const q = raw?.q;
  if (!isInt(q, 0, questions.length - 1) || !facit[q]) throw bad("Ogiltig fråga.");
  if (g?.nextQ != null && q !== g.nextQ) throw new GrError("failed-precondition", "Svara på frågan du fick.");
  const opts = questions[q].options || [];
  const ci = raw?.choiceIndex;
  if (s.answerKind !== "choice" || !isInt(ci, 0, opts.length - 1)) throw bad("Välj ett av alternativen.");
  const ai = facit[q].answerIndex;
  return {
    mode: QUIZ, answerKind: "choice", q, questionId: String(questions[q].id ?? q), choiceIndex: ci,
    answer: String(opts[ci]), correctAnswer: String(opts[ai] ?? ""), isCorrect: ci === ai,
    statKeys: (questions[q].statKeys || []).filter((k) => typeof k === "string"),
  };
}

/** Nästa quizfråga: slumpad, aldrig samma två gånger i rad. */
function pickNextQ(n, cur, rng) {
  if (n <= 1) return 0;
  const i = Math.floor(rng() * (n - 1));
  return i >= cur ? i + 1 : i;
}

// --- Svar --------------------------------------------------------------------

export async function answerQuestion(deps, uid, raw) {
  const { db, FieldValue } = deps;
  const now = deps.now || Date.now;
  const rng = deps.rng || Math.random;
  const sid = parseSid(raw);
  const attemptId = parseAttempt(raw);
  const r = refs(db, sid, uid);
  // Spelardokumentet (deltagare + namn) läses UTANFÖR transaktionen: elevens
  // närvaropuls skriver dit hela tiden och skulle annars krocka med svaret.
  const pSnap = await r.player.get();
  return db.runTransaction(async (tx) => {
    const [sSnap, gSnap, aSnap] = await tx.getAll(r.sess, r.gp, r.answer(attemptId));
    const s = sessionOf(sSnap);
    const g = gSnap.exists ? gSnap.data() : null;
    if (aSnap.exists) {
      // Omförsök efter nätverksfel: samma utfall igen, inget skrivs.
      const a = aSnap.data();
      if (a.uid !== uid) throw new GrError("already-exists", "Svaret finns redan.");
      return { attemptId, correct: a.isCorrect === true, correctAnswer: a.correctAnswer, nextQ: g?.nextQ ?? null };
    }
    assertLive(s, now());
    const p = playerOf(pSnap, s);
    let graded;
    let nextQ = null;
    if (s.gameMode === MULT) {
      graded = gradeMult(s, raw);
    } else if (s.gameMode === QUIZ) {
      const [pub, priv] = await tx.getAll(r.pub, r.priv);
      graded = gradeQuiz(s, raw, g, pub.data(), priv.data());
      nextQ = pickNextQ((pub.data()?.questions || []).length, graded.q, rng);
    } else {
      throw new GrError("failed-precondition", "Spelläget stöds inte i Guldrushen.");
    }
    tx.create(r.answer(attemptId), {
      ...graded, uid, classId: p.classId, format: GR_FORMAT, at: FieldValue.serverTimestamp(),
    });
    const ok = graded.isCorrect;
    const base = g ? {} : {
      uid, classId: p.classId, name: String(p.name || ""), gold: 0, chests: 0, shield: false,
      protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null, joinedAt: FieldValue.serverTimestamp(),
    };
    tx.set(r.gp, {
      ...base,
      correct: FieldValue.increment(ok ? 1 : 0),
      incorrect: FieldValue.increment(ok ? 0 : 1),
      lastAnswerAt: FieldValue.serverTimestamp(),
      ...(nextQ != null ? { nextQ } : {}),
    }, { merge: true });
    return { attemptId, correct: ok, correctAnswer: graded.correctAnswer, nextQ };
  });
}

// --- Kistan --------------------------------------------------------------------

export async function openChest(deps, uid, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const rng = deps.rng || Math.random;
  const sid = parseSid(raw);
  const attemptId = parseAttempt(raw);
  const chestIndex = raw?.chestIndex ?? 0;
  if (!isInt(chestIndex, 0, GR_RULES.chestsOffered - 1)) throw bad("Välj en av kistorna.");
  const r = refs(db, sid, uid);
  const out = await db.runTransaction(async (tx) => {
    const [sSnap, gSnap, aSnap] = await tx.getAll(r.sess, r.gp, r.answer(attemptId));
    const s = sessionOf(sSnap);
    const t = now();
    assertLive(s, t);
    const a = aSnap.exists ? aSnap.data() : null;
    if (!a || a.uid !== uid || a.format !== GR_FORMAT) {
      throw new GrError("permission-denied", "Kistan hör inte till något av dina svar.");
    }
    if (a.isCorrect !== true) throw new GrError("failed-precondition", "Bara ett rätt svar ger en kista.");
    if (a.chest) throw new GrError("already-exists", "Den kistan är redan öppnad.");
    const g = gSnap.data();
    if (g.pending) throw new GrError("failed-precondition", "Välj först vem du ska knycka från eller byta med.");
    const last = toMs(g.lastChestAt);
    if (last != null && t - last < GR_RULES.minChestGapMs) {
      throw new GrError("resource-exhausted", "En kista i taget!");
    }
    const chest = rollChest(s.stealSwap !== false, rng);
    const kind = chest.effect.kind;
    const stamp = Timestamp.fromMillis(t);
    tx.update(r.answer(attemptId), { chest: chest.id, chestIndex, chestAt: FieldValue.serverTimestamp() });
    if (isVictimKind(chest)) {
      const pending = { kind, chest: chest.id, attemptId, at: stamp, expiresAt: Timestamp.fromMillis(t + GR_RULES.victimPickMs) };
      tx.update(r.gp, { pending, chests: FieldValue.increment(1), lastChestAt: stamp });
      return { chest: chest.id, kind, delta: 0, gold: g.gold, shield: !!g.shield, pending: { kind, expiresAtMs: t + GR_RULES.victimPickMs } };
    }
    const eff = applySelfEffect(chest, g.gold);
    tx.update(r.gp, {
      gold: eff.gold, chests: FieldValue.increment(1), lastChestAt: stamp, ...(eff.shield ? { shield: true } : {}),
    });
    tx.create(r.events.doc(), {
      type: "chest", chest: chest.id, uid, name: g.name, classId: g.classId,
      amount: eff.delta, gold: eff.gold, at: FieldValue.serverTimestamp(),
    });
    return { chest: chest.id, kind, delta: eff.delta, gold: eff.gold, shield: eff.shield || !!g.shield };
  });
  if (out.delta) await noteLeader(deps, sid).catch(() => null);
  return out;
}

// --- Stöld och byte ------------------------------------------------------------------

export async function chooseVictim(deps, uid, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const rng = deps.rng || Math.random;
  const sid = parseSid(raw);
  const asked = raw?.victimUid ?? null;
  if (asked !== null && (typeof asked !== "string" || !SID_RE.test(asked))) throw bad("Ogiltig klasskamrat.");
  const r = refs(db, sid, uid);

  // Inget val eller för sent → servern slumpar bland dem som går (utan sköld).
  // Listan läses utanför transaktionen (inga lås på alla spelare);
  // transaktionen kontrollerar det valda offret igen.
  const pre = (await r.gp.get()).data();
  if (!pre?.pending) throw new GrError("failed-precondition", "Det finns ingen stöld eller byte att välja.");
  const late = now() > toMs(pre.pending.expiresAt) + GR_RULES.victimGraceMs;
  const auto = asked === null || late;
  let target = asked;
  if (auto) {
    const all = (await r.sess.collection("grPlayers").get()).docs.map((d) => d.data());
    const cands = eligibleVictims(pre.pending.kind, pre, all, now(), { random: true });
    target = cands.length ? cands[Math.floor(rng() * cands.length)].uid : null;
  }

  const out = await db.runTransaction(async (tx) => {
    const [sSnap, gSnap, vSnap] = await tx.getAll(r.sess, r.gp, ...(target ? [r.gpOf(target)] : []));
    const s = sessionOf(sSnap);
    const t = now();
    assertLive(s, t);
    const g = gSnap.data();
    const pending = g?.pending;
    if (!pending) throw new GrError("failed-precondition", "Det finns ingen stöld eller byte att välja.");
    const kind = pending.kind;
    const v = vSnap?.exists ? vSnap.data() : null;
    const problem = s.stealSwap === false ? "av" : victimProblem(kind, g, v, t);
    if (problem && !auto && problem !== "av") {
      throw new GrError(problem === "saknas" ? "not-found" : "failed-precondition", victimMessage(problem));
    }
    const at = FieldValue.serverTimestamp();
    if (problem) {
      // Ingen kan väljas (eller stöld/byte avstängt) → vanlig guldkista.
      const fb = chestById(chestById(pending.chest)?.fallback) || chestById("guld");
      const eff = applySelfEffect(fb, g.gold);
      tx.update(r.gp, { gold: eff.gold, pending: null });
      tx.create(r.events.doc(), {
        type: "chest", chest: fb.id, fallbackFrom: pending.chest, uid, name: g.name, classId: g.classId,
        amount: eff.delta, gold: eff.gold, at,
      });
      return { result: "fallback", chest: fb.id, amount: eff.delta, delta: eff.delta, gold: eff.gold };
    }
    const res = resolveVictim(kind, g, v);
    const who = { victimUid: v.uid, victimName: v.name, victimClassId: v.classId };
    const lastHit = {
      kind: res.blocked ? "blocked" : kind, byUid: uid, byName: g.name, amount: res.amount, at: Timestamp.fromMillis(t),
    };
    tx.update(r.gp, { gold: res.thiefGold, pending: null, lastVictimUid: v.uid });
    if (res.blocked) {
      tx.update(r.gpOf(v.uid), { shield: false, lastHit });
      tx.create(r.events.doc(), {
        type: "shieldBlock", chest: pending.chest, uid, name: g.name, classId: g.classId, ...who, amount: 0, gold: g.gold, auto, at,
      });
      return { result: "blocked", chest: pending.chest, victimUid: v.uid, amount: 0, delta: 0, gold: g.gold };
    }
    tx.update(r.gpOf(v.uid), {
      gold: res.victimGold, protectedUntil: Timestamp.fromMillis(t + GR_RULES.protectionMs), lastHit,
    });
    tx.create(r.events.doc(), {
      type: kind, chest: pending.chest, uid, name: g.name, classId: g.classId, ...who,
      amount: res.amount, gold: res.thiefGold, victimGold: res.victimGold, auto, at,
    });
    return {
      result: kind, chest: pending.chest, victimUid: v.uid, amount: res.amount,
      delta: res.thiefGold - g.gold, gold: res.thiefGold, victimGold: res.victimGold,
    };
  });
  if (out.amount || out.delta) await noteLeader(deps, sid).catch(() => null);
  return out;
}

// --- Ledningsbyte ----------------------------------------------------------------

/** Ensam etta med guld (delad etta = ingen ny ledare). */
function soleLeader(docs) {
  const [a, b] = docs.map((d) => d.data());
  if (!a || !(a.gold > 0) || (b && b.gold === a.gold)) return null;
  return a;
}

/**
 * Efter en guldändring: har en ny elev ensam tagit ledningen? Billig läsning
 * först; bara vid byte en liten transaktion (grMeta/leader + händelsen).
 */
export async function noteLeader(deps, sid) {
  const { db, FieldValue } = deps;
  const r = refs(db, sid, "_");
  const top = r.sess.collection("grPlayers").orderBy("gold", "desc").limit(2);
  const lead = soleLeader((await top.get()).docs);
  if (!lead || (await r.meta.get()).data()?.uid === lead.uid) return null;
  return db.runTransaction(async (tx) => {
    const m = await tx.get(r.meta);
    const t = soleLeader((await tx.get(top)).docs);
    if (!t || m.data()?.uid === t.uid) return null;
    tx.set(r.meta, { uid: t.uid, gold: t.gold, at: FieldValue.serverTimestamp() });
    tx.create(r.events.doc(), {
      type: "lead", uid: t.uid, name: t.name, classId: t.classId, gold: t.gold,
      previousUid: m.data()?.uid ?? null, at: FieldValue.serverTimestamp(),
    });
    return t.uid;
  });
}
