# QA-rapport: Kurragömma 🙈 (epic #835, etapp 1) – slut-QA (#841)

Slut-QA av hela Live-formatet `kurragomma` på epic-grenen (A–E landade, `8266d65`).
Kontraktet: [`KURRAGOMMA.md`](KURRAGOMMA.md), specen: [`UTVECKLINGSUPPDRAG_KURRAGOMMA.md`](UTVECKLINGSUPPDRAG_KURRAGOMMA.md)
(§13 tester, §14 manuell QA, §15 den här rapporten). Skärmbilder: [`qa-kurragomma/`](qa-kurragomma/).
Huvudlös Chromium saknar emoji-typsnitt – rutorna i bilderna är emojier i en vanlig webbläsare. Maskinen saknar GPU
(three.js går på SwiftShader, 1–3 bilder/s), så elevflikarna i e2e-matcherna sänktes automatiskt till 2D-reserven efter
~8 s precis som spec §4.4 säger att de ska – riktiga fps mäts av Elias på HP-datorerna (§3).

**Kort:** formatet fungerar end-to-end mot emulatorerna (alla 10 QA-punkter gröna, alla sviter gröna). Första mätningen
visade att **kvotbudgeten §5.5 inte hölls**: Firestore-läsningarna hamnade på 9 100–14 800 per match (budget 8 000) och
Realtime Database på 16–87 MB (budget 50 MB) beroende på hur många som hittas. Kvotfixen (a)+(c) i F (`de6a0fc`:
`kgLeta` sållar kandidater ur instansens minne, pos 3/s med två decimaler) mättes om på samma matchförlopp:
**läsningar 10 452 → 7 340 (seed 1) och 13 535 → 7 871 (seed 3), Realtime Database 26,6 → 13,8 MB och 57,8 → 29,7 MB** –
under budget, med liten marginal i matcher där många hittas (§2.1).

## 1. Vad som byggdes och vad som återanvändes

| Del | Issue | Byggt | Återanvänt |
| --- | --- | --- | --- |
| A | #836 | Motorn `src/live/formats/kurragomma/delat/` (ön, skydd, kollision, sökning, visslingsregler, poäng, platsnamn, PRNG, konfig), balanssimuleringen `admin/kg-balans-sim.mjs` | Meteorstormens mönster för deterministisk motor + simulering |
| B | #837 | 3D-scenen `scen/` (three.js r170 vendorad i `src/vendor/three/`, instansierade föremål, avatarer som billboards, kamera, styrning med tangenter/joystick/"tryck på marken", tre nivåer + nivåvakt, 2D-reserven med samma ritar-gränssnitt), prestandasidan | Avatarerna (`createAvatarRoster`, `live-avatars.js`) ritas som i Live-lobbyn |
| C | #838 | Servern: `kgStarta/kgAnslut/kgLas/kgSvara/kgLeta/kgTick/kgAvsluta` (`functions/kurragomma-*.js`), Firestore-grenen (`kgPlayers/kgSelf/kgSecret/kgEvents/kgPublic/kgPrivate`), Realtime Database `/kg/{sid}` med `database.rules.json`, rörelsekanalen `kg-kanal.js` (rtdb + lokal buss), synk `delat/` → `functions/kurragomma/` | **Rättningen** (`kistspel-rattning.js`: `gradeMult/gradeQuiz/pickNextQ`, `answers/{attemptId}` som i kistspelen), **pluggmynten** (`meteorstorm-mynt.js` räknar `rewards` på servern, `withRewards`), `perQuestion` ur `meteorstorm-resultat.js fragestatistik`, kärnans matchklocka (oförändrad) |
| D | #839 | Projektorn (`kgp-*.js`: lobby, ön, flöde, vissling med riktat ljud, final med gömställena, musik), elevskärmen (`kge-*.js`: faser, mätare, lås, frågepanel, ficklampor, hittad-ruta, återanslutning via sessionStorage), demoläget (`kg-demo*.js`, 30 robotar mot låtsasservern över den lokala bussen), tre förhandsvisningar | **Frågeflödet** (`createQuestionFlow` från kistspelet: skriv själv, flerval, tidslinje), projektorramen (`mountProjector`, `live-feed`, ljud/musik som Guldrushen), **demoramverket** (Datakuppens kopplade demo, Snilleblixtens `DEMO_NAMES`), `elevskarm-kanal` (`&skarm=elev`-fönstret) |
| E | #840 | Lärarformuläret (gömtid, startsökare, tystnadsregeln, karta), historiken + Statistik → Live (`kurragomma-history.js`), pluggmynten i klienten (`kg-avslut.js`, `liveCoinPlayerOk`-grenen `deltog`), **lärarens vissling** `kgLarareVissla` + diskret panel `kgp-vissla.js` (5 s spärr, "varav N av läraren" bara i historiken via `getCountFromServer` på `kgEvents.larare`) | Historikens mall (Guldrushens), `live-rewards`-vägen för utbetalningen, lärarformulärets `sf-*`-fält |
| F | #841 | Den här rapporten, `admin/kg-kvot-sim.mjs` + `admin/kvot-raknare.mjs` (kvotmätningen), e2e-rigg `admin/qa-kurragomma-e2e.sh` (D), **kvotfixen** `de6a0fc` (kgLeta-cachen `gomstallenFor`, pos 3/s med två decimaler, interpolering 400 ms) | `admin/ms-kvot-sim.mjs` som förebild |

