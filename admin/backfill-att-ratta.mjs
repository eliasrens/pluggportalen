// ============================================================================
// ENGÅNGS-backfill (#807 F2): räknarna "prov att rätta" på äldre provtillfällen
// ----------------------------------------------------------------------------
// Märket "Prov 18", Hem → Att göra och Mina prov → Att rätta hittar tillfällen
// med flaggan attRatta (src/prov/prov-raknare.js). Tillfällen som stängdes före
// #807 saknar den, och de som aldrig rättats saknar även räkneverket rattStatus.
// Webben skriver upp flaggan lat när läraren öppnar Provtillfällen eller
// rättningen; det här skriptet gör alla på en gång direkt efter deployen:
//   * räkneverket finns  → rattStatus + attRatta ur det (ingen läsning till)
//   * stängt utan räkneverk → antal = inlämnade svar (EN count-fråga per tillfälle)
//   * förberedda och öppna utan räkneverk rörs inte (räknas när de stängs)
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --commit.
//   node admin/backfill-att-ratta.mjs            # torrkörning (visar plan)
//   node admin/backfill-att-ratta.mjs --commit   # skriver
// Mot emulatorn först: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node admin/backfill-att-ratta.mjs --commit
// Idempotent: kör om det så många gånger du vill. Admin SDK (docs/ADMIN.md).
// ============================================================================

import { db, parseArgs, isEmulator } from "./_shared.mjs";
import { backfillPlan, raknareFalt } from "../src/prov/prov-raknare.js";

const { flags } = parseArgs();
const COMMIT = flags.has("commit");

async function main() {
  console.log(`\n=== Backfill attRatta (#807) – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`);
  console.log(COMMIT ? "LÄGE: SKARP (--commit)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");
  const snap = await db.collection("provTillfallen").get();
  const plan = [];
  for (const d of snap.docs) {
    const tf = d.data();
    const typ = backfillPlan(tf);
    if (!typ) continue;
    let falt = raknareFalt(tf.rattStatus);
    if (typ === "rakna") {
      const n = (await d.ref.collection("svar").where("inlamnad", "==", true).count().get()).data().count;
      falt = raknareFalt({ antal: n });
    }
    plan.push({ ref: d.ref, falt });
    console.log(`   ${d.id} (${tf.classId}, ${tf.provNamn || "Prov"}): ${typ} → ${JSON.stringify(falt)}`);
  }
  console.log(`\nTillfällen: ${snap.size} · att skriva: ${plan.length} · varav med prov att rätta: ${plan.filter((p) => p.falt.attRatta).length}`);
  if (!COMMIT) return console.log("Torrkörning klar. Kör med --commit för att skriva.");
  for (let i = 0; i < plan.length; i += 400) {
    const batch = db.batch();
    plan.slice(i, i + 400).forEach((p) => batch.update(p.ref, p.falt));
    await batch.commit();
  }
  console.log(`Klart: ${plan.length} tillfällen uppdaterade.`);
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
