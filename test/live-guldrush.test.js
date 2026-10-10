// ============================================================================
// Enhetstester: Guldrushen (#563, epic #562) – formatet, kistkonfigen och
// spelreglerna (ingen emulator). Servern: functions-guldrush-core.test.mjs
// (kärnan mot Firestore-emulatorn) + functions-guldrush.test.mjs (callables).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listFormats, getFormat, answerKindsFor } from "../src/live/formats/index.js";
import { validateFormat } from "../src/live/live-formats.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { buildSessionDoc, validateSessionInput } from "../src/live/live-core.js";
import { fieldsFor } from "../src/live/live-setup-fields.js";
import { seededRng } from "../src/mult/generator.js";
import { buildQuizSnapshot } from "../src/live/modes/plugga-quiz-core.js";
import {
  GR_DURATIONS_MIN, buildQuizPool, computeStandings, buildResult, createEventCursor, rankByGold,
} from "../src/live/formats/guldrush/guldrush-core.js";
import { GR_CHESTS, GR_RULES } from "../src/live/formats/guldrush/delat/chests-config.js";
import {
  chestTable, rollChest, applySelfEffect, victimProblem, eligibleVictims, resolveVictim, eventText,
  chestById, isVictimKind,
} from "../src/live/formats/guldrush/delat/guldrush-regler.js";

const GR = getFormat("guldrush");
const MULT = requireGameMode("multiplication_0_10");
const QUIZ = requireGameMode("plugga_quiz");

const input = (over = {}) => ({
  name: "Guldrushen 4B", format: "guldrush", gameMode: "multiplication_0_10", answerKind: "free",
  classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10, stealSwap: true, showNames: true, ...over,
});

