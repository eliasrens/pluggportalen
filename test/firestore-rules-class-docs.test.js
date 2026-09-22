// ============================================================================
// Regel-tester: de KLASSMEDLEM-skrivbara klass-dokumenten.
// ----------------------------------------------------------------------------
// classProjections/{classId} (#231/#232) och classProjects/{classId} (#331) är
// de enda dokument en ELEV får skriva utanför sin egen studentData – båda via
// samma isClassMember-regel (medlem i classes/{classId}.studentIds, eller
// lärare). Läsning är öppen för alla inloggade (samma relaxade postur som
// #114). Utbrutet ur firestore-rules.test.js (filtaket); riggen delas via
// test/helpers/rules-env.js. Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv(
    "pluggportalen-rules-test-class-docs"
  ));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Seed: elev1 är MEDLEM i 6a, elev2 är det INTE.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1"] });
  });
});

describe("Klass-projektion (#231/#232): läs öppet, skriv för klassmedlem", () => {
  // Projektionen bär bara kosmetisk översikts-data; läsning är öppen för
  // inloggade (speglar #114), skrivning kräver klassmedlemskap (eller lärare).
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "classProjections", "6a"), {
        members: { elev1: { namn: "Astrid", stars: 2 } },
      });
    });
  });

  it("inloggad elev FÅR läsa en klass-projektion (även icke-medlem, kosmetiskt)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "classProjections", "6a")));
    await assertSucceeds(getDoc(doc(elev("elev2"), "classProjections", "6a")));
  });

  it("obehörig (ej inloggad) får INTE läsa eller skriva projektionen", async () => {
    await assertFails(getDoc(doc(unauth(), "classProjections", "6a")));
    await assertFails(
      setDoc(doc(unauth(), "classProjections", "6a"), { members: {} })
    );
  });

  it("klassmedlem (elev1 ∈ 6a) FÅR uppdatera sin entry via fält-path", async () => {
    await assertSucceeds(
      updateDoc(doc(elev("elev1"), "classProjections", "6a"), {
        "members.elev1.stars": 5,
      })
    );
  });

  it("klassmedlem FÅR skapa projektionen om den saknas (setDoc merge, self-heal)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "classes", "6c"), { name: "6C", studentIds: ["elev1"] });
    });
    await assertSucceeds(
      setDoc(
        doc(elev("elev1"), "classProjections", "6c"),
        { members: { elev1: { namn: "Astrid" } } },
        { merge: true }
      )
    );
  });

  it("NON-medlem (elev2 ∉ 6a) får INTE skriva projektionen", async () => {
    await assertFails(
      updateDoc(doc(elev("elev2"), "classProjections", "6a"), {
        "members.elev2.stars": 9,
      })
    );
    await assertFails(
      setDoc(doc(elev("elev2"), "classProjections", "6a"), { members: {} })
    );
  });

  it("skrivning nekas om klass-dokumentet inte finns (exists-guard)", async () => {
    await assertFails(
      setDoc(doc(elev("elev1"), "classProjections", "saknad-klass"), { members: {} })
    );
  });

  it("läraren får läsa och skriva alla klass-projektioner (backfill)", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "classProjections", "6a")));
    await assertSucceeds(
      setDoc(
        doc(teacher(), "classProjections", "6a"),
        { members: { elev1: { stars: 3 } } },
        { merge: true }
      )
    );
  });
});

describe("Klassprojekt (#331): läs öppet, skriv för klassmedlem (speglar projektionen)", () => {
  // classProjects/{classId} bär klass-gemensam, okänslig insamlings-data
  // (mål/insamlat/bidrag till byns gemensamma ytor) – samma postur som
  // classProjections. ⚠️ Regeln är LIVE först efter
  // `firebase deploy --only firestore:rules`.
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "classProjects", "6a"), {
        projects: {
          stadshus: { goalAmount: 500, collected: 40, contributions: { elev1: 40 } },
        },
      });
    });
  });

  it("inloggad elev FÅR läsa klassprojekt (även icke-medlem)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "classProjects", "6a")));
    await assertSucceeds(getDoc(doc(elev("elev2"), "classProjects", "6a")));
  });

  it("obehörig (ej inloggad) får INTE läsa eller skriva", async () => {
    await assertFails(getDoc(doc(unauth(), "classProjects", "6a")));
    await assertFails(setDoc(doc(unauth(), "classProjects", "6a"), { projects: {} }));
  });

  it("klassmedlem (elev1 ∈ 6a) FÅR donera (fält-path-update på sitt projekt)", async () => {
    await assertSucceeds(
      updateDoc(doc(elev("elev1"), "classProjects", "6a"), {
        "projects.stadshus.collected": 60,
        "projects.stadshus.contributions.elev1": 60,
      })
    );
  });

  it("klassmedlem FÅR skapa dokumentet om det saknas (setDoc merge, första donationen)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "classes", "6c"), { name: "6C", studentIds: ["elev1"] });
    });
    await assertSucceeds(
      setDoc(
        doc(elev("elev1"), "classProjects", "6c"),
        { projects: { park: { goalAmount: 300, collected: 10, contributions: { elev1: 10 } } } },
        { merge: true }
      )
    );
  });

  it("NON-medlem (elev2 ∉ 6a) får INTE skriva", async () => {
    await assertFails(
      updateDoc(doc(elev("elev2"), "classProjects", "6a"), {
        "projects.stadshus.collected": 999,
      })
    );
    await assertFails(setDoc(doc(elev("elev2"), "classProjects", "6a"), { projects: {} }));
  });

  it("skrivning nekas om klass-dokumentet inte finns (exists-guard)", async () => {
    await assertFails(
      setDoc(doc(elev("elev1"), "classProjects", "saknad-klass"), { projects: {} })
    );
  });

  it("läraren får läsa och skriva alla klassprojekt", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "classProjects", "6a")));
    await assertSucceeds(
      setDoc(
        doc(teacher(), "classProjects", "6a"),
        { projects: { skola: { goalAmount: 800, collected: 0, contributions: {} } } },
        { merge: true }
      )
    );
  });
});
