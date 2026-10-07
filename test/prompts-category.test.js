// ============================================================================
// Enhetstest för frågekategorier i AI-prompten (issue #466, steg 3 i #445):
//   • prompten innehåller alla nycklar ur QUESTION_CATEGORY_KEYS (ingen egen lista)
//   • exempel-JSON:en (med category) passerar validateArea utan varningar
//   • ett AI-svar med okänd kategori ger varning men ok=true
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAreaPrompt, buildMorePrompt, EXAMPLE_JSON } from "../src/prompts.js";
import { areaExample } from "../src/prompt-parts.js";
import { QUESTION_CATEGORY_KEYS } from "../src/exercise-types.js";
import { validateArea } from "../src/validate.js";

test("områdes-prompten nämner category och alla kategorinycklar", () => {
  for (const types of [["quiz"], ["quiz", "pairs"], ["bildpar"], []]) {
    const p = buildAreaPrompt(types, "", "ak5");
    assert.match(p, /"category"/);
    for (const k of QUESTION_CATEGORY_KEYS) assert.ok(p.includes(`"${k}"`), `saknar "${k}" (${types})`);
    assert.match(p, /Begreppsförståelse/);
    assert.match(p, /Analys\/resonemang/);
    assert.match(p, /EXAKT en av nycklarna/);
  }
});

test("mer-innehåll-prompten ärver kategori-instruktionen", () => {
  const p = buildMorePrompt({ name: "X", exerciseTypes: ["quiz"], quiz: [{ question: "a", passage: "b" }] });
  for (const k of QUESTION_CATEGORY_KEYS) assert.ok(p.includes(`"${k}"`));
});

test("befintliga prompt-regler finns kvar (årskurs, passage, ledtrådar)", () => {
  const p = buildAreaPrompt(["quiz"], "", "ak3");
  assert.match(p, /årskurs 3/);
  assert.match(p, /"passage"/);
  assert.match(p, /Skriv INTE ledtrådar/);
  assert.match(p, /Dubbelkolla att rätt svar ligger på det indexet/);
});

test("exempel-JSON:en (med category) passerar validateArea utan varningar", () => {
  const exempel = [
    EXAMPLE_JSON,
    areaExample({ wantQuiz: true, wantPairs: true, wantImages: true }),
    areaExample({ wantQuiz: true, wantPairs: true, wantImages: false }),
  ];
  for (const json of exempel) {
    const obj = JSON.parse(json);
    assert.ok(obj.quiz.every((q) => QUESTION_CATEGORY_KEYS.includes(q.category)));
    const r = validateArea(obj);
    assert.equal(r.ok, true, r.errors?.join("\n"));
    assert.deepEqual(r.warnings, []);
    assert.equal(r.value.quiz[0].category, "fakta");
  }
});

test("ett AI-svar med alla tre kategorier valideras utan varningar", () => {
  const obj = JSON.parse(EXAMPLE_JSON);
  const q = obj.quiz[0];
  obj.quiz = QUESTION_CATEGORY_KEYS.map((k, i) => ({ ...q, id: `q${i}`, question: `${q.question} ${i}`, category: k }));
  const r = validateArea(obj);
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.value.quiz.map((x) => x.category), QUESTION_CATEGORY_KEYS);
});

test("okänd kategori ger varning men ok=true", () => {
  const obj = JSON.parse(EXAMPLE_JSON);
  obj.quiz[0].category = "minne";
  const r = validateArea(obj);
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /okänd kategori "minne"/);
});
