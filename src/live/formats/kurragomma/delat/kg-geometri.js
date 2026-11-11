// ============================================================================
// Kurragömma (#836): GEOMETRIN – skydd, kollision, giltigt gömställe och
// platsnamn (spec §2.2–§2.3). Ren logik på kartan som data (kg-karta.js):
// ingen DOM, ingen Firebase, ingen three.js. Samma funktioner används av
// klienten (mätaren, rörelsen – B/D) och servern (kgLas, kgLeta – C).
//
// API (karta är valfri, standard Ön)
//   skydd(x, z, karta)              → 0–3 (3 inne i lov, 2 ≤ 0,6 m från kant, 1 ≤ 2 m, annars 0)
//   skyddText(niva)                 → "Syns lätt" … "Mycket bra gömställe"
//   kollidera(x, z, karta)          → { x, z } knuffad ut ur fasta föremål och in på ön
//   innanforOn(x, z, karta)         → bool
//   giltigtGomstalle(x, z, karta)   → bool: på ön och inte inuti något fast föremål
//   narmasteGiltiga(x, z, karta)    → { x, z } – samma punkt om den är giltig, annars den närmaste giltiga
//   platsNamn(x, z, karta)          → "i buskaget" | "vid ladan" | "vid ett träd" | "ute på ängen"
//   gomstalleNaraForemal(karta, slump) → { x, z } giltig punkt nära ett slumpat föremål (frånkopplad elev)
//   avstand(a, b)                   → meter mellan { x, z }
// slump är en funktion som ger tal i [0, 1) – servern skickar Math.random,
// simuleringen och testerna en seedad (kg-prng.js).
// ============================================================================

import {
  SKYDD_BRA_M, SKYDD_OKEJ_M, SKYDD_TEXT, KNUFF_MARGINAL_M, PLATS_VID_M, PLATS_ANGEN, AUTO_GOM_AVSTAND,
} from "./kg-config.js";
import { ON } from "./kg-karta.js";

const EPS = 1e-9;
/** Högsta skyddsnivån (3 = inne i lov). */
const MAX_NIVA = SKYDD_TEXT.length - 1;

export const avstand = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const tal = (v) => (Number.isFinite(v) ? v : 0);

/** Skyddsnivå 0–3 för en punkt (spec §2.3). Föremål med r = 0 ger inget skydd. */
export function skydd(x, z, karta = ON) {
  let basta = 0;
  for (const f of karta.foremal) {
    if (!(f.r > 0)) continue;
    const d = Math.hypot(x - f.x, z - f.z);
    const kant = d - f.r;
    const niva = f.lov && d <= f.r + EPS ? MAX_NIVA : kant <= SKYDD_BRA_M + EPS ? 2 : kant <= SKYDD_OKEJ_M + EPS ? 1 : 0;
    if (niva > basta) basta = niva;
    if (basta === MAX_NIVA) break;
  }
  return basta;
}

export function skyddText(niva) {
  return SKYDD_TEXT[Math.max(0, Math.min(MAX_NIVA, niva | 0))];
}

export function innanforOn(x, z, karta = ON) {
  return Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) <= karta.radie + EPS;
}

/** Håll punkten inom ön (projektion mot mitten). */
function innePaOn(x, z, karta) {
  const d = Math.hypot(x, z);
  if (d <= karta.radie) return { x, z };
  return { x: (x / d) * karta.radie, z: (z / d) * karta.radie };
}

/**
 * Knuffar ut ur fasta föremål och håller platsen inom ön (spec §2.3). Ett varv
 * räcker när kartan håller sina avstånd (testat), men vi tar några för säkerhets
 * skull. En punkt exakt i mitten av ett föremål knuffas åt +x.
 */
