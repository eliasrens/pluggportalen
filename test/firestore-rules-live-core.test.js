// ============================================================================
// Regel-tester: Live-kärnan (#460) – det som tillkom ovanpå #457:
//   • matchslut: VILKEN inloggad klient som helst får markera live → finished,
//     men bara efter officiellt slut och bara status + finishedAt,
//   • endsAt med exakt samma nanosekunder som startedAt (live-data fillEndsAt),
//   • lärarens nämnar-justering under match + historikens result efter slut,
//   • liveClock/{uid}: bara eget dokument, bara { t: serverns tid }.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";

let testEnv, unauth, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 17, "5e": 22 },
  }, { uid: "rasmus" }),
  createdAt: ts(-2 * H),
  ...over,
});
const finish = { status: "finished", finishedAt: serverTimestamp() };

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-core"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma"] });
    await setDoc(doc(db, "classes", "5e"), { name: "5E", studentIds: ["clara"] });
    await setDoc(doc(db, "liveSessions", "pagar"), sessionDoc({ status: "live", startedAt: ts(-60 * 1000) }));
    await setDoc(doc(db, "liveSessions", "slut"), sessionDoc({ status: "live", startedAt: ts(-2 * H) }));
    await setDoc(doc(db, "liveSessions", "lobby"), sessionDoc());
  });
});

describe("Live-kärnan: matchslut, endsAt, result, klocka", () => {
  it("skapa via buildSessionDoc + serverTimestamp godtas (lärare)", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "liveSessions", "ny"),
      { ...sessionDoc(), createdBy: "larare1", createdAt: serverTimestamp() }));
  });

  it("vilken elev som helst markerar slut EFTER sluttid – men inte före", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "pagar"), finish));
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "lobby"), finish));
    await assertFails(updateDoc(doc(unauth(), "liveSessions", "slut"), finish));
    await assertSucceeds(updateDoc(doc(elev("clara"), "liveSessions", "slut"), finish));
  });

  it("elevens slut-markering får bara röra status + finishedAt (server-tid)", async () => {
    const ref = doc(elev("alma"), "liveSessions", "slut");
    await assertFails(updateDoc(ref, { ...finish, result: { winner: "4b" } }));
    await assertFails(updateDoc(ref, { ...finish, "classDivisors.4b": 1 }));
    await assertFails(updateDoc(ref, { status: "finished", finishedAt: ts(0) }));
  });

  it("endsAt = startedAt + 4 s + längd med samma nanosekunder (fillEndsAt) godtas", async () => {
    const ref = doc(teacher(), "liveSessions", "lobby");
    await assertSucceeds(updateDoc(ref, { status: "live", startedAt: serverTimestamp() }));
    const s = (await getDoc(ref)).data();
    const endsAt = new Timestamp(s.startedAt.seconds + 4 + 1200, s.startedAt.nanoseconds);
    await assertSucceeds(updateDoc(ref, { endsAt }));
  });

  it("lärare justerar nämnaren under matchen och skriver result efter slut; elev kan inte", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "pagar"), { "classDivisors.4b": 16 }));
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "pagar"), { "classDivisors.4b": 1 }));
    await assertSucceeds(updateDoc(doc(elev("alma"), "liveSessions", "slut"), finish));
    const result = { perClass: { "4b": { correct: 340, divisor: 17, score: 20 } }, winner: "4b", totalCorrect: 340 };
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "slut"), { result }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "slut"), { result: { ...result, computedAt: serverTimestamp() } }));
  });

  it("lärare kan avsluta i förtid och avbryta en lobby", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "pagar"), finish));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), finish));
  });

  it("liveClock: eget dokument, bara { t: serverns tid }", async () => {
    await assertSucceeds(setDoc(doc(elev("alma"), "liveClock", "alma"), { t: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(elev("alma"), "liveClock", "alma")));
    await assertSucceeds(setDoc(doc(teacher(), "liveClock", "larare1"), { t: serverTimestamp() }));
    await assertFails(setDoc(doc(elev("alma"), "liveClock", "clara"), { t: serverTimestamp() }));
    await assertFails(getDoc(doc(elev("clara"), "liveClock", "alma")));
    await assertFails(setDoc(doc(elev("alma"), "liveClock", "alma"), { t: ts(H) }));
    await assertFails(setDoc(doc(elev("alma"), "liveClock", "alma"), { t: serverTimestamp(), x: 1 }));
    await assertFails(setDoc(doc(unauth(), "liveClock", "alma"), { t: serverTimestamp() }));
  });
});
