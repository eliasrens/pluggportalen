// ============================================================================
// Firestore-SDK:t (npm "firebase/firestore") mot EMULATORN, för src-moduler som
// importerar CDN-URL:en (#807). Laddas av emulator-firestore-loader.js i stället
// för https://www.gstatic.com/firebasejs/…/firebase-firestore.js:
//   * getFirestore(app) kopplar till FIRESTORE_EMULATOR_HOST med en mockUserToken
//     (globalThis.__ppEmuToken – t.ex. ett årskurskontos claims), så att de
//     RIKTIGA reglerna gäller
//   * getDoc/getDocs/onSnapshot räknas: globalThis.__ppEmuLas = ["doc väg", "fråga väg (n dok)", …]
//     (en fråga kostar en läsning per träff, minst en – som Firestores debitering)
// ============================================================================

import * as fs from "firebase/firestore";

export * from "firebase/firestore";

const logg = (globalThis.__ppEmuLas ||= []);
const vag = (r) => r?.path || r?._query?.path?.canonicalString?.() || r?._path?.canonicalString?.() || "fråga";
let kopplad = null;

export function getFirestore(app) {
  const db = fs.getFirestore(app);
  if (!kopplad) {
    const [host, port] = String(process.env.FIRESTORE_EMULATOR_HOST).split(":");
    fs.connectFirestoreEmulator(db, host, Number(port), { mockUserToken: globalThis.__ppEmuToken });
    kopplad = db;
  }
  return db;
}
export async function getDoc(ref) {
  logg.push(`doc ${vag(ref)}`);
  return fs.getDoc(ref);
}
export async function getDocs(q) {
  const s = await fs.getDocs(q);
  logg.push(`fråga ${vag(q)} (${s.size} dok)`);
  return s;
}
export function onSnapshot(ref, ...rest) {
  logg.push(`lyssnare ${vag(ref)}`);
  return fs.onSnapshot(ref, ...rest);
}

// --- Loader-kroken ------------------------------------------------------------
// installeraEmulatorFirestore(token) – före första import() av src-moduler:
// firestore- och app-URL:erna går till npm-SDK:t, resten (auth, functions) blir
// tomma stubbar (firebase-stub-loader.js).
export async function installeraEmulatorFirestore(token) {
  globalThis.__ppEmuToken = token;
  // @firebase/util läser "standardvärden" ur window/document – webbstubbens proxy
  // skulle ge en tom emulatorvärd. window = globalThis med tomma standardvärden.
  globalThis.window ??= globalThis;
  globalThis.__FIREBASE_DEFAULTS__ ??= { emulatorHosts: {} };
  const { register } = await import("node:module");
  const { installeraFirebaseStubbe, installeraWebbStubbe } = await import("./firebase-stub-loader.js");
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  const har = import.meta.url;
  const krok = `
const MAL = {
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js": ${JSON.stringify(har)},
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js": "firebase/app",
};
export async function resolve(spec, ctx, next) {
  const m = MAL[spec];
  if (!m) return next(spec, ctx);
  return m.startsWith("file:") ? { shortCircuit: true, url: m } : next(m, { ...ctx, parentURL: ${JSON.stringify(har)} });
}`;
  register(`data:text/javascript,${encodeURIComponent(krok)}`);
}
