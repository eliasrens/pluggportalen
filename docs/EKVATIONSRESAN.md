# Ekvationsresan

Adaptiv träningsmodul för ekvationer, åk 5–6. Epic #614 (Etapp 1). Spec:
`UTVECKLINGSUPPDRAG_EKVATIONSRESAN.md` (uppladdad till epicen).

Det här dokumentet beskriver **matematikkärnan** (#615). Spelvy, våg, hjälp,
stjärnor, anpassning, mynt, data och lärarvy byggs i följd-issues och lägger
till egna avsnitt här.

---

## 1. Analys: befintliga system (spec §1.3)

| System | Vad Ekvationsresan återanvänder |
| --- | --- |
| **Elev/klass/lärare** | Elever = `students/{id}` + `studentData/{id}`; klasser = `classes/{id}` med `studentIds`. Lärarsidan är master-detail per klass (#438) med flikar i klasskortets *Statistik*. Allt nytt laddas med `import()` utanför bootgrafen (#271). |
| **Modulval** `teacher-class-modules.js` | Registret `TOGGLABLE_MODULES` i `gamemode-visibility.js`. En ny modul med `optIn: true` (som Hitta rätt!, #605) är **av som standard** och slås på via `classes/{id}.enabledModules` – exakt spec E1.11. Sidomenyn och routern respekterar registret; ingen egen lösning behövs. `firestore.rules` kontrollerar bara att `enabledModules` är en lista (≤ 20), så ett nytt modul-id kräver ingen regeländring. |
| **Mynt** `lasresan/rewards.js` | `award()` importerar `data.js` **lat** och anropar `data.addCoins(amount)` (transaktion på `studentData.coins`). Testbar med injicerad `addCoins`. Ekvationsresan följer samma mönster – inget eget saldo. |
| **Försök/progression** `lasresaAttempts`, `docs/LASRESAN.md` | Tillstånd i `studentData/{id}.lasresa` (map), ett dokument per försök i `studentData/{id}/lasresaAttempts`, skrivna i **en** transaktion; mynt läggs på efteråt. Fallback i `studentData` om regeln inte är deployad. Ekvationsresan: `studentData.ekvationsresan` + `ekvationsresaAttempts`. |
| **Nivåstyrning** `teacher-lasresan-niva.js` | Ren logik (`lasresan/level-control.js`, `teacher-niva.js`) + brygga (`data-lasresan-niva.js`, lat) + vy. Enskild elev / hela klassen med bekräftelsedialog. Återanvänds som mönster (E1.12). |
| **Snabbt svarsfält** `mult/fast-answer.js` | Fält med ständigt fokus, ENTER skickar, `e.repeat` ignoreras, `pauseFocus/resumeFocus`. Talfältets *parser* finns här i `operand.js`; komponentmönstret används av spelvyn. |
| **Mattegeneratorn** `matte-generator/` | Seedbar mulberry32-PRNG, plugin-register bakom en smal sömm. Räknar med flyttal och har ingen ekvationsmodell – därför återanvänds bara PRNG-idén (egen kopia i `generator.js`, eftersom `prng.js` är privat bakom `matte-generator.js`). |
| **#231 (kvot)** | Läs aldrig ett dokument per elev i onödan. Läsresans tabell läser `studentData.lasresa` en gång per elev; försök läses först i elevdetaljen. Byn använder `classProjections/{classId}` (ett dokument per klass). Ekvationsresans lärarvy bör lägga en sammanfattning i elevdatan och läsa försök bara i elevdetaljen. |

---

## 2. Matematikkärnan (`src/ekvationsresan/`, #615)

Ren logik: ingen DOM, ingen Firebase. Testas med `node --test`
(`test/ekvationsresan-karna.test.js`, `test/ekvationsresan-generator.test.js`).

| Fil | Ansvar |
| --- | --- |
| `rational.js` | Exakta rationella tal `{ n, d }` (reducerade, d > 0). Svensk decimalkomma `formatSv` / `parseDecimalSv`. |
| `equation.js` | Ekvationsmodellen, löst-villkor, exakt lösning, nyckel, textparser. |
| `config.js` | Nivå 1–6, spärrar per nivå, elevtexter. Allt som ska finjusteras. |
| `operand.js` | Talfältets parser: `-4`, `+5`, `/2`, `:2`, `*3`, vald knapp. |
| `operations.js` | + − · ÷ på båda leden, förenkling, spärrar. |
| `notation.js` | MIN LÖSNING som strukturerade rader/segment. |
| `solver.js` | BFS: optimalt antal drag, väg för "Visa lösningen", dragets effekt. |
| `losning.js` | Tillståndet för en uppgift (`startRun`/`playMove`) + `replayRows` för lärarvyn. |
| `forms.js` | Uppgiftsformer (`x+a=b`, `ax-b=c`, `x/a+b=c` …). |
| `generator.js` | `generateTask`, `similarTask`, uppgiftstyp A/B, vågens visning. |

### Tekniska val

- **Exakt aritmetik.** Täljare/nämnare är JS-heltal med vakt: varje
  mellanresultat måste vara `Number.isSafeInteger`, annars kastas `RangeError`
  – ett resultat kan aldrig bli tyst inexakt. Spärren "tal över 1 000" håller
  talen långt under gränsen, så BigInt behövdes inte (BFS:en blir snabbare).
  Decimaler (Etapp 2) är rationella tal (2,5 = 5/2) och visas med decimalkomma.
- **Modell.** `Ekvation = { left: Term[], right: Term[] }`, `Term = { n, d, x }`
  där `x` är 0 (tal) eller 1 (x-term). Plant och JSON-vänligt – sparas direkt i
  Firestore. x i båda leden, decimaler och bråk ryms redan.
- **Spärrar** (`config.BASE_RULES`, överskrivbara per nivå): `div0`, `mul0`,
  `fraction`, `negative`, `tooBig`, plus `xProduct` för Etapp 2-fältet. Ett
  spärrat drag ändrar inget och räknas inte.
  - *Bråk:* en term som inte är ett heltal. **x/a räknas inte som bråk** – det
    är "x delat med a" (nivå 2: `x/4 = 6`). `x/4 = 6`, ·3 → `3x/4` spärras.
  - *Minustal:* ett led som börjar med minus (−6, −2x + …) eller vars värde vid
    lösningen är negativt. `x − 3` är subtraktion och tillåtet; 0 är tillåtet.
- **Talfältet** tar emot 0–999 (0 så att ÷0/·0 kan förklaras). `2x` och `2,5`
  tolkas redan men stängs av med `rules.operandX` / `rules.operandDecimal`.
- **Skrivsätt (E1.3).** Rad = `{ kind, segments, text }`, kind ∈ start, op,
  mid, simplified, final. Elevens operation är segment med `mark: "op"` (rött)
  – även i mellanledet. Parentes vid ÷/· av led med flera termer; mellanled
  (`rules.distributionStep`) på nivå 1–6. Minus är U+2212, gånger `·`,
  delat `÷`.
- **x/a-valet:** x delat med ett tal *i uppgiften* skrivs alltid med
  **bråkstreck** (segmentet har `num: "x"`, `den: "4"`; text `x/4`). Elevens
  division skrivs alltid med **÷**. Bråkstreck = en term, ÷ = en operation.
  Exempel: `(x/3 + 2) · 3 = 6 · 3` → `x/3 · 3 + 2 · 3 = 18` → `x + 6 = 18`.
- **Löst** = x ensamt med koefficienten 1 på ena sidan och ett tal på den
  andra. `5 = x` ger en sista rad `x = 5` (kind `final`, inget drag).
- **Optimalt antal drag.** BFS med operander ur talen i det *aktuella*
  tillståndet (konstanter, x-koefficienter, x/a-nämnare), djup ≤ 6, samma
  spärrar som eleven. Sökordning − + ÷ · (små tal först) ger den naturliga
  vägen för "Visa lösningen" (`2x + 4 = 14` → −4, ÷2). `moveEffect` säger om
  ett giltigt drag förde närmare ("closer"), inte ändrade ("same") eller
  krånglade till ("further") – för feedbacken i E1.7; inget drag kallas fel.
- **Generatorn.** En form väljer x först och räknar fram talen, så lösningen
  är alltid ett positivt heltal; `solve()` kontrollerar den exakt. Nivån väljer
  former med vikter (`config.LEVELS`). Uppgiften sparar `equation` (strukturerad),
  `solution`, `optimalMoves`, `optimalPath`, `type` (A/B, andel B ökar 10 % →
  80 %) och `display` (föremål/block/stiliserad, E1.5). Ingen dubblett i följd
  (`previous`). `similarTask` = samma nivå och form, x på samma sida, ny
  ekvation **och** ny lösning. Nivå 6 lägger x i högerledet i 15 % av
  uppgifterna (`14 = 2x + 4`), vilket ger `5 = x`-slutet.

### Förberett för Etapp 2

- Nivå 7–12: nya rader i `config.LEVELS` (med egna `rules`, t.ex.
  `allowNegative` från nivå 9, `allowDecimals` från nivå 10, `operandX` från
  nivå 7) och nya former i `forms.js` (t.ex. `ax+b=cx+d`).
- Uppgiftstyper C–F: nya poster i `generator.TASK_TYPES`.
- `term.x` är en exponent (0/1); x · x spärras (`xProduct`) så modellen aldrig
  hamnar utanför linjära ekvationer.
- `rules.maxDecimals` styr decimalspärren; `formatSv` visar decimalkomma.

---

## 3. Hjälp, stjärnor, anpassning och mynt (#616)

Ren logik i `src/ekvationsresan/`, tester i `test/ekvationsresan-hjalp.test.js`
(spec E1.14 test 12–22). Alla trösklar, poäng, myntnivåer och texter ligger i
`config.js` (`HELP`, `STARS`, `STAR_POINTS10`, `ADAPT`, `COINS`, `FEEDBACK`).

| Fil | Ansvar |
| --- | --- |
| `hjalp.js` | `helpSteps(eq)` – fyra steg ur **aktuell** ekvation (första draget på kortaste vägen därifrån). `startHelp`/`nextHelp` – ett steg per tryck, steg 1 igen efter ett drag, `maxStep` + `log` för stjärnor/statistik. `revealSolution(run)` – resten av lösningen som rader + `steps` för vågen, `run.revealed = true`. `shouldOfferHelp(run, optimal)` – efter optimalt + 6 drag. |
| `resultat.js` | `starsFor`, `taskResult(task, run, help)` → `{ solved, stars, points10, coins, feedback, offerRetry, … }`, `moveFeedback(moveEffect(...))`. |
| `anpassning.js` | `{ level, window }`, `recordResult(state, stars)` → `change` up/down/null (ner = inget meddelande i UI), `setLevel` (lärare, nollställer), `progressValue` 0–1. |
| `mynt.js` | `coinsFor(level, { solved })`, `award(coins, { addCoins })` – lat `data.addCoins`, som Läsresan. |

- **Hjälpsteg:** 1 fråga, 2 vardagligt + `scale` (`remove`/`add` amount,
  `groups`/`copies` count) till vågen, 3 operation + `row` (förslagsraden),
  4 "nästan svaret" (`4x ÷ 4 blir x. Vad blir 20 ÷ 4?`). Ger aldrig svaret.
- **Stjärnor:** minsta av dragstjärnor (≤ opt 3, ≤ opt + 2 2, annars 1) och
  hjälpgränsen (steg 0–1: 3, 2–3: 2, 4: 1). Visa lösningen = 0, ej löst.
- **Fönstret** sparar *stjärnor* (0–3, heltal); poängen räknas i tiondelar
  (10/6/2/0) så att 4,2 ≥ 4,0 och 1,2 ≤ 1,2 blir exakta.
- **Mätaren** = största andelen av de tre uppvägarna (streak/4, summa5/4,0,
  summa10/7,0); 1 på högsta nivån.
- **Mynt** för varje löst uppgift oavsett stjärnor; ingen stjärnbonus.

---

## 4. Den grafiska vågen (`src/ekvationsresan/vag*.js`, #617, E1.5)

Kodritad SVG i Pluggportens stil (`art-style.js`: kontur `#3B3350`, portalens
palett). Laddas bara dynamiskt; `vag.css` hämtas av komponenten
(`ensureVagCss`), inte via `styles.css` – bootgrafen påverkas inte (#271).
Förhandsvisning: `preview/preview-ekvationsresan-vag.html` (test 9–11 som
knappar, alla teman och visningar i ett galleri). Tester:
`test/ekvationsresan-vag.test.js`.

| Fil | Ansvar |
| --- | --- |
| `vag-visning.js` | Valet av visning (`viewForEquation`, `chooseView`, `taskView`, `viewDuring`), teman (`THEMES`, `themeFor`). Ren logik. |
| `vag-scen.js` | VAD som ligger i skålarna: bitar med stabila nycklar, fyra faser per drag (`movePhases`), hjälpens bild (`helpScene`). Ren logik. |
| `vag-layout.js` | VAR bitarna ligger (föremål i rader om fem, block i rader, grupper i kolumner). Ren logik. |
| `vag-konst.js` | SVG: ställning, bom, skålar, fem behållare + föremål, x-block, talbrickor, etiketter, grupper. Bara strängar. |
| `vag.js` | Komponenten (DOM + Web Animations). |

### Visning (tabellen i E1.5)

- **Föremål:** alla tal under lösningen är heltal ≤ 20 (`x − 3` = "tre
  föremål saknas", ritas som streckade hål), x högst 5 gånger, x i ett led,
  lösningen och ledens värden positiva.
- **Block:** tal upp till 100 – x-block (≤ 12 st, annars ett block "15x"),
  bråkblock `x/4` och talbrickor med siffror.
- **Stiliserad:** större tal – ledens uttryck som etiketter i skålarna.
- "Under lösningen" = startekvationen **och** varje tillstånd längs den
  optimala vägen (`x/4 = 6` slutar i `x = 24` → block). Generatorns
  `task.display` räknas nu så (`scaleMode(eq)` finns kvar för ett tillstånd).
- Under spelet: aldrig mindre abstrakt än uppgiftens visning; ett tillstånd som
  kräver mer (eleven gör +30) lyfter visningen tills talen är små igen. Byte =
  lugn övertoning (0,4 s). Gränserna i `VIEW_LIMITS`.

### Animationer (0,9 s, aldrig blockerande)

Varje drag är fyra faser – före, mitt, håll, efter – och varje bit animeras
mellan dem via sin nyckel (transform/opacity, kompositerbart). Båda skålarna
gungar likadant, så vågen är i balans hela tiden.

- **−a:** a föremål lyfts (röd glöd) och flyger bort från båda sidor; finns för
  få blir resten hål. Block: en skuldbricka "−13" landar på talbrickan.
- **+a:** a föremål släpps ner; hål fylls först.
- **÷a:** innehållet delas i a lika grupper med ramar, grupp 0 stannar och
  resten tonas bort. Block: talbrickan delas i a brickor.
- **·a:** a − 1 kopior poppar fram i grupper och blir det nya innehållet.
- Ett nytt `visa()` under en animation hoppar direkt till slutet.
- **Reducerad rörelse** (`prefers-reduced-motion` eller `reducedMotion: true`):
  inga animationer, vågen byter direkt.

### API

```js
const { createVag } = await import("./ekvationsresan/vag.js");
const vag = createVag(host, { task, showEquation: true, diskret: task.type === "B" });
vag.visa(run.current, { move: run.moves.at(-1) }); // efter playMove
vag.visaHjalp(hint.scale);   // hjalp.js steg 2: {action:"groups",count} m.fl. → boolean
vag.doljHjalp();
vag.spelaLosning(revealSolution(run).steps); // "Visa lösningen"
vag.setTask(nextTask);       // nytt tema och ny grundvisning, lugn övertoning
```

Vågen visas alltid med ekvationen (rubrik med bråkstreck för `x/4`);
`showEquation: false` om spelvyn ritar ekvationen själv. `diskret` = typ B.

### Etapp 2: x i båda leden, minustal och decimaler (#624, E2.2)

Valet av visning är utökat utan att Etapp 1 ändras (nivå 1–6: samma visning,
scener och positioner för 2 400 genererade uppgifter före/efter).

- **x i båda leden → block.** `−x` lyfter bort ett x-block från BÅDA sidor
  (som `−3` lyfter föremål), `+x` släpper ner x-block. Badgen visar `− x`.
- **Minustal = skuld (valet).** Föremål visas aldrig för minustal – man kan inte
  ha −3 äpplen. I blockvisningen är ett minustal en *skuld*: streckad, röd,
  ljusrosa – samma språk som hålen i `x − 3` (Etapp 1). Konstanter blir en
  skuldbricka `−12`, x-termer skuld-x-block `−x` (ett per x, högst 12, annars ett
  streckat etikettblock `−15x`). `3x + 17 = 5x + 5`, `−5x`: tre x-block lyfts,
  två skuld-x-block poppar fram (`−2x + 17 = 5`). `+2x` därefter: x-blocken
  landar på skuld-x-blocken och båda försvinner – de tar ut varandra. I den
  stiliserade vågen är minustal bara symboliska (etiketterna). Varför skuld och
  inte bara symboler: eleven ser fortfarande vågen i balans och att −x "saknar"
  ett x, vilket bär över till `+2x` som det naturliga nästa draget.
- **Decimaler → stiliserad våg med etiketter.** Allt som skrivs med
  decimalkomma under lösningen (`2,5x`, `x + 0,5`, lösningen `x = 2,5`) ger
  `stiliserad`; brickor med decimaler blir svåra att "se" som mängder. `x/4`
  (täljaren 1) är fortfarande ett bråkblock.
- **Hjälpens bild** tar också `scale.operand` (`{ n, d, x }`, #623): `−x`
  markerar ett x-block på båda sidor, `÷2,5` visar badgen över etiketterna
  (`scaleOperand` i `vag-scen.js`).
- Förhandsvisningen har knapparna *3x + 4 = x + 12: −x*, *3x + 17 = 5x + 5:
  −5x, +2x, −5, ÷2* och *2,5x + 4 = 19: −4, ÷2,5*. Tester:
  `test/ekvationsresan-vag-etapp2.test.js`.

---

## 5. Spelvyn, data och mynt (`#618`, E1.1, E1.2, E1.4, E1.9–E1.11, E1.13)

Route `#/elev/ekvationsresan` (dynamisk `import()` i `app.js` – bootgrafen är
oförändrad, 107 filer; testet i `test/ekvationsresan-spelvy.test.js` vaktar
det). Eleven landar direkt i nästa uppgift på sin nivå – ingen karta, ingen
lobby. Tester: `test/ekvationsresan-spelvy.test.js`,
`test/firestore-rules-ekvationsresan.test.js`.

| Fil | Ansvar |
| --- | --- |
| `page-ekvationsresan.js` | Route-skal: laddar stilar, hämtar/skapar den pågående uppgiften, monterar spelvyn med datalagret injicerat. |
| `spelvy.js` + `spelvy-html.js` | Spelvyn (vänster ~64 %: nivå + mätare, ekvation + våg, operationer, talfält, GÖR, 💡/Visa lösningen; höger ~36 %: MIN LÖSNING), resultat med stjärnor, "FÖRSÖK IGEN FÖR ⭐⭐⭐", nivå upp-skärm, nivåöversikt. |
| `min-losning.js` | `rowsHtml(rows)` – notation.js-raderna som mattehäfte, elevens operationer i rött, x/4 med bråkstreck. Lärarvyn (#619) ritar `replayRows(attempt.equation, attempt.moves)` med samma funktion. |
| `talfalt.js` | Talfältet med ständigt fokus (fast-answer-mönstret): ENTER skickar, `e.repeat` ignoreras, fokus tas tillbaka. Knapparna + − · ÷ skriver bara tecknet först i fältet, så mus och tangentbord går genom samma text. |
| `framsteg.js` | Ren logik: progressdokumentet, försöket, `applyCompletion`, `teacherSetLevel`, `levelOverview`, `teacherSummary`/`trendOf` för lärarens klassöversikt. |
| `ekv-data.js` | Firestore-bryggan: `enterEkvationsresan`, `startTask`, `completeTask`, `listAttempts`, `setStudentLevel`. |
| `ekvationsresan.css` | Layouten (ingen vertikal scroll i 1366×768, smal skärm = MIN LÖSNING under). |

### Spelflödet

- ENTER → `playMove`: oläsbart → vänlig rad; **spärr** → förklaringen
  (config `BLOCK_MESSAGES`), räknas inte som drag (men `blocked` räknas för
  statistiken); giltigt → vågen animeras, raderna läggs i häftet, ev. kort
  feedback (`moveFeedback`). Efter optimalt + 6 drag erbjuds hjälp/lösning.
- 💡 → `nextHelp`: steg 2 visar bilden på vågen, steg 3 förslagsraden.
- Visa lösningen kräver två klick ("Säker? Då räknas uppgiften som ej löst.").
  Vågen och häftet spelar lösningen steg för steg; ej löst, inga mynt.
- Resultat → `NÄSTA UPPGIFT →` (ENTER, knappen har fokus). Nivå upp visar
  först den glada skärmen (`config.LEVEL_UP`); nivå ner visar ingenting.
  "Försök igen" ger `similarTask` och sparas som ny pågående uppgift. Vid en
  nivåändring visas inte "Försök igen" (nästa uppgift hör till nya nivån).

### Data (E1.13)

`studentData/{id}/ekvationsresa/progress` – ett dokument per elev:

| Fält | Beskrivning |
| --- | --- |
| `schema` | 1 |
| `level`, `window`, `maxLevel` | Nivå 1–6 (1–12 tillåtet i reglerna), fönstret (stjärnor 0–3, ≤ 10) för anpassning.js, högsta nivå |
| `tasks`, `solved`, `revealed` | Antal uppgifter, lösta, "Visa lösningen" |
| `stars` | `[0★, 1★, 2★, 3★]` – fördelningen |
| `helpTasks` | Uppgifter där 💡 användes |
| `movesSolved`, `optimalSolved` | Drag och optimala drag i lösta uppgifter (lärarens "drag jämfört med optimalt") |
| `coins` | Mynt intjänade i Ekvationsresan (saldot är `studentData.coins`) |
| `recent` | `[{ l, s }]` senaste 10 (nivå, stjärnor) – lärarens trend ↗/→/↘ |
| `current` | `{ id, at, task }` – den pågående uppgiften; en omladdning ger samma ekvation |
| `skills` | `{}` – Etapp 2 (färdighetsmodellen) |
| `levelChangedAt`, `updatedAt` | ms |

`studentData/{id}/ekvationsresaAttempts/{taskId}` – ett försök per uppgift:
`schema, taskId, level, type, form, equation` (strukturerad), `solution,
optimalMoves, moves` (`[{op,n,d,x}]` i ordning – vid "Visa lösningen" hela den
visade räknegången), `moveCount` (elevens egna drag), `blocked, stars, solved,
revealed, helpMax, helpPresses, coins, startedAt, completedAt, skills` (null,
Etapp 2).

Lärarsammanfattningen räknas ur progressdokumentet (`teacherSummary`) – ett
dokument per elev när läraren öppnar vyn, försöken läses först i elevdetaljen
(#231-lärdomen, som Läsresan).

### Mynt med säker idempotens (E1.10)

`completeTask` skriver försöket och progress i **en** transaktion. Försökets
dokument-id är uppgiftens id (`current.id`); finns det redan (dubbelklick,
omsändning, två flikar) skrivs inget och inga mynt delas ut, och reglerna
tillåter bara `create` av ett försök. Mynten läggs sedan på det vanliga saldot
via `data.addCoins` (`mynt.award`, Läsresans mönster). Går nätet ner precis
mellan transaktionen och `addCoins` uteblir mynten för den uppgiften – men de
kan aldrig delas ut två gånger. Transaktionen sparar också nästa uppgift som
`current`, så normalflödet kostar en skrivning per uppgift (+ myntet).

### Klassynlighet (E1.11)

`TOGGLABLE_MODULES` har posten `ekvationsresan` med `optIn: true` (som Hitta
rätt!): av för nya klasser, påslagen via `classes/{id}.enabledModules` i det
befintliga "Synliga moduler"-valet (`teacher-class-modules.js`). Avstängd →
ingen menylänk och direktlänken stoppas av routerns grind.

### Regler

`ekvationsresa/{docId}`: läs eleven själv + lärare; skriv eleven själv +
lärare bara `progress` med giltig form (`ekvProgressOk`); radera lärare.
`ekvationsresaAttempts/{taskId}`: läs eleven själv + lärare; `create` bara
eleven själv, id `^[A-Za-z0-9_-]{8,64}$` = `taskId`, giltig form
(`ekvAttemptOk`); ingen update; radera lärare.
⚠️ Kräver `firebase deploy --only firestore:rules`. Ingen fallback i
`studentData` (som Läsresan har) – modulen är av som standard tills läraren
slår på den.

### Preview / QA

`bash admin/qa-ekvationsresan-preview.sh` (emulator 8618/9618, proxy 8619):
`elev1 / lilla123` har modulen PÅ, `ekv-av / lilla123` AV.
`node admin/qa-ekvationsresan-seed.mjs --niva 3` startar elev1 på en nivå,
`--av` slår av modulen för elev1:s klass.

## 6. Lärarvyn (`#619`, E1.12)

Underfliken **Ekvationsresan** i klasskortets Statistik (`teacher-class.js`
`STATS_TABS`, dynamisk `import()` – bootgrafen orörd). Samma upplägg och mörka
stil som Läsresan (lrt-/lrn-/cx-klasserna) + egna `ekt-`-stilar i
`ekvationsresan/larare.css` (laddas dynamiskt). Test:
`test/ekvationsresan-larare.test.js`, regler i
`test/firestore-rules-ekvationsresan.test.js`.

| Fil | Ansvar |
| --- | --- |
| `ekvationsresan/larare.js` | Ren logik: `klassRader` (ur `teacherSummary`), sortering (namn/nivå/uppgifter), `forsokRader`, `nivaKurva`, `rakneGang` (replayRows; vid "Visa lösningen" skiljs elevens rader från de visade), texter för nivåstyrningen. |
| `teacher-ekvationsresan.js` | Klassöversikten (Elev, Nivå, Trend ↗→↘, Uppgifter, ⭐⭐⭐/⭐⭐/⭐, Lösta %, Hjälp %, Drag jämfört med optimalt) + kortet "Ändra nivå för hela klassen" (bekräftelsedialogen från Läsresan). Varnar om modulen är avstängd för klassen. |
| `teacher-ekvationsresan-elev.js` | Elevdetaljen: nyckeltal, "Ändra nivå", nivåkurva, de senaste 20 uppgifterna; klick på en uppgift visar elevens räknegång som MIN LÖSNING (`min-losning.rowsHtml`). |
| `ekv-data.js` | `getClassEkvationsresa(ids)` (ett progressdokument per elev), `setClassLevel(ids, nivå)`, `setStudentLevel` (befintligt dokument: `update` av bara nivåfälten). |

- **Kvot (#231):** översikten läser ett progressdokument per elev, en gång
  (Läsresans mönster); försöken läses bara för EN elev i detaljen.
- **Hjälp %** = uppgifter där 💡 användes. "Visa lösningen" syns som ej löst.
- **Drag** = extra drag per löst uppgift jämfört med optimalt (+0,5 / ±0).
- **Ej börjat** = inga uppgifter än (även om läraren satt en nivå).
- **Nivåstyrning:** ny nivå, tomt fönster, `current: null` (ny uppgift på
  nivån vid nästa besök). Statistik och mynt rörs inte.
- **Regler:** läraren får bara ändra `level, window, maxLevel, current,
  levelChangedAt, updatedAt` (`TEACHER_LEVEL_FIELDS` = `ekvTeacherLevelOk`),
  och fönstret måste vara tomt; ett nytt dokument från läraren får inte ha
  statistik. ⚠️ Kräver `firebase deploy --only firestore:rules`.
- **Preview:** `admin/qa-ekvationsresan-preview.sh` seedar nu även
  (`--larare`) qa-hog ↗, qa-mitt, qa-lag ↘, qa-svag med riktiga försök;
  `qalarare / lilla123` → QA-klass 4A → Statistik → Ekvationsresan.

---

## 7. Etapp 2 – kärna och generator nivå 7–12 (`#623`, E2.1, E2.2)

Ren logik, tester i `test/ekvationsresan-etapp2.test.js` (1 000 uppgifter per
nivå, −x/−2x, minustal, decimaler, mynt, anpassning). Etapp 1-sviterna gäller
nivå 1–6 som förut; de assertions som hårdkodade "högsta nivån = 6" läser nu
`LEVEL_MAX` (12).

| Nivå | Namn | Former (forms.js) | Spärrar utöver Etapp 1 |
| --- | --- | --- | --- |
| 7 | x i båda leden | `ax=cx+d`, `ax+b=cx+d` | x-termer i talfältet |
| 8 | Fler steg | `ax+b=cx+d`, `ax-b=cx+d`, `ax+b=cx-d` | x-termer |
| 9 | Minustal på vägen | `ax+b=cx+d` (x-sidan bytt i 50 %), `b-ax=c`, `b-ax=cx+d`, `ax-b=cx-d` | + negativa mellanled |
| 10 | Decimaler | `dx=c`, `dx+b=c`, `ax+b=c:xdec` (x = 2,5), `dx+b=ex+f` | + högst två decimaler (operander och resultat) |
| 11 | Svåra blandade | blandning av 8–10 + `x/a+b=c`, större tal | som 10 |
| 12 | Problemlösning | `ax+b=c`, `ax-b=c`, `ax=cx+d`, `ax+b=cx+d`, `dx+b=c` | som 10 |

- **Spärrar per nivå** (`config.LEVELS[].rules`): `operandX` från 7,
  `allowNegative` från 9, `allowDecimals` + `operandDecimal` från 10
  (`maxDecimals: 2`). Bråk aldrig i huvudprogressionen – `config.EXTRA_RULES`
  (bråk på) finns för extrautmaningarna (E2.6). Mellanledet vid fördelning
  visas bara på nivå 1–6 (E1.3), så `distributionStep: false` från 7.
- **Lösningen** är alltid positiv; heltal på nivå 7–9, från nivå 10 även
  decimaltal med högst två decimaler (`2x + 3 = 8` → `x = 2,5`).
- **Talfältet** (`operand.js`): `x`, `2x`, `−2x`, `+1,5x` från 7; `2,5` /
  `0.25` från 10. Fler än två decimaler → `decimalMax`. `÷x`/`·x` spärras
  alltid (`xProduct`).
- **Vägsteg.** Heltal sparas som förut, `{ op, value }`; x-termer och decimaler
  som `{ op, n, d, x }` (samma form som elevens sparade drag).
  `operations.moveStep` / `moveOperand` / `applyStep` översätter; vågen,
  hjälpen och `replayRows` tar båda formerna.
- **BFS** söker även x-termsoperander (talfältets x-termer ur tillståndet) och
  decimaltalen själva (÷2,5). x-termer prövas först, så `3x + 4 = x + 12` ger
  `−x, −4, ÷2`. x/a är "x delat med a", inte 0,25 – vägen blir `·4`, aldrig
  `÷0,25`. Där minustal är tillåtna väljs bland lika korta vägar en utan
  minustal (`2x − 4 = 4x − 18` → `+18, −2x, ÷2`), så hjälpen och "Visa
  lösningen" aldrig styr in i minustal i onödan. Antalet drag är detsamma.
- **Formernas optimum** (`moves`) jämförs med BFS för varje genererad uppgift,
  och ett testfall prövar med ett brett operandutbud (heltal 1–999, 1x–12x,
  decimaler) att ingen kortare väg finns.
- **Skrivsätt:** `3x + 4 − x = x + 12 − x`, `−2x + 17 = 5`, `−x = −6`,
  `0 = x − 6`, `2,5x ÷ 2,5 = 15 ÷ 2,5`. Decimaler räknas exakt (`x + 0,1 =
  0,4` → `x = 0,3`).
- **Försök igen:** uppgiften har `swapped` (x-sidan bytt), eftersom x i båda
  leden inte avslöjar sidan; äldre uppgifter utan fältet härleds som förut.
  Lösningen jämförs exakt: x = 2,5 (5/2) och x = 5 är olika trots samma täljare.
- **Hjälpen** visar x-termer och decimaler som i räknegången ("Subtrahera x
  från båda leden", "Dividera båda leden med 2,5"). Vågens bild (`scale`) får
  då `operand: { n, d, x }` i stället för `amount`/`count`, och vågen hoppar
  över bilden (den ritar bara heltal) – en uppgift för vågen i Etapp 2
  (gjord i #624, se avsnitt 4).
- **Mynt** 7–8: 4, 9–10: 5, 11–12: 6 (`config.COINS`, fanns redan).
  Anpassningen går upp till `LEVEL_MAX` = 12; regler tillåter redan nivå 1–12
  och mynt ≤ 7, så ingen regeländring.
- **Nivå 12** har bara ekvationerna; texten (verklighet → ekvation → svar)
  läggs på av problemlösningstypen.

---

## 8. Etapp 2 – uppgiftstyperna C–F (`#625`, E2.3)

Nivån styr matematiken, typen styr formen. Typen dras först (andelar per
nivå i `config.LEVELS[].types`, resten A/B som förut), väljer bland nivåns
former de typen klarar och lägger på sin data på uppgiften. Tester:
`test/ekvationsresan-typer.test.js`. Preview: `node admin/qa-ekvationsresan-seed.mjs
--typ C|D|E|F [--niva N]` ger elev1 en pågående uppgift av typen.

| Typ | Vad eleven gör | Data på uppgiften |
| --- | --- | --- |
| **C Nästa rad** | Operationsraden står i häftet; eleven skriver (nivå 4+) eller väljer bland tre (nivå 1–3) nästa förenklade rad. Vågen animerar draget efter varje rätt rad. Felalternativen är vanliga missuppfattningar (bara ena ledet, olika operation, halv delning) före räknefel. | `nastaRad: { mode, steg: [{ val: [ekvation ×3] }] }` |
| **D Bild → ekvation** | Vågen (utan ekvationsrubrik) + texten "Två spargrisar och 3 mynt är lika mycket som 13 mynt." → eleven skriver `2x + 3 = 13`. Bara former med plus och heltal, föremål eller block. | `bild: { text, x }` (vågens tema ger orden) |
| **E Hitta felet** | Häftet blir "ALVAS LÖSNING"; en påhittad elev gör ETT fel (bara ena ledet, olika operation, räknefel, delade bara x-termen) och räknar sedan rätt vidare till fel x. Eleven klickar på raden där felet börjar. Från nivå 3 (minst två drag). | `fel: { namn, kind, rad, ratt, steg }` (`hitta-felet.js`) |
| **F Problemlösning** | Text (+ vågens bild när den visar föremål) → eleven skriver ekvationen → **vanliga lösningsvyn** → "Vad betyder x i uppgiften?" (tre meningar med samma tal, en sann) → svaret skrivs i häftet. Från nivå 3 som en mindre andel (12–14 %), 50 % på nivå 12. | `problem: { mall, text, fraga, bild, val, ratt, svar }` (`problem.js`, mallar per form) |

### Rättning (`typ-svar.js`)

- Ekvationer jämförs **led för led, förenklade** (`x + x + 3` = `2x + 3`);
  ur bild/text får leden byta plats (`13 = 2x + 3`). `3·x`, `3*x`, `−` och
  decimalkomma tolkas.
- Ett fel ger en **riktad ledtråd**, aldrig svaret: "Vänster led stämmer. Räkna
  höger led igen: 89 − 12 = ?", "Ena sidan stämmer. Titta igen på den andra
  sidan av vågen.", "Den raden stämmer med raden ovanför. Leta vidare!".
- Räknas **inte** som fel: oläsbart/utan x, en sann ekvation i annan form
  (`2x = 10` i stället för `2x + 3 = 13` – "skriv den direkt ur uppgiften"),
  och i E en rad som blev fel som *följd* av felet ("felet började tidigare").
- Svaret **visas** efter tre fel på en skrivfråga, eller när bara ett
  alternativ återstår i en valfråga (eleven får läsa och trycka FORTSÄTT).

### Kompletterande stjärnregler (förslag, `config.TYPE_STARS`)

| Resultat | Villkor (C, D, E och frågorna i F) |
| --- | --- |
| ⭐⭐⭐ | Alla svar rätt direkt |
| ⭐⭐ | Ett fel svar i hela uppgiften |
| ⭐ | Två eller fler fel, **eller** ett delsvar fick visas (motsvarar hjälpsteg 4) |
| Ej löst | Alla svar fick visas – eleven gjorde inget själv (motsvarar "Visa lösningen") |

- **F** = det lägsta av frågestjärnorna och lösningsdelens stjärnor enligt
  E1.7 (drag mot optimalt, hjälpgränsen). "Visa lösningen" i lösningsdelen =
  ej löst, och frågan om x hoppas över.
- Poäng (anpassningen), mynt (löst = minst ⭐, oavsett stjärnor) och "Försök
  igen för ⭐⭐⭐" (samma typ, ny liknande uppgift) fungerar som i Etapp 1.

### Data

- Försöket (`ekvationsresaAttempts`) har `type` (fanns) och för C–F även
  **`answers`**: `[{ k: frågetyp, a: svaret som text | null, ok, visad?, annan?, senare? }]`
  (≤ 40). A/B-försök saknar fältet. C sparar räknegången eleven fyllde i som
  `moves` (`moveCount` 0); D/E har inga drag. ⚠️ Regeln `ekvAttemptOk` tillåter
  nu `answers` – **kräver `firebase deploy --only firestore:rules`** innan
  C–F-försök kan sparas live (A/B påverkas inte).
- Progress: lärarens "drag jämfört med optimalt" räknar bara typer med en
  lösningsdel (A, B, F). Lärarens försökslista visar typen, "–" för drag i C–E
  och elevens svar (✓/✗/👁) i elevdetaljen. Färdighetsmodell och utbyggd
  lärarvy: avsnitt 9 (#626).

---

## 9. Etapp 2 – färdighetsmodellen och lärarvyn (`#626`, E2.4, E2.5)

Ren logik, tester i `test/ekvationsresan-fardigheter.test.js`. Modellen är
**intern** – eleven ser den aldrig. Trösklar och andelar i `config.FARDIGHET`,
färdigheterna i `config.SKILLS`.

| Fil | Ansvar |
| --- | --- |
| `fardigheter.js` | `observera(task, attempt)` → observationer `{ färdighet: { s: 0–100, h: 0/1 } }`; `uppdatera(skills, obs)` (glidande medelvärde: 1/n i början, sedan minst 25 %); `modellUrForsok(attempts)`; `stark/svag/hjalpOfta/sjalvstandig`; `ekvationsslag(task)` ur den optimala vägen. |
| `nasta-uppgift.js` | `nastaUppgift(progress)` – nästa uppgift på anpassningens nivå med modellens andelar (`generateTask` `mix`). `fokusFor`, `blandning`. |
| `sammanfattning.js` | Lärarens meningar (`sammanfattningar`), "I korthet", behärskar/svårt för (`slagLagen`), problemlösning, indikatorer (`fardighetsbild`). |
| `admin/qa-ekvationsresan-spela.mjs` | Spelar en uppgift med spelets logik enligt en plan → försök. Delas av testerna och seeden. |

### Färdigheterna och vad som mäter dem

| Färdighet | Observeras ur |
| --- | --- |
| Ekvationsslag: `ettSteg`, `tvaSteg`, `bada` (x i båda leden), `addSub` (+/− i vägen), `multDiv` (·/÷ – x med koefficient) | Lösningsdelen i A, B och F: löst själv 100, med hjälp enligt hjälpgränsen (E1.7), Visa lösningen 0. **Omvägar räknas inte här.** |
| `operation` (välja rätt operation) | Lösta A/B/F: drag mot optimalt (⭐-trappan), spärrade drag ger högst 60. Visa lösningen ger ingen observation. |
| `balans` | A (vågen i fokus) och E med felet "bara ena ledet"/"olika operation". |
| `forenkling` | C (nästa rad) och E med räknefel/"delade bara x-termen". |
| `skrivsatt` | D (bild → ekvation) och C när eleven skriver raden själv (nivå 4+). |
| `text` | F: första frågan (skriv ekvationen ur texten). |
| `problem` | F: hela kedjan (uppgiftens stjärnor). |
| `sjalv` | Alla: 💡-steg och visade svar. |

Frågor i C–F poängsätts som stjärnreglerna: rätt direkt 100, ett fel 60,
fler 20, visat svar 0 (och `h = 1`). Svar som inte räknas som fel (annan form,
följdrad i E) hoppas över.

### Data (inga nya fält, ingen regeländring)

- Försöket: `skills: { fokus: "text"|"bro"|null, obs: { … } }` (fältet fanns, var `null`).
- Progress: `skills: { [färdighet]: { v: 0–100, h: 0–100, n } }` (fanns, var `{}`).
- `progress.skills` = `modellUrForsok(alla försök)` – testat och kontrollerat
  i webbläsaren mot emulatorn för alla seedade elever.
- Reglerna tillät redan båda fälten → **ingen ny rules-deploy** för #626.

### Val av nästa uppgift (E2.4)

Nivån kommer alltid från anpassningen; modellen ändrar bara andelarna på nivån:

| Fokus | Villkor | Effekt |
| --- | --- | --- |
| `text` | Ekvationsslagen sammantaget starka (≥ 75, ≥ 3 uppgifter) och `text` eller `problem` svag (< 50) | F-andelen ≥ 40 % (nivå 1–2: D i stället). |
| `bro` | `balans` stark och `skrivsatt` eller `forenkling` svag | D ≥ 30 %, C ≥ 25 %, högst 30 % "Lös själv" bland A/B (fler med vågen i fokus). Nivå 9+ saknar D. |
| svagast slag | Ett ekvationsslag svagt eller 💡 i minst hälften | Nivåns former som tränar det slaget väger dubbelt (bara det svagaste – annars dubblas ofta allt). |

C–F tillsammans högst 85 %. Uppgifter av fokustypen får `fokus`; **en
fokusuppgift med ⭐ eller ej löst räknas inte i nivåfönstret**
(`framsteg.skyddadFranFonstret`) – eleven ska få träna på sin nivå, inte sänkas
(E2.4 "sänk inte till lätta ekvationer"). Lyckade fokusuppgifter räknas som
vanligt. "Försök igen" behåller `fokus`.

### Lärarvyn (E2.5)

- **Klassöversikten** har kolumnen **I korthet**: det första eleven har svårt
  för + det första hen behärskar (alla meningar i tooltip). Räknas ur samma
  progressdokument som förut – inga fler läsningar (#231).
- **Elevdetaljen** har "Vad eleven kan": meningarna, behärskar / har svårt för
  (ekvationsslag), problemlösning (text → ekvation, hela kedjan) och
  färdighetsindikatorer (0–100, läge, 💡-andel, underlag).
- **Meningarna** (urval): "Behärskar enstegsekvationer självständigt.",
  "Behöver ofta hjälp när x har en koefficient.", "Löser ekvationer bra men
  har svårt att skapa ekvation från text.", "Tar ofta många extra steg trots
  korrekta slutsvar.", "Förstår vågen men har svårt att skriva ekvationen med
  symboler.". Under 3 uppgifter per färdighet: "För få uppgifter för en
  sammanfattning än."

### Preview / QA

`bash admin/qa-ekvationsresan-preview.sh` seedar (`--larare`) även qa-text,
qa-bro, qa-koef och qa-omvag (seeden skriver ut varje elevs meningar).
`qalarare / lilla123` → QA-klass 4A → Statistik → Ekvationsresan.

