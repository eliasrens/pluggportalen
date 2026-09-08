// ============================================================================
// Enhetstest för årskurs på arbetsområden (issue #145):
//   • grades.js: normalisering, etikett, sorteringsnyckel.
//   • validate.js: grade är valfri, bakåtkompatibel och normaliseras.
//   • merge-area.js: befintlig grade bevaras när nytt innehåll mergas in.
//   • prompts.js: årskursen vävs in i AI-prompten (styrning, inte tvingande).
//   • teacher-content-list.js: filtrering/sortering per årskurs.
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeGrade, gradeLabel, gradeNr, gradeSortKey, GRADES, filterSortAreas } from "../src/grades.js";
import { validateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";
import { buildAreaPrompt } from "../src/prompts.js";

// --- grades.js -------------------------------------------------------------

test("normalizeGrade tar rena id, tal och åk/ak-strängar", () => {
  assert.equal(normalizeGrade("ak4"), "ak4");
  assert.equal(normalizeGrade(4), "ak4");
  assert.equal(normalizeGrade("åk4"), "ak4");
  assert.equal(normalizeGrade("år 7"), "ak7");
  assert.equal(normalizeGrade("ak1"), "ak1");
  assert.equal(normalizeGrade("ak9"), "ak9");
});

test("normalizeGrade ger null för saknat/okänt/ur-intervall", () => {
  assert.equal(normalizeGrade(undefined), null);
  assert.equal(normalizeGrade(null), null);
  assert.equal(normalizeGrade(""), null);
  assert.equal(normalizeGrade("ospecificerad"), null);
  assert.equal(normalizeGrade("ak0"), null);
  assert.equal(normalizeGrade(10), null);
  assert.equal(normalizeGrade("hej"), null);
});

test("gradeLabel och gradeNr", () => {
  assert.equal(gradeLabel("ak4"), "Årskurs 4");
  assert.equal(gradeLabel(null), "Ospecificerad");
  assert.equal(gradeNr("ak6"), 6);
  assert.equal(gradeNr(null), null);
  assert.equal(GRADES.length, 9);
});

test("gradeSortKey lägger ospecificerad sist", () => {
  assert.equal(gradeSortKey("ak1"), 1);
  assert.equal(gradeSortKey("ak9"), 9);
  assert.equal(gradeSortKey(null), Infinity);
  assert.ok(gradeSortKey("ak9") < gradeSortKey(null));
});

// --- validate.js -----------------------------------------------------------

function miniArea(extra = {}) {
  return { name: "Vikingatiden", quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0 }], ...extra };
}

test("validateArea: grade saknas → null (bakåtkompatibelt)", () => {
  const res = validateArea(miniArea());
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.grade, null);
});

test("validateArea: giltig grade normaliseras och bevaras", () => {
  const res = validateArea(miniArea({ grade: "åk5" }));
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.grade, "ak5");
});

test("validateArea: okänd grade → null utan fel", () => {
  const res = validateArea(miniArea({ grade: "ak99" }));
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.grade, null);
});

// --- merge-area.js ---------------------------------------------------------

test("mergeAreaContent bevarar områdets grade", () => {
  const existing = {
    id: "vikingatiden",
    name: "Vikingatiden",
    grade: "ak5",
    exerciseTypes: ["quiz"],
    quiz: [{ id: "q1", question: "Q1?", options: ["a", "b"], answerIndex: 0 }],
    texts: [],
    pairs: [],
  };
  const res = mergeAreaContent(existing, {
    quiz: [{ question: "Q2?", options: ["a", "b"], answerIndex: 1 }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.grade, "ak5");
});

// --- prompts.js ------------------------------------------------------------

test("buildAreaPrompt väver in satt årskurs", () => {
  const p = buildAreaPrompt(["quiz"], "", "ak7");
  assert.match(p, /årskurs 7/);
  assert.match(p, /ca 13 år/);
  assert.match(p, /styrning, inte en tvingande regel/);
});

test("buildAreaPrompt utan årskurs behåller standard (åk 4)", () => {
  const p = buildAreaPrompt(["quiz"], "");
  assert.match(p, /årskurs 4/);
});

// --- teacher-content-list.js: filter/sortering -----------------------------

const areas = [
  { id: "a", name: "A", order: 2, grade: "ak6" },
  { id: "b", name: "B", order: 1, grade: "ak4" },
  { id: "c", name: "C", order: 3, grade: null },
];

test("filterSortAreas filtrerar på årskurs", () => {
  assert.deepEqual(filterSortAreas(areas, { filter: "ak4", sort: "order" }).map((a) => a.id), ["b"]);
  assert.deepEqual(filterSortAreas(areas, { filter: "ospecificerad", sort: "order" }).map((a) => a.id), ["c"]);
  assert.equal(filterSortAreas(areas, { filter: "", sort: "order" }).length, 3);
});

test("filterSortAreas sorterar på årskurs med ospecificerad sist", () => {
  assert.deepEqual(
    filterSortAreas(areas, { filter: "", sort: "grade" }).map((a) => a.id),
    ["b", "a", "c"]
  );
});

test("filterSortAreas rör inte indata-listan", () => {
  const copy = areas.slice();
  filterSortAreas(areas, { filter: "", sort: "grade" });
  assert.deepEqual(areas, copy);
});
