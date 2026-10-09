// ============================================================================
// Regel-tester: Live-mynt till klasskassan + klasskassör (#526). Kör de
// RIKTIGA skrivplanerna (korLivePris / korKassaUt ur src/klasscenter/
// kc-kassa-plan.js) mot firestore.rules i emulatorn och bevisar:
//   • Live-priset: sätts bara vid skapandet (heltal 0–100 000), låst efteråt;
//     result skrivs aldrig om.
//   • Utbetalning: bara lärare, bara avslutad match, bara vinnarklass(er),
//     exakt priset (oavgjort: lika delar, nedåt), EN gång – även med tre
//     samtidiga projektorer. Elevens egna mynt rörs inte.
//   • Uttag: bara kassör (i klassprofilens kassorer) eller lärare, atomärt
//     med fund-ökningen, aldrig mer än saldot, aldrig till/från annan klass,
//     samma cap som donationer (överskott stannar i kassan).
//   • Läsning: bara klassen + lärare; historiken kan inte ändras/raderas.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocFromServer, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, writeBatch,
  increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import {
  korLivePris, korKassaUt, livePrisPoster, planKassaInWrites, planKassaUt, planKassaUtWrites,
} from "../src/klasscenter/kc-kassa-plan.js";
import { korDonation } from "../src/klasscenter/kc-fund-plan.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";

let testEnv, unauth, elev, teacher;
const sdk = { doc, collection, getDoc, getDocFromServer, writeBatch, increment, serverTimestamp };
const staty = kcShopItem("guldstaty");

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
async function las(...path) {
  let snap;
  await seed(async (db) => { snap = await getDoc(doc(db, ...path)); });
  return snap.exists() ? snap.data() : null;
}
function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
  return b.commit();
}
const saldo = async (classId) => (await las("classCenters", classId, "kassa", "saldo"))?.saldo ?? 0;

const START = Timestamp.fromMillis(Date.now() - 30 * 60_000);
function session(over = {}) {
  return {
    name: "6A mot 6B", gameMode: "multiplication_0_10", participatingClassIds: ["6a", "6b"],
    classNames: { "6a": "6A", "6b": "6B" }, classDivisors: { "6a": 2, "6b": 1 },
    durationSeconds: 300, countdownSeconds: 4, counterShards: 10, status: "finished",
    createdBy: "larare1", startedAt: START, coinPrize: 1000,
    result: {
      winner: "6a", winnerClasses: ["6a"], totalCorrect: 12, players: 3,
      perClass: { "6a": { correct: 10, divisor: 2, score: 5, players: 2 }, "6b": { correct: 2, divisor: 1, score: 2, players: 1 } },
    },
    ...over,
  };
}
const betala = (sid, db = teacher(), uid = "larare1") =>
  (async () => korLivePris(sdk, db, { sid, session: (await las("liveSessions", sid)), uid }))();
const uttag = (db, uid, amount, over = {}) =>
  korKassaUt(sdk, db, { classId: "6a", uid, itemId: "guldstaty", amount, ...over });
async function kassaLage(n) {
  await seed(async (db) => {
    await setDoc(doc(db, "classCenters", "6a", "kassa", "saldo"), { saldo: n, lastTxId: "live-gammal" });
    await setDoc(doc(db, "classCenters", "6a", "kassaHistorik", "live-gammal"), { typ: "in", belopp: n });
  });
}

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-kassa"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
    for (const uid of ["elev1", "elev2", "elev3"]) await setDoc(doc(db, "studentData", uid), { coins: 1000 });
    await setDoc(doc(db, "classCenters", "6a"), { kassorer: ["elev1"] });
    await setDoc(doc(db, "classCenters", "6b"), { kassorer: ["elev2"] });
    await setDoc(doc(db, "liveSessions", "sFin"), session());
    await setDoc(doc(db, "liveSessions", "sDraw"), session({
      coinPrize: 1001, result: { ...session().result, winner: "draw", winnerClasses: ["6a", "6b"] },
    }));
  });
});

