// ============================================================================
// Snilleblixten (format "snilleblixt", #556, epic #555): ren logik – ingen
// DOM, ingen Firebase. Testas i test/live-snilleblixt.test.js; regelgrenen
// (firestore.rules "Snilleblixten") kör samma planer i
// test/firestore-rules-live-snilleblixt.test.js.
//
// HELA KLASSEN SAMMA FRÅGA, läraren styr takten. Datamodellen
// (docs/DATAMODELL.md "Snilleblixten"):
//   liveSessions/{sid}               inställningar + q = PÅGÅENDE fråga (alla
//                                    inloggade läser): { index, phase, openedAt,
//                                    closedAt?, question, facit? }
//   liveSessions/{sid}/sbPrivate/snapshot  { questions[], facit[] } – frågorna
//                                    som ögonblicksbild, BARA lärare läser.
//                                    q.question kopieras därifrån när läraren
//                                    öppnar frågan, q.facit vid avslöjandet.
//   liveSessions/{sid}/sbAnswers/{i}_{uid}  elevens ENDA svar på fråga i:
//                                    { uid, classId, q, answerKind,
//                                    choiceIndex | answer, at = serverns tid }
//                                    – bara create. INGET isCorrect: eleven
//                                    får inte veta facit före avslöjandet.
//   liveSessions/{sid}/sbScores/{i}  frågans poäng (skrivs EN gång av läraren
//                                    vid avslöjandet/överhoppningen)
//
// POÄNG (§5.5): rätt = round(1000 − 500 × t/frågetid), t = svarets `at` −
// frågans `openedAt` – BÅDA serverstämplar. Fel/inget svar = 0. Lärarklienten
// räknar (scoreQuestion) ur verifierad data och skriver sbScores; reglerna
// kan inte räkna själva, för eleven vet inte request.time när hen skriver och
// får inte se facit. Klienten avgör aldrig sin poäng. Bara svar inom frågans
// fönster [openedAt, min(closedAt, openedAt + frågetid)) räknas.
//
// Filerna: snilleblixt-core.js (här: konstanter, ögonblicksbild,
// inställningar), snilleblixt-poang.js (poäng, ställning, result),
// snilleblixt-flode.js (lärarens övergångar + elevens svar som planer),
// snilleblixt-data.js (Firestore, LAT), index.js (format-objektet).
//
// API
//   SB_MIN_CLASSES / SB_MAX_CLASSES  1 / 3
//   SB_QUESTION_SECONDS   [10, 20, 30, 60]
//   SB_QUESTION_COUNTS    [5, 10, 15, 20, 0] – 0 = alla (bara quiz-område)
//   SB_DEFAULT_SECONDS    { free: 20, choice: 10 } – skriv själv tar längre tid
//   SB_MAX_QUESTIONS      100 (reglerna har samma tak)
//   SB_PRIVATE_DOC        ["sbPrivate", "snapshot"]
//   answerDocId(i, uid)   → "3_uid"
//   buildSnapshot(mode, { answerKind, count, shuffle, quiz?, quizSnapshot?, rng? })
//                         → { questions, facit } (elevsynligt / lärarskyddat)
//   validateSetup(input)  → string[] (antal frågor, tid per fråga)
//   buildSessionFields(input) → { questionSeconds, questionCount,
//                           shuffleQuestions, showQuestionOnStudent }
//   sessionTitle(s)       → "4B + 5E"
//   defaultSessionName(names) → "Snilleblixten 4B"
// ============================================================================

export const SB_MIN_CLASSES = 1;
export const SB_MAX_CLASSES = 3;
export const SB_QUESTION_SECONDS = [10, 20, 30, 60];
export const SB_QUESTION_COUNTS = [5, 10, 15, 20, 0];
export const SB_DEFAULT_SECONDS = { free: 20, choice: 10 };
export const SB_MAX_QUESTIONS = 100;
export const SB_PRIVATE_DOC = ["sbPrivate", "snapshot"];