## 2. Kvotbudgeten och balansen

### 2.1 Kvoten – uppmätt i emulatorn (spec §5.5)

`FIRESTORE_EMULATOR_HOST=… FIREBASE_DATABASE_EMULATOR_HOST=… node admin/kg-kvot-sim.mjs --elever 25 --min 10 --gomtid 30 --seed N --md`

Demots robotbeteende (`kg-demo-robotar.js`: gömmare går till ett gömställe nära ett föremål och låser, svarar var 7–14 s;
sökare vandrar, går mot visslingar, pulsar sin pos genom **samma filter som klienten** (högst 5/s), svarar var 5–10 s och
letar var 3–6,5 s när lampan är laddad) spelar mot **serverkärnan** (`functions/kurragomma-core.js`, samma kod som Cloud
Functions) med styrd klocka – 10 minuter tar ~1 minut. Serverns Firestore-anrop räknas som Firestore debiterar (en läsning per
dokument, minst en per fråga/räknefråga; en skrivning per dokument även i transaktioner). Klienterna är **riktiga lyssnare**:
`onSnapshot` på sessionen (25 elever + projektorn + lärarens styrvy) och på varje elevs eget `kgPlayers` (`watchMe`), plus
Vissla-panelen öppnad en gång och historiken öppnad en gång. Realtime Database: 26 riktiga strömlyssnare (REST
`text/event-stream` på `/kg/{sid}`), bytes som faktiskt skickas räknas. Kärnans egna dokument (players-puls, lobby, kvitton)
räknas inte – de är desamma i alla format.

| 25 elever, 10 min + 30 s gömtid | seed 1, 65 % rätt | seed 1, 75 %, tystnad av | seed 2, 65 %, 4 instanser | seed 3, 65 % |
| --- | --- | --- | --- | --- |
| Svar (rätt / fel) · visslingar | 1 467 (984 / 483) · 70 | 1 440 (1 116 / 324) · 65 | 1 550 (1 054 / 496) · 62 | 1 583 (1 108 / 475) · 56 |
| Sökningar (träffar) · hittade / klarade sig | 145 (4) · 4 / 20 | 100 (4) · 4 / 20 | 373 (19) · 19 / 5 | 503 (18) · 18 / 6 |
| Serverns Firestore-läsningar | 8 430 | 7 192 | 10 869 | 12 300 |
| Klienternas läsningar (session 162 + eget kgPlayers + panel + historik) | 2 022 | 1 921 | 2 340 | 2 496 |
| **Läsningar totalt** (budget 8 000) | **10 452** ❌ | **9 113** ❌ | **13 209** ❌ | **14 796** ❌ |
| **Skrivningar totalt** (budget 6 000) | **3 529** ✅ | **3 351** ✅ | **4 180** ✅ | **4 491** ✅ |
| Realtime Database nedladdat, 26 lyssnare (budget 50 MB) | 26,6 MB ✅ | 15,7 MB ✅ | 66,6 MB ❌ | 86,5 MB ❌ |
| pos-skick från sökarna | 7 277 | 4 225 | 18 419 | 23 971 |
| Serverns RTDB-läsningar (kgTick roll + pos) | 360 st, 0,05 MB | 360, 0,03 MB | 360, 0,11 MB | 360, 0,14 MB |

Serverns läsningar per sort (seed 1): `kgSecret` i `kgLeta`-transaktionen **4 629** (varje sökning läser ALLA gömdas
gömställen, ~20 st), `kgPlayers` 1 981, `answers` 1 467 (alla svar läses i `kgAvsluta` för `perQuestion`), sessionen 131,
`kgEvents` 74, `players` 74, `kgSelf` 24. Skrivningar: `kgPlayers` 1 715, `answers` 1 467, `kgSecret` 244, `kgEvents` 74.

