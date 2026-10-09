// ============================================================================
// Regel-/emulatortester: Pluggmynt efter matchen (#557, spec §7.2.5)
//   • test 20g: två lärare betalar samtidigt + en "laddar om" och kör igen →
//     varje elev får sina pluggmynt EXAKT en gång (kvitto per elev+session)
//   • test 20f: under matchen ändras inget pluggmynt-saldo – svar påverkar
//     bara spelvalutan, och en utbetalning före slut nekas
//   • kvittot: bara create, bara lärare, beloppen = result.rewards, saldot
//     måste öka med exakt total i samma skrivning; demo betalar aldrig
//   • sessionens rewards-val valideras och är låst efter skapandet
// Utbetalningen är appens egen (live-rewards-pay.js payLiveRewards).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, runTransaction, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { seededRng } from "../src/mult/generator.js";
import { buildSnapshot } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import { buildResult } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import { planAnswer } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";
import { payLiveRewards } from "../src/live/live-rewards-pay.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const sdk = { doc, getDoc, runTransaction, serverTimestamp };
const MULT = requireGameMode("multiplication_0_10");
const SNAP = buildSnapshot(MULT, { answerKind: "choice", count: 5, rng: seededRng(7) });
const REWARDS = { firstPrize: "300", perCorrect: "5", cap: "300" };

const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "Snilleblixten 4B", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "choice",
    classIds: ["4b"], classNames: { "4b": "4B" }, questionCount: 5, questionSeconds: 20,
    shuffleQuestions: true, showQuestionOnStudent: true, rewards: REWARDS,
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H),
  ...over,
});

// Slutställning: alma 1:a (50 rätt), bo 2:a (42 rätt), cleo anslöt men svarade aldrig.
const PLAYERS = ["alma", "bo", "cleo"].map((uid) => ({ uid, name: uid, classId: "4b" }));
const SCORES = [
  { index: 0, skipped: false, points: { alma: 5000, bo: 4200 }, correct: {} },
];
const finished = (over = {}) => {
  const s = sessionDoc({ status: "finished", startedAt: ts(-H), finishedAt: ts(-1000), ...over });
  const result = buildResult(s, [], PLAYERS, MULT, { scores: SCORES });
  // Antal rätt i matchen (sbScores-korrekt per fråga ersätts här av rätt-räkningen direkt).
  result.rewards.alma = { rank: 1, correct: 50, prize: 300, correctCoins: 210, total: 510 };
  result.rewards.bo = { rank: 2, correct: 42, prize: 255, correctCoins: 186, total: 441 };
  return { ...s, result };
};

const sess = (db, sid) => doc(db, "liveSessions", sid);
const kvitto = (db, sid, uid) => doc(db, "liveSessions", sid, "coinReceipts", uid);
const coins = async (uid) => {
  let c = null;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = await getDoc(doc(ctx.firestore(), "studentData", uid));
    c = d.exists() ? d.data().coins : null;
  });
  return c;
};
const larare2 = () => testEnv.authenticatedContext("larare2", { teacher: true }).firestore();
const pay = (db, sid, s, uid = "larare1") => payLiveRewards(sdk, db, { sid, session: s, uid, defaults: () => ({ xp: 0 }) });

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-rewards"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo", "cleo"] });
    for (const u of ["alma", "bo", "cleo"]) await setDoc(doc(db, "students", u), { namn: u });
    // alma har 100 sedan förut, bo saknar studentData-dokument helt.
    await setDoc(doc(db, "studentData", "alma"), { coins: 100, xp: 0 });
    await setDoc(doc(db, "studentData", "cleo"), { coins: 7, xp: 0 });
    await setDoc(sess(db, "slut"), finished());
    await setDoc(sess(db, "demo"), finished({ demo: true }));
    await setDoc(sess(db, "pagar"), sessionDoc({
      status: "live", startedAt: ts(-H), q: { index: 0, phase: "open", openedAt: ts(-2000), question: SNAP.questions[0] },
    }));
    await setDoc(doc(db, "liveSessions", "pagar", "sbPrivate", "snapshot"), SNAP);
    for (const u of ["alma", "bo"]) {
      await setDoc(doc(db, "liveSessions", "pagar", "players", u),
        { uid: u, classId: "4b", name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
    }
  });
});

describe("Pluggmynt: test 20g – exakt en gång", () => {
  it("två lärare samtidigt + omladdning (körs igen) → alma +510, bo 441, cleo orörd", async () => {
    const s = finished();
    const [a, b] = await Promise.all([pay(teacher(), "slut", s), pay(larare2(), "slut", s, "larare2")]);
    const igen = await pay(teacher(), "slut", s);
    assert.equal(await coins("alma"), 100 + 510);
    assert.equal(await coins("bo"), 441);
    assert.equal(await coins("cleo"), 7);
    const betalda = [...a, ...b].filter((r) => r.status === "betald").map((r) => r.uid).sort();
    assert.deepEqual(betalda, ["alma", "bo"]);
    assert.ok([...a, ...b].every((r) => r.status !== "nekad"), JSON.stringify([...a, ...b]));
    assert.deepEqual(igen.map((r) => r.status), ["redan", "redan"]);
    const k = (await getDoc(kvitto(teacher(), "slut", "bo"))).data();
    assert.deepEqual([k.prize, k.correctCoins, k.total], [255, 186, 441]);
  });

  it("ett andra kvitto nekas av reglerna, och kvittot kan inte ändras eller raderas", async () => {
    await pay(teacher(), "slut", finished());
    const l2 = larare2();
    const b = writeBatch(l2);
    b.update(doc(l2, "studentData", "alma"), { coins: 610 + 510 });
    b.set(kvitto(l2, "slut", "alma"), { uid: "alma", prize: 300, correctCoins: 210, total: 510, at: serverTimestamp(), by: "larare2" });
    await assertFails(b.commit());
    await assertFails(updateDoc(kvitto(teacher(), "slut", "alma"), { total: 1 }));
    await assertFails(deleteDoc(kvitto(teacher(), "slut", "alma")));
    assert.equal(await coins("alma"), 610);
  });
});

