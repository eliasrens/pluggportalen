// Klasscentret #479 – spellägena → Klass-EXP-registret (src/klasscenter/kc-koppling.js).
// Skrivningen mockas: en minnes-award() som räknar EXACT som kc-exp-data.js
// (planKlassExp mot elevens räknare, räknarna sparas efter varje omgång) →
// rätt antal EXP vid gränsfallen per modul. Plus: anropspunkterna skickar rätt
// resultatform, och kopplingen ligger utanför bootgrafen (#271).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  behoverSkrivning, klassExpEfterOvning, liveBonusar, liveKlassBonus,
} from "../src/klasscenter/kc-koppling.js";
import { planKlassExp } from "../src/klasscenter/kc-exp-regler.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const las = (f) => readFileSync(join(SRC, f), "utf8");

/** Minnes-"Firestore": en klass, elevens räknare + klassens EXP. */
function minnesKlass({ klasser = ["k1"] } = {}) {
  const counts = {};
  const state = { exp: 0, anrop: 0 };
  async function award({ modul, resultat, area }) {
    state.anrop++;
    const ut = {};
    for (const id of klasser) {
      const { antal, raknare } = planKlassExp(modul, resultat, { area, raknare: counts });
      if (raknare) Object.assign(counts, raknare);
      state.exp += antal;
      ut[id] = antal;
    }
    return ut;
  }
  const spela = (modul, resultat, area) => klassExpEfterOvning({ modul, resultat, area }, { award });
  return { award, counts, state, spela };
}

test("quiz/läsförståelse: ≥ 50 % rätt = 1, under = 0 (och ingen skrivning)", async () => {
  for (const modul of ["quiz", "lasforstaelse"]) {
    const k = minnesKlass();
    assert.deepEqual(await k.spela(modul, { ratt: 5, totalt: 10 }, "a"), { k1: 1 });
    assert.deepEqual(await k.spela(modul, { ratt: 10, totalt: 10 }, "a"), { k1: 1 });
    assert.deepEqual(await k.spela(modul, { ratt: 4, totalt: 10 }, "a"), {});
    assert.deepEqual(await k.spela(modul, { ratt: 3, totalt: 7 }, "a"), {}); // 42 %
    assert.deepEqual(await k.spela(modul, { ratt: 4, totalt: 7 }, "a"), { k1: 1 }); // 57 %
    assert.equal(k.state.exp, 3);
    assert.equal(k.state.anrop, 3, "under 50 % → award anropas aldrig");
  }
});

test("para/memory/jakt/sanningsjakt/lastext/äventyr: bara 3 första gångerna per område", async () => {
  for (const modul of ["para", "memory", "kunskapsjakt", "sanningsjakt", "lastext", "aventyr:gruvan"]) {
    const k = minnesKlass();
    const r = [];
    for (let i = 0; i < 5; i++) r.push((await k.spela(modul, undefined, "bråk")).k1);
    assert.deepEqual(r, [1, 1, 1, 0, 0], modul);
    assert.equal((await k.spela(modul, {}, "decimaltal")).k1, 1, `${modul}: nytt område räknas från 0`);
    assert.equal(k.state.exp, 4);
  }
});

test("Läsresan: 5/7 = 1, 4/7 = 0", async () => {
  const k = minnesKlass();
  assert.deepEqual(await k.spela("lasresan", { ratt: 5, totalt: 7 }), { k1: 1 });
  assert.deepEqual(await k.spela("lasresan", { ratt: 7, totalt: 7 }), { k1: 1 });
  assert.deepEqual(await k.spela("lasresan", { ratt: 4, totalt: 7 }), {});
  assert.equal(k.state.exp, 2);
});

test("Mattematchen: var 20:e server-bekräftade rätt = 1, övriga svar skriver inget", async () => {
  const k = minnesKlass();
  // Som page-mattematchen.js: bekraftade startar på elevens tidigare rätt (17).
  let bekraftade = 17;
  for (let i = 0; i < 25; i++) {
    const rattFore = bekraftade++;
    await k.spela("mattematchen", { rattFore, rattEfter: bekraftade });
  }
  // 17 → 42 passerar 20 och 40.
  assert.equal(k.state.exp, 2);
  assert.equal(k.state.anrop, 2, "bara svaren som passerar en 20-gräns når skrivningen");
  assert.equal(behoverSkrivning("mattematchen", { rattFore: 19, rattEfter: 20 }), true);
  assert.equal(behoverSkrivning("mattematchen", { rattFore: 20, rattEfter: 21 }), false);
});

