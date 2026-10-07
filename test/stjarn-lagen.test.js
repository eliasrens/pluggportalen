// ============================================================================
// Enhetstest för EN definition av "möjliga stjärnor" (#467, QA-fynd F2/F5):
//   • areaStarModes (gamemode-visibility.js): Memory ingår aldrig, äventyr bara
//     när temat är synligt (område / klass / klass×område)
//   • samma område → samma nämnare i elevpanelen, Ämnen-matrisen, Per område
//     och djupdykningen, och intjänat kan aldrig överstiga möjligt
//   • djupdykningen: Memory får maxStars 0 → ingen stjärnrad
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { areaStarModes, GAMEMODES } from "../src/gamemode-visibility.js";
import { areaEarned, areaMaxStars, areaModes, starScope } from "../src/teacher-class-stats.js";
import { summarizeClass } from "../src/plugga-stats.js";
import { pluggaTeacherRows } from "../src/plugga-teacher-rows.js";
import { areaProgressHtml } from "../src/plugga-framsteg.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

const q = (n) => ({ question: `F${n}?`, options: ["a", "b"], answerIndex: 0, category: "fakta" });
const p = (n) => ({ term: `T${n}`, definition: `D${n}` });
// Rymden QA-liknande område: quiz + par → quiz/läsf/kunskapsjakt/para/sanningsjakt/
// memory + tre äventyr.
const AREA = { id: "rymden", name: "Rymden", quiz: [1, 2, 3, 4].map(q), pairs: [1, 2, 3, 4].map(p) };
const ids = (modes) => modes.map((m) => m.id);

// Eleven har 3★ i ALLT hon spelat, inklusive Memory (som aldrig ska räknas).
function fullProgress(area, extra = {}) {
  const modes = {};
  for (const id of ["quiz", "lasforstaelse", "kunskapsjakt", "para", "sanningsjakt", "memory",
    "aventyr:skattjakten", "aventyr:spokjakten", "aventyr:gruvan"]) {
    modes[id] = { completed: true, stars: 3, plays: 2 };
  }
  return { [area.id]: { ...modes, ...extra } };
}

/** Elevpanelens "X av Y ★" ur HTML:en. */
function panelStars(area, cls, progress) {
  const html = areaProgressHtml({ areaId: area.id, areaData: area, progress,
    starModes: ids(areaStarModes(area, cls)) });
  const m = html.match(/<b>(\d+)<\/b> av (\d+) ★/);
  return { earned: Number(m[1]), max: Number(m[2]) };
}

/** Ämnen-matrisens cell (teacher-class.js: areaModes + areaEarned). */
function matrixCell(area, cls, progress) {
  const star = ids(areaModes(area, cls));
  return { earned: areaEarned(progress, area.id, star).stars, max: star.length * 3 };
}

/** Per område + djupdykningen (teacher-plugga.js: starScope → summarizeClass → rader). */
function perOmrade(area, cls, progress) {
  const { maxStars, isStarMode } = starScope([area], cls);
  const sum = summarizeClass([{ studentId: "s", progress }], { areaIds: [area.id], isStarMode });
  const [row] = pluggaTeacherRows(sum.rows, maxStars);
  return { earned: row.stars, max: row.possibleStars, row };
}

test("Memory (noStars) ingår aldrig i stjärn-lägena", () => {
  assert.equal(GAMEMODES.find((m) => m.id === "memory").noStars, true);
  const modes = ids(areaStarModes(AREA));
  assert.ok(!modes.includes("memory"));
  assert.ok(modes.includes("para") && modes.includes("quiz"));
  assert.deepEqual(modes.filter((m) => m.startsWith("aventyr:")).sort(),
    ["aventyr:gruvan", "aventyr:skattjakten", "aventyr:spokjakten"]);
});

