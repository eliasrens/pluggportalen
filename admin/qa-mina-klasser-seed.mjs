// ============================================================================
// QA-seed för Mina klasser (#804) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs + admin/qa-larkonton-roller-seed.mjs och lägger
// till det #804 behöver visa:
//   * 4 klasser till (4D, 5D, Studion, Flex) → admin har 10 klasser = sökbar
//     rullgardin; qaarskurs4 har 4A + 4B = knappar
//   * områden med långa namn ("Svensk historia under stormaktstiden" …) så att
//     hela områdesnamn syns i Vad eleverna ser
//   * moduler: 4A har Ekvationsresan på, 4B har Bråkresan dold och Schack på –
//     resten av opt-in-modulerna är av (nedtonade "· av" i Hur går det?)
// Används av admin/qa-mina-klasser-preview.sh. Lösenord lilla123 (emulator).
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";
import { areas } from "../seed/seed-data.js";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

for (const [id, name, order] of [["4d", "4D", 4], ["5d", "5D", 7], ["studion", "Studion", 20], ["flex", "Flex", 21]]) {
  await db.doc(`classes/${id}`).set({ name, order, studentIds: [] }, { merge: true });
}

const { id: vid, ...vik } = areas.so[0];
const langa = [
  ["svensk-historia", "Svensk historia under stormaktstiden", "🦕"],
  ["valet-demokrati", "Valet och demokratin i Sverige", "🗳️"],
  ["vasatiden-lang", "Vasatiden och reformationen", "📜"],
];
for (const [i, [id, name, coverEmoji]] of langa.entries()) {
  await db.doc(`subjects/so/areas/${id}`).set({ ...vik, name, coverEmoji, order: 10 + i });
}
await db.doc(`subjects/so/areas/${vid}-talsorter`).set({ ...vik, name: "Skiljetecken, vokaler och dubbelteckning", order: 20 });

await db.doc("classes/4a").set({ enabledModules: ["ekvationsresan"], hiddenModules: [] }, { merge: true });
await db.doc("classes/4b").set({ enabledModules: ["schack"], hiddenModules: ["brakresan"] }, { merge: true });
console.log("✓ Mina klasser: 10 klasser för admin, långa områdesnamn, moduler av/på i 4A/4B.");
process.exit(0);
