// ============================================================================
// Regel-tester: fokusläge / klass-lås (#436) – classes/{id}.lock.
// ----------------------------------------------------------------------------
// Låset ska vara LÄSBART för klassens elever (klienten tillämpar det) och
// SKRIVBART bara av lärare, med validerad form: mal.typ i enumen, område kräver
// id, `till` ett heltal (ms) framåt i tiden och högst 24 h bort (mot SERVERNS
// klocka), doljOvrigt bool. Ett oförändrat, redan utgånget lås får inte blockera
// andra klass-skrivningar. Speglar firestore-rules-class-modules.test.js.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

const MIN = 60_000;
const omLock = (over = {}) => ({
  mal: { typ: "omrade", id: "so/vikingatiden", namn: "Vikingatiden" },
  till: Date.now() + 30 * MIN,
  doljOvrigt: false,
  ...over,
});

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv(
    "pluggportalen-rules-test-class-lock"
  ));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Seed: elev1 går i 6a (låst till Läsresan), 6b har ett UTGÅNGET lås.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), {
      name: "6A",
      studentIds: ["elev1"],
      lock: { mal: { typ: "lasresan" }, till: Date.now() + 20 * MIN, doljOvrigt: true },
    });
    await setDoc(doc(db, "classes", "6b"), {
      name: "6B",
      studentIds: ["elev2"],
      lock: { mal: { typ: "lasresan" }, till: Date.now() - 60 * MIN, doljOvrigt: false },
    });
  });
});

