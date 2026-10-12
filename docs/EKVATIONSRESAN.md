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
