// ============================================================================
// Bråkresan – lärarvyns dataskikt (src/brakresan/larare/data-larare.js) · K #716
// ----------------------------------------------------------------------------
// Laddas bara LAT från lärarvyn – aldrig i bootgrafen (#271). Läsningar för
// läraren (firestore.rules: hasStudent/hasClass) och lärarens enda skrivning i
// Bråkresan: rekommendationerna (brakresaRecommendations). Elevernas resultat,
// stjärnor, mynt och drake skrivs bara av Cloud Functions – inget här rör dem.
//
// KVOT (#231): klassöversikten och matrisen läser ETT state-dokument per elev
// (getClassStates i ../data.js). Omgångar och stjärnhändelser läses först när
// läraren öppnar EN elev.
//
//   loadClass(studentIds)            → Map(id → state | null)
//   listRounds(studentId, { challengeId?, fran?, limit? }) → omgångar, nyast först
//   listStarEvents(studentId)        → stjärnhändelserna (progression över tid)
//   listRecs({ classId?, studentIds? }) → aktiva rekommendationer (klass + elever)
//   createRec({ classId | studentId, challengeIds, comment })
//   endRec(id)                       → active: false (klassrekommendation)
//   deleteRec(id)                    → tas bort (individrekommendation)
// ============================================================================

import { auth, db } from "../../firebase-config.js";
import {
  addDoc, collection, deleteDoc, doc, getDocs, limit as qLimit, orderBy, query, serverTimestamp,
  updateDoc, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ms, recDokument } from "./statistik.js";

export async function loadClass(studentIds) {
  return (await import("../data.js")).getClassStates(studentIds);
}

const omgangar = (studentId) => collection(db, "studentData", studentId, "brakresaRounds");

/**
 * Elevens omgångar (alla statusar), nyast först. Med `challengeId` används bara
 * likhetsfiltret (inget nytt index) och sorteringen sker här; med `fran` (ms)
 * filtreras startedAt på servern.
 */
export async function listRounds(studentId, { challengeId = null, fran = null, limit = 20 } = {}) {
  let q;
  if (challengeId) q = query(omgangar(studentId), where("challengeId", "==", challengeId), qLimit(60));
  else if (fran) q = query(omgangar(studentId), where("startedAt", ">=", new Date(fran)), orderBy("startedAt", "desc"), qLimit(limit));
  else q = query(omgangar(studentId), orderBy("startedAt", "desc"), qLimit(limit));
  const lista = (await getDocs(q)).docs.map((d) => ({ roundId: d.id, ...d.data() }));
  return lista
    .filter((r) => !fran || (ms(r.startedAt) ?? 0) >= fran)
    .sort((a, b) => (ms(b.startedAt) ?? 0) - (ms(a.startedAt) ?? 0))
    .slice(0, limit);
}

export async function listStarEvents(studentId) {
  const col = collection(db, "studentData", studentId, "brakresaRewards");
  return (await getDocs(query(col, where("type", "==", "stjarna")))).docs.map((d) => d.data());
}

// --- rekommendationer -------------------------------------------------------------

const recs = () => collection(db, "brakresaRecommendations");
const lasa = (q) => getDocs(q).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));

/**
 * Aktiva rekommendationer för klassen och (valfritt) klassens elever. Reglerna
 * kräver att frågan filtrerar på classId resp. studentId – därför en fråga per
 * elev. Läses bara när läraren öppnar rekommendationerna eller en elev.
 */
export async function listRecs({ classId = null, studentIds = [] } = {}) {
  const fragor = [
    ...(classId ? [query(recs(), where("classId", "==", classId), where("active", "==", true))] : []),
    ...studentIds.map((id) => query(recs(), where("studentId", "==", id), where("active", "==", true))),
  ];
  const svar = await Promise.all(fragor.map((q) => lasa(q).catch(() => [])));
  return svar.flat().sort((a, b) => (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0));
}

export async function createRec(rec) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Du är inte inloggad.");
  const d = { ...recDokument(rec, uid), createdAt: serverTimestamp() };
  const ref = await addDoc(recs(), d);
  return { id: ref.id, ...d, createdAt: Date.now() };
}

export const endRec = (id) => updateDoc(doc(db, "brakresaRecommendations", id), { active: false, endedAt: serverTimestamp() });
export const deleteRec = (id) => deleteDoc(doc(db, "brakresaRecommendations", id));

/** Standardbryggan; vyerna tar ett injicerbart api (förhandsvisning, tester). */
export const API = { loadClass, listRounds, listStarEvents, listRecs, createRec, endRec, deleteRec };
