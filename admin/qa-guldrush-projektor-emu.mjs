// ============================================================================
// QA för Guldrushens PROJEKTOR (#565) – BARA mot emulatorerna. Kör efter
// admin/qa-guldrush-preview.sh (+ qa-snilleblixt-slut-seed.mjs för avatarer
// med kläder i 4B och 5E). Matchen spelas GENOM SERVERKÄRNAN
// (functions/guldrush-core.js) – samma kod som Cloud Functionen – så
// projektorn får riktiga grPlayers/grEvents att visa.
//
//   start [sek] [5e]  ny pågående match qa-gr-proj (4B, ev. + 5E), sek =
//                     speltid (standard 600); eleverna har spelat en stund
//   lobby             samma match i lobbyn (ej startad), alla elever anslutna
//   stold             TEST 15: Alma (b02) har exakt 100 guld, Omar (b03) får
//                     Stöld och väljer Alma → 85 / +15 i samma transaktion,
//                     händelsen i grEvents
//   storm             DESIGNTEST 7: alla elever svarar + öppnar kistor samtidigt
//   slut              TEST 20: tiden ute nu → ett nytt svar ska nekas; lärarens
//                     projektor avslutar matchen och skriver result
//   kolla             skriver ut status, result (totalGold/classGold) och topp 3
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8568 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9568 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-guldrush-projektor-emu.mjs start
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
const SID = "qa-gr-proj";
const ref = db.doc(`liveSessions/${SID}`);
const gpRef = (uid) => ref.collection("grPlayers").doc(uid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const attempt = () => `qa565-${Date.now().toString(36)}-${(n++).toString(36)}`;

/** En elev svarar (rätt med sannolikhet ok) och öppnar ev. kistan; stöld/byte → servern slumpar offer. */
async function play(uid, ok = true) {
  const id = attempt();
  const a = 2 + ((n * 3) % 8);
  const b = 3 + ((n * 5) % 7);
  const res = await answerQuestion(deps, uid, { sid: SID, attemptId: id, factorA: a, factorB: b, answer: ok ? a * b : a * b + 1 });
  if (!res.correct) return null;
  const c = await openChest(deps, uid, { sid: SID, attemptId: id, chestIndex: n % 3 }).catch(() => null);
  if (c?.pending) await chooseVictim(deps, uid, { sid: SID, victimUid: null }).catch(() => null);
  return c;
}

async function classes(two) {
  const ids = two ? ["4b", "5e"] : ["4b"];
  const out = [];
  for (const cid of ids) {
    const c = (await db.doc(`classes/${cid}`).get()).data();
    if (!c) throw new Error("Kör admin/qa-guldrush-preview.sh först.");
    for (const uid of c.studentIds) out.push({ uid, classId: cid, name: (await db.doc(`students/${uid}`).get()).get("namn") || uid });
  }
  return { ids, students: out };
}

async function create({ sek = 600, two = false, live = true } = {}) {
  await db.recursiveDelete(ref);
  const { ids, students } = await classes(two);
  const now = Date.now();
  const s = {
    name: `Guldrushen ${ids.map((c) => c.toUpperCase()).join(" + ")} (QA projektor)`, format: "guldrush",
    gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ids, classNames: { "4b": "4B", "5e": "5E" }, durationSeconds: sek, countdownSeconds: 4,
    status: live ? "live" : "lobby", stealSwap: true, showNames: true, createdBy: "elias", createdByName: "Elias",
    createdAt: Timestamp.fromMillis(now - 60_000),
    ...(live ? { startedAt: Timestamp.fromMillis(now - 6_000), endsAt: Timestamp.fromMillis(now - 6_000 + 4_000 + sek * 1000) } : {}),
    rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
  };
  await ref.set(s);
  for (const p of students) {
    await ref.collection("players").doc(p.uid).set({ ...p, joinedAt: Timestamp.fromMillis(now - 30_000), lastSeenAt: Timestamp.now(), correct: 0, incorrect: 0 });
  }
  return students;
}

async function start(sek, two) {
  const students = await create({ sek: Number(sek) || 600, two });
  for (let r = 0; r < 4; r++) {
    await Promise.all(students.map((p, i) => (r < 1 + (i % 4) ? play(p.uid, (i + r) % 5 !== 0) : null)));
    await sleep(1100);
  }
  const gp = (await ref.collection("grPlayers").get()).docs.map((d) => d.data());
  console.log(`✓ ${SID} pågår: ${gp.length} elever med guld, tillsammans ${gp.reduce((t, p) => t + (p.gold || 0), 0)} guld. Projektorn: #/larare/live?id=${SID}`);
}

async function stold() {
  const [, alma, omar] = (await classes(false)).students;
  // Testriggen (bara emulatorn): Alma exakt 100 guld, ingen sköld/inget skydd; Omar har en Stöld att välja offer för.
  await gpRef(alma.uid).set({ uid: alma.uid, classId: "4b", name: alma.name, gold: 100, shield: false, protectedUntil: null }, { merge: true });
  const omarFore = (await gpRef(omar.uid).get()).data()?.gold || 0;
  const t = Date.now();
  await gpRef(omar.uid).set({
    uid: omar.uid, classId: "4b", name: omar.name, lastVictimUid: null,
    pending: { kind: "steal", chest: "stold", attemptId: attempt(), at: Timestamp.fromMillis(t), expiresAt: Timestamp.fromMillis(t + 10_000) },
  }, { merge: true });
  const r = await chooseVictim(deps, omar.uid, { sid: SID, victimUid: alma.uid });
  const a = (await gpRef(alma.uid).get()).data();
  const o = (await gpRef(omar.uid).get()).data();
  const ev = (await ref.collection("grEvents").orderBy("at", "desc").limit(3).get()).docs.map((d) => d.data()).find((e) => e.type === "steal" && e.victimUid === alma.uid);
  const ok = a.gold === 85 && o.gold === omarFore + 15 && r.amount === 15 && ev?.amount === 15;
  console.log(`${ok ? "✓" : "✗"} TEST 15: ${alma.name} 100 → ${a.gold}, ${omar.name} ${omarFore} → ${o.gold} (+${r.amount}); händelse: ${ev ? `${ev.type} ${ev.name} → ${ev.victimName} ${ev.amount}` : "SAKNAS"}`);
  if (!ok) process.exitCode = 1;
}

async function storm() {
  const players = (await ref.collection("players").get()).docs.map((d) => d.id);
  const t0 = Date.now();
  const res = await Promise.all(players.map((uid) => play(uid, true).catch((e) => ({ fel: e.message }))));
  console.log(`✓ storm: ${players.length} elever, ${res.filter((r) => r && !r.fel).length} kistor öppnade på ${Date.now() - t0} ms`);
}

async function slut() {
  const s = (await ref.get()).data();
  const sek = s.durationSeconds;
  const start = Date.now() - 4_000 - sek * 1000 - 500;
  await ref.update({ startedAt: Timestamp.fromMillis(start), endsAt: Timestamp.fromMillis(start + 4_000 + sek * 1000) });
  const [first] = (await ref.collection("players").limit(1).get()).docs.map((d) => d.id);
  try {
    await answerQuestion(deps, first, { sid: SID, attemptId: attempt(), factorA: 3, factorB: 4, answer: 12 });
    console.log("✗ TEST 20: ett svar efter 00:00 godtogs!");
    process.exitCode = 1;
  } catch (e) {
    console.log(`✓ TEST 20: svar efter 00:00 nekas (${e.code}: ${e.message})`);
  }
}

async function kolla() {
  const s = (await ref.get()).data();
  const r = s.result;
  console.log(JSON.stringify({
    status: s.status, finishedAt: !!s.finishedAt, result: r ? {
      totalGold: r.totalGold, classGold: r.classGold, totalCorrect: r.totalCorrect,
      topp3: (r.ranking || []).filter((p) => p.rank <= 3).map((p) => `${p.rank}. ${p.name} ${p.gold}`),
    } : null,
  }));
}

const [cmd, arg, arg2] = process.argv.slice(2);
try {
  if (cmd === "start") await start(arg, arg2 === "5e" || arg === "5e");
  else if (cmd === "lobby") { await create({ live: false }); console.log(`✓ ${SID} i lobbyn`); }
  else if (cmd === "stold") await stold();
  else if (cmd === "storm") await storm();
  else if (cmd === "slut") await slut();
  else if (cmd === "kolla") await kolla();
  else console.log("start [sek] [5e] | lobby | stold | storm | slut | kolla");
} catch (e) {
  console.error(e.message || e);
  process.exitCode = 1;
}
await app.delete();
