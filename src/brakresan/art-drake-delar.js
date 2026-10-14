// ============================================================================
// Bråkdraken – kroppsdelar (#718)
// ----------------------------------------------------------------------------
// Varje funktion ritar EN del av draken som SVG-sträng. Delarna vet ingenting
// om nivåer – de styrs helt av parametrar ur stadietabellen (art-drake-stadier.js)
// och sätts ihop i art-drake.js. Gradienterna (defs) har ett unikt prefix per
// SVG-instans (uid) så flera drakar kan stå på samma sida.
//
// Signatur: draken bär bråkrunan ÷ (prick–streck–prick) i pannan – samma runa
// som på ägget. Den börjar blek och blir allt mer guld.
// ============================================================================

import { O, r1, bez, smooth, taper, silhuett, form, ell, pth, gnista } from "./art-drake-geo.js";

export const PAL = {
  kropp: "#3FC9C1",
  morkKropp: "#2C8DB0",
  bla: "#3E79B8",
  lila: "#8F74DA",
  mage: "#EAFBF4",
  guld: "#F7C948",
  guldMork: "#D9961C",
  elfenben: "#FFF4DE",
  klo: "#FFF1D6",
  pupill: "#241B3A",
};

/** Gradienter för en draksvg. Id:n = uid + kort suffix. */
export function defs(u) {
  const lin = (id, stops, x2 = 0, y2 = 1) =>
    `<linearGradient id="${u}${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">` +
    stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("") +
    `</linearGradient>`;
  const rad = (id, stops, cx = 0.38, cy = 0.3, r = 0.78) =>
    `<radialGradient id="${u}${id}" cx="${cx}" cy="${cy}" r="${r}">` +
    stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("") +
    `</radialGradient>`;
  return (
    `<defs>` +
    rad("k", [[0, "#A6F3E6"], [0.38, "#4FD3C8"], [0.74, "#2DA8B7"], [1, "#3B6FB5"]]) +
    rad("km", [[0, "#45B9BE"], [0.55, "#2B8AAE"], [1, "#4A54A6"]]) +
    lin("m", [[0, "#F7FFFB"], [1, "#C4ECE0"]]) +
    lin("v", [[0, "#E2D3FB"], [0.5, "#AE92E8"], [1, "#7458C4"]], 0.6, 1) +
    lin("vm", [[0, "#A792E2"], [1, "#4E3FA2"]], 0.6, 1) +
    lin("g", [[0, "#FFF2B4"], [0.45, "#F7C948"], [1, "#D38F17"]], 0.4, 1) +
    lin("h", [[0, "#FFFCF3"], [1, "#E6D1AA"]], 1, 1) +
    lin("r", [[0, "#B39BF0"], [0.55, "#7D79DE"], [1, "#4A86CF"]]) +
    lin("sb", [[0, "#2FB3BE", 0], [0.45, "#3C86C9"], [1, "#4B5DC0"]], 1, 0) +
    rad("i", [[0, "#FFF2A6"], [0.45, "#F5BE3E"], [1, "#B9671B"]], 0.5, 0.65, 0.7) +
    rad("a", [[0, "#FFE9A0", 0.55], [0.55, "#9FE8F0", 0.22], [1, "#B79BE0", 0]], 0.5, 0.5, 0.5) +
    rad("e", [[0, "#B9F7EC"], [0.4, "#55D6CB"], [0.78, "#2E9EBB"], [1, "#5551B0"]], 0.36, 0.3, 0.85) +
    `</defs>`
  );
}

export const F = (u, id) => `url(#${u}${id})`;

// --- Ansikte ----------------------------------------------------------------

