// ============================================================================
// Pluggportalen – programmatisk generator för talsorter-uppgifter
// ----------------------------------------------------------------------------
// Producerar ~200 innehållsobjekt (quiz, pairs, texts) om talsorter och
// platsvärde för åk4 – med KORREKTA facit räknade i kod (inte handskrivna).
//
//   generateTalsorter()  ->  { texts, quiz, pairs }
//
// Determinism: allt slumpas ur en FAST frö (mulberry32), så två körningar ger
// exakt samma frågor, samma ordning och samma stabila id:n. Det gör seeden
// idempotent (samma dokument varje gång) och gör facit granskningsbart.
//
// Datamodellen (se src/validate.js / docs/DATAMODELL.md):
//   • quiz  = { id, question, options[4], answerIndex, explanation, passage? }
//   • pairs = { id, term, definition }                                (text-par)
//   • texts = { id, title, body }                                     (faktatext)
// quiz[] innehåller TVÅ slags frågor som lägena håller isär på "passage"-fältet:
//   • RÄKNE-frågorna nedan (utan passage) → driver Quiz, Kunskapsjakt och
//     Fånga sanningar (rena räkneuppgifter, ingen text att läsa).
//   • läsförståelse-frågorna i talsorter-lasforstaelse.mjs (MED passage) →
//     driver Läsförståelse (källtext visas ovanför varje fråga).
// Se src/game-shared.js (plainQuizPool) och src/games-quiz.js (startLasforstaelse)
// för uppdelningen, och src/validate.js för att blandningen är tillåten.
// ============================================================================

import { TALSORTER_TEXTS } from "./talsorter-texts.mjs";
import { TALSORTER_LASFORSTAELSE } from "./talsorter-lasforstaelse.mjs";

// --- Deterministisk slump (mulberry32) --------------------------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Talsorter (platsvärden) i ordning ental → tusental ---------------------
const PLACES = [
  { key: "ental", label: "ental", place: 1, idx: 0 },
  { key: "tiotal", label: "tiotal", place: 10, idx: 1 },
  { key: "hundratal", label: "hundratal", place: 100, idx: 2 },
  { key: "tusental", label: "tusental", place: 1000, idx: 3 },
];
const PLACE_NAME = { 0: "ental", 1: "tiotal", 2: "hundratal", 3: "tusental" };

// Format med mellanslag som tusentalsavskiljare: 3482 -> "3 482".
function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
// Siffran på en given plats i n (idx 0 = ental).
function digitAt(n, idx) {
  return Math.floor(n / Math.pow(10, idx)) % 10;
}
// Talets siffror som [ental, tiotal, hundratal, tusental].
function digits(n) {
  return PLACES.map((p) => digitAt(n, p.idx));
}
// Uppdelning i talsorter som text: "2 tusental, 3 hundratal, 4 tiotal, 5 ental".
function decompose(n) {
  return [3, 2, 1, 0]
    .map((idx) => `${digitAt(n, idx)} ${PLACE_NAME[idx]}`)
    .join(", ");
}

// --- Byggstenar för flervalsfrågor ------------------------------------------
// Skapa en MCQ av ett rätt svar + distraktorer. Distraktorerna avdubbleras mot
// facit, alternativen blandas deterministiskt och answerIndex räknas EFTER
// blandningen. Padding säkrar alltid exakt 4 unika alternativ.
function mcq(rng, correct, distractors, pad) {
  const out = [String(correct)];
  const seen = new Set(out);
  const push = (v) => {
    const s = String(v);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };
  for (const d of distractors) if (out.length < 4) push(d);
  for (const d of pad || []) if (out.length < 4) push(d);
  // Sista utväg: fyll med varianter så vi aldrig hamnar under 4 alternativ.
  let k = 1;
  while (out.length < 4) push(`${correct}${" ".repeat(k++)}`);
  // Deterministisk Fisher–Yates.
  const opts = out.slice(0, 4);
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return { options: opts, answerIndex: opts.indexOf(String(correct)) };
}

// Slumpa ett tal i ett åk4-vänligt intervall (upp till tusental).
function randNum(rng, min = 100, max = 9999) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ============================================================================
// QUIZ-generatorer – en funktion per frågetyp. Var och en returnerar objekt
// { id, question, options, answerIndex, explanation } med stabila id:n.
// ============================================================================

// 1) Vilken siffra står på plats X i talet N?
function genDigitAtPlace(rng, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const n = randNum(rng, 1000, 9999);
    const p = PLACES[1 + Math.floor(rng() * 3)]; // tiotal..tusental
    const correct = digitAt(n, p.idx);
    const others = digits(n).filter((d, idx) => idx !== p.idx);
    const { options, answerIndex } = mcq(rng, correct, others, [
      (correct + 1) % 10,
      (correct + 5) % 10,
    ]);
    out.push({
      id: `q-plats-${String(i).padStart(2, "0")}`,
      question: `Vilken siffra står på ${p.label}splatsen i talet ${fmt(n)}?`,
      options,
      answerIndex,
      explanation: `I ${fmt(n)} står ${correct} på ${p.label}splatsen.`,
    });
  }
  return out;
}

