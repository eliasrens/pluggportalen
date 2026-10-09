// ============================================================================
// Pluggporten – HTML/CSS → SVG-primitiver för världsspeglingen (#416, F2/#396)
// ----------------------------------------------------------------------------
// Hjälpare till varld-spegel.js (regel 3–4 och 7 i docs/pixi-arkitektur-396.md
// §2.3b). Allt här läser BARA computed style och layout, ändrar aldrig DOM:en:
//   • matriser: CSS-transformens linjära del + elementets layout-box (så att
//     t.ex. "Du!"-brickans rotate(6deg) och tomternas translate(-50%,-50%) blir
//     exakta – även i ett lager som just står i scale(1/zoom)),
//   • box-dekoration: bakgrund (färg + linear-gradient), border, border-radius,
//     box-shadow och outline → <rect>/<linearGradient>/<filter>,
//   • CSS-filter (drop-shadow/grayscale/brightness/saturate/…) → SVG-<filter>,
//   (HTML-text → <text> ligger i systermodulen varld-spegel-text.js.)
// Laddas bara via import() från varld-spegel.js (aldrig i bootgrafen).
// ============================================================================

const f = (n) => (Math.round(n * 1000) / 1000).toString();

/** XML-escape för text och attributvärden. */
export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/** transform-attribut för en matris (tom sträng för identitet). */
export function matrisAttr(m) {
  if (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0) return "";
  return ` transform="matrix(${f(m.a)} ${f(m.b)} ${f(m.c)} ${f(m.d)} ${f(m.e)} ${f(m.f)})"`;
}

// --- Färger ----------------------------------------------------------------
let ritKtx = null;
const ktx = () => (ritKtx ||= document.createElement("canvas").getContext("2d"));
const fargCache = new Map();

/**
 * Normalisera en CSS-färg (color-mix(), color(srgb …), oklch …) till något
 * SVG-som-bild garanterat förstår (#rrggbb / rgba()). Canvas gör jobbet.
 */
export function farg(s) {
  if (!s) return "none";
  let v = fargCache.get(s);
  if (v == null) {
    const k = ktx();
    k.fillStyle = "#000";
    k.fillStyle = s;
    v = k.fillStyle;
    // Canvas behåller färgrymden för color(srgb …) (t.ex. computed color-mix) –
    // skriv om till rgba() så SVG-som-bild garanterat förstår den.
    const c = /^color\(srgb(?:-linear)?\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+%?))?\)$/.exec(v);
    if (c) {
      const k8 = (x) => Math.round(Math.min(1, Math.max(0, +x)) * 255);
      const a = c[4] == null ? 1 : c[4].endsWith("%") ? parseFloat(c[4]) / 100 : +c[4];
      v = a >= 1 ? `rgb(${k8(c[1])}, ${k8(c[2])}, ${k8(c[3])})` : `rgba(${k8(c[1])}, ${k8(c[2])}, ${k8(c[3])}, ${a})`;
    }
    fargCache.set(s, v);
  }
  return v;
}

export const genomskinlig = (s) => !s || s === "transparent" || /rgba\([^)]*,\s*0\)$/.test(farg(s));

// --- Parsning ----------------------------------------------------------------
/** Dela på komman på toppnivå (inte inne i parenteser). */
export function delaKomma(s) {
  const ut = [];
  let djup = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") djup++;
    else if (c === ")") djup--;
    else if (c === "," && djup === 0) { ut.push(s.slice(start, i).trim()); start = i + 1; }
  }
  ut.push(s.slice(start).trim());
  return ut.filter(Boolean);
}

const FARG_RE = /^([a-z-]+\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]+|[a-z]+)\s*/i;

