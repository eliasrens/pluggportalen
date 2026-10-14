// ============================================================================
// Enhetstester: Datakuppen (#652, epic Datakuppen) – formatet, filtabellen,
// kodlistan och de rena kodreglerna (ingen emulator). Servern:
// functions-datakuppen-core/-hack.test.mjs (kärnan mot Firestore-emulatorn) +
// functions-datakuppen.test.mjs (callables). Spec §6 test 2b, 10, 11, 12, 15, 17.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listFormats, getFormat, answerKindsFor } from "../src/live/formats/index.js";
import { validateFormat } from "../src/live/live-formats.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { buildSessionDoc, validateSessionInput } from "../src/live/live-core.js";
import { fieldsFor } from "../src/live/live-setup-fields.js";
import { seededRng } from "../src/mult/generator.js";
import {
  DK_DURATIONS_MIN, DK_PRIVATE_DOC, DK_PUBLIC_DOC, validateSetup, buildSessionFields, computeStandings, buildResult, hackStats,
} from "../src/live/formats/datakuppen/datakuppen-core.js";
import { DK_FILES, DK_RULES, DK_CURRENCY, DK_TIPS } from "../src/live/formats/datakuppen/delat/files-config.js";
import {
  chestTable, rollChest, applySelfEffect, resolveVictim, victimProblem, eventText, codeOk, codeList, codeOffers,
  pickDecoys, hackOptions, shuffle,
} from "../src/live/formats/datakuppen/delat/datakuppen-regler.js";
import { driftedFiles, datakuppenFiles, toFunctionsCopy } from "../admin/sync-guldrush-functions.mjs";

const DK = getFormat("datakuppen");
const MULT = requireGameMode("multiplication_0_10");
const QUIZ = requireGameMode("plugga_quiz");
const JSON_LIST = JSON.parse(readFileSync(new URL("../src/live/formats/datakuppen/delat/koder.json", import.meta.url), "utf8"));
const CODES = codeList(JSON_LIST);

const input = (over = {}) => ({
  name: "Datakuppen 4B", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: "free",
  classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10, hacking: true, showNames: true, ...over,
});

describe("Datakuppen: formatet (§3)", () => {
  it("registrerat sist i väljaren: inom-klass, 1–3 klasser, pacing tid, free+choice, giltigt interface", () => {
    assert.equal(listFormats().at(-1), DK);
    assert.deepEqual(validateFormat(DK), []);
    assert.equal(DK.scope, "inom-klass");
    assert.deepEqual([DK.minClasses, DK.maxClasses], [1, 3]);
    assert.equal(DK.pacing, "tid");
    assert.equal(DK.timelineQuestions, true, "tidslinjefrågor som Guldrushen");
    assert.deepEqual(DK.privateDocs, [DK_PRIVATE_DOC, DK_PUBLIC_DOC]);
    for (const fn of ["projectorViews", "studentView", "historyRenderer"]) assert.equal(typeof DK[fn], "function");
  });

  it("innehåll och svarssätt: multiplikation (skriv själv eller flerval), quiz från Plugga (flerval)", () => {
    assert.deepEqual(answerKindsFor(DK, MULT), ["free", "choice"]);
    assert.deepEqual(answerKindsFor(DK, QUIZ), ["choice"]);
    assert.equal(DK.compatibleGameModes({ id: "okant", answerKinds: ["free"] }), false);
  });

  it("inställningar: speltid 3–30 + Egen tid, Hackning + namn på som standard, Pluggmynt", () => {
    assert.deepEqual(fieldsFor(DK).map((f) => f.key), ["durationMin", "hacking", "showNames", "rewards"]);
    const dur = DK.setupFields.find((f) => f.key === "durationMin");
    assert.deepEqual(dur.options.map((o) => o.value), [3, 5, 10, 15, 20, 30]);
    assert.deepEqual([dur.custom.min, dur.custom.max], [1, 60]);
    assert.deepEqual(DK_DURATIONS_MIN, [3, 5, 10, 15, 20, 30]);
    assert.equal(DK.setupFields.find((f) => f.key === "hacking").default, true);
    assert.equal(DK.setupFields.find((f) => f.key === "showNames").default, true);
  });

  it("test 17: valfri speltid 1–60 hela minuter; 0/61/decimal nekas; 1–3 klasser", () => {
    for (const m of [1, 7, 25, 60, "12"]) assert.deepEqual(validateSessionInput(input({ durationMin: m })), [], String(m));
    for (const bad of [0, 61, 2.5, ""]) assert.ok(validateSetup({ durationMin: bad }).length, String(bad));
    assert.ok(validateSessionInput(input({ classIds: ["a", "b", "c", "d"] })).some((e) => /Högst 3/.test(e)));
  });

  it("sessionsdokumentet: format, hacking/showNames, Pluggmynt", () => {
    const d = buildSessionDoc(input({ hacking: false, rewards: { firstPrize: 300, perCorrect: 5, cap: 300 } }), { uid: "larare1" });
    assert.deepEqual([d.format, d.hacking, d.showNames, d.durationSeconds], ["datakuppen", false, true, 600]);
    assert.deepEqual(d.rewards, { firstPrize: 300, perCorrect: 5, cap: 300 });
    assert.equal("stealSwap" in d, false);
    assert.deepEqual(buildSessionFields({}), { hacking: true, showNames: true });
  });

  it("test 15: resultat – placering ur data (MB), Pluggmynt efter matchen, hackstatistik för hela klassen", () => {
    const s = { id: "s1", format: "datakuppen", participatingClassIds: ["4b"], classNames: { "4b": "4B" }, rewards: { firstPrize: 300, perCorrect: 5, cap: 300 } };
    const players = [{ uid: "a", classId: "4b", name: "Alma" }, { uid: "b", classId: "4b", name: "Omar" }];
    const dkPlayers = [
      { uid: "a", gold: 120, correct: 4, incorrect: 1, hackAttempts: 3, hackSuccess: 1 },
      { uid: "b", gold: 80, correct: 2, incorrect: 0, hackAttempts: 1, hackSuccess: 1 },
    ];
    const st = computeStandings(s, { players, dkPlayers });
    assert.deepEqual(st.players.map((p) => [p.uid, p.gold, p.rank]), [["a", 120, 1], ["b", 80, 2]]);
    const r = buildResult(s, [], players, MULT, { dkPlayers });
    assert.deepEqual([r.format, r.winner, r.totalGold], ["datakuppen", null, 200]);
    assert.deepEqual(r.hacks, { attempts: 4, success: 2 });
    assert.ok(r.rewards.a.prize > r.rewards.b.prize, "placeringspris −15 % per plats");
    assert.deepEqual(hackStats([]), { attempts: 0, success: 0 });
  });
});