describe("Fokusläge (#436): lock läsbart för eleven, skrivbart för lärare", () => {
  it("klassens elev FÅR läsa låset på sin klass", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
    assert.equal(snap.data().lock.mal.typ, "lasresan");
    assert.equal(snap.data().lock.doljOvrigt, true);
  });

  it("obehörig (ej inloggad) får INTE läsa klassen", async () => {
    await assertFails(getDoc(doc(unauth(), "classes", "6a")));
  });

  it("eleven får INTE låsa upp, ändra eller sätta ett lås", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lock: deleteField() }));
    await assertFails(
      updateDoc(doc(elev("elev1"), "classes", "6a"), { "lock.till": Date.now() + MIN })
    );
    await assertFails(
      setDoc(doc(elev("elev2"), "classes", "6b"), { lock: omLock() }, { merge: true })
    );
  });

  it("läraren FÅR låsa till ett område eller Läsresan, och låsa upp", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { lock: omLock() }));
    await assertSucceeds(
      updateDoc(doc(teacher(), "classes", "6b"), {
        lock: { mal: { typ: "lasresan" }, till: Date.now() + 45 * MIN, doljOvrigt: true },
      })
    );
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { lock: deleteField() }));
  });

  it("#734: läraren FÅR låsa till Ekvationsresan, Hitta rätt! och Mattematchen", async () => {
    for (const typ of ["ekvationsresan", "hittaratt", "mattematchen"]) {
      await assertSucceeds(
        updateDoc(doc(teacher(), "classes", "6b"), {
          lock: { mal: { typ }, till: Date.now() + 30 * MIN, doljOvrigt: false },
        })
      );
      const snap = await getDoc(doc(elev("elev2"), "classes", "6b"));
      assert.equal(snap.data().lock.mal.typ, typ, "klassens elev läser det nya låset");
    }
  });

  it("#734: eleven får INTE byta mål till en ny modul", async () => {
    await assertFails(
      updateDoc(doc(elev("elev1"), "classes", "6a"), {
        lock: { mal: { typ: "hittaratt" }, till: Date.now() + 30 * MIN, doljOvrigt: false },
      })
    );
  });

  it("#740: läraren FÅR låsa till ett provtillfälle – men bara med mal.id (> 2 tecken)", async () => {
    const prov = (mal) => ({ lock: { mal, till: Date.now() + 50 * MIN, doljOvrigt: true } });
    await assertSucceeds(
      updateDoc(doc(teacher(), "classes", "6b"), prov({ typ: "prov", id: "tillfalle-abc", namn: "Vikingaprovet" }))
    );
    const snap = await getDoc(doc(elev("elev2"), "classes", "6b"));
    assert.equal(snap.data().lock.mal.id, "tillfalle-abc", "klassens elev läser provlåset");
    await assertFails(updateDoc(doc(teacher(), "classes", "6a"), prov({ typ: "prov" })));
    await assertFails(updateDoc(doc(teacher(), "classes", "6a"), prov({ typ: "prov", id: "ab" })));
    await assertFails(updateDoc(doc(teacher(), "classes", "6a"), prov({ typ: "prov", id: 42 })));
    await assertFails(
      updateDoc(doc(elev("elev1"), "classes", "6a"), prov({ typ: "prov", id: "tillfalle-abc" })),
      "eleven sätter inget provlås"
    );
  });

  it("#788: provlåsets efter-val – fyra lägen, moduler bara i \"egna\", bara på ett provlås", async () => {
    const prov = (efter, typ = "prov") => ({
      lock: { mal: { typ, id: "tillfalle-abc" }, till: Date.now() + 50 * MIN, doljOvrigt: true, efter },
    });
    for (const lage of ["prov", "ovning", "klass"]) {
      await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage })), lage);
    }
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage: "egna", moduler: ["plugga", "shop"] })));
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage: "egna", moduler: [] })));
    const snap = await assertSucceeds(getDoc(doc(elev("elev2"), "classes", "6b")));
    assert.deepEqual(snap.data().lock.efter, { lage: "egna", moduler: [] }, "klassens elev läser efter-valet");
    // Fel form avvisas.
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage: "allt" })));
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), prov({})));
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), prov("klass")));
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage: "ovning", moduler: ["plugga"] })));
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage: "egna", moduler: "plugga" })));
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), prov({ lage: "egna", hack: 1 })));
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"),
      prov({ lage: "egna", moduler: Array.from({ length: 21 }, (_, i) => `m${i}`) })));
    // Bara ett provlås har efter-val.
    await assertFails(updateDoc(doc(teacher(), "classes", "6b"), {
      lock: { mal: { typ: "lasresan" }, till: Date.now() + 30 * MIN, doljOvrigt: false, efter: { lage: "klass" } },
    }));
    // Eleven kan inte frige sig själv.
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), prov({ lage: "klass" })));
  });

  it("#735: läraren FÅR låsa till Bråkresan, eleven får INTE ändra eller ta bort låset", async () => {
    const brak = { mal: { typ: "brakresan" }, till: Date.now() + 30 * MIN, doljOvrigt: false };
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { lock: brak }));
    const snap = await getDoc(doc(elev("elev1"), "classes", "6a"));
    assert.equal(snap.data().lock.mal.typ, "brakresan", "klassens elev läser låset");
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lock: { ...brak, doljOvrigt: true } }));
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lock: deleteField() }));
    await assertFails(
      updateDoc(doc(elev("elev1"), "classes", "6b"), { lock: brak }),
      "eleven kan inte heller låsa en klass till Bråkresan"
    );
  });

  it("läraren får INTE spara en okänd mål-typ eller ett område utan id", async () => {
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ mal: { typ: "shop" } }) })
    );
    for (const typ of ["live", "plugga", "okandmodul", ""]) {
      await assertFails(
        updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ mal: { typ } }) })
      );
    }
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ mal: { typ: "omrade" } }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), {
        lock: omLock({ mal: { typ: "omrade", id: "so/x", extra: 1 } }),
      })
    );
  });

  it("sluttiden måste ligga framåt och högst 24 h bort (serverns klocka)", async () => {
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ till: Date.now() - MIN }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), {
        lock: omLock({ till: Date.now() + 25 * 60 * MIN }),
      })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ till: "10:45" }) })
    );
  });

  it("fel typer och extra fält avvisas", async () => {
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ doljOvrigt: "ja" }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: { ...omLock(), hack: true } })
    );
    await assertFails(updateDoc(doc(teacher(), "classes", "6a"), { lock: "lasresan" }));
  });

  it("ett oförändrat UTGÅNGET lås blockerar inte andra klass-skrivningar", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { name: "6B 2" }));
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6b"), { hiddenModules: ["shop"] }, { merge: true })
    );
  });

  it("bakåtkompatibelt: klass-skrivningar utan lås funkar som förut", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "classes", "6c"), { name: "6C", studentIds: [] }));
    await assertSucceeds(deleteDoc(doc(teacher(), "classes", "6b")));
  });
});
