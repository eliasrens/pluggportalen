// ============================================================================
// Tidsjakten (#599): felpoäng, resultat, stjärnor/mynt och blandningen av
// tidslinjefrågor i Quiz (planQuizTimeline + runQuestions med en renderare för
// tidslinjen). Ren logik + en pytteliten låtsas-DOM för runQuestions.
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  felpoang,
  summeraOmgang,
  stjarnorAv,
  myntAv,
  toleransAr,
  arText,
  timelineQuestions,
  timelineSlots,
  planQuizTimeline,
  pickTidsjakt,
  QUIZ_TIMELINE_MAX,
} from "../src/timeline/tidsjakt-core.js";
import { parseAndValidateArea } from "../src/validate.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";

const VASA = { min: 1500, max: 1580 };

// --- Felpoäng + resultat ------------------------------------------------------

test("felpoäng: 1 per års avvikelse (1520 → 1520/1517/1528 = 0/3/8)", () => {
  assert.equal(felpoang(1520, 1520), 0);
  assert.equal(felpoang(1517, 1520), 3);
  assert.equal(felpoang(1528, 1520), 8);
  assert.equal(felpoang(-510, -500), 10); // f.Kr. räknas likadant
});

test("summeraOmgang: antal, totala felpoäng, exakt rätt, snittavvikelse", () => {
  const sum = summeraOmgang(
    [
      { guess: 1520, correct: 1520 },
      { guess: 1517, correct: 1520 },
      { guess: 1528, correct: 1520 },
    ],
    VASA
  );
  assert.equal(sum.antal, 3);
  assert.equal(sum.felpoang, 11);
  assert.equal(sum.exakt, 1);
  assert.equal(sum.snitt, 3.7); // 11/3 avrundat till en decimal
  assert.equal(sum.tolerans, 1);
  assert.equal(sum.traffar, 1);
  assert.equal(arText(sum.snitt), "3,7 år");
  assert.deepEqual(summeraOmgang([], VASA), { antal: 0, felpoang: 0, exakt: 0, traffar: 0, snitt: 0, tolerans: 1 });
});

test("toleransen följer områdets spann (1 % av bredden, minst 1 år)", () => {
  assert.equal(toleransAr(VASA), 1);
  assert.equal(toleransAr({ min: 1500, max: 1700 }), 2);
  assert.equal(toleransAr({ min: -3000, max: 2000 }), 50);
  assert.equal(toleransAr(null), 1);
});

test("stjärnor ur snittavvikelsen: ≤ tolerans 3, ≤ 5 × tolerans 2, annars 1", () => {
  const s = (snitt) => stjarnorAv({ antal: 5, snitt, tolerans: 1 });
  assert.equal(s(0), 3);
  assert.equal(s(1), 3);
  assert.equal(s(1.2), 2);
  assert.equal(s(5), 2);
  assert.equal(s(5.1), 1);
  assert.equal(stjarnorAv({ antal: 0, snitt: 0, tolerans: 1 }), 1);
});

test("mynt följer Quiz-formeln med träffar; perfekt 10-omgång = 50", () => {
  assert.equal(myntAv({ antal: 10, exakt: 10, traffar: 10 }), 50);
  assert.equal(myntAv({ antal: 10, exakt: 0, traffar: 0 }), 6);
  assert.equal(myntAv({ antal: 10, exakt: 3, traffar: 5 }), 26);
});

// --- Händelser + urval ---------------------------------------------------------

const vasaArea = () => parseAndValidateArea(VASATIDEN_JSON).value;

test("timelineQuestions: samma area.timeline, kind 'timeline', utan alternativ", () => {
  const area = vasaArea();
  const qs = timelineQuestions(area);
  assert.equal(qs.length, 5);
  for (const q of qs) {
    assert.equal(q.kind, "timeline");
    assert.equal(q.options, undefined);
    assert.equal(q.answerIndex, undefined);
    assert.equal(q.category, "fakta");
  }
  assert.deepEqual(qs.map((q) => q.year), [1520, 1523, 1527, 1541, 1560]);
  // Trasiga händelser (inget heltalsår / ingen fråga) hoppas över.
  assert.equal(timelineQuestions({ timeline: [{ question: "?", year: "x" }, { question: "", year: 1 }] }).length, 0);
});

