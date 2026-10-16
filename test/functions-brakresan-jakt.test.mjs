// ============================================================================
// Bråkresan (#715 J): DAGLIG GULDJAKT – serverkärnan (functions/brakresan-jakt.js)
// direkt mot Firestore-emulatorn med styrd klocka och styrd slump.
// Spec §10 + §15 "Belöningar och gränsfall":
//
//   ägget kan inte jaga; nivå 1–15 → intervallet i §10 (min OCH max, inkl. 11 och 15)
//   en jaktpost + en bokföring + mynt EN gång; samma dag igen → samma fynd
//   evolution senare samma dag ger ingen extra jakt och ändrar inte intervallet
//   svensk midnatt, sommartid och vintertid (servertid); klientens fält ignoreras
//   samtidiga anrop (dubbelklick, två flikar, huset + Bråkresan) → en post, en överföring
//
// Egna uid:n (brj-*). `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { hunt, HUNT_STATUS } from "../functions/brakresan-jakt.js";
import { BrFel } from "../functions/brakresan-state.js";
import { huntMax } from "../functions/brakresan/schema/regler.js";
import { createBrRig } from "./helpers/brakresan-server-rig.js";

const rig = createBrRig("br-jakt");
const { db, ctl } = rig;
after(() => rig.app.delete());

const U = "brj-ella";
const utc = (s) => Date.parse(s);
const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof BrFel, `BrFel väntades, fick ${e?.stack || e}`);
    return e.code;
  }
  return "ok";
};

/** Styrd slump: "min" | "max" | null (äkta node:crypto). Loggar anropen. */
const slump = { lage: null, anrop: [] };
const deps = {
  ...rig.deps,
  randomInt: (min, maxExkl) => {
    slump.anrop.push([min, maxExkl]);
    if (slump.lage === "min") return min;
    if (slump.lage === "max") return maxExkl - 1;
    return Math.floor(Math.random() * (maxExkl - min)) + min;
  },
};
const aktaDeps = rig.deps; // node:crypto randomInt

async function elev(uid, totalStars, { coins = 100, dragon = totalStars >= 10 } = {}) {
  await db.recursiveDelete(db.doc(`studentData/${uid}`));
  await db.doc(`studentData/${uid}`).set({ coins });
  await db.doc(`studentData/${uid}/brakresa/state`).set({
    schema: 1, totalStars, mastered: 0, challenges: {}, encouragementCoins: 0,
    dragon: dragon ? { id: `drake-${uid}`, name: "Bråkis", levelShown: 1, hatchedAt: rig.Timestamp.fromMillis(0) } : null,
    hunts: { count: 0, coins: 0, lastDate: null },
  });
}
const huntsOf = async (uid) => (await db.collection(`studentData/${uid}/brakresaHunts`).get()).docs.map((d) => d.data());

beforeEach(async () => {
  await rig.rensa("brj-");
  ctl.clock = utc("2026-10-14T10:00:00Z");
  slump.lage = null;
  slump.anrop = [];
});

describe("vem kan jaga", () => {
  it("ägget (0 och 9 stjärnor) nekas och inget skrivs", async () => {
    for (const s of [0, 9]) {
      await elev(U, s);
      assert.equal(await code(hunt(deps, U)), "failed-precondition");
      assert.deepEqual(await huntsOf(U), []);
      assert.deepEqual(await rig.rewards(U), []);
      assert.equal(await rig.coins(U), 100);
    }
  });

  it("utan state-dokument (aldrig spelat) nekas", async () => {
    await db.recursiveDelete(db.doc(`studentData/${U}`));
    assert.equal(await code(hunt(deps, U)), "failed-precondition");
  });
});

describe("intervallet per nivå (§10)", () => {
  const TABELL = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200];

  it("nivå 1–15: slumpen anropas med 1..max inklusive, min = 1 och max nås", async () => {
    for (let level = 1; level <= 15; level++) {
      const max = TABELL[level - 1];
      assert.equal(huntMax(level), max);
      for (const lage of ["min", "max"]) {
        // Nivåns lägsta och högsta stjärnantal (nivå 15: 150 stjärnor).
        const stars = lage === "min" ? level * 10 : Math.min(150, level * 10 + 9);
        await elev(U, stars);
        slump.lage = lage;
        slump.anrop = [];
        const res = await hunt(deps, U);
        assert.deepEqual(slump.anrop, [[1, max + 1]], `nivå ${level}: randomInt(1, max+1)`);
        assert.deepEqual([res.level, res.max, res.amount], [level, max, lage === "min" ? 1 : max], `nivå ${level} ${lage}`);
        assert.equal(await rig.coins(U), 100 + res.amount);
      }
    }
  });

  it("äkta node:crypto: fynden är heltal inom 1..max (nivå 1 och 15, 25 dagar)", async () => {
    for (const [stars, max] of [[10, 10], [150, 200]]) {
      await elev(U, stars);
      const fynd = [];
      for (let d = 0; d < 25; d++) {
        ctl.clock = utc("2026-11-01T10:00:00Z") + d * 86_400_000;
        fynd.push((await hunt(aktaDeps, U)).amount);
      }
      assert.ok(fynd.every((a) => Number.isInteger(a) && a >= 1 && a <= max), fynd.join(","));
      const st = await rig.state(U);
      assert.deepEqual([st.hunts.count, st.hunts.coins], [25, fynd.reduce((a, b) => a + b, 0)]);
    }
  });
});

