// ============================================================================
// Pluggporten – rörelse-motorn: Pixi spelar kamerans övergångar (#396, F4 #418)
// ----------------------------------------------------------------------------
// Laddas i idle av pages-varld.js (import(), aldrig i bootgrafen); kopplas in i
// varld-kamera.js med setRorelseMotor() – alla kameror registrerar sig här. I
// vila är DOM:en exakt som idag; Pixi (workern, F1) ritar BARA under rörelsen.
//
// Handoff (bindande, §2.3f i docs/pixi-arkitektur-396.md):
//  1. Pyramiderna för båda lagren måste ha nivå 1 + grovaste nivån i workern.
//     Annars väntar vi högst VANTA_MAX_MS (strömning, prio "nu"), sedan CSS.
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
// Förvärmning: i idle efter landning (stage[data-niva] ändras) byggs
// pyramiderna för nivåns grannövergångar (max budget.maxPar). Lager med levande
// ambient speglas om vid handoff; hinner det inte inom VANTA_MAX_MS spelas
// rörelsen på den förvärmda pyramiden (spåras som `inaktuella` i loggen/HUD).
// Debug/test: window.__ppPixi.motor (+ HUD med pp:pixi:debug).
// ============================================================================

import { ensureRenderare, pixiMojlig, pixiFlaggor, noteraCssVag } from "./varld-render.js";
import { lagerState } from "./varld-render-anim.js";
import { stallIn, texturCache, konfiguration } from "./varld-textur.js";
import { setRorelseMotor, KAMERA_MS } from "./varld-kamera.js";
import { vila, harAmbient } from "./varld-vila.js";
import * as TX from "./varld-motor-textur.js";
import { urlFlaggor, statistik, visaHud, vakta } from "./varld-motor-hud.js";

/** Längsta väntan på texturer innan CSS-vägen tar över (§2.3f.1). */
export const VANTA_MAX_MS = 250;
const VILA_TIMEOUT_MS = 500;
const SPELAR = "varld-pixi-spelar";

let stage = null;
let canvas = null; // EN canvas för appens livstid (transferControlToOffscreen går bara en gång)
let yta = null;
let renderare = null;
let ro = null;
let moNiva = null;
let ytMatt = "";
const kameror = new Set();
let spel = null; // { nr, fas:"forbered"|"spelar", slapp, tillampaDom, forb }
let spelNr = 0;
let slappSnart = null; // vilan från förra rörelsen, släpps 2 frames efter återvisningen
let senaste = null;

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const markera = (v) => { if (stage) stage.dataset.pixiSpel = v; };
const allaLager = () => (stage ? [...stage.querySelectorAll(":scope > .varld-lager")] : []);

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
  ro?.disconnect();
  moNiva?.disconnect();
  stage = stageEl;
  for (const n of [...kameror]) if (!stage.contains(n[0]?.el)) kameror.delete(n);
  TX.spana(stage, schemaForvarm);
  ro = new ResizeObserver(() => kollaMatt());
  ro.observe(stage);
  // Landning på en nivå (updateUi i alla kameror sätter data-niva) → förvärm.
  moNiva = new MutationObserver(schemaForvarm);
  moNiva.observe(stage, { attributes: true, attributeFilter: ["data-niva"] });
}

const matt = () => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return { w: stage.clientWidth, h: stage.clientHeight, dpr };
};

function kopplaCanvas() {
  if (!stage || !renderare) return;
  const plats = stage.querySelector(":scope > canvas.varld-pixi");
  if (!canvas) {
    canvas = plats || document.createElement("canvas");
    canvas.className = "varld-pixi";
    canvas.setAttribute("aria-hidden", "true");
    if (!plats) stage.prepend(canvas);
    const m = matt();
    yta = renderare.skapaYta(canvas, m);
    ytMatt = `${m.w}x${m.h}@${m.dpr}`;
    vakta(renderare, yta); // G1 #425: budget efter scenstorlek, 30 s-städning, restore, emoji, HUD
  } else if (canvas.parentElement !== stage) {
    if (plats) plats.replaceWith(canvas);
    else stage.prepend(canvas);
  }
  kollaMatt();
}

