// ============================================================================
// Pluggporten – lärarens roll i en callable (functions/teacher-role.js, #678)
// ----------------------------------------------------------------------------
// Samma rollmodell som firestore.rules (isAdmin/isGradeTeacher), spec
// docs/UTVECKLINGSUPPDRAG_LARARKONTON.md §1 och §4.2:
//   admin    claims { teacher, admin: true }
//   arskurs  claims { teacher, role: "arskurs" } + AKTIVT teacherAccounts-
//            dokument med role "arskurs" – klasserna läses färskt därifrån
//   ÖVERGÅNG claims { teacher } utan role och admin = admin. Tas bort
//            tillsammans med isLegacyTeacher() i firestore.rules.
// Inga importer (Firestore injiceras) – testas direkt mot emulatorn.
// ============================================================================

/** Rollen enligt claims: "admin" | "arskurs" | null (ingen lärarbehörighet). */
export function claimRole(token) {
  if (!token || token.teacher !== true) return null;
  if (token.admin === true) return "admin";
  if (token.role === "arskurs") return "arskurs";
  // ⚠️ ÖVERGÅNG (§6.2) – ta bort när migreringen är verifierad.
  if (!("role" in token) && !("admin" in token)) return "admin";
  return null;
}

/**
 * Anroparens roll med årskurskontots klasser.
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid:string, token:object}|undefined} auth request.auth
 * @returns {Promise<{role:"admin"}|{role:"arskurs", classIds:string[]}|null>}
 *   null = ingen lärarbehörighet (även avstängt eller saknat konto).
 */
export async function callerRole(db, auth) {
  const role = claimRole(auth?.token);
  if (role !== "arskurs") return role ? { role } : null;
  const snap = await db.collection("teacherAccounts").doc(auth.uid).get();
  const d = snap.exists ? snap.data() : null;
  if (!d || d.active !== true || d.role !== "arskurs") return null;
  return { role, classIds: Array.isArray(d.classIds) ? d.classIds : [] };
}
