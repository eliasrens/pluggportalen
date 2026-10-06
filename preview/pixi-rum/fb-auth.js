// Preview-stub för firebase-auth.js (#422): eleven `elev1` är inloggad direkt.
// Utloggning/inloggning fungerar i minnet (vilket lösen som helst).
const lyssnare = new Set();
const anvandare = (uid) => ({ uid, email: `${uid}@elev.pluggportalen.local`, getIdTokenResult: async () => ({ claims: {} }) });
const auth = { currentUser: anvandare("elev1") };
const meddela = () => setTimeout(() => lyssnare.forEach((cb) => cb(auth.currentUser)), 0);

export const browserLocalPersistence = "local";
export const browserSessionPersistence = "session";
export function getAuth() { return auth; }
export async function setPersistence() {}
export function onAuthStateChanged(_a, cb) {
  lyssnare.add(cb);
  setTimeout(() => cb(auth.currentUser), 0);
  return () => lyssnare.delete(cb);
}
export async function signInWithEmailAndPassword(_a, email) {
  auth.currentUser = anvandare(String(email).split("@")[0]);
  meddela();
  return { user: auth.currentUser };
}
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export async function signOut() {
  auth.currentUser = null;
  meddela();
}
