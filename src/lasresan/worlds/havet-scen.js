// ============================================================================
// Läsresan – Havets scen (src/lasresan/worlds/havet-scen.js)  ·  issue #659
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil – se skogen-scen.js för
// mönstret. Ren strängbyggare utan DOM: havetScen(world) → scenens inre
// SVG-markup (hav, strand, öar, brygga/stig, dekor) i världspixlar.
// Stigen ritas som BRYGGA hela vägen och täcks av en sandstig där den går på
// land (klippt mot strand + öar), så bryggorna börjar och slutar vid vattnet.
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (soligt hav, ur stilguiden) -------------------------------------
const HAV = "#6CC3E6";
const HAV_DJUP = "#4FA9D6";
const HAV_LJUS = "#C4EEF8";
const GRUNT = "#A8E6EE";
const SAND = "#F3DDA6";
const SAND_LJUS = "#FAEDC8";
const SAND_MORK = "#DCC082";
const STIG = "#E9CF97";
const STIG_KANT = "#CFAE74";
const GRAS = "#9CCF7E";
const PLANKA = "#C79A6B";
const PLANKA_MORK = "#8A6242";
const STOLPE = "#6E4E35";
const PALM_STAM = "#B0805A";
const PALM_BLAD = "#6FC66F";
const KORALL = "#F7837A";
const KORALL_LILA = "#B79BE0";
const ROSA = "#F890B7";
const SJOGRAS = "#3FA77F";
const STEN = "#8FA3AD";
const STEN_LJUS = "#B8C7CE";
const ROD = "#EF6F6C";
const BLA = "#5B8DEF";
const GUL = "#F7C948";
const VIT = "#FFFFFF";
const FISKFARGER = ["#F79A3E", GUL, ROSA];

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const LAND_ID = "lr-havet-land";

// --- Land: strand + öar som mjuka former -------------------------------------