- C:s uppskattning (§10.8 i KURRAGOMMA.md, ≈ 7 500–7 800) antog ~100 sökningar och ~1 000 svar; robotarna gör 1 450–1 600
  svar och 100–500 sökningar. **Sökningarna avgör:** varje `kgLeta` kostar ~22 läsningar, och antalet sökare växer med
  antalet hittade (balansen siktar på 60–80 % hittade, §2.2) – därför 2–3× fler sökningar i seed 2–3.
- Realtime Database skalar med antalet gående sökare: 5 pos-skick/s × 26 lyssnare × ~140 B. Med ~15 sökare som går hela
  tiden (seed 3) blir det 87 MB. Robotarna går oavbrutet; riktiga barn står stilla ibland, så 50–60 MB är ett rimligare
  verkligt värde i en match där många hittas – fortfarande över budget.
- Writes ligger klart under budget i alla körningar.

**Förslag:** (a) cacha gömställena per instans i `kgLeta` (oföränderliga när `kgPlacerade` är satt; transaktionen läser
ändå kandidaternas färska `kgSecret`/`kgPlayers`, så utfallet blir detsamma); (b) `perQuestion` ur en aggregering som
`kgSvara` uppdaterar i stället för att läsa `answers` vid slutet (§8 fråga 7) ≈ −1 500; (c) pos-takten 5/s → 3/s
(`POS_MIN_INTERVALL_MS` 200 → 333) och x/z/yaw med 2 decimaler i `kg-kanal.js posDoc`. **(a) och (c) gjordes i F
(`de6a0fc`), (b) är kvar som fråga (§6).**

**Vad som ändrades (Coder i #841, `de6a0fc`):** (a) `kgLeta` läser bara kandidater inom `maxSokradie` (3 m = största
sökradien × 1,5) ur instansens minne av gömställena (`gomstallenFor` i `kurragomma-sess.js`: fylls EN gång per instans,
först när `kgPlacerade` är satt – då nekas `kgLas` och mängden är oföränderlig; tak `MINNE_SESSIONER`; rensas i
`avslutaIntern`). Rollen och visslingsfönstret avgörs ändå ur färska `kgSecret`/`kgPlayers` i transaktionen, så en
gömmare som blivit sökare på en annan instans hittas inte igen (`test/functions-kurragomma-leta-minne-841.test.mjs`).
(c) `POS_MIN_INTERVALL_MS` 200 → 333 (3/s), `pos` med två decimaler, och `POS_INTERPOLERING_MS` 150 → 400 – nödvändigt
vid 3/s (150 ms frös figurerna i 41 % av bildrutorna i Chromium enligt Codern), men **andras figurer ritas nu ~250 ms
längre bakåt i tiden** (sökarna på projektorn och för varandra). Elias bör titta på det på HP-datorerna – märks det, är
alternativet 5/s igen med 2 decimaler (RTDB ≈ 0,85 × före i stället för 0,5 ×).

#### Före/efter kvotfixen (a)+(c) – samma matchförlopp, mätt på `8266d65` (före) och `de6a0fc` (efter)

Mätningen är inte helt deterministisk mellan körningar: fröet styr robotarna och servern, men `kgPlayers`-lyssnarnas
leverans avgör i vilket klocksteg en hittad robot byter roll, så seed 3 gav två olika förlopp (503 sökningar / 18 hittade
ovan; 321 / 9 här). Före/efter jämförs därför bara på körningar med **identiskt förlopp** (samma svar, visslingar,
sökningar och träffar), verifierat med en loggning av varje sökning (`uid, x, z, hittade`) – de 321 sökningarna i seed 3
ger exakt samma utfall på gammal och ny kod, så (a) ändrar inte spelet.

| 25 elever, 10 min + 30 s gömtid | seed 1 före | **seed 1 efter** | seed 3 (321 / 9) före | **seed 3 efter** |
| --- | --- | --- | --- | --- |
| Svar · visslingar · sökningar (träffar) | 1 467 · 70 · 145 (4) | samma | 1 521 · 63 · 321 (9) | samma |
| Serverns Firestore-läsningar | 8 430 | **5 318** | 11 285 | **5 621** |
| – varav `kgSecret` i `kgLeta`-transaktionen | 4 629 | 1 493 | – | 1 510 |
| Klienternas läsningar | 2 022 | 2 022 | 2 250 | 2 250 |
| **Läsningar totalt** (budget 8 000) | 10 452 ❌ | **7 340 ✅** | 13 535 ❌ | **7 871 ✅** |
| **Skrivningar totalt** (budget 6 000) | 3 529 ✅ | 3 529 ✅ | 3 990 ✅ | 3 990 ✅ |
| Realtime Database, 26 lyssnare (budget 50 MB) | 26,6 MB ✅ | **13,8 MB ✅** | 57,8 MB ❌ | **29,7 MB ✅** |
| pos-skick från sökarna | 7 277 | 3 651 | 15 989 | 8 019 |