describe("Guldrushen: formatet", () => {
  it("registrerat: inom-klass, 1–3 klasser, pacing tid, free+choice, giltigt interface", () => {
    assert.ok(listFormats().some((f) => f.id === "guldrush"));
    assert.deepEqual(validateFormat(GR), []);
    assert.equal(GR.scope, "inom-klass");
    assert.deepEqual([GR.minClasses, GR.maxClasses], [1, 3]);
    assert.equal(GR.pacing, "tid");
    assert.deepEqual(GR.answerKinds, ["free", "choice"]);
  });

  it("spellägen: multiplikation (free+choice) och quiz (bara flerval)", () => {
    assert.ok(GR.compatibleGameModes(MULT));
    assert.ok(GR.compatibleGameModes(QUIZ));
    assert.deepEqual(answerKindsFor(GR, MULT), ["free", "choice"]);
    assert.deepEqual(answerKindsFor(GR, QUIZ), ["choice"]);
    assert.equal(GR.compatibleGameModes({ id: "okant", answerKinds: ["free"] }), false);
  });

  it("inställningar: speltid 5/10/15/20, stöld & byte + namn på som standard, Pluggmynt-fältet", () => {
    const keys = fieldsFor(GR).map((f) => f.key);
    assert.deepEqual(keys, ["durationMin", "stealSwap", "showNames", "rewards"], "kärnan lägger inte till en egen matchlängd");
    const dur = GR.setupFields.find((f) => f.key === "durationMin");
    assert.deepEqual(dur.options.map((o) => o.value), GR_DURATIONS_MIN);
    assert.equal(GR.setupFields.find((f) => f.key === "stealSwap").default, true);
    assert.equal(GR.setupFields.find((f) => f.key === "showNames").default, true);
    assert.equal(GR.setupFields.find((f) => f.key === "rewards").kind, "custom");
  });

  it("validering: giltigt formulär ok, 25 min / 4 klasser / fel Pluggmynt nekas", () => {
    assert.deepEqual(validateSessionInput(input()), []);
    assert.ok(validateSessionInput(input({ durationMin: 25 })).some((e) => /speltid/i.test(e)));
    assert.ok(validateSessionInput(input({ classIds: ["a", "b", "c", "d"] })).some((e) => /Högst 3/.test(e)));
    assert.ok(validateSessionInput(input({ rewards: { firstPrize: 5000, perCorrect: 1, cap: 10 } })).length > 0);
  });

  it("sessionsdokumentet: format, durationSeconds, stealSwap/showNames, rewards", () => {
    const d = buildSessionDoc(input({ stealSwap: false, rewards: { firstPrize: "300", perCorrect: "2", cap: "200" } }), { uid: "l1" });
    assert.equal(d.format, "guldrush");
    assert.equal(d.durationSeconds, 600);
    assert.equal(d.stealSwap, false);
    assert.equal(d.showNames, true);
    assert.deepEqual(d.rewards, { firstPrize: 300, perCorrect: 2, cap: 200 });
    assert.equal(d.status, "lobby");
    assert.ok(!("classDivisors" in d) && !("counterShards" in d), "inga Klassmatchen-fält");
  });

  it("prepareCreate: multiplikation inget att kopiera; quiz → grPublic utan facit + grPrivate med facit", async () => {
    const plain = await GR.prepareCreate(input(), buildSessionDoc(input(), { uid: "l1" }));
    assert.deepEqual(plain, { data: {}, subdocs: [] });
    const quiz = [
      { question: "Huvudstad i Sverige?", options: ["Oslo", "Stockholm", "Köpenhamn"], answerIndex: 1 },
      { question: "2+2?", options: ["3", "4", "5", "6"], answerIndex: 1 },
      { question: "Läs texten", passage: "lång text", options: ["a", "b"], answerIndex: 0 },
    ];
    const qi = input({ gameMode: "plugga_quiz", answerKind: "choice", quizArea: { subjectId: "so", areaId: "x", usable: 2 } });
    const data = buildSessionDoc(qi, { uid: "l1" });
    const out = await GR.prepareCreate(qi, data, { rng: seededRng(3), getArea: async () => ({ quiz }) });
    assert.equal(out.data.questionCount, 2, "passagefrågan hoppas över");
    const [pub, priv] = out.subdocs;
    assert.deepEqual(pub.path, ["grPublic", "questions"]);
    assert.deepEqual(priv.path, ["grPrivate", "snapshot"]);
    for (const q of pub.data.questions) {
      assert.ok(!("answerIndex" in q) && !("explanation" in q), "inget facit i det elevsynliga");
      assert.ok(Array.isArray(q.statKeys));
    }
    pub.data.questions.forEach((q, i) => {
      const right = q.text.startsWith("Huvudstad") ? "Stockholm" : "4";
      assert.equal(q.options[priv.data.facit[i].answerIndex], right);
    });
  });

  it("buildQuizPool tar högst 100 frågor", () => {
    const quiz = Array.from({ length: 130 }, (_, i) => ({ question: `F${i}?`, options: [`a${i}`, `b${i}`], answerIndex: 0 }));
    const p = buildQuizPool(QUIZ, quiz, buildQuizSnapshot, seededRng(1));
    assert.equal(p.questions.length, 100);
    assert.equal(p.facit.length, 100);
  });
});

