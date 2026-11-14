// ============================================================================
// Pluggporten – köp i butiken via servern (src/butik-kop.js, #854, epic #851)
// ----------------------------------------------------------------------------
// Laddas bara DYNAMISKT (pages-shop.js och data-mystery.js vid ett köp), aldrig i
// bootgrafen – så Firebase Functions-SDK:t laddas först när eleven handlar.
//
//   kop(itemId) → svaret från callablen butikKop (functions/butik-kop.js):
//     { ok, coins, owned?, counts?, pets?, animals?, farm?, appleCount?,
//       item?, duplicate?, refund?, error? }
// Klienten skickar bara varans id: priset tas ur katalogen och mysterylådan
// lottas på servern (src/butik-core.js). Ett nätfel/serverfel kastas (pages-shop
// visar "Något gick fel vid köpet"); ok:false = inget köp (för få mynt m.m.).
// ============================================================================

import { app } from "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { currentStudentId, invalidateStudentData } from "./data.js";

const REGION = "europe-west1";

let kopCall = null;
function kopFn() {
  if (!kopCall) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION);
    kopCall = httpsCallable(fns, "butikKop", { timeout: 20_000 });
  }
  return kopCall;
}

/** Köp en vara (id ur shop-katalogen). Saldo och varor ändras på servern. */
export async function kop(itemId) {
  const res = (await kopFn()({ itemId })).data;
  if (res?.ok) invalidateStudentData(currentStudentId()); // saldo/varor ändrade (#274)
  return res;
}
