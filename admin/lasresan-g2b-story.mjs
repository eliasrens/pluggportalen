// ============================================================================
// Läsresan – källtexter för nivå 2 del b, story (issue #662)
// ----------------------------------------------------------------------------
// 20 story-texter, 60–90 ord, 4–5 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g2b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-2-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-g2-skolfotot", title: "Håret som stod upp", textType: "story", topic: "skola",
    body: [
      "I dag ska klassen fotograferas. Ella har tagit på sig sin finaste klänning. Hon har borstat håret länge.",
      "På rasten leker Ella kull. Hon springer och springer. När hon kommer in står håret rakt upp åt alla håll.",
      "Fotografen skrattar vänligt. Han ger Ella en kam och lite vatten. Hon kammar håret tills det ligger platt.",
      "Sedan sätter hon sig på pallen och ler stort. Klick! Bilden blir jättefin.",
    ],
    q: [
      ["Vad ska hända i klassen i dag?", ["De ska fotograferas", "De ska bada", "De ska åka på utflykt", "De ska baka bullar"], "fakta"],
      ["Vad leker Ella på rasten?", ["Kull", "Kurragömma", "Hoppa hage", "Fotboll"], "fakta"],
      ["Vad ger fotografen Ella?", ["En kam och vatten", "En mössa", "En spegel", "Ett rosa hårband"], "fakta"],
      ["Var sitter Ella när bilden tas?", ["På en pall", "På golvet", "På en bänk ute", "I en soffa"], "fakta"],
      ["Hur känner sig Ella när bilden tas?", ["Glad", "Arg", "Ledsen", "Rädd"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-laxan-blaste", title: "Läxan som blåste bort", textType: "story", topic: "vardag",
    body: [
      "Noah går hem från skolan. Han har sin matteläxa i handen. Det blåser mycket.",
      "Plötsligt kommer en stark vind. Papperet flyger iväg! Det landar högt uppe i en buske.",
      "Noah når inte upp. Då kommer grannen Vera med sin hund. Vera är lång. Hon sträcker ut armen och tar papperet.",
      "”Tack!” säger Noah. Hemma gör han läxan direkt. Sedan lägger han papperet i ryggsäcken.",
    ],
    q: [
      ["Vad har Noah i handen?", ["Sin matteläxa", "Sin mössa", "En glass", "En bok om djur"], "fakta"],
      ["Var landar papperet?", ["I en buske", "I en pöl", "På ett tak", "I en bäck"], "fakta"],
      ["Vem hjälper Noah?", ["Grannen Vera", "Hans mamma", "Hans storasyster", "En kompis"], "fakta"],
      ["Hur får Vera tag i papperet?", ["Hon sträcker ut armen", "Hon hämtar en stege", "Hunden hoppar upp", "Hon klättrar i busken"], "fakta"],
      ["Varför lägger Noah papperet i ryggsäcken?", ["Så att det inte blåser bort", "För att det är blött", "För att ryggsäcken är tom", "För att mamma vill ha det så"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-pannkakan", title: "Pannkakan i taket", textType: "story", topic: "roliga situationer",
    body: [
      "Det är lördag. Pappa steker pannkakor. Alva och Sam sitter vid bordet och väntar.",
      "”Nu ska ni få se ett trick”, säger pappa. Han kastar pannkakan högt upp i luften. Den ska vända sig och landa i pannan.",
      "Men pannkakan kommer inte ner. Den sitter fast i taket! Alla tittar upp. Det är helt tyst.",
      "Sedan faller den rakt ner på pappas huvud. Alva och Sam skrattar så att de nästan ramlar av stolarna.",
    ],
    q: [
      ["Vilken dag är det?", ["Lördag", "Söndag", "Fredag", "Måndag"], "fakta"],
      ["Vad steker pappa?", ["Pannkakor", "Köttbullar", "Ägg", "Fisk"], "fakta"],
      ["Vad händer när pappa kastar pannkakan?", ["Den fastnar i taket", "Den landar på golvet", "Hunden tar den", "Den hamnar i pannan"], "fakta"],
      ["Var landar pannkakan till slut?", ["På pappas huvud", "På Alvas tallrik", "I pannan", "På bordet"], "fakta"],
      ["Vad tycker barnen om det som händer?", ["Att det är roligt", "Att det är läskigt", "Att det är tråkigt", "Att det är sorgligt"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-guldfisken", title: "Grannens guldfisk", textType: "story", topic: "vardag",
    body: [
      "Grannen Ali ska resa bort en vecka. Han ber Lina att ta hand om hans guldfisk. Den heter Bubbel.",
      "Varje morgon går Lina in till Ali. Hon ger Bubbel en liten nypa mat. Inte mer, för då blir vattnet smutsigt.",
      "En dag ligger Bubbel helt stilla bakom en sten. Lina blir rädd. Men när hon knackar lätt på glaset simmar han fram.",
      "När Ali kommer hem får Lina en ask choklad. ”Tack för hjälpen”, säger han.",
    ],
    q: [
      ["Hur länge ska Ali vara borta?", ["En vecka", "En dag", "En månad", "Två veckor"], "fakta"],
      ["Vad heter guldfisken?", ["Bubbel", "Plask", "Guld", "Simmis"], "fakta"],
      ["Varför får Bubbel bara lite mat?", ["Annars blir vattnet smutsigt", "Han är aldrig hungrig", "Maten räcker inte hela veckan", "Ali vill spara pengar"], "fakta"],
      ["Vad gör Bubbel när Lina knackar på glaset?", ["Simmar fram", "Hoppar upp", "Gömmer sig", "Somnar"], "fakta"],
      ["Lina ger en nypa mat. Vad är en nypa?", ["Lite grann", "En stor skål", "En hel burk", "En sked vatten"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-spar-i-snon", title: "Spåren i snön", textType: "story", topic: "mysterier",
    body: [
      "En morgon ser Hugo spår i snön utanför huset. Spåren går över hela gräsmattan.",
      "”Är det en tjuv?” undrar Hugo. Han tar på sig stövlarna och följer spåren. De går förbi gungan och fram till ett träd.",
      "Spåren är små. De ser inte alls ut som fotspår från en människa. Under trädet ligger lite fågelmat.",
      "Då ser Hugo något rött uppe i trädet. Det är en ekorre! Den sitter på en gren och äter av fågelmaten.",
    ],
    q: [
      ["Var ser Hugo spåren?", ["I snön utanför huset", "I sanden vid sjön", "På golvet i köket", "I leran bakom skolan"], "fakta"],
      ["Vad tror Hugo först att spåren kommer från?", ["En tjuv", "En hund", "En katt", "Ett barn"], "fakta"],
      ["Vad tar Hugo på sig?", ["Stövlarna", "Mössan", "Jackan", "Skidbyxorna"], "fakta"],
      ["Vad ligger under trädet?", ["Fågelmat", "En vante", "En nyckel", "Ett äpple"], "fakta"],
      ["Vem har gjort spåren?", ["En ekorre", "En tjuv", "En fågel", "Grannens katt"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-gungan", title: "Bråket om gungan", textType: "story", topic: "relationer",
    body: [
      "Det finns bara en gunga i trädgården. Både Maja och lillebror Elis vill gunga.",
      "”Jag var här först!” ropar Maja. ”Nej, det var jag!” skriker Elis. De drar i gungan och börjar gråta.",
      "Farmor kommer ut med en klocka. ”Ni får gunga fem minuter var”, säger hon.",
      "Maja börjar. Sedan är det Elis tur. Efter en stund tröttnar de båda. Då springer de till sandlådan och bygger ett slott tillsammans.",
    ],
    q: [
      ["Hur många gungor finns i trädgården?", ["En", "Två", "Tre", "Ingen"], "fakta"],
      ["Vad heter Majas lillebror?", ["Elis", "Elias", "Erik", "Emil"], "fakta"],
      ["Vad har farmor med sig ut?", ["En klocka", "En kaka", "En boll", "En bok"], "fakta"],
      ["Hur länge får varje barn gunga?", ["Fem minuter", "Tio minuter", "En hel timme", "En minut"], "fakta"],
      ["Hur löser farmor bråket?", ["De får turas om", "Hon tar bort gungan", "Hon köper en gunga till", "Hon skickar in dem"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-brev-morfar", title: "Ett brev till morfar", textType: "story", topic: "relationer",
    body: [
      "Morfar bor långt bort i en annan stad. Han har ingen dator och ingen mobil. Därför skriver Omar ett brev till honom.",
      "Omar berättar om sin nya cykel och om skolan. Han ritar också en bild av sin katt.",
      "Mamma hjälper honom att skriva adressen på kuvertet. Sedan sätter de på ett frimärke och lägger brevet i brevlådan.",
      "En vecka senare kommer ett brev tillbaka. Morfar har ritat en katt också!",
    ],
    q: [
      ["Varför skriver Omar ett brev i stället för att ringa?", ["Morfar har ingen mobil", "Omar tycker om att skriva", "Mamma säger åt honom", "Morfar hör dåligt"], "fakta"],
      ["Vad ritar Omar?", ["Sin katt", "Sin cykel", "Sin skola", "Sin morfar"], "fakta"],
      ["Vad sätter de på kuvertet efter adressen?", ["Ett frimärke", "En klisterbild", "En blomma", "Ett band"], "fakta"],
      ["När kommer ett brev tillbaka?", ["En vecka senare", "Nästa dag", "Efter ett år", "Samma kväll"], "fakta"],
      ["Vad tyckte morfar nog om Omars bild?", ["Att den var fin", "Att den var ful", "Att den var tråkig", "Att den var för liten"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-taltet", title: "Natten i tältet", textType: "story", topic: "äventyr",
    body: [
      "Liv och pappa sätter upp ett tält i trädgården. De ska sova ute en hel natt.",
      "När det blir mörkt tänder de en ficklampa. De äter smörgåsar och tittar på stjärnorna.",
      "Mitt i natten vaknar Liv. Det prasslar utanför tältet. Det låter som någon som går i gräset. Liv väcker pappa.",
      "Pappa lyser försiktigt ut med ficklampan. Där står en igelkott och nosar på deras skor! Liv somnar om med ett leende.",
    ],
    q: [
      ["Var sätter de upp tältet?", ["I trädgården", "I skogen", "Vid sjön", "På fjället"], "fakta"],
      ["Vad äter de i tältet?", ["Smörgåsar", "Korv", "Glass", "Pannkakor"], "fakta"],
      ["Vad väcker Liv mitt i natten?", ["Ett prasslande ljud", "Regn som smattrar på tältet", "En mygga", "Pappa som snarkar"], "fakta"],
      ["Vem står utanför tältet?", ["En igelkott", "En katt", "En räv", "En granne"], "fakta"],
      ["Hur känner sig Liv när hon somnar om?", ["Lugn och glad", "Rädd och ledsen", "Arg och trött", "Hungrig och kall"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-simmarket", title: "Hela vägen över", textType: "story", topic: "sport",
    body: [
      "Varje torsdag går Selma på simskola. Hon vill ta sitt första simmärke. Då måste hon simma 25 meter utan att stanna.",
      "Förra veckan orkade hon bara halva vägen. Då fick hon hålla i kanten och vila.",
      "I dag tar Selma ett djupt andetag. Hon sparkar med benen och tar långa simtag med armarna. Hon tittar bara framåt.",
      "Till slut når hon den andra kanten. Simläraren klappar händerna. Selma har klarat det!",
    ],
    q: [
      ["Vilken dag går Selma på simskola?", ["Torsdag", "Tisdag", "Lördag", "Måndag"], "fakta"],
      ["Hur långt måste hon simma?", ["25 meter", "10 meter", "50 meter", "100 meter"], "fakta"],
      ["Vad hände förra veckan?", ["Hon orkade bara halva vägen", "Hon var sjuk hemma", "Hon tappade simglasögonen i vattnet", "Hon simmade hela vägen"], "fakta"],
      ["Vad gör simläraren när Selma klarar det?", ["Klappar händerna", "Blåser i en visselpipa", "Hoppar i vattnet", "Ger henne en glass"], "fakta"],
      ["Vad får Selma troligen nu?", ["Sitt första simmärke", "En ny baddräkt", "En medalj i guld", "Ett pris för snabbast"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-bilnyckeln", title: "Den borttappade nyckeln", textType: "story", topic: "mysterier",
    body: [
      "Mamma ska åka till jobbet. Men hon hittar inte bilnyckeln. Den brukar hänga på en krok i hallen.",
      "Hela familjen letar. Ida tittar under soffan. Pappa letar i alla jackfickor. Ingen hittar något.",
      "Då ser Ida hunden Tass i sin korg. Han tuggar på något. Något blankt glimmar mellan tassarna.",
      "”Tass!” säger Ida och skrattar. Det är nyckeln. Den är lite blöt, men den fungerar.",
    ],
    q: [
      ["Var brukar nyckeln hänga?", ["På en krok i hallen", "På kylskåpet i köket", "I mammas väska", "På en spik i garaget"], "fakta"],
      ["Var tittar Ida?", ["Under soffan", "Under sängen", "I skåpet", "I lådan"], "fakta"],
      ["Var letar pappa?", ["I jackfickorna", "I bilen", "I diskmaskinen", "I soptunnan"], "fakta"],
      ["Vem hade tagit nyckeln?", ["Hunden Tass", "Lillebror", "Pappa", "Grannens katt"], "mellan_raderna"],
      ["Något blankt glimmar. Vad betyder glimmar?", ["Lyser lite", "Låter högt", "Luktar illa", "Känns mjukt"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-skridskor", title: "Första gången på isen", textType: "story", topic: "sport",
    body: [
      "Sjön har frusit. Pappa har kollat att isen är tjock nog. Nu ska Wilma åka skridskor för första gången.",
      "Hon står på isen med raka ben. Fötterna glider åt olika håll. Pladask! Wilma sitter på rumpan.",
      "”Böj lite på knäna”, säger pappa. ”Och titta framåt, inte ner på fötterna.”",
      "Wilma försöker igen. Hon böjer knäna och tar små steg. Nu glider hon en bit! Efter en timme vill hon inte gå hem.",
    ],
    q: [
      ["Var åker Wilma skridskor?", ["På en frusen sjö", "I en ishall", "På isen vid skolan", "På en åker"], "fakta"],
      ["Vad har pappa kollat?", ["Att isen är tjock nog", "Att det är varmt ute", "Att skridskorna är vassa", "Att Wilma har mössa"], "fakta"],
      ["Vad händer när Wilma står på isen första gången?", ["Hon ramlar", "Hon åker fort", "Hon börjar gråta", "Hon går hem"], "fakta"],
      ["Vad säger pappa att hon ska göra med knäna?", ["Böja dem", "Sträcka dem", "Hålla dem stilla", "Lyfta dem högt"], "fakta"],
      ["Pladask! Vad betyder det här?", ["Att någon ramlar", "Att någon skrattar", "Att någon ropar", "Att någon springer"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-papegojan", title: "Papegojan som pratade", textType: "story", topic: "roliga situationer",
    body: [
      "Faster Lena har en papegoja som heter Kiwi. Kiwi är grön och kan säga några ord.",
      "När Elsa kommer på besök sitter Kiwi i sin bur. ”Hej hej!” säger Kiwi. Elsa skrattar.",
      "Sedan ringer faster Lenas telefon. Hon går ut i köket och pratar.",
      "Plötsligt hör Elsa en signal. Det låter precis som telefonen! Faster Lena springer in. Men telefonen är tyst. Det var Kiwi som härmade den. ”Hej hej!” säger Kiwi igen.",
    ],
    q: [
      ["Vad heter papegojan?", ["Kiwi", "Lena", "Elsa", "Polly"], "fakta"],
      ["Vilken färg har Kiwi?", ["Grön", "Röd", "Blå", "Gul"], "fakta"],
      ["Vad säger Kiwi när Elsa kommer?", ["Hej hej", "God morgon", "Tack så mycket", "Hej då"], "fakta"],
      ["Vad gör faster Lena när telefonen ringer?", ["Går ut i köket", "Stänger av den", "Ger den till Elsa", "Lägger den i buren"], "fakta"],
      ["Kiwi härmade telefonen. Vad betyder det?", ["Kiwi gjorde samma ljud", "Kiwi tog sönder den", "Kiwi gömde den", "Kiwi bet i den"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-tomatfrot", title: "Fröet i fönstret", textType: "story", topic: "skola",
    body: [
      "Klassen ska odla tomater. Alla får en liten kruka med jord. Elin stoppar ner ett frö och vattnar försiktigt.",
      "Krukorna står i fönstret där solen lyser in. Varje dag tittar Elin på sin kruka. Men ingenting händer.",
      "Efter en vecka syns en liten grön stjälk. Den har två små blad. Elin blir så glad att hon hoppar.",
      "Före sommarlovet tar hon hem plantan. I augusti får hon äta sin första egna tomat.",
    ],
    q: [
      ["Vad ska klassen odla?", ["Tomater", "Gurkor", "Blommor", "Morötter"], "fakta"],
      ["Var står krukorna?", ["I fönstret", "På golvet", "I ett skåp", "Ute på gården"], "fakta"],
      ["Hur länge dröjer det innan något syns?", ["En vecka", "En dag", "En månad", "Ett år"], "fakta"],
      ["När får Elin äta sin första tomat?", ["I augusti", "I maj", "I december", "I mars"], "fakta"],
      ["Varför tittar Elin på krukan varje dag?", ["Hon vill se om fröet har växt", "Fröken säger åt henne", "Hon vill vattna blommorna", "Hon tycker att krukan är så fin"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-malvakten", title: "Den nya målvakten", textType: "story", topic: "sport",
    body: [
      "Lagets målvakt är sjuk. Tränaren frågar vem som vill stå i mål. Ingen räcker upp handen. Till slut säger Amir: ”Jag kan försöka.”",
      "Amir tar på sig de stora handskarna. Han är nervös. Det andra laget skjuter hårt.",
      "Första bollen räddar han med foten. Den andra fångar han med båda händerna. Hans kompisar jublar.",
      "Matchen slutar ett–noll till Amirs lag. ”Du var bäst i dag”, säger tränaren.",
    ],
    q: [
      ["Varför behöver laget en ny målvakt?", ["Målvakten är sjuk", "Målvakten har flyttat", "Målvakten kommer för sent", "Målvakten vill spela anfall"], "fakta"],
      ["Vad tar Amir på sig?", ["Stora handskar", "En mössa", "Nya skor", "En hjälm"], "fakta"],
      ["Hur räddar Amir den första bollen?", ["Med foten", "Med huvudet", "Med händerna", "Med knät"], "fakta"],
      ["Hur slutar matchen?", ["Ett–noll till Amirs lag", "Oavgjort", "Noll–ett till andra laget", "Tre–två till Amirs lag"], "fakta"],
      ["Vad visar Amir när han ställer sig i mål?", ["Att han är modig", "Att han är lat", "Att han är rädd", "Att han är sur"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-handlingslappen", title: "Lappen i fickan", textType: "story", topic: "vardag",
    body: [
      "Mamma skickar Leo till affären. Han får en lapp och pengar. På lappen står: mjölk, bröd, ägg och bananer.",
      "Leo tycker att han kan komma ihåg allt. Han stoppar lappen i fickan och tittar inte på den.",
      "I affären tar han mjölk, bröd och bananer. Sedan går han hem.",
      "”Var är äggen?” frågar mamma. Leo tar fram lappen. Där står det ju! Han får gå tillbaka en gång till.",
    ],
    q: [
      ["Vad får Leo av mamma?", ["En lapp och pengar", "En väska", "En tygpåse och en nyckel", "En glass"], "fakta"],
      ["Hur många saker står på lappen?", ["Fyra", "Tre", "Två", "Fem"], "fakta"],
      ["Vad glömmer Leo att köpa?", ["Ägg", "Mjölk", "Bröd", "Bananer"], "fakta"],
      ["Var har Leo lappen?", ["I fickan", "I handen", "I väskan", "I mössan"], "fakta"],
      ["Vad borde Leo ha gjort?", ["Tittat på lappen", "Sprungit fortare", "Köpt mer bröd", "Stannat hemma"], "helhet_slutsats"],
    ],
  },
];
