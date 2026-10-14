// ============================================================================
// Delad init för Pluggportens LOKALA Admin-skript (kör på utvecklarens dator).
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
//   * sätt GOOGLE_APPLICATION_CREDENTIALS=/väg/till/nyckel.json, eller
//   * en authorized_user-JSON (ADC: gcloud auth application-default login) –
//     via GOOGLE_APPLICATION_CREDENTIALS eller gcloud:s standardplats.
// Väljaren bor i admin/credential.mjs. Projekt-id: GOOGLE_CLOUD_PROJECT /
// GCLOUD_PROJECT / FIREBASE_PROJECT, annars filens, annars PROJECT_ID nedan.
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
import { pickCredential } from "./credential.mjs";

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
    // Service-account ELLER authorized_user (ADC-inloggning), se admin/credential.mjs.
    const pick = pickCredential({
      defaultKeyPath: join(__dirname, "serviceAccountKey.json"),
      fallbackProjectId: PROJECT_ID,
      exists: existsSync,
      readText: (p) => readFileSync(p, "utf8"),
    });
    if (pick.kind === "none" || pick.kind === "error") {
      console.error(
        "\n✗ Hittar ingen användbar inloggning för Admin SDK.\n" +
          (pick.message ? `  ${pick.message}\n` : `  Förväntade mig ${pick.path}\n`) +
          "  Antingen: Firebase Console → Projektinställningar → Tjänstekonton → spara\n" +
          "  nyckeln som admin/serviceAccountKey.json (eller sätt GOOGLE_APPLICATION_CREDENTIALS),\n" +
          "  eller: gcloud auth application-default login (authorized_user/ADC).\n" +
          "  Se docs/ADMIN.md.\n"
      );
      process.exit(1);
    }
    // authorized_user: Firestore i Admin SDK godtar inte refreshToken()-
    // credentials, bara cert eller ADC – så filen lämnas till ADC (som
    // google-auth-library läser som authorized_user med refresh-token).
    if (pick.kind === "authorizedUser") process.env.GOOGLE_APPLICATION_CREDENTIALS = pick.path;
    const credential =
      pick.kind === "cert" ? admin.credential.cert(pick.json) : admin.credential.applicationDefault();
    console.error(`(Admin SDK: ${pick.kind} ur ${pick.path}, projekt ${pick.projectId})`);
    app = admin.initializeApp({ credential, projectId: pick.projectId });
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
      const body = a.slice(2);
      const eq = body.indexOf("=");
      if (eq === -1) flags.add(body);
      else opts[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return { flags, opts };
}

export { admin };
