// ============================================================================
// QA för Datakuppens ELEVVY (#653) – BARA mot emulatorerna. Kör efter
// admin/qa-guldrush-preview.sh (samma seed: lärare elias, 4B b01–b20,
// lilla123). Styr matchen runt eleven b01 GENOM SERVERKÄRNAN
// (functions/datakuppen-core.js) – ingen genväg förbi reglerna för data och
// koder; bara "ge b01 ett Hack" skriver ett pending-fält först (testrigg).
//
//   lobby [free|choice]  ny match qa-dk-elev i LOBBYN: b02–b20 har gått med
//                        och valt kod; b01 går med själv (fyra kodförslag)
//   start                lobbyn → pågående (10 min); klasskamraterna spelar
//                        en stund (data, brandväggar, några hack)
//   hack [igen]          b01 får ett Hack (målväljaren öppnas); igen = samma mål
//                        som förra gången får väljas (minnesmomentet, test 7)
//   hackad               en klasskamrat knäcker b01:s kod (notis + Välj ny kod)
//   skydd <s>            de tre rikaste klasskamraterna skyddas s sekunder
//   slut                 matchen avslutas
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8568 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9568 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-datakuppen-elev.mjs lobby
// ============================================================================
import admin from "firebase-admin";
import { answerQuestion, openFile, pickCode, chooseTarget, guessCode } from "../functions/datakuppen-core.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { FieldValue, Timestamp } = admin.firestore;
const deps = { db, FieldValue, Timestamp };
const SID = "qa-dk-elev";
const ME = "b01";
const ref = db.doc(`liveSessions/${SID}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const attempt = () => `qa653-${Date.now().toString(36)}-${(n++).toString(36)}`;
const others = async () => (await db.doc("classes/4b").get()).get("studentIds").filter((u) => u !== ME);
const dk = async (uid) => (await ref.collection("dkPlayers").doc(uid).get()).data();

async function lobby(kind = "free") {
  const cls = (await db.doc("classes/4b").get()).data();
  if (!cls) throw new Error("Kör admin/qa-guldrush-preview.sh först.");
  await db.recursiveDelete(ref);
  const now = Date.now();
  await ref.set({
    name: "Datakuppen 4B (QA elevvy)", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: kind,
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 600, countdownSeconds: 4,
    status: "lobby", hacking: true, showNames: true, createdBy: "qa", createdByName: "QA",
    createdAt: Timestamp.fromMillis(now), rewards: { firstPrize: 300, perCorrect: 5, cap: 300 },
  });
  for (const uid of await others()) {
    const name = (await db.doc(`students/${uid}`).get()).get("namn") || uid;
    await ref.collection("players").doc(uid).set({ uid, classId: "4b", name, joinedAt: Timestamp.now(), lastSeenAt: Timestamp.now(), correct: 0, incorrect: 0 });
    await pickCode(deps, uid, { sid: SID });
    await pickCode(deps, uid, { sid: SID, index: Math.floor(Math.random() * 4) });
  }
  console.log(`✓ ${SID} i lobbyn (${kind}). Logga in som b01 / lilla123 → #/elev/live och välj kod.`);
}

async function play(uid) {
  const id = attempt();
  const a = 2 + (n % 8);
  const b = 3 + ((n * 5) % 7);
  const res = await answerQuestion(deps, uid, { sid: SID, attemptId: id, factorA: a, factorB: b, answer: a * b });
  if (!res.correct) return;
  const f = await openFile(deps, uid, { sid: SID, attemptId: id, fileIndex: 1 }).catch(() => null);
  if (!f?.pending) return;
  const t = await chooseTarget(deps, uid, { sid: SID, targetUid: null }).catch(() => null);
  if (t?.result === "target") await guessCode(deps, uid, { sid: SID, index: 0 }).catch(() => null);
}

async function start() {
  const t = Date.now();
  await ref.update({ status: "live", startedAt: Timestamp.fromMillis(t - 4_000), endsAt: Timestamp.fromMillis(t + 600_000) });
  const list = await others();
  for (let r = 0; r < 5; r++) {
    for (const [i, uid] of list.entries()) if (r < 1 + (i % 5)) await play(uid);
    await sleep(1100);
  }
  const gp = (await ref.collection("dkPlayers").get()).docs.map((d) => d.data());
  console.log(`✓ ${SID} pågår: ${gp.length} spelare med data (${gp.map((p) => p.gold).sort((x, y) => y - x).join(", ")})`);
}

/** Testrigg: b01:s nästa steg är ett Hack (servern avgör sedan mål och koder). */
async function hack(igen = false) {
  const t = Date.now();
  const name = (await ref.collection("players").doc(ME).get()).get("name") || ME;
  await ref.collection("dkPlayers").doc(ME).set({
    uid: ME, classId: "4b", name, ...(igen ? { lastVictimUid: null } : {}),
    pending: { kind: "steal", chest: "hack", attemptId: attempt(), at: Timestamp.fromMillis(t), expiresAt: Timestamp.fromMillis(t + 10_000) },
  }, { merge: true });
  console.log("✓ b01 har ett Hack – målväljaren öppnas");
}

/** En klasskamrat knäcker b01:s kod – rätt kod läses ur dkSecret (bara servern/riggen kan det). */
async function hackad() {
  const me = await dk(ME);
  if (!me?.gold) throw new Error("b01 har ingen data än – öppna några filer först.");
  const list = (await ref.collection("dkPlayers").get()).docs.map((d) => d.data())
    .filter((p) => p.uid !== ME && !p.pending && p.lastVictimUid !== ME);
  const hacker = list[0];
  const t = Date.now();
  await ref.collection("dkPlayers").doc(hacker.uid).set({
    pending: { kind: "steal", chest: "hack", attemptId: attempt(), at: Timestamp.fromMillis(t), expiresAt: Timestamp.fromMillis(t + 10_000) },
  }, { merge: true });
  await ref.collection("dkPlayers").doc(ME).set({ protectedUntil: null }, { merge: true });
  const c = await chooseTarget(deps, hacker.uid, { sid: SID, targetUid: ME });
  const right = (await ref.collection("dkSecret").doc(ME).get()).get("code");
  const r = await guessCode(deps, hacker.uid, { sid: SID, index: c.options.indexOf(right), targetUid: ME });
  console.log(`✓ ${hacker.name} hackade b01: ${r.result} ${r.amount ?? ""} MB`);
}

async function skydd(sek = 30) {
  const gp = (await ref.collection("dkPlayers").get()).docs.map((d) => d.data()).filter((p) => p.uid !== ME)
    .sort((a, b) => (b.gold || 0) - (a.gold || 0)).slice(0, 3);
  for (const p of gp) await ref.collection("dkPlayers").doc(p.uid).set({ protectedUntil: Timestamp.fromMillis(Date.now() + sek * 1000) }, { merge: true });
  console.log(`✓ skyddade ${sek} s: ${gp.map((p) => p.name).join(", ")}`);
}

async function slut() {
  await ref.update({ status: "finished", finishedAt: FieldValue.serverTimestamp() });
  console.log("✓ matchen slut");
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "lobby") await lobby(arg || "free");
  else if (cmd === "start") await start();
  else if (cmd === "hack") await hack(arg === "igen");
  else if (cmd === "hackad") await hackad();
  else if (cmd === "skydd") await skydd(Number(arg) || 30);
  else if (cmd === "slut") await slut();
  else console.log("Kommandon: lobby [free|choice] · start · hack [igen] · hackad · skydd <s> · slut");
} finally {
  await app.delete();
}