- (a) tar bort ~20 läsningar per sökning: `kgLeta` kostar nu ~2 läsningar + kandidaterna inom 3 m (oftast 0–1). Det som
  återstår skalar med **svaren**: `answers` läses i `kgAvsluta` (1 467–1 521 = §8 fråga 7, förslag b) och `kgPlayers`/`kgSecret`
  per svar i transaktionen.
- (c) halverar Realtime Database (3/5 av takten × kortare JSON).
- **Marginalen är liten i matcher där många hittas:** det värsta förloppet (503 sökningar / 18 hittade, 1 583 svar) gick inte
  att återskapa på den nya koden; uppskattat ur kostnaden per svar (~2,6) och per sökning (~2,3) plus klienterna (2 496)
  hamnar det på ≈ 8 500–9 000 läsningar (strax över 8 000) och ≈ 45 MB. Förslag (b) ger −1 500 och skulle ta det under budget med marginal.
- Gratisnivån (50 000 läsningar/dag) räcker alltså till ~6 matcher per dag med (a)+(c), ~8 med (b).

### 2.2 Balansen (spec §11.5) – `npm run balans:kurragomma`

Samma slutvärden som A redovisade i KURRAGOMMA.md §6 (200 frön per rad, 25 elever, 8 min, 30 s gömtid, Auto-startsökare):

| Rätt | Startsökare (p) | Hittade gömmare (p) | Klarade gömmare (p) | Gömda kvar (p10–p90) | Visslingar/min | Poäng från rätt svar | Hittade efter vissling |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 60 % | 324 | 361 | 499 | 32 % (14 %–55 %) | 5,6 | 77 % | 53 % |
| 75 % | 392 | 426 | 586 | 26 % (9 %–45 %) | 4,8 | 81 % | 53 % |
| 90 % | 458 | 485 | 673 | 22 % (5 %–41 %) | 3,6 | 84 % | 55 % |

Riktmärkena (15–40 % gömda kvar, ≤ 6 visslingar/min, ≥ 60 % av poängen från rätt svar) nås i medel – men bara med
`VISSLING_SPARR_MS` = 200 s (specen säger 20 s) och de mindre sökradierna 2,0/1,7/1,3/0,9. Frågorna 1–4 i KURRAGOMMA.md §8
står kvar till Elias (§6).

## 3. Bilder per sekund och ritanrop (prestandasidan, spec §4.4)

`preview/preview-kurragomma-prestanda.html?auto=0&niva=N` med 30 figurer, i huvudlös Chromium på den här maskinen
(SwiftShader, ingen GPU – fps-siffrorna säger inget om HP-datorerna):

| Vy | Nivå | Ritanrop | fps här (SwiftShader) | Canvas |
| --- | --- | --- | --- | --- |
| Elev 1366 × 768 | Låg (×0,6) | **44** | 1–3 | 819 × 408 |
| Elev 1366 × 768 | Mellan | **51** | 2 | 1366 × 681 |
| Elev 1366 × 768 | Hög | **60** | 1–3 | 1366 × 681 (dpr 1) |
| Projektor 1920 × 1080 | Mellan | **77** | 1–3 | 1920 × 993 |
| Projektor 1920 × 1080 | Hög | **77** | 1–3 | 1920 × 993 |
| 2D-reserven (`?2d=1`) | – | 1 | 3 (CPU-canvas, 8 flikar öppna) | – |

Ritanropen ligger långt under spec:ens tak 150 på alla nivåer (B:s mätning 48–77 bekräftad). Nivåvakten fungerar: utan
`?auto=0` går sidan Mellan → Låg → 2D på ~8 s här, och elevflikarna i e2e-matcherna hamnade i 2D-reserven av sig själva.
**Vilka nivåer som behövs på elevernas HP-datorer kan bara Elias mäta** – kör prestandasidan där före släppet
(mål ≥ 30 fps Mellan hos eleverna, ≥ 40 på projektorn). Bilder: `09-prestanda-*.png`.

## 4. Testresultat och skärmbilder

