// ============================================================================
// QA för Guldrushens ELEVVY (#564) – BARA mot emulatorerna. Kör efter
// admin/qa-guldrush-preview.sh (+ gärna qa-snilleblixt-slut-seed.mjs för
// avatarer med kläder). Styr matchen runt eleven b01 (4B, lilla123) GENOM
// SERVERKÄRNAN (functions/guldrush-core.js) – ingen genväg förbi reglerna för
// guldet, bara "tvinga fram en stöld" skriver ett pending-fält först.
//
//   start [free|choice|quiz]  ny pågående match qa-gr-elev (10 min): b02–b20
//                             har spelat en stund (guld, sköldar, stöldskydd);
//                             b01 har inte gått med (sen anslutning)
//   stjal [offer]             en klasskamrat knycker från b01 (notisen)
//   offer [steal|swap]        b01 får en Stöld/Byte att välja offer för
//   tvaa                      b01 = 2:a med 42 rätt, matchen avslutas (test 20i;
//                             lärarens historik skriver result + betalar ut)
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8568 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9568 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-guldrush-elev.mjs start
// ============================================================================
import admin from "firebase-admin";
import { answerQuestion, openChest, chooseVictim } from "../functions/guldrush-core.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { FieldValue, Timestamp } = admin.firestore;
const deps = { db, FieldValue, Timestamp };
const SID = "qa-gr-elev";
const ME = "b01";
const ref = db.doc(`liveSessions/${SID}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const attempt = () => `qa564-${Date.now().toString(36)}-${(n++).toString(36)}`;

const QUIZ = [
  { id: "q1", text: "Vilken är Sveriges huvudstad?", options: ["Göteborg", "Stockholm", "Malmö", "Uppsala"], a: 1 },
  { id: "q2", text: "Vilket djur är störst?", options: ["Älg", "Räv", "Hare", "Grävling"], a: 0 },
  { id: "q3", text: "Hur många dagar har en vecka?", options: ["5", "6", "7", "8"], a: 2 },
  { id: "q4", text: "Vilken färg får man av blått och gult?", options: ["Lila", "Orange", "Brun", "Grön"], a: 3 },
  { id: "q5", text: "Vad heter Sveriges längsta flod?", options: ["Klarälven", "Dalälven", "Torne älv", "Ljusnan"], a: 0 },
];

async function play(uid, rounds, mode) {
  for (let r = 0; r < rounds; r++) {
    const id = attempt();
    const a = 2 + ((n * 3) % 8);
    const b = 3 + ((n * 5) % 7);
    let res;
    if (mode === "quiz") {
      const g = (await ref.collection("grPlayers").doc(uid).get()).data();
      const q = g?.nextQ ?? 0;
      res = await answerQuestion(deps, uid, { sid: SID, attemptId: id, q, choiceIndex: QUIZ[q].a });
    } else {
      res = await answerQuestion(deps, uid, { sid: SID, attemptId: id, factorA: a, factorB: b, answer: a * b, ...(mode === "choice" ? { choiceIndex: 0 } : {}) });
    }
    if (!res.correct) continue;
    const c = await openChest(deps, uid, { sid: SID, attemptId: id, chestIndex: 1 }).catch(() => null);
    if (c?.pending) await chooseVictim(deps, uid, { sid: SID, victimUid: null }).catch(() => null);
  }
}

async function start(mode = "free") {
  const cls = (await db.doc("classes/4b").get()).data();
  if (!cls) throw new Error("Kör admin/qa-guldrush-preview.sh först.");
  await db.recursiveDelete(ref);
  const now = Date.now();
  const s = {
    name: `Guldrushen 4B (QA elevvy, ${mode})`, format: "guldrush",
    gameMode: mode === "quiz" ? "plugga_quiz" : "multiplication_0_10", answerKind: mode === "free" ? "free" : "choice",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", stealSwap: true, showNames: true, createdBy: "qa", createdByName: "QA",
    createdAt: Timestamp.fromMillis(now - 60_000), startedAt: Timestamp.fromMillis(now - 6_000),
    endsAt: Timestamp.fromMillis(now - 6_000 + 604_000),
    rewards: { firstPrize: 300, perCorrect: 5, cap: 300 },
    ...(mode === "quiz" ? { questionCount: QUIZ.length, quiz: { subjectId: "qa", areaId: "qa" } } : {}),
  };
  await ref.set(s);
  if (mode === "quiz") {
    await ref.collection("grPublic").doc("questions").set({ questions: QUIZ.map(({ id, text, options }) => ({ id, key: id, text, options, statKeys: [`q:${id}`] })) });
    await ref.collection("grPrivate").doc("snapshot").set({ facit: QUIZ.map((q) => ({ answerIndex: q.a })) });
  }
  const others = cls.studentIds.filter((u) => u !== ME);
  for (const uid of others) {
    const name = (await db.doc(`students/${uid}`).get()).get("namn") || uid;
    await ref.collection("players").doc(uid).set({ uid, classId: "4b", name, joinedAt: s.startedAt, lastSeenAt: Timestamp.now(), correct: 0, incorrect: 0 });
  }
  // Några varv kistor, olika många per elev (minst 1 s mellan två kistor per elev).
  for (let r = 0; r < 6; r++) {
    for (const [i, uid] of others.entries()) if (r < 1 + (i % 6)) await play(uid, 1, mode);
    await sleep(1100);
  }
  const gp = (await ref.collection("grPlayers").get()).docs.map((d) => d.data());
  console.log(`✓ ${SID} (${mode}) pågår 10 min: ${gp.length} klasskamrater med guld (${gp.map((p) => p.gold).sort((a, b) => b - a).join(", ")}); ` +
    `${gp.filter((p) => p.shield).length} med sköld. Logga in som b01 / lilla123 → #/elev/live`);
}

