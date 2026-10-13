# Läsresan – nivå 6, andra filen (40 nya texter, issue #666)

Nya texter i `src/lasresan/content/bank/level-6-b.json`, tillagd i `manifest.json` under nivå 6. Den gamla `level-6.json` är orörd (textId:n i elevhistoriken pekar dit). Nivå 6 har nu 80 texter.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, relationer 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, kroppen 3, historia 3, teknik 1, geografi 2, rymden 2, miljö 1, vetenskap 2.
- 7 frågor per text (samma mönster som de befintliga): 2 fakta, 2 ordförståelse, 2 mellan raderna, 1 helhet/slutsats → 80/80/80/40 av 280.
- Rätt svars position (de 280 nya): A 70, B 70, C 70, D 70. Hela nivån (561): 140/140/141/140.
- Rätt svar unikt längst: 52 av 280 (19 %); hela nivån 116 av 561 (21 %).
- Ordantal: 158–185 (riktintervall 120–190).
- Namnen i berättelserna förekommer inte på någon annan nivå (kontrollerat mot alla `level-*.json` på grenen). Syskon-issues #661–#667 skrevs parallellt och är inte jämförda.
- `test/lasresan-tio-nivaer.test.js` kräver nu minst 40 (i stället för exakt 40) texter per nivå 4–10.

## Texter
| id | typ | topic | titel |
|---|---|---|---|
| lr-n3-skolradion | story | skola | Rösten i högtalaren |
| lr-n3-fel-hallplats | story | vardag | En hållplats för långt |
| lr-n3-tomaterna | story | mysterier | Tjuven i odlingslotten |
| lr-n3-gasen | story | roliga situationer | Gåsen som ville ha mer |
| lr-n3-brevvannen | story | relationer | Brev från Tammerfors |
| lr-n3-havsornen | fact | djur | Örnen som kom tillbaka |
| lr-n3-jordbavningar | fact | natur | När marken skakar |
| lr-n3-lungorna | fact | kroppen | Luften du andas |
| lr-n3-kinesiska-muren | fact | historia | Muren genom bergen |
| lr-n3-batteriet | fact | teknik | Kraften i en liten burk |
| lr-n3-skolbiblioteket | story | skola | Boken som var försenad |
| lr-n3-forsta-middagen | story | vardag | Soppa åt en sjuk mamma |
| lr-n3-cykelkorgen | story | mysterier | Blomman i korgen |
| lr-n3-hogtalaren | story | roliga situationer | Dragspel klockan sju |
| lr-n3-storebrors-flytt | story | relationer | Det tomma rummet |
| lr-n3-kolibrin | fact | djur | Världens minsta fåglar |
| lr-n3-orkanen | fact | natur | Stormen med ett öga |
| lr-n3-huden | fact | kroppen | Kroppens största organ |
| lr-n3-vasaloppet | fact | historia | Loppet efter en flykt |
| lr-n3-australien | fact | geografi | Landet på andra sidan jorden |
| lr-n3-spagettitornet | story | skola | Tornet av spagetti |
| lr-n3-sparburken | story | vardag | Elva veckor till hjälmen |
| lr-n3-tidskapseln | story | mysterier | Lådan under eken |
| lr-n3-fel-hund | story | roliga situationer | Fel golden |
| lr-n3-farmors-ord | story | relationer | Tio ord till farmor |
| lr-n3-salarna | fact | djur | Sälarna i Östersjön |
| lr-n3-havets-salt | fact | natur | Varför är havet salt? |
| lr-n3-hjarnan | fact | kroppen | Kroppens kontrollrum |
| lr-n3-pengarna | fact | historia | Från byteshandel till kort |
| lr-n3-rymdteleskopet | fact | rymden | Ögon i rymden |
| lr-n3-myrvandringen | story | äventyr | Spången över myren |
| lr-n3-tradtopparna | story | äventyr | Banan högt uppe |
| lr-n3-nattvandringen | story | äventyr | Ugglan som svarade |
| lr-n3-simprovet | story | sport | Tvåhundra meter |
| lr-n3-terranglopp | story | sport | Loppet genom skogen |
| lr-n3-stjarnornas-liv | fact | rymden | Stjärnor föds och dör |
| lr-n3-atervinningen | fact | miljö | Soporna som blir nya saker |
| lr-n3-finland | fact | geografi | Grannlandet i öster |
| lr-n3-friktion | fact | vetenskap | Kraften som bromsar |
| lr-n3-ljudet | fact | vetenskap | Hur ljudet når ditt öra |
