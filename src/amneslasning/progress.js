// ============================================================================
// Ämnesläsning – elevens tillstånd, försök och mynt (src/amneslasning/progress.js)
// ----------------------------------------------------------------------------
// Ren kärna bakom Firestore-bryggan src/data-amneslasning.js, testad i
// test/amneslasning-progress.test.js. Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md
// §3, §5, §8.
//
// studentData.amneslasning (EGET fält – Läsresans worldId/stepInWorld/
// seenTextIds/currentTextId rörs aldrig):
//   { areas: { [areaId]: {
//       subjectId,
//       read: { [textId]: { count, lastAt } },   ← läst-lista med tidpunkt;
//                                                  count = omläsningstrappan
//       currentTextId, currentStartedAt          ← påbörjad text i området
//     } },
//     updatedAt }
// Läsnivån ligger kvar i studentData.lasresa (delad med Läsresan, level.js).
//
// Försöket sparas i lasresaAttempts som ett Läsresan-försök (buildAttempt) med
// source: "amnesläsning", subjectId, areaId, amnesLevel och textLevel = textens
// motsvarande läsnivå (1–10, levelScale 10). Gamla försök utan source = Läsresan.
// ============================================================================

import { AMNES_COINS_PER_CORRECT, AMNES_SOURCE, LASRESAN_SOURCE } from "../lasresan/config.js";
import { buildAttempt } from "../lasresan/progress.js";
import { grindMultiplier } from "../leveling.js";
import { applyAmnesLevel, parseAmnesLevel, readingLevelForAmnes } from "./level.js";

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const str = (v) => (typeof v === "string" && v ? v : null);
const time = (v) => (Number.isFinite(v) ? v : null);

/** Ett försöks källa: "amnesläsning" eller "lasresan" (saknad source = Läsresan). */
export function attemptSource(attempt) {
  return attempt && attempt.source === AMNES_SOURCE ? AMNES_SOURCE : LASRESAN_SOURCE;
}

/** Tomt tillstånd för ett område. */
export function defaultArea(subjectId = null) {
  return { subjectId: str(subjectId), read: {}, currentTextId: null, currentStartedAt: null };
}

function normalizeRead(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [textId, r] of Object.entries(raw)) {
    const n = count(r && r.count);
    if (textId && n > 0) out[textId] = { count: n, lastAt: time(r.lastAt) };
  }
  return out;
}

/** Tvätta ett lagrat områdestillstånd. Okända fält behålls. */
export function normalizeArea(raw, subjectId = null) {
  if (!raw || typeof raw !== "object") return defaultArea(subjectId);
  return {
    ...raw,
    subjectId: str(raw.subjectId) || str(subjectId),
    read: normalizeRead(raw.read),
    currentTextId: str(raw.currentTextId),
    currentStartedAt: time(raw.currentStartedAt),
  };
}

/** Tvätta studentData.amneslasning (undefined = elev som aldrig läst). */
export function normalizeAmneslasning(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const areas = {};
  if (r.areas && typeof r.areas === "object") {
    for (const [areaId, a] of Object.entries(r.areas)) if (areaId) areas[areaId] = normalizeArea(a);
  }
  return { ...r, areas, updatedAt: time(r.updatedAt) };
}

/** Områdets tillstånd (tomt om eleven inte läst där). */
export function areaOf(state, areaId, subjectId = null) {
  const a = state && state.areas && state.areas[areaId];
  return a ? normalizeArea(a, subjectId) : defaultArea(subjectId);
}

/** Antal TIDIGARE avslutade läsningar av texten (n i omläsningstrappan). */
export function previousReads(area, textId) {
  const r = area && area.read && area.read[textId];
  return r ? count(r.count) : 0;
}

/** Läst-listan som [{textId, count, lastAt}], äldst läst först (för textvalet). */
export function readList(area) {
  return Object.entries((area && area.read) || {})
    .map(([textId, r]) => ({ textId, count: count(r.count), lastAt: time(r.lastAt) }))
    .sort((a, b) => (a.lastAt || 0) - (b.lastAt || 0) || a.textId.localeCompare(b.textId));
}

/**
 * Pluggcoins för en ämnestext: AMNES_COINS_PER_CORRECT per rätt, skalat med
 * grindMultiplier för TIDIGARE läsningar av samma text (100 → 80 → … 20 %).
 * Avrundas uppåt som Pluggas trappa. 6 rätt: 30 första gången, 24 andra.
 */
