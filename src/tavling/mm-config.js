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
// Ett nekat mynt är alltså INTE alltid taket (#849): sidan läser dagsräknaren
// en gång efter nekandet och myntEfterNekat avgör vad den ska visa.
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

/** Så många nekade mynt i rad (samma dag, inget taket) innan sidan slutar försöka (#849). */
export const MYNT_NEKAT_SPARR = 5;
/** …och så länge (ms) nekandena måste ha pågått – midnattsfönstret (klockskillnad < 5 s) låser aldrig. */
export const MYNT_NEKAT_SPARR_MS = 60_000;

/**
 * Dagens mynt efter ett NEKAT mynt (#849). Nekandet kan vara taket (annan
 * flik) men också fel dag-nyckel runt svensk midnatt – därför läser sidan
 * dagsräknaren en gång efter nekandet (aldrig per betalt svar).
 *   • lasta = räknarens `mynt` (0 = inget dokument), null = läsningen misslyckades
 *   • sedanForsta = ms sedan första nekandet i raden (serverkorrigerad tid)
 *   • lästa ≥ taket → taket (texten visas)
 *   • annars → max(lokalt, lästa): nästa rätt svar försöker igen
 *   • nekat MYNT_NEKAT_SPARR gånger i rad utan förklaring OCH i minst
 *     MYNT_NEKAT_SPARR_MS → taket som förut, så ett ihållande fel inte kostar
 *     en extra skrivning + läsning per svar (ett kort midnattsfönster låser aldrig)
 * @param {{myntIdag:number, lasta:number|null, nekadeIRad:number, sedanForsta:number}} a
 * @returns {number}
 */
export function myntEfterNekat({ myntIdag, lasta, nekadeIRad, sedanForsta }) {
  const lokalt = Number(myntIdag) || 0;
  const server = lasta == null ? null : Number(lasta) || 0;
  if (server != null && server >= MYNT_TAK_PER_DAG) return MYNT_TAK_PER_DAG;
  if (nekadeIRad >= MYNT_NEKAT_SPARR && sedanForsta >= MYNT_NEKAT_SPARR_MS) return MYNT_TAK_PER_DAG;
  return server == null ? lokalt : Math.max(lokalt, server);
}