describe("en jakt per svensk kalenderdag", () => {
  it("jaktposten, bokföringen och myntet i samma transaktion; samma dag igen → samma fynd", async () => {
    await elev(U, 47, { coins: 30 });
    slump.lage = "max";
    const a = await hunt(deps, U);
    assert.deepEqual(
      [a.date, a.huntId, a.level, a.max, a.amount, a.coinsAfter, a.already],
      ["2026-10-14", "2026-10-14", 4, 40, 40, 70, false]);
    const post = (await db.doc(`studentData/${U}/brakresaHunts/2026-10-14`).get()).data();
    assert.deepEqual(
      { ...post, startedAt: post.startedAt.toMillis() },
      { huntId: "2026-10-14", date: "2026-10-14", studentId: U, dragonId: `drake-${U}`, startedAt: ctl.clock,
        level: 4, max: 40, amount: 40, rewardEventId: "jakt-2026-10-14", status: HUNT_STATUS });
    const bok = (await db.doc(`studentData/${U}/brakresaRewards/jakt-2026-10-14`).get()).data();
    assert.deepEqual([bok.type, bok.amount, bok.huntDate, bok.coinsAfter, bok.studentId], ["jakt", 40, "2026-10-14", 70, U]);
    const st = await rig.state(U);
    assert.deepEqual(st.hunts, { count: 1, coins: 40, lastDate: "2026-10-14", lastAmount: 40 });
    assert.equal(st.lastActivityAt.toMillis(), ctl.clock);

    // Omladdning / nätavbrott: samma post, ingen ny slump, inga nya mynt.
    slump.anrop = [];
    ctl.clock = utc("2026-10-14T21:59:59Z"); // 23:59:59 svensk tid, samma dag
    const b = await hunt(deps, U);
    assert.deepEqual([b.already, b.amount, b.date, b.coinsAfter], [true, 40, "2026-10-14", 70]);
    assert.deepEqual(slump.anrop, []);
    assert.equal(await rig.coins(U), 70);
    assert.deepEqual(await rig.rewards(U), ["jakt-2026-10-14"]);
  });

  it("evolution senare samma dag ger ingen extra jakt; intervallet låstes vid starten", async () => {
    await elev(U, 19);
    slump.lage = "max";
    const a = await hunt(deps, U);
    assert.deepEqual([a.level, a.max, a.amount], [1, 10, 10]);
    await db.doc(`studentData/${U}/brakresa/state`).update({ totalStars: 20 }); // nivå 2
    const b = await hunt(deps, U);
    assert.deepEqual([b.already, b.level, b.max, b.amount], [true, 1, 10, 10]);
    assert.equal(await rig.coins(U), 110);
    // Nästa dag gäller den nya nivån.
    ctl.clock = utc("2026-10-15T10:00:00Z");
    const c = await hunt(deps, U);
    assert.deepEqual([c.already, c.level, c.max], [false, 2, 20]);
  });

  it("precis före och precis efter svensk midnatt = två giltiga jakter (avsiktlig policy)", async () => {
    await elev(U, 30);
    ctl.clock = utc("2026-10-14T21:59:59Z"); // 23:59:59 CEST
    const a = await hunt(deps, U);
    ctl.clock = utc("2026-10-14T22:00:00Z"); // 00:00:00 CEST
    const b = await hunt(deps, U);
    assert.deepEqual([a.date, a.already, b.date, b.already], ["2026-10-14", false, "2026-10-15", false]);
    assert.deepEqual(await rig.rewards(U), ["jakt-2026-10-14", "jakt-2026-10-15"]);
    assert.equal((await rig.state(U)).hunts.count, 2);
  });

  it("vintertid: midnatt 23:00 UTC; inte 24 timmar efter förra jakten", async () => {
    await elev(U, 30);
    ctl.clock = utc("2026-01-14T22:59:59Z"); // 23:59:59 CET
    assert.equal((await hunt(deps, U)).date, "2026-01-14");
    ctl.clock = utc("2026-01-14T23:00:00Z"); // 00:00 CET – en sekund senare, ny dag
    assert.deepEqual(pick(await hunt(deps, U)), ["2026-01-15", false]);
    ctl.clock = utc("2026-01-15T22:30:00Z"); // 23:30 samma svenska dag
    assert.deepEqual(pick(await hunt(deps, U)), ["2026-01-15", true]);
  });

  it("sommartidens början (29 mars 2026, 23-timmarsdygn)", async () => {
    await elev(U, 30);
    const steg = [
      ["2026-03-28T22:59:00Z", "2026-03-28", false], // 23:59 CET
      ["2026-03-28T23:00:00Z", "2026-03-29", false], // 00:00 CET
      ["2026-03-29T01:30:00Z", "2026-03-29", true], // 03:30 CEST (02–03 finns inte)
      ["2026-03-29T21:59:00Z", "2026-03-29", true], // 23:59 CEST
      ["2026-03-29T22:00:00Z", "2026-03-30", false], // 00:00 CEST
    ];
    for (const [t, date, already] of steg) {
      ctl.clock = utc(t);
      assert.deepEqual(pick(await hunt(deps, U)), [date, already], t);
    }
  });

  it("vintertidens början (25 oktober 2026, 25-timmarsdygn)", async () => {
    await elev(U, 30);
    const steg = [
      ["2026-10-24T21:59:00Z", "2026-10-24", false], // 23:59 CEST
      ["2026-10-24T22:00:00Z", "2026-10-25", false], // 00:00 CEST
      ["2026-10-25T00:30:00Z", "2026-10-25", true], // 02:30 CEST (första gången)
      ["2026-10-25T01:30:00Z", "2026-10-25", true], // 02:30 CET (andra gången)
      ["2026-10-25T22:59:00Z", "2026-10-25", true], // 23:59 CET
      ["2026-10-25T23:00:00Z", "2026-10-26", false], // 00:00 CET
    ];
    for (const [t, date, already] of steg) {
      ctl.clock = utc(t);
      assert.deepEqual(pick(await hunt(deps, U)), [date, already], t);
    }
    assert.equal((await rig.state(U)).hunts.count, 3);
  });

  it("klientens klocka och fält påverkar inget – bara serverns tid", async () => {
    await elev(U, 30);
    slump.lage = "min";
    // Kärnan tar inga data alls; callable-lagret skickar aldrig vidare request.data.
    const res = await hunt(deps, U, { date: "2030-01-01", now: utc("2030-01-01T10:00:00Z"), amount: 200, level: 15 });
    assert.deepEqual([res.date, res.level, res.amount], ["2026-10-14", 3, 1]);
    assert.deepEqual(await rig.rewards(U), ["jakt-2026-10-14"]);
  });

  it("bokföringen finns redan men jaktposten saknas → posten återskapas, inget betalas igen", async () => {
    await elev(U, 30, { coins: 77 });
    await db.doc(`studentData/${U}/brakresaRewards/jakt-2026-10-14`).set({ eventId: "jakt-2026-10-14", type: "jakt", amount: 12 });
    const res = await hunt(deps, U);
    assert.deepEqual([res.amount, res.coinsAfter, res.already], [12, 77, false]);
    assert.equal(await rig.coins(U), 77);
    assert.equal((await huntsOf(U))[0].amount, 12);
  });
});

