# Så lägger du till ett nytt Live-format

Den här guiden beskriver steg för steg hur ett nytt **spelformat** byggs i Live
(#547–#567). Den bygger på koden som finns i `src/live/formats/` – Klassmatchen,
Snilleblixten och Guldrushen – och är skriven så att prompten
**"bygg formatet X enligt `docs/LIVE-FORMAT.md`"** ska räcka.

Läs först: API-kommentaren överst i `src/live/live-formats.js` (interfacet,
den slutgiltiga sanningen) och avsnittet *Mattematchen & Live* i
[`docs/DATAMODELL.md`](DATAMODELL.md).

---

## 0. Tre axlar – vad är ett format?

| Axel | Vad den avgör | Register | Lagras som |
| --- | --- | --- | --- |
| **Spelläge** (gameMode) | VAD eleverna svarar på (multiplikation, quiz från Plugga …) | `src/live/game-modes.js` + `src/live/modes/index.js` | `liveSessions.gameMode` |
| **Svarssätt** (answerKind) | HUR eleven svarar: `"free"` = skriv själv, `"choice"` = fyra alternativ | `src/live/answer-kinds.js` | `liveSessions.answerKind` (saknas = `"free"`) |
| **Format** | HUR matchen spelas: vem tävlar mot vem, flödet, poängen, vinnaren, vyerna | `src/live/live-formats.js` + `src/live/formats/index.js` | `liveSessions.format` (saknas = `"klassmatch"`) |

**Kärnan** är gemensam och ska *inte* kopieras eller skrivas om:
sessioner i `liveSessions`, lobby och elevsynlighet (`live-watch.js`), STARTA
och 3–2–1–KÖR!, server-korrigerad klocka (`live-clock.js`), närvaro och puls
(`players`, `lastSeenAt`), sen anslutning och återanslutning, elevskärmsfönstret
(`elevskarm-*.js`), ljud (`proj-sound.js`), fullskärm, lärarformuläret
(`teacher-live-form.js` + `live-setup-fields.js`), projektorskalet
(`projector.js`), realtidslagret (`live-feed.js`), historiken
(`teacher-live-history.js`) och Pluggmynt-motorn (`live-rewards*.js`).

Ingen fil utanför `src/live/formats/<id>/` känner till ett enskilt format –
**undantagen är `firestore.rules`** (en regelgren per format) och, om formatet
behöver en server, `functions/`. Håll det så.

---

## 1. Filerna i ett format

Skapa mappen `src/live/formats/<id>/` (id = `snake_case`, 2–40 tecken,
`/^[a-z][a-z0-9_]{1,39}$/`, får **aldrig** bytas). Minsta uppsättningen,
med Snilleblixten som förebild:

| Fil | Innehåll | Laddas | Förebild |
| --- | --- | --- | --- |
| `index.js` | Format-objektet (`export default`), oregistrerat | dynamiskt via registret | `snilleblixt/index.js` |
| `<id>-core.js` | **Ren logik** (ingen DOM, ingen Firebase): konstanter, `validateSetup`, `buildSessionFields`, `sessionTitle`, `defaultSessionName`, `computeStandings`, `buildResult`. Datamodellen beskrivs i filhuvudet | statiskt från `index.js` | `snilleblixt/snilleblixt-core.js` + `-poang.js`, `guldrush/guldrush-core.js` |
| `<id>-data.js` | Firestore-lagret för formatets egna underdokument | **latt** (`import()`) | `snilleblixt/snilleblixt-data.js`, `guldrush/guldrush-data.js` |
| `<id>-student.js` | Elevens skärm: `lobbyHtml`, `endHtml`, valfritt `joinedText`, `createStage` | latt (`studentView()`) | `snilleblixt/snilleblixt-student.js` |
| `<id>-projector.js` | Projektorns delar: `views`, `createLobby`, `createWinner`, valfritt `ownControls`/`ownTimer`/`editDivisors` | latt (`projectorViews()`) | `snilleblixt/snilleblixt-projector.js` |
| `<id>-history.js` | Historik + Statistik → Live: `winnerText`, `detailHtml`, `classStats` … | latt (`historyRenderer()`) | `snilleblixt/snilleblixt-history.js` |
| `<id>-*.css` | Formatets stilar – **egna filer per format**, aldrig i `src/styles.css` | laddas av vyn | `snilleblixt/snilleblixt-elev.css` |
| `<prefix>-demo.js` | Isolerat demoläge (§7) | bara från preview-sidan | `snilleblixt/sb-demo.js`, `guldrush/gr-demo.js` |

Dela gärna upp i fler filer (formaten har 20–30 st, prefix `sb-`/`gr-`), men
håll den **rena logiken** skild från DOM- och Firestore-filerna – den testas i
node utan webbläsare.

**CSS:** ladda arket när vyn monteras, antingen med
`ensureLiveCss(["src/live/formats/<id>/<id>-historik.css"])`
(`src/live/live-css.js`, sökväg relativt repo-roten) eller med
`new URL("./<id>-x.css", import.meta.url)` som `guldrush/gr-kistor.js`.
Använd `docs/DESIGNSYSTEM.md` och stöd `prefers-reduced-motion`.

> ⚠️ **Bootgrafen (#271):** ingen fil under `src/live/` får nås statiskt från
> `src/app.js`. Formatets DOM-/Firestore-delar laddas bara via `import()`.
> `test/live-formats.test.js` ("Bootgrafen: formaten bara dynamiskt") fäller
> en statisk import. Se även `admin/qa-bootgraf-bfs.mjs`.

---

## 2. Format-objektet (`index.js`)

Fullständig specifikation: kommentaren i `src/live/live-formats.js`.
`registerFormat` kastar om något obligatoriskt saknas (`validateFormat`).

```js
// src/live/formats/<id>/index.js
import { answerKindsFor } from "../../live-formats.js";
import { rewardsSetupField, validateRewards, rewardSessionFields } from "../../live-rewards.js";
import {
  XX_MIN_CLASSES, XX_MAX_CLASSES, validateSetup, buildSessionFields, sessionTitle,
  defaultSessionName, computeStandings, buildResult,
} from "./<id>-core.js";

const MITT_FORMAT = {
  id: "<id>",                       // = liveSessions.format, byts aldrig
  displayName: "Mitt format",
  icon: "🎯",
  description: "En rad i lärarens formatväljare.",
  scope: "inom-klass",              // | "mellan-klasser"
  minClasses: XX_MIN_CLASSES,       // heltal 1–8
  maxClasses: XX_MAX_CLASSES,
  answerKinds: ["free", "choice"],  // delmängd av ["free", "choice"]
  pacing: "tid",                    // | "lärarstyrd"
  minQuestions: 5,                  // VALFRI – varning för små quizområden

  setupFields: [                    // ritas generiskt (live-setup-fields.js)
    { key: "x", kind: "toggle", label: "Något på/av", default: true },
    rewardsSetupField(),            // Pluggmynt efter matchen (§6)
  ],

  compatibleGameModes(mode) {
    return answerKindsFor(MITT_FORMAT, mode).length > 0;
  },
  validateSetup: (input) => [...validateSetup(input), ...validateRewards(input?.rewards)],
  buildSessionFields: (input) => ({ ...buildSessionFields(input), ...rewardSessionFields(input?.rewards) }),
  sessionTitle,
  defaultSessionName,               // VALFRI
  computeStandings,
  buildResult,

  projectorViews: () => import("./<id>-projector.js"),
  studentView: () => import("./<id>-student.js"),
  historyRenderer: () => import("./<id>-history.js"),
};

export default MITT_FORMAT;
```

### Obligatoriskt

| Fält | Beskrivning |
| --- | --- |
| `id`, `displayName`, `icon`, `description?` | Formatväljaren (steg 1 i lärarformuläret) |
| `scope`, `minClasses`, `maxClasses` | Hur många klasser läraren får välja |
| `answerKinds` | Svarssätten formatet klarar (se §5) |
| `pacing` | `"tid"`: kärnans matchklocka (`durationSeconds`, `endsAt`). `"lärarstyrd"`: ingen matchklocka – formatet styr själv (Snilleblixten: frågor + `questionSeconds`) |
| `setupFields` | `[{ key, label, kind, … }]` – sorterna `choice`, `number`, `text`, `toggle`, `perClass`, `custom` (se `src/live/live-setup-fields.js`). Vid `pacing: "tid"` lägger kärnan till matchlängden om formatet inte själv har ett `durationMin`-fält (`durationField()`) |
| `compatibleGameModes(mode)` | Vilka spellägen som visas i steg 2 |
| `validateSetup(input)` | Formatets egna fält → `string[]` fel. Kärnan kontrollerar namn, spelläge, klassantal och matchlängd |
| `buildSessionFields(input)` | Formatets fält på sessionsdokumentet (slås ihop av `buildSessionDoc` i `live-core.js`) |
| `sessionTitle(s)` | Stor rubrik (elevlistan, elevens matchvy) |
| `computeStandings(s, { counters, players, now, …extra })` | Ställningen projektorvyerna ritar (läggs på `live-feed`-tillståndet) |
| `buildResult(s, classes, players, mode, extra?)` | Historikens ögonblicksbild → `liveSessions.result`, skrivs **en gång** |
| `projectorViews()`, `studentView()`, `historyRenderer()` | **Lata** – returnerar `import(...)` |

### Valfritt

| Fält | När |
| --- | --- |
| `defaultSessionName(names)` | Förslag i Matchnamn (annars "4B mot 5E") |
| `prepareCreate(input, data, ctx)` → `{ data?, subdocs? }` | Formatet behöver underdokument som skapas i **samma batch** som sessionen (Snilleblixtens frågor + facit, Guldrushens quiz). `subdocs: [{ path: [samling, id], data }]` hamnar under `liveSessions/{sid}/` (`createLiveSession` i `live-data.js`) |
| `privateDocs` | `[[samling, id]]` – raderas med en lobby (`deleteLiveSession`) |
| `resultInputs(s)` → `Promise<extra>` | `buildResult` behöver mer än spelardokumenten (Snilleblixten: `sbScores`; Guldrushen: `grPlayers` + svar). Körs av `live-feed.js` och historiken |
| `emitOnPlayers: true` | Projektorn ska få nytt tillstånd vid varje spelarändring (puls, svar) – t.ex. "17 av 24 har svarat" |
| `classCounters: true` | Sessionen har shardade klassräknare (`counters/`) – bara Klassmatchen |
| `classDivisors: true` | Lärarens nämnare per klass – bara Klassmatchen |
| `minQuestions` | Varning när ett quizområde har färre frågor |

---

## 3. Registrera formatet

**En rad** i `src/live/formats/index.js`:

```js
import MITT_FORMAT from "./<id>/index.js";

const BUILTIN_FORMATS = [KLASSMATCH, SNILLEBLIXT, GULDRUSH, MITT_FORMAT];
```

Ordningen = ordningen i lärarens formatväljare. Klassmatchen är förvald
(`DEFAULT_FORMAT`). Läs alltid sessionens format med `formatOf(session)` /
`formatIdOf(session)` – aldrig `session.format` direkt (saknat fält =
Klassmatchen, okänt id = `null` → "ladda om", ingen krasch).

---

## 4. Regelgren i `firestore.rules`

Ett nytt format får en **egen gren**. Klassmatchens gren (`liveFormatOk`)
godtar bara `"klassmatch"`/saknat – utan egen gren nekas varje session med det
nya formatet, och det är meningen.

Följ Snilleblixten (`sbFormat`, `sbSettingsOk`, `sbSessionCreateOk`,
`sbSessionUpdateOk`) och Guldrushen (`grFormat`, `grSettingsOk` …):

1. **Formatfunktion** (bredvid `sbFormat`/`grFormat`, utanför `match`):
   ```
   function xxFormat(d) { return d.get('format', 'klassmatch') == '<id>'; }
   ```
2. **`xxSettingsOk(d)`** – `d.keys().hasOnly([...])` med exakt kärnans fält
   (`name`, `format`, `gameMode`, `answerKind`, `participatingClassIds`,
   `classNames`, `countdownSeconds`, `status`, `createdBy`, `createdByName`,
   `createdAt`, `startedAt`, `finishedAt`, `result`, `quiz`; vid `pacing: "tid"`
   även `durationSeconds`, `endsAt`) + formatets egna fält + `rewards`
   (med `liveRewardsOk(d)`), och typ-/intervallkontroll av varje fält.
3. **Inuti `match /liveSessions/{sid}`:** `xxSessionCreateOk()` (lobby,
   `createdBy == request.auth.uid`, `createdAt == request.time`, inga
   `startedAt`/`result`; `existsAfter(...)` för underdokument från
   `prepareCreate`) och `xxSessionUpdateOk()` (vilka nycklar som får ändras i
   vilken status; STARTA med `startedAt == request.time`; `result` en gång
   efter `finished`; inställningar låsta efter skapandet).
4. **Routa** `allow create` / `allow update` på formatet – lägg till en gren i
   kedjan:
   ```
   allow create: if isTeacher() &&
     (sbFormat(request.resource.data) ? sbSessionCreateOk()
       : grFormat(request.resource.data) ? grSessionCreateOk()
       : xxFormat(request.resource.data) ? xxSessionCreateOk() : liveSessionCreateOk());
   ```
   och motsvarande i `allow update` (lägg till `|| liveAutoFinishOk()` om
   formatet har `pacing: "tid"` och ska kunna avslutas av vem som helst vid 00:00).
5. **Svar:** välj en av två vägar.
   - *Kärnans svar* (`answers/{attemptId}`, `liveAnswerCreate`) räknar på
     `counterShards`/`players.correct` – passar format som liknar Klassmatchen.
   - *Egen samling* (som `sbAnswers/{i}_{uid}`) – bara `create`, id som gör
     dubbla svar omöjliga, `at == request.time`, inget `isCorrect` om eleven
     inte får se facit. Om formatet INTE ska ta svar via kärnan: exkludera det
     i `liveAnswerCreate` (som `!grFormat(s)`).
6. **Underdokument** (`match /<samling>/{id}` i `liveSessions/{sid}`): läsrätt,
   `create`-villkor, `update: if false` där det går, `delete: if isTeacher()`.
   **Facit läses bara av lärare** (`sbPrivate`, `grPrivate`).
7. **Pluggmynt:** `coinReceipts` och `liveCoinReceipt` är gemensamma – inget
   nytt behövs om formatet sparar `rewards` och `result.rewards` (§6).

Skrivningar som 30 elever gör samtidigt får **inte** gå mot samma dokument
(~1 skrivning/s/dokument): ett dokument per elev och svar, eller shards.

Kom ihåg: regeländringar gäller först efter
`firebase deploy --only firestore:rules` (kräver Elias OK).

---

## 5. Svarssätt och spellägen

- Sessionens svarssätt = lärarens val bland `answerKindsFor(format, mode)`,
  alltså **snittet** av formatets `answerKinds` och spellägets (spelläge utan
  `answerKinds` = `["free"]`). Bara ett gemensamt svarssätt → inget val visas.
  `resolveAnswerKind` ger det som sparas, `answerKindOf(session)` läser det.
- `compatibleGameModes(mode)` bör minst kräva ett gemensamt svarssätt
  (`answerKindsFor(...).length > 0`). Begränsa vid behov till vissa lägen
  (Guldrushen: `GR_MODES`, eftersom servern måste kunna rätta).
- `plugga_quiz` är bara `"choice"` och syns därför bara i format med `"choice"`.
- **Svarskomponent:** utan `createStage` monterar elevsidan kärnans komponent
  för svarssättet (`loadAnswerComponent(kind)` i `answer-kinds.js`:
  `free` = `src/mult/fast-answer.js`, `choice` = `src/live/choice-flow.js`).
  Med `createStage` äger formatet spelytan och får `answerKind` som argument
  (Snilleblixten använder `src/live/choice-answer.js` direkt).
- **Facit får inte läcka** (spec §4.4): förbered frågorna i `prepareCreate` som
  två dokument – elevsynligt utan facit och lärarskyddat facit
  (`buildSnapshot` i `snilleblixt-core.js`, `buildQuizPool` i
  `guldrush-core.js`, `buildQuizSnapshot` i `modes/plugga-quiz-core.js`).
- Statistik per tabell/kategori använder spellägets `statKeys(q)` och
  `statCategories` – spara `statKeys` i svaren eller i `result.perQuestion`.

---

## 6. Pluggmynt efter matchen

Motorn är gemensam – formatet kopplar bara in den. Spelvalutan (poäng, guld)
avgör placeringen; Pluggmynt (`studentData.coins`) räknas först vid matchslut.

1. `setupFields`: lägg till `rewardsSetupField()` (förstapris, mynt per rätt,
   tak + förhandsvisning).
2. `validateSetup`: `...validateRewards(input?.rewards)`.
3. `buildSessionFields`: `...rewardSessionFields(input?.rewards)` → `rewards`.
4. `buildResult`: avsluta med
   `withRewards(s, result, rows)` där
   `rows = [{ uid, score, correct, answered }]` ur **verifierad** data.
   Ger `result.rewards[uid] = { rank, correct, prize, correctCoins, total }`.
5. Regelgrenen: `'rewards'` i `hasOnly` + `liveRewardsOk(d)`.
6. Elevens slutskärm: `myReward(st.result, uid)` + `rewardSummary(...)`.

Utbetalningen sker automatiskt: `writeResultIfMissing` (`live-data.js`)
anropar `settleLiveRewards` när `result.rewards` finns, och historiken försöker
igen. Kvittot `coinReceipts/{uid}` gör det idempotent. `demo: true` betalar
aldrig. Ekonomins rattar: `src/live/rewards-config.js` (taken finns även i
`liveRewardsOk` – ändra båda).

Klasspokaler (`kc-koppling.js`) delas bara ut när `result.winner`/
`result.winnerClasses` pekar på en klass – sätt `winner: null` för
individuella format.

---

## 7. Projektorvyer

`projectorViews()` ger en modul (`<id>-projector.js`) som projektorskalet
(`src/live/projector.js`) laddar latt:

```js
import { createMinVy } from "./xx-scen.js";
import { createStatsView } from "./xx-statistik.js";
import { createLobby } from "./xx-lobby.js";

export const views = [
  { id: "xx-scen", label: "🎯 Scenen", create: createMinVy, finale: true },
  { id: "xx-statistik", label: "📊 Statistik", create: createStatsView, finale: true },
];
export { createLobby };
export function createWinner(host, opts) { return createMinVy(host, opts); }
// export const ownControls = true;  // vyn har egna lärarkontroller – skalets "Avsluta" göms
// export const ownTimer = true;     // vyn visar matchklockan själv – skalets timer göms
```

- `create(host, { st, colors, sound, actions, screen, deps })` →
  `{ update(st), destroy() }`. `st` = `live-feed`-tillståndet (session,
  spelare, ställningen ur `computeStandings`, `result`). `screen: true` =
  elevskärmsfönstret – rita inga kontroller.
- Vypostens valfria flaggor: `finale` (vyn visar själv slutet – ingen
  vinnarskärm), `only2` (bara vid två klasser), `preload()`.
- Vyvalet är lokalt per webbläsare (`pp:live:vy`) och följer med till
  elevskärmen via kanalen – inget att bygga.
- Ljud: använd `sound` (skalets `proj-sound.js`); egna effekter som
  `guldrush/gr-ljud.js`.
- `createLobby(stage, { st, colors, modeName, actions, say, readonly, sound, deps })`
  och `createWinner(stage, { st, colors, onBack, celebrate, sound, actions, screen, deps })`.
- Läs data via `deps`, inte direkt ur Firestore – då fungerar samma vy i
  demoläget.

Elevens skärm (`studentView()`): `lobbyHtml(s)`, `endHtml(st, player, classId)`,
valfritt `joinedText` och `createStage({ view, host, uid, classId, session,
mode, answerKind })` → `{ update(st, player), destroy() }`. Kärnan sköter
lobby → 3-2-1 → spel → slut, närvaro och återanslutning.

Historiken (`historyRenderer()`): `winnerText(s, result)`,
`detailHtml(s, result)` (får vara async), `classStats` (`head`, `cols`,
`cells(s, result, classId)`) och valfritt `ownPlayerTable`,
`playerCounts(s, result)`, `classSummaryHtml(entries, classId)`, `settle(s)`
– se `src/live/teacher-live-history.js`.

---

## 8. Demoläge

Varje format ska ha ett **isolerat** demoläge (spec §7.7) som kör en hel match
i minnet – utan Firestore, Cloud Functions eller Pluggmynt.

- Bygg `<prefix>-demo.js` med `createXxDemo({ sid, screen?, now?, auto?, onLog? })`
  → `{ deps, join(n), setAuto(on), soonOut(sek), jumpToFinal(tie), state(), … }`.
  Återanvänd Snilleblixtens demoramverk (`snilleblixt/sb-demo.js`:
  `DEMO_NAMES`/`demoMembers()` = 30 påhittade elever, `forceReducedMotion`) –
  som `guldrush/gr-demo.js` gör.
- Kör formatets **riktiga** rena logik (övergångar, poäng, `computeStandings`,
  `buildResult`) – demot ska visa precis det en riktig match visar.
- `demo.deps` skickas till `mountProjector(ctx, sid, { deps, screen })`
  (`src/live/projector.js`), så projektorn aldrig laddar Firestore-lagret.
  Sätt `demo: true` på sessionen – `payoutList` och `liveCoinReceipt` betalar
  aldrig ut för demo.
- Sidan `preview/preview-<id>-demo.html`: kopiera
  `preview/preview-snilleblixt-demo.html` eller
  `preview/preview-guldrush-demo.html` (de blockerar alla Firebase-anrop
  överst i sidan och visar en kontrollpanel). Öppna med `npm start` →
  `http://localhost:8000/preview/preview-<id>-demo.html`.
- Demot ska kunna visa: 25+ elever ansluter, svar (rätt och fel) strömmar in,
  formatets specialhändelser, "tiden snart slut", final/pallplats och
  oavgjort om förstaplatsen.

---

## 9. Tester

### Enhetstester (ingen emulator)

Fil: `test/live-<id>.test.js`. Kör:

```bash
node --test test/live-<id>.test.js
node --test test/live-formats.test.js      # registret + bootgrafen
```

Mall att kopiera:

```js
// Enhetstester: Live-formatet <id> (#NNN) – src/live/formats/<id>/.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireFormat, formatOf, answerKindsFor } from "../src/live/formats/index.js";
import { validateFormat } from "../src/live/live-formats.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { buildSessionDoc } from "../src/live/live-core.js";

const F = requireFormat("<id>");
const MULT = requireGameMode("multiplication_0_10");
const QUIZ = requireGameMode("plugga_quiz");

describe("<id>: registrering", () => {
  it("uppfyller interfacet och är registrerat", () => {
    assert.deepEqual(validateFormat(F), []);
    assert.equal(formatOf({ format: "<id>" }), F);
  });
  it("spellägen och svarssätt", () => {
    assert.equal(F.compatibleGameModes(MULT), true);
    assert.deepEqual(answerKindsFor(F, QUIZ), ["choice"]);
  });
  it("vyerna laddas latt (funktioner – anropa dem inte i node, de laddar DOM/Firebase)", () => {
    for (const fn of ["projectorViews", "studentView", "historyRenderer"]) assert.equal(typeof F[fn], "function");
  });
});

describe("<id>: inställningar och sessionsdokument", () => {
  const input = {
    name: "Test 4B", format: "<id>", gameMode: "multiplication_0_10", answerKind: "free",
    classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10,
    rewards: { firstPrize: 300, perCorrect: 5, cap: 300 },
  };
  it("giltiga inställningar ger inga fel", () => assert.deepEqual(F.validateSetup(input), []));
  it("ogiltiga ger fel", () => assert.ok(F.validateSetup({ ...input, rewards: { firstPrize: 5000 } }).length));
  it("buildSessionDoc sparar format, svarssätt och formatets fält", () => {
    const d = buildSessionDoc(input, { uid: "larare1" });
    assert.equal(d.format, "<id>");
    assert.equal(d.answerKind, "free");
    assert.deepEqual(d.rewards, { firstPrize: 300, perCorrect: 5, cap: 300 });
  });
});

describe("<id>: ställning och resultat", () => {
  const s = { id: "s1", format: "<id>", status: "finished", startedAt: 1,
    participatingClassIds: ["4b"], rewards: { firstPrize: 300, perCorrect: 5, cap: 300 } };
  const players = [{ uid: "a", classId: "4b", name: "Alma" }, { uid: "b", classId: "4b", name: "Omar" }];
  it("delad placering (1, 1, 3)", () => { /* computeStandings med lika poäng */ });
  it("result: winner null, ranking, rewards bara för deltagare", () => {
    const r = F.buildResult(s, [], players, MULT /* , extra */);
    assert.equal(r.format, "<id>");
    assert.equal(r.winner, null);
  });
});
```

Lägg också till formatets egna planer/övergångar och demot (Snilleblixtens och
Guldrushens demotester ligger i `test/live-snilleblixt-historik.test.js` resp.
`test/live-guldrush-historik.test.js`).

### Regeltester (Firestore-emulatorn)

Fil: `test/firestore-rules-live-<id>.test.js`. **Lägg till filnamnet i
`test:rules` i `package.json`** – skriptet listar varje fil, annars körs den
inte. Kör:

```bash
npm run test:rules        # kräver Java 21+ och firebase-tools
```

Mall (rigg: `test/helpers/rules-env.js`, unikt projectId per fil):

```js
// Regel-tester: Live-formatet <id> (#NNN) – firestore.rules "<Namn>".
import { after, before, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "Test 4B", format: "<id>", gameMode: "multiplication_0_10", answerKind: "free",
    classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10,
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H),
  ...over,
});

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-<id>"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "liveSessions", sid), data);
  });
}

describe("<id>: skapa", () => {
  it("lärare skapar en lobby", async () => { /* serverTimestamp() på createdAt via teacher() */ });
  it("elev får inte skapa", async () => { /* assertFails */ });
  it("okänt fält / fel typ nekas", async () => { /* assertFails */ });
});

describe("<id>: låst efter skapandet", () => {
  it("formatet byts aldrig", async () => {
    await seed("lobby", sessionDoc({ status: "lobby" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "lobby"), { format: "klassmatch" }));
  });
  it("inställningar kan inte ändras efter start", async () => { /* … */ });
});

describe("<id>: svar", () => {
  it("elevens svar godtas bara under matchen och bara en gång", async () => { /* … */ });
  it("facit kan inte läsas av elev", async () => { /* assertFails(getDoc(...)) */ });
});
```

Testa minst: skapa (lärare ja, elev nej, okända fält nej), formatet byts
aldrig, inställningar låsta, varje statusövergång, svar inom/utanför tid, ett
svar per elev och fråga, facit oläsbart för elever, `result` skrivs en gång.
Glöm inte att också bevisa att **Klassmatchen och de andra formaten är
orörda** – hela `npm run test:rules` ska vara grön.

### Cloud Functions (bara om formatet har en server)

Som Guldrushen: logik i `functions/<id>-core.js`, anropbara funktioner i
`functions/index.js`, delad konfig kopieras med ett sync-skript (se
`admin/sync-guldrush-functions.mjs` + `predeploy` i `firebase.json`).
Tester i `test/functions-<id>*.test.mjs`, tillagda i `test:functions` i
`package.json` (`npm run test:functions`).

---

## 10. Checklista

- [ ] `src/live/formats/<id>/` med `index.js`, ren `<id>-core.js`, lata vyer
- [ ] En rad i `BUILTIN_FORMATS` (`src/live/formats/index.js`)
- [ ] Regelgren i `firestore.rules` + routning i `allow create`/`allow update`
- [ ] `test/live-<id>.test.js` + `test/firestore-rules-live-<id>.test.js`
      (tillagd i `test:rules`)
- [ ] Pluggmynt kopplat (§6) om formatet har individuell placering
- [ ] Projektorvyer, elevskärm och historik
- [ ] Demoläge + `preview/preview-<id>-demo.html`
- [ ] Egen CSS per format, reducerad rörelse
- [ ] `docs/DATAMODELL.md`: formatets fält, underdokument och `result`
- [ ] Bootgrafen orörd (`node --test test/live-formats.test.js`)
- [ ] Alla sviter gröna: enhetstester, `npm run test:rules`, ev.
      `npm run test:functions`, `npm run test:e2e`
- [ ] Rules-deploy (och ev. functions-deploy) **före** merge till `main` –
      kräver Elias OK
