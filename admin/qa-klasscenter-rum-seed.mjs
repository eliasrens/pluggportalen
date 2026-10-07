// ============================================================================
// QA-seed för Klasscentrets rum (#490, epic #475) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Kör först admin/qa-klasscenter-by-seed.mjs (klasser + elever, lösen lilla123).
// Den här lägger till, för klass qa-kc ("QA-klass 4A", kc01 … kc14):
//   • upplåsta föremål (fund isUnlocked) = möbellådan: guldstaty, lounge,
//     akvarium, klassfana, kristallkrona (flygel/fontän/troféhylla ej köpta)
//   • inredningSparr: kc03 är bockad av läraren (ser rummet, kan inte inreda)
//   • `tom` som argument → nollställer layout + historik (rummet tomt igen)
// Klass qa-kc2 (4B, kd01 …) får en färdig layout → gästbesök från 4A visar den.
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

async function main() {
  await lasUpp("qa-kc", ["guldstaty", "lounge", "akvarium", "klassfana", "kristallkrona"]);
  await db.doc("classCenters/qa-kc").set({ inredningSparr: ["kc03"] }, { merge: true });
  console.log("✓ qa-kc: kc03 bockad (inredningSparr)");
  if (process.argv[2] === "tom") await rensaLayout("qa-kc");

  // 4B: färdigt inrett rum att besöka som gäst.
  const pi = {
    fontan: { x: 50, y: 80, z: 1 }, flygel: { x: 22, y: 78, z: 0 },
    klassfana: { x: 80, y: 30, z: 2 }, trofehylla: { x: 25, y: 34, z: 3 },
  };
  await lasUpp("qa-kc2", Object.keys(pi));
  await db.doc("classCenters/qa-kc2/layout/current").set({ placedItems: pi, version: 1, updatedBy: "kd01", updatedAt: nu });
  await db.doc("classCenters/qa-kc2/layoutHistory/1").set({ placedItems: pi, version: 1, savedBy: "kd01", savedAt: nu });
  console.log("✓ qa-kc2: layout v1");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
