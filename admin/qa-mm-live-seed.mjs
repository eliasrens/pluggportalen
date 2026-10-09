// ============================================================================
// QA-seed för Mattematchen + Live (#462) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// EN seed för hela epic #456-QA:n och Elias klickguide
// (docs/preview-mattematchen-live.md). Lösenord för alla: lilla123 (endast emulator).
//
//   Lärare   rasmus, elias            (teacher-claim, "två lärare")
//   4B       b01–b20  (20 elever)     deltar i Mattematchen oktober
//   5E       e01–e22  (22 elever)     deltar i Mattematchen oktober
//   4A       a01–a25  (25 elever)     deltar i Mattematchen oktober + Live 4A mot 3A
//   3A       c01–c05  (5 elever)      bara Live 4A mot 3A (lobby)
//   4C       k01                      Mattematchen startar om START_OM_S s (MM-test 2)
//   6A       f01                      INGET – varken Mattematchen eller Live (MM-test 1)
//
// Mattematchen oktober (aktiv): 66 elever på topplistan (Topp 25-gränsen),
// 4B = 4000 rätt / 20 elever = 200,0 (MM-test 5). e01 (5E) har 0 rätt → MM-test 3
// (100 rätt i UI:t ska ge exakt 100 poäng och 0 coins).
// Live: en AVSLUTAD historikmatch (340/17 = 20,0 mot 418/22 = 19,0) och en
// LOBBY "4A mot 3A" (samtidig session). 4B mot 5E skapas av läraren i UI:t.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 [START_OM_S=120] node admin/qa-mm-live-seed.mjs
//
// Idempotent: rensar ALLA mathCompetitions + liveSessions vid varje körning.
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;

const PW = "lilla123"; // endast emulator
const NOW = Date.now();
const DAG = 24 * 3600 * 1000;
const START_OM = (Number(process.env.START_OM_S) || 120) * 1000;
const NAMN = ["Alma", "Omar", "Clara", "Noah", "Ella", "Liam", "Saga", "Hugo", "Maja", "Elias", "Wilma", "Adam",
  "Ebba", "Ali", "Stella", "Leo", "Agnes", "Melvin", "Freja", "Sam", "Nora", "Viggo", "Tyra", "Otto", "Alice",
  "Malte", "Selma", "Ivar", "Lova", "Theo", "Siri", "Edvin"];

const ids = (p, n) => Array.from({ length: n }, (_, i) => `${p}${String(i + 1).padStart(2, "0")}`);
const KLASSER = [
  ["4b", "4B", ids("b", 20)], ["5e", "5E", ids("e", 22)], ["4a", "4A", ids("a", 25)],
  ["3a", "3A", ids("c", 5)], ["4c", "4C", ["k01"]], ["6a", "6A", ["f01"]],
];

// Deterministisk slump → samma siffror varje körning.
let s0 = 462;
const rnd = () => ((s0 = (s0 * 1103515245 + 12345) % 2147483648) / 2147483648);

async function ensureUser(uid, email, claims = null) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
  await auth.setCustomUserClaims(uid, claims);
}

/** n svar med träffsäkerhet p → studentStats-fält (c{t}/w{t} per tabell). */
function statistik(correct, p) {
  const st = { correct: 0, incorrect: 0 };
  while (st.correct < correct) {
    const a = Math.floor(rnd() * 11);
    const b = Math.floor(rnd() * 11);
    const ok = rnd() < p - (a >= 6 && b >= 6 ? 0.15 : 0);
    const k = ok ? "c" : "w";
    st[ok ? "correct" : "incorrect"]++;
    for (const t of new Set([a, b])) st[`${k}${t}`] = (st[`${k}${t}`] || 0) + 1;
  }
  return st;
}

/** Fördela `total` rätt slumpvis över `n` elever (summan blir exakt total). */
function fordela(total, n) {
  const w = Array.from({ length: n }, () => 0.4 + rnd());
  const sum = w.reduce((a, b) => a + b, 0);
  const out = w.map((x) => Math.floor((x / sum) * total));
  for (let i = 0; out.reduce((a, b) => a + b, 0) < total; i = (i + 1) % n) out[i]++;
  return out;
}

