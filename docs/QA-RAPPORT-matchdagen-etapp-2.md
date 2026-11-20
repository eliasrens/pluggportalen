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

KÖRNINGAR
