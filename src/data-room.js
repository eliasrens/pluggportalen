// ============================================================================
// Pluggportalen – rum & avatar-utseende (data-room.js)
// ----------------------------------------------------------------------------
// Systermodul till data.js (som ligger nära filtaket, samma mönster som
// data-xp.js/data-pet.js): allt Firestore som rör hur eleven SER UT och hur
// rummet är inrett – rummet (placeringar + palettval), burna klädsaker,
// grundavatar. Allt re-exporteras från data.js så att
// `import * as data from "./data.js"` fortsätter fungera överallt.
// Fältbeskrivningar: docs/DATAMODELL.md.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getStudentData } from "./data.js";
import { roomUpgradeCount } from "./shop-items.js";

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

// --- Rum (placering av saker + palettval) ----------------------------------

export async function getRoom(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.room || { placements: {} };
}

/**
 * Spara delar av rummet, t.ex. { placements } eller { paletteId }.
 * Varje fält skrivs med dot-path ("room.placements") så att övriga rum-fält
 * lämnas orörda – placeringar och palettval skriver inte över varandra.
 */
export async function saveRoom(room, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const updates = {};
  for (const [key, value] of Object.entries(room)) updates[`room.${key}`] = value;
  await updateDoc(ref, updates);
  return room;
}

// --- Fler rum (husuppgradering: dörrar inne + rumslista) -------------------
// Rums-begreppet är BAKÅTKOMPATIBELT ovanpå det gamla enskilda rummet:
//
//   * GRUNDRUMMET (rum 0) ligger kvar OFÖRÄNDRAT i studentData.room
//     ({ placements, paletteId, window }). Dess paletteId är även husets
//     EXTERIÖR-palett (paletteIdFromStudentData/getStudentsWithLooks läser den),
//     så gamla enrums-hus och by-vyn fungerar precis som förr utan migrering.
//
//   * EXTRA RUM (rum 1, 2 …) ligger i studentData.extraRooms – en MAP keyad på
//     "0","1",… (inte en array: Firestore kan då punkt-skriva ett enskilt rum,
//     extraRooms.0.placements, utan att röra de andra). extraRooms."0" = rum #2.
//
// getRooms(sd) presenterar detta som en enda 0-indexerad logisk lista
// [rum0, rum1, …] (rum -> rooms[0]) vars längd = getRoomCount(sd). Antalet
// upplåsta rum härleds ur ägda rums-uppgraderingar (roomUpgradeCount), samma
// mönster som husskalen härleds ur ownedItems – inget separat räknar-fält.

/** Tomt rum (nytt/oinrett extra rum). */
function emptyRoom() {
  return { placements: {}, paletteId: null, window: null };
}

/** Normalisera ett (ev. saknat) rum-objekt till fast form. */
function normalizeRoom(r) {
  const room = r && typeof r === "object" ? r : {};
  return {
    placements: room.placements && typeof room.placements === "object" ? room.placements : {},
    paletteId: room.paletteId || null,
    window: room.window || null,
  };
}

/**
 * Hur många rum eleven har totalt (grundrummet + upplåsta extra rum).
 * Ren hjälpare över en redan inläst studentData (ingen Firestore).
 * @param {object|null|undefined} sd studentData
 * @returns {number} ≥ 1
 */
export function getRoomCount(sd) {
  return 1 + roomUpgradeCount(sd && sd.ownedItems);
}

/**
 * Elevens rum som en 0-indexerad logisk lista [rum0, rum1, …] med längd
 * getRoomCount(sd). Ren hjälpare (ingen Firestore). rum0 = det gamla
 * studentData.room (bakåtkompatibelt); extra rum fylls ur studentData.extraRooms
 * och saknade/oinredda extra rum blir tomma rum (så de kan inredas).
 * @param {object|null|undefined} sd studentData
 * @returns {Array<{placements:object, paletteId:string|null, window:object|null}>}
 */
