# QA-rapport – Vinter och Jul (#913, epic #906)

Slut-QA av epic-grenen `7cc2241a` (A–F #907–#912 landade, `origin/main` `9800bd56`
inmergad). Spec: `UTVECKLINGSUPPDRAG_VINTER_JUL.md` DEL G. Testerna 1–18 följer
[QA-RAPPORT-host-halloween.md](QA-RAPPORT-host-halloween.md), nu för Vinter och Jul,
plus testerna 19–24.

Allt kördes mot Firebase-emulatorerna (functions, auth och firestore) i
`admin/qa-vinter-jul-913-preview.sh`. Eleven är kc01 i klassbyn QA-klass 4A med 14 hus,
och kc02–kc14 äger köpta husskal: jul, Halloween och legendariska. Seed:
`admin/qa-vinter-jul-913-seed.mjs`. Läget sattes i `config/season` via proxyns REST, och
i test 3 via adminfliken. Sidorna kördes i en egen headless Chromium
(`admin/qa-vinter-jul-913/`, CDP utan npm-moduler). För pixeldiffen kördes en kopia av
`origin/main` mot **samma** emulator. Skärmdumparna finns i `docs/vinter-jul/g-qa/`.

## Sammanfattning

- **Alla 24 tester är gröna.** Test 7 och 16 är delvis verifierade, se tabellen.
- **Testsviter:**
  - Unit: 5124 av 5125 gröna, 0 fel och 1 överhoppat. I första körningen föll 7, men
    de startade innan `node_modules`-symlänken fanns (se nedan).
  - `test:rules`: 1228 av 1228.
  - `test:functions`: 665 gröna och 2 TODO. 7 fall i `functions-teacher-accounts`
    fick `deadline-exceeded` under last. Filen ensam: 11 av 11.
- **Bootgrafen:** 107 filer, identisk med main (`admin/qa-bootgraf-bfs.mjs`).
- **Inga emojier från Emoji 13 eller senare** (`admin/qa-sasong-emoji.mjs` mot
  Unicodes tabeller): 44 emojier i tillagda rader, högst E12.
- **Butikens serverkatalog är i synk:** `npm run sync:butik` ger ingen diff.
  Alla sju varutyper köptes mot functions-emulatorn (se Köp).
- **Fynd:** inga blockerare. Två låga fynd, där F2 är rättad, och två observationer
  (F1–F4), se nedan.
- **G.2-dokumentationen saknades och är nu skriven,** i commit `c17fd875`:
  - nya [SASONGER.md](SASONGER.md)
  - [DATAMODELL.md](DATAMODELL.md): `config/season`, `jul`/`julUntil`, samlingen
    `jul` och `JUL_SPECIES`
  - [LARARSIDAN_STRUKTUR.md](LARARSIDAN_STRUKTUR.md): adminfliken Säsong

## Tester

