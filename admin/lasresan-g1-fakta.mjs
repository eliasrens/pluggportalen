// ============================================================================
// Läsresan – källtexter för nivå 1, fact (issue #521, epic #516)
// ----------------------------------------------------------------------------
// 15 fact-texter, 30–50 ord, 3–4 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g1-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-1.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g1-igelkotten", title: "Igelkotten", textType: "fact", topic: "djur",
    body: [
      "Igelkotten är ett litet djur. Den har många taggar.",
      "Taggarna är vassa. När igelkotten blir rädd rullar den ihop sig. Då blir den en taggig boll.",
      "Igelkotten äter maskar och sniglar. Den är vaken på natten.",
      "På vintern sover igelkotten. Den sover hela vintern.",
    ],
    q: [
      ["Vad har igelkotten många av?", ["Taggar", "Fjädrar", "Fenor", "Horn"], "fakta"],
      ["Vad gör igelkotten när den blir rädd?", ["Rullar ihop sig", "Springer därifrån", "Klättrar upp", "Gräver ner sig"], "fakta"],
      ["Vad äter igelkotten?", ["Maskar och sniglar", "Gräs och blad", "Frukt och svampar", "Fisk och krabbor"], "fakta"],
      ["Vilken årstid sover igelkotten?", ["Vintern", "Sommaren", "Våren", "Hösten"], "fakta"],
    ],
  },
  {
    id: "lr-g1-katten", title: "Katten", textType: "fact", topic: "djur",
    body: [
      "Katten är ett husdjur. Den har mjuk päls och långa morrhår.",
      "När katten är glad spinner den. Det låter som ett litet brum.",
      "Katten tvättar sig med tungan. Den kan se bra i mörker.",
      "Katten tycker om att sova. Den sover många timmar varje dag.",
    ],
    q: [
      ["Vad gör katten när den är glad?", ["Spinner", "Skäller", "Visslar", "Sjunger"], "fakta"],
      ["Vad tvättar katten sig med?", ["Tungan", "Svansen", "Vatten", "Morrhåren"], "fakta"],
      ["Hur låter det när katten spinner?", ["Som ett litet brum", "Som en hög vissling", "Som ett högt skall", "Som en stor klocka"], "fakta"],
      ["Vad tycker katten om att göra?", ["Sova", "Bada", "Simma", "Gräva"], "fakta"],
    ],
  },
  {
    id: "lr-g1-algen", title: "Älgen", textType: "fact", topic: "djur",
    body: [
      "Älgen är ett stort djur. Den bor i skogen. Den har långa ben.",
      "Hanen har stora horn. Hornen faller av på vintern. Sedan växer nya horn ut.",
      "Älgen äter blad, kvistar och gräs.",
      "En älgunge kallas kalv. Kalven följer sin mamma.",
    ],
    q: [
      ["Var bor älgen?", ["I skogen", "I havet", "I öknen", "I staden"], "fakta"],
      ["Vem har stora horn?", ["Hanen", "Honan", "Kalven", "Alla älgar"], "fakta"],
      ["När faller hornen av?", ["På vintern", "På sommaren", "På våren", "Aldrig"], "fakta"],
      ["Vad kallas en älgunge?", ["Kalv", "Kid", "Föl", "Lamm"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g1-honan", title: "Hönan", textType: "fact", topic: "djur",
    body: [
      "Hönan är en fågel. Den bor på en gård.",
      "Hönan säger ”kackel, kackel”. Tuppen säger ”kuckeliku”.",
      "Hönan värper ägg. Ibland kläcks ett ägg. Då kommer en liten kyckling ut.",
      "Kycklingen är gul och mjuk. Den piper och följer sin mamma.",
    ],
    q: [
      ["Var bor hönan?", ["På en gård", "I skogen", "I en sjö", "I en stad"], "fakta"],
      ["Vad säger tuppen?", ["Kuckeliku", "Kackel", "Pip pip", "Mu"], "fakta"],
      ["Vad kommer ut ur ägget?", ["En kyckling", "En tupp", "En fjäder", "En mask"], "fakta"],
      ["Vilken färg har kycklingen?", ["Gul", "Svart", "Röd", "Blå"], "fakta"],
    ],
  },
  {
    id: "lr-g1-nyckelpigan", title: "Nyckelpigan", textType: "fact", topic: "djur",
    body: [
      "Nyckelpigan är en liten skalbagge. Den är röd med svarta prickar.",
      "Nyckelpigan har vingar under sitt skal. Den kan flyga.",
      "Nyckelpigan äter bladlöss. Bladlöss är små djur. De äter på växter.",
      "Därför är nyckelpigan en bra vän i trädgården.",
    ],
    q: [
      ["Hur ser nyckelpigan ut?", ["Röd med svarta prickar", "Gul med vita prickar", "Grön med svarta ränder", "Blå med röda prickar"], "fakta"],
      ["Var har nyckelpigan sina vingar?", ["Under skalet", "På magen", "På huvudet", "Under benen"], "fakta"],
      ["Vad äter nyckelpigan?", ["Bladlöss", "Myror", "Blommor", "Frön"], "fakta"],
    ],
  },
  {
    id: "lr-g1-ugglan", title: "Ugglan", textType: "fact", topic: "djur",
    body: [
      "Ugglan är en fågel. Den är vaken på natten. På dagen sover den.",
      "Ugglan har stora ögon. Den ser bra i mörker.",
      "Ugglan kan vrida huvudet långt bakåt.",
      "Ugglan flyger helt tyst. Den fångar möss.",
      "Ugglan säger ”hoo, hoo”.",
    ],
    q: [
      ["När är ugglan vaken?", ["På natten", "På morgonen", "På dagen", "Vid lunch"], "fakta"],
      ["Vad fångar ugglan?", ["Möss", "Fiskar", "Fjärilar", "Grodor"], "fakta"],
      ["Hur flyger ugglan?", ["Helt tyst", "Mycket högljutt", "Bara baklänges", "Bara på dagen"], "fakta"],
      ["Vad säger ugglan?", ["Hoo, hoo", "Kvitt, kvitt", "Kra, kra", "Pip, pip"], "fakta"],
    ],
  },
  {
    id: "lr-g1-daggmasken", title: "Masken i jorden", textType: "fact", topic: "natur",
    body: [
      "Daggmasken bor i jorden. Den är lång och smal. Den har inga ben och inga ögon.",
      "Masken gräver gångar i jorden. Då kommer luft och vatten ner. Det är bra för växterna.",
      "När det regnar kryper maskarna upp. Då kan du se dem på marken.",
    ],
    q: [
      ["Var bor daggmasken?", ["I jorden", "I vattnet", "I trädet", "I ett bo"], "fakta"],
      ["Hur många ben har daggmasken?", ["Inga", "Två", "Fyra", "Hundra"], "fakta"],
      ["När kryper maskarna upp?", ["När det regnar", "När det snöar", "När solen skiner", "När det är torrt"], "fakta"],
    ],
  },
  {
    id: "lr-g1-varen", title: "Nu kommer våren", textType: "fact", topic: "natur",
    body: [
      "Nu kommer våren. Solen värmer mer.",
      "Snön smälter. Det blir vatten och pölar.",
      "Små gröna blad kommer ut på träden. Blåsippor och tussilago blommar.",
      "Fåglarna kommer tillbaka. De sjunger på morgonen.",
      "Dagarna blir längre. Det är ljust länge på kvällen.",
    ],
    q: [
      ["Vad händer med snön?", ["Den smälter", "Den blir mer", "Den blir blå", "Den blir hård"], "fakta"],
      ["Vilka blommor blommar?", ["Blåsippor och tussilago", "Rosor och lavendel", "Solrosor och liljor", "Nejlikor och dahlior"], "fakta"],
      ["När sjunger fåglarna?", ["På morgonen", "På natten", "Mitt på dagen", "Sent på kvällen"], "fakta"],
      ["Vad händer med dagarna?", ["De blir längre", "De blir kortare", "De blir mörka", "De blir kalla"], "fakta"],
    ],
  },
  {
    id: "lr-g1-appeltradet", title: "Äppelträdet", textType: "fact", topic: "natur",
    body: [
      "Äppelträdet står i trädgården.",
      "På våren får trädet vita och rosa blommor. Bina flyger till blommorna.",
      "Sedan faller blommorna av. Där växer små gröna äpplen.",
      "Hela sommaren växer äpplena. På hösten är de stora och röda.",
      "Då kan vi plocka dem och äta.",
    ],
    q: [
      ["Vilken färg har blommorna?", ["Vita och rosa", "Gula och blå", "Röda och svarta", "Lila och gröna"], "fakta"],
      ["Vilka flyger till blommorna?", ["Bina", "Fåglarna", "Ugglorna", "Flugorna"], "fakta"],
      ["Hur ser äpplena ut först?", ["Små och gröna", "Stora och röda", "Gula och mjuka", "Bruna och hårda"], "fakta"],
      ["När är äpplena stora och röda?", ["På hösten", "På våren", "På vintern", "På morgonen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-ogonen", title: "Våra ögon", textType: "fact", topic: "vetenskap",
    body: [
      "Vi har två ögon. Med ögonen ser vi färger och former.",
      "Ögon kan ha olika färg. De kan vara blå, bruna eller gröna.",
      "Vi blinkar många gånger varje minut. Då blir ögonen fuktiga och rena.",
      "När det är mörkt ser vi sämre. Därför tänder vi en lampa.",
    ],
    q: [
      ["Hur många ögon har vi?", ["Två", "Ett", "Tre", "Fyra"], "fakta"],
      ["Vilka färger kan ögon ha?", ["Blå, bruna eller gröna", "Röda, rosa eller lila", "Gula, orange eller vita", "Lila, rosa eller svarta"], "fakta"],
      ["Ögonen blir fuktiga. Vad betyder fuktiga?", ["Lite blöta", "Väldigt torra", "Mycket varma", "Helt stängda"], "ordforstaelse"],
      ["Vad gör vi när det är mörkt?", ["Tänder en lampa", "Blinkar fort", "Blundar hårt", "Tvättar ögonen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-tanderna", title: "Borsta tänderna", textType: "fact", topic: "vetenskap",
    body: [
      "Små barn har mjölktänder. Sedan lossnar de en och en. Då växer nya tänder fram.",
      "Tänderna måste vara rena. Borsta dem på morgonen och på kvällen.",
      "Godis och saft kan ge hål i tänderna.",
      "Tandläkaren tittar på dina tänder.",
    ],
    q: [
      ["Vad heter små barns tänder?", ["Mjölktänder", "Lilltänder", "Barntänder", "Småtänder"], "ordforstaelse"],
      ["När ska du borsta tänderna?", ["Morgon och kväll", "Bara på lördagar", "En gång i veckan", "Bara på natten"], "fakta"],
      ["Vad kan ge hål i tänderna?", ["Godis och saft", "Vatten och mjölk", "Morötter och äpplen", "Fisk och potatis"], "fakta"],
      ["Vem tittar på dina tänder?", ["Tandläkaren", "Läraren", "Polisen", "Brevbäraren"], "fakta"],
    ],
  },
  {
    id: "lr-g1-brandbilen", title: "Brandbilen", textType: "fact", topic: "teknik",
    body: [
      "Brandbilen är stor och röd. Den har en lång stege på taket.",
      "Brandbilen har också en slang. Med slangen sprutar de vatten på elden.",
      "När brandbilen kör fort låter det ”ijo, ijo”. Det är sirenen.",
      "Då flyttar sig alla andra bilar.",
    ],
    q: [
      ["Vilken färg har brandbilen?", ["Röd", "Gul", "Vit", "Blå"], "fakta"],
      ["Vad har brandbilen på taket?", ["En stege", "En lampa", "En båt", "En flagga"], "fakta"],
      ["Vad sprutar de på elden?", ["Vatten", "Sand", "Snö", "Mjölk"], "fakta"],
      ["Vad heter det som låter ”ijo, ijo”?", ["Sirenen", "Tutan", "Klockan", "Motorn"], "fakta"],
    ],
  },
  {
    id: "lr-g1-raketen", title: "Raketen", textType: "fact", topic: "rymden",
    body: [
      "En raket kan åka upp i rymden. Den är hög och smal.",
      "När raketen startar kommer det eld och rök. Det låter jättehögt.",
      "Raketen åker snabbare än ett flygplan. Snart är den långt borta.",
      "Ibland åker astronauter med raketen. De har vita dräkter och hjälmar.",
    ],
    q: [
      ["Hur ser raketen ut?", ["Hög och smal", "Låg och bred", "Rund och liten", "Platt och lång"], "fakta"],
      ["Vad kommer det när raketen startar?", ["Eld och rök", "Snö och is", "Regn och blåst", "Sand och damm"], "fakta"],
      ["Vilka åker ibland med raketen?", ["Astronauter", "Bagare", "Fotbollsspelare", "Tandläkare"], "fakta"],
      ["Vilken färg har dräkterna?", ["Vita", "Röda", "Svarta", "Gula"], "fakta"],
    ],
  },
  {
    id: "lr-g1-vanern", title: "Den stora sjön", textType: "fact", topic: "geografi",
    body: [
      "Vänern är en sjö i Sverige. Det är Sveriges största sjö.",
      "Vänern är mycket stor. Du ser inte andra sidan. Den ser nästan ut som ett hav.",
      "I Vänern finns många öar. Där finns också mycket fisk.",
      "På sommaren badar och seglar många i Vänern.",
    ],
    q: [
      ["Vad är Vänern?", ["En sjö", "En flod", "Ett berg", "En stad"], "fakta"],
      ["I vilket land ligger Vänern?", ["Sverige", "Norge", "Finland", "Danmark"], "fakta"],
      ["Vad ser Vänern nästan ut som?", ["Ett hav", "En bäck", "En damm", "En pöl"], "fakta"],
      ["Vad gör många i Vänern på sommaren?", ["Badar och seglar", "Åker skridskor", "Bygger snögubbar", "Åker pulka"], "fakta"],
    ],
  },
  {
    id: "lr-g1-telefonen-forr", title: "Telefonen förr", textType: "fact", topic: "historia",
    body: [
      "Förr såg telefonen annorlunda ut. Den satt fast i väggen med en sladd.",
      "Du kunde inte ta med den ut. Du fick stå vid väggen och prata.",
      "Telefonen hade en ratt med siffror. Man snurrade på ratten för att ringa.",
      "I dag har vi mobiler. De får plats i fickan.",
    ],
    q: [
      ["Vad hade telefonen förr?", ["En sladd", "En skärm", "En kamera", "Ett spel"], "fakta"],
      ["Var fick du stå och prata?", ["Vid väggen", "I bilen", "I parken", "I sängen"], "fakta"],
      ["Hur ringde man förr?", ["Snurrade på en ratt", "Tryckte på en skärm", "Skrev på en tavla", "Ropade i ett rör"], "fakta"],
      ["Telefonen såg annorlunda ut. Vad betyder annorlunda?", ["Inte likadan", "Väldigt dyr", "Mycket ny", "Alldeles ren"], "ordforstaelse"],
    ],
  },
];
