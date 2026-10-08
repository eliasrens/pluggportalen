# Datamodell – Pluggporten (Firestore)

Detta dokument beskriver Firestore-databasen. **Övriga delar av projektet
(gamemodes, shop, elevrum, lärarsida) bygger på den här modellen** – ändra med
eftertanke.

All åtkomst går genom datamodulen [`src/data.js`](../src/data.js). Bygg inte
egna Firestore-anrop i andra filer – använd modulens funktioner.
(Kunskapsinnehåll + elevkonton är internt utbrutna till `src/data-content.js`,
men re-exporteras av `data.js` – importera fortfarande bara från `data.js`.)

## Översikt av collections

```
subjects/{subjectId}                     ← ämne (t.ex. "so")
subjects/{subjectId}/areas/{areaId}      ← arbetsområde (t.ex. "vikingatiden")
students/{studentId}                     ← elevkonto (inloggning)
studentData/{studentId}                  ← elevens speldata (coins, framsteg, ...)
classes/{classId}                        ← klass (lärarens gruppering, t.ex. "6A")
classProjections/{classId}               ← förberäknad by-översikt per klass (O(1) läsningar)
classProjects/{classId}                  ← gemensamma klassprojekt (donationer till byns ytor)
studentData/{studentId}/lasresaAttempts/{autoId}  ← Läsresan: ett försök per färdig text (#399)
mathCompetitions/{cid}/…                 ← Mattematchen (#457), se "Mattematchen & Live"
liveSessions/{sid}/…                     ← Live-matcher (#457), se "Mattematchen & Live"
liveClock/{uid}                          ← Live: klocksynk per inloggad (#460)
classCenters/{classId}/…                 ← Klasscentret (#476–): Klass-EXP, crowdfunding, layout, pokaler
```

`studentData` har **samma dokument-id** som `students` (elevens id), så de hör ihop.

---

## `subjects/{subjectId}` – ämne

| Fält          | Typ    | Beskrivning                         |
| ------------- | ------ | ----------------------------------- |
| `name`        | string | Visningsnamn, t.ex. "SO"            |
| `order`       | number | Sorteringsordning i listor          |
| `icon`        | string | Emoji, t.ex. "🌍"                    |
| `description` | string | Kort beskrivning                    |

Exempel (`subjects/so`):

```json
{ "name": "SO", "order": 1, "icon": "🌍", "description": "Historia, geografi, samhälle och religion." }
```

---

## `subjects/{subjectId}/areas/{areaId}` – arbetsområde

Ett arbetsområde samlar allt innehåll för ett tema. Texter, frågor och par
ligger som **arrayer inuti dokumentet** (ett arbetsområde = ett dokument = en
läsning för klienten).

| Fält          | Typ            | Beskrivning                              |
| ------------- | -------------- | ---------------------------------------- |
| `name`        | string         | Namn, t.ex. "Vikingatiden"               |
| `order`       | number         | Sorteringsordning                        |
| `coverEmoji`  | string         | Emoji på kortet                          |
| `description` | string         | Kort beskrivning                         |
| `grade`       | string \| null | Årskurs, `"ak1"`–`"ak9"` eller `null` (se nedan) |
| `texts`       | array\<Text\>  | Faktatexter för läsförståelse            |
| `quiz`        | array\<Quiz\>  | Quizfrågor (flerval)                     |
| `pairs`       | array\<Pair\>  | Fakta-par (begrepp ↔ förklaring)         |
| `readingTexts` | array\<ReadingText\> | Läsförståelse-texter i 3 nivåer (se nedan) |
| `exerciseTypes` | string[]     | Valda övningstyper (se nedan)            |
| `generator`   | object \| saknas | Räknegenerator – ett eller flera räknesätt (se nedan) |

**exerciseTypes**: läraren kryssar i vilka övningstyper området ska ha i
"Fix område"-formuläret (`src/teacher-content.js`). Giltiga id (se
[`src/exercise-types.js`](../src/exercise-types.js)): `"quiz"` (Quiz, Läsförståelse,
Kunskapsjakt), `"pairs"` (Para ihop, Memory) och `"bildpar"` (fakta-par med bild).
Valet styr AI-prompten (`buildAreaPrompt`) så att bara passande innehåll efterfrågas
(t.ex. inga bildpar om `"bildpar"` inte kryssats). Saknas fältet (äldre områden)
härleds typerna ur innehållet vid validering, så dokumentet får alltid fältet.

