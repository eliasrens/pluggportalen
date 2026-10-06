// ============================================================================
// Förhandsvisnings-STUB av firebase-firestore 10.12.2 (preview-pixi-hus.html, #419)
// ----------------------------------------------------------------------------
// Importmappen i preview-pixi-hus.html pekar SDK-URL:en hit, så HELA den
// riktiga appen (router, pages-varld, data*.js, kameran, Pixi-motorn) körs mot
// ett minnes-Firestore i stället för prod. Bara den yta appen faktiskt
// importerar finns (doc/getDoc/setDoc/updateDoc/deleteDoc/collection/getDocs/
// query/where/orderBy/runTransaction/writeBatch/arrayUnion/arrayRemove/
// serverTimestamp). Inga nätanrop; allt nollställs vid omladdning.
// Varje läsning/skrivning räknas i window.__ppStub (Firestore-acceptansen:
// Pixi-vägen får aldrig orsaka en läsning).
// ============================================================================

import { seed } from "./seed.js";

const store = new Map(); // "coll/id(/coll/id)*" → data
const rakna = { las: 0, skriv: 0, logg: [] };
const notera = (typ, path) => {
  rakna[typ === "las" ? "las" : "skriv"]++;
  rakna.logg.push(`${typ} ${path}`);
  if (rakna.logg.length > 400) rakna.logg.shift();
};

class FieldValue {
  constructor(typ, varden) { this.typ = typ; this.varden = varden; }
}
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
}
export const serverTimestamp = () => new FieldValue("ts");
export const arrayUnion = (...v) => new FieldValue("union", v);
export const arrayRemove = (...v) => new FieldValue("remove", v);
export const increment = (n) => new FieldValue("inc", n);
export const deleteField = () => new FieldValue("del");

class FirestoreError extends Error {
  constructor(code, msg) { super(msg); this.code = code; this.name = "FirebaseError"; }
}

// ---- Referenser ----------------------------------------------------------------
const db0 = { type: "firestore", app: null };
export function getFirestore(app) { db0.app = app; return db0; }

const delar = (bas, segs) => [...(bas?.path ? bas.path.split("/") : []), ...segs.flatMap((s) => String(s).split("/"))].filter(Boolean);
let autoNr = 0;
export function doc(bas, ...segs) {
  const p = delar(bas, segs);
  if (p.length % 2) p.push(`auto${Date.now().toString(36)}${++autoNr}`);
  return { type: "document", path: p.join("/"), id: p[p.length - 1], firestore: db0,
    get parent() { return collection(db0, p.slice(0, -1).join("/")); } };
}
export function collection(bas, ...segs) {
  const p = delar(bas, segs);
  return { type: "collection", path: p.join("/"), id: p[p.length - 1], firestore: db0 };
}

// ---- Värden ----------------------------------------------------------------------
const klona = (v) => {
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(klona);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, klona(x)]));
  return v;
};
const lika = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Lös ett skriv-värde mot det gamla (sentinel → konkret). undefined = ta bort. */
function los(v, gammal) {
  if (v instanceof FieldValue) {
    if (v.typ === "ts") return Timestamp.now();
    if (v.typ === "del") return undefined;
    if (v.typ === "inc") return (typeof gammal === "number" ? gammal : 0) + v.varden;
    const bas = Array.isArray(gammal) ? gammal.slice() : [];
    if (v.typ === "union") { for (const x of v.varden) if (!bas.some((y) => lika(x, y))) bas.push(klona(x)); return bas; }
    return bas.filter((y) => !v.varden.some((x) => lika(x, y)));
  }
  if (v instanceof Timestamp) return klona(v);
  if (Array.isArray(v)) return v.map((x) => los(x, undefined));
  if (v && typeof v === "object") {
    const ut = {};
    for (const [k, x] of Object.entries(v)) { const r = los(x, undefined); if (r !== undefined) ut[k] = r; }
    return ut;
  }
  return v;
}
const arObjekt = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof FieldValue);

/** setDoc merge: maps djup-mergas, allt annat ersätts. */
function merga(mal, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (arObjekt(v)) { if (!arObjekt(mal[k])) mal[k] = {}; merga(mal[k], v); continue; }
    const r = los(v, mal[k]);
    if (r === undefined) delete mal[k]; else mal[k] = r;
  }
  return mal;
}
/** updateDoc: nycklar är fält-sökvägar ("garden.placements"). */
function uppdatera(mal, patch) {
  for (const [nyckel, v] of Object.entries(patch)) {
    const p = nyckel.split(".");
    let o = mal;
    for (const s of p.slice(0, -1)) { if (!arObjekt(o[s])) o[s] = {}; o = o[s]; }
    const sist = p[p.length - 1];
    const r = los(v, o[sist]);
    if (r === undefined) delete o[sist]; else o[sist] = r;
  }
  return mal;
}