describe("Live-sessionens mynt-pris", () => {
  const ny = (over = {}) => ({
    name: "6A mot 6B", gameMode: "multiplication_0_10", participatingClassIds: ["6a", "6b"],
    classNames: { "6a": "6A", "6b": "6B" }, classDivisors: { "6a": 2, "6b": 1 },
    durationSeconds: 300, countdownSeconds: 4, counterShards: 10, status: "lobby",
    createdBy: "larare1", createdAt: serverTimestamp(), ...over,
  });
  it("läraren skapar med pris 1000 (och utan pris)", async () => {
    await assertSucceeds(addDoc(collection(teacher(), "liveSessions"), ny({ coinPrize: 1000 })));
    await assertSucceeds(addDoc(collection(teacher(), "liveSessions"), ny()));
    await assertSucceeds(addDoc(collection(teacher(), "liveSessions"), ny({ coinPrize: 0 })));
  });
  it("ogiltigt pris nekas (negativt, decimal, text, över taket) och elev skapar inte", async () => {
    for (const coinPrize of [-1, 1.5, "1000", 100001]) {
      await assertFails(addDoc(collection(teacher(), "liveSessions"), ny({ coinPrize })));
    }
    await assertFails(addDoc(collection(elev("elev1"), "liveSessions"), ny({ coinPrize: 1000 })));
  });
  it("priset kan inte ändras efter skapandet – varken i lobbyn, under matchen eller efteråt", async () => {
    await seed((db) => setDoc(doc(db, "liveSessions", "sLobby"), session({ status: "lobby", startedAt: null, result: null })));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "sLobby"), { name: "Nytt namn" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "sLobby"), { coinPrize: 5000 }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "sFin"), { coinPrize: 5000 }));
    await assertFails(updateDoc(doc(elev("elev1"), "liveSessions", "sFin"), { coinPrize: 5000 }));
  });
  it("ett skrivet result skrivs aldrig om (vinnaren kan inte bytas efter utbetalning)", async () => {
    const r = { ...session().result, winner: "6b", winnerClasses: ["6b"] };
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "sFin"), { result: r }));
    // #543: efter slut är även nämnaren låst (resultat/pris redan utdelat).
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "sFin"), { "classDivisors.6a": 3 }));
  });
});

