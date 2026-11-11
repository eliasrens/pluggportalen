// ============================================================================
// Pluggporten – KURRAGÖMMA på SERVERN (functions/kurragomma-core.js, #838)
// ----------------------------------------------------------------------------
// Servern avgör allt som påverkar spelet: rollerna, gömställena, rättningen,
// visslingarna, sökningen och poängen. Klienten skriver ALDRIG i kg-samlingarna
// (firestore.rules) och aldrig annat än sin egen pos i Realtime Database
// (database.rules.json). index.js kör funktionerna med Admin SDK:t injicerat,
// så kärnan testas direkt mot emulatorerna med styrd klocka och slump.
// Kontraktet: docs/KURRAGOMMA.md §9. Motorn: ./kurragomma/ (kopia av
// src/live/formats/kurragomma/delat/ – npm run sync:kurragomma).
// Delarna: -sess.js (sessionen, minnet), -fas.js (starten, fasbytet),
// -rtdb.js (rörelsekanalen), -tick.js (kgTick), -resultat.js (kgAvsluta).
//
// ANROPEN (spec §5.2)
//   starta  kgStarta({ sid })  värdlärarens projektor efter KÖR! (lat i alla andra)
//   anslut  kgAnslut({ sid })  elevens spelyta monteras / återansluter
//           → { roll, fas, laddningar, poang, ratt, besvarade, harLast, gomstalle,
//               start, nextQ, tider: { t0, gomSlut, letStart, slut }, inst, showNames }
//   las     kgLas({ sid, x, z })  gömmaren låser (gömfasen, + LAS_MARGINAL_MS)
//           → { gomstalle: { x, z, skydd, namn }, flyttad, redan }
//   svara   kgSvara({ sid, attemptId, factorA, factorB, answer, choiceIndex?, q?, year? })
//           rättas som kistspelen (answers/{attemptId} för statistiken)
//           → { attemptId, correct, correctAnswer, nextQ, poang, laddningar, vissling, plats?, correctYear? }
//   leta    kgLeta({ sid, x, z })  EN transaktion: kontroll, sökning, hittade blir sökare
//           → { hittade: [{ uid, namn, x, z, plats }], laddningar, poang, plats, flode }
//
// deps = { db, rtdb, FieldValue, Timestamp, now(), rng(), minne?, roll?(auth) }
// ============================================================================

import { KsError, gradeMult, gradeQuiz, pickNextQ, yearOut } from "./kistspel-rattning.js";
import {
  rollVidAnslutning, laddningarNySokare, svarsEffekt, visslingsplats, kontrolleraSokning, sok, poangForHittad,
  missFlodeTillats,
} from "./kurragomma/kg-regler.js";
import { narmasteGiltiga, skydd, platsNamn } from "./kurragomma/kg-geometri.js";
import { LAS_MARGINAL_MS, LETA_SPARR_MS } from "./kurragomma/kg-config.js";
import {
  refs, parseSid, parseAttempt, parsePunkt, sessionFor, tider, assertLive, playerFor, quizFor, instFor, kartaFor,
  namnFor, larareFor, fel, FORMAT, MULT, QUIZ,
} from "./kurragomma-sess.js";
import { startaIntern, redo, spelareDoc, gorTillSokare } from "./kurragomma-fas.js";
import * as rt from "./kurragomma-rtdb.js";

export { KsError };
export { nyttMinne } from "./kurragomma-sess.js";
export { tick } from "./kurragomma-tick.js";
export { avsluta } from "./kurragomma-resultat.js";

const tiderUt = (s) => {
  const t = tider(s);
  return { t0: t.t0, gomSlut: t.gomSlut, letStart: t.letStart, slut: t.slut };
};

/** kgStarta – läraren som styr matchen eller en deltagare (lat start gör samma sak). */
export async function starta(deps, auth, raw) {
  const sid = parseSid(raw);
  let s = await sessionFor(deps, sid);
  if (!larareFor(deps.roll ? await deps.roll(auth) : null, s)) await playerFor(deps, sid, auth?.uid, s);
  s = await startaIntern(deps, sid, s);
  return { fas: s.kgFas, tider: tiderUt(s) };
}

