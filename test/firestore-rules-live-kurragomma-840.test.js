// ============================================================================
// Regel-tester: Kurragömma E (#840) – firestore.rules "Kurragömma"
//   • lärarformuläret: sessionsdokumentet som buildSessionDoc skriver det ur
//     fälten (gömtid 20, startsökare 2, tystnad av, speltid 3 min) släpps igenom
//   • pluggmynten: deltagare = svarat, låst ett gömställe eller hittat någon –
//     den som gömde sig utan att svara får sitt placeringspris (rätt-mynt 0);
//     den som varken svarade, låste eller hittade nekas
//   • "varav lärarens" (F1): summan står aldrig i result – historiken räknar
//     kgEvents med larare: true, och den räknefrågan nekas eleven men inte läraren
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, serverTimestamp, Timestamp, runTransaction, collection, query, where, getCountFromServer } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { payLiveRewards } from "../src/live/live-rewards-pay.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { getFormat, registerFormat } from "../src/live/live-formats.js";
import KURRAGOMMA from "../src/live/formats/kurragomma/index.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const sdk = { doc, getDoc, runTransaction, serverTimestamp };
const sess = (db, sid) => doc(db, "liveSessions", sid);
const sub = (db, sid, col, id) => doc(db, "liveSessions", sid, col, id);

const INPUT = {
  name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free", classIds: ["4b"], classNames: { "4b": "4B" },
  durationMin: 3, gomtid: 20, startsokare: "2", tystnad: false, karta: "on", showNames: true, rewards: { firstPrize: 100, perCorrect: 5, cap: 300 },
};

before(async () => {
  if (!getFormat("kurragomma")) registerFormat(KURRAGOMMA);
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-kurragomma-840"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo", "cleo", "dina"] });
    for (const u of ["alma", "bo", "cleo", "dina"]) {
      await setDoc(doc(db, "students", u), { namn: u });
      await setDoc(doc(db, "studentData", u), { coins: 10 });
    }
  });
});

