// ============================================================================
// Pluggportalen – kunskapsinnehåll + elevkonton (Firestore)
// ----------------------------------------------------------------------------
// Utbruten del av datamodulen: ämnen/arbetsområden (läs + lärarens skrivning)
// och elevkontohantering. Ingen sessionslogik här – den bor i data.js, som
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
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ensureStudentData, currentStudentId } from "./data.js";
import { createStudentAuthAccount } from "./auth.js";

// ---------------------------------------------------------------------------
// Kunskapsinnehåll (ämnen och arbetsområden)
// ---------------------------------------------------------------------------

/** Lista alla ämnen, sorterade efter `order`. */
export async function getSubjects() {
  const snap = await getDocs(query(collection(db, "subjects"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Lista alla arbetsområden i ett ämne, sorterade efter `order`. */
export async function getAreas(subjectId) {
  const snap = await getDocs(
    query(collection(db, "subjects", subjectId, "areas"), orderBy("order"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Hämta ett enskilt arbetsområde (med texts[], quiz[], pairs[]). */
export async function getArea(subjectId, areaId) {
  const snap = await getDoc(doc(db, "subjects", subjectId, "areas", areaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------------------------------------------------------------------------
// Ämnen och arbetsområden – skrivning (lärarsidan)
// ---------------------------------------------------------------------------

/** Skapa (eller uppdatera) ett ämne, t.ex. { name, order, icon, description }. */
export async function upsertSubject(subjectId, subject) {
  const ref = doc(db, "subjects", subjectId);
  await setDoc(ref, subject, { merge: true });
  return subjectId;
}

/**
 * Spara ett arbetsområde (skapar eller ersätter hela dokumentet).
 * @param {string} subjectId ämnets id (t.ex. "so")
 * @param {string} areaId    arbetsområdets id (t.ex. "vikingatiden")
 * @param {object} area      { name, order, coverEmoji, description, texts[], quiz[], pairs[] }
 */
export async function saveArea(subjectId, areaId, area) {
  const ref = doc(db, "subjects", subjectId, "areas", areaId);
  // { id } hör inte hemma inuti dokumentet – det är dokumentets id.
  const { id, ...rest } = area;
  await setDoc(ref, rest);
  return areaId;
}

/** Ta bort ett arbetsområde. */
export async function deleteArea(subjectId, areaId) {
  await deleteDoc(doc(db, "subjects", subjectId, "areas", areaId));
}

/** Nästa lediga order-nummer i ett ämne (max befintlig + 1). */
export async function nextAreaOrder(subjectId) {
  const areas = await getAreas(subjectId);
  const max = areas.reduce((m, a) => Math.max(m, Number(a.order) || 0), 0);
  return max + 1;
}

// ---------------------------------------------------------------------------
// Elevkonton (lärarsidan)
// ---------------------------------------------------------------------------

/** Lista alla elevkonton. */
export async function getStudents() {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Lista alla elever tillsammans med sitt "utseende": grundavatar (avatarId),
 * burna klädsaker (avatarItems), husets palett (paletteId) och husskal
 * (husSkalId, framtida "Köp nytt hus"). Används av klassbyn (#/elev/by).
 *
 * avatarId finns redan på students-dokumentet, men resten ligger i
 * studentData/{id}. Vi läser alla studentData-dokument parallellt (Promise.all)
 * med en per-elev catch, så att en enda trasig/saknad elevdata inte fäller hela
 * vyn – då används bara students-dokumentets avatarId utan klädsel/palett.
 *
 * @returns {Promise<Array<{id, namn, username, avatarId, avatarItems: string[],
 *   paletteId: string|null, husSkalId: string|null}>>}
 */
export async function getStudentsWithLooks() {
  const students = await getStudents();
  return Promise.all(
    students.map(async (s) => {
      try {
        const snap = await getDoc(doc(db, "studentData", s.id));
        const d = snap.exists() ? snap.data() : {};
        return {
          ...s,
          avatarId: d.avatarId || s.avatarId || "fox",
          avatarItems: Array.isArray(d.avatarItems) ? d.avatarItems : [],
          paletteId: (d.room && d.room.paletteId) || null,
          husSkalId: d.husSkalId || null,
        };
      } catch {
        return { ...s, avatarId: s.avatarId || "fox", avatarItems: [], paletteId: null, husSkalId: null };
      }
    })
  );
}

/**
 * Skapa (eller uppdatera) ett elevkonto.
 *
 *  - NY elev (studentId falsy): skapar ett Firebase Auth-konto via en sekundär
 *    app-instans (så lärarens egen session inte kastas ut). Auth-uid:t blir
 *    dokumentets id → students/{uid} + studentData/{uid}. Returnerar uid:t.
 *  - BEFINTLIG elev (studentId satt): uppdaterar bara namn/avatar på dokumentet.
 *    Användarnamn och lösenord är knutna till Auth-kontot och kan INTE ändras
 *    från klienten (SDK saknar behörighet). Lösenordsåterställning för en elev
 *    kräver admin-vägen – se admin/reset-student-password.mjs.
 *
 * @returns {Promise<string>} elevens id (= Auth-uid)
 */
export async function upsertStudent(studentId, { namn, username, password, avatarId }) {
  if (studentId) {
    // Uppdatera befintlig elev. Rör inte username/lösenord (bor i Auth).
    const ref = doc(db, "students", studentId);
    await setDoc(ref, { namn, avatarId: avatarId || "fox" }, { merge: true });
    await ensureStudentData(studentId, avatarId);
    return studentId;
  }
  // Ny elev: skapa Auth-kontot först; uid:t blir dokumentets id.
  const uid = await createStudentAuthAccount(username, password);
  await setDoc(doc(db, "students", uid), {
    namn,
    username: String(username).trim().toLowerCase(),
    avatarId: avatarId || "fox",
  });
  await ensureStudentData(uid, avatarId);
  return uid;
}

/**
 * Ta bort ett elevkonto och dess speldata (Firestore).
 *
 * OBS: själva Firebase Auth-kontot går INTE att radera från klienten (SDK:t kan
 * bara radera den inloggade användaren). Dokumenten tas bort här; för att även
 * radera Auth-kontot, kör admin/delete-student.mjs. Ett kvarblivet Auth-konto
 * utan students-dokument kommer inte åt någon annans data.
 */
export async function deleteStudent(studentId) {
  await deleteDoc(doc(db, "students", studentId));
  await deleteDoc(doc(db, "studentData", studentId)).catch(() => {});
}

/**
 * Finns användarnamnet redan (på någon ANNAN elev än exceptId)?
 * Används för att varna för dubletter innan man sparar.
 */
export async function usernameTaken(username, exceptId = null) {
  const uname = String(username || "").trim().toLowerCase();
  if (!uname) return false;
  const snap = await getDocs(
    query(collection(db, "students"), where("username", "==", uname))
  );
  return snap.docs.some((d) => d.id !== exceptId);
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
  const snap = await getDocs(collection(db, "classes"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (Number(a.order) || 0) - (Number(b.order) || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""), "sv")
    );
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
  return classId;
}

/** Ta bort en klass (elevkontona rörs inte – bara grupperingen försvinner). */
export async function deleteClass(classId) {
  await deleteDoc(doc(db, "classes", classId));
}

/** Sätt exakt vilka elever som ingår i en klass (ersätter hela listan). */
export async function setClassStudents(classId, studentIds) {
  const list = Array.isArray(studentIds) ? [...new Set(studentIds)] : [];
  const ref = doc(db, "classes", classId);
  await setDoc(ref, { studentIds: list }, { merge: true });
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
  return list;
}

/** Hämta en klass tilldelade arbetsområden ([] om inga). */
export async function getClassAssignments(classId) {
  const snap = await getDoc(doc(db, "classes", classId));
  return snap.exists() ? normalizeAssignments(snap.data().assignedAreas) : [];
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
