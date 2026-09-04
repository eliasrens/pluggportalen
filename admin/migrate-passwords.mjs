// ============================================================================
// ENGÅNGS-migrering: klartextlösenord i students/ → Firebase Auth-konton.
// ----------------------------------------------------------------------------
// För varje students/{id} med ett klartext-`password`:
//   1) skapa (eller uppdatera) ett Firebase Auth-konto med
//        uid  = doc-id (t.ex. "elev1")   → kopplingen till studentData behålls
//        email = usernameToEmail(username)
//        password = det BEFINTLIGA klartextlösenordet
//   2) ta bort `password`-fältet ur students-dokumentet.
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --commit.
//
//   node admin/migrate-passwords.mjs               # torrkörning (visar plan)
//   node admin/migrate-passwords.mjs --commit      # skapar konton + tar bort password
//
// Kör INTE mot live utan människans OK. Kör helst mot emulatorn först:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node admin/migrate-passwords.mjs --commit
//
// ---------------------------------------------------------------------------
// KORTA LÖSENORD (< 6 tecken): Firebase Auth kräver minst 6 tecken i createUser.
// Testeleven elev1 har lösenordet "123" (3 tecken) i live → kan INTE skapas med
// den vanliga vägen. Välj strategi med --short=<strategi>:
//
//   --short=stop      (DEFAULT) avbryt och rapportera vilka elever som berörs.
//   --short=preserve  behåll det EXAKTA korta lösenordet via importUsers +
//                     SCRYPT. Kräver projektets hash-parametrar i
//                     admin/firebase-hash-config.json (se docs/ADMIN.md).
//                     Verifiera EN inloggning efteråt – hash-vägen är känslig
//                     för fel parametrar.
//   --short=set:<pw>  sätt ett nytt gemensamt lösenord (minst 6 tecken) på ALLA
//                     elever med kort lösenord, och skriv ut listan så läraren
//                     kan meddela dem. Ex: --short=set:pluggis
// ---------------------------------------------------------------------------
// Se docs/ADMIN.md. Kräver service-account (live) eller emulator-env.
// ============================================================================

import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { auth, db, admin, usernameToEmail, parseArgs, isEmulator } from "./_shared.mjs";

const { flags, opts } = parseArgs();
const COMMIT = flags.has("commit");
const shortArg = opts.short || "stop"; // stop | preserve | set:<pw>
const __dirname = dirname(fileURLToPath(import.meta.url));

let shortStrategy = shortArg;
let shortSetPw = null;
if (shortArg.startsWith("set:")) {
  shortStrategy = "set";
  shortSetPw = shortArg.slice(4);
  if (!shortSetPw || shortSetPw.length < 6) {
    console.error("✗ --short=set:<pw> kräver minst 6 tecken.");
    process.exit(1);
  }
}

// --- Firebase SCRYPT (för --short=preserve) --------------------------------
// Beräknar det hash som Firebase lagrar, så att det korta klartextlösenordet
// fortsätter fungera vid inloggning. Algoritmen: scrypt(password, salt+sep) →
// AES-256-CTR(signerKey). Parametrarna kommer från Firebase Console →
// Authentication → (⋮) → "Password hash parameters".
function loadHashConfig() {
  const p = join(__dirname, "firebase-hash-config.json");
  if (!existsSync(p)) {
    console.error(
      "✗ --short=preserve kräver admin/firebase-hash-config.json med\n" +
        '  { "signerKey": "...", "saltSeparator": "...", "rounds": N, "memCost": N }\n' +
        "  (base64-värdena från Firebase Console → Authentication → Password hash parameters).\n" +
        "  Se docs/ADMIN.md."
    );
    process.exit(1);
  }
  const c = JSON.parse(readFileSync(p, "utf8"));
  for (const k of ["signerKey", "saltSeparator", "rounds", "memCost"]) {
    if (c[k] === undefined) {
      console.error(`✗ firebase-hash-config.json saknar "${k}".`);
      process.exit(1);
    }
  }
  return c;
}
function firebaseScrypt(password, salt, cfg) {
  const saltSep = Buffer.from(cfg.saltSeparator, "base64");
  const signerKey = Buffer.from(cfg.signerKey, "base64");
  const N = 2 ** Number(cfg.memCost);
  const r = Number(cfg.rounds);
  const derived = crypto.scryptSync(
    Buffer.from(password),
    Buffer.concat([salt, saltSep]),
    64,
    { N, r, p: 1, maxmem: 128 * N * r * 2 + 32 * 1024 * 1024 }
  );
  const cipher = crypto.createCipheriv(
    "aes-256-ctr",
    derived.subarray(0, 32),
    Buffer.alloc(16, 0)
  );
  return Buffer.concat([cipher.update(signerKey), cipher.final()]);
}

// --- Läs alla elever -------------------------------------------------------
async function loadStudents() {
  const snap = await db.collection("students").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function authExists(uid) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (e) {
    if (e.code === "auth/user-not-found") return false;
    throw e;
  }
}

// Skapa/uppdatera ett Auth-konto med givet lösenord (>= 6). Idempotent.
async function upsertAuth(uid, email, password) {
  if (await authExists(uid)) {
    await auth.updateUser(uid, { email, password });
    return "uppdaterat";
  }
  await auth.createUser({ uid, email, password });
  return "skapat";
}