function kollaMatt() {
  if (!stage || !yta) return;
  const m = matt();
  const nyckel = `${m.w}x${m.h}@${m.dpr}`;
  if (nyckel === ytMatt || !m.w || !m.h) return;
  ytMatt = nyckel;
  avbryt();
  yta.resize(m.w, m.h, m.dpr);
  stallIn({ maxTex: renderare?.maxTex });
  TX.rensaAllt(); // alla pyramider ogiltiga
  schemaForvarm();
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
  const nr = ++spelNr;
  const t0 = performance.now();
  const slapp = vila(allaLager());
  spel = { nr, fas: "forbered", slapp, tillampaDom, forb: null };
  const post = { riktning: spec.riktning, yttre: spec.yttre.id, inre: spec.inre.id, t: Math.round(t0) };
  const css = (orsak) => {
    slapp();
    spel = null;
    markera(`css:${orsak}`);
    noteraCssVag(orsak);
    tillampaDom();
    logga({ ...post, vag: "css", orsak, forberedMs: Math.round(performance.now() - t0) });
    return vanta(KAMERA_MS);
  };
  let forb;
  try {
    forb = await forbered(spec, slapp, t0 + VANTA_MAX_MS);
  } catch (err) {
    if (pixiFlaggor().debug) console.warn("[pp:pixi] förberedelse:", err);
    forb = { orsak: "textur-fel" };
  }
  if (nr !== spelNr) { forb.slappa?.(); return; } // ersatt – avbryt() har redan städat
  if (forb.orsak) return css(forb.orsak);
  spel.forb = forb;
  const visar = await Promise.race([yta.visaVila(forb.fran).then(() => "ok", () => "worker-fel"), vanta(VILA_TIMEOUT_MS).then(() => "vila-timeout")]);
  if (nr === spelNr && visar !== "ok") { forb.slappa(); return css(visar); }
  if (nr !== spelNr) return;
  // 4. Bytet: DOM osynlig (canvasen visar samma bild), DOM till slutläget, spela.
  stage.classList.add(SPELAR);
  markera("pixi");
  spel.fas = "spelar";
  tillampaDom();
  const forberedMs = Math.round(performance.now() - t0);
  yta.spela({ fran: forb.fran, till: forb.till }).then(
    (res) => avsluta(nr, { ...post, vag: "pixi", forberedMs, ...forb.info, ...statistik(res.frames), avbruten: !!res.avbruten }),
    () => avsluta(nr, { ...post, vag: "pixi", forberedMs, fel: true }),
  );
  return vanta(KAMERA_MS);
}

/** 1–2 i handoffen: säkra pyramider (+ överlägg) och bygg animationens tillstånd. */
async function forbered(spec, slapp, deadline) {
  const sr = stage.getBoundingClientRect();
  const Y = spec.yttre, I = spec.inre;
  const gY = TX.lagerGeo(Y.el, sr), gI = TX.lagerGeo(I.el, sr);
  if (!gY.box.w || !gY.box.h || !gI.box.w || !gI.box.h) return { orsak: "ingen-box" };
  const Z = Y.zoom;
  const rY = TX.roll(Y.el, gY, Y.fokus, 1, Z, sr);
  const rI = TX.roll(I.el, gI, Y.fokus, 1 / Z, 1, sr);
  // Synkront: speglingar och överlägg medan DOM:en är frusen.
  const omY = slapp.ambient(Y.el), omI = slapp.ambient(I.el);
  const pY = TX.sakra(rY, { yta, prio: "nu", omspegla: omY });
  const pI = TX.sakra(rI, { yta, prio: "nu", omspegla: omI });
  const oY = TX.overlagg(Y.el, Z, yta, omY), oI = TX.overlagg(I.el, 1, yta, omI); // omspeglat: bara emoji-reserven (G1)
  const ovl = [...oY.ids, ...oI.ids];
  const slappOvl = () => ovl.forEach((id) => yta.slappLager(id));
  const klart = Promise.all([pY.minSatt, pI.minSatt, oY.klart.catch(() => {}), oI.klart.catch(() => {})]);
  await Promise.race([klart.catch(() => {}), vanta(Math.max(0, deadline - performance.now()))]);
  // Hann en omspegling inte i tid: spela på den förvärmda pyramiden (reserven)
  // – rätt innehåll, men ambienten i förvärmningens pose (S-profilerna gör
  // omspeglingen billig nog). Saknas båda → CSS-vägen.
  const valj = (p) => (p.minKlar ? p : p.reserv?.minKlar && !p.reserv.slappt ? p.reserv : null);
  const aY = valj(pY), aI = valj(pI);
  if (!aY || !aI) {
    slappOvl();
    return { orsak: "vanta" };
  }
  const lamna = [TX.lana(aY), TX.lana(aI)];
  const inaktuella = [aY !== pY && Y.id, aI !== pI && I.id].filter(Boolean);
  const geo = [
    { id: "Y", box: gY.box, fokus: Y.fokus, zoom: Z },
    { id: "I", box: gI.box, fokus: I.fokus, zoom: I.zoom },
  ];
  const inAt = spec.riktning === "in";
  const fran = inAt ? lagerState(geo, 0, 0) : lagerState(geo, 1, 1);
  const till = inAt ? lagerState(geo, 1, 0) : lagerState(geo, 0, 0);
  // Varje pyramidnivå/överlägg är en egen behållare med lagrets transform.
  const bred = (states) => states.flatMap((l, j) => [
    ...(j ? aI : aY).ids.map(({ id, z }) => ({ ...l, id, zFran: z })),
    ...(j ? oI : oY).ids.map((id) => ({ ...l, id })),
  ]);
  return {
    fran: bred(fran), till: bred(till),
    info: { omspeglade: [omY && Y.id, omI && I.id].filter(Boolean), inaktuella, overlagg: ovl.length, pyramider: [pY.ms, pI.ms] },
    slappa() {
      slappOvl();
      lamna.forEach((f) => f());
    },
  };
}

