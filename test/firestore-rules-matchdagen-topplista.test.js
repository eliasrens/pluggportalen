// ============================================================================
// Regel-tester: Matchdagens topplista per årskurs (#880), mdTopplista/{docId}.
// Varje inloggad (elev, lärare) läser; ingen skriver – bara Cloud Functions (mdTopplista,
// Admin SDK förbi reglerna). Utloggad nekas. Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let env;
const LISTA = { version: 1, arskurser: { 4: [{ uid: "alva", n: "Alva", lag: "Blixtarna IF", f: "#2f6fe8", k: "4A", d: 2, ls: 0, v: 9, gm: 20, im: 5, m: 12, plats: 1 }] }, antal: { 4: 1 } };

before(async () => { env = await createRulesEnv("demo-md-topplista-880"); });
after(async () => { await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await env.testEnv.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "mdTopplista", "skolan"), LISTA));
});

describe("mdTopplista (#880)", () => {
  it("elev och lärare läser; utloggad nekas", async () => {
    await assertSucceeds(getDoc(doc(env.elev("alva"), "mdTopplista", "skolan")));
    await assertSucceeds(getDoc(doc(env.elev("bilal"), "mdTopplista", "skolan")));
    await assertSucceeds(getDoc(doc(env.teacher(), "mdTopplista", "skolan")));
    await assertFails(getDoc(doc(env.unauth(), "mdTopplista", "skolan")));
  });
  it("ingen skriver – inte eleven på listan, inte en annan elev, inte admin", async () => {
    for (const db of [env.elev("alva"), env.elev("bilal"), env.teacher()]) {
      await assertFails(setDoc(doc(db, "mdTopplista", "skolan"), { ...LISTA, arskurser: {} }));
      await assertFails(updateDoc(doc(db, "mdTopplista", "skolan"), { "antal.4": 99 }));
      await assertFails(setDoc(doc(db, "mdTopplista", "annan"), LISTA));
      await assertFails(deleteDoc(doc(db, "mdTopplista", "skolan")));
    }
  });
});
