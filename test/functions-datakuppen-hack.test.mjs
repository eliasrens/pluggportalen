// ============================================================================
// Datakuppen (#652): HACKET på servern (functions/datakuppen-core.js
// chooseTarget/guessCode/pickCode) mot Firestore-emulatorn – styrd klocka och
// slump. Spec docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §6:
//   test 5   rätt kod → 15 % flyttas i EN transaktion, målet 30 s skydd + "välj ny kod"
//   test 6   fel kod → inget flyttas, koden stryks
//   test 7   samma mål igen (inte direkt efter) → samma koder minus strukna, ny ordning
//   test 8   målet byter kod → nya koder, inga strukna
//   test 9   mål med brandvägg → nekas (även manipulerat), valbart när skyddet gått ut
//   test 12  lockkoder ur listan, ungefär samma längd, aldrig någons aktuella
//            kod, och inget i svaret/dokumenten visar vilken som är rätt
//   §2       gissa utan Hack, mot ett annat mål, flera gånger, hacka skyddad
// Körs av `npm run test:functions`. Riggen: test/helpers/datakuppen-core-rig.js.
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { openFile, pickCode, chooseTarget, guessCode, DK_CODES } from "../functions/datakuppen-core.js";
import { DK_RULES } from "../src/live/formats/datakuppen/delat/files-config.js";
import {
  db, deps, ctl, Timestamp, reset, rngFor, makeSession, setGold, setCode, giveHack, gp, self, secret, events,
  rightAnswer, code,
} from "./helpers/datakuppen-core-rig.js";

beforeEach(reset);

/** Alma 100 MB med koden p4nnk4k4, Omar har just fått ett Hack. */
async function setup(over = {}, players) {
  const s = await makeSession(over, players);
  await setGold(s, "alma", 100);
  await setCode(s, "alma", "p4nnk4k4");
  await giveHack(s, "omar", 0);
  return s;
}
const rightIndex = (options, kod) => options.indexOf(kod);
const wrongIndex = (options, kod) => options.findIndex((c) => c !== kod);

