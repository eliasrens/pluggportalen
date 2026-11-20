# QA-rapport – Matchdagen Etapp 2 (epic #866)

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) §16 (rapport efter varje etapp).
Arkitekturen: [`MATCHDAGEN.md`](MATCHDAGEN.md). Etapp 1: [`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md).

## Etapp 2 – sammanfattning (2a #870, 2b #871, 2c #872)

Etapp 2 är klar. Detaljerna per steg står i avsnitten nedan; här är helheten för den som ska deploya och spela.

**Vad som byggts:** hela stegen Division 6 → Superligan (6–12 lag, 5–11 omgångar), kvalet för ligavinnaren med
straffläggning, finten från Division 3 (2a); truppen med reserver, marknaden, köp/byten och träningslägret, och
en halverad ekonomi (2b); Silverpokalen mellan ligaomgångarna, rekorden med annons efter matchen och pokalerna
som rader (2c). Allt nytt ligger i `src/matchdagen/` (motorn ren i `delat/`), bootgrafen är oförändrad (107 filer)
och ingen fil är över 400 rader. Arkitekturen: `MATCHDAGEN.md` §14–16.

**Skärmdumpar** (spec §16):

| Vad | Bilder |
| --- | --- |
| Stegen och tabellen | [2a/01](qa-matchdagen-2a/01-tabell-stegen-kval.png), [2a/02](qa-matchdagen-2a/02-tabell-elitligan-12-lag.png) |
| Kvalet | [2a/01](qa-matchdagen-2a/01-tabell-stegen-kval.png), [2a/05](qa-matchdagen-2a/05-kval-forlorat-straffar.png), [2a/07](qa-matchdagen-2a/07-uppflyttning.png), [2a/09 appen](qa-matchdagen-2a/09-app-emulator-uppflyttning.png) |
| Straffarna (3D och 2D) | [2a/03](qa-matchdagen-2a/03-straff-3d-var.png), [2a/04](qa-matchdagen-2a/04-straff-3d-deras.png), [2a/06](qa-matchdagen-2a/06-straff-2d.png), [2a/08 appen](qa-matchdagen-2a/08-app-emulator-straff.png) |
| Truppen | [2b/01](qa-matchdagen-2b/01-truppen.png), [2b/08 mobil](qa-matchdagen-2b/08-mobil-truppen.png) |
| Marknaden | [2b/02](qa-matchdagen-2b/02-kopt.png), [2b/03](qa-matchdagen-2b/03-reserverna-fulla.png) |
| Träningslägret | [2b/04](qa-matchdagen-2b/04-lager-fortsatter-efter-omladdning.png), [2b/05](qa-matchdagen-2b/05-lager-stjarna.png), [2b/06](qa-matchdagen-2b/06-lager-klart.png), [2b/09 appen](qa-matchdagen-2b/09-app-emulator-efter-omladdning.png) |
| Cupen | [2c/01](qa-matchdagen-2c/01-tabell-silverpokalen.png), [2c/02](qa-matchdagen-2c/02-match-cup-vantar.png), [2c/05](qa-matchdagen-2c/05-cup-vunnen.png), [2c/06 mobil](qa-matchdagen-2c/06-mobil-cup-ute.png) |
| Rekorden | [2c/03](qa-matchdagen-2c/03-nytt-rekord.png), [2c/04](qa-matchdagen-2c/04-statistik-rekord.png), [2c/07 mobil](qa-matchdagen-2c/07-mobil-rekord.png) |
| Matchen i 3D och 2D | Etapp 1: [`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md) (planen är oförändrad i Etapp 2 utom straffarna) |

**Bilder per sekund:** planen är oförändrad sedan Etapp 1, utom straffkameran (2a). Mätt igen på 2c:s kod i
förhandsvisningen, en cupmatch i 3D (`?omg=2&fps=1&auto=1`, 1366 × 900, huvudlös Chromium med SwiftShader,
mjukvaru-WebGL på en lastad server utan GPU): **19,8 fps i snitt, lägst 12** – samma nivå som Etapp 1:s 20–32 fps i
samma miljö. **Specens ≥ 50 fps på skolans HP-datorer är fortfarande inte uppmätt** (ingen GPU här). Mät på en
HP-dator med `/?fps=1#/elev/matchdagen` (Etapp 1-rapporten); under 50 fps → `?2d=1` för de eleverna.

**Balansen** (`npm run balans:matchdagen`, ~2,5 min, fasta frön):

- Division 6 som i Etapp 1: 70 % rätt vinner 61 % och ligan 59 %; 50 % vinner 34 %.
- **Superligan, 80 % rätt, tränat lag 4★: 47 % vinster** (§12: 45–55 %); helt tränat 5★ 69 %.
- **Ekonomin:** 60 % rätt har råd med en 3★ efter 2,94 matcher (§12: 2,5–3,5) – inkomsterna halverade mot specen.
- **Karriären med truppen:** 80 % rätt når Superligan efter median 8 säsonger (15 h), 70 % efter 12 (22 h), 60 %
  i 44 % av fallen inom 30 säsonger, 50 % sällan förbi Division 1.
- **Silverpokalen:** 70 % rätt i Division 6 vinner cupen 25 % av säsongerna och slår ett lag från en högre
  division i 64 % av mötena; säsongen i Division 6 blir 51 → 72 min med cupen.

**Kvoten** (§13), eleven under en timme: **≈ 8 läsningar och ≈ 26 skrivningar** (mål < 20 / < 50) – ~6 matcher
(cupmatcherna inräknade), 5 träningsläger (2 skrivningar var), 3 köp/byten. Inga lyssnare, inga nya läsningar i
Etapp 2. Lärarens vy läser ett dokument per elev, som i 1c.

**Deploy** – Matchdagen är inte i drift än, så Etapp 1 och 2 går ut tillsammans:

1. `firebase deploy --only firestore:rules`
2. Webben (Pages), **direkt efter** – inte senare. Reglerna och webben hör ihop i 2b (marknaden som textrader,
   `lager`) och 2c (`cup`/`rekord` som text, pokalerna som rader): en gammal webb mot de nya reglerna får pokaler
   och marknad nekade, en ny webb mot gamla regler får `lager`, `cup` och `rekord` nekade. Matcher som nekas
   ligger kvar i den lokala kön och sparas när båda är ute – inget går förlorat, men glappet ska vara kort.

Inga index, inga functions, ingen datamigrering.

**Öppna frågor till Elias** (samlade):

1. Träningen går fort – laget är helt tränat (5★) kring Division 2, och 80 % rätt vinner ~69 % i Superligan med
   5★ (§12-målet gäller 4★). Färre poäng per rätt högre upp, eller ett läger varannan omgång? (2b)
