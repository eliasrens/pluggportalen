# Läsresan – nivå 6, andra filen (40 nya texter, issue #666)

Nya texter i `src/lasresan/content/bank/level-6-b.json`, tillagd i `manifest.json` under nivå 6. Den gamla `level-6.json` är orörd (textId:n i elevhistoriken pekar dit). Nivå 6 har nu 80 texter.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, roliga situationer 3, relationer 3, mysterier 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, kroppen 3, historia 3, teknik 2, rymden 2, vetenskap 2, geografi 2.
- 7 frågor per text (samma mönster som de befintliga): 2 fakta, 2 ordförståelse, 2 mellan raderna, 1 helhet/slutsats → 80/80/80/40 av 280.
- Rätt svars position (de 280 nya): A 70, B 70, C 70, D 70. Hela nivån (561): 140/140/141/140.
- Rätt svar unikt längst: 49 av 280 (18 %); hela nivån 113 av 561 (20 %).
- Ordantal: 158–186 (riktintervall 120–190).
- Namnen i berättelserna förekommer inte på någon annan nivå (kontrollerat mot alla `level-*.json` efter merge av #661/#662/#664).
- Nio texter byttes ut efter merge av epic-grenen eftersom de låg för nära landade -b-texter: Australien (lr-g2-australien, lr-n1-australien), Finland (lr-g1-finland), sälar (lr-g1-salen), återvinning (lr-g2-atervinning), simprov (lr-g2-simmarket, lr-n1-simmarket), mat åt sjuk mamma (lr-n1-frukost-till-mamma), grönsakstjuv i odlingen (lr-g1-salladen), karta → nedgrävd burk (lr-g2-kartan-vinden), språkhinder (lr-n1-nya-grannen). Nivå 3, 5 och 7 (-b) var inte landade och är inte jämförda.

## Texter
| id | typ | topic | titel |
|---|---|---|---|
| lr-n3-skolradion | story | skola | Rösten i högtalaren |
| lr-n3-fel-hallplats | story | vardag | En hållplats för långt |
| lr-n3-gasen | story | roliga situationer | Gåsen som ville ha mer |
| lr-n3-brevvannen | story | relationer | Brev från Tammerfors |
| lr-n3-havsornen | fact | djur | Örnen som kom tillbaka |
| lr-n3-jordbavningar | fact | natur | När marken skakar |
| lr-n3-lungorna | fact | kroppen | Luften du andas |
| lr-n3-kinesiska-muren | fact | historia | Muren genom bergen |
| lr-n3-batteriet | fact | teknik | Kraften i en liten burk |
| lr-n3-skolbiblioteket | story | skola | Boken som var försenad |
| lr-n3-cykelkorgen | story | mysterier | Blomman i korgen |
| lr-n3-hogtalaren | story | roliga situationer | Dragspel klockan sju |
| lr-n3-storebrors-flytt | story | relationer | Det tomma rummet |
| lr-n3-kolibrin | fact | djur | Världens minsta fåglar |
| lr-n3-orkanen | fact | natur | Stormen med ett öga |
| lr-n3-huden | fact | kroppen | Kroppens största organ |
| lr-n3-vasaloppet | fact | historia | Loppet efter en flykt |
| lr-n3-spagettitornet | story | skola | Tornet av spagetti |
| lr-n3-sparburken | story | vardag | Elva veckor till hjälmen |
| lr-n3-fel-hund | story | roliga situationer | Fel golden |
| lr-n3-havets-salt | fact | natur | Varför är havet salt? |
| lr-n3-hjarnan | fact | kroppen | Kroppens kontrollrum |
| lr-n3-pengarna | fact | historia | Från byteshandel till kort |
| lr-n3-rymdteleskopet | fact | rymden | Ögon i rymden |
| lr-n3-myrvandringen | story | äventyr | Spången över myren |
| lr-n3-tradtopparna | story | äventyr | Banan högt uppe |
| lr-n3-nattvandringen | story | äventyr | Ugglan som svarade |
| lr-n3-terranglopp | story | sport | Loppet genom skogen |
| lr-n3-stjarnornas-liv | fact | rymden | Stjärnor föds och dör |
| lr-n3-friktion | fact | vetenskap | Kraften som bromsar |
| lr-n3-ljudet | fact | vetenskap | Hur ljudet når ditt öra |
| lr-n3-kalaslistan | story | vardag | Den sista platsen |
| lr-n3-skrapet-i-vaggen | story | mysterier | Skrapet i väggen |
| lr-n3-sandslottet | story | mysterier | Slottet som växte |
| lr-n3-trojan | story | relationer | Den lånade tröjan |
| lr-n3-handbollen | story | sport | Tolv passningar |
| lr-n3-lodjuret | fact | djur | Skogens tysta katt |
| lr-n3-mongoliet | fact | geografi | Landet där tälten flyttar |
| lr-n3-alperna | fact | geografi | Bergen mitt i Europa |
| lr-n3-reflexen | fact | teknik | Syns du i mörkret? |
