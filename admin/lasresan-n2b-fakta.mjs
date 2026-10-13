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
  {
    id: "lr-n2-allemansratten", title: "Naturen är till för alla", textType: "fact", topic: "natur",
    body: [
      "I Sverige finns allemansrätten. Den betyder att alla får vara ute i naturen, även i skogar som någon annan äger. Man får gå, cykla, bada och plocka bär och svamp.",
      "Men allemansrätten har också regler. En kort regel är: inte störa, inte förstöra.",
      "Man får inte gå in på någons tomt eller för nära ett hus. Man får inte bryta grenar eller skada levande träd. Fåglarnas bon och ägg ska man låta vara.",
      "Man får tälta en natt eller två på samma ställe, om det inte är för nära ett hus. Man får göra upp eld om det är säkert, men inte när det är mycket torrt.",
      "Skräp tar man alltid med sig hem. Då kan nästa person också njuta av naturen.",
    ],
    q: [
      ["Vad betyder allemansrätten?", ["Alla får vara ute i naturen", "Alla får bygga hus i skogen", "Alla får jaga vilda djur", "Alla får ta ved från skogen"], "fakta"],
      ["Vad får man plocka enligt texten?", ["Bär och svamp", "Blommor från trädgårdar", "Fågelägg", "Grenar från levande träd"], "fakta"],
      ["Vilken kort regel nämns i texten?", ["Inte störa, inte förstöra", "Först till kvarn", "Ta det lugnt i skogen", "Alla får göra som de vill"], "fakta"],
      ["Man får inte störa. Vad betyder störa här?", ["Vara till besvär", "Hjälpa till", "Städa upp efter sig", "Sova länge"], "ordforstaelse"],
      ["Hur länge får man tälta på samma ställe?", ["En natt eller två", "En hel vecka", "En hel sommar", "Inte en enda natt"], "fakta"],
      ["Varför får man inte elda när det är mycket torrt?", ["Det kan börja brinna i skogen", "Maten blir inte varm", "Röken luktar illa", "Det är för varmt att sitta vid elden"], "mellan_raderna"],
      ["Vad är viktigast enligt texten?", ["Att vara rädd om naturen", "Att plocka så mycket bär som möjligt", "Att alltid tälta nära ett hus", "Att bara gå ut när det är sol"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-stjarnfall", title: "Stjärnor som faller", textType: "fact", topic: "rymden",
    body: [
      "En mörk augustinatt kan du ibland se ett ljus som snabbt drar över himlen. Många kallar det ett stjärnfall. Men det är ingen stjärna som faller.",
      "Ute i rymden finns massor av små stenar och korn av damm. Jorden susar fram genom dem på sin väg runt solen. När ett sådant korn kommer in i luften runt jorden går det otroligt fort. Det blir så varmt att det börjar glöda och brinner upp. Det är det ljusstrecket vi ser.",
      "De flesta kornen är inte större än ett sandkorn. De brinner upp långt ovanför marken.",
      "I mitten av augusti passerar jorden extra många korn. Då kan man se flera stjärnfall i timmen. Det är bäst att titta långt från gatlampor.",
    ],
    q: [
      ["Vad är ett stjärnfall egentligen?", ["Ett litet korn som brinner upp", "En stjärna som slocknar och faller ner", "Ett flygplan med lampor", "En blixt långt borta"], "fakta"],
      ["Hur stora är de flesta kornen?", ["Som ett sandkorn", "Som en fotboll", "Som ett hus", "Som en bil"], "fakta"],
      ["Varför börjar kornet glöda?", ["Det blir väldigt varmt", "Solen lyser på det", "Det krockar med månen", "Det är gjort av eld"], "fakta"],
      ["Jorden susar fram. Vad betyder susar här?", ["Rör sig mycket snabbt", "Står helt stilla", "Snurrar långsamt", "Låter högt"], "ordforstaelse"],
      ["När kan man se extra många stjärnfall?", ["I mitten av augusti", "På julafton", "Mitt i juni", "I början av april"], "fakta"],
      ["Varför ska man titta långt från gatlampor?", ["Himlen blir mörkare där", "Det är mycket tystare där", "Där landar kornen oftare", "Det är varmare på natten där"], "mellan_raderna"],
      ["Vad vill texten främst förklara?", ["Att ett stjärnfall inte är en stjärna", "Att stjärnor ofta faller ner på jorden", "Att det är farligt att titta på himlen", "Att man bara ser stjärnor i augusti"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-venus", title: "Den heta grannen", textType: "fact", topic: "rymden",
    body: [
      "Venus är den planet som kan komma närmast jorden. Den är nästan lika stor som vår planet. Ändå skulle ingen människa kunna leva där.",
      "Runt Venus finns mycket tjock luft och ett lager av moln. Den släpper in solens värme men håller kvar den. Därför är det över 400 grader varmt på marken. Det är varmare än i en ugn, och varmare än på Merkurius, som ligger närmare solen.",
      "Venus snurrar mycket långsamt. En dag på Venus är längre än ett år där.",
      "På kvällen eller tidigt på morgonen kan man ofta se Venus lysa starkt på himlen. Förr kallades den aftonstjärnan eller morgonstjärnan, fast den inte är någon stjärna.",
    ],
    q: [
      ["Hur stor är Venus?", ["Nästan lika stor som jorden", "Mycket större än jorden", "Ungefär lika liten som månen", "Hälften så stor som solen"], "fakta"],
      ["Hur varmt är det på marken?", ["Över 400 grader", "Ungefär 20 grader", "Under noll grader", "Exakt 100 grader"], "fakta"],
      ["Varför är Venus varmare än Merkurius?", ["Värmen kommer inte ut", "Den ligger närmare solen", "Det finns vulkaner överallt", "Den snurrar mycket fortare"], "mellan_raderna"],
      ["Vad är längre på Venus än ett år?", ["En dag", "En vecka", "En timme", "En månad"], "fakta"],
      ["Venus kallades aftonstjärnan. Vad betyder afton?", ["Kväll", "Morgon", "Natt", "Vinter"], "ordforstaelse"],
      ["När kan man se Venus på himlen?", ["Kväll eller tidig morgon", "Bara mitt på dagen", "Bara under sommarlovet i juli", "Aldrig utan en kikare"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur det är på planeten Venus", "Hur man reser till en annan planet", "Varför stjärnor lyser", "Hur man bygger en raket"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-pengar", title: "Innan pengarna fanns", textType: "fact", topic: "historia",
    body: [
      "För mycket länge sedan fanns inga pengar. Om du ville ha något fick du byta. En bonde kunde byta en säck säd mot ett par skor. Men det var inte alltid lätt. Tänk om skomakaren inte ville ha säd!",
      "Därför började människor använda saker som alla ville ha. På olika platser i världen betalade man med snäckor, salt eller pärlor.",
      "Sedan kom mynten. De gjordes av metall som guld, silver eller koppar. Mynten var små, höll länge och var lätta att räkna.",
      "De första sedlarna av papper kom från Kina för ungefär tusen år sedan. Sedlarna var mycket lättare att bära än tunga påsar med mynt.",
      "I dag betalar många med kort eller mobil. Då syns pengarna inte alls.",
    ],
    q: [
      ["Hur fick man saker innan det fanns pengar?", ["Man bytte saker", "Man lånade dem", "Man vann dem i tävlingar", "Man fick dem gratis"], "fakta"],
      ["Varför var det inte alltid lätt att byta?", ["Alla ville inte ha samma saker", "Det fanns inga marknader någonstans", "Ingen kunde räkna till tio", "Allt man bytte var för tungt"], "mellan_raderna"],
      ["Vad betalade man med på vissa platser?", ["Snäckor, salt eller pärlor", "Stenar, pinnar eller löv", "Sand, vatten eller is", "Fjädrar, ben eller hår"], "fakta"],
      ["Vad gjordes mynten av?", ["Metall", "Trä", "Glas", "Lera"], "fakta"],
      ["Vad är en sedel?", ["Pengar av papper", "Ett litet mynt", "En påse för mynt", "Ett bankkort"], "ordforstaelse"],
      ["Var kom de första sedlarna ifrån?", ["Kina", "Sverige", "Egypten", "Italien"], "fakta"],
      ["Vad visar texten?", ["Att pengar har förändrats", "Hur man sparar pengar på banken", "Varför guld är dyrare än silver", "Hur man tillverkar mynt"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-forsta-bilen", title: "Resan som ingen trodde på", textType: "fact", topic: "historia",
    body: [
      "För ungefär 140 år sedan byggde Carl Benz i Tyskland en av de första bilarna. Den hade tre hjul och en liten motor. Många trodde inte på den. De tyckte att den var bullrig och onödig.",
      "Carl Benz fru hette Bertha. En morgon 1888 tog hon bilen utan att fråga. Hon åkte iväg med sina två söner för att hälsa på sin mamma. Resan var ungefär tio mil lång. Ingen hade åkt så långt med bil förut.",
      "På vägen tog bränslet slut. Det fanns inga bensinstationer, så Bertha köpte bränsle på ett apotek. När bromsarna slets ut bad hon en skomakare att sätta läder på dem.",
      "Efter resan började fler människor tro på bilen.",
    ],
    q: [
      ["Hur många hjul hade bilen?", ["Tre", "Fyra", "Två", "Sex"], "fakta"],
      ["Vilka följde med Bertha på resan?", ["Hennes två söner", "Hennes man Carl", "Hennes mamma", "En skomakare"], "fakta"],
      ["Var köpte Bertha bränsle?", ["På ett apotek", "På en bensinstation", "På en bondgård", "I en skoaffär"], "fakta"],
      ["Hur långt åkte hon?", ["Ungefär tio mil", "Ungefär en mil", "Över hundra mil", "Några hundra meter"], "fakta"],
      ["Folk tyckte att bilen var bullrig. Vad betyder bullrig?", ["Den lät mycket", "Den var mycket dyr", "Den gick mycket fort", "Den var mycket liten"], "ordforstaelse"],
      ["Varför tog Bertha bilen utan att fråga, tror du?", ["Hon ville visa vad bilen kunde", "Hon hade bråttom till ett apotek", "Hon var arg på Carl", "Hon ville sälja bilen"], "mellan_raderna"],
      ["Varför var resan viktig?", ["Den fick fler att tro på bilen", "Den gjorde Bertha rik", "Den var den första resan med ett tåg", "Den gav Bertha en medalj"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-kardborren", title: "Idén från skogen", textType: "fact", topic: "teknik",
    body: [
      "För ungefär 80 år sedan var en man från Schweiz ute och gick med sin hund. Han hette George de Mestral. När de kom hem satt det massor av små taggiga kulor i hundens päls. Det var frön från en växt som heter kardborre.",
      "George blev nyfiken. Han tittade på fröna i ett mikroskop. Då såg han att de var fulla av små krokar. Krokarna fastnade i allt som hade små öglor, som tyg och hår.",
      "Han fick en idé. Kunde man göra två band, ett med krokar och ett med öglor, som fastnade i varandra?",
      "Efter flera års arbete var kardborrebandet klart. I dag finns det på skor, jackor och väskor. Till och med astronauter använder det.",
    ],
    q: [
      ["Var satt de taggiga kulorna?", ["I hundens päls", "I Georges hår", "Under skorna", "I hans ryggsäck"], "fakta"],
      ["Vad var kulorna?", ["Frön från kardborre", "Små runda stenar från stigen", "Insekter", "Kottar"], "fakta"],
      ["Vad såg George i mikroskopet?", ["Små krokar", "Små hål", "Små hår", "Små vingar"], "fakta"],
      ["George blev nyfiken. Vad betyder det?", ["Han ville veta mer", "Han blev arg", "Han blev trött", "Han blev rädd"], "ordforstaelse"],
      ["Varför fastnade fröna i hundens päls?", ["Krokarna fastnade i håren", "Pälsen var blöt", "Hunden rullade sig i lera", "Fröna var klibbiga"], "mellan_raderna"],
      ["Hur lång tid tog det att göra bandet?", ["Flera år", "En dag", "En vecka", "En månad"], "fakta"],
      ["Vad visar texten?", ["Naturen kan ge goda idéer", "Hundar är bra på att hitta frön", "Det är farligt att gå i skogen", "Astronauter uppfann kardborrebandet"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-kompassen", title: "Nålen som visar norr", textType: "fact", topic: "teknik",
    body: [
      "En kompass hjälper dig att hitta rätt, även när du inte ser några vägar eller skyltar. Inuti kompassen finns en tunn nål som kan snurra fritt. Nålen är en liten magnet.",
      "Hela jorden fungerar som en jättestor magnet. Den drar i kompassnålen, så att nålens ena ände alltid pekar mot norr. Den änden brukar vara röd.",
      "När du vet var norr är kan du också hitta söder, öster och väster. Söder ligger rakt åt motsatt håll från norr.",
      "Förr i tiden använde sjömän kompassen för att hitta över havet. Det var extra viktigt när det var molnigt och de inte kunde se solen eller stjärnorna.",
      "Lägg aldrig kompassen bredvid en annan magnet. Då kan nålen peka åt fel håll.",
    ],
    q: [
      ["Vad är kompassnålen?", ["En liten magnet", "En tunn pinne av trä", "En liten klocka", "En pil av plast"], "fakta"],
      ["Vilken färg brukar änden mot norr ha?", ["Röd", "Blå", "Gul", "Grön"], "fakta"],
      ["Var ligger söder?", ["Åt motsatt håll från norr", "Till höger om norr", "Alltid åt samma håll som solen går ner", "Åt samma håll som norr"], "fakta"],
      ["Nålen kan snurra fritt. Vad betyder fritt här?", ["Utan att fastna", "Utan att det kostar något", "Mycket långsamt", "Bara åt ett håll"], "ordforstaelse"],
      ["När var kompassen extra viktig för sjömän?", ["När det var molnigt", "När det var varmt", "När det var lugnt", "När de låg i hamn"], "fakta"],
      ["Varför kan nålen peka fel nära en annan magnet?", ["Den andra magneten drar i nålen", "Nålen blir för varm av magneten", "Kompassen går sönder", "Nålen slutar snurra"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Hur en kompass fungerar", "Hur man blir sjöman", "Var magneter tillverkas", "Varför jorden är rund"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-australien", title: "Jul på stranden", textType: "fact", topic: "geografi",
    body: [
      "Australien ligger på andra sidan jordklotet. Det är både ett land och en egen kontinent. Stora delar av landet är torr öken, men längs kusterna finns städer, stränder och regnskog. Mitt i öknen ligger en jättestor röd klippa som heter Uluru.",
      "Australien ligger på södra halvan av jorden. Därför är årstiderna omvända mot våra. När vi firar jul i snö är det sommar där. Många firar julafton på stranden.",
      "I Australien finns många djur som nästan inte lever vilt någon annanstans. Kängurun hoppar fram på sina starka bakben. Ungen bor i en pung på mammans mage. Koalan sover i eukalyptusträd nästan hela dagen och äter deras blad.",
    ],
    q: [
      ["Vad är Australien förutom ett land?", ["En kontinent", "En stad", "En del av Afrika", "Ett berg"], "fakta"],
      ["Hur är stora delar av landet?", ["Torr öken", "Täckt av is", "Höga berg", "Djup skog"], "fakta"],
      ["Varför firar många julafton på stranden?", ["Det är sommar i december", "Stränderna är bara öppna då", "Det är för kallt inomhus", "Tomten bor vid havet"], "mellan_raderna"],
      ["Årstiderna är omvända. Vad betyder omvända?", ["Tvärtom", "Lika långa", "Mycket kalla", "Försvunna"], "ordforstaelse"],
      ["Var bor kängurungen?", ["I en pung på mammans mage", "I ett hål långt ner under marken", "I ett bo i trädet", "På mammans rygg"], "fakta"],
      ["Vad äter koalan?", ["Blad från eukalyptusträd", "Gräs och rötter från marken", "Insekter", "Frukt"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur det är i Australien", "Hur man reser till Australien", "Hur kängurur hoppar", "Varför det finns öknar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-gronland", title: "Den stora vita ön", textType: "fact", topic: "geografi",
    body: [
      "Grönland är världens största ö. Den ligger långt i norr, mellan Atlanten och Norra ishavet. Trots namnet är ön inte särskilt grön. Nästan hela ön är täckt av ett tjockt istäcke. På vissa ställen är isen tre kilometer tjock.",
      "Människorna på Grönland bor mest i små städer och byar längs kusten. Där smälter snön på sommaren, och det växer gräs och blommor. Inne på isen bor nästan ingen.",
      "Mellan byarna finns ofta inga vägar. Då åker man båt eller flyg. På vintern åker många fortfarande hundspann över snön.",
      "På vintern är det mörkt nästan hela dygnet i stora delar av landet. Då kan man ofta se norrsken på himlen.",
    ],
    q: [
      ["Vad är speciellt med Grönland?", ["Det är världens största ö", "Det är världens varmaste land", "Det har flest invånare", "Det ligger vid ekvatorn"], "fakta"],
      ["Vad täcker nästan hela ön?", ["Ett tjockt istäcke", "Grön skog", "Sand", "Gräs och blommor"], "fakta"],
      ["Vad är ett istäcke?", ["Is som täcker marken", "En filt som håller värmen", "Ett tak av is på ett hus", "En frusen sjö"], "ordforstaelse"],
      ["Var bor de flesta människorna?", ["Längs kusten", "Mitt på isen", "Uppe i bergen", "Under marken"], "fakta"],
      ["Hur tar man sig ofta mellan byarna?", ["Med båt eller flyg", "Med tåg", "Med buss", "Med bil på motorvägen"], "fakta"],
      ["Varför är namnet Grönland lite konstigt?", ["Ön är mest vit av is", "Ön är mycket liten", "Ingen bor där", "Det växer bara röda blommor"], "mellan_raderna"],
      ["Vilken rubrik skulle också passa?", ["Livet på en isig ö", "Djuren i öknen", "En stad i söder", "Skogen som aldrig tar slut"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-renarna", title: "Renarna i fjällen", textType: "fact", topic: "geografi",
    body: [
      "Långt upp i norra Sverige lever det många renar. Renen är ett hjortdjur med stora horn. Både hanar och honor har horn, och det är ovanligt bland hjortdjur.",
      "Nästan alla renar i Sverige ägs av samer. Samerna är ett urfolk som har levt i norra Europa i tusentals år. Att sköta renar kallas renskötsel.",
      "Renarna vandrar mellan olika betesmarker under året. På sommaren betar de uppe på fjället, där det blåser och finns färre myggor. På vintern går de ner till skogen. Där gräver de med hovarna genom snön för att komma åt lav.",
      "Varje ren har ett märke i örat. På så sätt vet renskötarna vilka renar som är deras.",
    ],
    q: [
      ["Vilka renar har horn?", ["Både hanar och honor", "Bara hanarna", "Bara de allra äldsta hanarna", "Bara ungarna"], "fakta"],
      ["Vilka äger nästan alla renar i Sverige?", ["Samerna", "Bönderna", "Staten", "Kommunerna"], "fakta"],
      ["Samerna är ett urfolk. Vad betyder urfolk?", ["Folk som bott där mycket länge", "Folk som har flyttat dit nyligen", "Folk som bara bor i stora städer", "Folk som tillverkar klockor"], "ordforstaelse"],
      ["Var betar renarna på sommaren?", ["Uppe på fjället", "Nere vid havet", "Inne i städerna", "I skogen"], "fakta"],
      ["Vad äter renarna på vintern?", ["Lav", "Gräs", "Bär", "Bark"], "fakta"],
      ["Varför vandrar renarna mellan olika betesmarker?", ["Maten finns på olika ställen", "Renskötarna vill motionera", "De letar efter tappade horn", "De tycker om att resa långt varje år"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Renar och renskötsel", "Hur man jagar renar", "Djur i hela Europa", "Hur samerna bygger hus"], "helhet_slutsats"],
    ],
  },
];