export function kollidera(x, z, karta = ON) {
  let p = innePaOn(tal(x), tal(z), karta);
  for (let varv = 0; varv < 4; varv++) {
    let flyttad = false;
    for (const f of karta.foremal) {
      if (!(f.fast > 0)) continue;
      const dx = p.x - f.x;
      const dz = p.z - f.z;
      const d = Math.hypot(dx, dz);
      if (d >= f.fast) continue;
      const ut = f.fast + KNUFF_MARGINAL_M;
      p = d < EPS ? { x: f.x + ut, z: f.z } : { x: f.x + (dx / d) * ut, z: f.z + (dz / d) * ut };
      flyttad = true;
    }
    p = innePaOn(p.x, p.z, karta);
    if (!flyttad) break;
  }
  return p;
}

/** Inuti något fast föremål? */
function iFast(x, z, karta) {
  return karta.foremal.some((f) => f.fast > 0 && Math.hypot(x - f.x, z - f.z) < f.fast);
}

/** Giltigt gömställe: på ön och inte inuti ett fast föremål (servern i kgLas). */
export function giltigtGomstalle(x, z, karta = ON) {
  return innanforOn(x, z, karta) && !iFast(x, z, karta);
}

/**
 * Närmaste giltiga punkt. Är punkten giltig kommer den tillbaka oförändrad.
 * Annars knuffas den ut (kollidera). Skulle det ändå inte bli giltigt (en karta
 * med överlappande fasta föremål) letar vi utåt i en spiral – resultatet är
 * alltid giltigt.
 */
export function narmasteGiltiga(x, z, karta = ON) {
  if (giltigtGomstalle(x, z, karta)) return { x, z };
  const p = kollidera(x, z, karta);
  if (giltigtGomstalle(p.x, p.z, karta)) return p;
  for (let ring = 1; ring <= 60; ring++) {
    const r = ring * 0.25;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      const q = innePaOn(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, karta);
      if (giltigtGomstalle(q.x, q.z, karta)) return q;
    }
  }
  return { ...karta.sokarStart };
}

/**
 * Platsnamn för flödet och elevskärmen (spec §2.2):
 *   1. inne i ett lov-föremål → "i buskaget" (minsta först)
 *   2. inne i ett föremåls yta (yta ?? r) → "vid bron" (minsta ytan först, så bron slår dammen)
 *   3. högst PLATS_VID_M från en kant → "vid ladan" (närmaste kanten)
 *   4. annars "ute på ängen"
 */
export function platsNamn(x, z, karta = ON) {
  let lov = null;
  let inne = null;
  let nara = null;
  for (const f of karta.foremal) {
    if (!f.namn) continue;
    const yta = f.yta ?? f.r;
    if (!(yta > 0)) continue;
    const d = Math.hypot(x - f.x, z - f.z);
    if (f.lov && d <= f.r && (!lov || f.r < lov.r)) lov = f;
    if (d <= yta && (!inne || yta < inne.yta)) inne = { f, yta };
    const kant = d - yta;
    if (kant <= PLATS_VID_M && (!nara || kant < nara.kant)) nara = { f, kant };
  }
  if (lov) return `i ${lov.namn}`;
  if (inne) return `vid ${inne.f.namn}`;
  if (nara) return `vid ${nara.f.namn}`;
  return PLATS_ANGEN;
}

/**
 * Ett giltigt gömställe nära ett slumpat föremål (spec §1.2: eleven har inte
 * låst och är frånkopplad när gömfasen slutar). Bara föremål som ger skydd.
 */
export function gomstalleNaraForemal(karta = ON, slump) {
  const kandidater = karta.foremal.filter((f) => f.r > 0);
  const f = kandidater[Math.min(kandidater.length - 1, Math.floor(slump() * kandidater.length))];
  const a = slump() * 2 * Math.PI;
  const r = f.r * (AUTO_GOM_AVSTAND.min + slump() * (AUTO_GOM_AVSTAND.max - AUTO_GOM_AVSTAND.min));
  return narmasteGiltiga(f.x + Math.cos(a) * r, f.z + Math.sin(a) * r, karta);
}
