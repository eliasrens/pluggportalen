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
  {
    id: "lr-g1-biltvatten", title: "Vi tvättar bilen", textType: "story", topic: "vardag",
    body: [
      "Edda och pappa ska tvätta bilen. Bilen är full av lera.",
      "Pappa tar fram en hink med vatten. Edda får en stor svamp.",
      "Hon gnuggar och gnuggar. Snart är bilen ren.",
      "Men nu är Edda blöt från topp till tå! Pappa skrattar.",
    ],
    q: [
      ["Vem tvättar bilen med Edda?", ["Pappa", "Mamma", "Morfar", "Storebror"], "fakta"],
      ["Vad är bilen full av?", ["Lera", "Snö", "Löv", "Sand"], "fakta"],
      ["Vad får Edda?", ["En stor svamp", "En liten borste", "En slang", "En handduk"], "fakta"],
      ["Vad händer med Edda till slut?", ["Hon blir blöt", "Hon somnar", "Hon blir arg", "Hon ramlar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-stadningen", title: "Under sängen", textType: "story", topic: "vardag",
    body: [
      "Idris ska städa sitt rum. Han lägger böckerna i hyllan. Han lägger kläderna i lådan.",
      "Sedan tittar han under sängen. Där är det mörkt och dammigt.",
      "Men vad är det där? Det är hans gröna bil! Den har varit borta länge.",
      "Städa är inte så dumt ändå.",
    ],
    q: [
      ["Var lägger Idris böckerna?", ["I hyllan", "I lådan", "På bordet", "Under sängen"], "fakta"],
      ["Hur är det under sängen?", ["Mörkt och dammigt", "Ljust och fint", "Varmt och blött", "Kallt och kladdigt"], "fakta"],
      ["Vad hittar Idris?", ["Sin gröna bil", "Sin röda boll", "En gammal sko", "En liten nalle"], "fakta"],
      ["Varför blir Idris glad?", ["Han hittar sin bil", "Han får glass", "Han får gå ut", "Han får en present"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g1-fisket", title: "Fiske med morfar", textType: "story", topic: "relationer",
    body: [
      "Svante och morfar sitter i en båt. De ska fiska.",
      "Morfar sätter en mask på kroken. Svante kastar ut linan. Sedan väntar de länge.",
      "Plötsligt rycker det i spöet! Svante drar upp en liten abborre.",
      "”Den är för liten”, säger morfar. Svante släpper tillbaka den i sjön.",
    ],
    q: [
      ["Var sitter Svante och morfar?", ["I en båt", "På en brygga", "På en sten", "På stranden"], "fakta"],
      ["Vad sätter morfar på kroken?", ["En mask", "En bit bröd", "En fluga", "En ost"], "fakta"],
      ["Vilken fisk får Svante?", ["En abborre", "En gädda", "En lax", "En torsk"], "fakta"],
      ["Varför släpper Svante tillbaka fisken?", ["Den är för liten", "Den är för stor", "Den är sjuk", "Den biter"], "fakta"],
    ],
  },
  {
    id: "lr-g1-applet", title: "Ett äpple till två", textType: "story", topic: "relationer",
    body: [
      "Rio och Lea leker på gården. De blir hungriga.",
      "Rio har ett äpple i fickan. Lea har ingenting.",
      "Rio tittar på äpplet. Sedan tittar han på Lea.",
      "Han ber fröken om hjälp. Fröken delar äpplet i två delar. Nu får båda varsin halva.",
      "Lea ler. ”Tack!”",
    ],
    q: [
      ["Var leker Rio och Lea?", ["På gården", "I skogen", "I simhallen", "På stranden"], "fakta"],
      ["Vad har Rio i fickan?", ["Ett äpple", "En banan", "En kaka", "Ett päron"], "fakta"],
      ["Hur många delar blir äpplet?", ["Två", "Tre", "Fyra", "Fem"], "fakta"],
      ["Hur är Rio mot Lea?", ["Snäll", "Elak", "Sur", "Rädd"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g1-forsta-stegen", title: "Lillasyster går", textType: "story", topic: "relationer",
    body: [
      "Tariq har en lillasyster. Hon heter Mia. Mia kan krypa fort. Men hon kan inte gå än.",
      "Mia står vid soffan. Tariq sätter sig en bit bort. Han håller ut armarna.",
      "Mia tar ett steg. Och ett till! Hon går ända fram till Tariq.",
      "Alla klappar i händerna.",
    ],
    q: [
      ["Vad heter Tariqs lillasyster?", ["Mia", "Mira", "Maja", "Moa"], "fakta"],
      ["Vad kan Mia göra fort?", ["Krypa", "Springa", "Hoppa", "Simma"], "fakta"],
      ["Vad gör Tariq med armarna?", ["Håller ut dem", "Viftar med dem", "Gömmer dem", "Korsar dem"], "fakta"],
      ["Vad handlar texten mest om?", ["Mias första steg", "Tariqs nya soffa", "En lek med boll", "Mias födelsedag"], "helhet_slutsats"],
    ],
  },
];
