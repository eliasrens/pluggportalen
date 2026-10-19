// Förhandsvisnings-STUB (#806): minnes-Firestore ur preview/larare-klasser/ + det Hitta rätt!-fliken
// importerar utöver det (Bytes för bilder).
export * from "../larare-klasser/fb-firestore.js";
export class Bytes {
  constructor(a) { this.a = a; }
  static fromUint8Array(a) { return new Bytes(a); }
  toUint8Array() { return this.a; }
}
