# Meteorstormen ☄️ – motorn, reglerna och balansen

Meteorstormen är ett Live-format (`format: "meteorstorm"`, epic #819). Klasser
försvarar var sin rymdstation mot en **förutbestämd** meteorstorm; rätt svar ger
energi som eleven lägger på 🛡️ sköld, 🔫 laser eller 🌀 dragstråle. Specen:
[`UTVECKLINGSUPPDRAG_METEORSTORMEN.md`](UTVECKLINGSUPPDRAG_METEORSTORMEN.md).
Det här är **formatets kontraktsdokument** – del A (#820) beskriver motorn,
B (#821) servern (§7–§10); C (projektorn), D (elevskärmen/lärarvyerna) och E fyller på.

---

## 1. Filerna (del A)

| Fil | Innehåll |
| --- | --- |
| `src/live/formats/meteorstorm/delat/ms-balans.js` | **Alla tal** (skada, sköld, laser, stormens intensitet, händelser, attacker, hjälp, stjärnor, skadenivåer, `RENDER_FORDROJNING_MS`) + per elev-formeln |
| `delat/ms-prng.js` | Seedad PRNG (FNV-1a + mulberry32) – den enda slumpen |
| `delat/ms-storm.js` | Stormplanen: meteorer och händelser ur frö + speltid (spegelvänd) |
| `delat/ms-indata.js` | Normalisering av indata, ordningen på handlingar (t, sedan id) |
| `delat/ms-station.js` | En stations mekanik: sköldmätaren, laserladdningen, nedslag |
| `delat/ms-motor.js` | Motorn: `simulera`, `skapaMotor` (fasta steg, kontrollpunkter, cache) |
| `delat/ms-resultat.js` | Slutet: vinnare, oavgjort, stjärnor |
| `delat/ms-agera.js` | Det servern behöver: `energiEffekt`, `kanAgera`, `effektPerTryck`, `stormPlan` |
| `functions/meteorstorm/` | **Genererad** kopia av `delat/` (`npm run sync:meteorstorm`, predeploy). Redigera aldrig |
| `admin/ms-balans-sim.mjs` | Balanssimuleringen (§2.3.2) |
| `test/live-meteorstorm-motor.test.js`, `test/live-meteorstorm-regler.test.js` | Motortesterna (node, ingen emulator) |
| `preview/preview-meteorstorm-motor.html` | Tidsreglage, "Samma frö", skrovreglage – debug-rendering |
| `delat/ms-anrop.js` | **B:** anropskontraktet (spärrar, buffertens tak, statusintervallet) och quizets kortlek `fragaFor` |
| `functions/meteorstorm-core.js` (+ `-sess`, `-ratta`, `-status`, `-resultat`, `-mynt`) | **B:** servern – `msAgera`, `msRatta`, `msLage`, `msAvsluta` (§7) |
| `ms-klient.js` | **B:** elevens anrop, ren (anropen injiceras) – svar + handling, felbufferten, nr/energi/k |
| `meteorstorm-data.js` | **B:** lat Firebase-modul: `skapaKlient`, `skapaStatusvakt`, `watchEvents`, `avsluta` … |
| `admin/ms-kvot-sim.mjs` | **B:** kvotmätningen mot emulatorn (§9) |
| `test/live-meteorstorm-server.test.js`, `test/functions-meteorstorm*.test.mjs`, `test/firestore-rules-live-meteorstorm.test.js` | **B:** servertesterna |
| `test/*-meteorstorm-fusk.test.*`, `test/live-meteorstorm-klient-fusk.test.js` | **B:** testarens fusk-/race-sviter (F1–F8 rättade i rättningsrunda 1) |

`delat/` är ren: ingen DOM, ingen Firebase, ingen `Math.random`/`Date.now`,
bara importer inom `delat/` (testat). Inget format registreras i del A –
bootgrafen är orörd.

---

## 2. Motorn

```js
import { simulera } from "./delat/ms-motor.js";
simulera({ seed, startMs, varaktighetMs, stationer, handlingar, installningar }, tMs)
```

| Indata | |
| --- | --- |
| `seed` | sessionens `msSeed` (tal eller sträng) |
| `startMs` | serverns tid när stormen börjar |
| `varaktighetMs` | speltiden (5–20 min) |
| `stationer` | `[{ classId, aktiva }]` – 1–4 stationer. `aktiva` = antal aktiva elever, **fast för matchen** (B sätter det vid start och sparar det; alla projektorer och `msAvsluta` måste använda samma tal) |
| `handlingar` | `[{ id, t, classId, uid?, typ: "skold"\|"laser"\|"drag"\|"spara", mal? }]` – en per **utförd** handling, `t` = serverns tidsstämpel. Samma `t` ordnas på `id`. `mal` (valfritt) = classId för dragstrålens mål vid 3–4 stationer |
| `installningar` | `{ lage: "en-klass"\|"klass-mot-klass", attacker: "av"\|"milda"\|"vilda" }` |

**Steg:** fasta 100 ms. Steg *n* tillämpar handlingar med `t < startMs + n·100`,
släpper meteorer, låter dragstrålar fånga, avfyrar lasrar, slår ner meteorer och
räknar om hjälpen – i den ordningen. `simulera(…, tMs)` = tillståndet efter steg
`floor((tMs − startMs)/100)`; meteorernas `pos` räknas för exakt `tMs` (mjuk
rendering).

**Utdata:** `{ tMs, speltidMs, kvarMs, klart, stationer, meteorer, handelser, logg, bidrag, resultat? }`

- `stationer[i]`: `classId, aktiva, skrov, skold, laddning, skott, nedskjutna, traffar, skadaTagen, hjalp, flyter, nollVidMs, handlingar {skold, laser, drag}, kastade, drag { tillaten, kostnad, armerad, redoMs }`
- `meteorer[]`: `id, mal, pos (0–1), storlek, hp, bana (0–1, var längs kanten den kommer), spawnMs, ankomstMs, kastadAv?, jatte?`
- `handelser`: pågående händelse (högst en) `{ id, typ, startMs, slutMs }`
- `logg`: allt som hänt, äldst först (frysta poster): `handelse`, `kast` (`classId, mot, uid, storlek`), `nedskjuten` (`classId, uid, storlek, fran?, jatte?`), `traff`/`skold` (`skold, skrov` = skada på var), `flyter`, `noll`, `hjalp`, `hjalp-slut`
- `bidrag[uid]`: `skold, laser, drag, nedskjutna, kast` – underlag för "Du sköt ner 7 meteorer" och "bästa ögonblick". Ett laserskott tillskrivs eleven som bidragit mest till just det skottet (laddningen är en kö)
- `resultat` (när `klart`): se §3.7

**Billig varje bildruta (Elias 2026-10-21):** projektorn ritar `nu − RENDER_FORDROJNING_MS`
(1500 ms). `simulera` återanvänder en motor per frö/klasser/inställningar och
stegar vidare från senaste tid. Bara om loggen ändrats *före* den redan beräknade
tiden spolas den tillbaka till närmaste kontrollpunkt (var 5:e s). En hel match
med 4000 handlingar tar några ms i node. `skapaMotor(cfg)` ger samma motor direkt
(`tillstand(tMs)`, `satHandlingar(lista)`, `laggTill(h)`). Loggen jämförs alltid
i sin helhet, så det går bra att ändra i samma array. Kontrollpunkter som inte
längre stämmer med loggen släpps varje gång (#820 F1). Två handlingar med
samma `t` och `id` ordnas på klass, typ, uid och mål (#820 F2).

**Determinism:** samma indata → identiskt resultat, oavsett ordning på
handlingarna i listan. All räkning sker i heltal (tusendelar), så node och
webbläsare får samma tal. Previewns "Samma frö" och fingeravtrycket
(`hashFro(JSON.stringify(tillstånd))`) visar det. Kontrollerat: samma scenario
gav `9c860574` både i node och i Chromium.

---

## 3. Reglerna (alla tal i `ms-balans.js`)

### 3.1 Stationen
Skrov 100. Sköld 0, tak 60, tar skadan först. Laserladdning tak 10 skott;
laddningen avfyras automatiskt (högst ett skott per 100 ms) mot den inkommande
meteor som landar först, när den kommit 30 % av vägen.

### 3.2 Per elev (formeln)

```
effekt per tryck = KLASSVARV / aktiva
```

`KLASSVARV` = effekten när **varje aktiv elev tryckt en gång**:
`SKOLD_KLASSVARV = 16` sköld, `LASER_KLASSVARV = 1,92` laserskott. En klass på
25 får alltså **+0,64 sköld** eller **+0,077 laserskott** (≈ 13 tryck per skott)
per tryck. En klass på 19 får +0,84 / +0,10. Samma tanke som Klassmatchens
"rätt ÷ nämnare": klassens storlek tar ut sig, andelen rätt avgör.
Dragstrålen skalas inte – den begränsas per station (en i taget + väntetid).

> ⚠️ **Avvikelse från specen (§2.3, §2.3.1):** specen säger "+1 laserskott" och
> "en liten meteor äter ungefär 5 tryck". Med 25 elever som svarar var ~8:e s
> blir det ~1 500 tryck på 10 minuter. Med de talen klarar sig alla klasser
> utan skada, och balansmålen i §2.3.2 går inte att nå. Balansmålen fick gå
> före. Eleven fyller i stället på en **gemensam mätare** (sköld respektive
> laserladdning) en bit per tryck. D visar t.ex. "🛡️ +0,6 – skölden 34/60" och
> "🔫 laddar – 3,4 skott redo".

### 3.3 Stormen
Spegelvänd: varje station får en kopia av varje meteor (id `"<n>.<station>"`).
Storlekar liten 5 / mellan 10 / stor 20 skada (stor = 2 skott). Andelen stora
ökar från 4 % till 15 %. Flygtid 8 s. Intensiteten (meteorer/s per station):

| Andel av speltiden | 0 | 0,45 | 0,55 | 0,90 | 0,94–1,0 |
| --- | --- | --- | --- | --- | --- |
| Meteorer/s | 0,05 | 0,062 | 0,055 | 0,055 | 0,72 |

Det blir en lugn storm med en liten topp strax före mitten, ett andrum och en
**kort, hård final** de sista ~35 s. Varför formen ser ut så: en klass som
nästan inte svarar ska gå under vid ungefär halva tiden. Det låser stormen
under första halvan till ~0,35 skada/s. Samtidigt är en full sköld plus full
laddning värd ~145 skada, så skillnaden mellan klasserna måste avgöras i en
kort final. En lång topp utjämnar inte; den släcker alla svagare klasser.
Meteorerna kommer med jämn takt, lite slump i avståndet och jämn tur mellan
storlekarna. Då blir två frön nästan lika svåra.

### 3.4 Händelser
Ur en blandad "påse" med alla fyra, högst en i taget, start→start 70–110 s
(~5 per 10 min). Ingen jättemeteor före 2,5 min. Inga händelser efter 78 % av
speltiden: en händelse precis före finalen avgjorde annars matchen.

| Händelse | Effekt | Var |
| --- | --- | --- |
| ☀️ Solstorm | energi ×2 i 20 s | `energiEffekt` (servern) |
| ☄️ Jättemeteor | mot alla stationer, 20 s nedräkning (= flygtid), 6 skott, annars 30 skada; kan inte fångas av dragstrålen | motorn |
| ✨ Kometsvans | +1 energi per rätt svar i 10 s | `energiEffekt` |
| 🌌 Lugnet | inga nya meteorer i 15 s | stormplanen |

### 3.5 Dragstrålen
Bara i Klass mot klass och inte med Attacker av. Milda: kostar 3, väntetid 10 s.
Vilda: kostar 2, väntetid 6 s, och den slungade meteoren blir en storlek
större. Strålen fångar den stormmeteor på väg mot den egna stationen som landar
först, och slungar den mot målet (6 s flygtid). Målet är `mal`, eller annars
den andra stationen med mest skrov som inte flyter. Är ingen meteor på väg
väntar strålen (**armerad**) och tar nästa. Under tiden kan stationen inte dra
igen. Slungade meteorer och jättemeteorer kan inte fångas (ingen ping-pong).
De sista 6 s går dragstrålen inte att använda (`DRAG_STOPP_FORE_SLUT_MS`), så
att den slungade meteoren hinner fram. Mottagaren kan skjuta ner den.

### 3.6 Hjälp till den som ligger efter
I Klass mot klass: en station med minst 20 skrov mindre än den bästa andra får
dragstrålen för 2 (Vilda är redan 2) och +25 % sköld per tryck. Hjälpen slås av
direkt när skillnaden är mindre än 20. Loggen får `hjalp`/`hjalp-slut`, som C
visar som "🚀 4D får extra kraft!".

### 3.7 Slutet
Klass mot klass: mest skrov vinner (alla börjar på 100, så det är detsamma som
andel). Lika skrov → flest nedskjutna; lika igen → oavgjort. `placering` delar
plats vid lika. En klass: ⭐ med skrov kvar, ⭐⭐ ≥ 50, ⭐⭐⭐ ≥ 80. En station
på 0 **flyter**: den tar ingen mer skada men skjuter och drar som vanligt.

```
resultat = { lage, vinnare: classId|null, oavgjort, placering: [{ classId, skrov, nedskjutna, plats }],
             stjarnor?, overlevde? }   // stjarnor/overlevde i En klass
```

### 3.8 Skadenivåer (C ritar)
`skadeniva(skrov)`: `hel` (>75), `repor` (>50), `sprickor` (>25), `rok` (>0),
`flyter` (0). Previewns skrovreglage visar dem.

---

## 4. För servern (B) – A:s anvisningar (genomfört i §7–§9)

- **Energin räknas på servern** (1 per rätt, tak 5). `energiEffekt(cfg, t)`
  ger `{ faktor, bonus, energi, handelse }` för ett rätt svar vid `t`. Fel svar
  påverkar inte spelet.
- **`kanAgera(input, t, classId, typ)`** → `{ ok, kostnad, orsak? }`. Orsaker:
  `tid` (före start, efter slut, eller drag de sista 6 s), `klass`, `typ`,
  `av`, `armerad` (en dragstråle redan på väg, också inom samma 100 ms),
  `vantetid` (med `redoMs`). `input.handlingar` = alla redan utförda
  handlingar. Kör det i **samma transaktion** som skriver `msEvents`, annars
  kan två drag samtidigt båda godkännas. Motorn ignorerar då den andra, men
  energin är redan dragen. Dragstrålens kostnad (3/2, hjälp) kommer ur
  `kanAgera`.
- Hopslagna anrop: en handling i loggen är `{ id, t, classId, uid, typ }` med
  serverns tid. `typ: "spara"` får gärna loggas men påverkar inte stormen.
- **`msAvsluta`**: `simulera({ …, handlingar: hela loggen }, startMs + varaktighetMs).resultat`.
- `functions/meteorstorm/` är en kopia – importera därifrån (`./meteorstorm/ms-motor.js`).

## 5. För projektorn (C)

Rita `simulera(input, Date.now() + klockkorrigering − RENDER_FORDROJNING_MS)`
varje bildruta. Använd `pos`/`bana` för meteorerna, `logg` för flödet och
banderollerna, `handelser[0]` för banderollen och nedräkningen,
`skadeniva(skrov)` för stationens utseende och `bidrag` för "bästa ögonblick".
Inget ritas om fel svar, för motorn ser dem aldrig.

---

## 6. Balansen (spec §2.3.2)

Simulerade klasser med 25 elever, där varje elev svarar en fråga per ~8 s
(±25 %). Strategierna:

| Strategi | Vad klassen gör |
| --- | --- |
| **blandar** | slumpar 🛡️/🔫, väljer det andra när en mätare är full och sparar energin när båda är fulla |
| **naiv** | som blandar, men drar i dragstrålen så fort den kan |
| **smart** | som naiv, men väntar in en större meteor och laddar lasern mot slungade meteorer och jättemeteorer |

"Nästan inget" = 5 % rätt. Kör: `node admin/ms-balans-sim.mjs` (200 frön,
`--n 50` snabbare, `--md` markdown, `--kmk` bara Klass mot klass).

**En klass, 25 elever, en fråga per ~8 s, 10 min, 200 frön:**

| Klass | Mål | Skrov (medel) | Skrov p10–p90 | Skrov 0 (antal, median) | Stjärnor 0/1/2/3 |
| --- | --- | --- | --- | --- | --- |
| 80 % rätt, blandar | 70–90 (⭐⭐⭐) | 84 | 67–100 | – | 0 / 1 / 75 / 124 |
| 60 % rätt, blandar | 45–65 (⭐⭐) | 66 | 47–88 | – | 0 / 26 / 142 / 32 |
| 40 % rätt, blandar | 10–30 (⭐) | 17 | 0–40 | 60/200, median 596 s | 60 / 131 / 9 / 0 |
| Nästan inget (5 % rätt) | 0 vid ~halva tiden | 0 | 0–0 | 200/200, median 309 s | 200 / 0 / 0 / 0 |
| 80 % rätt, bara sköld | sämre än blandar | 15 | 0–31 | 21/200, median 599 s | 21 / 179 / 0 / 0 |
| 80 % rätt, bara laser | sämre än blandar | 24 | 5–45 | 12/200, median 600 s | 12 / 179 / 9 / 0 |
| 60 % rätt, 19 elever | ≈ 60 % med 25 | 65 | 48–84 | – | 0 / 27 / 144 / 29 |

**Klass mot klass, 25 + 25 elever, 200 frön:**

| Match | Mål | A vinner | B vinner | Oavgjort | Skrov A / B |
| --- | --- | --- | --- | --- | --- |
| 60 % smart mot 70 % naiv (milda) | 60 % vinner ≥ 25 % | 32 % | 68 % | 0 % | 55 / 66 |
| 60 % smart mot 70 % naiv (vilda) | 60 % vinner ≥ 25 % | 31 % | 69 % | 0 % | 24 / 40 |
| 60 % smart mot 70 % smart (milda) | 70 % vinner oftast | 33 % | 67 % | 0 % | 55 / 65 |
| 60 % smart mot 70 % smart (vilda) | 70 % vinner oftast | 35 % | 65 % | 0 % | 24 / 38 |
| 60 % naiv mot 70 % naiv (milda) | 70 % vinner oftast | 30 % | 71 % | 0 % | 55 / 66 |
| 60 % naiv mot 70 % naiv (vilda) | 70 % vinner oftast | 30 % | 70 % | 0 % | 26 / 41 |
| 60 % blandar mot 70 % blandar (milda) | 70 % vinner oftast | 16 % | 84 % | 1 % | 66 / 76 |
| 60 % blandar mot 70 % blandar (vilda) | 70 % vinner oftast | 16 % | 84 % | 1 % | 66 / 76 |
| 60 % smart mot 70 % blandar (milda) | – | 100 % | 0 % | 0 % | 95 / 27 |
| 60 % smart mot 70 % blandar (vilda) | – | 100 % | 0 % | 0 % | 99 / 0 |

**Läsning:**

- Alla fyra En klass-mål nås i medel. 60 % ligger i övre kanten (66 mot 45–65).
- 40 % överlever i 70 % av matcherna. De övriga 30 % går under de sista
  sekunderna, och spridningen är stor (p10–p90 = 0–40).
- Att blanda slår ren sköld och ren laser tydligt.
- Per elev håller: 19 och 25 elever ger samma utfall.
- I Klass mot klass vinner 60 % mot 70 % i ~31–35 % av matcherna, så målet
  ≥ 25 % nås. **Balansfråga till Elias:** målet nås även när båda spelar
  **naivt** (30 %), och "smart" ger bara ~+2 procentenheter. Upsetchansen kommer
  alltså från att dragstrålen gör matchen slumpigare (16 % utan dragstråle),
  inte från smart spel. Ska smart spel löna sig mer behöver dragstrålen ett
  tydligare "rätt tillfälle", t.ex. att bara mellan/stora går att fånga.
- **Dragstrålen är mycket stark mot en klass som aldrig använder den:** 60 % som
  drar vinner alltid mot 70 % som inte drar. Den byter skada åt båda håll, och
  med en gles storm är var tredje meteor en möjlig fångst. Det är en fråga för
  Elias: ska den vara så avgörande? Spakar i `ms-balans.js`: `ATTACKER.milda`
  (kostnad, väntetid) eller en kortare `KAST_FLYGTID_MS`.
- **Vilda** gör matcherna tuffa (skrov ~25/40 kvar), som tänkt.
- Mitten av matchen är lugn (en meteor per ~18 s och station). C kan göra den
  levande med ofarliga effekter. Fler riktiga meteorer går inte utan att målet
  "nästan inget → slut vid halva tiden" flyttas.

---

## 7. Servern (B, #821) – anropen

Elias 2026-10-21 (gäller före specen): **svar och handling i ETT anrop**, fel
svar buffras i klienten, totalerna räknas i `msAvsluta`, `msPublic/status`
skrivs bara av servern. Alla callables i `europe-west1`
(`functions/index.js`, `MS_OPTS`: 512 MiB, concurrency 80, högst 4 instanser).
Fel = HttpsError med svenskt meddelande (`details.vantaMs` vid spärren).

### 7.1 `msAgera({ sid, attemptId, svar, typ, mal?, fel?, nr? })`

| Fält | |
| --- | --- |
| `svar` | Multiplikation `{ k, factorA, factorB, answer, choiceIndex? }`. Quiz `{ k, q, choiceIndex }` eller `{ k, q, year }` (tidslinje). `k` = elevens fråga nr k ur kortleken (§7.1 "Frågorna") |
| `typ` | `"skold" \| "laser" \| "drag" \| "spara"` – valet efter det rätta svaret |
| `mal` | dragstrålens mål (classId) vid 3–4 stationer; annars väljer motorn |
| `fel` | de buffrade fel svaren sedan förra anropet (högst `MS_FEL_TAK` = 40), samma form som `svar` + `attemptId`. **Varje k mellan förra länkens k och svarets måste finnas här** |
| `nr` | elevens nästa länk i kedjan (förra svarets `nr` + 1). Saknas/fel → servern letar upp den |

**Rätt svar** → EN händelse `msEvents/{uid}_{nr}` (en skrivning):
`{ uid, classId, namn, t, typ, nr, attemptId, k, kRum, energi, vinst, kostnad, handelse,
mal?, onskad?, nekad?, redoMs?, svar, fel[], at }`. `t` = serverns tid
(motorns tidsstämpel), `at` = commit-tiden. `energi` = elevens energi EFTER
handlingen – händelserna är en kedja per elev, och nästa anrop läser bara
föregående länk i transaktionen (ingen msPlayers-skrivning per svar).
Svaret: `{ correct: true, nr, typ, energi, vinst, kostnad, handelse, effekt,
onskad?, nekad?, redoMs?, k?, igen?, status }` – `effekt` = motorns
`effektPerTryck` för valet (D: "🛡️ +0,6"), `status` = stationerna (§8.3).
Kvittensen "💥 Din laser sprängde en meteor!" avgörs först när motorn kommit
dit – D kan läsa elevens `bidrag` i slutet eller visa effekten direkt.

**Nekad handling** (`kanAgera` säger nej: `tid`, `av`, `armerad`, `vantetid`
med `redoMs`; eller `energi` = för lite energi) → händelsen sparas som
`typ: "spara"` med `onskad`/`nekad`. Energin från svaret går aldrig förlorad.

**Fel svar** (servern rättar om) → `{ correct: false, correctAnswer, correctYear?, k }`
och **ingen skrivning**. Klienten buffrar det.

**Utan svar** – `msAgera({ sid, fel, nr? })`, bara felbufferten:
- *under matchen* bara en hel buffert: minst `MS_FEL_SKICKA` (25) fel svar i
  följd från förra länkens k → EN länk `msEvents/{uid}_{nr}` med `typ: "fel"`
  (ingen handling: motorn och projektorn hoppar över den; energin oförändrad,
  spärren `MS_MIN_GAP_MS` gäller). Färre nekas – de följer med nästa rätta svar.
  Spärren bor i kedjan, inte i minnet, så flera instanser ger ändå EN skrivning
  per buffert (#821 F3).
- *efter slutet* (till `MS_EFTER_SLUT_MS` = 60 s) EN gång per elev →
  `msPlayers/{uid}.fel` (högst `MS_FEL_TAK` poster; en andra gång → `already-exists`, #821 F5).

**Frågorna** (#821 F1/F2) – varje svar bär `k`, elevens fråga nr k:
- Multiplikationen: faktorerna ur elevens egen påse `multFor(msSeed, uid, k)`
  (`delat/ms-anrop.js`: `src/mult/generator.js`-påsen med fröets PRNG – varje
  kombination 0–10 i varje påse, ×0/×1 en gång och övriga två, aldrig samma
  fråga eller spegeln två gånger i rad). Andra faktorer → `failed-precondition`
  – ingen kan svara 0 × 0 om och om igen.
- Quiz: `fragaFor(msSeed, uid, k, n)` – en blandad kortlek per varv.
- `k` måste ligga efter förra länkens k och högst `MS_K_FONSTER` (41) före den,
  och varje k däremellan måste vara ett fel svar i `fel[]`. Annars
  `failed-precondition` med `details.omsynk` (klienten frågar `msLage` och
  börjar om efter senaste länken). Ett k före länken med samma `attemptId` är
  ett omförsök → samma svar (`igen`, #821 F4); med nytt id nekas det.
- **Takten** (#821 N2/N3): högst en fråga per `MS_K_TAKT_MS` (1,5 s) i längden.
  Länken bär en "hink" `kRum` som fylls med en fråga per 1,5 s upp till
  `MS_K_RUM` (41 – en hel felbuffert ryms alltid) och töms med k-steget (svaret
  + de överhoppade). Elevens första länk börjar på
  `min(41, tid sedan start / 1,5 s + MS_K_START)`. Tom hink →
  `resource-exhausted` med `details.vantaMs`. En snabb elev (ett svar varannan
  sekund) märker den aldrig; ett skript som räknar ut `multFor` (koden är
  publik) kommer inte förbi en snabb människas takt – men ~5× en snittelev (8 s)
  går fortfarande (testat i `functions-meteorstorm-fusk-2`). En fel-länk kräver
  dessutom `MS_FEL_LANK_MS` (25 s) sedan förra länken.

**Spärrar och säkerhet**
- Energin: 1 per rätt (Solstorm ×2, Kometsvans +1 via `energiEffekt`), tak 5
  efter handlingen. Ett tryck kostar det man just fick, dragstrålen 3/2.
- `MS_MIN_GAP_MS` (1 s) mellan två handlingar per elev → `resource-exhausted`
  med `details.vantaMs` (klienten väntar och försöker en gång till).
- Idempotens: samma `attemptId` igen → samma svar (`igen: true`), ingen ny händelse –
  också efter senare handlingar (#821 F4: k före länken slås upp på `attemptId`).
- Två anrop samtidigt från samma elev krockar på länken – en vinner.
- **Dragstrålen:** `kanAgera` körs i SAMMA transaktion som händelsen skrivs,
  mot serverns logg + stationens lås `msLas/{classId}` (senaste dragstrålen)
  som transaktionen läser och skriver. Två dragstrålar samtidigt från samma
  station → den andra ser den första och nekas (`armerad`).
- Bara deltagare (`players/{uid}` i en av sessionens klasser), bara under
  matchen (`t0 ≤ nu < slut`, status `live`).
- Ett `k` som rättats fel (msRatta eller bufferten) kan inte tas tillbaka som rätt.

### 7.2 `msRatta({ sid, svar: { k, q, choiceIndex | year }, nr? })` – bara quiz

Klienten kan inte rätta quiz (facit är lärarskyddat), så eleven frågar servern
först – **utan skrivning**. → `{ correct, correctAnswer, correctYear?, k, nastaQ }`.
Rätt → eleven väljer handling och skickar `msAgera` med samma `svar` (servern
rättar igen). Samma `k` rättas bara en gång per instans (minnet): första
beskedet gäller, så ingen kan pröva sig fram. `k` måste ligga efter elevens
senaste länk och högst `MS_K_FONSTER` före den (#821 F2 – inget facit för
frågor långt fram); länken hålls i instansens minne (läses en gång: länk `nr`
och koll att `nr + 1` saknas). ⚠️ Med flera instanser (högst 4) kan en elev som
skriver egna anrop i sällsynta fall få pröva samma `k` en gång per instans –
priset för att fel svar aldrig skrivs.

### 7.3 `msLage({ sid })` → `{ nr, energi, k, status }`

Elevens läge efter en omladdning: EN läsning (#821 N4 – frågan `uid ==` +
`orderBy(nr desc) limit 1`, sammansatt index `msEvents (uid ↑, nr ↓)` i
`firestore.indexes.json`). Samma uppslag när klientens `nr` inte stämmer.

### 7.4 `msAvsluta({ sid })` → `{ result, redan }`

Läraren (admin, eller årskurskonto med en av klasserna) när som helst – en
pågående storm avslutas då (`status: "finished"`, `finishedAt`). En deltagare
först efter slutet (status `finished` eller tiden ute), så resultatet kommer
även om projektorn stängts. Väntar `MS_AVSLUTA_VANTA_MS` (4 s) efter slutet på
de sista felbuffrarna, läser HELA loggen och kör `simulera` fram till slutet
(lärarens avslut eller ordinarie slut – händelser efter det räknas inte).
Skriver i EN transaktion: `result` (en gång), `msStationer` om det saknas,
`msPlayers/{uid}`-totalerna (utan merge – slutbufferten `fel` är inräknad och
försvinner, #821 F5) och sista `msPublic/status` (`klart`, `resultat`).
Idempotent: finns `result` → `{ result, redan: true }`.

**C/D:** formatets `resultInputs`/projektorn anropar `avsluta(sid)` när tiden
är ute; kärnans `writeResultIfMissing` nekas för formatet (reglerna) och ser
sedan att `result` finns.

### 7.5 Klienten (`ms-klient.js`, via `meteorstorm-data.js` `skapaKlient`)

```js
const k = skapaKlient({ sid, uid, seed: s.msSeed, gameMode: s.gameMode, antalFragor });
const fragor = s.gameMode === "multiplication_0_10" ? { ...mode, createSource: k.kalla } : mode;
flow = createQuestionFlow(host, { mode: fragor, answerKind, send: k.svara, onCorrect: visaKnapparna, … });
flow.setNextQ(k.fraga());               // quiz: elevens första fråga ur kortleken
const r = await k.agera("laser");       // eller "skold" | "drag" | "spara" (mal valfritt)
await k.skickaFel();                    // när matchen tar slut
```

`kalla()` delar ut multiplikationens frågor ur elevens påse (`multFor`) – en
obesvarad fråga visas igen i stället för att hoppas över (annars saknas dess k).
`svara` rättar multiplikationen själv (fel → bufferten, inget anrop), frågar
`msRatta` vid quiz, och håller ett rätt svar väntande tills `agera`. Bufferten,
`nr`, energin och `k` sparas i `sessionStorage` (omladdning). Ett nätfel låter
svaret och bufferten ligga kvar – samma `agera` igen ger samma `attemptId`.
Bufferten töms på `attemptId` (inte de första N), så ett fel-anrop som korsar
ett `agera` tappar inget (#821 F7). `details.omsynk` → `lage()` och börja om.
**D anropar `lage()` när elevskärmen monteras.** `lage()` sätter nästa k =
serverns senaste k + 1 och behåller bara den del av bufferten som är en obruten
följd därifrån – ett rätt svar som väntade på handling när sidan laddades om
delas då ut igen i stället för att bli ett hål (#821 N1).
Status: `skapaStatusvakt(sid, cb)` – `vakt.fran(r.status)` efter varje svar,
och bara när inget kommit på 20 s en läsning av `msPublic/status`.

---

## 8. Datamodellen (B, #821)

### 8.1 Sessionen `liveSessions/{sid}` (regelgrenen "Meteorstormen")

Kärnans fält (som kistformaten) + `msSeed` (heltal 0–2³¹−1),
`msInstallningar: { lage: "en-klass"|"klass-mot-klass", attacker: "av"|"milda"|"vilda" }`
(En klass = exakt 1 klass, Klass mot klass = 2–4), `showNames?`, `quiz`,
`questionCount`, `rewards`. Speltid 5–20 hela minuter. Låst efter skapandet.
**Bara servern** skriver `msStationer` och `result`:

- `msStationer: [{ classId, aktiva }]` – antal elever per klass som gått med
  (`players.joinedAt`) senast när stormen började (`t0`), minst 1. Sätts EN gång
  vid första handlingen (eller i `msAvsluta`); alla projektorer och
  `msAvsluta` använder samma tal (motorns `stationer`). Saknas fältet har ingen
  handlat än – projektorn kan rita med `aktiva: 1` (inga handlingar = ingen skillnad).
- Motorns indata: `{ seed: msSeed, startMs: startedAt + countdownSeconds,
  varaktighetMs: durationSeconds·1000, stationer: msStationer, installningar: msInstallningar }`.

### 8.2 Underdokumenten

| Dokument | Vem skriver | Vem läser | Innehåll |
| --- | --- | --- | --- |
| `msEvents/{uid}_{nr}` | servern (`msAgera`) | lärare/projektor | en per rätt svar (§7.1) – motorns `handlingar` = `{ id, t, classId, uid, typ, mal? }`. **`typ: "fel"`** = bara en felbuffert (ingen handling) – C hoppar över den |
| `msPlayers/{uid}` | servern | eleven själv, lärare | `fel[]` (slutbufferten, en gång, ≤ 40); efter `msAvsluta` ersatt av: `correct, incorrect, handlingar{skold,laser,drag,spara}, nekade, bidrag{skold,laser,drag,nedskjutna,kast}, energi, klar` |
| `msPublic/status` | servern | deltagare, lärare | §8.3 |
| `msPublic/questions` | läraren i lobbyn (quiz) | deltagare | `{ questions }` utan facit |
| `msPrivate/snapshot` | läraren i lobbyn (quiz) | lärare | `{ facit }` |
| `msLas/{classId}` | servern | ingen klient | stationens senaste dragstråle `{ id, t, uid, mal? }` |

Eleverna lyssnar **inte** på `msEvents` (reglerna nekar). Projektorerna lyssnar
på `msEvents` (`watchEvents`, sorterat på `t`).

### 8.3 `msPublic/status`

`{ tMs, visarMs, kvarMs, klart, handelse: { typ, slutMs } | null,
stationer: [{ classId, skrov, skold, laddning, skott, nedskjutna, flyter, hjalp,
drag: { tillaten, kostnad, armerad, redoMs } }], resultat?, uppdaterad }` –
motorn på servern vid `nu − RENDER_FORDROJNING_MS` (samma bild som projektorn).
Skrivs högst var `MS_STATUS_MS` (10 s) per session: i `msAgera` (minnet per
instans + statusdokumentets `tMs` i en transaktion mellan instanserna) och i
`msAvsluta` (`klart: true`, `resultat`). Samma objekt följer med varje
`msAgera`-svar (ur serverns logg i minnet).

### 8.4 `result` (msAvsluta, `functions/meteorstorm-resultat.js`)

```
{ format: "meteorstorm", lage, winner: classId|null, draw, placering: [{ classId, skrov, nedskjutna, plats }],
  stjarnor?, overlevde?, startMs, slutMs, players, totalCorrect, totalAnswered,
  handlingar: { skold, laser, drag, spara }, nekade,
  perClass: { classId: { name, players, aktiva, skrov, skold, nedskjutna, traffar, kastade,
                         handlingar, correct, answered, ogonblick[] } },
  ranking: [{ uid, name, classId, correct, answered, handlingar, bidrag, rank }],
  perQuestion: [{ index, key, text, answered, correct, statKeys, byClass }],   // som kistspelets
  rewards?: { uid: { rank, correct, prize, correctCoins, total } }, computedAt }
```

- `ogonblick` (C:s slutruta, bara det som är bra): `{ typ: "nedskjutna", uid, namn, antal }`
  (flest nedskjutna), `{ typ: "sista", uid, namn, t }` (sista sköld/laser de sista
  30 s – bara om stationen klarade sig), `{ typ: "skold" | "kast", uid, namn, antal }`.
- `correct` = elevens händelser (varje rätt svar), `answered` = + fel svar
  (händelsernas `fel[]` + slutbufferten, dubbletter på `attemptId` en gång).
- **Pluggmynten** (LIVE-FORMAT §6): servern räknar `result.rewards`
  (`functions/meteorstorm-mynt.js` = samma tal som `live-rewards.js`, testat).
  Placeringspris per klass: klassens `plats` → `round(förstapris × 0,85^(plats−1))`
  till varje elev som svarat. En klass: plats = 4 − stjärnor (⭐⭐⭐ = förstapriset,
  0 ⭐ = plats 4). Mynt per rätt svar som i övriga format. **Utbetalningen** sker i
  klienten som i övriga format (`settleLiveRewards` / historikens `settle`, kvittot
  `coinReceipts/{uid}`) – D kopplar in den, eftersom `writeResultIfMissing` inte
  skriver `result` här. Reglerna (`liveCoinPlayerOk`) kräver rätt-mynt ≤
  `perCorrect × msPlayers.correct` (bara servern skriver det).

---

## 9. Kvoten (B, #821) – uppmätt i emulatorn

`admin/ms-kvot-sim.mjs` kör en hel match mot serverkärnan (samma kod som
Cloud Functions) med elevklienten (`ms-klient.js`) och styrd klocka i
Firestore-emulatorn. Serverns anrop räknas (en läsning per dokument, minst en
per fråga – som Firestores debitering), projektorernas lyssnare på `msEvents`
och sessionen är riktiga `onSnapshot`, elevskärmarna läser status som
`skapaStatusvakt`. Kärnans egna dokument (närvaropuls, lobby, kvitton) är
desamma i alla format och räknas inte.

```
FIRESTORE_EMULATOR_HOST=127.0.0.1:PORT node admin/ms-kvot-sim.mjs --md
  (--elever 25 --klasser 2 --min 10 --takt 8 --ratt 0.7,0.6 --projektorer 2 --instanser 1 --quiz --status 20)
```

**2 klasser × 25 elever, 10 min, ett svar per ~8 s (±25 %), 70 % / 60 % rätt,
2 projektorer, Klass mot klass / Milda** (rättningsrunda 1, statusvakten 20 s).
"4 instanser" = varje anrop till en slumpad av fyra instanser (värsta fallet;
concurrency 80 håller normalt en match på en instans).

| | Multiplikation, 1 instans | Multiplikation, 4 instanser | Quiz, 1 instans |
| --- | --- | --- | --- |
| Rätta svar (= händelser) / fel svar | 2 299 / 1 237 | 2 305 / 1 236 | 2 299 / 1 237 |
| **Skrivningar totalt** | **2 463** | **2 465** | **2 463** |
| Projektorerna: `msEvents` (2 × händelserna¹) | 4 598 | 4 610 | 4 598 |
| Projektorerna: sessionen | 8 | 8 | 8 |
| Elevskärmarna: `msPublic/status` (efter 20 s utan svar) | 350 | 395 | 350 |
| Elevskärmarna: sessionen + eget `msPlayers` | 300 | 300 | 300 |
| Skärmarna: `msPublic/questions` (en gång var) | – | – | 52 |
| **Klienternas läsningar** | **≈ 5 260** | **≈ 5 310** | **≈ 5 310** |
| **Serverns läsningar** | **7 574** | **15 097** | **7 627** |
| Läsningar totalt | ≈ 12 830 | ≈ 20 410 | ≈ 12 940 |

¹ Varje händelse läses en gång per projektor; lyssnarna i simuleringen hann
inte helt ikapp före stopp (mätt 4 370–4 394), så tabellen räknar 2 × händelserna.

Serverns läsningar (1 instans): föregående länk i kedjan 2 249 (en per rätt
svar – energin, spärren och k-ordningen utan skrivning), loggen 2 299 (en gång
per instans, sedan bara nya händelser på commit-tiden `at`), hela loggen i
`msAvsluta` 2 299, sessionen 122 (minnet 5 s), övrigt ~600. Med 4 instanser
läses loggen och sessionen en gång per instans → ~15 000.

- **Skrivningar ≈ 2 460** – inom målet 2 200–2 500 (tak 3 000). En skrivning per
  rätt svar; fel svar skrivs aldrig (de följer med nästa händelse, en hel
  buffert på 25 blir en länk). Rättningsrunda 1 (F3): ingen kan längre skriva
  mer än en länk per sekund och elev – samma gräns som för rätta svar.
- **Klienternas läsningar ≈ 5 300 < 6 000** – marginal ~700 sedan statusvakten
  gick från 12 s till 20 s (rättningsrunda 1, F6: −750 läsningar; en elev som
  svarar får status i varje svar, så bara elever som står still läser). Varje
  extra projektor kostar ~2 300.
- **Serverns läsningar 7 600–15 100 tillkommer** (Firestore debiterar dem också).
  Totalt ≈ 13 000–20 000 per match (≈ 0,01 USD; gratisnivån 50 000 läsningar per dag).
- Sessionsdokumentet läses av alla skärmar vid varje ändring – servern skriver
  det bara 3 gånger (`msStationer`, `finished`, `result`).

> ❓ **Fråga till Elias (kvoten):** målet "läsningar < 6 000" nås för
> klienternas läsningar (specens räkning: projektorerna på `msEvents` +
> elevskärmarna), men inte om serverns läsningar räknas in (7 600 med en
> instans, upp till 15 000 med fyra). Räcker det med klienterna? Annars
> finns två spakar: (1) `msAvsluta` räknar ur instansens logg i minnet i
> stället för att läsa om hela loggen (−2 300, men resultatet hänger då på att
> minnet är komplett), (2) `maxInstances: 1` (minnet alltid varmt – men taket blir
> 80 samtidiga anrop för alla stormar på en gång).

---

## 10. Deploy

Del A deployar ingenting själv. Från B (#821), i den här ordningen:

0. **`firebase deploy --only firestore:indexes`** – `msEvents (uid ↑, nr ↓)` (#821 N4,
   `msLage` och omsynk). Bygget tar några minuter – vänta tills det är klart.
1. **`firebase deploy --only firestore:rules`** – regelgrenen "Meteorstormen"
   (msFormat, ms-samlingarna, kvittot mot `msPlayers`). Utan den nekas varje
   Meteorstorm-session; den rör inga andra format.
2. **`firebase deploy --only functions:msAgera,functions:msRatta,functions:msLage,functions:msAvsluta`**
   – predeploy synkar `delat/` → `functions/meteorstorm/` (`npm run sync:meteorstorm`).
3. **Webben** (C/D registrerar formatet – först då syns det för lärarna).

Övriga frågor är enkelfälts (`t`, `at`, `uid` + `attemptId`).