/** Mjuk, lite ojämn ö-form (sluten kurva genom en "skakad" ellips). */
function oForm({ x, y, rx, ry }, i) {
  const W = [1, 0.93, 1.05, 0.96, 1.03, 0.92, 1.06, 0.97, 1.02, 0.95];
  const n = W.length;
  const pts = W.map((_, k) => {
    const a = (k / n) * Math.PI * 2;
    const f = W[(k + i * 3) % n];
    return [x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  let d = `M${n1(m0[0])} ${n1(m0[1])} `;
  for (let k = 0; k < n; k++) {
    const p = pts[k], m = mid(p, pts[(k + 1) % n]);
    d += `Q${n1(p[0])} ${n1(p[1])} ${n1(m[0])} ${n1(m[1])} `;
  }
  return d + "Z";
}

/** Alla landformer som path-data: stranden (ned till hörnet) + öarna. */
function landFormer(world) {
  const out = [];
  if (world.strand && world.strand.length > 1) {
    out.push(`${smoothOpenPath(world.strand)}L0 ${world.scene.height} Z`);
  }
  (world.oar || []).forEach((o, i) => out.push(oForm(o, i)));
  return out;
}

/** Grunt vatten runt land + sanden + lite gräs på öarna. */
function land(former, oar) {
  const grunt = former
    .map((d) => `<path d="${d}" fill="${GRUNT}" stroke="${GRUNT}" stroke-width="70" stroke-linejoin="round" opacity="0.55"/>` +
      `<path d="${d}" fill="none" stroke="${HAV_LJUS}" stroke-width="26" stroke-linejoin="round" opacity="0.8"/>`)
    .join("");
  const sand = former.map((d) => `<path d="${d}" fill="${SAND}" ${L2}/>`).join("");
  const gras = (oar || [])
    .map((o) => `<ellipse cx="${o.x}" cy="${n1(o.y - o.ry * 0.25)}" rx="${n1(o.rx * 0.55)}" ry="${n1(o.ry * 0.4)}" fill="${GRAS}" opacity="0.75"/>` +
      `<ellipse cx="${n1(o.x - o.rx * 0.3)}" cy="${n1(o.y + o.ry * 0.35)}" rx="${n1(o.rx * 0.3)}" ry="${n1(o.ry * 0.18)}" fill="${SAND_LJUS}" opacity="0.8"/>`)
    .join("");
  return grunt + sand + gras;
}

// --- Havet: bas + djupare fläckar --------------------------------------------
function hav(w, h) {
  const flackar = [
    [1250, 300, 260, HAV_DJUP, 0.35], [600, 620, 230, HAV_DJUP, 0.3],
    [1450, 850, 200, HAV_DJUP, 0.3], [700, 120, 220, HAV_DJUP, 0.28],
    [1100, 600, 160, HAV_LJUS, 0.25], [400, 470, 150, HAV_LJUS, 0.22],
  ]
    .map(([x, y, r, f, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.5)}" fill="${f}" opacity="${o}"/>`)
    .join("");
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${HAV}"/>` + flackar;
}

// --- Stigen: brygga överallt, sandstig ovanpå där det är land ----------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  const brygga =
    `<path d="${d}" fill="none" stroke="${STOLPE}" stroke-width="64" stroke-dasharray="10 62"/>` +
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="50" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${PLANKA}" stroke-width="42" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${PLANKA_MORK}" stroke-width="42" stroke-dasharray="2.5 13" opacity="0.65"/>`;
  const pa_land =
    `<g clip-path="url(#${LAND_ID})">` +
    `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="72" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="54" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="44" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 52" opacity="0.8"/>` +
    `</g>`;
  return brygga + pa_land;
}

// --- Dekor-typer (alla ritas i en grupp: translate + skala) -------------------
const grupp = (x, y, s, inner, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${inner}</g>`;
const krusning = (rx) => `<ellipse cx="0" cy="4" rx="${rx}" ry="${n1(rx * 0.18)}" fill="${HAV_LJUS}" opacity="0.7"/>`;

/** Liten våg (två bågar). */
function vag(x, y, s) {
  return grupp(x, y, s, `<path d="M-28 0 q14 -12 28 0 q14 -12 28 0" fill="none" stroke="${HAV_LJUS}" stroke-width="5" stroke-linecap="round" opacity="0.9"/>`);
}

/** Korallrev: förgrenad korall + hjärnkorall + liten rund. */
function korall(x, y, s) {
  const gren = "M0 0 L0 -28 M0 -14 L-13 -26 L-15 -38 M0 -22 L13 -34 L11 -46 M13 -34 L22 -40";
  return grupp(x, y, s,
    `<ellipse cx="0" cy="2" rx="46" ry="14" fill="${GRUNT}" opacity="0.8"/>` +
    `<path d="${gren}" fill="none" stroke="${O}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${gren}" fill="none" stroke="${KORALL}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M-38 2 Q-38 -22 -24 -22 Q-10 -22 -10 2 Z" fill="${KORALL_LILA}" ${L2}/>` +
    `<path d="M-32 -4 q4 -8 8 0 t8 0" fill="none" stroke="${O}" stroke-width="2" opacity="0.4"/>` +
    `<circle cx="26" cy="-6" r="9" fill="${ROSA}" ${L2}/>` +
    `<circle cx="23" cy="-9" r="3" fill="${VIT}" opacity="0.6"/>`);
}

/** Sjögräs: tre vajande strån. */
function sjogras(x, y, s) {
  const stra = (dx, h) => {
    const d = `M${dx} 0 q-9 ${-h / 4} 0 ${-h / 2} t0 ${-h / 2}`;
    return `<path d="${d}" fill="none" stroke="${O}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="${SJOGRAS}" stroke-width="4.5" stroke-linecap="round"/>`;
  };
  return grupp(x, y, s, stra(-10, 40) + stra(0, 56) + stra(10, 44));
}

/** Fisk (simmar åt vänster, flip = åt höger). */
function fisk(x, y, s, d) {
  const f = FISKFARGER[Math.round(x / 10) % FISKFARGER.length];
  return grupp(x, y, s,
    `<path d="M14 0 L32 -12 L28 0 L32 12 Z" fill="${f}" ${L2}/>` +
    `<ellipse cx="0" cy="0" rx="21" ry="12" fill="${f}" ${L2}/>` +
    `<path d="M2 -10 Q8 0 2 10" fill="none" stroke="${VIT}" stroke-width="3.5" opacity="0.85"/>` +
    `<path d="M-2 -11 L6 -18 L10 -10" fill="${f}" ${L2}/>` +
    `<circle cx="-11" cy="-3" r="3" fill="${O}"/>` +
    `<circle cx="-30" cy="-10" r="3" fill="none" stroke="${VIT}" stroke-width="2" opacity="0.8"/>` +
    `<circle cx="-36" cy="-20" r="2" fill="none" stroke="${VIT}" stroke-width="2" opacity="0.7"/>`,
    d && d.flip);
}

/** Roddbåt med åra. */
function roddbat(x, y, s) {
  return grupp(x, y, s,
    krusning(62) +
    `<line x1="-6" y1="-16" x2="-46" y2="12" stroke="${PLANKA_MORK}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M-50 -12 L52 -12 Q46 12 22 16 L-26 16 Q-46 10 -50 -12 Z" fill="${ROD}" ${L2}/>` +
    `<path d="M-46 -4 L48 -4" stroke="${VIT}" stroke-width="5" opacity="0.9"/>` +
    `<path d="M-50 -12 L52 -12" ${L2}/>`);
}

/** Segelbåt med två segel och vimpel. */
function segelbat(x, y, s) {
  return grupp(x, y, s,
    krusning(58) +
    `<path d="M-46 -2 L46 -2 Q40 16 26 20 L-30 20 Q-42 14 -46 -2 Z" fill="${BLA}" ${L2}/>` +
    `<path d="M-42 6 L43 6" stroke="${VIT}" stroke-width="4" opacity="0.9"/>` +
    `<rect x="-2.5" y="-92" width="5" height="90" rx="2.5" fill="${PLANKA_MORK}" ${L2}/>` +
    `<path d="M6 -86 L6 -10 L46 -10 Z" fill="${VIT}" ${L2}/>` +
    `<path d="M-6 -76 L-6 -10 L-38 -10 Z" fill="#FDE7A9" ${L2}/>` +
    `<path d="M2 -92 L20 -86 L2 -80 Z" fill="${ROD}" ${L2}/>`);
}

/** Boj (röd-vit). */
function boj(x, y, s) {
  return grupp(x, y, s,
    krusning(26) +
    `<path d="M-13 4 Q-14 -24 0 -26 Q14 -24 13 4 Z" fill="${ROD}" ${L2}/>` +
    `<path d="M-13.5 -10 L13.5 -10 L13 -2 L-13 -2 Z" fill="${VIT}"/>` +
    `<path d="M-13 4 Q-14 -24 0 -26 Q14 -24 13 4 Z" fill="none" ${L2}/>` +
    `<circle cx="0" cy="-30" r="4.5" fill="${GUL}" ${L2}/>`);
}

/** Sten som sticker upp ur vattnet, med skum. */
function havssten(x, y, s) {
  return grupp(x, y, s,
    `<path d="M-36 4 Q-34 -26 -6 -28 Q30 -30 36 4 Z" fill="${STEN}" ${L2}/>` +
    `<ellipse cx="-10" cy="-16" rx="12" ry="6" fill="${STEN_LJUS}" opacity="0.8"/>` +
    `<path d="M-46 6 q8 -6 16 0 t16 0 M14 6 q8 -6 16 0 t16 0" fill="none" stroke="${VIT}" stroke-width="4" stroke-linecap="round" opacity="0.9"/>`);
}

/** Mås i flykt. */
function mas(x, y, s) {
  return grupp(x, y, s,
    `<path d="M-22 0 q11 -14 22 0 q11 -14 22 0" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M-22 0 q11 -14 22 0 q11 -14 22 0" fill="none" stroke="${VIT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
}

/** Palm: böjd stam + bladkrona + kokosnötter. */
function palm(x, y, s) {
  const blad = (rot) => `<path d="M0 0 Q26 -14 46 -2 Q24 2 0 0 Z" fill="${PALM_BLAD}" ${L2} transform="rotate(${rot})"/>`;
  return grupp(x, y, s,
    `<ellipse cx="0" cy="5" rx="30" ry="9" fill="${O}" opacity="0.12"/>` +
    `<path d="M-6 0 Q-2 -40 14 -64 L20 -58 Q6 -36 6 0 Z" fill="${PALM_STAM}" ${L2}/>` +
    `<g transform="translate(17 -62)">` + blad(-150) + blad(-110) + blad(-60) + blad(-15) + blad(25) +
    `<circle cx="-4" cy="4" r="5" fill="${PLANKA_MORK}" ${L2}/><circle cx="6" cy="6" r="5" fill="${PLANKA_MORK}" ${L2}/></g>`);
}

/** Parasoll med badhandduk. */
function parasoll(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="10" cy="4" rx="54" ry="12" fill="${O}" opacity="0.1"/>` +
    `<rect x="8" y="-12" width="54" height="22" rx="4" fill="#7FC7E8" ${L2} transform="rotate(-6 35 0)"/>` +
    `<path d="M22 -12 L22 10 M42 -14 L42 8" stroke="${VIT}" stroke-width="4" transform="rotate(-6 35 0)"/>` +
    `<line x1="0" y1="-96" x2="3" y2="2" stroke="${PLANKA_MORK}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M-52 -66 Q0 -122 52 -66 Z" fill="${ROD}"/>` +
    `<path d="M0 -96 L-20 -68 L20 -68 Z" fill="${VIT}"/>` +
    `<path d="M-52 -66 Q0 -122 52 -66 Q39 -58 26 -67 Q13 -58 0 -67 Q-13 -58 -26 -67 Q-39 -58 -52 -66 Z" fill="none" ${L2}/>`);
}

/** Sandslott med två torn och flagga. */
function sandslott(x, y, s) {
  const torn = (tx) => `<path d="M${tx} -22 L${tx} -48 h5 v6 h6 v-6 h5 v6 h6 v-6 h5 L${tx + 27} -22 Z" fill="${SAND_MORK}" ${L2}/>`;
  return grupp(x, y, s,
    `<ellipse cx="0" cy="4" rx="48" ry="10" fill="${O}" opacity="0.1"/>` +
    torn(-40) + torn(13) +
    `<path d="M-44 4 L-44 -22 L44 -22 L44 4 Z" fill="${SAND_MORK}" ${L2}/>` +
    `<path d="M-8 4 L-8 -8 Q0 -16 8 -8 L8 4 Z" fill="${STIG_KANT}" ${L2}/>` +
    `<line x1="-26" y1="-48" x2="-26" y2="-68" stroke="${O}" stroke-width="3"/>` +
    `<path d="M-26 -68 L-10 -62 L-26 -56 Z" fill="${ROD}" ${L2}/>`);
}

/** Sjöstjärna. */
function sjostjarna(x, y, s) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 7 : 17;
    d += `${i ? "L" : "M"}${n1(Math.cos(a) * r)} ${n1(Math.sin(a) * r)} `;
  }
  return grupp(x, y, s,
    `<path d="${d}Z" fill="${KORALL}" ${L2}/>` +
    `<circle cx="0" cy="-8" r="1.8" fill="${VIT}"/><circle cx="7" cy="1" r="1.8" fill="${VIT}"/><circle cx="-6" cy="2" r="1.8" fill="${VIT}"/>`);
}

