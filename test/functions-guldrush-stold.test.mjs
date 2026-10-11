// ============================================================================
// Guldrushen (#563): STÖLD OCH BYTE på servern (functions/guldrush-core.js
// chooseVictim) mot Firestore-emulatorn – styrd klocka och slump.
//   test 15  Alma 100 → 85, Omar +15 i SAMMA transaktion + händelse + notis
//   test 16  stöldskydd: bestulen nyss → nekas (även manipulerat), sedan ok;
//            inte samma offer två gånger i rad
//   test 17  byte bara med någon som har mer guld (manipulerat nekas)
//   test 18  stöld & byte av → kan aldrig komma; manipulerat väntande val →
//            vanlig guldkista
//   + slumpat offer, för sent, ingen att välja
//   #588 ETT tidsbegränsat skydd (spec DEL 3 test 1–8): Sköld 60 s (förlängs),
//   bestulen 30 s, skyddet prövas i valets ögonblick, slumpen bara bland
//   oskyddade, alla skyddade → guldkista, manipulerat anrop nekas
// Körs av `npm run test:functions`. Riggen: test/helpers/guldrush-core-rig.js.
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { openChest, chooseVictim } from "../functions/guldrush-core.js";
import { GR_CHESTS, GR_RULES } from "../src/live/formats/guldrush/delat/chests-config.js";
import {
  db, deps, ctl, Timestamp, reset, rngFor, makeSession, setGold, pending, gp, events, rightAnswer, code,
} from "./helpers/guldrush-core-rig.js";

beforeEach(reset);

describe("stöld och byte (test 15–18)", () => {
  it("test 15: Omar får Stöld och väljer Alma → Alma 85, Omar +15 i samma transaktion, händelse + notis", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "omar", 0);
    const id = await rightAnswer(s, "omar");
    ctl.roll = rngFor("stold");
    const opened = await openChest(deps, "omar", { sid: s, attemptId: id, chestIndex: 0 });
    assert.equal(opened.pending.kind, "steal");
    assert.equal((await gp(s, "omar")).pending.kind, "steal");
    const r = await chooseVictim(deps, "omar", { sid: s, victimUid: "alma" });
    assert.deepEqual([r.result, r.amount, r.gold, r.victimGold], ["steal", 15, 15, 85]);
    const [alma, omar] = [await gp(s, "alma"), await gp(s, "omar")];
    assert.equal(alma.gold, 85);
    assert.equal(omar.gold, 15);
    assert.equal(alma.gold + omar.gold, 100, "inget guld försvann eller dök upp");
    assert.equal(omar.pending, null);
    assert.equal(omar.lastVictimUid, "alma");
    assert.equal(alma.protectedUntil.toMillis(), ctl.clock + GR_RULES.protectionMs);
    assert.deepEqual([alma.lastHit.kind, alma.lastHit.byName, alma.lastHit.amount], ["steal", "Omar", 15]);
    const ev = (await events(s)).find((e) => e.type === "steal");
    assert.deepEqual([ev.uid, ev.victimUid, ev.amount, ev.name, ev.victimName], ["omar", "alma", 15, "Omar", "Alma"]);
    assert.ok(ev.at instanceof Timestamp);
  });

  it("test 16: Alma blev just bestulen → Leo kan inte välja henne (manipulerat anrop nekas), efter skyddet går det", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 85, { protectedUntil: Timestamp.fromMillis(ctl.clock + 20_000) });
    await setGold(s, "leo", 10, { pending: pending("steal") });
    assert.equal(await code(chooseVictim(deps, "leo", { sid: s, victimUid: "alma" })), "failed-precondition");
    assert.equal((await gp(s, "alma")).gold, 85);
    assert.ok((await gp(s, "leo")).pending, "valet ligger kvar – Leo kan välja någon annan");
    await db.doc(`liveSessions/${s}/grPlayers/leo`).update({ pending: pending("steal", "stold", ctl.clock + 20_000) });
    ctl.clock += 20_000;
    const r = await chooseVictim(deps, "leo", { sid: s, victimUid: "alma" });
    assert.deepEqual([r.result, r.amount], ["steal", 12]);
  });

  it("ingen stjäl från samma elev två gånger i rad; sig själv / okänd nekas", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "omar", 15, { lastVictimUid: "alma", pending: pending("steal") });
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })), "failed-precondition");
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "omar" })), "failed-precondition");
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "finnsinte" })), "not-found");
    assert.equal((await gp(s, "alma")).gold, 100);
  });

  it("test 17: Ines (minst guld) får Byte – bara med någon som har MER; manipulerat byte mot mindre nekas", async () => {
    const s = await makeSession();
    await setGold(s, "ines", 20, { pending: pending("swap") });
    await setGold(s, "bo", 10);
    await db.doc(`liveSessions/${s}/players/bo`).set({ uid: "bo", classId: "4b", name: "Bo" });
    await setGold(s, "alma", 90);
    assert.equal(await code(chooseVictim(deps, "ines", { sid: s, victimUid: "bo" })), "failed-precondition");
    assert.equal((await gp(s, "bo")).gold, 10);
    const r = await chooseVictim(deps, "ines", { sid: s, victimUid: "alma" });
    assert.deepEqual([r.result, r.gold, r.victimGold], ["swap", 90, 20]);
    assert.deepEqual([(await gp(s, "ines")).gold, (await gp(s, "alma")).gold], [90, 20]);
    assert.ok((await gp(s, "alma")).protectedUntil.toMillis() > ctl.clock, "den som blev bytt med får stöldskydd");
    assert.ok((await events(s)).some((e) => e.type === "swap" && e.uid === "ines" && e.victimUid === "alma"));
  });

  it("byte när ingen har mer guld → vanlig guldkista (slumpat/för sent)", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 500, { pending: pending("swap") });
    await setGold(s, "omar", 10);
    const r = await chooseVictim(deps, "alma", { sid: s, victimUid: null });
    assert.deepEqual([r.result, r.chest, r.delta], ["fallback", "guld", 25]);
    assert.equal((await gp(s, "alma")).gold, 525);
    assert.equal((await gp(s, "omar")).gold, 10);
    assert.ok((await events(s)).some((e) => e.type === "chest" && e.chest === "guld" && e.fallbackFrom === "byte"));
  });

  it("test 18: stöld & byte av → ingen kista kan bli stöld/byte; ett manipulerat väntande val ger bara guld", async () => {
    const s = await makeSession({ stealSwap: false });
    for (const id of ["stold", "byte"]) {
      for (const x of [0, 0.25, 0.5, 0.75, 0.999]) {
        ctl.roll = x;
        ctl.clock += 2_000;
        const r = await openChest(deps, "alma", { sid: s, attemptId: await rightAnswer(s, "alma"), chestIndex: 0 });
        assert.ok(!["steal", "swap"].includes(r.kind), `${id}/${x}`);
        assert.equal(r.pending, undefined);
      }
    }
    const victimIds = GR_CHESTS.filter((c) => ["steal", "swap"].includes(c.effect.kind)).map((c) => c.id);
    assert.deepEqual(victimIds.sort(), ["byte", "stold"]);
    await setGold(s, "omar", 0, { pending: pending("steal") });
    await setGold(s, "leo", 100);
    const r = await chooseVictim(deps, "omar", { sid: s, victimUid: "leo" });
    assert.equal(r.result, "fallback");
    assert.equal((await gp(s, "leo")).gold, 100, "ingen stöld när den är avstängd");
  });


  it("för sent (efter ~10 s): servern slumpar även om eleven skickar ett namn", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "leo", 100);
    await setGold(s, "omar", 0, { pending: pending("steal", "stold", ctl.clock - GR_RULES.victimPickMs - GR_RULES.victimGraceMs - 1) });
    ctl.roll = 0;
    const r = await chooseVictim(deps, "omar", { sid: s, victimUid: "leo" });
    assert.equal(r.result, "steal");
    assert.ok(["alma", "leo"].includes(r.victimUid));
    const ev = (await events(s)).find((e) => e.type === "steal");
    assert.equal(ev.auto, true);
  });

  it("inget väntande val → chooseVictim nekas (ingen gratis stöld)", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "omar", 0);
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })), "failed-precondition");
  });
});