const QUIZ_MODE = "plugga_quiz";

/** Svarsdokumentets id: ett svar per elev och fråga. */
export function answerDocId(index, uid) {
  return `${index}_${uid}`;
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ögonblicksbilden som kopieras in i sessionen (§4.4). Två index-parallella
 * listor: questions[i] elevsynligt (publiceras först när frågan öppnas),
 * facit[i] lärarskyddat (publiceras vid avslöjandet).
 *   multiplikation: count frågor ur motorn (createSource) – choice får fyra
 *     alternativ (mode.choices), free bara texten
 *   plugga_quiz:    områdets spelbara frågor (quizSnapshot = plugga-quiz-core
 *     buildQuizSnapshot, injiceras så att kärnan inte laddar quizkoden),
 *     count 0 = alla
 * @param {object} mode GameMode
 * @param {{ answerKind, count, shuffle, quiz?, quizSnapshot?, showPassage?, rng? }} opts
 */
export function buildSnapshot(mode, opts = {}) {
  const rng = opts.rng || Math.random;
  const kind = opts.answerKind;
  const count = Math.min(SB_MAX_QUESTIONS, Number(opts.count) || 0);
  const questions = [];
  const facit = [];
  if (mode?.id === QUIZ_MODE) {
    const snap = opts.quizSnapshot(opts.quiz, { count: count || undefined, shuffle: opts.shuffle !== false, showPassage: opts.showPassage === true, rng });
    snap.questions.slice(0, SB_MAX_QUESTIONS).forEach((q, i) => {
      const f = snap.facit[i];
      questions.push({ ...q, statKeys: mode.statKeys(q) });
      facit.push({ answerIndex: f.answerIndex, correctAnswer: q.options[f.answerIndex], explanation: f.explanation || "" });
    });
    return { questions, facit };
  }
  if (!(count > 0)) throw new Error("Snilleblixten: ange antal frågor");
  const src = mode.createSource({ rng });
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(src.next());
  (opts.shuffle === false ? picked : shuffle(picked, rng)).forEach((q, i) => {
    const pub = { key: `${i}:${q.key}`, text: q.text, statKeys: mode.statKeys(q) };
    const f = { correctAnswer: String(mode.checkAnswer(q, "").correctAnswer) };
    if (kind === "choice") {
      const c = mode.choices(q, rng);
      pub.options = c.options.map(String);
      f.answerIndex = c.answerIndex;
    }
    questions.push(pub);
    facit.push(f);
  });
  return { questions, facit };
}

/** Formatets egna inställningar. */
export function validateSetup(input) {
  const errs = [];
  const count = Number(input?.questionCount);
  if (!SB_QUESTION_COUNTS.includes(count)) errs.push("Välj antal frågor.");
  else if (count === 0 && input?.gameMode !== QUIZ_MODE) {
    errs.push("\"Alla\" går bara med quiz från ett område – välj 5–20 frågor.");
  }
  if (!SB_QUESTION_SECONDS.includes(Number(input?.questionSeconds))) errs.push("Välj tid per fråga.");
  return errs;
}

/**
 * Formatets fält på sessionsdokumentet. questionCount är det VALDA antalet –
 * live-data skriver om det till ögonblicksbildens faktiska längd (quiz-
 * området kan ha färre; "alla" = 0 → områdets alla).
 */
export function buildSessionFields(input) {
  return {
    questionSeconds: Number(input.questionSeconds),
    questionCount: Number(input.questionCount),
    shuffleQuestions: input.shuffleQuestions !== false,
    showQuestionOnStudent: input.showQuestionOnStudent !== false,
  };
}

/** "4B + 5E" – stor rubrik. */
export function sessionTitle(s) {
  return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" + ").toUpperCase();
}

/** Förslag på namn: "Snilleblixten 4B". */
export function defaultSessionName(names) {
  const n = (names || []).filter(Boolean);
  return n.length ? `Snilleblixten ${n.join(" + ")}` : "Snilleblixten";
}

