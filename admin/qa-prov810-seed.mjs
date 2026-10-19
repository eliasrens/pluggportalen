// QA #810 (helskärmsläget): lägger ett prov (4 frågor) ägt av qaarskurs4 i emulatorn.
// Körs efter admin/qa-larkonton-seed.mjs + qa-larkonton-roller-seed.mjs. Provet går
// genom validateProv (som när läraren sparar) så att facit får alla fält.
import { auth, db, isEmulator, teacherUsernameToEmail } from "./_shared.mjs";
import { validateProv } from "../src/prov/prov-validera.js";
if (!isEmulator) { console.error("Bara mot emulatorn."); process.exit(1); }
const u4 = (await auth.getUserByEmail(teacherUsernameToEmail("qaarskurs4"))).uid;
const { value } = validateProv({
  namn: "QA Vikingar 810",
  fragor: [
    { typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland", "Skåne"], ratt: 0, poang: 1 },
    { typ: "flerval", fraga: "Vad hette Odens häst?", alternativ: ["Sleipner", "Fenrir"], ratt: 0, poang: 1 },
    { typ: "kortsvar", fraga: "Vad kallades vikingarnas skrivtecken?", godkanda: ["runor"], poang: 1 },
    { typ: "fritext", fraga: "Beskriv en vikingagård.", poang: 2 },
  ],
});
await db.collection("prov").doc("qa810").set({ ...value, createdBy: u4, createdByName: "Årskurs 4", skapad: new Date(), andrad: new Date() });
console.log("prov qa810 klart");
