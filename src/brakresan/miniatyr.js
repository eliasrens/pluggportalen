// ============================================================================
// Bråkresan – listkortens miniatyrer (src/brakresan/miniatyr.js) · #713 H
// ----------------------------------------------------------------------------
// Spec §11: varje kort har en "egen relevant miniatyr av matematiken". En
// liten, statisk SVG per utmaning (80 × 60) i komponentbibliotekets bildspråk
// – stav, cirkel, rutnät, hundraruta, tallinje, mängd, kort, bråknotation –
// men ritad som ren text här, så att listan med 50 kort inte laddar
// komponentbiblioteket. Bilden är dekor (aria-hidden): kortets namn och
// målmening bär informationen.
//
//   miniatyrSvg(id) → "<svg …>…</svg>"   (all text kommer ur tabellen nedan)
// ============================================================================

const T = "#13a39a"; // markerad del (turkos)
const L = "#dff5f2"; // omarkerad del
const K = "#3b3350"; // kontur
const V = "#9b51e0"; // andra färgen (lila)
const G = "#e8a915"; // guld
const r = (x) => Math.round(x * 10) / 10;

/** Stav: `parts` lika delar, de första `marked` turkosa. */
function stav(x, y, w, hh, parts, marked, { fill = T, streckad = false } = {}) {
  let o = "";
  for (let i = 0; i < parts; i++) {
    const px = x + (w * i) / parts;
    const dash = streckad && i >= marked ? ' stroke-dasharray="2 2"' : "";
    const f = i < marked ? fill : streckad ? "#fff" : L;
    o += `<rect x="${r(px)}" y="${y}" width="${r(w / parts)}" height="${hh}" fill="${f}" stroke="${K}" stroke-width="1"${dash}/>`;
  }
  return o;
}

/** Cirkel: `parts` lika sektorer medurs från klockan 12, de första `marked` fyllda. */
function cirkel(cx, cy, rad, parts, marked, fill = T) {
  if (parts === 1) return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${marked ? fill : L}" stroke="${K}"/>`;
  let o = "";
  for (let i = 0; i < parts; i++) {
    const a0 = (i / parts) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / parts) * 2 * Math.PI - Math.PI / 2;
    const p = (a) => `${r(cx + rad * Math.cos(a))} ${r(cy + rad * Math.sin(a))}`;
    o += `<path d="M${cx} ${cy}L${p(a0)}A${rad} ${rad} 0 0 1 ${p(a1)}Z" fill="${i < marked ? fill : L}" stroke="${K}" stroke-width="1"/>`;
  }
  return o;
}

/** Rutnät rows × cols, de första `marked` cellerna (rad för rad) fyllda. */
function rutnat(x, y, w, hh, rows, cols, marked) {
  let o = "";
  for (let i = 0; i < rows * cols; i++) {
    const cx = x + (w / cols) * (i % cols), cy = y + (hh / rows) * Math.floor(i / cols);
    o += `<rect x="${r(cx)}" y="${r(cy)}" width="${r(w / cols)}" height="${r(hh / rows)}" fill="${i < marked ? T : L}" stroke="${K}" stroke-width=".8"/>`;
  }
  return o;
}

/** Hundraruta: 10 × 10, `marked` celler kolumnvis (tiondelar = hela kolumner). */
function hundra(x, y, sz, marked) {
  const c = sz / 10;
  let o = `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" fill="${L}" stroke="${K}"/>`;
  for (let i = 0; i < marked; i++) {
    o += `<rect x="${r(x + c * Math.floor(i / 10))}" y="${r(y + c * (i % 10))}" width="${r(c)}" height="${r(c)}" fill="${T}"/>`;
  }
  for (let i = 1; i < 10; i++) {
    o += `<path d="M${r(x + c * i)} ${y}v${sz}M${x} ${r(y + c * i)}h${sz}" stroke="${K}" stroke-width=".35"/>`;
  }
  return o;
}

