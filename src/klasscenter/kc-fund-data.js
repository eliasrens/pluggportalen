// ============================================================================
// Klasscentret – crowdfunding mot Firestore (#486, epic #475).
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT (import("./klasscenter/kc-fund-data.js")) – aldrig
// från den statiska bootgrafen (#271: Pages-deployen är inte atomär).
//
// Logiken (cappning, skrivplan, transaktionen) bor i kc-fund-plan.js; här
// kopplas den bara till webbläsarens SDK. Reglerna: firestore.rules
// "KLASSCENTRET" (fund + donations). Donationer är anonyma för klassen –
// bara läraren läser donationsposterna (listDonations).
//
// API
//   donate(classId, itemId, amount)   → Promise<Plan & { donationId } | Fel>
//       (aldrig kastande; Fel.kod "nekad" om reglerna/nätet sa nej)
//   getFunds(classId)                 → Promise<{ [itemId]: Fund }>
//   subscribeFunds(classId, cb, onErr?) → unsubscribe; cb({ [itemId]: Fund })
//   listDonations(classId)            → Promise<Donation[]> (lärare; nyast först)
//   unlockedItems(funds)              → möbellådan (re-export ur kc-fund-plan.js)
//   Fund = { itemId, targetPrice, fundedAmount, isUnlocked, unlockedAt }
//   Donation = { id, uid, itemId, amount, at }
// ============================================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, invalidateStudentData } from "../data.js";
import { korDonation, normaliseraFunds, unlockedItems } from "./kc-fund-plan.js";

export { unlockedItems };

const sdk = { runTransaction, doc, collection, serverTimestamp };

function fundCol(classId) {
  return collection(db, "classCenters", classId, "fund");
}

/**
 * Elevens donation till ett föremål. Beloppet cappas till det som saknas och
 * till saldot (resultatets `amount`/`cappat`). EN transaktion: mynt dras,
 * donationspost skapas och fund ökar – eller ingenting.
 */
export async function donate(classId, itemId, amount) {
  const uid = currentStudentId();
  try {
    const res = await korDonation(sdk, db, { classId, uid, itemId, amount });
    if (res.ok) invalidateStudentData(uid); // saldot ändrat → färsk läsning (#274)
    return res;
  } catch (err) {
    console.warn("[klasscenter] donation nekad", classId, itemId, err?.code || err);
    return { ok: false, kod: "nekad", error: "Donationen gick inte igenom. Försök igen." };
  }
}

/** Alla föremåls insamling för klassen (hela katalogen, saknat = 0). */
export async function getFunds(classId) {
  const snap = await getDocs(fundCol(classId));
  return normaliseraFunds(snap.docs);
}

/** Realtid för mätarna ("150 / 5000"): cb vid varje ändring i klassens fund. */
export function subscribeFunds(classId, cb, onErr) {
  return onSnapshot(fundCol(classId), (snap) => cb(normaliseraFunds(snap.docs)), onErr);
}

/** Lärarens lista över donationer (reglerna nekar elever). Nyast först. */
export async function listDonations(classId) {
  const snap = await getDocs(collection(db, "classCenters", classId, "donations"));
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => ms(b.at) - ms(a.at));
}
