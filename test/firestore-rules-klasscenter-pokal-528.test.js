// ============================================================================
// Regel-tester: fler pokaler (#528). Kör de RIKTIGA planerna (kc-pokal-typer
// korPokalUtdelning/planPokal/planLararPokal, kc-exp-skriv planKlassExpWrites)
// mot firestore.rules i emulatorn och bevisar:
//   • Mattematchen med 4 klasser: guld/silver/brons till rätt klass, aldrig
//     till fel placering; silver/brons kräver minst 3 deltagande klasser,
//   • Läsresan-räknaren: +1 bara i en Läsresan-EXP-skrivning (elev), aldrig
//     från annan källa, aldrig +2, aldrig av läraren,
//   • Läsresan-milstolpe: bara när klassens räknare når milstolpen, bara
//     kända milstolpar, en gång (idempotent), även när shards saknas,
//   • lärarens pokal: lärare med motiv + egen text; elev/utloggad nekas,
//     okänt/saknat motiv nekas, motiv på andra typer nekas; läraren tar bort
//     sina egna pokaler men aldrig vunna; elever kan aldrig skapa pokaler.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, deleteDoc, writeBatch, runTransaction, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import {
  korPokalUtdelning, planPokal, planLararPokal, pokalerUrKalla,
} from "../src/klasscenter/kc-pokal-typer.js";
import { planKlassExpWrites, planKlassBonusWrite } from "../src/klasscenter/kc-exp-skriv.js";

let testEnv, unauth, elev, teacher;
const sdk = { runTransaction, doc, serverTimestamp };
const fv = { serverTimestamp, increment };

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
async function las(...path) {
  let snap;
  await seed(async (db) => { snap = await getDoc(doc(db, ...path)); });
  return snap.exists() ? snap.data() : null;
}
function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
const dela = (db, classId, typ, kallaId, uid = "larare1") =>
  korPokalUtdelning(sdk, db, { classId, typ, kallaId, uid });
function skapa(db, classId, typ, kallaId, { uid = "larare1", extra = {} } = {}) {
  const p = planPokal({ typ, kallaId, uid, fv });
  assert.equal(p.ok, true, p.error);
  return setDoc(doc(db, "classCenters", classId, "trophies", p.id), { ...p.data, ...extra });
}
function lararPokal(db, classId, over = {}, uid = "larare1") {
  const p = planLararPokal({ motiv: "stjarna", titel: "Bästa samarbetet i oktober!", text: "Ni hjälpte varandra.", uid, fv, ...over });
  assert.equal(p.ok, true, p.error);
  return { id: p.id, write: setDoc(doc(db, "classCenters", classId, "trophies", p.id), p.data) };
}

// Fyra klasser i Klasskampen: 6a 1:a, 6b 2:a, 6c 3:a, 6d 4:a.
const MM4 = {
  name: "Mattematchen oktober", participatingClassIds: ["6a", "6b", "6c", "6d"], status: "finished",
  startAt: Timestamp.fromMillis(1), endAt: Timestamp.fromMillis(2), counterShards: 5,
  result: { winnerClass: "6a", winnerClasses: ["6a"], silverClasses: ["6b"], bronzeClasses: ["6c"], classes: [] },
};
const MM2 = {
  ...MM4, participatingClassIds: ["6a", "6b"],
  result: { winnerClass: "6a", winnerClasses: ["6a"], silverClasses: ["6b"], bronzeClasses: [], classes: [] },
};
const gammal = () => Timestamp.fromMillis(Date.now() - 60_000);

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-pokal-528"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    for (const [id, elever] of [["6a", ["elev1"]], ["6b", ["elev2"]], ["6c", ["elev3"]], ["6d", ["elev4"]]]) {
      await setDoc(doc(db, "classes", id), { name: id.toUpperCase(), studentIds: elever });
    }
    await setDoc(doc(db, "mathCompetitions", "mm4"), MM4);
    await setDoc(doc(db, "mathCompetitions", "mm2"), MM2);
  });
});

