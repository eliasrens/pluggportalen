// ============================================================================
// Schackets pluggmynt (#798) – belopp, kvittonycklar och texter. DELAD mellan
// klienten (nivåväljaren, slutrutan, guiden, pusslen) och servern (functions/
// schack-mynt.js via npm run sync:schack). Inga importer, inget DOM.
//
// Belöningarna (Elias 2026-10-19), bara en gång var:
//   första vinsten mot Bonden 200 · Springaren 400 · Tornet 500 · Damen 500 + pokal
//   varje lektion i "Lär dig schack" 5 · varje pussel 5
// Partier mot kompisar ger inga mynt. Ångra och Tips är tillåtna mot datorn.
//
// Kvittot schackMynt/{uid} (bara servern skriver):
//   { dator: { bonden: ms, … }, lektioner: { "1": ms, … }, pussel: { "ett-HiVCC": ms, … },
//     pokaler: { damen: ms }, total: int, uppdaterad: ms }
// ============================================================================

/** Mynt för den första vinsten per nivå. */
export const DATOR_MYNT = Object.freeze({ bonden: 200, springaren: 400, tornet: 500, damen: 500 });
/** Nivåer som ger en pokal med den första vinsten. */
export const DATOR_POKAL = Object.freeze({ damen: "damen" });
export const LEKTION_MYNT = 5;
export const PUSSEL_MYNT = 5;

/** Pokalerna eleven kan få i schack (nyckeln i kvittot och i studentData.schack.pokaler). */
export const SCHACK_POKALER = Object.freeze({
  damen: Object.freeze({ id: "damen", namn: "Damens besegrare", text: "Vann mot Damen, datorns starkaste nivå i schack" }),
});

const NIVA_NAMN = { bonden: "Bonden", springaren: "Springaren", tornet: "Tornet", damen: "Damen" };

/** Nyckeln för ett pussel i kvittot: sorten + Lichess-id:t (stabilt även om banken byggs om). */
export function pusselNyckel(sort, id) {
  return `${sort}-${id}`;
}

const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/** Kvittot i säker form (saknat/trasigt = tomt). */
export function normaliseraKvitto(k) {
  const d = map(k);
  return {
    dator: { ...map(d.dator) }, lektioner: { ...map(d.lektioner) }, pussel: { ...map(d.pussel) },
    pokaler: { ...map(d.pokaler) }, total: Number.isInteger(d.total) ? d.total : 0,
  };
}

const har = (m, k) => Object.hasOwn(m, k) && m[k] != null;
export const harDator = (kvitto, niva) => har(normaliseraKvitto(kvitto).dator, niva);
export const harLektion = (kvitto, nr) => har(normaliseraKvitto(kvitto).lektioner, String(nr));
export const harPussel = (kvitto, sort, id) => har(normaliseraKvitto(kvitto).pussel, pusselNyckel(sort, id));

/** Kvittot efter en utbetalning (klientens kopia uppdateras utan ny läsning). */
export function efterUtbetalning(kvitto, grupp, nyckel, mynt, nu = Date.now()) {
  const k = normaliseraKvitto(kvitto);
  k[grupp] = { ...k[grupp], [nyckel]: nu };
  if (grupp === "dator" && DATOR_POKAL[nyckel]) k.pokaler = { ...k.pokaler, [DATOR_POKAL[nyckel]]: nu };
  k.total += mynt;
  return k;
}

// --- Texterna ({mynt} = myntikonen, byts med withCoinIcon i UI:t) -------------

/** Nivåkortets rad: "✓ Slagen" eller belöningen för den första vinsten. */
export function nivaBelonningText(niva, kvitto) {
  if (harDator(kvitto, niva)) return "✓ Slagen – mynten är dina";
  const m = DATOR_MYNT[niva];
  if (!m) return "";
  return DATOR_POKAL[niva] ? `Första vinsten: +${m} {mynt} och en pokal` : `Första vinsten: +${m} {mynt}`;
}

/** Slutrutan efter en vinst mot datorn. `svar` = callable-svaret ({ mynt, redan, pokal }). */
export function datorVinstText(niva, svar) {
  const namn = NIVA_NAMN[niva] || niva;
  if (!svar) return "";
  if (svar.redan || !svar.mynt) return `Du har redan fått mynt för ${namn}.`;
  const pokal = svar.pokal ? ` och pokalen ${SCHACK_POKALER.damen.namn}` : "";
  return `+${svar.mynt} {mynt}${pokal} – första vinsten mot ${namn}!`;
}

export const TEXT_MYNT = {
  hjalpTillaten: "Ångra och Tips är tillåtna – mynten får du ändå när du vinner.",
  hamtar: "Mynten hämtas …",
  fel: "Mynten kunde inte hämtas just nu.",
  lektionNy: `+${LEKTION_MYNT} {mynt} för lektionen!`,
  lektionRedan: "Du har redan fått mynt för den här lektionen.",
  pusselNy: `+${PUSSEL_MYNT} {mynt}`,
  pusselRedan: "✓ Klarat – mynten för det här pusslet har du redan fått.",
};
