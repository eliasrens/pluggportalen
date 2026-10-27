# Rapport: Meteorstormen ☄️ (epic #819) – slut-QA (#825)

Slut-QA av hela Live-formatet `meteorstorm` på epic-grenen (A–E landade, 5e1bd09) plus
rättningarna i #825. Kontraktet: [`METEORSTORMEN.md`](METEORSTORMEN.md), specen:
[`UTVECKLINGSUPPDRAG_METEORSTORMEN.md`](UTVECKLINGSUPPDRAG_METEORSTORMEN.md).
Skärmdumpar: [`meteorstormen-825/`](meteorstormen-825/) (och C:s/E:s i `meteorstormen-822/`, `meteorstormen-824/`).
Huvudlös Chromium saknar emoji-typsnitt – rutorna i bilderna är emojier i en vanlig webbläsare.

## 1. Vad som byggts

| Del | Issue | Innehåll |
| --- | --- | --- |
| A | #820 | Deterministisk motor i `src/live/formats/meteorstorm/delat/` (frö-PRNG, spegelvänd storm, sköld/laser/dragstråle, händelser, hjälp, slut), alla tal i `ms-balans.js`, balanssimulering (`admin/ms-balans-sim.mjs`), motor-preview |
| B | #821 | Servern: `msAgera` (svar + handling i ETT anrop, fel svar buffrade), `msRatta` (quiz), `msLage`, `msAvsluta` (hela loggen → `result` + totaler). Händelsekedja `msEvents/{uid}_{nr}`, regelgren "Meteorstormen", synk `delat/` → `functions/meteorstorm/`, kvotmätning (`admin/ms-kvot-sim.mjs`) |
| C | #822 | Projektorn: canvas-rymd, skadenivåer, flöde/banderoller, slutrutor, demoläge. Ritningen är en ren funktion av (logg, `t`, frö); **konstant renderingsbuffert 2 000 ms**, sena händelser verkar "från nu" (senvakten) – det som visats ändras aldrig |
| D | #823 | Elevskärmen (handlingsknappar, kvittenser, energi, stationer ur status), lärarformuläret (Läge, Attacker, speltid), historik + Statistik → Live, pluggmynt (`avslutaOchBetala`) |
| E | #824 | Musiken (`assets/meteorstormen-loop.ogg` via `format.music`, sampelexakt loop), "Live pågår!" försvinner vid 00:00 (alla format), motorn delad i `ms-steg.js`/`ms-utdata.js`, kopplat demoläge, formatval-preview, historik 375 px, frågorna till Elias samlade |
| F | #825 | Den här slut-QA:n + två rättningar (§7) + webbläsarriggen `admin/qa-meteorstorm-825/` |

## 2. Formeln för "per elev"

```
effekt per tryck = KLASSVARV / aktiva
```

`KLASSVARV` = effekten när **varje aktiv elev tryckt en gång**: sköld 16, laser 1,92 skott.
25 elever → +0,64 sköld eller +0,077 skott per tryck; 19 elever → +0,84 / +0,10. Klassens
storlek tar ut sig, andelen rätt avgör (balanssimen: 19 och 25 elever med 60 % rätt ger
skrov 65 resp. 66). `aktiva` = elever som gått med före start (`msStationer`, sätts av
servern). Dragstrålen skalas inte (en i taget per station + väntetid). Hjälpen: en station
≥ 20 skrov efter får dragstrålen för 2 och +25 % sköld per tryck. (METEORSTORMEN §3.2.)

## 3. Sviterna (epic-grenen + #825)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test`, alla 274 filer utom rules/functions/e2e, efter #825) | **4 056: 4 055 ✅, 1 överhoppad, 0 fel** |
| `test:rules` (76 filer, sex delar, `flock`, slumpade portar) | **884/884 ✅** |
| `test:functions` (**alla 37 filer**, fem delar) | **441 ✅, 0 fel, 2 todo** (schack F9, sedan tidigare) |
| `test:e2e` | **5/5 ✅** |
| Bootgrafen (`test/live-formats.test.js`) | ✅ 107 filer |
| `npm run sync:meteorstorm` + `git status` | 0 rader diff |
| `delat/*.js` ≤ 400 rader | ✅ störst `ms-motor.js` 221 |
| Förhandsvisningarna (`admin/qa-meteorstorm-skarmdumpar.mjs`, 12 sidor) | 0 konsolfel; vågrät scroll bara i historiken 375 px → rättat (§7 F2) |

### 3.1 Enhetstesterna