/** "rgba(0, 0, 0, 0.2) 0px 1px 2px 0px [inset]" → skugga (computed-format). */
export function tolkaSkugga(s) {
  let rest = s.trim();
  let farge = "rgba(0, 0, 0, 1)";
  const m = FARG_RE.exec(rest);
  if (m && !/^-?[\d.]/.test(m[1])) { farge = m[1]; rest = rest.slice(m[0].length); }
  const inset = /\binset\b/.test(rest);
  const tal = (rest.match(/-?[\d.]+(?:px)?/g) || []).map(parseFloat);
  return { farg: farge, x: tal[0] || 0, y: tal[1] || 0, blur: tal[2] || 0, spread: tal[3] || 0, inset };
}

// --- Matriser ----------------------------------------------------------------
/** Delad identitet – de flesta element saknar transform (ingen allokering då). */
export const IDENTITET = typeof DOMMatrix === "function" ? new DOMMatrix() : null; // muteras aldrig

/** "matrix(a, b, c, d, e, f)" (computed-format) → [a, b, c, d]; matrix3d/annat via DOMMatrix. */
function tolkaMatris(t) {
  if (t.startsWith("matrix(")) {
    const v = t.slice(7, -1).split(",");
    return new DOMMatrix([+v[0], +v[1], +v[2], +v[3], 0, 0]);
  }
  const m = new DOMMatrix(t);
  m.e = 0; m.f = 0;
  return m;
}

/** Linjära delen (a b c d) av elementets EGEN CSS-transform (inkl. rotate/scale-egenskaperna). */
export function linjar(cs) {
  const t = cs.transform, rot = cs.rotate, sk = cs.scale;
  const utanRot = !rot || rot === "none", utanSk = !sk || sk === "none";
  if (utanRot && utanSk) return !t || t === "none" ? IDENTITET : tolkaMatris(t);
  const m = new DOMMatrix();
  if (!utanRot) {
    const deg = /(-?[\d.]+)deg/.exec(rot);
    if (deg) m.rotateSelf(parseFloat(deg[1]));
  }
  if (!utanSk) {
    const [sx, sy = sx] = sk.split(/\s+/).map(parseFloat);
    m.scaleSelf(sx, sy);
  }
  if (t && t !== "none") m.multiplySelf(tolkaMatris(t));
  m.e = 0; m.f = 0;
  return m;
}

const px = (v) => parseFloat(v) || 0;

/**
 * Elementets border-box-storlek i egna (otransformerade) px. Snabbväg: när
 * kedjans linjära del är en ren skalning är storleken bara bounding boxen
 * delad med skalan (inga computed-läsningar). Rotation → computed width/height.
 */
export function boxStorlek(el, cs, rect, L) {
  if (rect && L.b === 0 && L.c === 0 && L.a > 0 && L.d > 0) return { w: rect.width / L.a, h: rect.height / L.d };
  let w = parseFloat(cs.width), h = parseFloat(cs.height);
  if (Number.isFinite(w) && Number.isFinite(h)) {
    if (cs.boxSizing !== "border-box") {
      w += px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
      h += px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    }
    return { w, h };
  }
  return { w: el.offsetWidth || 0, h: el.offsetHeight || 0 };
}

/**
 * Matris box-lokala px → viewport för ett element: mitten av dess bounding box
 * är bilden av boxens mitt (gäller alla affina avbildningar av en rektangel),
 * och den linjära delen är produkten av alla transformer i kedjan (L).
 * M = translate(mitt) · L · translate(-w/2, -h/2).
 */
export function boxMatris(rect, L, w, h) {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  return new DOMMatrix([L.a, L.b, L.c, L.d, cx - (L.a * w + L.c * h) / 2, cy - (L.b * w + L.d * h) / 2]);
}

/** Linjära delen av alla CSS-transformer från dokumentroten ned till och med `el`. */
export function kedjaLinjar(el) {
  let L = new DOMMatrix();
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const egen = linjar(getComputedStyle(e));
    if (egen !== IDENTITET) L = egen.multiply(L);
  }
  return L;
}