2. Ekonomin är halverad mot specen, också uppflyttningen och cupens pris (200 × mult.). OK? (2b, 2c)
3. Säsongen i Division 6 tar ~72 min med cupen (§12: 45–60). Färre cuprundor i de lägsta divisionerna? (2c)
4. Rekord annonseras bara när ett gammalt slås, inte första gången. OK? (2c)

**Kända gränser** (alla bara elevens eget spel – Matchdagen ger inga pluggmynt; `MATCHDAGEN.md` §15.4, §16.4):

- Att en match verkligen spelats prövas inte: `summa.matcher` +1 ger upp till 5 000 kr och en ny marknad.
- En egen marknad i rätt form kan skrivas när summan ändras; lägret kan växlas fram och tillbaka; positionerna
  prövas inte.
- Att cupen och rekorden stämmer med matcherna prövas inte.
- Dokumentets storlek: strängarna i ligans lag, `senaste` och `sasonger` prövas inte (upp till 1 MiB förbi appen;
  appens dokument ≤ ~61 kB). Marknaden och pokalerna prövas.
- F9: ett köp + en inbytt köpt reserv i samma skrivning ger högst +400 kr.
- Läger + match i samma skrivning ryms inte i 1000-gränsen – därför väntar Match-fliken på ett påbörjat läger.

**Körningar på Etapp 2:s slutliga kod (2c-grenen):** se "Körningar (Codern, 872)" sist i rapporten.

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
  till!". Lägret märks som påbörjat på servern före första frågan (EN skrivning), varje svar sparas lokalt vid
  klicket (`vidSvar`), lägret med EN skrivning när alla 8 är besvarade. Frågorna räknas i statistiken som källan
  "Träning". Omladdning mitt i lägret: se nedan.
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
  nycklarna per omgång och före kvalet, statistiken som "traning", två läger → stjärna, nekade läger, påbörjat
  läger `-p`: samma läger tills klart/avbrutet, gammal omgång öppnar ett nytt, kvalets extra läger, minnet utan
  lokal lagring);
  lagbonusen (tränad lagdel ger högre skott- och räddningschans); det pågående lägret i `localStorage`; korten
  escapar allt (XSS i namn, position, id, `st`/`xp`/`nr` som text); `forstaDokument`; kön ovanpå serverns trupp.
- `test/firestore-rules-matchdagen-trupp.test.js` (emulator, i `npm run test:rules`): en ny klubb (bara nya
  grundpelare, ingen marknad/reserv), äldre dokument, marknaden ≤ 6 och det som köps (otränat, utan grundpelare,
  2★ till divisionens tak), köp med och utan betalning, påhittade spelare och reserver, byten, fulla reserver,
  lägret (+96, en stjärna för mycket, utan att lägret byts, nycklarna med och utan `-p`, start → klart och start →
  avbrutet), lägret och matchen var för sig, kassan
  (+400 utan match, 5 000 per match, 501 matcher), en kö med 40 matcher, kön ovanpå serverns trupp, läraren.
- Uppdaterade: `firestore-rules-matchdagen*.test.js` (nya fält), `matchdagen-balans`, `-kval`, `-liga`, `-sasong`.

### Skärmdumpar

`01`–`08` i förhandsvisningen (`preview/preview-matchdagen.html`, 1366 × 900; `08` i 375 px), `09` i appen mot emulatorn.

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
| [`09-app-emulator-efter-omladdning.png`](qa-matchdagen-2b/09-app-emulator-efter-omladdning.png) | Appen mot emulatorn (Alva, `MD_PA=1 MD_TRUPP=1`): efter köp, byte fram och tillbaka och ett läger – omladdad: 1 790 kr, Leah Ström 3★ 96/100, Isak Berglund bland reserverna, lägret använt |

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

### Omladdning eller stängd flik mitt i lägret

Lägret **fortsätter med svaren det redan har** – eller räknas som **använt**. Aldrig ett nytt läger, aldrig en
ny chans på en fråga som redan besvarats:

- **Start:** innan första frågan sparas `lager = "säsong-omgång-p"` (påbörjat) på servern – EN skrivning. Går den
  inte fram startar lägret inte ("Träningen kunde inte startas …").
- **Omladdning / stängd flik / flikbyte:** svaren ligger i `localStorage` (`matchdagen-lager:{uid}`, sparade vid
  klicket, före pausen med rätt svar). Lägret fortsätter på nästa obesvarade fråga med samma spelare.