describe("Guldrushen: kisttabellen (EN konfig)", () => {
  it("varje kista har id, effekt, vikt och visuella nycklar; alla typerna från specen finns", () => {
    const ids = new Set();
    for (const c of GR_CHESTS) {
      assert.ok(c.id && !ids.has(c.id), `unikt id ${c.id}`);
      ids.add(c.id);
      assert.ok(c.weight > 0 && c.effect?.kind, c.id);
      for (const k of ["icon", "label", "look", "sound", "eventText"]) assert.ok(c[k], `${c.id}.${k}`);
    }
    const kinds = GR_CHESTS.map((c) => `${c.effect.kind}${c.effect.amount ?? ""}`).sort();
    assert.deepEqual(kinds, ["double", "empty", "gold10", "gold100", "gold25", "gold50", "lose", "shield", "steal", "swap"]);
    assert.equal(chestById("dubbla").effect.cap, 150);
    assert.equal(chestById("stold").effect.share, 0.15);
    assert.equal(chestById("hal_i_fickan").effect.share, 0.1);
    for (const c of GR_CHESTS.filter(isVictimKind)) assert.equal(chestById(c.fallback).effect.kind, "gold");
  });

  it("test 18: stöld & byte av → kan aldrig komma, vikten går till guldkistorna", () => {
    const off = chestTable(false);
    assert.ok(off.every((r) => !isVictimKind(r.chest)));
    const sum = (rows) => rows.reduce((n, r) => n + r.weight, 0);
    assert.ok(Math.abs(sum(off) - sum(chestTable(true))) < 1e-9, "samma totalvikt");
    const gold = (rows) => sum(rows.filter((r) => r.chest.effect.kind === "gold"));
    const moved = sum(chestTable(true).filter((r) => isVictimKind(r.chest)));
    assert.ok(Math.abs(gold(off) - gold(chestTable(true)) - moved) < 1e-9);
    // Hela slumpintervallet: inga stöld-/bytekistor.
    for (let i = 0; i < 1000; i++) assert.ok(!isVictimKind(rollChest(false, () => i / 1000)));
    const on = new Set();
    for (let i = 0; i < 1000; i++) on.add(rollChest(true, () => i / 1000).id);
    assert.equal(on.size, GR_CHESTS.length, "med stöld på kan alla kistor komma");
  });

  it("effekterna nollställer aldrig: dubbla max +150, hål 10 %, guld lägger till", () => {
    assert.deepEqual(applySelfEffect(chestById("dubbla"), 40), { delta: 40, gold: 80, shield: false });
    assert.equal(applySelfEffect(chestById("dubbla"), 400).delta, 150);
    assert.deepEqual(applySelfEffect(chestById("hal_i_fickan"), 95), { delta: -9, gold: 86, shield: false });
    assert.equal(applySelfEffect(chestById("hal_i_fickan"), 5).gold, 5, "under 10 guld tappar man inget");
    assert.equal(applySelfEffect(chestById("skattkammare"), 0).gold, 100);
    assert.equal(applySelfEffect(chestById("tom"), 7).gold, 7);
    assert.equal(applySelfEffect(chestById("skold"), 7).shield, true);
    assert.equal(applySelfEffect(chestById("guld"), GR_RULES.maxGold).gold, GR_RULES.maxGold);
  });
});

describe("Guldrushen: trygghetsreglerna (§6.5)", () => {
  const now = 1_000_000;
  const p = (uid, gold, extra = {}) => ({ uid, name: uid, gold, ...extra });

  it("test 15: Alma 100 → 85, Omar +15", () => {
    const r = resolveVictim("steal", p("omar", 0), p("alma", 100));
    assert.deepEqual(r, { blocked: false, amount: 15, thiefGold: 15, victimGold: 85 });
  });

  it("test 16: stöldskydd 30 s efter bestulen, inte samma offer två gånger i rad", () => {
    const alma = p("alma", 85, { protectedUntil: now + GR_RULES.protectionMs });
    assert.equal(victimProblem("steal", p("leo", 10), alma, now), "skyddad");
    assert.equal(victimProblem("steal", p("leo", 10), alma, now + GR_RULES.protectionMs), null, "skyddet går ut");
    assert.equal(victimProblem("steal", p("omar", 15, { lastVictimUid: "alma" }), p("alma", 85), now), "samma-igen");
    assert.equal(victimProblem("steal", p("omar", 15), p("omar", 15), now), "sig-sjalv");
    assert.equal(victimProblem("steal", p("omar", 15), null, now), "saknas");
    assert.equal(victimProblem("steal", p("omar", 15), p("bo", 6), now), "for-lite-guld");
  });

  it("test 17: byte bara med någon som har MER guld (och bara med eget guld)", () => {
    const ines = p("ines", 20);
    assert.equal(victimProblem("swap", ines, p("bo", 10), now), "inte-mer-guld");
    assert.equal(victimProblem("swap", ines, p("bo", 20), now), "inte-mer-guld");
    assert.equal(victimProblem("swap", ines, p("alma", 90), now), null);
    assert.equal(victimProblem("swap", p("ines", 0), p("alma", 90), now), "inget-eget-guld");
    assert.deepEqual(resolveVictim("swap", ines, p("alma", 90)), { blocked: false, amount: 70, thiefGold: 90, victimGold: 20 });
    const list = eligibleVictims("swap", ines, [p("ines", 20), p("bo", 10), p("alma", 90), p("cia", 50, { protectedUntil: now + 1 })], now);
    assert.deepEqual(list.map((x) => x.uid), ["alma"]);
  });

  it("sköld stoppar nästa stöld/byte; slumpat val tar aldrig någon med sköld", () => {
    const leo = p("leo", 100, { shield: true });
    assert.deepEqual(resolveVictim("steal", p("omar", 5), leo), { blocked: true, amount: 0, thiefGold: 5, victimGold: 100 });
    assert.equal(victimProblem("steal", p("omar", 5), leo, now), null, "manuellt val går – skölden tar smällen");
    assert.deepEqual(eligibleVictims("steal", p("omar", 5), [leo, p("alma", 50)], now, { random: true }).map((x) => x.uid), ["alma"]);
  });

  it("händelsetexten: lekfull, och utan namn när läraren slagit av namnen", () => {
    const ev = { type: "steal", chest: "stold", name: "Alma", victimName: "Omar", amount: 30 };
    assert.equal(eventText(ev), "🦝 Alma knyckte 30 guld från Omar!");
    assert.equal(eventText(ev, { names: false }), "🦝 Någon knyckte 30 guld från en klasskamrat!");
    assert.equal(eventText({ type: "chest", chest: "skattkammare", name: "Elias", amount: 100 }), "👑 SKATTKAMMARE! Elias hittade 100 guld!");
    assert.equal(eventText({ type: "swap", chest: "byte", name: "Hussein", victimName: "Ines" }), "🔄 Hussein och Ines bytte guld!");
    assert.equal(eventText({ type: "lead", name: "Leo" }), "⭐ Leo tog ledningen!");
  });
});

