// ============================================================================
// Enhetstest för frågekategorier + per-kategori-statistik i Plugga (#445):
//   • exercise-types.js: katalog, normalisering, räkning, sammanslagning
//   • question-categories.js: config + drift-vakt mot katalogen
//   • validate.js / merge-area.js: frivilligt category-fält, okänt → varning
//   • plugga-stats.js: per elev / per klass, bakåtkompatibelt (gammal progress)
//   • bootgrafen: de nya filerna importeras aldrig statiskt från app.js (#271)
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  QUESTION_CATEGORY_KEYS,
  normalizeQuestionCategory,
  tallyCategory,
  mergeCategoryCounts,
} from "../src/exercise-types.js";
import { QUESTION_CATEGORIES, CATEGORY_LABELS, categoryMeta } from "../src/question-categories.js";
import { validateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";
import {
  summarizeStudent,
  summarizeClass,
  categoryBreakdown,
  exerciseNodes,
  percent,
} from "../src/plugga-stats.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

// --- Katalog + config -------------------------------------------------------

test("config-modulen och bootfilens katalog har exakt samma nycklar (drift-vakt)", () => {
  assert.deepEqual(QUESTION_CATEGORIES.map((c) => c.key), QUESTION_CATEGORY_KEYS);
  for (const c of QUESTION_CATEGORIES) {
    assert.ok(c.label && c.icon && c.color && /^#[0-9a-f]{6}$/.test(c.hex), `${c.key} saknar metadata`);
  }
  assert.equal(CATEGORY_LABELS.analys, "Analys/resonemang");
});

test("normalizeQuestionCategory: nycklar, versaler, etikett-alias, okänt → null", () => {
  assert.equal(normalizeQuestionCategory("begrepp"), "begrepp");
  assert.equal(normalizeQuestionCategory("  Fakta "), "fakta");
  assert.equal(normalizeQuestionCategory("Begreppsförståelse"), "begrepp");
  assert.equal(normalizeQuestionCategory("Analys/resonemang"), "analys");
  assert.equal(normalizeQuestionCategory("källkritik"), null);
  assert.equal(normalizeQuestionCategory(""), null);
  assert.equal(normalizeQuestionCategory(undefined), null);
  assert.equal(normalizeQuestionCategory(3), null);
});

test("categoryMeta: känd kategori → config, okänd → neutral post (kraschar inte)", () => {
  assert.equal(categoryMeta("FAKTA").label, "Fakta");
  const u = categoryMeta("framtida");
  assert.equal(u.key, "framtida");
  assert.equal(u.label, "framtida");
});

test("tallyCategory: räknar rätt/totalt, hoppar över frågor utan känd kategori", () => {
  const cat = {};
  tallyCategory(cat, "fakta", true);
  tallyCategory(cat, "fakta", false);
  tallyCategory(cat, "Begrepp", true);
  tallyCategory(cat, undefined, true);
  tallyCategory(cat, "okänd", false);
  assert.deepEqual(cat, { fakta: { r: 1, t: 2 }, begrepp: { r: 1, t: 1 } });
});

test("mergeCategoryCounts: adderar, rensar okänt/trasigt, r ≤ t, påverkar inte indata", () => {
  const saved = { fakta: { r: 3, t: 5 } };
  const session = { fakta: { r: 1, t: 2 }, analys: { r: 2, t: 2 } };
  assert.deepEqual(mergeCategoryCounts(saved, session), {
    fakta: { r: 4, t: 7 },
    analys: { r: 2, t: 2 },
  });
  assert.deepEqual(saved, { fakta: { r: 3, t: 5 } }, "sparad map muteras inte");
  assert.deepEqual(
    mergeCategoryCounts(
      { okand: { r: 1, t: 1 }, fakta: { r: 9, t: 2 }, begrepp: { r: -1, t: "x" }, analys: null },
      undefined
    ),
    { fakta: { r: 2, t: 2 } }
  );
  assert.deepEqual(mergeCategoryCounts(undefined, null), {});
});

// --- Validering ---------------------------------------------------------------

const BASE = {
  name: "Vikingatiden",
  quiz: [
    { question: "Vad är en runsten?", options: ["En sten med runor", "En båt"], answerIndex: 0, category: "begrepp" },
    { question: "När började vikingatiden?", options: ["ca 800", "ca 1500"], answerIndex: 0, category: "Fakta" },
    { question: "Varför for de i viking?", options: ["Handel och plundring", "Semester"], answerIndex: 0, category: "kallkritik" },
    { question: "Gammal fråga", options: ["a", "b"], answerIndex: 1 },
    { question: "Enligt texten?", options: ["a", "b"], answerIndex: 0, passage: "En kort text.", category: "analys" },
  ],
  pairs: [
    { term: "Knarr", definition: "Handelsskepp", category: "begrepp" },
    { term: "Drakskepp", definition: "Krigsskepp", category: "nope" },
  ],
};

test("validateArea: category sparas normaliserad; okänt varnar men stoppar inte", () => {
  const res = validateArea(BASE);
  assert.equal(res.ok, true);
  const q = res.value.quiz;
  assert.equal(q[0].category, "begrepp");
  assert.equal(q[1].category, "fakta");
  assert.equal("category" in q[2], false, "okänd kategori utelämnas");
  assert.equal("category" in q[3], false, "fråga utan kategori får inget fält");
  assert.equal(q[4].category, "analys");
  assert.equal(q[4].passage, "En kort text.", "läsförståelse-passagen orörd (#151)");
  assert.equal(res.value.pairs[0].category, "begrepp");
  assert.equal("category" in res.value.pairs[1], false);
  assert.equal(res.warnings.length, 2);
  assert.match(res.warnings[0], /Fråga 3.*kallkritik/);
  assert.match(res.warnings[1], /Par 2.*nope/);
});

test("validateArea: område utan kategorier är oförändrat (inga varningar, inga fält)", () => {
  const res = validateArea({ name: "X", quiz: [{ question: "Q", options: ["a", "b"], answerIndex: 0 }] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.warnings, []);
  assert.deepEqual(Object.keys(res.value.quiz[0]).sort(), ["answerIndex", "explanation", "id", "options", "question"]);
});

test("validateArea: omvalidering av sparat område behåller kategorierna", () => {
  const once = validateArea(BASE).value;
  const twice = validateArea(once);
  assert.equal(twice.ok, true);
  assert.deepEqual(twice.value.quiz.map((q) => q.category), once.quiz.map((q) => q.category));
  assert.deepEqual(twice.warnings, []);
});

test("mergeAreaContent: nya frågors kategori följer med, okänd ger varning", () => {
  const existing = validateArea(BASE).value;
  const res = mergeAreaContent(existing, {
    quiz: [
      { question: "Ny fråga", options: ["a", "b"], answerIndex: 0, category: "analys" },
      { question: "Ny fråga 2", options: ["a", "b"], answerIndex: 0, category: "bad" },
    ],
  });
  assert.equal(res.ok, true);
  const added = res.value.quiz.slice(-2);
  assert.equal(added[0].category, "analys");
  assert.equal("category" in added[1], false);
  assert.equal(res.warnings.length, 1);
  assert.match(res.warnings[0], /Fråga 2.*bad/);
  assert.equal(res.value.quiz[0].category, "begrepp", "befintliga kategorier kvar");
});

// --- Läs-API -------------------------------------------------------------------

// Gammal progress (före #445): inga cat-fält, plus läs-per-text-noden (#153).
const OLD = {
  vikingar: {
    quiz: { completed: true, bestScore: 8, stars: 2, lastPlayed: { seconds: 1000 } },
    para: { completed: true, bestScore: 10, stars: 3, plays: 4, lastPlayed: { seconds: 3000 } },
    reading: { t1: { stars: 3, lastPlayed: { seconds: 9999 } } },
  },
  rymden: {
    kunskapsjakt: { completed: true, bestScore: 200, stars: 5, plays: 2, lastPlayed: { seconds: 2000 } },
  },
};

test("summarizeStudent: gammal progress utan kategorier → pct null, perMode som fallback", () => {
  const s = summarizeStudent(OLD);
  assert.equal(s.played, 3, "reading-noden räknas inte som spelläge");
  assert.equal(s.completed, 3);
  assert.equal(s.stars, 2 + 3 + 3, "stjärnor kapas vid 3 per läge");
  assert.equal(s.maxStars, 9);
  assert.equal(s.starPct, 89);
  assert.equal(s.plays, 1 + 4 + 2, "gammal klarad nod utan plays = 1 körning");
  assert.equal(s.lastPlayed.getTime(), 3000 * 1000);
  assert.equal(s.areas, 2);
  assert.equal(s.hasCategoryData, false);
  assert.equal(s.pct, null);
  assert.equal(s.perCategory.length, QUESTION_CATEGORY_KEYS.length);
  assert.ok(s.perCategory.every((c) => c.t === 0 && c.pct === null));
  assert.deepEqual(s.perMode.map((m) => m.mode).sort(), ["kunskapsjakt", "para", "quiz"]);
  const quiz = s.perMode.find((m) => m.mode === "quiz");
  assert.equal(quiz.stars, 2);
  assert.equal(quiz.starPct, 67);
});

test("summarizeStudent: kategorier summeras över områden och lägen; areaIds filtrerar", () => {
  const progress = {
    ...OLD,
    vikingar: {
      ...OLD.vikingar,
      quiz: { ...OLD.vikingar.quiz, cat: { fakta: { r: 3, t: 4 }, begrepp: { r: 1, t: 2 } } },
      "aventyr:gruvan": { completed: true, stars: 3, cat: { analys: { r: 2, t: 2 } } },
    },
    rymden: {
      kunskapsjakt: { ...OLD.rymden.kunskapsjakt, cat: { fakta: { r: 5, t: 6 }, okand: { r: 9, t: 9 } } },
    },
  };
  const s = summarizeStudent(progress);
  assert.equal(s.hasCategoryData, true);
  assert.equal(s.answered, 4 + 2 + 2 + 6);
  assert.equal(s.correct, 3 + 1 + 2 + 5);
  assert.equal(s.pct, percent(11, 14));
  const fakta = s.perCategory.find((c) => c.key === "fakta");
  assert.deepEqual([fakta.r, fakta.t, fakta.pct, fakta.label], [8, 10, 80, "Fakta"]);
  assert.deepEqual(s.perCategory.map((c) => c.key), QUESTION_CATEGORY_KEYS, "visningsordning, okänt bortrensat");

  const v = summarizeStudent(progress, { areaIds: ["vikingar"] });
  assert.equal(v.played, 3);
  assert.equal(v.answered, 8);
  assert.equal(v.perMode.find((m) => m.mode === "quiz").answered, 6);
});

test("summarizeStudent: tom/saknad progress ger nollor", () => {
  for (const p of [undefined, null, {}, { a: null }, { a: { quiz: null } }]) {
    const s = summarizeStudent(p);
    assert.equal(s.played, 0);
    assert.equal(s.pct, null);
    assert.equal(s.starPct, null);
    assert.equal(s.lastPlayed, null);
    assert.deepEqual(s.perMode, []);
  }
});

test("summarizeClass: rader per elev + klassens totaler/kategorier/lägen", () => {
  const res = summarizeClass([
    { studentId: "e1", namn: "Alva", progress: { a: { quiz: { completed: true, stars: 3, cat: { fakta: { r: 4, t: 5 } } } } } },
    { studentId: "e2", namn: "Bo", progress: OLD },
    { studentId: "e3", progress: undefined },
  ]);
  assert.equal(res.students, 3);
  assert.equal(res.activeStudents, 2);
  assert.deepEqual(res.rows.map((r) => [r.studentId, r.namn, r.active]), [
    ["e1", "Alva", true], ["e2", "Bo", true], ["e3", "e3", false],
  ]);
  assert.equal(res.rows[0].pct, 80);
  assert.equal(res.rows[1].pct, null);
  assert.equal(res.totals.played, 4);
  assert.equal(res.totals.stars, 3 + 8);
  assert.equal(res.totals.pct, 80);
  assert.equal(res.perCategory.find((c) => c.key === "fakta").t, 5);
  const quiz = res.perMode.find((m) => m.mode === "quiz");
  assert.equal(quiz.played, 2);
  assert.equal(quiz.stars, 5);
  assert.equal(res.totals.lastPlayed.getTime(), 3000 * 1000);
});

test("categoryBreakdown + exerciseNodes: rena hjälpare", () => {
  assert.equal(categoryBreakdown(null).length, QUESTION_CATEGORY_KEYS.length);
  assert.deepEqual(
    exerciseNodes(OLD, ["rymden"]).map((n) => `${n.areaId}/${n.mode}`),
    ["rymden/kunskapsjakt"]
  );
});

// --- Bootgraf (#271) -------------------------------------------------------------

/** Statiska relativa importer från app.js (kommentarer bortskalade). */
function staticBootGraph() {
  const start = join(SRC, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

test("de nya filerna (question-categories.js, plugga-stats.js) ligger INTE i bootgrafen", () => {
  const graph = staticBootGraph();
  assert.ok(graph.has(join(SRC, "game-questions.js")), "BFS:en hittar kända bootfiler");
  assert.ok(graph.has(join(SRC, "exercise-types.js")));
  assert.equal(graph.has(join(SRC, "question-categories.js")), false);
  assert.equal(graph.has(join(SRC, "plugga-stats.js")), false);
});