describe("hacket (test 5–8)", () => {
  it("test 5: Omar hackar Alma med rätt kod → Alma 85, Omar +15 i samma transaktion, skydd 30 s, 4 nya kodförslag", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    assert.equal(t.result, "target");
    assert.equal(t.options.length, 3);
    assert.ok(t.options.includes("p4nnk4k4"));
    const r = await guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") });
    assert.deepEqual([r.result, r.amount, r.gold, r.victimGold], ["hacked", 15, 15, 85]);
    const [alma, omar] = [await gp(s, "alma"), await gp(s, "omar")];
    assert.equal(alma.gold + omar.gold, 100, "ingen data försvann eller dök upp");
    assert.deepEqual([omar.pending, omar.hackAttempts, omar.hackSuccess, omar.lastVictimUid], [null, 1, 1, "alma"]);
    assert.equal(alma.protectedUntil.toMillis(), ctl.clock + DK_RULES.protectionMs);
    assert.deepEqual([alma.lastHit.kind, alma.lastHit.chest, alma.lastHit.byName, alma.lastHit.amount], ["steal", "hack", "Omar", 15]);
    const almaSelf = await self(s, "alma");
    assert.equal(almaSelf.offers.length, 4);
    assert.ok(!almaSelf.offers.includes("p4nnk4k4"), "den läckta koden föreslås inte igen");
    assert.equal(almaSelf.offersExpiresAt.toMillis(), ctl.clock + DK_RULES.codePickMs);
    const ev = (await events(s)).find((e) => e.chest === "hack");
    assert.deepEqual([ev.type, ev.uid, ev.victimUid, ev.amount, ev.victimName], ["steal", "omar", "alma", 15, "Alma"]);
    assert.equal((await self(s, "omar")).hack, null);
  });

  it("test 5: målet väljer ny kod med ett klick; annars väljer servern efter ~10 s (även när någon försöker hacka)", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") });
    const { offers } = await self(s, "alma");
    const r = await pickCode(deps, "alma", { sid: s, index: 1 });
    assert.deepEqual([r.code, (await secret(s, "alma")).codeVersion], [offers[1], 2]);
    // Leo hackas, väljer inte – efter codePickMs väljer servern.
    await setGold(s, "leo", 200);
    await setCode(s, "leo", "r0b0t");
    await giveHack(s, "ines", 0);
    const t2 = await chooseTarget(deps, "ines", { sid: s, targetUid: "leo" });
    await guessCode(deps, "ines", { sid: s, index: rightIndex(t2.options, "r0b0t") });
    const leoOffers = (await self(s, "leo")).offers;
    ctl.clock += DK_RULES.codePickMs - 1;
    assert.equal((await pickCode(deps, "leo", { sid: s })).code, "r0b0t", "inom tiden: förslagen ligger kvar");
    ctl.clock += 1;
    const auto = await pickCode(deps, "leo", { sid: s });
    assert.equal(auto.auto, true);
    assert.ok(leoOffers.includes(auto.code));
  });

  it("test 6: fel kod → inget flyttas, 'Fel kod!' och koden stryks för just det paret", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    const wi = wrongIndex(t.options, "p4nnk4k4");
    const r = await guessCode(deps, "omar", { sid: s, index: wi });
    assert.deepEqual([r.result, r.code, r.left], ["wrong", t.options[wi], 2]);
    assert.deepEqual([(await gp(s, "alma")).gold, (await gp(s, "omar")).gold], [100, 0]);
    assert.equal((await gp(s, "alma")).protectedUntil, null, "inget skydd – inget hände Alma");
    assert.deepEqual((await secret(s, "omar")).hacks.alma.struck, [t.options[wi]]);
    assert.equal((await gp(s, "omar")).pending, null);
    assert.equal((await events(s)).filter((e) => e.chest === "hack").length, 0);
  });

  it("test 7: samma mål igen (efter ett annat) → samma koder minus den strukna, i ny ordning; efter två fel bara rätt kvar", async () => {
    const s = await setup({}, ["alma", "omar", "leo"]);
    await setGold(s, "leo", 100);
    await setCode(s, "leo", "r0b0t");
    const first = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    const w1 = first.options[wrongIndex(first.options, "p4nnk4k4")];
    await guessCode(deps, "omar", { sid: s, index: first.options.indexOf(w1) });
    // Inte samma mål två gånger i rad.
    await giveHack(s, "omar", 0, { lastVictimUid: "alma" });
    assert.equal(await code(chooseTarget(deps, "omar", { sid: s, targetUid: "alma" })), "failed-precondition");
    const leo = await chooseTarget(deps, "omar", { sid: s, targetUid: "leo" });
    await guessCode(deps, "omar", { sid: s, index: wrongIndex(leo.options, "r0b0t") });
    await giveHack(s, "omar", 0, { lastVictimUid: "leo" });
    const second = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    const expected = first.options.filter((c) => c !== w1);
    assert.deepEqual([...second.options].sort(), [...expected].sort(), "samma koder minus den strukna");
    assert.notDeepEqual(second.options, expected, "i ny ordning");
    const w2 = second.options[wrongIndex(second.options, "p4nnk4k4")];
    await guessCode(deps, "omar", { sid: s, index: second.options.indexOf(w2) });
    await giveHack(s, "omar", 0, { lastVictimUid: "leo" });
    const third = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    assert.deepEqual(third.options, ["p4nnk4k4"], "efter två fel finns bara rätt kod kvar");
    assert.equal((await guessCode(deps, "omar", { sid: s, index: 0 })).result, "hacked");
  });

  it("test 7: minnet gäller per par – Ines som hackar Alma har inga strukna", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await guessCode(deps, "omar", { sid: s, index: wrongIndex(t.options, "p4nnk4k4") });
    await giveHack(s, "ines", 0);
    assert.equal((await chooseTarget(deps, "ines", { sid: s, targetUid: "alma" })).options.length, 3);
  });

  it("test 8: målet byter kod → nästa hack har nya koder och inga strukna", async () => {
    const s = await setup({}, ["alma", "omar", "leo"]);
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await guessCode(deps, "omar", { sid: s, index: wrongIndex(t.options, "p4nnk4k4") });
    // Leo knäcker Almas kod → Alma väljer en ny.
    await giveHack(s, "leo", 0);
    const l = await chooseTarget(deps, "leo", { sid: s, targetUid: "alma" });
    await guessCode(deps, "leo", { sid: s, index: rightIndex(l.options, "p4nnk4k4") });
    const nyKod = (await pickCode(deps, "alma", { sid: s, index: 0 })).code;
    assert.notEqual(nyKod, "p4nnk4k4");
    ctl.clock += DK_RULES.protectionMs;
    await giveHack(s, "omar", 0, { lastVictimUid: "leo" });
    const again = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    assert.equal(again.options.length, 3, "inga strukna");
    assert.ok(again.options.includes(nyKod));
    assert.deepEqual((await secret(s, "omar")).hacks.alma.struck, []);
  });
});

