// ============================================================================
// QA: sätt config/season i EMULATORN (#691, #907) – säsong ± tillägg.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8690 GCLOUD_PROJECT=pluggportalen-so-2026 \
//     node admin/qa-sasong-satt.mjs host halloween      # höst + Halloween på
//     node admin/qa-sasong-satt.mjs vinter jul          # vinter + Jul på
//     node admin/qa-sasong-satt.mjs vinter jul halloween  # båda tilläggen
//     node admin/qa-sasong-satt.mjs sommar              # sommar, inga tillägg
//     node admin/qa-sasong-satt.mjs bort                # ta bort dokumentet (test 1)
// Ett tal sist = påslagna tillägg får slutdatum om N sekunder (test 5b), t.ex.
// `host halloween 60`.
// Vägrar köra utan FIRESTORE_EMULATOR_HOST (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { TILLAGG } from "../src/season-config.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const db = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }).firestore();
const [season = "sommar", ...rest] = process.argv.slice(2);
const sek = rest.find((x) => /^\d+$/.test(x));
const ref = db.doc("config/season");
if (season === "bort") {
  await ref.delete();
  console.log("config/season borttaget");
} else {
  const until = sek ? admin.firestore.Timestamp.fromMillis(Date.now() + Number(sek) * 1000) : null;
  const data = { season };
  for (const t of TILLAGG) {
    data[t.falt] = rest.includes(t.id);
    data[t.tillFalt] = data[t.falt] ? until : null;
  }
  await ref.set({ ...data, updatedAt: new Date(), updatedBy: "qa-seed" });
  console.log("config/season =", { ...data, until: until?.toDate() || null });
}
process.exit(0);
