// ============================================================================
// Delad init för Pluggportalens LOKALA Admin-skript (kör på utvecklarens dator).
// ----------------------------------------------------------------------------
// Admin SDK kringgår firestore.rules legitimt (det är server-nyckeln, inte
// webb-nyckeln). Autentiseras med ett SERVICE-ACCOUNT, INTE med den publika
// webb-configen. Skaffa nyckeln:
//   Firebase Console → Projektinställningar → Tjänstekonton →
//   "Generera ny privat nyckel" → spara som admin/serviceAccountKey.json
// (Den filen är hemlig och .gitignore:ad – checka ALDRIG in den.)
//
// Peka ut nyckeln på ETT av dessa sätt:
//   * lägg den i admin/serviceAccountKey.json (default), eller
//   * sätt GOOGLE_APPLICATION_CREDENTIALS=/väg/till/nyckel.json
//
// Mot emulatorn i stället för live: sätt
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
// (då behövs ingen service-account – projektet räcker.)
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";

export const PROJECT_ID = "pluggportalen-so-2026";
// Syntetisk e-postdomän – MÅSTE matcha ELEV_EMAIL_DOMAIN i src/auth.js.
export const ELEV_EMAIL_DOMAIN = "elev.pluggportalen.local";
// Syntetisk e-postdomän för LÄRARKONTON – MÅSTE matcha TEACHER_EMAIL_DOMAIN i
// src/auth.js. Skild från elevernas domän (blanda INTE ihop).
export const TEACHER_EMAIL_DOMAIN = "larare.pluggportalen.local";

/** username -> syntetisk e-post (samma mappning som src/auth.js usernameToEmail). */
export function usernameToEmail(username) {
  return `${String(username || "").trim().toLowerCase()}@${ELEV_EMAIL_DOMAIN}`;
}

/** lärar-username -> syntetisk e-post (samma mappning som src/auth.js teacherUsernameToEmail). */
export function teacherUsernameToEmail(name) {
  return `${String(name || "").trim().toLowerCase()}@${TEACHER_EMAIL_DOMAIN}`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const usingEmulator =
  !!process.env.FIRESTORE_EMULATOR_HOST ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

let app;
if (!admin.apps.length) {
  if (usingEmulator) {
    // Emulatorn kräver ingen riktig credential – bara ett projekt-id.
    app = admin.initializeApp({ projectId: PROJECT_ID });
  } else {
    const keyPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      join(__dirname, "serviceAccountKey.json");
    if (!existsSync(keyPath)) {
      console.error(
        "\n✗ Hittar ingen service-account.\n" +
          `  Förväntade mig ${keyPath}\n` +
          "  Skaffa den i Firebase Console → Projektinställningar → Tjänstekonton,\n" +
          "  spara som admin/serviceAccountKey.json (eller sätt GOOGLE_APPLICATION_CREDENTIALS).\n" +
          "  Se docs/ADMIN.md.\n"
      );
      process.exit(1);
    }
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || PROJECT_ID,
    });
  }
} else {
  app = admin.app();
}

export const auth = admin.auth(app);
export const db = admin.firestore(app);
export const isEmulator = usingEmulator;

/** Litet hjälp-argv: --flag och --key=value. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v === undefined) flags.add(k);
      else opts[k] = v;
    }
  }
  return { flags, opts };
}

export { admin };
