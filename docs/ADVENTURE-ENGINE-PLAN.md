# Äventyrsspel – gemensam spelmotor (arkitektur- & beslutsunderlag)

> **Status: SPIKE / förslag.** Detta dokument innehåller **ingen produktkod**. Det
> är ett beslutsunderlag som ska granskas och godkännas av användaren *innan*
> motorn byggs. Allt nedan bygger på en läsning av den befintliga kodbasen
> (filnamn/funktioner citeras konkret) så att förslagen är förankrade i hur
> Pluggportalen faktiskt fungerar i dag – inte i en idealbild.
>
> Relaterat: issue #192. Epic: `epic/ventyrsspel-system-gemensam-spelmotor`.

## 0. Sammanfattning (TL;DR)

Vi kan bygga ett **top-down "gå-runt-och-samla"-äventyr** som återanvänder nästan
allt som redan finns:

* **Avataren** renderas redan som skalbar inline-SVG via `avatarMarkup()` – vi
  kan placera *exakt samma figur* (med köpt klädsel) i spelvärlden utan ny konst.
* **Rörelse, kollision och en rAF-loop** finns i praktiken redan färdig i
  `src/rum-promenad.js` (husdjurens promenad-AI) + golv-geometrin i
  `src/rum-promenad-golv.js`. Vi generaliserar samma procent-baserade
  scenkoordinatsystem till ett tile/grid.
* **Frågorna** (quiz/läsförståelse/para ihop) har redan en frikopplad frågemotor
  `runQuestions()` och paret-logik i `games-match.js`. Vi lägger en tunn
  **frågeadapter** ovanpå som exponerar `askNext(area) → {correct}` – **ingen
  frågelogik dupliceras**.
* **Belöningen** delas ut med den vanliga `awardExercise()` /
  `showResult()`-vägen (coins + XP + framsteg + grind-skydd), så banans
  slutbelöning fungerar precis som en vanlig övning.
* **Rendering: DOM + inline-SVG** (inte Canvas) – motiveras i §3.5. Det matchar
  hela appens nuvarande teknik (ingen byggpipeline, allt är native ES-moduler).

Rekommenderad rendering-teknik, filstruktur och en stegvis implementationsplan
finns i §3–§5. Öppna frågor till användaren i §7.

---

## 1. Syfte och avgränsning

Målet med epicen är ett **gemensamt "äventyrs-läge"**: eleven styr sin avatar i en
liten top-down-värld (t.ex. en skog, en rymdstation, ett slott), går fram till
objekt/stationer, och vid varje station dyker en **frågemodal** upp. Rätt svar för
banan framåt; när banan är klar delas en slutbelöning ut på vanligt sätt.

**Ett tema = en bana** med egen grafik/karta/stämning, men **all mekanik är
gemensam** (motorn). Nya teman ska kunna läggas till med en ren data-/config-fil
+ lite temagrafik, utan att röra motorn.

### Icke-mål (för första versionen)
* Ingen ny byggpipeline (webpack/vite/bundler) – appen är i dag en statisk sajt.
* Ingen fysikmotor, ingen pixel-perfekt kollision, ingen tilesheet-import.
* Inga nya frågetyper i själva motorn – vi återanvänder befintliga.
* Mobil/touch är *förberett* men inte kravställt för v1 (se §4).

---

## 2. Nulägesanalys (så fungerar Pluggportalen i dag)

### 2.1 Teknisk grund – ingen byggpipeline
* `index.html` laddar **en** modul: `<script type="module" src="./src/app.js">`.
  Allt är **native ES-moduler** (`package.json` → `"type": "module"`), serverade
  som statiska filer av en minimal `server.mjs`. **Det finns ingen bundler och
  ingen transpilering** – det vi skriver körs direkt i webbläsaren.
* Firebase/Firestore importeras från gstatic-CDN (`data.js`,
  `firebase-config.js`).
