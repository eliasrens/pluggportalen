// ============================================================================
// Snilleblixten (#556): FLÖDET – lärarens övergångar och elevens svar som
// rena planer (ingen Firebase). snilleblixt-data.js kör dem i transaktioner;
// regeltesterna kör samma planer mot emulatorn.
//
// FASER per fråga (q.phase): open → closed → revealed, eller open|closed →
// skipped. "Nästa" (open) öppnar index + 1 från revealed/skipped. planStep()
// utgår från AKTUELLT läge och förväntat index (fromIndex): två lärare som
// trycker samtidigt ger exakt ett steg – den andra blir noop (reglerna nekar
// dessutom ett dubbelsteg).
//
// API
//   SB_CONNECTED_MS       75 s – äldre puls räknas inte som ansluten
//   canAnswer(s, player)  → får eleven svara på pågående fråga? Sen anslutning
//                           (joinedAt ≥ openedAt) = från nästa fråga (§5.7)
//   answerProgress(s, { answers, players, now }) → { answered, eligible, all }
//                           ("17 av 24 har svarat")
//   autoCloseReason(s, { answers, players, now }) → "alla" | "tid" | null
//   planStep(s, action, { fromIndex, snapshot?, answers?, fv }) → { patch,
//                           scores? } | { noop }  action open|close|reveal|skip|finish
//   planAnswer({ sid, s, uid, classId, choiceIndex?, answer?, year?, fv }) → Write
//                           { path, data } – EN create, utan facit/poäng.
//                           Svarssättet = FRÅGANS (#600): en tidslinjefråga
//                           kräver year (heltal inom q.question.span) och
//                           answerKind "timeline"; fel form kastar
//                           (answer-writes answerShapeError – reglerna nekar också)
//   sbMultRecord(s, { choiceIndex?, answer? }) → { record, isCorrect } | null
//                           Mattematchen (#847): multiplikationssvaret som MM-
//                           post (faktorerna ur frågans nyckel "i:7x8", valt
//                           alternativ eller skrivet tal). null = inte
//                           multiplikation / ogiltigt tal → räknas inte i MM.
// ============================================================================

import { toMs } from "../../live-time.js";
import { answerDocId } from "./snilleblixt-core.js";
import { scoreQuestion, questionWindow } from "./snilleblixt-poang.js";
import { questionAnswerKind, answerShapeError, MULT_MODE } from "../../../tavling/answer-writes.js";
import { makeQuestion, checkMultAnswer } from "../../../mult/generator.js";

// Puls äldre än så → eleven räknas inte som "ansluten" vid auto-stängning.
export const SB_CONNECTED_MS = 75_000;

const fresh = (p, now) => {
  const seen = toMs(p?.lastSeenAt);
  return now == null || seen == null || now - seen <= SB_CONNECTED_MS;
};

/** Får eleven svara på pågående fråga? Sen anslutning = från nästa fråga (§5.7). */
export function canAnswer(s, player) {
  const q = s?.q;
  if (s?.status !== "live" || q?.phase !== "open" || !player) return false;
  const joined = toMs(player.joinedAt);
  const opened = toMs(q.openedAt);
  return joined != null && opened != null && joined < opened;
}

/** "17 av 24 har svarat": svar på pågående fråga / anslutna som får svara. */
export function answerProgress(s, { answers = [], players = [], now = null } = {}) {
  const q = s?.q;
  const done = new Set((answers || []).filter((a) => a && a.q === q?.index).map((a) => a.uid));
  const eligible = (players || []).filter((p) => canAnswer(s, p) && fresh(p, now));
  const answered = eligible.filter((p) => done.has(p.uid)).length;
  return { answered, eligible: eligible.length, all: eligible.length > 0 && answered === eligible.length };
}

/** Ska lärarklienten stänga frågan nu? "alla" (alla anslutna svarat) | "tid" | null. */
export function autoCloseReason(s, { answers = [], players = [], now = null } = {}) {
  if (s?.status !== "live" || s?.q?.phase !== "open") return null;
  if (answerProgress(s, { answers, players, now }).all) return "alla";
  const win = questionWindow(s.q, s.questionSeconds);
  return win && now != null && now >= win.endMs ? "tid" : null;
}

/**
 * En lärarövergång ur AKTUELLT läge (körs i en transaktion på sessionen).
 * fromIndex = frågan läraren såg när hen tryckte (−1 = ingen öppnad än).
 * Stämmer inte läget → { noop: skäl } (t.ex. en annan lärare hann före).
 * Annars { patch } (update-fält, punktnotation) + vid reveal/skip
 * { scores } = sbScores-dokumentet. fv.serverTimestamp() = serverns tid.
 * @param {object} s sessionen
 * @param {"open"|"close"|"reveal"|"skip"|"finish"} action
 * @param {{ fromIndex?, snapshot?, answers?, fv }} ctx
 */
