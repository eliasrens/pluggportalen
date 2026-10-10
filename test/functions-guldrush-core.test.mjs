// ============================================================================
// Guldrushen (#563): SERVERKÄRNAN (functions/guldrush-core.js) direkt mot
// Firestore-emulatorn – Admin SDK, styrd klocka och styrd slump, så att
// varje kista, varje skyddstid och varje attack går att testa exakt.
// Callable-lagret (inloggning, HttpsError) testas i functions-guldrush.test.mjs.
//
//   test 19  samma kista två gånger, kista utan rätt svar, annans svar
//   test 20  svar/kista/stöld efter tiden nekas
//   + quiz mot facit, kistornas effekter, ledningsbyte
// Stöld och byte (test 15–18): functions-guldrush-stold.test.mjs.
// Riggen (klocka, slump, seed): test/helpers/guldrush-core-rig.js.
//
// Körs av `npm run test:functions` (Firestore-emulatorn behövs).
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { answerQuestion, openChest, chooseVictim } from "../functions/guldrush-core.js";
import { GR_RULES } from "../src/live/formats/guldrush/delat/chests-config.js";
import {
  db, deps, ctl, Timestamp, T0, END, START, reset, rngFor, makeSession, setGold, pending, gp, events, rightAnswer, att,
  code, sRef,
} from "./helpers/guldrush-core-rig.js";

beforeEach(reset);

describe("svaret rättas på servern", () => {
  it("rätt/fel multiplikation → answers-dokument (create-only) + elevens räknare; omförsök ger samma utfall", async () => {
    const s = await makeSession();
    const id = att();
    const r = await answerQuestion(deps, "alma", { sid: s, attemptId: id, factorA: 7, factorB: 8, answer: "56" });
    assert.deepEqual([r.correct, r.correctAnswer], [true, 56]);
    const wrong = await answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 7, factorB: 8, answer: 54 });
    assert.equal(wrong.correct, false);
    const a = (await db.doc(`liveSessions/${s}/answers/${id}`).get()).data();
    assert.equal(a.uid, "alma");
    assert.equal(a.isCorrect, true);
    assert.equal(a.format, "guldrush");
    assert.ok(a.at instanceof Timestamp);
    const p = await gp(s, "alma");
    assert.deepEqual([p.gold, p.correct, p.incorrect], [0, 1, 1], "sen anslutning/första svaret startar på 0 guld");
    const again = await answerQuestion(deps, "alma", { sid: s, attemptId: id, factorA: 1, factorB: 1, answer: 1 });
    assert.equal(again.correct, true);
    assert.equal((await gp(s, "alma")).correct, 1, "omförsöket räknas inte igen");
    assert.equal(await code(answerQuestion(deps, "omar", { sid: s, attemptId: id, factorA: 1, factorB: 1, answer: 1 })), "already-exists");
  });

  it("svarssätt (#551): flerval kräver choiceIndex, skriv själv tar inte emot det", async () => {
    const free = await makeSession();
    assert.equal(await code(answerQuestion(deps, "alma", { sid: free, attemptId: att(), factorA: 2, factorB: 2, answer: 4, choiceIndex: 1 })), "invalid-argument");
    const choice = await makeSession({ answerKind: "choice" });
    assert.equal(await code(answerQuestion(deps, "alma", { sid: choice, attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "invalid-argument");
    const r = await answerQuestion(deps, "alma", { sid: choice, attemptId: att(), factorA: 2, factorB: 2, answer: 4, choiceIndex: 2 });
    assert.equal(r.correct, true);
  });

  it("bara deltagare; ogiltiga tal nekas", async () => {
    const s = await makeSession();
    assert.equal(await code(answerQuestion(deps, "okand", { sid: s, attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "permission-denied");
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 11, factorB: 2, answer: 22 })), "invalid-argument");
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: "kort", factorA: 2, factorB: 2, answer: 4 })), "invalid-argument");
    const km = await makeSession({ format: "klassmatch" });
    assert.equal(await code(answerQuestion(deps, "alma", { sid: km, attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "failed-precondition");
  });

  it("quiz: rättas mot det lärarskyddade facit; servern väljer nästa fråga (ingen provar sig fram)", async () => {
    const s = await makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 3 });
    const questions = [0, 1, 2].map((i) => ({ id: `q${i}`, text: `F${i}`, options: ["a", "b", "c", "d"], statKeys: ["ovrig", `q:q${i}`] }));
    await db.doc(`liveSessions/${s}/grPublic/questions`).set({ questions });
    await db.doc(`liveSessions/${s}/grPrivate/snapshot`).set({ facit: [{ answerIndex: 2 }, { answerIndex: 0 }, { answerIndex: 3 }] });
    ctl.roll = 0.99;
    const r1 = await answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 0, choiceIndex: 2 });
    assert.deepEqual([r1.correct, r1.correctAnswer], [true, "c"]);
    assert.notEqual(r1.nextQ, 0, "aldrig samma fråga två gånger i rad");
    assert.equal((await gp(s, "alma")).nextQ, r1.nextQ);
    // Samma fråga igen (pröva nästa alternativ) → nekas.
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 0, choiceIndex: 1 })), "failed-precondition");
    const wrongIdx = r1.nextQ === 1 ? 1 : 0;
    const r2 = await answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: r1.nextQ, choiceIndex: wrongIdx });
    assert.equal(r2.correct, false);
    const docs = (await db.collection(`liveSessions/${s}/answers`).get()).docs.map((d) => d.data());
    assert.ok(docs.every((a) => a.mode === "plugga_quiz" && a.statKeys.length === 2 && a.answerKind === "choice"));
  });
});

