// ============================================================================
// Pluggportalen – klädselkonst (inline SVG för shopens "klader"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js (samma kontur, palett och mjuka former).
// Varje sak ritas TAJT i sin egen viewBox; positioneringen på figuren görs av
// CSS-slot-boxarna (.af-wear.af-<slot> i styles.css) som är satta i % av
// avatar-containern och därmed träffar samma ankargrid på ALLA karaktärer
// (se ankargriddet i art-style.js). `par` styr hur saken ankras i sin box:
// hattar sjunker ner mot hjässan (xMidYMax), halssaker hänger från halslinjen
// (xMidYMin), osv.
//
// Konsten är uppdelad per slot i egna moduler (art-wearables-<slot>.js) och
// slås ihop till ETT register här. Lägg nya plagg i rätt slot-modul + en
// katalogpost i shop-items.js. Id:na måste matcha shop-items.js exakt
// (sparas i Firestore).
// ============================================================================

import { getItem } from "./shop-items.js";
import { HATT_WEARABLES } from "./art-wearables-hatt.js";
import { ANSIKTE_WEARABLES } from "./art-wearables-ansikte.js";
import { HALS_WEARABLES } from "./art-wearables-hals.js";
import { HAND_WEARABLES } from "./art-wearables-hand.js";
import { RYGG_WEARABLES } from "./art-wearables-rygg.js";

/** id → { viewBox, par (preserveAspectRatio), art } – sammanslaget från slot-modulerna. */
export const WEARABLES = {
  ...HATT_WEARABLES,
  ...ANSIKTE_WEARABLES,
  ...HALS_WEARABLES,
  ...HAND_WEARABLES,
  ...RYGG_WEARABLES,
};

/**
 * Fristående SVG för en klädsak, eller null om saken inte har SVG-konst
 * (då visar anroparen emoji-fältet från shop-items.js som fallback).
 */
export function wearableSvg(id) {
  const w = WEARABLES[id];
  if (!w) return null;
  const name = (getItem(id) || {}).name || id;
  return (
    `<svg viewBox="${w.viewBox}" role="img" aria-label="${name}" ` +
    `preserveAspectRatio="${w.par} meet" xmlns="http://www.w3.org/2000/svg">${w.art}</svg>`
  );
}