* Routing är **hash-baserad** (`src/app.js` → `routes`-tabellen +
  `go("#/...")`-hjälparen i `ui.js`). En ny vy = en ny rad i `routes`.
* **Konvention: filer hålls modulära och små (~<400 rader).** Stora subsystem är
  redan uppdelade (t.ex. `varld-rum*.js`, `data-*.js`, `art-*.js`,
  `games-*.js`). Motorn måste följa samma mönster (se §3.6).

### 2.2 Elevens avatar – lagring och rendering
**Lagring (Firestore):**
* `students/{uid}.avatarId` – grundfiguren (t.ex. `"fox"`), se
  `data-content.js` / `avatars.js`. 30 figurer finns (`AVATARS`/`CHARACTERS`).
* `studentData/{uid}.avatarItems: string[]` – burna klädsaker (delmängd av
  `ownedItems`), se `defaultStudentData()` i `data.js`.
* Läses via `data.getAvatar()` / `data.getAvatarItems()` (re-exporterade från
  `data-room.js`), eller färdigpaketerat för flera elever via
  `getStudentsWithLooks()`.

**Rendering (`src/avatars.js`):**
* `avatarMarkup(avatarId, equipped)` returnerar en **HTML-sträng**:
  ```html
  <span class="avatar-figure">
    <!-- ryggplagg (mantel) -->
    <span class="af-base"><svg viewBox="0 0 100 120">…figuren…</svg></span>
    <!-- övriga plagg (hatt/ansikte/hals/hand) som .af-wear -->
  </span>
  ```
* Figuren är **skalbar inline-SVG** (`characterSvg()` i `art-characters.js`,
  konsten i `art-characters-art.js`). `viewBox "0 0 100 120"`, figuren står med
  fötterna vid `y≈116` (se stilguiden `art-style.js`).
* Klädseln positioneras med CSS per slot i **procent** av containern
  (`styles.css` `.af-wear.af-hatt/.af-ansikte/.af-hals/.af-hand/.af-rygg`), och
  hela `.avatar-figure` skalar med `font-size` – **samma markup fungerar i
  sidhuvud, hjältebild, klassby och i arkadläget "Fånga sanningar"**
  (`games-sanningsjakt.js` använder redan `avatarMarkup` för en spelfigur).

**Riktningar / gång i dag:**
* Avataren har **en enda front-pose**. Det finns **ingen** bakifrån-vy och inga
  4-riktnings-sprites.
* **Vänster/höger** löses redan för *husdjuren* med en ren CSS-spegling:
  `.room-pet.vand-vanster .ri-emoji svg { transform: scaleX(-1); }`
  (`styles.css`). Samma trick fungerar direkt på avatarens SVG.
* **Gång-animation** finns för *sprite-husdjuren* (per-lem-animationer
  `.promenerar .pet-sprite .ps-fot-v/...` i `styles.css`), men **avatarens** SVG
  är inte riggad med namngivna lemmar → den kan inte animeras lem-för-lem utan
  ny konst.

**Slutsats för motorn:** avataren kan återanvändas rakt av som en enda
front-pose + horisontell spegling för vänster/höger. Upp/ner behöver **ingen**
ny vy – vi behåller front-posen och lägger på en billig **"gå-studs"**
(CSS-transform: liten vertikal bob + lätt lutning) som läsbar rörelsekänsla. Det
är minsta möjliga tillägg och kräver noll ny SVG-konst. (Riktiga
bakifrån/4-vägs-sprites kan bli en *senare*, valfri uppgradering – se §7.)

### 2.3 Arbetsområden – struktur och hämtning
* Firestore: `subjects/{subjectId}/areas/{areaId}`. Ett område är
  ```js
  { name, order, coverEmoji, description,
    exerciseTypes: string[],   // se exercise-types.js
    quiz:  [ {question, options[], answerIndex, explanation, passage?} ],
    pairs: [ {id, term, definition, termImage?, defImage?, group?} ],
    texts: [ … ] }
  ```
  Se `data.js`-headern + `docs/DATAMODELL.md`.
