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
    id: "lr-g1-mars", title: "Den röda planeten", textType: "fact", topic: "rymden",
    body: [
      "Mars är en planet. Mars ser röd ut. Marken är full av rött damm.",
      "På Mars är det mycket kallt. Där finns ingen luft att andas.",
      "Inga människor har varit på Mars. Men det finns robotar där. De kör runt och tar bilder.",
    ],
    q: [
      ["Vilken färg har Mars?", ["Röd", "Blå", "Grön", "Vit"], "fakta"],
      ["Varför ser Mars röd ut?", ["Rött damm på marken", "Röd eld överallt", "Röda blommor", "Röda moln"], "fakta"],
      ["Hur är det på Mars?", ["Mycket kallt", "Mycket varmt", "Blött och grönt", "Fullt av folk"], "fakta"],
      ["Vad gör robotarna på Mars?", ["Tar bilder", "Bygger hus", "Planterar träd", "Letar efter folk"], "fakta"],
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
  {
    id: "lr-g1-nasan", title: "Näsan", textType: "fact", topic: "vetenskap",
    body: [
      "Mitt i ansiktet sitter näsan. Med näsan kan du känna lukter.",
      "Du känner när maten luktar gott. Du känner också när något luktar illa.",
      "Vi andas genom näsan. Små hår i näsan stoppar damm.",
      "När något kittlar i näsan nyser vi. Atjo!",
    ],
    q: [
      ["Var sitter näsan?", ["Mitt i ansiktet", "Uppe på huvudet", "Bakom örat", "Under hakan"], "fakta"],
      ["Vad stoppar de små håren i näsan?", ["Damm", "Vatten", "Mat", "Ljud"], "fakta"],
      ["Vad gör vi när något kittlar i näsan?", ["Nyser", "Skrattar", "Hostar", "Gäspar"], "fakta"],
      ["Vad betyder ”luktar illa”?", ["Luktar inte gott", "Luktar mycket gott", "Låter högt", "Smakar sött"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g1-oronen", title: "Våra öron", textType: "fact", topic: "vetenskap",
    body: [
      "Vi har två öron. Med öronen hör vi ljud.",
      "Vi hör fåglar som sjunger. Vi hör när någon pratar. Vi hör musik.",
      "Ljud som är för starka kan skada öronen. Därför har man hörselskydd när det låter mycket.",
      "Öronen hjälper oss också att hålla balansen.",
    ],
    q: [
      ["Hur många öron har vi?", ["Två", "Ett", "Tre", "Fyra"], "fakta"],
      ["Vad kan skada öronen?", ["För starka ljud", "Kallt vatten", "Mjuk musik", "Fågelsång"], "fakta"],
      ["Vad är hörselskydd till för?", ["Att skydda öronen", "Att hålla värmen", "Att se bättre", "Att höra bättre"], "ordforstaelse"],
      ["Vad handlar texten mest om?", ["Vad öronen gör", "Hur man sjunger", "Hur fåglar låter", "Var musik görs"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g1-cykeln", title: "Cykeln", textType: "fact", topic: "teknik",
    body: [
      "En cykel har två hjul. Du trampar på pedalerna. Då snurrar hjulen och cykeln rullar.",
      "Du styr med styret. När du vill stanna bromsar du.",
      "På cykeln ska det finnas en ringklocka. När det är mörkt behövs lampor.",
      "Ha alltid hjälm på huvudet när du cyklar!",
    ],
    q: [
      ["Hur många hjul har en cykel?", ["Två", "Tre", "Fyra", "Ett"], "fakta"],
      ["Vad trampar du på?", ["Pedalerna", "Styret", "Sadeln", "Ringklockan"], "fakta"],
      ["Vad gör du med styret?", ["Styr cykeln", "Bromsar", "Ringer", "Trampar"], "ordforstaelse"],
      ["Vad ska du ha på huvudet när du cyklar?", ["Hjälm", "Mössa", "Keps", "Hörlurar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-klockan", title: "Klockan", textType: "fact", topic: "teknik",
    body: [
      "Klockan visar vad tiden är. Många klockor har tolv siffror i en ring.",
      "På klockan finns två visare. Visarna går runt, runt. Den korta visaren visar timmar. Den långa visaren visar minuter.",
      "Klockan i telefonen har inga visare. Där står bara siffror.",
    ],
    q: [
      ["Hur många siffror har många klockor?", ["Tolv", "Tio", "Sex", "Tjugo"], "fakta"],
      ["Vad visar den korta visaren?", ["Timmar", "Minuter", "Dagar", "Sekunder"], "fakta"],
      ["Vad visar den långa visaren?", ["Minuter", "Timmar", "Veckor", "År"], "fakta"],
      ["Vad gör en klocka?", ["Visar tiden", "Spelar musik", "Lyser i mörkret", "Väcker hunden"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g1-dinosaurierna", title: "Dinosaurierna", textType: "fact", topic: "historia",
    body: [
      "För mycket, mycket länge sedan levde dinosaurierna. Det var långt innan det fanns människor.",
      "Vissa dinosaurier var stora som hus. Andra var små som hönor. Vissa åt växter. Andra åt kött.",
      "Nu är dinosaurierna borta. Men fåglarna är släkt med dem. Vi hittar deras ben i marken.",
    ],
    q: [
      ["När levde dinosaurierna?", ["För mycket länge sedan", "För hundra år sedan", "I somras", "Förra veckan"], "fakta"],
      ["Vad åt dinosaurierna?", ["Växter eller kött", "Bara fisk", "Bara frukt", "Bara insekter"], "fakta"],
      ["Vilka djur är släkt med dinosaurierna?", ["Fåglarna", "Fiskarna", "Katterna", "Hästarna"], "fakta"],
      ["Vad hittar vi i marken?", ["Deras ben", "Deras hus", "Deras kläder", "Deras leksaker"], "fakta"],
    ],
  },
  {
    id: "lr-g1-hast-och-vagn", title: "Häst och vagn", textType: "fact", topic: "historia",
    body: [
      "Förr fanns det inga bilar. Då åkte folk häst och vagn.",
      "Det gick inte så fort. En resa kunde ta många dagar.",
      "Hästen behövde vila, vatten och mat. Den åt hö och havre.",
      "I dag åker vi bil, buss och tåg. Hästar ser vi mest på ridskolan.",
    ],
    q: [
      ["Vad betyder ”förr”?", ["För länge sedan", "I morgon", "Just nu", "Nästa år"], "ordforstaelse"],
      ["Hur åkte folk förr?", ["Med häst och vagn", "Med flygplan", "Med buss", "Med bil"], "fakta"],
      ["Hur lång tid kunde en resa ta?", ["Många dagar", "En minut", "En timme", "En sekund"], "fakta"],
      ["Vad åt hästen?", ["Hö och havre", "Kött och fisk", "Bröd och smör", "Glass och kakor"], "fakta"],
    ],
  },
  {
    id: "lr-g1-italien", title: "Landet som ser ut som en stövel", textType: "fact", topic: "geografi",
    body: [
      "Italien är ett land i södra Europa. På kartan ser landet ut som en stövel.",
      "I Italien är det ofta varmt på sommaren. Där växer citroner och oliver.",
      "Pizza kommer från Italien. Där äter man också mycket pasta.",
      "Huvudstaden heter Rom. Där finns många gamla hus.",
    ],
    q: [
      ["Vad ser Italien ut som på kartan?", ["En stövel", "En boll", "En fisk", "En hatt"], "fakta"],
      ["Vad växer i Italien?", ["Citroner och oliver", "Bananer och kokos", "Ananas och mango", "Lingon och hjortron"], "fakta"],
      ["Vilken mat kommer från Italien?", ["Pizza", "Sushi", "Tacos", "Köttbullar"], "fakta"],
      ["Vad heter huvudstaden i Italien?", ["Rom", "Paris", "Oslo", "Madrid"], "fakta"],
    ],
  },
  {
    id: "lr-g1-finland", title: "Finland", textType: "fact", topic: "geografi",
    body: [
      "Finland är ett grannland till Sverige. Det ligger öster om Sverige.",
      "I Finland finns väldigt många sjöar. Där finns också stora skogar.",
      "I Finland pratar man finska. En del pratar svenska.",
      "I Finland badar många bastu. Många hem har en egen bastu.",
    ],
    q: [
      ["Åt vilket håll från Sverige ligger Finland?", ["Öster", "Väster", "Söder", "Norr"], "fakta"],
      ["Vad finns det väldigt många av i Finland?", ["Sjöar", "Berg", "Öknar", "Vulkaner"], "fakta"],
      ["Vilket språk pratar man i Finland?", ["Finska", "Tyska", "Engelska", "Danska"], "fakta"],
      ["Vad har många hem i Finland?", ["En egen bastu", "En egen fotbollsplan", "En stor pool", "En lång båt"], "fakta"],
    ],
  },
  {
    id: "lr-g1-havet", title: "Havet", textType: "fact", topic: "natur",
    body: [
      "Havet är mycket stort. Det kan vara djupare än höga berg.",
      "Vattnet i havet är salt. Det kan man inte dricka.",
      "I havet bor många djur. Där finns fiskar, maneter och stora valar.",
      "Längst ner är havet mörkt och kallt. Dit når inget solljus.",
    ],
    q: [
      ["Hur smakar vattnet i havet?", ["Salt", "Sött", "Surt", "Som saft"], "fakta"],
      ["Kan man dricka vattnet i havet?", ["Nej", "Ja", "Bara på sommaren", "Bara när det regnar"], "fakta"],
      ["Vilka djur bor i havet?", ["Fiskar och valar", "Kor och hästar", "Ekorrar och älgar", "Katter och hundar"], "fakta"],
      ["Hur är det längst ner i havet?", ["Mörkt och kallt", "Ljust och varmt", "Ljust och kallt", "Mörkt och varmt"], "fakta"],
    ],
  },
  {
    id: "lr-g1-djungeln", title: "Djungeln", textType: "fact", topic: "geografi",
    body: [
      "Djungeln är en stor och tät skog. Den finns i varma länder.",
      "I djungeln regnar det nästan varje dag. Därför är allt grönt och blött.",
      "Träden är mycket höga. Högt uppe bor apor och färgglada fåglar.",
      "Nere på marken krälar ormar. Många djur finns bara i djungeln.",
    ],
    q: [
      ["Vad är en djungel?", ["En stor tät skog", "En stor torr öken", "Ett stort hav", "Ett högt berg"], "ordforstaelse"],
      ["Hur ofta regnar det i djungeln?", ["Nästan varje dag", "Nästan aldrig", "En gång om året", "Bara de kalla dagarna"], "fakta"],
      ["Vilka djur bor högt uppe i träden?", ["Apor och fåglar", "Kor och får", "Fiskar och krabbor", "Älgar och rävar"], "fakta"],
      ["Varför är allt grönt och blött?", ["Det regnar mycket", "Det snöar ofta", "Solen skiner aldrig", "Havet är nära"], "fakta"],
    ],
  },
];