describe("Utbetalning till klasskassan", () => {
  it("vinnaren 6A får 1000 en gång; elevernas egna mynt rörs inte", async () => {
    const r = await betala("sFin");
    assert.deepEqual(r.map((x) => [x.classId, x.belopp, x.status]), [["6a", 1000, "betald"]]);
    assert.equal(await saldo("6a"), 1000);
    assert.equal(await saldo("6b"), 0);
    const h = await las("classCenters", "6a", "kassaHistorik", "live-sFin");
    assert.equal(h.typ, "in");
    assert.equal(h.belopp, 1000);
    assert.equal(h.sessionId, "sFin");
    const igen = await betala("sFin");
    assert.equal(igen[0].status, "redan");
    assert.equal(await saldo("6a"), 1000);
    for (const uid of ["elev1", "elev2", "elev3"]) assert.equal((await las("studentData", uid)).coins, 1000);
  });

  it("tre samtidiga projektorer → saldot ökar EN gång", async () => {
    const r = await Promise.all([1, 2, 3].map(() => betala("sFin")));
    assert.equal(r.flat().filter((x) => x.status === "betald").length, 1);
    assert.ok(r.flat().every((x) => x.status !== "nekad"));
    assert.equal(await saldo("6a"), 1000);
  });

  it("oavgjort mellan två klasser → lika delar avrundat nedåt (1001 → 500 var)", async () => {
    const r = await betala("sDraw");
    assert.deepEqual(r.map((x) => [x.classId, x.belopp, x.status]), [["6a", 500, "betald"], ["6b", 500, "betald"]]);
    assert.equal(await saldo("6a"), 500);
    assert.equal(await saldo("6b"), 500);
  });

  it("insättning på befintligt saldo adderas", async () => {
    await kassaLage(250);
    await betala("sFin");
    assert.equal(await saldo("6a"), 1250);
  });

  const post = (over = {}) => ({ classId: "6a", txId: "live-sFin", belopp: 1000, titel: "x", ...over });
  const inW = (p, uid = "larare1", sessionId = "sFin") =>
    planKassaInWrites({ classId: p.classId, post: p, uid, sessionId, fv: { increment, serverTimestamp } });

  it("positiv kontroll: handbyggd insättning går", async () => {
    await assertSucceeds(commit(teacher(), inW(post())));
  });
  it("elev (även kassör) kan inte betala in", async () => {
    await assertFails(commit(elev("elev1"), inW(post(), "elev1")));
  });
  it("fel belopp nekas (mer, mindre, hela priset vid oavgjort)", async () => {
    await assertFails(commit(teacher(), inW(post({ belopp: 2000 }))));
    await assertFails(commit(teacher(), inW(post({ belopp: 999 }))));
    await assertFails(commit(teacher(), inW(post({ belopp: 1001, txId: "live-sDraw" }), "larare1", "sDraw")));
  });
  it("förloraren och en klass som inte var med får inget", async () => {
    await assertFails(commit(teacher(), inW(post({ classId: "6b" }))));
    await seed((db) => setDoc(doc(db, "classes", "6c"), { name: "6C", studentIds: [] }));
    await assertFails(commit(teacher(), inW(post({ classId: "6c" }))));
  });
  it("pågående match, avbruten lobby, utan pris eller utan vinnare (0 poäng) nekas", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "liveSessions", "sLive"), session({ status: "live" }));
      await setDoc(doc(db, "liveSessions", "sAvbr"), session({ startedAt: null }));
      await setDoc(doc(db, "liveSessions", "sGratis"), session({ coinPrize: 0 }));
      await setDoc(doc(db, "liveSessions", "sNoll"), session({ result: { ...session().result, winnerClasses: [] } }));
    });
    for (const sid of ["sLive", "sAvbr", "sGratis", "sNoll"]) {
      await assertFails(commit(teacher(), inW(post({ txId: `live-${sid}` }), "larare1", sid)));
    }
  });
  it("fel id (inte live-<sessionId>) och dubbel utbetalning med annat id nekas", async () => {
    await assertFails(commit(teacher(), inW(post({ txId: "live-sAnnan" }))));
    await assertFails(commit(teacher(), inW(post({ txId: "egen-id" }))));
    await betala("sFin");
    await assertFails(commit(teacher(), inW(post())));
  });
  it("saldo utan historikpost, historik utan saldo, eller ökning ≠ beloppet nekas", async () => {
    const w = inW(post());
    await assertFails(commit(teacher(), [w[0]]));
    await assertFails(commit(teacher(), [w[1]]));
    const fel = inW(post());
    fel[0].data.saldo = increment(5000);
    await assertFails(commit(teacher(), fel));
  });
});

