// ============================================================================
// QA-seed för Klasscentrets rum (#490, epic #475) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Kör först admin/qa-klasscenter-by-seed.mjs (klasser + elever, lösen lilla123, endast emulator).
// Den här lägger till, för klass qa-kc ("QA-klass 4A", kc01 … kc14):
//   • upplåsta föremål (fund isUnlocked) = möbellådan: guldstaty, lounge,
//     akvarium, klassfana, kristallkrona (flygel/fontän/troféhylla ej köpta)
//   • inredningSparr: kc03 är bockad av läraren (ser rummet, kan inte inreda)
//   • `tom` som argument → nollställer layout + historik (rummet tomt igen)
// Klass qa-kc2 (4B, kd01 …) får en färdig layout → gästbesök från 4A visar den.
// Pokaler (#497): qa-kc får 3 (2 MM-vinster + 1 Live) som auto-placeras på
// hyllan; qa-kc2 får 2, varav en redan flyttad i layouten.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8490 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9490 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscenter-rum-seed.mjs [tom]
//
// Idempotent. Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const nu = admin.firestore.Timestamp.now();

const PRIS = { klassfana: 2000, trofehylla: 2500, lounge: 3000, akvarium: 4000, guldstaty: 5000, flygel: 6000, fontan: 8000, kristallkrona: 10000 };

async function lasUpp(classId, ids) {
  for (const id of ids) {
    await db.doc(`classCenters/${classId}/fund/${id}`).set({
      targetPrice: PRIS[id], fundedAmount: PRIS[id], isUnlocked: true, unlockedAt: nu, lastDonationId: `qa-${id}`,
    });
  }
  console.log(`✓ ${classId}: upplåst ${ids.join(", ")}`);
}

async function rensaLayout(classId) {
  await db.doc(`classCenters/${classId}/layout/current`).delete();
  const h = await db.collection(`classCenters/${classId}/layoutHistory`).get();
  for (const d of h.docs) await d.ref.delete();
  console.log(`✓ ${classId}: layout + historik nollställd`);
}

const DAG = 86400000;
async function pokal(classId, typ, kallaId, detalj, dagarSedan, titel) {
  const wonAt = admin.firestore.Timestamp.fromMillis(Date.now() - dagarSedan * DAG);
  await db.doc(`classCenters/${classId}/trophies/${typ}-${kallaId}`).set({
    typ, kallaId, titel, detalj, wonAt, awardedBy: "qa-larare",
  });
}

async function main() {
  await lasUpp("qa-kc", ["guldstaty", "lounge", "akvarium", "klassfana", "kristallkrona"]);
  await db.doc("classCenters/qa-kc").set({ inredningSparr: ["kc03"] }, { merge: true });
  console.log("✓ qa-kc: kc03 bockad (inredningSparr)");
  if (process.argv[2] === "tom") await rensaLayout("qa-kc");
  await pokal("qa-kc", "mm-klasskamp", "qa-mm-host", "Höstmatchen v.38", 20, "Mattematchens mästare");
  await pokal("qa-kc", "live-vinst", "qa-live-1", "Live: Multiplikationsracet", 9, "Live-segrare");
  await pokal("qa-kc", "mm-klasskamp", "qa-mm-okt", "Oktobermatchen", 2, "Mattematchens mästare");
  console.log("✓ qa-kc: 3 pokaler");

  // 4B: färdigt inrett rum att besöka som gäst.
  await pokal("qa-kc2", "mm-klasskamp", "qa-mm-host", "Höstmatchen v.38", 20, "Mattematchens mästare");
  await pokal("qa-kc2", "live-vinst", "qa-live-2", "Live: Bråkduellen", 5, "Live-segrare");
  const pi = {
    fontan: { x: 50, y: 80, z: 1 }, flygel: { x: 22, y: 78, z: 0 },
    klassfana: { x: 80, y: 30, z: 2 }, trofehylla: { x: 62, y: 34, z: 3 },
    "pokal-live-vinst-qa-live-2": { x: 70, y: 50, z: 4 },
  };
  await lasUpp("qa-kc2", ["fontan", "flygel", "klassfana", "trofehylla"]);
  await db.doc("classCenters/qa-kc2/layout/current").set({ placedItems: pi, version: 1, updatedBy: "kd01", updatedAt: nu });
  await db.doc("classCenters/qa-kc2/layoutHistory/1").set({ placedItems: pi, version: 1, savedBy: "kd01", savedAt: nu });
  console.log("✓ qa-kc2: layout v1");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
