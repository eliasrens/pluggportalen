// ============================================================================
// Live-spelläget `plugga_quiz` – ren logik (#553, epic #550)
// ----------------------------------------------------------------------------
// Quizfrågorna i ett Plugga-arbetsområde (subjects/{s}/areas/{a}.quiz, formatet
// { id, question, options, answerIndex, explanation, passage?, category? })
// → Live-frågor med fyra (eller färre) alternativ. Ingen DOM, ingen Firebase.
// Testas i test/live-plugga-quiz.test.js.
//
// URVALET (prepareQuizQuestion) – en fråga används bara om den går att spela
// rättvist på fyra färgknappar:
//   passage   frågor med läsförståelsetext HOPPAS ÖVER (QUIZ_PASSAGE_POLICY).
//             Live är snabbt: projektorn visar frågan i 10–30 s och Guldrushen
//             går fråga på fråga – en hel källtext hinner ingen läsa. Plugga
//             har eget läsförståelseläge för dem. (Samma delning som Pluggas
//             plainQuizPool, men UTAN fallbacken "bara passage → ta alla".)
//   alternativ normaliseras (NFC, blanksteg ihop, trim). Alternativ som blir
//             LIKA efter normaliseringen slås ihop (första behålls) – annars
//             kunde två knappar visa samma text och bara en räknas som rätt.
//             answerIndex pekar om till det sammanslagna alternativet.
//             Färre än 2 eller fler än QUIZ_MAX_OPTIONS (4, en knapp per färg/
//             form, choiceIndex 0–3 i reglerna) kvar → frågan hoppas över.
//   dubbletter samma frågetext (normaliserad) två gånger i området → bara den
//             första används.
//   kategori  bara nycklar ur QUESTION_CATEGORY_KEYS (normalizeQuestionCategory);
//             okänd/saknad → ingen kategori (statistiken räknar den som "ovrig").
//
// FACIT (§4.4) – buildQuizSnapshot delar varje fråga i två index-parallella
// listor så att ett format kan lagra dem åtskilda:
//   questions[i]  ELEVSYNLIGT: { id, key, text, options, category? } – utan facit
//   facit[i]      LÄRAR-/SERVERSKYDDAT: { id, answerIndex, explanation }
//   joinFacit(questions[i], facit[i]) → hela frågan (lärarens/projektorns vy,
//   eller formatets avslöjande). Alternativens ordning blandas EN gång här, så
//   att projektorn och alla elever ser samma färg för samma svar.
//
// API
//   QUIZ_MAX_OPTIONS            4
//   QUIZ_DEFAULT_MIN_QUESTIONS  5 – varningströskel om formatet saknar minQuestions
//   QUIZ_PASSAGE_POLICY         "skip"
//   QUIZ_OTHER_CATEGORY         "ovrig" – statistiknyckel för frågor utan kategori
//   normalizeOptionText(s)      → "  Gustav  Vasa " → "Gustav Vasa"
//   prepareQuizQuestion(raw, i) → { ok: true, q } | { ok: false, reason }
//     reason: "passage" | "invalid" | "fa-alternativ" | "for-manga-alternativ"
//     q = { id, text, options, answerIndex, explanation, category? }
//   selectQuizQuestions(quiz)   → { usable: q[], skipped: { reason: n } } (+ "dubblett")
//   summarizeQuizArea(quiz, { minQuestions? }) → { total, usable, skipped,
//                                 minQuestions, tooFew, empty }
//   quizAreaMessage(summary, formatName?) → { level: "ok"|"warn"|"error", text }
//   minQuestionsFor(format)     → format.minQuestions ?? QUIZ_DEFAULT_MIN_QUESTIONS
//   buildQuizSnapshot(quiz, { count?, shuffle?, shuffleOptions?, rng? })
//                               → { questions, facit } (se FACIT ovan); count =
//                                 antal frågor (saknas/"alla" = alla användbara)
//   joinFacit(pub, facit)       → { ...pub, answerIndex, explanation }
//   checkQuizAnswer(q, raw)     → { valid, correct, given, correctAnswer }
//                                 (q utan facit → correct null: formatet rättar)
//   quizStatKeys(q)             → [kategori|"ovrig", "q:<id>"]
//   shuffled(arr, rng?)         → blandad kopia
// ============================================================================

