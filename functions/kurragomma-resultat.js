// ============================================================================
// Kurragömma på SERVERN – SLUTET (functions/kurragomma-resultat.js, #838)
// ----------------------------------------------------------------------------
// kgAvsluta: när tiden är ute, när alla är hittade eller av läraren (samma väg
// som Meteorstormens msAvsluta). Räknar överlevnadspoängen åt dem som fortfarande
// är gömda (motorn: poangGomdVidSlut), placeringen (delad), rows till pluggmynten
// (spec §10: withRewards(s, result, rows) med rows ur SERVERNS data – beloppen
// räknas här med meteorstorm-mynt.js, samma tal som live-rewards.js) och sparar
// result på sessionen + totalerna i kgPlayers (klar: true). Gömställena läggs i
// result.gomstallen (spec §11.2 – matchen är slut, så det avslöjar inget).
// Sist tas /kg/{sid} bort ur Realtime Database.
//
//   avsluta(deps, auth, raw)             → { result, redan }
//   avslutaIntern(deps, sid, s, { nu })  → { result, redan } (kgTick när arSlut)
//   avsluta → { result, redan, avslutade }: avslutade = !redan, sant bara för det anrop vars
//     transaktion skrev result (klassbonusens engångsgate, #839 N5)
//   byggResultat({ s, spelare, secrets, events, answers, questions, t0, letStart, slut })
//     → { result, totaler: { uid: kgPlayers-fälten efter slutet } }
//
// result = { format: "kurragomma", winner: null, draw: false, startMs, letStartMs, slutMs,
//   players (deltagare: svarat, låst eller hittat), totalCorrect, totalAnswered, klaradeSig, hittade, visslingar,
//   (INTE "varav lärarens" – sessionen läses av eleverna; lärarens historik räknar kgEvents.larare, #840 F1),
//   flestHittade: { uid, name, antal } | null,
//   ranking [{ uid, name, classId, poang, ratt, besvarade, hittade, roll, klaradeSig, rank }],
//   gomstallen [{ uid, x, z, skydd, namn, hittad }], perQuestion [...], rewards? }
// ============================================================================

import { KsError } from "./kistspel-rattning.js";
import { poangGomdVidSlut, placering, rewardRader, deltog } from "./kurragomma/kg-regler.js";
import { fragestatistik } from "./meteorstorm-resultat.js";
import { sessionRewards, placementPrize, perCorrectCoins } from "./meteorstorm-mynt.js";
import {
  refs, parseSid, sessionFor, sattSession, tider, playerFor, quizFor, larareFor, gomdaKvar, glomGomstallen, QUIZ, FORMAT,
} from "./kurragomma-sess.js";
import * as rt from "./kurragomma-rtdb.js";

/**
 * result.rewards ur rows – bara DELTAGARNA (#840): live-rewards computeRewards räknar den som
 * svarat; i Kurragömma också den som låst ett gömställe eller hittat någon (kg-regler deltog),
 * så den som klarade sig gömd hela matchen utan att svara får sitt placeringspris. Rätt-mynten
 * är ändå perCorrect × ratt (0 utan svar). Samma villkor i firestore.rules liveCoinPlayerOk.
 */
function rewardsFor(s, rows) {
  const cfg = sessionRewards(s);
  if (!cfg) return null;
  const out = {};
  for (const r of placering(rows.map((x) => ({ ...x, poang: x.score })))) {
    const prize = placementPrize(cfg.firstPrize, r.plats);
    const correctCoins = perCorrectCoins(r.correct, cfg.perCorrect, cfg.cap);
    out[r.uid] = { rank: r.plats, correct: r.correct, prize, correctCoins, total: prize + correctCoins };
  }
  return out;
}

