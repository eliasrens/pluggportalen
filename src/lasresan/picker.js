// ============================================================================
// Läsresan – textval (src/lasresan/picker.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/lasresan-picker.test.js.
// Spec §11: välj i första hand en text på elevens nivå som eleven INTE har
// läst. Samma text kommer inte igen förrän nivåns pool är uttömd.
//
//   1. Ej sedda texter på nivån → slumpa bland dem.
//   2. Nivåns pool uttömd → slumpa bland redan sedda på nivån, men ALDRIG
//      samma som senast (om det finns något annat att välja).
//   3. Nivån saknar texter helt → närmaste nivå som har texter (lika nära åt
//      båda håll → den LÄTTARE nivån), och samma regler där.
// ============================================================================

import { LEVEL_MIN, LEVEL_MAX } from "./config.js";
import { normalizeLevel } from "./level.js";

/** Bank → { [level]: ReadingText[] }. Tar en lista eller en färdig nivå-map. */
export function groupByLevel(bank) {
  if (!bank) return {};
  if (!Array.isArray(bank)) return bank;
  const out = {};
  for (const t of bank) {
    if (!t || !Number.isInteger(t.level)) continue;
    (out[t.level] = out[t.level] || []).push(t);
  }
  return out;
}

/** Nivåer att pröva i ordning: exakt nivå, sedan ±1, ±2 … (lättare först). */
export function levelSearchOrder(level) {
  const order = [level];
  for (let d = 1; d <= LEVEL_MAX - LEVEL_MIN; d++) {
    if (level - d >= LEVEL_MIN) order.push(level - d);
    if (level + d <= LEVEL_MAX) order.push(level + d);
  }
  return order;
}

function pickRandom(list, rng) {
  const i = Math.min(list.length - 1, Math.floor(rng() * list.length));
  return list[i];
}

/**
 * Välj nästa text för eleven.
 * @param {number} level elevens dolda nivå (1–7)
 * @param {string[]} seenTextIds texter eleven redan genomfört
 * @param {object[]|object} bank alla texter (lista) eller { [level]: texter[] }
 * @param {{lastTextId?:string|null, rng?:()=>number}} [opts]
 * @returns {object|null} vald ReadingText, eller null om banken är tom
 */
export function pickText(level, seenTextIds, bank, { lastTextId = null, rng = Math.random } = {}) {
  const byLevel = groupByLevel(bank);
  const seen = new Set(Array.isArray(seenTextIds) ? seenTextIds : []);
  for (const lvl of levelSearchOrder(normalizeLevel(level))) {
    const pool = byLevel[lvl] || [];
    if (pool.length === 0) continue;
    const unseen = pool.filter((t) => !seen.has(t.id));
    if (unseen.length > 0) return pickRandom(unseen, rng);
    const notLast = pool.filter((t) => t.id !== lastTextId);
    return pickRandom(notLast.length > 0 ? notLast : pool, rng);
  }
  return null;
}
