// ============================================================================
// Regel-tester: Ämnesläsningens texter (#673). Ingen ny regel behövs –
// ämnestexterna är ett fält (readingTexts) på arbetsområdet
// subjects/{s}/areas/{a}, som redan har "alla inloggade läser, bara lärare
// skriver". Testerna låser fast att just det gäller fältet:
//   läraren skriver (lägger till/redigerar/tar bort), eleven läser men skriver inte.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

const text = (id, level) => ({
  id,
  title: `Text ${id}`,
  level,
  textType: "fact",
  body: "Vikingarna seglade långt.",
  questions: [{ id: "q1", question: "Vad gjorde de?", options: ["Seglade", "Flög", "Cyklade", "Sov"], answerIndex: 0, category: "fakta" }],
});
const area = (readingTexts) => ({
  name: "Vikingatiden",
  order: 1,
  exerciseTypes: ["amneslasning"],
  texts: [],
  quiz: [],
  pairs: [],
  readingTexts,
});
const AREA = ["subjects", "so", "areas", "vikingatiden"];

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-amnes-texter"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "subjects", "so"), { name: "SO", order: 1 });
    await setDoc(doc(db, ...AREA), area([text("a", 1)]));
  });
});

describe("Ämnesläsning: area.readingTexts", () => {
  it("läraren FÅR spara området med nya ämnestexter (hela dokumentet, som saveArea)", async () => {
    await assertSucceeds(setDoc(doc(teacher(), ...AREA), area([text("a", 1), text("b", 2), text("c", 3)])));
  });

  it("läraren FÅR redigera och ta bort ämnestexter", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), ...AREA), { readingTexts: [] }));
  });

  it("läraren FÅR skapa ett område med bara ämnesläsning", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "subjects", "no", "areas", "fotosyntes"), area([text("x", 2)])));
  });

  it("eleven FÅR läsa områdets ämnestexter", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), ...AREA)));
    if (snap.data().readingTexts.length !== 1) throw new Error("ämnestexten saknas");
  });

  it("eleven får INTE skriva ämnestexter", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), ...AREA), { readingTexts: [text("fusk", 1)] }));
    await assertFails(setDoc(doc(elev("elev1"), ...AREA), area([])));
  });

  it("utloggad får varken läsa eller skriva", async () => {
    await assertFails(getDoc(doc(unauth(), ...AREA)));
    await assertFails(updateDoc(doc(unauth(), ...AREA), { readingTexts: [] }));
  });
});