describe("Datakuppen: filerna (§1.3)", () => {
  it("filtabellen: alla nio filer, valutan och säkerhetstipsen i konfigurationen", () => {
    assert.deepEqual(DK_FILES.map((f) => f.id),
      ["liten_fil", "mapp", "stor_fil", "serverhall", "overklockning", "virus", "tom_mapp", "brandvagg", "hack"]);
    assert.deepEqual(DK_CURRENCY, { name: "data", unit: "MB", icon: "💾" });
    assert.ok(DK_TIPS.length >= 4);
    assert.deepEqual([DK_RULES.shieldMs, DK_RULES.protectionMs, DK_RULES.codeOffers, DK_RULES.codeOptions], [60_000, 30_000, 4, 3]);
  });

  it("test 10: hackning av → Hack kan inte komma, vikten går till datafilerna", () => {
    assert.ok(!chestTable(false).some((r) => r.chest.id === "hack"));
    const sum = (rows) => rows.reduce((n, r) => n + r.weight, 0);
    assert.equal(Math.round(sum(chestTable(false))), Math.round(sum(chestTable(true))));
    const rng = seededRng(652);
    for (let i = 0; i < 2000; i++) assert.notEqual(rollChest(false, rng).id, "hack");
  });

  it("test 11: virus högst 10 % och aldrig allt; hack högst 15 % och aldrig allt", () => {
    const virus = DK_FILES.find((f) => f.id === "virus");
    for (const g of [0, 1, 9, 10, 100, 1234, 999_999]) {
      const e = applySelfEffect(virus, g);
      assert.ok(-e.delta <= g * 0.1 && (g === 0 || e.gold > 0), String(g));
      const h = resolveVictim("steal", { gold: 0 }, { gold: g });
      assert.ok(h.amount <= g * 0.15 && (g === 0 || h.victimGold > 0), String(g));
    }
  });

  it("för lite data att hacka; händelsetexten för hack och terminalraden", () => {
    assert.equal(victimProblem("steal", { uid: "o" }, { uid: "a", gold: 6 }, 0), "for-lite-guld");
    assert.equal(victimProblem("steal", { uid: "o" }, { uid: "a", gold: 7 }, 0), null);
    const ev = { type: "steal", chest: "hack", name: "Alma", victimName: "Omar", amount: 45 };
    assert.equal(eventText(ev), "💻 Alma hackade Omar: +45 MB");
    assert.equal(eventText(ev, { short: true }), "> Alma hackade Omar: +45 MB");
    assert.equal(eventText(ev, { names: false, short: true }), "> Någon hackade en klasskamrat: +45 MB");
  });
});

