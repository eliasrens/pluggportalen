# Läsresan

Adaptiv läsförståelseträning (åk 3–6) som en egen huvudmodul i Pluggportalen.
Eleven går en resa med sin avatar (1 färdig text = 1 steg, 20 steg = en värld),
medan en **dold** nivå 1–7 avgör hur svår nästa text blir. Produktspec:
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
- Läsresan är **helt separat**: egen nivå `studentData.lasresa.level` (1–7),
  egna texter (`src/lasresan/content/`) och egen validator. Ingen befintlig fil i
  det systemet är ändrad.

---

## 2. Arkitektur (`src/lasresan/`)

Allt utom Firestore-bryggan är ren logik utan DOM och Firestore, och testas med
`node --test test/lasresan-*.test.js`.

| Fil | Ansvar |
| --- | --- |
| `config.js` | Alla justerbara tal: nivå 1–7, start 3, 70 %/50 %, streak 3/2, 3 coins/rätt, 20 steg, 5–9 frågor, ordantal per nivå |
| `level.js` | Dold nivå: `applyResult(state, {correct,total})`, `classifyResult`, `normalizeLevel`, `percent` |
| `journey.js` | Resan: `completeStep(progress, worlds)`, `normalizeProgress` |
| `picker.js` | Textval: `pickText(level, seenTextIds, bank, {lastTextId, rng})` |
| `stats.js` | Aggregering: `summarize`, `categoryBreakdown`, `aggregateAttempts`, `classRows`, `sortRows` |
| `rewards.js` | `coinsFor(correct)`, `award(correct)` → `data.addCoins` (lat import) |
| `progress.js` | Elevens tillstånd: `defaultLasresa`, `normalizeLasresa`, `withStartedText`, `buildAttempt`, `applyCompletion` (kärnan i completeText-transaktionen) |
| `worlds/` | `index.js` (register + schema + `validateWorld`), `skogen.js`, `oknen.js`, `layout.js` |
| `content/` | `loader.js` (fetch + fallback), `validate.js`, `dev-seed.js` |
| `ui-map.js`, `ui-reader.js` | **Stubbar** med kontrakt, byggs i #400 och #401 |
| `page-lasresan.js` | Route-skal: karta → text → completeText → karta |
| `../data-lasresan.js` | Firestore-brygga: `getLasresa`, `startText`, `completeText`, `listAttempts`, `getClassLasresa` |

**Bootgrafen:** inget under `src/lasresan/` och inte `data-lasresan.js`
importeras statiskt från `app.js`. Routen läggs till i #401 med dynamisk import:

```js
"/elev/lasresan": async () => (await import("./lasresan/page-lasresan.js")).pageLasresan(),
```

### Nivålogik (spec §10)
- `correct*100 >= 70*total` → **hög**: highStreak+1, lowStreak=0. Vid 3 → nivå +1 (tak 7).
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

---

## 3. Datamodell

Se även `docs/DATAMODELL.md`.

### `studentData/{id}.lasresa` (map)
```
{ level, highStreak, lowStreak,              // DOLD nivå 1–7 (visas aldrig för eleven)
  worldId, stepInWorld, completedWorlds[],   // resan (stepInWorld 0 = före steg 1)
  totalTexts, totalQuestions, totalCorrect, totalIncorrect,
  moneyEarned,                               // pluggcoins tjänade via Läsresan (statistik)
  seenTextIds[], catStats{kategori:{q,correct}},
  currentTextId, currentStartedAt, lastTextId,
  updatedAt }                                // ms sedan epoch
```
Saknas fältet räknas eleven som ny (Skogen, steg 0, nivå 3) via
`normalizeLasresa`. Ingen migrering behövs.

### `studentData/{id}/lasresaAttempts/{autoId}`
Ett dokument per färdig text:
```
{ textId, title, textType, textLevel, studentId,
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

### Statistik: `stats.js`
- Elevens "Min läsning": `summarize(lasresa)` (utan nivå).
- Lärarens tabell: `classRows([{studentId, namn, lasresa}])` + `sortRows(rows, key, dir)`.
- Elevdetalj: `summarize(lasresa, {includeLevel:true})`,
  `categoryBreakdown(lasresa.catStats)` och `aggregateAttempts(await listAttempts(id))`.

---

## 5. Innehåll

Kontraktet delas med innehållsepicet #404 och ändras inte ensidigt:
```
src/lasresan/content/bank/manifest.json: { "version": 1, "levels": { "1": ["level-1.json"], …, "7": ["level-7.json"] } }
level-N.json: ReadingText[]
ReadingText = { id, title, level (1-7), textType ("story"|"fact"), topic, body ("stycke\n\nstycke"), questions: Question[] (5-9) }
Question   = { id, question, options: [4 strängar], answerIndex (0-3), category ("fakta"|"ordforstaelse"|"mellan_raderna"|"helhet_slutsats") }
```
- `content/bank/` ägs av #404. Motorn skapar inga filer där.
- **Loadern** hämtar manifestet och sedan nivåfilerna lat per nivå (flera filer
  per nivå går bra). Varje text valideras, och texter med fel hoppas över med
  `console.warn`. Saknas en listad nivåfil (404) eller ger den inga giltiga
  texter används dev-seedens texter för just den nivån (om de finns, annars blir
  nivån tom och pickern tar närmaste nivå). Saknas hela banken (404/nätfel) eller
  kommer ingen enda text ur den används hela `dev-seed.js`: spec:ens fyra referenstexter (nivå 1/3/5/7),
  kompletterade till 5–6 frågor var.
- **Validatorn** ger **fel** för saknade fält, fel antal frågor/alternativ,
  answerIndex utanför 0–3, okänd kategori/textType, nivå utanför 1–7 och
  dubblett-id. Den ger **varningar** för ordantal utanför nivåns riktintervall,
  saknat topic, likadana alternativ och skev fördelning av rätt svars position
  (> 40 % på en bokstav, från 12 frågor per nivå).
- Känd varning: spec:ens egen nivå 7-referens är 259 ord (riktintervall
  280–500). Den citeras ordagrant och har därför lämnats orörd.

---

## 6. Så bygger du ut

- **Ny text:** lägg den i rätt `content/bank/level-N*.json` (eller en ny fil i
  manifestet). `id` = `lr-n{nivå}-{slug}`, stabilt för alltid (seenTextIds bygger
  på det). Ingen kodändring.
- **Ny värld:** skapa `worlds/<id>.js` enligt schemat i `worlds/index.js` (id,
  name, theme, steps, order, unlockAfter, scene, start, stepPositions[steps],
  decorations), lägg till den i `WORLDS` och rita scenen i kartvyn.
  `test/lasresan-journey.test.js` kör `validateWorld` på alla världar.
- **Ny frågekategori:** lägg till nyckeln i `CATEGORIES` + `CATEGORY_LABELS`
  (`config.js`). Statistiken behåller redan okända kategorier.
- **Ändrade nivågränser/belöning:** bara `config.js`.
- **Ny frågetyp (t.ex. inte flerval):** utöka Question med ett `type`-fält,
  validatorn per typ och `scoreAnswers` (progress.js). Läsvyn renderar per typ.
