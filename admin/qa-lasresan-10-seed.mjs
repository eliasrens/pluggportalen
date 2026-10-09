// ============================================================================
// QA-seed för Läsresan 10 nivåer (#520, epic #516) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-lasresan-seed.mjs (som skapar läraren qalarare). Skapar
// "QA-klass 10N" (qa-10-klass) med elever lagrade i BÅDA skalorna, så att
// lärarvyn kan visa att gammal data läses migrerad (gammal N = ny N+3):
//   GAMMAL SKALA (som före #519 – inga level10/levelScale-fält):
//     qa-10-g1  "Gammal Gun"    level 1                    → visas 4
//     qa-10-g3  "Gammal Gösta"  level 3                    → visas 6
//     qa-10-g7  "Gammal Greta"  level 7 + 3 gamla försök   → visas 10 (försök 10/10/9)
//     qa-10-gp  "Väntande Vera" level 3, pendingLevel 2,
//                               påbörjad text              → visas "6 → 5"
//   NY SKALA (som #519 skriver: level10 + spegel i level):
//     qa-10-n9  "Nio Nadja"     level10 9 (spegel 6)       → visas 9
//     qa-10-n2  "Lätt Lisa"     level10 2 (spegel 1)       → visas 2
//     qa-10-n1  "Etta Ebba"     level10 1 (spegel 1), ny   → visas 1 "ej börjat"
//     qa-10-n3  "Trea Tore"     level10 3 (spegel 1)       → visas 3
//   qa-10-ej  "Ej Elin"         inget lasresa-objekt       → klassens startnivå
// Klassen har en GAMMAL startnivå (lasresaStartLevel 3, utan
// lasresaStartLevel10) → "Nivå 6". Idempotent. Lösenord lilla123 (endast emulator).
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-lasresan-10-seed.mjs
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const PW = "lilla123"; // endast emulator
const CLASS_ID = "qa-10-klass";
const NOW = Date.UTC(2026, 9, 8, 8, 0, 0);
const CAT = { fakta: { q: 12, correct: 9 }, ordforstaelse: { q: 8, correct: 6 }, mellan_raderna: { q: 8, correct: 5 }, helhet_slutsats: { q: 4, correct: 3 } };

/** Lagrat lasresa-objekt. Utan level10 = gammal skala (före #519). */
const lasresa = (over = {}) => ({
  highStreak: 0, lowStreak: 0, worldId: "skogen", stepInWorld: 4, completedWorlds: [],
  totalTexts: 4, totalQuestions: 32, totalCorrect: 23, totalIncorrect: 9, moneyEarned: 69,
  seenTextIds: ["a", "b", "c", "d"], catStats: CAT,
  currentTextId: null, currentStartedAt: null, lastTextId: "d", updatedAt: NOW,
  pendingLevel: null, levelSetAt: null, levelSetBy: null,
  ...over,
});

/** Försök. `scale10` = nytt försök (levelScale 10); annars gammal skala (textLevel 1–7). */
const attempt = (textId, title, textLevel, correct, total, minutesAgo, scale10 = false) => ({
  textId, title, textType: "story", textLevel, ...(scale10 ? { levelScale: 10 } : {}),
  startedAt: NOW - (minutesAgo + 6) * 60000, completedAt: NOW - minutesAgo * 60000,
  totalQuestions: total, correct, incorrect: total - correct,
  percentage: Math.round((correct * 100) / total), earnedMoney: correct * 3,
  perQuestion: [], perCategory: {},
});

