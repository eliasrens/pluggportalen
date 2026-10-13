// ============================================================================
// Pluggporten – KISTSPEL på SERVERN (functions/kistspel-core.js, #651)
// ----------------------------------------------------------------------------
// Utbrutet ur Guldrushen (functions/guldrush-core.js, #563/#588/#601): allt
// som rör saldot avgörs här – eleven skriver ALDRIG saldo, kistor, skydd eller
// händelser (firestore.rules nekar). Ett kistformat bygger sin server med
// createKistServer(cfg) och index.js kör funktionerna med Admin SDK:t
// injicerat (samma mönster som login-core.js), så kärnan kan testas direkt
// mot Firestore-emulatorn med styrd klocka och slump.
//
// FLÖDET (samma för alla kistformat)
//   answerQuestion  eleven svarar → servern rättar (kistspel-rattning.js:
//     multiplikation räknas om; quiz/tidslinje mot det lärarskyddade facit i
//     formatets privata dokument) och skapar answers/{attemptId} (create-only).
//     Quiz: servern väljer elevens nästa fråga (nextQ).
//   openChest       ett RÄTT svar → EN kista (answers/{attemptId}.chest sätts
//     i samma transaktion – en andra öppning nekas). Slumpen här (deps.rng).
//     Offer-kista (steal/swap) → spelarens pending; offret väljs med chooseVictim.
//   chooseVictim    stöld/byte i EN transaktion som ändrar båda elevernas saldo.
//     Trygghetsreglerna (regler.victimProblem) prövas i valets ögonblick; ett
//     nekat val ligger kvar, inget val/för sent → servern slumpar bland
//     oskyddade; ingen möjlig → kistans fallback (cfg.fallbackChest).
//   noteLeader      efter en saldoändring: ny ensam ledare → meta/leader + en
//     "lead"-händelse.
//   Alla: sessionen måste vara formatets, status live och inom matchtiden.
//
// HÄNDELSEFLÖDET: varje utfall skriver {events}/{autoId} { type, chest?, uid,
// name, classId, victim…?, amount, gold, at = serverns tid } i SAMMA
// transaktion. Saldofältet heter `gold` i motorn (alla format).
//
// API
//   createKistServer({
//     format,         sessionens format-id ("guldrush")
//     regler,         createKistRegler(…) (formatets delat/, kopian här)
//     rules,          { chestsOffered, victimPickMs, victimGraceMs, minChestGapMs, … }
//     collections,    { players, private, public, meta, events } – underkollektioner
//                     ("grPlayers", "grPrivate", "grPublic", "grMeta", "grEvents")
//     fallbackChest,  kistans id när en offer-kista saknar egen fallback
//     texts,          { wrongFormat, modeUnsupported, pendingFirst, noPending }
//   }) → { answerQuestion, openChest, chooseVictim, noteLeader, matchWindow }
//     answerQuestion(deps, uid, { sid, attemptId, factorA?, factorB?, answer?,
//                    choiceIndex?, q?, year? }) → { attemptId, correct, correctAnswer,
//                    nextQ, correctYear? }
//     openChest(deps, uid, { sid, attemptId, chestIndex }) → { chest, kind,
//                    delta, gold, protectedUntil (ms | null), pending? }
//     chooseVictim(deps, uid, { sid, victimUid? }) → { result: "steal"|"swap"|
//                    "fallback", chest, victimUid?, amount, delta, gold }
//     noteLeader(deps, sid) → uid | null
//   deps = { db, FieldValue, Timestamp, now?(), rng?() }
//   KsError(code, message) – ur kistspel-rattning.js
// ============================================================================

import { KsError, gradeMult, gradeQuiz, pickNextQ, yearOut } from "./kistspel-rattning.js";
import { toMs } from "./kistspel/ks-regler.js";

export { KsError };

const MULT = "multiplication_0_10";
const QUIZ = "plugga_quiz";
const SID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;

