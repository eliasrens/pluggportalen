// ============================================================================
// Klassmatchen (format "klassmatch", #547): ren logik för klass mot klass –
// flyttad ur live-core.js OFÖRÄNDRAD (samma indata → samma resultat; bevisas
// mot en fryst kopia i test/live-formats.test.js). Ingen DOM, ingen Firebase.
//
// Poängmodellen: antal rätt per klass (shardade klassräknare) ÷ lärarens
// nämnare. Vinnare = högst poäng, lika = oavgjort. Mynt-pris (#526) till
// vinnarklassens klasskassa, kooperativa lägen (#495), trollkarlar (#536).
//
// API
//   LIVE_COUNTER_SHARDS       10 shardade klassräknare (40–60 elever)
//   READY_FRESH_MS            75 s – en spelare utan puls längre än så räknas
//                             inte som "redo" i lobbyn
//   MAX_LIVE_CLASSES / MIN_LIVE_CLASSES  8 / 2
//   LIVE_PRIZE_MAX            100 000 – högsta mynt-pris (reglerna har samma tak)
//   sumCounters(docs)         → { classId: rätt } ur shardade räknare
//   divisorFor(s, classId)    → nämnaren (minst 1)
//   classStandings(s, correctByClass, players?, now?) → [{ classId, name,
//                             correct, divisor, score, joined, ready }]
//   decideWinner(standings)   → { winnerId|null, draw, leaderIds }
//   buildResult(s, standings, players, mode?) → result-map till liveSessions.result
//                             (kooperativt läge → result.cooperative +
//                             result.goalReached, #495; result.winnerClasses =
//                             prisets mottagare, #526)
//   parsePrize(v) / sessionPrize(s) / prizeShare(prize, n) / prizeText(s, result?)
//   sessionTitle(s)           → "4B MOT 5E"
//   defaultSessionName(names) → "4B mot 5E"
//   validateSetup(input)      → string[] – mynt-pris + nämnare (klassantal och
//                             matchlängd kontrollerar kärnan, live-core)
//   buildSessionFields(input) → { classDivisors, counterShards, coinPrize?, wizards? }
//   DIVISOR_LOCKED_MSG        förklaringen när nämnaren är låst efter slut (#543)
// ============================================================================

import { toMs } from "../../live-time.js";
import { validWizards, defaultWizards } from "../../trollkarl/trollkarl-val.js";

export const LIVE_COUNTER_SHARDS = 10;
export const READY_FRESH_MS = 75_000;
export const MIN_LIVE_CLASSES = 2;
export const MAX_LIVE_CLASSES = 8;
export const LIVE_PRIZE_MAX = 100_000;

const tal = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("sv-SE");

