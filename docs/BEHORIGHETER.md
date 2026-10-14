# Behörigheter – admin och årskurskonto

Spec: `docs/UTVECKLINGSUPPDRAG_LARARKONTON.md` §2 och §4. Reglerna: `firestore.rules`
(hjälparna `isAdmin`, `isGradeTeacher`, `hasClass`, `hasStudent`). Testerna:
`test/firestore-rules-roller-*.test.js` (§7 test 1–18, 25) och
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
- Admin avgörs bara av claims, utan `get()`. En avstängd admin är `disabled` i Auth.
  Den gamla token gäller högst en timme till.
- Övergången är `isLegacyTeacher()` i reglerna och `claimRole()` i
  `functions/teacher-role.js`. Ta bort båda när migreringen är verifierad
  (§6.2 steg 3). Då har gamla tokens gått ut, senast en timme efter migreringen.

## Samlingar

L = läsa, S = skriva. "Egna" betyder klasser i kontots `classIds` och elever vars
`students/{id}.classIds` har minst en sådan klass.

| Samling | Admin | Årskurskonto |
| --- | --- | --- |
| `teacherAccounts` | L/S | L: bara sitt eget dokument |
| `subjects/{s}` (ämnet) | L/S | L |
| `subjects/{s}/areas/{a}` | L/S | L: allt. Skapa: i ett befintligt ämne, med `createdBy` = sig själv. Ändra och radera: bara områden med `createdBy` = sig själv. Område utan `createdBy` är admins. |
| `students` | L/S | L (som alla inloggade) |
| `studentCredentials` | L/S | L: egna elever. S: aldrig. |
| `studentData` | L/S | L: egna elever. S: bara `lasresa` och där bara nivåfälten (`level`, `level10`, `pendingLevel`, `pendingLevel10`, `highStreak`, `lowStreak`, `levelSetAt`, `levelSetBy`, `updatedAt`). En elev utan `lasresa` får ett nytt tillstånd utan resultat. `coins` + `lastLiveReceipt` bara i samma skrivning som Live-kvittot. Skapa och radera: aldrig. |
| `studentData/{id}/lasresaAttempts` | L/S | L: egna elever |
| `studentData/{id}/ekvationsresa/progress` | L/S | L: egna elever. S: lärarens nivåbyte (`ekvTeacherLevelOk`). |
| `studentData/{id}/ekvationsresaAttempts` | L/radera | L: egna elever |
| `classes` | L/S | L. Ändra egna klasser, bara fälten `assignedAreas`, `hiddenModes`, `areaModes`, `hiddenModules`, `enabledModules`, `lock`, `lasresaStartLevel10` och `lasresaStartLevel`. Skapa och radera: aldrig. |
| `classProjections`, `classProjects` | L/S | L |
| `mathCompetitions` + `answers`, `studentStats`, `scores`, `classCounters` | L/S | L: dokument med `classId` i egna klasser. En lista måste filtrera på egna klasser. Topp 25 som elever. |
| `liveSessions` | L/S | Skapa och styra: Klassmatchen med minst en egen klass och motståndare valfri, men utan `coinPrize`. Övriga format: alla klasser egna. Radera: en lobby med en egen klass. |
| `liveSessions/{sid}/…` (spelare, svar, räknare, facit, kvitton) | L/S | Som läraren i sessionen: läsa, skapa facit, poäng och pluggmyntskvitton, och radera lobbyns dokument. Allt annat: bara admin. |
| `{**}/answers` (collection group) | L | L: `classId` i egna klasser, eller `uid` = egen elev (träningstotalen) |
| `classCenters/{c}` (profil, `expMembers`, `kassa`, `kassaHistorik`, `donations`) | L/S | L: egna klasser. S: aldrig. |
| `classCenters/{c}` (`expShards`, `fund`, `trophies`, `layout`) | L/S | L (som alla inloggade). S: aldrig. |
| `hittaRattAttempts`, `hittaRattBest` | L | L: egna elever (per dokument) |
| `hittaRattPacks`, `hittaRattBilder` | L/S (via Cloud Functions) | L |
| allt annat | enligt regeln | nekas |

## Cloud Functions

| Funktion | Admin | Årskurskonto |
| --- | --- | --- |
| `updateStudentLogin` | allt | bara lösenord, bara för egna elever. Kontot läses färskt. |
| `hittaRattSparaPack`, `hittaRattRaderaPack`, `hittaRattSattTopplista` | ja | nej |
| `adminCreateTeacher` med flera (#677) | ja (färska claims i Auth) | nej |
| `guldrush*`, `datakupp*`, `hittaRattSubmit` | elevfunktioner, inga lärarkontroller | – |

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

## Att tänka på i klienten

- Listor som årskurskontot läser måste filtrera på egna klasser (`where("classId", "in", …)`).
  Det gäller till exempel Mattematchens `studentStats` och `answers`.
- `studentData` och `studentCredentials` saknar `classId`. De läses per dokument
  (`getDoc`), inte som en hel samling.
- `setStudentLevel` (`src/data-lasresan-niva.js`) skriver nu nivåfälten som fältvägar.
- `payLiveRewards` (`src/live/live-rewards-pay.js`) skriver nu `lastLiveReceipt` = sessionen.
- Live-sidan (`teacher-live*.js`) visar årskurskontot bara matcher med egna klasser,
  inget kassapris, och bara egna klasser i andra format än Klassmatchen
  (`teacher-role-core.js`: `canSeeLiveSession`, `liveFieldsFor`, `liveClassChoices`).
- `archiveIfEnded` (Mattematchen) arkiverar bara som admin.
