// ============================================================================
// Prov (#740, spec §5.5): elevens läsningar och skrivningar. Eleven läser bara
// sitt tillfälle och sitt eget svar-dokument (§9.2). Reglerna: firestore.rules
// "PROV" (svar: skapa med startad = serverns tid, varje sparning sätter
// uppdaterad, inlämning med inlamnadAt = serverns tid, nekas efter
// startad + tidsgräns + 2 min).
// ============================================================================

import { db } from "../firebase-config.js";
import {
  doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { RATTNING, SAMLING_TILLFALLEN, SVAR } from "./prov-modell.js";

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
export async function startaProv(t, uid, classId, svar = {}, { helskarmFel = false } = {}) {
  await setDoc(svarRef(t, uid), {
    elevId: uid, classId, startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar, inlamnad: false,
    ...(helskarmFel ? { helskarmFel: true } : {}),
  });
  return hamtaMittSvar(t, uid);
}

// #748: flikbytena följer med sparningarna (ingen egen skrivning), först när de finns.
// #810: helskarmFel ("Helskärm fungerade inte") likadant.
const flik = (n, helskarmFel = false) => ({ ...(n > 0 ? { flikbyten: n } : {}), ...(helskarmFel ? { helskarmFel: true } : {}) });

/** Bakgrundssparningen: hela svar-mapen (rensad) + uppdaterad (+ flikbyten). */
export function sparaSvar(t, uid, svar, flikbyten = 0, helskarmFel = false) {
  return updateDoc(svarRef(t, uid), { svar, uppdaterad: serverTimestamp(), ...flik(flikbyten, helskarmFel) });
}

/** Lämna in: sista svaren + inlämnad i EN skrivning. nar = "elev" | "tid". */
export function lamnaIn(t, uid, svar, nar, flikbyten = 0, helskarmFel = false) {
  return updateDoc(svarRef(t, uid), {
    svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(), ...flik(flikbyten, helskarmFel),
  });
}

/**
 * Helskärmsläget (#810, §5.6): eleven lämnade provet. Svaren + pausen +
 * räknaren i EN skrivning – reglerna nekar sedan allt tills läraren släpper in.
 * @param {{ pausOrsak, flikbyten, pausLogg }} falt  ur pausFalt (prov-helskarm.js)
 */
export function pausa(t, uid, svar, falt, helskarmFel = false) {
  return updateDoc(svarRef(t, uid), {
    svar, uppdaterad: serverTimestamp(), pausad: true, pausadAt: serverTimestamp(), ...falt, ...(helskarmFel ? { helskarmFel: true } : {}),
  });
}

/** Tiden tog slut under pausen: lämna in de svar som sparades när pausen började. */
export function lamnaInPausad(t, uid) {
  return updateDoc(svarRef(t, uid), { uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: "tid", inlamnadAt: serverTimestamp() });
}

/** Under pausen: lyssna på det egna svaret (en läsning när läraren släpper in). */
export function lyssnaMittSvar(t, uid, cb) {
  return onSnapshot(svarRef(t, uid), (s) => cb(s.exists() ? s.data() : null), (err) => console.warn("Prov: pausens lyssnare", err));
}

/**
 * Elevens egen rättning (#741, resultatvyn). Reglerna släpper den först när
 * den lämnats tillbaka; innan dess (nekad) eller utan rättning → null.
 */
export async function hamtaMinRattning(t, uid) {
  try {
    const snap = await getDoc(doc(db, SAMLING_TILLFALLEN, t, RATTNING, uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    if (err?.code === "permission-denied") return null;
    throw err;
  }
}
