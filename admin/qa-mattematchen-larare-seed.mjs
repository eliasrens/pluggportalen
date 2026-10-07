// ============================================================================
// QA-seed för Mattematchen-LÄRARSIDAN (#459) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Kör EFTER admin/qa-mattematchen-seed.mjs (klasser, elever, qalarare och den
// aktiva tävlingen "Mattematchen oktober"). Lägger till:
//   • simulerade svar → studentStats (per tabell) för 4A/4B/5E i den aktiva
//     tävlingen, så klasstabellen och elevdetaljen har data
//   • "Mattematchen september" – tiden tog slut för 5 dagar sedan men ingen
//     tryckte Avsluta (status active, inget result) → arkiveras när läraren
//     öppnar den (archiveIfEnded)
//   • några svarsdokument för elev1 i Mattematchen + en Live-session →
//     "Totalt i multiplikation (MM + Live)" i elevdetaljen
// Idempotent. Logga in som qalarare / lilla123 på #/larare/mattematchen.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-mattematchen-larare-seed.mjs
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;
const NOW = Date.now();
const DAG = 24 * 3600 * 1000;

// Deterministisk slump så att två körningar ger samma siffror.
let seed = 459;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

/** Simulera n svar med träffsäkerhet p → studentStats-fält. */
function simulera(n, p) {
  const s = { correct: 0, incorrect: 0 };
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rnd() * 11);
    const b = Math.floor(rnd() * 11);
    const ok = rnd() < p - (a >= 6 && b >= 6 ? 0.15 : 0);
    const k = ok ? "c" : "w";
    s[ok ? "correct" : "incorrect"]++;
    s[`${k}${a}`] = (s[`${k}${a}`] || 0) + 1;
    if (b !== a) s[`${k}${b}`] = (s[`${k}${b}`] || 0) + 1;
  }
  return s;
}

async function rensa(path) {
  const snap = await db.collection(path).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function fyll(cid, klasser, { andel = 0.8 } = {}) {
  const base = `mathCompetitions/${cid}`;
  const perKlass = {};
  for (const classId of klasser) {
    const ids = (await db.doc(`classes/${classId}`).get()).data().studentIds;
    let summa = 0;
    for (const uid of ids) {
      if (uid === "elev1" || rnd() > andel) continue; // elev1:s statistik kommer ur elevseeden
      const st = simulera(20 + Math.floor(rnd() * 120), 0.6 + rnd() * 0.38);
      const namn = (await db.doc(`students/${uid}`).get()).data()?.namn || "Elev";
      const meta = { uid, classId, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW) };
      await db.doc(`${base}/studentStats/${uid}`).set({ ...meta, ...st });
      if (st.correct > 0) await db.doc(`${base}/scores/${uid}`).set({ ...meta, name: namn, correct: st.correct });
      summa += st.correct;
    }
    perKlass[classId] = summa;
  }
  return perKlass;
}

async function main() {
  const aktiv = "mm-qa-oktober";
  if (!(await db.doc(`mathCompetitions/${aktiv}`).get()).exists) {
    throw new Error("Kör admin/qa-mattematchen-seed.mjs först.");
  }
  // Aktiva tävlingen: ersätt fyllnadselevernas topplista med simulerade svar.
  for (const sub of ["studentStats", "scores", "classCounters"]) {
    const snap = await db.collection(`mathCompetitions/${aktiv}/${sub}`).get();
    await Promise.all(snap.docs.filter((d) => !d.id.startsWith("elev1")).map((d) => d.ref.delete()));
  }
  await db.doc(`mathCompetitions/${aktiv}/scores/elev1`).set({
    uid: "elev1", classId: "mm-4a", name: "Astrid", correct: 40, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW),
  });
  const akt = await fyll(aktiv, ["mm-4a", "mm-4b", "mm-5e"]);
  akt["mm-4a"] += 40;
  for (const [classId, total] of Object.entries(akt)) {
    await db.doc(`mathCompetitions/${aktiv}/classCounters/${classId}_0`).set({
      classId, shard: 0, correct: total, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW),
    });
  }

  // Avslutad av tiden (ingen tryckte Avsluta) → arkiveras när läraren öppnar den.
  const sept = "mm-qa-september";
  for (const sub of ["answers", "studentStats", "scores", "classCounters"]) await rensa(`mathCompetitions/${sept}/${sub}`);
  await db.doc(`mathCompetitions/${sept}`).set({
    name: "Mattematchen september", participatingClassIds: ["mm-4a", "mm-4b"],
    startAt: Timestamp.fromMillis(NOW - 19 * DAG), endAt: Timestamp.fromMillis(NOW - 5 * DAG),
    status: "active", counterShards: 5, createdBy: "qalarare", createdAt: Timestamp.fromMillis(NOW - 20 * DAG),
  });
  const sep = await fyll(sept, ["mm-4a", "mm-4b"], { andel: 0.9 });
  for (const [classId, total] of Object.entries(sep)) {
    await db.doc(`mathCompetitions/${sept}/classCounters/${classId}_0`).set({
      classId, shard: 0, correct: total, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW - 5 * DAG),
    });
  }

  // Träningsstatistik (MM + Live) för elev1: 12 MM-svar + 6 Live-svar.
  const svar = (path, i, ok) => db.doc(`${path}/answers/qa-${i}`).set({
    uid: "elev1", classId: "mm-4a", mode: "multiplication_0_10", factorA: 7, factorB: i % 11,
    answer: ok ? 7 * (i % 11) : 1, correctAnswer: 7 * (i % 11), isCorrect: ok, shard: 0, at: Timestamp.fromMillis(NOW - i * 60000),
  });
  await rensa(`mathCompetitions/${aktiv}/answers`);
  await Promise.all(Array.from({ length: 12 }, (_, i) => svar(`mathCompetitions/${aktiv}`, i, i % 4 !== 0)));
  await db.doc("liveSessions/qa-live-traning").set({
    name: "4A mot 4B", gameMode: "multiplication_0_10", participatingClassIds: ["mm-4a", "mm-4b"],
    classDivisors: { "mm-4a": 60, "mm-4b": 20 }, durationSeconds: 300, countdownSeconds: 4, counterShards: 10,
    status: "finished", createdBy: "qalarare", createdAt: Timestamp.fromMillis(NOW - DAG),
  });
  await Promise.all(Array.from({ length: 6 }, (_, i) => svar("liveSessions/qa-live-traning", 100 + i, i !== 2)));

  console.log(`✓ ${aktiv}: simulerad statistik`, akt);
  console.log(`✓ ${sept}: slut för 5 dagar sedan, ej arkiverad`, sep);
  console.log("✓ elev1: 12 MM-svar (9 rätt) + 6 Live-svar (5 rätt) → träningstotal 18 / 14 rätt");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