// 2) Vad är VÄRDET av en given siffra i talet N?
function genValueOfDigit(rng, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    let n = randNum(rng, 1000, 9999);
    // Välj en plats där siffran inte är 0 (så värdet blir meningsfullt).
    let p = PLACES[1 + Math.floor(rng() * 3)];
    if (digitAt(n, p.idx) === 0) n += p.place; // knuffa upp siffran från 0
    const d = digitAt(n, p.idx);
    const correct = d * p.place;
    const { options, answerIndex } = mcq(
      rng,
      fmt(correct),
      [fmt(d), fmt(d * p.place * 10), fmt(d * (p.place / 10 || 1))],
      [fmt(correct + p.place), fmt(d * 10)]
    );
    out.push({
      id: `q-varde-${String(i).padStart(2, "0")}`,
      question: `Vad är värdet av siffran ${d} i talet ${fmt(n)}?`,
      options,
      answerIndex,
      explanation: `Siffran ${d} står på ${p.label}splatsen, så den är värd ${d} × ${fmt(
        p.place
      )} = ${fmt(correct)}.`,
    });
  }
  return out;
}

// 3) Bygg tal ur talsorter: "T tusental, H hundratal, Z tiotal, E ental" -> tal.
function genBuildNumber(rng, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const t = 1 + Math.floor(rng() * 9);
    const h = Math.floor(rng() * 10);
    const z = Math.floor(rng() * 10);
    const e = Math.floor(rng() * 10);
    const n = t * 1000 + h * 100 + z * 10 + e;
    const desc = `${t} tusental, ${h} hundratal, ${z} tiotal och ${e} ental`;
    const { options, answerIndex } = mcq(
      rng,
      fmt(n),
      [fmt(t * 1000 + h * 10 + z * 100 + e), fmt(n + 100), fmt(n - 10)],
      [fmt(t * 1000 + z * 100 + h * 10 + e), fmt(n + 1)]
    );
    out.push({
      id: `q-bygg-${String(i).padStart(2, "0")}`,
      question: `Vilket tal är ${desc}?`,
      options,
      answerIndex,
      explanation: `${t}·1000 + ${h}·100 + ${z}·10 + ${e} = ${fmt(n)}.`,
    });
  }
  return out;
}

// 4) Jämför tal (>/<): vilket tal är störst / minst?
function genCompare(rng, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const base = randNum(rng, 1000, 8000);
    const set = new Set([base]);
    while (set.size < 4) {
      const delta = [1, 10, 100, 300, -20, -200][Math.floor(rng() * 6)];
      set.add(Math.max(0, base + delta * (1 + Math.floor(rng() * 5))));
    }
    const nums = [...set].slice(0, 4);
    const askMax = rng() < 0.5;
    const correct = askMax ? Math.max(...nums) : Math.min(...nums);
    // Alternativen ÄR talen själva (redan unika), blanda deterministiskt.
    const opts = nums.map(fmt);
    for (let k = opts.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [opts[k], opts[j]] = [opts[j], opts[k]];
    }
    out.push({
      id: `q-jmf-${String(i).padStart(2, "0")}`,
      question: `Vilket tal är ${askMax ? "störst" : "minst"}?`,
      options: opts,
      answerIndex: opts.indexOf(fmt(correct)),
      explanation: `Jämför talsort för talsort från vänster. ${fmt(correct)} är ${
        askMax ? "störst" : "minst"
      }.`,
    });
  }
  return out;
}

// 5) Växling: 10 av en talsort = 1 av nästa. Fyra frågemallar + slumpade tal ger
// variation; frågor avdubbleras på frågetexten så inga upprepas.
function genExchange(rng, count) {
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const from = Math.floor(rng() * 3); // 0..2 (lägre talsort)
    const lo = PLACE_NAME[from];
    const hi = PLACE_NAME[from + 1];
    const kind = Math.floor(rng() * 4);
    let question, correct, explanation, distractors;
    if (kind === 0) {
      question = `Hur många ${lo} växlar du för att få 1 ${hi}?`;
      correct = "10";
      distractors = ["1", "100", "1 000"];
      explanation = `Talsorterna hänger ihop tio och tio: 10 ${lo} = 1 ${hi}.`;
    } else if (kind === 1) {
      question = `Tio ${lo} är lika med …`;
      correct = `1 ${hi}`;
      distractors = [`10 ${hi}`, `1 ${lo}`, `100 ${lo}`];
      explanation = `10 ${lo} växlas upp till 1 ${hi}.`;
    } else if (kind === 2) {
      // "Hur många ental är k <sort>?"  (sort = tiotal/hundratal/tusental)
      const p = PLACES[1 + Math.floor(rng() * 3)];
      const k = 1 + Math.floor(rng() * 9);
      question = `Hur många ental är ${k} ${p.label}?`;
      correct = fmt(k * p.place);
      distractors = [fmt(k), fmt(k * p.place * 10), fmt(k * (p.place / 10))];
      explanation = `${k} ${p.label} = ${k} × ${fmt(p.place)} = ${fmt(k * p.place)} ental.`;
    } else {
      // "k <hi> är lika med hur många <lo>?"  -> k*10
      const k = 1 + Math.floor(rng() * 9);
      question = `${k} ${hi} är lika med hur många ${lo}?`;
      correct = fmt(k * 10);
      distractors = [fmt(k), fmt(k * 100), fmt(k)];
      explanation = `1 ${hi} = 10 ${lo}, så ${k} ${hi} = ${fmt(k * 10)} ${lo}.`;
    }
    if (seen.has(question)) continue;
    seen.add(question);
    const { options, answerIndex } = mcq(rng, correct, distractors);
    out.push({
      id: `q-vaxla-${String(out.length + 1).padStart(2, "0")}`,
      question,
      options,
      answerIndex,
      explanation,
    });
  }
  return out;
}

