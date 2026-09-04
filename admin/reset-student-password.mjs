// ============================================================================
// Återställ en elevs lösenord (lokalt, Admin SDK).
// ----------------------------------------------------------------------------
// Klienten kan INTE byta en annan användares lösenord (webb-SDK:t saknar
// behörighet), så lärarens "glömt lösenord"-väg går via detta lokala skript.
// Refereras från src/data-content.js (upsertStudent-kommentaren).
//
//   node admin/reset-student-password.mjs --id=elev1 --password=<minst6>
//   node admin/reset-student-password.mjs --username=elev1 --password=<minst6>
//
// Se docs/ADMIN.md. Kräver service-account (live) eller emulator-env.
// ============================================================================

import { auth, db, usernameToEmail, parseArgs, isEmulator } from "./_shared.mjs";

const { opts } = parseArgs();
const password = opts.password;
let id = opts.id;
const username = opts.username;

if (!password || String(password).length < 6) {
  console.error("✗ --password=<minst 6 tecken> krävs (Firebase-krav).");
  process.exit(1);
}
if (!id && !username) {
  console.error("✗ Ange --id=<elevens doc-id> eller --username=<användarnamn>.");
  process.exit(1);
}

async function resolveUid() {
  if (id) return id;
  // Slå upp uid via students-dokumentet (doc-id == uid).
  const snap = await db
    .collection("students")
    .where("username", "==", String(username).trim().toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) {
    // Fallback: prova via e-post i Auth.
    const u = await auth.getUserByEmail(usernameToEmail(username)).catch(() => null);
    if (u) return u.uid;
    console.error(`✗ Hittar ingen elev med användarnamn "${username}".`);
    process.exit(1);
  }
  return snap.docs[0].id;
}

async function main() {
  const uid = await resolveUid();
  console.log(`Mål: ${isEmulator ? "EMULATOR" : "LIVE"} – återställer lösenord för uid ${uid}`);
  await auth.updateUser(uid, { password });
  console.log(`✓ Nytt lösenord satt för ${uid}. Meddela eleven.`);
}

main().catch((e) => {
  console.error("✗ Fel:", e.message);
  process.exit(1);
});
