# Läsresan – textbank nivå 6 (40 texter, issue #513, epic #482)

Ämnesplan för nivå 6 (220–380 ord, 8 frågor per text). De 6 befintliga texterna från #408 ligger kvar orörda först i `src/lasresan/content/bank/level-6.json`; de 34 nya ligger efter dem i tabellens ordning.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, relationer 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, historia 3, rymden 3, teknik 3, geografi 3, vetenskap 2.
- Frågekategorier (alla 320 frågor): fakta 74, ordförståelse 79, mellan raderna 118, helhet/slutsats 49.
- Rätt svars position (alla 320 frågor): A 80, B 80, C 80, D 80 (25 % var).
- Rätt svar unikt längst: 54 av 320 (17 %); bland de 272 nya frågorna 47 (17 %).
- Ordantal för de nya texterna: 266–341.
- Huvudpersonernas och bipersonernas namn är unika inom nivån och krockar inte med andra nivåer (kontrollerat mot alla `level-*.json` på grenen och nivå 5 från #510:s arbetsgren). Verkliga historiska personer (Gutenberg, Jenner, Newton m.fl.) är inte huvudpersoner.

## Undvikna överlapp mot andra nivåer
Planen är gjord mot alla `level-*.json` och `niva-1.md`–`niva-5.md` (nivå 5 från #510:s gren, som var klar innan nivå 6:s faktatexter skrevs). Faktaämnena krockar inte: inga djur som redan finns (ekorre, myror, groda, pingvin, bäver, bläckfisk, björn, fladdermöss, blåval, lax, spindel, flyttfåglar, hajar, kråkfåglar), ingen måne/sol/komet/Saturnus/Jupiter/norrsken/ISS/månlandning/Pluto/svarta hål/Voyager, ingen bro/lås/pant/solcell/fyr/GPS, inga tidigare geografiplatser (Island, Kiruna, Kebnekaise, Japan, Everest, Nederländerna, Venedig, Amazonas m.fl.). Berättelsevinklarna är valda för att inte likna befintliga (t.ex. ingen loppis, inget fusk på prov, inget delat rum, ingen fjällvandring i dimma, ingen klättervägg). Nivå 7 (#512) skrevs parallellt. Dess berättelser lästes från #512:s arbetsgren innan sign-off: nivå 6 bytte därför ut en debattberättelse (samma vinkel som lr-n7-debatten) och en berättelse om språkmissförstånd utomlands (likt lr-n7-oversattningen), samt döpte om sju namn. #512:s plan hade sju faktaämnen som redan var skrivna här (elefanternas infraljud, björndjur, rösträtten, exoplaneter, rymdskrot, kryptering, tidszoner); det är rapporterat till leaden för att #512 ska byta dem.

## Texter
| id | typ | topic | titel | huvudperson | vinkel |
|---|---|---|---|---|---|
| (befintlig) lr-n6-elevradet | story | skola | Pengarna i elevrådet | Liv, Kevin | Elevrådets pengar; enkät och kompromiss slår grälet |
| (befintlig) lr-n6-stationshuset | story | mysterier | Ljuset i stationshuset | Malte, Saga | Ljus i övergivet stationshus är en man med modelljärnväg |
| (befintlig) lr-n6-finalen | story | sport | Kaptenens val | Nelly | Vinna finalen eller låta alla i laget spela |
| (befintlig) lr-n6-tryckpressen | fact | historia | Tryckpressen som förändrade världen | — | Gutenbergs press och kunskapens spridning |
| (befintlig) lr-n6-larande-datorer | fact | teknik | När datorn lär sig av exempel | — | AI som lär av exempel, möjligheter och problem |
| (befintlig) lr-n6-mars | fact | rymden | Kan människor bo på Mars? | — | För- och nackdelar som vägs mot varandra |
| lr-n6-bankgrannen | story | skola | Clownen i bänken bredvid | Cecilia, Milan, läraren Ulla | Klassclownen skämtar bort högläsningen; Cecilia förstår att skämten döljer lässvårigheter |
| lr-n6-fragladan | story | skola | Lappen i frågelådan | Ellinor, Maryam, Abdi, Hiba, läraren Jens | Anonym lapp om ensamhet; klassen hjälper alla i stället för att leta upp skribenten |
| lr-n6-planboken | story | vardag | Plånboken i busskuren | Jonna, Saida, Ingegerd | Hittad plånbok med pengar och ett foto; frestelse, ärlighet, ”men vi hade vetat” |
| lr-n6-budgeten | story | vardag | Raden längst ner | Sebastian, Malva | Mamma blir arbetslös; han döljer klassresans kostnad, klasskassan betalar, prata i stället för att bära ensam |
| lr-n6-tva-hem | story | vardag | Kalendern med två färger | Alicia | Varannan vecka i två hem; delad kalender får föräldrarna att börja skriva vänligt till varandra |
| lr-n6-kritmarkena | story | mysterier | Tecknen på trottoaren | Leon, Fatima | Sprejade märken tros vara tjuvmärken; de är ledningsmarkeringar inför fibergrävning; rykten vs sanning |
| lr-n6-ljussignalerna | story | mysterier | Blinkningarna klockan åtta | Axel, farfar Rune, Jamal | Blinkande ljus över gården är morse från en pojke med brutet ben; ny vänskap |
| lr-n6-potatisen | story | roliga situationer | Pappa är ingen potatis | Emilia, lillebror Otis, pappa Staffan | Videofilter som inte går att stänga av i pappas viktiga möte; chefen slår på ett eget filter |
| lr-n6-tradgardstomten | story | roliga situationer | Vykorten från tomten | Emil, grannen Evert | Grannens trädgårdstomte ”reser” och skickar vykort; lastbilschaufförsmamman ligger bakom för att muntra upp honom |
| lr-n6-luciatoget | story | roliga situationer | Lucia i discoläge | Annie, Bianca | Ljuskronan slår om till blinkande discoläge mitt i det högtidliga luciatåget; salen klappar takten |
| lr-n6-nya-kompisen | story | relationer | Vänskap är ingen tårta | Vilja, Wendela, Kajsa | Svartsjuka när bästa vännen får en ny vän; frågar rakt ut i stället för att skicka elakt meddelande |
| lr-n6-bonusbrodern | story | relationer | Gästen i rummet bredvid | Love, Matteo, Torbjörn | Tyst bonusbror känner sig som gäst; karta i köksskåpet och namnskylt på dörren |
| lr-n6-tolken | story | relationer | Yara tolkar | Rania, läraren Helena | Tolkar sitt eget utvecklingssamtal och mildrar kritiken; pappa förstår mer än hon tror |
| lr-n6-hundspannet | story | äventyr | Släpp aldrig släden | Märta, guiden Ante | Hundspann i fjällen; en ripa får släden att välta, hon minns regeln och bromsar |
| lr-n6-vraket | story | äventyr | Spanten i tången | Gabriel, moster Leila | Rädd för djupt vatten, hittar ett okänt vrak när han snorklar; rapporterar i stället för att ta en bit |
| lr-n6-segelflyget | story | äventyr | Utan motor | Ida, farmor Inga | Första segelflygturen; bogsering, termik och en ormvråk som cirklar bredvid |
| lr-n6-skadan | story | sport | Från bänken | Malik, tränaren Roger | Skadad fotbollsspelare blir ”spejare” på bänken och lär sig läsa spelet |
| lr-n6-alen | fact | djur | Ålens hemliga resa | — | Larver från Sargassohavet, Schmidts upptäckt, livscykeln, akut hotad |
| lr-n6-elefanterna | fact | djur | Samtal som ingen hör | — | Infraljud, vibrationer genom fötterna, matriarkens minne |
| lr-n6-bjorndjur | fact | djur | Det tåligaste djuret | — | Torkar ut till en ”tunna”, 30 år infrusna, rymdförsöket 2007 |
| lr-n6-dod-ved | fact | natur | Ett dött träd fullt av liv | — | Död ved som hem för tusentals arter; varför den blivit ovanlig |
| lr-n6-grundvattnet | fact | natur | Vattnet under dina fötter | — | Inga underjordiska sjöar; jorden som filter, långsam rörelse, föroreningar |
| lr-n6-snoskred | fact | natur | När snön släpper | — | Svaga snölager, flakskred, första kvarten, lavinprognoser |
| lr-n6-rostratten | fact | historia | Rätten att välja | — | Från rösträtt efter inkomst till 1921; fattighjälpsregeln 1945, 18 år på 1970-talet |
| lr-n6-vaccinet | fact | historia | Mjölkerskans hand | — | Smittkoppor, Jenner 1796, ordet vaccin, utrotade 1980 |
| lr-n6-rymdskrot | fact | rymden | Skräpet runt jorden | — | Farten, krocken 2009, kedjereaktion, nät och harpuner |
| lr-n6-exoplaneter | fact | rymden | Planeter kring andra stjärnor | — | Första fyndet 1995, passage- och vickningsmetoden, beboeliga zonen |
| lr-n6-slussar | fact | teknik | Båtar som går i trappor | — | Hur en sluss fungerar med tyngdkraft, Göta kanals 58 slussar |
| lr-n6-kryptering | fact | teknik | Koder och nycklar | — | Caesarchiffer, frekvensanalys, Beurling, moderna nycklar och långa lösenord |
| lr-n6-tidszoner | fact | geografi | Klockan är inte överallt lika mycket | — | Soltid → järnvägstid → 24 zoner, Kinas enda tid, jetlag, datumgränsen |
| lr-n6-monsunen | fact | geografi | Regnet som alla väntar på | — | Varför vinden vänder, regnperioden juni–september, livsviktig men kan skada |
| lr-n6-gronland | fact | geografi | Ön under isen | — | Inlandsisen, namnet, självstyre, inga vägar, smältande is |
| lr-n6-trogheten | fact | vetenskap | Varför du behöver bältet | — | Tröghet i bussen och kundvagnen, krock i 50 km/h, trepunktsbältet 1959 |
| lr-n6-bla-himmel | fact | vetenskap | Därför är himlen blå | — | Spridning av blått ljus, röd solnedgång, vita moln, månen och Mars |
