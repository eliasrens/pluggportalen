// ============================================================================
// Pluggporten – rörelse-motorn: Pixi spelar kamerans övergångar (#396, F4 #418)
// ----------------------------------------------------------------------------
// Laddas i idle av pages-varld.js (import(), aldrig i bootgrafen); kopplas in i
// varld-kamera.js med setRorelseMotor() – alla kameror registrerar sig här. I
// vila är DOM:en exakt som idag; Pixi (workern, F1) ritar BARA under rörelsen.
//
// Handoff (bindande, §2.3f i docs/pixi-arkitektur-396.md):
//  1. Pyramiderna för båda lagren måste ha nivå 1 + grovaste nivån i workern.
//     Annars väntar vi högst VANTA_MAX_MS (strömning), sedan CSS – 120 ms om reserv finns.
//  2. vila() fryser ambient (WAAPI) + promenaden. Lager med levande ambient
//     speglas om NU (frusen pose inbakad); hovrad/fokuserad nod i profilens
//     `objekt` blir ett fokus-överlägg (speglaNod) ovanpå en förvärmd pyramid.
//  3. yta.visaVila(fran) – workern ritar exakt nuvarande bild under DOM:en.
//  4. På `visar`: .varld-pixi-spelar (DOM-lagren opacity 0), kameran kör
//     apply() direkt till slutläget (lagren är .varld-pixi-vilar → ingen
//     transition), yta.spela() startar.
//  5. 900 ms i workern; onNiva/promise vid KAMERA_MS som idag.
//  6. klar → ta bort .varld-pixi-spelar (DOM syns i slutläget, canvasen under
//     visar samma bild); vila släpps 2 frames senare; 2 rAF + 100 ms → rensa().
// Spår: stage.dataset.pixiSpel = "pixi" | "css:<orsak>".
// Förvärmning (varld-motor-mal.js): idle-grannövergångar efter landning +
// dynamiska MÅL (profil.malSelektor, data-fokus-x/y) vid pointerenter/focusin,
// som går före idle. Lager med levande ambient (utanför profilens sprites)
// speglas om vid handoff; hinner det inte inom VANTA_MAX_MS spelas rörelsen på
// den förvärmda pyramiden (spåras som `inaktuella` i loggen/HUD).
// Profil-semantiken (ambient/sprites/objekt): se varld-profil-standard.js.
//
// API FÖR SCENERNA (export + window.__ppPixi.motor.<krok>; laddas lat → anropa
// som `window.__ppPixi?.motor?.forvarmMal?.(el)`; motorn ändrar ingen data):
//   forvarmMal(el) → boolean   REKOMMENDERAT vid pointerenter/focusin på ett
//     klickmål. el bär data-fokus-x/y (% av sitt .varld-lager = kamerans fokus
//     vid klicket) och ev. data-fokus-lager="<id>" (innerlagret) och
//     data-fokus-zoom (annars en registrerad nivås zoom för lagret – målets
//     egen kamera behöver inte finnas än). Bygger ytterrollens pyramid direkt
//     (prio "nu", före idle). Pekaren/fokus lämnar el, eller forvarmMal(null)
//     → avbryts, egna texturer släpps. Utan kroken gör motorns egen lyssnare
//     samma sak för element som matchar profil.malSelektor (60 ms dwell för mus).
//   forvarmLager(lagerEl) → boolean
//     Anropa när lagret som ett klick på det AKTUELLA målet zoomar in till är
//     förrenderat (dolt). Motorn bygger dess innerpyramid för målets fokus.
//     false = inget mål är aktivt (pekaren har lämnat; inget byggs). Motorn
//     spolar väntande mutationer först, så lagret får sin nya version direkt.
//     Alternativ: data-fokus-lager="<lager-id>" på målet (statiskt innerlager).
//   Skriv INTE om lagret med identisk markup vid klicket – det smutsar lagret
//   (sakra() känner igen identisk bild via hash och återanvänder den, men
//   betalar ändå speglingen).
//
// FLAGGOR: pp:pixi:tvinga (eller ?pixi=tvinga) förlänger väntan på texturer
// och vilo-bilden till TVINGA_MS (belastad desk/SwiftShader kan bevisa
// Pixi-vägen); utan flaggan gäller 250/500 ms. Loggen/HUD:en får
// `skulleMissat: {vanta, vila}` (ms) när en körning hade missat
// produktionsgränsen.
// Debug/test: window.__ppPixi.motor (+ HUD med pp:pixi:debug).
// ============================================================================

