// ============================================================================
// Regel-tester: Kurragömma G (#842) – perQuestion-aggregatet kgPlayers.fragor.
// Ingen ny samling: räknarna ligger i elevens eget kgPlayers-dokument som BARA
// servern skriver (firestore.rules "allow create, update: if false"). Här visas
// att varken eleven själv, en annan elev eller läraren kan sätta, ändra eller
// nollställa fragor – inte ens som ensam fältändring – och att eleven läser sitt
// eget dokument (räknarna avslöjar bara egna svar) men inte andras.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteField, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const SID = "kg842";
const kp = (db, u) => doc(db, "liveSessions", SID, "kgPlayers", u);
const FRAGOR = { m3x4: { a: 2, r: 1 }, q0: { a: 1, r: 1 } };

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-kurragomma-842"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo"] });
    for (const u of ["alma", "bo"]) await setDoc(doc(db, "students", u), { namn: u });
    await setDoc(doc(db, "liveSessions", SID), {
      name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
      participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 510, countdownSeconds: 4, status: "live",
      createdBy: "larare1", createdAt: ts(-H), startedAt: ts(-60_000), kgFas: "leta", kgGomSlut: ts(-26_000), kgLetStart: ts(-26_000),
      kgInstallningar: { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" }, showNames: true,
    });
    for (const u of ["alma", "bo"]) {
      await setDoc(doc(db, "liveSessions", SID, "players", u), { uid: u, classId: "4b", name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      await setDoc(kp(db, u), { uid: u, classId: "4b", name: u, roll: "gomd", poang: 10, ratt: 1, besvarade: 3, hittade: 0, laddningar: 0, harLast: true, fragor: FRAGOR });
    }
  });
});

describe("Kurragömma #842: kgPlayers.fragor skriver bara servern", () => {
  it("eleven kan inte ändra, höja eller nollställa sina egna räknare – inte heller som ensam fältändring", async () => {
    const db = elev("alma");
    await assertFails(updateDoc(kp(db, "alma"), { fragor: { m3x4: { a: 99, r: 99 } } }));
    await assertFails(updateDoc(kp(db, "alma"), { "fragor.m3x4.r": 2 }));
    await assertFails(updateDoc(kp(db, "alma"), { "fragor.m7x8": { a: 1, r: 1 } }));
    await assertFails(updateDoc(kp(db, "alma"), { fragor: deleteField() }));
    await assertFails(setDoc(kp(db, "alma"), { fragor: {} }, { merge: true }));
  });
  it("en annan elev och läraren kan inte heller; nytt kgPlayers-dokument nekas", async () => {
    await assertFails(updateDoc(kp(elev("bo"), "alma"), { "fragor.m3x4.r": 2 }));
    await assertFails(updateDoc(kp(teacher(), "alma"), { "fragor.m3x4.r": 2 }));
    await assertFails(setDoc(kp(elev("alma"), "cleo"), { uid: "cleo", classId: "4b", roll: "gomd", fragor: FRAGOR }));
    await assertFails(setDoc(kp(teacher(), "cleo"), { uid: "cleo", classId: "4b", roll: "gomd", fragor: FRAGOR }));
  });
  it("eleven läser sitt eget dokument med räknarna, inte en annans; läraren läser alla", async () => {
    const egen = await assertSucceeds(getDoc(kp(elev("alma"), "alma")));
    assert.deepEqual(egen.data().fragor, FRAGOR);
    await assertFails(getDoc(kp(elev("alma"), "bo")));
    await assertSucceeds(getDoc(kp(teacher(), "bo")));
  });
});
