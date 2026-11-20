# Behörigheter – admin och årskurskonto

Spec: `docs/UTVECKLINGSUPPDRAG_LARARKONTON.md` §2 och §4. Reglerna: `firestore.rules`
(hjälparna `isAdmin`, `isGradeTeacher`, `hasClass`, `hasStudent`). Testerna:
`test/firestore-rules-roller-*.test.js` (§7 test 1–18, 25, och `-ovrigt` för resten) och
`test/functions-roller.test.mjs` (test 13, 19).

## Hur rollen avgörs

| Roll | Claims | Klasser |
| --- | --- | --- |
| Admin | `teacher: true, admin: true` | alla |
| Årskurskonto | `teacher: true, role: "arskurs"` | `teacherAccounts/{uid}.classIds` |
| Övergång | `teacher: true` utan `role` och `admin` | räknas som admin |

- Årskurskontots klasser och `active` läses med `get()` på `teacherAccounts/{uid}`.
  En klassändring eller avstängning gäller därför direkt, utan ny token.
  Kontot gäller bara om dokumentet finns, `active == true` och `role == "arskurs"`.
- Admin avgörs av claims plus en `get()` på `teacherAccounts/{uid}` (`adminAccountOk`,
  #682 H3). Finns dokumentet måste det vara aktivt och ha `role == "admin"`. En
  avstängd eller nedgraderad admin nekas därför direkt, trots gammal token. Saknas
  dokumentet avgör claims, så övergången och admin före migreringen fungerar.
  `callerRole` (Cloud Functions) läser dokumentet på samma sätt. Admin-funktionerna
  läser färska claims i Auth, och `revokeRefreshTokens` körs vid avstängning och
  rollbyte.
- Övergången är `isLegacyTeacher()` i reglerna och `claimRole()` i
  `functions/teacher-role.js`. Ta bort båda när migreringen är verifierad
  (§6.2 steg 3). Då har gamla tokens gått ut, senast en timme efter migreringen.

## Testerna

Kolumnen **Test** pekar ut testet som bevisar raden (nyckel + testnummer i spec §7
eller testets namn). Kontrolltestet `test/behorigheter-doc.test.js` fäller om en
samling i `firestore.rules` eller en callable i `functions/index.js` saknas i
tabellerna, om en rad saknar test, eller om en testfil inte körs av
`npm run test:rules` / `npm run test:rules:rtdb` (Realtime Database) / `npm run test:functions`.

| Nyckel | Testfil |
| --- | --- |
| TA | `test/firestore-rules-teacher-accounts.test.js` |
| SM | `test/firestore-rules-roller-statistik-material.test.js` |
| KE | `test/firestore-rules-roller-klasser-elever.test.js` |
| LE | `test/firestore-rules-roller-live-ekonomi.test.js` |
| OG | `test/firestore-rules-roller-overgang.test.js` |
| RO | `test/firestore-rules-roller-ovrigt.test.js` |
| LC | `test/firestore-rules-live-core.test.js` |
| FR | `test/functions-roller.test.mjs` |
| FT | `test/functions-teacher-accounts.test.mjs` |
| FM | `test/functions-teacher-migration.test.mjs` |
| SC | `test/firestore-rules-student-credentials.test.js` |
| GR | `test/functions-guldrush.test.mjs` |
| DK | `test/functions-datakuppen.test.mjs` |
| HR | `test/functions-hitta-ratt.test.mjs` |
| BR | `test/firestore-rules-brakresan.test.js` |
| BF | `test/functions-brakresan.test.mjs` |
| MR | `test/firestore-rules-live-meteorstorm.test.js` |
| MF | `test/functions-meteorstorm.test.mjs` |
| KR | `test/firestore-rules-live-kurragomma.test.js` |
| KF | `test/functions-kurragomma.test.mjs` |
| KD | `test/rtdb-rules-kurragomma.test.js` |
| SA | `test/firestore-rules-season.test.js` |
| PV | `test/firestore-rules-prov.test.js` |
| PD | `test/firestore-rules-prov-rattning.test.js` |
| PM | `test/firestore-rules-prov-mynt.test.js` |
| PA | `test/firestore-rules-prov-anpassningar.test.js` |
| PO | `test/firestore-rules-prov-mynt-omprov.test.js` |
| MY | `test/firestore-rules-mattematchen-mynt.test.js` |
| MD | `test/firestore-rules-mynt-dag.test.js` |
| ML | `test/firestore-rules-mattematchen-live-847.test.js` |
| SK | `test/firestore-rules-schack.test.js` |
| SF | `test/functions-schack.test.mjs` |
| SY | `test/firestore-rules-schack-mynt.test.js` |
| SX | `test/functions-schack-mynt.test.mjs` |
| PH | `test/firestore-rules-prov-poang-avsnitt.test.js` |
| PR | `test/firestore-rules-prov-ratta-alla.test.js` |
| PK | `test/firestore-rules-prov-kriterier-765.test.js` |
| CL | `test/firestore-rules-class-lock.test.js` |
| BC | `test/functions-brakresan-core.test.mjs` |
| BK | `test/functions-butik.test.mjs` |
| MI | `test/firestore-rules-matchdagen-inst.test.js` |
| MK | `test/firestore-rules-matchdagen.test.js` |
| MQ | `test/firestore-rules-matchdagen-kval.test.js` |
| MT | `test/firestore-rules-matchdagen-trupp.test.js` |
| MC | `test/firestore-rules-matchdagen-cup.test.js` |
| MM | `test/firestore-rules-matchdagen-mastarcup.test.js` |
| MV | `test/firestore-rules-matchdagen-vanskap.test.js` |
| VF | `test/functions-matchdagen-vanskap-anrop.test.mjs` |

Admin-kolumnen bevisas dessutom av OG test 25 (lärare utan roll gör allt som
admin) och av alla äldre regeltester, som kör sina lärare som admin (§7 test 26).

## Samlingar

L = läsa, S = skriva. "Egna" betyder klasser i kontots `classIds` och elever vars
`students/{id}.classIds` har minst en sådan klass. "Läraren i sessionen" betyder
admin, eller ett årskurskonto med minst en egen klass i sessionens
`participatingClassIds`.

| Samling | Admin | Årskurskonto | Test |
| --- | --- | --- | --- |
| `teacherAccounts` | L/S | L: bara sitt eget dokument. S: aldrig (konton ändras via admin-funktionerna). | TA test 19, OG avstängt konto, OG H3 |
| `subjects` (ämnet) | L/S | L | SM test 8 |
| `subjects/{s}/areas` | L/S | L: allt. Skapa: i ett befintligt ämne, med `createdBy` = sig själv. Ändra: bara områden med `createdBy` = sig själv, och `createdBy` får inte bytas. Radera: bara egna. Område utan `createdBy` är admins. | SM test 4–7 |
| `students` | L/S | L (som alla inloggade). S: aldrig. | KE test 12, RO elevkonton |
| `studentCredentials` | L/radera. S: bara fälten `username`, `password` (minst 6 tecken) och `updatedAt`. | L: egna elever. S: aldrig (lösenordsbyte via `updateStudentLogin`). | SM test 1–3, KE test 13, SC |
| `studentData` | L/S | L: egna elever. S: bara `lasresa` och där bara nivåfälten (`level`, `level10`, `pendingLevel`, `pendingLevel10`, `highStreak`, `lowStreak`, `levelSetAt`, `levelSetBy`, `updatedAt`). En elev utan `lasresa` får ett nytt tillstånd utan resultat. `coins` + `lastLiveReceipt` bara i samma skrivning som Live-kvittot, och `coins` + `lastProvMynt` bara med exakt kvittots ökning i samma skrivning som provets kvitto (#746). `schack` (#779): aldrig – eleven själv ökar `schack.datorPartier` med högst 1 per skrivning, skriver guidens `schack.lektioner` (#790: 1–12 → 1–3 stjärnor, sänks aldrig) och pusslens `schack.pussel` (#791: `ett`/`tva` med `losta` +1 högst per skrivning och `senast`, sjunker aldrig, `losta ≤ senast ≤ 1000`) och kan aldrig röra serverns `schack.aktivtParti` eller `schack.pokaler` (#798, schackets pokaler – bara Cloud Functions skriver) (`schackOk`; att radera hela dokumentet tar bort spärren tillsammans med all elevdata – accepterat, SCHACK.md §12.1). Skapa och radera: aldrig. | SM test 1–2, KE test 12 och 14, LE test 16 och 18, PM, SY |
| `studentData/{id}/lasresaAttempts` | L/S | L: egna elever. S: aldrig. | SM test 1–2 |
| `studentData/{id}/ekvationsresa` (bara `progress`) | L/S (validerat), radera | L: egna elever. S: lärarens nivåbyte (`ekvTeacherLevelOk`) för egna elever. | SM test 1–2, KE test 14 |
| `studentData/{id}/ekvationsresaAttempts` | L/radera | L: egna elever | SM test 1–2 |
| `studentData/{id}/brakresa`, `brakresaRounds`, `brakresaRewards`, `brakresaHunts` (Bråkresan, #706) | L (Cloud Functions skriver) | L: egna elever. S: aldrig. | BR |
| `classes` | L/S | L. Ändra egna klasser, bara fälten `assignedAreas`, `hiddenModes`, `areaModes`, `hiddenModules`, `enabledModules`, `elevModuler`, `lock`, `lasresaStartLevel10` och `lasresaStartLevel`. `elevModuler` (#867, moduler per elev): en ändrad map har högst 100 elever, bara klassens `studentIds` som nycklar och bara listan `["matchdagen"]`; `enabledModules` får aldrig innehålla `matchdagen` (gäller även admin) – Matchdagen slås bara på per elev. Skapa och radera: aldrig. `lock.efter` (#788, vad en elev som lämnat in provet får göra: `lage` `prov`/`ovning`/`klass`/`egna`, `moduler` ≤ 20 bara i `egna`) bara på ett provlås; eleven ändrar det aldrig – frigörelsen bygger på elevens eget inlämnade `svar`, som hen inte kan ta tillbaka. Klientens modulgrind och Bråkresans `brakresa*`-callables (`assertModuleOpen`) tillämpar valet. | KE test 9–12, CL #788, BC #788, MI elevModuler |
| `matchdagenInst` (lärarens inställningar per elev för Matchdagen, #867) | L/S, radera | L/S/radera: egna elever (`hasStudent`). Bara kända fält (`omraden`/`rakna` ≤ 60 strängar, `tabeller` 0–10, `svarssatt`, `klocka`, `lugnt`, `paus`), `updatedAt` = serverns tid och `updatedBy` = sig själv. Eleven läser sitt eget och skriver aldrig; klasskamrater läser inte. | MI |
| `matchdagen` (elevens karriär i Matchdagen, #869) | L/radera. S: som årskurskontot (bara lagnamnet). | L: egna elever (`hasStudent`). S: bara `klubb.namn` och bara tillbaka till standardnamnet "Pluggporten FC" (Återställ lagnamn). Eleven läser och skriver sitt eget (skapa + ändra) med validerad form (`validMatchdagen`): kända fält, `div` 0–7, `st` 1–5 i en trupp på exakt 7, `summa` bara med heltal (visas i lärarens vy), lagnamn 1–24 tecken, tröjfärg `#rrggbb`, `senast` = serverns tid, begränsade listor/mappar, `kval` (#870) `null` eller en map med kända fält – bara heltal (`div` 0–6, `oss`/`dem` 0–40, `straffar` = två heltal), bool och motståndarens namn ≤ 40 tecken, färg `#rrggbb`, styrka 0–1 (`mdKvalOk`), och (#871) `reserver` ≤ 5 och `marknad` ≤ 6, `lager` (`"säsong-omgång"`/`"säsong-k"`), truppen/reserverna/kassan per skrivning mot det sparade dokumentet: en startspelare är oförändrad, en reserv, köpt ur marknaden (kassan minskar med priset) eller tränad (+1–96 poäng, `st` ≤ 5, `xp` 0–99), kassan högst +5 000 kr per bokförd match (`mdPlatsOk`, `mdKopOk`, `mdReserverOk`, `mdKassaOk`, `mdLagerOk`), och (#872) `cup` som text `"säsong-runda"`/`"-u"`, `rekord` som EN rad i rekordens form och `pokaler` ≤ 300 rader (typ liga/kval/cup, namn ≤ 40 tecken utan HTML, säsong, datum) – var och en med ett reguljärt uttryck, bara när fältet ändras; att cupen och rekorden stämmer med matcherna prövas inte (eget spel, inga pluggmynt). (#873) `mastarcup` `null` eller text `"säsong-rundor"`/`"-u"`, pokaltyperna `superliga`/`mastarcup`, `klubb.legendStjarnor` exakt det sparade värdet (0 i en ny klubb) och +1 bara i en legendklubb: `klubbhistorik` växer med exakt en rad i rätt form (≤ 50), den sparade klubben har en `mastarcup`-pokal från den sparade säsongen, och den nya klubben har Division 6, nästa säsong, 600 kr, inga reserver, ingen marknad och sju nya grundpelare (`mdLegendOk`); historiken kan inte strykas. Bara fälten som ändras prövas (1000-uttrycksgränsen). Byte-storleken (spec: ≤ 200 kB) kan inte mätas i reglerna – listornas och mappars tak håller appens dokument långt under, men strängarna i ligans lag, `senaste` och `sasonger` prövas inte, så ett dokument skrivet förbi appen kan nå 1 MiB (MATCHDAGEN.md §10). Klasskamrater läser inte. Radera: bara admin. | MK, MQ, MT, MC, MM |
| `mdLobby` (Matchdagens vänskapslobby per klass, #874) | L (Cloud Functions skriver) | L: egna klasser (`hasClass`). S: aldrig. Eleven läser sin klass lobby bara om hen har Matchdagen (`elevModuler`, en `get` av klassen); skriver aldrig – allt går via `mdUtmana`/`mdSvara`. Klasskamrater utan Matchdagen nekas. | MV, VF |
| `mdVanskap` (en vänskapsmatch, #874) med `privat/{uid}` och `facit/{uid}` | L (servern skriver) | L: matcher i egna klasser (`hasClass(classId)`), också `privat` och `facit`. S: aldrig. De två spelarna läser matchen (ett saknat dokument får varje inloggad hämta); `privat/{uid}` (frågan utan facit) bara eleven själv – aldrig motståndaren; `facit` (frågebanken med svar) ingen elev. Skriver aldrig – `mdFraga`/`mdSvar`/`mdTick`/`mdGeUpp`. | MV, VF |
| `mdVanskapElev` (spärren och dagens antal vänskapsmatcher, #874) | L (servern skriver) | L: egna elever (`hasStudent`). S: aldrig. Eleven läser sitt eget, skriver aldrig. | MV |
| `matchdagen/{uid}/matcher` (en spelad match, #869) | L/radera | L: egna elever. S: aldrig. Eleven skapar sina egna (bara `create`, `datum` = serverns tid, kända fält, `ratt ≤ fragor`, `mal` ≤ 80, `stat` ≤ 20 nycklar, id ≤ 64 tecken, `straffar` (#870) bara två heltal 0–40); ingen ändring, ingen radering. | MK, MQ |
| `classProjections`, `classProjects` | L/S | L. S: aldrig. | RO klassprojektioner |
| `mathCompetitions` (tävlingen) | L/S | L (som alla inloggade). Skapa, styra, nollställa och radera: aldrig. | LE test 17 |
| `mathCompetitions/{c}/answers`, `liveAnswers` (#847, Live-svar som räknats in), `studentStats` | L/radera | L: dokument med `classId` i egna klasser. En lista måste filtrera på egna klasser. | SM test 1–2, LE test 17, ML |
| `mathCompetitions/{c}/scores` | L/radera | Hämta en: som alla inloggade. Lista: filtrerat på egna klasser, annars högst 25 som elever. | SM test 1–2, LE test 17 |
| `mathCompetitions/{c}/classCounters` | L/radera | L (som alla inloggade) | LE test 17 |
| `liveSessions` | L/S | L (som alla inloggade). Skapa och styra: Klassmatchen med minst en egen klass och motståndare valfri, men utan `coinPrize`. Övriga format: alla klasser egna. Klasserna får inte bytas till andras. Radera: en lobby med en egen klass. En Klassmatch får aldrig ha `rewards` (gäller även admin). | LE test 15–16, LE #682 H1 |
| `liveSessions/{sid}/players`, `answers`, `counters`, `coinReceipts`, `sbPrivate`, `sbAnswers`, `sbScores`, `grPrivate`, `grPublic`, `dkPrivate`, `dkPublic` | L/S | Som läraren i sessionen: läsa, skapa facit, poäng och pluggmyntskvitton, och radera lobbyns dokument. Allt annat: bara admin. Ett pluggmyntskvitto (även admins) kräver en startad match och elevens egen `players/{uid}`. Rätt-mynten får vara högst `perCorrect` × serverns rätt i `grPlayers`/`dkPlayers` (minst ett svar), och i Snilleblixten högst `perCorrect` × antal frågor. | LE test 16 och 18, LE #682 H2 |
| `liveSessions/{sid}/grPlayers`, `grEvents`, `grMeta`, `dkPlayers`, `dkEvents`, `dkMeta` | L/radera (servern skriver) | L som läraren i sessionen. S: aldrig. | RO serverdata |
| `liveSessions/{sid}/msEvents`, `msPlayers`, `msLas` (Meteorstormen, #821) | L/radera (servern skriver) | L som läraren i sessionen (`msLas`: ingen klient). S: aldrig. Eleven läser sitt eget `msPlayers`, aldrig loggen `msEvents`. Pluggmyntskvittots rätt-mynt ≤ `perCorrect` × serverns `msPlayers.correct`. | MR |
| `liveSessions/{sid}/msPublic`, `msPrivate` (Meteorstormen, #821) | L/S | Som läraren i sessionen: skapa quizets `msPublic/questions` + `msPrivate/snapshot` i lobbyn. `msPublic/status` skriver bara servern; deltagare läser `msPublic`, bara lärare `msPrivate`. | MR |
| `liveSessions/{sid}/kgPlayers`, `kgEvents` (Kurragömma, #838) | L/radera (servern skriver) | L som läraren i sessionen (projektorn). S: aldrig. Eleven läser sitt eget `kgPlayers` (roll, poäng, laddningar), aldrig loggen `kgEvents`. Pluggmyntskvittots rätt-mynt ≤ `perCorrect` × serverns `kgPlayers.ratt`. | KR |
| `liveSessions/{sid}/kgSelf`, `kgSecret` (Kurragömma, #838) | radera (bara eleven själv läser `kgSelf` = det egna gömstället; ingen klient `kgSecret` – inte ens läraren, §5.4) | nekas | KR |
| `liveSessions/{sid}/kgPublic`, `kgPrivate` (Kurragömma, #838) | L/S | Som läraren i sessionen: skapa quizets `kgPublic/questions` + `kgPrivate/snapshot` i lobbyn. Deltagare läser `kgPublic`, bara lärare `kgPrivate`. Sessionen: `kgInstallningar` (gömtid 20–60 s, startsökare, tystnad, karta) och `durationSeconds` = gömtid + 1–60 hela speltidsminuter låses i reglerna. | KR |
| `liveSessions/{sid}/dkSelf`, `dkSecret` | radera (bara eleven själv läser `dkSelf`, ingen klient `dkSecret`) | nekas | RO hemliga koder |
| `liveClock` | bara sitt eget dokument | bara sitt eget dokument | LC liveClock, RO Live-klockan |
| `{**}/answers` (collection group) | L | L: `classId` i egna klasser, eller `uid` = egen elev (träningstotalen) | SM test 1–2 |
| `classCenters` (profilen), `expMembers`, `kassa`, `kassaHistorik`, `donations` | L/S | L: egna klasser. S: aldrig. | SM test 1–2, LE test 18 |
| `classCenters/{c}/expShards`, `fund`, `trophies`, `layout`, `layoutHistory` | L/S | L (som alla inloggade). S: aldrig. | LE test 18, RO inredning |
| `hittaRattAttempts`, `hittaRattBest` | L | L: egna elever (per dokument) | SM test 1–2 |
| `hittaRattBoards`, `hittaRattMeta`, `hittaRattPacks` | L (servern skriver) | L | RO Hitta rätt! |
| `hittaRattBilder` | L. Skapa och radera egna bilder. | L. S: aldrig. | RO egna bilder |
| `prov` (provet med facit, #738) | L/S | L: alla prov (kopiera kollegors). Skapa: `createdBy` = sig själv. Ändra och radera: bara egna; `createdBy` får inte bytas. Elever läser aldrig. `installningar.visaPoangForElev`/`visaKriterier` (#762) och `felKortsvarFel` (#764) bara true/false. Halvpoängen (0,5–20) och `avsnitt`-blocken prövas i klienten (`validateProv`) – reglerna kan inte gå igenom `fragor`. | PV prov/{id}, PH, PR |
| `provTillfallen` | L/S (status bara `forberett → oppet → stangt`, `stangt → oppet`) | L/S: egna klasser. Skapa bara som `forberett` med `createdBy` = sig själv; klass och prov byts aldrig. `extraTid` en map, `elevIds` (omprov, #748) en lista med 1–100 elever som aldrig byts; `omprovAv` (skapas bara med ett ursprung med samma prov och klass som självt inte är ett omprov) byts aldrig. `helskarm` true/false och `helskarmUndantag` en lista ≤ 100 (#810). Eleven i klassen läser öppna och stängda, aldrig förberedda – även ett omprov hen inte är vald till (lyssnarens fråga kan inte filtrera på `elevIds`; inget facit i tillfället). | PV provTillfallen, PA, PO |
| `provTillfallen/{t}/privat` (bara `facit`) | L/S | L/S: egna klasser. Skapa/ändra bara med fälten `facit` (map), `bedomningsstod`, `kriterier` (maps) – facit i efterhand (#764) uppdaterar `facit.<fråga>`. Eleven aldrig – inte heller poängkriterierna (`kriterier`, #762). | PV privat/facit, PH, PR |
| `provTillfallen/{t}/svar` | L/radera. S: bara inlämnad-fälten när provet stängs (eller öppnas igen), och "Släpp in" (#810: bara `pausad` true → false + `slapptInAt` = serverns tid) – aldrig svaren. | Som admin, egna klasser. Eleven skapar och sparar sitt eget (öppet prov, i klassen, i `elevIds` om tillfället är ett omprov, inom tidsgränsen + elevens `extraTid` + 2 min, inte efter inlämning; `flikbyten` heltal 0–10 000). #810: eleven får pausa sig (`pausad: true`, `pausadAt` = serverns tid, `pausOrsak` helskarm/flik/fokus) men aldrig skapa ett pausat svar, häva pausen eller röra `slapptInAt`; medan `pausad == true` nekas allt utom inlämningen när tiden tar slut (med oförändrade svar). Läraren lyssnar på `where("pausad", "==", true)`. | PV svar, PA |
| `provTillfallen/{t}/rattning`, `{**}/rattning` (collection group) | L/S | L/S: egna klasser (collection group: filtrerat på `classId`). Eleven läser sin egen först när `aterlamnad == true`. Bara kända fält; `facit`, `kriterier` (#762, en map) och `aterlamnadAt` bara i en tillbakalämnad rättning (eleven ser alltså aldrig kriterierna före tillbakalämningen); `kriterier` dessutom bara när tillfällets `installningar.visaKriterier == true` eller oförändrade sedan förut (#765, `provKriterierOk` – eleven ser dem bara om läraren valt det), och att lämna tillbaka kräver `aterlamnadAt` = serverns tid. `myntUtbetalt` (#746) ändras bara ensamt och till kvittots total; annars behålls eller utelämnas det. Halvpoäng (#764): `totalPoang`/`maxPoang` 0–1200 i steg om 0,5 och total ≤ max; frågornas `auto`/`autoRattad` ("Rätta alla") och poäng kläms i klienten – reglerna kan inte gå igenom `fragor`. | PV rattning, PV collection group, PD, PM, PH, PR, PK |
| `studentData/{uid}/mmMynt` (Mattematchens pluggmynt, dagsräknare per svenskt datum, #846) | L/radera | L: egna elever (eleven läser sitt eget). S: aldrig – bara eleven själv, och bara +1 i samma batch som ett NYTT rätt MM-svar (`answers/{lastAttemptId}` under `cid`) med `coins` +1 i samma batch, högst 50 per dag, bara dagens dokument-id, aldrig sänkt eller raderat (`mmMyntOk`). | MY |
| `studentData/{uid}/myntDag` (dagskvittot för elevens intjäning i klienten: övningar, Läsresan, Ämnesläsning, Ekvationsresan, gårdens gåva – #853, SAKERHET-MYNT §6 B1) | L/radera | L: egna elever (eleven läser sitt eget). S: aldrig – bara eleven själv, en källa per skrivning, räknaren ökar exakt `senastMynt` (och `xp` med `senastXp`, bara övningar) i samma skrivning som `coins`/`xp` i `studentData` ökar lika mycket, inom tak per gång och per dag, bara dagens dokument-id. Gåvan: 8 för ett ägt gårdsdjur i `agdaDjur`, en gång per djur och dag. Aldrig sänkt eller raderat (`myntDagOk`). | MD |
| `studentData/{uid}/provMynt` (pluggmynt per prov, #746) | L/S (som årskurskontot; S kontrolleras även för admin) | L: egna elever (eleven läser sitt eget). Skapa/ändra: bara läraren med tillfällets klass, `total` bara uppåt, högst 200 och högst vad tillfällets `installningar.mynt` ger; rättningen tillbakalämnad med `myntUtbetalt` = `total`, elevens `svar` inlämnat och `coins` ökar med exakt skillnaden – allt i samma skrivning. Omprov (#748): kvittot är alltid ursprungets (`provMynt/{omprovAv}`) med `senast` = omprovet, vars rättning, svar och inställning då gäller; ett omprov får aldrig ett eget kvitto, så taket 200 gäller provet som helhet. Radera: bara admin. Eleven skriver aldrig. | PM, PO |
| `brakresaSecrets` (Bråkresans facit) | nekas (bara Cloud Functions) | nekas | BR |
| `schackKlass` (lobbyn, pågående partier, topplistan – #779) | L (Cloud Functions skriver; inte ens admin skriver direkt) | L: egna klasser. S: aldrig. Eleven läser sin klass (`isClassMember`). | SK |
| `schackMynt` (kvittot för schackets pluggmynt – #798) | L (Cloud Functions skriver; inte ens admin skriver direkt) | L: egna elever. S: aldrig. Eleven läser sitt eget kvitto (bockarna); mynten betalas bara av `schackDatorVinst`/`schackLektionMynt`/`schackPusselMynt`. | SY |
| `schackPartier` (ett parti elev mot elev) | L (servern skriver) | L: partier i egna klasser (fråga filtrerad på `classId`). S: aldrig. De två spelarna läser sitt parti; andra elever i klassen nekas. Ett saknat dokument får varje inloggad hämta (tomt). | SK |
| `brakresaRecommendations` | L/S | L/S: rekommendationer till egna klasser och elever, med `teacherId` = sig själv och exakt ett av `classId`/`studentId`. Ändra bara `active`, `endedAt`, `comment` och `challengeIds`. | BR |
| `config/season` (bara det dokumentet; läses av alla, även utloggade) | L/S (fälten valideras) | L. S: aldrig. | SA test 3 |
| allt annat (`{document=**}`) | nekas | nekas | RO allt annat |

## Cloud Functions

| Funktion | Admin | Årskurskonto | Test |
| --- | --- | --- | --- |
| `updateStudentLogin` | allt (inte med avstängt eller nedgraderat kontodokument) | bara lösenord, bara för egna elever. Kontot läses färskt. | FR test 13, FR avstängt konto, FR H3 |
| `hittaRattSparaPack`, `hittaRattRaderaPack`, `hittaRattSattTopplista` | ja (som `updateStudentLogin`) | nej | FR test 19, FR H3 |
| `adminCreateTeacher`, `adminUpdateTeacher`, `adminSetTeacherPassword`, `adminSetTeacherActive`, `adminDeleteTeacher` | ja (färska claims i Auth; inte sin egen roll eller det sista adminkontot) | nej | FT test 19–23, FR test 19 |
| `guldrushAnswer`, `guldrushOpenChest`, `guldrushChooseVictim`, `datakuppAnswer`, `datakuppOpenFile`, `datakuppChooseTarget`, `datakuppGuessCode`, `datakuppPickCode`, `hittaRattSubmit` | elevfunktioner, inga lärarvägar | – | GR, DK, HR |
| `brakresaStartRound`, `brakresaAnswer`, `brakresaRework`, `brakresaFinishRound`, `brakresaAbortRound`, `brakresaAckDragon`, `brakresaRenameDragon`, `brakresaHunt` | nej – elevfunktioner; lärarkonton nekas (testläget körs i klienten och skriver aldrig, #708) | nej | BF |
| `schackVanta`, `schackSlutaVanta`, `schackGaMed`, `schackUtmana`, `schackSvara`, `schackDrag`, `schackGeUpp`, `schackRemi`, `schackKravaVinst` (#779) | nej – elevfunktioner: anroparen måste stå i klassens `studentIds`, klassen ha `schack` i `enabledModules` och inget aktivt fokuslås (kärnan: `test/functions-schack-core.test.mjs`, `test/functions-schack-parti.test.mjs`) | nej | SF |
| `schackDatorVinst`, `schackLektionMynt`, `schackPusselMynt` (#798) | nej – elevfunktioner: anroparen måste stå i en klass med `schack` i `enabledModules` (inte dold) och ingen av elevens klasser får ha ett aktivt fokuslås. Servern kontrollerar partiet/lösningen och betalar en gång per nivå/lektion/pussel (kvittot `schackMynt/{uid}`) | nej | SX |
| `mdUtmana`, `mdSvara`, `mdFraga`, `mdSvar`, `mdTick`, `mdGeUpp` (#874) | nej – elevfunktioner; lärarkonton (claim `teacher`) nekas. Anroparen (och kompisen) måste stå i klassens `studentIds`, ha Matchdagen i `elevModuler`, ingen aktivt fokuslås och var sin klubb; en vänskapsmatch åt gången. Bara spelarna anropar matchens callables. Servern rättar svaren och skriver kassan och de inbördes mötena (kärnan: `test/functions-matchdagen-vanskap.test.mjs`) | nej | VF |
| `butikKop` (#854) | nej – elevfunktion; lärarkonton (claim `teacher`) nekas. Ingen klass- eller låskontroll (butiken är inte låsgrindad). Klienten skickar bara varans id: priset tas ur katalogen och mysterylådan lottas på servern, en transaktion per köp | nej | BK |
| `msAgera`, `msRatta`, `msLage` (#821) | nej – elevfunktioner: anroparen måste ha gått med (`players/{uid}`) i en av sessionens klasser | nej | MF |
| `kgAnslut`, `kgLas`, `kgSvara`, `kgLeta` (#838) | nej – elevfunktioner: anroparen måste ha gått med (`players/{uid}`) i en av sessionens klasser. Fasbytet sker lat i varje anrop. | nej | KF |
| `kgStarta`, `kgTick` (#838) | ja (alla sessioner) | ja, sessioner med en egen klass (kontot läses färskt). En deltagare (elev) får också anropa dem: de gör bara det lata fasbytet och frågorna som ändå körs i varje anrop. | KF |
| `kgAvsluta` (#838) | ja (alla sessioner; en pågående avslutas nu) | ja, sessioner med en egen klass (kontot läses färskt). Deltagare (elev) först efter slutet eller när alla är hittade. | KF |
| `kgLarareVissla` (#840) | ja (alla sessioner) | ja, sessioner med en egen klass (kontot läses färskt). Elever nekas alltid. Visslar åt en gömd elev under letfasen – händelsen ser ut som en vanlig vissling (docs/KURRAGOMMA.md §12.4). | KF |
| `msAvsluta` (#821) | ja (alla sessioner; en pågående avslutas nu) | ja, sessioner med en egen klass (kontot läses färskt). Deltagare (elev) först efter slutet. | MF |
| `schackLarareAvsluta`, `schackLarareTopplista` (#779) | ja (som `hasClass`: alla klasser) | ja, bara egna klasser (kontot läses färskt). Elever nekas. | SF |

## Realtime Database (Kurragömma, #838)

Rörelsekanalen ligger i Realtime Database under `/kg/{sid}` (`database.rules.json`,
spec §5.3). Rollen avgörs av Auth-claimet `teacher` (samma custom claim som ovan) och av
serverns medlemslista `med/{uid}`; inget här läser Firestore.

| Väg | Läsa | Skriva | Test |
| --- | --- | --- | --- |
| `/kg/{sid}/roll`, `med`, `hand`, `status` | den som står i `med/{uid}` eller ett konto med `teacher`-claimet (admin och årskurskonto) | ingen klient – bara servern (Admin SDK) | KD |
| `/kg/{sid}/pos/{uid}` | som ovan (hela `pos`) | bara `uid` själv och bara när `roll/{uid}` = `sokare`; exakt fälten `x`, `z` (±40), `yaw` (±7), `t` (±2 min från serverns klocka). Att ta bort sin egen pos (`onDisconnect().remove()`, `stang()`) får alla, även gömmare och projektor. Gömmare skriver aldrig en position. | KD |

Utloggad nekas allt. `kgAvsluta` tar bort hela `/kg/{sid}`.

Migreringsskriptet `admin/migrate-teacher-admins.mjs` (Admin SDK, förbi reglerna)
bevisas av FM test 24.

## Val där spec §2 var oklar (det strängaste valdes)

1. **Live, övriga format** (Snilleblixten, Guldrushen, Datakuppen): alla
   deltagande klasser måste vara kontots. Undantaget för valfri motståndare
   gäller bara Klassmatchen.
2. **Klassmatchens `coinPrize`** (pris till klasskassan) får bara admin sätta.
   Kassan är admins, och priset kunde annars aldrig betalas ut.
3. **Efter en Live-match** skriver årskurskontot inte pokaler, kassapris eller
   klassbonus-EXP. Pluggmynt till eleverna (kvittot) är tillåtet. Klienten hoppar
   över de skrivningarna för årskurskontot (`live-data.js` writeResultIfMissing).
   En match som ett årskurskonto avslutar ger alltså ingen pokal och ingen klassbonus.
4. **Egna Hitta rätt!-kartor** räknas inte som Plugga-material. De är bara för admin.
5. **`hiddenVillages`** (byarnas synlighet) räknas som "klassbyar" i §2.2 och är
   bara för admin.
6. **`studentData`** får inte skapas av årskurskontot. En elev som aldrig loggat in
   kan därför inte få nivå eller Live-mynt förrän eleven loggat in en gång.
7. **Årskurskontot läser inte andra klassers `studentData`.** Den öppna
   läsningen för inloggade (#114) gäller elever, inte lärare.
8. **`classProjections`/`classProjects`**: årskurskontot skriver inte.
   Lärarklientens självläkning nekas tyst.
9. **Pluggmynt efter Live (#682 H1/H2)**: `result.rewards` skrivs av läraren
   och bevisar inget spel. Därför kan en Klassmatch aldrig ha `rewards`
   (formatet delar inte ut pluggmynt). Kvittot kräver dessutom en startad
   match, att eleven själv gått med (`players/{uid}`) och, i kistformaten,
   rätt-mynt inom serverns räknade rätt. Placeringspriset (högst `firstPrize`)
   kan reglerna inte kontrollera mot ställningen. En elev som gått med och
   svarat kan alltså få högst `firstPrize` + `cap` per match. Kontrollerna
   gäller även admin. Riktiga utbetalningar uppfyller dem redan
   (`computeRewards` tar bara med deltagare med svar).

## Att tänka på i klienten

- Listor som årskurskontot läser måste filtrera på egna klasser (`where("classId", "in", …)`).
  Det gäller till exempel Mattematchens `studentStats` och `answers`.
- `studentData` och `studentCredentials` saknar `classId`. De läses per dokument
  (`getDoc`), inte som en hel samling.
- `setStudentLevel` (`src/data-lasresan-niva.js`) skriver nu nivåfälten som fältvägar.
- Elevens egen `studentData`-skrivning (#750, BR): fältet `brakdrake` (Bråkdraken i huset)
  skapas, tas bort och får `id`/`level`/`name`/`stage` bara av Cloud Functions. Eleven får
  bara ändra `brakdrake.pos`, `.room` och `.stowed` (`brakdrakeOk` i `firestore.rules`,
  skrivs som fältvägar av `src/brakresan/rum-drake.js`). Årskurskontot skriver aldrig fältet.
- `payLiveRewards` (`src/live/live-rewards-pay.js`) skriver nu `lastLiveReceipt` = sessionen.
- Provets pluggmynt (#746, PM) betalas av `betalaProvMynt` (`src/prov/prov-mynt-pay.js`) med samma
  mönster: en transaktion per elev, `lastProvMynt` = tillfället. Ingen callable. Precis som Live
  nekas eleven som saknar `studentData` (val 6); rättningsvyn försöker igen nästa gång den öppnas.
- Live-sidan (`teacher-live*.js`) visar årskurskontot bara matcher med egna klasser,
  inget kassapris, och bara egna klasser i andra format än Klassmatchen
  (`teacher-role-core.js`: `canSeeLiveSession`, `liveFieldsFor`, `liveClassChoices`).
- `archiveIfEnded` (Mattematchen) arkiverar bara som admin.
