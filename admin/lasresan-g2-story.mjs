// ============================================================================
// Läsresan – källtexter för nivå 2, story (issue #522, epic #516)
// ----------------------------------------------------------------------------
// 15 story-texter, 60–90 ord, 4–5 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g2-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-2.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const STORY = [
  {
    id: "lr-g2-pepparkakshuset", title: "Taket som rasade", textType: "story", topic: "skola",
    body: [
      "I december bygger klass två pepparkakshus. Zeynep och hennes grupp gör ett hus. Det har fönster och dörr.",
      "De sätter på taket. Det står still en stund. Sedan glider det ner, och en bit går sönder.",
      "Zeynep blir ledsen. Men fröken har en idé. Hon smälter socker i en kastrull. Det blir varmt och klibbigt.",
      "Nu sitter taket fast! Gruppen lägger snö av florsocker på det. Huset blir det finaste i klassen.",
    ],
    q: [
      ["Vilken månad bygger klassen pepparkakshus?", ["December", "November", "Januari", "Oktober"], "fakta"],
      ["Vad händer med taket först?", ["Det glider ner", "Det blir svart", "Någon äter upp det", "Det blir för stort"], "fakta"],
      ["Vad smälter fröken i kastrullen?", ["Socker", "Smör", "Choklad", "Snö"], "fakta"],
      ["Vad gör de snön på taket av?", ["Florsocker", "Bomull", "Vitt papper", "Riktig snö"], "fakta"],
      ["Sockret blir klibbigt. Vad betyder klibbigt?", ["Att det fastnar", "Att det är kallt", "Att det luktar gott", "Att det är hårt"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-svara-ordet", title: "Det svåra ordet", textType: "story", topic: "skola",
    body: [
      "På fredag har klassen ordförhör. Felix ska kunna tio ord. Nio ord kan han redan. Men ordet sjö är svårt.",
      "Felix skriver ”schö”. Sedan skriver han ”skjö”. Båda är fel.",
      "Mamma hjälper honom. ”Ordet börjar som sju”, säger hon. Felix skriver sju och byter sedan sista bokstaven.",
      "På fredag skriver han s, j och ö. Alla tio ord blir rätt. Felix ler hela vägen hem.",
    ],
    q: [
      ["Vilken dag är ordförhöret?", ["Fredag", "Måndag", "Onsdag", "Torsdag"], "fakta"],
      ["Hur många ord ska Felix kunna?", ["Tio", "Nio", "Sju", "Tolv"], "fakta"],
      ["Vilket ord är svårt för Felix?", ["Sjö", "Sju", "Skog", "Stjärna"], "fakta"],
      ["Vem hjälper Felix?", ["Mamma", "Pappa", "Fröken", "En kompis"], "fakta"],
      ["Hur känner sig Felix efter förhöret?", ["Glad och nöjd", "Trött och sur", "Rädd och orolig", "Arg på mamma"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-malningen", title: "Pölen på målningen", textType: "story", topic: "skola",
    body: [
      "Klassen målar en lång bild av en stad. Den ligger på golvet och ska torka.",
      "Amina går förbi med en mugg vatten. Hon snubblar. Vattnet rinner ut över bilden. Nu är husen fulla av blå fläckar.",
      "”Förlåt!” säger Amina. Hon vill gråta.",
      "Läraren Mikael tittar noga. ”Det ser ut som regn”, säger han. Då får Amina en idé. Alla målar paraplyer över människorna i staden.",
      "Bilden får ett nytt namn: Regnet i stan.",
    ],
    q: [
      ["Vad målar klassen?", ["En stad", "Ett hav", "En skog", "En bondgård"], "fakta"],
      ["Vad har Amina i muggen?", ["Vatten", "Saft", "Mjölk", "Färg"], "fakta"],
      ["Vad tycker läraren att fläckarna liknar?", ["Regn", "Snö", "Moln", "Blommor"], "fakta"],
      ["Vad målar alla till slut?", ["Paraplyer", "Solar", "Fåglar", "Bilar"], "fakta"],
      ["Varför vill Amina gråta?", ["Hon tror att bilden är förstörd", "Hon har slagit i foten mot bänken", "Hon fick ingen pensel", "Hon tycker inte om att måla"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-snoskottning", title: "Snö på trappan", textType: "story", topic: "vardag",
    body: [
      "Det har snöat hela natten. Folke tittar ut genom fönstret. Allt är vitt.",
      "Grannen Esther är gammal och går med käpp. Hennes trappa är full av snö.",
      "Folke tar på sig overall och vantar. Han hämtar en snöskyffel. Han skottar steg för steg. Det tar lång tid, och han blir varm.",
      "Till slut är trappan fin. Esther öppnar dörren. ”Tack, min vän!” säger hon. Sedan får Folke följa med in i köket. Där får han varm choklad och en bulle.",
    ],
    q: [
      ["Hur länge har det snöat?", ["Hela natten", "En timme", "Hela veckan", "Hela dagen"], "fakta"],
      ["Vad går Esther med?", ["Käpp", "Rullator", "Kryckor", "Paraply"], "fakta"],
      ["Vad skottar Folke med?", ["En snöskyffel", "En kvast", "En hink", "Händerna"], "fakta"],
      ["Vad får Folke i köket?", ["Choklad och en bulle", "Saft och en kaka", "Te och en macka", "Glass och en våffla"], "fakta"],
      ["Varför skottar Folke trappan?", ["För att hjälpa Esther", "För att få pengar", "För att mamma säger det", "För att bygga en snögubbe"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-stodhjulen", title: "Utan stödhjul", textType: "story", topic: "vardag",
    body: [
      "Yasmin har en röd cykel. I dag skruvar pappa bort stödhjulen.",
      "”Jag håller i sadeln”, säger pappa. Yasmin trampar. Cykeln vinglar. Pappa springer bredvid.",
      "De cyklar fram och tillbaka på gången i parken. Efter en stund ropar Yasmin: ”Håll i, pappa!”",
      "Men pappa står kvar långt bak. Han vinkar. Han har släppt för länge sedan!",
      "Yasmin bromsar och skrattar. ”Jag cyklade själv!” Hon vill genast åka en gång till.",
    ],
    q: [
      ["Vilken färg har cykeln?", ["Röd", "Blå", "Gul", "Grön"], "fakta"],
      ["Vad skruvar pappa bort?", ["Stödhjulen", "Ringklockan", "Pakethållaren", "Lampan"], "fakta"],
      ["Var cyklar de?", ["I parken", "På skolgården", "På gatan", "I skogen"], "fakta"],
      ["Cykeln vinglar. Vad betyder vinglar?", ["Gungar åt sidorna", "Åker väldigt fort", "Står helt stilla", "Låter högt"], "ordforstaelse"],
      ["Vad har pappa gjort utan att Yasmin märkt det?", ["Släppt sadeln", "Gått hem", "Tagit en bild", "Lånat en cykel"], "fakta"],
    ],
  },
  {
    id: "lr-g2-pusselbiten", title: "Biten som fattades", textType: "story", topic: "mysterier",
    body: [
      "Oliver lägger ett stort pussel med en brandbil. Det har hundra bitar.",
      "Han håller på hela söndagen. På kvällen fattas bara en bit. Men den finns inte! Oliver letar under bordet och i soffan. Han tittar i kartongen igen.",
      "Då ser han hunden Bror. Bror ligger i sin korg och tuggar på något.",
      "Oliver kryper fram. I korgen ligger pusselbiten. Den är lite blöt. Oliver torkar den och lägger den på plats. Pusslet är klart!",
    ],
    q: [
      ["Vad är det för bild på pusslet?", ["En brandbil", "En båt", "En häst", "Ett slott"], "fakta"],
      ["Hur många bitar har pusslet?", ["Hundra", "Femtio", "Tusen", "Tjugo"], "fakta"],
      ["Var letar Oliver först?", ["Under bordet", "I hundens korg", "I sin säng", "I köket"], "fakta"],
      ["Vad heter hunden?", ["Bror", "Bamse", "Rufus", "Kaj"], "fakta"],
      ["Varför är pusselbiten blöt?", ["Hunden har tuggat på den", "Den låg i regnet", "Oliver spillde saft på den", "Den har tvättats"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-lekstugan", title: "Ljuset i lekstugan", textType: "story", topic: "mysterier",
    body: [
      "Det är kväll. Kerim ska sova. Han tittar ut genom fönstret mot trädgården.",
      "I lekstugan lyser ett litet ljus. Det rör sig fram och tillbaka. Vem är där?",
      "Kerim tar på sig tofflorna och går ut. Gräset är vått. Han smyger fram till lekstugan och tittar in genom fönstret.",
      "Där sitter storasyster Dana. Hon har en ficklampa och en tjock bok.",
      "”Det är så tyst här”, säger hon. Kerim kryper in bredvid henne. Hon läser högt för honom.",
    ],
    q: [
      ["Vilken tid på dagen är det?", ["Kväll", "Morgon", "Lunch", "Eftermiddag"], "fakta"],
      ["Vad ser Kerim i lekstugan?", ["Ett ljus", "En katt", "En boll", "Rök"], "fakta"],
      ["Hur är gräset?", ["Vått", "Torrt", "Högt", "Fruset"], "fakta"],
      ["Vem sitter i lekstugan?", ["Dana", "Mamma", "En granne", "Pappa"], "fakta"],
      ["Kerim smyger fram. Vad betyder smyger?", ["Går tyst och försiktigt", "Springer så fort han kan", "Hoppar på ett ben", "Ropar högt"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-fel-dag", title: "Fel dag", textType: "story", topic: "roliga situationer",
    body: [
      "Robin vaknar tidigt. I dag är det maskerad i skolan! Han tar på sig sin gröna dinosauriedräkt med lång svans.",
      "På vägen till skolan tittar folk på honom. Robin vrålar och viftar med klorna.",
      "Men i klassrummet har ingen annan dräkt. Alla har vanliga kläder. ”Robin, maskeraden är i morgon”, säger fröken.",
      "Först blir Robin röd i ansiktet. Sedan skrattar han. ”Då är jag dinosaurie i två dagar!”",
    ],
    q: [
      ["Vad är det för dräkt Robin har?", ["En dinosauriedräkt", "En piratdräkt", "En drakdräkt", "En kattdräkt"], "fakta"],
      ["Vilken färg har dräkten?", ["Grön", "Röd", "Lila", "Brun"], "fakta"],
      ["Vad har de andra i klassen på sig?", ["Vanliga kläder", "Dräkter", "Pyjamas", "Regnkläder"], "fakta"],
      ["När är maskeraden?", ["I morgon", "I dag", "I går", "Nästa vecka"], "fakta"],
      ["Varför blir Robin röd i ansiktet?", ["Han skäms lite", "Han är sjuk", "Han har sprungit", "Han är arg"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-mormors-nasa", title: "Mormors näsa", textType: "story", topic: "roliga situationer",
    body: [
      "Mormor har fått en ny mobil. Nu vill hon ringa med bild till Olle. Det är första gången.",
      "Det plingar. Olle svarar. Men han ser bara en stor näsa!",
      "”Hej Olle! Ser du mig?” säger mormor. Nu ser Olle bara taket och en lampa.",
      "”Håll mobilen längre bort”, säger Olle. Nu ser han mormors öra. Olle skrattar så att han får hicka.",
      "Till slut hittar mormor rätt. Där är hela hon, med glasögon och ett stort leende.",
    ],
    q: [
      ["Vad har mormor fått?", ["En ny mobil", "En ny lampa", "Nya glasögon", "En ny dator"], "fakta"],
      ["Vad ser Olle först?", ["En näsa", "Ett öra", "Ett tak", "En katt"], "fakta"],
      ["Vad säger Olle att mormor ska göra?", ["Hålla mobilen längre bort", "Ringa upp honom en gång till", "Tända lampan", "Ta av glasögonen"], "fakta"],
      ["Vad får Olle när han skrattar?", ["Hicka", "Ont i magen", "Tårar", "Ont i huvudet"], "fakta"],
    ],
  },
  {
    id: "lr-g2-sjuk-lillebror", title: "När Rafael var sjuk", textType: "story", topic: "relationer",
    body: [
      "Rafael har feber. Han ligger i soffan under en filt. Han är varm och ledsen.",
      "Hans storasyster Saba ska egentligen gå till en kompis. Men hon stannar hemma.",
      "Först läser hon en bok. Den handlar om en bil som kan flyga. Sedan ritar hon en bild till Rafael. Det är en bil med vingar.",
      "Rafael somnar med bilden i handen. När han vaknar mår han lite bättre.",
      "”Tack, Saba”, viskar han. ”Du är bäst.”",
    ],
    q: [
      ["Vad har Rafael?", ["Feber", "Ont i foten", "Hicka", "Ont i en tand"], "fakta"],
      ["Var ligger Rafael?", ["I soffan", "I sängen", "På golvet", "I badet"], "fakta"],
      ["Vart skulle Saba egentligen gå?", ["Till en kompis", "Till skolan", "Till affären", "Till träningen"], "fakta"],
      ["Vad ritar Saba?", ["En bil med vingar", "En raket", "En fågel", "En båt med segel"], "fakta"],
      ["Rafael viskar. Vad betyder viskar?", ["Pratar mycket tyst", "Pratar mycket högt", "Sjunger en sång", "Gråter lite"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-sista-biten", title: "Den sista biten", textType: "story", topic: "relationer",
    body: [
      "Jacob och Deniz har bakat en sockerkaka. Nu är bara en bit kvar.",
      "”Den är min!” säger Jacob. ”Nej, min!” säger Deniz. De drar i tallriken. Biten ramlar nästan i golvet.",
      "Deniz farmor kommer in. ”Jag har ett knep”, säger hon. ”En av er delar biten. Den andra får välja först.”",
      "Jacob delar mycket noga. Bitarna blir precis lika stora. Deniz väljer en. Båda blir nöjda och äter upp.",
    ],
    q: [
      ["Vad har Jacob och Deniz bakat?", ["En sockerkaka", "Bullar", "Muffins", "Pepparkakor"], "fakta"],
      ["Vad gör de med tallriken?", ["Drar i den", "Tappar den", "Diskar den", "Gömmer den"], "fakta"],
      ["Vem kommer in i köket?", ["Deniz farmor", "Jacobs mamma", "En granne", "Deniz pappa"], "fakta"],
      ["Vem delar biten?", ["Jacob", "Deniz", "Farmor", "Ingen"], "fakta"],
      ["Varför delar Jacob så noga?", ["Deniz får välja först", "Kakan är het", "Kniven är trubbig", "Farmor tittar på honom"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-fyren", title: "Upp i fyren", textType: "story", topic: "äventyr",
    body: [
      "Lavin och morfar går längs stranden. Längst ut står en hög vit fyr. Den har ett rött bälte.",
      "Dörren är öppen. Inne finns en smal trappa som snurrar uppåt. Lavin räknar stegen: ett, två, tre … hundra!",
      "Hennes ben är trötta, men nu är de högst upp. Det blåser och måsarna skriker.",
      "Långt ute på havet ser Lavin ett stort skepp. ”Förr visade fyren skeppen vägen i mörkret”, säger morfar.",
    ],
    q: [
      ["Var går Lavin och morfar?", ["Längs stranden", "I skogen", "På en gata", "Över en äng"], "fakta"],
      ["Hur ser fyren ut?", ["Vit med ett rött bälte", "Röd med ett vitt bälte", "Grå med svarta prickar", "Gul med ett blått tak"], "fakta"],
      ["Hur många steg räknar Lavin?", ["Hundra", "Femtio", "Tjugo", "Tusen"], "fakta"],
      ["Vad ser Lavin ute på havet?", ["Ett skepp", "En val", "En ö", "En fyr"], "fakta"],
      ["Vad gjorde fyren förr?", ["Visade skeppen vägen", "Väckte måsarna", "Mätte hur mycket det blåste", "Värmde morfar"], "fakta"],
    ],
  },
  {
    id: "lr-g2-stoveln", title: "En stövel och en abborre", textType: "story", topic: "äventyr",
    body: [
      "Wiktor och moster Tilly sitter på bryggan. De har metspön och en burk med maskar.",
      "Wiktor kastar ut. Flötet guppar. Plötsligt dras det ner! Wiktor vevar och vevar. Upp kommer … en gammal stövel full av gyttja.",
      "Moster Tilly skrattar så att hon nästan ramlar i.",
      "Wiktor försöker igen. Nu dras flötet ner en gång till. Den här gången är det en randig abborre!",
      "Wiktor släpper försiktigt tillbaka den i sjön.",
    ],
    q: [
      ["Var sitter Wiktor och moster Tilly?", ["På bryggan", "I en båt", "På stranden", "På en sten"], "fakta"],
      ["Vad har de i burken?", ["Maskar", "Bröd", "Godis", "Stenar"], "fakta"],
      ["Vad får Wiktor upp först?", ["En stövel", "En abborre", "En gädda", "En flaska"], "fakta"],
      ["Hur ser abborren ut?", ["Randig", "Prickig", "Helt röd", "Helt svart"], "fakta"],
      ["Vad gör Wiktor med abborren?", ["Släpper tillbaka den", "Tar hem den", "Ger den till grannens katt", "Lägger den i burken"], "fakta"],
    ],
  },
  {
    id: "lr-g2-korgen", title: "Bollen i korgen", textType: "story", topic: "sport",
    body: [
      "Mustafa spelar basket. Han är kortast i hela laget. Ibland tror han att han aldrig kommer att träffa korgen.",
      "Varje dag efter skolan övar han straffkast på skolgården. Tjugo kast i rad. Först missar han nästan alla. Sedan går fler och fler i.",
      "På lördag är det match. Det står lika. Mustafa får två straffkast. Han andas lugnt och kastar.",
      "Båda bollarna går i korgen! Laget vinner, och alla lyfter upp Mustafa.",
    ],
    q: [
      ["Vilken sport spelar Mustafa?", ["Basket", "Fotboll", "Handboll", "Innebandy"], "fakta"],
      ["Var övar Mustafa?", ["På skolgården", "I hallen", "Hemma i köket", "I parken"], "fakta"],
      ["Hur många kast gör han i rad?", ["Tjugo", "Tio", "Hundra", "Fem"], "fakta"],
      ["Vilken dag är matchen?", ["Lördag", "Söndag", "Fredag", "Onsdag"], "fakta"],
      ["Varför lyckas Mustafa i matchen?", ["Han har övat mycket", "Han är längst i laget", "Han har nya skor", "Bollen är lätt"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-hjulningen", title: "Hjulningen", textType: "story", topic: "sport",
    body: [
      "Inez vill kunna göra hjulning. Hennes kusin kan, och det ser så lätt ut.",
      "Inez sätter händerna i gräset och sparkar upp benen. Men hon landar på rumpan. Nästa gång landar hon på sidan.",
      "Kusinen visar igen. ”Titta på händerna och sträck på benen”, säger hon.",
      "Inez övar hela eftermiddagen. Gräsfläckarna på byxorna blir fler och fler. Till slut snurrar hon runt och landar på fötterna. Hjulningen blir alldeles rak!",
    ],
    q: [
      ["Vad vill Inez kunna göra?", ["Hjulning", "Volt", "Spagat", "Kullerbytta"], "fakta"],
      ["Vem kan redan göra hjulning?", ["Kusinen", "Mamma", "Läraren", "Lillebror"], "fakta"],
      ["Var landar Inez första gången?", ["På rumpan", "På fötterna", "På magen", "På huvudet"], "fakta"],
      ["Vad får Inez på byxorna?", ["Gräsfläckar", "Ett hål", "Lera", "Vatten"], "fakta"],
      ["Hur länge övar Inez?", ["Hela eftermiddagen", "En kvart", "Hela natten", "En hel vecka"], "fakta"],
    ],
  },
];
