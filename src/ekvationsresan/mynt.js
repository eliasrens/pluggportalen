// ============================================================================
// Ekvationsresan – mynt (src/ekvationsresan/mynt.js) · #616, spec E1.10
// ----------------------------------------------------------------------------
// Pluggportens VANLIGA saldo (studentData.coins) via data.addCoins – samma
// mönster som Läsresan (lasresan/rewards.js), inget eget myntsystem.
// Mynt ges för varje LÖST uppgift oavsett stjärnor; "Visa lösningen" ger 0.
// Ingen stjärnbonus i Etapp 1. Nivåerna ligger i config.COINS.
// ============================================================================

import { COINS } from "./config.js";

/**
 * Mynt för en uppgift på `level`.
 * @param {number} level
 * @param {{solved?:boolean, extraChallenge?:boolean}} [opts]
 */
export function coinsFor(level, { solved = true, extraChallenge = false } = {}) {
  if (!solved) return 0;
  if (extraChallenge) return COINS.extraChallenge;
  return COINS.byLevel.find((r) => level >= r.from && level <= r.to)?.coins ?? 0;
}

/**
 * Lägg mynten på elevens saldo. data.js importeras LAT så att modulen är
 * testbar med `node --test`; tester skickar in en egen addCoins.
 * @returns {Promise<{coins:number, balance:(number|null)}>}
 */
export async function award(coins, { studentId, addCoins } = {}) {
  const n = Math.max(0, Math.floor(Number(coins) || 0));
  if (n <= 0) return { coins: 0, balance: null };
  const add = addCoins || (await import("../data.js")).addCoins;
  const balance = studentId === undefined ? await add(n) : await add(n, studentId);
  return { coins: n, balance };
}
