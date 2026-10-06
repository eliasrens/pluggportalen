# Pixi-rörelsen: GPU-minne, Chromebook-budget, context-loss och mätprotokoll (G1 #425, epic #396)

**Datum:** 2026-10-06. **Gren:** `coder/issue-425-…` (byggd på epic-grenen med F1–F4, F4b och S1–S6).
**Läs först, Elias:** §6 är protokollet du kör på din dator och på en Chromebook. Det tar ungefär 10 minuter per maskin.
Resultaten fyller du i tabellen i §6.4. De avgör om budgeten och motorns väntetider behöver justeras före I1.

---

## 1. Sammanfattning

- **Budgeten är kalibrerad för skolans Chromebooks** (§2). En vanlig 1366×768-Chromebook ryms med
  förvärmda övergångar hus↔by och hus↔rum (≈ 34 + 40 MB) inom 112 MB. Antalet förvärmda
  övergångar anpassas nu efter scenens verkliga storlek, så motorn förvärmer aldrig mer än budgeten rymmer.
- **Viktigt fynd: Pixi:s inbyggda texturstädning (GC)** laddade ur varje textur som inte ritats på 60 s.
  En förvärmd pyramid för en övergång man inte gjort på en minut laddades alltså upp till GPU:n *i rörelsens
  första frames*, och det är precis den hacke vi bygger bort. Nu får inget laddas ur för att det vilat
  (`gcMaxUnusedTime` = ∞). GC:n körs ändå var 30:e sekund, men bara för att städa interna tabeller (§3.1).
- **Context-loss** mitt i en resa → resan avslutas i slutläget (DOM) utan fel. Resor medan GPU:n är
  borta går CSS-vägen. Efter restore laddar workern upp texturerna igen *innan* den säger "återställd",
  och nästa resa går via Pixi utan uppladdningskostnad (§4).
- **Emoji:** desken saknar färg-emojifont helt, så detektionen säger där `ingen-fargfont`. Reserven
  (emoji som text-sprites ovanpå texturen) är byggd, provad med tvång på desken och slås på automatiskt om
  Chromebookens SVG-bild saknar färg-emoji. Det verifieras på Chromebook (§5, §6.3).
- **HUD (`?pixi=debug`)** visar nu budget, workerns verkliga texturbokföring, GPU, kontext, emoji-läge
  och fördelningen *pixi / css:&lt;orsak&gt;* över alla resor, med handoff- och pyramidtider.

## 2. Budget per enhetsklass (`src/varld-textur-budget.js`)

### 2.1 Enhetsklass

| Signal | "svag" om | Kommentar |
|---|---|---|
| `navigator.deviceMemory` | ≤ 4 GB | Chromium rapporterar alltid, alltså alla Chromebooks. Huvudsignalen. |
| `hardwareConcurrency` | ≤ 2, eller ≤ 4 när minnet är okänt | §6 hade "≤ 4 kärnor". Det gjorde varje fyrkärnig 8 GB-laptop svag. |
| `MAX_TEXTURE_SIZE` | < 8192 | från workern |
| GPU-sträng (`UNMASKED_RENDERER`) | SwiftShader/llvmpipe/"software"/"Basic Render" | mjukvaru-GL, ny i G1 |
| `pp:pixi:klass=svag\|normal` | tvingar | för att prova Chromebook-budgeten på en stark dator |

Typiska skol-Chromebooks blir alla "svag": N4020/N4500 (2 kärnor, 4 GB), MT8183 (8 kärnor, 4 GB),
N5100 (4 kärnor, 4 GB). Desken (SwiftShader) blir "svag" via GPU-strängen.

### 2.2 Värden

| Parameter | svag (§6 → **G1**) | normal (§6 → **G1**) |
|---|---|---|
| `maxBytes` | 72 → **112 MB** | 256 MB |
| `maxPar` (tak) | 1 → **2** | 3 |
| `maxPar` (verkligt) | **= hur många övergångar (värsta zoom 6) som ryms i `maxBytes` för scenens storlek**, minst 1 | samma |
| `dprTak` | 1 | 1.5 |
| `steg` | 1.5 | 1.5 (Elias är känslig för suddighet, så ingen ändring) |
| `under1Upplosning` | 0.5 | 1 |
| `tegel` | 2048 (≤ `MAX_TEXTURE_SIZE`) | 2048 |

