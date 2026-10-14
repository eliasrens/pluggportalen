// ============================================================================
// Pluggporten – lärarsidan: synlighet efter roll (teacher-role.js, #679)
// ----------------------------------------------------------------------------
// Admin ser allt. Ett årskurskonto (claims teacher + role:"arskurs", #677) ser
// bara sina klasser och sitt eget material som ändringsbart. Det här är BARA
// gränssnittet – behörigheten avgörs av firestore.rules / Cloud Functions (#678).
//
// Kontots klasser och visningsnamn läses ur teacherAccounts/{uid} (kontot får
// läsa sitt eget dokument). Kort cache (20 s) så en klassändring från admin slår
// igenom vid nästa sidbyte utan utloggning (test 21).
//
// BARA dynamiskt importerad (teacherNav + lärarsidornas moduler) – aldrig i den
// statiska bootgrafen (#271).
// ============================================================================

import { auth, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { isAdmin } from "./auth.js";

const TTL_MS = 20_000;
let cache = null; // { uid, at, promise }

/** Det egna teacherAccounts-dokumentet (eller null om det saknas / inte går att läsa). */
export function loadMyAccount() {
  const uid = auth.currentUser?.uid || "";
  if (!cache || cache.uid !== uid || Date.now() - cache.at > TTL_MS) {
    const promise = uid
      ? getDoc(doc(db, "teacherAccounts", uid)).then((s) => (s.exists() ? s.data() : null), () => null)
      : Promise.resolve(null);
    cache = { uid, at: Date.now(), promise };
  }
  return cache.promise;
}

/**
 * Rollen som lärarsidan ritar efter.
 * @returns {Promise<{admin:boolean, uid:string, name:string, classIds:Set<string>|null}>}
 *   classIds = null för admin (alla klasser).
 */
export async function myRole() {
  const admin = isAdmin();
  const acc = await loadMyAccount();
  const name = String(acc?.displayName || "").trim() || (admin ? "Admin" : "Årskurskonto");
  const classIds = admin ? null : new Set(acc && acc.active !== false && Array.isArray(acc.classIds) ? acc.classIds : []);
  return { admin, uid: auth.currentUser?.uid || "", name, classIds };
}

// Rena hjälpare (filtrera klasser/elever, ägarskap) bor i teacher-role-core.js
// så de kan testas i node; de re-exporteras här.
export {
  canEditArea, createdByLabel, duplicateValue, filterClasses, studentsInClasses, withOwner,
} from "./teacher-role-core.js";