// Importera ett konto med kort (< 6) lösenord via SCRYPT-hash.
async function importShortAuth(uid, email, password, cfg) {
  const salt = crypto.randomBytes(16);
  const passwordHash = firebaseScrypt(password, salt, cfg);
  const res = await auth.importUsers(
    [{ uid, email, passwordHash, passwordSalt: salt }],
    {
      hash: {
        algorithm: "SCRYPT",
        key: Buffer.from(cfg.signerKey, "base64"),
        saltSeparator: Buffer.from(cfg.saltSeparator, "base64"),
        rounds: Number(cfg.rounds),
        memoryCost: Number(cfg.memCost),
      },
    }
  );
  if (res.failureCount > 0) {
    throw new Error(res.errors.map((e) => e.error).join("; "));
  }
  return "importerat";
}

async function stripPassword(id) {
  await db
    .collection("students")
    .doc(id)
    .update({ password: admin.firestore.FieldValue.delete() });
}

async function main() {
  console.log(
    `\n=== Lösenordsmigrering – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`
  );
  console.log(COMMIT ? "LÄGE: SKARP (--commit)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");

  const students = await loadStudents();
  const withPw = students.filter(
    (s) => typeof s.password === "string" && s.password.length > 0
  );
  const already = students.filter(
    (s) => !(typeof s.password === "string" && s.password.length > 0)
  );
  const short = withPw.filter((s) => s.password.length < 6);
  const longOk = withPw.filter((s) => s.password.length >= 6);

  console.log(`Elever totalt:            ${students.length}`);
  console.log(`Redan migrerade (utan password-fält): ${already.length}`);
  console.log(`Att migrera (>= 6 tecken):            ${longOk.length}`);
  console.log(`Att migrera (< 6 tecken):             ${short.length}`);
  for (const s of short)
    console.log(`   ⚠ ${s.id}: användarnamn "${s.username}", lösenord ${s.password.length} tecken`);

  // Hantera kort-lösenord-strategin.
  if (short.length && shortStrategy === "stop") {
    console.log(
      "\n✗ AVBRYTER: elever med lösenord < 6 tecken finns (se ovan).\n" +
        "  Firebase Auth kräver minst 6 tecken via createUser.\n" +
        "  Välj en strategi och kör om:\n" +
        "    --short=preserve   behåll exakt lösenord (SCRYPT-import, kräver hash-config)\n" +
        "    --short=set:<pw>   sätt nytt gemensamt lösenord (>= 6) på dessa elever\n"
    );
    process.exit(2);
  }

  let hashCfg = null;
  if (short.length && shortStrategy === "preserve") hashCfg = loadHashConfig();

  if (!COMMIT) {
    console.log("\n--- Plan (torrkörning) ---");
    for (const s of longOk)
      console.log(`  [>=6]     ${s.id}  ${usernameToEmail(s.username)}  (behåller lösenord)`);
    for (const s of short) {
      if (shortStrategy === "preserve")
        console.log(`  [preserve] ${s.id}  ${usernameToEmail(s.username)}  (SCRYPT-import, behåller "${s.password}")`);
      else
        console.log(`  [set]     ${s.id}  ${usernameToEmail(s.username)}  (nytt lösenord "${shortSetPw}")`);
    }
    console.log(
      `\nSedan tas password-fältet bort ur ${withPw.length} students-dokument.`
    );
    console.log("\nTorrkörning klar. Kör med --commit för att genomföra.");
    return;
  }

  // --- SKARP körning -------------------------------------------------------
  let ok = 0;
  const failed = [];

  for (const s of longOk) {
    try {
      const how = await upsertAuth(s.id, usernameToEmail(s.username), s.password);
      await stripPassword(s.id);
      console.log(`  ✓ ${s.id}: Auth ${how}, password-fält borttaget`);
      ok++;
    } catch (e) {
      failed.push([s.id, e.message]);
      console.log(`  ✗ ${s.id}: ${e.message}`);
    }
  }

  for (const s of short) {
    try {
      let how;
      if (shortStrategy === "preserve") {
        if (await authExists(s.id)) how = "fanns redan (hoppar över import)";
        else how = await importShortAuth(s.id, usernameToEmail(s.username), s.password, hashCfg);
      } else {
        how = await upsertAuth(s.id, usernameToEmail(s.username), shortSetPw);
      }
      await stripPassword(s.id);
      console.log(`  ✓ ${s.id}: Auth ${how}, password-fält borttaget`);
      ok++;
    } catch (e) {
      failed.push([s.id, e.message]);
      console.log(`  ✗ ${s.id}: ${e.message}`);
    }
  }

  // Städa bort ev. kvarblivna password-fält (redan migrerade, för säkerhets skull).
  for (const s of already) {
    if ("password" in s) {
      await stripPassword(s.id).catch(() => {});
    }
  }

  console.log(`\nKlart: ${ok} lyckades, ${failed.length} misslyckades.`);
  if (failed.length) {
    console.log("Misslyckade:");
    failed.forEach(([id, msg]) => console.log(`   ${id}: ${msg}`));
    process.exit(1);
  }
  if (shortStrategy === "preserve" && short.length) {
    console.log(
      "\n⚠ VERIFIERA: logga in som en av de kort-lösenords-eleverna nu och " +
        "bekräfta att lösenordet funkar. Om inte: fel hash-parametrar."
    );
  }
  console.log("\nMigrering klar. 🎉");
}

main().catch((e) => {
  console.error("✗ Oväntat fel:", e.message);
  process.exit(1);
});
