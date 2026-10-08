# Läsresan – textbank nivå 5 (40 texter, issue #510, epic #482)

Ämnesplan för nivå 5 (180–300 ord, 8 frågor per text: ungefär 2 fakta, 2 ordförståelse, 2–3 mellan raderna, 1–2 helhet/slutsats – samma blandning som de befintliga). De 6 befintliga texterna från #407 ligger kvar orörda först i `src/lasresan/content/bank/level-5.json`; de 34 nya ligger efter dem i tabellens ordning.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, relationer 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, historia 3, rymden 3, teknik 3, geografi 3, vetenskap 2.
- Frågekategorier (alla 320 frågor): fakta 104, ordförståelse 74, mellan raderna 96, helhet/slutsats 46.
- Rätt svars position (alla 320 frågor): A 80, B 80, C 80, D 80 (25 % var).
- Rätt svar unikt längst: 71 av 320 (22 %); bland de 272 nya frågorna 58 (21 %). De 6 befintliga texterna står för 13 av 48 (27 %).
- Ordantal för de nya texterna: 225–284.
- Huvudpersonernas och bipersonernas namn är unika inom nivån och krockar inte med andra nivåer (kontrollerat mot alla `level-*.json` på grenen och nivå 4 från #511:s färdiga gren).

## Undvikna överlapp mot andra nivåer
Planen är gjord mot alla `level-*.json` och `niva-1.md`–`niva-3.md` som fanns på grenen. Faktaämnena krockar inte med befintliga texter: inga ekorrar/myror/grodor/pingviner/bävrar/bläckfiskar/björnar/fladdermöss/flyttfåglar/bin, ingen måne/sol/dag-natt/ISS/Mars/kometer/Saturnus/norrsken/stjärnbilder, ingen snö/regnbåge/höstlöv/åska/svampar/fröspridning/is på sjön/invasiva arter, ingen stenålder/borg/skola förr/kylskåp/hieroglyfer/bröderna Wright/pyramider/antika OS/vikingaskepp/tryckpress, ingen vindkraft/streckkod/hiss/cykel/GPS/mikrovågsugn/3D-skrivare/vattentorn/termos/mobilmeddelande/AI, ingen Gotland/flod/karta/öken/Amazonas/Island/midnattssol/Venedig/Kiruna/urbanisering, ingen magnet/vattnets former/eko/skugga/bakterier/flyta–sjunka/sömn/vetenskaplig metod.
Nivå 4 (#511) skrevs parallellt. #511 bytte själv ut åtta av sina texter som krockade med nivå 5 (loppis, skärmfri vecka, robotdammsugare, tvillingar, tunnelbana, klättervägg, Vasaskeppet, torvmossen). Åt andra hållet hade nivå 4 redan solceller, Mount Everest och Nederländerna, så nivå 5:s planerade texter om dem ersattes med låset, Kebnekaise och Japan. Nivå 6 och 7 (#512–#513) fanns inte på någon gren när planen gjordes; helhetsgranskningen (#514) bör jämföra.

## Texter
| id | typ | topic | titel | huvudperson | vinkel |
|---|---|---|---|---|---|
| (befintlig) lr-n5-stromavbrottet | story | vardag | När ljuset försvann | Felicia, Vide | Barnvakt åt lillebror när strömmen går; döljer sin egen oro |
| (befintlig) lr-n5-morfars-minne | story | relationer | Morfars sjö | Jonatan | Morfar glömmer nytt men minns gammalt; tålamod på fisketuren |
| (befintlig) lr-n5-dimman | story | äventyr | Dimman på fjället | Aisha | Dimma på fjällvandringen, Aisha följer rösena |
| (befintlig) lr-n5-somnen | fact | vetenskap | Hjärnans nattskift | — | Varför vi sover: hjärnan sorterar minnen och städar |
| (befintlig) lr-n5-kiruna | fact | geografi | Staden som flyttar | — | Kiruna flyttar på grund av gruvan |
| (befintlig) lr-n5-flyttfaglar | fact | djur | Resan som ingen har visat dem | — | Flyttfåglar: varför de flyttar och hur de hittar |
| lr-n5-provet | story | skola | Svaret i bänkens kant | Filip, Jesper, läraren Bengt | Frestelse att fuska på engelskaprovet; ärlighet ger en ärlig bild av vad han behöver öva på |
| lr-n5-novelltavlingen | story | skola | Den blå anteckningsboken | Freja, Jamila, läraren Rebecka | Hemlig skribent vågar skicka in en novell; vinner inte men en mening blir uppläst |
| lr-n5-lagerskolan | story | skola | Den randiga kudden | Albin, Rasmus | Hemlängtan på lägerskolan; den skämtsamma klasskompisen erkänner samma sak |
| lr-n5-loppisen | story | vardag | Lurvis för tio kronor | Ellen, Tim | Säljer sitt gamla gosedjur på loppis och lämnar över det till en liten flicka |
| lr-n5-skarmfri-vecka | story | vardag | Skokartongen | Karim, Nour | Familjen lägger mobilerna i en kartong i en vecka och upptäcker varandra |
| lr-n5-babyvakten | story | mysterier | Rösten i babyvakten | Matilda, Hilma | Sagor i babyvakten; kanalratt och räckvidd leder till grannens morfar |
| lr-n5-dorren | story | mysterier | Dörren som inte fanns | Otto | Gammalt foto visar en dörr som inte finns; ihålig vägg leder till ett igenbyggt skafferi |
| lr-n5-hunden-vid-grinden | story | mysterier | Hunden vid grinden | Sam, vaktmästaren Lennart, Gösta, hunden Bamse | Hund väntar vid skolgrinden varje lunch; den förre vaktmästarens hund av gammal vana |
| lr-n5-fel-vaska | story | roliga situationer | Fel väska | Adrian, Edith Sandell | Förväxlade träningsväskor på bussen; den tuffa fotbollstjejen dansar balett i hemlighet |
| lr-n5-vinkningen | story | roliga situationer | Tre som vinkade | Meja, Liva | Vinkar till fel person och låtsas vinka till någon bakom; tre främlingar vinkar till varandra |
| lr-n5-robotdammsugaren | story | roliga situationer | Rulle städar | Smilla, katten Pelle | Robotdammsugaren startar mitt under middagen med den nya grannen Siv (#514: var mammas chef); olyckan räddar kvällen |
| lr-n5-hasten-som-inte-fanns | story | relationer | Hästen som inte fanns | Hilda, Vanja | Nya kompisen ljuger om en häst för att få vänner; Hilda förlåter men säger ifrån |
| lr-n5-tvillingarna | story | relationer | Två kalas på samma dag | Ayla, Esme | Tvilling vill ha eget kalas för att bli sedd som sig själv |
| lr-n5-tunnelbanan | story | äventyr | Tre stationer för långt | Zainab | Första tunnelbaneresan ensam, åker förbi, mobilen död, läser kartan och tar sig rätt |
| lr-n5-seglatsen | story | äventyr | När vinden vände | Hamid, moster Shirin | Segling i skärgården; hård vind, revat segel och naturhamn |
| lr-n5-klattervaggen | story | sport | Ett grepp i taget | Linus, tränaren Mirja | Höjdrädd klättrare släpper väggen för att lita på repet och når klockan |
| lr-n5-domaren | story | sport | Domaren i gul tröja | Noel | Ung fotbollsdomare står emot föräldrarnas skrik och dömer det han såg |
| lr-n5-hajar | fact | djur | Hajen har fått fel rykte | — | Hajarnas ålder, valhajen, brosk, tänder, elsinne; människan är hotet |
| lr-n5-krakfaglar | fact | djur | Fåglarna som tänker | — | Kråkfåglar: stenar i röret, verktyg, minns ansikten, skatan i spegeln |
| lr-n5-torvmossen | fact | natur | Mossen som sparar allt | — | Vitmossa, surt och syrefattigt, torv, Tollundmannen, kol och dikning |
| lr-n5-skogsbranden | fact | natur | Skogen som behöver eld | — | Naturliga skogsbränder, tallens bark, brandnäva, värmesökande skalbagge, naturvårdsbränning |
| lr-n5-lavar | fact | natur | Två som blev en | — | Lav = svamp + alg i symbios, växer långsamt, renlav, mäter luftens renhet |
| lr-n5-vasaskeppet | fact | historia | Skeppet som sjönk direkt | — | Vasa 1628: för hög och smal, krängningsprovet, skeppsmasken saknas, bärgning 1961 |
| lr-n5-digerdoden | fact | historia | Den stora döden | — | Pesten 1347–1350: loppor och råttor, handelsvägar, öde gårdar, förändrat samhälle |
| lr-n5-emigrationen | fact | historia | Resan till Amerika | — | Nödåren, över en miljon utvandrare, resvägen, Amerikabrev |
| lr-n5-svarta-hal | fact | rymden | Där inte ens ljuset kommer ut | — | Hur svarta hål bildas, händelsehorisonten, första bilden 2019 |
| lr-n5-voyager | fact | rymden | Den längsta resan | — | Voyager-sonderna 1977, planetbesök, guldskivan, jorden som en blå prick |
| lr-n5-jupiter | fact | rymden | Jätten bland planeterna | — | Gasjätten utan yta, kort dygn, röda fläcken, månarna Io, Ganymedes och Europa |
| lr-n5-smak-och-lukt | fact | vetenskap | Därför smakar maten ingenting | — | Fem grundsmaker, tungkartan är fel, lukten skapar smaken, äpple–potatis-testet |
| lr-n5-broar | fact | teknik | Hur en bro bär | — | Balk-, valv- och hängbro, vinden och raset 1940, Öresundsbron |
| lr-n5-pantburken | fact | teknik | Burken som kommer tillbaka | — | Pant sedan 1984, pantautomat till ny plåt, aluminium kan smältas om, energin |
| lr-n5-laset | fact | teknik | Hemligheten i låset | — | Egyptiska trälås, cylinderlåsets stift och fjädrar, varför bara rätt nyckel passar |
| lr-n5-kebnekaise | fact | geografi | Toppen som krymper | — | Sydtoppens glaciär smälter, nordtoppen nu högst, fjällens glaciärer krymper |
| lr-n5-japan | fact | geografi | Att leva där marken skakar | — | Plattor under Japan, tsunamin 2011, svajande hus, varningar och övningar |
