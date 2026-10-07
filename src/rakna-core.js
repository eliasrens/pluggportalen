// ============================================================================
// Pluggporten – Räkna-läget: ren kärna (rakna-core.js, issue #280)
// ----------------------------------------------------------------------------
// All logik i Räkna-läget som INTE rör DOM/canvas ligger här, så den kan
// enhetstestas i Node (som gamemode-visibility.js, exercise-types.js m.fl.):
//   • byggandet av en runda uppgifter ur ett områdes generator-konfig (ett eller
//     flera räknesätt, blandade balanserat via en shuffle-bag, #470), via
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
import { talstorlekToGrade } from "./exercise-types.js";
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
 * Rätta elevens råa slutsvar mot generatorns facit. Väljer rättningsstrategi ur
 * problem.answerType (adaptern sätter det, default 'numeric'):
 *  • 'numeric' – numerisk jämförelse (tål "1,5"/"1.5" + blanksteg, epsilon för
 *    decimaler) och "rest"-varianten (kräver BÅDE kvot och rest).
 *  • 'fraction' (#321) – bråk/heltal, VÄRDES-lika: "3/6", "1/2" och "0,5" godtas
 *    alla mot facit "1/2".
 *  • 'coord' (#321) – två heltal ur svaret, t.ex. "(3, 4)", "3,4" → (3,4).
 *  • 'time' (#321) – klockslag mod 12 h: "07:30", "7:30", "7.30", "0730".
 *  • 'text' (#321) – normaliserad textjämförelse (etikett), med numerisk fallback
 *    så siffersvar (statistik) tål komma/punkt.
 * @param {object} problem – adapterns problem-objekt
 * @param {number|string} answer – adapterns facit
 * @param {string} raw – elevens inmatade text
 * @returns {boolean}
 */
export function checkAnswer(problem, answer, raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return false;

  switch (problem?.answerType) {
    case "fraction": return checkFraction(answer, s);
    case "coord":    return checkCoord(answer, s);
    case "time":     return checkTime(answer, s);
    case "text":     return checkText(answer, s);
    default:         return checkNumeric(problem, answer, s);
  }
}

/** Numeriskt facit (+ rest-varianten). Oförändrad logik från #280. */
function checkNumeric(problem, answer, raw) {
  const s = String(raw).trim().toLowerCase();
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

/** Parsa "a/b", heltal eller decimaltal (komma/punkt) → [täljare, nämnare]. */
function parseFrac(str) {
  const s = String(str).trim().replace(",", ".");
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  const n = Number(s);
  return Number.isFinite(n) ? [n, 1] : null;
}

/** Bråk-facit: värdes-lika (korsmultiplikation), så "3/6" == "1/2" == "0,5". */
function checkFraction(answer, raw) {
  const a = parseFrac(answer), b = parseFrac(raw);
  if (!a || !b || a[1] === 0 || b[1] === 0) return false;
  return Math.abs(a[0] * b[1] - b[0] * a[1]) < 1e-9;
}

/** Alla signerade heltal ur en sträng. */
function intsIn(str) {
  const m = String(str).match(/-?\d+/g);
  return m ? m.map(Number) : [];
}

/** Koordinat-facit: samma första två heltal, "(3, 4)"/"3,4"/"3 4". */
function checkCoord(answer, raw) {
  const a = intsIn(answer), b = intsIn(raw);
  if (a.length < 2 || b.length < 2) return false;
  return a[0] === b[0] && a[1] === b[1];
}

/** Klockslag → [timme mod 12, minut] eller null. Tål ":" "." " " och "HHMM". */
function parseTime(str) {
  const s = String(str).trim();
  const m = s.replace(/[.\s]+/g, ":").match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) {
    const mm = Number(m[2]);
    if (mm >= 60) return null;
    return [Number(m[1]) % 12, mm];
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length === 3 || digits.length === 4) {
    const h = Number(digits.slice(0, digits.length - 2));
    const mm = Number(digits.slice(-2));
    if (mm < 60) return [h % 12, mm];
  }
  return null;
}

/** Tid-facit: samma klockslag mod 12 h (facit är alltid "HH:MM" i 12-timmars). */
function checkTime(answer, raw) {
  const a = parseTime(answer), b = parseTime(raw);
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
}

/** Text-facit: normaliserad jämförelse (etikett), med numerisk fallback. */
function checkText(answer, raw) {
  const na = normText(answer), nb = normText(raw);
  if (na === nb) return true;
  const va = Number(na.replace(",", ".")), vb = Number(nb.replace(",", "."));
  return Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < 1e-6;
}

function normText(str) {
  return String(str == null ? "" : str).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Är två genererade uppgifter i praktiken samma (samma synliga text)? */
export function isSameProblem(a, b) {
  if (!a || !b) return false;
  return problemDisplay(a.problem) === problemDisplay(b.problem);
}

/**
 * Räknesätten (topic-poster) i en generator-konfig. Tål både det normaliserade
 * formatet { topics: [...] } (#470) och det gamla enkel-topic-objektet
 * { topic, variants, talstorlek?, bildstod? } (#279/#322), som blir en lista med ett.
 * @param {object} generator
 * @returns {object[]}
 */
export function generatorTopics(generator) {
  if (Array.isArray(generator?.topics) && generator.topics.length) return generator.topics;
  return generator ? [generator] : [];
}

/**
 * Balanserad, DETERMINISTISK topic-väljare (shuffle-bag, #470). Varje "påse"
 * innehåller varje valt räknesätt exakt en gång i seedad slumpordning; när den
 * tömts fylls en ny. Så förekommer alla räknesätt lika ofta (skillnad ≤ 1 vid
 * varje tidpunkt) och samma räknesätt kommer aldrig två gånger i rad – även över
 * påsgränsen (då byter första och andra plats). Ett enda räknesätt → alltid det
 * (och drar inget ur fröströmmen, så gamla områden ger exakt samma uppgifter).
 * @param {object[]} topics – topic-poster (generatorTopics)
 * @param {number} seed
 * @returns {{ next: () => object }}
 */
export function createTopicBag(topics, seed) {
  const list = Array.isArray(topics) && topics.length ? topics : [{}];
  let bag = [];
  let refill = 0;
  let last = null;
  return {
    next() {
      if (list.length === 1) return list[0];
      if (bag.length === 0) {
        bag = list.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = hashSeed(`bag|${seed >>> 0}|${refill}|${i}`) % (i + 1);
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        refill++;
        if (bag[0] === last) [bag[0], bag[1]] = [bag[1], bag[0]];
      }
      last = bag.shift();
      return last;
    },
  };
}

/**
 * Bygg en runda uppgifter ur ett områdes generator-konfig. Deterministiskt ur
 * `baseSeed`: topic-valet (shuffle-bag bland de valda räknesätten, #470),
 * variantvalet OCH varje uppgifts frö härleds ur baseSeed + index, så samma
 * (elev, session) ger samma runda. Upprepningsskydd: hittar en genererad uppgift
 * som är lika den förra provar vi nästa frö (några försök), annars behåller vi den
 * (hellre en dubblett än en oändlig loop). Varje uppgift bär sitt `topic`, så
 * rättning/answerType/bildstöd följer uppgiftens faktiska räknesätt.
 *
 * @param {object} generator – normaliserad area.generator ({ topics, grade? }) eller gammalt format
 * @param {number} baseSeed – från sessionSeed()
 * @param {number} [count=ROUND_SIZE]
 * @param {{next:()=>object}} [bag] – topic-väljare (createProblemSource delar en över batcharna)
 * @returns {Array<{problem:object, answer:number, variant:string, topic:string}>}
 */
export function buildRound(generator, baseSeed, count = ROUND_SIZE, bag = null) {
  const picker = bag || createTopicBag(generatorTopics(generator), baseSeed);

  const round = [];
  let seedCursor = baseSeed >>> 0;
  for (let i = 0; i < count; i++) {
    const entry = picker.next();
    const variants = Array.isArray(entry?.variants) && entry.variants.length
      ? entry.variants
      : [undefined]; // adaptern faller tillbaka till första varianten
    // Talstorlek (issue #322, per räknesätt #470) styr talens storlek via generatorns
    // grade-axel och vinner över områdets ev. årskurs-metadata. Osatt → årskursen,
    // annars adapterns default.
    const grade = talstorlekToGrade(entry?.talstorlek) ||
      gradeNr(generator?.grade ?? entry?.grade) || undefined;
    let picked = null;
    // Upp till 5 försök att undvika en direkt upprepning av föregående uppgift.
    for (let attempt = 0; attempt < 5; attempt++) {
      const s = (seedCursor + attempt * 2654435761) >>> 0; // gyllene-snitt-steg
      const variant = variants[hashSeed(`v|${s}`) % variants.length];
      const settings = {};
      if (variant) settings.variant = variant;
      if (grade) settings.grade = grade;
      const gen = generateProblem(entry.topic, settings, s);
      picked = { ...gen, topic: entry.topic };
      if (!isSameProblem({ problem: gen.problem }, round[round.length - 1])) break;
    }
    round.push(picked);
    seedCursor = (seedCursor + 0x9e3779b1) >>> 0;
  }
  return round;
}

/**
 * En DETERMINISTISK, i praktiken oändlig ström av genererade uppgifter för ett
 * generator-område. Räkna-läget (games-rakna.js) drar en fast runda (buildRound
 * ovan), men äventyren (adventure/generator-adapter.js, #296) vet inte i förväg hur
 * många uppgifter som behövs – ett äventyr frågar EN uppgift per station plus
 * omförsök vid fel svar. Strömmen ger därför next() på begäran. Internt byggs
 * uppgifter i batchar via buildRound (så exakt samma seed-/variant-/no-repeat-logik
 * återanvänds), och nya batch-frön härleds ur baseSeed + batch-index så samma
 * (elev, session) alltid ger samma följd – reproducerbart men nytt varje ny session.
 *
 * @param {object} generator – normaliserad area.generator ({ topics, grade? }) eller gammalt format
 * @param {number} baseSeed – från sessionSeed()
 * @param {number} [batchSize=ROUND_SIZE]
 * @returns {{ next: () => {problem:object, answer:number, variant:string} }}
 */
export function createProblemSource(generator, baseSeed, batchSize = ROUND_SIZE) {
  // EN topic-påse för hela strömmen (#470): balansen och "aldrig samma räknesätt
  // två gånger i rad" håller även över batch-gränserna.
  const bag = createTopicBag(generatorTopics(generator), hashSeed(`topics|${baseSeed >>> 0}`));
  let batch = [];
  let cursor = 0;
  let batchIndex = 0;
  return {
    next() {
      if (cursor >= batch.length) {
        const seed = hashSeed(`batch|${baseSeed >>> 0}|${batchIndex}`);
        batch = buildRound(generator, seed, batchSize, bag);
        batchIndex++;
        cursor = 0;
      }
      return batch[cursor++];
    },
  };
}
