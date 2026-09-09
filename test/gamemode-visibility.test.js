// ============================================================================
// Enhetstest för synliga lägen per arbetsområde (issue #200):
//   • gamemode-visibility.js: normalisering + has-gat + synlighetsfilter
//   • validate.js: hiddenModes sparas (bakåtkompatibelt, normaliserat)
//   • merge-area.js: hiddenModes behålls när nytt innehåll mergas in
// Körs browser-fritt med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GAMEMODES,
  normalizeHiddenModes,
  isModeHidden,
  isModeHiddenForClass,
  isModeHiddenForStudent,
  areaContentFlags,
  availableGamemodes,
  visibleGamemodes,
  visibleGamemodesForStudent,
} from "../src/gamemode-visibility.js";
import { validateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";

const QUIZ = [{ question: "Q?", options: ["a", "b"], answerIndex: 0 }];
const PAIRS = [
  { term: "t1", definition: "d1" },
  { term: "t2", definition: "d2" },
];

// --- normalizeHiddenModes ---------------------------------------------------

test("normalizeHiddenModes trimmar, tar bort tomma och dubbletter, behåller ordning", () => {
  assert.deepEqual(normalizeHiddenModes([" quiz ", "memory", "quiz", "", null, "  "]), [
    "quiz",
    "memory",
  ]);
});

test("normalizeHiddenModes ger tom lista för icke-lista", () => {
  assert.deepEqual(normalizeHiddenModes(undefined), []);
  assert.deepEqual(normalizeHiddenModes("quiz"), []);
  assert.deepEqual(normalizeHiddenModes(null), []);
});

test("isModeHidden är sant bara för id i hiddenModes", () => {
  const area = { hiddenModes: ["quiz"] };
  assert.equal(isModeHidden(area, "quiz"), true);
  assert.equal(isModeHidden(area, "memory"), false);
  assert.equal(isModeHidden({}, "quiz"), false); // saknas → inget dolt
});

// --- has-gat + synlighet ----------------------------------------------------

test("areaContentFlags speglar faktiskt innehåll", () => {
  assert.deepEqual(areaContentFlags({ quiz: QUIZ }), {
    quiz: true,
    pairs: false,
    sanningsjakt: true, // härleds ur quiz
  });
  assert.deepEqual(areaContentFlags({ pairs: PAIRS }), {
    quiz: false,
    pairs: true,
    sanningsjakt: true, // ≥2 par
  });
  assert.deepEqual(areaContentFlags({}), { quiz: false, pairs: false, sanningsjakt: false });
});

test("availableGamemodes ger bara lägen med underlag, oavsett hiddenModes", () => {
  const ids = availableGamemodes({ pairs: PAIRS, hiddenModes: ["para"] }).map((gm) => gm.id);
  // pairs ger para, memory (och sanningsjakt via ≥2 par); ingen quiz.
  assert.deepEqual(new Set(ids), new Set(["para", "memory", "sanningsjakt"]));
});

test("visibleGamemodes = har underlag OCH inte urbockat", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  const ids = visibleGamemodes(area).map((gm) => gm.id);
  assert.ok(!ids.includes("quiz"), "urbockat quiz ska bort");
  assert.ok(ids.includes("lasforstaelse"), "andra quiz-lägen påverkas inte");
  // Inga par → para/memory är inte synliga (has-gaten).
  assert.ok(!ids.includes("para"));
});

test("visibleGamemodes utan hiddenModes visar alla lägen med underlag (bakåtkompatibelt)", () => {
  const area = { quiz: QUIZ };
  const avail = availableGamemodes(area).map((gm) => gm.id);
  const vis = visibleGamemodes(area).map((gm) => gm.id);
  assert.deepEqual(vis, avail);
});

test("okänt mode-id i hiddenModes är ofarligt (matchar inget läge)", () => {
  const area = { quiz: QUIZ, hiddenModes: ["finns-inte"] };
  assert.equal(visibleGamemodes(area).length, availableGamemodes(area).length);
});

// --- klass-nivå (issue #208) ------------------------------------------------

