# Läsresan: helhetsgranskning av textbanken med 40 texter per nivå (issue #514)

Det här är en granskning av hela banken efter epic #482, där alla sju nivåer fick 40 texter: `src/lasresan/content/bank/level-1.json` … `level-7.json`. Banken har 280 texter och 2 121 frågor.
Varje nivå har redan granskats av den som skrev den (#507–#513). Den här granskningen gäller det som bara syns när man ser på hela banken: dubbletter mellan nivåer, trappan från nivå 1 till 7, statistik över hela banken och laddningen.
Granskad 2026-10-08 av Reviewer (#514), med #409 (`QA-LASRESAN-INNEHALL.md`) som förebild. Alla siffror är räknade med engångsskript mot grenen efter ändringarna, alltså inte hämtade ur kodarnas egna självkontroller.

## Sammanfattning

- **Tekniskt grön.** `validateBank` över alla 280 poster ger **0 fel och 0 varningar**, och `validTexts` = **40 per nivå** (1–7). `node --test test/lasresan-*.test.js` ger 90/90 gröna. Alla text-id och titlar är unika. Ingen text har tre rätta svar i rad på samma position.
- **12 fynd av dubbletter och nästan-dubbletter mellan nivåer, alla åtgärdade.** De flesta fanns mellan nivå 2 och 3, som skrevs parallellt av samma modell: sex identiska faktaämnen (två av dem med samma titel) och en identisk berättelsepremiss. Dessutom fanns fyra premisskrockar mellan nivå 2/3 och 5/6, och en mellan 5 och 6.
- **Omskrivet: 10 texter helt nya och 2 delvis omskrivna.** Nio nya texter på nivå 2 och en på nivå 3. Två texter har en omskriven premiss (N3 `delat-rum` och N5 `robotdammsugaren`), och en replik är utbytt (N6 `potatisen`). Varje ny text har samma ämneskategori, samma antal frågor och samma position för rätt svar per fråga som texten den ersätter. Därför är nivåernas fördelning A–D och fördelning per ämne oförändrad.
- **Namn.** Sex namnkrockar mellan nivåer är åtgärdade genom byte, och fem till försvann med omskrivningarna. Ett referensnamn (Mira) är bytt. Nu delar inga berättelser huvud- eller bipersonsnamn mellan nivåer.
- **Svårighetstrappan stiger** i ordantal, meningslängd, ordlängd och andel inferensfrågor. Ett undantag är att andelen inferensfrågor planar ut mellan N4 och N5 (45 → 44 %). Det är en iakttagelse, inget fel.
- **Öppna fynd:** laddningen hämtar hela banken (≈ 1,24 MB, ≈ 310 kB gzip) innan elevens första nya text visas (F1, låg). Rätt svar är unikt längst i 42 % av ordförståelsefrågorna på N1 (F2, låg). Se ”Öppna fynd”.

## 1. Teknisk kontroll

| kontroll | resultat |
|---|---|
| `validateBank` (alla 280 poster): fel / varningar | ✅ 0 / 0 |
| `validTexts` per nivå 1–7 | ✅ 40 / 40 / 40 / 40 / 40 / 40 / 40 |
| `node --test test/lasresan-*.test.js` | ✅ 90 pass, 0 fail |
| text-id unika (280) och titlar unika (280) | ✅ |
| ordantal inom `LEVEL_WORD_RANGES` | ✅ 280/280 (0 utanför) |
| tre likadana rätt-positioner i rad inom en text | ✅ 0 |
| referensnamn (Maja, Bosse, Erik, Helmer, Clara, Ines, Hussein, Leo, Mira, Amir, Nora) | ✅ 0 efter byte (Mira i `lr-n1-gungan` → Mila) |
| personnamn i berättelser som delas mellan nivåer | ✅ 0 efter åtgärd (se 2.3) |

## 2. Dubbletter och nästan-dubbletter mellan nivåer

Metod: alla 280 texter listades per ämneskategori med titel och första mening, och listan lästes i sin helhet. Kandidaterna lästes sedan i full text. Därefter jämfördes titlarna automatiskt (normaliserade ord) och personnamnen i alla berättelser (versalord som någon gång står mitt i en mening).

### 2.1 Åtgärdade fynd

”Ny text” betyder att texten är helt omskriven, med nytt id, ny titel, ny brödtext och nya frågor. Den svagare eller mest överlappande texten skrevs om. Där båda var lika bra behölls den rikare texten på nivå 3, eftersom den nyttjar sin nivå bättre.

| # | krock | nivåer | åtgärd |
|---|---|---|---|
| D1 | Bläckfisken: åtta armar, inget skelett, färgbyte, bläck, tre hjärtan, burklocket | N2 `blackfisken` ↔ N3 `blackfisken` | N2 → ny text `lr-n2-hackspetten` ”Trummisen i skogen” |
| D2 | Island, ”landet av is och eld” / ”eld och is”: glaciärer, vulkaner, Geysir, värmer husen | N2 `island` ↔ N3 `island` | N2 → ny text `lr-n2-skargarden` ”Tusentals öar” |
| D3 | Åskan, **samma titel** ”Blixt och dunder”, samma öppning och regeln ”räkna sekunder och dela med tre” | N2 `askan` ↔ N3 `askan` | N2 → ny text `lr-n2-blasten` ”Varför blåser det?” |
| D4 | Svampar: mycel, varken växt eller djur, byter socker mot vatten med träd, giftiga | N2 `svampar` ↔ N3 `svamparna` | N2 → ny text `lr-n2-arsringarna` ”Trädets dagbok” |
| D5 | Kometer, ”smutsig snöboll”: svansen pekar bort från solen, Halley 1986/2061 | N2 `kometen` ↔ N3 `kometer` | N2 → ny text `lr-n2-solformorkelsen` ”Mörkt mitt på dagen” |
| D6 | Saturnus, **samma första mening**: kan flyta, ringar av is och sten, över hundra månar | N2 `saturnus` ↔ N3 `saturnus` | N2 → ny text `lr-n2-vintergatan` ”Ett band av stjärnor” |
| D7 | Premiss: papegojan säger något pinsamt inför en finklädd gäst, som skrattar | N2 `papegojan` ↔ N3 `papegojan` | N2 → ny text `lr-n2-hickan` ”Hicka i biblioteket” |
| D8 | Premiss: första resan ensam, distraheras, åker förbi stationen och tar sig tillbaka | N2 `bussen` ↔ N5 `tunnelbanan` (och N3 `tagresan`: ensam till farmor) | N2 → ny text `lr-n2-punkan` ”Bubblorna i baljan” |
| D9 | Premiss: mystisk återkommande kvällssignal från en granne vid fast klockslag, som visar sig vara en ensam person som söker kontakt | N2 `pianot` ↔ N6 `ljussignalerna` | N2 → ny text `lr-n2-strumporna` ”Var tar strumporna vägen?” |
| D10 | Premiss: bästisar sedan förskolan, den ena får en ny vän, svartsjuka, sedan blir de tre | N3 `handslaget` ↔ N6 `nya-kompisen` | N3 → ny text `lr-n3-lillebror` ”Lillebror härmar” |
| D11 | Samma öppning: ”När mamma och X flyttade ihop fick Y en bonussyster/-bror … ett år yngre än Y” | N3 `delat-rum` ↔ N6 `bonusbrodern` | N3 delvis omskriven: Alba är nu **kusin** som bor hos Juli ett halvår (inte bonussyster), q6/q7-alternativen är anpassade och Lejla heter nu Alba. Lakanet och åskvädret ligger kvar. |
| D12 | Premiss: tekniken krånglar inför förälderns **chef**, chefen skrattar och delar en egen historia | N5 `robotdammsugaren` ↔ N6 `potatisen` | N5: gästen är nu **den nya grannen Siv** (4 alternativ anpassade). N6: chefens replik ”det roligaste möte vi har haft på hela året” är utbytt, eftersom den ekade N6 `luciatoget` (”den roligaste lucia vi har haft på tjugo år”). |

De nya texternas ämnen kontrollerades mot alla 280 texter. Hackspett och Vintergatan nämns i förbigående på N5/N6 (`dod-ved`, `svarta-hal`) men är inte ämnet där. Skärgården förekommer bara som miljö i berättelser. Solförmörkelse och årsringar fanns inte alls.

### 2.2 Granskade likheter som får stå kvar

Här delar texterna ett motiv men har olika konflikt, lösning eller vinkel. Ingen av dem är omskriven:

- **”Första gången ensam”:** N1 `handla-sjalv` (handla), N3 `tagresan` (tåget stannar, konduktören hjälper), N4 `cykla-sjalv` (avspärrad väg, omväg) och N5 `tunnelbanan` (åker för långt, slut på batteri).
- **Barn lagar mat och misslyckas:** N1 `pannkakor` (bränner den första när hon pratar i telefon) och N4 `middagen` (räknar om receptet, matsked salt).
- **Fynd på vinden:** N2 `vinden` (farfars skattkarta), N3 `kodlaset` (kodlås och brev) och N5 `dorren` (ett foto avslöjar en igensatt dörr).
- **Återkommande mysterium med oskyldig förklaring:** N1 `blomman` (vaktmästaren) och N3 `daggen` (dagg, naturvetenskaplig lösning).
- **Vänskap som förändras:** N6 `nya-kompisen` (en tredje vän) och N7 `glida-isar` (växer isär, ingen tredje person).
- **Styvfamilj:** N6 `bonusbrodern` (bonusbror som känner sig som gäst) och N7 `ladbilen` (bonuspappa som försöker för mycket).
- **Pinsamt ögonblick som blir lyckat:** N3 `papegojan`, N4 `talangshowen`, N5 `robotdammsugaren`, N6 `potatisen` och N6 `luciatoget`. Efter D7 och D12 delar inga två samma premiss, men mönstret är vanligt bland roliga situationer. *Råd till framtida texter: välj ett annat slut.*
- **Faktaämnen som gränsar till varandra:** månen N1 och månlandningen N4; laxen N4, ålen N6 och flyttfåglar N5 (olika arter och vinklar); kometer N3 (nämner stjärnfall) och meteoriten N7; vattnets former N1 och isen på sjön N3; pingvinen N2 och antarktis N7; hackspetten N2 och död ved N6 (där hackspettens bohål är en detalj).

### 2.3 Namn

| namn | krock | åtgärd |
|---|---|---|
| Mira | referensnamn (#404-regeln) | `lr-n1-gungan` → **Mila** |
| Elton | N2 `nyckeln` ↔ N3 `hundvakten` | N2 → **Alvar** |
| Agnes | N2 `skidloppet` ↔ N3 `kodlaset` | N2 → **Edla** |
| Elvira | N2 `hemligheten` ↔ N3 `kodlaset` | N2 → **Rut** |
| Signe | N2 `flytten` ↔ N3 `teckningarna` | N2 → **Tilda** |
| Måns | N2 `frisyren` ↔ N3 `grupparbetet` | N2 → **Hjalte** |
| Lejla, Mattias | N2 `hemligheten`/`solrosen` ↔ N3 `delat-rum` | försvann med D11 (Lejla → Alba) |
| Nova | N2 `pianot` ↔ N3 `daggen` | försvann med D9 |
| Stella, Wilda | N2 `fel-kalas`/`glasogonen` ↔ N3 `handslaget` | försvann med D10 |

Kvar finns Inga-Lill (N3, kokerska) och farmor Inga (N6). Det är olika namn, så de får stå. Ortnamn och ”Herr …” räknas inte.

## 3. Svårighetstrappan

Hela banken är mätt, inte bara stickprov. ”Inferens” = `mellan_raderna` + `helhet_slutsats`.

| nivå | ord min–max (snitt) | `LEVEL_WORD_RANGES` | ord/mening | bokstäver/ord | ord ≥ 7 bokstäver | frågor/text | inferens |
|---|---|---|---|---|---|---|---|
| 1 | 87–109 (98) | 60–110 | 6,8 | 4,25 | 11 % | 6 | 24 % |
| 2 | 109–134 (121) | 80–140 | 7,5 | 4,48 | 15 % | 7 | 30 % |
| 3 | 154–188 (173) | 120–190 | 9,0 | 4,46 | 16 % | 7 (en text 8) | 43 % |
| 4 | 185–230 (209) | 150–230 | 9,7 | 4,56 | 17 % | 8 | 45 % |
| 5 | 225–284 (258) | 180–300 | 10,5 | 4,53 | 17 % | 8 | 44 % |
| 6 | 266–341 (306) | 220–380 | 11,1 | 4,54 | 17 % | 8 | 52 % |
| 7 | 356–473 (414) | 280–500 | 11,7 | 4,67 | 19 % | 9 | 59 % |

**Stickprov.** Fem texter per nivå valdes slumpvis med fast frö, alltså 35 texter (`snoflingor, handla-sjalv, taltet, vattnets-former, majslabyrinten / stjarnbilder, ridturen, frisyren, solrosen, hieroglyfer / skolfotot, isen-pa-sjon, pyramiderna, antika-os, norrsken / statisk-elektricitet, rymdstationen, bokredovisningen, matsvinnet, ursakten / pantburken, fel-vaska, vasaskeppet, kebnekaise, dimman / hundspannet, dod-ved, kryptering, snoskred, tryckpressen / volten, myggan, gastboken, fabrikerna, oversattningen`). Till det kommer de 12 texter som ändrades. Alla lästes i sin helhet med frågor.

**Bedömning:**
- **Ordantal och meningslängd stiger utan hopp.** Inga intervall överlappar mer än marginellt. Det största steget i ordantal är N6 → N7, och det motsvarar specens egna intervall.
- **Ordförrådet stiger.** På N1–N2 är orden konkreta och vardagliga (”vispar”, ”skutt”, ”stirrar”). På N3–N4 kommer bildspråk (”stel som en pinne”, ”halsen snördes ihop”). På N5–N6 kommer facktermer som förklaras i texten (”valsas”, ”porös”, ”obehöriga”, ”flakskred”), och på N7 abstrakta begrepp och resonemang (”motståndskraftiga”, ”avvägningar”, ironi i titeln på `oversattningen`).
- **Abstraktionen stiger.** N1 har sak- och orsaksfrågor nästan ordagrant ur texten. N3 har motiv och bildspråk. N5 kräver tolkning av underförstådda känslor (`dimman`, `fel-vaska`). N6–N7 har resonerande faktatexter med för- och nackdelar (`myggan`, `tryckpressen`, `fabrikerna`) och berättelser där huvudpersonens insikt aldrig sägs rakt ut (`volten`, `gastboken`).
- **Iakttagelse: N4 → N5 planar ut i frågetyp** (inferens 45 → 44 %, fakta 30 → 33 %), medan ordantal och meningslängd fortsätter att stiga. Det är inget fel, men N5 kan ta några fler inferensfrågor när texter byts ut.
- **N1–N2 passar mellanstadiet och känns inte som förskola.** Miljöerna är klass 4B, idrottsdag, att handla själv, en majslabyrint och fakta om vatten, månen och streckkoder. Ett par N1-berättelser har ett yngre tilltal (gosedjuret i `taltet`, mjölktanden i `tanden`). De fungerar för en svag läsare i åk 4 och behöver inte ändras.

## 4. Frågor

**Stickprov (35 + 12 texter):** varje fråga har exakt ett rätt svar som går att besvara ur texten. Inga försvarbara distraktorer hittades. Pantburkens årtal (1984 för burkar, 1994 för PET) och Vasa, Kebnekaise, malaria, Beurling och Factory Act/1881 är faktakontrollerade och stämmer. En svag fråga hittades: `lr-n6-hundspannet` q5 (”Varför tittade hundarna bakåt?” → ”De ville fortsätta springa”). Den är bara löst förankrad i textens skämtsamma bild, men de andra tre alternativen är tydligt fel, så den får stå.

### Rätt svars position (alla frågor)

| nivå | A | B | C | D | frågor |
|---|---|---|---|---|---|
| 1 | 60 | 60 | 60 | 60 | 240 |
| 2 | 71 | 70 | 69 | 70 | 280 |
| 3 | 70 | 70 | 71 | 70 | 281 |
| 4 | 80 | 80 | 80 | 80 | 320 |
| 5 | 80 | 80 | 80 | 80 | 320 |
| 6 | 80 | 80 | 80 | 80 | 320 |
| 7 | 91 | 91 | 89 | 89 | 360 |
| **totalt** | 532 | 531 | 529 | 529 | 2 121 |

### Längdledtråd (#411), åt båda hållen

Kolumnerna visar rätt svar som är **unikt längst** respektive **unikt kortast** (strikt, efter trim). Slumpen ger ungefär 25 %, och validatorn varnar under 10 % och över 45 % för ”längst”.

| nivå | unikt längst | unikt kortast | fakta | ordförst. | mellan rad. | helhet/slutsats |
|---|---|---|---|---|---|---|
| 1 | 58/240 (24 %) | 39 (16 %) | 32/145 (22 %) | **16/38 (42 %)** | 4/26 (15 %) | 6/31 (19 %) |
| 2 | 72/280 (26 %) | 27 (10 %) | 35/156 (22 %) | 12/40 (30 %) | 12/44 (27 %) | 13/40 (33 %) |
| 3 | 64/281 (23 %) | 40 (14 %) | 13/81 (16 %) | 22/80 (28 %) | 20/80 (25 %) | 9/40 (23 %) |
| 4 | 58/320 (18 %) | 43 (13 %) | 11/96 (11 %) | 22/80 (28 %) | 15/90 (17 %) | 10/54 (19 %) |
| 5 | 71/320 (22 %) | 56 (18 %) | 17/104 (16 %) | 22/74 (30 %) | 24/96 (25 %) | 8/46 (17 %) |
| 6 | 54/320 (17 %) | 64 (20 %) | 14/74 (19 %) | 13/79 (16 %) | 23/118 (19 %) | 4/49 (8 %) |
| 7 | 66/360 (18 %) | 36 (10 %) | 19/98 (19 %) | 12/51 (24 %) | 24/150 (16 %) | 11/61 (18 %) |

Kolumnerna per kategori visar andelen ”unikt längst”. N2 gick från 90/280 (32 %) till 72/280 (26 %) genom omskrivningarna. De nya texterna balanserades så att rätt svar är unikt längst i 0 av 70 frågor och unikt kortast i 3 av 70, med distraktorer av ungefär samma längd. Inga andra nivåer har ändrats i den här kolumnen.

### Frågekategorier

| nivå | fakta | ordförståelse | mellan raderna | helhet/slutsats |
|---|---|---|---|---|
| 1 | 145 (60 %) | 38 (16 %) | 26 (11 %) | 31 (13 %) |
| 2 | 156 (56 %) | 40 (14 %) | 44 (16 %) | 40 (14 %) |
| 3 | 81 (29 %) | 80 (28 %) | 80 (28 %) | 40 (14 %) |
| 4 | 96 (30 %) | 80 (25 %) | 90 (28 %) | 54 (17 %) |
| 5 | 104 (33 %) | 74 (23 %) | 96 (30 %) | 46 (14 %) |
| 6 | 74 (23 %) | 79 (25 %) | 118 (37 %) | 49 (15 %) |
| 7 | 98 (27 %) | 51 (14 %) | 150 (42 %) | 61 (17 %) |

## 5. Fördelning: story/fact och ämnen

Varje nivå har 20 story och 20 fact, totalt 140 + 140. Ämnen per nivå:

| nivå | skola | vardag | mysterier | roliga sit. | relationer | äventyr | sport | djur | natur | historia | rymden | teknik | geografi | vetenskap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 4 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 5 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 6 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 7 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |

Varje kategori finns med 2–3 gånger per nivå. N1 har relationer 2 och sport 3, medan övriga nivåer har tvärtom. Omskrivningarna har inte ändrat någon räkning.

## 6. Laddning

`page-lasresan.js` → `nextTextFor()` anropar `loadBank()` när eleven ska få en **ny** text. `loadBank()` hämtar manifestet och sedan **alla sju** nivåfilerna parallellt (`Promise.all`, `cache: "no-cache"`) och kör `validateBank` på varje nivå. Om eleven återupptar en påbörjad text används `findText()`, som bara laddar elevens nivå.

| fil | rå storlek | gzip -9 |
|---|---|---|
| level-1.json | 103 kB | 22 kB |
| level-2.json | 126 kB | 28 kB |
| level-3.json | 149 kB | 35 kB |
| level-4.json | 180 kB | 45 kB |
| level-5.json | 198 kB | 51 kB |
| level-6.json | 210 kB | 55 kB |
| level-7.json | 272 kB | 74 kB |
| **totalt** (8 anrop inkl. manifest) | **1,24 MB** | **≈ 310 kB** |

**Uppskattad laddtid** för en ny text, med gzip från GitHub Pages/Fastly: ungefär 0,3 s på 10 Mbit/s skol-wifi, ungefär 1 s på 3 Mbit/s och 5–6 s på riktigt långsamt mobilnät (0,5 Mbit/s). Utan komprimering är det ungefär fyra gånger så lång tid. `validateBank` över 280 texter tar bara millisekunder. `no-cache` betyder att alla 8 filerna revalideras (304) vid varje sidladdning.

**F1 (låg): ”Ny text” hämtar hela banken, fast elevens nivå räcker nästan alltid.** Den egna nivån är 22–74 kB gzip, mot 310 kB för hela banken. `pickText` behöver grannivåerna bara när nivåns alla 40 texter är lästa. Förslag till motorn (ändras inte här): hämta elevens nivå först och ladda resten bara om poolen är tom, eller förhämta övriga nivåer i bakgrunden efter att texten har visats. Det är inget akut problem på normalt skolnät, men tiden växer med banken.

## Öppna fynd

| id | prioritet | fynd | förslag |
|---|---|---|---|
| F1 | låg | `nextTextFor` → `loadBank()` hämtar alla 7 nivåer (≈ 310 kB gzip, 1,24 MB rått) innan första nya texten visas | ladda elevens nivå först och resten vid behov eller i bakgrunden (motor-issue, inte bank) |
| F2 | låg | N1 ordförståelse: rätt svar unikt längst i 16 av 38 frågor (42 %). Förklaringen till ett ord blir ofta längre än felalternativen. Nivån som helhet ligger på 24 %, så validatorn varnar inte. | balansera alternativlängden i de N1-ordfrågor som tas upp vid nästa revision, eller låt validatorn kontrollera per kategori |
| F3 | info | N4 → N5 planar ut i andel inferensfrågor (45 → 44 %) | ge N5 något fler inferensfrågor vid framtida byten |
| F4 | info | ”Pinsamt ögonblick blir lyckat” är vanligt i roliga situationer (5 texter på N3–N6) | välj andra slut för nya texter i kategorin |

## Ändringslogg

Alla ändringar ligger i banken (`level-1/2/3/5/6.json`) och i `docs/`. Inga id i befintliga, kvarvarande texter är ändrade. De tio ersatta texterna har fått nya id, eftersom ämnet är nytt: `lr-n2-blackfisken → lr-n2-hackspetten`, `lr-n2-island → lr-n2-skargarden`, `lr-n2-askan → lr-n2-blasten`, `lr-n2-svampar → lr-n2-arsringarna`, `lr-n2-kometen → lr-n2-solformorkelsen`, `lr-n2-saturnus → lr-n2-vintergatan`, `lr-n2-papegojan → lr-n2-hickan`, `lr-n2-bussen → lr-n2-punkan`, `lr-n2-pianot → lr-n2-strumporna`, `lr-n3-handslaget → lr-n3-lillebror`.

**Följd av id-bytet:** en elev som har en av de tio gamla texterna som `currentTextId` (påbörjad men inte klar) får en ny text, eftersom `nextTextFor` startar om med `force` när id saknas. Gamla id i `seenTextIds` påverkar inget. Texterna ligger bara på epic-grenen och har aldrig varit i drift, så ingen elev påverkas.

1. **N2, 9 nya texter** (D1–D9). Varje ny text har 7 frågor och samma kategori och svarsposition per fråga som den ersatta, med 117–128 ord.
2. **N3 `lr-n3-lillebror`** (D10): ny text på 173 ord med 7 frågor och samma kategori och position per fråga.
3. **N3 `lr-n3-delat-rum`** (D11): ny premiss (kusin i stället för bonussyster), Lejla → Alba, q6 C ”arg på Mattias” → ”arg på Julis mamma” och q7 D ”Systrarna” → ”Kusinerna”. Texten har 185 ord.
4. **N5 `lr-n5-robotdammsugaren`** (D12): ”mammas nya chef” → ”den nya grannen Siv”, med q1 D, q2 A, q4 C, q6 och q8 D anpassade. Texten har 268 ord.
5. **N6 `lr-n6-potatisen`** (D12): chefens replik → ”Jag har aldrig sett så många vakna ansikten på ett möte.”
6. **Namnbyten:** Mira → Mila (N1 `gungan`), Elton → Alvar, Agnes → Edla, Elvira → Rut, Signe → Tilda och Måns → Hjalte (N2).
7. **Docs:** `lasresan-bank40/niva-1/2/3/5.md` har uppdaterade rader och statistik. `LASRESAN-AMNESFORDELNING.md` har en ny sammanfattning överst, och den gamla planen är flyttad till Historik. Den här rapporten är ny.
