// ============================================================================
// Bråkdraken – konst-API (#718, spec §9)
// ----------------------------------------------------------------------------
// LAZY modul: importeras dynamiskt av Bråkresan/huset (#714) – aldrig statiskt
// från bootgrafen. Ren SVG i kod, inga bildfiler.
//
//   drakeNiva(stjarnor)        → 0 (ägg) eller 1–15 enligt spec §9
//   drakeProgress(stjarnor)    → { niva, kvar, fran, till, fullt } för panelen
//   drakeSvg(niva, opts)       → komplett <svg> (transparent bakgrund)
//        opts.stjarnor  – för ägget: 5–9 ger sprickor
//        opts.klass     – extra klass på <svg>
//        opts.titel     – tillgänglig titel (annars "Bråkdraken, nivå N")
//        opts.hus       – huspose (#714): vuxna (10–15) med hopvikta vingar
//   husMatt(niva) / husPassning(…) → storlek i elevhuset (#714), se nedan
//   drakeMatt(niva)            → { faktor, vb, pivot } logisk storlek + fotpunkt
//        (huseposens hopvikta vingar ryms i samma ruta – kroppen, halsen och
//        svansen avgör den, mätt med preview-brakdraken.html?matt=1)
//   STADIER                    → tabellen (art-drake-stadier.js)
//
// Rigg: delarna ligger i grupper som animationen (art-drake-anim.js) rör:
//   .bd-andas (hela figuren) · .bd-huvud · .bd-oga · .bd-svans · .bd-vinge-nar/
//   -far · .bd-ben-steg · .bd-runa · .bd-aura. CSS-transform på en grupp får
//   inte krocka med ett transform-attribut, därför har riggrupperna aldrig ett.
// ============================================================================

import { O, r1, bez, taper, silhuett, ell, pth, gnista } from "./art-drake-geo.js";
import { defs, huvud, ben, svans, ryggfjall, F, PAL } from "./art-drake-delar.js";
import { vinge, vingknopp } from "./art-drake-vinge.js";
import { agg } from "./art-drake-agg.js";
import { STADIER } from "./art-drake-stadier.js";

export { STADIER };

/** Nivå ur totala stjärnor: 0–9 ägg (0), annars min(15, floor(S/10)). */
export function drakeNiva(stjarnor) {
  const s = Math.max(0, Math.floor(Number(stjarnor) || 0));
  return s < 10 ? 0 : Math.min(15, Math.floor(s / 10));
}

/** Progress mot nästa tröskel (ägget: mot 10). */
export function drakeProgress(stjarnor) {
  const s = Math.max(0, Math.floor(Number(stjarnor) || 0));
  const niva = drakeNiva(s);
  if (niva >= 15) return { niva, fran: 150, till: 150, kvar: 0, fullt: true };
  const fran = niva * 10, till = (niva + 1) * 10;
  return { niva, fran, till, kvar: till - s, fullt: false };
}

// Tight viewBox per stadium (uppmätt med getBBox i förhandsvisningen + marginal
// för vinggester) och
// fotpunkt (pivot) = mitten av markkontakten. Ritytans mark ligger på y = 200.
// Ändras en pose: mät om med preview-brakdraken.html?matt=1.
const VB = {
  0: [12, 2, 76, 116], 1: [24, 73, 123, 133], 2: [58, 64, 96, 144], 3: [12, 62, 142, 144],
  4: [-2, 60, 182, 149], 5: [-8, 41, 195, 168], 6: [-46, 45, 243, 164], 7: [-45, 76, 259, 135],
  8: [-51, 5, 244, 205], 9: [-51, 4, 233, 203], 10: [-66, 11, 264, 198], 11: [-73, 8, 275, 202],
  12: [-79, 38, 310, 173], 13: [-83, -15, 284, 225], 14: [-65, -13, 244, 219],
  15: [-90, -19, 297, 230],
};

/** Vuxna (10–15) har hopvikta vingar i huset (spec §9 "Draken i huset"). */
export const arHusVikt = (niva) => niva >= 10;

/** Stadiet i huspose: vingarna vikta längs ryggen, inget lyft. */
function husPose(st) {
  if (!arHusVikt(st.niva) || !st.vingar) return st;
  const { nar, far } = st.vingar;
  return { ...st, vingar: { nar: { ...nar, o: 0, lyft: 0 }, far: { ...far, o: 0.08, lyft: 0 } } };
}

/**
 * Mått för visning. enhet = kroppsmått i rityteenheter (kroppens längsta axel +
 * huvudets bredd – oberoende av pose), så att px per enhet = k · faktor / enhet
 * ger rätt storleksrelation mellan nivåerna (se skalaFor).
 */
