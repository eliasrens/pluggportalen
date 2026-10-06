// ============================================================================
// Läsresan – belöningar (src/lasresan/rewards.js)
// ----------------------------------------------------------------------------
// 3 pluggcoins per rätt svar (spec §8, talet i config.js). Pengarna läggs på
// elevens VANLIGA saldo (studentData.coins) via befintliga data.addCoins –
// det finns INGET separat Läsresan-saldo. Ingen prestationsbonus i v1.
//
// award() importerar data.js LAT (dynamiskt) så att den här modulen förblir
// ren och testbar med `node --test` (data.js drar in Firebase via CDN-URL:er).
// Tester skickar in en egen addCoins.
// ============================================================================

import { COINS_PER_CORRECT } from "./config.js";

/** Antal pluggcoins för `correct` rätt svar. 4 rätt → 12. */
export function coinsFor(correct) {
  const n = Math.max(0, Math.floor(Number(correct) || 0));
  return n * COINS_PER_CORRECT;
}

/**
 * Dela ut belöningen för en färdig text.
 * @param {number} correct antal rätt
 * @param {{studentId?:string, addCoins?:(amount:number, studentId?:string)=>Promise<number>}} [opts]
 * @returns {Promise<{coins:number, balance:(number|null)}>} utdelat belopp + nytt saldo
 */
export async function award(correct, { studentId, addCoins } = {}) {
  const coins = coinsFor(correct);
  if (coins <= 0) return { coins: 0, balance: null };
  const add = addCoins || (await import("../data.js")).addCoins;
  const balance = studentId === undefined ? await add(coins) : await add(coins, studentId);
  return { coins, balance };
}