/** Ett öga. far = bortre ögat (smalare). vuxen 0..1 gör ögat mindre/lugnare. */
export function oga(x, y, r, { u, far = false, vuxen = 0, lw = 3 }) {
  const rx = r * 0.86 * (far ? 0.8 : 1), ry = r * (1.12 - 0.22 * vuxen);
  const brynY = y - ry * 1.05;
  const bryn = vuxen > 0.35
    ? `<path d="M${r1(x - rx * 1.25)} ${r1(brynY + ry * 0.35)} Q${r1(x)} ${r1(brynY - ry * 0.45)} ${r1(x + rx * 1.3)} ${r1(brynY + ry * 0.05)}" fill="none" stroke="#1E6C92" stroke-width="${r1(lw * (0.6 + vuxen))}" stroke-linecap="round"/>`
    : "";
  return (
    `<g class="bd-oga" style="transform-origin:${r1(x)}px ${r1(y)}px">` +
    `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${O}"/>` +
    `<ellipse cx="${r1(x + rx * 0.06)}" cy="${r1(y + ry * 0.08)}" rx="${r1(rx * 0.76)}" ry="${r1(ry * 0.8)}" fill="${F(u, "i")}"/>` +
    `<ellipse cx="${r1(x + rx * 0.1)}" cy="${r1(y + ry * 0.12)}" rx="${r1(rx * (0.42 - 0.1 * vuxen))}" ry="${r1(ry * 0.52)}" fill="${PAL.pupill}"/>` +
    `<circle cx="${r1(x - rx * 0.28)}" cy="${r1(y - ry * 0.36)}" r="${r1(rx * 0.3)}" fill="#fff"/>` +
    `<circle cx="${r1(x + rx * 0.34)}" cy="${r1(y + ry * 0.38)}" r="${r1(rx * 0.13)}" fill="#fff" opacity="0.9"/>` +
    `</g>` + bryn
  );
}

/** Bråkrunan ÷ (prick–streck–prick). */
export function runa(x, y, s, fill, opacity = 1, extra = "") {
  return (
    `<g ${extra} opacity="${opacity}">` +
    `<circle cx="${r1(x)}" cy="${r1(y - s)}" r="${r1(s * 0.32)}" fill="${fill}"/>` +
    `<rect x="${r1(x - s * 0.95)}" y="${r1(y - s * 0.17)}" width="${r1(s * 1.9)}" height="${r1(s * 0.34)}" rx="${r1(s * 0.17)}" fill="${fill}"/>` +
    `<circle cx="${r1(x)}" cy="${r1(y + s)}" r="${r1(s * 0.32)}" fill="${fill}"/>` +
    `</g>`
  );
}

/** Ett horn längs en kurva från bas b, riktning [dx,dy] per längd L. */
function hornKurva(b, L, böj = 1) {
  return [
    b,
    [b[0] - 2 * L, b[1] - 9 * L],
    [b[0] - 8 * L * böj, b[1] - 17 * L],
    [b[0] - 18 * L * böj, b[1] - 19 * L],
  ];
}

function horn(c, w, { u, lw, mork = false, guldFran = 0 }) {
  let s = form(pth(taper(c, w, 0, { n: 10 })), mork ? "#D9C29A" : F(u, "h"), lw);
  if (guldFran > 0) s += `<path d="${taper(c, w, 0, { t0: guldFran, n: 6 })}" fill="${F(u, "g")}"/>`;
  // Ett par ringar på hornet ger tyngd.
  const p = bez(c, 0.38);
  return s + `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(w * 0.12)}" fill="${O}" opacity="0.25"/>`;
}

/** Fen-öra som pekar bakåt. */
function ora(x, y, e, fill, inner, lw) {
  const pts = [[x + 2, y - 4 * e], [x - 7 * e, y - 8 * e], [x - 13 * e, y - 6 * e], [x - 8 * e, y + 1], [x + 1, y + 3 * e]];
  const in2 = [[x, y - 2.5 * e], [x - 6 * e, y - 5.6 * e], [x - 10 * e, y - 5 * e], [x - 6.5 * e, y - 0.4], [x - 0.5, y + 1.4 * e]];
  return form(pth(smooth(pts)), fill, lw) + `<path d="${smooth(in2)}" fill="${inner}"/>`;
}

/**
 * Huvudet i lokala koordinater (skallens mitt = 0,0), vänt 3/4 åt höger.
 * h: { v (vuxenhet 0..1), oron, horn, hornL, horn2, krona, guld, kinder, runa, mun }
 */
