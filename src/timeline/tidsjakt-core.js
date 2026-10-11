// ============================================================================
// Tidsjakten (#599) – ren logik för träningsläget och för tidslinjefrågor i
// Quiz. Inga DOM-beroenden, testbar i node. Laddas bara dynamiskt (#271).
// ----------------------------------------------------------------------------
// Felpoäng (bara Tidsjaktens eget läge): 1 per års avvikelse, lägst är bäst.
//   1520 → 1520 / 1517 / 1528 ger 0 / 3 / 8 felpoäng.
//
// Stjärnor och mynt (förslag, redovisat i issue #599). Ett års fel väger olika
// tungt beroende på tidslinjen: på Vasatiden (~120 år) är 10 år mycket, på en
// översikt över 5 000 år nästan exakt. Därför en tolerans i år som följer
// områdets spann (samma spann för alla frågor, se areaSpan):
//   tolerans = max(1, round(spannets bredd / 100))
//   träff    = avvikelse ≤ tolerans
//   ★★★     snittavvikelse ≤ tolerans
//   ★★      snittavvikelse ≤ 5 × tolerans
//   ★       annars (den som spelar klart får alltid minst en stjärna)
// Mynt följer Quiz-formeln med träffar i stället för rätt svar:
//   2 × (3 + 2 × träffar + (alla exakt ? 2 : 0))  → 10 händelser = högst 50.
// Felpoängen påverkar inget annat läge.
//
// Quiz (§4): rätt svar = EXAKT år, ingen tolerans (quizets rättning är rätt/fel).
// I Quiz räknas tidslinjefrågan i kategorin "fakta" (ett årtal = "när").
// Tidslinjefrågorna läses ur samma area.timeline (ingen kopia). Hur många som
// blandas in per quizomgång styrs av timelineSlots().
// ============================================================================

import { areaSpan } from "./timeline-logic.js";
import { pickRotatingQuestions, questionKey, MAX_QUESTIONS_PER_SESSION } from "../question-rotation.js";

/** Högst så här många tidslinjefrågor i en quizomgång (resten vanliga frågor). */
export const QUIZ_TIMELINE_MAX = 3;
/** Rotationsnyckel (questionRotation[area][…]) för tidslinjefrågorna i Quiz. */
export const QUIZ_TIMELINE_ROTATION = "quiz-tidslinje";

/** Felpoäng för en gissning: 1 per års avvikelse. */
export function felpoang(guess, correct) {
  return Math.abs(Math.round(Number(guess)) - Math.round(Number(correct)));
}

/** Toleransen i år för träff/stjärnor, ur områdets spann { min, max }. */
export function toleransAr(span) {
  const w = Number(span?.max) - Number(span?.min);
  return Number.isFinite(w) && w > 0 ? Math.max(1, Math.round(w / 100)) : 1;
}

/**
 * Sammanfatta en omgång. `svar` = [{ guess, correct }].
 * @returns {{ antal:number, felpoang:number, exakt:number, traffar:number,
 *             snitt:number, tolerans:number }}
 *   snitt = genomsnittlig avvikelse i år, avrundad till en decimal.
 */
export function summeraOmgang(svar, span) {
  const tolerans = toleransAr(span);
  const lista = Array.isArray(svar) ? svar : [];
  let fel = 0;
  let exakt = 0;
  let traffar = 0;
  for (const s of lista) {
    const d = felpoang(s.guess, s.correct);
    fel += d;
    if (d === 0) exakt++;
    if (d <= tolerans) traffar++;
  }
  const antal = lista.length;
  const snitt = antal ? Math.round((fel / antal) * 10) / 10 : 0;
  return { antal, felpoang: fel, exakt, traffar, snitt, tolerans };
}

/** Stjärnor (1–3) ur en sammanfattning (se tabellen överst). */
export function stjarnorAv(sum) {
  if (!sum || !sum.antal) return 1;
  if (sum.snitt <= sum.tolerans) return 3;
  if (sum.snitt <= 5 * sum.tolerans) return 2;
  return 1;
}

/** Baspott pluggmynt (grind-skyddet läggs på i awardExercise). */
export function myntAv(sum) {
  const t = sum?.traffar || 0;
  const allaExakt = sum?.antal > 0 && sum.exakt === sum.antal;
  return 2 * (3 + 2 * t + (allaExakt ? 2 : 0));
}

/** "1 år" / "12 år" / "1,5 år" – för resultatsidan. */
export function arText(n) {
  const s = String(n).replace(".", ",");
  return `${s} år`;
}

/**
 * Områdets spelbara händelser (heltalsår + fråga), som frågeobjekt med
 * kind:"timeline". Samma objekt används av Tidsjakten och Quiz.
 */
export function timelineQuestions(area) {
  const list = Array.isArray(area?.timeline) ? area.timeline : [];
  return list
    .filter((e) => e && Number.isInteger(e.year) && typeof e.question === "string" && e.question.trim())
    .map((e) => ({
      kind: "timeline",
      id: e.id,
      event: String(e.event || ""),
      question: e.question.trim(),
      year: e.year,
      description: String(e.description || ""),
      explanation: String(e.explanation || ""),
      // Ett årtal är en "när"-fråga → kategorin fakta (vem, vad, var, när), så
      // Quiz kategoristatistik och "rätt på första försöket" räknar med den.
      category: "fakta",
    }));
}

/** Rotationsnyckel för en händelse (namn + år; en ändrad händelse = ny). */
export function timelineKey(q) {
  return questionKey({ question: `tidslinje:${q?.event}\u0000${q?.year}` });
}

/** Välj händelser till en ny Tidsjakt-omgång (max 10, roterande urval). */
export function pickTidsjakt(area, seen, limit = MAX_QUESTIONS_PER_SESSION) {
  return pickRotatingQuestions(timelineQuestions(area), seen, limit, timelineKey);
}

/**
 * Hur många tidslinjefrågor en quizomgång får: i proportion till poolerna,
 * minst 1 (om området har några) och högst QUIZ_TIMELINE_MAX, så Quiz förblir
 * ett quiz med inslag av tidslinjen.
 */
export function timelineSlots(quizCount, timelineCount, limit = MAX_QUESTIONS_PER_SESSION) {
  const q = Math.max(0, quizCount | 0);
  const t = Math.max(0, timelineCount | 0);
  if (t === 0) return 0;
  const andel = Math.round((limit * t) / (q + t || 1));
  return Math.min(t, QUIZ_TIMELINE_MAX, Math.max(1, andel));
}

/**
 * Blanda in tidslinjefrågor i en quizomgång. `quizPick(limit)` väljer de vanliga
 * frågorna (med quizets egen rotation, oförändrad); tidslinjefrågorna roteras för
 * sig under QUIZ_TIMELINE_ROTATION. Ordningen blandas av runQuestions.
 * @returns {{ timeline: object[], seen: string[], quizLimit: number, span: {min,max} }}
 */
export function planQuizTimeline(area, quizCount, seenTimeline, limit = MAX_QUESTIONS_PER_SESSION) {
  const pool = timelineQuestions(area);
  const slots = timelineSlots(quizCount, pool.length, limit);
  const span = areaSpan(area);
  if (slots === 0) return { timeline: [], seen: [], quizLimit: limit, span };
  const { questions, seen } = pickRotatingQuestions(pool, seenTimeline, slots, timelineKey);
  return { timeline: questions.map((q) => ({ ...q, span })), seen, quizLimit: limit - questions.length, span };
}