import { ensureRenderare, pixiMojlig, pixiFlaggor, noteraCssVag } from "./varld-render.js";
import { stallIn, texturCache } from "./varld-textur.js";
import { setRorelseMotor, KAMERA_MS } from "./varld-kamera.js";
import { vila } from "./varld-vila.js";
import * as TX from "./varld-motor-textur.js";
import { skapaForvarmare } from "./varld-motor-mal.js";
import { forbered, RESERV_MAX_MS } from "./varld-motor-forbered.js";
import { urlFlaggor, statistik, visaHud, vakta } from "./varld-motor-hud.js";
import { skapaResizeVakt } from "./varld-motor-resize.js";

/** Längsta väntan på texturer innan CSS-vägen tar över (§2.3f.1). */
export const VANTA_MAX_MS = 250;
const VILA_TIMEOUT_MS = 500;
const TVINGA_MS = 3000; // pp:pixi:tvinga: belastad desk
const grans = (ms) => (pixiFlaggor().tvinga ? Math.max(ms, TVINGA_MS) : ms);
const SPELAR = "varld-pixi-spelar";

let stage = null;
let canvas = null; // EN canvas för appens livstid (transferControlToOffscreen går bara en gång)
let yta = null;
let renderare = null;
const kameror = new Set();
let spel = null; // { nr, fas:"forbered"|"spelar", slapp, tillampaDom, forb, t0, matt (stage-nyckel), landad? (F8) }
let spelNr = 0;
let slappSnart = null; // vilan från förra rörelsen, släpps 2 frames efter återvisningen
let senaste = null;

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const markera = (v) => { if (stage) stage.dataset.pixiSpel = v; };
const allaLager = () => (stage ? [...stage.querySelectorAll(":scope > .varld-lager")] : []);
const F = skapaForvarmare({
  stage: () => stage,
  yta: () => yta,
  kameror,
  ledig: () => !!stage?.isConnected && !!yta && !renderare?.dod && !spel && !slappSnart && !document.hidden && !pixiFlaggor().av,
  logga: (m) => loggaMal(m),
});
// F8 #434: nivåns egen stage-höjd (mobil: rum) ≠ äkta resize – se varld-motor-resize.js.
const R = skapaResizeVakt({ stage: () => stage, yta: () => yta, spel: () => spel, landa, resize: efterResize, schemaForvarm, logga: (p) => pixiFlaggor().debug && console.info("[pp:pixi] resize", p) });

globalThis.document?.addEventListener("visibilitychange", () => { if (document.hidden && spel) { avbryt(); markera("css:dold-flik"); } }); // gömd flik: workerns rAF pausar → direkthopp

// ---- Installation ------------------------------------------------------------

/**
 * Koppla motorn till scenen (idempotent per stage). Startar renderaren, flyttar
 * in appens enda Pixi-canvas och registrerar motorn i kameran. Kastar aldrig.
 * @param {HTMLElement} stageEl  .varld-stage
 */
export async function installeraMotor(stageEl) {
  try {
    if (!stageEl?.isConnected) return;
    urlFlaggor();
    if (stageEl !== stage) bytScen(stageEl);
    setRorelseMotor(motor); // även utan renderare: kanSpela rapporterar orsaken
    const r = await ensureRenderare();
    if (!r || stage !== stageEl || !stageEl.isConnected) return;
    if (renderare !== r) {
      renderare = r;
      stallIn({ maxTex: r.maxTex });
      r.onDod(() => avbryt());
    }
    kopplaCanvas();
    schemaForvarm();
    // Baloo 2 som data-URL (första speglingen slipper hämta fonten vid klick).
    idle(() => TX.forvarmFont());
  } catch (err) {
    console.warn("[pp:pixi] motorn kunde inte installeras:", err);
  }
}

