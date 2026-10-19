// ============================================================================
// QA-seed för schack mot en kompis (#780) – BARA mot emulatorn. Körs efter
// admin/qa-larkonton-seed.mjs + qa-larkonton-roller-seed.mjs (klasserna och
// eleverna 4a01–4a04 = Alva, Bilal, Cleo, Dante, lösenord lilla123) och slår på
// schack för 4A och 4B. Projektionen (namnen) byggs av appen själv (self-heal).
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}
for (const id of ["4a", "4b"]) await db.doc(`classes/${id}`).set({ enabledModules: ["schack"] }, { merge: true });
console.log("✓ Schack påslaget för 4A och 4B (elever 4a01–4a04 / lilla123).");
process.exit(0);
