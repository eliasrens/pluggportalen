// Enhetstester: Live-formatregistret (#547) – src/live/live-formats.js +
// src/live/formats/. Bevisar interfacet, uppslaget (session utan format =
// Klassmatchen), att ett nytt format kan registreras utan kärnändring, och
// att Klassmatchens computeStandings/buildResult ger EXAKT samma resultat som
// live-core före refaktorn (fryst kopia i test/fixtures/live-core-fore-547.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FORMAT, formatIdOf, formatOf, getFormat, requireFormat, listFormats, answerKindsFor,
} from "../src/live/formats/index.js";
import { registerFormat, validateFormat } from "../src/live/live-formats.js";
import { requireGameMode } from "../src/live/modes/index.js";
import * as core from "../src/live/live-core.js";
import * as fore from "./fixtures/live-core-fore-547.js";
import { seededRng } from "../src/mult/generator.js";

const KM = requireFormat("klassmatch");

describe("formatregistret: uppslag", () => {
  it("Klassmatchen är registrerad, förvald och uppfyller interfacet", () => {
    assert.equal(DEFAULT_FORMAT, "klassmatch");
    assert.deepEqual(validateFormat(KM), []);
    assert.ok(Object.isFrozen(KM));
    assert.equal(KM.scope, "mellan-klasser");
    assert.equal(KM.minClasses, 2);
    assert.equal(KM.maxClasses, 8);
    assert.deepEqual(KM.answerKinds, ["free"]);
    assert.equal(KM.pacing, "tid");
    assert.equal(KM.classCounters, true);
    assert.equal(KM.classDivisors, true);
    assert.ok(listFormats().some((f) => f.id === "klassmatch"));
  });

  it("session utan format (alla före #547) = Klassmatchen; null likaså", () => {
    assert.equal(formatIdOf({ name: "gammal" }), "klassmatch");
    assert.equal(formatIdOf({ format: null }), "klassmatch");
    assert.equal(formatIdOf(null), "klassmatch");
    assert.equal(formatOf({}), KM);
    assert.equal(formatOf({ format: "klassmatch" }), KM);
  });

  it("okänt format → null (getFormat/formatOf) och kast (requireFormat)", () => {
    assert.equal(getFormat("finns_inte"), null);
    assert.equal(formatOf({ format: "finns_inte" }), null);
    assert.throws(() => requireFormat("finns_inte"), /Okänt Live-format/);
  });

  it("svarssätt: format ∩ spelläge, spelläge utan answerKinds = [\"free\"]", () => {
    const mult = requireGameMode("multiplication_0_10");
    assert.deepEqual(answerKindsFor(KM, mult), ["free"]);
    assert.deepEqual(answerKindsFor(KM, { answerKinds: ["choice"] }), []);
    assert.deepEqual(answerKindsFor({ answerKinds: ["free", "choice"] }, { answerKinds: ["choice", "free"] }), ["free", "choice"]);
    assert.equal(KM.compatibleGameModes(mult), true);
    assert.equal(KM.compatibleGameModes({ answerKinds: ["choice"] }), false);
  });

  it("projektor-, elev- och historikdelarna laddas latt (funktioner, inte moduler)", () => {
    for (const k of ["projectorViews", "studentView", "historyRenderer"]) assert.equal(typeof KM[k], "function");
  });
});

