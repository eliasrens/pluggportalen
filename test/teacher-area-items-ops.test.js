// Issue #454: rena ops för enskilda quizfrågor/par/texter i Innehållsstudions
// utfällda underrader. Kontraktet: bara ändringen appliceras, alla andra fält
// följer med orörda, läsförståelse-passage bevaras och validateArea är grinden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addItem,
  updateItem,
  removeItem,
  applyItemOp,
  itemCounts,
  sectionsFor,
  hasPassageMode,
  lastItemWarning,
  locateItem,
  nextItemId,
  normalizeItemFields,
} from "../src/teacher-area-items-ops.js";

const q = (n, extra = {}) => ({
  id: `q${n}`,
  question: `Fråga ${n}?`,
  options: ["A", "B", "C", "D"],
  answerIndex: n % 4,
  explanation: "",
  ...extra,
});

const level = () => ({ body: "Vikingarna bodde i Norden.", questions: [q(1), q(2), q(3)].map(({ id, ...x }) => x) });

function area() {
  return {
    id: "vikingar",
    name: "Vikingatiden",
    order: 3,
    coverEmoji: "⚔️",
    grade: "4",
    hiddenModes: ["memory"],
    exerciseTypes: ["quiz", "pairs"],
    readingPrereq: { required: 1 },
    readingTexts: [{ id: "rt1", title: "Lästext", levels: { 1: level(), 2: level(), 3: level() } }],
    texts: [{ id: "t1", title: "Om vikingar", body: "De seglade." }],
    quiz: [q(1, { passage: "Vikingarna seglade långt." }), q(2), q(3, { passage: "Birka var en stad." })],
    pairs: [
      { id: "p1", term: "Runsten", definition: "Sten med runor" },
      { id: "p2", term: "", termImage: "partier/s", definition: "Socialdemokraterna", group: "parti" },
    ],
  };
}

/** Allt utom en lista ska vara identiskt med originalet. */
function assertOthersUntouched(before, after, changedKind) {
  for (const key of Object.keys(before)) {
    if (key === changedKind) continue;
    assert.deepEqual(after[key], before[key], `fältet ${key} ändrades`);
  }
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
}

test("itemCounts och sektioner följer typer och innehåll", () => {
  const a = area();
  assert.deepEqual(itemCounts(a), { quiz: 3, pairs: 2, texts: 1 });
  assert.deepEqual(sectionsFor(a), ["quiz", "pairs", "texts"]);
  assert.deepEqual(sectionsFor({ exerciseTypes: ["quiz"], quiz: [q(1)] }), ["quiz"]);
  // Typen finns men inget innehåll ännu → sektionen visas (så man kan lägga till).
  assert.deepEqual(sectionsFor({ exerciseTypes: ["pairs"] }), ["pairs"]);
  assert.deepEqual(sectionsFor({ generator: { topic: "addition", variants: ["enkel"] } }), []);
  assert.deepEqual(itemCounts({}), { quiz: 0, pairs: 0, texts: 0 });
});

test("addItem lägger till sist med unikt id och rör inget annat", () => {
  const a = area();
  const frozen = structuredClone(a);
  const b = addItem(a, "quiz", { question: " Ny? ", options: ["x", "y", "", "z"], answerIndex: 3, explanation: "" });
  assert.deepEqual(a, frozen, "originalet muterades");
  assert.equal(b.quiz.length, 4);
  // Tomt alternativ bort, answerIndex följer med (z låg på index 3 → 2).
  assert.deepEqual(b.quiz[3], { id: "q4", question: "Ny?", options: ["x", "y", "z"], answerIndex: 2, explanation: "" });
  assert.deepEqual(b.quiz.slice(0, 3), a.quiz, "befintliga frågor (med passage) orörda");
  assertOthersUntouched(a, b, "quiz");
  const c = addItem(a, "texts", { title: "Ny", body: "Text" });
  assert.equal(c.texts[1].id, "t2");
  assert.equal(nextItemId([{ id: "t2" }, { id: "x" }], "texts"), "t3");
});

test("updateItem bevarar passage, id och okända fält; tomt valfritt fält tas bort", () => {
  const a = area();
  a.quiz[0].extra = "behåll";
  const b = updateItem(a, "quiz", { index: 0, id: "q1" }, {
    question: "Ändrad?",
    options: ["A", "B", "C", "D"],
    answerIndex: 2,
    explanation: "För att.",
    passage: "Vikingarna seglade långt.",
  });
  assert.equal(b.quiz[0].id, "q1");
  assert.equal(b.quiz[0].extra, "behåll");
  assert.equal(b.quiz[0].passage, "Vikingarna seglade långt.");
  assert.equal(b.quiz[0].answerIndex, 2);
  assert.deepEqual(b.quiz.slice(1), a.quiz.slice(1));
  assertOthersUntouched(a, b, "quiz");

  const c = updateItem(a, "pairs", { index: 1, id: "p2" }, { term: "", termImage: "", definition: "S", group: "" });
  assert.equal("termImage" in c.pairs[1], false);
  assert.equal("group" in c.pairs[1], false);
  const d = updateItem(a, "pairs", { index: 0, id: "p1" }, { term: "Runsten", definition: "Sten", defImage: "partier/m" });
  assert.equal(d.pairs[0].defImage, "partier/m");
  assertOthersUntouched(a, d, "pairs");
});

