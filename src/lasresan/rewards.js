// ============================================================================
// Läsresan – belöningar (src/lasresan/rewards.js)
// ----------------------------------------------------------------------------
// 3 pluggcoins per rätt svar (spec §8, talet i config.js). Pengarna läggs på
// elevens VANLIGA saldo (studentData.coins) – det finns INGET separat
// Läsresan-saldo. Ingen prestationsbonus i v1. Utbetalningen går via
// data-mynt.js tjanaMynt med dagskvittot (#853): källan "lasresa", eller
// "amnes" för Ämnesläsningen. Taket kan klippa beloppet (`tak`).
//
// award() importerar data-mynt.js LAT (dynamiskt) så att den här modulen
// förblir ren och testbar med `node --test` (Firebase via CDN-URL:er).
// Tester skickar in en egen betala (tjanaMynt-formen).
// ============================================================================

import { COINS_PER_CORRECT } from "./config.js";

/** Antal pluggcoins för `correct` rätt svar. 4 rätt → 12. */
export function coinsFor(correct) {
  const n = Math.max(0, Math.floor(Number(correct) || 0));
  return n * COINS_PER_CORRECT;
}

/**
 * Rättelsen när taket klippte utbetalningen (#853): statistiken ska visa det
 * som faktiskt BETALADES, inte det försöket räknade fram. Ren – ger
 * studentData-patchen (fältvägar) som sänker varje lagrad summa i `vagar` med
 * skillnaden, och försöket i fallback-listan (`fallbackField`). Ingen
 * skillnad (betalt ≥ tjänat) → tom patch. data-lasresan.js rattaPengar skriver.
 * @returns {object} patch, t.ex. { "lasresa.moneyEarned": 40 }
 */
export function pengarRattelse(sd, { vagar = [], fallbackField = null, textId, completedAt, tjanat, betalt }) {
  const diff = (Number(tjanat) || 0) - (Number(betalt) || 0);
  const patch = {};
  if (!(diff > 0) || !sd || typeof sd !== "object") return patch;
  for (const vag of vagar) {
    const v = vag.reduce((x, k) => (x && typeof x === "object" ? x[k] : undefined), sd);
    if (typeof v === "number") patch[vag.join(".")] = Math.max(0, v - diff);
  }
  const lista = fallbackField ? sd[fallbackField] : null;
  const i = Array.isArray(lista) ? lista.findIndex((a) => a && a.textId === textId && a.completedAt === completedAt) : -1;
  if (i >= 0) patch[fallbackField] = lista.map((a, j) => (j === i ? { ...a, earnedMoney: betalt } : a));
  return patch;
}

/**
 * Dela ut belöningen för en färdig text.
 * @param {number} correct antal rätt
 * @param {{studentId?:string, kalla?:("lasresa"|"amnes"), coins?:number,
 *   betala?:(kalla:string, mynt:number, opts:{studentId?:string})=>Promise<{mynt:number, tak:boolean, saldo:(number|null)}>}} [opts]
 *   `coins` = färdigräknat belopp (Ämnesläsningen: 5/rätt + omläsningstrappa); annars coinsFor(correct).
 * @returns {Promise<{coins:number, balance:(number|null), tak:boolean}>} utbetalt belopp + nytt saldo
 */
export async function award(correct, { studentId, kalla = "lasresa", betala, coins: amount } = {}) {
  const coins = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : coinsFor(correct);
  if (coins <= 0) return { coins: 0, balance: null, tak: false };
  const pay = betala || (await import("../data-mynt.js")).tjanaMynt;
  const r = await pay(kalla, coins, studentId === undefined ? {} : { studentId });
  return { coins: r.mynt, balance: r.saldo ?? null, tak: !!r.tak };
}
