// ============================================================================
// Elevens myntskrivning MED dagskvitto (#855): sedan myntlåset (SAKERHET-MYNT
// §6 B3) får eleven bara höja coins ihop med myntDag/{idag} i samma begäran.
// Regeltester som behöver "en vanlig myntskrivning" använder den här batchen
// i stället för en ren `coins: increment(n)` (som nu nekas). Samma form som
// data-mynt.js tjanaMynt skriver (källan ekv, utan xp).
// ============================================================================

import { doc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { MYNT_DAG_KVITTON, myntDag } from "../../src/mynt-dag.js";

/** Batch: myntDag/{idag} ekv + n och studentData.coins + n (n ≤ 7, ekv:s tak per gång). */
export function myntMedKvitto(db, uid, n = 1, extra = {}) {
  const dag = myntDag(Date.now());
  const b = writeBatch(db);
  b.set(doc(db, "studentData", uid, MYNT_DAG_KVITTON, dag),
    { dag, kalla: "ekv", lastAt: serverTimestamp(), senastMynt: n, senastXp: 0, ekv: increment(n) }, { merge: true });
  b.update(doc(db, "studentData", uid), { coins: increment(n), ...extra });
  return b.commit();
}
