// ============================================================================
// Regel-tester: Klasscentret pokaler (#494). Kör den RIKTIGA transaktionen
// (korPokalUtdelning ur src/klasscenter/kc-pokal-typer.js) och dess skrivplan
// mot firestore.rules i emulatorn och bevisar:
//   • lärare delar ut mm-klasskamp/live-vinst/live-avklarat när källans
//     result visar att klassen vann/deltog – även i SAMMA batch som result,
//   • andra utdelningen är tyst (ny:false), dubblett-create/ändring/radering
//     nekas, samtidiga utdelare ger EN pokal,
//   • elev (även klassmedlem) och utloggad nekas,
//   • fel vinnare, pågående källa, oavgjort, klass utan spelare, id som inte
//     matchar typ+källa, främmande fält, fel wonAt/awardedBy nekas,
//   • pokaler läses av alla inloggade (gästläge), inte utloggade.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch, runTransaction,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { korPokalUtdelning, planPokal, pokalerUrKalla } from "../src/klasscenter/kc-pokal-typer.js";

let testEnv, unauth, elev, teacher;
const sdk = { runTransaction, doc, serverTimestamp };
const fv = { serverTimestamp };

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
async function las(...path) {
  let snap;
  await seed(async (db) => { snap = await getDoc(doc(db, ...path)); });
  return snap.exists() ? snap.data() : null;
}
const dela = (db, classId, typ, kallaId, uid = "larare1", detalj = "Detalj") =>
  korPokalUtdelning(sdk, db, { classId, typ, kallaId, detalj, uid });
// Skrivplanen direkt (utan transaktionens exists-koll).
function skapa(db, classId, typ, kallaId, { uid = "larare1", id, extra = {} } = {}) {
  const p = planPokal({ typ, kallaId, uid, detalj: "Detalj", fv });
  assert.equal(p.ok, true, p.error);
  return setDoc(doc(db, "classCenters", classId, "trophies", id || p.id), { ...p.data, ...extra });
}

const MM = {
  name: "Mattematchen oktober", participatingClassIds: ["6a", "6b"], status: "finished",
  startAt: Timestamp.fromMillis(1), endAt: Timestamp.fromMillis(2), counterShards: 5,
  result: { winnerClass: "6a", classes: [] },
};
const LIVE = {
  name: "6A mot 6B", gameMode: "multiplication_0_10", participatingClassIds: ["6a", "6b", "6c"],
  status: "finished", durationSeconds: 60, countdownSeconds: 3, counterShards: 10,
  classDivisors: { "6a": 1, "6b": 1, "6c": 1 },
  result: { winner: "6b", perClass: { "6a": { players: 3 }, "6b": { players: 2 }, "6c": { players: 0 } } },
};

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-pokal"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
    await setDoc(doc(db, "mathCompetitions", "mm1"), MM);
    await setDoc(doc(db, "mathCompetitions", "mmPagar"), { ...MM, status: "active", result: null });
    await setDoc(doc(db, "liveSessions", "s1"), LIVE);
    await setDoc(doc(db, "liveSessions", "sDraw"), { ...LIVE, result: { ...LIVE.result, winner: "draw" } });
    await setDoc(doc(db, "liveSessions", "sPagar"), { ...LIVE, status: "live", result: null });
  });
});

describe("Pokaler: lärare delar ut", () => {
  it("mm-klasskamp till Klasskampens vinnare → dokumentet med rätt fält", async () => {
    const r = await assertSucceeds(dela(teacher(), "6a", "mm-klasskamp", "mm1"));
    assert.deepEqual(r, { ok: true, id: "mm-klasskamp-mm1", ny: true });
    const p = await las("classCenters", "6a", "trophies", "mm-klasskamp-mm1");
    assert.equal(p.typ, "mm-klasskamp");
    assert.equal(p.kallaId, "mm1");
    assert.equal(p.titel, "Mattematchens mästare");
    assert.equal(p.detalj, "Detalj");
    assert.equal(p.awardedBy, "larare1");
    assert.ok(p.wonAt?.toMillis() > 0);
  });
  it("live-vinst till vinnaren, live-avklarat till klasser med spelare", async () => {
    await assertSucceeds(dela(teacher(), "6b", "live-vinst", "s1"));
    await assertSucceeds(dela(teacher(), "6a", "live-avklarat", "s1"));
    await assertSucceeds(dela(teacher(), "6b", "live-avklarat", "s1"));
  });
  it("alla pokaler pokalerUrKalla föreslår godtas av reglerna", async () => {
    const lista = [...pokalerUrKalla("live", "s1", LIVE), ...pokalerUrKalla("mattematchen", "mm1", MM)];
    assert.equal(lista.length, 4);
    for (const p of lista) await assertSucceeds(dela(teacher(), p.classId, p.typ, p.kallaId, "larare1", p.detalj));
  });
  it("pokalen i SAMMA batch som källans result (getAfter)", async () => {
    await seed((db) => setDoc(doc(db, "liveSessions", "sNy"), { ...LIVE, result: null }));
    const db = teacher();
    const p = planPokal({ typ: "live-vinst", kallaId: "sNy", uid: "larare1", fv });
    const b = writeBatch(db);
    b.set(doc(db, "liveSessions", "sNy"), { result: LIVE.result }, { merge: true });
    b.set(doc(db, "classCenters", "6b", "trophies", p.id), p.data);
    await assertSucceeds(b.commit());
  });
});