/** 6. Rörelsen klar: DOM tillbaka, vila släpps, canvasen töms. */
function avsluta(nr, logg) {
  if (nr !== spelNr || !spel) return;
  const s = spel;
  spel = null;
  stage.classList.remove(SPELAR);
  logga(logg);
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

/** Bygg pyramiderna för den aktiva nivåns grannövergångar (max maxPar). */
function forvarm() {
  if (!yta && stage?.isConnected && pixiMojlig()) { installeraMotor(stage); return; }
  if (!stage?.isConnected || !yta || renderare?.dod || spel || slappSnart || document.hidden || pixiFlaggor().av) return;
  const aktiv = allaLager().find((l) => !l.inert && !l.classList.contains("varld-dold"));
  if (!aktiv) return;
  const par = [];
  for (const nivaer of kameror) {
    if (!stage.contains(nivaer[0]?.el)) { kameror.delete(nivaer); continue; }
    const k = nivaer.findIndex((n) => n.el === aktiv);
    if (k > 0) par.push([nivaer[k - 1], nivaer[k]]);
    if (k >= 0 && k < nivaer.length - 1) par.push([nivaer[k], nivaer[k + 1]]);
  }
  const sr = stage.getBoundingClientRect();
  const sedda = new Set();
  for (const [Y, I] of par) {
    const nyckel = `${Y.el.id}>${I.el.id}`;
    // Tomt lager (byn innan laddaBy) → inget att förvärma. Ingen data hämtas här.
    if (sedda.has(nyckel) || !Y.el.childElementCount || !I.el.childElementCount) continue;
    if (sedda.size >= konfiguration().budget.maxPar) break;
    sedda.add(nyckel);
    const roller = [[Y, TX.lagerGeo(Y.el, sr), 1, Y.zoom], [I, TX.lagerGeo(I.el, sr), 1 / Y.zoom, 1]];
    for (const [niva, g, zMin, zMax] of roller) {
      if (!g.box.w || !g.box.h) continue;
      // Lager med levande ambient speglas om vid handoff ändå; förvärmningen är
      // bara reserven om omspeglingen inte hinner → högst var 4:e sekund.
      TX.sakra(TX.roll(niva.el, g, Y.fokus, zMin, zMax, sr), { yta, prio: "idle", tak: harAmbient(niva.el) ? 4000 : 0 });
    }
  }
}

// ---- Logg / debug ------------------------------------------------------------

function logga(post) {
  senaste = { ...post, cacheMB: +(texturCache().summa() / 1048576).toFixed(1) };
  if (pixiFlaggor().debug) {
    console.info("[pp:pixi] övergång", senaste);
    visaHud(senaste, yta).catch(() => {});
  }
}

const info = {
  get senaste() { return senaste; },
  get spelar() { return spel ? spel.fas : null; },
  poster: TX.postLista,
  kameror: () => [...kameror].map((n) => n.map((x) => x.id)),
  /** pp:pixi:frys-jämförelse: göm DOM-lagren (canvasen syns) / visa dem igen. */
  jamfor(visaCanvas) {
    for (const l of allaLager()) l.classList.toggle("varld-pixi-vilar", !!visaCanvas);
    stage?.classList.toggle(SPELAR, !!visaCanvas);
  },
  forvarm: () => forvarm(),
};
try { if (window.__ppPixi) window.__ppPixi.motor = info; } catch { /* ingen window */ }
