// ============================================================================
// Klasscentret – pokaler i rummet: nycklar + automatisk placering (#497,
// epic #474). REN logik (ingen DOM, ingen Firebase) → test/kc-pokal-
// placering.test.js. Laddas bara dynamiskt (via kc-rum-pokaler.js).
// ----------------------------------------------------------------------------
// En pokal står i rummet på ett av två sätt:
//   flyttad  layoutens placedItems har nyckeln "pokal-<trophyId>" (eleven har
//            dragit den och sparat) → står där, som vilken möbel som helst.
//   heders   (#528) ingen nyckel och klassens Troféhylla ("trofehylla") står
//            i rummet → de KC_HEDERS_MAX finaste (pokaltypens varde, sedan
//            nyast) ritas IN I Troféhyllan (följer med när den flyttas).
//   auto     ingen nyckel → placeras AUTOMATISKT och sparas INTE: finast
//            först (varde, sedan nyast, sedan id) på pokalhyllans 3 platser,
//            resten på första lediga väggplats. Bara ur (pokaler, placedItems)
//            → alla klienter ger samma placering utan att någon sparar.
// Hyllan (kc-pokalhylla, art-klasscenter-pokaler.js) är en FAST möbel på
// väggen. Den ritas i rums-enheter (cap:ad per enhet, se rumSakHtml) medan
// placeringar är procent av scenen → hyllplatsernas procent beror på scenens
// mått: hyllaPlatsPos(i, matt) räknar om dem (ritningen följer med vid
// resize, valet av plats gör det inte).
//
// API
//   (nycklarna: pokalNyckel/pokalIdFranNyckel i kc-pokal-typer.js; taket för
//   flyttade pokaler: KC_POKAL_MAX i kc-layout-plan.js)
//   KC_HYLLA = { x, y, w, h }  hyllans mitt i % av scenen + storlek i rums-enheter
//   KC_POKAL_STORLEK = { w, h }  en pokal i rummet (= en hyllplats), rums-enheter
//   hyllaPlatsPos(i, matt) → { x, y }   matt = { W, H, enhet } (px)
//   placeraPokaler(pokaler, placedItems, matt?) → { [nyckel]: { x, y, z:0 } }
//       bara pokaler UTAN nyckel i placedItems och utanför Troféhyllan
//   hedersPokaler(pokaler, placedItems) → Pokal[]  de som står i Troféhyllan
//       (tom om den inte står i rummet), i platsordning
//   KC_TROFEHYLLA_ID = "trofehylla", KC_HEDERS_MAX = 6
//   finastForst(a, b)  sorteringen (varde ↓, wonAt ↓, id)
// ============================================================================

import { KC_POKALHYLLA_PLATSER, KC_POKALER, KC_TROFEHYLLA_PLATSER } from "../art-klasscenter-pokaler.js";
import { pokalNyckel } from "./kc-pokal-typer.js";

// --- Hyllan --------------------------------------------------------------------
const [, , HVB_W, HVB_H] = KC_POKALER["kc-pokalhylla"].viewBox.split(" ").map(Number);

/**
 * Hyllans mitt (% av scenen) och storlek (rums-enheter). Till vänster om
 * portalen, väggens övre halva – golvlinjen ligger på 62 %.
 */
const HYLLA_W = 13;
export const KC_HYLLA = Object.freeze({
  x: 20,
  y: 33,
  w: HYLLA_W,
  h: +((HYLLA_W * HVB_H) / HVB_W).toFixed(2),
});

/** En pokals storlek i rummet (rums-enheter) = en hyllplats → ingen storleksändring när den dras ut. */
export const KC_POKAL_STORLEK = Object.freeze({
  w: +((KC_POKALHYLLA_PLATSER[0].w * HYLLA_W) / HVB_W).toFixed(3),
  h: +((KC_POKALHYLLA_PLATSER[0].h * HYLLA_W) / HVB_W).toFixed(3),
});

/** Standardmått när scenen inte är utlagd (dold/ej mätt): desktop 1000 × 600. */
const STD_MATT = Object.freeze({ W: 1000, H: 600, enhet: 25 });

function giltigaMatt(matt) {
  const m = matt || {};
  return m.W > 0 && m.H > 0 && m.enhet > 0 ? m : STD_MATT;
}

/** Katalog-id:t för shoppens Troféhylla (kc-shop-items.js) = hedershyllan. */
export const KC_TROFEHYLLA_ID = "trofehylla";
/** Så många pokaler rymmer Troféhyllan (den gratis hyllan: KC_POKALHYLLA_PLATSER). */
export const KC_HEDERS_MAX = KC_TROFEHYLLA_PLATSER.length;

