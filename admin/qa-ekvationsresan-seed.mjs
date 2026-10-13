// ============================================================================
// QA-seed för Ekvationsresan (#618) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-lasresan-seed.mjs (som skapar qa-klass, elev1 m.fl. och
// läraren qalarare). Den här:
//   • slår PÅ Ekvationsresan för qa-klass (enabledModules) – elev1 ser den
//   • skapar klassen qa-klass-av med eleven ekv-av, där modulen är AV (test 23)
//   • nollställer elev1:s Ekvationsresan (nivå 1) – eller sätter nivå med --niva N
//   • --typ C|D|E|F: elev1:s pågående uppgift blir av den typen (#625, nivå
//     enligt --niva, annars 3 – för C/E 6, de finns först där, #657) – för att
//     prova uppgiftstyperna i webbläsaren
//   • --av: slå AV modulen för qa-klass igen (test 23, påslagen → avstängd)
//   • --larare: spelar fram riktiga försök (spelets egen logik) för qa-hog
//     (↗, nivå upp), qa-mitt (blandat), qa-lag (↘, Visa lösningen), qa-svag
//     (omvägar + 💡) – lärarvyn, test 24/25 (#619). qa-ny har inte börjat.
//     #626: + qa-text (starka ekvationer, svag text → ekvation), qa-bro (vågen
//     men inte symbolerna), qa-koef (💡 när x har koefficient), qa-omvag (många
//     extra drag) – färdighetsmodellens sammanfattningar i lärarvyn. Alla
//     spelas med admin/qa-ekvationsresan-spela.mjs (spelets egen logik).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8618 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9618 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-ekvationsresan-seed.mjs [--niva 3] [--av]
//
// Konton (lösenord lilla123, endast emulator). Vägrar köra utan emulator-variablerna.
// ============================================================================
import admin from "firebase-admin";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { applyCompletion, normalizeProgress } from "../src/ekvationsresan/framsteg.js";
import { TYPE_MIN_LEVEL } from "../src/ekvationsresan/config.js";
import { sammanfattningar } from "../src/ekvationsresan/sammanfattning.js";
import { spela } from "./qa-ekvationsresan-spela.mjs";

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
const typ = args.includes("--typ") ? args[args.indexOf("--typ") + 1] : null;

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
  if (uid === "elev1" && typ) {
    const level = Math.max(lvl || 3, TYPE_MIN_LEVEL[typ] ?? 0);
    const task = generateTask(level, { rng: seededRng(`qa-typ-${typ}-${Date.now()}`), type: typ });
    const current = { id: `qa625${typ}${Date.now()}`, at: Date.now(), task };
    await ref.set({ schema: 1, level, window: [], maxLevel: level, current, updatedAt: Date.now() });
  } else if (lvl) await ref.set({ schema: 1, level: lvl, window: [], maxLevel: lvl, current: null });
  else await ref.delete();
}

// Lärarvyns elever (#619): startnivå + uppgifter i ordning. Etapp 1-eleverna
// har bara lösningsuppgifter (B): "ok" = optimalt, "omvag" = +1/−1 först,
// "hjalp" = 💡 steg 2, "visa" = Visa lösningen.
const PLAN = { ok: {}, omvag: { extra: 1 }, hjalp: { help: 2 }, visa: { reveal: true } };
const losa = (s) => s.split(" ").map((k) => ({ type: "B", plan: PLAN[k] }));
const ganger = (n, x) => Array.from({ length: n }, () => x);
const LARARE = {
  "qa-hog": { level: 2, plays: losa("ok ok ok ok ok ok omvag ok ok ok ok") },
  "qa-mitt": { level: 3, plays: losa("ok omvag hjalp ok visa ok omvag ok") },
  "qa-lag": { level: 3, plays: losa("ok ok ok visa visa visa hjalp visa visa") },
  "qa-svag": { level: 2, plays: losa("omvag omvag hjalp ok omvag hjalp") },
  // #626 – färdighetsmodellen (E2.4/E2.5)
  "qa-text": { namn: "Text Tova", level: 5, plays: [...losa("ok ok ok ok ok ok"), ...ganger(3, { type: "F", plan: { fel: { ekvation: "visa" } } })] },
  "qa-bro": { namn: "Våg Vera", level: 6, plays: [...ganger(4, { type: "A" }), ...ganger(2, { type: "D", plan: { fel: { ekvation: "visa" } } }), ...ganger(2, { type: "C", plan: { fel: { rad: 2 } } })] },
  "qa-koef": { namn: "Koef Kim", level: 6, plays: ["x+a=b", "ax=b", "x/a=b", "x-a=b", "ax=b", "x/a=b", "x+a=b", "ax=b", "x/a=b"].map((form) => ({ type: "B", form, plan: /^x[+-]/.test(form) ? {} : { help: 2 } })) },
  "qa-omvag": { namn: "Omväg Olle", level: 3, plays: ganger(5, { type: "B", plan: { extra: 3 } }) },
};

async function ensureElev(uid, namn) {
  await ensureUser(uid);
  await db.doc(`students/${uid}`).set({ namn, username: uid, avatarId: "fox", classIds: ["qa-klass"] }, { merge: true });
  await db.doc(`studentData/${uid}`).set({ coins: 50, progress: {}, avatarId: "fox" }, { merge: true });
  await db.doc("classes/qa-klass").set({ studentIds: admin.firestore.FieldValue.arrayUnion(uid) }, { merge: true });
}

async function seedLarare() {
  const rng = seededRng("qa-larare");
  const t0 = Date.now() - 3 * 24 * 3600 * 1000;
  for (const [uid, { namn, level, plays }] of Object.entries(LARARE)) {
    if (namn) await ensureElev(uid, namn);
    await resetEkv(uid, null);
    let p = normalizeProgress({ level, maxLevel: level });
    const batch = db.batch();
    plays.forEach(({ type, form = null, plan }, i) => {
      const task = generateTask(p.level, { rng, type, form });
      const at = t0 + i * 3600 * 1000;
      const id = `${uid.replace(/[^a-z0-9]/g, "")}${String(i).padStart(6, "0")}`;
      const a = spela(task, plan, { id, at });
      p = applyCompletion(p, a, { now: at }).progress;
      batch.set(db.doc(`studentData/${uid}/ekvationsresaAttempts/${id}`), a);
    });
    batch.set(db.doc(`studentData/${uid}/ekvationsresa/progress`), p);
    await batch.commit();
    const korthet = sammanfattningar(p.skills).map((r) => r.text).join(" ");
    console.log(`✓ ${uid}: ${p.tasks} uppgifter, nivå ${level} → ${p.level}. ${korthet}`);
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
