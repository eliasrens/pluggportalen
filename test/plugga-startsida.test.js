// ============================================================================
// Enhetstest för Plugga-startsidans kort (#702, spec §2.4):
//   • subjectColor: SO/Matematik/NO/Svenska/Engelska, färgfält vinner, okänt
//     ämne → färg efter plats i listan
//   • areaStarCount: samma "X av Y" som "Ditt framsteg" inne i området – även
//     när läraren dolt lägen (areaStarModes med klassen)
//   • isAreaNew: 7-dagarsfönster, spelat → inget märke, ingen tidsstämpel → inget
//   • bootgrafen: pages-elev.js laddar plugga-framsteg.js bara dynamiskt (#271)
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { areaStarModes } from "../src/gamemode-visibility.js";
import {
  subjectColor,
  SUBJECT_COLORS,
  areaStarCount,
  areaProgressHtml,
  isAreaNew,
  NEW_AREA_DAYS,
} from "../src/plugga-framsteg.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const DAG = 864e5;

test("subjectColor: kända ämnen på id och namn (gemener/versaler)", () => {
  assert.equal(subjectColor({ id: "so", name: "SO" }), "bla");
  assert.equal(subjectColor({ id: "x1", name: "Historia" }), "bla");
  assert.equal(subjectColor({ id: "matte", name: "Matematik" }), "orange");
  assert.equal(subjectColor({ id: "x2", name: "Matematik" }), "orange");
  assert.equal(subjectColor({ id: "no", name: "NO" }), "gron");
  assert.equal(subjectColor({ id: "x3", name: "  Biologi " }), "gron");
  assert.equal(subjectColor({ id: "sv", name: "Svenska" }), "lila");
  assert.equal(subjectColor({ id: "en", name: "Engelska" }), "rosa");
  assert.equal(subjectColor("SO"), "bla", "sträng (id/namn) går också");
});

test("subjectColor: färgfält på ämnet vinner, ogiltigt färgfält ignoreras", () => {
  assert.equal(subjectColor({ id: "so", name: "SO", color: "rosa" }), "rosa");
  assert.equal(subjectColor({ id: "so", name: "SO", color: "Gron" }), "gron");
  assert.equal(subjectColor({ id: "so", name: "SO", color: "#ff0000" }), "bla");
});

test("subjectColor: okänt ämne → färg efter plats i listan, sedan om från början", () => {
  assert.deepEqual(SUBJECT_COLORS, ["bla", "gron", "lila", "rosa", "orange"]);
  const okant = { id: "musik", name: "Musik" };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => subjectColor(okant, i)),
    ["bla", "gron", "lila", "rosa", "orange", "bla", "gron"]);
  assert.equal(subjectColor(okant), "bla", "utan index → första färgen");
  assert.equal(subjectColor(null, -3), "bla", "trasig indata kraschar inte");
});

test("areaStarCount: summerar stjärn-lägena, högst 3 per läge, ignorerar andra lägen", () => {
  const progress = { vik: { quiz: { stars: 5 }, para: { stars: 2 }, memory: { stars: 3 }, x: { stars: "3" } } };
  assert.deepEqual(areaStarCount({ areaId: "vik", progress, starModes: ["quiz", "para"] }),
    { stars: 5, maxStars: 6, pct: 83 });
  assert.deepEqual(areaStarCount({ areaId: "vik", progress, starModes: [] }), { stars: 0, maxStars: 0, pct: 0 });
  assert.deepEqual(areaStarCount({ areaId: "ny", progress: undefined, starModes: ["quiz"] }),
    { stars: 0, maxStars: 3, pct: 0 });
});

test("areaStarCount = 'Ditt framsteg' inne i området, även med dolda lägen", () => {
  const q = (n) => ({ question: `F${n}?`, options: ["a", "b"], answerIndex: 0 });
  const area = { id: "vik", name: "Vikingatiden", quiz: [1, 2, 3, 4].map(q), pairs: [{ term: "a", definition: "b" }] };
  const progress = { vik: { quiz: { stars: 3 }, para: { stars: 2 }, lasforstaelse: { stars: 1 }, memory: { stars: 3 } } };
  for (const cls of [null, { id: "4a", hiddenModes: ["quiz"] }, { id: "4a", hiddenModes: ["para", "memory"] }]) {
    const starModes = areaStarModes(area, cls).map((gm) => gm.id);
    assert.ok(!starModes.includes("memory"), "Memory ger aldrig stjärnor");
    const { stars, maxStars } = areaStarCount({ areaId: "vik", progress, starModes });
    const h = areaProgressHtml({ areaId: "vik", areaData: area, progress, starModes });
    assert.match(h, new RegExp(`<b>${stars}</b> av ${maxStars} ★`), `samma siffror (dolt: ${cls?.hiddenModes})`);
  }
  // Dolt quiz sänker både X och Y.
  const alla = areaStarCount({ areaId: "vik", progress, starModes: areaStarModes(area, null).map((g) => g.id) });
  const utanQuiz = areaStarCount({ areaId: "vik", progress,
    starModes: areaStarModes(area, { id: "4a", hiddenModes: ["quiz"] }).map((g) => g.id) });
  assert.equal(alla.stars - utanQuiz.stars, 3);
  assert.equal(alla.maxStars - utanQuiz.maxStars, 3);
});

test("isAreaNew: skapat/tilldelat inom 7 dagar och ospelat → Ny!", () => {
  const now = Date.UTC(2026, 9, 14);
  assert.equal(NEW_AREA_DAYS, 7);
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now - 2 * DAG }, now }), true);
  assert.equal(isAreaNew({ area: { id: "a", createdAt: { seconds: (now - DAG) / 1000 } }, now }), true, "Firestore-{seconds}");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: { toMillis: () => now - DAG } }, now }), true, "Timestamp");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: new Date(now - DAG) }, now }), true, "Date");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now - 30 * DAG }, assignment: { assignedAt: now - 3 * DAG }, now }),
    true, "gammalt område som nyss tilldelats");
});

test("isAreaNew: gammalt, spelat, framtida eller utan tidsstämpel → inget märke", () => {
  const now = Date.UTC(2026, 9, 14);
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now - 8 * DAG }, now }), false);
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now - 7 * DAG }, now }), false, "exakt 7 dagar = inte nytt");
  assert.equal(isAreaNew({ area: { id: "a" }, now }), false, "ingen tidsstämpel");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: "igår" }, now }), false, "okänt format");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now + DAG }, now }), false, "framtid");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now - DAG }, progress: { a: { quiz: { stars: 0 } } }, now }),
    false, "eleven har spelat");
  assert.equal(isAreaNew({ area: { id: "a", createdAt: now - DAG }, progress: { a: {} }, now }), true, "tom post = ospelat");
});

test("bootgraf (#271): pages-elev.js laddar plugga-framsteg.js bara dynamiskt", () => {
  const src = readFileSync(join(SRC, "pages-elev.js"), "utf8");
  assert.doesNotMatch(src, /^\s*import\s[^(]*from\s+["']\.\/plugga-framsteg\.js["']/m);
  assert.match(src, /import\(["']\.\/plugga-framsteg\.js["']\)/);
});