Före #825-ändringarna: **4 048 tester, 4 047 ✅, 1 överhoppad, 0 fel** (en körning, 3
parallellt, med riggens `node_modules`). De sju fel E såg i en tidigare körning (fyra
`admin-credential` utan `firebase-admin`, `adventure-flee` och två schack-tidsgränser under
last) uppstod inte – de är miljö, inte Meteorstormen. Efter #825-ändringarna (F1, F2, 8 nya
tester): **4 056 tester, 4 055 ✅, 1 överhoppad, 0 fel**. Regel- och functions-sviterna kördes
före F1/F2 – de rör bara webbkod (`ms-avslut.js`, `ms-elev-vy.js`, `teacher-live-history.js`).

## 4. Kvoten – uppmätt i emulatorn

`flock … firebase emulators:exec --only firestore "node admin/ms-kvot-sim.mjs --md --elever 25 --klasser 2 --min 10 --takt 8 --ratt 0.7,0.6 --projektorer 2 --instanser 1 --status 20 --seed 1"`
(serverkärnan = samma kod som Cloud Functions, elevklienten `ms-klient.js`, styrd klocka; 877 s väggtid):

| 2 klasser × 25 elever, 10 min, Klass mot klass / Milda | #825 | B (#821) |
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

- B:s siffror **bekräftade**: 2 452 skrivningar (B 2 457 i första mätningen, 2 463 efter rättningsrundorna), klienternas läsningar ≈ 5 240.
- `msPublic/status` skrevs **61 gånger på 10 min** = högst en per 10 s (60) + slutstatusen i `msAvsluta` – throttlingen håller (Elias beslut 3). Även i webbläsaren: en status-skrivning per ~10–13 s (§5 S1).
- 1 261 fel svar gav 0 egna skrivningar – de följer med nästa händelse (Elias beslut 2).
- Fyra instanser och quiz mättes inte om (B: 2 465 / 2 463 skrivningar, klienter ≈ 5 310) – samma kod; en körning tar ~15 min.
- Serverns läsningar (7 600–15 000) räknas inte i målet "< 6 000" – fråga 14.3.

## 5. I webbläsaren – riktiga Chromium mot emulatorerna

Rigg: `ENKEL_ARBETARE=1 bash admin/qa-meteorstorm-e2e-preview.sh` (functions + auth +
firestore med grenens regler och callables, QA-proxyn på samma origin) och
`admin/qa-meteorstorm-825/scen.mjs`: läraren loggar in och skapar matchen i det riktiga
formuläret, två projektorer (två inloggade lärarfönster, B med DevTools-nätfördröjning),
riktiga elevsidor (en i 375 px) som går med i lobbyn, svarar och väljer handling i UI:t
(`elevbot.js`), botelever som spelar via de riktiga callables (`botar.mjs`), STARTA på
projektorn, mätning var 5:e s. Projektorernas egna mätare (`__mspProjektor`: `t`,
`stat()` – bakåt-steg, sena, leverans – `avtryckVid(t)`, `fps()`), ljudet via en krok på
Web Audio (`ljudhook.js`).

