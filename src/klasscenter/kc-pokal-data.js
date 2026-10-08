// ============================================================================
// Klasscentret – pokaler mot Firestore (#494, epic #474).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT (import("./klasscenter/kc-pokal-data.js")) – aldrig
// från den statiska bootgrafen (#271: Pages-deployen är inte atomär).
//
// Registret, id-bygget och transaktionen bor i kc-pokal-typer.js; här kopplas
// de bara till webbläsarens SDK. Reglerna: firestore.rules "Pokaler" – bara
// LÄRARE skapar (lärarklienten som avslutar tävlingen/matchen), create-only,
// och bara om källans `result` visar att klassen vann/klarade den.
//
// Anrop från avslutsflödena (sub-issue B), efter att källans `result` skrivits
// (eller i samma skrivning – reglerna läser källan med getAfter):
//   delaUtPokalerFor("mattematchen", cid, { ...tavling, status, result })
//   delaUtPokalerFor("live", sid, { ...session, status, result })
//
// API (aldrig kastande utom hamtaPokaler/bevakaPokaler-felen via onErr)
//   delaUtPokal(classId, typ, kallaId, detalj?)
//       → Promise<{ ok:true, id, ny } | Fel>  create om saknas, tyst om finns
//         (ny:false); Fel.kod "nekad" om reglerna/nätet sa nej
//   delaUtPokalerFor(kalla, kallaId, kallaDoc) → Promise<Resultat[]>
//       alla pokaler källan ger (pokalerUrKalla), en utdelning per klass
//   hamtaPokaler(classId)              → Promise<Pokal[]> (EN query, nyast först)
//   bevakaPokaler(classId, cb, onErr?) → unsubscribe; cb(Pokal[]) i realtid
//   pokalTooltip(pokal)                → re-export ur kc-pokal-typer.js
// ============================================================================

import { auth, db } from "../firebase-config.js";
import {
  collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { korPokalUtdelning, normaliseraPokaler, pokalerUrKalla, pokalTooltip } from "./kc-pokal-typer.js";

export { pokalTooltip };

const sdk = { runTransaction, doc, serverTimestamp };

function pokalCol(classId) {
  return collection(db, "classCenters", classId, "trophies");
}

/** Dela ut en pokal till klassen (idempotent – samma källa = samma dokument). */
export async function delaUtPokal(classId, typ, kallaId, detalj) {
  try {
    return await korPokalUtdelning(sdk, db, { classId, typ, kallaId, detalj, uid: auth.currentUser?.uid || null });
  } catch (err) {
    console.warn("[klasscenter] pokal nekad", classId, typ, kallaId, err?.code || err);
    return { ok: false, kod: "nekad", error: "Pokalen kunde inte delas ut." };
  }
}

/** Alla pokaler en avslutad tävling/match ger, en klass i taget. */
export async function delaUtPokalerFor(kalla, kallaId, kallaDoc) {
  const ut = [];
  for (const p of pokalerUrKalla(kalla, kallaId, kallaDoc)) {
    ut.push({ classId: p.classId, typ: p.typ, ...(await delaUtPokal(p.classId, p.typ, kallaId, p.detalj)) });
  }
  return ut;
}

/** Klassens pokaler (alla inloggade får läsa – gästläget, spec §7). */
export async function hamtaPokaler(classId) {
  const snap = await getDocs(pokalCol(classId));
  return normaliseraPokaler(snap.docs);
}

/** Realtid för pokalhyllan: cb(Pokal[]) vid varje ändring. */
export function bevakaPokaler(classId, cb, onErr) {
  return onSnapshot(pokalCol(classId), (snap) => cb(normaliseraPokaler(snap.docs)), onErr);
}
