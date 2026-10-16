// ============================================================================
// Prov (#739): lärarens läsningar och skrivningar av prov/{provId}.
// Laddas bara DYNAMISKT (lärarfliken "Mina prov"), aldrig i bootgrafen (#271).
//
//   listaProv()            alla prov (årskurskonton läser även kollegors, §4) –
//                          en läsning per prov, bara när listan visas
//   hamtaProv(id)          ett prov (1 läsning) eller null
//   sparaProv(id, dok)     id null = nytt prov (auto-id) → id. Hela dokumentet
//                          skrivs (setDoc); skapad behålls, uppdaterad = servertid
//   raderaProv(id)
//
// Reglerna (firestore.rules "PROV"): createdBy = egen uid vid skapande och
// byts aldrig; bara ägaren/admin ändrar och raderar.
// ============================================================================

import { db } from "../../firebase-config.js";
import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SAMLING_PROV } from "../prov-modell.js";

export async function listaProv() {
  const snap = await getDocs(collection(db, SAMLING_PROV));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function hamtaProv(id) {
  const snap = await getDoc(doc(db, SAMLING_PROV, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

/**
 * @param {string|null} id   null = nytt prov
 * @param {object} dok       tillDokument(...).value (med ägarfälten)
 * @param {object|null} existing det sparade dokumentet (för skapad)
 */
export async function sparaProv(id, dok, existing = null) {
  const ref = id ? doc(db, SAMLING_PROV, id) : doc(collection(db, SAMLING_PROV));
  await setDoc(ref, {
    ...dok,
    skapad: existing?.skapad ?? serverTimestamp(),
    uppdaterad: serverTimestamp(),
  });
  return ref.id;
}

export async function raderaProv(id) {
  await deleteDoc(doc(db, SAMLING_PROV, id));
}

/** Vänlig text för ett Firestore-fel (aldrig en teknisk kod). */
export function felText(err, vad = "Provet") {
  const code = String(err?.code || "").replace(/^firestore\//, "");
  if (code === "permission-denied") return `${vad} kunde inte sparas – bara läraren som skapade provet kan ändra det. Kopiera det i stället.`;
  if (code === "unavailable") return "Ingen kontakt med servern. Kontrollera nätet och försök igen.";
  return `${vad}: något gick fel (${err?.message || err}). Försök igen.`;
}