test("äventyrsstjärnor räknas bara när temat är synligt (område, klass, klass×område)", () => {
  const all = areaStarModes(AREA).length;
  const hiddenArea = { ...AREA, hiddenModes: ["aventyr:gruvan"] };
  assert.equal(areaStarModes(hiddenArea).length, all - 1);
  const clsGlobal = { hiddenModes: ["aventyr:spokjakten"] };
  assert.ok(!ids(areaStarModes(AREA, clsGlobal)).includes("aventyr:spokjakten"));
  const clsArea = { areaModes: { rymden: { hiddenModes: ["aventyr:skattjakten", "quiz"] } } };
  const m = ids(areaStarModes(AREA, clsArea));
  assert.ok(!m.includes("aventyr:skattjakten") && !m.includes("quiz"));
  assert.equal(m.length, all - 2);
  // Annan klass×område-nyckel påverkar inte.
  assert.equal(areaStarModes(AREA, { areaModes: { annat: { hiddenModes: ["quiz"] } } }).length, all);
});

test("samma område → samma nämnare i elevpanelen, Ämnen, Per område och djupdykningen", () => {
  for (const cls of [null, { hiddenModes: ["aventyr:gruvan"] },
    { areaModes: { rymden: { hiddenModes: ["para", "aventyr:spokjakten"] } } }]) {
    const progress = fullProgress(AREA);
    const elev = panelStars(AREA, cls, progress);
    const matris = matrixCell(AREA, cls, progress);
    const omr = perOmrade(AREA, cls, progress);
    assert.equal(matris.max, elev.max);
    assert.equal(omr.max, elev.max);
    assert.equal(areaMaxStars(AREA, cls), elev.max);
    assert.equal(matris.earned, elev.earned);
    assert.equal(omr.earned, elev.earned);
    // Djupdykningen visar samma rad (row.stars / row.possibleStars).
    assert.equal(omr.row.possibleStarPct, 100);
  }
});

test("QA-fallet: 3★ i alla lägen inkl. Memory → 24/24 överallt, aldrig över 100 %", () => {
  const progress = fullProgress(AREA);
  const elev = panelStars(AREA, null, progress);
  assert.deepEqual(elev, { earned: 24, max: 24 });
  assert.deepEqual(matrixCell(AREA, null, progress), { earned: 24, max: 24 });
  const omr = perOmrade(AREA, null, progress);
  assert.deepEqual([omr.earned, omr.max], [24, 24]);
});

test("intjänat i ett dolt läge räknas inte → intjänat ≤ möjligt", () => {
  const cls = { hiddenModes: ["aventyr:gruvan", "quiz"] };
  const progress = fullProgress(AREA);
  for (const v of [panelStars(AREA, cls, progress), matrixCell(AREA, cls, progress), perOmrade(AREA, cls, progress)]) {
    assert.ok(v.earned <= v.max, `${v.earned} > ${v.max}`);
    assert.equal(v.max, 18);
  }
});

test("hela ämnet: starScope summerar områdenas stjärn-lägen", () => {
  const onlyPairs = { id: "par", name: "Par", pairs: [1, 2, 3].map(p) };
  const { maxStars, isStarMode } = starScope([AREA, onlyPairs]);
  assert.equal(maxStars, areaMaxStars(AREA) + areaMaxStars(onlyPairs));
  assert.equal(isStarMode("par", "memory"), false);
  assert.equal(isStarMode("par", "para"), true);
  assert.equal(isStarMode("okänt", "quiz"), false);
});

test("djupdykningen: Memory får maxStars 0 (ingen stjärnrad) men räknas som spelad", () => {
  const { isStarMode } = starScope([AREA]);
  const sum = summarizeClass([{ studentId: "s", progress: fullProgress(AREA) }], { areaIds: ["rymden"], isStarMode });
  const mem = sum.rows[0].perMode.find((m) => m.mode === "memory");
  assert.equal(mem.maxStars, 0);
  assert.equal(mem.stars, 0);
  assert.equal(mem.plays, 2);
  const src = readFileSync(join(SRC, "teacher-plugga-elev.js"), "utf8");
  assert.match(src, /m\.maxStars === 0/);
  assert.match(src, /spelad \$\{m\.plays\}/);
});

test("areaEarned utan stjärn-filter är bakåtkompatibel (alla noder)", () => {
  const progress = { a: { quiz: { stars: 2, completed: true }, memory: { stars: 3 } } };
  assert.equal(areaEarned(progress, "a").stars, 5);
  assert.equal(areaEarned(progress, "a", ["quiz"]).stars, 2);
  assert.equal(areaEarned(progress, "a", ["quiz"]).played, 2);
});
