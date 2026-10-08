// ============================================================================
// Regel-tester: Trollkarlsduellen (#536) – liveSessions/{sid}.wizards
//   • valfritt; bara i tvåklassmatcher, exakt de två klasserna, en av varje
//     ("rasmus"/"elias"), aldrig samma på båda,
//   • läraren kan byta i lobbyn – men inte när matchen startat/är slut,
//   • elever kan aldrig ändra valet.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp, deleteField } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const input = (over = {}) => ({
  name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
  classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 17, "5e": 22 }, ...over,
});
const sessionDoc = (over = {}, inp = {}) => ({ ...buildSessionDoc(input(inp), { uid: "larare1" }), createdAt: ts(-2 * H), ...over });
const create = (data) => setDoc(doc(teacher(), "liveSessions", "ny"), { ...data, createdAt: serverTimestamp() });

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-trollkarl"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "liveSessions", "lobby"), sessionDoc());
    await setDoc(doc(db, "liveSessions", "pagar"), sessionDoc({ status: "live", startedAt: ts(-60 * 1000) }));
    await setDoc(doc(db, "liveSessions", "slut"), sessionDoc({ status: "finished", startedAt: ts(-2 * H), finishedAt: ts(-H) }));
  });
});

describe("Trollkarlsduellen: wizards i liveSessions", () => {
  it("skapa med default-val (buildSessionDoc) och med bytt val godtas", async () => {
    assert(buildSessionDoc(input(), { uid: "x" }).wizards);
    await assertSucceeds(create(sessionDoc({ createdBy: "larare1" })));
    await assertSucceeds(create(sessionDoc({ createdBy: "larare1" }, { wizards: { "4b": "elias", "5e": "rasmus" } })));
  });

  it("utan wizards (äldre klienter, 3 klasser) godtas fortfarande", async () => {
    const { wizards, ...utan } = sessionDoc({ createdBy: "larare1" });
    assert(wizards);
    await assertSucceeds(create(utan));
    const tre = sessionDoc({ createdBy: "larare1" }, { classIds: ["4b", "5e", "3a"], divisors: { "4b": 1, "5e": 1, "3a": 1 } });
    await assertSucceeds(create(tre));
  });

  it("ogiltiga val nekas: samma på båda, okänd trollkarl, fel klass, tre klasser", async () => {
    const base = sessionDoc({ createdBy: "larare1" });
    await assertFails(create({ ...base, wizards: { "4b": "rasmus", "5e": "rasmus" } }));
    await assertFails(create({ ...base, wizards: { "4b": "merlin", "5e": "elias" } }));
    await assertFails(create({ ...base, wizards: { "4b": "rasmus", "3a": "elias" } }));
    await assertFails(create({ ...base, wizards: { "4b": "rasmus" } }));
    await assertFails(create({ ...base, wizards: { "4b": "rasmus", "5e": "elias", "3a": "rasmus" } }));
    await assertFails(create({ ...base, wizards: "rasmus" }));
    const tre = sessionDoc({ createdBy: "larare1" }, { classIds: ["4b", "5e", "3a"], divisors: { "4b": 1, "5e": 1, "3a": 1 } });
    await assertFails(create({ ...tre, wizards: { "4b": "rasmus", "5e": "elias" } }));
  });

  it("läraren byter i lobbyn; elev kan inte", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { wizards: { "4b": "elias", "5e": "rasmus" } }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "lobby"), { wizards: { "4b": "elias", "5e": "elias" } }));
    await assertFails(updateDoc(doc(elev("alma"), "liveSessions", "lobby"), { wizards: { "4b": "rasmus", "5e": "elias" } }));
  });

  it("efter start (live/slut) är valet låst – men nämnaren går fortfarande att ändra", async () => {
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "pagar"), { wizards: { "4b": "elias", "5e": "rasmus" } }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "pagar"), { wizards: deleteField() }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "slut"), { wizards: { "4b": "elias", "5e": "rasmus" } }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "pagar"), { "classDivisors.4b": 16 }));
  });

  it("STARTA med wizards i dokumentet fungerar som förut", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { status: "live", startedAt: serverTimestamp() }));
  });
});

function assert(v) {
  if (!v) throw new Error("förväntade ett värde");
}