describe("formatregistret: nytt format utan kärnändring", () => {
  const nytt = (over = {}) => ({
    id: "test_inom_klass",
    displayName: "Testformat",
    icon: "🧪",
    scope: "inom-klass",
    minClasses: 1,
    maxClasses: 3,
    answerKinds: ["free", "choice"],
    pacing: "lärarstyrd",
    setupFields: [{ key: "questionSeconds", label: "Tid per fråga", kind: "choice" }],
    compatibleGameModes: () => true,
    validateSetup: () => [],
    buildSessionFields: (i) => ({ questionSeconds: i.questionSeconds }),
    sessionTitle: (s) => s.name,
    computeStandings: () => ({ classes: [], totalCorrect: 0, leaderIds: [], winnerId: null, draw: false }),
    buildResult: () => ({}),
    projectorViews: async () => ({ views: [] }),
    studentView: async () => ({}),
    historyRenderer: async () => ({}),
    ...over,
  });

  it("registreras, slås upp ur sessionen och styr kärnans validering + dokument", () => {
    const f = registerFormat(nytt());
    assert.equal(formatOf({ format: "test_inom_klass" }), f);
    assert.equal(f.classCounters, false);
    const input = { name: "Fredagsquiz", format: f.id, gameMode: "multiplication_0_10", classIds: ["4b"], questionSeconds: 20 };
    // En klass räcker, ingen matchlängd krävs (lärarstyrd).
    assert.deepEqual(core.validateSessionInput(input), []);
    assert.deepEqual(core.validateSessionInput({ ...input, classIds: [] }), ["Välj minst en klass."]);
    assert.deepEqual(core.validateSessionInput({ ...input, classIds: ["a", "b", "c", "d"] }), ["Högst 3 klasser."]);
    const d = core.buildSessionDoc({ ...input, classNames: { "4b": "4B" }, durationMin: 0 }, { uid: "rasmus" });
    assert.equal(d.format, "test_inom_klass");
    assert.equal(d.questionSeconds, 20);
    assert.ok(!("classDivisors" in d) && !("counterShards" in d));
    assert.throws(() => registerFormat(nytt()), /finns redan/);
  });

  it("validateFormat fångar brister", () => {
    const errs = validateFormat(nytt({
      id: "X", scope: "överallt", minClasses: 3, maxClasses: 2, answerKinds: ["rösta"], pacing: "snabb",
      setupFields: [{}], computeStandings: null, classCounters: "ja",
    }));
    for (const re of [/id/, /scope/, /minClasses/, /answerKinds/, /pacing/, /setupFields/, /computeStandings/, /classCounters/]) {
      assert.ok(errs.some((e) => re.test(e)), `saknar fel för ${re}`);
    }
    assert.deepEqual(validateFormat(null), ["format saknas"]);
  });

  it("okänt format i formuläret → ett tydligt fel, inget kast", () => {
    assert.ok(core.validateSessionInput({ name: "x", gameMode: "m", format: "finns_inte" }).includes("Välj ett format."));
  });
});

// --- Identiskt resultat före/efter refaktorn ------------------------------
const T = 1_800_000_000_000;
const INPUT = {
  name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
  classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 17, "5e": 22 },
};

function slumpSession(rng) {
  const n = 2 + Math.floor(rng() * 7); // 2–8 klasser
  const classIds = Array.from({ length: n }, (_, i) => `k${i}`);
  const classNames = Object.fromEntries(classIds.map((id, i) => [id, rng() < 0.2 ? undefined : `${4 + (i % 3)}${"ABCDE"[i % 5]}`]));
  const divisors = Object.fromEntries(classIds.map((id) => [id, 1 + Math.floor(rng() * 30)]));
  const statuses = ["lobby", "live", "finished"];
  return {
    ...fore.buildSessionDoc({ ...INPUT, classIds, classNames, divisors, coinPrize: rng() < 0.5 ? "1000" : "" }, { uid: "u" }),
    status: statuses[Math.floor(rng() * 3)],
    // Ibland en trasig/saknad nämnare (divisorFor faller tillbaka på 1).
    ...(rng() < 0.15 ? { classDivisors: { [classIds[0]]: 0 } } : {}),
  };
}

function slumpData(s, rng) {
  const ids = [...s.participatingClassIds, "främling"];
  const counters = Array.from({ length: Math.floor(rng() * 25) }, () => ({
    classId: ids[Math.floor(rng() * ids.length)], shard: Math.floor(rng() * 10),
    // Ibland lika poäng (oavgjort) – små tal ger fler krockar.
    correct: Math.floor(rng() * (rng() < 0.5 ? 4 : 400)),
  }));
  if (rng() < 0.1) counters.push(null, { correct: 5 });
  const players = Array.from({ length: Math.floor(rng() * 30) }, (_, i) => ({
    uid: `e${i}`, name: `Elev ${i}`, classId: ids[Math.floor(rng() * ids.length)],
    correct: Math.floor(rng() * 50), incorrect: Math.floor(rng() * 10),
    lastSeenAt: rng() < 0.2 ? undefined : T - Math.floor(rng() * 150_000),
  }));
  return { counters, players };
}

const koop = (goal) => ({
  id: "multiplication_0_10", cooperative: true,
  goalReached: (st) => st.reduce((n, c) => n + c.score, 0) >= goal,
});

