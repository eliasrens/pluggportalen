// ============================================================================
// Pluggporten – motorns textur-sida: roller, pyramid-cache, invalidering,
// fokus-överlägg (#396, F4 #418)
// ----------------------------------------------------------------------------
// Binder ihop F2 (spegling), F3 (pyramid/LRU) och F1 (Yta.satLager) per
// ÖVERGÅNGSROLL:
//   ytter-roll: lagret man zoomar in genom, z ∈ [1, zoom] kring sitt fokus
//   inre-roll : lagret man zoomar in till, z ∈ [1/zoom, 1] kring YTTRE lagrets
//               fokus i % av sin egen box (exakt som apply() i varld-kamera.js)
// En pyramid per roll (nyckel = lager + roll + origo + mått). Varje nivå blir en
// egen behållare i workern (`<pid>@<z>`), så nivåer kan strömmas in även mitt i
// en rörelse, och bara nivåer med z ≤ lagrets aktuella skala ritas (zFran →
// lagerSyns i varld-render-anim.js): ingen nivå visas nedskalad i vila.
//
// Invalidering: MutationObserver per lager (debounce 300 ms) + stagets
// style (paletten). Mutationer inuti profilens ambient-noder och kamerans egna
// skrivningar på lagret (transform/opacity/origo, varld-dold/inert) ignoreras.
// Ingen Firestore: allt läses ur DOM:en som redan står där.
// Laddas bara via import() (varld-motor.js) – aldrig i bootgrafen.
// ============================================================================

import { speglaLager, speglaNod } from "./varld-spegel.js";
import { elementRam, kedjaLinjar } from "./varld-spegel-html.js";
import { avkodaSpegel, byggPyramid, texturCache, konfiguration } from "./varld-textur.js";
import standard from "./varld-profil-standard.js";
import { inbaddadFontCss } from "./varld-spegel-font.js";

const DEBOUNCE_MS = 300;
const KAMERA_STIL = /^(transform|transform-origin|opacity)$/;

/** Bädda in webfonten i förväg (idle) – annars betalar första handoffen hämtningen. */
export const forvarmFont = () => inbaddadFontCss().catch(() => {});

// ---- Profiler ---------------------------------------------------------------

const profiler = new Map(); // namn → profil (laddad) | Promise
/** Ladda lagrets profil (data-spegel-profil); saknas den → standardprofilen. */
export function laddaProfil(el) {
  const namn = el?.dataset?.spegelProfil;
  if (!namn || !/^[a-z0-9-]+$/.test(namn)) return Promise.resolve(standard);
  if (!profiler.has(namn)) {
    profiler.set(namn, import(`./varld-profil-${namn}.js`)
      .then((m) => { const p = { ...standard, ...(m.default || {}) }; profiler.set(namn, p); return p; })
      .catch(() => { profiler.set(namn, standard); return standard; }));
  }
  const p = profiler.get(namn);
  return p instanceof Promise ? p : Promise.resolve(p);
}
/** Synkront: den laddade profilen (standard tills den laddats). */
export function profilFor(el) {
  const p = profiler.get(el?.dataset?.spegelProfil);
  return p && !(p instanceof Promise) ? p : standard;
}
const sel = (v) => (Array.isArray(v) ? v.join(",") : v || "");

// ---- Spaning: lagrens version (smutsig = version ändrad) --------------------

const versioner = new WeakMap(); // lager → heltal
let observatorer = [];
let smutsTimer = null;

export const version = (el) => versioner.get(el) || 0;
const smutsa = (el, onSmutsig) => {
  versioner.set(el, version(el) + 1);
  clearTimeout(smutsTimer);
  smutsTimer = setTimeout(onSmutsig, DEBOUNCE_MS);
};

/** Är en mutation på lagrets egen style bara kamerans (transform/opacitet/origo)? */
function baraKamerastil(el, gammal) {
  const rest = (s) => s.split(";").map((d) => d.trim()).filter((d) => d && !KAMERA_STIL.test(d.split(":")[0].trim())).join(";");
  return rest(gammal || "") === rest(el.getAttribute("style") || "");
}

/** Börja spana på stagets lager (ersätter tidigare spaning). */
export function spana(stage, onSmutsig) {
  slutaSpana();
  const lager = [...stage.querySelectorAll(":scope > .varld-lager")];
  for (const el of lager) {
    laddaProfil(el);
    const mo = new MutationObserver((poster) => {
      const amb = sel(profilFor(el).ambient);
      for (const p of poster) {
        if (p.target === el && p.type === "attributes") {
          if (p.attributeName !== "style" || baraKamerastil(el, p.oldValue)) continue;
        } else {
          const t = p.target.nodeType === 1 ? p.target : p.target.parentElement;
          if (amb && t?.closest(amb)) continue;
        }
        smutsa(el, onSmutsig);
        return;
      }
    });
    mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true, attributeOldValue: true });
    observatorer.push(mo);
  }
  const moStage = new MutationObserver(() => lager.forEach((el) => smutsa(el, onSmutsig)));
  moStage.observe(stage, { attributes: true, attributeFilter: ["style"] });
  observatorer.push(moStage);
}
export function slutaSpana() {
  for (const mo of observatorer) mo.disconnect();
  observatorer = [];
  clearTimeout(smutsTimer);
}

