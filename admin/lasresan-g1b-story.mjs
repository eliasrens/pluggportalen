// ============================================================================
// Läsresan – källtexter för nivå 1, story, del B (issue #661)
// ----------------------------------------------------------------------------
// 20 story-texter, 30–50 ord, 3–4 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g1b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-1-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-g1-bonan", title: "Bönan i koppen", textType: "story", topic: "skola",
    body: [
      "Klassen ska så bönor. Alla får en kopp med jord. Mateo lägger en böna i sin kopp.",
      "Han vattnar varje dag. Koppen står i fönstret.",
      "En morgon ser Mateo något grönt. Ett litet blad tittar upp!",
      "Mateo ler stort. Hans böna växer.",
    ],
    q: [
      ["Vad ska klassen så?", ["Bönor", "Blommor", "Gräs", "Morötter"], "fakta"],
      ["Var står koppen?", ["I fönstret", "På golvet", "I hallen", "Under bordet"], "fakta"],
      ["Vad ser Mateo en morgon?", ["Ett litet blad", "En stor blomma", "En liten mask", "Ett gult bär"], "fakta"],
      ["Hur känner sig Mateo i slutet?", ["Glad", "Arg", "Ledsen", "Rädd"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g1-utflykten", title: "Bussen till djurparken", textType: "story", topic: "skola",
    body: [
      "I dag åker klassen buss. De ska till en djurpark. Klara sitter längst bak.",
      "I djurparken ser de en giraff. Den har en lång hals. Den äter blad högt upp.",
      "Sedan ser de apor. En apa hänger i svansen.",
      "Klara vill komma tillbaka snart.",
    ],
    q: [
      ["Hur åker klassen?", ["Med buss", "Med tåg", "Med båt", "Med bil"], "fakta"],
      ["Var sitter Klara?", ["Längst bak", "Längst fram", "Bredvid fröken", "Vid dörren"], "fakta"],
      ["Vad har giraffen?", ["En lång hals", "En kort svans", "Stora horn", "Vassa taggar"], "fakta"],
      ["Vad gör en apa?", ["Hänger i svansen", "Äter blad", "Sover i gräset", "Simmar i dammen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-biblioteket", title: "En bok om hajar", textType: "story", topic: "skola",
    body: [
      "Klassen går till biblioteket. Frans letar efter en bok.",
      "Han vill läsa om hajar. Han frågar en vuxen. Hon visar en hylla.",
      "Där står en bok med en blå haj på. Frans lånar boken.",
      "Hemma läser han den med mamma. Hajar har många tänder!",
    ],
    q: [
      ["Vart går klassen?", ["Till biblioteket", "Till simhallen", "Till parken", "Till affären"], "fakta"],
      ["Vad vill Frans läsa om?", ["Hajar", "Hästar", "Bilar", "Rymden"], "fakta"],
      ["Vad finns på boken?", ["En blå haj", "En röd bil", "En stor val", "En liten fisk"], "fakta"],
      ["Vem läser Frans boken med?", ["Mamma", "Pappa", "Fröken", "Morfar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-pyjamas", title: "Pyjamas i skolan", textType: "story", topic: "roliga situationer",
    body: [
      "Noa kommer till skolan. Hon stannar i dörren.",
      "Alla barn har pyjamas på sig! Fröken har en mössa med tofs.",
      "Oj! I dag är det pyjamasdag. Det har Noa glömt.",
      "Fröken skrattar. Hon ger Noa en filt. Nu är Noa också klar för pyjamasdag.",
    ],
    q: [
      ["Var stannar Noa?", ["I dörren", "Vid tavlan", "På gården", "Vid bänken"], "fakta"],
      ["Vad har alla barn på sig?", ["Pyjamas", "Regnkläder", "Badkläder", "Finkläder"], "fakta"],
      ["Vad har Noa glömt?", ["Att det är pyjamasdag", "Att ta med matsäck", "Att det är lov", "Sin gympapåse"], "fakta"],
      ["Vad ger fröken Noa?", ["En filt", "En kudde", "En mössa", "En bok"], "fakta"],
    ],
  },
  {
    id: "lr-g1-polen", title: "Hoppa i pölen", textType: "story", topic: "vardag",
    body: [
      "Det har regnat hela natten. Nu finns det en stor pöl på gården.",
      "Majid tar på sig gula stövlar. Han springer ut.",
      "Plask! Han hoppar rakt i pölen. Vattnet stänker högt.",
      "Majid hoppar igen och igen. Han skrattar. Det är det bästa han vet.",
    ],
    q: [
      ["Hur länge har det regnat?", ["Hela natten", "Hela veckan", "En kort stund", "En hel månad"], "fakta"],
      ["Vilken färg har stövlarna?", ["Gula", "Röda", "Blå", "Gröna"], "fakta"],
      ["Vad händer när Majid hoppar i pölen?", ["Vattnet stänker högt", "Stövlarna går sönder", "Pölen försvinner", "Han ramlar"], "fakta"],
      ["Hur känner sig Majid?", ["Glad", "Trött", "Arg", "Rädd"], "mellan_raderna"],
    ],
  },
];
