// ============================================================================
// Läsresan – källtexter för nivå 7, fil b, fakta (issue #667)
// ----------------------------------------------------------------------------
// 20 faktatexter, 150–230 ord, 8 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-n4b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-7-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-n4-fjallraven", title: "Räven som byter päls", textType: "fact", topic: "djur",
    body: [
      "Fjällräven är ett av Sveriges mest hotade däggdjur. Den är mindre än den vanliga rödräven och har korta öron, kort nos och en tjock, yvig svans. De små öronen gör att den inte förlorar så mycket värme i kylan.",
      "På vintern är fjällrävens päls vit, så att den smälter in i snön. På sommaren byter den till en grå och brun päls som passar bland stenar och ris på fjället. Pälsen är en av de varmaste som finns hos något djur, och fjällräven klarar temperaturer långt under minus 40 grader.",
      "Den viktigaste maten är lämlar, små gnagare som lever på fjället. Vissa år blir det väldigt många lämlar, och då kan en fjällrävshona föda tio ungar eller fler. Andra år finns det nästan inga lämlar, och då föds det inga ungar alls.",
      "I början av 1900-talet jagades fjällräven för sin fina päls. Till slut fanns det bara ett fåtal djur kvar i Sverige, och 1928 blev den fridlyst. Ändå tog det lång tid innan antalet började öka. Ett problem är att rödräven har flyttat upp på fjället när klimatet har blivit varmare. Den är större och tar både mat och lyor från fjällräven.",
      "I dag hjälper människor till genom att lägga ut mat och jaga bort rödrävar nära fjällrävens lyor.",
    ],
    q: [
      ["Vilken färg har fjällrävens päls på vintern?", ["Vit", "Grå och brun", "Rödbrun", "Svart"], "fakta"],
      ["Vad är fjällrävens viktigaste mat?", ["Lämlar", "Fisk", "Bär och svamp", "Ripor"], "fakta"],
      ["När blev fjällräven fridlyst i Sverige?", ["1928", "1900", "1958", "2000"], "fakta"],
      ["Pälsen ”smälter in” i snön. Vad betyder det?", ["Den syns dåligt mot snön", "Den blir blöt av snön", "Den blir varm i snön", "Den lyser mot snön"], "ordforstaelse"],
      ["Fjällräven är ”fridlyst”. Vad betyder det?", ["Det är förbjudet att jaga den", "Den lever i fred med andra djur", "Den sover hela vintern i sin lya", "Den har flyttat till ett lugnare område"], "ordforstaelse"],
      ["Varför föds det inga ungar vissa år?", ["Lämlarna räcker inte som mat", "Det är för kallt för ungarna på fjället", "Rödräven har ätit upp alla ungar", "Honorna har bytt päls för sent"], "mellan_raderna"],
      ["Varför tog det lång tid innan fjällrävarna blev fler, trots att de var fridlysta?", ["Det fanns mycket få djur kvar att börja med", "Fjällrävarna tyckte inte om att vara fridlysta", "Det fanns för många lämlar på fjället", "Människor fortsatte att köpa deras päls"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Fjällrävens liv och hot mot den", "Hur man känner igen en rödräv på fjället", "Varför lämlar blir så många vissa år", "Hur man jagar räv på vintern"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-kamelen", title: "Puckeln som inte är en vattentank", textType: "fact", topic: "djur",
    body: [
      "Många tror att kamelen har vatten i sin puckel. Det stämmer inte. Puckeln är full av fett. Fettet fungerar som ett matförråd när det är ont om föda i öknen. Om kamelen inte får äta på länge blir puckeln mindre och kan till slut hänga ner åt sidan.",
      "Det finns två sorters kameler. Dromedaren har en puckel och lever i Afrika och på Arabiska halvön. Den baktriska kamelen har två pucklar och lever i kalla öknar i Asien, där vintrarna kan vara mycket stränga.",
      "Kameler klarar sig ändå länge utan att dricka. Det beror på att kroppen är bra på att spara vatten. En kamel svettas nästan inte, eftersom kroppstemperaturen får stiga flera grader under dagen innan den börjar svettas. När den till slut hittar vatten kan den dricka över 100 liter på bara tio minuter.",
      "Kamelen har också andra knep. De långa ögonfransarna skyddar ögonen mot sand, och den kan stänga näsborrarna när det blåser. De breda fötterna gör att den inte sjunker ner i sanden.",
      "I tusentals år har människor använt kameler för att bära varor genom öknen. Därför har kamelen ibland kallats för öknens skepp.",
    ],
    q: [
      ["Vad finns i kamelens puckel?", ["Fett", "Vatten", "Luft", "Muskler"], "fakta"],
      ["Hur många pucklar har en dromedar?", ["En", "Två", "Tre", "Ingen"], "fakta"],
      ["Vintrarna är ”stränga”. Vad betyder det här?", ["Mycket kalla och hårda", "Korta och milda", "Blöta och regniga", "Ljusa och soliga"], "ordforstaelse"],
      ["Vad menas med ett ”matförråd”?", ["Mat som sparas till senare", "Mat som har blivit dålig", "Ett ställe där man köper mat", "Mat som man delar med andra"], "ordforstaelse"],
      ["Varför blir puckeln mindre om kamelen inte äter?", ["Kroppen använder fettet som energi", "Vattnet i puckeln tar slut", "Solen gör att puckeln krymper i värmen", "Kamelen svettas ut fettet"], "mellan_raderna"],
      ["Varför är det bra att kamelen svettas så lite?", ["Den förlorar mindre vatten", "Den luktar mindre illa", "Den blir inte lika smutsig", "Den slipper frysa på natten"], "mellan_raderna"],
      ["Vad visar texten om kamelens kropp?", ["Den är anpassad för livet i öknen", "Den är svag och behöver mycket hjälp", "Den fungerar bäst i fuktiga skogar", "Den behöver dricka vatten varje dag"], "helhet_slutsats"],
      ["Varför har kamelen kallats ”öknens skepp”?", ["Den fraktar varor genom öknen", "Den kan simma lika bra som den går", "Den gungar fram och tillbaka när den går", "Den har pucklar som liknar segel"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-kolibrin", title: "Fågeln som kan flyga baklänges", textType: "fact", topic: "djur",
    body: [
      "Kolibrier är en grupp fåglar som bara finns i Nord- och Sydamerika. Den minsta av dem, bikolibrin, är omkring sex centimeter lång och väger ungefär två gram. Det är ungefär lika mycket som två gem.",
      "Kolibrin är en mästare på att flyga. Den kan stå stilla i luften, flyga åt sidan och till och med baklänges. Hemligheten är vingarna, som rör sig i en åtta i luften och kan slå mellan 50 och 80 gånger i sekunden. Det går så fort att vingarna ser suddiga ut, och de gör ett surrande ljud. Därför kallas fåglarna på engelska för surrande fåglar.",
      "Allt detta flygande kräver mycket energi. Kolibrin äter nektar, en söt saft som finns inne i blommorna. Den har en lång, smal näbb och en tunga som den kan sticka långt in i blomman. Varje dag besöker den hundratals blommor.",
      "Hjärtat slår också snabbt, mer än tusen slag i minuten när fågeln är aktiv. På natten skulle den kunna svälta ihjäl. Därför går den ner i ett slags dvala. Kroppen blir kallare och hjärtat slår långsammare, så att energin räcker tills det blir morgon.",
    ],
    q: [
      ["Var i världen finns kolibrier?", ["I Nord- och Sydamerika", "I Afrika och Asien", "I hela Europa", "I Australien"], "fakta"],
      ["Hur mycket väger en bikolibri ungefär?", ["Två gram", "Tjugo gram", "Två hekto", "Ett halvt kilo"], "fakta"],
      ["Vad äter kolibrin?", ["Nektar från blommor", "Frön och nötter", "Små fiskar", "Löv och gräs"], "fakta"],
      ["Vingarna ser ”suddiga” ut. Vad betyder det?", ["Man kan inte se dem tydligt", "De är smutsiga och gråa", "De är mycket färggranna", "De är små och tunna"], "ordforstaelse"],
      ["Kolibrin går ner i ”dvala”. Vad betyder det?", ["En djup vila som sparar energi", "En lång flygtur till varmare länder", "En sorts lek mellan två fåglar", "Ett bo som byggs nere i marken"], "ordforstaelse"],
      ["Varför måste kolibrin besöka så många blommor varje dag?", ["Flygandet gör av med mycket energi", "Den tycker om att titta på blommor", "Blommorna behöver den för att växa", "Den letar efter ett ställe att sova"], "mellan_raderna"],
      ["Varför skulle kolibrin kunna svälta ihjäl på natten?", ["Den kan inte äta när den sover", "Andra fåglar tar maten på natten", "Den blir rädd i mörkret och flyger bort", "Den glömmer var blommorna finns"], "mellan_raderna"],
      ["Vilken rubrik passar bäst till texten?", ["En liten fågel med stor energi", "Fåglar som flyttar söderut", "Blommor som behöver bin", "Världens största fåglar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-isbjornen", title: "Jägaren på havsisen", textType: "fact", topic: "djur",
    body: [
      "Isbjörnen är världens största rovdjur som lever på land. En vuxen hane kan väga mer än 500 kilo och bli nästan tre meter lång när den står på bakbenen. Ändå tillbringar isbjörnen en stor del av livet ute på havet, på den is som fryser till runt Nordpolen.",
      "Isbjörnens favoritmat är säl. Den väntar ofta tålmodigt vid ett hål i isen där sälen kommer upp för att andas. När sälen dyker upp slår björnen till blixtsnabbt. Sälarna har ett tjockt lager späck, och det fettet ger isbjörnen den energi den behöver.",
      "För att klara kylan har isbjörnen ett fettlager som kan vara tio centimeter tjockt. Pälsen ser vit ut, men håren är egentligen genomskinliga. Under pälsen är huden svart. Isbjörnen är också en mycket bra simmare och kan simma flera mil i sträck.",
      "Honan föder sina ungar i en lya som hon gräver i snön. Där inne föds en eller två ungar mitt i vintern. De väger bara ungefär ett halvt kilo när de föds. De ligger kvar i lyan och dricker mjölk tills de kommer ut på våren.",
      "I dag är isbjörnen hotad. När klimatet blir varmare smälter havsisen tidigare på våren. Då får björnarna kortare tid på sig att jaga.",
    ],
    q: [
      ["Vad är isbjörnens favoritmat?", ["Säl", "Lax", "Ren", "Bär"], "fakta"],
      ["Vilken färg har isbjörnens hud?", ["Svart", "Vit", "Rosa", "Brun"], "fakta"],
      ["Hur mycket väger en isbjörnsunge när den föds?", ["Ungefär ett halvt kilo", "Ungefär fem kilo", "Ungefär ett hekto", "Ungefär femtio kilo"], "fakta"],
      ["Björnen väntar ”tålmodigt”. Vad betyder det?", ["Lugnt och utan att ge upp", "Argt och otåligt", "Snabbt och ivrigt", "Rädd och mycket försiktigt"], "ordforstaelse"],
      ["Isbjörnen kan simma flera mil ”i sträck”. Vad betyder det?", ["Utan att stanna och vila", "Bara rakt fram", "Mycket långsamt", "Bara när det är varmt"], "ordforstaelse"],
      ["Varför väntar isbjörnen vid hål i isen?", ["Där kommer sälar upp för att andas", "Det är varmare nära det öppna vattnet", "Ungarna leker gärna vid hålen", "Den dricker vatten ur hålen"], "mellan_raderna"],
      ["Varför blir det svårare för isbjörnen när isen smälter tidigt?", ["Den får mindre tid att fånga säl", "Den får för varmt i pälsen", "Ungarna kan inte simma", "Den hittar ingen snö att gräva lya i"], "mellan_raderna"],
      ["Vilken mening sammanfattar texten bäst?", ["Isbjörnen behöver isen för att klara sig", "Isbjörnen är farlig och bör hållas borta från byar", "Isbjörnen äter mest bär och växter", "Isbjörnen lever helst i varma skogar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-droppstenar", title: "Istappar av sten", textType: "fact", topic: "natur",
    body: [
      "Långt inne i vissa grottor hänger det spetsiga formationer från taket, som stora istappar. Från golvet växer liknande pelare uppåt. Det är droppstenar, och de har tagit tusentals år att bildas.",
      "Droppstenar bildas i grottor av kalksten. När regnvatten sipprar ner genom marken tar det upp lite koldioxid från jorden. Då blir vattnet svagt surt, och det kan lösa upp lite av kalkstenen på vägen. När vattnet till slut droppar från grottans tak släpper det ifrån sig kalken igen. Ett tunt lager stannar kvar för varje droppe.",
      "De droppstenar som hänger från taket kallas stalaktiter. De som växer upp från golvet, där dropparna landar, kallas stalagmiter. Ibland möts de på mitten och blir en pelare från golv till tak.",
      "Droppstenar växer mycket långsamt. Ofta handlar det om någon centimeter på hundra år, och ibland ännu mindre. En stor stalaktit kan alltså vara många tusen år gammal.",
      "I Sverige finns droppstenar till exempel i Lummelundagrottan på Gotland. Den som besöker en grotta ska inte röra vid stenarna. Fett från händerna kan göra att kalken inte fastnar längre, och då slutar droppstenen att växa.",
    ],
    q: [
      ["Vad kallas droppstenar som hänger från taket?", ["Stalaktiter", "Stalagmiter", "Istappar", "Pelare"], "fakta"],
      ["I vilken sorts sten bildas droppstenar?", ["Kalksten", "Granit", "Sandsten", "Skiffer"], "fakta"],
      ["Var i Sverige finns droppstenar enligt texten?", ["På Gotland", "I Skåne", "I Lappland", "På Öland"], "fakta"],
      ["Vattnet ”sipprar” ner genom marken. Vad betyder det?", ["Det rinner långsamt i små mängder", "Det forsar fram med mycket stor kraft", "Det fryser till is i jorden", "Det stiger upp mot ytan"], "ordforstaelse"],
      ["Vad är en ”formation” i texten?", ["Något som har fått en viss form", "En sorts liten grotta", "Ett slags vatten", "Ett djur som lever i grottor"], "ordforstaelse"],
      ["Varför tar det så lång tid för en droppsten att bli stor?", ["Varje droppe lämnar mycket lite kalk", "Det regnar nästan aldrig över de flesta grottor", "Vattnet droppar bara på vintern", "Kalken smälter bort på sommaren"], "mellan_raderna"],
      ["Varför växer stalagmiter just under stalaktiter?", ["Dropparna landar där", "Där är golvet varmast", "Där är det mest ljus", "Där har människor gått minst"], "mellan_raderna"],
      ["Vad är texten främst till för?", ["Att förklara hur droppstenar bildas", "Att locka turister till Gotland", "Att berätta en spännande grottsaga", "Att lära ut hur man klättrar i grottor"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-tornado", title: "Virveln från molnet", textType: "fact", topic: "natur",
    body: [
      "En tornado är en snurrande pelare av luft som sträcker sig från ett åskmoln ner till marken. Den ser ofta ut som en tratt eller en lång slang. Själva luften syns inte, men tornadon drar med sig damm, jord och vattendroppar, och därför går den att se.",
      "Tornador bildas när varm, fuktig luft möter kallare och torrare luft. Då kan det bildas stora åskmoln där luften börjar snurra. Om den snurrande luften når ner till marken har en tornado bildats.",
      "I de kraftigaste tornadorna kan vinden blåsa mer än 300 kilometer i timmen. Det räcker för att lyfta bilar och slita taket av hus. Ofta varar en tornado bara några minuter, men den kan lämna ett spår av förstörelse efter sig.",
      "Flest tornador i världen finns i USA, där det bildas över tusen varje år. Särskilt många kommer på de stora slätterna mitt i landet. Där finns sirener som varnar invånarna, och många hus har en källare där familjen kan söka skydd.",
      "Det förekommer tornador även i Sverige, men de är ovanliga och oftast små. Om man ändå skulle hamna nära en tornado ska man gå in i ett stadigt hus, helst i källaren eller i ett rum utan fönster.",
    ],
    q: [
      ["Var finns flest tornador i världen?", ["I USA", "I Sverige", "I Kina", "I Australien"], "fakta"],
      ["Hur fort kan vinden blåsa i de kraftigaste tornadorna?", ["Mer än 300 kilometer i timmen", "Ungefär 30 kilometer i timmen", "Ungefär 100 kilometer i timmen", "Mer än 3 000 kilometer i timmen"], "fakta"],
      ["Varför går det att se en tornado fast luft är osynlig?", ["Den drar med sig damm, jord och vatten", "Luften blir svart när den snurrar runt fort", "Den lyser av blixtar hela tiden", "Solen färgar den röd"], "fakta"],
      ["En tornado kan lämna ”ett spår av förstörelse”. Vad betyder det?", ["Skador där den har dragit fram", "Fotspår som syns i leran efter den", "Ett moln som hänger kvar i luften", "En väg som har byggts där den varit"], "ordforstaelse"],
      ["Vad betyder det att tornador ”förekommer” i Sverige?", ["Att de finns", "Att de är farligast", "Att de är förbjudna", "Att de aldrig kommer"], "ordforstaelse"],
      ["Varför är ett rum utan fönster säkrast?", ["Fönster kan krossas av vinden", "Det är mörkare och lugnare där", "Tornadon hittar inte in där", "Det blir varmare i ett sådant rum"], "mellan_raderna"],
      ["Varför finns det sirener på slätterna i USA?", ["Människor behöver hinna söka skydd", "Sirenerna skrämmer bort tornadon", "Sirenerna mäter hur fort det blåser", "De spelar musik när vädret är fint"], "mellan_raderna"],
      ["Vad handlar texten mest om?", ["Vad tornador är och hur man skyddar sig", "Varför det är farligt att bo i USA", "Hur man bygger ett hus med en stor källare", "Hur åskmoln blir till regn"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-jattetraden", title: "Jättarna i skogen", textType: "fact", topic: "natur",
    body: [
      "I bergen i Kalifornien i USA växer jättesequoian, ett av de största levande tingen på jorden. De största träden är omkring 80 meter höga, lika högt som ett hus med 25 våningar. Stammen kan vara mer än tio meter bred nertill. Om man räknar hur mycket trä ett träd innehåller, finns det inget större träd i världen.",
      "Jättesequoian kan också bli mycket gammal. Vissa träd har stått i över 3 000 år. De började alltså växa långt innan vikingarna seglade över haven.",
      "En av hemligheterna bakom den långa livstiden är barken. Den kan vara över en halv meter tjock och är svampig och mjuk att ta på. Barken innehåller nästan ingen kåda, och därför brinner den dåligt. När det blir skogsbrand klarar sig de stora träden ofta, medan mindre träd runt omkring brinner upp.",
      "Elden är till och med bra för sequoian. Värmen gör att kottarna öppnar sig och släpper ut sina frön. Elden har också bränt bort andra växter, så att de små plantorna får ljus och plats att växa.",
      "Det högsta trädet i världen är en annan art, kustsequoian, som växer närmare havet. Den kan bli mer än 110 meter hög men är inte lika tjock.",
    ],
    q: [
      ["Var växer jättesequoian?", ["I Kalifornien i USA", "I norra Sverige", "I Brasilien", "I Australien"], "fakta"],
      ["Hur tjock kan barken vara?", ["Över en halv meter", "Någon centimeter", "Över fem meter", "Ungefär en millimeter"], "fakta"],
      ["Vilket träd är det högsta i världen enligt texten?", ["Kustsequoian", "Jättesequoian", "Granen", "Eken"], "fakta"],
      ["Barken är ”svampig”. Vad betyder det här?", ["Den är mjuk med många små hål", "Den har små svampar på sig", "Den är hal och blöt", "Den är hård som sten"], "ordforstaelse"],
      ["Vad menas med ”livstid”?", ["Hur länge något lever", "Hur stort något blir", "När något föds", "Vad något äter"], "ordforstaelse"],
      ["Varför klarar sig de stora träden ofta vid skogsbrand?", ["Den tjocka barken brinner dåligt", "De står långt ifrån andra träd", "Brandmän skyddar dem alltid", "De har mycket vatten inne i den tjocka stammen"], "mellan_raderna"],
      ["Varför nämner texten vikingarna?", ["För att visa hur gamla träden är", "För att vikingarna planterade träden", "För att vikingarna byggde skepp av dem", "För att vikingarna bodde i Kalifornien"], "helhet_slutsats"],
      ["Vad visar texten om jättesequoian och elden?", ["Elden kan hjälpa nya träd att växa", "Elden är alltid dålig för skogen", "Träden brinner lättare än andra träd", "Elden gör att träden slutar växa"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-stjarnfall", title: "Stjärnorna som faller i augusti", textType: "fact", topic: "rymden",
    body: [
      "En mörk kväll kan man ibland se en ljusstrimma som snabbt drar över himlen. Det ser ut som om en stjärna faller. Men det är inte alls en stjärna. Det är ett litet korn från rymden som brinner upp högt över våra huvuden.",
      "Rymden är full av sådana korn av sten och metall. De flesta är inte större än ett sandkorn. När jorden på sin färd runt solen träffar på ett korn, rusar det in i luften runt jorden i en enorm fart, ofta flera mil i sekunden. Luften framför kornet pressas ihop och blir så het att kornet glöder och brinner upp. Det sker ungefär tio mil upp. Forskare kallar det för en meteor.",
      "Varje år i augusti passerar jorden ett område där en komet har lämnat efter sig massor av små korn. Då kan man se många stjärnfall på samma natt, ibland mer än ett i minuten. Den här svärmen kallas Perseiderna. Det bästa sättet att se dem är att åka ut på landet, långt från gatlampor, och ligga på rygg och titta upp.",
      "Om ett större stenblock kommer in i luften brinner det kanske inte upp helt. Den bit som når ända ner till marken kallas för en meteorit.",
    ],
    q: [
      ["Hur stora är de flesta korn som blir stjärnfall?", ["Som ett sandkorn", "Som en fotboll", "Som en bil", "Som ett hus"], "fakta"],
      ["Vad kallas svärmen av stjärnfall i augusti?", ["Perseiderna", "Meteoriterna", "Kometerna", "Vintergatan"], "fakta"],
      ["Vad kallas en bit som når ända ner till marken?", ["En meteorit", "En meteor", "En komet", "En planet"], "fakta"],
      ["Vad är en ”ljusstrimma”?", ["Ett smalt streck av ljus", "En stor och rund lampa", "En ljus fläck på marken", "Ett moln som lyser"], "ordforstaelse"],
      ["Luften ”pressas ihop”. Vad betyder det?", ["Den trycks samman", "Den blir kallare", "Den försvinner", "Den blåser bort"], "ordforstaelse"],
      ["Varför är det bäst att titta långt från gatlampor?", ["Det blir mörkare och lättare att se", "Det faller fler stjärnfall ute på landet", "Gatlampor lockar till sig stjärnfall", "Man får bättre luft att andas"], "mellan_raderna"],
      ["Varför heter det ”stjärnfall” fast det inte är stjärnor?", ["Det ser ut som om en stjärna faller", "Kornen kommer från en stjärna", "Forskarna har bestämt det namnet helt nyligen", "Stjärnorna tappar korn varje år"], "mellan_raderna"],
      ["Vad är det viktigaste texten vill förklara?", ["Vad ett stjärnfall egentligen är", "Hur man bygger ett teleskop", "Varför stjärnor lyser starkare på natten", "Hur kometer får sina namn"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-uranus", title: "Planeten som ligger på sidan", textType: "fact", topic: "rymden",
    body: [
      "Uranus är den sjunde planeten från solen. Den är en isjätte, fyra gånger så bred som jorden, och den är täckt av tjocka moln av gas. En gas som heter metan gör att planeten ser blågrön ut.",
      "Det mest märkliga med Uranus är att den ligger på sidan. Alla planeter snurrar runt sin egen axel, ungefär som en snurra. Jorden lutar lite grann, men Uranus lutar så mycket att den nästan rullar fram i sin bana runt solen, som ett klot. Forskare tror att planeten för länge sedan blev träffad av en enorm himlakropp som knuffade den på sidan.",
      "Det får konstiga följder. Det tar Uranus 84 jordår att gå ett varv runt solen. Under ungefär hälften av den tiden är den ena polen vänd mot solen. Där är det ljust i omkring 42 år i sträck. På andra sidan är det lika länge mörkt.",
      "Uranus var den första planeten som upptäcktes med teleskop. Det gjorde astronomen William Herschel år 1781. Först trodde han att det var en komet.",
      "Bara en rymdsond har besökt Uranus. Det var Voyager 2, som flög förbi 1986 och skickade hem de första närbilderna. Ingen sond har varit där sedan dess.",
    ],
    q: [
      ["Vilken planet från solen är Uranus?", ["Den sjunde", "Den femte", "Den åttonde", "Den tredje"], "fakta"],
      ["Vem upptäckte Uranus?", ["William Herschel", "Galileo Galilei", "Isaac Newton", "Voyager 2"], "fakta"],
      ["Hur länge tar det för Uranus att gå ett varv runt solen?", ["84 år", "42 år", "Ett år", "12 år"], "fakta"],
      ["Något får ”följder”. Vad betyder det?", ["Det leder till andra saker", "Det följer efter något annat", "Det blir mindre och mindre", "Det glöms bort med tiden"], "ordforstaelse"],
      ["Vad är en ”himlakropp”?", ["Ett föremål ute i rymden", "En ängel på himlen", "Ett moln av gas", "En sorts raket"], "ordforstaelse"],
      ["Varför är det ljust i 42 år på en av polerna?", ["Polen är vänd mot solen halva varvet", "Uranus snurrar inte alls", "Solen ligger närmare Uranus", "Molnen på Uranus lyser av sig själva hela tiden"], "mellan_raderna"],
      ["Varför vet forskarna ganska lite om Uranus?", ["Bara en rymdsond har varit där", "Planeten är för liten för att synas", "Den är dold bakom solen", "Ingen har tittat på den i teleskop"], "mellan_raderna"],
      ["Vilken rubrik passar också till texten?", ["Den udda planeten", "Jordens närmaste granne", "Den varmaste planeten", "Planeten med flest månar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n4-kinesiska-muren", title: "Muren som slingrar sig genom Kina", textType: "fact", topic: "historia",
    body: [
      "Kinesiska muren är ett av världens mest kända byggnadsverk. Men egentligen är det inte en enda mur. Det är många murar som har byggts under olika tider, i över 2 000 år.",
      "De första murarna byggdes av packad jord och sten för att skydda rikets gränser i norr. Där bodde folk som levde som nomader och flyttade runt med sina djur. Ibland red de in i Kina för att plundra byar. Murarna skulle göra det svårare för dem att ta sig in.",
      "Den del som de flesta turister besöker i dag byggdes för ungefär 500 år sedan. Den är gjord av tegel och sten och slingrar sig fram över branta berg. Uppe på muren fanns en gångväg där soldaterna kunde gå, och med jämna mellanrum stod vakttorn. Om fiender kom tände soldaterna eldar. Röken syntes från torn till torn, och på så sätt kunde ett meddelande färdas många mil på kort tid.",
      "Om man lägger ihop alla delar blir muren över 20 000 kilometer lång. Det är längre än halva vägen runt jorden.",
      "Många tror att muren syns från rymden med blotta ögat. Det stämmer inte. Den är visserligen lång, men den är för smal för att synas så högt upp.",
    ],
    q: [
      ["Vad var de första murarna byggda av?", ["Packad jord och sten", "Tegel och betong", "Trä och lera", "Järn och sten"], "fakta"],
      ["Hur lång är muren om man lägger ihop alla delar?", ["Över 20 000 kilometer", "Ungefär 2 000 kilometer", "Ungefär 500 kilometer", "Över 200 000 kilometer"], "fakta"],
      ["Hur skickade soldaterna meddelanden mellan tornen?", ["Med rök från eldar", "Med brevduvor", "Med trummor", "Med flaggor"], "fakta"],
      ["Nomaderna kom för att ”plundra”. Vad betyder det?", ["Ta saker med våld", "Handla med varor", "Hälsa på släktingar", "Bygga nya hus"], "ordforstaelse"],
      ["Vad betyder ”med blotta ögat”?", ["Utan några hjälpmedel", "Med ett öga stängt", "Bara på natten", "Genom ett fönster"], "ordforstaelse"],
      ["Varför byggdes muren just i norr?", ["Därifrån kom de som anföll byarna", "Där var det varmast och lättast att bygga", "Där fanns det mest tegel", "Där bodde kejsaren"], "mellan_raderna"],
      ["Vilken vanlig tro om muren säger texten är fel?", ["Att den syns från rymden", "Att den är byggd av tegel", "Att den har vakttorn", "Att den finns i Kina"], "helhet_slutsats"],
      ["Varför kallar texten muren för ”många murar”?", ["Den byggdes i delar under lång tid", "Den består av två murar bredvid varandra", "Den har byggts om efter varje krig", "Den har många olika namn"], "helhet_slutsats"],
    ],
  },
];
