// ============================================================================
// QA-seed för Ekvationsresan (#618) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-lasresan-seed.mjs (som skapar qa-klass, elev1 m.fl. och
// läraren qalarare). Den här:
//   • slår PÅ Ekvationsresan för qa-klass (enabledModules) – elev1 ser den
//   • skapar klassen qa-klass-av med eleven ekv-av, där modulen är AV (test 23)
//   • nollställer elev1:s Ekvationsresan (nivå 1) – eller sätter nivå med --niva N
//   • --av: slå AV modulen för qa-klass igen (test 23, påslagen → avstängd)
//   • --larare: spelar fram riktiga försök (spelets egen logik) för qa-hog
//     (↗, nivå upp), qa-mitt (blandat), qa-lag (↘, Visa lösningen), qa-svag
//     (omvägar + 💡) – lärarvyn, test 24/25 (#619). qa-ny har inte börjat.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8618 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9618 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-ekvationsresan-seed.mjs [--niva 3] [--av]
//
// Konton (lösenord lilla123, endast emulator). Vägrar köra utan emulator-variablerna.
// ============================================================================
import admin from "firebase-admin";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { fromJSON } from "../src/ekvationsresan/equation.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";
import { revealSolution } from "../src/ekvationsresan/hjalp.js";
import { applyCompletion, buildAttempt, normalizeProgress } from "../src/ekvationsresan/framsteg.js";

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

async function resetEkv(uid, lvl = niva) {
  const old = await db.collection(`studentData/${uid}/ekvationsresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  const ref = db.doc(`studentData/${uid}/ekvationsresa/progress`);
  if (lvl) await ref.set({ schema: 1, level: lvl, window: [], maxLevel: lvl, current: null });
  else await ref.delete();
}

// Lärarvyns elever (#619): startnivå + en lista uppgifter ("ok" = optimalt,
// "omvag" = +1/−1 först, "hjalp" = 💡 steg 2, "visa" = Visa lösningen).
const LARARE = {
  "qa-hog": { level: 2, plays: "ok ok ok ok ok ok omvag ok ok ok ok".split(" ") },
  "qa-mitt": { level: 3, plays: "ok omvag hjalp ok visa ok omvag ok".split(" ") },
  "qa-lag": { level: 3, plays: "ok ok ok visa visa visa hjalp visa visa".split(" ") },
  "qa-svag": { level: 2, plays: "omvag omvag hjalp ok omvag hjalp".split(" ") },
};

async function seedLarare() {
  const rng = seededRng("qa-larare");
  const t0 = Date.now() - 3 * 24 * 3600 * 1000;
  for (const [uid, { level, plays }] of Object.entries(LARARE)) {
    await resetEkv(uid, null);
    let p = normalizeProgress({ level, maxLevel: level });
    const batch = db.batch();
    plays.forEach((kind, i) => {
      const task = generateTask(p.level, { rng });
      let run = startRun(fromJSON(task.equation));
      if (kind === "omvag") run = playMove(playMove(run, "+1").run, "-1").run;
      const own = run.moves.length;
      if (kind === "visa") run = revealSolution(run).run;
      else for (const m of task.optimalPath) run = playMove(run, m).run;
      const help = kind === "hjalp" ? 2 : 0;
      const result = taskResult(task, run, { maxStep: help });
      const at = t0 + i * 3600 * 1000;
      const id = `${uid.replace(/[^a-z0-9]/g, "")}${String(i).padStart(6, "0")}`;
      const a = buildAttempt({ id, task, run, help: { log: Array(help).fill(1) }, result, ownMoves: own, startedAt: at - 60000, completedAt: at });
      p = applyCompletion(p, a, { now: at }).progress;
      batch.set(db.doc(`studentData/${uid}/ekvationsresaAttempts/${id}`), a);
    });
    batch.set(db.doc(`studentData/${uid}/ekvationsresa/progress`), p);
    await batch.commit();
    console.log(`✓ ${uid}: ${p.tasks} uppgifter, nivå ${level} → ${p.level}`);
  }
  await resetEkv("qa-ny", null);
}

async function main() {
  await db.doc("classes/qa-klass").set({ enabledModules: args.includes("--av") ? [] : ["ekvationsresan"] }, { merge: true });
  await ensureUser("ekv-av");
  await db.doc("students/ekv-av").set({ namn: "Av Anton", username: "ekv-av", avatarId: "owl", classIds: ["qa-klass-av"] });
  await db.doc("studentData/ekv-av").set({ coins: 0, progress: {}, avatarId: "owl" });
  await db.doc("classes/qa-klass-av").set({ name: "QA-klass utan Ekvationsresan", order: 2, createdAt: Date.now(), studentIds: ["ekv-av"] });
  await resetEkv("elev1");
  if (args.includes("--larare")) await seedLarare();
  const sd = (await db.doc("studentData/elev1").get()).data() || {};
  console.log(`✓ Ekvationsresan ${args.includes("--av") ? "AV" : "PÅ"} för qa-klass (elev1, ${sd.coins ?? 0} mynt, nivå ${niva || 1}); AV för qa-klass-av (ekv-av)`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
