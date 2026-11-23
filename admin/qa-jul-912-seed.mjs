// ============================================================================
// QA-seed för Jul-djuren (#912) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs + qa-larkonton-roller-seed.mjs (elever 4a01–4a04,
// lilla123). Sätter config/season = vinter med Jul PÅ (ALDRIG prod) och ger
// 4a01 Alva 6 000 mynt, 30 äpplen (Mysterymat) och ett julklappsägg med Renis
// som är kläckklart direkt (köpt för två dygn sedan) – så kläckning och matning
// går att prova utan att vänta. Används av admin/qa-jul-912-preview.sh.
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

await db.doc("config/season").set({ season: "vinter", halloween: false, jul: true, julUntil: null });
const alva = (await db.collection("students").where("username", "==", "4a01").get()).docs[0]?.id;
if (!alva) throw new Error("4a01 saknas – kör qa-larkonton-roller-seed.mjs först");
const agg = { id: "qa912renis", eggBoughtAt: Date.now() - 2 * 24 * 3600 * 1000, hasHeatLamp: false,
  speciesId: null, hatchedAt: null, stage: 0, feedCount: 0, lastFedAt: null, name: null, pos: { x: 50, y: 78 }, eggSpecies: "renis" };
await db.doc(`studentData/${alva}`).set({ coins: 6000, appleCount: 30, pets: [agg], agdaDjur: { [agg.id]: "jul-djur-renis" } }, { merge: true });
console.log(`✓ Jul på (vinter), ${alva} (4a01): 6 000 mynt, 30 äpplen, kläckklart julklappsägg (Renis).`);
