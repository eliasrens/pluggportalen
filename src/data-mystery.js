// ============================================================================
// Pluggportalen – mysterybox-köp/öppning (data-mystery.js)
// ----------------------------------------------------------------------------
// Systermodul till data.js (samma mönster som data-pet.js/data-room.js): den
// enda Firestore-skrivningen som mysteryboxen behöver. openMysteryBox() drar
// boxens pris, LOTTAR en kosmetisk sak (mystery-items.js) och – i SAMMA
// transaktion – antingen lägger saken i studentData.ownedItems (ny sak, dyker
// då upp i garderob/rums-låda/husskal-väljare precis som en köpt sak) ELLER,
// om eleven redan äger den, ger DUBBLETT-coins i stället (schysst omvandling).
//
// Lottningen sker EN gång före transaktionskroppen så en ev. retry ger samma
// resultat (deterministiskt). Detta är en snäll barnapp utan riktiga pengar –
// ingen server-auktoritet behövs utöver Firestore-reglernas "bara sitt eget".
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, defaultStudentData, invalidateStudentData } from "./data.js";
import { rollMysteryItem, dupCoins } from "./mystery-items.js";

/**
 * Köp & öppna EN mysterybox: drar `price`, lottar en sak och skriver resultatet
 * i en enda transaktion.
 *
 * @param {number} price boxens pris (coins)
 * @param {number|null} [legendaryChance] per-box legendary-chans (null = basbox)
 * @param {string} [studentId]
 * @returns {Promise<{
 *   ok: boolean,          // false = hade inte råd (inget drogs)
 *   coins: number,        // nytt saldo
 *   item?: object,        // det lottade mystery-item-objektet
 *   duplicate?: boolean,  // true = eleven ägde redan saken → coins i stället
 *   refund?: number,      // dubblett-coins (0 om ny sak)
 *   owned?: string[]      // uppdaterad ownedItems-lista
 * }>}
 */
export async function openMysteryBox(price, legendaryChance = null, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const cost = Math.max(0, Math.round(price || 0));
  // Lotta EN gång (stabilt vid ev. transaktions-retry). legendaryChance styr
  // hur ofta legendary faller (Mega/Epic-boxarna); null = vanliga boxen.
  const item = rollMysteryItem(Math.random, { legendaryChance });
  const ref = doc(db, "studentData", studentId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : defaultStudentData();
    const coins = data.coins || 0;
    if (coins < cost) return { ok: false, coins };

    const owned = Array.isArray(data.ownedItems) ? data.ownedItems : [];
    const duplicate = owned.includes(item.id);
    let refund = 0;
    let nextOwned = owned;
    let nextCoins = coins - cost;
    if (duplicate) {
      // Redan ägd sak → omvandla till dubblett-coins (schysst, enkelt).
      refund = dupCoins(item.rarity);
      nextCoins += refund;
    } else {
      nextOwned = [...owned, item.id];
    }
    const next = { coins: nextCoins, ownedItems: nextOwned };
    if (snap.exists()) tx.update(ref, next);
    else tx.set(ref, { ...defaultStudentData(), ...next });
    return { ok: true, coins: nextCoins, item, duplicate, refund, owned: nextOwned };
  });
  if (result.ok) invalidateStudentData(studentId); // coins/ägda ändrat (#274)
  return result;
}
