// ============================================================================
// Pluggporten – motorns ÖVERLÄGG: profilens sprites + hovrat/fokuserat objekt
// som egna behållare ovanpå basen (#396, F4 #418 / F4b #428)
// ----------------------------------------------------------------------------
// Utbruten ur varld-motor-textur.js (400-raderstaket). Speglas SYNKRONT vid
// handoff (frusen pose), rastreras på main (OffscreenCanvas) och skickas till
// workern som en nivå med z=1000 (ritas alltid). Ritordning = ids-ordningen:
// sprites i DOM-ordning, sedan fokus-överläggen, sist lagrets emoji som
// text-sprites när emoji-reserven är på (G1 #425, varld-emoji.js).
// Laddas bara via import() – aldrig i bootgrafen.
// ============================================================================

import { speglaNod } from "./varld-spegel.js";
import { konfiguration } from "./varld-textur.js";
import { profilFor } from "./varld-motor-textur.js";
import { doljEmoji, emojiOverlagg } from "./varld-emoji.js";

const sel = (v) => (Array.isArray(v) ? v.join(",") : v || "");

let ovlNr = 0;

async function avkodaSvg(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const alla = (el, s) => {
  if (!s) return [];
  try { return [...el.querySelectorAll(s)]; } catch { return []; } // ogiltig selektor i en profil
};
const ytterst = (noder) => noder.filter((n) => !noder.some((m) => m !== n && m.contains(n)));

/**
 * Spegla lagrets sprites (alla, DOM-ordning) och hovrade/fokuserade objekt
 * (synkront NU, frusen pose) och lägg dem som egna behållare i workern,
 * rastrerade för största skalan `maxSkala`. ids = ritordning (ovanpå basen).
 * @returns {{ids:string[], klart:Promise<void>, sprites:number}}
 */
export function overlagg(el, maxSkala, yta) {
  const p = profilFor(el);
  const spr = sel(p.sprites);
  const sprites = ytterst(alla(el, spr)).filter((n) => n.getClientRects().length);
  let fokus = alla(el, sel(p.objekt)).filter((n) => n.matches(":hover") || n.matches(":focus-visible"));
  // Det innersta hovrade objektet (tomten, inte hela byn); redan sprite → klart.
  fokus = fokus.filter((n) => !fokus.some((m) => m !== n && n.contains(m)) && !(spr && n.closest(spr))).slice(0, 2);
  const noder = [...sprites, ...fokus];
  const ids = [];
  const jobb = noder.map((nod) => {
    const id = `ovl${++ovlNr}`;
    ids.push(id);
    return speglaNod(nod, el, { bildZoom: maxSkala }).then(async (ns) => {
      const img = await avkodaSvg(doljEmoji({ svg: ns.svg, nyckel: "" }).svg);
      const m = DOMMatrix.fromMatrix(ns.matrix).translate(ns.rect.x, ns.rect.y);
      const hörn = [[0, 0], [ns.rect.w, 0], [0, ns.rect.h], [ns.rect.w, ns.rect.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      const bx = Math.min(...hörn.map((p) => p.x)), by = Math.min(...hörn.map((p) => p.y));
      const bw = Math.max(...hörn.map((p) => p.x)) - bx, bh = Math.max(...hörn.map((p) => p.y)) - by;
      const k = konfiguration();
      const skala = Math.min(maxSkala * k.dpr, k.budget.tegel / Math.max(bw, bh, 1));
      const W = Math.max(1, Math.ceil(bw * skala)), H = Math.max(1, Math.ceil(bh * skala));
      const duk = new OffscreenCanvas(W, H);
      const ctx = duk.getContext("2d");
      ctx.setTransform(skala, 0, 0, skala, -bx * skala, -by * skala);
      ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.globalAlpha = ns.opacity;
      ctx.drawImage(img, 0, 0, ns.rect.w, ns.rect.h);
      const tegel = { bmp: duk.transferToImageBitmap(), x: bx, y: by, w: W / skala, h: H / skala };
      await yta.satLager(id, { nivaer: [{ z: 1e3, region: { x: bx, y: by, w: tegel.w, h: tegel.h }, tegel: [tegel], bytes: W * H * 4 }] });
    });
  });
  const em = emojiOverlagg(el, maxSkala, yta, sel(p.ignorera));
  return { ids: [...ids, ...em.ids], klart: Promise.all([...jobb, em.klart]).then(() => {}), sprites: sprites.length };
}
