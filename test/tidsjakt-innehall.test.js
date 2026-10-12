// ============================================================================
// Enhetstest för Tidsjaktens innehållsflöde (epic #595 / issue #596):
//   • övningstypen "tidsjakt" + härledning ur area.timeline
//   • AI-prompten med och utan Tidsjakten vald (antal, kvalitetskrav, exempel)
//   • validering av timeline[] + timelineSpan (heltalsår, obligatoriska fält,
//     beskrivningen avslöjar inte årtalet)
//   • merge ("skapa fler"): dubbletter på händelse + år, nya id, spannet behålls
//   • ett inklistrat Vasatiden-svar (quiz + par + timeline) valideras rätt
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAreaPrompt, buildMorePrompt } from "../src/prompts.js";
import { validateArea, parseAndValidateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";
import { areaExerciseTypes, deriveExerciseTypes } from "../src/exercise-types.js";
import {
  parseYear,
  revealsYear,
  normalizeTimelineCount,
  formatYear,
  TIMELINE_COUNTS,
} from "../src/validate-timeline.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";

const ev = (extra = {}) => ({
  event: "Stockholms blodbad",
  question: "Vilket år inträffade Stockholms blodbad?",
  year: 1520,
  description: "Kristian II lät avrätta svenska stormän.",
  explanation: "Det skedde 1520.",
  ...extra,
});
const area = (timeline, extra = {}) => validateArea({ name: "Vasatiden", timeline, ...extra });

// --- Övningstypen -----------------------------------------------------------

test("tidsjakt härleds ur area.timeline – gamla områden utan fältet påverkas inte", () => {
  assert.deepEqual(deriveExerciseTypes({ timeline: [ev()] }), ["tidsjakt"]);
  assert.deepEqual(deriveExerciseTypes({ quiz: [{}], timeline: [] }), ["quiz"]);
  assert.deepEqual(areaExerciseTypes({ quiz: [{}], pairs: [{}] }), ["quiz", "pairs"]);
});

// --- AI-prompten -------------------------------------------------------------

test("prompten utan Tidsjakten nämner inte tidslinjen alls", () => {
  for (const types of [["quiz"], ["quiz", "pairs"], ["pairs", "bildpar"], []]) {
    const p = buildAreaPrompt(types, "", null);
    assert.doesNotMatch(p, /timeline|Tidsjakt|tidslinje/i, `typer ${types.join(",")}`);
  }
});

test("prompten med Tidsjakten ber om timeline med lärarens antal, kvalitetskrav och exempel", () => {
  const p = buildAreaPrompt(["quiz", "pairs", "tidsjakt"], "", "ak5", { timelineCount: 15 });
  assert.match(p, /tidslinjefrågor \(Tidsjakten/);
  assert.match(p, /"timeline": lista med historiska händelser/);
  assert.match(p, /Skapa EXAKT 15 händelser\./);
  assert.match(p, /BELAGDA årtal/);
  assert.match(p, /Pressa inte ihop en lång period/);
  assert.match(p, /Skriv åldersanpassat/);
  assert.match(p, /"description"\) får ALDRIG avslöja årtalet/);
  assert.match(p, /\("explanation"\) är kort/);
  assert.match(p, /NEGATIVA tal: 500 f\.Kr\. = -500/);
  // Quiz och par finns kvar.
  assert.match(p, /Quizfrågor med 4 svarsalternativ/);
  assert.match(p, /Fakta-par/);
});

test("prompten: exemplet innehåller en giltig timeline-händelse + spann", () => {
  const p = buildAreaPrompt(["tidsjakt"], "", null);
  const json = p.slice(p.indexOf("{\n  \"id\": \"vikingatiden\""), p.indexOf("\n}\n") + 2);
  const res = validateArea(JSON.parse(json));
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.timeline.length, 1);
  assert.deepEqual(res.value.timelineSpan, { from: 700, to: 1100 });
  // Bara Tidsjakten vald → inga quiz/par i prompten.
  assert.match(p, /Skapa INGA quizfrågor/);
  assert.match(p, /Skapa INGA fakta-par/);
});

test("prompten: utan valt antal skalas antalet efter materialet; okänt antal ignoreras", () => {
  for (const count of [undefined, 7, "abc"]) {
    const p = buildAreaPrompt(["tidsjakt"], "", null, { timelineCount: count });
    assert.doesNotMatch(p, /Skapa EXAKT/);
    assert.match(p, /Kort text: 5 händelser/);
  }
  assert.deepEqual(TIMELINE_COUNTS, [5, 10, 15, 20]);
  assert.equal(normalizeTimelineCount("10"), 10);
  assert.equal(normalizeTimelineCount(12), null);
});

