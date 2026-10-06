// Fejk-firebase-auth för preview-pixi-gard.html (#423): elev1 är alltid inloggad.
import { SEED_UID } from "./seed.js";
const user = { uid: SEED_UID, getIdTokenResult: async () => ({ claims: {} }) };
export const getAuth = () => ({ currentUser: user });
export const onAuthStateChanged = (auth, cb) => { queueMicrotask(() => cb(user)); return () => {}; };
export const setPersistence = async () => {};
export const browserLocalPersistence = "local";
export const browserSessionPersistence = "session";
export const signInWithEmailAndPassword = async () => ({ user });
export const createUserWithEmailAndPassword = async () => ({ user });
export const signOut = async () => {};
