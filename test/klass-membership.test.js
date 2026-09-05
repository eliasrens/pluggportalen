// ============================================================================
// Enhetstest för src/klass-membership.js (myClasses + classmateIds) – den rena
// logiken bakom VILKA elever klassbyn (#/elev/by) försöker läsa. Regressionstest
// för #61 (byn visade bara eget hus). Körs med: node --test test/klass-membership.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { myClasses, classmateIds } from "../src/klass-membership.js";

const CLASSES = [
  { id: "6a", studentIds: ["mig", "anna", "bo"] },
  { id: "6b", studentIds: ["cilla", "david"] },
  { id: "grupp", studentIds: ["mig", "cilla"] }, // eleven i två klasser
];

// --- myClasses -------------------------------------------------------------

test("myClasses ger alla klasser eleven ingår i", () => {
  const mina = myClasses("mig", CLASSES).map((c) => c.id);
  assert.deepEqual(mina, ["6a", "grupp"]);
});

test("myClasses ger tom lista utan klass eller ogiltig indata", () => {
  assert.deepEqual(myClasses("okänd", CLASSES), []);
  assert.deepEqual(myClasses("mig", null), []);
  assert.deepEqual(myClasses("", CLASSES), []);
});

// --- classmateIds ----------------------------------------------------------

test("classmateIds har eleven själv FÖRST", () => {
  assert.equal(classmateIds("mig", CLASSES)[0], "mig");
});

test("classmateIds unionerar kamrater ur ALLA elevens klasser (dedupad)", () => {
  const ids = classmateIds("mig", CLASSES);
  // 6a: mig, anna, bo · grupp: mig, cilla → union utan dubbletter, mig först.
  assert.deepEqual(ids, ["mig", "anna", "bo", "cilla"]);
  // Inga elever ur en klass eleven INTE är med i (david i 6b).
  assert.ok(!ids.includes("david"));
});

test("classmateIds utan klass blir bara det egna huset", () => {
  assert.deepEqual(classmateIds("mig", []), ["mig"]);
  assert.deepEqual(classmateIds("ensam", CLASSES), ["ensam"]);
});

test("classmateIds är robust mot trasig/tom indata", () => {
  assert.deepEqual(classmateIds("mig", null), ["mig"]);
  assert.deepEqual(classmateIds("mig", undefined), ["mig"]);
  assert.deepEqual(classmateIds("", CLASSES), []);
  // Klassdokument utan studentIds hoppas över utan att fälla resten.
  const trasiga = [{ id: "x" }, { id: "6a", studentIds: ["mig", "anna"] }, null];
  assert.deepEqual(classmateIds("mig", trasiga), ["mig", "anna"]);
});

test("classmateIds behåller inte falsy id:n ur studentIds", () => {
  const c = [{ id: "6a", studentIds: ["mig", "", null, "bo"] }];
  assert.deepEqual(classmateIds("mig", c), ["mig", "bo"]);
});
