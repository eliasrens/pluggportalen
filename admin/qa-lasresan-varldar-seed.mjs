// ============================================================================
// QA-seed för Läsresan 7 världar (#668, epic 5 nya världar) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Skapar "QA-klass Världar" (qa-v-klass) med elever vars data är BYGGD AV DEN
// GAMLA KLIENTEN (före epicen: bara Skogen + Öknen, gamla banken). Eleverna
// "läser" texter genom gamla progress/picker/level-scale, så lasresa-objekt,
// försök och pluggcoins ser ut exakt som i produktion i dag:
//   qa-v-skog   "Skogs-Sam"    9 texter, mest rätt   → mitt i Skogen
//   qa-v-okn    "Öken-Olle"   27 texter, blandat     → mitt i Öknen
//   qa-v-klar   "Klar-Klara"  40 texter, mest rätt   → Öknen klar (sista världen då)
//   qa-v-extra  "Extra-Elsa"  46 texter, svagt       → Öknen klar + 6 texter till
//   qa-v-ny     "Ny Nora"     har inte börjat        → klassens startnivå
// Plus elever med NY klient på steg 19 i varje värld (för världsbytes-skärmdumpar):
//   qa-v-w-<världId> "Steg-19 <Värld>"
// Kräver gamla klienten utpackad:  git archive 4fbf4c9 src | tar -x -C /tmp/q668-gammal
//   OLD_SRC=/tmp/q668-gammal/src FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… \
//     node admin/qa-lasresan-varldar-seed.mjs
// Idempotent (ersätter dokumenten). Lösenord lilla123 (endast emulator).
// ============================================================================
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const OLD = process.env.OLD_SRC || "/tmp/q668-gammal/src";
const imp = (dir, p) => import(pathToFileURL(`${dir}/${p}`).href);
const NEW = new URL("../src/", import.meta.url).pathname.replace(/\/$/, "");

/** En klient (gammal eller ny): de rena funktionerna appen använder + dess bank. */
async function klient(dir) {
  const progress = await imp(dir, "lasresan/progress.js");
  const { toStoredLasresa } = await imp(dir, "lasresan/level-scale.js");
  const { pickText } = await imp(dir, "lasresan/picker.js");
  const { coinsFor } = await imp(dir, "lasresan/rewards.js");
  const { WORLDS } = await imp(dir, "lasresan/worlds/index.js");
  const bankDir = `${dir}/lasresan/content/bank/`;
  const man = JSON.parse(readFileSync(bankDir + "manifest.json", "utf8"));
  const bank = Object.values(man.levels).flat().flatMap((f) => JSON.parse(readFileSync(bankDir + f, "utf8")));
  return { ...progress, toStoredLasresa, pickText, coinsFor, WORLDS, bank };
}

// Deterministisk slump så att seeden blir likadan varje gång.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/**
 * Låt eleven läsa `n` texter med klienten `k`. `traff` = andel rätt per text.
 * Returnerar lagrat lasresa-objekt, försök och intjänade pluggcoins.
 */
function las(k, n, traff, seed, start = undefined) {
  const r = rng(seed);
  let lr = k.normalizeLasresa(start, k.WORLDS);
  const attempts = [];
  let coins = 0;
  let t0 = Date.UTC(2026, 8, 1, 8, 0, 0);
  for (let i = 0; i < n; i++) {
    const text = k.pickText(lr.level, lr.seenTextIds, k.bank, { lastTextId: lr.lastTextId, rng: r });
    lr = k.withStartedText(lr, text.id, t0).lasresa;
    const answers = text.questions.map((q) => ({
      qid: q.id, chosen: r() < traff ? q.answerIndex : (q.answerIndex + 1) % q.options.length,
    }));
    const attempt = k.buildAttempt(text, answers, { startedAt: t0, completedAt: t0 + 6 * 60000, studentId: null });
    lr = k.applyCompletion(lr, attempt, k.WORLDS, t0 + 6 * 60000).lasresa;
    attempts.push(attempt);
    coins += k.coinsFor(attempt.correct);
    t0 += 24 * 3600000;
  }
  return { lasresa: k.toStoredLasresa(lr), attempts, coins };
}

const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const PW = "lilla123"; // endast emulator
const CLASS_ID = "qa-v-klass";

const gammal = await klient(OLD);
const ny = await klient(NEW);
if (gammal.WORLDS.length !== 2) throw new Error(`OLD_SRC ska vara klienten före epicen (2 världar), fick ${gammal.WORLDS.length}`);

const ELEVER = [
  { uid: "qa-v-skog", namn: "Skogs-Sam", avatarId: "fox", ...las(gammal, 9, 0.9, 1) },
  { uid: "qa-v-okn", namn: "Öken-Olle", avatarId: "owl", ...las(gammal, 27, 0.65, 2) },
  { uid: "qa-v-klar", namn: "Klar-Klara", avatarId: "cat", ...las(gammal, 40, 0.92, 3) },
  { uid: "qa-v-extra", namn: "Extra-Elsa", avatarId: "panda", ...las(gammal, 46, 0.35, 4) },
  { uid: "qa-v-ny", namn: "Ny Nora", avatarId: "dog", lasresa: null, attempts: [], coins: 0 },
];
// Ny klient: steg 18 + en läst text = steg 19 i varje värld (nästa text = världsbyte).
for (const [i, w] of ny.WORLDS.entries()) {
  const start = { level: 6, levelScale: 10, worldId: w.id, stepInWorld: w.steps - 2, completedWorlds: ny.WORLDS.slice(0, i).map((x) => x.id) };
  ELEVER.push({ uid: `qa-v-w-${w.id}`, namn: `Steg-19 ${w.name}`, avatarId: "lion", ...las(ny, 1, 1, 10 + i, start) });
}

for (const s of ELEVER) {
  const email = `${s.uid}@elev.pluggportalen.local`;
  try { await auth.getUser(s.uid); await auth.updateUser(s.uid, { email, password: PW }); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; await auth.createUser({ uid: s.uid, email, password: PW }); }
  await db.doc(`students/${s.uid}`).set({ namn: s.namn, username: s.uid, avatarId: s.avatarId, classIds: [CLASS_ID] });
  const sd = { coins: 100 + s.coins, progress: {}, avatarId: s.avatarId, avatarChosen: true, ownedItems: ["hatt-1"] };
  if (s.lasresa) sd.lasresa = s.lasresa;
  await db.doc(`studentData/${s.uid}`).set(sd);
  const old = await db.collection(`studentData/${s.uid}/lasresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  for (const a of s.attempts) await db.collection(`studentData/${s.uid}/lasresaAttempts`).add({ ...a, studentId: s.uid });
  const lr = s.lasresa;
  console.log(`✓ ${s.uid} (${s.namn}) – ${lr ? `${lr.worldId} steg ${lr.stepInWorld}, klara [${lr.completedWorlds}], nivå ${lr.level10}, ${lr.totalTexts} texter` : "ej börjat"}`);
}
await db.doc(`classes/${CLASS_ID}`).set({
  name: "QA-klass Världar", order: 5, createdAt: Date.UTC(2026, 9, 13), studentIds: ELEVER.map((s) => s.uid),
});
console.log(`✓ Världar: ${CLASS_ID} (QA-klass Världar, ${ELEVER.length} elever)`);
process.exit(0);