### 4.1 Sviterna (epic-grenen + F inkl. kvotfixen `de6a0fc`, sekventiellt – maskinen har begränsat RAM)

| Svit | Epic-basen `d2ee009` (main före epicen) | Nu |
| --- | --- | --- |
| `node --test` (alla `test/*.test.*` utom emulatorsviterna; repot saknar `npm test`) | 4 097 tester, 4 096 ok, 0 fel, 1 skippad (278 filer, 374 s) | **4 255 tester, 4 254 ok, 0 fel, 1 skippad** (290 filer, 261 s) – samma skippade (`demo: en stubbe vägras`) |
| `npm run test:rules` (Firestore-reglerna) | – | **910 tester, 910 ok, 0 fel** |
| `npm run test:rules:rtdb` (Realtime Database-reglerna) | – | **23 tester, 23 ok, 0 fel** |
| `npm run test:functions` | – | FUNCTIONS_PLACEHOLDER |
| `npm run test:e2e` | – | E2E_PLACEHOLDER |
| `npm run balans:kurragomma` | – | kör, tabellen i §2.2 |

Spec §13.1–§13.4 täcks av `test/live-kurragomma-*.test.js` (motorn, kartan, reglerna, balansen, scenen + 2D-reserven,
kanalen, klockan, formatet: bootgrafen når varken formatet eller three.js statiskt, inga Emoji 13+, ≤ 400 rader),
`test/functions-kurragomma-*.test.mjs` (servern med styrd klocka + mot emulatorerna), `test/firestore-rules-live-kurragomma*.test.js`
och `test/rtdb-rules-kurragomma*.test.js` (reglerna).

### 4.2 Manuell QA mot emulatorerna (spec §14 + punkt 10)

Rigg: `admin/qa-kurragomma-e2e.sh` (functions + auth + firestore + database på slumpportar, seed, två QA-proxys med
`kg*` vitlistade) och en egen huvudlös Chromium via CDP: en lärarflik (`#/larare/live?id=…`, 1920 × 1080), en projektorflik
(`&skarm=elev`, 1920 × 1080 och 1280 × 720) och fyra elevflikar (c01 1366 × 768, c02 380 × 740, c03/c04 1366 × 768).
Fyra matcher (3–5 min, gömtid 60 s, 1 startsökare, tystnadsregeln av), klass 3A, multiplikation skriv själv.
Elevflikarna sänktes till 2D-reserven av nivåvakten (SwiftShader); i match 4 öppnades elevflikarna utan WebGL.

