// ============================================================================
// Pluggporten – port → hem (T10) i Pixi: profil + egen yta (#424, S6 i #396)
// ----------------------------------------------------------------------------
// Inloggningens "gå in genom porten" spelas av Pixi-workern (F1) på en EGEN,
// fixerad canvas medan appen bygger världen på main-tråden. Laddas bara via
// import() från port-overgang.js när login-sidan är i vila – aldrig i
// bootgrafen. Inloggningen väntar ALDRIG på något här: spelaPort() är
// synkron och svarar "inte redo" → port-overgang.js kör dagens CSS-overlay.
//
// Förvärmning (idle på login-sidan, forvarmPort):
//   • ensureRenderare() + en canvas i body (position:fixed, z-index -1 – under
//     port-scenen, alltså osynlig) med en egen Yta.
//   • Port-SVG:n speglas (F2) i TVÅ lager, eftersom grindhalvorna ligger mitt i
//     SVG:n: BAK (himmel, kullar, träd, mur) och FRAM (pelare, valv, buskar,
//     trappa). Båda blir pyramider (F3) kring portöppningen, z 1 → 6.5 (FRAM
//     bara så långt den syns, synligTill).
//   • Allt som rör sig (sol, moln, fåglar, vimplar, skylt) och grindhalvorna
//     speglas som egna sprites i sina LOKALA koordinater (speglaNod). Deras
//     pose läses först vid spelet (getScreenCTM) → bilden blir exakt DOM:ens,
//     och SVG:ns inbäddade <style>-animationer ritas aldrig (F2-noten).
//   • Klar → en vila-bild förpresenteras på canvasen. Medan inloggningen
//     väntar på servern (formulärets submit) uppdateras vila-bilden varje frame
//     med aktuella poser, så canvasen alltid visar porten som den ser ut nu.
//
// Spelet (spelaPort, synkront vid lyckad inloggning):
//   canvasen lyfts över overlayt (z 3001; overlayt = .port-overgang med sin
//   #bde3f5-bakgrund, z 3000) och workern spelar tidslinjen (varld-port-anim):
//   halvorna scaleX 1→0.07 500 ms kring gångjärnen, zoomen 1→6.5 kring
//   (480,428) från 260 ms i 900 ms. Gruppopaciteten (svg:ns opacity 0.4s ease
//   0.6s) = WAAPI på canvasen → kompositorn, oberoende av main-tråden.
//   efterPort() när overlayt städas (1410 ms): canvasen bort, texturerna släpps.
// Spår: overlay.dataset.pixiSpel (port-overgang.js) + window.__ppPixi.port.
// ============================================================================

import { ensureRenderare, pixiMojlig, pixiFlaggor } from "./varld-render.js";
import { tidslinjeState } from "./varld-render-tidslinje.js";
import { speglaLager, speglaNod } from "./varld-spegel.js";
import { avkodaSpegel, byggPyramid, stallIn, konfiguration, texturCache, koa } from "./varld-textur.js";
import { urlFlaggor } from "./varld-motor-hud.js";
import { PORT_TIDER, PORT_SPEL_MS, portOrigo, portTidslinje, synligTill } from "./varld-port-anim.js";

const BAK_AMB = [".portb-sol", ".hus-moln", ".portb-fagel-bob", ".port-halva"];
const FRAM_AMB = [".portb-vimpel", ".portb-skylt"];
const HALVOR = { "port-halva-vanster": "left", "port-halva-hoger": "right" };
/** Workerns första frame efter postMessage ≈ en frame → tonens start förskjuts lika mycket. */
const FORSKJUTNING_MS = 16;
const UPPDATERA_MAX_MS = 10000;
const LRU_NYCKEL = "port";

/** Profilen (§2.4): ambient = sprites med egen pose, ignorera = HTML ovanpå scenen. */
export default {
  id: "port",
  ambient: [...BAK_AMB, ...FRAM_AMB],
  objekt: null,
  ignorera: [".port-login", ".port-larare-rad"],
  malSelektor: null,
  fangst: "lager",
};

// Spegel-profiler för de två baslagren (rot = port-SVG:n).
const BAK = { ambient: BAK_AMB, ignorera: ["#port-halva-vanster ~ *", "style"], fangst: "lager" };
const FRAM = { ambient: FRAM_AMB, ignorera: [":scope > :not(#port-halva-hoger ~ *)"], fangst: "lager" };

let renderare = null;
let canvas = null; // en per renderare (transferControlToOffscreen går bara en gång)
let yta = null;
let ytMatt = "";
let st = null; // förvärmd port: { scen, svg, matt, origo, nivaer, sprites, ordning, ids, bytes, redo, slappt }
let spel = null; // { fade, t0 }
let uppdatering = 0;

