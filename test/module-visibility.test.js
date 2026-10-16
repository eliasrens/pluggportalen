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
  assert.equal(moduleForRoute("/elev/brakresan"), "brakresan"); // #713
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

// --- Opt-in-moduler (#605, Hitta rätt!) --------------------------------------
import { normalizeEnabledModules, modulesHiddenForStudent, OPT_IN_MODULES } from "../src/gamemode-visibility.js";

test("Hitta rätt! är en opt-in-modul med egen route", () => {
  assert.deepEqual(OPT_IN_MODULES, ["hittaratt", "ekvationsresan"]); // #618
  assert.equal(moduleForRoute("/elev/hitta-ratt"), "hittaratt");
});

test("normalizeEnabledModules: bara kända OPT-IN-id", () => {
  assert.deepEqual(normalizeEnabledModules([" hittaratt ", "hittaratt", "plugga", "okand"]), ["hittaratt"]);
  assert.deepEqual(normalizeEnabledModules(undefined), []);
});

test("modulesHiddenForStudent: opt-in AV utan aktivering (test 7: inaktiv = syns inte)", () => {
  const k = [{ id: "6a", studentIds: ["elev1"] }];
  assert.deepEqual(modulesHiddenForStudent(k, "elev1"), OPT_IN_MODULES);
  assert.deepEqual(modulesHiddenForStudent([], "elev1"), OPT_IN_MODULES);
  assert.deepEqual(modulesHiddenForStudent(k, null), OPT_IN_MODULES);
});

test("modulesHiddenForStudent: aktiverad i någon av elevens klasser → syns", () => {
  const k = [
    { id: "6a", studentIds: ["elev1"], enabledModules: ["hittaratt"] },
    { id: "sp", studentIds: ["elev1", "elev2"] },
    { id: "x", studentIds: ["elev3"], enabledModules: ["hittaratt"] },
  ];
  assert.deepEqual(modulesHiddenForStudent(k, "elev1"), ["ekvationsresan"]);
  assert.deepEqual(modulesHiddenForStudent(k, "elev2"), OPT_IN_MODULES, "annan klass aktivering gäller inte");
});

test("modulesHiddenForStudent: hiddenModules gäller fortfarande (union)", () => {
  const k = [{ id: "6a", studentIds: ["elev1"], hiddenModules: ["lasresan"], enabledModules: ["hittaratt"] }];
  assert.deepEqual(modulesHiddenForStudent(k, "elev1"), ["lasresan", "ekvationsresan"]);
  const k2 = [{ id: "6a", studentIds: ["elev1"], hiddenModules: ["lasresan"] }];
  assert.deepEqual(modulesHiddenForStudent(k2, "elev1").sort(), ["ekvationsresan", "hittaratt", "lasresan"]);
});

// --- #734: modulregistret (STUDENT_MODULES) -------------------------------------
import { STUDENT_MODULES, studentModuleForRoute } from "../src/gamemode-visibility.js";

test("STUDENT_MODULES: unika id/rutter; TOGGLABLE = registret utan toggle:false", () => {
  const ids = STUDENT_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  const routes = STUDENT_MODULES.flatMap((m) => m.routes);
  assert.equal(new Set(routes).size, routes.length, "en route får bara ägas av en modul");
  assert.deepEqual(TOGGLABLE_MODULES.map((m) => m.id), ["plugga", "lasresan", "shop", "hittaratt", "ekvationsresan", "brakresan"]);
  assert.ok(!TOGGLABLE_MODULES.some((m) => m.id === "mattematchen"), "Mattematchen styrs av perioden");
  for (const m of STUDENT_MODULES) assert.ok(m.label && m.ikon && ["mitt", "ova"].includes(m.grupp), m.id);
});

test("studentModuleForRoute: hela registret, även Mattematchen; Hem/Live → null", () => {
  assert.equal(studentModuleForRoute("/elev/mattematchen").id, "mattematchen");
  assert.equal(studentModuleForRoute("/elev/spela").id, "plugga");
  assert.equal(moduleForRoute("/elev/mattematchen"), null, "inte av/på-bar");
  assert.equal(studentModuleForRoute("/elev/hus"), null);
  assert.equal(studentModuleForRoute("/elev/live"), null);
});