describe("Guldrushen: ställning, resultat, händelsemarkör", () => {
  const s = { participatingClassIds: ["4b", "5e"], classNames: { "4b": "4B", "5e": "5E" }, rewards: { firstPrize: 100, perCorrect: 1, cap: 50 } };
  const players = [
    { uid: "alma", name: "Alma", classId: "4b" }, { uid: "omar", name: "Omar", classId: "4b" },
    { uid: "eva", name: "Eva", classId: "5e" }, { uid: "sen", name: "Sen", classId: "5e" },
  ];
  const gr = [
    { uid: "alma", gold: 85, correct: 6, incorrect: 1 }, { uid: "omar", gold: 85, correct: 5, incorrect: 0 },
    { uid: "eva", gold: 40, correct: 3, incorrect: 2 },
  ];

  it("delad placering på guld, sen anslutning = 0 guld, klassens totala guld", () => {
    const st = computeStandings(s, { players, grPlayers: gr });
    assert.deepEqual(st.players.map((p) => [p.uid, p.gold, p.rank]), [["alma", 85, 1], ["omar", 85, 1], ["eva", 40, 3], ["sen", 0, 4]]);
    assert.equal(st.draw, true);
    assert.equal(st.winnerId, null);
    assert.equal(st.totalGold, 210);
    assert.deepEqual(st.classes.map((c) => [c.classId, c.gold, c.joined]), [["4b", 170, 2], ["5e", 40, 2]]);
    assert.deepEqual(rankByGold([{ uid: "a", gold: 3 }, { uid: "b", gold: 3 }, { uid: "c", gold: 1 }]).map((p) => p.rank), [1, 1, 3]);
  });

  it("buildResult: ranking, totalGold, classGold, Pluggmynt bara för de som svarat", () => {
    const res = buildResult(s, null, players, null, { grPlayers: gr });
    assert.equal(res.format, "guldrush");
    assert.equal(res.winner, null);
    assert.equal(res.totalGold, 210);
    assert.deepEqual(res.classGold, { "4b": 170, "5e": 40 });
    assert.equal(res.ranking[0].answered, 7);
    assert.deepEqual(Object.keys(res.rewards).sort(), ["alma", "eva", "omar"]);
    assert.equal(res.rewards.alma.prize, res.rewards.omar.prize, "delad etta – samma pris");
    assert.equal(res.rewards.alma.rank, 1);
  });

  it("händelsemarkören: första läsningen är baslinje (inget spelas upp efter omladdning)", () => {
    const c = createEventCursor();
    const e = (id, at) => ({ id, at, type: "chest" });
    assert.deepEqual(c.take([e("b", 2), e("a", 1)]), []);
    assert.deepEqual(c.take([e("c", 4), e("d", 3), e("b", 2)]).map((x) => x.id), ["d", "c"], "nya, äldst först");
    assert.deepEqual(c.take([e("c", 4)]), []);
  });
});
