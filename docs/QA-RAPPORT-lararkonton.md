# QA-rapport – Lärarkonton (#682)

Slut-QA och säkerhetsgranskning av epicen Lärarkonton (A–E, #677–#681) på
epic-grenen (bas `883e33d`, main `a4d43f6` ingår). Spec:
`docs/UTVECKLINGSUPPDRAG_LARARKONTON.md` §0, §7 och §9. Behörighetstabellen:
`docs/BEHORIGHETER.md`. Driftordningen: `docs/ADMIN.md` §8.

## Sammanfattning

- **Två hål (❌), båda om pluggmynt.** Ett årskurskonto kan ge sina egna
  elever pluggmynt utan att någon match spelas. I Klassmatchen finns inget tak
  (bevisat med 1 000 000 mynt). Se H1 och H2. Reglerna är inte rättade här. Hålen
  är rapporterade till leaden.
- **Ett avsteg från §3.4 (⚠️).** En admin som stängs av eller nedgraderas
  behåller adminrätten i reglerna och i `updateStudentLogin` med sin gamla
  token, högst en timme. Det är dokumenterat i `BEHORIGHETER.md` men strider
  mot spec-texten. Se H3.
- **Inga andra vägar förbi reglerna hittades.** 28 angreppsfall mot reglerna och
  7 mot alla callables blev som väntat (bortsett från H1–H3).
- **Ingen utelåsning.** Driftordningen gick igenom torrt mot emulatorn, från
  main-reglerna och data i main-form. Det gällde även i fel ordning (reglerna
  före migreringen).
- **Regression grön:** `node --test` 2344/2344, `test:rules` 568/568,
  `test:functions` 183/183 och `test:e2e` 5/5.

## Hål och avsteg

### H1 ❌ Klassmatchen: påhittat `rewards`-tak ger obegränsat med pluggmynt

`validLiveSessionShape` (Klassmatchen) begränsar inte vilka fält en session
får ha. `liveRewardsOk` körs bara för Snilleblixten, Guldrushen och
Datakuppen. `liveCoinReceipt` jämför sedan kvittot med sessionens eget
`rewards`. Årskurs 4 kan därför:

1. skapa en Klassmatch 4A mot 5A med `rewards: { firstPrize: 1000000, cap: 1000000 }`
   (godtas, eftersom 4A är kontots och `coinPrize` saknas),
2. gå direkt från lobby till `finished` och skriva ett eget `result.rewards`
   i samma uppdatering,
3. skapa kvittot och öka elevens `coins` med 1 000 000 i samma batch
   (`gradeStudentDataOk` → `liveReceiptPaid`).

Bevis: `admin/qa-lararkonton-attack.mjs`, "HÅL: Klassmatchen …". E4a gick från
100 till 1 000 100 mynt. Det gäller bara elever i kontots egna klasser. En
elev i 5A nekas (testet "mynt till en elev i en annan klass").

### H2 ❌ Alla format: resultatet kontrolleras inte mot spelet

`result` skrivs av läraren efter matchslut (`kistSessionUpdateOk`,
`sbSessionUpdateOk`, `liveSessionUpdateOk`) och valideras inte: det är bara
"en map". `liveCoinReceipt` kräver inte att eleven var spelare
(`players/{uid}`) eller att matchen startade. En tom Guldrush (lobby, avsluta,
eget result) ger därför `firstPrize + cap` = 2 000 mynt per egen elev och match,
och det går att upprepa. Bevis: "HÅL: kistformaten …" i samma fil.

Båda hålen strider mot §2.2 ("Ekonomi: ge pluggmynt direkt" = bara admin).
Admin har samma möjlighet, men admin får redan ge mynt.

**Förslag till leaden (inte gjort här):** kör `liveRewardsOk` även för
Klassmatchen, eller neka `rewards` där. I `liveCoinReceipt`: kräv för
årskurskontot att `players/{uid}` finns och att `startedAt` finns, eller låt
bara admin betala ut för en match som aldrig startat. Vänd sedan de två
HÅL-testerna till `assertFails` och flytta in dem i `test:rules`.

### H3 ⚠️ Avstängd eller nedgraderad admin: gammal token gäller ≤ 1 h

Admin avgörs bara av claims, utan `get()` (valt i #677/#678 för att admin
inte ska kosta en läsning per regel). Efter `adminSetTeacherActive(false)` eller
`adminUpdateTeacher(role: "arskurs")` gör den gamla ID-token (`admin: true`)
fortfarande allt i reglerna. I `updateStudentLogin` kan den till exempel byta en
elevs användarnamn, tills token går ut (högst en timme). `revokeRefreshTokens`
stoppar bara en ny token, och varken reglerna eller `onCall` kontrollerar
återkallade token. Admin-funktionerna (`admin*`) nekas däremot direkt,
eftersom `assertAdmin` läser Auth färskt.

Bevis: "OKLART (dokumenterat) …" i `admin/qa-lararkonton-attack.mjs` och i
`admin/qa-lararkonton-callables.mjs`.

§3.4 säger att ett avstängt konto inte ska kunna "använda en gammal token mot
reglerna". För årskurskonton håller det. För admin är det ett dokumenterat
avsteg (`BEHORIGHETER.md`, "Hur rollen avgörs"). **Elias beslutar:** godta en
timme (risken är liten med två admins), eller låt `isAdmin()` också kräva ett
aktivt `teacherAccounts`-dokument (en `get()` per adminskrivning) och låt
`callerRole` läsa dokumentet även för admin.

## Oklara fall (godtas i dag)

| # | Fall | Bevis | Kommentar |
| --- | --- | --- | --- |
| O1 | Läsresans nivåfält valideras inte. Årskurs 4 kan sätta `level10: 999` eller en text på sin elev. | attack B "OKLART: nivåfälten" | Bara egna elever. Kan ge en trasig nivå i elevens klient. Ett intervall i `lasresaLevelOnly` skulle räcka. |
| O2 | En elev som inte börjat Läsresan kan få ett nytt `lasresa`-tillstånd med egna fält, till exempel `completedWorlds`. | attack B "OKLART: elev utan Läsresa" | Inga resultat eller pengar, men världar kan "låsas upp". |
| O3 | `createdByName` valideras inte. Årskurs 4 kan skriva "Admin" som skapare på sitt eget område. | attack B "OKLART: createdByName" | Bara visningen. Ägarskapet (`createdBy`) är korrekt. |
| O4 | I en Klassmatch 4A mot 5A läser Årskurs 4 även 5A-elevernas svar och spelardokument. Kontot får också starta, avsluta och radera lobbyn. | attack C "OKLART: i en Klassmatch" | Följer av §2.1 ("styra matcher där minst en av deras klasser deltar"). |
| O5 | Elevkonton (`students`: namn, klass) och MM-topplistan (högst 25) är läsbara för alla inloggade, även årskurskontot. | attack C "öppet för alla inloggade" | Produktbeslut #114. Gäller elever redan. |
| O6 | En lärare utan roll (övergången) räknas som admin i reglerna och i `updateStudentLogin`, men nekas admin-funktionerna (`adminCall` kräver `admin: true`). | callables "övergången" | Ofarligt: migreringen ger `admin: true` före reglerna. Fliken Lärarkonton fungerar först efter ny inloggning. |
| O7 | `node --test` utan argument tar med regel-, functions- och e2e-filerna i `test/`. De kräver emulatorn och hänger utan den. | denna QA | Inte nytt i epicen. Den rena sviten körs med filerna utan `firestore-rules`/`functions-`/`e2e-`, se nedan. |

De strikta valen 1–8 i `BEHORIGHETER.md` ("Val där spec §2 var oklar") står
kvar som frågor till Elias. Ingen av dem öppnar något.

## Test 1–28

Testfilerna står med nyckel i `BEHORIGHETER.md` ("Testerna"). "Attack" =
`admin/qa-lararkonton-attack.mjs`, "Callables" = `admin/qa-lararkonton-callables.mjs`,
"Drift" = `admin/qa-lararkonton-drift.mjs` (utdata i `docs/qa-lararkonton/drift-torrkorning.txt`).

| Test | Resultat | Belägg |
| --- | --- | --- |
| 1 Årskurs 4 läser statistik för 4A | ✅ | SM "Test 1". Attack C: egna klassens svar och Hitta rätt!-försök listas. UI: Statistik visar 4A/4B med Ämnen, Läsresan, Ekvationsresan, Mattematchen, Live. |
| 2 Statistik och lösenord för en elev i 5A nekas | ✅ | SM "Test 2". Attack C: 10 direkta läsningar och 16 queries mot 5A (collection group `answers`, `hittaRattAttempts`, `studentStats`, `lasresaAttempts`, `expMembers` m.fl.) nekas. |
| 3 Admin läser allt | ✅ | SM "Test 3". Drift: admin läser elevdata och lösenord. |
| 4 Skapa område, `createdBy` sätts | ✅ | SM "Test 4", `test/teacher-role.test.js` (withOwner). Attack B: skapa utan `createdBy`, åt Årskurs 5 eller i ett påhittat ämne nekas. |
| 5 Ändra och radera eget område | ✅ | SM "Test 5". UI: eget område har penna och papperskorg. |
| 6 Andras område nekas | ✅ | SM "Test 6". Attack B: ta över med `set`+`merge`, byta eller radera `createdBy` nekas. UI: "Skapat av Admin · bara använda" utan Ändra/Radera. |
| 7 Duplicera admins område | ✅ | SM "Test 7", `duplicateValue` i `test/teacher-role.test.js`. UI: Duplicera på varje rad. |
| 8 Ämne nekas | ✅ | SM "Test 8", attack A. |
| 9 Synlighet, fokusläge, startnivå för 4A | ✅ | KE "Test 9". Attack B: `set`+`merge` med bara `assignedAreas` godtas. |
| 10 Samma för 5A nekas | ✅ | KE "Test 10", attack F (4B efter att den tagits bort). |
| 11 `name`/`studentIds` för 4A nekas | ✅ | KE "Test 11". Attack B: `update`, `merge`, blandat med tillåtet fält, `set` utan merge, `hiddenVillages` och evigt fokusläge nekas. |
| 12 Skapa/radera klass eller elevkonto nekas | ✅ | KE "Test 12", attack A. |
| 13 Lösenord 4A ja, 5A nej, användarnamn nej | ✅ | FR "Test 13" (två tester), KE "Test 13 (reglerna)". Callables: lösenord på ett lärarkonto nekas. |
| 14 Nivåer ja, `coins` nej | ✅ | KE "Test 14". Attack B: `coins`, `xp`, `lasresa.moneyEarned`, nollställning via `mergeFields` och Ekvationsresans mynt nekas. Se O1 och O2. |
| 15 Klassmatchen 4A mot 5A ja, 5A mot 6A nej | ✅ | LE "Test 15". Attack D: Live utan egen klass i alla format, och med någon annan som `createdBy`, nekas. |
| 16 Starta och avsluta en match med 4A | ✅ | LE "Test 16". Attack D: byta en match till andras klasser och sätta kassapris nekas. |
| 17 Mattematchen skapa/nollställa nekas | ✅ | LE "Test 17", attack A. UI: "Det här kan bara admin göra." |
| 18 Ge mynt, klasskassa, pokal nekas | ❌ | LE "Test 18" är grönt (direkt `coins`, kassa, pokal, EXP), men **H1 och H2** ger mynt utan riktig match. |
| 19 `teacherAccounts` och admin-funktioner nekas | ✅ | TA "test 19", FT "test 19", FR test 19. Attack A: eget dokument (klasser, roll, aktiv) går inte att ändra. Callables: alla 5 admin-funktioner + 3 kartfunktioner nekas för elev, Årskurs 4 och övergången. |
| 20 Admin skapar årskurskonto, ser bara sina klasser | ✅ | FT "test 20". UI: Årskurs 4 ser bara 4A och 4B (Översikt, Klasser, Statistik). |
| 21 Ta bort 4B slår igenom direkt | ✅ | FT "test 21". Attack F: samma token når inte 4B. Callables: `updateStudentLogin` för en elev i 4B nekas med samma token. |
| 22 Avstängt konto kan inte logga in eller skriva | ✅ | FT "test 22", OG avstängt konto. Attack F: avstängt och raderat konto läser och skriver inget. Callables: inloggning nekas, gammal token nekas. (Admin: se H3.) |
| 23 Egen adminroll / sista admin nekas | ✅ | FT "test 23" (två tester). |
| 24 Migreringen gör alla lärare till admin | ✅ | FM "test 24" (fyra tester). Drift steg 2–3 från main-läge. |
| 25 `teacher: true` utan roll = admin | ✅ | OG "Test 25". Drift: gammal token gör allt under de nya reglerna, och nekas när övergången tagits bort (§8.1). |
| 26 Alla befintliga tester gröna | ✅ | Se "Regression". Äldre regeltester kör sina lärare som admin. |
| 27 Årskurs 4 ser bara tillåtna delar | ✅ | UI (emulator, `qaarskurs4`): naven har Översikt, Klasser, Material, Live och tävlingar, Statistik, inte Admin. Direktlänkar till Lärarkonton, Klasser & elevkonton, Mattematchen och Hitta rätt! visar "Det här kan bara admin göra." Klasser har bara Områden, Lägen per område, Synlighet, Fokusläge, Inloggning. "Inloggad som Årskurs 4". |
| 28 Skärmdumpar båda rollerna, 1366×768 och 1920×1080 | ✅ | `docs/qa-lararkonton/` (nedan). |

## Säkerhetsgranskning – vad som prövades

Som Årskurs 4 med egen klient (Firestore-emulatorn, de riktiga reglerna):

- **Direkt skrivning utanför §2.1 (attack A):** `teacherAccounts` (eget och andras,
  nytt konto), `students`, `studentCredentials`, `classes` (skapa/radera),
  `subjects`, `classProjections`, `classProjects`, `mathCompetitions` och
  `studentStats`, klasscentret (profil, kassa, kassahistorik, insamling,
  inredning), `hittaRattPacks`/`Boards`/`Best`, okänd samling, annans
  `liveClock`, `studentData` (skapa, radera, underdokument). Allt nekas.
- **Otillåtna fält via `update` och `set`+`merge` (attack B):** se test 11, 14
  och 6. Allt nekas utom O1–O3.
- **Andra klassers elever via queries (attack C):** se test 2. Allt nekas utom
  O4–O5.
- **Live utan egen klass (attack D):** Klassmatchen, Guldrushen och
  Datakuppen utan egen klass eller med blandade klasser, påhittad `createdBy`,
  ta över en match. Allt nekas.
- **Pluggmynt (attack E):** H1 och H2.
- **Avstängd och gammal token (attack F):** avstängt, raderat, 4B borttagen,
  dokumentet ändrat till admin men claims kvar som arskurs, påhittade
  claims-varianter (`role: "admin"`, `admin: false`, arskurs utan dokument),
  elev som skapar sitt eget lärarkonto. Allt nekas. Admin: H3.
- **Varje callable med annan roll (Callables):** `updateStudentLogin`, 3
  kartfunktioner, 5 admin-funktioner och 9 elevfunktioner mot elev, Årskurs 4,
  övergången, gammal token efter borttagen klass och avstängning, och
  nedgraderad eller avstängd admin. Allt som väntat utom H3.

## Ingen utelåsning – driftordningen torrt

`admin/qa-lararkonton-drift.mjs` (Auth + Firestore-emulatorn, utdata i
`docs/qa-lararkonton/drift-torrkorning.txt`). 17 kontroller, alla ✓:

1. **Main-läge:** reglerna från `origin/main`, två lärare med bara
   `teacher: true`, elever, klasser, material utan `createdBy`. Lärare A loggar
   in och gör tio vardagssaker: läsa elevdata och lösenord, ge mynt, skapa och
   döpa om klass, skapa elev, ändra material, skapa ämne, skapa Mattematchen,
   Live med kassapris.
2. **Fel ordning:** de nya reglerna före migreringen. A:s gamla token gör allt
   tack vare övergången.
3. **Steg 2:** torrkörningen listar båda som "blir admin" och skriver
   ingenting. `--apply` ger "✓ Klart" och två "✓ admin:true".
4. **Steg 3:** "0 konto(n) blir admin", båda "redan admin". `--apply` igen
   ändrar inget.
5. **Steg 4:** de nya reglerna. A:s token från före migreringen och en ny
   token (`admin: true`) gör båda allt. Eleven skriver sin egen elevdata som
   förut och läser inte lärarkontona.
6. **§8.1, övergången borttagen:** den gamla `{ teacher }`-token nekas allt.
   En ny admin-token gör allt.
7. **§8.2, reserven:** `set-teacher-claim.mjs --username --password` skapar
   ett adminkonto med claims och dokument som kan skriva.

Steg 1 (functions) och 5 (webbplatsen) prövades inte i torrkörningen.
Functions täcks av `test:functions` och Callables, klienten av UI-genomgången.

## Regression

| Svit | Resultat | Hur |
| --- | --- | --- |
| `node --test` | 2344/2344 | De 180 filerna i `test/` utan emulator (alla utom `firestore-rules*`, `functions-*`, `e2e-*`, som körs nedan). Se O7. |
| `npm run test:rules` | 568/568 | Samma filer som skriptet, `emulators:exec --only firestore`. |
| `npm run test:functions` | 183/183 | `--project pluggportalen-so-2026`, med `FUNCTIONS_EMULATOR_HOST` satt till emulatorns port. Utan den går anropen till 5001, som kan vara en annan emulator. |
| `npm run test:e2e` | 5/5 | `emulators:exec --only auth,firestore`. |
| Attack (rules) | 28/28 | `admin/qa-lararkonton-attack.mjs`. HÅL- och OKLART-testerna bevisar fynden. |
| Callables | 7/7 | `admin/qa-lararkonton-callables.mjs`, färsk emulator. |
| Drift | 17/17 ✓ | `admin/qa-lararkonton-drift.mjs`. |

Kör QA-filerna själv:

```bash
firebase emulators:exec --only firestore --project demo-qa \
  "node --test admin/qa-lararkonton-attack.mjs"
firebase emulators:exec --only functions,auth,firestore --project pluggportalen-so-2026 \
  "FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 node --test --test-concurrency=1 admin/qa-lararkonton-callables.mjs"
firebase emulators:exec --only auth,firestore --project pluggportalen-so-2026 \
  "node admin/qa-lararkonton-drift.mjs"
```

## Skärmdumpar (test 28)

Från emulatorn (`admin/qa-larkonton-roller-preview.sh`), som `qaadmin` och
`qaarskurs4`:

| Roll | 1366×768 | 1920×1080 |
| --- | --- | --- |
| Admin, Översikt | `qa-lararkonton/admin-oversikt-1366x768.png` | `qa-lararkonton/admin-oversikt-1920x1080.png` |
| Admin, Lärarkonton | `qa-lararkonton/admin-lararkonton-1366x768.png` | `qa-lararkonton/admin-lararkonton-1920x1080.png` |
| Årskurs 4, Översikt | `qa-lararkonton/arskurs4-oversikt-1366x768.png` | `qa-lararkonton/arskurs4-oversikt-1920x1080.png` |
| Årskurs 4, Klasser | `qa-lararkonton/arskurs4-klasser-1366x768.png` | `qa-lararkonton/arskurs4-klasser-1920x1080.png` |
| Årskurs 4, Material | `qa-lararkonton/arskurs4-material-1366x768.png` | – |

## Elias steg

1. **Före allt annat:** H1 och H2 rättas i `firestore.rules`, och HÅL-testerna
   vänds och flyttas in i `test:rules`. Driftsätt inte reglerna förrän dess.
   Gör det inte heller om du bara vill köra steg 1–3 nu: functions och
   migreringen är ofarliga ensamma.
2. Bestäm H3: godta en timme, eller kräv ett aktivt dokument även för admin.
3. Svara på valen 1–8 i `BEHORIGHETER.md` och O1–O4 ovan (eller godta dem).
4. Följ `docs/ADMIN.md` §8 i ordning:
   1. `cd functions && npm install && cd ..`, sedan
      `firebase deploy --only functions --project pluggportalen-so-2026`.
      Svara nej om CLI:t vill radera funktioner.
   2. `node admin/migrate-teacher-admins.mjs`. Läs listan.
      Kör sedan `node admin/migrate-teacher-admins.mjs --apply`.
   3. `node admin/migrate-teacher-admins.mjs` igen. Det ska stå
      "0 konto(n) blir admin". Logga in med ditt adminkonto.
   4. `firebase deploy --only firestore:rules,firestore:indexes --project pluggportalen-so-2026`.
      Logga in som admin och kolla klasser, statistik och ge mynt.
   5. Merga epic-PR:en till main. Vänd inte på symptom de första tio
      minuterna. Kör sedan `firebase deploy --only hosting` från main.
      Skapa ett årskurskonto och logga in med det.
5. Tidigast en timme efter steg 4.2: ta bort övergången enligt §8.1, i en egen
   PR. Torrkörningen ovan visar att det är säkert när alla har loggat in igen.