describe("samtidighet", () => {
  it("åtta samtidiga anrop (dubbelklick, två flikar, huset + Bråkresan) → en post och en överföring", async () => {
    await elev(U, 150, { coins: 0 });
    const svar = await Promise.all(Array.from({ length: 8 }, () => hunt(aktaDeps, U)));
    const fynd = new Set(svar.map((s) => s.amount));
    assert.equal(fynd.size, 1, "alla ser samma fynd");
    assert.equal(svar.filter((s) => !s.already).length, 1, "exakt en skapade jakten");
    const [amount] = fynd;
    assert.equal(await rig.coins(U), amount);
    assert.equal((await huntsOf(U)).length, 1);
    assert.deepEqual(await rig.rewards(U), ["jakt-2026-10-14"]);
    const st = await rig.state(U);
    assert.deepEqual([st.hunts.count, st.hunts.coins], [1, amount]);
  });

  it("två elever samma dag påverkar inte varandra", async () => {
    await elev(U, 30);
    await elev("brj-otto", 30);
    await Promise.all([hunt(deps, U), hunt(deps, "brj-otto")]);
    assert.deepEqual([(await huntsOf(U)).length, (await huntsOf("brj-otto")).length], [1, 1]);
  });
});

function pick(res) {
  return [res.date, res.already];
}
