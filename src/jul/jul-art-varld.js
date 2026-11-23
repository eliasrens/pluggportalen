// ============================================================================
// Pluggporten – julen i världen, på porten och i lärarspärren: konsten (#909,
// epic #906, UTVECKLINGSUPPDRAG_VINTER_JUL.md C.1–C.3)
// ----------------------------------------------------------------------------
// Ren SVG-konst i stilguidens stil (art-style.js): mörka konturer, runda
// former, stora ögon, varma lampor. Ingen DOM här – jul-varld.js lägger in
// strängarna i de redan ritade scenerna, och BARA när Jul är på (modulen
// laddas med import() först då, så sommar/höst utan tillägg är orörda och
// bootgrafen växer inte, #271).
//
// Rörelse (styles/53-jul.css): ljusslingan blinkar med EN animation per
// slinga (.julv-blink, bara opacity, 3 lägen, lång period) och tomten vinkar
// (.julv-vinkarm). Norrskenet och stjärnorna står stilla. Allt är av vid
// reducerad rörelse.
// ============================================================================

import { O, LINE, THIN, limb, eye } from "../art-style.js";

const f = (n) => +n.toFixed(1);

// Lamporna: små varma lampor i gult, rött och grönt (C.1).
export const LAMP_FARGER = ["#F7C948", "#EF6F6C", "#6FC66F"];
const SOCKEL = "#5B5470";
const ROD = "#C9474F";
const ROD_LJUS = "#E0606A";
const KRAM = "#FFF3DC";
const SKAGG = "#F4F1EA";
const HUD = "#FFD9C2";
const GRAN = "#2F6B55";
const GRAN_LJUS = "#3F8C6B";
const HALM = "#E2B35C";
const HALM_MORK = "#B98A3A";
const SNOBOLL = "#E6EDF5";
const VARMT = "#FDE9A8";
const GLOD = "#F7C948";

/** En lampa som hänger i tråden (x, y = fästet). `glod` = mjuk gloria bakom. */
function lampa(x, y, r, c, glod = true) {
  return `${glod ? `<circle cx="${f(x)}" cy="${f(y + r * 0.9)}" r="${f(r * 1.7)}" fill="${c}" fill-opacity="0.3" stroke="none"/>` : ""}
    <rect x="${f(x - r * 0.42)}" y="${f(y - r * 0.2)}" width="${f(r * 0.84)}" height="${f(r * 0.6)}" rx="${f(r * 0.2)}" fill="${SOCKEL}" stroke="none"/>
    <ellipse cx="${f(x)}" cy="${f(y + r * 0.95)}" rx="${f(r * 0.68)}" ry="${f(r)}" fill="${c}" stroke="${O}" stroke-width="${f(Math.max(0.8, r * 0.26))}"/>
    <ellipse cx="${f(x - r * 0.22)}" cy="${f(y + r * 0.6)}" rx="${f(r * 0.18)}" ry="${f(r * 0.32)}" fill="#fff" fill-opacity="0.6" stroke="none"/>`;
}

/**
 * Ljusslingans delar: `trad` (tråden + de fasta lamporna) och `blink`
 * (varannan lampa – den del som blinkar). Byns minihus ritar dem i två egna
 * SVG-lager så att blinket blir en kompositor-animation (jul-varld.js).
 */
export function slingaDelar(punkter, { r = 7, sag = r * 0.8, glod = true } = {}) {
  if (punkter.length < 2) return { trad: "", blink: "" };
  let d = `M${f(punkter[0][0])} ${f(punkter[0][1])}`;
  for (let i = 1; i < punkter.length; i++) {
    const [ax, ay] = punkter[i - 1];
    const [bx, by] = punkter[i];
    d += ` Q${f((ax + bx) / 2)} ${f((ay + by) / 2 + sag)} ${f(bx)} ${f(by)}`;
  }
  let fast = "";
  let blink = "";
  punkter.forEach(([x, y], i) => {
    const l = lampa(x, y, r, LAMP_FARGER[i % 3], glod);
    if (i % 2) blink += l;
    else fast += l;
  });
  const trad = `<path d="${d}" fill="none" stroke="${O}" stroke-width="${f(Math.max(1, r * 0.3))}" stroke-linecap="round" stroke-linejoin="round"/>${fast}`;
  return { trad, blink };
}