describe("Klassmatchen: identiskt resultat som före refaktorn", () => {
  it("computeStandings = classStandings + decideWinner (som live-feed räknade), 2 000 slumpfall", () => {
    const rng = seededRng(547);
    for (let i = 0; i < 2000; i++) {
      const s = slumpSession(rng);
      const { counters, players } = slumpData(s, rng);
      // Före: live-feed compute() – "redo" bara i lobbyn.
      const classes = fore.classStandings(s, fore.sumCounters(counters), players, s.status === "lobby" ? T : null);
      const w = fore.decideWinner(classes);
      const expected = {
        classes, totalCorrect: classes.reduce((n, c) => n + c.correct, 0),
        leaderIds: w.leaderIds, winnerId: w.winnerId, draw: w.draw,
      };
      assert.deepEqual(KM.computeStandings(s, { counters, players, now: T }), expected, `fall ${i}`);
    }
  });

  it("buildResult (tävling + kooperativt, mål nått/ej) = före, 2 000 slumpfall", () => {
    const rng = seededRng(5470);
    const modes = [null, requireGameMode("multiplication_0_10"), koop(10), koop(1e9), { ...koop(0), id: "annat" }];
    for (let i = 0; i < 2000; i++) {
      const s = { ...slumpSession(rng), status: "finished" };
      const { counters, players } = slumpData(s, rng);
      const mode = modes[i % modes.length];
      const before = fore.buildResult(s, fore.classStandings(s, fore.sumCounters(counters), players), players, mode);
      const { classes } = KM.computeStandings(s, { counters, players });
      assert.deepEqual(KM.buildResult(s, classes, players, mode), before, `fall ${i}`);
    }
  });

  it("historikens omräkning (ensureResult) ger samma result som förut – spec-exemplet 340/17 mot 418/22", () => {
    const s = { ...core.buildSessionDoc(INPUT, { uid: "rasmus" }), status: "finished", startedAt: T };
    const counters = [{ classId: "4b", shard: 0, correct: 200 }, { classId: "4b", shard: 3, correct: 140 }, { classId: "5e", shard: 1, correct: 418 }];
    const players = [{ uid: "a", classId: "4b" }, { uid: "b", classId: "5e" }];
    const r = KM.buildResult(s, KM.computeStandings(s, { counters, players }).classes, players, null);
    assert.deepEqual(r, fore.buildResult(s, fore.classStandings(s, fore.sumCounters(counters), players), players, null));
    assert.equal(r.winner, "4b");
    assert.deepEqual(r.winnerClasses, ["4b"]);
  });

  it("sessionsdokumentet: före-fälten oförändrade + format \"klassmatch\"", () => {
    const rng = seededRng(54);
    for (let i = 0; i < 300; i++) {
      const s = slumpSession(rng);
      const input = {
        ...INPUT, classIds: s.participatingClassIds, classNames: s.classNames,
        divisors: Object.fromEntries(s.participatingClassIds.map((id) => [id, 1 + (i % 40)])),
        coinPrize: ["", "0", "1000", " 2 500 ", "abc"][i % 5],
        wizards: i % 3 ? undefined : { [s.participatingClassIds[0]]: "elias", [s.participatingClassIds[1]]: "rasmus" },
      };
      assert.deepEqual(core.buildSessionDoc(input, { uid: "u" }), { ...fore.buildSessionDoc(input, { uid: "u" }), format: "klassmatch" });
      assert.deepEqual(core.validateSessionInput(input), fore.validateSessionInput(input));
    }
  });

  it("formulärets felmeddelanden oförändrade (text och ordning)", () => {
    const fel = [
      {}, { ...INPUT, name: "" }, { ...INPUT, classIds: ["4b"] }, { ...INPUT, classIds: Array.from({ length: 9 }, (_, i) => `k${i}`) },
      { ...INPUT, durationMin: 7, coinPrize: "x", divisors: { "4b": 0, "5e": 1000 } }, { ...INPUT, name: "a".repeat(81), gameMode: "" },
    ];
    for (const input of fel) {
      assert.deepEqual(core.validateSessionInput(input, { knownModes: ["multiplication_0_10"] }),
        fore.validateSessionInput(input, { knownModes: ["multiplication_0_10"] }));
    }
  });
});

describe("Bootgrafen: formaten bara dynamiskt (#271)", () => {
  it("ingen fil i src/live/ (formatregistret inräknat) nås statiskt från app.js", () => {
    const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const seen = new Set([join(SRC, "app.js")]);
    const queue = [...seen];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try { src = readFileSync(file, "utf8"); } catch { continue; }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    assert.ok(seen.has(join(SRC, "game-shared.js")), "BFS:en hittar kända bootfiler");
    assert.deepEqual([...seen].filter((f) => f.startsWith(join(SRC, "live"))), []);
  });
});