/** Lärarens fält → heltal ≥ 0 (tomt = 0 = inget pris), NaN om ogiltigt. */
export function parsePrize(v) {
  const t = String(v ?? "").replace(/[\s ]/g, "");
  if (!t) return 0;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

/** Sessionens mynt-pris till vinnarklassens klasskassa (#526). 0 = inget pris. */
export function sessionPrize(s) {
  const n = Number(s?.coinPrize);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Varje vinnarklass andel: oavgjort delas lika, avrundat nedåt (reglerna räknar likadant). */
export function prizeShare(prize, n) {
  const p = Math.floor(Number(prize) || 0);
  const k = Math.floor(Number(n) || 0);
  return p > 0 && k > 0 ? Math.floor(p / k) : 0;
}

/**
 * Prisraden för lobby/projektor/vinnarskärm. Med result: vad som faktiskt
 * delas ut (en vinnare / oavgjort / ingen vinnare); utan: utlovat pris.
 */
export function prizeText(s, result = null) {
  const prize = sessionPrize(s);
  if (!prize) return "";
  if (!result) return `Vinnarklassen får ${tal(prize)} mynt till klasskassan!`;
  const vinnare = Array.isArray(result.winnerClasses) ? result.winnerClasses : [];
  if (!vinnare.length) return "Ingen klass fick poäng – mynt-priset delas inte ut.";
  const andel = prizeShare(prize, vinnare.length);
  if (vinnare.length === 1) {
    const namn = s?.classNames?.[vinnare[0]] || vinnare[0];
    return `${namn} får ${tal(andel)} mynt till klasskassan!`;
  }
  return `Priset delas – ${tal(andel)} mynt var till de vinnande klassernas klasskassor!`;
}

/** Summera shardade räknare per klass. */
export function sumCounters(docs) {
  const out = {};
  for (const d of docs || []) {
    if (!d || typeof d.classId !== "string") continue;
    out[d.classId] = (out[d.classId] || 0) + (Number(d.correct) || 0);
  }
  return out;
}

/** Klassens nämnare (lärarens val; minst 1 så vi aldrig delar med 0). */
export function divisorFor(s, classId) {
  const n = Math.floor(Number(s?.classDivisors?.[classId]));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Ställningen per klass, i sessionens klassordning.
 * @param {object} s sessionen
 * @param {Record<string,number>} correctByClass ur sumCounters
 * @param {object[]} [players] spelardokument (uid, classId, lastSeenAt …)
 * @param {number} [now] för "redo" (färsk puls)
 */
export function classStandings(s, correctByClass = {}, players = [], now = null) {
  return (s?.participatingClassIds || []).map((classId) => {
    const correct = Number(correctByClass[classId]) || 0;
    const divisor = divisorFor(s, classId);
    const mine = (players || []).filter((p) => p && p.classId === classId);
    const ready = now == null
      ? mine.length
      : mine.filter((p) => {
          const seen = toMs(p.lastSeenAt);
          return seen == null || now - seen <= READY_FRESH_MS;
        }).length;
    return {
      classId,
      name: s?.classNames?.[classId] || classId,
      correct,
      divisor,
      score: correct / divisor,
      joined: mine.length,
      ready,
    };
  });
}

/** Vinnare ur ställningen: exakt poäng avgör, lika = oavgjort. */
export function decideWinner(standings) {
  if (!standings?.length) return { winnerId: null, draw: false, leaderIds: [] };
  const best = Math.max(...standings.map((c) => c.score));
  const leaderIds = standings.filter((c) => c.score === best).map((c) => c.classId);
  const draw = leaderIds.length > 1;
  return { winnerId: draw ? null : leaderIds[0], draw, leaderIds };
}

/** Historikens ögonblicksbild (skrivs till liveSessions.result vid matchslut). */
export function buildResult(s, standings, players = [], mode = null) {
  const { winnerId, draw } = decideWinner(standings);
  const perClass = {};
  for (const c of standings) perClass[c.classId] = { correct: c.correct, divisor: c.divisor, score: c.score, players: c.joined };
  const result = {
    perClass,
    winner: draw ? "draw" : winnerId,
    totalCorrect: standings.reduce((sum, c) => sum + c.correct, 0),
    players: (players || []).length,
  };
  // Kooperativt läge: målet nått eller inte (pokal "live-avklarat"; winner
  // lämnas för vyerna men ger ingen "live-vinst"-pokal).
  if (mode?.cooperative === true && mode.id === s?.gameMode) {
    result.cooperative = true;
    result.goalReached = !!mode.goalReached(standings, s);
  }
  // Mynt-prisets mottagare (#526, reglerna läser listan): ledarna – vid
  // oavgjort alla som delar 1:a – men bara om någon fick poäng. Kooperativt:
  // alla klasser som spelade, om målet nåddes.
  const best = standings.length ? Math.max(...standings.map((c) => c.score)) : 0;
  result.winnerClasses = result.cooperative
    ? (result.goalReached ? standings.filter((c) => c.joined > 0).map((c) => c.classId) : [])
    : best > 0 ? standings.filter((c) => c.score === best).map((c) => c.classId) : [];
  return result;
}

/** "4B MOT 5E" – stor rubrik i lobby/projektor. */
export function sessionTitle(s) {
  const names = (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id);
  return names.join(" MOT ").toUpperCase();
}

/** Förslag på matchnamn: "4B mot 5E". */
export function defaultSessionName(names) {
  return (names || []).filter(Boolean).join(" mot ");
}

/** Klassmatchens egna inställningar: mynt-pris + nämnare per klass. */
export function validateSetup(input) {
  const errs = [];
  const prize = parsePrize(input?.coinPrize);
  if (!Number.isInteger(prize) || prize > LIVE_PRIZE_MAX) {
    errs.push(`Mynt-priset måste vara ett heltal 0–${tal(LIVE_PRIZE_MAX)} (tomt = inget pris).`);
  }
  for (const id of input?.classIds || []) {
    const n = Number(input?.divisors?.[id]);
    if (!Number.isInteger(n) || n < 1 || n > 999) errs.push(`Nämnaren för ${input?.classNames?.[id] || id} måste vara ett heltal 1–999.`);
  }
  return errs;
}

/** Klassmatchens fält på sessionsdokumentet (nämnare, räknare, pris, trollkarlar). */
export function buildSessionFields(input) {
  const classIds = [...input.classIds];
  const classDivisors = {};
  for (const id of classIds) classDivisors[id] = Math.floor(Number(input.divisors[id]));
  const out = { classDivisors, counterShards: LIVE_COUNTER_SHARDS };
  const prize = parsePrize(input.coinPrize);
  if (Number.isInteger(prize) && prize > 0) out.coinPrize = prize;
  // Trollkarlsduellen (#536): vem som är Rasmus/Elias – bara klass mot klass.
  if (classIds.length === 2) {
    out.wizards = validWizards(input.wizards, classIds) ? { ...input.wizards } : defaultWizards(classIds);
  }
  return out;
}

/** Nämnaren är låst efter matchslut (#543) – förklaringen läraren ser. */
export const DIVISOR_LOCKED_MSG =
  "Matchen är avslutad – resultat, vinnare, mynt-pris och pokaler är redan utdelade, så nämnaren går inte att ändra längre.";
