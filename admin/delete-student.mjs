// ============================================================================
// Radera ett elevkonto HELT (lokalt, Admin SDK): Auth-konto + Firestore-dokument.
// ----------------------------------------------------------------------------
// Lärarens radera-knapp i klienten tar bort students/{id} + studentData/{id},
// men kan INTE radera själva Firebase Auth-kontot (webb-SDK:t kan bara radera den
// inloggade användaren). Detta skript städar bort Auth-kontot också. Refereras
// från src/data-content.js (deleteStudent-kommentaren).
//
//   node admin/delete-student.mjs --id=elev1                 # torrkörning
//   node admin/delete-student.mjs --id=elev1 --commit        # raderar
//
// Hitta rätt! (#609): tar även bort elevens rad ur alla skoltopplistor (och
// räknar om ledarna/pokalerna), personbästa och försök – samma kod som
// servern (functions/hitta-ratt-core.js taBortElev).
//
// Se docs/ADMIN.md. Kräver service-account (live) eller emulator-env.
// ============================================================================

import { auth, db, parseArgs, isEmulator, admin } from "./_shared.mjs";
import { taBortElev } from "../functions/hitta-ratt-core.js";

const { flags, opts } = parseArgs();
const id = opts.id;
const COMMIT = flags.has("commit");

if (!id) {
  console.error("✗ Ange --id=<elevens doc-id/uid>.");
  process.exit(1);
}

async function main() {
  console.log(
    `Mål: ${isEmulator ? "EMULATOR" : "LIVE"} – radera elev "${id}" ` +
      (COMMIT ? "(SKARP)" : "(torrkörning)")
  );

  const authUser = await auth.getUser(id).catch(() => null);
  const stuDoc = await db.collection("students").doc(id).get();
  const dataDoc = await db.collection("studentData").doc(id).get();

  console.log(`  Auth-konto:        ${authUser ? "finns" : "saknas"}`);
  console.log(`  students/${id}:     ${stuDoc.exists ? "finns" : "saknas"}`);
  console.log(`  studentData/${id}:  ${dataDoc.exists ? "finns" : "saknas"}`);
  const hrBoards = (await db.collection("hittaRattBoards").get()).docs.filter((d) => d.data().entries?.[id]);
  console.log(`  Hitta rätt!-topplistor: ${hrBoards.length ? hrBoards.map((d) => d.id).join(", ") : "inga"}`);

  if (!COMMIT) {
    console.log("\nTorrkörning. Kör med --commit för att radera ovanstående.");
    return;
  }

  if (authUser) {
    await auth.deleteUser(id);
    console.log("  ✓ Auth-konto raderat");
  }
  if (stuDoc.exists) {
    await db.collection("students").doc(id).delete();
    console.log(`  ✓ students/${id} raderat`);
  }
  if (dataDoc.exists) {
    await db.collection("studentData").doc(id).delete();
    console.log(`  ✓ studentData/${id} raderat`);
  }
  const hr = await taBortElev({ db, FieldValue: admin.firestore.FieldValue }, id);
  console.log(`  ✓ Hitta rätt!: ${hr.boards.length} topplistor, ${hr.attempts} försök, personbästa borttaget`);
  console.log("\nKlart.");
}

main().catch((e) => {
  console.error("✗ Fel:", e.message);
  process.exit(1);
});