/** Tallinje 0–1 (eller 0–max) med `ticks` delar och punkter [{ v, fill }]. */
function tallinje(x, y, w, ticks, punkter = [], { max = 1, etiketter = true } = {}) {
  let o = `<path d="M${x} ${y}h${w}" stroke="${K}" stroke-width="1.6"/>`;
  for (let i = 0; i <= ticks; i++) {
    const tx = x + (w * i) / ticks, hel = (i * max) % ticks === 0;
    o += `<path d="M${r(tx)} ${y - (hel ? 5 : 3)}v${hel ? 10 : 6}" stroke="${K}" stroke-width="${hel ? 1.6 : 1}"/>`;
    if (etiketter && hel) o += txt(tx, y + 14, String((i * max) / ticks), 8);
  }
  for (const p of punkter) {
    o += `<circle cx="${r(x + (w * p.v) / max)}" cy="${y}" r="3.6" fill="${p.fill || T}" stroke="${K}"/>`;
  }
  return o;
}

/** Mängd: `count` kulor i rader om `cols`, de första `marked` fyllda. */
function mangd(x, y, count, marked, cols, d = 9) {
  let o = "";
  for (let i = 0; i < count; i++) {
    const cx = x + (i % cols) * d + d / 2, cy = y + Math.floor(i / cols) * d + d / 2;
    o += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(d * 0.38)}" fill="${i < marked ? T : L}" stroke="${K}" stroke-width=".9"/>`;
  }
  return o;
}

function txt(x, y, s, size = 11, fill = K, weight = 700) {
  return `<text x="${r(x)}" y="${r(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" ` +
    `font-family="system-ui, sans-serif">${s}</text>`;
}

/** Bråk med vågrätt bråkstreck, mitten i (x, y). */
function brak(x, y, n, d, size = 11, fill = K) {
  const w = Math.max(String(n).length, String(d).length) * size * 0.62 + 3;
  return txt(x, y - 2, n, size, fill) + `<path d="M${r(x - w / 2)} ${y + 1.5}h${r(w)}" stroke="${fill}" stroke-width="1.3"/>` +
    txt(x, y + size + 2, d, size, fill);
}

