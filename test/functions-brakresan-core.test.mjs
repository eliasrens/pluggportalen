// ============================================================================
// Bråkresan (#708): SERVERKÄRNAN – omgångar och bedömning
// (functions/brakresan-core.js) direkt mot Firestore-emulatorn. Belöningarna
// (stjärnor, mynt, drake) testas i functions-brakresan-avslut.test.mjs, hela
// callable-lagret (inloggning, lärare, regler) i functions-brakresan.test.mjs.
//
//   start: tio uppgifter utan facit, facit bara i brakresaSecrets
//   återupptagning: samma tio uppgifter och låsta svar; restart/replaceRoundId
//   första giltiga svaret låst; inmatningsfel sparas inte; hjälp före svar
//   bearbetning efter fel ändrar aldrig poängen; ≤ 5 försök; attemptId idempotent
//   avbruten omgång: ingen belöning, svaren finns kvar i statistiken
//   gammal aktiv omgång rättas med SINA uppgifter efter en generatorändring
//   nästa omgång undviker kärnorna från de senaste avslutade
//
// Egna uid:n (brk-*) – krockar inte med andra tester. `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import {
  startRound, answerTask, reworkTask, abortRound, finishRound, BrFel, MAX_REWORK,
} from "../functions/brakresan-core.js";
import { createBrRig } from "./helpers/brakresan-server-rig.js";
import { fixtureDef } from "./helpers/brakresan-fixtur.js";

const rig = createBrRig("br-core");
const { deps, db } = rig;
after(() => rig.app.delete());

const U = "brk-ella";
const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof BrFel, `BrFel väntades, fick ${e?.stack || e}`);
    return e.code;
  }
  return "ok";
};

beforeEach(async () => {
  await rig.rensa("brk-");
  rig.ctl.challenges = {};
  rig.useChallenge("03");
  await db.doc(`studentData/${U}`).set({ coins: 100 });
});

