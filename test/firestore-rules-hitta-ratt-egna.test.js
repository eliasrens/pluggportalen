// ============================================================================
// Regel-tester: lärarens egna pack i Hitta rätt! (#633, arkitektur §11.2).
// ----------------------------------------------------------------------------
// hittaRattPacks/{packId} och katalogen hittaRattMeta/egnaPack: alla inloggade
// läser (elever i klassen + lärare som förhandsgranskar/duplicerar), utloggade
// inte. INGEN klient skriver – inte ens läraren som äger packet: spara, radera
// och topplistan går via Cloud Functions (hittaRattSparaPack/RaderaPack), som
// validerar items och höjer versionen. Försök på e-pack skapas som vanligt.
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;
const ID = "e-k3f9q0z1m2xa";

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-hitta-ratt-egna"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const PACK = {
  id: ID, official: false, ownerUid: "larare1", ownerNamn: "Anna L", classIds: ["5E"], leaderboard: false,
  version: 1, title: "Gästrikland runt", type: "point", geo: "sverige-landskap", startvy: "auto",
  items: [{ id: "gavle", name: "Gävle", prompt: "Var ligger Gävle?", lat: 60.6749, lon: 17.1413 }],
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "hittaRattPacks", ID), PACK);
    await setDoc(doc(db, "hittaRattMeta", "egnaPack"), { packs: { [ID]: { title: PACK.title, classIds: ["5E"], ownerUid: "larare1", version: 1 } } });
  });
});

describe("hittaRattPacks och katalogen: läsning", () => {
  it("inloggade elever och lärare läser packet och katalogen", async () => {
    await assertSucceeds(getDoc(doc(elev("omar"), "hittaRattPacks", ID)));
    await assertSucceeds(getDoc(doc(elev("omar"), "hittaRattMeta", "egnaPack")));
    await assertSucceeds(getDoc(doc(teacher(), "hittaRattPacks", ID)));
    await assertSucceeds(getDoc(doc(teacher(), "hittaRattMeta", "egnaPack")));
    await assertSucceeds(getDoc(doc(elev("omar"), "hittaRattPacks", "e-finnsinte000")));
  });

  it("utloggade läser varken pack eller katalog", async () => {
    await assertFails(getDoc(doc(unauth(), "hittaRattPacks", ID)));
    await assertFails(getDoc(doc(unauth(), "hittaRattMeta", "egnaPack")));
  });
});

describe("hittaRattPacks och katalogen: bara servern skriver", () => {
  it("elev kan inte skapa, ändra facit, slå på topplistan eller radera", async () => {
    const omar = elev("omar");
    await assertFails(setDoc(doc(omar, "hittaRattPacks", "e-elevenspack1"), { ...PACK, id: "e-elevenspack1", ownerUid: "omar" }));
    await assertFails(updateDoc(doc(omar, "hittaRattPacks", ID), { "items": [{ id: "gavle", name: "Gävle", lat: 0, lon: 0 }] }));
    await assertFails(updateDoc(doc(omar, "hittaRattPacks", ID), { leaderboard: true }));
    await assertFails(updateDoc(doc(omar, "hittaRattPacks", ID), { classIds: ["5E", "6C"] }));
    await assertFails(deleteDoc(doc(omar, "hittaRattPacks", ID)));
  });

  it("inte ens ägaren (lärare) skriver direkt – bara via hittaRattSparaPack/RaderaPack", async () => {
    const t = teacher();
    await assertFails(setDoc(doc(t, "hittaRattPacks", "e-lararenspack"), { ...PACK, id: "e-lararenspack" }));
    await assertFails(updateDoc(doc(t, "hittaRattPacks", ID), { title: "Nytt namn" }));
    await assertFails(updateDoc(doc(t, "hittaRattPacks", ID), { version: 1, items: [] }));
    await assertFails(deleteDoc(doc(t, "hittaRattPacks", ID)));
  });

  it("katalogen kan inte skrivas av elev eller lärare (falsk post, dold klass, radering)", async () => {
    for (const db of [elev("omar"), teacher()]) {
      await assertFails(setDoc(doc(db, "hittaRattMeta", "egnaPack"), { packs: { "e-falsktpack01": { title: "Fusk", classIds: ["5E"] } } }, { merge: true }));
      await assertFails(updateDoc(doc(db, "hittaRattMeta", "egnaPack"), { [`packs.${ID}.classIds`]: ["6C"] }));
      await assertFails(deleteDoc(doc(db, "hittaRattMeta", "egnaPack")));
    }
  });

  it("topplista och ledare för ett e-pack kan inte skrivas av klienten", async () => {
    const omar = elev("omar");
    await assertFails(setDoc(doc(omar, "hittaRattBoards", ID), { packId: ID, entries: { omar: { n: "Omar", k: "5E", s: 9999 } } }));
    await assertFails(setDoc(doc(omar, "hittaRattMeta", "ledare"), { packs: { [ID]: { uids: ["omar"] } } }, { merge: true }));
    await assertFails(setDoc(doc(omar, "hittaRattBest", "omar"), { packs: { [ID]: { typ: "point", s: 9999, v: 1 } } }));
  });
});

describe("försök på e-pack", () => {
  it("eleven startar ett försök på ett e-pack som vanligt (klassen kontrolleras vid submit)", async () => {
    await assertSucceeds(setDoc(doc(elev("omar"), "hittaRattAttempts", "hrgforsok0001"), { uid: "omar", packId: ID, startedAt: serverTimestamp(), status: "open" }));
  });
});
