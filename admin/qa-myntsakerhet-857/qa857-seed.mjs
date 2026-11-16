// QA-seed #857 (bara emulator) – körs EFTER admin/qa-mattematchen-844-seed.mjs.
// node .scratch/qa857-seed.mjs            seed
// node .scratch/qa857-seed.mjs dump uid…  visa fälten
// node .scratch/qa857-seed.mjs utanxp uid  nytt dokument utan xp (gammal flik efter fas 1-migreringen)
import admin from "firebase-admin";
import { defaultStudentData } from "../../src/klass-membership.js";
import { subjects, areas } from "../../seed/seed-data.js";
import { buildSessionDoc } from "../../src/live/live-core.js";
import { buildResult } from "../../src/live/formats/snilleblixt/snilleblixt-poang.js";
import { requireGameMode } from "../../src/live/modes/index.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) { console.error("bara emulator"); process.exit(1); }
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;
const PW = "lilla123";
const K = "k848-3a";
const NU = Date.now();
const H = 3600_000;
const ts = (ms) => Timestamp.fromMillis(NU + ms);

async function ensureUser(uid) {
  const email = `${uid}@elev.pluggportalen.local`;
  try { await auth.getUser(uid); await auth.updateUser(uid, { email, password: PW }); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; await auth.createUser({ uid, email, password: PW }); }
}

async function dump(uids) {
  for (const uid of uids) {
    const s = await db.doc(`studentData/${uid}`).get();
    const d = s.exists ? s.data() : null;
    if (!d) { console.log(uid, "SAKNAS"); continue; }
    const f = d.farm || {};
    const md = await db.collection(`studentData/${uid}/myntDag`).get();
    console.log(uid, JSON.stringify({
      coins: d.coins, xp: d.xp, appleCount: d.appleCount, lastFro: d.lastFro,
      ownedItems: d.ownedItems, ownedCounts: d.ownedCounts, avatarItems: d.avatarItems, husSkalId: d.husSkalId,
      agdaDjur: d.agdaDjur, roomAnimals: (d.roomAnimals || []).map((a) => `${a.uid || "-"}=${a.id}`),
      pets: (d.pets || []).map((p) => `${p.id}:${p.speciesId || "ägg"}${p.eggSpecies ? "/" + p.eggSpecies : ""}${p.hasHeatLamp ? "+lampa" : ""}`),
      pet: d.pet ? "LEGACY" : undefined,
      farm: { barnLevel: f.barnLevel, gardenTier: f.gardenTier, animals: (f.animals || []).map((a) => `${a.uid}=${a.id}${a.lastGiftAt ? "*" : ""}`), slots: (f.gardenSlots || []).filter(Boolean).length },
      lasresa: d.lasresa ? { moneyEarned: d.lasresa.moneyEarned } : undefined,
      progress: d.progress ? Object.keys(d.progress) : undefined,
      myntDag: md.docs.map((x) => ({ id: x.id, ...Object.fromEntries(Object.entries(x.data()).filter(([k]) => k !== "lastAt")) })),
    }));
  }
}

const ko = (uid, lastGiftAt = null) => ({ uid, id: "animal_cow", name: null, pos: null, trivsel: 100, lastFedAt: NU - H, lastGiftAt });
const gris = (uid) => ({ uid, id: "animal_pig", name: null, pos: null, trivsel: 100, lastFedAt: NU - H, lastGiftAt: null });

async function livesession(sid, uid, total) {
  const MULT = requireGameMode("multiplication_0_10");
  const s = {
    ...buildSessionDoc({
      name: `QA857 ${sid}`, format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "choice",
      classIds: [K], classNames: { [K]: "3A" }, questionCount: 10, questionSeconds: 20,
      shuffleQuestions: true, showQuestionOnStudent: true, rewards: { firstPrize: "30", perCorrect: "5", cap: "100" },
    }, { uid: "qalarare" }),
    createdAt: ts(-2 * H), status: "finished", startedAt: ts(-H), finishedAt: ts(-60_000),
  };
  const result = buildResult(s, [], [{ uid, name: uid, classId: K }], MULT, { scores: [{ index: 0, skipped: false, points: { [uid]: 900 }, correct: {} }] });
  result.rewards = { [uid]: { rank: 1, correct: 4, prize: 30, correctCoins: total - 30, total } };
  for (const sub of ["players", "coinReceipts"]) {
    const old = await db.collection(`liveSessions/${sid}/${sub}`).get();
    await Promise.all(old.docs.map((d) => d.ref.delete()));
  }
  await db.doc(`liveSessions/${sid}`).set({ ...s, result });
  await db.doc(`liveSessions/${sid}/players/${uid}`).set({ uid, classId: K, name: uid, joinedAt: ts(-2 * H), lastSeenAt: ts(-H), correct: 4, incorrect: 0 });
}

