// Preview-stub (#420) för firebase-firestore: allt är tomt, varje getDoc/getDocs
// räknas som en läsning (preview/pixi-by/lasningar.js). Data-lagret som
// husvärlden faktiskt använder är stubbat i preview/pixi-by/data.js.
import { las } from "./lasningar.js";
const snap = (id) => ({ id, exists: () => false, data: () => undefined, get: () => undefined });
const qsnap = { docs: [], empty: true, size: 0, forEach() {} };
export const getFirestore = () => ({});
export const doc = (...p) => ({ id: String(p[p.length - 1] ?? ""), path: p.slice(1).join("/") });
export const collection = (...p) => ({ path: p.slice(1).join("/") });
export const query = (c) => c;
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});
export const documentId = () => "__name__";
export const getDoc = async (d) => { las("firestore.getDoc"); return snap(d?.id); };
export const getDocs = async () => { las("firestore.getDocs"); return qsnap; };
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const serverTimestamp = () => new Date();
export const arrayUnion = (...v) => v;
export const arrayRemove = (...v) => v;
export const increment = (n) => n;
export const deleteField = () => undefined;
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const runTransaction = async (_db, fn) =>
  fn({ get: async (d) => { las("firestore.tx.get"); return snap(d?.id); }, set() {}, update() {}, delete() {} });
