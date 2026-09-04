// ============================================================================
// Regel-tester för firestore.rules (Firestore-emulatorn).
// ----------------------------------------------------------------------------
// Bevisar att den härdade firestore.rules faktiskt spärrar det som
// docs/security-plan.md §2 pekar ut som hoten:
//   * En OBEHÖRIG (utan inloggning) kan INTE läsa students (lösenordslista),
//     inte läsa studentData, inte läsa innehåll, inte skriva någonstans.
//   * En ELEV når BARA sitt eget students/studentData – inte en annan elevs,
//     och kan inte skapa/ändra students-dokument eller innehåll/klasser.
//   * En LÄRARE (custom claim teacher:true) når allt (läser/skriver alla
//     collections).
//
// Körs mot Firestore-emulatorn:
//   npm run test:rules
// (firebase emulators:exec startar emulatorn, kör node --test, river den.)
//
// Kräver Java (Firestore-emulatorn är en JVM-process) – se docs/ADMIN.md.
// ============================================================================

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

const PROJECT_ID = "pluggportalen-rules-test";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Töm databasen och seeda utgångsläget via admin-kontexten (kringgår reglerna)
// före varje test, så testerna är oberoende.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "students", "elev1"), {
      namn: "Astrid",
      username: "elev1",
      avatarId: "fox",
    });
    await setDoc(doc(db, "students", "elev2"), {
      namn: "Björn",
      username: "elev2",
      avatarId: "owl",
    });
    await setDoc(doc(db, "studentData", "elev1"), { coins: 300, progress: {} });
    await setDoc(doc(db, "studentData", "elev2"), { coins: 50, progress: {} });
    await setDoc(doc(db, "subjects", "so"), { name: "SO", order: 1 });
    await setDoc(doc(db, "subjects", "so", "areas", "vikingatiden"), {
      name: "Vikingatiden",
    });
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1"] });
  });
});

// --- Kontexter -------------------------------------------------------------
// Obehörig = ingen Auth. Elev = uid == doc-id, ingen teacher-claim.
// Lärare = valfri uid med custom claim teacher:true.
function unauth() {
  return testEnv.unauthenticatedContext().firestore();
}
function elev(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}
function teacher() {
  return testEnv.authenticatedContext("larare1", { teacher: true }).firestore();
}

describe("Obehörig (ej inloggad) blockeras helt", () => {
  it("kan INTE läsa students (ingen lösenords-/kontolista läcker)", async () => {
    await assertFails(getDoc(doc(unauth(), "students", "elev1")));
  });
  it("kan INTE läsa studentData", async () => {
    await assertFails(getDoc(doc(unauth(), "studentData", "elev1")));
  });
  it("kan INTE läsa innehåll (subjects/areas)", async () => {
    await assertFails(getDoc(doc(unauth(), "subjects", "so")));
    await assertFails(
      getDoc(doc(unauth(), "subjects", "so", "areas", "vikingatiden"))
    );
  });
  it("kan INTE läsa classes", async () => {
    await assertFails(getDoc(doc(unauth(), "classes", "6a")));
  });
  it("kan INTE skriva studentData (ingen direktskrivning)", async () => {
    await assertFails(
      setDoc(doc(unauth(), "studentData", "elev1"), { coins: 999999 })
    );
  });
  it("kan INTE skriva/skapa students", async () => {
    await assertFails(
      setDoc(doc(unauth(), "students", "hacker"), { namn: "x" })
    );
  });
  it("kan INTE radera en elevs data", async () => {
    await assertFails(deleteDoc(doc(unauth(), "studentData", "elev1")));
    await assertFails(deleteDoc(doc(unauth(), "students", "elev1")));
  });
  it("kan INTE vandalisera innehåll eller klasser", async () => {
    await assertFails(
      setDoc(doc(unauth(), "subjects", "so", "areas", "vikingatiden"), {
        name: "hackad",
      })
    );
    await assertFails(setDoc(doc(unauth(), "classes", "6a"), { name: "x" }));
  });
});

describe("Elev når bara sitt eget", () => {
  it("kan läsa sitt eget students-dokument", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "students", "elev1")));
  });
  it("kan läsa och skriva sin egen studentData (coins/progress)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "studentData", "elev1")));
    await assertSucceeds(
      setDoc(doc(elev("elev1"), "studentData", "elev1"), {
        coins: 310,
        progress: {},
      })
    );
  });
  it("kan läsa inloggat innehåll och sin klasstilldelning", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "subjects", "so")));
    await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
  });

  it("kan INTE läsa en annan elevs students-dokument", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "students", "elev2")));
  });
  it("kan INTE läsa en annan elevs studentData", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "studentData", "elev2")));
  });
  it("kan INTE skriva en annan elevs studentData", async () => {
    await assertFails(
      setDoc(doc(elev("elev1"), "studentData", "elev2"), { coins: 0 })
    );
  });
  it("kan INTE radera en annan elevs studentData", async () => {
    await assertFails(deleteDoc(doc(elev("elev1"), "studentData", "elev2")));
  });
  it("kan INTE skapa/ändra students-dokument (bara läraren skapar konton)", async () => {
    await assertFails(
      setDoc(doc(elev("elev1"), "students", "elev1"), { namn: "Ändrad" })
    );
    await assertFails(
      setDoc(doc(elev("elev1"), "students", "elev3"), { namn: "Ny" })
    );
  });
  it("kan INTE skriva innehåll eller klasser", async () => {
    await assertFails(
      setDoc(doc(elev("elev1"), "subjects", "so"), { name: "x" })
    );
    await assertFails(
      setDoc(doc(elev("elev1"), "classes", "6a"), { name: "x" })
    );
  });
});

describe("Lärare (claim teacher:true) når allt", () => {
  it("kan läsa alla elevers students och studentData", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "students", "elev1")));
    await assertSucceeds(getDoc(doc(teacher(), "students", "elev2")));
    await assertSucceeds(getDoc(doc(teacher(), "studentData", "elev2")));
  });
  it("kan skapa/uppdatera elever och ge coins", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "students", "elev9"), {
        namn: "Ny elev",
        username: "elev9",
      })
    );
    await assertSucceeds(
      setDoc(doc(teacher(), "studentData", "elev2"), { coins: 999 })
    );
  });
  it("kan skriva innehåll (subjects/areas) och klasser", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "subjects", "so", "areas", "vikingatiden"), {
        name: "Vikingatiden (uppd.)",
      })
    );
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6a"), {
        name: "6A",
        studentIds: ["elev1", "elev2"],
      })
    );
  });
  it("kan radera elever", async () => {
    await assertSucceeds(deleteDoc(doc(teacher(), "students", "elev2")));
    await assertSucceeds(deleteDoc(doc(teacher(), "studentData", "elev2")));
  });
});

describe("Okända collections nekas alltid", () => {
  it("neka läs/skriv på en icke-modellerad collection även för lärare", async () => {
    await assertFails(getDoc(doc(teacher(), "hemligt", "x")));
    await assertFails(setDoc(doc(teacher(), "hemligt", "x"), { a: 1 }));
    await assertFails(setDoc(doc(unauth(), "hemligt", "x"), { a: 1 }));
  });
});