export function huvud(h, u, lw) {
  const v = h.v;
  const crx = 21 - 3 * v, cry = 19 - 3.5 * v;
  const mx = 8 + 8 * v, my = 8 + 2 * v, mrx = 13 + 5.5 * v, mry = 9 + 2.6 * v;
  let bak = "", fram = "";

  // Horn (bakom skallen). horn: 0 inga, 1 knoppar, 2+ riktiga horn.
  if (h.horn === 1) {
    bak += form(pth(taper([[-3, -14], [-3.5, -17], [-4.5, -20], [-6, -21.5]], 7, 4.5, { runda: true })), F(u, "h"), lw);
    bak += form(pth(taper([[-12, -10], [-13, -13], [-14, -15], [-15.5, -16.5]], 6, 3.8, { runda: true })), "#DCC7A2", lw);
  } else if (h.horn >= 2) {
    const L = h.hornL || 1, w = 6 + L * 2;
    const g = h.guldHorn ? 0.62 : 0;
    bak += horn(hornKurva([-13, -10], L * 0.92, 1.05), w * 0.9, { u, lw, mork: true, guldFran: g });
    bak += horn(hornKurva([-3, -15], L), w, { u, lw, guldFran: g });
  }
  // Sekundärt hornpar (lägre, vid skallens sida): 1 = börjar synas, 2 = fullt.
  if (h.horn2) {
    const L2 = h.horn2 === 1 ? 0.45 : 0.85;
    const c = (b) => [b, [b[0] - 6 * L2, b[1] - 2 * L2], [b[0] - 12 * L2, b[1] - 1 * L2], [b[0] - 18 * L2, b[1] + 3 * L2]];
    bak += horn(c([-17, -1]), 4 + 2 * L2, { u, lw, guldFran: h.guldHorn ? 0.6 : 0 });
  }
  // Krona: små taggar längs hjässan (1 = antydan, 2 = full kronsilhuett).
  if (h.krona) {
    const n = h.krona === 1 ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = (-150 + (i * 95) / (n - 1)) * Math.PI / 180;
      const b = [Math.cos(a) * crx * 0.82, Math.sin(a) * cry * 0.82];
      const L = (h.krona === 1 ? 0.55 : 0.8) * (i === Math.floor(n / 2) ? 1.35 : 1);
      const tip = [b[0] + Math.cos(a) * 16 * L, b[1] + Math.sin(a) * 16 * L];
      const c = [b, [b[0] + (tip[0] - b[0]) * 0.33, b[1] + (tip[1] - b[1]) * 0.33], [b[0] + (tip[0] - b[0]) * 0.66, b[1] + (tip[1] - b[1]) * 0.66], tip];
      bak += form(pth(taper(c, 6.5, 0, { n: 6 })), F(u, "g"), lw);
    }
  }
  if (h.oron) {
    const e = h.oron === 1 ? 0.7 : 1;
    bak += ora(-crx * 0.62, -cry * 0.5, e * 1.25, "#2B8AAE", "#6F5BC0", lw);
    // Kindfrans (vuxen): små taggar bakom käken.
    if (v > 0.45) {
      for (let i = 0; i < 3; i++) {
        const b0 = [-crx * 0.55 + i * 3, cry * 0.35 + i * 4];
        const L = (7 + 5 * v) * (1 - i * 0.22);
        bak += form(pth(taper([b0, [b0[0] - L * 0.4, b0[1] + L * 0.1], [b0[0] - L * 0.75, b0[1] + L * 0.25], [b0[0] - L, b0[1] + L * 0.45]], 5.5 - i, 0, { n: 6 })), F(u, "r"), lw * 0.9);
      }
    }
  }

  // Silhuett: skalle + kinder + nos.
  const former = [
    { f: ell(0, 0, crx, cry), fill: F(u, "k") },
    { f: ell(2, 6, crx * 0.92, 13 - 2 * v), fill: F(u, "k") },
    { f: ell(mx, my, mrx, mry, 6 + 4 * v), fill: F(u, "k") },
  ];
  // Näsknöl ovanpå nosspetsen (växer fram från ungdom).
  if (v > 0.2) former.push({ f: ell(mx + mrx * 0.5, my - mry * 0.62, 3 + 3 * v, 2.6 + v, 10), fill: F(u, "k") });
  const sil = silhuett(former, lw) + `<clipPath id="${u}hc">${former.map((f) => `<${f.f}/>`).join("")}</clipPath>`;
  // Ljus nosfläck + ljus haka.
  const nos =
    `<ellipse cx="${r1(mx - 2)}" cy="${r1(my + mry * 0.72)}" rx="${r1(mrx * 0.82)}" ry="${r1(mry * 0.34)}" fill="${F(u, "m")}" transform="rotate(${r1(8 + 6 * v)} ${r1(mx)} ${r1(my)})" clip-path="url(#${u}hc)"/>` +
    `<ellipse cx="${r1(mx + mrx * 0.52)}" cy="${r1(my - mry * 0.32)}" rx="1.9" ry="1.3" fill="${O}" transform="rotate(25 ${r1(mx + mrx * 0.52)} ${r1(my - mry * 0.32)})"/>` +
    `<ellipse cx="${r1(mx + mrx * 0.1)}" cy="${r1(my - mry * 0.48)}" rx="1.6" ry="1.1" fill="${O}" opacity="0.8"/>`;
  const mun = h.mun === "oppen"
    ? `<path d="M${r1(mx - mrx * 0.3)} ${r1(my + mry * 0.42)} Q${r1(mx + mrx * 0.3)} ${r1(my + mry * 1.05)} ${r1(mx + mrx * 0.82)} ${r1(my + mry * 0.18)} Q${r1(mx + mrx * 0.3)} ${r1(my + mry * 0.6)} ${r1(mx - mrx * 0.3)} ${r1(my + mry * 0.42)}Z" fill="#6E3F63" stroke="${O}" stroke-width="${r1(lw * 0.8)}" stroke-linejoin="round"/>`
    : (() => {
      // Munlinjen blir längre med åldern och slutar i ett litet leende-veck.
      const b = [mx - mrx * (0.35 + 0.35 * v), my + mry * 0.45], t = [mx + mrx * 0.85, my + mry * 0.15];
      return `<path d="M${r1(b[0] - 2.5)} ${r1(b[1] - 2.8)} Q${r1(b[0] - 1)} ${r1(b[1] + 0.6)} ${r1(b[0] + 2)} ${r1(b[1] + 0.8)} Q${r1((b[0] + t[0]) / 2 + 2)} ${r1(my + mry * (0.8 - 0.15 * v))} ${r1(t[0])} ${r1(t[1])}" fill="none" stroke="${O}" stroke-width="${r1(lw * 0.8)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })();

  const eR = 7.4 - 2.2 * v;
  fram += oga(-6 + v, -3, eR, { u, far: true, vuxen: v, lw });
  fram += oga(11 + 2.5 * v, -2.5, eR, { u, vuxen: v, lw });
  if (h.kinder) fram += `<ellipse cx="${r1(15 + 3 * v)}" cy="${r1(6.5)}" rx="4.2" ry="2.6" fill="#FFB1B8" opacity="${h.kinder}"/>`;
  // Bråkrunan i pannan.
  const rs = 2.6 + 0.4 * v;
  if (h.runa > 0) {
    const guldig = h.runa >= 0.7;
    fram += runa(3 + v, -12.5 - v, rs, guldig ? F(u, "g") : "#BFF3EA", guldig ? 1 : h.runa, `class="bd-runa"`);
  }
  // Guldbåge (diadem) runt pannan på legendarisk nivå.
  if (h.diadem) {
    fram += `<path d="M${r1(-crx * 0.75)} ${r1(-cry * 0.45)} Q${r1(2)} ${r1(-cry * 1.05)} ${r1(crx * 0.85)} ${r1(-cry * 0.5)}" fill="none" stroke="${O}" stroke-width="${r1(lw * 1.9)}" stroke-linecap="round"/>` +
      `<path d="M${r1(-crx * 0.75)} ${r1(-cry * 0.45)} Q${r1(2)} ${r1(-cry * 1.05)} ${r1(crx * 0.85)} ${r1(-cry * 0.5)}" fill="none" stroke="${PAL.guld}" stroke-width="${r1(lw * 0.9)}" stroke-linecap="round"/>`;
  }
  // Fina guldfjäll på kinden från nivå 5.
  if (h.guld >= 1) {
    fram += [[-15, 7, 1.5], [-12, 10.5, 1.3], [-8.5, 13, 1.1]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PAL.guld}" stroke="${O}" stroke-width="${r1(lw * 0.3)}"/>`).join("");
  }
  // Nospuff (tänds av gesten "puff").
  const px = mx + mrx * 0.95, py = my - mry * 0.5;
  fram += `<g class="bd-puff" style="transform-origin:${r1(px)}px ${r1(py)}px">` +
    `<circle cx="${r1(px + 3)}" cy="${r1(py - 1)}" r="2.6" fill="#E9FBFF"/><circle cx="${r1(px + 7)}" cy="${r1(py - 3)}" r="3.4" fill="#E9FBFF" opacity="0.85"/><circle cx="${r1(px + 11)}" cy="${r1(py - 1)}" r="2.2" fill="#E9FBFF" opacity="0.7"/></g>`;
  return bak + sil + nos + mun + fram;
}