* Hämtning: `data.getSubjects()`, `data.getAreas(subjectId)`,
  **`data.getArea(subjectId, areaId)`** (`data-content.js`). Ett områdes hela
  innehåll (quiz/pairs/texts) kommer i ett dokument.
* Vilka övningstyper ett område stöder: `areaExerciseTypes(area)`
  (`exercise-types.js`) – uttryckligt sparat eller härlett ur innehållet.

### 2.4 Frågor – lagring, rendering och svar
Tre relevanta frågekällor finns redan, alla drivna av områdesdatan ovan:

**A. Quiz + Läsförståelse** (`games-quiz.js` + frågemotorn i `game-shared.js`):
* En quizfråga: `{ question, options[], answerIndex, explanation, passage? }`.
* **`runQuestions({ body, questions, onFinish, showPassage })`** i
  `game-shared.js` är redan en **frikopplad frågemotor**: den renderar en fråga i
  valfritt DOM-element, ger direkt feedback, köar om fel-svarade frågor (max
  `MAX_RETURNS`), och anropar `onFinish(correct, total)` när kön är tom.
* Urval per session: `pickSessionQuestions(pool, seen)` +
  `getQuestionRotation`/`saveQuestionRotation` (max 10 osedda frågor, roterande –
  `question-rotation.js`). `plainQuizPool()` (quiz utan passage) och `hasPassage()`
  håller lägena isär.

**B. Para ihop / Memory** (`games-match.js`): matchar `pairs` (begrepp ↔
förklaring), bild- eller textsidor via `sideContent()`/`resolvePairImage`.
Rätt/fel signaleras internt (låser/skakar) – **det finns i dag ingen
"en fråga i taget → correct?"-funktion för par**; den behöver vi wrappa (se §3.2).

**C. Fånga sanningar** (`games-sanningsjakt.js`): härleder sanna/falska
påståenden ur par eller quiz (`sanningsjakt-content.js`).

**Hur en gamemode startas i dag:** `pageElevOmrade()` listar `GAMEMODES` och
länkar till `#/elev/spela?...&mode=X`; `pageElevSpela()` (`gamemodes.js`)
dispatchar till rätt `startX(ctx)` med `ctx = { subj, area, areaData }`.

### 2.5 Belöning, pengar och framsteg
Allt går genom **`game-shared.js`**:
* **`awardExercise(area, mode, { stars, bestScore, baseCoins })`** – delar ut
  coins (`data.addCoins`, transaktion) + XP (`addXp` i `data-xp.js`) och sparar
  framsteg (`data.saveProgress(area, mode, {completed, stars, bestScore, plays})`).
  Har inbyggt **grind-skydd** (omspels-trappa; quiz/läsförståelse undantagna via
  `FULL_REWARD_MODES`).
* **`showResult({ container, subj, area, mode, stars, scoreLine, baseCoins,
  bestScore, replay, noStars })`** – firande-skärmen: kör `awardExercise`,
  uppdaterar topbaren, visar konfetti/level-up.
* Framsteg lagras i `studentData.progress[areaId][mode]`.

**Slutsats för motorn:** banans slutbelöning ska anropa **samma
`awardExercise`/`showResult`** med ett eget `mode` (t.ex.
`"aventyr:<tema>"`) och ett `baseCoins`-tal härlett ur bantprestation. Då syns
äventyret i statistiken och grind-skyddet fungerar automatiskt.

### 2.6 Designsystem som spel-UI:t måste följa (`docs/DESIGNSYSTEM.md`)
* **Z-lager är tokens på `:root`** i `styles.css` – lägg *aldrig* nya magiska
  `z-index`. Relevanta: `--z-scen-ui: 12`, `--z-panel: 14`, `--z-meny: 16`,
  `--z-modal: 1000`. Frågemodalen ska ligga på modal-lagret (`--z-modal`), spel-UI
  (knappraden) på scen-lagren.