/** Blinkgruppen: varannan lampa, i blinkfas `fas` (0–2, styles/53-jul.css). */
export const blinkGrupp = (blink, fas = 0) => `<g class="julv-blink julv-f${((fas % 3) + 3) % 3}">${blink}</g>`;

/**
 * Ljusslinga genom `punkter` ([[x, y], …] = lampornas fästen): en tråd som
 * hänger lite mellan lamporna och lampor i gult/rött/grönt. Varannan lampa
 * ligger i .julv-blink – EN grupp per slinga (C.1) som blinkar mellan tre
 * lägen; `fas` (0–2) förskjuter blinket så att grannhusen inte blinkar i takt.
 */
export function ljusslinga(punkter, { r = 7, sag = r * 0.8, fas = 0 } = {}) {
  if (punkter.length < 2) return "";
  const { trad, blink } = slingaDelar(punkter, { r, sag });
  return `<g class="julv-slinga" aria-hidden="true" pointer-events="none">
    ${trad}${blinkGrupp(blink, fas)}</g>`;
}

/** Punkter med jämna mellanrum (`steg`) längs en polylinje [[x, y], …]. */
export function langsLinje(linje, steg) {
  const ut = [];
  if (linje.length < 2) return ut;
  let kvar = steg / 2; // halvt steg in från kanten
  for (let i = 1; i < linje.length; i++) {
    const [ax, ay] = linje[i - 1];
    const [bx, by] = linje[i];
    const len = Math.hypot(bx - ax, by - ay);
    let t = kvar;
    while (t <= len) {
      ut.push([ax + ((bx - ax) * t) / len, ay + ((by - ay) * t) / len]);
      t += steg;
    }
    kvar = t - len;
  }
  return ut;
}

/** Adventsstjärna (åttauddig, varmt lysande) som hänger i en tråd, mitten (cx, cy). */
export function adventsstjarna(cx, cy, r) {
  let d = "";
  for (let i = 0; i < 16; i++) {
    const v = (Math.PI * i) / 8 - Math.PI / 2;
    const rr = i % 2 ? r * 0.46 : i % 4 ? r * 0.78 : r;
    d += `${i ? "L" : "M"}${f(cx + rr * Math.cos(v))} ${f(cy + rr * Math.sin(v))} `;
  }
  return `<g class="julv-advent" aria-hidden="true" pointer-events="none">
    <path d="M${f(cx)} ${f(cy - r * 2.1)} L${f(cx)} ${f(cy - r)}" stroke="${O}" stroke-width="${f(Math.max(1, r * 0.1))}" stroke-linecap="round"/>
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 1.55)}" fill="${GLOD}" fill-opacity="0.35" stroke="none"/>
    <path d="${d}Z" fill="${VARMT}" stroke="${O}" stroke-width="${f(Math.max(1, r * 0.11))}" stroke-linejoin="round"/>
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.2)}" fill="${GLOD}" stroke="none"/></g>`;
}

