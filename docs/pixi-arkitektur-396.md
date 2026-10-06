# Världsvyerna → PixiJS: arkitektur + parallell-säker uppdelning (epic #396, issue #397)

**Status:** plan klar och ska visas för Elias före fan-out. **Datum:** 2026-10-05.
**Gren:** `architect/issue-397-…` (baserad på epic-grenen, som i sin tur är `main` @ 913a77d).
**Underlag:** inventering av all världskod på main, spikens beslutsdok (#389, `docs/perf-renderare-beslut-388.md`
på spik-grenen), lärdomarna från #374/#381 och en avgränsad PoC (`preview-pixi-poc-397.html` + `preview/pixi-poc-397/`).

> **Läs först (det viktigaste på en rad):** Pixi ritar världen **under kamerans rörelse**, i en **Web Worker**
> (OffscreenCanvas). I vila är DOM:en exakt som idag — det är den eleven klickar på, den som har
> tillgänglighet, paneler och Firestore. Så blir övergångarna mjuka utan att något annat ändras.

---

## 0. Sammanfattning för Elias (läs detta om inget annat)

- **Vad ändras för eleven:** bara att kameraövergångarna (by↔hus↔rum, gården, kompis, skolan/grannbyar,
  porten→hem) blir mjuka. Konsten, klicken, panelerna, namnskyltarna, avatarerna och flödet är de
  befintliga DOM-elementen. De byts inte ut.
- **Hur:** när en övergång startar fotograferas ("speglas") de två lager som deltar till skarpa
  texturer (SVG-konsten rastreras av webbläsarens egen SVG-motor, alltså samma utseende). Pixi i en
  bakgrundstråd spelar zoomen med **exakt** dagens timing (900 ms, `cubic-bezier(0.55,0,0.2,1)`,
  opacitet 550 ms `ease` med 250 ms fördröjning). När rörelsen är klar visas DOM:en igen, på pixeln
  likadan.