function bytScen(stageEl) {
  avbryt();
  TX.slutaSpana();
  TX.rensaAllt();
  stage = stageEl;
  F.koppla(stage);
  for (const n of [...kameror]) if (!stage.contains(n[0]?.el)) kameror.delete(n);
  TX.spana(stage, schemaForvarm);
  R.koppla(stage); // ResizeObserver + landning på en nivå (data-niva) → förvärm
}

function kopplaCanvas() {
  if (!stage || !renderare) return;
  const plats = stage.querySelector(":scope > canvas.varld-pixi");
  if (!canvas) {
    canvas = plats || document.createElement("canvas");
    canvas.className = "varld-pixi";
    canvas.setAttribute("aria-hidden", "true");
    if (!plats) stage.prepend(canvas);
    const m = R.matt();
    yta = renderare.skapaYta(canvas, m);
    R.skapad(m);
    vakta(renderare, yta); // G1 #425: budget efter scenstorlek, 30 s-städning, restore, emoji, HUD
  } else if (canvas.parentElement !== stage) {
    if (plats) plats.replaceWith(canvas);
    else stage.prepend(canvas);
  }
  R.kolla();
}

/** Ny stage-storlek: äkta (viewport/dpr) → avbryt + ALLA pyramider ogiltiga; nivåns egen → bara ytan. */
function efterResize(m, akta) {
  if (akta) avbryt();
  F.avbryt();
  yta.resize(m.w, m.h, m.dpr);
  stallIn({ maxTex: renderare?.maxTex });
  if (akta) TX.rensaAllt();
  schemaForvarm();
}

/** F8 #434: nivåns resize under en rörelse mätt i annan storlek. Spelar → DOM:en (slutläget) visas NU, canvasen göms; förbereds → avbryt. */
function landa(nyckel) {
  const s = spel;
  if (!s || s.matt === nyckel) return s ? "samma" : null;
  if (s.fas === "forbered") { avbryt(); return "avbruten"; }
  if (!s.landad) s.landad = { till: nyckel, ms: Math.round(performance.now() - s.t0) };
  stage.classList.remove(SPELAR);
  canvas.style.visibility = "hidden"; // tillbaka i avbryt() (nästa rörelse) och jamfor()
  return "landad";
}

// ---- RorelseMotor (gränssnittet mot varld-kamera.js) -------------------------

const motor = {
  registrera(nivaer) {
    kameror.add(nivaer);
    schemaForvarm();
  },
  kanSpela(spec) {
    const orsak = hinder(spec);
    if (!orsak) return true;
    if (spec?.stage) spec.stage.dataset.pixiSpel = `css:${orsak}`;
    noteraCssVag(orsak);
    return false;
  },
  spela,
  avbryt,
};

/** Varför den här övergången inte kan spelas via Pixi (synkront), eller null. */
function hinder(spec) {
  if (pixiFlaggor().av) return "av";
  if (!pixiMojlig()) return window.__ppPixi?.orsak || "ej-mojlig";
  if (!renderare || !yta) return window.__ppPixi?.orsak || "ingen-renderare";
  if (renderare.dod) return renderare.dodOrsak || "dod";
  if (spec.stage !== stage || !stage.isConnected) return "annan-scen";
  if (document.hidden) return "dold-flik";
  if (!spec.yttre?.el || !spec.inre?.el) return "ingen-niva";
  return null;
}

/**
 * Spela övergången (handoff-sekvensen ovan). Resolvar vid KAMERA_MS efter att
 * rörelsen startat (som dagens setTimeout), eller direkt om den ersätts.
 * @param {{yttre:object, inre:object, riktning:"in"|"ut", stage:HTMLElement}} spec
 * @param {() => void} tillampaDom  kamerans apply() till slutläget
 */