/** Femuddig stjärna med kontur (granens topp). */
function toppstjarna(x, y, r) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const v = (Math.PI * i) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? "L" : "M"}${f(x + rr * Math.cos(v))} ${f(y + rr * Math.sin(v))} `;
  }
  return `<circle cx="${x}" cy="${y}" r="${f(r * 1.5)}" fill="${GLOD}" fill-opacity="0.3" stroke="none"/>
    <path d="${d}Z" fill="${GLOD}" ${THIN}/>`;
}

/**
 * Julgran med ljus och stjärna (markpunkt x, y; ~146 hög vid s = 1). Ljusen
 * lyser stilla – granen blinkar inte (bara husens slingor gör det).
 */
export function julgran(x, y, s = 1) {
  const ljus = [[-30, -24], [-6, -30], [22, -22], [36, -20], [-20, -60], [8, -66], [26, -58], [-10, -96], [12, -98], [0, -118]]
    .map(([lx, ly], i) => `<circle cx="${lx}" cy="${ly}" r="5.5" fill="${GLOD}" fill-opacity="0.35" stroke="none"/>
      <circle cx="${lx}" cy="${ly}" r="2.9" fill="${i % 3 === 1 ? "#FFF3B0" : VARMT}" stroke="${O}" stroke-width="1.2"/>`)
    .join("");
  const kulor = [[-18, -36, ROD], [14, -42, "#7FC7E8"], [-26, -76, "#7FC7E8"], [20, -80, ROD], [-4, -108, "#B79BE0"]]
    .map(([kx, ky, c]) => `<circle cx="${kx}" cy="${ky}" r="4.6" fill="${c}" ${THIN}/>`)
    .join("");
  return `<g class="julv-gran" transform="translate(${f(x)} ${f(y)}) scale(${s})" aria-hidden="true" pointer-events="none">
    <ellipse cx="0" cy="0" rx="46" ry="7" fill="${O}" fill-opacity="0.1"/>
    ${limb("M0 -2 L0 -18", "#8A6242", 10)}
    <path d="M-50 -14 Q0 -6 50 -14 L0 -70 Z" fill="${GRAN}" ${LINE}/>
    <path d="M-41 -50 Q0 -43 41 -50 L0 -104 Z" fill="${GRAN_LJUS}" ${LINE}/>
    <path d="M-30 -86 Q0 -80 30 -86 L0 -130 Z" fill="${GRAN}" ${LINE}/>
    <path d="M-36 -30 Q0 -14 38 -26 M-28 -66 Q0 -52 30 -64 M-18 -98 Q0 -90 20 -98" fill="none" stroke="${VARMT}" stroke-width="2" stroke-opacity="0.7" stroke-linecap="round"/>
    ${kulor}${ljus}${toppstjarna(0, -134, 10)}</g>`;
}

/** Små julklappar (markpunkt x, y = mitten; ~28 höga vid s = 1). */
export function julklappar(x, y, s = 1) {
  const paket = (px, w, h, c, band) => `<rect x="${px}" y="${-h}" width="${w}" height="${h}" rx="3" fill="${c}" ${THIN}/>
    <path d="M${px + w / 2} ${-h} L${px + w / 2} 0 M${px} ${f(-h / 2)} L${px + w} ${f(-h / 2)}" stroke="${band}" stroke-width="3.2"/>
    <path d="M${px + w / 2} ${-h} q-7 -8 -9 -1 q4 3 9 1 q7 -8 9 -1 q-4 3 -9 1" fill="${band}" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>`;
  return `<g class="julv-klappar" transform="translate(${f(x)} ${f(y)}) scale(${s})" aria-hidden="true" pointer-events="none">
    <ellipse cx="0" cy="0" rx="40" ry="5" fill="${O}" fill-opacity="0.1"/>
    ${paket(-38, 24, 18, ROD, "#F7C948")}${paket(14, 22, 14, "#F7C948", ROD)}${paket(-14, 26, 26, "#7FB2E3", "#FFF3DC")}</g>`;
}

