// ============================================================================
// Läsresan – källtexter för nivå 5 del b, fact (issue #665)
// ----------------------------------------------------------------------------
// 20 faktatexter, 80–140 ord, 7 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-n2b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-5-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-n2-kamelen", title: "Öknens skepp", textType: "fact", topic: "djur",
    body: [
      "Kamelen kallas ibland öknens skepp. Den kan bära tunga lass långt genom het sand, där många andra djur skulle ge upp.",
      "Många tror att kamelen har vatten i puckeln. Men det stämmer inte. Puckeln är full av fett. När det är ont om mat kan kamelen leva på fettet en tid.",
      "En törstig kamel kan dricka över hundra liter vatten på tio minuter. Sedan kan den klara sig i flera dagar utan att dricka.",
      "Kamelens kropp passar för öknen. Den har långa ögonfransar som skyddar mot sand. Näsborrarna kan den stänga när det blåser. Fötterna är breda och mjuka, så den sjunker inte ner i sanden.",
      "Det finns kameler med en puckel och kameler med två pucklar.",
    ],
    q: [
      ["Vad finns i kamelens puckel?", ["Fett", "Vatten", "Luft", "Muskler"], "fakta"],
      ["Hur mycket kan en törstig kamel dricka på tio minuter?", ["Över hundra liter", "Ungefär tio liter", "Nästan tusen liter", "Bara några glas"], "fakta"],
      ["Vad skyddar kamelens ögon mot sanden?", ["Långa ögonfransar", "Tjocka ögonbryn", "Stora öron", "Ett tjockt lager fett"], "fakta"],
      ["Kamelen bär tunga lass. Vad är ett lass?", ["Saker som man lastar på", "En sorts sadel", "En lång resa", "Ett stort tält"], "ordforstaelse"],
      ["Varför sjunker inte kamelen ner i sanden?", ["Fötterna är breda och mjuka", "Den går mycket fort", "Den väger nästan ingenting", "Den hoppar fram"], "fakta"],
      ["Varför kallas kamelen öknens skepp, tror du?", ["Den reser långt över sanden", "Den kan simma långt ute i havet", "Den sover gärna i båtar", "Den har segel på ryggen"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Hur kamelen klarar öknen", "Hur man rider på en kamel", "Vilka djur som bor i öknen", "Hur man hittar vatten i sanden"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-elefanten", title: "Näsan som kan allt", textType: "fact", topic: "djur",
    body: [
      "Elefanten är det största djuret som lever på land. Det man lägger märke till först är ofta snabeln. Snabeln är elefantens näsa och överläpp, som har vuxit ihop till en lång och stark slang.",
      "Med snabeln kan elefanten lyfta en tung trädstam. Men den kan också plocka upp en enda liten nöt. Snabeln har tusentals muskler men inget ben.",
      "Elefanten dricker inte genom snabeln som med ett sugrör. Den suger upp vatten i snabeln och sprutar sedan in det i munnen. En varm dag kan den spruta vatten över ryggen för att svalka sig.",
      "När två elefanter möts kan de fläta ihop snablarna. Det är ett sätt att hälsa, ungefär som när vi kramas.",
    ],
    q: [
      ["Vad är snabeln?", ["Näsan och överläppen", "Elefantens tunga", "En lång och böjd framtand", "Elefantens arm"], "fakta"],
      ["Vad saknas i snabeln?", ["Ben", "Muskler", "Hud", "Känsel"], "fakta"],
      ["Hur dricker elefanten?", ["Sprutar vatten i munnen", "Suger som med ett sugrör", "Slickar med tungan", "Doppar hela huvudet"], "fakta"],
      ["Elefanten vill svalka sig. Vad betyder det?", ["Bli lite kallare", "Bli torr", "Bli ren", "Leka med de andra"], "ordforstaelse"],
      ["Varför är det bra att snabeln kan plocka upp en liten nöt?", ["Elefanten kan äta små saker", "Elefanten kan bära sina ungar", "Elefanten kan gräva djupa hål i marken", "Elefanten kan klättra upp i träd"], "mellan_raderna"],
      ["Hur hälsar elefanter på varandra?", ["De flätar ihop snablarna", "De trampar med fötterna", "De viftar med öronen", "De lägger sig ner"], "fakta"],
      ["Vilken mening sammanfattar texten bäst?", ["Snabeln kan användas till mycket", "Elefanter är farliga djur", "Elefanter lever bara i Afrika", "Elefanter sover alltid stående"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-sengangaren", title: "Världens lataste djur?", textType: "fact", topic: "djur",
    body: [
      "Sengångaren bor i regnskogen i Syd- och Centralamerika. Den hänger upp och ner i träden med sina långa, böjda klor. Där äter den löv, sover och vilar.",
      "Sengångaren rör sig mycket långsamt. På en hel minut kommer den bara några meter. Många tror att den är lat, men den sparar på krafterna. Löven som den äter ger nämligen väldigt lite energi.",
      "Pälsen är ofta lite grön. Det beror på att små alger växer i den. Det gröna gör att sengångaren smälter in bland löven. Då är det svårare för örnar att få syn på den.",
      "Ungefär en gång i veckan klättrar sengångaren ner till marken. Då bajsar den. Sedan klättrar den lika sakta upp igen.",
    ],
    q: [
      ["Var bor sengångaren?", ["I regnskogen", "I öknen", "På savannen", "Uppe i bergen"], "fakta"],
      ["Vad äter sengångaren?", ["Löv", "Insekter", "Fisk", "Nötter"], "fakta"],
      ["Varför rör sig sengångaren så långsamt?", ["Maten ger den lite kraft", "Den har ont i benen", "Den är rädd för höjder", "Den har för korta armar"], "mellan_raderna"],
      ["Varför är pälsen ofta grön?", ["Det växer alger i den", "Den rullar sig i gräset", "Den äter så mycket gröna löv", "Den föds med grön päls"], "fakta"],
      ["Sengångaren smälter in bland löven. Vad betyder det?", ["Den syns dåligt där", "Den blir varm där", "Den blir blöt där", "Den äter upp dem"], "ordforstaelse"],
      ["Hur ofta klättrar sengångaren ner till marken?", ["En gång i veckan", "Flera gånger varje dag", "En gång om året", "Varje timme"], "fakta"],
      ["Varför har rubriken ett frågetecken?", ["Sengångaren är inte lat på riktigt", "Ingen vet var den bor", "Djuret är egentligen snabbt", "Texten handlar om flera djur"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-kaktusen", title: "Växten som sparar vatten", textType: "fact", topic: "natur",
    body: [
      "I öknen kan det gå många månader utan regn. Ändå växer det kaktusar där. Hur klarar de sig?",
      "En kaktus har en tjock och saftig stam. Den fungerar som ett förråd. När det väl regnar suger rötterna snabbt upp mycket vatten. Rötterna ligger nära ytan och breder ut sig åt alla håll. Då hinner de fånga regnet innan det torkar bort.",
      "De flesta kaktusar har inga vanliga blad. I stället har de taggar. Från stora blad skulle vattnet avdunsta i den heta solen. Taggarna gör också att djur inte vill äta av den saftiga stammen.",
      "En del kaktusar blir mycket gamla. Den stora saguarokaktusen kan bli över tolv meter hög och leva i mer än hundra år.",
    ],
    q: [
      ["Var sparar kaktusen vatten?", ["I den tjocka stammen", "I taggarna", "I blommorna", "I sanden under sig"], "fakta"],
      ["Hur ligger kaktusens rötter?", ["Nära ytan och utbredda", "Djupt rakt ner", "Ihoprullade under stammen", "Ovanpå sanden"], "fakta"],
      ["Stammen fungerar som ett förråd. Vad är ett förråd?", ["En plats där man sparar saker", "En sorts rot", "Ett stort hål i marken", "En tagg som skyddar"], "ordforstaelse"],
      ["Vad har de flesta kaktusar i stället för blad?", ["Taggar", "Blommor", "Rötter", "Frukter"], "fakta"],
      ["Vad skulle hända om kaktusen hade stora blad?", ["Den skulle förlora mer vatten", "Den skulle växa mycket fortare", "Den skulle bli mer stickig", "Den skulle tåla mer sol"], "mellan_raderna"],
      ["Hur länge kan en saguarokaktus leva?", ["Mer än hundra år", "Ungefär tio år", "Bara en sommar", "Ungefär femtio dagar"], "fakta"],
      ["Vad förklarar texten?", ["Hur kaktusen klarar torka", "Hur man vattnar en kaktus", "Varför det är varmt i öknen", "Vilka djur som äter kaktus"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-barnsten", title: "Guld från havet", textType: "fact", topic: "natur",
    body: [
      "Ibland hittar man små gula eller bruna stenar på stranden i södra Sverige. Om man håller upp dem mot solen lyser de som honung. Det är bärnsten.",
      "Bärnsten är egentligen ingen sten. Det är kåda från träd som växte för miljontals år sedan. Kådan rann ner längs stammarna, stelnade och hamnade till slut i marken. Där blev den hård under mycket lång tid.",
      "Ibland fastnade små djur i kådan medan den var kladdig. Därför kan man hitta myggor, myror och spindlar i bärnsten. De ser nästan ut som när de levde.",
      "Bärnsten är nästan lika lätt som vatten. Därför kan vågorna föra den långt. Efter en storm sköljs ofta nya bitar upp på stranden.",
    ],
    q: [
      ["Vad är bärnsten egentligen?", ["Kåda från gamla träd", "En sorts glas", "Hårda snäckskal", "Smält guld"], "fakta"],
      ["Hur gammal kan bärnsten vara?", ["Miljontals år", "Hundra år", "Tio år", "Tusen år"], "fakta"],
      ["Kådan stelnade. Vad betyder stelnade?", ["Blev fast", "Blev varm och mjuk", "Rann iväg", "Försvann helt"], "ordforstaelse"],
      ["Vad kan man hitta inuti bärnsten?", ["Små djur som myggor", "Små vita pärlor av glas", "Gamla mynt", "Vattendroppar"], "fakta"],
      ["Varför fastnade djuren i kådan?", ["Kådan var kladdig", "De ville äta av den", "Det var kallt ute", "De gömde sig för vinden"], "mellan_raderna"],
      ["När sköljs ofta nya bitar upp på stranden?", ["Efter en storm", "Mitt i vintern", "När havet är lugnt", "Varje natt"], "fakta"],
      ["Varför heter texten Guld från havet, tror du?", ["Bärnsten är gul och fin", "Det finns guld på havsbotten", "Fiskarna är värdefulla", "Sanden på stranden är gul"], "helhet_slutsats"],
    ],
  },
];
