// ============================================================================
// Pluggportalen – rummets bakgrund (vägg, panel, plankgolv & fönster med moln)
// ----------------------------------------------------------------------------
// Följer designfacit i design/DESIGNBESLUT-husdjur-hem-2.0.md:
//   vägg #FFE9CC + panelband #FBD9A6, golv #C9996B med plankor #B0805A
//   (golvet färgas ALDRIG om – paletterna i uppgift 7 rör bara hus/väggar),
//   fönster med spröjs i kors där moln driver förbi i en lugn loop.
// Molnen animeras med ren CSS-transform (klassen .rum-moln i styles.css) –
// billigt för GPU:n och avstängt under prefers-reduced-motion.
// Bakgrunden är pointer-events:none och ligger under alla .room-item.
// ============================================================================

import { O, LINE, THIN } from "./art-style.js";

/** Procent av scenhöjden där golvet börjar (används av drag & drop-clampen). */
export const FLOOR_TOP = 62;

/**
 * Väggskarven i procent av scenhöjden – där väggen (#FFE9CC / palettens wall)
 * möter panelbandet (#FBD9A6 / wall2). Gradienten i .room-stage lägger den
 * mörka skarvlinjen vid ~49.6 % (49.3–50 %). Fönstrets default-läge centreras
 * på denna linje.
 */
export const WALL_SEAM = 49.6;

/** "Sak-id" för det flyttbara/raderbara fönstret (inte en riktig shop-sak). */
export const WINDOW_ID = "__window";

/** Fönstrets default-läge (procent av scenen): centrerat på väggskarven. */
export const WINDOW_DEFAULT = { x: 50, y: WALL_SEAM };

const FLOOR = "#C9996B";
const PLANK = "#B0805A";

// Bubbligt moln (samma form som i designprototypen).
const moln = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M0 20 Q-2 8 10 8 Q14 -2 26 2 Q36 -2 40 8 Q52 6 50 18 Q46 26 34 24 ` +
  `Q24 30 14 24 Q2 28 0 20 Z" fill="#FFFFFF" ${THIN} opacity="0.95"/></g>`;

// Plankgolvet (sträcks till scenens bredd med preserveAspectRatio="none";
// raka linjer tål det). Skarvarna ligger omlott som riktiga plankor.
// MÖNSTRET ritas ~3× tätare än förr (12 rader i st.f. 4) så plankorna ser
// proportionerliga ut mot de scenbredds-skalade möblerna (cqw-skala). Rader &
// skarvar genereras i loop → tätheten styrs av FLOOR_ROWS. Golvets FÄRG
// (#C9996B) rörs ALDRIG – bara texturens skala/täthet.
const FLOOR_ROWS = 12;
function buildFloorSvg() {
  const rowH = 190 / FLOOR_ROWS;
  let horiz = "";
  for (let i = 1; i < FLOOR_ROWS; i++) {
    horiz += `M0 ${+(i * rowH).toFixed(1)} H960 `;
  }
  // Korta skarvar förskjutna i tegelförband rad för rad (~1/3 av förra längden).
  let seams = "";
  const gap = 150; // avstånd mellan skarvar i x-led
  for (let r = 0; r < FLOOR_ROWS; r++) {
    const y0 = +(r * rowH).toFixed(1);
    const y1 = +((r + 1) * rowH).toFixed(1);
    const off = (r % 2) * (gap / 2);
    for (let x = 50 + off; x < 960; x += gap) {
      seams += `M${x} ${y0} L${+(x - 3).toFixed(1)} ${y1} `;
    }
  }
  return (
    `<svg class="room-floor" viewBox="0 0 960 190" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect width="960" height="190" fill="${FLOOR}"/>` +
    `<rect y="2" width="960" height="8" fill="#fff" opacity="0.1"/>` +
    `<path d="${horiz.trim()}" stroke="${PLANK}" stroke-width="2" opacity="0.7"/>` +
    `<path d="${seams.trim()}" stroke="${PLANK}" stroke-width="2" opacity="0.55"/>` +
    `<path d="M0 2 H960" stroke="${O}" stroke-width="4"/>` +
    `</svg>`
  );
}
const floorSvg = buildFloorSvg();

