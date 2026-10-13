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
    id: "lr-g2-myrstacken", title: "Myrornas stack", textType: "fact", topic: "djur",
    body: [
      "En myrstack kan se ut som en hög med barr. Men den är ett hem för väldigt många myror.",
      "Inne i stacken finns många gångar och rum. Där bor en eller flera drottningar. De lägger äggen.",
      "De andra myrorna kallas arbetare. De hämtar mat, bär barr och tar hand om äggen.",
      "Myror är små, men de är starka. En myra kan bära saker som är tyngre än den själv. Myrorna hjälper varandra hela tiden.",
    ],
    q: [
      ["Vad liknar en myrstack?", ["En hög med barr", "En stor sten", "Ett fågelbo", "En snöhög"], "fakta"],
      ["Vad finns inne i stacken?", ["Gångar och rum", "Vatten och sand", "Blommor och gräs", "Stenar och lera"], "fakta"],
      ["Vad gör drottningarna?", ["Lägger ägg", "Hämtar mat", "Bär barr", "Bygger gångar"], "fakta"],
      ["Vad kallas de andra myrorna?", ["Arbetare", "Drottningar", "Vakter", "Larver"], "fakta"],
      ["Vad kan en myra bära?", ["Saker som är tyngre än den", "Bara ett barr i taget", "Inga saker alls", "Bara saker som flyter"], "fakta"],
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
    id: "lr-g2-regnbagen", title: "Färgerna på himlen", textType: "fact", topic: "natur",
    body: [
      "En regnbåge kan synas när solen lyser samtidigt som det regnar. Då ser man en stor båge med färger på himlen.",
      "Solljuset ser vitt ut. Men egentligen finns många färger i det. När ljuset går in i regndropparna delas det upp i färger.",
      "Färgerna kommer alltid i samma ordning. Först kommer rött, sedan orange, gult, grönt, blått och lila.",
      "För att se regnbågen ska man ha solen bakom sig. Då tittar man mot regnet.",
    ],
    q: [
      ["När kan en regnbåge synas?", ["När solen lyser och det regnar", "När det är mulet och blåser kallt", "När det är mörkt ute", "När det snöar"], "fakta"],
      ["Vad finns egentligen i solljuset?", ["Många färger", "Små regndroppar", "Bara vitt ljus", "Lite rök"], "fakta"],
      ["Vilken färg kommer först i regnbågen?", ["Rött", "Blått", "Gult", "Lila"], "fakta"],
      ["Var ska solen vara när man tittar på regnbågen?", ["Bakom en", "Framför en", "Rakt ovanför", "Under marken"], "fakta"],
      ["Det finns egentligen många färger. Vad betyder egentligen?", ["I själva verket", "Kanske", "Aldrig", "Ibland"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-hjartat", title: "Hjärtat slår", textType: "fact", topic: "vetenskap",
    body: [
      "Hjärtat är en muskel. Det sitter i bröstet, lite till vänster. Ditt hjärta är ungefär lika stort som din knutna hand.",
      "Hjärtat pumpar blod runt i hela kroppen. Blodet går i rör som heter blodådror. Det tar med sig syre och näring till kroppen.",
      "När du springer slår hjärtat snabbare. Då behöver musklerna mer syre.",
      "Du kan känna hjärtat slå. Lägg handen på bröstet och var tyst en stund.",
    ],
    q: [
      ["Vad är hjärtat?", ["En muskel", "Ett ben", "En lunga", "Ett blodkärl"], "fakta"],
      ["Hur stort är hjärtat ungefär?", ["Som en knuten hand", "Som en fotboll", "Som en ärta", "Som ett huvud"], "fakta"],
      ["Vad heter rören som blodet går i?", ["Blodådror", "Muskler", "Lungor", "Nervtrådar"], "fakta"],
      ["Varför slår hjärtat snabbare när du springer?", ["Musklerna behöver mer syre", "Du blir rädd", "Du blir trött och hungrig", "Blodet börjar ta slut"], "fakta"],
      ["Hjärtat pumpar blod. Vad betyder det?", ["Det trycker runt blodet", "Det gör blodet kallt", "Det äter upp blodet", "Det sparar blodet"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-manen", title: "Månen byter form", textType: "fact", topic: "rymden",
    body: [
      "Månen åker runt jorden. Ett varv tar ungefär en månad.",
      "Månen lyser inte själv. Det är solen som lyser på den. Vi ser bara den del av månen som solen lyser på.",
      "Därför ser månen olika ut. Ibland ser vi en smal skära. Ibland ser vi en hel rund måne. Den kallas fullmåne.",
      "Ibland syns månen inte alls. Men månen är alltid lika rund. Det är bara ljuset på den som ändras.",
    ],
    q: [
      ["Vad åker månen runt?", ["Jorden", "Solen", "Stjärnorna", "Mars"], "fakta"],
      ["Hur lång tid tar ett varv?", ["Ungefär en månad", "En dag", "Ett helt år", "En vecka"], "fakta"],
      ["Varför lyser månen?", ["Solen lyser på den", "Den brinner", "Den har lampor", "Den är gjord av is"], "fakta"],
      ["Vad kallas det när vi ser hela månen?", ["Fullmåne", "Halvmåne", "Nymåne", "Månskära"], "fakta"],
      ["Vad är sant om månen?", ["Den är alltid rund", "Den krymper varje natt", "Den går sönder ibland", "Den byter färg varje natt"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-bina", title: "Bina gör honung", textType: "fact", topic: "djur",
    body: [
      "Bin flyger från blomma till blomma. I blommorna finns en söt saft som heter nektar. Bina suger upp nektarn och flyger hem till kupan.",
      "I kupan gör bina om nektarn till honung. De sparar honungen i små rum av vax. Rummen har sex kanter.",
      "Bin hjälper också blommorna. När ett bi landar fastnar pollen på dess kropp. Pollen följer med till nästa blomma. Då kan blomman få frön och frukt.",
    ],
    q: [
      ["Vad heter den söta saften i blommorna?", ["Nektar", "Honung", "Vax", "Pollen"], "fakta"],
      ["Vart flyger bina med nektarn?", ["Till kupan", "Till sjön", "Till skogen", "Till en sten"], "fakta"],
      ["Vad är rummen i kupan gjorda av?", ["Vax", "Lera", "Trä", "Blad"], "fakta"],
      ["Hur många kanter har rummen?", ["Sex", "Fyra", "Tre", "Åtta"], "fakta"],
      ["Hur hjälper bina blommorna?", ["De flyttar pollen", "De vattnar dem", "De äter upp ogräset", "De ger dem honung"], "fakta"],
    ],
  },
  {
    id: "lr-g2-svampen", title: "Svampar i skogen", textType: "fact", topic: "natur",
    body: [
      "På hösten växer det många svampar i skogen. Svampen vi ser är bara en liten del. Under marken finns ett nät av tunna trådar. Det är svampens största del.",
      "Svampar är varken växter eller djur. De har inga gröna blad och behöver inget solljus.",
      "Vissa svampar går att äta, till exempel kantareller. Men andra är giftiga och kan göra oss mycket sjuka.",
      "Plocka därför aldrig svamp själv. Fråga alltid en vuxen som kan mycket om svamp.",
    ],
    q: [
      ["När växer det många svampar?", ["På hösten", "På vintern", "På våren", "Bara på natten"], "fakta"],
      ["Var finns de tunna trådarna?", ["Under marken", "På träden", "I luften", "I vattnet"], "fakta"],
      ["Vad är svampar?", ["Varken växter eller djur", "Ett slags blomma", "Små djur som bor i mossan", "Ett slags träd"], "fakta"],
      ["Vilken svamp går att äta, enligt texten?", ["Kantarell", "Ingen svamp alls", "Alla svampar", "Bara svampar med blad"], "fakta"],
      ["Vad betyder det att en svamp är giftig?", ["Att den kan göra en sjuk", "Att den smakar sött", "Att den är stor", "Att den är gammal"], "ordforstaelse"],
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
];
