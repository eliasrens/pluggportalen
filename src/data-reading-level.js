// ============================================================================
// Pluggportalen – per-elev läsnivå, Firestore (data-reading-level.js)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (som ligger vid filtaket, precis som
// data-xp.js): allt Firestore som rör studentData.readingLevel (#154). Ren
// normalisering/nivåbygge ligger i reading-level.js (browser-fri, testbar);
// den här filen är den tunna Firestore-bryggan.
//
// Re-exporteras genom data.js så `data.getReadingLevel(...)` fungerar överallt.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getStudentData, invalidateStudentData } from "./data.js";
import { normalizeReadingLevel } from "./reading-level.js";

/**
 * Elevens läsnivå (1–3) för läsförståelse. Saknas fältet (gamla dokument) →
 * DEFAULT_READING_LEVEL (2/mellan, via normalizeReadingLevel). Läsförståelse-
 * läget läser detta för att servera texterna/frågorna på elevens nivå.
 */
export async function getReadingLevel(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return normalizeReadingLevel(data.readingLevel);
}

/**
 * Sätt en elevs läsnivå (1–3). Läraren använder detta i klasshanteringen; värdet
 * normaliseras så bara giltiga nivåer sparas. Merge-skrivning rör inget annat i
 * elevdokumentet. Returnerar den sparade (normaliserade) nivån.
 */
export async function setReadingLevel(level, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev angiven.");
  const value = normalizeReadingLevel(level);
  const ref = doc(db, "studentData", studentId);
  await setDoc(ref, { readingLevel: value }, { merge: true });
  invalidateStudentData(studentId); // egen elev: nästa läsning färsk (#274)
  return value;
}