| # | Punkt | Resultat | Bild |
| --- | --- | --- | --- |
| 1 | Lobby → STARTA → gömfasen: gå runt, mätaren, lås | ✅ "4 elever redo" → 3-2-1 → gömfasen med nedräkning "Göm: 0:25"; sökaren blundar ("Du blundar", frågor laddar lampan); mätaren visar "Syns lätt" ute på ängen och "Bra gömställe" vid ett träd; 🔒 Lås → `kgLas` → "Du är gömd ute på ängen" och knappen försvinner | `01-lobby-projektor-1920`, `02-gomfas-c01-1366`, `02-gomfas-c02-380`, `03-last-c01` |
| 2 | En elev som inte låser | ✅ c03 låste aldrig: när gömtiden tog slut skickade klienten platsen (auto, `skydd 2`, "Du är gömd vid ett träd"); c04 stängdes under gömfasen och placerades av **servern** (`harLast: true`, `kgSecret.auto`), och fick platsen vid återanslutningen ("Du är gömd ute på ängen") | `match1-dump` |
| 3 | Fel svar → vissling på projektorn och markör hos sökaren; fel igen inom spärren → ingen vissling | ✅ Projektorn: "🎵 Det visslar ute på ängen!" (platsnamn, aldrig namn; händelsen i `kgEvents` saknar uid). Sökaren: markören ritas i scenen och kantpilen (`.kg-pil`) syns i **4,2 s** (`VISSLING_MARKOR_MS` 4 000), ingen textrad. Gömmaren: "Fel svar – det visslade där du gömmer dig!". Andra felsvaret 20 s senare: ingen ny rad, `kgEvents` oförändrat (spärren 200 s) | `04-vissling-projektor`, `03-vissling-markor-c03-1s` (pilen nere till höger), `03-vissling-projektor-m3` |
| 4 | Sök: miss, träff, en elev i ett buskage som kräver närhet | ✅ Miss vid brunnen (25 m från alla): "Ingen här – leta vidare!" / projektorn "🔦 Leo 3A letade vid brunnen men hittade ingen". Träff: sökaren gick ("tryck på marken") till gömstället ute på ängen → "🔎 Leo 3A hittade Tyra 3A ute på ängen! Tyra 3A blir sökare." Närhet: gömd vid ett träd (`skydd 2`, sökradie 1,3 m) – miss på 2,65 m ("letade vid ett träd men hittade ingen"), träff på 0,22 m. **Buskaget (`skydd 3`, 0,9 m) nåddes inte i e2e:** gömmaren rörde sig ~0,3 m/s på SwiftShader och hann aldrig in i ett buskage och låsa inom 60 s – radien 0,9 m täcks av `test/live-kurragomma-regler.test.js` (`sok`: inne/kant/ute för skydd 0–3, 1,5× efter vissling), inte av en skärmbild. | `04-miss-nara-c03`, `05-hittad-projektor` |
| 5 | Hittad → sökare, med start på gömstället | ✅ Rutan "Theo 3A hittade dig! Nu letar du också." visades i 2,1 s (poll var 100 ms), vyn bytte till `leta-sokare` och den nya sökarens första `pos` i RTDB = gömstället (16,94 / 20,64) | `05-hittad-ruta-c01`, `05-hittad-c02-380` |
| 6 | Stäng en elevflik och öppna igen: samma roll och plats | ✅ Gömmare (c04, match 1): samma roll och gömställe. Sökare (c02 efter att ha hittats, match 2): `pos` togs bort av `onDisconnect`, efter ny inloggning + "Gå med"-sidan var hon sökare igen med start på sitt gömställe (12,59 / 23,55) och samma laddningar/poäng | `06-ateranslut-c02-sokare` |
| 7 | Final med gömställena på kartan | ✅ "2 av 4 klarade sig gömda hela matchen", prispall (delad etta 110 p, 20 mynt), figurerna på gömställena, "Här var alla gömda"; `result.gomstallen` med `hittad`-flagga; `coinReceipts` 4 per match (utbetalt en gång, med både lärar- och projektorfönster öppna) | `07-final-projektor-match2-1920`, `07-final-c01-1366`, `07-final-c02-380`, `07-final-larare` |
| 8 | Elevvyn på 1366 × 768 och 380 px; projektorn på 1920 × 1080 (och 1280 × 720) | ✅ 1366 × 768: frågorna som kort längst ned (ytan är < 1100 px bred med sidomenyn, se §6 observation 2), 380 px: kortet hopfällbart, allt nåbart. Projektorn: översta raden (logga, timer, Gömda/Sökare) täcks aldrig – inte heller av pallen vid 1280 × 720 | `02-gomfas-c02-380`, `07-final-c02-380`, `08-projektor-1280x720-letfas`, `08-final-projektor-1280x720` |
| 9 | Prestandasidan | ✅ §3 | `09-prestanda-*` |
| 10 | Lärarens vissling (`kgLarareVissla`) | ✅ Panelen "🔔 Vissla" nere till höger i lärarens styrvy listar bara de gömda (Ella, Theo, Tyra – inte sökaren). Tryck på Ella → projektorn "🎵 Det visslar ute på ängen!" utan namn, sökaren får markören, Ella ser den neutrala raden "Det visslade där du gömmer dig!" (`kgEvents` bär `larare: true`, aldrig uid). Nytt tryck inom 5 s (knappen tvingad aktiv): "Vänta några sekunder", ingen ny händelse. Icke-gömd (sökaren, anrop direkt): `failed-precondition` "Eleven är inte gömd just nu." Elev anropar: `permission-denied` "Bara läraren som styr matchen kan vissla." Historiken: "Visslingar 1 varav 1 av läraren"; `result` saknar summan (eleverna läser sessionen). Panelen på 380 px ryms | `10-vissla-panel-1920`, `10-vissla-panel-380`, `10-lararvissling-projektor`, `10-lararvissling-sokare-c01`, `11-historik-match2` |

Dessutom: **demoläget** (`preview/preview-kurragomma-demolage.html`) på 1920 × 1080 och med elevskärmen i 380 × 812:
lobby → KÖR! → gömfas → lås → gömfasen slut → fel svar visslar på projektorn (flödet "Det visslar vid buskaget!") →
sökning → "Jag blir hittad" → sökare → tystnad → "1 minut kvar" → alla hittade → final – utan Firebase (`12-demo-*`).
**2D-reserven startar när WebGL saknas** (`getContext("webgl")` → null): elevförhandsvisningen ritar 2D direkt (`13-2d-reserv-utan-webgl`).

### 4.3 Vad som inte kunde verifieras här

