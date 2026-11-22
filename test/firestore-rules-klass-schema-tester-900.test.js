// ============================================================================
// Regel-tester (Testaren, #900): classes/{id}.schema – kantfallen utöver
// test/firestore-rules-klass-schema.test.js: gammalt lärarkonto, elev med
// lärarlikt påhitt, oinloggad läsning, admin-create, delskrivning av ett schema,
// null/tom sträng, gamla tidsstämplar och skrivning till en annan klass i samma
// anrop. Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
before(async () => { env = await createRollerEnv("pluggportalen-rules-test-klass-schema-900"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
});

const klass = (db, id) => doc(db, "classes", id);
const s = (uid, over = {}) => ({ schema: { pa: true, lektioner: [{ id: "l1", dag: 1, start: "09:00", slut: "10:00", amne: "ma" }],
  koppling: { brakresan: "ma" }, updatedAt: serverTimestamp(), updatedBy: uid, ...over } });

describe("Veckoschema (#900, testaren): roller", () => {
  it("gammalt lärarkonto (teacher utan roll = admin under övergången) får spara", async () => {
    await assertSucceeds(updateDoc(klass(env.gammal(), "4a"), s("gammal")));
  });
  it("elev med teacher:false, eller elev i en annan klass, nekas", async () => {
    await assertFails(updateDoc(klass(env.as("e4a", { teacher: false }), "4a"), s("e4a")));
    await assertFails(updateDoc(klass(env.as("e5a"), "4a"), s("e5a")));
  });
  it("årskurskonto med role men utan teacher-claim nekas", async () => {
    await assertFails(updateDoc(klass(env.as("ak4", { role: "arskurs" }), "4a"), s("ak4")));
  });
  it("oinloggad får inte läsa klassen (och därmed inte schemat)", async () => {
    await assertFails(getDoc(klass(env.testEnv.unauthenticatedContext().firestore(), "4a")));
  });
  it("admin kan skapa en klass med schema; formen prövas även vid create", async () => {
    await assertSucceeds(setDoc(klass(env.admin(), "ny"), { name: "Ny", studentIds: [], ...s("admin1") }));
    await assertFails(setDoc(klass(env.admin(), "ny2"), { name: "Ny", studentIds: [], ...s("admin1", { pa: 1 }) }));
  });
  it("årskurskontot kan skriva sin klass men inte en annan i samma batch", async () => {
    const db = env.ak4();
    const b = writeBatch(db);
    b.update(klass(db, "4a"), s("ak4"));
    b.update(klass(db, "5a"), s("ak4"));
    await assertFails(b.commit());
  });
});

describe("Veckoschema (#900, testaren): formen", () => {
  it("schema: null, sträng och tom map nekas", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(klass(db, "4a"), { schema: null }));
    await assertFails(updateDoc(klass(db, "4a"), { schema: "på" }));
    await assertFails(updateDoc(klass(db, "4a"), { schema: {} }));
  });
  it("updatedAt: gammal Timestamp nekas; updatedBy saknas nekas", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(klass(db, "4a"), s("ak4", { updatedAt: Timestamp.fromMillis(Date.now() - 60_000) })));
    const x = s("ak4"); delete x.schema.updatedBy;
    await assertFails(updateDoc(klass(db, "4a"), x));
  });
  it("delskrivning av ett sparat schema: bara med ny updatedAt/updatedBy", async () => {
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), s("ak4")));
    await assertFails(updateDoc(klass(env.ak4(), "4a"), { "schema.pa": false }));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"),
      { "schema.pa": false, "schema.updatedAt": serverTimestamp(), "schema.updatedBy": "ak4" }));
    await assertFails(updateDoc(klass(env.ak4(), "4a"),
      { "schema.extra": 1, "schema.updatedAt": serverTimestamp(), "schema.updatedBy": "ak4" }));
    // En annan lärare kan inte stämpla om sig själv i en klass den inte har.
    await assertFails(updateDoc(klass(env.ak5(), "4a"),
      { "schema.pa": true, "schema.updatedAt": serverTimestamp(), "schema.updatedBy": "ak5" }));
  });
  it("kopplingen: null-värde för alla nycklar, tom sträng tillåts av reglerna (klienten släpper den)", async () => {
    const db = env.ak4();
    await assertSucceeds(updateDoc(klass(db, "4a"), s("ak4", { koppling: { lasresan: null, schack: null, "matchdagen:tabeller": null } })));
    await assertSucceeds(updateDoc(klass(db, "4a"), s("ak4", { koppling: { lasresan: "" } })));
    await assertSucceeds(updateDoc(klass(db, "4a"), s("ak4", { koppling: { lasresan: "x".repeat(100) } })));
    await assertFails(updateDoc(klass(db, "4a"), s("ak4", { koppling: { lasresan: { id: "sv" } } })));
    await assertFails(updateDoc(klass(db, "4a"), s("ak4", { koppling: null })));
  });
  it("pa: false med lektioner kvar sparas", async () => {
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), s("ak4", { pa: false })));
  });
});
