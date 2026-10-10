// ============================================================================
// QA-seed för Guldrushen (#563) – BARA mot Firebase-emulatorerna. Kör efter
// admin/qa-mm-live-seed.mjs (lärare elias/rasmus, 4B b01–b20, lilla123).
//
// Spelar en hel Guldrush-match i 4B GENOM SERVERKÄRNAN (functions/
// guldrush-core.js – samma kod som Cloud Functionen) med simulerad klocka:
// eleverna svarar, öppnar kistor, knycker och byter. Sedan avslutas matchen
// och result skrivs (buildResult) → lärarens Live-historik visar Guldrushen
// med topplista och klassens totala guld. Händelseflödet (grEvents) och
// guldet (grPlayers) ligger kvar att titta på i emulatorn.
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-guldrush-seed.mjs
// ============================================================================
import admin from "firebase-admin";
import { answerQuestion, openChest, chooseVictim } from "../functions/guldrush-core.js";
import { eligibleVictims } from "../src/live/formats/guldrush/delat/guldrush-regler.js";
import { buildResult } from "../src/live/formats/guldrush/guldrush-core.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { FieldValue, Timestamp } = admin.firestore;

let seed = 563;
const rng = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let clock = 0;
const deps = { db, FieldValue, Timestamp, now: () => clock, rng };

const SID = "qa-guldrush-4b";
const START = Date.now() - 15 * 60_000;
const T0 = START + 4_000;
const END = T0 + 5 * 60_000;

async function main() {
  const cls = (await db.doc("classes/4b").get()).data();
  if (!cls) throw new Error("Kör admin/qa-mm-live-seed.mjs först (klass 4b saknas).");
  const elever = cls.studentIds;
  const ref = db.doc(`liveSessions/${SID}`);
  await db.recursiveDelete(ref);
  const s = {
    name: "Guldrushen 4B (QA)", format: "guldrush", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 300, countdownSeconds: 4,
    status: "live", stealSwap: true, showNames: true, createdBy: "qa", createdByName: "QA",
    createdAt: Timestamp.fromMillis(START - 60_000), startedAt: Timestamp.fromMillis(START),
    rewards: { firstPrize: 300, perCorrect: 2, cap: 200 },
  };
  await ref.set(s);
  const players = [];
  for (const uid of elever) {
    const name = (await db.doc(`students/${uid}`).get()).get("namn") || uid;
    const p = { uid, classId: "4b", name, joinedAt: s.startedAt, lastSeenAt: s.startedAt, correct: 0, incorrect: 0 };
    await ref.collection("players").doc(uid).set(p);
    players.push(p);
  }
  let n = 0;
  const stats = { svar: 0, kistor: 0, stold: 0 };
  for (clock = T0 + 2_000; clock < END - 2_000; clock += 1_500) {
    const uid = elever[Math.floor(rng() * elever.length)];
    const a = 1 + Math.floor(rng() * 10);
    const b = 1 + Math.floor(rng() * 10);
    const attemptId = `qa-${(n++).toString().padStart(6, "0")}`;
    const r = await answerQuestion(deps, uid, { sid: SID, attemptId, factorA: a, factorB: b, answer: rng() < 0.8 ? a * b : a * b + 1 });
    stats.svar++;
    if (!r.correct) continue;
    const c = await openChest(deps, uid, { sid: SID, attemptId, chestIndex: Math.floor(rng() * 3) }).catch(() => null);
    if (!c) continue;
    stats.kistor++;
    if (!c.pending) continue;
    const me = (await ref.collection("grPlayers").doc(uid).get()).data();
    const all = (await ref.collection("grPlayers").get()).docs.map((d) => d.data());
    const list = eligibleVictims(c.pending.kind, me, all, clock);
    const pick = list.length && rng() < 0.7 ? list[Math.floor(rng() * list.length)].uid : null;
    const v = await chooseVictim(deps, uid, { sid: SID, victimUid: pick }).catch((e) => console.warn(e.message));
    if (v && v.result !== "fallback") stats.stold++;
  }
  await ref.update({ status: "finished", finishedAt: Timestamp.fromMillis(END) });
  const grPlayers = (await ref.collection("grPlayers").get()).docs.map((d) => ({ uid: d.id, ...d.data() }));
  const result = buildResult(s, null, players, null, { grPlayers });
  await ref.update({ result: { ...result, computedAt: FieldValue.serverTimestamp() } });
  const ev = (await ref.collection("grEvents").count().get()).data().count;
  console.log(`Guldrushen ${SID}: ${stats.svar} svar, ${stats.kistor} kistor, ${stats.stold} stölder/byten, ${ev} händelser, ` +
    `klassens guld ${result.totalGold}, etta ${result.ranking[0]?.name} (${result.ranking[0]?.gold}).`);
  await app.delete();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