function spela(spec, tillampaDom) {
  return spelaHandoff(spec, tillampaDom).catch((err) => {
    // Får aldrig lämna kameran halvvägs: städa och låt DOM:en ta slutläget.
    console.warn("[pp:pixi] rörelsen föll tillbaka till CSS:", err);
    const s = spel;
    spel = null;
    spelNr++;
    stage?.classList.remove(SPELAR);
    s?.slapp();
    s?.forb?.slappa();
    markera("css:fel");
    tillampaDom();
    return vanta(KAMERA_MS);
  });
}

async function spelaHandoff(spec, tillampaDom) {
  avbryt();
  const malet = F.overlat(); // målets förvärmda pyramider används nu
  const nr = ++spelNr;
  const t0 = performance.now();
  const slapp = vila(allaLager());
  spel = { nr, fas: "forbered", slapp, tillampaDom, forb: null, t0, matt: R.nyckelNu() };
  const post = { riktning: spec.riktning, yttre: spec.yttre.id, inre: spec.inre.id, t: Math.round(t0), ...(malet ? { mal: malet.id } : {}) };
  const missat = {};
  const css = (orsak) => {
    slapp();
    spel = null;
    markera(`css:${orsak}`);
    noteraCssVag(orsak);
    tillampaDom();
    logga({ ...post, vag: "css", orsak, forberedMs: Math.round(performance.now() - t0), ...skulleMissat(missat) });
    return vanta(KAMERA_MS);
  };
  let forb;
  try {
    forb = await forbered(spec, slapp, t0 + grans(VANTA_MAX_MS), { stage, yta, reservTill: t0 + grans(RESERV_MAX_MS) });
  } catch (err) {
    if (pixiFlaggor().debug) console.warn("[pp:pixi] förberedelse:", err);
    forb = { orsak: "textur-fel" };
  }
  if (nr !== spelNr) { forb.slappa?.(); return; } // ersatt – avbryt() har redan städat
  if (forb.orsak) return css(forb.orsak);
  spel.forb = forb;
  const tV = performance.now();
  if (tV - t0 > VANTA_MAX_MS) missat.vanta = Math.round(tV - t0);
  const visar = await Promise.race([yta.visaVila(forb.fran).then(() => "ok", () => "worker-fel"), vanta(grans(VILA_TIMEOUT_MS)).then(() => "vila-timeout")]);
  if (performance.now() - tV > VILA_TIMEOUT_MS) missat.vila = Math.round(performance.now() - tV);
  if (nr === spelNr && visar !== "ok") { forb.slappa(); return css(visar); }
  if (nr !== spelNr) return;
  // 4. Bytet: DOM osynlig (canvasen visar samma bild), DOM till slutläget, spela.
  forb.sattPose(); stage.classList.add(SPELAR); // F5 #431: reservens ambient-pose, samma task
  markera("pixi");
  spel.fas = "spelar";
  tillampaDom();
  const forberedMs = Math.round(performance.now() - t0);
  yta.spela({ fran: forb.fran, till: forb.till }).then(
    (res) => avsluta(nr, { ...post, vag: "pixi", forberedMs, ...forb.info, ...skulleMissat(missat), ...statistik(res.frames), avbruten: !!res.avbruten }),
    () => avsluta(nr, { ...post, vag: "pixi", forberedMs, fel: true }),
  );
  return vanta(KAMERA_MS);
}

/** 6. Rörelsen klar: DOM tillbaka, vila släpps, canvasen töms. */
function avsluta(nr, logg) {
  if (nr !== spelNr || !spel) return;
  const s = spel;
  spel = null;
  stage.classList.remove(SPELAR);
  logga(s.landad ? { ...logg, landad: s.landad } : logg);
  // Vilan (transition:none) ligger kvar tills återvisningen är stilberäknad –
  // annars tonar lagren in med .varld-lager-transitionen.
  const minSlapp = () => {
    if (slappSnart === minSlapp) slappSnart = null;
    s.slapp();
  };
  slappSnart = minSlapp;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    minSlapp();
    setTimeout(() => {
      s.forb?.slappa();
      if (spelNr === nr) yta?.rensa();
      schemaForvarm();
    }, 100);
  }));
}