export function drakeMatt(niva) {
  const st = STADIER[niva];
  const vb = VB[niva];
  if (niva === 0) return { faktor: st.faktor, vb, pivot: [50, 114], enhet: 106 };
  const pivot = [r1((st.bak.fot[0] + st.fram.fot[0]) / 2), 200];
  const enhet = 2 * Math.max(st.kropp[2], st.kropp[3]) + 40 * st.huvud.s;
  return { faktor: st.faktor, vb, pivot, enhet };
}

/** Pixlar per rityteenhet när en häst (faktor 1) motsvarar `pxPerHast` px. */
export function skalaFor(niva, pxPerHast) {
  const m = drakeMatt(niva);
  return (pxPerHast * m.faktor) / m.enhet;
}

// --- Draken i elevhuset (#714) -------------------------------------------------
// Rummets längdenhet är "rums-enheten" (RUM_ENHET, ~25 px på en laptop). Hästen
// i huset är ~4,6 enheter hög; kroppsmåttet (enhet ovan) gör draken lite högre
// än sin faktor eftersom halsen och huvudet sticker upp, så huset räknar med
// 4 enheter per "häst". Nivå 1 lyfts lite mot en klickbar minsta höjd – men
// aldrig förbi nivå 2 (storleken växer alltid med nivån).
export const HUS_HAST = 4;
export const HUS_MIN_H = 2.1;

/** Drakens storlek i huset i rums-enheter (bredd, höjd) – ägget visas inte där. */
export function husMatt(niva) {
  const n = Math.max(1, Math.min(15, Math.floor(niva) || 1));
  const vb = drakeMatt(n).vb, k = skalaFor(n, HUS_HAST);
  const lyft = Math.max(1, HUS_MIN_H / (vb[3] * k));
  return { w: r1(vb[2] * k * lyft), h: r1(vb[3] * k * lyft) };
}

/**
 * Skalfaktor (≤ 1) så att draken ryms med fötterna vid `fotY` % av scenen:
 * huvudet stannar under scenens överkant och kroppen inom bredden. Positionen
 * ändras aldrig – bara renderingsstorleken (spec §9: "teleportera inte").
 * enhetPx = rums-enheten i px, scenW/scenH = scenens mått i px (0 = okänt → 1).
 */
export function husPassning({ w, h }, fotY, { enhetPx, scenW, scenH }) {
  if (!(enhetPx > 0 && scenW > 0 && scenH > 0)) return 1;
  const plats = (fotY / 100) * scenH - 0.02 * scenH;
  return Math.min(1, plats / (h * enhetPx), (0.96 * scenW) / (w * enhetPx));
}

let raknare = 0;

/** Kropp + hals som en silhuett, mage klippt till den. */
function kroppSvg(st, u, lw) {
  const [bx, by, rx, ry, rot] = st.kropp;
  const former = [{ f: ell(bx, by, rx, ry, rot), fill: F(u, "k") }];
  // Bröstkorg: djupare framtill från nivå 4 (bredare från 6).
  if (st.niva >= 4) {
    const b = st.brost ?? (st.niva >= 6 ? 1.12 : 1);
    former.push({ f: ell(bx + rx * 0.42, by + ry * 0.02, rx * 0.5 * b, ry * 1.08 * b, rot), fill: F(u, "k") });
  }
  if (st.hals) former.push({ f: pth(taper(st.hals.c, st.hals.w0, st.hals.w1, { n: 10, runda: true })), fill: F(u, "k") });
  const clip = `<clipPath id="${u}kc">${former.map((s) => `<${s.f}/>`).join("")}</clipPath>`;
  // Mage: ljus ellips längs undersidan + band upp längs halsens framsida.
  let mage = `<${ell(bx + rx * 0.22, by + ry * 0.62, rx * 0.78, ry * 0.62, rot)} fill="${F(u, "m")}"/>`;
  if (st.hals) {
    const c = st.hals.c.map(([x, y]) => [x + st.hals.w0 * 0.3, y + 3]);
    mage += `<path d="${taper(c, st.hals.w0 * 0.55, st.hals.w1 * 0.5, { n: 10, runda: true })}" fill="${F(u, "m")}"/>`;
  }
  // Bukplattor (tunna bågar) från nivå 3.
  if (st.niva >= 3) {
    for (let i = -2; i <= 2; i++) {
      const x = bx + rx * 0.25 + i * rx * 0.2, y = by + ry * 0.62;
      mage += `<path d="M${r1(x - rx * 0.08)} ${r1(y - ry * 0.2)} Q${r1(x)} ${r1(y + ry * 0.05)} ${r1(x - rx * 0.06)} ${r1(y + ry * 0.4)}" fill="none" stroke="#9ED8CA" stroke-width="${r1(lw * 0.5)}" stroke-linecap="round"/>`;
    }
  }
  if (st.guld?.mage) {
    mage += `<path d="M${r1(bx + rx * 0.05)} ${r1(by + ry * 0.36)} Q${r1(bx + rx * 0.5)} ${r1(by + ry * 0.5)} ${r1(bx + rx * 0.8)} ${r1(by + ry * 0.12)}" fill="none" stroke="${PAL.guld}" stroke-width="${r1(lw * 0.7)}" stroke-linecap="round" opacity="0.9"/>`;
  }
  // Skuggfläck längs ryggen ger volym.
  const skugga = `<${ell(bx - rx * 0.1, by - ry * 0.55, rx * 0.8, ry * 0.4, rot)} fill="#fff" opacity="0.16"/>`;
  return clip + silhuett(former, lw) + `<g clip-path="url(#${u}kc)">${mage}${skugga}</g>`;
}

