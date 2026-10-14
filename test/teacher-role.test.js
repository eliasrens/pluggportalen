// Lärarsidan efter roll (#679): klassfilter, elevfilter, ägarskap för material,
// navens grupper och att bootgrafen inte växer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canEditArea, createdByLabel, filterClasses, studentsInClasses } from "../src/teacher-role-core.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const admin = { admin: true, uid: "a1", name: "Elias", classIds: null };
const ak4 = { admin: false, uid: "u4", name: "Årskurs 4", classIds: new Set(["4a", "4b"]) };
const classes = [{ id: "4a", studentIds: ["s1"] }, { id: "4b", studentIds: [] }, { id: "5a", studentIds: ["s3"] }];

test("filterClasses: admin ser alla, årskurskonto bara sina", () => {
  assert.equal(filterClasses(classes, admin).length, 3);
  assert.deepEqual(filterClasses(classes, ak4).map((c) => c.id), ["4a", "4b"]);
  assert.deepEqual(filterClasses(classes, { ...ak4, classIds: new Set() }), []);
});

test("studentsInClasses: via klassens studentIds eller elevens classIds", () => {
  const students = [{ id: "s1" }, { id: "s2", classIds: ["4b"] }, { id: "s3", classIds: ["5a"] }];
  const mine = studentsInClasses(students, filterClasses(classes, ak4));
  assert.deepEqual(mine.map((s) => s.id), ["s1", "s2"]);
});

test("canEditArea: admin allt, årskurskonto bara eget; utan createdBy = admins", () => {
  assert.equal(canEditArea({}, admin), true);
  assert.equal(canEditArea({ createdBy: "u5" }, admin), true);
  assert.equal(canEditArea({ createdBy: "u4" }, ak4), true);
  assert.equal(canEditArea({ createdBy: "u5" }, ak4), false);
  assert.equal(canEditArea({}, ak4), false);
  assert.equal(canEditArea({}, undefined), true, "utan roll som förr");
});

test("createdByLabel tål saknade fält (före #680)", () => {
  assert.equal(createdByLabel({}), "Admin");
  assert.equal(createdByLabel({ createdBy: "u5" }), "en annan lärare");
  assert.equal(createdByLabel({ createdBy: "u4", createdByName: "Årskurs 4" }), "Årskurs 4");
});

test("toppnaven: sex huvuddelar, admin-flikar markerade", () => {
  const src = readFileSync(join(SRC, "teacher-shared.js"), "utf8");
  const groups = [...src.matchAll(/\{ key: "(\w+)", label: "([^"]+)", icon:/g)].map((m) => m[2]);
  assert.deepEqual(groups, ["Översikt", "Klasser", "Material", "Live och tävlingar", "Statistik", "Admin"]);
  for (const key of ["hittaratt", "mattematchen", "adminklasser", "konton"]) {
    assert.match(src, new RegExp(`tab\\("${key}",[^\\n]*, true\\),`), `${key} är bara för admin`);
  }
  for (const key of ["oversikt", "klasser", "innehall", "live", "statistik"]) {
    assert.doesNotMatch(src, new RegExp(`tab\\("${key}",[^\\n]*, true\\),`), `${key} syns för alla`);
  }
});

test("klasslägen: årskurs-sektionerna saknar elevkonton/ekonomi, bara Admin får hantera klasser", () => {
  const src = readFileSync(join(SRC, "teacher-classes-sections.js"), "utf8");
  const mode = (k) => src.match(new RegExp(`${k}: \\{[^\\n]*\\}`))[0];
  assert.match(mode("klasser"), /sections: \["omraden", "lagen", "synlighet", "fokus", "inloggning"\], manage: false/);
  assert.match(mode("statistik"), /manage: false/);
  assert.match(mode("admin"), /sections: \["elever", "klasscenter"\], manage: true/);
});

test("bootgrafen: rollfilerna och Översikt laddas bara dynamiskt", () => {
  const src = readFileSync(join(SRC, "teacher-shared.js"), "utf8");
  assert.doesNotMatch(src, /^import .*teacher-(role|overview)/m);
  assert.match(src, /import\("\.\/teacher-role\.js"\)/);
});
