// ============================================================================
// Pluggporten – klass-lås / fokusläge (issue #436): persistens + server-klocka
// ----------------------------------------------------------------------------
// setClassLock / clearClassLock / getClassLock skriver/läser classes/{id}.lock
// (formen + semantiken bor i class-lock.js). Bor i en EGEN fil i stället för i
// data-classes.js: den är fullt (400-raderstaket) och ligger i den statiska
// bootgrafen – den här filen laddas bara DYNAMISKT (lärarpanelen och elevens
// lås-bevakare, class-lock-watch.js), så bootgrafen växer inte (incident #271).
//
// serverNow(): klientens klocka korrigerad mot serverns (HTTP Date + Age på en
// HEAD mot sajten). Både lärarens "klockslaget måste ligga framåt" och elevens
// "har låset gått ut?" jämför mot den, så en elevdator som går fel inte släpper
// låset för tidigt (eller håller kvar det). Reglerna validerar dessutom `till`
// mot request.time, så ingen klient kan spara ett lås längre än MAX_LOCK_MS.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearClassCache } from "./data-classes.js";
import { normalizeLock } from "./class-lock.js";

// --- Server-klockan -----------------------------------------------------------

let offset = 0; // serverns tid − klientens tid (ms); 0 tills synkad
let klockaP = null;

/** Klientens tid korrigerad mot serverns (ms). */
export function serverNow() {
  return Date.now() + offset;
}

/**
 * Mät klock-avvikelsen EN gång per session (HEAD mot sajten, ingen
 * Firestore-läsning). Fel/saknad header → offset 0 (lita på klientklockan).
 * Avvikelser under 5 s ignoreras (Date-headern har sekundupplösning).
 */
export function syncServerClock() {
  if (klockaP) return klockaP;
  klockaP = (async () => {
    try {
      const t0 = Date.now();
      const res = await fetch(location.href.split("#")[0], { method: "HEAD", cache: "no-store" });
      const t1 = Date.now();
      const datum = Date.parse(res.headers.get("Date") || "");
      if (!Number.isFinite(datum)) return offset;
      // Ett CDN-cachat svar bär ursprungets Date + Age (sekunder sedan dess).
      const age = Number(res.headers.get("Age")) || 0;
      const est = datum + age * 1000 + 500 - (t0 + t1) / 2;
      offset = Math.abs(est) > 5000 ? Math.round(est) : 0;
    } catch {}
    return offset;
  })();
  return klockaP;
}

// --- Persistens ----------------------------------------------------------------

/**
 * Lås klassen (ersätter ev. tidigare lås HELT – updateDoc på fältet, inte en
 * djup merge, så ett gammalt mal.id aldrig blir kvar).
 * @param {string} classId
 * @param {{mal:{typ:string,id?:string,namn?:string}, till:number, doljOvrigt:boolean}} lock
 * @returns {Promise<object>} det sparade (normaliserade) låset
 */
export async function setClassLock(classId, lock) {
  const clean = normalizeLock(lock);
  if (!clean) throw new Error("Ogiltigt lås (mål eller sluttid saknas).");
  await updateDoc(doc(db, "classes", classId), { lock: clean });
  clearClassCache();
  return clean;
}

/** Lås upp klassen direkt (fältet tas bort – allt som förut). */
export async function clearClassLock(classId) {
  await updateDoc(doc(db, "classes", classId), { lock: deleteField() });
  clearClassCache();
}

/** Klassens lås som det ligger lagrat (normaliserat, ev. redan utgånget) eller null. */
export async function getClassLock(classId) {
  const snap = await getDoc(doc(db, "classes", classId));
  return snap.exists() ? normalizeLock(snap.data().lock) : null;
}
