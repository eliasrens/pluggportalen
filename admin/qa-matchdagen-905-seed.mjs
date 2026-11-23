// ============================================================================
// QA-seed för #905 (Matchdagen: lästext till frågorna) – BARA mot emulatorn. Körs efter
// admin/qa-matchdagen-874-preview.sh med emulatorns miljö (portar.txt):
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-matchdagen-905-seed.mjs [alva-lastext] [bilal-lastext]
// Ämnet Läsning (qals/lasf): quiz med lästexter (kort, ~290 tecken, 400 tecken = över
// vänskapsgränsen 300, "Enligt texten") + frågor utan lästext, alla med förklaring.
// Alva (4a01) och Bilal (4a02) får området, klocka 30. lastext-argumenten:
// "saknas" (standard = fältet utelämnas), "true" eller "false".
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const P290 = "Maja vaknade tidigt på lördagen. Hon tog cykeln ner till sjön där morfar redan satt i båten " +
  "med två metspön. Vattnet var blankt och det luktade tång. Efter en timme hade de fått tre abborrar, " +
  "men Maja var mest glad över att hon själv hade satt på masken utan att morfar behövde hjälpa henne.";
const P400 = "Det var en gång en räv som bodde i en stor skog långt norrut. Varje vinter blev det svårare att " +
  "hitta mat, för snön låg djup och mössen gömde sig under den. Räven lärde sig då att lyssna: han stod " +
  "alldeles stilla, vinklade huvudet och hörde de små tassarna under snötäcket. Sedan hoppade han högt upp " +
  "i luften och dök med nosen före rakt ner i snön. Oftast fick han tag i en mus, men ibland bara en mun full snö.";
const q = (question, options, passage, explanation) => ({ question, options, answerIndex: 0, ...(passage ? { passage } : {}), explanation });

await db.doc("subjects/qals").set({ name: "Läsning", order: 92 });
await db.doc("subjects/qals/areas/lasf").set({
  name: "Läsförståelse", order: 1, coverEmoji: "📖",
  quiz: [
    q("Vad heter Sveriges huvudstad?", ["Stockholm", "Göteborg", "Malmö", "Uppsala"], null, "Stockholm har varit huvudstad sedan 1600-talet."),
    q("Enligt texten, vad gjorde Maja själv?", ["Satte på masken", "Rodde båten", "Lagade fisken", "Cyklade hem"], P290,
      "Det står i sista meningen: hon satte på masken utan hjälp."),
    q("Vad hette hunden?", ["Tass", "Bamse", "Luffe", "Sigge"], "Hunden Tass sprang runt i trädgården.", "Hundens namn står i första ordet efter Hunden."),
    q("Hur hittar räven mössen?", ["Han lyssnar", "Han gräver", "Han luktar", "Han väntar"], P400, "Räven står stilla och lyssnar efter tassarna."),
    q("Vilken färg får man om man blandar blått och gult?", ["Grönt", "Lila", "Orange", "Brunt"], null, "Blått och gult blir grönt."),
  ],
});
const cls = (await db.doc("classes/4a").get()).data() || {};
const aa = (cls.assignedAreas || []).filter((a) => a.subjectId !== "qals");
if (aa.length) aa.push({ subjectId: "qals", areaId: "lasf" });
await db.doc("classes/4a").update({ assignedAreas: aa });

const uid = async (u) => (await db.collection("students").where("username", "==", u).get()).docs[0]?.id;
const lastext = (a) => (a === "true" ? { lastext: true } : a === "false" ? { lastext: false } : {});
const [alva, bilal] = [await uid("4a01"), await uid("4a02")];
const inst = { omraden: ["qals/lasf"], tabeller: [], rakna: [], svarssatt: "flerval", klocka: 30, lugnt: false, paus: 60,
  foljPlugga: false, updatedAt: new Date(), updatedBy: "qa-seed" };
await db.doc(`matchdagenInst/${alva}`).set({ ...inst, ...lastext(process.argv[2]) });
await db.doc(`matchdagenInst/${bilal}`).set({ ...inst, ...lastext(process.argv[3]) });
console.log(`✓ #905: qals/lasf (5 frågor, 3 med lästext); Alva lastext=${process.argv[2] || "saknas"}, Bilal lastext=${process.argv[3] || "saknas"}; assignedAreas ${aa.length ? "+ qals/lasf" : "tom (allt)"}.`);
