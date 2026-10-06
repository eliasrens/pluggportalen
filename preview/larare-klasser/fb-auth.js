// ============================================================================
// Förhandsvisnings-STUB av firebase-auth 10.12.2 (preview-larare-klasser.html, #440)
// ----------------------------------------------------------------------------
// En LÄRARE (claim teacher:true) är inloggad direkt. Varje Firebase-app får sin
// egen auth – kontoskapandet (createStudentAuthAccount) kör på en sekundär app
// och dess signOut får inte logga ut läraren. Nya elevkonton får uid
// "stub-<användarnamn>"; upptaget namn → auth/email-already-in-use.
// ============================================================================

const anv = (uid, teacher) => ({
  uid,
  email: `${uid}@larare.pluggportalen.local`,
  getIdTokenResult: async () => ({ claims: teacher ? { teacher: true } : {} }),
});
const auths = new Map();
const tagna = new Set();

export const browserLocalPersistence = { type: "LOCAL" };
export const browserSessionPersistence = { type: "SESSION" };
export function getAuth(app) {
  const namn = app?.name || "[DEFAULT]";
  if (!auths.has(namn)) {
    auths.set(namn, { currentUser: namn === "[DEFAULT]" ? anv("stub-larare", true) : null, lyssnare: new Set() });
  }
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
  a.currentUser = anv("stub-larare", true);
  meddela(a);
  return { user: a.currentUser };
}
export async function createUserWithEmailAndPassword(a, email) {
  await new Promise((r) => setTimeout(r, 120));
  const namn = String(email).split("@")[0];
  if (tagna.has(namn)) throw Object.assign(new Error("taken"), { code: "auth/email-already-in-use" });
  tagna.add(namn);
  a.currentUser = anv(`stub-${namn}`, false);
  return { user: a.currentUser };
}
export async function signOut(a) {
  a.currentUser = null;
  meddela(a);
}
