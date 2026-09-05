// ============================================================================
// Pluggportalen – ren golv-geometri för husdjurens promenad-AI (rum-promenad.js)
// ----------------------------------------------------------------------------
// Bara matematik, ingen DOM och inga Firebase-beroenden, så golv-clampen kan
// regressionstestas fristående (test/rum-promenad-golv.test.js) och återanvändas
// av pickTarget, seekStep OCH den hårda re-clampen i walkStep.
//
// Regression #63: husdjur (t.ex. E:s hund) gick upp på väggarna igen. Rotorsaken
// var att halfH mättes på HELA rum-noden (som är center-ankrad och även innehåller
// namn-etiketten under spriten) → halfH blåstes upp → golvzonens minY sköts uppåt
// och släppte djurets centrum, och därmed fötterna, upp på väggen. Fixen: mät
// själva spriten (.ri-emoji) och re-klampa varje steg mot denna zon.
// ============================================================================

import { FLOOR_TOP } from "./art-room.js";

/** Klampa ett tal till [min, max] (min vinner om intervallet är inverterat). */
export const clampRange = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Golvzonen (i procent av scenen) ett djur får ha sitt CENTRUM i, utifrån dess
 * halva bredd/höjd (mätt på själva spriten, inte hela noden). Modellen: djuret
 * står med fötterna vid `centrum + halfH`, så `minY = FLOOR_TOP + 4 - halfH`
 * håller fötterna på golvytan (FLOOR_TOP) medan `Math.max(halfH, …)` ser till att
 * ett stort djurs ÖVERKANT (centrum − halfH) inte skjuts av skärmen.
 * @param {number} halfW  halva spritebredden i procent av scenen
 * @param {number} halfH  halva spritehöjden i procent av scenen
 */
export function petWalkZone(halfW, halfH) {
  return {
    minX: Math.max(3, halfW),
    maxX: Math.min(97, 100 - halfW),
    minY: Math.max(halfH, FLOOR_TOP + 4 - halfH),
    maxY: 100 - halfH,
  };
}