// --- Ben, svans, ryggfjäll --------------------------------------------------

/**
 * Ett ben: höft → knä → fot. far = bortre benet (mörkare). lår = valfri ellips
 * (bakben). Fotens tår pekar åt höger (framåt).
 */
export function ben(b, u, lw, { far = false, guldklor = false } = {}) {
  const fill = far ? F(u, "km") : F(u, "k");
  const w = b.w;
  const c = [b.hoft, b.kna, b.hase || b.kna, b.fot];
  let s = "";
  const seg = (p, q, a, b) => pth(taper([p, [p[0] + (q[0] - p[0]) / 3, p[1] + (q[1] - p[1]) / 3], [p[0] + (2 * (q[0] - p[0])) / 3, p[1] + (2 * (q[1] - p[1])) / 3], q], a, b, { n: 4, runda: true }));
  const former = b.hase
    ? [{ f: seg(b.hoft, b.kna, w * 1.1, w), fill }, { f: pth(taper([b.kna, b.hase, b.hase, b.fot], w, w * 0.62, { n: 10, runda: true })), fill }]
    : [{ f: pth(taper(c, w, w * 0.72, { n: 10, runda: true })), fill }];
  if (b.lar) former.unshift({ f: ell(...b.lar), fill });
  const fx = b.fot[0] + w * 0.2, fy = b.fot[1] + w * 0.1;
  former.push({ f: ell(fx, fy, w * 0.78, w * 0.42), fill });
  s += silhuett(former, lw);
  // Klor.
  const klo = guldklor ? PAL.guld : PAL.klo;
  for (let i = 0; i < 3; i++) {
    const kx = fx + w * (0.12 + i * 0.3), ky = fy + w * 0.12 - Math.abs(i - 1) * w * 0.06;
    s += `<ellipse cx="${r1(kx)}" cy="${r1(ky)}" rx="${r1(w * 0.14)}" ry="${r1(w * 0.12)}" fill="${klo}" stroke="${O}" stroke-width="${r1(lw * 0.55)}"/>`;
  }
  return `<g class="${b.klass || ""}" style="transform-origin:${r1(b.hoft[0])}px ${r1(b.hoft[1])}px">${s}</g>`;
}