describe("ETT tidsbegränsat skydd (#588, spec DEL 3 test 1–8)", () => {
  const sköld = async (s, uid) => {
    ctl.roll = rngFor("skold");
    ctl.clock += 2_000;
    return openChest(deps, uid, { sid: s, attemptId: await rightAnswer(s, uid), chestIndex: 1 });
  };
  const until = async (s, uid) => (await gp(s, uid)).protectedUntil?.toMillis() ?? null;

  it("test 1: Sköld-kistan → skyddad i 60 s, därefter inte; händelsen '🛡️ … är skyddad!'", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "omar", 0);
    const r = await sköld(s, "alma");
    const t = ctl.clock;
    assert.deepEqual([r.kind, r.protectedUntil], ["shield", t + 60_000]);
    assert.equal(await until(s, "alma"), t + 60_000);
    assert.equal("shield" in (await gp(s, "alma")), false, "inget separat sköld-fält");
    assert.ok((await events(s)).some((e) => e.type === "chest" && e.chest === "skold" && e.uid === "alma"));
    // Medan skyddet gäller: nekas. Vid 60 s: går.
    await setGold(s, "omar", 0, { pending: pending("steal", "stold", t + 59_000) });
    ctl.clock = t + 59_000;
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })), "failed-precondition");
    ctl.clock = t + 60_000;
    assert.equal((await chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })).result, "steal");
  });

  it("test 2: skyddad elev öppnar ny Sköld efter 40 s → 60 s från NU", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await sköld(s, "alma");
    const first = ctl.clock;
    ctl.clock = first + 40_000 - 2_000; // sköld() lägger på 2 s
    await sköld(s, "alma");
    assert.equal(ctl.clock, first + 40_000);
    assert.equal(await until(s, "alma"), first + 100_000);
  });

  it("test 3: Alma blir bestulen → skyddad i 30 s", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "omar", 0, { pending: pending("steal") });
    await chooseVictim(deps, "omar", { sid: s, victimUid: "alma" });
    assert.equal(await until(s, "alma"), ctl.clock + GR_RULES.protectionMs);
    assert.equal(GR_RULES.protectionMs, 30_000);
  });

  it("test 4: Alma skyddad 4 s till → tjuven väntar ut nedräkningen och väljer henne → går igenom", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 4_000) });
    await setGold(s, "omar", 0, { pending: pending("steal") });
    ctl.clock += 4_000; // inom väljartiden (10 s)
    const r = await chooseVictim(deps, "omar", { sid: s, victimUid: "alma" });
    assert.deepEqual([r.result, r.victimUid, r.amount], ["steal", "alma", 15]);
    assert.equal(r.gold, 15);
  });

  it("test 5: offret skaffar sköld under väljartiden → nekas 'hann skaffa en sköld', tjuven väljer om", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 100);
    await setGold(s, "leo", 80);
    await setGold(s, "omar", 0, { pending: pending("steal") });
    ctl.clock += 2_000;
    await sköld(s, "alma"); // offret öppnar Sköld medan Omar väljer
    ctl.clock += 1_000;
    await assert.rejects(chooseVictim(deps, "omar", { sid: s, victimUid: "alma" }),
      (e) => e.code === "failed-precondition" && e.message === "🛡️ Alma hann skaffa en sköld!");
    assert.ok((await gp(s, "omar")).pending, "valet ligger kvar");
    assert.equal((await gp(s, "alma")).gold, 100);
    const r = await chooseVictim(deps, "omar", { sid: s, victimUid: "leo" });
    assert.deepEqual([r.result, r.victimUid, r.amount], ["steal", "leo", 12]);
  });

  it("test 6: väljartiden går ut → servern slumpar aldrig fram en skyddad elev", async () => {
    const s = await makeSession({}, ["alma", "omar", "leo", "ines", "bo"]);
    await setGold(s, "alma", 300, { protectedUntil: Timestamp.fromMillis(ctl.clock + 60_000) });
    await setGold(s, "leo", 200, { protectedUntil: Timestamp.fromMillis(ctl.clock + 5_000) });
    await setGold(s, "ines", 100);
    await setGold(s, "bo", 90, { protectedUntil: Timestamp.fromMillis(ctl.clock + 30_000) });
    for (const x of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      ctl.roll = x;
      await setGold(s, "omar", 0, { pending: pending("steal"), lastVictimUid: null });
      await setGold(s, "ines", 100, { protectedUntil: null });
      const r = await chooseVictim(deps, "omar", { sid: s }); // null = tiden ute
      assert.deepEqual([r.result, r.victimUid], ["steal", "ines"], String(x));
    }
    // För sent med ett namn på en skyddad → slumpas bland oskyddade.
    await setGold(s, "omar", 0, { pending: pending("steal", "stold", ctl.clock - GR_RULES.victimPickMs - GR_RULES.victimGraceMs - 1), lastVictimUid: null });
    await setGold(s, "ines", 100, { protectedUntil: null });
    assert.equal((await chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })).victimUid, "ines");
  });

  it("test 7: alla kompisar skyddade → vanlig guldkista", async () => {
    const s = await makeSession();
    for (const uid of ["alma", "leo", "ines"]) await setGold(s, uid, 100, { protectedUntil: Timestamp.fromMillis(ctl.clock + 20_000) });
    await setGold(s, "omar", 10, { pending: pending("steal") });
    const r = await chooseVictim(deps, "omar", { sid: s });
    assert.deepEqual([r.result, r.chest, r.delta, r.gold], ["fallback", "guld", 25, 35]);
    for (const uid of ["alma", "leo", "ines"]) assert.equal((await gp(s, uid)).gold, 100);
    assert.ok((await events(s)).some((e) => e.type === "chest" && e.chest === "guld" && e.fallbackFrom === "stold"));
  });

  it("test 8: manipulerat anrop mot en skyddad elev nekas (stöld och byte)", async () => {
    const s = await makeSession();
    await setGold(s, "alma", 500, { protectedUntil: Timestamp.fromMillis(ctl.clock + 50_000) });
    await setGold(s, "omar", 10, { pending: pending("steal") });
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })), "failed-precondition");
    await setGold(s, "omar", 10, { pending: pending("swap") });
    assert.equal(await code(chooseVictim(deps, "omar", { sid: s, victimUid: "alma" })), "failed-precondition");
    assert.deepEqual([(await gp(s, "alma")).gold, (await gp(s, "omar")).gold], [500, 10]);
    // En gammal sköld-flagga (före #588) skyddar inte längre.
    await setGold(s, "leo", 200, { shield: true });
    await setGold(s, "omar", 10, { pending: pending("steal") });
    assert.equal((await chooseVictim(deps, "omar", { sid: s, victimUid: "leo" })).result, "steal");
  });
});
