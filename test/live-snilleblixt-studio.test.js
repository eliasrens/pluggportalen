// ============================================================================
// Enhetstester: Snilleblixtens TV-studio (#559) – scenlogiken (sb-scen.js):
// scener ur q-fas + servertid, frågans nedräkning (spänning sista 5 s),
// avslöjandets siffror (test 7b: "54 (5 st) · 64 (3 st)"), klassens anonyma
// andel rätt (ingen uthängning, Elias 2026-10-10), pallsteg med delad
// placering (test 12 / designtest 9), publikens rutnät
// (designtest 4), lärarautomatiken (test 9: alla svarat → stäng) och
// kopplingen: två lärarfönster trycker NÄSTA FRÅGA samtidigt → exakt ett
// steg (test 10). DOM-delarna provas i preview/preview-snilleblixt-studio.html.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  studioScene, questionClock, revealInfo, classSummary, podiumGroups, audienceLayout, choreFor, controlsFor,
  createResultatRitare,
  SB_DRUM_MS, SB_REVEAL_HOLD_MS, SB_OPEN_DELAY_MS,
} from "../src/live/formats/snilleblixt/sb-scen.js";
import { scoreQuestion, computeStandings } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import { planStep } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";
import { createSbKoppling } from "../src/live/formats/snilleblixt/sb-koppling.js";
import { requireFormat } from "../src/live/formats/index.js";

const T = 1_800_000_000_000;
const sess = (over = {}) => ({
  id: "s1", format: "snilleblixt", status: "live", answerKind: "choice", questionSeconds: 20, questionCount: 10,
  countdownSeconds: 4, startedAt: T, participatingClassIds: ["4b"], classNames: { "4b": "4B" }, ...over,
});
const st = (s, phase = "live") => ({ session: s, phase, players: [] });

describe("Snilleblixten-studion: scener", () => {
  it("lobby → intro → fraga → stangd → svar → mellan (ingen topplista) → final", () => {
    assert.equal(studioScene(st(sess({ status: "lobby" }), "lobby"), { now: T }), "lobby");
    assert.equal(studioScene(st(sess(), "countdown"), { now: T }), "intro");
    assert.equal(studioScene(st(sess()), { now: T + 5000 }), "intro");
    const q = { index: 3, phase: "open", openedAt: T + 10_000 };
    assert.equal(studioScene(st(sess({ q })), { now: T + 11_000 }), "fraga");
    assert.equal(studioScene(st(sess({ q: { ...q, phase: "closed", closedAt: T + 20_000 } })), { now: T + 20_500 }), "stangd");
    const rev = { ...q, phase: "revealed", closedAt: T + 20_000 };
    // Sett live: avslöjandet visas SB_REVEAL_HOLD_MS från när fönstret såg det.
    assert.equal(studioScene(st(sess({ q: rev })), { now: T + 30_000, revealSeenAt: T + 29_000 }), "svar");
    assert.equal(studioScene(st(sess({ q: rev })), { now: T + 29_000 + SB_REVEAL_HOLD_MS, revealSeenAt: T + 29_000 }), "mellan");
    // Omladdning: räknas ur closedAt + trumvirveln.
    assert.equal(studioScene(st(sess({ q: rev })), { now: T + 20_000 + SB_DRUM_MS + 100 }), "svar");
    assert.equal(studioScene(st(sess({ q: rev })), { now: T + 60_000 }), "mellan");
    assert.equal(studioScene(st(sess({ q: { ...q, phase: "skipped", closedAt: T + 12_000 } })), { now: T + 12_500 }), "hoppad");
    assert.equal(studioScene(st(sess({ status: "finished" }), "finished"), { now: T }), "final");
  });

  it("nedräkningen ur openedAt + frågetid: spänning de sista 5 s, 0 efter tiden", () => {
    const s = sess({ q: { index: 0, phase: "open", openedAt: T } });
    assert.deepEqual(questionClock(s, T + 5_000), { msLeft: 15_000, secs: 15, frac: 0.75, tension: false });
    assert.equal(questionClock(s, T + 15_200).tension, true);
    assert.equal(questionClock(s, T + 15_200).secs, 5);
    assert.equal(questionClock(s, T + 25_000).msLeft, 0);
    assert.equal(questionClock(s, T + 25_000).tension, false);
    assert.equal(questionClock(sess(), T), null);
  });
});