* **Modaler:** mönstret är `.cx-modal-overlay > .cx-modal` (+
  `.cx-modal-head/.cx-modal-close`), `role="dialog" aria-modal="true"`
  (`styles.css` rad ~2231; exempel `teacher-class-detail.js`). Frågeadapterns
  overlay ska följa detta.
* **`[hidden]{display:none!important}`** är global – göm/visa element via
  `el.hidden = true/false`, aldrig `style.display`.
* **Scenkoordinater:** scenen är en `position:relative`-yta där allt placeras i
  **procent** av bredd/höjd. `FLOOR_TOP=62` (`art-room.js`) skiljer vägg/golv.
  Motorn bör återanvända samma procent-konvention.
* **Stapling av SVG-figurer/plagg sker via DOM-ordning**, inte z-index.
* Typografi/färg: `Baloo 2`-fonten + färgtokens/`--radie`/`--skugga*` i
  `styles.css`. `games.css` innehåller spel-specifik layout och kan utökas.

---

## 3. Föreslagen arkitektur

### 3.1 GameEngine-API
En temaoberoende motor som får en **tema-config** (§3.3) och en **frågeadapter**
(§3.2) och kör hela banan. Föreslaget publikt gränssnitt:

```js
// src/adventure/engine.js
export function startAdventure({ mount, theme, questions, player, onComplete }) → controller
//   mount      : DOM-elementet motorn ritar i (töms & fylls, som gameFrame-kroppen)
//   theme      : tema-config (karta, grafik, objekt, texter, stämning) – §3.3
//   questions  : frågeadapter { askNext, remaining, reset } – §3.2
//   player     : { avatarHtml }  (avatarMarkup-sträng, redan med klädsel)
//   onComplete : (result) => void  // { stationsCleared, mistakes, elapsedMs }
// controller   : { destroy() }  // stoppar rAF + städar (som startPetPromenad)
```

Internt delas motorn i **små samverkande moduler** (ansvar → fil, alla <400 rader):

| Ansvar | Vad det gör | Bygger på (befintligt) |
|--------|-------------|------------------------|
| **Grid/karta** | Tolkar `theme.map` (rader av tecken → tiles: golv/vägg/objekt/mål). Räknar om tile→procent. | Procent-scen (`art-room.js`), `omradeLayout`-stil matte |
| **Movement** | Tangent-/knappstyrd förflyttning av avataren, mjuk fart, `scaleX(-1)` vänster, gå-studs. | `walkStep`/`clampRange` (`rum-promenad*.js`) |
| **Collisions** | Blockera väggar/objekt-tiles; grid-baserat (inga DOM-rects i hot path). | `hitsObstacle`/`pathClear`-mönstret |
| **Interaction** | Detektera "avatar står bredvid ett station-objekt" → visa prompt "Tryck [E]/knapp". | – |
| **questionTrigger** | Vid interaktion: frys avatar, `questions.askNext(area)`; på `{correct:true}` markera stationen klar, öppna dörr/plocka objekt. | Frågeadapter §3.2 |
| **Progress** | Räknar klarade stationer, ritar en progress-ikon (`theme.progressIcon`). | – |
| **Completion/Reward** | När sista stationen är klar → `showResult()`/`awardExercise()`. | `game-shared.js` |
| **Loop** | En `requestAnimationFrame`-loop som städar sig själv när `mount` lämnar DOM. | `startPetPromenad` (`rum-promenad.js`) |

**Nyckelinsikt:** `rum-promenad.js` är i praktiken redan 80 % av movement +
collision + loop-städning. Motorn är i hög grad en **generalisering** av den
koden från "husdjur som vandrar fritt" till "avatar som spelaren styr på ett
grid", inte något byggt från noll.

