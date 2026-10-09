// ============================================================================
// QA-seed för Läsresan slut-QA (#515, epic #482) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-lasresan-seed.mjs + admin/qa-lasresan-niva-seed.mjs.
// Lägger till klassen för startnivå-testet i klickguiden
// (docs/preview-lasresan-482.md) och återställer det som
// admin/qa-lasresan-482-kontroll.mjs ändrar:
//   * qa-482-start "QA-klass 6C" UTAN startnivå (= standard 4 sedan epic #516) med
//       qa-6c-ny     "Ny Nils"     – har inte börjat (inget lasresa-objekt)
//       qa-6c-igang  "Igång Ines"  – igång på nivå 5 (3 lästa texter, 45 kr)
//   * qa-6c-sen "Sen Sara" – elevkonto som INTE är med i någon klass än
//     ("ny elev": läggs till i 6C efter att startnivån satts)
//   * tar bort kontrollskriptets qa-482-*-elever (konton + data) och dess
//     klass qa-482-kontroll
// Idempotent. Lösenord lilla123 (endast emulator). Vägrar köra utan emulator-variablerna.
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-lasresan-482-seed.mjs
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

const IGANG = {
  level: 5, highStreak: 1, lowStreak: 0, worldId: "skogen", stepInWorld: 3, completedWorlds: [],
  totalTexts: 3, totalQuestions: 24, totalCorrect: 18, totalIncorrect: 6, moneyEarned: 54,
  seenTextIds: ["lr-n5-somnen", "lr-n5-robotdammsugaren", "lr-n5-fyrvaktaren"], catStats: { fakta: { q: 9, correct: 7 } },
  currentTextId: null, currentStartedAt: null, lastTextId: "lr-n5-fyrvaktaren", updatedAt: NOW,
};
const ELEVER = [
  { uid: "qa-6c-ny", namn: "Ny Nils", avatarId: "owl", klass: "qa-482-start", lasresa: null },
  { uid: "qa-6c-igang", namn: "Igång Ines", avatarId: "cat", klass: "qa-482-start", lasresa: IGANG },
  { uid: "qa-6c-sen", namn: "Sen Sara", avatarId: "fox", klass: null, lasresa: null },
];

for (const s of ELEVER) {
  const email = `${s.uid}@elev.pluggportalen.local`;
  try { await auth.getUser(s.uid); await auth.updateUser(s.uid, { email, password: PW }); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; await auth.createUser({ uid: s.uid, email, password: PW }); }
  await db.doc(`students/${s.uid}`).set({ namn: s.namn, username: s.uid, avatarId: s.avatarId, classIds: s.klass ? [s.klass] : [] });
  const sd = { coins: 100, progress: {}, avatarId: s.avatarId };
  if (s.lasresa) sd.lasresa = s.lasresa;
  await db.doc(`studentData/${s.uid}`).set(sd);
  const old = await db.collection(`studentData/${s.uid}/lasresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  console.log(`✓ ${s.uid} (${s.namn})${s.klass ? ` i ${s.klass}` : " – ingen klass än"}${s.lasresa ? "" : " – ej börjat"}`);
}
await db.doc("classes/qa-482-start").set({
  name: "QA-klass 6C", order: 3, createdAt: NOW, studentIds: ["qa-6c-ny", "qa-6c-igang"],
});
await db.doc("classes/qa-klass").update({
  studentIds: FV.arrayRemove("qa-482-enskild", "qa-482-bevarat", "qa-482-prog"),
});
await db.doc("classes/qa-482-kontroll").delete();
// Kontrollskriptets egna elever (qa-482-*) bort helt, så klickguidens listor är rena.
const KONTROLL = ["qa-482-enskild", "qa-482-bevarat", "qa-482-prog", "qa-482-ejborjat", "qa-482-igang", "qa-482-ny"];
for (const uid of KONTROLL) {
  const old = await db.collection(`studentData/${uid}/lasresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  await db.doc(`studentData/${uid}`).delete();
  await db.doc(`students/${uid}`).delete();
  await auth.deleteUser(uid).catch(() => {});
}
console.log("✓ slut-QA: qa-482-start (QA-klass 6C, startnivå standard) + Sen Sara utan klass");
process.exit(0);