/** Avbryt pågående/förberedd rörelse (ny gaTill, hoppaTill, resize, död). */
function avbryt() {
  slappSnart?.();
  if (canvas) canvas.style.visibility = "";
  const s = spel;
  if (!s) return;
  spel = null;
  spelNr++;
  stage?.classList.remove(SPELAR);
  s.slapp();
  if (s.fas === "forbered") s.tillampaDom(); // håll DOM i takt med kamerans `aktiv`
  else {
    s.forb?.slappa();
    yta?.rensa();
  }
}

// ---- Förvärmning -------------------------------------------------------------

let forvarmPlanerad = false;
function schemaForvarm() {
  if (forvarmPlanerad) return;
  forvarmPlanerad = true;
  idle(() => {
    forvarmPlanerad = false;
    try { forvarm(); } catch (err) { if (pixiFlaggor().debug) console.warn("[pp:pixi] förvärmning:", err); }
  });
}

/** Idle-grannövergångarna (efter ett pågående mål) – se varld-motor-mal.js. */
function forvarm() {
  if (!yta && stage?.isConnected && pixiMojlig()) { installeraMotor(stage); return; }
  F.forvarm();
}

/**
 * Scen-API (S2/S3): målets innerlager är förrenderat → förvärm dess pyramid
 * för det aktuella målets fokus. Se överst i filen. @returns {boolean}
 */
export function forvarmLager(lagerEl) {
  try { return F.forvarmLager(lagerEl); } catch (err) {
    if (pixiFlaggor().debug) console.warn("[pp:pixi] forvarmLager:", err);
    return false;
  }
}

/** Scen-API (S2/S3): förvärm målet `el` (data-fokus-x/y). Se överst i filen. @returns {boolean} */
export function forvarmMal(el) {
  try { return F.forvarmMal(el); } catch (err) {
    if (pixiFlaggor().debug) console.warn("[pp:pixi] forvarmMal:", err);
    return false;
  }
}

// ---- Logg / debug ------------------------------------------------------------

function logga(post) {
  senaste = { ...post, cacheMB: +(texturCache().summa() / 1048576).toFixed(1) };
  if (pixiFlaggor().debug) {
    console.info("[pp:pixi] övergång", senaste);
    visaHud({ ...senaste, malForvarm: F.senasteMal }, yta).catch(() => {});
  }
}

function loggaMal(m) {
  if (!pixiFlaggor().debug) return;
  console.info("[pp:pixi] målförvärmning", m);
  visaHud({ ...senaste, malForvarm: m }, yta).catch(() => {});
}

const skulleMissat = (m) => (m.vanta || m.vila ? { skulleMissat: true, missatMs: { ...m } } : {});

const info = {
  get senaste() { return senaste; },
  get spelar() { return spel ? spel.fas : null; },
  poster: TX.postLista,
  kameror: () => [...kameror].map((n) => n.map((x) => x.id)),
  kameraLager: () => [...kameror].map((n) => n.map((x) => x.el?.id)), // G1: 30 s-städningens grannar
  /** pp:pixi:frys-jämförelse: göm DOM-lagren (canvasen syns) / visa dem igen. */
  jamfor(visaCanvas) {
    for (const l of allaLager()) l.classList.toggle("varld-pixi-vilar", !!visaCanvas);
    if (canvas) canvas.style.visibility = "";
    stage?.classList.toggle(SPELAR, !!visaCanvas);
  },
  forvarm: () => forvarm(),
  forvarmLager,
  forvarmMal,
  forvarmOvergang: (Y, I) => { try { return F.forvarmOvergang(Y, I); } catch { return false; } },
  /** Workerns texturbokföring (läckkoll: tillbaka till baslinjen efter ett avbrutet mål). */
  stats: () => yta?.stats() ?? Promise.resolve(null),
  get resize() { return R.logg; }, // F8 #434: { typ:"niva"|"akta", fran, till, niva, spel, rensaAllt, t }
  /** Pågående målförvärmning (eller null) och den senaste (status, poster, ms). */
  get mal() { return F.mal; },
  get senasteMal() { return F.senasteMal; },
};
try { if (window.__ppPixi) window.__ppPixi.motor = info; } catch { /* ingen window */ }
