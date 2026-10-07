// ============================================================================
// Enhetstest för elevvyns framsteg per kategori (#447, src/plugga-framsteg.js):
//   • nivå-etiketter, områdets kategorier, höjdpunkter, "blev bättre på"
//   • areaProgressHtml: kategoriserat område, fallback utan kategorier, ny elev
//   • resultFeedbackHtml: positiv ton, aldrig "fel", Memory utan stjärnhjälp
//   • bootgrafen: plugga-framsteg.js importeras bara dynamiskt (#271)
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KID_HINTS,
  categoryLevel,
  areaCategoryKeys,
  pickHighlights,
  improvedCategories,
  starHelpHtml,
  areaProgressHtml,
  resultFeedbackHtml,
} from "../src/plugga-framsteg.js";
import { categoryBreakdown } from "../src/plugga-stats.js";
import { QUESTION_CATEGORY_KEYS } from "../src/exercise-types.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

const AREA = {
  quiz: [
    { question: "a", category: "fakta" },
    { question: "b", category: "Analys/resonemang" },
    { question: "c" },
  ],
};
const PLAIN_AREA = { quiz: [{ question: "a" }, { question: "b" }] };

// Inga skuldbeläggande ord i elevtexten (Läsresan-tonen).
const NEGATIVE = /\bfel\b|dålig|misslyck|sämre|sämst|underkänd/i;

test("barnhint finns för varje kategori i katalogen", () => {
  assert.deepEqual(Object.keys(KID_HINTS), QUESTION_CATEGORY_KEYS);
});

test("categoryLevel: positiva nivåer, otestat utan procent", () => {
  assert.equal(categoryLevel({ t: 0, pct: null }).key, "ny");
  assert.equal(categoryLevel({ t: 4, pct: 25 }).key, "vaxer");
  assert.equal(categoryLevel({ t: 10, pct: 70 }).key, "bra");
  assert.equal(categoryLevel({ t: 10, pct: 90 }).key, "topp");
  assert.equal(categoryLevel(null).key, "ny");
});

test("areaCategoryKeys: bara kategorier som finns i quiz/par, i visningsordning", () => {
  assert.deepEqual(areaCategoryKeys(AREA), ["fakta", "analys"]);
  assert.deepEqual(areaCategoryKeys({ pairs: [{ category: "begrepp" }], quiz: [{ category: "fakta" }] }), ["begrepp", "fakta"]);
  assert.deepEqual(areaCategoryKeys(PLAIN_AREA), []);
  assert.deepEqual(areaCategoryKeys(null), []);
});

test("pickHighlights: starkast ≥ 70 %, träna på den lägsta under 70 %", () => {
  const rows = categoryBreakdown({ begrepp: { r: 9, t: 10 }, fakta: { r: 2, t: 6 }, analys: { r: 0, t: 0 } });
  const h = pickHighlights(rows);
  assert.equal(h.best.key, "begrepp");
  assert.equal(h.practice.key, "fakta");
  assert.equal(h.untested.key, "analys");
  const low = pickHighlights(categoryBreakdown({ fakta: { r: 1, t: 4 } }));
  assert.equal(low.best, null);
  assert.equal(low.practice.key, "fakta");
});

test("improvedCategories: kräver ≥2 svar före/efter och +10 procentenheter", () => {
  const before = { fakta: { r: 2, t: 6 }, analys: { r: 1, t: 1 } };
  const session = { fakta: { r: 4, t: 5 }, analys: { r: 3, t: 3 } };
  assert.deepEqual(improvedCategories(before, session).map((c) => c.key), ["fakta"]);
  assert.deepEqual(improvedCategories({}, session), []);
});

test("starHelpHtml förklarar 1–3 stjärnor och att bästa gången sparas", () => {
  const h = starHelpHtml();
  assert.match(h, /<details class="pf-hjalp">/);
  assert.match(h, /Vad betyder stjärnorna\?/);
  assert.match(h, /tappar aldrig stjärnor/);
});

test("areaProgressHtml: kategoriserat område visar områdets kategorier + stjärnor av möjliga", () => {
  const progress = {
    vik: {
      quiz: { completed: true, stars: 2, cat: { fakta: { r: 4, t: 5 }, analys: { r: 1, t: 4 } } },
      para: { completed: true, stars: 3 },
      reading: { x: { stars: 3 } },
    },
    annat: { quiz: { stars: 3, cat: { begrepp: { r: 5, t: 5 } } } },
  };
  const h = areaProgressHtml({ areaId: "vik", areaData: AREA, progress, starModes: ["quiz", "para", "kunskapsjakt"] });
  assert.match(h, /<b>5<\/b> av 9 ★/);
  assert.match(h, /4 av 5 rätt/);
  assert.match(h, /1 av 4 rätt/);
  assert.doesNotMatch(h, /Begrepp/, "kategorier från andra områden/utan frågor visas inte");
  assert.match(h, /Det här kan du bäst: 📌 <b>Fakta<\/b>/);
  assert.match(h, /Träna gärna mer på 🧠 <b>Analys<\/b>/);
  assert.doesNotMatch(h, NEGATIVE);
});

