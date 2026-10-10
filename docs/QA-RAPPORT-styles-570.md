# QA-rapport #570 – `src/styles.css` uppdelad per område (test 23)

**Resultat:** inga visuella förändringar. Alla 26 skärmdumpspar (13 sidor ×
mobil + desktop) är pixelidentiska, 0 px skillnad. Alla testsviter är gröna.

## Vad som ändrats

- `src/styles.css` (7 087 rader) är uppdelad i 27 filer i `src/styles/`,
  `01-grund.css` … `27-larare-wizard.css`. Varje fil är en **sammanhängande
  bit** av originalet. Inga regler har flyttats, ändrats eller tagits bort.
- `src/styles.css` finns kvar, men den **byggs** nu av delarna
  (`npm run build:css` = `admin/bygg-styles.mjs`). Den gamla filen och delarna
  hopfogade är byte för byte samma, bortsett från en rubrikkommentar och en
  kommentar per del (`/* ── src/styles/NN-….css ── */`).
- `test/styles-delar.test.js` fäller testet om `styles.css` inte är ombyggd,
  om en del klipper mitt i ett block eller en kommentar, eller om en sida
  börjar länka delarna direkt.

## Varför en byggd samlingsfil (inte `@import` eller flera `<link>`)

GitHub Pages-deployen är inte atomär, och 404-svar cachas i ~10 min (#271,
`docs/rotorsak-live-boot-2026-09-10.md`). Om sajten laddade 27 nya filer
direkt skulle en klient i blandningsfönstret kunna få ny `styles.css` men
404 på delarna. Sidan skulle då bli helt osylad. Med en byggd fil laddar
`index.html` (och `seed/seed.html` och preview-sidorna) **samma enda fil som
förut**. Boot-kedjan får inga nya filer, inga extra requests och inget
`@import`-vattenfall. Samma mönster som `npm run sync:guldrush` (#563).

**Arbetsflöde:** ändra i `src/styles/NN-*.css` → `npm run build:css` → committa
båda. Nummerprefixet är laddningsordningen.

## Test 23 – pixel-diff

Skript: `admin/qa-styles-pixeldiff.mjs` (headless Chromium, puppeteer-core +
sharp). **Före** = `git archive 377fb41` (main före ändringen) med egen
`qa-emulator-proxy` på :8571. **Efter** = grenen på :8572. Båda kör mot samma
emulator med `qa-klasscentret-preview.sh`-data (elev `kc01`, lärare
`qalarare`). Math.random är seedad och animationer fryses före skärmdump.

Två mätningar per sida:

- **Byte**: samma laddade sida (efter-servern, JS och animationer frysta).
  Stilmallen byts på plats till den gamla `styles.css` och tillbaka. Samma DOM
  och data, så en skillnad kan bara komma från CSS. *Kontroll* = två
  skärmdumpar med samma CSS, och mäter brus.
- **Separat**: sidan laddas oberoende på båda servrarna.

| Sida | Desktop 1366 byte / kontroll / separat | Mobil 390 byte / kontroll / separat |
|---|---|---|
| Porten (inloggning) | 0 / 0 / 0 | 0 / 0 / 0 |
| Elevens start | 0 / 0 / 0 | 0 / 0 / 0 |
| Rummet | 0 / 0 / 0 | 0 / 0 / 0 |
| Butiken (helsida) | 0 / 0 / 0 | 0 / 0 / 0 |
| Plugga | 0 / 0 / 0 | 0 / 0 / 0 |
| Byn | 0 / 0 / 0 | 0 / 0 / 0 |
| Lärarsidan – klasser (helsida) | 0 / 0 / 0 | 0 / 0 / 0 |
| Lärarsidan – innehåll | 0 / 0 / 0 | 0 / 0 / 0 |
| Live: Klassmatchen (demo, pågår) | 0 / 0 / 14 288\* | 0 / 0 / 4 831\* |
| Live: Snilleblixten fråga | 0 / 0 / 816\* | 0 / 0 / 2\* |
| Live: Snilleblixten pallplats | 0 / 0 / 18 841\* | 0 / 0 / 16 420\* |
| Live: Guldrushen skattkammare | 0 / 0 / 1 849\* | 0 / 0 / 0 |
| Live: Guldrushen pallplats | 0 / 0 / 17 713\* | 0 / 0 / 9 418\* |

\* Live-demona är tidsstyrda simuleringar. Två oberoende laddningar hamnar
några hundra ms isär, till exempel klockan "12:37" mot "12:38" eller olika
höjd på raketerna. Därför avgör byte-mätningen här, och den är 0 överallt.
I en tidigare körning fick två byte-par (Snilleblixten fråga desktop och
Guldrushen pallplats mobil) brus. Bruset syntes lika mycket i *kontrollen*,
alltså med samma CSS. I körningen ovan var allt 0.

**Kall boot:** varje sida laddades i en ny, tom webbläsarkontext. Det fanns
inga konsolfel. Det enda fel-svaret var `404 /favicon.ico` på preview-sidorna,
och det kommer lika på både före och efter, eftersom preview-sidorna saknar favicon.

## Testsviter

| Svit | Resultat |
|---|---|
| Enhetstester (`node --test` utom regler/functions/e2e) | 1557/1557 |
| `npm run test:rules` | 399/399 |
| `npm run test:functions` | 34/34 |
| `npm run test:e2e` | 5/5 |

## Köra om

```bash
JAVA_BIN=… FIREBASE_BIN=… FS=8570 AUTH=9570 PROXY=8572 bash admin/qa-klasscentret-preview.sh
mkdir -p /tmp/fore && git archive 377fb41 | tar -x -C /tmp/fore
FIRESTORE_EMULATOR_HOST=127.0.0.1:8570 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9570 \
  GCLOUD_PROJECT=pluggportalen-so-2026 PORT=8571 node /tmp/fore/admin/qa-emulator-proxy.mjs &
NODE_PATH=<mapp med puppeteer-core + sharp> node admin/qa-styles-pixeldiff.mjs \
  --fore http://127.0.0.1:8571 --efter http://127.0.0.1:8572 --ut /tmp/570/shots
```