test("removeItem tar bort rätt post; locateItem vägrar ändrad post utan id", () => {
  const a = area();
  const b = removeItem(a, "quiz", { index: 1, id: "q2" });
  assert.deepEqual(b.quiz.map((x) => x.id), ["q1", "q3"]);
  assert.equal(b.quiz[1].passage, "Birka var en stad.");
  assertOthersUntouched(a, b, "quiz");

  const noIds = [{ term: "a", definition: "b" }, { term: "c", definition: "d" }];
  assert.equal(locateItem(noIds, { index: 1, snapshot: { definition: "d", term: "c" } }), 1);
  assert.equal(locateItem(noIds, { index: 1, snapshot: { term: "x", definition: "d" } }), -1);
  assert.equal(locateItem(noIds, { index: 5 }), -1);
  assert.throws(() => removeItem(a, "quiz", { index: 0, id: "finns-inte" }), /ändrats eller tagits bort/);
});

test("applyItemOp kör validateArea och sparar aldrig ogiltigt", () => {
  const a = area();
  const bad = applyItemOp(a, { type: "add", kind: "quiz", fields: { question: "", options: ["A", "B"], answerIndex: 0 } });
  assert.equal(bad.ok, false);
  assert.equal(bad.area, null);
  assert.ok(bad.errors.some((e) => /Fråga 4: "question"/.test(e)), bad.errors.join(" | "));

  const badPair = applyItemOp(a, { type: "add", kind: "pairs", fields: { term: "x", definition: "", defImage: "finns/inte" } });
  assert.equal(badPair.ok, false);
  assert.ok(badPair.errors.some((e) => /okänd bildnyckel/.test(e)));

  const good = applyItemOp(a, { type: "update", kind: "texts", ref: { index: 0, id: "t1" }, fields: { title: "Ny rubrik", body: "Ny text" } });
  assert.equal(good.ok, true);
  assert.deepEqual(good.area.texts, [{ id: "t1", title: "Ny rubrik", body: "Ny text" }]);
  // Råa dokumentet sparas (inte validateArea:s normaliserade value): readingPrereq,
  // exerciseTypes m.m. är exakt som förut.
  assertOthersUntouched(a, good.area, "texts");

  const gone = applyItemOp(a, { type: "remove", kind: "pairs", ref: { index: 0, id: "p9" } });
  assert.equal(gone.ok, false);
  assert.match(gone.errors[0], /Ladda om/);
});

test("exerciseTypes rörs inte, inte ens när sista posten av en typ tas bort", () => {
  const a = { id: "x", name: "X", exerciseTypes: ["quiz", "pairs"], quiz: [q(1)], pairs: [{ id: "p1", term: "a", definition: "b" }] };
  assert.match(lastItemWarning(a, "quiz"), /inga quizfrågor kvar – eleverna ser inte quiz-läget/);
  assert.equal(lastItemWarning(area(), "quiz"), null);
  const res = applyItemOp(a, { type: "remove", kind: "quiz", ref: { index: 0, id: "q1" } });
  assert.equal(res.ok, true);
  assert.deepEqual(res.area.quiz, []);
  assert.deepEqual(res.area.exerciseTypes, ["quiz", "pairs"]);
});

test("läsförståelse: hasPassageMode och passage bara när den finns", () => {
  assert.equal(hasPassageMode(area()), true);
  assert.equal(hasPassageMode({ quiz: [q(1)] }), false);
  assert.equal("passage" in normalizeItemFields("quiz", { question: "a", options: ["a", "b"], answerIndex: 0, passage: "  " }), false);
  const b = addItem(area(), "quiz", { question: "Var låg Birka?", options: ["Mälaren", "Vänern"], answerIndex: 0, passage: " Birka låg i Mälaren. " });
  assert.equal(b.quiz[3].passage, "Birka låg i Mälaren.");
});

// --- Bootgrafen (#271): underrads-UI:t får bara nås via import() ------------
test("underrads-modulerna ligger utanför den statiska bootgrafen", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const seen = new Set();
  const queue = [join(root, "app.js")];
  const re = /(?:^|[\s;])(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(re)) if (m[1].startsWith(".")) queue.push(resolve(dirname(file), m[1]));
  }
  assert.deepEqual([...seen].filter((f) => /teacher-area-items/.test(f)), []);
  const list = readFileSync(join(root, "teacher-content-list.js"), "utf8");
  assert.match(list, /import\(["']\.\/teacher-area-items\.js["']\)/);
});
