// ============================================================================
// Regel-tester: Klasscentret – gäster, utloggade och lärarmodellen (#500).
// Se docs/SAKERHET-klasscentret.md (garanti 6 och 7). Bevisar för hela
// classCenters/{klass}:
//   • en GÄST (elev i en annan klass) läser det gästläget behöver – klass-EXP
//     (expShards), layout + historik, pokaler, insamlingen (fund) – men inte
//     elevposter, donationsposter eller klassprofilen (spärrlistan),
//   • gästen skriver INGENTING (samma skrivplaner som klassens egen elev får
//     igenom – positiv kontroll i varje test) och raderar ingenting,
//   • utloggad läser och skriver ingenting,
//   • förtroendemodell: läraranspråket (teacher:true) är globalt – en lärare
//     utan koppling till klassen får inreda, spärra och dela ut verifierade
//     pokaler. Testet låser beteendet så att en ändring syns.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planKlassExpWrites } from "../src/klasscenter/kc-exp-skriv.js";
import { planDonation, planDonationWrites } from "../src/klasscenter/kc-fund-plan.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";
import { planSave, planSaveWrites } from "../src/klasscenter/kc-layout-plan.js";
import { planPokal } from "../src/klasscenter/kc-pokal-typer.js";

let testEnv, unauth, elev, teacher;
const fv = { serverTimestamp };
const STATY = { guldstaty: { x: 30, y: 60, z: 2 } };

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
  return b.commit();
}
// Skrivplanerna appen kör, för `uid` i klassen `classId`.
const exp = (uid, classId = "6a") =>
  planKlassExpWrites({ classId, uid, antal: 1, kalla: "quiz", shard: 0, fv: { increment, serverTimestamp } });
function donation(uid, classId = "6a") {
  const plan = planDonation({ fund: null, item: kcShopItem("lounge"), amount: 50, coins: 1000 });
  return planDonationWrites({ classId, uid, itemId: "lounge", plan, donationId: `d-${uid}`, coinsFore: 1000, fv });
}
function layout(uid, classId = "6a") {
  const plan = planSave({ current: { version: 1 }, placedItems: STATY, uid });
  assert.equal(plan.ok, true, plan.error);
  return planSaveWrites({ classId, plan, fv }).map((w) => ({ ...w, merge: false }));
}
function pokal(db, uid, classId = "6a") {
  const p = planPokal({ typ: "mm-klasskamp", kallaId: "mm1", uid, fv });
  return setDoc(doc(db, "classCenters", classId, "trophies", p.id), p.data);
}
const sparr = (db, classId = "6a", lista = []) =>
  setDoc(doc(db, "classCenters", classId), { inredningSparr: lista }, { merge: true });

// Dokument under classCenters/6a som finns efter seeden (för läs/radera).
const DOKUMENT = {
  profil: ["classCenters", "6a"],
  shard: ["classCenters", "6a", "expShards", "1"],
  elevpost: ["classCenters", "6a", "expMembers", "elev1"],
  fund: ["classCenters", "6a", "fund", "guldstaty"],
  donation: ["classCenters", "6a", "donations", "seed-don"],
  layout: ["classCenters", "6a", "layout", "current"],
  historik: ["classCenters", "6a", "layoutHistory", "1"],
  pokal: ["classCenters", "6a", "trophies", "live-vinst-s0"],
};
const GAST_LASER = ["shard", "fund", "layout", "historik", "pokal"];
const GAST_LASER_INTE = ["elevpost", "donation", "profil"];

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-gast"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    const t = Timestamp.fromMillis(Date.now() - 60_000);
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
    for (const uid of ["elev1", "elev2", "elev3"]) await setDoc(doc(db, "studentData", uid), { coins: 1000 });
    await setDoc(doc(db, "mathCompetitions", "mm1"), {
      name: "MM", participatingClassIds: ["6a", "6b"], status: "finished", counterShards: 5,
      startAt: Timestamp.fromMillis(1), endAt: Timestamp.fromMillis(2), result: { winnerClass: "6a", classes: [] },
    });
    await setDoc(doc(db, ...DOKUMENT.profil), { inredningSparr: ["elev3"] });
    await setDoc(doc(db, ...DOKUMENT.shard), { exp: 40, lastUid: "elev1", lastAt: t, lastKalla: "quiz" });
    await setDoc(doc(db, ...DOKUMENT.elevpost), { uid: "elev1", exp: 40, lastAt: t, lastAmount: 1, lastShard: 1, lastKalla: "quiz" });
    await setDoc(doc(db, ...DOKUMENT.fund), { targetPrice: 5000, fundedAmount: 100, isUnlocked: false, lastDonationId: "seed-don" });
    await setDoc(doc(db, ...DOKUMENT.donation), { uid: "elev1", itemId: "guldstaty", amount: 100, at: t });
    await setDoc(doc(db, ...DOKUMENT.layout), { placedItems: {}, version: 1, updatedBy: "elev1", updatedAt: t });
    await setDoc(doc(db, ...DOKUMENT.historik), { placedItems: {}, version: 1, savedBy: "elev1", savedAt: t });
    await setDoc(doc(db, ...DOKUMENT.pokal), { typ: "live-vinst", kallaId: "s0", titel: "Live", wonAt: t, awardedBy: "larare1" });
  });
});

