# Bråkresan 🐉 – integration, kontrakt och delade API:er

Epic #705. Specen (bindande, läs hela): [`docs/BRAKRESAN-SPEC.md`](BRAKRESAN-SPEC.md).
Den här filen är **det gemensamma kontraktet** för sub-issuerna: vad som finns i kodbasen,
vad Bråkresan återanvänder, och de API:er som parallella agenter delar
(matematik, uppgiftsschema, komponenter, server). Datamodellen står i
[`docs/DATAMODELL.md`](DATAMODELL.md) under "Bråkresan", behörigheterna i
[`docs/BEHORIGHETER.md`](BEHORIGHETER.md).

Appen heter **Pluggporten** i koden och i texterna (specen säger både Pluggporten och
Pluggportalen – kodbasen vinner, §13).

## 1. Läget efter #706 (grunden)

| Del | Fil(er) | Status |
| --- | --- | --- |
| Spec i repot | `docs/BRAKRESAN-SPEC.md` | ordagrann kopia av byggprompten |
| Matematikmotor | `src/brakresan/math/*` | klar, `test/brakresan-math.test.js` (alla exempel i §15) |
| Katalog (50 id/namn, avsnitt, taggar) | `src/brakresan/schema/katalog.js` | klar, namnen kontrolleras mot specen |
| Uppgiftsschema + generatorkontrakt | `src/brakresan/schema/{uppgift,kontrakt,bedomning,prng}.js` | klart |
| Omgångsplan (10 st, 3/4/3, inga dubbletter, reservbank) | `src/brakresan/schema/omgangsplan.js` | klar |
| Regler i siffror (stjärnor, mynt, drake, jakt, datum, status) | `src/brakresan/schema/regler.js` | klara |
| Generatorgranskning (200 exempel/utmaning) | `src/brakresan/schema/granskning.js`, `test/brakresan-generatorer.test.js` | klar – körs för varje byggd utmaning |
| 50 utmaningsfiler | `src/brakresan/utmaningar/u01.js` … `u50.js` | **byggda (D #709): 03, 12, 19, 34**; övriga stubbar – fylls av E/F/G |
| Granskningsskript per utmaning (D #709) | `admin/qa-brakresan-generatorer.mjs` + egna kontroller `admin/qa-brakresan/uNN.mjs` | klart, `test/brakresan-utmaningar-d.test.js` |
| Utmaningsvy + omgångsflöde (D #709) | `src/brakresan/omgang*.js`, `omgang.css`, `page-brakresan.js`, route `#/elev/brakresan?u=NN` | klart, §5b nedan, `test/brakresan-omgang-backend.test.js` |
| Synk till Cloud Functions | `admin/sync-brakresan-functions.mjs` → `functions/brakresan/` | klar, predeploy + `test/brakresan-delat.test.js` |
| Datamodell | `docs/DATAMODELL.md` "Bråkresan" | dokumenterad |
| Regelskelett | `firestore.rules` (Bråkresan-blocken) | klart, `test/firestore-rules-brakresan.test.js` |
| Komponentbibliotek (B #707) | `src/brakresan/komponenter/*` (+ `komponenter.css`), §5 nedan | klart, `test/brakresan-komponenter-geometri.test.js`, `preview/preview-brakresan-komponenter.html` |
| Server-API (J) | §6 nedan | kontrakt |
| Betrodd server (C #708): omgångar, bedömning, stjärnor, mynt, uppmuntran, drake | `functions/brakresan-{core,avslut,state}.js`, callables `brakresa*` i `functions/index.js` | klar, `test/functions-brakresan-{core,avslut}.test.mjs` (kärnan, §15) + `functions-brakresan.test.mjs` (e2e) |
| Klientens dataskikt + demoläge | `src/brakresan/data.js` (lat), `data-core.js`, `demo.js` | klart, `test/brakresan-data-core.test.js` |

Inget i `src/brakresan/` importeras statiskt från bootgrafen (107 filer, `admin/qa-bootgraf-bfs.mjs`).

## 2. Kartläggning – vad som finns och vad Bråkresan använder (§13 "Undersök först")

| Område | I kodbasen | Bråkresan |
| --- | --- | --- |
| **Router** | Hash-router i `src/app.js` (`routes`-objektet). Moduler laddas med `dynSida(async () => (await import(...)).page…(), ikon, titel)` – aldrig statiskt (#271, incidenten 2026-09-10). | Ny route `#/elev/brakresan` (huvudvy, `?u=03` = utmaningsvy) via `dynSida` → `src/brakresan/page-brakresan.js` (D/H). Lämna-vakten i `app.js` (`router(e)`-kroken, #605) kan användas för "Tillbaka sparar". |
| **Elevnavigation** | `src/ui.js` `NAV_LANKAR`, grupp `"ova"` (Plugga-design #701). `modul:`-id styr synligheten via `src/gamemode-visibility.js` `TOGGLABLE_MODULES` (`optIn: true` = av tills läraren slår på). Reglerna validerar listorna (`validHiddenModules`/`validEnabledModules` i `firestore.rules`). | En rad `{ hash: "#/elev/brakresan", ikon: "🐉", label: "Bråkresan", grupp: "ova", modul: "brakresan" }` + rad i `TOGGLABLE_MODULES` + id:t i regelns listor (H). **Beslut för leaden: opt-in eller synlig som standard**, se §8. |
| **Lärarnavigation** | `src/teacher-shared.js` `TEACHER_TABS` (lazy `import()`), klassvyns flikar i `src/teacher-class.js` (Läsresan/Ekvationsresan-mönstret: `{ key, label, icon, lazy: true, render: async … import(…) }`). | Fliken "Bråkresan" i `teacher-class.js` (klassöversikt, matris, individvy) + testläget som egen sida i gruppen `material` eller `statistik` (K). |
| **Auth / elevidentitet** | Firebase Auth; elevens `uid` = dokument-id i `students` och `studentData`. Klient: `currentStudentId()` (`src/data.js`). Server: `request.auth.uid`. | Samma. Callables tar aldrig ett elev-id som argument – alltid `request.auth.uid`. |
| **Lärarroller** | Admin / årskurskonto (#676). Regler: `isAdmin()`, `hasClass(classId)`, `hasStudent(studentId)`. Server: `functions/teacher-role.js` `callerRole(db, auth)`. Klient: `src/teacher-role.js`, `teacher-role-core.js`. | Läsning av elevdata via `hasStudent`, rekommendationer via `hasClass`/`hasStudent` (regelskelettet). Årskurskontot ser bara egna klasser i lärarvyn (filtrera listor på egna klasser, `BEHORIGHETER.md` "Att tänka på"). |
| **Valuta** | `studentData.coins`. Klienten lägger mynt med `addCoins` (`src/data.js`) – fältet är elevskrivbart sedan tidigare (shoppen, Läsresan …). Servermönster: `hitta-ratt-core.js` ökar `coins` med `FieldValue.increment` i samma transaktion som resultatet. Ingen gemensam myntlogg finns. | Bråkresan betalar **bara från servern**: belöningsdokument `brakresaRewards/{eventId}` + `increment` i EN transaktion (§13). Händelse-id = dokument-id ⇒ aldrig dubbel utbetalning. Klienten gör `invalidateStudentData` efter en belöning så att sidomenyns saldo uppdateras. Se §8 om det elevskrivbara saldot. |
| **Inventory / hus / djurnamn** | `studentData.roomAnimals` (`src/data-animals.js`), mystery-djur `pets` (`src/data-pet.js`), rendering `src/varld-rum-djur.js`, "Mina djur" `src/varld-rum-djurtray.js`, namn `cleanPetName` (`data-pet.js`, max 16 tecken, utan HTML). | Draken i eget fält `studentData.brakdrake` (DATAMODELL.md) – **inte** i `roomAnimals`, eftersom `saveAnimalPositions`/`saveAnimalName` skriver om listan ur `animalsFromData`, som hoppar över arter som inte är shop-djur (en drakpost skulle tyst försvinna). Återanvänd `cleanPetName`, namnrutan, placeringen och lådan (I). |
| **Grafik** | Egenritad parametrisk SVG i `src/art-*.js`; sprite-djur `art-pet-sprites.js`; designspråket i `docs/DESIGNSYSTEM.md`. CSS: `src/styles/NN-*.css` → `npm run build:css` (styles.css genereras). Moduler laddar egen CSS lat (`page-ekvationsresan.js` `ensureStyles`). | Matematikbilder = parametrisk SVG/DOM ur uppgiftens data (B). Draken = egen SVG per stadium, lat laddad (I0/I). Egen CSS i `src/brakresan/*.css`, laddad lat – inte i `styles.css`. Inga Emoji 13+ (#590). |
| **Ljud, rörelse** | `src/fx.js`: `sound`, `isMuted()` (localStorage `pluggportalen.muted`), `confetti`. Reducerad rörelse via `@media (prefers-reduced-motion: reduce)`. | Samma ljudinställning; alla animationer har reducerad variant (§14). |
| **Uppläsning** | Ingen TTS/uppläsningsfunktion i appen. | Ingen ny tjänst (§11). Strukturerad text + `aria-label` ur `math/words.js` ("tre fjärdedelar"). |
| **Callables** | `functions/index.js`: `onCall({ region: "europe-west1", … })`, logiken i en kärnfil med deps-injektion (`{ db, FieldValue, Timestamp, now, rng }`), egen felklass → `HttpsError`. Klient: `httpsCallable(getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION), namn)` (`src/hitta-ratt/hr-data.js`). Slump: `node:crypto` `randomInt`. | Samma mönster: `functions/brakresan-core.js` + `brakresan*`-callables (§6). Delad kod via `functions/brakresan/` (synk). |
| **Lärarstatistik / läskvot** | #231: inga läsningar per elev i onödan; lärarvyerna läser ett denormaliserat dokument per elev (Ekvationsresan `ekvationsresa/progress`, Läsresan `studentData.lasresa`). | `studentData/{id}/brakresa/state` bär allt matrisen och klassöversikten behöver – EN läsning per elev, aldrig 50. Omgångshistoriken läses först när läraren öppnar en elev. |
| **Testverktyg** | `node --test` (enhetstester: alla `test/*.test.js` utom `firestore-rules-*`, `functions-*`, `e2e-*`); `npm run test:rules` / `test:functions` (emulatorn, kräver java + firebase-tools); bootgraf `admin/qa-bootgraf-bfs.mjs`; förhandsvisning `node server.mjs` + `preview/*.html`; full app mot emulatorn `admin/qa-emulator-proxy.mjs`. | Samma. Generatorgranskningen körs i enhetstesterna. Callable-tester behöver `FUNCTIONS_EMULATOR_HOST`. **En Firestore-emulator åt gången**: kör den med `flock /tmp/pp-emulator.lock …` och egen port-config. |

## 3. Matematikmotorn (`src/brakresan/math/`)

Ren JS utan beroenden, samma kod i webbläsaren och i Cloud Functions. Allt exakt – inga flyttal.

| Modul | Viktigast |
| --- | --- |
| `rational.js` | `q(n, d)` → fryst `{ n, d }` (gcd-normaliserad, positiv nämnare; d = 0 kastar), `add sub mul div sum`, `eq cmp lt gt`, `toMixedParts`, `fromMixed`, `numeratorFor(v, d)`, `commonDenominator`, `gcd lcm`. Osäkra heltal kastar `RangeError`. |
| `form.js` | **Presentationsform skild från värdet**: `fraction(2, 4)` visas "2/4" men `valueOf` = 1/2. Former: `integer`, `fraction`, `mixed`, `decimal(value, places)`, `percent(p)`. `formatForm` (svensk decimalkomma, hårt mellanslag före %), `isSimplest`, `simplify`, `fractionFormOf`, `mixedFormOf`. |
| `decimal.js` | `isTerminating` (bara 2/5-nämnare), `decimalPlaces`, `decimalText(v, places)` → "0,75" eller `null` (1/3 är aldrig 0,33), `fitsDecimals(v, 2)`, `placeValues` (tiondelar/hundradelar). |
| `percent.js` | `fromPercent(25)` = 1/4, `integerPercent`, `percentOf(25, 80)` = 20, `percentOfWhole(6, 24)` = 25, `discount`, `increase`. |
| `compare.js` | `relation(a, b)` → "<" "=" ">", `sortAscending`, `isAscending` (lika värden i valfri ordning), `allDistinct`, `valueKey`. |
| `input.js` | Elevens fält → `{ ok: true, form }` eller **inmatningsfel** `{ ok: false, error, message }` (`tom`, `ofullstandig`, `ogiltig`, `namnare-noll`) som INTE låser uppgiften. `parseFraction({ n, d })`, `parseMixed({ whole, n, d })`, `parseDecimal` (komma/punkt, slutnollor), `parsePercent`, `parseInteger`, `parseText` ("2 3/4", "75 %"). |
| `requirements.js` | `checkForm(form, expected, requirement)` → `{ correct, valueOk, formOk, reason, message }`. Krav: `value` (alla likvärdiga), `denominator` (utm. 14), `simplest` (21), `mixed` (28, 36), `fraction`, `decimal`, `percent`, `integer`. Rätt värde i fel form = fel, men med egen förklaring. |
| `words.js` | `fractionWords(3, 4)` = "tre fjärdedelar", `speakForm`, `numberWords`, `partName`. |

## 4. Uppgiftsschema och generatorkontrakt (`src/brakresan/schema/`)

### Så skriver du en utmaning (D, E, F, G)

Ersätt stubben i `src/brakresan/utmaningar/uNN.js` med `export default defineChallenge({...})`.
Rör bara dina egna `uNN.js` (+ egna testfiler) – då krockar parallella agenter aldrig.

```js
import { defineChallenge } from "../schema/kontrakt.js";
import { q, formatForm, fraction } from "../math/index.js";

export default defineChallenge({
  id: "03",
  version: 1,                       // HÖJ när uppgifterna ändras
  slots: undefined,                 // standard: 3 intro, 4 normal, 3 overforing – eller tio egna namn
  generate(rng, { slot, index }) {  // bara rng (prng.js) – aldrig Math.random
    return { a, n, form: "cirkel" };// ren JSON
  },
  core: (p) => `${p.a}/${p.n}`,     // semantisk kärna (dubblettkontroll)
  build(p) {                        // REN funktion av params
    return { core, prompt, values, view, answer, key, help, misconceptions, feedback, review };
  },
  validate: undefined,              // valfri egen bedömning; standard gradeAnswer
  reserve: [{ slot: "intro", params: {...} }, ...], // ≥ 10 validerade
});
```

Fälten i `build` (detaljer i `schema/uppgift.js`):

- `prompt` kort instruktion. `view` = representationen till komponenten (§5) – får inte
  avslöja facit (ingen "3/5 markerat"-etikett före kontroll i målningsuppgifter).
- `answer` = svarsytan, `key` = hemlig regel. Svarstyperna och deras regler står i
  `schema/bedomning.js`: `choice`, `yesno`, `relation`, `select` (välj N kort, valfri ordning),
  `pairs`, `categories`, `order`, `paint` (antal, vilka delar som helst), `number` (+ formkrav),
  `point` (tallinjen, exakt snäppvärde), `multi` (flera delsteg = EN poäng).
- `key.display` = facit som text (visas efter kontroll). `key.examples = { right: [...], wrong: [...] }`
  = elevsvar som granskningen kör: alla `right` ska bedömas rätt, alla `wrong` fel (inte
  inmatningsfel). Lägg de vanliga missuppfattningarna i `wrong`.
- `help` = 1–4 steg i ordningen `orientering → princip → modellering → atergang`, utan aktuellt
  facit (granskningen fäller hjälptext som innehåller `key.display`). Genomräknade exempel har
  andra tal.
- `feedback = { correct, wrong }` kopplar till modellen ("Ja! Tre av fyra lika stora delar …").
  `review` = genomgången efter omgången.
- Inga arrayer direkt i arrayer (Firestore) – använd `{ ids: [...] }`, `{ a, b }`.

**Granskningsskriptet (D #709):** `node admin/qa-brakresan-generatorer.mjs [NN …] [--visa 3]` kör
`reviewChallenge` + utmaningens EGNA kontroller i `admin/qa-brakresan/uNN.mjs`
(`audit(task, { grade })` per uppgift: tillåtna tal, facit, alla alternativa rätta svar,
unikhet, missuppfattningsalternativ; `plan(omgångar)` över 100 omgångar: t.ex. "minst fyra
cirklar", "minst tre finare indelningar") + tre omgångar i följd med `avoidCores`. E/F/G lägger
en `uNN.mjs` per utmaning och en rad i sin testfil (mönster: `test/brakresan-utmaningar-d.test.js`).

**`minVariants` (D #709):** när utmaningens EGNA talgränser i §8 ger färre än 60 kärnor får
`defineChallenge` ange `minVariants` (30–59) + `minVariantsReason`. Bara 34 använder det:
nämnare 2–8, mgn ≤ 24, summa ≤ 1 och förkortade äkta addender ger exakt 42 talpar.

**Flerstegsuppgift med stavar (`view.component: "omdelning"`, 34):** `bars: [{ parts, marked,
label, maxDela }]` (verktyget "Dela varje bit i k", k ≤ maxDela), `expr` med `{ input: "id" }`
per delsvar, `answer.type: "multi"`. Ritas av `omgang-uppgift.js`, inte av komponentbiblioteket.
Kort med `view.stavar: true` (12) får jämförelsestavar under korten bara medan hjälpen är
öppen på ett steg med `highlight: { stavar: true }` – aldrig från början (lika långa
markeringar avslöjar svaret) och utan facitetikett. Stängs hjälpen döljs de; öppnas den
igen visas senaste stegets markering (`createHjalp`).

Granskningen (`reviewChallenge`) körs automatiskt för varje byggd utmaning i
`test/brakresan-generatorer.test.js`: 200 seeds, determinism, schema, rätt/fel-exempel,
facitläckor, ≥ 60 olika kärnor, reservbanken, 20 omgångsplaner utan dubbletter. Lägg
utmaningens egna matematikkontroller (tillåtna tal, unik trippel, sektorvinklar …) i en egen
testfil `test/brakresan-uNN.test.js`.

### Omgången

`planRound(challenge, { seed, avoidCores })` (servern) → tio `{ index, role, params, core, source }`.
Tio olika kärnor alltid; tidigare kärnor undviks i de första 30 försöken per slot, sedan
släpps de; efter 60 försök tar reservbanken över; annars `PlanError`. `buildTask` bygger
uppgiften, `publicTask` tar bort facit, `revealTask` ger det som visas efter kontroll.

## 5. Komponent-API (B #707 – byggt)

Alla tolv komponenter (§4) bor i `src/brakresan/komponenter/` och laddas lat. De ritar
**bara ur data** (uppgiftens `view`) och vet ingenting om facit. Gemensamt gränssnitt:

```js
// src/brakresan/komponenter/<namn>.js
export function create<Namn>(host, view, opts) → {
  el,                      // rotnoden komponenten äger (SVG eller DOM)
  getAnswer(),             // elevens aktuella svar i bedomning.js-form, eller null
  setAnswer(answer),       // återställ (återupptagning, bearbetning efter fel)
  reset(),                 // tillbaka till utgångsläget
  setLocked(locked),       // efter "Kontrollera": inga ändringar (bearbetning låser upp igen)
  showResult(result),      // efter bedömning: kontur/mönster + text, aldrig bara färg
  highlight(target),       // hjälpen pekar ut helheten/delarna, t.ex. { whole: true } – inget facit
  onChange(cb),            // vid varje ändring – sidan aktiverar "Kontrollera"
  destroy(),               // släpp lyssnare, stoppa animationer
}
// opts = { interactive: true, size: "stor"|"kort"|"mini", label, reducedMotion, sound }
```

Gemensamma regler: klickytor ≥ 44×44 px, tangentbord (pilar/mellanslag/Enter), pekplatta och
touch; dragmål har klickalternativ; helheten märks ("Hela staven = 1"); etiketter, andelar och
delningar ur datan; `aria-label` ur `math/words.js` utan att ge facit.

| # | Komponent (`view.component`) | `view`-data (skiss) | Svarstyper |
| --- | --- | --- | --- |
| 1 | `notation` | `{ expr: [form \| { op: "+"\|"−"\|"·"\|"÷"\|"=" } …], input?: "fraction"\|"mixed"\|… }` – bråkstreck, blandad form, relationstecken | `number`, `relation` |
| 2 | `stav` | `{ wholes, parts, marked, regroup?: k, pieces?: [...], label }` – omdelning behåller helhetslängd | `paint`, `number` (via notation) |
| 3 | `cirkel` | `{ wholes, parts (≤ 12), marked }` – exakt 360°/n | `paint` |
| 4 | `rutnat` | `{ rows, cols, marked, regions?: [{ cells }] }` – olika form, lika area | `paint` |
| 5 | `hundraruta` | `{ wholes: 1\|2, marked }` – 10×10, rader och celler, tangentbord | `paint` |
| 6 | `tallinje` | `{ min, max, ticks, labels, points?: [{ id, value }], snap }` – x(v) linjär | `point`, `choice` |
| 7 | `mangd` | `{ count, marked, groups?, item }` – identiska föremål | `paint`, `number` |
| 8 | `kort` | `{ cards: [{ id, face: view \| form \| text }] }` – neutrala kort | `select`, `choice`, `pairs` |
| 9 | `sortering` | `{ cards, bins?: [{ id, label }], order?: true }` | `categories`, `order` |
| 10 | `areamodell` | `{ vertical: {n,d}, horizontal: {n,d} }` – överlappning mot ursprunglig helhet | `paint`, `number` |
| 11 | hjälppanel | `task.help` – steg för steg, "Nu provar du själv" | – |
| 12 | resultat/belöning | `{ correct, reward, message }` (`resultMessage`, `regler.js`) | – |

**Delarnas id**: `paint`-svar listar delarnas id. Konvention: `"p0"` … `"p{N−1}"` i läsordning
(helhet för helhet; stav vänster→höger; cirkel medurs från klockan 12; rutnät rad för rad).
Generatorn lägger samma lista i `answer.parts`.

### Så används biblioteket (D, K och utmaningarna)

```js
const { mountTask, createHjalp, createAterkoppling, createResultat } =
  await import("./komponenter/index.js");             // lat – aldrig statiskt
const t = await mountTask(yta, publicTask, { size: "stor" });
t.onChange(() => kontrollera.disabled = !t.getAnswer());
t.onSubmit(kontrollera);                               // Enter i ett giltigt svarsfält
const r = t.validate();                                // inmatningshjälp före anrop: { ok, message }
t.setLocked(true); t.showResult(serverSvar);           // { status: "graded", correct }
```

- `mountTask(host, task, opts)` ritar `task.view` och, när svaret är `number`/`relation` och
  modellen inte själv tar det, en notationsrad under (`view.expr` + svarsfälten). Svaret kommer
  alltid från rätt del. `multi` sätts ihop av sidan med `createComponent` per del.
- `createComponent(host, view, opts)` – en enskild komponent. `opts.answer` = uppgiftens
  offentliga `task.answer` avgör läget (målning, punkt, val, par …); utan `answer` = visning.
  `interactive: false` + `size: "mini" | "kort"` = bild i kort, hjälp, lista. Visningsläget får
  en beskrivning för skärmläsare ("Cirkel delad i 4 lika delar, 3 markerade"); svarsläget
  beskriver aldrig facit ("Del 2 av 5").
- `highlight(target)`: `{ whole: true }` (helhetens ram + etikett), `{ count: true }` (delarna
  numreras; på tallinjen delsträckorna, inte strecken), `{ marked: true }`, `{ ids: [...] }`,
  `{ overlap: true }` (areamodellen), `{ groups: true }` (mängden), `null` rensar.
- Extra: stav `regroup(k)` (omdelning i hjälpen, samma markerade längd), areamodell
  `steg("lodratt" | "bada")`, stav `pieces()` (flyttbara delar), notation `focus()`.
- `view`-fälten utöver skissen ovan: stav `bars: [{ parts, marked, label }]` (jämförelse,
  samma längd) och `pieces: [{ id, d }]`; rutnät `regions: [{ cells }]` (olika form, lika area –
  delarna är då regionerna) och `second: [cell]` (andra färgen); tallinje `labels: "alla" |
  "hela" | [värden]`, `points[].label`; mängd `item: "kula" | "stjarna" | "knapp" | "kloss"`;
  sortering `ends: ["Minst", "Störst"]`; areamodell `show`; notation `expr` med `{ input }`,
  `{ relation }`, `{ okand }`, `{ text }`.
- Hjälppanelens steg kan ha `highlight` (pekar på elevens modell) och `view` (en egen liten
  modell med andra tal). `onStep(steg)` anropas när ett steg visas – sidan registrerar hjälp
  före/efter fel. "Tillbaka till uppgiften" lämnar fokus till `returnFocus`. Ordlistan finns i panelen.
- Resultatet tar `roundReward`-utfallet + `starsBefore` + `results` (tio booleans) + `suggestions`
  (0–5 rätt) och skriver texten med `resultMessage` (regler.js). Mynt visas bara när `coins > 0`.
- Rätt/fel visas med kontur + ikon + text: rätt = dubbel heldragen ram + ✓ "Rätt!", fel =
  streckad ram + ↻ "Inte riktigt ännu". Valda delar = turkos + prickmönster. Ljud spelar
  komponenterna aldrig – sidan använder `fx.js` (användarens ljudval).
- Geometrin (`komponenter/geometri.js`) är ren och testad: sektorer exakt 360°/n, stav exakt
  helhet/n, omdelning bevarar markerad längd, tallinjens x(v) och snäppning, 100 celler,
  regioner med lika area, överlappningen = produkten, varje föremål en gång.

## 5b. Utmaningsvyn och omgångsflödet (D #709 – byggt)

| Fil | Innehåll |
| --- | --- |
| `page-brakresan.js` | route-skalet: `#/elev/brakresan` huvudvyn (H #713, §5c), `?u=NN` utmaningsvyn, `?u=NN&lage=test` testomgång utan server |
| `omgang.js` | `createUtmaningsvy(host, { challengeId, backend, onBack, onOpen, onReward })`: före (mål, stjärnor, exempelbild, Starta/Fortsätt + uttryckligt val för ny, Prova ett exempel, Tillbaka), under (Uppgift X av 10, Kontrollera, hjälp i fyra steg, Försök igen/Fortsätt, Sparar …/Sparat, Avsluta omgången), efter |
| `omgang-uppgift.js` | `monteraUppgift(host, publicTask, opts)` – mountTask + `omdelning` + jämförelsestavar + tallinjens värdetext utan bråknamn; `promptNod(text)` skriver "3/5" med vågrätt bråkstreck |
| `omgang-backend.js` | `serverBackend(id)` (data.js, lat) och `demoBackend(id, { seed })` – samma regler helt i klienten, `fullTask(i)` ger facit (lärarens testläge K) |
| `omgang-resultat.js` | `visaResultat` (createResultat + kläckning/nivå + genomgång av felen), `forslag(id)` (0–5 rätt), `svarText(task, answer)` (genomgång, K:s historik) |

Utmaningsvyn öppnas med `#/elev/brakresan?u=NN` (huvudvyn, §5c). **K #716** kan återanvända `createUtmaningsvy` med
`demoBackend` (testläget) och `monteraUppgift`/`svarText` i historiken.

Förhandsvisning: `PORT=8709 node server.mjs` → `preview/preview-brakresan-omgang.html?u=03` (testomgång).
Riktiga kedjan mot emulatorn: `bash admin/qa-brakresan-preview.sh` (Auth + Firestore + Functions,
elev1 / lilla123, proxy 8711) – proxyns vitlista har `brakresa*`.

## 5c. Huvudvyn och drakpanelen (H #713 – byggt)

| Fil | Innehåll |
| --- | --- |
| `huvudvy.js` (+ `huvudvy.css`, lat) | `createHuvudvy(host, { state, rek, href, drakpanel })`: rubrik + intro, X/150 stjärnor och Y/50 bemästrade, drakkortet (vid sidan ≥ 760 px, annars ovanför listan), ankarlänkar till de fem ämnesrubrikerna, "Börja här" (lärarens rekommendationer, länkar till ordinarie kort), sök + filter (Alla / Inte bemästrade / Bemästrade / Rekommenderade), alla 50 kort. Listans läge (filter, sök, scroll, fokus) sparas i sessionStorage när ett kort öppnas och återställs. Spelar kläckning/evolution som inte visats (`state.dragon.levelShown` < nivån) och kvitterar med `ackDragon`. |
| `huvudvy-lista.js` | Ren logik: `filtrera`, `matcharSok` (namn, mål, taggar, nummer; å/ä/ö-okänslig), `kortStatus` (status + ikon + stjärnor + "Senast 8 av 10"), `sammanfattning`, `rekommendationer(docs)`, `listlage`. `test/brakresan-huvudvy.test.js`. |
| `miniatyr.js` | `miniatyrSvg(id)` – en egen statisk SVG per utmaning (80 × 60, aria-hidden), utan komponentbiblioteket. |
| `drakpanel.js` (+ `drakpanel.css`, lat) | **Gemensam panel för Bråkresan och huset (I #714):** `oppnaDrakpanel({ state, byt?, jakt?, forandring?, onVisad?, onNamn?, fokusTillbaka?, idag? })` = `<dialog>` med draken, namn + "Byt namn", nivå, stjärnor totalt, nästa tröskel, guldjaktens status/intervall/genomförda/funna mynt, "Fullt utvecklad" vid 150. Ägget: kläckningsmål, ingen jaktknapp. `forandring: { fran, till }` spelar `spelaKlackning` (fran 0, sedan namnfrågan) eller `spelaEvolution` först – "Hoppa över" finns, och stängd panel räknas som visad. `createDrakkort(host, { state, oppna })` = huvudvyns kompakta kort. `drakInfo(state)` = texterna (testad). Egen CSS och egna knappar (`bdp-*`) – beror inte på Bråkresans CSS. |

**J #715** ritar jaktknappen och animationen via `jakt(yta, info)` (yta = panelens jaktruta,
`info.jakt` = `{ max, intervallText, antal, mynt, klarIdag }`). **I #714** öppnar samma panel från
huset med `oppnaDrakpanel({ state: await getState() })`; namnbytet går via `renameDragon` i data.js.

Navigation (H): `NAV_LANKAR` i `ui.js` (grupp `ova`, `modul: "brakresan"`) + `TOGGLABLE_MODULES`
i `gamemode-visibility.js` – **synlig som standard, döljbar per klass** (`hiddenModules`, som
Läsresan). Regelns modullistor validerar bara längden, så ingen regeländring behövs.

## 6. Server-API – kontrakt för C (#708) och J (#715)

Callables i `functions/index.js` (region `europe-west1`), kärnan i `functions/brakresan-core.js`
med deps-injektion som `hitta-ratt-core.js`. Delad kod ur `functions/brakresan/` (synk).
Bara inloggade **elever** (`request.auth.uid`); ingen lärarväg muterar elevdata. Fel →
`HttpsError` med svensk text: `unauthenticated`, `permission-denied` (annans omgång, lärare),
`not-found`, `failed-precondition` (omgången inte aktiv, alla tio inte bedömda, ägg kan inte
jaga, utmaningen inte byggd), `invalid-argument`.

| Callable | In | Ut | Transaktion och idempotens |
| --- | --- | --- | --- |
| `brakresaStartRound` | `{ challengeId, restart?: bool, replaceRoundId? }` | `{ roundId, resumed, round }` (round = dokumentet: publika uppgifter + svar) | Finns `state.challenges[id].activeRoundId` och `restart` saknas: returnera den (återupptagning). `restart: true`: gamla → `avbruten` (ingen belöning) och ny skapas – i samma transaktion. `replaceRoundId` (rekommenderas): byt bara om den aktiva fortfarande är just den – annars återupptas den aktiva (dubbelklick, två flikar). Seed med `node:crypto`; `planRound(ch, { seed, avoidCores })` med kärnorna från de senaste tre avslutade omgångarna; `brakresaSecrets/{roundId}` + `brakresaRounds/{roundId}` + `state` skrivs tillsammans. |
| `brakresaAnswer` | `{ roundId, index, answer, helpBefore: [steg] }` | `{ status: "graded", correct, reason, message, reveal, answeredCount, correctCount }` eller `{ status: "invalid", error, message }` | Bedöms mot `brakresaSecrets` (sparade uppgifter, inte en ombyggd). Har `answers[index].first` redan satts svaras det SPARADE utfallet (`already: true`) – första giltiga svaret är låst. `invalid` sparas inte. Uppdaterar `state` (firstCorrect/firstTotal/helpBefore/activeAnswered/lastActivityAt). |
| `brakresaRework` | `{ roundId, index, answer?, helpAfter?: [steg], attemptId? }` | `{ status: "graded"\|"invalid"\|"ok", correct, message, reworkCount }` | Bara efter ett fel; ≤ 5 försök sparas; ändrar ALDRIG `first`/poängen. `attemptId` (`data.newAttemptId()`) gör omförsöket idempotent. |
| `brakresaFinishRound` | `{ roundId }` | `{ correctCount, reward: { kind, eventId, coins, starOrdinal }, message, rewardText, stars, totalStars, dragon: { levelBefore, levelAfter, hatched }, coinsAfter, already }` | Kräver tio `first`. EN transaktion: läs färska `state.challenges[id].stars` → `roundReward` → skapa `brakresaRewards/{stjarna-NN-ordinal \| uppmuntran-NN}` om det inte finns → `coins += amount` → `state` (stars, totalStars, mastered, best/last, kläckning: `dragon` + `studentData.brakdrake`, `brakdrake.level`) → omgången `avslutad` med `reward` och `cores`. Omförsök: svara `round.reward` (`already: true`). Finns belöningsdokumentet redan (state ur fas) betalas inget igen. Två omgångar som tävlar om tredje stjärnan: transaktionen avgör ordinalen; den andra blir `repetition`. |
| `brakresaAbortRound` | `{ roundId }` | `{ status: "avbruten" }` | Ingen belöning; besvarade uppgifter finns kvar i statistiken. |
| `brakresaAckDragon` | `{ level }` | `{ levelShown }` | Sätter `state.dragon.levelShown` = max(gammal, level ≤ aktuell nivå) – kläckning/evolution visas en gång, progressionen är redan sparad. |
| `brakresaRenameDragon` (H #713) | `{ name }` | `{ name }` | `cleanDragonName` (regler.js: inga HTML-/styrtecken, 1–16 tecken) på servern; ägget → `failed-precondition`, tomt → `invalid-argument`. EN transaktion: `state.dragon.name` + `studentData.brakdrake.name` (merge – placering och nivå orörda). Kläckningen sätter standardnamnet `DRAGON_DEFAULT_NAME` ("Bråkis") direkt, så namnvalet blockerar aldrig. |
| `brakresaHunt` (J) | `{}` | `{ date, level, max, amount, coinsAfter, already }` | Datum = `stockholmDate(serverns now)`. Ägg → `failed-precondition`. EN transaktion: finns `brakresaHunts/{datum}` → svara den (`already: true`); annars `amount = randomInt(1, max + 1)`, skapa jaktposten + `brakresaRewards/jakt-{datum}` + `coins += amount` + `state.hunts`. |

Invarianterna i §13 och var de garanteras:

| Invariant | Mekanism |
| --- | --- |
| Unik första bedömning per omgång och uppgift | `answers[i].first` sätts bara om den är `null`, i transaktion |
| Högst tre stjärnor per elev/utmaning, unik ordinal | Dokument-id `stjarna-NN-1..3` + `roundReward` med färska stjärnor |
| Högst en stjärna per omgång | `round.reward` sätts en gång; omförsök returnerar den |
| Högst en uppmuntran per utmaning, ingen efter bemästring | Dokument-id `uppmuntran-NN` + `encouragementPaid` + `roundReward` |
| Unik jakt per elev/datum | Dokument-id `brakresaHunts/{ÅÅÅÅ-MM-DD}` |
| Unik valutahändelse per belöning | Belöningsdokumentet och `increment` i samma transaktion |
| En Bråkdrake per elev | `state.dragon` skapas bara när den är `null` |
| 0 ≤ totalStars ≤ 150, nivåformeln | `totalStars` = summan i samma transaktion; nivå ur `dragonLevel` |

**Vem får anropa (C):** bara inloggade elever. Lärarkonton (`token.teacher`) får
`permission-denied` i alla `brakresa*` – testläget behöver inga anrop. En annans omgång
ligger under ägarens `studentData` och svarar `not-found`. `rewardText` är
"Ny stjärna! +40 mynt" / "10 mynt för ditt arbete" (§2: aldrig "tröstpris"), `null` utan mynt.

**Index (C, inlagt i `firestore.indexes.json`):** omgångshistoriken frågar `brakresaRounds` med `challengeId ==`, `status ==` och
sorterar på `finishedAt` → sammansatt index i `firestore.indexes.json`.

**Klientens dataskikt (C, klart):** `src/brakresan/data.js` (lat) – API:t står i filhuvudet:
`startRound`, `answer`, `rework`, `finishRound`, `abortRound`, `ackDragon`, `renameDragon`, `newAttemptId`,
`getState`, `getRound`, `getRecommendations(classIds)`, lärarens `getClassStates(studentIds)` / `listRounds(studentId, { challengeId })`.
J lägger till `hunt` här. Nätfel och tillfälliga serverfel försöks igen automatiskt med
SAMMA data (`data-core.js` `callWithRetry`, 3 omförsök); ger det upp kastas `BrakresaFel`
med `retryable: true` – vyn behåller elevens inmatning (`drafts.save/load/clear`) och
visar "Försök igen". `saveStatus.subscribe(cb)` ger "sparar" / "sparat" / "offline" / "fel"
för "Sparar …/Sparat" (§13). Bekräfta aldrig en belöning förrän `finishRound` svarat.
`finishRound` invaliderar studentData-cachen så att sidomenyns saldo uppdateras.

**Lärarens testläge och "Prova ett exempel"** körs helt i klienten: `loadChallenge(id)` →
`planRound`/`buildTask` med en lokal seed → `gradeTask` lokalt, facit (`key.display`) synligt för
läraren. Inga skrivningar alls – därför kan testläget aldrig röra elevdata (§12).
Färdigt i `src/brakresan/demo.js`: `demoRound(id, seed)` (tio hela uppgifter med facit),
`exampleTask(id, seed)`, `gradeDemo(challenge, task, answer)` (+ `reveal`), `publicTask`.

## 7. Ägarskap och filkarta

| Sub-issue | Äger |
| --- | --- |
| A #706 | `src/brakresan/{math,schema}/`, `utmaningar/index.js`, docs här, regelskelettet |
| B #707 | `src/brakresan/komponenter/`, `preview/preview-brakresan-komponenter.html` |
| C #708 | `functions/brakresan-core.js`, callables i `functions/index.js`, regler/index vid behov, `src/brakresan/data.js` |
| D #709 | `utmaningar/u03.js`, `u12.js`, `u19.js`, `u34.js`, omgångsvyn (`src/brakresan/omgang*.js`), route, `admin/qa-brakresan-generatorer.mjs` |
| E #710 / F #711 / G #712 | `utmaningar/u01–u20.js` / `u21–u35.js` / `u36–u50.js` (utom D:s fyra) |
| H #713 | huvudvyn (`huvudvy*.js`, `miniatyr.js`), drakpanelen (`drakpanel.js`), navigationen (`ui.js`, `gamemode-visibility.js`), `brakresaRenameDragon` |
| I0 #718 / I #714 | drakens grafik och animation, `studentData.brakdrake` i huset |
| J #715 | guldjakten |
| K #716 | lärarvyn, rekommendationer, testläget |

Ändras något i `math/`, `schema/` eller `utmaningar/`: kör `npm run sync:brakresan`
(annars fäller `test/brakresan-delat.test.js`).

## 8. Beslut och risker för leaden

1. **Synlighet (H #713):** synlig som standard och döljbar per klass (som Läsresan) –
   specen säger "nås naturligt från befintlig elevnavigation". Servern kontrollerar inte
   modulsynligheten (en dold modul nås inte via menyn eller routen).
2. **`studentData.coins` är elevskrivbart** i hela appen sedan tidigare (`addCoins` i klienten).
   Bråkresan skapar aldrig mynt från klienten och kan inte manipuleras via sina egna samlingar,
   men saldot som sådant går inte att låsa utan en migrering av hela appens myntflöde – utanför
   modulen (§13: "Påbörja inte en godtycklig migrering").
3. **Draken i `studentData.brakdrake`**, inte `roomAnimals` (§2 ovan). Cachad `level` där är
   kosmetisk; allt som ger mynt utgår från `state`.
4. **Deploy:** reglerna och functions måste deployas tillsammans när modulen släpps
   (`firebase deploy --only firestore:rules,firestore:indexes,functions`).
