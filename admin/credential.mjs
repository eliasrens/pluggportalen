// ============================================================================
// Vilken credential ska admin-skripten använda? (admin/credential.mjs, #677)
// ----------------------------------------------------------------------------
// Ren väljare UTAN firebase-admin och utan nätverk (testas i
// test/admin-credential.test.mjs); admin/_shared.mjs gör om svaret till en
// riktig credential. Ordning:
//   1. GOOGLE_APPLICATION_CREDENTIALS, annars admin/serviceAccountKey.json:
//        type "service_account"  → { kind: "cert" }          (som förut)
//        type "authorized_user"  → { kind: "authorizedUser" } (ADC-inloggning,
//                                   gcloud auth application-default login;
//                                   _shared.mjs lämnar den till applicationDefault())
//        annan typ / trasig JSON → { kind: "error" }
//   2. Ingen sådan fil, men ADC-filen finns (gcloud) → { kind: "applicationDefault" }
//   3. Inget alls → { kind: "none" } (skripten skriver ett tydligt fel)
// projectId: env (GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT / FIREBASE_PROJECT) →
// filens project_id / quota_project_id → fallback (webbappens projekt).
// ============================================================================

import { join } from "node:path";
import { homedir } from "node:os";

/** gcloud:s ADC-fil (Application Default Credentials) på den här datorn. */
export function adcPath(env = process.env) {
  if (env.CLOUDSDK_CONFIG) return join(env.CLOUDSDK_CONFIG, "application_default_credentials.json");
  if (process.platform === "win32" && env.APPDATA) return join(env.APPDATA, "gcloud", "application_default_credentials.json");
  return join(homedir(), ".config", "gcloud", "application_default_credentials.json");
}

/**
 * @param {{ env?: object, defaultKeyPath: string, fallbackProjectId: string,
 *   exists: (p:string)=>boolean, readText: (p:string)=>string, adc?: string }} o
 * @returns {{ kind: "cert"|"authorizedUser"|"applicationDefault"|"none"|"error",
 *   path?: string, json?: object, projectId?: string, message?: string }}
 */
export function pickCredential({ env = process.env, defaultKeyPath, fallbackProjectId, exists, readText, adc = adcPath(env) }) {
  const envProject = env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || env.FIREBASE_PROJECT || "";
  const path = env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyPath;
  if (exists(path)) {
    let json;
    try {
      json = JSON.parse(readText(path));
    } catch {
      return { kind: "error", path, message: `Kunde inte läsa ${path} som JSON.` };
    }
    const projectId = envProject || json.project_id || json.quota_project_id || fallbackProjectId;
    if (json.type === "service_account") return { kind: "cert", path, json, projectId };
    if (json.type === "authorized_user") return { kind: "authorizedUser", path, json, projectId };
    return { kind: "error", path, message: `${path} har typen "${json.type}" – väntade service_account eller authorized_user.` };
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { kind: "error", path, message: `GOOGLE_APPLICATION_CREDENTIALS pekar på ${path}, som inte finns.` };
  }
  if (adc && exists(adc)) return { kind: "applicationDefault", path: adc, projectId: envProject || fallbackProjectId };
  return { kind: "none", path };
}
