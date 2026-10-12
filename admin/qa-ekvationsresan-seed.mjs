// ============================================================================
// QA-seed för Ekvationsresan (#618) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-lasresan-seed.mjs (som skapar qa-klass, elev1 m.fl. och
// läraren qalarare). Den här:
//   • slår PÅ Ekvationsresan för qa-klass (enabledModules) – elev1 ser den
//   • skapar klassen qa-klass-av med eleven ekv-av, där modulen är AV (test 23)
//   • nollställer elev1:s Ekvationsresan (nivå 1) – eller sätter nivå med --niva N
//   • --av: slå AV modulen för qa-klass igen (test 23, påslagen → avstängd)
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8618 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9618 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-ekvationsresan-seed.mjs [--niva 3] [--av]
//
// Konton (lösenord lilla123, endast emulator). Vägrar köra utan emulator-variablerna.
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const PW = "lilla123";
const args = process.argv.slice(2);
const niva = args.includes("--niva") ? Number(args[args.indexOf("--niva") + 1]) : null;

async function ensureUser(uid) {
  const email = `${uid}@elev.pluggportalen.local`;
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
}

async function resetEkv(uid) {
  const old = await db.collection(`studentData/${uid}/ekvationsresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  const ref = db.doc(`studentData/${uid}/ekvationsresa/progress`);
  if (niva) await ref.set({ schema: 1, level: niva, window: [], maxLevel: niva, current: null });
  else await ref.delete();
}

async function main() {
  await db.doc("classes/qa-klass").set({ enabledModules: args.includes("--av") ? [] : ["ekvationsresan"] }, { merge: true });
  await ensureUser("ekv-av");
  await db.doc("students/ekv-av").set({ namn: "Av Anton", username: "ekv-av", avatarId: "owl", classIds: ["qa-klass-av"] });
  await db.doc("studentData/ekv-av").set({ coins: 0, progress: {}, avatarId: "owl" });
  await db.doc("classes/qa-klass-av").set({ name: "QA-klass utan Ekvationsresan", order: 2, createdAt: Date.now(), studentIds: ["ekv-av"] });
  await resetEkv("elev1");
  const sd = (await db.doc("studentData/elev1").get()).data() || {};
  console.log(`✓ Ekvationsresan ${args.includes("--av") ? "AV" : "PÅ"} för qa-klass (elev1, ${sd.coins ?? 0} mynt, nivå ${niva || 1}); AV för qa-klass-av (ekv-av)`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
