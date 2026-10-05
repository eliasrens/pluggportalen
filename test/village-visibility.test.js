// ============================================================================
// Tester: lärarstyrd by-synlighet (issue #391) – visibleVillageClasses.
// ----------------------------------------------------------------------------
// Områdesvyn (skolan) filtrerar klasslistan på elevens klass hiddenVillages:
//   • tom/saknad lista = alla byar synliga (bakåtkompatibelt)
//   • egna klassen syns ALLTID, även om den (felaktigt) står i listan
//   • elev i flera klasser → union av klassernas dolda byar
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHiddenVillages,
  visibleVillageClasses,
} from "../src/gamemode-visibility.js";

const ids = (list) => list.map((c) => c.id);

const klasser = () => [
  { id: "6a", name: "6A", studentIds: ["elev1", "elev3"] },
  { id: "6b", name: "6B", studentIds: ["elev2"] },
  { id: "sp", name: "Spec", studentIds: ["elev4"] },
];

test("normalizeHiddenVillages trimmar, tar bort tomma/dubbletter, tål skräp", () => {
  assert.deepEqual(normalizeHiddenVillages([" sp ", "sp", "", null, "6b"]), ["sp", "6b"]);
  assert.deepEqual(normalizeHiddenVillages(undefined), []);
  assert.deepEqual(normalizeHiddenVillages("sp"), []);
});

test("default (inget hiddenVillages) = alla byar synliga, ordning behålls", () => {
  assert.deepEqual(ids(visibleVillageClasses(klasser(), "elev1")), ["6a", "6b", "sp"]);
});

test("dold by filtreras bort för elever i klassen som döljer den", () => {
  const list = klasser();
  list[0].hiddenVillages = ["sp"];
  assert.deepEqual(ids(visibleVillageClasses(list, "elev1")), ["6a", "6b"]);
  // Andra klassers elever påverkas inte av 6a:s val.
  assert.deepEqual(ids(visibleVillageClasses(list, "elev2")), ["6a", "6b", "sp"]);
});

test("egna klassen syns alltid, även om den står i sin egen lista", () => {
  const list = klasser();
  list[0].hiddenVillages = ["6a", "6b", "sp"];
  assert.deepEqual(ids(visibleVillageClasses(list, "elev1")), ["6a"]);
});

test("elev i flera klasser: egna klasser syns, dolda byar = union", () => {
  const list = klasser();
  list[0].hiddenVillages = ["sp"];
  list[1].studentIds.push("elev1");
  list[1].hiddenVillages = ["6a"]; // försöker dölja en av elevens egna – ignoreras
  assert.deepEqual(ids(visibleVillageClasses(list, "elev1")), ["6a", "6b"]);
});

test("elev utan klass / okänd elev / tom lista → inget filtreras", () => {
  const list = klasser();
  list[0].hiddenVillages = ["sp"];
  assert.deepEqual(ids(visibleVillageClasses(list, "okand")), ["6a", "6b", "sp"]);
  assert.deepEqual(ids(visibleVillageClasses(list, null)), ["6a", "6b", "sp"]);
  assert.deepEqual(visibleVillageClasses(null, "elev1"), []);
});