describe("starta och återuppta", () => {
  it("tio offentliga uppgifter utan facit; facit bara i brakresaSecrets", async () => {
    const res = await startRound(deps, U, { challengeId: "03" });
    assert.equal(res.resumed, false);
    assert.match(res.roundId, /^[A-Za-z0-9]{20}$/);
    assert.equal(res.round.tasks.length, 10);
    for (const t of res.round.tasks) {
      for (const k of ["key", "feedback", "review", "params", "core", "values", "misconceptions"]) assert.ok(!(k in t), k);
      assert.equal(t.id, `${res.roundId}-${t.index}`);
    }
    assert.equal(typeof res.round.startedAt, "number", "Timestamp → ms i callable-svaret");
    const lagrad = await rig.round(U, res.roundId);
    assert.equal(lagrad.status, "aktiv");
    assert.equal(lagrad.mode, "elev");
    assert.equal(lagrad.cores, null, "kärnorna kan avslöja facit – skrivs först vid avslut");
    const sec = (await db.doc(`brakresaSecrets/${res.roundId}`).get()).data();
    assert.equal(sec.studentId, U);
    assert.equal(sec.tasks.length, 10);
    assert.equal(new Set(sec.plan.map((p) => p.core)).size, 10, "tio olika kärnor");
    const st = await rig.state(U);
    assert.equal(st.challenges["03"].activeRoundId, res.roundId);
    assert.equal(st.totalStars, 0);
    assert.equal(st.dragon, null);
  });

  it("omladdning återupptar samma tio uppgifter och låsta svar", async () => {
    const a = await startRound(deps, U, { challengeId: "03" });
    await answerTask(deps, U, { roundId: a.roundId, index: 0, answer: await rig.svar(a.roundId, 0, false) });
    const b = await startRound(deps, U, { challengeId: "03" });
    assert.equal(b.resumed, true);
    assert.equal(b.roundId, a.roundId);
    assert.deepEqual(b.round.tasks, a.round.tasks);
    assert.equal(b.round.answers[0].first.correct, false);
    assert.equal(b.round.answeredCount, 1);
  });

  it("två flikar startar samtidigt → EN omgång", async () => {
    const [a, b] = await Promise.all([startRound(deps, U, { challengeId: "03" }), startRound(deps, U, { challengeId: "03" })]);
    assert.equal(a.roundId, b.roundId);
    const alla = await db.collection(`studentData/${U}/brakresaRounds`).get();
    assert.equal(alla.size, 1);
  });

  it("restart avbryter den gamla och skapar en ny; replaceRoundId skyddar mot dubbelklick", async () => {
    const a = await startRound(deps, U, { challengeId: "03" });
    const b = await startRound(deps, U, { challengeId: "03", restart: true, replaceRoundId: a.roundId });
    assert.notEqual(b.roundId, a.roundId);
    assert.equal(b.resumed, false);
    assert.equal((await rig.round(U, a.roundId)).status, "avbruten");
    // Andra klicket med samma replaceRoundId: den aktiva är redan b → återupptas.
    const c = await startRound(deps, U, { challengeId: "03", restart: true, replaceRoundId: a.roundId });
    assert.equal(c.roundId, b.roundId);
    assert.equal(c.resumed, true);
    const st = await rig.state(U);
    assert.equal(st.challenges["03"].roundsAborted, 1);
    assert.equal(st.totals.roundsAborted, 1);
  });

  it("stubbe → failed-precondition, okänt id → invalid-argument", async () => {
    assert.equal(await code(startRound(deps, U, { challengeId: "04" })), "failed-precondition");
    assert.equal(await code(startRound(deps, U, { challengeId: "51" })), "invalid-argument");
    assert.equal(await code(startRound(deps, U, {})), "invalid-argument");
    assert.equal(await code(startRound(deps, U, { challengeId: "03", restart: true, replaceRoundId: "../x" })), "invalid-argument");
  });

  it("nästa omgång undviker kärnorna från den senaste avslutade", async () => {
    const a = await startRound(deps, U, { challengeId: "03" });
    for (let i = 0; i < 10; i++) await answerTask(deps, U, { roundId: a.roundId, index: i, answer: await rig.svar(a.roundId, i) });
    await finishRound(deps, U, { roundId: a.roundId });
    const gamla = new Set((await rig.round(U, a.roundId)).cores);
    assert.equal(gamla.size, 10);
    const b = await startRound(deps, U, { challengeId: "03" });
    const nya = (await db.doc(`brakresaSecrets/${b.roundId}`).get()).data().plan.map((p) => p.core);
    assert.deepEqual(nya.filter((c) => gamla.has(c)), []);
  });
});

