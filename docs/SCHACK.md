# Schack

Uppdraget: [`UTVECKLINGSUPPDRAG_SCHACK.md`](UTVECKLINGSUPPDRAG_SCHACK.md). Det här
dokumentet beskriver det som är byggt. Etapp 1 byggs i tre delar:

| Del | Issue | Innehåll |
| --- | --- | --- |
| A | #775 | chess.js, brädet, pjäserna, förhandsvisningen (§1–§2) – **klar** |
| B | #776 | motorn, nivåerna, hjälpen mot datorn och elevens schacksida (§3–§4) – **klar** |
| C | #777 | slut-QA och rapport (§5) – **klar**, se [`RAPPORT-schack-etapp-1.md`](RAPPORT-schack-etapp-1.md) |

Avsnitten om callables, datamodellen och kvotbudgeten fylls i av Etapp 2.

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
src/styles/35-schack.css     brädets CSS, 36-schack-sida.css sidans (byggs in i styles.css med npm run build:css)
preview/preview-schack.html         brädet och pjäserna (A; preview/schack/)
preview/preview-schack-dator.html   hela elevflödet mot datorn utan Firebase (B)
preview/preview-schack-matning.html mätning av ms per drag och nivå (B, preview/schack/matning.js)
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
