// ============================================================================
// ENGÅNGS-backfill (#316): fyll saknat `namn` på ALLA classProjections-poster
// ----------------------------------------------------------------------------
// Kartan/byn läser classProjections/{classId}.members[uid] och ritar elevens
// namn. En gammal PARTIELL skriv-väg (award/self-publish innan #316) kunde skapa
// en members-entry med bara avatarId/xp/stars/completed men UTAN `namn` → kartan
// visade en trasig platshållare (rå-uid). Klienten läker numera detta framåt
// (identityFor-berikning + defensiv students/{id}-läsning, #316), men BEFINTLIGA
// glapp-poster (bekräftat i live: klass 4D, 10/22 saknade namn) behöver fyllas i
// en gång. Det här skriptet gör exakt det manuella lagandet av 4D, för ALLA
// klasser, idempotent: bara poster som SAKNAR namn (och username) rörs.
//
// Källa för namnet: students/{uid}.namn (+ username). students-dokumenten är
// intakta och skyddade av reglerna (isSelf/isTeacher) – det är bara projektionens
// denormaliserade kopia som glappade.
//
// TORRKÖRNING ÄR DEFAULT. Inget skrivs förrän du kör med --commit.
//
//   node admin/backfill-projection-names.mjs            # torrkörning (visar plan)
//   node admin/backfill-projection-names.mjs --commit   # skriver namn
//
// Kör helst mot emulatorn först:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node admin/backfill-projection-names.mjs --commit
//
// Admin SDK kringgår firestore.rules legitimt (server-nyckel). Se docs/ADMIN.md.
// Idempotent: kör om det så många gånger du vill – redan namngivna poster hoppas.
// ============================================================================

import { db, parseArgs, isEmulator } from "./_shared.mjs";

const { flags } = parseArgs();
const COMMIT = flags.has("commit");

/** Har posten redan ett visningsbart namn? (namn ELLER username räcker.) */
function hasName(entry) {
  const e = entry && typeof entry === "object" ? entry : {};
  return !!(e.namn || e.username);
}

async function main() {
  console.log(`\n=== Backfill projektions-namn (#316) – mål: ${isEmulator ? "EMULATOR" : "LIVE"} ===`);
  console.log(COMMIT ? "LÄGE: SKARP (--commit)\n" : "LÄGE: TORRKÖRNING (ingen skrivning)\n");

  const [projSnap, studentsSnap] = await Promise.all([
    db.collection("classProjections").get(),
    db.collection("students").get(),
  ]);

  // Uppslag uid -> { namn, username } ur students/{id} (den intakta källan).
  const studentById = new Map();
  for (const s of studentsSnap.docs) {
    const d = s.data() || {};
    studentById.set(s.id, { namn: d.namn || "", username: d.username || "" });
  }

  // Bygg per-klass en NÄSTLAD merge-patch { members: { <uid>: { namn,username } } }
  // för exakt de poster som saknar namn OCH går att laga (finns i students).
  // OBS: dot-notation ("members.uid.namn") gäller bara update(); set(...,{merge})
  // deep-mergar ett NÄSTLAT objekt in i members utan att röra andra medlemmar/fält.
  const plan = []; // { classId, patch:{members:{uid:{...}}}, ids:[uid...] }
  const missingSource = []; // glapp-poster vars uid saknar students-dok
  let missingTotal = 0;

  for (const p of projSnap.docs) {
    const members = (p.data() || {}).members || {};
    const membersPatch = {};
    const ids = [];
    for (const [uid, entry] of Object.entries(members)) {
      if (hasName(entry)) continue;
      missingTotal++;
      const src = studentById.get(uid);
      if (!src || !(src.namn || src.username)) {
        missingSource.push(`${p.id}/${uid}`);
        continue;
      }
      const fields = {};
      if (src.namn) fields.namn = src.namn;
      if (src.username) fields.username = src.username;
      membersPatch[uid] = fields;
      ids.push(uid);
    }
    if (ids.length) plan.push({ classId: p.id, patch: { members: membersPatch }, ids });
  }

  console.log(`Projektions-dokument:        ${projSnap.size}`);
  console.log(`Namnlösa poster totalt:      ${missingTotal}`);
  console.log(`Poster att laga:             ${plan.reduce((n, p) => n + p.ids.length, 0)}`);
  console.log(`Klasser att uppdatera:       ${plan.length}`);
  if (missingSource.length)
    console.log(`⚠ Namnlösa poster utan students-dok (kan ej lagas): ${missingSource.join(", ")}`);

  for (const p of plan) console.log(`   ${p.classId}: ${p.ids.join(", ")}`);

  if (!COMMIT) {
    console.log("\nTorrkörning klar. Kör med --commit för att skriva.");
    return;
  }
  if (plan.length === 0) {
    console.log("\nInget att göra – alla poster har redan namn. 🎉");
    return;
  }

  // En merge-skrivning per klass (fält-paths rör bara de namnlösa posternas
  // namn/username – inga andra fält eller medlemmar påverkas). Batcha i klumpar
  // om 400 (Firestore-gränsen är 500 skrivningar/batch).
  let ok = 0;
  const failed = [];
  for (let i = 0; i < plan.length; i += 400) {
    const chunk = plan.slice(i, i + 400);
    const batch = db.batch();
    for (const p of chunk) {
      batch.set(db.collection("classProjections").doc(p.classId), p.patch, { merge: true });
    }
    try {
      await batch.commit();
      ok += chunk.length;
    } catch (e) {
      chunk.forEach((p) => failed.push([p.classId, e.message]));
    }
  }

  console.log(`\nKlart: ${ok} klasser uppdaterade, ${failed.length} misslyckades.`);
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
