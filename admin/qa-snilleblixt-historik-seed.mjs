// ============================================================================
// QA-seed för Snilleblixtens historik/statistik (#560) – BARA mot emulatorn.
// ----------------------------------------------------------------------------
// Kör EFTER admin/qa-mm-live-seed.mjs (lärare rasmus/elias, 4B b01–b20 och en
// gammal Klassmatch-historik). Lägger till en AVSLUTAD Snilleblixt-match i 4B
// (10 frågor, skriv själv, med Pluggmynt) med sbPrivate/snapshot, sbAnswers,
// sbScores och spelare – men UTAN result, så att lärarens historik räknar
// resultatet själv (resultInputs → buildResult → writeResultIfMissing) som när
// ingen projektor var öppen vid slutet. Poängen ur formatets riktiga scoreQuestion.
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… GCLOUD_PROJECT=pluggportalen-so-2026 \
//     node admin/qa-snilleblixt-historik-seed.mjs
// ============================================================================
import admin from "firebase-admin";
import { scoreQuestion } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import { demoSnapshot } from "../src/live/formats/snilleblixt/sb-demo.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;
const SID = "snilleblixt-historik";
const NOW = Date.now();
const T0 = NOW - 3600_000;
const SEK = 20;

async function main() {
  await db.recursiveDelete(db.doc(`liveSessions/${SID}`));
  const snap = demoSnapshot("free");
  const uids = Array.from({ length: 20 }, (_, i) => `b${String(i + 1).padStart(2, "0")}`);
  const names = {};
  for (const uid of uids) names[uid] = (await db.doc(`students/${uid}`).get()).data()?.namn || uid;
  const ref = db.doc(`liveSessions/${SID}`);
  await ref.set({
    name: "Snilleblixten 4B", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, countdownSeconds: 4, questionSeconds: SEK,
    questionCount: snap.questions.length, shuffleQuestions: true, showQuestionOnStudent: true,
    rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
    status: "finished", createdBy: "rasmus", createdByName: "rasmus", createdAt: Timestamp.fromMillis(T0 - 60_000),
    startedAt: Timestamp.fromMillis(T0), finishedAt: Timestamp.fromMillis(T0 + 15 * 60_000),
    q: { index: 9, phase: "revealed", openedAt: Timestamp.fromMillis(T0 + 9 * 60_000), question: snap.questions[9], facit: snap.facit[9] },
  });
  await ref.collection("sbPrivate").doc("snapshot").set(snap);
  for (const [i, uid] of uids.entries()) {
    await ref.collection("players").doc(uid).set({
      uid, name: names[uid], classId: "4b", correct: 0, incorrect: 0,
      joinedAt: Timestamp.fromMillis(T0 - 30_000), lastSeenAt: Timestamp.fromMillis(T0 + 15 * 60_000),
    });
    void i;
  }
  // Fråga 4 (8 × 8) svår, fråga 7 (4 × 8) hoppas över; b01 och b02 delar inte – b01 vinner.
  const hard = { 1: 0.45, 3: 0.2, 8: 0.35 };
  for (let qi = 0; qi < 10; qi++) {
    const openedAt = T0 + qi * 60_000;
    const q = { index: qi, openedAt, closedAt: openedAt + SEK * 1000 };
    const answers = [];
    uids.forEach((uid, j) => {
      if ((j + qi) % 9 === 0) return; // svarade inte
      const p = hard[qi] ?? 0.8;
      const ok = ((j * 37 + qi * 11) % 100) / 100 < p || j === 0;
      const at = openedAt + 1500 + ((j * 911 + qi * 313) % 15000);
      answers.push({ uid, classId: "4b", q: qi, answerKind: "free", at, answer: ok ? snap.facit[qi].correctAnswer : String(Number(snap.facit[qi].correctAnswer) + (j % 2 ? -8 : 1)) });
    });
    for (const a of answers) {
      await ref.collection("sbAnswers").doc(`${qi}_${a.uid}`).set({ ...a, at: Timestamp.fromMillis(a.at) });
    }
    const sc = scoreQuestion({ q, facit: snap.facit[qi], answers, questionSeconds: SEK, answerKind: "free", skipped: qi === 6 });
    await ref.collection("sbScores").doc(String(qi)).set(sc);
  }
  console.log(`✓ Snilleblixten 4B (${SID}): 20 elever, 10 frågor (fråga 7 överhoppad), inget result – historiken räknar det`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
