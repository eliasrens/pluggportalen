// ============================================================================
// Regel-tester: veckoschema per klass (#900) – classes/{id}.schema.
// ----------------------------------------------------------------------------
// Schemat ska vara LÄSBART för klassens elever (klienten tillämpar det) och
// SKRIVBART av lärare med klassen (admin, eller årskurskontot med klassen –
// hasClass), med gränserna i docs/VECKOSCHEMA.md: exakt fälten, högst 60 lektioner,
// kopplingen bara med kända nycklar och ämnes-id ≤ 100 tecken eller null,
// updatedAt = serverns tid, updatedBy = sig själv. Lektionernas innehåll (dag,
// tider, ämne) prövar klienten – reglerna kan inte loopa (uttrycksgränsen 1000).
// Ett oförändrat schema stoppar inga andra klass-skrivningar, och ett fullt
// schema (60 lektioner) i ett fullt klassdokument ryms i uttrycksgränsen.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { KOPPLING_NYCKLAR, SCHEMA_MAX_LEKTIONER } from "../src/klass-schema.js";

let env;
before(async () => { env = await createRollerEnv("pluggportalen-rules-test-klass-schema"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
});

const klass = (db, id) => doc(db, "classes", id);
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** n lektioner: 12 per dag, 30 min var från 07:00 (krockar inte). */
const lektioner = (n) => Array.from({ length: n }, (_, i) => {
  const start = 7 * 60 + Math.floor(i / 5) * 30;
  return { id: `l${i}`, dag: (i % 5) + 1, start: hhmm(start), slut: hhmm(start + 30), amne: "ma" };
});
const koppling = () => ({ lasresan: "sv", mattematchen: "ma", hittaratt: "so", ekvationsresan: "ma",
  brakresan: "ma", schack: null, "matchdagen:tabeller": "ma" });
/** Ett schema som läraren `uid` sparar (updatedAt = serverns tid). */
const schema = (uid, over = {}) => ({ schema: { pa: true, lektioner: lektioner(3), koppling: koppling(),
  updatedAt: serverTimestamp(), updatedBy: uid, ...over } });
const medLektion = (uid, over) => schema(uid, { lektioner: [{ ...lektioner(1)[0], ...over }] });

describe("Veckoschema (#900): vem får skriva", () => {
  it("admin och årskurskontot med klassen FÅR spara, slå av och ta bort schemat", async () => {
    await assertSucceeds(updateDoc(klass(env.admin(), "4a"), schema("admin1")));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), schema("ak4", { pa: false })));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4b"), schema("ak4")));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), { schema: deleteField() }));
    await assertSucceeds(updateDoc(klass(env.ak5(), "5a"), schema("ak5")));
  });
  it("klassens elev läser schemat men skriver det aldrig", async () => {
    await env.seed((db) => updateDoc(klass(db, "4a"), { schema: { pa: true, lektioner: lektioner(2), koppling: {} } }));
    const snap = await assertSucceeds(getDoc(klass(env.as("e4a"), "4a")));
    assert.equal(snap.data().schema.lektioner.length, 2);
    await assertFails(updateDoc(klass(env.as("e4a"), "4a"), schema("e4a")));
    await assertFails(updateDoc(klass(env.as("e4a"), "4a"), { "schema.pa": false }));
    await assertFails(updateDoc(klass(env.as("e4a"), "4a"), { schema: deleteField() }));
  });
  it("en annan lärare (årskurskonto utan klassen) och ett avstängt konto nekas", async () => {
    await assertFails(updateDoc(klass(env.ak5(), "4a"), schema("ak5")));
    await assertFails(updateDoc(klass(env.ak4(), "5a"), schema("ak4")));
    await assertFails(updateDoc(klass(env.ak4av(), "4a"), schema("ak4av")));
    await assertFails(updateDoc(klass(env.testEnv.unauthenticatedContext().firestore(), "4a"), schema("x")));
  });
  it("updatedBy måste vara den som skriver och updatedAt serverns tid", async () => {
    await assertFails(updateDoc(klass(env.ak4(), "4a"), schema("ak5")));
    await assertFails(updateDoc(klass(env.ak4(), "4a"), schema("ak4", { updatedAt: Date.now() })));
  });
});

