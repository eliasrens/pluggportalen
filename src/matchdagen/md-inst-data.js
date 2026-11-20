// ============================================================================
// Matchdagen – inställningarna per elev i Firestore (src/matchdagen/md-inst-data.js) · #867
// ----------------------------------------------------------------------------
// Laddas bara med import() (lärarens Anpassningar per elev, elevens Matchdagen-sida)
// – aldrig i bootgrafen (#271). Formen: md-inst.js. Reglerna: firestore.rules
// (validElevModuler, match /matchdagenInst/{uid}).
//
//   lasInst(uid)                       EN getDoc av matchdagenInst/{uid} → normaliserad eller null
//   sparaAnpassning(cls, uid, o)       EN batch: classes/{id}.elevModuler (på/av) +
//                                      matchdagenInst/{uid} (inställningarna; inst null = rör dem inte)
//   foljKlassen(uid)                   raderar matchdagenInst/{uid} → eleven får klassens (#876)
//   sparaKlass(cls, o)                 EN skrivning: classes/{id}.enabledModules + .matchdagenInst (#876)
//   sparaElevModuler(cls, uids, pa)    EN skrivning: classes/{id}.elevModuler för flera elever (#876)
// ============================================================================

import { auth, db } from "../firebase-config.js";
import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearClassCache } from "../data-classes.js";
import { normalizeInst, nyaElevModuler, nyaEnabledModules } from "./md-inst.js";

/** Elevens inställningar (null om läraren inte sparat några än). */
export async function lasInst(uid) {
  const snap = await getDoc(doc(db, "matchdagenInst", uid));
  return snap.exists() ? normalizeInst(snap.data()) : null;
}

const stampel = () => ({ updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || "" });

/**
 * Spara lärarens val för en elev i EN batch (båda eller inget). inst null (#876) =
 * bara på/av – eleven fortsätter med klassens inställningar.
 * @param {object} cls   klassdokumentet (muteras: cls.elevModuler)
 * @param {string} uid
 * @param {{pa:boolean, inst:object|null}} o
 * @returns {Promise<object|null>} den sparade (normaliserade) inställningen
 */
export async function sparaAnpassning(cls, uid, { pa, inst }) {
  const elevModuler = nyaElevModuler(cls, uid, pa);
  const sparad = inst ? normalizeInst(inst) : null;
  const b = writeBatch(db);
  b.update(doc(db, "classes", cls.id), { elevModuler });
  if (sparad) b.set(doc(db, "matchdagenInst", uid), { ...sparad, ...stampel() });
  await b.commit();
  cls.elevModuler = elevModuler;
  clearClassCache(); // elevens meny och lärarens klasslista läser om klassen
  return sparad;
}

/** Ta bort elevens egna inställningar – eleven spelar sedan med klassens (#876). */
export async function foljKlassen(uid) {
  await deleteDoc(doc(db, "matchdagenInst", uid));
}

/**
 * Hela klassen (#876): Matchdagen på/av (enabledModules) och klassens inställningar
 * (matchdagenInst på klassdokumentet) i EN skrivning.
 * @param {object} cls  klassdokumentet (muteras: enabledModules, matchdagenInst)
 * @param {{pa:boolean, inst:object}} o
 * @returns {Promise<object>} den sparade (normaliserade) inställningen
 */
export async function sparaKlass(cls, { pa, inst }) {
  const enabledModules = nyaEnabledModules(cls, pa);
  const sparad = normalizeInst(inst);
  await updateDoc(doc(db, "classes", cls.id), { enabledModules, matchdagenInst: { ...sparad, ...stampel() } });
  cls.enabledModules = enabledModules;
  cls.matchdagenInst = sparad;
  clearClassCache();
  return sparad;
}

/** "Välj alla" (#876): Matchdagen på/av för flera elever i EN skrivning av elevModuler. */
export async function sparaElevModuler(cls, uids, pa) {
  const elevModuler = nyaElevModuler(cls, uids, pa);
  await updateDoc(doc(db, "classes", cls.id), { elevModuler });
  cls.elevModuler = elevModuler;
  clearClassCache();
}
