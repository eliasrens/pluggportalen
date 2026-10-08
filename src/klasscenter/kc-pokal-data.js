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
//   delaUtLasresanMilstolpar(classId, { antal?, tvinga? })
//       → Promise<{ antal, nya: number[] }>  #528: läser klassens 5 shards
//         (sumLasresan) och delar ut varje nådd milstolpe som saknas (tvinga
//         = hoppa över spärren). Lärare; idempotent; en gång per klass/5 min/flik.
//   delaUtLararPokal(classId, { motiv, titel, text }) → Promise<{ ok, id } | Fel>  #528
//   taBortLararPokal(classId, trophyId)  → Promise<{ ok } | Fel>  bara typ "larare"
//   hamtaPokaler(classId)              → Promise<Pokal[]> (EN query, nyast först)
//   bevakaPokaler(classId, cb, onErr?) → unsubscribe; cb(Pokal[]) i realtid
//   pokalTooltip(pokal)                → re-export ur kc-pokal-typer.js
// ============================================================================

import { auth, db } from "../firebase-config.js";
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  korPokalUtdelning, lasresanMilstolpar, normaliseraPokaler, planLararPokal, pokalerUrKalla, pokalTooltip,
} from "./kc-pokal-typer.js";
import { sumLasresan } from "./kc-exp-skriv.js";

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

const SENAST_MS = 5 * 60 * 1000;
const senastKollad = new Map(); // classId → ms (milstolpskollen, per flik)

/**
 * Läsresan-milstolparna (#528). Bara LÄRARE kan dela ut (reglerna) – anropas
 * när läraren öppnar klassen/Klasscentret. antal (valfritt) = redan läst
 * summa; annars läses klassens shards. Aldrig kastande.
 */
export async function delaUtLasresanMilstolpar(classId, { antal, tvinga = false } = {}) {
  const ut = { antal: 0, nya: [] };
  try {
    if (!classId || !auth.currentUser) return ut;
    if (!tvinga && Date.now() - (senastKollad.get(classId) || 0) < SENAST_MS) return ut;
    senastKollad.set(classId, Date.now());
    ut.antal = antal ?? sumLasresan((await getDocs(collection(db, "classCenters", classId, "expShards"))).docs.map((d) => d.data()));
    for (const m of lasresanMilstolpar(ut.antal)) {
      const r = await delaUtPokal(classId, "lasresan-milstolpe", String(m));
      if (r.ok && r.ny) ut.nya.push(m);
    }
  } catch (err) {
    console.warn("[klasscenter] Läsresan-milstolpar hoppades över", classId, err?.code || err);
  }
  return ut;
}

/** Lärarens egen pokal till klassen (#528). */
export async function delaUtLararPokal(classId, { motiv, titel, text } = {}) {
  const plan = planLararPokal({ motiv, titel, text, uid: auth.currentUser?.uid || null, fv: { serverTimestamp } });
  if (!plan.ok) return plan;
  try {
    await setDoc(doc(db, "classCenters", classId, "trophies", plan.id), plan.data);
    return { ok: true, id: plan.id };
  } catch (err) {
    console.warn("[klasscenter] lärarpokalen nekades", classId, err?.code || err);
    return { ok: false, kod: "nekad", error: "Pokalen kunde inte delas ut." };
  }
}

/** Ta bort en av lärarens egna pokaler (reglerna: bara typ "larare"). */
export async function taBortLararPokal(classId, trophyId) {
  try {
    await deleteDoc(doc(db, "classCenters", classId, "trophies", trophyId));
    return { ok: true };
  } catch (err) {
    console.warn("[klasscenter] pokalen kunde inte tas bort", classId, trophyId, err?.code || err);
    return { ok: false, kod: "nekad", error: "Pokalen kunde inte tas bort." };
  }
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
