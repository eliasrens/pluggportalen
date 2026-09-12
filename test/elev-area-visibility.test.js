// ============================================================================
// Enhetstest för elevvyns områdesfilter (issue #308): områden UTAN spelbart
// innehåll ska INTE listas för eleven (ingen "inget innehåll än"-platshållare).
// pages-elev.js gatear varje kort på exakt detta predikat:
//   visibleGamemodesForClassArea(area, cls).length > 0
// Här verifieras predikatet mot de tre kärnfallen ur issuen + synlighetsaxeln.
// Browser-fritt (samma resolution som områdesöversikten):  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { visibleGamemodesForClassArea } from "../src/gamemode-visibility.js";

// Predikatet pages-elev.js använder för att avgöra om ett område ska visas.
const visibleForStudent = (area, cls = null) =>
  visibleGamemodesForClassArea(area, cls).length > 0;

test("tomt område (inget quiz/par/lästext/generator) visas INTE för elev", () => {
  assert.equal(visibleForStudent({ id: "tomt", name: "Tomt" }), false);
  // Tomma arrayer räknas också som tomt.
  assert.equal(
    visibleForStudent({ id: "tomt2", quiz: [], pairs: [], readingTexts: [] }),
    false
  );
});

test("generator-område UTAN quiz/par visas fortfarande (räkna är spelbart)", () => {
  const area = {
    id: "matte-gen",
    name: "Räkna",
    // Inget quiz[]/pairs[] – men en giltig generator-konfiguration.
    generator: { topic: "addition", variants: ["enkel"] },
  };
  assert.equal(visibleForStudent(area), true);
  const modes = visibleGamemodesForClassArea(area, null).map((m) => m.id);
  assert.ok(modes.includes("rakna"), "räkna-läget ska vara synligt för generator-området");
});

test("område med quiz visas för elev", () => {
  const area = { id: "q", name: "Quizområde", quiz: [{ q: "?", correct: 0, options: ["a", "b"] }] };
  assert.equal(visibleForStudent(area), true);
});

test("område med par visas för elev", () => {
  const area = { id: "p", name: "Parområde", pairs: [{ left: "a", right: "b" }] };
  assert.equal(visibleForStudent(area), true);
});

test("område där ALLA lägen bockats ur för klass×område blir tomt för eleven", () => {
  // Quiz-underlag tänder flera lägen (quiz/kunskapsjakt/lasforstaelse/sanningsjakt
  // OCH äventyrsteman som drar frågor ur quiz). Utan synlighetsval: syns.
  const area = { id: "hidden-area", name: "Dolt", quiz: [{ q: "?", correct: 0, options: ["a", "b"] }] };
  assert.equal(visibleForStudent(area), true);
  // Bocka ur PRECIS de lägen underlaget faktiskt tänder (härlett, inte hårdkodat)
  // på just detta område → området blir i praktiken tomt för elevens klass.
  const hiddenModes = visibleGamemodesForClassArea(area, null).map((m) => m.id);
  const cls = { areaModes: { "hidden-area": { hiddenModes } } };
  assert.equal(visibleForStudent(area, cls), false);
});

test("generator-området kan INTE bli tomt av quiz/par-synlighetsval", () => {
  // Bockar man ur quiz-lägena påverkas inte räkna-läget → generator-området syns.
  const area = { id: "g2", generator: { topic: "multiplikation", variants: ["tabeller"] } };
  const cls = {
    areaModes: { g2: { hiddenModes: ["quiz", "para", "memory", "lasforstaelse"] } },
  };
  assert.equal(visibleForStudent(area, cls), true);
});