// Fönstret: himmel med sol, två drivande moln bakom clip-path, kulle,
// spröjs i kors, fönsterbräda med liten blomkruka.
const windowSvg =
  `<svg class="room-window" viewBox="0 0 252 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
  `<defs><linearGradient id="rum-himmel" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#9AD3F0"/><stop offset="1" stop-color="#E0F3FC"/></linearGradient>` +
  `<clipPath id="rum-fclip"><rect x="16" y="14" width="220" height="182" rx="8"/></clipPath></defs>` +
  `<rect x="8" y="6" width="236" height="198" rx="12" fill="url(#rum-himmel)" ${LINE}/>` +
  `<g clip-path="url(#rum-fclip)">` +
  `<circle cx="62" cy="54" r="26" fill="#F7C948" ${THIN}/>` +
  `<g class="rum-moln" style="--t:38s">${moln(0, 58, 0.85)}</g>` +
  `<g class="rum-moln" style="--t:52s;animation-delay:-26s">${moln(0, 122, 0.6)}</g>` +
  `<path d="M8 182 Q100 152 244 178 L244 204 L8 204 Z" fill="#A8DA8F" stroke="none"/>` +
  `</g>` +
  `<path d="M126 10 L126 200 M12 105 L240 105" stroke="${O}" stroke-width="5" stroke-linecap="round"/>` +
  `<rect x="8" y="6" width="236" height="198" rx="12" fill="none" stroke="${O}" stroke-width="6"/>` +
  `<rect x="0" y="200" width="252" height="16" rx="8" fill="#FFF3DC" ${LINE}/>` +
  `<path d="M218 200 L218 186 M212 190 Q218 182 224 190" stroke="#6FC66F" stroke-width="3.4" stroke-linecap="round" fill="none"/>` +
  `<path d="M212 200 L224 200 L222 190 L214 190 Z" fill="#F890B7" ${THIN}/>` +
  `</svg>`;

/**
 * Fönstret som ett INTERAKTIVT rums-objekt (samma .room-item-pipeline som
 * möbler/dekor). Centreras med translate(-50%,-50%) via CSS, moln-animationen
 * (.rum-moln) ligger inuti svg:n och följer därför med när fönstret flyttas.
 *
 * @param {object} o
 * @param {number} o.x  vänsterkant i procent av scenen (sak-centrum)
 * @param {number} o.y  topp i procent av scenen (sak-centrum)
 * @param {boolean} [o.interactive=true] false = läs-läge (klasskamratens rum):
 *        ingen 🗑️-knapp, saken märks .readonly.
 * @param {boolean} [o.selected=false] rita valramen (visar 🗑️).
 */
export function windowItemHtml({ x, y, interactive = true, selected = false }) {
  const cls =
    "room-item room-window-item" +
    (interactive ? "" : " readonly") +
    (selected ? " selected" : "");
  const remove = interactive
    ? `<button class="ri-remove" data-remove="${WINDOW_ID}" title="Ta bort fönstret">🗑️</button>`
    : "";
  return (
    `<div class="${cls}" data-id="${WINDOW_ID}" style="left:${x}%;top:${y}%" title="Fönster">` +
    `<span class="rw-svg">${windowSvg}</span>${remove}</div>`
  );
}

/**
 * Rummets bakgrundslager (plankgolvet) som HTML-sträng. Läggs FÖRST i
 * .room-stage (under alla placerade saker); tar inte emot pekhändelser.
 * Fönstret ritas numera separat som ett interaktivt objekt (se windowItemHtml).
 */
export function roomBackdropHtml() {
  return `<div class="room-bg" aria-hidden="true">${floorSvg}</div>`;
}
