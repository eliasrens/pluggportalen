// ============================================================================
// ENGÅNGS-backfill: denormalisera klasstillhörighet till students/{id}.classIds
// ----------------------------------------------------------------------------
// Klassbyn (#/elev/by) låter en elev läsa sina KLASSKAMRATERS students/studentData
// (namn, avatar, hus, palett). firestore.rules avgör "samma klass" via fältet
// students/{id}.classIds (en lista klass-id:n) – reglerna kan inte loopa över
// classes-kollektionen. Fältet underhålls framåt av data.setClassStudents/
// deleteClass, men BEFINTLIGA klasser saknar det tills detta skript körts en gång.
//
// Skriptet läser alla classes/{id}.studentIds och sätter varje elevs classIds =
// exakt de klasser eleven ingår i (ersätter hela fältet, så borttagningar städas).
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --commit.
//
//   node admin/backfill-class-ids.mjs            # torrkörning (visar plan)
//   node admin/backfill-class-ids.mjs --commit   # skriver classIds
//
// Kör helst mot emulatorn först:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node admin/backfill-class-ids.mjs --commit
//
// Kör mot LIVE i SAMMA steg som firestore.rules deployas (annars ger byn
// "missing permissions" tills classIds finns). Se docs/ADMIN.md.
// ============================================================================

import { db, parseArgs, isEmulator } from "./_shared.mjs";

const { flags } = parseArgs();
const COMMIT = flags.has("commit");

async function main() {
  console.log(`\n=== Backfill classIds – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`);
  console.log(COMMIT ? "LÄGE: SKARP (--commit)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");

  const [studentsSnap, classesSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("classes").get(),
  ]);

  // Bygg elev -> lista klass-id:n utifrån varje klass studentIds.
  const wanted = new Map(); // studentId -> Set(classId)
  for (const s of studentsSnap.docs) wanted.set(s.id, new Set());
  for (const c of classesSnap.docs) {
    const ids = Array.isArray(c.data().studentIds) ? c.data().studentIds : [];
    for (const sid of ids) {
      if (!wanted.has(sid)) wanted.set(sid, new Set()); // elev i klass men utan students-dok
      wanted.get(sid).add(c.id);
    }
  }

  const sortedEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const plan = [];
  for (const s of studentsSnap.docs) {
    const target = [...(wanted.get(s.id) || new Set())].sort();
    const current = Array.isArray(s.data().classIds) ? [...s.data().classIds].sort() : [];
    if (!sortedEq(target, current)) plan.push({ id: s.id, from: current, to: target });
  }

  // Elever som listas i en klass men saknar students-dokument (kan inte backfillas).
  const missingDocs = [...wanted.keys()].filter((id) => !studentsSnap.docs.some((d) => d.id === id));

  console.log(`Elever totalt:            ${studentsSnap.size}`);
  console.log(`Klasser totalt:           ${classesSnap.size}`);
  console.log(`Elever att uppdatera:     ${plan.length}`);
  if (missingDocs.length)
    console.log(`⚠ Klassmedlemmar utan students-dok (hoppas över): ${missingDocs.join(", ")}`);

  for (const p of plan)
    console.log(`   ${p.id}: [${p.from.join(", ")}] → [${p.to.join(", ")}]`);

  if (!COMMIT) {
    console.log("\nTorrkörning klar. Kör med --commit för att skriva.");
    return;
  }

  let ok = 0;
  const failed = [];
  // Batcha i klumpar om 400 (Firestore-gränsen är 500 skrivningar/batch).
  for (let i = 0; i < plan.length; i += 400) {
    const chunk = plan.slice(i, i + 400);
    const batch = db.batch();
    for (const p of chunk) {
      batch.set(db.collection("students").doc(p.id), { classIds: p.to }, { merge: true });
    }
    try {
      await batch.commit();
      ok += chunk.length;
    } catch (e) {
      chunk.forEach((p) => failed.push([p.id, e.message]));
    }
  }

  console.log(`\nKlart: ${ok} uppdaterade, ${failed.length} misslyckades.`);
  if (failed.length) {
    failed.forEach(([id, msg]) => console.log(`   ✗ ${id}: ${msg}`));
    process.exit(1);
  }
  console.log("\nBackfill klar. 🎉");
}

main().catch((e) => {
  console.error("✗ Oväntat fel:", e.message);
  process.exit(1);
});
