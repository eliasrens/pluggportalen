// ============================================================================
// Matchdagen (#869, Etapp 1c): karriären och matcherna i Firestore (spec §6.1–6.2).
// Laddas bara med import() – aldrig i bootgrafen (#271). Reglerna: firestore.rules
// (match /matchdagen/{uid}, validMatchdagen). Kvoten (§13): elevens dokument läses
// EN gång när Matchdagen öppnas, inga lyssnare. Efter en match: EN batch (karriären
// + matcher/{id}). Lärarens historik läses först när läraren klickar på en elev.
//
//   lasKarriar(uid)                       → K | null           1 läsning
//   sparaKarriar(uid, K)                  ny klubb, nytt namn   1 skrivning
//   sparaMatch(uid, K, matchId, match)    efter matchen         1 batch (2 skrivningar)
//   lasMatch(uid, matchId)                en match (Statistik → detaljer)   1 läsning
//   lasKarriarer(uids)                    läraren: en läsning per elev
//   lasMatcher(uid, n)                    läraren: de n senaste matcherna (n läsningar)
//   aterstallLagnamn(uid)                 läraren: bara klubb.namn       1 skrivning
// ============================================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { STANDARD_LAGNAMN } from "./delat/md-namn.js";

const karriarRef = (uid) => doc(db, "matchdagen", uid);
const matchRef = (uid, id) => doc(db, "matchdagen", uid, "matcher", id);

/** Bara karriärens kända fält (aldrig något annat i dokumentet). */
export const KARRIAR_FALT = ["version", "klubb", "div", "sasong", "kassa", "trupp", "liga", "pokaler", "summa", "senaste", "sasonger", "dagar"];
const urval = (K) => Object.fromEntries(KARRIAR_FALT.filter((k) => K[k] !== undefined).map((k) => [k, K[k]]));

export async function lasKarriar(uid) {
  const snap = await getDoc(karriarRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function sparaKarriar(uid, K) {
  await setDoc(karriarRef(uid), { ...urval(K), senast: serverTimestamp() });
}

/**
 * Karriären + matchen i EN batch. Om matchen redan finns (ett tidigare försök
 * gick fram men svaret kom aldrig) sparas bara karriären – matcher kan inte ändras.
 */
export async function sparaMatch(uid, K, matchId, match) {
  const b = writeBatch(db);
  b.set(karriarRef(uid), { ...urval(K), senast: serverTimestamp() });
  b.set(matchRef(uid, matchId), { ...match, datum: serverTimestamp() });
  try {
    await b.commit();
  } catch (err) {
    if (err?.code !== "permission-denied") throw err;
    const finns = await getDoc(matchRef(uid, matchId)).then((s) => s.exists()).catch(() => false);
    if (!finns) throw err;
    await sparaKarriar(uid, K);
  }
}

export async function lasMatch(uid, matchId) {
  const snap = await getDoc(matchRef(uid, matchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function lasKarriarer(uids) {
  const rader = await Promise.all(uids.map((uid) => getDoc(karriarRef(uid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null)));
  return new Map(uids.map((uid, i) => [uid, rader[i]]));
}

export async function lasMatcher(uid, n = 20) {
  const snap = await getDocs(query(collection(db, "matchdagen", uid, "matcher"), orderBy("datum", "desc"), limit(n)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Läraren får BARA ändra klubb.namn (reglerna). */
export async function aterstallLagnamn(uid) {
  await updateDoc(karriarRef(uid), { "klubb.namn": STANDARD_LAGNAMN });
  return STANDARD_LAGNAMN;
}