describe("Datakuppen: koderna (§1.2, test 2b, 12)", () => {
  it("test 2b: listan har 100 giltiga koder – minst en siffra, minst tre bokstäver, inga å/ä/ö, inga dubbletter", () => {
    const raw = JSON_LIST.koder.map((k) => k.kod);
    assert.equal(raw.length, 100);
    assert.equal(new Set(raw).size, 100);
    assert.deepEqual(CODES, raw);
    for (const k of raw) {
      assert.ok(codeOk(k), k);
      assert.match(k, /^[a-z0-9]+$/);
      assert.ok(!/[åäö]/.test(k));
    }
    for (const bad of ["abc", "12345", "ab1", "Rob0t", "bå7", "r0b 0t", "", null]) assert.equal(codeOk(bad), false, String(bad));
  });

  it("codeOffers: n olika koder ur listan, de undvikna först bort; tar listan slut återanvänds koder", () => {
    const rng = seededRng(1);
    const taken = new Set(CODES.slice(0, 90));
    const o = codeOffers(CODES, [taken], rng, 4);
    assert.equal(new Set(o).size, 4);
    for (const c of o) assert.ok(!taken.has(c));
    const full = codeOffers(CODES, [new Set(CODES.slice(0, 98))], rng, 4, CODES[99]);
    assert.equal(new Set(full).size, 4);
    assert.ok(full.includes(CODES[98]) && !full.includes(CODES[99]), "egen kod föreslås aldrig");
  });

  it("test 12: lockkoder aldrig rätt kod eller någons kod, helst samma längd (±1)", () => {
    const rng = seededRng(7);
    for (const right of ["r0b0t", "p4nnk4k4", "vattenm310n"]) {
      const strict = new Set(CODES.filter((c) => c !== right).slice(0, 40));
      const d = pickDecoys(CODES, right, { strict }, rng);
      assert.equal(d.length, 2);
      for (const c of d) {
        assert.ok(c !== right && !strict.has(c) && CODES.includes(c));
        assert.ok(Math.abs(c.length - right.length) <= 1, `${c} ~ ${right}`);
      }
    }
  });

  it("hackOptions: rätt + lockkoder minus strukna, blandat; aldrig samma ordning som förra gången", () => {
    const rng = seededRng(3);
    const o = hackOptions("r0b0t", ["b4n4n", "n1nj4"], [], rng);
    assert.deepEqual([...o].sort(), ["b4n4n", "n1nj4", "r0b0t"]);
    for (let i = 0; i < 50; i++) {
      const again = hackOptions("r0b0t", ["b4n4n", "n1nj4"], ["n1nj4"], rng, o);
      assert.deepEqual([...again].sort(), ["b4n4n", "r0b0t"]);
      assert.notDeepEqual(again, o.filter((c) => c !== "n1nj4"));
    }
    assert.deepEqual(hackOptions("r0b0t", ["b4n4n", "n1nj4"], ["b4n4n", "n1nj4"], rng), ["r0b0t"]);
    assert.deepEqual([...shuffle([1, 2, 3], rng)].sort(), [1, 2, 3]);
  });
});

describe("Datakuppen: delat med servern", () => {
  it("functions/datakuppen/ är en exakt kopia (även koder.json) och läser motorn ur functions/kistspel/", () => {
    assert.deepEqual(datakuppenFiles(), ["datakuppen-regler.js", "files-config.js", "koder.json"]);
    assert.deepEqual(driftedFiles(), [], "kör npm run sync:kistspel");
    const src = readFileSync(new URL("../src/live/formats/datakuppen/delat/datakuppen-regler.js", import.meta.url), "utf8");
    const copy = readFileSync(new URL("../functions/datakuppen/datakuppen-regler.js", import.meta.url), "utf8");
    assert.equal(copy, toFunctionsCopy(src));
    assert.match(copy, /from "\.\.\/kistspel\/ks-regler\.js"/);
  });

  it("servern läser kopian (inte src/) och exporterar de fem anropen", () => {
    for (const f of ["core", "server", "koder", "hack"]) {
      const src = readFileSync(new URL(`../functions/datakuppen-${f}.js`, import.meta.url), "utf8");
      assert.doesNotMatch(src, /^import .*src\/live/m, f);
    }
    const idx = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
    for (const fn of ["datakuppAnswer", "datakuppOpenFile", "datakuppChooseTarget", "datakuppGuessCode", "datakuppPickCode"]) {
      assert.match(idx, new RegExp(`export const ${fn} = `), fn);
    }
  });
});
