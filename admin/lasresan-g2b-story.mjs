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
];
