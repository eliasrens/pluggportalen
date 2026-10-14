// ============================================================================
// Regel-tester: köpbara avatarer (#694, epic #689, spec §5 och §7 test 12–13).
// ----------------------------------------------------------------------------
// Eleven får byta till en köpbar avatar bara om den finns i ownedItems; gratis
// avatarer och oförändrat avatarId går alltid. Admin påverkas inte. Körs av
// `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { arrayUnion, doc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, elev, teacher;
const SD = "studentData/elev1";

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-avatarer"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), SD), { coins: 900, avatarId: "fox", ownedItems: ["keps"] }));
});

describe("köpbara avatarer – studentData.avatarId", () => {
  it("gratis avatar väljs fritt (test 13)", async () => {
    await assertSucceeds(updateDoc(doc(elev("elev1"), SD), { avatarId: "panda", avatarChosen: true }));
  });
  it("ej köpt köpavatar kan inte väljas (test 13)", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), SD), { avatarId: "hw-av-spoke", avatarChosen: true }));
  });
  it("köpt köpavatar kan väljas (test 12)", async () => {
    await assertSucceeds(updateDoc(doc(elev("elev1"), SD), { coins: 500, ownedItems: arrayUnion("hw-av-spoke") }));
    await assertSucceeds(updateDoc(doc(elev("elev1"), SD), { avatarId: "hw-av-spoke", avatarChosen: true }));
  });
  it("med köpavatar vald går andra skrivningar som vanligt", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), SD), { coins: 10, avatarId: "hw-av-vampyr", ownedItems: ["hw-av-vampyr"] }));
    await assertSucceeds(updateDoc(doc(elev("elev1"), SD), { coins: 20 }));
  });
  it("nytt dokument med ej ägd köpavatar nekas, gratis går", async () => {
    await assertFails(setDoc(doc(elev("elev2"), "studentData/elev2"), { avatarId: "hw-av-mumie", ownedItems: [] }));
    await assertSucceeds(setDoc(doc(elev("elev2"), "studentData/elev2"), { avatarId: "fox", ownedItems: [] }));
  });
  it("admin skriver som förut", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), SD), { avatarId: "hw-av-haxkatt" }));
  });
});