describe("Uttag: kassören lägger från klasskassan", () => {
  it("kassör lägger 300 på statyn → mätaren +300, kassan −300, historik + donationspost", async () => {
    await kassaLage(1000);
    const r = await assertSucceeds(uttag(elev("elev1"), "elev1", 300));
    assert.equal(r.ok, true);
    assert.equal(r.amount, 300);
    assert.equal(await saldo("6a"), 700);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.equal(f.fundedAmount, 300);
    assert.equal(f.lastDonationId, r.txId);
    const h = await las("classCenters", "6a", "kassaHistorik", r.txId);
    assert.deepEqual([h.typ, h.itemId, h.belopp, h.uid], ["ut", "guldstaty", 300, "elev1"]);
    const d = await las("classCenters", "6a", "donations", r.txId);
    assert.equal(d.kassa, true);
    assert.equal((await las("studentData", "elev1")).coins, 1000); // egna mynt orörda
  });

  it("läraren får också lägga från kassan", async () => {
    await kassaLage(1000);
    const r = await assertSucceeds(uttag(teacher(), "larare1", 400));
    assert.equal(r.ok, true);
    assert.equal(await saldo("6a"), 600);
  });

  it("vanlig klasskamrat, gäst (kassör i en annan klass) och utloggad nekas", async () => {
    await kassaLage(1000);
    for (const [db, uid] of [[elev("elev3"), "elev3"], [elev("elev2"), "elev2"], [unauth(), "elev1"]]) {
      await assert.rejects(uttag(db, uid, 100, { forsok: 2 }), (e) => e.code === "permission-denied");
    }
    assert.equal(await saldo("6a"), 1000);
  });

  it("utan utsedd kassör: bara läraren", async () => {
    await seed((db) => setDoc(doc(db, "classCenters", "6a"), { kassorer: [] }));
    await kassaLage(1000);
    await assert.rejects(uttag(elev("elev1"), "elev1", 100, { forsok: 2 }));
    await assertSucceeds(uttag(teacher(), "larare1", 100));
  });

  it("mer än saldot: klienten cappar; handbyggt övertrassering nekas", async () => {
    await kassaLage(200);
    const r = await uttag(elev("elev1"), "elev1", 500);
    assert.equal(r.amount, 200);
    assert.equal(await saldo("6a"), 0);
    assert.equal((await uttag(elev("elev1"), "elev1", 10)).kod, "for-lite-mynt");
    // handbyggt: 300 ur en kassa med 200
    await kassaLage(200);
    const p = { ...planKassaUt({ item: staty, amount: 300, saldo: 1000 }) };
    const w = planKassaUtWrites({ classId: "6a", uid: "elev1", itemId: "guldstaty", plan: p, txId: "tx-over", saldoFore: 200, fv: { serverTimestamp, increment } });
    await assertFails(commit(elev("elev1"), w));
  });

  it("samma cap som donationer: 4900/5000 + kassa 300 → bara 100 tas, köpt", async () => {
    await kassaLage(1000);
    await seed((db) => setDoc(doc(db, "classCenters", "6a", "fund", "guldstaty"), {
      targetPrice: 5000, fundedAmount: 4900, isUnlocked: false, lastDonationId: "gammal",
    }));
    const r = await uttag(elev("elev1"), "elev1", 300);
    assert.equal(r.amount, 100);
    assert.equal(r.isUnlocked, true);
    assert.equal(await saldo("6a"), 900);
    assert.equal((await las("classCenters", "6a", "fund", "guldstaty")).isUnlocked, true);
    assert.equal((await uttag(elev("elev1"), "elev1", 10)).kod, "redan-kopt");
  });

  it("kassa och elevdonation fyller samma mätare", async () => {
    await kassaLage(1000);
    await korDonation(sdk, elev("elev3"), { classId: "6a", uid: "elev3", itemId: "guldstaty", amount: 150 });
    await uttag(elev("elev1"), "elev1", 300);
    assert.equal((await las("classCenters", "6a", "fund", "guldstaty")).fundedAmount, 450);
  });

  it("aldrig till/från en annan klass: 6A:s kassör rör inte 6B", async () => {
    await kassaLage(1000);
    await seed((db) => setDoc(doc(db, "classCenters", "6b", "kassa", "saldo"), { saldo: 1000, lastTxId: "x" }));
    await assert.rejects(korKassaUt(sdk, elev("elev1"), { classId: "6b", uid: "elev1", itemId: "guldstaty", amount: 100, forsok: 2 }));
    // 6A:s kassa men 6B:s fund
    const p = planKassaUt({ item: staty, amount: 100, saldo: 1000 });
    const w = planKassaUtWrites({ classId: "6a", uid: "elev1", itemId: "guldstaty", plan: p, txId: "tx-x", saldoFore: 1000, fv: { serverTimestamp, increment } });
    w[3] = { ...w[3], path: ["classCenters", "6b", "fund", "guldstaty"] };
    await assertFails(commit(elev("elev1"), w));
  });

  const ut = (over = {}) => {
    const p = planKassaUt({ item: staty, amount: 100, saldo: 1000 });
    return planKassaUtWrites({ classId: "6a", uid: "elev1", itemId: "guldstaty", plan: p, txId: "tx-1", saldoFore: 1000, fv: { serverTimestamp, increment }, ...over });
  };
  it("positiv kontroll: handbyggt uttag går", async () => {
    await kassaLage(1000);
    await assertSucceeds(commit(elev("elev1"), ut()));
  });
  it("en skrivning saknas (kassa/historik/donation/fund) → nekas", async () => {
    await kassaLage(1000);
    for (let i = 0; i < 4; i++) {
      const w = ut();
      w.splice(i, 1);
      await assertFails(commit(elev("elev1"), w));
    }
  });
  it("kassa-donation utan avdrag ur kassan, eller fund-ökning ≠ uttaget, nekas", async () => {
    await kassaLage(1000);
    const w = ut();
    w[0].data.saldo = increment(-50);
    await assertFails(commit(elev("elev1"), w));
    const w2 = ut();
    w2[1].data.belopp = 50;
    await assertFails(commit(elev("elev1"), w2));
    // vanlig elevdonation kan inte låtsas vara kassa (inget avdrag alls)
    const w3 = ut();
    await assertFails(commit(elev("elev3"), [w3[2], w3[3]].map((x) => ({ ...x, data: { ...x.data, uid: "elev3" } }))));
  });
});

