#!/usr/bin/env node
// ============================================================================
// Bråkresan – spela riktiga omgångar mot EMULATORN (#717 slut-QA, epic #705).
// ----------------------------------------------------------------------------
// Loggar in som eleven (Auth-emulatorn) och anropar brakresa*-callables exakt
// som klienten. Facit läses med admin-SDK ur brakresaSecrets (bara emulator)
// och svaren tas ur uppgiftens key.examples (rätt resp. fel). Efter varje
// omgång kontrolleras utfallet: rätt antal, belöning, mynt, stjärnor, drake.
//
//   node admin/qa-brakresan-spela.mjs <uid> <plan> [<plan> …]
//     plan = NN=r1,r2,…   en omgång per tal (antal rätt 0–10), t.ex. 03=10,7,8
//            all=r1,r2,…  samma sak för alla 50 utmaningar
//            NN=abort     starta och avbryt (med 4 besvarade)
//   --json FIL            skriv alla omgångar + ögonblicksbilder som JSON
//   --lamna N            sista omgången: svara N och lämna den aktiv (10 = resultatet
//                        visas när eleven öppnar utmaningen; 5 = återupptagning)
//
// Miljö (qa-brakresan-preview.sh-portarna): FIRESTORE_EMULATOR_HOST,
// FIREBASE_AUTH_EMULATOR_HOST, FUNCTIONS_EMULATOR_HOST. Lösenord lilla123.
// ============================================================================
import { writeFileSync } from "node:fs";
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { CHALLENGE_IDS } from "../src/brakresan/schema/katalog.js";
import { roundReward, dragonLevel, COINS_PER_STAR, ENCOURAGE_COINS } from "../src/brakresan/schema/regler.js";

const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8719";
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9719";
const FN = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5719";
process.env.FIRESTORE_EMULATOR_HOST = FS;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const jsonOut = flag("--json");
const lamna = flag("--lamna");
const halv = lamna !== null;
const [uid, ...planArgs] = args;
if (!uid || !planArgs.length) { console.error("användning: <uid> NN=10,8 … | all=10"); process.exit(2); }

const adb = admin.initializeApp({ projectId: PROJECT }).firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN.split(":")[0], Number(FN.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name, { timeout: 120000 })(d).then((r) => r.data);
await signInWithEmailAndPassword(auth, `${uid}@elev.pluggportalen.local`, "lilla123");

const jobs = [];
for (const p of planArgs) {
  const [nn, spec] = p.split("=");
  const ids = nn === "all" ? CHALLENGE_IDS : [nn.padStart(2, "0")];
  for (const id of ids) for (const r of spec.split(",")) jobs.push({ id, r: r === "abort" ? "abort" : Number(r) });
}

const state = async () => (await adb.doc(`studentData/${uid}/brakresa/state`).get()).data() || {};
const sd = async () => (await adb.doc(`studentData/${uid}`).get()).data() || {};
const fel = [];
const log = [];
const check = (ok, msg) => { if (!ok) { fel.push(msg); console.log("  ❌ " + msg); } };