/** Guldmarkeringar på kroppen (skuldra, fjäll, bröstornament). */
function kroppGuld(st, u, lw) {
  const g = st.guld;
  if (!g) return "";
  const [bx, by, rx, ry] = st.kropp;
  let s = "";
  if (g.skuldra) {
    const x = bx + rx * 0.35, y = by - ry * 0.15;
    // Tre små guldfjäll på skuldran – den första guldmarkeringen (nivå 5).
    for (const [dx, dy, k] of [[-5, -2, 1], [2, -4, 1.1], [0, 3, 0.9]]) {
      const cx = x + dx, cy = y + dy, w = 3.6 * k, h = 4.6 * k;
      s += `<path d="M${r1(cx - w)} ${r1(cy - h * 0.4)} Q${r1(cx)} ${r1(cy - h * 0.9)} ${r1(cx + w)} ${r1(cy - h * 0.4)} Q${r1(cx + w * 0.6)} ${r1(cy + h * 0.6)} ${r1(cx)} ${r1(cy + h * 0.8)} Q${r1(cx - w * 0.6)} ${r1(cy + h * 0.6)} ${r1(cx - w)} ${r1(cy - h * 0.4)}Z" fill="${F(u, "g")}" stroke="${O}" stroke-width="${r1(lw * 0.55)}" stroke-linejoin="round"/>`;
    }
  }
  for (let i = 0; i < (g.fjall || 0); i++) {
    const t = (i + 0.5) / g.fjall;
    const x = bx - rx * 0.55 + t * rx * 1.05 + (i % 2) * 3, y = by - ry * 0.32 + (i % 2) * ry * 0.22 + Math.sin(t * 3) * 2;
    s += `<path d="M${r1(x - 3.4)} ${r1(y - 1.4)} Q${r1(x)} ${r1(y + 3.6)} ${r1(x + 3.4)} ${r1(y - 1.4)}" fill="none" stroke="${PAL.guld}" stroke-width="${r1(lw * 0.6)}" stroke-linecap="round" opacity="0.95"/>`;
  }
  if (g.brost && st.hals) {
    const p = bez(st.hals.c, 0.12);
    s += `<circle cx="${r1(p[0] + 6)}" cy="${r1(p[1] + 8)}" r="5.6" fill="${F(u, "g")}" stroke="${O}" stroke-width="${r1(lw * 0.8)}"/>`;
    s += `<circle cx="${r1(p[0] + 6)}" cy="${r1(p[1] + 8)}" r="2.4" fill="#8FE6F0" stroke="${O}" stroke-width="${r1(lw * 0.5)}"/>`;
  }
  return s;
}

/** Komplett draksvg för ett stadium (0 = ägg). */
export function drakeSvg(niva, opts = {}) {
  const n = Math.max(0, Math.min(15, Math.floor(niva) || 0));
  const u = `bd${++raknare}x`;
  const hus = !!opts.hus;
  const { vb, pivot } = drakeMatt(n);
  const titel = opts.titel || (n === 0 ? "Bråkdrakens ägg" : `Bråkdraken, nivå ${n}`);
  const klass = `bd-drake bd-niva-${n} bd-familj-${STADIER[n].familj}${opts.klass ? " " + opts.klass : ""}`;
  const pv = `style="transform-origin:${pivot[0]}px ${pivot[1]}px"`;
  let inner;
  if (n === 0) {
    const spr = Math.max(0, Math.min(5, (Number(opts.stjarnor) || 0) - 4));
    inner = `<ellipse cx="50" cy="114" rx="30" ry="5" fill="${O}" opacity="0.12"/>` +
      `<circle class="bd-aura" cx="50" cy="62" r="50" fill="${F(u, "a")}" opacity="0.7"/>` +
      `<g class="bd-andas bd-agg" ${pv}>${agg(u, spr)}</g>`;
  } else {
    inner = drakeKropp(hus ? husPose(STADIER[n]) : STADIER[n], u, pivot);
  }
  return (
    `<svg class="${klass}" viewBox="${vb.join(" ")}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titel}" data-niva="${n}"${hus ? ' data-hus="1"' : ""}>` +
    `<title>${titel}</title>${defs(u)}${inner}</svg>`
  );
}

