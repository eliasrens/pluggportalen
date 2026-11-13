// ============================================================================
// Mattematchen – konfiguration (#846): pluggmynt på MM-sidan.
// ----------------------------------------------------------------------------
// Ren data + en datumhjälpare, inga beroenden (importeras av webbläsarkod och
// `node --test`). Talen här MÅSTE stämma med firestore.rules (mmMyntOk:
// `bumped('mynt', 1)` och `d.mynt <= 50`) – test/mm-mynt.test.js läser
// reglerna och faller om de glider isär. Ändra talet → ändra reglerna → deploy.
//
// Dagsräknaren: studentData/{uid}/mmMynt/{dag} = { dag, cid, mynt,
// lastAttemptId, lastAt } där dag = SVENSKT datum "ÅÅÅÅ-MM-DD"
// (Europe/Stockholm). Reglerna räknar samma datum ur request.time:
// UTC + 1 h (normaltid) eller + 2 h (sommartid = från sista söndagen i mars
// 01:00 UTC till sista söndagen i oktober 01:00 UTC, EU-regeln). Klienten
// räknar det via Intl – testet bevisar att båda ger samma dag, även vid
// omställningarna. Vid midnatt svensk tid kan en skrivning hamna på fel sida
// (klienten skickar kvittot för dagen som precis tog slut): då nekas batchen
// och mm-data.js skickar om svaret UTAN mynt – svaret går aldrig förlorat.
// ============================================================================

/** Pluggmynt per rätt svar på Mattematchen-sidan (reglerna: bumped('mynt', 1) + coins +1). */
export const MYNT_PER_RATT = 1;
/** Högst så många mynt per elev och dag från Mattematchen (reglerna: d.mynt <= 50). */
export const MYNT_TAK_PER_DAG = 50;
/** Undersamlingen under studentData/{uid} med dagsräknarna (reglerna: match /mmMynt/{dag}). */
export const MYNT_KVITTON = "mmMynt";
/** Visas mjukt när taket är nått – svaren räknas fortfarande som poäng. */
export const MYNT_TAK_TEXT = "Dagens mynt är intjänade – poängen räknas fortfarande!";

const svDatum = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * Svenskt datum "ÅÅÅÅ-MM-DD" för en tidpunkt (ms) – dagsräknarens dokument-id.
 * Skicka serverkorrigerad tid (mm-watch.js mmNow) så klientklockan inte styr.
 */
export function myntDag(ms = Date.now()) {
  // sv-SE formaterar redan som ÅÅÅÅ-MM-DD; parts-vägen tål avvikande ICU-data.
  const p = Object.fromEntries(svDatum.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hur många mynt ett rätt svar ger just nu: 1 under taket, 0 när dagen är full. */
export function myntForRatt(myntIdag) {
  return (Number(myntIdag) || 0) < MYNT_TAK_PER_DAG ? MYNT_PER_RATT : 0;
}
