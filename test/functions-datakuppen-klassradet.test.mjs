// ============================================================================
// Datakuppen – KLASSRÅDETS ÄNDRINGAR på servern (#832, uppdraget
// datakuppen-klassradet.md §12) mot Firestore-emulatorn, styrd klocka och
// slump. Filerna och viruset (test 4–5, 8–14) och brandväggen under hack
// (test 16–19) + kantfall §7.9–7.10. Kodläckan (test 20–26, §7.1–7.3):
// functions-datakuppen-kodlacka.test.mjs. Ren logik (test 1, 3, 6, 12):
// test/live-datakuppen-klassradet.test.js.
// Körs av `npm run test:functions`. Riggen: test/helpers/datakuppen-core-rig.js.
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { openFile, chooseTarget, guessCode } from "../functions/datakuppen-core.js";
import { DK_RULES, DK_BALANS } from "../src/live/formats/datakuppen/delat/files-config.js";
import {
  db, deps, ctl, Timestamp, END, reset, rngFor, makeSession, setGold, setCode, giveHack, gp, self, secret, events,
  rightAnswer, wrongAnswer, streak, code,
} from "./helpers/datakuppen-core-rig.js";

beforeEach(reset);

const VIRUS = rngFor("virus", true, true); // slumptalet som ger viruset när det är möjligt
const open = async (s, uid, roll) => {
  ctl.roll = roll;
  ctl.clock += 2_000;
  return openFile(deps, uid, { sid: s, attemptId: await rightAnswer(s, uid), fileIndex: 0 });
};
const stats = async (s) => (await db.doc(`liveSessions/${s}/dkPrivate/stats`).get()).data() || {};
const rightIndex = (options, kod) => options.indexOf(kod);

describe("filerna (test 4, 5, §3)", () => {
  it("test 4: liten mapp ger 50 MB, vanlig mapp 100 MB (Elias F1); ingen tom mapp", async () => {
    const s = await makeSession();
    assert.equal((await open(s, "alma", rngFor("liten_fil"))).delta, 50);
    assert.equal((await open(s, "alma", rngFor("mapp"))).delta, 100);
    assert.throws(() => rngFor("tom_mapp"), /ingen fil/);
  });

  it("test 5: Superserver ger exakt 1000 MB (även efter en överklockning), syns i flödet och räknas", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 120);
    await open(s, "alma", rngFor("overklockning"));
    const r = await open(s, "alma", rngFor("superserver"));
    assert.deepEqual([r.file, r.delta, r.gold], ["superserver", 1000, 1360]);
    const ev = (await events(s)).find((e) => e.chest === "superserver");
    assert.deepEqual([ev.type, ev.name, ev.amount], ["chest", "Alma", 1000]);
    assert.equal((await stats(s)).superservrar, 1);
  });
});

describe("viruset (test 8–14, §4, §7.9)", () => {
  it("test 8: rätt svar utan felsvit → aldrig virus (samma slumptal ger en datafil)", async () => {
    const s = await makeSession();
    for (let i = 0; i < 5; i++) assert.notEqual((await open(s, "alma", VIRUS)).file, "virus");
    await wrongAnswer(s, "alma");
    assert.notEqual((await open(s, "alma", VIRUS)).file, "virus", "ett fel räcker inte");
  });

  it("test 9: 3 fel i rad och sedan rätt → viruset kan komma", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await streak(s, "alma", 3);
    assert.equal((await secret(s, "alma")).felIRad, 3);
    const r = await open(s, "alma", VIRUS);
    assert.equal(r.file, "virus");
    assert.equal((await stats(s)).virus, 1);
  });

  it("test 10: 2 fel i rad och sedan rätt → inget virus; ett rätt svar emellan nollställer", async () => {
    const s = await makeSession();
    await streak(s, "alma", 2);
    assert.notEqual((await open(s, "alma", VIRUS)).file, "virus");
    await streak(s, "alma", 2);
    await rightAnswer(s, "alma");
    await streak(s, "alma", 2);
    assert.notEqual((await open(s, "alma", VIRUS)).file, "virus");
  });

  it("test 11: efter ett rätt svar är felIRad = 0 – även om filen inte öppnas", async () => {
    const s = await makeSession();
    await streak(s, "alma", 4);
    const id = await rightAnswer(s, "alma");
    const sec = await secret(s, "alma");
    assert.deepEqual([sec.felIRad, sec.virusFor], [0, id], "viruset gäller bara filen till just det svaret");
    await streak(s, "alma", 1);
    assert.notEqual((await open(s, "alma", VIRUS)).file, "virus", "ett gammalt svars felsvit följer inte med");
  });

  it("test 13: elev med 8 MB → 0, aldrig under, förlusten (delta) är 8", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 8);
    await streak(s, "alma");
    const r = await open(s, "alma", VIRUS);
    assert.deepEqual([r.file, r.gold, r.delta], ["virus", 0, -8]);
    assert.ok(r.virusMb >= 10 && r.virusMb <= 20);
  });

  it("test 14 / §7.9: elev med 0 MB → ingen förlust, ingen händelse", async () => {
    const s = await makeSession();
    await streak(s, "alma");
    const r = await open(s, "alma", VIRUS);
    assert.deepEqual([r.file, r.gold, r.delta], ["virus", 0, 0]);
    assert.equal((await events(s)).length, 0, "viruset syns aldrig på projektorn");
  });

  it("§7.7: hackning av påverkar inte felsviten – viruset kommer fortfarande bara efter 3 fel", async () => {
    const s = await makeSession({ hacking: false });
    assert.notEqual((await open(s, "alma", rngFor("virus", false, true))).file, "virus");
    await streak(s, "alma");
    assert.equal((await open(s, "alma", rngFor("virus", false, true))).file, "virus");
  });
});

