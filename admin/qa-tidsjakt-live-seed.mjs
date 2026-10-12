// ============================================================================
// QA-seed för tidslinjefrågor i Live (#600, epic #595) – BARA mot emulatorn.
// Lägger arbetsområdet "Vasatiden" (quiz + tidslinjehändelser, samma som
// test/fixtures/vasatiden-tidsjakt.js) under ämnet "so". Körs efter
// qa-mm-live-seed.mjs + seed/seed.mjs (admin/qa-snilleblixt-preview.sh):
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8564 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9564 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-tidsjakt-live-seed.mjs
//
// Lärare: Live → Snilleblixten → Quiz från Plugga → SO → Vasatiden →
// "Ta med tidslinjefrågor" (på) → Slumpa av → frågorna 1, 3, 4, 5 och 7 är
// tidslinjefrågor. Vägrar köra utan emulator-variablerna.
// Guldrushen (#601): efter admin/qa-guldrush-preview.sh (FN_SEKVENS=1) → Live →
// Guldrushen → Quiz från Plugga → SO → Vasatiden (7 frågor, varav 5 tidslinje)
// → 4B → STARTA; eleven b01 / lilla123 spelar i egen takt.
// ============================================================================
import admin from "firebase-admin";
import { VASATIDEN_JSON } from "../test/fixtures/vasatiden-tidsjakt.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const db = admin.firestore(admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }));
const { id, ...area } = JSON.parse(VASATIDEN_JSON);
await db.doc(`subjects/so/areas/${id}`).set({ ...area, order: 99 });
console.log(`✓ subjects/so/areas/${id}: ${area.quiz.length} quizfrågor + ${area.timeline.length} tidslinjehändelser`);
