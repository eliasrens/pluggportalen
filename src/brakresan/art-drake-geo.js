// ============================================================================
// Bråkdraken – geometrihjälpare (#718)
// ----------------------------------------------------------------------------
// Små rena funktioner som drakens delar (art-drake-delar.js) byggs av:
// mjuka stängda kurvor (Catmull-Rom → kubiska Bézier), avsmalnande former längs
// en kurva (svans, hals, horn, vingben) och "silhuett-unionen" som ger EN
// sammanhängande kontur runt flera överlappande former (samma knep som limb()
// i art-style.js: konturpass under, färgpass över).
//
// Allt returnerar SVG-strängar/path-data – ingen DOM, så modulen kan köras i
// node-tester och renderas server-/klientsida likadant.
// ============================================================================

import { O } from "../art-style.js";

export { O };

/** Avrundar till en decimal (kortare SVG). */
export const r1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

/** Punkt på kubisk Bézier. */
export function bez([p0, c1, c2, p3], t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ];
}

/** Tangent (normerad) på kubisk Bézier. */
function bezTan([p0, c1, c2, p3], t) {
  const u = 1 - t;
  const x = 3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p3[0] - c2[0]);
  const y = 3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p3[1] - c2[1]);
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Mjuk kurva genom punkterna (Catmull-Rom). closed=true ger stängd form. */
export function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + (closed ? "Z" : "");
}

/**
 * Avsmalnande form längs en kubisk kurva c = [p0, c1, c2, p3].
 * w0/w1 = bredd i start/slut (w1=0 ger spets). t0..t1 = del av kurvan
 * (bredden räknas på hela kurvans t, så en guldspets t0=0.65 passar exakt
 * ovanpå samma horn). runda=true ger rund ände, annars spetsig.
 */
export function taper(c, w0, w1, { t0 = 0, t1 = 1, n = 12, runda = false, ease = 1 } = {}) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = bez(c, t);
    const [tx, ty] = bezTan(c, t);
    const w = (w0 + (w1 - w0) * Math.pow(t, ease)) / 2;
    L.push([p[0] - ty * w, p[1] + tx * w]);
    R.push([p[0] + ty * w, p[1] - tx * w]);
  }
  const pts = [...L];
  if (runda) {
    const e = bez(c, t1), [tx, ty] = bezTan(c, t1);
    const w = (w0 + (w1 - w0) * Math.pow(t1, ease)) / 2;
    pts.push([e[0] + tx * w * 0.9, e[1] + ty * w * 0.9]);
  }
  pts.push(...R.reverse());
  return smooth(pts, true, 1 / 7);
}

/** Ellips-punkt (för att placera fjäll längs en kroppskant). */
export function ellPt(cx, cy, rx, ry, rotDeg, angDeg) {
  const a = (angDeg * Math.PI) / 180, r = (rotDeg * Math.PI) / 180;
  const x = rx * Math.cos(a), y = ry * Math.sin(a);
  return [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)];
}

/** Ellips som form-beskrivning för silhuett(). */
export const ell = (cx, cy, rx, ry, rot = 0) =>
  `ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"` +
  (rot ? ` transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"` : "");

/** Path som form-beskrivning för silhuett(). */
export const pth = (d) => `path d="${d}"`;

/**
 * Silhuett-union: former = [{ f: formbeskrivning, fill }]. Ritar först alla
 * former med tjock kontur (konturen syns bara på unionens ytterkant) och sedan
 * färgerna ovanpå – så överlappande delar flyter ihop till en figur.
 */
export function silhuett(former, lw = 3, extra = "") {
  const kontur = former.map((s) => `<${s.f}/>`).join("");
  const farg = former.map((s) => `<${s.f} fill="${s.fill}"/>`).join("");
  return (
    `<g ${extra}><g fill="${O}" stroke="${O}" stroke-width="${r1(lw * 2)}" stroke-linejoin="round">${kontur}</g>` +
    `${farg}</g>`
  );
}

/** En enskild form med egen kontur. */
export function form(f, fill, lw = 3, extra = "") {
  return `<${f} fill="${fill}" stroke="${O}" stroke-width="${r1(lw)}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
}

/** Liten fyruddig gnista (för glimt/partiklar). */
export function gnista(x, y, s, fill = "#FFF6C8", extra = "") {
  return (
    `<path ${extra} d="M${r1(x)} ${r1(y - s)} Q${r1(x + s * 0.18)} ${r1(y - s * 0.18)} ${r1(x + s)} ${r1(y)} ` +
    `Q${r1(x + s * 0.18)} ${r1(y + s * 0.18)} ${r1(x)} ${r1(y + s)} Q${r1(x - s * 0.18)} ${r1(y + s * 0.18)} ` +
    `${r1(x - s)} ${r1(y)} Q${r1(x - s * 0.18)} ${r1(y - s * 0.18)} ${r1(x)} ${r1(y - s)}Z" fill="${fill}"/>`
  );
}