test("pickTidsjakt: max 10 per omgång, roterar osedda händelser", () => {
  const timeline = Array.from({ length: 14 }, (_, i) => ({ event: `H${i}`, question: `Fråga ${i}?`, year: 1500 + i }));
  const first = pickTidsjakt({ timeline }, []);
  assert.equal(first.questions.length, 10);
  const second = pickTidsjakt({ timeline }, first.seen);
  const firstKeys = new Set(first.questions.map((q) => q.event));
  // De 4 osedda kommer först i nästa omgång.
  assert.equal(second.questions.filter((q) => !firstKeys.has(q.event)).length, 4);
});

test("timelineSlots: proportionellt, minst 1, högst QUIZ_TIMELINE_MAX", () => {
  assert.equal(timelineSlots(10, 0), 0);
  assert.equal(timelineSlots(20, 1), 1);
  assert.equal(timelineSlots(20, 2), 1);
  assert.equal(timelineSlots(10, 5), 3);
  assert.equal(timelineSlots(2, 20), QUIZ_TIMELINE_MAX);
  assert.equal(timelineSlots(0, 2), 2);
});

test("planQuizTimeline: Vasatiden ger 3 tidslinjefrågor + plats för 7 quizfrågor", () => {
  const area = vasaArea();
  const plan = planQuizTimeline(area, area.quiz.length, []);
  assert.equal(plan.timeline.length, timelineSlots(area.quiz.length, 5));
  assert.equal(plan.quizLimit, 10 - plan.timeline.length);
  assert.deepEqual(plan.span, VASA); // lärarens timelineSpan, inte frågans svar
  for (const q of plan.timeline) assert.deepEqual(q.span, VASA);
  // Gamla områden utan tidslinje: inget ändras.
  const old = planQuizTimeline({ quiz: area.quiz }, area.quiz.length, []);
  assert.deepEqual(old.timeline, []);
  assert.equal(old.quizLimit, 10);
});

// --- runQuestions med tidslinjefrågor -------------------------------------------
// Pytteliten låtsas-DOM: game-questions.js bygger kort via <template>.innerHTML.

function node() {
  return {
    listeners: {},
    kids: [],
    dataset: {},
    classList: { add() {} },
    addEventListener(t, f) { this.listeners[t] = f; },
    replaceChildren(...c) { this.kids = c; },
    prepend() {},
    scrollIntoView() {},
    focus() {},
  };
}

function installDom() {
  globalThis.document = {
    createElement(tag) {
      const n = node();
      if (tag !== "template") return n;
      let wrap = null;
      Object.defineProperty(n, "innerHTML", {
        set(html) {
          wrap = node();
          wrap.html = html;
          wrap.opts = [...html.matchAll(/data-idx="(\d+)">([^<]*)</g)].map(([, i, text]) => {
            const b = node();
            b.dataset.idx = i;
            b.text = text;
            return b;
          });
          wrap.fb = node();
          wrap.next = node();
          wrap.querySelector = (s) => (s === "#fb" ? wrap.fb : wrap.next);
          wrap.querySelectorAll = () => wrap.opts;
        },
      });
      n.content = { get firstElementChild() { return wrap; } };
      return n;
    },
  };
}

const QUIZ = [
  { question: "Vem blev kung?", options: ["Gustav Vasa", "Erik XIV"], answerIndex: 0 },
  { question: "Vad är reformationen?", options: ["Kyrkan blev protestantisk", "En flagga"], answerIndex: 0 },
  { question: "Var hölls riksdagen?", options: ["Västerås", "Lund"], answerIndex: 0 },
];
const TL = [
  { kind: "timeline", event: "Blodbadet", question: "Vilket år inträffade Stockholms blodbad?", year: 1520, span: VASA },
  { kind: "timeline", event: "Kung", question: "Vilket år valdes Gustav Vasa?", year: 1523, span: VASA },
];

/**
 * Kör en omgång. answerTimeline(q, n) → true/false (rätt/fel för n:te visningen).
 * Returnerar ordningen som visades + onFinish-resultatet.
 */
