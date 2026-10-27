# Rapport: Meteorstormen ☄️ (epic #819) – slut-QA (#825)

> UTKAST under arbete (#825). Fylls på med mätningarna i webbläsaren.

## Sviterna (epic-grenen 5e1bd09 + #825)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test`, alla 272 filer utom rules/functions/e2e, en körning, 3 parallellt) | **4 048: 4 047 ✅, 1 överhoppad, 0 fel** (+3 nya i #825) |
| `test:rules` (76 filer, sex delar, `flock`, slumpade portar) | **884/884 ✅** |
| `test:functions` (alla 37 filer, fem delar) | **441 ✅, 0 fel, 2 todo** (schack F9, sedan tidigare) |
| `test:e2e` | **5/5 ✅** |
| Bootgrafen (`test/live-formats.test.js`) | ✅ 107 filer |
| `npm run sync:meteorstorm` + `git status` | 0 rader diff |
| `delat/*.js` ≤ 400 rader | ✅ störst `ms-motor.js` 221 |

## Kvoten – uppmätt i emulatorn (#825)

`flock … firebase emulators:exec --only firestore "node admin/ms-kvot-sim.mjs --md --elever 25 --klasser 2 --min 10 --takt 8 --ratt 0.7,0.6 --projektorer 2 --instanser 1 --status 20 --seed 1"`
(serverkärnan = samma kod som Cloud Functions, elevklienten `ms-klient.js`, styrd klocka; 877 s väggtid):

| | #825 | B (#821) |
| --- | --- | --- |
| Rätta svar (= händelser) / fel svar | 2 278 / 1 261 | 2 299 / 1 237 |
| **Skrivningar totalt** | **2 452** ✅ (tak 3 000, mål 2 200–2 500) | 2 463 |
| varav `msEvents` / `msPlayers` / `msPublic/status` / `msLas` / session | 2 279 / 76 / 61 / 33 / 3 | |
| Projektorerna `msEvents` (2 × händelserna¹) | 4 556 | 4 598 |
| Projektorerna sessionen | 8 | 8 |
| Elevskärmarna `msPublic/status` (20 s utan svar) | 373 | 350 |
| Elevskärmarna sessionen + eget `msPlayers` | 300 | 300 |
| **Klienternas läsningar** | **≈ 5 240** ✅ (< 6 000) | ≈ 5 260 |
| Serverns läsningar (1 instans) | 7 586 | 7 574 |

¹ Simuleringens lyssnare hann inte ikapp före stopp (mätt 3 571) – som i B räknas 2 × händelserna.

- `msPublic/status` skrevs **61 gånger på 10 min** = högst en gång per 10 s (60) + slutstatusen i `msAvsluta`. ✅ Throttlingen håller.
- Fel svar skrivs aldrig ensamma i onödan: 1 261 fel svar blev 0 egna dokument (de följer med nästa händelse; "fel"-länkar bara vid full buffert).
- Fyra instanser och quiz mättes inte om (B: 2 465 / 2 463 skrivningar, klienter ≈ 5 310) – samma kod, och körningen tar ~15 min var.
