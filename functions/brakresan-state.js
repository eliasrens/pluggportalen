// ============================================================================
// Bråkresan på SERVERN – gemensamma delar (functions/brakresan-state.js, #708)
// ----------------------------------------------------------------------------
// Delas av omgångarna (brakresan-core.js), avslutet (brakresan-avslut.js) och
// guldjakten (J, #715). Inga Firebase-importer: db/FieldValue/Timestamp
// injiceras (deps), så allt testas direkt mot emulatorn.
//
//   BrFel(code, message)     code = HttpsError-kod, message på svenska
//   brRefs(db, uid)          state, omgång, facit, belöning, studentData
//   readState(snap)          state-dokumentet med standardvärden (saknas = nytt)
//   challengeEntry(state,id) ChallengeProgress med standardvärden
//   withChallenge(state,id,e) ny state med posten + härledda totalStars/mastered
//   toPlain(v)               Timestamp → ms (callable-svar är ren JSON)
//   cleanAnswer(answer)      elevens svar som Firestore-säker JSON eller BrFel
//   helpSteps(list)          giltiga hjälpsteg i fast ordning, utan dubbletter
// Fälten: docs/DATAMODELL.md "Bråkresan".
// ============================================================================

import { HELP_STEPS } from "./brakresan/schema/uppgift.js";
import { MAX_STARS_PER_CHALLENGE, MAX_TOTAL_STARS } from "./brakresan/schema/regler.js";

export class BrFel extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BrFel";
    this.code = code;
  }
}

export const STATE_SCHEMA = 1;
export const ROUND_SCHEMA = 1;
export const ROUND_ID_RE = /^[A-Za-z0-9]{12,40}$/;
/** Elevens svar som JSON får vara högst så här långt (skydd mot skräp). */
export const MAX_ANSWER_CHARS = 4000;

export function brRefs(db, uid) {
  const data = db.collection("studentData").doc(uid);
  return {
    data,
    state: data.collection("brakresa").doc("state"),
    round: (roundId) => data.collection("brakresaRounds").doc(roundId),
    rounds: () => data.collection("brakresaRounds"),
    reward: (eventId) => data.collection("brakresaRewards").doc(eventId),
    hunt: (date) => data.collection("brakresaHunts").doc(date),
    secret: (roundId) => db.collection("brakresaSecrets").doc(roundId),
  };
}

const TOTALS = Object.freeze({ roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0 });

export function emptyState() {
  return {
    schema: STATE_SCHEMA, totalStars: 0, mastered: 0, challenges: {}, encouragementCoins: 0,
    totals: { ...TOTALS }, dragon: null, hunts: { count: 0, coins: 0, lastDate: null },
    lastActivityAt: null, updatedAt: null,
  };
}

/** State-dokumentet (DocumentSnapshot) med standardvärden för saknade fält. */
export function readState(snap) {
  const d = snap?.exists ? snap.data() : {};
  const base = emptyState();
  return {
    ...base, ...d,
    challenges: { ...(d.challenges || {}) },
    totals: { ...base.totals, ...(d.totals || {}) },
    hunts: { ...base.hunts, ...(d.hunts || {}) },
  };
}

export function challengeEntry(state, id) {
  return {
    stars: 0, starRounds: [], encouragementPaid: false, activeRoundId: null, activeAnswered: 0,
    roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0,
    best: null, last: null, lastAt: null,
    ...(state.challenges?.[id] || {}),
  };
}

/** Ny state med utmaningens post – totalStars och mastered räknas alltid om ur posterna. */
export function withChallenge(state, id, entry) {
  const challenges = { ...state.challenges, [id]: entry };
  const stars = Object.values(challenges).map((c) => Math.max(0, Math.min(MAX_STARS_PER_CHALLENGE, c?.stars || 0)));
  return {
    ...state,
    challenges,
    totalStars: Math.min(MAX_TOTAL_STARS, stars.reduce((a, b) => a + b, 0)),
    mastered: stars.filter((s) => s >= MAX_STARS_PER_CHALLENGE).length,
  };
}

/** Timestamp (har toMillis) → ms, rekursivt. Callable-svar ska vara ren JSON. */
export function toPlain(v) {
  if (v === null || typeof v !== "object") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (Array.isArray(v)) return v.map(toPlain);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]));
}

function nestedArray(v) {
  if (Array.isArray(v)) return v.some((x) => Array.isArray(x) || nestedArray(x));
  if (v && typeof v === "object") return Object.values(v).some(nestedArray);
  return false;
}

/**
 * Elevens svar som det ska sparas: ren JSON (ett objekt), högst
 * MAX_ANSWER_CHARS tecken, inga arrayer i arrayer (Firestore).
 */
export function cleanAnswer(answer) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
    throw new BrFel("invalid-argument", "Svaret saknas.");
  }
  let json;
  try {
    json = JSON.stringify(answer);
  } catch {
    throw new BrFel("invalid-argument", "Svaret kunde inte läsas.");
  }
  if (json.length > MAX_ANSWER_CHARS) throw new BrFel("invalid-argument", "Svaret är för långt.");
  const clean = JSON.parse(json);
  if (nestedArray(clean)) throw new BrFel("invalid-argument", "Svaret kunde inte läsas.");
  return clean;
}

/** Giltiga hjälpsteg i ordningen orientering → princip → modellering → atergang. */
export function helpSteps(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > 20) throw new BrFel("invalid-argument", "Ogiltiga hjälpsteg.");
  const set = new Set(list.map(String));
  return HELP_STEPS.filter((s) => set.has(s));
}

/** Två hjälplistor ihop (union, fast ordning). */
export const mergeHelp = (a = [], b = []) => helpSteps([...(a || []), ...(b || [])]);

export function roundIdOf(data) {
  const id = data?.roundId;
  if (typeof id !== "string" || !ROUND_ID_RE.test(id)) throw new BrFel("invalid-argument", "Ogiltig omgång.");
  return id;
}