describe("kistan (test 13 + 19)", () => {
  it("ett rätt svar → EN kista; samma kista två gånger nekas", async () => {
    const s = await makeSession();
    const id = await rightAnswer(s, "alma");
    ctl.roll = rngFor("mycket_guld");
    const r = await openChest(deps, "alma", { sid: s, attemptId: id, chestIndex: 1 });
    assert.deepEqual([r.chest, r.delta, r.gold], ["mycket_guld", 50, 50]);
    const a = (await db.doc(`liveSessions/${s}/answers/${id}`).get()).data();
    assert.deepEqual([a.chest, a.chestIndex], ["mycket_guld", 1]);
    ctl.clock += 5_000;
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: id, chestIndex: 0 })), "already-exists");
    assert.equal((await gp(s, "alma")).gold, 50, "guldet oförändrat");
    const ev = await events(s);
    assert.ok(ev.some((e) => e.type === "chest" && e.chest === "mycket_guld" && e.uid === "alma" && e.amount === 50 && e.at instanceof Timestamp));
  });

  it("kista utan rätt svar, med annans svar, med påhittat id, utan svar alls → nekas", async () => {
    const s = await makeSession();
    const wrong = att();
    await answerQuestion(deps, "alma", { sid: s, attemptId: wrong, factorA: 3, factorB: 3, answer: 10 });
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: wrong, chestIndex: 0 })), "failed-precondition");
    const omars = await rightAnswer(s, "omar");
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: omars, chestIndex: 0 })), "permission-denied");
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: "finns-inte-123", chestIndex: 0 })), "permission-denied");
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: omars, chestIndex: 7 })), "invalid-argument");
    assert.equal((await gp(s, "alma")).gold, 0);
  });

  it("en kista i taget (skript-spärr) och inte medan en stöld väntar", async () => {
    const s = await makeSession();
    const a1 = await rightAnswer(s, "alma");
    const a2 = await rightAnswer(s, "alma");
    ctl.roll = rngFor("guld");
    await openChest(deps, "alma", { sid: s, attemptId: a1, chestIndex: 0 });
    ctl.clock += 200;
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: a2, chestIndex: 0 })), "resource-exhausted");
    ctl.clock += GR_RULES.minChestGapMs;
    ctl.roll = rngFor("stold");
    const r = await openChest(deps, "alma", { sid: s, attemptId: a2, chestIndex: 0 });
    assert.equal(r.pending.kind, "steal");
    const a3 = await rightAnswer(s, "alma");
    ctl.clock += 5_000;
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: a3, chestIndex: 0 })), "failed-precondition");
  });

  it("effekterna: dubbla (max +150), hål i fickan (10 %), tom, sköld", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 400);
    const open = async (id) => {
      ctl.roll = rngFor(id);
      ctl.clock += 2_000;
      return openChest(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), chestIndex: 2 });
    };
    assert.deepEqual([(await open("dubbla")).delta, (await gp(s, "alma")).gold], [150, 550]);
    assert.deepEqual([(await open("hal_i_fickan")).delta, (await gp(s, "alma")).gold], [-55, 495]);
    assert.equal((await open("tom")).delta, 0);
    assert.equal((await open("skold")).shield, true);
    assert.equal((await gp(s, "alma")).shield, true);
  });
});

describe("tiden (test 20) och ledningsbyte", () => {
  it("svar, kista och stöld efter 00:00 nekas – och före 3-2-1-KÖR!, och efter lärarens avslut", async () => {
    const s = await makeSession();
    const id = await rightAnswer(s, "alma");
    await setGold(s, "omar", 0, { pending: pending("steal") });
    await setGold(s, "leo", 100);
    ctl.clock = END;
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "failed-precondition");
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: id, chestIndex: 0 })), "failed-precondition");
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "leo" })), "failed-precondition");
    ctl.clock = T0 - 1;
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "failed-precondition");
    ctl.clock = START + 30_000;
    await sRef(s).update({ status: "finished" });
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: id, chestIndex: 0 })), "failed-precondition");
    assert.equal((await gp(s, "leo")).gold, 100);
  });

  it("ledningsbyte blir en händelse (bara när någon ENSAM tar ledningen)", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 50);
    ctl.roll = rngFor("guld");
    await openChest(deps, "omar", { sid: s, attemptId: await rightAnswer(s, "omar"), chestIndex: 0 });
    let leads = (await events(s)).filter((e) => e.type === "lead");
    assert.deepEqual(leads.map((e) => e.uid), ["alma"], "Alma leder (Omar 25)");
    ctl.clock += 2_000;
    await openChest(deps, "omar", { sid: s, attemptId: await rightAnswer(s, "omar"), chestIndex: 0 });
    leads = (await events(s)).filter((e) => e.type === "lead");
    assert.deepEqual(leads.map((e) => e.uid), ["alma"], "50–50 = delad, ingen ny ledare");
    ctl.clock += 2_000;
    ctl.roll = rngFor("lite_guld");
    await openChest(deps, "omar", { sid: s, attemptId: await rightAnswer(s, "omar"), chestIndex: 0 });
    leads = (await events(s)).filter((e) => e.type === "lead");
    assert.deepEqual(leads.map((e) => e.uid).sort(), ["alma", "omar"]);
    assert.equal(leads.find((e) => e.uid === "omar").previousUid, "alma");
    assert.equal((await db.doc(`liveSessions/${s}/grMeta/leader`).get()).data().uid, "omar");
  });
});