const info = { lage: "ej-startad", orsak: null, senaste: null, bygg: null };
try { if (window.__ppPixi) window.__ppPixi.port = info; } catch { /* ingen window */ }
const debug = (...a) => { if (pixiFlaggor().debug) console.info("[pp:pixi:port]", ...a); };

// ---- Förvärmning ---------------------------------------------------------------

/**
 * Förvärm Pixi-vägen för porten (idle på login-sidan). Kastar aldrig.
 * @param {HTMLElement|null} scen  .port-scen
 */
export async function forvarmPort(scen) {
  try {
    urlFlaggor();
    if (!scen?.isConnected || !pixiMojlig()) return satt("av", window.__ppPixi?.orsak || "ej-mojlig");
    if (st && st.scen === scen && !st.slappt) return;
    const r = await ensureRenderare();
    if (!r) return satt("av", window.__ppPixi?.orsak || "ingen-renderare");
    if (!scen.isConnected || spel) return;
    stallIn({ maxTex: r.maxTex });
    kopplaCanvas(r, scen);
    await bygg(scen);
  } catch (err) {
    console.warn("[pp:pixi] port-förvärmningen misslyckades:", err);
    slappAllt();
    satt("fel", String(err?.message || err));
  }
}

function satt(lage, orsak = null) {
  info.lage = lage;
  info.orsak = orsak;
}

const mattFor = (scen) => {
  const r = scen.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, dpr: konfiguration().dpr };
};

function kopplaCanvas(r, scen) {
  if (renderare !== r) {
    canvas?.remove();
    canvas = null;
    renderare = r;
  }
  const m = mattFor(scen);
  const nyckel = `${m.w}x${m.h}@${m.dpr}`;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "pp-port-pixi";
    canvas.setAttribute("aria-hidden", "true");
    yta = r.skapaYta(canvas, { w: m.w, h: m.h, dpr: m.dpr });
    ytMatt = nyckel;
  } else if (nyckel !== ytMatt) {
    yta.resize(m.w, m.h, m.dpr);
    ytMatt = nyckel;
  }
  canvas.style.cssText = `position:fixed;left:${m.x}px;top:${m.y}px;width:${m.w}px;height:${m.h}px;` +
    "z-index:-1;pointer-events:none;opacity:1";
  if (!canvas.isConnected) document.body.appendChild(canvas);
}

/** Spegla + rastrera portens lager och sprites, ladda upp dem i workern. */
async function bygg(scen) {
  slappAllt();
  const svg = scen.querySelector(":scope > svg");
  if (!svg?.querySelector("#port-halva-vanster") || !svg.querySelector("#port-halva-hoger")) return satt("av", "ingen-grind");
  const t0 = performance.now();
  const matt = mattFor(scen);
  const s = { scen, svg, matt, origo: portOrigo(matt.w, matt.h), nivaer: [], sprites: [], ordning: [], ids: [], bytes: 0, redo: false, slappt: false };
  st = s;
  satt("bygger");
  const vy = { x: 0, y: 0, w: matt.w, h: matt.h };
  // Speglingarna görs SYNKRONT nu (konsistent ögonblicksbild), resten strömmas.
  const bakP = speglaLager(svg, null, BAK);
  const framP = speglaLager(svg, null, FRAM);
  const framZ = synligTill(unionRekt([...svg.querySelectorAll(":scope > #port-halva-hoger ~ *")], svg), s.origo, vy, PORT_TIDER.zoom);
  const noder = [...svg.querySelectorAll([...BAK_AMB, ...FRAM_AMB].join(","))];
  const spriteP = noder.map((nod, i) => spegelSprite(s, nod, `port-s${i}`, vy));
  const [bak, fram, sprites] = await Promise.all([
    pyramid(s, "bak", await bakP, PORT_TIDER.zoom, vy),
    pyramid(s, "fram", await framP, framZ, vy),
    Promise.all(spriteP),
  ]);
  if (s.slappt || st !== s) return;
  // Ritordning: BAK-nivåer, bak-sprites + halvor, FRAM-nivåer, fram-sprites.
  const framSprites = sprites.filter((x) => x.fram), bakSprites = sprites.filter((x) => !x.fram);
  s.sprites = sprites;
  s.nivaer = [...bak, ...fram];
  s.ordning = [...bak, ...bakSprites, ...fram, ...framSprites].map((x) => x.id);
  texturCache().lagg(LRU_NYCKEL, s.bytes, () => { if (!spel) slappAllt(); });
  s.redo = true;
  info.bygg = { ms: Math.round(performance.now() - t0), MB: +(s.bytes / 1048576).toFixed(1), bak: bak.length, fram: fram.length, framZ: +framZ.toFixed(2), sprites: sprites.length };
  satt("redo");
  debug("redo", info.bygg);
  await yta.visaVila(tidslinjeState(tidslinje(s), 0)).catch(() => {});
  lyssna(s);
}

