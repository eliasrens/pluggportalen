// ============================================================================
// Datakuppen (#652): KODERNA och FILERNA på servern (functions/datakuppen-
// core.js pickCode/openFile) mot Firestore-emulatorn – styrd klocka och slump.
// Spec docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §6:
//   test 1   lobbyn: 4 koder ur listan, olika, helst inte tagna i matchen
//   test 2   ingen kod vald före start → servern väljer ur listan
//   test 4   rätt svar → tre filer, servern avgör innehållet
//   test 10  hackning av → aldrig Hack
//   test 11  virus högst 10 %, aldrig allt
//   §2       öppna samma fil två gånger, fil utan rätt svar, svar/fil efter
//            tiden, egen påhittad kod som "vald kod"
// Hacket (test 5–9, 12, resten av §2): functions-datakuppen-hack.test.mjs.
// Körs av `npm run test:functions`. Riggen: test/helpers/datakuppen-core-rig.js.
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { answerQuestion, openFile, pickCode, chooseTarget, DK_CODES } from "../functions/datakuppen-core.js";
import { DK_FILES, DK_RULES } from "../src/live/formats/datakuppen/delat/files-config.js";
import {
  db, deps, ctl, Timestamp, START, END, reset, rngFor, makeSession, setGold, setCode, giveHack, gp, self, secret,
  events, rightAnswer, att, code,
} from "./helpers/datakuppen-core-rig.js";

beforeEach(reset);

const lobby = (players) => makeSession({ status: "lobby", startedAt: null }, players);

