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
];