describe("Mattematchen guld/silver/brons (4 klasser)", () => {
  it("avslutsflödet: guld → 6a, silver → 6b, brons → 6c, inget till 6d", async () => {
    const t = teacher();
    for (const p of pokalerUrKalla("mattematchen", "mm4", MM4)) {
      const r = await dela(t, p.classId, p.typ, "mm4");
      assert.equal(r.ny, true, `${p.typ} → ${p.classId}`);
    }
    assert.equal((await las("classCenters", "6a", "trophies", "mm-klasskamp-mm4")).titel, "Mattematchens mästare");
    assert.equal((await las("classCenters", "6b", "trophies", "mm-silver-mm4")).titel, "Mattematchen – silver");
    assert.equal((await las("classCenters", "6c", "trophies", "mm-brons-mm4")).titel, "Mattematchen – brons");
    assert.equal(await las("classCenters", "6d", "trophies", "mm-brons-mm4"), null);
    // Igen (andra lärarfliken) → inget nytt.
    assert.equal((await dela(t, "6b", "mm-silver", "mm4")).ny, false);
  });

  it("fel placering nekas: silver till 1:an/3:an/4:an, brons till 2:an", async () => {
    await assertFails(skapa(teacher(), "6a", "mm-silver", "mm4"));
    await assertFails(skapa(teacher(), "6c", "mm-silver", "mm4"));
    await assertFails(skapa(teacher(), "6d", "mm-silver", "mm4"));
    await assertFails(skapa(teacher(), "6b", "mm-brons", "mm4"));
    await assertFails(skapa(teacher(), "6d", "mm-brons", "mm4"));
  });

  it("färre än 3 deltagande klasser → ingen silver (även om result säger det)", async () => {
    await assertFails(skapa(teacher(), "6b", "mm-silver", "mm2"));
    await assertSucceeds(skapa(teacher(), "6a", "mm-klasskamp", "mm2"));
  });

  it("pågående tävling → ingen silver; elev kan aldrig dela ut", async () => {
    await seed((db) => setDoc(doc(db, "mathCompetitions", "mmPagar"), { ...MM4, status: "active" }));
    await assertFails(skapa(teacher(), "6b", "mm-silver", "mmPagar"));
    await assertFails(skapa(elev("elev2"), "6b", "mm-silver", "mm4", { uid: "elev2" }));
  });
});

describe("Läsresan-räknaren i EXP-skrivningen", () => {
  const las1 = (uid, over = {}) =>
    planKlassExpWrites({ classId: "6a", uid, antal: 1, kalla: "lasresan", shard: 0, fv, ...over });

  it("en godkänd Läsresan-text: shard + elevpost, lasresan +1", async () => {
    await assertSucceeds(commit(elev("elev1"), las1("elev1")));
    assert.equal((await las("classCenters", "6a", "expShards", "0")).lasresan, 1);
  });

  it("annan källa får inte räkna Läsresan-texter", async () => {
    const w = planKlassExpWrites({ classId: "6a", uid: "elev1", antal: 1, kalla: "quiz", shard: 0, fv });
    w[0].data.lasresan = increment(1);
    await assertFails(commit(elev("elev1"), w));
  });

  it("+2 på en gång nekas, även från Läsresan", async () => {
    const w = las1("elev1");
    w[0].data.lasresan = increment(2);
    await assertFails(commit(elev("elev1"), w));
  });

  it("räknaren får aldrig sänkas", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "classCenters", "6a", "expShards", "0"), { exp: 5, lasresan: 5, lastUid: "x", lastAt: gammal(), lastKalla: "quiz" });
    });
    const w = las1("elev1");
    w[0].data.lasresan = 4;
    await assertFails(commit(elev("elev1"), w));
  });

  it("läraren kan inte röra räknaren (klassbonusen)", async () => {
    const w = planKlassBonusWrite({ classId: "6a", uid: "larare1", mangd: 10, kalla: "lasresan", shard: 0, fv });
    w.data.lasresan = increment(100);
    await assertFails(setDoc(doc(teacher(), ...w.path), w.data, { merge: true }));
    delete w.data.lasresan;
    await assertSucceeds(setDoc(doc(teacher(), ...w.path), w.data, { merge: true }));
  });

  it("gammal klient utan räknaren godtas fortfarande (räknar bara inte)", async () => {
    const w = las1("elev1");
    delete w[0].data.lasresan;
    await assertSucceeds(commit(elev("elev1"), w));
  });
});

