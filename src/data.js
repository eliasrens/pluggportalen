// ============================================================================
// Pluggportalen – datamodul (data.js)
// ----------------------------------------------------------------------------
// Detta är det gemensamma API:et som ALLA delar av sajten återanvänder:
// gamemodes (quiz/läsförståelse/para ihop), shoppen, elevrummet och lärarsidan.
//
// Ansvar:
//   * Inloggning mot elevkonton i Firestore (användarnamn + lösenord).
//     OBS: enkel skolinloggning, INTE säkerhetskritisk. Lösenord i klartext.
//   * Session i localStorage (bara vem som är inloggad – ID + namn).
//   * All riktig elevdata (coins, framsteg, ägda saker, avatar, rum) i Firestore.
//   * Kunskapsinnehåll: hämta ämnen och arbetsområden.
//
// Firestore-datamodell – se docs/DATAMODELL.md för full dokumentation.
//   subjects/{subjectId}                      – ämne (t.ex. "so")
//   subjects/{subjectId}/areas/{areaId}       – arbetsområde (t.ex. "vikingatiden")
//       innehåller: texts[], quiz[], pairs[]
//   students/{studentId}                      – { namn, username, password, avatarId }
//   studentData/{studentId}                   – { coins, progress, ownedItems, room, avatarId }
// ============================================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SESSION_KEY = "pluggportalen.session";

// ---------------------------------------------------------------------------
// Session – bara vem som är inloggad (ID + namn).
//
// "Kom-ihåg-mig": när eleven kryssar i det sparas sessionen i localStorage och
// ligger kvar tills hen loggar ut (praktiskt på elevens vanliga dator). Annars
// sparas den i sessionStorage och försvinner när fliken stängs (bra på en delad
// eller offentlig dator).
// ---------------------------------------------------------------------------

export function getSession() {
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session, remember) {
  const raw = JSON.stringify(session);
  // Rensa båda lagren först så vi aldrig får två olika sessioner.
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
  const store = remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, raw);
}

export function isLoggedIn() {
  return !!getSession();
}

export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** Den inloggade elevens ID, eller null. */
export function currentStudentId() {
  return getSession()?.studentId ?? null;
}

// ---------------------------------------------------------------------------
// Inloggning
// ---------------------------------------------------------------------------

/**
 * Logga in en elev med användarnamn + lösenord.
 * @returns {Promise<{ok: true, student: object} | {ok: false, error: string}>}
 */
export async function login(username, password, remember = false) {
  const uname = String(username || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!uname || !pw) {
    return { ok: false, error: "Fyll i både användarnamn och lösenord." };
  }

  const q = query(collection(db, "students"), where("username", "==", uname));
  const snap = await getDocs(q);
  if (snap.empty) {
    return { ok: false, error: "Det finns ingen elev med det användarnamnet." };
  }

  const docSnap = snap.docs[0];
  const student = { id: docSnap.id, ...docSnap.data() };
  if (student.password !== pw) {
    return { ok: false, error: "Fel lösenord. Försök igen." };
  }

  setSession(
    { studentId: student.id, namn: student.namn, username: student.username },
    remember
  );
  // Säkerställ att elevdata-dokumentet finns.
  await ensureStudentData(student.id, student.avatarId);
  return { ok: true, student };
}

// ---------------------------------------------------------------------------
// Elevdata (Firestore) – coins, framsteg, ägda saker, avatar, rum.
// ---------------------------------------------------------------------------

function defaultStudentData(avatarId) {
  return {
    coins: 0,
    progress: {}, // { [areaId]: { [gamemode]: { completed, bestScore, stars, lastPlayed } } }
    ownedItems: [], // shop-sak-id:n
    avatarItems: [], // burna klädsaker (delmängd av ownedItems)
    room: { placements: {} }, // { [itemId]: { x, y } }
    avatarId: avatarId || "fox",
    avatarChosen: false, // sätts true när eleven själv valt en grundavatar
  };
}

