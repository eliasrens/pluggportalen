// ============================================================================
// Klasscentret – klasskassan mot Firestore (#526).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT – aldrig från den statiska bootgrafen (#271).
// Logiken (prisandelar, cappning, skrivplanerna) bor i kc-kassa-plan.js; här
// kopplas den bara till webbläsarens SDK. Reglerna: firestore.rules
// "Klasskassan" (kassa, kassaHistorik, donations kassa:true, kassorer).
//
// API
//   subscribeKassa(classId, cb, onErr?)          → unsub; cb(saldo)
//   subscribeKassaHistorik(classId, cb, onErr?)  → unsub; cb(poster nyast först, max 30)
//   laggFranKassan(classId, itemId, amount)      → Promise<Plan & { txId } | Fel>
//       (aldrig kastande; Fel.kod "nekad" om reglerna/nätet sa nej)
//   livePrisTillKassan(sid, session)             → Promise<[{ classId, belopp, status }]>
//       (lärarklienten efter att result skrivits; idempotent)
//   getKassorer(classId)                         → Promise<string[]> (klassen + lärare)
//   setKassorer(classId, uids)                   → Promise<string[]> (bara lärare)
// ============================================================================

import { auth, db } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocFromServer, increment, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "../auth.js";
import { kassaSaldo, korKassaUt, korLivePris, normaliseraHistorik } from "./kc-kassa-plan.js";

/** Max antal kassörer per klass (reglernas storleksgräns). */
export const KC_KASSORER_MAX = 50;

const sdk = { doc, collection, getDoc, getDocFromServer, writeBatch, increment, serverTimestamp };

// Elevens uid – eller lärarens Auth-uid (läraren har ingen elevsession, #491).
function minUid() {
  return currentStudentId() || auth.currentUser?.uid || null;
}

export function subscribeKassa(classId, cb, onErr) {
  return onSnapshot(doc(db, "classCenters", classId, "kassa", "saldo"),
    (snap) => cb(kassaSaldo(snap.exists() ? snap.data() : null)), onErr);
}

export function subscribeKassaHistorik(classId, cb, onErr) {
  const q = query(collection(db, "classCenters", classId, "kassaHistorik"), orderBy("at", "desc"), limit(30));
  return onSnapshot(q, (snap) => cb(normaliseraHistorik(snap.docs)), onErr);
}

/** Kassör/lärare lägger mynt ur klasskassan på ett föremål (cappas som en donation). */
export async function laggFranKassan(classId, itemId, amount) {
  try {
    return await korKassaUt(sdk, db, { classId, uid: minUid(), itemId, amount });
  } catch (err) {
    console.warn("[klasscenter] uttag ur klasskassan nekat", classId, itemId, err?.code || err);
    const text = err?.krock === true
      ? "Många lägger pengar just nu – vänta en liten stund och försök igen."
      : err?.krock === false
        ? "Det gick inte – bara klassens kassörer och läraren kan lägga från klasskassan."
        : "Det gick inte igenom. Försök igen.";
    return { ok: false, kod: "nekad", error: text };
  }
}

/** Matchens mynt-pris till vinnarklassernas kassor (se korLivePris). */
export function livePrisTillKassan(sid, session) {
  return korLivePris(sdk, db, { sid, session, uid: auth.currentUser?.uid || null });
}

export async function getKassorer(classId) {
  const snap = await getDoc(doc(db, "classCenters", classId));
  const k = snap.exists() ? snap.data().kassorer : null;
  return Array.isArray(k) ? k.filter((u) => typeof u === "string") : [];
}

/** Lärare: ersätt listan över klasskassörer (unika, sorterade). */
export async function setKassorer(classId, uids) {
  const lista = [...new Set((uids || []).filter((u) => typeof u === "string" && u))].sort();
  if (lista.length > KC_KASSORER_MAX) throw new Error(`Högst ${KC_KASSORER_MAX} kassörer.`);
  await setDoc(doc(db, "classCenters", classId), { kassorer: lista }, { merge: true });
  return lista;
}
