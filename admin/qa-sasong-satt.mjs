// ============================================================================
// QA: sätt config/season i EMULATORN (#691) – sommar/höst ± Halloween.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8690 GCLOUD_PROJECT=pluggportalen-so-2026 \
//     node admin/qa-sasong-satt.mjs host halloween      # höst + Halloween på
//     node admin/qa-sasong-satt.mjs sommar              # sommar, Halloween av
//     node admin/qa-sasong-satt.mjs bort                # ta bort dokumentet (test 1)
// Halloween får slutdatum om N sekunder med `halloween 60` (test 5b).
// Vägrar köra utan FIRESTORE_EMULATOR_HOST (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const db = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }).firestore();
const [season = "sommar", hw, sek] = process.argv.slice(2);
const ref = db.doc("config/season");
if (season === "bort") {
  await ref.delete();
  console.log("config/season borttaget");
} else {
  const halloween = hw === "halloween";
  const until = halloween && sek ? admin.firestore.Timestamp.fromMillis(Date.now() + Number(sek) * 1000) : null;
  await ref.set({ season, halloween, halloweenUntil: until, updatedAt: new Date(), updatedBy: "qa-seed" });
  console.log("config/season =", { season, halloween, halloweenUntil: until?.toDate() || null });
}
process.exit(0);
