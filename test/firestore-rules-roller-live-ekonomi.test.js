// ============================================================================
// Regel-tester: roller – Live, Mattematchen och ekonomi (#678, §7 test 15–18).
// ----------------------------------------------------------------------------
// Årskurs 4 (4a, 4b) skapar och styr Live med sina klasser – Klassmatchen
// mot valfri motståndare, övriga format bara med egna klasser – och betalar
// matchens pluggmynt (kvittot). Mattematchen, klasskassan, pokalerna och
// EXP-bonusen skriver bara admin. Riggen: test/helpers/roller-env.js.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  deleteDoc, doc, getDoc, getDocs, collection, increment, runTransaction, serverTimestamp, setDoc, updateDoc,
  writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { seededRng } from "../src/mult/generator.js";
import { buildSnapshot } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import { buildResult } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import { payLiveRewards } from "../src/live/live-rewards-pay.js";
import { planKassaInWrites } from "../src/klasscenter/kc-kassa-plan.js";

let env;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const MULT = requireGameMode("multiplication_0_10");
const SNAP = buildSnapshot(MULT, { answerKind: "choice", count: 5, rng: seededRng(7) });

const klassmatch = (classIds, uid, over = {}) => ({
  ...buildSessionDoc({
    name: classIds.join(" mot "), gameMode: "multiplication_0_10", classIds, durationMin: 10,
    divisors: Object.fromEntries(classIds.map((c) => [c, 20])), ...over,
  }, { uid }),
  createdAt: serverTimestamp(),
});
const snilleblixt = (classIds, uid) => ({
  ...buildSessionDoc({
    name: "Snilleblixten", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "choice",
    classIds, questionCount: 5, questionSeconds: 20, shuffleQuestions: true, showQuestionOnStudent: true,
    rewards: { firstPrize: "300", perCorrect: "5", cap: "300" },
  }, { uid }),
  createdAt: serverTimestamp(),
});
// Snilleblixten skapas ihop med ögonblicksbilden (facit) i samma batch.
function skapaSb(db, sid, classIds, uid) {
  const b = writeBatch(db);
  b.set(doc(db, "liveSessions", sid), snilleblixt(classIds, uid));
  b.set(doc(db, "liveSessions", sid, "sbPrivate", "snapshot"), SNAP);
  return b.commit();
}
// En avslutad Snilleblixt där e4a (eller e5a) vann 50 pluggmynt.
function avslutadSb(classId, uid) {
  const s = { ...snilleblixt([classId], "admin1"), createdAt: ts(-2 * H), status: "finished", startedAt: ts(-H), finishedAt: ts(-1000) };
  const result = buildResult(s, [], [{ uid, name: uid, classId }], MULT, { scores: [] });
  result.rewards[uid] = { rank: 1, correct: 10, prize: 30, correctCoins: 20, total: 50 };
  return { ...s, result };
}
const coins = async (uid) => {
  let c;
  await env.seed(async (db) => { c = (await getDoc(doc(db, "studentData", uid))).data().coins; });
  return c;
};

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-roller-live"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    const lobby = (classIds) => ({ ...klassmatch(classIds, "admin1"), createdAt: ts(-H) });
    await setDoc(doc(db, "liveSessions", "m4a6a"), lobby(["4a", "6a"]));
    await setDoc(doc(db, "liveSessions", "m5a6a"), lobby(["5a", "6a"]));
    for (const [sid, uid, classId] of [["m4a6a", "e4a", "4a"], ["m5a6a", "e5a", "5a"]]) {
      await setDoc(doc(db, "liveSessions", sid, "players", uid),
        { uid, classId, name: uid, joinedAt: ts(-H), lastSeenAt: ts(-H), correct: 0, incorrect: 0 });
    }
    await setDoc(doc(db, "liveSessions", "sb4a"), avslutadSb("4a", "e4a"));
    await setDoc(doc(db, "liveSessions", "sb5a"), avslutadSb("5a", "e5a"));
    // Avslutad Klassmatch med pris till 4A:s kassa.
    await setDoc(doc(db, "liveSessions", "pris"), {
      ...lobby(["4a", "5a"]), coinPrize: 1000, status: "finished", startedAt: ts(-H),
      result: { winner: "4a", winnerClasses: ["4a"], perClass: { "4a": { players: 1 }, "5a": { players: 1 } } },
    });
    await setDoc(doc(db, "mathCompetitions", "mm1"), {
      name: "MM", participatingClassIds: ["4a", "5a"], startAt: ts(-H), endAt: ts(H), status: "active", counterShards: 4,
    });
    await setDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "e4a"), { uid: "e4a", classId: "4a", correct: 5 });
    await setDoc(doc(db, "mathCompetitions", "mm1", "scores", "e4a"), { uid: "e4a", classId: "4a", correct: 5 });
  });
});