/** Julbock i halm med röda band (markpunkt x, y; ~100 hög vid s = 1). */
export function julbock(x, y, s = 1) {
  const ben = [-26, -12, 12, 26].map((bx) => limb(`M${bx} -36 L${bx - 2} -2`, HALM, 6)).join("");
  return `<g class="julv-bock" transform="translate(${f(x)} ${f(y)}) scale(${s})" aria-hidden="true" pointer-events="none">
    <ellipse cx="0" cy="0" rx="40" ry="6" fill="${O}" fill-opacity="0.1"/>
    ${ben}
    ${limb("M-34 -46 Q-44 -50 -46 -60", HALM, 5)}
    <path d="M-36 -36 Q-40 -54 -24 -56 L26 -56 Q40 -54 36 -36 Q0 -30 -36 -36 Z" fill="${HALM}" ${LINE}/>
    <path d="M-28 -44 L28 -44 M-26 -50 L24 -50" stroke="${HALM_MORK}" stroke-width="1.6" stroke-opacity="0.6" stroke-linecap="round"/>
    <rect x="-20" y="-57" width="7" height="24" rx="2" fill="${ROD}" ${THIN}/>
    <rect x="12" y="-57" width="7" height="24" rx="2" fill="${ROD}" ${THIN}/>
    ${limb("M26 -50 L36 -78", HALM, 11)}
    <path d="M34 -84 Q24 -108 6 -100" fill="none" stroke="${O}" stroke-width="8.5" stroke-linecap="round"/>
    <path d="M34 -84 Q24 -108 6 -100" fill="none" stroke="${HALM}" stroke-width="5" stroke-linecap="round"/>
    <path d="M40 -84 Q38 -110 20 -108" fill="none" stroke="${O}" stroke-width="8.5" stroke-linecap="round"/>
    <path d="M40 -84 Q38 -110 20 -108" fill="none" stroke="${HALM}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="44" cy="-80" rx="14" ry="9" fill="${HALM}" ${LINE}/>
    <circle cx="46" cy="-83" r="2.2" fill="${O}"/>
    <path d="M28 -66 Q36 -60 42 -68" fill="none" stroke="${ROD}" stroke-width="5" stroke-linecap="round"/>
    <path d="M30 -66 q-8 -6 -9 2 q5 2 9 -2 q2 9 8 4 q-3 -5 -8 -4" fill="${ROD_LJUS}" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/></g>`;
}

/**
 * Tomte som vinkar (markpunkt x, y; ~110 hög vid s = 1): röd luva med tofs,
 * stort skägg, stora ögon. Högerarmen (.julv-vinkarm) vinkar – samma idé som
 * Halloween-djuret på porten (sz-vinkdjur).
 */
export function tomte(x, y, s = 1) {
  return `<g class="julv-tomte" transform="translate(${f(x)} ${f(y)}) scale(${s})" aria-hidden="true" pointer-events="none">
    <ellipse cx="0" cy="0" rx="26" ry="5" fill="${O}" fill-opacity="0.12"/>
    <ellipse cx="-9" cy="-4" rx="9" ry="5.5" fill="#4C4661" ${THIN}/>
    <ellipse cx="9" cy="-4" rx="9" ry="5.5" fill="#4C4661" ${THIN}/>
    ${limb("M-15 -46 Q-25 -34 -23 -24", ROD, 8)}
    <circle cx="-23" cy="-21" r="5.5" fill="#4F8F74" ${THIN}/>
    <path d="M-21 -8 Q-25 -40 -12 -52 L12 -52 Q25 -40 21 -8 Q0 -2 -21 -8 Z" fill="${ROD}" ${LINE}/>
    <path d="M-20 -12 Q0 -6 20 -12" fill="none" stroke="${KRAM}" stroke-width="5" stroke-linecap="round"/>
    <rect x="-21" y="-27" width="42" height="7" rx="3" fill="#4C4661" stroke="none"/>
    <rect x="-5" y="-29" width="10" height="11" rx="2" fill="${GLOD}" ${THIN}/>
    <g class="julv-vinkarm">${limb("M14 -46 Q26 -56 29 -70", ROD, 8)}
      <circle cx="29" cy="-73" r="5.5" fill="#4F8F74" ${THIN}/></g>
    <circle cx="0" cy="-66" r="17" fill="${HUD}" ${LINE}/>
    <path d="M-17 -64 Q-19 -42 0 -38 Q19 -42 17 -64 Q9 -56 0 -58 Q-9 -56 -17 -64 Z" fill="${SKAGG}" ${THIN}/>
    <ellipse cx="-11" cy="-62" rx="3.4" ry="2.2" fill="#FFB1B8"/><ellipse cx="11" cy="-62" rx="3.4" ry="2.2" fill="#FFB1B8"/>
    ${eye(-6, -69, 3.6)}${eye(6, -69, 3.6)}
    <ellipse cx="0" cy="-61" rx="3.8" ry="3.2" fill="#F2938C" ${THIN}/>
    <path d="M-17 -74 Q-14 -98 6 -104 Q22 -108 28 -94 Q18 -96 13 -88 Q15 -80 17 -74 Z" fill="${ROD}" ${LINE}/>
    <rect x="-19" y="-80" width="38" height="9" rx="4.5" fill="${SKAGG}" ${THIN}/>
    <circle cx="29" cy="-92" r="5.5" fill="${SKAGG}" ${THIN}/></g>`;
}

