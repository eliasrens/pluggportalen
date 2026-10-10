// ============================================================================
// Guldrushen (#563): STÖLD OCH BYTE på servern (functions/guldrush-core.js
// chooseVictim) mot Firestore-emulatorn – styrd klocka och slump.
//   test 15  Alma 100 → 85, Omar +15 i SAMMA transaktion + händelse + notis
//   test 16  stöldskydd: bestulen nyss → nekas (även manipulerat), sedan ok;
//            inte samma offer två gånger i rad
//   test 17  byte bara med någon som har mer guld (manipulerat nekas)
//   test 18  stöld & byte av → kan aldrig komma; manipulerat väntande val →
//            vanlig guldkista
//   + sköld, slumpat offer, för sent, ingen att välja
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

  it("sköld stoppar nästa stöld och förbrukas; slumpat offer tar aldrig någon med sköld", async () => {
    const s = await makeSession();
    await setGold(s, "leo", 200, { shield: true });
    await setGold(s, "alma", 100);
    await setGold(s, "omar", 0, { pending: pending("steal") });
    const r = await chooseVictim(deps, "omar", { sid: s, victimUid: "leo" });
    assert.deepEqual([r.result, r.amount], ["blocked", 0]);
    const leo = await gp(s, "leo");
    assert.deepEqual([leo.gold, leo.shield, leo.lastHit.kind], [200, false, "blocked"]);
    assert.ok((await events(s)).some((e) => e.type === "shieldBlock" && e.victimUid === "leo"));
    // Slumpat: Leo har ny sköld → bara Alma kan väljas.
    await setGold(s, "leo", 200, { shield: true });
    await setGold(s, "omar", 0, { pending: pending("steal"), lastVictimUid: null });
    for (const x of [0, 0.5, 0.99]) {
      ctl.roll = x;
      await setGold(s, "omar", 0, { pending: pending("steal"), lastVictimUid: null });
      await setGold(s, "alma", 100, { protectedUntil: null });
      const auto = await chooseVictim(deps, "omar", { sid: s });
      assert.equal(auto.victimUid, "alma");
    }
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