/** Svansfena (spadform) i spetsen, riktad längs tangenten. */
function fena(p, ang, s, typ) {
  const d = typ === "stor"
    ? `M0 0 C${s * 0.3} ${-s * 0.75} ${s * 0.95} ${-s * 0.95} ${s * 1.2} ${-s * 0.4} C${s * 0.95} ${-s * 0.15} ${s * 0.9} ${s * 0.15} ${s * 1.2} ${s * 0.4} C${s * 0.95} ${s * 0.95} ${s * 0.3} ${s * 0.75} 0 0Z`
    : `M0 0 C${s * 0.35} ${-s * 0.7} ${s * 1.0} ${-s * 0.6} ${s * 1.15} 0 C${s * 1.0} ${s * 0.6} ${s * 0.35} ${s * 0.7} 0 0Z`;
  return { f: `path d="${d}" transform="translate(${r1(p[0])} ${r1(p[1])}) rotate(${r1(ang)})"`, d, ang, p };
}

/**
 * Svans längs kurvan t.c. spets: "rund" | "bla" | "fena" | "storfena" | "ornament".
 */
export function svans(t, u, lw) {
  const c = t.c;
  const former = [{ f: pth(taper(c, t.w0, t.w1, { n: 16, runda: true, ease: 0.8 })), fill: F(u, "k") }];
  if (t.spets !== "rund") {
    former.push({ f: pth(taper(c, t.w0, t.w1, { t0: 0.62, n: 8, runda: true, ease: 0.8 })), fill: F(u, "sb") });
  }
  let fenaSvg = "";
  if (t.spets === "fena" || t.spets === "storfena" || t.spets === "ornament") {
    const p = bez(c, 1), q = bez(c, 0.95);
    const ang = (Math.atan2(p[1] - q[1], p[0] - q[0]) * 180) / Math.PI;
    const fe = fena(p, ang, t.fena || 10, t.spets === "fena" ? "liten" : "stor");
    former.push({ f: fe.f, fill: F(u, "v") });
    if (t.spets === "ornament" || t.guldkant) {
      fenaSvg += `<path d="${fe.d}" transform="translate(${r1(p[0])} ${r1(p[1])}) rotate(${r1(ang)}) scale(0.62) translate(${r1((t.fena || 10) * 0.35)} 0)" fill="${F(u, "g")}" opacity="0.9"/>`;
    }
  }
  let s = silhuett(former, lw) + fenaSvg;
  // Guldring/ornament nära spetsen.
  if (t.ringar) {
    for (const rt of t.ringar) {
      s += `<path d="${taper(c, t.w0 * 1.08, t.w1 * 1.08, { t0: rt, t1: rt + 0.045, n: 3, ease: 0.8 })}" fill="${F(u, "g")}" stroke="${O}" stroke-width="${r1(lw * 0.6)}"/>`;
    }
  }
  // Fjällrand längs svansens ovansida.
  const p0 = c[0];
  return `<g class="bd-svans" style="transform-origin:${r1(p0[0])}px ${r1(p0[1])}px">${s}</g>`;
}