// 6) Dela upp tal i talsorter: N -> "T tusental, H hundratal, ...".
function genDecompose(rng, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const n = randNum(rng, 1000, 9999);
    const correct = decompose(n);
    const [e, z, h, t] = digits(n);
    // Distraktorer: kasta om två talsorter / förskjut en siffra.
    const swapHT = `${h} tusental, ${t} hundratal, ${z} tiotal, ${e} ental`;
    const shift = `${t} tusental, ${h} hundratal, ${e} tiotal, ${z} ental`;
    const wrong = `${t} tusental, ${z} hundratal, ${h} tiotal, ${e} ental`;
    const { options, answerIndex } = mcq(rng, correct, [swapHT, shift, wrong], [
      `${t} tusental, ${h} hundratal, ${z} tiotal`,
    ]);
    out.push({
      id: `q-dela-${String(i).padStart(2, "0")}`,
      question: `Hur delas ${fmt(n)} upp i talsorter?`,
      options,
      answerIndex,
      explanation: `${fmt(n)} = ${correct}.`,
    });
  }
  return out;
}

// ============================================================================
// PARS-generatorer – text-par som driver Para ihop, Memory och Fånga sanningar.
// ============================================================================

// a) Tal ↔ uppdelning i talsorter.
function genPairNumbers(rng, count) {
  const out = [];
  const seen = new Set();
  let i = 1;
  while (out.length < count) {
    const n = randNum(rng, 1000, 9999);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push({
      id: `p-tal-${String(i).padStart(2, "0")}`,
      term: fmt(n),
      definition: decompose(n),
    });
    i++;
  }
  return out;
}

// b) Talsort ↔ platsvärde (ental = 1, tiotal = 10, …). Fast, en per talsort.
function genPairPlaceValues() {
  return PLACES.map((p) => ({
    id: `p-sort-${p.key}`,
    term: `1 ${p.label}`,
    definition: fmt(p.place),
  }));
}

// c) Siffra-på-plats ↔ dess värde ("Siffran 7 på hundratalsplatsen" ↔ "700").
function genPairDigitValues(rng, count) {
  const out = [];
  const seen = new Set();
  let i = 1;
  while (out.length < count) {
    const d = 1 + Math.floor(rng() * 9);
    const p = PLACES[Math.floor(rng() * 4)];
    const key = `${d}@${p.idx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `p-siffra-${String(i).padStart(2, "0")}`,
      term: `Siffran ${d} på ${p.label}splatsen`,
      definition: fmt(d * p.place),
    });
    i++;
  }
  return out;
}

// ============================================================================
// Huvud-API: bygg hela innehållet. quiz[] = 140 RÄKNE-frågor (utan passage) +
// de handskrivna läsförståelse-frågorna (med passage) från
// talsorter-lasforstaelse.mjs. pairs ~50, texts 6. Läsförståelse-texterna är
// handskrivna och bor i talsorter-texts.mjs (importeras ovan).
// ============================================================================
export function generateTalsorter(seed = 20260908) {
  const rng = makeRng(seed);
  // De 140 rena räkne-frågorna (utan passage) – driver Quiz/Kunskapsjakt/Fånga
  // sanningar. Ordning + antal oförändrade (idempotent seed).
  const raknequiz = [
    ...genDigitAtPlace(rng, 27),
    ...genValueOfDigit(rng, 27),
    ...genBuildNumber(rng, 22),
    ...genCompare(rng, 24),
    ...genExchange(rng, 18),
    ...genDecompose(rng, 22),
  ];
  // Läggs SIST i quiz[]: läsförståelse-frågorna (med passage) driver enbart
  // Läsförståelse-läget. Se plainQuizPool i src/game-shared.js.
  const quiz = [...raknequiz, ...TALSORTER_LASFORSTAELSE];
  const pairs = [
    ...genPairNumbers(rng, 26),
    ...genPairPlaceValues(),
    ...genPairDigitValues(rng, 20),
  ];
  return { texts: TALSORTER_TEXTS, quiz, pairs };
}
