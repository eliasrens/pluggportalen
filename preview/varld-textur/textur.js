// ============================================================================
// Preview för textur-pipelinen (#417, F3 i epic #396) – INTE appkod, ingår
// aldrig i bootgrafen. Visar hela F3-kedjan mot F1:s renderare:
//   spegla (PoC-ersättare för F2) → avkodaSpegel → byggPyramid (idle-kön) →
//   Yta.satLager → visaVila i scale(z) bredvid DOM:en i scale(z) → Evict
//   (TexturLRU → Yta.slappLager → workerns texturräknare → 0).
// window.__ppTextur = allt som klick-testet läser.
// ============================================================================

import { husScen } from "../../src/art-hus-ute.js";
import { avatarMarkup, AVATARS } from "../../src/avatars.js";
import { mountByScen } from "../../src/varld-by-scen.js";
import { ROOM_PALETTES } from "../../src/room-palettes.js";
import { speglaLager } from "./spegel-ersattare.js";

// Som i appen: pipelinen och renderaren laddas bara dynamiskt.
const T = await import("../../src/varld-textur.js");
const B = await import("../../src/varld-textur-budget.js");
const R = await import("../../src/varld-render.js");

const $ = (id) => document.getElementById(id);
const W = 640, H = 400;
const dprRa = window.devicePixelRatio || 1;
const domStage = $("dom-stage"), pixiStage = $("pixi-stage");
const husEl = $("dom-hus"), byEl = $("dom-by");

// --- Scenerna ----------------------------------------------------------------
husEl.innerHTML = husScen(avatarMarkup("fox", ["keps", "halsduk"]), { skylt: { rad1: "Klass 4B", rad2: "– Solbyn –" } });
const NAMN = ["Alva", "Bruno", "Cora", "Dante", "Ebba", "Frans", "Gun", "Hugo", "Ines", "Jack", "Kim", "Lova", "Malte",
  "Nora", "Olle", "Pia", "Rut", "Sam", "Tea", "Ulf", "Vera", "Wille", "Yra", "Zeb", "Åsa"];
const avatarer = Object.keys(AVATARS), paletter = Object.keys(ROOM_PALETTES);
const elever = NAMN.map((namn, i) => ({
  id: `e${i}`, namn, avatarId: avatarer[i % avatarer.length], paletteId: paletter[i % paletter.length],
  avatarItems: i % 3 === 0 ? ["keps"] : [],
}));
const by = mountByScen({ lager: byEl, meId: "e7", students: elever });
const HUS_FOKUS = { x: 48.5, y: 52 }; // T3: husets fönster

/** Rollerna: lagerId → DOM-lager, fokus i % av lagrets EGEN box, zoomintervall. */
const ROLLER = {
  "hus-t3": { el: husEl, scen: "hus", fokus: HUS_FOKUS, zMin: 1, zMax: 6 },
  "by-t2": { el: byEl, scen: "by", fokus: by.fokus, zMin: 1, zMax: 5 },
  // Inkommande lagret i T2: scale(1/5) kring BYNS fokus i % av husets box (apply()).
  "hus-t2-inre": { el: husEl, scen: "hus", fokus: by.fokus, zMin: 1 / 5, zMax: 1 },
};

const boxAv = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

/** Visa ett DOM-lager i scale(z) kring fokus (övriga gömda). */
function visaDom(roll, z) {
  for (const el of [husEl, byEl]) el.classList.toggle("tx-dold", el !== roll.el);
  roll.el.style.transformOrigin = `${roll.fokus.x}% ${roll.fokus.y}%`;
  roll.el.style.transform = z === 1 ? "" : `scale(${z})`;
  domStage.dataset.scen = pixiStage.dataset.scen = roll.scen;
}