async function play({ questions, withTimeline = true, answerTimeline = () => true }) {
  installDom();
  const { runQuestions } = await import("../src/game-questions.js");
  const body = node();
  const shown = [];
  const cleaned = [];
  const timesSeen = new Map();
  let finished = null;
  const renderTimeline = ({ q, onAnswer, onNext, setCleanup }) => {
    const card = node();
    card.timeline = q;
    setCleanup(() => cleaned.push(q.question));
    card.answer = () => {
      const n = (timesSeen.get(q.question) || 0) + 1;
      timesSeen.set(q.question, n);
      onAnswer(answerTimeline(q, n));
      onNext();
    };
    return card;
  };
  runQuestions({
    body,
    questions,
    renderTimeline: withTimeline ? renderTimeline : undefined,
    onFinish: (correct, total) => (finished = { correct, total }),
  });
  for (let guard = 0; !finished && guard < 50; guard++) {
    const card = body.kids[0];
    if (card.timeline) {
      shown.push(`tl:${card.timeline.year}`);
      card.answer();
      continue;
    }
    assert.ok(!/Vilket år/.test(card.html), "en tidslinjefråga får aldrig bli flerval");
    const q = QUIZ.find((x) => card.html.includes(x.question));
    shown.push(`quiz:${q.question}`);
    const right = card.opts.find((b) => b.text === q.options[q.answerIndex]);
    right.listeners.pointerdown();
    right.listeners.click({ detail: 1 });
    card.next.kids[0].listeners.click();
  }
  return { shown, finished, cleaned };
}

test("Quiz-blandning: tidslinjefrågor besvaras via tidslinjen, inom samma omgång", async () => {
  const { shown, finished, cleaned } = await play({ questions: [...QUIZ, ...TL] });
  assert.equal(finished.total, 5);
  assert.equal(finished.correct, 5);
  assert.equal(shown.filter((s) => s.startsWith("tl:")).length, 2);
  assert.equal(shown.filter((s) => s.startsWith("quiz:")).length, 3);
  assert.equal(cleaned.length, 2, "varje tidslinjekort städas när det byts ut");
});

test("Quiz-blandning: fel år köas om som vanliga frågor och räknas en gång", async () => {
  const { shown, finished } = await play({
    questions: [...QUIZ, ...TL],
    // Blodbadet: fel första gången, rätt andra gången.
    answerTimeline: (q, n) => q.year !== 1520 || n > 1,
  });
  assert.equal(shown.filter((s) => s === "tl:1520").length, 2);
  assert.deepEqual(finished, { correct: 5, total: 5 });
});

test("utan tidslinje-renderare hoppas tidslinjefrågor över (aldrig flerval)", async () => {
  const { shown, finished } = await play({ questions: [...QUIZ, ...TL], withTimeline: false });
  assert.equal(finished.total, 3);
  assert.ok(shown.every((s) => s.startsWith("quiz:")));
});

test("vanligt quiz utan tidslinje är oförändrat", async () => {
  const { shown, finished } = await play({ questions: QUIZ });
  assert.deepEqual(finished, { correct: 3, total: 3 });
  assert.equal(shown.length, 3);
});

// --- Boot-säkerhet (#271): Tidsjakten + tidslinjen bara via dynamisk import ----
test("Tidsjakten och tidslinjen ligger UTANFÖR den statiska bootgrafen från app.js", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const SRC = resolve(dirname(new URL(import.meta.url).pathname), "../src");
  const staticImportRe = /^\s*import\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = readFileSync(resolve(SRC, rel), "utf8"); } catch { continue; }
    let m;
    while ((m = staticImportRe.exec(code))) {
      if (!m[1].startsWith(".")) continue;
      queue.push(resolve(dirname(resolve(SRC, rel)), m[1]).slice(SRC.length + 1));
    }
  }
  assert.ok(seen.has("games-quiz.js"), "skanningen ska nå quiz-läget");
  for (const f of ["games-tidsjakt.js", "timeline/quiz-tidslinje.js", "timeline/tidsjakt-core.js", "timeline/timeline-answer.js"]) {
    assert.ok(!seen.has(f), `${f} får inte vara statiskt nåbar från app.js`);
  }
});
