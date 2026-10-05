// ============================================================================
// Läsresan – dold adaptiv läsnivå (src/lasresan/level.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/lasresan-level.test.js.
// Nivån (1–7) avgör BARA hur svår nästa text blir. Eleven ser den aldrig;
// läraren gör det. Den är helt skild från resans steg/världar (journey.js).
//
// Regler (spec §10, talen i config.js):
//   * ≥ 70 % rätt  → HÖG:  highStreak+1, lowStreak=0. 3 i rad → nivå +1.
//   * <  50 % rätt → LÅG:  lowStreak+1, highStreak=0. 2 i rad → nivå −1.
//   * 50–69,99 %   → MITT: båda streaks nollas, ingen ändring.
//   * Efter en nivåförändring nollas båda streaks. Vid tak (7) / golv (1)
//     nollas streaken ändå, fast nivån står still.
// Procentgränserna jämförs med HELTAL (correct*100 >= 70*total) så att t.ex.
// 7/10 inte råkar bli 69,999… % av flyttalsfel.
// ============================================================================

import {
  LEVEL_MIN,
  LEVEL_MAX,
  START_LEVEL,
  HIGH_PCT,
  LOW_PCT,
  HIGH_STREAK_TO_UP,
  LOW_STREAK_TO_DOWN,
} from "./config.js";

/** Tvinga ett värde till en giltig nivå (heltal LEVEL_MIN–LEVEL_MAX). */
export function normalizeLevel(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!Number.isFinite(n)) return START_LEVEL;
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(n)));
}

/** Icke-negativt heltal (streaks/räknare), annars 0. */
function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Klassa ett textresultat: "high" | "mid" | "low". total ≤ 0 → null
 * (ingen text att bedöma, påverkar ingenting).
 */
export function classifyResult(correct, total) {
  const t = Math.floor(total || 0);
  if (t <= 0) return null;
  const c = Math.min(t, Math.max(0, Math.floor(correct || 0)));
  if (c * 100 >= HIGH_PCT * t) return "high";
  if (c * 100 < LOW_PCT * t) return "low";
  return "mid";
}

/**
 * Applicera ett FÄRDIGT textresultat på nivåtillståndet.
 * @param {{level?:number, highStreak?:number, lowStreak?:number}} state
 * @param {{correct:number, total:number}} result
 * @returns {{level:number, highStreak:number, lowStreak:number, changed:boolean, band:("high"|"mid"|"low"|null)}}
 *   `changed` = nivån ändrades (ALDRIG något eleven får se).
 */
export function applyResult(state, { correct, total }) {
  const level = normalizeLevel(state && state.level);
  let highStreak = count(state && state.highStreak);
  let lowStreak = count(state && state.lowStreak);
  const band = classifyResult(correct, total);

  if (band === null) return { level, highStreak, lowStreak, changed: false, band };

  if (band === "mid") {
    return { level, highStreak: 0, lowStreak: 0, changed: false, band };
  }

  if (band === "high") {
    highStreak += 1;
    lowStreak = 0;
    if (highStreak >= HIGH_STREAK_TO_UP) {
      const next = Math.min(LEVEL_MAX, level + 1);
      return { level: next, highStreak: 0, lowStreak: 0, changed: next !== level, band };
    }
    return { level, highStreak, lowStreak, changed: false, band };
  }

  // band === "low"
  lowStreak += 1;
  highStreak = 0;
  if (lowStreak >= LOW_STREAK_TO_DOWN) {
    const next = Math.max(LEVEL_MIN, level - 1);
    return { level: next, highStreak: 0, lowStreak: 0, changed: next !== level, band };
  }
  return { level, highStreak, lowStreak, changed: false, band };
}

/** Avrundad procent (0–100) för visning. total 0 → 0. */
export function percent(correct, total) {
  const t = Math.floor(total || 0);
  if (t <= 0) return 0;
  return Math.round((Math.max(0, correct || 0) * 100) / t);
}