/** kgAnslut – elevens roll, fas, laddningar och (låst gömmare) det egna gömstället. */
export async function anslut(deps, uid, raw) {
  const { db } = deps;
  const sid = parseSid(raw);
  const s = await redo(deps, sid);
  const p = await playerFor(deps, sid, uid, s);
  const r = refs(db, sid);
  const nu = deps.now();
  const karta = kartaFor(s);
  let ny = false;
  const kp = await db.runTransaction(async (tx) => {
    const snap = await tx.get(r.kgPlayer(uid));
    if (snap.exists) return snap.data();
    const roll = rollVidAnslutning(s.kgFas);
    const doc = { ...spelareDoc({ uid, ...p }, roll, nu), ...(roll === "sokare" ? { laddningar: laddningarNySokare(), letStartGjord: true } : {}) };
    tx.set(r.kgPlayer(uid), doc);
    if (roll === "sokare") tx.set(r.secret(uid), { gomd: false, startpunkt: { ...karta.sokarStart, at: nu }, senasteSok: null, senastVisslingAt: null });
    ny = true;
    return doc;
  });
  if (ny && kp.roll === "sokare") await rt.nySokare(deps.rtdb, sid, { uid, ...karta.sokarStart, t: nu, varGomd: false });
  else if (ny) await Promise.all([rt.laggTillMed(deps.rtdb, sid, uid), rt.status(deps.rtdb, sid, { gomda: rt.okning(1) })]);
  else await rt.laggTillMed(deps.rtdb, sid, uid);
  let gomstalle = null;
  let start = null;
  if (kp.roll === "gomd" && kp.harLast) gomstalle = (await r.self(uid).get()).data()?.gomstalle || null;
  if (kp.roll === "sokare") {
    const sp = (await r.secret(uid).get()).data()?.startpunkt;
    start = sp ? { x: sp.x, z: sp.z } : { ...karta.sokarStart };
  }
  return {
    roll: kp.roll, fas: s.kgFas, laddningar: kp.laddningar | 0, poang: kp.poang | 0, ratt: kp.ratt | 0, besvarade: kp.besvarade | 0,
    harLast: !!kp.harLast, gomstalle, start, nextQ: kp.nextQ ?? null, hittadAvNamn: kp.hittadAvNamn ?? null,
    tider: tiderUt(s), inst: instFor(s), showNames: s.showNames !== false,
  };
}

/** kgLas – gömmaren låser sin plats (spec §1.2). Ogiltig plats flyttas till närmaste giltiga. */
export async function las(deps, uid, raw) {
  const { db } = deps;
  const sid = parseSid(raw);
  const { x, z } = parsePunkt(raw);
  let s = await sessionFor(deps, sid);
  if (!s.kgFas) s = await startaIntern(deps, sid, s);
  await playerFor(deps, sid, uid, s);
  const nu = deps.now();
  const { gomSlut, letStart } = tider(s);
  if (s.status !== "live" || gomSlut == null) throw new KsError("failed-precondition", "Matchen pågår inte.");
  if (nu >= gomSlut + LAS_MARGINAL_MS) throw new KsError("failed-precondition", "Gömfasen är slut.");
  const r = refs(db, sid);
  const karta = kartaFor(s);
  const ut = await db.runTransaction(async (tx) => {
    const [kpSnap, selfSnap] = await tx.getAll(r.kgPlayer(uid), r.self(uid));
    const kp = kpSnap.data();
    if (!kp) throw new KsError("failed-precondition", "Anslut till matchen först.");
    if (kp.roll !== "gomd") throw new KsError("failed-precondition", "Bara gömmare låser ett gömställe.");
    if (kp.harLast) return { gomstalle: selfSnap.data()?.gomstalle || null, flyttad: false, redan: true };
    const p = narmasteGiltiga(x, z, karta);
    const gomstalle = { x: p.x, z: p.z, skydd: skydd(p.x, p.z, karta), namn: platsNamn(p.x, p.z, karta) };
    tx.set(r.self(uid), { gomstalle });
    tx.set(r.secret(uid), { x: p.x, z: p.z, skydd: gomstalle.skydd, gomd: true, lastAt: nu, senastVisslingAt: null }, { merge: true });
    tx.update(r.kgPlayer(uid), { harLast: true, tystRef: letStart ?? 0 });
    return { gomstalle, flyttad: Math.hypot(p.x - x, p.z - z) > 1e-9, redan: false };
  });
  if (!ut.redan) await rt.status(deps.rtdb, sid, { lasta: rt.okning(1) });
  await redo(deps, sid).catch(() => null);
  return ut;
}