- Riktiga fps på HP-datorerna och ljudet (headless, inget ljud).
- Joysticken på pekskärm (`pointer: coarse`) – bara tangenter och "tryck på marken" i riggen.

## 5. Deploy – i den här ordningen

Realtime Database finns redan i prod (skapad 2026-11-11): instans `pluggportalen-so-2026-default-rtdb`, europe-west1,
`https://pluggportalen-so-2026-default-rtdb.europe-west1.firebasedatabase.app`, reglerna låsta tills steg 1.

**Verifierat att koden pekar dit:** klienten `src/live/formats/kurragomma/kg-kanal.js` `KG_DATABASE_URL` = exakt den
adressen (och `kurragomma-data.js kanal()` skickar den vidare; emulatorn bara via `__PP_RTDB_URL/__PP_RTDB_EMULATOR`).
Servern `functions/kurragomma-rtdb.js kgDatabaseUrl()`: `KG_DATABASE_URL` i `functions/.env` → annars
`FIREBASE_CONFIG.databaseURL` → annars samma europe-west1-adress som standard (`functions/index.js` `getDatabaseWithUrl`).
Rekommendation: sätt `KG_DATABASE_URL=https://pluggportalen-so-2026-default-rtdb.europe-west1.firebasedatabase.app` i
`functions/.env` före deploy så att inget hänger på vad `FIREBASE_CONFIG` innehåller i prod.

1. **Regler:** `firebase deploy --only firestore:rules,database` – Firestore-grenen (kg-samlingarna + `liveCoinPlayerOk`-grenen
   `deltog`, E) och `database.rules.json` (låser upp RTDB för `/kg/{sid}`).
2. **Functions:** `firebase deploy --only functions:kgStarta,functions:kgAnslut,functions:kgLas,functions:kgSvara,functions:kgLeta,functions:kgTick,functions:kgAvsluta,functions:kgLarareVissla`
   (`kgLarareVissla` är ny i E; `kgTick/kgSvara/kgAvsluta` ändrade i D/E). Kör `npm run sync:kurragomma` före så `functions/kurragomma/` = `delat/`.
3. **Index:** inga nya (`kgPlayers`-frågorna är enfältsfrågor; `hand`-indexet ligger i `database.rules.json`).
4. **Webben** sist (B/D/E + `src/vendor/three/`). Tills webben är ute visar den gamla webben inget Kurragömma-format.

## 6. Avvikelser från uppdraget och öppna frågor till Elias

**Avvikelser**

1. **Kvotbudgeten §5.5 hölls inte i första mätningen** (§2.1): läsningar 9 100–14 800 per match (budget 8 000),
   Realtime Database 16–87 MB (budget 50 MB). Orsak: `kgLeta` läste alla gömdas `kgSecret` per sökning och antalet sökningar
   växer med antalet hittade; pos-takten 5/s till 26 lyssnare. **Rättat i F (`de6a0fc`, förslag a+c):** 7 340 / 7 871
   läsningar och 13,8 / 29,7 MB på samma förlopp – under budget, men med liten marginal i matcher där många hittas
   (uppskattat ≈ 8 500–9 000 i det värsta uppmätta förloppet). Förslag (b) `perQuestion` ur en aggregering (−1 500) är
   kvar som fråga 1 nedan. Gratisnivån 50 000 läsningar/dag ≈ 6 matcher per dag.
2. **Balansen** nås bara med spärren 200 s (spec 20 s) och mindre sökradier – A:s frågor 1–4 i KURRAGOMMA.md §8 är fortfarande
   obesvarade; etapp 2:s "balansjustering efter test i klassrum" avgör.
3. Spec §6 "en panel till höger ~360 px bredare än 1100 px": på en HP-dator 1366 × 768 är elevens spelyta ~840 px bred
   (sidomenyn tar resten), så frågorna blir ett kort längst ned och 3D-vyn ~265 px hög. Fungerar, men scenen är liten –
   vill du att sidomenyn fälls ihop automatiskt under en Live-match (som Prov i helskärm) eller att brytpunkten sänks?

**Observationer (inte rättade)**

1. Sökarens tangenter (WASD/pilar) ignoreras medan svarsfältet har fokus (`formularHarFokus`), och efter varje svar får
   nästa fråga fokus igen. På en dator måste eleven alltså klicka på marken (eller på scenen) innan W/A/S/D fungerar –
   "tryck på marken för att gå dit" fungerar alltid. Liten ändring om du vill: släpp igenom WASD (inte pilarna) även när
   ett sifferfält har fokus.
