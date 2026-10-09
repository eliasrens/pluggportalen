// ============================================================================
// QA-seed för Läsresan (issue #403) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Skapar testkonton och sätter progress-state direkt i studentData.lasresa så
// att acceptanstester som kräver många texter (spec §26) går att köra utan att
// läsa 20 texter för hand. Idempotent: återställer allt vid varje körning.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-lasresan-seed.mjs
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// Konton (lösenord lilla123, endast emulator): lärare `qalarare`, elever se SCENARIER nedan.
// Nivåerna lagras i GAMMAL skala 1–7 (inga level10-fält) och visas/används +3
// sedan epic #516 (#519 lat migrering). Ny skala: admin/qa-lasresan-10-seed.mjs.
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const app = admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth(app);
const db = admin.firestore(app);

const PW = "lilla123"; // endast emulator
const CLASS_ID = "qa-klass";
const NOW = Date.UTC(2026, 9, 5, 8, 0, 0);

/** Komplett lasresa-tillstånd (samma form som progress.js defaultLasresa). */
const lasresa = (over = {}) => ({
  level: 3, highStreak: 0, lowStreak: 0,
  worldId: "skogen", stepInWorld: 0, completedWorlds: [],
  totalTexts: 0, totalQuestions: 0, totalCorrect: 0, totalIncorrect: 0, moneyEarned: 0,
  seenTextIds: [], catStats: {},
  currentTextId: null, currentStartedAt: null, lastTextId: null, updatedAt: NOW,
  ...over,
});

// Försök (lasresaAttempts) för lärarens elevdetalj (test 10).
const attempt = (textId, textLevel, correct, total, perCategory, minutesAgo) => ({
  textId, title: textId, textType: "story", textLevel,
  startedAt: NOW - (minutesAgo + 6) * 60000, completedAt: NOW - minutesAgo * 60000,
  totalQuestions: total, correct, incorrect: total - correct,
  percentage: Math.round((correct * 100) / total), earnedMoney: correct * 3,
  perQuestion: [], perCategory,
});

