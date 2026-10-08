# Läsresan – textbank nivå 2 (40 texter, issue #509, epic #482)

Ämnesplan för nivå 2 (80–140 ord, 7 frågor per text). De 6 befintliga texterna från #405 ligger kvar orörda först i `src/lasresan/content/bank/level-2.json`; de 34 nya ligger efter dem i tabellens ordning.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, relationer 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, historia 3, rymden 3, teknik 3, geografi 3, vetenskap 2.
- Rätt svars position (alla 280 frågor): A 71, B 70, C 69, D 70 (≈ 25 % var).
- Rätt svar unikt längst: 90 av 280 (32 %); bland de 238 nya frågorna 74 (31 %).
- Ordantal för de nya texterna: 109–134.
- Huvudpersonernas och bipersonernas namn är unika i hela banken (kontrollerat mot alla `level-*.json`, `niva-1.md` och referensnamnen i `LASRESAN-AMNESFORDELNING.md`).

## Undvikna överlapp mot andra nivåer
Faktaämnena krockar inte med befintliga texter på någon nivå: inga ekorrar/myror/grodor/pingviner/flyttfåglar/bin, ingen måne/sol/dag-natt/ISS/Mars, inga regnbågar/snöflingor/höstlöv/invasiva arter, ingen stenålder/borg/vikingar/tryckpress/kylskåp, ingen magnet/vattnets former/flyta-sjunka/sömn, inga kartor/floder/Gotland/öknar/Kiruna/städer, inga hissar/vindkraftverk/streckkoder/meddelanden/AI. Berättelserna undviker nivå 1:s vinklar (borttappat i snö, karta i brevlådan, vilse i majs, tältljud). Nivå 3–7:s 40-planer fanns inte på grenen när planen gjordes (parallella workers); helhetsgranskningen (#514) bör jämföra.

## Texter
| id | typ | topic | titel | huvudperson | vinkel |
|---|---|---|---|---|---|
| (befintlig) lr-n2-klassens-fisk | story | skola | Klassfisken får ett namn | Lucas | Klassen röstar om fiskens namn, Gurkan vinner |
| (befintlig) lr-n2-jordgubbarna | story | mysterier | Vem tar jordgubbarna? | Wilma | Jordgubbstjuven är en koltrast |
| (befintlig) lr-n2-simhoppet | story | sport | Hoppet från pallen | Yusuf | Vågar hoppa från startpallen första gången |
| (befintlig) lr-n2-cykeln | fact | teknik | Så rullar cykeln | — | Pedaler, kedja, bromsar |
| (befintlig) lr-n2-pingvinen | fact | djur | Pappan som håller ägget varmt | — | Kejsarpingvinens pappa ruvar ägget på fötterna |
| (befintlig) lr-n2-utan-kylskap | fact | historia | När ingen hade kylskåp | — | Jordkällare, ishus, saltning |
| lr-n2-vikarien | story | skola | Vikarien som visste | Hjalmar, vikarien Sanna | Klassen byter namn för att lura vikarien – hon är Hjalmars mammas kusin |
| lr-n2-solrosen | story | skola | Fröet som tog tid | Ester, läraren Mattias | Solrostävling, Esters frö kommer upp sist men får två blommor |
| lr-n2-bussen | story | vardag | En extra tur | Folke | Första bussresan ensam, åker förbi hållplatsen och frågar chauffören |
| lr-n2-flytten | story | vardag | Kartongerna med VIKTIGT | Signe | Alla flyttkartonger märkta VIKTIGT, lakanen går inte att hitta |
| lr-n2-nyckeln | story | vardag | Utelåst i regnet | Elton, grannen Birgitta | Utelåst efter skolan, väntar hos grannen; nyckeln satt i dörren |
| lr-n2-bavern | fact | djur | Bävern bygger | — | Tänder som växer, hydda med ingång under vattnet, damm, svansvarning |
| lr-n2-blackfisken | fact | djur | Djuret med åtta armar | — | Sugkoppar, inget skelett, färgbyte, bläck, smart |
| lr-n2-askan | fact | natur | Blixt och dunder | — | Blixt och åska, räkna sekunder delat med tre, säkerhet |
| lr-n2-kallaren | story | mysterier | Dunket i källaren | Vincent, Tuva | Spökljud i källaren är en sko i torktumlaren |
| lr-n2-pianot | story | mysterier | Melodin i trappan | Nova, herr Nyström | Vem spelar piano i trapphuset? Ledtrådar, grannen erbjuder att lära ut melodin |
| lr-n2-papegojan | story | roliga situationer | Kakan säger något nytt | Oliver, Ruben | Mosterns papegoja skriker ordet Oliver lärt den mitt i finfikat |
| lr-n2-fel-kalas | story | roliga situationer | Fel kalas | Stella, Jessica | Cyklar till fel gata och hamnar på en sexårings kalas |
| lr-n2-frisyren | story | roliga situationer | Pappas frisörsalong | Måns | Pappa klipper för kort, Måns klipper pappa tillbaka |
| lr-n2-svampar | fact | natur | Det mesta syns inte | — | Mycel under marken, varken växt eller djur, hjälper träd, giftiga svampar |
| lr-n2-froets-resa | fact | natur | Fröna som reser | — | Fröspridning: maskros, lönn, kardborre, bär via fåglar |
| lr-n2-hieroglyfer | fact | historia | Skrift med bilder | — | Egyptiska hieroglyfer, papyrus, skrivare, gåtan löstes för 200 år sedan |
| lr-n2-glasogonen | story | relationer | Två ugglor | Hedvig, Wilda | Rädd för att bli retad för nya glasögon, kompisen stöttar |
| lr-n2-storasyster | story | relationer | Ett tomt rum | Kian, Mahsa | Storasyster flyttar hemifrån, båda saknar varandra |
| lr-n2-hemligheten | story | relationer | Orden på tungan | Dalia, Lejla, Elvira | Frestas att avslöja väninnans hemlighet men håller löftet |
| lr-n2-grottan | story | äventyr | Längst in i grottan | Sigge, morbror Lars | Grottutforskning, sovande fladdermöss, rep som säkerhet, underjordisk sjö |
| lr-n2-vinden | story | äventyr | Fotot på vinden | Tage, farfar | Gammalt foto på vinden leder till farfars nedgrävda barndomsskatt |
| lr-n2-ridturen | story | äventyr | När Pärlan blev rädd | Alma, ridläraren Fredrik | Första uteritten, hästen skräms av en plastpåse, Alma håller lugnet |
| lr-n2-skidloppet | story | sport | Bakåt i backen | Agnes, läraren Malin | Skidloppet, glider bakåt i backen, lär sig fiskbensteknik |
| lr-n2-forsta-flygningen | fact | historia | Tolv sekunder i luften | — | Bröderna Wright, första motorflygningen 1903 |
| lr-n2-stjarnbilder | fact | rymden | Bilder på natthimlen | — | Stjärnbilder, Karlavagnen, hitta Polstjärnan |
| lr-n2-kometen | fact | rymden | Snöbollen med svans | — | Kometer av is och damm, svansen pekar bort från solen, Halleys komet |
| lr-n2-saturnus | fact | rymden | Planeten med ringar | — | Gasplanet som kan flyta, ringar av is och sten, 29 år per varv |
| lr-n2-vattentornet | fact | teknik | Vattnet i tornet | — | Vattenverk, tank högt upp, tyngden ger tryck i kranen |
| lr-n2-termosen | fact | teknik | Flaskan som håller värmen | — | Dubbla väggar utan luft, blank insida, tätt lock |
| lr-n2-island | fact | geografi | Landet av is och eld | — | Glaciärer, vulkaner, gejsrar, varmt vatten värmer husen |
| lr-n2-midnattssolen | fact | geografi | Solen som inte går ner | — | Midnattssol och polarnatt norr om polcirkeln, jordens lutning |
| lr-n2-venedig | fact | geografi | Staden på vatten | — | Kanaler i stället för gator, båtar, hus på trästolpar |
| lr-n2-ekot | fact | vetenskap | Ljudet som studsar | — | Eko, mjuka saker suger upp ljud, fladdermöss och delfiner |
| lr-n2-skuggan | fact | vetenskap | Skuggan som växer | — | Ljus går rakt, skuggans längd under dagen, solur |