describe("Veckoschema (#900): gränserna i B.1 som reglerna prövar", () => {
  it("formen: exakt fälten pa, lektioner, koppling, updatedAt, updatedBy", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { extra: 1 })));
    const { schema: s } = schema("ak4");
    delete s.koppling;
    await assertFails(updateDoc(klass(db, "4a"), { schema: s }));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { pa: "ja" })));
    await assertFails(updateDoc(klass(db, "4a"), { schema: [] }));
  });
  it(`högst ${SCHEMA_MAX_LEKTIONER} lektioner`, async () => {
    const db = env.ak4();
    await assertSucceeds(updateDoc(klass(db, "4a"), schema("ak4", { lektioner: lektioner(60) })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { lektioner: lektioner(61) })));
    await assertSucceeds(updateDoc(klass(db, "4a"), schema("ak4", { lektioner: [] })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { lektioner: "många" })));
  });
  it("lektionernas innehåll prövas i klienten (normalizeSchema), inte i reglerna", async () => {
    // Uttrycksgränsen 1000: reglerna kan inte gå igenom 60 lektioner (docs/VECKOSCHEMA.md).
    // En ogiltig lektion sparas alltså, men klienten släpper den (test/klass-schema.test.mjs).
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), medLektion("ak4", { dag: 6 })));
  });
  it("kopplingen: bara kända nycklar, värdet ett ämnes-id ≤ 100 tecken eller null", async () => {
    const db = env.ak4();
    await assertSucceeds(updateDoc(klass(db, "4a"), schema("ak4", { koppling: {} })));
    await assertSucceeds(updateDoc(klass(db, "4a"), schema("ak4", { koppling: { lasresan: null } })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { koppling: { plugga: "so" } })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { koppling: { matchdagen: "ma" } })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { koppling: { lasresan: "x".repeat(101) } })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { koppling: { lasresan: 3 } })));
    await assertFails(updateDoc(klass(db, "4a"), schema("ak4", { koppling: ["ma"] })));
    // Varje känd nyckel (registret) godtas.
    const alla = Object.fromEntries(KOPPLING_NYCKLAR.map((k) => [k, "ma"]));
    await assertSucceeds(updateDoc(klass(db, "4a"), schema("ak4", { koppling: alla })));
  });
});

describe("Veckoschema (#900): fullt schema i fullt klassdokument (uttrycksgränsen)", () => {
  const fullKlass = () => ({
    hiddenModes: ["memory"], hiddenModules: ["lasresan"], enabledModules: ["hittaratt", "matchdagen"],
    elevModuler: { e4a: ["matchdagen"] },
    lock: { mal: { typ: "lasresan" }, till: Date.now() + 3600 * 1000, doljOvrigt: false },
  });
  it("60 lektioner sparas, och en orelaterad skrivning går igenom med schemat kvar", async () => {
    await env.seed((db) => updateDoc(klass(db, "4a"), fullKlass()));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), schema("ak4", { lektioner: lektioner(60) })));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), { hiddenModes: ["quiz"] }));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), { lock: deleteField() }));
    await assertSucceeds(setDoc(klass(env.ak4(), "4a"), { assignedAreas: [{ subjectId: "so", areaId: "admin-omr" }] }, { merge: true }));
    const d = (await getDoc(klass(env.ak4(), "4a"))).data();
    assert.equal(d.schema.lektioner.length, 60);
  });
  it("ett sparat schema i annan form (utan updatedAt) stoppar inte andra skrivningar", async () => {
    await env.seed((db) => updateDoc(klass(db, "4a"), { schema: { pa: true, lektioner: [{ id: "x", dag: 9 }] } }));
    await assertSucceeds(updateDoc(klass(env.ak4(), "4a"), { hiddenModes: ["quiz"] }));
    await assertFails(updateDoc(klass(env.ak4(), "4a"), { "schema.pa": false }), "ändras det prövas hela formen");
  });
});
