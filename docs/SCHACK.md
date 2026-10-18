# Schack

Uppdraget: [`UTVECKLINGSUPPDRAG_SCHACK.md`](UTVECKLINGSUPPDRAG_SCHACK.md). Det här
dokumentet beskriver det som är byggt. Etapp 1 byggs i tre delar:

| Del | Issue | Innehåll |
| --- | --- | --- |
| A | #775 | chess.js, brädet, pjäserna, förhandsvisningen (§1–§2) – **klar** |
| B | – | motorn, nivåerna, hjälpen mot datorn och elevens schacksida (§3–§4) |
| C | – | slut-QA och rapport (§5) |

Avsnitten om motorn, callables, datamodellen och kvotbudgeten fylls i av B och Etapp 2.

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
src/styles/35-schack.css     CSS:en (byggs in i styles.css med npm run build:css)
preview/preview-schack.html  förhandsvisningen (preview/schack/)
```

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

## 6. Licenser

| Del | Licens | Fil |
| --- | --- | --- |
| chess.js 1.4.0 (Jeff Hlywa) | BSD-2-Clause – fri att använda på en publik sajt med licenstexten | `src/schack/vendor/LICENSE` |
| Pjäserna | egna, ritade för Pluggporten | `src/schack/schack-pjaser.js` |

Inga GPL-bibliotek (Stockfish, chessground) och inga pjäsbilder med oklar licens –
testet letar efter dem i `src/schack/`. **Uppgradera chess.js:** byt hela
`vendor/chess.js` mot paketets `dist/esm/chess.js`, behåll huvudkommentaren med den
nya versionen, ta bort `//# sourceMappingURL`-raden och byt `LICENSE` om den ändrats.