/** Hyllplats i (0–2) → pokalens mitt i % av scenen. */
export function hyllaPlatsPos(i, matt) {
  const { W, H, enhet } = giltigaMatt(matt);
  const p = KC_POKALHYLLA_PLATSER[i];
  const skala = (KC_HYLLA.w * enhet) / HVB_W; // px per viewBox-enhet
  const dx = (p.x + p.w / 2 - HVB_W / 2) * skala;
  const dy = (p.y + p.h / 2 - HVB_H / 2) * skala;
  return { x: +(KC_HYLLA.x + (dx / W) * 100).toFixed(2), y: +(KC_HYLLA.y + (dy / H) * 100).toFixed(2) };
}

// Väggplatser för pokaler som inte ryms på hyllan: väggens övre band, från
// hyllan och utåt (procent – oberoende av scenens mått → deterministiskt).
const VAGG = [];
for (const y of [22, 44]) for (const x of [36, 64, 8, 92, 50, 28, 72]) VAGG.push({ x, y });
const NARA = 6; // % – en väggplats inom detta avstånd från en sak är upptagen

// Täcker hyllan (plus en halv pokal runt om) väggplatsen? Procent av scenen.
function underHyllan(matt) {
  const { W, H, enhet } = giltigaMatt(matt);
  const hx = ((KC_HYLLA.w + KC_POKAL_STORLEK.w) * enhet * 50) / W;
  const hy = ((KC_HYLLA.h + KC_POKAL_STORLEK.h) * enhet * 50) / H;
  return (p) => Math.abs(p.x - KC_HYLLA.x) < hx && Math.abs(p.y - KC_HYLLA.y) < hy;
}

function wonAt(p) {
  return Number(p?.wonAt) || 0;
}

/** Finast först: pokaltypens varde, sedan nyast, sedan id (deterministiskt). */
export function finastForst(a, b) {
  return (Number(b?.varde) || 0) - (Number(a?.varde) || 0) || wonAt(b) - wonAt(a) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Pokaler som INTE står i layouten (ingen flyttad nyckel), finast först.
function ejFlyttade(pokaler, pi) {
  return pokaler.filter((p) => p && p.id && !(pokalNyckel(p.id) in pi)).sort(finastForst);
}

/** Pokalerna i Troféhyllan (tom lista om den inte står i rummet). */
export function hedersPokaler(pokaler = [], placedItems = {}) {
  const pi = placedItems || {};
  return KC_TROFEHYLLA_ID in pi ? ejFlyttade(pokaler, pi).slice(0, KC_HEDERS_MAX) : [];
}

/**
 * Auto-placering för klassens pokaler som INTE står i layouten och inte
 * står i Troféhyllan.
 * @param {Array<{id:string, wonAt?:number|null, varde?:number}>} pokaler  (normaliseraPokaler)
 * @param {object} placedItems  layoutens (+ lokala) placeringar
 * @param {{W:number,H:number,enhet:number}} [matt]  scenens mått i px
 * @returns {Object<string,{x:number,y:number,z:number}>}
 */
export function placeraPokaler(pokaler = [], placedItems = {}, matt) {
  const pi = placedItems || {};
  const heders = KC_TROFEHYLLA_ID in pi ? KC_HEDERS_MAX : 0;
  const kvar = ejFlyttade(pokaler, pi).slice(heders);
  const ut = {};
  const hylla = Math.min(kvar.length, KC_POKALHYLLA_PLATSER.length);
  for (let i = 0; i < hylla; i++) ut[pokalNyckel(kvar[i].id)] = { ...hyllaPlatsPos(i, matt), z: 0 };
  // Resten: första väggplats som ingen sak (eller tidigare pokal) står nära
  // och som inte skyms av pokalhyllan själv (#528: med 3 platser hamnar
  // pokaler på väggen tidigt – och två väggplatser ligger över hyllan).
  const upptagna = Object.values(pi).filter((p) => p && Number.isFinite(p.x));
  const skymd = underHyllan(matt);
  let v = 0;
  for (const p of kvar.slice(hylla)) {
    while (v < VAGG.length && (skymd(VAGG[v]) ||
      upptagna.some((u) => Math.hypot(u.x - VAGG[v].x, u.y - VAGG[v].y) < NARA))) v++;
    // Fullt → staplas ovanpå varandra i sista väggplatsens band (förskjutet).
    const plats = v < VAGG.length ? VAGG[v] : { x: 42 + ((v - VAGG.length) % 9) * 4, y: 22 };
    v++;
    ut[pokalNyckel(p.id)] = { x: plats.x, y: plats.y, z: 0 };
  }
  return ut;
}
