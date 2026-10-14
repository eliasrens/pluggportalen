// ============================================================================
// Bråkdraken – vingar (#718)
// ----------------------------------------------------------------------------
// Fladdermusvinge byggd av ett ben-skelett (axel → armbåge → handled → 3–4
// fingrar) med lila membran mellan fingerspetsarna. Samma funktion ger allt
// från små hopvikta ungvingar till utfällda segel – öppningen o interpolerar
// vinklarna. Mönster (fläckar, magiska linjer, runor) läggs på per nivå.
// ============================================================================

import { O, r1, smooth, taper, silhuett, form, pth } from "./art-drake-geo.js";
import { PAL, runa, F } from "./art-drake-delar.js";

// --- Vingar -----------------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;
const pol = (p, ang, L) => [p[0] + Math.cos((ang * Math.PI) / 180) * L, p[1] + Math.sin((ang * Math.PI) / 180) * L];

/**
 * Vinge med axel i s, storlek L, öppning o (0 = hopvikt längs ryggen,
 * 1 = utfälld uppåt-bakåt). far = bortre vingen. monster: 0 –, 1 lila
 * fläckar, 2 + magiska linjer, 3 + glödande runor. guldkant: guld på armen.
 */
export function vinge(w, u, lw) {
  const { s, L, o, far = false, monster = 0, guldkant = false, fingrar = 4 } = w;
  const lyft = w.lyft || 0;
  // Överarmen går bakåt från axeln, underarmen upp till handleden, fingrarna
  // fäller ut bakåt-nedåt (klassisk "M"-framkant).
  const a1 = lerp(-158, -139, o) - lyft * 0.3, a2 = lerp(-45, -75, o) - lyft;
  const l1 = L * lerp(0.37, 0.4, o), l2 = L * lerp(0.28, 0.56, o);
  const E = pol(s, a1, l1), W = pol(E, a2, l2);
  const fa = [[lerp(170, 175, o), lerp(0.77, 0.76, o)], [lerp(155, 151, o), lerp(0.8, 0.96, o)],
    [lerp(140, 130, o), lerp(0.75, 1.05, o)], [lerp(128, 119, o), lerp(0.68, 1.03, o)]].slice(4 - fingrar);
  const T = fa.map(([a, l]) => pol(W, a - lyft * 0.3, L * l));
  const B = [s[0] - L * 0.38, s[1] + L * lerp(0.12, 0.1, o)];
  // Membran: S → E → W → T0 ~ T1 ~ … ~ B → S
  let d = `M${r1(s[0])} ${r1(s[1])} L${r1(E[0])} ${r1(E[1])} L${r1(W[0])} ${r1(W[1])} L${r1(T[0][0])} ${r1(T[0][1])}`;
  const pts = [...T, B];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const c = [lerp(m[0], W[0], 0.28), lerp(m[1], W[1], 0.28)];
    d += ` Q${r1(c[0])} ${r1(c[1])} ${r1(b[0])} ${r1(b[1])}`;
  }
  d += ` Q${r1(lerp(B[0], s[0], 0.5))} ${r1(lerp(B[1], s[1], 0.5) + L * 0.06)} ${r1(s[0])} ${r1(s[1])}Z`;
  let out = form(pth(d), F(u, far ? "vm" : "v"), lw);

  // Mönster i membranet.
  const panel = (i) => {
    const a = pts[i], b = pts[i + 1];
    return [lerp(lerp(a[0], b[0], 0.5), W[0], 0.45), lerp(lerp(a[1], b[1], 0.5), W[1], 0.45)];
  };
  if (monster >= 1 && !far) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = panel(i);
      out += `<ellipse cx="${r1(p[0])}" cy="${r1(p[1])}" rx="${r1(L * 0.07)}" ry="${r1(L * 0.045)}" fill="#6A4FC0" opacity="0.55" transform="rotate(${r1(fa[Math.min(i, fa.length - 1)][0])} ${r1(p[0])} ${r1(p[1])})"/>`;
    }
  }
  if (monster >= 2 && !far) {
    for (let i = 0; i < T.length; i++) {
      const a = T[i], m = [lerp(W[0], a[0], 0.5), lerp(W[1], a[1], 0.5)];
      out += `<path class="bd-vinglinje" d="M${r1(lerp(W[0], a[0], 0.2))} ${r1(lerp(W[1], a[1], 0.2))} Q${r1(m[0] + 3)} ${r1(m[1] + 4)} ${r1(lerp(W[0], a[0], 0.82))} ${r1(lerp(W[1], a[1], 0.82))}" fill="none" stroke="#FFF3B8" stroke-width="${r1(lw * 0.55)}" stroke-linecap="round" opacity="0.8"/>`;
    }
  }
  if (monster >= 3 && !far) {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p = panel(i);
      out += runa(p[0], p[1] + L * 0.06, L * 0.035, "#FFE58A", 0.95, `class="bd-vingruna"`);
    }
  }
  // Vingben + fingrar.
  const mid = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const arm1 = pth(taper([s, mid(s, E, 0.33), mid(s, E, 0.66), E], L * 0.09, L * 0.066, { n: 6, runda: true }));
  const arm2 = pth(taper([E, mid(E, W, 0.33), mid(E, W, 0.66), W], L * 0.066, L * 0.045, { n: 6, runda: true }));
  const fing = T.map((t) => pth(taper([W, mid(W, t, 0.33), mid(W, t, 0.66), t], L * 0.03, L * 0.008, { n: 6 })));
  const kf = far ? F(u, "km") : F(u, "k");
  out += silhuett([{ f: arm1, fill: kf }, { f: arm2, fill: kf }, ...fing.map((f) => ({ f, fill: kf }))], lw * 0.8);
  if (guldkant) out += `<path d="${taper([E, mid(E, W, 0.33), mid(E, W, 0.66), W], L * 0.03, L * 0.018, { n: 6 })}" fill="${F(u, "g")}"/>`;
  // Liten klo vid handleden.
  const k = pol(W, -60, L * 0.06);
  out += `<path d="M${r1(W[0] - 2)} ${r1(W[1] - 1)} L${r1(k[0])} ${r1(k[1])} L${r1(W[0] + 2.5)} ${r1(W[1])}Z" fill="${guldkant ? PAL.guld : PAL.klo}" stroke="${O}" stroke-width="${r1(lw * 0.6)}" stroke-linejoin="round"/>`;
  const spetsar = T.map((t) => `${r1(t[0])},${r1(t[1])}`).join(" ");
  return `<g class="bd-vinge${far ? " bd-vinge-far" : " bd-vinge-nar"}" data-spetsar="${spetsar}" style="transform-origin:${r1(s[0])}px ${r1(s[1])}px">${out}</g>`;
}

/** Vingknopp (nivå 1–2). */
export function vingknopp(p, s, u, lw, far = false) {
  const d = smooth([[p[0] + s * 0.4, p[1] + s * 0.2], [p[0] - s * 0.2, p[1] - s * 0.9], [p[0] - s * 1.1, p[1] - s * 0.7], [p[0] - s * 0.9, p[1] + s * 0.2]]);
  return `<g class="bd-vinge${far ? " bd-vinge-far" : " bd-vinge-nar"}" style="transform-origin:${r1(p[0])}px ${r1(p[1])}px">` +
    form(pth(d), F(u, far ? "vm" : "v"), lw) + `</g>`;
}