2. Visslingens plats på projektorn kommer ur den osäkra punkten (±5 m): c02 ute på ängen gav "Det visslar vid eken!" i en
   match – avsiktligt enligt spec §1.5, men läraren kan undra.
3. Kända låga fynd från D (#839 runda 5) som är rättade och inte återkom: egen visslingsrad skrevs över (N7), figurerna
   tappades vid omladdning i finalen (N8), `?screen` betalade vid 00:00 (N9). Kvar som avvägning: är bara `skarm=elev`-fönstret
   öppet vid 00:00 står matchen på "Räknar ihop" tills ett lärarfönster öppnas (Meteorstormens reserv, §8 fråga 9).
4. Lärarens Vissla-panel kostar en läsning per gömd varje gång den öppnas (`getGomda`, ingen lyssnare) – räknat i §2.1.
5. **Auto-låsningen vid 0:00 förlorar ofta mot serverns placering.** Spec §1.2: den som inte låst får sin
   nuvarande plats skickad av klienten när tiden går ut; servern väljer bara för frånkopplade. I e2e fick de olåsta
   (c03 match 1, c01+c02 match 5) ändå `kgSecret.auto: true` – en gömmare som gått in i buskaget hamnade "vid ett träd"
   på andra sidan ön. Emulatorloggen visar klientens `kgLas` strax efter 0:00 följd av `kgAnslut` (= nekad "Gömfasen är
   slut" → `hamtaGomstalle`): anropet kom > `LAS_MARGINAL_MS` (2 s) efter `kgGomSlut`, troligen för att sidans 250 ms-ticker
   och anropet fördröjdes under last (SwiftShader/CPU 27+). På en HP-dator vid 24 fps är fördröjningen liten, men marginalen
   är tunn. Förslag: `LAS_MARGINAL_MS` 2 → 5 s (servern placerar olåsta först efter 5 s) eller auto-skick ~300 ms före
   `gomSlut`. Inte rättat (konfig delad av server, klient och tester).
6. Emulatorn: `kgLeta`/`kgSvara`-transaktioner från 25 robotar i samma klocksteg gav `ABORTED: Transaction lock timeout` i
   Firestore-emulatorn (serialiserat i mätningen). Produktionens Firestore har inte den begränsningen, men det är värt att
   titta i functions-loggen efter första klassrumsmatchen.

**Öppna frågor till Elias** (utöver §8 i KURRAGOMMA.md, som fortfarande gäller: 1–4 balansen, 5 vem får anropa
`kgStarta/kgTick`, 6 hittad-händelsen bär namn, 7 kvoten/`perQuestion`, 8 befordrad = hittad, 9 klassbonusen utan projektor,
10 pluggmyntens deltagare, 11 den neutrala raden)

1. Kvoten: (a) kgLeta-cachen och (c) pos-takten är gjorda i #841 (`de6a0fc`, före/efter i §2.1).
   (b) `perQuestion` ur en aggregering i `kgSvara` i stället för att läsa alla `answers` i `kgAvsluta` = §8 fråga 7 –
   uppmätt besparing ≈ 1 500 läsningar per match (1 467–1 583 svar). Den skulle ge marginal även i matcher där många
   hittas (≈ 8 500–9 000 → ≈ 7 000–7 500). Vill du ha den före släppet?
2. **Musikfilen `kurragomma-loop.ogg` är inte levererad** (D #839 spelar projektorns musik via `kgp-ljud.js` när filen finns;
   utan den är matchen tyst) – ska den levereras före släppet eller lämnas till etapp 2?
3. **Klassbonusen tappas om inget lärar-/projektorfönster är öppet vid 00:00** (§8 fråga 9, Meteorstormens reserv): är bara
   `skarm=elev`-fönstret öppet står matchen på "Räknar ihop" tills ett lärarfönster öppnas. Okej, eller ska `kgTick`/`kgAvsluta`
   dela ut den på servern?
4. Ska fps-målen (≥ 30 Mellan på eleverna, ≥ 40 projektorn) mätas av dig på HP-datorerna med `preview-kurragomma-prestanda.html`
   innan formatet visas för en klass? Nivåvakten sänker annars av sig själv till Låg/2D.
5. Sidomenyn under matchen (avvikelse 3), WASD-fokus (observation 1) och auto-låsningens marginal (observation 5): ändra nu eller i etapp 2?
6. Kvotfixen (c) ritar sökarnas figurer 400 ms bakåt (förr 150) – kontrollera på HP-datorerna att sökarna på projektorn
   inte känns "sega"; annars 5/s igen med två decimaler (§2.1).
7. Etapp 2 (§12) är inte påbörjad – klartecken krävs.