/** Unionen av elementens skärmrutor i scenens px. */
function unionRekt(els, svg) {
  const r0 = svg.getBoundingClientRect();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of els) {
    const b = e.getBoundingClientRect();
    if (!b.width && !b.height) continue;
    x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
  }
  if (x0 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  const pad = 8;
  return { x: x0 - r0.left - pad, y: y0 - r0.top - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

/** En spegels pyramid kring portöppningen → en behållare per nivå i workern. */
async function pyramid(s, namn, spegel, zMax, vy) {
  const a = await avkodaSpegel({ ...spegel, nyckel: "" });
  if (s.slappt) return [];
  const jobb = byggPyramid(a, { originPx: s.origo, zMin: 1, zMax, vy }, "idle");
  s.avbryt = [...(s.avbryt || []), () => jobb.avbryt()];
  const satta = [];
  jobb.onNiva((niva) => {
    if (s.slappt) { for (const t of niva.tegel) t.bmp?.close?.(); return; }
    const id = `port-${namn}@${niva.z}`;
    s.ids.push(id);
    s.bytes += niva.bytes;
    satta.push(yta.satLager(id, { nivaer: [niva] }).then(() => ({ id, z: niva.z })));
  });
  await jobb.allt;
  return (await Promise.all(satta)).sort((x, y) => x.z - y.z);
}

/** Lagrets px ← nodens lokala koordinater (inkl. nodens aktuella transform/animation). */
function bas(s, nod) {
  const r = s.svg.getBoundingClientRect();
  const m = new DOMMatrix([1, 0, 0, 1, -r.left, -r.top]).multiply(DOMMatrix.fromMatrix(nod.getScreenCTM()));
  return [m.a, m.b, m.c, m.d, m.e, m.f];
}

/** Spegla en ambient-nod/grindhalva i lokala koordinater och rastrera den. */
async function spegelSprite(s, nod, id, vy) {
  const ns = await speglaNod(nod, s.svg); // synkron genomgång direkt i anropet
  const halva = HALVOR[nod.id];
  let gangjarn = null;
  if (halva) {
    // .port-halva: transform-box fill-box, origin left/right center (styles.css).
    const bb = nod.getBBox();
    gangjarn = { x: halva === "left" ? bb.x : bb.x + bb.width, y: bb.y + bb.height / 2 };
  }
  const r0 = s.svg.getBoundingClientRect(), b = nod.getBoundingClientRect();
  const zVis = synligTill({ x: b.left - r0.left, y: b.top - r0.top, w: b.width, h: b.height }, s.origo, vy, PORT_TIDER.zoom);
  const m = bas(s, nod);
  const k0 = konfiguration();
  const { w, h, x, y } = ns.rect;
  const k = Math.min(zVis * k0.dpr * Math.hypot(m[0], m[1]), k0.budget.tegel / Math.max(w, h, 1));
  const a = await avkodaSpegel({ svg: ns.svg, w, h, ox: x, oy: y, nyckel: "" });
  const W = Math.max(1, Math.ceil(w * k)), H = Math.max(1, Math.ceil(h * k));
  let bmp = null;
  await koa(() => {
    const duk = new OffscreenCanvas(W, H);
    duk.getContext("2d").drawImage(a.img, 0, 0, W, H);
    bmp = duk.transferToImageBitmap();
  }, "idle");
  if (s.slappt) { bmp?.close(); return { id, nod }; }
  s.ids.push(id);
  s.bytes += W * H * 4;
  await yta.satLager(id, { nivaer: [{ z: 1, region: { x, y, w, h }, tegel: [{ bmp, x, y, w, h }], bytes: W * H * 4 }] });
  return { id, nod, alpha: ns.opacity, gangjarn, fram: nod.matches(FRAM_AMB.join(",")) };
}

/** Tidslinjen med nodernas poser JUST NU. */
function tidslinje(s) {
  return portTidslinje({
    origo: s.origo,
    nivaer: s.nivaer,
    sprites: s.sprites.map((x) => ({ id: x.id, bas: bas(s, x.nod), alpha: x.alpha, gangjarn: x.gangjarn })),
  }, s.ordning);
}

// ---- Medan inloggningen väntar: håll vila-bilden aktuell ------------------------

function lyssna(s) {
  const form = s.scen.querySelector("form");
  const start = () => uppdatera(s);
  form?.addEventListener("submit", start);
  const koll = () => setTimeout(() => {
    if (s.scen.isConnected || spel) return;
    if (st === s) slappAllt(); // lämnade login-sidan utan att logga in
  }, 0);
  window.addEventListener("hashchange", koll);
  let rt = 0;
  const resize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (st !== s || spel || !s.scen.isConnected) return;
      slappAllt(); // nya mått → alla texturer ogiltiga; bygg om i idle
      const igen = () => forvarmPort(s.scen);
      window.requestIdleCallback ? requestIdleCallback(igen, { timeout: 2000 }) : setTimeout(igen, 200);
    }, 300);
  };
  window.addEventListener("resize", resize);
  s.lossa = () => {
    form?.removeEventListener("submit", start);
    window.removeEventListener("resize", resize);
    window.removeEventListener("hashchange", koll);
  };
}