/** Matris box-px → viewport för ett HTML-element (+ dess storlek). */
export function elementRam(el, cs, Lforalder) {
  const egen = linjar(cs);
  const L = egen === IDENTITET ? Lforalder : Lforalder.multiply(egen);
  const rect = el.getBoundingClientRect();
  const { w, h } = boxStorlek(el, cs, rect, L);
  return { M: boxMatris(rect, L, w, h), L, w, h };
}

// --- Radie, filter, gradient ------------------------------------------------
/** border-radius (övre vänstra hörnet, som gäller alla i scenerna) klampad som i CSS. */
export function radie(cs, w, h) {
  const v = cs.borderTopLeftRadius;
  if (!v || v === "0px") return null;
  const [a, b = a] = v.split(/\s+/);
  const ta = (s, ref) => (s.endsWith("%") ? (parseFloat(s) / 100) * ref : parseFloat(s) || 0);
  let rx = ta(a, w), ry = ta(b, h);
  // CSS skalar ned alla radier proportionellt när de inte får plats (999px-piller).
  const k = Math.min(1, w / (2 * rx || 1), h / (2 * ry || 1));
  rx *= k; ry *= k;
  return rx > 0 && ry > 0 ? { rx, ry } : null;
}

const GRAY = (a) => {
  const t = 1 - a;
  return [0.2126 + 0.7874 * t, 0.7152 - 0.7152 * t, 0.0722 - 0.0722 * t, 0, 0,
    0.2126 - 0.2126 * t, 0.7152 + 0.2848 * t, 0.0722 - 0.0722 * t, 0, 0,
    0.2126 - 0.2126 * t, 0.7152 - 0.7152 * t, 0.0722 + 0.9278 * t, 0, 0, 0, 0, 0, 1, 0].join(" ");
};
const SEPIA = (a) => {
  const t = 1 - a;
  return [0.393 + 0.607 * t, 0.769 - 0.769 * t, 0.189 - 0.189 * t, 0, 0,
    0.349 - 0.349 * t, 0.686 + 0.314 * t, 0.168 - 0.168 * t, 0, 0,
    0.272 - 0.272 * t, 0.534 - 0.534 * t, 0.131 + 0.869 * t, 0, 0, 0, 0, 0, 1, 0].join(" ");
};
const linjarRGB = (slope, icpt = 0) =>
  ["R", "G", "B"].map((c) => `<feFunc${c} type="linear" slope="${f(slope)}" intercept="${f(icpt)}"/>`).join("");

/** Färg → [färg utan alfa, alfa] för flood-color/flood-opacity. */
function delaAlfa(s) {
  const v = farg(s);
  const m = /rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/.exec(v);
  return m ? [`rgb(${m[1]},${m[2]},${m[3]})`, parseFloat(m[4])] : [v, 1];
}

/** En drop-shadow-primitiv (CSS-blur = 2·stdDeviation). */
export function dropPrimitiv(sk) {
  const [fc, fo] = delaAlfa(sk.farg);
  return `<feDropShadow dx="${f(sk.x)}" dy="${f(sk.y)}" stdDeviation="${f(sk.blur / 2)}" flood-color="${fc}" flood-opacity="${f(fo)}"/>`;
}

/**
 * CSS-filter (computed) → innehållet i ett SVG-<filter> (kedjade primitiver,
 * var och en tar förra resultatet). null om inget att göra.
 */