describe("skydd och trygghet (test 9, §1.6)", () => {
  it("test 9: mål med brandvägg → nekas (manipulerat anrop också), valet ligger kvar; valbart när skyddet gått ut", async () => {
    const s = await setup();
    await setGold(s, "alma", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 4_000) });
    await assert.rejects(chooseTarget(deps, "omar", { sid: s, targetUid: "alma" }),
      (e) => e.code === "failed-precondition" && e.message === "🛡️ Alma hann starta en brandvägg!");
    assert.ok((await gp(s, "omar")).pending, "valet ligger kvar");
    ctl.clock += 4_000;
    assert.equal((await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" })).result, "target");
  });

  it("test 9: målet startar en brandvägg medan hackaren gissar → hacket stoppas, inget flyttas", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    ctl.roll = rngFor("brandvagg");
    ctl.clock += 2_000;
    await openFile(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), fileIndex: 0 });
    const r = await guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") });
    assert.equal(r.result, "protected");
    assert.equal((await gp(s, "alma")).gold, 100);
  });

  it("väljartiden ute → servern slumpar aldrig en skyddad, aldrig sig själv, aldrig någon med för lite data", async () => {
    const s = await setup({}, ["alma", "omar", "leo", "ines", "bo"]);
    await setGold(s, "alma", 300, { protectedUntil: Timestamp.fromMillis(ctl.clock + 60_000) });
    await setGold(s, "leo", 6); // 15 % av 6 < 1 MB
    await setGold(s, "ines", 100);
    await setCode(s, "ines", "r0b0t");
    for (const x of [0, 0.3, 0.6, 0.99]) {
      ctl.roll = x;
      await giveHack(s, "omar", 0, { lastVictimUid: null });
      const r = await chooseTarget(deps, "omar", { sid: s });
      assert.deepEqual([r.result, r.targetUid, r.auto], ["target", "ines", true], String(x));
      await guessCode(deps, "omar", { sid: s, index: null });
    }
  });

  it("ingen kan väljas → Hack-filens fallback (Mapp +25 MB)", async () => {
    const s = await setup();
    await setGold(s, "alma", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 60_000) });
    const r = await chooseTarget(deps, "omar", { sid: s, targetUid: null });
    assert.deepEqual([r.result, r.file, r.gold], ["fallback", "mapp", 25]);
    assert.ok((await events(s)).some((e) => e.chest === "mapp" && e.fallbackFrom === "hack"));
  });

  it("hack tar högst 15 % och aldrig allt", async () => {
    for (const [före, tagit] of [[1000, 150], [7, 1], [99, 14]]) {
      const s = await setup();
      await setGold(s, "alma", före);
      const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
      const r = await guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") });
      assert.deepEqual([r.amount, r.victimGold], [tagit, före - tagit]);
    }
  });

  it("gissningstiden ute (~10 s) → hacket misslyckas utan annan påföljd (ingen kod stryks)", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    ctl.clock += DK_RULES.codeGuessMs + DK_RULES.victimGraceMs + 1;
    const r = await guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") });
    assert.equal(r.result, "timeout");
    assert.equal((await gp(s, "alma")).gold, 100);
    assert.deepEqual((await secret(s, "omar")).hacks.alma.struck, []);
    assert.equal((await gp(s, "omar")).pending, null);
  });
});

