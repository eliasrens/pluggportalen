// ============================================================================
// Matchdagen på SERVERN – vänskapsmatcherna, det gemensamma (functions/md-vanskap-state.js, #874)
// ----------------------------------------------------------------------------
// Spec §11 (docs/MATCHDAGEN.md §18). Samlingarna – bara Cloud Functions skriver (firestore.rules):
//   mdLobby/{classId}            lobbyn per klass: { utmaningar: { id: { fran, franNamn, franLag, till, sedan } },
//                                matcher: { id: { a, b, aNamn, bNamn, aLag, bLag, start } } }
//   mdVanskap/{matchId}          matchdokumentet (båda spelarna lyssnar): { classId, a, b, spelare, namn, lag,
//                                tid, status, V, h, fas, halvtid, resultat, skapad, uppdaterad }
//   mdVanskap/{id}/privat/{uid}  elevens läge: { classId, sida, fas, roll, val, fraga, kalla, svar, aktiv }
//   mdVanskap/{id}/facit/{uid}   frågebanken MED facit (bara servern och läraren): { classId, sida, bank }
//   mdVanskapElev/{uid}          spärren och dagstaket: { aktiv: matchId|null, dag, betalda }
//   matchdagen/{uid}.inbordes    { [motståndarUid]: { v, o, f, namn } } + kassan (FieldValue.increment)
//   matchdagen/{uid}/matcher/{matchId}  typ "vanskap" (samma form som solospelets matcher)
// Alla tider är epoch-ms ur deps.now (serverns klocka) – klienten skickar aldrig tid.
// deps = { db, FieldValue, now?(), randomId?(n), rng?() }
// ============================================================================

import { randomInt } from "node:crypto";
import { activeLockMal } from "./schack/schack-server-delat.js";
import { namnFor, post, randomId } from "./schack-state.js";
import { lagbonus } from "./matchdagen/md-motor.js";

export class MdFel extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MdFel";
    this.code = code;
  }
}

export const MODUL = "matchdagen";
export const LOBBY = "mdLobby";
export const MATCH = "mdVanskap";
export const ELEV = "mdVanskapElev";
export { post, namnFor };

export const ctx = (deps) => ({
  ...deps,
  now: deps.now || Date.now,
  rid: deps.randomId || randomId,
  rng: deps.rng || (() => randomInt(0, 2 ** 32) / 2 ** 32),
});

const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;
export function idEller(v, vad) {
  if (typeof v !== "string" || !ID_OK.test(v) || /^__.*__$/.test(v)) throw new MdFel("invalid-argument", `Ogiltigt ${vad}.`);
  return v;
}

export const lobbyRef = (c, classId) => c.db.collection(LOBBY).doc(classId);
export const matchRef = (c, id) => c.db.collection(MATCH).doc(id);
export const privatRef = (c, id, uid) => matchRef(c, id).collection("privat").doc(uid);
export const facitRef = (c, id, uid) => matchRef(c, id).collection("facit").doc(uid);
export const elevRef = (c, uid) => c.db.collection(ELEV).doc(uid);
export const karriarRef = (c, uid) => c.db.collection("matchdagen").doc(uid);

/** Lobbyns form (saknat dokument = tomt), egna nycklar utan prototyp. */
export function lobbyData(snap) {
  const d = snap?.exists ? snap.data() : {};
  const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.assign(Object.create(null), v) : Object.create(null));
  return { utmaningar: map(d.utmaningar), matcher: map(d.matcher) };
}

/** Har eleven Matchdagen i klassen (classes/{id}.elevModuler, §11.1)? */
export const harMatchdagen = (k, uid) => Array.isArray(post(k?.elevModuler, uid)) && post(k.elevModuler, uid).includes(MODUL);

/**
 * Grinden (§11.1): uid går i klassen, läraren har slagit på Matchdagen för eleven
 * (elevModuler) och inget fokuslås är aktivt (Matchdagen är learning och inte låsbar –
 * varje aktivt lås stänger den, som klientens class-lock.js). `andra` = klasskompisen.
 * @returns {Promise<object>} klassdokumentet
 */
export async function hamtaKlass(db, uid, classId, nu, andra = null) {
  idEller(classId, "klass-id");
  const snap = await db.collection("classes").doc(classId).get();
  const k = snap.exists ? snap.data() : null;
  if (!k || !Array.isArray(k.studentIds) || !k.studentIds.includes(uid)) throw new MdFel("permission-denied", "Du går inte i den klassen.");
  if (!harMatchdagen(k, uid)) throw new MdFel("failed-precondition", "Matchdagen är inte påslaget för dig.");
  if (activeLockMal(k.lock, nu)) throw new MdFel("failed-precondition", "Din klass har fokusläge just nu – Matchdagen är stängd.");
  if (andra != null && (!k.studentIds.includes(andra) || !harMatchdagen(k, andra))) {
    throw new MdFel("failed-precondition", "Kompisen har inte Matchdagen i din klass.");
  }
  return k;
}

/** Elevens klasser (för mdSvara utan classId). */
export async function klassIdsForElev(db, uid) {
  const s = await db.collection("classes").where("studentIds", "array-contains", uid).get();
  return s.docs.map((d) => d.id);
}

/** Lagets namn, färg och bonus ur karriären (matchdagen/{uid}); null utan klubb. */
export function lagUr(K) {
  if (!K?.klubb || typeof K.klubb.namn !== "string") return null;
  return { namn: K.klubb.namn.slice(0, 24), farg: String(K.klubb.farg || ""), bonus: lagbonus(Array.isArray(K.trupp) ? K.trupp : []) };
}

/**
 * Spärren "en vänskapsmatch åt gången" (§11.2) ÖVER klasser: mdVanskapElev/{uid}.aktiv. Står ett id
 * där som inte längre pågår räknas eleven som fri (självläkande). get = tx.get i en transaktion.
 * @returns {Promise<{ elev: object, aktiv: string|null, match: object|null }>}
 */
export async function aktivFor(c, uid, get) {
  const es = await get(elevRef(c, uid));
  const elev = es.exists ? es.data() : {};
  const id = typeof elev.aktiv === "string" && ID_OK.test(elev.aktiv) ? elev.aktiv : null;
  if (!id) return { elev, aktiv: null, match: null };
  const ms = await get(matchRef(c, id));
  return ms.exists && ms.data().status === "pagar" ? { elev, aktiv: id, match: ms.data() } : { elev, aktiv: null, match: null };
}

/** Utmaningar äldre än VANSKAP.utmaning sekunder tas bort (varje skrivning av lobbyn). */
export function rensaUtmaningar(utm, nu, maxMs) {
  const ut = Object.create(null);
  for (const [id, u] of Object.entries(utm)) if (u && typeof u.sedan === "number" && nu - u.sedan < maxMs) ut[id] = u;
  return ut;
}