describe("Pokaler: idempotens och create-only", () => {
  it("andra utdelningen är tyst (ny:false) och ändrar inget", async () => {
    await dela(teacher(), "6a", "mm-klasskamp", "mm1", "larare1", "Först");
    const r = await assertSucceeds(dela(teacher(), "6a", "mm-klasskamp", "mm1", "larare1", "Sen"));
    assert.equal(r.ny, false);
    assert.equal((await las("classCenters", "6a", "trophies", "mm-klasskamp-mm1")).detalj, "Först");
  });
  it("dubblett-create (set på befintlig), ändring och radering nekas – även för lärare", async () => {
    await dela(teacher(), "6a", "mm-klasskamp", "mm1");
    await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm1"));
    const ref = doc(teacher(), "classCenters", "6a", "trophies", "mm-klasskamp-mm1");
    await assertFails(updateDoc(ref, { titel: "Ändrad" }));
    await assertFails(deleteDoc(ref));
  });
  it("tre samtidiga utdelare → EN pokal, alla ok", async () => {
    const r = await Promise.all([1, 2, 3].map(() => dela(teacher(), "6b", "live-vinst", "s1")));
    assert.ok(r.every((x) => x.ok));
    assert.equal(r.filter((x) => x.ny).length, 1);
    let n = 0;
    await seed(async (db) => { n = (await getDocs(collection(db, "classCenters", "6b", "trophies"))).size; });
    assert.equal(n, 1);
  });
});

describe("Pokaler: nekas", () => {
  it("elev – även klassmedlem i vinnarklassen – och utloggad nekas", async () => {
    await assertFails(skapa(elev("elev1"), "6a", "mm-klasskamp", "mm1", { uid: "elev1" }));
    await assertFails(dela(elev("elev1"), "6a", "mm-klasskamp", "mm1", "elev1"));
    await assertFails(skapa(unauth(), "6a", "mm-klasskamp", "mm1", { uid: "x" }));
  });
  it("fel vinnare nekas (MM och Live)", async () => {
    await assertFails(dela(teacher(), "6b", "mm-klasskamp", "mm1"));
    await assertFails(dela(teacher(), "6a", "live-vinst", "s1"));
  });
  it("pågående källa, oavgjort, saknad källa och klass utan spelare nekas", async () => {
    await assertFails(dela(teacher(), "6a", "mm-klasskamp", "mmPagar"));
    await assertFails(dela(teacher(), "6b", "live-vinst", "sPagar"));
    await assertFails(dela(teacher(), "6b", "live-avklarat", "sPagar"));
    await assertFails(dela(teacher(), "6b", "live-vinst", "sDraw"));
    await assertFails(dela(teacher(), "6a", "mm-klasskamp", "finnsInte"));
    await assertFails(dela(teacher(), "6c", "live-avklarat", "s1"));
    await assertFails(dela(teacher(), "7z", "live-avklarat", "s1"));
  });
  it("typ ur fel källa nekas (live-typ mot en Mattematchen-tävling)", async () => {
    await seed((db) => setDoc(doc(db, "liveSessions", "mm1"), { ...LIVE, status: "lobby", result: null }));
    await assertFails(dela(teacher(), "6a", "live-avklarat", "mm1"));
  });
  it("id som inte matchar typ + källa, okänd typ och ogiltigt kallaId nekas", async () => {
    await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm1", { id: "mm-klasskamp-annan" }));
    await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm1", { id: "pokal1" }));
    await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm1", { id: "hittepa-mm1", extra: { typ: "hittepa" } }));
    await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm1", { id: "mm-klasskamp-mm 1", extra: { kallaId: "mm 1" } }));
  });
  it("främmande fält, fel wonAt/awardedBy, för lång titel/detalj nekas", async () => {
    const fel = [
      { coins: 1000 }, { awardedBy: "annan" }, { wonAt: Timestamp.fromMillis(5) },
      { titel: "" }, { titel: "x".repeat(81) }, { detalj: "x".repeat(121) }, { detalj: 5 },
    ];
    for (const extra of fel) await assertFails(skapa(teacher(), "6a", "mm-klasskamp", "mm1", { extra }));
    await assertSucceeds(skapa(teacher(), "6a", "mm-klasskamp", "mm1"));
  });
  it("klassprofilen tar fortfarande bara inredningSparr (inga pokaler där)", async () => {
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a"), { trophies: [{ id: "x" }] }, { merge: true }));
  });
});

describe("Pokaler: läsning", () => {
  it("alla inloggade (även annan klass) läser, utloggad nekas", async () => {
    await dela(teacher(), "6a", "mm-klasskamp", "mm1");
    await assertSucceeds(getDocs(collection(elev("elev1"), "classCenters", "6a", "trophies")));
    await assertSucceeds(getDocs(collection(elev("elev2"), "classCenters", "6a", "trophies")));
    await assertFails(getDocs(collection(unauth(), "classCenters", "6a", "trophies")));
  });
});
