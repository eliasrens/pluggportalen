// ============================================================================
// QA-seed för Prov Etapp 2 (#749) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs + admin/qa-larkonton-roller-seed.mjs och lägger
// till ett SO-område "QA Prov 2 – alla sorter" (Årskurs 4 äger det) med varje
// sort som "Hämta från område" (§10) gör om, och kantfallen:
//   quiz        4 vanliga (en med 7 alternativ → hoppas över, en med dubbletter)
//   passage     2 texter med 2 + 1 frågor (samma text = ett textblock)
//   pairs       12 par (→ två para-frågor 6 + 6), 2 med bara bild (varning)
//   timeline    6 händelser, två från samma år (varning), ett f.Kr.
//   readingTexts 1 ämnestext med 3 frågor + 1 gammal nivåtext (tas aldrig med)
// Tar också bort Live-lobbyn för 4A (#743 F9 – stör inte provet).
// ============================================================================

import { auth, db, isEmulator, teacherUsernameToEmail } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}
const u4 = (await auth.getUserByEmail(teacherUsernameToEmail("qaarskurs4"))).uid;
const q = (question, options, answerIndex, passage) => ({ question, options, answerIndex, explanation: "", ...(passage ? { passage } : {}) });
const P1 = "Vikingarna bodde i långhus. I långhuset fanns en eld i mitten som gav värme och ljus. Familjen sov på bänkar längs väggarna.";
const P2 = "Birka var en viktig handelsplats i Mälaren. Dit kom köpmän från många länder för att byta varor.";

await db.doc("subjects/so/areas/qa-prov2").set({
  name: "QA Prov 2 – alla sorter",
  order: 9,
  coverEmoji: "🧪",
  description: "Testområde för Hämta från område (#749).",
  createdBy: u4,
  createdByName: "Årskurs 4",
  exerciseTypes: ["quiz", "memory", "tidsjakt", "amneslasning"],
  quiz: [
    q("Vad hette vikingarnas gud för åska?", ["Tor", "Oden", "Loke", "Frej"], 0),
    q("Vad kallades vikingarnas skepp?", ["Långskepp", "Kogg", "Galär", "Fregatt", "Karavell", "Djonk", "Jakt"], 0),
    q("Vilket år brukar vikingatiden sägas börja?", ["793", "1066", "500"], 0),
    q("Vilket alternativ står två gånger?", ["Runor", "runor", "Mynt"], 2),
    q("Vad fanns i mitten av långhuset?", ["En eld", "Ett bord", "En brunn"], 0, P1),
    q("Var sov familjen?", ["På bänkar", "I sängar", "På golvet"], 0, P1),
    q("Var låg Birka?", ["I Mälaren", "På Gotland", "I Skåne"], 0, P2),
  ],
  pairs: [
    { id: "p1", term: "Oden", definition: "Gudarnas kung" },
    { id: "p2", term: "Tor", definition: "Gud för åska" },
    { id: "p3", term: "Frej", definition: "Gud för växtlighet" },
    { id: "p4", term: "Loke", definition: "Listig jätte bland gudarna" },
    { id: "p5", term: "Valhall", definition: "Odens hall för stupade" },
    { id: "p6", term: "Runsten", definition: "Sten med inristade runor" },
    { id: "p7", term: "Tingsplats", definition: "Där man löste tvister" },
    { id: "p8", term: "Träl", definition: "Ofri person" },
    { id: "p9", term: "Jarl", definition: "Mäktig hövding" },
    { id: "p10", term: "Birka", definition: "Handelsplats i Mälaren" },
    { id: "p11", term: "Långskepp", definition: "Snabbt krigsskepp" },
    { id: "p12", term: "Futhark", definition: "Runalfabetet" },
    { id: "p13", term: "", termImage: "https://upload.wikimedia.org/qa-bild.png", definition: "Torshammare" },
    { id: "p14", term: "Yggdrasil", definition: "", defImage: "https://upload.wikimedia.org/qa-bild2.png" },
  ],
  timeline: [
    { id: "e1", event: "Anfallet mot Lindisfarne", year: 793, explanation: "" },
    { id: "e2", event: "Slaget vid Hastings", year: 1066, explanation: "" },
    { id: "e3", event: "Birka grundas", year: 750, explanation: "" },
    { id: "e4", event: "Harald Blåtand döps", year: 965, explanation: "" },
    { id: "e5", event: "Jellingstenen restes", year: 965, explanation: "" },
    { id: "e6", event: "Rom grundas (enligt sägnen)", year: -753, explanation: "" },
  ],
  readingTexts: [
    {
      id: "qa-amnes-1", title: "Livet på en vikingagård", level: 2, category: "fakta",
      body: "På en vikingagård hjälpte alla till. Barnen vallade djur och hämtade vatten. De vuxna odlade korn och smidde verktyg. På vintern satt man inne och vävde tyg.",
      questions: [
        { question: "Vad gjorde barnen?", options: ["Vallade djur", "Smidde svärd", "Seglade"], answerIndex: 0 },
        { question: "Vad odlade de vuxna?", options: ["Korn", "Potatis", "Majs"], answerIndex: 0 },
        { question: "Vad gjorde man på vintern?", options: ["Vävde tyg", "Badade", "Seglade"], answerIndex: 0 },
      ],
    },
    { title: "Gammal nivåtext", levels: { 1: "kort", 2: "längre" } },
  ],
});
await db.doc("liveSessions/qa-roller-lobby").delete();
console.log("✓ subjects/so/areas/qa-prov2 (Årskurs 4) – quiz, passage, 14 par, 6 händelser, ämnestext + gammal nivåtext.");
process.exit(0);
