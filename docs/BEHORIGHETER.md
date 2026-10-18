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
`npm run test:rules` / `npm run test:functions`.

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
| SA | `test/firestore-rules-season.test.js` |
| PV | `test/firestore-rules-prov.test.js` |
| PD | `test/firestore-rules-prov-rattning.test.js` |
| PM | `test/firestore-rules-prov-mynt.test.js` |
| PA | `test/firestore-rules-prov-anpassningar.test.js` |
| PO | `test/firestore-rules-prov-mynt-omprov.test.js` |
| PH | `test/firestore-rules-prov-poang-avsnitt.test.js` |
| PR | `test/firestore-rules-prov-ratta-alla.test.js` |
| PK | `test/firestore-rules-prov-kriterier-765.test.js` |

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
| `studentData` | L/S | L: egna elever. S: bara `lasresa` och där bara nivåfälten (`level`, `level10`, `pendingLevel`, `pendingLevel10`, `highStreak`, `lowStreak`, `levelSetAt`, `levelSetBy`, `updatedAt`). En elev utan `lasresa` får ett nytt tillstånd utan resultat. `coins` + `lastLiveReceipt` bara i samma skrivning som Live-kvittot, och `coins` + `lastProvMynt` bara med exakt kvittots ökning i samma skrivning som provets kvitto (#746). Skapa och radera: aldrig. | SM test 1–2, KE test 12 och 14, LE test 16 och 18, PM |
| `studentData/{id}/lasresaAttempts` | L/S | L: egna elever. S: aldrig. | SM test 1–2 |
| `studentData/{id}/ekvationsresa` (bara `progress`) | L/S (validerat), radera | L: egna elever. S: lärarens nivåbyte (`ekvTeacherLevelOk`) för egna elever. | SM test 1–2, KE test 14 |
| `studentData/{id}/ekvationsresaAttempts` | L/radera | L: egna elever | SM test 1–2 |
| `studentData/{id}/brakresa`, `brakresaRounds`, `brakresaRewards`, `brakresaHunts` (Bråkresan, #706) | L (Cloud Functions skriver) | L: egna elever. S: aldrig. | BR |
| `classes` | L/S | L. Ändra egna klasser, bara fälten `assignedAreas`, `hiddenModes`, `areaModes`, `hiddenModules`, `enabledModules`, `lock`, `lasresaStartLevel10` och `lasresaStartLevel`. Skapa och radera: aldrig. | KE test 9–12 |
| `classProjections`, `classProjects` | L/S | L. S: aldrig. | RO klassprojektioner |
| `mathCompetitions` (tävlingen) | L/S | L (som alla inloggade). Skapa, styra, nollställa och radera: aldrig. | LE test 17 |
| `mathCompetitions/{c}/answers`, `studentStats` | L/radera | L: dokument med `classId` i egna klasser. En lista måste filtrera på egna klasser. | SM test 1–2, LE test 17 |
| `mathCompetitions/{c}/scores` | L/radera | Hämta en: som alla inloggade. Lista: filtrerat på egna klasser, annars högst 25 som elever. | SM test 1–2, LE test 17 |
| `mathCompetitions/{c}/classCounters` | L/radera | L (som alla inloggade) | LE test 17 |
| `liveSessions` | L/S | L (som alla inloggade). Skapa och styra: Klassmatchen med minst en egen klass och motståndare valfri, men utan `coinPrize`. Övriga format: alla klasser egna. Klasserna får inte bytas till andras. Radera: en lobby med en egen klass. En Klassmatch får aldrig ha `rewards` (gäller även admin). | LE test 15–16, LE #682 H1 |
| `liveSessions/{sid}/players`, `answers`, `counters`, `coinReceipts`, `sbPrivate`, `sbAnswers`, `sbScores`, `grPrivate`, `grPublic`, `dkPrivate`, `dkPublic` | L/S | Som läraren i sessionen: läsa, skapa facit, poäng och pluggmyntskvitton, och radera lobbyns dokument. Allt annat: bara admin. Ett pluggmyntskvitto (även admins) kräver en startad match och elevens egen `players/{uid}`. Rätt-mynten får vara högst `perCorrect` × serverns rätt i `grPlayers`/`dkPlayers` (minst ett svar), och i Snilleblixten högst `perCorrect` × antal frågor. | LE test 16 och 18, LE #682 H2 |
| `liveSessions/{sid}/grPlayers`, `grEvents`, `grMeta`, `dkPlayers`, `dkEvents`, `dkMeta` | L/radera (servern skriver) | L som läraren i sessionen. S: aldrig. | RO serverdata |
| `liveSessions/{sid}/dkSelf`, `dkSecret` | radera (bara eleven själv läser `dkSelf`, ingen klient `dkSecret`) | nekas | RO hemliga koder |
| `liveClock` | bara sitt eget dokument | bara sitt eget dokument | LC liveClock, RO Live-klockan |
| `{**}/answers` (collection group) | L | L: `classId` i egna klasser, eller `uid` = egen elev (träningstotalen) | SM test 1–2 |
| `classCenters` (profilen), `expMembers`, `kassa`, `kassaHistorik`, `donations` | L/S | L: egna klasser. S: aldrig. | SM test 1–2, LE test 18 |
| `classCenters/{c}/expShards`, `fund`, `trophies`, `layout`, `layoutHistory` | L/S | L (som alla inloggade). S: aldrig. | LE test 18, RO inredning |
| `hittaRattAttempts`, `hittaRattBest` | L | L: egna elever (per dokument) | SM test 1–2 |
| `hittaRattBoards`, `hittaRattMeta`, `hittaRattPacks` | L (servern skriver) | L | RO Hitta rätt! |
| `hittaRattBilder` | L. Skapa och radera egna bilder. | L. S: aldrig. | RO egna bilder |
| `prov` (provet med facit, #738) | L/S | L: alla prov (kopiera kollegors). Skapa: `createdBy` = sig själv. Ändra och radera: bara egna; `createdBy` får inte bytas. Elever läser aldrig. `installningar.visaPoangForElev`/`visaKriterier` (#762) och `felKortsvarFel` (#764) bara true/false. Halvpoängen (0,5–20) och `avsnitt`-blocken prövas i klienten (`validateProv`) – reglerna kan inte gå igenom `fragor`. | PV prov/{id}, PH, PR |
| `provTillfallen` | L/S (status bara `forberett → oppet → stangt`, `stangt → oppet`) | L/S: egna klasser. Skapa bara som `forberett` med `createdBy` = sig själv; klass och prov byts aldrig. `extraTid` en map, `elevIds` (omprov, #748) en lista med 1–100 elever som aldrig byts; `omprovAv` (skapas bara med ett ursprung med samma prov och klass som självt inte är ett omprov) byts aldrig. Eleven i klassen läser öppna och stängda, aldrig förberedda – även ett omprov hen inte är vald till (lyssnarens fråga kan inte filtrera på `elevIds`; inget facit i tillfället). | PV provTillfallen, PA, PO |
| `provTillfallen/{t}/privat` (bara `facit`) | L/S | L/S: egna klasser. Skapa/ändra bara med fälten `facit` (map), `bedomningsstod`, `kriterier` (maps) – facit i efterhand (#764) uppdaterar `facit.<fråga>`. Eleven aldrig – inte heller poängkriterierna (`kriterier`, #762). | PV privat/facit, PH, PR |
| `provTillfallen/{t}/svar` | L/radera. S: bara inlämnad-fälten när provet stängs (eller öppnas igen) – aldrig svaren. | Som admin, egna klasser. Eleven skapar och sparar sitt eget (öppet prov, i klassen, i `elevIds` om tillfället är ett omprov, inom tidsgränsen + elevens `extraTid` + 2 min, inte efter inlämning; `flikbyten` heltal 0–10 000). | PV svar, PA |
| `provTillfallen/{t}/rattning`, `{**}/rattning` (collection group) | L/S | L/S: egna klasser (collection group: filtrerat på `classId`). Eleven läser sin egen först när `aterlamnad == true`. Bara kända fält; `facit`, `kriterier` (#762, en map) och `aterlamnadAt` bara i en tillbakalämnad rättning (eleven ser alltså aldrig kriterierna före tillbakalämningen); `kriterier` dessutom bara när tillfällets `installningar.visaKriterier == true` eller oförändrade sedan förut (#765, `provKriterierOk` – eleven ser dem bara om läraren valt det), och att lämna tillbaka kräver `aterlamnadAt` = serverns tid. `myntUtbetalt` (#746) ändras bara ensamt och till kvittots total; annars behålls eller utelämnas det. Halvpoäng (#764): `totalPoang`/`maxPoang` 0–1200 i steg om 0,5 och total ≤ max; frågornas `auto`/`autoRattad` ("Rätta alla") och poäng kläms i klienten – reglerna kan inte gå igenom `fragor`. | PV rattning, PV collection group, PD, PM, PH, PR, PK |
| `studentData/{uid}/provMynt` (pluggmynt per prov, #746) | L/S (som årskurskontot; S kontrolleras även för admin) | L: egna elever (eleven läser sitt eget). Skapa/ändra: bara läraren med tillfällets klass, `total` bara uppåt, högst 200 och högst vad tillfällets `installningar.mynt` ger; rättningen tillbakalämnad med `myntUtbetalt` = `total`, elevens `svar` inlämnat och `coins` ökar med exakt skillnaden – allt i samma skrivning. Omprov (#748): kvittot är alltid ursprungets (`provMynt/{omprovAv}`) med `senast` = omprovet, vars rättning, svar och inställning då gäller; ett omprov får aldrig ett eget kvitto, så taket 200 gäller provet som helhet. Radera: bara admin. Eleven skriver aldrig. | PM, PO |
| `brakresaSecrets` (Bråkresans facit) | nekas (bara Cloud Functions) | nekas | BR |
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