/** Tvinga fram en Stöld/Byte för `uid` (servern avgör sedan i chooseVictim). */
async function forcePending(uid, kind) {
  const t = Date.now();
  await ref.collection("grPlayers").doc(uid).set({
    uid, classId: "4b", pending: { kind, chest: kind === "swap" ? "byte" : "stold", attemptId: attempt(), at: Timestamp.fromMillis(t), expiresAt: Timestamp.fromMillis(t + 10_000) },
  }, { merge: true });
}

async function stjal() {
  const gp = (await ref.collection("grPlayers").get()).docs.map((d) => d.data()).filter((p) => p.uid !== ME && !p.pending);
  const me = (await ref.collection("grPlayers").doc(ME).get()).data();
  if (!me?.gold) throw new Error("b01 har inget guld än – öppna några kistor först.");
  const thief = gp.find((p) => p.lastVictimUid !== ME) || gp[0];
  await forcePending(thief.uid, "steal");
  const r = await chooseVictim(deps, thief.uid, { sid: SID, victimUid: ME });
  console.log(`✓ ${thief.name} → b01: ${r.result} ${r.amount} guld`);
}

async function tvaa() {
  const gp = (await ref.collection("grPlayers").get()).docs.map((d) => d.data());
  const top = Math.max(...gp.filter((p) => p.uid !== ME).map((p) => p.gold || 0));
  const second = gp.filter((p) => p.uid !== ME && p.gold === top)[0];
  // Testriggen (bara emulatorn): b01 strax under ettan, 42 rätt.
  await ref.collection("grPlayers").doc(ME).set({ uid: ME, classId: "4b", name: "b01", gold: Math.max(1, top - 7), correct: 42, incorrect: 3, pending: null }, { merge: true });
  await ref.update({ status: "finished", finishedAt: FieldValue.serverTimestamp() });
  console.log(`✓ matchen slut: ettan ${second?.name} ${top} guld, b01 ${top - 7} guld (2:a) med 42 rätt → öppna lärarens Live-historik så skrivs result + pluggmynt`);
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "start") await start(arg || "free");
  else if (cmd === "stjal") await stjal();
  else if (cmd === "offer") { await forcePending(ME, arg === "swap" ? "swap" : "steal"); console.log(`✓ b01 väljer offer (${arg || "steal"})`); }
  else if (cmd === "tvaa") await tvaa();
  else console.log("start [free|choice|quiz] | stjal | offer [steal|swap] | tvaa");
} catch (e) {
  console.error(e.message || e);
  process.exitCode = 1;
}
await app.delete();
