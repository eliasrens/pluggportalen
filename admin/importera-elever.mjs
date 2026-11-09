// ============================================================================
// Importera klasser + elevkonton ur en CSV (lokalt, Admin SDK) – #831
// ----------------------------------------------------------------------------
// Skapar klasserna och kontona exakt som lärarsidans "Skapa klass" och "Lägg
// till elev" (kärnan: admin/importera-elever-core.mjs, dokumentens form:
// src/klass-membership.js). Filen: klass,namn,anvandarnamn,losenord (UTF-8,
// rubrikrad, allt läses som text). Lägg riktiga filer i admin/import/ – den
// mappen är .gitignore:ad och får ALDRIG checkas in.
//
//   node admin/importera-elever.mjs --fil admin/import/elever.csv          # torrkörning (standard)
//   node admin/importera-elever.mjs --fil admin/import/elever.csv --kor    # skriver på riktigt
//   node admin/importera-elever.mjs --angra --batch ak3-2026-11            # visar vad som tas bort
//   node admin/importera-elever.mjs --angra --batch ak3-2026-11 --kor      # tar bort importen
//
// --batch (standard ak3-2026-11) märker allt som skapas (importBatch) så att
// --angra tar bort exakt det. Mot produktion krävs att man skriver "ja";
// --angra --kor kräver "ja" även mot emulatorn. Lösenord skrivs aldrig ut.
// Paus mellan konton: IMPORT_PAUS_MS (standard 250 ms, 0 mot emulatorn).
// Emulatorn: sätt FIRESTORE_EMULATOR_HOST + FIREBASE_AUTH_EMULATOR_HOST (se
// admin/_shared.mjs och docs/ADMIN.md).
// ============================================================================

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { auth, db, admin, isEmulator } from "./_shared.mjs";
import {
  lasCsv,
  planera,
  kontrollera,
  importera,
  sammanfattning,
  planeraAngra,
  angra,
} from "./importera-elever-core.mjs";

const STANDARD_BATCH = "ak3-2026-11";
const deps = { auth, db, FieldValue: admin.firestore.FieldValue };

/** --flagga, --nyckel värde och --nyckel=värde. */
function argument(argv) {
  const flaggor = new Set();
  const varden = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split(/=(.*)/s);
    if (v !== undefined) varden[k] = v;
    else if (["fil", "batch"].includes(k) && argv[i + 1] && !argv[i + 1].startsWith("--")) varden[k] = argv[++i];
    else flaggor.add(k);
  }
  return { flaggor, varden };
}

function fraga(text) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(text, (svar) => (rl.close(), res(String(svar).trim()))));
}

function malText() {
  const projekt = admin.app().options.projectId;
  return isEmulator
    ? `EMULATOR (projekt ${projekt}, Firestore ${process.env.FIRESTORE_EMULATOR_HOST}, Auth ${process.env.FIREBASE_AUTH_EMULATOR_HOST})`
    : `PRODUKTION (projekt ${projekt})`;
}

async function bekrafta(text, kravs) {
  if (!kravs) return true;
  const svar = await fraga(`${text} Skriv "ja" för att fortsätta: `);
  if (svar.toLowerCase() === "ja") return true;
  console.log("Avbrutet – ingenting skrevs.");
  return false;
}