### 3.2 Frågeadaptern (spelvärld ↔ frågor)
Ett tunt lager som gör befintliga frågor till ett enhetligt "en fråga i taget"-API,
**utan att duplicera frågelogik**:

```js
// src/adventure/question-adapter.js
export function makeQuestionAdapter({ areaData, types }) {
  // types: vilka frågekällor stationerna använder, t.ex. ["quiz","lasforstaelse","para"]
  return {
    // Visar EN fråga i en modal ovanpå världen, fryser spelet, resolvar svaret.
    askNext(opts) → Promise<{ correct: boolean, kind: string }>,
    remaining() → number,   // hur många osedda frågor finns kvar denna omgång
    reset(),                // ny omgång
  };
}
```

**Hur den byggs ovanpå det som finns – ingen kopierad frågelogik:**
* **Urval / no-repeat i samma omgång:** återanvänd `pickSessionQuestions()` +
  `question-rotation.js` (redan "servera osedda tills varvet är klart").
  Adaptern håller en lokal kö för banan.
* **Quiz/Läsförståelse:** rendera en enskild fråga med **samma byggstenar som
  `runQuestions()`** använder (alternativ-knappar, feedback, `showPassage` för
  passage). Renodlat "en fråga → resolve({correct})" – vi anropar inte hela
  `runQuestions` (den kör en helrunda), men vi **flyttar/extraherar** dess
  fråge-rendering till en delad `renderSingleQuestion()` som **både** `runQuestions`
  och adaptern kan använda. Då finns rendering-logiken på *ett* ställe.
* **Para ihop:** wrappa `pairs` som en fråga: "vilken förklaring hör till *term*?"
  → generera 1 rätt + N distraktorer ur andra par (återanvänd `shuffle`,
  `pickOnePerGroup`, `sideContent`/`resolvePairImage` för bild-par). Detta ger en
  flervalsfråga i samma modal-format → samma `{correct}`-kontrakt.
* **Frågemodalen** följer `.cx-modal-overlay/.cx-modal` (design­systemet), ligger
  på `--z-modal`, och sätter en flagga så motorn fryser tangentstyrningen medan
  modalen är öppen (se kollisions-edge case i §4).
* **Lätt att lägga till fler frågetyper:** en ny typ = en ny liten
  "producer" som returnerar `{ question, options[], answerIndex, explanation,
  passage? }`. Motorn/adaptern bryr sig bara om det normaliserade formatet.

### 3.3 Tema-config (karta/grafik/objekt/animationer/texter/stämning)
Ett tema är **ren data + en handfull SVG-strängar**, inte kod:

```js
// src/adventure/themes/skog.js  (exempel)
export const skogTheme = {
  id: "skog",
  namn: "Trollskogen",
  stamning: { himmel: "#bfe3ff", mark: "#8FCB74", musikMood: "lugn" },
  // Kartan som ASCII-grid: '.'=golv, '#'=hinder, 'S'=start, '?'=frågestation, 'M'=mål
  map: [
    "############",
    "#S..?...?..#",
    "#..##..##..#",
    "#..?..M..?.#",
    "############",
  ],
  tileSize: 8,              // procent av scenen per ruta (grid → %)
  art: {                    // inline-SVG per tiletyp/objekt (följer art-style.js)
    golv, hinder, station, malObjekt,
  },
  progressIcon: "🍄",       // ikon för klarade stationer
  texter: {
    intro: "Hjälp skogsrået! Svara rätt vid varje svamp för att öppna stigen.",
    stationPrompt: "En kunskaps-svamp! Tryck för att svara.",
    klart: "Du tog dig igenom skogen! 🌲",
  },
  // Vilka frågekällor stationerna drar från (mappar mot områdets innehåll):
  questionKinds: ["quiz", "lasforstaelse", "para"],
};
```

