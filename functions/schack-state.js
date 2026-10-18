// ============================================================================
// Schack på SERVERN – gemensamt för lobbyn, partiet och läraren
// (functions/schack-state.js, #779, Etapp 2A; spec §6, docs/SCHACK.md §12)
// ----------------------------------------------------------------------------
//   SchackFel(code, message)   → HttpsError i index.js
//   hamtaKlassForElev          elevens grind: klassmedlem + modulen `schack`
//                              påslagen (enabledModules) + inget aktivt fokuslås
//   assertLarare               lärarens grind: admin, eller årskurskonto med klassen
//   namnFor                    elevnamn ur classProjections (EN läsning), reserv students/
//   klassData / nyttParti      dokumentformerna i schackKlass/ och schackPartier/
// Alla tider är epoch-ms ur deps.now (serverns klocka) – klienten skickar aldrig tid.
// deps = { db, FieldValue, now?(), randomId?(n), rng?() }
// ============================================================================

import { randomInt } from "node:crypto";
import { activeLockMal, nyKlocka } from "./schack/schack-server-delat.js";
import { START_FEN } from "./schack/schack-server-parti.js";
import { callerRole } from "./teacher-role.js";

export class SchackFel extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SchackFel";
    this.code = code;
  }
}

export const MODUL_ID = "schack";
export const KLASS_COLL = "schackKlass";
export const PARTI_COLL = "schackPartier";

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function randomId(n = 20) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALNUM[randomInt(0, ALNUM.length)];
  return s;
}

export const ctx = (deps) => ({
  ...deps,
  now: deps.now || Date.now,
  rid: deps.randomId || randomId,
  rng: deps.rng || (() => randomInt(0, 2 ** 32) / 2 ** 32),
});

export const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;
export function idEller(v, vad) {
  if (typeof v !== "string" || !ID_OK.test(v)) throw new SchackFel("invalid-argument", `Ogiltigt ${vad}.`);
  return v;
}

/** Klassdokumentets form (saknat dokument = tomt). */
export function tomKlass() {
  return { vantar: {}, utmaningar: {}, partier: {}, tabell: {}, dold: false };
}
export function klassData(snap) {
  const d = snap?.exists ? snap.data() : {};
  const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  return { vantar: map(d.vantar), utmaningar: map(d.utmaningar), partier: map(d.partier), tabell: map(d.tabell), dold: d.dold === true };
}

/**
 * Elevens grind (§6 "Varje callable kontrollerar"): uid går i klassen, klassen
 * har slagit på schack (opt-in i enabledModules, inte dold i hiddenModules)
 * och inget fokuslås är aktivt (schack är inte låsbart, så VARJE aktivt lås
 * stänger det – som klientens class-lock.js). `get` = db-läsning eller tx.get.
 * @returns {Promise<object>} klassdokumentet
 */
export async function hamtaKlassForElev(db, uid, classId, nu, get = (ref) => ref.get()) {
  idEller(classId, "klass-id");
  const snap = await get(db.collection("classes").doc(classId));
  const k = snap.exists ? snap.data() : null;
  if (!k || !Array.isArray(k.studentIds) || !k.studentIds.includes(uid)) {
    throw new SchackFel("permission-denied", "Du går inte i den klassen.");
  }
  const pa = Array.isArray(k.enabledModules) && k.enabledModules.includes(MODUL_ID);
  const dold = Array.isArray(k.hiddenModules) && k.hiddenModules.includes(MODUL_ID);
  if (!pa || dold) throw new SchackFel("failed-precondition", "Schack är inte påslaget för din klass.");
  if (activeLockMal(k.lock, nu)) throw new SchackFel("failed-precondition", "Din klass har fokusläge just nu – schacket är stängt.");
  return k;
}

/** Elevens klasser (för anrop utan classId: schackSlutaVanta, schackSvara). */
export async function klassIdsForElev(db, uid) {
  const s = await db.collection("classes").where("studentIds", "array-contains", uid).get();
  return s.docs.map((d) => d.id);
}

/**
 * Lärarens grind (lärarcallables, 2C): admin, eller årskurskonto vars konto
 * har klassen – samma som hasClass(classId) i firestore.rules.
 */
export async function assertLarare(db, auth, classId) {
  const caller = await callerRole(db, auth);
  if (!caller) throw new SchackFel("permission-denied", "Det här kan bara en lärare göra.");
  if (caller.role !== "admin" && !caller.classIds.includes(classId)) {
    throw new SchackFel("permission-denied", "Du har inte den klassen.");
  }
  return caller;
}

/**
 * Elevnamn: classProjections/{classId}.members[uid].namn med EN läsning (#231);
 * saknas en elev där läses students/{uid}. Reserv: uid.
 */
export async function namnFor(db, classId, uids) {
  const namn = {};
  const proj = await db.collection("classProjections").doc(classId).get();
  const members = proj.exists ? proj.data().members || {} : {};
  for (const uid of uids) {
    const n = members[uid]?.namn;
    if (typeof n === "string" && n.trim()) {
      namn[uid] = n.trim().slice(0, 60);
      continue;
    }
    const s = await db.collection("students").doc(uid).get();
    const sn = s.exists ? s.data().namn : null;
    namn[uid] = typeof sn === "string" && sn.trim() ? sn.trim().slice(0, 60) : uid;
  }
  return namn;
}

/** Ett nytt partidokument (schackPartier/{id}) och dess post i klassens `partier`. */
export function nyttParti({ classId, vit, svart, namn, klocka, nu }) {
  const doc = {
    classId, vit, svart, vitNamn: namn[vit], svartNamn: namn[svart],
    fen: START_FEN, drag: [], tur: "w", status: "pagar", resultat: null, orsak: null,
    klocka: klocka ? nyKlocka(klocka, nu) : null, remiErbjudenAv: null,
    senastDragAt: nu, skapad: nu, uppdaterad: nu,
  };
  const post = { vit, svart, vitNamn: namn[vit], svartNamn: namn[svart], klocka: klocka ?? null, start: nu };
  return { doc, post };
}
