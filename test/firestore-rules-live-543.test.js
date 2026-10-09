// ============================================================================
// Regel-tester: Live #543 – radera en session som inte startat + justera
// klassernas nämnare i lobbyn och under pågående match (låst efter slut).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 18, "5e": 22 },
  }, { uid: "rasmus" }),
  createdAt: ts(-2 * H),
  ...over,
});

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-543"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma"] });
    await setDoc(doc(db, "liveSessions", "lobby"), sessionDoc());
    await setDoc(doc(db, "liveSessions", "lobby", "players", "alma"), { uid: "alma", classId: "4b", name: "Alma" });
    await setDoc(doc(db, "liveSessions", "pagar"), sessionDoc({ status: "live", startedAt: ts(-60 * 1000) }));
    await setDoc(doc(db, "liveSessions", "klar"), sessionDoc({
      status: "finished", startedAt: ts(-2 * H), finishedAt: ts(-H),
      result: { winner: "4b", winnerClasses: ["4b"] },
    }));
    await setDoc(doc(db, "liveSessions", "avbruten"), sessionDoc({ status: "finished", finishedAt: ts(-H) }));
  });
});

describe("#543 radera Live-session", () => {
  it("lärare raderar en lobby-session + lobbyns spelare i en batch", async () => {
    const db = teacher();
    const b = writeBatch(db);
    b.delete(doc(db, "liveSessions", "lobby", "players", "alma"));
    b.delete(doc(db, "liveSessions", "lobby"));
    await assertSucceeds(b.commit());
  });

  it("startad eller avslutad session kan inte raderas", async () => {
    await assertFails(deleteDoc(doc(teacher(), "liveSessions", "pagar")));
    await assertFails(deleteDoc(doc(teacher(), "liveSessions", "klar")));
    await assertFails(deleteDoc(doc(teacher(), "liveSessions", "avbruten")));
  });

  it("elev kan inte radera", async () => {
    await assertFails(deleteDoc(doc(elev("alma"), "liveSessions", "lobby")));
  });

  it("efter radering kan ingen elev gå med i den borttagna sessionen", async () => {
    await assertSucceeds(deleteDoc(doc(teacher(), "liveSessions", "lobby")));
    await assertFails(setDoc(doc(elev("alma"), "liveSessions", "lobby", "players", "alma"), {
      uid: "alma", classId: "4b", name: "Alma", joinedAt: ts(0), lastSeenAt: ts(0), correct: 0, incorrect: 0,
    }));
  });
});

describe("#543 justera nämnare", () => {
  it("lärare ändrar nämnaren i lobbyn och under match", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { "classDivisors.4b": 17 }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "pagar"), { "classDivisors.4b": 17 }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "pagar"), { classDivisors: { "4b": 16, "5e": 21 } }));
  });

  it("efter slut är nämnaren låst (även avbruten lobby)", async () => {
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "klar"), { "classDivisors.4b": 17 }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "avbruten"), { "classDivisors.4b": 17 }));
  });

  it("bara positiva heltal 1–999", async () => {
    const ref = doc(teacher(), "liveSessions", "pagar");
    for (const v of [0, -3, 1000, 2.5, "17", null]) await assertFails(updateDoc(ref, { "classDivisors.4b": v }));
    await assertSucceeds(updateDoc(ref, { "classDivisors.5e": 1 }));
  });

  it("samma klass-nycklar: ingen ny klass, ingen borttagen", async () => {
    const ref = doc(teacher(), "liveSessions", "pagar");
    await assertFails(updateDoc(ref, { "classDivisors.6a": 20 }));
    await assertFails(updateDoc(ref, { "classDivisors.5e": deleteField() }));
    await assertFails(updateDoc(ref, { classDivisors: { "4b": 17 } }));
  });

  it("en nämnarändring rör bara classDivisors", async () => {
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "pagar"), { "classDivisors.4b": 17, name: "Ny" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "pagar"),
      { "classDivisors.4b": 17, status: "finished", finishedAt: ts(0) }));
  });

  it("elev kan inte ändra nämnaren", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "pagar"), { "classDivisors.4b": 1 }));
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "lobby"), { "classDivisors.4b": 1 }));
  });
});
