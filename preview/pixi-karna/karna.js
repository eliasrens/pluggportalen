// ============================================================================
// Preview för Pixi-kärnan (#415, F1 i epic #396) – INTE appkod, ingår aldrig i
// bootgrafen. Visar hela F1-kedjan: ensureRenderare → skapaYta → satLager
// (testpyramid) → visaVila → spela, plus fallback-stegen (context-loss → CSS,
// vendor-404 → null). Speglingen/pyramiden här är PoC-ersättare för F2/F3.
// ============================================================================

import { husScen } from "../../src/art-hus-ute.js";
import { avatarMarkup } from "../../src/avatars.js";
import { createKamera } from "../../src/varld-kamera.js";
import { lagerState, vilaState } from "../../src/varld-render-anim.js";
import { speglaLager, avkoda, rastrera, pyramidRegion } from "../pixi-poc-397/spegel.js";

const $ = (id) => document.getElementById(id);
const dpr = window.devicePixelRatio || 1;
const W = 640, H = 400;
const HUS_ZOOM = 5;
const HUS_FOKUS = { x: 48.5, y: 52 }; // husets fönster

// Ett enkelt rum (inre lagret) – fyller hela staget som rum-lagret i appen.
const RUM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" preserveAspectRatio="none">
  <rect width="640" height="260" fill="#f6e3c6"/><rect y="260" width="640" height="140" fill="#c99b6d"/>
  <rect x="250" y="60" width="140" height="110" rx="8" fill="#9fd3f0" stroke="#7a5236" stroke-width="8"/>
  <line x1="320" y1="60" x2="320" y2="170" stroke="#7a5236" stroke-width="6"/>
  <rect x="70" y="200" width="150" height="90" rx="10" fill="#6f9fd8"/><rect x="60" y="180" width="40" height="110" rx="10" fill="#4f7fb8"/>
  <circle cx="500" cy="300" r="34" fill="#f2b56b"/><text x="320" y="370" font-size="28" text-anchor="middle" font-family="system-ui" fill="#7a5236">Rummet</text>