describe("Test 15: Årskurs 4 skapar Live", () => {
  const ny = (db) => doc(db, "liveSessions", `ny-${Math.random().toString(36).slice(2)}`);

  it("Klassmatchen 4A mot 5A godtas (motståndaren får vara vilken klass som helst)", async () => {
    await assertSucceeds(setDoc(ny(env.ak4()), klassmatch(["4a", "5a"], "ak4")));
    await assertSucceeds(setDoc(ny(env.ak4()), klassmatch(["6a", "4b"], "ak4")));
  });
  it("Klassmatchen 5A mot 6A nekas – ingen av klasserna är kontots", async () => {
    await assertFails(setDoc(ny(env.ak4()), klassmatch(["5a", "6a"], "ak4")));
    await assertSucceeds(setDoc(ny(env.ak5()), klassmatch(["5a", "6a"], "ak5")));
    await assertSucceeds(setDoc(ny(env.admin()), klassmatch(["5a", "6a"], "admin1")));
  });
  it("mynt-pris till klasskassan får bara admin sätta", async () => {
    await assertFails(setDoc(ny(env.ak4()), klassmatch(["4a", "5a"], "ak4", { coinPrize: 500 })));
    await assertSucceeds(setDoc(ny(env.admin()), klassmatch(["4a", "5a"], "admin1", { coinPrize: 500 })));
  });
  it("övriga format: bara med egna klasser (pluggmynt ställs in som vanligt)", async () => {
    await assertSucceeds(skapaSb(env.ak4(), "sb-egen", ["4a", "4b"], "ak4"));
    await assertFails(skapaSb(env.ak4(), "sb-blandad", ["4a", "5a"], "ak4"));
    await assertSucceeds(skapaSb(env.admin(), "sb-admin", ["4a", "5a"], "admin1"));
  });
});

describe("Test 16: Årskurs 4 startar och avslutar en match där 4A deltar", () => {
  const start = { status: "live", startedAt: serverTimestamp() };
  const slut = { status: "finished", finishedAt: serverTimestamp() };

  it("starta och avsluta (match skapad av admin) godtas", async () => {
    const ref = doc(env.ak4(), "liveSessions", "m4a6a");
    await assertSucceeds(updateDoc(ref, start));
    await assertSucceeds(updateDoc(ref, slut));
  });
  it("en match utan kontots klasser går inte att styra, läsa spelare i eller radera", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(doc(db, "liveSessions", "m5a6a"), start));
    await assertFails(updateDoc(doc(db, "liveSessions", "m5a6a"), slut));
    await assertFails(getDocs(collection(db, "liveSessions", "m5a6a", "players")));
    await assertFails(deleteDoc(doc(db, "liveSessions", "m5a6a")));
  });
  it("klasserna kan inte bytas till andras i lobbyn", async () => {
    const ny = {
      participatingClassIds: ["5a", "6a"], classDivisors: { "5a": 20, "6a": 20 }, classNames: { "5a": "5A", "6a": "6A" },
      wizards: { "5a": "rasmus", "6a": "elias" },
    };
    await assertFails(updateDoc(doc(env.ak4(), "liveSessions", "m4a6a"), ny));
    await assertSucceeds(updateDoc(doc(env.admin(), "liveSessions", "m4a6a"), ny));
  });
  it("läser projektorns data och raderar en ej startad match med lobbyn", async () => {
    const db = env.ak4();
    const spelare = await assertSucceeds(getDocs(collection(db, "liveSessions", "m4a6a", "players")));
    const b = writeBatch(db);
    spelare.docs.forEach((d) => b.delete(d.ref));
    b.delete(doc(db, "liveSessions", "m4a6a"));
    await assertSucceeds(b.commit());
  });
  it("pluggmynten efter matchen betalas till 4A:s elever, men inte i en 5A-match", async () => {
    const sdk = { doc, getDoc, runTransaction, serverTimestamp };
    const pay = async (sid) => payLiveRewards(sdk, env.ak4(),
      { sid, session: (await getDoc(doc(env.admin(), "liveSessions", sid))).data(), uid: "ak4" });
    assert.deepEqual((await pay("sb4a")).map((r) => r.status), ["betald"]);
    assert.equal(await coins("e4a"), 150);
    assert.deepEqual((await pay("sb4a")).map((r) => r.status), ["redan"]);
    assert.deepEqual((await pay("sb5a")).map((r) => r.status), ["nekad"]);
    assert.equal(await coins("e5a"), 100);
  });
});