**S1 – Klass mot klass, Vilda, 5 min, 4B mot 5E** (4 elever i webbläsaren; projektor A:s första `msAvsluta` felad med flit):
- Projektorerna **identiska** vid samma `t`: 21/21 jämförelser (pixlar + tillstånd); `t` bakåt **0**; sena **0**.
- fps under matchen (1600 × 900, två projektorer + fyra elevsidor i samma Chromium, ingen GPU): **55 / 55**, JS per bildruta 0,95 / 1,04 ms (p95 2,4 / 2,7 ms).
- **Musiken:** ingen ljudkälla i lobbyn; vid KÖR! startar en loop (`AudioBufferSourceNode`, `loop = true`, buffert 80,000 s) och tonas till 0,3; ljudeffekter sänker till 0,7 och tillbaka; 🎵 av → 0 och loopen stoppas; 🎵 på → loopen startar om på 0,3; vid 00:00 → 0 och stopp.
- **"Live pågår!"** i elevens sidomeny: syns under matchen (4/4 elever), borta efter 00:00 (0/4).
- **Händelser** sedda på elevskärmen: ☀️ Solstorm (dubbel energi, kvittens "☀️ Dubbel energi! …"), ✨ Kometsvans, 🌌 Lugnet (även projektorns banderoll). Dragstrålen: "🌀 Din dragstråle fångar nästa meteor och slungar den mot 5E!".
- **Slutrutan** (båda projektorerna samma): "☄️ 4B vann Meteorstormen! Lika mycket skrov – flest nedskjutna meteorer avgjorde." (#822 F3 rättad), "5E kämpade ända till slutet – besättningen vinkar från rymden! 👋", bästa ögonblicken per klass. Båda stationerna flöt (0 %) – "Flyter i rymden / Ingen mer skada".
- **Elevernas slutskärm:** "Ni vann! 🚀" / "Bra kämpat – 4B vann den här gången", skrov kvar, eget bidrag (nedskjutna, sköldtryck, dragstrålar), rätt svar och pluggmynt – **ingen placering som nummer**.
- **Pluggmynt utbetalda:** `studentData.coins` b01/b02 +136, e01 +120, e02 +128 = `result.rewards`.
- **Felvägen:** projektorns första `msAvsluta` felade (nätfel via CDP) → nytt försök efter 2 s → result + mynt (§7 F1).

**S2 – En klass (4B), Attacker av, 5 min, flerval** (2 elever; projektorerna stängdes efter 150 s):
- Projektorerna identiska vid alla jämförelser före stängningen; musikknappen som i S1.
- **Elevskärmarna fryser inte** när projektorerna stängs: svaren räknades vidare (18 → 26 rätt), klockan gick, sessionen blev `finished` vid 00:00 genom elevernas egen avslutning, och en elevs `msAvsluta` skrev result: "Bra kämpat! 🛰️ Stationen flyter i rymden – nästa storm klarar ni!" (0 stjärnor).
- Flervalet: frågan "8 × 4 = ?" med fyra alternativ i 375 px, kvittens "🛡️ +1,6 – skölden 2/60" (`meteorstormen-825/enklass-elev-flerval-375.jpg`).

**S3 – Klass mot klass, Milda, standard 10 min, 2 + 2 elever + 16 botar, projektor B med 1 000 ms nätfördröjning:**
avbröts av en omstart av testmiljön (Barista) efter 5:44 av 10:00 – loggen till dess:
`meteorstormen-825/kmk-milda-10min-logg.txt`. 541 handlingar på 344 s; `t` bakåt 0 på båda;
projektor A (utan fördröjning) 4 sena, B (1 000 ms + QA-proxyns long-poll) 150 sena → B
visade ibland ett annat förlopp än A (i loggens 10 jämförelser: pixlar lika 8, tillståndet lika 5) – samma sak som §6 och beslutet i METEORSTORMEN §12.4. Hela 10 min-förloppet
(inklusive slutet) täcks av kvotmätningen (§4).

**S4 – utan lärare i slutet + historiken** – se §5.1.

**Säkerhet** (`admin/qa-meteorstorm-825/sak.mjs`, riktiga elevinloggningar mot emulatorernas regler och callables, under en pågående match):

| Prov | Resultat |
| --- | --- |
| Elev skriver `msEvents`, eget `msPlayers`, `msPublic/status`, `msLas`, `msPrivate` | 403 ✅ (alla fem) |
| Lärare skriver `msEvents` | 403 ✅ |
| Elev läser annans `msPlayers` (samma klass / andra klassen), listar `msEvents`, läser annans `msEvents`-dokument, läser `msPrivate` | 403 ✅ |
| Elev läser eget `msPlayers` (404 under matchen = tillåtet, finns först efteråt), `msPublic/status` i sin match | ✅ |
| Elev i en klass utanför matchen läser status | 403 ✅ |
| `msAgera` fel sessions-id / utan inloggning / elev utanför klasserna | NOT_FOUND / UNAUTHENTICATED / PERMISSION_DENIED ✅ |
| `msAgera` rätt svar på påhittade faktorer (en fråga eleven inte fått) | FAILED_PRECONDITION "Svara på frågan du fick." ✅ |
| `msAgera` fel svar + handling | `correct: false`, ingen handling ✅ |
| `msAgera` dragstråle under väntetiden | `nekad: "vantetid"`, energin kvar (1 → 2) ✅ |
| `msLage`/`msAvsluta` fel id / utanför klasserna | NOT_FOUND / PERMISSION_DENIED ✅ |

Energi, väntetid, otillåten dragstråle (En klass / Attacker av) och fel klass-id testas
dessutom i `test:functions` (`functions-meteorstorm-fusk*.test.mjs`) och reglerna i
`test:rules` (`firestore-rules-live-meteorstorm*.test.js`) – alla gröna.

**Snällt flöde, blinkning, reducerad rörelse, 375 px** (`admin/qa-meteorstorm-825/rorelse.mjs` + skärmdumparna):
- Projektorns flöde och slutruta nämner bara det som är bra; elevskärmen har ingen placering som nummer (S1–S2, texterna ovan).
- **Ingen vit blixt:** projektorns canvas i finalen samplad 20 gånger på 1 s – högst 0,14 % nästan vita pixlar, inga ljushopp > 20/255.
- **`prefers-reduced-motion`:** 0 pågående CSS-animationer/övergångar på projektorn, elevskärmen och lobbyn (CDP `setEmulatedMedia`); E:s bild `meteorstormen-824/projektor-reducerad.jpg`.
- **375 px:** elevskärmen, lobbyn, slutskärmen, flervalet och formatväljaren utan vågrät scroll; historiken efter F2 (§7).

### 5.1 Utan lärare i slutet + historiken (S4)

Klass mot klass, Attacker av, 5 min, 2 elever i webbläsaren + 8 botar via callables (0 fel på 202 `msAgera`), projektorerna stängda efter 120 s:
- Elevskärmarna fortsatte; vid 00:00 skrev elevernas `msAvsluta` result **9 s efter slutet** (4B vann på flest nedskjutna, 25 mot 21, båda 100 % skrov). Slutskärmarna: "Ni vann! 🚀" / "Bra kämpat – 4B vann den här gången".
- Pluggmynten: **inte** utbetalda direkt (läraren var borta – design, §11/§14.6). När läraren sedan öppnade matchen i historiken betalades de: b01 100 → 244 (+144), e01 100 → 200 (+100), b04 100 → 232 (+132) = `result.rewards`.
- Historiken i 375 px: ingen vågrät scroll (`meteorstormen-825/historik-375.jpg`). **Statistik → Live** (Mina klasser → Hur går det? → Live) i 375 px: ingen vågrät scroll, tabellerna i `.table-scroll` (F2; `statistik-live-375.jpg`).
- En elev vars sida hamnade på Hem i stället för Live (riggens navigering direkt efter inloggningen) gick med **mitt i matchen** via "Live pågår!" i sidomenyn och kunde svara och agera direkt ("🛡️ +3,2 – skölden 60/60").

### 5.2 Checklista mot #825

| Punkt | Status | Var |
| --- | --- | --- |
| Konstant buffert 2 s: jämn bild, inga hopp bakåt | ✅ `t` bakåt 0 i alla körningar, 0 ändrade visade rutor | §5 S1–S3, §6 |
| Identiskt på två projektorer | ✅ under 2 s leverans (S1 21/21); över 2 s skiljer det till slutrutan – beslut §12.4 | §6 |
| Kvot ≤ 3 000 skriv / < 6 000 läs | ✅ 2 452 / ≈ 5 240 | §4 |
| `msPublic/status` throttlat, elevskärmar fryser inte utan projektor | ✅ 61 skrivningar/10 min; S2/S4 | §4, §5 |
| Båda lägena, attacker Av/Milda/Vilda, 5 min + standard | ✅ S1 (KmK Vilda 5), S2 (En klass Av 5), S3 (KmK Milda 10, avbruten 5:44 av miljön), S4 (KmK Av 5); 10 min helt i kvotmätningen | §5 |
| Sköld, laser, dragstråle (väntetid, nekad), händelser, skadenivåer, flyter, slutrutor, stjärnor | ✅ i webbläsaren; skadenivåerna och kostnaden/hjälpen vid ≥ 20 dessutom i motortesterna + C:s bilder | §5, `meteorstormen-822/` |
| Hjälp vid ≥ 20 efter | ✅ motortesterna (`live-meteorstorm-tester.test.js` "på vid exakt 20 …, av under 20", `-regler.test.js`) – syntes inte i webbläsarmatcherna (klasserna låg jämnt) | §3 |
| Pluggmynt utbetalda, historik/Statistik → Live | ✅ S1 direkt, S4 via historiken; 375 px efter F2 | §5, §5.1 |
| Musiken: loop, tyst i lobbyn, 🎵-knappen | ✅ | §5 S1 |
| "Live pågår!" försvinner vid 00:00 | ✅ i webbläsaren (Meteorstormen); alla fem format i `test/live-watch.test.js` (grön) | §5 S1 |
| Kopplat demoläge, formatval-preview, historik 375 px | ✅ skärmdumpsriggen (0 konsolfel), F2 | §3, §7 |
| Snällt flöde, ingen blinkning, reducerad rörelse, 375 px | ✅ | §5 |
| Säkerhet: regler + callables | ✅ 22 prov i webbläsarmiljön + sviterna | §5 |
| fps | ✅ 46–56 (lugn maskin) | §8 |
| Alla sviter gröna | ✅ | §3 |

## 6. Två projektorer med nätfördröjning (Elias beslut 1)

`flock … node admin/qa-meteorstorm-tva-revision.mjs --latens 300,X --sek 90 --p4b 0.3 --p4d 0.22 --attacker vilda`
(C:s/testarens rigg: skadescenariot, två **separata** Chromium med den riktiga projektorn,
DevTools-fördröjning på varje anrop; QA-proxyn tvingar long-poll, så den verkliga
leveransen blir längre än den nominella):

| Nominell | Verklig leverans median / p95 / max | Sena (> 2 s, verkar "från nu") | Visade rutor ändrade i efterhand | Identiskt vid visad `t` · nu − 10 s | `t` bakåt |
| --- | --- | --- | --- | --- | --- |
| 300 ms | 0,85–0,95 / 1,7–2,0 / 2,2–3,4 s | 0–3 | **0** av 177–181 | – | **0** |
| 1 000 ms | 2,1 / 3,2 / 4,4 s | 28 av 175 | **0** av 193 | 24/26 · 24/26 | **0** |
| 1 500 ms | 3,2 / 4,7 / 5,2 s | 135 av 211 | **0** av 191 | 12/26 · 13/26 | **0** |

- **Jämn bild:** `t` gick aldrig bakåt och ingen ruta som redan visats ritades om – inte ens vid 5 s leverans. ✅
- **Identiskt** när leveransen är under bufferten (2 s): S1/S2 (21/21 och alla jämförelser). Över 2 s verkar den sena projektorn händelserna lite senare och bilderna skiljer sig **fram till slutrutan**, som alltid är serverns `msAvsluta` (båda projektorerna visade samma slutruta i S1). Här passerades 2 s redan vid nominella 1 000 ms, eftersom maskinen var hårt lastad (median 2,1 s mot C:s 1,7 s i #822). Det är det beslutade beteendet (METEORSTORMEN §12.4: konstant 2 s, adaptiv buffert avvisad) – **redovisat, inte en bugg**; fråga 14.5 står kvar.

## 7. Buggar

| # | Vad | Status |
| --- | --- | --- |
| **F1** | **Slutet fastnade om `msAvsluta` misslyckades en gång.** Projektorn gör ETT anrop vid 00:00 (kärnans `live-feed.js` → `resultInputs` → `avslutaOchBetala`) och elevskärmen ETT reservanrop efter 20–35 s – inga omförsök. I webbläsaren (functions-emulatorn under last) misslyckades båda: projektorn stod kvar på "☄️ Stormen är över! Räknar ihop stationerna …", eleverna på "Stationerna räknas ihop …", inget result, inga pluggmynt, tills någon laddade om sidan. | **Rättad** (8a9fdc7): `avslutaMedForsok` – två nya försök (2 s, 5 s) vid tillfälliga fel (inte vid nekad/fel indata); elevskärmen försöker igen var 15:e s (högst 3 anrop) medan result saknas. 5 tester (`test/live-meteorstorm-avslut-tester825.test.js`); verifierat i webbläsaren med ett felat första anrop (S1). |
| **F2** | **Statistik → Live scrollade i sidled i 375 px.** Kärnans "Matcher"-tabell (`teacher-live-history.js`, alla format) får formatets kolumner och blev 538 px bred. | **Rättad** (43b6b12): kärnans tre tabeller i `.table-scroll`; förhandsvisningen speglar det; test `test/live-history-375-tester825.test.js`. Skärmdumpsriggen: 375 px utan vågrät scroll. |
| O1 | Kärnans `live-feed.js` försöker aldrig `resultInputs` igen om det kastar (gäller alla format med server-result). Med F1 löst inne i formatet behövs det inte för Meteorstormen. | Kvar (delad kod, utanför formatet) |
| O2 | Lärarinloggningen kastar i konsolen: `TypeError: Failed to construct 'URL'` i `pages-varld.js:76` – `teacher-gate.js` skickar en syntetisk `HashChangeEvent` utan `oldURL`. Ofarligt (bara den lyssnaren). | Kvar (delad kod, inte Meteorstormen) |
| O3 | Functions-**emulatorn** startar en ny arbetsprocess per samtidigt anrop: ~40 elever som börjar samtidigt gav last > 100 och "Failed to load function" på testmaskinen. Gäller bara emulatorn (Cloud Functions: concurrency 80). Riggen har nu `ENKEL_ARBETARE=1` (`--inspect-functions`). | Rigg, inte produktion |
| O4 | E:s observation: lärarformulärets spellägeschip "✖ Multiplikation 0–10 – snabbmatch" bryts i 375 px (`.live-chip`, alla format). | Kvar (delad kod) |

Inga fel hittades i motorn, servern, reglerna, projektorn eller elevskärmen utöver F1.

## 8. fps på projektorn

| Var | fps | JS per bildruta (medel / p95) |
| --- | --- | --- |
| S1, riktig match, 1600 × 900, två projektorer + fyra elevsidor i en Chromium (ingen GPU, maskinen lugn) | **55 / 55** | 0,95 / 2,4 ms |
| C (#822), demosidan, 1920 × 1080 finalen / 1280 × 720 / mitten (lugn maskin) | 58 / 59 / 60 | 1,6 / 3,4 ms |
| #825, `node admin/qa-meteorstorm-fps.mjs` (demosidan, Chromium 156, `--disable-gpu`, last 2–6): 1920 × 1080 finalen / 1280 × 720 finalen / 1920 × 1080 mitten | **55 / 56 / 46** | 1,8–2,3 / 4,0–5,2 ms |
| Samma maskin under hög last från andra jobb (last 8–18) | 8–34 | 3–7 ms |

Ritningen tar ~1 ms av budgeten 16,7 ms. När fps sjunker är det maskinen (mjukvarurastret utan GPU, delad CPU), inte projektorn – JS-tiden per bildruta är fortfarande liten. En lärardator rastrar Canvas 2D på GPU:n.

## 9. Frågor till Elias (samlade från METEORSTORMEN §14 – standardvalet gäller nu)

| # | Fråga | Standardval nu |
| --- | --- | --- |
| 14.1 | Balans: smart spel ger bara ~+2 procentenheter; 60 % vinner mot 70 % i ~31–35 % tack vare dragstrålens slump. Ska smart spel löna sig mer? | Oförändrat (dragstrålen fångar närmaste stormmeteor) |
| 14.2 | Dragstrålen: 60 % som drar vinner alltid mot 70 % som aldrig drar. Så avgörande? | Milda 3 ⚡/10 s, Vilda 2 ⚡/6 s + större meteor |
| 14.3 | Kvoten: klienternas läsningar ≈ 5 240 < 6 000, men serverns 7 600–15 000 tillkommer. Räcker det att klienterna ligger under? | Ja (`msAvsluta` läser om hela loggen, `maxInstances: 4`) |
| 14.4 | En elev som skriptar callable-API:t når ~441 skrivningar/10 min; två sådana → > 3 000. | Takten 1,5 s per fråga |
| 14.5 | Bufferten 2 s konstant: vid sämre nät kan två projektorer visa lite olika förlopp (aldrig en ångrad bild) fram till slutrutan (§6). Räcker 2 s? | 2 s |
| 14.6 | Klassbonusen går förlorad om projektorn är stängd vid 00:00 (en elevs `msAvsluta` skriver result; pokaler och pris delas ut när en admin öppnar historiken). | Godtas |
| 14.7 | Musiken: bara OGG – äldre Safari spelar ingen musik (ljudeffekterna fungerar). | Bara OGG |

Ny från F: ingen. (F1 rättades utan att röra något beslut.)

## 10. Deploy – i den här ordningen

0. **`firebase deploy --only firestore:indexes`** – `msEvents (uid ↑, nr ↓)`. **Vänta tills indexet är READY** (konsolen → Firestore → Index, eller `gcloud firestore indexes composite list`). Utan det: `FAILED_PRECONDITION` i `msLage`/`msAgera` (eleven ser "internal"). Emulatorn kräver inga index – testerna fångar inte ett saknat index.
1. **`firebase deploy --only firestore:rules`** – regelgrenen "Meteorstormen" (rör inga andra format).
2. **`firebase deploy --only functions:msAgera,functions:msRatta,functions:msLage,functions:msAvsluta`** – predeploy synkar `delat/` → `functions/meteorstorm/`. ⚠️ `RENDER_FORDROJNING_MS` (2 000) används även av servern (`msPublic/status`) – deploya functions före webben.
3. **Webben** – formatet syns för lärarna först då. #825-ändringarna (F1, F2) är bara webb.

Merge till `main` gör Elias.
