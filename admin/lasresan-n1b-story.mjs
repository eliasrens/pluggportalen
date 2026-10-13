// ============================================================================
// Läsresan – källtexter för nivå 4 fil b, story (issue #664)
// ----------------------------------------------------------------------------
// Story-texter, 60–110 ord, 6–7 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-n1b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-4-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-n1-talangshowen", title: "Ella vågar sjunga", textType: "story", topic: "skola",
    body: [
      "Det är talangshow i skolan på fredag. Ella vill sjunga en sång. Hon har övat hemma i flera veckor.",
      "Men på fredag morgon har hon fjärilar i magen. Händerna skakar och munnen är torr. ”Jag kan inte”, viskar hon till sin kompis Malik.",
      "Malik tänker en stund. ”Titta bara på mig när du sjunger”, säger han. ”Låtsas att det bara är vi två.”",
      "När det blir Ellas tur går hon upp på scenen. Hon letar efter Malik och hittar honom längst fram. Hon tittar på honom och börjar sjunga.",
      "Efteråt klappar alla händerna länge. Ella ler hela vägen hem.",
    ],
    q: [
      ["När är talangshowen?", ["På fredag", "På måndag", "På lördag", "På onsdag"], "fakta"],
      ["Hur länge har Ella övat?", ["I flera veckor", "I en dag", "I ett helt år", "I en timme"], "fakta"],
      ["Ella har fjärilar i magen. Vad betyder det?", ["Hon är nervös", "Hon är hungrig", "Hon har ätit något konstigt", "Hon är lugn och glad"], "ordforstaelse"],
      ["Vad säger Malik att Ella ska göra?", ["Titta på honom", "Blunda hela tiden", "Sjunga en annan sång", "Gå hem och vila"], "fakta"],
      ["Varför hjälper det Ella att titta på Malik?", ["Hon känner sig tryggare", "Han håller upp en lapp med texten", "Han sjunger med henne", "Han står närmast lampan"], "mellan_raderna"],
      ["Hur går det för Ella till sist?", ["Det går bra", "Hon glömmer texten", "Hon vågar inte sjunga", "Malik sjunger i stället"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-sixten-rymmer", title: "Sixten följer nosen", textType: "story", topic: "djur",
    body: [
      "Det är lördag och familjen Berg ska äta frukost i trädgården. Plötsligt ser Saga att grinden står öppen. Hunden Sixten är borta!",
      "Saga och pappa springer ut på gatan. De ropar och visslar, men ingen hund kommer.",
      "Då känner Saga en god lukt. Det luktar grillad korv. Lukten kommer från huset längre bort, där grannen Åke bor.",
      "De går dit och tittar över staketet. Där sitter Sixten bredvid grillen och viftar på svansen. Åke skrattar. ”Han har redan fått två korvar”, säger han.",
      "Pappa suckar. ”Nu ska vi laga grinden”, säger han.",
    ],
    q: [
      ["Var ska familjen äta frukost?", ["I trädgården", "I köket", "Hos grannen", "På en bänk i parken"], "fakta"],
      ["Hur kom Sixten ut?", ["Grinden stod öppen", "Han grävde under staketet", "Han hoppade över staketet", "Någon släppte ut honom"], "fakta"],
      ["Vad luktar det?", ["Grillad korv", "Nybakat bröd", "Varma pannkakor", "Stekt fisk"], "fakta"],
      ["Hur hittade Sixten till Åkes trädgård?", ["Han följde lukten", "Han hörde Åke ropa på honom", "Han kände igen vägen", "Saga visade honom"], "mellan_raderna"],
      ["Sixten viftar på svansen. Hur mår han?", ["Han är glad", "Han är rädd", "Han är sjuk", "Han är arg"], "ordforstaelse"],
      ["Varför vill pappa laga grinden?", ["Så att Sixten inte rymmer igen", "Så att grannen blir glad", "För att den är ful", "För att grannen Åke bad dem om det"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-mormors-glasogon", title: "Mormors glasögon", textType: "story", topic: "roliga situationer",
    body: [
      "Mormor ska läsa en saga för Hugo. Hon sätter sig i den stora fåtöljen och öppnar boken. Men sedan stänger hon den igen.",
      "”Var är mina glasögon?” säger hon. ”Utan dem kan jag inte läsa.”",
      "Hugo hjälper till att leta. Han tittar i köket och i hallen. Han letar i mormors väska och under kuddarna i soffan. Glasögonen finns ingenstans.",
      "Då vänder sig Hugo om och tittar på mormor. Han börjar fnissa. Glasögonen sitter uppe på hennes huvud!",
      "Mormor känner efter med handen. Sedan skrattar hon så att hela fåtöljen skakar.",
    ],
    q: [
      ["Vad ska mormor göra?", ["Läsa en saga", "Baka en kaka", "Sticka en tröja", "Titta på tv"], "fakta"],
      ["Var sätter sig mormor?", ["I den stora fåtöljen", "I soffan i vardagsrummet", "Vid köksbordet", "På sängen"], "fakta"],
      ["Var letar Hugo först?", ["I köket", "I trädgården", "I badrummet", "I mormors bil"], "fakta"],
      ["Hugo börjar fnissa. Vad gör han?", ["Skrattar tyst", "Gråter lite", "Nyser högt", "Visslar en låt"], "ordforstaelse"],
      ["Var är glasögonen?", ["På mormors huvud", "I mormors väska", "Under en kudde", "I bokhyllan"], "fakta"],
      ["Varför skrattar mormor till sist?", ["Glasögonen var där hela tiden", "Hugo kittlar henne under foten", "Sagan i boken är så rolig", "Fåtöljen gör ett konstigt ljud"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-strommen-gick", title: "När lamporna slocknade", textType: "story", topic: "vardag",
    body: [
      "Det är en mörk kväll i november. Det blåser hårt ute. Plötsligt slocknar alla lampor i huset. Tv:n blir svart och kylskåpet slutar brumma.",
      "”Strömmen har gått”, säger mamma. Hon hämtar en ficklampa och tänder några ljus på bordet.",
      "Först tycker Leo att det är tråkigt. Han kan inte spela på datorn. Men sedan tar mamma fram ett gammalt kortspel. De spelar och äter kakor i ljusets sken. Lillasyster Ida vinner tre gånger.",
      "Efter två timmar tänds lamporna igen. ”Åh nej”, säger Leo. ”Kan vi inte spela lite till?”",
    ],
    q: [
      ["Vilken månad är det?", ["November", "Juli", "April", "Mars"], "fakta"],
      ["Vad händer med kylskåpet?", ["Det slutar brumma", "Det börjar läcka", "Dörren går upp", "Det blir varmt direkt"], "fakta"],
      ["Strömmen har gått. Vad betyder det?", ["Det finns ingen el i huset", "Vattnet i kranen är avstängt", "Någon har gått ut", "Det har slutat blåsa"], "ordforstaelse"],
      ["Vem vinner tre gånger?", ["Ida", "Leo", "Mamma", "Pappa"], "fakta"],
      ["Hur länge är strömmen borta?", ["Två timmar", "Tio minuter", "En hel natt", "Fem dagar"], "fakta"],
      ["Vad gjorde nog att strömmen gick?", ["Den hårda blåsten", "Att Leo spelade för mycket", "Att mamma tände ljus", "Att Ida vann i kortspelet"], "mellan_raderna"],
      ["Hur har Leo ändrat sig till sist?", ["Han vill fortsätta spela kort", "Han är arg på mamma", "Han vill gå och lägga sig direkt", "Han vill spela på datorn"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-hopprepet", title: "Femtio hopp i rad", textType: "story", topic: "sport",
    body: [
      "På rasterna hoppar alla i klass 3 hopprep. Den som klarar femtio hopp i rad får skriva sitt namn på en lista vid dörren.",
      "Amir har försökt många gånger. Han kommer alltid till tjugo. Sedan trasslar repet in sig i hans fötter.",
      "En dag ger hans storasyster ett tips. ”Hoppa lågt och snurra repet med handlederna, inte med hela armarna.”",
      "Amir tränar hemma på gården varje kväll. Först går det sämre. Men efter en vecka klarar han trettio, sedan fyrtio.",
      "På fredagens rast räknar hela klassen högt. ”… fyrtioåtta, fyrtionio, femtio!” Amir skriver sitt namn på listan med stora bokstäver.",
    ],
    q: [
      ["Vad får man göra om man klarar femtio hopp?", ["Skriva namnet på en lista", "Få en guldmedalj av rektorn", "Gå först i kön till lunchen", "Välja lek på nästa idrottslektion"], "fakta"],
      ["Hur många hopp klarar Amir i början?", ["Tjugo", "Tio", "Femtio", "Fem"], "fakta"],
      ["Vem ger Amir ett tips?", ["Hans storasyster", "Hans lärare", "Hans pappa", "Hans bästa kompis"], "fakta"],
      ["Repet trasslar in sig i fötterna. Vad betyder det?", ["Repet fastnar runt fötterna", "Repet går sönder", "Repet blir för långt", "Repet flyger iväg"], "ordforstaelse"],
      ["Varför går det sämre först när Amir tränar?", ["Han hoppar på ett nytt sätt", "Repet hemma är för kort för honom", "Gården är alldeles hal av is", "Han är förkyld hela veckan"], "mellan_raderna"],
      ["Vad visar texten?", ["Den som övar blir bättre", "Man ska ge upp om det är svårt", "Hopprep är bara för stora barn", "Det går bäst att hoppa högt"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-fel-namn-tartan", title: "Grattis, Stina!", textType: "story", topic: "roliga situationer",
    body: [
      "Tina fyller åtta år. Pappa har beställt en tårta från bageriet. Den ska vara rosa med jordgubbar på.",
      "När pappa kommer hem med kartongen samlas alla runt bordet. Tina lyfter försiktigt på locket. Tårtan är rosa och fin. Men med vit glasyr står det: ”Grattis, Stina!”",
      "Pappa blir alldeles röd i ansiktet. ”Bagaren måste ha hört fel i telefonen”, säger han.",
      "Tina tittar på tårtan en stund. Sedan tar hon en jordgubbe och lägger den över bokstaven S. ”Nu står det rätt”, säger hon.",
      "Alla skrattar, och sedan sjunger de för Tina.",
    ],
    q: [
      ["Hur många år fyller Tina?", ["Åtta år", "Sju år", "Nio år", "Tio år"], "fakta"],
      ["Var har pappa beställt tårtan?", ["På bageriet", "Hos en kompis", "I affären på torget", "Hos mormor"], "fakta"],
      ["Vad står det på tårtan?", ["Grattis, Stina!", "Grattis, Tina!", "Grattis på dagen!", "Hurra för dig!"], "fakta"],
      ["Tina lyfter försiktigt på locket. Hur gör hon?", ["Lugnt och varsamt", "Snabbt och slarvigt", "Med båda fötterna", "Med en stor kniv"], "ordforstaelse"],
      ["Varför blir pappa röd i ansiktet?", ["Han skäms över misstaget", "Han har sprungit hem från bageriet", "Han är förkyld och har feber", "Tårtan är för tung att bära"], "mellan_raderna"],
      ["Hur löser Tina problemet?", ["Hon lägger en jordgubbe över S:et", "Hon skrapar bort glasyren", "Hon byter namn till Stina", "Hon ringer till bageriet"], "fakta"],
      ["Vad tycker Tina om misstaget?", ["Hon tar det med ett skratt", "Hon blir jättearg på pappa", "Hon vill inte äta tårtan", "Hon blir ledsen och gråter"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-nya-grannen", title: "Ord på papper", textType: "story", topic: "relationer",
    body: [
      "I huset bredvid har en ny familj flyttat in. De kommer från ett annat land. Deras dotter heter Lina och är lika gammal som Wilma.",
      "Wilma vill gärna leka. Men Lina kan inte så mycket svenska än, och Wilma kan inte Linas språk.",
      "Då hämtar Wilma papper och kritor. Hon ritar en boll och pekar ut mot gården. Lina ler och nickar. Sedan ritar Lina en katt och pekar på sig själv. Hon har en katt hemma!",
      "Varje dag lär de sig nya ord av varandra. Efter en månad kan de prata om nästan allt.",
    ],
    q: [
      ["Var bor den nya familjen?", ["I huset bredvid", "På andra sidan stan", "I samma lägenhet", "Långt ut på landet"], "fakta"],
      ["Varför är det svårt för flickorna att prata?", ["De kan inte samma språk", "Lina är för blyg för att prata", "Wilma har ont i halsen", "Deras föräldrar säger nej"], "fakta"],
      ["Vad ritar Wilma?", ["En boll", "En katt", "Ett hus", "En sol"], "fakta"],
      ["Vad vill Wilma säga när hon pekar mot gården?", ["Ska vi leka ute?", "Jag har tappat min boll", "Gården är för liten", "Vi får inte vara ute"], "mellan_raderna"],
      ["Lina ler och nickar. Vad menar hon?", ["Ja, gärna!", "Nej tack", "Jag förstår inte", "Jag är trött"], "ordforstaelse"],
      ["Vad har Lina hemma?", ["En katt", "En hund", "En kanin", "En fågel"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur två barn blir vänner", "Hur man ritar djur", "En familj som flyttar bort", "En katt som försvinner"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-ljuset-i-kojan", title: "Ljuset i trädkojan", textType: "story", topic: "mysterier",
    body: [
      "Det är sent på kvällen. Ebba ska just somna när hon ser något genom fönstret. Uppe i trädkojan i trädgården lyser ett litet ljus. Det rör sig fram och tillbaka.",
      "Ebba blir rädd. Vem är där ute så här sent? Hon smyger in till sin storebror Viktor, men hans säng är tom.",
      "Ebba tar på sig stövlarna och går ut. Hon klättrar upp för stegen och tittar in. Där ligger Viktor med en ficklampa och en tjock bok.",
      "”Boken var så spännande”, viskar han. ”Jag ville inte väcka dig med lampan.”",
    ],
    q: [
      ["När ser Ebba ljuset?", ["Sent på kvällen", "Tidigt på morgonen", "Mitt på dagen", "Direkt efter skolan"], "fakta"],
      ["Var lyser ljuset?", ["I trädkojan", "I garaget", "Hos grannen", "I köket"], "fakta"],
      ["Ebba smyger in till Viktor. Hur går hon?", ["Tyst och försiktigt", "Snabbt och högljutt", "Baklänges", "Hoppande på ett ben"], "ordforstaelse"],
      ["Vad har Viktor med sig?", ["En ficklampa och en bok", "En kudde och en filt", "En kikare och en karta", "Ett ljus och en tändsticksask"], "fakta"],
      ["Varför läser Viktor i trädkojan och inte i sitt rum?", ["Han vill inte väcka Ebba", "Det är varmare där ute", "Han gömmer sig för mamma", "Lampan i rummet är trasig"], "mellan_raderna"],
      ["Hur känner sig Ebba nog när hon ser Viktor?", ["Lättad", "Ännu mer rädd", "Sur på mamma", "Avundsjuk på kojan"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-blota-laxan", title: "Läxan som badade", textType: "story", topic: "skola",
    body: [
      "Jonas har skrivit sin läxa om hästar. Den är fyra sidor lång och har fina bilder. Han är mycket stolt.",
      "På väg till skolan regnar det. Jonas hoppar över en vattenpöl, men då öppnas väskan. Läxan flyger ut och landar mitt i pölen.",
      "Jonas lyfter upp papperen. De är blöta och färgerna har runnit ut. Han vill gråta.",
      "I klassrummet berättar han för läraren Karin. Hon tar fram en hårtork och torkar papperen försiktigt. De blir skrynkliga, men det går att läsa.",
      "”Den här läxan har till och med badat”, säger Karin och ler.",
    ],
    q: [
      ["Vad handlar Jonas läxa om?", ["Hästar", "Hundar", "Kor", "Katter"], "fakta"],
      ["Hur lång är läxan?", ["Fyra sidor", "En sida", "Tio sidor", "Två rader"], "fakta"],
      ["Varför ramlar läxan ut?", ["Väskan öppnas", "Jonas tappar den", "Det blåser hårt", "En hund tar den"], "fakta"],
      ["Färgerna har runnit ut. Vad betyder det?", ["Vattnet har fått färgerna att flyta", "Färgerna har blivit starkare", "Någon har målat över alla bilderna", "Bilderna har blivit större"], "ordforstaelse"],
      ["Varför vill Jonas gråta?", ["Han har jobbat hårt med läxan", "Han har slagit i knät", "Han har glömt sin mössa", "Han är rädd för regn"], "mellan_raderna"],
      ["Vad använder Karin för att torka papperen?", ["En hårtork", "En handduk", "Ett element", "Solen"], "fakta"],
      ["Hur är Karin mot Jonas?", ["Snäll och hjälpsam", "Arg och sträng", "Ointresserad och trött", "Sur och tyst"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-fyren", title: "Ön med fyren", textType: "story", topic: "äventyr",
    body: [
      "På sommarlovet åker Sam och morfar båt till en liten ö. På ön står en gammal fyr. Den är vit med ett rött band.",
      "”Förr bodde en fyrvaktare här”, berättar morfar. ”Han såg till att lampan lyste varje natt, så att båtarna inte körde på klipporna.”",
      "De klättrar upp för en smal trappa som snurrar runt och runt. Sam räknar stegen. Det är 98 steg!",
      "Högst upp blåser det. Sam ser ut över havet. På en klippa långt borta ligger något grått och blankt. Det är sälar som solar.",
      "”Det här är bästa dagen i sommar”, säger Sam.",
    ],
    q: [
      ["Hur kommer Sam och morfar till ön?", ["Med båt", "Med flyg", "De simmar", "Över en bro"], "fakta"],
      ["Hur ser fyren ut?", ["Vit med ett rött band", "Röd med vita prickar", "Grå med svarta ränder", "Helt blå"], "fakta"],
      ["Vad gjorde en fyrvaktare?", ["Såg till att lampan lyste", "Byggde stora båtar av trä", "Sålde fisk i hamnen", "Räknade sälar"], "ordforstaelse"],
      ["Hur många steg har trappan?", ["98", "89", "48", "198"], "fakta"],
      ["Varför var fyren viktig för båtarna?", ["Den varnade för klipporna", "Den visade vad klockan var", "Den gav båtarna bensin", "Den skrämde bort sälarna"], "mellan_raderna"],
      ["Vad ser Sam på klippan?", ["Sälar som solar", "Fåglar som bygger bo", "En båt som har sjunkit", "En gammal skattkista"], "fakta"],
      ["Hur tycker Sam att dagen har varit?", ["Jättebra", "Läskig", "Tråkig", "Jobbig"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-kycklingarna", title: "Pickandet i lådan", textType: "story", topic: "skola",
    body: [
      "Klass 2 har fått låna en äggkläckare. Det är en låda med glaslock som håller äggen varma. Inuti ligger sex ägg.",
      "Varje morgon vänder barnen försiktigt på äggen. Läraren Nadia skriver upp hur många dagar som har gått.",
      "På dag tjugoen hör Elsa ett litet pickande ljud. Det kommer inifrån ett ägg! Alla samlas runt lådan. En liten spricka blir större och större. Till slut kryper en blöt kyckling ut.",
      "”Den ser ju inte alls gullig ut”, säger Omar. Men nästa dag har kycklingen torkat. Nu är den gul och fluffig som en boll.",
    ],
    q: [
      ["Hur många ägg ligger i lådan?", ["Sex", "Tre", "Tio", "Tolv"], "fakta"],
      ["Vad är en äggkläckare?", ["En låda som håller äggen varma", "En sorts stekpanna", "Ett bo i ett träd", "En korg som man bär äggen hem i"], "ordforstaelse"],
      ["Vad gör barnen varje morgon?", ["Vänder på äggen", "Tvättar äggen", "Målar äggen", "Räknar kycklingarna"], "fakta"],
      ["Vilken dag hör Elsa ljudet?", ["Dag tjugoen", "Dag ett", "Dag tio", "Dag trettio"], "fakta"],
      ["Varför samlas alla runt lådan?", ["De vill se när ägget kläcks", "Nadia har ropat på dem från dörren", "Lådan har gått sönder", "Det är dags för lunch"], "mellan_raderna"],
      ["Varför tycker Omar att kycklingen inte ser gullig ut först?", ["Den är blöt", "Den är för stor", "Den är grön", "Den har inga ögon"], "mellan_raderna"],
      ["Hur har kycklingen ändrats till nästa dag?", ["Från blöt till fluffig", "Från liten till jättestor", "Från gul till svart", "Från glad till arg"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-dimman-pa-fjallet", title: "Stenhögarna i dimman", textType: "story", topic: "äventyr",
    body: [
      "Maja och hennes pappa vandrar i fjällen. Stigen går över kala berg utan träd. Här och där står små högar av stenar. ”De heter rösen”, säger pappa. ”De visar var stigen går.”",
      "Efter en stund kommer dimman. Den är tjock och grå som gröt. Maja ser knappt sina egna skor.",
      "”Nu gäller det att hålla ihop”, säger pappa. De går sakta från röse till röse. När de ser ett röse letar de efter nästa innan de går vidare.",
      "Efter en timme blir dimman tunnare. Där nere ligger stugan med rök ur skorstenen. Maja suckar av lättnad.",
    ],
    q: [
      ["Var vandrar Maja och pappa?", ["I fjällen", "I en tät skog", "Längs en strand", "Genom en stad"], "fakta"],
      ["Vad är ett röse?", ["En hög av stenar", "En sorts fjällblomma", "En liten stuga", "En karta över fjället"], "ordforstaelse"],
      ["Hur ser dimman ut?", ["Tjock och grå", "Tunn och vit", "Rosa och glittrig", "Svart som natten"], "fakta"],
      ["Varför letar de efter nästa röse innan de går vidare?", ["Så att de inte går vilse", "Så att de kan vila benen", "För att räkna stenarna", "För att leka en lek"], "mellan_raderna"],
      ["Hur länge går de i dimman?", ["En timme", "Tio minuter", "En hel dag", "Två dagar"], "fakta"],
      ["Maja suckar av lättnad. Hur känner hon sig?", ["Glad att det gick bra", "Ledsen och trött", "Arg på pappa", "Rädd för stugan"], "ordforstaelse"],
      ["Vad hjälpte dem mest att hitta rätt?", ["Rösena längs stigen", "En kompass i fickan", "En hund som visade vägen", "En mobil med karta"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-frukost-till-mamma", title: "Frukost på sängen", textType: "story", topic: "relationer",
    body: [
      "Mamma är sjuk och ligger i sängen. Hon har feber och ont i huvudet. Theo och lillasyster Nora vill göra något snällt.",
      "”Vi gör frukost till henne!” säger Theo. Han rostar bröd och brer på smör. Nora häller upp ett glas apelsinjuice. Lite hamnar på golvet, men hon torkar upp det.",
      "Sedan plockar Theo en maskros i trädgården och sätter den i en äggkopp. Allt ställer de på en bricka.",
      "Försiktigt bär de in brickan till mamma. Brödet är lite bränt i kanten. Men mamma ler stort. ”Det här är den finaste frukost jag har fått”, säger hon.",
    ],
    q: [
      ["Vad är det för fel på mamma?", ["Hon har feber", "Hon har brutit benet", "Hon är bara trött", "Hon har ont i magen"], "fakta"],
      ["Vad gör Nora?", ["Häller upp juice", "Rostar bröd", "Plockar en blomma", "Kokar ägg"], "fakta"],
      ["Vad sätter Theo i äggkoppen?", ["En maskros", "Ett ägg", "En sked", "En ros"], "fakta"],
      ["Vad är en bricka?", ["Något platt man bär mat på", "En sorts tallrik för soppa", "En liten korg med ett lock på", "En kopp"], "ordforstaelse"],
      ["Varför ler mamma fast brödet är bränt?", ["Barnen har varit omtänksamma", "Hon tycker bäst om bröd som är bränt i kanten", "Hon har inte sett det", "Hon är inte hungrig"], "mellan_raderna"],
      ["Vilket ord beskriver Theo och Nora bäst?", ["Omtänksamma", "Lata", "Busiga", "Elaka"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-ballongbrevet", title: "Lappen på ballongen", textType: "story", topic: "relationer",
    body: [
      "På Hannas kalas fick alla barn en ballong. Innan de släppte dem skrev de en lapp: ”Hej! Om du hittar den här, skriv till mig!” Under stod Hannas adress.",
      "De knöt fast lapparna och släppte ballongerna. Snart var de bara små prickar på himlen.",
      "Hanna väntade och väntade. Veckorna gick. Hon trodde att ingen hade hittat den.",
      "Men en dag kom ett brev med ett konstigt frimärke. Det var från en flicka i Finland! Hon hade hittat en röd ballong i skogen bakom sitt hus.",
      "Nu skriver Hanna och flickan brev till varandra varje månad.",
    ],
    q: [
      ["Vad fick barnen på kalaset?", ["En ballong var", "En godispåse var", "En bok var", "En leksaksbil var"], "fakta"],
      ["Vad stod det på lappen?", ["Skriv till mig!", "Grattis på födelsedagen!", "Kom på mitt kalas!", "Ta väl hand om ballongen!"], "fakta"],
      ["Ballongerna blev små prickar på himlen. Vad betyder det?", ["De var långt bort", "De gick sönder", "De blev prickiga", "De kom tillbaka"], "ordforstaelse"],
      ["Hur kände sig Hanna när veckorna gick?", ["Besviken", "Arg", "Rädd", "Stolt"], "mellan_raderna"],
      ["Var kom brevet ifrån?", ["Från Finland", "Från Norge", "Från Danmark", "Från Tyskland"], "fakta"],
      ["Varför var frimärket konstigt?", ["Det kom från ett annat land", "Det var målat för hand av flickan", "Det satt upp och ner", "Det var trasigt"], "mellan_raderna"],
      ["Vad blev det till sist av ballongen?", ["En ny brevvän", "En ny ballong", "Ett nytt kalas", "En resa till Finland"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n1-simmarket", title: "Tjugofem meter", textType: "story", topic: "sport",
    body: [
      "Leila ska ta simmärket. Hon måste simma tjugofem meter utan att stanna eller ta i kanten.",
      "Vid första försöket stannar hon efter halva bassängen. Hon blir trött i armarna och sväljer vatten.",
      "Simläraren Bosse ger henne ett råd. ”Du simmar för fort i början. Ta lugna tag och andas lugnt.”",
      "Varje lördag övar Leila. Hon räknar sina simtag i huvudet: ett, två, tre, andas.",
      "En lördag i mars försöker hon igen. Hon simmar lugnt hela vägen. När hon slår handen i kanten på andra sidan ropar Bosse: ”Grattis, du klarade det!”",
    ],
    q: [
      ["Hur långt måste Leila simma?", ["Tjugofem meter", "Tio meter", "Femtio meter", "Hundra meter"], "fakta"],
      ["Hur långt kommer hon första gången?", ["Halva bassängen", "Hela vägen", "Bara en meter", "Två varv"], "fakta"],
      ["Vilket råd ger Bosse?", ["Att simma lugnare", "Att simma ännu fortare", "Att sluta simma", "Att använda simdynor"], "fakta"],
      ["Vad är ett simtag?", ["En rörelse med armarna", "Ett hopp från startpallen", "En sorts badmössa", "En tävling i vattnet"], "ordforstaelse"],
      ["Varför blev Leila trött första gången?", ["Hon simmade för fort", "Vattnet var kallt", "Hon hade ätit för mycket", "Bassängen var djup"], "mellan_raderna"],
      ["När klarar hon det?", ["En lördag i mars", "En söndag i maj", "En fredag i juni", "En onsdag i april"], "fakta"],
      ["Vad hjälpte Leila mest?", ["Att hon övade och simmade lugnt", "Att hon fick nya och snabba simglasögon", "Att Bosse simmade bredvid", "Att vattnet var varmare"], "helhet_slutsats"],
    ],
  },
];
