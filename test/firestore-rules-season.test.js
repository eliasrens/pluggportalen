// ============================================================================
// Regel-tester: config/season (#690, epic #689, spec §1.1 och §7 test 3).
// ----------------------------------------------------------------------------
// Alla läser – även utloggade (inloggningsskärmen följer säsongen). Bara admin
// skriver, och fälten valideras. Elev, årskurskonto, avstängd admin och
// utloggad nekas att skriva. Körs av `npm run test:rules` (kräver emulatorn).
// #907 (epic #906, G.1): säsongen vinter och tillägget Jul (jul, julUntil).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev;
const as = (uid, claims) => testEnv.authenticatedContext(uid, claims).firestore();
const adminDb = () => as("admin1", { teacher: true, admin: true });
const ak4 = () => as("ak4", { teacher: true, role: "arskurs" });
const PATH = "config/season";
const giltig = (uid, extra = {}) => ({
  season: "host",
  halloween: true,
  halloweenUntil: Timestamp.fromMillis(Date.UTC(2026, 10, 2, 22, 59)),
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  ...extra,
});

before(async () => {
  ({ testEnv, unauth, elev } = await createRulesEnv("pluggportalen-rules-test-season"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "teacherAccounts/admin1"), { role: "admin", classIds: [], active: true });
    await setDoc(doc(db, "teacherAccounts/admin2"), { role: "admin", classIds: [], active: false });
    await setDoc(doc(db, "teacherAccounts/ak4"), { role: "arskurs", classIds: ["4a"], active: true });
    await setDoc(doc(db, PATH), { season: "sommar", halloween: false, halloweenUntil: null, updatedAt: new Date(), updatedBy: "admin1" });
  });
});

describe("config/season – läsning", () => {
  it("utloggad, elev, årskurskonto och admin läser", async () => {
    await assertSucceeds(getDoc(doc(unauth(), PATH)));
    await assertSucceeds(getDoc(doc(elev("elev1"), PATH)));
    await assertSucceeds(getDoc(doc(ak4(), PATH)));
    await assertSucceeds(getDoc(doc(adminDb(), PATH)));
  });
  it("utloggad läser även när dokumentet saknas (= sommar)", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), PATH)));
    await assertSucceeds(getDoc(doc(unauth(), PATH)));
  });
  it("andra config-dokument är inte öppna", async () => {
    await assertFails(getDoc(doc(unauth(), "config/hemlig")));
    await assertFails(setDoc(doc(adminDb(), "config/hemlig"), { x: 1 }));
  });
});

describe("config/season – admin skriver", () => {
  it("admin sätter höst + Halloween med slutdatum", async () => {
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1")));
  });
  it("admin tar bort slutdatumet (null) eller utelämnar det", async () => {
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { halloweenUntil: null })));
    const { halloweenUntil, ...utan } = giltig("admin1");
    await assertSucceeds(setDoc(doc(adminDb(), PATH), utan));
  });
  it("admin skapar dokumentet när det saknas och kan radera det", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), PATH)));
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season: "sommar", halloween: false })));
    await assertSucceeds(deleteDoc(doc(adminDb(), PATH)));
  });
  it("fälten valideras", async () => {
    const fel = [
      { season: "var" },
      { season: "jul" },
      { season: 1 },
      { halloween: "ja" },
      { halloweenUntil: "2026-11-02" },
      { halloweenUntil: 1793660340000 },
      { updatedAt: Timestamp.fromMillis(0) },
      { updatedBy: "nagonannan" },
      { extra: true },
    ];
    for (const f of fel) await assertFails(setDoc(doc(adminDb(), PATH), giltig("admin1", f)));
    const { season, ...utanSasong } = giltig("admin1");
    await assertFails(setDoc(doc(adminDb(), PATH), utanSasong));
    const { updatedBy, ...utanVem } = giltig("admin1");
    await assertFails(setDoc(doc(adminDb(), PATH), utanVem));
  });
  it("en avstängd admin nekas (teacherAccounts active:false, #682 H3)", async () => {
    await assertFails(setDoc(doc(as("admin2", { teacher: true, admin: true }), PATH), giltig("admin2")));
  });
});

describe("config/season – vinter och Jul (#907)", () => {
  const julSlut = Timestamp.fromMillis(Date.UTC(2027, 0, 13, 22, 59));
  it("admin sätter vinter, med och utan tillägg", async () => {
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season: "vinter", halloween: false, halloweenUntil: null })));
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season: "vinter", halloween: false, jul: true, julUntil: julSlut })));
  });
  it("Jul ovanpå vilken säsong som helst, med eller utan slutdatum", async () => {
    for (const season of ["sommar", "host", "vinter"]) {
      await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season, jul: true, julUntil: julSlut })));
      await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season, jul: true, julUntil: null })));
      await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season, jul: true })));
    }
  });
  it("båda tilläggen på samtidigt är tillåtet", async () => {
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season: "vinter", jul: true, julUntil: julSlut })));
  });
  it("ett gammalt dokument utan jul/julUntil (äldre admin-klient) går igenom", async () => {
    await assertSucceeds(setDoc(doc(adminDb(), PATH), giltig("admin1", { season: "vinter" })));
  });
  it("jul och julUntil valideras", async () => {
    for (const f of [
      { jul: "ja" },
      { jul: 1 },
      { jul: null },
      { julUntil: "2027-01-13" },
      { julUntil: 1799877540000 },
      { jul: true, julUntil: true },
      { julSattPa: serverTimestamp() },
    ]) {
      await assertFails(setDoc(doc(adminDb(), PATH), giltig("admin1", { season: "vinter", ...f })));
    }
  });
  it("bara admin skriver jul (test 3)", async () => {
    const jul = (uid) => giltig(uid, { season: "vinter", jul: true, julUntil: julSlut });
    await assertFails(setDoc(doc(ak4(), PATH), jul("ak4")));
    await assertFails(setDoc(doc(elev("elev1"), PATH), jul("elev1")));
    await assertFails(updateDoc(doc(elev("elev1"), PATH), { jul: true, updatedAt: serverTimestamp(), updatedBy: "elev1" }));
    await assertFails(setDoc(doc(unauth(), PATH), { season: "vinter", halloween: false, jul: true }));
    await assertFails(setDoc(doc(as("admin2", { teacher: true, admin: true }), PATH), jul("admin2")));
  });
});

describe("config/season – test 3: alla andra nekas att skriva", () => {
  it("årskurskonto nekas", async () => {
    await assertFails(setDoc(doc(ak4(), PATH), giltig("ak4")));
    await assertFails(updateDoc(doc(ak4(), PATH), { season: "host", updatedAt: serverTimestamp(), updatedBy: "ak4" }));
    await assertFails(deleteDoc(doc(ak4(), PATH)));
  });
  it("elev nekas", async () => {
    await assertFails(setDoc(doc(elev("elev1"), PATH), giltig("elev1")));
    await assertFails(updateDoc(doc(elev("elev1"), PATH), { halloween: true, updatedAt: serverTimestamp(), updatedBy: "elev1" }));
    await assertFails(deleteDoc(doc(elev("elev1"), PATH)));
  });
  it("utloggad nekas", async () => {
    await assertFails(setDoc(doc(unauth(), PATH), { season: "host", halloween: true }));
    await assertFails(deleteDoc(doc(unauth(), PATH)));
  });
  it("ett påhittat admin-claim utan teacher räcker inte", async () => {
    await assertFails(setDoc(doc(as("x", { admin: true }), PATH), giltig("x")));
  });
});