describe("Snilleblixten-studion: avslöjandet", () => {
  it("test 7b – skriv själv 7 × 8: 56 rätt, andel rätt, '54 (5 st) · 64 (3 st)' utan namn", () => {
    const q = { index: 0, phase: "closed", openedAt: T, closedAt: T + 10_000, facit: { correctAnswer: "56" } };
    const answers = Array.from({ length: 24 }, (_, i) => ({
      uid: `e${i}`, q: 0, at: T + 1000 + i * 100, answer: i < 5 ? "54" : i < 8 ? "64" : "56",
    }));
    const score = scoreQuestion({ q, facit: q.facit, answers, questionSeconds: 20, answerKind: "free" });
    const info = revealInfo(q, score, "free");
    assert.equal(info.correctText, "56");
    assert.equal(info.correct, 16);
    assert.equal(info.answered, 24);
    assert.equal(info.share, 67);
    assert.deepEqual(info.topWrong, [{ answer: "54", n: 5 }, { answer: "64", n: 3 }]);
    assert.ok(!JSON.stringify(info).includes("e0"), "inga namn/uid i avslöjandet");
  });

  it("flerval: rätt index, staplar per alternativ, max ≥ 1; utan poäng än → nollor men facit", () => {
    const q = { index: 1, question: { options: ["1", "2", "3", "4"] }, facit: { answerIndex: 2 } };
    const info = revealInfo(q, { answered: 9, correctCount: 5, choiceCounts: [1, 3, 5, 0] }, "choice");
    assert.deepEqual([info.correctIndex, info.counts, info.max, info.share], [2, [1, 3, 5, 0], 5, 56]);
    const empty = revealInfo(q, null, "choice");
    assert.deepEqual([empty.correctIndex, empty.counts, empty.ready], [2, [0, 0, 0, 0], false]);
  });

  it("klassens andel rätt per fråga och totalt – anonymt (inga uid/namn), överhoppad räknas inte", () => {
    const sum = classSummary([
      { index: 1, answered: 20, correctCount: 15, points: { a: 900 }, correct: { a: true } },
      { index: 0, answered: 10, correctCount: 5, points: { b: 800 }, correct: { b: true } },
      { index: 2, skipped: true, answered: 4, correctCount: 0, points: {}, correct: {} },
    ]);
    assert.deepEqual(sum.perQuestion.map((x) => [x.index, x.share, x.skipped]), [[0, 50, false], [1, 75, false], [2, 0, true]]);
    assert.deepEqual([sum.answered, sum.correct, sum.share], [30, 20, 67]);
    const json = JSON.stringify(sum);
    assert.ok(!/"a"|"b"|points|900/.test(json), "inget per elev i statistiken");
  });
});

describe("Snilleblixten-studion: pallen och publiken", () => {
  it("test 12 / designtest 9 – delad placering står på samma pallsteg, bara poäng > 0", () => {
    const ranking = [
      { uid: "a", points: 900, rank: 1 }, { uid: "b", points: 800, rank: 2 }, { uid: "c", points: 800, rank: 2 },
      { uid: "d", points: 700, rank: 4 }, { uid: "e", points: 0, rank: 5 },
    ];
    const g = podiumGroups(ranking);
    assert.deepEqual(g.map((x) => [x.rank, x.players.map((p) => p.uid)]), [[1, ["a"]], [2, ["b", "c"]]]);
    const tie1 = podiumGroups([{ uid: "a", points: 5, rank: 1 }, { uid: "b", points: 5, rank: 1 }, { uid: "c", points: 4, rank: 3 }]);
    assert.deepEqual(tie1.map((x) => [x.rank, x.players.length]), [[1, 2], [3, 1]]);
    assert.deepEqual(podiumGroups([{ uid: "a", points: 0, rank: 1 }]), []);
  });

  it("designtest 4 – 30 elever = två rader à 15, 60 = tre rader och mindre figurer", () => {
    assert.deepEqual(audienceLayout(10), { rows: 1, perRow: 10, scale: 1.25 });
    assert.deepEqual(audienceLayout(30), { rows: 2, perRow: 15, scale: 1 });
    const big = audienceLayout(60);
    assert.equal(big.rows, 3);
    assert.ok(big.scale < 1 && big.scale >= 0.55);
  });
});

