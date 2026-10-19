# Rapport: Schack – Etapp 3, Lär dig schack + Pussel (epic #774)

Slut-QA (#792) av Etapp 3 i [`UTVECKLINGSUPPDRAG_SCHACK.md`](UTVECKLINGSUPPDRAG_SCHACK.md) §12–§14:
guiden "Lär dig schack" (3A, #790) och pusslen "Matt i ett/två drag" (3B, #791). Arkitektur,
datamodell och kvot står i [`SCHACK.md`](SCHACK.md) §15–§17. QA gjord 2026-10-19 på epic-grenen
(4a484c3) med `origin/main` inmergad (ae5353d, Prov #788 – inga konflikter) och med rättningen av F1
(47a4fff) i `firestore.rules`.

**Kort:** allt i §12–§14 fungerar i den riktiga appen mot emulatorerna: alla 12 lektioner går att klara
med riktiga mus-/touchhändelser, stjärnorna räknas efter antal drag, lektion 12 spelas mot Bonden till
vinst, remi och förlust, och alla 400 pussel är validerade av en egen, oberoende kontroll (matt efter
lösningen, matt-i-två-pusslen har exakt ett första drag som tvingar matt). Framstegen sparas och
finns kvar efter omladdning med **en skrivning per förbättrad lektion och en per nytt pussel** och
noll läsningar. Inga mynt någonstans. Bootgrafen är fortfarande **107** filer och pussel-JSON hämtas
först när pusselvyn öppnas.

QA:n hittade **ett allvarligt fel (F1, rättat):** regeln `schackOk` spräckte Firestores gräns på 1000
uttryck per begäran. En elev med många sparade lektioner och pusselframsteg fick då **alla** skrivningar
till sitt `studentData` nekade – mynt, stjärnor och avatar, inte bara schackens – och guiden kunde aldrig
spara lektion 12 efter lektion 1–11. 779 regeltester var gröna eftersom ingen testade ett fyllt fält. Se
avsnitt 6. **Deploy:** rules → webb, inga functions, inga index (avsnitt 8).

---

## 1. Vad som byggts

| Del | Issue | Innehåll |
| --- | --- | --- |
| 3A | #790 | Guiden "Lär dig schack": 12 lektioner (Brädet, Tornet, Löparen, Damen, Kungen, Springaren, Bonden, Ta pjäser, Schack, Schack matt och patt, Specialdragen, Ditt första parti). Frågor (1), stjärnjakt utan kungar med egen BFS för minsta antal drag (2–8), riktiga ställningar bedömda med chess.js (9–11) och ett helt parti mot Bonden (12). 1–3 stjärnor efter antal drag. Framsteg i `studentData.schack.lektioner`, en skrivning per förbättrad lektion. |
| 3B | #791 | Pusslen: 200 "Matt i ett drag" + 200 "Matt i två drag" ur Lichess öppna pusseldatabas (**CC0**), byggda av `admin/schack-pussel.mjs` till statisk JSON i `src/schack/pussel/` (+ `README.md` med källa och filter, `LICENSE`). Lätt → svårt. Pusselvyn på samma bräde som partierna: rätt drag, fel drag (hoppar tillbaka), Tips, matt i två med datorns försvar. Framsteg i `studentData.schack.pussel`. |
| 3C | #792 | Den här QA:n: riggen och skripten i `admin/qa-schack-3/`, regeltestet `test/firestore-rules-schack-grans-792.test.js`, rapporten och skärmdumparna `design/schack/qa792-*.png` |

## 2. Testsviter

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test` på alla `test/*.test.*` utom rules/functions/e2e) | **3600 pass, 0 fail, 1 skip** (skippen är den gamla Live-demo-stubben, inte schack) |
| Firestore-regler (`npm run test:rules`) | **799 / 799** (var 779 före F1; +13 `schack-grans-792`, +7 `schack-uttryck-792`) |
| Cloud Functions (`npm run test:functions`) | **349 pass, 0 fail, 2 todo** (de två todo är de accepterade F9 från #779) |
| Smoke (`npm run test:e2e`, auth + firestore) | **5 / 5** |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs HEAD`) | **107 filer**, inget under `src/schack/` |
| Pusselvalidering (`admin/qa-schack-3/pussel-validera.mjs`) | **400/400** (avsnitt 4.2) |
| Webbläsar-QA Etapp 3 (`admin/qa-schack-3/qa.mjs`) | `guide` 94, `guide12` 8, `pussel` 36, `lazy` 10, `layout` 52, `kvot` 7, `extra` 24, `regelgrans` 7, `sakerhet` 54 – **allt OK**, 0 FEL |
| Etapp 2 i webbläsaren (`admin/qa-schack-2/qa.mjs`) | `lobby` 25, `larare` 24, `sakerhet` 31, `gammalt` 10, `extra` 23, `layout` 24 OK; `partier` 49 OK + 1 känd tidsfluga (F3). `larare` föll en gång på ett klick som inte hann ritas och var grönt vid två omkörningar (belastningsfluga i riggen) |
| Etapp 1 i webbläsaren (`admin/qa-schack-app.mjs`) | `nivaer` **192/192**, `bradet` **50/50**, `hjalp` **36/36**, `layout` **31/31**, `kvot` **2/2** |

Allt kördes på slutversionen (47a4fff + rapporten), en emulator åt gången (`flock /tmp/schack-774-emulator.lock`, slumpade
portar). Emulatorn är nedstängd efteråt. Regelsviten (779 före, 799 efter) och F1-matrisen kördes både före och efter rättningen
(avsnitt 6); `test/firestore-rules-schack-grans-792.test.js` fallerar 9 av 13 på originalregeln och passerar 13/13 på rättningen.

## 3. QA i webbläsaren – riggen

```
bash admin/qa-schack-3/rigg.sh <6 portar>         # EN emulator (auth+firestore+functions) + en räknande proxy per port
source /tmp/qa-schack-3/env
node admin/qa-schack-3/qa.mjs <steg> <samma portar> [bildmapp]
   steg: guide guide12 pussel sakerhet lazy layout kvot extra regelgrans
node admin/qa-schack-3/pussel-validera.mjs        # oberoende validering av alla 400 pussel (ingen emulator)
touch /tmp/qa-schack-3/stopp                      # stänger riggen
```

Riggen är #782:s (`admin/qa-schack-2/`, samma seeds: 4A med eleverna `4a01`–`4a04`, 4B, 5A utan schack,
läraren `qaarskurs4`, lösenord `lilla123`) med låset `/tmp/schack-774-emulator.lock`. Varje elev har en egen
origin (egen proxy = egen inloggning och egna läs-/skrivräknare, `QA_RAKNA=1`). Skripten kör headless
Chromium via CDP med riktiga mus-, touch- och tangenthändelser, läser bara av DOM:en och läser facit med
Admin-SDK:t. Klientens Firestore-skrivningar mot reglerna görs med appens egna SDK i elevens sida
(`fsOp`), alltså exakt det en elev med devtools kunde göra.

## 4. Resultat per punkt

### 4.1 Lektionerna (`guide` 93/93, `guide12` 8/8)

- **Alla 12 går att klara.** Lektion 1 (frågor) med riktiga tryck. Lektion 2–8 (jakterna): en **egen BFS**
  i QA-skriptet (`admin/qa-schack-3/jakt.mjs`, oberoende av appens `minstaDrag`) räknade samma minsta antal
  drag som lektionens `min` för alla 14 uppgifter, och lösningarna spelades med tryck–tryck och
  dra–släpp (mus och touch). Lektion 9–11 (ställningar): för varje uppgift räknade chess.js ut vilka drag
  som uppfyller kravet och vilka som inte gör det; ett fel drag hoppar tillbaka med förklarande text
  (kung/ta/emellan/matt/rockad/en passant/förvandling) och räknas som ett drag. "Patt" får egen text
  ("Oj, patt! …"). Lektion 12: se nedan.
- **Stjärnorna räknas efter antal drag** (även felaktiga drag/tryck): lektion 1 med ett fel tryck = 8 mot
  minsta 7 → 2 stjärnor; 7 av 7 → 3 + "Nytt rekord"; 28 tryck → 1. Jakten med en omväg (9 mot 8, 7 mot 6)
  → 2 stjärnor. Lektion 9 med fel drag → 2, lektion 10 och 11 → 1 (fel drag räknas).
- **Lektion 12 mot Bonden** (`guide12`): vinst (3 stjärnor, "Du vann mot Bonden!"), remi via Sam Loyds
  patt (2), förlust av Bonden (1) och att ge upp ("Inte klarad", inga stjärnor sparas). Partiet sparas lokalt
  och fortsätter vid återbesök. Spela igen efter remi → vinst förbättrar 2 → 3. En förlust (1) sänker inte
  sparade 2.
- **Texterna stämmer med §12:** rubrikerna i spec-ordningen, "ett bräde med bara den pjäsen och några
  stjärnor", "Ta alla stjärnor på så få drag som möjligt", "Ditt första parti" mot Bonden med Ångra, Tips
  och Varna mig (mot datorn). Alla lektioner är öppna, ingen tidspress.

### 4.2 Pusslen (`pussel` 36/36, `pussel-validera.mjs` 400/400)

- **Oberoende validering av alla 400 pussel** (`node admin/qa-schack-3/pussel-validera.mjs`, egen
  implementation med chess.js, strängare än #791:s skript): matt i ett – lösningsdraget är lagligt och ger
  matt (200/200); matt i två – ingen matt i ett finns, alla tre dragen är lagliga, tredje draget ger matt,
  **och lösningens första drag är det enda vita drag där varje svart svar ger ett mattdrag** (200/200).
  Inga dubblettid eller dubblettställningar, sorterade lätt → svårt (rating 399 → 1000 resp. 1100), vit är
  vid draget överallt, `senast` slutar på en svart pjäs. Enda anmärkningen är pussel `HM2nD` där vit står i
  schack i utgångsläget (Re8+ Qxe8#) – det är ett riktigt pussel, och det går att lösa i appen (pussel 68).
- **Rätt drag:** "Snyggt! Schack matt! ⭐" + Nästa pussel (tio i rad med riktiga drag; matt i två 1–6).
  **Annat mattdrag än lösningens räknas som rätt** (pussel 4: Rh8# i st f a1h8).
- **Fel drag:** "Inte riktigt – prova igen!", pjäsen hoppar tillbaka, ingen skrivning. Fel förvandling
  nekas (pussel 142), rätt förvandling godtas. Matt i två: fel första drag nekas, rätt första drag ger
  "Bra drag! Nu försvarar sig svart …", datorn spelar lösningens försvar (~0,7 s) och
  "Nu: gör matt i ett drag!", ett andra drag som inte ger matt nekas, matt avslutar.
- **Tips:** första trycket ringar in pjäsen som ska flyttas, andra trycket visar hela draget som text och
  pil ("Tips: Te8#"), även i matt i två.
- **README och CC0-licensfil finns** (`src/schack/pussel/README.md`, `LICENSE`) och pusselvyn nämner
  Lichess och CC0.

### 4.3 Framstegen (`guide`, `pussel`, `sakerhet`, `kvot`)

- `studentData.schack.lektioner` och `.pussel` sparas i Firestore och finns kvar efter en full omladdning
  (översikten visar samma stjärnor, valet "12 av 200 lösta" och "Fortsätt med pussel N").
- **Skrivningar:** exakt **1 per förbättrad lektion** (11 lektioner + rekordet i lektion 1 = 12 skrivningar,
  ingen för ett sämre eller lika resultat, ingen när man lämnar mitt i), och exakt **1 per nytt pussel**
  (10 pussel = 10 skrivningar; att göra om ett gammalt skriver inget). **Läsningar: 0** för både guide och
  pussel (framstegen ligger i den redan cachade `studentData`). Avsnitt 5.
- **Säkerhet** (klient-SDK:t i elevens sida mot reglerna, `sakerhet` 54/54): nekas – sänkta stjärnor (3→1, 3→2),
  0/4/2,5/"3" stjärnor, lektion 0/13/"fusk", ta bort lektion/`lektioner`/`pussel`/hela `schack`, främmande
  nycklar (`schack.fusk`, `schack.coins`, `pussel.tre`, `pussel.ett.fusk`), `losta` +2, sänkt `senast`,
  `losta > senast`, `senast` 1001, strängvärden, **blandade skrivningar** (en giltig del + en ogiltig),
  hela `schack`-mappen ersatt med lägre värden eller utan lektioner/pussel/datorPartier, **annan elevs
  `studentData`**, **läraren** (årskonto) som sätter en elevs stjärnor eller pusselframsteg. **`datorPartier`
  +2/sänkt och `aktivtParti` nollat/bytt nekas fortfarande** – Etapp 1–2 är inte brutna. Tillåts: förbättrad
  lektion, ny lektion, pussel +1 framåt, `datorPartier` +1, första framsteget för en elev utan schack-fält.
- Skriver en elev alla 12 lektioner till 3 stjärnor i ett svep går det igenom: det finns inget att
  verifiera mot på servern och inga mynt hänger på stjärnorna (avsnitt 9). Eleven kan sedan före Etapp 3
  skriva sina egna `coins` direkt (klientmodellen, oförändrat).

### 4.4 Inga mynt, "Varna mig" aldrig i kompisläget

- Guide och pussel: `coins` och alla mynt-/belöningsfält i `studentData` oförändrade efter hela guiden
  (12 lektioner) och efter hela pusselkörningen (19 lösta pussel); ingen text om mynt/belöning i översikten eller pusselvyn.
  Schacksidan säger "inga pluggmynt, bara kluriga drag".
- Mot en kompis finns varken Ångra, Tips eller Varna mig (kontrollerat hos båda spelarna, `layout` Etapp 2).
  Mot datorn (lektion 12 och datorläget) finns Varna mig.

### 4.5 Lazy (`lazy` 10/10)

Nätverksflikens vy via CDP (`Network.requestWillBeSent`):

| Läge | Hämtas |
| --- | --- |
| Uppstart + inloggning + husvärlden | **ingen** schackfil (236 anrop, 0 under `src/schack/`) |
| Schacksidan (start) | schackets egen startkod (flöde, motor, chess.js, lobby, `schack-moln.js`) men **ingen** guide-, lektions-, stjärnjakt- eller pusselfil och inga JSON |
| Guiden öppnas | `schack-guide-vy`, lektionsvy, lektionerna, stjärnjakten, brädet |
| Pusselvalet öppnas | `schack-pussel-vy` + `schack-pussel`, och **först nu** `matt-i-ett.json` (26,6 kB) + `matt-i-tva.json` (29,1 kB) |
| Ett pussel öppnas efter valet | inga nya anrop (cachen) |

Bootgrafen (BFS över statiska importer från `app.js`): **107 filer, inget under `src/schack/`.**

### 4.6 Layout (`layout` 52/52)

320×640, 360×740 (mobil, touch), 820×1180 (surfplatta, touch) och 1366×768 (Chromebook, mus): guidens
översikt, lektion 1, 2 (jakt), 9 (ställning), 12 (parti), pusselvalet, matt i ett och matt i två – **inget
horisontellt scroll och inget utanför skärmen på någon storlek**, brädet 320 px på de smala skärmarna,
640 px på surfplatta och 518 px på Chromebook. Med riktiga fingerhändelser flyttas pjäser med tryck–tryck
och dra–släpp i jakt, ställning och båda pusselsorterna; med mus på Chromebook likaså.

### 4.7 Etapp 1–2 regressionsrök

Etapp 1 (datorläget): `nivaer` 192/192 (motorns tider oförändrade: Damen max ≈ 915 ms), `bradet` 50/50,
`hjalp` 36/36, `layout` 31/31, `kvot` 2/2. Etapp 2: två elever + läraren i skilda fönster – partier (matt,
remi, ge upp, tiden slut, "verkar ha gått"), lobbyn, lärarsektionen, säkerheten (31 kontroller), gamla
partier, layout – gröna.

### 4.8 Det ingen listade (`extra` 24/24)

- **Konstiga direktlänkar** (`lektion=13/abc/0/-1`, `sort=xyz`, `nr=0/9999/-5/abc`, `vy=hackad`) landar
  alla i översikten/valet/första eller sista pusslet utan JS-fel.
- **Pussel-JSON går inte att hämta** (blockerad i nätverket): "Pusslen kunde inte laddas. Ladda om sidan och
  försök igen.", valet visas ändå, och när nätet är tillbaka laddas pusslen vid nästa försök utan omladdning.
- **Lämna mitt i:** en lektion mitt i sparar inget; ett matt-i-två lämnat under försvarets paus ger inget
  JS-fel och ställningen är orörd när man kommer tillbaka.
- **Tangentbord:** Enter på en fokuserad ruta svarar på lektion 1. Omladdning mitt i en lektion börjar om.
- **Två flikar, samma elev:** flik 2 med gammal cache löser pussel 1 som flik 1 redan löst – servern
  nekar `senast` sänkt, inget fel visas för eleven och inget går sönder.
- **Klass utan schack (5A):** sidnavet saknar Schack och direktlänken till guiden skickar eleven till huset.

## 5. Kvot – uppmätt (läsningar/skrivningar)

Klientens Firestore-trafik per elev, räknad i proxyn (`kvot`, `lyssnare` är #782:s metod):

| Handling | Läsningar | Skrivningar |
| --- | --- | --- |
| Öppna schacksidan (appen redan igång) | 1 (`studentData`) | 0 |
| Guiden: översikt + lektion 1 klar | 0 | **1** |
| Lektion 2 (8 drag, 2 uppgifter) | 0 | **1** |
| 10 pussel lösta (Matt i ett) | 0 | **10** (en per pussel) |
| Göra om ett löst pussel / lämna mitt i en lektion | 0 | 0 |
| En hel guide (12 lektioner) | 0 | **12** (+1 per slaget rekord) |
| Hela pusselbanken (200 + 200) | 0 | **högst 400** per elev totalt |
| Full omladdning av pusselvyn | 11 (appens uppstart: `classes` 7, `studentData` 1, `liveSessions` 2, `schackKlass` 1) | 0 |
| Pussel-JSON | – (statiska filer, 26,6 + 29,1 kB, en gång per sidladdning) | – |

- **Inga läsningar per drag, lektion eller pussel** och inget per sekund.
- **Lobbylyssnaren är kvar i guiden och pusslen** (Etapp 2: utmaningsrutan visas överallt på schacksidan):
  medan eleven är i en lektion eller ett pussel kostar varje ändring i klassdokumentet `schackKlass` **1
  läsning** (mätt: 3 ändringar = 3 läsningar). 25 elever i guiden/pusslen och en ändring i lobbyn = 25
  läsningar, som i lobbyn (SCHACK.md §14.2). När eleven lämnar schacksidan stängs lyssnaren (3 ändringar =
  0 läsningar). Det är det beräknade från Etapp 2, inte ny trafik från Etapp 3.
- Läraren ser inte guide- eller pusselframsteg i sektionen "Schack" (inte i specen).

## 6. Fel och iakttagelser

| # | Allvar | Vad | Status |
| --- | --- | --- | --- |
| **F1** | 🔴 **blockerare** | `schackOk()` i `firestore.rules` körs på **varje** skrivning till `studentData` när dokumentet har ett `schack`-fält, och utvärderade alltid alla 12 `schackLektionOk` + 2 `schackPusselSortOk` (långa grenar för varje befintlig nyckel). Firestore avbryter vid **1000 uttryck per begäran** ("maximum of 1000 expressions to evaluate has been reached", `firestore.rules` L351/L353). Resultat i riktiga appen mot emulatorn: en elev med **12 sparade lektioner**, eller **6+ lektioner + pussel ett och två**, eller **9+ lektioner + pussel ett** fick **alla** skrivningar till sitt `studentData` nekade – `coins +1`, `stars +1`, `avatarId`, `datorPartier +1`, nästa lektion, nästa pussel. Det slog alltså mot hela sajten. Lektion 12 gick aldrig att spara när 1–11 fanns. Klienten sväljer felet (`console.warn`), så eleven märker inget förrän mynt och stjärnor slutar sparas. De 779 regeltesterna var gröna eftersom ingen testade ett halvfullt/fullt tillstånd. Repro: `qa.mjs regelgrans` (matris tillstånd × skrivning), eller regeltestet `test/firestore-rules-schack-grans-792.test.js` (9 av 13 fall fallerar på originalregeln). | **Rättad** (47a4fff, Coder) i `firestore.rules`: bara de nycklar som ÄNDRAS (`diff().affectedKeys()`) valideras, en orelaterad skrivning kostar nästan inget. Verifierad: matrisen **7/7**, `sakerhet` 54/54 (alla fusk nekas fortfarande, inklusive blandade skrivningar och ersatt hel mapp), regeltestet **13/13**, Etapp 1–2 gröna. **Regeln måste deployas innan webben.** |
| F2 | ⚪ dokumentation | `docs/BEHORIGHETER.md` (raden `studentData`) nämner `schack.lektioner` (#790) men inte `schack.pussel` (#791). | **Rättad** i #792: raden nämner nu `schack.pussel` (`DATAMODELL.md` hade redan `pussel`) |
| F3 | ⚪ QA-skript | Etapp 2-skriptets `partier` ger ibland FEL på "svart ser 'Din tid är slut.'". Skriptet läser svarts text i samma ögonblick som vits "Kräv vinsten" visas; svarts text kommer i samma sekundtick (isolerat: båda syns efter 1 s). Inget som Etapp 3 ändrat (klockan och kompisvyn är orörda). | Ingen åtgärd (tidsfluga i #782:s skript) |
| F4 | ⚪ iakttagelse | **Börja om i en jaktuppgift nollställer dragräknaren**, och stjärnorna räknas på det sista försöket. En elev kan alltså få 3 stjärnor genom att trycka Börja om efter första felet. Ingen skada (inga mynt, "Börja om" är en pedagogisk funktion), men "efter antal drag" gäller då det sista försöket. | Ingen åtgärd – fråga till Elias (avsnitt 9) |
| F5 | ⚪ iakttagelse | På Chromebook 1366×768 slutar brädet i lektioner och pussel vid fönstrets nederkant; med webbläsarens egen list ligger understa raden och statusraden under skärmen och sidan scrollas. Helskärmsknappen finns bara i datorpartiet och kompispartiet, inte i lektion/pussel. | **Åtgärdad i #794:** brädet följer fönstrets höjd (`100svh - 248 px` i lektionen, `- 232 px` i pusslet, golv 320 px) och introt står i panelens kolumn på bred skärm – hela brädet + statusraden syns utan skroll på 1366×657 och 1280×720; Helskärm-knapp i lektion och pussel (`schack-lektion-vy.js`, `schack-pussel-vy.js`), guiden byter lektion på stället i helskärm. Lektion 12 (partiet, med spelarrader) är oförändrad: dess höjd är datorpartiets. SCHACK.md §15.4, §16.2 |
| F6 | ⚪ kosmetisk | Statusraden under pusselbrädet står kvar på "Inte riktigt – prova igen!" när man trycker Tips (panelens text byts, statusraden inte). Valet efter ett löst pussel som man inte klickat vidare från säger "Fortsätt med pussel N" om samma pussel. | **Åtgärdad i #794:** Tips skriver "Tips: flytta den markerade pjäsen." (andra trycket "Tips: Te8#") i både panelen och statusraden (`tipsText`); `startNummer` låter läget på det senast lösta pusslet peka på nästa olösta. `test/schack-794-chromebook.test.js` |
| F7 | ⚪ testmiljö | ⭐ och navigationens emoji syns som rutor i headless-Chromium (saknat typsnitt) – gäller bara testmiljön. | – |

### Kända beslut (inga nya fel)

- **Pusselnumrering:** framstegen är *numret* på senast lösta pusslet. Byggs banken om med en annan
  ordning börjar eleverna på samma nummer i den nya listan (README).
- **Bara vit vid draget** i pusslen, så att texten "Vit drar …" alltid stämmer och brädet står som i
  partierna.
- **Ett pussel med lägre nummer än `senast`** räknas inte om man löser det efteråt (att göra om skriver inget).
- **Klientens ord gäller** för stjärnor och pusselframsteg (ingen server verifierar dem); regeln hindrar
  bara sänkning, främmande nycklar och andras dokument.

## 7. Dokumentationen

`docs/SCHACK.md` (arkitektur §1–§3, motor §7, callables §12.2, datamodell §12.1/§12.5/§15.5/§16.3, kvot
§12.7/§17, licenser §11 med chess.js BSD-2, Lichess CC0 och egna pjäsbilder) är komplett för Etapp 3.
`docs/DATAMODELL.md` (raden `schack` med `lektioner` och `pussel`) stämmer. `docs/BEHORIGHETER.md` saknar
`schack.pussel` (F2). Den rättade regeln (F1) beskrivs i `SCHACK.md` §15.5/§16.4 och regelkommentaren.

## 8. Deploy – ordning och varför

Ändrat mot main: `firestore.rules` (`schackOk` med `lektioner` och `pussel`, **rättad för F1**) och
webben (`src/schack/`, `src/styles/`). **Inga functions och inga index.**

0. **Merga in main i epic-grenen först** (gjort i den här grenen, ae5353d, utan konflikter). Main har
   också ändrat `firestore.rules` (klasslåsets `efter`, #788) och `functions/brakresan-core.js` – de
   ändringarna ligger inte i schack men följer med i samma `firebase deploy`, så reglerna ska deployas från
   den sammanslagna versionen.
1. **`firebase deploy --only firestore:rules`** – före webben. Utan reglerna nekas guidens och pusslens
   skrivningar (guiden och pusslen fungerar ändå men sparar inget). **Utan rättningen av F1 skulle
   elever med mycket framsteg förlora möjligheten att spara mynt och stjärnor överallt** – deploya aldrig
   en regelversion utan den.
2. **Webben sist:** merga PR:en till main → GitHub Pages, vänta ~10 min innan lärarna testar. Bootgrafen
   är 107 filer, så ingen vit sida (incidenten 2026-09-10).

Rollback: webben först (revert av PR:en). Regeln kan ligga kvar, den är bakåtkompatibel.

## 9. Öppna frågor till Elias

1. **Börja om i en jakt (F4):** ska Börja om nollställa dragräknaren (som nu), eller ska stjärnorna
   räknas på alla drag i uppgiften inklusive de före en omstart?
2. **Lektion 12:** vinst 3, remi 2, förlust 1 stjärna och "gav upp" = inte klarad. Rimligt, eller ska
   förlust också vara 0?
3. ~~**Chromebook (F5)**~~ – **besvarad i #794:** lektionerna och pusslen har fått Helskärm-knappen och brädet
   anpassas efter höjden (F5 ovan). Inget att besluta.
4. **Elevers egen stjärnrapportering:** klienten skriver stjärnor och pusselframsteg själv och en elev kan
   sätta alla 12 lektioner till 3 stjärnor med devtools. Inga mynt hänger på det – okej?
5. **Läraren ser inte guide- och pusselframstegen.** Önskas en kolumn i lärarens statistik (kräver läsning
   av `studentData` per elev, en gång per knapptryck)?
6. **Pusslens storlek och svårighet:** 200 + 200 från Lichess, rating ≤ 1000 resp. 1100, bara vit vid draget.
   Räcker det, eller ska en tredje sort (matt i tre, gaffel …) följa i en senare etapp?

## 10. Skärmdumpar

`design/schack/qa792-*.png`, från den riktiga appen mot emulatorn (emoji saknas i headless-Chromium och ser
ut som rutor – det gäller bara testmiljön):

`qa792-guide-oversikt.png` guidens översikt · `qa792-guide-oversikt-framsteg.png` översikten med
sparade stjärnor efter omladdning · `qa792-lektion2-klar.png` en lektion klar med tre stjärnor ·
`qa792-lektion9-klar.png` en ställningslektion (två stjärnor) · `qa792-lektion12-vinst.png` lektion 12
mot Bonden · `qa792-pusselval.png` valet Matt i ett/två · `qa792-pussel-fel-tips.png` fel drag + Tips med
pil · `qa792-pussel-ratt.png` rätt drag, "Snyggt! Schack matt!" · `qa792-pussel-tva-ratt.png` matt i två ·
`qa792-320-guide.png`, `qa792-320-lektion2.png`, `qa792-320-pussel.png`, `qa792-320-pusselval.png` på
320 px · `qa792-chromebook-lektion9.png` på 1366×768.
