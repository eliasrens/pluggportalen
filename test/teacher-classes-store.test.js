// Klassvyns sid-store (#440): val, sortering, borttag, biblioteks-cache och
// att den nya Master-Detail-vyn ligger utanför den statiska bootgrafen (#271).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classesHash,
  countLabel,
  createClassStore,
  loadLibraryFrom,
  pickInitial,
  sortClasses,
} from "../src/teacher-classes-store.js";

const mk = () => [
  { id: "5e", name: "5E", order: 2, studentIds: ["a", "b"] },
  { id: "4b", name: "4B", order: 1, studentIds: [] },
  { id: "4a", name: "4A", order: 1, studentIds: ["c"] },
];
const SECTIONS = ["elever", "omraden", "statistik"];

test("sortClasses: order först, sedan namn (sv)", () => {
  assert.deepEqual(sortClasses(mk()).map((c) => c.id), ["4a", "4b", "5e"]);
});

test("countLabel", () => {
  assert.equal(countLabel(1), "1 elev");
  assert.equal(countLabel(0), "0 elever");
  assert.equal(countLabel(24), "24 elever");
});

test("pickInitial: query → sessionStorage → första klassen; okänd sektion → första", () => {
  const c = mk();
  assert.deepEqual(pickInitial(c, { klass: "5e", sektion: "statistik", saved: "4b", sections: SECTIONS }), {
    id: "5e",
    section: "statistik",
  });
  assert.deepEqual(pickInitial(c, { klass: "finnsej", saved: "4b", sections: SECTIONS }), {
    id: "4b",
    section: "elever",
  });
  assert.deepEqual(pickInitial(c, { saved: "borta", sektion: "x", sections: SECTIONS }), {
    id: "4a",
    section: "elever",
  });
  assert.deepEqual(pickInitial([], { sections: SECTIONS }), { id: null, section: "elever" });
});

test("classesHash", () => {
  assert.equal(classesHash("4a", "fokus"), "#/larare/klasser?klass=4a&sektion=fokus");
  assert.equal(classesHash(null), "#/larare/klasser");
});

test("store: select/section notifierar och delar SAMMA klassobjekt (X-06)", () => {
  const classes = mk();
  const store = createClassStore({ classes, students: [], loadLibrary: async () => [] });
  let calls = 0;
  store.subscribe(() => calls++);
  store.select("4a", "omraden");
  assert.equal(store.selected(), classes[2]);
  assert.equal(store.section, "omraden");
  store.select("5e"); // sektionen behålls vid klassbyte
  assert.equal(store.section, "omraden");
  store.showCreate();
  assert.equal(store.selected(), null);
  store.select("4b");
  assert.equal(store.creating, false);
  assert.equal(calls, 4);
  assert.equal(store.classes, classes);
});

test("store.removeClass: väljer nästa, annars föregående, sist skapa-läget", () => {
  const classes = mk();
  const store = createClassStore({ classes, students: [], loadLibrary: async () => [] });
  store.select("4b");
  store.creds.set("4b", [{ id: "x" }]);
  store.removeClass("4b");
  assert.equal(store.selectedId, "5e");
  assert.equal(store.creds.has("4b"), false);
  store.removeClass("5e");
  assert.equal(store.selectedId, "4a");
  store.removeClass("4a");
  assert.equal(store.selectedId, null);
  assert.equal(store.creating, true);
  assert.equal(classes.length, 0, "samma array muteras in-place");
});

test("store.loadLibrary: laddas en gång, misslyckat försök cachas inte", async () => {
  let n = 0;
  let fail = true;
  const store = createClassStore({
    classes: [],
    students: [],
    loadLibrary: async () => {
      n++;
      if (fail) throw new Error("nät");
      return ["lib"];
    },
  });
  await assert.rejects(store.loadLibrary(), /nät/);
  fail = false;
  assert.deepEqual(await store.loadLibrary(), ["lib"]);
  await store.loadLibrary();
  assert.equal(n, 2);
});

test("loadLibraryFrom: ämnen utan områden filtreras bort (K-15)", async () => {
  const lib = await loadLibraryFrom({
    getSubjects: async () => [{ id: "so" }, { id: "ma" }],
    getAreas: async (id) => (id === "so" ? [{ id: "vikingar" }] : []),
  });
  assert.deepEqual(lib, [{ id: "so", areas: [{ id: "vikingar" }] }]);
});

// --- Bootgrafen (incidenten 2026-09-10, #271) --------------------------------
test("klassvyns nya moduler ligger utanför den statiska bootgrafen från app.js", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const seen = new Set();
  const queue = [join(root, "app.js")];
  const re = /(?:^|[\s;])(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(re)) {
      if (m[1].startsWith(".")) queue.push(resolve(dirname(file), m[1]));
    }
  }
  const bad = [...seen].filter((f) => /teacher-classes-[a-z]+\.js$/.test(f));
  assert.deepEqual(bad, [], "teacher-classes-*.js i bootgrafen");
  assert.ok(seen.has(join(root, "teacher-shared.js")), "flik-registryn (teacher-shared.js) ska nås från app.js");
  const entry = readFileSync(join(root, "teacher-classes.js"), "utf8");
  assert.match(entry, /import\(["']\.\/teacher-classes-page\.js["']\)/);
});