const ELEVER = [
  {
    uid: "qa-10-g1", namn: "Gammal Gun", avatarId: "fox", lasresa: lasresa({ level: 1 }),
    attempts: [attempt("lr-n1-tanden", "Tanden som försvann", 1, 5, 6, 30)], // → nivå 4
  },
  { uid: "qa-10-g3", namn: "Gammal Gösta", avatarId: "owl", lasresa: lasresa({ level: 3 }) },
  {
    uid: "qa-10-g7", namn: "Gammal Greta", avatarId: "cat",
    lasresa: lasresa({ level: 7, worldId: "oknen", stepInWorld: 2, completedWorlds: ["skogen"], totalTexts: 22, totalQuestions: 190, totalCorrect: 170, totalIncorrect: 20, moneyEarned: 510 }),
    attempts: [
      attempt("lr-n7-eken", "Eken på tomtgränsen", 7, 9, 9, 10), // id lr-n7 → 10
      attempt("lr-n7-bilden-i-chatten", "Bilden i chatten", 7, 8, 9, 70), // → 10
      attempt("gammal-text", "En text utan id-konvention", 6, 7, 9, 200), // textLevel 6 + 3 → 9
    ],
  },
  {
    uid: "qa-10-gp", namn: "Väntande Vera", avatarId: "panda",
    lasresa: lasresa({ level: 3, pendingLevel: 2, currentTextId: "lr-n3-skolfotot", currentStartedAt: NOW, levelSetAt: NOW, levelSetBy: "teacher" }),
  },
  {
    uid: "qa-10-n9", namn: "Nio Nadja", avatarId: "unicorn",
    lasresa: lasresa({ level10: 9, level: 6, pendingLevel10: null }),
    attempts: [attempt("lr-n6-finalen", "Kaptenens val", 9, 7, 8, 15, true)],
  },
  {
    uid: "qa-10-n2", namn: "Lätt Lisa", avatarId: "frog",
    lasresa: lasresa({ level10: 2, level: 1, pendingLevel10: null }),
    attempts: [attempt("lr-g2-pepparkakshuset", "Taket som rasade", 2, 4, 5, 20, true)],
  },
  // Nya, enklare nivåer (#525: elevflödet på nivå 1 och 3 i previewn).
  { uid: "qa-10-n1", namn: "Etta Ebba", avatarId: "penguin", lasresa: lasresa({ level10: 1, level: 1, pendingLevel10: null, totalTexts: 0, totalQuestions: 0, totalCorrect: 0, totalIncorrect: 0, moneyEarned: 0, seenTextIds: [], catStats: {}, lastTextId: null, stepInWorld: 0 }) },
  { uid: "qa-10-n3", namn: "Trea Tore", avatarId: "lion", lasresa: lasresa({ level10: 3, level: 1, pendingLevel10: null }) },
  { uid: "qa-10-ej", namn: "Ej Elin", avatarId: "dog", lasresa: null },
];

for (const s of ELEVER) {
  const email = `${s.uid}@elev.pluggportalen.local`;
  try { await auth.getUser(s.uid); await auth.updateUser(s.uid, { email, password: PW }); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; await auth.createUser({ uid: s.uid, email, password: PW }); }
  await db.doc(`students/${s.uid}`).set({ namn: s.namn, username: s.uid, avatarId: s.avatarId, classIds: [CLASS_ID] });
  const sd = { coins: 100, progress: {}, avatarId: s.avatarId };
  if (s.lasresa) sd.lasresa = s.lasresa;
  await db.doc(`studentData/${s.uid}`).set(sd); // ersätter (återställer) hela dokumentet
  const old = await db.collection(`studentData/${s.uid}/lasresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  for (const a of s.attempts || []) await db.collection(`studentData/${s.uid}/lasresaAttempts`).add({ ...a, studentId: s.uid });
  const lv = !s.lasresa ? "ej börjat" : "level10" in s.lasresa ? `ny skala ${s.lasresa.level10}` : `gammal skala ${s.lasresa.level}`;
  console.log(`✓ ${s.uid} (${s.namn}) – ${lv}`);
}
// set() utan merge: tar bort ev. lasresaStartLevel10 från en tidigare körning.
await db.doc(`classes/${CLASS_ID}`).set({
  name: "QA-klass 10N", order: 4, createdAt: NOW, studentIds: ELEVER.map((s) => s.uid),
  lasresaStartLevel: 3, // GAMMAL startnivå (gammal skala) → visas som 6
});
console.log(`✓ 10 nivåer: ${CLASS_ID} (QA-klass 10N, ${ELEVER.length} elever, gammal startnivå 3 = 6)`);
process.exit(0);
