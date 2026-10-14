// ============================================================================
// Admin-skriptens credential-väljare (admin/credential.mjs + admin/_shared.mjs, #677).
// ----------------------------------------------------------------------------
// Utan nätverk: väljaren får påhittade filer, och _shared.mjs körs i en egen
// process med påhittade nycklar (initializeApp hämtar ingen token förrän
// något anrop görs). Tre fall: service_account → cert, authorized_user →
// authorizedUser (ADC), ingen fil men ADC → applicationDefault; inget alls → tydligt fel.
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickCredential } from "../admin/credential.mjs";

const SA = { type: "service_account", project_id: "sa-projekt", client_email: "x@sa-projekt.iam.gserviceaccount.com", private_key: "k" };
const AU = { type: "authorized_user", client_id: "id", client_secret: "hemlis", refresh_token: "rt", quota_project_id: "kvot-projekt" };

/** Väljaren mot en påhittad filkarta. */
const pick = (files, env = {}) =>
  pickCredential({
    env,
    defaultKeyPath: "/repo/admin/serviceAccountKey.json",
    fallbackProjectId: "pluggportalen-so-2026",
    exists: (p) => p in files,
    readText: (p) => files[p],
    adc: "/home/x/.config/gcloud/application_default_credentials.json",
  });

describe("pickCredential (ren, utan nätverk)", () => {
  it("service_account i admin/serviceAccountKey.json → cert, projekt ur filen", () => {
    const r = pick({ "/repo/admin/serviceAccountKey.json": JSON.stringify(SA) });
    assert.deepEqual([r.kind, r.projectId, r.json.client_email], ["cert", "sa-projekt", SA.client_email]);
  });
  it("authorized_user via GOOGLE_APPLICATION_CREDENTIALS → authorizedUser", () => {
    const r = pick({ "/k/adc.json": JSON.stringify(AU) }, { GOOGLE_APPLICATION_CREDENTIALS: "/k/adc.json" });
    assert.deepEqual([r.kind, r.path, r.projectId], ["authorizedUser", "/k/adc.json", "kvot-projekt"]);
  });
  it("projekt-id ur env går före filen", () => {
    const r = pick({ "/k/adc.json": JSON.stringify(AU) }, { GOOGLE_APPLICATION_CREDENTIALS: "/k/adc.json", GOOGLE_CLOUD_PROJECT: "klassrum-260913-1c02" });
    assert.equal(r.projectId, "klassrum-260913-1c02");
    const utanKvot = pick({ "/k/adc.json": JSON.stringify({ ...AU, quota_project_id: undefined }) }, { GOOGLE_APPLICATION_CREDENTIALS: "/k/adc.json" });
    assert.equal(utanKvot.projectId, "pluggportalen-so-2026", "annars webbappens projekt");
  });
  it("ingen nyckelfil men ADC finns → applicationDefault", () => {
    const r = pick({ "/home/x/.config/gcloud/application_default_credentials.json": JSON.stringify(AU) }, { FIREBASE_PROJECT: "p1" });
    assert.deepEqual([r.kind, r.projectId], ["applicationDefault", "p1"]);
  });
  it("inget alls → none; fel typ, trasig JSON eller saknad env-fil → error", () => {
    assert.equal(pick({}).kind, "none");
    assert.match(pick({ "/repo/admin/serviceAccountKey.json": JSON.stringify({ type: "external_account" }) }).message, /external_account/);
    assert.match(pick({ "/repo/admin/serviceAccountKey.json": "{inte json" }).message, /JSON/);
    const r = pick({ "/home/x/.config/gcloud/application_default_credentials.json": "{}" }, { GOOGLE_APPLICATION_CREDENTIALS: "/finns/inte.json" });
    assert.equal(r.kind, "error", "en felstavad GOOGLE_APPLICATION_CREDENTIALS faller inte tyst tillbaka på ADC");
  });
});

describe("admin/_shared.mjs väljer rätt credential (egen process, inget nätverk)", () => {
  const SHARED = fileURLToPath(new URL("../admin/_shared.mjs", import.meta.url));
  let dir;
  before(() => (dir = mkdtempSync(join(tmpdir(), "pp-cred-"))));
  after(() => rmSync(dir, { recursive: true, force: true }));

  const run = async (env) => {
    const code = `const m = await import(${JSON.stringify(SHARED)}); console.log(m.admin.app().options.projectId);`;
    const clean = { PATH: process.env.PATH, HOME: dir, CLOUDSDK_CONFIG: join(dir, "gcloud") };
    try {
      const { stdout, stderr } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", code], { env: { ...clean, ...env } });
      return { ok: true, out: stdout.trim(), err: stderr };
    } catch (e) {
      return { ok: false, out: String(e.stdout || ""), err: String(e.stderr || "") };
    }
  };

  it("service_account → cert", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const f = join(dir, "sa.json");
    writeFileSync(f, JSON.stringify({ ...SA, private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }));
    const r = await run({ GOOGLE_APPLICATION_CREDENTIALS: f });
    assert.ok(r.ok, r.err);
    assert.match(r.err, /Admin SDK: cert/);
    assert.equal(r.out, "sa-projekt");
  });
  it("authorized_user → ADC med filen och explicit projekt (Firestore godtar den)", async () => {
    const f = join(dir, "au.json");
    writeFileSync(f, JSON.stringify(AU));
    const r = await run({ GOOGLE_APPLICATION_CREDENTIALS: f, GOOGLE_CLOUD_PROJECT: "klassrum-260913-1c02" });
    assert.ok(r.ok, r.err);
    assert.match(r.err, /Admin SDK: authorizedUser/);
    assert.equal(r.out, "klassrum-260913-1c02");
  });
  it("ingen fil men ADC (gcloud) → applicationDefault", async () => {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(dir, "gcloud"), { recursive: true });
    writeFileSync(join(dir, "gcloud", "application_default_credentials.json"), JSON.stringify(AU));
    const r = await run({});
    assert.ok(r.ok, r.err);
    assert.match(r.err, /Admin SDK: applicationDefault/);
    assert.equal(r.out, "pluggportalen-so-2026");
    rmSync(join(dir, "gcloud"), { recursive: true, force: true });
  });
  it("inget alls → tydligt fel och exit 1", async () => {
    const r = await run({});
    assert.equal(r.ok, false);
    assert.match(r.err, /Hittar ingen användbar inloggning/);
    assert.match(r.err, /application-default login/);
  });
});
