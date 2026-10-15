// ============================================================================
// Pluggporten – Halloween-djurens delade byggdelar (#695, epic #689)
// ----------------------------------------------------------------------------
// Ansikte per uttryck (glad/nyfiken/ater/somnig + vila ""), kinder, krona,
// glöd och stjärnor – så de tio arterna (hw-djur-a.js, hw-djur-b.js) får samma
// uttryckssystem som de andra husdjuren men egna siluetter.
//
// Ritas i viewBox 0 0 100 100 med golvet vid y≈95 (samma ruta som övriga
// husdjur, art-pets-creatures.js). Storleken per steg sätts av rummets CSS
// (.pet-vuxen-1/2/3), så varje steg FYLLER rutan – skillnaden ligger i formen.
//
// Animationer (CSS i src/styles/33-halloween.css, bara transform/opacity, av vid
// prefers-reduced-motion): .hwd-andas (kroppen andas), .hwd-svav (svävar),
// .hwd-studs (slem-studs), .hwd-flax-v/-h (vingar), .hwd-svans (viftar),
// .hwd-mums (tuggar när uttrycket är "ater"), .hwd-fot-v/-h (går, bara när
// djuret promenerar) + samlingens .hw-glod/.hw-glimt. Gulligt-läskigt: stora
// ögon, runda former, inga vassa tänder (spec §3.4/§6.2).
// ============================================================================

import { O, LINE, THIN, limb, stjarna } from "../art-style.js";
import { anim, glitter, GUL, KRAM, SKEN } from "./hw-art-delar.js";

export { O, LINE, THIN, limb, stjarna, anim, glitter };

const MUN = "#7C4A57";
const TUNGA = "#FF9AA6";
const KIND = "#FFB1B8";

/** Mjuk kontaktskugga på golvet. */
export const golv = (rx, cx = 50, cy = 94) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.2).toFixed(1)}" fill="${O}" opacity="0.12"/>`;

/** Ett öga i givet uttryck. o.iris = färgad iris (katt), o.linje = linjefärg på mörk päls. */
function oga(x, y, r, expr, o) {
  const lin = o.linje || O;
  const streck = `fill="none" stroke="${lin}" stroke-width="${Math.max(2, r * 0.42).toFixed(1)}" stroke-linecap="round"`;
  if (expr === "somnig") return `<path d="M${x - r * 0.85} ${y} Q${x} ${y + r * 0.8} ${x + r * 0.85} ${y}" ${streck}/>`;
  if (expr === "glad" || expr === "ater") {
    return `<path d="M${x - r * 0.85} ${y + r * 0.25} Q${x} ${y - r * 0.85} ${x + r * 0.85} ${y + r * 0.25}" ${streck}/>`;
  }
  const R = expr === "nyfiken" ? r * 1.18 : r;
  const py = y + (expr === "nyfiken" ? -R * 0.12 : R * 0.1);
  let s = `<circle cx="${x}" cy="${y}" r="${R.toFixed(1)}" fill="#fff" ${THIN}/>`;
  if (o.iris) {
    s += `<circle cx="${x}" cy="${py.toFixed(1)}" r="${(R * 0.7).toFixed(1)}" fill="${o.iris}"/>` +
      `<ellipse cx="${x}" cy="${py.toFixed(1)}" rx="${(R * 0.26).toFixed(1)}" ry="${(R * 0.5).toFixed(1)}" fill="${O}"/>`;
  } else {
    s += `<circle cx="${x}" cy="${py.toFixed(1)}" r="${(R * 0.6).toFixed(1)}" fill="${O}"/>`;
  }
  return s +
    `<circle cx="${(x + R * 0.3).toFixed(1)}" cy="${(py - R * 0.3).toFixed(1)}" r="${(R * 0.24).toFixed(1)}" fill="#fff"/>` +
    `<circle cx="${(x - R * 0.25).toFixed(1)}" cy="${(py + R * 0.28).toFixed(1)}" r="${(R * 0.11).toFixed(1)}" fill="#fff"/>`;
}

