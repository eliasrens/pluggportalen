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
// Se docs/ADMIN.md. Kräver service-account (live) eller emulator-env.
// ============================================================================

import { auth, db, parseArgs, isEmulator } from "./_shared.mjs";

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
  console.log("\nKlart.");
}

main().catch((e) => {
  console.error("✗ Fel:", e.message);
  process.exit(1);
});
