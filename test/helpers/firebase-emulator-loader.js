// ============================================================================
// Loader-krok för node-tester (#831): kör KLIENTENS riktiga datakod (src/data.js
// m.fl.) mot Auth-/Firestore-emulatorn. CDN-adresserna till webb-SDK:t
// (https://www.gstatic.com/firebasejs/…/firebase-{app,auth,firestore}.js) pekas
// om till test/helpers/fb-emu/, som re-exporterar npm-paketet `firebase` och
// kopplar varje Auth-/Firestore-instans till emulatorn
// (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST).
//   import { installeraFirebaseEmulator } from "./helpers/firebase-emulator-loader.js";
//   installeraFirebaseEmulator();  // före första dynamiska import() av src-moduler
// Jämför firebase-stub-loader.js, som i stället gör SDK:t till en tom stubbe.
// ============================================================================

import { register } from "node:module";

let installerad = false;
export function installeraFirebaseEmulator() {
  if (installerad) return;
  installerad = true;
  const bas = new URL("./fb-emu/", import.meta.url).href;
  const krok = `
const BAS = ${JSON.stringify(bas)};
export async function resolve(spec, ctx, next) {
  const m = /^https:\\/\\/www\\.gstatic\\.com\\/firebasejs\\/[^/]+\\/firebase-(app|auth|firestore)\\.js$/.exec(spec);
  if (m) return { shortCircuit: true, url: BAS + m[1] + ".js" };
  return next(spec, ctx);
}`;
  register(`data:text/javascript,${encodeURIComponent(krok)}`);
  // auth.js speglar sessionen i webblagringen – en enkel minneslagring räcker.
  for (const g of ["localStorage", "sessionStorage"]) {
    if (!(g in globalThis)) {
      const m = new Map();
      globalThis[g] = {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
        clear: () => m.clear(),
      };
    }
  }
}
