// ============================================================================
// Migreringen inför myntlåset (admin/migrera-mynt-las.mjs, #854, epic #851)
// ----------------------------------------------------------------------------
// Går igenom ALLA studentData-dokument: gamla dokument utan `xp` får
// xpFromProgress(progress), och (med --djur) alla befintliga djur (roomAnimals,
// äldre djur i ownedItems, farm.animals, pets och den gamla `pet`) får en post i
// ägarbeviset agdaDjur med den art de har i dag. coins/xp som inte är heltal avrundas nedåt
// (låset godtar bara heltal, #855). Saldon och varor ändras annars inte. Logiken:
// planeraMigrering i admin/migrera-mynt-las-core.mjs (enhetstestad).
//
// DJUREN BARA MED --djur (#856): utan flaggan skrivs bara xp/coins, och djur som
// saknar en post i agdaDjur listas (antal + dokument: uid) men får ingen. Kör
// ALDRIG --djur efter låsreglerna: då är listorna fritt skrivbara för eleven och
// ett inskjutet djur skulle få en post. Ett djur som saknar post efter låset
// rättas för hand (Admin SDK), aldrig med --djur.
//
// Deployfaserna (docs/SAKERHET-MYNT.md §7): fas 1 `--commit --djur` före webben;
// fas 2 `--commit --djur` precis FÖRE låsreglerna, sedan `--commit` (utan --djur)
// efter dem. Efter --commit ska en ny torrkörning visa 0 att skriva.
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --commit.
//   node admin/migrera-mynt-las.mjs                   # torrkörning (antal per åtgärd)
//   node admin/migrera-mynt-las.mjs --djur            # torrkörning, med djurens poster
//   node admin/migrera-mynt-las.mjs --commit [--djur] # skriver, en transaktion per dokument
// Mot emulatorn först: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node admin/migrera-mynt-las.mjs
// Idempotent: kör om det så många gånger du vill. Admin SDK (docs/ADMIN.md).
// ============================================================================

import { db, parseArgs, isEmulator } from "./_shared.mjs";
import { planeraMigrering } from "./migrera-mynt-las-core.mjs";

const { flags } = parseArgs();
const COMMIT = flags.has("commit");
const DJUR = flags.has("djur");
const ATGARDER = {
  xp: "xp härlett ur progress", heltal: "coins/xp avrundat till heltal (#855)", aldreDjur: "äldre djur ur ownedItems → roomAnimals", gammaltPet: "gammalt pet → pets[0]",
  rumsdjur: "agdaDjur: rumsdjur", gardsdjur: "agdaDjur: gårdsdjur", husdjur: "agdaDjur: husdjur (ägg)",
};

/** Skriv om ETT dokument: läser och planerar på nytt i transaktionen (inget skrivs över). */
function skriv(ref) {
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const patch = s.exists ? planeraMigrering(s.data(), {}, { djur: DJUR }) : null;
    if (patch) tx.update(ref, patch);
    return !!patch;
  });
}

async function main() {
  console.log(`\n=== Migrering mynt-lås (#854) – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`);
  console.log(COMMIT ? "LÄGE: SKARP (--commit)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");
  const snap = await db.collection("studentData").get();
  console.log(DJUR ? "DJUR: agdaDjur-poster delas ut (--djur) – bara FÖRE låsreglerna!\n" : "DJUR: bara rapport (utan --djur)\n");
  const rakna = {};
  const saknas = [];
  const plan = snap.docs.filter((d) => {
    const r = {};
    const patch = planeraMigrering(d.data(), r, { djur: DJUR });
    for (const [k, n] of Object.entries(r)) if (typeof n === "number") rakna[k] = (rakna[k] || 0) + n;
    if (r.saknadeUid) saknas.push(`${d.id}: ${r.saknadeUid.join(", ")}`);
    return patch;
  });
  console.log(`Dokument: ${snap.size} · att skriva: ${plan.length}`);
  for (const [k, text] of Object.entries(ATGARDER)) if (DJUR || k === "xp" || k === "heltal") {
    console.log(`   ${String(rakna[k] || 0).padStart(6)}  ${text}`);
  }
  if (!DJUR) {
    console.log(`   ${String(rakna.saknarPost || 0).padStart(6)}  djur UTAN post i agdaDjur (får ingen utan --djur) i ${saknas.length} dokument`);
    for (const rad of saknas) console.log(`            ${rad}`);
  }
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