// ---- Geometri -----------------------------------------------------------------

/**
 * Lagrets OTRANSFORMERADE box i stage-px + matrisen box-px → viewport (med
 * kamerans aktuella scale kring transform-origin).
 */
export function lagerGeo(el, stageRect) {
  const cs = getComputedStyle(el);
  const r = elementRam(el, cs, kedjaLinjar(el.parentElement));
  const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
  const p = r.M.transformPoint(new DOMPoint(ox, oy));
  return { box: { x: p.x - ox - stageRect.left, y: p.y - oy - stageRect.top, w: r.w, h: r.h }, M: r.M };
}

const f1 = (n) => (Math.abs(n) < 0.05 ? 0 : n).toFixed(1); // aldrig "-0.0"

/**
 * En övergångsroll för ett lager.
 * @param {HTMLElement} el
 * @param {{box:object, M:DOMMatrix}} geo   lagerGeo(el)
 * @param {{x:number,y:number}} fokus      % av lagrets EGEN box
 * @param {number} zMin
 * @param {number} zMax
 * @param {DOMRect} sr  stagets rect
 */
export function roll(el, geo, fokus, zMin, zMax, sr) {
  const { box, M } = geo;
  const originPx = { x: (fokus.x / 100) * box.w, y: (fokus.y / 100) * box.h };
  const vy = { x: -box.x, y: -box.y, w: sr.width, h: sr.height };
  // Inre rollen syns nedkrympt (övertecknad himmel/gräs runt om) → fånga allt
  // som syns i scale(zMin) kring origo, inte bara stagets ruta.
  const k = zMin < 1 ? 1 / zMin : 1;
  const f = { x: originPx.x + (vy.x - originPx.x) * k, y: originPx.y + (vy.y - originPx.y) * k, w: vy.w * k, h: vy.h * k };
  const a = M.transformPoint(new DOMPoint(f.x, f.y));
  const b = M.transformPoint(new DOMPoint(f.x + f.w, f.y + f.h));
  const rect = { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) };
  rect.width = rect.right - rect.left;
  rect.height = rect.bottom - rect.top;
  const dpr = konfiguration().dpr;
  return {
    el, originPx, vy, zMin, zMax,
    fangstStage: { getBoundingClientRect: () => rect }, // speglaLager läser bara rect:en
    nyckel: `${el.id}|${f1(originPx.x)},${f1(originPx.y)}|${zMin.toFixed(4)}-${zMax}|${f1(box.w)}x${f1(box.h)}|${f1(vy.x)},${f1(vy.y)},${f1(vy.w)}x${f1(vy.h)}|${dpr}`,
  };
}

// ---- Pyramid-poster (en per roll) ---------------------------------------------

const poster = new Map(); // roll.nyckel → post
let pidNr = 0;

/**
 * Se till att rollens pyramid finns (eller byggs). Speglingen görs SYNKRONT i
 * anropet (DOM:en är frusen just nu), resten strömmas via F3:s kö.
 * @param {object} r  roll()
 * Ersätts en färdig pyramid behålls den som `reserv` tills den nya är klar:
 * hinner omspeglingen inte inom VANTA_MAX_MS kan rörelsen spelas på reserven.
 * @param {{yta:object, prio:"idle"|"nu", omspegla?:boolean, tak?:number}} o
 *   tak = bygg inte om en pyramid som är yngre än så här (ms), oavsett version
 * @returns {object} post: { pid, ids:[{id,z}], minSatt:Promise, reserv, ... }
 */
