// ============================================================================
// Pluggporten – mysterybox-köp/öppning (data-mystery.js)
// ----------------------------------------------------------------------------
// Klientens väg till mysterylådan. Sedan #854 (epic #851) sker köpet och
// LOTTNINGEN på servern: callablen butikKop drar lådans katalogpris, lottar en
// kosmetisk sak (rollMysteryItem i mystery-items.js) och – i samma transaktion –
// lägger saken i studentData.ownedItems eller, om eleven redan äger den, ger
// DUBBLETT-coins i stället (dupCoins). Klienten skickar bara lådans id.
// src/butik-kop.js laddas dynamiskt (Functions-SDK:t hör inte till bootgrafen).
// ============================================================================

/**
 * Köp & öppna EN mysterybox.
 * @param {string} boxId lådans shop-id (MYSTERY_BOXES i mystery-items.js)
 * @returns {Promise<{
 *   ok: boolean,          // false = hade inte råd (inget drogs)
 *   coins: number,        // nytt saldo
 *   item?: object,        // det lottade mystery-item-objektet
 *   duplicate?: boolean,  // true = eleven ägde redan saken → coins i stället
 *   refund?: number,      // dubblett-coins (0 om ny sak)
 *   owned?: string[]      // uppdaterad ownedItems-lista
 * }>}
 */
export async function openMysteryBox(boxId) {
  const { kop } = await import("./butik-kop.js");
  return kop(boxId);
}