// --- Pixi-renderaren ---------------------------------------------------------
let yta = null;
async function pixi() {
  const r = await R.ensureRenderare();
  if (!r) throw new Error(`Pixi-vägen ej tillgänglig: ${window.__ppPixi?.orsak}`);
  if (!yta) {
    yta = r.skapaYta($("pixi-canvas"), { dpr: dprRa, w: W, h: H });
    T.stallIn({ maxTex: r.maxTex, klass: $("s-klass").value || undefined });
  }
  return yta;
}

// --- Logg ----------------------------------------------------------------------
const S = (window.__ppTextur = { scener: {}, visar: null, evict: null, fel: null });
function logg(extra = {}) {
  Object.assign(S, extra);
  const k = T.konfiguration();
  const cache = T.texturCache();
  S.konfig = { klass: k.klass, dprRa: k.dprRa, dpr: k.dpr, budget: k.budget };
  S.bytes = cache.summa();
  S.cacheNycklar = cache.nycklar();
  S.ko = T.koStats();
  $("status").textContent = S.fel ? `fel: ${S.fel}` : (S.visar ? `${S.visar.lagerId} z=${S.visar.z}` : "redo");
  $("logg").textContent = JSON.stringify(S, (key, v) => (typeof v === "number" ? +v.toFixed(4) : v), 2);
}

// --- Bygg ----------------------------------------------------------------------
const MB = 1024 * 1024;

/** Spegla + avkoda + bygg pyramiden för EN roll och lägg den i workern. */
async function byggRoll(lagerId) {
  const roll = ROLLER[lagerId];
  const y = await pixi();
  visaDom(roll, 1);
  await document.fonts.ready;
  const box = boxAv(roll.el);
  const origin = { x: (box.w * roll.fokus.x) / 100, y: (box.h * roll.fokus.y) / 100 };
  const vy = { x: -box.x, y: -box.y, w: W, h: H }; // stagets synliga yta i lager-px
  // Inkommande lagret syns nedkrympt → fånga hela ytan som syns vid zMin.
  const fangst = roll.zMin < 1
    ? { x: origin.x + (vy.x - origin.x) / roll.zMin, y: origin.y + (vy.y - origin.y) / roll.zMin, w: W / roll.zMin, h: H / roll.zMin }
    : vy;
  const spegel = await speglaLager(roll.el, domStage, fangst);
  const a = await T.avkodaSpegel(spegel);
  // Låt sidans egen målning av lagerbytet bli klar – den hör inte till bygget.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  T.nollstallKoStats();
  const longTasks = [];
  let obs = null;
  try {
    obs = new PerformanceObserver((l) => longTasks.push(...l.getEntries().map((e) => Math.round(e.duration))));
    obs.observe({ type: "longtask" });
  } catch { /* stöds inte */ }
  const t0 = performance.now();
  const jobb = T.byggPyramid(a, { originPx: origin, zMin: roll.zMin, zMax: roll.zMax, vy }, "idle");
  const tider = {};
  jobb.minimumKlart.then((n) => { tider.minimum = { ms: performance.now() - t0, nivaer: n.map((v) => v.z) }; });
  const nivaer = await jobb.allt;
  tider.allt = { ms: performance.now() - t0 };
  await new Promise((r) => setTimeout(r, 50)); // observer-posterna levereras asynkront
  obs?.disconnect();

  const meta = nivaer.map((n) => ({
    z: n.z, skala: n.skala, region: n.region, bytes: n.bytes, tegel: n.tegel.map((t) => [t.bmp.width, t.bmp.height]),
  }));
  const bytes = nivaer.reduce((s, n) => s + n.bytes, 0);
  const k = T.konfiguration();
  const zoomDel = meta.filter((n) => n.z >= 1);
  const kort = { lagerId, nyckel: jobb.nyckel, originPx: origin, nivaer: meta.map((n) => n.z) };
  S.scener[lagerId] = {
    ...kort, meta, box, bytes, MB: bytes / MB,
    maxForstoring: B.maxForstoring(zoomDel.length ? zoomDel : meta, k.dpr),
    maxForstoringUnder1: meta.some((n) => n.z < 1) ? B.maxForstoring(meta.filter((n) => n.z <= 1), k.dpr) : null,
    spegelMs: spegel.ms, spegelKB: Math.round(spegel.svg.length / 1024), avkodaMs: a.ms,
    minimumKlartMs: tider.minimum?.ms, minimumNivaer: tider.minimum?.nivaer, alltMs: tider.allt.ms,
    minimumForeAllt: tider.minimum != null && tider.minimum.ms <= tider.allt.ms,
    langstaJobbMs: T.koStats().langstaJobbMs, langstaRutaMs: T.koStats().langstaRutaMs, jobb: T.koStats().jobb,
    tegel: meta.reduce((s, n) => s + n.tegel.length, 0),
    longTasksUnderBygget: longTasks,
  };
  await y.satLager(lagerId, { nivaer, nyckel: jobb.nyckel });
  S.scener[lagerId].bitmapsTransfererade = nivaer.every((n) => n.tegel.every((t) => t.bmp.width === 0));
  T.texturCache().lagg(lagerId, bytes, () => {
    y.slappLager(lagerId);
    delete S.scener[lagerId];
  });
  return S.scener[lagerId];
}