describe("koderna (test 1, 2, §1.2)", () => {
  it("test 1: lobbyn → 4 koder ur listan, olika varandra och inte tagna/föreslagna av någon annan", async () => {
    const s = await lobby();
    const taken = DK_CODES.slice(0, 40);
    await setCode(s, "omar", taken[0]);
    await setCode(s, "leo", null, 0, { offers: taken.slice(1, 5) });
    for (const [i, kod] of taken.slice(5).entries()) {
      await db.doc(`liveSessions/${s}/dkSecret/x${i}`).set({ uid: `x${i}`, code: kod, codeVersion: 1 });
    }
    for (const x of [0, 0.3, 0.6, 0.99]) {
      ctl.roll = x;
      const me = `alma${String(x).replace(".", "")}`;
      await db.doc(`liveSessions/${s}/players/${me}`).set({ uid: me, classId: "4b", name: "Alma" });
      const r = await pickCode(deps, me, { sid: s });
      assert.equal(r.offers.length, 4);
      assert.equal(new Set(r.offers).size, 4, "olika varandra");
      for (const c of r.offers) {
        assert.ok(DK_CODES.includes(c), `${c} ur listan`);
        assert.ok(!taken.includes(c), `${c} är redan tagen`);
      }
      assert.equal(r.code, null);
      assert.deepEqual((await self(s, me)).offers, r.offers, "eleven ser förslagen i sitt eget dokument");
      assert.deepEqual((await pickCode(deps, me, { sid: s })).offers, r.offers, "samma förslag vid omladdning");
    }
  });

  it("listan tar slut (fler spelare än koder) → en kod återanvänds, men förslagen är fortfarande 4 olika", async () => {
    const s = await lobby(["alma"]);
    for (const [i, kod] of DK_CODES.slice(0, DK_CODES.length - 2).entries()) {
      await db.doc(`liveSessions/${s}/dkSecret/x${i}`).set({ uid: `x${i}`, code: kod, codeVersion: 1 });
    }
    const r = await pickCode(deps, "alma", { sid: s });
    assert.equal(new Set(r.offers).size, 4);
    assert.ok(r.offers.includes(DK_CODES.at(-1)) && r.offers.includes(DK_CODES.at(-2)), "de lediga först");
  });

  it("eleven väljer ett förslag (index) → koden sparas i elevens och serverns dokument, aldrig i dkPlayers", async () => {
    const s = await lobby();
    const { offers } = await pickCode(deps, "alma", { sid: s });
    const r = await pickCode(deps, "alma", { sid: s, index: 2 });
    assert.deepEqual([r.code, r.offers], [offers[2], null]);
    assert.deepEqual([(await self(s, "alma")).code, (await secret(s, "alma")).code], [offers[2], offers[2]]);
    assert.equal((await self(s, "alma")).codeVersion, 1);
    assert.equal(await gp(s, "alma"), undefined, "inget spelardokument (det andra läser) får koden");
  });

  it("#719: koden väljs EN gång – ett nytt val i lobbyn eller under matchen avvisas", async () => {
    const s = await lobby();
    await pickCode(deps, "alma", { sid: s });
    const r = await pickCode(deps, "alma", { sid: s, index: 1 });
    assert.equal(await code(pickCode(deps, "alma", { sid: s, index: 0 })), "failed-precondition");
    assert.equal((await pickCode(deps, "alma", { sid: s })).code, r.code, "utan index: samma kod");
    assert.equal((await secret(s, "alma")).codeVersion, 1);
  });

  it("§2: en egen påhittad kod som 'vald kod' nekas – bara ett index i förslagen tas", async () => {
    const s = await lobby();
    await pickCode(deps, "alma", { sid: s });
    for (const index of ["mittlosen123", "p4nnk4k4", 4, -1, 1.5, { kod: "x" }]) {
      assert.equal(await code(pickCode(deps, "alma", { sid: s, index })), "invalid-argument", JSON.stringify(index));
    }
    // Ett extra fält med en egen kod ignoreras – koden kommer bara ur förslagen.
    await pickCode(deps, "alma", { sid: s, code: "hemlis123" });
    await pickCode(deps, "alma", { sid: s, index: 0, code: "hemlis123" });
    assert.notEqual((await secret(s, "alma")).code, "hemlis123");
    assert.ok(DK_CODES.includes((await secret(s, "alma")).code));
  });

  it("välja utan förslag, utan att ha gått med, eller efter matchen nekas", async () => {
    const s = await lobby();
    assert.equal(await code(pickCode(deps, "alma", { sid: s, index: 0 })), "failed-precondition");
    assert.equal(await code(pickCode(deps, "okand", { sid: s })), "permission-denied");
    const slut = await makeSession({ status: "finished" });
    assert.equal(await code(pickCode(deps, "alma", { sid: slut })), "failed-precondition");
    const ute = await makeSession();
    ctl.clock = END + 1;
    assert.equal(await code(pickCode(deps, "alma", { sid: ute })), "failed-precondition");
  });

  it("test 2: ingen kod vald före start → servern väljer (ur förslagen, annars ur listan)", async () => {
    const s = await lobby();
    const { offers } = await pickCode(deps, "alma", { sid: s });
    await db.doc(`liveSessions/${s}`).update({ status: "live", startedAt: Timestamp.fromMillis(START) });
    const r = await pickCode(deps, "alma", { sid: s });
    assert.equal(r.auto, true);
    assert.ok(offers.includes(r.code), "ur elevens förslag");
    const o = await pickCode(deps, "omar", { sid: s }); // aldrig sett några förslag
    assert.equal(o.auto, true);
    assert.ok(DK_CODES.includes(o.code));
    assert.notEqual(o.code, r.code, "helst unika i matchen");
    assert.equal((await pickCode(deps, "alma", { sid: s })).code, r.code, "sedan ligger koden fast");
  });

  it("test 2: målet har ingen kod när någon hackar → servern väljer en åt hen i samma ögonblick", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await giveHack(s, "omar");
    const r = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    const almas = (await secret(s, "alma")).code;
    assert.ok(DK_CODES.includes(almas));
    assert.ok(r.options.includes(almas));
    assert.equal((await self(s, "alma")).code, almas, "Alma ser sin nya kod");
  });
});

