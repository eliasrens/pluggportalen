# Designsystem – Pluggporten

Ett litet, avsiktligt minimalt designsystem. Syftet är att **centralisera de
delar som historiskt gett överlapp-buggar** (staplingsordning + dolda element)
utan att röra appens utseende. Kontext: GitHub-issue #73.

> Detta dokument beskriver det som redan finns i koden i dag. Det är inte en
> omdesign – färger, storlekar, positioner och layout är oförändrade.

---

## 1. Z-lager (våningsordningen)

Alla `z-index` i `src/styles.css` ligger nu som **tokens på `:root`** i stället
för utspridda magiska tal. Värdena är exakt desamma som förut, så vilket element
som ligger över vilket är **oförändrat** – det här är ren omstrukturering.

Det finns två grupper. De flesta scen-elementen lever i **lokala
staplingskontexter** (inuti `.varld-stage` / `.varld-lager`), så deras låga tal
jämförs bara med syskon i samma scen. App-ramen är sidnivåns `fixed`/`sticky`-
chrome och ligger ovanpå allt scen-innehåll.

### Grupp 1 – Scenen (spelvyn: rum, hus, by)

| Token | Värde | Används av | Vad lagret är till för |
|-------|-------|-----------|------------------------|
| `--z-scen-markor` | 2 | `.by-du`, `.by-last-ikon`, `.omrade-du` | Små brickor ("Du", hänglås) ovanpå ett hus/tomt |
| `--z-scen-drag` | 5 | `.room-item.dragging` | En möbel som just dras lyfts över de andra |
| `--z-scen-objekt` | 6 | `.rum-dorr`, `.rum-lista` | Dörrar på väggen + rums-pillraden, ovanför rummets innehåll |
| `--z-bubbla` | 6 | `.by-last-bubbla` | Pratbubblor/tooltips (t.ex. "huset är låst") |
| `--z-scen-hint` | 8 | `.hus-hint` | Hint-remsan nederst i scenen |
| `--z-scen-ui` | 12 | `.varld-ui` | Scenens overlay-kontrollskikt (knappraden ligger här) |
| `--z-panel` | 14 | `.varld-petpanel` | Flytande scen-paneler (husdjurspanelen) |
| `--z-meny` | 16 | `.varld-verktyg-meny`, `.varld-klass-stats` | Popover-menyer som fälls ut i scenen |

### Grupp 2 – App-ram (sidnivå)

| Token | Värde | Används av | Vad lagret är till för |
|-------|-------|-----------|------------------------|
| `--z-flik-nav` | 20 | `.teacher-nav` | Sticky flikband på lärarsidan |
| `--z-sido-overlay` | 25 | `.sidebar-overlay` | Scrim bakom off-canvas-menyn (mobil) |
| `--z-sidomeny` | 30 | `.sidebar` | Sidomenyn |
| `--z-hamburger` | 40 | `.hamburger` | Hamburger-knappen (mobil), över menyn |
| `--z-toast` | 50 | `.flash-box` | Flash/toast-meddelanden |
| `--z-modal` | 1000 | `.cx-modal-overlay` | Modaler (per-elev-fördjupning) |

**Regel för nya features:** lägg aldrig ett nytt magiskt `z-index`-tal. Välj den
token vars roll passar, eller lägg en ny token på `:root` om ingen passar –
så att ordningen förblir läsbar på ett ställe.

### Medvetet lämnat som literaler

* **Byns hus/dekor** (`src/varld-by-scen.js`) sätter `z-index` **dynamiskt** per
  element utifrån markpunktens y (`Math.round(y * 10)`) för att få rätt
  målarordning djupled. Det är per-element och beräknat, inte en fast token –
  lämnas som det är.
* **`.class-tbl .cx-name` / `.cx-corner`** (1 respektive 2) är en avsiktligt
  **lokal** stapling inuti den skrollbara tabellen (fastnålad cell vs. hörn).
  Den rör inte scenens/appens våningsordning och är kvar som literaler med en
  kommentar i CSS:en.

