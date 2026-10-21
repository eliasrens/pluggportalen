# Meteorstormen ☄️ – motorn, reglerna och balansen

Meteorstormen är ett Live-format (`format: "meteorstorm"`, epic #819). Klasser
försvarar var sin rymdstation mot en **förutbestämd** meteorstorm; rätt svar ger
energi som eleven lägger på 🛡️ sköld, 🔫 laser eller 🌀 dragstråle. Specen:
[`UTVECKLINGSUPPDRAG_METEORSTORMEN.md`](UTVECKLINGSUPPDRAG_METEORSTORMEN.md).
Det här är **formatets kontraktsdokument** – del A (#820) beskriver motorn; B
(servern), C (projektorn), D (elevskärmen/lärarvyerna) och E fyller på.

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

## 4. För servern (B)

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

## 7. Deploy

Del A deployar ingenting själv. `functions/meteorstorm/` används först av B:s
callables. Synken körs som predeploy (`admin/sync-guldrush-functions.mjs`).