import { QUESTION_CATEGORY_KEYS, normalizeQuestionCategory } from "../../exercise-types.js";

export const QUIZ_MAX_OPTIONS = 4;
export const QUIZ_DEFAULT_MIN_QUESTIONS = 5;
export const QUIZ_PASSAGE_POLICY = "skip";
export const QUIZ_OTHER_CATEGORY = "ovrig";

/** Jämförelseform för alternativ och frågetext: NFC, blanksteg ihop, trim. */
export function normalizeOptionText(s) {
  return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

const hasPassage = (q) => typeof q?.passage === "string" && q.passage.trim() !== "";

/**
 * En områdesfråga → Live-fråga, eller skälet till att den inte kan spelas.
 * @param {object} raw områdets quizfråga
 * @param {number} [i] plats i området (för id om det saknas)
 */
export function prepareQuizQuestion(raw, i = 0) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "invalid" };
  if (hasPassage(raw)) return { ok: false, reason: "passage" };
  const text = normalizeOptionText(raw.question);
  const ai = raw.answerIndex;
  if (!text || !Array.isArray(raw.options) || !Number.isInteger(ai) || ai < 0 || ai >= raw.options.length) {
    return { ok: false, reason: "invalid" };
  }
  const correctKey = normalizeOptionText(raw.options[ai]);
  if (!correctKey) return { ok: false, reason: "invalid" };
  const options = [];
  for (const o of raw.options) {
    const t = normalizeOptionText(o);
    if (t && !options.includes(t)) options.push(t);
  }
  if (options.length < 2) return { ok: false, reason: "fa-alternativ" };
  if (options.length > QUIZ_MAX_OPTIONS) return { ok: false, reason: "for-manga-alternativ" };
  const q = {
    id: normalizeOptionText(raw.id) || `q${i + 1}`,
    text,
    options,
    answerIndex: options.indexOf(correctKey),
    explanation: typeof raw.explanation === "string" ? raw.explanation.trim() : "",
  };
  const category = normalizeQuestionCategory(raw.category);
  if (category) q.category = category;
  return { ok: true, q };
}

/** Alla spelbara frågor i områdets ordning + hur många som hoppades över (per skäl). */
export function selectQuizQuestions(quiz) {
  const usable = [];
  const skipped = {};
  const seenText = new Set();
  const seenId = new Map();
  (Array.isArray(quiz) ? quiz : []).forEach((raw, i) => {
    const r = prepareQuizQuestion(raw, i);
    let reason = r.ok ? null : r.reason;
    if (r.ok && seenText.has(r.q.text)) reason = "dubblett";
    if (reason) {
      skipped[reason] = (skipped[reason] || 0) + 1;
      return;
    }
    seenText.add(r.q.text);
    // Unikt id i ögonblicksbilden (statistiken per fråga nycklar på det).
    const n = (seenId.get(r.q.id) || 0) + 1;
    seenId.set(r.q.id, n);
    if (n > 1) r.q.id = `${r.q.id}-${n}`;
    usable.push(r.q);
  });
  return { usable, skipped };
}

/** Varningströskeln för ett format (formatets minQuestions, annars 5). */
export function minQuestionsFor(format) {
  const n = format?.minQuestions;
  return Number.isInteger(n) && n >= 1 ? n : QUIZ_DEFAULT_MIN_QUESTIONS;
}

/** Vad läraren ser innan Skapa: hur många frågor området har och kan spelas. */
export function summarizeQuizArea(quiz, { minQuestions = QUIZ_DEFAULT_MIN_QUESTIONS } = {}) {
  const { usable, skipped } = selectQuizQuestions(quiz);
  const total = Array.isArray(quiz) ? quiz.length : 0;
  return {
    total,
    usable: usable.length,
    skipped,
    minQuestions,
    tooFew: usable.length < minQuestions,
    empty: usable.length === 0,
  };
}

