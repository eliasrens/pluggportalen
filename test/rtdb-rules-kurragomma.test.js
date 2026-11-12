// ============================================================================
// Regel-tester: Kurragömmas rörelsekanal (#838) – database.rules.json
// (Realtime Database, spec §5.3 och §13.3):
//   • pos/{uid}: bara sökaren själv (auth.uid == uid och roll/{uid} == "sokare"),
//     bara x, z, yaw, t inom gränserna; en gömmare kan inte skriva; borttagning
//     (onDisconnect().remove()) går
//   • roll, med, hand, status: ingen klient skriver
//   • läsa pos/hand/status/roll/med: den som finns i med, eller en lärare
//     (custom claim teacher); den som inte är med nekas, utloggad nekas
// Körs av `npm run test:rules:rtdb` (database-emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

let testEnv;
const SID = "match1";
const elev = (uid) => testEnv.authenticatedContext(uid).database();
const larare = () => testEnv.authenticatedContext("larare1", { teacher: true, admin: true }).database();
const unauth = () => testEnv.unauthenticatedContext().database();
const ref = (db, p) => db.ref(`kg/${SID}/${p}`);
const posOk = (over = {}) => ({ x: 3.5, z: -2, yaw: 1.2, t: Date.now(), ...over });

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "pluggportalen-rtdb-test-kurragomma",
    database: { rules: readFileSync(new URL("../database.rules.json", import.meta.url), "utf8") },
  });
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearDatabase();
  await testEnv.withSecurityRulesDisabled((ctx) => ctx.database().ref(`kg/${SID}`).set({
    roll: { alma: "sokare" },
    med: { alma: true, bo: true },
    pos: { alma: posOk() },
    hand: { h1: { typ: "vissling", x: 1, z: 2, plats: "vid ladan", t: Date.now() } },
    status: { fas: "leta", lasta: 1, gomda: 1, sokare: 1 },
  }));
});

describe("Rörelsekanalen: pos", () => {
  it("sökaren skriver sin egen pos (x, z, yaw, t) och kan ta bort den", async () => {
    await assertSucceeds(ref(elev("alma"), "pos/alma").set(posOk()));
    await assertSucceeds(ref(elev("alma"), "pos/alma").update({ x: 4, t: Date.now() }));
    await assertSucceeds(ref(elev("alma"), "pos/alma").remove());
  });
  it("en gömmare (bo) kan inte skriva pos – inte sin egen, inte sökarens", async () => {
    await assertFails(ref(elev("bo"), "pos/bo").set(posOk()));
    await assertFails(ref(elev("bo"), "pos/alma").set(posOk()));
  });
  it("sökaren kan inte skriva någon annans pos; den som inte är med kan inte skriva", async () => {
    await assertFails(ref(elev("alma"), "pos/bo").set(posOk()));
    await assertFails(ref(elev("cleo"), "pos/cleo").set(posOk()));
    await assertFails(ref(unauth(), "pos/alma").set(posOk()));
  });
  it("bara fälten x, z, yaw, t inom gränserna", async () => {
    const a = elev("alma");
    await assertFails(ref(a, "pos/alma").set(posOk({ x: 41 })));
    await assertFails(ref(a, "pos/alma").set(posOk({ z: -41 })));
    await assertFails(ref(a, "pos/alma").set(posOk({ yaw: 8 })));
    await assertFails(ref(a, "pos/alma").set(posOk({ t: Date.now() - 300_000 })));
    await assertFails(ref(a, "pos/alma").set(posOk({ x: "3" })));
    await assertFails(ref(a, "pos/alma").set(posOk({ namn: "Alma" })));
    await assertFails(ref(a, "pos/alma").set({ x: 1, z: 2, t: Date.now() })); // yaw saknas
    await assertFails(ref(a, "pos/alma/x").set(1000));
  });
});

describe("Rörelsekanalen: roll, med, hand och status skriver ingen klient", () => {
  for (const [vem, db] of [["sökaren", () => elev("alma")], ["gömmaren", () => elev("bo")], ["läraren", () => larare()]]) {
    it(`${vem} nekas`, async () => {
      const d = db();
      await assertFails(ref(d, "roll/alma").set("gomd"));
      await assertFails(ref(d, "roll/bo").set("sokare"));
      await assertFails(ref(d, "med/cleo").set(true));
      await assertFails(ref(d, "med/bo").remove());
      await assertFails(ref(d, "hand").push({ typ: "vissling", x: 0, z: 0, plats: "vid brunnen", t: Date.now() }));
      await assertFails(ref(d, "hand/h1").remove());
      await assertFails(ref(d, "status/gomda").set(0));
      await assertFails(ref(d, "status").update({ fas: "gom" }));
      await assertFails(ref(d, "").remove());
    });
  }
});

describe("Rörelsekanalen: läsning", () => {
  it("den som är med läser pos, hand, status, roll och med (även gömmaren)", async () => {
    for (const u of ["alma", "bo"]) {
      const d = elev(u);
      for (const p of ["pos", "hand", "status", "roll", "med"]) await assertSucceeds(ref(d, p).once("value"));
      await assertSucceeds(ref(d, "hand").orderByChild("t").limitToLast(20).once("value"));
    }
  });
  it("läraren läser allt (custom claim teacher)", async () => {
    const d = larare();
    for (const p of ["pos", "hand", "status", "roll", "med"]) await assertSucceeds(ref(d, p).once("value"));
  });
  it("den som inte är med, och utloggad, nekas; roten och hela /kg nekas alla", async () => {
    for (const p of ["pos", "hand", "status", "roll", "med"]) {
      await assertFails(ref(elev("cleo"), p).once("value"));
      await assertFails(ref(unauth(), p).once("value"));
    }
    await assertFails(ref(elev("alma"), "").once("value"));
    await assertFails(larare().ref("kg").once("value"));
    await assertFails(larare().ref().once("value"));
  });
});
