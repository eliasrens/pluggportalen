// ============================================================================
// Regel-tester: Klasscentret Klass-EXP (#477). Kör de RIKTIGA skrivplanerna ur
// src/klasscenter/kc-exp-skriv.js mot firestore.rules i emulatorn och bevisar:
//   • klassmedlem kan öka klassens EXP inom gränsen (+1..+3), shard + egen
//     elevpost i samma batch, och spara regelräknare (counts) utan EXP,
//   • icke-medlem, för stor ökning, sänkning, godtycklig set, främmande fält,
//     shard utan elevpost och tät upprepning (spärren) nekas,
//   • lärare kan ge klassbonus (bara uppåt), läsning: shards för alla
//     inloggade, elevposter bara för eleven själv/lärare,
//   • elevens egen studentData påverkas inte (skrivs inte alls).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch,
  increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import {
  planKlassExpWrites, planRaknareWrite, planKlassBonusWrite,
} from "../src/klasscenter/kc-exp-skriv.js";

let testEnv, unauth, elev, teacher;
const fv = { increment, serverTimestamp };

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
const award = (uid, over = {}) =>
  planKlassExpWrites({ classId: "6a", uid, antal: 1, kalla: "quiz", shard: 0, fv, ...over });
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
async function las(...path) {
  let snap;
  await seed(async (db) => { snap = await getDoc(doc(db, ...path)); });
  return snap.data();
}

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-klasscenter"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
  });
});

describe("Klass-EXP: klassmedlem inom gränsen", () => {
  it("medlem ökar +1 (shard + egen elevpost i samma batch)", async () => {
    await assertSucceeds(commit(elev("elev1"), award("elev1")));
    const s = await las("classCenters", "6a", "expShards", "0");
    const m = await las("classCenters", "6a", "expMembers", "elev1");
    if (s.exp !== 1 || m.exp !== 1) throw new Error("fel exp");
  });

  it("medlem ökar +3 (max) med regelräknare i samma skrivning", async () => {
    await assertSucceeds(commit(elev("elev1"), award("elev1", { antal: 3, raknare: { "memory|a": 2 }, shard: 4 })));
  });

  it("andra utdelningen efter spärren (15 s) godtas och ökar på befintliga dokument", async () => {
    await seed(async (db) => {
      const gammal = Timestamp.fromMillis(Date.now() - 60_000);
      await setDoc(doc(db, "classCenters", "6a", "expShards", "1"), { exp: 10, lastUid: "elev3", lastAt: gammal, lastKalla: "quiz" });
      await setDoc(doc(db, "classCenters", "6a", "expMembers", "elev1"), {
        uid: "elev1", exp: 4, counts: { "memory|a": 1 }, lastAt: gammal, lastAmount: 1, lastShard: 1, lastKalla: "quiz",
      });
    });
    await assertSucceeds(commit(elev("elev1"), award("elev1", { shard: 1, raknare: { "memory|a": 2 } })));
  });

  it("räknare (counts) utan EXP får sparas", async () => {
    await assertSucceeds(commit(elev("elev1"), [planRaknareWrite({ classId: "6a", uid: "elev1", raknare: { "rakna|ratt": 7 } })]));
  });

  it("alla inloggade (även annan klass) läser shardarna – inte utloggad", async () => {
    await commit(elev("elev1"), award("elev1"));
    await assertSucceeds(getDocs(collection(elev("elev2"), "classCenters", "6a", "expShards")));
    await assertFails(getDocs(collection(unauth(), "classCenters", "6a", "expShards")));
  });

  it("elevposten läses bara av eleven själv och lärare", async () => {
    await commit(elev("elev1"), award("elev1"));
    await assertSucceeds(getDoc(doc(elev("elev1"), "classCenters", "6a", "expMembers", "elev1")));
    await assertSucceeds(getDoc(doc(teacher(), "classCenters", "6a", "expMembers", "elev1")));
    await assertFails(getDoc(doc(elev("elev3"), "classCenters", "6a", "expMembers", "elev1")));
  });
});

