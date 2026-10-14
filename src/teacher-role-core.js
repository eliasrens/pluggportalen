// ============================================================================
// Pluggporten – lärarsidan: rena roll-hjälpare (teacher-role-core.js, #679)
// ----------------------------------------------------------------------------
// Ingen DOM, ingen Firebase – testas i node (test/teacher-role.test.js).
// `role` = myRole() ur teacher-role.js: { admin, uid, name, classIds:Set|null }.
// Bara dynamiskt laddad (via teacher-role.js) – aldrig i bootgrafen (#271).
// ============================================================================

/** Bara kontots klasser (admin: alla). */
export function filterClasses(classes, role) {
  if (!role || role.admin || !role.classIds) return classes;
  return classes.filter((c) => role.classIds.has(c.id));
}

/** Elever i någon av klasserna (studentIds på klassen eller classIds på eleven). */
export function studentsInClasses(students, classes) {
  const ids = new Set(classes.flatMap((c) => (Array.isArray(c.studentIds) ? c.studentIds : [])));
  const classSet = new Set(classes.map((c) => c.id));
  return students.filter(
    (s) => ids.has(s.id) || (Array.isArray(s.classIds) && s.classIds.some((id) => classSet.has(id)))
  );
}

/**
 * Får kontot ändra/radera materialet? Admin: allt. Årskurskonto: bara där
 * createdBy är det egna uid:t. Material utan createdBy räknas som admins (§2.3).
 */
export function canEditArea(area, role) {
  if (!role || role.admin) return true;
  return !!area?.createdBy && area.createdBy === role.uid;
}

/** "Skapat av …"-texten. Saknas fälten (före #680) → admins material. */
export function createdByLabel(area) {
  const name = String(area?.createdByName || "").trim();
  if (name) return name;
  return area?.createdBy ? "en annan lärare" : "Admin";
}

// --- Live (#678): samma gränser som firestore.rules gradeLiveClassesOk ---------

/** Sessionen har minst en av kontots klasser (admin: alla). Styr listor/historik. */
export function canSeeLiveSession(session, role) {
  if (!role || role.admin || !role.classIds) return true;
  const ids = Array.isArray(session?.participatingClassIds) ? session.participatingClassIds : [];
  return ids.some((id) => role.classIds.has(id));
}

/**
 * Klasserna att välja bland när kontot skapar en match. Klassmatchen: alla
 * (motståndaren får vara vilken klass som helst – minst en egen krävs av
 * reglerna). Övriga format: bara kontots klasser.
 */
export function liveClassChoices(classes, formatId, role) {
  if (!role || role.admin || formatId === "klassmatch") return classes;
  return filterClasses(classes, role);
}

/** Inställningar bara admin får sätta (mynt-pris till klasskassan). */
export const ADMIN_ONLY_LIVE_FIELDS = ["coinPrize"];
export function liveFieldsFor(fields, role) {
  if (!role || role.admin) return fields;
  return fields.filter((f) => !ADMIN_ONLY_LIVE_FIELDS.includes(f.key));
}