export function filterPrimitiver(css) {
  if (!css || css === "none") return null;
  const ut = [];
  const re = /([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/g;
  let m;
  while ((m = re.exec(css))) {
    const [, fn, arg] = m;
    const n = arg.trim().endsWith("%") ? parseFloat(arg) / 100 : parseFloat(arg);
    const tal = Number.isFinite(n) ? n : 1;
    if (fn === "drop-shadow") ut.push(dropPrimitiv(tolkaSkugga(arg)));
    else if (fn === "grayscale") ut.push(`<feColorMatrix type="matrix" values="${GRAY(Math.min(1, tal))}"/>`);
    else if (fn === "sepia") ut.push(`<feColorMatrix type="matrix" values="${SEPIA(Math.min(1, tal))}"/>`);
    else if (fn === "saturate") ut.push(`<feColorMatrix type="saturate" values="${f(tal)}"/>`);
    else if (fn === "hue-rotate") ut.push(`<feColorMatrix type="hueRotate" values="${f(parseFloat(arg) || 0)}"/>`);
    else if (fn === "brightness") ut.push(`<feComponentTransfer>${linjarRGB(tal)}</feComponentTransfer>`);
    else if (fn === "contrast") ut.push(`<feComponentTransfer>${linjarRGB(tal, 0.5 - 0.5 * tal)}</feComponentTransfer>`);
    else if (fn === "invert") ut.push(`<feComponentTransfer>${linjarRGB(1 - 2 * tal, tal)}</feComponentTransfer>`);
    else if (fn === "opacity") ut.push(`<feComponentTransfer><feFuncA type="linear" slope="${f(tal)}"/></feComponentTransfer>`);
    else if (fn === "blur") ut.push(`<feGaussianBlur stdDeviation="${f(parseFloat(arg) || 0)}"/>`);
  }
  return ut.length ? ut.join("") : null;
}

/**
 * linear-gradient(…) (computed) → <linearGradient> i box-koordinater (userSpaceOnUse).
 * Stöder "to <sida/hörn>", vinklar och färgstopp i % eller px (även hårda stopp).
 */
export function linjarGradient(css, id, w, h) {
  const inre = /^linear-gradient\((.*)\)$/s.exec(css.trim())?.[1];
  if (!inre) return null;
  const delar = delaKomma(inre);
  let dx = 0, dy = 1; // "to bottom"
  const forsta = delar[0];
  if (/^to\s/.test(forsta)) {
    const sx = /right/.test(forsta) ? 1 : /left/.test(forsta) ? -1 : 0;
    const sy = /bottom/.test(forsta) ? 1 : /top/.test(forsta) ? -1 : 0;
    // Hörn: vinkelrätt mot diagonalen mellan de två andra hörnen (CSS-regeln).
    [dx, dy] = sx && sy ? [sx * h, sy * w] : [sx, sy];
    delar.shift();
  } else if (/^-?[\d.]+(deg|turn|rad|grad)$/.test(forsta)) {
    let a = parseFloat(forsta);
    if (forsta.endsWith("turn")) a *= 360;
    else if (forsta.endsWith("rad")) a *= 180 / Math.PI;
    else if (forsta.endsWith("grad")) a *= 0.9;
    const r = (a * Math.PI) / 180;
    [dx, dy] = [Math.sin(r), -Math.cos(r)];
    delar.shift();
  }
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const L = Math.abs(w * dx) + Math.abs(h * dy);
  const x1 = w / 2 - (dx * L) / 2, y1 = h / 2 - (dy * L) / 2;
  const x2 = w / 2 + (dx * L) / 2, y2 = h / 2 + (dy * L) / 2;
  // Färgstopp: "färg [pos [pos2]]" → platta ut till {farg, pos|null}.
  const stopp = [];
  for (const d of delar) {
    const m = FARG_RE.exec(d);
    if (!m) continue;
    const pos = d.slice(m[0].length).trim().split(/\s+/).filter(Boolean)
      .map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p) / (L || 1)));
    if (!pos.length) stopp.push({ farg: m[1], pos: null });
    for (const p of pos) stopp.push({ farg: m[1], pos: p });
  }
  if (!stopp.length) return null;
  if (stopp[0].pos == null) stopp[0].pos = 0;
  if (stopp[stopp.length - 1].pos == null) stopp[stopp.length - 1].pos = 1;
  // Saknade positioner fördelas jämnt; positioner får aldrig gå bakåt.
  for (let i = 1; i < stopp.length; i++) {
    if (stopp[i].pos == null) {
      let j = i;
      while (stopp[j].pos == null) j++;
      const a = stopp[i - 1].pos, b = stopp[j].pos;
      for (let k = i; k < j; k++) stopp[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
    }
    stopp[i].pos = Math.max(stopp[i].pos, stopp[i - 1].pos);
  }
  const stops = stopp.map((s) => {
    const [fc, fo] = delaAlfa(s.farg);
    return `<stop offset="${f(s.pos)}" stop-color="${fc}"${fo < 1 ? ` stop-opacity="${f(fo)}"` : ""}/>`;
  }).join("");
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}">${stops}</linearGradient>`;
}