for (let j = 0; j < jobs.length; j++) {
  const { id, r } = jobs[j];
  const last = j === jobs.length - 1;
  const before = await state();
  const coinsBefore = (await sd()).coins || 0;
  const entry = before.challenges?.[id] || {};
  const start = await call("brakresaStartRound", entry.activeRoundId ? { challengeId: id, restart: true, replaceRoundId: entry.activeRoundId } : { challengeId: id });
  const { roundId, round } = start;
  check(round.tasks?.length === 10, `${id}: ${round.tasks?.length} uppgifter (≠ 10)`);
  check(!JSON.stringify(round.tasks).includes('"key"'), `${id}: publika uppgifter innehåller key`);
  const secret = (await adb.doc(`brakresaSecrets/${roundId}`).get()).data();
  const n = r === "abort" ? 4 : halv && last ? Number(lamna) : 10;
  let correct = 0;
  for (let i = 0; i < n; i++) {
    const want = r !== "abort" && i < r;
    const t = secret.tasks[i];
    const answer = want ? t.key.examples.right[0] : t.key.examples.wrong[0];
    const g = await call("brakresaAnswer", { roundId, index: i, answer, helpBefore: [] });
    check(g.status === "graded" && g.correct === want, `${id} uppg ${i + 1} (${t.answer.type}): väntat ${want ? "rätt" : "fel"}, fick ${g.status}/${g.correct}`);
    if (g.correct) correct++;
    // Första svaret är låst: ett nytt svar ändrar inget.
    if (i === 0) {
      const again = await call("brakresaAnswer", { roundId, index: 0, answer: want ? t.key.examples.wrong[0] : t.key.examples.right[0], helpBefore: [] });
      check(again.already === true && again.correct === want, `${id}: första svaret inte låst`);
    }
  }
  if (r === "abort" || (halv && last)) {
    if (r === "abort") {
      await call("brakresaAbortRound", { roundId });
      const st = await state();
      check((st.challenges?.[id]?.stars || 0) === (entry.stars || 0) && ((await sd()).coins || 0) === coinsBefore, `${id}: avbruten omgång ändrade stjärnor/mynt`);
    }
    log.push({ id, r, roundId, correct });
    console.log(`${id} ${r === "abort" ? "avbruten" : "lämnad aktiv"} (${n} besvarade, ${correct} rätt) ${roundId}`);
    continue;
  }
  const res = await call("brakresaFinishRound", { roundId });
  const again = await call("brakresaFinishRound", { roundId });
  const after = await state();
  const sdAfter = await sd();
  const coinsAfter = sdAfter.coins || 0;
  const lvl = dragonLevel(after.totalStars || 0);
  const want = roundReward({ correct: r, starsBefore: entry.stars || 0, encouragementPaid: !!entry.encouragementPaid });
  check(res.correctCount === r, `${id}: correctCount ${res.correctCount} ≠ ${r}`);
  check(res.reward.kind === want.kind && res.reward.coins === want.coins, `${id}: belöning ${res.reward.kind}/${res.reward.coins} ≠ ${want.kind}/${want.coins}`);
  check(coinsAfter - coinsBefore === want.coins, `${id}: saldot ändrades ${coinsAfter - coinsBefore} ≠ ${want.coins}`);
  check(again.already === true && again.reward.coins === res.reward.coins, `${id}: andra finishRound inte idempotent`);
  check((after.totalStars || 0) === (before.totalStars || 0) + (want.kind === "stjarna" ? 1 : 0), `${id}: totalStars ${after.totalStars}`);
  // Nivån härleds ur totalStars; huset läser studentData.brakdrake.level. Draken (id, namn) skapas en gång.
  check(lvl === 0 ? !after.dragon : (sdAfter.brakdrake?.level === lvl && after.dragon?.id === sdAfter.brakdrake?.id), `${id}: drake ${JSON.stringify(sdAfter.brakdrake)} ≠ nivå ${lvl}`);
  check(!before.dragon || (after.dragon?.id === before.dragon.id && after.dragon?.name === before.dragon.name), `${id}: drakens id/namn ändrades`);
  check(res.dragon?.levelAfter === lvl, `${id}: svarets dragon.levelAfter ${res.dragon?.levelAfter} ≠ ${lvl}`);
  const rec = { id, r, roundId, reward: res.reward, coins: coinsAfter, totalStars: after.totalStars, dragon: sdAfter.brakdrake || null, hatched: res.dragon?.hatched };
  log.push(rec);
  console.log(`${id} ${r}/10 → ${res.reward.kind} +${res.reward.coins} · saldo ${coinsAfter} · ★${after.totalStars} · drake ${after.dragon ? lvl + " " + after.dragon.name : "ägg"}${res.dragon?.hatched ? " (kläckt)" : ""}`);
}

const st = await state();
const s = await sd();
const rewards = await adb.collection(`studentData/${uid}/brakresaRewards`).get();
const sum = (k) => rewards.docs.filter((d) => d.id.startsWith(k)).reduce((a, d) => a + (d.data().coins || d.data().amount || 0), 0);
const slut = {
  uid, totalStars: st.totalStars, mastered: st.mastered, dragon: st.dragon, brakdrake: s.brakdrake, coins: s.coins,
  rewardDocs: rewards.size, starCoins: sum("stjarna-"), encouragementCoins: sum("uppmuntran-"), huntCoins: sum("jakt-"),
};
console.log(JSON.stringify(slut, null, 1));
console.log(fel.length ? `❌ ${fel.length} fel` : `✓ ${log.length} omgångar utan fel (stjärna = ${COINS_PER_STAR}, uppmuntran = ${ENCOURAGE_COINS})`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ log, slut, fel }, null, 1));
process.exit(fel.length ? 1 : 0);
