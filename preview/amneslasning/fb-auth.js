// ============================================================================
// Förhandsvisnings-STUB av firebase-auth 10.12.2 (preview/preview-amneslasning.html, #672)
// ----------------------------------------------------------------------------
// En ELEV (stub-alva, ingen teacher-claim) är inloggad direkt. Firestore-stubben
// är preview/larare-klasser/fb-firestore.js, med sådden import-mappad till
// preview/amneslasning/seed.js.
// ============================================================================

const elev = { uid: "stub-alva", email: "alva@elev.pluggportalen.local", getIdTokenResult: async () => ({ claims: {} }) };
const auths = new Map();

export const browserLocalPersistence = { type: "LOCAL" };
export const indexedDBLocalPersistence = { type: "LOCAL" };
export const browserSessionPersistence = { type: "SESSION" };
export function getAuth(app) {
  const namn = app?.name || "[DEFAULT]";
  if (!auths.has(namn)) auths.set(namn, { currentUser: namn === "[DEFAULT]" ? elev : null, lyssnare: new Set() });
  return auths.get(namn);
}
const meddela = (a) => a.lyssnare.forEach((cb) => setTimeout(() => cb(a.currentUser), 0));
export async function setPersistence() {}
export function onAuthStateChanged(a, cb) {
  a.lyssnare.add(cb);
  setTimeout(() => cb(a.currentUser), 0);
  return () => a.lyssnare.delete(cb);
}
export async function signInWithEmailAndPassword(a) {
  a.currentUser = elev;
  meddela(a);
  return { user: a.currentUser };
}
export async function signOut(a) {
  a.currentUser = null;
  meddela(a);
}
export async function createUserWithEmailAndPassword() {
  throw Object.assign(new Error("stub"), { code: "auth/operation-not-allowed" });
}
