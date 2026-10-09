// ============================================================================
// Regel-tester: Live-formatet (#547) – liveSessions/{sid}.format
//   • frånvarande (alla sessioner före #547) eller "klassmatch" godtas,
//   • okänt format eller fel typ nekas,
//   • formatet byts aldrig (inte i lobbyn heller), men en gammal session
//     utan fält fungerar precis som förut (starta, nämnare, gå med, slut).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 17, "5e": 22 },
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H),
  ...over,
});
// En session som skapades före #547 (inget format-fält).
const gammal = (over = {}) => {
  const { format, ...utan } = sessionDoc(over);
  return utan;
};
const create = (data) => setDoc(doc(teacher(), "liveSessions", "ny"), { ...data, createdAt: serverTimestamp() });

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-format"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "liveSessions", "lobby"), sessionDoc());
    await setDoc(doc(db, "liveSessions", "gammal-lobby"), gammal());
    await setDoc(doc(db, "liveSessions", "gammal-pagar"), gammal({ status: "live", startedAt: ts(-60 * 1000) }));
    await setDoc(doc(db, "liveSessions", "gammal-slut"), gammal({ status: "live", startedAt: ts(-2 * H) }));
  });
});

describe("Live-format: skapa", () => {
  it("nya sessioner får format \"klassmatch\" (buildSessionDoc) och godtas", async () => {
    assert.equal(sessionDoc().format, "klassmatch");
    await assertSucceeds(create(sessionDoc({ createdBy: "larare1" })));
  });

  it("utan format (äldre klienter) godtas fortfarande", async () => {
    await assertSucceeds(create(gammal({ createdBy: "larare1" })));
  });

  it("okänt format, fel typ och null nekas", async () => {
    for (const format of ["snilleblixt_ej_byggd", "", "KLASSMATCH", 1, null, ["klassmatch"]]) {
      await assertFails(create(sessionDoc({ createdBy: "larare1", format })));
    }
  });
});

describe("Live-format: byts aldrig", () => {
  it("läraren kan inte byta eller sätta okänt format, inte ens i lobbyn", async () => {
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "lobby"), { format: "guldrush" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "gammal-lobby"), { format: "guldrush" }));
  });

  it("vanliga lärarändringar på en ny session godtas (format orört)", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { "classDivisors.4b": 16 }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { status: "live", startedAt: serverTimestamp() }));
  });

  it("frånvarande ≡ \"klassmatch\": att skriva ut eller ta bort fältet ändrar inget format", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "gammal-lobby"), { format: "klassmatch" }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { format: deleteField() }));
  });
});

describe("Live-format: gammal session utan format fungerar som förut", () => {
  it("starta, justera nämnare, eleven går med, matchslut efter sluttid", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "gammal-lobby"), { status: "live", startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "gammal-pagar"), { "classDivisors.4b": 16 }));
    await assertSucceeds(setDoc(doc(elev("alma"), "liveSessions", "gammal-pagar", "players", "alma"), {
      uid: "alma", classId: "4b", name: "Alma", joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), correct: 0, incorrect: 0,
    }));
    await assertSucceeds(updateDoc(doc(elev("alma"), "liveSessions", "gammal-slut"), { status: "finished", finishedAt: serverTimestamp() }));
  });
});
