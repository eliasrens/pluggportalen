// ============================================================================
// QA-seed för 🎄 Jul-fliken (#910, Tester) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs + qa-larkonton-roller-seed.mjs (elever 4a01–4a04,
// lilla123). Sätter config/season = vinter med Jul PÅ (ALDRIG prod) och ger
// 4a01 Alva 6 000 mynt. Används av admin/qa-jul-910-preview.sh.
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

await db.doc("config/season").set({ season: "vinter", halloween: false, jul: true, julUntil: null });
const alva = (await db.collection("students").where("username", "==", "4a01").get()).docs[0]?.id;
if (!alva) throw new Error("4a01 saknas – kör qa-larkonton-roller-seed.mjs först");
await db.doc(`studentData/${alva}`).set({ coins: 6000 }, { merge: true });
console.log(`✓ Jul på (vinter), ${alva} (4a01) har 6 000 mynt.`);
