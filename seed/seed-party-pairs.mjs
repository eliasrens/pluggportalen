// ============================================================================
// Lägg till partibilds-par i DEMOKRATI-området (Admin SDK).
// ----------------------------------------------------------------------------
//   node seed/seed-party-pairs.mjs          (torrkörning – hämtar, validerar, visar)
//   node seed/seed-party-pairs.mjs --write  (skriver tillbaka till Firestore)
//
// Detta verktyg är ADDITIVT och idempotent: det HÄMTAR arbetsområdet
// subjects/so/areas/valet-och-demokrati-stort, lägger till bildpar för riksdagens
// 8 partier (partisymbol ↔ partinamn) UTAN att röra befintliga texter/quiz/pairs,
// kör HELA området genom validate.js och skriver tillbaka.
//
// Sedan härdningen är reglerna stängda, så skrivningen går via Admin SDK med
// service-account (admin/_shared.mjs) i stället för REST + webb-nyckel. Mot
// emulatorn: sätt FIRESTORE_EMULATOR_HOST (se docs/ADMIN.md). Kör man det igen
// läggs inga dubbletter till (par-id:na är stabila).
// ============================================================================

import { db, isEmulator } from "../admin/_shared.mjs";
import { validateArea } from "../src/validate.js";
import { listPairImageKeys } from "../src/pair-images.js";

const SUBJECT = "so";
const AREA = "valet-och-demokrati-stort";
const WRITE = process.argv.includes("--write");
const DOC_PATH = `subjects/${SUBJECT}/areas/${AREA}`;

// Riksdagens 8 partier som bildpar: partisymbol (term-bild) ↔ partinamn (definition).
const PARTY_PAIRS = listPairImageKeys().map(({ key, name }) => {
  const letter = key.split("/").pop();
  return {
    id: `partisymbol-${letter}`,
    term: "",
    termImage: key,
    definition: name,
    group: `parti-${letter}`,
  };
});

// Ömsesidigt uteslutande dubbletter: text-par (partiledare) som pekar på SAMMA
// parti som ett bildpar ska få SAMMA group.
const TEXT_PAIR_GROUPS = {
  p20: "parti-m",
  p21: "parti-s",
  p22: "parti-v",
  p23: "parti-sd",
  p24: "parti-kd",
};

async function getArea() {
  const snap = await db.doc(DOC_PATH).get();
  if (!snap.exists) throw new Error(`Området ${DOC_PATH} hittades inte.`);
  return { id: AREA, ...snap.data() };
}

async function main() {
  console.log(`Mål: ${isEmulator ? "EMULATOR" : "LIVE"}`);
  const area = await getArea();
  const before = (area.pairs || []).length;

  // Additivt: lägg bara till partibilds-par som inte redan finns (per id).
  const existingIds = new Set((area.pairs || []).map((p) => p.id));
  const toAdd = PARTY_PAIRS.filter((p) => !existingIds.has(p.id));
  area.pairs = [...(area.pairs || []), ...toAdd];

  // Idempotent: sätt "group" på rätt par utan att röra något annat.
  const groupById = new Map(PARTY_PAIRS.map((p) => [p.id, p.group]));
  for (const [id, group] of Object.entries(TEXT_PAIR_GROUPS)) groupById.set(id, group);
  let grouped = 0;
  for (const p of area.pairs) {
    const g = groupById.get(p.id);
    if (g && p.group !== g) {
      p.group = g;
      grouped++;
    }
  }

  // Kör HELA området genom valideringen innan sparning.
  const res = validateArea(area);
  if (!res.ok) {
    console.error("✗ Validering misslyckades – sparar INTE:");
    res.errors.forEach((e) => console.error("   - " + e));
    process.exit(1);
  }

  const imgPairs = res.value.pairs.filter((p) => p.termImage || p.defImage);
  console.log(`Område: ${res.value.name} (${AREA})`);
  console.log(`Par: ${before} → ${res.value.pairs.length} (+${toAdd.length} nya bildpar)`);
  console.log(`Bildpar totalt: ${imgPairs.length}`);
  imgPairs.forEach((p) => console.log(`   ${p.termImage || p.defImage} ↔ "${p.definition || p.term}"`));
  const withGroup = res.value.pairs.filter((p) => p.group);
  console.log(`Par med group: ${withGroup.length} (${grouped} uppdaterade denna körning)`);

  if (!WRITE) {
    console.log("\nTorrkörning (validerat, inte sparat). Kör med --write för att spara.");
    return;
  }
  // Skriv tillbaka HELA området (validate.js normaliserar) – utan id-fältet.
  const { id, ...toWrite } = res.value;
  await db.doc(DOC_PATH).set(toWrite);
  console.log("\n✓ Sparat till Firestore. 🎉");
}

main().catch((e) => {
  console.error("Fel:", e.message);
  process.exit(1);
});