/** Snäcka (musselskal). */
function snacka(x, y, s) {
  return grupp(x, y, s,
    `<path d="M0 4 L-16 -10 Q0 -30 16 -10 Z" fill="#FBD3C4" ${L2}/>` +
    `<path d="M0 2 L-8 -18 M0 2 L0 -21 M0 2 L8 -18" stroke="${KORALL}" stroke-width="2.5" stroke-linecap="round"/>`);
}

/** Krabba (glad, röd). */
function krabba(x, y, s) {
  const ben = "M-14 0 L-26 8 M-14 4 L-24 14 M14 0 L26 8 M14 4 L24 14";
  return grupp(x, y, s,
    `<path d="${ben}" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M-14 -6 L-24 -18 M14 -6 L24 -18" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="-26" cy="-22" r="7" fill="${ROD}" ${L2}/><circle cx="26" cy="-22" r="7" fill="${ROD}" ${L2}/>` +
    `<ellipse cx="0" cy="0" rx="20" ry="13" fill="${ROD}" ${L2}/>` +
    `<line x1="-6" y1="-10" x2="-7" y2="-20" stroke="${O}" stroke-width="3"/><line x1="6" y1="-10" x2="7" y2="-20" stroke="${O}" stroke-width="3"/>` +
    `<circle cx="-7" cy="-21" r="4" fill="${VIT}" ${L2}/><circle cx="7" cy="-21" r="4" fill="${VIT}" ${L2}/>` +
    `<path d="M-5 3 q5 4 10 0" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>`);
}

