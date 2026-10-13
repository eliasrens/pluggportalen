// ============================================================================
// Läsresan – källtexter för nivå 2 del b, fact (issue #662)
// ----------------------------------------------------------------------------
// 20 fakta-texter, 60–90 ord, 4–5 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g2b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-2-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g2-trollslandan", title: "Trollsländan", textType: "fact", topic: "djur",
    body: [
      "Trollsländan är en insekt med fyra långa vingar. Vingarna är tunna och genomskinliga. Den kan flyga framåt, bakåt och stå still i luften.",
      "Trollsländan har jättestora ögon. Den ser nästan åt alla håll på en gång. Därför är den bra på att jaga. Den fångar myggor och flugor i flykten.",
      "Ungen bor i vatten i flera år. Den kallas nymf. En dag kryper den upp på ett strå. Då spricker skalet, och en trollslända flyger ut.",
    ],
    q: [
      ["Hur många vingar har trollsländan?", ["Fyra", "Två", "Sex", "Åtta"], "fakta"],
      ["Hur kan trollsländan flyga?", ["Framåt, bakåt och stå still", "Bara rakt framåt", "Bara uppåt", "Bara när det blåser"], "fakta"],
      ["Vad fångar trollsländan?", ["Myggor och flugor", "Små fiskar i sjön", "Fåglar", "Blad"], "fakta"],
      ["Var bor ungen?", ["I vatten", "I ett träd", "Under en sten", "I en blomma"], "fakta"],
      ["Var ser man nog flest trollsländor?", ["Nära sjöar och dammar", "I öknen", "På ett berg med snö", "Inne i hus"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-pingvinen", title: "Fågeln som simmar", textType: "fact", topic: "djur",
    body: [
      "Pingvinen är en fågel. Den har vingar, men den kan inte flyga. I stället är den mycket bra på att simma.",
      "Under vattnet använder pingvinen vingarna som paddlar. Den simmar snabbt och fångar fisk.",
      "De flesta pingviner bor på den södra delen av jorden. Många bor där det är kallt, till exempel i Antarktis.",
      "Pingvinen har tjocka fjädrar och ett lager fett under huden. Det håller den varm i det iskalla vattnet.",
    ],
    q: [
      ["Vad kan pingvinen inte göra?", ["Flyga", "Simma", "Gå", "Äta fisk"], "fakta"],
      ["Hur använder pingvinen vingarna i vattnet?", ["Som paddlar", "Som ett tak", "Som en mössa", "Som fötter"], "fakta"],
      ["Var bor de flesta pingviner?", ["På södra delen av jorden", "I skogarna i Sverige", "I varma öknar", "På norra delen av jorden"], "fakta"],
      ["Vad håller pingvinen varm?", ["Fjädrar och fett", "En tjock päls", "Solen på isen", "Varmt vatten"], "fakta"],
      ["Vattnet är iskallt. Vad betyder iskallt?", ["Väldigt kallt", "Lite ljummet", "Mycket smutsigt", "Ganska grunt"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-nackrosen", title: "Blomman som flyter", textType: "fact", topic: "natur",
    body: [
      "I många svenska sjöar växer näckrosor. De har stora, runda blad som flyter på vattnet. Bladen är gröna och blanka. Vattnet rinner av dem som av en regnjacka.",
      "Blomman är vit. Den öppnar sig när solen skiner. På kvällen stänger den sig igen.",
      "Näckrosen har en lång stjälk. Den går hela vägen ner till botten. Där sitter roten fast i dyn.",
      "Grodor sitter gärna på bladen och vilar.",
    ],
    q: [
      ["Hur ser bladen ut?", ["Stora och runda", "Små och spetsiga", "Långa och smala", "Röda och lurviga"], "fakta"],
      ["När öppnar sig blomman?", ["När solen skiner", "Mitt i natten", "När det regnar", "Bara på vintern"], "fakta"],
      ["Var sitter roten?", ["I dyn på botten", "Uppe på ett blad", "Ute i luften", "På stranden"], "fakta"],
      ["Roten sitter i dyn. Vad är dy?", ["Gyttja på botten", "Ett slags fisk", "Ett torrt löv", "Varm sand på stranden"], "ordforstaelse"],
      ["Varför kan en groda sitta på bladet?", ["Bladet flyter och är stort", "Grodan är mycket tung", "Bladet är vasst", "Blomman är vit"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-gaspningen", title: "Ett stort gäsp", textType: "fact", topic: "kroppen",
    body: [
      "Ett gäsp är när munnen öppnas stort. Man drar in mycket luft. Alla människor gäspar. Det gör också hundar, katter och fåglar.",
      "Vi gäspar ofta när vi är trötta eller har tråkigt. Forskarna vet inte säkert varför. Kanske hjälper gäspet hjärnan att vakna lite.",
      "Gäsp smittar! Om du ser någon gäspa vill du ofta gäspa själv. Ibland räcker det att läsa om gäsp. Har du gäspat nu?",
    ],
    q: [
      ["Vad gör man när man gäspar?", ["Öppnar munnen stort", "Blundar hårt med båda ögonen", "Hostar högt", "Visslar en låt"], "fakta"],
      ["Vilka djur gäspar, enligt texten?", ["Hundar, katter och fåglar", "Bara hundar", "Inga djur alls", "Fiskar, maskar och sniglar"], "fakta"],
      ["När gäspar vi ofta?", ["När vi är trötta", "När vi äter", "När vi springer fort i skogen", "När vi är arga"], "fakta"],
      ["Gäsp smittar. Vad betyder det här?", ["Man gäspar när andra gäspar", "Man blir sjuk", "Man får feber", "Man somnar direkt"], "ordforstaelse"],
      ["Varför frågar texten till sist om du har gäspat?", ["Det kan smitta att läsa om gäsp", "Du ska gå och lägga dig", "Texten är tråkig", "Den vill veta vad klockan är"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-pandan", title: "Björnen som äter bambu", textType: "fact", topic: "djur",
    body: [
      "Jättepandan är en björn som bor i Kina. Den har vit päls med svarta fläckar runt ögonen.",
      "Pandan äter nästan bara bambu. Bambu är ett slags högt gräs. Det ger inte så mycket kraft. Därför äter pandan nästan hela dagen. Den äter mer än tio kilo varje dag.",
      "När pandan inte äter, sover den ofta. Då sparar den på krafterna.",
      "En pandaunge är mycket liten när den föds. Den väger ungefär lika lite som ett äpple.",
    ],
    q: [
      ["Var bor jättepandan?", ["I Kina", "I Afrika", "I Sverige", "I Brasilien"], "fakta"],
      ["Vad äter pandan nästan bara?", ["Bambu", "Fisk", "Honung", "Bär"], "fakta"],
      ["Hur mycket äter pandan varje dag?", ["Mer än tio kilo", "Ett kilo", "Hundra kilo", "Bara ett litet äpple"], "fakta"],
      ["Hur mycket väger en nyfödd pandaunge?", ["Ungefär som ett äpple", "Som en hund", "Som en vuxen panda", "Som en stor och tjock katt"], "fakta"],
      ["Varför sover pandan så mycket?", ["Maten ger inte så mycket kraft", "Den är rädd för andra djur", "Det är mörkt i skogen", "Den har ont i magen"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-krokodilen", title: "Krokodilen i floden", textType: "fact", topic: "djur",
    body: [
      "Krokodilen är ett kräldjur. Den bor i varma floder och sjöar. Huden är tjock och hård, nästan som ett pansar.",
      "Krokodilen ligger ofta helt stilla i vattnet. Bara ögonen och näsan syns ovanför ytan. Så kan den smyga sig på djur som kommer för att dricka.",
      "En krokodil har många vassa tänder. Om en tand går sönder växer en ny ut.",
      "Ungarna kläcks ur ägg. Mamman bär försiktigt ungarna till vattnet i munnen.",
    ],
    q: [
      ["Var bor krokodilen?", ["I varma floder", "I kalla hav", "I öknen", "Uppe i träden"], "fakta"],
      ["Vad syns när krokodilen ligger i vattnet?", ["Ögonen och näsan", "Hela kroppen", "Bara den långa svansen", "Ingenting"], "fakta"],
      ["Vad händer när en tand går sönder?", ["En ny tand växer ut", "Krokodilen kan inte äta", "Den letar upp tanden", "Mamman lagar den"], "fakta"],
      ["Hur kommer ungarna till vattnet?", ["Mamman bär dem i munnen", "De flyger", "Pappan knuffar dem", "De rullar nerför backen"], "fakta"],
      ["Varför ligger krokodilen så stilla?", ["Djuren ska inte märka den", "Den sover alltid", "Vattnet är kallt", "Den har ont i benen"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-kakaon", title: "Choklad växer på träd", textType: "fact", topic: "natur",
    body: [
      "Visste du att choklad kommer från ett träd? Trädet heter kakaoträd. Det växer där det är varmt hela året, till exempel i Afrika.",
      "Direkt på stammen växer stora frukter. De är gula eller röda och ser ut som avlånga bollar. Inne i frukten finns vita bönor.",
      "Bönorna får ligga och jäsa några dagar. Sedan torkas de i solen. Till sist rostas de och mals till ett pulver.",
      "Av pulvret, socker och mjölk blir det choklad.",
    ],
    q: [
      ["Vad heter trädet?", ["Kakaoträd", "Äppelträd", "Palm", "Ek"], "fakta"],
      ["Var på trädet växer frukterna?", ["På stammen", "Under jorden", "Längst upp i toppen", "Ute på löven"], "fakta"],
      ["Vad finns inne i frukten?", ["Vita bönor", "Färdig choklad", "Mjölk", "Vatten"], "fakta"],
      ["Vad händer med bönorna efter att de torkat?", ["De rostas och mals", "De planteras", "De kastas", "De kokas i mjölk"], "fakta"],
      ["Varför växer inga kakaoträd ute i Sverige?", ["Det är för kallt här", "Svenskar äter inte choklad", "Det finns för lite jord", "Det är för mycket sol"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-taget", title: "Tåget på rälsen", textType: "fact", topic: "teknik",
    body: [
      "Ett tåg kör på räls. Rälsen är två långa skenor av stål. Tågets hjul passar precis på skenorna.",
      "Längst fram sitter loket. Det drar alla vagnar efter sig. De flesta tåg i Sverige drivs med el. Elen kommer från en ledning ovanför rälsen.",
      "Förr hade man ånglok. De eldade med kol eller ved och släppte ut mycket rök.",
      "Tåg kan frakta människor, men också timmer, bilar och mat.",
    ],
    q: [
      ["Vad är rälsen gjord av?", ["Stål", "Trä", "Plast", "Sten"], "fakta"],
      ["Vad heter delen längst fram som drar vagnarna?", ["Loket", "Rälsen", "Vagnen", "Hjulet"], "fakta"],
      ["Varifrån kommer elen till tåget?", ["En ledning ovanför rälsen", "Stora batterier i loket", "Solceller på taket", "En motor som går på bensin"], "fakta"],
      ["Vad eldade ångloken med?", ["Kol eller ved", "Olja och sand", "Papper", "Torrt gräs"], "fakta"],
      ["Vad kan tåg frakta?", ["Människor och timmer", "Bara människor", "Bara brev och paket", "Bara djur"], "fakta"],
    ],
  },
  {
    id: "lr-g2-pyramiderna", title: "Pyramiderna i Egypten", textType: "fact", topic: "historia",
    body: [
      "I Egypten står stora byggnader av sten. De kallas pyramider. De byggdes för mer än 4000 år sedan.",
      "Pyramiderna var gravar för kungar. En kung i Egypten kallades farao. När en farao dog fick han sin grav i pyramiden.",
      "Den största pyramiden är byggd av över två miljoner stenblock. Många människor arbetade i flera år för att bygga den.",
      "I dag reser turister från hela världen för att se pyramiderna.",
    ],
    q: [
      ["Vad är pyramiderna byggda av?", ["Sten", "Trä", "Sand", "Is"], "fakta"],
      ["När byggdes pyramiderna?", ["För mer än 4000 år sedan", "För ungefär hundra år sedan", "Förra året", "För tio år sedan"], "fakta"],
      ["Vad kallades en kung i Egypten?", ["Farao", "Viking", "Riddare", "Prins"], "fakta"],
      ["Vad var pyramiderna till för?", ["Gravar för kungar", "Hus för bönder", "Skolor för barn", "Förråd för säd och mat"], "fakta"],
      ["Vad visar det att många arbetade i flera år?", ["Att det var svårt att bygga", "Att pyramiden är liten", "Att det gick snabbt", "Att stenarna var lätta att lyfta"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-olympiska", title: "De olympiska spelen", textType: "fact", topic: "sport",
    body: [
      "De olympiska spelen är en stor tävling i idrott. Idrottare från nästan alla länder i världen är med.",
      "Spelen började för mycket länge sedan i Grekland. Där tävlade man i att springa, brottas och kasta.",
      "I dag finns sommarspel och vinterspel. Båda hålls vart fjärde år. På sommaren tävlar man till exempel i simning och friidrott. På vintern åker man skidor och skridskor.",
      "Den som vinner får en guldmedalj. Tvåan får silver och trean får brons.",
    ],
    q: [
      ["I vilket land började spelen?", ["Grekland", "Sverige", "Italien", "Egypten"], "fakta"],
      ["Hur ofta hålls spelen?", ["Vart fjärde år", "Varje år", "Vartannat år", "Var tionde år"], "fakta"],
      ["Vilken sport finns på vinterspelen?", ["Skidor", "Simning", "Friidrott", "Brottning"], "fakta"],
      ["Vad får den som kommer tvåa?", ["Silver", "Guld", "Brons", "En pokal"], "fakta"],
      ["Vad är en idrottare?", ["En som håller på med sport", "En som bygger hus", "En som lagar mat", "En som tittar på tävlingar"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-sjostjarnan", title: "Stjärnan i havet", textType: "fact", topic: "djur",
    body: [
      "Sjöstjärnan bor på havets botten. Den har oftast fem armar. Men den har inget huvud och ingen hjärna.",
      "Under armarna sitter hundratals små fötter. De ser ut som små rör. Med dem kryper sjöstjärnan sakta framåt.",
      "Sjöstjärnan äter gärna musslor. Den drar isär musslans skal med sina armar.",
      "Om en arm går av kan det växa ut en ny. Det tar lång tid, ibland ett helt år.",
    ],
    q: [
      ["Hur många armar har en sjöstjärna oftast?", ["Fem", "Tre", "Åtta", "Tio"], "fakta"],
      ["Vad sitter under armarna?", ["Små fötter", "Långa hår", "Små tänder", "Fjäll"], "fakta"],
      ["Vad äter sjöstjärnan gärna?", ["Musslor", "Tång", "Sand", "Små hajar"], "fakta"],
      ["Hur öppnar den en mussla?", ["Den drar isär skalet", "Den biter sönder skalet", "Den slår musslan mot en sten", "Den väntar tills musslan öppnar sig"], "fakta"],
      ["Varför är det bra att en arm kan växa ut igen?", ["Den kan leva vidare efter en skada", "Den blir snabbare då", "Den kan börja simma", "Den får fler ögon"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-island", title: "Ön med vulkaner", textType: "fact", topic: "geografi",
    body: [
      "Island är ett land långt ut i havet. Det ligger på en ö väster om Norge. Där finns många vulkaner.",
      "Ibland får en vulkan utbrott. Då sprutar het, smält sten upp ur marken. Den kallas lava.",
      "På Island finns också varma källor. Vattnet värms upp av hettan djupt nere i jorden. Islänningarna använder det varma vattnet för att värma sina hus.",
      "Det finns också stora glaciärer. En glaciär är ett tjockt lager is. Den ligger kvar året runt.",
    ],
    q: [
      ["Var ligger Island?", ["På en ö i havet", "Mitt i Sverige", "I en öken", "Uppe på ett berg"], "fakta"],
      ["Vad kallas den heta smälta stenen?", ["Lava", "Is", "Sand", "Lera"], "fakta"],
      ["Vad använder islänningarna det varma vattnet till?", ["Att värma sina hus", "Att tvätta bilar", "Att göra is", "Att vattna sina åkrar"], "fakta"],
      ["Vad är en glaciär?", ["Ett tjockt lager is", "En varm källa", "En liten vulkan", "Ett berg av lava och aska"], "ordforstaelse"],
      ["Vad är sant om Island?", ["Där finns både eld och is", "Där är det alltid varmt", "Där finns inga berg", "Där bor inga människor"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-vikingaskeppen", title: "Vikingarnas skepp", textType: "fact", topic: "historia",
    body: [
      "Vikingarna levde i Norden för mer än tusen år sedan. De var skickliga på att bygga båtar.",
      "Vikingaskeppen var långa och smala. De var byggda av trä, oftast ek. Skeppen hade ett stort segel. När det inte blåste rodde vikingarna med åror.",
      "Med skeppen reste vikingarna långt. De handlade med andra länder. Ibland plundrade de också.",
      "Längst fram på skeppet satt ibland ett huvud av trä. Det kunde se ut som en drake.",
    ],
    q: [
      ["När levde vikingarna?", ["För mer än tusen år sedan", "För hundra år sedan", "För ungefär femtio år sedan", "För tio år sedan"], "fakta"],
      ["Vad var skeppen byggda av?", ["Trä", "Sten", "Järn", "Plast"], "fakta"],
      ["Vad gjorde vikingarna när det inte blåste?", ["Rodde med åror", "Väntade på land", "Simmade bredvid", "Satte upp ett segel till"], "fakta"],
      ["Vad kunde huvudet längst fram se ut som?", ["En drake", "En häst", "En fisk", "En örn"], "fakta"],
      ["Vikingarna var skickliga. Vad betyder skicklig?", ["Duktig", "Lat", "Snäll", "Rädd"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-somnen", title: "Därför sover vi", textType: "fact", topic: "vetenskap",
    body: [
      "Alla människor behöver sova. Barn i din ålder behöver sova ungefär tio timmar varje natt.",
      "När du sover vilar kroppen. Men hjärnan arbetar ändå. Den sorterar allt du har lärt dig under dagen.",
      "När man sover drömmer man ibland. De flesta drömmar glömmer man när man vaknar.",
      "Om man sover för lite blir man trött och lättare sur. Det blir också svårare att lära sig nya saker i skolan.",
    ],
    q: [
      ["Hur länge behöver barn sova varje natt?", ["Ungefär tio timmar", "Fyra timmar", "Två timmar", "Tjugo timmar"], "fakta"],
      ["Vad gör hjärnan när du sover?", ["Sorterar det du lärt dig", "Den stänger av sig helt och hållet", "Blir mindre", "Växer fort"], "fakta"],
      ["Vad händer med de flesta drömmar?", ["Man glömmer dem", "Man skriver ner dem", "De blir sanna", "Man drömmer dem igen"], "fakta"],
      ["Hur blir man om man sover för lite?", ["Trött och sur", "Pigg och glad", "Stark och snabb", "Hungrig och varm"], "fakta"],
      ["Varför är det bra att sova innan ett prov?", ["Det blir lättare att lära sig", "Man får ledigt från skolan", "Då behöver man inte plugga mer", "Proven blir kortare"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-vildsvinet", title: "Grisen i skogen", textType: "fact", topic: "djur",
    body: [
      "Vildsvinet är en vild släkting till grisen. Det har grov, mörk päls och en lång nos. Hanen har vassa betar som sticker ut ur munnen.",
      "Vildsvin lever i grupper i skogen. De äter nästan allt, till exempel rötter, nötter, maskar och små djur.",
      "Med nosen bökar de i marken efter mat. Ibland bökar de upp en hel gräsmatta på en enda natt.",
      "Ungarna kallas kultingar. De är randiga i gult och brunt. Då syns de sämre bland löven.",
    ],
    q: [
      ["Vilket djur är vildsvinet släkt med?", ["Grisen", "Hunden", "Björnen", "Hästen"], "fakta"],
      ["Vad har hanen som sticker ut ur munnen?", ["Vassa betar", "En lång tunga", "Ett horn", "Morrhår"], "fakta"],
      ["Vad gör vildsvinen med nosen?", ["Bökar i marken", "Luktar på blommor", "Dricker vatten", "Bygger bon"], "fakta"],
      ["Vad kallas ungarna?", ["Kultingar", "Kalvar", "Valpar", "Kycklingar"], "fakta"],
      ["Varför blir många som har trädgård arga på vildsvin?", ["Vildsvinen bökar upp gräset", "Vildsvinen äter deras katter", "Vildsvinen låter högt på dagen", "Vildsvinen badar i poolen"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-askan", title: "När det åskar", textType: "fact", topic: "natur",
    body: [
      "Åska kommer oftast på sommaren när det är varmt. Då bildas stora, mörka moln högt upp på himlen.",
      "Inne i molnen bildas elektricitet. Till slut blir det en stark blixt. Blixten är mycket varm och lyser starkt.",
      "Blixten värmer luften så snabbt att det smäller. Det är det vi kallar åskknall eller muller.",
      "Ljuset kommer fram före ljudet. Därför ser man blixten först och hör mullret efteråt. Om det åskar ska man gå inomhus.",
    ],
    q: [
      ["När kommer åska oftast?", ["På sommaren", "På vintern", "På hösten", "På våren"], "fakta"],
      ["Varför smäller det när det åskar?", ["Blixten värmer luften snabbt", "Två stora moln krockar med varandra", "Det regnar hårt", "Vinden blåser"], "fakta"],
      ["Vad märker man först?", ["Blixten", "Mullret", "Regnet", "Vinden"], "fakta"],
      ["Mullret hörs efteråt. Vad är muller?", ["Ett dovt ljud", "Ett starkt ljus", "Ett kraftigt regn", "Ett mörkt moln"], "ordforstaelse"],
      ["Vad ska man göra om det åskar?", ["Gå inomhus", "Klättra i ett träd", "Bada i sjön", "Ställa sig på en kulle"], "fakta"],
    ],
  },
  {
    id: "lr-g2-kylskapet", title: "Kallt i kylskåpet", textType: "fact", topic: "teknik",
    body: [
      "I ett kylskåp är det kallt, ungefär fem grader. Kylan gör att maten håller sig fräsch längre. Bakterier växer mycket långsammare när det är kallt.",
      "Kylskåpet tar värmen inifrån och släpper ut den på baksidan. Därför kan det kännas varmt bakom kylskåpet.",
      "I frysen är det ännu kallare, ungefär minus arton grader. Där kan maten hålla sig i flera månader.",
      "Förr hade man inget kylskåp. Då förvarade man maten i en kall källare.",
    ],
    q: [
      ["Hur kallt är det ungefär i ett kylskåp?", ["Fem grader", "Tjugo grader", "Hundra grader", "Femtio grader"], "fakta"],
      ["Varför håller sig maten längre i kylan?", ["Bakterier växer långsammare", "Maten blir till is med en gång", "Ljuset är släckt", "Maten blir hård"], "fakta"],
      ["Var släpper kylskåpet ut värmen?", ["På baksidan", "I frysen", "Inne i maten", "Genom dörren"], "fakta"],
      ["Hur länge kan maten hålla sig i frysen?", ["I flera månader", "En timme", "En dag", "Bara en enda kväll"], "fakta"],
      ["Var förvarade man maten förr?", ["I en kall källare", "Uppe på vinden", "I köksskåpet", "Bakom den varma spisen"], "fakta"],
    ],
  },
  {
    id: "lr-g2-traskorna", title: "Skor av trä", textType: "fact", topic: "historia",
    body: [
      "För länge sedan hade många barn i Sverige träskor. Skorna var gjorda av ett enda stycke trä. Ibland hade de en ovandel av läder.",
      "Ofta var det skomakaren eller pappan i familjen som gjorde skorna. Han högg och karvade i träet med kniv.",
      "Träskor var bra på gården. De höll fötterna torra i lera och smuts. Och de gick nästan aldrig sönder.",
      "Men de var hårda och tunga. När barnen sprang på stengolvet klapprade det högt.",
    ],
    q: [
      ["Vad var träskorna gjorda av?", ["Ett stycke trä", "Gummi och plast", "Mjukt tyg", "Tjockt papper från affären"], "fakta"],
      ["Vem gjorde ofta skorna?", ["Skomakaren eller pappan", "Barnen själva", "En fabrik i en stad långt bort", "Läraren"], "fakta"],
      ["Varför var träskor bra på gården?", ["Fötterna höll sig torra", "De var lätta", "De var mjuka", "De gick lätt att vika ihop"], "fakta"],
      ["Vad hördes när barnen sprang på stengolvet?", ["Ett högt klapper", "Ingenting", "Musik", "Ett tjut"], "fakta"],
      ["Varför har barn i dag nog andra skor?", ["Träskor är hårda och tunga", "Det finns inga träd kvar", "Träskor är förbjudna", "Barn springer aldrig"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-atervinning", title: "Burken blir en ny burk", textType: "fact", topic: "vardag",
    body: [
      "När du har druckit upp en burk är den inte skräp. Den kan bli en ny burk! Det kallas återvinning.",
      "Burkar är gjorda av aluminium. I fabriken smälts de gamla burkarna. Av metallen gör man nya burkar.",
      "Även papper, glas och plast kan återvinnas. Därför sorterar vi soporna i olika kärl.",
      "Återvinning är bra för naturen. Man behöver inte hämta lika mycket nytt material ur jorden. Det sparar också energi.",
    ],
    q: [
      ["Vad kallas det när en gammal burk blir en ny?", ["Återvinning", "Sophämtning", "Städning", "Tillverkning"], "fakta"],
      ["Vad är burkar gjorda av?", ["Aluminium", "Glas", "Papper", "Trä"], "fakta"],
      ["Vad händer med burkarna i fabriken?", ["De smälts", "De målas", "De tvättas", "De slängs"], "fakta"],
      ["Vad mer kan återvinnas?", ["Papper, glas och plast", "Bara gamla burkar och flaskor", "Ingenting annat", "Bara mat"], "fakta"],
      ["Varför sorterar vi soporna?", ["Så att de kan återvinnas", "För att det är roligt", "För att soporna ska lukta mindre", "För att kärlen är fina"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-danmark", title: "Grannlandet Danmark", textType: "fact", topic: "geografi",
    body: [
      "Danmark är Sveriges granne i söder. Mellan länderna ligger Öresund. Över det går en lång bro.",
      "Danmark är ett platt land. Där finns inga höga berg. Den högsta platsen är bara ungefär 170 meter hög.",
      "Landet består av en stor halvö och många öar. Man är aldrig långt från havet.",
      "I Danmark cyklar många till jobbet och skolan. Huvudstaden heter Köpenhamn. Legoklossarna uppfanns också i Danmark.",
    ],
    q: [
      ["Var ligger Danmark?", ["Söder om Sverige", "Norr om Sverige", "Mitt i Sverige", "Långt bort i Asien"], "fakta"],
      ["Hur ser landskapet ut?", ["Platt utan höga berg", "Fullt av höga berg", "Bara öken", "Bara skog och snö"], "fakta"],
      ["Vad heter huvudstaden?", ["Köpenhamn", "Oslo", "Stockholm", "Helsingfors"], "fakta"],
      ["Vad uppfanns i Danmark?", ["Legoklossar", "Cykeln", "Bilen", "Telefonen"], "fakta"],
      ["Varför är det lätt att cykla i Danmark?", ["Landet är platt", "Där finns många bilar", "Alla har nya cyklar", "Det är alltid sol"], "mellan_raderna"],
    ],
  },
];
