// ============================================================================
// Klasscentret – omförsök vid samtidiga skrivningar (#493, epic #475).
// ----------------------------------------------------------------------------
// Ingen Firebase-import. Delas av korDonation (kc-fund-plan.js),
// korSparning/korAterstallning (kc-layout-plan.js) och Live-utbetalningen
// (live/live-rewards-pay.js, #580). Laddas bara via dem –
// alltså bara dynamiskt (#271).
//
// Varför permission-denied och inte en vanlig transaktionskrock: Firestore
// (emulatorn bevisligen) räknar reglerna mot det SENAST sparade läget när
// commit kommer – inte mot det transaktionen läste. Hann en klasskamrat
// skriva emellan stämmer inte "fundedAmount ökar exakt amount" /
// "version == gammal + 1" längre → permission-denied, som SDK:t inte kör om
// själv. (Krockar som upptäcks som låskonflikt blir aborted; dem kör SDK:t
// om några gånger och ger sedan upp med aborted.)
//
// Krock eller verkligt nekad? Transaktionen rapporterar en "lägesstämpel" för
// det den läste (sammaSomNekat). Nekas ett försök och NÄSTA försök läser
// exakt samma läge har ingen annan skrivit emellan → reglerna sa nej på
// riktigt (ej klassmedlem, spärrad …): sluta direkt, inga fler varv.
// Annars: vänta (exponentiell backoff med full jitter) och kör om – med
// färska värden, så cappning/version räknas om.
//
// API
//   medKrockOmforsok(kor, { forsok, vanta? }) → Promise<resultat>
//       kor(ctx, varv) kör EN transaktion och anropar sammaSomNekat(ctx,
//       stämpel) i callbacken; returnerar callbackens resultat.
//       Kastar: krock-felet med err.krock = true när försöken tagit slut,
//       err.krock = false när läget var oförändrat (verkligt nekad), annat
//       fel (unavailable …) direkt och orört.
//   sammaSomNekat(ctx, stampel) → bool  (true = returnera SAMMA_LAGE)
//   SAMMA_LAGE                    returneras av transaktionen utan skrivningar
//   vantetid(varv, slump?)        → ms (full jitter, BAS·2^(varv−1), tak TAK)
//   KROCK_KODER                   koder som räknas som krock
// ============================================================================

export const KROCK_KODER = new Set(["permission-denied", "aborted"]);
export const SAMMA_LAGE = Symbol("kc-samma-lage");

const BAS = 60;
const TAK = 1500;

/** Väntetid före försök varv + 1: slumpad i [BAS/2, min(TAK, BAS·2^(varv−1))]. */
export function vantetid(varv, slump = Math.random) {
  const tak = Math.min(TAK, BAS * 2 ** Math.max(0, varv - 1));
  return Math.round(BAS / 2 + slump() * Math.max(0, tak - BAS / 2));
}

const sov = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Anropas i transaktionens callback med en stämpel för det som lästes.
 * true → läget är detsamma som när förra försöket nekades (verkligt nekad).
 */
export function sammaSomNekat(ctx, stampel) {
  ctx.lage = stampel;
  return ctx.nekadVid !== undefined && ctx.nekadVid === stampel;
}

export async function medKrockOmforsok(kor, { forsok, vanta = sov } = {}) {
  const ctx = { lage: undefined, nekadVid: undefined, fel: null };
  for (let varv = 1; ; varv++) {
    ctx.lage = undefined;
    let res;
    try {
      res = await kor(ctx, varv);
    } catch (err) {
      if (!KROCK_KODER.has(err?.code)) throw err;
      if (varv >= forsok) {
        err.krock = true;
        throw err;
      }
      ctx.nekadVid = ctx.lage;
      ctx.fel = err;
      await vanta(vantetid(varv));
      continue;
    }
    if (res === SAMMA_LAGE) {
      ctx.fel.krock = false;
      throw ctx.fel;
    }
    return res;
  }
}
