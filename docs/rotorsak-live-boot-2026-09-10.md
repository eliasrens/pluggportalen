# Rotorsaksanalys: live-bootkrascherna 2026-09-10 (vit sida / "bara laddar")

**Issue:** #271 · **Berörda deployer:** #263/#264 (krasch 1) och #268 (krasch 2)
**Symptom:** `https://eliasrens.github.io/pluggportalen/` visade bara den statiska
spinnern **"Laddar…"** för evigt (vit sida), trots att `npm test` och lokal
headless-Chrome-verifiering var gröna.

## Rotorsak (bevisad)

**GitHub Pages-utrullningen är inte atomär, och alla svar (även 404) cachas i
CDN/webbläsare.** När en deploy lägger till en **ny fil i den boot-kritiska
statiska ES-modulgrafen** finns ett fönster (upp till ~10 min per klient/edge)
där en klient får en **blandning av gamla och nya moduler – eller en cachad 404
på den nya filen**. Ett enda misslyckat import-steg fäller **hela** modulgrafen:
`src/app.js` exekverar aldrig, ingen felhantering i appen hinner köra, och den
statiska "Laddar…"-spinnern i `index.html` står kvar för evigt.

- **Krasch 1 (#263):** introducerade `src/adventure/compass.js` +
  `src/adventure/grid-scene.js` – nya filer, statiskt importerade via
  `app.js → adventure/index.js → engine.js` (bootgrafen på den tiden).
- **Krasch 2 (#268):** introducerade `src/dom.js` – ny fil, importerad av
  boot-kritiska `ui.js` (`export { el } from "./dom.js"`). #268:s dynamiska
  äventyrs-import skyddade äventyrsgrafen, men flyttade samtidigt in en helt ny
  fil i bootgrafen.

Klient i blandnings-fönstret ⇒ `GET …/src/dom.js` → **404** (edge/origin som
ännu inte sett den nya deployen) ⇒ `ui.js` kan inte länkas ⇒ `app.js`-grafen
faller ⇒ evig "Laddar…".

## Bevis

1. **Hypotes A ("#268 nådde aldrig live") – falsifierad.**
   `gh api repos/…/deployments` + statuses: deployment för `fbf70f9` (#268)
   skapades 2026-09-10 **13:46:31Z** och nådde `success` **13:47:59Z**. #268
   VAR alltså live när användaren såg kraschen (revert #269 deployades först
   15:31Z). Däremot fick revert-försöket #265 (`4f12814`) `startup_failure` +
   **8 st** fastnade deployments 11:15–11:49Z – därför låg det trasiga
   #263/#264-läget kvar live i ~3 timmar (09:34→12:40Z), vilket fick krasch 1
   att SE deterministisk/persistent ut fast den inte var det.
2. **Hypotes C (subpath-bugg) – falsifierad.** `fbf70f9` utcheckad och servad
   under `/pluggportalen/`-subpath lokalt (egen statisk server, samma
   `max-age=600`): appen bootar felfritt, **0 konsollfel** (skärmdump
   `repro-268-subpath-boot.png` i issue-tråden). Grep visar 0 absoluta
   sökvägar (`/src/…`, `url(/…)` osv.) i boot-kedjan – allt är relativt och
   hash-routat.
3. **Hypotes D (skiftläge) – falsifierad.** Subpath-repron servades från
   case-känsligt ext4; samtliga moduler svarade 200.
4. **Krasch 1:s kod är också frisk.** Även `c3390e6` (#264, det läge som låg
   live under krasch 1) bootar felfritt under subpath-repron, 0 konsollfel.
   Kraschen satt alltså inte i koden där heller.
5. **Mekanismen reproducerad (hypotes B – bekräftad).** Samma subpath-server
   med `fbf70f9` men **404 på exakt `src/dom.js`** (= en edge/origin som inte
   sett den nya filen): sidan fastnar för evigt på "Laddar…", enda konsollfelet
   är `Failed to load resource: the server responded with a status of 404` –
   **identiskt med användarens symptom** ("vit sida/bara laddar").
6. **404:or cachas på riktigt.** Verifierat mot live:
   `GET …/src/finns-inte-testfil.js` → `404` med `x-cache: HIT`, `age: 21` –
   Fastly-edgen cachar alltså 404-svar, och modulsvar servas med
   `cache-control: max-age=600`. En klient/edge kan därmed hålla fast vid
   404/gamla moduler i upp till ~10 min efter att origin är korrekt.

## Åtgärder (denna PR)

1. **Kompass + ghost-click återinförda** från `fbf70f9` (`git diff 2a9b249
   fbf70f9`), inklusive den boot-säkra **dynamiska** äventyrs-importen (#267).
   `compass.js`/`grid-scene.js` är fortfarande nya filer, men de ligger nu
   ENDAST i den dynamiskt laddade äventyrsgrafen – en 404 i blandningsfönstret
   ger det vänliga "Äventyret kunde inte laddas"-felet, aldrig vit sida.
2. **Ingen `dom.js`.** `game-questions.js` har i stället en lokal 4-raders
   `el()` (medveten duplicering, motiverad i koden): bootgrafen får **noll nya
   filer** i denna deploy ⇒ inget 404-fönster på bootvägen. `ui.js` är helt
   orörd mot det verifierat fungerande revert-läget.
3. **Bootvakt i `index.html`** (klassiskt icke-modul-skript, kör alltid):
   efter 8 s agerar den bara om BÅDE `window.__PLUGG_BOOTED` saknas (sätts av
   ny `app.js` när routern kör) OCH start-spinnern `#boot-spinner` står kvar i
   DOM:en. Markören försvinner så fort NÅGON `app.js`-version gjort sin första
   render – även en äldre cachad `app.js` som inte känner till flaggan. Utan
   markörkontrollen skulle vakten skriva över en FUNGERANDE app för klienter
   som får ny `index.html` + gammal cachad `app.js` i mixfönstret, och blinka
   i onödan på långsamma nät (>8 s boot). Triggar den (= ingen app-kod alls
   hann rendera: modulgraf-404/krasch före första render) byts spinnern mot
   "Sajten uppdateras just nu 🔧" + "Försök igen"-knapp (reload). Blandnings-
   fönstret självläker när TTL:en gått ut – nu syns det i stället för evig
   spinner. Detta skyddar ÄVEN framtida deployer som måste lägga nya filer i
   bootgrafen.
4. **Byggstämpel:** deploy-workflowet sed:ar in commit-SHA:n i
   `<meta name="pp-build">`; bootvakten loggar `Pluggportalen build: <sha>` i
   konsolen. Nu kan "deploy ej framme" skiljas från "koden är trasig".

## Verifieringsprotokoll efter deploy till Pages (för leaden)

1. Vänta på att deploy-runnen är grön OCH att
   `gh api repos/eliasrens/pluggportalen/deployments?environment=github-pages`
   visar `success` för rätt SHA (kolla statuses – `updating_pages` kan fastna;
   spamma INTE `gh run rerun`).
2. Öppna live i privat fönster (eller hård-refresh), läs konsolen:
   `Pluggportalen build: <sha>` ska matcha den mergade commiten. Matchar den
   inte → deployen/cachen är inte framme än, vänta 10 min och försök igen –
   **revert:a inte på symptom inom 10-minutersfönstret.**
3. Först när build-stämpeln matchar: bedöm boot/funktion.