/**
 * Ryggfjäll längs kurvan c: n taggar, storlek s (störst i mitten).
 * guld: 0 inga, 1 guldkant på vissa, 2 på alla.
 */
export function ryggfjall(c, n, s, u, lw, guld = 0, { fran = 0.05, till = 0.95 } = {}) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const t = fran + ((till - fran) * (i + 0.5)) / n;
    const p = bez(c, t), q = bez(c, Math.min(1, t + 0.01));
    const tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1;
    const nx = ty / l, ny = -tx / l; // vänsternormal = uppåt för en kurva som går åt höger
    const k = s * (0.6 + 0.4 * Math.sin(Math.PI * (i + 0.5) / n));
    const bx = (tx / l) * k * 0.62, by = (ty / l) * k * 0.62;
    const tip = [p[0] + nx * k * 1.15 + bx * 0.35, p[1] + ny * k * 1.15 + by * 0.35];
    const a = [p[0] - bx, p[1] - by], b = [p[0] + bx, p[1] + by];
    const d = `M${r1(a[0])} ${r1(a[1])} Q${r1((a[0] + tip[0]) / 2 + nx * k * 0.1)} ${r1((a[1] + tip[1]) / 2 + ny * k * 0.1)} ${r1(tip[0])} ${r1(tip[1])} Q${r1((b[0] + tip[0]) / 2)} ${r1((b[1] + tip[1]) / 2)} ${r1(b[0])} ${r1(b[1])}Z`;
    out += form(pth(d), F(u, "r"), lw * 0.85);
    if (guld === 2 || (guld === 1 && i % 2 === 1)) {
      const m = [p[0] + nx * k * 0.55, p[1] + ny * k * 0.55];
      out += `<path d="M${r1(m[0] - bx * 0.45)} ${r1(m[1] - by * 0.45)} L${r1(tip[0])} ${r1(tip[1])} L${r1(m[0] + bx * 0.45)} ${r1(m[1] + by * 0.45)}Z" fill="${F(u, "g")}" stroke-linejoin="round"/>`;
    }
  }
  return out;
}

export { gnista, r1 };
