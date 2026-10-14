// ============================================================================
// QA-seed för adminsidan "Lärarkonton" (#677) – BARA mot emulatorn.
// ----------------------------------------------------------------------------
// Admin qaadmin / lilla123 (Elias), admin qarasmus (Rasmus), årskurskonto
// qaarskurs5 (5A) och klasserna 4A–4C, 5A–5B, 6A. Används av
// admin/qa-larkonton-preview.sh.
// ============================================================================

import { auth, db, isEmulator, teacherUsernameToEmail } from "./_shared.mjs";
import { claimsFor } from "../functions/teacher-accounts-core.js";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}
const CLASSES = [["4a", "4A"], ["4b", "4B"], ["4c", "4C"], ["5a", "5A"], ["5b", "5B"], ["6a", "6A"]];
for (const [id, name] of CLASSES) await db.doc(`classes/${id}`).set({ name, studentIds: [] });

async function konto(username, displayName, role, classIds = []) {
  const u = await auth.createUser({ email: teacherUsernameToEmail(username), password: "lilla123", displayName, emailVerified: true });
  await auth.setCustomUserClaims(u.uid, claimsFor(role));
  await db.doc(`teacherAccounts/${u.uid}`).set({
    username, displayName, role, classIds, active: true, createdAt: new Date(), createdBy: "qa-seed", updatedAt: new Date(),
  });
}
await konto("qaadmin", "Elias", "admin");
await konto("qarasmus", "Rasmus", "admin");
await konto("qaarskurs5", "Årskurs 5", "arskurs", ["5a"]);
console.log("✓ Seed klar: qaadmin / lilla123 (admin), qarasmus, qaarskurs5 + 6 klasser.");
process.exit(0);