describe("Kurragömma E: lärarformuläret → sessionen", () => {
  it("formulärets fält (gömtid 20, startsökare 2, tystnad av, 3 min) ger ett dokument reglerna släpper igenom", async () => {
    const d = buildSessionDoc(INPUT, { uid: "larare1" });
    assert.deepEqual(d.kgInstallningar, { gomtid: 20, startsokare: 2, tystnad: false, karta: "on" });
    assert.equal(d.durationSeconds, 20 + 180);
    await assertSucceeds(setDoc(sess(teacher(), "form"), { ...d, createdAt: serverTimestamp() }));
    const std = buildSessionDoc({ ...INPUT, gomtid: undefined, startsokare: undefined, tystnad: true, karta: undefined, durationMin: 8 }, { uid: "larare1" });
    assert.deepEqual(std.kgInstallningar, { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    await assertSucceeds(setDoc(sess(teacher(), "std"), { ...std, createdAt: serverTimestamp() }));
  });
});

describe("Kurragömma E: pluggmynten åt deltagare (svarat, låst eller hittat)", () => {
  const avslutad = (rewards) => ({
    name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 30 + 480, countdownSeconds: 4,
    createdBy: "larare1", createdByName: "Lärare", createdAt: ts(-H), kgInstallningar: { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" },
    status: "finished", startedAt: ts(-11 * 60_000), finishedAt: ts(-1000), kgFas: "leta", kgGomSlut: ts(-10 * 60_000), kgLetStart: ts(-10 * 60_000),
    rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, result: { format: "kurragomma", rewards },
  });
  const spelare = [
    // alma: gömd hela matchen, låste, svarade aldrig → placeringspris, 0 rätt-mynt
    ["alma", { roll: "gomd", poang: 170, ratt: 0, besvarade: 0, hittade: 0, harLast: true, klaradeSig: true, klar: true }],
    // bo: startsökare som aldrig svarade men hittade någon (1 fri laddning)
    ["bo", { roll: "sokare", poang: 40, ratt: 0, besvarade: 0, hittade: 1, harLast: false, klar: true }],
    // cleo: svarade
    ["cleo", { roll: "sokare", poang: 30, ratt: 3, besvarade: 4, hittade: 0, harLast: false, klar: true }],
    // dina: sen sökare som varken svarade, låste eller hittade
    ["dina", { roll: "sokare", poang: 0, ratt: 0, besvarade: 0, hittade: 0, harLast: false, klar: true }],
  ];
  async function seed(sid, s) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(sess(db, sid), s);
      for (const [u, kp] of spelare) {
        await setDoc(sub(db, sid, "players", u), { uid: u, classId: "4b", name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
        await setDoc(sub(db, sid, "kgPlayers", u), { uid: u, classId: "4b", name: u, laddningar: 0, ...kp });
      }
    });
  }
  it("gömd utan svar (låst) och sökare utan svar (hittade någon) betalas; den som inte deltog nekas; rätt-mynt > 5 × ratt nekas", async () => {
    const s = avslutad({
      alma: { rank: 1, correct: 0, prize: 100, correctCoins: 0, total: 100 },
      bo: { rank: 2, correct: 0, prize: 85, correctCoins: 0, total: 85 },
      cleo: { rank: 3, correct: 3, prize: 72, correctCoins: 15, total: 87 },
      dina: { rank: 4, correct: 0, prize: 61, correctCoins: 0, total: 61 },
    });
    await seed("mynt", s);
    const ut = await payLiveRewards(sdk, teacher(), { sid: "mynt", session: s, uid: "larare1" });
    assert.deepEqual(Object.fromEntries(ut.map((x) => [x.uid, x.status])), { alma: "betald", bo: "betald", cleo: "betald", dina: "nekad" });
    const fusk = avslutad({ alma: { rank: 1, correct: 1, prize: 100, correctCoins: 5, total: 105 } });
    await seed("fusk", fusk);
    assert.deepEqual((await payLiveRewards(sdk, teacher(), { sid: "fusk", session: fusk, uid: "larare1" })).map((x) => x.status), ["nekad"]);
  });
});

describe("Kurragömma E: 'varav lärarens' (F1) – aldrig läsbart för en elev", () => {
  const kgEvents = (db, sid) => collection(db, "liveSessions", sid, "kgEvents");
  const lararens = (db, sid) => query(kgEvents(db, sid), where("larare", "==", true));
  it("eleven läser sessionen (utan summan) men nekas kgEvents – både listning och historikens räknefråga; läraren räknar 2", async () => {
    const s = {
      name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
      participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 510, countdownSeconds: 4,
      createdBy: "larare1", createdAt: ts(-H), startedAt: ts(-11 * 60_000), finishedAt: ts(-1000), status: "finished",
      kgInstallningar: { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" }, kgFas: "leta",
      result: { format: "kurragomma", winner: null, visslingar: 3, klaradeSig: 1, hittade: 0, ranking: [] },
    };
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(sess(db, "slut"), s);
      await setDoc(sub(db, "slut", "players", "alma"), { uid: "alma", classId: "4b", name: "alma", joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      await setDoc(sub(db, "slut", "kgPlayers", "alma"), { uid: "alma", classId: "4b", name: "alma", roll: "gomd", poang: 170, ratt: 0, besvarade: 0, hittade: 0, laddningar: 0, harLast: true });
      await setDoc(sub(db, "slut", "kgEvents", "e1"), { t: 1, typ: "vissling", x: 3, z: 4, plats: "vid ladan" });
      await setDoc(sub(db, "slut", "kgEvents", "e2"), { t: 2, typ: "vissling", x: 5, z: 6, plats: "på ängen", larare: true });
      await setDoc(sub(db, "slut", "kgEvents", "e3"), { t: 3, typ: "vissling", x: 7, z: 8, plats: "vid stenen", larare: true });
    });
    const alma = elev("alma");
    const sessDoc = await assertSucceeds(getDoc(sess(alma, "slut")));
    assert.ok(!("visslingarLarare" in sessDoc.data().result), "det eleven kan läsa saknar summan");
    await assertFails(getDocs(kgEvents(alma, "slut")));
    await assertFails(getDocs(lararens(alma, "slut")));
    await assertFails(getCountFromServer(lararens(alma, "slut")));
    await assertFails(getDoc(sub(alma, "slut", "kgEvents", "e2")));
    const antal = await assertSucceeds(getCountFromServer(lararens(teacher(), "slut")));
    assert.equal(antal.data().count, 2, "historikens räknefråga (antalLarareVisslingar)");
  });
});
