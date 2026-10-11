// ============================================================================
// Regel-/sparningstest för Tidsjakten (epic #595 / issue #596) mot emulatorn.
// ----------------------------------------------------------------------------
// Ett inklistrat Vasatiden-svar (quiz + par + timeline) valideras med
// parseAndValidateArea och sparas som lärarsidan gör det (saveArea: setDoc med
// dokumentet utan "id"). Läses tillbaka oförändrat – timeline[] med heltalsår
// (även negativa) och timelineSpan överlever Firestore. Områdesreglerna (lärare
// skriver, inloggade läser) behöver ingen ändring för de nya fälten.
//
//   npm run test:rules
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { parseAndValidateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";

let testEnv, elev, teacher;

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-tidsjakt"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "subjects", "so"), { name: "SO", order: 1 });
  });
});

/** Som saveArea i src/data-content.js: id är dokumentets id, inte ett fält. */
function saveAs(db, area) {
  const { id, ...rest } = area;
  return setDoc(doc(db, "subjects", "so", "areas", id), rest);
}

describe("Tidsjakten: områden med timeline", () => {
  it("läraren sparar ett validerat Vasatiden-område och det läses tillbaka oförändrat", async () => {
    const res = parseAndValidateArea(VASATIDEN_JSON);
    assert.equal(res.ok, true, res.errors.join(" | "));
    await assertSucceeds(saveAs(teacher(), res.value));

    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "subjects", "so", "areas", "vasatiden")));
    const { id, ...expected } = res.value;
    assert.equal(id, "vasatiden");
    assert.deepEqual(snap.data(), expected);
    assert.equal(snap.data().timeline.length, 5);
    assert.ok(snap.data().timeline.every((e) => Number.isInteger(e.year)));
    assert.deepEqual(snap.data().exerciseTypes, ["quiz", "pairs", "tidsjakt"]);
  });

  it("negativa år (f.Kr.) sparas som heltal", async () => {
    const res = parseAndValidateArea(
      JSON.stringify({
        name: "Antiken",
        timeline: [{ event: "Caesar mördas", question: "Vilket år mördades Caesar?", year: -44,
          description: "Romarnas ledare dödades av senatorer.", explanation: "Det hände 44 f.Kr." }],
        timelineSpan: { from: -800, to: 500 },
      })
    );
    assert.equal(res.ok, true, res.errors.join(" | "));
    await assertSucceeds(saveAs(teacher(), res.value));
    const snap = await getDoc(doc(teacher(), "subjects", "so", "areas", "antiken"));
    assert.equal(snap.data().timeline[0].year, -44);
    assert.deepEqual(snap.data().timelineSpan, { from: -800, to: 500 });
  });

  it("\"skapa fler\" sparar det sammanslagna området utan dubbletter", async () => {
    const base = parseAndValidateArea(VASATIDEN_JSON).value;
    await saveAs(teacher(), base);
    const stored = (await getDoc(doc(teacher(), "subjects", "so", "areas", "vasatiden"))).data();
    const merged = mergeAreaContent({ ...stored, id: "vasatiden" }, {
      timeline: [
        base.timeline[0],
        { event: "Dackefejden börjar", question: "Vilket år började Dackefejden?", year: 1542,
          description: "Bönder i Småland gjorde uppror mot kungen.", explanation: "Det hände 1542." },
      ],
    });
    assert.equal(merged.ok, true, merged.errors.join(" | "));
    await assertSucceeds(saveAs(teacher(), merged.value));
    const after = (await getDoc(doc(teacher(), "subjects", "so", "areas", "vasatiden"))).data();
    assert.equal(after.timeline.length, 6);
    assert.equal(new Set(after.timeline.map((e) => e.id)).size, 6);
  });

  it("en elev kan INTE skriva tidslinjefrågor på ett område", async () => {
    await saveAs(teacher(), parseAndValidateArea(VASATIDEN_JSON).value);
    const ref = doc(elev("elev1"), "subjects", "so", "areas", "vasatiden");
    await assertFails(updateDoc(ref, { timeline: [] }));
    await assertFails(setDoc(doc(elev("elev1"), "subjects", "so", "areas", "fusk"), { timeline: [] }));
  });
});
