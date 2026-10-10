# Snilleblixten – historik, statistik och demoläge (#560)

## Historik och Statistik → Live
- `src/live/formats/snilleblixt/snilleblixt-history.js` ritar en match: ⚡-vinnare, pallplats (delad placering), topplista med Pluggmynt per elev, **andel rätt per fråga** (de tre svåraste markeras), andel rätt per spellägets `statKeys` (multiplikation: per tabell) och en ruta elev × fråga (ur `sbScores`).
- Siffrorna räknas i `sb-historik-data.js` (ren logik, testad i `test/live-snilleblixt-historik.test.js`).
- `result.perQuestion` får `text`, `statKeys` och `byClass` (resultInputs läser lärarens ögonblicksbild). Ingen regeländring – `result` är en fri map.
- Kärnan (`teacher-live-history.js`) har fått valfria krokar: async `detailHtml`, `ownPlayerTable`, `playerCounts`, `classSummaryHtml`. Klassmatchen använder ingen av dem och ser ut som förut.

Verifierat mot emulatorn: `admin/qa-snilleblixt-historik-seed.mjs` (efter `qa-mm-live-seed.mjs`) skapar en avslutad match UTAN `result`; lärarens historik räknade och sparade resultatet. Skärmdumpar: `01-historik-match.png`, `02-pallplats.png` (emoji visas som rutor i testwebbläsaren).

## Demoläget
`preview-snilleblixt-demo.html` – riktiga `mountProjector` med låtsasdata (`sb-demo.js`). 30 påhittade elever med olika djur och kläder, auto-svar, Alla svarar nu, Avslöja nu, Tid snart slut, Test 7b, Ledningsbyte, Klättring, Pallplats (även delad 2:a och oavgjort om 1:a), Reducerad rörelse, Frys tiden, Flerval/Skriv själv.

Isolering: sidan blockerar och räknar alla anrop till Firebase-värdar (panelen visar "Firebase-anrop: 0 ✓"); `sb-demo.js` importerar inget datalager och sessionen har `demo: true` (live-rewards betalar aldrig ut).