const bad = (msg) => new KsError("invalid-argument", msg);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** Officiella tider ur startedAt (samma som reglerna och live-core sessionTimes). */
export function matchWindow(s) {
  const start = toMs(s?.startedAt);
  if (start == null) return null;
  const t0 = start + (Number(s.countdownSeconds) || 0) * 1000;
  return { t0, end: t0 + (Number(s.durationSeconds) || 0) * 1000 };
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

function assertLive(s, now) {
  const w = matchWindow(s);
  if (s.status !== "live" || !w) throw new KsError("failed-precondition", "Matchen pågår inte.");
  if (now < w.t0) throw new KsError("failed-precondition", "Matchen har inte börjat än.");
  if (now >= w.end) throw new KsError("failed-precondition", "Tiden är ute! ⏰");
}

/** Spelardokumentet (kärnans "Gå med", skapat under reglerna) = deltagare. */
function playerOf(snap, s) {
  const p = snap.exists ? snap.data() : null;
  if (!p || !(s.participatingClassIds || []).includes(p.classId)) {
    throw new KsError("permission-denied", "Gå med i matchen först.");
  }
  return p;
}

export function createKistServer({ format, regler, rules, collections: col, fallbackChest, texts }) {
  const {
    chestById, isVictimKind, rollChest, applySelfEffect, victimProblem, victimMessage,
    eligibleVictims, resolveVictim, shieldUntil, hitProtectionUntil,
  } = regler;

  function refs(db, sid, uid) {
    const sess = db.collection("liveSessions").doc(sid);
    return {
      sess,
      player: sess.collection("players").doc(uid),
      gp: sess.collection(col.players).doc(uid),
      priv: sess.collection(col.private).doc("snapshot"),
      pub: sess.collection(col.public).doc("questions"),
      meta: sess.collection(col.meta).doc("leader"),
      events: sess.collection(col.events),
      answer: (id) => sess.collection("answers").doc(id),
      gpOf: (id) => sess.collection(col.players).doc(id),
    };
  }

  /** Sessionen måste finnas och vara formatets. */
  function sessionOf(snap) {
    if (!snap.exists) throw new KsError("not-found", "Matchen finns inte.");
    const s = snap.data();
    if (s.format !== format) throw new KsError("failed-precondition", texts.wrongFormat);
    return s;
  }

  // --- Svar --------------------------------------------------------------------

  async function answerQuestion(deps, uid, raw) {
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
        if (a.uid !== uid) throw new KsError("already-exists", "Svaret finns redan.");
        // Tidslinjen: det låsta årtalet går inte att byta i efterhand.
        if (a.answerKind === "timeline" && raw?.year !== a.year) throw new KsError("already-exists", "Ditt årtal är redan låst.");
        return { attemptId, correct: a.isCorrect === true, correctAnswer: a.correctAnswer, nextQ: g?.nextQ ?? null, ...yearOut(a) };
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
        throw new KsError("failed-precondition", texts.modeUnsupported);
      }
      tx.create(r.answer(attemptId), {
        ...graded, uid, classId: p.classId, format, at: FieldValue.serverTimestamp(),
      });
      const ok = graded.isCorrect;
      const base = g ? {} : {
        uid, classId: p.classId, name: String(p.name || ""), gold: 0, chests: 0,
        protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null, joinedAt: FieldValue.serverTimestamp(),
      };
      tx.set(r.gp, {
        ...base,
        correct: FieldValue.increment(ok ? 1 : 0),
        incorrect: FieldValue.increment(ok ? 0 : 1),
        lastAnswerAt: FieldValue.serverTimestamp(),
        ...(nextQ != null ? { nextQ } : {}),
      }, { merge: true });
      return { attemptId, correct: ok, correctAnswer: graded.correctAnswer, nextQ, ...yearOut(graded) };
    });
  }

  // --- Kistan --------------------------------------------------------------------

  async function openChest(deps, uid, raw) {
    const { db, FieldValue, Timestamp } = deps;
    const now = deps.now || Date.now;
    const rng = deps.rng || Math.random;
    const sid = parseSid(raw);
    const attemptId = parseAttempt(raw);
    const chestIndex = raw?.chestIndex ?? 0;
    if (!isInt(chestIndex, 0, rules.chestsOffered - 1)) throw bad("Välj en av kistorna.");
    const r = refs(db, sid, uid);
    const out = await db.runTransaction(async (tx) => {
      const [sSnap, gSnap, aSnap] = await tx.getAll(r.sess, r.gp, r.answer(attemptId));
      const s = sessionOf(sSnap);
      const t = now();
      assertLive(s, t);
      const a = aSnap.exists ? aSnap.data() : null;
      if (!a || a.uid !== uid || a.format !== format) {
        throw new KsError("permission-denied", "Kistan hör inte till något av dina svar.");
      }
      if (a.isCorrect !== true) throw new KsError("failed-precondition", "Bara ett rätt svar ger en kista.");
      if (a.chest) throw new KsError("already-exists", "Den kistan är redan öppnad.");
      const g = gSnap.data();
      if (g.pending) throw new KsError("failed-precondition", texts.pendingFirst);
      const last = toMs(g.lastChestAt);
      if (last != null && t - last < rules.minChestGapMs) {
        throw new KsError("resource-exhausted", "En kista i taget!");
      }
      const chest = rollChest(s.stealSwap !== false, rng);
      const kind = chest.effect.kind;
      const stamp = Timestamp.fromMillis(t);
      tx.update(r.answer(attemptId), { chest: chest.id, chestIndex, chestAt: FieldValue.serverTimestamp() });
      if (isVictimKind(chest)) {
        const pending = { kind, chest: chest.id, attemptId, at: stamp, expiresAt: Timestamp.fromMillis(t + rules.victimPickMs) };
        tx.update(r.gp, { pending, chests: FieldValue.increment(1), lastChestAt: stamp });
        return {
          chest: chest.id, kind, delta: 0, gold: g.gold, protectedUntil: toMs(g.protectedUntil),
          pending: { kind, expiresAtMs: t + rules.victimPickMs },
        };
      }
      const eff = applySelfEffect(chest, g.gold);
      const until = eff.protect ? shieldUntil(t) : toMs(g.protectedUntil);
      tx.update(r.gp, {
        gold: eff.gold, chests: FieldValue.increment(1), lastChestAt: stamp,
        ...(eff.protect ? { protectedUntil: Timestamp.fromMillis(until) } : {}),
      });
      tx.create(r.events.doc(), {
        type: "chest", chest: chest.id, uid, name: g.name, classId: g.classId,
        amount: eff.delta, gold: eff.gold, at: FieldValue.serverTimestamp(),
      });
      return { chest: chest.id, kind, delta: eff.delta, gold: eff.gold, protectedUntil: until };
    });
    if (out.delta) await noteLeader(deps, sid).catch(() => null);
    return out;
  }

  // --- Stöld och byte ------------------------------------------------------------------

  async function chooseVictim(deps, uid, raw) {
    const { db, FieldValue, Timestamp } = deps;
    const now = deps.now || Date.now;
    const rng = deps.rng || Math.random;
    const sid = parseSid(raw);
    const asked = raw?.victimUid ?? null;
    if (asked !== null && (typeof asked !== "string" || !SID_RE.test(asked))) throw bad("Ogiltig klasskamrat.");
    const r = refs(db, sid, uid);

    // Inget val eller för sent → servern slumpar bland dem som går just nu
    // (aldrig en skyddad). Listan läses utanför transaktionen (inga lås på alla
    // spelare); transaktionen prövar det valda offret igen i valets ögonblick.
    const pre = (await r.gp.get()).data();
    if (!pre?.pending) throw new KsError("failed-precondition", texts.noPending);
    const late = now() > toMs(pre.pending.expiresAt) + rules.victimGraceMs;
    const auto = asked === null || late;
    let target = asked;
    if (auto) {
      const all = (await r.sess.collection(col.players).get()).docs.map((d) => d.data());
      const cands = eligibleVictims(pre.pending.kind, pre, all, now());
      target = cands.length ? cands[Math.floor(rng() * cands.length)].uid : null;
    }

    const out = await db.runTransaction(async (tx) => {
      const [sSnap, gSnap, vSnap] = await tx.getAll(r.sess, r.gp, ...(target ? [r.gpOf(target)] : []));
      const s = sessionOf(sSnap);
      const t = now();
      assertLive(s, t);
      const g = gSnap.data();
      const pending = g?.pending;
      if (!pending) throw new KsError("failed-precondition", texts.noPending);
      const kind = pending.kind;
      const v = vSnap?.exists ? vSnap.data() : null;
      const problem = s.stealSwap === false ? "av" : victimProblem(kind, g, v, t);
      if (problem && !auto && problem !== "av") {
        // Nekat val: pending ligger kvar – tjuven väljer om (tiden går vidare).
        throw new KsError(problem === "saknas" ? "not-found" : "failed-precondition", victimMessage(problem, v));
      }
      const at = FieldValue.serverTimestamp();
      if (problem) {
        // Ingen kan väljas (eller stöld/byte avstängt) → kistans fallback.
        const fb = chestById(chestById(pending.chest)?.fallback) || chestById(fallbackChest);
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
      const lastHit = { kind, byUid: uid, byName: g.name, amount: res.amount, at: Timestamp.fromMillis(t) };
      tx.update(r.gp, { gold: res.thiefGold, pending: null, lastVictimUid: v.uid });
      tx.update(r.gpOf(v.uid), {
        gold: res.victimGold, protectedUntil: Timestamp.fromMillis(hitProtectionUntil(v, t)), lastHit,
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

  /** Ensam etta med saldo (delad etta = ingen ny ledare). */
  function soleLeader(docs) {
    const [a, b] = docs.map((d) => d.data());
    if (!a || !(a.gold > 0) || (b && b.gold === a.gold)) return null;
    return a;
  }

  /**
   * Efter en saldoändring: har en ny elev ensam tagit ledningen? Billig läsning
   * först; bara vid byte en liten transaktion (meta/leader + händelsen).
   */
  async function noteLeader(deps, sid) {
    const { db, FieldValue } = deps;
    const r = refs(db, sid, "_");
    const top = r.sess.collection(col.players).orderBy("gold", "desc").limit(2);
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

  return { answerQuestion, openChest, chooseVictim, noteLeader, matchWindow };
}
