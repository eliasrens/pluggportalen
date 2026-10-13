// ============================================================================
// Läsresan – källtexter för nivå 5 del b, story (issue #665)
// ----------------------------------------------------------------------------
// 20 berättelser, 80–140 ord, 7 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-n2b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-5-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-n2-repliken", title: "Kungen som glömde", textType: "story", topic: "skola",
    body: [
      "Klass 3A ska spela teater för föräldrarna. Ebba är kungen. Hon har bara fyra repliker, men hon har övat på dem varje kväll.",
      "När ridån går upp är salen full. Ebba ser mamma längst fram. Mamma vinkar och håller upp telefonen.",
      "Sedan är det Ebbas tur. Hon öppnar munnen, men ingenting kommer ut. Huvudet är alldeles tomt. Det blir tyst i salen.",
      "Då ser hon draken, alltså Jamal, som står och väntar. Ebba tar ett djupt andetag.",
      "”Du där, drake!” säger hon med hög röst. ”Varför har du ätit upp all min glass?”",
      "Publiken skrattar. Jamal hänger med direkt. ”Förlåt, ers majestät. Det var så varmt i dag.”",
      "Efteråt kommer läraren fram till Ebba. ”Det stod inte i manuset”, säger han. ”Men det blev kvällens bästa scen.”",
    ],
    q: [
      ["Vem spelar Ebba i teatern?", ["Kungen", "Draken", "Drottningen", "Riddaren"], "fakta"],
      ["Hur har Ebba övat på sina repliker?", ["Varje kväll", "Bara på lektionerna", "Med Jamal på rasterna", "Varje morgon före skolan"], "fakta"],
      ["Ebba har fyra repliker. Vad är en replik?", ["Något som en person säger i en pjäs", "En dräkt som man har på scenen", "En sång som alla sjunger tillsammans", "En plats där skådespelarna står"], "ordforstaelse"],
      ["Varför blir det tyst i salen?", ["Ebba har glömt vad hon ska säga", "Ljuset på scenen slocknar", "Publiken har somnat", "Jamal har gått av scenen"], "mellan_raderna"],
      ["Vad säger Ebba att draken har ätit upp?", ["Hennes glass", "Hennes tårta", "Hennes kakor", "Hennes kronor"], "fakta"],
      ["Vad gör Jamal när Ebba säger något nytt?", ["Hänger med direkt", "Springer av scenen", "Börjar skratta", "Viskar rätt ord till henne"], "fakta"],
      ["Vad visar texten om Ebba?", ["Hon klarar sig fast hon glömmer", "Hon tycker inte om att spela teater", "Hon ville hellre spela draken", "Hon övade inte alls hemma"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-bokbytet", title: "Boken med det gråa omslaget", textType: "story", topic: "skola",
    body: [
      "I Noahs klass har de bokbyte. Alla tar med en bok hemifrån och lägger den på ett bord. Sedan drar man en lapp med ett nummer och får välja i tur och ordning.",
      "Noah får nummer tjugo. Han är sist. På bordet ligger bara en tunn bok med ett grått omslag kvar. Den heter ”Fyren”. Noah suckar.",
      "Hemma lägger han boken på golvet bredvid sängen. Där ligger den i tre dagar.",
      "En kväll är surfplattan urladdad. Noah har tråkigt, så han öppnar boken. Den handlar om en pojke som är ensam i en fyr under en storm.",
      "Plötsligt ropar pappa att det är dags att släcka. Noah har redan läst halva boken.",
      "”Fem minuter till”, säger han. ”Bara tills stormen är över.”",
    ],
    q: [
      ["Vad tar alla med sig till bokbytet?", ["En bok hemifrån", "En lapp med sitt namn", "En tidning från biblioteket", "Ett spel som de har tröttnat på"], "fakta"],
      ["Vilket nummer får Noah?", ["Tjugo", "Två", "Tolv", "Femton"], "fakta"],
      ["Hur ser boken ut?", ["Tunn med ett grått omslag", "Tjock med ett rött omslag", "Stor med många bilder", "Liten med guldiga bokstäver"], "fakta"],
      ["Varför suckar Noah när han ser boken?", ["Han tror att den är tråkig", "Han har redan läst den", "Han ville vara först i kön", "Han tycker inte om fyrar"], "mellan_raderna"],
      ["Varför öppnar Noah boken till slut?", ["Han har tråkigt", "Pappa säger att han måste", "Läraren ska ha ett förhör", "Han vill titta på bilderna"], "fakta"],
      ["Surfplattan är urladdad. Vad betyder urladdad?", ["Det finns ingen ström kvar", "Skärmen har gått sönder", "Den är borttappad", "Den är för gammal"], "ordforstaelse"],
      ["Vad lär sig Noah?", ["En bok kan vara bättre än den ser ut", "Det är bäst att få välja bok allra först", "Det är farligt att bo i en fyr", "Det är tråkigt att läsa på kvällen"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-orienteringen", title: "Kontrollen bakom stenen", textType: "story", topic: "sport",
    body: [
      "Vera och Liv springer orientering för första gången. De får en karta och en kompass. På kartan finns åtta ringar. I varje ring står en kontroll, alltså en orange och vit skärm som man ska hitta.",
      "De första kontrollerna hittar de snabbt. Men den femte är svår. Kartan visar en stor sten vid en myr. Flickorna springer runt och letar. Ingen kontroll syns.",
      "”Vi ger upp”, säger Liv.",
      "Vera tittar på kartan igen. Hon vrider den så att norr på kartan pekar åt samma håll som kompassnålen. Då förstår hon. Stenen ligger på andra sidan myren!",
      "Bakom stenen hänger skärmen. Vera stämplar kortet.",
      "Flickorna kommer i mål sist av alla. Men de har hittat alla åtta kontroller, och de ler hela vägen hem.",
    ],
    q: [
      ["Vad får Vera och Liv i början?", ["En karta och en kompass", "En klocka och en karta", "En kompass och en ficklampa", "En lapp som visar vägen"], "fakta"],
      ["Hur många kontroller finns på kartan?", ["Åtta", "Fem", "Sex", "Tolv"], "fakta"],
      ["Vad är en kontroll i texten?", ["En skärm som man ska hitta", "En vakt som kollar biljetter", "En karta över hela skogen", "En tävling för vuxna"], "ordforstaelse"],
      ["Vilken kontroll är svår att hitta?", ["Den femte", "Den första", "Den sista", "Den andra"], "fakta"],
      ["Vad gör Vera med kartan?", ["Vrider den åt rätt håll", "Viker ihop den", "Ger den till Liv", "Lägger den i fickan och springer"], "fakta"],
      ["Varför hittade de inte kontrollen först?", ["De letade på fel sida av myren", "Kontrollen hade blåst bort", "Liv hade tappat kompassen", "Det var för mörkt i skogen"], "mellan_raderna"],
      ["Vad är viktigast för flickorna i slutet?", ["Att de hittade allt", "Att de kom först i mål", "Att de fick var sin medalj", "Att tävlingen äntligen var slut"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-klattervaggen", title: "Högst upp på väggen", textType: "story", topic: "sport",
    body: [
      "Hugo står längst ner vid klätterväggen. Han har en sele på sig. Ett rep går från selen upp till taket och ner till hans storasyster Maja, som håller i andra änden.",
      "”Jag har dig”, säger Maja. ”Om du släpper, så faller du inte.”",
      "Hugo börjar klättra. Han sätter fötterna på de färgade greppen och sträcker sig uppåt. Halvvägs upp tittar han ner. Golvet ser långt bort. Benen börjar skaka.",
      "”Titta inte ner! Titta på nästa grepp”, ropar Maja.",
      "Hugo gör som hon säger, ett grepp i taget. Snart når han den röda knappen högst upp. Han slår på den så att det ekar i hallen.",
      "Sedan lutar han sig bakåt i repet, och Maja firar ner honom långsamt.",
      "”Igen!” säger Hugo när fötterna nuddar golvet.",
    ],
    q: [
      ["Vem håller i repet?", ["Hugos storasyster", "Hugos pappa", "En tränare i hallen", "Hugos bästa kompis"], "fakta"],
      ["Vad händer med Hugos ben halvvägs upp?", ["De börjar skaka", "De somnar", "De blir alldeles stela", "De halkar"], "fakta"],
      ["Vad säger Maja att Hugo ska titta på?", ["Nästa grepp", "Golvet under honom", "Taket", "Henne"], "fakta"],
      ["Varför ska Hugo inte titta ner?", ["Då blir han mer rädd", "Då ser han inte Maja", "Då tappar han hjälmen", "Då kan repet gå av"], "mellan_raderna"],
      ["Vad finns högst upp på väggen?", ["En röd knapp", "En flagga", "En klocka som ringer", "En lampa"], "fakta"],
      ["Maja firar ner Hugo. Vad betyder det?", ["Hon släpper ner honom sakta", "Hon ordnar en fest för att han klarade det", "Hon drar upp honom ännu högre", "Hon hjälper honom att hoppa"], "ordforstaelse"],
      ["Hur känner sig Hugo i slutet?", ["Modig och vill klättra mer", "Trött och vill gå hem", "Rädd och vill aldrig mer", "Arg på sin syster"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-n2-bussen", title: "Bussen som gick för tidigt", textType: "story", topic: "vardag",
    body: [
      "Varje morgon tar Elvin buss nummer fyra till skolan. Bussen går tio över åtta från hållplatsen vid affären.",
      "En morgon kommer han dit precis i tid. Men bussen är redan på väg därifrån! Elvin springer och vinkar, men den kör vidare.",
      "Han tittar på tidtabellen. Där sitter en ny lapp: ”Från i dag går bussen fem minuter tidigare.”",
      "Elvin blir varm i ansiktet. Nästa buss går först om en halvtimme. Han funderar. Skolan ligger inte så långt bort, och han vet vägen förbi kyrkan och över bron.",
      "Elvin börjar gå. Han går fort och tar genvägen genom parken.",
      "När han kommer fram ringer det just in. Fröken tittar på hans röda kinder.",
      "”Har du sprungit ett maraton?” frågar hon.",
      "”Nästan”, säger Elvin och flämtar.",
    ],
    q: [
      ["Vilken buss tar Elvin?", ["Nummer fyra", "Nummer fem", "Nummer tio", "Nummer åtta"], "fakta"],
      ["Varför missar Elvin bussen?", ["Bussen går tidigare nu", "Han har försovit sig", "Han glömde sin väska", "Bussen var alldeles full av folk"], "fakta"],
      ["Var sitter lappen?", ["På tidtabellen", "Inne i bussen", "På skolans dörr", "På affärens fönster"], "fakta"],
      ["Elvin blir varm i ansiktet. Varför, tror du?", ["Han blir stressad", "Solen lyser starkt", "Han har feber", "Han har en tjock halsduk"], "mellan_raderna"],
      ["Vilken genväg tar Elvin?", ["Genom parken", "Längs järnvägen", "Över torget", "Runt sjön"], "fakta"],
      ["Elvin flämtar. Vad gör han då?", ["Andas snabbt och tungt", "Skrattar högt", "Gäspar stort", "Pratar tyst"], "ordforstaelse"],
      ["Vad visar texten om Elvin?", ["Han löser problemet själv", "Han tycker inte om skolan", "Han brukar alltid komma för sent", "Han är rädd för fröken"], "helhet_slutsats"],
    ],
  },
];