describe("första svaret och hjälpen", () => {
  it("inmatningsfel låser inte; första giltiga svaret är låst; omförsök svarar det sparade", async () => {
    const { roundId } = await startRound(deps, U, { challengeId: "03" });
    const tom = await answerTask(deps, U, { roundId, index: 2, answer: { selected: [] } });
    assert.equal(tom.status, "invalid");
    assert.equal(tom.error, "tom");
    assert.equal((await rig.round(U, roundId)).answers[2].first, null, "inmatningsfel sparas inte");
    const skrap = await answerTask(deps, U, { roundId, index: 2, answer: { selected: ["p99"] } });
    assert.equal(skrap.status, "invalid");
    const konstig = await answerTask(deps, U, { roundId, index: 2, answer: { selected: "p0" } });
    assert.equal(konstig.status, "invalid");

    const fel = await answerTask(deps, U, { roundId, index: 2, answer: await rig.svar(roundId, 2, false), helpBefore: ["princip", "skräp", "orientering"] });
    assert.equal(fel.status, "graded");
    assert.equal(fel.correct, false);
    assert.equal(fel.already, false);
    assert.ok(fel.reveal.display && fel.reveal.feedback.wrong && fel.reveal.review);
    const igen = await answerTask(deps, U, { roundId, index: 2, answer: await rig.svar(roundId, 2, true) });
    assert.equal(igen.correct, false, "ett rätt svar efteråt ändrar inte det låsta");
    assert.equal(igen.already, true);
    const r = await rig.round(U, roundId);
    assert.deepEqual(r.answers[2].helpBefore, ["orientering", "princip"]);
    assert.equal(r.answeredCount, 1);
    assert.equal(r.correctCount, 0);
    const st = (await rig.state(U)).challenges["03"];
    assert.deepEqual([st.firstCorrect, st.firstTotal, st.helpBefore, st.activeAnswered], [0, 1, 1, 1]);
  });

  it("dubbelklick på Kontrollera (samtidigt) bedöms en gång", async () => {
    const { roundId } = await startRound(deps, U, { challengeId: "03" });
    const ans = await rig.svar(roundId, 0, true);
    const [a, b] = await Promise.all([answerTask(deps, U, { roundId, index: 0, answer: ans }), answerTask(deps, U, { roundId, index: 0, answer: ans })]);
    assert.deepEqual([a.already, b.already].sort(), [false, true]);
    const st = await rig.state(U);
    assert.equal(st.totals.firstTotal, 1);
    assert.equal(st.totals.firstCorrect, 1);
  });

  it("ogiltiga anrop", async () => {
    const { roundId } = await startRound(deps, U, { challengeId: "03" });
    assert.equal(await code(answerTask(deps, U, { roundId, index: 10, answer: { selected: ["p0"] } })), "invalid-argument");
    assert.equal(await code(answerTask(deps, U, { roundId, index: 0 })), "invalid-argument");
    assert.equal(await code(answerTask(deps, U, { roundId, index: 0, answer: { x: [[1]] } })), "invalid-argument");
    assert.equal(await code(answerTask(deps, U, { roundId, index: 0, answer: { t: "x".repeat(5000) } })), "invalid-argument");
    assert.equal(await code(answerTask(deps, U, { roundId: "finnsinte0000", index: 0, answer: { selected: ["p0"] } })), "not-found");
    // En annan elev når aldrig omgången (den ligger under ägarens studentData).
    assert.equal(await code(answerTask(deps, "brk-annan", { roundId, index: 0, answer: { selected: ["p0"] } })), "not-found");
    assert.equal(await code(finishRound(deps, "brk-annan", { roundId })), "not-found");
    assert.equal(await code(abortRound(deps, "brk-annan", { roundId })), "not-found");
  });
});

describe("bearbetning efter fel", () => {
  it("bara efter fel, ändrar aldrig poängen, högst 5 sparas, attemptId idempotent, efterhjälp räknas en gång", async () => {
    const { roundId } = await startRound(deps, U, { challengeId: "03" });
    assert.equal(await code(reworkTask(deps, U, { roundId, index: 0, answer: { selected: ["p0"] } })), "failed-precondition");
    await answerTask(deps, U, { roundId, index: 0, answer: await rig.svar(roundId, 0, true) });
    assert.equal(await code(reworkTask(deps, U, { roundId, index: 0, answer: { selected: ["p0"] } })), "failed-precondition", "rätt svar har ingen bearbetning");

    await answerTask(deps, U, { roundId, index: 1, answer: await rig.svar(roundId, 1, false) });
    const h = await reworkTask(deps, U, { roundId, index: 1, helpAfter: ["princip"] });
    assert.equal(h.status, "ok");
    const ratt = await rig.svar(roundId, 1, true);
    const w1 = await reworkTask(deps, U, { roundId, index: 1, answer: ratt, helpAfter: ["orientering"], attemptId: "rw-1" });
    assert.equal(w1.correct, true);
    const w1igen = await reworkTask(deps, U, { roundId, index: 1, answer: ratt, attemptId: "rw-1" });
    assert.equal(w1igen.already, true);
    for (let i = 0; i < 8; i++) await reworkTask(deps, U, { roundId, index: 1, answer: ratt });
    const r = await rig.round(U, roundId);
    assert.equal(r.answers[1].rework.length, MAX_REWORK);
    assert.equal(r.answers[1].first.correct, false, "poängen ligger kvar");
    assert.deepEqual(r.answers[1].helpAfter, ["orientering", "princip"]);
    assert.equal(r.correctCount, 1);
    const st = await rig.state(U);
    assert.equal(st.challenges["03"].helpAfter, 1);
    assert.equal(st.totals.helpAfter, 1);
    assert.equal(st.totals.firstTotal, 2);
  });
});

