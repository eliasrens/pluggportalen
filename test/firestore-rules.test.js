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
  updateDoc,
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

  // #114: läsning av en ANNAN elevs students/studentData är numera öppen för alla
  // inloggade (grannby-vyn ska kunna gå in i andra klassers rum). Isoleringen
  // ligger nu i SKRIVreglerna (nedan) + huslåset – inte i läsningen.
  it("FÅR nu läsa en annan elevs students-dokument (#114: öppet för inloggade)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "students", "elev2")));
  });
  it("FÅR nu läsa en annan elevs (olåsta) studentData (#114: öppet för inloggade)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "studentData", "elev2")));
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

describe("Cross-class-läsning (#114) – öppen för inloggade, skriv-isolerad", () => {
  // elev1 & elev2 i "6a", elev3 i "6b" (olika klasser). #114: grannby-vyn ska
  // kunna gå in i en ANNAN klass elevers hus/rum → students/studentData-läsning
  // är öppen för ALLA inloggade (huslåset spärrar fortfarande låsta rum, och
  // skrivning är alltid isolerad till eleven själv/läraren).
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "students", "elev1"), { classIds: ["6a"] }, { merge: true });
      await setDoc(doc(db, "students", "elev2"), { classIds: ["6a"] }, { merge: true });
      await setDoc(doc(db, "students", "elev3"), {
        namn: "Cecilia",
        username: "elev3",
        classIds: ["6b"],
      });
      await setDoc(doc(db, "studentData", "elev3"), { coins: 10, progress: {} });
    });
  });

  it("elev får LÄSA en klasskamrats students + studentData (byn)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "students", "elev2")));
    await assertSucceeds(getDoc(doc(elev("elev1"), "studentData", "elev2")));
  });
  it("elev får nu LÄSA en elev i en ANNAN klass (grannby-rum, #114)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "students", "elev3")));
    await assertSucceeds(getDoc(doc(elev("elev1"), "studentData", "elev3")));
  });
  it("elev får ändå INTE skriva en annan elevs studentData eller students (någon klass)", async () => {
    await assertFails(setDoc(doc(elev("elev1"), "studentData", "elev2"), { coins: 0 }));
    await assertFails(setDoc(doc(elev("elev1"), "students", "elev2"), { namn: "x" }));
    await assertFails(setDoc(doc(elev("elev1"), "studentData", "elev3"), { coins: 0 }));
  });
  it("en klasslös elev får också läsa andra (öppet), men inte skriva", async () => {
    await assertSucceeds(getDoc(doc(elev("elev3"), "students", "elev1")));
    await assertSucceeds(getDoc(doc(elev("elev3"), "studentData", "elev2")));
    await assertFails(setDoc(doc(elev("elev3"), "studentData", "elev1"), { coins: 0 }));
  });
});

describe("Huslås (#33): husLast==true spärrar kamratläsning av studentData", () => {
  // elev1 & elev2 delar klass 6a; elev2 LÅSER sitt hus (studentData.husLast).
  // Låset får inte gå att kringgå klient-sida: en klasskamrat ska då nekas läsa
  // studentData server-sidan, men eleven själv/läraren når den alltid, och husets
  // EXTERIÖR (students-dokumentet) är fortfarande läsbar så huset syns i byn.
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "students", "elev1"), { classIds: ["6a"] }, { merge: true });
      await setDoc(doc(db, "students", "elev2"), { classIds: ["6a"] }, { merge: true });
      await setDoc(doc(db, "students", "elev3"), {
        namn: "Cecilia", username: "elev3", classIds: ["6b"],
      });
      await setDoc(
        doc(db, "studentData", "elev2"),
        { coins: 50, progress: {}, husLast: true },
        { merge: true }
      );
    });
  });

  it("klasskamrat får INTE läsa en LÅST elevs studentData", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "studentData", "elev2")));
  });
  it("en elev i en ANNAN klass får INTE heller läsa en LÅST elevs studentData (#114)", async () => {
    // Huslåset spärrar oavsett klass – låset går inte att kringgå cross-class.
    await assertFails(getDoc(doc(elev("elev3"), "studentData", "elev2")));
  });
  it("eleven själv läser/skriver sin egen studentData även när den är låst", async () => {
    await assertSucceeds(getDoc(doc(elev("elev2"), "studentData", "elev2")));
    await assertSucceeds(
      setDoc(doc(elev("elev2"), "studentData", "elev2"), { husLast: false }, { merge: true })
    );
  });
  it("läraren får läsa en låst elevs studentData", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "studentData", "elev2")));
  });
  it("klasskamrat får ändå läsa students (husets exteriör/figur syns i byn)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "students", "elev2")));
  });
});

// (#114) Kollektionerna classStats (#113) och looks är borttagna – grannby-vyn
// räknar hus + stjärnor live ur grannklassens studentData. Verifiera att båda nu
// faller på "neka allt"-regeln (ingen kvarlämnad öppen regel).
describe("Borttagna collections (looks/classStats, #114) nekas helt", () => {
  it("neka läs/skriv på classStats även för lärare/elev (död collection)", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "classStats", "6a")));
    await assertFails(setDoc(doc(elev("elev1"), "classStats", "6a"), { totalStars: 1 }));
    await assertFails(setDoc(doc(teacher(), "classStats", "6a"), { totalStars: 1 }));
  });
  it("neka läs/skriv på looks även för lärare/elev (död collection)", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "looks", "elev2")));
    await assertFails(setDoc(doc(elev("elev1"), "looks", "elev1"), { namn: "x" }));
    await assertFails(setDoc(doc(teacher(), "looks", "elev1"), { namn: "x" }));
  });
});

describe("Klass-projektion (#231/#232): läs öppet, skriv för klassmedlem", () => {
  // Seed: classes/6a har studentIds ["elev1"] (från yttre beforeEach). elev1 är
  // alltså MEDLEM i 6a, elev2 är det INTE. Projektionen bär bara kosmetisk
  // översikts-data; läsning är öppen för inloggade (speglar #114), skrivning
  // kräver klassmedlemskap (eller lärare).
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
    // classes/6b finns inte → använd en klass elev1 är medlem i men utan projektion.
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
