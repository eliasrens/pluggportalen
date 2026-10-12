# Hitta rätt! – arkitektur (beslutsdokument, #604)

Epic #603 (1/2) och #612 (2/2). Spec: `Hitta_ratt_byggprompt_v4.txt`.
**Elias beslut gäller före specens §4:** kartan ritas som egen **SVG** från fri
geodata i repot. Ingen MapLibre, ingen kartserver, inga externa kart- eller
bildtjänster vid speltid.

Spiken som bevisar motorn: `preview/preview-hitta-ratt-spik.html` (se §9).

## 0. Besluten i korthet

| Fråga | Beslut |
| --- | --- |
| Rendering | Egen SVG. Geodatan **förprojiceras offline** till färdiga `path`-strängar (heltal, relativa kommandon). Webbläsaren projicerar bara nålar och klick. |
| Projektion | Sverige: Transversal Mercator λ0 = 15° (SWEREF 99 TM:s utseende). Europa: Lambert azimutal ytriktig 52°N 10°E (ETRS89-LAEA). Världen: Equal Earth. |
| Zoom/panorering | EN `transform` på EN `<g>` per bildruta (rAF). Mushjul mot pekaren, +/–, drag, nyp, piltangenter. Gränser per pack. |
| Linjer | `vector-effect: non-scaling-stroke`. Nålar, ringar och resultatlinje i ett skärmlager ovanför kameran. |
| Världsdata | Natural Earth v5.1.2 (public domain). |
| Landskap | `perliedman/svenska-landskap` – CC0, byggt ur **Lantmäteriets Distriktskarta**, alla 25 landskap, hämtas utan konto. |
| Län | Natural Earth admin-1 (public domain, 21 län) nu. Lantmäteriets `lansyta` (CC0) kräver ett gratis Geotorget-konto och kan bytas in senare (§2.2). |
| Förenkling | mapshaper 0.6.121 via `npx` i ett admin-skript. Resultatet committas. |
| Resultat | **Cloud Function `hittaRattSubmit`** räknar om hela omgången på servern, sparar personbästa, topplista, ledare och coins i EN transaktion. Klienten skriver aldrig poäng. |
| Topplista | **Ett dokument per pack** med alla elevers personbästa. Det ger Top 15, egen plats och delad placering med en enda läsning (#231). |
| Personbästa | Ett dokument per elev med alla pack. Startsidan läser det med en läsning. |
| Pokal | Ingen ägd sak. Huset ritar Kartmästare-pokalen för de pack där eleven finns i `hittaRattMeta/ledare`. Ledarna räknas om i samma transaktion som topplistan. Borttagning sker därmed av sig själv och idempotent. |
| Klassaktivering | Opt-in-fältet `classes/{id}.enabledModules: ["hittaratt"]`, som spegling av `hiddenModules` (#412). Av som standard. |
| Bilder | Wikimedia Commons, nerladdade till repot (≤ 120 kB/bild) med fotograf och licens i packen. |
| Bootgraf | Allt nytt laddas dynamiskt. Boot-filerna får bara registerrader. Bootgrafen förblir **107**. |

---

## 1. SVG-kartmotorn

### 1.1 Projektion och koordinater

`projektion.js` är en ren modul som körs **både** i admin-skriptet (Node) och i
webbläsaren. Admin-skriptet förprojicerar geodatan med den. Webbläsaren
använder den för nålen (lat/lon → kartan) och för klicket (kartan → lat/lon).
Formlerna är sfäriska (R = 6371 km). Det räcker för ett skolspel, och
avståndet räknas aldrig i planet utan med haversine på lat/lon.

| Scope | Projektion | Varför | Scope-ruta (V, S, Ö, N) |
| --- | --- | --- | --- |
| `sverige` | Transversal Mercator, λ0 = 15°, φ0 = 62° | Sverige ser ut som på svenska skolkartor (SWEREF 99 TM), konform | 9.6, 54.9, 25.4, 69.4 |
| `europa` | LAEA, centrum 52°N 10°E | EU:s standard (EPSG:3035), ytriktig, liten vinkelförvrängning i Europa | −25, 33.5, 45, 71.5 |
| `varlden` | Equal Earth, λ0 = 0 | Ytriktig utan Mercators uppblåsta Grönland, ser bra ut för barn | −180, −60, 180, 84 |

**Kartkoordinater:** projicerade km normaliseras så att scope-rutans längsta
sida är 10 000 enheter, med Y nedåt (som i SVG). Det ger 1 enhet ≈ 0,16 km i
Sverige, 0,63 km i Europa och 3,4 km i världen. Parametrarna
`{ typ, lon0, lat0, s, x0, y0, bredd, hojd }` ligger i varje geofil, så att
webbläsaren räknar exakt som skriptet. Tur och retur ger ett fel under 1e-13°
(se §9).

### 1.2 Kamera, zoom och panorering

- **EN transform:** kameran är `matrix(k 0 0 k tx ty)` på `<g class="hr-kamera">`.
  Inga paths ritas om vid zoom eller panorering, och inga attribut på
  enskilda paths ändras. Alla händelser sätter tillstånd och begär EN
  ritning per bildruta (`requestAnimationFrame`).
  - Vi använder transform och inte `viewBox`, eftersom pekarmatematiken blir
    enklare i skärm-px.
- **Verb:**
  - Mushjulet zoomar mot pekaren, och punkten under pekaren står still.
    `deltaMode` hanteras för både rader och pixlar.
  - +, – och ⤢ (visa hela kartan) är 44 px stora knappar.
  - Ett finger eller musen drar kartan. Två fingrar nyper och panorerar
    runt mittpunkten.
  - Pilarna panorerar och +/– zoomar när kartan har fokus.
  - Knappar och "visa båda" animeras i 220–650 ms med geometrisk
    zoominterpolation, som känns jämn. `prefers-reduced-motion` ger direkta
    hopp (C).
- **Gränser per pack:**
  - `kMin` = 0,85 × helvyn.
  - `kMax` = helvyn × `maxZoom` (Sverige 10, Europa 16, världen 24 – justeras
    i packen).
  - Panoreringsgränsen: vyns mittpunkt måste ligga inom scope-rutan.
    Förlåtande, och man kan aldrig "tappa bort" kartan.
- **Klick ≠ drag** (`gester.js`): en gest är ett klick bara om rörelsen
  ≤ tröskeln (mus 5 px, penna 6 px, touch 10 px) och den aldrig haft två
  fingrar. Ett drag som slutar stilla kan alltså aldrig sätta en nål. Det
  finns ingen tidsgräns, så ett långt men stilla tryck är ett klick, vilket
  är bra för små barn.
- **Startvy:** packen kan ange `startvy` (lon/lat-ruta). Annars passas hela
  scope-rutan in med 3 % luft.

### 1.3 Lager och träffytor

Ritordning i kameran:
1. `hav` – en rektangel i skärmplanet, alltid hel.
2. `bakgrund` – icke-interaktiv mark, EN path.
3. `omraden` – en path per interaktivt område.
4. `sjoar` – EN path.
5. `vattendrag` – EN path.
6. `val-kontur` och `ratt-kontur` – kopior av den valda och den rätta
   pathen, så att konturen inte döljs av grannarna.

Ovanför kameran ligger **skärmlagret** med ringar, nålar och linjen, i skärm-px.

- **Polygoner:** `pointer-events` på fyllningen. Sjöar och älvar har
  `pointer-events: none`, så ett klick i Vänern når landskapet under (det
  rimliga svaret för en elev som pekar på Vänern i "Hitta Värmland" är
  landskapet).
- **Små områden** (Malta, Luxemburg, Andorra, Vatikanen, San Marino,
  Monaco, Liechtenstein, Åland …): är områdets diagonal under 26 skärm-px
  vid aktuell zoom ritas en **klickring** med r = 12 px i skärmlagret. Den
  döljs när området blivit stort nog. Ringen avslöjar inget namn, bara att
  det finns ett land där – som i Seterra. Ringen markeras också när den är vald.
- **Nålen:** en droppformad SVG i skärmlagret (konstant storlek), med
  spetsen på punkten. Klicka igen eller **dra nålen** för att flytta den
  (`gester.js` ser att trycket började på nålen). Den låses med `lock()`.
- **Val utan färg:** valt område får gul fyllning **och** streckad kontur.
  Fel svar får ett rött randmönster och rätt svar grönt med heldragen
  kontur. Svaret skrivs också i text ("Rätt"/"Fel").
- **Inga namn i DOM:en:** områden har ogenomskinliga id (`o17`, blandade vid
  bygget). Geofilerna innehåller inga namn, inga orter och inga etiketter.
  Det finns inga `<title>` och ingen områdesspecifik `aria-label`.

### 1.4 Motorns API (C bygger det i `src/hitta-ratt/karta/`)

```js
const k = skapaKarta(värd, geo, { lage: "punkt" | "omrade", maxZoom, startvy, attribution, visaGranser });
k.on("gissning", ({ lon, lat }) => …);   // nål satt/flyttad → aktivera "Lås svar"
k.on("val", ({ id }) => …);              // område valt
k.getGuess(); k.getVal(); k.lock();
k.showResult({ guess, target });         // båda nålarna + linje + animerad zoom så båda syns
k.showAreaResult({ valt, ratt });        // rätt grönt, fel rött mönster, båda syns samtidigt
k.reset(); k.zoomIn(); k.zoomOut(); k.hem(); k.destroy();
```

Spiken implementerar exakt detta (`preview/hitta-ratt-spik/kartmotor.js` +
`gester.js`). `showResult` ritar `target` först efter `lock()` – rätt svar
kommer aldrig in i motorn före låsning.

### 1.5 Prestanda (Chromebook)

Mätt i spiken (§9). Sverige har 46 DOM-noder och ≈ 31 000 punkter, Europa
79 noder och ≈ 27 000 punkter. Panorering och zoom gick i jämna 60 fps
(rAF-takt) även med **4× CPU-strypning**. Inläsningen tog < 10 ms och
bygget < 7 ms.

Regler för C och D:
- **Budget per geofil:** ≤ 40 000 punkter och ≤ 90 kB gzip.
  - Spiken: Sverige 67 kB gzip, Europa 64 kB gzip.
  - Bakgrund långt bort förenklas hårt (1,5–9 km).
- **En detaljnivå i v1.** Byt till två nivåer bara om C mäter ryck på en
  riktig Chromebook. Då laddas en `-detalj`-fil lat när `k > 3 × helvy`, och
  BARA `d` på interaktiva områden byts. Paths byts aldrig under en pågående gest.
- **Mätningen:** rAF-takten bevisar att huvudtråden har marginal.
  Rasteriseringen sker i GPU/raster-tråden och syns inte i headless
  SwiftShader (lärdom från #374). **C ska verifiera på en riktig Chromebook**,
  eller med en trace där `PipelineReporter` visar droppade bildrutor.
  Fallback om rasteriseringen inte hinner: CSS-transform på en wrapper under
  gesten och SVG-transform vid gestens slut.
- **Bara aktivt packs geodata** laddas. Den hämtas med `fetch` när packen
  startar och cachas i minnet. En svensk fråga laddar aldrig världen.

### 1.6 Pluggportens färger

Kartans tokens ligger i modulens egen CSS (`hitta-ratt.css`, laddas lat
som Läsresans `ui-map-stil.js`) och bygger på `--bla/--gron/--gul/--rod/--text`
från `01-grund.css`:

| Token | Värde | Används till |
| --- | --- | --- |
| `--hr-hav` / `--hr-sjo` | `#cfe9f8` | hav, sjöar |
| `--hr-land` | `#fbf3dc` | spelbara områden (varm kräm) |
| `--hr-land-bak` | `#e9e2cf` | övrig mark |
| `--hr-grans` | `#a99b7d` | gränser 0,6–0,9 px |
| `--hr-alv` | `#8ec9ec` | vattendrag 1,1 px |
| `--hr-vald` | `--gul` | valt område + streckad kontur `--text` |
| `--hr-ratt` / `--hr-fel` | `--gron` / `--rod` (+ randmönster) | feedback |
| nålar | `--bla` (elev), `--gron` (rätt) | |

Typsnittet är appens befintliga Baloo 2. **Kartan själv gör inga externa
anrop.** Appens befintliga Google Fonts- och Firebase SDK-anrop
(`index.html`) är oförändrade och inte nya för den här modulen.

---

## 2. Geodata

### 2.1 Källor och licenser (verifierade 2026-10-12)

| Data | Källa | Licens | Version |
| --- | --- | --- | --- |
| Länder, kust, öar | Natural Earth `admin_0_countries` 10m/50m/110m | Public domain | v5.1.2 (git-tagg) |
| Sjöar | Natural Earth `lakes` 10m/50m | Public domain | v5.1.2 |
| Vattendrag | Natural Earth `rivers_lake_centerlines` 10m/50m | Public domain | v5.1.2 |
| Län | Natural Earth `admin_1_states_provinces` 10m (SWE = 21 län, kontrollerat) | Public domain | v5.1.2 |
| Landskap | `github.com/perliedman/svenska-landskap` → Lantmäteriets Distriktskarta | **CC0** | commit `64f033e` |

**Lantmäteriet, verifierat:**
- Lantmäteriets öppna geodata är **CC0**.
- Produkten *Topografi 250 Nedladdning, vektor* har landskapsgränser, men
  **bara som linjer** (objekttyp 1560 "Landskapsgräns" i skiktet
  `administrativ_grans`). Ytor finns bara för län (`lansyta`) och kommuner
  (`kommunyta`).
- För *Topografi 1M* kunde förekomsten av landskapsgräns inte bekräftas.
  Dokumentationen har flyttat in i Geotorget.
- Nedladdning kräver ett **(gratis) användarkonto** på Geotorget. Ett
  admin-skript utan inloggning kan alltså inte hämta datan, och linjerna
  måste dessutom polygoniseras.

**Därför valde vi `svenska-landskap`:**
- Den är också Lantmäteri-data (byggd ur Distriktskartan), CC0, och har alla
  25 landskap som färdiga ytor.
- Den finns i två varianter. Spiken använder den kustklippta. D ska
  utvärdera den oklippta (5 m tolerans) klippt mot Natural Earths 10m-kust,
  eftersom den klippta kustlinjen är grov vid hög zoom (syns vid 5× i
  `docs/hitta-ratt-604/sverige-touch-nyp-val.png`).
- Datan är från 2017–2022, men landskap ändras inte.

### 2.2 Län – nu och senare

- D bygger länen ur Natural Earth admin-1 (public domain, 21 län med namn).
- Om Elias vill ha Lantmäteriets egen länsdata gör Elias detta en gång:
  1. Skapa ett gratis Geotorget-konto.
  2. Ladda ner *Topografi 1M Nedladdning, vektor* (GeoPackage).
  3. Lägg filen i skriptets cache.

  Skriptet byter då källa. Inga andra ändringar behövs, eftersom
  packen pekar på län-nycklar och inte på källan.
- Landskap och län klipps mot **samma** Sverige-kontur (NE 10m), så kusten
  ser likadan ut i båda packen.

### 2.3 Pipeline – `admin/hitta-ratt-geo.mjs` (D, utgår från spikens `admin/hitta-ratt-geo-spik.mjs`)

1. **Hämta** pinnade URL:er till en cache **utanför repot** (`HR_GEO_CACHE`,
   standard `/tmp/hitta-ratt-geo-cache`). Inga rådata committas.
2. **mapshaper** via `npx -y mapshaper@0.6.121` (eller `MAPSHAPER=`), utan
   nya beroenden i `package.json`:
   - `-filter` (vilka länder/lager)
   - `-clip` (klippruta)
   - `-simplify interval=<m> keep-shapes` (topologibevarande: delade gränser
     förblir delade)
   - `-filter-islands min-area=…`
   - `-each 'ix=this.innerX, iy=this.innerY'` (en inre punkt per område för
     ringar och zoomning)
3. **Klippa bakgrund:** den interaktiva ytan klipps snävt. Bakgrunden klipps
   mot kartrektangeln utökad 50–60 % och bak-projicerad till lon/lat
   (`bakRuta`). En rak klippkant i lon/lat blir annars sned i planet (det
   syntes i spiken).
4. **Projicera och skriva** med `projektion.js` → heltal → relativa
   SVG-kommandon utan dubbletter. Varje lager slås ihop till EN path.
   Områdena får blandade, ogenomskinliga id.
5. **Skriva** `src/hitta-ratt/content/geo/<geo-id>.json` och en
   `<geo-id>.nycklar.json` (källnyckel → id, t.ex. `"PRT": "o31"`,
   `"landskap-15": "o2"`). Nyckelfilen används av D:s validering och av
   packbyggaren. **Appen laddar den aldrig.**
6. **Rapport:** filstorlek (rå och gzip) och antal punkter per lager och
   fil, i `src/hitta-ratt/content/KALLOR.md`.

**Geofiler (förslag):**
- `sverige-landskap` (25 interaktiva, grannländer, NE 10m-sjöar/älvar)
- `sverige-lan` (21)
- `europa` (länder enligt Europadefinitionen)
- `varlden` (NE 50m interaktivt, 110m bakgrund)

Punktpack använder samma filer med `interaktiv: false`, och gränser ritas
bara om packen har `visaGranser` satt. Förslaget är svaga landskapsgränser för
Sveriges punktpack som orienteringsstöd. De avslöjar inget svar.

**Format (`v: 1`):**
```json
{ "v": 1, "scope": "sverige", "proj": { "typ": "tm", "lon0": 15, "lat0": 62, "s": 6.07, "x0": -345.09, "y0": 857.39, "bredd": 6125, "hojd": 10000 },
  "lager": { "bakgrund": "M…", "sjoar": "M…", "vattendrag": "M…" },
  "omraden": [ { "id": "o2", "d": "M…z", "c": [3121, 6875] } ],
  "kalla": ["ne", "lm-landskap"] }
```

Specen föreslår GeoJSON eller TopoJSON i repot. Vi committar i stället
**förprojicerade vägar** i JSON. De är mindre än TopoJSON, kräver ingen
avkodare eller projektion i klienten och parsas direkt av webbläsaren.
Källorna är spårbara via pinnade URL:er, och skriptet ger samma resultat
vid omkörning.

### 2.4 Europadefinition (förslag till D, Elias kan justera)

46 länder:
- EU27 (inklusive Cypern och Malta)
- Island, Norge, Schweiz och Liechtenstein
- Storbritannien
- Albanien, Bosnien-Hercegovina, Montenegro, Nordmakedonien, Serbien och
  Kosovo (Sverige erkänner Kosovo)
- Moldavien, Ukraina, Belarus och Ryssland
- Andorra, Monaco, San Marino och Vatikanstaten

Utanför: Turkiet, Georgien, Armenien, Azerbajdzjan och Kazakstan (ritas som
bakgrund). Hantering i Natural Earth:
- Åland slås ihop med Finland och Färöarna med Danmark.
- Jersey, Guernsey och Isle of Man blir bakgrund.
- Frankrike, Spanien och Portugal klipps till Europa. Madeira, Azorerna och
  Kanarieöarna hör till sina länder.
- Ryssland klipps vid den vida bakRutan och ritas helt inom kartan.

### 2.5 Attribution

- **Kartan:** diskret text nere till vänster, 11 px och 60 % opacitet. Sverige:
  "Kartdata: Natural Earth · Lantmäteriet (CC0)". Europa och världen:
  "Kartdata: Natural Earth".
- **Bilder:** "Foto: {fotograf}, {licens}, Wikimedia Commons" under bilden,
  med länk.
- **Översikt:** allt listas i `src/hitta-ratt/content/KALLOR.md`.

Varken public domain eller CC0 kräver erkännande, men vi ger det ändå.
CC BY och CC BY-SA kräver det, och det uppfylls.

---

## 3. Datamodell

### 3.1 Officiella pack = data i repot

Filerna ligger i `src/hitta-ratt/content/packs/<packId>.json`, plus en
`index.json` (lista för startsidan: id, titel, kategori, typ, antal,
svårighet, geo).

```json
{ "id": "sverige-stader", "version": 1, "official": true,
  "title": "Sveriges städer", "description": "20 stora svenska städer",
  "category": "sverige", "type": "point", "difficulty": "grund",
  "geo": "sverige-landskap", "visaGranser": true, "startvy": null, "maxZoom": 10,
  "leaderboard": true,
  "scoringConfig": { "fullKm": 5, "halvKm": 90 },
  "items": [ { "id": "gavle", "name": "Gävle", "prompt": "Var ligger Gävle?", "lat": 60.6749, "lon": 17.1413 } ] }
```

- **Områdesitem:** `{ "id": "uppland", "name": "Uppland", "prompt": "Hitta Uppland", "omrade": "o2" }`.
- **Bilditem** har dessutom: `"bild": { "fil": "colosseum.jpg", "fotograf": "…", "licens": "CC BY-SA 4.0", "licensUrl": "…", "kallaUrl": "https://commons.wikimedia.org/wiki/File:…" }`.
- **`version`** höjs när items ändras. Personbästa och topplista gäller
  `packId`. En ändring av ett befintligt packs frågor kräver ett nytt
  `packId` (t.ex. `europa-alla-v2`), annars jämförs olika omgångar.
- **Egna pack (epic 2/2):** samma schema i `hittaRattPacks/{packId}` med
  `ownerUid`, `classIds` och `leaderboard` (standard false). Geo är alltid
  en av de officiella geofilerna.

### 3.2 Firestore

| Dokument | Innehåll | Läs | Skriv |
| --- | --- | --- | --- |
| `hittaRattAttempts/{attemptId}` | `{ uid, packId, startedAt, status: "open"\|"done", result? }` | ägaren, lärare | **create** av ägaren (`startedAt == request.time`, `status == "open"`, `hasOnly`). Allt annat: bara functionen |
| `hittaRattBest/{uid}` | `{ packs: { [packId]: { typ, s?\|r?, t?, max, n, attempts, at } } }` | ägaren, lärare | bara functionen |
| `hittaRattBoards/{packId}` | `{ packId, typ, titel, entries: { [uid]: { n: namn, k: klass, s \| r,t, at } }, leaders: [uid], updatedAt }` | alla inloggade | bara functionen |
| `hittaRattMeta/ledare` | `{ packs: { [packId]: { uids: [uid], titel, typ } }, updatedAt }` | alla inloggade | bara functionen |
| `classes/{id}.enabledModules` | `["hittaratt"]` (opt-in, ≤ 20) | alla inloggade | lärare (§6) |
| `studentData/{uid}.room.placements["hrpokal-<packId>"]` | `{ x, y }` – bara **placeringen** av en pokal | (befintligt) | (befintligt: eleven) |

Fältförkortningar i `entries` (som `members` i classProjections): `s` =
poäng (punkt), `r` = antal rätt och `t` = aktiv tid i **tiondelar av sekunder**
(område). Ett dokument rymmer ≈ 10 000 elever (1 MB). En skola på 600 elever
ger ≈ 60 kB.

**Läsningar (#231, O(1)):**
- startsidan: 1 (`hittaRattBest/{uid}`)
- 🏆-vyn: 1 per valt pack
- resultatskärmen: 0 (functionen returnerar Top 15 och egen plats)
- huset: 1 (`hittaRattMeta/ledare`, cachad per session, även för kompisars hus)
- ett försök: 1 create plus ett function-anrop

**Mönster vi följer:**
- `classProjections`: ett dokument med en map keyad på uid, en läsning.
- Pokaler i Klasscentret (#494/#497): placeringen sparas separat och
  tillståndet ritas ur sin källa.
- Guldrushens functions (#563): servern avgör poängen, och rena regelfiler
  synkas till `functions/` med `admin/sync-*.mjs`.

### 3.3 Ranking (gemensam ren modul `src/hitta-ratt/delat/rank.js`)

- **Punkt:** sortera på `s` fallande. Lika poäng ger **samma placering**.
  Placeringen är *tät*, så `1, 1, 2`, precis som specens exempel
  (Omar 1943 / Clara 1943 → båda 1, Alma 1928 → 2). Tiden används aldrig.
- **Område:** sortera på `r` fallande, sedan `t` stigande. Exakt lika (`r`
  och `t` i tiondelar) ger samma placering. 43/44 hamnar aldrig över 44/44,
  eftersom `r` alltid jämförs först.
- **Egen plats** räknas ur samma dokument (alla entries finns där). Om
  eleven finns i Top 15 visas ingen extra rad.
- **Ledare** är alla med placering 1. Delad etta på punktpack ger flera
  ledare, och områdespack följer samma logik.
- **Visning:** "Omar, 5E – 1943 p" och "Omar, 5E – 44/44 rätt – 1:39".
  Har två rader samma m:ss visas tiondelar ("1:39,2").

### 3.4 Personbästa (`rank.js: battre(ny, gammal, typ)`)

- Punkt: ersätts bara om `ny.s > gammal.s`.
- Område: ersätts om `ny.r > gammal.r`, eller om `ny.r == gammal.r` och
  `ny.t < gammal.t`.
- Lika är aldrig bättre. Ett sämre försök ökar bara `attempts`.

---

## 4. Säkerhet

### 4.1 Resultatflödet

1. **Start:** klienten skapar `hittaRattAttempts/{id}`. `startedAt` är
   serverns tid och styrs av regeln. Frågornas ordning slumpas i klienten med
   `crypto.getRandomValues`. Ordningen påverkar inte rättningen.
2. **Under omgången:** klienten rättar själv med **samma** rena moduler
   (`delat/poang.js`, haversine) för direkt feedback. Inget nätverk per fråga.
   Den aktiva tiden mäts med `performance.now()` och pausas från lås till
   "Nästa".
3. **Slut:** `hittaRattSubmit({ attemptId, svar: [{ itemId, lon, lat } | { itemId, omrade, ms }] })`
   (callable, europe-west1, Admin SDK). Functionen:
   1. Kräver inloggning, att försöket tillhör anroparen, `status == "open"`
      och att det är högst 6 h gammalt.
   2. Hämtar packen, officiell ur den synkade kopian i `functions/hitta-ratt/`
      och egen ur `hittaRattPacks`. Kontrollerar att Hitta rätt! är
      aktiverat i elevens klass.
   3. Validerar att svaren täcker **exakt** packens items, en gång var, att
      koordinaterna är ändliga och inom ±180/±90, och att `omrade` är ett
      känt id.
   4. Kontrollerar tiden (område): varje `ms` ≥ 700 och Σ`ms` ≤
      (nu − `startedAt`) + 2 s. Annars avvisas omgången.
   5. **Räknar om allt** med `poang.js`, `rank.js` och haversine. Klientens
      totalsumma finns inte ens i anropet.
   6. Gör allt i **EN transaktion**:
      - försök → `done` + `result`
      - `hittaRattBest/{uid}` (`battre`)
      - om packen har topplista och personbästat förbättrats:
        `hittaRattBoards/{packId}.entries.{uid}` (namn ur
        `students/{uid}.namn`, klass ur `classes/{classIds[…]}.name`). Därefter
        räknas `leaders` om, och om de ändrats uppdateras
        `hittaRattMeta/ledare.packs.{packId}`.
      - `studentData/{uid}.coins += godkända` (punkt > 0 p, område rätt)
   7. Returnerar `{ result, pb, nyttRekord, plats, top15, coins }`.
   8. Blir det ett nätfel kan klienten försöka igen med samma `attemptId`.
      Är försöket redan `done` returneras det sparade resultatet **utan**
      nya coins. Det är idempotent.

**Varför en Cloud Function och inte bara regler** (som Mattematchen):
- Poängen kräver trigonometri (haversine), som reglerna saknar.
- En hel omgång måste räknas om på en gång.
- Topplistedokumentet måste skrivas om ur alla entries.

Mönstret finns redan: Guldrushens functions (#563) och `updateStudentLogin`.

### 4.2 Hot och skydd

| Hot | Skydd |
| --- | --- |
| Skriva högre poäng direkt | `hittaRattBest`, `hittaRattBoards` och `hittaRattMeta` har `allow write: if false`. Bara Admin SDK skriver. |
| Sänka någon annans rekord, falsk klass eller falskt namn | Functionen skriver bara anroparens egen entry. Namn och klass läses från servern. |
| Skicka påhittad totalsumma | Totalsumman skickas inte – den räknas fram ur svaren på servern. |
| Snabba falska tider (område) | Golv 700 ms per fråga och Σ ≤ verklig tid sedan servern registrerade starten. |
| Dubbla coins (retry, dubbelklick) | `status` på försöket i samma transaktion. Ett andra anrop får samma svar och 0 nya coins. |
| Omgång med halva packen | Svaren måste täcka exakt alla items. |
| Ändra pokalen | Pokalen ritas ur `hittaRattMeta/ledare` (skrivskyddad). `room.placements` styr bara positionen. |
| Samtidiga resultat (ledarbyte) | Transaktion på topplistedokumentet. Ledarna räknas fram ur entries varje gång, så det blir alltid konsekvent och kan inte driva iväg. |

**Rätt svar läcker inte i UI före lås:**
- Geofilerna har inga namn, orter eller etiketter. DOM-id:n är
  ogenomskinliga och blandade.
- Motorn får `target` först i `showResult` efter `lock()`.
- Inga `title` och inga hover-texter på områden.

**Medvetet accepterat (ärligt):**
- Packfilen innehåller facit, eftersom klienten ger direkt feedback och
  repot är **publikt** (GitHub Pages).
- Geografi är allmän kunskap. En elev som skriptar och skickar Wikipedias
  koordinater får 100 p oavsett om facit göms.
- Att gömma facit på servern (en function per fråga) skulle ge nätverks-
  och kallstartsfördröjning på varje "Lås svar" och samma fusk-risk. Därför
  väljer vi bort det.
- Skriptat fusk syns för läraren och kan rensas (§4.3).

### 4.3 Underhåll

- `admin/delete-student.mjs` (F) tar även bort elevens entry i alla
  topplistor och räknar om ledarna.
- En lärarknapp "Ta bort från topplistan" (epic 2/2) anropar en function med
  samma omräkning.
- **Epic 2/2:** när `leaderboard` stängs av för ett eget pack tar functionen
  bort `hittaRattBoards/{packId}` och `hittaRattMeta/ledare.packs.{packId}`
  i samma transaktion. Pokalen försvinner då vid nästa husrendering.

---

## 5. Poängmodell för punktfrågor

`src/hitta-ratt/delat/poang.js` (spikens `preview/hitta-ratt-spik/poang.js`):

```
p(d) = 100                              om d ≤ fullKm
p(d) = round(100 · 2^(−x^1,5))          x = (d − fullKm) / (halvKm − fullKm)
```

**Egenskaper:**
- Ger alltid 0–100.
- Kontinuerlig, så inga hopp.
- Strikt fallande efter `fullKm`. Avrundningen gör den monotont
  icke-växande, vilket testas varje halv km upp till 5 000 km.
- 50 p vid exakt `halvKm`.
- 0 p från ≈ `fullKm + 3,9·(halvKm − fullKm)`.

**Parametrar och normalisering:**
- Det finns två intuitiva rattar per pack: `scoringConfig: { fullKm, halvKm }`.
- **Normalisering:** `halvKm ≈ 5,5 % av kartans diagonal` (Sverige ≈ 1650 km,
  Europa ≈ 4000 km, världen ≈ 11 000 km). Det kan finjusteras per pack.

| km fel → | 10 | 20 | 40 | 75 | 100 | 150 | 200 | 300 | 500 | 1000 | 2000 | 0 p från |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Sverige** (5 / 90) | 99 | 95 | **83** | 60 | 44 | 21 | 9 | 1 | 0 | 0 | 0 | 335 km |
| **Europa** (10 / 220) | 100 | 99 | **96** | 89 | 82 | 69 | 55 | 32 | 8 | 0 | 0 | 825 km |
| **Världen** (25 / 600) | 100 | 100 | **100** | 98 | 97 | 93 | 89 | 80 | 59 | 22 | 1 | 2256 km |

40 km fel ger 83 p på Sverigekartan men 100 p på världskartan, som specen
§7 kräver.

**Totalsumma, snitt och coins:**
- Totalen är summan av alla frågor (20 frågor → max 2000 p).
- Snittet är total / antal.
- **Godkänt svar** (1 coin) = punkt > 0 p eller område rätt.
- Föreslagna parametrar:
  - Sveriges städer och Sveriges geografi: 5/90.
  - Europas huvudstäder 20 och alla, och Kända platser i Europa: 10/220.
  - Världens huvudstäder och Kända platser i världen: 25/600.

  E och D kan justera dem efter speltest. Ett test låser exempeltabellen.

---

## 6. Klassaktivering

**Live och Mattematchen** syns bara när läraren startat något
(`NAV_VILLKOR` i `ui.js`). Hitta rätt! är en **permanent** modul, så vi
återanvänder i stället mönstret från **modulsynlighet (#412)**, men som
opt-in:

- **Data:** `classes/{id}.enabledModules: string[]`. Regeln
  `validEnabledModules()` är en exakt spegling av `validHiddenModules()`
  (lista, ≤ 20, bara lärare). Saknas fältet är modulen **av** (som specen:
  "Lärare kan aktivera …").
- **Register:**
  - `TOGGLABLE_MODULES` får posten `{ id: "hittaratt", label: "Hitta rätt!",
    routes: ["/elev/hitta-ratt"], optIn: true }`.
  - `modulesForStudent()` gäller som union: aktiverad i **någon** av elevens
    klasser → syns, så länge ingen klass döljer den.
  - Sidomenyn får en rad `{ hash: "#/elev/hitta-ratt", ikon: "🗺️", label:
    "Hitta rätt!", modul: "hittaratt" }`.
  - Routern stoppar dolda moduler som idag, även för direktlänkar (test 7).
  - Klass-låset (#436) spärrar `/elev/*` automatiskt.
- **Lärar-UI:** en kryssruta "Hitta rätt! (av som standard)" i den befintliga
  sektionen "Synliga moduler" (`teacher-class-modules.js`).
- **Bootgrafen:** boot-filerna (`gamemode-visibility.js`, `ui.js`, `app.js`)
  får bara registerrader. Routen gör `import("./hitta-ratt/page-hitta-ratt.js")`.
  Bootgrafen förblir 107 (`admin/qa-bootgraf-bfs.mjs`).

---

## 7. Bilder för sevärdheter

- Skriptet `admin/hitta-ratt-bilder.mjs` (D) gör följande:
  1. Läser `bildKalla: "File:…"` per item i pack 11–12.
  2. Anropar Commons API (`prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`,
     verifierat att det fungerar).
  3. Laddar ner miniatyren (Commons levererar 960 px-steget) till
     `src/hitta-ratt/content/bilder/<itemId>.jpg`.
  4. Skriver `bild { fotograf, licens, licensUrl, kallaUrl }` i packen.
- **Bara licenserna** PD, CC0, CC BY och CC BY-SA godtas (vitlista).
  `Artist` rensas från HTML.
- **Storlek:** ≤ 120 kB per bild. Om D hittar ett verktyg offline
  (`npx sharp-cli`) blir det WebP 800 px. Då måste `.webp` läggas till i
  `server.mjs`-typerna. Annars blir det JPEG från Commons 960 px-steg.
- **Laddning:** bilderna laddas lat. Bara aktuell fråga laddas och nästa
  förladdas. Speltiden använder aldrig Commons.
- **Attribution** visas diskret under bilden och samlat i `KALLOR.md`.
- **Egna bilder (epic 2/2)** laddas upp till Storage. Det beslutet tas i epic 2.

---

## 8. Uppdelning – bekräftad med justeringar

| # | Innehåll | Justering mot issue-texten | Beror på |
| --- | --- | --- | --- |
| **C #606** kartmotor | Lyft spikens `projektion.js`, `kartmotor.js` och `gester.js` till `src/hitta-ratt/karta/` och `hitta-ratt.css`. Lägg till reduced-motion, fokus och tester (projektion tur och retur, haversine, gränser, `arKlick`). Verifiera fps på en riktig Chromebook eller med en trace (§1.5). | Inget nytt – API:t i §1.4 är redan prövat. | – |
| **D #607** data | Bygg `admin/hitta-ratt-geo.mjs` ur spikskriptet (alla 4 geofiler, nycklar, rapport), skriv de 12 packen och `index.json`, ta fram bilder (§7), en valideringstest och `KALLOR.md`. | Format = förprojicerad JSON (§2.3), inte GeoJSON/TopoJSON. Län ur Natural Earth (§2.2). Europadefinition §2.4. | – (kan gå parallellt med C, kör nästan bara Node) |
| **B #605** modul | Route, nav, `enabledModules` med regel och regeltest, lärarkryssruta, startsida ur `index.json`, personbästa ur `hittaRattBest/{uid}` (stub tills F är klar), 🏆-knapp (stub). | Opt-in-fält enligt §6 (inte `hiddenModules`). | D:s `index.json` (en stub räcker för att starta) |
| **F #609** server och topplista | `delat/poang.js`, `delat/rank.js`, `functions/hitta-ratt-core.js` (`hittaRattSubmit`), sync-skript och predeploy, regler (§3.2), function- och regeltester med attacker, `hr-data.js`, 🏆-vyn, `delete-student`-städning. | **Flyttas FÖRE E.** Tar över serverdelen av coins (inkrement i transaktionen, inte klientens `addCoins`) och poängmodulen. | D (packen synkas till `functions/`) |
| **E #608** spelflöden | Punkt- och områdesomgång, aktiv tid, resultatskärm som visar functionens svar (Top 15, plats, personbästa, coins), felhantering och omförsök. | Coins krediteras av F:s function. E visar dem och invaliderar studentData-cachen. Topplistan finns redan från F, så ingen platshållare behövs. | B, C, D, F |
| **G #610** pokaler | Kodritad Kartmästare-SVG (något mindre än Live-pokalerna). Huset läser `hittaRattMeta/ledare` och ritar pokaler för de pack eleven leder, med placering i `room.placements["hrpokal-…"]` och tooltip. | Ingen tilldelning eller borttagning i G – ledarna räknas fram av F:s transaktion. G gör bara rendering och placering. | F |
| **H #611** slut-QA | Som i issue-texten. | – | alla |

**Föreslagen ordning med 8 GB RAM** (en worker med webbläsare eller emulator
åt gången):
1. C (webbläsare) och D (Node) parallellt.
2. B.
3. F (emulator).
4. E.
5. G.
6. H.

**Deploy före live**, i ordning:
1. `firebase deploy --only firestore:rules`
2. `firebase deploy --only functions` (Blaze finns)
3. Pages

Rules och functions ska ut före Pages, annars nekas försöket och
resultatskärmen visar "kunde inte sparas".

**Stapling:** epic-grenen ligger ovanpå Tidsjakten (#595, 4d4a957). Dokumentet
är kontrollerat mot det läget:
- Bootgrafen är fortfarande 107.
- `functions/` har nu `guldrush-core.js` + `guldrush-rattning.js`.
- `firebase.json` har en predeploy-rad (`sync-guldrush-functions.mjs`).

F lägger till `functions/hitta-ratt-core.js`, `admin/sync-hitta-ratt-functions.mjs`
och en **andra** predeploy-rad, och utökar `package.json`-skripten
`test:rules`/`test:functions`. Reglerna för Hitta rätt! läggs som ett eget
block och rör inte Live/Snilleblixten-grenarna som Tidsjakten ändrade.

---

## 9. Spiken – vad som är bevisat

**Kör:** `PORT=8604 node server.mjs` → `/preview/preview-hitta-ratt-spik.html`.
Bygg om datan: `node admin/hitta-ratt-geo-spik.mjs`.

| Krav | Resultat |
| --- | --- |
| Sverige (landskap) och Europa (länder) som egen SVG | ✓ Natural Earth + Lantmäteriet-landskap (CC0), 46 respektive 79 DOM-noder |
| Zoom med mushjul (mot pekaren), +/–, ⤢ och tangenter | ✓ |
| Drag-panorering, och ett drag väljer aldrig | ✓ testat: 200 px drag → inget val |
| Nyp och tvåfingersdrag (touch) | ✓ testat: nyp ×2 och ×5,5, mobilvy 412 px |
| Klick på polygon (även Malta via klickring) | ✓ Uppland, Spanien och Malta träffas rätt |
| Nål: sätt, dra och flytta, lås, visa rätt plats, linje, km och poäng | ✓ "Du var 111 km från Gävle · 38 / 100 p", nålen orörlig efter lås |
| Områdesfeedback: fel rött med randmönster, rätt grönt, båda syns | ✓ `docs/hitta-ratt-604/europa-omrade-fel.png` |
| Ingen extern request | ✓ nätverkslistan: bara `localhost:8604` (html, 4 js, 2 geo, 2 namn) |
| Prestanda | ✓ 60 fps rAF-takt vid panorering, helvy och inzoomad, även med 4× CPU-strypning. Laddning < 10 ms, bygg < 7 ms. Rasteriseringen ska verifieras på en riktig Chromebook (§1.5). |
| Storlek | Sverige 164 kB (67 kB gzip), Europa 150 kB (64 kB gzip) |

Skärmdumpar finns i `docs/hitta-ratt-604/`:
- `sverige-startvy.png`
- `europa-omrade-fel.png`
- `sverige-touch-nyp-val.png`

**Spikens kända brister (åtgärdas i C och D, inte buggar i motorn):**
- Landskapens kust är grov vid över 5× zoom (källans klippning) → §2.1.
- `namn-*.json` finns bara för spikens felsökningsruta. Produktionen har
  namnen i packen.
- Ryssland och Asien ritas utan Europaavgränsning → §2.4.

## 10. Öppna frågor till Elias

1. **Placering vid lika poäng:** tät (`1, 1, 2`) enligt specens exempel, eller
   "idrotts" (`1, 1, 3`) som Live använder? Dokumentet väljer **tät**.
2. **Av som standard:** Hitta rätt! syns inte förrän läraren kryssar i den för
   klassen. Okej?
3. **Europadefinitionen** i §2.4 (46 länder, Kosovo med, Turkiet utanför).
4. **Ska omgångar ge Klass-EXP** (Klasscentret, `kc-koppling.js`) som andra
   spellägen? Specen säger inget. Förslaget är ja, med samma krok som Läsresan
   och Mattematchen, i E.
5. **Lantmäteriets egna länsgränser:** vill du skapa ett Geotorget-konto och
   ladda ner Topografi 1M en gång? Annars används Natural Earths län, som
   har samma 21 län och är public domain.
