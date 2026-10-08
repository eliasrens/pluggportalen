// ============================================================================
// Läsresan – källtexter för nivå 3, fact (issue #523, epic #516)
// ----------------------------------------------------------------------------
// 15 faktatexter, 100–140 ord, 6 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g3-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-3.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g3-raven", title: "Räven i snön", textType: "fact", topic: "djur",
    body: [
      "Räven är ett rovdjur som finns i nästan hela Sverige. Den har röd päls, spetsiga öron och en vit spets på svansen. Svansen är lång och yvig. När räven sover lindar den svansen runt nosen. Svansen blir som en filt.",
      "Räven bor i en lya. Det är en håla under marken. På våren föds ungarna där. De kallas valpar.",
      "Räven äter mest möss och sorkar. Den äter också bär, insekter och fåglar. Den har mycket bra hörsel. På vintern kan den höra en mus som springer under snön.",
      "Då står räven helt stilla och lyssnar. Sedan hoppar den högt upp i luften. Den dyker rakt ner i snön med nosen först. Ofta får den tag i musen.",
    ],
    q: [
      ["Vilken färg har spetsen på rävens svans?", ["Vit", "Svart", "Röd", "Grå"], "fakta"],
      ["Vad gör räven med svansen när den sover?", ["Lindar den runt nosen", "Gömmer den under snön", "Lägger den på ryggen", "Viftar med den"], "fakta"],
      ["Vad är en lya?", ["En håla under marken", "Ett bo uppe i ett träd", "En sorts mus", "En stor sten"], "ordforstaelse"],
      ["Vad kallas rävens ungar?", ["Valpar", "Kalvar", "Kycklingar", "Lamm"], "fakta"],
      ["Hur vet räven att det finns en mus under snön?", ["Den hör musen", "Den ser musens svans", "Den hittar musens bo", "Den känner marken skaka"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur räven lever och jagar", "Hur man fångar en räv", "Varför möss bor i snö", "Hur rävar leker med hundar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-delfinen", title: "Delfinen andas luft", textType: "fact", topic: "djur",
    body: [
      "Delfinen bor i havet och ser ut lite som en fisk. Men delfinen är inte en fisk. Den är ett däggdjur, precis som vi. Därför måste den andas luft.",
      "Uppe på huvudet har delfinen ett andningshål. Med jämna mellanrum simmar den upp till ytan. Där blåser den ut gammal luft och andas in ny.",
      "Delfinungen föds under vattnet. Mamman knuffar genast upp den till ytan. Där tar ungen sitt första andetag. Sedan dricker ungen mjölk av sin mamma.",
      "Delfiner lever i grupper. De pratar med varandra med visslingar och klickande ljud.",
      "Hur sover en delfin utan att drunkna? Den låter halva hjärnan vila åt gången. Den andra halvan håller koll på andningen.",
    ],
    q: [
      ["Vad är delfinen för slags djur?", ["Ett däggdjur", "En fisk", "En fågel", "Ett kräldjur"], "fakta"],
      ["Var sitter andningshålet?", ["Uppe på huvudet", "Under magen", "Bakom ögat", "Längst bak på stjärtfenan"], "fakta"],
      ["Vad gör mamman när ungen föds?", ["Knuffar upp den till ytan", "Gömmer den bland stenar på botten", "Simmar iväg", "Ger den en fisk"], "fakta"],
      ["Hur pratar delfiner med varandra?", ["Med visslingar och klick", "Med olika färger", "Genom att vifta med fenorna", "De pratar inte alls"], "fakta"],
      ["Med jämna mellanrum betyder …", ["om och om igen, med pauser", "bara en enda gång", "aldrig någonsin", "bara på natten"], "ordforstaelse"],
      ["Varför vilar bara halva hjärnan åt gången?", ["Så att delfinen kan andas", "Så att delfinen kan drömma", "Så att delfinen växer", "Så att delfinen håller värmen"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-snoharen", title: "Haren som byter päls", textType: "fact", topic: "djur",
    body: [
      "Skogsharen lever i skogar och på fjällen. På sommaren har den gråbrun päls. Då syns den nästan inte bland stenar och ris.",
      "På hösten händer något spännande. Haren byter päls. Den bruna pälsen faller av. En vit päls växer ut i stället. När snön kommer är haren nästan helt vit. Bara spetsarna på öronen är svarta. Därför är den svår att upptäcka i snön.",
      "Skogsharen har stora bakfötter med mycket päls under. De fungerar nästan som snöskor. Då sjunker haren inte ner i snön.",
      "På sommaren äter haren gräs och örter. På vintern gnager den på kvistar och bark.",
      "Om en räv kommer springer haren mycket fort. Den gör tvära skutt åt sidan.",
    ],
    q: [
      ["Vilken färg har skogsharen på sommaren?", ["Gråbrun", "Vit", "Svart", "Röd"], "fakta"],
      ["Vad är fortfarande svart på vintern?", ["Spetsarna på öronen", "Svansen", "Nosen", "Tassarna på bakbenen"], "fakta"],
      ["Varför är det bra för haren att vara vit på vintern?", ["Den syns inte i snön", "Den blir varmare", "Den springer fortare", "Den hittar mer mat"], "mellan_raderna"],
      ["Bakfötterna fungerar som snöskor. Vad betyder det?", ["Haren sjunker inte ner", "Haren kan simma", "Haren halkar på isen", "Haren fryser om tassarna"], "ordforstaelse"],
      ["Vad äter haren på vintern?", ["Kvistar och bark", "Gräs och örter", "Möss och fåglar", "Bär, svamp och blommor"], "fakta"],
      ["Hur kommer haren undan räven?", ["Den springer fort", "Den klättrar upp i ett träd", "Den gräver ner sig", "Den simmar ut i sjön"], "fakta"],
    ],
  },
  {
    id: "lr-g3-gravlingen", title: "Grävlingen i grytet", textType: "fact", topic: "djur",
    body: [
      "Grävlingen har ett randigt huvud med svarta och vita ränder. Kroppen är grå och tjock. Benen är korta. Med sina långa klor är den mycket bra på att gräva.",
      "Grävlingen bor i ett gryt under marken. Ett gryt har många gångar och flera ingångar. Där inne finns rum. Grävlingen sover på en bädd av gräs och mossa. Samma gryt kan användas av grävlingar i hundratals år.",
      "På dagen sover grävlingen. Först när det blir mörkt kommer den ut för att leta mat. Den äter mest daggmaskar. Ibland äter den också rötter, insekter och bär.",
      "På vintern finns det lite mat. Därför sover grävlingen mycket. Den vilar i grytet. Då lever den på fettet som den har ätit på sig under hösten.",
    ],
    q: [
      ["Hur ser grävlingens huvud ut?", ["Svartvitrandigt", "Helt brunt", "Rött med vita prickar", "Helt grått"], "fakta"],
      ["Vad använder grävlingen klorna till?", ["Att gräva", "Att klättra", "Att simma", "Att fånga fisk"], "fakta"],
      ["Vad är ett gryt?", ["Grävlingens bo under marken", "En sorts mask", "En stig i skogen", "En hög med löv"], "ordforstaelse"],
      ["När letar grävlingen mat?", ["När det blir mörkt", "Tidigt på morgonen", "Mitt på dagen", "Bara när det regnar"], "fakta"],
      ["Vad äter grävlingen mest?", ["Daggmaskar", "Möss", "Fisk", "Svamp"], "fakta"],
      ["Varför äter grävlingen mycket på hösten?", ["Fettet ska räcka på vintern", "Det finns ingen mat på våren", "Den ska springa långt", "Den ska gräva ett nytt gryt"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-bjorken", title: "Björken med vit bark", textType: "fact", topic: "natur",
    body: [
      "Björken är ett av de vanligaste träden i Sverige. Den är lätt att känna igen på sin vita bark med svarta fläckar. Barken kallas näver. Förr gjorde man korgar och skor av näver. Den brinner också bra. Därför används den ofta när man tänder en brasa.",
      "På våren får björken små gröna löv. Då säger man att björken har musöron. Samtidigt hänger långa hängen från grenarna. Det är björkens blommor. Vinden sprider deras gula pollen.",
      "Många människor är allergiska mot björkens pollen. De nyser och kliar i ögonen när björken blommar.",
      "Tidigt på våren stiger saven i trädet. Sav är en söt vätska som går från rötterna upp till grenarna.",
    ],
    q: [
      ["Vad kallas björkens bark?", ["Näver", "Kåda", "Sav", "Ved"], "fakta"],
      ["Vad gjorde man av näver förr?", ["Korgar och skor", "Fönster och dörrar", "Tallrikar och glas", "Spikar och sågar"], "fakta"],
      ["Björken har musöron. Vad betyder det?", ["Den har små nya löv", "Den har stora gamla löv", "Det bor möss i den", "Den har svarta fläckar"], "ordforstaelse"],
      ["Vad är björkens hängen?", ["Björkens blommor", "Björkens frön", "Björkens rötter", "Gamla torra löv från hösten"], "fakta"],
      ["Vad är sav?", ["En söt vätska i trädet", "En sorts bark", "Ett gult pulver", "En liten svamp"], "fakta"],
      ["Varför nyser en del människor när björken blommar?", ["De är allergiska mot pollen", "De har badat i sjön", "Barken luktar starkt på våren", "Saven är kall"], "fakta"],
    ],
  },
  {
    id: "lr-g3-istapparna", title: "Istapparna", textType: "fact", topic: "natur",
    body: [
      "På vintern hänger det ibland långa istappar från taken. Men hur blir de till?",
      "En solig vinterdag värmer solen snön på taket. Snön börjar smälta, och vatten rinner ner mot takkanten. Där är det kallare, särskilt i skuggan. Därför fryser droppen innan den hinner falla. Sedan rinner nästa droppe ner längs den första. Den fryser också. Så växer istappen, droppe för droppe.",
      "Istappar blir oftast störst när det är varmt på dagen och kallt på natten. En del istappar blir över en meter långa.",
      "Istappar är vackra, men de kan vara farliga. När det blir varmare kan de lossna och falla ner. Därför ska man aldrig gå eller leka precis under en istapp. Ibland spärrar man av trottoaren med band.",
    ],
    q: [
      ["Vad får snön på taket att smälta?", ["Solen", "Vinden", "Regnet", "Lamporna"], "fakta"],
      ["Varför fryser droppen vid takkanten?", ["Det är kallare där", "Det blåser mycket där", "Droppen är för stor", "Taket är av plåt"], "fakta"],
      ["Istappen växer droppe för droppe. Vad betyder det?", ["Lite i taget", "Mycket snabbt", "Bara på natten", "Helt plötsligt"], "ordforstaelse"],
      ["När blir istapparna oftast störst?", ["Varma dagar och kalla nätter", "När det snöar hela dagen", "När det är kallt dygnet runt", "När det regnar mycket"], "fakta"],
      ["Hur långa kan istappar bli?", ["Över en meter", "Tio meter", "En centimeter", "Lika långa som ett hus"], "fakta"],
      ["Varför ska man inte gå under en istapp?", ["Den kan lossna och falla", "Den kan smälta på en", "Den gör det halt", "Den är för kall att röra vid"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-stenarna", title: "Stenarna som blev runda", textType: "fact", topic: "natur",
    body: [
      "På många stränder ligger stenar som är alldeles runda och släta. Men från början var de vassa och kantiga. Hur har de blivit så fina?",
      "Det är vattnet som har gjort jobbet. Vågorna rullar stenarna fram och tillbaka mot varandra. De slår mot sand och grus. Varje gång nöts lite av kanterna bort. Det går mycket långsamt. Det kan ta tusentals år innan en sten blir rund.",
      "Samma sak händer i bäckar och älvar. Där är det strömmen som rullar stenarna med sig nedåt. Därför ligger det ofta släta stenar på botten av en bäck.",
      "En sten som rullas länge blir mindre och rundare. Till slut blir den till sand. Hittar du en slät sten? Tänk då på hur gammal den är.",
    ],
    q: [
      ["Hur var stenarna från början?", ["Vassa och kantiga", "Runda och släta", "Mjuka och lätta som bomull", "Små och gula"], "fakta"],
      ["Vad gör stenarna runda på stranden?", ["Vågorna", "Solen", "Fåglarna", "Människorna"], "fakta"],
      ["Kanterna nöts bort. Vad betyder nöts?", ["Slits bort lite i taget", "Växer till", "Blir blöta", "Målas om"], "ordforstaelse"],
      ["Hur lång tid kan det ta innan en sten blir rund?", ["Tusentals år", "Några veckor", "Ett år", "En sommar"], "fakta"],
      ["Vad rullar stenarna i en bäck?", ["Strömmen", "Vinden", "Isen", "Fiskarna"], "fakta"],
      ["Vad blir en sten till sist om den rullas väldigt länge?", ["Sand", "Ett berg", "Lera", "Is"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-rymddrakten", title: "Rymddräkten", textType: "fact", topic: "rymden",
    body: [
      "När en astronaut ska gå ut från rymdstationen behövs en rymddräkt. Utan den skulle astronauten inte överleva en enda minut.",
      "I rymden finns ingen luft att andas. Därför har dräkten en stor ryggsäck med syrgas. Där finns också en fläkt som tar bort luften man andas ut.",
      "I rymden är det också väldigt kallt eller väldigt varmt. I skuggan kan det bli över hundra grader kallt. I solen kan det bli över hundra grader varmt. Dräkten har därför många lager som skyddar.",
      "Hjälmen har ett guldfärgat visir. Det skyddar ögonen mot det starka solljuset.",
      "En rymddräkt är tung. Den väger mer än en vuxen människa. Det tar nästan en timme att klä på sig den.",
    ],
    q: [
      ["Vad finns i dräktens ryggsäck?", ["Syrgas", "Smörgåsar", "En sovsäck", "Extra skor"], "fakta"],
      ["Hur kallt kan det bli i skuggan?", ["Över hundra grader kallt", "Tio grader kallt", "Noll grader", "Lika kallt som i en frys"], "fakta"],
      ["Varför har dräkten många lager?", ["De skyddar mot kyla och hetta", "De gör dräkten snyggare", "De gör dräkten lättare", "De gör dräkten mjukare att sitta i"], "fakta"],
      ["Vad är visiret till för?", ["Att skydda ögonen", "Att andas genom", "Att prata i", "Att hålla hjälmen fast"], "fakta"],
      ["Överleva betyder …", ["klara sig och leva vidare", "bli mycket trött", "somna djupt", "flyga iväg"], "ordforstaelse"],
      ["Varför tar det lång tid att klä på sig dräkten?", ["Den är tung och har många delar", "Astronauterna är långsamma", "De måste äta först", "Dräkten är för liten"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-trafikljuset", title: "Rött, gult och grönt", textType: "fact", topic: "teknik",
    body: [
      "I korsningar där många bilar kör finns ofta trafikljus. De bestämmer vem som får köra och vem som ska vänta.",
      "Rött betyder stopp. Grönt betyder att man får köra. Gult betyder att ljuset snart byter. Därför ska bilarna börja stanna när det lyser gult.",
      "Många trafikljus vet om det står bilar och väntar. Under asfalten finns en slinga med elektricitet. När en bil stannar ovanpå slingan känner trafikljuset av den. Då byter det till grönt lite snabbare.",
      "För den som går finns en egen knapp. När man trycker på den börjar det ofta ticka. Tickandet blir snabbare när det slår om till grönt. Det hjälper personer som inte kan se.",
      "De första trafikljusen i Sverige kom för ungefär hundra år sedan.",
    ],
    q: [
      ["Vad betyder gult ljus?", ["Att ljuset snart byter", "Att man ska köra fort", "Att man får gå", "Att vägen är stängd för alla"], "fakta"],
      ["Var finns slingan?", ["Under asfalten", "Uppe på stolpen", "Inne i bilen", "I lampan"], "fakta"],
      ["Vad händer när en bil stannar på slingan?", ["Det blir grönt snabbare", "Lampan slocknar", "Bilen startar igen", "Det börjar ticka i knappen"], "fakta"],
      ["Vem hjälper tickandet?", ["Den som inte kan se", "Den som kör bil", "Den som cyklar fort", "Den som har bråttom"], "fakta"],
      ["Vad är en korsning?", ["Där två vägar möts", "Ett slags bil", "En lång bro", "En parkering vid affären"], "ordforstaelse"],
      ["Varför behövs trafikljus?", ["Så att alla turas om", "Så att gatan blir vackrare", "Så att det blir ljust på natten", "Så att bilarna kör fortare"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-blixtlaset", title: "Blixtlåset", textType: "fact", topic: "teknik",
    body: [
      "Blixtlås finns på jackor, väskor och byxor. Det är ett smart sätt att stänga något snabbt.",
      "Ett blixtlås har två rader med små tänder. Mellan raderna sitter en liten del som kallas löparen. När du drar löparen uppåt pressas tänderna ihop. De hakar i varandra som små krokar. När du drar neråt skiljs de åt igen.",
      "Förr hade man knappar eller snören på kläderna. Det tog lång tid att knäppa och knyta.",
      "De första blixtlåsen kom i början av 1900-talet. Från början satt de mest på stövlar och väskor. Sedan började man sy in dem i kläder också. Barn kunde nu klä på sig själva mycket snabbare.",
      "I dag görs miljontals blixtlås varje dag.",
    ],
    q: [
      ["Var kan blixtlås sitta?", ["På jackor och väskor", "På tallrikar och glas", "På bilar och cyklar", "På fönster och dörrar"], "fakta"],
      ["Vad kallas delen man drar i?", ["Löparen", "Tanden", "Kroken", "Knappen"], "fakta"],
      ["Vad händer när man drar löparen uppåt?", ["Tänderna hakar i varandra", "Tänderna ramlar av", "Jackan blir längre", "Blixtlåset går sönder"], "fakta"],
      ["Vad hade man på kläderna innan blixtlåset fanns?", ["Knappar och snören", "Tejp", "Små magneter i tyget", "Lim"], "fakta"],
      ["Tänderna skiljs åt. Vad betyder det?", ["De går isär", "De fastnar", "De blir större", "De blir varma"], "ordforstaelse"],
      ["Varför blev blixtlåset så populärt?", ["Det går fort att stänga", "Det låter roligt", "Det är alltid guldfärgat", "Det behöver aldrig tvättas"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-tvatt-forr", title: "Tvättdagen förr", textType: "fact", topic: "historia",
    body: [
      "För hundra år sedan fanns det inga tvättmaskiner. Då var tvätten ett tungt arbete som kunde ta flera dagar.",
      "Först måste man bära vatten från brunnen. Vattnet värmdes i en stor gryta över elden. Sedan fick kläderna ligga i blöt med såpa.",
      "Smutsen gnuggades bort på en tvättbräda. Det är en bräda med räfflor av trä eller metall. Arbetet var hårt för både händerna och ryggen.",
      "Efter det skulle kläderna sköljas. Många bar ner tvätten till sjön eller ån. Där sköljdes den, även när det var kallt.",
      "Till sist hängdes tvätten på en lina ute. På vintern kunde den frysa till stela plattor. Då fick man ta in den och torka den inomhus.",
      "Därför tvättade man inte så ofta förr.",
    ],
    q: [
      ["Vad fanns inte för hundra år sedan?", ["Tvättmaskiner", "Kläder", "Såpa", "Sjöar"], "fakta"],
      ["Var hämtade man vattnet?", ["I brunnen", "I kranen", "I affären", "Hos grannen"], "fakta"],
      ["Vad är en tvättbräda?", ["En bräda med räfflor", "En stor gryta", "En lina där tvätten hängs", "En sorts såpa"], "ordforstaelse"],
      ["Var sköljde många tvätten?", ["I sjön eller ån", "I badkaret", "I diskhon i köket", "I regnet"], "fakta"],
      ["Vad kunde hända med tvätten ute på vintern?", ["Den frös till stela plattor", "Den blåste bort", "Den blev vitare", "Den torkade på några minuter"], "fakta"],
      ["Varför tvättade man inte så ofta förr?", ["Det var tungt och tog lång tid", "Kläderna blev aldrig smutsiga", "Det var förbjudet", "Såpan var giftig"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-brevduvan", title: "Brevduvan", textType: "fact", topic: "historia",
    body: [
      "Duvor har en fantastisk förmåga. De hittar hem, även om man släpper dem långt bort. Ingen vet exakt hur. Forskare tror att de använder solen och känner igen landskapet.",
      "Förr använde människor detta för att skicka meddelanden. Man skrev ett kort brev på ett tunt papper. Sedan rullade man ihop det. Det sattes i en liten hylsa på duvans ben. När duvan flög hem kunde någon där läsa brevet.",
      "Brevduvor användes i tusentals år. De bar nyheter och viktiga beslut. I krig räddade duvor många liv genom att flyga med meddelanden.",
      "En brevduva kan flyga omkring 80 kilometer i timmen. I dag tävlar många med sina duvor som en hobby.",
    ],
    q: [
      ["Vad är duvor bra på?", ["Att hitta hem", "Att simma", "Att prata", "Att bygga bon av sten"], "fakta"],
      ["Var satt brevet?", ["I en hylsa på benet", "Under vingen", "I näbben", "I ett snöre runt halsen"], "fakta"],
      ["Hur snabbt kan en brevduva flyga?", ["80 kilometer i timmen", "5 kilometer i timmen", "500 kilometer i timmen", "20 kilometer i timmen"], "fakta"],
      ["Duvor har en fantastisk förmåga. Vad är en förmåga?", ["Något man kan göra", "Något man äter", "En sorts fjäder", "En lång resa över havet"], "ordforstaelse"],
      ["Hur räddade duvor liv i krig?", ["De flög med meddelanden", "De skrämde fienden", "De bar mat", "De vaktade soldaternas läger"], "fakta"],
      ["Vad gör många med brevduvor i dag?", ["Tävlar med dem", "Skickar alla brev med dem", "Lär dem prata", "Bygger bon åt dem i skogen"], "fakta"],
    ],
  },
  {
    id: "lr-g3-fjordarna", title: "Norges fjordar", textType: "fact", topic: "geografi",
    body: [
      "Norge är Sveriges granne i väster. Längs Norges kust finns hundratals fjordar. En fjord är en lång och smal havsvik. Den går långt in i landet. På båda sidor reser sig branta berg. Ibland forsar vattenfall rakt ner i fjorden.",
      "Hur blev fjordarna till? För länge sedan var landet täckt av is. Isen var flera kilometer tjock. Den gled sakta mot havet och grävde djupa dalar. När isen smälte steg havet. Sedan fylldes dalarna med havsvatten.",
      "Fjordarna kan vara mycket djupa. Den längsta fjorden i Norge är över tjugo mil lång.",
      "Många turister åker båt på fjordarna. De vill se den vackra naturen. På sluttningarna ligger små gårdar. Där har människor bott i hundratals år.",
    ],
    q: [
      ["Var ligger Norge?", ["Väster om Sverige", "Öster om Sverige", "Söder om Tyskland", "Mitt i Afrika"], "fakta"],
      ["Vad är en fjord?", ["En lång och smal havsvik", "Ett högt berg", "En stor sjö", "Ett slags båt"], "ordforstaelse"],
      ["Vad grävde ut dalarna?", ["Isen", "Floderna", "Människorna", "Vinden"], "fakta"],
      ["Hur kom havsvattnet in i dalarna?", ["Havet steg när isen smälte", "Det regnade i hundra år", "Människor grävde kanaler", "Floderna svämmade över på våren"], "fakta"],
      ["Hur lång är Norges längsta fjord?", ["Över tjugo mil", "Två mil", "Hundra mil", "En kilometer"], "fakta"],
      ["Varför åker turister båt på fjordarna?", ["För att se naturen", "För att handla billigt", "För att åka skidor", "För att bada i varmt vatten"], "fakta"],
    ],
  },
  {
    id: "lr-g3-jasten", title: "Varför degen växer", textType: "fact", topic: "vetenskap",
    body: [
      "När man bakar bullar eller bröd brukar man använda jäst. Jäst ser ut som en liten kaka av ljusbrun lera. Men den består av miljontals små levande svampar. De är så små att man inte kan se dem.",
      "Jästsvamparna äter socker. När de äter bildas en gas. Gasen gör små bubblor i degen. Därför blir degen större och luftigare. Man säger att degen jäser.",
      "Jästen trivs bäst när det är ljummet. Om vattnet är för kallt blir jästen långsam. Om vattnet är för varmt dör den. Därför känner man på vattnet med fingret först.",
      "När brödet sedan gräddas i ugnen dör jästen. Men bubblorna finns kvar. Det är därför ett bröd har små hål inuti.",
    ],
    q: [
      ["Vad består jäst av?", ["Små levande svampar", "Mjöl och vatten", "Socker och salt", "Små korn av torkat mjöl"], "fakta"],
      ["Vad äter jästsvamparna?", ["Socker", "Smör", "Mjölk", "Salt"], "fakta"],
      ["Varför blir degen större?", ["Gasen gör bubblor i degen", "Mjölet sväller i vattnet", "Man rör för länge", "Degen blir varm i ugnen"], "fakta"],
      ["Jästen trivs när det är ljummet. Vad betyder ljummet?", ["Lagom varmt", "Iskallt", "Kokande hett", "Torrt"], "ordforstaelse"],
      ["Vad händer om vattnet är för varmt?", ["Jästen dör", "Jästen växer fort", "Degen blir söt", "Ingenting"], "fakta"],
      ["Varför har brödet små hål inuti?", ["Bubblorna finns kvar", "Man sticker hål med en gaffel", "Ugnen blåser in luft", "Mjölet har hål"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-svetten", title: "Därför svettas vi", textType: "fact", topic: "vetenskap",
    body: [
      "Springer du fort en varm sommardag? Då börjar du kanske svettas. Det är kroppens eget sätt att svalka sig.",
      "I huden finns miljontals små körtlar. De kallas svettkörtlar. Blir kroppen för varm, pressar de ut svett. Svetten kommer ut genom små hål i huden. Svett är mest vatten med lite salt i. Därför smakar svett salt.",
      "Sedan avdunstar svetten. Det betyder att vattnet försvinner upp i luften. När det händer tar det med sig värme från huden. Då blir du svalare.",
      "Om man svettas mycket förlorar kroppen vatten. Därför ska man dricka mycket vatten när man tränar.",
      "Hundar svettas nästan inte alls. I stället flämtar de med tungan ute.",
    ],
    q: [
      ["Varför svettas vi?", ["För att svalka kroppen", "För att bli renare", "För att bli starkare", "För att få mer salt"], "fakta"],
      ["Var finns svettkörtlarna?", ["I huden", "I magen", "I hjärtat", "I håret"], "fakta"],
      ["Vad består svett mest av?", ["Vatten", "Olja", "Socker", "Blod"], "fakta"],
      ["Svetten avdunstar. Vad betyder det?", ["Den försvinner upp i luften", "Den fryser till is", "Den rinner ner på marken", "Den blir till salt"], "ordforstaelse"],
      ["Varför ska man dricka när man tränar?", ["Kroppen förlorar vatten", "Man blir hungrig", "Man blir sömnig", "Musklerna blir kalla och stela"], "fakta"],
      ["Hur svalkar sig hundar?", ["De flämtar med tungan ute", "De svettas mycket", "De rullar sig i den kalla sanden", "De sover mer"], "fakta"],
    ],
  },
];
