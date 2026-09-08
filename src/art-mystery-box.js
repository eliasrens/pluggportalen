// ============================================================================
// Pluggportalen – konst för mysteryboxarna (inline SVG-ikoner)
// ----------------------------------------------------------------------------
// Egen ikon per box-nivå (#186): vanlig / Mega / Epic. Slås in i ITEMS-registret
// i art-items.js så shop-kortet ritar rätt SVG via itemSvg(box.id) i stället för
// emoji-fallbacken. Id:na MÅSTE matcha MYSTERY_BOXES i mystery-items.js.
// Följer stilguiden i art-style.js (kontur #3B3350, mjuka former, glad palett).
// Alla tre delar samma grundform (present med rosett) men skiljs åt på färg +
// en liten "rang-bricka" så nivåerna känns igen på håll. viewBox 0 0 100 100.
// ============================================================================

import { O, LINE, THIN } from "./art-style.js";

// Liten femuddig stjärna som fylld path runt (cx,cy).
function star5(cx, cy, R, c, r = null) {
  const ri = r == null ? R * 0.42 : r;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : ri;
    const a = (-90 * Math.PI) / 180 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join(" L")} Z" fill="${c}" ${THIN}/>`;
}

/**
 * Grundform för en present-box: kropp + lock + lodrätt band + rosett.
 * @param {object} o färger: body, lid, band, knot
 */
function giftBase({ body, lid, band, knot }) {
  return (
    `<rect x="18" y="44" width="64" height="44" rx="8" fill="${body}" ${LINE}/>` +
    `<rect x="12" y="32" width="76" height="18" rx="6" fill="${lid}" ${LINE}/>` +
    `<rect x="44" y="32" width="12" height="56" fill="${band}" ${THIN}/>` +
    `<path d="M50 32 Q34 12 26 24 Q22 32 50 34 Q78 32 74 24 Q66 12 50 32 Z" ` +
    `fill="${band}" ${LINE}/>` +
    `<circle cx="50" cy="30" r="5" fill="${knot}" ${THIN}/>`
  );
}

/** id → { viewBox, art } – spreadas in i ITEMS (art-items.js). */
export const MYSTERY_BOX_ART = {
  // Vanlig box: klassisk röd present med gult band och "?".
  mysterybox: {
    viewBox: "0 0 100 100",
    art:
      giftBase({ body: "#EF6F6C", lid: "#F08A3C", band: "#F7C948", knot: "#FDE9A8" }) +
      `<text x="50" y="74" font-size="20" text-anchor="middle" fill="#fff" ` +
      `font-weight="800" font-family="system-ui" stroke="${O}" stroke-width="0.6">?</text>`,
  },
  // Mega box: större känsla – lila/blå present, stjärnbricka och gnistror.
  "mysterybox-mega": {
    viewBox: "0 0 100 100",
    art:
      star5(20, 20, 6, "#F7C948") +
      star5(82, 24, 5, "#7FC7E8") +
      giftBase({ body: "#9B72D6", lid: "#7F5AC4", band: "#F7C948", knot: "#FDE9A8" }) +
      `<circle cx="50" cy="66" r="14" fill="#FDE9A8" ${LINE}/>` +
      star5(50, 66, 10, "#F7C948", 4.5),
  },
  // Epic box: gyllene/turkos present med krona – den finaste nivån.
  "mysterybox-epic": {
    viewBox: "0 0 100 100",
    art:
      star5(18, 22, 6, "#F7C948") +
      star5(84, 20, 5, "#F890B7") +
      star5(86, 60, 4, "#7FC7E8") +
      giftBase({ body: "#3FB7A6", lid: "#F7C948", band: "#EF6F6C", knot: "#FDE9A8" }) +
      // Krona ovanpå rosetten.
      `<path d="M36 24 L40 12 L50 20 L60 12 L64 24 Z" fill="#F7C948" ${LINE}/>` +
      `<circle cx="40" cy="12" r="2.6" fill="#FDE9A8" ${THIN}/>` +
      `<circle cx="60" cy="12" r="2.6" fill="#FDE9A8" ${THIN}/>` +
      `<circle cx="50" cy="20" r="2.6" fill="#FDE9A8" ${THIN}/>` +
      `<rect x="44" y="66" width="12" height="12" rx="2" fill="#FDE9A8" ${THIN}/>`,
  },
};
