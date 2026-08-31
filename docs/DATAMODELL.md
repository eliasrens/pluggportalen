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
| `avatarId` | string | Vald avatar (se `AVATARS` i `src/app.js`)    |

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
| `ownedItems` | array  | Id:n på köpta shop-saker                               |
| `room`       | map    | `{ placements: { [itemId]: { x, y } } }`               |
| `avatarId`   | string | Vald avatar (spegel av `students`)                     |

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
  "ownedItems": ["poster-vikingaskepp"],
  "room": { "placements": { "poster-vikingaskepp": { "x": 120, "y": 60 } } },
  "avatarId": "fox"
}
```

---

## Datamodulens API (`src/data.js`)

Övriga delar återanvänder dessa funktioner:

**Session / inloggning**
- `login(username, password)` → `{ ok, student }` eller `{ ok:false, error }`
- `logout()`, `isLoggedIn()`, `getSession()`, `currentStudentId()`

**Coins**
- `getCoins()`, `addCoins(n)`, `spendCoins(n)` → `{ ok, coins }`

**Framsteg**
- `getProgress()`, `saveProgress(areaId, gamemode, result)`

**Shop / ägda saker**
- `getOwnedItems()`, `addOwnedItem(itemId)`, `buyItem(itemId, price)`

**Rum**
- `getRoom()`, `saveRoom(room)`

**Avatar**
- `getAvatar()`, `setAvatar(avatarId)`

**Innehåll**
- `getSubjects()`, `getAreas(subjectId)`, `getArea(subjectId, areaId)`

**Elevkonton (lärarsida)**
- `getStudents()`, `upsertStudent(id, {namn, username, password, avatarId})`

De flesta funktioner använder den inloggade eleven automatiskt, men tar ett
valfritt sista `studentId`-argument.

---

## Säkerhetsregler

Se [`firestore.rules`](../firestore.rules). Reglerna är medvetet öppna för
`subjects`, `students` och `studentData` (läs + skriv) eftersom det rör sig om
skolklassbruk utan riktig autentisering. Allt annat nekas. Detta är **inte**
vattentätt men blockerar inte legitim användning – vilket är kravet.
