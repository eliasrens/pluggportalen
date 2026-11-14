// ============================================================================
// Migreringen inför myntlåset (admin/migrera-mynt-las.mjs, #854, epic #851)
// ----------------------------------------------------------------------------
// Går igenom ALLA studentData-dokument: gamla dokument utan `xp` får
// xpFromProgress(progress), och alla befintliga djur (roomAnimals, äldre djur i
// ownedItems, farm.animals, pets och den gamla `pet`) får en post i ägarbeviset
// agdaDjur med den art de har i dag. Saldon och varor ändras inte. Logiken:
// planeraMigrering i admin/migrera-mynt-las-core.mjs (enhetstestad).
//
// Körs i BÅDA deployfaserna (docs/SAKERHET-MYNT.md §7): fas 1 före webben, fas 2
// efter låsreglerna. Efter --commit ska en ny torrkörning visa 0.
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --commit.
//   node admin/migrera-mynt-las.mjs            # torrkörning (antal per åtgärd)
//   node admin/migrera-mynt-las.mjs --commit   # skriver, en transaktion per dokument
// Mot emulatorn först: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node admin/migrera-mynt-las.mjs
// Idempotent: kör om det så många gånger du vill. Admin SDK (docs/ADMIN.md).
// ============================================================================

import { db, parseArgs, isEmulator } from "./_shared.mjs";
import { planeraMigrering } from "./migrera-mynt-las-core.mjs";

const { flags } = parseArgs();
const COMMIT = flags.has("commit");
const ATGARDER = {
  xp: "xp härlett ur progress", aldreDjur: "äldre djur ur ownedItems → roomAnimals", gammaltPet: "gammalt pet → pets[0]",
  rumsdjur: "agdaDjur: rumsdjur", gardsdjur: "agdaDjur: gårdsdjur", husdjur: "agdaDjur: husdjur (ägg)",
};

/** Skriv om ETT dokument: läser och planerar på nytt i transaktionen (inget skrivs över). */
function skriv(ref) {
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const patch = s.exists ? planeraMigrering(s.data()) : null;
    if (patch) tx.update(ref, patch);
    return !!patch;
  });
}

async function main() {
  console.log(`\n=== Migrering mynt-lås (#854) – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`);
  console.log(COMMIT ? "LÄGE: SKARP (--commit)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");
  const snap = await db.collection("studentData").get();
  const rakna = {};
  const plan = snap.docs.filter((d) => planeraMigrering(d.data(), rakna));
  console.log(`Dokument: ${snap.size} · att skriva: ${plan.length}`);
  for (const [k, text] of Object.entries(ATGARDER)) console.log(`   ${String(rakna[k] || 0).padStart(6)}  ${text}`);
  if (!COMMIT) return console.log("\nTorrkörning klar. Kör med --commit för att skriva.");
  let skrivna = 0;
  for (let i = 0; i < plan.length; i += 20) {
    const r = await Promise.all(plan.slice(i, i + 20).map((d) => skriv(d.ref)));
    skrivna += r.filter(Boolean).length;
  }
  console.log(`\nKlart: ${skrivna} dokument uppdaterade. Kör en ny torrkörning – den ska visa 0.`);
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