/** Skapar studentData-dokumentet om det saknas. Returnerar datan. */
export async function ensureStudentData(studentId, avatarId) {
  const ref = doc(db, "studentData", studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = defaultStudentData(avatarId);
    await setDoc(ref, data);
    return data;
  }
  return snap.data();
}

/** Hämtar hela elevdata-dokumentet för inloggad (eller angiven) elev. */
export async function getStudentData(studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : await ensureStudentData(studentId);
}

// --- Coins ------------------------------------------------------------------

/** Aktuellt saldo pluggcoins. */
export async function getCoins(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.coins || 0;
}

/**
 * Lägg till coins (transaktion, så flera övningar inte skriver över varandra).
 * @returns {Promise<number>} nytt saldo.
 */
export async function addCoins(amount, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const n = Math.max(0, Math.round(amount || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data().coins || 0 : 0;
    const next = cur + n;
    if (snap.exists()) tx.update(ref, { coins: next });
    else tx.set(ref, { ...defaultStudentData(), coins: next });
    return next;
  });
}

/**
 * Spendera coins. Misslyckas om saldot inte räcker.
 * @returns {Promise<{ok: boolean, coins: number}>}
 */
export async function spendCoins(amount, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const n = Math.max(0, Math.round(amount || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data().coins || 0 : 0;
    if (cur < n) return { ok: false, coins: cur };
    tx.update(ref, { coins: cur - n });
    return { ok: true, coins: cur - n };
  });
}

// --- Framsteg ---------------------------------------------------------------

/** Hela progress-objektet. */
export async function getProgress(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.progress || {};
}

/**
 * Spara framsteg för ett arbetsområde + gamemode.
 * @param {string} areaId   arbetsområdets id
 * @param {string} gamemode t.ex. "quiz" | "lasforstaelse" | "para"
 * @param {object} result   { completed?, bestScore?, stars?, ... }
 */
export async function saveProgress(areaId, gamemode, result, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const key = `progress.${areaId}.${gamemode}`;
  const payload = { ...result, lastPlayed: serverTimestamp() };
  // Slå ihop med ev. tidigare resultat (behåll bästa score).
  const existing = (await getProgress(studentId))?.[areaId]?.[gamemode] || {};
  if (typeof existing.bestScore === "number" && typeof payload.bestScore === "number") {
    payload.bestScore = Math.max(existing.bestScore, payload.bestScore);
  }
  if (typeof existing.stars === "number" && typeof payload.stars === "number") {
    payload.stars = Math.max(existing.stars, payload.stars);
  }
  await updateDoc(ref, { [key]: { ...existing, ...payload } });
  return payload;
}

// --- Ägda saker (shop) ------------------------------------------------------

export async function getOwnedItems(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.ownedItems || [];
}

/** Markera en sak som köpt/ägd (idempotent). Drar INTE coins – gör det separat. */
export async function addOwnedItem(itemId, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const owned = snap.exists() ? snap.data().ownedItems || [] : [];
    if (owned.includes(itemId)) return owned;
    const next = [...owned, itemId];
    if (snap.exists()) tx.update(ref, { ownedItems: next });
    else tx.set(ref, { ...defaultStudentData(), ownedItems: next });
    return next;
  });
}

/**
 * Köp en sak: drar coins OCH lägger till i ägda saker i samma transaktion.
 * @returns {Promise<{ok: boolean, coins: number, owned: string[]}>}
 */
export async function buyItem(itemId, price, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const cost = Math.max(0, Math.round(price || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : defaultStudentData();
    const owned = data.ownedItems || [];
    if (owned.includes(itemId)) return { ok: true, coins: data.coins || 0, owned };
    if ((data.coins || 0) < cost) return { ok: false, coins: data.coins || 0, owned };
    const next = { coins: (data.coins || 0) - cost, ownedItems: [...owned, itemId] };
    if (snap.exists()) tx.update(ref, next);
    else tx.set(ref, { ...defaultStudentData(), ...next });
    return { ok: true, coins: next.coins, owned: next.ownedItems };
  });
}

