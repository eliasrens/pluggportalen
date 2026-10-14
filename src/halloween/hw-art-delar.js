// ============================================================================
// Pluggporten – Halloween-konstens delade byggdelar (#692, epic #689)
// ----------------------------------------------------------------------------
// Gulligt-läskigt enligt spec §3.4: stora ögon, mjuka former, glada färger
// (orange, lila, grönt, svart med glimt) – inga vassa tänder, inget blod, inga
// realistiska dödskallar. Kontur/linjer ur stilguiden art-style.js.
//
// Animationer (bara transform/opacity, CSS i src/styles/31-halloween.css, av vid
// prefers-reduced-motion): .hw-glod (lyser svagt), .hw-flamma (fladdrar),
// .hw-bubbla (bubblar upp), .hw-glimt (glimmar). Klassen sitter på ett <g>.
// Laddas bara via import() (#271) – aldrig i den statiska bootgrafen.
// ============================================================================

import { O, LINE, THIN, limb } from "../art-style.js";

export const PUMPA = "#F49E4C";
export const PUMPA_MORK = "#F08A3C";
export const LILA = "#B79BE0";
export const LILA_MORK = "#7E62B8";
export const NATT = "#4C4661";
export const SKEN = "#FDE9A8";
export const GUL = "#F7C948";
export const GRON = "#6FC66F";
export const GRON_MORK = "#4E9B5E";
export const KRAM = "#FFF3DC";
export const SLEM = "#9BE07A";
export const WOOD = "#B0805A";
export const WOOD_DARK = "#8A6242";

/** Mjuk kontaktskugga under en sak. */
export const skugga = (cx, cy, rx, op = 0.1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="${op}"/>`;

/** <g> med animationsklass. */
export const anim = (klass, inner) => `<g class="${klass}">${inner}</g>`;

/** Ett litet blankt öga (svart med glimt) – för små figurer. */
export function oga(x, y, r = 2.4) {
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${O}"/>` +
    `<circle cx="${(x + r * 0.35).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" r="${(r * 0.38).toFixed(1)}" fill="#fff"/>`
  );
}

/**
 * Gullig pumpa med blad, centrerad i (cx,cy) och halvbredd r. ansikte:
 * "lykta" = lysande ögon/leende, "glad" = målat glatt ansikte, "" = utan.
 */
export function pumpa(cx, cy, r, ansikte = "") {
  const ry = r * 0.82;
  const sido = r * 0.42;
  let s =
    limb(`M${cx} ${cy - ry + 2} Q${cx - 1} ${cy - ry - r * 0.3} ${cx + r * 0.2} ${cy - ry - r * 0.42}`, GRON_MORK, Math.max(2.5, r * 0.16)) +
    `<path d="M${cx + 1} ${cy - ry - 1} Q${cx + r * 0.5} ${cy - ry - r * 0.5} ${cx + r * 0.75} ${cy - ry - r * 0.1} ` +
    `Q${cx + r * 0.4} ${cy - ry + r * 0.1} ${cx + 1} ${cy - ry - 1} Z" fill="${GRON}" ${THIN}/>` +
    `<ellipse cx="${cx - sido}" cy="${cy}" rx="${r * 0.6}" ry="${ry}" fill="${PUMPA_MORK}" ${LINE}/>` +
    `<ellipse cx="${cx + sido}" cy="${cy}" rx="${r * 0.6}" ry="${ry}" fill="${PUMPA_MORK}" ${LINE}/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.62}" ry="${ry * 1.02}" fill="${PUMPA}" ${LINE}/>`;
  const e = r * 0.24;
  const ey = cy - ry * 0.12;
  if (ansikte === "lykta") {
    const ljus = (f) =>
      `<circle cx="${cx - e}" cy="${ey}" r="${r * 0.12}" fill="${f}" ${THIN}/>` +
      `<circle cx="${cx + e}" cy="${ey}" r="${r * 0.12}" fill="${f}" ${THIN}/>` +
      `<path d="M${cx - r * 0.3} ${cy + ry * 0.22} Q${cx} ${cy + ry * 0.62} ${cx + r * 0.3} ${cy + ry * 0.22} ` +
      `Q${cx} ${cy + ry * 0.38} ${cx - r * 0.3} ${cy + ry * 0.22} Z" fill="${f}" ${THIN}/>`;
    s += ljus(GUL) + anim("hw-glod", ljus(KRAM));
  } else if (ansikte === "glad") {
    s +=
      oga(cx - e, ey, r * 0.1) + oga(cx + e, ey, r * 0.1) +
      `<path d="M${cx - r * 0.18} ${cy + ry * 0.25} Q${cx} ${cy + ry * 0.45} ${cx + r * 0.18} ${cy + ry * 0.25}" fill="none" ${THIN}/>`;
  }
  return s;
}

/** Rund gullig fladdermus centrerad i (cx,cy), skala s (1 ≈ 22 px bred). */
export function fladdermus(cx, cy, s = 1) {
  return (
    `<g transform="translate(${cx} ${cy}) scale(${s})">` +
    `<path d="M-4 -1 Q-9 -8 -16 -4 Q-13 -1 -15 3 Q-11 1 -9 5 Q-7 1 -4 3 Z" fill="${NATT}" ${THIN}/>` +
    `<path d="M4 -1 Q9 -8 16 -4 Q13 -1 15 3 Q11 1 9 5 Q7 1 4 3 Z" fill="${NATT}" ${THIN}/>` +
    `<path d="M-4.5 -4 L-4 -9.5 L-1.5 -5.5 M4.5 -4 L4 -9.5 L1.5 -5.5" fill="${NATT}" ${THIN}/>` +
    `<circle cx="0" cy="0" r="5.6" fill="${NATT}" ${THIN}/>` +
    `<circle cx="-2" cy="-0.6" r="1.7" fill="#fff"/><circle cx="2" cy="-0.6" r="1.7" fill="#fff"/>` +
    `<circle cx="-1.8" cy="-0.3" r="0.8" fill="${O}"/><circle cx="2.2" cy="-0.3" r="0.8" fill="${O}"/>` +
    `<path d="M-1.4 2.4 Q0 3.4 1.4 2.4" fill="none" stroke="#fff" stroke-width="0.9" stroke-linecap="round"/>` +
    `</g>`
  );
}

/** Litet gulligt spöke (vågig fåll) centrerat i (cx,cy), skala s (1 ≈ 24 px). */
export function spoke(cx, cy, s = 1, fyll = "#fff") {
  return (
    `<g transform="translate(${cx} ${cy}) scale(${s})">` +
    `<path d="M-11 12 L-11 -1 Q-11 -13 0 -13 Q11 -13 11 -1 L11 12 Q8 9 5.5 12 Q3 15 0 12 Q-3 9 -5.5 12 Q-8 15 -11 12 Z" fill="${fyll}" ${THIN}/>` +
    oga(-4, -2, 2.2) + oga(4, -2, 2.2) +
    `<ellipse cx="0" cy="4" rx="2" ry="2.4" fill="${O}"/>` +
    `<ellipse cx="-7.5" cy="2.5" rx="2" ry="1.2" fill="#FFB1B8" opacity="0.85"/>` +
    `<ellipse cx="7.5" cy="2.5" rx="2" ry="1.2" fill="#FFB1B8" opacity="0.85"/>` +
    `</g>`
  );
}

/** Liten fyruddig glittrande stjärna (för .hw-glimt). */
export const glitter = (x, y, r, c = "#fff") =>
  `<path d="M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} ` +
  `Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z" fill="${c}" stroke="none"/>`;

export { O, LINE, THIN, limb };