- **`localStorage` rensad** (eller en annan dator, eller den tränade spelaren finns inte kvar i startelvan): servern
  säger påbörjat men inga svar finns – lägret räknas som **använt** ("Träningslägret avbröts innan det var klart
  – det räknas som använt."), `lager = "säsong-omgång"` utan träning (EN skrivning). Före kvalet blir sedan
  kvalets extra läger ledigt som vanligt. Ett påbörjat läger stänger också sig självt när nästa match spelas.
- **Privat fönster** (ingen lokal lagring): lägret gäller i minnet så länge sidan är öppen (flikbyten inom
  Matchdagen fortsätter); en omladdning räknas som rensad lagring → använt.
- **Kvar** (bara förbi appen eller samtidigt på två datorer, inga pluggmynt): en elev som skriver förbi appen kan
  fortfarande växla lägret fram och tillbaka (§15.4, val 11); en andra dator som laddades **innan** lägret
  startades på den första kan starta samma läger igen.

### Kvoten (2b, §13)

Inga nya läsningar och inga lyssnare: lägret använder frågeströmmen som redan är laddad, köpen och bytena läser
inget. Ett läger = 2 skrivningar (start + klart), ett köp eller byte = 1 skrivning. En kö som nekas och sparas ovanpå serverns
trupp läser karriären en gång (sällsynt).

| Eleven under en timme | Läsningar | Skrivningar |
| --- | --- | --- |
| Öppna Matchdagen, frågekällorna (3 Plugga-områden), 3 matchdetaljer | ≈ 8 | 0 |
| ~6 matcher (lägren tar ~1,5 min var) | 0 | 12 (6 batchar à 2) |
| **5 träningsläger** | 0 | 10 (start + klart) |
| 3 köp/byten + ett namnbyte | 0 | 4 |
| **Summa** | **≈ 8** (mål < 20) | **≈ 26** (mål < 50) |

### Reglerna och 1000-uttrycksgränsen

Allt i `validMatchdagen` räknas mot Firestores gräns på 1000 uttryck per begäran, och en ny klubb låg redan nära
i 2a. Därför prövas spelarnas form bara där de kommer in utifrån (en ny klubb, ett köp) och vid en uppdatering
varifrån varje startspelare kommer, jämfört med det sparade dokumentet (`MATCHDAGEN.md` §15.4). Två sparade
uttryck: inga `hasAll` i `mdKlubbOk`/`mdSummaOk`/`mdKvalOk` (en saknad nyckel ger ändå ett utvärderingsfel), och
en ny klubb jämför summan med en nollad map (`mdTomSumma`) i stället för hela `mdSummaOk`.

**Marginalen** (mätt i emulatorn: hur många extra `(d.div == d.div) &&` som ryms i `validMatchdagen` innan
skrivningen nekas, med karriärer byggda av de riktiga modulerna; riggen `.scratch/zz-mat.test.js`). Före = f84e8500,
runda 1 = marknaden som rader och F1–F5, runda 2 = F6–F7 (mätt på slutliga regler):

| Skrivning | Före (f84e8500) | Runda 1 | Runda 2 |
| --- | --- | --- | --- |
| Ny klubb (`create`) – nu med ett reguljärt uttryck över alla sju spelarna (F2) | 30 | 8 | 8 |
| En match (marknaden prövas nu med ett uttryck) | 40 | 40 | 40 |
| Ett träningsläger | 18 | 16 | 16 |
| Lägrets start (`"-p"`, bara `lager`) | – | ≥ 50 | ≥ 50 |
| Ett köp (grundpelaren till reserverna) | 35 | 28 | 22 |
| Ett köp med fulla reserver (en köpt släpps) | 30 | 26 | 18 |
| Ett byte | – | ≥ 50 | ≥ 50 |
| 4 matcher i en skrivning (kön) | 18 | 18 | 18 |
| Kvalet | 15 | 12 | 12 |
| Hela säsongen + kvalet i en skrivning (ny klubb offline en hel säsong) | 2 | 2 | 2 |
| Läger + match i samma skrivning | **nekas** | **nekas** | **nekas** – därför väntar Match-fliken på lägret |

Den tunnaste är en ny klubb som spelar en hel säsong och kvalet offline och sparar allt i en skrivning (2, samma
som före runda 1). En ny regel för karriären som rör en matchsparning bör mätas med den.

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
8. **Lägret sparas två gånger: påbörjat (före första frågan) och klart (efter 8 svar)** – svaren sparas lokalt
   vid varje klick; utan lokala svar räknas ett påbörjat läger som använt (se Omladdning ovan). Match-fliken väntar på ett
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
- **Appen mot emulatorn:** `MD_PA=1 MD_TRUPP=1 PORT=8872 bash admin/qa-matchdagen-867-preview.sh` (Alva har spelat två omgångar och har 3 000 kr) – Alva:
  Truppen: köp en spelare (kassan i sidhuvudet minskar), kör ett läger (stjärnan/stapeln växer) → ladda om →
  allt finns kvar.

### Körningar (Codern, 871)

| Svit | Resultat |
| --- | --- |
| `node --test` (de 319 filerna som inte kräver emulatorn) | 4621 pass, 0 fail, 1 skipped. (6 "cancelled" i `firestore-rules-amneslasning-texter.test.js` – en emulatorfil som inte står i något npm-skript, oförändrad) |
| Matchdagen (`test/matchdagen-*.test.js`) | 200 pass (ingår ovan; 27 nya i `matchdagen-trupp.test.js`) |
| `npm run test:rules` (`admin/qa-matchdagen-867-svit.sh`) | 1071 pass, 0 fail (17 i `firestore-rules-matchdagen-trupp.test.js`) |
| `npm run test:functions` (samma rigg) | 573 pass, 0 fail, 2 kända TODO (schack F9) – inga filer i `functions/` ändrade i 2b |
| `npm run test:e2e` | 5/5 |
| Bootgrafen | 107 filer (oförändrad, `test/matchdagen-modul.test.js`) |
| `npm run balans:matchdagen` | 116 s – tabellerna ovan; Division 6/alla divisioner/startlaget identiska med 2a |
| Marginalen mot 1000-gränsen | mätt per skrivning (tabellen ovan) |

**I appen mot emulatorn** (Alva, `MD_PA=1 MD_TRUPP=1`, 2D): Truppen → köp Leah Ström 3★ för 1 210 kr ("Isak Berglund
sitter bland reserverna", kassan i sidhuvudet 3 000 → 1 790) → byt in Isak och tillbaka → träningslägret 8 av 8
rätt (Leah 96/100) → omladdning: allt kvar, lägret använt. Sedan en hel match (2 – 1, +398 kr) – sparad mot
reglerna (kön tom), kassan 2 188 kr, ett nytt läger öppet och en ny marknad.

### Granskningen (code review på 70cd7504..6f9f6fd2) – rättat

- **M1 (medel), en kö som spelats medan truppen ändrades någon annanstans låstes för alltid.** Reglerna godtar
  bara spelare ur det sparade dokumentet, och `hamtaKarriar` väljer den lokala karriären (flest matcher). Spelade
  eleven offline på en dator och köpte/tränade på en annan – eller gick ett köp fram fast svaret aldrig kom – nekades
  varje matchsparning, och köp/läger väntade på kön. Nu läser `sparaKon` serverns karriär EN gång vid ett nekande och
  lägger kön ovanpå dess trupp, reserver och läger (`ovanpaServern`; kassan = serverns + köns pengar, högst den
  lokala). Tester i `matchdagen-trupp.test.js` och regeltestet "en kö som spelats medan truppen ändrades …".
- **L1, mer än 30 osparade matcher låste sparningen** (regeln Δ`summa.matcher` ≤ 30, men kön räknar alla matcher
  i karriären). Nu ≤ 500 per skrivning (samma kostnad); regeltest med 40.
- **L2, lägret kunde startas medan ett köp sparades** – två frågeslingor i samma yta. Nu väntar köp och läger på
  varandra (`S.truppUpptagen`), och ett nytt `visaLager` avbryter det förra (en signal per yta).
- **L3, ett flikbyte hoppade över en svår fråga** i lägret. Nu visas samma fråga igen när eleven kommer tillbaka
  (samma läger och plats; en omladdning ger en ny, som i matchen).
- **L4 (dokumenterat, inte rättat):** en elev som skriver förbi appen kan växla `lager` fram och tillbaka och träna
  mer – att lägret är nyare prövas inte (för många uttryck). Bara det egna spelet; står i reglerna och §15.4.
- Inget i XSS (allt ur dokumentet `esc()`/tal i vyerna), avbrottet vid flikbyte, de vanliga skrivningarna mot reglerna
  eller äldre dokument.

### Rättningsrunda 1 (Testern på f84e8500) – F1–F5 i reglerna

Alla fem är skrivningar förbi appen. Rättat i `firestore.rules`, varje fall med ett regeltest i
`test/firestore-rules-matchdagen-trupp.test.js` (sist i filen), och Testerns diagnostik
(`firestore-rules-matchdagen-trupp-tester-871.test.js`) skriver nu "NEKAS" för alla fem.

- **F1 (hög), marknaden prövades inte alls** (st 9, HTML, 6 × 150 kB gick igenom). Marknaden sparas nu som rader
  `"id|namn|pos|nr|st"` (`md-trupp.js saluRad`; appen gör om dem vid skrivning och läsning i `md-data.js`) och
  prövas i varje matchsparning med ETT reguljärt uttryck över hela listan (`join`): högst 6 rader, id `k` + 1–6
  tecken, namn 1–40 tecken utan `| / < > & "`, en känd position, nr 0–99, 1–5★. Allt annat – ett objekt, en text
  som inte passar, 7 rader – nekas. Utan match kan marknaden bara krympa med ett köp. Marknaden är därmed högst
  ~400 byte (dokumentets totala storlek prövas inte – se F8 i rättningsrunda 2).
- **F2 (hög), en ny klubb kunde bära ett extra fält på ~130 kB per spelare.** `create` prövar nu exakt de åtta fälten
  per grundpelare (`size() == 8`, varje fält läses), `g1`–`g7` i ordning, namn 1–40 utan HTML, en känd position, `nr`
  ≤ 3 siffror, `st` 2, `xp` 0 och `grundpelare`/`kapten` som sanningsvärden – med ett reguljärt uttryck över alla sju
  (`"+ 0"` och `"!"` ger ett fel för text). Ett köp tar exakt raden ur marknaden och bara dess sex fält. Efter det
  kommer varje spelare oförändrad ur det sparade dokumentet eller tränad (bara `st`/`xp`), så formen håller (induktion).
- **F3 (medel), en grundpelare kunde strykas, och en spelare klonas via reserverna.** Vid ett byte eller köp
  (`mdUnikaOk`): inga dubbletter i truppen + reserverna, och högst EN spelare lämnar klubben – aldrig en grundpelare.
  En reserv kommer in på planen bara när reserverna ändras, och ett läger kan inte ändra reserverna (då kunde den
  otränade kopian hamna där).
- **F4 (medel), samma marknadsspelare köpt till två platser, betald en gång.** Dubbletten nekas (F3), och ett köp
  kräver att raden är borta ur marknaden, att marknaden är den sparade minus exakt EN rad och att summan inte ändras
  i samma skrivning – två köp i en skrivning går inte.
- **F5 (medel), kassan +400 per skrivning utan match.** Utan en ökad `summa.matcher` får kassan bara växa när
  reserverna ändras (skärpt i runda 2 till bara ett köp, F6) (köpet där en släppt köpt reserv ger mer än köpet kostar, högst 1 600 − priset; `mdKopOk` prövar
  beloppet).

**Gränser som återstår** (bara elevens eget spel, inga pluggmynt – står också i `MATCHDAGEN.md` §15.4):

- **Påhittade matcher:** att en match spelats prövas inte. `summa.matcher` +1 ger upp till 5 000 kr och en ny marknad
  (högst 500 matcher per skrivning, för kön).
- **En egen marknad:** när summan ändras (även bara `summa.fragor` +1) kan eleven skriva en egen marknad i rätt form och
  sedan köpa ur den – till fullt pris och högst divisionens stjärntak. Valet av spelare, aldrig en gratis spelare.
- **Lägret** kan växlas fram och tillbaka för mer träning, och **positionerna** prövas inte (som före runda 1).
- **Dokumentets storlek** (F8): strängarna i ligans lag, `senaste`, `sasonger` och `pokaler` prövas inte – upp till 1 MiB.
- **Köp + inbytt reserv i samma skrivning** (F9, Testern runda 3): en skrivning förbi appen som köper en spelare och i
  samma skrivning byter in en köpt reserv räknas av `mdSlapptPris` (`g.reserver − d.reserver`) som en släppt reserv –
  den går igenom med +385 kr i stället för −1 210, högst +400 per köp. Rättas senare genom att bara ersätta spelare som
  lämnar klubben (inte finns i truppen + reserverna efteråt), som `mdUnikaOk` räknar.
- **1000-uttrycksgränsen:** en ny klubb har nu marginal 8 (var 30); hela säsongen + kvalet i en skrivning 2 (oförändrad).

**Körningar (runda 1, HEAD efter rättningen):** `node --test` (319 filer) 4630 pass, 0 fail, 1 skipped; matchdagen
205 (5 nya: lägrets `-p`, marknadens rader); `npm run test:rules` 1090 pass, 0 fail; `npm run test:functions` 573 pass,
0 fail, 2 kända TODO; `npm run test:e2e` 5/5; marginalen ovan.

### Rättningsrunda 2 (Testern på 91ac1bc4) – F6–F8

- **F6 (medel), kassan +400 vid varje byte.** Tillägget i `mdKassaOk` gällde så fort reserverna ändrades – tre byten
  fram och tillbaka gav +1 200 kr, en släppt reserv +400. Nu bara i ett köp (`mdKopTillagg`, anropas bara när
  reserverna ändras): marknaden ändras, inget läger, och en spelare i truppen är ny för klubben – utan läger kan det
  bara vara en köpt. Ett byte, en släppt reserv eller ett byte + en struken marknadsrad ger inga pengar. Matchens väg
  är oförändrad: hela säsongen + kvalet i en skrivning har kvar marginalen 2.
- **F7 (låg), platta 1 600 kr tillbaka med fulla reserver.** `mdKopOk` räknar nu halva priset för just den släppta
  reserven (`mdSlapptPris`: den som finns i det sparade dokumentets reserver men inte i de nya) – en släppt 3★ ger
  605 kr, som i appen.
- **F8 (låg, sedan 1c/2a), 200 kB hålls inte av reglerna.** Reglerna begränsar antalet i listorna och mapparna, inte
  strängarnas längd i ligans lag (`liga.lag[].namn`), `senaste`, `sasonger` och `pokaler` – Testerns ~900 kB gick
  igenom. Ingen ny regel över de äldre fälten (scopet); `MATCHDAGEN.md` §10, `DATAMODELL.md`, `BEHORIGHETER.md`,
  reglernas kommentar och F1 ovan säger nu bara det som prövas: appens dokument ~61 kB, förbi appen upp till 1 MiB.
  Det egna dokumentet – men lärarens Hur går det? läser det.

Tester: `firestore-rules-matchdagen-trupp.test.js` (sist: byte +400/+1, släppt reserv +400, byte + struken rad,
fulla reserver: +1 kr för mycket och platta 1 600 nekas, 605 tillbaka går igenom).

**Körningar (runda 2, 8b9af73f + docs):** `node --test` (319 filer) 4630 pass, 0 fail, 1 skipped; `npm run test:rules`
1095 pass, 0 fail; marginalen i tabellen ovan (runda 2). Functions och e2e rördes inte i runda 2 (bara regler, tester, docs).


## Etapp 2c – Silverpokalen och rekorden (#872)

Med 2c får säsongen en cup vid sidan av ligan: fyra utslagsrundor mot lag från upp till två divisioner under till två
över, spelade mellan ligaomgångarna – och klubben samlar rekord som annonseras direkt efter matchen. Arkitekturen
står i `MATCHDAGEN.md` §16.

### Vad som byggts

- **Silverpokalen** (`delat/md-cup.js`, ren): sextondelsfinal, kvartsfinal, semifinal och final, jämnt utspridda
  mellan ligaomgångarna (`cupSchema`: 5 omgångar → efter 1, 2, 3, 4; 7 → 1, 3, 4, 6; 9 → 2, 4, 5, 7; 11 → 2, 4, 7, 9),
  alltid före sista ligaomgången. Motståndarna lottas en gång per säsong (samma efter omladdning) ur namnlistan
  från divisioner inom ±2, de svagaste först. Oavgjort → straffar (2a:s straffläggning), förlust → ute för
  säsongen, vunnen final → pokalen "Silverpokalen" och 200 kr × multiplikatorn. Cupen flyttar aldrig laget.
- **Match-fliken** visar cupmatchen före nästa ligamatch: "Silverpokalen · Kvartsfinal · Blåklintens IF från
  Division 5", vad som står på spel och "Här kan det bli en skräll!" mot en högre division. Rutan efter matchen
  säger "Vidare till semifinalen!", "Utslagna …" eller "Ni vann Silverpokalen!".
- **Tabell-fliken** visar cupens fyra rundor under tabellen: resultatet och "vidare"/"utslagna"/"vinnare!" för
  spelade rundor, motståndaren med division och "efter omgång N" för de kommande, den aktuella markerad, och
  knappen "Till cupmatchen" när en cupmatch väntar.
- **Rekorden** (`delat/md-rekord.js`, ren): flest mål i en match och på en säsong, största seger, längsta svit
  utan förlust, flest ligatitlar i rad, obesegrad säsong, bästa andel rätt på en säsong (minst 3 matcher) och
  snabbaste mål. "Nytt rekord: 6 mål i en match!" i rutan efter matchen, en rad per slaget rekord. Statistik har
  en ny sektion **Rekord** med alla åtta (värde och säsong, "–" för ett som inte finns än), och matchlistan märker
  cupmatcherna "cup". Lärarens elevpanel visar cupens läge och de satta rekorden; matchraderna får "(cup)".
- **Pokalerna som rader** i dokumentet (`"typ|namn|säsong|datum"`, objekt i appen) – prövas av reglerna (stänger
  F8 för pokalerna).
- **Reglerna:** `cup`, `rekord` och `pokaler` med ett reguljärt uttryck var; `mdSummaOk` omskriven till ETT
  uttryck över summans åtta heltal (gav plats i den tunnaste skrivningen, se Marginalen); `mastarcup` borttaget
  tills Etapp 3. Nyckel MC i `BEHORIGHETER.md`.
- **Balansen:** `admin/md-balans-cup.mjs` i `npm run balans:matchdagen`; robotklubbarna i karriärtabellen spelar nu
  cupen också.
- **Förhandsvisningen:** `?cup=ute` (utslagna i kvartsfinalen) och `?rekord=1` (ligamatchen står 6 – 0 i 88:e
  minuten – spela klart så kommer rekordrutan); cupmatcherna spelas med i `?omg=N`.

### Tester

- `test/matchdagen-cup.test.js` (node, 25 tester, §15): schemat för 5/7/9/11 omgångar (jämnt, före sista
  omgången), lottningen (±2, utanför ligan, samma vid omladdning, skrällar möjliga), ingen cupmatch före omgång 1,
  vinst → nästa runda, finalen ger pokalen och pengarna (multiplikatorn, köns pengar), förlust → ute, straffar,
  en hel säsong, **cupen flyttar aldrig ner ett lag** (också med kval och nya säsonger), annan säsongs cup och
  trasig text; **alla rekord** (mm/ss/sm första gången tyst sedan annonserat, sviten med oavgjort och straffar,
  annonserad en gång, säsongens mål/andel rätt/ligatitlar/obesegrad, ny säsong nollar räknarna men inte sviten),
  rekorden ur `matchKlar`/`kvalKlar`/`cupKlar`, texten = reglernas uttryck ordagrant, pokalerna som rader.
- `test/matchdagen-cup-vy.test.js` (node, 9): Match-fliken (cupmatchen först, texterna), den pågående cupmatchen
  per runda (`md-lokal.js`), escape av allt ur `cup`/`rekord`/`pokaler`/`senaste` i elevens och lärarens vyer,
  en hel säsong i appens ordning.
- `test/matchdagen-balans.test.js`: cupens gränser (`CUP_MAL`) och säsongen med cupen.
- `test/firestore-rules-matchdagen-cup.test.js` (emulator, i `npm run test:rules`, 8 tester): cupmatch och final,
  hela säsongen med cupen och kvalet i EN skrivning, `cup`/`rekord`/`pokaler` i fel form (map, tal, HTML, 301
  pokaler, för långa namn), äldre dokument med pokaler som objekt, `mastarcup` nekas, läraren rör inget av det.
- Uppdaterade: de övriga `firestore-rules-matchdagen*.test.js` (pokalerna som rader), `matchdagen-liga.test.js`.

### Skärmdumpar

`01`–`05` i förhandsvisningen (`preview/preview-matchdagen.html`, 1366 × 900), `06`–`07` i 375 px.

| Bild | Vad |
| --- | --- |
| [`01-tabell-silverpokalen.png`](qa-matchdagen-2c/01-tabell-silverpokalen.png) | Tabell (`?omg=2`): sextondelsfinalen vunnen, kvartsfinalen markerad, "Till cupmatchen" |
| [`02-match-cup-vantar.png`](qa-matchdagen-2c/02-match-cup-vantar.png) | Match-fliken: "Silverpokalen · Kvartsfinal · Blåklintens IF från Division 5" – skrällen, lägret ledigt |
| [`03-nytt-rekord.png`](qa-matchdagen-2c/03-nytt-rekord.png) | Efter 6 – 0 (`?rekord=1`): "Nytt rekord: 6 mål i en match!", största segern och snabbaste målet |
| [`04-statistik-rekord.png`](qa-matchdagen-2c/04-statistik-rekord.png) | Statistik: matchlistan med "cup" och sektionen Rekord |
| [`05-cup-vunnen.png`](qa-matchdagen-2c/05-cup-vunnen.png) | Säsongen slut (`?omg=5`): alla fyra rundor vunna, "Ni vann Silverpokalen!" |
| [`06-mobil-cup-ute.png`](qa-matchdagen-2c/06-mobil-cup-ute.png) | 375 px, `?cup=ute`: "1–2 · utslagna" i kvartsfinalen – ingen sidledsscroll |
| [`07-mobil-rekord.png`](qa-matchdagen-2c/07-mobil-rekord.png) | 375 px: Rekord (16 mål på säsongen, 68 % rätt), Pokalskåpet med Silverpokalen |

### Balansen (`npm run balans:matchdagen`, Silverpokalen)

400 säsonger per rad, motståndare inom ±2 divisioner, oavgjort → straffar. Skrällar = vunna möten mot ett lag
från en högre division.

| Division | Rätt | Laget | Ute i 1:a | Kvart | Semi | Final förlorad | **Vunnen** | Cupmatcher/säsong | Skrällar | Straffar | kr/säsong | Säsong utan → med cupen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Division 6 | 70 % | 2★ | 29 % | 18 % | 15 % | 13 % | **25 %** | 2,6 | **64 %** | 24 % | 844 | 51 → 72 min |
| Division 6 | 50 % | 2★ | 58 % | 28 % | 9 % | 5 % | 1 % | 1,6 | 19 % | 30 % | 355 | 48 → 61 min |
| Division 6 | 30 % | 2★ | 85 % | 13 % | 3 % | 0 % | 0 % | 1,2 | 12 % | 23 % | 169 | 47 → 56 min |
| Division 3 | 70 % | 4★ | 15 % | 16 % | 17 % | 17 % | 36 % | 3,1 | 69 % | 25 % | 1 874 | 74 → 100 min |
| Superligan | 80 % | 4★ | 20 % | 20 % | 17 % | 17 % | 27 % | 2,8 | – | 26 % | 2 888 | 111 → 136 min |
| Superligan | 80 % | 5★ | 12 % | 12 % | 12 % | 10 % | 54 % | 3,3 | – | 19 % | 3 659 | 112 → 140 min |

Specen har inga tal för cupen; gränserna i `CUP_MAL` (70 % i Division 6 vinner 10–50 %, skrällar 30–90 %; 50 %
rätt skrällar 5–60 %) fälls av `test/matchdagen-balans.test.js` – båda raderna är inom. Ligans, kvalets och
ekonomins tabeller är oförändrade mot 2b (fasta frön). Karriären med truppen spelar nu cupen (prispengarna och
cupens minuter): 80 % rätt når Superligan efter median 8 säsonger (15,3 h med cupen, 11,3 h utan), 70 % efter 12
(21,6 h), 60 % i 44 % av fallen inom 30 säsonger.

### Kvoten (2c, §13)

Inga nya läsningar och inga lyssnare. En cupmatch är en match (en batch = 2 skrivningar: karriären + matchen);
rekorden och pokalerna skrivs i samma skrivning. Eleven under en timme spelar fortfarande ~6 matcher (cupmatcherna
tar ligamatchernas plats i timmen): **≈ 8 läsningar och ≈ 26 skrivningar** – som 2b (mål < 20 / < 50).
`cup` + `rekord` är < 200 byte; pokalerna som rader ~70 byte styck.

### Reglerna och 1000-uttrycksgränsen (alla skrivningar, mätta om)

Samma rigg som i 2b (`.scratch/zz-mat2.test.js`: hur många extra `(d.div == d.div) &&` som ryms i
`validMatchdagen` innan skrivningen nekas, karriärer byggda av de riktiga modulerna; mätt upp till 60).
Före = 2b:s slutliga regler (0e53ce08), 2c = slutliga regler (summan med ett uttryck, cup/rekord/pokaler):

| Skrivning | Före (2b) | 2c |
| --- | --- | --- |
| Ny klubb (`create`) | 8 | 9 (10 före rättning 1) |
| En match | 40 | ≥ 60 |
| Ett träningsläger | 16 | 35 |
| Lägrets start (`"-p"`) | ≥ 50 | ≥ 60 |
| Ett köp (grundpelaren till reserverna) | 22 | 26 |
| Ett köp med fulla reserver | 18 | 22 |
| Ett byte | ≥ 50 | ≥ 60 |
| 4 matcher i en skrivning (kön) – med cupmatcher, rekord och pokaler i 2c | 18 | 30 (35) |
| Kvalet | 12 | 28 (30) |
| **Hela säsongen + cupen + kvalet i en skrivning** (ny klubb offline) | 2 | **16** (18) |
| En cupmatch | – | ≥ 60 |
| Cupfinalen (pokalen + prispengarna) | – | ≥ 60 |
| Läger + match i samma skrivning | nekas (−1) | nekas – därför väntar Match-fliken fortfarande på lägret |

Utan omskrivningen av `mdSummaOk` hade cupen, rekorden och pokalerna sänkt den tunnaste skrivningen till 1
(mätt). Med summan som ett uttryck har alla skrivningar mer marginal än före 2c.

### Deploy

**`firebase deploy --only firestore:rules` och webben i samma omgång – reglerna först, webben direkt efter.**

- Gamla regler + ny webb: `cup` och `rekord` är text, de gamla reglerna väntade en map – varje match efter den
  första cupmatchen nekas och blir liggande i den lokala kön.
- Nya regler + gammal webb: den gamla webben skriver `pokaler` som objekt, som de nya reglerna nekar när listan
  ändras (en ligavinst eller ett kval). Den matchen ligger kvar i kön tills sidan laddas om med den nya webben,
  som gör om pokalerna till rader. Inget går förlorat.
- Inga index, inga functions, ingen datamigrering (äldre dokument med pokaler som objekt godtas tills listan
  ändras; då skriver appen om dem).

### Val där dokumentet inte räckte till

1. **Schemat** för 7/9/11 omgångar: ligan delas i fem jämna bitar (`round((i + 1) × n / 5)`) – finalen alltid
   före sista ligaomgången, så cupen är klar när säsongen är det och säsongens rekord räknar med hela cupen.
2. **En cupmatch som väntar spelas före nästa ligamatch** (Match-fliken visar den först) – inget val för eleven;
   det håller tabellen och cupen i takt.
3. **Lottningen:** fyra lag som inte är med i ligan, divisionerna slumpade inom ±2 och sorterade (svagast först)
   så finalen är oftast tuffast. I Division 6 blir det oftare lag från Division 6 (inget under).
4. **Prispengarna 200 kr × multiplikatorn** – specens 400 halverat som alla inkomster i 2b (§8.3/§12). Ingen
   pengar per runda utöver matchens vanliga.
5. **Träningslägret förbrukas inte av en cupmatch** – lägret hör till ligaomgången (2b); en cupmatch mellan
   omgångarna låter eleven ha kvar sitt läger.
6. **Rekorden:** åtta rader (specens lista + obesegrad säsong). Första gången ett rekord sätts annonseras det
   inte – bara när det slås. Sviten (liga, cup och kval; en straffseger är ingen förlust, en straffförlust är det – Testern F3) annonseras en gång, när
   den passerar rekordet från innan sviten började, från 3 matcher. Säsongens rekord (mål, andel rätt) räknas vid
   sista ligaomgången med ligan + cupen; kvalet efteråt räknas inte. Obesegrad = ingen förlust i ligan.
7. **Rekordens text och pokalerna som rader** – samma teknik som marknaden i 2b: ett reguljärt uttryck i
   reglerna i stället för en kontroll per fält (1000-gränsen).
8. **Att cupen och rekorden stämmer med matcherna prövas inte i reglerna** – en elev som skriver förbi appen kan
   ge sig själv en vunnen cup eller rekord. Bara det egna spelet (inga pluggmynt); kassan har kvar sitt tak per
   match.
9. **`mastarcup` togs bort ur de tillåtna fälten** – det var tillåtet som en obegränsad map; Etapp 3 lägger
   tillbaka det med en kontroll.

### Öppna frågor till Elias

1. **Säsongen blir längre med cupen:** Division 6 tar ~72 min med fyra cupmatcher (51 utan; §12 säger 45–60).
   Snittet är 2,6 cupmatcher (61 min med 50 % rätt). Vill du ha färre rundor i de lägsta divisionerna?
2. **Prispengarna** är halverade (200 × mult.) som resten av ekonomin. OK?
3. **Rekordannonsen** är tyst första gången ett rekord sätts. Vill du ha en annons också då (blir många i början)?

### Kända gränser

- Att cupen och rekorden stämmer med matcherna prövas inte (se val 8).
- Storleken: strängarna i ligans lag, `senaste` och `sasonger` prövas fortfarande inte (F8, 2b) – pokalerna gör det nu (≤ 20 000 tecken, rättning 1 F1).
- F9 (2b): ett köp + en inbytt köpt reserv i samma skrivning räknas som släppt (+385 kr, högst +400 per köp).

### Så testas det (2c)

- **Förhandsvisningen:** `PORT=8872 node server.mjs` → `preview/preview-matchdagen.html?ny=1&omg=2&vy=tabell` (cupen
  under tabellen), `?ny=1&omg=2` (Match-fliken: kvartsfinalen väntar), `?ny=1&omg=3&rekord=1` → Fortsätt matchen →
  spela klart → "Nytt rekord: 6 mål i en match!", `?vy=stat` (Rekord), `?ny=1&omg=5&vy=tabell` (vunnen),
  `?ny=1&omg=3&cup=ute&vy=tabell` (utslagna).
- **Appen mot emulatorn:** `MD_PA=1 MD_TRUPP=1 PORT=8872 bash admin/qa-matchdagen-867-preview.sh` – Alva har spelat
  två omgångar men ingen cupmatch: Match-fliken visar sextondelsfinalen → spela → sparad → Tabell visar cupen →
  nästa ligamatch → kvartsfinalen. Statistik → Rekord.

### Körningar (Codern, 872)

| Svit | Resultat |
| --- | --- |
| `node --test` (de 319 filerna som inte kräver emulatorn) | 4661 pass, 0 fail, 1 skipped |
| Matchdagen (`test/matchdagen-*.test.js`) | 242 pass (ingår ovan; 26 i `matchdagen-cup.test.js`, 9 i `matchdagen-cup-vy.test.js`) |
| `npm run test:rules` (`admin/qa-matchdagen-867-svit.sh`) | 1106 pass, 0 fail (8 i `firestore-rules-matchdagen-cup.test.js`) |
| `npm run test:functions` (samma rigg) | 278 pass, 0 fail fram till test 280 – avbruten av minnesbrist på maskinen (OOM), körs i sin helhet av Testern. Inga filer i `functions/` ändrade i 2c |
| `npm run test:e2e` | körs av Testern |
| Bootgrafen | 107 filer (oförändrad, `test/matchdagen-modul.test.js`) |
| `npm run balans:matchdagen` | 148 s – tabellerna ovan |
| Marginalen mot 1000-gränsen | alla skrivningar mätta (tabellen ovan) |
| Bilder per sekund | 19,8 i snitt, lägst 12 (SwiftShader, se sammanfattningen) |

Appen mot emulatorn kördes inte av Codern (en emulator åt gången, minnet) – cupens och rekordens flöde är visat i
förhandsvisningen (skärmdumparna) och i reglerna (`firestore-rules-matchdagen-cup.test.js`: cupmatch, final och
hela säsongen med cupen i en skrivning).

### Granskningen (code review på 0e53ce08..81cd6022) – rättat

- **Sviten annonserades inte när det gamla svitrekordet var 1** (låg–medel): annonsen krävde exakt `gamla + 1`
  matcher, vilket då är 2 – under minimum 3 – så sviten passerade utan annons. Nu vid `max(gamla + 1, 3)`, fortfarande
  en gång per svit. Test i `matchdagen-cup.test.js`.
- **Cupen visades som "väntar" när ligan var slut utan cup** (låg, bara ett dokument från före 2c): Tabell och
  lärarens vy säger nu "spelas igen nästa säsong" / "ingen cup den här säsongen". Test i `matchdagen-cup-vy.test.js`.
- **Inte rättat:** en ligamatch som låg halvspelad lokalt när 2c går ut ersätts av cupmatchen (den cupmatch som väntar
  går först). Matchdagen är inte i drift, så det kan inte hända. Granskaren fann i övrigt inget i XSS, reglernas form
  mot appens skrivningar (simulerade ~400 säsonger) eller köns pengar.

### Testern (872, på d3b20870)

| Svit | Resultat |
| --- | --- |
| `npm run test:functions` (hela, `admin/qa-matchdagen-867-svit.sh`) | 573 pass, 0 fail, 2 todo |
| `npm run test:e2e` | 5 pass, 0 fail |
| `npm run test:rules` | 1106 pass, 0 fail (+ Testerns `firestore-rules-matchdagen-cup-tester-872.test.js`: 6 pass) |
| `node --test test/matchdagen-*.test.js` | 285 pass (+ Testerns `matchdagen-cup-tester-872.test.js`: 40 karriärer mot ett oberoende orakel för alla åtta rekord, kassan/kön/pokalen exakt en gång, cupen flyttar aldrig) |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs` 0e53ce08 vs HEAD) | 107 = 107, identiska |
| Marginalen mot 1000-gränsen (stickprov) | säsong + cup + kval 18 – också för en tung karriär i Elitligan (250 pokaler, 139 säsonger, fulla reserver); cup 60; cupfinal 60 |

**Appen mot emulatorn** (Alva, 4a01): sextondelsfinalen väntar direkt efter omgång 1 och står först under Match
([14](qa-matchdagen-2c/14-testern-app-sextondel-efter-omg1.png)); utslagna 0–1 → `cup "1-1-u"`, ligan fortsätter
([08](qa-matchdagen-2c/08-testern-app-cup-utslagna.png), [09](qa-matchdagen-2c/09-testern-app-tabell-cup-ute.png));
finalen vunnen 2–0 → +598 kr (398 + 200), en pokal, "Nytt rekord: största segern någonsin, 2–0!"
([10](qa-matchdagen-2c/10-testern-app-cupen-vunnen-rekord.png)), omladdning efteråt: ingen ny final, kassan oförändrad;
semifinal 1–1 → straffar 4–1 → vidare ([11](qa-matchdagen-2c/11-testern-app-cup-straffar-vidare.png)); Statistik → Rekord
([12](qa-matchdagen-2c/12-testern-app-statistik-rekord.png)). Fel svar + omladdning i facitpausen: svaret står kvar
(frågor 1, rätt 0) och cupfinalen fortsätter. Omladdning i samma ögonblick som finalen avgörs (kön skrivs): ingen
omspelning, förlusten sparad (`1-4-u`), inga dubbla pengar. Lagrad XSS (förbi reglerna) i `cup`, `rekord`, pokalerna
(rader och objekt), `senaste` och ett matchdokument: escapad i Match, Tabell, Statistik och lärarens vy
([13](qa-matchdagen-2c/13-testern-app-larare-cup-rekord-xss.png)), `window.__xss` aldrig satt.

**Fynd:**

- **F1 (låg): pokalernas storlekstak håller inte.** Uttrycket prövar `pokaler.join('/')`, och namnet får inte innehålla
  `/` – men ETT element får: `"cup|Silverpokalen|1|2026-11-20/cup|…"` (90 rader i ett element) × 300 element = 837 kB
  gick igenom reglerna (`firestore-rules-matchdagen-cup-tester-872.test.js`). §16.4 och "Kända gränser" ovan säger att
  pokalerna nu prövas (~22 kB) – det stämmer inte. Bara elevens eget dokument (som F8). Rättning: t.ex.
  `d.pokaler.join('/').size() <= 21000` (300 × 70) i samma rad, eller `join('/').split('/').size() == d.pokaler.size()`.
- **F2 (låg, text):** rutan under tabellen säger "Lag från två divisioner under till två över" också i Division 6 (inget
  under) och Superligan; efter finalen "Pokalen står i pokalskåpet" – pokalskåpet kommer i Etapp 3 (pokalen syns i Statistik).
- **F3 (låg, dokumentation):** val 6 säger "en straffseger är ingen förlust" i sviten – men också en straffFÖRLUST
  (1–1, utslagna) räknas som inte förlorad, så sviten lever vidare efter att laget åkt ur cupen. Antingen skriv det i
  valet, eller räkna `res.vann === false` som förlust.

### Rättningsrunda 1 (Testern på d3b20870) – F1–F3 rättade

- **F1, pokalernas storlek:** regeln tak:ar nu hela listan, `d.pokaler.join('/').size() <= 20000` (samma rad som
  uttrycket; appens största lista är 300 × 62 tecken + avgränsare ≈ 18 900). Testerns 837 kB nekas nu
  (`firestore-rules-matchdagen-cup-tester-872.test.js` test 5 vänt till "nekas"). §16.4 rättad.
- **F2, texterna:** rutan under tabellen säger nu "Motståndarna kommer från Division 6 till Division 4" (räknat ur
  divisionen, ±2 inom stegen); efter finalen "Pokalen finns under Statistik" (pokalskåpet är Etapp 3). Test i
  `matchdagen-cup-vy.test.js`.
- **F3, sviten:** en straffförlust (`res.vann === false` – utslagna ur cupen på straffar, förlorat kval) bryter nu
  sviten; en straffvinst gör det inte. Val 6 och §16.2 säger det. Test i `matchdagen-cup.test.js`; Testerns orakel
  (`matchdagen-cup-tester-872.test.js`) räknar likadant.

**Körningar (rättning 1):** `node --test test/matchdagen-*.test.js` 286 pass, 0 fail; reglerna för Matchdagen
(alla 10 `firestore-rules-matchdagen*.test.js`) 110 pass, 0 fail. **Marginalen** omätt med pokalernas tak (kontrollen
utbruten till `mdPokalerOk`, så listan sammanfogas en gång): ny klubb 9 (var 10), hela säsongen + cupen + kvalet
i en skrivning **16** (var 18), kvalet 28 (30), 4 matcher i en skrivning 30 (35); oförändrade: match ≥ 60, läger 35,
köp 26, köp med fulla reserver 22, cupfinalen ≥ 60 (tabellen ovan uppdaterad).

**Omtest på 377d2848 (rättning 1):** `npm run test:rules` 1113 pass, 0 fail (Testerns fil 7: 837 kB-listan nekas nu;
appens största lista – 300 rader à 62 tecken, 18 899 tecken – går igenom; 323 rader i två element, 20 348 tecken,
nekas). Marginalen säsong + cup + kval 16, också för en tung Elitliga-karriär med 297 + 3 pokaler à 62 tecken.
F2: rutan säger "Motståndarna kommer från Division 6 till Division 4" (Div 6), "… Division 1 till Superligan" (Superligan);
efter finalen "Pokalen finns under Statistik". F3: oraklet med straffförlust = förlust stämmer i alla 40 karriärer
(med den gamla regeln skiljer 11). Matchdagen-testerna 286/0. F1–F3 stängda.
