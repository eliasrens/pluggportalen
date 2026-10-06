// "Skapa nytt område"-wizarden (#442): ren state-logik + bootgrafen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WIZARD_STEPS,
  blankState,
  stateFromArea,
  jsonFromArea,
  startStepFor,
  aiTypes,
  wantsGenerator,
  toggleType,
  buildSaveValue,
  summaryParts,
} from "../src/teacher-wizard-state.js";

const gen = { topic: "multiplikation", variants: ["tabeller", "dubbelt"] };

test("fyra steg i ordning", () => {
  assert.deepEqual(WIZARD_STEPS.map((s) => s.nr), [1, 2, 3, 4]);
});

test("blankState: tomt, inget kort förvalt (läraren väljer i steg 2)", () => {
  assert.deepEqual(blankState(), { name: "", grade: null, emoji: "", types: [], onskemal: "" });
  assert.notEqual(blankState().types, blankState().types, "ny array varje gång");
});

test("stateFromArea fyller namn/emoji/årskurs/typer", () => {
  const s = stateFromArea({ id: "v", name: "Vikingar", coverEmoji: " ⚔️ ", grade: "4", exerciseTypes: ["pairs", "quiz"] });
  assert.deepEqual(s, { name: "Vikingar", grade: "ak4", emoji: "⚔️", types: ["quiz", "pairs"], onskemal: "" });
});

test("stateFromArea härleder typer för äldre områden och tappar aldrig generatorn", () => {
  assert.deepEqual(stateFromArea({ quiz: [{}], pairs: [{ term: "a", termImage: "x" }] }).types, ["quiz", "pairs", "bildpar"]);
  // Äldre exerciseTypes utan "generator" men med generator-innehåll → kortet Räkna valt.
  assert.deepEqual(stateFromArea({ exerciseTypes: ["quiz"], quiz: [{}], generator: gen }).types, ["quiz", "generator"]);
});

test("jsonFromArea håller ute fälten med egna kontroller men behåller id och innehåll", () => {
  const area = {
    id: "v", name: "N", coverEmoji: "⚔️", grade: "ak4", exerciseTypes: ["quiz"], generator: gen,
    quiz: [{ q: "?", passage: "Källtext" }], texts: [{ title: "T", body: "b" }], hiddenModes: ["memory"],
  };
  const obj = JSON.parse(jsonFromArea(area));
  assert.deepEqual(Object.keys(obj).sort(), ["hiddenModes", "id", "quiz", "texts"]);
  assert.equal(obj.quiz[0].passage, "Källtext", "läsförståelsens passage följer med (#151)");
});

test("startsteg: nytt → 1, redigera → 3 (D-2)", () => {
  assert.equal(startStepFor(null), 1);
  assert.equal(startStepFor({ id: "x" }), 3);
});

test("aiTypes/wantsGenerator/toggleType", () => {
  const st = { types: ["generator", "quiz"] };
  assert.deepEqual(aiTypes(st), ["quiz"]);
  assert.equal(wantsGenerator(st), true);
  assert.deepEqual(toggleType(st, "quiz"), ["generator"]);
  assert.deepEqual(toggleType(st, "bildpar"), ["quiz", "bildpar", "generator"]);
  assert.equal(wantsGenerator({ types: ["quiz"] }), false);
});

test("buildSaveValue = kompositörens Spara-sammansättning", () => {
  const validated = { id: "v", name: "V", quiz: [{}], pairs: [], generator: gen };
  const v = buildSaveValue(validated, { types: ["quiz", "generator"], grade: "5" }, ["memory"]);
  assert.deepEqual(v.exerciseTypes, ["quiz", "generator"]);
  assert.equal(v.grade, "ak5");
  assert.deepEqual(v.hiddenModes, ["memory"]);
  assert.equal(v.quiz, validated.quiz);
  // Räkna valt men ingen generator i det validerade → "generator" sparas inte.
  const v2 = buildSaveValue({ id: "v", quiz: [{}] }, { types: ["generator", "quiz"], grade: null }, []);
  assert.deepEqual(v2.exerciseTypes, ["quiz"]);
  assert.equal(v2.grade, null);
});

test("summaryParts", () => {
  assert.deepEqual(summaryParts({ quiz: [1, 2], pairs: [], texts: [1], readingTexts: [], generator: gen }), {
    generator: { topic: "multiplikation", variants: 2 },
    bits: ["2 frågor", "1 texter"],
  });
});

// --- Bootgrafen (#271): wizarden får bara nås via import() -------------------
test("wizard-filerna ligger utanför den statiska bootgrafen; kompositören är borta", () => {
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
  const bad = [...seen].filter((f) => /teacher-wizard|teacher-generator|teacher-area-input|teacher-mode-visibility/.test(f));
  assert.deepEqual(bad, [], "wizard-moduler i bootgrafen");
  assert.ok(seen.size > 20, `bootgrafen verkar för liten (${seen.size})`);
  const content = readFileSync(join(root, "teacher-content.js"), "utf8");
  assert.match(content, /import\(["']\.\/teacher-wizard\.js["']\)/);
  assert.equal(existsSync(join(root, "teacher-composer.js")), false);
});
