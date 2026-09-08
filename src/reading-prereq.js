// ============================================================================
// Pluggportalen – obligatoriska läsförståelse-förkrav (reading-prereq.js)
// (issue #155)
// ----------------------------------------------------------------------------
// En lärare kan bestämma att eleven MÅSTE klara läsförståelse i ett arbetsområde
// innan de andra övningarna (quiz, para ihop, memory, kunskapsjakt) låses upp.
// Inställningen bor på området som fältet `readingPrereq`:
//
//   readingPrereq: { required: <heltal ≥ 1> }   // förkrav PÅ (så många godkända)
//   (saknas / null / required < 1)               // förkrav AV → allt öppet (som förr)
//
// "Godkänt" räknas enligt chans-skyddet: det räcker INTE att ha PÅBÖRJAT eller
// bara slutfört läsförståelsen – eleven måste nå minst READING_PASS_STARS stjärnor
// (≥ 70 % rätt), vilket ligger klart över gissningschansen. Se starsFromRatio i
// game-shared.js (2 stjärnor = ratio ≥ 0.7).
//
// Räkningen av godkända läsförståelse-enheter är framåtkompatibel:
//   • Om områdets framsteg har en per-text-hink `progress[area].reading[textId]`
//     (skrivs av läsförståelse-LÄGET, egen issue) räknas varje godkänd text för sig.
//   • Annars (och i dag) räknas det spelbara läsförståelse-gamemodet
//     ("lasforstaelse") som ETT godkänt genomförande.
//
// Ren logik utan DOM/Firestore – testbar för sig och delad mellan elevvyn
// (gamemodes.js) och lärarvyn (teacher-reading.js) samt validering (validate.js).
// ============================================================================

// Minsta antal stjärnor för "godkänt" (chans-skydd). 2 stjärnor = ≥ 70 % rätt.
export const READING_PASS_STARS = 2;

/** Är en framstegs-nod (t.ex. progress[area].lasforstaelse) godkänd? */
export function isReadingPassed(node) {
  return (
    !!node &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    Number(node.stars) >= READING_PASS_STARS
  );
}

/**
 * Normalisera lärarens förkravs-inställning till { required } eller null.
 * Bakåtkompatibelt och tolerant mot äldre/råa former:
 *   • undefined/null/false/{}         → null (av)
 *   • true                            → { required: 1 }
 *   • { required: n } (n ≥ 1)         → { required: heltal }
 * @param {*} input  area.readingPrereq (rå indata)
 * @returns {{required:number}|null}
 */
export function normalizeReadingPrereq(input) {
  if (input === undefined || input === null) return null;
  if (typeof input === "boolean") return input ? { required: 1 } : null;
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 1 ? { required: Math.round(input) } : null;
  }
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const n = Number(input.required);
  if (!Number.isFinite(n) || n < 1) return null;
  return { required: Math.max(1, Math.round(n)) };
}

/**
 * Antal GODKÄNDA läsförståelse-enheter i ett områdes framsteg.
 * @param {object} areaProgress  progress[areaId] = { [mode]: {stars,...}, reading?: {…} }
 * @returns {number}
 */
export function readingPassCount(areaProgress) {
  const p = areaProgress && typeof areaProgress === "object" ? areaProgress : {};
  // Framåtkompatibelt: per-text-godkännanden räknas var för sig om de finns.
  const perText = p.reading && typeof p.reading === "object" && !Array.isArray(p.reading) ? p.reading : null;
  if (perText) {
    let n = 0;
    for (const node of Object.values(perText)) if (isReadingPassed(node)) n++;
    if (n > 0) return n;
  }
  // I dag (och som reserv): läsförståelse-gamemodet räknas som EN godkänd enhet.
  return isReadingPassed(p.lasforstaelse) ? 1 : 0;
}

/**
 * Status för läsförståelse-förkravet i ett område, för en viss elevs framsteg.
 * @param {object} areaData      områdesdokumentet (kan ha readingPrereq)
 * @param {object} areaProgress  progress[areaId] (kan vara undefined)
 * @returns {{enabled:boolean, required:number, passed:number, met:boolean}}
 */
export function readingPrereqStatus(areaData, areaProgress) {
  const prereq = normalizeReadingPrereq(areaData?.readingPrereq);
  if (!prereq) return { enabled: false, required: 0, passed: 0, met: true };
  const passed = readingPassCount(areaProgress);
  return { enabled: true, required: prereq.required, passed, met: passed >= prereq.required };
}