- **Varför i en worker:** spikens (#389) största invändning mot Pixi var att en main-thread-ticker
  fryser när appen jobbar (t.ex. bygger byn). PoC:n visar att en worker-driven zoom **inte påverkas
  alls** av en 400 ms long task på main-tråden.
- **Varför DOM i vila:** att även bygga om klick, hover, drag & drop, husdjurens animationer,
  ARIA och fokus i Pixi vore en enorm omskrivning med regressionsrisk, och vinsten vore noll eftersom
  janken bara finns i rörelsen. DOM-noderna *är* hit-targets, så tillgängligheten behålls som den är.
- **Säkerhetsnät:** allt nytt laddas dynamiskt. Ingen ny fil hamnar i den statiska bootgrafen.
  Varje fel (ingen WebGL, worker saknas, 404 under Pages-deploy, context-loss, texturer inte klara)
  ger **dagens CSS-övergång**. A/B-spak `pp:pixi:av`.
- **Uppdelning:** 13 items. 4 fundament körs i ordning (F2 och F3 parallellt), sedan 6 scen-items +
  GPU-item parallellt, och sist integration + helhetsklick. Kritisk väg: **F1 → F2 → F4 → S4 (rummet) → I1**.

**Beslut Elias bör bekräfta före fan-out (rekommendation först):**
1. *Pixi bara i rörelse, DOM i vila* (rekommenderas) eller Pixi även i vila (avråds: se §2.1).
2. *Pixi vendorat i repot* (`vendor/pixi-8.22.0/`, rekommenderas: skolfilter, versionslås, inget CDN-beroende) eller från jsDelivr.
3. *Ambient-animationer (moln, rök, husdjurens gång) fryses under de 900 ms rörelsen varar*.
   Samma som Elias godkände i #374. De står stilla i rätt läge och fortsätter sedan sömlöst.

---

## 1. Inventering (main @ 913a77d)

### 1.1 Vyer → filer → interaktioner → konst-källor → rendering idag

Alla vyer bor i **en** scen (`.varld-stage` i `pages-varld.js`) med fullstora lager (`.varld-lager`).
Kameran (`varld-kamera.js`) sätter inline `transform`/`transform-origin`/`opacity`/`inert` på lagren.
Timing och easing finns i CSS (`.varld-lager` i `styles.css` rad ~3657).

| Vy (nivå-id) | Lager-element | Filer (logik) | Interaktioner | Konst-källor | Rendering idag |
|---|---|---|---|---|---|
| **Hus/ute** (`hus`) | `#ute-lager` | `pages-varld.js`, `varld-tradgard.js`, `varld-navskylt.js` | klick/Enter på `#husgrupp` → rum; klick på `#klasskylt` → by; skylt "Till gården" → gård; hover-scale på husgrupp/skylt; trädgårdssaker (`.garden-item`) drag/välj/🗑️ (pointer capture); Verktyg-meny + paneler (Måla om, Nytt hus, Trädgård, Lås, Kläder) | `art-hus-ute.js` (`husScen`, `husSkalMarkup` + 7 syskon-register `art-hus-*.js`, `art-mystery.js`), `avatars.js` → `art-characters*.js` + `art-wearables*.js`, `art-garden.js` | En stor inline-SVG (viewBox 960×600, övertecknad himmel/gräs `overflow:visible`). Avatar = **HTML i `<foreignObject>`** (`.varld-avatar` → `.avatar-figure` med `af-*`-spans med inline-SVG, CSS-`drop-shadow`). Palett via `var(--hus-*)` på staget. Ambient: `.hus-moln` (drift), `.hus-solstralar` (rotation), `.hus-rok` (puff). Trädgård = absolut-positionerade divar ovanpå. |
| **Rum** (`rum`) | `#rum-lager` (`.room-stage`, fyller hela staget) | `varld-rum.js` (869 r.), `varld-rum-{djur,djurtray,fonster,mat,vaxlare,wear}.js`, `rum-promenad*.js`, `pages-rum-pets.js`, `pages-rum-pet-panel.js`, `varld-foder.js` (dyn.) | drag & drop av möbler/fönster/djur/dörrar (pointer capture, %-positioner), välj/🗑️, klick på djur = klappa, ✏️ namnpanel, Mysterymat-läge (hårkors, klick på golv lägger mat, klick på mat plockar), äter (seek), rum-växlare (dörrar + pill-lista, **ingen kamera**: omritning), "Gå ut"-meny (framsida/gård), kläder, "Mina djur", husdjurspanel (overlay) | `art-room.js` (bakdrop + `.rum-moln`), `art-items.js`, `art-furniture.js`, `art-decor.js`, `art-pets*.js`, `art-pet-sprites.js` (**PNG-delar**, 6 st/djur), emoji (äpplen 🍎) | Container-query-skalat (`cqw`) DOM med inline-SVG + PNG-sprites; promenad-AI skriver `left/top` varje frame (rAF); många CSS-animationer (`pet-wiggle`, `ps-*`, `pet-rygg` …). |
| **By** (`by`) | `#by-lager` | `varld-by.js` (layout), `varld-by-scen.js`, `varld-by-stats.js`, `pages-varld.js` (klick + 🔒-bubbla) | klick/Enter på `.by-tomt` → eget hus / kompishus / 🔒-bubbla; hover/focus-visible: `svg scale(1.06)` + outline; ✨ klass-stats-toggle; skylt "Andra byar" | `varld-by.js` (`byVagarSvg`), `art-by-dekor.js`, `husMini` (art-hus-ute) + avatar i FO | Mark-SVG (`preserveAspectRatio=none`) + 1 div per dekor och per tomt (minihus-SVG med FO-avatar), HTML-namnpiller `.by-namn`, `.by-du`-bricka, 🔒-emoji. **25-husbyn = tyngst** (rotorsaken #374). |
| **Kompishus** (`kompishus`) | `#kompis-lager` | `varld-kompis.js` (egen kamera by↔kompishus) | klick på `#kompis-husgrupp` → `#/elev/klasskamrat` (**sidbyte, ingen kamera**) | `husScen` utan skylt (id-prefix `kompis-`) | Som hus-lagret, kamratens palett på lagret. Ritas vid besök. |
| **Skola/område** (`skola`) | `#skola-lager` | `varld-omrade.js`, `gamemode-visibility.js` (**#391 `visibleVillageClasses`**), `pages-varld.js` | klick/Enter `.omrade-by` → egen by / grannby; skylt-navigering | `byMiniSvg` (generiska silhuetter), `omrade-mark` | DOM-divar + små SVG:er, namnpiller. Filtrerad klasslista (#391) **före** rendering. |
| **Grannby** (`grannby`) | `#grannby-lager` | `varld-grannby.js` (egen kamera skola↔grannby↔grannbyhus), `mountByScen` | klick `.by-tomt` → grannbyhus / 🔒; ✨ grannby-stats | som by | som by (projektion #234, 1 dok/klass) |
| **Grannbyhus** (`grannbyhus`) | `#grannbyhus-lager` | `varld-grannby.js` | klick `#grannbyhus-husgrupp` → klasskamrat (sidbyte) | `kompisHusHtml(…, "grannbyhus")` | som kompishus |
| **Gård** (`gard`) | `#gard-lager` | `varld-gard.js` (dyn., egen kamera hus↔gard↔laggard), `varld-odling.js`, `gard-djur.js` (promenad via `rum-promenad.js`), `varld-foder.js`, `varld-tradgard.js` (gård-scenen, `scen:"gard"`) | klick `#laggard-dorr` → laggård; klick `.odling-slot` → så/skörda-panel; klick `.gard-djur` → foderpanel; trädgård-drag; Verktyg/"Ny lada" | `art-gard.js` (`gardScen`), `art-garden.js` (`cropStageArt`), `art-pets-side.js`, `art-lada-skins.js` | SVG-scen + overlay-divar; ambient `.odling-klar`-puls, `fdjur-gava-gupp`, promenerande djur. |
| **Laggård** (`laggard`) | `#laggard-lager` | `varld-gard.js`, `gard-djur.js`, `varld-lada-skin.js`, `varld-lada-verktyg.js`, `varld-foder.js` | klick djur → foder; Verktyg-panel (placera/mata); "🛖 Ny lada" | `art-gard.js` (`laggardScen(level, skin)`), `art-lada-skins.js` | SVG + promenerande djur |
| **Port → hem** | fixerat overlay (`.port-overgang`, z 3000) | `port-overgang.js` (dyn. från `pages-elev.js`), `art-port.js` / `art-port-majestic.js` (dyn.) | ingen (pointer-events:none), körs vid lyckad inloggning; navigering sker **samtidigt** | port-SVG:n flyttas från login-scenen | CSS: halvor `scaleX(0.07)` 500 ms `cubic-bezier(0.6,0.05,0.55,0.4)`; zoom `scale(6.5)` 900 ms kamera-easing, opacitet 0.4 s `ease` 0.6 s; zoomstart 260 ms; städning 260+900+250 ms |
| **Klasskamratens rum** | egen sida | `pages-klasskamrat.js` | — | — | **Ingen kamera** (sidbyte). Utanför scope, oförändrad. |

### 1.2 Varje kameraövergång (alla går genom `createKamera`)

| # | Övergång | Kamera (fil) | Ytter-lager fokus / zoom | Inre lager | Route |
|---|---|---|---|---|---|
| T1 | skola ↔ by | huvud (`pages-varld.js`) | skola: egna byns plats (från `mountOmradeScen`) / `OMRADE_ZOOM`=5 | `#by-lager` | `#/elev/skolan` ↔ `#/elev/by` |
| T2 | by ↔ hus | huvud | by: egen tomt (`layout.fokusFor`) / `BY_ZOOM`=5 (**5 på main**, 3.5 bara på #374-grenen) | `#ute-lager` | `#/elev/by` ↔ `#/elev/hus` |
| T3 | hus ↔ rum | huvud | hus: 48.5 %/52 % (fönstret) / 6 | `#rum-lager` (annan box: hela staget) | `#/elev/hus` ↔ `#/elev/rum` |
| T4 | by ↔ kompishus | kompis (`varld-kompis.js`) | by: kamratens tomt / 5 | `#kompis-lager` | `#/elev/kompis?id=` |
| T5 | skola ↔ grannby | grannby (`varld-grannby.js`) | skola: klassens plats / 5 | `#grannby-lager` | `#/elev/grannby?id=` |
| T6 | grannby ↔ grannbyhus | grannby | grannby: elevens tomt / 5 | `#grannbyhus-lager` | `#/elev/grannhus?id=&klass=` |
| T7 | hus ↔ gård | gård (`varld-gard.js`) | hus: 50 %/46 % / 5 | `#gard-lager` | `#/elev/gard` |
| T8 | gård ↔ laggård | gård | gård: 82 %/74 % / 5 | `#laggard-lager` | `#/elev/laggard` |
| T9 | rum → gård | huvud T3 ut, **sedan** gård T7 (`ensureHus`) | — | — | "Gå ut → Gå till gården" |
| T10 | port → hus | overlay (`port-overgang.js`) | port: (480,428) i viewBox / 6.5 | världen byggs under | inloggning |
| — | hopp > 1 steg, djuplänkar, `nollstall()`, reduced-motion | `hoppaTill` | — | — | **ingen animation idag → ingen ändring** |

Korszoomens exakta semantik (`apply()` i `varld-kamera.js`), som Pixi-motorn måste efterlikna:
- Aktivt lager: `scale(1)`, `opacity 1`, `transform-origin` = **origoNivåns** fokus (min(gammal, ny)).
- Lagret man klivit in genom (k-1): `scale(zoom_{k-1})` kring sitt eget fokus, `opacity 0`.
- Nästa inre (k+1): `scale(1/zoom_k)` kring det yttre lagrets fokus, `opacity 0`.
- Fokus anges i **% av respektive lagers egen box**. Rum-lagret har en annan box (hela staget) än
  de övriga (#373: centrerad scen-box på desktop >820 px, by/skola förankrade i toppen).
- `transform` 900 ms `cubic-bezier(0.55,0,0.2,1)`; `opacity` 550 ms `ease` med 250 ms fördröjning.
  `onNiva` och promise-resolve sker vid `KAMERA_MS` (900). Grannlager får `varld-dold` vid 960 ms.
- `prefers-reduced-motion` → `hoppaTill` (ingen rörelse). Det gäller oförändrat.

### 1.3 Tvärgående saker som måste bestå
- **Overlay-UI** (`.varld-ui`, z 12–16): titel, ut-knapp/meny, Verktyg-meny, paneler, husdjurspanel,
  klass-stats-toggles, nav-skyltar. Ligger **ovanpå** scenen och berörs inte.
- **Tangentbord/fokus/ARIA:** `role=button`/`tabindex` på tomter/hus/skyltar, Enter/Space,
  Esc-stängning, `inert` på icke-aktiva lager, `aria-expanded`. Allt ligger i DOM och berörs inte.
- **Firestore:** byns data laddas lat (`laddaBy`), skolan läser bara klassdokument, grannby 1
  projektion/klass. **Pixi-vägen får aldrig orsaka en läsning.** Den förvärmer bara det som redan står i DOM.
- **#391:** `visibleVillageClasses(allClasses, meId)` filtrerar *innan* `mountOmradeScen`/grannby.
  Speglingen läser den redan filtrerade DOM:en. Dolda byar kan alltså aldrig dyka upp i en textur.
- **Bootgrafen** (BFS från `src/app.js`, 133 filer): alla `varld-*.js` utom `varld-gard.js` (+ dess
  delträd), `varld-foder.js`, `port-overgang.js`, `art-port-majestic.js` är **statiska**. Alla nya
  filer måste nås via `import()`.

---

## 2. Arkitektur

### 2.1 Grundval: "Pixi som rörelse-renderare" (spegel-arkitekturen)

```
            VILA                         RÖRELSE (≈ 900 ms)                    VILA
  DOM-lager synliga, interaktiva  →  DOM-lager vilar (opacity 0, pausade)  →  DOM synlig igen (slutläget)
  Pixi-canvas tom, under lagren      Pixi-worker spelar korszoomen            canvas töms efter 2 frames
        ▲ förvärmning i idle:            från förbyggda texturer
          spegla lager → SVG → textur-pyramid
```

**Varför inte Pixi även i vila (avvisat alternativ):** då måste drag & drop (rum, trädgård, dörrar,
fönster), pointer capture, hover-transitions, `:focus-visible`-ringar, PNG-spritedjurens ~15
CSS-animationer, promenad-AI, mat-läget, bubblor och hela ARIA-trädet antingen skrivas om i Pixi
eller dubbelunderhållas som osynliga DOM-knappar som synkas med kameran. Det ger stor regressionsrisk
i "allt annat EXAKT som idag" och ingen vinst, eftersom vilan inte laggar (rotorsaken fdcb503e gäller
bara om-rastrering under zoom). Hit-testing-frågan från issuen avgörs därmed så här: **de riktiga
DOM-noderna är hit-targets.** Det finns inga duplicerade knappar och ingen spegling av a11y-trädet.

**Varför Pixi i en Worker (OffscreenCanvas):** en rAF-driven ticker på main-tråden fryser vid long
tasks (spikens invändning, 845fd6aa). Workern har en egen rAF och är oberoende av main-tråden, ungefär
som en kompositor-animation. **PoC-mätning:** zoom 1→3.5 med och utan en 400 ms long task på
main-tråden gav samma frame-profil (maxDt 50 ms i SwiftShader i båda fallen, ingen 400 ms-lucka).

### 2.2 PoC-resultat som låser gränssnitten (`preview-pixi-poc-397.html`)

| Fråga | Resultat (desk, SwiftShader, dpr 1) |
|---|---|
| Kan ute-scenen inkl. FO-avatar (keps + halsduk), `var(--hus-*)` och skyltens Baloo-text speglas till SVG **utan** foreignObject? | **Ja.** Visuellt identisk med DOM (skärmdump), se `speglaLager()` |
| Taint? | **Nej** (`getImageData` OK, WebGL-upload OK). Blob-URL + inga externa resurser. |
| Skärpa vid zoom 3.5 | Pyramid-nivån (käll-rektangel ur EN avkodad bild) är **lika skarp** som DOM `scale(3.5)` |
| Kostnad | spegla ~10 ms, avkoda ~11 ms (varmt; kallt 280/130 ms inkl. font-hämtning), **2–7 ms per skärmstor nivå** via käll-rektangel (beskuren viewBox: 20–25 ms, avkodar om). → **avkoda en gång, skär nivåer ur bilden** |
| Pixi v8 i worker | Fungerar med **`dist/webworker.min.mjs`** (main-bundlen saknar `WebWorkerAdapter`), WebGL, `MAX_TEXTURE_SIZE` 8192 i desk |
| Main-thread long task 400 ms under zoom | **Ingen påverkan** på worker-zoomen |
| Emoji i SVG-som-bild | Desk saknar färg-emojifont helt (även canvas2d). Inte avgörbart här. Samma systemfont används som i DOM/canvas, så det verifieras på Chromebook i G1 (fallback: emoji som Pixi-`Text`) |

### 2.3 Moduler och gränssnitt (signaturer är bindande för fan-out)

Alla nya moduler nås **bara** via `import()`. Varje modul ska vara under 400 rader.

#### (a) Renderar-kärna — `src/varld-render.js` (main) + `src/varld-render-worker.js` + `src/varld-render-anim.js`

```js
// varld-render.js – värd på main-tråden (lat, singel)
/** Startar worker + Pixi första gången (idempotent). null = Pixi-vägen ej tillgänglig. */
export async function ensureRenderare(): Promise<Renderare|null>;
/** Snabb synkron kapabilitetskoll (flaggor, OffscreenCanvas, Worker{type:module}, reduced-motion). */
export function pixiMojlig(): boolean;

interface Renderare {
  /** Kopplar en <canvas> (transferControlToOffscreen) till en Pixi-yta i workern. */
  skapaYta(canvas: HTMLCanvasElement, opt: { dpr:number, w:number, h:number }): Yta;
  readonly dod: boolean;            // context lost / worker-krasch → alltid CSS-väg
  onDod(cb: () => void): void;
}
interface Yta {
  id: number;
  resize(w:number, h:number, dpr:number): void;
  /** Bygg/ersätt lagrets scengraf i workern. Bitmaps transfereras (neutreras på main). */
  satLager(lagerId: string, scen: LagerScen): Promise<void>;
  /** Rita vila-läget (exakt nuvarande DOM-bild) och svara när framen är presenterad. */
  visaVila(state: KameraState): Promise<void>;
  /** Spela en korszoom. Resolvar när sista framen är ritad. */
  spela(anim: KameraAnim): Promise<{ frames: number[] }>;
  rensa(): void;                    // töm canvas (efter DOM-återvisning)
  slappLager(lagerId: string): void;// destroy texturer + bitmap.close()
}
```

```js
// varld-render-anim.js – REN matte (ingen DOM, ingen Pixi) → node --test-bar
export const KAMERA_TRANSFORM = { ms: 900, ease: [0.55, 0, 0.2, 1] };
export const KAMERA_OPACITY  = { ms: 550, delay: 250, ease: [0.25, 0.1, 0.25, 1] }; // CSS "ease"
export function cubicBezier(x1, y1, x2, y2): (t:number) => number;
/** Exakt varld-kamera.apply()-logik som data: lagrens {scale, originPx, opacity} vid nivå k. */
export function lagerState(nivaer: NivaGeo[], k: number, origoNiva: number): LagerState[];
/** Interpolerat tillstånd vid tid t (ms) mellan två lagerState (CSS-semantik, transform kring origin). */
export function interpolera(fran: LagerState[], till: LagerState[], tMs: number): LagerState[];
// NivaGeo = { id, box:{x,y,w,h} (stage-px), fokus:{x,y} (% av egen box), zoom }
```

**Stage-px = oscrollat stage (F7 #433).** `.varld-stage` är `overflow:hidden` men ändå en scroll-container: fokus på
ett delvis klippt element eller `scrollIntoView` kan scrolla den. Lagren och canvasen (absolut i staget) flyttas då med
−scroll. All geometri mäts därför via `TX.stageRam(stage)`, som nollar stagets egen scroll först, och en scroll-vakt
i `koppla()` nollar den direkt (scroll-händelsen kommer före paint) när Pixi kan spela. `pp:pixi:av`/reduced-motion
rör den inte. Dokumentets scroll påverkar ingenting: allt mäts i viewport-px i samma ögonblick.

Worker-protokoll (meddelanden): `init{canvas,w,h,dpr}` → `redo{maxTex}` | `fel{…}`;
`satLager{yta,lagerId,scen}`; `vila{yta,state}` → `visar{yta}` (efter workerns rAF-commit);
`spela{yta,anim}` → `klar{yta,frames}`; `rensa{yta}`; `slapp{yta,lagerId}`; `kontext{forlorad|aterstalld}`.
Pixi laddas i workern från **`vendor/pixi-8.22.0/webworker.min.mjs`** (868 kB, 250 kB gzip, MIT).
Ingen fil i bootgrafen och bara workern läser den. En 404 under Pages-deployfönstret ger `fel`, och då används CSS-vägen.

**Livscykel/resize/DPR/context-loss:** en yta per scen (stage-canvas) och en för port-overlayt.
`ResizeObserver` på staget → `resize`. **Äkta resize** (viewport eller dpr ändrad: rotation, fönster, zoom) →
avbryt + alla pyramider ogiltigförklaras; ombyggnad sker lat. **Nivåns egen höjd** (F8 #434, mobil: rummet
580 → 452 px när `data-niva="rum"` sätts vid landningen; samma viewport + dpr) → bara ytan byter storlek, inga
pyramider kastas (rollnyckeln kodar box, vy och dpr, så varje pyramid spelas bara i sin geometri). En rörelse som
spelar i den gamla storleken landar redan i `data-niva`-mutationen, före paint (DOM:en står i slutläget). Se
`varld-motor-resize.js`.
`webglcontextlost` i workern → `kontext{forlorad}` → `Renderare.dod = true` → CSS-väg tills
`restored`. Pixi laddar då upp `ImageSource`-resurserna (ImageBitmap) igen. Fallback-stege:
`pp:pixi:av` → reduced-motion → saknad OffscreenCanvas/module-worker/WebGL → worker-fel → textur
inte klar inom `VANTA_MAX_MS` → **dagens CSS-övergång**. Ingen main-thread-Pixi-variant byggs
(mindre testyta, och de som saknar worker-WebGL får dagens beteende).

Flaggor (localStorage, try/catch): `pp:pixi:av` (A/B, allt CSS), `pp:pixi:tvinga` (ignorera
budget/heuristik), `pp:pixi:debug` (HUD med workerns frame-dt per övergång + texturbudget),
`pp:pixi:frys` (håll canvasen synlig i vila efter en övergång → jämför Pixi mot DOM med skärmdump).

#### (b) Spegling (DOM → SVG utan foreignObject) — `src/varld-spegel.js` + `src/varld-spegel-html.js` + `src/varld-spegel-font.js`

```js
// varld-spegel.js
/**
 * Spegla ett lager I VILA (scale(1)) till EN fristående SVG-sträng i lagrets px.
 * fangst = stagets synliga yta uttryckt i lagrets px (#373: kan vara negativ).
 */
export async function speglaLager(lagerEl: HTMLElement, stageEl: HTMLElement, profil: Profil): Promise<Spegel>;
/** Spegla en enskild nod (ambient-sprite, fokus-överlägg) i dess aktuella, frysta läge. */
export async function speglaNod(nod: Element, lagerEl: HTMLElement): Promise<NodSpegel>;

interface Spegel { svg: string; w: number; h: number; ox: number; oy: number;  // fångstyta i lager-px
                   nyckel: string;                                          // innehålls-hash (cache)
                   ambient: Element[]; }                                    // utelämnade, levande noder
interface NodSpegel { svg: string; rect: {x,y,w,h}; matrix: DOMMatrix; opacity: number; nyckel: string; }
```

Regler (generiska, gäller alla scener):
1. `<svg>`-noder klonas. `var(--…)` i `fill/stroke/stop-color/style` löses mot originalnodens
   computed style (palett per tomt/lager följer med).
2. `<foreignObject>` ersätts in-place med `<g transform="inv(CTM)">` och nästlade `<svg>` för varje
   inbäddad svg-del, mätta med `getBoundingClientRect` i lager-px (avatarens `af-*`-ordning bevaras,
   rygg före bas). Detta är verifierat i PoC.
3. CSS-`filter` (`drop-shadow`, `grayscale`, `brightness`, `saturate`) → SVG-`<filter>` (t.ex. låsta hus `.by-tomt.last > svg`).
4. HTML-text (`.by-namn`, `.by-du`, `.omrade-by-namn`, ri-etiketter, djur-namnskyltar): bakgrund,
   border, border-radius och box-shadow → `<rect>`/filter. Text → `<text>` med computed
   font/vikt/storlek/färg, baslinje från `canvas.measureText`-ascent, ellipsis via mätning
   (`varld-spegel-html.js`). Emoji → `<text>` (systemfont, se G1).
5. `<img>` (PNG-spritedjur) → `<image href="data:…">` (data-URL-cache per URL, eftersom SVG-som-bild
   inte får ladda externt).
6. Webfonten (Baloo 2, 400–800, latin + latin-ext) bäddas in som data-URL-`@font-face` en gång
   (`varld-spegel-font.js`, cache i minnet).
7. XML-kommentarer rensas (#389-buggen: `--` i kommentar ger ogiltig XML). `transform`/`opacity` från
   CSS (hover-scale, `transform: translate(-50%,-50%)` på tomter, rotation på `.by-du`) bakas in.
8. Profilens `ambient`-noder utelämnas ur bas-speglingen och `ignorera`-noder (bubblor,
   paneler) ritas inte.

#### (c) Textur-pipeline + cache + GPU-budget — `src/varld-textur.js` + `src/varld-textur-budget.js`

```js
// varld-textur.js
/** Avkodar spegeln EN gång (Blob-URL → Image.decode) och håller bilden i cachen. */
export async function avkodaSpegel(s: Spegel): Promise<AvkodadSpegel>;
/**
 * Pyramid för EN övergångsroll: nivåer z i geometriska steg (×STEG) mellan zMin och zMax,
 * var och en = regionen som syns i scale(z) kring originPx, rastrerad i stage-px × dpr × upplösning(z),
 * tegelsatt i ≤ TEGEL px. Streamas grovast → finast via idle-kön.
 */
export function byggPyramid(a: AvkodadSpegel, roll: { originPx:{x,y}, zMin:number, zMax:number },
                            prio: "idle"|"nu"): PyramidJobb;
interface PyramidJobb { minimumKlart: Promise<Niva[]>; allt: Promise<Niva[]>; avbryt(): void; }
interface Niva { z: number; region:{x,y,w,h} /*lager-px*/; tegel: {bmp: ImageBitmap, x,y,w,h}[]; bytes: number; }
/** Idle-kö: ett tegel per uppgift (≤ ~8 ms), requestIdleCallback + timeout. */
export function koa(fn: () => Promise<void>, prio: "idle"|"nu"): Promise<void>;
```

```js
// varld-textur-budget.js – ren logik, node-testbar
export function enhetsKlass(nav, maxTex): "svag" | "normal";   // deviceMemory/hardwareConcurrency/maxTex
export function budget(klass): { maxBytes:number, dprTak:number, steg:number, tegel:number,
                                 under1Upplosning:number, maxPar:number };
export function nivaer(zMin, zMax, steg): number[];             // t.ex. 0.2…1…5
export class TexturLRU { lagg(nyckel, bytes, slapp); rör(nyckel); summa(): number; }
```

- **Skärpa vid alla zoomnivåer:** pyramidens nivåer staplas grovast → finast (bekräftat i PoC). Den
  finaste nivån som täcker en punkt ligger överst, så förstoringen är aldrig större än `STEG` (1.5)
  enhets-px. Nivåer med z<1 behövs för det inkommande lagret, som syns utanför staget när det står
  nedkrympt (övertecknad himmel/gräs). Mipmaps (`autoGenerateMipmaps`) ger nedskalning utan flimmer.
- **Per övergångsroll:** ytterlagret behöver z ∈ [1, zoom] kring sitt fokus och innerlagret z ∈
  [1/zoom, 1] kring ytterlagrets fokus. Nivå 1 delas. En pyramid är giltig bara för exakt det fokuset.
- **Förvärmning:** efter landning på en nivå bygger motorn (idle) pyramider för nivåns grann-
  övergångar, högst `maxPar` stycken. Dynamiska mål (kamratens tomt, en klass i skolan) värms vid
  `pointerenter`/`focusin` på målet. Målet bär `data-fokus-x/y` (satt av scenens render-fil) så att
  fokus blir *exakt* kamerans. Grovaste nivåerna först. Finare nivåer kan strömmas in mitt i rörelsen
  (bezier-kurvan står nästan still de första ~300 ms).
- **Invalidering:** `MutationObserver` per lager (utom inuti ambient-noder) + staget `style`
  (palett) → lagret markeras smutsigt → ny spegling i idle (debounce 300 ms). Äkta resize → allt ogiltigt;
  nivåns egen stage-höjd (F8) → inget (nya roller får nya nycklar).
- **Eviction/destroy:** LRU på "senast använd övergång". Vid eviction: `slapp` i workern
  (`texture.destroy(true)`) + `bitmap.close()`.

#### (d) Avatar/text/emoji-lager

Inget separat Pixi-lager behövs: avatarens klädlager, namnskyltar, brickor och emoji **speglas till
SVG** (regel 2–5 ovan) och rastreras av webbläsarens egen SVG-motor, med samma font (inbäddad) och
samma färger. Utseendet blir därför identiskt med DOM. Det verifierades för avatar + skylt i PoC:n. Pixi
`Text` används bara som reserv för emoji om G1 visar att Chromebookens SVG-bild saknar färg-emoji.

#### (e) Interaktion / hit-test / tillgänglighet

- **I vila:** de riktiga DOM-noderna (ingen förändring). Inga osynliga dubblettknappar.
- **Under rörelsen** (≈ 900 ms + handoff ~2 frames): staget får `.varld-pixi-spelar`, som ger
  `pointer-events:none` på `.varld-lager` (overlay-UI:t är fortsatt klickbart). Idag är de
  icke-aktiva lagren redan `inert`. Skillnaden är att man inte kan klicka på det *osynliga* nya
  lagret mitt i rörelsen.
- **Fokus/ARIA/`inert`:** sätts av kameran precis som idag (`apply()` körs oförändrad, med
  `varld-utan-anim` under rörelsen).
- `prefers-reduced-motion`: ingen Pixi alls (kameran hoppar som idag).

#### (f) Kamera/zoom — `src/varld-motor.js` + `src/varld-vila.js` + hook i `src/varld-kamera.js`

```js
// varld-kamera.js (befintlig, statisk bootfil) – ENDA ändringen: en injicerbar motor
export function setRorelseMotor(m: RorelseMotor|null): void;   // ny export, ingen ny import
// i gaTill(): om motor?.kanSpela(spec) → motor.spela(spec, () => apply(...)) annars CSS som idag
interface RorelseMotor {
  registrera(nivaer: Niva[]): void;          // anropas av createKamera (alla 4 kameror)
  kanSpela(spec: Overgang): boolean;         // synkron: flaggor + minimumtexturer klara
  spela(spec: Overgang, tillampaDom: () => void): Promise<void>; // resolvar vid KAMERA_MS
}
// Overgang = { yttre: Niva, inre: Niva, riktning: "in"|"ut", stage: HTMLElement }
```

```js
// varld-motor.js – orkestrering på main (dyn. laddad av pages-varld.js i idle efter första render)
export async function installeraMotor(stage: HTMLElement): Promise<void>; // ensureRenderare + setRorelseMotor + canvas
// varld-vila.js – "vilande DOM" (#374-lärdomarna, portade)
export function vila(lager: HTMLElement[]): () => void;  // WAAPI pause() på getAnimations({subtree})
                                                        // + .varld-pixi-vilar (promenad sover via closest)
```

**Handoff (bindande sekvens):**
1. `kanSpela` kräver nivå 1 + grovaste nivån för båda lagren. Annars väntar motorn högst
   `VANTA_MAX_MS = 250` ms (streamar). Om det inte räcker spelas CSS-vägen.
2. `vila()` fryser ambient (WAAPI-paus). Läs ambient-nodernas pose och fokus-överlägg (hovrad eller
   fokuserad nod i profilens `objekt`, t.ex. tomten man klickar på med `scale(1.06)`) → små `speglaNod`-sprites.
3. `yta.visaVila(state)`: workern ritar exakt nuvarande bild och svarar `visar` efter sin commit.
   Canvasen ligger **under** DOM-lagren, så inget syns ännu.
4. På `visar`: staget får `.varld-pixi-spelar` (DOM-lagren `opacity:0 !important`: kompositor-billigt,
   ingen stil-recalc-storm som `.varld-zoomar *`), kameran kör `apply()` direkt till slutläget med
   `varld-utan-anim` (DOM står redo, osynligt) och `yta.spela(anim)` startar.
5. Workern spelar 900 ms med `varld-render-anim`. `onNiva`/promise vid `KAMERA_MS` som idag.
6. `klar` → ta bort `.varld-pixi-spelar` → DOM syns **ovanpå** canvasen i slutläget (identisk bild,
   Chromium aktiverar inte förrän rastret är klart). `vila` släpps (WAAPI `play`, promenaden vaknar).
   Efter 2 rAF + 100 ms → `yta.rensa()`.

Port→hem (T10) använder samma kärna med en egen yta på ett fixerat canvas-overlay. Grindhalvorna
är två ambient-sprites med `scaleX`-animation (500 ms `cubic-bezier(0.6,0.05,0.55,0.4)`) och zoomen
`scale(6.5)` med kamera-easing och opacitet 400 ms `ease` 600 ms. Världen byggs samtidigt på main.
Det är just där workern gör störst nytta.

#### (g) HTML-paneler/overlays ovanpå canvasen

Ordningen i `.varld-stage`: `<canvas class="varld-pixi">` **först** (z auto, under), sedan lagren
och sist `.varld-ui` (z 12–16) med paneler, menyer och husdjurspanel. Canvasen är
`pointer-events:none` och transparent, och stagets bakgrund (`#bde3f5` eller `#a8da8f` per nivå)
syns igenom som idag. Inga paneler flyttas.

### 2.4 Profiler (per scen — det enda scen-specifika i Pixi-vägen)

```js
// src/varld-profil-<scen>.js – laddas via import(`./varld-profil-${lager.dataset.spegelProfil}.js`)
export default {
  id: "by",
  ambient: [".hus-moln", ".hus-solstralar", ".hus-rok"],   // levande noder: egna sprites, pose vid handoff
  objekt: ".by-tomt",                                       // kandidater för fokus-överlägg (hover/focus)
  neutralisera: null,                                       // F6 #432: hover/fokus BAKAS IN (hus: husgrupp, skylt);
                                                            // idle speglar dem i vila-läge, nyckeln bär tillståndet
  ignorera: ".by-last-bubbla",                              // ritas aldrig
  malSelektor: ".by-tomt[data-fokus-x]",                    // förvärm fokus-pyramid vid pointerenter/focusin
  fangst: "stage",                                          // "stage" (övertecknat) | "lager"
};
```

Lagren får `data-spegel-profil` i `pages-varld.js`-markupen (görs en gång i F4):
`skola`/`grannby` → `skola`/`by`, `by` → `by`, `ute`/`kompis`/`grannbyhus` → `hus`, `rum` → `rum`,
`gard`/`laggard` → `gard`. Port-ytan → `port`. Saknas en profil används standardprofilen (allt statiskt).

---

## 3. Återanvändning vs omskrivning (per fil)

| Fil | Beslut | Kommentar |
|---|---|---|
| `art-*.js` (alla) | **Orörda** | SVG-källan. Speglas från DOM:en de redan ritat. |
| `avatars.js`, `art-characters*.js`, `art-wearables*.js` | **Orörda** | FO-avataren speglas (regel 2). |
| `varld-rum*.js`, `pages-rum-pets.js`, `pages-rum-pet-panel.js`, `varld-foder.js`, `varld-odling.js`, `varld-lada-*.js`, `varld-tradgard.js`, `gard-djur.js`, `varld-by-stats.js`, `varld-navskylt.js`, `varld-by.js`, `room-palettes.js`, `data*.js`, `farm-core.js` | **Orörda** | Spel-logik, data, paneler, drag & drop, Firestore. |
| `pages-varld.js` (1063 r., redan över taket, lyft till leaden) | **Adapteras minimalt (F4)** | `data-spegel-profil` på lagren, `<canvas class="varld-pixi">` först i staget och idle-`import("./varld-motor.js")`. ~12 rader. Inga andra items rör filen. |
| `varld-kamera.js` (statisk) | **Adapteras (F4)** | `setRorelseMotor` + gren i `gaTill` + `registrera` i `createKamera`. **Ingen ny import.** CSS-vägen oförändrad. |
| `rum-promenad.js` | **Adapteras (F4)** | Sover när `node.closest(".varld-pixi-vilar")` (#374-mönstret, ingen `checkVisibility`). Gäller rum och gård. |
| `styles.css` | **Adapteras (F4)** | Ett avgränsat block: `.varld-pixi` (canvas), `.varld-pixi-spelar .varld-lager`, `.varld-pixi-vilar`. Scen-items rör **inte** CSS. |
| `varld-by-scen.js` | **Adapteras (S2)** | `data-fokus-x/y` på `.by-tomt` (= `layout.fokusFor`). |
| `varld-omrade.js` | **Adapteras (S3)** | `data-fokus-x/y` på `.omrade-by`. #391-filtret orört. |
| `varld-kompis.js`, `varld-grannby.js` | **Adapteras (S2 resp. S3)** | Förrendera kamratens/elevens exteriör i det dolda lagret vid `pointerenter` så att pyramiden hinner byggas. Ingen ny Firestore-läsning: datan finns redan i `laddaBy`/`laddaGrannbyData`. |
| `varld-gard.js` | **Adapteras vid behov (S5)** | Ev. `data-fokus` på laggårdsdörren. |
| `port-overgang.js`, `pages-elev.js` | **Adapteras (S6)** | Pixi-väg med CSS-fallback, förladdning av renderaren när login-sidan är i idle. |
| `varld-render*.js`, `varld-spegel*.js`, `varld-textur*.js`, `varld-motor.js`, `varld-vila.js`, `varld-profil-*.js`, `vendor/pixi-8.22.0/*` | **Nya** | Alla dynamiska. |
| `pages-klasskamrat.js` | **Orörd** | Sidbyte, ingen kamera. |

---

## 4. Sub-issues (parallell-säker uppdelning)

**Gemensamt för ALLA items:** jobba på egen gren från epic-grenen. Merga eller pusha **aldrig** till main.
Nya filer bara via `import()` (verifiera med bootgraf-BFS från `src/app.js`: antalet statiska filer
ska vara **oförändrat 133**). Moduler under 400 rader. Firestore-läsningar ska vara oförändrade
(räkna i Network-fliken eller med stubbar). `prefers-reduced-motion` ska vara oförändrat. `pp:pixi:av`
ska ge exakt dagens beteende. Desk-browsern är SwiftShader, så **mjukhet kan inte bevisas där**.
Acceptansen i desk är funktionell (övergången spelas via Pixi, `data-pixi-spel` spårbart, ingen
pop vid handoff i skärmdump, alla klick fungerar efteråt). Jämnheten bedöms av Elias i previewn på
riktig GPU med `pp:pixi:debug`-HUD:en. Testa mot stub-preview där det går. Riktiga appen (elev1)
används bara i I1, med minimala skrivningar.

### Beroendegraf

```
F1 ──┬─> F2 ──┐
     └─> F3 ──┴─> F4 ──┬─> S1 hus ───────────┐
                       ├─> S2 by+kompis ─────┤
                       ├─> S3 skola+grannby ─┤
                       ├─> S4 rum ───────────┼─> I1 integration + helhetsklick
                       ├─> S5 gård+laggård ──┤
                       ├─> S6 port→hem ──────┤
                       └─> G1 GPU/Chromebook ┘
```
**Kritisk väg:** F1 → F2 → F4 → S4 → I1 (S4 är den största scenen). F2 ∥ F3 går, eftersom
gränssnittet `Spegel` är fryst i §2.3 och PoC:ns `speglaLager` kan stå i för F2 i F3:s tester.

---

### F1 — Renderar-kärna: Pixi i worker, transport, fallback, flaggor
- **Mål:** `ensureRenderare()` startar en modul-worker med Pixi v8 (vendorad) på en OffscreenCanvas.
  Protokollet i §2.3a finns, kamera-matten är exakt och fallback-stegen fungerar.
- **Äger (nya):** `vendor/pixi-8.22.0/webworker.min.mjs` (+ `LICENSE`), `src/varld-render.js`,
  `src/varld-render-worker.js`, `src/varld-render-anim.js`, `test/varld-render-anim.test.js`,
  `preview-pixi-karna.html` (+ ev. `preview/pixi-karna/`).
- **Läser:** `varld-kamera.js`, `styles.css` (timing), PoC-filerna.
- **blockedBy:** —
- **Acceptans:**
  - `node --test test/varld-render-anim.test.js`: `cubicBezier` stämmer mot CSS-referensvärden
    (±0.002). `lagerState` ger samma scale/origin/opacity som `apply()` för alla nivåkombinationer i
    T1–T8, inklusive rum-lagrets avvikande box. `interpolera` följer opacitetens delay 250 + 550 `ease`.
  - Preview: canvas → worker → `redo{maxTex}`. `satLager` + `spela` av en testpyramid. `kontext`-
    förlust simulerad med `WEBGL_lose_context` → `dod=true` → `ensureRenderare` ger CSS-väg. 404 på
    vendor-filen (byt namn tillfälligt) → `null`, inget kastat fel.
  - Flaggorna `pp:pixi:av|tvinga|debug|frys` läses med try/catch.
  - BFS: 133 statiska filer, oförändrat.
- **Klick-test (desk):** öppna previewn → klicka "Spela" 3×, och "Spela + 400 ms long task" →
  `evaluate_script` läser `window.__ppPixi.senaste.frames` (ingen lucka ≥ 300 ms) → "Döda kontext"
  → "Spela" ska ge `vag:"css"`.
- **Tier:** hard.

### F2 — Spegling: DOM-lager → SVG utan foreignObject
- **Mål:** `speglaLager`/`speglaNod` enligt regel 1–8 (§2.3b), generiskt för alla scener.
- **Äger (nya):** `src/varld-spegel.js`, `src/varld-spegel-html.js`, `src/varld-spegel-font.js`,
  `preview-varld-spegel.html` (sida som monterar riktiga `husScen`, `mountByScen` (25 stub-elever),
  `mountOmradeScen`, ett rum med möbler + PNG-djur och `gardScen` sida vid sida: DOM mot speglad bild).
- **Läser:** alla `art-*.js`, `avatars.js`, `varld-by-scen.js`, `varld-omrade.js`, `styles.css`.
- **blockedBy:** F1 (bara för preview-infrastruktur och worker-visning, kan börja direkt på ren SVG)
- **Acceptans:**
  - Ingen `foreignObject` och ingen extern URL i utdata. `getImageData` på rastret kastar inte (ingen taint).
  - Visuell jämförelse per scen (skärmdump DOM mot speglad bild i samma storlek): avatar + kläder
    (alla slots inkl. rygg och `af-anchor-mun`), namnpiller, "Du!"-bricka (roterad), 🔒, låst hus
    (grayscale-filter), palettfärger, skyltens Baloo-text, PNG-spritedjur.
  - `nyckel` ändras när innehållet ändras (palett, klädsel, husskal) och är stabil annars.
  - Kostnad loggas: 25-husbyn ska speglas på under 60 ms i desk.
- **Klick-test (desk):** previewn → "Spegla alla" → `evaluate_script` returnerar
  `{scen, ms, kB, taint:false, fo:0}` per scen → byt palett/klädsel i previewn → ny `nyckel`.
- **Tier:** hard.

### F3 — Textur-pipeline: pyramid, tegel, cache, budget, idle-kö
- **Mål:** `avkodaSpegel`, `byggPyramid` (streamande, tegelsatt), `koa`, `TexturLRU`, `budget()`
  enligt §2.3c och §6.
- **Äger (nya):** `src/varld-textur.js`, `src/varld-textur-budget.js`, `test/varld-textur-budget.test.js`,
  `preview-varld-textur.html`.
- **Läser:** `varld-render.js` (F1), PoC `spegel.js` (ersättare för F2 under utvecklingen).
- **blockedBy:** F1
- **Acceptans:**
  - Node-test: `nivaer(0.2, 5, 1.5)` korrekt. Bytes-räkning inkl. mip (×4/3). LRU-eviction i
    budgetordning. `enhetsKlass` för representativa `navigator`-värden.
  - Preview: hus-pyramid för T3 (zoom 6) och by-pyramid för T2 (zoom 5): ingen nivå är förstorad mer
    än `STEG`. Skärmdump vid z = 1, 2, 3.5, 5, 6 jämfört med DOM `scale(z)`: lika skarp.
  - Inget idle-jobb över 16 ms (Long Tasks-observer under bygget). `minimumKlart` före `allt`.
  - `slappLager` ger `bitmap.close()`, och workerns texturräknare sjunker.
- **Klick-test (desk):** previewn → "Bygg T3" → "Visa z=3.5" / "z=6" → `evaluate_script` läser
  `{nivaer, maxForstoring, bytes, langstaJobbMs}` → "Evict" → bytes 0.
- **Tier:** hard.

### F4 — Kamera-motor + handoff + vila + integration i scenen (fundamentets slut)
- **Mål:** `setRorelseMotor` i `varld-kamera.js`, `varld-motor.js` (förvärmning, handoff-sekvensen
  i §2.3f, `data-pixi-spel`-spår på staget: `pixi|css:<orsak>`), `varld-vila.js`, CSS-blocket,
  `pages-varld.js`-kopplingen och **standardprofilen**. Ska fungera end-to-end på T2 (by↔hus) och T3
  (hus↔rum) med standardprofil, så att gränssnitten är bevisade innan scenerna fan-outas.
- **Äger:** `src/varld-motor.js` (ny), `src/varld-vila.js` (ny), `src/varld-profil-standard.js` (ny);
  **ändrar** `src/varld-kamera.js`, `src/pages-varld.js`, `src/rum-promenad.js`, `src/styles.css`
  (ett avgränsat block märkt `/* Pixi-rörelse (#396) */`).
- **Läser:** F1–F3.
- **blockedBy:** F2, F3
- **Acceptans:**
  - Med `pp:pixi:av`: beteendet är **bit-för-bit** dagens (samma inline-stilar, samma timers).
  - Utan flagga: T2 och T3 spelas via Pixi (`data-pixi-spel="pixi"`). `onNiva` och promise vid 900 ms
    (±1 frame). `inert`/`varld-dold` som idag. Alla fyra kamerorna registrerar sig.
  - `pp:pixi:frys`: skärmdump av canvasen i vila efter T2/T3 jämfört med DOM visar ingen synlig skillnad.
  - Ambient pausas och återupptas utan hopp (molnens `currentTime` kontinuerlig). Promenaden står
    still under rörelsen och går sedan vidare.
  - Ingen ny Firestore-läsning: by-pyramiden byggs först när byn redan laddats.
  - `pages-varld.js`-diffen är högst ~15 rader. BFS 133.
- **Klick-test (desk, stub eller elev1):** hus → klasskylten (T2 in) → egen tomt (T2 ut) → huset
  (T3 in) → Gå ut → Framsidan (T3 ut). Efter varje övergång läser `evaluate_script`
  `stage.dataset.pixiSpel`, `stage.dataset.niva`, `document.activeElement`, och klickar igen
  (Verktyg → Måla om → stäng). Upprepa med `pp:pixi:av` (ska ge `css`) och med emulerad reduced-motion
  (direkthopp, ingen Pixi).
- **Tier:** hard.

---

*Scen-items (parallella efter F4). Varje item äger sin profil + de render-filer som listas. Rör
INTE `pages-varld.js`, `varld-kamera.js`, `varld-motor.js`, `styles.css` eller andras profiler.
Behövs en ändring där ska den rapporteras till leaden och samlas i I1.*

### S1 — Hus/ute (+ trädgård, avatar, kompis-/grannbyhus-exteriören)
- **Mål:** profil `hus` som gäller `#ute-lager`, `#kompis-lager` och `#grannbyhus-lager`: ambient
  (`.hus-moln`, `.hus-solstralar`, `.hus-rok`), objekt (`#husgrupp`, `#klasskylt`, `.garden-item`),
  fångst `stage` (övertecknat), förvärmning av T3-ut, T2-in (inre roll) och T7-ut.
- **Äger:** `src/varld-profil-hus.js` (ny), `preview-pixi-hus.html` (ny, stubbad `data.js`).
- **Läser:** `art-hus-ute.js`, `varld-tradgard.js`, `avatars.js`.
- **blockedBy:** F4
- **Acceptans:** T2/T3/T7 spelas via Pixi. Inget pop vid start eller slut (skärmdump i `frys`-läge mot
  DOM). Hovrad husgrupp/skylt (scale) fångas i fokus-överlägget. Kläder bytta i rummet syns i nästa
  övergång (invalidering). Palett/husskal-byte syns direkt. Trädgårdssaker som nyss dragits syns.
- **Klick-test:** hus → hovra + klicka huset (T3) → Kläder: ta på krona → Gå ut → Framsidan (T3 ut:
  kronan syns i rörelsen) → Verktyg → Måla om → välj palett → stäng → klasskylten (T2) → egen tomt
  → "Till gården"-skylten (T7) → tillbaka. Verktyg → Trädgård → dra en sak → T3 in/ut.
  `evaluate_script` per steg: `pixiSpel`, `niva`, `profil:"hus"`, `textur.nyckel` ändrad efter palettbyte.
- **Tier:** hard.

### S2 — By + kompishus (T2 yttre roll, T4)
- **Mål:** profil `by` (även `#grannby-lager`): objekt `.by-tomt`, ignorera `.by-last-bubbla`,
  `malSelektor` med `data-fokus-x/y`. Förrendera kamratens exteriör i dolda `#kompis-lager` vid
  `pointerenter`/`focusin` på en kamrats tomt, så att T4:s pyramid är klar vid klick.
- **Äger:** `src/varld-profil-by.js` (ny), ändrar `src/varld-by-scen.js` (`data-fokus-*`) och
  `src/varld-kompis.js` (förrendering), `preview-pixi-by.html` (25-husby med stubbar).
- **Läser:** `varld-by.js`, `art-by-dekor.js`, `pages-varld.js`.
- **blockedBy:** F4 (+ S1:s profil `hus` för innerrollen i T4. **Läser** bara filen. Om S1 inte är klar används standardprofilen, och verifieringen av T4 görs i I1)
- **Acceptans:** 25-husbyn: T2 in/ut och T4 in/ut via Pixi. Hovrad tomt (scale 1.06 + ev. focus-outline)
  utan pop. 🔒-bubbla på låst hus fungerar (ingen kamera). Fokus på tangentbord (Tab till en tomt,
  Enter) ger samma resa. Ingen extra Firestore-läsning vid hover.
- **Klick-test:** by (25 hus) → hovra kamrat → klicka (T4 in) → "Till byn" (T4 ut) → klicka låst
  hus (bubbla, ingen resa) → Tab till egen tomt + Enter (T2 ut) → klasskylten (T2 in) → ✨-stats
  öppna/stäng. Varje steg: `pixiSpel`, `niva`, `document.activeElement`.
- **Tier:** hard.

### S3 — Skola/område + grannby + grannbyhus (T1, T5, T6) + #391
- **Mål:** profil `skola`: `malSelektor` `.omrade-by[data-fokus-x]`. Förvärm egna byns T1 och
  grannbyar vid hover. Grannbyhusets exteriör förrenderas vid hover (som S2).
- **Äger:** `src/varld-profil-skola.js` (ny), ändrar `src/varld-omrade.js` (`data-fokus-*`) och
  `src/varld-grannby.js` (förrendering), `preview-pixi-skola.html` (återanvänd
  `preview/by-stubs/data.js`-mönstret med dolda byar).
- **Läser:** `gamemode-visibility.js`, `varld-by-scen.js`, profil `by` (S2), profil `hus` (S1).
- **blockedBy:** F4
- **Acceptans:** T1/T5/T6 via Pixi. **#391:** med `hiddenVillages` satt syns den dolda byn varken i
  DOM eller i någon textur (sök i spegelns SVG efter klass-id/namn → 0 träffar). Djuplänk till dold by
  → skolan som idag. "Andra byar"-skylten bara när `flerByar`.
- **Klick-test:** by → "Andra byar" (T1 ut) → hovra grannklass → klick (T5 in) → hovra elev → klick
  (T6 in) → "Till byn" (T6 ut) → "Till skolan" (T5 ut) → egna byn (T1 in). Med dold by: räkna
  `.omrade-by` och sök i `__ppPixi.senasteSpegel(“skola”).svg`.
- **Tier:** hard.

### S4 — Rummet (T3 inre roll, rum-växlare, husdjur) — största scenen
- **Mål:** profil `rum`: ambient `.room-pet` (PNG-delar → data-URL), `.room-apple`, `.rum-moln`,
  `.gard-djur` (om sådana står i rummet). Objekt `.room-item` (`.selected`-ram), dörrar och
  rumslista. Fångst `lager` (rum-boxen = staget). Invalidering ignorerar promenadens `left/top` (ambient).
- **Äger:** `src/varld-profil-rum.js` (ny), `preview-pixi-rum.html` (stubbat rum med möbler, 3 mystery-
  djur i olika steg, 2 vanliga djur, äpplen, 2 rum).
- **Läser:** `varld-rum*.js`, `rum-promenad.js`, `pages-rum-pets.js`, `art-room.js`, `art-pet-sprites.js`.
- **blockedBy:** F4
- **Acceptans:** T3 ut/in via Pixi med promenerande djur: djuren fryses i aktuell pose och fortsätter
  efteråt utan hopp. Mat-läget avslutas vid nivåbyte (som idag). Drag & drop, klapp, ✏️-namn,
  Mysterymat, rum-växling, dörr-drag och fönster-drag fungerar efter 5 fram-och-tillbaka-resor.
  Rum 2 (annan väggfärg) speglas rätt. Promenadens sparning (60 s-takt) är oförändrad.
- **Klick-test:** rum → dra möbel → klicka djur (klapp) → ✏️ → stäng → Mysterymat → lägg 2 äpplen →
  Esc → Gå ut → Framsidan (T3 ut) → huset (T3 in) → dörr till Rum 2 → Gå ut → huset → dra fönstret. Per
  steg: `pixiSpel`, positioner (`style.left/top`) oförändrade efter resan, `getAnimations().every(a=>a.playState==="running")`.
- **Tier:** hard.

### S5 — Gård + laggård + odling + gårdsdjur (T7 inre roll, T8, T9)
- **Mål:** profil `gard` (gäller `#gard-lager` och `#laggard-lager`): ambient `.gard-djur`,
  `.odling-klar`, gåvo-gupp. Objekt `#laggard-dorr`, `.odling-slot`. T9 (rum→hus→gård) blir två Pixi-resor i följd.
- **Äger:** `src/varld-profil-gard.js` (ny), ev. `src/varld-gard.js` (`data-fokus` på dörren),
  `preview-pixi-gard.html` (stubbad farm med djur i hage och lada, mogna grödor).
- **Läser:** `art-gard.js`, `gard-djur.js`, `varld-odling.js`, `varld-foder.js`, `varld-lada-*.js`.
- **blockedBy:** F4
- **Acceptans:** T7/T8/T9 via Pixi. `varld-gard.js` förblir **dynamisk** (BFS). Lada-skin-byte
  invaliderar laggård-texturen. Foder-, odlings- och verktygspaneler fungerar efteråt.
- **Klick-test:** hus → "Till gården" (T7) → klicka mogen gröda (skörda-panel) → stäng → laggårdsdörren
  (T8) → klicka djur (foder) → stäng → Verktyg → "Ny lada" → byt skin → "Ut till gården" (T8 ut) →
  "Tillbaka till huset" (T7 ut) → huset → Gå ut → Gården (T9).
- **Tier:** hard.

### S6 — Port → hem (T10)
- **Mål:** `startaPortOvergang` spelar via Pixi på en fixerad overlay-canvas: port-SVG:n speglas,
  halvorna är ambient-sprites och tiderna är exakt som CSS:en i §1.1. Renderaren förladdas i idle på
  login-sidan. Är den inte redo vid inloggning används dagens CSS-overlay. Inloggningen får **aldrig**
  vänta på Pixi.
- **Äger:** `src/varld-profil-port.js` (ny), ändrar `src/port-overgang.js` och `src/pages-elev.js`
  (bara idle-förladdningen), `preview-pixi-port.html`.
- **Läser:** `art-port.js`, `art-port-majestic.js`.
- **blockedBy:** F4
- **Acceptans:** inloggning med Pixi-väg: overlayt öppnas, zoomar och tonar ut. Hus-scenen står klar
  under, och overlayt är borta efter ≤ 1410 ms som idag. Med `pp:pixi:av`, reduced-motion eller
  renderare inte redo: dagens beteende. Fel i Pixi-vägen loggas som varning och inloggningen påverkas inte.
- **Klick-test:** login-sidan (vänta idle) → logga in elev1 → `evaluate_script` (initScript som loggar
  `data-pixi-spel` på overlayt) → hus-nivån visas → klasskylten (T2) fungerar. Logga ut → snabb
  inloggning direkt (renderare inte redo) → CSS-väg.
- **Tier:** hard.

### G1 — GPU-minne + Chromebook-budget + verkligt-GPU-protokoll
- **Mål:** kalibrera `varld-textur-budget.js` (enhetsklass, `steg`, `dprTak`, `maxPar`, `tegel`,
  `under1Upplosning`). Workern för texturbokföring i `pp:pixi:debug`-HUD:en. Context-loss-återhämtning
  under och mellan övergångar. Emoji-färgkontroll med Pixi-`Text`-reserv om SVG-bilden saknar
  färgemoji. Mätprotokoll för Elias riktiga dator/Chromebook.
- **Äger:** `src/varld-textur-budget.js` (efter F3 rör ingen annan den), `docs/pixi-gpu-budget-396.md`
  (ny, mätresultat), ev. `src/varld-render-hud.js` (ny, dyn.).
- **Läser:** allt.
- **blockedBy:** F4 (parallellt med S1–S6. Slutmätning görs på I1:s integrerade gren)
- **Acceptans:** budgettak hålls (HUD: summa ≤ `maxBytes` efter 20 slumpade övergångar över alla
  scener). Eviction utan läckor (texturräknare tillbaka till baslinjen efter `slappLager`). Simulerad
  context-loss mitt i en resa → resan avslutas i CSS-läge utan fel, och nästa resa går via Pixi efter
  restore. `MAX_TEXTURE_SIZE` 4096 (tvingad) → tegel ≤ 4096 fungerar.
- **Klick-test:** previewn och appen med `pp:pixi:debug` → 20-resors-skript via `evaluate_script`
  (route-byten) → läs HUD-summa och texturräknare → `WEBGL_lose_context` mitt i T2 → nästa T2.
- **Tier:** hard.

### I1 — Integration + helhetsklicktest (sist)
- **Mål:** merga alla scen-items, lösa ev. önskemål om delade filer (en samlad ändring i
  `pages-varld.js`/`styles.css` om scen-items rapporterat behov), köra **hela övergångsmatrisen** i
  riktiga appen och starta preview för Elias.
- **Äger:** delade filer vid behov (`pages-varld.js`, `styles.css`, `varld-motor.js`),
  `docs/pixi-klicktest-396.md` (protokoll + resultat).
- **blockedBy:** S1, S2, S3, S4, S5, S6, G1
- **Acceptans:** T1–T10 + hopp/djuplänkar + bakåt/framåt-knappar. Alla via Pixi på desk och alla via
  CSS med `pp:pixi:av`. Reduced-motion = direkthopp. BFS 133. Alla nya moduler under 400 rader.
  `node --test` grönt. Ingen ny Firestore-läsning (jämför antal requests per resa med main).
  #391 bevarad. Elias kör previewn på riktig GPU (HUD: frame-dt, droppade frames) och godkänner.
- **Klick-test (helhet, elev1):** inlogg (T10) → huset → rummet (T3) → Gå ut → Gården (T9) →
  laggården (T8) → ut ×2 → klasskylten (T2) → kamrat (T4) → tillbaka → Andra byar (T1) → grannby
  (T5) → elev (T6) → tillbaka ×2 → egen by → eget hus. Därefter webbläsarens bakåt ×5 och framåt ×5,
  djuplänkar `#/elev/rum`, `#/elev/kompis?id=…`, `#/elev/grannhus?…`, `#/elev/laggard`, och en
  gömd flik mitt i en resa. Varje steg loggas med `pixiSpel`, `niva` och fokus.
- **Tier:** hard.

**Antal items: 13** (F1–F4, S1–S6, G1, I1). Max parallellitet efter F4: 7 samtidigt (S1–S6 + G1).

### Fil-ägarskap (kollisionsmatris — en fil, ett item)

| Fil | Ägare |
|---|---|
| `vendor/pixi-8.22.0/*`, `src/varld-render*.js`, `test/varld-render-anim.test.js` | F1 |
| `src/varld-spegel*.js` | F2 |
| `src/varld-textur.js`, `test/varld-textur-budget.test.js` | F3 |
| `src/varld-textur-budget.js` | F3 (skapar) → G1 (kalibrerar, efter F3) |
| `src/varld-motor.js`, `src/varld-vila.js`, `src/varld-profil-standard.js`, `src/varld-kamera.js`, `src/rum-promenad.js`, `src/pages-varld.js`, `src/styles.css` | F4 (sedan bara I1) |
| `src/varld-profil-hus.js` | S1 |
| `src/varld-profil-by.js`, `src/varld-by-scen.js`, `src/varld-kompis.js` | S2 |
| `src/varld-profil-skola.js`, `src/varld-omrade.js`, `src/varld-grannby.js` | S3 |
| `src/varld-profil-rum.js` | S4 |
| `src/varld-profil-gard.js`, `src/varld-gard.js` | S5 |
| `src/varld-profil-port.js`, `src/port-overgang.js`, `src/pages-elev.js` | S6 |
| `src/varld-render-hud.js`, `docs/pixi-gpu-budget-396.md` | G1 |
| `docs/pixi-klicktest-396.md` | I1 |
| `preview-pixi-*.html` | respektive item (unika namn) |

---

## 5. Risker och mitigering

| Risk | Mitigering |
|---|---|
| **Vit sida vid Pages-deploy** (incident 2026-09-10: ny fil i statisk bootgraf + Fastly cachar 404 ~10 min) | Inga nya statiska importer. `varld-kamera.js` får en *setter*, inte en import. Alla nya filer laddas via `import()`/Worker, och 404 ger CSS-väg. BFS-kontroll i varje item (133 filer). Revert:a aldrig på symptom inom 10-min-fönstret. |
| **400-raders-taket** | Kärna, spegel och textur är redan delade i flera filer. `pages-varld.js` (1063) och `varld-rum.js` (869) är redan över taket och rörs bara minimalt (F4) eller inte alls. |
| **Pop vid handoff** (ambient-fas, hover, valda saker) | Ambient fryses med WAAPI och poseras live. Hovrad/fokuserad nod blir fokus-överlägg. Canvasen ligger under DOM:en, och DOM:en göms först när workern presenterat vilo-framen. `pp:pixi:frys` + skärmdump i varje scen-item. **Känd rest:** ett träd *framför* en hovrad tomt kan hamna bakom överlägget i 900 ms (sällsynt, mycket litet). |
| **Texturskärpa vid djup zoom** (zoom 5–6) | Fokus-pyramid med ×1.5-steg (max 1.5 enhets-px förstoring), mipmaps nedåt och nivåer z<1 för inkommande lager. PoC: zoom 3.5 lika skarp som DOM. |
| **Text/emoji ser annorlunda ut** | Text renderas av webbläsarens SVG-motor med inbäddad Baloo 2, alltså samma glyfer. Emoji använder systemfonten som DOM (G1 verifierar på Chromebook, och Pixi-`Text` finns som reserv). |
| **Kall första resa** (byn laddas lat, kamratens hus ritas vid besök) | Förvärmning i idle och vid hover/fokus. Streaming grovast först. `VANTA_MAX_MS` 250, sedan CSS-reserv. Byns *data* förhämtas aldrig, så Firestore är oförändrat. |
| **Main-thread-jank under resan** | Workern är immun (PoC). Main gör bara handoff (~2 frames) och reaktivering. DOM-lagren vilar (WAAPI-paus, promenad sover), vilket är #374-lärdomarna. |
| **Context-loss / GPU-krasch** | `dod` → CSS-väg. Pixi laddar upp `ImageSource` igen vid restore. G1 testar mitt i resan. |
| **GPU-minne på svaga Chromebooks** | Budget per enhetsklass (§6), LRU-eviction, tegel ≤ 2048, `maxPar`, nivåer z<1 i halv upplösning på "svag". G1 kalibrerar. |
| **SwiftShader-desk visar inte GPU-vinsten** (39d62681) | Desk-acceptansen är funktionell. Jämnheten mäts i workern (frame-dt i HUD) på Elias riktiga GPU i preview. |
| **Pixi-versionsdrift / CDN blockerat på skolnät** | Vendorad, pinnad 8.22.0 (MIT) i repot. Bara workern läser filen. |
| **Safari/iPad utan OffscreenCanvas-WebGL** | Kapabilitetskoll, och de får dagens CSS-väg. |
| **Promenad-AI:ns mutationer smutsar ned rummet varje frame** | Invalideringen ignorerar mutationer inuti ambient-noder (profilens `ambient`). |
| **Dubbel sanning (DOM och textur) går isär** | Texturerna är alltid *härledda* ur DOM:en (spegling) och har ingen egen scenmodell. `nyckel`-hash och MutationObserver ger ombyggnad. |
| **Sekretess (#37/#114/#391)** | Speglingen läser bara det som redan ritats i DOM:en. Dolda byar och låsta rum finns inte där, och S3 verifierar det. |

---

## 6. GPU-minnesbudget (utgångsvärden, kalibreras i G1)

Bytes per skärmstor nivå = `W·H·dpr²·4·4/3` (mip). Exempel (stage ≈ viewport):

| Enhet | Nivå | En övergång (ytter 1→5 ×1.5 = 5 nivåer + inre 0.2→0.67 = 4 nivåer) |
|---|---|---|
| Chromebook 1366×768, dpr 1 ("svag": z<1 i ½ upplösning) | 5.6 MB | 5×5.6 + 4×1.4 ≈ **34 MB** |
| Laptop 1920×1080, dpr 1 | 11 MB | ≈ **100 MB** (normal, z<1 full) |
| MacBook 1440×900, dpr 2 | 28 MB | ≈ **250 MB** → med `dprTak 1.5`: 16 MB/nivå → ≈ **140 MB** |

| Parameter | "svag" (deviceMemory ≤ 4 **eller** cores ≤ 4 **eller** maxTex < 8192) | "normal" |
|---|---|---|
| `maxBytes` (alla cachade pyramider) | 72 MB | 256 MB |
| `dprTak` | 1 | 1.5 |
| `steg` | 1.5 | 1.5 |
| `under1Upplosning` | 0.5 | 1 |
| `maxPar` (förvärmda övergångar samtidigt, begränsas också av `maxBytes`) | 1 (+ den som spelas) | 3 |
| `tegel` | 2048 | 2048 |

Eviction: LRU på senast spelad/förvärmd övergång. Den som spelas är låst. Lager som varit dolda
> 30 s släpps (`slappLager`) och byggs om i idle vid behov. ImageBitmaps finns bara i workern
(transfererade), så CPU-kopian försvinner med texturen.

---

## 7. Validering som gjorts i detta item

- `preview-pixi-poc-397.html` + `preview/pixi-poc-397/{spegel,worker}.js`: **avgränsad PoC, ingen
  produktionskod**. Den ligger utanför bootgrafen och importeras av ingen app-fil. Kör `node server.mjs`
  och öppna sidan. Knapparna i ordning: 1 Spegla → 3/4 Zooma Pixi. Resultaten i §2.2.
- Bootgraf-BFS från `src/app.js`: 133 statiska filer (baslinje för alla items).