/** Munnen i givet uttryck, centrerad i (x,y) med halvbredd w. */
function mun(x, y, w, expr, o) {
  const lin = o.linje || O;
  switch (expr) {
    case "glad":
      return `<path d="M${x - w * 1.3} ${y} Q${x} ${y + w * 2.3} ${x + w * 1.3} ${y} Z" fill="${MUN}" stroke="${lin}" stroke-width="2.2" stroke-linejoin="round"/>` +
        `<path d="M${x - w * 0.6} ${y + w * 0.95} Q${x} ${y + w * 1.6} ${x + w * 0.6} ${y + w * 0.95} Z" fill="${TUNGA}"/>`;
    case "ater": // mums – tuggande mun + en bit Mysterymat (äpple) bredvid
      return anim("hwd-mums", `<ellipse cx="${x}" cy="${y + w * 0.6}" rx="${w * 1.05}" ry="${w * 0.85}" fill="${MUN}" stroke="${lin}" stroke-width="2.2"/>`) +
        `<circle cx="${x + w * 2.4}" cy="${y + w * 1.2}" r="${Math.max(1.6, w * 0.5)}" fill="#EF6F6C"/>` +
        `<circle cx="${x - w * 2.1}" cy="${y + w * 1.6}" r="${Math.max(1.1, w * 0.32)}" fill="#EF6F6C"/>`;
    case "nyfiken":
      return `<circle cx="${x}" cy="${y + w * 0.5}" r="${w * 0.55}" fill="${MUN}" stroke="${lin}" stroke-width="1.8"/>`;
    case "somnig":
      return `<ellipse cx="${x}" cy="${y + w * 0.4}" rx="${w * 0.4}" ry="${w * 0.32}" fill="${MUN}"/>`;
    default:
      return `<path d="M${x - w} ${y} Q${x} ${y + w * 0.95} ${x + w} ${y}" fill="none" stroke="${lin}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
}

/** Sömn-z vid huvudet. */
const zzz = (x, y, c) => // ritas utanför djuret → alltid konturfärgen
  `<text x="${x}" y="${y}" font-size="11" font-weight="bold" fill="${c}" stroke="none">z</text>` +
  `<text x="${x + 7}" y="${y - 8}" font-size="8" font-weight="bold" fill="${c}" stroke="none">z</text>`;

/**
 * Hela ansiktet: ögon (mitt cx, höjd cy, avstånd dx, radie r) + mun + kinder.
 * o: { iris, linje, mun (halvbredd), munY (avstånd under ögonen), kinder:false, utanMun (näbb), zx/zy }.
 */
export function ansikte(cx, cy, dx, r, expr, o = {}) {
  const e = expr || "";
  let s = oga(cx - dx, cy, r, e, o) + oga(cx + dx, cy, r, e, o);
  if (o.kinder !== false) {
    s += `<ellipse cx="${cx - dx - r * 0.55}" cy="${cy + r * 1.35}" rx="${r * 0.7}" ry="${r * 0.45}" fill="${KIND}" opacity="0.85"/>` +
      `<ellipse cx="${cx + dx + r * 0.55}" cy="${cy + r * 1.35}" rx="${r * 0.7}" ry="${r * 0.45}" fill="${KIND}" opacity="0.85"/>`;
  }
  if (!o.utanMun || e === "glad" || e === "ater") s += mun(cx, cy + (o.munY ?? r * 1.5), o.mun ?? r * 0.62, e, o);
  if (e === "somnig") s += zzz(o.zx ?? cx + dx + r + 6, o.zy ?? cy - r - 6, O);
  return s;
}

/** Liten rund guldkrona, botten-mitt i (cx,y), bredd ≈ 18·s. */
export function krona(cx, y, s = 1, c = GUL, sten = "#EF6F6C") {
  return `<g transform="translate(${cx} ${y}) scale(${s}) rotate(-6)">` +
    `<path d="M-9 0 L-10 -10 L-5 -5 L0 -13 L5 -5 L10 -10 L9 0 Z" fill="${c}" ${THIN}/>` +
    `<circle cx="0" cy="-13" r="1.8" fill="${KRAM}" ${THIN}/>` +
    `<circle cx="-10" cy="-10.5" r="1.4" fill="${KRAM}" stroke="none"/><circle cx="10" cy="-10.5" r="1.4" fill="${KRAM}" stroke="none"/>` +
    `<circle cx="0" cy="-4" r="2" fill="${sten}" stroke="none"/></g>`;
}

/** Mjuk glöd bakom ett fullvuxet djur (pulserar med .hw-glod). */
export const glod = (cx, cy, r, c = SKEN, op = 0.55) =>
  anim("hw-glod", `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="${op}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${(r * 0.72).toFixed(1)}" fill="${c}" opacity="${op}"/>`);

/** Glimtande stjärnor runt ett fullvuxet djur: [[x, y, r], …]. */
export const glimtar = (lista, c = "#fff") =>
  anim("hw-glimt", lista.map(([x, y, r]) => glitter(x, y, r, c)).join(""));

/** Kapsel-fot som "går" (.hwd-fot-v/-h när djuret promenerar). */
export const fot = (sida, cx, cy, rx, ry, fyll) =>
  anim(sida < 0 ? "hwd-fot-v" : "hwd-fot-h", `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fyll}" ${LINE}/>`);

/** Stjärna med kontur (för mantlar, emblem). */
export const stjarnaK = (x, y, s, c = GUL) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -5 L1.4 -1.5 L5 -1.2 L2.3 1.1 L3.1 4.8 L0 2.8 L-3.1 4.8 L-2.3 1.1 L-5 -1.2 L-1.4 -1.5 Z" fill="${c}" stroke="${O}" stroke-width="${(1.4 / s).toFixed(2)}" stroke-linejoin="round"/>`;

/** Liten månskära (öppning åt höger), mitt (x,y), radie r. */
export const mane = (x, y, r, c = SKEN) =>
  `<path d="M${x + r * 0.35} ${y - r} A${r} ${r} 0 1 0 ${x + r * 0.35} ${y + r} A${r * 0.78} ${r * 0.78} 0 1 1 ${x + r * 0.35} ${y - r} Z" fill="${c}" ${THIN}/>`;
