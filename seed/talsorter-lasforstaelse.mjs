// ============================================================================
// Pluggportalen – läsförståelse-frågor om talsorter (åk4)
// ----------------------------------------------------------------------------
// Handskrivna flervalsfrågor MED egen källtext ("passage"). Varje fråga bär en
// kort passage hämtad ur faktatexterna (seed/talsorter-texts.mjs) och testar
// FÖRSTÅELSE av texten – inte räkning. Läsförståelse-läget (startLasforstaelse)
// visar q.passage ovanför frågan och kör bara frågor som har en passage.
//
// Varför skilt från den programmatiska generatorn (talsorter-generator.mjs):
//   • generatorns quiz = RENA RÄKNE-frågor (utan passage) → driver Quiz,
//     Kunskapsjakt och Fånga sanningar.
//   • dessa läs-frågor (MED passage) → driver Läsförståelse.
// De ligger i SAMMA quiz[]-lista i det seedade området, men lägena håller isär
// dem på passage-fältet (se src/game-shared.js plainQuizPool + startLasforstaelse).
//
// Format per fråga (se src/validate.js):
//   { id, passage, question, options[4], answerIndex, explanation }
// answerIndex varieras 0–3 så rätt svar inte alltid hamnar på samma plats.
// ============================================================================

export const TALSORTER_LASFORSTAELSE = [
  // --- Text: "Vad är talsorter?" -------------------------------------------
  {
    id: "q-las-01",
    passage:
      "Ett tal byggs upp av talsorter. De fyra vanligaste är ental, tiotal, hundratal och tusental.",
    question: "Vilka är de fyra vanligaste talsorterna enligt texten?",
    options: [
      "Ental, tiotal, hundratal och tusental",
      "Ental, femtal, tiotal och hundratal",
      "Tiotal, hundratal, tusental och miljontal",
      "Ettor, tvåor, treor och fyror",
    ],
    answerIndex: 0,
    explanation: "Texten räknar upp de fyra vanligaste talsorterna: ental, tiotal, hundratal och tusental.",
  },
  {
    id: "q-las-02",
    passage:
      "Varje siffra i ett tal står på en bestämd plats, och platsen bestämmer siffrans värde. Samma siffra kan vara värd olika mycket beroende på var den står.",
    question: "Vad bestämmer en siffras värde enligt texten?",
    options: [
      "Hur stor siffran ser ut",
      "Platsen där siffran står",
      "Hur många siffror talet har",
      "Vilken färg siffran har",
    ],
    answerIndex: 1,
    explanation: "Texten säger att platsen bestämmer siffrans värde – samma siffra kan vara värd olika mycket.",
  },
  {
    id: "q-las-03",
    passage:
      "I talet 3 482 står 3 på tusentalsplatsen, 4 på hundratalsplatsen, 8 på tiotalsplatsen och 2 på entalsplatsen. Siffran 4 är alltså värd 400, eftersom den står på hundratalsplatsen.",
    question: "Varför är siffran 4 värd 400 i talet 3 482, enligt texten?",
    options: [
      "För att den är den största siffran",
      "För att den står först i talet",
      "För att den står på hundratalsplatsen",
      "För att 4 alltid är värt 400",
    ],
    answerIndex: 2,
    explanation: "Texten förklarar att 4 är värd 400 eftersom den står på hundratalsplatsen.",
  },
  {
    id: "q-las-04",
    passage:
      "I talet 3 482 står 3 på tusentalsplatsen, 4 på hundratalsplatsen, 8 på tiotalsplatsen och 2 på entalsplatsen.",
    question: "Vilken siffra står på tiotalsplatsen i talet 3 482 enligt texten?",
    options: ["3", "4", "2", "8"],
    answerIndex: 3,
    explanation: "Enligt texten står siffran 8 på tiotalsplatsen i talet 3 482.",
  },

  // --- Text: "Platsvärde" ---------------------------------------------------
  {
    id: "q-las-05",
    passage: "Platsvärdet talar om hur mycket en siffra är värd utifrån sin plats.",
    question: "Vad talar platsvärdet om enligt texten?",
    options: [
      "Hur mycket en siffra är värd utifrån sin plats",
      "Hur många platser ett tal har",
      "Vilken siffra som är störst",
      "Hur man skriver tecknet större än",
    ],
    answerIndex: 0,
    explanation: "Texten säger att platsvärdet talar om hur mycket en siffra är värd utifrån sin plats.",
  },
  {
    id: "q-las-06",
    passage:
      "Längst till höger står entalen, som är värda 1 styck. Nästa plats är tiotalen (värda 10), sedan hundratalen (värda 100) och sedan tusentalen (värda 1 000).",
    question: "Vilken talsort står längst till höger enligt texten?",
    options: ["Tusentalen", "Entalen", "Hundratalen", "Tiotalen"],
    answerIndex: 1,
    explanation: "Texten säger att entalen står längst till höger.",
  },
  {
    id: "q-las-07",
    passage:
      "För att räkna ut värdet av en siffra multiplicerar du siffran med platsens värde. Siffran 6 på hundratalsplatsen är därför värd 6 × 100 = 600.",
    question: "Hur räknar du ut värdet av en siffra enligt texten?",
    options: [
      "Du lägger ihop alla siffror i talet",
      "Du delar siffran med tio",
      "Du multiplicerar siffran med platsens värde",
      "Du drar bort platsens värde",
    ],
    answerIndex: 2,
    explanation: "Texten säger att du multiplicerar siffran med platsens värde, t.ex. 6 × 100 = 600.",
  },
  {
    id: "q-las-08",
    passage:
      "Nästa plats är tiotalen (värda 10), sedan hundratalen (värda 100) och sedan tusentalen (värda 1 000).",
    question: "Hur mycket är ett hundratal värt enligt texten?",
    options: ["10", "1", "1 000", "100"],
    answerIndex: 3,
    explanation: "Texten anger att hundratalen är värda 100.",
  },

  // --- Text: "Att växla mellan talsorter" -----------------------------------
  {
    id: "q-las-09",
    passage:
      "Tio ental blir ett tiotal, tio tiotal blir ett hundratal och tio hundratal blir ett tusental. Det kallas att växla.",
    question: "Vad blir tio tiotal när du växlar, enligt texten?",
    options: ["Ett hundratal", "Ett tusental", "Ett tiotal", "Hundra ental"],
    answerIndex: 0,
    explanation: "Texten säger att tio tiotal blir ett hundratal.",
  },
  {
    id: "q-las-10",
    passage: "När du räknar och kommer upp i tio av en talsort växlar du upp till nästa.",
    question: "När växlar du upp till nästa talsort enligt texten?",
    options: [
      "Direkt när du börjar räkna",
      "När du kommer upp i tio av en talsort",
      "När du kommer upp i fem av en talsort",
      "När talet blir jämnt",
    ],
    answerIndex: 1,
    explanation: "Texten säger att du växlar upp när du kommer upp i tio av en talsort.",
  },
  {
    id: "q-las-11",
    passage: "Talsorterna hänger ihop tio och tio. Det är därför vårt talsystem kallas tiosystemet.",
    question: "Vad kallas vårt talsystem enligt texten?",
    options: ["Femsystemet", "Hundrasystemet", "Tiosystemet", "Entalssystemet"],
    answerIndex: 2,
    explanation: "Texten förklarar att talsystemet kallas tiosystemet eftersom talsorterna hänger ihop tio och tio.",
  },
  {
    id: "q-las-12",
    passage: "Har du 10 tiotal kan du växla dem till 1 hundratal.",
    question: "Vad kan du växla 10 tiotal till enligt texten?",
    options: ["1 tusental", "10 hundratal", "1 tiotal", "1 hundratal"],
    answerIndex: 3,
    explanation: "Texten säger att 10 tiotal kan växlas till 1 hundratal.",
  },

  // --- Text: "Att jämföra tal" ----------------------------------------------
  {
    id: "q-las-13",
    passage: "När du jämför två tal börjar du med den största talsorten längst till vänster.",
    question: "Var börjar du när du jämför två tal enligt texten?",
    options: [
      "Med den största talsorten längst till vänster",
      "Med entalen längst till höger",
      "Med den mittersta siffran",
      "Med det tal som har flest siffror",
    ],
    answerIndex: 0,
    explanation: "Texten säger att du börjar med den största talsorten längst till vänster.",
  },
  {
    id: "q-las-14",
    passage:
      "Talet 4 300 är större än 4 030, för fastän båda har 4 tusental har 4 300 fler hundratal.",
    question: "Varför är 4 300 större än 4 030 enligt texten?",
    options: [
      "För att 4 300 har fler tusental",
      "För att 4 300 har fler hundratal",
      "För att 4 030 har en nolla",
      "För att talen är lika stora",
    ],
    answerIndex: 1,
    explanation: "Texten förklarar att båda har 4 tusental, men 4 300 har fler hundratal och är därför störst.",
  },
  {
    id: "q-las-15",
    passage: "Tecknet > betyder 'större än' och < betyder 'mindre än'.",
    question: "Vad betyder tecknet < enligt texten?",
    options: ["Större än", "Lika med", "Mindre än", "Ungefär"],
    answerIndex: 2,
    explanation: "Texten säger att tecknet < betyder 'mindre än'.",
  },
  {
    id: "q-las-16",
    passage: "Är tusentalen lika jämför du hundratalen, sedan tiotalen och sist entalen.",
    question: "Vilken talsort jämför du sist när talen är lika enligt texten?",
    options: ["Tusentalen", "Hundratalen", "Tiotalen", "Entalen"],
    answerIndex: 3,
    explanation: "Texten säger att du jämför entalen sist.",
  },

  // --- Text: "Att bygga tal av talsorter" -----------------------------------
  {
    id: "q-las-17",
    passage:
      "Du kan bygga ett tal genom att lägga ihop talsorterna. 2 tusental, 5 hundratal, 0 tiotal och 3 ental blir 2 000 + 500 + 0 + 3 = 2 503.",
    question: "Hur bygger du ett tal enligt texten?",
    options: [
      "Genom att lägga ihop talsorterna",
      "Genom att dra bort talsorterna",
      "Genom att multiplicera alla siffror",
      "Genom att ta bort nollorna",
    ],
    answerIndex: 0,
    explanation: "Texten säger att du bygger ett tal genom att lägga ihop talsorterna.",
  },
  {
    id: "q-las-18",
    passage:
      "Det är viktigt att skriva en nolla på de platser där en talsort saknas, annars hamnar de andra siffrorna på fel plats. Utan nollan skulle 2 503 bli 253, ett helt annat tal.",
    question: "Vad händer om du glömmer nollan i talet 2 503 enligt texten?",
    options: [
      "Talet blir 2 503 ändå",
      "Talet blir 253, ett helt annat tal",
      "Talet blir större",
      "Ingenting händer",
    ],
    answerIndex: 1,
    explanation: "Texten säger att utan nollan blir 2 503 i stället 253 – ett helt annat tal.",
  },

  // --- Text: "Nollans roll" -------------------------------------------------
  {
    id: "q-las-19",
    passage:
      "Nollan är en platshållare. Den visar att en talsort saknas, men håller ändå de andra siffrorna på rätt plats.",
    question: "Vilken roll har nollan enligt texten?",
    options: [
      "Den gör talet dubbelt så stort",
      "Den tar bort en talsort",
      "Den är en platshållare som visar att en talsort saknas",
      "Den byter plats på siffrorna",
    ],
    answerIndex: 2,
    explanation: "Texten säger att nollan är en platshållare som visar att en talsort saknas.",
  },
  {
    id: "q-las-20",
    passage:
      "I talet 5 070 finns inga hundratal och inga ental, men nollorna gör att 5 hamnar på tusentalsplatsen och 7 på tiotalsplatsen.",
    question: "Vilka talsorter saknas i talet 5 070 enligt texten?",
    options: ["Tusental och tiotal", "Bara entalen", "Inga alls", "Hundratal och ental"],
    answerIndex: 3,
    explanation: "Texten säger att det inte finns några hundratal och inga ental i 5 070.",
  },
  {
    id: "q-las-21",
    passage:
      "Tar man bort nollorna blir talet 57, vilket är fel. Därför skriver vi alltid ut nollorna inuti ett tal.",
    question: "Vad blir talet 5 070 om man tar bort nollorna enligt texten?",
    options: ["57", "570", "5 070", "507"],
    answerIndex: 0,
    explanation: "Texten säger att om man tar bort nollorna blir talet 57, vilket är fel.",
  },
];
