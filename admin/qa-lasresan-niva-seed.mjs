// ============================================================================
// QA-seed för Läsresans nivåstyrning (#506) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-lasresan-seed.mjs (som skapar qa-klass "QA-klass 4A" +
// läraren qalarare). Lägger till det nivåstyrningen behöver:
//   * qa-pagaende "Pågående Pia" – nivå 4 med en PÅBÖRJAD nivå 4-text
//     (lr-n4-talangshowen) → en ny nivå blir "väntande" tills texten är klar
//   * qa-klass-b "QA-klass 5B" med 3 egna elever (klassväljaren i
//     "Ändra nivå för hela klassen"), varav en som inte har börjat
//   * qa-klass utan lasresaStartLevel (= standard 4)
// Nivåerna lagras i GAMMAL skala 1–7 (inga level10-fält) och visas +3 sedan
// epic #516 (Pia: gammal 4 → 7). Ny skala + blandat: admin/qa-lasresan-10-seed.mjs.
// Idempotent. Lösenord lilla123 (endast emulator) för alla. Vägrar köra utan emulator-variablerna.
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-lasresan-niva-seed.mjs
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const FV = admin.firestore.FieldValue;
const PW = "lilla123"; // endast emulator
const NOW = Date.UTC(2026, 9, 8, 8, 0, 0);

const lasresa = (over = {}) => ({
  level: 3, highStreak: 0, lowStreak: 0, worldId: "skogen", stepInWorld: 0, completedWorlds: [],
  totalTexts: 0, totalQuestions: 0, totalCorrect: 0, totalIncorrect: 0, moneyEarned: 0,
  seenTextIds: [], catStats: {}, currentTextId: null, currentStartedAt: null, lastTextId: null, updatedAt: NOW,
  ...over,
});

const NYA = [
  {
    uid: "qa-pagaende", namn: "Pågående Pia", avatarId: "panda", klass: "qa-klass",
    lasresa: lasresa({
      level: 4, stepInWorld: 2, totalTexts: 2, totalQuestions: 16, totalCorrect: 12, totalIncorrect: 4, moneyEarned: 36,
      seenTextIds: ["lr-n4-lappen-i-boken", "lr-n4-orienteringen", "lr-n4-talangshowen"], lastTextId: "lr-n4-orienteringen",
      currentTextId: "lr-n4-talangshowen", currentStartedAt: NOW,
      catStats: { fakta: { q: 6, correct: 5 }, ordforstaelse: { q: 4, correct: 3 }, mellan_raderna: { q: 4, correct: 3 }, helhet_slutsats: { q: 2, correct: 1 } },
    }),
  },
  { uid: "qa-b-anna", namn: "Anna B", avatarId: "cat", klass: "qa-klass-b", lasresa: lasresa({ level: 5, stepInWorld: 4, totalTexts: 4, totalQuestions: 30, totalCorrect: 24, totalIncorrect: 6, moneyEarned: 72, seenTextIds: ["x1", "x2", "x3", "x4"] }) },
  { uid: "qa-b-bertil", namn: "Bertil B", avatarId: "dog", klass: "qa-klass-b", lasresa: lasresa({ level: 2, stepInWorld: 1, totalTexts: 1, totalQuestions: 6, totalCorrect: 3, totalIncorrect: 3, moneyEarned: 9, seenTextIds: ["y1"] }) },
  { uid: "qa-b-cesar", namn: "Cesar B", avatarId: "owl", klass: "qa-klass-b", lasresa: null },
];

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

for (const s of NYA) {
  await ensureUser(s.uid);
  await db.doc(`students/${s.uid}`).set({ namn: s.namn, username: s.uid, avatarId: s.avatarId, classIds: [s.klass] });
  const sd = { coins: 100, progress: {}, avatarId: s.avatarId };
  if (s.lasresa) sd.lasresa = s.lasresa;
  await db.doc(`studentData/${s.uid}`).set(sd);
  const old = await db.collection(`studentData/${s.uid}/lasresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  console.log(`✓ ${s.uid} (${s.namn}) i ${s.klass}${s.lasresa ? "" : " – ej börjat"}`);
}
await db.doc("classes/qa-klass").set(
  { studentIds: FV.arrayUnion("qa-pagaende"), lasresaStartLevel: FV.delete() },
  { merge: true }
);
await db.doc("classes/qa-klass-b").set({
  name: "QA-klass 5B", order: 2, createdAt: NOW,
  studentIds: NYA.filter((s) => s.klass === "qa-klass-b").map((s) => s.uid),
});
console.log("✓ nivåstyrning: qa-klass (+ Pågående Pia, startnivå standard) och qa-klass-b (3 elever)");
process.exit(0);
