// ============================================================================
// Prov (#740, spec §5.5): elevens läsningar och skrivningar. Eleven läser bara
// sitt tillfälle och sitt eget svar-dokument (§9.2). Reglerna: firestore.rules
// "PROV" (svar: skapa med startad = serverns tid, varje sparning sätter
// uppdaterad, inlämning med inlamnadAt = serverns tid, nekas efter
// startad + tidsgräns + 2 min).
// ============================================================================

import { db } from "../firebase-config.js";
import {
  doc, getDoc, serverTimestamp, setDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SAMLING_TILLFALLEN, SVAR } from "./prov-modell.js";

const svarRef = (t, uid) => doc(db, SAMLING_TILLFALLEN, t, SVAR, uid);

/** Tillfället (eleven får läsa det när det är öppet eller stängt), eller null. */
export async function hamtaTillfalle(t) {
  const snap = await getDoc(doc(db, SAMLING_TILLFALLEN, t));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Elevens svar-dokument, eller null om eleven inte startat. */
export async function hamtaMittSvar(t, uid) {
  const snap = await getDoc(svarRef(t, uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * "Starta provet": skapa svar-dokumentet med serverns tid som start. Läser
 * tillbaka det (en läsning) så nedräkningen utgår från serverns startad.
 */
export async function startaProv(t, uid, classId, svar = {}) {
  await setDoc(svarRef(t, uid), {
    elevId: uid, classId, startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar, inlamnad: false,
  });
  return hamtaMittSvar(t, uid);
}

/** Bakgrundssparningen: hela svar-mapen (rensad) + uppdaterad. */
export function sparaSvar(t, uid, svar) {
  return updateDoc(svarRef(t, uid), { svar, uppdaterad: serverTimestamp() });
}

/** Lämna in: sista svaren + inlämnad i EN skrivning. nar = "elev" | "tid". */
export function lamnaIn(t, uid, svar, nar) {
  return updateDoc(svarRef(t, uid), {
    svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(),
  });
}
