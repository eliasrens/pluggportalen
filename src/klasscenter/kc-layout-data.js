// ============================================================================
// Klasscentret – gemensam layout mot Firestore (#489, epic #475).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT (import("./klasscenter/kc-layout-data.js")) – aldrig
// från den statiska bootgrafen (#271: Pages-deployen är inte atomär).
//
// Logiken (validering, ringbuffert, samtidighet, transaktionerna) bor i
// kc-layout-plan.js; här kopplas den bara till webbläsarens SDK. Reglerna:
// firestore.rules "KLASSCENTRET" (layout, layoutHistory, inredningSparr).
// Möbellådan = unlockedItems(getFunds(classId)) – läses före transaktionen
// (ett upplåst föremål låses aldrig igen, så den kan inte bli inaktuell åt
// fel håll).
//
// API
//   subscribeLayout(classId, cb, onErr?) → unsubscribe; cb(Layout) i realtid
//   getLayout(classId)                   → Promise<Layout>
//   saveLayout(classId, placedItems, { forvantadVersion? }?)
//       → Promise<Plan | Fel>  (aldrig kastande; Fel.kod "nekad" om
//         reglerna/nätet sa nej, "krock" om forvantadVersion var inaktuell)
//   listHistory(classId)                 → Promise<HistorikPost[]> (nyast först)
//   restoreLayout(classId, slot, { historikVersion?, forvantadVersion? }?)
//       → Promise<Plan & { aterstalldFran } | Fel>  (blir en NY version;
//         historikVersion = versionen listan visade → Fel.kod
//         "historik-andrad" om ringbufferten skrivit över slotten)
//   kanInreda(classId, uid?)             → Promise<bool> (lärare, eller
//       klassmedlem som inte står i inredningSparr)
//   getInredningSparr(classId)           → Promise<string[]> (klassen + lärare)
//   setInredningSparr(classId, uids)     → Promise<string[]> (bara lärare)
//   Layout/Plan/Fel/HistorikPost: se kc-layout-plan.js
// ============================================================================

import { auth, db } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, isTeacher } from "../auth.js";
import { getFunds, unlockedItems } from "./kc-fund-data.js";
import {
  korSparning, korAterstallning, kanInredaFor, normaliseraLayout, normaliseraHistorik,
  KC_LAYOUT_MAX,
} from "./kc-layout-plan.js";

export { KC_LAYOUT_MAX };

/** Max antal bockade elever (reglernas storleksgräns). */
export const KC_SPARR_MAX = 200;

const sdk = { runTransaction, doc, serverTimestamp };

function currentRef(classId) {
  return doc(db, "classCenters", classId, "layout", "current");
}

// Elevens uid – eller lärarens Auth-uid (läraren har ingen elevsession, #491).
function minUid() {
  return currentStudentId() || auth.currentUser?.uid || null;
}

function profilRef(classId) {
  return doc(db, "classCenters", classId);
}

/** Realtid: klassens layout (ingen sparad än → tom layout, version 0). */
export function subscribeLayout(classId, cb, onErr) {
  return onSnapshot(currentRef(classId), (snap) => cb(normaliseraLayout(snap.exists() ? snap.data() : null)), onErr);
}

export async function getLayout(classId) {
  const snap = await getDoc(currentRef(classId));
  return normaliseraLayout(snap.exists() ? snap.data() : null);
}

async function lada(classId) {
  return unlockedItems(await getFunds(classId));
}

// err.krock (kc-omforsok.js): false = reglerna sa nej på riktigt (spärrad
// eller inte klassmedlem), true = för många samtidiga sparningar.
function nekad(vad, classId, err) {
  console.warn(`[klasscenter] ${vad} nekad`, classId, err?.code || err);
  const error = err?.krock === false
    ? "Du får inte inreda klassens rum just nu."
    : err?.krock === true
      ? "Många sparar rummet just nu – vänta en liten stund och försök igen."
      : "Det gick inte att spara rummet. Försök igen.";
  return { ok: false, kod: "nekad", error };
}

/**
 * "Spara": skriver layout/current (version + 1) och historikslot
 * `version % 10` i EN transaktion. Samtidiga sparningar: senaste vinner,
 * båda hamnar i historiken (se kc-layout-plan.js).
 */
export async function saveLayout(classId, placedItems, { forvantadVersion } = {}) {
  try {
    return await korSparning(sdk, db, {
      classId, uid: minUid(), placedItems, lada: await lada(classId), forvantadVersion,
    });
  } catch (err) {
    return nekad("layout", classId, err);
  }
}

/** Historiken (upp till 10 sparningar), nyast först. */
export async function listHistory(classId) {
  const snap = await getDocs(collection(db, "classCenters", classId, "layoutHistory"));
  return normaliseraHistorik(snap.docs);
}

/** "Återställ": kopierar slot → current som en NY version (kan ångras). */
export async function restoreLayout(classId, slot, { historikVersion, forvantadVersion } = {}) {
  try {
    return await korAterstallning(sdk, db, {
      classId, uid: minUid(), slot, historikVersion, lada: await lada(classId), forvantadVersion,
    });
  } catch (err) {
    return nekad("återställning", classId, err);
  }
}

/** Lärarens bockade elever (får titta/donera men inte inreda). */
export async function getInredningSparr(classId) {
  const snap = await getDoc(profilRef(classId));
  const s = snap.exists() ? snap.data().inredningSparr : null;
  return Array.isArray(s) ? s.filter((u) => typeof u === "string") : [];
}

/** Får `uid` inreda klassens rum? (UI-grind; reglerna avgör på riktigt.) */
export async function kanInreda(classId, uid = currentStudentId()) {
  if (isTeacher()) return true;
  if (!classId || !uid) return false;
  try {
    const klass = await getDoc(doc(db, "classes", classId));
    const studentIds = klass.exists() ? klass.data().studentIds : [];
    // Gäst: klassprofilen (spärrlistan) är bara läsbar för klassen (#500).
    if (!kanInredaFor({ uid, studentIds })) return false;
    return kanInredaFor({ uid, studentIds, inredningSparr: await getInredningSparr(classId) });
  } catch (err) {
    console.warn("[klasscenter] kanInreda", classId, err?.code || err);
    return false;
  }
}

/** Lärare: ersätt listan över elever som inte får inreda (unika, sorterade). */
export async function setInredningSparr(classId, uids) {
  const lista = [...new Set((uids || []).filter((u) => typeof u === "string" && u))].sort();
  if (lista.length > KC_SPARR_MAX) throw new Error(`Högst ${KC_SPARR_MAX} elever kan bockas ur.`);
  await setDoc(profilRef(classId), { inredningSparr: lista }, { merge: true });
  return lista;
}