async function bygg(ids) {
  try {
    S.fel = null;
    for (const id of ids) await byggRoll(id);
    S.worker = await yta.stats();
    S.aktiv = ids[0];
    await visa(ids[0], 1);
  } catch (err) {
    S.fel = String(err?.message || err);
    console.error(err);
  }
  logg();
}

// --- Visa ----------------------------------------------------------------------
async function visa(lagerId, z) {
  const sc = S.scener[lagerId];
  if (!sc) {
    logg({ fel: `${lagerId} är inte byggd (klicka Bygg först)` });
    return;
  }
  const roll = ROLLER[lagerId];
  visaDom(roll, z);
  T.texturCache().rör(lagerId);
  const k = T.konfiguration();
  await yta.visaVila([{
    id: lagerId, box: sc.box, scale: z, opacity: 1, synlig: true, inert: false,
    originPx: { x: sc.box.x + sc.originPx.x, y: sc.box.y + sc.originPx.y },
  }]);
  const tackande = sc.meta.filter((n) => n.z <= z + 1e-9).map((n) => n.z);
  S.fel = null;
  logg({
    visar: {
      lagerId, z, forstoringKant: B.forstoringVid(sc.meta, z, k.dpr), forstoringKantSkarm: B.forstoringVid(sc.meta, z, dprRa),
      skarpasteTackande: tackande.length ? Math.max(...tackande) : sc.meta[0].z,
    },
  });
}

// --- Knappar -------------------------------------------------------------------
$("b-t3").onclick = () => bygg(["hus-t3"]);
$("b-t2").onclick = () => bygg(["by-t2", "hus-t2-inre"]);
for (const b of $("zoomknappar").querySelectorAll("[data-z]")) {
  b.onclick = () => visa(S.aktiv || "hus-t3", Number(b.dataset.z));
}
for (const b of $("zoomknappar").querySelectorAll("[data-inre]")) {
  b.onclick = () => visa("hus-t2-inre", Number(b.dataset.inre));
}
$("b-evict").onclick = async () => {
  const fore = { worker: await yta?.stats(), bytes: T.texturCache().summa(), poster: T.texturCache().nycklar() };
  T.texturCache().rensa();
  const efter = { worker: await yta?.stats(), bytes: T.texturCache().summa(), poster: T.texturCache().nycklar() };
  await yta?.visaVila([]);
  logg({ evict: { fore, efter }, visar: null, worker: efter.worker });
};
$("s-klass").onchange = () => {
  T.stallIn({ maxTex: window.__ppPixi?.maxTex, klass: $("s-klass").value || undefined });
  logg({ klassBytt: "bygg om för att se effekten" });
};

pixi().then(() => logg(), (err) => logg({ fel: String(err?.message || err) }));
logg();