describe("avbruten omgång", () => {
  it("ingen belöning; besvarade uppgifter räknas i statistiken; avbryt två gånger är ofarligt", async () => {
    const { roundId } = await startRound(deps, U, { challengeId: "03" });
    for (let i = 0; i < 9; i++) await answerTask(deps, U, { roundId, index: i, answer: await rig.svar(roundId, i) });
    assert.equal(await code(finishRound(deps, U, { roundId })), "failed-precondition", "ingen belöning före tio bedömda");
    assert.equal((await abortRound(deps, U, { roundId })).already, false);
    assert.equal((await abortRound(deps, U, { roundId })).already, true);
    await answerTask(deps, U, { roundId, index: 0, answer: await rig.svar(roundId, 0) }); // redan bedömd → sparat utfall
    assert.equal(await code(answerTask(deps, U, { roundId, index: 9, answer: await rig.svar(roundId, 9) })), "failed-precondition");
    assert.equal(await code(finishRound(deps, U, { roundId })), "failed-precondition");
    const r = await rig.round(U, roundId);
    assert.equal(r.status, "avbruten");
    assert.equal(r.reward, null);
    assert.equal(r.cores.length, 10);
    const st = await rig.state(U);
    const e = st.challenges["03"];
    assert.deepEqual([e.activeRoundId, e.activeAnswered, e.roundsAborted, e.stars, e.firstTotal, e.firstCorrect], [null, 0, 1, 0, 9, 9]);
    assert.equal(await rig.coins(U), 100);
    assert.deepEqual(await rig.rewards(U), []);
    // Nästa start blir en ny omgång.
    const ny = await startRound(deps, U, { challengeId: "03" });
    assert.notEqual(ny.roundId, roundId);
  });
});

describe("versioner", () => {
  it("en gammal aktiv omgång rättas med sina sparade uppgifter efter en generatorändring", async () => {
    const { roundId } = await startRound(deps, U, { challengeId: "03" });
    const ratt = await rig.svar(roundId, 0, true);
    // Ny version där facit är ett annat antal – den sparade uppgiften gäller ändå.
    const orig = fixtureDef().build;
    rig.useChallenge("03", { version: 2, build: (p) => { const b = orig(p); return { ...b, key: { ...b.key, count: p.a + 1 } }; } });
    const r = await answerTask(deps, U, { roundId, index: 0, answer: ratt });
    assert.equal(r.correct, true);
    assert.equal((await rig.round(U, roundId)).version, 1);
  });
});