/** Fyren på målön: rödvit randig med ljuskägla. */
function fyr(x, y) {
  const band = (t0, t1) => {
    const bx = (t) => 24 - 9 * t; // halva bredden: 24 nere → 15 uppe
    const y0 = -126 * t0, y1 = -126 * t1;
    return `<path d="M${n1(-bx(t0))} ${n1(y0)} L${n1(-bx(t1))} ${n1(y1)} L${n1(bx(t1))} ${n1(y1)} L${n1(bx(t0))} ${n1(y0)} Z" fill="${ROD}"/>`;
  };
  return grupp(x, y, 1,
    `<path d="M-22 -150 L-130 -190 L-130 -120 Z M22 -150 L130 -190 L130 -120 Z" fill="${GUL}" opacity="0.3"/>` +
    `<ellipse cx="0" cy="4" rx="40" ry="11" fill="${O}" opacity="0.14"/>` +
    `<path d="M-24 0 L-15 -126 L15 -126 L24 0 Z" fill="${VIT}"/>` +
    band(0, 0.2) + band(0.4, 0.6) + band(0.8, 1) +
    `<path d="M-24 0 L-15 -126 L15 -126 L24 0 Z" fill="none" ${L2}/>` +
    `<path d="M-6 0 L-6 -18 Q0 -24 6 -18 L6 0 Z" fill="${PLANKA_MORK}" ${L2}/>` +
    `<rect x="-22" y="-134" width="44" height="9" rx="3" fill="${O}"/>` +
    `<rect x="-12" y="-158" width="24" height="24" rx="4" fill="${GUL}" ${L2}/>` +
    `<path d="M-17 -158 L0 -178 L17 -158 Z" fill="${ROD}" ${L2}/>`);
}