test("areaProgressHtml: ny elev på kategoriserat område uppmanas spela", () => {
  const h = areaProgressHtml({ areaId: "vik", areaData: AREA, progress: {}, starModes: ["quiz"] });
  assert.match(h, /<b>0<\/b> av 3 ★/);
  assert.match(h, /Spela för att se/);
  assert.match(h, /Spela Quiz, Kunskapsjakt eller ett äventyr/);
});

test("areaProgressHtml: område utan kategorier → fallback med stjärnor + förklaring, inga fel", () => {
  const progress = { gammal: { para: { completed: true, stars: 2 } } };
  const h = areaProgressHtml({ areaId: "gammal", areaData: PLAIN_AREA, progress, starModes: ["para", "quiz"] });
  assert.match(h, /<b>2<\/b> av 6 ★/);
  assert.match(h, /Varje övning ovanför kan ge upp till 3 ★/);
  assert.doesNotMatch(h, /pf-kat-lista/);
  assert.match(h, /pf-hjalp/);
  // Helt tom indata kraschar inte.
  assert.match(areaProgressHtml({ areaId: "x" }), /Ditt framsteg/);
});

test("areaProgressHtml: sparade svar syns även om områdets taggar tagits bort", () => {
  const progress = { gammal: { quiz: { stars: 1, cat: { begrepp: { r: 1, t: 2 } } } } };
  const h = areaProgressHtml({ areaId: "gammal", areaData: PLAIN_AREA, progress, starModes: ["quiz"] });
  assert.match(h, /Begrepp/);
});

test("resultFeedbackHtml: lyfter förbättring, föreslår vänligt, aldrig 'fel'", () => {
  const prevAreaProgress = { quiz: { cat: { fakta: { r: 1, t: 4 }, analys: { r: 2, t: 2 } } } };
  const h = resultFeedbackHtml({ catStats: { fakta: { r: 4, t: 4 }, analys: { r: 1, t: 3 } }, prevAreaProgress });
  assert.match(h, /Så gick det/);
  assert.match(h, /Du blev bättre på 📌 <b>Fakta<\/b>/);
  assert.match(h, /Nästa gång: träna lite mer på 🧠 <b>Analys<\/b>/);
  assert.match(h, /pf-hjalp/);
  assert.doesNotMatch(h, NEGATIVE);
});

test("resultFeedbackHtml: allt rätt, starkast, och kämpat", () => {
  assert.match(resultFeedbackHtml({ catStats: { fakta: { r: 3, t: 3 } } }), /Allt rätt/);
  const mixed = resultFeedbackHtml({ catStats: { fakta: { r: 3, t: 3 }, begrepp: { r: 1, t: 3 } } });
  assert.match(mixed, /extra bra på 📌 <b>Fakta<\/b>/);
  assert.match(mixed, /träna lite mer på 💡 <b>Begrepp<\/b>/);
  const low = resultFeedbackHtml({ catStats: { fakta: { r: 0, t: 3 } } });
  assert.match(low, /Bra kämpat/);
  assert.doesNotMatch(low, NEGATIVE);
});

test("resultFeedbackHtml: utan kategorier bara stjärnhjälpen; Memory (noStars) ingenting", () => {
  const h = resultFeedbackHtml({ catStats: null });
  assert.match(h, /pf-hjalp/);
  assert.doesNotMatch(h, /Så gick det/);
  assert.equal(resultFeedbackHtml({ noStars: true }), "");
  assert.match(resultFeedbackHtml(), /pf-hjalp/);
});

// --- Bootgraf (#271) -------------------------------------------------------------

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

test("plugga-framsteg.js ligger INTE i bootgrafen (bara dynamisk import)", () => {
  const graph = staticBootGraph();
  assert.ok(graph.has(join(SRC, "gamemodes.js")), "BFS:en hittar kända bootfiler");
  assert.ok(graph.has(join(SRC, "game-shared.js")));
  assert.equal(graph.has(join(SRC, "plugga-framsteg.js")), false);
  assert.equal(graph.has(join(SRC, "plugga-stats.js")), false);
});
