# Läsresan

Adaptiv läsförståelseträning (åk 3–6) som en egen huvudmodul i Pluggportalen.
Eleven går en resa med sin avatar (1 färdig text = 1 steg, 20 steg = en värld),
medan en **dold** nivå 1–10 avgör hur svår nästa text blir. Produktspec:
`BYGG_EN_NY_MODUL_I_PLUGGPORTALEN.txt` (epic #398, innehållsepic #404).

Det här dokumentet beskriver kärnan från issue #399: analysen av befintliga
system, arkitekturen, datamodellen och kontrakten som kartan (#400), läsvyn
(#401) och lärarvyn (#402) bygger på.

---

## 1. Analys: befintliga system och hur Läsresan återanvänder dem

### Elev-/lärarkonton och klasser
- **`src/auth.js`**: äkta Firebase Auth bakom ett användarnamn. Eleven loggar
  in med `username` som mappas till en syntetisk e-post
  (`username@elev.pluggportalen.local`). Elevens **Auth-uid = dokument-id** i
  `students/{id}` och `studentData/{id}`. Läraren är ett Auth-konto med custom
  claim `teacher: true` (`isTeacher()`). Appen läser sessionen synkront via
  `currentStudentId()` / `isLoggedIn()`.
- **Klasser**: `classes/{classId} = { name, studentIds[], … }`
  (`src/data-classes.js`). En elev kan finnas i flera klasser.
  `src/klass-membership.js` har den rena logiken (`myClasses`, `classmateIds`).
- **Lärarsidan** (`teacher-classes.js` = den enade klassfliken, med
  `teacher-class.js` för stjärnmatrisen och `teacher-class-detail.js` för
  per-elev-detaljen) listar en klass elever via `classes.studentIds` +
  `students`. Det finns ingen ägarmodell lärare→klass: "lärare" = claimen.
- **Läsresan återanvänder**: samma inloggning, samma `studentData/{uid}` och
  samma `classes.studentIds` för lärarens klasstabell. Inga nya konton eller
  relationer. Firestore-regeln för försöken använder befintliga `isSelf` och
  `isTeacher`.

### Avatar
- `students.avatarId` + spegel i `studentData.avatarId`, burna kläder i
  `studentData.avatarItems`. `src/avatars.js` → `avatarMarkup(avatarId,
  avatarItems)` ger HTML (inline-SVG från `art-characters*.js` +
  `art-wearables*.js`) som skalar med `font-size`.
- **Läsresan återanvänder**: kartan får `avatar = { avatarId, avatarItems }` och
  ritar med `avatarMarkup`. Ingen egen avatar.

### Pengar
- `studentData.coins` = **pluggcoins**. `data.addCoins(amount, studentId?)` är en
  transaktion som returnerar nytt saldo, och `data.getCoins()` läser saldot.
  Sidomenyn (`ui.js renderTopbar`) visar saldot med `coinIcon()` (`icons.js`).
- Spec:ens "kr" = pluggcoins. **Läsresan återanvänder**: `rewards.award()` →
  `data.addCoins` (3 per rätt). Inget eget saldo. `lasresa.moneyEarned` är bara
  statistik (hur mycket som tjänats via Läsresan), inte ett saldo.

### Skattjaktens grafik
- `src/adventure/themes/skattjakten.js` (tema), `skattjakten-map.js` (ren
  geometri, testbar) och `skattjakten-scen-svg.js` (handritad inline-SVG,
  1536×1024). Stilen kommer från `src/art-style.js` (plommonkontur `O`,
  `LINE`, platta mjuka former, glad palett). Mönstret är **map → scen-svg →
  wiring**, och bilder är aldrig inklistrade JPG:er.
- **Läsresan återanvänder**: samma uppdelning. `worlds/*.js` är ren data
  (geometri: `scene`, `start`, `stepPositions`, `decorations`), och kartvyn
  (#400) ritar scenen i samma SVG-stil.

### Befintligt läs-system (RÖRS INTE)
- `studentData.readingLevel` (1–3, lärarsatt, `src/reading-level.js`,
  `data-reading-level.js`), Läsuppdrag `games-lastext.js` och
  `validate-reading.js` (områdenas `readingTexts`).
- Läsresan är **helt separat**: egen nivå `studentData.lasresa.level` (1–10, före epic #516 1–7),
  egna texter (`src/lasresan/content/`) och egen validator. Ingen befintlig fil i
  det systemet är ändrad.

---

## 2. Arkitektur (`src/lasresan/`)

Allt utom Firestore-bryggan är ren logik utan DOM och Firestore, och testas med
`node --test test/lasresan-*.test.js`.

| Fil | Ansvar |
| --- | --- |
| `config.js` | Alla justerbara tal: nivå 1–10, start 4, 70 %/50 %, streak 3/2, 3 coins/rätt, 20 steg, frågor per nivå (`QUESTIONS_BY_LEVEL`, annars 5–9), ordantal per nivå |
| `level.js` | Dold nivå: `applyResult(state, {correct,total})`, `classifyResult`, `normalizeLevel`, `percent` |
| `journey.js` | Resan: `completeStep(progress, worlds)`, `normalizeProgress` |
| `picker.js` | Textval: `pickText(level, seenTextIds, bank, {lastTextId, rng})` |
| `stats.js` | Aggregering: `summarize`, `categoryBreakdown`, `aggregateAttempts`, `classRows`, `sortRows` |
| `rewards.js` | `coinsFor(correct)`, `award(correct)` → `data.addCoins` (lat import) |
| `progress.js` | Elevens tillstånd: `defaultLasresa`, `normalizeLasresa`, `withStartedText`, `buildAttempt`, `applyCompletion` (kärnan i completeText-transaktionen) |
| `level-control.js` | Lärarstyrd nivå (#505): `parseTeacherLevel`, `withTeacherLevel`, `applyPendingLevel`, `hasStartedLasresa`, `effectiveStartLevel`, `classStartLevelOf` |
| `level-scale.js` | Nivåskala 1–10, lat migrering (#519): `readStoredLevels`, `toStoredLasresa`, `readClassStartLevel`, `classStartLevelFields`, `normalizeAttempt` |
| `worlds/` | `index.js` (register + schema + `validateWorld`), `skogen.js` + `skogen-scen.js`, `oknen.js` + `oknen-scen.js`, `stig.js` (stig-geometri, delas av konst och gånganimation), `layout.js` |
| `content/` | `loader.js` (fetch + fallback), `validate.js`, `dev-seed.js` |
| `ui-map.js` | Kartvyn (#400): världs-agnostisk renderare + `ui-map-stil.js` (CSS, injiceras – rör inte styles.css) |
| `ui-reader.js` | Läsvyn (#401): text + en fråga i taget, låsta svar, ✅/❌ |
| `reader-logic.js` | Läsvyns rena logik: stabil blandning av alternativen, pågående svar i localStorage |
| `ui-summary.js` | Sammanfattning efter en text + "Min läsning" (aldrig nivån) |
| `lasresan.css` | Stilar för läsvy/sammanfattning/Min läsning, laddas LAT av page-lasresan |
| `page-lasresan.js` | Route-skal: karta → text → completeText → sammanfattning → karta, `?vy=min` = Min läsning |
| `../data-lasresan.js` | Firestore-brygga: `getLasresa`, `startText`, `completeText`, `listAttempts`, `getClassLasresa` |
| `../data-lasresan-niva.js` | Firestore-brygga för lärarstyrd nivå (#505): `setStudentLevel`, `setClassLevel`, `getClassStartLevel`, `setClassStartLevel`, `getStudentStartLevel` |

**Bootgrafen:** inget under `src/lasresan/` och inte `data-lasresan.js`
importeras statiskt från `app.js`. Routen `#/elev/lasresan` (#401) laddar
`page-lasresan.js` med dynamisk `import()` via `pageElevLasresan()` i `app.js`
(samma mönster och samma snälla felvy som äventyret). `lasresan.css` läggs in
som `<link>` av sidan själv, så `index.html` är orörd.
`test/lasresan-reader.test.js` gör en BFS över de statiska importerna från
`app.js` och faller om en Läsresan-modul hamnar i bootgrafen.

### Läsvyn och slutför-flödet (#401, beslut)
- **Nav:** "📖 Läsresan" i `NAV_LANKAR` (`ui.js`) direkt efter Plugga. Plugga är orörd.
  `body.lasresan-lage` ger en bredare innehållsyta (1180 px).
- **Layout:** bred skärm = text och fråga sida vid sida, båda `sticky`, och
  texten har en egen scrollruta. Under 860 px ligger texten överst i en fäst
  scrollruta (42 vh) med frågan under, så texten syns alltid.
- **Frågor:** en i taget, 4 stora knappar (A–D). Alternativen blandas
  **stabilt per fråga** (`displayOrder("textId/qid")`), så rätt svars position i
  innehållet blir ingen ledtråd och ordningen är densamma efter en omladdning.
  Vyn skickar alltid originalindex. Klick → alla knappar låses → ✅ Rätt! / ❌ Fel
  → nästa fråga automatiskt efter 1,1 s (fel: 1,6 s).
- **Rätt svar avslöjas inte vid fel** (spec §7 säger bara ✅/❌). Det kan läggas
  till i `ui-reader.js` om lärarna vill.
- **Påbörjad text:** svaren sparas efter varje klick i
  `localStorage["pp:lasresan:pagaende:<elevId>"]`. Lämnar eleven texten (← Kartan,
  omladdning) återupptas samma text på samma fråga med de låsta svaren, så det
  går inte att ladda om och svara om. Rensas när `completeText` lyckats. Om
  sparandet misslyckas finns alla svar kvar, och nästa försök slutför direkt.
- **Slutför:** `completeText` (försök + tillstånd + dold nivå i en transaktion,
  coins via `addCoins`) → sidomenyns saldo ritas om → sammanfattning ("Superbra
  läst!", "✅ 5 av 6 rätt", "+15") → "Gå vidare" → kartan med
  `animateFromStep = walk.fromStep`. Rubrikerna är alltid positiva, och nivån eller
  en nivåändring nämns aldrig.
- **Världsbyte:** sammanfattningen visar "🏆 Skogen är klar! Nu väntar Öknen.".
  Kartan ritar sedan den **gamla** världen på sista steget (animation 19→20),
  och verktygsraden får knappen "Vidare till Öknen →" som ritar den nya världen.
  Kartan får också de valfria fälten `walk` och `worldCompleted` (utöver kontraktet).
- **Min läsning:** `#/elev/lasresan?vy=min` (knappen "📊 Min läsning" ovanför
  kartan). Fem rutor ur `summarize(lasresa)`: texter, frågor, rätt, % rätt och
  pluggcoins. Ingen nivå och inga jämförelser.

### Nivålogik (spec §10)
- `correct*100 >= 70*total` → **hög**: highStreak+1, lowStreak=0. Vid 3 → nivå +1 (tak 10).
- `correct*100 < 50*total` → **låg**: lowStreak+1, highStreak=0. Vid 2 → nivå −1 (golv 1).
- Annars (50–69,99 %) → båda streaks nollas.
- Efter nivåbyte nollas båda streaks. Vid tak/golv nollas streaken ändå.
- Heltalsjämförelse, så exakt 70 % är hög och exakt 50 % är inte låg.

### Resan (spec §3–6)
- Alltid +1 steg per färdig text, oavsett resultat. Nivån påverkas aldrig av
  världsbyte.
- Steg 20/20 → världen läggs i `completedWorlds`, nästa värld i registret
  öppnas på steg 0. `completeStep` returnerar `walk: {worldId, fromStep, toStep}`
  (i den gamla världen) så kartan kan animera fram till sista steget innan bytet.
- **Efter sista världen (beslut):** världen markeras klar och eleven står kvar på
  sista steget (`stepInWorld = steps`). Eleven kan fortsätta läsa: texter, pengar,
  nivå och statistik fungerar som vanligt, men avataren går inte längre. Läggs
  en ny värld till i registret flyttar `normalizeProgress` eleven dit vid nästa
  läsning, utan migrering.
- Okänd/borttagen värld i sparad data → första ej klarade värld, steg 0.

### Textval (spec §11)
1. Ej sedda texter på nivån → slumpa bland dem.
2. Nivåns pool slut → slumpa bland sedda på nivån, men aldrig samma som senast
   (om det finns något annat).
3. Nivån saknar texter → närmaste nivå med texter (vid lika avstånd den lättare).

### Påbörjad text
`startText` sätter `lasresa.currentTextId`. Så länge den är satt returnerar
`startText` samma text (`resumed: true`), så en omladdning ger samma text och
man kan inte hoppa över en dålig text. `completeText` kräver att
`currentTextId === text.id`. Annars returneras `{ok:false}` och inget skrivs,
vilket skyddar mot dubbelklick och dubbelbelöning. `force: true` används bara
om den påbörjade texten har försvunnit ur banken.

### Lärarstyrd nivå (#505, epic #482 – spec §2–5)
Ren logik i `level-control.js` (testad i `test/lasresan-level-control.test.js`),
Firestore i `data-lasresan-niva.js` (bara dynamiskt importerad).

- **Enskild elev** (`setStudentLevel`, EN transaktion per elev,
  `withTeacherLevel`):
  - ingen påbörjad text → `level` sätts direkt och båda streaks nollas;
  - påbörjad text (`currentTextId`) → `pendingLevel` sparas. Texten slutförs
    på den gamla nivån; `applyCompletion` räknar resultatet som vanligt och
    sätter sedan `level = pendingLevel`, streaks 0, `pendingLevel = null`.
  - Båda stämplar `levelSetAt` (ms) och `levelSetBy: "teacher"`.
  - Inget annat rörs: resultat, `seenTextIds`, totaler, `catStats`,
    världar/steg, `moneyEarned`, coins och `lasresaAttempts` står kvar.
  - Därefter fortsätter den vanliga automatiska progressionen från vald nivå.
  - Race-skydd: `normalizeLasresa` och `withStartedText` lägger en kvarglömd
    `pendingLevel` på plats så fort ingen text är påbörjad (t.ex. vid
    `force`-byte), så `pendingLevel` finns bara medan en text pågår.
- **Hela klassen** (`setClassLevel(classId | studentIds, level)`): samma sak
  per elev, parallellt; ett misslyckat byte stoppar inte de andra. Returnerar
  `{ level, total, updated, now, pending, failed[] }`. Enskilda elever kan
  ändras efteråt.
- **Klassens startnivå** (`classes/{id}.lasresaStartLevel10`, heltal 1–10,
  plus spegeln `lasresaStartLevel` i gammal skala – se "Nivåskala 1–10" nedan):
  ersätter `START_LEVEL` (4) för elever som **inte har börjat**.
  **Definition:** eleven har inte börjat = `studentData.lasresa` saknas helt.
  Objektet skapas först av `startText` (första texten) eller när läraren sätter
  en individuell nivå. Därför påverkar startnivån aldrig elever som är igång, och
  en lärarsatt individuell nivå vinner alltid över startnivån.
  `getLasresa`/`startText` slår upp elevens klass (`getClassForStudent`, första
  klassen i ordningen om flera) via `getStudentStartLevel` och skickar den till
  `normalizeLasresa(raw, worlds, { startLevel })`; första texten sparas då på
  startnivån. Fel vid uppslag → 4. `hasStartedLasresa(raw)` (läst, påbörjad
  eller sedd text) används av lärartabellen för "ej börjat" – en elev med bara
  en lärarsatt nivå visas som ej börjat men med lärarens nivå.
- **Ogiltiga nivåer:** lärarens val tolkas STRIKT (`parseTeacherLevel`: heltal
  1–10, även `"4"` från en `<select>`); 0, 11, 3.5, `"abc"` → bryggan kastar.
  Ogiltig `pendingLevel`/startnivå i lagrad data ignoreras (→ 4).
- **Behörighet:** `classes` skrivs bara av lärare; `lasresaStartLevel10`
  valideras som heltal 1–10 och spegeln `lasresaStartLevel` som heltal 1–7 i
  `firestore.rules`; studentData skrivs bara av eleven själv eller lärare.
  Regeltester: `test/firestore-rules-lasresan-niva.test.js`.
  ⚠️ DEPLOY KRÄVS: `firebase deploy --only firestore:rules`. Klienten fungerar
  även innan: den skriver bara spegelvärden 1–7 i det gamla fältet, och de
  gamla reglerna validerar inte `lasresaStartLevel10`.

### Nivåskala 1–10: lat migrering (#519, epic #516)
Gamla nivå N = nya nivå N+3 (banken omnumrerad i #518, text-id:n oförändrade).
Det finns **inget engångsskript**. Lagrad data tolkas vid läsning och skrivs
i ny form vid nästa skrivning. All logik ligger i `src/lasresan/level-scale.js`
(ren, testad i `test/lasresan-level-scale.test.js`).

**Designval: ny skala i NYA fältnamn, de gamla fälten blir en spegel.** En
gammal cachad klient (Pages cachar JS ~10 min, och en flik kan stå öppen i
timmar) klampar `lasresa.level` till 1–7 och sprider okända fält (`...raw`).
Med bara en skalmarkör och ny nivå i `level` skulle den skriva 9 → 7 och
markören stå kvar, vilket ger tyst korruption. Därför gäller detta:

| Data | Ny skala (gäller) | Spegel, gammal skala (gamla klienter) |
| ---- | ----------------- | ------------------------------------- |
| `studentData.lasresa` | `level10`, `pendingLevel10` (1–10) | `level`, `pendingLevel` = ny − 3, klampad 1–7 |
| `classes/{id}` | `lasresaStartLevel10` (1–10) | `lasresaStartLevel` = ny − 3, klampad 1–7 |
| `lasresaAttempts` | `levelScale: 10` på nya försök (`textLevel` är då ny skala) | – (försök skrivs bara en gång) |

- **Läsning** (`readStoredLevels`, `readClassStartLevel`):
  - Saknas det nya fältet är datat gammalt, och nivån flyttas +3. Gammal 1/3/7
    blir 4/6/10, gammal pendingLevel 2 blir 5 och gammal startnivå 3 blir 6.
  - Finns det nya fältet och spegeln stämmer gäller det nya fältet.
  - Stämmer spegeln **inte** har en gammal klient ändrat nivån (progression
    eller lärarbyte i gammal vy). Då vinner dess värde +3. Om spegeln för
    väntande nivå är borta (förbrukad) men nivåspegeln motsvarar den väntande
    nivån gäller `pendingLevel10`. Om en gammal lärarvy tagit bort
    startnivåspegeln gäller standardnivån.
- **I minnet** (`normalizeLasresa`) bär `level`/`pendingLevel` alltid ny skala,
  och objektet märks `levelScale: 10`. Det gör att en ny normalisering aldrig
  lägger på +3 igen (idempotent). Märkta objekt och objekt med `level10` får
  aldrig +3 en gång till.
- **Skrivning:** bryggorna (`data-lasresan.js`, `data-lasresan-niva.js`)
  skriver ALLTID `toStoredLasresa(lasresa)`. Den kastar om objektet inte är
  normaliserat, så rå data kan aldrig skrivas med fel skala. Startnivån skrivs
  med `classStartLevelFields(level)` (båda fälten).
- **Ofarligt för gamla klienter:** de läser spegeln, som är en giltig nivå på
  deras skala, och skriver tillbaka den eller sin egen ändring av den. De nya
  fälten följer med orörda genom `...raw`. Nivå 8–10 kan alltså inte klampas
  bort. Kvar finns en grovhet: ny nivå 1–4 har samma spegel (1), så en gammal
  klient som flyttar en elev på nivå 1–3 uppåt hamnar på 5.
- **Försök:** nya försök bär `levelScale: 10`. `listAttempts` normaliserar
  gamla försök (`normalizeAttempt`): text-id:t avgör nivån när det följer
  konventionen (`lr-n<N>` = N+3, `lr-g<N>` = N), annars gäller `textLevel` +3.
- **Oförändrat:** `seenTextIds`, totaler, `catStats`, världar/steg och pengar.
  Text-id:n är identiska före och efter #518 (alla 280 kontrollerade), så
  lästa texter behöver ingen migrering.
- **Progression:** `level.applyResult` gäller över 1–10 med golv 1 och tak 10
  (tester för 1↔2 och 9↔10).

---

## 3. Datamodell

Se även `docs/DATAMODELL.md`.

### `studentData/{id}.lasresa` (map)
Lagringsform (#519). I minnet efter `normalizeLasresa` är `level`/`pendingLevel`
på skalan 1–10 och `levelScale: 10`, utan `level10`/`pendingLevel10`.
```
{ level10, pendingLevel10,                   // #519: DOLD nivå 1–10 + väntande lärarnivå (1–10 | null)
  level, pendingLevel,                       // SPEGEL i gammal skala 1–7 (för gamla klienter)
  highStreak, lowStreak,
  worldId, stepInWorld, completedWorlds[],   // resan (stepInWorld 0 = före steg 1)
  totalTexts, totalQuestions, totalCorrect, totalIncorrect,
  moneyEarned,                               // pluggcoins tjänade via Läsresan (statistik)
  seenTextIds[], catStats{kategori:{q,correct}},
  currentTextId, currentStartedAt, lastTextId,
  updatedAt,                                 // ms sedan epoch
  levelSetAt, levelSetBy }                   // #505: senaste lärarbyte (ms | null, "teacher" | null)
```
Saknas fältet räknas eleven som ny (Skogen, steg 0, klassens startnivå
`classes/{id}.lasresaStartLevel10` eller 4) via `normalizeLasresa`. Gamla
objekt utan `level10` har nivåerna i gammal skala och flyttas +3 vid läsning
(se "Nivåskala 1–10"). Andra saknade fält får `null`.

### `studentData/{id}/lasresaAttempts/{autoId}`
Ett dokument per färdig text:
```
{ textId, title, textType, textLevel, levelScale, studentId,   // levelScale 10 = textLevel 1–10 (#519); saknas = gammal skala
  startedAt, completedAt,                    // ms sedan epoch
  totalQuestions, correct, incorrect, percentage, earnedMoney,
  perQuestion: [{ qid, category, chosen, correct }],
  perCategory: { kategori: { q, correct } } }
```

### Regler och degradering
- `firestore.rules`: `lasresaAttempts` läses och skrivs av **eleven själv eller
  läraren**, inte av klasskamrater. Testas i
  `test/firestore-rules-lasresan.test.js` (`npm run test:rules`).
- ⚠️ **Regeln måste deployas separat**: `firebase deploy --only firestore:rules`.
- **Innan deploy (beslut):** subkollektionen nekas i produktion. Då gör
  `completeText` om transaktionen utan subkollektionen och sparar försöket i
  `studentData.lasresaAttemptsFallback` (de senaste 30) med en `console.warn`.
  Nivå, steg, totaler och pengar fungerar som vanligt. `listAttempts` läser båda
  källorna. Obs: studentData är läsbart för inloggade (#114), så fallback-försöken
  är tekniskt läsbara för andra elever tills regeln är deployad. Appen visar dem
  aldrig.

### Pengar och atomicitet
Försök och tillstånd skrivs i **en** transaktion. Pengarna läggs därefter på
via `data.addCoins` (spec: återanvänd befintligt ekonomisystem). Om
`addCoins` misslyckas finns försöket redan sparat med `earnedMoney`, och felet
loggas. `currentTextId`-spärren gör att samma text aldrig belönas två gånger.

---

## 4. Kontrakt för UI (#400, #401, #402)

### Kartan: `ui-map.js`
```js
renderJourneyMap(container, { world, progress, avatar, animateFromStep, onStartNext }) → { destroy() }
```
- `world`: värld ur `worlds/index.js`. `progress`: `{ worldId, stepInWorld, completedWorlds }`.
- `avatar`: `{ avatarId, avatarItems }`, ritas med `avatarMarkup`.
- `animateFromStep`: `number|null`. Gå från detta steg till `progress.stepInWorld`.
  Efter `completeText` skickar skalet `res.walk.fromStep`. Vid världsbyte är
  `progress` redan den nya världen, och kartan bör visa `res.walk` i den gamla
  världen först.
- Stegstatus: steg ≤ `stepInWorld` = klara, `stepInWorld+1` = nästa (klickbart),
  resten = kommande (synliga, låsta). `stepInWorld === steps` = världen klar.
- **Valfria extrafält** (skickas av sidan i #401, okända fält tåls): `walk` =
  `{worldId, fromStep, toStep}` och `worldCompleted` (bool). Vid världsbyte ritar
  sidan först den GAMLA världen med `stepInWorld = steps` och `animateFromStep =
  walk.fromStep`; kartan går avataren fram till flaggan och firar
  ("🎉 … är klar!" + "nästa värld öppnas"). Sidans egen "Vidare →"-knapp och
  verktygsrad ligger OVANFÖR kartans container – kartan ritar inget utanför sin
  container.
- Firandet visas bara i samband med en gång/`worldCompleted`, inte varje gång en
  redan klar värld ritas om. `prefers-reduced-motion` ⇒ hopp i stället för gång
  och ingen puls/konfetti. Kartans CSS injiceras av `ui-map-stil.js` (prefix
  `lr-`), inget i styles.css.
- Världsväljaren (pills uppe till vänster i kartan) visar alla världar i
  registret: klara (✓, klickbara att titta på), aktiv, låsta (🔒, ej klickbara).

### Läsvyn: `ui-reader.js`
```js
renderReader(container, { text, onDone }) → { destroy() }
onDone({ answers: [{ qid, chosen }] })
```
- `chosen` = index i textens **originalordning** av `options`, även om vyn
  blandar visningen. Rättning, procent, pengar och nivå räknas av kärnan.
- Texten står kvar, en fråga i taget, svaret låses, ✅/❌ direkt. Visa aldrig nivån.

### Bryggan: `data-lasresan.js`
- `getLasresa(studentId?)` → normaliserat tillstånd (innehåller `level`, som bara får visas för läraren).
- `startText(textId, studentId?, {force})` → `{ textId, resumed }`.
- `completeText({ text, answers }, studentId?)` →
  `{ ok, attempt, progress, walk, worldCompleted, completedWorldId, unlockedWorldId, coins, balance, attemptStoredIn }`.
  Nivån returneras medvetet inte.
- `listAttempts(studentId?, max=20)` → försök, nyast först.
- `getClassLasresa(studentIds)` → `[{ studentId, lasresa|null }]`. En läsning per
  elev, bara i lärarvyn.

### Bryggan: `data-lasresan-niva.js` (#505, lärare)
- `setStudentLevel(studentId, level)` → `{ studentId, level, applied: "now"|"pending" }`.
- `setClassLevel(classId | studentIds[], level)` → `{ level, total, updated, now, pending, failed:[{studentId, error}] }`.
- `getClassStartLevel(classId)` → `1–10 | null` (null = ej satt → 4).
- `setClassStartLevel(classId, level | null)` → sparad nivå (null tar bort fältet).
- `getStudentStartLevel(studentId?)` → startnivån som gäller för eleven (1–10).
- Rena hjälpare för lärar-UI:t: `teacherClassRows(entries, worlds, { startLevel })`
  (raden har även `pendingLevel`), `classStartLevelOf(classDoc)`,
  `parseTeacherLevel(value)`.

### Statistik: `stats.js`
- Elevens "Min läsning": `summarize(lasresa)` (utan nivå).
- Lärarens tabell: `classRows([{studentId, namn, lasresa}])` + `sortRows(rows, key, dir)`.
- Elevdetalj: `summarize(lasresa, {includeLevel:true})`,
  `categoryBreakdown(lasresa.catStats)` och `aggregateAttempts(await listAttempts(id))`.

### Lärarvyn (#402, beslut)
- **Plats:** klasskortets *Statistik*-panel har två flikar, **Ämnen** (den
  gamla stjärnmatrisen) och **Läsresan** (`teacher-class.js`). Läsresan-fliken
  laddar `src/teacher-lasresan.js` med dynamisk `import()` vid första klick, så
  inget av Läsresan hamnar i bootgrafen. Ingen egen sida.
- **Tabell** (`teacher-lasresan.js`): Elev | Texter | Frågor | Rätt | Fel |
  Rätt % | Läsnivå | Värld | Steg. Alla kolumner går att sortera. Lika värden
  sorteras på namn, och en saknad procent hamnar alltid sist. Nivåerna visas
  på skalan 1–10 (#520): `teacherClassRows` kör varje `lasresa` genom
  `normalizeLasresa` och elevdetaljen varje försök genom `normalizeAttempt`,
  så rå gammal-skala-data (utan `level10`/`levelScale`) visas +3 även från en
  injicerad källa. Ren logik ligger
  i `src/lasresan/teacher-rows.js` (`teacherClassRows`, `sortTeacherRows`,
  `nextSort`, `pctLevel`) och testas i `test/lasresan-teacher.test.js`.
- **Ej börjat** (`lasresa` saknas): texter/frågor/rätt/fel/% visas som "–",
  märkt *ej börjat*. Nivå, värld och steg visas och sorteras som startvärdena
  klassens startnivå (standard 4) / Skogen / 0. Den som har startat en text men inte avslutat någon räknas
  som börjad, men rätt % blir "–" eftersom det inte finns några svar.
- **"Värld"-sortering** går på resans läge (`world.order * 1000 + steg`).
  Öknen steg 2 räknas alltså som längre fram än Skogen steg 18.
- **Kvot:** tabellen läser bara `studentData.lasresa` via `getClassLasresa`, ett
  dokument per elev en gång. Försöken läses först i elevdetaljen
  (`teacher-lasresan-elev.js`, `listAttempts(id, 10)`), och bara för elever som
  har börjat. Läsfel visas i modalen och kraschar inget.
- **Per frågetyp** beräknas ur `lasresa.catStats` (alla texter), inte ur de 10
  senaste försöken. En kategori utan frågor visas som "inga frågor än", och
  helt utan data visas ett tomt läge.
- **CSS** ligger i `styles.css` under `.teacher-dark` med prefixet `lrt-`
  (`lr-` tillhör elevens `lasresan.css`).
- **Nivåstyrning (#506):** i Läsresan-fliken (bara när klassen skickas med, dvs. på
  klasskortet) ligger två kort ovanför tabellen, och elevdetaljen har en sektion
  **Ändra nivå**. Vyn finns i `teacher-lasresan-niva.js` (importeras av
  `teacher-lasresan.js`, så den är dynamisk; bryggan `data-lasresan-niva.js` laddas lat
  först vid sparning). Texterna kommer ur `lasresan/teacher-niva.js` (testas i
  `test/lasresan-teacher-niva.test.js`).
  - *Ändra klassens startnivå*: "Gäller nya elever och elever som inte har börjat" →
    `setClassStartLevel`. Visar nuvarande nivå ("Nivå 4 (standard)" om den inte är satt), väljare 1–10
    och en förklaring att 1–3 är de nya, enklare nivåerna (`NEW_LEVELS_HINT`). Elever utan
    `lasresa` visar startnivån i nivå-kolumnen.
  - *Ändra nivå för hela klassen*: klassväljare (förvald = aktuell, alla lärarens
    klasser), nivå → bekräftelsedialog (`role=alertdialog`) med klass, antal elever
    och nivå → `setClassLevel(studentIds, nivå)`, där listan är exakt de elever som
    räknades i dialogen. Resultatet visar antal satta, antal väntande och vilka som misslyckades.
  - *Elev*: nuvarande nivå + badge "Väntande nivå X" vid `pendingLevel`. Nivå-kolumnen
    visar `4 → 1` medan en ändring väntar. Efter sparning läses bara den eleven om.
  - CSS-prefix `lrn-` i `styles.css`. Emulator-preview:
    `admin/qa-lasresan-niva-preview.sh` (klickguide i `docs/preview-lasresan-niva.md`).
    Skalan 1–10 med elever i gammal och ny lagring: `admin/qa-lasresan-10-preview.sh`
    (proxy :8541, seed `qa-lasresan-10-seed.mjs`, klickguide `docs/preview-lasresan-10.md`).
- **Preview:** `preview-lasresan-larare.html` har stubbad klass med 8 elever:
  blandade nivåer, en som inte börjat, en utan avslutad text, en i Öknen och ett
  namn med HTML som testar escaping. `?tom=1` ger en klass utan elever.

---

## 5. Innehåll

Kontraktet delas med innehållsepicet #404 och ändras inte ensidigt:
```
src/lasresan/content/bank/manifest.json: { "version": 1, "levels": { "1": ["level-1.json"], …, "10": ["level-10.json"] } }
level-N.json: ReadingText[]
ReadingText = { id, title, level (1-10), textType ("story"|"fact"), topic, body ("stycke\n\nstycke"), questions: Question[] (antal per nivå, se nedan) }
Question   = { id, question, options: [4 strängar], answerIndex (0-3), category ("fakta"|"ordforstaelse"|"mellan_raderna"|"helhet_slutsats") }
```
- `content/bank/` ägs av #404. Motorn skapar inga filer där.
- **10 nivåer (epic #516, #518):** de gamla nivåerna 1–7 ligger nu på 4–10
  (gammal nivå N = ny nivå N+3; filerna flyttade och `level` +3, inget annat
  ändrat). Nivå 1–3 är nya, enklare nivåer (`level-1..3.json`, tomma tills
  D1–D3 fyller dem). En tom nivå är okej: pickern tar närmaste nivå med texter.
- **Frågor per text** (`questionRange(level)`, `QUESTIONS_BY_LEVEL` i
  `config.js`): nivå 1 = 3–4, nivå 2 = 4–5, nivå 3 = 5–7, nivå 4–10 = 5–9.
  Alltid 4 alternativ och exakt ett `answerIndex`.
- **Id-konvention** (id:t är en stabil nyckel i `seenTextIds`, `lastTextId`,
  `currentTextId` och `lasresaAttempts` – byts ALDRIG):
  - `lr-n<N>-<slug>` = gamla texter, ligger på nivå **N+3** (`lr-n1-…` = nivå 4).
  - `lr-g<N>-<slug>` = nya texter på nivå 1–3, ligger på nivå **N** (`lr-g1-…` = nivå 1).
  `levelFromId(id)` (validate.js) räknar ut nivån; loaderns `findText` använder
  den, och validatorn varnar om id-nivån och `level` inte stämmer.
- **Loadern** hämtar manifestet och sedan nivåfilerna lat per nivå (flera filer
  per nivå går bra). Varje text valideras, och texter med fel hoppas över med
  `console.warn`. Saknas en listad nivåfil (404) eller ger den inga giltiga
  texter används dev-seedens texter för just den nivån (om de finns, annars blir
  nivån tom och pickern tar närmaste nivå). Saknas hela banken (404/nätfel) eller
  kommer ingen enda text ur den används hela `dev-seed.js`: spec:ens fyra referenstexter (gamla nivå 1/3/5/7 = nya 4/6/8/10),
  kompletterade till 5–6 frågor var.
- **Validatorn** ger **fel** för saknade fält, fel antal frågor/alternativ,
  answerIndex utanför 0–3, okänd kategori/textType, nivå utanför 1–10 och
  dubblett-id. Den ger **varningar** för ordantal utanför nivåns riktintervall,
  id vars nivå inte stämmer med `level`, längdledtråd,
  saknat topic, likadana alternativ och skev fördelning av rätt svars position
  (> 40 % på en bokstav, från 12 frågor per nivå).
- Känd varning: spec:ens egen (gamla) nivå 7-referens (nu nivå 10) är 259 ord (riktintervall
  280–500). Den citeras ordagrant och har därför lämnats orörd.

---

## 6. Så bygger du ut

- **Ny text:** lägg den i rätt `content/bank/level-N*.json` (eller en ny fil i
  manifestet). Nya texter på nivå 1–3: `id` = `lr-g{nivå}-{slug}`; gamla
  `lr-n…`-id:n behålls (se Id-konvention ovan). Id:t är stabilt för alltid
  (seenTextIds bygger på det). Ingen kodändring.
- **Ny värld:** se avsnittet "Så skapar du en ny värld" nedan.
- **Ny frågekategori:** lägg till nyckeln i `CATEGORIES` + `CATEGORY_LABELS`
  (`config.js`). Statistiken behåller redan okända kategorier.
- **Ändrade nivågränser/belöning:** bara `config.js`.
- **Ny frågetyp (t.ex. inte flerval):** utöka Question med ett `type`-fält,
  validatorn per typ och `scoreAnswers` (progress.js). Läsvyn renderar per typ.

---

## 7. Så skapar du en ny värld (Rymden, Djungeln, Spökslottet …)

Kartrenderaren (`ui-map.js`) innehåller INGET världsspecifikt – en ny värld är
en config-fil + en scen-fil + en rad i registret. Mall: `worlds/oknen.js` +
`worlds/oknen-scen.js`.

1. **Config: `worlds/<id>.js`** – ren data enligt schemat i `worlds/index.js`:
   - `id` (stabilt för alltid – sparas i `studentData.lasresa.worldId`), `name`,
     `theme`, `steps` (normalt `DEFAULT_STEPS_PER_WORLD` = 20), `order` (nästa
     lediga tal), `unlockAfter` (id:t på världen före, t.ex. `"oknen"`).
   - `scene: { width: 1600, height: 1000, background, render: <scenFn> }`.
   - `palette: { stepDone, stepNext, stepLocked, path, pathEdge }` – färgerna
     kartvyn använder för generiska element (stegmarkörer).
   - `start: {x,y}` (där avataren står före steg 1) och `stepPositions` –
     EXAKT `steps` st handplacerade `{x,y}` längs en slingrande stig. Håll
     ~120 px mellanrum så klickytorna (r≈46) inte överlappar.
   - `decorations: [{type, x, y, s?}, …]` – ren data; typnamnen ägs av
     världens egen scen-fil. Egna extranycklar (t.ex. Skogens `vatten`,
     Öknens `oas`, `mal`) är tillåtna och läses bara av scen-filen.
2. **Scen: `worlds/<id>-scen.js`** – exportera `<id>Scen(world) → SVG-sträng`
   (scenens INRE markup i världspixlar; stegmarkörer/avatar ritas ovanpå av
   kartvyn). Rita i portalens platta stil (`art-style.js`: kontur `O`, mjuka
   former, glad palett) och använd `routePoints`/`smoothOpenPath` ur
   `worlds/stig.js` för stigen – gånganimationen följer EXAKT samma kurva.
   Håll filen under ~400 rader (dela annars upp den).
3. **Registret:** importera världen i `worlds/index.js` och lägg den i
   `WORLDS`. Klart – kartan, världsväljaren, upplåsningen, firandet och
   `normalizeProgress` hanterar den automatiskt.
4. **Verifiera:** `node --test test/lasresan-*.test.js` kör `validateWorld`
   på alla världar i registret; titta sedan i `preview-lasresan-karta.html`.

Visa ALDRIG nivån på kartan, och håll UI-texten minimal (spec §21).
