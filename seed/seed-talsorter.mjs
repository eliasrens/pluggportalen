// ============================================================================
// Riktad seed: lägger BARA till ämnet Matematik + området "talsorter" (åk4)
// i Firestore. Rör inget annat.
//
//   node seed/seed-talsorter.mjs           (torrkörning – visar vad som skulle skrivas)
//   node seed/seed-talsorter.mjs --write   (skriver till Firestore)
//
// Till skillnad från seed/seed.mjs (som skriver HELA seed-datan och därmed skulle
// kunna skriva över t.ex. demokrati-områdets separat-seedade partipar) skriver
// den här ENDAST subjects/matte + subjects/matte/areas/talsorter, med merge:true.
// Går via Admin SDK (admin/_shared.mjs) – kräver service-account-creds precis som
// seed.mjs. Mot emulatorn: sätt FIRESTORE_EMULATOR_HOST (se docs/ADMIN.md).
// Idempotent: kör flera gånger utan bieffekt.
// ============================================================================

import { db, isEmulator } from "../admin/_shared.mjs";
import { subjects, areas } from "./seed-data.js";

const WRITE = process.argv.includes("--write");
const SUBJECT_ID = "matte";
const AREA_ID = "talsorter";

const subject = subjects.find((s) => s.id === SUBJECT_ID);
const area = (areas[SUBJECT_ID] || []).find((a) => a.id === AREA_ID);

if (!subject) {
  console.error(`Ämnet "${SUBJECT_ID}" saknas i seed-data.js`);
  process.exit(1);
}
if (!area) {
  console.error(`Området "${AREA_ID}" saknas i seed-data.js`);
  process.exit(1);
}

console.log(`Riktad seed → ${isEmulator ? "EMULATOR" : "LIVE"} ${WRITE ? "(SKRIVER)" : "(torrkörning)"}`);
console.log(`  Ämne:   ${subject.id} — "${subject.name}"`);
console.log(`  Område: ${area.id} — "${area.name}" (grade=${area.grade ?? "—"})`);
const n = (x) => (Array.isArray(x) ? x.length : 0);
console.log(`  Innehåll: ${n(area.texts)} texter · ${n(area.quiz)} quiz · ${n(area.pairs)} par`);

if (!WRITE) {
  console.log("\nTorrkörning klar. Inget skrevs. Kör med --write för att skriva till Firestore.");
  process.exit(0);
}

const { id: sid, ...srest } = subject;
await db.doc(`subjects/${sid}`).set(srest, { merge: true });

const { id: aid, ...arest } = area;
await db.doc(`subjects/${sid}/areas/${aid}`).set(arest, { merge: true });

console.log(`\nKlart – skrev subjects/${sid} + subjects/${sid}/areas/${aid}.`);
process.exit(0);
