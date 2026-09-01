# Datamodell – Pluggportalen (Firestore)

Detta dokument beskriver Firestore-databasen. **Övriga delar av projektet
(gamemodes, shop, elevrum, lärarsida) bygger på den här modellen** – ändra med
eftertanke.

All åtkomst går genom datamodulen [`src/data.js`](../src/data.js). Bygg inte
egna Firestore-anrop i andra filer – använd modulens funktioner.

## Översikt av collections

```
subjects/{subjectId}                     ← ämne (t.ex. "so")
subjects/{subjectId}/areas/{areaId}      ← arbetsområde (t.ex. "vikingatiden")
students/{studentId}                     ← elevkonto (inloggning)
studentData/{studentId}                  ← elevens speldata (coins, framsteg, ...)
classes/{classId}                        ← klass (lärarens gruppering, t.ex. "6A")
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
| `texts`       | array\<Text\>  | Faktatexter för läsförståelse            |
| `quiz`        | array\<Quiz\>  | Quizfrågor (flerval)                     |
| `pairs`       | array\<Pair\>  | Fakta-par (begrepp ↔ förklaring)         |

**Text**: `{ id, title, body }`

**Quiz**: `{ id, question, options: string[], answerIndex, explanation }`
– `answerIndex` är index (0-baserat) i `options` för rätt svar.

**Pair**: `{ id, term, definition }` – används för para ihop / memory.

Exempel (`subjects/so/areas/vikingatiden`, förkortat):

```json
{
  "name": "Vikingatiden",
  "order": 1,
  "coverEmoji": "🛶",
  "description": "Lär dig om vikingarna – hur de levde, reste och trodde.",
  "texts": [
    { "id": "vem-var-vikingarna", "title": "Vilka var vikingarna?", "body": "Vikingarna levde ..." }
  ],
  "quiz": [
    { "id": "q1", "question": "Ungefär när levde vikingarna?",
      "options": ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"],
      "answerIndex": 0, "explanation": "Vikingatiden räknas från ca 800 till 1050." }
  ],
  "pairs": [
    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig" }
  ]
}
```

---

## `students/{studentId}` – elevkonto

Enkel inloggning (skolbruk, **ej säkerhetskritiskt** – lösenord i klartext).

| Fält       | Typ    | Beskrivning                                  |
| ---------- | ------ | -------------------------------------------- |
| `namn`     | string | Elevens namn (visas i appen)                 |
| `username` | string | Användarnamn, gemener (används vid login)    |
| `password` | string | Lösenord i klartext                          |
| `avatarId` | string | Vald avatar (se `AVATARS` i `src/avatars.js`)|

Exempel (`students/elev1`):

```json
{ "namn": "Astrid", "username": "elev1", "password": "passa123", "avatarId": "fox" }
```

---

## `studentData/{studentId}` – elevens speldata

| Fält         | Typ    | Beskrivning                                            |
| ------------ | ------ | ------------------------------------------------------ |
| `coins`      | number | Antal pluggcoins                                       |
| `progress`   | map    | Framsteg: `{ [areaId]: { [gamemode]: {...} } }`        |
| `ownedItems` | array  | Id:n på köpta shop-saker (se `src/shop-items.js`)      |
| `avatarItems`| array  | Id:n på klädsaker eleven bär på avataren (delmängd av `ownedItems`) |
| `room`       | map    | `{ placements: { [itemId]: { x, y } } }` – `x`/`y` i **procent** (0–100) av rummet |
| `avatarId`   | string | Vald avatar (spegel av `students`)                     |
| `avatarChosen` | bool | `true` när eleven själv valt grundavatar (styr avatarvalet vid första inloggning) |
| `pet`        | map    | Kläckbara husdjuret (mystery egg) – se nedan. Saknas tills eleven köpt ägget/värmelampan |

### `studentData.pet` – kläckbara husdjuret

Skapas när eleven köper det mystiska ägget (eller värmelampan) i shoppen.
Tidsstämplar är **millisekunder** (`Date.now()`); kläckning och tillväxt räknas
ut **vid inläsning** – ingen bakgrundsprocess. Husdjuret kan aldrig dö.

| Fält          | Typ         | Beskrivning                                              |
| ------------- | ----------- | -------------------------------------------------------- |
| `eggBoughtAt` | number      | När ägget köptes (ms). Kläcks ~3 dagar senare            |
| `hasHeatLamp` | bool        | Värmelampa köpt → ägget kläcks på **halva** tiden        |
| `speciesId`   | string/null | Slumpad art vid kläckning (se `SPECIES` i `src/art-pets-creatures.js`) |
| `hatchedAt`   | number/null | När ägget kläcktes (ms); `null` = ruvar fortfarande      |
| `stage`       | number      | Tillväxtsteg 1–3 (0 = okläckt ägg). Härleds ur `feedCount` |
| `feedCount`   | number      | Antal matningar totalt (styr steget: ≥3 → steg 2, ≥7 → steg 3) |
| `lastFedAt`   | number/null | Senaste matningen (ms) – max 1 matning per kalenderdag   |

```json
{
  "eggBoughtAt": 1756700000000, "hasHeatLamp": true,
  "speciesId": "blomp", "hatchedAt": 1756830000000,
  "stage": 2, "feedCount": 4, "lastFedAt": 1757000000000
}
```

`progress`-resultat per gamemode: `{ completed, bestScore, stars, lastPlayed }`.
`gamemode` är en sträng, förslagsvis `"quiz"`, `"lasforstaelse"`, `"para"`.

Exempel (`studentData/elev1`):

```json
{
  "coins": 40,
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

**Assignment**: `{ subjectId, areaId }` – pekar på ett `subjects/{subjectId}/areas/{areaId}`.

`assignedAreas` styr elevens Plugga-vy: läraren väljer vilka arbetsområden som
är **aktiva nu** för klassen. Har klassen en icke-tom lista ser eleverna i
klassen **bara** de områdena; är listan tom eller saknas (eller tillhör eleven
ingen klass) ser eleverna **hela** biblioteket (bakåtkompatibelt – aldrig en tom
sida).

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

## Datamodulens API (`src/data.js`)

Övriga delar återanvänder dessa funktioner:

**Session / inloggning**
- `login(username, password, remember)` → `{ ok, student }` eller `{ ok:false, error }`
  (`remember=true` sparar sessionen i `localStorage`, annars i `sessionStorage`)
- `logout()`, `isLoggedIn()`, `getSession()`, `currentStudentId()`

**Coins**
- `getCoins()`, `addCoins(n)`, `spendCoins(n)` → `{ ok, coins }`

**Framsteg**
- `getProgress()`, `saveProgress(areaId, gamemode, result)`

**Shop / ägda saker**
- `getOwnedItems()`, `addOwnedItem(itemId)`, `buyItem(itemId, price)` → `{ ok, coins, owned }`
  (`buyItem` drar coins och lägger till saken i **en** transaktion – ingen täckning
  eller redan ägd sak → `ok:false`, inga negativa saldon eller dubbelköp)
- Katalogen (kategorier, priser, emoji) ligger i [`src/shop-items.js`](../src/shop-items.js).

**Avatar-påklädnad**
- `getAvatarItems()`, `saveAvatarItems(itemIds)` – vilka klädsaker som bärs på avataren.
  Rendera avataren med `avatarMarkup(avatarId, itemIds)` från `src/avatars.js`.

**Rum**
- `getRoom()`, `saveRoom(room)` – `room = { placements: { [itemId]: { x, y } } }`,
  där `x`/`y` är procent (0–100) så rummet ser likadant ut på alla skärmar.

**Avatar**
- `getAvatar()`, `setAvatar(avatarId)`, `hasChosenAvatar()`

**Husdjur (mystery egg)** – ligger i systermodulen [`src/data-pet.js`](../src/data-pet.js)
- `buyEgg(price)` / `buyHeatLamp(price)` → `{ ok, coins, owned, pet }` –
  transaktioner som drar coins, lägger saken i `ownedItems` och uppdaterar `pet`
- `getPet()` → `pet` eller `null`
- `hatchIfReady()` → `{ pet, justHatched }` – kläcker (slumpar art) om kläcktiden passerats
- `feedPet()` → `{ ok, reason?, pet, stageUp }` – gratis, max 1 gång/kalenderdag
- Hjälpare: `hatchTimeFor(pet)`, `canFeed(pet)`, `stageForFeeds(n)`, `feedsToNextStage(n)`

**Statistik (profil)**
- `getStats()` → `{ coins, playedExercises, completed, stars, areas }`

**Innehåll**
- `getSubjects()`, `getAreas(subjectId)`, `getArea(subjectId, areaId)`

**Elevkonton (lärarsida)**
- `getStudents()`, `upsertStudent(id, {namn, username, password, avatarId})`

**Klasser (lärarsida)**
- `getClasses()`, `upsertClass(id, {name, order})`, `deleteClass(id)`,
  `setClassStudents(id, studentIds)` – `upsertClass` skriver med merge så
  `studentIds` bevaras vid namnbyte; `setClassStudents` ersätter hela listan.

**Tilldelade arbetsområden per klass**
- `setClassAssignments(id, assignments)` – ersätter `assignedAreas`
  (`assignments = [{ subjectId, areaId }]`; tom lista = eleverna ser allt).
- `getClassAssignments(id)` → `[{ subjectId, areaId }]`.
- `getClassForStudent(studentId?)` → klassdokumentet eleven tillhör (eller `null`),
  hittas via klassernas `studentIds`. Används av elevens Plugga-vy för att
  filtrera på `assignedAreas`.

De flesta funktioner använder den inloggade eleven automatiskt, men tar ett
valfritt sista `studentId`-argument.

---

## Säkerhetsregler

Se [`firestore.rules`](../firestore.rules). Reglerna är medvetet öppna för
`subjects`, `students` och `studentData` (läs + skriv) eftersom det rör sig om
skolklassbruk utan riktig autentisering. Allt annat nekas. Detta är **inte**
vattentätt men blockerar inte legitim användning – vilket är kravet.
