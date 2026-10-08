# Läsresan – textbank nivå 1 (40 texter, issue #507, epic #482)

Ämnesplan för nivå 1 (60–110 ord, 6 frågor per text). De 6 befintliga texterna från #405 ligger kvar orörda först i `src/lasresan/content/bank/level-1.json`; de 34 nya ligger efter dem i tabellens ordning.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, äventyr 3, sport 3, relationer 2.
- Fact: djur 3, natur 3, rymden 3, historia 3, teknik 3, geografi 3, vetenskap 2.
- Rätt svars position (alla 240 frågor): A 60, B 60, C 60, D 60 (25 % var).
- Rätt svar unikt längst: 58 av 240 (24 %).
- Huvudpersonernas namn är unika i hela banken (kontrollerat mot alla `level-*.json` och referensnamnen i `LASRESAN-AMNESFORDELNING.md`).

## Undvikna överlapp mot andra nivåer
Faktaämnena är valda så att de inte krockar med befintliga texter: inga pingviner/flyttfåglar/bin (n2/n5/n4), ingen rymdstation/Mars (n4/n6), inga vikingar/tryckpress/kylskåp (n3/n6/n2), inga öknar/Kiruna (n3/n5), inga flyta-sjunka/sömn (n3/n5). Övriga nivåers 40-planer fanns inte på grenen när planen gjordes (parallella workers); helhetsgranskningen (#514) bör jämföra.

## Texter
| id | typ | topic | titel | huvudperson | vinkel |
|---|---|---|---|---|---|
| (befintlig) lr-n1-tanden | story | vardag | Tanden som försvann | Noah | Mjölktand försvinner vid frukosten, hittas i yoghurten |
| (befintlig) lr-n1-olika-skor | story | roliga situationer | Pappas skor | Alva | Pappa går till jobbet i två olika skor |
| (befintlig) lr-n1-taltet | story | äventyr | Ett ljud i natten | Ebba | Prasslande ljud utanför tältet är en igelkott |
| (befintlig) lr-n1-ekorren | fact | djur | Ekorrens gömmor | — | Ekorren gömmer nötter inför vintern; glömda nötter blir träd |
| (befintlig) lr-n1-manen | fact | rymden | Månen byter form | — | Månens faser; månen lyser inte själv |
| (befintlig) lr-n1-snoflingor | fact | natur | Små stjärnor av is | — | Hur snöflingor bildas; sexuddiga och unika |
| lr-n1-matsacken | story | skola | Matsäcken som blev kvar | Ture | Glömd matsäck på utflykten, kompisarna delar med sig |
| lr-n1-brandovningen | story | skola | Larmet mitt i matten | Siri | Brandlarm mitt i matten visar sig vara en övning |
| lr-n1-tyst-larare | story | skola | Den tysta dagen | Dante, läraren Lisa | Läraren har tappat rösten, Dante läser högt från tavlan |
| lr-n1-handla-sjalv | story | vardag | Liam handlar själv | Liam | Handla själv första gången, hittar inte mjölken |
| lr-n1-pannkakor | story | vardag | Den svarta pannkakan | Selin | Första pannkakan bränns när Selin pratar i telefon |
| lr-n1-blomman | story | mysterier | Vem vattnar blomman? | Amanda, vaktmästaren Göran | Klassrumsväxten är alltid vattnad – vaktmästaren gör det tidigt |
| lr-n1-fotspar-snon | story | mysterier | Spåren i snön | Edvin, Mona | Fotspår till garaget leder till pappas gömda julklapp |
| lr-n1-kartan-brevladan | story | mysterier | Kartan i brevlådan | Juni, Fanny | Kritkarta i brevlådan är en inbjudan från ny granne |
| lr-n1-rosa-tvatten | story | roliga situationer | Allt blev rosa | Kasper | En röd strumpa färgar pappas vita skjortor rosa |
| lr-n1-aprilskamt | story | roliga situationer | Saltet i sockerskålen | Hanna, Joel | Aprilskämt med salt i sockerskålen slår tillbaka |
| lr-n1-gungan | story | relationer | En gunga för två | Moa, Lisen | Två vänner bråkar om en gunga och lär sig turas om |
| lr-n1-brevet | story | relationer | Ett brev med en älg | Ali, Sixten | Bästa vännen har flyttat, de håller kontakten med brev |
| lr-n1-on-i-sjon | story | äventyr | Ovädret på ön | Isak, morfar | Oväder på en ö, morfar väljer att vänta ut det under en gran |
| lr-n1-majslabyrinten | story | äventyr | Vilse i majsen | Lova | Vilse i majslabyrint, Lova följer solskyltarna |
| lr-n1-malvakten | story | sport | Zara står i mål | Zara | Inhoppande målvakt räddar en straff |
| lr-n1-skridskor | story | sport | Alfreds nya skridskor | Alfred, Tova | Lär sig åka skridskor med skridskohjälp |
| lr-n1-stafetten | story | sport | Pinnen på gruset | Nils, Wanda | Tappad stafettpinne, laget blir tvåa men han gav inte upp |
| lr-n1-myrstacken | fact | djur | Myrornas stack | — | Myrstackens samhälle, drottning/arbetare, doftspår |
| lr-n1-grodan | fact | djur | Från ägg till groda | — | Grodans utveckling: rom → yngel → groda |
| lr-n1-regnbagen | fact | natur | Färgerna i regnbågen | — | Hur regnbågen uppstår; färgordning, se den med solen i ryggen |
| lr-n1-hostloven | fact | natur | När löven byter färg | — | Varför löven byter färg och faller; barrträd gröna |
| lr-n1-solen | fact | rymden | Vår närmaste stjärna | — | Solen är en stjärna, enorm storlek, titta aldrig in i den |
| lr-n1-dag-och-natt | fact | rymden | Därför blir det natt | — | Jorden snurrar ett varv per dygn → dag och natt |
| lr-n1-magneten | fact | vetenskap | Magnetens hemliga kraft | — | Magneter: järn, nord-/sydpol, kompassnål |
| lr-n1-vattnets-former | fact | vetenskap | Is, vatten och ånga | — | Vatten som is, vätska och ånga |
| lr-n1-stenaldern | fact | historia | Verktyg av sten | — | Stenålderns verktyg av flinta, eld, från jakt till odling |
| lr-n1-borgen | fact | historia | Livet på borgen | — | Medeltida borg: vallgrav, vindbrygga, kallt inne |
| lr-n1-skolan-forr | fact | historia | Skolan för hundra år sedan | — | Skolan för drygt hundra år sedan: griffeltavla, sträng lärare |
| lr-n1-vindkraftverket | fact | teknik | Fläkten som gör el | — | Vindkraftverk: blad, generator, ingen el vid vindstilla |
| lr-n1-streckkoden | fact | teknik | Strecken på mjölkpaketet | — | Streckkoden i kassan läses med rött ljus |
| lr-n1-hissen | fact | teknik | Hur fungerar en hiss? | — | Hissens stållinor, motor, motvikt och bromsar |
| lr-n1-gotland | fact | geografi | Ön med stenjättarna | — | Gotland: Sveriges största ö, Visby ringmur, raukar, russ |
| lr-n1-floden | fact | geografi | Från källa till hav | — | Flodens väg från källa till mynning; städer vid floder |
| lr-n1-kartan | fact | geografi | Världen ovanifrån | — | Kartan: ovanifrån, färger, norr uppåt, teckenförklaring |