describe("Klass-EXP: nekas", () => {
  it("icke-medlem (elev2 ∉ 6a) och utloggad nekas", async () => {
    await assertFails(commit(elev("elev2"), award("elev2")));
    await assertFails(commit(unauth(), award("elev2")));
  });

  it("påhittad klass nekas", async () => {
    await assertFails(commit(elev("elev1"),
      planKlassExpWrites({ classId: "finnsinte", uid: "elev1", antal: 1, kalla: "quiz", shard: 0, fv })));
  });

  it("för stor ökning (+4) nekas", async () => {
    const w = award("elev1");
    w[0].data.exp = increment(4);
    w[1].data.exp = increment(4);
    w[1].data.lastAmount = 4;
    await assertFails(commit(elev("elev1"), w));
  });

  it("shard-ökning utan elevpost nekas", async () => {
    await assertFails(commit(elev("elev1"), [award("elev1")[0]]));
  });

  it("elevpost och shard som inte stämmer överens nekas (olika belopp / annan shard)", async () => {
    const w = award("elev1", { antal: 2 });
    w[0].data.exp = increment(1);
    await assertFails(commit(elev("elev1"), w));
    const v = award("elev1", { shard: 0 });
    v[1].data.lastShard = 3;
    await assertFails(commit(elev("elev1"), v));
  });

  it("skriva i en klasskamrats elevpost nekas", async () => {
    await assertFails(commit(elev("elev3"), award("elev1")));
  });

  it("sänkning och godtycklig set nekas", async () => {
    await seed(async (db) => {
      const gammal = Timestamp.fromMillis(Date.now() - 60_000);
      await setDoc(doc(db, "classCenters", "6a", "expShards", "0"), { exp: 50, lastUid: "elev3", lastAt: gammal, lastKalla: "quiz" });
      await setDoc(doc(db, "classCenters", "6a", "expMembers", "elev1"), {
        uid: "elev1", exp: 5, lastAt: gammal, lastAmount: 1, lastShard: 0, lastKalla: "quiz",
      });
    });
    const sank = award("elev1");
    sank[0].data.exp = increment(-1);
    sank[1].data.exp = increment(-1);
    sank[1].data.lastAmount = -1;
    await assertFails(commit(elev("elev1"), sank));
    // Godtycklig set (exp = 9999) – både på shard och elevpost.
    const godtycklig = award("elev1");
    godtycklig[0].data.exp = 9999;
    await assertFails(commit(elev("elev1"), godtycklig));
    await assertFails(updateDoc(doc(elev("elev1"), "classCenters", "6a", "expShards", "0"), { exp: 9999 }));
    await assertFails(updateDoc(doc(elev("elev1"), "classCenters", "6a", "expMembers", "elev1"), { exp: 9999 }));
    // Radera nekas också för elever.
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "expShards", "0")));
  });

  it("tät upprepning (inom spärren 15 s) nekas", async () => {
    await assertSucceeds(commit(elev("elev1"), award("elev1")));
    await assertFails(commit(elev("elev1"), award("elev1", { shard: 1 })));
  });

  it("påhittad tid (lastAt ≠ serverns) och främmande fält nekas", async () => {
    const tid = award("elev1");
    tid[0].data.lastAt = Timestamp.fromMillis(Date.now());
    tid[1].data.lastAt = Timestamp.fromMillis(Date.now());
    await assertFails(commit(elev("elev1"), tid));
    const falt = award("elev1");
    falt[0].data.niva = 10;
    await assertFails(commit(elev("elev1"), falt));
  });

  it("shard-id utanför 0..4 nekas", async () => {
    await assertFails(commit(elev("elev1"), award("elev1", { shard: 7 })));
  });

  it("räknar-skrivning kan inte smyga in EXP", async () => {
    await assertFails(setDoc(doc(elev("elev1"), "classCenters", "6a", "expMembers", "elev1"),
      { uid: "elev1", counts: {}, exp: 50 }, { merge: true }));
  });
});

describe("Klassbonus (lärare)", () => {
  const bonus = (mangd, uid = "larare1") =>
    planKlassBonusWrite({ classId: "6a", uid, mangd, kalla: "live", shard: 2, fv });

  it("lärare ger bonus (+60) och kan nollställa (radera)", async () => {
    const w = bonus(60);
    await assertSucceeds(setDoc(doc(teacher(), ...w.path), w.data, { merge: true }));
    await assertSucceeds(deleteDoc(doc(teacher(), ...w.path)));
  });

  it("elev får inte ge lärarbonus; lärare får inte sänka eller ge > 1000", async () => {
    const e = bonus(60, "elev1");
    await assertFails(setDoc(doc(elev("elev1"), ...e.path), e.data, { merge: true }));
    const w = bonus(1);
    w.data.exp = increment(-5);
    await assertFails(setDoc(doc(teacher(), ...w.path), w.data, { merge: true }));
    const stor = bonus(1);
    stor.data.exp = increment(1001);
    await assertFails(setDoc(doc(teacher(), ...stor.path), stor.data, { merge: true }));
  });
});

describe("Elevens egna framsteg orörda", () => {
  it("en utdelning skriver inget i studentData", async () => {
    await seed((db) => setDoc(doc(db, "studentData", "elev1"), { coins: 10, xp: 5 }));
    await commit(elev("elev1"), award("elev1"));
    const sd = await las("studentData", "elev1");
    if (JSON.stringify(sd) !== JSON.stringify({ coins: 10, xp: 5 })) throw new Error("studentData ändrad");
  });
});