async function korImport(fil, batch, kor) {
  const { rader, fel: lasFel } = lasCsv(readFileSync(fil, "utf8"));
  const plan = planera(rader);
  const filFel = [...lasFel, ...plan.fel];
  console.log(`Fil: ${fil} (${rader.length} elevrader)`);
  if (filFel.length) {
    console.log(`\n✗ Filen har ${filFel.length} fel – ingenting skrivs:`);
    filFel.forEach((f) => console.log(`  - ${f}`));
    return 2;
  }
  const kontroll = await kontrollera(deps, plan);
  console.log("\nKlasser:");
  kontroll.klasser.forEach((k) =>
    console.log(`  ${k.namn.padEnd(6)} ${k.finns ? `finns redan (id ${k.id}, används oförändrad)` : `skapas (id ${k.id})`}`)
  );
  if (plan.omdopta.length) {
    console.log("\nVisningsnamn som ändras (samma namn i samma klass):");
    plan.omdopta.forEach((o) => console.log(`  ${o.klass}  ${o.anvandarnamn}: "${o.fran}" → "${o.till}"`));
  }
  if (kontroll.krockar.length) {
    console.log(`\n✗ ${kontroll.krockar.length} krock(ar) med befintliga konton – ingenting skrivs:`);
    kontroll.krockar.forEach((k) => console.log(`  - ${k}`));
    return 3;
  }
  if (!kor) {
    console.log(`\n${sammanfattning(kontroll.elever)}`);
    console.log("\nTorrkörning – ingenting skrevs. Kör med --kor för att skapa.");
    return 0;
  }
  const att = kontroll.elever.filter((e) => e.status === "skapas").length;
  if (!(await bekrafta(`\nSkapar ${att} elevkonton i ${malText()} med importBatch "${batch}".`, !isEmulator))) return 1;

  const paus = Number(process.env.IMPORT_PAUS_MS ?? (isEmulator ? 0 : 250)) || 0;
  console.log("");
  const res = await importera(deps, kontroll, { batch, paus, logg: (t) => console.log(t) });
  console.log(`\n${sammanfattning(res.elever, { skapade: true, fel: res.fel })}`);
  if (res.fel.length) {
    console.log(`\nFel (${res.fel.length}) – kör samma kommando igen för att skapa resten:`);
    res.fel.forEach((f) => console.log(`  - ${f.klass}  ${f.anvandarnamn}: ${f.orsak}`));
  } else console.log("\nInga fel.");
  console.log(
    res.skapadeKlasser.length
      ? `Skapade klasser: ${res.skapadeKlasser.map((k) => k.namn).join(", ")}`
      : "Inga nya klasser skapades."
  );
  return res.fel.length ? 4 : 0;
}

async function korAngra(batch, kor) {
  const plan = await planeraAngra(deps, batch);
  console.log(`Import "${batch}": ${plan.elever.length} elevkonton, ${plan.klasser.length} klasser.`);
  plan.elever.forEach((e) => console.log(`  elev  ${e.namn} (${e.username})`));
  plan.klasser.forEach((k) =>
    console.log(`  klass ${k.namn} – ${k.tasBort ? "tas bort" : `behålls (${k.ovriga} andra elever)`}`)
  );
  if (!kor) {
    console.log("\nTorrkörning – ingenting togs bort. Kör med --kor för att ta bort.");
    return 0;
  }
  if (!plan.elever.length && !plan.klasser.length) return 0;
  if (!(await bekrafta(`\nTar bort ovanstående i ${malText()}.`, true))) return 1;
  const res = await angra(deps, plan, { logg: (t) => console.log(t) });
  console.log(`\nKlart: ${plan.elever.length - res.fel.length} elever och ${res.borttagnaKlasser.length} klasser borttagna, ${res.fel.length} fel.`);
  return res.fel.length ? 4 : 0;
}

async function main() {
  // Bara EN emulatorvariabel = halva skriptet mot emulatorn, halva mot produktion.
  if (!process.env.FIRESTORE_EMULATOR_HOST !== !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error("✗ Sätt BÅDA FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (emulatorn) eller ingen (produktion).");
    return 1;
  }
  const { flaggor, varden } = argument(process.argv.slice(2));
  const batch = varden.batch || STANDARD_BATCH;
  const kor = flaggor.has("kor");
  console.log(`Mål: ${malText()} – ${kor ? "SKARP KÖRNING" : "torrkörning"}${flaggor.has("angra") ? " (ångra)" : ""}`);
  if (flaggor.has("angra")) return korAngra(batch, kor);
  if (!varden.fil) {
    console.error("✗ Ange --fil <csv> (eller --angra --batch <id>).");
    return 1;
  }
  return korImport(varden.fil, batch, kor);
}

main().then(
  (kod) => process.exit(kod),
  (e) => {
    console.error("✗ Fel:", e.message);
    process.exit(1);
  }
);
