# Schack

Uppdraget: [`UTVECKLINGSUPPDRAG_SCHACK.md`](UTVECKLINGSUPPDRAG_SCHACK.md). Det här
dokumentet beskriver det som är byggt. Etapp 1 byggs i tre delar:

| Del | Issue | Innehåll |
| --- | --- | --- |
| A | #775 | chess.js, brädet, pjäserna, förhandsvisningen (§1–§2) – **klar** |
| B | #776 | motorn, nivåerna, hjälpen mot datorn och elevens schacksida (§3–§4) – **klar** |
| C | #777 | slut-QA och rapport (§5) – **klar**, se [`RAPPORT-schack-etapp-1.md`](RAPPORT-schack-etapp-1.md) |

Etapp 2 (elev mot elev, epic #773):

| Del | Issue | Innehåll |
| --- | --- | --- |
| 2A | #779 | datamodellen, reglerna, alla callables, delad logik och klient-API:t (§6–§8) – **klar**, avsnitt 12 |
| 2B | #780 | lobbyn, partiet, klockan och topplistan i elevens UI (§7–§8) – avsnitt 14 |
| 2C | #781 | lärarens sektion med åskådarläget (§10) – **klar**, avsnitt 13 |

---

## 1. Arkitektur

Allt ligger i `src/schack/` och laddas **bara med `import()`** – ingen fil därifrån
får ligga i app.js statiska importgraf (#271, se incidenten om bootgrafen).
`test/schack-grund.test.js` kontrollerar det.

```
src/schack/
  vendor/chess.js            chess.js 1.4.0 (ESM), oförändrad – all regelkontroll
  vendor/LICENSE             chess.js-licensen (BSD-2-Clause)
  schack-kontroll.js         brädets logik utan DOM: tryck, släpp, förvandling, ångra, beforeMove …
  schack-text.js             rena hjälpare: svensk notation, aria-etiketter, status, slut, tagna, draglista
  schack-pjaser.js           de egna SVG-pjäserna
  schack-bradet.js           komponenten: DOM, rendering, glidanimation, slutruta (API:t nedan)
  schack-bradet-inmatning.js pointer events (mus/touch/penna) och tangentbord
  schack-bradet-delar.js     markup: spelarrad, pilar, förvandlingsväljare, slutruta
  schack-motor.js            motorn (B, avsnitt 7): alfa-beta, nivåerna, seedad slump – ren, körs i workern och i node
  schack-motor-worker.js     Web Worker-skalet runt motorn
  schack-dator.js            datorn i sidan: löftes-API över workern, reserv i huvudtråden, vakt
  schack-varning.js          "Varna mig": matt i ett och hängande dam/torn (avsnitt 8)
  schack-parti.js            partiet som data + localStorage (try/catch), nivå-/färgval
  schack-dator-vy.js         partivyn: brädet + panelen (Ångra, Tips, Varna mig, Ge upp)
  schack-sida-delar.js       markup: startsidans kort, pågående parti, nivå-/färgväljaren
  schack-flode.js            elevflödet start → nivåval → parti → slutruta (utan ui.js/data.js)
  page-schack.js             routen #/elev/schack (kopplar flödet till ui/data/avatar)
  schack-moln.js             klient-API:t mot callables och de två lyssnarna (2A, avsnitt 12.4)
  schack-kompis.js           EN delad lyssnare på klassdokumentet (2B, avsnitt 14)
  schack-lobby-vy.js         lobbyn "Spela mot en kompis" + rutan för inkommande utmaningar
  schack-kompis-vy.js        partiet mot en kompis: brädet, klockorna, remi, ge upp, §7.3
  schack-kompis-data.js      ren logik: klockvisning, lobbyfilter, topplistan, §7.3, slutrutan
  schack-kompis-delar.js     markup för lobbyn och utmaningsrutan
src/styles/35-schack.css     brädets CSS, 36-schack-sida.css sidans, 37-schack-kompis.css kompisläget (byggs in i styles.css med npm run build:css)
preview/preview-schack.html         brädet och pjäserna (A; preview/schack/)
preview/preview-schack-dator.html   hela elevflödet mot datorn utan Firebase (B)
preview/preview-schack-matning.html mätning av ms per drag och nivå (B, preview/schack/matning.js)
preview/preview-schack-kompis.html  kompisläget i två flikar utan Firebase (2B, preview/schack-kompis/)
admin/qa-schack-matning.mjs         samma mätning i node
```

Allt laddas lazy i kedjan `app.js → import(page-schack.js) → import(schack-flode.js) →
import(schack-dator-vy.js)`; motorn laddas av workern (`new Worker(new URL("./schack-motor-worker.js",
import.meta.url), { type: "module" })` – adressen bygger på modulens egen URL och fungerar
därför på GitHub Pages med basväg och på egen domän). `test/schack-sida.test.js` kontrollerar
kedjan och att `app.js` bara har ett `import()`.

**Lagren.** `schack-kontroll.js` äger tillståndet (en chess.js-instans, markering,
förvandling, väntande drag, senaste drag, pilar, orientering, vem som får flytta)
och skickar ett nytt tillstånd till lyssnarna efter varje ändring. Brädet ritar
bara det tillståndet och skickar tillbaka elevens tryck, släpp och tangenter. Så
kan hela interaktionen testas i node utan webbläsare (`test/schack-kontroll.test.js`).

**Ingen egen regelkod.** Lagliga drag, rockad, en passant, förvandling, schack,
matt, patt och remi (trefaldig upprepning, 50-dragsregeln, för lite material)
frågas från chess.js. Bara lagliga drag visas som prickar/ringar och bara de kan
göras: ett drag som ställer eller lämnar den egna kungen i schack finns aldrig
bland målrutorna och nekas om pjäsen ändå släpps där.

## 2. Brädet

### 2.1 Utseende

- **Rutor:** ljus sand `#f2e4c4` och dämpad grön `#8daf7e`; koordinaterna a–h/1–8 står
  i kanten i den andra rutans färg.
- **Pjäser:** egna SVG:er (avsnitt 4).
- **Markeringar:** vald pjäs och senaste draget får gul ton, möjliga drag en prick
  (tom ruta) eller ring (slag), kungen i schack en röd glöd, pilar (Tips) är orange.
- **Storlek:** `--schack-storlek: max(320px, min(100%, 640px, 100svh - 250px))` –
  följer bredden och höjden men blir aldrig mindre än 320 px. Behållaren måste alltså
  ge minst 320 px (på en 360 px-mobil: högst 20 px marginal per sida).
- **Vänds** efter `orientering` (standard: elevens färg, annars vit nederst).

### 2.2 Att flytta (som på chess.com)

| Handling | Resultat |
| --- | --- |
| Tryck på egen pjäs | markeras, möjliga drag visas |
| Tryck på markerad målruta | draget görs (glider ~150 ms) |
| Tryck på annan egen pjäs | byter markering |
| Tryck på samma pjäs / någon annanstans | avmarkerar |
| Dra och släpp (mus, finger, penna – pointer events) | draget görs utan glidning; olagligt släpp = pjäsen hoppar tillbaka och står kvar markerad |
| Bonde till sista raden | väljaren: Dam (först, förvald, får fokus), Torn, Löpare, Springare; Escape/Avbryt/klick utanför ångrar |
| Tangentbord | Tab till brädet, pilarna flyttar (som eleven ser brädet), Enter/mellanslag väljer, Escape avmarkerar |

- `touch-action: none` på brädet, så att ett finger som drar en pjäs inte skrollar sidan.
- Glidningen stängs av vid `prefers-reduced-motion` (eller `reducedMotion: true`).
- Varje ruta har `role="gridcell"` och `aria-label`, t.ex. "e4, vit springare",
  "e5, tom, möjligt drag", "e1, vit kung, i schack". Statusraden är `role="status"`.

### 2.3 Runt brädet

Spelarrad överst och nederst (avatar, namn, "På tur", tagna pjäser och
materialövervikt +N), statusraden ("Din tur", "Datorn tänker…", "Schack! …",
"Schack matt – du vann! 🎉", "Remi – ingen vann" + en förklaring), draglistan i
svensk notation ("1. e4 e5 2. Sf3", K D T L S) bakom knappen **Visa drag**, och
en slutruta ovanpå brädet med valfria knappar + "Titta på brädet".

Tagna pjäser räknas ur draghistoriken. En ställning som laddas med
`setPosition(fen)` har ingen historik – ladda partier med `loadGame` så stämmer de.

## 3. API

```js
const { skapaSchackbrade } = await import("./schack/schack-bradet.js");
const brade = skapaSchackbrade(element, {
  fen,                    // startställning (annars utgångsställningen)
  egenFarg: "w",          // elevens färg: styr statusraden och orienteringen; null = båda för hand
  motstandare: "dator",   // "dator" | "kompis" | null
  namn: { w: "Elias", b: "Bonden" },
  avatar: { w: avatarMarkup(...), b: "<svg…>" },   // färdig markup, annars en liten bonde
  interaktiv: "w",        // true = den som är på tur (båda), "w"/"b" = bara den färgen, false = ingen
  orientering: "w",       // standard: egenFarg ?? "w"
  slutKnappar: [{ text: "Spela igen", onClick }],
  reducedMotion: false,
  beforeMove(drag, state) { … },   // se nedan
  onMove(drag, state) { … },       // efter varje drag (elevens och kodens)
  onGameOver(slut, state) { … },   // { resultat: "1-0"|"0-1"|"½-½", orsak, vinnare }
});
```

| Metod | Vad den gör |
| --- | --- |
| `move(drag)` | gör ett drag från koden (datorn, servern): `{from, to, promotion?}` eller SAN (`"Nf3"`). Förvandling utan `promotion` = dam. Går **inte** genom `beforeMove`. Null om olagligt. |
| `setPosition(fen, { senast? })` | ny ställning utan historik; `senast = {from, to}` markeras. False om FEN:en är ogiltig (inget ändras). |
| `loadGame({ fen?, drag })` / `getGame()` | ett helt parti (startställning + drag) in/ut – formatet att spara i `localStorage`. |
| `undo(n = 1)` | ta tillbaka n drag (Ångra: `undo(2)` = elevens drag + datorns svar). Returnerar antalet. |
| `setOrientation("w"\|"b")`, `flip()` | vänd brädet. |
| `setInteractive(true\|false\|"w"\|"b")` | vem eleven får flytta (t.ex. `false` medan datorn tänker). |
| `showArrow(from, to)`, `clearArrows()` | pil på brädet (Tips). Pilarna försvinner vid nästa drag. |
| `setStatus(text\|null)` | egen statustext tills nästa drag (`null` = den automatiska). |
| `setSpelare({ egenFarg?, motstandare?, namn?, avatar? })` | byt spelare/namn/avatar. |
| `avsluta({ resultat, orsak, vinnare, titel?, text? })` | avsluta utifrån (gav upp, tid, avbrutet) – `titel` blir statusrad och slutrutans rubrik. |
| `setSlutKnappar([{ text, onClick }])` | knapparna i slutrutan. |
| `setSpelarExtra({ w?, b? })` | extra markup längst till höger i spelarraden per färg (klockan i kompisläget, 2B) – skrivs direkt, brädet ritas inte om. Även som `opt.spelarExtra`. |
| `getState()`, `getFen()`, `getHistory(verbose?)`, `lagligaDrag(ruta)` | läs tillståndet. |
| `subscribe(fn)` | `fn(state, händelse)` efter varje ändring; returnerar avregistrering. |
| `tryck(ruta)`, `slapp(från, till)`, `valjForvandling(typ)` | samma anrop som mus/touch/tangentbord gör (för tester och automatisering). |
| `destroy()` | ta bort lyssnare och DOM. |

**Ett drag** (`onMove`, `beforeMove`, `lagligaDrag`) är vanliga data:
`{ from, to, promotion, piece, color, captured, flags, san, sanSv, fore, efter }`
(`san` = chess.js-notation, `sanSv` = svensk, `fore`/`efter` = FEN).

**`beforeMove` – fånga ett drag innan det görs** (B:s "Varna mig", Etapp 2:s server):

- Returnerar den `false` görs draget inte (pjäsen står kvar).
- Returnerar den ett löfte visas pjäsen **halvgenomskinlig på målrutan** och brädet
  är låst tills löftet är klart. Blir svaret `false` (eller löftet avvisas) hoppar
  pjäsen tillbaka; annars görs draget. Har ställningen ändrats under tiden görs inget.
- Allt annat (`true`, `undefined`) släpper igenom draget direkt.
- Gäller bara elevens drag – `move()` från koden passerar aldrig här.
- `setPosition`, `loadGame`, `undo` och `avsluta` under väntan avbryter den: spökpjäsen
  försvinner direkt och det sena svaret gör ingenting (inte heller mot en nyare väntan).

**Fel i sidans callbacks** (`onMove`, `onGameOver`, `subscribe`) fångas och loggas med
`console.error` – draget är redan gjort, brädet fortsätter och `onGameOver` kommer ändå.

## 4. Pjäserna

`pjasSvg(farg, typ, { storlek?, klass?, titel? })` i `schack-pjaser.js` ger en SVG-sträng
(viewBox `6 6 88 88`). Stil enligt `src/art-style.js`: platt, mjuka rundade former,
mörklila kontur `#3B3350`, runda ändar/hörn, inga gradienter. Vita är krämvita
`#FFF3DC`, svarta mörkt skiffergrå `#555C6E` med ljusa detaljlinjer. Varje pjäs har en
egen siluett som går att känna igen i 40 px: bondens runda huvud, tornets tre tinnar,
springarens hästhuvud, löparens mitra med skåra, damens krona med fem kulor och
kungens kors. Inga unicode-schacktecken används (testat).

Skärmdumpar för godkännande: `design/schack/` (pjäserna i 120 px och 56/40/28 px,
brädet mitt i ett parti, i schack med pil, på en 360 px-mobil, förvandlingsväljaren
och slutrutorna).

## 5. Förhandsvisning och tester

- `preview/preview-schack.html` – spelbart bräde (båda sidor för hand), färdiga
  ställningar (rockad, en passant, förvandling, schack, bunden pjäs, matt, patt,
  för lite material, upprepning; direktlänk `?st=<id>`), alla pjäser i flera
  storlekar, förvandlingsväljaren och sex slutrutor. Kryssrutor provar `beforeMove`
  (fråga först, låtsasserver som väntar/nekar) och `setInteractive`.
  `window.brade` är det spelbara brädet (för test i konsolen).
- `node --test test/schack-kontroll.test.js test/schack-grund.test.js` – logiken via
  API:t, bootgrafen, licensen, pjäserna, texterna och geometrin.
- Slut-QA i riktiga appen (#777): `admin/qa-schack-app.mjs <origin> <steg>` driver en elev mot
  emulatorerna (`admin/qa-emulator-proxy.mjs`) med riktiga mus-, touch- och tangenthändelser via
  CDP – stegen `nivaer`, `bradet`, `hjalp`, `layout` och `kvot` (Firestore-räkning med
  `QA_RAKNA=1`). `admin/qa-schack-strypt.mjs <origin>` mäter tiden per drag med CPU-strypning.

## 7. Motorn (§3.1) – `schack-motor.js`

**Sökning.** Negamax med alfa-beta, iterativ fördjupning (djup 1, 2, 3 …), dragordning
MVV-LVA (ta det värdefullaste med det billigaste, damförvandling först), två killer-drag
per nivå, en transpositionstabell på chess.js 64-bitars zobrist-hash (`_hash`), och
quiescence (bara slag/förvandlingar, högst fyra nivåer, delta-beskärning) så att en
värdering aldrig görs mitt i ett avbyte. Matt/patt upptäcks också på horisonten när
kungen står i schack. Mattvärdena är `±(100000 − ply)` så den snabbaste matten väljs.

**Värdering.** Material (bonde 100, springare 320, löpare 330, torn 500, dam 900) +
enkla piece-square-tabeller (bönder framåt/mitten, lätta pjäser mot mitten, torn på
sjunde raden, kungen gömd). När ena sidan nästan bara har kungen kvar (≤ en lätt pjäs)
och den andra minst ett torn mer, läggs en **mop-up-term** till: den ensamma kungen
drivs mot kanten (12 cp per steg) och den egna kungen förs närmare (6 cp per steg), och
den starka kungens "göm dig"-tabell stängs av. Så blir dam/torn mot kung matt i stället
för evigt kretsande (F3).

**Upprepning.** Sidan skickar partiet hittills (`historik = brade.getGame()`); motorn
spelar upp det med chess.js så att `_positionCount` känner alla ställningar, och i
sökningen räknas en ställning som redan stått i partiet eller tidigare i sökvägen som
remi (0). Går historiken inte att spela upp används bara FEN:en.

**Dragen genereras av chess.js, via den snabba interna vägen.** Den publika `move()`
bygger SAN och FEN för varje drag och ger ~4 k noder/s; `_moves({legal:false})` +
`_makeMove`/`_undoMove` + `_isKingAttacked` (precis vad chess.js egna legalitetsfilter
gör, men utan ett extra make/undo per drag) ger 130–190 k noder/s. `MOTOR_KRAV` listar
metoderna; `test/schack-motor.test.js` fäller en uppgradering av chess.js som tar bort
dem. Motorns drag lämnas som vanliga `{from, to, promotion}` och går alltid genom
brädets vanliga regelkontroll (`brade.move` → chess.js `move()`).

**Tidsgräns.** `TIDSGRANS_MS = 850`: var 256:e nod jämförs klockan med deadline och
sökningen avbryts; det senaste **färdiga** djupet används (därför iterativ fördjupning).
Ett nytt djup över nivåns eget startas bara om det rimligen hinns (≈3× förra djupets tid).
Med worker-turen (ett meddelande fram och ett tillbaka, ~1 ms) och kontrollglappet
hamnar varje drag under 1 s även på en långsam maskin (mätningen nedan). Workerns
**kallstart** (modulen laddas och chess.js tolkas) är ~75 ms och tas en gång per
schackbesök – den startas när partivyn öppnas, inte vid första draget. Klockan (`nu`)
och slumpfröet (`seed`) är injicerbara. Obs: på en 5× långsammare maskin kan även
**Tornet** falla till djup 1–2 i de tyngsta ställningarna (gränsen går före djupet).

**API** (rent, samma i workern och i node):

```js
valjDrag(fen, { niva, seed, tidsgransMs, nu })  // → { drag:{from,to,promotion?}, varde, djup, noder, ms, kandidater } | null
analysera(fen, { djup = 3, tidsgransMs })       // Tips: bästa draget på Tornets djup, utan slump → { drag, varde, djup, matt }
NIVAER, nivaFor(id), skapaSlump(seed), utvardera(chess), valjEnligtNiva(poang, niva, slump)
```

Workern (`schack-motor-worker.js`) tar `{ id, typ: "drag"|"tips", fen, opt }` och svarar
`{ id, ok, resultat | fel }`. `schack-dator.js` ger löftes-API:t i sidan: `valjDrag`, `tips`,
`avbryt()`, `destroy()`. Workern är entrådad och kan inte avbrytas mitt i en sökning:
`avbryt()` medan den tänker (Ångra) **dödar den och startar en ny** direkt (kallstart
~75 ms), så nästa drag köar inte bakom den gamla sökningens tidsgräns (F2); sena svar
förkastas. Kan workern inte startas (eller svarar den inte inom tidsgränsen + 2,5 s)
körs motorn i huvudtråden i stället – partiet fortsätter alltid, brädet kan då frysa
en kort stund.

### Nivåerna (§3.2)

| Nivå | Djup | Slump (seedad) |
| --- | --- | --- |
| **Bonden** | 1 (+ quiescence) | Alla rotdrag får exakt poäng. Med 50 % tas slagen bort ur kandidaterna ("missar med flit att ta"); sedan väljs det bästa med 35 %, annars slumpmässigt bland dragen inom 150 cp från det bästa som är kvar. |
| **Springaren** | 2 | Det bästa med 70 %, annars slumpmässigt bland dragen inom 100 cp. |
| **Tornet** | 3 | Ingen – alltid det bästa. |
| **Damen** | 4, sedan 5, 6, 7 så länge tiden räcker | Ingen. |

Bonden och Springaren får därför exakta poäng på alla rotdrag (fullt fönster), Tornet och
Damen vanlig alfa-beta. Fröet per drag är `parti.seed + antalDrag · 7919`, så ett
sparat parti ger samma svar efter en omladdning. "Varna mig" är på som standard för
Bonden och Springaren.

### Uppmätt tid per drag

Sju ställningar (utgångsställning, öppning, två medelspel, en taktisk, en öppen med damer,
ett slutspel – `preview/schack/matning.js`) × fyra nivåer, seed 1, tidsgräns 850 ms.
Chromium headless på utvecklingsmaskinen, motorn i workern (`preview-schack-matning.html`):

| Nivå | ms/drag (medel) | ms/drag (max) | djup | k noder/s |
| --- | --- | --- | --- | --- |
| Bonden | 5 | 13 | 1 | 51 |
| Springaren | 11 | 36 | 2 | 186 |
| Tornet | 23 | 90 | 3 | 124 |
| Damen | 413 | 851 | 4–7 (3 i det tyngsta medelspelet) | 190 |

**Chromebook-uppskattning:** samma sida med CDP `Emulation.setCPUThrottlingRate` 4× och 6×.
Strypningen biter bara på huvudtråden och bara under själva `Runtime.evaluate`-anropet, så
mätningen görs med `window.korMatningSynkront()` (motorn i huvudtråden, samma kod; kalibrering:
en räkneloop 55 ms ostrypt → 320–400 ms strypt):

| Nivå | 4–6× (medel) | 4–6× (max) | djup |
| --- | --- | --- | --- |
| Bonden | 26–32 ms | 61–70 ms | 1 |
| Springaren | 57–87 ms | 162–252 ms | 2 |
| Tornet | 87–153 ms | 317–501 ms | 3 |
| Damen | 488–581 ms | 860–861 ms | 3–6 (4 i de flesta medelspel, 3 i de två tyngsta) |

Alla nivåer håller alltså 1 s per drag med marginal på en 4–6× långsammare maskin; Damen
når djup 4 i de flesta ställningar och faller tillbaka till djup 3 i de tyngsta. Samma
siffror i node: `node admin/qa-schack-matning.mjs` (och `--faktor 5` för en simulerad
långsam klocka). Mät om på en riktig Chromebook när det går: öppna
`preview/preview-schack-matning.html` och tryck **Kör mätningen** (workern, riktig tid).

## 8. Hjälpen mot datorn (§3.3) – `schack-dator-vy.js`

- **Ångra** – `brade.undo(2)` (elevens drag + datorns svar), `undo(1)` om datorn just
  tänker (svaret förkastas via `dator.avbryt()` och ett sekvensnummer). Går inte efter
  "Ge upp".
- **Tips** – `dator.tips(fen)` (Tornets djup, utan slump) → `brade.showArrow` + "Tips: Sf3".
  Bara på elevens tur; pilen försvinner vid nästa drag.
- **Varna mig** (`schack-varning.js`, körs i huvudtråden – billigt): elevens drag görs på
  en kopia, och om datorn då kan göra **matt i ett** eller **ta elevens dam/torn** visas
  rutan "Om du flyttar dit kan datorn ta din dam. Vill du ändå?" med **Ångra** / **Flytta
  ändå** – via brädets `beforeMove` (pjäsen står halvgenomskinlig på målrutan tills
  eleven svarat; statusraden säger "Vänta – läs varningen!" under tiden). På smal skärm
  (≤ 820 px, där panelen ligger under brädet) visas rutan som ett fast överlägg nederst
  i fönstret med en slöja över resten, så den syns utan att skrolla (F1) – detsamma
  gäller ge upp-frågan. "Kan tas" räknas med ett litet statiskt utbyte på rutan (billigaste
  lagliga slaget först, bara lagliga slag, så en bunden pjäs försvarar inte): varna när
  datorn tjänar ≥ 150 cp (dam mot torn, torn mot löpare, allt oskyddat), inte vid byten
  (dam mot dam) och inte om elevens eget drag tog minst lika mycket. En dam som redan
  hänger varnar även om eleven flyttar något annat. Vanliga drag varnar aldrig. Kryssrutan
  sparas i partiet; standard på för Bonden/Springaren.
- **Ge upp** – fråga i en ruta på sidan (aldrig `confirm()`), sedan `brade.avsluta`.
- **Slutrutan** – "Spela igen" (samma nivå och färg; slumpad färg slumpas om), "Byt nivå",
  "Titta på brädet".

**Partiet sparas** (`schack-parti.js`) i `localStorage` under `pp:schack:dator:<elevId>`
(Chromebooks delas – nyckeln är per elev) efter varje drag, inom try/catch: en nekad
skrivning (full kvot, privat läge) stoppar inget. Formatet är
`{ v: 1, niva, egenFarg, drag: [SAN…], varna, seed, skapad, uppdaterad, slut }`; trasig
eller främmande data ignoreras. Elevens senaste val (nivå, färg) ligger under
`…:val`. Ingen Firestore-skrivning och inga pluggmynt i Etapp 1.

## 9. Elevens schacksida (§4)

- Modulen `schack` i `STUDENT_MODULES` (`src/gamemode-visibility.js`): `optIn: true`
  (läraren slår på den per klass under Klasser → Synliga moduler → `enabledModules`),
  `lockable: false`, `learning: true` (fokusläget stänger den, `docs/FOKUSLAGE.md`), grupp
  "Öva", länken **Schack** med en egen SVG-bonde (`SCHACK_IKON`). Routern släpper bara in
  elever vars klass slagit på schack – inte ens via direktlänk.
- `#/elev/schack` – startsidan: ett pågående parti överst ("Fortsätt partiet"), sedan
  korten **Spela mot datorn**, Spela mot en kompis (Etapp 2), Lär dig schack och Pussel
  (Etapp 3) som "kommer snart".
- `#/elev/schack?vy=dator&ny=1` – nivå (fyra kort) och färg (vit/svart/slumpa) →
  **Starta partiet**; `?vy=dator` fortsätter det sparade partiet (hashen skrivs om utan
  `ny=1` när partiet startats, så en omladdning hamnar i partiet).
- Flödet (`schack-flode.js`) är fristående från `ui.js`/`data.js` – samma kod kör i
  `preview/preview-schack-dator.html` utan Firebase. Workern stängs när eleven lämnar
  `#/elev/schack` (`stangSchack`).

## 10. Tester (B)

```
node --test test/schack-motor.test.js test/schack-varning.test.js test/schack-parti.test.js test/schack-sida.test.js
```

Motorn: chess.js snabba väg finns; matt i ett på Tornet och Damen (fem ställningar, även
svart och förvandling); Bonden väljer inte alltid bäst med fast seed men ibland; samma
seed → samma drag; djupen per nivå; tidsgränsen (150 ms-budget, rusande klocka, alla
nivåer i ett medelspel); 24-dragspartier per nivå där varje drag kontrolleras med den
publika `move()`. Varningen: narrmatt-g4 varnar, e4 inte; hängande dam/torn, byten,
redan hängande dam, olagligt drag, parti som tar slut. Partiet: nyckel per elev, spara/
läs, trasig JSON/version/nivå, lagring som nekar, senaste valet. Datorn: worker-URL och
protokoll (attrapp-worker), reserv utan Worker, vakt vid tyst worker, `avbryt`.
Ångra/tips genom brädets kontroll + motorn, omladdning via `loadGame`. Sidan: registret,
routen med `import()`, bootgrafen, inga `confirm()`, ingen Firestore, markupen.

Preview: `preview/preview-schack-dator.html` (hela flödet; `window.schack.aktiv()` →
vyn med `brade`, `varnar()`; kryssruta "Snabb dator" = 250 ms och ingen tänkpaus).

## 11. Licenser

| Del | Licens | Fil |
| --- | --- | --- |
| chess.js 1.4.0 (Jeff Hlywa) | BSD-2-Clause – fri att använda på en publik sajt med licenstexten | `src/schack/vendor/LICENSE` |
| Pjäserna | egna, ritade för Pluggporten | `src/schack/schack-pjaser.js` |

Inga GPL-bibliotek (Stockfish, chessground) och inga pjäsbilder med oklar licens –
testet letar efter dem i `src/schack/`. **Uppgradera chess.js:** byt hela
`vendor/chess.js` mot paketets `dist/esm/chess.js`, behåll huvudkommentaren med den
nya versionen, ta bort `//# sourceMappingURL`-raden och byt `LICENSE` om den ändrats.

## 12. Elev mot elev – servern (Etapp 2A, #779)

Spec §6–§9. **Allt skrivs av Cloud Functions** (`functions/schack-*.js`, Admin SDK förbi
reglerna); eleverna skriver aldrig direkt i `schackKlass` eller `schackPartier`
(reglerna nekar alla klientskrivningar, även admin). Klienten anropar callables och
lyssnar med två `onSnapshot`. Servern avgör tur, laglighet (samma chess.js), FEN,
draglistan, klockan med **serverns tid** och partiets slut – ingen kan fuska in ett
drag eller ändra klockan.

### 12.1 Datamodell (§6)

Alla tider är **epoch-ms från serverns klocka** (inga Timestamp-objekt – klienten
jämför direkt mot `serverNow()`).

```
schackKlass/{classId}                  EN doc per klass: lobbyn + pågående + tabellen
  vantar:     { [uid]: { namn, klocka: null|5|10|15, sedan } }
  utmaningar: { [utmaningId]: { fran, franNamn, till, klocka, sedan } }
  partier:    { [partiId]: { vit, svart, vitNamn, svartNamn, klocka, start } }   bara pågående
  tabell:     { [uid]: { poang, vinster, forluster, remier, partier } }
  dold:       false                                                              läraren döljer topplistan

schackPartier/{partiId}
  classId, vit, svart, vitNamn, svartNamn
  fen, drag: ["e4", "e5", …] (SAN), tur: "w"|"b"
  status: "pagar"|"slut"
  resultat: null | "1-0"|"0-1"|"½-½"
  orsak:    null | "matt"|"patt"|"remi"|"gav-upp"|"tid"|"lamnade"|"avbrutet"
  klocka:   null | { minuter, vitMs, svartMs, senastDragAt }    tiden kvar efter senaste draget
  remiErbjudenAv: null | uid
  senastDragAt                     ms – även utan klocka (5-minutersregeln, 24 h-städningen)
  skapad, uppdaterad               ms
```

- Dokumentet `schackKlass/{classId}` skapas av första anropet (saknat = tomt).
- `klocka` i partiet: `vitMs`/`svartMs` är tiden **kvar efter senaste draget**; den på
  tur har dessutom förbrukat `nu − senastDragAt`. Klockan startar när partiet skapas
  (vit räknar från start). Vid slutet fryses den (den på tur har 0 vid "tid").
- `resultat` är `null` vid `orsak: "avbrutet"` (läraren eller 24 h) – tabellen rörs inte.
- Ett remierbjudande ändrar `uppdaterad` men inte `senastDragAt`; ett drag tar bort
  erbjudandet.
- **Ett parti åt gången per elev – även över klasser:** `studentData/{uid}.schack.aktivtParti`
  (partiId) sätts av servern när partiet skapas och tas bort (`null`) när det slutar, i
  samma transaktion. Lobbyn läser den för båda spelarna innan ett parti skapas; pekar
  den på ett parti som inte längre pågår räknas den som fri. Klienten kan aldrig ändra
  den (`schackOk`).
- **Känd lucka (F9, accepterad):** eleven får radera sitt eget `studentData`-dokument
  (`allow delete: isSelf`) och tar då bort spärren – men också alla mynt, framsteg, hus
  och djur. Priset är så högt att spärren inte flyttas; inom klassen håller
  `partier`-mappen ändå "ett parti åt gången".
- Alla uppslag med en nyckel som en klient skickat in (`motstandare`, `utmaningId`, uid:n)
  görs bara på egna nycklar (`Object.hasOwn`), och id:n på formen `__x__` nekas – ingen
  "constructor"-motståndare kan ge ett fantomparti.

**Regler** (`firestore.rules`, test `test/firestore-rules-schack.test.js`): `schackKlass`
läses av `isClassMember(classId) || hasClass(classId)`; `schackPartier` av de två
spelarna och `hasClass(classId)` (lärarens fråga filtrerar på `classId`) – och ett
**saknat** parti får varje inloggad hämta (tomt svar, så `lyssnaParti` ger `null` för ett
gammalt id i stället för ett fel); ingen klient skriver. ⚠️ Kräver `firebase deploy --only firestore:rules`.

### 12.2 Callables (`functions/index.js`, region europe-west1)

Felkoder är Firebase `HttpsError`-koder; klienten får dem som `SchackMolnFel.code`
(utan prefixet `functions/`). **Grinden** i varje elevanrop (`hamtaKlassForElev`):
anroparen står i `classes/{classId}.studentIds` (annars `permission-denied` – gäller
även lärare), `schack` finns i `enabledModules` och inte i `hiddenModules` (annars
`failed-precondition`), inget aktivt fokuslås (`lock.till` i framtiden, oavsett mål –
schack är inte låsbart; annars `failed-precondition`). Utloggad → `unauthenticated`,
trasiga id:n → `invalid-argument`.

| Callable | In | Ut | Fel utöver grinden |
| --- | --- | --- | --- |
| `schackVanta` | `{ classId, klocka: null\|5\|10\|15 }` | `{ klocka }` | `invalid-argument` fel klocka; `failed-precondition` du spelar redan. Tar bort egen gammal väntan och egna utmaningar. |
| `schackSlutaVanta` | `{ classId? }` | `{ borttagen }` | utan `classId`: alla elevens klasser (klasser utan schack/med fokus hoppas över) |
| `schackGaMed` | `{ classId, motstandare }` | `{ partiId, farg: "w"\|"b" }` | `failed-precondition` kompisen väntar inte / någon av er spelar redan; `invalid-argument` sig själv |
| `schackUtmana` | `{ classId, till, klocka }` | `{ utmaningId }` | `invalid-argument` sig själv, utanför klassen, fel klocka; `failed-precondition` någon av er spelar. Ersätter egen tidigare utmaning. |
| `schackSvara` | `{ utmaningId, ja, classId? }` | `{ partiId, farg }` eller `{ partiId: null, farg: null }` | `not-found` utmaningen finns inte/har gått ut/inte till dig; `failed-precondition` någon spelar redan |
| `schackDrag` | `{ partiId, from, to, promotion? }` | `{ gjort: true, san, fen, tur, drag, klocka, slut }` – eller `{ gjort: false, slut }` när din tid redan var slut | `not-found`; `permission-denied` inte din match; `failed-precondition` inte din tur / partiet slut / avbrutet (24 h); `invalid-argument` olagligt drag |
| `schackGeUpp` | `{ partiId }` | `{ slut }` | när som helst under partiet |
| `schackRemi` | `{ partiId, handling: "erbjud"\|"acceptera"\|"neka" }` | `{ remiErbjudenAv, slut }` | `failed-precondition` acceptera/neka utan motståndarens erbjudande. Erbjud när motståndaren redan erbjudit = remi. Är den på turs tid slut (klocka, servertid) avgörs partiet på tid i stället, oavsett handling. |
| `schackKravaVinst` | `{ partiId }` | `{ slut }` | `failed-precondition` det är din tur / tiden inte slut (klocka) / < 5 min utan drag (utan klocka) |
| `schackLarareAvsluta` | `{ partiId }` | `{ slut: { resultat: null, orsak: "avbrutet" } }` | lärare med klassen (`hasClass`): admin eller årskurskonto med klassen, annars `permission-denied`; `failed-precondition` redan slut |
| `schackLarareTopplista` | `{ classId, dold?: bool, nollstall?: bool }` | `{ dold, nollstalld }` | som ovan; `invalid-argument` utan något av fälten; `not-found` om klassen inte finns |

`slut` är `null` eller `{ resultat, orsak }`. **Partiets slut sker i EN transaktion**
(`avslutaParti` i `schack-parti.js`): partidokumentet får status/resultat/orsak, posten
försvinner ur `schackKlass.partier`, `tabell` får båda spelarnas nya rader – utom
vid `avbrutet` – och båda spelarnas `studentData.schack.aktivtParti` nollas. Färgen slumpas med `node:crypto`. Namnen tas ur
`classProjections/{classId}.members[uid].namn` (en läsning), reserv `students/{uid}.namn`.

**Lobbyregler (§7.1).** Ett parti åt gången per elev: varje lobbyanrop är en
transaktion på klassdokumentet (och läser `aktivtParti` för båda spelarna), så två
samtidiga `schackGaMed`/`schackSvara` kan aldrig ge två partier (det andra nekas), inte
heller i två olika klasser. Ett anrop som inte ändrar något (t.ex. `schackSlutaVanta`
utan väntan) skriver inte klassdokumentet. Utmaningar lever 2 min och väntan 10 min
via tidsstämpeln `sedan`: servern filtrerar bort utgångna poster i varje skrivning av
klassdokumentet (`rensaLobby`), klienten vid varje visning – inga skrivningar per
sekund och ingen närvaro-ping.

**Klockan (§7.2).** `klockaEfterDrag` drar `nu − senastDragAt` från den som drog. Ett
drag när ens egen tid redan är slut görs inte: partiet slutar `"tid"` för motståndaren
(`gjort: false`). Motståndaren kan också kräva vinst med `schackKravaVinst`. Klientens
fält (`fen`, `tur`, `klocka`, tid) ignoreras helt.

### 12.3 Delad kod – `admin/sync-schack-functions.mjs`

`src/schack/schack-server-delat.js` (klockan, 5 min/24 h, lobbyfiltret, poängformeln,
fokuslås-tolkningen – inga importer) och `schack-server-parti.js` (chess.js: `provaDrag`,
`bedomSlut`, `byggParti`) + `vendor/chess.js` och `LICENSE` kopieras till
`functions/schack/` med `npm run sync:schack` (predeploy i `firebase.json`;
`--check` och `test/schack-delat.test.js` fäller en glidande kopia). Servern spelar upp
hela draglistan för varje drag, så trefaldig upprepning räknas rätt (~1 ms).

**Poängformeln (§8)** – `poangDelta(egen, motståndare, utfall)` med Elos förväntade
utfall E = 1/(1+10^((Rb−Ra)/400)): vinst `+10 + 20·(1−E)` (+10 mot en mycket svagare …
+30 mot en mycket starkare), förlust `−(5 + 15·E)` (−5 mot en starkare … −20 mot en
svagare), remi `10·(0,5−E)` (±5). Start 1000, **golv 800** (`nyPoang`). Lika motstånd:
vinst +20, förlust −13, remi 0. Båda raderna räknas ur samma gamla poäng (`uppdateraTabell`).

### 12.4 Klient-API – `src/schack/schack-moln.js` (lat, bara `import()`)

```js
const moln = await import("./schack/schack-moln.js");
moln.lobby.vanta(classId, klocka) / slutaVanta(classId?) / gaMed(classId, motstandare)
moln.lobby.utmana(classId, till, klocka) / svara(utmaningId, ja, classId?)
moln.parti.drag(partiId, { from, to, promotion? }) / geUpp(partiId) / remi(partiId, handling) / kravaVinst(partiId)
moln.larare.avsluta(partiId) / topplista(classId, { dold?, nollstall? })
const stopp = moln.lyssnaKlass(classId, (klass) => …, onError)   // klass = { vantar, utmaningar, partier, tabell, dold, finns }
const stopp2 = moln.lyssnaParti(partiId, (parti) => …, onError)  // parti = { id, …dokumentet } | null
moln.klockaVisning(parti)      // { vitMs, svartMs, slut } ur senastDragAt + serverNow() – räkna om lokalt varje sekund
moln.serverNow() / syncServerClock()   // samma klockkorrigering som fokusläget
moln.datorPartiKlart()         // studentData.schack.datorPartier + 1 (EN skrivning, fel sväljs)
```

- Alla anrop returnerar callable-svaret och kastar `SchackMolnFel(code, message)`.
- `lyssnaKlass` ger klassdokumentet med utgångna lobbyposter bortfiltrerade mot
  `serverNow()` (`rensaLobby`); lyssnarna är **en** `onSnapshot` var – stäng dem (anropa
  avregistreringen) när eleven lämnar schacksidan (§9).
- Allt ur `schack-server-delat.js` re-exporteras (`LAMNAT_MS`, `LAMNAT_VARNING_MS`,
  `topplista(tabell, namnFor)`, `partiFor` …) för 2B/2C.
- Brädet: använd `beforeMove` → `moln.parti.drag(...)` (pjäsen står halvgenomskinlig tills
  servern svarat; nekas draget hoppar den tillbaka), och spela motståndarens drag med
  `brade.move(sistaSAN)` ur `parti.drag` från lyssnaren.

### 12.5 `studentData.schack` (§10)

`{ datorPartier: int, aktivtParti: partiId|null }`. `datorPartier` = antal avslutade
partier mot datorn: klienten (2B, vid datorpartiets slut) ökar räknaren med
`datorPartiKlart()` (fältväg `schack.datorPartier` + `increment(1)`, så spärren bredvid
behålls). `aktivtParti` = serverns spärr "ett parti åt gången" (12.1). Regeln `schackOk`
tillåter bara nycklarna `datorPartier` (heltal, aldrig nedåt, högst +1 per skrivning) och
`aktivtParti` (måste vara oförändrad); lärare (årskurskonto) skriver fältet aldrig, admin
får. Kompispartier räknas i `schackKlass.tabell[uid].partier`. Etapp 3 lägger `lektioner`
och `pussel` här (regeln utökas då).

### 12.6 Gamla partier – valet (§7.3)

**Städning när klassdokumentet skrivs**, ingen schemalagd funktion. Varje lobbyanrop
(`lobbyTx` → `stadaGamla`) tittar på posterna i `partier` vars `start` ligger > 24 h
tillbaka (gratis – ingen läsning), läser bara dem och avbryter partiet om
`senastDragAt` är > 24 h (status `slut`, orsak `avbrutet`, ingen tabell). Dessutom
avbryter **varje partianrop** (`drag`, `geUpp`, `remi`, `kravaVinst`) ett sådant parti
i stället för att utföra handlingen (svar `failed-precondition`). Skäl: ingen Cloud
Scheduler/extra deploy, inga läsningar när ingen spelar, och ett gammalt parti stör
bara den klass det tillhör – där försvinner det så fort någon öppnar lobbyn.
Konsekvens: ett gammalt parti kan stå kvar i `partier` tills nästa lobbyanrop i
klassen (bara information i listan "Pågående partier").

### 12.7 Kvotbudget (§9)

Per halvdrag: callable **2 läsningar** (partiet + `classes/{classId}` för grinden) och
**1 skrivning** (partiet); de två spelarnas lyssnare **2 läsningar**. Klassdokumentet
läses och skrivs **inte** per drag – bara när partiet tar slut (transaktionen läser det
först då, före första skrivningen).

| | Skrivningar | Läsningar |
| --- | --- | --- |
| Start (lobbyanrop: classes + projektion + klassdoc + 2 × studentData/aktivtParti; parti + klassdoc + 2 × studentData skrivs) | 4 | 5 + lobbylyssnarna |
| 40 drag per spelare = 80 halvdrag med klocka | 80 | 160 (lyssnare) + 160 (servern) |
| Slut (klassdoc läses och skrivs; 2 × studentData nollas, i samma transaktion) | +3 | +1 + lobbylyssnarna |
| **Ett parti** | **≈ 87** | **≈ 165 i klienten + ≈ 166 på servern** |

Räknat utan lobbylyssnare: ett parti ≈ 87 skrivningar och ≈ 330 läsningar (varav de 160
hos spelarna är de "≈ 160" spec §9 räknar med). Det som avgör fakturan är lyssnarna: en
lobby med 25 öppna sidor lägger 25 läsningar på varje klassdoc-skrivning (start och slut).

Lärarens åskådarläge (2C) lägger 1 läsning per halvdrag (avsnitt 13.3). **Lobbyn:** med 25 elever på
schacksidan kostar varje skrivning av klassdokumentet 25 läsningar; dokumentet skrivs
bara av elevhandlingar (vänta/sluta vänta/gå med/utmana/svara) och partislut – aldrig
per sekund, ingen närvaro-ping. En lektion med 12 partier ≈ 50 klassdoc-skrivningar ≈
1 250 lobbyläsningar. Lyssnarna stängs när eleven lämnar schacksidan (2B anropar
avregistreringarna i `stangSchack`).

### 12.8 Tester och deploy

```
node --test test/schack-delat.test.js                       # poäng, klocka, lobby, chess.js, synk, bootgraf 107
npm run test:rules      → test/firestore-rules-schack.test.js
npm run test:functions  → test/functions-schack-core.test.mjs (lobby, lärare, 24 h)
                          test/functions-schack-parti.test.mjs (drag, klocka, §7.3, tabell, golv 800)
                          test/functions-schack.test.mjs (callables e2e: auth, roller, helt parti)
```

Deploy-ordning: **1.** `firebase deploy --only firestore:rules` (läsregler + `schackOk`),
**2.** `firebase deploy --only functions` (predeploy kör `sync:schack`), **3.** webben
(2B/2C). Inga index behövs (ingen fråga i elevflödet; lärarens `where("classId", "==")` är
en enkelfältsfråga).

## 13. Lärarens sektion "Schack" (Etapp 2C, #781)

Spec §10. En egen sektion **Schack** i klassens sidor (`CLASS_SECTIONS` i
`src/teacher-classes-sections.js`, sidläget Klasser: Områden, Lägen, Synlighet, Fokusläge,
**Schack**, Inloggning). Raden laddar allt med `import()`; inget under `src/schack/` ligger i
lärarsidans eller appens statiska graf (bootgrafen står på 107).

```
src/schack/larare/
  schack-larare.js           sektionen: modulen, partilistan, topplistan, statistiken, lyssnaren
  schack-larare-askadare.js  åskådarläget: Etapp 1-brädet utan inmatning + klockorna, EN lyssnare
  schack-larare-delar.js     rent: modulvalet, statistiken, partilistan, dragsynken, slutet, vakten
  schack-larare-markup.js    rent: markupen (bekräftelserutan, listan, topplistan, tabellen)
  schack-larare-data.js      datorpartierna (studentData) och projektionsnamnen – lat
  schack-larare.css          laddas som <link> av sektionen (inte i styles.css)
src/teacher-schack-ikon.js   bondeikonen (fliken och Synlighet)
preview/preview-schack-larare.html  hela lärarsidan mot minnes-Firestore med partier som spelas live
```

### 13.1 Vad läraren ser och gör

1. **Schack för klassen** – på/av. Samma skrivning som Synlighet
   (`data.setClassHiddenModules(classId, hidden, enabled)`): på = `schack` i `enabledModules` och
   inte i `hiddenModules`; av = bort ur `enabledModules`. Andra moduler rörs inte. Är schack av
   medan partier pågår visas en påminnelse (servern nekar dragen – grinden i 12.2).
2. **Pågående partier** – ur `schackKlass/{classId}.partier`, äldst först: namnen (vit/svart),
   klocktypen och starttiden, plus hur många som väntar i lobbyn. **Titta** öppnar åskådarläget
   i samma ruta, **Avsluta** öppnar en bekräftelseruta på sidan (aldrig `confirm()`).
3. **Åskådarläget** – samma bräde som Etapp 1 (`skapaSchackbrade`) med `ASKADAR_OPT`
   (`interaktiv: false`, ingen `beforeMove`, `egenFarg: null`, vit nederst). Dragen kommer bara
   ur lyssnaren: nya drag spelas med `brade.move(san)` (det sista glider), allt annat laddas om med
   `loadGame` (`synkaDrag`). Klockorna står i spelarradernas högra kant och räknas lokalt varje
   halvsekund ur `moln.klockaVisning` (servertid, ingen skrivning). Raden ovanför säger vem som
   drar, ett remierbjudande och antal drag. När partiet slutar (även avbrutet, gav upp, tid,
   lämnade) visar brädet slutrutan via `avsluta(slutInfo(parti))`; matt/patt/regelremi ser
   brädet själv. **Avsluta partiet** finns även här, med samma bekräftelse.
4. **Avsluta** → `moln.larare.avsluta(partiId)` (`schackLarareAvsluta`): `avbrutet`, inget
   resultat, tabellen orörd. "Redan slut" (`failed-precondition`) visas som en rad i listan.
5. **Topplistan** – `topplista(tabell, namnFor)` i samma ordning som elevernas; **Dölj för
   eleverna**/**Visa för eleverna** (`dold`) och **Nollställ topplistan** (bekräftelse) via
   `moln.larare.topplista`. Nollställningen tömmer `tabell` – även räknaren "mot kompisar".
6. **Statistik per elev** – mot kompisar = `tabell[uid].partier` (med V–F–R), mot datorn =
   `studentData/{uid}.schack.datorPartier`, totalt och klassens summa (ett kompisparti räknas en
   gång). Datorpartierna läses **bara när läraren trycker** "Hämta partier mot datorn".

Namnen kommer ur lärarsidans redan laddade elevlista (0 läsningar). Bara elever som står i
tabellen men inte finns i listan (har lämnat klassen) slås upp i `classProjections/{classId}`
(`getClassProjection`, 1 läsning, en gång per öppning).

### 13.2 Lyssnarna och när de stängs

- **EN** `onSnapshot` på `schackKlass/{classId}` (`moln.lyssnaKlass`) medan sektionen är öppen –
  listan, topplistan och kompisstatistiken ritas ur den.
- **EN** `onSnapshot` på `schackPartier/{partiId}` (`moln.lyssnaParti`) i åskådarläget.
  **Alla partier** (tillbaka) stänger den och brädet; att titta på ett annat parti öppnar en ny.
- **Vakten** (`skapaVakt` i `schack-larare-delar.js`) samlar avstängningarna och kör dem när
  sektionens värd lämnat DOM:en (annan flik, annan klass) eller routen bytts (kollas vid
  `hashchange` och en gång i sekunden). Lärarsidans detaljyta har ingen "unmount"-krok, så
  det är samma mönster som Fokusläget och pokalerna (`isConnected`-vakt).
- Förhandsvisningen visar öppna lyssnare (`window.__ppStub.lyssnare()` och i panelen).

### 13.3 Kvot

| Handling | Läsningar | Skrivningar |
| --- | --- | --- |
| Öppna sektionen | 1 (klassdokumentet) + ev. 1 (projektionen) | 0 |
| Varje ändring i klassdokumentet (lobby, start, slut) medan sektionen är öppen | 1 | 0 |
| Åskådarläget: öppna + varje halvdrag | 1 + 1 per halvdrag | 0 |
| Hämta partier mot datorn | 1 per elev (≈ 25), bara på knapptryck | 0 |
| Slå på/av schack | 0 | 1 (`classes/{classId}`) |
| Avsluta / dölj / nollställ (callable) | på servern (12.2) | på servern (12.2) |

Ingen fråga (`where`) och inget index: listan står i klassdokumentet.

### 13.4 Förhandsvisning och tester

- `preview/preview-schack-larare.html` – hela appen (lärare inloggad) med Firebase-SDK:t
  import-mappat till #440:s minnes-Firestore med **levande** `onSnapshot`
  (`preview/schack-larare/fb-firestore.js`) och lärarens två callables (`fb-functions.js`).
  Klass 5E har schack på, två pågående partier (Alva–Bo med 10 min, Cleo–Dino utan klocka), en
  elev i lobbyn, en topplista (Saga har lämnat klassen – namnet ur projektionen) och
  datorpartier. `sim.js` spelar drag med serverns regel- och klocklogik (Alva–Bo var 3:e s), så
  åskådarläget ändras live; panelen nere till vänster pausar, startar ett nytt parti och låter
  Bo ge upp. Startar på `#/larare/klasser?klass=5e&sektion=schack`.
- `node --test test/schack-larare.test.js` – modulvalet, statistiken (tabell + datorräknaren,
  summan), namnen, partilistan, klockan, dragsynken, slutet, vakten (fejkade timers), att
  åskådarbrädets kontroll med `ASKADAR_OPT` nekar tryck/dra/släpp, källkodstester för att
  åskådarläget aldrig kopplar in inmatning och att båda lyssnarna stängs, markupen (inget
  `confirm()`), och att allt laddas med `import()`.
- Ingen ändring i regler eller functions – deploy: bara webben (efter 2A:s regler och functions).

## 14. Elev mot elev – lobbyn, partiet, klockan och topplistan (Etapp 2B, #780)

Spec §7–§9. Allt ligger i `src/schack/` och laddas lat (`page-schack.js → import(schack-flode.js) →
import(schack-lobby-vy.js | schack-kompis-vy.js | schack-kompis.js)`, `schack-moln.js` bara med
`import()` från sidan). Bootgrafen är kvar på **107** (`test/schack-delat.test.js`).

### 14.1 Vyerna

| Hash | Vy |
| --- | --- |
| `#/elev/schack` | startsidan – kortet **Spela mot en kompis** är öppet när eleven har en klass med schack påslaget |
| `#/elev/schack?vy=kompis` | lobbyn (`schack-lobby-vy.js`) |
| `#/elev/schack?vy=kompis&parti=X` | partiet mot en kompis (`schack-kompis-vy.js`); en omladdning stannar i partiet |

- **Klassen:** den första av elevens klasser (lärarens ordning, `getClasses()` – cachad, routern
  har redan läst den) som har `schack` i `enabledModules` och inte i `hiddenModules`.
- **Lobbyn:** "Ditt parti" (klockval ingen/5/10/15 + **Vänta på en motståndare**, eller "Du väntar …
  · 10 min" + **Sluta vänta**, och en egen utmaning med **Ta tillbaka** = `schackSlutaVanta`, som
  tar bort egen väntan och egna utmaningar), väntar-korten ("Alva väntar · 10 min" + **Spela!** =
  `schackGaMed`), **Utmana en kompis** (klasslistan, klockan = det valda klockvalet; avstängt för den
  som spelar), **Pågående partier i klassen** ("Elias – Sara", bara info) och **Topplistan** (§8,
  döljs helt när `dold: true`). Utgångna poster (väntan 10 min, utmaning 2 min räknat från `sedan`
  mot `serverNow()`) filtreras bort vid varje ritning, och vyn ritar om när nästa post går ut –
  utan skrivning. En sektion ritas bara om när dess HTML ändrats (fokus står kvar).
- **Inkommande utmaning:** rutan "Sara vill spela schack med dig (10 min)" med **Spela!**/**Nej
  tack** (`schackSvara`) visas överst på startsidan, i lobbyn, under partiet mot datorn och på
  slutrutan efter ett kompisparti – överallt där lobbyns lyssnare är öppen.
- **Till partiet:** så fort klassdokumentet visar ett pågående parti för eleven (någon tryckte
  Spela! på ens väntan, eller svarade ja på ens utmaning) går flödet till partiet. Kommer eleven in
  på `#/elev/schack` med `studentData.schack.aktivtParti` satt (läst ur den redan cachade
  `getStudentData`) går flödet också dit; är det partiet redan slut visas lobbyn i stället.
  Ett parti eleven lämnat med **Till lobbyn** hoppar flödet aldrig tillbaka in i.
- **Partiet:** samma bräde och "möjliga drag" som mot datorn, vänt efter elevens färg, **utan
  ångra, tips och varningar** (källkodstest). Elevens drag går via brädets `beforeMove` →
  `schackDrag`: pjäsen står halvgenomskinlig på målrutan med statusen "Skickar…"; nekar servern
  (eller svarar `gjort: false` för att tiden tog slut) hoppar pjäsen tillbaka och felet visas i
  panelen. Motståndarens drag kommer ur lyssnaren: ett nytt drag spelas med `brade.move` (glider),
  allt annat laddar om partiet (`dragDiff`). Under väntan på servern synkas inte brädet – det görs
  direkt efteråt mot senaste ögonblicksbilden.
- **Klockan:** båda klockorna står i spelarraderna (`brade.setSpelarExtra`), räknas lokalt var
  200:e ms ur `klocka` + `senastDragAt` + `serverNow()` (ingen skrivning per sekund), m:ss och
  tiondelar under 10 s, röd under 30 s. Är motståndarens tid slut visas **Kräv vinsten**
  (`schackKravaVinst` – servern kontrollerar tiden; nekas den går knappen att trycka igen).
- **Lägesraden** (§7.3-texterna, "Kräv vinsten") flyttar aldrig brädet när den dyker upp mitt i
  ett drag (F3). Bred skärm (> 820 px, panelen bredvid brädet): den står **överst i panelen**, så
  knappen syns utan att skrolla även på en Chromebook 1366×768 (F6). Smal skärm: **under** brädet, och
  hamnar den under fönsterkanten skrollas sidan bara så mycket som behövs – aldrig medan eleven
  har fingret/musen nere på brädet. Uppmätt: 1366×768 knappen y 60–102, 768×1024 y 903–945 (ingen
  skroll), 320×640 skroll 33 px → y 573–615; brädets läge på sidan oförändrat i alla tre. Fel- och infotexter i panelen och lobbyn försvinner
  efter 6–8 s (F4); säger motståndaren nej till ens remi står "Sara sa nej tack till remi." (F5).
- **§7.3 utan klocka:** den på tur ser efter 4 min "Din tur! Om en minut kan din motståndare
  avsluta partiet."; motståndaren ser efter 5 min "Sara verkar ha gått. Avsluta partiet och ta
  vinsten?" + knappen (`schackKravaVinst`).
- **Ge upp / Föreslå remi:** bekräftelserutor på sidan (aldrig `confirm()`), på smal skärm som
  överlägg nederst. Ett remierbjudande från motståndaren visas som ruta med **Ja, remi** /
  **Nej, spela vidare** (`schackRemi` acceptera/neka); den som erbjudit ser "väntar på svar".
- **Slutrutan:** "Du vann! Sara gav upp." / "Schack matt – Elias vann." / "Remi – ingen vann" (med
  orsaken: överenskommen, upprepning, 50 drag, material, patt) / "Din tid tog slut – Sara vann." /
  "Partiet avbröts" – med **Spela igen** (`schackUtmana` till samma kompis med samma klocka, sedan
  lobbyn) och **Till lobbyn**.
- **Krok för helskärm m.m. (#783):** partivyn har en tom verktygsrad ovanför brädet,
  `.schack-parti-verktyg` (`data-krok="verktyg"`, dold med CSS när den är tom, knappar högerställda).
  `skapaKompisVy` returnerar den som `vy.verktyg` och hela partivyn (brädet + panelen) som
  `vy.element`. Flödet ger vyn via `flode.aktiv()` (ett löfte tills modulen laddats). En knapp
  monteras alltså med `(await flode.aktiv()).verktyg.append(knapp)` och helskärmar `vy.element`;
  vyn tömmer `host` i `destroy()`, så knappen försvinner med vyn.
- **Datorpartier räknas:** när ett parti mot datorn tar slut anropas `datorPartiKlart()` (EN
  skrivning, `studentData.schack.datorPartier + 1`). Partiet får `raknad: true` i `localStorage`,
  så en omladdning eller Ångra + nytt slut räknas inte igen.

### 14.2 Lyssnarna – när de öppnas och stängs (§9)

| Lyssnare | Öppnas | Stängs |
| --- | --- | --- |
| `schackKlass/{classId}` (EN, `schack-kompis.js` → `moln.lyssnaKlass`) | när första vyn på schacksidan behöver den: startsidan, lobbyn, partiet mot datorn, slutrutan efter ett kompisparti. Vyerna delar den – ett vybyte inom schacksidan återanvänder den (ingen ny läsning). | **direkt** när eleven lämnar schacksidan: route-byte, `pagehide` (fliken stängs/byts) och utloggning – via `stangSchack()`; då tas en egen väntan bort med `schackSlutaVanta`. **Utloggning:** logga-ut-knappen (`ui.js`) väntar på `window.__ppSchackLamna()` (som sidan sätter medan eleven är på schacksidan, högst 1,5 s) INNAN `data.logout()` – annars är eleven redan utloggad och servern nekar anropet (F1). **Flikstängning:** webbläsaren avbryter oftast anropet vid `pagehide` (callable-SDK:t kan inte skicka med `keepalive`/`sendBeacon`), så väntan står då kvar tills den går ut efter 10 min – servern och alla klienter filtrerar bort den (F2). **2 s** efter att sista vyn släppt den – t.ex. när ett kompisparti öppnas. |
| `schackPartier/{id}` (EN, `moln.lyssnaParti`) | när partivyn öppnas | när partivyn stängs (`destroy`: Till lobbyn, route-byte, pagehide) |

Medan ett kompisparti pågår är alltså bara partiets lyssnare öppen. Tillbaka ur bfcache
(`pageshow` med `persisted`) ritas sidan om och lyssnarna öppnas igen.

### 14.3 Kvoten i praktiken

- **Besök på schacksidan:** klasslistan (namn + avatarer) = **1** läsning per besök
  (`ensureClassProjection` – bygger en saknad post en gång), klassdokumentet = 1 läsning när
  lyssnaren öppnas + 1 per ändring. `getClasses`/`getStudentData` är redan cachade av appen.
- **Lobbyn:** klassdokumentet skrivs bara av elevhandlingar (vänta, sluta vänta, spela, utmana,
  svara) och partislut. Med 25 elever på schacksidan kostar varje sådan skrivning 25 läsningar;
  en lektion med 12 partier (≈ 4 lobbyhandlingar + 1 slut per parti ≈ 60 skrivningar) ≈ 1 500
  lobbyläsningar. Ingen närvaro-ping, inga skrivningar per sekund; utgångna poster filtreras lokalt.
- **Ett parti** med 40 drag per spelare och klocka: som 12.7 – ≈ 87 skrivningar, ≈ 165 läsningar i
  klienten (2 lyssnare × 80 halvdrag + start/slut) och ≈ 166 på servern. Klockan räknas lokalt.
  Medan partiet pågår är lobbylyssnaren stängd hos båda spelarna, så deras egna drag kostar
  inget i lobbyn.
- **Datorpartier:** 1 skrivning per avslutat parti (räknaren), inget annat.

### 14.4 Förhandsvisning och tester

- `preview/preview-schack-kompis.html?elev=alva` (och `bilal`, `cleo`, `dante`) – två (eller fyra)
  elever i varsin flik, **utan Firebase**: lobbyn och partierna ligger i en låtsas-databas i
  `localStorage` (`preview/schack-kompis/falsk-db.js`, Web Locks mellan flikarna, `storage`-
  händelsen som "onSnapshot") och anropen kör den **riktiga serverkärnan**
  (`functions/schack-lobby.js`, `schack-parti.js`) i sidan (`falsk-moln.js`; import map för
  `node:crypto`). Verktygsraden: byt elev (ny flik), Lämna schacksidan, spola fram tiden (+1/+4/+5/
  +10 min – testar klockan och §7.3), Nollställ allt; statusraden visar öppna lyssnare.
  `window.schack` = flödet, `window.stub` = `{ db, moln, lyssnarPaKlass }`.
- Riktiga appen mot emulatorerna (auth, firestore, functions): `bash admin/qa-schack-kompis-preview.sh
  <port1> <port2>` → två origins, logga in `4a01` (Alva) och `4a02` (Bilal), lösenord `lilla123`.
  Slumpade emulatorportar, under `flock /tmp/schack-773-emulator.lock`.
- `node --test test/schack-kompis.test.js test/schack-kompis-lyssnare.test.js` – klockvisningen,
  lobbyfiltret (utgångna väntan/utmaningar), topplistans sortering, §7.3, slutrutan, `dragDiff`,
  markupen, den delade lyssnaren (en onSnapshot, stängs efter sista vyn och direkt vid lämna,
  `schackSlutaVanta`), ett helt parti genom låtsas-servern och källkodstester (ingen ångra/tips/
  varna i kompisläget, unsubscribe i `destroy`, allt lat, datorräknaren en gång).
