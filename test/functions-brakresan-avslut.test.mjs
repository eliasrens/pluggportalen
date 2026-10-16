// ============================================================================
// Bråkresan (#708): AVSLUT OCH BELÖNING (functions/brakresan-avslut.js) mot
// Firestore-emulatorn – spec §15 "Belöningar och gränsfall" (utom jakt, #715):
//
//   7/10 ingen stjärna; 8/10 en; 10/10 fortfarande en
//   två/tre godkända → två/tre stjärnor; fjärde → repetition, inga mynt
//   6–7 rätt → 10 uppmuntransmynt EN gång per utmaning, aldrig efter bemästring
//   dubbla avslut (dubbelklick, omladdning, två flikar) → en utbetalning
//   två omgångar tävlar om tredje stjärnan → transaktionen avgör ordinalen
//   bokföringen finns redan → inget betalas igen
//   draktrösklar 0, 9, 10, 19, 20, 149, 150 (kläckning, nivåbyten); namn och drak-id bevaras
//   namnbyte (#713): servern rensar texten, ägget kan inte döpas, placeringen orörd
//   full progression: exakt 150 stjärnor och 6 000 stjärnmynt
// ============================================================================

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { startRound, answerTask, finishRound, ackDragon, renameDragon, BrFel } from "../functions/brakresan-core.js";
import { CHALLENGE_IDS } from "../functions/brakresan/schema/katalog.js";
import { dragonLevel } from "../functions/brakresan/schema/regler.js";
import { createBrRig } from "./helpers/brakresan-server-rig.js";

const rig = createBrRig("br-avslut");
const { deps, db } = rig;
after(() => rig.app.delete());

const U = "brk-otto";
const START = 100;
const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof BrFel, `BrFel väntades, fick ${e?.stack || e}`);
    return e.code;
  }
  return "ok";
};

/** Starta en omgång och svara `ratt` rätt av tio. Returnerar roundId (inte avslutad). */
async function besvara(id, ratt, uid = U) {
  const { roundId } = await startRound(deps, uid, { challengeId: id });
  for (let i = 0; i < 10; i++) await answerTask(deps, uid, { roundId, index: i, answer: await rig.svar(roundId, i, i < ratt) });
  return roundId;
}
const spela = async (id, ratt, uid = U) => finishRound(deps, uid, { roundId: await besvara(id, ratt, uid) });

/** State med `stars` stjärnor per utmaning (utan att spela). */
async function seedState(starsById, extra = {}) {
  const challenges = Object.fromEntries(Object.entries(starsById).map(([id, stars]) => [id, { stars, starRounds: [], encouragementPaid: false }]));
  const total = Object.values(starsById).reduce((a, b) => a + b, 0);
  await db.doc(`studentData/${U}/brakresa/state`).set({
    schema: 1, totalStars: total, mastered: Object.values(starsById).filter((s) => s === 3).length, challenges,
    encouragementCoins: 0, dragon: null, ...extra,
  });
}

beforeEach(async () => {
  await rig.rensa("brk-");
  rig.ctl.challenges = {};
  for (const id of CHALLENGE_IDS) rig.useChallenge(id);
  await db.doc(`studentData/${U}`).set({ coins: START });
});

