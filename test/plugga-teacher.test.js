// ============================================================================
// Enhetstest för lärarvyn "Per område" (#446):
//   • plugga-teacher-rows.js: möjliga stjärnor, sortering, färgnivåer,
//     svagaste/starkaste kategori, "senast aktiv"-text
//   • rätt-% per kategori i tabellraden stämmer mot rådatan i progress
//   • bootgrafen: de nya filerna importeras aldrig statiskt från app.js (#271)
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { summarizeClass } from "../src/plugga-stats.js";
import {
  PLUGGA_COLUMNS,
  lastActiveText,
  nextPluggaSort,
  pctLevel,
  pluggaTeacherRows,
  sortPluggaRows,
  weakStrong,
} from "../src/plugga-teacher-rows.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

// Rådata: två områden, en elev med kategorier, en med gammal data, en tom.
const ENTRIES = [
  {
    studentId: "a",
    namn: "Alva",
    progress: {
      vikingar: {
        quiz: { completed: true, stars: 3, plays: 2, lastPlayed: { seconds: 1_790_000_000 },
          cat: { begrepp: { r: 4, t: 5 }, fakta: { r: 9, t: 10 }, analys: { r: 1, t: 4 } } },
        kunskapsjakt: { completed: false, stars: 1, plays: 1, lastPlayed: { seconds: 1_790_100_000 },
          cat: { fakta: { r: 3, t: 5 }, analys: { r: 2, t: 2 } } },
        reading: { t1: { done: true } },
      },
      rymden: { quiz: { completed: true, stars: 2, plays: 1, cat: { begrepp: { r: 0, t: 3 } } } },
    },
  },
  { studentId: "b", namn: "Bo", progress: { vikingar: { para: { completed: true, stars: 2 } } } },
  { studentId: "c", namn: "Cleo", progress: {} },
];

const rowsFor = (areaIds, maxStars) => pluggaTeacherRows(summarizeClass(ENTRIES, { areaIds }).rows, maxStars);

test("rätt-% per kategori i raden = rådatan summerad över områdets lägen", () => {
  const [a] = rowsFor(["vikingar"], 9);
  const by = Object.fromEntries(a.perCategory.map((c) => [c.key, c]));
  // begrepp 4/5, fakta 9+3 / 10+5, analys 1+2 / 4+2 (rymden räknas INTE med)
  assert.deepEqual([by.begrepp.r, by.begrepp.t, by.begrepp.pct], [4, 5, 80]);
  assert.deepEqual([by.fakta.r, by.fakta.t, by.fakta.pct], [12, 15, 80]);
  assert.deepEqual([by.analys.r, by.analys.t, by.analys.pct], [3, 6, 50]);
  assert.equal(a.pct, Math.round((100 * 19) / 26));
  assert.equal(a.completed, 1);
  assert.equal(a.stars, 4);
  assert.equal(a.possibleStars, 9);
  assert.equal(a.possibleStarPct, 44);
  assert.equal(a.lastMs, 1_790_100_000 * 1000);
});

test("hela ämnet: alla valda områden summeras", () => {
  const [a] = rowsFor(["vikingar", "rymden"], 18);
  const begrepp = a.perCategory.find((c) => c.key === "begrepp");
  assert.deepEqual([begrepp.r, begrepp.t], [4, 8]);
  assert.equal(a.stars, 6);
});

test("gammal data utan kategorier → pct null, inga kategoridata, stjärnor kvar", () => {
  const rows = rowsFor(["vikingar"], 9);
  const b = rows.find((r) => r.studentId === "b");
  assert.equal(b.pct, null);
  assert.equal(b.hasCategoryData, false);
  assert.equal(b.stars, 2);
  assert.deepEqual(b.perMode.map((m) => m.mode), ["para"]);
  const c = rows.find((r) => r.studentId === "c");
  assert.equal(c.active, false);
  assert.equal(c.lastMs, null);
});

test("möjliga stjärnor understiger aldrig intjänade (t.ex. äventyrslägen utanför matrisens tak)", () => {
  const [a] = rowsFor(["vikingar"], 3);
  assert.equal(a.possibleStars, 4);
  assert.equal(a.possibleStarPct, 100);
});

