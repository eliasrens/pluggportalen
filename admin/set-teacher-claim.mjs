// ============================================================================
// Skapa/uppdatera ett LÄRARKONTO och sätt custom claim teacher:true.
// ----------------------------------------------------------------------------
// Kör EN gång (lokalt, Admin SDK). Efter detta kan läraren logga in i lärarläget
// (src/teacher-shared.js → signInTeacher) och firestore.rules ger isTeacher()
// full behörighet.
//
//   node admin/set-teacher-claim.mjs --email=larare@skolan.se --password=<minst6>
//   node admin/set-teacher-claim.mjs --email=larare@skolan.se           (bara sätt claim på befintligt konto)
//
// Flaggor:
//   --email=<e-post>       lärarens inloggnings-e-post (valfri riktig adress)
//   --password=<lösen>     sätts om kontot skapas/ska uppdateras (minst 6 tecken)
//   --off                  TA BORT teacher-claim (avaktivera lärarbehörighet)
//
// Se docs/ADMIN.md. Kräver service-account (eller emulator-env).
// ============================================================================

import { auth, parseArgs, isEmulator } from "./_shared.mjs";

const { flags, opts } = parseArgs();
const email = (opts.email || "").trim();
const password = opts.password;
const removeClaim = flags.has("off");

if (!email) {
  console.error("✗ Ange --email=<lärarens e-post>. Se docs/ADMIN.md.");
  process.exit(1);
}

async function getOrCreateUser() {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
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
    const u = await auth.createUser({ email, password, emailVerified: true });
    console.log(`✓ Skapade lärarkonto ${email} (uid ${u.uid}).`);
    return u;
  }
}

async function main() {
  console.log(
    `Mål: ${isEmulator ? "EMULATOR" : "LIVE"} – lärarkonto ${email}\n`
  );
  const user = await getOrCreateUser();

  // Uppdatera lösenord om angivet på ett befintligt konto.
  if (password && String(password).length >= 6) {
    await auth.updateUser(user.uid, { password });
    console.log("✓ Lösenord uppdaterat.");
  }

  const existing = user.customClaims || {};
  if (removeClaim) {
    const { teacher, ...rest } = existing;
    await auth.setCustomUserClaims(user.uid, rest);
    console.log(`✓ Tog bort teacher-claim från ${email}.`);
  } else {
    await auth.setCustomUserClaims(user.uid, { ...existing, teacher: true });
    console.log(`✓ Satte custom claim teacher:true på ${email}.`);
  }

  console.log(
    "\nKlart. Läraren måste logga UT och IN igen för att den nya claimen ska " +
      "hamna i ID-token (eller vänta ~1 h på token-förnyelse)."
  );
}

main().catch((e) => {
  console.error("✗ Fel:", e.message);
  process.exit(1);
});
