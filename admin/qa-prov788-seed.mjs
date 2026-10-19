// QA #788: lägger ett enkelt prov (2 flervalsfrågor) ägt av qaarskurs4 i emulatorn.
// Körs efter admin/qa-larkonton-seed.mjs + qa-larkonton-roller-seed.mjs.
import { auth, db, isEmulator, teacherUsernameToEmail } from "./_shared.mjs";
if (!isEmulator) { console.error("Bara mot emulatorn."); process.exit(1); }
const u4 = (await auth.getUserByEmail(teacherUsernameToEmail("qaarskurs4"))).uid;
const ref = db.collection("prov").doc("qa788");
await ref.set({
  namn: "QA Vikingar 788", createdBy: u4, createdByName: "Årskurs 4",
  fragor: [
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland", "Skåne"], ratt: 0, poang: 1 },
    { id: "q2", typ: "flerval", fraga: "Vad hette Odens häst?", alternativ: ["Sleipner", "Fenrir"], ratt: 0, poang: 1 },
  ],
  skapad: new Date(), andrad: new Date(),
});
console.log("prov qa788 klart");