describe("Pluggmynt: kvittots regler", () => {
  const kv = (over = {}) => ({ uid: "bo", prize: 255, correctCoins: 186, total: 441, at: serverTimestamp(), by: "larare1", ...over });
  const batch = (db, sid, uid, nyttSaldo, data) => {
    const b = writeBatch(db);
    b.set(doc(db, "studentData", uid), { coins: nyttSaldo }, { merge: true });
    b.set(kvitto(db, sid, uid), data);
    return b.commit();
  };

  it("rätt kvitto + saldo +total godtas", async () => {
    await assertSucceeds(batch(teacher(), "slut", "bo", 441, kv()));
  });

  it("fel belopp, kvitto utan saldo, fel saldoökning, elev, demo eller annan elev nekas", async () => {
    await assertFails(batch(teacher(), "slut", "bo", 999, kv({ total: 999, correctCoins: 744 })));
    await assertFails(setDoc(kvitto(teacher(), "slut", "bo"), kv()));
    await assertFails(batch(teacher(), "slut", "bo", 440, kv()));
    await assertFails(batch(teacher(), "slut", "bo", 441, kv({ by: "larare2" })));
    await assertFails(batch(elev("bo"), "slut", "bo", 441, kv({ by: "bo" })));
    await assertFails(batch(teacher(), "demo", "bo", 441, kv()));
    await assertFails(batch(teacher(), "slut", "cleo", 7 + 441, kv({ uid: "cleo" })));
  });

  it("demoläge: utbetalningen gör ingenting", async () => {
    assert.deepEqual(await pay(teacher(), "demo", finished({ demo: true })), []);
    assert.equal(await coins("alma"), 100);
  });

  it("eleven läser sitt eget kvitto, inte andras", async () => {
    await pay(teacher(), "slut", finished());
    await assertSucceeds(getDoc(kvitto(elev("bo"), "slut", "bo")));
    await assertFails(getDoc(kvitto(elev("bo"), "slut", "alma")));
  });
});

describe("Pluggmynt: test 20f – inget saldo ändras under matchen", () => {
  it("svar under matchen rör bara spelet; utbetalning före slut nekas", async () => {
    const s = (await getDoc(sess(teacher(), "pagar"))).data();
    const w = planAnswer({ sid: "pagar", s, uid: "alma", classId: "4b", choiceIndex: 1, fv: { serverTimestamp } });
    await assertSucceeds(setDoc(doc(elev("alma"), ...w.path), w.data));
    assert.equal(await coins("alma"), 100);
    // Även med ett påhittat result: matchen pågår → inget kvitto, inga mynt.
    const fake = { ...s, status: "finished", result: finished().result };
    assert.deepEqual(await pay(teacher(), "pagar", { ...s, result: fake.result }), []);
    const t = teacher();
    const b = writeBatch(t);
    b.update(doc(t, "studentData", "alma"), { coins: 610 });
    b.set(kvitto(t, "pagar", "alma"), { uid: "alma", prize: 300, correctCoins: 210, total: 510, at: serverTimestamp(), by: "larare1" });
    await assertFails(b.commit());
    assert.deepEqual((await pay(teacher(), "pagar", fake)).map((r) => r.status), ["nekad", "nekad"]);
    assert.equal(await coins("alma"), 100);
    assert.equal(await coins("bo"), null);
  });
});

describe("Pluggmynt: lärarens val på sessionen", () => {
  const create = (db, sid, data) => {
    const b = writeBatch(db);
    b.set(sess(db, sid), { ...data, createdAt: serverTimestamp() });
    b.set(doc(db, "liveSessions", sid, "sbPrivate", "snapshot"), SNAP);
    return b.commit();
  };
  const ny = (over) => {
    const { createdAt, ...d } = sessionDoc();
    return { ...d, ...over };
  };

  it("giltigt val godtas, utan val också; utanför taken nekas", async () => {
    await assertSucceeds(create(teacher(), "a", ny({})));
    const { rewards, ...utan } = ny({});
    await assertSucceeds(create(teacher(), "b", utan));
    for (const r of [
      { firstPrize: 1001, perCorrect: 5, cap: 300 }, { firstPrize: 300, perCorrect: 51, cap: 300 },
      { firstPrize: 300, perCorrect: 5, cap: 0 }, { firstPrize: 300, perCorrect: 5, cap: 300, extra: 1 },
      { firstPrize: "300", perCorrect: 5, cap: 300 },
    ]) await assertFails(create(teacher(), "c", ny({ rewards: r })));
  });

  it("valet är låst efter skapandet", async () => {
    await create(teacher(), "a", ny({}));
    await assertFails(updateDoc(sess(teacher(), "a"), { "rewards.firstPrize": 1000 }));
  });
});
