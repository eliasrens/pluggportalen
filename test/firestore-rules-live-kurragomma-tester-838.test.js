// ============================================================================
// Testarens extra regeltester för Kurragömma (#838, spec §5.4 och §13.3):
// gömstället får inte nå någon annan än eleven själv.
//   • årskurskontot (projektorn) för matchens klass läser kgPlayers/kgEvents,
//     aldrig kgSelf/kgSecret; ett årskurskonto för en ANNAN klass läser inget
//   • collection group-frågor mot kgSelf/kgSecret nekas alla (även admin)
//   • eleven listar inte kgSelf/kgPlayers ens med filter på sig själv i fel form
// Körs av `npm run test:rules` (Firestore-emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, collectionGroup, doc, documentId, getDoc, getDocs, query, setDoc, where, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const SID = "pagar";
const sub = (db, col, id) => doc(db, "liveSessions", SID, col, id);
const arskurs = (uid) => testEnv.authenticatedContext(uid, { teacher: true, role: "arskurs" }).firestore();

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-kurragomma-838"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "omar"] });
    await setDoc(doc(db, "classes", "4c"), { name: "4C", studentIds: ["cia"] });
    await setDoc(doc(db, "teacherAccounts", "ak4b"), { active: true, role: "arskurs", classIds: ["4b"] });
    await setDoc(doc(db, "teacherAccounts", "ak4c"), { active: true, role: "arskurs", classIds: ["4c"] });
    await setDoc(doc(db, "liveSessions", SID), {
      name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
      participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 510, countdownSeconds: 4,
      status: "live", createdBy: "ak4b", createdAt: ts(-H), startedAt: ts(-60_000),
      kgInstallningar: { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" }, kgFas: "leta",
    });
    for (const [u, roll] of [["alma", "gomd"], ["omar", "sokare"]]) {
      await setDoc(sub(db, "players", u), { uid: u, classId: "4b", name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      await setDoc(sub(db, "kgPlayers", u), { uid: u, classId: "4b", name: u, roll, poang: 0, ratt: 0, besvarade: 0, hittade: 0, laddningar: 1, harLast: true });
      await setDoc(sub(db, "kgSelf", u), { gomstalle: { x: 1, z: 2, skydd: 2, namn: "vid ladan" } });
      await setDoc(sub(db, "kgSecret", u), { x: 1, z: 2, gomd: roll === "gomd" });
    }
    await setDoc(sub(db, "kgEvents", "e1"), { t: Date.now(), typ: "vissling", x: 3, z: 4, plats: "vid ladan" });
  });
});

describe("Kurragömma: gömstället stannar hos eleven (testaren #838)", () => {
  it("årskurskontot för 4B (projektorn) läser kgPlayers och kgEvents – aldrig kgSelf eller kgSecret", async () => {
    const p = arskurs("ak4b");
    await assertSucceeds(getDocs(collection(p, "liveSessions", SID, "kgPlayers")));
    await assertSucceeds(getDocs(collection(p, "liveSessions", SID, "kgEvents")));
    await assertFails(getDoc(sub(p, "kgSelf", "alma")));
    await assertFails(getDocs(collection(p, "liveSessions", SID, "kgSelf")));
    await assertFails(getDoc(sub(p, "kgSecret", "alma")));
  });
  it("årskurskontot för en annan klass (4C) läser inget av matchen", async () => {
    const p = arskurs("ak4c");
    await assertFails(getDocs(collection(p, "liveSessions", SID, "kgPlayers")));
    await assertFails(getDoc(sub(p, "kgPlayers", "alma")));
    await assertFails(getDocs(collection(p, "liveSessions", SID, "kgEvents")));
    await assertFails(getDoc(sub(p, "kgSelf", "alma")));
  });
  it("collection group-frågor mot kgSelf och kgSecret nekas eleven och admin", async () => {
    for (const d of [elev("alma"), teacher()]) {
      await assertFails(getDocs(collectionGroup(d, "kgSelf")));
      await assertFails(getDocs(collectionGroup(d, "kgSecret")));
    }
    await assertFails(getDocs(query(collectionGroup(elev("omar"), "kgSelf"), where(documentId(), "==", `liveSessions/${SID}/kgSelf/alma`))));
  });
  it("sökaren (omar) läser inte gömmarens kgSelf eller kgPlayers; en elev i en annan klass läser inte ens sitt id", async () => {
    await assertFails(getDoc(sub(elev("omar"), "kgSelf", "alma")));
    await assertFails(getDocs(query(collection(elev("omar"), "liveSessions", SID, "kgPlayers"), where("roll", "==", "gomd"))));
    await assertSucceeds(getDoc(sub(elev("omar"), "kgSelf", "omar")));
    await assertFails(getDoc(sub(elev("cia"), "kgSelf", "alma")));
  });
});