function drakeKropp(st, u, pivot) {
  const lw = st.lw;
  const [bx, by, rx] = st.kropp;
  let s = "";
  // Markskugga + aura.
  const fotter = [st.bak.fot[0], st.fram.fot[0]];
  const sx = (Math.min(...fotter) + Math.max(...fotter)) / 2, sw = Math.abs(fotter[1] - fotter[0]) / 2 + rx * 0.55;
  s += `<ellipse cx="${r1(sx)}" cy="200" rx="${r1(sw)}" ry="${r1(Math.max(4, sw * 0.13))}" fill="${O}" opacity="0.12"/>`;
  if (st.aura) {
    const ar = st.aura === 2 ? 140 : 110;
    s += `<circle class="bd-aura" cx="${bx + 20}" cy="${by - 30}" r="${ar}" fill="${F(u, "a")}" opacity="${st.aura === 2 ? 0.75 : 0.5}"/>`;
  }
  let fig = "";
  const v = st.vingar;
  if (v) fig += vinge({ ...v.far, far: true }, u, lw);
  if (st.knopp) fig += vingknopp([st.knopp[1][0], st.knopp[1][1]], st.knopp[1][2], u, lw, true);
  if (!st.svans.fram) fig += svans(st.svans, u, lw);
  if (st.farBak) fig += ben(st.farBak, u, lw, { far: true, guldklor: st.guld?.klor });
  if (st.farFram) fig += ben({ ...st.farFram, klass: st.fram.klass ? "bd-ben-steg-far" : "" }, u, lw, { far: true, guldklor: st.guld?.klor });
  if (st.rygg) fig += ryggfjall(st.rygg.c, st.rygg.n, st.rygg.s, u, lw, st.rygg.guld || 0);
  // Fjällen fortsätter upp längs halsens baksida (ungdom och äldre).
  if (st.rygg && st.hals && st.niva >= 5) {
    const [p0, , , p3] = st.hals.c;
    const dx = p3[0] - p0[0], dy = p3[1] - p0[1], l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l;
    const c = st.hals.c.map(([x, y], i) => {
      const w = (i < 2 ? st.hals.w0 : st.hals.w1) * 0.5;
      return [x + nx * w, y + ny * w];
    });
    fig += ryggfjall(c, Math.round(st.rygg.n * 0.45), st.rygg.s * 0.85, u, lw, st.rygg.guld || 0, { fran: 0.1, till: 0.85 });
  }
  fig += kroppSvg(st, u, lw);
  fig += kroppGuld(st, u, lw);
  // Ljussvep längs fjällen (gesten "ljussvep", nivå 14–15).
  if (st.niva >= 14) {
    fig += `<g clip-path="url(#${u}kc)"><g transform="rotate(20 ${bx} ${by})"><rect class="bd-svep" x="${bx - 12}" y="${by - 120}" width="18" height="240" fill="#FFF6C8"/></g></g>`;
  }
  fig += ben(st.bak, u, lw, { guldklor: st.guld?.klor });
  fig += ben(st.fram, u, lw, { guldklor: st.guld?.klor });
  if (st.svans.fram) fig += svans(st.svans, u, lw);
  if (v) fig += vinge(v.nar, u, lw);
  if (st.knopp) fig += vingknopp([st.knopp[0][0], st.knopp[0][1]], st.knopp[0][2], u, lw);

  const h = st.huvud;
  const hx = h.x, hy = h.y;
  let huv = `<g transform="translate(${hx} ${hy}) rotate(${h.tilt}) scale(${h.s})">${huvud(h, u, lw / h.s)}</g>`;
  if (st.ande) {
    // Diskret magisk andedräkt: små gnistor framför munnen.
    const mx = hx + 30 * h.s, my = hy + 18 * h.s;
    huv += `<g class="bd-ande">` + gnista(mx + 8, my + 2, 4, "#FFF3B8") + gnista(mx + 18, my - 4, 3, "#C9F6FF") + gnista(mx + 26, my + 4, 2.4, "#E7DBFF") + `</g>`;
  }
  fig += `<g class="bd-huvud" style="transform-origin:${r1(hx - 6)}px ${r1(hy + 16)}px">${huv}</g>`;
  // Gnistor vid vingspetsarna (nivå 11+ gesten "partiklar" tänder dem).
  if (v && st.niva >= 11) {
    fig += `<g class="bd-gnistor">` + [0, 1, 2].map((i) => gnista(bx - 40 - i * 26, by - 110 + i * 14, 3 - i * 0.4, "#FFF3B8")).join("") + `</g>`;
  }
  return s + `<g class="bd-andas" style="transform-origin:${pivot[0]}px ${pivot[1]}px">${fig}</g>`;
}
