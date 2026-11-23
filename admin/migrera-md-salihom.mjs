// ============================================================================
// Matchdagen: förnamnet Hedda → Salihom i de sparade spelarna (admin/migrera-md-salihom.mjs, #916)
// ----------------------------------------------------------------------------
// FORNAMN (src/matchdagen/delat/md-namn.js) har Salihom på Heddas plats, men namnen lottas
// en gång och SPARAS i karriären. Skriptet går igenom alla matchdagen/{uid} och byter ett
// förnamn som är exakt "Hedda" i truppen, reserverna och marknaden. Efternamnet och allt
// annat rörs inte (inte heller `senast`). Logiken: planeraNamnbyte i
// admin/migrera-md-salihom-core.mjs (enhetstestad, test/migrera-md-salihom.test.js).
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --skarpt.
//   node admin/migrera-md-salihom.mjs            # torrkörning (dokument och spelare)
//   node admin/migrera-md-salihom.mjs --skarpt   # skriver, en transaktion per dokument
// Mot emulatorn först: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node admin/migrera-md-salihom.mjs
// Idempotent: efter --skarpt ska en ny torrkörning visa 0. Admin SDK (docs/ADMIN.md).
// Körs efter att webben med det nya namnet är ute.
// ============================================================================

import { db, parseArgs, isEmulator } from "./_shared.mjs";
import { planeraNamnbyte, GAMMALT, NYTT } from "./migrera-md-salihom-core.mjs";

const { flags } = parseArgs();
const SKARPT = flags.has("skarpt");
const FALT = ["trupp", "reserver", "marknad"];

/** Skriv om ETT dokument: läser och planerar på nytt i transaktionen (inget skrivs över). */
function skriv(ref) {
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const patch = s.exists ? planeraNamnbyte(s.data()) : null;
    if (patch) tx.update(ref, patch);
    return !!patch;
  });
}

async function main() {
  console.log(`\n=== Matchdagen ${GAMMALT} → ${NYTT} (#916) – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`);
  console.log(SKARPT ? "LÄGE: SKARP (--skarpt)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");
  const snap = await db.collection("matchdagen").select(...FALT).get();
  const rakna = {};
  const plan = snap.docs.filter((d) => planeraNamnbyte(d.data(), rakna));
  const spelare = FALT.reduce((s, f) => s + (rakna[f] || 0), 0);
  console.log(`Dokument: ${snap.size} · att ändra: ${plan.length} · spelare: ${spelare}`);
  for (const f of FALT) console.log(`   ${String(rakna[f] || 0).padStart(6)}  ${f}`);
  if (!SKARPT) return console.log("\nTorrkörning klar. Kör med --skarpt för att skriva.");
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
