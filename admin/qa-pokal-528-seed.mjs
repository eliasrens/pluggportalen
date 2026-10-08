// ============================================================================
// QA-seed för #528 (fler pokaler) – BARA emulatorn. Körs efter
// admin/qa-klasscentret-preview.sh (som seedar QA-klasserna qa-kc m.fl.):
//   • qa-kc (QA-klass 4A): Troféhyllan upplåst (står i möbellådan), fler
//     pokaler (silver, brons, Liveläge, lärarens hjärta) → 7 pokaler totalt,
//     och 260 godkända Läsresan-texter i expShards.lasresan → när läraren
//     öppnar klassen delas milstolparna 100 + 250 ut.
//   • qa-mm-528: Mattematchen med 4 klasser vars tid tog slut för en timme
//     sedan, ej arkiverad → läraren öppnar Mattematchen-fliken →
//     archiveIfEnded → guld/silver/brons (qa-kc2 1:a, qa-kc 2:a, qa-kc3 3:a).
//   node admin/qa-pokal-528-seed.mjs
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore();
const { Timestamp } = admin.firestore;
const NOW = Date.now();
const DAG = 86400000;

async function pokal(classId, typ, kallaId, dagarSedan, data) {
  await db.doc(`classCenters/${classId}/trophies/${typ}-${kallaId}`).set({
    typ, kallaId, wonAt: Timestamp.fromMillis(NOW - dagarSedan * DAG), awardedBy: "qa-larare", ...data,
  });
}

async function main() {
  await db.doc("classCenters/qa-kc/fund/trofehylla").set({
    targetPrice: 2500, fundedAmount: 2500, isUnlocked: true, unlockedAt: Timestamp.now(), lastDonationId: "qa-trofehylla",
  });
  await pokal("qa-kc", "mm-silver", "qa-mm-sep", 30, { titel: "Mattematchen – silver", detalj: "Septembermatchen" });
  await pokal("qa-kc", "mm-brons", "qa-mm-aug", 45, { titel: "Mattematchen – brons", detalj: "Augustimatchen" });
  await pokal("qa-kc", "live-avklarat", "qa-live-koop", 12, { titel: "Liveläge avklarat", detalj: "Live: Tillsammans" });
  await pokal("qa-kc", "larare", "qa528hjarta", 1, {
    titel: "Bästa samarbetet i oktober!", detalj: "Ni hjälpte varandra med bråken hela veckan.", motiv: "hjarta",
  });
  for (const [s, n] of [[0, 70], [1, 55], [2, 50], [3, 45], [4, 40]]) {
    await db.doc(`classCenters/qa-kc/expShards/${s}`).set({ lasresan: n }, { merge: true });
  }
  console.log("✓ qa-kc: Troféhyllan upplåst, 7 pokaler, 260 Läsresan-texter (milstolpar delas ut när läraren öppnar klassen)");

  const cid = "qa-mm-528";
  const klasser = ["qa-kc", "qa-kc2", "qa-kc3", "qa-ks"];
  await db.doc(`mathCompetitions/${cid}`).set({
    name: "Mattematchen #528 (4 klasser)", participatingClassIds: klasser,
    startAt: Timestamp.fromMillis(NOW - 2 * DAG), endAt: Timestamp.fromMillis(NOW - 3600_000),
    status: "active", counterShards: 5, createdBy: "qalarare", createdAt: Timestamp.fromMillis(NOW - 2 * DAG),
  });
  // Rätt totalt; placeringen = rätt per elev (klassernas elevantal ur seedarna).
  const rätt = { "qa-kc2": 900, "qa-kc": 700, "qa-kc3": 300, "qa-ks": 10 };
  for (const [classId, total] of Object.entries(rätt)) {
    await db.doc(`mathCompetitions/${cid}/classCounters/${classId}_0`).set({
      classId, shard: 0, correct: total, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW - DAG),
    });
  }
  const per = await Promise.all(klasser.map(async (k) => {
    const d = (await db.doc(`classes/${k}`).get()).data() || {};
    return `${d.name || k} ${(rätt[k] / Math.max(1, (d.studentIds || []).length)).toFixed(1)}`;
  }));
  console.log(`✓ ${cid}: slut för 1 h sedan, ej arkiverad – rätt/elev: ${per.join(", ")}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