describe("stjärnor och uppmuntran", () => {
  it("7/10 ger ingen stjärna men 10 uppmuntransmynt – en gång per utmaning", async () => {
    const a = await spela("03", 7);
    assert.equal(a.correctCount, 7);
    assert.deepEqual([a.reward.kind, a.reward.coins, a.reward.eventId], ["uppmuntran", 10, "uppmuntran-03"]);
    assert.equal(a.rewardText, "10 mynt för ditt arbete");
    assert.match(a.message, /Du fick 7 av 10 rätt\. Ett rätt till behövs för en stjärna/);
    assert.equal(a.coinsAfter, START + 10);
    const b = await spela("03", 6);
    assert.deepEqual([b.reward.kind, b.reward.coins], ["ingen", 0]);
    assert.equal(b.rewardText, null);
    const c = await spela("03", 5);
    assert.equal(c.reward.kind, "ingen");
    assert.match(c.message, /Bra att du tränade/);
    assert.equal(await rig.coins(U), START + 10);
    const st = await rig.state(U);
    assert.equal(st.encouragementCoins, 10);
    assert.equal(st.challenges["03"].encouragementPaid, true);
    assert.equal(st.challenges["03"].stars, 0);
    assert.deepEqual([st.challenges["03"].best, st.challenges["03"].last, st.challenges["03"].roundsCompleted], [7, 5, 3]);
    // Uppmuntran gäller per utmaning – en annan utmaning kan ge sin egen.
    assert.equal((await spela("04", 6)).reward.kind, "uppmuntran");
  });

  it("8/10 en stjärna, 10/10 fortfarande en; tre stjärnor = bemästrad; fjärde = repetition utan mynt", async () => {
    const a = await spela("03", 8);
    assert.deepEqual([a.reward.kind, a.reward.starOrdinal, a.reward.coins, a.stars, a.totalStars], ["stjarna", 1, 40, 1, 1]);
    assert.equal(a.rewardText, "Ny stjärna! +40 mynt");
    assert.match(a.message, /Du klarade omgången! 8 av 10 rätt/);
    const b = await spela("03", 10);
    assert.deepEqual([b.reward.starOrdinal, b.stars], [2, 2]);
    const c = await spela("03", 9);
    assert.deepEqual([c.reward.starOrdinal, c.stars], [3, 3]);
    const rid = await besvara("03", 10);
    assert.equal((await rig.round(U, rid)).mode, "repetition");
    const d = await finishRound(deps, U, { roundId: rid });
    assert.deepEqual([d.reward.kind, d.reward.coins, d.stars], ["repetition", 0, 3]);
    assert.match(d.message, /Repetition – du har redan alla tre stjärnor/);
    const e = await spela("03", 7);
    assert.equal(e.reward.kind, "repetition", "ingen uppmuntran efter bemästring");
    assert.equal(await rig.coins(U), START + 120);
    assert.deepEqual(await rig.rewards(U), ["stjarna-03-1", "stjarna-03-2", "stjarna-03-3"]);
    const st = await rig.state(U);
    assert.deepEqual([st.totalStars, st.mastered, st.challenges["03"].starRounds.length], [3, 1, 3]);
    const bok = (await db.doc(`studentData/${U}/brakresaRewards/stjarna-03-2`).get()).data();
    assert.deepEqual([bok.type, bok.amount, bok.starOrdinal, bok.studentId, bok.coinsAfter], ["stjarna", 40, 2, U, START + 80]);
  });

  it("dubbelklick, omladdning och två flikar på avslutet → en utbetalning, samma svar", async () => {
    const roundId = await besvara("03", 8);
    const [a, b] = await Promise.all([finishRound(deps, U, { roundId }), finishRound(deps, U, { roundId })]);
    assert.deepEqual([a.already, b.already].sort(), [false, true]);
    const c = await finishRound(deps, U, { roundId });
    assert.equal(c.already, true);
    for (const x of [a, b, c]) assert.deepEqual([x.reward.kind, x.reward.starOrdinal, x.coinsAfter], ["stjarna", 1, START + 40]);
    assert.equal(await rig.coins(U), START + 40);
    assert.equal((await rig.state(U)).challenges["03"].roundsCompleted, 1);
  });

  it("två omgångar tävlar om tredje stjärnan → en stjärna 3, den andra repetition", async () => {
    await seedState({ "03": 2 });
    const r1 = await besvara("03", 10);
    // Konstruera en andra aktiv omgång (som om två flikar hunnit starta).
    await db.doc(`studentData/${U}/brakresa/state`).update({ "challenges.03.activeRoundId": null });
    const r2 = await besvara("03", 9);
    assert.notEqual(r1, r2);
    const [a, b] = await Promise.all([finishRound(deps, U, { roundId: r1 }), finishRound(deps, U, { roundId: r2 })]);
    assert.deepEqual([a.reward.kind, b.reward.kind].sort(), ["repetition", "stjarna"]);
    assert.equal([a, b].find((x) => x.reward.kind === "stjarna").reward.starOrdinal, 3);
    assert.equal(await rig.coins(U), START + 40);
    assert.deepEqual(await rig.rewards(U), ["stjarna-03-3"]);
    assert.equal((await rig.state(U)).challenges["03"].stars, 3);
  });

  it("finns bokföringen redan (state ur fas) betalas inget igen", async () => {
    await db.doc(`studentData/${U}/brakresaRewards/stjarna-03-1`).set({ eventId: "stjarna-03-1", amount: 40 });
    await db.doc(`studentData/${U}/brakresaRewards/uppmuntran-04`).set({ eventId: "uppmuntran-04", amount: 10 });
    const a = await spela("03", 8);
    assert.deepEqual([a.reward.kind, a.reward.coins, a.stars], ["stjarna", 0, 1]);
    const b = await spela("04", 6);
    assert.deepEqual([b.reward.kind, b.reward.coins], ["uppmuntran", 0]);
    assert.equal(await rig.coins(U), START);
    assert.equal((await rig.state(U)).challenges["04"].encouragementPaid, true);
  });
});

