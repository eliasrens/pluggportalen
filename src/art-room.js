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

const FLOOR = "#C9996B";
const PLANK = "#B0805A";

// Bubbligt moln (samma form som i designprototypen).
const moln = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M0 20 Q-2 8 10 8 Q14 -2 26 2 Q36 -2 40 8 Q52 6 50 18 Q46 26 34 24 ` +
  `Q24 30 14 24 Q2 28 0 20 Z" fill="#FFFFFF" ${THIN} opacity="0.95"/></g>`;

// Plankgolvet (sträcks till scenens bredd med preserveAspectRatio="none";
// raka linjer tål det). Skarvarna ligger omlott som riktiga plankor.
const floorSvg =
  `<svg class="room-floor" viewBox="0 0 960 190" preserveAspectRatio="none" aria-hidden="true">` +
  `<rect width="960" height="190" fill="${FLOOR}"/>` +
  `<rect y="4" width="960" height="24" fill="#fff" opacity="0.1"/>` +
  `<path d="M0 48 H960 M0 96 H960 M0 144 H960" stroke="${PLANK}" stroke-width="3" opacity="0.7"/>` +
  `<path d="M140 2 L130 48 M420 2 L414 48 M730 2 L724 48 M260 48 L252 96 M580 48 L572 96 ` +
  `M860 48 L852 96 M180 96 L172 144 M500 96 L492 144 M790 96 L782 144 M320 144 L314 188 ` +
  `M640 144 L634 188 M60 144 L54 188 M900 144 L894 188" stroke="${PLANK}" stroke-width="3" opacity="0.55"/>` +
  `<path d="M0 2 H960" stroke="${O}" stroke-width="4"/>` +
  `</svg>`;

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
 * Rummets bakgrundslager som HTML-sträng. Läggs FÖRST i .room-stage
 * (under alla placerade saker); tar inte emot pekhändelser.
 */
export function roomBackdropHtml() {
  return `<div class="room-bg" aria-hidden="true">${floorSvg}${windowSvg}</div>`;
}
