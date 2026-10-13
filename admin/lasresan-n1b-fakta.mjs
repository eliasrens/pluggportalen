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
      "Australien ligger långt bort, på andra sidan jorden. Det är både ett land och en kontinent. När det är vinter i Sverige är det sommar i Australien.",
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
      "Du får gå, cykla och plocka bär och svamp. Du får bada i sjöar och tälta ett par dygn på samma ställe.",
      "Men allemansrätten har också regler. Man ska inte störa eller förstöra. Du får inte bryta grenar från levande träd eller gå över någons tomt. Fåglarnas bon och ungar ska få vara i fred.",
      "Allt skräp tar du med dig hem. En bra regel är: lämna platsen som du själv vill hitta den.",
    ],
    q: [
      ["Vad betyder allemansrätten?", ["Att alla får vara ute i naturen", "Att alla får bestämma i skogen", "Att man får bygga hus var man vill", "Att alla måste plocka bär"], "ordforstaelse"],
      ["Hur länge får man tälta på ett ställe?", ["Ett par dygn", "En hel månad", "Ett helt år", "Hur länge man vill"], "fakta"],
      ["Vad får du inte göra?", ["Bryta grenar från levande träd", "Plocka blåbär och lingon i skogen", "Bada i en sjö", "Cykla på en stig i skogen"], "fakta"],
      ["Vad ska du göra med skräpet?", ["Ta med det hem", "Gräva ner det", "Lägga det under en sten", "Elda upp det"], "fakta"],
      ["Du hittar ett fågelbo med ungar. Vad ska du göra?", ["Låta det vara", "Ta med det hem", "Flytta det till ett annat träd", "Klappa ungarna"], "mellan_raderna"],
      ["Vad menas med att lämna platsen som du själv vill hitta den?", ["Den ska vara ren och hel", "Den ska ha fler träd än förut", "Du ska bygga något där", "Du ska ta med dig stenar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-skelettet", title: "Benen i din kropp", textType: "fact", topic: "kroppen",
    body: [
      "Utan skelett skulle du vara mjuk som en geléklump. Skelettet är kroppens stomme. Det håller dig upprätt och skyddar det som finns inuti.",
      "Skallen skyddar hjärnan. Revbenen bildar en bur runt hjärtat och lungorna.",
      "En vuxen människa har 206 ben. En nyfödd bebis har ännu fler, ungefär 300. När barnet växer, växer en del av benen ihop.",
      "Det minsta benet sitter inne i örat. Det är inte större än ett riskorn. Det längsta benet är lårbenet.",
      "Ben behöver kalk för att bli starka. Kalk finns till exempel i mjölk, ost och gröna grönsaker.",
    ],
    q: [
      ["Vad betyder stomme?", ["Det som håller upp något", "Något som är mjukt och slappt", "En sorts muskel", "Ett skydd mot kyla"], "ordforstaelse"],
      ["Vad skyddar skallen?", ["Hjärnan", "Hjärtat", "Magen", "Lungorna"], "fakta"],
      ["Hur många ben har en vuxen människa?", ["206", "26", "2 006", "600"], "fakta"],
      ["Varför har en bebis fler ben än en vuxen?", ["En del ben växer ihop", "Bebisar dricker mer mjölk", "Vuxna tappar sina ben", "Bebisar är större"], "mellan_raderna"],
      ["Var sitter det minsta benet?", ["Inne i örat", "I lilltån", "I näsan", "I fingret"], "fakta"],
      ["Vad behöver benen för att bli starka?", ["Kalk", "Socker", "Salt", "Luft"], "fakta"],
      ["Vad skulle hända om vi inte hade något skelett?", ["Vi skulle inte kunna stå upp", "Vi skulle bli mycket längre", "Vi skulle springa fortare", "Vi skulle inte behöva äta"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-kamelen", title: "Öknens skepp", textType: "fact", topic: "djur",
    body: [
      "Kamelen kallas ibland öknens skepp. Den kan bära tunga saker långt genom heta öknar.",
      "Många tror att kamelen har vatten i sina pucklar. Men det är fel. Pucklarna är fulla av fett. Fettet blir som ett förråd av energi när det inte finns mat.",
      "Kamelen kan klara sig länge utan att dricka. Men när den väl hittar vatten kan den dricka över hundra liter på en kvart.",
      "Kamelen har långa ögonfransar och kan stänga näsborrarna. Då kommer inte sanden in när det blåser.",
    ],
    q: [
      ["Varför kallas kamelen öknens skepp?", ["Den bär saker genom öknen", "Den kan simma i sanden", "Den ser ut som en båt", "Den bor nära havet"], "ordforstaelse"],
      ["Vad finns i pucklarna?", ["Fett", "Vatten", "Sand", "Luft"], "fakta"],
      ["Hur mycket kan kamelen dricka på en kvart?", ["Över hundra liter", "En liter", "Tio liter", "En hink"], "fakta"],
      ["Vad skyddar de långa ögonfransarna mot?", ["Sanden", "Kylan", "Regnet", "Myggorna i öknen"], "fakta"],
      ["En kamel har inte ätit på länge. Vad händer nog med pucklarna?", ["De blir mindre", "De blir större", "De blir blöta", "De byter färg"], "mellan_raderna"],
      ["Vad visar texten om kamelen?", ["Den är gjord för öknen", "Den tycker inte om värme", "Den behöver dricka hela tiden", "Den är rädd för sand"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-rymdstationen", title: "Ett hem i rymden", textType: "fact", topic: "rymden",
    body: [
      "Högt över jorden svävar en stor rymdstation. Där bor och arbetar astronauter i flera månader i taget.",
      "Inne i stationen är allt tyngdlöst. Astronauterna svävar i stället för att gå. De sover i sovsäckar som sitter fast på väggen, så att de inte flyter iväg.",
      "Maten finns i påsar och burkar. Smulor är farliga, eftersom de kan flyga in i maskiner. Därför äter astronauterna mjuka bröd i stället för vanligt bröd.",
      "Rymdstationen åker runt jorden på ungefär en och en halv timme. Därför ser astronauterna solen gå upp sexton gånger varje dygn.",
    ],
    q: [
      ["Hur länge bor astronauterna i stationen?", ["Flera månader", "En dag", "En timme", "Tio år"], "fakta"],
      ["Allt är tyngdlöst. Vad betyder det?", ["Att allt svävar", "Att allt blir tungt", "Att allt fryser", "Att allt går sönder"], "ordforstaelse"],
      ["Var sitter sovsäckarna?", ["På väggen", "På golvet", "I en säng", "Utanför stationen"], "fakta"],
      ["Varför äter astronauterna mjuka bröd?", ["Vanligt bröd smular", "Mjukt bröd är godare", "Det finns inget mjöl", "Vanligt bröd är för tungt"], "fakta"],
      ["Vad skulle hända med en boll som du släpper i stationen?", ["Den skulle sväva", "Den skulle falla ner", "Den skulle studsa", "Den skulle gå sönder"], "mellan_raderna"],
      ["Hur många gånger ser de solen gå upp varje dygn?", ["Sexton", "En", "Två", "Hundra"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur det är att leva i rymden", "Hur man bygger en raket", "Hur solen går upp", "Hur man blir astronaut"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-telefonen", title: "När telefonen var ny", textType: "fact", topic: "historia",
    body: [
      "För ungefär 150 år sedan fick en man som hette Alexander Graham Bell patent på telefonen. Plötsligt kunde människor prata med varandra fast de var långt ifrån varandra.",
      "De första telefonerna satt på väggen. Man vevade på ett handtag och fick prata med en telefonist. Telefonisten kopplade sedan samtalet vidare med sladdar till rätt person.",
      "Först hade bara några få rika familjer telefon. Många gick till posten eller en affär för att ringa.",
      "I dag har nästan alla en mobiltelefon i fickan. Med den kan man både prata, skicka bilder och se film.",
    ],
    q: [
      ["Vad hette mannen som fick patent på telefonen?", ["Alexander Graham Bell", "Alfred Nobel", "Carl von Linné", "Christofer Columbus"], "fakta"],
      ["Var satt de första telefonerna?", ["På väggen", "På bordet", "I fickan", "I bilen"], "fakta"],
      ["Vad gjorde en telefonist?", ["Kopplade samtal vidare", "Lagade trasiga telefoner", "Sålde telefoner i affären", "Bar ut brev"], "ordforstaelse"],
      ["Varför gick många till posten för att ringa?", ["De hade ingen egen telefon", "Det var roligare där", "Posten låg nära", "Det var gratis"], "mellan_raderna"],
      ["Vad kan man göra med en mobil i dag?", ["Skicka bilder", "Veva på ett handtag", "Koppla sladdar", "Skriva runor"], "fakta"],
      ["Vad visar texten?", ["Att telefonen har ändrats mycket", "Att telefoner alltid sett likadana ut", "Att bara rika har mobil i dag", "Att telefonen är tusen år gammal"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-italien", title: "Landet som liknar en stövel", textType: "fact", topic: "länder",
    body: [
      "Titta på en karta över Europa. I söder ser du ett land som liknar en stövel. Det är Italien. Stöveln sticker ut i Medelhavet.",
      "Huvudstaden heter Rom. Där finns en jättestor, gammal arena som heter Colosseum. Den byggdes för nästan 2 000 år sedan.",
      "I Italien finns också vulkaner. Etna på ön Sicilien är en av Europas mest aktiva vulkaner. Den sprutar ut aska och lava då och då.",
      "Många maträtter kommer från Italien, till exempel pizza och pasta. Pizzan kommer från staden Neapel.",
    ],
    q: [
      ["Vad liknar Italien på kartan?", ["En stövel", "En vante", "En fisk", "En hatt"], "fakta"],
      ["Vad heter Italiens huvudstad?", ["Rom", "Neapel", "Sicilien", "Etna"], "fakta"],
      ["När byggdes Colosseum?", ["För nästan 2 000 år sedan", "För 20 år sedan", "För ungefär 200 år sedan", "För ungefär 20 000 år sedan"], "fakta"],
      ["Etna är en aktiv vulkan. Vad betyder det?", ["Den får utbrott ibland", "Den är mycket gammal", "Den är täckt av snö", "Den har slocknat för alltid"], "ordforstaelse"],
      ["Varför kan det vara farligt att bo nära Etna?", ["Det kan komma lava och aska", "Det är alldeles för långt till Rom", "Havet är för kallt att bada i", "Det finns inga affärer"], "mellan_raderna"],
      ["Var kommer pizzan ifrån?", ["Från Neapel", "Från Rom", "Från Sicilien", "Från Sverige"], "fakta"],
    ],
  },
  {
    id: "lr-n1-uppvarmning", title: "Varför värmer man upp?", textType: "fact", topic: "sport",
    body: [
      "Innan en match eller ett träningspass brukar man värma upp. Man joggar lugnt, hoppar och svänger med armarna i några minuter.",
      "Varför gör man det? När musklerna blir varma blir de mjukare och fungerar bättre. Då är det mindre risk att man skadar sig. Hjärtat börjar slå lite fortare och skickar mer blod till musklerna.",
      "Uppvärmningen gör också att man tänker på det man ska göra. Man blir redo i både kroppen och huvudet.",
      "Efter träningen är det bra att jogga lugnt en stund och sträcka ut musklerna. Det kallas nedvarvning.",
    ],
    q: [
      ["Vad gör man när man värmer upp?", ["Joggar lugnt och hoppar", "Ligger och vilar", "Äter en stor måltid", "Sitter still på bänken"], "fakta"],
      ["Vad händer med musklerna när de blir varma?", ["De blir mjukare", "De blir kalla", "De krymper", "De somnar"], "fakta"],
      ["Vad kan hända om man inte värmer upp?", ["Man kan lättare skada sig", "Man blir hungrig", "Matchen blir inställd", "Man blir längre"], "mellan_raderna"],
      ["Vad gör hjärtat under uppvärmningen?", ["Slår lite fortare", "Slutar slå", "Blir mindre", "Slår långsammare"], "fakta"],
      ["Man blir redo. Vad betyder redo?", ["Beredd", "Trött", "Ledsen", "Sjuk"], "ordforstaelse"],
      ["Vad kallas det man gör efter träningen?", ["Nedvarvning", "Uppvärmning", "Halvtid", "Paus"], "fakta"],
      ["Vad är det viktigaste med uppvärmning?", ["Kroppen blir redo för att träna", "Man blir trött innan matchen", "Man hinner prata med kompisarna", "Man får vänta på domaren"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-svamparna", title: "Skogens svampar", textType: "fact", topic: "natur",
    body: [
      "På hösten växer det mycket svamp i skogen. Det vi ser ovanför marken är bara en liten del av svampen. Under jorden finns långa, tunna trådar som kallas mycel. De kan sprida sig över ett stort område.",
      "Svampar är varken växter eller djur. De har inga gröna blad och behöver inte solljus. De får sin näring från döda löv, gamla trädstammar och jorden.",
      "Vissa svampar är goda att äta, till exempel kantareller. Men andra är mycket giftiga. Därför ska man aldrig plocka eller äta svamp utan en vuxen som kan svamp ordentligt.",
    ],
    q: [
      ["När växer det mycket svamp?", ["På hösten", "På vintern", "På våren", "Bara på natten"], "fakta"],
      ["Vad är mycel?", ["Trådar under jorden", "En sorts mycket giftig svamp", "Den runda hatten", "Ett slags löv"], "ordforstaelse"],
      ["Behöver svampar solljus?", ["Nej", "Ja, hela dagen", "Ja, men bara på morgonen", "Bara på sommaren"], "fakta"],
      ["Var får svamparna sin näring ifrån?", ["Från döda löv och stammar", "Bara från solljuset på dagen", "Från fåglar som äter dem", "Från snö som smälter"], "fakta"],
      ["Vilken svamp är god att äta enligt texten?", ["Kantarell", "Flugsvamp", "Ingen alls", "Alla svampar"], "fakta"],
      ["Varför ska en vuxen som kan svamp vara med?", ["Vissa svampar är giftiga", "Svampkorgarna är tunga att bära", "Barn får inte gå i skogen", "Svampar är dyra att köpa"], "mellan_raderna"],
      ["Vilken rubrik passar också till texten?", ["Livet under marken", "Hur man lagar svampsoppa", "Träd som tappar löv", "Djuren i skogen"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-luften", title: "Luften du inte ser", textType: "fact", topic: "vetenskap",
    body: [
      "Luften finns runt omkring oss hela tiden. Vi kan inte se den, men vi kan känna den när det blåser.",
      "Luft tar plats, fast den är osynlig. Det kan du testa själv. Tryck ner ett tomt glas, med öppningen nedåt, i en balja med vatten. Vattnet kan inte fylla glaset. Det beror på att glaset redan är fullt av luft.",
      "Luft väger också lite. En stor ballong full med luft är lite tyngre än en tom ballong.",
      "En viktig del av luften är syre. Människor, djur och växter behöver syre för att leva.",
    ],
    q: [
      ["När kan vi känna luften?", ["När det blåser", "När det är mörkt", "När vi sover", "När det snöar"], "fakta"],
      ["Luften är osynlig. Vad betyder det?", ["Man kan inte se den", "Man kan inte känna den", "Den är mycket kall", "Den luktar illa"], "ordforstaelse"],
      ["Hur ska man hålla glaset i testet?", ["Med öppningen nedåt", "Med öppningen uppåt", "Liggande på sidan", "Med ett lock på"], "fakta"],
      ["Varför kan vattnet inte fylla glaset?", ["Glaset är fullt av luft", "Glaset är för litet", "Vattnet är för kallt", "Baljan är tom"], "fakta"],
      ["Du blåser upp en ballong. Vad fyller du den med?", ["Luft från lungorna", "Vatten", "Sand", "Ingenting"], "mellan_raderna"],
      ["Vilken väger mest?", ["En ballong full med luft", "En tom ballong", "De väger exakt lika", "Ingen av dem väger något"], "fakta"],
      ["Vad vill texten visa?", ["Att luft finns fast den inte syns", "Att man klarar sig bra utan luft", "Att glas flyter i vatten", "Att ballonger alltid spricker"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-cykelhjalmen", title: "Hjälmen som skyddar", textType: "fact", topic: "teknik",
    body: [
      "När du cyklar ska du ha hjälm. I Sverige är det en lag för alla barn under 15 år.",
      "Utanpå är hjälmen gjord av hård plast. Inuti finns ett tjockt lager av en lätt sorts skumplast. Om du ramlar och slår i huvudet trycks skumplasten ihop. Då tar hjälmen emot en stor del av smällen i stället för ditt huvud.",
      "En hjälm måste sitta rätt för att skydda. Den ska sitta rakt på huvudet, en bit ovanför ögonbrynen. Remmen under hakan ska vara spänd.",
      "Om hjälmen har fått en hård smäll ska den bytas, även om den ser hel ut.",
    ],
    q: [
      ["Vilka måste enligt lagen ha hjälm i Sverige?", ["Barn under 15 år", "Bara vuxna", "Alla över 15 år", "Ingen alls"], "fakta"],
      ["Vad är hjälmen gjord av utanpå?", ["Hård plast", "Mjukt tyg", "Tunt papper", "Trä"], "fakta"],
      ["Vad händer med skumplasten vid en smäll?", ["Den trycks ihop", "Den blir blöt", "Den börjar lysa", "Den blir större"], "fakta"],
      ["Remmen ska vara spänd. Vad betyder det?", ["Den ska sitta åt", "Den ska hänga löst", "Den ska vara lång", "Den ska vara bortklippt"], "ordforstaelse"],
      ["Var ska hjälmen sitta?", ["En bit ovanför ögonbrynen", "Långt bak i nacken", "Över öronen", "På sned över ena örat"], "fakta"],
      ["Varför ska man byta en hjälm som fått en smäll fast den ser hel ut?", ["Skummet inuti kan vara förstört", "Den har blivit för liten för huvudet", "Färgen har gått ur", "Den luktar konstigt"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Hur en hjälm skyddar huvudet", "Hur man cyklar fort", "Hur man lagar en cykel", "Var man köper hjälm"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-vasaskeppet", title: "Skeppet som sjönk direkt", textType: "fact", topic: "historia",
    body: [
      "För nästan 400 år sedan byggdes ett stort och vackert krigsskepp i Stockholm. Det hette Vasa. Skeppet hade många kanoner och var fullt av utskurna figurer.",
      "År 1628 skulle Vasa segla ut för första gången. Men skeppet hade bara seglat en liten bit när det började luta. Vatten forsade in genom hålen för kanonerna. Vasa sjönk mitt i hamnen.",
      "I över 300 år låg skeppet på botten. År 1961 lyftes det upp igen. I dag kan man se det på ett museum i Stockholm. Det är nästan helt.",
    ],
    q: [
      ["Var byggdes Vasa?", ["I Stockholm", "I Göteborg", "I Norge", "I Danmark"], "fakta"],
      ["Vilket år sjönk Vasa?", ["1628", "1961", "1826", "1682"], "fakta"],
      ["Vatten forsade in. Vad betyder det?", ["Mycket vatten rann in snabbt", "Lite vatten droppade in", "Vattnet frös till is", "Vattnet blev varmt"], "ordforstaelse"],
      ["Varför kom vatten in genom kanonhålen?", ["Skeppet lutade för mycket", "Någon hade glömt att stänga en dörr", "Det regnade kraftigt", "Kanonerna sköt hål i båten"], "mellan_raderna"],
      ["Hur länge låg skeppet på botten?", ["I över 300 år", "I tre veckor", "I tio år", "I tusen år"], "fakta"],
      ["Vad är det märkliga med Vasa?", ["Det sjönk på sin första resa", "Det seglade jorden runt", "Det hade inga kanoner", "Det var världens minsta skepp"], "helhet_slutsats"],
    ],
  },
];