test("skapa fler-prompten skickar med befintliga händelser och områdets spann", () => {
  const a = {
    name: "Vasatiden",
    exerciseTypes: ["quiz", "tidsjakt"],
    quiz: [{ question: "Vem?", options: ["A", "B"], answerIndex: 0 }],
    timeline: [ev()],
    timelineSpan: { from: 1500, to: 1580 },
  };
  const p = buildMorePrompt(a, "", undefined, { timelineCount: 5 });
  assert.match(p, /"event":"Stockholms blodbad"/);
  assert.match(p, /"year":1520/);
  assert.match(p, /Skapa EXAKT 5 händelser/);
  assert.match(p, /nya "texts", "quiz", "pairs" och\/eller "timeline"/);
  assert.match(p, /från 1500 till 1580/);
  // Ett område utan Tidsjakten: inget om tidslinjen.
  const utan = buildMorePrompt({ name: "X", exerciseTypes: ["quiz"], quiz: a.quiz }, "");
  assert.doesNotMatch(utan, /timeline|tidslinje/i);
});

// --- Validering --------------------------------------------------------------

test("validering: giltig händelse normaliseras och tänder tidsjakt", () => {
  const res = area([ev({ id: "Blodbadet", event: "  Stockholms blodbad " })]);
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.timeline, [
    {
      id: "blodbadet",
      event: "Stockholms blodbad",
      question: "Vilket år inträffade Stockholms blodbad?",
      year: 1520,
      description: "Kristian II lät avrätta svenska stormän.",
      explanation: "Det skedde 1520.",
    },
  ]);
  assert.deepEqual(res.value.exerciseTypes, ["tidsjakt"]);
  assert.equal("timelineSpan" in res.value, false);
});

test("validering: årtalet måste vara ett heltal (negativt = f.Kr.)", () => {
  assert.equal(area([ev({ year: -500, description: "Något hände." })]).value.timeline[0].year, -500);
  assert.equal(area([ev({ year: "1520" })]).value.timeline[0].year, 1520);
  for (const year of [1520.5, "år 1520", "1520 e.Kr.", null, undefined, NaN, 5000]) {
    const res = area([ev({ year })]);
    assert.equal(res.ok, false, `year=${year}`);
    assert.match(res.errors.join(" | "), /"year" måste vara ett heltal/);
  }
  assert.equal(parseYear(" -44 "), -44);
  assert.equal(formatYear(-44), "44 f.Kr.");
});

test("validering: event och question är obligatoriska; saknad beskrivning/förklaring varnar", () => {
  const res = area([ev({ event: "", question: " " })]);
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /"event" \(händelsens namn\) saknas/);
  assert.match(res.errors.join(" | "), /"question" \(frågan\) saknas/);

  const ok = area([ev({ description: "", explanation: undefined })]);
  assert.equal(ok.ok, true);
  assert.equal(ok.warnings.length, 2);
  assert.match(ok.warnings.join(" | "), /"description" saknas/);
});

test("validering: beskrivning, fråga eller händelse som avslöjar årtalet nekas", () => {
  const res = area([ev({ description: "År 1520 hände något hemskt." })]);
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /"description" avslöjar årtalet 1520/);
  assert.equal(area([ev({ question: "Hände blodbadet 1520?" })]).ok, false);
  assert.equal(area([ev({ event: "Blodbadet 1520" })]).ok, false);
  // Ett längre tal som bara innehåller siffrorna är ok; f.Kr.-år kontrolleras också.
  assert.equal(revealsYear("15200 soldater", 1520), false);
  assert.equal(revealsYear("år 500 f.Kr.", -500), true);
  // Förklaringen (visas efter svaret) får nämna årtalet.
  assert.equal(area([ev()]).ok, true);
});

test("validering: dubbletter (händelse + år) i samma lista hoppas över med varning", () => {
  const res = area([ev(), ev({ event: "stockholms  BLODBAD", question: "Annan fråga?" }), ev({ year: 1521 })]);
  assert.equal(res.ok, true);
  assert.equal(res.value.timeline.length, 2);
  assert.match(res.warnings.join(" | "), /finns redan i listan/);
  assert.deepEqual(res.value.timeline.map((e) => e.id), ["e1", "e3"]);
});

