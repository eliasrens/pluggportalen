// ============================================================================
// Skapa/uppdatera ett LÄRARKONTO: ADMIN eller ÅRSKURSKONTO (#677).
// ----------------------------------------------------------------------------
// Reserv om adminsidan "Lärarkonton" inte går att nå (lokalt, Admin SDK).
// Sätter custom claims och skriver teacherAccounts/{uid} (samma format som
// Cloud Functionen adminCreateTeacher, functions/teacher-accounts-core.js):
//   admin    claims { teacher: true, admin: true }
//   arskurs  claims { teacher: true, role: "arskurs" } + classIds
//
//   node admin/set-teacher-claim.mjs --username=teacher26 --password=<minst6>          (admin)
//   node admin/set-teacher-claim.mjs --username=teacher26                              (gör befintligt konto till admin)
//   node admin/set-teacher-claim.mjs --username=arskurs4 --role=arskurs \
//        --name="Årskurs 4" --classes=4a,4b --password=<minst6>                       (årskurskonto)
//   node admin/set-teacher-claim.mjs --username=arskurs4 --off                         (inte längre lärare)
//
// Flaggor:
//   --username=<namn>      lärarens användarnamn (t.ex. teacher26); e-posten
//                          byggs internt som <namn>@larare.pluggportalen.local.
//   --email=<e-post>       AVANCERAT: valfri riktig adress i stället för username.
//   --password=<lösen>     sätts om kontot skapas/ska uppdateras (minst 6 tecken)
//   --role=admin|arskurs   standard admin
//   --name=<visningsnamn>  t.ex. "Årskurs 4" (standard: användarnamnet)
//   --classes=<id,id>      klass-id:n för ett årskurskonto (ersätter listan)
//   --off                  ta bort lärarrollen (claims + teacherAccounts-dokumentet)
//
// Se docs/ADMIN.md. Kräver service-account (eller emulator-env).
// ============================================================================

import { auth, db, admin, parseArgs, isEmulator, teacherUsernameToEmail } from "./_shared.mjs";
import { COLLECTION, ROLES, claimsFor, usernameFromEmail } from "../functions/teacher-accounts-core.js";

const { flags, opts } = parseArgs();
const email = (opts.username
  ? teacherUsernameToEmail(opts.username)
  : opts.email || ""
).trim();
const password = opts.password;
const removeClaim = flags.has("off");
const role = opts.role || "admin";
const classIds = opts.classes != null
  ? [...new Set(opts.classes.split(",").map((s) => s.trim()).filter(Boolean))]
  : null;

if (!email) {
  console.error(
    "✗ Ange --username=<lärarens användarnamn> (eller --email=<e-post>). Se docs/ADMIN.md."
  );
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`✗ --role ska vara ${ROLES.join(" eller ")}.`);
  process.exit(1);
}

async function getOrCreateUser() {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    if (removeClaim) {
      console.error(`✗ Kontot ${email} finns inte.`);
      process.exit(1);
    }
    if (!password) {
      console.error(
        `✗ Kontot ${email} finns inte och inget --password angavs för att skapa det.`
      );
      process.exit(1);
    }
    if (String(password).length < 6) {
      console.error("✗ Lösenordet måste vara minst 6 tecken (Firebase-krav).");
      process.exit(1);
    }
    const u = await auth.createUser({ email, password, emailVerified: true, displayName: opts.name || undefined });
    console.log(`✓ Skapade lärarkonto ${email} (uid ${u.uid}).`);
    return u;
  }
}

async function main() {
  console.log(
    `Mål: ${isEmulator ? "EMULATOR" : "LIVE"} – lärarkonto ${email}\n`
  );
  const user = await getOrCreateUser();
  const ref = db.collection(COLLECTION).doc(user.uid);

  if (removeClaim) {
    await auth.setCustomUserClaims(user.uid, claimsFor(null, user.customClaims));
    await auth.revokeRefreshTokens(user.uid);
    await ref.delete();
    console.log(`✓ ${email} är inte längre lärare (claims och teacherAccounts borttagna).`);
    return;
  }

  // Uppdatera lösenord om angivet på ett befintligt konto.
  if (password && String(password).length >= 6) {
    await auth.updateUser(user.uid, { password });
    console.log("✓ Lösenord uppdaterat.");
  }
  if (opts.name) await auth.updateUser(user.uid, { displayName: opts.name });

  if (classIds?.length) {
    const snaps = await db.getAll(...classIds.map((id) => db.collection("classes").doc(id)));
    const missing = snaps.filter((s) => !s.exists).map((s) => s.id);
    if (missing.length) console.warn(`⚠ Klasserna finns inte (sparas ändå): ${missing.join(", ")}`);
  }

  await auth.setCustomUserClaims(user.uid, claimsFor(role, user.customClaims));
  if (role !== "admin") await auth.revokeRefreshTokens(user.uid);
  const old = (await ref.get()).data() || {};
  const now = admin.firestore.FieldValue.serverTimestamp();
  const username = usernameFromEmail(email);
  await ref.set({
    username,
    displayName: opts.name || old.displayName || user.displayName || username,
    role,
    classIds: role === "arskurs" ? classIds ?? old.classIds ?? [] : [],
    active: !user.disabled,
    createdAt: old.createdAt || now,
    createdBy: old.createdBy || "set-teacher-claim",
    updatedAt: now,
  });
  const fresh = (await ref.get()).data();
  console.log(
    `✓ ${email} är ${role === "admin" ? "ADMIN (teacher + admin)" : `ÅRSKURSKONTO (teacher + role:arskurs), klasser: ${fresh.classIds.join(", ") || "inga"}`}.`
  );

  console.log(
    "\nKlart. Läraren måste logga UT och IN igen för att de nya claimsen ska " +
      "hamna i ID-token (eller vänta ~1 h på token-förnyelse)."
  );
}

main().catch((e) => {
  console.error("✗ Fel:", e.message);
  process.exit(1);
});