describe("Snilleblixten-studion: lärarautomatik och knappar", () => {
  it("första frågan öppnas efter KÖR!; stäng vid alla svarat (test 9) eller tid; avslöja efter trumvirveln", () => {
    const t0 = T + 4000;
    assert.equal(choreFor(sess(), { phase: "live", now: t0 }), null);
    assert.deepEqual(choreFor(sess(), { phase: "live", now: t0 + SB_OPEN_DELAY_MS }), { action: "open", fromIndex: -1 });
    assert.equal(choreFor(sess(), { phase: "countdown", now: t0 }), null);
    const open = sess({ q: { index: 0, phase: "open", openedAt: t0 + 1000 } });
    assert.equal(choreFor(open, { phase: "live", now: t0 + 5000, progress: { all: false } }), null);
    assert.deepEqual(choreFor(open, { phase: "live", now: t0 + 5000, progress: { all: true } }), { action: "close", fromIndex: 0, reason: "alla" });
    assert.equal(choreFor(open, { phase: "live", now: t0 + 21_000 }).reason, "tid");
    const closed = sess({ q: { index: 0, phase: "closed", openedAt: t0, closedAt: t0 + 6000 } });
    assert.equal(choreFor(closed, { phase: "live", now: t0 + 6500 }), null);
    assert.deepEqual(choreFor(closed, { phase: "live", now: t0 + 6000 + SB_DRUM_MS }), { action: "reveal", fromIndex: 0 });
    assert.equal(choreFor(sess({ status: "finished" }), { phase: "finished", now: t0 }), null);
  });

  it("knapparna: NÄSTA FRÅGA efter avslöjandet, sista frågan → till pallen", () => {
    assert.deepEqual(controlsFor(sess({ q: { index: 2, phase: "open" } })), { next: null, closeNow: true, skip: true, end: true, index: 2 });
    assert.equal(controlsFor(sess({ q: { index: 2, phase: "revealed" } })).next, "open");
    assert.equal(controlsFor(sess({ q: { index: 9, phase: "skipped" } })).next, "finish");
    assert.equal(controlsFor(sess({ q: { index: 2, phase: "closed" } })).skip, true);
    assert.equal(controlsFor(sess({ status: "finished" })).end, false);
  });

  it("test 10 – två lärarfönster trycker NÄSTA FRÅGA samtidigt → exakt ett steg", async () => {
    let shared = sess({ q: { index: 3, phase: "revealed" } });
    const snapshot = { questions: Array.from({ length: 10 }, (_, i) => ({ key: `q${i}`, text: `${i}` })), facit: [] };
    const fv = { serverTimestamp: () => T + 99 };
    let steps = 0;
    // Samma semantik som snilleblixt-data.js: transaktion ur AKTUELLT läge.
    const api = {
      watchScores: () => () => {},
      watchQuestionAnswers: () => () => {},
      async openQuestion(_sid, fromIndex) {
        await new Promise((r) => setTimeout(r, 5));
        const plan = planStep(shared, "open", { fromIndex, snapshot, fv });
        if (plan.noop) return { done: false, reason: plan.noop };
        steps++;
        shared = { ...shared, ...plan.patch };
        return { done: true };
      },
    };
    const mk = () => createSbKoppling({ sid: "s1", st: st(shared), deps: { snilleblixt: api, now: () => T }, actions: {} });
    const a = mk();
    const b = mk();
    await Promise.all([a.next(), b.next()]);
    a.destroy();
    b.destroy();
    assert.equal(steps, 1);
    assert.equal(shared.q.index, 4);
  });
});

describe("Snilleblixten-studion: formatet", () => {
  it("projektorvyerna laddas latt, egna kontroller, Studion + Statistik (inga Klassmatchen-vyer)", async () => {
    const f = requireFormat("snilleblixt");
    assert.equal(typeof f.projectorViews, "function");
    assert.equal(f.emitOnPlayers, true);
    const standings = computeStandings(sess(), { scores: [], players: [{ uid: "a", name: "A", classId: "4b" }] });
    assert.equal(standings.players.length, 1);
  });
});

describe("Snilleblixten-studion: omladdning efter/mitt i finalen (#561 F1, designtest 10)", () => {
  const players = [{ uid: "a", name: "Alma", classId: "4b" }, { uid: "b", name: "Bo", classId: "4b" }, { uid: "c", name: "Cia", classId: "4b" }];
  const scores = [{ index: 0, skipped: false, answered: 3, correctCount: 3, points: { a: 900, b: 800, c: 700 }, correct: { a: true, b: true, c: true } }];
  const data = (sc) => {
    const st = computeStandings(sess(), { scores: sc, players });
    return { groups: podiumGroups(st.players), sub: classSummary(sc).answered ? "klassrad" : "", prize: () => 0 };
  };

  it("tomma sbScores vid första ritningen → pallen ritas om när poängen kommer, sedan inte igen", () => {
    const shown = [];
    const rita = createResultatRitare((d) => shown.push(d));
    assert.equal(rita(data([])), true); // omladdning: poängen inte framme än
    assert.equal(shown[0].groups.length, 0);
    assert.equal(rita(data([])), false); // samma underlag – ingen omritning
    assert.equal(rita(data(scores)), true); // poängen kom → pallen fylls
    assert.deepEqual(shown[1].groups.map((g) => [g.rank, g.players[0].name]), [[1, "Alma"], [2, "Bo"], [3, "Cia"]]);
    assert.equal(shown[1].sub, "klassrad");
    assert.equal(rita(data(scores)), false);
    assert.equal(shown.length, 2);
  });

  it("priset (result.rewards kommer efter slutet) ritar också om", () => {
    let n = 0;
    const rita = createResultatRitare(() => n++);
    rita({ ...data(scores), prize: () => 0 });
    rita({ ...data(scores), prize: (r) => [0, 100, 85, 72][r] });
    assert.equal(n, 2);
  });

  it("kopplingens scoresReady löses vid första poäng-snapshoten", async () => {
    let cb = null;
    const api = { watchScores: (_s, f) => { cb = f; return () => {}; }, watchQuestionAnswers: () => () => {} };
    const k = createSbKoppling({ sid: "s1", st: st(sess({ status: "finished" }), "finished"), deps: { snilleblixt: api, now: () => T } });
    let ready = false;
    k.scoresReady.then(() => { ready = true; });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(ready, false);
    cb(scores);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(ready, true);
    assert.equal(k.scores.length, 1);
    k.destroy();
  });
});