/** kgSvara – rättar som kistspelen; gömmare: poäng eller vissling, sökare: poäng och laddning. */
export async function svara(deps, uid, raw) {
  const { db, FieldValue } = deps;
  const sid = parseSid(raw);
  const attemptId = parseAttempt(raw);
  const s = await redo(deps, sid);
  const p = await playerFor(deps, sid, uid, s);
  const nu = deps.now();
  assertLive(s, nu);
  if (s.gameMode !== MULT && s.gameMode !== QUIZ) throw new KsError("failed-precondition", "Spelläget stöds inte i Kurragömma.");
  const quiz = s.gameMode === QUIZ ? await quizFor(deps, sid) : null;
  const r = refs(db, sid);
  const karta = kartaFor(s);
  const ut = await db.runTransaction(async (tx) => {
    const [kpSnap, aSnap, secSnap] = await tx.getAll(r.kgPlayer(uid), r.answer(attemptId), r.secret(uid));
    const kp = kpSnap.data();
    if (!kp) throw new KsError("failed-precondition", "Anslut till matchen först.");
    if (aSnap.exists) {
      const a = aSnap.data();
      if (a.uid !== uid) throw new KsError("already-exists", "Svaret finns redan.");
      if (a.answerKind === "timeline" && raw?.year !== a.year) throw new KsError("already-exists", "Ditt årtal är redan låst.");
      return { igen: true, attemptId, correct: a.isCorrect === true, correctAnswer: a.correctAnswer, nextQ: kp.nextQ ?? null, poang: kp.poang | 0, laddningar: kp.laddningar | 0, vissling: false, ...yearOut(a) };
    }
    if (kp.roll === "gomd" && s.kgFas !== "leta") throw new KsError("failed-precondition", "Inga frågor under gömfasen – göm dig!");
    let graded;
    let nextQ = null;
    if (quiz) {
      graded = gradeQuiz(s, raw, kp, quiz.pub, quiz.priv);
      nextQ = pickNextQ((quiz.pub.questions || []).length, graded.q, deps.rng);
    } else {
      graded = gradeMult(s, raw);
    }
    const sec = secSnap.exists ? secSnap.data() : null;
    const eff = svarsEffekt({ roll: kp.roll, ratt: graded.isCorrect, fas: s.kgFas, laddningar: kp.laddningar | 0, senastVisslingAt: sec?.senastVisslingAt ?? null, nu });
    const visslar = eff.vissling && sec?.gomd === true;
    tx.create(r.answer(attemptId), { ...graded, uid, classId: p.classId, format: FORMAT, at: FieldValue.serverTimestamp() });
    tx.update(r.kgPlayer(uid), {
      poang: FieldValue.increment(eff.poang), laddningar: eff.laddningar, ratt: FieldValue.increment(graded.isCorrect ? 1 : 0),
      besvarade: FieldValue.increment(1), senastSvarAt: nu, ...(kp.roll === "gomd" ? { tystRef: nu } : {}), ...(nextQ != null ? { nextQ } : {}),
    });
    let vissling = null;
    if (visslar) {
      const pl = visslingsplats(sec.x, sec.z, deps.rng(), deps.rng(), karta);
      vissling = { x: pl.x, z: pl.z, plats: platsNamn(pl.x, pl.z, karta), t: nu };
      tx.update(r.secret(uid), { senastVisslingAt: nu });
      tx.create(r.events.doc(), { t: nu, typ: "vissling", x: pl.x, z: pl.z, plats: vissling.plats });
    }
    return {
      attemptId, correct: graded.isCorrect, correctAnswer: graded.correctAnswer, nextQ, poang: (kp.poang | 0) + eff.poang,
      laddningar: eff.laddningar, vissling: !!vissling, ...(vissling ? { plats: vissling.plats } : {}), ...yearOut(graded), handelse: vissling,
    };
  });
  const { handelse, ...svar } = ut;
  if (handelse) await rt.handelse(deps.rtdb, sid, { typ: "vissling", ...handelse });
  return svar;
}

