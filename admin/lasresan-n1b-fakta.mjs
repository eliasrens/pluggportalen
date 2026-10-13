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
];
