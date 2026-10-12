// ============================================================================
// Ekvationsresan – anpassning upp och ner (src/ekvationsresan/anpassning.js)
// ----------------------------------------------------------------------------
// #616, spec E1.9. Ren logik. Tillståndet (sparas i elevdatan, E1.13):
//
//   { level, window }   window = stjärnorna (0–3) för de senaste uppgifterna
//                       på nivån, äldst först, högst ADAPT.windowSize.
//                       Poängen räknas ur stjärnorna (config.STAR_POINTS10).
//
// Upp:  4 × ⭐⭐⭐ i rad, ELLER ≥ 4,0 av de senaste 5, ELLER ≥ 7,0 av de senaste
//       10 (de två sista först efter minst 5 uppgifter på nivån).
// Ner:  ≤ 1,2 av de senaste 5, efter minst 5 uppgifter. Aldrig under nivå 1.
// Fönstret nollställs vid varje ändring (även lärarens, setLevel).
// Nivå ner har inget meddelande – change "down" är bara för data/statistik.
// Alla trösklar i config.ADAPT; summorna räknas i tiondelar (exakt).
// ============================================================================

import { ADAPT, LEVEL_MIN, LEVEL_MAX, STAR_POINTS10 } from "./config.js";

const sum10 = (stars) => stars.reduce((s, st) => s + (STAR_POINTS10[st] ?? 0), 0);
const last = (arr, n) => arr.slice(Math.max(0, arr.length - n));

function clampLevel(level, max) {
  return Math.max(LEVEL_MIN, Math.min(max, Math.floor(Number(level) || LEVEL_MIN)));
}

export function startAdaptation(level = LEVEL_MIN, { maxLevel = LEVEL_MAX } = {}) {
  return { level: clampLevel(level, maxLevel), window: [] };
}

/** Lärarens nivåändring (E1.12): ny nivå och nollställt fönster. */
export function setLevel(state, level, { maxLevel = LEVEL_MAX } = {}) {
  return { ...state, level: clampLevel(level, maxLevel), window: [] };
}

/** Antal ⭐⭐⭐ i rad i slutet av fönstret. */
function threeStreak(window) {
  let n = 0;
  for (let i = window.length - 1; i >= 0 && window[i] === 3; i--) n++;
  return n;
}

/** Vilken ändring fönstret ger: "up" | "down" | null (utan nivågränser). */
export function evaluateWindow(window) {
  const enough = window.length >= ADAPT.minTasks;
  if (threeStreak(window) >= ADAPT.upStreak) return "up";
  if (enough && sum10(last(window, ADAPT.upShortCount)) >= ADAPT.upShortMin10) return "up";
  if (enough && sum10(last(window, ADAPT.upLongCount)) >= ADAPT.upLongMin10) return "up";
  if (enough && sum10(last(window, ADAPT.downCount)) <= ADAPT.downMax10) return "down";
  return null;
}

/**
 * Registrera en avslutad uppgift.
 * @param {{level:number, window:number[]}} state
 * @param {0|1|2|3} stars
 * @returns {{ state, change: "up"|"down"|null, from: number, to: number }}
 */
export function recordResult(state, stars, { maxLevel = LEVEL_MAX } = {}) {
  const from = state.level;
  const window = last([...(state.window || []), stars], ADAPT.windowSize);
  const want = evaluateWindow(window);
  let to = from;
  if (want === "up" && from < maxLevel) to = from + 1;
  if (want === "down" && from > LEVEL_MIN) to = from - 1;
  if (to === from) return { state: { ...state, window }, change: null, from, to };
  return { state: { ...state, level: to, window: [] }, change: to > from ? "up" : "down", from, to };
}

/**
 * Progressionsmätaren (0–1): hur nära nästa nivå, ur poängen i fönstret. Den
 * största andelen av de tre uppvägarna – en stark prestation syns direkt.
 */
export function progressValue(state, { maxLevel = LEVEL_MAX } = {}) {
  if (state.level >= maxLevel) return 1;
  const w = state.window || [];
  const parts = [
    threeStreak(w) / ADAPT.upStreak,
    sum10(last(w, ADAPT.upShortCount)) / ADAPT.upShortMin10,
    sum10(last(w, ADAPT.upLongCount)) / ADAPT.upLongMin10,
  ];
  return Math.min(1, Math.max(0, ...parts));
}