export function planStep(s, action, { fromIndex = -1, snapshot = null, answers = [], fv } = {}) {
  if (!s) return { noop: "saknas" };
  if (action === "finish") {
    if (!["lobby", "live"].includes(s.status)) return { noop: "redan slut" };
    return { patch: { status: "finished", finishedAt: fv.serverTimestamp() } };
  }
  if (s.status !== "live") return { noop: "inte igång" };
  const q = s.q || null;
  const cur = q ? q.index : -1;
  if (cur !== fromIndex) return { noop: "annat index" };
  if (action === "open") {
    if (q && !["revealed", "skipped"].includes(q.phase)) return { noop: "frågan pågår" };
    const index = cur + 1;
    if (index >= s.questionCount) return { noop: "sista frågan" };
    const question = snapshot?.questions?.[index];
    if (!question) throw new Error(`Snilleblixten: fråga ${index} saknas i ögonblicksbilden`);
    return { patch: { q: { index, phase: "open", openedAt: fv.serverTimestamp(), question } } };
  }
  if (!q) return { noop: "ingen fråga" };
  if (action === "close") {
    if (q.phase !== "open") return { noop: "inte öppen" };
    return { patch: { "q.phase": "closed", "q.closedAt": fv.serverTimestamp() } };
  }
  if (action === "skip") {
    if (!["open", "closed"].includes(q.phase)) return { noop: "kan inte hoppas över" };
    const patch = { "q.phase": "skipped" };
    if (q.phase === "open") patch["q.closedAt"] = fv.serverTimestamp();
    return {
      patch,
      scores: scoreQuestion({ q, facit: null, answers, questionSeconds: s.questionSeconds, answerKind: s.answerKind, skipped: true }),
    };
  }
  if (action === "reveal") {
    if (q.phase !== "closed") return { noop: "inte stängd" };
    const facit = snapshot?.facit?.[q.index];
    if (!facit) throw new Error(`Snilleblixten: facit ${q.index} saknas`);
    return {
      patch: { "q.phase": "revealed", "q.facit": facit },
      scores: scoreQuestion({ q, facit, answers, questionSeconds: s.questionSeconds, answerKind: s.answerKind }),
    };
  }
  throw new Error(`Snilleblixten: okänd övergång ${action}`);
}

/**
 * Elevens svar → EN skrivning (create). choiceIndex (flerval), answer (skriv
 * själv, rå sträng) eller year (tidslinjefråga, #600). Facit och poäng
 * skickas aldrig.
 */
export function planAnswer({ sid, s, uid, classId, choiceIndex, answer, year, fv }) {
  const index = s?.q?.index;
  if (!Number.isInteger(index)) throw new Error("Snilleblixten: ingen pågående fråga");
  const kind = questionAnswerKind(s.q.question, s.answerKind);
  const data = { uid, classId, q: index, answerKind: kind, at: fv.serverTimestamp() };
  if (kind === "timeline") {
    const err = answerShapeError({ kind, choiceIndex, answer, year, span: s.q.question?.span });
    if (err) throw new Error(`Snilleblixten: ${err}`);
    data.year = year;
  } else if (kind === "choice") {
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3) throw new Error("Snilleblixten: choiceIndex 0–3 krävs");
    data.choiceIndex = choiceIndex;
  } else {
    const t = String(answer ?? "").trim();
    if (!t) throw new Error("Snilleblixten: tomt svar");
    data.answer = t.slice(0, 40);
  }
  return { path: ["liveSessions", sid, "sbAnswers", answerDocId(index, uid)], data };
}

/**
 * Mattematchen (#847): elevens multiplikationssvar som MM-post. Facit behövs
 * inte – a·b räknar reglerna om själva – så MM-delen kan följa med svaret.
 */
export function sbMultRecord(s, { choiceIndex, answer } = {}) {
  const fraga = s?.q?.question;
  if (s?.gameMode !== MULT_MODE || !fraga) return null;
  const m = /(?:^|:)(\d{1,2})x(\d{1,2})$/.exec(String(fraga.key || ""));
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a > 10 || b > 10) return null;
  const raw = Number.isInteger(choiceIndex) ? fraga.options?.[choiceIndex] : answer;
  const r = checkMultAnswer(makeQuestion(a, b), raw);
  if (!r.valid) return null;
  return { record: { factorA: a, factorB: b, answer: r.given, correctAnswer: a * b }, isCorrect: r.correct };
}