describe("lockkoderna (test 12)", () => {
  it("ur listan, ungefär samma längd, aldrig någon spelares aktuella kod", async () => {
    const players = ["alma", "omar", ...Array.from({ length: 30 }, (_, i) => `e${i}`)];
    const s = await setup({}, players);
    const same = DK_CODES.filter((c) => c !== "p4nnk4k4" && Math.abs(c.length - 8) <= 1);
    const held = same.slice(0, 25); // nästan alla koder med liknande längd är tagna
    for (const [i, kod] of held.entries()) await setCode(s, `e${i}`, kod);
    for (const x of [0, 0.25, 0.5, 0.75, 0.99]) {
      ctl.roll = x;
      await giveHack(s, "omar", 0, { lastVictimUid: null });
      await db.doc(`liveSessions/${s}/dkSecret/omar`).set({ hacks: {} }, { merge: true });
      const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
      const decoys = t.options.filter((c) => c !== "p4nnk4k4");
      assert.equal(decoys.length, 2);
      for (const d of decoys) {
        assert.ok(DK_CODES.includes(d), `${d} ur listan`);
        assert.ok(!held.includes(d), `${d} är någons kod`);
        assert.ok(Math.abs(d.length - "p4nnk4k4".length) <= 2, `${d} ungefär samma längd`);
      }
      await guessCode(deps, "omar", { sid: s, index: null });
    }
  });

  it("en lockkod som senare blir någons kod byts ut innan den visas igen", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await guessCode(deps, "omar", { sid: s, index: null });
    const [lock] = t.options.filter((c) => c !== "p4nnk4k4");
    await setCode(s, "leo", lock);
    await giveHack(s, "omar", 0, { lastVictimUid: null });
    const again = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    assert.ok(!again.options.includes(lock));
    assert.equal(again.options.length, 3);
  });

  it("klienten kan inte se vilken kod som är rätt: inga extra fält, inga koder hos andra, rätt kod på alla platser", async () => {
    const s = await setup();
    ctl.rng = Math.random;
    const seen = new Set();
    for (let i = 0; i < 36; i++) {
      await giveHack(s, "omar", 0, { lastVictimUid: null });
      await db.doc(`liveSessions/${s}/dkSecret/omar`).set({ hacks: {} }, { merge: true });
      const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
      assert.deepEqual(Object.keys(t).sort(), ["auto", "expiresAtMs", "options", "result", "targetName", "targetUid"]);
      seen.add(t.options.indexOf("p4nnk4k4"));
      const mine = await self(s, "omar");
      assert.deepEqual(Object.keys(mine.hack).sort(), ["expiresAt", "options", "targetName", "targetUid"]);
      assert.equal("code" in (await gp(s, "omar")).pending, false);
      assert.ok(!JSON.stringify(await gp(s, "omar")).includes("p4nnk4k4"), "spelardokumentet (alla läser) har ingen kod");
      await guessCode(deps, "omar", { sid: s, index: null });
    }
    assert.deepEqual([...seen].sort(), [0, 1, 2], "rätt kod hamnar på alla platser");
  });
});

describe("attacker mot hacket (§2)", () => {
  it("gissa kod utan att ha fått ett Hack nekas", async () => {
    const s = await setup();
    await setGold(s, "leo", 0);
    assert.equal(await code(guessCode(deps, "leo", { sid: s, index: 0 })), "failed-precondition");
    assert.equal(await code(chooseTarget(deps, "leo", { sid: s, targetUid: "alma" })), "failed-precondition");
    assert.equal(await code(guessCode(deps, "omar", { sid: s, index: 0 })), "failed-precondition", "Hack men inget mål valt");
  });

  it("gissa kod mot ett annat mål än det som valdes nekas; byta mål efter valet nekas", async () => {
    const s = await setup();
    await setGold(s, "leo", 100);
    await setCode(s, "leo", "r0b0t");
    await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    assert.equal(await code(guessCode(deps, "omar", { sid: s, index: 0, targetUid: "leo" })), "permission-denied");
    assert.equal(await code(chooseTarget(deps, "omar", { sid: s, targetUid: "leo" })), "failed-precondition");
    assert.equal((await gp(s, "leo")).gold, 100);
  });

  it("gissa flera gånger på samma hackförsök nekas – en gissning per Hack", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await guessCode(deps, "omar", { sid: s, index: wrongIndex(t.options, "p4nnk4k4") });
    assert.equal(await code(guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") })), "failed-precondition");
    assert.equal((await gp(s, "alma")).gold, 100);
  });

  it("en kod som text i stället för ett index nekas (eleven kan inte pröva egna koder)", async () => {
    const s = await setup();
    await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    for (const index of ["p4nnk4k4", 3, -1, 0.5]) {
      assert.equal(await code(guessCode(deps, "omar", { sid: s, index })), "invalid-argument", String(index));
    }
    assert.ok((await gp(s, "omar")).pending, "hacket ligger kvar efter ett ogiltigt anrop");
  });

  it("hacka sig själv, någon som inte är med, eller efter att tiden tagit slut nekas", async () => {
    const s = await setup();
    assert.equal(await code(chooseTarget(deps, "omar", { sid: s, targetUid: "omar" })), "failed-precondition");
    assert.equal(await code(chooseTarget(deps, "omar", { sid: s, targetUid: "finnsinte" })), "not-found");
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    ctl.clock = Date.now() + 3_600_000;
    assert.equal(await code(guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") })), "failed-precondition");
    assert.equal((await gp(s, "alma")).gold, 100);
  });

  it("målets kod byts mellan valet och gissningen → hacket misslyckas, inget flyttas", async () => {
    const s = await setup();
    const t = await chooseTarget(deps, "omar", { sid: s, targetUid: "alma" });
    await setCode(s, "alma", "r0b0t", 2);
    const r = await guessCode(deps, "omar", { sid: s, index: rightIndex(t.options, "p4nnk4k4") });
    assert.equal(r.result, "changed");
    assert.equal((await gp(s, "alma")).gold, 100);
  });
});
