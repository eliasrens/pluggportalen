// ============================================================================
// Pluggportalen – rum & avatar-utseende (data-room.js)
// ----------------------------------------------------------------------------
// Systermodul till data.js (som ligger nära filtaket, samma mönster som
// data-xp.js/data-pet.js): allt Firestore som rör hur eleven SER UT och hur
// rummet är inrett – rummet (placeringar + palettval), burna klädsaker,
// grundavatar och evolutionsval. Allt re-exporteras från data.js så att
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

// --- Evolution (Pokémon-stil) ----------------------------------------------
// Vilket steg figuren NÅTT härleds alltid ur framstegen (se evolution.js) –
// här sparas bara elevens aktiva VAL: grenen i sista steget.

/** Hela evolution-objektet: { [avatarId]: { stage, branch } }. */
export async function getEvolution(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.evolution || {};
}

/**
 * Spara elevens grenval för en figur (t.ex. roboten i sista steget).
 * @param {string} avatarId figuren valet gäller (t.ex. "robot")
 * @param {{stage?: number, branch?: string|null}} choice
 */
export async function setEvolutionChoice(avatarId, { stage = null, branch = null } = {}, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  // merge:true slår ihop nästlade maps → val för andra figurer bevaras.
  await setDoc(ref, { evolution: { [avatarId]: { stage, branch } } }, { merge: true });
  return { stage, branch };
}