describe("Bråkdraken", () => {
  it("9 → 10 stjärnor kläcker draken EN gång; ackDragon visar högst aktuell nivå", async () => {
    await seedState({ "01": 3, "02": 3, "05": 3 });
    assert.equal(await code(ackDragon(deps, U, { level: 1 })), "failed-precondition", "ägget har ingen drake att visa");
    const a = await spela("03", 8);
    assert.deepEqual(a.dragon, { levelBefore: 0, levelAfter: 1, hatched: true });
    const st = await rig.state(U);
    assert.equal(st.totalStars, 10);
    assert.equal(st.dragon.id, `drake-${U}`);
    assert.equal(st.dragon.levelShown, 0);
    assert.equal(st.dragon.name, "Bråkis", "standardnamnet sätts vid kläckningen (#713)");
    assert.deepEqual((await db.doc(`studentData/${U}`).get()).data().brakdrake, { id: `drake-${U}`, level: 1, name: "Bråkis" });
    assert.deepEqual(await ackDragon(deps, U, { level: 5 }), { levelShown: 1 });
    assert.deepEqual(await ackDragon(deps, U, { level: 0 }), { levelShown: 1 }, "sjunker aldrig");
    assert.equal(await code(ackDragon(deps, U, { level: 16 })), "invalid-argument");
    const b = await spela("03", 8);
    assert.equal(b.dragon.hatched, false);
    assert.equal((await rig.state(U)).dragon.hatchedAt.toMillis(), st.dragon.hatchedAt.toMillis());
  });

  it("19 → 20 höjer nivån; namn, plats och drak-id bevaras", async () => {
    const stars = { "01": 3, "02": 3, "04": 3, "05": 3, "06": 3, "07": 3, "08": 1 };
    await seedState(stars, { dragon: { id: `drake-${U}`, hatchedAt: rig.Timestamp.fromMillis(1), levelShown: 1 } });
    await db.doc(`studentData/${U}`).set({ coins: START, brakdrake: { id: `drake-${U}`, level: 1, name: "Glöd", pos: { x: 3, y: 4 }, room: "rum1" } });
    const a = await spela("03", 8);
    assert.deepEqual(a.dragon, { levelBefore: 1, levelAfter: 2, hatched: false });
    const d = (await db.doc(`studentData/${U}`).get()).data().brakdrake;
    assert.deepEqual(d, { id: `drake-${U}`, level: 2, name: "Glöd", pos: { x: 3, y: 4 }, room: "rum1" });
  });

  it("149 → 150: nivå 15, 50 bemästrade, sedan bara repetition", async () => {
    const stars = Object.fromEntries(CHALLENGE_IDS.map((id) => [id, id === "50" ? 2 : 3]));
    await seedState(stars, { dragon: { id: `drake-${U}`, hatchedAt: rig.Timestamp.fromMillis(1), levelShown: 14 } });
    const a = await spela("50", 8);
    assert.deepEqual([a.totalStars, a.dragon.levelBefore, a.dragon.levelAfter], [150, 14, 15]);
    const b = await spela("50", 10);
    assert.deepEqual([b.reward.kind, b.totalStars], ["repetition", 150]);
    const st = await rig.state(U);
    assert.deepEqual([st.totalStars, st.mastered], [150, 50]);
  });

  it("trösklarna 0 och 9: inget ägg kläcks, ingen drakpost skapas (#713)", async () => {
    const a = await spela("03", 7);
    assert.deepEqual([a.totalStars, a.dragon.levelAfter, a.dragon.hatched], [0, 0, false]);
    assert.equal((await rig.state(U)).dragon, null);
    await seedState({ "01": 3, "02": 3, "05": 2 });
    const b = await spela("03", 5);
    assert.deepEqual([b.totalStars, b.dragon.levelAfter, b.dragon.hatched], [8, 0, false]);
    const c = await spela("03", 9);
    assert.deepEqual([c.totalStars, c.dragon.levelAfter, c.dragon.hatched], [9, 0, false]);
    assert.equal((await rig.state(U)).dragon, null);
    assert.equal((await db.doc(`studentData/${U}`).get()).data().brakdrake, undefined);
    assert.equal(await code(renameDragon(deps, U, { name: "Glöd" })), "failed-precondition", "ägget kan inte döpas");
  });

  it("10 → 19: samma drake, nivå 1 hela vägen; kläckningen sker inte igen", async () => {
    await seedState({ "01": 3, "02": 3, "05": 3 });
    await spela("03", 8);
    const id = (await rig.state(U)).dragon.id;
    for (const ch of ["04", "06", "07"]) {
      for (let k = 0; k < 3; k++) {
        const r = await spela(ch, 8);
        if (r.totalStars < 20) assert.deepEqual([r.dragon.levelAfter, r.dragon.hatched], [1, false]);
      }
    }
    const st = await rig.state(U);
    assert.deepEqual([st.totalStars, st.dragon.id, dragonLevel(st.totalStars)], [19, id, 1]);
  });

  it("ett namn som redan finns på husposten behålls vid kläckningen", async () => {
    await seedState({ "01": 3, "02": 3, "05": 3 });
    await db.doc(`studentData/${U}`).set({ coins: START, brakdrake: { name: "Nova" } });
    await spela("03", 8);
    assert.equal((await rig.state(U)).dragon.name, "Nova");
    assert.equal((await db.doc(`studentData/${U}`).get()).data().brakdrake.name, "Nova");
  });

  it("namnbyte: rensad text i state och husposten, placering och nivå orörda", async () => {
    await seedState({ "01": 3, "02": 3, "05": 3 });
    await spela("03", 8);
    await db.doc(`studentData/${U}`).set({ brakdrake: { pos: { x: 1, y: 2 }, room: "rum1" } }, { merge: true });
    assert.deepEqual(await renameDragon(deps, U, { name: "  <b>Glöd</b>\n  den   store äventyraren " }), { name: "bGlöd/b den stor" });
    const d = (await db.doc(`studentData/${U}`).get()).data().brakdrake;
    assert.deepEqual(d, { id: `drake-${U}`, level: 1, name: "bGlöd/b den stor", pos: { x: 1, y: 2 }, room: "rum1" });
    assert.equal((await rig.state(U)).dragon.name, "bGlöd/b den stor");
    assert.equal(await code(renameDragon(deps, U, { name: "   " })), "invalid-argument");
    assert.equal(await code(renameDragon(deps, U, { name: 42 })), "invalid-argument");
    assert.equal(await code(renameDragon(deps, U, { name: "x".repeat(201) })), "invalid-argument");
    const b = await spela("03", 8);
    assert.equal(b.dragon.hatched, false);
    assert.equal((await rig.state(U)).dragon.name, "bGlöd/b den stor", "nästa stjärna rör inte namnet");
  });

  it("full progression: exakt 150 stjärnor och 6 000 stjärnmynt", { timeout: 600_000 }, async () => {
    for (const id of CHALLENGE_IDS) {
      for (let k = 0; k < 3; k++) await spela(id, 8 + (k % 3));
    }
    assert.equal((await spela("01", 10)).reward.kind, "repetition");
    const st = await rig.state(U);
    assert.deepEqual([st.totalStars, st.mastered, st.encouragementCoins], [150, 50, 0]);
    assert.equal(await rig.coins(U), START + 6000);
    assert.equal((await rig.rewards(U)).length, 150);
    assert.equal((await db.doc(`studentData/${U}`).get()).data().brakdrake.level, 15);
  });
});
