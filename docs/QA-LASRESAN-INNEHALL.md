# Läsresan: kvalitetsgranskning av innehållsbanken (issue #409)

Oberoende granskning enligt spec §25 av hela banken på epic-branchen: `src/lasresan/content/bank/manifest.json` + `level-1.json` … `level-7.json`. Banken innehåller 42 texter och 319 frågor.
Granskad 2026-10-05 av Reviewer (#409). Varje text och varje fråga är läst som en noggrann elev skulle läsa dem. Siffrorna nedan är räknade av ett engångsskript i scratch, inte kodarnas självkontroller.

## Sammanfattning

- **Tekniskt grön.** `validateBank` (motor-epicets `validate.js` från #399:s worktree, importerad via absolut sökväg) ger **0 fel och 0 varningar**, med 42 giltiga texter (6 per nivå). Manifestet pekar på alla 7 filer, och inga filer saknas eller står utanför manifestet. Varje text har nivå = filens nivå.
- **Innehållet håller hög kvalitet.** Inga frågor saknar svar i texten, ingen har två rätta svar och inget answerIndex var fel. Texterna är riktiga och varierade och känns inte skolboksmässiga. Ämnesfördelningen följer Leads plan exakt.
- **106 ändringsrader** (en rad per ändrat alternativ eller stycke) är gjorda direkt i banken (logg längst ned). Inget id är ändrat. Ändringarna i korthet:
  - 1 rätt svar som angav fel orsak (`lr-n1-tanden` q4, Leads exempel).
  - 1 oavsiktlig motsägelse i en berättelse (`lr-n6-finalen`: regeln var redan uppfylld, så dilemmat föll).
  - 1 försvarbar distraktor (`lr-n5-stromavbrottet` q6).
  - 1 för stark formulering (`lr-n5-morfars-minne` q7, ”troligen” mot textens ”kanske”).
  - 1 felaktig kategori (`lr-n7-bilden-i-chatten` q6).
  - 2 tre-i-rad-positioner.
  - 1 faktaprecisering (knäckebröd).
  - 1 namnkrock (Tilde).
  - Resten är **längdbalansering av svarsalternativ** (se nedan).
- **Systematiskt fynd: längd som ledtråd.** På N1–N4 var rätt svar ofta det unikt längsta alternativet (N3: 25 av 43, N4: 24 av 48, med upp till 1,6× marginal). På N6–N7 var det tvärtom: rätt svar var nästan aldrig längst (1 av 48 och 1 av 54), så det längsta alternativet gick att utesluta. Båda ytterlägena är rättade genom att felalternativ förlängts eller rätt svar kortats, utan att innehållet ändrats.
- **Inget flaggat för omskrivning.** Ingen text ligger på fel nivå, ingen är ointressant och inga systematiska innehållsfel finns. Rekommendationerna till Lead står i ett eget avsnitt.

## Teknisk kontroll (punkt 6 och 11)

| kontroll | resultat |
|---|---|
| giltig JSON, alla 7 filer + manifest | ✅ |
| `manifest.levels` → 7 filer, alla finns, inga oregistrerade `level-*.json` | ✅ |
| `validateBank`: fel / varningar | ✅ 0 / 0 (ordantal, alternativdubbletter och positionsskevhet ingår i varningarna) |
| text-id unika och enligt `lr-n{N}-{slug}` (gemener, ascii) med N = `level` | ✅ 42/42 |
| fråge-id unika inom texten | ✅ (formatet är `q1…qN`, unikt per text och inte globalt) |
| exakt 4 alternativ och `answerIndex` 0–3 | ✅ 319/319 |
| 5–9 frågor per text | ✅ (6–9) |
| inga personnamn ur referenstexterna (Maja, Bosse, Erik …) | ✅ |
| huvudpersonernas namn unika i banken | ✅ efter ändring #106 (Tilde förekom två gånger) |

## Nivåtrappan (punkt 4, 8, 9 och 10)

| nivå | texter story/fact | ord min–max (snitt) | frågor | fakta | ordförst. | mellan rad. | helhet/slutsats | andel inferens (m+h) | rätt unikt längst |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 3/3 | 93–109 (100) | 36 | 24 | 6 | 0 | 6 | 17 % | 13/36 (36 %) |
| 2 | 3/3 | 109–133 (124) | 42 | 24 | 6 | 6 | 6 | 29 % | 16/42 (38 %) |
| 3 | 3/3 | 154–187 (176) | 43 | 13 | 12 | 12 | 6 | 42 % | 17/43 (40 %) |
| 4 | 3/3 | 193–213 (205) | 48 | 14 | 12 | 13 | 9 | 46 % | 18/48 (38 %) |
| 5 | 3/3 | 246–279 (263) | 48 | 9 | 10 | 17 | 12 | 60 % | 13/48 (27 %) |
| 6 | 3/3 | 296–336 (315) | 48 | 6 | 11 | 16 | 15 | 65 % | 7/48 (15 %) |
| 7 | 3/3 | 356–428 (389) | 54 | 7 | 10 | 21 | 16 | 69 % | 7/54 (13 %) |

”Rätt unikt längst” betyder att rätt svar är strikt längre än alla tre felalternativ. Ren slump ger ungefär 25 %. Före granskningen var värdena 14/36, 16/42, 25/43, 24/48, 12/48, 1/48 och 1/54.

**Bedömning:**
- **Ordantal.** Alla 42 texter ligger inom nivåns riktintervall, och snittet stiger jämnt: 100 → 124 → 176 → 205 → 263 → 315 → 389 ord. Intervallen överlappar knappt mellan nivåerna.
- **Andelen inferensfrågor** stiger monotont: 17 → 29 → 42 → 46 → 60 → 65 → 69 %. Faktafrågorna sjunker på motsvarande sätt (67 → 13 %).
- **Kategorierna.** Alla fyra kategorier förekommer i banken och på varje nivå från N2. N1 saknar `mellan_raderna` med avsikt: spec §16 säger ”mycket få inferenser”, och N1:s inferenser ligger som enkla orsaksfrågor i `helhet_slutsats`.
- **Språket.** N1 har korta huvudsatser och nästan ordagranna svar. N3 liknar referenstexten ”Bollen som försvann”, med dialog och flera personer. N5 kräver motiv och underförstått, som ”Den tomma platsen”. N6–N7 har resonerande faktatexter och perspektivberättelser, där felalternativen ligger nära det rätta (t.ex. köpte/sålde-förväxling, eller ”placeboeffekten försvinner” mot ”förväntningarna blir lika”).
- **Inget hopp i trappan.** N4→N5 är det största steget i ordförråd och meningsbyggnad, men det motsvarar specens egen skillnad mellan referenstexterna för nivå 3 och 5. Ingen nivå hoppar.
- **Story/fact** är 3/3 på varje nivå. De 14 ämneskategorierna används exakt 3 gånger var, på tre olika nivåer. Inga vinklar är dubblerade.
- **Faktakoll.** Stickprov på uppgifter som går att kontrollera, bland annat ISS (≈40 mil, ≈90 min/varv, ≈16 soluppgångar), Mars-dygnet (+≈40 min, −60 °C), flytten av Kiruna kyrka (sommaren 2025, ≈5 km), ökengränsen 25 cm, ≈300 biarter i Sverige, urbanisering ≈2007 och tryckerier i >200 städer inom 50 år. Alla stämmer. Knäckebröd preciserades (ändring i logg).

## Rätt svars position (punkt 7)

| nivå | A | B | C | D | frågor |
|---|---|---|---|---|---|
| 1 | 9 | 9 | 9 | 9 | 36 |
| 2 | 11 | 11 | 10 | 10 | 42 |
| 3 | 11 | 11 | 11 | 10 | 43 |
| 4 | 12 | 12 | 12 | 12 | 48 |
| 5 | 12 | 12 | 12 | 12 | 48 |
| 6 | 12 | 12 | 12 | 12 | 48 |
| 7 | 14 | 14 | 13 | 13 | 54 |
| **totalt** | 81 | 81 | 79 | 78 | 319 |

Fördelningen är jämn på varje nivå (max 14 mot min 13 på N7) och totalt (81/81/79/78). Inga tre likadana positioner följer på varandra i någon text efter ändringarna i `lr-n6-elevradet` och `lr-n7-overraskningen`. Positionsbytena gjordes parvis inom samma text, så nivåsiffrorna är oförändrade.

## Per text

Kolumnen f/o/m/h anger antal frågor per kategori: fakta / ordförståelse / mellan raderna / helhet-slutsats. ”Rätt pos.” anger rätt svars position fråga för fråga. Status ”åtgärdat” listar vilka frågor som ändrats (se loggen).

| id | nivå | typ | ämne | ord (intervall) | frågor | f/o/m/h | rätt pos. | status |
|---|---|---|---|---|---|---|---|---|
| `lr-n1-tanden` | 1 | story | vardag | 103 (60–110) | 6 | 4/1/0/1 | ACBDBC | åtgärdat (q4) |
| `lr-n1-olika-skor` | 1 | story | roliga situationer | 93 (60–110) | 6 | 4/1/0/1 | BABABD | OK |
| `lr-n1-taltet` | 1 | story | äventyr | 109 (60–110) | 6 | 4/1/0/1 | CBDABC | åtgärdat (q5, q3) |
| `lr-n1-ekorren` | 1 | fact | djur | 106 (60–110) | 6 | 4/1/0/1 | DDACAD | OK |
| `lr-n1-manen` | 1 | fact | rymden | 97 (60–110) | 6 | 4/1/0/1 | CDBABA | OK |
| `lr-n1-snoflingor` | 1 | fact | natur | 94 (60–110) | 6 | 4/1/0/1 | DCCADC | åtgärdat (q5) |
| `lr-n2-klassens-fisk` | 2 | story | skola | 122 (80–140) | 7 | 4/1/1/1 | ABCDBDA | åtgärdat (q6) |
| `lr-n2-jordgubbarna` | 2 | story | mysterier | 133 (80–140) | 7 | 4/1/1/1 | CDCBDAC | OK |
| `lr-n2-simhoppet` | 2 | story | sport | 131 (80–140) | 7 | 4/1/1/1 | BABDCAB | OK |
| `lr-n2-cykeln` | 2 | fact | teknik | 109 (80–140) | 7 | 4/1/1/1 | DCDBCAB | åtgärdat (q6) |
| `lr-n2-pingvinen` | 2 | fact | djur | 124 (80–140) | 7 | 4/1/1/1 | ABDBADA | OK |
| `lr-n2-utan-kylskap` | 2 | fact | historia | 122 (80–140) | 7 | 4/1/1/1 | DACBCCA | åtgärdat (brödtext, q5) |
| `lr-n3-nya-eleven` | 3 | story | relationer | 154 (120–190) | 7 | 2/2/2/1 | CDBDBAD | åtgärdat (q7) |
| `lr-n3-skolfotot` | 3 | story | roliga situationer | 178 (120–190) | 7 | 2/2/2/1 | ABACACB | åtgärdat (q4, q5) |
| `lr-n3-kanoten` | 3 | story | äventyr | 181 (120–190) | 7 | 2/2/2/1 | DDCDCBB | åtgärdat (q7, q2, q6) |
| `lr-n3-flyta-sjunka` | 3 | fact | vetenskap | 187 (120–190) | 7 | 2/2/2/1 | ADDCCDC | åtgärdat (q4) |
| `lr-n3-oknar` | 3 | fact | geografi | 187 (120–190) | 8 | 3/2/2/1 | BACBDBBA | åtgärdat (q1, q6) |
| `lr-n3-vikingaskepp` | 3 | fact | historia | 167 (120–190) | 7 | 2/2/2/1 | ABAACAC | åtgärdat (q3, q5, q6) |
| `lr-n4-talangshowen` | 4 | story | skola | 200 (150–230) | 8 | 2/2/2/2 | CADAABBC | OK |
| `lr-n4-lappen-i-boken` | 4 | story | mysterier | 193 (150–230) | 8 | 2/2/3/1 | BBCCBADD | åtgärdat (q5, q6, q8) |
| `lr-n4-orienteringen` | 4 | story | sport | 213 (150–230) | 8 | 3/2/2/1 | ABADACCA | åtgärdat (q1, q2, q3, q6, q7) |
| `lr-n4-rymdstationen` | 4 | fact | rymden | 204 (150–230) | 8 | 2/2/2/2 | CADDBACC | åtgärdat (q4, q8, q3) |
| `lr-n4-meddelandet` | 4 | fact | teknik | 212 (150–230) | 8 | 3/2/2/1 | BDCCADBB | åtgärdat (q4, q5) |
| `lr-n4-bina` | 4 | fact | natur | 210 (150–230) | 8 | 2/2/2/2 | CDADBBDD | åtgärdat (q8) |
| `lr-n5-stromavbrottet` | 5 | story | vardag | 259 (180–300) | 8 | 2/1/3/2 | BDCAACDB | åtgärdat (q6) |
| `lr-n5-morfars-minne` | 5 | story | relationer | 266 (180–300) | 8 | 1/2/3/2 | BCBCAADD | åtgärdat (q7) |
| `lr-n5-dimman` | 5 | story | äventyr | 279 (180–300) | 8 | 1/2/3/2 | ADCCDABB | OK |
| `lr-n5-somnen` | 5 | fact | vetenskap | 266 (180–300) | 8 | 2/1/2/3 | DCCBAADB | åtgärdat (q6) |
| `lr-n5-kiruna` | 5 | fact | geografi | 259 (180–300) | 8 | 1/2/3/2 | ACDBCABD | OK |
| `lr-n5-flyttfaglar` | 5 | fact | djur | 246 (180–300) | 8 | 2/2/3/1 | ADBDCCBA | OK |
| `lr-n6-elevradet` | 6 | story | skola | 296 (220–380) | 8 | 1/2/3/2 | BCCDADAD | åtgärdat (q4, q7, q3) |
| `lr-n6-stationshuset` | 6 | story | mysterier | 324 (220–380) | 8 | 1/2/3/2 | ACDBCABC | åtgärdat (q2) |
| `lr-n6-finalen` | 6 | story | sport | 303 (220–380) | 8 | 1/2/3/2 | BBCACBDD | åtgärdat (brödtext, q7) |
| `lr-n6-tryckpressen` | 6 | fact | historia | 308 (220–380) | 8 | 1/2/2/3 | BCADCBCA | åtgärdat (q1, q4) |
| `lr-n6-larande-datorer` | 6 | fact | teknik | 336 (220–380) | 8 | 1/2/2/3 | AABBDCBD | åtgärdat (q7) |
| `lr-n6-mars` | 6 | fact | rymden | 321 (220–380) | 8 | 1/1/3/3 | DAADBACD | åtgärdat (q5, q6) |
| `lr-n7-eken` | 7 | story | vardag | 428 (280–500) | 9 | 1/2/3/3 | CDABACDBC | åtgärdat (q5, q8) |
| `lr-n7-bilden-i-chatten` | 7 | story | relationer | 417 (280–500) | 9 | 1/0/6/2 | DBAADCCAB | åtgärdat (q6, q1, q8) |
| `lr-n7-overraskningen` | 7 | story | roliga situationer | 390 (280–500) | 9 | 1/2/3/3 | DACACBBDA | åtgärdat (q3, q9, q7) |
| `lr-n7-invasiva-arter` | 7 | fact | natur | 373 (280–500) | 9 | 2/2/2/3 | BADCBCBAD | åtgärdat (q1, q4) |
| `lr-n7-vetenskaplig-metod` | 7 | fact | vetenskap | 367 (280–500) | 9 | 1/2/3/3 | ABBADBCDC | åtgärdat (q3) |
| `lr-n7-staderna` | 7 | fact | geografi | 356 (280–500) | 9 | 1/2/4/2 | CACDDBADB | åtgärdat (q6) |

## Flaggat och rekommendationer till Lead

Inget kräver omskrivning. Följande är förslag:

1. **Längdledtråd i validatorn (motor-epic #398).** `validate.js` kontrollerar inte alternativens längd, och båda ytterlägena uppstod i alla fyra kodarleveranserna. Förslag: lägg till en varning per nivå när rätt svar är unikt längst i mer än cirka 45 % av frågorna, eller i mindre än cirka 10 %. Det gör framtida bankpåfyllnad självkontrollerande. Kvarvarande värden (N1–N4: 36–40 %) har mest små marginaler. Bara 1–4 frågor per nivå har ≥1,2× marginal, och de flesta av dem är naturliga, som ”Ett anteckningsblock” mot ”En korg”.
2. **Fråge-id `q1…qN` är bara unika per text.** Om lärarstatistiken eller försöksloggen (spec §21) behöver ett globalt fråge-id, bör motorn bilda `${text.id}:${q.id}`. Innehållet behöver inte ändras.
3. **N1 saknar `mellan_raderna`** med avsikt (se ovan). Vill ni ha alla fyra kategorier även på N1 räcker det att omkategorisera eller lägga till en lätt inferensfråga per text.

## Ändringslogg

Alla ändringar är gjorda i `src/lasresan/content/bank/level-*.json`. Formatet är oförändrat (2 mellanslag, `JSON.stringify(…, null, 2)`). Inga id, ingen ordning och inget antal frågor är ändrat. Rader markerade ”(samma fråga, längdbalans)” hör till närmast föregående motivering.

| # | text | fråga | typ | före → efter | varför |
|---|---|---|---|---|---|
| 1 | `lr-n1-tanden` | q4 | alternativ | ”Han vill lägga tanden under kudden” → ”Han kan inte hitta tanden” | Rätt svar angav ett bakgrundsskäl, inte orsaken till att Noah blir ledsen (tanden är borta). Nu stämmer svaret med orsaken. |
| 2 | `lr-n1-taltet` | q5 | alternativ | ”Ljudet kom från en liten igelkott” → ”Det var bara en igelkott” | Längdledtråd: rätt svar var 31 tecken, mot högst 28 för felalternativen. |
| 3 | `lr-n1-snoflingor` | q5 | alternativ | ”Den är mycket stor” → ”Den är större än alla andra” | Längdledtråd: rätt svar (28 tecken) var mycket längre än felalternativen (16–18). |
| 4 | `lr-n1-snoflingor` | q5 | alternativ | ”Den är mycket kall” → ”Den är kallare än vanlig is” | (samma fråga, längdbalans) |
| 5 | `lr-n2-cykeln` | q6 | alternativ | ”Du kan inte svänga längre” → ”Du kan inte svänga med styret längre” | Längdledtråd: rätt svar 37 tecken, felalternativen 20–25. |
| 6 | `lr-n2-cykeln` | q6 | alternativ | ”Bromsarna slutar fungera” → ”Bromsarna slutar fungera helt” | (samma fråga, längdbalans) |
| 7 | `lr-n2-cykeln` | q6 | alternativ | ”Framhjulet låser sig” → ”Framhjulet låser sig och stannar” | (samma fråga, längdbalans) |
| 8 | `lr-n2-utan-kylskap` | – | brödtext | ”Bröd torkades så att det blev hårt.” → ”Bröd bakades tunt och torkades så att det blev hårt.” | Faktaprecisering: knäckebröd är tunt bakat bröd som torkats, inte vilket bröd som helst som torkats. |
| 9 | `lr-n3-skolfotot` | q4 | alternativ | ”Trött och sömnig” → ”Trött och lite sömnig” | Längdledtråd: rätt svar 24 tecken, felalternativen 13–17. |
| 10 | `lr-n3-skolfotot` | q4 | alternativ | ”Arg och irriterad” → ”Arg och mycket irriterad” | (samma fråga, längdbalans) |
| 11 | `lr-n3-skolfotot` | q4 | alternativ | ”Glad och nöjd” → ”Glad och mycket nöjd” | (samma fråga, längdbalans) |
| 12 | `lr-n3-kanoten` | q7 | alternativ | ”De hjälptes åt och Tindra bytte sida när hon paddlade” → ”Viggo pekade och Tindra paddlade på båda sidor” | Längdledtråd: rätt svar 53 tecken, felalternativen högst 37. |
| 13 | `lr-n3-kanoten` | q7 | alternativ | ”De ropade på morbror Jonas om hjälp” → ”De ropade på morbror Jonas och väntade på hjälp” | (samma fråga, längdbalans) |
| 14 | `lr-n3-kanoten` | q7 | alternativ | ”Motorbåten drog dem fram till paddeln” → ”Motorbåten kom tillbaka och drog dem till paddeln” | (samma fråga, längdbalans) |
| 15 | `lr-n3-kanoten` | q7 | alternativ | ”Viggo hoppade i och simmade efter den” → ”Viggo hoppade i vattnet och simmade efter den” | (samma fråga, längdbalans) |
| 16 | `lr-n3-flyta-sjunka` | q4 | alternativ | ”Fartygets stora motor” → ”Den stora motorn längst bak i fartyget” | Längdledtråd: rätt svar 41 tecken, felalternativen högst 27. |
| 17 | `lr-n3-flyta-sjunka` | q4 | alternativ | ”Platsen där kaptenen styr” → ”Platsen högst upp där kaptenen styr” | (samma fråga, längdbalans) |
| 18 | `lr-n3-flyta-sjunka` | q4 | alternativ | ”Lasten som fartyget fraktar” → ”Lasten som fartyget fraktar över havet” | (samma fråga, längdbalans) |
| 19 | `lr-n3-vikingaskepp` | q3 | alternativ | ”Det var mycket tungt att bära” → ”Det var mycket tungt att bära över land” | Längdledtråd: rätt svar längst i 6 av 7 frågor i texten. |
| 20 | `lr-n3-vikingaskepp` | q5 | alternativ | ”Vikingar fick dem genom handel och tog med dem hem” → ”Vikingar tog hem dem från sina handelsresor” | Längdledtråd: rätt svar 50 tecken, felalternativen högst 33. |
| 21 | `lr-n3-vikingaskepp` | q5 | alternativ | ”Araber byggde städer i Sverige” → ”Araber kom hit och byggde städer i Sverige” | (samma fråga, längdbalans) |
| 22 | `lr-n3-vikingaskepp` | q5 | alternativ | ”Mynten spolades i land från havet” → ”Mynten spolades i land från havet efter en storm” | (samma fråga, längdbalans) |
| 23 | `lr-n3-vikingaskepp` | q6 | alternativ | ”Skeppen klarade både låga floder och färder över land” → ”Skeppen klarade grunda floder och kunde dras över land” | Längdledtråd: rätt svar 55 tecken, felalternativen högst 41. |
| 24 | `lr-n3-vikingaskepp` | q6 | alternativ | ”Det fanns en kanal hela vägen dit” → ”Det fanns en grävd kanal hela vägen från Sverige” | (samma fråga, längdbalans) |
| 25 | `lr-n3-vikingaskepp` | q6 | alternativ | ”Skeppen var större än alla andra skepp” → ”Skeppen var mycket större än andra skepp på den tiden” | (samma fråga, längdbalans) |
| 26 | `lr-n4-lappen-i-boken` | q5 | alternativ | ”Lappen slutade med G och Gunnels namn stod överst på lånekortet” → ”Lappen slutade med G, och Gunnel stod på lånekortet” | Längdledtråd: rätt svar 63 tecken, felalternativen högst 42. |
| 27 | `lr-n4-lappen-i-boken` | q5 | alternativ | ”Bibliotekarien hade sagt att det var hon” → ”Bibliotekarien Yvonne hade sagt att det var hon” | (samma fråga, längdbalans) |
| 28 | `lr-n4-lappen-i-boken` | q6 | alternativ | ”Hur många fåglar av tre sorter de hade räknat” → ”Antal fåglar av tre olika sorter” | Längdledtråd: rätt svar 45 tecken, felalternativen högst 31. |
| 29 | `lr-n4-lappen-i-boken` | q6 | alternativ | ”Ett datum då de skulle ses igen” → ”Ett datum då de två skulle ses igen” | (samma fråga, längdbalans) |
| 30 | `lr-n4-lappen-i-boken` | q6 | alternativ | ”Var boken stod på hyllorna” → ”Var boken stod på hyllorna i biblioteket” | (samma fråga, längdbalans) |
| 31 | `lr-n4-orienteringen` | q1 | alternativ | ”Vid en spång över ett dike” → ”Vid en smal spång över ett dike” | Längdledtråd: rätt svar var längst i alla 8 frågor i texten. |
| 32 | `lr-n4-orienteringen` | q1 | alternativ | ”Uppe på toppen av en sluttning” → ”Uppe på toppen av en brant sluttning” | (samma text, längdbalans) |
| 33 | `lr-n4-orienteringen` | q1 | alternativ | ”I en glänta med blåbärsris” → ”I en liten glänta full av blåbärsris” | (samma text, längdbalans) |
| 34 | `lr-n4-orienteringen` | q2 | alternativ | ”Vred den så att norrpilen pekade som kompassnålen” → ”Vred den tills norrpilen följde kompassnålen” | (samma text, längdbalans) |
| 35 | `lr-n4-orienteringen` | q2 | alternativ | ”Vände den upp och ner” → ”Vände den upp och ner för att se bättre” | (samma text, längdbalans) |
| 36 | `lr-n4-orienteringen` | q2 | alternativ | ”Lade den på stenen och ritade på den” → ”Lade den på stenen och ritade en ny väg” | (samma text, längdbalans) |
| 37 | `lr-n4-orienteringen` | q2 | alternativ | ”Visade den för en annan löpare” → ”Visade den för en annan löpare som sprang förbi” | (samma text, längdbalans) |
| 38 | `lr-n4-orienteringen` | q3 | alternativ | ”Det fanns ingen spång över det” → ”Det fanns ingen spång över vattnet där” | (samma text, längdbalans) |
| 39 | `lr-n4-orienteringen` | q3 | alternativ | ”Ronny hade varnat henne för diket” → ”Ronny hade varnat henne för just det diket” | (samma text, längdbalans) |
| 40 | `lr-n4-orienteringen` | q3 | alternativ | ”Det rann åt motsatt håll mot bäcken på kartan” → ”Vattnet rann åt fel håll jämfört med kartan” | (samma text, längdbalans) |
| 41 | `lr-n4-orienteringen` | q6 | alternativ | ”Det lönar sig att stanna och tänka i stället för att springa fel” → ”Det lönar sig att stanna och tänka efter” | Längdledtråd: rätt svar 64 tecken, felalternativen högst 40. |
| 42 | `lr-n4-orienteringen` | q7 | alternativ | ”Hon var stolt över att hon hade löst problemet själv” → ”Hon var stolt över att ha löst problemet” | (samma text, längdbalans) |
| 43 | `lr-n4-orienteringen` | q7 | alternativ | ”Hon hade slagit sitt eget rekord” → ”Hon hade slagit sitt eget rekord på banan” | (samma text, längdbalans) |
| 44 | `lr-n4-rymdstationen` | q4 | alternativ | ”Som att näsan är stoppad, som vid en förkylning” → ”Som att näsan är igenstoppad” | Längdledtråd: rätt svar 47 tecken, felalternativen högst 30. |
| 45 | `lr-n4-rymdstationen` | q8 | alternativ | ”Det är farligt att resa till rymden” → ”Det är alldeles för farligt att resa till rymden” | Längdledtråd: rätt svar 59 tecken, felalternativen högst 42. |
| 46 | `lr-n4-rymdstationen` | q8 | alternativ | ”Astronauterna tränar mer än de arbetar” → ”Astronauterna tränar mer än de arbetar ombord” | (samma fråga, längdbalans) |
| 47 | `lr-n4-rymdstationen` | q8 | alternativ | ”Tyngdlösheten påverkar nästan allt i astronauternas vardag” → ”Tyngdlösheten påverkar astronauternas hela vardag” | (samma fråga, längdbalans) |
| 48 | `lr-n4-rymdstationen` | q8 | alternativ | ”Rymdstationen är världens snabbaste fordon” → ”Rymdstationen är det snabbaste fordon som finns” | (samma fråga, längdbalans) |
| 49 | `lr-n4-meddelandet` | q4 | alternativ | ”Mycket kortare tid än en sekund” → ”Långt under en sekund” | Längdledtråd: rätt svar 31 tecken, felalternativen högst 20. |
| 50 | `lr-n4-meddelandet` | q5 | alternativ | ”Ett högt torn som tar emot och skickar signaler” → ”Ett torn som tar emot och skickar signaler” | Längdledtråd: rätt svar 47 tecken, felalternativen högst 33. |
| 51 | `lr-n4-meddelandet` | q5 | alternativ | ”En kabel som ligger på havsbotten” → ”En lång kabel som ligger på havsbotten” | (samma fråga, längdbalans) |
| 52 | `lr-n4-meddelandet` | q5 | alternativ | ”En liten dator inuti mobilen” → ”En liten dator som sitter inuti mobilen” | (samma fråga, längdbalans) |
| 53 | `lr-n4-bina` | q8 | alternativ | ”Utan bin skulle vi få mycket mindre frukt, bär och grönsaker” → ”Utan bin skulle det finnas mindre frukt och bär” | Längdledtråd: rätt svar 61 tecken, felalternativen högst 47. |
| 54 | `lr-n5-stromavbrottet` | q6 | alternativ | ”Att Vide hade varit mycket modigare än hon själv hade trott” → ”Att Vide inte ens hade märkt att strömmen gick” | Försvarbar distraktor: ”Inte för Vide” kunde läsas som att Vide var modig. Nytt felalternativ motsägs tydligt av texten (Vide ropar i mörkret). |
| 55 | `lr-n5-morfars-minne` | q7 | alternativ | ”Att morfar troligen redan hade glömt att han fångat abborren” → ”Att morfar kanske verkligen hade glömt att han fångat abborren” | Precisering: texten säger ”kanske”, rätt svar sa ”troligen”. Nu stämmer graden med texten. |
| 56 | `lr-n6-finalen` | – | brödtext | ”som bara hade fått spela ett kort byte var under hela matchen” → ”som ännu inte hade fått spela en enda minut av matchen” | Oavsiktlig motsägelse: Tilde och Omar hade redan spelat, så regeln ”alla ska spela” var uppfylld och Nellys dilemma föll. Nu har de inte spelat alls. |
| 57 | `lr-n6-finalen` | – | brödtext | ”Tilde hade suttit på bänken nästan hela matchen” → ”Tilde hade suttit på bänken hela matchen” | (följdändring till ovan) |
| 58 | `lr-n6-elevradet` | q4 | positionsbyte | alternativ A ⇄ D | Positionsrad: rätt svar var D i tre frågor i rad (q6–q8). q4 A→D och q7 D→A, så nivåns fördelning är oförändrad. |
| 59 | `lr-n6-elevradet` | q7 | positionsbyte | alternativ A ⇄ D | (se ovan) |
| 60 | `lr-n7-overraskningen` | q3 | positionsbyte | alternativ A ⇄ C | Positionsrad: rätt svar var A i tre frågor i rad (q2–q4). q3 A→C och q9 C→A, så nivåns fördelning är oförändrad. |
| 61 | `lr-n7-overraskningen` | q9 | positionsbyte | alternativ A ⇄ C | (se ovan) |
| 62 | `lr-n7-bilden-i-chatten` | q6 | kategori | ”ordforstaelse” → ”mellan_raderna” | Fel kategori: ”Vad är den tredje väg som Arvid väljer?” prövar förståelse av handlingen, inte ett ords betydelse. |
| 63 | `lr-n1-taltet` | q3 | alternativ | ”Hon andas mycket fort” → ”Hon andas mycket fort och högt” | Längdledtråd: rätt svar var tydligt längst. (31 mot högst 21 tecken) |
| 64 | `lr-n1-taltet` | q3 | alternativ | ”Hon håller i tältet” → ”Hon håller hårt i tältet” | (samma fråga, längdbalans) |
| 65 | `lr-n1-taltet` | q3 | alternativ | ”Hon somnar direkt” → ”Hon somnar direkt i sovsäcken” | (samma fråga, längdbalans) |
| 66 | `lr-n2-klassens-fisk` | q6 | alternativ | ”Skrattar högt för att han är glad” → ”Skrattar högt för att han är jätteglad” | Längdledtråd: rätt svar var tydligt längst. (43 mot högst 34 tecken) |
| 67 | `lr-n2-klassens-fisk` | q6 | alternativ | ”Hoppar upp för att han är förvånad” → ”Hoppar upp för att han är mycket förvånad” | (samma fråga, längdbalans) |
| 68 | `lr-n2-utan-kylskap` | q5 | alternativ | ”Så att ingen skulle hitta isen” → ”Så att ingen skulle kunna hitta isen” | Längdledtråd: rätt svar var tydligt längst. (38 mot högst 30 tecken) |
| 69 | `lr-n2-utan-kylskap` | q5 | alternativ | ”Så att isen skulle lukta gott” → ”Så att isen skulle få en god lukt” | (samma fråga, längdbalans) |
| 70 | `lr-n3-nya-eleven` | q7 | alternativ | ”Hur man lånar böcker i skolans bibliotek” → ”Hur man lånar och lämnar tillbaka böcker i biblioteket” | Längdledtråd: rätt svar var tydligt längst. (51 mot högst 40 tecken) |
| 71 | `lr-n3-nya-eleven` | q7 | alternativ | ”Varför Samira flyttade till Sverige” → ”Varför Samira och hennes familj flyttade till Sverige” | (samma fråga, längdbalans) |
| 72 | `lr-n3-skolfotot` | q5 | alternativ | ”Han ville inte bli stucken eller förstöra bilden” → ”Han ville inte bli stucken eller förstöra fotot” | Längdledtråd: rätt svar var tydligt längst. (48 mot högst 37 tecken) |
| 73 | `lr-n3-skolfotot` | q5 | alternativ | ”Han märkte inte att den satt där” → ”Han märkte inte att den satt där på näsan” | (samma fråga, längdbalans) |
| 74 | `lr-n3-skolfotot` | q5 | alternativ | ”Bertil sa åt honom att låta den sitta” → ”Fotografen Bertil sa åt honom att låta den sitta” | (samma fråga, längdbalans) |
| 75 | `lr-n3-kanoten` | q2 | alternativ | ”Vågor från en motorbåt fick kanoten att gunga” → ”En motorbåts vågor fick kanoten att gunga” | Längdledtråd: rätt svar var tydligt längst. (45 mot högst 34 tecken) |
| 76 | `lr-n3-kanoten` | q2 | alternativ | ”Viggo tappade den när han paddlade” → ”Viggo tappade den medan han paddlade fort” | (samma fråga, längdbalans) |
| 77 | `lr-n3-kanoten` | q2 | alternativ | ”Tindra råkade knuffa till den” → ”Tindra råkade knuffa till den med armbågen” | (samma fråga, längdbalans) |
| 78 | `lr-n3-kanoten` | q2 | alternativ | ”En stark vind blåste ner den” → ”En plötslig vindby blåste ner den i sjön” | (samma fråga, längdbalans) |
| 79 | `lr-n3-kanoten` | q6 | alternativ | ”De hade ett litet äventyr som bara de visste om” → ”De delade ett hemligt litet äventyr” | Längdledtråd: rätt svar var tydligt längst. (47 mot högst 39 tecken) |
| 80 | `lr-n3-oknar` | q1 | alternativ | ”Att det blir varmare än 40 grader” → ”Att det blir varmare än 40 grader på dagen” | Längdledtråd: rätt svar var tydligt längst. (42 mot högst 33 tecken) |
| 81 | `lr-n3-oknar` | q1 | alternativ | ”Att marken är täckt av sand” → ”Att marken till största delen är täckt av sand” | (samma fråga, längdbalans) |
| 82 | `lr-n3-oknar` | q6 | alternativ | ”Det faller nästan ingen ny snö eller regn” → ”Det faller nästan ingen snö eller regn” | Längdledtråd: rätt svar var tydligt längst. (41 mot högst 33 tecken) |
| 83 | `lr-n3-oknar` | q6 | alternativ | ”Under isen finns det sand” → ”Under isen finns det sand och sten” | (samma fråga, längdbalans) |
| 84 | `lr-n3-oknar` | q6 | alternativ | ”Det är varmt där på sommaren” → ”Det blir ganska varmt där på sommaren” | (samma fråga, längdbalans) |
| 85 | `lr-n4-rymdstationen` | q3 | alternativ | ”Att allt väger mer än på jorden” → ”Att allt väger mycket mer än på jorden” | Längdledtråd: rätt svar var tydligt längst. (45 mot högst 33 tecken) |
| 86 | `lr-n4-rymdstationen` | q3 | alternativ | ”Att man blir lättare av att träna” → ”Att man blir lättare av att träna mycket” | (samma fråga, längdbalans) |
| 87 | `lr-n4-lappen-i-boken` | q8 | alternativ | ”Lägger tillbaka lappen i boken” → ”Lägger tillbaka lappen i fågelboken igen” | Längdledtråd: rätt svar var tydligt längst. (41 mot högst 30 tecken) |
| 88 | `lr-n4-lappen-i-boken` | q8 | alternativ | ”Letar efter en ny hemlig lapp” → ”Letar efter en ny hemlig lapp i boken” | (samma fråga, längdbalans) |
| 89 | `lr-n6-elevradet` | q3 | alternativ | ”Hon tror att han helst vill slippa vara ute och frysa på rasterna” → ”Hon tror att han vill slippa frysa ute på rasterna” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 90 | `lr-n6-stationshuset` | q2 | alternativ | ”Han är rädd att mannen ska låsa in dem i det gamla huset” → ”Han är rädd att mannen ska låsa in dem i huset” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 91 | `lr-n6-finalen` | q7 | alternativ | ”Tränarens order och det som föräldrarna vill att hon ska göra” → ”Tränarens order och det som föräldrarna vill” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 92 | `lr-n6-tryckpressen` | q1 | alternativ | ”Han använde bokstäver av trä i stället för bokstäver av metall” → ”Han använde bokstäver av trä i stället för metall” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 93 | `lr-n6-tryckpressen` | q4 | alternativ | ”Kyrkan började kräva att alla skulle kunna läsa bibeln själva” → ”Kyrkan började kräva att alla skulle läsa bibeln” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 94 | `lr-n6-larande-datorer` | q7 | alternativ | ”Datorer som använder AI går ofta sönder och måste då lagas av människor” → ”Datorer med AI går ofta sönder och måste lagas av människor” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 95 | `lr-n6-mars` | q5 | alternativ | ”De handlar om hur raketerna ska byggas för att klara resan” → ”De handlar om hur raketerna ska byggas” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 96 | `lr-n6-mars` | q6 | alternativ | ”För att varna för att det kan vara farligt att möta okända varelser där” → ”För att varna för farliga okända varelser på Mars” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 97 | `lr-n7-eken` | q5 | alternativ | ”Han tycker att Idun är för ung för att gå till grannar ensam” → ”Han tycker att Idun är för ung för att gå dit ensam” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 98 | `lr-n7-eken` | q8 | alternativ | ”Att Idun har fått i uppgift att städa i grannens trädgård varje höst” → ”Att Idun måste städa i grannens trädgård varje höst” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 99 | `lr-n7-bilden-i-chatten` | q1 | alternativ | ”Han kände igen kontot utan namn som ett gammalt konto som Melvin hade” → ”Han kände igen kontot utan namn som Melvins gamla konto” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 100 | `lr-n7-bilden-i-chatten` | q8 | alternativ | ”Viljan att vara populär i klassen mot viljan att lyckas i skolan” → ”Viljan att vara populär mot viljan att lyckas i skolan” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 101 | `lr-n7-overraskningen` | q7 | alternativ | ”Det visar att Teo i hemlighet hade avslöjat hela planen för mamma” → ”Det visar att Teo i hemlighet hade avslöjat planen” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 102 | `lr-n7-invasiva-arter` | q1 | alternativ | ”Minken för pälsfarmar, lupinen med jord från andra länder och snigeln som ett sällskapsdjur” → ”Minken för pälsfarmar, lupinen med jord från andra länder och snigeln som husdjur” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 103 | `lr-n7-invasiva-arter` | q4 | alternativ | ”Lupinen tar all näring ur jorden så att inga andra blommor kan växa” → ”Lupinen tar all näring ur jorden så att inget annat växer” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 104 | `lr-n7-staderna` | q6 | alternativ | ”När människor flyttar fram och tillbaka mellan stad och land” → ”När folk flyttar fram och tillbaka mellan stad och land” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 105 | `lr-n7-vetenskaplig-metod` | q3 | alternativ | ”Det är förbjudet att ge nya läkemedel till människor som är sjuka” → ”Det är förbjudet att ge nya läkemedel till sjuka” | Omvänd längdledtråd: på N6–N7 var rätt svar nästan aldrig längst (1 av 48 resp. 1 av 54), så det längsta alternativet gick att utesluta. Det längsta felalternativet kortades. |
| 106 | `lr-n5-somnen` | q6 | frågetext | ”Tilde har sovit …” → ”Moa har sovit …” | Namnkrock: Tilde är redan en person i lr-n6-finalen. Namnen ska vara unika i banken. |