test("Räkna: 10 rätt = 1, resten följer med till nästa omgång", async () => {
  const k = minnesKlass();
  assert.deepEqual(await k.spela("rakna", { ratt: 7 }, "a"), { k1: 0 }); // rest 7 sparas
  assert.equal(k.counts["rakna|ratt"], 7);
  assert.deepEqual(await k.spela("rakna", { ratt: 3 }, "a"), { k1: 1 }); // 7+3 = 10
  assert.equal(k.counts["rakna|ratt"], 0);
  assert.deepEqual(await k.spela("rakna", { ratt: 9 }, "a"), { k1: 0 });
  assert.deepEqual(await k.spela("rakna", { ratt: 0 }, "a"), {}); // 0 rätt → ingen skrivning
  assert.deepEqual(await k.spela("rakna", { ratt: 10 }, "a"), { k1: 1 }); // 9+10 = 19
  assert.equal(k.counts["rakna|ratt"], 9);
  assert.equal(k.state.exp, 2);
});

test("okänt läge / saknat läge → ingen skrivning", async () => {
  const k = minnesKlass();
  assert.deepEqual(await k.spela("okant-lage", {}), {});
  assert.deepEqual(await k.spela("", {}), {});
  assert.equal(k.state.anrop, 0);
});

test("elev utan klass: inget klass-EXP, inget fel", async () => {
  const k = minnesKlass({ klasser: [] });
  assert.deepEqual(await k.spela("quiz", { ratt: 10, totalt: 10 }, "a"), {});
  assert.equal(k.state.exp, 0);
});

test("fel i skrivningen kastas aldrig vidare (elevens belöning skyddas)", async () => {
  const orig = console.warn;
  console.warn = () => {};
  try {
    const award = async () => { throw Object.assign(new Error("nej"), { code: "permission-denied" }); };
    assert.deepEqual(await klassExpEfterOvning({ modul: "quiz", resultat: { ratt: 9, totalt: 10 } }, { award }), {});
    const bonus = async () => { throw new Error("nej"); };
    assert.equal(await liveKlassBonus({ perClass: { a: { players: 2 } }, winner: "a" }, { bonus }), 0);
  } finally {
    console.warn = orig;
  }
});

test("Live: 'live' till varje klass med spelare + 'live-vinst' till vinnaren", async () => {
  const result = {
    perClass: { a: { players: 3 }, b: { players: 2 }, c: { players: 0 } },
    winner: "b",
  };
  assert.deepEqual(liveBonusar(result), [
    { classId: "a", kalla: "live" },
    { classId: "b", kalla: "live" },
    { classId: "b", kalla: "live-vinst" },
  ]);
  assert.deepEqual(liveBonusar({ ...result, winner: "draw" }).map((x) => x.kalla), ["live", "live"]);
  assert.deepEqual(liveBonusar(null), []);
  const anrop = [];
  const summa = await liveKlassBonus(result, { bonus: async (id, kalla) => { anrop.push(`${id}:${kalla}`); return 10; } });
  assert.equal(summa, 30);
  assert.deepEqual(anrop, ["a:live", "b:live", "b:live-vinst"]);
});

// --- Anropspunkterna ----------------------------------------------------------

test("anropspunkterna skickar rätt modul + resultatform (dynamiskt, utan await)", () => {
  const gs = las("game-shared.js");
  assert.match(gs, /import\("\.\/klasscenter\/kc-koppling\.js"\)\s*\.then\(\(m\) => m\.klassExpEfterOvning\(\{ modul: mode, resultat: classResult, area \}\)\)\s*\.catch/);
  assert.match(gs, /awardExercise\(area, mode, \{ stars, bestScore, baseCoins, catStats, classResult \}\)/);
  const quiz = las("games-quiz.js");
  assert.equal((quiz.match(/classResult: \{ ratt: correct, totalt: total \}/g) || []).length, 2, "quiz + läsförståelse");
  assert.match(las("games-rakna.js"), /classResult: \{ ratt: correct \}/);
  assert.match(las("lasresan/page-lasresan.js"), /modul: "lasresan", resultat: \{ ratt: a\.correct, totalt: a\.totalQuestions \}/);
  assert.match(las("tavling/page-mattematchen.js"), /modul: "mattematchen", resultat: \{ rattFore, rattEfter: bekraftade \}/);
  assert.match(las("live/live-data.js"), /if \(skrev\) \{\s*import\("\.\.\/klasscenter\/kc-koppling\.js"\)\.then\(\(m\) => m\.liveKlassBonus\(result\)\)/);
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

test("Klasscentret-modulerna ligger INTE i bootgrafen (bara dynamisk import)", () => {
  const graph = staticBootGraph();
  assert.ok(graph.has(join(SRC, "game-shared.js")), "BFS:en hittar kända bootfiler");
  for (const f of ["kc-koppling.js", "kc-exp-data.js", "kc-exp-regler.js", "kc-exp-skriv.js", "kc-niva.js"]) {
    assert.equal(graph.has(join(SRC, "klasscenter", f)), false, f);
  }
});
