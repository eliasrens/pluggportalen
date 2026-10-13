// ============================================================================
// Läsresan – källtexter för nivå 3, del b, story (issue #663)
// ----------------------------------------------------------------------------
// 20 story-texter, 100–140 ord, 6–7 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g3b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-3-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-g3-videosamtalet", title: "Mormors nya mobil", textType: "story", topic: "relationer",
    body: [
      "Mormor Ingrid har fått en ny mobil. Men hon tycker att den är krånglig. ”Den gör aldrig som jag vill”, suckar hon.",
      "Därför går Selma hem till henne efter skolan. Hon visar hur man låser upp skärmen. Sedan visar hon den gröna knappen som man ringer med. Mormor skriver upp allt i ett litet block.",
      "Först trycker mormor fel hela tiden. En gång ringer hon till tandläkaren av misstag! De skrattar så att de får tårar i ögonen.",
      "Till sist ska de prova ett videosamtal. Selma går ut i hallen och ringer. På skärmen syns bara mormors näsa, alldeles stor och nära.",
      "”Håll mobilen längre bort!” ropar Selma.",
      "Nu ringer mormor till Selma varje söndag. Hon visar sina blommor och frågar hur det går i skolan.",
    ],
    q: [
      ["Vad tycker mormor om sin nya mobil?", ["Att den är krånglig", "Att den är för liten", "Att den är för dyr", "Att den är för tung"], "fakta"],
      ["Var skriver mormor upp allt?", ["I ett litet block", "På en lapp på kylskåpet", "I mobilen", "På handen"], "fakta"],
      ["Vem ringer mormor av misstag?", ["Tandläkaren", "Brandkåren", "Selmas pappa", "Grannen"], "fakta"],
      ["Mormor suckar. Vad gör hon då?", ["Andas ut tungt", "Skrattar högt", "Sjunger tyst", "Nyser flera gånger"], "ordforstaelse"],
      ["Varför syns bara mormors näsa på skärmen?", ["Hon håller mobilen för nära", "Skärmen är trasig", "Selma har ritat på skärmen", "Selma har ritat en näsa på skärmen"], "mellan_raderna"],
      ["Vad visar slutet av texten?", ["Mormor har lärt sig använda mobilen", "Mormor har gett bort mobilen", "Selma är trött på mormor", "Mormor ringer bara till tandläkaren"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-paddorna", title: "Paddorna på vägen", textType: "story", topic: "natur",
    body: [
      "En kväll i april kör Ebba och pappa förbi sjön. Plötsligt bromsar pappa. På vägen hoppar massor av små bruna djur. Det är paddor!",
      "”De är på väg till sjön för att lägga ägg”, säger pappa. ”Varje vår vandrar de dit. Men först måste de över vägen.”",
      "Ebba ser att en bil kör över flera paddor. Hon blir ledsen och tyst hela vägen hem.",
      "Nästa kväll kommer de tillbaka. De har gula västar, ficklampor och två hinkar. Där finns redan några andra människor. Alla lyfter försiktigt upp paddorna i hinkarna. Sedan bär de dem över vägen och släpper dem vid stranden.",
      "Ebba räknar varje padda som hon hjälper. När det är dags att åka hem har hon kommit till fyrtiosju.",
      "Hon somnar i bilen med ett leende.",
    ],
    q: [
      ["Vilken månad händer det?", ["April", "Juli", "Oktober", "December"], "fakta"],
      ["Varför vandrar paddorna till sjön?", ["För att lägga ägg", "För att leta mat", "För att sova över vintern", "För att bada i varmt vatten"], "fakta"],
      ["Hur känner sig Ebba när bilen kör över paddorna?", ["Ledsen", "Glad", "Uttråkad", "Hungrig"], "fakta"],
      ["Vad har de med sig nästa kväll?", ["Västar, ficklampor och hinkar", "Håvar, stövlar och en båt", "Filtar, smörgåsar och ett litet tält", "En kamera och en karta"], "fakta"],
      ["Varför har de gula västar på sig?", ["Så att bilarna ser dem", "Så att paddorna hittar dem", "För att det är kallt ute", "För att det är pappas favoritfärg"], "mellan_raderna"],
      ["Hur många paddor hjälper Ebba?", ["Fyrtiosju", "Sjutton", "Fyrtio", "Sjuttiofyra"], "fakta"],
      ["Ebba somnar med ett leende. Vad säger det om henne?", ["Hon är nöjd med kvällen", "Hon är rädd för paddor", "Hon vill aldrig åka dit igen", "Hon har glömt paddorna"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-masen", title: "Måsen i hamnen", textType: "story", topic: "roliga situationer",
    body: [
      "Det är sommar, och Elvin är i hamnen med pappa och lillasyster Mira. De köper var sin glass. Elvin väljer jordgubb med strössel.",
      "De sätter sig på en bänk vid vattnet. Elvin lyfter glassen och ska ta första tuggan. Då hörs ett skrik ovanför. En stor vit mås dyker ner. Swisch! Glassen är borta. Kvar i handen finns bara struten.",
      "Mira skrattar så att hon nästan trillar av bänken. Pappa köper en ny glass till Elvin.",
      "Men efter en liten stund kommer måsen tillbaka. Den här gången tar den Miras glass! Nu är det Elvin som skrattar.",
      "Pappa skakar på huvudet. ”Nu äter vi under parasollet vid kiosken”, säger han.",
      "Måsen sitter kvar på en stolpe och tittar på dem.",
    ],
    q: [
      ["Var är Elvin?", ["I hamnen", "På stranden", "I parken", "På torget"], "fakta"],
      ["Vilken glass väljer Elvin?", ["Jordgubb med strössel", "Choklad med hackade nötter", "Vanilj med kola", "Päron med strössel"], "fakta"],
      ["Vad finns kvar i Elvins hand?", ["Struten", "En servett", "En sked", "En fjäder"], "fakta"],
      ["Måsen dyker ner. Vad betyder dyker här?", ["Flyger snabbt neråt", "Simmar under vattnet", "Gömmer sig bakom något", "Landar sakta"], "ordforstaelse"],
      ["Varför skrattar Elvin när måsen tar Miras glass?", ["Nu har samma sak hänt Mira", "Han tycker inte om Mira", "Han har redan ätit upp sin glass", "Måsen har tappat en fjäder"], "mellan_raderna"],
      ["Varför vill pappa äta under parasollet?", ["Där kommer måsen inte åt glassen", "Det börjar regna", "Solen är alldeles för stark vid vattnet", "Bänken är blöt"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-stromavbrottet", title: "När lamporna slocknade", textType: "story", topic: "vardag",
    body: [
      "Det stormar ute. Vinden viner runt huset, och regnet smattrar mot fönstren. Familjen sitter och äter middag.",
      "Plötsligt blir det kolsvart. Kylskåpet slutar brumma och tv:n tystnar. ”Strömavbrott”, säger mamma. ”Ett träd har nog fallit på en elledning.”",
      "Pappa letar fram en ficklampa i kökslådan. Sedan tänder han stearinljus på bordet. Det blir mysigt och lite spöklikt.",
      "Utan tv och dator vet Nils först inte vad han ska göra. Men mamma hämtar ett gammalt kortspel. De spelar och berättar historier i skenet från ljusen. Pappa berättar om när han var liten och snön räckte ända upp till fönstren.",
      "Klockan tio tänds lamporna igen. Nils blir nästan lite besviken.",
      "”Kan vi inte släcka ändå?” frågar han.",
    ],
    q: [
      ["Vad gör familjen när strömmen går?", ["Äter middag", "Tittar på film", "Sover", "Borstar tänderna"], "fakta"],
      ["Vad tror mamma har hänt?", ["Ett träd har fallit på en ledning", "Någon har dragit ur sladden", "Alla lampor har gått sönder", "Grannen har stängt av all ström i huset"], "fakta"],
      ["Var hittar pappa ficklampan?", ["I kökslådan", "I garaget", "Under sängen", "I bilen"], "fakta"],
      ["Det blir kolsvart. Vad betyder kolsvart?", ["Helt mörkt", "Lite grått", "Väldigt kallt", "Mycket tyst"], "ordforstaelse"],
      ["Vad berättar pappa om?", ["När han var liten", "Ett spöke i huset", "En resa till havet", "Hur elen fungerar"], "fakta"],
      ["Varför vill Nils släcka lamporna igen?", ["Han tyckte att kvällen var mysig", "Han är rädd för ljuset", "Lamporna surrar och blinkar hela tiden", "Han vill sova"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-upplasningen", title: "Sagan om den flygande igelkotten", textType: "story", topic: "skola",
    body: [
      "Klassen har skrivit egna sagor. På fredag ska alla läsa sin saga högt. Ture har skrivit om en igelkott som vill lära sig flyga.",
      "Men Ture är nervös. Han tycker inte om att prata inför många. På torsdagskvällen ligger han vaken länge.",
      "Storasyster Alva ger honom ett råd. ”Öva för din nalle. Läs långsamt och titta upp ibland.”",
      "Ture övar tre gånger. Nallen sitter stilla och lyssnar.",
      "På fredagen darrar papperet i hans händer. Rösten låter pipig i början. Men så kommer han till delen där igelkotten fastnar i en trädkrona. Då börjar alla skratta. Ture blir modigare. Han läser högre och tittar upp på klassen.",
      "När han är klar klappar alla händerna. ”Kan du skriva en fortsättning?” frågar läraren.",
    ],
    q: [
      ["Vad handlar Tures saga om?", ["En igelkott som vill flyga", "En fågel som vill simma", "En katt som vill sjunga", "En igelkott som bor i ett träd"], "fakta"],
      ["Vilken dag ska klassen läsa sina sagor?", ["Fredag", "Måndag", "Torsdag", "Lördag"], "fakta"],
      ["Vem ger Ture ett råd?", ["Hans storasyster", "Läraren", "Mamma", "Hans bästa kompis"], "fakta"],
      ["Ture är nervös. Hur känner han sig?", ["Orolig", "Lugn", "Arg", "Sömnig"], "ordforstaelse"],
      ["Vad gör att Ture blir modigare?", ["Klassen skrattar åt det roliga", "Läraren håller hans hand", "Nallen sitter i klassrummet", "Han får läsa allra sist"], "fakta"],
      ["Varför frågar läraren efter en fortsättning?", ["Sagan var bra och alla tyckte om den", "Sagan var alldeles för kort", "Ture hade glömt slutet", "Läraren hörde inte vad han läste"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-kantarellerna", title: "Med solen i nacken", textType: "story", topic: "äventyr",
    body: [
      "En lördag i augusti går Amir och mamma till skogen. De har med sig en korg och en kniv. De ska plocka kantareller.",
      "Mamma vet ett bra ställe. Vid en stor mossig sten växer det gula svampar varje år. De plockar tills korgen är halvfull.",
      "Men när de ska gå hem ser alla träd likadana ut. Vilket håll kom de ifrån? Amir känner sig lite rädd.",
      "Mamma tar fram mobilen. Men här i skogen finns ingen täckning. Då minns Amir något.",
      "”Solen sken oss i ansiktet när vi gick hit”, säger han. ”Då ska den skina i nacken när vi går hem.”",
      "De går med solen i nacken. Efter en stund ser de stigen och sedan bilen.",
      "Hemma steker de svamparna i smör. ”Du är en riktig skogsmänniska”, säger mamma.",
    ],
    q: [
      ["Vad ska Amir och mamma plocka?", ["Kantareller", "Lingon och blåbär", "Lingon", "Kottar"], "fakta"],
      ["Var växer svamparna?", ["Vid en stor mossig sten", "Under en stor gran nere vid sjön", "Precis bredvid stigen", "På en äng"], "fakta"],
      ["Varför kan de inte använda mobilen?", ["Det finns ingen täckning", "Batteriet är slut", "Den ligger kvar hemma i bilen", "Den har blivit blöt"], "fakta"],
      ["Ingen täckning betyder att mobilen …", ["inte får någon kontakt", "är avstängd", "har tappat skalet", "har fått en spricka i glaset"], "ordforstaelse"],
      ["Vad kommer Amir ihåg?", ["Var solen var på vägen dit", "Att de gick över en bäck", "Att de såg ett rådjur", "Att stigen var röd"], "fakta"],
      ["Varför kallar mamma Amir en riktig skogsmänniska?", ["Han kom på hur de skulle hitta hem", "Han plockade flest svampar", "Han har bott i skogen", "Han kan klättra i träd"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g3-cykeln", title: "Cykeln som flyttade sig", textType: "story", topic: "mysterier",
    body: [
      "Varje kväll ställer Hugo sin blå cykel vid staketet. Men varje morgon står den på ett annat ställe. En gång står den vid soptunnan. En annan gång står den vid garaget.",
      "”Det spökar”, säger lillebror Vidar.",
      "Hugo tror inte på spöken. Han lägger en liten pinne framför hjulet. Nästa morgon ligger pinnen i två bitar. På pakethållaren ligger en hopvikt tidning.",
      "Då får Hugo en idé. Han ställer väckarklockan på kvart över fem. Sedan står han tyst vid fönstret och väntar.",
      "Där är storebror Rasmus! Han leder ut Hugos cykel och lastar den med tidningar. Rasmus har fått jobb som tidningsbud. Hans egen cykel har punktering.",
      "”Du kunde ha frågat”, säger Hugo. Rasmus lovar att laga sin egen cykel. Som tack bjuder han Hugo på glass.",
    ],
    q: [
      ["Vilken färg har Hugos cykel?", ["Blå", "Röd", "Grön", "Svart"], "fakta"],
      ["Vad tror Vidar?", ["Att det spökar", "Att en tjuv tar cykeln", "Att vinden flyttar cykeln", "Att pappa har lånat den"], "fakta"],
      ["Vad hittar Hugo på pakethållaren?", ["En tidning", "En nyckel", "En borttappad vante", "Ett brev"], "fakta"],
      ["Varför lägger Hugo en pinne framför hjulet?", ["Han vill se om cykeln flyttas", "Cykeln ska inte rulla iväg", "Han vill reta Vidar", "Han ska laga hjulet"], "mellan_raderna"],
      ["Rasmus är tidningsbud. Vad gör ett tidningsbud?", ["Delar ut tidningar", "Skriver tidningar", "Säljer cyklar i en affär", "Lagar cyklar"], "ordforstaelse"],
      ["Varför lånar Rasmus Hugos cykel?", ["Hans egen cykel är trasig", "Hugos cykel är snabbare", "Han har ingen egen cykel", "Han vill busa med Hugo"], "fakta"],
      ["Vad tycker Hugo att Rasmus borde ha gjort?", ["Frågat först", "Köpt en ny cykel", "Gått i stället", "Väckt Vidar"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-ritade-ord", title: "Ord som man ritar", textType: "story", topic: "skola",
    body: [
      "En dag kommer en ny elev till klass 3A. Hon heter Daria och har flyttat från ett annat land. Hon kan bara några få ord på svenska.",
      "På rasten står Daria ensam vid staketet. Majken vill prata med henne. Men hur ska hon göra?",
      "Då tar Majken fram sitt ritblock. Hon ritar en boll och pekar mot planen. Daria skakar på huvudet och ritar ett hopprep. Majken hämtar ett hopprep från förrådet. Sedan hoppar de tillsammans hela rasten.",
      "Efter det ritar de varje dag. Majken ritar en katt och skriver ordet katt under. Daria lär sig ordet. Sedan skriver hon samma ord på sitt eget språk.",
      "Efter några månader pratar Daria nästan bara svenska. Och Majken kan räkna till tio på Darias språk.",
    ],
    q: [
      ["Hur mycket svenska kan Daria i början?", ["Några få ord", "Väldigt mycket", "Inte ett enda ord", "Bara siffrorna"], "fakta"],
      ["Var står Daria på rasten?", ["Vid staketet", "Vid gungorna", "I klassrummet", "Vid förrådet"], "fakta"],
      ["Vad ritar Daria?", ["Ett hopprep", "En boll", "En katt", "Ett hus med ett träd"], "fakta"],
      ["Varför ritar Majken i stället för att prata?", ["Daria förstår inte så mycket svenska", "Majken har ont i halsen", "Man får inte prata på rasten", "Majken vill visa hur bra hon ritar"], "mellan_raderna"],
      ["Daria skakar på huvudet. Vad menar hon då?", ["Nej", "Ja", "Hej då", "Kom hit"], "ordforstaelse"],
      ["Vad har Majken lärt sig efter några månader?", ["Att räkna till tio på Darias språk", "Att rita hästar som ser riktiga ut", "Att hoppa längre", "Att skriva Darias namn"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur två barn blir vänner trots olika språk", "Hur man hoppar hopprep", "En lärare som tycker om att rita", "Ett land som ligger långt borta"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-draken-glod", title: "Draken som blåste bubblor", textType: "story", topic: "sagor",
    body: [
      "Högt uppe i bergen bor draken Glöd. Alla drakar kan spruta eld. Men inte Glöd. När han försöker kommer det bara såpbubblor ur munnen.",
      "De andra drakarna skrattar. ”En drake med bubblor!” Glöd blir ledsen och flyger iväg till en grotta.",
      "En dag börjar det brinna i skogen nedanför berget. Djuren springer åt alla håll. De stora drakarna vet inte vad de ska göra. Eld kan ju inte släcka eld.",
      "Då flyger Glöd ner. Han andas djupt och blåser. Tusentals bubblor singlar ner över lågorna. Det fräser och ryker. Snart är elden släckt.",
      "Djuren jublar. Till och med de stora drakarna bugar för Glöd.",
      "Sedan dess är det Glöd som vaktar skogen. Ingen skrattar åt hans bubblor längre.",
    ],
    q: [
      ["Vad kommer ut ur Glöds mun?", ["Såpbubblor", "Eld", "Rök", "Små snöflingor"], "fakta"],
      ["Vart flyger Glöd när han är ledsen?", ["Till en grotta", "Till skogen", "Till en sjö", "Upp bland molnen"], "fakta"],
      ["Vad händer i skogen?", ["Det börjar brinna", "Det börjar snöa", "Ett träd faller", "En jätte kommer"], "fakta"],
      ["Bubblorna singlar ner. Hur faller de?", ["Sakta och svävande", "Snabbt och hårt", "Rakt uppåt mot himlen", "Inte alls"], "ordforstaelse"],
      ["Varför kan de stora drakarna inte hjälpa till?", ["De kan bara spruta eld", "De sover i grottan", "De är rädda för djuren", "De har flugit bort"], "mellan_raderna"],
      ["Vad vill sagan säga?", ["Det som gör en annorlunda kan vara bra", "Drakar är farliga", "Man ska aldrig leka med eld", "Bubblor är roliga"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g3-flygresan", title: "Ovanför molnen", textType: "story", topic: "resor",
    body: [
      "Leia ska flyga för första gången. Hon och mamma ska hälsa på morbror i Spanien. På flygplatsen är det fullt med människor och resväskor.",
      "Leia har en plats vid fönstret. När flygplanet rusar fram på banan trycks hon bak i sätet. Sedan lyfter det. Husen blir små som leksaker.",
      "Efter en stund slår det lock för öronen. Det känns som om de är fulla av bomull. ”Tugga på en karamell”, säger mamma. ”Eller gäspa stort.” Leia gäspar, och det klickar till. Nu hör hon bra igen.",
      "Utanför fönstret ligger molnen som ett vitt täcke. Här uppe skiner solen, fast det regnade hemma.",
      "Efter tre timmar landar de. När dörren öppnas slår varm luft emot dem. ”Välkomna!” ropar morbror.",
    ],
    q: [
      ["Vart ska Leia och mamma resa?", ["Till Spanien", "Till Norge", "Till Grekland", "Till Finland"], "fakta"],
      ["Var sitter Leia i flygplanet?", ["Vid fönstret", "Vid gången", "Bredvid piloten", "Bredvid morbror"], "fakta"],
      ["Vad ser husen ut som när planet lyfter?", ["Leksaker", "Myror", "Stenar", "Tändstickor"], "fakta"],
      ["Vad kan man göra när det slår lock för öronen?", ["Gäspa stort", "Sjunga en sång", "Dricka kallt vatten", "Blunda hårt"], "fakta"],
      ["Molnen ligger som ett vitt täcke. Vad betyder det?", ["Molnen täcker allt under planet", "Det snöar inne i planet", "Molnen är varma och mjuka", "Det har blivit natt"], "ordforstaelse"],
      ["Varför skiner solen fast det regnade hemma?", ["Planet flyger ovanför molnen", "Det har slutat regna hemma", "Solen följer med planet", "Fönstret är gult"], "mellan_raderna"],
      ["Hur länge flyger de?", ["Tre timmar", "En timme", "Sex timmar", "Tio timmar"], "fakta"],
    ],
  },
];