// uid = användarnamn. `lasresa: null` = har inte börjat (fältet saknas).
const SCENARIER = [
  { uid: "elev1", namn: "Astrid", avatarId: "fox", coins: 300, readingLevel: 2, lasresa: null }, // test 1, 2, 8
  { uid: "qa-hog", namn: "Hög Hugo", avatarId: "owl", coins: 100, lasresa: lasresa() }, // test 3
  { uid: "qa-mitt", namn: "Mitt Maja", avatarId: "cat", coins: 100, lasresa: lasresa() }, // test 4
  { uid: "qa-lag", namn: "Låg Lova", avatarId: "dog", coins: 100, lasresa: lasresa() }, // test 5
  { uid: "qa-femtio", namn: "Femtio Fia", avatarId: "panda", coins: 100, lasresa: lasresa({ lowStreak: 1 }) }, // test 6
  {
    // test 7: 19 texter klara i Skogen, nivå 4, står före steg 20.
    uid: "qa-skogen19", namn: "Skogs Sam", avatarId: "frog", coins: 100,
    lasresa: lasresa({
      level: 4, highStreak: 1, stepInWorld: 19, totalTexts: 19, totalQuestions: 140, totalCorrect: 100,
      totalIncorrect: 40, moneyEarned: 300,
      seenTextIds: ["lr-n4-talangshowen", "lr-n4-lappen-i-boken", "lr-n3-oknar"], lastTextId: "lr-n4-talangshowen",
      catStats: { fakta: { q: 50, correct: 40 }, ordforstaelse: { q: 30, correct: 20 }, mellan_raderna: { q: 40, correct: 25 }, helhet_slutsats: { q: 20, correct: 15 } },
    }),
  },
  {
    // test 9: 3 av 6 nivå-3-texter redan lästa.
    uid: "qa-olast", namn: "Oläst Olle", avatarId: "fox", coins: 100,
    lasresa: lasresa({
      stepInWorld: 3, totalTexts: 3, totalQuestions: 21, totalCorrect: 13, totalIncorrect: 8, moneyEarned: 39,
      seenTextIds: ["lr-n3-nya-eleven", "lr-n3-skolfotot", "lr-n3-kanoten"], lastTextId: "lr-n3-kanoten",
    }),
  },
  {
    // test 10: elev i Öknen med försök per frågetyp.
    uid: "qa-oken", namn: "Öken Ella", avatarId: "cat", coins: 100,
    lasresa: lasresa({
      level: 5, worldId: "oknen", stepInWorld: 2, completedWorlds: ["skogen"], totalTexts: 22, totalQuestions: 170,
      totalCorrect: 140, totalIncorrect: 30, moneyEarned: 420, lastTextId: "lr-n5-dimman",
      catStats: { fakta: { q: 60, correct: 55 }, ordforstaelse: { q: 40, correct: 30 }, mellan_raderna: { q: 40, correct: 30 }, helhet_slutsats: { q: 30, correct: 25 } },
    }),
    attempts: [
      attempt("lr-n5-dimman", 5, 7, 8, { fakta: { q: 3, correct: 3 }, ordforstaelse: { q: 2, correct: 1 }, mellan_raderna: { q: 2, correct: 2 }, helhet_slutsats: { q: 1, correct: 1 } }, 10),
      attempt("lr-n5-kiruna", 5, 6, 8, { fakta: { q: 3, correct: 2 }, ordforstaelse: { q: 2, correct: 2 }, mellan_raderna: { q: 2, correct: 1 }, helhet_slutsats: { q: 1, correct: 1 } }, 60),
    ],
  },
  {
    uid: "qa-svag", namn: "Bo <b>Svag</b>", avatarId: "dog", coins: 100,
    lasresa: lasresa({
      level: 1, stepInWorld: 6, totalTexts: 6, totalQuestions: 38, totalCorrect: 12, totalIncorrect: 26, moneyEarned: 36,
      catStats: { fakta: { q: 14, correct: 6 }, ordforstaelse: { q: 8, correct: 2 }, mellan_raderna: { q: 10, correct: 3 }, helhet_slutsats: { q: 6, correct: 1 } },
    }),
  },
  { uid: "qa-ny", namn: "Ny Nora", avatarId: "owl", coins: 100, lasresa: null }, // test 10: ej börjat
];

async function ensureUser(uid, email, claims) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

async function main() {
  await ensureUser("qalarare", "qalarare@larare.pluggportalen.local", { teacher: true });
  for (const s of SCENARIER) {
    await ensureUser(s.uid, `${s.uid}@elev.pluggportalen.local`);
    await db.doc(`students/${s.uid}`).set({ namn: s.namn, username: s.uid, avatarId: s.avatarId, classIds: [CLASS_ID] });
    const sd = { coins: s.coins, progress: {}, avatarId: s.avatarId };
    if (s.readingLevel) sd.readingLevel = s.readingLevel;
    if (s.lasresa) sd.lasresa = s.lasresa;
    await db.doc(`studentData/${s.uid}`).set(sd); // ersätter (återställer) hela dokumentet
    const old = await db.collection(`studentData/${s.uid}/lasresaAttempts`).get();
    await Promise.all(old.docs.map((d) => d.ref.delete()));
    for (const a of s.attempts || []) await db.collection(`studentData/${s.uid}/lasresaAttempts`).add({ ...a, studentId: s.uid });
    console.log(`✓ ${s.uid} (${s.namn})${s.lasresa ? "" : " – ej börjat"}`);
  }
  await db.doc(`classes/${CLASS_ID}`).set({ name: "QA-klass 4A", order: 1, createdAt: NOW, studentIds: SCENARIER.map((s) => s.uid) });
  console.log(`✓ klass ${CLASS_ID} med ${SCENARIER.length} elever, lärare qalarare/${PW}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