Motorn läser **bara** detta + områdesdatan. Byt tema = byt fil. Grafiken följer
den befintliga stilguiden (`art-style.js`: viewBox, kontur `#3B3350`, palett) så
allt känns som samma värld.

### 3.4 Avatar-återanvändning + gång-riktningar (exakt)
* Motorn tar emot `player.avatarHtml = avatarMarkup(avatarId, avatarItems)` –
  **samma sträng** som resten av appen. Ingen ny avatarkod, klädsel följer med.
* Spelaren blir ett absolut­positionerat `.adventure-player`-element med
  `.avatar-figure` inuti, placerat i **procent** (som `.room-item`/husdjuren).
  Storleken sätts via `font-size` (figuren skalar med den).
* **Höger/vänster:** växla en klass `.vand-vanster` → återanvänd exakt samma
  CSS-spegling som husdjuren (`transform: scaleX(-1)`).
* **Upp/ner:** ingen ny vy. Front-posen behålls; rörelse visas med en billig
  **gå-studs** (ny liten `@keyframes adv-bob` i `games.css`: ±3–4 % vertikal
  translate + ~2° vagga, aktiv bara när `.adventure-player.gar` är satt – exakt
  samma on/off-mönster som `.promenerar` för husdjuren).
* **Minsta tillägg:** en `@keyframes` + två klasser (`.gar`, återanvänd
  `.vand-vanster`). **Noll ny SVG-konst.** (Riktiga riktnings-sprites = valfri
  framtida uppgradering, §7.)

### 3.5 Rendering/loop-teknik – DOM + inline-SVG (motiverat)
**Rekommendation: DOM + inline-SVG, en `requestAnimationFrame`-loop.** Inte Canvas.

| Kriterium | DOM/SVG (rekommenderas) | Canvas 2D |
|-----------|-------------------------|-----------|
| Passar avatarens `avatarMarkup` | ✅ återanvänds rakt av | ❌ måste rasteriseras/ritas om från grunden |
| Klädsel/plagg | ✅ befintlig CSS-slot-logik | ❌ måste re-implementeras |
| Designsystem (tokens, `[hidden]`, modaler) | ✅ direkt | ⚠️ delvis (UI utanför canvas) |
| Byggpipeline | ✅ ingen behövs | ✅ ingen behövs |
| Tillgänglighet (aria, fokus, text) | ✅ inbyggt | ❌ svårt |
| Befintlig loop/kollision att ärva | ✅ `rum-promenad.js` | ❌ nytt |
| Prestanda vid FÅ rörliga objekt (1 avatar + statiska tiles) | ✅ fullt tillräcklig | ✅ (overkill här) |
| Mängder av partiklar/hundratals sprites | ⚠️ sämre | ✅ bättre |

Banorna har **en** rörlig figur (avataren) på ett litet statiskt grid – DOM/SVG
är gott och väl snabbt nog, och vi **ärver** avatar-, klädsel-, modal- och
loop-infrastrukturen gratis. Canvas skulle tvinga oss att bygga om allt det och
tappa tillgängligheten. Statiska tiles ritas **en gång** (ingen omritning per
frame); bara `.adventure-player`s `left/top` uppdateras i loopen (som husdjuren).

### 3.6 Filstruktur och <400-radersgränsen
Ny mapp `src/adventure/`, modulärt så varje fil hålls liten:

```
src/adventure/
  engine.js            // startAdventure(): sätter ihop delarna + rAF-loop (~150 r)
  grid.js              // ASCII-map → tiles → procent-koordinater + kollisionskarta (~120 r)
  movement.js          // ren rörelse-/clamp-matte (DOM-fri, enhetstestbar) (~120 r)
  input.js             // tangent + touch/knapp → riktningsvektor (~90 r)
  question-adapter.js  // frågeadaptern (§3.2), askNext()→{correct} (~180 r)
  question-modal.js    // .cx-modal-overlay-frågemodal + renderSingleQuestion (~150 r)
  reward.js            // banresultat → awardExercise/showResult (~60 r)
  themes/
    skog.js            // tema-config (data + SVG-strängar) (~120 r vardera)
    rymd.js
  index.js             // pageElevAventyr(): route-entry, laddar område+avatar (~90 r)
```