test("isModeHiddenForClass är sant bara för id i klassens hiddenModes", () => {
  const cls = { hiddenModes: ["memory"] };
  assert.equal(isModeHiddenForClass(cls, "memory"), true);
  assert.equal(isModeHiddenForClass(cls, "quiz"), false);
  assert.equal(isModeHiddenForClass({}, "memory"), false); // saknas → inget dolt
  assert.equal(isModeHiddenForClass(null, "memory"), false); // ingen klass → inget dolt
});

test("isModeHiddenForStudent tar UNIONEN av klass- och områdes-dolda", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["memory"] };
  assert.equal(isModeHiddenForStudent(area, cls, "quiz"), true); // dolt via område
  assert.equal(isModeHiddenForStudent(area, cls, "memory"), true); // dolt via klass
  assert.equal(isModeHiddenForStudent(area, cls, "lasforstaelse"), false); // inget håll
  // Ingen klass (null) → faller tillbaka på enbart områdes-gaten (bakåtkompatibelt).
  assert.equal(isModeHiddenForStudent(area, null, "quiz"), true);
  assert.equal(isModeHiddenForStudent(area, null, "memory"), false);
});

test("visibleGamemodesForStudent döljer union klass ∪ område, respekterar has-gaten", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  const cls = { hiddenModes: ["kunskapsjakt"] };
  const ids = visibleGamemodesForStudent(area, cls).map((gm) => gm.id);
  assert.ok(!ids.includes("quiz"), "urbockat på område ska bort");
  assert.ok(!ids.includes("kunskapsjakt"), "urbockat på klass ska bort");
  assert.ok(ids.includes("lasforstaelse"), "övriga quiz-lägen kvar");
  assert.ok(!ids.includes("para"), "inget par-underlag → has-gaten döljer para");
});

test("visibleGamemodesForStudent utan klass-val = visibleGamemodes (bakåtkompatibelt)", () => {
  const area = { quiz: QUIZ, hiddenModes: ["quiz"] };
  assert.deepEqual(
    visibleGamemodesForStudent(area, null).map((gm) => gm.id),
    visibleGamemodes(area).map((gm) => gm.id)
  );
  assert.deepEqual(
    visibleGamemodesForStudent(area, { hiddenModes: [] }).map((gm) => gm.id),
    visibleGamemodes(area).map((gm) => gm.id)
  );
});

// --- validate.js ------------------------------------------------------------

test("validateArea saknar hiddenModes → tom lista (bakåtkompatibelt)", () => {
  const res = validateArea({ name: "Test", quiz: QUIZ });
  assert.ok(res.ok);
  assert.deepEqual(res.value.hiddenModes, []);
});

test("validateArea normaliserar hiddenModes", () => {
  const res = validateArea({ name: "Test", quiz: QUIZ, hiddenModes: [" quiz ", "quiz", ""] });
  assert.ok(res.ok);
  assert.deepEqual(res.value.hiddenModes, ["quiz"]);
});

test("validateArea ignorerar ogiltig hiddenModes utan fel", () => {
  const res = validateArea({ name: "Test", quiz: QUIZ, hiddenModes: "quiz" });
  assert.ok(res.ok);
  assert.deepEqual(res.value.hiddenModes, []);
});

// --- merge-area.js ----------------------------------------------------------

test("mergeAreaContent behåller områdets hiddenModes", () => {
  const existing = { name: "Test", id: "test", quiz: QUIZ, hiddenModes: ["quiz"] };
  const res = mergeAreaContent(existing, { quiz: [{ question: "Ny?", options: ["x", "y"], answerIndex: 1 }] });
  assert.ok(res.ok, res.errors?.join("; "));
  assert.deepEqual(res.value.hiddenModes, ["quiz"]);
  assert.equal(res.value.quiz.length, 2);
});

// Katalogen ska ha alla lägen (skydd mot att någon råkar tömma den).
test("GAMEMODES har de sex lägena", () => {
  assert.deepEqual(
    GAMEMODES.map((gm) => gm.id),
    ["lasforstaelse", "para", "quiz", "kunskapsjakt", "sanningsjakt", "memory"]
  );
});
