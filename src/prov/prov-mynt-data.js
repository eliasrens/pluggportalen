// ============================================================================
// Prov (#746, spec §11): Pluggmynt, Firestore-sidan – som live-rewards-data.js.
// Laddas bara DYNAMISKT av rättningslagret (prov-ratta-lager.js) när
// tillfället delar ut mynt – aldrig i bootgrafen. Logiken och idempotensen:
// prov-mynt-pay.js.
//
// API
//   betalaMynt(tf, elever) → Promise<[{ uid, total, status }]>
//       betala ut det som inte redan betalats för de tillbakalämnade eleverna.
//       Idempotent och aldrig kastande – säkert att anropa hur ofta som helst.
// ============================================================================

import { auth, db } from "../firebase-config.js";
import {
  doc, getDoc, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { defaultStudentData, invalidateStudentData } from "../data.js";
import { betalaProvMynt } from "./prov-mynt-pay.js";

const sdk = { doc, getDoc, runTransaction, serverTimestamp };

export async function betalaMynt(tf, elever) {
  try {
    if (!elever?.length) return [];
    const ut = await betalaProvMynt(sdk, db, {
      t: tf.id, tf, elever, by: auth.currentUser?.uid || null, defaults: () => defaultStudentData(),
    });
    for (const r of ut) {
      if (r.status === "betald") invalidateStudentData(r.uid);
      if (r.status === "nekad") console.warn("[prov] Pluggmynt nekades", tf.id, r.uid, r.fel);
    }
    return ut;
  } catch (err) {
    console.warn("[prov] Pluggmynt hoppades över", tf.id, err?.code || err);
    return [];
  }
}