test("validering: timelineSpan – heltal, from < to, rymmer alla händelser", () => {
  assert.deepEqual(area([ev()], { timelineSpan: { from: 1500, to: "1600" } }).value.timelineSpan, {
    from: 1500,
    to: 1600,
  });
  assert.match(area([ev()], { timelineSpan: { from: 1600, to: 1500 } }).errors.join(), /måste vara tidigare/);
  assert.match(area([ev()], { timelineSpan: [1500, 1600] }).errors.join(), /måste vara ett objekt/);
  assert.match(area([ev()], { timelineSpan: { from: 1530, to: 1600 } }).errors.join(), /utanför tidsspannet/);
});

test("validering: timeline måste vara en lista; räknas som innehåll", () => {
  assert.match(area({}).errors.join(), /"timeline" måste vara en lista/);
  assert.equal(area([]).ok, false); // tom lista + inget annat = inget innehåll
});

test("gamla områden utan timeline valideras exakt som förut (inga nya fält)", () => {
  const res = validateArea({ name: "Gammalt", quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0 }] });
  assert.equal(res.ok, true);
  assert.equal("timeline" in res.value, false);
  assert.equal("timelineSpan" in res.value, false);
  assert.deepEqual(res.value.exerciseTypes, ["quiz"]);
});

test("Vasatiden: inklistrat svar med quiz, par och timeline valideras rätt", () => {
  const res = parseAndValidateArea(VASATIDEN_JSON);
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.warnings, []);
  const v = res.value;
  assert.equal(v.quiz.length, 2);
  assert.equal(v.pairs.length, 2);
  assert.deepEqual(v.timeline.map((e) => [e.id, e.year]), [
    ["e1", 1520], ["e2", 1523], ["e3", 1527], ["e4", 1541], ["e5", 1560],
  ]);
  assert.deepEqual(v.timelineSpan, { from: 1500, to: 1580 });
  assert.deepEqual(v.exerciseTypes, ["quiz", "pairs", "tidsjakt"]);
  // Inga svarsalternativ på tidslinjefrågorna.
  assert.ok(v.timeline.every((e) => !("options" in e) && !("answerIndex" in e)));
});

// --- Merge ("skapa fler") ----------------------------------------------------

test("merge: nya händelser läggs till, dubbletter (händelse + år) hoppas över", () => {
  const existing = parseAndValidateArea(VASATIDEN_JSON).value;
  const res = mergeAreaContent(existing, {
    timeline: [
      ev({ question: "Samma händelse, annan fråga?" }), // dubblett: blodbadet 1520
      ev({ event: "Dackefejden börjar", question: "Vilket år började Dackefejden?", year: 1542,
        description: "Bönder i Småland gjorde uppror mot kungen.", explanation: "Dackefejden började 1542." }),
    ],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.added, { texts: 0, quiz: 0, pairs: 0, timeline: 1 });
  assert.deepEqual(res.skipped, { texts: 0, quiz: 0, pairs: 0, timeline: 1 });
  assert.equal(res.value.timeline.length, 6);
  assert.deepEqual(res.value.timeline.at(-1).id, "e6");
  // Övrigt innehåll och spannet orört.
  assert.deepEqual(res.value.quiz, existing.quiz);
  assert.deepEqual(res.value.timelineSpan, { from: 1500, to: 1580 });
});

test("merge: händelse utanför områdets spann nekas; område utan Tidsjakten får den påslagen", () => {
  const existing = parseAndValidateArea(VASATIDEN_JSON).value;
  const ute = mergeAreaContent(existing, { timeline: [ev({ event: "Freden i Westfalen", year: 1648, description: "Fred." })] });
  assert.equal(ute.ok, false);
  assert.match(ute.errors.join(), /utanför tidsspannet/);

  const gammal = { id: "x", name: "X", exerciseTypes: ["quiz"], quiz: existing.quiz, pairs: [] };
  const res = mergeAreaContent(gammal, { timeline: [ev()], timelineSpan: { from: 1400, to: 1700 } });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.exerciseTypes, ["quiz", "tidsjakt"]);
  assert.deepEqual(res.value.timelineSpan, { from: 1400, to: 1700 });
});

test("merge: ett gammalt område utan timeline får inga nya fält när quiz läggs till", () => {
  const gammal = { id: "x", name: "X", exerciseTypes: ["quiz"], quiz: [], pairs: [] };
  const res = mergeAreaContent(gammal, { quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0 }] });
  assert.equal(res.ok, true);
  assert.equal("timeline" in res.value, false);
  assert.equal("timelineSpan" in res.value, false);
});
