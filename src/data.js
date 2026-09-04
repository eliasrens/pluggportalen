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
//   studentData/{studentId}                   – { coins, xp, progress, ownedItems, room, avatarId }
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

export function defaultStudentData(avatarId) {
  return {
    coins: 0,
    xp: 0, // kumulativt erfarenhets-XP (nivån härleds ur detta – se leveling.js)
    progress: {}, // { [areaId]: { [gamemode]: { completed, bestScore, stars, lastPlayed } } }
    ownedItems: [], // shop-sak-id:n
    avatarItems: [], // burna klädsaker (delmängd av ownedItems)
    room: { placements: {} }, // { [itemId]: { x, y } }
    husSkalId: null, // aktivt husskal (byter husets exteriör); null = default-stugan
    avatarId: avatarId || "fox",
    avatarChosen: false, // sätts true när eleven själv valt en grundavatar
    evolution: {}, // { [avatarId]: { stage, branch } } – elevens grenval (se evolution.js)
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

// XP / nivå: se systermodulen data-xp.js (additiv, som data-pet.js) – håller
// data.js under filtaket. getXp()/addXp() importeras därifrån direkt.

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

// Rum & avatar-utseende (rum, klädsaker, avatar, evolution): utbrutet till
// data-room.js (additiv systermodul som data-xp.js) – re-exporteras nedan.

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
// Kunskapsinnehåll + elevkonton (lärarsidans data) – utbrutet till
// data-content.js men re-exporteras här så alla `import * as data` fungerar.
// ---------------------------------------------------------------------------

export {
  getAvatarItems,
  saveAvatarItems,
  getRoom,
  saveRoom,
  getHusSkal,
  saveHusSkal,
  getAvatar,
  setAvatar,
  hasChosenAvatar,
  getEvolution,
  setEvolutionChoice,
} from "./data-room.js";

export {
  getSubjects,
  getAreas,
  getArea,
  upsertSubject,
  saveArea,
  deleteArea,
  nextAreaOrder,
  getStudents,
  getStudentsWithLooks,
  upsertStudent,
  deleteStudent,
  usernameTaken,
  getClasses,
  upsertClass,
  deleteClass,
  setClassStudents,
  normalizeAssignments,
  setClassAssignments,
  getClassAssignments,
  getClassForStudent,
} from "./data-content.js";
