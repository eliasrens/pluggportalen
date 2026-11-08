// ============================================================================
// Meteorstormens quiz på servern (#821) mot Firestore-EMULATORN: kortleken
// (fragaFor), msRatta rättar utan att skriva och bara en gång per k, msAgera
// kräver rätt fråga och växande k, fel svar i bufferten markerar k som fel.
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { agera, ratta, avsluta } from "../functions/meteorstorm-core.js";
import { fragaFor } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";
import { ctl, deps, T0, END, makeQuiz, events, msPlayer, att, code, FACIT } from "./helpers/meteorstorm-core-rig.js";

const SEED = 4711;
const q = (uid, k) => fragaFor(SEED, uid, k, 4);
const ratt = (uid, k) => ({ k, q: q(uid, k), choiceIndex: FACIT[q(uid, k)].answerIndex });
const fel = (uid, k) => ({ k, q: q(uid, k), choiceIndex: (FACIT[q(uid, k)].answerIndex + 1) % 4 });

beforeEach(() => { ctl.clock = T0 + 60_000; });

describe("Meteorstormen quiz: msRatta", () => {
  it("rättar utan att skriva; nästa fråga ur kortleken", async () => {
    const sid = await makeQuiz();
    const d = deps();
    const r = await ratta(d, "alma", { sid, svar: ratt("alma", 0) });
    assert.equal(r.correct, true);
    assert.equal(r.nastaQ, q("alma", 1));
    const f = await ratta(d, "alma", { sid, svar: fel("alma", 1) });
    assert.equal(f.correct, false);
    assert.equal(f.correctAnswer, "abcd"[FACIT[q("alma", 1)].answerIndex]);
    assert.equal((await events(sid)).length, 0);
  });

  it("samma k kan inte prövas igen med ett annat alternativ", async () => {
    const sid = await makeQuiz();
    const d = deps();
    assert.equal((await ratta(d, "alma", { sid, svar: fel("alma", 0) })).correct, false);
    assert.equal((await ratta(d, "alma", { sid, svar: ratt("alma", 0) })).correct, false);
    const r = await agera(d, "alma", { sid, attemptId: att(), svar: ratt("alma", 0), typ: "skold" });
    assert.equal(r.correct, false, "k=0 är redan rättat fel");
    assert.equal((await events(sid)).length, 0);
  });

  it("fel fråga för k nekas; multiplikation har ingen msRatta", async () => {
    const sid = await makeQuiz();
    const annan = (q("alma", 0) + 1) % 4;
    assert.equal(await code(ratta(deps(), "alma", { sid, svar: { k: 0, q: annan, choiceIndex: 0 } })), "failed-precondition");
    assert.equal(await code(ratta(deps(), "alma", { sid, svar: { k: -1, q: 0, choiceIndex: 0 } })), "invalid-argument");
  });
});

describe("Meteorstormen quiz: msAgera", () => {
  it("rätt svar + handling; k måste växa; buffrade fel markerar sina k", async () => {
    const sid = await makeQuiz();
    const d = deps();
    const r = await agera(d, "alma", { sid, attemptId: att(), svar: ratt("alma", 0), typ: "laser", fel: [] });
    assert.equal(r.typ, "laser");
    assert.equal(r.k, 0);
    ctl.clock += 2000;
    assert.equal(await code(agera(d, "alma", { sid, attemptId: att(), svar: ratt("alma", 0), typ: "laser" })), "failed-precondition");
    const r2 = await agera(d, "alma", { sid, attemptId: att(), svar: ratt("alma", 3), typ: "skold", fel: [fel("alma", 1), fel("alma", 2)] });
    assert.equal(r2.k, 3);
    const h = (await events(sid)).find((e) => e.nr === 2);
    assert.equal(h.fel.length, 2);
    assert.deepEqual(h.svar.k, 3);
    ctl.clock += 2000;
    // k=1 fanns i bufferten som fel – går inte att ta tillbaka som rätt.
    assert.equal((await agera(d, "alma", { sid, attemptId: att(), svar: ratt("alma", 1), typ: "skold" })).correct, false);
    assert.equal((await events(sid)).length, 2);
  });

  it("msAvsluta: andel rätt per fråga ur svaren + felbufferten", async () => {
    const sid = await makeQuiz();
    const d = deps();
    await agera(d, "alma", { sid, attemptId: att(), svar: ratt("alma", 0), typ: "laser" });
    ctl.clock += 2000;
    await agera(d, "omar", { sid, attemptId: att(), svar: ratt("omar", 0), typ: "skold", fel: [] });
    ctl.clock = END + 1000;
    await agera(d, "omar", { sid, fel: [fel("omar", 1)] });
    ctl.clock = END + 5000;
    const { result } = await avsluta(deps(), { uid: "x", teacher: true }, { sid });
    assert.equal(result.totalCorrect, 2);
    assert.equal(result.totalAnswered, 3);
    const svarade = result.perQuestion.reduce((n, r) => n + r.answered, 0);
    assert.equal(svarade, 3);
    assert.ok(result.perQuestion.every((r) => r.text.startsWith("Fråga")));
    assert.equal((await msPlayer(sid, "omar")).incorrect, 1);
  });
});