describe("fokusläge och dold modul (#735)", () => {
  const MIN = 60_000;
  const klass = (id, falt) => db.doc(`classes/${id}`).set({ name: id, studentIds: [U, "brk-annan"], ...falt });

  it("låst till annat → nekas; låst till Bråkresan → öppet även om dold; utgånget lås → öppet", async () => {
    await klass("brk-6a", { lock: { mal: { typ: "lasresan" }, till: rig.ctl.clock + 30 * MIN, doljOvrigt: false } });
    assert.equal(await code(startRound(deps, U, { challengeId: "03" })), "permission-denied");
    await klass("brk-6a", { lock: { mal: { typ: "omrade", id: "ma/brak" }, till: rig.ctl.clock + 30 * MIN, doljOvrigt: false } });
    assert.equal(await code(startRound(deps, U, { challengeId: "03" })), "permission-denied");
    await klass("brk-6a", { lock: { mal: { typ: "lasresan" }, till: rig.ctl.clock - MIN, doljOvrigt: false } });
    assert.equal(await code(startRound(deps, U, { challengeId: "03" })), "ok");
    await klass("brk-6a", {
      hiddenModules: ["brakresan"],
      lock: { mal: { typ: "brakresan" }, till: rig.ctl.clock + 30 * MIN, doljOvrigt: true },
    });
    assert.equal((await startRound(deps, U, { challengeId: "03" })).resumed, true);
  });

  it("#788: provlås släpper den som lämnat in enligt efter-valet – den som skriver nekas", async () => {
    const T = "brk-tillfalle";
    const provLas = (efter) => klass("brk-6a", {
      lock: { mal: { typ: "prov", id: T }, till: rig.ctl.clock + 30 * MIN, doljOvrigt: true, ...(efter ? { efter } : {}) },
    });
    const svar = (uid, inlamnad) => db.doc(`provTillfallen/${T}/svar/${uid}`).set({ elevId: uid, inlamnad });
    try {
      await svar(U, true); // U har lämnat in, brk-annan skriver fortfarande
      await svar("brk-annan", false);
      const utfall = async () => [await code(startRound(deps, U, { challengeId: "03" })),
        await code(startRound(deps, "brk-annan", { challengeId: "03" }))];
      await provLas(null); // stanna på provsidan (som förr)
      assert.deepEqual(await utfall(), ["permission-denied", "permission-denied"]);
      await provLas({ lage: "prov" });
      assert.deepEqual(await utfall(), ["permission-denied", "permission-denied"]);
      for (const efter of [{ lage: "ovning" }, { lage: "klass" }, { lage: "egna", moduler: ["plugga", "brakresan"] }]) {
        await provLas(efter);
        assert.deepEqual(await utfall(), ["ok", "permission-denied"], efter.lage);
      }
      await provLas({ lage: "egna", moduler: ["plugga"] });
      assert.deepEqual(await utfall(), ["permission-denied", "permission-denied"], "egna utan Bråkresan");
      // Inget svar alls (har inte startat) = inte inlämnat.
      await db.doc(`provTillfallen/${T}/svar/brk-annan`).delete();
      await provLas({ lage: "klass" });
      assert.deepEqual(await utfall(), ["ok", "permission-denied"]);
      // Klassens vanliga läge: en dold Bråkresan är fortfarande stängd.
      await klass("brk-6a", {
        hiddenModules: ["brakresan"],
        lock: { mal: { typ: "prov", id: T }, till: rig.ctl.clock + 30 * MIN, doljOvrigt: true, efter: { lage: "klass" } },
      });
      assert.equal(await code(startRound(deps, U, { challengeId: "03" })), "permission-denied");
      // Ett lås till något annat i en annan klass gäller fortfarande.
      await provLas({ lage: "klass" });
      await db.doc("classes/brk-6b").set({
        name: "6B", studentIds: [U], lock: { mal: { typ: "lasresan" }, till: rig.ctl.clock + 30 * MIN, doljOvrigt: false },
      });
      assert.equal(await code(startRound(deps, U, { challengeId: "03" })), "permission-denied");
    } finally {
      await Promise.all([U, "brk-annan"].map((uid) => db.doc(`provTillfallen/${T}/svar/${uid}`).delete()));
    }
  });

  it("dold i någon av elevens klasser → nekas; andra elever påverkas inte", async () => {
    await klass("brk-6a", {});
    await db.doc("classes/brk-6b").set({ name: "6B", studentIds: [U], hiddenModules: ["brakresan"] });
    assert.equal(await code(startRound(deps, U, { challengeId: "03" })), "permission-denied");
    assert.equal(await code(startRound(deps, "brk-annan", { challengeId: "03" })), "ok");
  });
});