### Avatarplagg och djur använder inte z-index

Avatarens plagg (rygg < bas < framför ansiktet) och djuren staplas via
**SVG:ens rit-/dokumentordning** (det som ritas senare hamnar överst), inte via
`z-index`. Vill man ändra den ordningen ändrar man alltså elementens ordning i
markupen – inte ett z-tal.

---

## 2. `[hidden]`-robusthet

Högst upp i `src/styles.css` finns nu en global regel:

```css
[hidden] { display: none !important; }
```

**Varför `!important`:** webbläsarens inbyggda (UA) regel `[hidden]{display:none}`
är svag. En vanlig komponentregel som `.varld-knapp{display:inline-flex}` har
samma eller högre specificitet och **vinner**, så elementet blev kvar synligt
trots `hidden`-attributet. Det var källan till spök-/överlapp-buggarna (t.ex.
knappen "🔭 Andra byar" som hängde kvar på fel nivåer).

Tack vare den globala regeln behövs inte längre de per-komponent-overrides som
tidigare fanns (`.varld-knapp[hidden]`, `.varld-verktyg-meny[hidden]`,
`.rum-dorr[hidden]`, `.varld-klass-toggle[hidden]`, `.varld-klass-stats[hidden]`)
– de är borttagna, med en kort kommentar kvar på plats.

**Att tänka på:** göm/visa element genom att sätta/ta bort `hidden`-attributet
(eller `el.hidden = true/false`), inte via `style.display`. Då tar den globala
regeln alltid. Vill man verkligen visa något som samtidigt bär `hidden` (mycket
ovanligt) får man ta bort attributet i stället.

---

## 3. Rums-scenens koordinatsystem

Scenen (`.varld-stage` / `.varld-lager.room-stage`) är en `position: relative`-yta
där allt placeras i **procent av scenens bredd/höjd**. Nyckelkonstanterna bor i
`src/art-room.js`:

| Konstant | Värde | Betydelse |
|----------|-------|-----------|
| `FLOOR_TOP` | `62` | Procent av scenhöjden där **golvet börjar**. Ovanför = vägg, nedanför = golv. |
| `WALL_SEAM` | `49.6` | Väggskarven (vägg möter panelband), i procent av höjden. |
| `WINDOW_DEFAULT` | `{ x: 50, y: 49.6 }` | Fönstrets default-läge, centrerat på väggskarven. |

Så här förhåller sig objekten till scenen:

* **Möbler/saker (`.room-item`)** placeras med centrum i `left/top %` och
  `translate(-50%, -50%)`. De dras & släpps fritt på scenen.
* **Djur** promenerar på **golvet**: drag/gång-clampen (`src/rum-promenad-golv.js`)
  håller fötterna vid golvytan – `minY = max(halfH, FLOOR_TOP + 4 - halfH)` – så
  de aldrig hamnar uppe på väggen eller under golvkanten.
* **Mat** kan bara placeras på golvet: y clampas till `>= FLOOR_TOP + 2`
  (`src/varld-rum-mat.js`).
