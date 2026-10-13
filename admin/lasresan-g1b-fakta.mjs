// ============================================================================
// Läsresan – källtexter för nivå 1, fact, del B (issue #661)
// ----------------------------------------------------------------------------
// 20 fact-texter, 30–50 ord, 3–4 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g1b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-1-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g1-fisken", title: "Fisken", textType: "fact", topic: "djur",
    body: [
      "Fisken bor i vatten. Där letar den efter mat.",
      "Fisken andas med gälar. Gälarna sitter på sidan av huvudet.",
      "Fisken har fenor. Med fenorna simmar den. Kroppen är ofta täckt av fjäll.",
      "Vissa fiskar bor i sjöar. Andra bor i havet.",
    ],
    q: [
      ["Vad andas fisken med?", ["Gälar", "Fenor", "Fjäll", "Näsan"], "fakta"],
      ["Vad gör fisken med fenorna?", ["Simmar", "Äter", "Andas", "Sover"], "fakta"],
      ["Vad är fiskens kropp ofta täckt av?", ["Fjäll", "Päls", "Fjädrar", "Taggar"], "fakta"],
      ["Var sitter gälarna?", ["På sidan av huvudet", "Längst ut på svansen", "Mitt på ryggen", "Under magen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-kon", title: "Kon", textType: "fact", topic: "djur",
    body: [
      "Kon bor på en bondgård. Den äter gräs och hö.",
      "Kon ger mjölk. Bonden mjölkar kon varje dag. Av mjölken kan man göra ost och smör.",
      "En kalv är en liten ko.",
      "Kon säger ”mu”. På sommaren går korna ute i hagen.",
    ],
    q: [
      ["Vad äter kon?", ["Gräs och hö", "Kött och fisk", "Frukt och bär", "Bröd och kakor"], "fakta"],
      ["Vad kan man göra av mjölken?", ["Ost och smör", "Saft och sylt", "Mjöl och gryn", "Te och honung"], "fakta"],
      ["Vad är en kalv?", ["En liten ko", "En stor häst", "En sorts ost", "En gammal bonde"], "ordforstaelse"],
      ["Var går korna på sommaren?", ["Ute i hagen", "Inne i ladan", "I skogen", "På vägen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-snigeln", title: "Snigeln", textType: "fact", topic: "djur",
    body: [
      "Snigeln är ett litet djur. Den rör sig mycket sakta.",
      "Vissa sniglar har ett hus på ryggen. Huset är ett hårt skal. Där kan snigeln gömma sig.",
      "Snigeln lämnar ett spår av slem. Slemmet gör att den glider fram.",
      "Sniglar tycker om när det är blött.",
    ],
    q: [
      ["Hur rör sig snigeln?", ["Mycket sakta", "Mycket fort", "Med stora hopp", "Med vingar"], "fakta"],
      ["Vad kan vissa sniglar ha på ryggen?", ["Ett hus", "Taggar", "Fjädrar", "En svans"], "fakta"],
      ["Vad lämnar snigeln efter sig?", ["Ett spår av slem", "Ett spår av sand", "Små fjädrar", "Små hål"], "fakta"],
      ["Vilket väder tycker sniglar om?", ["Blött väder", "Torrt väder", "Snöigt väder", "Blåsigt väder"], "fakta"],
    ],
  },
  {
    id: "lr-g1-salen", title: "Sälen", textType: "fact", topic: "djur",
    body: [
      "Sälen bor i havet. Den är en bra simmare.",
      "Sälen har tjockt fett under huden. Fettet håller den varm. Vattnet är ofta kallt.",
      "Sälen äter fisk. Den kan dyka djupt.",
      "Ibland ligger sälen på en sten. Där vilar den i solen.",
    ],
    q: [
      ["Var bor sälen?", ["I havet", "I skogen", "I öknen", "På berget"], "fakta"],
      ["Vad håller sälen varm?", ["Fettet under huden", "Ett varmt bo", "Ett tjockt täcke", "Varmt vatten"], "fakta"],
      ["Vad äter sälen?", ["Fisk", "Gräs", "Bär", "Nötter"], "fakta"],
      ["Var vilar sälen ibland?", ["På en sten", "I ett träd", "I en båt", "Under isen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-humlan", title: "Humlan", textType: "fact", topic: "djur",
    body: [
      "Humlan är en insekt. Den är rund och har mjukt hår. Den har ofta gula och svarta ränder.",
      "Humlan flyger från blomma till blomma. Den suger nektar. Nektar är en söt saft i blomman.",
      "Humlan surrar när den flyger. Den stickas nästan aldrig.",
    ],
    q: [
      ["Vad är humlan?", ["En insekt", "En fågel", "En fisk", "En groda"], "fakta"],
      ["Vad är nektar?", ["En söt saft", "Ett sorts blad", "En liten frukt", "Ett sorts frö"], "ordforstaelse"],
      ["Vad gör humlan när den flyger?", ["Surrar", "Sjunger", "Visslar", "Piper"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur humlan lever", "Hur man odlar blommor", "Hur bin gör honung", "Hur fåglar flyger"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g1-molnen", title: "Molnen", textType: "fact", topic: "natur",
    body: [
      "Molnen finns på himlen. De är gjorda av små, små droppar vatten.",
      "Små vita moln syns ofta när det är fint väder. Mörka moln kan ge regn.",
      "När dropparna blir tunga faller de ner. Då regnar det.",
      "På vintern kan molnen ge snö.",
    ],
    q: [
      ["Vad är molnen gjorda av?", ["Små droppar vatten", "Små bitar bomull", "Rök från eld", "Damm och sand"], "fakta"],
      ["Vad kan mörka moln ge?", ["Regn", "Sol", "Sand", "Blommor"], "fakta"],
      ["När faller dropparna ner?", ["När de blir tunga", "När det blir mörkt", "När solen skiner", "När det blåser"], "fakta"],
      ["Vad kan molnen ge på vintern?", ["Snö", "Sol", "Äpplen", "Löv"], "fakta"],
    ],
  },
  {
    id: "lr-g1-hosten", title: "Hösten", textType: "fact", topic: "natur",
    body: [
      "Efter sommaren kommer hösten. Då blir dagarna kortare och kallare.",
      "Löven på träden byter färg. De blir gula, röda och bruna. Sedan faller de ner på marken.",
      "Många fåglar flyger till varmare länder.",
      "I skogen växer svamp.",
    ],
    q: [
      ["Vad kommer efter sommaren?", ["Hösten", "Våren", "Vintern", "Julen"], "fakta"],
      ["Vilka färger får löven?", ["Gula, röda och bruna", "Blå, lila och rosa", "Svarta och vita", "Rosa och gröna"], "fakta"],
      ["Vart flyger många fåglar?", ["Till varmare länder", "Till kallare länder", "Upp i bergen", "In i husen"], "fakta"],
      ["Vad växer i skogen på hösten?", ["Svamp", "Jordgubbar", "Tulpaner", "Snödroppar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-maskrosen", title: "Maskrosen", textType: "fact", topic: "natur",
    body: [
      "Maskrosen är en gul blomma. Den växer nästan överallt. Den kan växa i gräset och vid vägen.",
      "När den har blommat blir den en vit boll. Bollen är full av små frön.",
      "Du kan blåsa på bollen. Då flyger fröna iväg. Där de landar kan nya maskrosor växa.",
    ],
    q: [
      ["Vilken färg har maskrosens blomma?", ["Gul", "Röd", "Blå", "Lila"], "fakta"],
      ["Vad blir maskrosen när den har blommat?", ["En vit boll", "En röd boll", "Ett litet äpple", "Ett grönt blad"], "fakta"],
      ["Vad är bollen full av?", ["Små frön", "Små bin", "Vatten", "Socker"], "fakta"],
      ["Vad händer när du blåser på bollen?", ["Fröna flyger iväg", "Bollen blir gul", "Blomman växer", "Bollen blir större"], "fakta"],
    ],
  },
  {
    id: "lr-g1-stjarnorna", title: "Stjärnorna", textType: "fact", topic: "rymden",
    body: [
      "På natten kan vi se stjärnor på himlen. De ser ut som små prickar av ljus.",
      "Men stjärnorna är inte små. De är solar. De är mycket långt bort. Därför ser de små ut.",
      "Solen är också en stjärna. Den är stjärnan som är närmast oss.",
    ],
    q: [
      ["När kan vi se stjärnorna?", ["På natten", "Mitt på dagen", "Vid lunch", "När solen skiner"], "fakta"],
      ["Vad är stjärnorna?", ["Solar", "Lampor", "Planeter", "Moln"], "ordforstaelse"],
      ["Varför ser stjärnorna små ut?", ["De är långt bort", "De är mycket små", "De är bakom moln", "De är nya"], "fakta"],
      ["Vilken stjärna är närmast oss?", ["Solen", "Månen", "Polstjärnan", "Jorden"], "fakta"],
    ],
  },
  {
    id: "lr-g1-jorden", title: "Jorden", textType: "fact", topic: "rymden",
    body: [
      "Vi bor på planeten jorden. Jorden är rund som en boll.",
      "Det mesta av jorden är täckt av vatten. Därför ser den blå ut från rymden.",
      "Jorden åker runt solen. Det tar ett helt år. Månen åker runt jorden.",
    ],
    q: [
      ["Vilken form har jorden?", ["Rund som en boll", "Platt som en tallrik", "Fyrkantig som en låda", "Lång som en korv"], "fakta"],
      ["Vad täcker det mesta av jorden?", ["Vatten", "Sand", "Skog", "Is"], "fakta"],
      ["Hur lång tid tar det för jorden att åka runt solen?", ["Ett år", "En dag", "En vecka", "En timme"], "fakta"],
      ["Vad är jorden?", ["En planet", "En stjärna", "En måne", "En sol"], "ordforstaelse"],
    ],
  },
];
