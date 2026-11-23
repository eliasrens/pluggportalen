// ============================================================================
// Lästexten till en quizfråga (#582, utbruten i #905) – ren, inga importer.
// ----------------------------------------------------------------------------
// Regeln för frågor med en kort lästext (quiz[].passage) som Live-läget
// plugga_quiz (plugga-quiz-core.js prepareQuizQuestion) och Matchdagens
// Plugga-källa (src/matchdagen/md-lastext.js, på servern en kopia via
// npm run sync:matchdagen) delar:
//   passageCheck(raw, { allowPassage?, showPassage?, maxPassage? })
//     → { passage, reason }   passage = normaliserad text ("" = ingen),
//                             reason = null (frågan kan användas) eller
//     "passage"       frågan har lästext men den får inte användas
//     "lang-passage"  lästexten visas men är längre än maxPassage tecken
//     "kraver-text"   lästexten visas inte och frågan hänvisar till den
//   QUIZ_PASSAGE_MAX            300 – Live-gränsen (tecken) för en lästext som visas
//   QUIZ_TEXT_REF_WORDS         ord som visar att frågan kräver texten
//   normalizeOptionText(s)      NFC, blanksteg ihop, trim
//   hasPassage(q)               har frågan en lästext?
//   refersToText(text)          hänvisar frågetexten till texten?
// ============================================================================

export const QUIZ_PASSAGE_MAX = 300;
/** Frågetext med något av dessa (skiftlägesokänsligt) kräver texten – rutan av → hoppas över. */
export const QUIZ_TEXT_REF_WORDS = Object.freeze([
  "texten", "enligt", "berättelsen", "författaren", "i stycket", "ovan", "i dikten",
]);

/** Jämförelseform för alternativ och frågetext: NFC, blanksteg ihop, trim. */
export function normalizeOptionText(s) {
  return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

export const hasPassage = (q) => typeof q?.passage === "string" && q.passage.trim() !== "";

/** Kräver frågetexten den (dolda) texten? "Enligt texten …", "Vad gör författaren …" */
export function refersToText(text) {
  const t = normalizeOptionText(text).toLocaleLowerCase("sv");
  return QUIZ_TEXT_REF_WORDS.some((w) => new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, "u").test(t));
}

/**
 * Lästext-regeln för en fråga.
 * @param {object} raw områdets quizfråga
 * @param {{ allowPassage?: boolean, showPassage?: boolean, maxPassage?: number }} [opts]
 *   allowPassage frågor med lästext får användas (utan texten); showPassage texten
 *   följer med frågan; maxPassage längsta text som visas (standard QUIZ_PASSAGE_MAX)
 * @returns {{ passage: string, reason: null|"passage"|"lang-passage"|"kraver-text" }}
 */
export function passageCheck(raw, { allowPassage = false, showPassage = false, maxPassage = QUIZ_PASSAGE_MAX } = {}) {
  const passage = hasPassage(raw) ? normalizeOptionText(raw.passage) : "";
  if (!passage) return { passage, reason: null };
  if (!allowPassage && !showPassage) return { passage, reason: "passage" };
  if (showPassage && passage.length > maxPassage) return { passage, reason: "lang-passage" };
  if (!showPassage && refersToText(raw.question)) return { passage, reason: "kraver-text" };
  return { passage, reason: null };
}
