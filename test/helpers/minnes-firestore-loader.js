// ============================================================================
// Loader-krok för node-tester (#807): de riktiga src-modulernas Firestore-
// anrop går till förhandsvisningarnas minnes-Firestore
// (preview/mina-klasser-stubs/fb-firestore.js → preview/larare-klasser/fb-firestore.js),
// som räknar varje läsning och skrivning. Övriga CDN-moduler (app, auth,
// functions) blir tomma stubbar som i firebase-stub-loader.js.
//   import { installeraMinnesFirestore } from "./helpers/minnes-firestore-loader.js";
//   const fs = await installeraMinnesFirestore();   // före första import() av src
//   fs.setDoc(fs.doc(fs.db, "provTillfallen/t1"), {...});
//   fs.rakna.logg  → ["las provTillfallen/t1", "skriv …", …]
// ============================================================================

import { register } from "node:module";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./firebase-stub-loader.js";

const FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const STUB = new URL("../../preview/mina-klasser-stubs/fb-firestore.js", import.meta.url).href;

let fs = null;
export async function installeraMinnesFirestore() {
  if (fs) return fs;
  // window = globalThis, så att stubben lägger window.__ppStub (räkningen) här.
  globalThis.window ??= globalThis;
  const lagring = new Map();
  globalThis.localStorage ??= {
    getItem: (k) => (lagring.has(k) ? lagring.get(k) : null),
    setItem: (k, v) => lagring.set(k, String(v)),
    removeItem: (k) => lagring.delete(k),
    clear: () => lagring.clear(),
    key: (i) => [...lagring.keys()][i] ?? null,
    get length() { return lagring.size; },
  };
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  // Registreras sist = körs först: Firestore-URL:en pekar på minnesstubben.
  const krok = `
export async function resolve(spec, ctx, next) {
  if (spec === ${JSON.stringify(FIRESTORE_URL)}) return { shortCircuit: true, url: ${JSON.stringify(STUB)} };
  return next(spec, ctx);
}`;
  register(`data:text/javascript,${encodeURIComponent(krok)}`);
  const m = await import(FIRESTORE_URL);
  fs = { ...m, db: m.getFirestore(), rakna: globalThis.__ppStub.rakna, nollstall: () => globalThis.__ppStub.nollstallRakning(), las: globalThis.__ppStub.las };
  return fs;
}
