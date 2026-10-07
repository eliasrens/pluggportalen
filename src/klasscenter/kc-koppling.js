// ============================================================================
// Klasscentret – spellägena → Klass-EXP (#479, epic #476).
// ----------------------------------------------------------------------------
// Tunn brygga mellan modulernas avslutspunkter och kc-exp-data.js. Laddas
// ALLTID DYNAMISKT (import("./klasscenter/kc-koppling.js")) – aldrig från den
// statiska bootgrafen (#271). Själv importerar den bara det rena regel-
// registret statiskt; Firestore-delen (kc-exp-data.js) laddas först när en
// omgång faktiskt kan ge något → testbar i Node med en injicerad award().
//
// Anropspunkter (alla fire-and-forget, efter att elevens egna framsteg sparats):
//   game-shared.js awardExercise  quiz/lasforstaelse { ratt, totalt },
//                                 rakna { ratt }, övriga lägen {} (= klar)
//   lasresan/page-lasresan.js     lasresan { ratt, totalt } efter completeText
//   tavling/page-mattematchen.js  mattematchen { rattFore, rattEfter } per
//                                 server-bekräftat rätt svar (+1-batchen)
//   live/live-data.js             writeResultIfMissing → liveKlassBonus(result)
//                                 (lärarklienten, en gång per session)
//
// ALDRIG kastande: ett klass-EXP-fel får inte störa elevens belöning.
//
// API
//   behoverSkrivning(modul, resultat) → bool  kan omgången ge EXP/räknare alls?
//   klassExpEfterOvning({ modul, resultat?, area? }, { award? }) → Promise<Record<classId, antal>>
//   liveBonusar(result)               → [{ classId, kalla }]
//   liveKlassBonus(result, { bonus? }) → Promise<number>  summa utdelad bonus
// ============================================================================

import { planKlassExp, harRegel, modulFor } from "./kc-exp-regler.js";

/**
 * Snabb förkontroll UTAN elevens räknare: okänd modul, < 50 % på quiz, ett
 * Mattematchen-svar som inte passerar en 20-gräns, 0 rätt i Räkna … ger varken
 * EXP eller räknare oavsett tidigare omgångar → ingen Firestore-trafik alls.
 * (Räknare kan bara SÄNKA utfallet – "3 första gångerna" – aldrig höja det,
 * utom Räknas rest, som redan syns som en räknar-skrivning här.)
 */
export function behoverSkrivning(modul, resultat) {
  if (!modul || !harRegel(modulFor(modul))) return false;
  const { antal, raknare } = planKlassExp(modul, resultat || {}, {});
  return antal > 0 || !!(raknare && Object.keys(raknare).length);
}

async function laddaAward() {
  return (await import("./kc-exp-data.js")).awardClassExp;
}

/** Elevens klass-EXP för en avklarad omgång. Elev utan klass → {} (inget fel). */
export async function klassExpEfterOvning({ modul, resultat = {}, area } = {}, { award } = {}) {
  try {
    if (!behoverSkrivning(modul, resultat)) return {};
    const fn = award || (await laddaAward());
    return (await fn({ modul, resultat, area })) || {};
  } catch (err) {
    console.warn("[klasscenter] klass-EXP hoppades över", modul, err?.code || err);
    return {};
  }
}

/**
 * Live-matchens klassbonusar ur historikens result (live-core buildResult):
 * "live" till varje klass med minst en spelare, "live-vinst" till vinnaren
 * (inte vid oavgjort).
 */
export function liveBonusar(result) {
  const ut = [];
  const perClass = result?.perClass || {};
  for (const [classId, c] of Object.entries(perClass)) {
    if ((Number(c?.players) || 0) > 0) ut.push({ classId, kalla: "live" });
  }
  const w = result?.winner;
  if (w && w !== "draw" && (Number(perClass[w]?.players) || 0) > 0) ut.push({ classId: w, kalla: "live-vinst" });
  return ut;
}

/** Dela ut Live-bonusarna (lärarens claim krävs av reglerna). Aldrig kastande. */
export async function liveKlassBonus(result, { bonus } = {}) {
  let summa = 0;
  const lista = liveBonusar(result);
  if (!lista.length) return 0;
  let fn = bonus;
  try {
    fn = fn || (await import("./kc-exp-data.js")).awardClassBonus;
  } catch (err) {
    console.warn("[klasscenter] klassbonus hoppades över", err?.code || err);
    return 0;
  }
  for (const { classId, kalla } of lista) {
    try {
      summa += Number(await fn(classId, kalla)) || 0;
    } catch (err) {
      console.warn("[klasscenter] klassbonus kunde inte delas ut", classId, kalla, err?.code || err);
    }
  }
  return summa;
}
