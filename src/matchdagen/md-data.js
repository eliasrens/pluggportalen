// ============================================================================
// Matchdagen (#869, Etapp 1c): karriären och matcherna i Firestore (spec §6.1–6.2).
// Laddas bara med import() – aldrig i bootgrafen (#271). Reglerna: firestore.rules
// (match /matchdagen/{uid}, validMatchdagen). Kvoten (§13): elevens dokument läses
// EN gång när Matchdagen öppnas, inga lyssnare. Efter en match: EN batch (karriären
// + matcher/{id}). Lärarens historik läses först när läraren klickar på en elev.
//
//   lasKarriar(uid)                       → K | null           1 läsning
//   sparaKarriar(uid, K)                  ny klubb, nytt namn   1 skrivning (hela dokumentet)
//   sparaMatch(uid, K, matchId, match)    efter matchen         1 batch (2 skrivningar) – rör inte klubb
//   sparaTrupp(uid, K)                    köp, byte, träningsläger (#871)  1 skrivning – rör inte klubb
//
// Varje skrivning har en tidsgräns (TIDSGRANS_MS): offline löser Firestore aldrig
// skrivningens promise, och då ska rutan efter matchen och sidan inte hänga. Matchen
// ligger redan i den lokala kön (md-lokal.js) och skrivningen går fram när nätet är tillbaka.
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
import { forstaDokument, pokalerFranDok, pokalerTillDok } from "./delat/md-sasong.js";
import { marknadFranDok, marknadTillDok } from "./delat/md-trupp.js";

const karriarRef = (uid) => doc(db, "matchdagen", uid);
export const TIDSGRANS_MS = 8000;

/** p eller ett fel med code "timeout" efter ms – Firestores skrivningar löses aldrig offline. */
export function medTidsgrans(p, ms = TIDSGRANS_MS) {
  let t = 0;
  const grans = new Promise((_, nej) => {
    t = setTimeout(() => nej(Object.assign(new Error("Ingen kontakt med servern"), { code: "timeout" })), ms);
  });
  return Promise.race([p, grans]).finally(() => clearTimeout(t));
}
const matchRef = (uid, id) => doc(db, "matchdagen", uid, "matcher", id);

/** Bara karriärens kända fält (aldrig något annat i dokumentet). */
export const KARRIAR_FALT = ["version", "klubb", "div", "sasong", "kassa", "trupp", "reserver", "marknad", "lager", "liga", "kval", "cup", "pokaler", "rekord", "summa", "senaste", "sasonger", "dagar", "mastarcup", "klubbhistorik"];
// Marknaden sparas som rader "id|namn|pos|nr|st" (md-trupp.js marknadTillDok) och pokalerna som rader
// "typ|namn|säsong|datum" (md-sasong.js pokalerTillDok, #872) – reglerna prövar dem billigt. cup och rekord är redan text.
const TILL_DOK = { marknad: marknadTillDok, pokaler: pokalerTillDok };
const urval = (K, falt = KARRIAR_FALT) => Object.fromEntries(falt.filter((k) => K[k] !== undefined)
  .map((k) => [k, TILL_DOK[k] ? TILL_DOK[k](K[k]) : K[k]]));
/** Matchsparningen skriver allt UTOM klubb – lärarens Återställ lagnamn får inte skrivas över. */
const MATCH_FALT = KARRIAR_FALT.filter((k) => k !== "klubb");

export async function lasKarriar(uid) {
  const snap = await medTidsgrans(getDoc(karriarRef(uid)), 2 * TIDSGRANS_MS);
  return snap.exists() ? franDok(snap.data()) : null;
}
export const franDok = (d) => (d && typeof d === "object" ? { ...d, marknad: marknadFranDok(d.marknad), pokaler: pokalerFranDok(d.pokaler) } : d);

export async function sparaKarriar(uid, K) {
  await medTidsgrans(setDoc(karriarRef(uid), { ...urval(K), senast: serverTimestamp() }));
}

/** Karriären utan klubb (mergeFields = bara de skickade fälten ersätts). */
const utanKlubb = (K) => ({ ...urval(K, MATCH_FALT), senast: serverTimestamp() });
function karriarIBatch(b, uid, K) {
  const data = utanKlubb(K);
  b.set(karriarRef(uid), data, { mergeFields: Object.keys(data) });
}

/** Köp, byte eller träningsläger (#871, §6.2): EN skrivning av karriären utan klubb. */
export async function sparaTrupp(uid, K) {
  const data = utanKlubb(K);
  await medTidsgrans(setDoc(karriarRef(uid), data, { mergeFields: Object.keys(data) }));
}

/**
 * Karriären (utan klubb) + matchen i EN batch. Nekas den läses de två dokumenten:
 *   • matchen finns redan (ett tidigare försök gick fram men svaret kom aldrig) →
 *     bara karriären sparas – matcher kan inte ändras;
 *   • karriären finns inte (den nya klubben hann aldrig sparas) → klubben skapas
 *     först som ny (reglerna skapar bara en klubb från noll, #871), sedan batchen igen.
 */
export async function sparaMatch(uid, K, matchId, match, skapad = false) {
  const b = writeBatch(db);
  karriarIBatch(b, uid, K);
  b.set(matchRef(uid, matchId), { ...match, datum: serverTimestamp() });
  try {
    await medTidsgrans(b.commit());
  } catch (err) {
    if (err?.code !== "permission-denied") throw err;
    const finns = (ref) => medTidsgrans(getDoc(ref)).then((s) => s.exists()).catch(() => null);
    const [matchFinns, karriarFinns] = await Promise.all([finns(matchRef(uid, matchId)), finns(karriarRef(uid))]);
    if (karriarFinns === false && !skapad) {
      await sparaKarriar(uid, forstaDokument(K));
      return sparaMatch(uid, K, matchId, match, true);
    }
    if (!matchFinns) throw err;
    const b2 = writeBatch(db);
    karriarIBatch(b2, uid, K);
    await medTidsgrans(b2.commit());
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