Uppskattad kostnad per övergång (`overgangBytes`, testad mot `planeraNiva` ±3 %):

| Enhet (scen i CSS-px) | klass | T2 (zoom 5) | T3 (zoom 6) | verkligt `maxPar` |
|---|---|---|---|---|
| Chromebook 1366×768 (scen ≈ 1366×700, dpr 1) | svag | 34 MB | 40 MB | 2 |
| FHD-Chromebook i 125 % (≈ 1536×800) | svag | 44 MB | 52 MB | 2 |
| Laptop 1920×1080 (≈ 1920×1000, dpr 1) | normal | 98 MB | 117 MB | 2 |
| MacBook 1440×900 dpr 2 (tak 1.5) | normal | 132 MB | 158 MB | 1 |

**Varför 112 MB på svag:** huset är navet. Därifrån går T2 (by), T3 (rum) och T7 (gård). Med 72 MB
rymdes bara en förvärmd övergång, så klicket på huset (T3, den vanligaste resan) fick ofta byggas kallt
och föll till CSS när det tog mer än 250 ms. 112 MB rymmer två övergångar på både 1366- och FHD-Chromebooks, med
marginal för en reserv-pyramid medan ett lager speglas om. Budgeten är ett *tak*: LRU:n fyller bara
det som faktiskt byggs. Desken låg på högst 44–66 MB under 20 resor (§7).

### 2.3 Övrig minneshushållning

- **30 s-städning** (§6 i arkitekturen, i vakten `varld-motor-hud.js`): pyramider för lager som varken är
  det aktiva eller dess granne i någon kamera, och som inte använts på 30 s, släpps. Exempel: hus → gård →
  laggård → gård → hus → rum och sedan 42 s i rummet ger 33 → 19 MB. Gårdens pyramider släpps, rummets och
  husets ligger kvar, och hus↔rum går fortsatt via Pixi.
