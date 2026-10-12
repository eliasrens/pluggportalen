// ============================================================================
// Hitta rätt! – elevens personbästa (src/hitta-ratt/hr-best.js) · #605
// ----------------------------------------------------------------------------
// Startsidan läser hittaRattBest/{uid} med EN läsning (arkitektur §3.2, #231).
// Dokumentet skrivs bara av Cloud Functionen hittaRattSubmit (F #609); F
// lägger även till läsregeln. Tills dess (eller vid fel/offline) = {} – ett
// saknat personbästa ska aldrig stoppa startsidan.
// ============================================================================

import { db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "../data.js";

/** @returns {Promise<Record<string, object>>} packId → { typ, s|r, t, max, … } */
export async function hamtaPersonbasta(uid = currentStudentId()) {
  if (!uid) return {};
  try {
    const snap = await getDoc(doc(db, "hittaRattBest", uid));
    const packs = snap.exists() ? snap.data().packs : null;
    return packs && typeof packs === "object" ? packs : {};
  } catch {
    return {};
  }
}
