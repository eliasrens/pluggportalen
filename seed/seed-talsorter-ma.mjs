// ============================================================================
// Riktad seed: talsorter-området under ämnet "ma" (Admin SDK).
// ----------------------------------------------------------------------------
//   node seed/seed-talsorter-ma.mjs           (torrkörning – genererar, validerar, visar antal)
//   node seed/seed-talsorter-ma.mjs --write   (skriver till Firestore)
//
// Innehållet GENERERAS programmatiskt (korrekta facit) av
// seed/talsorter-generator.mjs – ~200 objekt: quiz, text-par och läsförståelse-
// texter. Hela området körs genom src/validate.js innan skrivning.
//
// Skriver ENDAST:
//   • subjects/ma                       (merge – rör INTE name/order; fyller bara
//                                         i saknade fält så ämnet finns fristående)
//   • subjects/ma/areas/talsorter       (merge – hela det validerade området)
// Rör INTE subjects/ma/areas/matematiska-begrepp (ägs av annat område/issue).
//
// Går via Admin SDK (admin/_shared.mjs) – kräver service-account-creds. Mot
// emulatorn: sätt FIRESTORE_EMULATOR_HOST (se docs/ADMIN.md). Idempotent: stabila
// id:n + deterministisk generator ger samma dokument varje körning.
// ============================================================================

import { validateArea } from "../src/validate.js";
import { generateTalsorter } from "./talsorter-generator.mjs";

const WRITE = process.argv.includes("--write");
// Samma emulator-detektering som admin/_shared.mjs, men UTAN att importera
// Admin SDK:t – så torrkörningen fungerar även utan firebase-admin/creds. Själva
// db-handtaget laddas dynamiskt först i --write-grenen.
const isEmulator =
  !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const SUBJECT_ID = "ma";
const AREA_ID = "talsorter";
const SUBJECT_PATH = `subjects/${SUBJECT_ID}`;
const AREA_PATH = `${SUBJECT_PATH}/areas/${AREA_ID}`;

// Standardvärden för ämnet – används BARA för att fylla i fält som saknas (så
// ämnet är användbart om denna seed körs fristående). Befintliga name/order rörs
// aldrig (merge + only-if-missing).
const SUBJECT_DEFAULTS = {
  name: "Matematik",
  order: 2,
  icon: "🔢",
  description: "Tal, räkning, geometri och problemlösning.",
};

async function main() {
  console.log(
    `Riktad seed → ${isEmulator ? "EMULATOR" : "LIVE"} ${WRITE ? "(SKRIVER)" : "(torrkörning)"}`
  );

  // 1) Generera + validera innehållet.
  const generated = generateTalsorter();
  const areaInput = {
    id: AREA_ID,
    name: "Talsorter och platsvärde",
    order: 1,
    coverEmoji: "🔢",
    grade: "ak4",
    description:
      "Ental, tiotal, hundratal och tusental. Lär dig vilken talsort en siffra står på, " +
      "bygg tal av talsorter, jämför tal och växla mellan talsorterna.",
    ...generated,
  };
  const res = validateArea(areaInput);
  if (!res.ok) {
    console.error("✗ Validering misslyckades – seedar INTE:");
    res.errors.slice(0, 15).forEach((e) => console.error("   - " + e));
    process.exit(1);
  }
  const area = res.value;

  // 2) Rapportera antal per typ. quiz[] delas upp i läsförståelse-frågor (med
  //    källtext "passage") och rena räkne-frågor (utan) – lägena håller isär dem.
  const las = area.quiz.filter((q) => typeof q.passage === "string" && q.passage.trim()).length;
  const rakne = area.quiz.length - las;
  console.log(`  Ämne:   ${SUBJECT_ID} — "${SUBJECT_DEFAULTS.name}" (om det saknas)`);
  console.log(`  Område: ${area.id} — "${area.name}" (grade=${area.grade ?? "—"})`);
  console.log(
    `  Innehåll: ${area.texts.length} texter · ${area.quiz.length} quiz (${rakne} räkne + ${las} läsförståelse) · ${area.pairs.length} par` +
      ` = ${area.texts.length + area.quiz.length + area.pairs.length} objekt`
  );
  console.log(`  Övningstyper: ${area.exerciseTypes.join(", ") || "—"}`);

  if (!WRITE) {
    console.log("\nTorrkörning klar. Inget skrevs. Kör med --write för att skriva till Firestore.");
    return;
  }

  // Ladda Admin SDK:t först nu (kräver firebase-admin + service-account-creds).
  const { db } = await import("../admin/_shared.mjs");

  // 3) Ämnet: merge, men fyll bara i fält som saknas (rör inte name/order).
  const subjSnap = await db.doc(SUBJECT_PATH).get();
  const existing = subjSnap.exists ? subjSnap.data() : {};
  const subjectPayload = {};
  for (const [k, v] of Object.entries(SUBJECT_DEFAULTS)) {
    if (existing[k] === undefined) subjectPayload[k] = v;
  }
  if (Object.keys(subjectPayload).length > 0) {
    await db.doc(SUBJECT_PATH).set(subjectPayload, { merge: true });
    console.log(`\nÄmnet ${SUBJECT_PATH}: fyllde i ${Object.keys(subjectPayload).join(", ")}.`);
  } else {
    console.log(`\nÄmnet ${SUBJECT_PATH} fanns redan – lämnade name/order orört.`);
  }

  // 4) Området: skriv hela det validerade dokumentet (utan id-fältet).
  const { id, ...toWrite } = area;
  await db.doc(AREA_PATH).set(toWrite, { merge: true });
  console.log(`Skrev ${AREA_PATH} (${area.texts.length + area.quiz.length + area.pairs.length} objekt). 🎉`);
}

main().catch((e) => {
  console.error("Fel:", e.message);
  process.exit(1);
});
