// ============================================================================
// Migrering (#677): alla befintliga lärarkonton blir ADMIN.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_LARARKONTON.md §6.1. Varje Auth-användare med
// custom claim teacher:true som INTE redan är ett årskurskonto (role:"arskurs")
// får admin:true och ett teacherAccounts/{uid}-dokument (role "admin").
// Befintliga dokument behåller createdAt/createdBy. Skriptet skriver ut en
// lista över alla lärarkonton och vad som händer/hände med dem.
//
//   node admin/migrate-teacher-admins.mjs            TORRKÖRNING (standard, skriver inget)
//   node admin/migrate-teacher-admins.mjs --apply    skriv på riktigt + verifiera
//
// Kör mot emulatorn genom att sätta FIRESTORE_EMULATOR_HOST och
// FIREBASE_AUTH_EMULATOR_HOST (se admin/_shared.mjs). Idempotent – går att
// köra flera gånger. Driftordningen står i docs/ADMIN.md.
// ============================================================================

import { auth, db, admin, parseArgs, isEmulator } from "./_shared.mjs";
import { COLLECTION, claimsFor, usernameFromEmail } from "../functions/teacher-accounts-core.js";

const { flags } = parseArgs();
const apply = flags.has("apply");

async function allUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

/** Vad som ska hända med ett lärarkonto. */
function plan(user, snap) {
  const c = user.customClaims || {};
  if (c.role === "arskurs") return { action: "hoppas över (årskurskonto)" };
  const doc = snap.exists ? snap.data() : null;
  const claimOk = c.admin === true;
  const docOk = doc?.role === "admin";
  if (claimOk && docOk) return { action: "redan admin" };
  return { action: "blir admin", claim: !claimOk, doc: !docOk };
}

function line(user, p, doc) {
  const name = doc?.displayName || user.displayName || usernameFromEmail(user.email);
  return `  ${p.action.padEnd(28)} ${usernameFromEmail(user.email).padEnd(22)} ${String(name).padEnd(22)} ${user.uid}${user.disabled ? "  (avstängt i Auth)" : ""}`;
}

async function main() {
  console.log(`Mål: ${isEmulator ? "EMULATOR" : "LIVE"} – ${apply ? "SKRIVER (--apply)" : "TORRKÖRNING (lägg till --apply för att skriva)"}\n`);
  const teachers = (await allUsers()).filter((u) => u.customClaims?.teacher === true);
  if (!teachers.length) {
    console.log("Inga konton med teacher:true hittades.");
    return;
  }
  const snaps = await db.getAll(...teachers.map((u) => db.collection(COLLECTION).doc(u.uid)));
  const rows = teachers.map((u, i) => ({ user: u, snap: snaps[i], p: plan(u, snaps[i]) }));

  console.log(`Lärarkonton (${rows.length}):`);
  rows.forEach((r) => console.log(line(r.user, r.p, r.snap.data())));
  const todo = rows.filter((r) => r.p.action === "blir admin");
  console.log(`\n${todo.length} konto(n) blir admin.`);
  if (!apply) {
    if (todo.length) console.log("Torrkörning – inget ändrat. Kör igen med --apply.");
    return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const { user, snap, p } of todo) {
    if (p.claim) await auth.setCustomUserClaims(user.uid, claimsFor("admin", user.customClaims));
    if (p.doc) {
      const old = snap.exists ? snap.data() : {};
      await snap.ref.set({
        username: old.username || usernameFromEmail(user.email),
        displayName: old.displayName || user.displayName || usernameFromEmail(user.email),
        role: "admin",
        classIds: [],
        active: !user.disabled,
        createdAt: old.createdAt || now,
        createdBy: old.createdBy || "migrering",
        updatedAt: now,
      });
    }
  }

  // Verifiera ur Auth + Firestore (steg 3 i driftordningen, docs/ADMIN.md).
  console.log("\nVerifiering efter migreringen:");
  let fel = 0;
  for (const { user } of todo) {
    const [fresh, snap] = await Promise.all([auth.getUser(user.uid), db.collection(COLLECTION).doc(user.uid).get()]);
    const ok = fresh.customClaims?.admin === true && fresh.customClaims?.teacher === true && snap.get("role") === "admin";
    if (!ok) fel++;
    console.log(`  ${ok ? "✓ admin:true" : "✗ SAKNAR admin"}  ${usernameFromEmail(fresh.email).padEnd(22)} ${fresh.uid}`);
  }
  if (fel) {
    console.error(`\n✗ ${fel} konto(n) blev inte admin – deploya INTE reglerna. Kör skriptet igen.`);
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ Klart. Lärarna får admin-claimen vid nästa inloggning (eller inom en timme när token förnyas).");
}

main().catch((e) => {
  console.error("✗ Fel:", e.message);
  process.exit(1);
});