describe("Läsning och oföränderlig historik", () => {
  it("klassen och läraren läser saldo + historik; gäst och utloggad nekas", async () => {
    await betala("sFin");
    for (const db of [elev("elev1"), elev("elev3"), teacher()]) {
      await assertSucceeds(getDoc(doc(db, "classCenters", "6a", "kassa", "saldo")));
      await assertSucceeds(getDocs(collection(db, "classCenters", "6a", "kassaHistorik")));
    }
    for (const db of [elev("elev2"), unauth()]) {
      await assertFails(getDoc(doc(db, "classCenters", "6a", "kassa", "saldo")));
      await assertFails(getDocs(collection(db, "classCenters", "6a", "kassaHistorik")));
    }
  });
  it("historik och saldo kan inte ändras eller raderas – inte ens av läraren", async () => {
    await betala("sFin");
    const h = doc(teacher(), "classCenters", "6a", "kassaHistorik", "live-sFin");
    await assertFails(updateDoc(h, { belopp: 5000 }));
    await assertFails(deleteDoc(h));
    await assertFails(deleteDoc(doc(teacher(), "classCenters", "6a", "kassa", "saldo")));
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a", "kassa", "saldo"), { saldo: 99999, lastTxId: "live-sFin" }));
  });
});

describe("Klasskassörer (klassprofilen)", () => {
  it("läraren sätter kassörer utan att röra inredningSparr; elev kan inte", async () => {
    await seed((db) => setDoc(doc(db, "classCenters", "6a"), { inredningSparr: ["elev3"], kassorer: [] }));
    await assertSucceeds(setDoc(doc(teacher(), "classCenters", "6a"), { kassorer: ["elev3"] }, { merge: true }));
    const p = await las("classCenters", "6a");
    assert.deepEqual(p.inredningSparr, ["elev3"]);
    assert.deepEqual(p.kassorer, ["elev3"]);
    await assertFails(setDoc(doc(elev("elev1"), "classCenters", "6a"), { kassorer: ["elev1"] }, { merge: true }));
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a"), { kassorer: "elev1" }, { merge: true }));
  });
  it("prisposterna räknas likadant i klienten (livePrisPoster)", () => {
    assert.deepEqual(livePrisPoster("sDraw", session({
      coinPrize: 1001, result: { winnerClasses: ["6a", "6b"] },
    })).map((p) => p.belopp), [500, 500]);
  });
});
