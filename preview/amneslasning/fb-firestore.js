// ============================================================================
// Förhandsvisnings-STUB av firebase-firestore 10.12.2 (preview/preview-amneslasning.html, #672)
// ----------------------------------------------------------------------------
// Återanvänder lärarstubben (preview/larare-klasser/fb-firestore.js, sådden
// import-mappad till ./seed.js här) och lägger till det elevsidan behöver:
// onSnapshot på FRÅGOR (topbarens Mattematchen-/Live-lyssnare) och
// getDocFromServer.
// ============================================================================

import * as bas from "../larare-klasser/fb-firestore.js";

export * from "../larare-klasser/fb-firestore.js";

export function onSnapshot(ref, ...rest) {
  const cb = rest.find((x) => typeof x === "function");
  const fel = rest.filter((x) => typeof x === "function")[1];
  if (ref && ref.type === "document") return bas.onSnapshot(ref, cb);
  bas.getDocs(ref).then((s) => cb({ ...s, docChanges: () => [] }), (e) => fel && fel(e));
  return () => {};
}
export const getDocFromServer = (ref) => bas.getDoc(ref);
export const getDocsFromServer = (q) => bas.getDocs(q);
export async function addDoc(coll, data) {
  const ref = bas.doc(coll);
  await bas.setDoc(ref, data);
  return ref;
}
// Övriga SDK-namn som någon (dynamiskt laddad) elevmodul importerar.
export const documentId = () => "__name__";
export const collectionGroup = (_db, id) => bas.collection(_db, `__grupp__/${id}`);
export async function getCountFromServer(q) {
  const n = (await bas.getDocs(q)).size;
  return { data: () => ({ count: n }) };
}
export class Bytes {
  static fromUint8Array(u) { return new Bytes(u); }
  constructor(u) { this.u = u; }
  toUint8Array() { return this.u; }
}