async function main() {
  // --- Konton, klasser ------------------------------------------------------
  for (const t of ["rasmus", "elias"]) await ensureUser(t, `${t}@larare.pluggportalen.local`, { teacher: true });
  const namn = {};
  let order = 1;
  for (const [cid, name, elever] of KLASSER) {
    await db.doc(`classes/${cid}`).set({ name, order: order++, createdAt: NOW, studentIds: elever });
    for (const [i, uid] of elever.entries()) {
      namn[uid] = `${NAMN[(i * 7 + order * 3) % NAMN.length]} ${name}`;
      await ensureUser(uid, `${uid}@elev.pluggportalen.local`);
      await db.doc(`students/${uid}`).set({ namn: namn[uid], username: uid, avatarId: "fox", classIds: [cid] });
      await db.doc(`studentData/${uid}`).set({ coins: 100, progress: {}, avatarId: "fox", avatarChosen: true });
    }
  }

  // --- Rensa tävlingar och sessioner -----------------------------------------
  for (const col of ["mathCompetitions", "liveSessions"]) {
    for (const d of (await db.collection(col).get()).docs) await db.recursiveDelete(d.ref);
  }

  // --- Mattematchen oktober (aktiv) ----------------------------------------
  const mm = db.doc("mathCompetitions/mm-oktober");
  await mm.set({
    name: "Mattematchen oktober", participatingClassIds: ["4b", "5e", "4a"],
    startAt: Timestamp.fromMillis(NOW - 2 * DAG), endAt: Timestamp.fromMillis(NOW + 9 * DAG),
    status: "active", counterShards: 5, createdBy: "rasmus", createdAt: Timestamp.fromMillis(NOW - 3 * DAG),
  });
  const totals = { "4b": 4000, "5e": 4433, "4a": 4600 };
  for (const [cid, , elever] of KLASSER.filter(([c]) => totals[c])) {
    // e01 börjar på 0 (MM-test 3 i UI:t); övriga i klassen delar på totalen.
    const spelare = elever.filter((u) => u !== "e01");
    const delar = fordela(totals[cid], spelare.length);
    for (const [i, uid] of spelare.entries()) {
      const st = statistik(delar[i], 0.62 + rnd() * 0.36);
      const meta = { uid, classId: cid, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW) };
      await mm.collection("studentStats").doc(uid).set({ ...meta, ...st });
      await mm.collection("scores").doc(uid).set({ ...meta, name: namn[uid], correct: st.correct });
    }
    const sh = fordela(totals[cid], 5);
    for (let s = 0; s < 5; s++) {
      await mm.collection("classCounters").doc(`${cid}_${s}`).set({
        classId: cid, shard: s, correct: sh[s], lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW),
      });
    }
  }

  // --- Mattematchen för 4C som startar om en stund (MM-test 2) ---------------
  await db.doc("mathCompetitions/mm-4c-snart").set({
    name: "Mattematchen 4C – startar snart", participatingClassIds: ["4c"],
    startAt: Timestamp.fromMillis(NOW + START_OM), endAt: Timestamp.fromMillis(NOW + 7 * DAG),
    status: "active", counterShards: 5, createdBy: "elias", createdAt: Timestamp.fromMillis(NOW),
  });

  // --- Mattematchen september (avslutad, för historik) -----------------------
  await db.doc("mathCompetitions/mm-september").set({
    name: "Mattematchen september", participatingClassIds: ["4b", "5e"],
    startAt: Timestamp.fromMillis(NOW - 30 * DAG), endAt: Timestamp.fromMillis(NOW - 16 * DAG),
    status: "active", counterShards: 5, createdBy: "rasmus", createdAt: Timestamp.fromMillis(NOW - 31 * DAG),
  });
  for (const [cid, tot] of [["4b", 2900], ["5e", 3300]]) {
    const elever = KLASSER.find(([c]) => c === cid)[2];
    const delar = fordela(tot, elever.length);
    for (const [i, uid] of elever.entries()) {
      const st = statistik(delar[i], 0.8);
      const meta = { uid, classId: cid, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW - 16 * DAG) };
      await db.doc(`mathCompetitions/mm-september/studentStats/${uid}`).set({ ...meta, ...st });
      await db.doc(`mathCompetitions/mm-september/scores/${uid}`).set({ ...meta, name: namn[uid], correct: st.correct });
    }
    await db.doc(`mathCompetitions/mm-september/classCounters/${cid}_0`).set({
      classId: cid, shard: 0, correct: tot, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW - 16 * DAG),
    });
  }

  // --- Live: avslutad historikmatch (Live-test 6-siffrorna) ------------------
  const start = Timestamp.fromMillis(NOW - 26 * 3600 * 1000);
  const hist = db.doc("liveSessions/historik-demo");
  await hist.set({
    name: "4B mot 5E (igår)", gameMode: "multiplication_0_10", participatingClassIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, classDivisors: { "4b": 17, "5e": 22 },
    durationSeconds: 1200, countdownSeconds: 4, counterShards: 10, status: "finished",
    createdBy: "rasmus", createdByName: "rasmus", createdAt: start, startedAt: start,
    endsAt: new Timestamp(start.seconds + 1204, start.nanoseconds), finishedAt: new Timestamp(start.seconds + 1205, 0),
  });
  for (const [cid, tot, elever] of [["4b", 340, ids("b", 17)], ["5e", 418, ids("e", 22)]]) {
    await hist.collection("counters").doc(`${cid}_0`).set({ classId: cid, shard: 0, correct: tot });
    const delar = fordela(tot, elever.length);
    for (const [i, uid] of elever.entries()) {
      await hist.collection("players").doc(uid).set({
        uid, classId: cid, name: namn[uid], joinedAt: start, lastSeenAt: start, correct: delar[i], incorrect: Math.floor(rnd() * 6),
      });
    }
  }

  // --- Live: lobby 4A mot 3A (samtidig session) ------------------------------
  await db.doc("liveSessions/lobby-4a-3a").set({
    name: "4A mot 3A", gameMode: "multiplication_0_10", participatingClassIds: ["4a", "3a"],
    classNames: { "4a": "4A", "3a": "3A" }, classDivisors: { "4a": 25, "3a": 5 },
    durationSeconds: 300, countdownSeconds: 4, counterShards: 10, status: "lobby",
    createdBy: "elias", createdByName: "elias", createdAt: Timestamp.fromMillis(NOW),
  });

  console.log(`✓ lärare rasmus/elias + elever b01–b20 (4B), e01–e22 (5E), a01–a25 (4A), c01–c05 (3A), k01 (4C), f01 (6A) – lösenord ${PW}`);
  console.log("✓ Mattematchen oktober (4B 4000/20 = 200,0 · 5E 4433/22 · 4A 4600/25), 66 på topplistan, e01 = 0 rätt");
  console.log(`✓ 4C:s tävling startar ${new Date(NOW + START_OM).toLocaleTimeString("sv-SE")} · september (slut, arkiveras vid öppning)`);
  console.log("✓ Live: historik 4B mot 5E (340/17 mot 418/22) + lobby 4A mot 3A");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