// --- Box-dekoration -----------------------------------------------------------
/**
 * Bakgrund, gradient, border och box-shadow för en box (w×h, lokala px) under
 * innehållet. `ktxDefs.def(nyckel, (id) => markup)` registrerar en <defs>-post.
 * @returns {{under:string, over:string}} over = outline (ritas ovanpå innehållet)
 */
export function dekoration(cs, w, h, ktxDefs) {
  const r = radie(cs, w, h);
  const rr = (k = 0) => (r ? ` rx="${f(Math.max(0, r.rx + k))}" ry="${f(Math.max(0, r.ry + k))}"` : "");
  let under = "";
  if (cs.boxShadow && cs.boxShadow !== "none") {
    for (const sk of delaKomma(cs.boxShadow).map(tolkaSkugga).reverse()) {
      if (sk.inset || genomskinlig(sk.farg)) continue;
      const s = sk.spread;
      const fid = sk.blur > 0
        ? ktxDefs.def(`blur:${sk.blur}`, (id) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(sk.blur / 2)}"/></filter>`)
        : null;
      under += `<rect x="${f(sk.x - s)}" y="${f(sk.y - s)}" width="${f(w + 2 * s)}" height="${f(h + 2 * s)}"${rr(s)} fill="${farg(sk.farg)}"${fid ? ` filter="url(#${fid})"` : ""}/>`;
    }
  }
  if (!genomskinlig(cs.backgroundColor)) {
    under += `<rect width="${f(w)}" height="${f(h)}"${rr()} fill="${farg(cs.backgroundColor)}"/>`;
  }
  if (cs.backgroundImage && cs.backgroundImage !== "none") {
    for (const lager of delaKomma(cs.backgroundImage).reverse()) {
      if (!lager.startsWith("linear-gradient(")) continue;
      const gid = ktxDefs.def(`lg:${lager}:${w}x${h}`, (id) => linjarGradient(lager, id, w, h) || "");
      under += `<rect width="${f(w)}" height="${f(h)}"${rr()} fill="url(#${gid})"/>`;
    }
  }
  const bw = px(cs.borderTopWidth);
  if (bw > 0 && cs.borderTopStyle !== "none" && !genomskinlig(cs.borderTopColor)) {
    under += `<rect x="${f(bw / 2)}" y="${f(bw / 2)}" width="${f(w - bw)}" height="${f(h - bw)}"${rr(-bw / 2)} fill="none" stroke="${farg(cs.borderTopColor)}" stroke-width="${f(bw)}"/>`;
  }
  let over = "";
  const ow = px(cs.outlineWidth);
  if (ow > 0 && cs.outlineStyle !== "none" && !genomskinlig(cs.outlineColor)) {
    const o = px(cs.outlineOffset) + ow / 2;
    const dash = cs.outlineStyle === "dashed" ? ` stroke-dasharray="${f(ow * 3)} ${f(ow * 2)}"` : cs.outlineStyle === "dotted" ? ` stroke-dasharray="${f(ow)} ${f(ow)}"` : "";
    over = `<rect x="${f(-o)}" y="${f(-o)}" width="${f(w + 2 * o)}" height="${f(h + 2 * o)}"${r ? rr(o) : ""} fill="none" stroke="${farg(cs.outlineColor)}" stroke-width="${f(ow)}"${dash}/>`;
  }
  return { under, over };
}
