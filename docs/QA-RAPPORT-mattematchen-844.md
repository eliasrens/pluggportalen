# QA-rapport Mattematchen: Live räknas in, årskursfilter, pluggmynt (#848, epic #844)

Testat 2026-11-13 på epic-grenen `epic/mattematchen-live-r-knas-in-rskursfilter-235823`
(HEAD 406d841, A #845 + B #846 + C #847 landade) mot main = `origin/main` 076fdd5.
Emulatorerna functions + auth + firestore med grenens `firestore.rules`, index och functions,
via `admin/qa-emulator-proxy.mjs`. Riggen är ny i den här issuen:
`admin/qa-mattematchen-844-preview.sh` + `admin/qa-mattematchen-844-seed.mjs`.
Svaren skickades i webbläsaren genom appens egna formulär (klientformatet skriver appens
batcher, serverformatet anropar den riktiga callablen `datakuppAnswer`). Databasläget lästes
före och efter varje steg genom emulatorns REST-API (`Bearer owner`).
Skärmbilder finns i [`docs/qa-mattematchen-844/`](qa-mattematchen-844/).

## Sammanfattning

**Alla acceptanspunkter är PASS.** Inga buggar som stoppar en merge.
Fynden F1–F3 nedan är små eller redan kända. Det enda att tänka på är deploy-ordningen
(rules → functions → webb).

| # | Acceptanspunkt | Resultat |
|---|---|---|
| 1 | Sviterna: enhet, `test:rules`, `test:functions` och e2e är gröna | **PASS** |
| 2 | Bootgrafen är oförändrad mot main | **PASS** |
| 3 | Emulatorscenariot: MM 3A+4B, Snabbmatch (klient) + Datakuppen (server), inget dubbelt, inget utanför perioden, ingen icke-deltagande klass | **PASS** |
| 4 | Filtret Åk 3 / Åk 4 / Alla för elev och lärare, Topp 25 OFILTRERAD, 380 px + 1366×768 | **PASS** |
| 5 | Mynt: +1 per rätt, tak 50/dag med texten, inga MM-mynt för Live, skärmbild | **PASS** |
| 6 | Läsningar och kvot är dokumenterade och rimliga | **PASS** |
| 7 | Deploy-ordningen är noterad. Ingen deploy och ingen merge | **PASS** (se §7) |

## 1. Sviterna

Repot har inget `npm test`-skript. "Enhet" betyder `node --test` på alla `test/*.test.js`
utom regel-/emulatorfilerna (`firestore-*`, `rtdb-*`), plus de två `.test.mjs` som inte
behöver någon emulator. Emulatorsviterna kördes med exakt kommandot ur `package.json`,
via `emulators:exec` på slumpportar och med en emulator i taget (flock).

| Svit | Kommando | Resultat |
|---|---|---|
| Enhet | `node --test <293 test/*.test.js utan firestore-/rtdb-> test/admin-credential.test.mjs test/brakresan-drake-art.test.mjs` | **4304 pass / 0 fail** av 4305. 1 skip: `demo: en stubbe vägras`, som redan var markerad `skip`. 611 sviter, 164 s |
| `npm run test:rules` | `emulators:exec --only firestore "node --test …"` (89 filer, bland dem `mattematchen-mynt`, `-mynt-tester-846`, `-live-847`, `-live-847-tester`) | **963 / 963 pass**, 0 fail, 236 sviter, 215 s |
| `npm run test:functions` | `emulators:exec --only functions,auth,firestore,database "node --test --test-concurrency=1 …"` (inklusive `functions-mattematchen-live-847*.test.mjs`) | **551 pass / 0 fail** av 553. 2 `todo`: schack F9, redan accepterade (`docs/SCHACK.md` §12.1). 518 s |
| `npm run test:e2e` | `emulators:exec --only auth,firestore "node test/e2e-auth.test.mjs"` | **5 / 5 pass** |
| `npm run test:rules:rtdb` (extra) | `emulators:exec --only database "node --test test/rtdb-rules-kurragomma*.test.js"` | **23 / 23 pass** |
| `npm run test:import` (extra) | `emulators:exec --only auth,firestore "node --test … importera-elever.test.mjs"` | **15 / 15 pass** |

Utdrag ur `test:functions` som rör epicen (alla `ok`): `datakuppAnswer: rätt +1, fel incorrect,
omförsök räknas inte, inga MM-mynt`, `msAgera: rätt svar i en länk räknas i Mattematchen`,
`Guldrushen (kistmotorn): Live-svar räknas i Mattematchen`, `Datakuppen (samma kistmotor)`,
`Kurragömma`, `cachen håller endAt: ett svar efter slutet räknas inte trots cachad match`,
`kvoten: 12 svar → EN fråga mot mathCompetitions`.

## 2. Bootgrafen

`admin/qa-bootgraf-bfs.mjs` gör en BFS över de statiska importerna från `app.js` i en
git-revision:

```
node admin/qa-bootgraf-bfs.mjs origin/main > fore.txt   # 107 filer
node admin/qa-bootgraf-bfs.mjs HEAD        > efter.txt  # 107 filer
diff fore.txt efter.txt                                  # tomt
sha256: c1c84bdad08026dc7cd552719dd80e713713544602697b9004d1662e71e9f3e3 (båda)
git diff --name-only origin/main...HEAD | grep -Fx -f efter.txt   # tomt
```

Bootgrafen är alltså identisk. Ingen av epicens 40 ändrade filer ligger i bootgrafen, så även
innehållet i bootfilerna är orört. Ingen ändrad `.js`/`.mjs` är över 400 rader.

## 3. Emulatorscenariot (Live räknas in)

**Seed** (`admin/qa-mattematchen-844-seed.mjs`):
- Mattematchen `mm-848` är **aktiv för 3A + 4B**. 5E deltar inte.
- `mm-848-forbi` har status `active` men perioden slutade för 1 h sedan. `mm-848-snart` startar om 2 h. Båda gäller bara 5E.
- Live: `qa-848-klassmatch` (Klassmatch/Snabbmatch, multiplikation 0–10, klientformat) och
  `qa-848-datakupp` (Datakuppen, multiplikation, serverformat via `datakuppAnswer`).
  Båda gäller 3A/4B/5E.
- elev3a (3A) börjar med 12 poäng. 3A-räknaren börjar på 2472, 4B på 3853.

Värdena nedan lästes i databasen. Ögonblicksbilderna sparades efter varje steg.

| Steg | Gjort i UI:t | MM `mm-848` efter | Live | Resultat |
|---|---|---|---|---|
| S1 Snabbmatch (klient) | elev3a: 5 rätt + 1 fel (5×3, 6×6, 10×8, 4×10, 3×9, fel på 4×10) | scores 12→**17**, studentStats correct 12→17, incorrect 1→**2**, `c3/c5/c6/c8/c9/c10` +1 per tabell (c10 +2), `w4`+`w10` +1. classCounters 3A 2472→**2477**, 4B orörd. `liveAnswers` 6, `answers` 0 | elev3a 5/1 | **PASS** |
| S2 Dubbel-ENTER | samma rätta svar skickades 3× `requestSubmit` + ENTER i samma tick | +1 (17→18), 3A +1, liveAnswers +1 | +1 | **PASS**: räknades en gång |
| S3 Icke-deltagande klass (klient) | elev5e (5E): 3 rätt + 1 fel i Snabbmatch | ingenting i `mm-848`, `mm-848-forbi` (perioden slut) eller `mm-848-snart` (inte börjat) | elev5e 3/1 | **PASS** |
| S4 Datakuppen (server) | elev3a: 1 rätt (6×3) → fil, sedan 1 fel (6×9=55) + 2 rätt | 18→19→**21**, incorrect 2→**3** (`w6`, `w9`), 3A 2478→**2481**. Inget `liveAnswers`-ankare (servern skriver i sin egen transaktion) | dkPlayers elev3a 3/1 | **PASS** |
| S5 Icke-deltagande klass (server) | elev5e: 2 rätt + 1 fel i Datakuppen | ingenting i någon match | elev5e 2/1 | **PASS** |
| S6 Utanför perioden (klient) | `mm-848.endAt` = nu − 1 min, elev3a 2 rätt i Snabbmatch | oförändrat (21, 2481) | 6→8 rätt | **PASS**: Live-poängen finns kvar |
| S7 Utanför perioden (server) | samma endAt: ett rätt svar direkt och ett efter 70 s (ny cacheladdning) i Datakuppen | oförändrat (21) | 3→5 rätt | **PASS** |
| S8 Läraren stoppar matchen | qalarare "Stoppa" → elev3a 2 rätt i Snabbmatch + 1 rätt i Datakuppen → "Fortsätt" | oförändrat (25, 2485) | +2 / +1 | **PASS** |
| S9 Inga MM-mynt för Live | efter S1–S8 | `studentData/elev3a.coins` 250 → 250, ingen `mmMynt` för någon elev | – | **PASS** |
| S10 Elevvyn | elev3a öppnar 🧮 Mattematchen | visar **21 poäng** (12 + Live-svaren). [01](qa-mattematchen-844/01-mm-mynt-2-idag-1366.png) | – | **PASS** |
| S11 Läraren Följ | qalarare `#/larare/mattematchen?id=mm-848` | 3A "2485 rätt / 16 elever", Live-svaren är med | – | **PASS** |

elev5e (5E) har ingen Mattematchen-länk, och `#/elev/mattematchen` skickar eleven till Hem.

## 4. Årskursfiltret (Klasskampen) och Topp 25

| Kontroll | Resultat | Belägg |
|---|---|---|
| Elev 3A: 🏆 → Klasskamp har filtret **Alla · Åk 3 · Åk 4**, med **Åk 3 förvalt** | **PASS**. Åk 3 → bara 3A 155,3 (2485/16). Åk 4 → bara 4B 240,8 (3853/16). Alla → 4B, 3A | [04 1366](qa-mattematchen-844/04-elev-klasskamp-ak3-1366.png), [05 1366](qa-mattematchen-844/05-elev-klasskamp-alla-1366.png), [08 380](qa-mattematchen-844/08-elev-klasskamp-ak3-380.png), [09 380](qa-mattematchen-844/09-elev-klasskamp-alla-380.png) |
| Elev 4B: Åk 4 är förvalt | **PASS** (`Åk 4` har `aria-pressed`) | – |
| Elev: **Topp 25 är OFILTRERAD**, båda klasserna blandade, utan filterknappar på fliken (knapparna ligger i den dolda Klasskamp-fliken, `offsetParent` null) | **PASS**. Gamla Gunnar 4B 500, … Omar 3A01 283, … 25. Adam 3A11 | [03 1366](qa-mattematchen-844/03-elev-topp25-ofiltrerad-1366.png), [07 380](qa-mattematchen-844/07-elev-topp25-ofiltrerad-380.png) |
| Lärare Följ (aktiv): Klasskamp-filtret börjar på **Alla**. Topp 25 bredvid är ofiltrerad (3A och 4B) | **PASS** | [10 Alla 1366](qa-mattematchen-844/10-larare-folj-klasskamp-alla-1366.png), [11 Åk 3 1366](qa-mattematchen-844/11-larare-folj-klasskamp-ak3-1366.png), [14 Åk 3 380](qa-mattematchen-844/14-larare-folj-klasskamp-ak3-380.png) |
| Lärare historik (avslutad `mm-848-slut`, sparat `result`): filtret fungerar | **PASS** | [12 Åk 4 1366](qa-mattematchen-844/12-larare-historik-ak4-1366.png), [13 Åk 4 380](qa-mattematchen-844/13-larare-historik-ak4-380.png) |
| 380 px: ingen horisontell scroll | **PASS**. Elev: `scrollWidth` 380. Lärare: 365 | – |

## 5. Pluggmynt på MM-sidan

| Kontroll | Resultat | Belägg |
|---|---|---|
| +1 per rätt: elev3a 2 rätt + 1 fel på MM-sidan | **PASS**. "mynt idag" 0→1→2. `coins` 250→**252**, `mmMynt/2026-11-13` = 2. Felet gav inget mynt. Poängen 21→23 | [01 1366](qa-mattematchen-844/01-mm-mynt-2-idag-1366.png) |
| Taket: dagsräknaren sattes till 49 och sidan laddades om, sedan 2 rätt | **PASS**. Första rätt: 49→**50**, coins 252→**253**. Texten **"Dagens mynt är intjänade – poängen räknas fortfarande!"** visades (`.mm-mynt-tak` inte hidden, exakt text). Andra rätt: poäng 24→25, mynt **kvar på 50**, coins kvar på 253 | [02 1366](qa-mattematchen-844/02-mm-mynt-tak-1366.png), [06 380](qa-mattematchen-844/06-mm-mynt-tak-380.png) |
| Taket kan inte kringgås från klienten (extra, i webbläsaren som elev3a, appens Firebase-instans) | **PASS**. `updateDoc mmMynt {mynt:51}`, `{mynt:0}`, `deleteDoc` på räknaren, en ny räknare för en annan dag och en förfalskad batch (nytt svar + räknare 51 + coins +1) gav alla `permission-denied`. Reglerna testas i detalj i `test:rules` (846-sviterna) | – |
| Inga MM-mynt för Live-svar | **PASS**. Se S9 | – |

## 6. Läsningar och kvot

Kvoten är dokumenterad i `docs/spec-mattematchen-live.md` ("Kvoten per Live-svar (#847)",
"Årskursfilter i Klasskampen", "PLUGGMYNT"). Den är rimlig:

- **Live, server** (Guldrushen, Datakuppen, Meteorstormen, Kurragömma): 0 läsningar per svar.
  De aktiva matcherna cachas med en fråga `status == "active"` per instans och minut, utan
  index. Det är verifierat i `test:functions`: "kvoten: 12 svar → EN fråga mot
  mathCompetitions". Skrivningar utöver Live: rätt 3, fel 1.
- **Live, klient** (Klassmatch, Snilleblixten): 0 extra läsningar. Matchen finns redan i
  `mm-watch`. Reglerna läser tävlingen, namnet och ankaret. Skrivningar: rätt 4, fel 2.
- **Årskursfiltret**: 0 extra läsningar. Det filtrerar klientens redan lästa klassräknare
  och klasslista, eller lärarens sparade `result.classes`. Inga index- eller regeländringar.
- **Mynt**: 1 läsning av dagsräknaren när MM-sidan öppnas, sedan 1 extra skrivning per rätt
  svar under taket (räknaren + `coins` i samma batch).
- Svar utanför en aktiv match kostar ingenting extra.

## 7. Deploy-ordning (ingen deploy är gjord, ingen merge)

1. **`firestore.rules`** först. Den nya webben skriver `liveAnswers`-ankare, `mmMynt` och `coins`
   i MM-batcherna, och de nekas av de gamla reglerna.
2. **Indexes**: inget att deploya. `firestore.indexes.json` är oförändrad i epicen.
3. **Functions**: kistspel-core (guldrush\*, datakupp\*), meteorstorm-core (ms\*), kurragomma-core
   (kg\*) och nya `mattematchen-live.js`. Deploya hela functions, med kg\* mellan matcher
   (som i Kurragömma-epicen).
4. **Webb** sist.

## Fynd

| # | Vad | Belägg | Allvar | Förslag |
|---|---|---|---|---|
| F1 | Saldot i sidomenyn visar det gamla värdet efter MM-mynt (252 i menyn, 253 i databasen) tills man byter sida | [04](qa-mattematchen-844/04-elev-klasskamp-ak3-1366.png) | låg, **känt och accepterat** | – |
| F2 | Servercachen kan räkna Live-svar upp till 60 s efter att läraren stoppat eller flyttat matchen. I mitt förlopp hann cachen laddas om, så inget räknades fel (S7, S8) | `functions/mattematchen-live.js` CACHE_MS | låg, **känt och accepterat** | – |
| F3 | Elever kan skriva `studentData.coins` direkt | `docs/spec-mattematchen-live.md` PLUGGMYNT | **befintligt hål**, utanför epicen | – |
| F4 | Emojier syns som rutor på skärmbilderna | skärmbilderna | ingen produktbugg: den headless Chromium som tog bilderna saknar emoji-typsnitt | – |
| F5 | Om ett myntkvitto nekas av något annat skäl än taket (`permission-denied`) sätter MM-sidan "mynt idag" till 50 lokalt, och eleven får inga fler mynt den dagen förrän sidan laddas om (`page-mattematchen.js:155`). Ett sådant fall är ett svar precis vid svensk midnatt när klientens `mmNow()` redan är på den nya dagen men serverns `request.time` inte är det. Ingen data går förlorad, poängen räknas | kodläsning (unverified). Dagbytet i sig fungerar, se §8 | låg (bara ett millisekundfönster vid midnatt) | Sätt bara 50 om räknaren för `dag` faktiskt är 50 (läs om den), annars försök med mynt igen nästa svar |

## 8. Ett steg längre (utanför listan)

- **Dubbel-ENTER / tre submit i samma tick** i Snabbmatch → en räkning (S2).
- **Läraren stoppar en aktiv match** mitt i Live → varken klient- eller serverformat räknar,
  och Live-poängen finns kvar (S8).
- **Status `active` men perioden slut eller inte börjad** (`mm-848-forbi`, `mm-848-snart`)
  → inget räknas där (S3, S5).
- **Förfalskade myntskrivningar** från elevens egen webbläsare → alla nekas (§5).
- **Midnatt (svensk dag), i webbläsaren**: elev3a stod på taket 50 för 2026-11-13 med MM-sidan öppen
  och svarade rätt var 450:e ms från 22:59:57 till 23:00:08 UTC (= 23:59:57–00:00:08 svensk tid),
  utan omladdning. 8 svar före midnatt gav poäng men inga mynt. Från svaret 23:00:00.277 betalades
  mynt på den nya dagen ("mynt idag" 1, 2, …, 18). Takets text försvann. `mmMynt/2026-11-14` = 18,
  `coins` 253→271 (+18), poängen 25→50 (alla 25 svar räknades). **PASS**. F5-låset utlöstes inte här
  (klient och server har samma klocka), så F5 är fortfarande bara kodläst.

## Rigg

```
bash admin/qa-mattematchen-844-preview.sh           # http://127.0.0.1:8848/ (functions,auth,firestore)
MYNT=49 bash admin/qa-mattematchen-844-preview.sh   # elev3a ett rätt från taket
```

Konton (lösenord lilla123): elev3a (3A), elev4b (4B), elev5e (5E, deltar inte), qalarare (admin).
Live: `#/elev/live?id=qa-848-klassmatch` och `#/elev/live?id=qa-848-datakupp`.

## Inte kontrollerat

- Guldrushen, Meteorstormen, Kurragömma och Snilleblixten kördes inte i webbläsaren. De har
  egna gröna emulatortester i `test:functions`/`test:rules` (`functions-mattematchen-live-847*`,
  `firestore-rules-mattematchen-live-847*`). I UI:t prövades ett klientformat (Snabbmatch)
  och ett serverformat (Datakuppen).
- Regeluttrycksbudgeten i produktion (1000 uttryck per förfrågan) kan bara visas av en deploy.
  Emulatorn godkände alla 963 regeltester.
- Ingen deploy och ingen merge (enligt specen).
