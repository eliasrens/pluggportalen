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

## I webbläsaren (UTKAST – fylls på)

Rigg: `ENKEL_ARBETARE=1 bash admin/qa-meteorstorm-e2e-preview.sh` (functions + auth + firestore med grenens regler och callables) och `admin/qa-meteorstorm-825/scen.mjs`: läraren skapar matchen i det riktiga formuläret, två projektorer (två inloggade lärarflikar), riktiga elevsidor som svarar och väljer handling i UI:t, STARTA, mätning var 5:e s.

**S1 – Klass mot klass, Vilda, 5 min, 4B mot 5E** (4 elever i webbläsaren, en i 375 px; projektor A:s första `msAvsluta` felad med flit):
- Projektorerna identiska vid samma `t`: **21/21** jämförelser (pixlar + tillstånd), `t` bakåt **0**, sena händelser **0**.
- fps under matchen (1600 × 900, två projektorer + fyra elevsidor i samma Chromium, ingen GPU): **55 / 55**, JS per bildruta 0,95 / 1,04 ms (p95 2,4 / 2,7 ms).
- Musiken: ingen ljudkälla i lobbyn; vid KÖR! startar en loop (`loop = true`, 80,000 s) och tonas till 0,3; ljudeffekter sänker till 0,7 och tillbaka; 🎵 av → 0 och loopen stoppas, 🎵 på → loopen startar om på 0,3; vid 00:00 → 0 och stopp.
- "Live pågår!" i elevens sidomeny: syns under matchen (4/4), borta vid slutet (0/4).
- `msPublic/status`: en skrivning per ~10–13 s, sista vid slutet (`klart: true`, `resultat`).
- Slutrutan (båda projektorerna samma): "☄️ 4B vann Meteorstormen! Lika mycket skrov – flest nedskjutna meteorer avgjorde." – "5E kämpade ända till slutet – besättningen vinkar från rymden! 👋". Elevernas slutskärm: "Ni vann! 🚀" / "Bra kämpat – 4B vann den här gången", eget bidrag, pluggmynt – ingen placering som nummer.
- Pluggmynt utbetalda: b01/b02 +136, e01 +120, e02 +128 = `result.rewards` (studentData.coins före/efter).
- Felvägen: projektorns första `msAvsluta` felade (nätfel) → nytt försök efter 2 s → result + mynt. **Före #825-rättningen (F1) fastnade slutrutan på "Räknar ihop stationerna …"** (sett i en tidigare körning).

**S2 – En klass (4B), Attacker av, 5 min, flerval** (2 elever i webbläsaren; projektorerna stängdes efter 150 s):
- Projektorerna identiska (lika vid alla jämförelser före stängningen); musikknappen som i S1.
- Elevskärmarna fortsatte efter att projektorerna stängts (svar räknades vidare 18 → 26 rätt), sessionen blev `finished` vid 00:00 av elevernas egen avslutning, och elevens `msAvsluta` skrev result (stjärnor 0, stationen flöt): "Bra kämpat! 🛰️ Stationen flyter i rymden – nästa storm klarar ni!".
- Utan lärare betalas mynten först när läraren öppnar matchen i historiken (design, §11).

**Två projektorer med nätfördröjning** (`flock … node admin/qa-meteorstorm-tva-revision.mjs --latens 300,X --sek 90 --p4b 0.3 --p4d 0.22 --attacker vilda`, skadescenariot, två separata Chromium, DevTools-fördröjning; QA-proxyn tvingar long-poll så verklig leverans > nominell):

| Nominell | Verklig leverans median / p95 / max | Sena (> 2 s, verkar "från nu") | Visade rutor ändrade i efterhand | Identiskt vid visad `t` · nu − 10 s | `t` bakåt |
| --- | --- | --- | --- | --- | --- |
| 300 ms | 0,85–0,95 / 1,7–2,0 / 2,2–3,4 s | 0–3 | **0** av 177–181 | – | **0** |
| 1 000 ms | 2,1 / 3,2 / 4,4 s | 28 av 175 | **0** av 193 | 24/26 · 24/26 | **0** |
| 1 500 ms | 3,2 / 4,7 / 5,2 s | 135 av 211 | **0** av 191 | 12/26 · 13/26 | **0** |

- **Jämn bild:** `t` gick aldrig bakåt, och ingen ruta som redan visats ritades om (0 synliga ändringar) – inte ens vid 5 s leverans.
- **Identiskt** när leveransen är under bufferten (2 s). Över 2 s (här redan vid nominella 1 000 ms, eftersom maskinen var hårt lastad – median 2,1 s mot C:s 1,7 s) verkar den sena projektorn händelserna lite senare och bilderna skiljer sig **fram till slutrutan**, som alltid är serverns `msAvsluta`. Det är beslutet i §12.4 (konstant 2 s, adaptiv avvisad) – redovisat, inte en bugg. I S1/S2 ovan (riktig Firestore-strömning utan påtvingad long-poll, samma maskin) var projektorerna identiska vid alla jämförelser.
- fps i den här riggen: 10–17 (två Chromium + emulatorn på en maskin med last 11–13 från andra jobb; JS per bildruta 3–5 ms). Se fps-avsnittet.
