// Förhandsvisnings-STUB av firebase-firestore för preview/preview-mina-klasser.html (#804):
// minnes-Firestore ur preview/larare-klasser/fb-firestore.js (importmappen byter dess
// seed.js mot mina-klasser-stubs/seed.js) + de namn Prov/Hitta rätt importerar.
export * from "../larare-klasser/fb-firestore.js";
/** Collection group-frågor (Prov-statistiken) – inga dokument i previewn. */
export const collectionGroup = (_db, id) => ({ type: "collection", path: `__grupp/${id}`, id, villkor: [] });
export class Bytes {
  static fromUint8Array(u) { return Object.assign(new Bytes(), { u }); }
  toUint8Array() { return this.u || new Uint8Array(); }
}

// Resten av namnen som src/ importerar (Klasscentret, Bråkresan, Hitta rätt! …).
import { doc as _doc, getDoc as _getDoc, getDocs as _getDocs, setDoc as _setDoc } from "../larare-klasser/fb-firestore.js";
export const getDocFromServer = (ref) => _getDoc(ref);
export async function addDoc(coll, data) {
  const ref = _doc(coll);
  await _setDoc(ref, data);
  return ref;
}
export class FieldPath { constructor(...f) { this.f = f.join("."); } toString() { return this.f; } }
export const documentId = () => "__name__";
export async function getCountFromServer(q) {
  const s = await _getDocs(q);
  return { data: () => ({ count: s.size }) };
}
import { onSnapshot as _onSnapshot } from "../larare-klasser/fb-firestore.js";
/** onSnapshot även på frågor (Live-listan): ett engångssvar ur getDocs. */
export function onSnapshot(ref, cb, onErr) {
  if (ref?.type !== "collection") return _onSnapshot(ref, cb);
  _getDocs(ref).then(cb, (e) => onErr?.(e));
  return () => {};
}
