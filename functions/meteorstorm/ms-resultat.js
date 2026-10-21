// ============================================================================
// Meteorstormen (#820): SLUTET (§2.7) – vinnare, oavgjort och stjärnor ur
// stationernas sluttillstånd. Ren, delas med servern (msAvsluta sparar detta
// i result).
// ============================================================================

import { stjarnorFor } from "./ms-balans.js";

/**
 * Slutet (§2.7). Klass mot klass: högst skrov (andel – alla börjar på 100),
 * lika → flest nedskjutna, lika → oavgjort. En klass: stjärnor ur skrovet.
 *   → { lage, vinnare: classId|null, oavgjort, placering: [{ classId, skrov, nedskjutna, plats }],
 *       stjarnor?, overlevde? }
 */
export function buildResultat(stationer, lage) {
  const ordning = stationer
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.skrov - a.s.skrov || b.s.nedskjutna - a.s.nedskjutna || a.i - b.i);
  const placering = [];
  ordning.forEach(({ s }, k) => {
    const forra = placering[k - 1];
    const lika = forra && forra.skrov === s.skrov && forra.nedskjutna === s.nedskjutna;
    placering.push({ classId: s.classId, skrov: s.skrov, nedskjutna: s.nedskjutna, plats: lika ? forra.plats : k + 1 });
  });
  if (lage === "en-klass" || stationer.length < 2) {
    const s = stationer[0] || { skrov: 0 };
    return { lage: "en-klass", vinnare: null, oavgjort: false, placering, stjarnor: stjarnorFor(s.skrov), overlevde: s.skrov > 0 };
  }
  const oavgjort = placering.length > 1 && placering[1].plats === 1;
  return { lage: "klass-mot-klass", vinnare: oavgjort ? null : placering[0].classId, oavgjort, placering };
}