// ---- Snapshots ---------------------------------------------------------------------
function snap(ref) {
  const d = store.get(ref.path);
  const data = d === undefined ? undefined : klona(d);
  return { id: ref.id, ref, exists: () => data !== undefined, data: () => (data === undefined ? undefined : klona(data)),
    get: (f) => f.split(".").reduce((o, s) => (o == null ? undefined : o[s]), data) };
}
const vila = () => new Promise((r) => setTimeout(r, 2));

export async function getDoc(ref) { await vila(); notera("las", ref.path); return snap(ref); }

function skrivSet(ref, data, opt) {
  notera("skriv", ref.path);
  if (opt?.merge) store.set(ref.path, merga(klona(store.get(ref.path) || {}), data));
  else store.set(ref.path, los(data, undefined));
}
function skrivUpdate(ref, data) {
  notera("skriv", ref.path);
  const gammal = store.get(ref.path);
  if (gammal === undefined) throw new FirestoreError("not-found", `No document to update: ${ref.path}`);
  store.set(ref.path, uppdatera(klona(gammal), data));
}
function skrivDelete(ref) { notera("skriv", ref.path); store.delete(ref.path); }

export async function setDoc(ref, data, opt) { await vila(); skrivSet(ref, data, opt); }
export async function updateDoc(ref, data) { await vila(); skrivUpdate(ref, data); }
export async function deleteDoc(ref) { await vila(); skrivDelete(ref); }

// ---- Frågor ------------------------------------------------------------------------
export const where = (falt, op, varde) => ({ typ: "where", falt, op, varde });
export const orderBy = (falt, riktning = "asc") => ({ typ: "orderBy", falt, riktning });
export const limit = (n) => ({ typ: "limit", n });
export const query = (coll, ...villkor) => ({ ...coll, villkor });

const OPS = {
  "==": (a, b) => lika(a, b), "!=": (a, b) => !lika(a, b),
  "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b,
  in: (a, b) => b.some((x) => lika(a, x)), "not-in": (a, b) => !b.some((x) => lika(a, x)),
  "array-contains": (a, b) => Array.isArray(a) && a.some((x) => lika(x, b)),
  "array-contains-any": (a, b) => Array.isArray(a) && a.some((x) => b.some((y) => lika(x, y))),
};
export async function getDocs(q) {
  await vila();
  const djup = q.path.split("/").length + 1;
  let refs = [...store.keys()].filter((k) => k.startsWith(`${q.path}/`) && k.split("/").length === djup).map((k) => doc(db0, k));
  let snaps = refs.map(snap);
  for (const v of q.villkor || []) {
    if (v.typ === "where") snaps = snaps.filter((s) => OPS[v.op]?.(s.get(v.falt), v.varde));
    if (v.typ === "orderBy") snaps.sort((a, b) => ((a.get(v.falt) ?? 0) > (b.get(v.falt) ?? 0) ? 1 : -1) * (v.riktning === "desc" ? -1 : 1));
    if (v.typ === "limit") snaps = snaps.slice(0, v.n);
  }
  notera("las", `${q.path} (${snaps.length} dok)`);
  return { docs: snaps, size: snaps.length, empty: !snaps.length, forEach: (fn) => snaps.forEach(fn) };
}

// ---- Transaktioner / batcher -------------------------------------------------------
export async function runTransaction(_db, fn) {
  await vila();
  const ops = [];
  const tx = {
    async get(ref) { notera("las", ref.path); return snap(ref); },
    set(ref, data, opt) { ops.push(() => skrivSet(ref, data, opt)); return tx; },
    update(ref, data) { ops.push(() => skrivUpdate(ref, data)); return tx; },
    delete(ref) { ops.push(() => skrivDelete(ref)); return tx; },
  };
  const res = await fn(tx);
  const fore = new Map(store);
  try { ops.forEach((o) => o()); } catch (err) { store.clear(); fore.forEach((v, k) => store.set(k, v)); throw err; }
  return res;
}
export function writeBatch() {
  const ops = [];
  const b = {
    set(ref, data, opt) { ops.push(() => skrivSet(ref, data, opt)); return b; },
    update(ref, data) { ops.push(() => skrivUpdate(ref, data)); return b; },
    delete(ref) { ops.push(() => skrivDelete(ref)); return b; },
    async commit() { await vila(); ops.forEach((o) => o()); },
  };
  return b;
}

// ---- Sådd + insyn ------------------------------------------------------------------
seed((path, data) => store.set(path, los(data, undefined)));
try {
  window.__ppStub = {
    rakna,
    las: (path) => klona(store.get(path)),
    nollstallRakning() { rakna.las = 0; rakna.skriv = 0; rakna.logg.length = 0; },
  };
} catch { /* ingen window */ }
