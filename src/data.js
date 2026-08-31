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
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SESSION_KEY = "pluggportalen.session";

// ---------------------------------------------------------------------------
// Session (localStorage) – bara vem som är inloggad.
// ---------------------------------------------------------------------------

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function isLoggedIn() {
  return !!getSession();
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
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
export async function login(username, password) {
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

  setSession({ studentId: student.id, namn: student.namn, username: student.username });
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
    room: { placements: {} }, // { [itemId]: { x, y } }
    avatarId: avatarId || "fox",
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
  await updateDoc(ref, { avatarId });
  // Håll students-dokumentet i synk också (avatarId finns på båda ställena).
  await updateDoc(doc(db, "students", studentId), { avatarId }).catch(() => {});
  return avatarId;
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
// Elevkonton (används av lärarsidan i senare issues)
// ---------------------------------------------------------------------------

/** Lista alla elevkonton. */
export async function getStudents() {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