describe("Test 17: Årskurs 4 skapar eller nollställer en Mattematchen – nekas", () => {
  const mm = () => ({
    name: "Ny MM", participatingClassIds: ["4a"], startAt: ts(0), endAt: ts(H), status: "active", counterShards: 4,
  });
  it("skapa, stoppa, avsluta, radera", async () => {
    const db = env.ak4();
    await assertFails(setDoc(doc(db, "mathCompetitions", "ny"), mm()));
    await assertFails(updateDoc(doc(db, "mathCompetitions", "mm1"), { status: "stopped" }));
    await assertFails(updateDoc(doc(db, "mathCompetitions", "mm1"), { status: "finished" }));
    await assertFails(deleteDoc(doc(db, "mathCompetitions", "mm1")));
    await assertSucceeds(setDoc(doc(env.admin(), "mathCompetitions", "ny"), mm()));
    await assertSucceeds(updateDoc(doc(env.admin(), "mathCompetitions", "mm1"), { status: "stopped" }));
  });
  it("nollställa statistik och topplista", async () => {
    const db = env.ak4();
    await assertFails(deleteDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "e4a")));
    await assertFails(deleteDoc(doc(db, "mathCompetitions", "mm1", "scores", "e4a")));
    await assertSucceeds(getDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "e4a")));
  });
});

describe("Test 18: Årskurs 4 ger mynt, ändrar klasskassan eller delar ut en pokal – nekas", () => {
  function commit(db, writes) {
    const b = writeBatch(db);
    for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
    return b.commit();
  }
  const kassaIn = (uid) => planKassaInWrites({
    classId: "4a", post: { classId: "4a", txId: "live-pris", belopp: 1000, titel: "4A mot 5A" }, uid,
    sessionId: "pris", fv: { increment, serverTimestamp },
  });
  const pokal = (uid) => ({ typ: "larare", kallaId: "bra", titel: "Bra jobbat", motiv: "guld", wonAt: serverTimestamp(), awardedBy: uid });
  const exp = (uid) => ({ exp: 50, lastUid: uid, lastAt: serverTimestamp(), lastKalla: "live" });

  it("ge mynt direkt – även med ett påhittat kvitto-id", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(doc(db, "studentData", "e4a"), { coins: 500 }));
    await assertFails(updateDoc(doc(db, "studentData", "e4a"), { coins: 500, lastLiveReceipt: "sb4a" }));
  });
  it("klasskassan: insättning av matchpriset", async () => {
    await assertFails(commit(env.ak4(), kassaIn("ak4")));
    await assertSucceeds(commit(env.admin(), kassaIn("admin1")));
  });
  it("pokaler: dela ut och ta bort", async () => {
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a", "trophies", "larare-bra"), pokal("ak4")));
    await assertSucceeds(setDoc(doc(env.admin(), "classCenters", "4a", "trophies", "larare-bra"), pokal("admin1")));
    await assertFails(deleteDoc(doc(env.ak4(), "classCenters", "4a", "trophies", "larare-bra")));
  });
  it("klassbonus-EXP, kassörer och inredningsspärr", async () => {
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a", "expShards", "0"), exp("ak4")));
    await assertSucceeds(setDoc(doc(env.admin(), "classCenters", "4a", "expShards", "0"), exp("admin1")));
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a"), { kassorer: ["e4a"] }));
    await assertFails(setDoc(doc(env.ak4(), "classCenters", "4a"), { inredningSparr: ["e4a"] }));
  });
});