export function sakra(r, { yta, prio, omspegla = false, tak = 0 }) {
  const v = version(r.el);
  const gammal = poster.get(r.nyckel);
  const anvandbar = gammal && !gammal.slappt && !gammal.fel;
  if (anvandbar && tak && performance.now() - gammal.skapad < tak) return gammal;
  if (anvandbar && gammal.version === v && !omspegla && (gammal.minKlar || gammal.prio === "nu" || prio === "idle")) {
    texturCache().rör(gammal.pid);
    return gammal;
  }
  const reserv = anvandbar && gammal.minKlar ? gammal : gammal?.reserv && !gammal.reserv.slappt ? gammal.reserv : null;
  if (gammal && gammal !== reserv) slapp(gammal);
  const post = {
    pid: `p${++pidNr}`, nyckel: r.nyckel, el: r.el, version: v, prio, yta, skapad: performance.now(), reserv, lan: 0,
    ids: [], skickade: new Set(), jobb: null, minKlar: false, slappt: false, fel: null, ms: {},
  };
  poster.set(r.nyckel, post);
  const t0 = performance.now();
  const spegelP = speglaLager(r.el, r.fangstStage, profilFor(r.el)); // synkron genomgång NU
  post.ms.speglaSynk = performance.now() - t0;
  post.minSatt = (async () => {
    const spegel = await spegelP;
    post.ms.spegla = spegel.ms;
    if (post.slappt) throw new Error("släppt");
    const a = await avkodaSpegel(spegel);
    post.ms.avkoda = a.ms;
    if (post.slappt) throw new Error("släppt");
    const jobb = byggPyramid(a, { originPx: r.originPx, zMin: r.zMin, zMax: r.zMax, vy: r.vy }, prio);
    post.jobb = jobb;
    post.ids = jobb.nivaer.map((z) => ({ id: `${post.pid}@${z}`, z }));
    texturCache().lagg(post.pid, jobb.planeradeBytes, () => slappPost(post));
    const satt = new Map();
    jobb.onNiva((niva) => {
      if (post.slappt) {
        for (const t of niva.tegel) t.bmp?.close?.();
        return;
      }
      const id = `${post.pid}@${niva.z}`;
      post.skickade.add(id);
      satt.set(niva.z, yta.satLager(id, { nivaer: [niva] }));
    });
    const min = await jobb.minimumKlart;
    await Promise.all(min.map((n) => satt.get(n.z)));
    post.ms.minimum = performance.now() - t0;
    post.minKlar = true;
    slappReserv(post);
    return post;
  })();
  post.minSatt.catch((err) => {
    post.fel = err;
    if (!post.slappt) slapp(post);
  });
  return post;
}

/** Låna en post under en rörelse (LRU-lås; en ersatt reserv släpps när lånet lämnas). */
export function lana(post) {
  post.lan++;
  texturCache().las(post.pid);
  return () => {
    post.lan--;
    texturCache().lasUpp(post.pid);
    if (!post.lan && poster.get(post.nyckel) !== post && poster.get(post.nyckel)?.reserv !== post) slapp(post);
  };
}

function slappReserv(post) {
  const r = post.reserv;
  if (!r) return;
  post.reserv = null;
  if (!r.lan) slapp(r);
}

const slapp = (post) => texturCache().slapp(post.pid) || slappPost(post);

function slappPost(post) {
  if (post.slappt) return;
  if (post.reserv && !post.reserv.lan) slapp(post.reserv);
  post.slappt = true;
  post.jobb?.avbryt();
  for (const id of post.skickade) post.yta.slappLager(id);
  post.skickade.clear();
  if (poster.get(post.nyckel) === post) poster.delete(post.nyckel);
}

/** Släpp alla pyramider (resize, ny scen). */
export function rensaAllt() {
  for (const p of [...poster.values()]) slapp(p);
}

/** Översikt för debug/test (__ppPixi.motor.poster()). */
export const postLista = () => [...poster.values()].map((p) => ({
  pid: p.pid, lager: p.el.id, nyckel: p.nyckel, prio: p.prio, minKlar: p.minKlar, reserv: p.reserv?.pid || null,
  nivaer: p.ids.map((i) => i.z), skickade: p.skickade.size, ms: p.ms,
}));

// ---- Fokus-överlägg (hovrad/fokuserad nod i profilens objekt) ---------------

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

/**
 * Spegla lagrets hovrade/fokuserade objekt (synkront NU) och lägg dem som egna
 * behållare i workern, rastrerade för största skalan `maxSkala`.
 * @returns {{ids:string[], klart:Promise<void>}}
 */
export function overlagg(el, maxSkala, yta) {
  const s = sel(profilFor(el).objekt);
  if (!s) return { ids: [], klart: Promise.resolve() };
  let noder = [];
  try {
    noder = [...el.querySelectorAll(s)].filter((n) => n.matches(":hover") || n.matches(":focus-visible"));
  } catch { /* ogiltig selektor i en profil */ }
  noder = noder.filter((n) => !noder.some((m) => m !== n && n.contains(m))).slice(0, 2);
  const ids = [];
  const jobb = noder.map((nod) => {
    const id = `ovl${++ovlNr}`;
    ids.push(id);
    return speglaNod(nod, el).then(async (ns) => {
      const img = await avkodaSvg(ns.svg);
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
  return { ids, klart: Promise.all(jobb).then(() => {}) };
}
