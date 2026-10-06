// ============================================================================
// Läsresan (#399): textval utan upprepning – picker.js. Spec-acceptanstest 9.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { pickText, levelSearchOrder } from "../src/lasresan/picker.js";

const t = (id, level) => ({ id, level });
const bank = [t("a3", 3), t("b3", 3), t("c3", 3), t("a4", 4), t("a1", 1)];

test("Test 9: flera olästa på nivån → aldrig en redan läst", () => {
  for (let i = 0; i < 50; i++) {
    const r = Math.random;
    const picked = pickText(3, ["a3"], bank, { rng: r });
    assert.notEqual(picked.id, "a3");
    assert.equal(picked.level, 3);
  }
  // Varje oläst kan väljas (slump).
  assert.equal(pickText(3, ["a3"], bank, { rng: () => 0 }).id, "b3");
  assert.equal(pickText(3, ["a3"], bank, { rng: () => 0.99 }).id, "c3");
});

test("poolen uttömd → välj bland sedda, aldrig samma som senast", () => {
  const seen = ["a3", "b3", "c3"];
  for (let i = 0; i < 30; i++) {
    const p = pickText(3, seen, bank, { lastTextId: "b3" });
    assert.notEqual(p.id, "b3");
    assert.equal(p.level, 3);
  }
});

test("bara EN text på nivån och den är senast → den väljs ändå", () => {
  assert.equal(pickText(4, ["a4"], bank, { lastTextId: "a4" }).id, "a4");
});

test("nivån saknar texter → närmaste nivå (lättare vid lika avstånd)", () => {
  assert.equal(pickText(2, [], bank).level, 1); // 1 och 3 lika nära → 1
  assert.equal(pickText(7, [], bank).level, 4);
  assert.deepEqual(levelSearchOrder(3), [3, 2, 4, 1, 5, 6, 7]);
});

test("nivå-map fungerar också som bank, tom bank → null", () => {
  assert.equal(pickText(3, [], { 3: [t("x", 3)] }).id, "x");
  assert.equal(pickText(3, [], []), null);
});