* **Dörrar (`.rum-dorr`)** sitter på **väggen**, inte på golvet framför spelaren
  (issue #59). Växlaren (`src/varld-rum-vaxlare.js`) clampar dörr-y till
  `<= FLOOR_TOP`, så dörren håller sig ovanför golvlinjen.

**Regel för nya features:** vill du placera något i scenen, bestäm först om det
hör till **väggen** (y < `FLOOR_TOP`) eller **golvet** (y ≥ `FLOOR_TOP`) och
clampa mot `FLOOR_TOP` – lägg det inte "på golvet framför" av misstag.

---

## 4. Plugga-sidorna och sidomenyn (#701–#704)

Facit: `preview/preview-plugga-design-forslag.html`. CSS:en ligger i
`src/styles/31-plugga.css` (korten) och `src/styles/02-layout-meny.css`
(menyn). Redigera delfilerna och kör `npm run build:css` – `src/styles.css`
är genererad. Samma gradienter, skuggor och radier som `.big-card` i övrigt.

### 4.1 Kompakta kort – `.big-card.kompakt`

Liggande kort för Plugga-startsidan (områden) och områdessidans "Öva" (lägen).

| Del | Värde |
| --- | --- |
| Kort | `.big-card <färg> kompakt` (+ `.omrade-kort` på startsidan), `padding: 14px 18px`, `min-height: 92px`, vänsterställd text |
| Emoji-ruta | `.emoji` 52 × 52 px, `border-radius: 14px`, `rgba(255,255,255,.22)`, emoji 2,3rem |
| Text | `.txt` (kolumn): `.amne` (små versaler 0,75rem, bara områdeskort) → `.title` 1,2rem (bryts, aldrig utanför) → `.sub` 0,88rem |
| Framsteg | `.framsteg`: `.stapel` 7 px (vit på `rgba(255,255,255,.3)`) + "★ X av Y"; saknas när området inte har några stjärnlägen |
| Märken | `.nymarke` – vitt snett piller i hörnet ("Ny!"); gult när kortet är `.fortsatt-har` ("Fortsätt här") |
| "Fortsätt här" | `.fortsatt-har`: `outline: 4px solid #fff` + `box-shadow: 0 0 0 7px var(--gul)` – bara ett kort åt gången |
| Rutnät | `.kompakt-grid`: `repeat(auto-fill, minmax(min(100%, 260px), 1fr))`, `gap: 16px` |

`.title` och `.sub` är `display: block` i alla `.big-card` – namn och
beskrivning hamnar alltid på var sin rad (buggen "SkattjaktenAnländ med båt").

### 4.2 Sidrubrik och sektionsrubriker

- `.pl-huvud` – sidrubrik direkt på bakgrunden (ingen vit panel): h1 2,1rem +
  en dämpad rad (`var(--text-svag)`).
- `.omr-huvud` – områdessidans rubrikrad: "← Plugga" (`btn ghost liten`),
  emoji 3rem, h1 2rem + beskrivning, och längst till höger `.omr-pill`
  (vitt piller, `starIcon(22)` + "X av Y").
- `.sektion-rubrik` – h2 1,5rem ("Öva", "Äventyr", "Dina områden") och en
  dämpad förklaring på samma baslinje (`<span>`). Bryts till två rader när
  det inte får plats.

### 4.3 Äventyrskort med bild – `.big-card.adv-liten`

```
┌──────────────────────────────┐
│   [bild: oversikt.scen()]    │  78 px (3 kolumner) – 120 px (brett kort)
├──────────────────────────────┤
│ Skattjakten          ☆ ☆ ☆   │  temats gradient (oversikt.color)
│ Anländ med båt, utforska …   │
└──────────────────────────────┘
```

- Kortet: `padding: 0`, `overflow: hidden`, kolumn-flex. Under bilden
  `.adv-rad` med `.txt` (`.title` 1,2rem utan "Äventyr:", `.sub` 0,85rem)
  och stjärnraden till höger.
- **Bilden** kommer från temats `oversikt.scen()` (i temafilen
  `src/adventure/themes/<id>.js`, laddas med temaregistret – aldrig i
  bootgrafen). Den returnerar en SVG-sträng med `viewBox="0 0 320 140"` och
  `preserveAspectRatio="xMidYMid slice"`.
- **Stil:** platt och lekfull som sajtens egen konst (`art-style.js`):
  mörklila kontur `#3B3350` 2–2,5 px, runda ändar och hörn, klara färger,
  **inga gradienter** (ett platt sken med `opacity` går bra). Ett tydligt
  motiv i mitten.
- **Beskärning:** hela bredden (320) syns alltid – bara höjden kapas, lika
  mycket uppe som nere. Lägg allt viktigt inom **y ≈ 40–100** och låt
  himmel/mark fylla hela 0–140 så att kanterna aldrig blir tomma.
- **Reservläget** (tema utan `scen`, eller om `scen()` kastar):
  `.scen-reserv` – ljus yta med temats `progressIcon` stor i mitten.
- Förhandsvisning av alla teman med och utan bild i alla kortbredder:
  `preview/preview-aventyr-kort.html`.

### 4.4 Live-rutan i sidomenyn – `.sido-live`

Rosa gradient (som `.big-card.rosa`), vit text: ⚡ + "Live pågår!" med "Gå
med i klassens match" under (`.sido-live-text small`) och en vit pulserande
prick (`.sido-live-prick`, stilla vid `prefers-reduced-motion`). Länk till
`#/elev/live`; `.aktiv` (ljus inre ram) när eleven står på Live-sidan. Visas
bara när Live-villkoret är sant och fokuslåset tillåter Live. Se
`design/DESIGNBESLUT-meny-sidebar.md` §5.

### 4.5 Ämnesfärger – `subjectColor(subject, index)`

`src/plugga-framsteg.js`. Ett giltigt `color`-fält på ämnesdokumentet vinner,
annars tabellen (id eller namn, gemener), annars ämnets plats i listan.

| Ämne | Färgklass |
| --- | --- |
| so, samhällskunskap, historia, geografi, religion | `bla` |
| ma, matematik, matte | `orange` |
| no, biologi, fysik, kemi, teknik | `gron` |
| sv, svenska | `lila` |
| en, engelska | `rosa` |
| annat | `bla`, `gron`, `lila`, `rosa`, `orange` efter plats i listan, sedan om |

Övningskorten på områdessidan behåller lägets egen färg (`gm.color`) och
äventyrskorten temats (`oversikt.color`).

### 4.6 Olika skärmar och brytpunkter

Inga nya brytpunkter – de nya delarna följer de som redan finns.

| Brytpunkt | Vad som händer |
| --- | --- |
| Innehållsytans bredd (inte fönstret) | `.kompakt-grid` räknar kolumner ur ytan som blir kvar bredvid sidomenyn: 3 kolumner vid full bredd (880 px), 2 när ytan är 536–811 px, 1 under det |
| `max-width: 820px` | Sidomenyn blir off-canvas-låda bakom hamburgern; innehållet får hela bredden (därav 2 kolumner på surfplatta stående) |
| `max-width: 700px` | `.omr-huvud` bryts: knappen och stjärnpillret överst, emoji + titel under (h1 1,6rem) |
| `max-height: 800px` / `600px` | Sidomenyn tätas i två steg (profilruta, avatarcirkel 56/48 px, Live-rutan, länkar) så att den ryms utan egen scroll |
| `prefers-reduced-motion` | Live-prickens puls och länkarnas studs stängs av |

**Äventyrsbildens höjd följer kortets bredd** (container query på kortet):
`height: clamp(78px, 25cqi, 120px)`. I tre kolumner är kortet ≈ 270 px och
bilden exakt 78 px som i facit. Bredare kort (2 kolumner på surfplatta, 1
kolumn på mobil) får en högre remsa så att samma del av bilden (y ≈ 35–105)
syns i stället för att motivet zoomas in och kapas. Webbläsare utan
container queries får 78 px.

Uppmätt på områdessidan (Vikingatiden, 6 + 3 kort):

| Fönster | Kolumner | Kortbredd | Bildhöjd | Äventyrsradens underkant |
| --- | --- | --- | --- | --- |
| 1920×1080, 1440×900, 1366×768, 1280×720, 1180×820 | 3 | 269 px | 78 px | 697 px – allt syns utan scroll, även på 1366×768 och 1280×720 |
| 820×1180 (surfplatta stående) | 2 | 375 px | 94 px | 1013 px – ryms |
| 390×844 (mobil) | 1 | 335 px | 84 px | scrollar (en kolumn) |
| 360×740 (mobil) | 1 | 305 px | 78 px | scrollar (en kolumn) |

---

## 5. Bråkresans matematikbilder (#707)

Komponentbiblioteket i `src/brakresan/komponenter/` (kontrakt: `docs/BRAKRESAN.md` §5,
facit: `preview/preview-brakresan-komponenter.html`). CSS:en `komponenter.css` laddas lat
av komponenterna själva – den ligger inte i `styles.css`.

| Token (på `.br-k`) | Värde | Används till |
| --- | --- | --- |
| `--br-turkos` / `-mork` / `-ljus` | `#13a39a` / `#0b7d76` / `#dff5f2` | valda delar, rätt-utfall, lodrät andel |
| `--br-lila` / `-ljus` | `var(--lila)` / `#efe4fb` | knappar, operationer, fack, vågrät andel |
| `--br-guld` / `-ljus` | `#e8a915` / `#fff4d1` | helhetsetiketten, hjälpens pekning, stjärnor, mynt |
| `--br-black` | `#3b3350` | konturer och gränser (samma mörklila som appens konst) |

- **Helheten märks alltid** med en guldkantad etikett ("Hela staven = 1").
- **Aldrig bara färg:** valda delar har prickmönster, rätt = dubbel heldragen ram + ✓,
  fel = streckad ram + ↻, kort har bock/parsymbol, produktmodellens andelar har lodräta
  respektive vågräta ränder och överlappningen blir korsrandig.
- **Klickytor:** knappar ≥ 48 px, stavens och cirkelns delar ≥ 40–44 px även i en smal spalt;
  hundrarutans små celler kompletteras av radknappar, antalsknappar och tangentbord.
- **Storlekar:** `stor` (arbetsytan, max 640 px), `kort` (max 300 px), `mini` (bild i kort).
  Flera helheter (cirklar, hundrarutor) radbryts i stället för att krympa.
- **Rörelse:** omdelningens nya gränser tonas in, ny stjärna fylls kort; allt stilla vid
  `prefers-reduced-motion` eller `opts.reducedMotion`.

---

## Kom-ihåg: historiska överlapp-buggar och hur systemet stoppar dem

* **Knapp som hängde kvar trots `hidden`** ("🔭 Andra byar", `.varld-knapp`;
  även verktygsmenyn och klass-toggeln). Orsak: `display:flex/inline-flex`
  slog ut UA:s svaga `[hidden]`. → Stoppas nu av den globala
  `[hidden]{display:none!important}`.
* **Pill-rad/titel som ritades ovanpå varandra** i rums-toppen. Orsak: två
  element i samma topp-zon. → Löst i layout (offset `top: 54px` på `.rum-lista`);
  staplingen mellan scen-lager är nu tydlig via `--z-*`-tokens.
* **Dörr på golvet framför avataren** (issue #59). Orsak: dörr-y inte clampad
  mot väggen. → Växlaren clampar mot `FLOOR_TOP`; dokumenterat ovan.
* **Magiska z-index spridda i filen** gjorde det lätt att av misstag lägga en ny
  sak "över" eller "under" fel lager. → Centraliserat till `--z-*`-tokens med en
  enda läsbar ordning.

---

## Framtida steg (ej gjort i detta pass – hålls litet & visuellt säkert)

* **Spacing-skala (FÖRSLAG, ej infört):** avstånden i appen klustrar redan runt
  ett fåtal värden. En framtida token-skala skulle kunna vara
  `--sp-1: 4px; --sp-2: 6px; --sp-3: 8px; --sp-4: 10px; --sp-5: 14px; --sp-6: 16px; --sp-7: 20px; --sp-8: 24px`.
  Migrera **inte** befintliga px-värden nu – det riskerar synliga skift; inför
  bara skalan när nya komponenter byggs.
* **Radie/skugga-tokens:** `--radie` och `--skugga*` finns redan; fler
  komponenter kunde återanvända dem i stället för egna literaler.
* **Tabell-staplingen** (`.class-tbl`, z 1/2) kunde få egna lokala tokens om
  fler sticky-tabeller tillkommer.
