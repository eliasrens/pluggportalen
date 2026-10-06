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
// style (paletten). Mutationer inuti profilens ambient- och sprite-noder,
// speglingens vila-kloner och kamerans egna skrivningar på lagret
// (transform/opacity/origo, varld-dold/inert) ignoreras.
// Profil-semantiken (#428, varld-profil-standard.js): ambient BAKAS IN i basen
// (texturspeglingen utelämnar bara `sprites`); sprites + hovrade objekt ritas
// som egna speglaNod-behållare ovanpå basen (varld-motor-overlagg.js).
// Ingen Firestore: allt läses ur DOM:en som redan står där.
// Laddas bara via import() (varld-motor.js) – aldrig i bootgrafen.
// ============================================================================

import { speglaLager } from "./varld-spegel.js";
import { elementRam, kedjaLinjar } from "./varld-spegel-html.js";
import { avkodaSpegel, byggPyramid, texturCache, konfiguration } from "./varld-textur.js";
import standard from "./varld-profil-standard.js";
import { inbaddadFontCss } from "./varld-spegel-font.js";
import { KLON_ATTR } from "./varld-spegel-neutral.js";
import { doljEmoji } from "./varld-emoji.js";

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
const union = (...v) => v.map(sel).filter(Boolean).join(",");

/** Registrera en profil i förväg (previews/test; scenerna använder filerna). */
export function registreraProfil(namn, profil) {
  profiler.set(namn, { ...standard, ...profil });
}

/**
 * Profilen som TEXTURSPEGLINGEN använder: ambient bakas in (utelämnas inte),
 * bara `sprites` utelämnas, hovrade/fokuserade `objekt` ritas i vila-läge.
 */
const texturProfil = (p) => ({ ...p, ambient: sel(p.sprites), neutraliseraObjekt: sel(p.objekt) });

/** Är animationen "ambient" (inte en transition och inte lagrets egen)? */
const arAmbient = (a, el) => !(globalThis.CSSTransition && a instanceof CSSTransition) && a.effect?.target !== el;

/**
 * Har lagret levande ambient UTANFÖR profilens sprites? Då står basen i en ny
 * pose och måste speglas om vid handoff (sprites speglas ändå varje gång).
 * @param {HTMLElement} el
 * @param {Animation[]} [anims]  t.ex. vilans pausade; annars de som spelar nu
 */
export function levandeBas(el, anims) {
  const spr = sel(profilFor(el).sprites);
  let lista = anims;
  if (!lista) {
    try { lista = el.getAnimations({ subtree: true }).filter((a) => a.playState === "running"); } catch { return false; }
  }
  return lista.some((a) => {
    const t = a.effect?.target;
    return t && el.contains(t) && arAmbient(a, el) && !(spr && t.closest(spr));
  });
}

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
    const hantera = (poster) => {
      const amb = union(profilFor(el).ambient, profilFor(el).sprites);
      for (const p of poster) {
        if (p.target === el && p.type === "attributes") {
          if (p.attributeName !== "style" || baraKamerastil(el, p.oldValue)) continue;
        } else if (p.type === "childList" && [...p.addedNodes, ...p.removedNodes].every((n) => n.nodeType === 1 && n.hasAttribute(KLON_ATTR))) {
          continue; // speglingens vila-kloner (varld-spegel-neutral.js)
        } else {
          const t = p.target.nodeType === 1 ? p.target : p.target.parentElement;
          if (amb && t?.closest(amb)) continue;
        }
        smutsa(el, onSmutsig);
        return;
      }
    };
    const mo = new MutationObserver(hantera);
    mo.hantera = hantera;
    mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true, attributeOldValue: true });
    observatorer.push(mo);
  }
  const moStage = new MutationObserver(() => lager.forEach((el) => smutsa(el, onSmutsig)));
  moStage.observe(stage, { attributes: true, attributeFilter: ["style"] });
  observatorer.push(moStage);
}
/**
 * Bokför väntande mutationer NU (annars levereras de först i nästa mikrotask):
 * en scen som just förrenderat ett lager och direkt ber om förvärmning ska få
 * en pyramid med lagrets nya version – inte en som genast är "smutsig".
 */
function spolaSmuts() {
  for (const mo of observatorer) {
    const poster = mo.takeRecords();
    if (poster.length) mo.hantera?.(poster);
  }
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
 * @param {{yta:object, prio:"idle"|"nu", omspegla?:boolean, tak?:number, kalla?:string}} o
 *   tak = bygg inte om en pyramid som är yngre än så här (ms), oavsett version
 *   kalla = vem som byggde den ("idle" | "mal" | "handoff"; logg/debug)
 * Blir speglingen IDENTISK med reservens (samma innehålls-hash, t.ex. en scen
 * som skrev om samma markup) återanvänds reserven: post.alias pekar på den.
 * @returns {object} post: { pid, ids:[{id,z}], minSatt:Promise, reserv, alias, ... }
 */
export function sakra(r, { yta, prio, omspegla = false, tak = 0, kalla = prio === "idle" ? "idle" : "handoff" }) {
  spolaSmuts();
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
    pid: `p${++pidNr}`, nyckel: r.nyckel, el: r.el, version: v, prio, kalla, yta, skapad: performance.now(), reserv, lan: 0,
    ids: [], skickade: new Set(), jobb: null, minKlar: false, slappt: false, fel: null, ms: {}, spegelNyckel: null, alias: null,
  };
  poster.set(r.nyckel, post);
  const t0 = performance.now();
  const spegelP = speglaLager(r.el, r.fangstStage, texturProfil(profilFor(r.el))); // synkron genomgång NU
  post.ms.speglaSynk = performance.now() - t0;
  post.minSatt = (async () => {
    const spegel = doljEmoji(await spegelP); // G1: emoji-reserven ritar dem som text-sprites
    post.ms.spegla = spegel.ms;
    if (post.slappt) throw new Error("släppt");
    post.spegelNyckel = spegel.nyckel;
    const g = post.reserv;
    if (g && !g.slappt && g.spegelNyckel === spegel.nyckel && poster.get(post.nyckel) === post) {
      // Samma bild som reserven → behåll den (ingen avkodning/rastrering).
      post.reserv = null;
      post.alias = g;
      g.version = post.version;
      g.reserv = null;
      poster.set(post.nyckel, g);
      post.slappt = true; // inget allokerat; anroparen använder post.alias
      return g;
    }
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

/** Den aktuella posten för en roll-nyckel (eller undefined). */
export const postFor = (nyckel) => poster.get(nyckel);

/** Släpp en post om ingen rörelse lånar den (målförvärmning som avbryts). */
export function slappOmLedig(post) {
  if (post && !post.lan && !post.slappt) slapp(post);
}

/** Släpp alla pyramider (resize, ny scen). */
export function rensaAllt() {
  for (const p of [...poster.values()]) slapp(p);
}

/** Översikt för debug/test (__ppPixi.motor.poster()). */
export const postLista = () => [...poster.values()].map((p) => ({
  pid: p.pid, lager: p.el.id, nyckel: p.nyckel, prio: p.prio, kalla: p.kalla, minKlar: p.minKlar, reserv: p.reserv?.pid || null,
  nivaer: p.ids.map((i) => i.z), skickade: p.skickade.size, ms: p.ms,
}));
