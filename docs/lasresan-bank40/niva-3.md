# Läsresan – textbank nivå 3 (40 texter, issue #508, epic #482)

Ämnesplan för nivå 3 (120–190 ord, 7 frågor per text: 2 fakta, 2 ordförståelse, 2 mellan raderna, 1 helhet/slutsats – samma mönster som de befintliga). De 6 befintliga texterna från #406 ligger kvar orörda först i `src/lasresan/content/bank/level-3.json`; de 34 nya ligger efter dem i tabellens ordning.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, relationer 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, rymden 3, teknik 3, historia 3, geografi 3, vetenskap 2.
- Ordantal i de nya texterna: 156–188.
- Rätt svars position (alla 281 frågor på nivån): A 70, B 70, C 71, D 70.
- Rätt svar unikt längst: 64 av 281 (23 %); bland de 238 nya frågorna 47 (20 %). De 6 befintliga texterna låg på 40 %, så de nya är medvetet lägre.
- Huvudpersonernas och bipersonernas namn är unika i hela banken (kontrollerat mot alla `level-*.json` och referensnamnen i `LASRESAN-AMNESFORDELNING.md`).

## Undvikna överlapp mot andra nivåer
Faktaämnena krockar inte med befintliga texter: inga ekorrar/myror/grodor/pingviner/flyttfåglar/bin, ingen måne/sol/dag-natt/ISS/Mars, ingen snö/regnbåge/höstlöv/invasiva arter, ingen stenålder/borg/skola förr/kylskåp/tryckpress, ingen vindkraft/streckkod/hiss/cykel/mobilmeddelande/AI, ingen Gotland/flod/karta/Kiruna/urbanisering, ingen magnet/vattnets former/sömn/vetenskaplig metod.
Närmast befintligt: `lr-n3-isen-pa-sjon` (varför sjön fryser uppifrån) gränsar till `lr-n1-vattnets-former` (is/vatten/ånga) men har en annan vinkel; `lr-n3-tandlakaren` (rädsla för lagning) skiljer sig från `lr-n1-tanden` (borttappad mjölktand).
Övriga nivåers 40-planer (#509–#513) fanns inte på grenen när planen gjordes; helhetsgranskningen (#514) bör jämföra.

## Texter
| id | typ | topic | titel | huvudperson | vinkel |
|---|---|---|---|---|---|
| (befintlig) lr-n3-nya-eleven | story | relationer | Den nya eleven | Samira, Ella | Ny elev med lite svenska; gemensamt hästintresse i biblioteket |
| (befintlig) lr-n3-skolfotot | story | roliga situationer | Skolfotot | Hugo | Geting på näsan mitt i skolfotot blir den bästa klassbilden |
| (befintlig) lr-n3-kanoten | story | äventyr | Paddeln som flöt iväg | Tindra, Viggo | Paddeln flyter iväg, de styr med en paddel och samarbetar |
| (befintlig) lr-n3-flyta-sjunka | fact | vetenskap | Varför flyter ett jätteskepp? | — | Lyftkraft och undanträngt vatten: därför flyter ett stålfartyg |
| (befintlig) lr-n3-oknar | fact | geografi | Öknar är inte bara sand | — | Öknar är inte bara sand och värme (stenöken, kall öken, Antarktis) |
| (befintlig) lr-n3-vikingaskepp | fact | historia | Vikingarnas snabba skepp | — | Vikingaskeppen och resorna: handel, inte bara plundring |
| lr-n3-larare-for-en-dag | story | skola | Lärare för en dag | Alvin, läraren Gunilla | Elev är lärare en lektion, klassen lyssnar inte förrän en fråga väcker nyfikenhet |
| lr-n3-grupparbetet | story | skola | Affischen om Östersjön | Leia, Måns | Leia gör allt själv, den tysta Måns teckningar räddar affischen |
| lr-n3-skoltidningen | story | skola | Kokerskans hemlighet | Nadja, kokerskan Inga-Lill | Intervju med den stränga kokerskan som har seglat runt jorden som skeppskock |
| lr-n3-tvattstugan | story | vardag | Bråket i tvättstugan | Hedda, grannen Ruth | Bråk om tvättid; grannen ser dåligt, Hedda gör stora skyltar |
| lr-n3-hundvakten | story | vardag | En vecka med Doris | Elton, hunden Doris | Rastar grannens labrador, faller i leran, lär sig belöna med godbitar |
| lr-n3-tandlakaren | story | vardag | Ljudet i väntrummet | Lykke, tandläkaren Anders | Rädd för tandläkaren; spegel och förklaringar gör lagningen hanterbar |
| lr-n3-kodlaset | story | mysterier | Resväskan på vinden | Agnes, Elvira, mormor Astrid | Kodlås på morfars resväska, koden finns på ett foto; breven var mormors |
| lr-n3-daggen | story | mysterier | Den blöta rutschkanan | Nova, Gustav, läraren Peter | Blöt rutschkana varje morgon; burk-experiment visar att det är dagg |
| lr-n3-teckningarna | story | mysterier | Konstnären på tavlan | Signe, Ilyas | Hemliga teckningar på tavlan; Signe avslöjar men bevarar hemligheten |
| lr-n3-papegojan | story | roliga situationer | Papegojan som lyssnade | Linnea, Ludvig, papegojan Kapten | Lånad papegoja härmar storebrors suck om mostern mitt i middagen |
| lr-n3-mormors-meddelanden | story | roliga situationer | Mormor och de små bilderna | Lovisa, mormor | Mormor tror att skrattande emoji gråter; missförstånd reds ut |
| lr-n3-handslaget | story | relationer | Det hemliga handslaget | Stella, Molly, Wilda | Svartsjuka när bästisen får en ny vän; delar sitt hemliga handslag |
| lr-n3-delat-rum | story | relationer | Lakanet mitt i rummet | Juli, Lejla | Bonussystrar delar rum med lakan emellan; åskväder för dem samman |
| lr-n3-tagresan | story | äventyr | Ensam på tåget | Isabell, farmor | Första tågresan ensam, träd över spåret, byte till buss med konduktörens hjälp |
| lr-n3-luftballongen | story | äventyr | Morgonen i luftballongen | Dennis, farbror Ivar, piloten Ulrika | Gryningstur i luftballong som följer vinden, landar bland kor |
| lr-n3-judon | story | sport | Det gula bältet | Bruno, tränaren Ahmed, Charlie | Gradering till gult bälte, misslyckat kast, försöker igen |
| lr-n3-schacket | story | sport | Ett drag längre | Melker, Sofia | Första schackturneringen, förlorar mot yngre, lär sig tänka ett drag längre |
| lr-n3-blackfisken | fact | djur | Havets mästare på att gömma sig | — | Bläckfiskens armar, näbb, färgbyte, bläckmoln, tre hjärtan, klokskap |
| lr-n3-bjornens-ide | fact | djur | Björnens långa vintervila | — | Brunbjörnen äter bär på hösten, ide ett halvår, ungar föds i idet |
| lr-n3-fladdermossen | fact | djur | De som ser med öronen | — | Fladdermöss: flygande däggdjur som jagar insekter med ekolokalisering |
| lr-n3-askan | fact | natur | Blixt och dunder | — | Hur blixt och åska uppstår; räkna sekunder, var man är säker |
| lr-n3-svamparna | fact | natur | Skogens gömda trådar | — | Mycel under marken, fruktkropp och sporer, nedbrytare, samarbete med träd |
| lr-n3-isen-pa-sjon | fact | natur | Därför fryser sjön uppifrån | — | Vatten är tyngst vid 4 grader, därför fryser sjön uppifrån; isen som lock |
| lr-n3-norrsken | fact | rymden | Ljuset som dansar över himlen | — | Solvind, magnetfält och lysande gaser; syre ger grönt; sydsken |
| lr-n3-kometer | fact | rymden | Snöbollarna från rymden | — | Kometen som smutsig snöboll, svans bort från solen, Halley, stjärnfall |
| lr-n3-saturnus | fact | rymden | Planeten med ringarna | — | Ringar av is och sten, gasplanet som kunde flyta, Titan, Galileo 1610 |
| lr-n3-gps | fact | teknik | Hur vet mobilen var du är? | — | GPS-satelliter med noggranna klockor; mobilen räknar avstånd och bara lyssnar |
| lr-n3-mikrovagsugnen | fact | teknik | Chokladen som smälte | — | Percy Spencers smälta choklad; mikrovågor sätter vattnet i rörelse; nätet i luckan |
| lr-n3-3d-skrivaren | fact | teknik | Skrivaren som bygger saker | — | 3D-modell delas i lager, smält plast genom munstycke, användningar |
| lr-n3-pyramiderna | fact | historia | Gravarna vid Nilen | — | Faraonernas gravar, mumier, Cheops, slädar och ramper, betalda arbetare |
| lr-n3-antika-os | fact | historia | De första olympiska spelen | — | Spelen i Olympia från 776 f.Kr., fred, grenar, olivkrans, nystart 1896 |
| lr-n3-amazonas | fact | geografi | Skogen där det regnar varje dag | — | Världens största regnskog: trädkronornas tak, arter, avskogning |
| lr-n3-island | fact | geografi | Landet av eld och is | — | Plattor som glider isär, vulkaner, utbrottet 2010, gejsrar, jordvärme |
| lr-n3-bakterier | fact | vetenskap | Osynligt liv på dina händer | — | Encelliga bakterier, Leeuwenhoek, nyttiga och farliga, delning, handtvätt |
