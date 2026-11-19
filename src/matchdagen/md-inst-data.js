// ============================================================================
// Matchdagen – inställningarna per elev i Firestore (src/matchdagen/md-inst-data.js) · #867
// ----------------------------------------------------------------------------
// Laddas bara med import() (lärarens Anpassningar per elev, elevens Matchdagen-sida)
// – aldrig i bootgrafen (#271). Formen: md-inst.js. Reglerna: firestore.rules
// (validElevModuler, match /matchdagenInst/{uid}).
//
//   lasInst(uid)                       EN getDoc av matchdagenInst/{uid} → normaliserad eller null
//   sparaAnpassning(cls, uid, o)       EN batch: classes/{id}.elevModuler (på/av) +
//                                      matchdagenInst/{uid} (inställningarna)
// ============================================================================

import { auth, db } from "../firebase-config.js";
import { doc, getDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearClassCache } from "../data-classes.js";
import { normalizeInst, nyaElevModuler } from "./md-inst.js";

/** Elevens inställningar (null om läraren inte sparat några än). */
export async function lasInst(uid) {
  const snap = await getDoc(doc(db, "matchdagenInst", uid));
  return snap.exists() ? normalizeInst(snap.data()) : null;
}

/**
 * Spara lärarens val för en elev i EN batch (båda eller inget).
 * @param {object} cls   klassdokumentet (muteras: cls.elevModuler)
 * @param {string} uid
 * @param {{pa:boolean, inst:object}} o
 * @returns {Promise<object>} den sparade (normaliserade) inställningen
 */
export async function sparaAnpassning(cls, uid, { pa, inst }) {
  const elevModuler = nyaElevModuler(cls, uid, pa);
  const sparad = normalizeInst(inst);
  const b = writeBatch(db);
  b.update(doc(db, "classes", cls.id), { elevModuler });
  b.set(doc(db, "matchdagenInst", uid), { ...sparad, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || "" });
  await b.commit();
  cls.elevModuler = elevModuler;
  clearClassCache(); // elevens meny och lärarens klasslista läser om klassen
  return sparad;
}
