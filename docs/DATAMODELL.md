# Datamodell – Pluggportalen (Firestore)

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

**Quiz**: `{ id, question, options: string[], answerIndex, explanation, passage? }`
– `answerIndex` är index (0-baserat) i `options` för rätt svar.
– `passage` är källtexten (3–5 meningar) som just den frågan bygger på. I
  läsförståelse-läget visas passagen i ett lugnt block ovanför frågan och byts per
  fråga. **Obligatorisk för läsförståelse:** eftersom samma `quiz`-lista används av
  både Quiz och Läsförståelse räknas en övning som läsförståelse så snart någon fråga
  har `passage` – och då kräver valideringen (`validate.js`) `passage` på *varje*
  fråga, så ingen fråga kan visas utan sin källtext. Ett rent quiz (ingen fråga har
  `passage`) påverkas inte. Övriga gamemodes ignorerar fältet.

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
Reglerna låter eleven läsa bara sitt eget dokument; bara läraren skriver.

| Fält       | Typ    | Beskrivning                                  |
| ---------- | ------ | -------------------------------------------- |
| `namn`     | string | Elevens namn (visas i appen)                 |
| `username` | string | Användarnamn, gemener (mappas till `username@elev.pluggportalen.local` vid login) |
| `avatarId` | string | Vald avatar (se `AVATARS` i `src/avatars.js`)|

> `password` är **borttaget** efter migreringen (`admin/migrate-passwords.mjs`).
> Äldre dokument kan fortfarande ha ett kvarblivet `password`-fält tills
> migreringen körts – det tas bort då.

Exempel (`students/elev1`):

```json
{ "namn": "Astrid", "username": "elev1", "avatarId": "fox" }
```

---

## `studentData/{studentId}` – elevens speldata

| Fält         | Typ    | Beskrivning                                            |
| ------------ | ------ | ------------------------------------------------------ |
| `coins`      | number | Antal pluggcoins                                       |
| `xp`         | number | Kumulativt erfarenhets-XP. Nivån räknas fram ur detta (obegränsad, stigande kurva) – se `src/leveling.js`. Saknas fältet härleds ett startvärde ur `progress` (migrering). |
| `progress`   | map    | Framsteg: `{ [areaId]: { [gamemode]: {...} } }`        |
| `ownedItems` | array  | Id:n på köpta shop-saker (se `src/shop-items.js`)      |
| `avatarItems`| array  | Id:n på klädsaker eleven bär på avataren (delmängd av `ownedItems`) |
| `room`       | map    | `{ placements: { [itemId]: { x, y } }, paletteId }` – `x`/`y` i **procent** (0–100) av rummet. `paletteId` är elevens färgpalett för hus & väggar (`src/room-palettes.js`, default `"persika"`; golvet färgas aldrig om) |
| `avatarId`   | string | Vald avatar (spegel av `students`)                     |
| `avatarChosen` | bool | `true` när eleven själv valt grundavatar (styr avatarvalet vid första inloggning) |
| `pets`       | array  | Kläckbara husdjuren (mystery eggs) – se nedan. Eleven kan ha **flera** samtidigt |
| `appleCount` | number | Köpta men outlagda **äpplen** (matning). Se avsnittet om äpplen nedan |
| `floorApples`| array  | Äpplen som ligger på golvet i rummet: `{ id, x, y }` (procent). Se nedan |
| `pet`        | map    | **Utfasad** singular-föregångare till `pets` – migreras till `pets[0]` vid första inläsningen (fältet lämnas kvar men ignoreras när `pets` finns) |

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

`progress`-resultat per gamemode: `{ completed, bestScore, stars, lastPlayed }`.
`gamemode` är en sträng, förslagsvis `"quiz"`, `"lasforstaelse"`, `"para"`.

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
- `getCoins()`, `addCoins(n)` → nytt saldo (coins dras via `buyItem`, se Shop nedan)

**XP / nivå** – Firestore-delen i systermodulen [`src/data-xp.js`](../src/data-xp.js) (som `data-pet.js`)
- `getXp()` → elevens samlade XP; `addXp(n)` → nytt totalt XP (transaktion, samma
  mönster som `addCoins`; migrerar automatiskt elever utan `xp`-fält ur `progress`).
- XP delas ut i `awardExercise()` (`src/game-shared.js`): full pott första gången en
  övning klaras, ~30 % vid omspel (grind-skydd, som coins).
- Nivåkurvan (obegränsad, stigande) + XP-potten per övning ligger i
  [`src/leveling.js`](../src/leveling.js): `xpForLevel(L)`, `levelForXp(xp)`,
  `xpIntoLevel(xp)` → `{ level, intoLevel, neededForNext, progressRatio }`,
  `xpForExercise(stars)`, `XP_BASE`/`XP_PER_STAR` (justerbar balans, kommenterad tabell).

**Framsteg**
- `getProgress()`, `saveProgress(areaId, gamemode, result)`

**Shop / ägda saker**
- `buyItem(itemId, price)` → `{ ok, coins, owned }` (ägda saker läses via `getStudentData().ownedItems`)
  (`buyItem` drar coins och lägger till saken i **en** transaktion – ingen täckning
  eller redan ägd sak → `ok:false`, inga negativa saldon eller dubbelköp)
- Katalogen (kategorier, priser, emoji) ligger i [`src/shop-items.js`](../src/shop-items.js).

**Avatar-påklädnad**
- `getAvatarItems()`, `saveAvatarItems(itemIds)` – vilka klädsaker som bärs på avataren.
  Rendera avataren med `avatarMarkup(avatarId, itemIds)` från `src/avatars.js`.

**Rum**
- `getRoom()`, `saveRoom(room)` – `room = { placements: { [itemId]: { x, y } }, paletteId }`,
  där `x`/`y` är procent (0–100) så rummet ser likadant ut på alla skärmar.
  `saveRoom` skriver varje angivet fält med dot-path (`room.placements` osv.) –
  utelämnade fält (t.ex. `paletteId`) lämnas orörda. Paletterna för hus & väggar
  ligger i `src/room-palettes.js`; golvet färgas aldrig om.

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
