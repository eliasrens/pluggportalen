// ============================================================================
// Ekvationsresan – mynt (src/ekvationsresan/mynt.js) · #616, spec E1.10
// ----------------------------------------------------------------------------
// Pluggportens VANLIGA saldo (studentData.coins) via data-mynt.js tjanaMynt
// med dagskvittot (#853, källan "ekv") – samma mönster som Läsresan
// (lasresan/rewards.js), inget eget myntsystem.
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
 * Lägg mynten på elevens saldo. data-mynt.js importeras LAT så att modulen är
 * testbar med `node --test`; tester skickar in en egen betala (tjanaMynt-formen).
 * @returns {Promise<{coins:number, balance:(number|null), tak:boolean}>}
 */
export async function award(coins, { studentId, betala } = {}) {
  const n = Math.max(0, Math.floor(Number(coins) || 0));
  if (n <= 0) return { coins: 0, balance: null, tak: false };
  const pay = betala || (await import("../data-mynt.js")).tjanaMynt;
  const r = await pay("ekv", n, studentId === undefined ? {} : { studentId });
  return { coins: r.mynt, balance: r.saldo ?? null, tak: !!r.tak };
}
