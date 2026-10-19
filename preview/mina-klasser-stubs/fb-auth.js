// ============================================================================
// Förhandsvisnings-STUB av firebase-auth 10.12.2 för preview/preview-mina-klasser.html
// (#804). Som preview/larare-klasser/fb-auth.js, men ROLLEN väljs i adressen:
//   ?roll=arskurs → årskurslärare (claims teacher + role "arskurs", 4A + 4B)
//   annars        → admin (claims teacher + admin)
// Kontot (teacherAccounts/<uid>) sås i mina-klasser-stubs/seed.js.
// ============================================================================

const ARSKURS = new URLSearchParams(location.search).get("roll") === "arskurs";
export const STUB_UID = ARSKURS ? "stub-arskurs" : "stub-admin";
const claims = ARSKURS ? { teacher: true, role: "arskurs" } : { teacher: true, admin: true, role: "admin" };
const anv = (uid, larare) => ({
  uid,
  email: `${uid}@larare.pluggportalen.local`,
  getIdTokenResult: async () => ({ claims: larare ? claims : {} }),
});
const auths = new Map();

export const browserLocalPersistence = { type: "LOCAL" };
export const indexedDBLocalPersistence = { type: "LOCAL" };
export const browserSessionPersistence = { type: "SESSION" };
export function getAuth(app) {
  const namn = app?.name || "[DEFAULT]";
  if (!auths.has(namn)) auths.set(namn, { currentUser: namn === "[DEFAULT]" ? anv(STUB_UID, true) : null, lyssnare: new Set() });
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
  a.currentUser = anv(STUB_UID, true);
  meddela(a);
  return { user: a.currentUser };
}
export async function createUserWithEmailAndPassword(a, email) {
  a.currentUser = anv(`stub-${String(email).split("@")[0]}`, false);
  return { user: a.currentUser };
}
export async function signOut(a) {
  a.currentUser = null;
  meddela(a);
}