/** Målflagga (samma form som Skogens, havsblå). */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 36} ${y - 6})">` +
    `<ellipse cx="0" cy="4" rx="16" ry="6" fill="${O}" opacity="0.12"/>` +
    `<rect x="-3" y="-66" width="6" height="70" rx="3" fill="${PLANKA_MORK}" ${L2}/>` +
    `<path d="M3 -64 L46 -48 L3 -30 Z" fill="${GUL}" ${L2}/>` +
    `</g>`
  );
}

const UNDER = new Set(["vag", "korall", "sjogras", "fisk"]);
const TYPER = { vag, korall, sjogras, fisk, roddbat, segelbat, boj, havssten, mas, palm, parasoll, sandslott, sjostjarna, snacka, krabba };

// ============================================================================
// Hela scenen (bakifrån och fram): hav → undervattensdekor → grunt vatten +
// land → brygga/sandstig → övrig dekor (sorterad på y) → fyren → flaggan.
// ============================================================================
export function havetScen(world) {
  const { width: w, height: h } = world.scene;
  const deko = world.decorations || [];
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s, d) : "");
  const under = deko.filter((d) => UNDER.has(d.type));
  const framfor = deko
    .filter((d) => !UNDER.has(d.type))
    .slice()
    .sort((a, b) => a.y - b.y);
  const former = landFormer(world);
  return (
    `<defs><clipPath id="${LAND_ID}">${former.map((d) => `<path d="${d}"/>`).join("")}</clipPath></defs>` +
    hav(w, h) +
    under.map(rita).join("") +
    land(former, world.oar) +
    stig(world) +
    framfor.map(rita).join("") +
    (world.fyr ? fyr(world.fyr.x, world.fyr.y) : "") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "")
  );
}
