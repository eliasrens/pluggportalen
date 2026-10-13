// ============================================================================
// Kistspel – RÄTTNINGEN på servern (functions/kistspel-rattning.js, #563/#601,
// utbruten ur Guldrushen #651 – gemensam för alla kistformat)
// ----------------------------------------------------------------------------
// Ren logik utan Firestore: answerQuestion (kistspel-core.js) läser sessionen,
// formatets publika frågor och privata facit i sin transaktion och låter den
// här filen avgöra rätt/fel och svarsdokumentets fält. Testas via Guldrushen
// i test/functions-guldrush-core.test.mjs (+ tidslinje: …-tidslinje.test.mjs).
//
//   multiplikation  facit räknas om (a·b); flerval kräver choiceIndex 0–3
//   quiz/flerval    mot facit[q].answerIndex; bara den fråga servern gav (nextQ)
//   quiz/tidslinje  (#601, epic #595) frågan har kind "timeline" i grPublic:
//                   svaret = { q, year } – heltalsår inom frågans span (ur
//                   grPublic, aldrig ur anropet), inget choiceIndex/answer.
//                   Facit = facit[q].year; exakt år = rätt.
//
// API
//   KsError(code, message)        HttpsError-kod + svenskt meddelande
//                                 (guldrush-rattning.js: samma klass som GrError)
//   gradeMult(s, raw)             → svarsdokumentets fält (mode multiplikation)
//   gradeQuiz(s, raw, g, pub, priv) → svarsdokumentets fält (flerval/tidslinje)
//   pickNextQ(n, cur, rng)        → nästa frågeindex, aldrig samma två i rad
//   yearOut(a)                    → { correctYear } för ett tidslinjesvar, annars {}
//   yearText(y)                   → "1523" | "500 f.Kr." (som tidslinjen)
// ============================================================================

const MULT = "multiplication_0_10";
const QUIZ = "plugga_quiz";

/** Fel med en HttpsError-kod (index.js översätter) och ett svenskt meddelande. */
export class KsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const bad = (msg) => new KsError("invalid-argument", msg);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function parseInt0(v) {
  if (Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\s*\d{1,4}\s*$/.test(v)) return Number(v.trim());
  return null;
}

/** Multiplikation: facit räknas om här – samma fält som Klassmatchens svar. */
export function gradeMult(s, raw) {
  const a = raw?.factorA;
  const b = raw?.factorB;
  if (!isInt(a, 0, 10) || !isInt(b, 0, 10)) throw bad("Ogiltig fråga.");
  const answer = parseInt0(raw?.answer);
  if (answer == null || answer > 9999) throw bad("Ogiltigt svar.");
  const doc = { mode: MULT, factorA: a, factorB: b, answer, correctAnswer: a * b, isCorrect: answer === a * b };
  if (s.answerKind === "choice") {
    if (!isInt(raw?.choiceIndex, 0, 3)) throw bad("Välj ett av alternativen.");
    Object.assign(doc, { answerKind: "choice", choiceIndex: raw.choiceIndex });
  } else if (raw?.choiceIndex != null) {
    throw bad("Den här matchen har skriv själv – inga alternativ.");
  }
  return doc;
}

/** "1523" / "500 f.Kr." – samma som tidslinjen (src/timeline/timeline-logic.js formatYear). */
export const yearText = (y) => (y < 0 ? `${-y} f.Kr.` : String(y));

/** Tidslinjefråga (#601): bara ett heltalsår inom frågans spann, inget annat svarsfält. */
function gradeTimeline(question, f, q, raw) {
  if (raw?.choiceIndex !== undefined || raw?.answer !== undefined) throw bad("Svara med tidslinjen – bara ett årtal.");
  const span = question.span;
  const year = raw?.year;
  if (!span || !Number.isInteger(span.min) || !Number.isInteger(span.max) || !Number.isInteger(f.year)) {
    throw bad("Ogiltig fråga.");
  }
  if (!isInt(year, span.min, span.max)) throw bad("Välj ett årtal på tidslinjen.");
  return {
    mode: QUIZ, answerKind: "timeline", q, questionId: String(question.id ?? q), year,
    answer: yearText(year), correctAnswer: yearText(f.year), correctYear: f.year, isCorrect: year === f.year,
    statKeys: (question.statKeys || []).filter((k) => typeof k === "string"),
  };
}

/** Quiz: mot det lärarskyddade facit, bara den fråga servern gett eleven. */
export function gradeQuiz(s, raw, g, pub, priv) {
  const questions = pub?.questions || [];
  const facit = priv?.facit || [];
  const q = raw?.q;
  if (!isInt(q, 0, questions.length - 1) || !facit[q]) throw bad("Ogiltig fråga.");
  if (g?.nextQ != null && q !== g.nextQ) throw new KsError("failed-precondition", "Svara på frågan du fick.");
  if (questions[q].kind === "timeline") return gradeTimeline(questions[q], facit[q], q, raw);
  if (raw?.year !== undefined) throw bad("Välj ett av alternativen.");
  const opts = questions[q].options || [];
  const ci = raw?.choiceIndex;
  if (s.answerKind !== "choice" || !isInt(ci, 0, opts.length - 1)) throw bad("Välj ett av alternativen.");
  const ai = facit[q].answerIndex;
  return {
    mode: QUIZ, answerKind: "choice", q, questionId: String(questions[q].id ?? q), choiceIndex: ci,
    answer: String(opts[ci]), correctAnswer: String(opts[ai] ?? ""), isCorrect: ci === ai,
    statKeys: (questions[q].statKeys || []).filter((k) => typeof k === "string"),
  };
}

/** Nästa quizfråga: slumpad, aldrig samma två gånger i rad. */
export function pickNextQ(n, cur, rng) {
  if (n <= 1) return 0;
  const i = Math.floor(rng() * (n - 1));
  return i >= cur ? i + 1 : i;
}

/** Tidslinjesvar: rätt år som tal (elevens tidslinje visar det vid fel svar). */
export const yearOut = (a) => (Number.isInteger(a.correctYear) ? { correctYear: a.correctYear } : {});