**generator** (räknegeneratorn, #279/#322, flera räknesätt #470): ett generator-område
sparar inget färdigt innehåll utan *vilka* uppgifter som ska genereras:

```js
generator: {
  topics: [                                    // minst ett räknesätt, varje topic högst en gång
    { topic: "addition", variants: ["enkel"] },
    { topic: "multiplikation", variants: ["tabeller", "dubbelt"],
      talstorlek: "liten",                     // valfri: "liten" | "mellan" | "stor"
      bildstod: false },                       // valfri, bara multiplikation/division (default på)
  ],
  grade: "ak3",                                // valfri, områdets årskurs
}
```

Topics/varianter valideras mot katalogen i `src/exercise-types.js`
(`listTopics`/`listVariants`); `normalizeGenerator` rensar, `src/validate-generator.js`
ger felmeddelandena. Räkna-läget och äventyren blandar de valda räknesätten
**balanserat** (deterministisk shuffle-bag, `createTopicBag` i `src/rakna-core.js`:
alla förekommer lika ofta, aldrig samma två i rad), sedan slumpas variant som förut;
rättning/answerType/bildstöd följer varje uppgifts faktiska topic.
**Bakåtkompatibelt:** det gamla formatet `{ topic, variants, talstorlek?, bildstod?, grade? }`
läses som en lista med ett räknesätt (ger exakt samma uppgifter som förut) – ingen
migrering; nästa sparning skriver det nya formatet.

**grade**: valfri årskurs på området (`"ak1"`–`"ak9"`), satt i innehålls-
formuläret (`src/teacher-content.js`). Fältet är **valfritt och bakåtkompatibelt**:
saknas det, eller är värdet okänt, räknas området som *ospecificerad* (`null`) och
inget går sönder. Normaliseras i [`src/grades.js`](../src/grades.js) (`normalizeGrade`
tål även tal och `"åk4"`-stavning). Används för att (1) sortera/filtrera område-
listan i lärarvyn och (2) styra AI-prompten (`buildAreaPrompt`) så språk, svårighets-
grad och exempel anpassas till årskursen – en styrning läraren kan sätta, inte tvingande.

**Text**: `{ id, title, body }`

**Quiz**: `{ id, question, options: string[], answerIndex, explanation, passage?, category? }`
– `answerIndex` är index (0-baserat) i `options` för rätt svar.
– `passage` är källtexten (3–5 meningar) som just den frågan bygger på. I
  läsförståelse-läget visas passagen i ett lugnt block ovanför frågan och byts per
  fråga. **Obligatorisk för läsförståelse:** eftersom samma `quiz`-lista används av
  både Quiz och Läsförståelse räknas en övning som läsförståelse så snart någon fråga
  har `passage` – och då kräver valideringen (`validate.js`) `passage` på *varje*
  fråga, så ingen fråga kan visas utan sin källtext. Ett rent quiz (ingen fråga har
  `passage`) påverkas inte. Övriga gamemodes ignorerar fältet.
– `category` (valfri, epic #444/#445) taggar vad frågan tränar: `"begrepp"`
  (Begreppsförståelse), `"fakta"` (Fakta) eller `"analys"` (Analys/resonemang).
  Nycklarna bor i `QUESTION_CATEGORY_KEYS` (`src/exercise-types.js`, bootgraf-säker),
  etiketter/ikoner/färger i `src/question-categories.js`. Valideringen normaliserar
  (versaler/etikett-stavning) och ger en **varning** (`res.warnings`, stoppar inte
  sparningen) för okända värden – fältet utelämnas då. Samma valfria fält finns på
  **Pair** (används när äventyren gör flervalsfrågor av par).

**ReadingText** (läsförståelse 2.0, issue #152): `{ id, title, levels }` – en läs-text
där **samma tema** finns i **tre språkliga svårighetsnivåer**.

- `title` är temat/rubriken (samma för alla tre nivåerna).
- `levels` är ett objekt med nycklarna `"1"`, `"2"` och `"3"` (**alla tre obligatoriska**).
  Varje nivå: `{ body, questions }`.
  - `body` är läs-texten för nivån (gärna flera stycken, `\n\n` mellan). Samma fakta i alla
    nivåer – bara språket/längden skiljer (nivå 1 kortast/enklast, nivå 3 längst/mest avancerad).
  - `questions` är **3–5 kryssfrågor** (flerval) som hör till just den nivåns text. Frågorna är
    **egna per nivå** (nivå 1:s frågor ≠ nivå 3:s). Varje fråga:
    `{ id, question, options: string[], answerIndex, explanation? }` – samma form som `quiz`
    (`answerIndex` 0-baserat index i `options`).
- **Bakåtkompatibelt/valfritt:** saknas fältet är det en tom lista och äldre områden påverkas
  inte. Den gamla läsförståelsen (`quiz`-frågor med `passage`) fungerar oförändrat parallellt.
- Valideras i [`src/validate-reading.js`](../src/validate-reading.js) (anropad av `validate.js`).
  AI-prompt: `buildReadingPrompt` ([`src/prompt-reading.js`](../src/prompt-reading.js)).
  Lärar-editor: [`src/teacher-reading.js`](../src/teacher-reading.js) (knappen "📖 Nivåtexter").

**Pair**: `{ id, term, definition, termImage?, defImage?, group? }` – används för para ihop / memory.

- `termImage` / `defImage` är **valfria** och pekar med en **nyckel** in i det inbyggda
  bildpaketet ([`src/pair-images.js`](../src/pair-images.js)). Nyckelformat: `"partier/<bokstav>"`
  (t.ex. `"partier/s"`, `"partier/sd"`, `"partier/kd"`). Se `listPairImageKeys()` för hela listan
  (riksdagens 8 partier: s, m, sd, c, v, kd, l, mp).
- Regel: varje sida (term/definition) måste ha **antingen text eller bild** (eller båda). `term`
  får alltså vara tom om `termImage` finns – och tvärtom för `definition`/`defImage`. Bilderna
  renderas som inline-SVG-brickor i Para ihop och Memory; bild↔text och bild↔bild fungerar båda.
- Okänd bildnyckel eller en sida helt utan innehåll ger ett tydligt valideringsfel.
- `group` är **valfri** (sträng): par med samma `group` visas aldrig samtidigt i en och samma
  spelomgång – Para ihop/Memory plockar slumpmässigt högst ett par per group innan urvalet
  begränsas till max 6. Använd den för ömsesidigt uteslutande varianter av samma sak (t.ex.
  ett bild-par och ett text-par för samma parti). Par utan `group` är opåverkade.

**Nyckel-namnrymd & fler bildpaket:** en bildnyckel har formen `"<paket>/<id>"`
(idag bara paketet `partier`, t.ex. `"partier/s"`). Mekaniken är **generell** – spelen
(Para ihop, Memory) och valideringen slår upp nyckeln via `resolvePairImage()` /
`isKnownPairImage()` i `pair-images.js` och bryr sig inte om vilket ämne eller moment
paret ligger i. Vill man lägga bildpar i ett annat moment/ämne (t.ex. kartor i geografi
eller symboler i religion) **lägger man bara till ett nytt paket i `pair-images.js`** med
sin egen prefix och sina nycklar – ingen ändring behövs i spelen, valideringen eller
lärar-UI:t (prompt-, innehålls- och hjälptexter listar nycklarna automatiskt via
`listPairImageKeys()`). Nya prefix ska vara korta och beskrivande (`partier`, `kartor`, …).

Exempel (`subjects/so/areas/vikingatiden`, förkortat):

```json
{
  "name": "Vikingatiden",
  "order": 1,
  "coverEmoji": "🛶",
  "description": "Lär dig om vikingarna – hur de levde, reste och trodde.",
  "grade": "ak4",
  "texts": [
    { "id": "vem-var-vikingarna", "title": "Vilka var vikingarna?", "body": "Vikingarna levde ..." }
  ],
  "quiz": [
    { "id": "q1", "question": "Ungefär när levde vikingarna?",
      "options": ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"],
      "answerIndex": 0, "explanation": "Vikingatiden räknas från ca 800 till 1050.",
      "passage": "Vikingarna levde i Norden ungefär mellan år 800 och 1050." }
  ],
  "pairs": [
    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig" }
  ]
}
```

---

## `students/{studentId}` – elevkonto

Inloggning sker via **Firebase Auth** (Email/Password), inte via Firestore. Efter
härdningen (se `docs/security-plan.md` + `docs/ADMIN.md`) finns **inget
`password`-fält** kvar i dokumentet – lösenorden bor i Firebase Auth. `uid` för
Auth-kontot är samma som `studentId` (kopplingen till `studentData` behålls).
Reglerna låter eleven läsa sitt eget dokument, läraren allt, och en **klasskamrat**
(samma klass) elevens namn/avatar till klassbyn – se `classIds` nedan.

| Fält       | Typ    | Beskrivning                                  |
| ---------- | ------ | -------------------------------------------- |
| `namn`     | string | Elevens namn (visas i appen)                 |
| `username` | string | Användarnamn, gemener (mappas till `username@elev.pluggportalen.local` vid login) |
| `avatarId` | string | Vald avatar (se `AVATARS` i `src/avatars.js`)|
| `classIds` | array\<string\> | **Denormaliserad** klasstillhörighet (klass-id:n). Speglar vilka `classes` som listar eleven i `studentIds`. Låter `firestore.rules` avgöra "samma klass" utan att loopa över `classes` → klassbyn får läsa klasskamraters `students`/`studentData`. Underhålls av `setClassStudents`/`deleteClass`; backfill: `admin/backfill-class-ids.mjs`. Saknas/tom ⇒ ingen kamratåtkomst. |

> `password` är **borttaget** efter migreringen (`admin/migrate-passwords.mjs`).
> Äldre dokument kan fortfarande ha ett kvarblivet `password`-fält tills
> migreringen körts – det tas bort då.

Exempel (`students/elev1`):

```json
{ "namn": "Astrid", "username": "elev1", "avatarId": "fox", "classIds": ["6a"] }
```

---

## `studentData/{studentId}` – elevens speldata

| Fält         | Typ    | Beskrivning                                            |
| ------------ | ------ | ------------------------------------------------------ |
| `coins`      | number | Antal pluggcoins                                       |
| `xp`         | number | Kumulativt erfarenhets-XP. Nivån räknas fram ur detta (obegränsad, stigande kurva) – se `src/leveling.js`. Saknas fältet härleds ett startvärde ur `progress` (migrering). |
| `progress`   | map    | Framsteg: `{ [areaId]: { [gamemode]: {...} } }`        |
| `ownedItems` | array  | Id:n på köpta shop-saker (se `src/shop-items.js`). Binärt "äger minst ett" – single-kategorier (kläder, hus) och legacy. För **multi-saker** (möbler/dekor) står id:t kvar en gång här medan antalet räknas i `ownedCounts`. |
| `ownedCounts`| map    | `{ [itemId]: antal }` – hur många exemplar eleven äger av **multi-saker** (möbler/dekor, `isMultiItem`). Saknas ett id men finns i `ownedItems` räknas det som **1** (bakåtkompat). Se `buyItem`/`ownedCount` i `src/data.js`. Vanliga djur (husdjur) räknas i stället per instans i `roomAnimals`. |
| `avatarItems`| array  | Id:n på klädsaker eleven bär på avataren (delmängd av `ownedItems`) |
| `roomAnimals`| array  | **Vanliga djuren** (köpbara promenerande djur, `src/data-animals.js`): `{ uid, id, pos:{x,y}, name, stowed }`. `id` = arten (shop-id, "hund"), `uid` = unik **instans** – eleven får äga **flera** av samma art. Legacy-poster utan `uid` använder art-id:t som uid. |
| `room`       | map    | **Grundrummet (rum 0)** – `{ placements: { [key]: { x, y } }, paletteId, window }` – `x`/`y` i **procent** (0–100) av rummet. `key` är ett sak-id ("soffa") för ett exemplar, eller `"<id>#<n>"` ("soffa#2") för **flera exemplar** av samma möbel/dekor (`itemIdFromKey` härleder sak-id:t). `paletteId` är elevens färgpalett för hus & väggar (`src/room-palettes.js`, default `"persika"`; golvet färgas aldrig om). `window` = fönstrets läge `{ x, y, removed }`. |
| `extraRooms` | map    | **Fler rum** (husuppgradering, `src/data-room.js`): map keyad på `"0"`,`"1"`,… där `"0"` = rum **#2**. Varje värde har samma form som `room` (`{ placements, paletteId, window }`). Antalet upplåsta extra rum = antal ägda rums-uppgraderingar (`rum-2`/`rum-3`/`rum-4` i `ownedItems`, se `roomUpgradeCount`). `getRooms(sd)` presenterar allt som en 0-indexerad lista `[rum0, rum1, …]` (rum → rooms[0], bakåtkompatibelt: saknas `extraRooms` funkar enrums-hus oförändrat). Rum 0:s `paletteId` är även husets **exteriör**-palett; extra rums palett rör bara det rummets väggar. |
| `garden`     | map    | **Trädgården** – köpta utomhussaker placerade runt huset i ute-vyn: `{ placements: { [key]: { x, y, scen? } } }`, `x`/`y` i **procent** (0–100) av scenen. `key` = sak-id ("trad") eller `"<id>#<n>"` för **flera exemplar** (kategori `tradgard`, se `MULTI_CATEGORIES`). `scen: "gard"` (#356) = saken står i **gårds-scenen** (baksidan, placerad via gård-vyns 🧰 Verktyg-låda); saknas fältet = framsidans ute-scen (**bakåtkompatibelt**). Skilt från `room` (rör aldrig rummet). **Bakåtkompatibelt:** saknas fältet är trädgården tom. Ägande via `ownedItems`/`ownedCounts`; helpers `getGardenFrom`/`saveGarden` i `src/data-room.js`, rendering/placering i `src/varld-tradgard.js`. |
| `husSkalId`  | string/null | Aktivt husskal (byter husets exteriör); `null` = default-stugan |
| `husLast`    | bool   | `true` = huset är **låst**: en klasskamrats läs-vy (`src/pages-klasskamrat.js`) visar `🔒 Låst` i stället för rummet. Toggle i verktygsmenyn (`src/pages-varld.js`); delad hjälpare `isHouseLocked(studentData)` i `src/data-room.js`. Husets exteriör i byn påverkas inte. |
| `avatarId`   | string | Vald avatar (spegel av `students`)                     |
| `avatarChosen` | bool | `true` när eleven själv valt grundavatar (styr avatarvalet vid första inloggning) |
| `readingLevel` | number | **Läsnivå (1–3)** för läsförståelse (#154): läraren sätter den per elev i klasshanteringen (`src/teacher-reading-level.js`), och läsförståelse-läget serverar då områdets `readingTexts` på elevens nivå (`buildReadingPool` i `src/reading-level.js`). **Bakåtkompatibelt:** saknas fältet → `normalizeReadingLevel` ger default `2` (mellan). Helpers `getReadingLevel`/`setReadingLevel` i `src/data-reading-level.js`. |
| `pets`       | array  | Kläckbara husdjuren (mystery eggs) – se nedan. Eleven kan ha **flera** samtidigt |
| `appleCount` | number | Köpta men outlagda **äpplen** (matning). Se avsnittet om äpplen nedan |
| `floorApples`| array  | Äpplen som ligger på golvet i rummet: `{ id, x, y }` (procent). Se nedan |
| `pet`        | map    | **Utfasad** singular-föregångare till `pets` – migreras till `pets[0]` vid första inläsningen (fältet lämnas kvar men ignoreras när `pets` finns) |
| `farm`       | map    | **Gården** (epic gård-expansion, #327): laggård, odlingsbädd, skörde-förråd och djurplaceringar – se avsnittet nedan. **Bakåtkompatibelt:** saknas fältet (alla äldre dokument) default-mergas det vid inläsning (`farmFromData` i `src/farm-core.js`) – ingen migrering behövs |
| `lasresa`    | map    | **Läsresan** (#399): `{ level, highStreak, lowStreak, worldId, stepInWorld, completedWorlds[], totalTexts, totalQuestions, totalCorrect, totalIncorrect, moneyEarned, seenTextIds[], catStats{kategori:{q,correct}}, currentTextId, currentStartedAt, lastTextId, updatedAt, pendingLevel, levelSetAt, levelSetBy }`. `level` (1–7) är Läsresans **dolda** nivå – helt skild från `readingLevel` (1–3). **Lärarstyrd nivå (#505):** `pendingLevel` (1–7 eller null) = lärarvald nivå som gäller efter elevens påbörjade text; `levelSetAt` (ms) + `levelSetBy: "teacher"` = senaste lärarbyte (brygga `src/data-lasresan-niva.js`). **Bakåtkompatibelt:** saknas fältet = ny elev (Skogen, steg 0, klassens `lasresaStartLevel` eller nivå 3) via `normalizeLasresa` i `src/lasresan/progress.js`. Brygga: `src/data-lasresan.js`. Se [LASRESAN.md](LASRESAN.md). |
| `lasresaAttemptsFallback` | array | Läsresan: de senaste (max 30) försöken när skrivning till `lasresaAttempts` nekas (regeln ännu ej deployad). Samma form som ett försöksdokument. Läses av `listAttempts`. |
| `kcDonation` | string | Klasscentret (#500): `"<classId>/<donationId>"` för elevens senaste donation – skrivs i samma batch som myntavdraget så att ett avdrag bara kan betala EN donationspost (se Crowdfunding). Läses inte av appen. |

### `studentData/{studentId}/lasresaAttempts/{autoId}` – Läsresan-försök (#399)

Ett dokument per **färdig** text (skrivs i samma transaktion som `studentData.lasresa`
av `completeText` i `src/data-lasresan.js`):

| Fält | Typ | Beskrivning |
| ---- | --- | ----------- |
| `textId`, `title`, `textType`, `textLevel` | string/number | Vilken text (id enligt innehållskontraktet, t.ex. `lr-n3-bollen-som-forsvann`) |
| `studentId` | string | Eleven |
| `startedAt`, `completedAt` | number | ms sedan epoch |
| `totalQuestions`, `correct`, `incorrect`, `percentage` | number | Resultat |
| `earnedMoney` | number | Pluggcoins för texten (3/rätt, lagda på `coins` via `addCoins`) |
| `perQuestion` | array | `[{ qid, category, chosen, correct }]` |
| `perCategory` | map | `{ kategori: { q, correct } }` |

Regel: läs/skriv för eleven själv eller lärare (striktare läsning än `studentData`).
⚠️ Kräver `firebase deploy --only firestore:rules`. Innan dess faller skrivningen
tillbaka till `studentData.lasresaAttemptsFallback`.

### `studentData.pets[]` – kläckbara husdjuren

Varje äggköp i shoppen lägger till ett nytt objekt i listan. Husdjuren **bor i
Mitt rum** (`#/elev/rum`): ägget ruvar/kläcks där och djuret matas/döps via
rumsvyn. Tidsstämplar är **millisekunder** (`Date.now()`); kläckning och
tillväxt räknas ut **vid inläsning** – ingen bakgrundsprocess. Husdjuret kan
aldrig dö.

| Fält          | Typ         | Beskrivning                                              |
| ------------- | ----------- | -------------------------------------------------------- |
| `id`          | string      | Stabilt slump-id för djuret (sätts vid köp/migrering)    |
| `name`        | string/null | Elevens eget namn på djuret (max 16 tecken); `null` = odöpt |
| `pos`         | map         | `{ x, y }` – position i **procent** (0–100) av rumsscenen |
| `eggBoughtAt` | number      | När ägget köptes (ms). Kläcks ~3 dagar senare            |
| `hasHeatLamp` | bool        | Värmelampa köpt → ägget kläcks på **halva** tiden        |
| `speciesId`   | string/null | Slumpad art vid kläckning (se `SPECIES` i `src/art-pets-creatures.js`) |
| `hatchedAt`   | number/null | När ägget kläcktes (ms); `null` = ruvar fortfarande      |
| `stage`       | number      | Tillväxtsteg 1–3 (0 = okläckt ägg). Härleds ur `feedCount` |
| `feedCount`   | number      | Antal **uppätna äpplen** totalt (styr steget: ≥10 → steg 2, ≥20 → steg 3) |
| `lastFedAt`   | number/null | När djuret senast åt ett äpple (ms)                     |

```json
{
  "eggBoughtAt": 1756700000000, "hasHeatLamp": true,
  "speciesId": "blomp", "hatchedAt": 1756830000000,
  "stage": 2, "feedCount": 12, "lastFedAt": 1757000000000
}
```

### Matning via äpplen (`studentData.appleCount` + `studentData.floorApples[]`)

Matning sker genom att köpa **äpplen** (förbrukningsvara, ~5 mynt) i shoppen,
lägga ut dem på golvet i Mitt rum och låta djuren gå dit och äta. Ingen
gratis-matning finns kvar – tillväxten drivs helt av uppätna äpplen (10 per steg).

| Fält                    | Typ    | Beskrivning                                                     |
| ----------------------- | ------ | -------------------------------------------------------------- |
| `appleCount`            | number | Köpta men **outlagda** äpplen. `buyApple` ökar, `placeApple` minskar |
| `floorApples[]`         | array  | Äpplen som ligger på golvet: `{ id, x, y }` (x/y i procent av rumsscenen) |

Flöde (allt i transaktioner, `src/data-pet.js`): `buyApple(price)` drar mynt och
ökar `appleCount`; `placeApple(x, y)` flyttar ett äpple → `floorApples`; när ett
hungrigt (icke-fullvuxet) djur når fram i promenad-AI:ns **seek-läge**
(`src/rum-promenad.js`) tar `eatApple(petId, appleId)` bort äpplet och ökar
djurets `feedCount`. Äpplet är en `mat`-kategori-vara i `src/shop-items.js`
(`consumable: true`) och hamnar därför aldrig i `ownedItems`.

### `studentData.farm` – gården

Gård-expansionens tillstånd (epic trädgård/gård, grundlagd i #327). All ren
tillståndslogik (validering, tillväxt, skörd, placeringar) ligger browser-fritt
i [`src/farm-core.js`](../src/farm-core.js) (enhetstestad, `test/farm-core.test.js`);
Firestore-skrivningarna (transaktioner + dot-path-updates) i systermodulen
[`src/data-farm.js`](../src/data-farm.js), re-exporterad via `data.js`.

| Fält               | Typ    | Beskrivning                                                       |
| ------------------ | ------ | ----------------------------------------------------------------- |
| `barnLevel`        | number | Laggårdens nivå (**1–3**). Sparat fält – se designbeslutet nedan. Styr antal djurplatser i ladan: `FARM_BARN_PLACES_PER_LEVEL` (2/4/8, `farm-core.js`) och – utan valt skin – laggårdens fasad/interiör (`art-gard.js`) |
| `barnSkin`         | string \| null | Laggårdens **utseende** (#353), skilt från nivån: id i `LADA_SKINS`-registret (`art-lada-skins.js`) = shop-id (kategori `hus`, `barnSkin:true`, köps till `ownedItems` som husskalen). `null` (default) = klassiska nivå-fasaden. Rent kosmetiskt – kapaciteten styrs alltid av `barnLevel`. Väljs i gårds-vyns "🛖 Ny lada" (`varld-lada-skin.js`) via `setBarnSkin` (`data-farm.js`); okänt id faller tillbaka på nivå-fasaden vid rendering |
| `gardenTier`       | number | Odlingsbäddens nivå (**1–3**). Styr antal odlings-slots: `FARM_SLOTS_PER_TIER` (2/4/8 per #333, tabell i `farm-core.js`) och bäddens utseende (enkel bädd → dubbel låda → växthus) |
| `gardenSlots`      | array  | Planterade grödor: `{ slotIndex, cropId, growthStage, plantedAt }`. `slotIndex` 0-baserat `< slotCountForTier(gardenTier)`; `growthStage` **0–3** (0 = nysådd, 3 = `FARM_MAX_GROWTH_STAGE` = färdigvuxen → skördbar); `plantedAt` ms (`Date.now()`). Tomma slots har ingen post |
| `inventoryHarvest` | map    | Skörde-förrådet: `{ [cropId]: antal }` (t.ex. `{ "crop_carrot": 3 }`). Alltid ≥ 1 – noll-poster städas bort vid skrivning |
| `placedAnimals`    | array  | Djur placerade **utanför rummet**: `{ petId, location: "paddock"\|"barn" }`. `petId` = djurets instans-id (`pets[].id` eller `roomAnimals[].uid`). `"room"` är default-hemmet och **sparas aldrig** som post – ett djur utan post bor i rummet, precis som före gården (bakåtkompatibelt) |
| `animals`          | array  | **Bondgårdsdjuren** (häst/ko/gris, #330): `{ uid, id, name, pos, trivsel, lastFedAt, lastGiftAt }`. `id` = arten (shop-id `animal_horse` …), `uid` = unik instans. `trivsel` **0–100** (default 80); **effektiv** trivsel beräknas vid läsning (`trivselNow`: −10/helt dygn sedan `lastFedAt`, golv 0). Matning (#332): rätt gröda (`FODER_FOR`) ur `inventoryHarvest` ger **+25 trivsel dagens första matning** (`feedFarmAnimal`); `trivsel ≥ 60` → daglig gåva (+`FARM_GIFT_COINS` mynt, `claimFarmAnimalGift`, gate:ad per kalenderdag via `lastGiftAt`) |

**Designbeslut – nivåer som fält, inte härledda:** rummen härleder antal rum ur
ägda shop-saker (`roomUpgradeCount` i `src/shop-items.js`); för gården sparas
`barnLevel`/`gardenTier` i stället som **egna fält** (enligt spec). Skälen:
uppgraderingarna är sekventiella nivåer på **en** byggnad (inte separata saker
man äger), och kommande odlings-/uppgraderings-issues kan då höja nivån i samma
transaktion som coins dras utan att blanda in shop-katalogen.
**Uppgraderings-issuen (#333) följer modellen så här**: uppgraderingarna finns
som shop-KORT (`farmUpgrade`/`upgradeLevel` i `shop-items.js` – rent köp-UI),
men köpet går via `buyFarmUpgrade` (`data-farm.js`) som drar coins **och** höjer
`farm.gardenTier`/`farm.barnLevel` i EN transaktion; **inget skrivs i
`ownedItems`** – shoppen härleder "Köpt"/låst ur nivå-fältet. Nivåerna köps i
ordning (bara `nuvarande + 1` accepteras) och kan aldrig sänkas – planterade
slots hamnar aldrig utanför bädden, och `setPlacementIn` stoppar fler djur i
ladan än `barnPlaceCountForLevel(barnLevel)` tillåter.

Flöde (allt i transaktioner, `src/data-farm.js`): `plantCrop(slotIndex, cropId)`
sår i en tom slot (stage 0); `advanceCropGrowth(slotIndex)` stegar tillväxten
(klamras vid 3 – vem/vad som driver tillväxten bestäms i odlings-issuen);
`harvestCrop(slotIndex)` tömmer en **färdigvuxen** slot och lägger grödan i
`inventoryHarvest`; `adjustHarvestInventory(cropId, delta)` förbrukar/justerar
förrådet (aldrig under 0); `setAnimalPlacement(petId, location)` flyttar ett
djur mellan rum/hage/laggård. Säkerhetsregler: `farm` ligger i `studentData`
som redan är self-writable – **inga regeländringar behövs**.

`progress`-resultat per gamemode: `{ completed, bestScore, stars, plays, lastPlayed, cat? }`.
`plays` (antal avklarade körningar) summeras per elev till `plays` i klass-
projektionens members-entry (`playsTotal`, #498 – Klasscentrets statistiktavla).
`gamemode` är en sträng, förslagsvis `"quiz"`, `"lasforstaelse"`, `"para"`.

`cat` (valfri, #445) = rätt/totalt per frågekategori, **ackumulerat** över alla
körningar: `{ "fakta": { "r": 7, "t": 9 }, "begrepp": { "r": 2, "t": 3 } }`. Skrivs av
`saveProgress` (adderar sessionens räkning till den sparade) när en övning slutförs i
Quiz, Läsförståelse, Kunskapsjakt eller ett äventyr. Quiz/Läsförståelse räknar varje
unik fråga en gång (första svaret), Kunskapsjakt och äventyr varje svar. Frågor utan
kategori räknas inte. Saknas fältet (gammal data) gäller stjärnor per läge som
fallback. Läs-API: `summarizeStudent` / `summarizeClass` i `src/plugga-stats.js`.
Påverkar inte stjärnor, coins eller XP. Inga regeländringar (`studentData` är self-writable).

Exempel (`studentData/elev1`):

```json
{
  "coins": 40,
  "xp": 130,
  "progress": {
    "vikingatiden": {
      "quiz": { "completed": true, "bestScore": 4, "stars": 2, "lastPlayed": "<timestamp>" }
    }
  },
  "ownedItems": ["keps", "sang", "hund"],
  "avatarItems": ["keps"],
  "room": { "placements": { "sang": { "x": 30, "y": 70 }, "hund": { "x": 60, "y": 80 } } },
  "avatarId": "fox"
}
```

---

## `classes/{classId}` – klass

Lärarens gruppering av elever, t.ex. "6A". Används som grund för att senare
tilldela uppgifter per klass. Elevlistan ligger som en **array (`studentIds`)
direkt på klassdokumentet** – enklast för den här appen (en handfull klasser
med ~30 elever styck läses/skrivs i ett dokument, och en elev kan finnas i
flera klasser utan extra kopplingsdata).

| Fält         | Typ            | Beskrivning                                   |
| ------------ | -------------- | --------------------------------------------- |
| `name`          | string                | Klassens namn, t.ex. "6A"                     |
| `order`         | number                | Sorteringsordning i listor (valfritt)         |
| `createdAt`     | timestamp             | När klassen skapades (`serverTimestamp`)      |
| `studentIds`    | array\<string\>       | Id:n på eleverna i klassen (pekar på `students`)|
| `assignedAreas` | array\<Assignment\>   | Aktiva/tilldelade arbetsområden (valfritt, se nedan) |
| `lock`          | ClassLock             | Fokusläge (#436): klassen låst till ETT mål till ett klockslag (valfritt, se nedan) |
| `lasresaStartLevel` | int 1–7           | Läsresans startnivå (#505) för klassens elever som INTE börjat Läsresan (saknar `studentData.lasresa`) och nya elever. Saknas = 3. Påverkar inte elever som är igång. Bara lärare skriver (regeln validerar heltal 1–7; ⚠️ rules-deploy). Se [LASRESAN.md](LASRESAN.md). |

**Assignment**: `{ subjectId, areaId }` – pekar på ett `subjects/{subjectId}/areas/{areaId}`.

`assignedAreas` styr elevens Plugga-vy: läraren väljer vilka arbetsområden som
är **aktiva nu** för klassen. Har klassen en icke-tom lista ser eleverna i
klassen **bara** de områdena; är listan tom eller saknas (eller tillhör eleven
ingen klass) ser eleverna **hela** biblioteket (bakåtkompatibelt – aldrig en tom
sida).

**ClassLock** (#436, fokusläge): `{ mal: { typ, id?, namn? }, till, doljOvrigt }`.
`mal.typ` är en utbyggbar enum (`"omrade"` | `"lasresan"`); för `"omrade"` är
`id` = `"<subjectId>/<areaId>"` och `namn` områdets visningsnamn. `till` = sluttid
i epoch-ms (klockslaget läraren valde). Under låset når eleverna bara målet –
övriga Plugga-områden och Läsresan (resp. Plugga om målet är Läsresan) är
spärrade även via direktlänk. `doljOvrigt: true` döljer **allt** utom målet
(hus/värld, shop, profil). Saknat fält eller `till` passerad = inget lås. Elevens
klient bevakar klass-dokumentet live (onSnapshot) och jämför `till` mot en
server-korrigerad klocka, så "Lås upp nu" och klockslaget slår igenom utan
omladdning. Reglerna kräver att ett nytt/ändrat lås har `till` framåt och högst
24 h bort (mot `request.time`). Logik: `src/class-lock.js`, persistens:
`src/data-class-lock.js`, lärar-UI: `src/teacher-class-lock.js`.

Exempel (`classes/6a`):

```json
{
  "name": "6A", "order": 1, "createdAt": "<timestamp>",
  "studentIds": ["elev1", "elev2"],
  "assignedAreas": [{ "subjectId": "so", "areaId": "demokrati" }]
}
```

> **OBS – två liknande begrepp i lärar-UI:t:** `#/larare/klasser` (HANTERA
> klasser – den här collectionen) skiljer sig från `#/larare/klass`
> (klassöversikt/framsteg, som är läs-endast och inte använder `classes`).

---

## `classProjects/{classId}` – gemensamma klassprojekt (#331)

Klassen donerar **tillsammans** pluggcoins till byns gemensamma ytor
(stadshus, skola, park på bykartan). Samma dokument-mönster som
`classProjections` (#231): **ett förberäknat dokument per klass** – hela
klassens insamlingsläge läses i en enda `getDoc` (O(1), aldrig ett dokument
per elev; jfr Firestore-kvot-incidenten 2026-09-09).

> **Status: framtidssäkring.** Endast schema + regler + data-scaffold finns
> (#331). Bybyggnads-rendering och doneringsknapp i UI byggs i nästa epic –
> ingen UI-kod anropar detta ännu.

| Fält       | Typ | Beskrivning |
| ---------- | --- | ----------- |
| `projects` | map | Keyad på **byggnads-id** (t.ex. `"stadshus"`, `"skola"`, `"park"`) → ett projekt-objekt (nedan). Saknat dokument/fält = inga projekt startade (bakåtkompatibelt). |

Varje projekt (`projects.{buildingId}`):

| Fält            | Typ    | Beskrivning |
| --------------- | ------ | ----------- |
| `goalAmount`    | number | Målbelopp i coins (positivt heltal). |
| `collected`     | number | Insamlat hittills. Projektet är **fullfinansierat** när `collected ≥ goalAmount` (härlett via `isProjectFunded` – ingen status-flagga att hålla i synk). |
| `contributions` | map    | `{ [studentId]: antal }` – per-elev-bidrag (ackumulerande). |
| `createdAt`     | number \| null | När projektet startades (ms, `Date.now()`). |

Exempel (`classProjects/6a`):

```json
{
  "projects": {
    "stadshus": {
      "goalAmount": 500, "collected": 90,
      "contributions": { "elev1": 40, "elev2": 50 },
      "createdAt": 1758200000000
    }
  }
}
```

**Skrivmodell:** en donation går i **en transaktion**
(`donateToClassProject` i [`src/data-classes.js`](../src/data-classes.js)):
läser elevens `studentData` + klassens `classProjects`-dokument, kontrollerar
täckning och att projektet inte är fullt, drar coins och ökar `collected` +
`contributions.{studentId}` atomiskt. Överdonation nekas (inga coins in i ett
stängt/fullt projekt). Ren normalisering/övergångslogik ligger Firebase-fritt
i [`src/class-projection-entries.js`](../src/class-projection-entries.js)
(`normalizeClassProject(s)`, `applyProjectDonation`, `isProjectFunded` –
enhetstestade i `test/class-projects.test.js`).

**Säkerhetsregler:** speglar `classProjections` – läsning för alla inloggade,
skrivning för **klassmedlem** (`request.auth.uid ∈ classes/{classId}.studentIds`)
eller lärare (`isClassMember` i `firestore.rules`; regeltester i
`test/firestore-rules-class-docs.test.js`).
**⚠️ Reglerna är live först efter `firebase deploy --only firestore:rules`**
(separat från Pages-deployen).

---

## Mattematchen & Live (#456/#457)

Spec: [spec-mattematchen-live.md](spec-mattematchen-live.md). Två produkter med
**separata tävlingsresultat** som delar samma multiplikationsmotor:

| Lager | Modul |
| ----- | ----- |
| Frågegenerator 0–10 (shuffle-bag, ingen direkt upprepning/spegel) | `src/mult/generator.js` |
| Snabb svarskomponent (ENTER-flöde, autofokus, rätt/fel) | `src/mult/fast-answer.js` + `.css` |
| Unikt försöks-id per visad fråga | `src/mult/attempt-id.js` |
| Live gameMode-registry + inbyggda lägen | `src/live/game-modes.js`, `src/live/modes/` |
| Svar → exakt batch som reglerna godtar | `src/tavling/answer-writes.js` |
| MM elevlogik: period-läge, Topp 25, Klasskamp, egen statistik (ren) | `src/tavling/mm-core.js` |
| MM elevsida `#/elev/mattematchen` (#458) – dynamisk, menylänk bara under aktiv period | `src/tavling/page-mattematchen.js`, `mm-watch.js`, `mm-data.js`, `mm-panels.js` |
| MM lärarflik `#/larare/mattematchen` (#459) – skapa/styr/följ/historik/nollställ, `?id=` = detaljvy | `src/tavling/teacher-mattematchen.js`, `teacher-mm-detail.js`, `teacher-mm-form.js`, `teacher-mm-results.js` |
| MM lärarlogik (ren): formulär, kontroller per läge, historik-`result`, klasstabell | `src/tavling/mm-teacher-core.js` |
| MM lärarens Firestore-lager (skriv + nollställ + klass-statistik + träningstotal) | `src/tavling/mm-teacher-data.js` |
| Statistik → Mattematchen (klass × period → tabell → elevdetalj per tabell 0–10) | `src/tavling/teacher-mm-stats.js` (+ `mm-larare.css`) |

Demo: `preview-mult-snabb.html`. Tester: `test/mult-generator.test.js`,
`test/live-game-modes.test.js`, `test/firestore-rules-mattematchen-live.test.js`,
`test/mm-core.test.js`, `test/firestore-rules-mattematchen-elev.test.js`,
`test/mm-teacher-core.test.js`, `test/firestore-rules-mattematchen-larare.test.js`.
Elevsidan mot emulatorn: `admin/qa-mattematchen-seed.mjs` + `admin/qa-emulator-proxy.mjs`;
lärarsidan: kör därefter `admin/qa-mattematchen-larare-seed.mjs` (qalarare / lilla123).

**Lärarsidan (#459):** "Avsluta" (och första öppningen av en tävling vars tid
tagit slut av sig själv, `archiveIfEnded`) skriver `status: "finished"` +
`result` = `{ savedAt, winner, winnerClass, winnerClasses[], top, classes, students
[{uid,name,classId,correct,incorrect}], totals, tables[0–10] }` (≤ 2000 elever).
`winnerClasses` (#495) = alla klasser på delad förstaplats (samma poäng/elev,
> 0 rätt); `winnerClass` = den första av dem (visningen). Efter skrivningen
delar samma lärarklient ut Klasscentrets pokal `mm-klasskamp` (se Pokaler).
Underdokumenten ligger kvar → elevdetaljen per tabell går att öppna i efterhand.
Klasstabellen läser `studentStats where documentId() in [klassens elever]` (30 per
fråga). "Totalt i multiplikation" = två `count()` på `collectionGroup("answers")`
(uid, uid+isCorrect) – **kräver index-deploy** (`firestore.indexes.json`:
collection-group-fält `answers.uid` + sammansatt `uid,isCorrect`); utan index
visar elevdetaljen bara "inte tillgänglig".

**Elevens synlighet (#458):** `mm-watch.js` håller EN onSnapshot-fråga
`mathCompetitions where participatingClassIds array-contains-any [elevens klasser]`
(enkelfälts-index) + timer till nästa `startAt`/`endAt` → menylänken 🧮 visas/döljs
automatiskt. Frågan returnerar även klassens gamla (avslutade) tävlingar – få per
klass, filtreras i klienten (ett `endAt`-filter skulle kräva sammansatt index).

```
mathCompetitions/{cid}                               ← MathCompetition (lärare)
mathCompetitions/{cid}/answers/{attemptId}           ← ett svar (create-only)
mathCompetitions/{cid}/studentStats/{uid}            ← PRIVAT elevstatistik (cache)
mathCompetitions/{cid}/scores/{uid}                  ← PUBLIK topplistepost (Topp 25)
mathCompetitions/{cid}/classCounters/{classId}_{n}   ← shardad klassräknare (Klasskamp)
liveSessions/{sid}                                   ← LiveSession (lärare)
liveSessions/{sid}/answers/{attemptId}               ← ett Live-svar (create-only)
liveSessions/{sid}/players/{uid}                     ← närvaro/"redo" + elevens matchresultat
liveSessions/{sid}/counters/{classId}_{n}            ← shardad klassräknare (projektorn)
```

### Grundprincip: poäng uppstår bara ur verifierade svarsdokument

Ingen backend finns – `firestore.rules` är servervalideringen. Varje svar blir
**en writeBatch** (planeras av `src/tavling/answer-writes.js`):

| | MM rätt | MM fel | Live rätt | Live fel |
|-|-|-|-|-|
| `answers/{attemptId}` (create) | ✓ | ✓ | ✓ | ✓ |
| `studentStats/{uid}` / `players/{uid}` (+1 rätt/fel) | ✓ | ✓ | ✓ | ✓ |
| `scores/{uid}` (+1) | ✓ | – | – | – |
| klassräknare `{classId}_{shard}` (+1) | ✓ | – | ✓ | – |

- **Dubbla svar:** `attemptId` skapas när frågan visas och är dokument-id. Svaret
  får bara skapas, aldrig uppdateras → dubbel-ENTER/retry/offline-kö räknas aldrig två gånger.
- **Facit på servern:** reglerna kräver `correctAnswer == factorA·factorB`,
  `isCorrect == (answer == correctAnswer)`, faktorer 0–10, `at == request.time`.
- **Räknare bara +1 i samma batch:** varje räknar-dok bär `lastAttemptId`; reglerna
  kräver att det svaret INTE fanns före batchen (`exists`) men finns efter
  (`existsAfter`), är elevens eget, och att räknaren ökat exakt +1 enligt svaret.
  Svaret kräver omvänt (`getAfter`) att räknarna uppdaterats i samma batch.
  Klassräknaren måste vara svarets egen shard (`{classId}_{answer.shard}`) → ett
  svar kan inte öka två shards.
- **Tid:** svar nekas utanför `[startAt, endAt)` (MM) resp. efter
  `startedAt + countdownSeconds + durationSeconds` (Live) mot `request.time`.
- **Klass:** `classId` måste vara deltagande och eleven finnas i `classes/{classId}.studentIds`.
- **Namn** i `scores`/`players` måste vara `students/{uid}.namn` (ingen påhittad text på projektorn).
- **Separata system:** MM-poäng (`mathCompetitions/…`) och Live-poäng
  (`liveSessions/…`) kan aldrig korsas – varje räknare valideras mot ett svar
  i SIN egen tävling.

**Kvarvarande begränsningar (ärligt):**
1. Eleven väljer själv vilken fråga hen svarar på – reglerna kan inte se vilken
   fråga klienten visade. En elev som skriptar kan samla poäng på `0×0`.
2. Ingen takt-begränsning (en minsta tid mellan svar skulle tappa riktiga svar
   när offline-kön töms). Skriptade "orimliga" takter syns i statistiken.
3. Lärare (teacher-claim) styr tävlingar/sessioner och får RADERA (nollställa) svar och räknare – men inte skriva poäng direkt.

**⚠️ DEPLOY KRÄVS:** `firebase deploy --only firestore:rules` – inget är deployat
(inkl. #460:s matchslut-regel och `liveClock`).
Index: Topp 25 (`scores` orderBy `correct` desc) och Live-listan
(`liveSessions` where `participatingClassIds` array-contains) klarar sig med
automatiska enkelfälts-index; kombineras `status`-filter krävs ett sammansatt index.

### `mathCompetitions/{cid}` – MathCompetition

| Fält | Typ | Beskrivning |
| ---- | --- | ----------- |
| `name` | string ≤ 80 | "Mattematchen oktober 2026" |
| `participatingClassIds` | array\<string\> (1–50) | deltagande klasser |
| `startAt` / `endAt` | timestamp | period; `endAt > startAt` |
| `status` | `"active"` \| `"stopped"` \| `"finished"` | lärarens styrning (se nedan) |
| `counterShards` | int 1–50 | antal klassräknar-shards (förslag 5) |
| `createdBy` / `createdAt` | string / timestamp | |
| `result` | map (valfri) | historik-ögonblicksbild vid avslut: vinnare, klassresultat, elevresultat |

**Visad status** (beräknas, lagras inte): `kommande` = `active` och nu < `startAt`;
`aktiv` = `active` och `startAt` ≤ nu < `endAt`; `pausad` = `stopped`;
`avslutad` = `finished` eller nu ≥ `endAt`. Svar godtas bara i läget *aktiv*.
"Starta nu" = sätt `startAt` till nu; "Avsluta" = `status: "finished"` (+ ev. `endAt` = nu).
**Nollställning** (med tydlig bekräftelse) = läraren raderar `answers`,
`studentStats`, `scores`, `classCounters` under tävlingen. Avslutade tävlingar
ligger kvar = **historik** (`result` + alla underdokument).

### `mathCompetitions/{cid}/answers/{attemptId}` – MathAnswer (även Live-svar)

| Fält | Typ | Beskrivning |
| ---- | --- | ----------- |
| `uid` | string | eleven (== `request.auth.uid`) |
| `classId` | string | klassen svaret räknas till |
| `mode` | string | `"multiplication_0_10"` |
| `factorA` / `factorB` | int 0–10 | frågan (statistik per tabell = båda faktorerna) |
| `answer` | int 0–9999 | elevens svar |
| `correctAnswer` | int | `factorA·factorB` |
| `isCorrect` | bool | `answer == correctAnswer` |
| `shard` | int | vilken klassräknar-shard (0..counterShards-1) |
| `at` | timestamp | `serverTimestamp()` |

Läsning: eleven själv + lärare. **Gemensam träningsstatistik** (MM + Live
tillsammans) = `collectionGroup("answers").where("uid","==",uid)` – inga extra
skrivningar, tävlingspoängen förblir separata.

### `mathCompetitions/{cid}/studentStats/{uid}` – CompetitionStudentStats (privat)

`{ uid, classId, correct, incorrect, c0…c10, w0…w10, lastAttemptId, lastAt }` –
`c{t}`/`w{t}` = rätt/fel i `t`:ans tabell (7×8 räknas i både 7:an och 8:an,
7×7 en gång). Totalt = `correct + incorrect`; procent räknas i klienten.
Läses av eleven själv (📊) och lärare (klassöversikt/elevdetalj). Saknade fält = 0.

### `mathCompetitions/{cid}/scores/{uid}` – topplistepost (publik)

`{ uid, classId, name, correct, lastAttemptId, lastAt }` – bara det Topp 25
behöver. Elever får läsa enstaka poster och **lista högst 25** (`limit(25)`),
läraren allt. Skapas vid elevens första rätta svar.

### `mathCompetitions/{cid}/classCounters/{classId}_{shard}` – Klasskamp

`{ classId, shard, correct, lastAttemptId, lastAt }`. Klassens rätt = summan av
klassens shards; **Klasskamp = rätt / `classes/{classId}.studentIds.length`**
(1 decimal). Läsbar för alla inloggade.

### `liveSessions/{sid}` – LiveSession

| Fält | Typ | Beskrivning |
| ---- | --- | ----------- |
| `name` | string ≤ 80 | "4B mot 5E" |
| `classNames` | map `{ classId: string }` | klassnamnen denormaliserade vid skapandet (#460) – elev/projektor slipper läsa `classes` |
| `createdByName` | string (valfri) | lärarens användarnamn ("skapad av rasmus" i Aktiva Live-sessioner) |
| `gameMode` | string | id i gameMode-registret, t.ex. `"multiplication_0_10"` |
| `participatingClassIds` | array\<string\> (1–8) | klasserna |
| `classDivisors` | map `{ classId: int }` | lärarens nämnare (förifylls med klassens elevantal, får ändras även under matchen) |
| `durationSeconds` | int 30–3600 | matchlängd (UI: 300–1800 i 5-min-steg; kortare för QA) |
| `countdownSeconds` | int 0–10 | 3–2–1–KÖR innan svar godtas (förslag 4) |
| `counterShards` | int 1–50 | klassräknar-shards (förslag 10) |
| `status` | `"lobby"` → `"live"` → `"finished"` | aldrig bakåt; `lobby` → `finished` = avbruten |
| `createdBy` / `createdAt` | string / timestamp (`serverTimestamp`) | |
| `startedAt` | timestamp | sätts vid STARTA, MÅSTE vara `serverTimestamp()`; oföränderlig därefter |
| `endsAt` | timestamp | skrivs direkt efter start och MÅSTE vara `startedAt + countdownSeconds + durationSeconds` |
| `finishedAt` | timestamp | när matchen markerades klar |
| `result` | map (valfri) | historik: `{ perClass: { classId: { correct, divisor, score } }, winner \| "draw" }` |

- Bara lärare skapar/ändrar, och **alla lärare** får styra alla sessioner.
  `gameMode`, klasser, längd, nedräkning och shards låses när matchen startat.
- Alla inloggade läser sessionen (eleven hittar sin lobby med
  `where("participatingClassIds","array-contains",klassId)` + onSnapshot).
- **Timer:** alla klienter räknar `endsAt` (eller `startedAt + …`) mot sin
  server-korrigerade klocka – aldrig en lokal lärartimer. Reglerna räknar slutet
  ur `startedAt`, så ett saknat `endsAt` stoppar aldrig matchen.
- Vyval på projektorn (Raketrace/Statistik/Dragkamp) är **lokalt** och lagras inte här.
- Avslutade sessioner ligger kvar = **Live-historik**.
- **Matchslut (#460):** vid 00:00 får VILKEN inloggad klient som helst markera
  `live → finished` (bara `status` + `finishedAt = serverTimestamp()`), och reglerna
  kräver `request.time ≥ startedAt + countdownSeconds + durationSeconds`. Läraren
  kan dessutom avsluta i förtid / avbryta en lobby.
- **`result`** skrivs EN gång (transaktion) av en lärarklient (projektorn, eller
  historikvyn om ingen projektor var öppen) ~2,5 s efter slut:
  `{ perClass: { classId: { correct, divisor, score, players } }, winner: classId|"draw", totalCorrect, players, computedAt }`
  + i KOOPERATIVA lägen (`GameMode.cooperative`, #495) `cooperative: true,
  goalReached: bool` (lägets `goalReached(standings, session)`). Klienten vars
  transaktion skrev `result` delar sedan ut Live-bonusar och pokaler.

### Live-kärnan i klienten (#460)

| Lager | Modul |
| ----- | ----- |
| Ren logik: faser (lobby/countdown/live/ended/finished), 3-2-1, tid kvar, poäng, vinnare, topplista | `src/live/live-core.js` |
| Server-korrigerad klocka (liveClock-rundtur + färska serverstämplar) | `src/live/live-clock.js` |
| Firestore-lagret (skapa/starta/avsluta, prenumerationer, gå med, svar) | `src/live/live-data.js` |
| **Realtids-datalagret för projektorvyer** – `subscribeLiveSession(sid, cb)` | `src/live/live-feed.js` |
| Elevens meny-synlighet (onSnapshot på status lobby\|live) | `src/live/live-watch.js` |
| Elevsidan `#/elev/live` | `src/live/page-elev-live.js` |
| Lärarfliken `#/larare/live` (skapa, aktiva, historik), projektorvyn `?id=` (#461: lobby, Raketrace, Statistik, Dragkamp, vinnare) | `src/live/teacher-live*.js`, `src/live/projector.js` + `src/live/proj-*.js` |
| Statistik → Live per klass | `renderClassLiveStats` i `src/live/teacher-live-history.js` |

Start = transaktion `lobby → live` med `startedAt = serverTimestamp()`, sedan
`endsAt = new Timestamp(startedAt.seconds + nedräkning + längd, startedAt.nanoseconds)`.
Elev-/lärarlistorna frågar `where("status","in",["lobby","live"])` (enkelfälts-index,
filtreras på klass i klienten); historik `where("status","==","finished")`.
QA mot emulatorn: `admin/qa-live-seed.mjs` + `admin/qa-emulator-proxy.mjs`.

### `liveClock/{uid}` – klocksynk (#460)

`{ t: serverTimestamp() }` – den inloggade skriver bara sitt eget dokument och läser
tillbaka det → klientens avvikelse mot serverns klocka (fel ≤ halva rundturen).

### `liveSessions/{sid}/players/{uid}` – närvaro + elevens matchresultat

`{ uid, classId, name, joinedAt, lastSeenAt, correct, incorrect, lastAttemptId?, lastAt? }`.
"Gå med" skapar dokumentet (lobby eller pågående match = sen anslutning) med
`correct/incorrect = 0`, server-tid och elevens riktiga namn. "Redo per klass"
på projektorn = antal spelare per `classId` (ev. filtrerat på färsk `lastSeenAt`;
eleven får uppdatera **bara** `lastSeenAt` som puls). Finns dokumentet redan
(omladdning) ska klienten INTE skapa om det. Läses av lärare + eleven själv.

### `liveSessions/{sid}/answers/{attemptId}` – LiveAnswer

Samma form som MathAnswer; `mode` måste vara sessionens `gameMode`, och
fälten valideras PER mode i reglerna (`liveModeAnswerOk`). Godtas bara när
`status == "live"` och `startedAt + countdown ≤ request.time < startedAt + countdown + duration`.

### `liveSessions/{sid}/counters/{classId}_{shard}` – shardad Live-klassräknare

Som `classCounters` ovan. Firestore klarar ~1 skrivning/s per dokument; 40–60
elever kan ge 20–30 rätt/s per klass → 10 shards ≈ 2–3 skrivningar/s/dok med
`increment()`. Projektorn lyssnar (`onSnapshot`) på `counters` och summerar per
klass; **matchpoäng = rätt / `classDivisors[classId]`**. Läses bara av lärare.

### gameMode-interfacet (Live)

Se API-kommentaren i `src/live/game-modes.js`: `id`, `displayName`, `icon`,
`inputMode`, `pointsPerCorrect`, `createSource()`, `checkAnswer()`,
`answerRecord()`, `statKeys()`, `statCategories`. Nytt läge = ny fil i
`src/live/modes/` + en rad i `src/live/modes/index.js` + en gren i
`liveModeAnswerOk` i `firestore.rules` (annars nekas lägets svar).

---

## Klasscentret (#476–, epic 1–4)

Spec: [`docs/spec-klasscentret.md`](spec-klasscentret.md), analys:
[`docs/klasscentret-analys.md`](klasscentret-analys.md). Allt bor under
`classCenters/{classId}` – en klass är helt oberoende av andra (100 klasser =
100 separata träd). Specens §8 (ClassProfile / ClassCenterShopItems /
ClassCenterLayout) är anpassad så här:

| Spec §8 | Här | Epic |
| --- | --- | --- |
| `classTotalExp` | summan av `expShards/{0..4}.exp` (shardad) | **1 (klar, #477)** |
| `currentCenterLevel` | **härleds** – `nivaFor(classTotalExp, classes/{id}.studentIds.length)`, lagras inte | **1 (klar, #477)** |
| "3 första gångerna"-räknare | `expMembers/{uid}.counts` (per elev och klass) | **1 (klar, #477)** |
| `trophies[]` | underkollektion `classCenters/{classId}/trophies/{typ}-{kallaId}` | **3 (kärna klar, #494)** |
| statistiktavlan (EXP, lösta uppgifter, progress) | **inget nytt dokument** – `expShards` + `classProjections/{classId}.members.*.plays` | **3 (klar, #498)** |
| ClassCenterShopItems | katalog i kod + `fund/{itemId}` + `donations/{id}` | 2/3 |
| ClassCenterLayout | `layout/current` + `layoutHistory/{0..9}` | **2 (klar, #489)** |
| lärarens "får ej inreda" | `classCenters/{classId}.inredningSparr` | **2 (klar, #489)** |

### Normalisering och nivåer (epic 1, `src/klasscenter/kc-niva.js`)

Nivå *n* kräver `ceil(TROSKLAR_PER_ELEV[n-1] × antalElever)` klass-EXP, där
`TROSKLAR_PER_ELEV = [0, 7, 17, 32, 55, 90, 141, 219, 335, 509]` (exponentiellt,
steg × 1,5, beslut 2026-10-07; motivering i filhuvudet: Nivå 10 ≈ 509
övningar/elev, med ~8/vecka hela läsåret och mer – aktiva klasser når toppen,
mindre aktiva stannar runt Nivå 7–8). Trösklarna skalas alltså med elevantalet – samma
sak som att jämföra EXP/elev, men mätaren kan visa hela klassens tal
("50 / 175 övningar till Nivå 2"). Nivån härleds alltid ur NUVARANDE elevantal:
läggs elever till kan nivån i teorin sjunka. Vill epic 1 C/D undvika det kan
ett golv `classCenters/{classId}.hogstaNiva` lagras (visa `max(härledd, golv)`).

**Så lägger du till en nivå (11, 12 …).** `NIVAER` i `src/klasscenter/kc-niva.js`
är enda sanningskällan (`KLASSCENTER_NIVAER` i `art-klasscenter.js` härleds ur
den). Det krävs bara (1) en ny post sist i `NIVAER` och (2) en ny rit-funktion
i art-modulen (MARKUP). Trösklarna räknas med formeln per index och förlängs
automatiskt; nivaFor/mätare/"Maxnivå"/preview-knappar följer listans längd.
`test/art-klasscenter.test.js` failar om en nivå saknar rit-funktion.
firestore.rules har ingen nivågräns – nivån härleds i klienten.

### `classCenters/{classId}/expShards/{0..4}` – Klass-EXP (epic 1)

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `exp` | number | shardens del av klassens EXP (bara uppåt) |
| `lastUid` | string | senaste skribent (elev-uid eller lärarens uid) |
| `lastAt` | timestamp | serverns tid för senaste ökningen |
| `lastKalla` | string ≤ 40 | regelmodul/bonuskälla ("quiz", "live" …) |

Läses av **alla inloggade** (mätaren syns även för gäster). Skrivs bara via
`increment`: elev (klassmedlem) +1..+3 i samma batch som den egna
`expMembers`-posten, lärare +1..+1000 (klassbonus). Radera = lärare (nollställ).

### `classCenters/{classId}/expMembers/{uid}` – elevens bidrag (epic 1)

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `uid` | string | elevens uid (= dok-id) |
| `exp` | number | elevens totala bidrag till klassen |
| `counts` | map | regelräknare, t.ex. `{"memory\|vikingar": 3, "rakna\|ratt": 7}` |
| `lastAt` | timestamp | serverns tid för senaste utdelningen (takt-spärr 15 s) |
| `lastAmount` | number | senaste ökningen (1–3) – måste = shardens ökning |
| `lastShard` | number | vilken shard senaste ökningen gick till |
| `lastKalla` | string | senaste regelmodul |

Läses bara av eleven själv och lärare (ingen topplista mellan elever). Elevens
egna framsteg (`studentData.progress/xp/coins`) rörs **inte** av Klass-EXP.

**Regler (firestore.rules "KLASSCENTRET")**: shard +n kräver att samma batch
ökar `expMembers/{egen uid}.exp` med `lastAmount == n` och `lastShard ==
shard` (getAfter), 1 ≤ n ≤ 3, `lastAt == request.time` och minst 15 s sedan
förra utdelningen. `counts` får sparas separat (utan EXP). Kvarvarande
begränsning: spelresultaten räknas i klienten (som coins/framsteg i dag), så en
skriptande elev kan ge ≤ 3 EXP/15 s – spårbart per elev i `expMembers`.

**Regelregistret** (`src/klasscenter/kc-exp-regler.js`): quiz/läsförståelse
≥ 50 % rätt = 1 varje omgång; para/memory/kunskapsjakt/sanningsjakt/lastext/
äventyr = 1 de 3 första gångerna per område; Läsresan ≥ 5/7 = 1; Mattematchen
var 20:e rätt = 1; Räkna 10 rätt = 1 (rest sparas i `counts`); Live/klass-
utmaningar = lärarbonus `klassBonusFor(kalla, elevantal)` (t.ex. Live 3/elev).
En elev i flera klasser ger EXP till varje klass (räknas i varje klass elevantal).

### `classCenters/{classId}` – klassprofil (epic 2–4)

| Fält | Typ | Epic | Beskrivning |
| --- | --- | --- | --- |
| `inredningSparr` | array | **2 (klar, #489)** | uid:n som läraren bockat ur – får titta/donera men inte spara layout (≤ 200, `setInredningSparr`) |
| `hogstaNiva` | number | 1 C/D (valfri) | golv så nivån inte sjunker när elevantalet växer |

Läses av klassens elever och lärare (#500 – spärrlistan visar vilka elever
som bockats ur; gästläget behöver den inte). Skrivs bara av lärare.
**Regler (#489):** bara `inredningSparr` får skrivas (lärare, lista ≤ 200).
Pokalerna bor INTE här utan i underkollektionen `trophies/` (#494, nedan) –
profilens `changedOnly`-lista är oförändrad. Elever kan inte skriva dokumentet
alls (inte ens ta bort sig själva ur spärren).

### Pokaler (epic 3, #494)

Register (rent): `src/klasscenter/kc-pokal-typer.js`; Firestore (bara
dynamiskt): `src/klasscenter/kc-pokal-data.js` – `delaUtPokal(classId, typ,
kallaId, detalj?)`, `delaUtPokalerFor(kalla, kallaId, kallaDoc)`,
`hamtaPokaler(classId)` (EN query), `bevakaPokaler(classId, cb)`,
`pokalTooltip(pokal)`.

**Typer** (`registreraPokaltyp({ id, kalla, titel, text, art, tooltip?,
vinnare(kallaDoc), detaljFran? })`):

| `typ` | Källa (`kallaId`) | Delas ut till | Tooltip |
| --- | --- | --- | --- |
| `mm-klasskamp` | `mathCompetitions/{cid}` | `result.winnerClass` + alla i `result.winnerClasses` när `status == "finished"` | "Vinnare av Mattematchen! Klassen kämpade stenhårt tillsammans." |
| `live-vinst` | `liveSessions/{sid}` | TÄVLINGSLÄGE: `result.winner` (inte `"draw"`, inte `result.cooperative`) med ≥ 1 spelare | "Klassen vann Live-matchen! …" |
| `live-avklarat` | `liveSessions/{sid}` | KOOPERATIVT läge med `result.goalReached == true`: varje deltagande klass med `result.perClass[klass].players > 0` | "Klassen klarade ett Liveläge tillsammans!" |

**Beslut (#495):**
- **Oavgjort i Klasskampen = alla delade vinnare får pokalen** (samma
  poäng/elev på förstaplatsen, `winnerClasses`). Äldre `result` utan fältet →
  bara `winnerClass`. Ingen klass med rätt svar → ingen pokal.
- **Oavgjort i Live (`"draw"`) = ingen `live-vinst`** (oförändrat från #494).
- **`live-avklarat` bara i kooperativa lägen** där målet nåddes – ett vanligt
  tävlingsläge ger bara vinnaren en pokal (inte en "deltagarpokal" per match).
  I dag finns bara tävlingsläget `multiplication_0_10` → `live-avklarat` delas
  inte ut förrän ett läge med `cooperative: true` + `goalReached()` registreras
  (`src/live/game-modes.js`). Klassbonusen `"live"` (EXP) är oförändrad.

**Utdelningen (#495)** görs av lärarklienten som skrev källans `result`,
EFTER skrivningen (reglerna verifierar med `getAfter`), via dynamisk import
`kc-koppling.js pokalerEfterAvslut(kalla, kallaId, kallaDoc)` → fire-and-
forget, aldrig kastande (ett pokalfel stör aldrig avslutet):
- Mattematchen: `mm-teacher-data.js` `finishCompetition` + `archiveIfEnded`.
- Live: `live-data.js` `writeResultIfMissing` (bara klienten vars transaktion
  skrev `result`, samma ställe som `liveKlassBonus`).
Misslyckas utdelningen (nät/regler) görs inget nytt försök automatiskt –
`archiveIfEnded` gör inget när `result` redan finns.

#### `classCenters/{classId}/trophies/{typ}-{kallaId}`

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `typ` | string | pokaltypens id (se tabellen) |
| `kallaId` | string | källans dokument-id (tävling/session), `[A-Za-z0-9_-]{1,100}` |
| `titel` | string 1–80 | typens rubrik vid utdelningen ("Mattematchens mästare") |
| `detalj` | string ≤ 120 (valfri) | källans namn ("Mattematchen oktober 2026") |
| `wonAt` | timestamp | serverns tid vid utdelningen |
| `awardedBy` | string | lärarens uid |

**Idempotent:** dokument-id = `"<typ>-<kallaId>"` (t.ex. `mm-klasskamp-<cid>`,
`live-vinst-<sid>`) → samma vinst ger alltid samma dokument. `delaUtPokal` är
EN transaktion: finns dokumentet → `ny: false`, inget skrivs; annars create.
Flera lärarklienter samtidigt (projektor + historikvy) ger en enda pokal.

**Regler (firestore.rules "Pokaler")**: läses av alla inloggade. Create bara
av lärare (teacher-claim), aldrig update/delete. Fälten exakt enligt tabellen,
`wonAt == request.time`, `awardedBy == auth.uid`, id == `typ + "-" + kallaId`,
`typ` i `kcPokalTyper()`, och källan verifieras med `getAfter` (även när
pokalen skrivs i samma batch som `result`): status `finished` + vinnaren/
deltagandet enligt tabellen ovan. Elever kan inte skapa/ändra pokaler alls.
⚠️ Ny typ = `registreraPokaltyp` + typen i `kcPokalTyper()` + en gren i
`kcPokalVerifierad` (`test/kc-pokal-typer.test.js` failar om de glider isär)
+ rules-deploy. Tester: `test/kc-pokal-typer.test.js`,
`test/firestore-rules-klasscenter-pokal.test.js`.
⚠️ DEPLOY KRÄVS: `firebase deploy --only firestore:rules` innan pokaler kan
delas ut live.

### Statistiktavlan (epic 3, #498)

En **fast möbel** i rummet (som pokalhyllan): inte köpbar, inte flyttbar, finns
i varje klass rum (även för gäster). Klick/tryck/Enter öppnar panelen
"Klassens statistik" (✕/Escape stänger, fokus tillbaka till tavlan). Siffrorna
står även direkt på tavlan. Kod: `src/klasscenter/kc-statistik.js` (rent),
`kc-statistik-data.js` + `kc-rum-statistik.js` (bara dynamiskt).

| Visas | Källa | Läsning |
| --- | --- | --- |
| Klassens totala EXP | summan av `expShards/{0..4}.exp` (`subscribeClassExp`, realtid) | ≤ 5 dok |
| Lösta uppgifter tillsammans | summan av `classProjections/{classId}.members.{uid}.plays` för klassens nuvarande `studentIds` | 1 dok (+ cachad `classes`) |
| Progress till nästa nivå | `progressTillNasta(exp, antalElever)` – nivå X → X+1, stapel + "50 / 175 EXP · 125 kvar"; högsta nivån → full stapel + "högsta nivån är nådd" | – |

**Varför ingen ny räknare (val b i #498):** elevernas `progress[area][mode].plays`
(höjs av `awardExercise` vid varje avklarad omgång) speglas redan in i klass-
projektionen vid varje belöning (`awardProjectionPatch` → `plays`, och self-heal
via `projectionEntryFrom`). Alltså: noll nya skrivningar, inga regeländringar och
O(1) läsning per klass. **Historiken finns från start:** en projektions-entry
skriven före #498 saknar `plays` → `completed` (antal avklarade övningar) räknas
som golv tills eleven spelar nästa gång. "Lösta uppgifter" = avklarade omgångar i
övningslägena (quiz, memory, para, räkna, äventyr …) – Läsresan, Mattematchen och
Live räknas inte där (de har egna aggregat) men ger klass-EXP. Projektionen är
klassmedlems-skrivbar som förut (#231) – samma förtroendenivå som byns
"övningar klarade"; `plays` ger ingen EXP och ingen nivå.

### Crowdfunding (epic 2, #486)

**Katalogen** ligger i kod: `src/klasscenter/kc-shop-items.js` (dynamisk –
`shop-items.js` är 400/400 rader och i bootgrafen). Åtta föremål `{ id, namn,
emoji, targetPrice, zon, storlek, art }`: klassfana 2000, troféhylla 2500,
lounge 3000, akvarium 4000, guldstaty 5000, flygel 6000, fontän 8000,
kristallkrona 10000. `zon` = `"golv"` | `"vagg"` (upphängt), `storlek` =
`{ w, h }` i procent av scenen, `art` = rit-nyckel (konsten: sub-issue B).
⚠️ `firestore.rules` (`kcPris`) har en kopia av id → pris; nytt föremål =
rad i båda + rules-deploy (`test/kc-fund-plan.test.js` failar om de glider isär).
Ändra aldrig priset på ett befintligt id (fund-dokumentet låser priset).

#### `classCenters/{classId}/fund/{itemId}`

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `targetPrice` | int | = katalogpriset, låst från första donationen |
| `fundedAmount` | int | insamlat, 0 < … ≤ `targetPrice` |
| `isUnlocked` | bool | `fundedAmount == targetPrice` (köpt) |
| `unlockedAt` | timestamp | serverns tid när målet nåddes (bara när köpt) |
| `lastDonationId` | string | donationsposten som skrevs i samma batch |

Läses av alla inloggade (realtid "150 / 5000"). Dokumentet skapas vid första
donationen – saknat dokument = 0 insamlat (`normaliseraFunds`).

#### `classCenters/{classId}/donations/{autoId}`

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `uid` | string | donerande elev (= `auth.uid`) |
| `itemId` | string | föremålet |
| `amount` | int ≥ 1 | det faktiskt dragna (cappade) beloppet |
| `at` | timestamp | serverns tid |

Create-only (ingen ändring/radering, inte ens lärare → insamlat == summan
av posterna). **Läses bara av lärare** – för klassen är donationerna anonyma
(BESLUT, bara totalsumman syns). Återanvänd INTE `classProjects` (#331): dess
`contributions.{uid}` är läsbart för alla inloggade.

**Donationen** (`korDonation` i `src/klasscenter/kc-fund-plan.js`, via
`donate(classId, itemId, amount)` i den dynamiska `kc-fund-data.js`): läs
`fund` + `studentData.coins` från servern → `planDonation` cappar beloppet
till min(begärt, det som saknas, saldot) (heltal ≥ 1; överskottet dras aldrig)
→ EN atomär batch: `coins` = `increment(−n)` + `kcDonation` =
`"<classId>/<donationId>"` (#500), ny donationspost, `fund` med
`fundedAmount` = `increment(+n)` (#493). Ingen transaktion: med en hel klass
samma sekund köade transaktionerna på `fund`-låset och gav upp. Relativa
värden räknas av reglerna mot det AKTUELLA läget → samtidiga givare under
målet går alla igenom direkt. Hann någon före så att cappningen/`isUnlocked`
inte längre stämmer nekar reglerna (`permission-denied`), och
`kc-omforsok.js` läser om och cappar om (upp till 10 försök, exponentiell
backoff med jitter; målet nått → `redan-kopt`, inget dras). Nekas ett
försök och nästa läser exakt samma läge är det ett verkligt nej (t.ex. ej
klassmedlem) → slutar direkt. Fel: `redan-kopt`, `for-lite-mynt`,
`ogiltigt-belopp`, `okant-foremal`, `nekad`.

**Regler (firestore.rules "KLASSCENTRET")**: `fund` skrivs bara av
klassmedlem och bara ihop med en NY donationspost (`lastDonationId` byts,
`!exists` före + `getAfter` efter): `fundedAmount` ökar exakt postens
`amount`, aldrig över `targetPrice` (== `kcPris`, oförändrat),
`isUnlocked == (fundedAmount == targetPrice)`, `unlockedAt == request.time`
när köpt, och ingenting alls när `isUnlocked` redan är sant. Donationsposten:
egen uid, klassmedlem, `amount` heltal ≥ 1, `at == request.time`, fundens
`lastDonationId` pekar på posten och samma skrivning sänker
`studentData/{uid}.coins` med exakt `amount` (≥ 0 kvar) och sätter
`studentData/{uid}.kcDonation == "<classId>/<donationId>"` – ett avdrag kan
bara betala EN donation (#500: utan markören delade flera donationer i samma
batch på ett avdrag). Annan klass/icke-medlem nekas (`isClassMember`).
Säkerhetsgranskningen: `docs/SAKERHET-klasscentret.md`.
**Kvarvarande begränsning:** `studentData.coins` är klient-skrivbart
(`isSelf`, utan fältvalidering) → reglerna garanterar *insamlat == summan av
donationerna* och att saldot sjunker lika mycket i samma skrivning, inte att
eleven "förtjänat" mynten.

**Klassens möbellåda** härleds: `unlockedItems(funds)` = katalogföremålen vars
`fund` har `isUnlocked` (inget eget dokument).

**Shoppens flik "🏛️ Klasscentrum"** (#488): `pages-shop.js` har bara fliken +
`import("./klasscenter/kc-shop-vy.js")`; vyn (+ `kc-shop-kort.js`, `kc-shop-vy.css`)
prenumererar med `subscribeFunds` och stänger den vid flik-/sidbyte. "Du har
bidragit med X" räknas lokalt i `localStorage` (`pp:kc:bidrag:<uid>:<classId>`,
per enhet) – inga andras uid läses. QA: `admin/qa-klasscentrum-shop.mjs`.
⚠️ DEPLOY KRÄVS: `firebase deploy --only firestore:rules` innan donationer
fungerar live.

### Gemensam layout + historik (epic 2, #489)

Ren logik + skrivplan: `src/klasscenter/kc-layout-plan.js`; Firestore (bara
dynamiskt): `src/klasscenter/kc-layout-data.js` – `subscribeLayout`,
`getLayout`, `saveLayout`, `listHistory`, `restoreLayout`, `kanInreda`,
`getInredningSparr`, `setInredningSparr`.

#### `classCenters/{classId}/layout/current`

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `placedItems` | map | `{ "<itemId>" \| "pokal-<trophyId>": { x, y, z } }` – x/y tal 0–100 (procent av scenen, som `studentData.room.placements`), `z` heltal 0–999 (ritordning, högre = framför). Högst 16 poster: 8 katalogföremål + högst 8 **flyttade** pokaler (#497). Pokaler som ingen flyttat sparas inte – de auto-placeras på pokalhyllan (äldst först) av `kc-pokal-placering.js`. |
| `version` | int | 1, 2, 3 … (+1 per sparning; saknat dokument = version 0) |
| `updatedBy` | string | den som sparade (= `auth.uid`, elev eller lärare) |
| `updatedAt` | timestamp | serverns tid |

#### `classCenters/{classId}/layoutHistory/{0..9}`

| Fält | Typ | Beskrivning |
| --- | --- | --- |
| `placedItems` | map | samma layout som `current` fick i den sparningen |
| `version` | int | versionen; dokument-id = `version % 10` |
| `savedBy` | string | den som sparade |
| `savedAt` | timestamp | serverns tid |

**Ringbuffert:** varje "Spara" = EN transaktion (`korSparning`) som läser
`current` och skriver `current` (version + 1) och slot `version % 10` – alltid
de 10 senaste, inga raderingar (version 11 skriver över slot 1, version 20
slot 0). **"Återställ"** (`restoreLayout(classId, slot, { historikVersion })`)
läser sloten i samma transaktion och skriver den som en NY version
(`historikVersion` = versionen som listan visade; har ringbufferten skrivit
över sloten sedan dess → `historik-andrad`, inget skrivs, listan laddas om –
#493) → återställningen hamnar
själv i historiken och kan ångras. Föremål som inte finns i möbellådan tas
bort vid återställning. Båda skrivningarna är `set` UTAN merge – annars
slår Firestore ihop den nästlade `placedItems`-kartan med den gamla.

**Samtidighet (BESLUT: senaste vinner, med historik):** sparar två samtidigt
körs den ena transaktionen om med färska värden (även när reglerna svarar
`permission-denied` i stället för en vanlig krock – upp till 8 försök via
`kc-omforsok.js`; oförändrad version + nekad = verkligt nej, slutar direkt) → två
hela versioner i följd, båda i historiken, den senaste syns. Aldrig en
blandad layout (hela kartan ersätts, reglerna kräver version = gammal + 1).
Vill rum-UI:t (sub-issue E) hellre varna skickas `{ forvantadVersion }` (den
version som visades) → `kod: "krock"` ("Någon annan sparade nyss – laddar
om rummet.") och ingenting skrivs.

**Möbellådan:** klienten (`validatePlacedItems`) godtar bara nycklar som finns
i `unlockedItems(getFunds(classId))`; okänd/ej upplåst/fel form → Fel med
`kod` (`okant-foremal`, `ej-i-ladan`, `ogiltig-position`, `for-manga`,
`ogiltig-form`), positionen klamras. `"<itemId>#<n>"` (extra exemplar, som
rummet) stöds i planmodulen, men crowdfunding ger ett exemplar per föremål
och reglerna godtar bara katalog-id:n – flera exemplar kräver regeländring.

**Regler (firestore.rules "KLASSCENTRET" → layout):** läses av alla inloggade
(gästläge §7). Skrivs av lärare (`isTeacher`, som övriga lärarregler – det
finns ingen lärare↔klass-koppling i dag), eller klassmedlem
(`isClassMember`) som inte står i `inredningSparr`. `current`: bara de fyra
fälten, `version == gammal + 1` (create: 1), `updatedBy == auth.uid`,
`updatedAt == request.time`, och `getAfter(layoutHistory/{version % 10})` har
samma `version`/`placedItems`/skribent/tid. Historikslot: id ∈ 0..9 ==
`version % 10`, och `getAfter(current)` har just den versionen skriven nu
(`updatedAt == request.time`) → en slot kan aldrig skrivas ensam.
`placedItems`: nycklar ⊆ `kcKatalog` (samma karta som `kcPris`) plus högst 8
`pokal-<typ>-<kallaId>` (typ ∈ `kcPokalTyper`, EN regex över de joinade
nycklarna; att pokalen finns kontrolleras inte – budget), ≤ 16 poster, varje
post exakt `{x, y, z}` med intervallen ovan (`kcPosOk` per index i
`values()` – `test/kc-layout-plan.test.js` failar om taket och raderna glider
isär). 🔴 Reglernas tak är 1000 uttryck per skrivning: den gamla kontrollen
nekade redan ett rum med alla 8 föremål (#497 fixade, mätt i emulatorn). Att föremålet är
*upplåst* kollas bara i klienten (reglerna kan inte loopa över `fund`) – en
fuskande elev kan som mest ställa en ej köpt möbel i rummet. Radera = lärare.
Tester: `test/kc-layout-plan.test.js`, `test/firestore-rules-klasscenter-layout.test.js`.
⚠️ DEPLOY KRÄVS: `firebase deploy --only firestore:rules` (layout + klassprofilen).

---

## Datamodulens API (`src/data.js`)

Övriga delar återanvänder dessa funktioner:

**Session / inloggning**
- `login(username, password, remember)` → `{ ok, student }` eller `{ ok:false, error }`
  (`remember=true` sparar sessionen i `localStorage`, annars i `sessionStorage`)
- `logout()`, `isLoggedIn()`, `getSession()`, `currentStudentId()`

**Coins**
- `getCoins()`, `addCoins(n)` → nytt saldo (coins dras via `buyItem`, se Shop nedan)

**XP / nivå** – Firestore-delen i systermodulen [`src/data-xp.js`](../src/data-xp.js) (som `data-pet.js`)
- `getXp()` → elevens samlade XP; `addXp(n)` → nytt totalt XP (transaktion, samma
  mönster som `addCoins`; migrerar automatiskt elever utan `xp`-fält ur `progress`).
- XP delas ut i `awardExercise()` (`src/game-shared.js`): full pott första gången en
  övning klaras, 80 % vid omspel (medvetet produktbeslut, som coins).
- Nivåkurvan (obegränsad, stigande) + XP-potten per övning ligger i
  [`src/leveling.js`](../src/leveling.js): `xpForLevel(L)`, `levelForXp(xp)`,
  `xpIntoLevel(xp)` → `{ level, intoLevel, neededForNext, progressRatio }`,
  `xpForExercise(stars)`, `XP_BASE`/`XP_PER_STAR` (justerbar balans, kommenterad tabell).

**Framsteg**
- `getProgress()`, `saveProgress(areaId, gamemode, result)`

**Shop / ägda saker**
- `buyItem(itemId, price)` → `{ ok, coins, owned, counts }` (ägda saker läses via `getStudentData().ownedItems`/`ownedCounts`)
  (`buyItem` drar coins och lägger till saken i **en** transaktion – ingen täckning
  → `ok:false`, inga negativa saldon. **Single-saker**: redan ägd = no-op. **Multi-saker**
  (möbler/dekor): varje köp ökar `ownedCounts[id]` med 1 så flera exemplar kan ägas.)
- `ownedCount(data, id)` – antal ägda exemplar av en sak (multi-medveten, bakåtkompat: id i `ownedItems` = 1).
- Katalogen (kategorier, priser, emoji) ligger i [`src/shop-items.js`](../src/shop-items.js).

**Avatar-påklädnad**
- `getAvatarItems()`, `saveAvatarItems(itemIds)` – vilka klädsaker som bärs på avataren.
  Rendera avataren med `avatarMarkup(avatarId, itemIds)` från `src/avatars.js`.

**Rum**
- `getRoom()`, `saveRoom(room)` – **grundrummet (rum 0)**. `room = { placements: { [key]: { x, y } }, paletteId, window }` (`key` = sak-id eller `"<id>#<n>"` för extra exemplar),
  där `x`/`y` är procent (0–100) så rummet ser likadant ut på alla skärmar.
  `saveRoom` skriver varje angivet fält med dot-path (`room.placements` osv.) –
  utelämnade fält (t.ex. `paletteId`) lämnas orörda. Paletterna för hus & väggar
  ligger i `src/room-palettes.js`; golvet färgas aldrig om.
- **Fler rum** (husuppgradering): `getRoomCount(sd)` = `1 + roomUpgradeCount(sd.ownedItems)`;
  `getRooms(sd)` → 0-indexerad lista `[rum0, rum1, …]` (rena hjälpare, ingen Firestore).
  `saveRoomAt(index, partial)` skriver rum `index`: `index 0` → `room.*` (som `saveRoom`),
  `index ≥ 1` → `extraRooms.<index-1>.*`. Bakåtkompatibelt: enrums-hus (bara `room`,
  inga rums-uppgraderingar) ger `getRoomCount = 1` och fungerar oförändrat.
  Husdjur/mat hör bara till rum 0; extra rum = möbler + väggfärg + fönster.

**Trädgård (utomhussaker)**
- `getGardenFrom(sd)` – ren hjälpare: `{ placements: { [key]: { x, y } } }` ur `sd.garden`
  (saknas fältet → tom trädgård). `getGarden()` = async läsning.
  `saveGarden(partial)` skriver varje fält med dot-path (`garden.placements`) precis
  som `saveRoom`. Placering/rendering i `src/varld-tradgard.js` (ute-scenen); ägande
  via `ownedItems`/`ownedCounts` (kategori `tradgard`, flera exemplar tillåtna).

**Avatar**
- `getAvatar()`, `setAvatar(avatarId)`, `hasChosenAvatar()`

**Karaktärs-evolution (Pokémon-stil) – vilande**
- Ingen evolution persisteras eller renderas i dag: avataren ritas alltid i sitt
  basutseende (steg 1). Det tidigare `evolution`-fältet i `studentData` och
  funktionerna `getEvolution`/`setEvolutionChoice` är **borttagna** (var död kod –
  se issue #49); den planerade `src/evolution.js` skapades aldrig.
- Konsten per steg finns dock kvar som vilande kapacitet: `characterSvg(id, { stage, branch })`
  kan rita högre steg, registret `EVOLUTIONS` i `src/art-characters.js` och robotens
  stegkonst i `src/art-characters-robot.js`. Utan `evo`-argument (som i dag) blir det steg 1.
**Husdjur (mystery eggs, flera per elev)** – ligger i systermodulen [`src/data-pet.js`](../src/data-pet.js)
- `buyEgg(price)` → `{ ok, coins, pets }` – transaktion som drar coins och lägger
  ett **nytt** ägg i `pets[]` (kan köpas flera gånger; hamnar inte i `ownedItems`)
- `buyHeatLamp(price)` → `{ ok, coins, owned, pets }` – lägger lampan i
  `ownedItems` och sätter `hasHeatLamp` på alla okläckta ägg
- `getPets()` → `pets[]` (migrerar ett ev. äldre `studentData.pet` först)
- `hatchReadyPets()` → `{ pets, justHatchedIds }` – kläcker alla ägg vars kläcktid passerats
- `buyApple(price)` → `{ ok, coins, appleCount }` – köp ett äpple (förbrukningsvara)
- `placeApple(x, y)` → `{ ok, appleCount, floorApples, apple }` – lägg ett äpple på golvet
- `eatApple(petId, appleId)` → `{ ok, pet, pets, floorApples, stageUp }` – djur äter äpple, `feedCount++`
- `setPetName(petId, name)` / `savePetPositions({ [petId]: { x, y } })`
- Hjälpare: `hatchTimeFor(pet, hasLamp)`, `isHungry(pet)`, `isFullGrown(pet)`, `stageForFeeds(n)`, `feedsToNextStage(n)`, `cleanPetName(s)`

**Gården** – Firestore-delen i systermodulen [`src/data-farm.js`](../src/data-farm.js), ren kärna i [`src/farm-core.js`](../src/farm-core.js) (se `studentData.farm` ovan)
- `getFarm()` → komplett `farm`-objekt (gamla dokument utan fältet → default)
- `plantCrop(slotIndex, cropId)` / `advanceCropGrowth(slotIndex, steps?)` /
  `harvestCrop(slotIndex)` → `{ ok, farm, ... }` – så/väx/skörda (transaktioner)
- `adjustHarvestInventory(cropId, delta)` → `{ ok, farm, count }` – förbruka/justera skörd
- `setAnimalPlacement(petId, "room"|"paddock"|"barn")` – flytta ett djur
- `setBarnLevel(n)` / `setGardenTier(n)` – rå nivå-skrivning (köpet bor i uppgraderings-issuen; nivån kan aldrig sänkas)
- Rena hjälpare/konstanter (re-exporterade via `data.js`): `farmFromData(sd)`, `slotCountForTier(tier)`, `cropInSlot(farm, i)`, `placementFor(farm, petId)`, `FARM_MAX_GROWTH_STAGE` m.fl.

**Statistik (profil)**
- `getStats()` → `{ coins, playedExercises, completed, stars, areas }`

**Innehåll**
- `getSubjects()`, `getAreas(subjectId)`, `getArea(subjectId, areaId)`

**Elevkonton (lärarsida)**
- `getStudents()`, `upsertStudent(id, {namn, username, password, avatarId})`

**Klasser (lärarsida)**
- `getClasses()`, `upsertClass(id, {name, order})`, `deleteClass(id)`,
  `setClassStudents(id, studentIds)` – `upsertClass` skriver med merge så
  `studentIds` bevaras vid namnbyte; `setClassStudents` ersätter hela listan
  **och** synkar medlemmarnas `students/{id}.classIds` (arrayUnion/arrayRemove)
  i samma batch; `deleteClass` städar bort klass-id:t ur medlemmarnas `classIds`.
- `getStudent(id)` (ett elevkonto), `getStudentsByIds(ids)` (flera per dokument –
  klassbyn läser sig själv + kamrater, aldrig hela kollektionen).

**Tilldelade arbetsområden per klass**
- `setClassAssignments(id, assignments)` – ersätter `assignedAreas`
  (`assignments = [{ subjectId, areaId }]`; tom lista = eleverna ser allt).
- `getClassAssignments(id)` → `[{ subjectId, areaId }]`.
- `getClassForStudent(studentId?)` → klassdokumentet eleven tillhör (eller `null`),
  hittas via klassernas `studentIds`. Används av elevens Plugga-vy för att
  filtrera på `assignedAreas`.

**Gemensamma klassprojekt (#331, scaffold – ingen UI ännu)** – se
`classProjects/{classId}` ovan; Firestore-delen i `src/data-classes.js`
- `getClassProjects(classId)` → map byggnads-id → normaliserat projekt (tom map om inga).
- `getClassProject(classId, buildingId)` → projektet eller `null`.
- `startClassProject(classId, buildingId, goalAmount)` → `{ ok, project }` – startar
  (eller justerar målet för) ett projekt; skriver bara det egna projektets fält.
- `donateToClassProject(classId, buildingId, amount)` → `{ ok, coins, project }` –
  transaktion som drar elevens coins och ökar `collected` + `contributions.{studentId}`;
  ingen täckning/fullt projekt/överdonation → `ok:false` utan skrivning.

De flesta funktioner använder den inloggade eleven automatiskt, men tar ett
valfritt sista `studentId`-argument.

---

## Säkerhetsregler

Se [`firestore.rules`](../firestore.rules). Reglerna är medvetet öppna för
`subjects`, `students` och `studentData` (läs + skriv) eftersom det rör sig om
skolklassbruk utan riktig autentisering. Allt annat nekas. Detta är **inte**
vattentätt men blockerar inte legitim användning – vilket är kravet.