- **Porten (S6 #424):** portens textur är ≈ 30 MB medan login-sidan är öppen och släpps helt vid 1410 ms
  (S6:s mätning). Den räknas inte i världens LRU, men den lever aldrig samtidigt med världens pyramider.

## 3. Fynd som påverkar GPU-minnet

### 3.1 Pixi v8:s GC (åtgärdat)
Pixi 8.22 har `gcActive: true, gcMaxUnusedTime: 60 000 ms` som standard. Workern ritar bara under
rörelser, så alla förvärmda texturer räknas som "oanvända" efter en minut. De laddades då ur och laddades
upp igen i första framen av nästa resa (≈ 5–40 MB uppladdning mitt i rörelsen på en Chromebook).
- Åtgärd: `gcMaxUnusedTime: Number.MAX_SAFE_INTEGER`. Motorn äger livscykeln (LRU + `slappLager`).
- `gcActive: false` provades först. Då växer Pixi:s interna hashtabeller med null-platser för varje
  förstörd textur (bara GC:n kompakterar dem). Desken visade 284 "GL-texturer" mot 52 levande efter 20
  resor. Med GC:n igång men oändlig vilotid är GL-räknaren alltid = levande texturer + 1 (Pixi:s EMPTY).

### 3.2 Uppföljning för I1 (inte åtgärdat, rapporteras)
- **Bitmaps hålls kvar efter uppladdning.** Workern behåller varje tegels `ImageBitmap` så att den kan
  ladda upp igen efter context-loss. I Chromium är en accelererad 2D-canvas-bitmap också ett
  GPU-objekt, så verklig förbrukning kan vara upp till ≈ 2× budgeten. Alternativet är att stänga bitmapen
  efter uppladdning och låta motorn bygga om vid restore. Det är mindre minne men en kall resa efter
  GPU-krasch. Mät först på Chromebook (§6.2, `chrome://gpu` → "GPU memory" om tillgängligt).
- **Nivå 1 byggs två gånger** när samma lager är ytterroll i en övergång och innerroll i en annan
  (t.ex. huset i T2 och T3). Det kostar ≈ 5 MB per sådant par på en Chromebook. Delning kräver nyckeländring i
  `varld-motor-textur.js` (F4b-ägd).

## 4. Context-loss

| När | Vad händer | Verifierat på desk |
|---|---|---|
| Mitt i rörelsen | workern avbryter (`klar{avbruten}`), DOM:en visas i slutläget, kameran resolvar vid 900 ms som vanligt, `onNiva` körs | T2 hus→by: 8 frames, sedan avbrott; `by-lager` synligt (opacity 1, ej inert), 0 fel |
| Under handoffen (före första framen) | samma, 0 frames | ja |
| Medan GPU:n är borta | `Renderare.dod` → `data-pixi-spel="css:kontext-forlorad"`, dagens CSS-övergång | ja |
| Restore | Pixi bygger om GL-tillståndet, workern laddar upp alla lagers texturer (4 per uppgift), *sedan* `kontext{aterstalld}`; vakten förvärmer | `gl` 23 = 22 texturer + EMPTY; nästa T2 båda håll `pixi` (25 frames) |
| Restore uteblir (riktig GPU-krasch) | CSS-väg resten av sessionen | – |

Känd rest: en resa som avbryts av context-loss *hoppar* till slutläget i stället för att tona klart
med CSS. Det är sällsynt, och en snygg CSS-fortsättning skulle kräva att kameran (F4) får ett mellanläge.

## 5. Emoji (`src/varld-emoji.js`)

- **Detektion** (en gång, när motorn startar): 😀 ritas i appens font-familj dels som SVG-som-bild, dels med
  canvas-2D `fillText`. Färgade pixlar (kroma > 48, > 20 px) = färg-emoji.
  `svgFarg && …` → reserven av; `!svgFarg && canvasFarg` → **reserven på**; ingen färg alls → av (inget att vinna).
- **Reserven:** emoji-glyferna i spegelns `<text>` görs osynliga (`<tspan fill-opacity="0">`, så layouten är
  orörd) och varje synlig emoji ritas som en *text-sprite*, alltså samma sak som Pixi `Text` gör internt
  (canvas-2D `fillText` → textur). Det sker på main med DOM:ens fontregister, i ett överlägg ovanpå lagret
  (`varld-motor-overlagg.js`). Detta gäller även emoji inuti sprites (husdjur, äpplen).
- **Flagga:** `pp:pixi:emoji=text|svg` tvingar, eller `?pixi=emoji-text|emoji-svg|emoji-auto`.
- **Desk:** `{svgFarg:false, canvasFarg:false, orsak:"ingen-fargfont"}`, alltså reserven av. Tvingad på:
  rummets två emoji (📦 i "tomt rum"-texten och 🗑️) blir ett överlägg med text-sprites. hus↔rum och hus↔by
  går fortsatt via Pixi och utan fel. I `frys`-jämförelsen ligger glyfen på pixeln där DOM:ens ligger (desken
  har ingen färgfont, så båda är svart-vita, och *färgen* kan bara verifieras på Chromebook).

## 6. Mätprotokoll för Elias (dator + Chromebook)

### 6.1 Förberedelse
1. Öppna previewn (samma som desk-testet: `preview-pixi-skola.html`, inloggad stub-elev, inga
   Firestore-läsningar) med **`?pixi=debug`**. HUD:en syns nere till vänster.
   Prova Chromebook-budgeten på din dator: `?pixi=debug,klass-svag`. Tillbaka: `?pixi=normal`.
2. Notera i tabellen (§6.4) det HUD:en visar på raden **gpu** (namn, maxTex) och **budget** (klass, maxPar, dpr).
3. Chromebook: `chrome://gpu` → kontrollera att "WebGL" och "Canvas" är *Hardware accelerated*.

### 6.2 Känsla + 20-resors-mätning
1. Klicka runt själv i 1–2 min: by ↔ hus ↔ rum, hus ↔ gård ↔ laggård, by ↔ skola. Känns det mjukt?
   Ser något suddigt eller hoppigt ut i början eller slutet av en rörelse?
2. Öppna konsolen (Chromebook: **Ctrl+Shift+J**), klistra in och kör:

```js
(async () => {
  const st = () => document.querySelector(".varld-stage"), v = (ms) => new Promise((r) => setTimeout(r, ms));
  const R = { skola: "#/elev/skolan", by: "#/elev/by", hus: "#/elev/hus", rum: "#/elev/rum", gard: "#/elev/gard", laggard: "#/elev/laggard" };
  const G = { skola: ["by"], by: ["skola", "hus"], hus: ["by", "rum", "gard"], rum: ["hus"], gard: ["hus", "laggard"], laggard: ["gard"] };
  __ppPixi.g1.nollstall();
  let n = st().dataset.niva, maxMB = 0;
  for (let i = 0; i < 20; i++) {
    const g = G[n] || ["hus"]; location.hash = R[g[Math.floor(Math.random() * g.length)]]; await v(2000);
    const s = await __ppPixi.g1.stats(); maxMB = Math.max(maxMB, s.lru.summa / 1048576); n = st().dataset.niva;
  }
  const m = __ppPixi.g1.matning(), s = await __ppPixi.g1.stats();
  console.table({ andelPixi: m.andelPixi, vagar: JSON.stringify(m.vag), skulleMissat: m.skulleMissat,
    missatVanta: m.missatVanta.join(","), missatVila: m.missatVila.join(","), reserv: m.reserv,
    handoffMedian: m.forberedMedian, handoffMax: m.forberedMax, pyramidMedian: m.omspeglingMedian, pyramidMax: m.omspeglingMax,
    tappadeFrames: `${m.tappade}/${m.frames}`, maxMB: maxMB.toFixed(1), budgetMB: s.budget.maxBytes / 1048576,
    klass: s.klass, maxPar: s.budget.maxPar, gpu: s.gpu });
})();
```

3. Kör en gång till med **`?pixi=tvinga,debug`**. Då väntar motorn längre i stället för att falla till CSS
   (F4b), och `skulleMissat` / `missatVanta` / `missatVila` visar *hur mycket* för lite tid det var.

### 6.3 Emoji (bara Chromebook)
1. I konsolen: `await __ppPixi.g1.emoji()` → notera `svgFarg`, `canvasFarg`, `lage`.
2. Gå till rummet (med husdjur eller äpplen 🍎) med `?pixi=frys,debug`, gå ut och in igen och kör
   `__ppPixi.motor.jamfor(true)` (canvasen visas i stället för DOM:en) och `__ppPixi.motor.jamfor(false)`.
   Har emojin färg i båda lägena?
3. Om `lage` är `"svg"` men emojin är svart-vit i canvasläget: prova `?pixi=emoji-text,frys,debug` och upprepa.
   Rapportera resultatet, eftersom detektionen då behöver justeras.

### 6.4 Resultat (fyll i)

| | Desk (SwiftShader, 725×420) | Elias dator | Chromebook |
|---|---|---|---|
| gpu / maxTex | SwiftShader / 8192 | | |
| klass / maxPar / dpr | svag / 2 / 1 | | |
| andel pixi (20 resor) | 0,95–1,0 | | |
| css-orsaker | 1× `css:vanta` (första by-besöket, byn byggs lat) | | |
| skulleMissat (vänta / vila) | 0–2 / 20 (vänta 252, 263 ms) | | |
| handoff median / max (ms) | 106–161 / 217–347 | | |
| pyramid min median / max (ms) | 49–73 / 153–349 | | |
| tappade frames (> 25 ms) | 263–323 / 474–541 (SwiftShader) | | |
| max MB / budget | 43,9–65,6 / 112 | | |
| emoji svgFarg / canvasFarg / läge | false / false / svg | | |
| känsla (mjukt? suddigt? hopp?) | – (kan ej bedömas) | | |

### 6.5 Hur resultatet tolkas
- **Andel pixi < 0,8 på Chromebook** är ett fynd för I1. Titta på vilken `css:<orsak>` som dominerar:
  - `css:vanta`: pyramiden hann inte byggas inom `VANTA_MAX_MS` (250). Se `pyramidMedian`.
  - `css:vila-timeout`: workern hann inte rita vilo-bilden inom 500 ms (GPU/worker belastad).
  - `css:kontext-forlorad`: GPU:n tappade kontexten. Rapportera hur ofta det händer.
- **maxMB nära budgeten** och samtidigt låg andel pixi betyder att budgeten är för snål för skärmen.
  Rapportera skärmstorleken.
- **Tappade frames** är jämnhetsmåttet: andelen frame-dt > 25 ms. På riktig GPU bör den vara nära 0.

## 6.6 Rekommendation: `VANTA_MAX_MS` / `VILA_TIMEOUT_MS` (ändras INTE här, I1 avgör)

Underlag: S1 såg att husets omspegling (levande moln/rök speglas om vid handoff) ofta tar 270–430 ms mot
gränsen 250 ms, och då spelas rörelsen på reserv-pyramiden. På desken var `skulleMissat` 0–2 av 20
(vänta 252–263 ms) och `missatVila` 0.

1. **Två väntetider i stället för en.** När en *reserv*-pyramid finns (bara omspeglingen saknas) är
   väntan ren fördröjning för eleven: inget rör sig efter klicket, och reserven har rätt innehåll med
   ambienten i förvärmningens pose. Föreslag: **vänta högst ~120 ms när reserven finns** och spela sedan
   på den. Behåll **250 ms när inget finns** (kall övergång), eftersom CSS-reserven där är bättre än en lång paus.
2. **Svag klass:** blir Chromebookens `pyramidMedian` 250–350 ms kan 350 ms för kalla övergångar på
   "svag" övervägas, men bara om `skulleMissat.vanta` ligger i 250–350 ms. Över 400 ms upplevs klicket som
   segt, och då är CSS-vägen rätt.
3. **`VILA_TIMEOUT_MS` 500:** ingen ändring. Desken missade aldrig. Höj till 700 ms bara om Chromebookens
   `missatVila` visar 500–700 ms.
4. Billigare omspegling (S1/S4 sprites i stället för omspegling) minskar behovet mer än längre väntan.

## 7. Desk-verifiering (G1 klick-test, 2026-10-06)

Stub-previewn `preview-pixi-skola.html?pixi=debug` (riktig app-kod, stubbad data, 0 Firestore). Allt via
`evaluate_script` i desk-browsern (SwiftShader, scen 725×420, klass "svag").

| Test | Resultat |
|---|---|
| 20 slumpade resor (by/skola/hus/rum/gård/laggård), tre körningar | 18/19, 19/20 och **20/20 via Pixi** (efter merge av S5/S6); enda CSS-orsaken `css:vanta` vid första besöket i den lat byggda byn |
| Budgettak | LRU-summa högst 43,9–65,6 MB ≤ 112 MB, aldrig över; LRU-summan = workerns verkliga bytes i varje steg |
| Eviction utan läckor | `rensaAllt`: 42 texturer / 42 bitmaps / 43,9 MB / GL 43 → **0 / 0 / 0 / GL 1** (Pixi:s EMPTY) |
| Context-loss mitt i T2 | 8 frames, avbrott, slutläget visas, 0 fel; under förlust `css:kontext-forlorad`; efter restore `gl` = texturer + 1, nästa T2 båda håll `pixi` |
| Tvingad `MAX_TEXTURE_SIZE` 4096 | `maxTex` 4096, tegel 2048 ≤ 4096, resorna `pixi` |
| Tvingad `MAX_TEXTURE_SIZE` 512 | tegel delas (512×421 + 213×421), resorna `pixi` |
| Pixi-GC | texturer som vilat 70 s ligger kvar (GL-räknaren oförändrad) |
| 30 s-städning | 33 → 19 MB efter 42 s i rummet; gårdens pyramider släppta, hus↔rum fortsatt `pixi` |
| Emoji | detektion `ingen-fargfont`; tvingad reserv: överlägg skapas, rätt position i `frys`-jämförelsen, 0 fel |

## 8. Flaggor (localStorage, alla i try/catch; via URL `?pixi=a,b,…`)

| Flagga | URL | Effekt |
|---|---|---|
| `pp:pixi:debug` | `debug` | HUD + konsollogg + mätning (`__ppPixi.g1.matning()`) |
| `pp:pixi:klass` | `klass-svag` / `klass-normal` | tvinga enhetsklass |
| `pp:pixi:maxtex` | `maxtex-4096` | kör som om GPU:n hade det `MAX_TEXTURE_SIZE` |
| `pp:pixi:emoji` | `emoji-text` / `emoji-svg` / `emoji-auto` | tvinga emoji-reserven på/av |
| (F1/F4) | `av`, `frys`, `tvinga`, `normal` (= ta bort alla) | som tidigare |

Test-API: `__ppPixi.g1.stats()` (klass, budget, LRU, worker{texturer, bitmaps, bytes, gl, lager, forlorad},
gpu, kontext, emoji), `matning()`, `nollstall()`, `stada()`, `rensaAllt()`, `emoji()`.