export function getRooms(sd) {
  const count = getRoomCount(sd);
  const extra = (sd && sd.extraRooms && typeof sd.extraRooms === "object") ? sd.extraRooms : {};
  const rooms = [normalizeRoom(sd && sd.room)];
  for (let i = 1; i < count; i++) {
    rooms.push(normalizeRoom(extra[String(i - 1)]));
  }
  return rooms;
}

/**
 * Spara delar av ETT visst rum (per index). Rum 0 skrivs till det gamla
 * studentData.room (via saveRoom, dot-paths room.<fält>); extra rum skrivs till
 * studentData.extraRooms.<index-1>.<fält>. Andra rum lämnas alltid orörda.
 * @param {number} index rum-index (0 = grundrummet)
 * @param {object} partial t.ex. { placements } / { paletteId } / { window }
 */
export async function saveRoomAt(index, partial, studentId = currentStudentId()) {
  if (index === 0) return saveRoom(partial, studentId);
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const key = String(index - 1);
  const updates = {};
  for (const [field, value] of Object.entries(partial)) {
    updates[`extraRooms.${key}.${field}`] = value;
  }
  await updateDoc(ref, updates);
  return partial;
}

// --- Husskal (byter husets exteriör – "Köp nytt hus") -----------------------
// Aktivt skal ligger i ett TOP-LEVEL fält (studentData.husSkalId), inte i room:
// det påverkar bara husets utsida (ute-scenen + minihuset i byn), aldrig rummet.
// Läses redan av pages-varld.js, varld-by-scen.js, varld-kompis.js och
// data-content.js. Okänt/saknat id faller alltid tillbaka på default-stugan.

/** Elevens aktiva husskal-id (null = default-stugan). */
export async function getHusSkal(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.husSkalId || null;
}

/**
 * Spara elevens aktiva husskal. Drar INGA coins (köpet sker separat via
 * buyItem, som lägger skal-id:t i ownedItems). Byter bara vilket ägt skal som
 * ritas – rummet/interiören lämnas orört.
 * @param {string} skalId husskal-id (bör vara "stuga" eller ett ägt skal)
 */
export async function saveHusSkal(skalId, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  await updateDoc(ref, { husSkalId: skalId });
  return skalId;
}

// --- Huslås ("Lås ditt hus" – hindra andra elever från att titta in) --------
// Ett TOP-LEVEL fält (studentData.husLast, bool). När det är true ska en
// klasskamrats LÄS-vy (pages-klasskamrat.js) visa ett "🔒 Låst"-tillstånd i
// stället för rummets innehåll – husets exteriör i byn syns fortfarande.
//
// isHouseLocked() är en REN hjälpare (ingen Firestore) så alla läs-vyer kan
// avgöra låset ur en redan inläst studentData utan en extra runda. Den är
// generisk med flit: sub-issue #34 (fler rum) ska respektera EXAKT samma lås.
//
// Server-sida: klasskamratläsning av studentData är i dagsläget HELT spärrad i
// firestore.rules (read: isTeacher() || isSelf) – ingen kan alltså läsa en
// annans rum, låst eller ej. Öppnas kamratläsning senare (Epic C:s by-fix)
// MÅSTE den regeln även kräva `resource.data.husLast != true`, annars kan låset
// kringgås klient-sida. Se kommentaren i firestore.rules.

/**
 * Är elevens hus låst? Ren hjälpare över ett redan inläst studentData-objekt.
 * @param {object|null|undefined} studentData
 * @returns {boolean}
 */
export function isHouseLocked(studentData) {
  return !!(studentData && studentData.husLast === true);
}

/** Elevens huslås-status (async läsning). */
export async function getHusLast(studentId = currentStudentId()) {
  return isHouseLocked(await getStudentData(studentId));
}

/**
 * Lås eller lås upp elevens hus. Rör bara husLast-fältet.
 * @param {boolean} locked true = lås, false = lås upp
 */
export async function setHusLast(locked, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const val = !!locked;
  await updateDoc(ref, { husLast: val });
  return val;
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