</svg>`;

// --- DOM-sidan: riktiga kameran ---------------------------------------------
const scen = husScen(avatarMarkup("fox", ["keps", "halsduk"]), { skylt: { rad1: "Klass 4B", rad2: "– Solbyn –" } });
$("dom-hus").innerHTML = scen;
$("dom-rum").innerHTML = RUM_SVG;
const domStage = $("dom-stage");
const kamera = createKamera({
  nivaer: [
    { id: "hus", el: $("dom-hus"), fokus: HUS_FOKUS, zoom: HUS_ZOOM },
    { id: "rum", el: $("dom-rum"), fokus: { x: 50, y: 50 }, zoom: 6 },
  ],
  startId: "hus",
});

/** Kamerans geometri (NivaGeo) mätt ur DOM:en i vila. */
function geometri() {
  // Lagren kan stå skalade – boxen ska vara den OSKALADE (offset-mått, stage-px).
  const box = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  return [
    { id: "hus", box: box($("dom-hus")), fokus: HUS_FOKUS, zoom: HUS_ZOOM },
    { id: "rum", box: box($("dom-rum")), fokus: { x: 50, y: 50 }, zoom: 6 },
  ];
}

// --- Logg -------------------------------------------------------------------
const tillstand = { k: 0, spelningar: [] };
function logg(extra = {}) {
  Object.assign(tillstand, extra);
  const p = window.__ppPixi || {};
  const s = p.senaste;
  $("status").textContent = p.vag ? `${p.vag}${p.orsak ? ` (${p.orsak})` : ""}` : "startar…";
  $("status").dataset.vag = p.vag || "";
  $("logg").textContent = JSON.stringify({
    vag: p.vag, orsak: p.orsak, maxTex: p.maxTex, dod: p.dod, flaggor: p.flaggor?.(),
    senaste: s && { vag: s.vag, orsak: s.orsak, n: s.n, maxDt: s.maxDt, ms: s.ms, avbruten: s.avbruten },
    ...tillstand,
  }, null, 2);
}

// --- Pixi-sidan -------------------------------------------------------------
let render = null; // modulen (dynamisk, som i appen)
let yta = null;
let ytaFor = null; // vilken renderare ytan hör till

/** Testpyramid för hus-lagret (ytter-roll, z 1 → 5 kring fönstret) + rummet (z 1). */
async function byggScener() {
  await document.fonts.ready;
  const t0 = performance.now();
  const husEl = $("dom-hus");
  const spegel = await speglaLager(husEl, domStage);
  const img = await avkoda(spegel);
  const F = { x: husEl.offsetWidth * HUS_FOKUS.x / 100, y: husEl.offsetHeight * HUS_FOKUS.y / 100 };
  const zs = [];
  for (let z = 1; z < HUS_ZOOM; z *= 1.5) zs.push(z);
  zs.push(HUS_ZOOM);
  const husNivaer = [];
  for (const z of zs) {
    const region = pyramidRegion(spegel, F, z);
    const r = await rastrera(spegel, img, region, Math.round(W * dpr), Math.round(H * dpr));
    husNivaer.push({ z, region, tegel: [{ bmp: r.bmp, ...region }], bytes: r.bmp.width * r.bmp.height * 4 });
  }
  // Rummet: en nivå, hela lagret (= staget) i stage-upplösning.
  const rumImg = await avkoda({ svg: RUM_SVG.replace("<svg ", `<svg width="${W}" height="${H}" `) });
  const c = new OffscreenCanvas(Math.round(W * dpr), Math.round(H * dpr));
  c.getContext("2d").drawImage(rumImg, 0, 0, c.width, c.height);
  const rumBmp = c.transferToImageBitmap();
  const rumRegion = { x: 0, y: 0, w: W, h: H };
  const rumNivaer = [{ z: 1, region: rumRegion, tegel: [{ bmp: rumBmp, ...rumRegion }], bytes: rumBmp.width * rumBmp.height * 4 }];
  await yta.satLager("hus", { nivaer: husNivaer, nyckel: "hus-test" });
  await yta.satLager("rum", { nivaer: rumNivaer, nyckel: "rum-test" });
  logg({ pyramid: { husNivaer: zs.map((z) => +z.toFixed(3)), ms: Math.round(performance.now() - t0), bitmapNeutrerad: rumBmp.width === 0 } });
}

/** Renderaren + ytan, eller null (CSS-väg). Ytan skapas en gång per renderare. */
async function pixiRedo() {
  render ??= await import("../../src/varld-render.js");
  const r = await render.ensureRenderare();
  if (!r) return null;
  if (ytaFor !== r) {
    yta = r.skapaYta($("pixi-canvas"), { dpr, w: W, h: H });
    ytaFor = r;
    r.onDod(() => logg({ onDod: `fick dod (${window.__ppPixi.orsak})` }));
    await byggScener();
    await yta.visaVila(vilaState(geometri(), tillstand.k)); // vilo-bilden = DOM:en bredvid
  }
  return r;
}

let spelar = false;
async function spela(longTask = false) {
  if (spelar) return;
  spelar = true;
  try {
    const geo = geometri();
    const k = tillstand.k;
    const m = k === 0 ? 1 : 0;
    const origo = Math.min(k, m);
    const r = await pixiRedo();
    if (longTask) setTimeout(() => { const t = performance.now(); while (performance.now() - t < 400); }, 200);
    if (!r) {
      render.noteraCssVag(window.__ppPixi.orsak);
      await kamera.gaTill(geo[m].id);
    } else {
      const fran = vilaState(geo, k);
      const till = lagerState(geo, m, origo);
      await yta.visaVila(fran);
      const [svar] = await Promise.all([yta.spela({ fran, till }), kamera.gaTill(geo[m].id)]);
      const f = svar.frames;
      tillstand.spelningar.push({
        riktning: m === 1 ? "in" : "ut", longTask, frames: f.length,
        maxDt: f.length ? Math.max(...f) : 0, luckaOver300: f.some((d) => d >= 300), avbruten: !!svar.avbruten,
      });
      // Canvasen behåller slutbilden (jämför med DOM:en bredvid); "Rensa canvas" tömmer.
    }
    tillstand.k = m;
  } finally {
    spelar = false;
    logg();
  }
}

$("b-spela").onclick = () => spela(false);
$("b-spela-lt").onclick = () => spela(true);
$("b-rensa").onclick = () => {
  yta?.rensa();
  logg({ rensaKlickad: window.__ppPixi?.flaggor().frys ? "frys: ingen rensning" : true });
};
$("b-doda").onclick = () => {
  window.__ppPixi?.forloraKontext();
  setTimeout(() => logg({ dodaKlickad: true }), 300);
};
$("b-aterstall").onclick = () => {
  window.__ppPixi?.aterstallKontext();
  setTimeout(() => logg({ aterstallKlickad: true }), 300);
};

// Värm upp direkt (som motorn gör i idle) så första "Spela" går via Pixi.
pixiRedo().then((r) => logg({ init: r ? "pixi" : "css" }), (err) => logg({ initFel: String(err) }));
logg();
