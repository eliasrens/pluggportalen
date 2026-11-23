// ============================================================================
// QA-seed för slut-QA:n Vinter/Jul (#913) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs, qa-larkonton-roller-seed.mjs och
// qa-klasscenter-by-seed.mjs (klass qa-kc, elever kc01–kc14, lilla123).
//   * config/season = vinter + Jul + Halloween (hela kombinationen, ALDRIG prod)
//   * kc01 Alva: 40 000 mynt, 30 äpplen, ett kläckklart julklappsägg (Renis)
//   * kc02–kc14: köpta husskal (jul, Halloween, legendariska, vanliga) så att
//     byn visar snö på köpta hus (QA 24)
// Används av admin/qa-vinter-jul-913-preview.sh.
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

await db.doc("config/season").set({
  season: "vinter", halloween: true, halloweenUntil: null, jul: true, julUntil: null,
  updatedAt: new Date(), updatedBy: "qa-seed",
});

const agg = { id: "qa913renis", eggBoughtAt: Date.now() - 2 * 24 * 3600 * 1000, hasHeatLamp: false,
  speciesId: null, hatchedAt: null, stage: 0, feedCount: 0, lastFedAt: null, name: null, pos: { x: 50, y: 78 }, eggSpecies: "renis" };
await db.doc("studentData/kc01").set({ coins: 40000, appleCount: 30, pets: [agg], agdaDjur: { [agg.id]: "jul-djur-renis" } }, { merge: true });

const HUS = ["jul-pepparkakshus", "jul-tomteverkstad", "jul-snohydda", "hw-spokhus", "hw-pumpahus", "hw-skallehus",
  "maktpyramid", "kandisvilla", "drakgrotta", "slott", "vulkan", "cyberpunk", "tradkoja"];
for (let i = 0; i < HUS.length; i++) {
  const uid = `kc${String(i + 2).padStart(2, "0")}`;
  await db.doc(`studentData/${uid}`).set({ husSkalId: HUS[i], ownedItems: [HUS[i]] }, { merge: true });
}
console.log("✓ vinter + Jul + Halloween; kc01 40 000 mynt + julklappsägg; kc02–kc14 köpta hus:", HUS.join(", "));
process.exit(0);
