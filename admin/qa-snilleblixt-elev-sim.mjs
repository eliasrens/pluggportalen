// ============================================================================
// Snilleblixten elevvy (#558) – QA-simulator, BARA mot emulatorn. Fyller en
// session med låtsaselever (spelardokument) och låter dem svara på pågående
// fråga, så elevskärmen kan provas med "24 elever" (test 4) och placering.
// Skrivs med admin-SDK i SAMMA form som klienten (snilleblixt-flode.js
// planAnswer, at = serverns tid). Kör tillsammans med
// admin/qa-snilleblixt-preview.sh (samma emulator-variabler).
//
//   node admin/qa-snilleblixt-elev-sim.mjs join   <sid> <antal>   (b02… / e01…)
//   node admin/qa-snilleblixt-elev-sim.mjs answer <sid> [rätt-andel 0–1]
//   node admin/qa-snilleblixt-elev-sim.mjs show   <sid>          (q + svar)
//   node admin/qa-snilleblixt-elev-sim.mjs utoka  <sid> <antal>  lobby → fler frågor
//     (multiplikation, flerval) än formuläret erbjuder – 20i kräver 42 rätt
//   node admin/qa-snilleblixt-elev-sim.mjs autoplay <sid> [b01-fel]  (test 20i)
//     spelar resten av frågorna som lärare (planStep/scoreQuestion – samma
//     planer som appen): första låtsaseleven svarar alltid rätt FÖRST, b01
//     rätt NÄST (utom de sista [b01-fel] frågorna), övriga ~40 % rätt.
//     Läraren avslutar sedan i appen → result + pluggmynt (live-feed).
// ============================================================================
import admin from "firebase-admin";
import { planStep } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { FieldValue } = admin.firestore;
const [cmd, sid, arg] = process.argv.slice(2);
const sess = db.doc(`liveSessions/${sid}`);

async function students(classIds) {
  const out = [];
  for (const cid of classIds) {
    const c = (await db.doc(`classes/${cid}`).get()).data();
    for (const uid of c?.studentIds || []) out.push({ uid, classId: cid });
  }
  return out;
}

if (cmd === "join") {
  const s = (await sess.get()).data();
  const all = (await students(s.participatingClassIds)).filter((p) => p.uid !== "b01");
  const pick = all.slice(0, Number(arg) || 23);
  const b = db.batch();
  for (const p of pick) {
    const name = (await db.doc(`students/${p.uid}`).get()).data()?.namn || p.uid;
    b.set(db.doc(`liveSessions/${sid}/players/${p.uid}`), {
      uid: p.uid, classId: p.classId, name, joinedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(), correct: 0, incorrect: 0,
    });
  }
  await b.commit();
  console.log(`${pick.length} låtsaselever anslutna`);
} else if (cmd === "answer") {
  const s = (await sess.get()).data();
  const q = s.q;
  if (q?.phase !== "open") throw new Error("ingen öppen fråga");
  const facit = (await db.doc(`liveSessions/${sid}/sbPrivate/snapshot`).get()).data().facit[q.index];
  const share = arg == null ? 0.6 : Number(arg);
  const players = (await db.collection(`liveSessions/${sid}/players`).get()).docs.map((d) => d.data())
    .filter((p) => p.uid !== "b01" && p.joinedAt.toMillis() < q.openedAt.toMillis());
  let n = 0;
  for (const p of players) {
    const ref = db.doc(`liveSessions/${sid}/sbAnswers/${q.index}_${p.uid}`);
    if ((await ref.get()).exists) continue;
    const right = Math.random() < share;
    const data = { uid: p.uid, classId: p.classId, q: q.index, answerKind: s.answerKind, at: FieldValue.serverTimestamp() };
    if (s.answerKind === "choice") data.choiceIndex = right ? facit.answerIndex : (facit.answerIndex + 1 + (n % 3)) % 4;
    else data.answer = right ? String(facit.correctAnswer) : String(Number(facit.correctAnswer) + (n % 2 ? 8 : -2));
    await ref.create(data);
    n++;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  console.log(`${n} svar på fråga ${q.index + 1}`);
} else if (cmd === "utoka") {
  const { requireGameMode } = await import("../src/live/modes/index.js");
  const { buildSnapshot } = await import("../src/live/formats/snilleblixt/snilleblixt-core.js");
  const n = Number(arg) || 50;
  const snap = buildSnapshot(requireGameMode("multiplication_0_10"), { answerKind: "choice", count: n, shuffle: true });
  await db.doc(`liveSessions/${sid}/sbPrivate/snapshot`).set(snap);
  await sess.update({ questionCount: n });
  console.log(`${n} frågor`);
} else if (cmd === "autoplay") {
  const fv = { serverTimestamp: () => FieldValue.serverTimestamp() };
  const snapshot = (await db.doc(`liveSessions/${sid}/sbPrivate/snapshot`).get()).data();
  const wrongTail = arg == null ? 8 : Number(arg);
  const step = (action, fromIndex) => db.runTransaction(async (tx) => {
    const s = (await tx.get(sess)).data();
    const answers = action === "reveal"
      ? (await db.collection(`liveSessions/${sid}/sbAnswers`).where("q", "==", fromIndex).get()).docs.map((d) => d.data())
      : [];
    const plan = planStep(s, action, { fromIndex, snapshot, answers, fv });
    if (plan.noop) return plan.noop;
    tx.update(sess, plan.patch);
    if (plan.scores) tx.set(db.doc(`liveSessions/${sid}/sbScores/${plan.scores.index}`), plan.scores);
    return "ok";
  });
  let s = (await sess.get()).data();
  const players = (await db.collection(`liveSessions/${sid}/players`).get()).docs.map((d) => d.data());
  const sims = players.filter((p) => p.uid !== "b01");
  const b01 = players.find((p) => p.uid === "b01");
  for (;;) {
    s = (await sess.get()).data();
    const cur = s.q ? s.q.index : -1;
    if (s.q && s.q.phase === "open") await step("close", cur);
    if (s.q && ["open", "closed"].includes(s.q.phase)) { await step("reveal", cur); continue; }
    if (cur + 1 >= s.questionCount) break;
    await step("open", cur);
    const i = cur + 1;
    const f = snapshot.facit[i];
    const write = (p, right) => db.doc(`liveSessions/${sid}/sbAnswers/${i}_${p.uid}`).create({
      uid: p.uid, classId: p.classId, q: i, answerKind: s.answerKind, at: FieldValue.serverTimestamp(),
      ...(s.answerKind === "choice" ? { choiceIndex: right ? f.answerIndex : (f.answerIndex + 1) % 4 }
        : { answer: right ? String(f.correctAnswer) : "999" }),
    });
    await write(sims[0], true);
    if (b01) await write(b01, i < s.questionCount - wrongTail);
    await Promise.all(sims.slice(1).map((p) => write(p, Math.random() < 0.4)));
    await step("close", i);
    await step("reveal", i);
  }
  console.log(`klart: ${s.questionCount} frågor avslöjade – avsluta i appen`);
} else if (cmd === "show") {
  const s = (await sess.get()).data();
  const ans = await db.collection(`liveSessions/${sid}/sbAnswers`).where("q", "==", s.q?.index ?? -1).get();
  console.log(JSON.stringify({ status: s.status, q: s.q && { ...s.q, openedAt: s.q.openedAt?.toMillis() }, svar: ans.size }, null, 1));
} else {
  console.error("okänt kommando");
  process.exit(1);
}
