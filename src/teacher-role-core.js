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

/**
 * Ägarfälten för ett område som sparas (#680, §2.3). saveArea skriver HELA
 * dokumentet, så ägaren följer med därifrån det redan finns: ett befintligt
 * område behåller sin createdBy/createdByName (eller saknar dem = admins), ett
 * nytt stämplas med det sparande kontot. Fälten i `area` själv litas inte på.
 * @param {object} area      det som ska sparas
 * @param {object|null} existing dokumentet som finns nu (null = nytt område)
 * @param {{uid:string, name:string}} role
 */
export function withOwner(area, existing, role) {
  const { createdBy, createdByName, ...rest } = area;
  const src = existing || { createdBy: role.uid, createdByName: role.name };
  if (src.createdBy) rest.createdBy = src.createdBy;
  if (src.createdBy && src.createdByName) rest.createdByName = src.createdByName;
  return rest;
}

/**
 * Kopian vid Duplicera (#680): allt innehåll följer med, titeln får "(kopia)",
 * ett ledigt id ("<id>-kopia", "-kopia-2" …) och sist i ordningen. Ägaren
 * stämplas av saveArea (nytt dokument = anroparen).
 * @param {object} area     källområdet ({ id, name, … })
 * @param {string[]} takenIds befintliga områdes-id i ämnet
 * @param {number} order    nästa lediga order
 */
export function duplicateValue(area, takenIds, order) {
  const { id, createdBy, createdByName, ...rest } = area;
  const taken = new Set(takenIds);
  let newId = `${id}-kopia`;
  for (let n = 2; taken.has(newId); n++) newId = `${id}-kopia-${n}`;
  return { ...rest, id: newId, name: `${area.name || id} (kopia)`, order };
}