/** Snölykta: snöbollar i pyramid med ett varmt ljus inne (markpunkt x, y; ~46 hög). */
export function snolykta(x, y, s = 1) {
  const boll = (bx, by, r) => `<circle cx="${bx}" cy="${by}" r="${r}" fill="${SNOBOLL}" ${THIN}/>`;
  return `<g class="julv-snolykta" transform="translate(${f(x)} ${f(y)}) scale(${s})" aria-hidden="true" pointer-events="none">
    <ellipse cx="0" cy="-18" rx="27" ry="24" fill="#FFD36B" fill-opacity="0.16" stroke="none"/>
    ${boll(-17, -8, 9)}${boll(17, -8, 9)}${boll(0, -8, 9)}${boll(-9, -23, 8.5)}${boll(9, -23, 8.5)}${boll(0, -37, 8)}
    <ellipse cx="0" cy="-16" rx="5.5" ry="6" fill="${VARMT}" stroke="${O}" stroke-width="1.6"/>
    <ellipse cx="0" cy="-15" rx="2.6" ry="3.4" fill="#F49E4C" stroke="none"/></g>`;
}

/** Granris med röd rosett, mitten (cx, cy), bredd w – lindat runt en pelare. */
export function granris(cx, cy, w) {
  const h = w / 2;
  let barr = "";
  for (let i = 0; i <= 8; i++) {
    const bx = cx - h + (w * i) / 8;
    barr += `M${f(bx - 4)} ${f(cy - 7)} L${f(bx + 3)} ${f(cy + 1)} M${f(bx + 4)} ${f(cy - 6)} L${f(bx - 2)} ${f(cy + 6)} `;
  }
  return `<g class="julv-granris" aria-hidden="true" pointer-events="none">
    <path d="M${f(cx - h - 4)} ${f(cy - 2)} Q${f(cx)} ${f(cy + 16)} ${f(cx + h + 4)} ${f(cy - 2)} Q${f(cx + h + 2)} ${f(cy - 14)} ${f(cx + h - 4)} ${f(cy - 12)} Q${f(cx)} ${f(cy + 2)} ${f(cx - h + 4)} ${f(cy - 12)} Q${f(cx - h - 2)} ${f(cy - 14)} ${f(cx - h - 4)} ${f(cy - 2)} Z" fill="${GRAN}" ${THIN}/>
    <path d="${barr}" stroke="${GRAN_LJUS}" stroke-width="2.4" stroke-linecap="round"/>
    ${rosett(cx, cy + 4, 1)}</g>`;
}

