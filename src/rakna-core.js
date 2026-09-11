// ============================================================================
// Pluggportalen – Räkna-läget: ren kärna (rakna-core.js, issue #280)
// ----------------------------------------------------------------------------
// All logik i Räkna-läget som INTE rör DOM/canvas ligger här, så den kan
// enhetstestas i Node (som gamemode-visibility.js, exercise-types.js m.fl.):
//   • byggandet av en runda uppgifter ur ett områdes generator-konfig, via
//     matte-generator-adaptern (#278), med en DETERMINISTISK seed per
//     elev/session och ett upprepningsskydd (isSameProblem),
//   • formatering av uppgiftstexten för A4-kortet (svensk decimalkomma), och
//   • RÄTTNINGEN av elevens slutsvar mot generatorns facit (tål komma/punkt och
//     "rest"-svar för divisionsvarianten).
//
// Själva spelet (kort, kladdyta-canvas, svarsfält, belöningsloop) bor i
// games-rakna.js och importerar härifrån. Ingen slump här går via Math.random –
// variantvalet dras ur samma seedbara ström som adaptern, så en (elev, session)
// alltid ger samma uppgifter (reproducerbart, men nya varje ny session).
// ============================================================================

import { generateProblem } from "./matte-generator.js";
import { gradeNr } from "./grades.js";

// Antal uppgifter i en runda. Matchar övriga grind-lägens känsla (quiz kör 10);
// räkna för hand tar längre tid per tal, så en något kortare runda håller
// tempot uppe utan att bli en evighet.
export const ROUND_SIZE = 8;

/**
 * xmur3 – vik en sträng till en 32-bitars fröfunktion (samma familj som
 * matte-generatorns interna prng, men egen kopia så vi inte importerar en
 * privat modul). Används för att härleda ett heltalsfrö ur (elev|session).
 * @param {string} str
 * @returns {number} 32-bitars osignerat heltal
 */
export function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Deterministiskt bas-frö för en spel-session. Kombinerar elevens id (så två
 * elever inte får samma tal samtidigt) med en sessionsnonce (Date.now() vid
 * spelstart) → nya tal varje ny runda, men reproducerbart inom sessionen.
 * @param {string} studentId
 * @param {number} [nonce=Date.now()]
 * @returns {number}
 */
export function sessionSeed(studentId, nonce = Date.now()) {
  return hashSeed(`${studentId || "anon"}|${nonce}`);
}

/** Svensk taldisplay: punkt → decimalkomma (generatorns tal saknar tusental-avgränsare). */
export function sv(n) {
  return String(n).replace(".", ",");
}

/**
 * Uppgiftstexten som visas STORT på A4-kortet. questionText (t.ex. "Hur mycket
 * är hälften av 20?") går före det korta "a op b", och punkt byts mot svensk
 * decimalkomma.
 * @param {object} problem – adapterns problem-objekt (har .text/.questionText)
 * @returns {string}
 */
export function problemDisplay(problem) {
  const t = problem?.questionText || problem?.text || "";
  return String(t).replace(/\./g, ",");
}

/**
 * Läsbart facit för visning när eleven svarat fel. "rest"-varianten visar både
 * kvot och rest ("3 rest 1"), övriga bara talet (svensk komma).
 * @param {object} problem
 * @param {number} answer
 * @returns {string}
 */
export function expectedAnswerText(problem, answer) {
  if (problem?.hasRemainder) return `${answer} rest ${problem.remainder}`;
  return sv(answer);
}

/**
 * Rätta elevens råa slutsvar mot generatorns facit.
 *  • Vanliga tal: numerisk jämförelse, tål både "1,5" och "1.5" och kringliggande
 *    blanksteg. Liten epsilon för decimaltal (facit är redan avrundat i adaptern).
 *  • "rest"-varianten (hasRemainder): kräver BÅDE kvot och rest. Plockar ut de
 *    två första heltalen ur svaret, så "3 rest 1", "3 r 1" och "3, 1" alla går.
 * @param {object} problem – adapterns problem-objekt
 * @param {number} answer  – adapterns facit (kvoten för rest-varianten)
 * @param {string} raw     – elevens inmatade text
 * @returns {boolean}
 */
export function checkAnswer(problem, answer, raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return false;

  if (problem?.hasRemainder) {
    const nums = s.match(/-?\d+/g);
    if (!nums || nums.length < 2) return false;
    return Number(nums[0]) === answer && Number(nums[1]) === problem.remainder;
  }

  const val = Number(s.replace(/\s+/g, "").replace(",", "."));
  if (!Number.isFinite(val)) return false;
  return Math.abs(val - answer) < 1e-6;
}

/** Är två genererade uppgifter i praktiken samma (samma synliga text)? */
export function isSameProblem(a, b) {
  if (!a || !b) return false;
  return problemDisplay(a.problem) === problemDisplay(b.problem);
}

/**
 * Bygg en runda uppgifter ur ett områdes generator-konfig. Deterministiskt ur
 * `baseSeed`: variantvalet OCH varje uppgifts frö härleds ur baseSeed + index,
 * så samma (elev, session) ger samma runda. Upprepningsskydd: hittar en
 * genererad uppgift som är lika den förra provar vi nästa frö (några försök),
 * annars behåller vi den (hellre en dubblett än en oändlig loop).
 *
 * @param {{topic:string, variants:string[], grade?:string}} generator – normaliserad area.generator
 * @param {number} baseSeed – från sessionSeed()
 * @param {number} [count=ROUND_SIZE]
 * @returns {Array<{problem:object, answer:number, variant:string}>}
 */
export function buildRound(generator, baseSeed, count = ROUND_SIZE) {
  const variants = Array.isArray(generator?.variants) && generator.variants.length
    ? generator.variants
    : [undefined]; // adaptern faller tillbaka till första varianten
  const grade = gradeNr(generator?.grade) || undefined;

  const round = [];
  let seedCursor = baseSeed >>> 0;
  for (let i = 0; i < count; i++) {
    let picked = null;
    // Upp till 5 försök att undvika en direkt upprepning av föregående uppgift.
    for (let attempt = 0; attempt < 5; attempt++) {
      const s = (seedCursor + attempt * 2654435761) >>> 0; // gyllene-snitt-steg
      const variant = variants[hashSeed(`v|${s}`) % variants.length];
      const settings = {};
      if (variant) settings.variant = variant;
      if (grade) settings.grade = grade;
      const gen = generateProblem(generator.topic, settings, s);
      picked = gen;
      if (!isSameProblem({ problem: gen.problem }, round[round.length - 1])) break;
    }
    round.push(picked);
    seedCursor = (seedCursor + 0x9e3779b1) >>> 0;
  }
  return round;
}
