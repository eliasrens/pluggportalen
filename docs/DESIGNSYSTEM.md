# Designsystem – Pluggportalen

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