/** Röd rosett (mitten x, y) – på granriset och i lärarspärrens hörn. */
export function rosett(x, y, s = 1) {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">
    <path d="M-2 2 L-9 18 L-4 15 L-1 19 Z M2 2 L9 18 L4 15 L1 19 Z" fill="${ROD}" ${THIN}/>
    <path d="M0 0 Q-16 -12 -16 0 Q-16 9 0 0 Z M0 0 Q16 -12 16 0 Q16 9 0 0 Z" fill="${ROD_LJUS}" ${THIN}/>
    <circle cx="0" cy="0" r="4" fill="${ROD}" ${THIN}/></g>`;
}

/** Kvällshimlens stjärnor (stilla). */
function stjarnor(lista) {
  return lista
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FDF3C8" stroke="none"/>`)
    .join("");
}

/** Mjuk blek måne med gloria (.julv-mane – döljs om Halloween-månen redan står där). */
function mane(x, y, r) {
  return `<g class="julv-mane"><circle cx="${x}" cy="${y}" r="${f(r * 1.7)}" fill="#E4ECFF" fill-opacity="0.14" stroke="none"/>
    <circle cx="${x}" cy="${y}" r="${f(r * 1.3)}" fill="#E4ECFF" fill-opacity="0.16" stroke="none"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#F3EEDB" ${LINE}/>
    <circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.18)}" r="${f(r * 0.15)}" fill="#E2DAC0" stroke="none"/>
    <circle cx="${f(x + r * 0.28)}" cy="${f(y + r * 0.3)}" r="${f(r * 0.11)}" fill="#E2DAC0" stroke="none"/></g>`;
}

/**
 * Stilla norrsken (C.2): tre breda band i grönt och lila med låg opacitet,
 * inga filter och ingen rörelse. `x0..x1` = bredden, `y` = höjden.
 */
