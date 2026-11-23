// ============================================================================
// QA-seed för #899 (Matchdagen följer det som är synligt) – BARA mot emulatorn. Körs EFTER
// admin/qa-matchdagen-874-preview.sh:s seed (MD_VANSKAP=1). Klassen 4A ser BARA
// Räkna: addition (assignedAreas = [matte/md-addition]).
//   Alva (4a01): inga egna inställningar → standarden "Samma som Plugga" → bara additionsfrågor.
//   Bilal (4a02): "Välj områden själv" med ett DOLT Plugga-område (so/vikingar…) + Räkna: plus
//   och minus (dolt) → inga frågor efter filtret; panelen visar dem gråade.
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn.");
  process.exit(1);
}
const elev = async (username) => (await db.collection("students").where("username", "==", username).get()).docs[0].id;
const [alva, bilal] = [await elev("4a01"), await elev("4a02")];
const so = (await db.collection("subjects/so/areas").get()).docs.map((d) => d.id)[0];
await db.doc("classes/4a").update({ assignedAreas: [{ subjectId: "matte", areaId: "md-addition" }] });
await db.doc(`matchdagenInst/${alva}`).delete();
await db.doc(`matchdagenInst/${bilal}`).set({
  omraden: [`so/${so}`], tabeller: [], rakna: ["matte/md-blandat"], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60,
  updatedAt: new Date(), updatedBy: "qa",
});
console.log(`✓ #899: 4A ser bara matte/md-addition; Alva standard, Bilal väljer dolda (so/${so}, matte/md-blandat).`);
