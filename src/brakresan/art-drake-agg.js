// ============================================================================
// Bråkdraken – ägget (#718)
// ----------------------------------------------------------------------------
// Turkost ägg med lila skimrande fjällbågar och guldrunan ÷. Vid 5–9 stjärnor
// syns allt fler fina sprickor (sprickor = stjärnor − 4).
// ============================================================================

import { O, smooth, form, pth } from "./art-drake-geo.js";
import { PAL, runa, F } from "./art-drake-delar.js";

// --- Ägg --------------------------------------------------------------------

/**
 * Ägget i viewBox 0 0 100 120 (fot vid y=114). sprickor 0..5 (stjärna 5–9).
 */
export function agg(u, sprickor = 0, lw = 3) {
  const pts = [[50, 8], [72, 24], [84, 58], [78, 92], [50, 112], [22, 92], [16, 58], [28, 24]];
  const d = smooth(pts);
  let s = `<clipPath id="${u}ec"><path d="${d}"/></clipPath>`;
  s += form(pth(d), F(u, "e"), lw);
  // Lila skimrande fjällbågar (klippta till ägget).
  let band = "";
  for (let row = 0; row < 4; row++) {
    const y = 66 + row * 12, off = row % 2 ? 7 : 0;
    for (let x = 6 + off; x < 100; x += 14) {
      band += `<path d="M${x} ${y} q7 9 14 0" fill="none" stroke="#B79BE0" stroke-width="2.4" stroke-linecap="round" opacity="${0.75 - row * 0.12}"/>`;
    }
  }
  band += `<path d="M14 52 Q50 40 86 52" fill="none" stroke="#C7B2F2" stroke-width="5" opacity="0.6"/>`;
  band += `<path d="M14 58 Q50 46 86 58" fill="none" stroke="#8F74DA" stroke-width="2" opacity="0.6"/>`;
  band += `<ellipse cx="36" cy="30" rx="8" ry="13" fill="#fff" opacity="0.35" transform="rotate(-24 36 30)"/>`;
  band += `<ellipse cx="31" cy="46" rx="3" ry="4" fill="#fff" opacity="0.3"/>`;
  s += `<g clip-path="url(#${u}ec)">${band}</g>`;
  // Guldruna.
  s += `<circle cx="50" cy="78" r="11" fill="${O}" opacity="0.18"/>`;
  s += `<circle cx="50" cy="77" r="10.5" fill="#FFF7D6" stroke="${O}" stroke-width="2.2"/>`;
  s += runa(50, 77, 5.2, F(u, "g"), 1, `class="bd-runa"`);
  s += `<circle cx="50" cy="77" r="10.5" fill="none" stroke="${PAL.guld}" stroke-width="1.6" opacity="0.9"/>`;
  // Sprickor – fler och längre ju närmare kläckning.
  const spr = [
    "M50 9 L46 18 L52 23 L47 31",
    "M70 22 L64 28 L68 33 L62 38",
    "M47 31 L41 35 L44 41",
    "M30 23 L35 30 L31 35 L36 41",
    "M62 38 L57 44 L61 49",
  ];
  for (let i = 0; i < Math.min(sprickor, spr.length); i++) {
    s += `<path class="bd-spricka" d="${spr[i]}" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${spr[i]}" fill="none" stroke="#FFF6C8" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" transform="translate(0.8 0.6)"/>`;
  }
  return s;
}
