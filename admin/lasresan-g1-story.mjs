// ============================================================================
// Läsresan – källtexter för nivå 1, story (issue #521, epic #516)
// ----------------------------------------------------------------------------
// 15 story-texter, 30–50 ord, 3–4 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g1-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-1.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-g1-pennan", title: "Var är pennan?", textType: "story", topic: "skola",
    body: [
      "Adil sitter i skolan. Han ska skriva. Men var är pennan?",
      "Adil tittar i lådan. Ingen penna. Han tittar under bänken. Ingen penna där heller.",
      "Fröken ler. ”Känn bakom ditt öra”, säger hon.",
      "Där sitter pennan! Adil skrattar. Nu kan han skriva.",
    ],
    q: [
      ["Var är Adil?", ["I skolan", "I parken", "Hemma", "I affären"], "fakta"],
      ["Var tittar Adil först?", ["I lådan", "Under bänken", "I väskan", "På golvet"], "fakta"],
      ["Var sitter pennan?", ["Bakom örat", "I lådan", "Under bänken", "I hans hand"], "fakta"],
      ["Vad gör Adil när han hittar pennan?", ["Han skrattar", "Han gråter", "Han springer", "Han somnar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-lashunden", title: "Hunden som lyssnar", textType: "story", topic: "skola",
    body: [
      "I dag kommer en hund till skolan. Hunden heter Lola. Hon är brun och mjuk.",
      "Lola ligger på en filt. Noor sätter sig bredvid. Noor läser en bok för Lola.",
      "Lola lyssnar. Hon skäller inte. Hon viftar på svansen.",
      "Noor tycker om att läsa för Lola.",
    ],
    q: [
      ["Vad heter hunden?", ["Lola", "Fia", "Doris", "Tessan"], "fakta"],
      ["Var ligger Lola?", ["På en filt", "I en korg", "På en stol", "Under bordet"], "fakta"],
      ["Vad gör Noor?", ["Läser en bok", "Ritar en bild", "Sjunger en sång", "Kastar en boll"], "fakta"],
      ["Vad gör Lola med svansen?", ["Viftar med den", "Gömmer den", "Biter i den", "Håller den still"], "fakta"],
    ],
  },
  {
    id: "lr-g1-ny-kompis", title: "En ny kompis", textType: "story", topic: "relationer",
    body: [
      "Elmer sitter i sandlådan. Han är ensam. Han gräver med en spade.",
      "En flicka kommer fram. Hon heter Sana.",
      "”Får jag vara med?” frågar Sana.",
      "”Ja!” säger Elmer.",
      "De bygger ett slott av sand. Slottet blir stort. Elmer är glad. Nu har han en ny kompis.",
    ],
    q: [
      ["Var sitter Elmer?", ["I sandlådan", "På gungan", "I bilen", "Vid bordet"], "fakta"],
      ["Vad heter flickan?", ["Sana", "Sara", "Siri", "Sofi"], "fakta"],
      ["Vad bygger de av sand?", ["Ett slott", "Ett torn", "En koja", "En bro"], "fakta"],
      ["Hur känner sig Elmer på slutet?", ["Glad", "Arg", "Trött", "Rädd"], "fakta"],
    ],
  },
  {
    id: "lr-g1-tornet", title: "Tornet ramlar", textType: "story", topic: "relationer",
    body: [
      "Lukas bygger ett torn av klossar. Tornet är högt. Det är blått och gult.",
      "Lillebror Theo kryper fram. Han tar en kloss. Bom! Tornet ramlar.",
      "Lukas blir arg.",
      "”Förlåt”, säger Theo.",
      "Då ler Lukas. De bygger ett nytt torn. Nu bygger de tillsammans.",
    ],
    q: [
      ["Vad bygger Lukas?", ["Ett torn", "En bil", "Ett hus", "En bro"], "fakta"],
      ["Vilka färger har tornet?", ["Blått och gult", "Rött och vitt", "Grönt och svart", "Rosa och lila"], "fakta"],
      ["Vad säger Theo?", ["Förlåt", "Hej då", "Tack", "God natt"], "fakta"],
      ["Vad gör Lukas när Theo säger förlåt?", ["Han ler", "Han gråter", "Han går hem", "Han somnar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-hopprepet", title: "Tio hopp", textType: "story", topic: "sport",
    body: [
      "Elif har ett nytt hopprep. Det är rosa.",
      "Hon hoppar ett hopp. Sedan två. Sedan trasslar hon in sig.",
      "Elif försöker igen. Och igen. Och igen.",
      "Till slut klarar hon tio hopp i rad!",
      "”Titta, mamma!” ropar Elif. Mamma klappar i händerna.",
    ],
    q: [
      ["Vilken färg har hopprepet?", ["Rosa", "Blått", "Gult", "Grönt"], "fakta"],
      ["Hur många hopp klarar Elif till slut?", ["Tio", "Två", "Fem", "Tjugo"], "fakta"],
      ["Vad gör mamma?", ["Klappar i händerna", "Hoppar med Elif", "Ropar på pappa", "Hämtar ett nytt rep"], "fakta"],
    ],
  },
  {
    id: "lr-g1-forsta-malet", title: "Bollen går in", textType: "story", topic: "sport",
    body: [
      "Zakaria spelar fotboll. Han har gröna skor.",
      "Han har aldrig gjort mål. Men i dag får han bollen.",
      "Zakaria springer. Han sparkar hårt.",
      "Bollen flyger. Den går in i målet!",
      "Alla i laget jublar. Zakaria jublar mest. Det är hans första mål.",
    ],
    q: [
      ["Vilken färg har Zakarias skor?", ["Gröna", "Röda", "Vita", "Svarta"], "fakta"],
      ["Vad gör Zakaria med bollen?", ["Sparkar hårt", "Kastar den", "Tar upp den", "Ger bort den"], "fakta"],
      ["Vem jublar mest?", ["Zakaria", "Tränaren", "Mamma", "Målvakten"], "fakta"],
      ["Vilket mål är det för Zakaria?", ["Hans första", "Hans andra", "Hans tionde", "Hans sista"], "fakta"],
    ],
  },
  {
    id: "lr-g1-draken", title: "Draken i parken", textType: "story", topic: "vardag",
    body: [
      "Det blåser i parken. Ibrahim har en drake. Draken är röd. Den har en lång svans.",
      "Pappa håller i snöret. Ibrahim springer.",
      "Draken lyfter! Den flyger högt, högt upp.",
      "Nu får Ibrahim hålla snöret. Han håller hårt. Draken dansar i vinden.",
    ],
    q: [
      ["Var är Ibrahim?", ["I parken", "På stranden", "I skolan", "I skogen"], "fakta"],
      ["Hur ser draken ut?", ["Röd med lång svans", "Blå med små prickar", "Gul och fyrkantig", "Grön och mycket liten"], "fakta"],
      ["Vem håller snöret först?", ["Pappa", "Mamma", "Ibrahim", "Farfar"], "fakta"],
    ],
  },
  {
    id: "lr-g1-bullarna", title: "Bullar med farmor", textType: "story", topic: "vardag",
    body: [
      "Alice är hos farmor. De ska baka bullar.",
      "Alice häller mjöl i skålen. Farmor tar i smör och socker.",
      "De knådar degen. Sedan rullar de små bullar.",
      "Bullarna åker in i ugnen. Snart luktar det gott i hela köket.",
      "Alice äter en bulle. Den är varm.",
    ],
    q: [
      ["Var är Alice?", ["Hos farmor", "I skolan", "Hos en kompis", "På ett kafé"], "fakta"],
      ["Vad häller Alice i skålen?", ["Mjöl", "Mjölk", "Socker", "Vatten"], "fakta"],
      ["Hur är bullen som Alice äter?", ["Varm", "Kall", "Bränd", "Hård"], "fakta"],
    ],
  },
  {
    id: "lr-g1-kakorna", title: "Vem tog kakorna?", textType: "story", topic: "mysterier",
    body: [
      "Mamma har bakat kakor. De ligger på ett fat.",
      "Emir går ut och leker. När han kommer in är kakorna borta!",
      "Vem har tagit dem? Emir letar.",
      "Då ser han lillasyster Diana. Hon har smulor på tröjan. Och choklad runt munnen!",
      "Diana fnissar. Det var hon som tog kakorna.",
    ],
    q: [
      ["Var ligger kakorna?", ["På ett fat", "I en burk", "I en låda", "På golvet"], "fakta"],
      ["Vad har Diana på tröjan?", ["Smulor", "Färg", "Sand", "Vatten"], "fakta"],
      ["Vem tog kakorna?", ["Diana", "Emir", "Mamma", "Pappa"], "fakta"],
      ["Vad har Diana runt munnen?", ["Choklad", "Sylt", "Glass", "Mjölk"], "fakta"],
    ],
  },
  {
    id: "lr-g1-skapet", title: "Ett ljud i skåpet", textType: "story", topic: "mysterier",
    body: [
      "Nadia ska gå och lägga sig. Då hör hon ett ljud.",
      "Bzz, bzz! Ljudet kommer från skåpet.",
      "Nadia blir rädd. Är det ett monster?",
      "Hon hämtar mamma. Mamma öppnar skåpet.",
      "Där ligger mammas mobil. Den surrar i en jacka.",
      "Nadia och mamma skrattar.",
    ],
    q: [
      ["Varifrån kommer ljudet?", ["Från skåpet", "Från fönstret", "Från sängen", "Från taket"], "fakta"],
      ["Hur känner sig Nadia när hon hör ljudet?", ["Rädd", "Glad", "Trött", "Arg"], "fakta"],
      ["Vem hämtar Nadia?", ["Mamma", "Pappa", "Sin bror", "Mormor"], "fakta"],
      ["Vad är det som surrar?", ["Mammas mobil", "En stor fluga", "En klocka", "En leksak"], "fakta"],
    ],
  },
  {
    id: "lr-g1-burken", title: "Burken i jorden", textType: "story", topic: "äventyr",
    body: [
      "Aron gräver i trädgården. Han ska plantera en blomma.",
      "Plötsligt tar spaden i något hårt. Aron gräver mer.",
      "Det är en gammal burk! Den är brun av rost.",
      "Aron öppnar locket. I burken ligger kulor. Blå, gröna och gula kulor.",
      "”En skatt!” ropar Aron.",
    ],
    q: [
      ["Var gräver Aron?", ["I trädgården", "På stranden", "I skogen", "I sandlådan"], "fakta"],
      ["Vad hittar Aron?", ["En gammal burk", "En gammal sko", "En stor sten", "En liten nyckel"], "fakta"],
      ["Vad ligger i burken?", ["Kulor", "Pengar", "Ett brev", "En ring"], "fakta"],
      ["Vad ropar Aron?", ["En skatt!", "Hjälp!", "Titta, mamma!", "Kom hit!"], "fakta"],
    ],
  },
  {
    id: "lr-g1-barkbaten", title: "Båten i bäcken", textType: "story", topic: "äventyr",
    body: [
      "Bella har gjort en båt av bark. Seglet är ett löv.",
      "Hon sätter båten i bäcken. Båten flyter iväg. Den åker fort!",
      "Bella springer efter. Nu ser hon inte båten.",
      "Vid bron stannar hon. Där sitter båten fast i gräset.",
      "Bella tar upp sin båt. Hon är glad igen.",
    ],
    q: [
      ["Vad är båten gjord av?", ["Bark", "Papper", "Plast", "Sten"], "fakta"],
      ["Vad är seglet?", ["Ett löv", "En lapp", "En vante", "En fjäder"], "fakta"],
      ["Var hittar Bella båten?", ["Vid bron", "Vid sjön", "I ett träd", "Hemma"], "fakta"],
    ],
  },
  {
    id: "lr-g1-ballongen", title: "Den röda ballongen", textType: "story", topic: "äventyr",
    body: [
      "Sami har en röd ballong. Han fick den på kalaset.",
      "Men snöret glider ur handen. Ballongen flyger iväg!",
      "Den fastnar i ett träd. Sami når inte upp.",
      "Grannen Lisbet kommer med en stege. Hon klättrar upp.",
      "Nu har Sami sin ballong igen. Han håller hårt.",
    ],
    q: [
      ["Vilken färg har ballongen?", ["Röd", "Blå", "Gul", "Grön"], "fakta"],
      ["Var fick Sami ballongen?", ["På kalaset", "I affären", "I skolan", "Av mormor"], "fakta"],
      ["Var fastnar ballongen?", ["I ett träd", "På taket", "I en buske", "På en lampa"], "fakta"],
      ["Vad har grannen med sig?", ["En stege", "En pinne", "En stol", "En hink"], "fakta"],
    ],
  },
  {
    id: "lr-g1-mossan", title: "Var är mössan?", textType: "story", topic: "roliga situationer",
    body: [
      "Det har snöat. Elvin bygger en snögubbe. Den får en morot till näsa.",
      "Inne letar pappa. ”Var är min mössa?” frågar han.",
      "Pappa letar i hallen. Han letar i köket.",
      "Sedan tittar pappa ut. Snögubben har en röd mössa. Det är pappas mössa!",
    ],
    q: [
      ["Vad bygger Elvin?", ["En snögubbe", "En koja", "En borg", "En igloo"], "fakta"],
      ["Vad får snögubben till näsa?", ["En morot", "En sten", "En pinne", "En kotte"], "fakta"],
      ["Vad letar pappa efter?", ["Sin mössa", "Sin vante", "Sin halsduk", "Sina skor"], "fakta"],
      ["Var är pappas mössa?", ["På snögubben", "I hallen", "I köket", "På pappa"], "fakta"],
    ],
  },
  {
    id: "lr-g1-hunden-badar", title: "Plask!", textType: "story", topic: "roliga situationer",
    body: [
      "Hassan är vid sjön. Hunden Tusse är också med.",
      "Alla sitter på bryggan och äter glass.",
      "Plötsligt springer Tusse. Han hoppar rakt i sjön. Plask!",
      "Vattnet stänker på alla. Mamma blir blöt. Hassans glass blir blöt.",
      "Tusse simmar och ser glad ut. Alla skrattar.",
    ],
    q: [
      ["Var är Hassan?", ["Vid sjön", "I parken", "I skolan", "I skogen"], "fakta"],
      ["Vad heter hunden?", ["Tusse", "Bobo", "Lajka", "Rex"], "fakta"],
      ["Vad äter de på bryggan?", ["Glass", "Bullar", "Äpplen", "Kakor"], "fakta"],
      ["Hur ser Tusse ut när han simmar?", ["Glad", "Rädd", "Arg", "Trött"], "fakta"],
    ],
  },
];