* **`movement.js`/`grid.js` är DOM-fria** → enhetstestbara som
  `rum-promenad-golv.js` (som redan har `test/rum-promenad-golv.test.js`).
* Gränssnitten hålls smala (motorn känner bara till adaptern via `askNext`), så
  varje fil kan växa oberoende utan att spränga taket.
* Route kopplas i `app.js`: `"/elev/aventyr": () => pageElevAventyr()` (+ ev.
  ett kort i `pageElevOmrade` eller en egen ingång från `#/elev/plugga`).

---

## 4. Tekniska risker och edge cases

| # | Risk / edge case | Hantering |
|---|------------------|-----------|
| 1 | **För få frågor** i ett område för alla stationer (t.ex. 8 stationer, 5 frågor). | Adaptern återanvänder rotationen: när poolen tar slut nollställs "sett"-listan och frågor får återkomma. Motorn kan också skala **antal stationer** till `min(theme.stations, remaining*k)`. Aldrig en tom station. |
| 2 | **Blandade frågetyper** (quiz + läsförståelse + par) i en bana. | Adaptern normaliserar allt till samma flervals-`{correct}`-kontrakt (par → genererad flervalsfråga). Modalen ser likadan ut oavsett källa. `passage` visas bara när den finns (`hasPassage`). |
| 3 | **Kollision / inklämd avatar** (spelaren manövrerar in i ett hörn eller mot en station). | Grid-baserad kollision (blockera måltilen *innan* flytt, som `hitsObstacle` gör), plus `clampRange` mot spelplanen. Ingen fri-form-fysik → ingen "fastna i väggen". |
| 4 | **Frågemodal + tangentstyrning krockar** (piltangenter rör avataren *bakom* modalen; Enter/E dubbel-triggar). | När modalen öppnas: `input.js` sätter `frozen=true` (motorn ignorerar rörelse-tangenter), modalen tar fokus (`aria-modal`, fokusfälla), och Escape/knapp stänger. Först när `askNext`-promisen resolvats släpps frysningen. |
| 5 | **Mobil / touch (framtid)**. | `input.js` abstraherar indata till en riktningsvektor. En on-screen D-pad + "interagera"-knapp kan läggas till senare utan att röra motorn. Kartor designas små nog för liten skärm. |
| 6 | **Prestanda** (rAF på svag skolchromebook). | Bara ett rörligt element; statiska tiles ritas en gång; `dt` clampas (bakgrundsflik → inga skutt, som i `rum-promenad.js`); respektera `prefers-reduced-motion` (stäng av gå-studs, precis som promenad-AI:n gör). |
| 7 | **Loop-läckor** när eleven navigerar bort mitt i banan. | `controller.destroy()` + samma självstädning som `startPetPromenad` (loopen stoppar när `mount.isConnected` blir false). |
| 8 | **Grind/omspel** – ska en genomspelad bana ge full pott varje gång? | Går via `awardExercise` → ärver grind-trappan automatiskt. Beslut om äventyret ska vara `FULL_REWARD_MODE` eller grind-skalat = **öppen fråga §7**. |
| 9 | **Avataren har ingen bakifrån-vy** – ser konstig ut när man "går uppåt". | v1: front-pose + gå-studs (accepterat, läsbart). Riktiga sprites = valfri senare uppgradering. |
| 10 | **XSS i lärartext** (frågor/områdesnamn i modalen). | Återanvänd `esc()` (finns i `game-shared.js`/`games-match.js`) på all lärar-inmatad text, som i dag. |

---

## 5. Stegvis implementationsplan
Varje steg är litet, testbart och lämnar appen körbar.

