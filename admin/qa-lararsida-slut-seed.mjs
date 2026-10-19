// ============================================================================
// QA-seed för slut-QA Lärarsidan (#809) – BARA mot emulatorn. Körs sist av
// admin/qa-lararsida-slut-preview.sh. Ger 4B övat-datum (members.<uid>.ovat i
// classProjections, samma fält som awardExercise skriver) så att Hem kan visa
// "Övat den här veckan" och "N elever i 4B har inte övat på 2 veckor":
//   Ebba 20 dagar sedan · Fadi i dag · Gry inget datum (räknas som inaktiv
//   eftersom datumen bevisligen sparats > 14 dagar i klassen).
// 4A lämnas utan datum – där ska raden "Övat …" inte synas förrän en elev övat.
// ============================================================================

import { auth, db, isEmulator, usernameToEmail } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const dag = (forskjut) => {
  const d = new Date();
  d.setDate(d.getDate() - forskjut);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = async (username) => (await auth.getUserByEmail(usernameToEmail(username))).uid;
const [ebba, fadi, gry] = await Promise.all(["4b01", "4b02", "4b03"].map(uid));
await db.doc("classProjections/4b").set({
  members: {
    [ebba]: { namn: "Ebba", ovat: dag(20) },
    [fadi]: { namn: "Fadi", ovat: dag(0) },
    [gry]: { namn: "Gry" },
  },
}, { merge: true });
console.log("✓ 4B: övat-datum (Ebba 20 d, Fadi i dag, Gry inget) → Övat 1 av 3, 2 inaktiva.");
process.exit(0);
