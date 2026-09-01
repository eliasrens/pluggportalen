// ============================================================================
// Pluggportalen – XP/nivå-data (data-xp.js)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (som redan ligger nära filtaket, precis som
// data-pet.js): allt Firestore som rör studentData.xp. Importera direkt härifrån
// (t.ex. `import { addXp } from "./data-xp.js"`). Ren nivå-/XP-logik (kurva,
// XP-pott) ligger i leveling.js; fältbeskrivning i docs/DATAMODELL.md.
//
// Kumulativt xp-fält. Nivån räknas fram ur xp (leveling.js) och sparas ALDRIG.
// Elever utan xp-fält (spelade innan systemet fanns) migreras första gången XP
// delas ut: startvärdet härleds ur progress (xpFromStudentData).
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getStudentData, defaultStudentData } from "./data.js";
import { xpFromStudentData } from "./leveling.js";

/** Elevens samlade XP (sparat fält, annars härlett ur progress). */
export async function getXp(studentId = currentStudentId()) {
  return xpFromStudentData(await getStudentData(studentId));
}

/**
 * Lägg till XP (transaktion, samma mönster som addCoins). Saknas xp-fältet
 * härleds ett startvärde ur progress först, så ingen nollställs till nivå 1.
 * @returns {Promise<number>} nytt totalt XP.
 */
export async function addXp(amount, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const n = Math.max(0, Math.round(amount || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() ? xpFromStudentData(snap.data()) : 0;
    const next = cur + n;
    if (snap.exists()) tx.update(ref, { xp: next });
    else tx.set(ref, { ...defaultStudentData(), xp: next });
    return next;
  });
}
