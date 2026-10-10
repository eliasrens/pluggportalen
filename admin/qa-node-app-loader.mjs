// ============================================================================
// QA (#561): kör APPENS EGNA moduler (src/**) i node mot EMULATORN, som en
// riktig klient (reglerna gäller). Registreras med `node --import`:
//   • https://www.gstatic.com/firebasejs/<v>/firebase-<x>.js → npm firebase/<x>
//   • src/firebase-config.js → admin/qa-node-firebase-config.mjs (emulator +
//     inloggning som QA_UID, lösen lilla123 – endast emulator)
//
//   QA_UID=rasmus QA_ROLL=larare FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… \
//   node --import ./admin/qa-node-app-loader.mjs admin/qa-snilleblixt-slut-kontroll.mjs …
// ============================================================================
import { register } from "node:module";

register("data:text/javascript," + encodeURIComponent(`
const SHIM = ${JSON.stringify(new URL("./qa-node-firebase-config.mjs", import.meta.url).href)};
export async function resolve(spec, ctx, next) {
  const m = /^https:\\/\\/www\\.gstatic\\.com\\/firebasejs\\/[^/]+\\/firebase-([a-z]+)\\.js$/.exec(spec);
  if (m) return next("firebase/" + m[1], ctx);
  const r = await next(spec, ctx);
  if (r.url.endsWith("/src/firebase-config.js")) return { url: SHIM, shortCircuit: true };
  return r;
}
`), import.meta.url);
