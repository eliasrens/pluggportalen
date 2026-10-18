// ============================================================================
// Partiet mot datorn som data (#776, §3.3/§4): skapa, spara och läsa det ur
// localStorage (alltid inom try/catch – en webbläsare utan lagring eller med
// full kvot stoppar aldrig spelet), samt elevens senaste val av nivå och färg.
// Ren modul: lagringen skickas in, så den testas med ett Map-liknande objekt.
//
//   { v: 1, niva, egenFarg: "w"|"b", drag: ["e4", "e5", …], varna, seed,
//     skapad, uppdaterad, slut: null | { resultat, orsak, vinnare } }
//
// Nyckeln är per elev (pp:schack:dator:<elevId>) – skolans Chromebooks delas.
// ============================================================================

import { NIVAER, STANDARD_NIVA, nivaFor } from "./schack-motor.js";

export const PARTI_VERSION = 1;

export function partiNyckel(elevId) {
  return `pp:schack:dator:${elevId || "gast"}`;
}

/** "Varna mig" är på som standard för Bonden och Springaren (§3.3). */
export function varnaStandard(nivaId) {
  return nivaId === "bonden" || nivaId === "springaren";
}

/** Nytt parti. `farg` = "w" | "b" | "slump" (slumpas med `slump()`, standard Math.random). */
export function nyttParti({ niva = STANDARD_NIVA, farg = "w", slump = Math.random, nu = Date.now } = {}) {
  const n = nivaFor(niva);
  const egenFarg = farg === "slump" ? (slump() < 0.5 ? "w" : "b") : farg === "b" ? "b" : "w";
  return {
    v: PARTI_VERSION, niva: n.id, egenFarg, drag: [], varna: varnaStandard(n.id),
    seed: Math.floor(slump() * 2 ** 31), skapad: nu(), uppdaterad: nu(), slut: null,
  };
}

/** Är `p` ett sparat parti vi känner igen? (Trasiga eller främmande värden kastas.) */
export function giltigtParti(p) {
  return !!p && typeof p === "object" && p.v === PARTI_VERSION &&
    NIVAER.some((n) => n.id === p.niva) && (p.egenFarg === "w" || p.egenFarg === "b") &&
    Array.isArray(p.drag) && p.drag.every((d) => typeof d === "string" && d.length > 0 && d.length < 10);
}

function las(lagring, nyckel) {
  try {
    const raw = lagring.getItem(nyckel);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function skriv(lagring, nyckel, varde) {
  try {
    if (varde == null) lagring.removeItem(nyckel);
    else lagring.setItem(nyckel, JSON.stringify(varde));
    return true;
  } catch {
    return false;
  }
}

/** Det sparade partiet, eller null (saknas, trasigt, okänd nivå …). */
export function lasParti(lagring, nyckel) {
  const p = las(lagring, nyckel);
  if (!giltigtParti(p)) return null;
  return { ...p, varna: p.varna !== false, slut: p.slut && typeof p.slut === "object" ? p.slut : null, seed: Number(p.seed) || 1 };
}

/** Spara (uppdaterad-stämpeln sätts). Returnerar false om lagringen nekade – spelet fortsätter ändå. */
export function sparaParti(lagring, nyckel, parti, nu = Date.now) {
  parti.uppdaterad = nu();
  return skriv(lagring, nyckel, parti);
}

export function rensaParti(lagring, nyckel) {
  return skriv(lagring, nyckel, null);
}

/** Elevens senaste val i nivåväljaren: { niva, farg: "w"|"b"|"slump" }. */
export function lasVal(lagring, nyckel) {
  const v = las(lagring, `${nyckel}:val`);
  const niva = NIVAER.some((n) => n.id === v?.niva) ? v.niva : STANDARD_NIVA;
  const farg = ["w", "b", "slump"].includes(v?.farg) ? v.farg : "w";
  return { niva, farg };
}

export function sparaVal(lagring, nyckel, val) {
  return skriv(lagring, `${nyckel}:val`, { niva: val.niva, farg: val.farg });
}

/** Rubrikrad om partiet: "Mot Bonden · 12 drag · du spelar vit". */
export function partiText(parti) {
  const n = nivaFor(parti.niva);
  const antal = Math.ceil(parti.drag.length / 2);
  return `Mot ${n.namn} · ${antal} drag · du spelar ${parti.egenFarg === "w" ? "vit" : "svart"}`;
}
