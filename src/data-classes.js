// ============================================================================
// Pluggportalen – klasser + klass-aggregat (Firestore)
// ----------------------------------------------------------------------------
// Utbruten del av datamodulen: lärarens klassgruppering (classes/{classId}),
// tilldelade arbetsområden per klass och det gemensamma klass-aggregatet
// (classStats/{classId}). Ingen sessionslogik här – den bor i data.js, som
// re-exporterar allt härifrån så att `import * as data from "./data.js"`
// fortsätter fungera oförändrat. Se docs/DATAMODELL.md.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "./data.js";
import { normalizeHiddenModes, normalizeAreaModes } from "./gamemode-visibility.js";
import { createTtlCache } from "./class-projection.js";

// Session-cache (#274): klasslistan läses varje gång plugga/världen ritas
// (getClassForStudent + klass-hiddenModes, färskhets-kritiskt/krav 1). En kort
// TTL-cache (INLINE här, se class-projection-entries.createTtlCache) gör
// återbesök omedelbara; lärarens klass-skrivvägar nedan invaliderar explicit och
// TTL:en fångar ändringar gjorda i en annan session. En enda nyckel ("classes")
// eftersom getClasses alltid läser hela kollektionen.
const _classCache = createTtlCache();

/** Töm klass-session-cachen (lärar-skriv, in-/utloggning, test). */
export function clearClassCache() {
  _classCache.clear();
}

// ---------------------------------------------------------------------------
// Klasser (lärarsidan) – läraren grupperar elever i klasser, t.ex. "6A".
// ----------------------------------------------------------------------------
// classes/{classId} = { name, order?, createdAt, studentIds: string[] }
// Vi lägger elevlistan som en array (studentIds) DIREKT på klassdokumentet i
// stället för en subkollektion eller en klass-referens på varje elev. För den
// här appen (en handfull klasser med ~30 elever styck) är det enklast: hela
// klassen läses/skrivs i ett dokument, och en elev kan finnas i flera klasser
// utan extra kopplingsdata. Följer samma mönster som getStudents/upsertStudent.
// ---------------------------------------------------------------------------

