# QA-rapport – Matchdagen Etapp 2 (epic #866)

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) §16 (rapport efter varje etapp).
Arkitekturen: [`MATCHDAGEN.md`](MATCHDAGEN.md). Etapp 1: [`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md).

## Etapp 2a – alla divisioner, kvalet och straffarna (#870)

Med 2a går det att ta sig uppåt: ligavinnaren spelar kval mot ett lag från divisionen ovanför, oavgjort avgörs
på straffar, vinst flyttar upp laget och nästa säsong lottas en ny liga av rätt storlek. Ingen åker någonsin ned.
Arkitekturen står i `MATCHDAGEN.md` §14 (och §7.1 för balansen).

### Vad som byggts

- **Stegen** (spec §7.1): åtta nivåer, Division 6 … Superligan, med 6/6/8/8/10/10/12/12 lag och 5/5/7/7/9/9/11/11
  omgångar (`DIVISIONER`, `LAGANTAL`). Stegen står överst i Tabell-fliken med den nuvarande divisionen gul
  (`aria-current="step"`) och skissens rad "Ettan får kvala upp. Man kan bara gå uppåt …".
- **Tuffare utan svårare frågor** (§7.3): starkare motståndare (`styrkaFor(div)`), fler lag och omgångar, och
  **finten** från Division 3 – ett skott kräver två rätt i rad ("Finta bort försvararen – sedan skottet!").
  Fel på finten → 0,03 och ingen andra fråga.
- **Kvalet** (§7.2, `delat/md-kval.js`): bara ligavinnaren (ettan under Superligan) får `kval` i karriären,
  motståndaren lottas med `styrkaFor(div + 1)`. Match-fliken visar "KVAL till Division 5 · Ödmårdens BK är ett
  lag från divisionen ovanför". Vinst → `div + 1`, pokalen "Kvalade upp till Division 5" och uppflyttningspengar;
  förlust → samma division och "Nära!". Rutan **Starta nästa säsong** lottar en ny liga i (den nya) divisionen.
  `div` sätts alltid till `max(nuvarande, …)`.
- **Straffarna** (§7.4, `delat/md-straffar.js`): fem var, sedan sudden death. Vår straff 0,82 vid rätt / 0,20 vid
  fel, deras 0,45 när målvakten svarar rätt / 0,85 vid fel. Avgörs så fort ena laget inte kan komma ikapp.
  Skylten visar hela tiden "Straffar 3 – 2". Tillståndet är ren JSON i matchen, så en omladdning fortsätter mitt i.
- **Straffarna i bild:** 3D – kameran bakom skytten mot målet, målvakten på linjen, övriga i mittcirkeln,
  målvakten kastar sig; 2D (`?2d=1`) – en mindre viewBox kring straffområdet; lugnt läge – ingen zoom. Utropen
  "MÅL!", "RÄDDNING!", "I STOLPEN!", "UTANFÖR!".
- **Sparningen:** `kval` hör till karriären (`KARRIAR_FALT`), matchdokumentet får `typ: "kval"` och `straffar`.
  Statistiken (elev och lärare) visar "(kval)", "str. 4–3" och säsongernas "kvalade upp".
- **Regler** `mdKvalOk` och `mdStraffarOk` (nyckel MQ i `BEHORIGHETER.md`) med tester.
- **Balansen** (`npm run balans:matchdagen`): alla divisioner, kvalet med straffar, Superligan-målet ur §12 och
  karriären (hur långt och hur snabbt).
- **Förhandsvisningen** `preview/preview-matchdagen.html`: `?div=0–7`, `?kval=1`, `?straffar=1` (kvalet 1 – 1 efter full tid;
  "Fortsätt matchen" går direkt till straffarna, i 3D eller med `?2d=1`).
- **QA-seed** `MD_KVAL=1` i `admin/qa-matchdagen-867-seed.mjs`: Alva har vunnit Division 6 och har kvalet framför sig.

### Tester

- `test/matchdagen-kval.test.js` (node, 2a:s motor): straffläggningen (fem var, sudden death, tidigt avgörande
  3 – 0 och 2 – 4, taket 30 omgångar, sannolikheterna), finten från Division 3 (två frågor, fel → 0,03, ingen
  andra fråga), schemat för 6/8/10/12 lag (alla möter alla en gång), kvalet bara för ligavinnaren, vinst → upp,
  förlust → kvar, aldrig ned (även ur ett trasigt dokument), nästa säsong med rätt antal lag, nästa säsong kräver
  spelat kval, uppflyttningspengarna.
- `test/matchdagen-kval-vy.test.js`: stegen, kvaltexterna, säsongstexterna, pågående kval/straffar efter
  omladdning, bara tal i lärarvyn, straffuppställningen.
- `test/firestore-rules-matchdagen-kval.test.js` (emulator, i `npm run test:rules`): `kval` null/map, kända
  nycklar, `div` 0–6, heltal, `mot.farg`, `mot.namn` 1–40, `matcher.straffar` två heltal 0–40, strängar och
  HTML nekas.
- Uppdaterade: `matchdagen-balans`, `-liga`, `-motor`, `-sasong` (nya fält och finten).

### Skärmdumpar

`01`–`07` i förhandsvisningen (`preview/preview-matchdagen.html`, 1366 × 768), `08`–`10` i appen mot emulatorn
(`MD_PA=1 MD_KVAL=1 admin/qa-matchdagen-867-preview.sh`, Alva och `qaarskurs4`).

| Bild | Vad |
| --- | --- |
| [`01-tabell-stegen-kval.png`](qa-matchdagen-2a/01-tabell-stegen-kval.png) | Tabell-fliken: stegen med Division 6 markerad, ligan vunnen, kvalet väntar |
| [`02-tabell-elitligan-12-lag.png`](qa-matchdagen-2a/02-tabell-elitligan-12-lag.png) | Elitligan (`?div=6`): 12 lag, finttexten under stegen |
| [`03-straff-3d-var.png`](qa-matchdagen-2a/03-straff-3d-var.png) | Straffläggningen i 3D, vår straff: kameran bakom skytten, skylten "Straffar …" |
| [`04-straff-3d-deras.png`](qa-matchdagen-2a/04-straff-3d-deras.png) | Deras straff: "Kan målvakten rädda?" |
| [`05-kval-forlorat-straffar.png`](qa-matchdagen-2a/05-kval-forlorat-straffar.png) | "Nära! 1 – 1 (straffar 2 – 4)" – kvar i Division 6, Starta nästa säsong |
| [`06-straff-2d.png`](qa-matchdagen-2a/06-straff-2d.png) | Straffarna i 2D (`?2d=1`): viewBoxen kring straffområdet |
| [`07-uppflyttning.png`](qa-matchdagen-2a/07-uppflyttning.png) | "Uppflyttning!" efter vunnet kval |
| [`08-app-emulator-straff.png`](qa-matchdagen-2a/08-app-emulator-straff.png) | Appen mot emulatorn: Alvas kval 2 – 2 efter full tid, "Straff 1: vi skjuter" |
| [`09-app-emulator-uppflyttning.png`](qa-matchdagen-2a/09-app-emulator-uppflyttning.png) | Appen: uppflyttningen sparad, Division 5 efter omladdning |
| [`10-larare-kval-straffar.png`](qa-matchdagen-2a/10-larare-kval-straffar.png) | Läraren: Alvas matcher med "(kval)" och "str. 3–0" |

### Balansen (`npm run balans:matchdagen`, hela utskriften nedan)

Division 6 är oförändrad mot Etapp 1 (samma frön): 70 % rätt vinner 61 % och ligan 59 %, 50 % vinner 34 %,
30 % gör minst ett mål i 53 %. **Superligan med 80 % rätt och ett tränat lag (snitt 4★) vinner 47 %** – §12:s mål
45–55 %, fällt av `test/matchdagen-balans.test.js`. Inga tal i `md-config.js` behövde ändras.

Alla divisioner med startlaget (2★), 400 säsonger per rad:

| Rätt | Division | Lag | Vinst | Ligan | Kval vunna | Kval på straffar | Mål/match | Säsong (min) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 % | Division 6 | 6 | 74 % | 79 % | 84 % | 21 % | 2,85 | 53 |
| 80 % | Division 4 | 8 | 58 % | 52 % | 72 % | 27 % | 2,75 | 70 |
| 80 % | Division 3 (finten) | 8 | 40 % | 20 % | 46 % | 28 % | 2,41 | 71 |
| 80 % | Division 2 | 10 | 33 % | 7 % | 38 % | 28 % | 2,51 | 90 |
| 80 % | Elitligan | 12 | 18 % | 0 % | – | – | 2,77 | 110 |
| 70 % | Division 6 | 6 | 62 % | 59 % | 65 % | 22 % | 2,56 | 51 |
| 70 % | Division 5 | 6 | 52 % | 40 % | 53 % | 30 % | 2,64 | 50 |
| 70 % | Division 3 (finten) | 8 | 25 % | 2 % | 43 % | 14 % | 2,28 | 69 |
| 50 % | Division 6 | 6 | 33 % | 14 % | 36 % | 27 % | 2,35 | 48 |
| 50 % | Division 4 | 8 | 20 % | 1 % | 40 % | 40 % | 2,62 | 66 |
| 80 %, 4★ | Superligan | 12 | **47 %** | 28 % | – | – | 2,68 | 111 |

En match tar 7,0–7,7 minuter i alla divisioner; säsongen växer med antalet omgångar (Division 6 ~50 min,
Elitligan/Superligan ~110 min). Kvalet går till straffar i ungefär var fjärde match.

**Karriären** (100 elever × 30 säsonger; andel som når divisionen · median säsonger · median speltimmar):

| Rätt | Laget | Division 5 | Division 3 | Division 2 | Division 1 | Superligan |
| --- | --- | --- | --- | --- | --- | --- |
| 80 % | startlaget 2★ | 100 % · 1 · 0,9 h | 100 % · 6 · 5,9 h | 91 % · 14 · 15,8 h | 25 % · 22 · 26 h | – |
| 70 % | startlaget 2★ | 100 % · 2 · 1,7 h | 93 % · 13 · 12 h | 25 % · 20 · 22 h | – | – |
| 50 % | startlaget 2★ | 74 % · 8 · 6,5 h | – | – | – | – |
| 80 % | tränas 2★ → 4★ | 100 % · 1 · 0,9 h | 100 % · 5 · 4,7 h | 100 % · 7 · 7,6 h | 100 % · 10 · 12 h | 97 % · 18 · 26 h |
| 70 % | tränas 2★ → 4★ | 100 % · 2 · 1,7 h | 100 % · 8 · 7,6 h | 87 % · 16 · 17 h | 42 % · 23 · 29 h | 1 % · 27 · 40 h |

**Bedömning:** takten är rimlig – en elev med 70–80 % rätt går upp en division ungefär varannan säsong i de
lägre divisionerna (en säsong ≈ en lektion), och finten i Division 3 är en märkbar men inte omöjlig tröskel.
Med startlaget tar det stopp kring Division 3–2; högre upp krävs ett bättre lag, som kommer med truppen,
marknaden och träningslägret i Etapp 2b. "Tränas 2★ → 4★" är ett **antagande** för 2b (snittet växer jämnt med
divisionen) – 2b bör köra om karriären med den riktiga träningen. Den som har 50 % rätt kommer upp till
Division 5 men sällan längre; ingen åker ned, så den eleven spelar vidare i en jämn liga.

<details><summary>Hela utskriften (<code>npm run balans:matchdagen</code>, 75 s)</summary>

```
Matchdagen – balans i Division 6 (1000 säsonger à 5 matcher per rad)

Rätt  Vinst  Oavgj.  Förlust  Ligan  Mål/match  Gjorda  Insl.  ≥1 eget mål  Förlust ≥4  Skillnad ≥6  Störst  Frågor/match  Match (min)  Säsong (min)  Mål
70 %  61 %   25 %    14 %     59 %   2,56       1,73    0,82   87 %         0 %         0,0 %        6       27,9          7,0          51            ja
50 %  34 %   30 %    36 %     14 %   2,38       1,18    1,21   73 %         0 %         0,0 %        6       28,2          7,0          48            ja
30 %  12 %   24 %    64 %     1 %    2,39       0,72    1,67   53 %         2 %         0,0 %        5       28,6          7,0          47            ja

Alla divisioner med startlaget (2★) – 400 säsonger per rad; kvalet mot styrka(div + 1), oavgjort → straffar

Division         Rätt  Lag  Vinst  Oavgj.  Ligan  Kval vunna  Kval på straffar  Mål/match  Gjorda  Insl.  ≥1 eget mål  Match (min)  Säsong (min)  Mål
Division 6       80 %  6    74 %   18 %    79 %   84 %        21 %              2,85       2,14    0,71   92 %         7,0          53            ja
Division 5       80 %  6    65 %   23 %    67 %   78 %        25 %              2,79       1,95    0,84   89 %         7,0          52            –
Division 4       80 %  8    58 %   25 %    52 %   72 %        27 %              2,75       1,76    0,99   88 %         7,1          70            –
Division 3       80 %  8    40 %   31 %    20 %   46 %        28 %              2,41       1,31    1,11   78 %         7,6          71            –
Division 2       80 %  10   33 %   28 %    7 %    38 %        28 %              2,51       1,21    1,30   74 %         7,6          90            –
Division 1       80 %  10   24 %   28 %    1 %    33 %        33 %              2,63       1,09    1,54   69 %         7,6          90            –
Elitligan        80 %  12   18 %   24 %    0 %    –           –                 2,77       1,00    1,77   67 %         7,6          110           –
Superligan       80 %  12   12 %   21 %    0 %    –           –                 2,98       0,94    2,04   64 %         7,7          110           –
Division 6       70 %  6    62 %   25 %    59 %   65 %        22 %              2,56       1,74    0,82   87 %         7,0          51            ja
Division 5       70 %  6    52 %   27 %    40 %   53 %        30 %              2,64       1,60    1,04   85 %         7,0          50            –
Division 4       70 %  8    43 %   29 %    21 %   53 %        28 %              2,60       1,45    1,16   81 %         7,1          68            –
Division 3       70 %  8    25 %   30 %    2 %    43 %        14 %              2,28       0,98    1,29   65 %         7,4          69            –
Division 2       70 %  10   18 %   26 %    1 %    50 %        0 %               2,39       0,84    1,55   60 %         7,5          88            –
Division 1       70 %  10   14 %   23 %    0 %    –           –                 2,57       0,80    1,77   57 %         7,5          89            –
Elitligan        70 %  12   9 %    18 %    0 %    –           –                 2,79       0,73    2,06   54 %         7,5          109           –
Superligan       70 %  12   6 %    14 %    0 %    –           –                 3,01       0,68    2,33   52 %         7,6          109           –
Division 6       50 %  6    33 %   31 %    14 %   36 %        27 %              2,35       1,15    1,21   73 %         7,0          48            ja
Division 5       50 %  6    27 %   28 %    7 %    17 %        28 %              2,48       1,08    1,40   70 %         7,1          48            –
Division 4       50 %  8    20 %   27 %    1 %    40 %        40 %              2,62       0,99    1,62   66 %         7,1          66            –
Division 3       50 %  8    7 %    19 %    0 %    –           –                 2,30       0,51    1,79   41 %         7,3          68            –
Division 2       50 %  10   5 %    14 %    0 %    –           –                 2,49       0,47    2,02   38 %         7,4          87            –
Division 1       50 %  10   3 %    11 %    0 %    –           –                 2,72       0,42    2,30   34 %         7,4          87            –
Elitligan        50 %  12   1 %    7 %     0 %    –           –                 3,00       0,38    2,62   32 %         7,4          107           –
Superligan       50 %  12   1 %    5 %     0 %    –           –                 3,21       0,36    2,85   31 %         7,5          108           –
Superligan (4★)  80 %  12   47 %   28 %    28 %   –           –                 2,68       1,56    1,12   83 %         7,7          111           ja

Karriären (100 elever × 30 säsonger, med startlaget och med ett lag som tränas upp): andel som når divisionen · median säsonger · median speltimmar

Rätt  Laget          Division 5              Division 4               Division 3               Division 2               Division 1                Elitligan                Superligan
80 %  startlaget 2★  100 % · 1 säs. · 0,9 h  100 % · 3 säs. · 2,7 h   100 % · 6 säs. · 5,9 h   91 % · 14 säs. · 15,8 h  25 % · 22 säs. · 26,3 h   –                        –
70 %  startlaget 2★  100 % · 2 säs. · 1,7 h  100 % · 5 säs. · 4,4 h   93 % · 13 säs. · 12,2 h  25 % · 20 säs. · 21,6 h  –                         –                        –
50 %  startlaget 2★  74 % · 8 säs. · 6,5 h   22 % · 17 säs. · 13,6 h  –                        –                        –                         –                        –
80 %  tränas 2★→4★   100 % · 1 säs. · 0,9 h  100 % · 3 säs. · 2,6 h   100 % · 5 säs. · 4,7 h   100 % · 7 säs. · 7,6 h   100 % · 10 säs. · 12,0 h  99 % · 13 säs. · 16,6 h  97 % · 18 säs. · 25,5 h
70 %  tränas 2★→4★   100 % · 2 säs. · 1,7 h  100 % · 5 säs. · 4,2 h   100 % · 8 säs. · 7,6 h   87 % · 16 säs. · 17,1 h  42 % · 23 säs. · 29,1 h   11 % · 26 säs. · 33,5 h  1 % · 27 säs. · 40,0 h
50 %  tränas 2★→4★   74 % · 8 säs. · 6,5 h   35 % · 18 säs. · 14,5 h  6 % · 18 säs. · 16,2 h   –                        –                         –                        –
```

</details>

### Kvoten (2a)

Oförändrad mot 1c (`MATCHDAGEN.md` §11): kvalet är en match till per säsong för ligavinnaren (en batch = 2
skrivningar), straffläggningen sparas med den matchen. Inga nya läsningar och inga lyssnare; lärarvyn läser
samma dokument som förut.

### Deploy

1. `firebase deploy --only firestore:rules` – `kval` i karriären och `straffar` i `matcher` (`mdKvalOk`,
   `mdStraffarOk`) – **före** webben. De gamla reglerna nekar `kval: null`, som webben skickar med en ny klubb och
   med första matchen i en ny säsong: med webben först kan en ny klubb inte sparas och matcherna blir liggande i
   den lokala kön tills reglerna är ute (de sparas om då, inget går förlorat).
2. Webben (Pages).

Inga index och inga functions.

### Val där dokumentet inte räckte till

1. **Finten:** första frågan är finten. Fel → skottet avgörs direkt med 0,03 och det blir ingen andra fråga
   (skissen). Rätt → skottfrågan med de vanliga chanserna (fel där = `SKOTT.fel`, som under Division 3).
2. **Straffarna:** vi skjuter först i varje omgång. Efter 30 omgångar (praktiskt taget omöjligt) vinner vi –
   aldrig en ändlös straffläggning. Utfallet i summan och tabellen är "oavgjort" (resultatet på mål); vem som
   vann står i `straffar` och `vann`.
3. **Kvalmotståndaren lottas när ligan är slut** (ett namn som inte är med i ligan, `styrkaFor(div + 1)` med samma
   spridning som ligornas lag) och sparas i `kval`, så samma motståndare visas efter omladdning.
4. **Kvalets pengar:** som en vanlig match, plus `KASSA.uppflyttning` = 300 × (1 + div × 0,25) vid uppflyttning
   (skissens 600/150 är vinst-/oavgjortpengar i en högre division; specen anger inga tal).
5. **Superligans ettan** får pokalen men inget kval – Mästarcupen och legendklubben är Etapp 3.
6. **Stegen visar ligans division.** Efter ett vunnet kval står den gamla divisionen markerad tills eleven trycker
   Starta nästa säsong (då lottas den nya ligan).
7. **Ingen "div får bara öka"-regel i `firestore.rules`.** Legendklubben i Etapp 3 börjar om i Division 6, och
   en sådan regel skulle då behöva rivas. Motorn tar `max()` så appen aldrig flyttar ned ett lag; en elev som
   skriver förbi appen kan bara sänka sin egen division.
8. **2D-kameran:** viewBoxen 40 × 32 m kring målet, förankrad vid målkanten. Lugnt läge: hela planen, ingen zoom.
9. **Nästa säsong kan inte startas med ett ospelat kval** – knappen visas först efter kvalet.
10. **Karriärens "tränas 2★ → 4★"** i balansen är ett antagande tills truppen och träningen finns (2b).

### Så testas det (förhandsvisning och appen mot emulatorn)

- **Förhandsvisningen:** `PORT=8870 node server.mjs` → `preview/preview-matchdagen.html?vy=tabell&div=3`
  (stegen, finttexten), `?kval=1` (kvalet på Match-fliken), `?straffar=1` och `?straffar=1&2d=1`
  ("Fortsätt matchen" går direkt till straffläggningen).
- **Appen mot emulatorn:** `MD_PA=1 MD_KVAL=1 PORT=8871 bash admin/qa-matchdagen-867-preview.sh` – Alva har
  vunnit Division 6. Match → "KVAL till Division 5" → Avspark → spela (oavgjort → straffar) → "Uppflyttning!" eller
  "Nära!" → ladda om → Tabell visar Division 5 (eller 6) → Starta nästa säsong → ny liga med 6 lag → spela en
  ligamatch → den sparas. Läraren (`qaarskurs4`): Hur går det? → Matchdagen → Alva → matchraden "(kval)" och
  "str. x–y".

### Körningar (Codern, 870)

| Svit | Resultat |
| --- | --- |
| `node --test` (de 313 filerna som inte kräver emulatorn) | 4592 pass, 0 fail, 1 skipped (efter F1) |
| Matchdagen (`test/matchdagen-*.test.js`) | 173 pass (ingår ovan) |
| `npm run test:rules` (`admin/qa-matchdagen-867-svit.sh`) | 1047 pass, 0 fail (nya i `firestore-rules-matchdagen-kval.test.js`) |
| `npm run test:functions` (samma rigg) | **ofullständig:** 278 pass, 0 fail (2 kända TODO i schack) innan körningen stoppades för minnesbrist på maskinen. Inga filer i `functions/` är ändrade i 2a |
| `npm run test:e2e` | 5/5 |
| Bootgrafen | 107 filer (oförändrad, `test/matchdagen-modul.test.js`) |
| `npm run balans:matchdagen` | omkörd – identisk med tabellerna ovan (fasta frön) |

**I appen mot emulatorn** (Alva, `MD_PA=1 MD_KVAL=1`): Match → kvalet → oavgjort → straffar 3 – 0 → "Uppflyttning!"
sparad (kön tom) → omladdning visar Division 5 → Starta nästa säsong → en ligamatch sparad. Läraren ser "(kval)" och
"str. 3–0".

### Granskningen (code review på e9f9a90b..a6776b0a) – rättat

Inga höga eller medelhöga fynd (straffläggningens avgörande prövat mot en referens för alla utfall, XSS i elev- och
lärarvy, reglerna mot det appen skriver).

- **L1 (låg), ett förlorat kval kunde spelas om.** Den avgjorda matchen låg som "pågående" i `localStorage` tills
  sista animationen var klar; en flik som stängdes då kastade den (den var ju klar) och kvalet började om från
  0 – 0. Nu bokförs matchen i kön (`bokfor()` i `md-match-spel.js`: `matchKlar`/`kvalKlar` + `laggIKo` +
  `rensaPagaende`) så fort den är avgjord – efter sista draget eller den avgörande straffen, **före** animationen.
  Test i `matchdagen-kval-vy.test.js`; i förhandsvisningen var den pågående matchen borta och matchen i kön 3,3 s
  innan rutan "Nära!" kom. Gäller också ligamatcher (samma lucka fanns sedan 1c).
- **L2 (låg, inte rättad):** en elev som vann Division 6 med Etapp 1-koden och inte startat nästa säsong får aldrig
  sitt kval. Etapp 1 och 2a deployas tillsammans (samma epic), så det kan inte hända i drift.

### Rättningsrunda 1 (testarens fynd på 482ed5cc)

- **F1, omladdning under pausen efter ett fel svar gav en ny fråga.** Frågekortet visar rätt svar i 1,5 s
  (`FEL_MS`), och skottet, finten och straffen spelades först efter pausen – en omladdning då kastade svaret, och
  eleven fick en ny fråga för samma straff eller skott (i kvalet ett sätt att köpa sig en uppflyttning). Nu tar
  `visaFraga` en `vidSvar(utfall)` som anropas **direkt** när svaret är avgjort; matchvyn spelar läget
  (`spela`, efter finten när den avgör) och straffvyn straffen (`straffa`) och sparar lokalt (och bokför en avgjord
  match) i den, före pausen. Pausen är bara visuell. Tester i `matchdagen-kval-vy.test.js` (frågekortet med en
  låtsas-DOM: utfallet kommer före pausen, ett andra klick räknas inte; skottet/finten/straffen i `vidSvar`).
  I förhandsvisningen 20 ms efter klicket: straffen (`dem: [true]`, 29 frågor) och finten i Division 3 (läget
  avgjort, ingen andra fråga) var redan sparade; omladdning → "Straffläggningen pågår: 1 – 1".

## Etapp 2b – truppen, reserverna, marknaden och träningslägret (#871)

Med 2b får laget ett eget liv mellan matcherna: klubbkassan köper spelare på marknaden, grundpelarna som ersätts
väntar bland reserverna, och träningslägret – ett per spelad omgång och ett extra före kvalet – ger spelarna
stjärnor för rätt svar. Arkitekturen står i `MATCHDAGEN.md` §15.

### Vad som byggts

- **Motorn** `src/matchdagen/delat/md-trupp.js` (ren): priset `avrunda(150 × st^1,9; 10)`, marknaden (6 spelare,
  stjärnor efter divisionen, nya efter varje match och kval), köpet (ersätter den sämsta på positionen; en köpt
  säljs för halva priset, en grundpelare går till reserverna; fulla reserver → eleven släpper en köpt reserv),
  byten, träningslägret (12 poäng per rätt, 100 → en stjärna, taket 5★), kaptensbindeln och lagdelarnas snitt.
- **Truppen** (`vy/md-vy-trupp.js`, `md-vy-marknad.js`): klubbkassan, lagdelarna med lagbonusen ("räddningar
  +10 %"), förklaringen "Bättre spelare ger bättre chans, men rätt svar avgör ändå mest.", startelvan med
  stjärnor och träningsstapel ("36/100 träning"), Grundpelare och C, reserverna ("Byt in för …") och marknaden
  ("Köp för 1 210 kr" – "Ersätter Alvin Virtanen – grundpelaren går till reserverna", eller varför det inte går).
  Sidhuvudets kassa följer med.
- **Träningslägret** (`vy/md-vy-lager.js`): välj en startspelare under 5★ → 8 frågor ur samma frågeström som
  matchen (`vy/md-strom.js`) → stjärnorna och stapeln växer vid varje rätt svar och "Melvin Lind fick en stjärna
  till!". Varje svar sparas lokalt vid klicket (`vidSvar`), lägret med EN skrivning när alla 8 är besvarade.
  Frågorna räknas i statistiken som källan "Träning".
- **Spärrarna:** Match-fliken väntar på ett påbörjat läger ("Gör klart träningen först"); köp, byten och läger
  väntar på en pågående match och på kön av osparade matcher. Före avspark påminns eleven om ett ledigt läger.
- **Sparningen:** `reserver`, `marknad`, `lager` i karriären; `sparaTrupp` (en skrivning per köp/byte/läger);
  en ny klubb som aldrig hann sparas skapas först från noll (`forstaDokument`); en kö som nekas för att truppen
  ändrats någon annanstans sparas ovanpå serverns trupp (`ovanpaServern`).
- **Reglerna:** truppen, reserverna, marknaden, kassan och lägret prövas per skrivning mot det sparade dokumentet
  (nyckel MT i `BEHORIGHETER.md`).
- **Ekonomin:** inkomsterna halverade mot specen (§8.3) för målet i §12 (se Balansen).
- **Förhandsvisningen:** `?kassa=N` och `?trupp=visa` (två köpta spelare, grundpelare bland reserverna, träning).

### Tester

- `test/matchdagen-trupp.test.js` (node, §15 Motorn): priserna och reglernas pristabell/stjärntak, marknaden (6,
  otränade, unika, deterministiska, ny efter match och kval), köpet (grundpelaren till reserverna, köpt säljs för
  halva priset, inte bättre/för dyrt, fulla reserver: bara köpta kan släppas, fem grundpelare stoppar köpet),
  byten, kaptensbindeln, äldre dokument; lägret (12 per rätt, 100 → stjärna, resten följer med, taket 5★,
  nycklarna per omgång och före kvalet, statistiken som "traning", två läger → stjärna, nekade läger);
  lagbonusen (tränad lagdel ger högre skott- och räddningschans); det pågående lägret i `localStorage`; korten
  escapar allt (XSS i namn, position, id, `st`/`xp`/`nr` som text); `forstaDokument`; kön ovanpå serverns trupp.
- `test/firestore-rules-matchdagen-trupp.test.js` (emulator, i `npm run test:rules`): en ny klubb (bara nya
  grundpelare, ingen marknad/reserv), äldre dokument, marknaden ≤ 6 och det som köps (otränat, utan grundpelare,
  2★ till divisionens tak), köp med och utan betalning, påhittade spelare och reserver, byten, fulla reserver,
  lägret (+96, en stjärna för mycket, utan att lägret byts, nycklarna), lägret och matchen var för sig, kassan
  (+400 utan match, 5 000 per match, 501 matcher), en kö med 40 matcher, kön ovanpå serverns trupp, läraren.
- Uppdaterade: `firestore-rules-matchdagen*.test.js` (nya fält), `matchdagen-balans`, `-kval`, `-liga`, `-sasong`.

### Skärmdumpar

Förhandsvisningen (`preview/preview-matchdagen.html`, 1366 × 900; `08` i 375 px).

| Bild | Vad |
| --- | --- |
| [`01-truppen.png`](qa-matchdagen-2b/01-truppen.png) | Truppen (`?omg=2&trupp=visa`): kassan, lagdelarna, lägret, startelvan med stjärnor och stapel, två reserver, marknaden med orsakerna |
| [`02-kopt.png`](qa-matchdagen-2b/02-kopt.png) | Efter ett köp med fulla reserver: "Wilma Forsberg är köpt för 2 090 kr! … Liam Holm såldes för 605 kr." och kassan 1 115 kr |
| [`03-reserverna-fulla.png`](qa-matchdagen-2b/03-reserverna-fulla.png) | Rutan "Reserverna är fulla" – bara den köpta reserven kan släppas |
| [`04-lager-fortsatter-efter-omladdning.png`](qa-matchdagen-2b/04-lager-fortsatter-efter-omladdning.png) | Lägret efter en omladdning: fortsätter på fråga 4 av 8 |
| [`05-lager-stjarna.png`](qa-matchdagen-2b/05-lager-stjarna.png) | "Melvin Lind fick en stjärna till!" – 3★ → 4★, stapeln börjar om på 8/100 |
| [`06-lager-klart.png`](qa-matchdagen-2b/06-lager-klart.png) | "Träningen är klar! 7 av 8 rätt. Melvin Lind har nu 4★ och 68/100 träningspoäng." |
| [`07-match-vantar-pa-lagret.png`](qa-matchdagen-2b/07-match-vantar-pa-lagret.png) | Match-fliken under ett påbörjat läger: "Gör klart träningen först" |
| [`08-mobil-truppen.png`](qa-matchdagen-2b/08-mobil-truppen.png) | 375 px: lagdelarna två och två, lägret, statusraden efter köpet – ingen sidledsscroll |

### Balansen (`npm run balans:matchdagen`)

- **Ekonomin (§12): 60 % rätt har råd med en 3★ efter 2,94 matcher** i snitt (median 3, 89 % inom tre matcher;
  mål 2,5–3,5). Med specens belopp (300/150/80 + 15/rätt + 25/mål) var det 1,74 – alla inkomster halverades
  (`KASSA`: 150/75/40 + 8/rätt + 12/mål, uppflyttningen 300). Priset och stjärnorna på marknaden är specens.
- **Superligan (§12): 80 % rätt med tränat lag (snitt 4★) vinner 47 %** (mål 45–55 %). Helt tränat (5★): 69 %.
- **Karriären med truppen** (robotklubbar som tränar varje läger och köper den största förbättringen): 80 % når
  Superligan efter median 8 säsonger (11 h), 70 % efter 12 (17 h), 60 % i 44 % av fallen inom 30 säsonger; 50 %
  kommer sällan förbi Division 1. Laget är helt tränat (5★) kring Division 2 – se öppna frågan nedan.
- Resten av utskriften (Division 6, alla divisioner, karriären med startlaget) är oförändrad mot 2a (fasta frön).

<details><summary>2b-tabellerna ur utskriften (116 s)</summary>

```
Ekonomin i Division 6 (1000 elever per rad): efter hur många matcher har eleven råd med en 3★ som finns till salu?

Rätt  Spelare  Pris     kr/match  Matcher (snitt)  Median  Inom 2  Inom 3  Inom 4  Mål
50 %  3★       1210 kr  214       3,42             3       3 %     57 %    97 %    –
60 %  3★       1210 kr  254       2,94             3       17 %    89 %    100 %   ja
70 %  3★       1210 kr  291       2,65             3       37 %    98 %    100 %   –

Karriären med truppen (100 elever × 30 säsonger; tränar varje läger, köper den största förbättringen): andel · median säsonger · speltimmar · lagets snitt när divisionen nås · vinst där

Rätt  Division 6         Division 5                                  Division 4                                  Division 3                                   Division 2                                   Division 1                                    Elitligan                                    Superligan
80 %  2,0★ · vinst 79 %  100 % · 1 säs. · 0,9 h · 2,3★ · vinst 81 %  100 % · 2 säs. · 1,9 h · 3,1★ · vinst 88 %  100 % · 3 säs. · 3,2 h · 4,1★ · vinst 88 %   100 % · 5 säs. · 5,1 h · 5,0★ · vinst 87 %   100 % · 6 säs. · 6,8 h · 5,0★ · vinst 81 %    100 % · 7 säs. · 8,7 h · 5,0★ · vinst 76 %   100 % · 8 säs. · 11,3 h · 5,0★
70 %  2,0★ · vinst 68 %  100 % · 2 säs. · 1,6 h · 3,0★ · vinst 73 %  100 % · 3 säs. · 2,7 h · 3,6★ · vinst 82 %  100 % · 4 säs. · 4,1 h · 4,4★ · vinst 74 %   100 % · 6 säs. · 6,0 h · 5,0★ · vinst 72 %   100 % · 7 säs. · 8,5 h · 5,0★ · vinst 65 %    100 % · 9 säs. · 11,4 h · 5,0★ · vinst 56 %  100 % · 12 säs. · 17,1 h · 5,0★
50 %  2,0★ · vinst 48 %  100 % · 5 säs. · 4,0 h · 3,3★ · vinst 61 %  100 % · 8 säs. · 6,6 h · 4,9★ · vinst 72 %  100 % · 10 säs. · 8,6 h · 5,0★ · vinst 44 %  92 % · 15 säs. · 15,0 h · 5,0★ · vinst 36 %  40 % · 21 säs. · 23,3 h · 5,0★ · vinst 30 %   7 % · 22 säs. · 26,1 h · 5,0★ · vinst 22 %   –
60 %  2,0★ · vinst 58 %  100 % · 3 säs. · 2,4 h · 3,0★ · vinst 67 %  100 % · 5 säs. · 4,3 h · 4,0★ · vinst 75 %  100 % · 6 säs. · 6,0 h · 5,0★ · vinst 59 %   100 % · 9 säs. · 8,9 h · 5,0★ · vinst 54 %   100 % · 12 säs. · 13,7 h · 5,0★ · vinst 48 %  93 % · 18 säs. · 23,5 h · 5,0★ · vinst 39 %  44 % · 25 säs. · 34,8 h · 5,0★


```

</details>

### Kvoten (2b, §13)

Inga nya läsningar och inga lyssnare: lägret använder frågeströmmen som redan är laddad, köpen och bytena läser
inget. Ett läger = 1 skrivning, ett köp eller byte = 1 skrivning. En kö som nekas och sparas ovanpå serverns
trupp läser karriären en gång (sällsynt).

| Eleven under en timme | Läsningar | Skrivningar |
| --- | --- | --- |
| Öppna Matchdagen, frågekällorna (3 Plugga-områden), 3 matchdetaljer | ≈ 8 | 0 |
| ~6 matcher (lägren tar ~1,5 min var) | 0 | 12 (6 batchar à 2) |
| **5 träningsläger** | 0 | 5 |
| 3 köp/byten + ett namnbyte | 0 | 4 |
| **Summa** | **≈ 8** (mål < 20) | **≈ 21** (mål < 50) |

### Reglerna och 1000-uttrycksgränsen

Allt i `validMatchdagen` räknas mot Firestores gräns på 1000 uttryck per begäran, och en ny klubb låg redan nära
i 2a. Därför prövas spelarnas form bara där de kommer in utifrån (en ny klubb, ett köp) och vid en uppdatering
varifrån varje startspelare kommer, jämfört med det sparade dokumentet (`MATCHDAGEN.md` §15.4). Två sparade
uttryck: inga `hasAll` i `mdKlubbOk`/`mdSummaOk`/`mdKvalOk` (en saknad nyckel ger ändå ett utvärderingsfel), och
en ny klubb jämför summan med en nollad map (`mdTomSumma`) i stället för hela `mdSummaOk`.

**Marginalen** (mätt i emulatorn: hur många extra `(d.div == d.div) &&` som ryms i `validMatchdagen` innan
skrivningen nekas, med karriärer byggda av de riktiga modulerna):

| Skrivning | Marginal |
| --- | --- |
| Ny klubb (`create`) | 30 |
| En match | 40 |
| Ett träningsläger | 18 |
| Ett köp (grundpelaren till reserverna) | 35 |
| Ett köp med fulla reserver (en köpt släpps) | 30 |
| Hela säsongen (5 matcher) i en skrivning (kön) | 18 |
| Hela säsongen + kvalet i en skrivning | 15 |
| Läger + match i samma skrivning | **nekas** – därför väntar Match-fliken på lägret |

Varje ny regel för karriären bör mätas på samma sätt (riggen: en kopia av reglerna med N extra uttryck,
`initializeTestEnvironment` per N).

### Deploy

**`firebase deploy --only firestore:rules` före webben.** De gamla reglerna nekar fältet `lager` – med webben
först kan inget träningsläger sparas (köp och byten går, men utan kontrollen). De nya reglerna godtar äldre
dokument utan `reserver`/`marknad`/`lager`, så reglerna kan gå ut före webben utan att något går sönder. Inga
index, inga functions.

### Val där dokumentet inte räckte till

1. **Ekonomin halverad** (§8.3-beloppen × 0,5) för §12-målet; uppflyttningen 300 = 600 × 0,5.
2. **Priset för 5★ är 3 190 kr** (formeln) – specen skriver "ungefär 3 150".
3. **Marknaden är tom i en ny klubb** och fylls efter första matchen (en ny klubb ska vara billig för reglerna).
   Äldre dokument får en marknad efter nästa match.
4. **"Den sämsta på samma position"** = lägst stjärnor, sedan träningspoäng; vid lika ersätts grundpelaren (den
   går till reserverna i stället för att en köpt säljs). Ett köp som inte ger fler stjärnor än den ersatta går
   inte ("Inte bättre än …").
5. **Kassan räcker** när kassan + återbetalningen för en såld startspelare täcker priset; en släppt reserv räknas
   inte in.
6. **Reserver tränas inte och lägret gäller startelvan** (skissens lista); en reserv byts in på samma position.
7. **Lägret:** ett per spelad omgång (inget före första matchen), ett extra före kvalet; ett läger som inte
   används före nästa match går förlorat (skissen). Alltid 8 frågor, också när spelaren når 5★ mitt i.
   Poängen över 100 följer med till nästa stjärna (skissens `xp -= 100`); vid 5★ nollas de.
8. **Lägret sparas en gång, efter 8 svar** – svaren sparas lokalt vid varje klick. Match-fliken väntar på ett
   påbörjat läger (lägret och matchen i samma skrivning spräcker 1000-gränsen, och matchen skulle stänga lägret).
9. **Lagkaptenen kan säljas till reserverna** (specen förbjuder det inte); bindeln går då till den första
   grundpelaren ute på planen.
10. **Målvaktens bonus visas dubbel** ("räddningar +10 %" vid 3★) – så räknar motorn sedan 1b (`RADDNING.bonus`).
11. **Reglerna prövar inte positionerna** eller att lägret är nyare än det sparade, och kassan bara per skrivning
    – bara elevens eget spel (inga pluggmynt), se `MATCHDAGEN.md` §15.4.

### Öppna frågor till Elias

1. **Träningen går fort:** med specens tal (12 poäng, ett läger per omgång) är laget helt tränat (5★) kring
   Division 2, och i Superligan vinner 80 % rätt med 5★ ~69 % (§12-målet 45–55 % gäller 4★). Vill du ha det
   tuffare högst upp: färre poäng per rätt högre upp, eller ett läger varannan omgång?
2. **Ekonomin:** halveringen gäller också uppflyttningen (300 × multiplikatorn). OK?

### Så testas det

- **Förhandsvisningen:** `PORT=8871 node server.mjs` → `preview/preview-matchdagen.html?ny=1&omg=2&trupp=visa&vy=trupp`
  (Truppen, köp, byt in, lägret), `?omg=3&kassa=4000&vy=trupp` (köp med grundpelare till reserverna). Ladda om
  mitt i lägret → det fortsätter; Match-fliken → "Gör klart träningen först".
- **Appen mot emulatorn:** `MD_PA=1 PORT=8871 bash admin/qa-matchdagen-867-preview.sh` – Alva: spela en match →
  Truppen: köp en spelare (kassan i sidhuvudet minskar), kör ett läger (stjärnan/stapeln växer) → ladda om →
  allt finns kvar.

### Körningar (Codern, 871)

SUITES_TODO
