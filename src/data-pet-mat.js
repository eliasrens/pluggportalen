// ============================================================================
// Pluggportalen – äppel-ekonomin (Mysterymat: köp & lägg ut på golvet)
// ----------------------------------------------------------------------------
// Systermodul till data-pet.js: den KÖP-/UTLÄGGNINGS-del av matningen som inte
// rör pets[] och därför kan bo för sig (data-pet.js äger djurens tillväxt, dvs.
// eatApple). Speglar studentData-fälten:
//   studentData.appleCount     antal köpta men outlagda äpplen (heltal ≥ 0)
//   studentData.floorApples[]  äpplen som ligger på golvet, { id, x, y }
//                              (x/y i procent av rumsscenen, golvzonen)
// Köp (buyApple) ökar appleCount; lägg ut (placeApple) flyttar ett från
// appleCount → floorApples. När ett djur äter upp ett äpple sköts det av
// eatApple i data-pet.js (djurets feedCount ökar med 1).
// Allt som rör coins går i runTransaction (samma mönster som buyItem).
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "./data.js";

// Shop-id (måste matcha shop-items.js). Äpplet är en förbrukningsvara.
export const APPLE_ITEM_ID = "apple";

/** floorApples[] ur ett studentData-objekt (tom lista om fältet saknas). */
export function floorApplesFromData(data) {
  return Array.isArray(data.floorApples) ? data.floorApples : [];
}

function newAppleId() {
  return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Köp ETT äpple: drar coins och ökar studentData.appleCount. Äpplet är en
 * förbrukningsvara (hamnar aldrig i ownedItems) – man kan köpa hur många som
 * helst. Allt i EN transaktion (samma mönster som buyItem).
 * @returns {Promise<{ok: boolean, coins: number, appleCount: number}>}
 */
export async function buyApple(price, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const cost = Math.max(0, Math.round(price || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const coins = data.coins || 0;
    const count = data.appleCount || 0;
    if (coins < cost) return { ok: false, coins, appleCount: count };
    const next = { coins: coins - cost, appleCount: count + 1 };
    if (snap.exists()) tx.update(ref, next);
    else tx.set(ref, next);
    return { ok: true, coins: next.coins, appleCount: next.appleCount };
  });
}

/**
 * Lägg ut ETT äpple på golvet: flyttar ett äpple från appleCount till
 * floorApples[] (position i procent av rumsscenen). Misslyckas om man är slut
 * på äpplen. Allt i EN transaktion.
 * @returns {Promise<{ok: boolean, appleCount: number, floorApples: object[], apple: object|null}>}
 */
export async function placeApple(x, y, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const count = data.appleCount || 0;
    const apples = floorApplesFromData(data);
    if (count <= 0) return { ok: false, appleCount: count, floorApples: apples, apple: null };
    const apple = { id: newAppleId(), x, y };
    const nextApples = [...apples, apple];
    if (snap.exists()) tx.update(ref, { appleCount: count - 1, floorApples: nextApples });
    else tx.set(ref, { appleCount: count - 1, floorApples: nextApples });
    return { ok: true, appleCount: count - 1, floorApples: nextApples, apple };
  });
}