export function norrsken(x0, x1, y, k = 1) {
  const w = x1 - x0;
  const band = (dy, amp, c, bredd, op) => {
    let d = `M${f(x0)} ${f(y + dy)}`;
    for (let i = 1; i <= 6; i++) {
      const xa = x0 + (w * (i - 0.5)) / 6;
      const xb = x0 + (w * i) / 6;
      d += ` Q${f(xa)} ${f(y + dy + (i % 2 ? -amp : amp))} ${f(xb)} ${f(y + dy)}`;
    }
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(bredd * k * 2.2)}" stroke-linecap="round" stroke-opacity="${f(op * 0.4)}"/>
      <path d="${d}" fill="none" stroke="${c}" stroke-width="${f(bredd * k)}" stroke-linecap="round" stroke-opacity="${op}"/>`;
  };
  return `<g class="julv-norrsken" aria-hidden="true" pointer-events="none">
    ${band(0, 26 * k, "#7FE0B0", 34, 0.2)}${band(46 * k, 20 * k, "#B79BE0", 28, 0.18)}${band(-38 * k, 16 * k, "#8FE8C8", 20, 0.16)}</g>`;
}

/**
 * Julen på elevernas port (viewBox 960×600, art-port-majestic.js). `bak` läggs
 * direkt efter himlen (bakom moln, kullar och träd), `fram` sist i scenen.
 * Allt står RUNT login-skylten (x≈340–620, y≈230–460) – aldrig bakom text.
 * @returns {{bak:string, fram:string}}
 */
export function portJul() {
  const bak = `<g class="julv-dekor julv-port-bak">${norrsken(-600, 1560, 150, 1.2)}
    ${stjarnor([[260, 40, 2.4], [330, 120, 1.6], [420, 60, 2], [540, 30, 1.6], [600, 110, 2.4], [700, 56, 1.8], [780, 150, 2],
      [860, 70, 2.4], [920, 180, 1.6], [40, 210, 2], [220, 180, 1.6], [660, 200, 1.6], [990, 90, 2], [-40, 80, 2.2], [1060, 200, 1.6]])}
    ${mane(96, 92, 30)}</g>`;
  // Ljusslingan i grindens båge: längs bågens undersida (Q 253,152 → 480,84 → 707,152).
  const bage = [];
  for (let i = 0; i <= 40; i++) {
    const t = 0.03 + (0.94 * i) / 40;
    const mt = 1 - t;
    bage.push([mt * mt * 253 + 2 * mt * t * 480 + t * t * 707, mt * mt * 152 + 2 * mt * t * 84 + t * t * 152 + 3]);
  }
  const fram = `<g class="julv-dekor julv-port-fram">
    ${ljusslinga(langsLinje(bage, 30), { r: 6.5, sag: 5 })}
    ${granris(195, 158, 74)}${granris(765, 158, 74)}
    ${snolykta(282, 598, 1)}${snolykta(336, 552, 0.78)}${snolykta(678, 598, 1)}${snolykta(624, 552, 0.78)}
    ${julgran(838, 552, 1.02)}${julklappar(838, 562, 0.9)}
    ${tomte(222, 580, 1)}</g>`;
  return { bak, fram };
}

/**
 * Julen i lärarspärren (C.3, inuti .sz-gate-svg, viewBox 1200×700 slice):
 * kvällshimmel med stjärnor, måne och norrsken, granris i övre hörnen, en
 * snölykta och en tomte som vinkar. Panelen i mitten är oförändrad.
 */
export function gateJul() {
  const hornRis = (x, dir) => {
    let s = "";
    for (const [dx, dy, l, v] of [[0, 110, 150, 18], [0, 160, 120, 32], [40, 80, 110, 58], [0, 220, 80, 10]]) {
      const x0 = x + dx * dir;
      const x1 = x0 + l * Math.cos((v * Math.PI) / 180) * dir;
      const y1 = dy + l * Math.sin((v * Math.PI) / 180);
      s += `<path d="M${f(x0)} ${dy} L${f(x1)} ${f(y1)}" stroke="${O}" stroke-width="14" stroke-linecap="round"/>
        <path d="M${f(x0)} ${dy} L${f(x1)} ${f(y1)}" stroke="${GRAN}" stroke-width="9" stroke-linecap="round"/>`;
      for (let i = 1; i <= 6; i++) {
        const t = i / 7;
        const px = x0 + (x1 - x0) * t;
        const py = dy + (y1 - dy) * t;
        s += `<path d="M${f(px)} ${f(py)} l${f(-9 * dir)} ${f(10)} M${f(px)} ${f(py)} l${f(10 * dir)} ${f(7)}" stroke="${GRAN_LJUS}" stroke-width="4" stroke-linecap="round"/>`;
      }
    }
    return s;
  };
  return `<g class="julv-dekor julv-gate">${norrsken(-200, 1400, 130, 1)}
    ${stjarnor([[120, 230, 2.4], [300, 150, 1.8], [420, 60, 2.4], [560, 110, 1.6], [680, 40, 2], [800, 120, 2.4], [900, 220, 1.6],
      [980, 60, 2], [1150, 250, 1.8], [60, 320, 1.6], [1120, 340, 2]])}
    ${mane(1000, 110, 40)}
    <g class="julv-granris">${hornRis(-10, 1)}${hornRis(1210, -1)}</g>
    ${rosett(70, 150, 1.7)}${rosett(1130, 150, 1.7)}
    <circle cx="96" cy="230" r="9" fill="${ROD}" ${THIN}/><circle cx="1104" cy="230" r="9" fill="#F7C948" ${THIN}/>
    ${snolykta(150, 676, 2)}${tomte(1050, 690, 1.6)}</g>`;
}

/**
 * Ljusslingan i rumsfönstrets båge (art-room.js, viewBox 252×240): två mjuka
 * bågar längs fönstrets överkant, framför ramen.
 */
export function fonsterJul() {
  const linje = [];
  for (let x = 18; x <= 234; x += 4) linje.push([x, 16 + 12 * Math.sin((Math.PI * (x - 18)) / 108) ** 2]);
  return `<g class="julv-dekor julv-fonster">${ljusslinga(langsLinje(linje, 21), { r: 5.4, sag: 3 })}</g>`;
}
