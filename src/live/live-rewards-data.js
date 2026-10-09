// ============================================================================
// Live – Pluggmynt efter matchen, Firestore-sidan (#557). Laddas bara
// DYNAMISKT (live-data writeResultIfMissing, historiken) – aldrig i bootgrafen.
// Logiken och idempotensen: live-rewards-pay.js.
//
// API
//   settleLiveRewards(sid, session) → Promise<[{ uid, total, status }]>
//       betala ut det sparade result.rewards som inte redan betalats.
//       Idempotent och aldrig kastande – säkert att anropa hur ofta som helst.
//   getMyReceipt(sid, uid) → Promise<kvitto | null> (elevens eget)
// ============================================================================

import { auth, db } from "../firebase-config.js";
import {
  doc, getDoc, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { defaultStudentData, invalidateStudentData } from "../data.js";
import { payLiveRewards, RECEIPTS } from "./live-rewards-pay.js";
import { payoutList } from "./live-rewards.js";

const sdk = { doc, getDoc, runTransaction, serverTimestamp };

export async function settleLiveRewards(sid, session) {
  try {
    if (!payoutList(sid, session).length) return [];
    const ut = await payLiveRewards(sdk, db, {
      sid, session, uid: auth.currentUser?.uid || null, defaults: () => defaultStudentData(),
    });
    for (const r of ut) {
      if (r.status === "betald") invalidateStudentData(r.uid);
      if (r.status === "nekad") console.warn("[live] Pluggmynt nekades", sid, r.uid, r.fel);
    }
    return ut;
  } catch (err) {
    console.warn("[live] Pluggmynt hoppades över", sid, err?.code || err);
    return [];
  }
}

export async function getMyReceipt(sid, uid) {
  const snap = await getDoc(doc(db, "liveSessions", sid, RECEIPTS, uid));
  return snap.exists() ? snap.data() : null;
}
