// ============================================================================
// QA-seed: statistik för rollkontrollen (#678) – BARA mot emulatorn. Körs
// EFTER admin/qa-larkonton-roller-seed.mjs. Ger elever i 4A/4B/5A data i
// varje statistikvy: Plugga-progress, Läsresan (+ försök), Ekvationsresan,
// en Mattematchen (4A mot 5A, pågår + en avslutad utan sparat resultat),
// en avslutad Live-match 4A mot 5A, Klasscentrets EXP och Hitta rätt!.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8689 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9689 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-larkonton-statistik-seed.mjs
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const H = 3600 * 1000;
const at = (ms) => new Date(Date.now() + ms);
const klasser = {};
for (const cid of ["4a", "4b", "5a"]) klasser[cid] = (await db.doc(`classes/${cid}`).get()).get("studentIds") || [];
const alla = Object.entries(klasser).flatMap(([cid, ids]) => ids.map((uid) => ({ uid, cid })));

for (const [i, { uid, cid }] of alla.entries()) {
  const sd = db.doc(`studentData/${uid}`);
  await sd.set({
    coins: 50 + i, xp: 120 + i * 10,
    progress: { vikingatiden: { quiz: { completed: true, bestScore: 80, stars: 2, lastPlayed: Date.now() - H } } },
    lasresa: { level: 4, level10: 7, worldId: "skogen", stepInWorld: 2, completedWorlds: [], totalTexts: 2,
      totalQuestions: 12, totalCorrect: 9, totalIncorrect: 3, moneyEarned: 20, seenTextIds: [], catStats: {},
      currentTextId: null, lastTextId: null, highStreak: 0, lowStreak: 0 },
  }, { merge: true });
  await sd.collection("lasresaAttempts").doc("qa1").set({ textId: "qa", level: 7, correct: 4, total: 6, completedAt: Date.now() - H });
  await sd.collection("ekvationsresa").doc("progress").set({ schema: 1, level: 3, window: [], tasks: 5, solved: 4, stars: 9, coins: 12 });
  await db.doc(`classCenters/${cid}/expMembers/${uid}`).set({ uid, exp: 6 + i, lastAmount: 2, lastShard: 0, lastKalla: "quiz" });
  await db.doc(`hittaRattBest/${uid}`).set({ packs: { sverige: { best: 7 + i } } });
}

const mm = async (id, status, startAt, endAt) => {
  await db.doc(`mathCompetitions/${id}`).set({
    name: `QA ${id}`, participatingClassIds: ["4a", "5a"], startAt, endAt, status, counterShards: 2, createdBy: "qa-seed",
  });
  for (const { uid, cid } of alla.filter((x) => x.cid !== "4b")) {
    await db.doc(`mathCompetitions/${id}/studentStats/${uid}`).set({ uid, classId: cid, correct: 5, incorrect: 1, c3: 2, w4: 1 });
    await db.doc(`mathCompetitions/${id}/scores/${uid}`).set({ uid, classId: cid, name: uid, correct: 5 });
    await db.doc(`mathCompetitions/${id}/answers/${id}-${uid}`).set({
      uid, classId: cid, mode: "multiplication_0_10", factorA: 3, factorB: 4, answer: 12, correctAnswer: 12, isCorrect: true, shard: 0, at: at(-H),
    });
  }
};
await mm("qa-mm-pagar", "active", at(-H), at(24 * H));
await mm("qa-mm-slut", "active", at(-48 * H), at(-24 * H));

await db.doc("liveSessions/qa-live-slut").set({
  name: "4A mot 5A (QA)", format: "klassmatch", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["4a", "5a"], classNames: { "4a": "4A", "5a": "5A" }, classDivisors: { "4a": 4, "5a": 2 },
  durationSeconds: 300, countdownSeconds: 4, counterShards: 10, status: "finished", createdBy: "qa-seed",
  createdByName: "qaadmin", createdAt: at(-3 * H), startedAt: at(-2 * H), finishedAt: at(-2 * H + 304000),
});
for (const { uid, cid } of alla.filter((x) => x.cid !== "4b")) {
  await db.doc(`liveSessions/qa-live-slut/players/${uid}`).set({ uid, classId: cid, name: uid, joinedAt: at(-2 * H), lastSeenAt: at(-2 * H), correct: 3, incorrect: 1 });
  await db.doc(`liveSessions/qa-live-slut/answers/live-${uid}`).set({
    uid, classId: cid, mode: "multiplication_0_10", factorA: 2, factorB: 5, answer: 10, correctAnswer: 10, isCorrect: true, shard: 0, at: at(-2 * H),
  });
}
await db.doc("liveSessions/qa-live-slut/counters/4a_0").set({ classId: "4a", shard: 0, correct: 12 });
await db.doc("liveSessions/qa-live-slut/counters/5a_0").set({ classId: "5a", shard: 0, correct: 6 });
console.log(`✓ Statistik för ${alla.length} elever, 2 Mattematcher, 1 Live-match.`);