export function amnesCoinsFor(correct, prevReads = 0) {
  const n = Math.max(0, Math.floor(Number(correct) || 0));
  const full = n * AMNES_COINS_PER_CORRECT;
  if (full <= 0) return 0;
  const scaled = full * grindMultiplier(count(prevReads));
  return Math.ceil(Math.round(scaled * 1e6) / 1e6); // bort med flyttalsbrus före ceil
}

/** Byt ut ett område i tillståndet (nytt objekt). */
function withArea(state, areaId, area, now) {
  const cur = normalizeAmneslasning(state);
  return { ...cur, areas: { ...cur.areas, [areaId]: area }, updatedAt: now };
}

/**
 * Starta en ämnestext i ett område. Finns redan en påbörjad text i området
 * returneras DEN (återupptas, som Läsresan). `force` byter ändå – bara när den
 * påbörjade texten inte längre finns i området.
 * @returns {{amneslasning:object, textId:string, resumed:boolean}}
 */
export function withStartedAmnesText(state, { subjectId, areaId, textId }, now = Date.now(), { force = false } = {}) {
  if (!areaId || !textId) throw new Error("areaId och textId krävs.");
  const area = areaOf(state, areaId, subjectId);
  if (area.currentTextId && !force) {
    return { amneslasning: normalizeAmneslasning(state), textId: area.currentTextId, resumed: true };
  }
  const next = { ...area, subjectId: area.subjectId || str(subjectId), currentTextId: textId, currentStartedAt: now };
  return { amneslasning: withArea(state, areaId, next, now), textId, resumed: false };
}

/**
 * Bygg försöket för en färdig ämnestext: Läsresans buildAttempt (rättning,
 * perQuestion, perCategory) + källa, område, nivåer och mynt med omläsningstrappa.
 * @param {object} text ämnestext ({id, title, level: 1–3, textType, questions})
 * @param {{qid:string, chosen:(number|null)}[]} answers
 * @param {{subjectId:string, areaId:string, prevReads?:number, startedAt?:number,
 *   completedAt?:number, studentId?:string}} ctx
 */
export function buildAmnesAttempt(text, answers, { subjectId, areaId, prevReads = 0, startedAt = null, completedAt = Date.now(), studentId = null } = {}) {
  const amnesLevel = parseAmnesLevel(text && text.level);
  if (amnesLevel === null) throw new Error(`Ogiltig ämnesnivå: ${text && text.level} (måste vara 1–3).`);
  const base = buildAttempt({ ...text, level: readingLevelForAmnes(amnesLevel) }, answers, { startedAt, completedAt, studentId });
  return {
    ...base,
    source: AMNES_SOURCE,
    subjectId: str(subjectId),
    areaId: str(areaId),
    amnesLevel,
    readNumber: count(prevReads) + 1,
    earnedMoney: amnesCoinsFor(base.correct, prevReads),
  };
}

/**
 * Applicera ett färdigt ämnesförsök: den DELADE läsnivån (Läsresans regler,
 * samma streaks, tak 7 uppåt) och områdets läst-lista. Läsresans resa, totaler
 * och seenTextIds rörs inte.
 * @param {{lasresa:object, amneslasning:object}} state `lasresa` normaliserad
 *   (normalizeLasresa med klassens startnivå), `amneslasning` lagrad/normaliserad
 * @returns {{lasresa:object, amneslasning:object, levelChanged:boolean}}
 */
export function applyAmnesCompletion({ lasresa, amneslasning }, attempt, now = Date.now()) {
  const lvl = applyAmnesLevel(lasresa, { correct: attempt.correct, total: attempt.totalQuestions }, now);
  const area = areaOf(amneslasning, attempt.areaId, attempt.subjectId);
  const prev = area.read[attempt.textId];
  const next = {
    ...area,
    read: { ...area.read, [attempt.textId]: { count: (prev ? prev.count : 0) + 1, lastAt: now } },
    currentTextId: null,
    currentStartedAt: null,
  };
  return {
    lasresa: lvl.lasresa,
    amneslasning: withArea(amneslasning, attempt.areaId, next, now),
    levelChanged: lvl.levelChanged,
  };
}