1. **Skelett + route.** `src/adventure/index.js` + `"/elev/aventyr"` i `app.js`.
   Renderar en hårdkodad grid-karta (ett tema), placerar avataren (`avatarMarkup`),
   ingen rörelse än. *Mål: se sin avatar stå i en värld via `barista_preview`.*
2. **Grid + rendering.** `grid.js`: ASCII-map → tiles → procent; rita golv/väggar
   som inline-SVG (stilguiden). Enhetstest för koordinatmatten.
3. **Movement + input + kollision.** `movement.js` (DOM-fri, enhetstestad) +
   `input.js`; tangentstyrning, `scaleX(-1)`, gå-studs, grid-kollision. Loop med
   självstädning (mönster från `rum-promenad.js`).
4. **Interaction + questionTrigger.** Detektera station bredvid avatar → prompt →
   frys → öppna modal.
5. **Frågeadapter + modal.** Extrahera `renderSingleQuestion()` ur `runQuestions`
   (delas), bygg `question-adapter.js` för quiz/läsförståelse först, sedan par.
   `.cx-modal-overlay`, `--z-modal`, fokusfälla.
6. **Progress + completion + reward.** Progress-ikon; sista stationen klar →
   `showResult`/`awardExercise` med `mode="aventyr:<tema>"`.
7. **Andra temat.** Lägg `themes/rymd.js` – bevisar att motorn är temaoberoende
   (bara data+grafik, ingen motoränd­ring). Uppdatera ev. preview-sida.
8. **Polish + edge cases.** `prefers-reduced-motion`, för-få-frågor, touch-stubbe,
   tester. Uppdatera `docs/DATAMODELL.md`/`DESIGNSYSTEM.md` vid behov.

---

## 6. Gemensamt vs unikt per tema

| Gemensamt (motorn – byggs en gång) | Unikt per tema (config + grafik) |
|-----------------------------------|----------------------------------|
| Rörelse, kollision, grid-tolkning | Kartan (ASCII-grid), tile-storlek |
| Frågeadapter + frågemodal | Vilka frågekällor stationerna drar från |
| Interaktion / station-trigger | Objekt-/stationsgrafik (SVG), progress-ikon |
| Progress, completion, belöning | Stämning (färger, "mood"), intro-/klart-texter |
| Avatar-rendering & gång | Mål-objektet (skatt/portal/rymdskepp) |
| rAF-loop, städning, reduced-motion | Namn/emoji/beskrivning |

Ett nytt tema ska alltså vara **en `themes/<x>.js`-fil** (data + SVG-strängar) och
inget mer – ingen motoränd­ring.

---

## 7. Öppna frågor till användaren (behöver beslut innan bygge)

1. **Belöningsmodell:** ska en genomspelad bana ge *full pott varje gång* (som
   quiz/läsförståelse) eller följa *grind-trappan* (mindre vid omspel)? Påverkar
   `mode`-valet i `awardExercise`.
2. **Ingång:** var startar eleven ett äventyr? Eget kort i områdesöversikten
   (bredvid Quiz/Para), eller en egen "Äventyr"-ingång som väljer område först?
3. **Stjärnor:** ska banor ge 1–3 stjärnor (utifrån fel/tid) eller vara
   stjärnlösa (som Memory, `noStars`)?
4. **Antal/omfång för v1:** hur många teman och hur långa banor (antal stationer)
   vill du se i första leveransen?
5. **Avatar-riktningar:** räcker front-pose + spegling + gå-studs för v1, eller
   är riktiga bakifrån/4-vägs-sprites ett krav (större konst-jobb)?
6. **Tema-idéer:** vilka 1–2 teman vill du börja med (skog, rymd, hav, slott…)?

---

*Detta dokument är underlaget för granskning. När riktningen är godkänd bryts
§5 ned i konkreta issues under epicen. Ingen kod skrivs förrän dess.*
