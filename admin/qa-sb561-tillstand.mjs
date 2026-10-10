// ============================================================================
// QA #561 runda 2: "måla" Snilleblixt-sessioner i ett exakt läge direkt i
// EMULATORN (admin) – för korta pass när emulatorn inte får leva länge.
// Samma datamodell som appen skriver (session + players + sbAnswers + sbScores,
// result = appens egen buildResult). 7 elever i 4B (b01–b07), 3 frågor
// flerval, b01 = webbläsarens elev.
//
//   <emulator-env> node admin/qa-sb561-tillstand.mjs <läge> <b01-roll> [sid]
//     läge  svar   status live, fråga 3 avslöjad (elevens avslöjande)
//           final  status finished + result (slutskärm / pall)
//           klar   status live, fråga 3 avslöjad – för "Till pallen" mitt i
//     roll  ledare | mitten | sist
// ============================================================================
import admin from "firebase-admin";
import { buildResult } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: bara emulator (FIRESTORE_EMULATOR_HOST).");
  process.exit(1);
}
const db = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }).firestore();
const { Timestamp } = admin.firestore;
const [lage, roll, sidArg] = process.argv.slice(2);
const sid = sidArg || `qa561-${lage}-${roll}`;
const NOW = Date.now();
const T = (ms) => Timestamp.fromMillis(ms);
const UIDS = ["b01", "b02", "b03", "b04", "b05", "b06", "b07"];
// Poäng per fråga (3 frågor). b01 placeras enligt rollen; övriga fasta.
const ANDRA = { b02: [980, 950, 0], b03: [0, 940, 900], b04: [930, 0, 0], b05: [0, 0, 870], b06: [910, 880, 860], b07: [600, 0, 0] };
const B01 = { ledare: [990, 985, 975], mitten: [0, 960, 0], sist: [520, 0, 0] }[roll];
if (!B01 || !["svar", "final", "klar"].includes(lage)) throw new Error("läge svar|final|klar, roll ledare|mitten|sist");
const poang = { b01: B01, ...ANDRA };

const namn = {};
for (const u of UIDS) namn[u] = (await db.doc(`students/${u}`).get()).data()?.namn || u;
const OPT = [["14", "21", "7", "12"], ["32", "16", "27", "24"], ["45", "40", "36", "27"]];
const questions = [["7 × 3", 1], ["8 × 4", 0], ["9 × 4", 2]].map(([text], i) => ({ key: `${i}:${text}`, text, statKeys: [], options: OPT[i] }));
const facit = [1, 0, 2].map((a, i) => ({ answerIndex: a, correctAnswer: OPT[i][a] }));
const opened = (i) => NOW - (3 - i) * 40_000;

const s = {
  name: `QA 561 ${lage} ${roll}`, format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "choice",
  participatingClassIds: ["4b"], classNames: { "4b": "4B" }, countdownSeconds: 4, createdBy: "rasmus", createdByName: "rasmus",
  questionSeconds: 20, questionCount: 3, shuffleQuestions: false, showQuestionOnStudent: true,
  rewards: { firstPrize: 300, perCorrect: 5, cap: 300 },
  createdAt: T(NOW - 200_000), startedAt: T(NOW - 150_000), status: "live",
  q: { index: 2, phase: "revealed", openedAt: T(opened(2)), closedAt: T(opened(2) + 8000), question: questions[2], facit: facit[2] },
};
const players = UIDS.map((u) => ({ uid: u, classId: "4b", name: namn[u], joinedAt: T(NOW - 180_000), lastSeenAt: T(NOW), correct: 0, incorrect: 0 }));
const scores = [0, 1, 2].map((i) => {
  const sc = { index: i, skipped: false, answered: UIDS.length, correctCount: 0, points: {}, correct: {}, choiceCounts: [0, 0, 0, 0] };
  for (const u of UIDS) {
    const p = poang[u][i];
    sc.points[u] = p;
    sc.correct[u] = p > 0;
    if (p > 0) sc.correctCount++;
    sc.choiceCounts[p > 0 ? facit[i].answerIndex : (facit[i].answerIndex + 1) % 4]++;
  }
  return sc;
});

const ref = db.doc(`liveSessions/${sid}`);
const b = db.batch();
b.set(ref, s);
b.set(db.doc(`liveSessions/${sid}/sbPrivate/snapshot`), { questions, facit });
for (const p of players) b.set(db.doc(`liveSessions/${sid}/players/${p.uid}`), p);
for (const sc of scores) {
  b.set(db.doc(`liveSessions/${sid}/sbScores/${sc.index}`), sc);
  for (const u of UIDS) {
    const ok = sc.correct[u];
    b.set(db.doc(`liveSessions/${sid}/sbAnswers/${sc.index}_${u}`), {
      uid: u, classId: "4b", q: sc.index, answerKind: "choice", at: T(opened(sc.index) + 2000),
      choiceIndex: ok ? facit[sc.index].answerIndex : (facit[sc.index].answerIndex + 1) % 4,
    });
  }
}
await b.commit();
if (lage === "final") {
  const fin = { ...s, status: "finished", finishedAt: T(NOW) };
  const result = buildResult(fin, [], players, null, { scores, questions });
  await ref.update({ status: "finished", finishedAt: T(NOW), result: { ...result, computedAt: T(NOW) } });
}
const tot = Object.fromEntries(UIDS.map((u) => [u, poang[u].reduce((a, c) => a + c, 0)]));
console.log(sid, JSON.stringify(Object.entries(tot).sort((x, y) => y[1] - x[1]).map(([u, p]) => `${u}:${namn[u]}:${p}`)));
process.exit(0);
