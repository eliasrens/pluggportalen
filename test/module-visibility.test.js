// ============================================================================
// Tester: lärarstyrd modul-synlighet per klass (issue #412).
// ----------------------------------------------------------------------------
// Sidomenyn och routern döljer moduler som elevens klass har i hiddenModules:
//   • tom/saknad lista = allt synligt (bakåtkompatibelt)
//   • okända modul-id ignoreras (bara registrets moduler kan döljas)
//   • elev i flera klasser → union av klassernas dolda moduler
//   • varje modul-route (även underrutter, t.ex. Plugga → område/spela) mappas
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOGGLABLE_MODULES,
  normalizeHiddenModules,
  moduleForRoute,
  hiddenModulesForStudent,
} from "../src/gamemode-visibility.js";

test("registret har minst Plugga och Läsresan, unika id och egna rutter", () => {
  const ids = TOGGLABLE_MODULES.map((m) => m.id);
  assert.ok(ids.includes("plugga") && ids.includes("lasresan"));
  assert.equal(new Set(ids).size, ids.length);
  const routes = TOGGLABLE_MODULES.flatMap((m) => m.routes);
  assert.equal(new Set(routes).size, routes.length, "en route får bara ägas av en modul");
});

test("normalizeHiddenModules: trimmar, tar bort dubbletter/okända id, tål skräp", () => {
  assert.deepEqual(normalizeHiddenModules([" lasresan ", "lasresan", "", null, "okand", "plugga"]), [
    "lasresan",
    "plugga",
  ]);
  assert.deepEqual(normalizeHiddenModules(undefined), []);
  assert.deepEqual(normalizeHiddenModules("lasresan"), []);
});

test("moduleForRoute: modulens rutter (inkl. underrutter) → id, övrigt → null", () => {
  assert.equal(moduleForRoute("/elev/lasresan"), "lasresan");
  assert.equal(moduleForRoute("/elev/plugga"), "plugga");
  assert.equal(moduleForRoute("/elev/omrade"), "plugga");
  assert.equal(moduleForRoute("/elev/spela"), "plugga");
  assert.equal(moduleForRoute("/elev/aventyr"), "plugga");
  assert.equal(moduleForRoute("/elev/shop"), "shop");
  // Hem/världen och profilen kan aldrig döljas.
  assert.equal(moduleForRoute("/elev/hus"), null);
  assert.equal(moduleForRoute("/elev/profil"), null);
  assert.equal(moduleForRoute("/larare/klasser"), null);
});

const klasser = () => [
  { id: "6a", studentIds: ["elev1", "elev3"], hiddenModules: ["lasresan"] },
  { id: "6b", studentIds: ["elev2"] },
  { id: "sp", studentIds: ["elev3"], hiddenModules: ["plugga", "lasresan"] },
];

test("hiddenModulesForStudent: saknat fält / ingen klass / ingen elev = inget dolt", () => {
  assert.deepEqual(hiddenModulesForStudent(klasser(), "elev2"), []);
  assert.deepEqual(hiddenModulesForStudent(klasser(), "okand"), []);
  assert.deepEqual(hiddenModulesForStudent(klasser(), null), []);
  assert.deepEqual(hiddenModulesForStudent(null, "elev1"), []);
});

test("hiddenModulesForStudent: klassens lista gäller, flera klasser → union", () => {
  assert.deepEqual(hiddenModulesForStudent(klasser(), "elev1"), ["lasresan"]);
  assert.deepEqual(hiddenModulesForStudent(klasser(), "elev3").sort(), ["lasresan", "plugga"]);
});

test("hiddenModulesForStudent: andra klassers val påverkar inte eleven", () => {
  const k = [{ id: "x", studentIds: ["annan"], hiddenModules: ["plugga"] }, { id: "y", studentIds: ["elev1"] }];
  assert.deepEqual(hiddenModulesForStudent(k, "elev1"), []);
});
