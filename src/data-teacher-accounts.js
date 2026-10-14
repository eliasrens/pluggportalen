// ============================================================================
// Pluggporten – lärarkonton från adminsidan (data-teacher-accounts.js, #677)
// ----------------------------------------------------------------------------
// BARA dynamiskt importerad (från src/teacher-accounts.js) – drar in
// Functions-SDK:t, som aldrig ska ligga i den statiska bootgrafen (#271).
//
//   listTeacherAccounts()  teacherAccounts/* (bara admin får läsa listan)
//   createTeacher / updateTeacher / setTeacherPassword / setTeacherActive /
//   deleteTeacher          Cloud Functions adminCreateTeacher … (europe-west1),
//                          se functions/teacher-accounts-core.js
//   refreshClaims()        förnya ID-token så en nyss migrerad admin-claim gäller
//
// Fel blir ett svenskt meddelande ("Det här kan bara admin göra.") i stället
// för ett tekniskt fel. QA mot emulatorn: globalThis.__PP_FUNCTIONS_URL.
// ============================================================================

import { app, auth, db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const REGION = "europe-west1";
let _fns = null;
const fns = () => (_fns ||= getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION));

/** Ett svenskt felmeddelande av ett callable-/Firestore-fel. */
export function accountErrorMessage(err) {
  const code = String(err?.code || "").replace(/^functions\//, "");
  const msg = String(err?.message || "");
  if (code === "unauthenticated") return "Du är utloggad – logga in som lärare igen.";
  if (code === "deadline-exceeded") return "Tjänsten svarade inte i tid – försök igen.";
  if (!msg || msg.toLowerCase().replace(/[\s_]/g, "-") === code || code === "unavailable") {
    return "Kunde inte nå kontotjänsten (Cloud Functions). Försök igen senare – inget ändrades.";
  }
  return msg;
}

async function call(name, data) {
  try {
    const res = await httpsCallable(fns(), name, { timeout: 30_000 })(data);
    return res.data;
  } catch (err) {
    const e = new Error(accountErrorMessage(err));
    e.code = err?.code;
    throw e;
  }
}

/** Alla lärarkonton, admin först och sedan på visningsnamn. */
export async function listTeacherAccounts() {
  try {
    const snap = await getDocs(collection(db, "teacherAccounts"));
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) ||
        String(a.displayName || "").localeCompare(String(b.displayName || ""), "sv", { numeric: true }));
  } catch (err) {
    // Firestore-felen är på engelska – reglerna nekar alla utom admin.
    throw new Error(err?.code === "permission-denied" ? "Det här kan bara admin göra." : accountErrorMessage(err));
  }
}

/** Förnya ID-token (nya claims efter migreringen gäller direkt). */
export async function refreshClaims() {
  const u = auth.currentUser;
  if (!u) return {};
  return (await u.getIdTokenResult(true)).claims;
}

export const createTeacher = (d) => call("adminCreateTeacher", d);
export const updateTeacher = (d) => call("adminUpdateTeacher", d);
export const setTeacherPassword = (uid, password) => call("adminSetTeacherPassword", { uid, password });
export const setTeacherActive = (uid, active) => call("adminSetTeacherActive", { uid, active });
export const deleteTeacher = (uid) => call("adminDeleteTeacher", { uid });
