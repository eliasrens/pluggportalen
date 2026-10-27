# Meteorstormen ☄️ – motorn, reglerna och balansen

Meteorstormen är ett Live-format (`format: "meteorstorm"`, epic #819). Klasser
försvarar var sin rymdstation mot en **förutbestämd** meteorstorm; rätt svar ger
energi som eleven lägger på 🛡️ sköld, 🔫 laser eller 🌀 dragstråle. Specen:
[`UTVECKLINGSUPPDRAG_METEORSTORMEN.md`](UTVECKLINGSUPPDRAG_METEORSTORMEN.md).
Det här är **formatets kontraktsdokument** – del A (#820) beskriver motorn,
B (#821) servern (§7–§10), C (#822) projektorn (§12), D (#823) elevskärmen och lärarvyerna (§11), E (#824)
musiken, finputsen och checklistan (§13). **Alla öppna frågor till Elias: §14.**

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
| `delat/ms-steg.js`, `delat/ms-utdata.js` | **E:** motorns steg 1–6 och tillståndet ut – utbrutna ur `ms-motor.js` (#824, ingen beteendeändring) |
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
| `ms-format-elev.js` | **D:** formatobjektets elev-, formulär- och historikdelar (`MS_ELEV_DELAR`, sprids in i `index.js`) |
| `ms-setup.js`, `ms-avslut.js` | **D:** lärarformuläret + sessionens fält + quizets ögonblicksbild; resultatet (msAvsluta) + pluggmyntens utbetalning |
| `meteorstorm-student.js` → `ms-elev-vy.js` (+ `ms-elev.js`, `ms-skarmar.js`, `ms-station-mini.js`, `meteorstorm-elev.css`) | **D:** elevskärmen (§11) |
| `meteorstorm-history.js` (+ `meteorstorm-historik.css`) | **D:** historiken + Statistik → Live |
| `ms-elev-demo.js`, `preview/preview-meteorstorm-elev.html`, `preview/preview-meteorstorm-historik.html` | **D:** elevdelen av demoläget (låtsasserver med `delat/`-reglerna + simulerade klasser) |
| `test/live-meteorstorm-elev.test.js` | **D:** formulär, resultat/mynt, elevlogik, slutskärm, historik, demo |

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
(2000 ms, konstant – Elias 2026-10-21; sena händelser: §12.2). `simulera` återanvänder en motor per frö/klasser/inställningar och
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

Genomfört i #822 – se §12.

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
  ≥ 25 % nås. **Balansfråga till Elias (§14.1):** målet nås även när båda spelar
  **naivt** (30 %), och "smart" ger bara ~+2 procentenheter. Upsetchansen kommer
  alltså från att dragstrålen gör matchen slumpigare (16 % utan dragstråle),
  inte från smart spel. Ska smart spel löna sig mer behöver dragstrålen ett
  tydligare "rätt tillfälle", t.ex. att bara mellan/stora går att fånga.
- **Dragstrålen är mycket stark mot en klass som aldrig använder den:** 60 % som
  drar vinner alltid mot 70 % som inte drar. Den byter skada åt båda håll, och
  med en gles storm är var tredje meteor en möjlig fångst. Det är en fråga för
  Elias (§14.2): ska den vara så avgörande? Spakar i `ms-balans.js`: `ATTACKER.milda`
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
  **Rest (testaren omgång 3):** en elev med skript kommer upp i ~441 länkar
  (= skrivningar) på 10 min (41 i hinken + 600 s / 1,5 s), mot ~46 för en
  snittelev. Två sådana elever i samma match ger ~2 463 + 2 × ~395 ≈ 3 250
  skrivningar – över taket 3 000 (se frågan i §9).

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
obesvarad fråga visas igen efter en omladdning i stället för att hoppas över
(annars saknas dess k). Frågar UI:t igen i samma sida efter att frågan redan
visats går eleven vidare (skriv själv hämtar nästa fråga FÖRE svaret på den
förra): den visade frågan väntar på sitt svar och en ny delas ut, och `svara`
hittar frågans k på faktorerna (#822 F2 – förut visades samma fråga igen och
svaret hamnade på nästa k, som servern nekade).
`svara` rättar multiplikationen själv (fel → bufferten, inget anrop), frågar
`msRatta` vid quiz, och håller ett rätt svar väntande tills `agera`. Bufferten,
`nr`, energin och `k` sparas i `sessionStorage` (omladdning). Ett nätfel låter
svaret och bufferten ligga kvar – samma `agera` igen ger samma `attemptId`.
Bufferten töms på `attemptId` (inte de första N), så ett fel-anrop som korsar
ett `agera` tappar inget (#821 F7). `details.omsynk` eller `failed-precondition`
från `msAgera` → `lage()` och börja om (#822 F2: valet släpps, `vantar()` blir
false och elevskärmen visar nästa fråga – ingen fastnar; energin är serverns).
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

> ❓ **Fråga till Elias (kvoten, §14.3):** målet "läsningar < 6 000" nås för
> klienternas läsningar (specens räkning: projektorerna på `msEvents` +
> elevskärmarna), men inte om serverns läsningar räknas in (7 600 med en
> instans, upp till 15 000 med fyra). Räcker det med klienterna? Annars
> finns två spakar: (1) `msAvsluta` räknar ur instansens logg i minnet i
> stället för att läsa om hela loggen (−2 300, men resultatet hänger då på att
> minnet är komplett), (2) `maxInstances: 1` (minnet alltid varmt – men taket blir
> 80 samtidiga anrop för alla stormar på en gång).
>
> ❓ **Fråga till Elias (skrivningar och skript, §14.4):** takten (§7.1, `MS_K_TAKT_MS`
> 1,5 s) håller en elev som skriver egna anrop till en snabb människas takt,
> ~441 skrivningar per 10 min. Två sådana elever i en match tar den över
> 3 000 skrivningar (~3 250). Godtar vi det (kräver att eleven skriver ett
> skript mot callable-API:t), eller ska takten skärpas – t.ex. 2,5 s per fråga
> (~280 per elev), vilket då också bromsar de allra snabbaste ärliga eleverna?

---

## 10. Deploy

Del A deployar ingenting själv. Från B (#821), i den här ordningen:
**firestore:indexes → (vänta på READY) → rules → functions → webb.**

0. **`firebase deploy --only firestore:indexes`** – `msEvents (uid ↑, nr ↓)` (#821 N4,
   `msLage` och omsynk). Indexet måste vara **READY** (Firebase-konsolen →
   Firestore → Index, eller `gcloud firestore indexes composite list`) innan
   functions deployas: utan det misslyckas `senaste()` med `FAILED_PRECONDITION`,
   som eleven ser som "internal" (msLage, och msAgera när klientens `nr` inte
   stämmer). ⚠️ Emulatorn kräver inga sammansatta index – testerna fångar inte
   ett saknat index.
1. **`firebase deploy --only firestore:rules`** – regelgrenen "Meteorstormen"
   (msFormat, ms-samlingarna, kvittot mot `msPlayers`). Utan den nekas varje
   Meteorstorm-session; den rör inga andra format.
2. **`firebase deploy --only functions:msAgera,functions:msRatta,functions:msLage,functions:msAvsluta`**
   – predeploy synkar `delat/` → `functions/meteorstorm/` (`npm run sync:meteorstorm`).
3. **Webben** (C/D registrerar formatet – först då syns det för lärarna).

Övriga frågor är enkelfälts (`t`, `at`, `uid` + `attemptId`).

## 11. Elevskärmen och lärarvyerna (D, #823)

**Lärarformuläret** (`setupFields`, ritas av `live-setup-fields.js`): Läge (En
klass = exakt 1 klass / Klass mot klass = 2), Attacker (Av/Milda/Vilda, standard
Milda – En klass sparas alltid med `av`), speltid 5–20 min (standard 10,
snabbknappar + "Egen tid"), namn i projektorns flöde, pluggmynt. `msSeed` slumpas
i `buildSessionFields` (crypto). Spelläge/svarssätt: multiplikation eller
Plugga-quiz, skriv själv/flerval, tidslinjefrågor (`timelineQuestions`).

**Elevskärmen** (`ms-elev-vy.js`, utan Firebase – `api` injiceras):
- `lage()` när spelet börjar; sedan frågeflödet (`createQuestionFlow`) med
  `ms-klient.js` som `send` (multiplikation: `kalla()` som källa; quiz: `fraga()`).
- Rätt svar → 🛡️ Sköld / 🔫 Laser / 🌀 Dragstråle (kostnad, gråa utan råd,
  nedräkning/"på väg"; ingen dragstråle i En klass eller med Attacker av) +
  "Spara energin". Genvägar 1/2/3 och mellanslag. Svar + val går i ETT
  `msAgera`; nästa fråga först när svaret kommit (klienten har en väntande plats).
- Spärren (`resource-exhausted`): klienten väntar en gång, vyn sedan lugnt upp
  till ~30 s ("⏳ Ett ögonblick …") – ingen felruta.
- Kvittensen ur svaret: "🛡️ +0,6 – skölden 34/60", "🔫 Lasern laddas – 3,4 skott
  redo", "🌀 … slungar den mot 4D!", nekad dragstråle = "energin sparad".
- Hela tiden: ⚡ energi (5 prickar), den egna stationen (skrov + sköld ur
  status), de andras skrov som mätare, klockan, banderollen för pågående
  händelse och "extra kraft"/"flyter". **Händelserna och energins vinst räknas
  ur fröet** (`stormPlan`/`energiEffekt` – samma som servern), utan läsningar;
  stationerna ur `msPublic/status` (svaren + statusvakten var 20:e s).
- Slutet: felbufferten skickas (`skickaFel`); saknas `result` efter 20–35 s
  anropar eleven `msAvsluta` (idempotent). Slutskärmen: "Ni vann! 🚀" / "Bra
  kämpat – 4D vann den här gången" / "Oavgjort" / stjärnorna – **ingen
  placering som nummer** – elevens bidrag och pluggmynten.

**Pluggmynten:** `resultInputs(s)` = `msAvsluta` och sedan
`settleLiveRewards(sid, { ...s, status: "finished", result })` (`ms-avslut.js`
`avslutaOchBetala`). Kärnans `writeResultIfMissing` skriver aldrig `result` här
och betalar därför inte – projektorn (C) anropar aldrig `avsluta` själv: skalets
Avsluta och 00:00 går genom kärnans `resultInputs` = `avslutaOchBetala`. Historiken betalar det som saknas när läraren öppnar matchen.
Klasscentret (#823 F2) som i `live-data.js` (bara admin, aldrig demo):
klasspokalerna och Live-priset till klasskassan (idempotenta) efter varje
`msAvsluta`; klassbonusen (inte idempotent) bara när svaret är `redan: false`
(anropet som skrev `result`). Skrev en elevs anrop `result` (projektorn stängd)
delar historikens `settle(s)` ut pokalerna och priset när en admin öppnar
matchen – bara klassbonusen går då förlorad (§14.6).

**Historiken** (`meteorstorm-history.js`): vinnare/stjärnor, stationerna (skrov,
nedskjutna, träffar, kastade, bästa ögonblicken), handlingar per sort och klass,
eleverna (rätt, svar, andel rätt, 🛡️/🔫/🌀, nedskjutna, pluggmynt – ingen
placeringskolumn), andel rätt per fråga/tabell. Statistik → Live: Rätt · Skrov ·
Utfall + sammanfattning per tabell/kategori.

**Demo/preview:** `preview/preview-meteorstorm-elev.html` (`?fas=live`,
`?lage=en-klass`, `?attacker=av|vilda`, `?svar=choice`, `?quiz=1`, `?status=5`)
och `preview/preview-meteorstorm-historik.html`.

---

## 12. Projektorn (C, #822)

### 12.1 Filerna

| Fil | Innehåll |
| --- | --- |
| `index.js` | Formatobjektet = `{ id, …projektordelarna, ...MS_ELEV_DELAR }` (D:s `ms-format-elev.js`, §11). **C:s del:** namn/ikon/svarssätt/takt, `compatibleGameModes`, `computeStandings` (klasser + anslutna elever), `emitOnPlayers`, `projectorViews`. `music` (E, §13.1) |
| `meteorstorm-projector.js` | Projektorskalets modul: vyn ☄️ Rymden (`finale`), lobbyn, `ownTimer` |
| `msp-senvakt.js` | **Ren**: händelserna → motorns handlingar; en sen händelse verkar "från nu" (§12.2), leveranstiderna |
| `msp-scen.js` | **Ren** logik (node-testad): motorns indata ur sessionen, slutet, `handlingarUr` (hoppar över `typ: "fel"`), renderingsklockan `stegaKlocka`, stationernas platser, meteorernas banor, loggindexet (kast, träffar, flödet), banderollen, besättningens humör, gunget, kosmetisk slump `brus(frö, nyckel)` |
| `msp-rymd.js` | Vyn: DOM, EN `watchEvents`-lyssnare, bildrutsloopen, ljud, `__mspProjektor` (QA) |
| `msp-bild.js` | En bildruta på Canvas 2D – används av vyn, lobbyn och motor-previewn |
| `msp-station.js`, `msp-skold.js`, `msp-besattning.js`, `msp-rita.js` | Stationen + skadenivåerna, sköldbubblan, astronauterna, rymden/meteorerna/explosionerna/fyrverkerierna |
| `msp-hud.js`, `msp-slut.js`, `msp-lobby.js`, `msp-ljud.js` | Textlagret (klocka, banderoll, mätare, flödet), slutrutan, lobbyn, ljuden |
| `msp-demo.js` + `preview/preview-meteorstorm-demo.html` | Demoläget (LIVE-FORMAT §8) |
| `meteorstorm-projektor.css` | Bara `msp-`-klasser |
| `test/live-meteorstorm-projektor.test.js` | 25 tester (se §12.6) |
| `admin/qa-meteorstorm-fps.mjs`, `admin/qa-meteorstorm-tva.mjs`, `admin/qa-meteorstorm-tva-revision.mjs` (testarens skadescenario), `preview/qa-meteorstorm-projektor.html` | Mätningarna i §12.4–12.5 |

Allt laddas latt (`projectorViews()` = `import()`); bootgrafen är 107 filer som förut.

### 12.2 Renderingsbufferten och samma bild på två projektorer

- Vyn ritar motorns tillstånd för `t = deps.now() − RENDER_FORDROJNING_MS`
  (`deps.now()` = `live-clock.js` `serverNow`). Bufferten är **2 000 ms och konstant**
  (Elias 2026-10-21: 1–2 s; `ms-balans.js`, samma tal i serverns `msPublic/status`).
- `stegaKlocka` låter `t` följa målet med verklig tid, rättar mjukt (högst 20 %
  långsammare / 8 % snabbare) och hoppar bara **framåt** (> 2 s efter, t.ex. flik i
  bakgrunden). `t` går aldrig bakåt.
- **En händelse som kommer efter bufferten** (leveransen tog > 2 s – utanför specen)
  ändrar aldrig det som redan visats: `msp-senvakt.js` stämplar om den till "strax
  efter det som visats" och den verkar därifrån – en meteor som redan flugit vidare
  fortsätter, den sena dragstrålen fångar nästa, den sena skölden fyller på från nu.
  Omstämplingen minns per händelse. Priset: den projektorn räknar då lite annorlunda
  än den andra (och än servern) **tills slutrutan** – slutet är alltid serverns
  `msAvsluta`-result, och elevskärmarna visar serverns status.
- Inget ritas förrän historiken (första ögonblicksbilden) kommit, så en projektor som
  öppnas mitt i matchen aldrig "ändrar" sina första rutor.
- Allt som ritas är en funktion av (sessionen, loggen, fröet, `t`): explosioner, laser,
  vågor i skölden, bucklor, rök, gnistor, gung och besättningens humör räknas ur
  motorns `logg` och postens ålder – ingen partikelstat. Kosmetisk slump kommer ur
  `brus(frö, nyckel)` (FNV-1a + murmur3-blandning). Ingen `Math.random`/`Date.now`
  i ritningen (testat: Math.random/Date.now kastar under ritningen, och en projektor
  som följt matchen ger exakt samma ritanrop som en nyöppnad, även med loggen i omvänd
  ordning).
- Meteorer som sprängts eller slagit ner ritas ur stormplanen + loggens `kast`, så
  effekterna inte beror på vad projektorn råkade se innan.
- Textlagret (klocka, banderoll, mätare, flödet) sätts ur tillståndet vid `t` utan
  CSS-övergångar; flödets in-/uttoning räknas ur radens ålder.
- Slutet: `t` stannar vid stormens slut (lärarens avslut via `finishedAt`, annars
  00:00); animationerna (fyrverkerier, besättningen) fortsätter.

### 12.3 Projektorn skriver inget i formatets samlingar

- EN `onSnapshot` på `msEvents` per projektor (`watchEvents`), ingen omläsning.
  Händelser med `typ: "fel"` blir aldrig handlingar. `aktiva` = sessionens
  `msStationer` (saknas → 1, ingen har handlat).
- **Avsluta** = skalets knapp (med bekräftelse), som i övriga format: kärnan
  sätter `status: "finished"` och kör sedan formatets `resultInputs` (D:s
  `avslutaOchBetala`: `msAvsluta` – servern läser hela loggen och skriver
  `result` – och sedan pluggmynten); kärnans
  `writeResultIfMissing` ser att `result` redan finns. Samma väg vid 00:00. Slutrutan
  visar serverns `result`. Projektorn skriver aldrig `msPublic/status`; kärnans
  egna sessionsskrivningar (STARTA, `endsAt`, `status`) är desamma som i alla format.
- **Paus finns inte:** stormen följer serverns klocka och är samma för alla elever
  och båda projektorerna – ingen annan Live-projektor har paus heller. Kontrollerna
  är skalets: Avsluta, ljud, 🎵 musik (§13.1) och fullskärm.

### 12.4 Två projektorer med nätfördröjning (uppmätt, skadescenariot)

```
flock /tmp/pp-821-emulator.lock node admin/qa-meteorstorm-tva-revision.mjs \
  --latens 300,1000 --sek 90 --p4b 0.3 --p4d 0.22 --attacker vilda      # och 300,1500
```

Testarens rigg (bygger på `admin/qa-meteorstorm-tva.mjs`): Firestore-emulatorn (öppna
QA-regler; reglerna testas i `test:rules`), en pågående Klass mot klass-session (20 + 20
elever) som spelas **dåligt** (30 % / 22 % rätt, Vilda) så att skölden går upp och ner,
skrovet tar skada och dragstrålar flyger – finalen inom mätningen. Historiken skrivs i
ett svep, nya `msEvents` i realtid som servern skriver dem. Två **separata** huvudlösa
Chromium med den riktiga projektorn (`projector.js` → `live-feed` +
`meteorstorm-data.js`), DevTools-fördröjning på varje anrop/long-poll. QA-proxyn tvingar
long-poll, så den **verkliga leveranstiden** (projektorns egen mätning: ankomst på den
server-korrigerade klockan − händelsens `t`) blir längre än den nominella.

- **Visade rutor ändrade i efterhand:** var 0,5 s sparas den ruta som faktiskt ritades;
  i slutet ritas samma `t` om. "Ändrade" = tillståndet skilde sig, "synligt" = > 30 px.
- **Identiskt vid samma `t`:** var 3:e s ritar båda samma `t` i en egen canvas – det `t`
  som visas just nu (den äldre av de två) och nu − 10 s.
- **Sena** = händelser som kom efter bufferten och verkade "från nu" (§12.2).

Konstant buffert 2 s:

| Nominell | Verklig leverans median / p95 / max | Sena | Visade rutor ändrade i efterhand | Identiskt vid visad `t` · nu − 10 s (mot 300 ms-projektorn) | `t` bakåt |
| --- | --- | --- | --- | --- | --- |
| 300 ms | 0,6 / 0,7–0,9 / 0,9–1,9 s | 0 | 0 av 187–189 | – | 0 |
| 1 000 ms | 1,7 / 2,3 / 3,0 s | 17 av 151 | 0 av 194 | 29/29 · 29/29 | 0 |
| 1 500 ms | 2,4 / 3,1 / 3,5 s | 80 av 146 | 0 av 197 | 14/30 · 21/30 | 0 |

(Före F1, med fast buffert 1,5 s och utan senvakten, mätte testaren 88 av 203 ändrade
rutor vid 1 500 ms, 16 synliga – t.ex. "⚠️ Skölden är nere!" utan bubbla där facit hade
1/60.)

- **Det som visats ändras aldrig** – inte ens när leveransen tar 3,5 s.
- **Leverans under 2 s** (nominellt 300 ms, och de flesta vid 1 000 ms): de två
  projektorerna är identiska vid samma `t`.
- **Leverans över 2 s** (nominellt 1 500 ms i den här riggen: hälften av händelserna):
  den sena projektorn verkar händelserna en stund senare än den snabba, och bilderna
  skiljer sig (14/30) **tills slutrutan**, som alltid är serverns `msAvsluta`.
- En konstant 2 s klarar alltså inte "identiskt" vid nominella 1 500 ms i den här riggen,
  eftersom den verkliga leveransen där är 2,4 s i median. QA-proxyn tvingar long-poll
  (varje händelse väntar på ett nytt anrop med fördröjningen); i produktionen strömmar
  Firestore och leveransen är normalt kortare.
- **Jämn:** `t` gick aldrig bakåt; steget per bildruta avvek högst 8 ms från verklig tid.
- ❓ **Till Elias (§14.5):** bufferten är 2 s och konstant. Vid sämre nät än så kan två
  projektorer visa lite olika förlopp (aldrig en "ångrad" bild) tills slutrutan, där
  serverns resultat gäller. Räcker det, eller ska bufferten vara längre (allt kommer då
  så mycket senare efter elevens tryck)?

### 12.5 Bilder per sekund (uppmätt)

`node admin/qa-meteorstorm-fps.mjs` – demosidan i huvudlös Chromium (Linux-VM, 6
kärnor, ingen GPU: `--disable-gpu` = Skia på CPU), 8 s mätning i finalen (flest
meteorer och explosioner) och mitt i matchen. Mätarna är projektorns egna
(`__mspProjektor.fps()`): tiden mellan `requestAnimationFrame` och JS-tiden per
bildruta för motorn + hela ritningen.

| Fönster | Läge | fps | p95 mellan bildrutor | JS per bildruta (medel / p95) |
| --- | --- | --- | --- | --- |
| 1920 × 1080 | finalen | 58 | 16,8 ms | 1,6 / 3,4 ms |
| 1280 × 720 | finalen | 59 | 16,8 ms | 1,5 / 3,8 ms |
| 1920 × 1080 | mitten | 60 | 16,7 ms | 1,2 / 3,0 ms |

Två projektorer i samma maskin samtidigt (§12.4, 1600 × 900, två Chromium + emulatorn på 6 kärnor): 37–56 fps beroende på körning, JS 0,7–0,9 ms per bildruta.
Testaren (#822): med 4× CPU-strypning och `--disable-gpu` blir det 21 fps – 2,2 s av
var 3:e s går till Commit/DoUpdateLayers (uppladdning av mjukvarucanvasen), JS bara
~5 ms per bildruta. Det är rastret utan GPU som begränsar, inte ritningen.
Budgeten för 60 fps är 16,7 ms; ritningen tar en tiondel. I Barista-webbläsaren
(SwiftShader, delad med andra flikar) blev det 18 fps i 1920 × 1080 med samma JS-tid
(2,5 ms) – där är det mjukvarurastret, inte projektorn, som begränsar. En vanlig
lärardator rastrar Canvas 2D på GPU:n. Bakgrunden (stjärnor, nebulosa, planet)
ritas en gång per storlek; canvasen är högst 2048 px bred (`devicePixelRatio` ≤ 2).

### 12.6 Testat

`node --test test/live-meteorstorm-projektor.test.js` (25): formatobjektet
(giltigt, latt, slutet via D:s `resultInputs`/`buildResult`), indata
(`msStationer` saknas → 1, lärarens avslut), `typ: "fel"` hoppas över, klockan går
aldrig bakåt (2 000 skakiga steg), konstant buffert 2 s och att en sen händelse aldrig
ändrar en visad ruta (stämplas om, `t` monoton), loggindexet live = sent öppnad = efter
tillbakaspolning, flödet (bara positivt, högst 4 rader, specens texter, namn av),
banderollen, besättningen, gunget, banorna (spegelvända), ritningen är en ren
funktion (inspelande låtsas-canvas), slutrutan (vinnare, snäll text, tre ögonblick,
oavgjort, stjärnor, ingen elevlista), ramarna (≤ 400 rader, ingen
Math.random/Date.now i ritningen, inga Firestore-skrivningar, EN `watchEvents`,
bara `msp-`-klasser) och demot.

### 12.7 Bilder

`docs/meteorstormen-822/`: `skadenivaer.jpg` (alla fem nivåerna med sköldens
lägen), `slungad.jpg` (slungad meteor med svans och "från 4B"), `jattemeteor.jpg`
(banderoll + nedräkning), `en-klass.jpg` (en station, Kometsvans), `finalen.jpg`
(skador, orange skrovmätare, "⚠️ Skölden är nere!", 4D flyter – ingen bubbla, "Ingen mer
skada", besättningen i rymddräkter), `slut-kmk.jpg`, `slut-en-klass.jpg`, `lobby.jpg`, `tva-a.jpg`/`tva-b.jpg`
(två projektorer frysta på samma `t`). Huvudlös Chromium saknar emoji-typsnitt –
rutorna visas som emoji i en vanlig webbläsare.

---

## 13. Musiken, finputsen och checklistan (E, #824)

### 13.1 Musiken

- **Filen:** `src/live/formats/meteorstorm/assets/meteorstormen-loop.ogg` (Elias låt
  2026-10-21, `meteorstormen-loop-v2.ogg`). Ogg Vorbis, 44,1 kHz stereo, 1,26 MB,
  **exakt 80,0 s** (3 528 000 sampel – testat), en loop.
- **Kopplingen** är densamma som i Guldrushen: `music: { src: new URL("./assets/meteorstormen-loop.ogg",
  import.meta.url).href, level: 0.3, lobby: 0 }` i `index.js`. Projektorskalet
  (`proj-music.js`) sköter resten: filen hämtas först när projektorn öppnar lobbyn (inte
  i bootgrafen – `index.js` innehåller bara en URL, bootgrafen är 107 filer som förut),
  avkodas med Web Audio och loopas **sampelexakt** (`AudioBufferSourceNode`, `loop = true`
  över hela bufferten – inget `<audio loop>`-hack vid skarven). Tyst i lobbyn och under
  3-2-1, tonas in efter KÖR!, ut vid 00:00. Formatets egna ljud (`msp-ljud.js`, via
  `sound.play`) sänker musiken till 70 % en kort stund, som Guldrushens kistljud.
- **Lärarens knapp:** 🎵 Musik på/av i projektorns kontroller (`pp:live:musik`, sparas per
  webbläsare, standard på) – samma knapp som i Guldrushen och Datakuppen, och den följer med
  till elevskärmsfönstret. Ingen musik på elevernas datorer.
- **Safari:** precis som Guldrushen finns ingen MP3-reserv. Äldre Safari (macOS/iPad) kan
  inte avkoda Ogg Vorbis – där blir musiken tyst (en varning i konsolen) medan ljudeffekterna
  fungerar. Projektorn körs normalt i Chrome/Edge på lärardatorn, och Chromebooks spelar
  OGG. (Fråga 14.6.)

### 13.2 "Live pågår!" i elevens sidomeny (delad Live-kod)

C:s e2e visade att rutan "Live pågår!" låg kvar efter matchen. Det fanns två orsaker, och
båda gällde alla format:

1. Sidomenyn (`src/ui.js`) visar en villkorad länk även när villkoret är falskt **om eleven
   står på länkens sida**, och eleven står kvar på slutskärmen i `#/elev/live`. Nu gäller
   undantaget inte Live-rutan (`villkorSynlig`). Prov och Mattematchen beter sig som förut.
2. Menyns bevakare (`src/live/live-watch.js`) räknade en match som "pågår" i 2 min efter
   00:00 (marginalen för en session som ingen hunnit avsluta). Menyn följer nu
   `bannerSessions`: lobby, eller en match vars klocka går. Rutan försvinner **vid 00:00**
   (en timer ritar om menyn exakt då, inte först vid nästa 20 s-tick) och när status blir
   `finished`/sessionen raderas. Sidan `#/elev/live` använder fortfarande `relevantSessions`
   med marginalen, så en elev som laddar om just efter 00:00 ändå ser slutskärmen.

Testat i `test/live-watch.test.js` (alla fem formaten, lärarstyrt format utan klocka,
undantaget för Prov kvar).

### 13.3 Motorn delad

`delat/ms-motor.js` (403 rader) är delad utan beteendeändring: stegen 1–6 (handlingar,
meteorer, dragstrålar, lasrar, nedslag, hjälpen) ligger i `delat/ms-steg.js`, och
tillståndet ut i `delat/ms-utdata.js`. Motorn har kvar orkestreringen, kontrollpunkterna,
cachen och API:t (`simulera`, `skapaMotor`, `buildResultat`) – inga importer ändrades.
Kontroll: en "golden"-körning (simulera + skapaMotor med satHandlingar/laggTill/tillbakaspolning
över 36 matcher, alla lägen och attacker) gav samma SHA-256 före och efter. Synken
(`npm run sync:meteorstorm`) kopierar de två nya filerna till `functions/meteorstorm/`, och
drifttestet är grönt.

### 13.4 Kopplat demoläge (projektorn + elevskärmen)

`preview/preview-meteorstorm-demolage.html`: projektorn (1920 × 1080) och en elevskärm i
mobil (375 × 812) sida vid sida i **samma** påhittade match. Elevskärmen är
`preview-meteorstorm-elev.html?koppla=1` (D:s riktiga elevvy mot låtsasservern
`ms-elev-demo.js`). Projektorn är `preview-meteorstorm-demo.html?koppla=1`. Den ritar
låtsasserverns match via `ms-demolage.js` (`projektorDeps`: sessionen som live-feed, loggen
som `msEvents`, `msAvsluta`). Det "Jag" trycker (🛡️/🔫/🌀) syns på projektorn efter 2 s.
Slutrutan, elevens slutskärm och pluggmynten kommer ur samma resultat. Panelen har knappar
för klockan (nästa händelse, +60 s, 20 s kvar), för att svara rätt eller fel och välja
handling, och för En klass och Vilda. Ingen Firestore, inga Cloud Functions, inga
pluggmynt. Testat i `test/live-meteorstorm-finputs.test.js`. De fristående demosidorna
finns kvar.

### 13.5 Finputs

- **Texterna:** genomgångna på elevskärmen, projektorn och i historiken. Den enda
  ändringen gäller en elev med 0 rätt: "Svara rätt nästa gång – …" blev "Varje rätt svar ger
  stationen energi – nästa storm är din! 🚀". Flödet visar bara det som är bra, och
  slutskärmen har ingen placering som nummer.
- **Formatväljaren:** ☄️ Meteorstormen – "Försvara rymdstationen – sköld, laser och
  dragstråle." står sist bland formaten, med fälten Läge, Attacker, speltid, namn och
  pluggmynt. Förhandsvisningen är `preview/preview-meteorstorm-formatval.html` (lärarens
  riktiga formulär med minnes-stubbar).
- **Ingen blinkning:** inga vita blixtar. Varningslampan pulserar långsamt (3,2 s på
  elevskärmen, 2,4 s i lobbyn), och explosionerna är mjuka. `prefers-reduced-motion`
  ger stilla besättning, inget gung och inga CSS-animationer eller övergångar (projektorn,
  elevskärmen och lobbyn). Bild: `docs/meteorstormen-824/projektor-reducerad.jpg`.
- **Mobil 375 px:** elevskärmen, lobbyn och slutskärmen ryms utan vågrät scroll.
  Historikens tabeller (handlingar per klass, kategorier, klassens svåraste) ligger nu i
  `.msh-scroll` som eleverna-tabellen, så sidan inte scrollar i sidled på en telefon.
- **Skärmdumparna:** `node admin/qa-meteorstorm-skarmdumpar.mjs` (egen huvudlös Chromium,
  rapporterar fel i konsolen och vågrät scroll) → `docs/meteorstormen-824/`.

### 13.6 LIVE-FORMAT §10 – checklistan

| Punkt | Status |
| --- | --- |
| `src/live/formats/meteorstorm/` med `index.js`, ren kärna, lata vyer | ✅ Ren kärna = `delat/` (+ rena `msp-scen.js`/`ms-elev.js`/`ms-klient.js`), vyer via `import()` |
| Kistformat → `src/live/kistspel/` | – Inget kistformat. Egen motor; frågeflödet återanvänder `createQuestionFlow` |
| En rad i `BUILTIN_FORMATS` | ✅ `src/live/formats/index.js` |
| Regelgren i `firestore.rules` + routning | ✅ "Meteorstormen" (B, §8) |
| `test/live-meteorstorm*.test.js` + `test/firestore-rules-live-meteorstorm*.test.js` i `test:rules` | ✅ Båda regelfilerna står i `test:rules`, och functions-testerna i `test:functions` |
| Pluggmynt (§6) | ✅ Placeringspris per klass (−15 %/plats), per rätt svar, stjärnor i En klass (D, §11) |
| Projektorvyer, elevskärm, historik | ✅ C §12, D §11 |
| Demoläge + `preview/preview-meteorstorm-demo.html` | ✅ Plus kopplat demoläge (§13.4) |
| Egen CSS per format, reducerad rörelse | ✅ Bara `msp-`/`mse-`/`msh-`-klasser (testat), §13.5 |
| `docs/DATAMODELL.md` | ✅ Underdokumenten listas där, och fälten och `result` beskrivs i §8 här (länkat) |
| Bootgrafen orörd | ✅ 107 filer (`test/live-formats.test.js`) |
| Alla sviter gröna | ✅ Se §13.7 |
| Deploy före merge till `main` | ⏳ Kräver Elias OK: indexes → rules → functions → webb (§10) |

### 13.7 Sviterna (E)

SVITER_PLATSHALLARE

---

## 14. Öppna frågor till Elias – samlade

Alla frågor från A–E står här. Varje fråga har ett **standardval**, och det är så formatet
fungerar nu. Inget av svaren kräver ett nytt bygge: det handlar om ett tal i
`delat/ms-balans.js` eller `delat/ms-anrop.js`, eller om en inställning i `functions/index.js`.

| # | Fråga | Standardval nu | Spak om svaret blir ett annat |
| --- | --- | --- | --- |
| 14.1 | **Balans – smart spel (§6):** i Klass mot klass vinner 60 % mot 70 % i ~31–35 % av matcherna, men det beror på att dragstrålen gör matchen slumpigare. Att spela "smart" ger bara ~+2 procentenheter. Ska smart spel löna sig mer? | Oförändrat: dragstrålen fångar närmaste inkommande stormmeteor oavsett storlek | Bara mellanstora och stora meteorer går att fånga (ms-steg.js `dragstralar`) |
| 14.2 | **Balans – dragstrålens styrka (§6):** en klass med 60 % rätt som använder dragstrålen vinner alltid mot en klass med 70 % som aldrig använder den. Ska den vara så avgörande? | Milda: 3 ⚡, 10 s väntetid, samma storlek. Vilda: 2 ⚡, 6 s, en storlek större. Flygtid 6 s | `ATTACKER.milda`/`vilda` (kostnad, väntetid), `KAST_FLYGTID_MS` |
| 14.3 | **Kvoten – serverns läsningar (§9):** målet "läsningar < 6 000" nås för klienterna (≈ 5 300), men inte om serverns läsningar räknas in (7 600 med en instans, upp till 15 000 med fyra). Räcker det att klienterna ligger under målet? | Ja: `msAvsluta` läser om hela loggen (resultatet beror inte på minnet), `maxInstances: 4` | (1) räkna ur instansens minne (−2 300) (2) `maxInstances: 1` |
| 14.4 | **Skriptad elev (§7.1/§9):** en elev som skriver egna anrop mot callable-API:t når ~441 skrivningar per 10 min. Två sådana elever tar matchen över 3 000 skrivningar. | Behåll takten `MS_K_TAKT_MS` = 1,5 s per fråga (en snabb människas takt) | 2,5 s per fråga (~280 per elev), som också bromsar de snabbaste ärliga eleverna |
| 14.5 | **Renderingsbufferten (§12.4):** bufferten är 2 s och konstant. Vid sämre nät kan två projektorer visa lite olika förlopp (aldrig en "ångrad" bild) fram till slutrutan, där serverns resultat gäller. Räcker 2 s? | 2 s (`RENDER_FORDROJNING_MS`, Elias 2026-10-21: "1–2 s") | Längre buffert = identiskt vid sämre nät, men allt kommer så mycket senare efter elevens tryck |
| 14.6 | **Klassbonusen vid elevens avslut (§11):** om projektorn är stängd vid 00:00 skriver en elevs `msAvsluta` resultatet. Pokalerna och Live-priset delas ut när en admin öppnar matchen i historiken, men klassbonusen (som inte är idempotent) delas inte ut. | Godtas: klassbonusen går förlorad i det fallet. Pluggmynten betalas | Gör klassbonusen idempotent (kvitto per session) i klasscentret – delad kod utanför formatet |
| 14.7 | **Musiken i Safari (§13.1, ny i E):** OGG utan MP3-reserv, som i Guldrushen. Äldre Safari spelar ingen musik (ljudeffekterna fungerar). | Bara OGG | Lägg en MP3 bredvid och välj den efter `canPlayType` i `proj-music.js` (gäller alla format) |
