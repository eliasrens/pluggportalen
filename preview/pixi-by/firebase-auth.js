// Preview-stub (#420) för firebase-auth – ingen inloggning, ingen nätverkstrafik.
const auth = { currentUser: null };
export const getAuth = () => auth;
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};
export const setPersistence = async () => {};
export const onAuthStateChanged = () => () => {};
export const signInWithEmailAndPassword = async () => { throw new Error("preview"); };
export const createUserWithEmailAndPassword = async () => { throw new Error("preview"); };
export const signOut = async () => {};
