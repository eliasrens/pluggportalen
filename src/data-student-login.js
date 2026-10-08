// ============================================================================
// Pluggporten – elevers inloggning från lärarsidan (data-student-login.js)
// ----------------------------------------------------------------------------
// BARA dynamiskt importerad (från lärarens "Redigera inloggning" och
// inloggningskorten) – drar in Functions-SDK:t, som aldrig ska ligga i den
// statiska bootgrafen (#271).
//
//   updateStudentLogin({ uid, username?, password? })
//       → Cloud Functionen med samma namn (functions/index.js, europe-west1).
//         Byter Auth-e-post/lösenord, students.username, klassprojektionerna
//         och studentCredentials på servern.
//   getStudentCredentials(ids) → Map uid → { username, password|null }
//       ur studentCredentials/{uid} (bara lärare får läsa, se firestore.rules).
//
// QA mot emulatorn: admin/qa-emulator-proxy.mjs sätter
// globalThis.__PP_FUNCTIONS_URL så anropet går via samma origin.
// ============================================================================

import { app, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

export const FUNCTIONS_REGION = "europe-west1";

let _call = null;
function callable() {
  if (!_call) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || FUNCTIONS_REGION);
    _call = httpsCallable(fns, "updateStudentLogin", { timeout: 30_000 });
  }
  return _call;
}

/**
 * Gör ett läsbart svenskt felmeddelande av ett callable-fel. Funktionens egna
 * fel bär ett svenskt meddelande; SDK:ts egna (saknad funktion = 404/CORS,
 * nätverk) har bara koden som text ("not-found", "internal").
 */
export function loginErrorMessage(err) {
  const code = String(err?.code || "").replace(/^functions\//, "");
  const msg = String(err?.message || "");
  if (code === "unauthenticated") return "Du är utloggad – logga in som lärare igen.";
  if (code === "deadline-exceeded") return "Tjänsten svarade inte i tid – försök igen.";
  if (!msg || msg.toLowerCase().replace(/[\s_]/g, "-") === code || code === "unavailable") {
    return "Kunde inte nå inloggningstjänsten (Cloud Functions). Försök igen senare – inget ändrades.";
  }
  return msg;
}

/**
 * Byt en elevs användarnamn och/eller lösenord via Cloud Functionen.
 * Kastar Error med ett svenskt meddelande (loginErrorMessage) vid fel.
 * @returns {Promise<{uid, username, usernameChanged:boolean, passwordChanged:boolean}>}
 */
export async function updateStudentLogin({ uid, username, password }) {
  const payload = { uid };
  if (username) payload.username = String(username).trim().toLowerCase();
  if (password) payload.password = String(password);
  try {
    const res = await callable()(payload);
    return res.data;
  } catch (err) {
    const e = new Error(loginErrorMessage(err));
    e.code = err?.code;
    throw e;
  }
}

/**
 * Sparade inloggningsuppgifter för elever (bara lärare). Saknat/nekat dokument
 * ger `password: null` ("Lösenord okänt") i stället för ett fel.
 * @param {string[]} ids
 * @returns {Promise<Map<string, {username:string, password:string|null}>>}
 */
export async function getStudentCredentials(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const rows = await Promise.all(
    uniq.map((id) =>
      getDoc(doc(db, "studentCredentials", id))
        .then((s) => (s.exists() ? s.data() : null))
        .catch(() => null)
    )
  );
  const out = new Map();
  uniq.forEach((id, i) => {
    const d = rows[i];
    out.set(id, {
      username: d?.username || "",
      password: typeof d?.password === "string" && d.password ? d.password : null,
    });
  });
  return out;
}