describe("filerna (test 4, 10, 11, §1.3)", () => {
  it("test 4: rätt svar → en fil; SERVERN avgör innehållet (samma slump = samma fil, oavsett vilken fil eleven klickar)", async () => {
    const s = await makeSession();
    for (const f of DK_FILES.filter((x) => x.id !== "hack")) {
      ctl.roll = rngFor(f.id);
      ctl.clock += 2_000;
      const r = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: ctl.clock % 3 });
      assert.equal(r.file, f.id);
    }
    assert.equal((await gp(s, "alma")).chests, DK_FILES.length - 1);
    const ev = await events(s);
    assert.ok(ev.some((e) => e.chest === "serverhall" && e.amount === 100));
    assert.ok(ev.every((e) => !("code" in e)), "inga koder i händelserna");
  });

  it("filen ger +MB, brandvägg 60 s, överklockning högst +150, tak för data", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 400);
    ctl.roll = rngFor("overklockning");
    const r = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 });
    assert.deepEqual([r.delta, r.gold], [150, 550]);
    ctl.roll = rngFor("brandvagg");
    ctl.clock += 2_000;
    const b = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 1 });
    assert.equal(b.protectedUntil, ctl.clock + DK_RULES.shieldMs);
    await setGold(s, "alma", DK_RULES.maxGold - 5);
    ctl.roll = rngFor("serverhall");
    ctl.clock += 2_000;
    const m = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 2 });
    assert.equal(m.gold, DK_RULES.maxGold);
  });

  it("test 11: virus tappar högst 10 % och aldrig allt", async () => {
    const s = await makeSession();
    for (const [före, efter] of [[100, 90], [255, 230], [9, 9], [1, 1], [0, 0]]) {
      await setGold(s, "alma", före);
      ctl.roll = rngFor("virus");
      ctl.clock += 2_000;
      const r = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 });
      assert.equal(r.gold, efter, `${före} MB`);
      assert.ok(r.gold > 0 || före === 0, "ingen förlorar allt");
    }
  });

  it("Hack-filen → väntande hack (inget flyttas än); en ny fil går inte förrän hacket är klart", async () => {
    const s = await makeSession();
    ctl.roll = rngFor("hack");
    const r = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 });
    assert.deepEqual([r.file, r.kind, r.delta], ["hack", "steal", 0]);
    assert.equal(r.pending.expiresAtMs, ctl.clock + DK_RULES.victimPickMs);
    assert.equal((await gp(s, "alma")).pending.chest, "hack");
    ctl.clock += 2_000;
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 })), "failed-precondition");
  });

  it("test 10: hackning av → ingen fil kan bli Hack, vikten går till datafilerna; ett manipulerat väntande hack ger en Mapp", async () => {
    const s = await makeSession({ hacking: false });
    for (const x of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999]) {
      ctl.roll = x;
      ctl.clock += 2_000;
      const r = await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 });
      assert.notEqual(r.file, "hack", String(x));
      assert.equal(r.pending, undefined);
    }
    await giveHack(s, "omar", 0);
    await setGold(s, "leo", 100);
    await setCode(s, "leo", "r0b0t");
    const r = await chooseTarget(deps, "omar", { sid: s, targetUid: "leo" });
    assert.deepEqual([r.result, r.file, r.delta], ["fallback", "mapp", 25]);
    assert.equal((await gp(s, "leo")).gold, 100, "ingen hackning när den är avstängd");
  });
});

describe("spärrarna (§2)", () => {
  it("öppna samma fil två gånger nekas", async () => {
    const s = await makeSession();
    const id = await rightAnswer(s, "alma");
    await openFile(deps, "alma", { sid: s, attemptId: id, fileIndex: 0 });
    ctl.clock += 2_000;
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: id, fileIndex: 1 })), "already-exists");
  });

  it("öppna en fil utan rätt svar (fel svar, påhittat svar, någon annans svar) nekas", async () => {
    const s = await makeSession();
    const fel = att();
    const r = await answerQuestion(deps, "alma", { sid: s, attemptId: fel, factorA: 3, factorB: 4, answer: 13 });
    assert.equal(r.correct, false);
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: fel, fileIndex: 0 })), "failed-precondition");
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: "pahittat-svar-1", fileIndex: 0 })), "permission-denied");
    const omars = await rightAnswer(s, "omar");
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: omars, fileIndex: 0 })), "permission-denied");
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 3 })), "invalid-argument");
  });

  it("minsta tid mellan filer; ett svar per fråga (samma attemptId ger samma utfall, inget nytt)", async () => {
    const s = await makeSession();
    await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 });
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 })), "resource-exhausted");
    const id = att();
    await answerQuestion(deps, "omar", { sid: s, attemptId: id, factorA: 2, factorB: 2, answer: 4 });
    await answerQuestion(deps, "omar", { sid: s, attemptId: id, factorA: 2, factorB: 2, answer: 4 });
    assert.equal((await gp(s, "omar")).correct, 1);
  });

  it("svara eller öppna en fil efter att tiden tagit slut nekas", async () => {
    const s = await makeSession();
    const id = await rightAnswer(s, "alma");
    ctl.clock = END;
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 3, factorB: 4, answer: 12 })), "failed-precondition");
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: id, fileIndex: 0 })), "failed-precondition");
  });

  it("en Guldrush-session går inte att spela med Datakuppens anrop", async () => {
    const s = await makeSession({ format: "guldrush", stealSwap: true });
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 3, factorB: 4, answer: 12 })), "failed-precondition");
    assert.equal(await code(pickCode(deps, "alma", { sid: s })), "failed-precondition");
  });
});