| Test | Resultat | Hur |
| --- | --- | --- |
| 1 Utan `config/season` = som i dag | ✅ | Pixeldiff mot main, dokumentet borttaget: port, spärr, hus, by, gård och rum, 0 px |
| 2 Vinter live; Plugga, Live och lärarsidan oförändrade | ✅ | Huset öppet i sommar, sedan vinter + Jul via REST. Utan omladdning: `data-sasong=vinter`, `data-jul=1`, 18 flingor och snötäcken. På Plugga finns ingen snö och inget partikellager |
| 3 Bara admin ändrar säsongen | ✅ | `test/firestore-rules-season.test.js` i `test:rules` (vinter, jul, julUntil; elev, årskurs och utloggad nekas). Admin: Sommar · Höst · Vinter, raderna Halloween och Jul, tipset "Vinter passar ihop med Jul." när Jul är på under Sommar men inte under Vinter, förval 13 jan 23.59. Bekräftelsen: "Nytt läge: Vinter · Jul på till 13 jan 2027 23.59". Dokumentet sparas med `updatedBy` = adminens uid |
| 4b Inloggningen: ingen blink, samma kontrast | ✅ | Vid omladdning ritas porten första gången redan i vinter + Jul (MutationObserver: `data-sasong=vinter`, `data-jul=1`, paletten satt). Utan cache, alltså första besöket någonsin, ritas sommar först och sedan byts den live, som för Halloween. Rutan, fälten och knappen har samma färger i alla lägen |
| 4 Snöfall: dold flik, reducerad rörelse, klick, inte i rummet | ✅ | 18 flingor, 4–10 px, en animation (`sz-snoa`) och `pointer-events: none`. `elementFromPoint` träffar aldrig en flinga. Dold flik ger `.sz-paus` och `paused`. Reducerad rörelse ger lagret `display: none`. Inte i rummet (`[data-niva=rum] .sz-lager`). Bildfrekvensen står i test 22 |
| 5 Jul på/av → fliken syns/döljs | ✅ | 🎄 Jul har 6 undergrupper (Dekor och möbler, Trädgård, Hus, Djur, Avatarer, Kostymer) och texten "Bara under julen! …". I Möbler finns 0 julvaror. Med Jul av finns ingen flik |
| 5b Slutdatum passerar; elevens klocka påverkar inget | ✅ | `julUntil` om 75 s, och elevens `Date` flyttad +30 dygn. Fliken fanns kvar tills den riktiga tiden passerat och försvann sedan utan omladdning. Ljusslingorna i världen försvann också |
| 6 Köpta julsaker fungerar med Jul av | ✅ | Med bara vinter: Adventsljusstake och Julgran i rummet, Snölykta i trädgården, och Tomteverkstaden som hus med snötäcke (`06-*.png`) |
| 7 Placera, flytta, ta bort | ✅ (delvis) | Placeringarna skrevs här via REST och ritas rätt. Flytt och borttagning med dra och släpp kördes inte om, men är verifierade i UI:t i #910 (`docs/jul-910-test/03-snogubbe-flyttad.png`). Ingen ny kod för placering i epicen |
| 8 Kostym bärs och syns | ✅ | Tomteluva och Häxhatt: i huset 4 av 4 synliga, i byn 6 av 6, i sidomenyn. 0 platshållare |
| 9 Jul av: kostymen | ✅ (enligt #799) | Kostymer bärs och syns **året runt** (#799, E.1). Med Jul av: 4 av 4 synliga och ingen data omskriven. Halloween-QA:ns "osynlig och gråad" gäller inte längre |
| 10 Jul på igen | ✅ | 4 av 4 synliga |
| 11 Varje kostym på varje avatar | ✅ | `preview-kostymer.html?samling=jul`: 11 × 42 = 462 celler, 462 synliga och 0 platshållare. Alla samlingar: 22 × 42 = 924 och 0 platshållare. Bild: `docs/jul-911-test/matris-jul.jpg` |
| 12 Köpt julavatar kan väljas med Jul av | ✅ | Pingvin med halsduk köptes för 600. Med Jul av står den bland de valbara, valdes och sparades som `avatarId=jul-av-pingvin` (`12-avatarval-jul-av.png`) |
| 13 Ej köpt är låst | ✅ | 10 låsta (5 Halloween och 5 jul). Hint: "Finns i butiken under Halloween och julen". Ett klick visar "🔒 Fladdermus finns i butiken under Halloween." och väljer inget. Regeln `kopAvatarOk` testas i `test:rules` |
| 14 Julklappsägg → valt djur | ✅ | Julklappsägget med Snöis köptes i UI:t för 500 mynt (`eggSpecies=snois`) och kläcktes till Snöis. Det seedade ägget med Renis kläcktes med rutan "Ägget har kläckts! … en Renis" (`14-*.png`) |
| 15 Mysterymat och tre steg | ✅ | Ett äpple på golvet: Renis gick dit och åt (feedCount 9→10, steg 2, och 19→20, steg 3) (`15-*.png`) |
| 16 Bildbaserade mysteriedjur som förut | ✅ (unit) | `test/halloween-djur.test.js` test 16 och `test/jul-djur.test.js`: mystery-flaggan, och okänt ägg ger mystery-ägget. Kördes inte om i appen |
| 17 Förhandsvisningen 10 × 3 × uttryck | ✅ | `preview/preview-jul-djur.html`: 10 djur, 150 figurer, 0 tomma och 0 konsolfel (`17-jul-djur.jpg`) |
| 18 Regression | ✅ | Testsviterna enligt sammanfattningen. Med vinter + Jul + Halloween: 0 konsolfel i hus, by, gård, rum, Plugga, profil, avatarval, Live och butiken |
| 19 Bländtestet | ✅ | Tabellen nedan |
| 20 Höst och sommar oförändrade | ✅ | 0 px i 24 jämförelser mot main, se nedan |
| 21 Halloween som förut | ✅ | Test 5 och 5b körda om: fliken med 6 undergrupper, och slutdatumet passerade live med klockan flyttad +30 dygn. Test 8–10: Häxhatten syns. Test 12: Litet spöke valbart med Halloween av. Höst + Halloween ger 0 px mot main |
| 22 Snölagrets prestanda | ✅ (se F1) | Tabellerna nedan |
| 23 Kontrast | ✅ | Tabellen nedan |
| 24 Snö på köpta hus | ✅ | Alla 44 husskal, inklusive de 3 julhusen, de 3 Halloween-husen och de 8 legendariska (`myst-*`), har snötäcke (`24-hus-matris-vinter.jpg`, sommar som jämförelse). I byn har köpta jul-, Halloween- och legendariska hus snö (`alla3-by.png`) |

## Test 19 – bländtestet

Skärmdumparna är 1366 × 768 och tagna i appen mot emulatorn, med sidomenyn.
Kommandot är `node admin/qa-vinter-blandtest.mjs <png …>`. Luminansen räknas med Rec. 709.

| Vy | Läge | Medelluminans (≤ 215) | Pixlar ≥ 245 (≤ 5 %) |
| --- | --- | --- | --- |
| Byn | Vinter | 207,5 | 2,23 % |
| Huset ute | Vinter | 206,0 | 1,41 % |
| Gården | Vinter | 206,2 | 1,77 % |
| Porten | Vinter | 183,4 | 3,25 % |
| Lärarspärren | Vinter | 53,3 | 0,16 % |
| Byn | Vinter + Jul | 207,0 | 2,11 % |
| Huset ute | Vinter + Jul | 205,6 | 1,25 % |
| Gården | Vinter + Jul | 205,5 | 1,77 % |
| Porten | Vinter + Jul | 130,6 | 3,19 % |
| Lärarspärren | Vinter + Jul | 56,6 | 0,11 % |
| Byn | Vinter + Jul + Halloween | 207,0 | 2,11 % |
| Huset ute | Vinter + Jul + Halloween | 205,5 | 1,25 % |
| Porten | Vinter + Jul + Halloween | 131,4 | 3,55 % |

**En fälla:** när en modal är öppen (som kläckningsrutan) ger byn 215,4 och 19,6 % ljusa
pixlar, eftersom rutan är vit. Mät utan öppna rutor.

## Test 20 – pixeldiff mot main

Animationerna var frysta. Diffen gäller 1366 × 768 och läget sattes i samma emulator för
båda apparna.

| Läge | Port | Spärr | Hus | By | Gård | Rum |
| --- | --- | --- | --- | --- | --- | --- |
| Sommar | 0 | 0 | 0 | 0 | 0 | 0 |
| Höst | 0 | 0 | 0 | 0 | 0 | 0 |
| Utan dokument | 0 | 0 | 0 | 0 | 0 | 0 |
| Höst + Halloween | 0 | 0 | 0 | 0 | 0 | 0 |

**Diffen fanns först, och den kom från datan.** Med seedens julhus i byn och Renis i
rummet gav byn 21 300 px och rummet 2 668 px. Main känner inte julhusen och julvarorna,
så den ritar standardstugan. Diffbilden visade exakt de tre julhusen. Med de tre husen
satta till `null` och djuren borttagna blev allt 0 px. Det är rätt beteende: julsakerna
finns bara på epic-grenen.

## Test 22 och hela kombinationen – prestanda

Mätt i headless Chromium utan GPU (SwiftShader) på en delad maskin med load 5. Siffrorna
är för jämförelse, inte för absoluta värden.

- **Längsta uppgift:** PerformanceObserver från första ritningen, med strypningen satt
  före navigeringen.
- **Bildfrekvens:** requestAnimationFrame, 3 × 5 s i vila.

**Vinter + Jul + Halloween på samtidigt:**

| Vy | DPR / CPU | Längsta uppgift vid första laddningen (gräns ≈ 1 s) | fps i vila |
| --- | --- | --- | --- |
| Byn | 2 / 4× | 365–383 ms | 25–35 |
| Huset ute | 2 / 4× | 378–446 ms | 24–35 |
| Porten | 2 / 4× | 180–201 ms | 18–20 (8,5 under rastreringen) |
| Byn | 1 / 1× | 68 ms | 60 |
| Huset ute | 1 / 1× | 84 ms | 60 |
| Porten | 1 / 1× | 54 ms | 59–60 |

**Porten per läge** (DPR 2, 4× CPU):

| Läge | fps i vila | Längsta uppgift |
| --- | --- | --- |
| Sommar | 60 | 196 ms |
| Höst + Halloween | 26–28 | 173 ms |
| Vinter | 23,5 | 172–198 ms |
| Vinter + Jul | 21–22 | 170 ms |
| Vinter + Jul + Halloween | 18–20 | 197–201 ms |

**Snöns rastrering:** snön på porten rastreras i rutor (#908). Vid 4× och DPR 2 blir det
120–170 uppgifter om 50–200 ms under de första 30 s, och sedan 0. Med alla
partikellager dolda via CSS ger porten med alla tre tilläggen 20–27 fps. Kostnaden
kommer alltså mest från tilläggens övriga dekor (norrsken, ljusslingor, vinkdjur) och
rastreringen i SwiftShader, inte från flingorna.

**Byn och huset i sommar** (DPR 2, 4×): 54–59 fps. Vinter i huset: 25–29 fps.

**Stilberäkning per 3 s** i huset vid 4× (spårad UpdateLayoutTree/RecalculateStyles),
jämfört med löven (F1 i Halloween-QA:n):

| Läge | Med partikellager | Lagren dolda |
| --- | --- | --- |
| Vinter (snö) | 1 510–1 627 ms | 242–322 ms |
| Höst (löv) | 1 320–1 473 ms | 236–316 ms |

Snön kostar ungefär lika mycket som löven, cirka 10 % mer. Se F1 för varför båda är
dyrare än de behöver.

**Hela kombinationen är under gränsen.** Längsta uppgift vid första laddningen är
högst 518 ms i alla mätningar vid DPR 2 och 4×, mot gränsen cirka 1 s. Med alla tre på är den högst 446 ms. Bildfrekvensen
vid 4× ligger på 18–35, och vid 1× på 60. Bekräfta gärna på en riktig Chromebook:
DevTools → Rendering → Frame rendering stats, i byn och på porten.

## Test 23 – kontrast (WCAG AA)

| Element | Sommar | Vinter | Vinter + Jul | Vinter + Jul + Halloween |
| --- | --- | --- | --- | --- |
| Skylten "Pluggporten" (#3B3350 på #E0B98C) | 6,47 | 6,47 | 6,47 | 6,47 |
| Logga in-knappen (vit på #27AE60) | 2,87 ⚠️ | 2,87 ⚠️ | 2,87 ⚠️ | 2,87 ⚠️ |
| "Lärare →" | 8,71 (himmel) | 10,76 (kräm-pastill) | 10,76 | 10,76 |
| Lärarspärren "← Tillbaka" | – | 5,62–7,71 | 5,78–8,29 | – |

- **Knappen har 2,87 i alla säsonger,** även på main. Den är känd och ligger utanför
  epicen.
- **"Lärare →"** har kräm-pastillen i höst, vinter och jul och ligger långt över AA mot
  julens mörka himmel.
- **Lärarspärrens "Tillbaka"** är 4,09–4,17 på hösten (känd, utanför epicen). På vintern
  och julen är den över 4,5.

## Köp mot functions-emulatorn (`butikKop`)

Köpen gjordes genom butikens UI som kc01, med 40 000 mynt i början:

| Sort | Vara | Pris | Resultat |
| --- | --- | --- | --- |
| Dekor | Adventsljusstake | 75 | `ownedCounts` 1 |
| Möbel (multi) | Julgran med pynt × 2 | 120 + 120 | `ownedCounts` 2. #910 F1 är rättad |
| Trädgård | Snölykta | 70 | `ownedCounts` 1 |
| Hus | Tomteverkstad | 4 000 | i `ownedItems` |
| Kostym | Tomteluva | 60 | i `ownedItems` |
| Avatar | Pingvin med halsduk | 600 | i `ownedItems` |
| Djur | Julklappsägg (Snöis) | 500 | `pets[].eggSpecies=snois` |
| Halloween (test 21) | Litet spöke, Häxhatt | 400 + 120 | i `ownedItems` |

Saldot gick från 40 000 till 33 935, vilket är exakt summan av priserna.

## Fynd

### F1 (låg, finns redan på main sedan #732) – dolda byars partikellager animeras

**Vad:** i hus-vyn finns tre partikellager som alla är `display: block` och animerar.
Det ena är husets eget. De två andra ligger i de dolda by- och grannby-lagren
(`.varld-lager.varld-by.varld-dold` och `.varld-skola.varld-grannby`). Det blir 54
snöflingor (3 × 18) eller 48 löv (3 × 16) som räknas om varje bildruta, fast bara 18 syns.
Main gör likadant med löven. Det förklarar en del av stilkostnaden i test 22 och
"cirka 30 fps i byn vid 4×" från #907.

**Reproducera:** logga in som kc01 i vinter → `#/elev/hus` → i konsolen:

```js
[...document.querySelectorAll('.sz-sno-lager')].map(l => [l.parentElement.parentElement.className, getComputedStyle(l).display])
```

Svaret har tre rader, alla `block`.

**Förslag:** `.varld-dold .sz-lager { display: none }`, eller pausa lagret. Det är inte
rättat här, eftersom testaren inte ändrar produktkoden.

### F2 (låg, RÄTTAD i `7958a776`) – julens kostymflik hette "🎭 Kostymer"

D.1 vill ha 🧣 Kostymer, men julen hade ärvt Halloweens rubrik i
`src/jul/jul-konst.js:48`. Rubriken och testet `test/jul-butik.test.js` är ändrade.

- **Omtest:** `test/jul-*.test.js` 37 av 37. `preview-jul-butik.html` visar nu
  "🧣 Kostymer" och har 0 konsolfel.
- **Emoji:** 🧣 är E5.0.

### F3 (observation) – med Jul och Halloween på samtidigt syns spöket i stället för tomten

På porten delar tilläggen platsen för det vinkande djuret (`.sz-vinkdjur`). Med båda på
står Spökis där, och tomten syns inte (`alla3-port.png`). Julgranen, ljusslingan och
granriset syns. A.2 säger att dekoren ska visas för båda. Läget är ovanligt.

### F4 (observation) – återkommande korta uppgifter i vinter-vyerna vid 4×

I huset och byn på vintern, vid DPR 2 och 4×, kommer en uppgift på 60–80 ms ungefär var
5:e sekund i vila, även efter 160 s. Hösten har inga sådana. Vid 1× finns de inte.
Orsaken är inte utredd. Den märks inte som frysning, men F1 är en trolig del av den.

### Uppföljning: en gammal admin stänger av julen och vintern

Det är #907:s F2, verifierat här. En admin-sida från main som är öppen eller cachad
skriver hela dokumentet med `setDoc`. Den känner varken `jul` eller `vinter`, så den
visar "Sommar". Om admin trycker Spara blir dokumentet
`{ season: "sommar", halloween: … }` **utan** `jul`, och julen och vintern stängs av för
alla utan varning. **Ladda om admin efter deployen** (se nedan).

## Kända problem utanför epicen (inte fel här)

- **Logga in-knappen har kontrast 2,87 i alla säsonger,** även sommar och main.
- **Lärarspärrens "Tillbaka" på hösten är 4,09–4,17.**
- **En elev kan skriva sina egna `ownedItems`.** Varulåset från #851 är inte mergat
  (PR #860).
- **Den gamla förhandsvisningen av Halloween-avatarerna** har en inaktuell stubbe.

## Lågt prioriterat från tidigare issues (kvar)

- **#912:**
  - Djurens namnskyltar kan överlappa varandra.
  - Äggens SVG delar clipPath-id:t `jd-agg-klipp`. Flera ägg på samma sida delar alltså
    klippning.
- **#909:** blinkningens `setInterval` i `src/jul/jul-varld.js:302` rensas aldrig.
- **#907:** snöfallet sänker byn till cirka 30 fps vid 4× CPU. Se test 22 och F1.

## Vad som ska deployas, och i vilken ordning

1. **Firestore-reglerna:** `firebase deploy --only firestore:rules`. `validSeasonDoc`
   har `vinter`, `jul` och `julUntil`. Utan reglerna nekas adminens sparning av Vinter
   och Jul.
2. **Functions:** kör `npm run sync:butik`, som är i synk på grenen, och sedan
   `firebase deploy --only functions:butikKop`. Servern måste känna julkatalogen:
   dekor, möbler, trädgård, hus, kostymer, avatarer och julklappsäggen. Annars nekas
   julköpen.
3. **Webben.**
4. **Ladda om admin** (Admin → Säsong) i alla öppna flikar **innan** något sparas. En
   gammal cachad admin skriver dokumentet med `setDoc` och stänger då tyst av Jul, och
   även Vinter (se Uppföljning ovan).
5. **Slå på läget:** Admin → Säsong → Vinter, och Jul på med förvalt slutdatum
   13 jan 23.59 → "Ja, ändra för alla". Allt i den här rapporten kördes mot emulatorn.
   Ingenting slogs på i produktion.

**Med Jul och Halloween på samtidigt vinner julens färger på inloggningen** (A.2,
`themeFor`: den senare raden i `TILLAGG`). Dekoren visas för båda (se F3).

## Val och avgränsningar i QA:n

- **Test 9 följer #799:** kostymerna syns året runt, alltså även med Jul av.
- **Test 7:** placeringarna skrevs via REST. Dra och släpp är verifierat i UI:t i #910.
- **Test 15:** äpplet lades på golvet via REST. Att djuret går dit och äter är appens
  riktiga flöde.
- **Kvoten (#231)** mättes inte om. A har en lyssnare, och ingen ny läsning syns i koden.
- **Unit-körningen:** listan är alla `test/*.test.*` utom filerna i
  `test:rules`/`test:functions`/`test:import`/`test:e2e` och
  `firestore-rules-amneslasning-texter`, som är ett känt emulatortest.
  - De 7 som föll i första körningen var `admin-credential` och tre
    `firestore-prov-raknare-*`. De startade innan symlänken till `node_modules` fanns
    (`firebase-admin`/`firebase` saknades).
  - Omkörning av hela listan: 5124 av 5125, 0 fel och 1 överhoppat.

## Skärmdumpar (`docs/vinter-jul/g-qa/`)

- **Vinter:** `vinter-{by,hus,gard,rum,port,gate}.png`
- **Jul (vinter + Jul):** `jul-{by,hus,gard,rum,port,gate}.png`
- **Alla tre på:** `alla3-{by,hus,port,gate}.png`
- **Julfliken:** `julfliken.png`
- **Admin:** `03-admin-sasong-vinter-jul.png`
- **Julsaker med Jul av:** `06-hus-tomteverkstad-snolykta-jul-av.png`,
  `06-rum-julsaker-jul-av.png`
- **Kostymer:** `09-kostym-jul-av-hus.png`, `10-kostym-jul-pa-hus.png`. Matrisen är
  `docs/jul-911-test/matris-jul.jpg`
- **Avatarval:** `12-avatarval-jul-av.png`
- **Djuren:** `14-julklappsagg-klackt-renis.png`, `15-renis-steg2.png`,
  `15-rum-renis-steg3-snois.png`, `17-jul-djur.jpg`
- **Halloween-fliken borta efter slutdatum:** `21-halloween-flik-borta.png`
- **Husmatrisen:** `24-hus-matris-{vinter,sommar}.jpg`

## Riggen

```
PORT=8913 bash admin/qa-vinter-jul-913-preview.sh          # emulator + seed + proxy (barista_serve)
# main mot samma emulator (portarna i /tmp/t913-portar.txt):
PORT=8914 QA_ROOT=<main-kopia> FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… \
  FUNCTIONS_EMULATOR_HOST=… node admin/qa-emulator-proxy.mjs
node admin/qa-vinter-jul-913/mat.mjs sasong <origin> vinter jul halloween [sek]
node admin/qa-vinter-jul-913/mat.mjs bilder <origin> <mapp> <prefix> 1 port gate by hus gard rum
node admin/qa-vinter-jul-913/mat.mjs diff a.png b.png diff.png
node admin/qa-vinter-jul-913/mat.mjs perf <origin> by 2 4 5 30
node admin/qa-vinter-jul-913/mat.mjs stil <origin> hus 4
node admin/qa-vinter-jul-913/matris.mjs <statisk origin> ut.jpg vinter
```