describe("Gästläge: läsning (garanti 6)", () => {
  it("gäst läser klass-EXP, insamling, layout, historik och pokaler", async () => {
    for (const k of GAST_LASER) await assertSucceeds(getDoc(doc(elev("elev2"), ...DOKUMENT[k])));
    await assertSucceeds(getDocs(collection(elev("elev2"), "classCenters", "6a", "expShards")));
    await assertSucceeds(getDocs(collection(elev("elev2"), "classCenters", "6a", "trophies")));
    await assertSucceeds(getDocs(collection(elev("elev2"), "classCenters", "6a", "layoutHistory")));
  });

  it("gäst läser inte elevposter, donationsposter eller klassprofilen", async () => {
    for (const k of GAST_LASER_INTE) await assertFails(getDoc(doc(elev("elev2"), ...DOKUMENT[k])));
    await assertFails(getDocs(collection(elev("elev2"), "classCenters", "6a", "expMembers")));
    await assertFails(getDocs(collection(elev("elev2"), "classCenters", "6a", "donations")));
  });

  it("klassens egen elev läser profilen och sin egen elevpost (positiv kontroll)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), ...DOKUMENT.profil)));
    await assertSucceeds(getDoc(doc(elev("elev1"), ...DOKUMENT.elevpost)));
    await assertFails(getDoc(doc(elev("elev3"), ...DOKUMENT.elevpost)));
  });

  it("utloggad läser ingenting i classCenters", async () => {
    for (const k of Object.keys(DOKUMENT)) await assertFails(getDoc(doc(unauth(), ...DOKUMENT[k])));
    for (const sub of ["expShards", "fund", "layout", "layoutHistory", "trophies"]) {
      await assertFails(getDocs(collection(unauth(), "classCenters", "6a", sub)));
    }
  });
});

describe("Gästläge: skrivning (garanti 6)", () => {
  it("klass-EXP: hemmaklassens elev ja, gäst och utloggad nej", async () => {
    await assertFails(commit(elev("elev2"), exp("elev2")));
    await assertFails(commit(unauth(), exp("elev2")));
    await assertSucceeds(commit(elev("elev1"), exp("elev1", "6a")));
  });

  it("donation: hemmaklassens elev ja, gäst och utloggad nej", async () => {
    await assertFails(commit(elev("elev2"), donation("elev2")));
    await assertFails(commit(unauth(), donation("elev2")));
    await assertSucceeds(commit(elev("elev1"), donation("elev1")));
  });

  it("layout: hemmaklassens elev ja, gäst och utloggad nej", async () => {
    await assertFails(commit(elev("elev2"), layout("elev2")));
    await assertFails(commit(unauth(), layout("elev2")));
    await assertSucceeds(commit(elev("elev1"), layout("elev1")));
  });

  it("pokal och klassprofil: gäst nej (lärare ja – positiv kontroll)", async () => {
    await assertFails(pokal(elev("elev2"), "elev2"));
    await assertFails(sparr(elev("elev2")));
    await assertSucceeds(pokal(teacher(), "larare1"));
    await assertSucceeds(sparr(teacher()));
  });

  it("gäst raderar ingenting, inte heller utloggad", async () => {
    for (const k of Object.keys(DOKUMENT)) {
      await assertFails(deleteDoc(doc(elev("elev2"), ...DOKUMENT[k])));
      await assertFails(deleteDoc(doc(unauth(), ...DOKUMENT[k])));
    }
  });

  it("gäst kan inte göra sig till medlem (classes.studentIds styr allt ovan)", async () => {
    await assertFails(setDoc(doc(elev("elev2"), "classes", "6a"), { studentIds: ["elev1", "elev3", "elev2"] }, { merge: true }));
    await assertFails(commit(elev("elev2"), layout("elev2")));
  });
});

describe("Lärarmodellen (garanti 7, förtroendemodell)", () => {
  const annanLarare = () => testEnv.authenticatedContext("larare2", { teacher: true }).firestore();

  it("vilken lärare som helst (teacher:true) får inreda, spärra och dela ut verifierad pokal", async () => {
    await assertSucceeds(commit(annanLarare(), layout("larare2")));
    await assertSucceeds(sparr(annanLarare(), "6a", ["elev1"]));
    await assertSucceeds(pokal(annanLarare(), "larare2"));
  });

  it("men inte heller en lärare får gå förbi verifieringen eller fejka en elev", async () => {
    await assertFails(setDoc(doc(annanLarare(), "classCenters", "6b", "trophies", "mm-klasskamp-mm1"),
      planPokal({ typ: "mm-klasskamp", kallaId: "mm1", uid: "larare2", fv }).data)); // 6b vann inte
    await assertFails(commit(annanLarare(), exp("elev1"))); // elevpost i elevens namn
    await assertFails(commit(annanLarare(), donation("elev1")));
    await assertFails(setDoc(doc(annanLarare(), ...DOKUMENT.donation), { amount: 1 }, { merge: true }));
  });

  it("utan teacher-anspråk är man elev – en uid som heter som läraren hjälper inte", async () => {
    await assertFails(sparr(elev("larare1")));
    await assertFails(pokal(elev("larare1"), "larare1"));
  });
});
