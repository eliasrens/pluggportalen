// ============================================================================
// Preview-stub för firebase-firestore.js (#422, epic #396): en Firestore i
// MINNET så att den riktiga appen (pages-varld, varld-rum, husdjur, mat,
// rum-växlare …) kan köras utan nätverk. Bara det API som appen importerar.
// Startdata: ./seed.js. Räknare för läsningar/skrivningar: window.__fakeFs.
// ============================================================================
import { SEED } from "./seed.js";

const store = new Map(Object.entries(structuredClone(SEED)));
const stat = { reads: 0, writes: 0, logg: [] };
try { window.__fakeFs = { stat, store }; } catch { /* ingen window */ }

const klon = (v) => (v === undefined ? undefined : structuredClone(v));
const SENT = Symbol("sentinel");

export function getFirestore() { return { typ: "db" }; }

const sokvag = (bas, seg) => [bas?.path, ...seg].filter(Boolean).join("/");
export function doc(bas, ...seg) {
  const path = sokvag(bas?.typ === "db" ? null : bas, seg);
  return { typ: "doc", path, id: path.split("/").pop() };
}
export function collection(bas, ...seg) {
  const path = sokvag(bas?.typ === "db" ? null : bas, seg);
  return { typ: "coll", path, id: path.split("/").pop() };
}
export function query(coll, ...villkor) { return { typ: "query", coll, villkor }; }
export const where = (falt, op, varde) => ({ k: "where", falt, op, varde });
export const orderBy = (falt, rikt = "asc") => ({ k: "orderBy", falt, rikt });

export const arrayUnion = (...v) => ({ [SENT]: "union", v });
export const arrayRemove = (...v) => ({ [SENT]: "remove", v });
export const serverTimestamp = () => ({ [SENT]: "ts" });

const hamta = (o, falt) => falt.split(".").reduce((a, k) => (a == null ? a : a[k]), o);

function snap(ref, data) {
  return {
    id: ref.id, ref,
    exists: () => data !== undefined,
    data: () => klon(data),
    get: (f) => klon(hamta(data, f)),
  };
}

export async function getDoc(ref) {
  stat.reads++;
  stat.logg.push(`get ${ref.path}`);
  return snap(ref, store.get(ref.path));
}

export async function getDocs(q) {
  const coll = q.typ === "query" ? q.coll : q;
  const villkor = q.typ === "query" ? q.villkor : [];
  let rader = [...store.entries()]
    .filter(([p]) => p.startsWith(`${coll.path}/`) && !p.slice(coll.path.length + 1).includes("/"))
    .map(([p, d]) => ({ ref: doc(null, p), d }));
  for (const v of villkor) {
    if (v.k !== "where") continue;
    rader = rader.filter(({ d }) => {
      const x = hamta(d, v.falt);
      switch (v.op) {
        case "==": return x === v.varde;
        case "!=": return x !== v.varde;
        case "in": return v.varde.includes(x);
        case "array-contains": return Array.isArray(x) && x.includes(v.varde);
        case "array-contains-any": return Array.isArray(x) && x.some((e) => v.varde.includes(e));
        case "<": return x < v.varde;
        case "<=": return x <= v.varde;
        case ">": return x > v.varde;
        case ">=": return x >= v.varde;
        default: return true;
      }
    });
  }
  for (const v of villkor.filter((c) => c.k === "orderBy").reverse()) {
    rader.sort((a, b) => {
      const x = hamta(a.d, v.falt), y = hamta(b.d, v.falt);
      return (x > y ? 1 : x < y ? -1 : 0) * (v.rikt === "desc" ? -1 : 1);
    });
  }
  stat.reads += Math.max(1, rader.length);
  stat.logg.push(`list ${coll.path} (${rader.length})`);
  const docs = rader.map(({ ref, d }) => snap(ref, d));
  return { docs, size: docs.length, empty: !docs.length, forEach: (cb) => docs.forEach(cb) };
}

/** Lös sentinel-värden mot det gamla värdet. */
function los(nytt, gammalt) {
  if (nytt && typeof nytt === "object" && nytt[SENT]) {
    const s = nytt[SENT];
    if (s === "ts") return Date.now();
    const lista = Array.isArray(gammalt) ? [...gammalt] : [];
    if (s === "union") { for (const e of nytt.v) if (!lista.includes(e)) lista.push(e); return lista; }
    if (s === "remove") return lista.filter((e) => !nytt.v.includes(e));
  }
  if (nytt && typeof nytt === "object" && !Array.isArray(nytt)) {
    const ut = {};
    for (const k of Object.keys(nytt)) ut[k] = los(nytt[k], gammalt?.[k]);
    return ut;
  }
  return klon(nytt);
}

function djupMerge(mal, kalla) {
  for (const [k, v] of Object.entries(kalla)) {
    if (v && typeof v === "object" && !Array.isArray(v) && mal[k] && typeof mal[k] === "object" && !Array.isArray(mal[k])) djupMerge(mal[k], v);
    else mal[k] = v;
  }
  return mal;
}

function skrivSet(ref, data, opt) {
  const gammal = store.get(ref.path);
  const losta = los(data, opt?.merge ? gammal : undefined);
  store.set(ref.path, opt?.merge && gammal ? djupMerge(klon(gammal), losta) : losta);
}
function skrivUpdate(ref, falt) {
  const gammal = store.get(ref.path);
  if (gammal === undefined) throw Object.assign(new Error(`No document to update: ${ref.path}`), { code: "not-found" });
  const d = klon(gammal);
  for (const [nyckel, varde] of Object.entries(falt)) {
    const delar = nyckel.split(".");
    let o = d;
    for (const del of delar.slice(0, -1)) o = o[del] && typeof o[del] === "object" ? o[del] : (o[del] = {});
    const sist = delar[delar.length - 1];
    o[sist] = los(varde, o[sist]);
  }
  store.set(ref.path, d);
}
const parFalt = (a) => (typeof a[0] === "string" ? Object.fromEntries(a.reduce((acc, x, i) => (i % 2 ? acc : [...acc, [x, a[i + 1]]]), [])) : a[0]);

const skriv = (typ, ref) => { stat.writes++; stat.logg.push(`${typ} ${ref.path}`); };
export async function setDoc(ref, data, opt) { skriv("set", ref); skrivSet(ref, data, opt); }
export async function updateDoc(ref, ...a) { skriv("update", ref); skrivUpdate(ref, parFalt(a)); }
export async function deleteDoc(ref) { skriv("delete", ref); store.delete(ref.path); }

function skrivKo() {
  const ko = [];
  const api = {
    set(ref, data, opt) { ko.push(() => { skriv("set", ref); skrivSet(ref, data, opt); }); return api; },
    update(ref, ...a) { ko.push(() => { skriv("update", ref); skrivUpdate(ref, parFalt(a)); }); return api; },
    delete(ref) { ko.push(() => { skriv("delete", ref); store.delete(ref.path); }); return api; },
  };
  return { api, kor: () => ko.forEach((f) => f()) };
}

export function writeBatch() {
  const k = skrivKo();
  return { ...k.api, commit: async () => k.kor() };
}

export async function runTransaction(_db, fn) {
  const k = skrivKo();
  const tx = { ...k.api, get: (ref) => getDoc(ref) };
  for (const m of ["set", "update", "delete"]) { const f = tx[m]; tx[m] = (...a) => { f(...a); return tx; }; }
  const res = await fn(tx);
  k.kor();
  return res;
}