const SOK_FEL = {
  "inte-sokare": ["failed-precondition", "Bara sökare letar."],
  "ingen-laddning": ["failed-precondition", "Svara rätt för att ladda ficklampan."],
  sparr: ["resource-exhausted", "Vänta lite mellan sökningarna."],
  utanfor: ["invalid-argument", "Platsen ligger utanför ön."],
  orimlig: ["failed-precondition", "Du kan inte ha hunnit dit."],
};

/** kgLeta – sökningen i EN transaktion (spec §1.6). Två sökare på samma gömmare: bara en får poängen. */
export async function leta(deps, uid, raw) {
  const { db, FieldValue } = deps;
  const sid = parseSid(raw);
  const { x, z } = parsePunkt(raw);
  const s = await redo(deps, sid);
  const p = await playerFor(deps, sid, uid, s);
  const nu = deps.now();
  assertLive(s, nu);
  if (s.kgFas !== "leta") throw new KsError("failed-precondition", "Sökarna blundar – vänta tills gömfasen är slut.");
  const r = refs(db, sid);
  const karta = kartaFor(s);
  const { letStart } = tider(s);
  const ut = await db.runTransaction(async (tx) => {
    const [kpSnap, secSnap] = await tx.getAll(r.kgPlayer(uid), r.secret(uid));
    const kp = kpSnap.data();
    if (!kp) throw new KsError("failed-precondition", "Anslut till matchen först.");
    const sec = secSnap.exists ? secSnap.data() : {};
    const k = kontrolleraSokning({ roll: kp.roll, laddningar: kp.laddningar | 0, x, z, nu, senasteSok: sec.senasteSok || null, startpunkt: sec.startpunkt || null, karta });
    if (!k.ok) {
      const [code, msg] = SOK_FEL[k.skal];
      throw fel(code, msg, { skal: k.skal, ...(k.skal === "sparr" ? { vantaMs: LETA_SPARR_MS - (nu - sec.senasteSok.at) } : {}) });
    }
    const gomdaSnap = await tx.get(r.secrets.where("gomd", "==", true));
    const gomda = gomdaSnap.docs.filter((d) => d.id !== uid).map((d) => ({ uid: d.id, ...d.data() }));
    const traff = new Set(sok({ x, z, nu }, gomda, karta));
    const hittadeSnaps = traff.size ? await tx.getAll(...[...traff].map((h) => r.kgPlayer(h))) : [];
    const hittade = [];
    for (const hs of hittadeSnaps) {
      const hkp = hs.data();
      if (!hkp || hkp.roll !== "gomd") continue;
      const gs = gomda.find((g) => g.uid === hs.id);
      const pl = gorTillSokare(tx, r, { uid: hs.id, kp: hkp, sec: gs, nu, letStart, FieldValue, hittadAv: uid, hittadAvNamn: namnFor(s, p.name) });
      tx.create(r.events.doc(), { t: nu, typ: "hittad", x: pl.x, z: pl.z, plats: pl.plats, sokare: uid, hittad: hs.id });
      hittade.push({ uid: hs.id, namn: namnFor(s, hkp.name), ...pl });
    }
    const flode = hittade.length === 0 && missFlodeTillats(sec.senastMissFlodeAt, nu);
    tx.update(r.kgPlayer(uid), {
      laddningar: (kp.laddningar | 0) - 1, hittade: FieldValue.increment(hittade.length), poang: FieldValue.increment(poangForHittad() * hittade.length),
    });
    tx.set(r.secret(uid), { senasteSok: { x, z, at: nu }, ...(flode ? { senastMissFlodeAt: nu } : {}) }, { merge: true });
    return { hittade, flode, laddningar: (kp.laddningar | 0) - 1, poang: (kp.poang | 0) + poangForHittad() * hittade.length, plats: platsNamn(x, z, karta) };
  });
  const namn = namnFor(s, p.name);
  for (const h of ut.hittade) {
    await rt.nySokare(deps.rtdb, sid, { uid: h.uid, x: h.x, z: h.z, t: nu, varGomd: true });
    await rt.handelse(deps.rtdb, sid, { typ: "hittad", x: h.x, z: h.z, plats: h.plats, t: nu, namn, hittad: h.namn });
  }
  if (ut.flode) await rt.handelse(deps.rtdb, sid, { typ: "miss", x, z, plats: ut.plats, t: nu, namn });
  return ut;
}