/** Ett kort (rundad ram) med innehållet `inre`. */
function kort(x, y, w, hh, inre, { ram = K, bg = "#fff" } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="4" fill="${bg}" stroke="${ram}" stroke-width="1.2"/>${inre}`;
}

// Tabellen: utmanings-id → innehåll i en ruta 80 × 60.
const BILD = {
  // Lika delar (stav överst) bredvid olika stora delar (streckad ram = "inte fjärdedelar").
  "01": () => cirkel(22, 30, 18, 4, 1) + stav(46, 12, 30, 12, 4, 1) +
    `<rect x="46" y="34" width="6" height="12" fill="${T}" stroke="${K}"/><rect x="52" y="34" width="16" height="12" fill="${L}" stroke="${K}"/>` +
    `<rect x="68" y="34" width="8" height="12" fill="${L}" stroke="${K}"/><rect x="44" y="32" width="34" height="16" fill="none" stroke="${V}" stroke-dasharray="2 2"/>`,
  "02": () => cirkel(26, 30, 20, 5, 2) + txt(62, 36, "?", 20, V),
  "03": () => rutnat(8, 10, 64, 40, 2, 4, 3),
  "04": () => kort(6, 10, 30, 40, brak(21, 26, 3, 4, 12)) + txt(58, 28, "tre", 10, V) + txt(58, 41, "fjärde-", 9, V) + txt(58, 51, "delar", 9, V),
  "05": () => stav(6, 22, 68, 16, 4, 1, { streckad: true }) + brak(15, 8, 1, 4, 7) + txt(48, 56, "= 1 hel?", 9, V),
  "06": () => kort(2, 12, 24, 36, cirkel(14, 30, 9, 2, 1)) + kort(28, 12, 24, 36, stav(31, 25, 18, 10, 2, 1)) + kort(54, 12, 24, 36, brak(66, 26, 1, 2, 10)),
  "07": () => mangd(10, 12, 12, 4, 6, 10),
  "08": () => kort(2, 12, 24, 36, cirkel(14, 30, 9, 2, 1)) + kort(28, 12, 24, 36, brak(40, 26, 2, 4, 10)) +
    kort(54, 12, 24, 36, cirkel(66, 30, 9, 3, 1), { ram: V }) + txt(66, 9, "?", 10, V),
  "09": () => stav(8, 12, 52, 12, 3, 2) + stav(8, 34, 52, 12, 5, 3) + txt(70, 34, "?", 16, V),
  "10": () => cirkel(30, 30, 22, 8, 3, G) + txt(66, 36, "?", 16, V),
  "11": () => stav(8, 12, 64, 13, 2, 1) + stav(8, 34, 64, 13, 4, 2),
  "12": () => kort(2, 12, 24, 36, brak(14, 26, 2, 3)) + kort(28, 12, 24, 36, brak(40, 26, 4, 6)) + kort(54, 12, 24, 36, brak(66, 26, 6, 9)),
  "13": () => stav(8, 10, 64, 13, 3, 1) + stav(8, 34, 64, 13, 6, 2),
  "14": () => brak(18, 26, 2, 3, 13) + txt(36, 36, "=", 14) + brak(56, 26, "?", 12, 13, V),
  "15": () => kort(4, 8, 32, 46, brak(14, 22, 1, 2, 9) + brak(27, 38, 2, 4, 9)) + kort(44, 8, 32, 46, brak(54, 22, 1, 3, 9) + brak(67, 38, 3, 9, 9), { ram: V }),
  "16": () => stav(8, 12, 56, 12, 5, 2) + stav(8, 34, 56, 12, 5, 4) + txt(73, 32, "?", 14, V),
  "17": () => stav(8, 12, 56, 12, 3, 1) + stav(8, 34, 56, 12, 6, 1) + txt(73, 32, "?", 14, V),
  "18": () => tallinje(8, 32, 64, 4, [{ v: 0.25, fill: L }, { v: 0.5, fill: V }, { v: 0.75, fill: L }]) + txt(40, 16, "?", 12, V),
  "19": () => tallinje(8, 36, 64, 4, [{ v: 0.75 }]) + brak(56, 10, 3, 4, 9),
  "20": () => mangd(8, 10, 12, 4, 6, 11) + txt(40, 54, "en tredjedel", 9, V),
  "21": () => brak(16, 18, 6, 8, 12) + txt(32, 28, "=", 13) + brak(48, 18, 3, 4, 12, T) + stav(8, 48, 64, 7, 4, 3),
  "22": () => brak(18, 24, 3, "?", 13, V) + txt(37, 34, "=", 13) + brak(58, 24, 6, 8, 13),
  "23": () => kort(2, 12, 24, 36, brak(14, 26, 1, 4, 10)) + kort(28, 12, 24, 36, mangd(31, 21, 4, 1, 2, 9)) + kort(54, 12, 24, 36, stav(57, 25, 18, 10, 4, 1)),
  "24": () => tallinje(8, 34, 64, 2, [{ v: 0.3, fill: L }, { v: 0.5, fill: V }, { v: 0.8, fill: L }]) + brak(40, 10, 1, 2, 8, V),
  "25": () => stav(8, 12, 56, 12, 3, 2) + stav(8, 34, 56, 12, 4, 3) + txt(73, 32, "?", 14, V),
  "26": () => kort(4, 30, 20, 22, brak(14, 38, 1, 4, 8)) + kort(30, 20, 20, 32, brak(40, 33, 1, 2, 8)) + kort(56, 10, 20, 42, brak(66, 28, 3, 4, 8)),
  "27": () => cirkel(20, 30, 16, 4, 4) + cirkel(56, 30, 16, 4, 1),
  "28": () => brak(14, 24, 7, 4, 12) + txt(29, 34, "=", 13) + txt(45, 40, "1", 18, T) + brak(61, 24, 3, 4, 12, T),
  "29": () => mangd(12, 14, 8, 6, 4, 14),
  "30": () => stav(6, 20, 68, 18, 3, 1, { fill: G }) + txt(52, 52, "kvar?", 10, V),
  "31": () => stav(6, 8, 68, 11, 5, 3) + brak(16, 34, 1, 5, 10) + txt(30, 42, "+", 12) + brak(44, 34, 2, 5, 10) + txt(60, 42, "= ?", 10, V),
  "32": () => stav(6, 8, 68, 11, 5, 4) + brak(16, 34, 4, 5, 10) + txt(30, 42, "−", 12) + brak(44, 34, 1, 5, 10) + txt(60, 42, "= ?", 10, V),
  "33": () => brak(10, 24, 1, 2, 10) + txt(22, 33, "+", 11) + brak(34, 24, 1, 3, 10) + txt(46, 33, "=", 11) + brak(58, 24, 2, 5, 10, V) +
    `<path d="M50 18l18 22M68 18L50 40" stroke="${G}" stroke-width="2.4"/>`,
  "34": () => brak(16, 24, 1, 2, 12) + txt(32, 34, "+", 13) + brak(48, 24, 1, 4, 12) + txt(66, 34, "= ?", 10, V),
  "35": () => brak(16, 24, 3, 4, 12) + txt(32, 34, "−", 13) + brak(48, 24, 1, 2, 12) + txt(66, 34, "= ?", 10, V),
  "36": () => stav(4, 12, 34, 14, 4, 4) + stav(42, 12, 34, 14, 4, 1) + brak(26, 44, 3, 4, 8) + txt(40, 51, "+", 10) + brak(54, 44, 2, 4, 8),
  "37": () => txt(12, 34, "3", 15) + txt(24, 33, "·", 15) + brak(36, 24, 2, 5, 12) + stav(50, 22, 26, 14, 5, 2),
  "38": () => rutnat(14, 6, 52, 48, 3, 4, 0) + `<rect x="14" y="6" width="26" height="48" fill="${V}" opacity=".35"/>` +
    `<rect x="14" y="6" width="52" height="32" fill="${T}" opacity=".5"/><rect x="14" y="6" width="52" height="48" fill="none" stroke="${K}" stroke-width="1.4"/>`,
  "39": () => hundra(8, 6, 48, 37) + txt(68, 36, "0,37", 9, V),
  "40": () => brak(16, 24, 1, 4, 12) + txt(32, 34, "=", 13) + txt(56, 35, "0,25", 13, T),
  "41": () => hundra(8, 6, 48, 40) + txt(68, 36, "40 %", 9, V),
  "42": () => brak(10, 24, 1, 2, 11) + txt(20, 34, "=", 10) + txt(34, 34, "0,5", 11, T) + txt(46, 34, "=", 10) + txt(64, 34, "50 %", 10, V),
  "43": () => kort(2, 12, 24, 36, txt(14, 34, "0,25", 9)) + kort(28, 12, 24, 36, brak(40, 26, 1, 4, 10)) + kort(54, 12, 24, 36, txt(66, 34, "40 %", 9), { ram: V }),
  "44": () => txt(40, 26, "25 % av 80", 11) + stav(8, 36, 64, 14, 4, 1),
  "45": () => mangd(4, 16, 10, 3, 10, 7.2) + txt(40, 46, "? %", 13, V),
  "46": () => txt(12, 26, "0,3", 10) + txt(25, 26, "<", 10) + brak(38, 16, 1, 3, 9) + txt(51, 26, "<", 10) + txt(67, 26, "35 %", 9, V) +
    tallinje(8, 46, 64, 10, [{ v: 0.3, fill: L }, { v: 0.35, fill: V }], { etiketter: false }),
  "47": () => stav(6, 12, 68, 14, 3, 2) + `<path d="M${r(6 + 68 / 3 * 2 / 2)} 8v22" stroke="${V}" stroke-width="2" stroke-dasharray="3 2"/>` +
    brak(20, 42, 2, 3, 9) + txt(36, 51, "÷ 2", 10, V),
  "48": () => stav(6, 12, 68, 14, 4, 0) + [0, 1, 2, 3].map((i) => `<path d="M${r(8 + i * 17)} 32q7.5 6 15 0" fill="none" stroke="${V}" stroke-width="1.6"/>`).join("") +
    txt(20, 54, "1 ÷", 10) + brak(38, 46, 1, 4, 8),
  "49": () => `<path d="M14 14h38l14 16-14 16H14z" fill="${G}" stroke="${K}"/><circle cx="60" cy="30" r="3" fill="#fff" stroke="${K}"/>` + txt(32, 35, "−20 %", 12),
  "50": () => stav(6, 8, 30, 12, 3, 1) + mangd(44, 6, 6, 2, 3, 10) + txt(22, 48, "%", 15, V) + txt(50, 50, "?!", 18, G),
};

/** SVG-markup för utmaningens miniatyr (dekor, aria-hidden). */
export function miniatyrSvg(id) {
  const rita = BILD[id];
  return `<svg class="brh-mini" viewBox="0 0 80 60" aria-hidden="true" focusable="false">${rita ? rita() : ""}</svg>`;
}

export const MINIATYR_IDS = Object.freeze(Object.keys(BILD));