const SKIP_TEXT = {
  passage: (n) => `${n} läsförståelse${n === 1 ? "fråga" : "frågor"} (med text att läsa)`,
  "for-manga-alternativ": (n) => `${n} med fler än ${QUIZ_MAX_OPTIONS} alternativ`,
  "fa-alternativ": (n) => `${n} med färre än 2 olika alternativ`,
  dubblett: (n) => `${n} ${n === 1 ? "dubblett" : "dubbletter"}`,
  invalid: (n) => `${n} ofullständig${n === 1 ? "" : "a"}`,
};

/** Lärarens rad under områdesvalet. level "error" = går inte att skapa. */
export function quizAreaMessage(s, formatName = "") {
  const fr = (n) => `${n} ${n === 1 ? "fråga" : "frågor"}`;
  const skip = Object.entries(s.skipped || {}).map(([k, n]) => (SKIP_TEXT[k] || ((m) => `${m} övriga`))(n));
  const skipText = skip.length ? ` Hoppas över: ${skip.join(", ")}.` : "";
  if (s.empty) {
    const why = s.total ? `Inga av områdets ${fr(s.total)} passar i Live.` : "Området har inga quizfrågor.";
    return { level: "error", text: `⛔ ${why}${skipText} Välj ett annat område.` };
  }
  if (s.tooFew) {
    const vem = formatName ? `${formatName} behöver` : "Det behövs";
    return {
      level: "warn",
      text: `⚠️ Bara ${fr(s.usable)} kan användas – för få. ${vem} minst ${s.minQuestions}.${skipText}`,
    };
  }
  return { level: "ok", text: `✅ ${fr(s.usable)} kan användas (av ${s.total} i området).${skipText}` };
}

/** Fisher–Yates-kopia (rng → [0,1)). */
export function shuffled(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ögonblicksbild för en session: valda frågor, uppdelade i elevsynligt + facit.
 * @param {object[]} quiz områdets quiz-lista
 * @param {{ count?: number|"alla", shuffle?: boolean, shuffleOptions?: boolean, rng?: () => number }} [opts]
 * @returns {{ questions: object[], facit: object[] }}
 */
export function buildQuizSnapshot(quiz, opts = {}) {
  const rng = opts.rng || Math.random;
  let picked = selectQuizQuestions(quiz).usable;
  if (opts.shuffle !== false) picked = shuffled(picked, rng);
  const n = Number(opts.count);
  if (Number.isInteger(n) && n > 0) picked = picked.slice(0, n);
  const questions = [];
  const facit = [];
  picked.forEach((q, i) => {
    let options = q.options;
    let answerIndex = q.answerIndex;
    if (opts.shuffleOptions !== false) {
      const order = shuffled(options.map((_, k) => k), rng);
      options = order.map((k) => q.options[k]);
      answerIndex = order.indexOf(q.answerIndex);
    }
    const pub = { id: q.id, key: `${i}:${q.id}`, text: q.text, options };
    if (q.category) pub.category = q.category;
    questions.push(pub);
    facit.push({ id: q.id, answerIndex, explanation: q.explanation });
  });
  return { questions, facit };
}

/** Elevsynlig fråga + dess facit → hela frågan. */
export function joinFacit(pub, facit) {
  if (!facit || facit.id !== pub.id) throw new Error(`plugga_quiz: facit saknas för fråga ${pub?.id}`);
  return { ...pub, answerIndex: facit.answerIndex, explanation: facit.explanation || "" };
}

/**
 * Rätta ett valt alternativ (raw = alternativets text). Frågan måste ha facit
 * (answerIndex) för att kunna rättas – utan facit är correct null.
 */
export function checkQuizAnswer(q, raw) {
  const given = normalizeOptionText(raw);
  if (!given || !q?.options?.some((o) => normalizeOptionText(o) === given)) {
    return { valid: false, correct: false, given: null, correctAnswer: null };
  }
  if (!Number.isInteger(q.answerIndex)) return { valid: true, correct: null, given, correctAnswer: null };
  const correctAnswer = normalizeOptionText(q.options[q.answerIndex]);
  return { valid: true, correct: given === correctAnswer, given, correctAnswer };
}

/** Statistiknycklar: kategorin (eller "ovrig") + frågan själv ("q:<id>"). */
export function quizStatKeys(q) {
  const cat = QUESTION_CATEGORY_KEYS.includes(q?.category) ? q.category : QUIZ_OTHER_CATEGORY;
  return [cat, `q:${q?.id}`];
}