// --- Avatar-påklädnad (burna klädsaker) ------------------------------------

/** Id:n på de klädsaker eleven har på sin avatar just nu. */
export async function getAvatarItems(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.avatarItems || [];
}

/**
 * Spara vilka klädsaker som bärs på avataren.
 * @param {string[]} items id:n (bör vara en delmängd av ownedItems)
 */
export async function saveAvatarItems(items, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const list = Array.isArray(items) ? [...new Set(items)] : [];
  await updateDoc(ref, { avatarItems: list });
  return list;
}

// --- Rum (placering av saker) ----------------------------------------------

export async function getRoom(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.room || { placements: {} };
}

/** Spara rummets placeringar: { [itemId]: { x, y } }. */
export async function saveRoom(room, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  await updateDoc(ref, { room });
  return room;
}

// --- Avatar -----------------------------------------------------------------

export async function getAvatar(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.avatarId || "fox";
}

export async function setAvatar(avatarId, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  // avatarChosen markeras true så vi vet att eleven själv gjort ett val.
  await setDoc(ref, { avatarId, avatarChosen: true }, { merge: true });
  // Håll students-dokumentet i synk också (avatarId finns på båda ställena).
  await updateDoc(doc(db, "students", studentId), { avatarId }).catch(() => {});
  return avatarId;
}

/** Har eleven valt en grundavatar själv (annars: visa avatarvalet först)? */
export async function hasChosenAvatar(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return !!data.avatarChosen;
}

// ---------------------------------------------------------------------------
// Enkel statistik (för profilsidan). Räknas ur progress-objektet.
// ---------------------------------------------------------------------------

/**
 * Sammanställer enkel statistik för profilsidan.
 * @returns {Promise<{coins:number, playedExercises:number, completed:number, stars:number, areas:number}>}
 */
export async function getStats(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  const progress = data.progress || {};
  let playedExercises = 0; // antal spelade övningar (område × gamemode)
  let completed = 0;
  let stars = 0;
  const areaSet = new Set();
  for (const [areaId, modes] of Object.entries(progress)) {
    for (const result of Object.values(modes || {})) {
      playedExercises += 1;
      areaSet.add(areaId);
      if (result && result.completed) completed += 1;
      if (result && typeof result.stars === "number") stars += result.stars;
    }
  }
  return {
    coins: data.coins || 0,
    playedExercises,
    completed,
    stars,
    areas: areaSet.size,
  };
}

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
 * Lista alla elever tillsammans med sitt "utseende": grundavatar (avatarId) och
 * burna klädsaker (avatarItems). Används av klassfotot (#/elev/klassfoto).
 *
 * avatarId finns redan på students-dokumentet, men avatarItems ligger i
 * studentData/{id}. Vi läser alla studentData-dokument parallellt (Promise.all)
 * med en per-elev catch, så att en enda trasig/saknad elevdata inte fäller hela
 * vyn – då används bara students-dokumentets avatarId utan klädsel.
 *
 * @returns {Promise<Array<{id, namn, username, avatarId, avatarItems: string[]}>>}
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
        };
      } catch {
        return { ...s, avatarId: s.avatarId || "fox", avatarItems: [] };
      }
    })
  );
}

/** Skapa (eller uppdatera) ett elevkonto. */
export async function upsertStudent(studentId, { namn, username, password, avatarId }) {
  const ref = doc(db, "students", studentId);
  await setDoc(
    ref,
    {
      namn,
      username: String(username).trim().toLowerCase(),
      password,
      avatarId: avatarId || "fox",
    },
    { merge: true }
  );
  await ensureStudentData(studentId, avatarId);
  return studentId;
}

/** Ta bort ett elevkonto och dess speldata. */
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
function normalizeAssignments(assignments) {
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