/** Lista alla klasser, sorterade efter `order` och sedan namn. */
export async function getClasses() {
  return _classCache.read("classes", async () => {
    const snap = await getDocs(collection(db, "classes"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort(
        (a, b) =>
          (Number(a.order) || 0) - (Number(b.order) || 0) ||
          String(a.name || "").localeCompare(String(b.name || ""), "sv")
      );
  });
}

/**
 * Skapa (eller uppdatera) en klass. Skriver bara de fält som skickas med
 * (merge), så studentIds rörs inte när man bara döper om klassen.
 * @param {string} classId klassens id (t.ex. "6a")
 * @param {object} fields  { name, order? }
 */
export async function upsertClass(classId, { name, order } = {}) {
  const ref = doc(db, "classes", classId);
  const snap = await getDoc(ref);
  const payload = { name: String(name || "").trim() };
  if (order !== undefined) payload.order = Number(order) || 0;
  // Sätt createdAt + tom elevlista bara första gången klassen skapas.
  if (!snap.exists()) {
    payload.createdAt = serverTimestamp();
    payload.studentIds = [];
  }
  await setDoc(ref, payload, { merge: true });
  _classCache.invalidate("classes");
  return classId;
}

/** Ta bort en klass (elevkontona rörs inte – bara grupperingen försvinner).
 *  Städar även bort klass-id:t ur medlemmarnas students/{id}.classIds så att
 *  reglernas kamratläsning (sharesClass) inte lämnar kvar stale-åtkomst. */
export async function deleteClass(classId) {
  const snap = await getDoc(doc(db, "classes", classId));
  const members = snap.exists() && Array.isArray(snap.data().studentIds)
    ? snap.data().studentIds
    : [];
  const batch = writeBatch(db);
  batch.delete(doc(db, "classes", classId));
  for (const id of members) {
    batch.set(doc(db, "students", id), { classIds: arrayRemove(classId) }, { merge: true });
  }
  await batch.commit();
  _classCache.invalidate("classes");
}

/**
 * Sätt exakt vilka elever som ingår i en klass (ersätter hela listan).
 *
 * Håller den denormaliserade students/{id}.classIds i synk: elever som TILLKOMMER
 * får klass-id:t (arrayUnion), elever som TAS BORT tappar det (arrayRemove).
 * classIds är det enda reglerna kan använda för att avgöra "samma klass" (de kan
 * inte loopa över classes) → klassbyns kamratläsning bygger på att fältet stämmer.
 * Allt skrivs i EN batch (atomiskt) så klasslistan och medlemmarnas classIds inte
 * kan glida isär. Kräver lärarbehörighet (students-skrivning = isTeacher).
 */
export async function setClassStudents(classId, studentIds) {
  const list = Array.isArray(studentIds) ? [...new Set(studentIds.filter(Boolean))] : [];
  const prevSnap = await getDoc(doc(db, "classes", classId));
  const prev = prevSnap.exists() && Array.isArray(prevSnap.data().studentIds)
    ? prevSnap.data().studentIds
    : [];
  const added = list.filter((id) => !prev.includes(id));
  const removed = prev.filter((id) => !list.includes(id));

  const batch = writeBatch(db);
  batch.set(doc(db, "classes", classId), { studentIds: list }, { merge: true });
  for (const id of added) {
    batch.set(doc(db, "students", id), { classIds: arrayUnion(classId) }, { merge: true });
  }
  for (const id of removed) {
    batch.set(doc(db, "students", id), { classIds: arrayRemove(classId) }, { merge: true });
  }
  await batch.commit();
  _classCache.invalidate("classes");
  return list;
}

// ---------------------------------------------------------------------------
// Tilldelade arbetsområden per klass (läraren väljer vad som är AKTIVT nu).
// ----------------------------------------------------------------------------
// classes/{classId}.assignedAreas = [{ subjectId, areaId }]
// En tom/saknad lista betyder "ingen tilldelning" → eleven ser HELA biblioteket
// (bakåtkompatibelt). Vi lägger listan direkt på klassdokumentet, samma mönster
// som studentIds ovan.
// ---------------------------------------------------------------------------

/** Normalisera en tilldelningslista till rena { subjectId, areaId }-par (utan dubletter). */
export function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) return [];
  const seen = new Set();
  const out = [];
  for (const a of assignments) {
    const subjectId = String(a?.subjectId || "").trim();
    const areaId = String(a?.areaId || "").trim();
    if (!subjectId || !areaId) continue;
    const key = `${subjectId}/${areaId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ subjectId, areaId });
  }
  return out;
}

/**
 * Sätt exakt vilka arbetsområden som är aktiva/tilldelade för en klass
 * (ersätter hela listan). Tom lista = ingen tilldelning (eleven ser allt).
 * @param {string} classId
 * @param {Array<{subjectId:string, areaId:string}>} assignments
 */
export async function setClassAssignments(classId, assignments) {
  const list = normalizeAssignments(assignments);
  const ref = doc(db, "classes", classId);
  await setDoc(ref, { assignedAreas: list }, { merge: true });
  _classCache.invalidate("classes");
  return list;
}

/** Hämta en klass tilldelade arbetsområden ([] om inga). */
export async function getClassAssignments(classId) {
  const snap = await getDoc(doc(db, "classes", classId));
  return snap.exists() ? normalizeAssignments(snap.data().assignedAreas) : [];
}

// ---------------------------------------------------------------------------
// Synliga lägen per klass (issue #208): läraren kan dölja spellägen för HELA
// klassen. Lagras som classes/{classId}.hiddenModes = string[] (mode-id att
// DÖLJA). Tom/saknad lista = allt synligt (bakåtkompatibelt). Semantiken (union
// med områdets hiddenModes) bor i gamemode-visibility.js; här bara persistensen.
// ---------------------------------------------------------------------------

/**
 * Sätt vilka spellägen som ska döljas för klassen (ersätter hela listan).
 * Tom lista = inget dolt på klass-nivå (eleverna ser allt områdena tillåter).
 * @param {string} classId
 * @param {string[]} hiddenModes mode-id att dölja (normaliseras)
 */
export async function setClassHiddenModes(classId, hiddenModes) {
  const list = normalizeHiddenModes(hiddenModes);
  await setDoc(doc(db, "classes", classId), { hiddenModes: list }, { merge: true });
  _classCache.invalidate("classes");
  return list;
}

// ---------------------------------------------------------------------------
// Synliga lägen per (klass × område) (issue #298/#299): läraren kan dölja
// spellägen för en klass PÅ ETT visst område. Lagras som
//   classes/{classId}.areaModes = { [areaId]: { hiddenModes: string[] } }
// Tom/saknad map = inget dolt på den axeln (bakåtkompatibelt). Semantiken
// (union område ∪ klass ∪ klass×område) bor i gamemode-visibility.js; här bara
// persistensen. #298 la resolutionen – #299 lägger skriv-vägen + lärar-UI:t.
// ---------------------------------------------------------------------------

/**
 * Sätt de dolda lägena per (klass × område) för en klass. `areaModes` är en map
 * områdes-id → { hiddenModes: [...] }. Skrivs med merge (deep-merge på map:en)
 * så bara de medskickade områdenas listor uppdateras – övriga områden rörs inte.
 * @param {string} classId
 * @param {Record<string, {hiddenModes: string[]}>} areaModes
 */
export async function setClassAreaModes(classId, areaModes) {
  const map = normalizeAreaModes(areaModes);
  await setDoc(doc(db, "classes", classId), { areaModes: map }, { merge: true });
  _classCache.invalidate("classes");
  return map;
}

/**
 * Hitta elevens klass utifrån klassernas studentIds. Om eleven finns i flera
 * klasser returneras den första (efter getClasses ordning). Null om ingen.
 * @param {string} studentId
 * @returns {Promise<object|null>} klassdokumentet ({ id, name, studentIds, assignedAreas, ... })
 */
export async function getClassForStudent(studentId = currentStudentId()) {
  if (!studentId) return null;
  const classes = await getClasses();
  return (
    classes.find((c) => Array.isArray(c.studentIds) && c.studentIds.includes(studentId)) || null
  );
}

// Klass-aggregatet (classStats/{classId}) från #113 är BORTTAGET (#114): en
// grannklass stjärnor räknas numera fram LIVE ur klassens studentData (samma
// aggregateKlassStats som klassen själv använder), sedan cross-class-läsning av
// studentData öppnades. Ingen denormaliserad spegling behövs – den blev bara en
// tom skylt tills varje elev loggat in efter en regel-deploy.