// Baslinje-eleven (samma dokument för main-körningen och epic-körningen).
function baslinje() {
  const bas = defaultStudentData("fox");
  const d = {
    ...bas, coins: 1000, xp: 120, avatarChosen: true, appleCount: 0,
    progress: { vikingatiden: { quiz: { completed: true, stars: 2, plays: 1, bestScore: 6 } } },
    farm: { ...bas.farm, barnLevel: 2, animals: [ko("animal_cow#b1")] },
  };
  return d;
}

async function main() {
  if (process.argv[2] === "dump") return dump(process.argv.slice(3));
  if (process.argv[2] === "utanxp") {
    const uid = process.argv[3];
    await ensureUser(uid);
    const ids = (await db.doc(`classes/${K}`).get()).data().studentIds;
    await db.doc(`classes/${K}`).update({ studentIds: [...new Set([...ids, uid])] });
    await db.doc(`students/${uid}`).set({ namn: uid, username: uid, avatarId: "fox", classIds: [K] });
    const d = { ...baslinje(), coins: 400 };
    delete d.xp;
    await db.doc(`studentData/${uid}`).set(d);
    console.log("✓", uid, "utan xp");
    return;
  }
  for (const s of subjects) { const { id, ...rest } = s; await db.doc(`subjects/${id}`).set(rest, { merge: true }); }
  const vik = areas.so.find((a) => a.id === "vikingatiden");
  const { id: vid, ...vrest } = vik;
  await db.doc(`subjects/so/areas/${vid}`).set(vrest);

  const nya = ["q857m", "q857e", "q857t", "q857x", "q857k", "q857m2", "q857e2"];
  const ids = (await db.doc(`classes/${K}`).get()).data().studentIds;
  await db.doc(`classes/${K}`).update({ studentIds: [...new Set([...ids, ...nya])] });
  for (const uid of nya) {
    await ensureUser(uid);
    await db.doc(`students/${uid}`).set({ namn: uid, username: uid, avatarId: "fox", classIds: [K] });
  }
  // m = main-körningen, e = epic-körningen (identiska); m2/e2 = Mattematchen + mysterylådan separat.
  for (const uid of ["q857m", "q857e", "q857m2", "q857e2"]) await db.doc(`studentData/${uid}`).set(baslinje());

  // Övergångseleven: gammalt dokument utan xp och utan agdaDjur, djur i alla listor.
  const bas = defaultStudentData("fox");
  const t = {
    ...bas, coins: 2000, avatarChosen: true, appleCount: 2,
    progress: { vikingatiden: { quiz: { completed: true, stars: 3, plays: 2 } }, stenaldern: { match: { completed: true, stars: 1 } } },
    ownedItems: ["keps", "katt"], ownedCounts: { crop_carrot: 3, stol: 1 },
    roomAnimals: [{ uid: "fisk#t1", id: "fisk", pos: { x: 30, y: 80 }, name: null, stowed: false }],
    pets: [{ id: "pt1", name: "Glimt", eggBoughtAt: NU - 50 * H, hatchedAt: NU - 40 * H, speciesId: "eldis", stage: 1, feedCount: 2, lastFedAt: NU - 2 * H, pos: { x: 45, y: 75 } }],
    farm: { ...bas.farm, barnLevel: 2, gardenTier: 1, animals: [ko("animal_cow#t1"), gris("animal_pig#t1")] },
  };
  delete t.xp;
  await db.doc("studentData/q857t").set(t);

  // Angriparen: äger en fisk, ett ägg och en gris (agdaDjur kommer från migreringen).
  await db.doc("studentData/q857x").set({
    ...bas, coins: 100, xp: 50, avatarChosen: true, appleCount: 1,
    ownedItems: ["keps"], ownedCounts: { crop_carrot: 1 },
    roomAnimals: [{ uid: "fisk#x1", id: "fisk", pos: { x: 40, y: 80 }, name: null, stowed: false }],
    pets: [{ id: "px1", name: null, eggBoughtAt: NU - 30 * H, hatchedAt: NU - 20 * H, speciesId: "robob", stage: 0, feedCount: 0, lastFedAt: null, pos: { x: 50, y: 75 } }],
    farm: { ...bas.farm, barnLevel: 2, animals: [gris("animal_pig#x1")] },
  });
  await db.doc("studentData/q857k").set({ ...bas, coins: 500, xp: 10, avatarChosen: true });

  await livesession("qa857-live-m", "q857m", 50);
  await livesession("qa857-live-e", "q857e", 50);
  await livesession("qa857-live-t1", "q857t", 40);
  await livesession("qa857-live-t5", "q857t", 35);
  console.log("✓ seed857: q857m/e/m2/e2/t/x/k (lilla123) i 3A, Live qa857-live-*");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
