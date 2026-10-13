// ============================================================================
// Läsresan – källtexter för nivå 3, del b, fact (issue #663)
// ----------------------------------------------------------------------------
// 20 faktatexter, 100–140 ord, 6–7 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g3b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-3-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g3-kamelen", title: "Kamelens puckel", textType: "fact", topic: "djur",
    body: [
      "Kamelen lever i öknar, där det är torrt och varmt. Den kan klara sig i flera dagar utan att dricka. När den väl hittar vatten kan den dricka över hundra liter på ungefär tio minuter.",
      "Många tror att kamelen har vatten i puckeln. Men det stämmer inte. Puckeln är full av fett. Fettet blir till energi när det är ont om mat. Då blir puckeln mindre och slappare.",
      "Kamelen har långa ögonfransar. De skyddar ögonen när det blåser sand. Den kan också stänga näsborrarna. Under fötterna har kamelen breda och mjuka trampdynor. De gör att den inte sjunker ner i sanden.",
      "Det finns kameler med en puckel och kameler med två pucklar. Människor har använt dem för att bära saker i tusentals år.",
    ],
    q: [
      ["Var lever kamelen?", ["I öknar", "I regnskogar", "På fjällen", "Vid havet"], "fakta"],
      ["Vad finns i kamelens puckel?", ["Fett", "Vatten", "Luft", "Sand"], "fakta"],
      ["Vad händer med puckeln när det är ont om mat?", ["Den blir mindre", "Den blir större", "Den byter färg", "Den ramlar av"], "fakta"],
      ["Vad skyddar de långa ögonfransarna mot?", ["Sand som blåser", "Kyla på natten", "Regn", "Insekter som sticks"], "fakta"],
      ["Det är ont om mat. Vad betyder det?", ["Det finns lite mat", "Maten smakar illa", "Maten gör ont i magen", "Det finns mycket mat"], "ordforstaelse"],
      ["Varför sjunker kamelen inte ner i sanden?", ["Den har breda trampdynor", "Den är mycket lätt", "Den går väldigt fort över sanden", "Den har långa ben"], "fakta"],
      ["Varför klarar sig kamelen bra i öknen?", ["Kroppen passar för värme och sand", "Den äter sand", "Den sover hela dagarna", "Den behöver aldrig dricka något vatten"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-elefanten", title: "Elefantens snabel", textType: "fact", topic: "djur",
    body: [
      "Elefanten är det största djuret som lever på land. En vuxen afrikansk elefant kan väga lika mycket som fem bilar.",
      "Det mest kända med elefanten är snabeln. Snabeln är näsan och överläppen som har vuxit ihop. Den är mycket stark men också mjuk och känslig. Med snabeln kan elefanten lyfta tunga stockar. Den kan också plocka upp en enda liten nöt.",
      "Elefanten dricker med hjälp av snabeln. Den suger upp vatten och sprutar sedan in det i munnen. Ibland sprutar den vatten över ryggen för att svalka sig.",
      "De stora öronen hjälper också till mot värmen. När elefanten fläktar med öronen blir den svalare.",
      "Elefanter lever i familjer. Det är den äldsta honan som bestämmer. Hon minns var det finns vatten.",
    ],
    q: [
      ["Hur mycket kan en vuxen elefant väga?", ["Lika mycket som fem bilar", "Lika mycket som en cykel", "Lika mycket som en stor hund", "Lika mycket som hundra bilar"], "fakta"],
      ["Vad är snabeln?", ["Näsan och överläppen", "En lång tand", "Elefantens svans", "En lång tand som har vuxit ut"], "fakta"],
      ["Hur får elefanten vattnet till munnen?", ["Den sprutar in det med snabeln", "Den slickar upp det med tungan", "Den doppar hela huvudet i sjön", "Den väntar på regn"], "fakta"],
      ["Snabeln är känslig. Vad betyder det här?", ["Den känner av små saker", "Den blir lätt ledsen", "Den går lätt sönder", "Den är alltid kall"], "ordforstaelse"],
      ["Hur använder elefanten öronen mot värmen?", ["Den fläktar med dem", "Den gömmer ungarna under dem", "Den doppar dem i vatten", "Den lägger dem över ögonen"], "fakta"],
      ["Vem bestämmer i elefantfamiljen?", ["Den äldsta honan", "Den största hanen", "Den yngsta ungen", "Alla bestämmer lika mycket"], "fakta"],
      ["Varför är det bra att den äldsta honan bestämmer?", ["Hon vet var vattnet finns", "Hon springer fortast", "Hon har den allra längsta snabeln", "Hon sover minst"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-myggan", title: "Myggan som surrar", textType: "fact", topic: "djur",
    body: [
      "Sommarkvällar hörs ofta ett tunt surrande ljud. Det är en mygga som flyger. Ljudet kommer från vingarna, som slår flera hundra gånger i sekunden.",
      "Det är bara myggornas honor som sticker. Honan behöver blod för att hennes ägg ska kunna utvecklas. Hon hittar oss med hjälp av lukten och luften vi andas ut. Hanarna sticker inte alls. De suger söt nektar från blommor.",
      "Honan lägger sina ägg i vatten, till exempel i en pöl eller en damm. Ur äggen kommer larver som lever i vattnet. Efter en till två veckor blir larverna till flygande myggor.",
      "Det kliar när en mygga har stuckit. Det beror på att myggan sprutar in lite saliv. Kroppen reagerar på saliven, och då blir det en röd bula.",
    ],
    q: [
      ["Varifrån kommer myggans surrande ljud?", ["Från vingarna", "Från den vassa munnen", "Från benen", "Från magen"], "fakta"],
      ["Vilka myggor sticker?", ["Bara honorna", "Bara hanarna", "Alla myggor", "Bara larverna"], "fakta"],
      ["Varför behöver honan blod?", ["För att äggen ska utvecklas", "För att kunna flyga", "För att hålla sig varm på natten", "För att surra högre"], "fakta"],
      ["Vad äter hanarna?", ["Nektar från blommor", "Blod", "Gröna löv", "Små flugor och myror"], "fakta"],
      ["Var lever myggornas larver?", ["I vatten", "I jorden", "I träd", "I gräset"], "fakta"],
      ["Kroppen reagerar på saliven. Vad betyder reagerar här?", ["Svarar på något som händer", "Somnar", "Glömmer bort något", "Blir starkare"], "ordforstaelse"],
      ["Varför finns det ofta många myggor nära sjöar och pölar?", ["Där lägger honorna sina ägg", "Där finns det mest blod", "Där är det alltid varmast på sommaren", "Där finns inga fåglar"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-molnen", title: "Hur blir ett moln till?", textType: "fact", topic: "natur",
    body: [
      "Ett moln ser mjukt ut, nästan som bomull. Men ett moln består av miljontals små vattendroppar eller iskristaller. De är så små och lätta att de svävar i luften.",
      "Hur blir ett moln till? När solen värmer vatten i hav och sjöar avdunstar vattnet. Det blir till osynlig vattenånga som stiger uppåt med den varma luften. Högt upp är luften kall. Där kyls ångan av och blir till små droppar. Många droppar tillsammans blir ett moln.",
      "Det finns olika sorters moln. Stackmoln är vita och ser ut som höga högar. Dimma är faktiskt ett moln som ligger nere vid marken.",
      "När dropparna i molnet växer ihop och blir för tunga faller de ner. Då regnar det.",
    ],
    q: [
      ["Vad består ett moln av?", ["Små droppar eller iskristaller", "Rök från skorstenar", "Damm och sand från marken", "Bomull"], "fakta"],
      ["Vad händer med vattnet när solen värmer det?", ["Det avdunstar", "Det fryser", "Det blir salt", "Det blir grönt"], "fakta"],
      ["Varför blir ångan till droppar högt upp?", ["Luften är kall där", "Det blåser mycket där", "Solen är starkare där", "Där flyger fåglar"], "fakta"],
      ["Vad är dimma?", ["Ett moln nere vid marken", "Rök från en eld", "Regn som har frusit till is i luften", "Damm i luften"], "fakta"],
      ["Dropparna svävar i luften. Vad betyder svävar?", ["Håller sig uppe utan att falla", "Faller snabbt", "Snurrar runt", "Försvinner"], "ordforstaelse"],
      ["När regnar det?", ["När dropparna blir för tunga", "När molnen blir vita", "När solen skiner", "När vinden plötsligt slutar att blåsa"], "fakta"],
      ["Vad visar texten om vattnet?", ["Det rör sig mellan marken och himlen", "Det stannar alltid kvar i sjön", "Det finns bara i haven", "Det blir aldrig till is"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-tidvattnet", title: "Havet som kommer och går", textType: "fact", topic: "natur",
    body: [
      "Vid många hav stiger och sjunker vattnet två gånger varje dygn. När vattnet sjunker kallas det ebb. När det stiger igen kallas det flod. Tillsammans kallas det tidvatten.",
      "Det är månen som orsakar tidvattnet. Månen drar lite i allt på jorden, också i haven. Där månen drar mest bildas en bula av vatten. När jorden snurrar flyttar sig bulan längs kusterna.",
      "På vissa platser är skillnaden stor. Vid ebb kan man gå långt ut på botten där det nyss var hav. Där kan man hitta krabbor och snäckor i små pölar. Men man måste hålla koll på klockan. När floden kommer tillbaka stiger vattnet snabbt.",
      "I Östersjön märks tidvattnet nästan inte alls. Den är ett ganska instängt hav.",
    ],
    q: [
      ["Hur ofta stiger och sjunker vattnet?", ["Två gånger varje dygn", "En gång i veckan", "En gång om året", "Varje timme"], "fakta"],
      ["Vad kallas det när vattnet sjunker?", ["Ebb", "Flod", "Våg", "Ström"], "fakta"],
      ["Vad orsakar tidvattnet?", ["Månen", "Vinden", "Fiskarna", "Regnet"], "fakta"],
      ["Vad kan man hitta i pölarna vid ebb?", ["Krabbor och snäckor", "Sälar och valar", "Grodor och små paddor", "Ankor"], "fakta"],
      ["Varför måste man hålla koll på klockan?", ["Vattnet kommer snabbt tillbaka", "Affärerna stänger", "Krabborna vaknar", "Det blir mörkt"], "mellan_raderna"],
      ["Östersjön är instängd. Vad betyder det?", ["Den har land nästan runt om", "Den är låst med en nyckel", "Den är väldigt djup", "Den har is året om"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g3-karlavagnen", title: "Karlavagnen och Polstjärnan", textType: "fact", topic: "rymden",
    body: [
      "En klar natt kan man se tusentals stjärnor. För länge sedan började människor leta efter mönster bland dem. Mönstren kallas stjärnbilder.",
      "En av de mest kända är Karlavagnen. Den består av sju ljusa stjärnor. Fyra av dem bildar en vagn, och tre bildar ett långt handtag. Den liknar en kastrull. I Sverige kan man se Karlavagnen året runt.",
      "Karlavagnen hjälper oss att hitta Polstjärnan. Tänk dig en linje genom de två stjärnorna längst bak i vagnen. Följ linjen uppåt ungefär fem gånger så långt. Där lyser Polstjärnan.",
      "Polstjärnan står nästan alldeles stilla på himlen. Den visar alltid åt norr. Därför har sjömän och vandrare använt den för att hitta rätt.",
    ],
    q: [
      ["Vad kallas mönstren bland stjärnorna?", ["Stjärnbilder", "Planeter", "Stjärnkartor", "Moln"], "fakta"],
      ["Hur många stjärnor består Karlavagnen av?", ["Sju", "Fyra", "Tre", "Tolv"], "fakta"],
      ["Vad liknar Karlavagnen?", ["En kastrull", "En fågel", "Ett hus", "En fågel som flyger"], "fakta"],
      ["Vilka stjärnor använder man för att hitta Polstjärnan?", ["De två längst bak i vagnen", "De tre stjärnorna i handtaget", "Den ljusaste i handtaget", "Alla sju"], "fakta"],
      ["Åt vilket håll visar Polstjärnan?", ["Norr", "Söder", "Öster", "Väster"], "fakta"],
      ["Vandrare är människor som …", ["går långa sträckor", "seglar båt", "bor i städer", "sover utomhus"], "ordforstaelse"],
      ["Varför har sjömän haft nytta av Polstjärnan?", ["Den hjälper dem att hitta rätt", "Den lyser upp havet", "Den varnar för storm", "Den visar vad klockan är"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-stjarnfall", title: "Stjärnfall", textType: "fact", topic: "rymden",
    body: [
      "Ibland ser man en ljusstrimma som snabbt drar över natthimlen. Många kallar det ett stjärnfall. Men det är inte någon stjärna som faller.",
      "Ute i rymden svävar små bitar av sten och metall. När en sådan bit kommer in i luften runt jorden har den väldigt hög fart. Den krockar med luften och blir så het att den glöder. Det är det ljuset vi ser. Det kallas en meteor.",
      "De flesta bitarna är inte större än ett sandkorn. De brinner upp högt uppe i luften och når aldrig marken.",
      "Varje år i augusti kan man se extra många stjärnfall. Då passerar jorden ett moln av gammalt damm efter en komet. En mörk natt kan man se ett stjärnfall med några minuters mellanrum.",
      "Många brukar önska sig något när de ser ett stjärnfall.",
    ],
    q: [
      ["Vad är ett stjärnfall egentligen?", ["En liten bit sten som glöder", "En stjärna som faller ner mot jorden", "Ett flygplan med lampor", "En blixt"], "fakta"],
      ["Vad kallas ljuset man ser?", ["En meteor", "En komet", "En planet", "En måne"], "fakta"],
      ["Hur stora är de flesta bitarna?", ["Som ett sandkorn", "Som en stor fotboll", "Som ett hus", "Som en bil"], "fakta"],
      ["När kan man se extra många stjärnfall?", ["I augusti", "I december", "I april", "I juni"], "fakta"],
      ["Biten glöder. Vad betyder det?", ["Den lyser av hetta", "Den blir blöt", "Den går sönder", "Den låter högt"], "ordforstaelse"],
      ["Varför behöver man inte vara rädd för stjärnfall?", ["De brinner upp högt uppe", "De faller bara i havet", "De är gjorda av is", "De är långt bort i rymden"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-reflexen", title: "Reflexen i mörkret", textType: "fact", topic: "trafik",
    body: [
      "När det är mörkt ute är det svårt för en bilförare att se den som går. Med mörka kläder syns man kanske först på 25 meters håll. En bil som kör fort hinner inte stanna på så kort sträcka.",
      "Med en reflex syns man på mer än hundra meters håll. Då har föraren gott om tid att sakta ner.",
      "Hur fungerar en reflex? Den lyser inte själv. Den är gjord av plast med många små kanter och ytor. När ljuset från bilens strålkastare träffar reflexen studsar det rakt tillbaka mot bilen. Därför ser föraren reflexen lysa starkt.",
      "Reflexen ska hänga lågt, ungefär i höjd med knäet. Där träffar ljuset från bilen bäst. Det är bra med en reflex på varje sida.",
    ],
    q: [
      ["Hur långt bort syns man med mörka kläder?", ["Kanske bara 25 meter", "Mer än hundra meter", "Ungefär en hel kilometer", "Fem meter"], "fakta"],
      ["Hur långt bort syns man med en reflex?", ["Mer än hundra meter", "25 meter", "Bara några få meter", "Två meter"], "fakta"],
      ["Varför ser föraren reflexen lysa?", ["Ljuset från bilen studsar tillbaka", "Reflexen har ett eget batteri inuti", "Den laddas av solen", "Den lyser bara på vintern"], "fakta"],
      ["Ljuset studsar tillbaka. Vad betyder studsar här?", ["Vänder och åker tillbaka", "Försvinner", "Blir varmt", "Byter färg"], "ordforstaelse"],
      ["Var ska reflexen hänga?", ["I höjd med knäet", "På huvudet", "Under skon", "Inne i jackfickan"], "fakta"],
      ["Varför är det viktigt att synas på långt håll?", ["Bilen hinner sakta ner", "Det ser snyggt ut", "Bilen kan köra fortare", "Man hittar hem lättare"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-papperet", title: "Från träd till papper", textType: "fact", topic: "teknik",
    body: [
      "Papper finns överallt. Det finns i böcker, tidningar, kartonger och toalettrullar. Men visste du att det mesta papperet görs av träd?",
      "I Sverige finns mycket skog. Stammar från granar och tallar körs till ett pappersbruk. Där tar man först bort barken. Sedan hackas veden till små flisbitar.",
      "Flisen kokas eller mals tills träets fibrer lossnar från varandra. Fibrerna är som små, tunna trådar. De blandas med mycket vatten och blir en gröt som kallas massa.",
      "Massan sprutas ut på en lång vira. Den fungerar som en sil. Vattnet rinner bort, och fibrerna fastnar i varandra. Sedan pressas och torkas papperet mellan heta valsar.",
      "Gammalt papper kan återvinnas. Då blöts det upp och blir till massa igen.",
    ],
    q: [
      ["Vad görs det mesta papperet av?", ["Träd", "Plast", "Sten", "Bomull"], "fakta"],
      ["Vad gör man först på pappersbruket?", ["Tar bort barken", "Kokar stammarna", "Målar veden", "Torkar stammarna"], "fakta"],
      ["Vad kallas gröten av fibrer och vatten?", ["Massa", "Flis", "Bark", "Klister"], "fakta"],
      ["Vad är en vira?", ["Ett slags sil", "En sorts träd", "En stor kniv", "En ugn"], "ordforstaelse"],
      ["Vad händer med fibrerna på viran?", ["De fastnar i varandra", "De löses upp i vattnet", "De blir blå", "De rinner bort"], "fakta"],
      ["Varför är det bra att återvinna papper?", ["Då behövs färre träd", "Då blir papperet tyngre", "Då får papperet en ny färg", "Då behövs mer vatten"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-angloket", title: "De första tågen", textType: "fact", topic: "historia",
    body: [
      "För ungefär 170 år sedan började de första tågen gå i Sverige. De drogs av ånglok.",
      "Ett ånglok fungerar ungefär som en stor kittel på hjul. Inne i loket brinner en eld av kol eller ved. Elden värmer vatten i en stor panna tills det kokar. Vattnet blir till ånga. Ångan trycker på kolvar, som får hjulen att snurra.",
      "På loket arbetade två personer. Lokföraren körde. Eldaren skyfflade in kol i elden hela tiden. Det var ett varmt och smutsigt jobb.",
      "Tåget förändrade Sverige. En resa som tog flera dagar med häst och vagn gick nu på några timmar. Människor och varor kunde resa mycket fortare än förut.",
      "I dag går de flesta tåg på el. Men ibland kan man åka ångtåg på en museijärnväg.",
    ],
    q: [
      ["När började de första tågen gå i Sverige?", ["För ungefär 170 år sedan", "För tio år sedan", "För tusen år sedan", "För 50 år sedan"], "fakta"],
      ["Vad värmer vattnet i loket?", ["En eld av kol eller ved", "Solen", "En stor elektrisk spis i loket", "Ångan"], "fakta"],
      ["Vad får hjulen att snurra?", ["Ångan som trycker på kolvar", "Hästar som springer framför loket", "Vinden", "Lokföraren"], "fakta"],
      ["Vad gjorde eldaren?", ["Skyfflade in kol", "Körde loket", "Sålde biljetter till resenärerna", "Lagade hjulen"], "fakta"],
      ["Skyfflade betyder att han …", ["flyttade något med en spade", "blåste på något", "torkade något", "räknade något noga i huvudet"], "ordforstaelse"],
      ["Varför förändrade tåget Sverige?", ["Människor och varor kom fram fortare", "Alla fick egna hästar", "Det behövdes inget kol längre", "Ingen behövde resa"], "helhet_slutsats"],
    ],
  },
];
