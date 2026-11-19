// ============================================================================
// QA-seed för Matchdagen 1a (#867) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs + admin/qa-larkonton-roller-seed.mjs (klasser,
// qaadmin, qaarskurs4 = 4A + 4B, elever 4a01–4a04 = Alva, Bilal, Cleo, Dante)
// och lägger till två Räkna-områden (generator) i Matematik. Ingen elev har
// Matchdagen från början – läraren slår på den i Mina klasser → Elever →
// Anpassningar per elev. MD_PA=1 slår på den för Alva (4a01) direkt, med
// tabellerna 3 och 7. Lösenord lilla123 (emulator). Används av
// admin/qa-matchdagen-867-preview.sh.
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const rakna = [
  ["md-addition", "Räkna: addition", { topic: "addition", variants: ["enkel", "uppstallning"] }],
  ["md-blandat", "Räkna: plus och minus", { topics: [{ topic: "addition", variants: ["enkel"] }, { topic: "subtraktion", variants: ["enkel"] }] }],
];
for (const [i, [id, name, generator]] of rakna.entries()) {
  await db.doc(`subjects/matte/areas/${id}`).set({ name, order: 50 + i, coverEmoji: "🔢", exerciseTypes: ["generator"], generator });
}
if (process.env.MD_PA === "1") {
  const alva = (await db.collection("students").where("username", "==", "4a01").get()).docs[0]?.id;
  if (alva) {
    await db.doc("classes/4a").update({ elevModuler: { [alva]: ["matchdagen"] } });
    await db.doc(`matchdagenInst/${alva}`).set({ omraden: [], tabeller: [3, 7], rakna: [], svarssatt: "flerval",
      klocka: 0, lugnt: false, paus: 60, updatedAt: new Date(), updatedBy: "qa-seed" });
  }
}
console.log(`✓ Matchdagen: Räkna-områden i Matematik${process.env.MD_PA === "1" ? ", Matchdagen på för Alva (4a01)" : ""}.`);
process.exit(0);