test("sortering: null sist åt båda hållen, lika värden på namn", () => {
  const rows = rowsFor(["vikingar"], 9);
  assert.deepEqual(sortPluggaRows(rows, "pct", "desc").map((r) => r.namn), ["Alva", "Bo", "Cleo"]);
  assert.deepEqual(sortPluggaRows(rows, "pct", "asc").map((r) => r.namn), ["Alva", "Bo", "Cleo"]);
  assert.deepEqual(sortPluggaRows(rows, "stars", "asc").map((r) => r.namn), ["Cleo", "Bo", "Alva"]);
  assert.deepEqual(sortPluggaRows(rows, "namn", "desc").map((r) => r.namn), ["Cleo", "Bo", "Alva"]);
  assert.deepEqual(sortPluggaRows(rows, "lastMs", "desc").map((r) => r.namn), ["Alva", "Bo", "Cleo"]);
});

test("nextPluggaSort: numeriska kolumner börjar fallande, namn stigande, omklick vänder", () => {
  assert.deepEqual(nextPluggaSort({ key: "namn", dir: "asc" }, "pct"), { key: "pct", dir: "desc" });
  assert.deepEqual(nextPluggaSort({ key: "pct", dir: "desc" }, "pct"), { key: "pct", dir: "asc" });
  assert.deepEqual(nextPluggaSort({ key: "pct", dir: "desc" }, "namn"), { key: "namn", dir: "asc" });
  assert.deepEqual(PLUGGA_COLUMNS.map((c) => c.key), ["namn", "completed", "pct", "stars", "lastMs"]);
});

test("weakStrong: pekar ut svagast/starkast bara när det finns något att jämföra", () => {
  const [a] = rowsFor(["vikingar"], 9);
  // begrepp 80 (5 svar), fakta 80 (15 svar), analys 50 → analys svagast; starkast = högst %
  const ws = weakStrong(a.perCategory);
  assert.equal(ws.weakest, "analys");
  assert.ok(["begrepp", "fakta"].includes(ws.strongest));
  const one = [{ key: "fakta", t: 4, pct: 25 }, { key: "analys", t: 0, pct: null }];
  assert.deepEqual(weakStrong(one), { weakest: null, strongest: null });
  const same = [{ key: "fakta", t: 4, pct: 50 }, { key: "analys", t: 2, pct: 50 }];
  assert.deepEqual(weakStrong(same), { weakest: null, strongest: null });
  assert.deepEqual(weakStrong(null), { weakest: null, strongest: null });
});

test("pctLevel + lastActiveText", () => {
  assert.equal(pctLevel(null), "tom");
  assert.equal(pctLevel(0), "lag");
  assert.equal(pctLevel(34), "mellan");
  assert.equal(pctLevel(67), "hog");
  const now = new Date(2026, 9, 7, 12);
  assert.equal(lastActiveText(null, now), "aldrig");
  assert.equal(lastActiveText(new Date(2026, 9, 7, 8), now), "idag");
  assert.equal(lastActiveText(new Date(2026, 9, 6, 23), now), "igår");
  assert.equal(lastActiveText(new Date(2026, 9, 3), now), "4 dagar sedan");
  assert.equal(lastActiveText(new Date(2026, 8, 15), now), "3 veckor sedan");
});

// --- Bootgraf (#271) ----------------------------------------------------------

function staticBootGraph() {
  const start = join(SRC, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

test("lärarvyns nya filer ligger INTE i bootgrafen, och laddas med import()", () => {
  const graph = staticBootGraph();
  assert.ok(graph.has(join(SRC, "exercise-types.js")), "BFS:en hittar kända bootfiler");
  for (const f of ["teacher-plugga.js", "teacher-plugga-elev.js", "plugga-teacher-rows.js", "plugga-stats.js"]) {
    assert.equal(graph.has(join(SRC, f)), false, `${f} i bootgrafen`);
  }
  const cls = readFileSync(join(SRC, "teacher-class.js"), "utf8");
  assert.match(cls, /import\(["']\.\/teacher-plugga\.js["']\)/);
});