/** Alma 100 MB (kod p4nnk4k4), Leo 100 MB (kod r0b0t1), Omar har ett Hack. */
async function hackSetup(players) {
  const s = await makeSession({}, players);
  await setGold(s, "alma", 100);
  await setCode(s, "alma", "p4nnk4k4");
  await setGold(s, "leo", 100);
  await setCode(s, "leo", "r0b0t1");
  await giveHack(s, "omar", 0, { lastVictimUid: "ines" });
  return s;
}

describe("brandvägg under hack (test 16–19, §5)", () => {
  it("test 16: brandvägg mellan målval och gissning → hacket förbrukas inte, inget stryks, målväljaren med 10 s", async () => {
    const s = await hackSetup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    const wrong = t.options.findIndex((c) => c !== "p4nnk4k4");
    ctl.clock += 3_000;
    await setGold(s, "alma", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + DK_RULES.shieldMs) });
    const r = await guessCode(deps, "omar", { sid: s, index: wrong });
    assert.deepEqual([r.result, r.back, r.message], ["protected", true, "🛡️ Alma fick en brandvägg! Välj någon annan."]);
    assert.equal(r.expiresAtMs, ctl.clock + DK_BALANS.hack.nyttMalvalSekunder * 1000);
    const omar = await gp(s, "omar");
    assert.deepEqual([omar.pending.chest, omar.pending.stage, omar.pending.targetUid, omar.lastVictimUid, omar.hackAttempts],
      ["hack", undefined, undefined, "ines", 0]);
    assert.equal(omar.pending.expiresAt.toMillis(), r.expiresAtMs);
    assert.deepEqual((await secret(s, "omar")).hacks.alma.struck, [], "ingen kod struken");
    assert.equal((await self(s, "omar")).hack, null);
    assert.equal((await stats(s)).avbrutnaHack, 1);
    // Samma hack fortsätter: välj ett annat mål.
    assert.equal((await chooseTarget(deps, "omar", { sid: s, targetUid: "leo" })).result, "target");
  });

  it("test 17: efter återgången kan samma mål väljas senare (det avbrutna försöket räknas inte)", async () => {
    const s = await hackSetup();
    await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await setGold(s, "alma", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 5_000) });
    assert.equal((await guessCode(deps, "omar", { sid: s, index: 0 })).back, true);
    ctl.clock += 6_000;
    const again = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    assert.equal(again.result, "target");
    assert.equal((await guessCode(deps, "omar", { sid: s, index: rightIndex(again.options, "p4nnk4k4") })).result, "hacked");
  });

  it("test 18: ingen giltig att hacka → liten mapp 50 MB (vid målvalet och efter en återgång)", async () => {
    const s = await hackSetup(["alma", "omar", "leo", "ines"]);
    await setGold(s, "leo", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 60_000) });
    await giveHack(s, "omar", 120, { lastVictimUid: "ines" });
    await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await setGold(s, "alma", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 60_000) });
    const r = await guessCode(deps, "omar", { sid: s, index: 0 });
    assert.deepEqual([r.result, r.back, r.fallback], ["protected", false, { file: "liten_fil", delta: 50, gold: 170 }]);
    assert.deepEqual([(await gp(s, "omar")).pending, (await gp(s, "omar")).gold], [null, 170], "50 MB, ingen överklockning");
    await giveHack(s, "omar", 170, { lastVictimUid: null });
    const c = await chooseTarget(deps, "omar", { sid: s, targetUid: null });
    assert.deepEqual([c.result, c.file, c.delta], ["fallback", "liten_fil", 50]);
  });

  it("test 19: brandvägg och gissning samtidigt → exakt ett utfall, ingen dubbel flytt", async () => {
    for (let round = 0; round < 4; round++) {
      const s = await hackSetup();
      const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
      ctl.clock += 2_000;
      const id = await rightAnswer(s, "alma");
      ctl.roll = rngFor("brandvagg");
      const [g] = await Promise.all([
        guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") }),
        openFile(deps, "alma", { sid: s, attemptId: id, fileIndex: 0 }),
      ]);
      const [alma, omar] = [await gp(s, "alma"), await gp(s, "omar")];
      assert.equal(alma.gold + omar.gold, 100, "ingen data försvann eller dök upp");
      const steals = (await events(s)).filter((e) => e.type === "steal");
      if (g.result === "hacked") {
        assert.deepEqual([steals.length, omar.gold, omar.pending], [1, 15, null]);
      } else {
        assert.deepEqual([g.result, steals.length, omar.gold, omar.pending.chest], ["protected", 0, 0, "hack"]);
      }
    }
  });
});

describe("matchen tar slut (§7.10)", () => {
  it("mitt i ett hack, ett nytt målval eller ett kodbyte → allt avbryts utan effekt", async () => {
    const s = await hackSetup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    ctl.clock = END + 1;
    assert.equal(await code(guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") })), "failed-precondition");
    assert.equal(await code(chooseTarget(deps, "omar", { sid: s, targetUid: "leo" })), "failed-precondition");
    assert.deepEqual([(await gp(s, "alma")).gold, (await gp(s, "omar")).gold], [100, 0]);
  });
});
