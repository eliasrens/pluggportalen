// ============================================================================
// Läsresan – källtexter för nivå 4 fil b, fact (issue #664)
// ----------------------------------------------------------------------------
// Faktatexter, 60–110 ord, 6–7 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-n1b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-4-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-n1-igelkotten", title: "Djuret med tusentals taggar", textType: "fact", topic: "djur",
    body: [
      "Igelkotten är ett litet djur med ungefär 6 000 taggar på ryggen. När den blir rädd rullar den ihop sig till en taggig boll. Då kan de flesta djur inte äta den.",
      "Igelkotten är vaken på natten. Den letar efter maskar, sniglar och skalbaggar att äta.",
      "På hösten äter den extra mycket och blir tjock. Sedan bygger den ett bo av löv under en buske. Där sover den hela vintern. Det kallas vinterdvala.",
      "Om du ser en igelkott ska du inte ge den mjölk. Den får ont i magen av det. Ge den hellre vatten.",
    ],
    q: [
      ["Ungefär hur många taggar har en igelkott?", ["6 000", "60", "600", "60 000"], "fakta"],
      ["Vad gör igelkotten när den blir rädd?", ["Rullar ihop sig till en boll", "Springer upp i ett träd", "Gräver ner sig i jorden", "Hoppar ner i vattnet"], "fakta"],
      ["När är igelkotten vaken?", ["På natten", "På morgonen", "Mitt på dagen", "Bara på vintern"], "fakta"],
      ["Vad betyder vinterdvala?", ["Att djuret sover hela vintern", "Att djuret flyttar söderut", "Att djuret byter till vit päls", "Att djuret äter snö"], "ordforstaelse"],
      ["Varför äter igelkotten extra mycket på hösten?", ["Den ska klara vintern utan mat", "Den har fått ungar", "Det finns mest mat då", "Den vill kunna springa snabbare"], "mellan_raderna"],
      ["Vad ska du ge en igelkott att dricka?", ["Vatten", "Mjölk", "Saft", "Te"], "fakta"],
    ],
  },
  {
    id: "lr-n1-hjartat", title: "Hjärtat slutar aldrig", textType: "fact", topic: "kroppen",
    body: [
      "Lägg handen på bröstet, lite till vänster. Känner du något som slår? Det är ditt hjärta.",
      "Hjärtat är en muskel som är ungefär lika stor som din knutna hand. Det pumpar runt blodet i hela kroppen. Blodet bär med sig syre och näring till alla delar av kroppen.",
      "Hjärtat vilar aldrig, inte ens när du sover. Hos ett barn slår det ungefär 80 till 100 gånger i minuten.",
      "När du springer behöver kroppen mer syre. Då slår hjärtat fortare. Det kan du känna själv efter en löptur.",
    ],
    q: [
      ["Hur stort är hjärtat?", ["Som din knutna hand", "Som en fotboll", "Som en ärta", "Som ditt huvud"], "fakta"],
      ["Vad gör hjärtat?", ["Pumpar runt blodet", "Tar in luft", "Tar hand om maten", "Tänker åt dig"], "fakta"],
      ["Vad bär blodet med sig?", ["Syre och näring", "Ljud och ljus", "Tankar och minnen", "Sand och sten"], "fakta"],
      ["Hjärtat vilar aldrig. Vad betyder det?", ["Det arbetar hela tiden", "Det är alltid trött", "Det slår bara på dagen", "Det tar en paus på natten"], "ordforstaelse"],
      ["Ungefär hur många gånger i minuten slår ett barns hjärta?", ["80 till 100", "5 till 10", "Omkring 500", "Omkring 2 000"], "fakta"],
      ["Varför slår hjärtat fortare när du springer?", ["Kroppen behöver mer syre", "Hjärtat blir rädd", "Blodet blir kallt och trögt", "Man blir hungrig"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-mars", title: "Den röda planeten", textType: "fact", topic: "rymden",
    body: [
      "Mars är den fjärde planeten från solen. Den kallas ofta den röda planeten. Marken där är täckt av rött damm, nästan som rost.",
      "På Mars är det mycket kallt. Det finns ingen luft som vi kan andas, och inga sjöar eller hav. Men vid polerna finns det is.",
      "Ett år på Mars är nästan dubbelt så långt som ett år på jorden. Det beror på att Mars har en längre väg runt solen.",
      "Människor har aldrig varit på Mars. Men forskare har skickat dit robotar på hjul. De kör runt, tar bilder och undersöker stenar.",
    ],
    q: [
      ["Vilken planet från solen är Mars?", ["Den fjärde", "Den första", "Den andra", "Den åttonde"], "fakta"],
      ["Varför kallas Mars den röda planeten?", ["Marken har rött damm", "Den är väldigt varm", "Den har röda moln", "Solen lyser rött där"], "fakta"],
      ["Var finns det is på Mars?", ["Vid polerna", "I stora sjöar", "Mitt på planeten", "Inuti robotarna"], "fakta"],
      ["Robotarna undersöker stenar. Vad gör de?", ["Tittar noga på dem", "Kastar bort dem", "Målar dem röda", "Bygger hus av dem"], "ordforstaelse"],
      ["Varför skulle det vara svårt för en människa att bo på Mars?", ["Det finns ingen luft att andas", "Det finns för mycket vatten", "Planeten är för liten att stå på", "Det är alltid mörkt"], "mellan_raderna"],
      ["Vad har forskare skickat till Mars?", ["Robotar på hjul", "Astronauter i rymddräkt", "En ballong med en kamera", "Ett flygplan med passagerare"], "fakta"],
    ],
  },
  {
    id: "lr-n1-potatisen", title: "Potatisens långa resa", textType: "fact", topic: "mat",
    body: [
      "Potatis är något som många svenskar äter nästan varje vecka. Men från början växte den inte här. Den kommer från bergen i Sydamerika.",
      "För flera hundra år sedan kom potatisen till Europa med båt. Först ville inte så många äta den. Folk tyckte att den såg konstig ut.",
      "Det är knölarna som vi äter. De växer under jorden. Ovanför jorden växer gröna blad och blommor. Bladen och de andra gröna delarna ska man inte äta, för de är giftiga.",
      "I dag äter vi potatis kokt, stekt, som mos och som pommes frites.",
    ],
    q: [
      ["Var kommer potatisen från?", ["Från bergen i Sydamerika", "Från skogarna i Sverige", "Från de varma öknarna i Afrika", "Från öarna i Asien"], "fakta"],
      ["Hur kom potatisen till Europa?", ["Med båt", "Med flygplan", "Med tåg", "Med häst och vagn"], "fakta"],
      ["Varför ville folk inte äta potatis först?", ["Den såg konstig ut", "Den var för dyr", "Den smakade salt", "Den var för stor"], "fakta"],
      ["Vad är knölarna?", ["Delarna som växer under jorden", "De vita blommorna högst upp på plantan", "De gröna bladen", "Fröna i blomman"], "ordforstaelse"],
      ["Vilka delar av potatisplantan ska man inte äta?", ["De gröna delarna", "De kokta knölarna", "Den stekta potatisen", "Det färdiga moset"], "fakta"],
      ["Vad handlar texten mest om?", ["Potatisens historia och hur den växer", "Hur man lagar pommes frites hemma i köket", "Bönder som bor i bergen", "Vackra blommor i trädgården"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-runstenar", title: "Stenar som berättar", textType: "fact", topic: "historia",
    body: [
      "I Sverige finns det tusentals runstenar. De flesta restes för ungefär tusen år sedan, på vikingatiden.",
      "På stenarna finns tecken som kallas runor. Runorna var vikingarnas bokstäver. De var raka och kantiga, eftersom de var lätta att hugga in i sten och trä.",
      "Ofta skrev man till minne av någon som hade dött. Det kunde stå: ”Tore reste stenen efter sin far.” Många stenar var målade i starka färger, men färgen har regnat bort.",
      "Runorna slingrar sig ofta i en lång orm runt stenen. Kanske finns det en runsten nära dig?",
    ],
    q: [
      ["När restes de flesta runstenar?", ["För ungefär tusen år sedan", "För tio år sedan", "För hundra år sedan", "För en miljon år sedan"], "fakta"],
      ["Vad är runor?", ["Vikingarnas bokstäver", "Vikingarnas vapen", "Gamla mynt av silver", "Stenar vid vägen"], "ordforstaelse"],
      ["Varför var runorna raka och kantiga?", ["De var lätta att hugga in", "De var vackrast så", "Kungen bestämde det", "De syntes bättre i mörker"], "fakta"],
      ["Varför skrev man ofta på stenarna?", ["Till minne av någon som dött", "För att sälja fisk och tyg på marknaden", "För att visa vägen", "För att lära barnen att läsa"], "fakta"],
      ["Varför ser de flesta runstenar inte färgglada ut i dag?", ["Regnet har tvättat bort färgen", "Vikingarna målade aldrig", "Färgen var osynlig", "Stenarna har bytts ut mot nya stenar"], "mellan_raderna"],
      ["Vad kan man lära sig av runstenar?", ["Om människor på vikingatiden", "Hur man bygger ett vikingaskepp av trä", "Hur ormar ser ut på riktigt", "Var det finns guld gömt i marken"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-bina", title: "Bina gör honung", textType: "fact", topic: "djur",
    body: [
      "I en bikupa kan det bo över 40 000 bin. De flesta är arbetsbin. Det finns bara en drottning, och hon lägger alla ägg.",
      "Arbetsbina flyger ut till blommor. Där suger de upp en söt saft som heter nektar. Hemma i kupan gör de om nektarn till honung. Honungen blir mat till vintern.",
      "Bina hjälper också blommorna. När ett bi flyger från blomma till blomma följer det gula pollenet med. Då kan blommorna bli till frukt och bär.",
      "Ett bi som hittar många blommor dansar en särskild dans. Så visar det de andra vägen.",
    ],
    q: [
      ["Hur många bin kan bo i en kupa?", ["Över 40 000", "Omkring 40", "Ungefär 400", "Exakt 4"], "fakta"],
      ["Vem lägger alla ägg?", ["Drottningen", "Arbetsbina", "De äldsta bina", "Alla bin"], "fakta"],
      ["Vad är nektar?", ["En söt saft i blommor", "Ett slags gult pollen", "Vaxet i kupan", "Ett bis gadd"], "ordforstaelse"],
      ["Vad gör bina med nektarn?", ["Gör om den till honung", "Ger den till fåglarna", "Bygger hus av den", "Häller ut den på marken"], "fakta"],
      ["Varför skulle det bli mindre frukt om det inte fanns några bin?", ["Ingen skulle flytta pollenet", "Träden skulle frysa", "Det skulle bli för mycket honung", "Fåglarna skulle äta upp blommorna"], "mellan_raderna"],
      ["Hur visar ett bi vägen till blommorna?", ["Det dansar", "Det surrar högt", "Det ritar en karta", "Det lyser"], "fakta"],
      ["Vilken rubrik passar också till texten?", ["Små djur med stora jobb", "Bin är farliga", "Så gör du sylt", "Blommor på vintern"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-regnet", title: "Varför regnar det?", textType: "fact", topic: "natur",
    body: [
      "Solen värmer vattnet i hav, sjöar och pölar. Då blir lite av vattnet till ånga. Ångan är så lätt att den stiger upp i luften. Du kan inte se den.",
      "Högt upp är luften kall. Där blir ångan till små, små vattendroppar. Miljontals droppar tillsammans blir ett moln.",
      "När dropparna i molnet slår ihop sig blir de större och tyngre. Till slut är de så tunga att de faller ner. Då regnar det.",
      "Regnet rinner ut i bäckar, älvar och hav. Sedan börjar resan om igen. Vattnet går runt, runt hela tiden.",
    ],
    q: [
      ["Vad värmer vattnet i haven?", ["Solen", "Månen", "Vinden", "Molnen"], "fakta"],
      ["Ångan stiger. Vad betyder det?", ["Den rör sig uppåt", "Den blir kallare", "Den faller ner", "Den blir synlig"], "ordforstaelse"],
      ["Vad händer med ångan högt upp?", ["Den blir till små droppar", "Den blir varmare och varmare", "Den försvinner för alltid", "Den blir till fina sandkorn"], "fakta"],
      ["Vad är ett moln?", ["Massor av små droppar", "Rök från skorstenar", "Bomull som flyger", "Snö som smälter"], "fakta"],
      ["När faller dropparna ner?", ["När de blir för tunga", "När solen går ner", "När det blåser", "När det blir natt"], "fakta"],
      ["Varför tar vattnet på jorden inte slut?", ["Samma vatten går runt hela tiden", "Det kommer nytt vatten från rymden", "Människor tillverkar nytt vatten", "Molnen gör vatten av luft"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-australien", title: "Landet med kängurur", textType: "fact", topic: "länder",
    body: [
      "Australien ligger långt bort, på andra sidan jorden. Det är både ett land och en egen världsdel. När det är vinter i Sverige är det sommar i Australien.",
      "Mitt i landet är det torrt och varmt. Där finns stora öknar med röd sand. De flesta människor bor nära havet, i stora städer.",
      "I Australien lever djur som är ovanliga i resten av världen. Kängurun hoppar fram på sina starka bakben. Ungen bor i en pung på mammans mage. Koalan sover nästan hela dagen uppe i träden.",
      "Vid kusten finns ett stort korallrev med färgglada fiskar.",
    ],
    q: [
      ["Var ligger Australien?", ["På andra sidan jorden", "Nära Sverige", "Mitt i Europa", "Vid Nordpolen"], "fakta"],
      ["Vilken årstid är det i Australien när det är vinter i Sverige?", ["Sommar", "Vinter", "Höst", "Vår"], "fakta"],
      ["Var bor de flesta människor i Australien?", ["Nära havet", "Mitt i öknen", "Uppe i bergen", "I små byar i skogen"], "fakta"],
      ["Vad är en pung?", ["En ficka på mammans mage", "Ett bo högt uppe i ett träd", "En sorts boll", "En liten unge"], "ordforstaelse"],
      ["Vad gör koalan nästan hela dagen?", ["Sover", "Hoppar", "Simmar", "Äter gräs"], "fakta"],
      ["Varför bor få människor mitt i landet?", ["Det är torrt och varmt där", "Kängurur bor där", "Det är för kallt där", "Det finns för många städer"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-n1-solceller", title: "El från solen", textType: "fact", topic: "teknik",
    body: [
      "På en del hustak ser man blanka, mörkblå plattor. De kallas solceller eller solpaneler. De gör el av solljus.",
      "När solen lyser på plattorna händer något inuti dem. Ljuset sätter fart på mycket små delar, och då blir det elektrisk ström. Strömmen går sedan in i huset. Där kan den få lampor, kylskåp och datorer att fungera.",
      "Solceller låter inte och släpper inte ut någon rök. Därför är de bra för miljön.",
      "Men på natten ger de ingen el alls. Och en mulen dag ger de mindre.",
    ],
    q: [
      ["Vilken färg har plattorna i texten?", ["Mörkblå", "Ljusgröna", "Knallröda", "Vita"], "fakta"],
      ["Vad gör solceller av solljus?", ["El", "Vatten", "Bensin", "Ljud"], "fakta"],
      ["Vad kan strömmen få att fungera i huset?", ["Lampor och kylskåp", "Kranar och duschar", "Fönster och dörrar", "Trappor och golv"], "fakta"],
      ["Vad är en mulen dag?", ["En dag med moln", "En dag med sol", "En väldigt varm dag", "En dag mitt i sommaren"], "ordforstaelse"],
      ["Varför är solceller bra för miljön?", ["De släpper inte ut rök", "De är blanka och fina", "De sitter uppe på taket", "De är lätta att bära"], "fakta"],
      ["Varför behöver ett hus med solceller också få el på annat sätt?", ["De ger ingen el på natten", "Plattorna går sönder när det regnar", "Plattorna är för små för ett hus", "Grannarna tar elen"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Hur solceller gör el av ljus", "Hur man bygger ett tak", "Varför solen är varm", "Hur man lagar en lampa"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-allemansratten", title: "Allemansrätten", textType: "fact", topic: "samhälle",
    body: [
      "I Sverige finns något som heter allemansrätten. Den betyder att alla får vara ute i naturen, även i skog som någon annan äger.",
      "Du får gå, cykla och plocka bär och svamp. Du får bada i sjöar och tälta en natt på ett ställe.",
      "Men allemansrätten har också regler. Man ska inte störa eller förstöra. Du får inte bryta grenar från levande träd eller gå över någons tomt. Fåglarnas bon och ungar ska få vara i fred.",
      "Allt skräp tar du med dig hem. En bra regel är: lämna platsen som du själv vill hitta den.",
    ],
    q: [
      ["Vad betyder allemansrätten?", ["Att alla får vara ute i naturen", "Att alla får bestämma i skogen", "Att man får bygga hus var man vill", "Att alla måste plocka bär"], "ordforstaelse"],
      ["Hur länge får man tälta på ett ställe?", ["En natt", "En månad", "Ett år", "Hur länge man vill"], "fakta"],
      ["Vad får du inte göra?", ["Bryta grenar från levande träd", "Plocka blåbär och lingon i skogen", "Bada i en sjö", "Cykla på en stig i skogen"], "fakta"],
      ["Vad ska du göra med skräpet?", ["Ta med det hem", "Gräva ner det", "Lägga det under en sten", "Elda upp det"], "fakta"],
      ["Du hittar ett fågelbo med ungar. Vad ska du göra?", ["Låta det vara", "Ta med det hem", "Flytta det till ett annat träd", "Klappa ungarna"], "mellan_raderna"],
      ["Vad menas med att lämna platsen som du själv vill hitta den?", ["Den ska vara ren och hel", "Den ska ha fler träd än förut", "Du ska bygga något där", "Du ska ta med dig stenar"], "helhet_slutsats"],
    ],
  },
];