describe("Läsresan-milstolpar", () => {
  async function lasta(per) {
    await seed(async (db) => {
      for (const [shard, n] of Object.entries(per)) {
        await setDoc(doc(db, "classCenters", "6a", "expShards", shard), { exp: n, lasresan: n, lastUid: "x", lastAt: gammal(), lastKalla: "lasresan" });
      }
    });
  }

  it("klassen har läst 120 (över 3 shards, 2 saknas) → 100-pokalen en gång, inte 250", async () => {
    await lasta({ 0: 50, 2: 40, 4: 30 });
    assert.equal((await dela(teacher(), "6a", "lasresan-milstolpe", "100")).ny, true);
    assert.equal((await dela(teacher(), "6a", "lasresan-milstolpe", "100")).ny, false, "idempotent");
    assert.equal((await las("classCenters", "6a", "trophies", "lasresan-milstolpe-100")).titel, "Läsresan: 100 texter");
    await assertFails(skapa(teacher(), "6a", "lasresan-milstolpe", "250"));
  });

  it("99 räcker inte; inget räknat → nej", async () => {
    await assertFails(skapa(teacher(), "6a", "lasresan-milstolpe", "100"));
    await lasta({ 1: 99 });
    await assertFails(skapa(teacher(), "6a", "lasresan-milstolpe", "100"));
  });

  it("bara kända milstolpar", async () => {
    await lasta({ 0: 200, 1: 200, 2: 200, 3: 200, 4: 200 });
    await assertSucceeds(skapa(teacher(), "6a", "lasresan-milstolpe", "1000"));
    await assertFails(skapa(teacher(), "6a", "lasresan-milstolpe", "150"));
    await assertFails(skapa(teacher(), "6a", "lasresan-milstolpe", "1"));
  });

  it("elev kan inte dela ut milstolpen, inte ens när den är nådd", async () => {
    await lasta({ 0: 300 });
    await assertFails(skapa(elev("elev1"), "6a", "lasresan-milstolpe", "100", { uid: "elev1" }));
  });
});

describe("Lärarens pokal", () => {
  it("lärare delar ut en egen pokal → syns med egen titel och text", async () => {
    const { id, write } = lararPokal(teacher(), "6a");
    await assertSucceeds(write);
    const d = await las("classCenters", "6a", "trophies", id);
    assert.equal(d.titel, "Bästa samarbetet i oktober!");
    assert.equal(d.detalj, "Ni hjälpte varandra.");
    assert.equal(d.motiv, "stjarna");
    // Läsbar för alla inloggade (gästläget).
    await assertSucceeds(getDoc(doc(elev("elev2"), "classCenters", "6a", "trophies", id)));
  });

  it("elev och utloggad kan inte skapa pokaler", async () => {
    await assertFails(lararPokal(elev("elev1"), "6a", {}, "elev1").write);
    const p = planLararPokal({ motiv: "guld", titel: "Hej", uid: "x", fv });
    await assertFails(setDoc(doc(unauth(), "classCenters", "6a", "trophies", p.id), p.data));
  });

  it("motiv: saknat, okänt eller på fel typ nekas", async () => {
    const p = planLararPokal({ motiv: "guld", titel: "Hej", uid: "larare1", fv });
    const { motiv, ...utan } = p.data;
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a", "trophies", p.id), utan));
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a", "trophies", p.id), { ...p.data, motiv: "drake" }));
    await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm4", { extra: { motiv: "guld" } }));
  });

  it("för lång titel/text och fel id nekas", async () => {
    const p = planLararPokal({ motiv: "guld", titel: "Hej", uid: "larare1", fv });
    const ref = doc(teacher(), "classCenters", "6a", "trophies", p.id);
    await assertFails(setDoc(ref, { ...p.data, titel: "x".repeat(81) }));
    await assertFails(setDoc(ref, { ...p.data, detalj: "x".repeat(121) }));
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a", "trophies", "larare-annat"), p.data));
  });

  it("läraren tar bort sin pokal men aldrig en vunnen; eleven kan inte ta bort", async () => {
    const { id, write } = lararPokal(teacher(), "6a");
    await write;
    await skapa(teacher(), "6a", "mm-klasskamp", "mm4");
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "trophies", id)));
    await assertFails(deleteDoc(doc(teacher(), "classCenters", "6a", "trophies", "mm-klasskamp-mm4")));
    await assertSucceeds(deleteDoc(doc(teacher(), "classCenters", "6a", "trophies", id)));
  });

  it("lärarpokalen kan inte ändras i efterhand", async () => {
    const { id, write } = lararPokal(teacher(), "6a");
    await write;
    const p = planLararPokal({ motiv: "guld", titel: "Ändrad", uid: "larare1", fv, kallaId: id.slice(7) });
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a", "trophies", id), p.data));
  });
});
