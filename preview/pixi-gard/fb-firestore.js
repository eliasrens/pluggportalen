// Fejk-Firestore i minnet för preview-pixi-gard.html (#423). Ersätter
// gstatic-modulen via importmap: appens RIKTIGA data-moduler körs, men mot
// ett seedat minne – inga läsningar/skrivningar når Firebase (elev1 orörd).
// window.__ppFejkDb: { las, skriv, logg } för klick-testet.
import { seed } from "./seed.js";

const lager = new Map(Object.entries(seed())); // "coll/id" → data
const logg = [];
const klona = (v) => (v === undefined ? undefined : structuredClone(v));

const SENT = Symbol("sentinel");
export const serverTimestamp = () => ({ [SENT]: "ts" });
export const arrayUnion = (...v) => ({ [SENT]: "union", v });
export const arrayRemove = (...v) => ({ [SENT]: "remove", v });
export const increment = (n) => ({ [SENT]: "inc", n });
export const deleteField = () => ({ [SENT]: "del" });

export const getFirestore = () => ({ fejk: true });
export const doc = (db, ...seg) => ({ typ: "doc", path: seg.join("/"), id: seg[seg.length - 1] });
export const collection = (db, ...seg) => ({ typ: "coll", path: seg.join("/") });
export const where = (falt, op, varde) => ({ falt, op, varde });
export const orderBy = () => null;
export const query = (c, ...villkor) => ({ ...c, villkor: villkor.filter(Boolean) });

function tillampa(gammal, v) {
  if (v && typeof v === "object" && v[SENT]) {
    const s = v[SENT];
    if (s === "ts") return Date.now();
    if (s === "inc") return (Number(gammal) || 0) + v.n;
    if (s === "union") return [...new Set([...(Array.isArray(gammal) ? gammal : []), ...v.v])];
    if (s === "remove") return (Array.isArray(gammal) ? gammal : []).filter((x) => !v.v.includes(x));
    if (s === "del") return undefined;
  }
  return klona(v);
}
function sattPunkt(obj, punkt, v) {
  const delar = punkt.split(".");
  let o = obj;
  for (const d of delar.slice(0, -1)) o = o[d] && typeof o[d] === "object" ? o[d] : (o[d] = {});
  const sista = delar[delar.length - 1];
  const ny = tillampa(o[sista], v);
  if (ny === undefined) delete o[sista]; else o[sista] = ny;
}
// set({merge:true}): nästlade objekt slås ihop, allt annat ersätts (som Firestore).
function sammanfoga(mal, data) {
  for (const [k, v] of Object.entries(data)) {
    const objekt = v && typeof v === "object" && !Array.isArray(v) && !v[SENT];
    if (objekt && mal[k] && typeof mal[k] === "object" && !Array.isArray(mal[k])) sammanfoga(mal[k], v);
    else { const t = tillampa(mal[k], v); if (t === undefined) delete mal[k]; else mal[k] = t; }
  }
}
const snap = (ref) => {
  const d = lager.get(ref.path);
  return { id: ref.id, ref, exists: () => d !== undefined, data: () => klona(d) };
};
function skriv(typ, ref, data, opt) {
  logg.push({ typ, path: ref.path, t: Math.round(performance.now()) });
  if (typ === "set") {
    if (opt?.merge && lager.has(ref.path)) sammanfoga(lager.get(ref.path), data);
    else { const ny = {}; for (const [k, v] of Object.entries(data)) { const t = tillampa(undefined, v); if (t !== undefined) ny[k] = t; } lager.set(ref.path, ny); }
  } else if (typ === "update") {
    if (!lager.has(ref.path)) throw Object.assign(new Error("not-found"), { code: "not-found" });
    const d = lager.get(ref.path);
    for (const [k, v] of Object.entries(data)) sattPunkt(d, k, v);
  } else if (typ === "delete") lager.delete(ref.path);
}

export async function getDoc(ref) { logg.push({ typ: "get", path: ref.path }); return snap(ref); }
export async function setDoc(ref, data, opt) { skriv("set", ref, data, opt); }
export async function updateDoc(ref, data) { skriv("update", ref, data); }
export async function deleteDoc(ref) { skriv("delete", ref); }
export async function getDocs(q) {
  logg.push({ typ: "list", path: q.path });
  const pre = q.path + "/";
  const docs = [...lager.keys()]
    .filter((p) => p.startsWith(pre) && !p.slice(pre.length).includes("/"))
    .map((p) => snap({ path: p, id: p.slice(pre.length) }))
    .filter((s) => (q.villkor || []).every(({ falt, op, varde }) => {
      const v = s.data()?.[falt];
      if (op === "==") return v === varde;
      if (op === "array-contains") return Array.isArray(v) && v.includes(varde);
      if (op === "in") return varde.includes(v);
      return true;
    }));
  return { docs, empty: !docs.length, size: docs.length, forEach: (f) => docs.forEach(f) };
}
export async function runTransaction(db, fn) {
  const tx = {
    get: async (ref) => snap(ref),
    set: (ref, data, opt) => (skriv("set", ref, data, opt), tx),
    update: (ref, data) => (skriv("update", ref, data), tx),
    delete: (ref) => (skriv("delete", ref), tx),
  };
  return fn(tx);
}
export function writeBatch() {
  const ops = [];
  const b = {
    set: (ref, data, opt) => (ops.push(["set", ref, data, opt]), b),
    update: (ref, data) => (ops.push(["update", ref, data]), b),
    delete: (ref) => (ops.push(["delete", ref]), b),
    commit: async () => ops.forEach(([t, r, d, o]) => skriv(t, r, d, o)),
  };
  return b;
}
export const onSnapshot = (ref, cb) => { getDoc(ref).then(cb); return () => {}; };

window.__ppFejkDb = { las: (p) => klona(lager.get(p)), skriv: (p, d) => lager.set(p, klona(d)), logg };
