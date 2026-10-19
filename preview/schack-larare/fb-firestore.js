// ============================================================================
// Förhandsvisnings-STUB av firebase-firestore för preview/preview-schack-larare.html
// (#781): HELA minnes-Firestore från preview/larare-klasser/fb-firestore.js (#440)
// plus en LEVANDE onSnapshot – varje skrivning till ett dokument skickar en ny
// snapshot till dess lyssnare (som i riktiga Firestore). Lokala exporter går före
// `export *`, så bara skrivningarna och onSnapshot byts ut här.
//
// window.__ppStub.lyssnare() → { "schackKlass/5e": 1, … } = öppna lyssnare per
// dokument (så att man ser att lärarsidan stänger dem när sektionen lämnas).
// ============================================================================

import * as bas from "../larare-klasser/fb-firestore.js";
import { schackSadd } from "./seed.js";

export * from "../larare-klasser/fb-firestore.js";

const lyssnare = new Map(); // path → Set<{cb, onErr}>

function meddela(path) {
  const set = lyssnare.get(path);
  if (!set?.size) return;
  for (const l of set) bas.getDoc(bas.doc(null, path)).then((s) => set.has(l) && l.cb(s));
}

export async function setDoc(ref, data, opt) {
  await bas.setDoc(ref, data, opt);
  meddela(ref.path);
}
export async function updateDoc(ref, data) {
  await bas.updateDoc(ref, data);
  meddela(ref.path);
}
export async function deleteDoc(ref) {
  await bas.deleteDoc(ref);
  meddela(ref.path);
}
export async function runTransaction(db, fn) {
  const rorda = new Set();
  const res = await bas.runTransaction(db, (tx) => {
    const omslag = {
      get: (ref) => tx.get(ref),
      set: (ref, ...a) => (rorda.add(ref.path), tx.set(ref, ...a), omslag),
      update: (ref, ...a) => (rorda.add(ref.path), tx.update(ref, ...a), omslag),
      delete: (ref) => (rorda.add(ref.path), tx.delete(ref), omslag),
    };
    return fn(omslag);
  });
  rorda.forEach(meddela);
  return res;
}
export function writeBatch(db) {
  const b = bas.writeBatch(db);
  const rorda = new Set();
  const omslag = {
    set: (ref, ...a) => (rorda.add(ref.path), b.set(ref, ...a), omslag),
    update: (ref, ...a) => (rorda.add(ref.path), b.update(ref, ...a), omslag),
    delete: (ref) => (rorda.add(ref.path), b.delete(ref), omslag),
    async commit() {
      await b.commit();
      rorda.forEach(meddela);
    },
  };
  return omslag;
}

/** Levande lyssnare på ETT dokument (frågor behövs inte i lärarvyn). */
export function onSnapshot(ref, cb, onErr) {
  const l = { cb, onErr };
  if (!lyssnare.has(ref.path)) lyssnare.set(ref.path, new Set());
  lyssnare.get(ref.path).add(l);
  bas.getDoc(ref).then((s) => lyssnare.get(ref.path)?.has(l) && cb(s));
  return () => lyssnare.get(ref.path)?.delete(l);
}

// Schackdokumenten (klass 5E: två pågående partier, tabell, datorpartier) läggs ovanpå #440-sådden.
await schackSadd({ setDoc: bas.setDoc, updateDoc: bas.updateDoc, getDoc: bas.getDoc, doc: (p) => bas.doc(null, p) });
try {
  window.__ppStub.nollstallRakning();
  window.__ppStub.lyssnare = () =>
    Object.fromEntries([...lyssnare].filter(([, s]) => s.size).map(([p, s]) => [p, s.size]));
  window.__ppStub.skriv = { setDoc, updateDoc, deleteDoc, runTransaction, doc: (p) => bas.doc(null, p), getDoc: bas.getDoc };
} catch { /* ingen window */ }
