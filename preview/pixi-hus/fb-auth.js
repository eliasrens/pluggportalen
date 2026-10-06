// ============================================================================
// Förhandsvisnings-STUB av firebase-auth 10.12.2 (preview-pixi-hus.html, #419)
// ----------------------------------------------------------------------------
// Stub-eleven (seed.js, ME_ID) är inloggad direkt. Inloggning med valfritt
// lösenord loggar in samma elev; utloggning fungerar som vanligt.
// ============================================================================

import { ME_ID } from "./seed.js";

const lyssnare = new Set();
const anv = (uid) => ({ uid, email: `${uid}@elev.pluggportalen.local`, getIdTokenResult: async () => ({ claims: {} }) });
const auth = { currentUser: anv(ME_ID) };
const meddela = () => lyssnare.forEach((cb) => setTimeout(() => cb(auth.currentUser), 0));

export const browserLocalPersistence = { type: "LOCAL" };
export const browserSessionPersistence = { type: "SESSION" };
export const getAuth = () => auth;
export async function setPersistence() {}
export function onAuthStateChanged(_a, cb) {
  lyssnare.add(cb);
  setTimeout(() => cb(auth.currentUser), 0);
  return () => lyssnare.delete(cb);
}
export async function signInWithEmailAndPassword() {
  auth.currentUser = anv(ME_ID);
  meddela();
  return { user: auth.currentUser };
}
export async function createUserWithEmailAndPassword() {
  throw Object.assign(new Error("stub"), { code: "auth/operation-not-allowed" });
}
export async function signOut() {
  auth.currentUser = null;
  meddela();
}
