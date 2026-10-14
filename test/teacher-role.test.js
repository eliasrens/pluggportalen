// Lärarsidan efter roll (#679): klassfilter, elevfilter, ägarskap för material,
// navens grupper och att bootgrafen inte växer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canEditArea, createdByLabel, duplicateValue, filterClasses, studentsInClasses, withOwner,
} from "../src/teacher-role-core.js";

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

// auth.js drar in Firebase-SDK:t från CDN → plocka ut den rena regeln ur källan.
test("adminFromClaims: admin-claim och lärare utan role = admin, role arskurs = inte (#679, övergången)", () => {
  const src = readFileSync(join(SRC, "auth.js"), "utf8");
  const m = src.match(/export const adminFromClaims = (\(c\) => [^\n]+);/);
  assert.ok(m, "adminFromClaims finns i auth.js");
  const adminFromClaims = new Function(`return ${m[1]}`)();
  assert.equal(adminFromClaims({ teacher: true, admin: true }), true, "admin-claim");
  assert.equal(adminFromClaims({ teacher: true }), true, "legacy: teacher utan role");
  assert.equal(adminFromClaims({ teacher: true, role: "arskurs" }), false, "årskurskonto");
  assert.equal(adminFromClaims({ teacher: true, role: "annat" }), false, "okänd role");
  assert.equal(adminFromClaims({ admin: true }), false, "inte lärare");
  assert.equal(adminFromClaims(null), false);
  assert.match(src, /isAdm = adminFromClaims\(tok\.claims\)/, "onAuthStateChanged");
  assert.match(src, /adminClaim = adminFromClaims\(tok\.claims\)/, "signInTeacher");
});

// #678: Live efter roll – samma gränser som firestore.rules gradeLiveClassesOk.
test("canSeeLiveSession: årskurskontot ser bara matcher med någon av sina klasser", async () => {
  const { canSeeLiveSession } = await import("../src/teacher-role-core.js");
  assert.equal(canSeeLiveSession({ participatingClassIds: ["4a", "5a"] }, ak4), true);
  assert.equal(canSeeLiveSession({ participatingClassIds: ["5a", "6a"] }, ak4), false);
  assert.equal(canSeeLiveSession({}, ak4), false);
  assert.equal(canSeeLiveSession({ participatingClassIds: ["6a"] }, admin), true);
  assert.equal(canSeeLiveSession({ participatingClassIds: ["6a"] }, null), true);
});

test("liveClassChoices/liveFieldsFor: valfri motståndare bara i Klassmatchen, inget kassapris", async () => {
  const { liveClassChoices, liveFieldsFor } = await import("../src/teacher-role-core.js");
  assert.equal(liveClassChoices(classes, "klassmatch", ak4).length, 3);
  assert.deepEqual(liveClassChoices(classes, "guldrush", ak4).map((c) => c.id), ["4a", "4b"]);
  assert.equal(liveClassChoices(classes, "guldrush", admin).length, 3);
  const fields = [{ key: "durationMin" }, { key: "coinPrize" }];
  assert.deepEqual(liveFieldsFor(fields, ak4).map((f) => f.key), ["durationMin"]);
  assert.equal(liveFieldsFor(fields, admin).length, 2);
});

test("withOwner (#680): nytt område stämplas, befintligt behåller ägaren", () => {
  // Nytt: anroparen äger, även om värdet försöker ange någon annan.
  assert.deepEqual(withOwner({ name: "Ny", createdBy: "u5" }, null, ak4),
    { name: "Ny", createdBy: "u4", createdByName: "Årskurs 4" });
  // Admin ändrar Årskurs 5:s område → ägaren står kvar.
  assert.deepEqual(withOwner({ name: "Ändrad" }, { createdBy: "u5", createdByName: "Årskurs 5" }, admin),
    { name: "Ändrad", createdBy: "u5", createdByName: "Årskurs 5" });
  // Gammalt material utan createdBy förblir admins (inga fält läggs till).
  assert.deepEqual(withOwner({ name: "Gammalt", createdBy: "a1" }, { name: "Gammalt" }, admin), { name: "Gammalt" });
});

test("duplicateValue (#680): allt innehåll följer med, (kopia), ledigt id, utan ägare", () => {
  const src = { id: "viking", name: "Vikingar", order: 2, quiz: [{ q: "?" }], readingTexts: [{ id: "t1" }],
    createdBy: "a1", createdByName: "Elias" };
  const copy = duplicateValue(src, ["viking", "viking-kopia"], 9);
  assert.deepEqual(copy, { id: "viking-kopia-2", name: "Vikingar (kopia)", order: 9,
    quiz: [{ q: "?" }], readingTexts: [{ id: "t1" }] });
  // Sparad som nytt dokument ägs kopian av Årskurs 4 (test 7).
  assert.equal(withOwner(copy, null, ak4).createdBy, "u4");
});
