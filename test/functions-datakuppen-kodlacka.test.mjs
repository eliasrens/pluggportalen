// ============================================================================
// Datakuppen – KODEN LÄCKER och KODBYTET på servern (#832, uppdraget
// datakuppen-klassradet.md §6–§7, test 20–25 + kantfall §7.1–7.3, §7.6) mot
// Firestore-emulatorn, styrd klocka och slump. Test 26 (kodbyte efter hack)
// ligger i functions-datakuppen-hack.test.mjs, test 27 (eleven läser
// läckräknaren) i firestore-rules-live-datakuppen.test.js.
// Körs av `npm run test:functions`. Riggen: test/helpers/datakuppen-core-rig.js.
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { chooseTarget, guessCode, pickCode } from "../functions/datakuppen-core.js";
import { DK_RULES } from "../src/live/formats/datakuppen/delat/files-config.js";
import { deps, ctl, db, Timestamp, reset, makeSession, setGold, setCode, giveHack, gp, self, secret } from "./helpers/datakuppen-core-rig.js";

beforeEach(reset);

const KOD = "p4nnk4k4";
const names = (n) => ["alma", ...Array.from({ length: n - 1 }, (_, i) => `elev${String(i + 1).padStart(2, "0")}`)];
const stats = async (s) => (await db.doc(`liveSessions/${s}/dkPrivate/stats`).get()).data() || {};

async function session(n) {
  const players = names(n);
  const s = await makeSession({}, players);
  await setGold(s, "alma", 500);
  await setCode(s, "alma", KOD);
  return { s, players };
}

/** Ett hackförsök mot Alma med en FEL kod (en som inte strukits). */
async function wrongGuess(s, uid) {
  await giveHack(s, uid, 0, { lastVictimUid: null });
  const t = await chooseTarget(deps, uid, { sid: s, targetUid: "alma" });
  const kod = (await secret(s, "alma")).code;
  return guessCode(deps, uid, { sid: s, index: t.options.findIndex((c) => c !== kod) });
}

/** Hackaren stryker båda lockkoderna → bara Almas rätta kod kvar i hens minne. */
async function figureOut(s, uid) {
  await wrongGuess(s, uid);
  await wrongGuess(s, uid);
  ctl.clock += 1_000;
}

const leaked = async (s) => (await self(s, "alma")).kodbyte?.orsak === "lacka";

describe("koden läcker (test 20–24, §6)", () => {
  it("test 20: 25 elever – notisen kommer efter den femte kompisen, inte före", async () => {
    const { s, players } = await session(25);
    for (const uid of players.slice(1, 5)) await figureOut(s, uid);
    assert.equal(await leaked(s), false, "fyra räcker inte");
    assert.equal((await self(s, "alma")).offers ?? null, null);
    await figureOut(s, players[5]);
    const me = await self(s, "alma");
    assert.equal(await leaked(s), true);
    assert.equal(me.offers.length, DK_RULES.codeOffers);
    assert.equal(me.offersExpiresAt.toMillis(), ctl.clock - 1_000 + DK_RULES.codePickMs);
    assert.equal(me.code, KOD, "koden byts först när Alma väljer");
    assert.equal(me.kodKannsAv, undefined, "eleven ser aldrig räknaren");
    assert.equal((await stats(s)).kodlackor, 1);
    const alma = await gp(s, "alma");
    assert.deepEqual([alma.gold, alma.protectedUntil], [500, null], "ingen data flyttas, inget extra skydd");
  });

  it("test 21: samma kompis kommer fram till koden två gånger → räknas en gång", async () => {
    const { s, players } = await session(25);
    await figureOut(s, players[1]);
    // Samma kompis listar ut samma kod en gång till (minnet nollat för testet).
    await db.doc(`liveSessions/${s}/dkSecret/${players[1]}`).update({ hacks: {} });
    await figureOut(s, players[1]);
    await figureOut(s, players[2]);
    assert.deepEqual((await secret(s, "alma")).kodKannsAv, [players[1], players[2]]);
  });

  it("test 22: ett lyckat hack räknas inte (och efter hacket byts koden ändå)", async () => {
    const { s, players } = await session(25);
    await giveHack(s, players[1], 0, { lastVictimUid: null });
    const t = await chooseTarget(deps, players[1], { sid: s, targetUid: "alma" });
    const r = await guessCode(deps, players[1], { sid: s, index: t.options.indexOf(KOD) });
    assert.equal(r.result, "hacked");
    assert.deepEqual((await secret(s, "alma")).kodKannsAv ?? [], []);
    assert.equal((await self(s, "alma")).kodbyte.orsak, "hack");
  });

  it("test 23: efter kodbytet är kodKannsAv tom och alla har ett nytt minnesmoment mot eleven", async () => {
    const { s, players } = await session(10);
    for (const uid of players.slice(1, 4)) await figureOut(s, uid);
    assert.equal(await leaked(s), true);
    const ny = (await pickCode(deps, "alma", { sid: s, index: 1 })).code;
    const sec = await secret(s, "alma");
    assert.deepEqual([sec.code, sec.kodKannsAv, sec.offers, sec.codeVersion], [ny, [], null, 2]);
    assert.equal((await self(s, "alma")).kodbyte, null);
    await giveHack(s, players[1], 0, { lastVictimUid: null });
    const t = await chooseTarget(deps, players[1], { sid: s, targetUid: "alma" });
    assert.equal(t.options.length, 3, "inga strukna mot den nya koden");
    assert.ok(t.options.includes(ny));
    assert.deepEqual((await secret(s, players[1])).hacks.alma.struck, []);
  });

  it("test 24: 10 elever → gränsen är 3", async () => {
    const { s, players } = await session(10);
    await figureOut(s, players[1]);
    await figureOut(s, players[2]);
    assert.equal(await leaked(s), false);
    await figureOut(s, players[3]);
    assert.equal(await leaked(s), true);
  });

  it("test 25: den nya koden är aldrig en tidigare egen kod eller någon annans nuvarande kod", async () => {
    const { s, players } = await session(10);
    const others = [];
    for (const [i, uid] of players.slice(1).entries()) {
      const k = (await import("../functions/datakuppen-core.js")).DK_CODES[i + 10];
      await setCode(s, uid, k);
      others.push(k);
    }
    const used = [KOD];
    for (let round = 0; round < 4; round++) {
      await setGold(s, "alma", 500);
      for (const uid of players.slice(1, 4)) await figureOut(s, uid);
      const offers = (await self(s, "alma")).offers;
      for (const c of offers) {
        assert.ok(!used.includes(c), `${c} var en tidigare egen kod`);
        assert.ok(!others.includes(c), `${c} är någon annans kod`);
      }
      used.push((await pickCode(deps, "alma", { sid: s, index: round % 4 })).code);
      ctl.clock += 1_000;
    }
    assert.deepEqual((await secret(s, "alma")).tidigareKoder, used.slice(0, -1));
  });
});