export function byggResultat({ s, spelare, secrets = {}, events = [], answers = [], questions = null, t0, letStart, slut }) {
  const letStartAt = letStart ?? slut;
  const rader = spelare.map((p) => {
    const gomd = p.roll === "gomd";
    return {
      uid: p.uid, name: String(p.name || ""), classId: p.classId, roll: p.roll, klaradeSig: gomd,
      poang: (p.poang | 0) + (gomd ? poangGomdVidSlut({ letStartAt, slutAt: slut }) : 0),
      ratt: p.ratt | 0, besvarade: p.besvarade | 0, hittade: p.hittade | 0, deltog: deltog(p),
    };
  });
  const ranking = placering(rader).map(({ plats, deltog: _d, ...r }) => ({ ...r, rank: plats }));
  const flest = [...rader].filter((r) => r.hittade > 0).sort((a, b) => b.hittade - a.hittade || a.uid.localeCompare(b.uid))[0] || null;
  const gomstallen = Object.entries(secrets)
    .filter(([, d]) => Number.isFinite(d?.x) && Number.isFinite(d?.z))
    .map(([uid, d]) => ({ uid, x: d.x, z: d.z, skydd: d.skydd | 0, namn: spelare.find((p) => p.uid === uid)?.name || "", hittad: d.gomd !== true }))
    .sort((a, b) => a.uid.localeCompare(b.uid));
  const result = {
    format: FORMAT, winner: null, draw: false, startMs: t0, letStartMs: letStart, slutMs: slut,
    players: rader.filter((r) => r.deltog).length,
    totalCorrect: rader.reduce((n, r) => n + r.ratt, 0),
    totalAnswered: rader.reduce((n, r) => n + r.besvarade, 0),
    klaradeSig: rader.filter((r) => r.klaradeSig).length,
    hittade: rader.filter((r) => !r.klaradeSig && Number.isFinite(secrets[r.uid]?.x)).length,
    visslingar: events.filter((e) => e.typ === "vissling").length,
    // "varav lärarens" skrivs ALDRIG hit: result ligger på sessionen som eleverna läser (#840 F1).
    // Historiken räknar kgEvents med larare: true (bara lärare läser samlingen).
    flestHittade: flest ? { uid: flest.uid, name: flest.name, antal: flest.hittade } : null,
    ranking, gomstallen,
    perQuestion: fragestatistik(answers, s?.gameMode === QUIZ ? questions : null),
  };
  const rewards = rewardsFor(s, rewardRader(rader.filter((r) => r.deltog)));
  if (rewards) result.rewards = rewards;
  const totaler = {};
  for (const r of rader) totaler[r.uid] = { poang: r.poang, klaradeSig: r.klaradeSig, klar: true };
  return { result, totaler };
}

/** Avslutet utan behörighetskoll (kgTick och kgAvsluta). Idempotent. */
export async function avslutaIntern(deps, sid, s, { nu = deps.now() } = {}) {
  const { db, FieldValue, Timestamp } = deps;
  const r = refs(db, sid);
  if (s.result) return { result: s.result, redan: true };
  if (s.status !== "finished") {
    await db.runTransaction(async (tx) => {
      const d = (await tx.get(r.sess)).data();
      if (d.status !== "finished") tx.update(r.sess, { status: "finished", finishedAt: Timestamp.fromMillis(nu) });
    });
    s = await sessionFor(deps, sid, { farsk: true });
  }
  const { t0, letStart, slut } = tider(s);
  const [plSnap, secSnap, evSnap, aSnap] = await Promise.all([r.kgPlayers.get(), r.secrets.get(), r.events.get(), r.answers.get()]);
  const spelare = plSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const { result, totaler } = byggResultat({
    s, spelare, t0, letStart, slut,
    secrets: Object.fromEntries(secSnap.docs.map((d) => [d.id, d.data()])),
    events: evSnap.docs.map((d) => d.data()),
    answers: aSnap.docs.map((d) => d.data()),
    questions: s.gameMode === QUIZ ? (await quizFor(deps, sid)).pub.questions || [] : null,
  });
  const ut = await db.runTransaction(async (tx) => {
    const d = (await tx.get(r.sess)).data();
    if (d.result) return { result: d.result, redan: true };
    tx.update(r.sess, { result: { ...result, computedAt: FieldValue.serverTimestamp() } });
    for (const [uid, tot] of Object.entries(totaler)) tx.update(r.kgPlayer(uid), tot);
    return { result, redan: false };
  });
  sattSession(deps, sid, { ...s, result: ut.result });
  glomGomstallen(deps, sid);
  if (!ut.redan) await rt.taBort(deps.rtdb, sid);
  return ut;
}

/** kgAvsluta. deps.roll(auth) = callerRole (index.js) – null för elever. */
export async function avsluta(deps, auth, raw) {
  const sid = parseSid(raw);
  const s = await sessionFor(deps, sid, { farsk: true });
  const { t0, slut } = tider(s);
  if (t0 == null) throw new KsError("failed-precondition", "Matchen har inte startat.");
  if (s.result) return { result: s.result, redan: true, avslutade: false };
  const nu = deps.now();
  if (!larareFor(deps.roll ? await deps.roll(auth) : null, s)) {
    await playerFor(deps, sid, auth?.uid, s);
    const kvar = s.kgFas === "leta" ? await gomdaKvar(deps, sid) : null;
    if (s.status !== "finished" && nu < slut && kvar !== 0) throw new KsError("failed-precondition", "Matchen pågår fortfarande.");
  }
  const ut = await avslutaIntern(deps, sid, s, { nu });
  return { ...ut, avslutade: !ut.redan }; // bara det anrop som skrev result (klassbonusen, #839 N5)
}