function uppdatera(s) {
  const nr = ++uppdatering;
  const t0 = performance.now();
  let vantar = false;
  const steg = () => {
    if (nr !== uppdatering || st !== s || !s.redo || spel || !s.scen.isConnected || performance.now() - t0 > UPPDATERA_MAX_MS) return;
    if (!vantar) {
      vantar = true;
      yta.visaVila(tidslinjeState(tidslinje(s), 0)).catch(() => {}).finally(() => { vantar = false; });
    }
    requestAnimationFrame(steg);
  };
  requestAnimationFrame(steg);
}

// ---- Spelet --------------------------------------------------------------------

/** Varför porten inte kan spelas via Pixi just nu (synkront), eller null. */
function hinder(scen) {
  if (pixiFlaggor().av) return "av";
  if (document.hidden) return "dold-flik";
  if (!renderare || !yta || !canvas) return "ingen-renderare";
  if (renderare.dod) return renderare.dodOrsak || "dod";
  if (!st || st.slappt) return "ej-forvarmd";
  if (st.scen !== scen) return "annan-scen";
  if (!st.redo) return "ej-redo";
  const m = mattFor(scen);
  if (Math.abs(m.w - st.matt.w) > 0.5 || Math.abs(m.h - st.matt.h) > 0.5 || m.dpr !== st.matt.dpr) return "storlek";
  return null;
}

/**
 * Spela port → hem via Pixi (SYNKRONT; väntar aldrig). Anroparen har redan lagt
 * .port-overgang-overlayt (z 3000) över scenen och städar det efter 1410 ms.
 * @param {HTMLElement} scen
 * @returns {{vag:"pixi"} | {vag:"css", orsak:string}}
 */
export function spelaPort(scen) {
  const orsak = hinder(scen);
  if (orsak) {
    info.senaste = { vag: "css", orsak, t: Math.round(performance.now()) };
    return { vag: "css", orsak };
  }
  const s = st;
  uppdatering++; // stoppa vila-uppdateringen
  const tl = tidslinje(s); // poserna NU – samma bild som canvasen just visar
  texturCache().las(LRU_NYCKEL);
  const t0 = performance.now();
  spel = { t0, fade: null };
  // Canvasen visar redan (senast presenterade) vila-bilden → lyft den direkt.
  canvas.style.zIndex = "3001";
  const T = PORT_TIDER;
  try {
    spel.fade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: T.fadeMs, delay: T.zoomStartMs + T.fadeDelayMs + FORSKJUTNING_MS, easing: T.fadeEase, fill: "forwards",
    });
  } catch { /* utan WAAPI: overlayt städas ändå vid 1410 ms */ }
  info.senaste = { vag: "pixi", t: Math.round(t0) };
  yta.spela({ ms: PORT_SPEL_MS, tidslinje: tl }).then(
    (res) => {
      const f = res.frames || [];
      info.senaste = { ...info.senaste, n: f.length + 1, maxDt: f.length ? Math.max(...f) : 0, ms: Math.round(performance.now() - t0), ...(res.avbruten ? { avbruten: true } : {}) };
      debug("spelad", info.senaste);
    },
    (err) => {
      console.warn("[pp:pixi] port-övergången i Pixi föll:", err);
      info.senaste = { ...info.senaste, fel: String(err?.message || err) };
    },
  );
  return { vag: "pixi" };
}

/** Overlayt är borta (port-overgang.js, 1410 ms): canvasen bort, texturerna släpps. */
export function efterPort() {
  try {
    if (spel) {
      spel.fade?.cancel();
      spel = null;
      texturCache().lasUpp(LRU_NYCKEL);
    }
    canvas?.remove();
    if (canvas) canvas.style.zIndex = "-1";
    yta?.rensa();
    slappAllt();
  } catch (err) {
    console.warn("[pp:pixi] port-städningen:", err);
  }
}

/** Släpp portens texturer i workern (pyramider + sprites). */
function slappAllt() {
  const s = st;
  st = null;
  uppdatering++;
  if (!s) return;
  s.slappt = true;
  s.lossa?.();
  for (const f of s.avbryt || []) { try { f(); } catch { /* redan klar */ } }
  for (const id of s.ids) yta?.slappLager(id);
  s.ids = [];
  try { texturCache().slapp(LRU_NYCKEL); } catch { /* fanns inte */ }
  if (info.lage === "redo" || info.lage === "bygger") satt("slappt");
}