describe("kantfall (§7.1–7.3, §7.6)", () => {
  it("§7.1: läcka medan eleven redan väljer ny kod efter ett hack → ingen ny notis, räknaren nollas vid valet", async () => {
    const { s, players } = await session(10);
    await figureOut(s, players[1]);
    await figureOut(s, players[2]);
    // Alma väljer redan ny kod efter ett hack (skyddet efter hacket är slut).
    const offers = ["k0dett", "k0dtva", "k0dtre", "k0dfyr"];
    await setCode(s, "alma", KOD, 1, {
      offers, offersExpiresAt: Timestamp.fromMillis(ctl.clock + 60_000), kodbyte: { orsak: "hack" },
    });
    // Gamla koden gäller tills Alma väljer: en tredje kompis listar ut den.
    await figureOut(s, players[3]);
    const me = await self(s, "alma");
    assert.deepEqual([me.kodbyte.orsak, me.offers], ["hack", offers], "samma kort, ingen läck-notis");
    await pickCode(deps, "alma", { sid: s, index: 0 });
    assert.deepEqual((await secret(s, "alma")).kodKannsAv, []);
  });

  it("§7.2: hackad medan eleven väljer ny kod efter en läcka → hacket gäller den aktiva koden, ett enda kodkort", async () => {
    const { s, players } = await session(10);
    for (const uid of players.slice(1, 4)) await figureOut(s, uid);
    const offers = (await self(s, "alma")).offers;
    await giveHack(s, players[5], 0, { lastVictimUid: null });
    const t = await chooseTarget(deps, players[5], { sid: s, targetUid: "alma" });
    assert.ok(t.options.includes(KOD), "den aktiva koden är fortfarande den gamla");
    assert.equal((await guessCode(deps, players[5], { sid: s, index: t.options.indexOf(KOD) })).result, "hacked");
    const me = await self(s, "alma");
    assert.deepEqual([me.kodbyte.orsak, me.offers], ["lacka", offers], "inga nya förslag – ett kort");
  });

  it("§7.3: målet byter kod mitt i ett hack → avbrutet, inga koder stryks, hacket ligger kvar", async () => {
    const { s, players } = await session(10);
    await setGold(s, players[2], 100);
    await giveHack(s, players[1], 0, { lastVictimUid: null });
    const t = await chooseTarget(deps, players[1], { sid: s, targetUid: "alma" });
    await setCode(s, "alma", "r0b0t1", 2);
    const r = await guessCode(deps, players[1], { sid: s, index: t.options.findIndex((c) => c !== KOD) });
    assert.deepEqual([r.result, r.back, r.message], ["changed", true, "Alma bytte kod precis! Välj igen."]);
    assert.deepEqual((await secret(s, players[1])).hacks.alma.struck, []);
    assert.equal((await gp(s, players[1])).pending.chest, "hack");
    // Samma mål går att välja igen direkt.
    assert.equal((await chooseTarget(deps, players[1], { sid: s, targetUid: "alma" })).result, "target");
  });

  it("§7.6: hackning av → inget hack, ingen läckräknare", async () => {
    const { s, players } = await session(10);
    await db.doc(`liveSessions/${s}`).update({ hacking: false });
    await giveHack(s, players[1], 0, { lastVictimUid: null });
    const r = await chooseTarget(deps, players[1], { sid: s, targetUid: "alma" });
    assert.equal(r.result, "fallback");
    assert.equal((await secret(s, "alma")).kodKannsAv, undefined);
  });
});
