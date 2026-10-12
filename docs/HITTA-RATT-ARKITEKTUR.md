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
| Bilder | Wikimedia Commons, nerladdade till repot (≤ 120 kB/bild) med fotograf och licens i packen. Egna pack: Firestore-dokument per bild, se §11.8. |
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
- **Små områden** (#639, `karta/ringregel.js`): två steg. Byggskriptet
  sätter `liten` (sidan på en kvadrat med samma yta som områdets största
  sammanhängande del, i kartenheter) bara när den delen är under
  `RING_KM2 = 12 000 km²` – mikrostater och små önationer. Motorn ritar en
  **klickring** (r = 12 px, hela cirkeln är klickyta) när `liten · k` är
  under `LITEN_PX = 12` skärm-px. Normalstora länder (Belgien, Israel,
  Rwanda …) får aldrig ring, oavsett skärmbredd. Överlappar ringar vinner
  den närmaste ringmitten. Ringen är diskret (tunn, halvgenomskinlig) och
  avslöjar inget namn; vald = streckad, rätt = heldragen, fel = prickad.
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

**Levererat i C #606** (`src/hitta-ratt/karta/`, preview
`preview/preview-hitta-ratt-karta.html`, test `test/hitta-ratt-karta.test.js`):
- Filer: `kartmotor.js` (DOM, svar, API), `kamerastyrning.js` (gränser,
  animationer), `kamera.js` (ren kameramatte + `vagRuta`), `skarmlager.js`
  (nålar, ringar, linje, etiketter), `gester.js`, `projektion.js`
  (+ `rutaTillKarta`), `karta-stil.js` (CSS, injiceras en gång).
- Utökade options: `minZoom`, `panGrans` (lon/lat-ruta), `visaGranser:
  true | "svag" | false`, `laddaDetalj` + `detaljVid` (valfri detaljnivå).
- `showResult({ guess, target, km, label })` ritar km vid linjen och namnet
  vid rätt nål; `showAreaResult({ valt, ratt, label })` namnet vid området.
- `reset()` glider tillbaka till startvyn (`reset({ hem: false })` gör det inte).
- Tangentbord: pilar, +/−, 0/Home = helvy, Enter/mellanslag = svara vid
  siktet i vyns mitt (syns bara vid tangentbordsfokus).
- `prefers-reduced-motion` ger direkta hopp. Värdens position läses en gång
  per gest (ingen tvingad omlayout per pointermove).

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
- **Bilditem** har dessutom: `"bild": { "fil": "colosseum.webp", "bredd": 800, "hojd": 561, "kalla": "Colosseo 2020.jpg", "fotograf": "…", "licens": "CC BY-SA 4.0", "licensUrl": "…", "kallaUrl": "https://commons.wikimedia.org/wiki/File:…" }`.
- **Byggt i D (#607):** punktitems har även `wikidata` (koordinatkälla), ofta
  `inom` (land/landskap-nyckel som testet kontrollerar) och ibland `malpunkt`
  (förklaring när målpunkten valts för hand). Områdesitems har `key`
  (källnyckel) som `admin/hitta-ratt-packs.mjs` översätter till `omrade`.
  Se `src/hitta-ratt/content/KALLOR.md`.
- **`version`** höjs när items ändras. Personbästa och topplista gäller
  `packId`. En ändring av ett befintligt packs frågor kräver ett nytt
  `packId` (t.ex. `europa-alla-v2`), annars jämförs olika omgångar.
- **Egna pack (epic 2/2):** samma schema i `hittaRattPacks/{packId}` med
  `ownerUid`, `classIds` och `leaderboard` (standard false). Geo är alltid
  en av de officiella geofilerna. Se §11.1. Egna pack behåller sitt id när
  facit ändras. Där höjs i stället `version`, och topplistan nollställs (§11.4).

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

**Levererat i F #609:**
- Delad kod `src/hitta-ratt/delat/{poang,rank,omgang}.js` → genererad kopia
  `functions/hitta-ratt/` + kompakt facit `packs.js` (`npm run sync:hitta-ratt`,
  predeploy-rad 2 i `firebase.json`, testet fäller drift).
- `functions/hitta-ratt-core.js` (`submit`, `taBortElev`), export
  `hittaRattSubmit` i `functions/index.js`. Klient: `src/hitta-ratt/hr-data.js`
  (`startaForsok`, `skickaOmgang`, `hamtaTopplista`).
- 🏆-vyn: `hr-topplista-vy.js` (`topplistaHtml(lista, max)` återanvänds av E:s
  resultatskärm med functionens `{ top, egen, plats, antal }`).
- Top 15 = de 15 första raderna **plus** de som delar plats med rad 15 (tak 25).
- Tester: `test/hitta-ratt-delat.test.js`, `test/firestore-rules-hitta-ratt.test.js`,
  `test/functions-hitta-ratt-core.test.mjs`, `test/functions-hitta-ratt.test.mjs`.
  Preview: `admin/qa-hitta-ratt-preview.sh` (nu med Functions-emulatorn 5605) +
  `admin/qa-hitta-ratt-topplista-seed.mjs` (40 elever, spelar via kärnan).

**Levererat i E #608:**
- `src/hitta-ratt/hr-spel.js` (DOM, dynamisk) kör omgången: `startaForsok`
  innan första frågan blir aktiv, alla frågor i `blanda()`-ordning, lås →
  `showResult`/`showAreaResult` (facit in i motorn först nu), "Nästa" tar
  emot klick först efter 450 ms (ingen dubbelklicksfälla), lämna-vakten är
  på tills resultatet skickas. Sparfel → "Försök igen" med samma `attemptId`.
- `src/hitta-ratt/hr-omgang.js` (ren): `skapaOmgang` rättar varje lås med
  `delat/poang.js`, `skapaStoppur` = aktiv tid (pausad under feedbacken),
  `serverMs` lyfter ett lås snabbare än 700 ms till golvet, feedbacktexter.
- `src/hitta-ratt/hr-resultat-vy.js` (ren): resultatskärmen med kodritad
  illustration, personbästa, plats och `topplistaHtml` ur functionens svar.
  Coins som visas = `result.godkanda` (krediterade EN gång av functionen –
  ett omförsök ger `coins: 0` men samma `result`).
- Test: `test/hitta-ratt-spel.test.js` (poäng Sverige/världen, aktiv tid,
  coins, resultatskärm). Preview: `admin/qa-hitta-ratt-preview.sh`.
- Klass-EXP-kroken är avstängd (`KLASS_EXP_PA = false`, se §10 fråga 4).

**Levererat i G #610 (Kartmästare-pokalerna):**
- Ingen ägd sak (§0): `src/hitta-ratt/hr-pokal.js` (ren) – `minaPokaler(meta, uid)`
  ger de pack där eleven finns i `hittaRattMeta/ledare.packs.{id}.uids`
  (delad etta = alla ettor; `av: true` eller tom lista = ingen pokal).
  `rensaPokaler` tar bort placeringar som inte längre gäller.
- `src/hitta-ratt/hr-pokal-art.js`: jordglobspokal, unik per pack (motiv ur
  kategorin, kartnål/område ur typen, rosettfärg ur packId). 2,85 rums-enheter
  bred (Klasscentrets pokaler 3,17).
- `src/hitta-ratt/hr-pokal-rum.js` (dynamisk): EN läsning av ledardokumentet,
  cachad 60 s och nollad av `skickaOmgang`. `varld-rum.js` ritar pokalen som
  en golvsak (nyckel `hrpokal-<packId>`, samma drag/🗑️ som möbler), lägger
  oplacerade först i Möbler-lådan och städar + sparar placeringar för tappade
  pokaler. `pages-klasskamrat.js` visar kamratens utställda pokaler (läsläge).
  Hover/vald: skylt "🏆 Kartmästare – Skolrekord {titel}" (`hr-pokal.css`).
- Servern: oförändrad tilldelning (F:s transaktion). Ny `stangTopplista(deps,
  packId)` i `functions/hitta-ratt-core.js` – förberedd toggle för epic 2/2,
  tar bort topplistan och `ledare.packs.{id}` i en transaktion, idempotent,
  ännu inte kopplad till någon callable.
- Test 12: `test/hitta-ratt-pokal.test.js`, `test/functions-hitta-ratt-pokal.test.mjs`
  (tilldelning, delad etta punkt/område, ledarbyte även utställd, 6 samtidiga
  resultat, två pack samtidigt, omförsök, stängning),
  `test/firestore-rules-hitta-ratt-pokal.test.js`. Preview:
  `admin/qa-hitta-ratt-pokal-seed.mjs` (körs av `qa-hitta-ratt-preview.sh`) och
  `preview/preview-hitta-ratt-pokal.html` (alla 12 pokaler).
- Ingen regeländring, ingen ny deploy utöver F:s.

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
     `src/hitta-ratt/content/bilder/<itemId>.webp` (D: WebP max 800 px via `npx sharp-cli`, `.webp` finns i `server.mjs`).
  4. Skriver `bild { fotograf, licens, licensUrl, kallaUrl }` i packen.
- **Bara licenserna** PD, CC0, CC BY och CC BY-SA godtas (vitlista).
  `Artist` rensas från HTML.
- **Storlek:** ≤ 120 kB per bild. Om D hittar ett verktyg offline
  (`npx sharp-cli`) blir det WebP 800 px. Då måste `.webp` läggas till i
  `server.mjs`-typerna. Annars blir det JPEG från Commons 960 px-steg.
- **Laddning:** bilderna laddas lat. Bara aktuell fråga laddas och nästa
  förladdas. Speltiden använder aldrig Commons.
- **Attribution** visas diskret under bilden och samlat i `KALLOR.md`.
- **Egna bilder (epic 2/2):** inget Storage. Bilderna sparas nedskalade som Firestore-dokument, och Commons-bilder kopieras (§11.8).

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
   **E #608:** kroken finns men är avstängd – `KLASS_EXP_PA = false` i
   `src/hitta-ratt/hr-spel.js` anropar `klassExpEfterOvning({ modul: "hittaratt",
   resultat: { ratt: godkända, totalt: n } })` efter sparat resultat. Vid ja:
   sätt flaggan till `true` och registrera regeln `hittaratt` i
   `src/klasscenter/kc-exp-regler.js` (raden står i kommentaren vid flaggan).
5. **Lantmäteriets egna länsgränser:** vill du skapa ett Geotorget-konto och
   ladda ner Topografi 1M en gång? Annars används Natural Earths län, som
   har samma 21 län och är public domain.

---

## 11. Epic 2/2 – egna områden (#632, epic #612)

Beslutsdokument för lärarens egna kartor. Spec: §18–21, §27–30 och §35 test 8.
Coders B–G bygger direkt efter det här avsnittet. Spikarna finns i §11.12.

### 11.0 Besluten i korthet

| Fråga | Beslut |
| --- | --- |
| Lagring | `hittaRattPacks/{packId}`, **ett dokument per pack med alla items** (≤ 60 items ≈ ≤ 40 kB, långt under 1 MB). Bilderna ligger **inte** i packdokumentet. |
| Id | `e-` + 12 tecken `[a-z0-9]`, skapas i klienten (`e-k3f9q0z1m2xa`). Prefixet `e-` är reserverat, så id:t kan aldrig krocka med officiella pack. Det passar befintlig regex `^[a-z0-9-]{1,60}$` i regler, `hrpokal-<packId>` och topplistor. |
| Vem skriver | **Bara Cloud Functions.** Läraren sparar, raderar och slår på topplistan via callables. Regler kan inte loopa över en lista med items, så valideringen måste ligga på servern. Inga nya klientskrivningar i packen, och inga nya stora regeluttryck (lärdom #497). |
| Katalog (#231) | `hittaRattMeta/egnaPack` – **ett dokument** med en kort post per eget pack. Startsidan, 🏆-vyn och lärarens "Mina områden" läser det med **en läsning**. Servern skriver det i samma transaktion som packen. |
| Synlighet | Packet syns för elever i `classIds`. Servern kontrollerar klassen vid `hittaRattSubmit`. Läsningen av packen är öppen för inloggade (som `subjects`, #114). |
| Redigering | Bara **ägaren** (`ownerUid`) får spara, radera och slå på topplistan. Alla lärare får läsa och **duplicera**. Geofil och frågetyp är låsta efter skapandet ("Duplicera" för att byta). |
| Ändrade frågor | Servern räknar en **facitnyckel** (typ, geo, items-id + lat/lon eller område). Ändras den höjs `version`: topplistan och ledarna nollställs i samma transaktion, och gamla personbästa (`v` ≠ `version`) räknas inte längre. Ändras bara texter eller bilder händer inget. |
| Topplista PÅ | Callable `hittaRattSattTopplista({ packId, pa: true })`. Topplistan **byggs upp ur befintliga personbästa** för aktuell version (frågan mot `hittaRattBest`, en gång per påslag). |
| Topplista AV | Samma callable med `pa: false` → befintliga `stangTopplista`. Personbästa sparas fortfarande. Pokalen försvinner vid nästa husrendering. |
| Radering | `hittaRattRaderaPack` tar bort packen, katalogposten, topplistan, ledarna (i en transaktion) och packens bilder. |
| Platssökning | **Wikidata** (`wbsearchentities` + `wbgetentities`, P625) som huvudkälla, **Nominatim** som reserv. Bara på knapp eller Enter. Kartan själv är alltid en reserv: läraren kan klicka eller dra nålen. |
| Polygonval | Klick i kartmotorn lägger till eller tar bort en fråga. Namnen kommer från en ny `<geo>.namn.json` (källnyckel → svenskt namn), som bara lärarvyn laddar. |
| Bilder | **Inget Firebase Storage.** Bilden skalas ned i webbläsaren (WebP, ≤ 800 px, ≤ 120 kB) och sparas som eget dokument `hittaRattBilder/{bildId}` (Firestore `Bytes`). Commons-bilder **kopieras** dit när läraren väljer dem. Eleven hämtar aldrig något från Commons. |
| Lärarvy | Ny flik i `TEACHER_TABS`: **"Hitta rätt!"** (`#/larare/hitta-ratt`), med `lazyPage`. Allt i `src/hitta-ratt/larare/` laddas dynamiskt. Bootgrafen förblir **107**. |
| Provspel | Läraren provspelar med `hr-spel.js` och lokala deps (rättning i klienten, inget försök, inga coins). |
| Deploy | rules → indexes → functions → Pages. Ingen Storage. |

### 11.1 Datamodell

**`hittaRattPacks/{packId}`** – samma schema som officiella pack (§3.1) plus
fälten för egna pack:

```json
{ "id": "e-k3f9q0z1m2xa", "official": false,
  "ownerUid": "<lärarens uid>", "ownerNamn": "Anna L",
  "classIds": ["5A", "5E"], "leaderboard": false,
  "version": 3, "facitNyckel": "<sha1>", "facitAt": <Timestamp>,
  "createdAt": <Timestamp>, "updatedAt": <Timestamp>,
  "title": "Gästrikland runt", "description": "Orter och natur i Gästrikland",
  "ikon": "🏞️", "category": "egna", "type": "point",
  "geo": "sverige-landskap", "startvy": "auto",
  "items": [
    { "id": "gavle", "name": "Gävle", "prompt": "Var ligger Gävle?",
      "lat": 60.6749, "lon": 17.1413, "kalla": "wikidata:Q25748" },
    { "id": "radhuset", "…": "…",
      "bild": { "id": "e-k3f9q0z1m2xa--a8d0c2kq", "bredd": 800, "hojd": 533,
                "kalla": "commons", "fil": "File:Gävle rådhus 01.jpg",
                "fotograf": "I99pema", "licens": "CC BY-SA 4.0",
                "licensUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
                "kallaUrl": "https://commons.wikimedia.org/wiki/File:…" } }
  ] }
```

- **Områdesitem:** `{ id, name, prompt, omrade: "o5", key: "uppland" }`. Både
  `omrade` (spelets id) och `key` (källnyckel) sparas. Om en geofil någon gång
  byggs om med nya id kan `omrade` räknas om ur `key` med `<geo>.nycklar.json`.
  ⚠️ `admin/hitta-ratt-geo.mjs` får inte blanda om id:n för befintliga geofiler
  utan en migrering av egna pack (står som varning i skriptet, B).
- **Härledda fält (sätts av servern, inte av läraren):**
  - `scoringConfig` och `maxZoom` ur geofilens scope: Sverige 5/90 och 10,
    Europa 10/220 och 16, världen 25/600 och 24 (§5).
  - `visaGranser`: punkt → `"svag"`, område → `true`.
  - `category` är alltid `"egna"`. Egna pack har ingen svårighetsnivå.
- **`startvy: "auto" | "hel"`.** Specens "anpassat" scope (§19) löses utan ny
  geodata: `"auto"` passar in startvyn efter itemens utbredning (punkter, eller
  områdenas inre punkt `c`) med 30 % luft. Minsta spann är 25 % av scope-rutan,
  och det kräver minst 4 items (annars hela kartan). Det räknas i klienten
  (`hr-egna.js`) och lagras inte. `"hel"` = hela scope-rutan.
- **Gränser (servern):**

  | Fält | Gräns |
  | --- | --- |
  | `title` | 1–60 tecken |
  | `description` | ≤ 200 |
  | `name` | 1–60 |
  | `prompt` | ≤ 120. Tomt → "Var ligger {name}?" eller "Hitta {name}" |
  | items | 1–60, `id` unika `^[a-z0-9-]{1,60}$` |
  | områden | unika per pack |
  | `classIds` | ≤ 20 befintliga klasser |
  | `ikon` | en av ~16 emojis i `delat/egna.js` (`IKONER`) |
  | katalogen | servern vägrar nya pack när den passerat 800 kB (≈ 2 000 pack) |

  - 60 items täcker "Afrikas länder" (54) och ligger över största
    officiella pack (46). Det begränsar också coins per omgång (§26).
  - Punkter måste ligga inom geofilens scope-ruta (§1.1). Områden måste
    finnas i geofilen.
- **Personbästa:** `hittaRattBest/{uid}.packs.{packId}` som förut plus
  `v: version` för egna pack. Ett personbästa med fel `v` behandlas som
  saknat, både av servern (`battre`) och av startsidan. Gamla poster lämnas kvar
  och är ofarliga.

**`hittaRattMeta/egnaPack`** (katalogen, en läsning):

```json
{ "packs": { "e-k3f9q0z1m2xa": {
    "title": "Gästrikland runt", "description": "…", "ikon": "🏞️",
    "type": "point", "geo": "sverige-landskap", "antal": 12,
    "classIds": ["5A", "5E"], "ownerUid": "…", "ownerNamn": "Anna L",
    "leaderboard": false, "version": 3, "updatedAt": <Timestamp> } },
  "updatedAt": <Timestamp> }
```

Det följer samma mönster som `hittaRattMeta/ledare` och `classProjections`: ett
dokument, en map och en läsning. En post är ≈ 300 B.

**`hittaRattBilder/{bildId}`** (§11.8): `{ ownerUid, packId, mime, bredd, hojd,
data: Bytes, skapad }`, med `bildId = <packId>--<8 tecken [a-z0-9]>`.

**Varför inte i klassdokumentet?** Eleven läser redan alla `classes`, så
katalogen skulle kosta noll läsningar där. Men då skulle klassdokumenten (som
lärarsidan läser hela tiden) växa, packen skulle behöva skrivas i flera
klassdokument per sparning, och regeln för `classes` skulle få ännu ett
valideringsuttryck. En egen katalog kostar **en** läsning per session och
håller isär det.

### 11.2 Firestore-regler

Tillägg i Hitta rätt!-blocket (`firestore.rules`, efter `hittaRattMeta`):

```
match /hittaRattPacks/{packId} {
  allow read: if signedIn();          // elever i classIds + lärare (förhandsgranska, duplicera)
  allow write: if false;              // bara hittaRattSparaPack/RaderaPack/SattTopplista (Admin SDK)
}
match /hittaRattBilder/{bildId} {     // F
  allow read: if signedIn();
  allow create: if isTeacher() &&
    bildId.matches('^e-[a-z0-9]{12}--[a-z0-9]{8}$') &&
    request.resource.data.keys().hasOnly(['ownerUid', 'packId', 'mime', 'bredd', 'hojd', 'data', 'skapad']) &&
    request.resource.data.ownerUid == request.auth.uid &&
    request.resource.data.packId == bildId.split('--')[0] &&
    request.resource.data.mime in ['image/webp', 'image/jpeg'] &&
    request.resource.data.data is bytes && request.resource.data.data.size() <= 150000 &&
    request.resource.data.bredd is int && request.resource.data.bredd <= 800 &&
    request.resource.data.hojd is int && request.resource.data.hojd <= 800 &&
    request.resource.data.skapad == request.time;
  allow update: if false;
  allow delete: if isTeacher() && resource.data.ownerUid == request.auth.uid;
}
```

- `hittaRattMeta/{docId}` täcker redan katalogen: läs för inloggade, skriv
  `false`.
- `hittaRattAttempts` behöver ingen ändring. `e-…` passar packId-regexen.
  Klasskontrollen görs vid submit, inte vid start, eftersom reglerna inte kan
  fråga `classes`.
- **Varför läsning för alla inloggade:**
  - Reglerna kan bara avgöra klass via `students/{uid}.classIds`. Det skulle
    kosta en `get()` per läsning och kunna glida isär från
    `classes.studentIds` (servern använder det senare).
  - Innehållet är ortnamn, koordinater och bilder, inget elevdata.
  - Hållningen är densamma som `subjects/areas` (#114). Synligheten är ett
    UI-filter, och **poängen** skyddas av servern.
- **Varför Functions och inte regler** för packen: items är en lista med
  mappar. Regler kan inte loopa, så de kan bara kontrollera längden och inte
  lat/lon, scope eller områdes-id. Servern kan också höja `version` och
  nollställa topplistan i samma transaktion, vilket regler inte kan.
- **Uttryckstaket (1000, #497):** den nya regeln har ≈ 15 uttryck och rör
  inte de tunga Live- och Klasscentret-grenarna.
- **Regeltester:**
  - `test/firestore-rules-hitta-ratt-egna.test.js` (B: pack och katalog,
    elev och lärare nekas skrivning).
  - `test/firestore-rules-hitta-ratt-bilder.test.js` (F: create-gränser, fel
    ägare, för stor, fel mime, update nekas, radera bara egen).
  - Båda läggs till i `test:rules` i `package.json`.

### 11.3 Elevsidan

**Startsidan** (`page-hitta-ratt.js`, `hr-start-vy.js`):
1. Läsningar: `index.json` (statisk), `hittaRattBest/{uid}` (1) och **katalogen
   (1)**. Elevens klasser kommer ur `getClasses()`, som redan ligger i
   sessionscachen. Inga läsningar per pack (#231).
2. `egnaForElev(katalog, klassIds)` (ren, i ny `src/hitta-ratt/hr-egna.js`)
   väljer pack där `classIds ∩ elevens klasser ≠ ∅`. De visas i en egen
   kategori **"Från din lärare"** (ikon 🧑‍🏫) **först** på sidan, med packens
   egen ikon. Svårighetstaggen ersätts av "Egen karta".
3. Personbästa visas bara om `b.v === katalog.version`.
4. Katalogen cachas i 60 s (som `hr-pokal-rum.js`) och nollas av `skickaOmgang`.

**Spelet:**
- `#/elev/hitta-ratt?pack=e-…` → `page-hitta-ratt.js` ser `e-`-prefixet,
  hämtar katalogposten och läser `hittaRattPacks/{id}` (1 läsning). Sedan
  anropas `spelaPack(meta, { pack })`.
- `hr-spel.js` får ett valfritt färdigt `pack` i deps och hoppar då över
  `hamtaJson("packs/…")`. Geofilen hämtas som förut ur repot.
- Bilditems med `bild.id` hämtas via `hr-bild.js` (F, §11.8).
- **Saknat pack eller inte delat** → samma `felVy` som okänt pack ("Kartan finns
  inte längre").

**Felkoder från servern som klienten översätter:**

| Fel | Text |
| --- | --- |
| `failed-precondition` "ändrad" | "Läraren har ändrat kartan – starta en ny omgång." |
| `permission-denied` | "Kartan är inte delad med din klass." |

### 11.4 Servern

Ny delad kod i `src/hitta-ratt/delat/`. Den synkas automatiskt till
`functions/hitta-ratt/` (sync-skriptet kopierar alla `.js` där).

| Fil | Innehåll |
| --- | --- |
| `delat/scope.js` | `SCOPE_RUTA` (§1.1), `GEO_SCOPE` (geo → scope), `STANDARD[scope]` = `{ scoringConfig, maxZoom }`, `inomScope(scope, lon, lat)` |
| `delat/facit.js` | `kompaktFacit(pack, omraden)` (flyttas från sync-skriptet, så officiella och egna pack rättas identiskt), `facitNyckel(pack)` (kanonisk sträng → sha1 på servern) |
| `delat/egna.js` | `EGEN_ID_RE`, `IKONER`, gränserna, `normaliseraPack(indata, { geoOmraden, klasser })` → städat pack eller `HrFel` |

`admin/sync-hitta-ratt-functions.mjs` exporterar även `GEO_OMRADEN` (geo → id:n)
i `packs.js`, så servern vet vilka områden som finns i varje geofil.

**Ny fil `functions/hitta-ratt-egna.js`** (`hitta-ratt-core.js` har 238 rader
och får inte växa förbi 400). Samma deps-injektion som i core:

1. **`sparaPack(deps, uid, { pack })`** → `{ id, version, nollstalld }`
   (callable `hittaRattSparaPack`, kräver `token.teacher`).
   1. Normalisera och validera med `delat/egna.js`. `classIds` kontrolleras mot
      `classes` (`getAll`).
   2. **Transaktion:**
      1. Läs packen, katalogen, topplistan och ledarna.
      2. Ny packen: `ownerUid = uid` och `version 1`. Befintlig: `ownerUid`
         måste vara anroparen, och `geo`/`type` får inte ändras.
      3. `facitNyckel` ändrad → `version + 1`, `facitAt = nu`, topplistan
         raderas och `ledare.packs.{id}` tas bort. Är topplistan på skapas en
         tom topplista med `v`.
      4. Titeln ändrad → `titel` uppdateras i topplistan och i ledarna, så att
         pokalskylten följer med.
      5. Packen och katalogposten skrivs.
   3. `leaderboard` i indata **ignoreras**. Den ändras bara av
      `hittaRattSattTopplista`.
   4. (F) Kontrollera att alla `bild.id` finns och hör till packen. Radera
      packens bilder som inte längre används (`where packId ==`).
   5. (F) `kopieraFran: packId` (Duplicera) kopierar källpackens bilder till
      nya id. Allt annat i duplicering sker i klienten (nytt id, "(kopia)", AV,
      egna `classIds`).
2. **`raderaPack(deps, uid, { packId })`** – ägaren.
   1. Transaktion: packen, katalogposten, topplistan och `ledare.packs.{id}`
      tas bort.
   2. Sedan en batch som tar bort `hittaRattBilder where packId ==`.
   3. Idempotent. Försök och personbästa lämnas kvar och är ofarliga (huset
      och startsidan visar bara pack som finns).
3. **`sattTopplista(deps, uid, { packId, pa })`** – §11.5.

**`hittaRattSubmit` (core)** för `packId` som börjar på `e-`:
1. `elevInfo` returnerar även elevens klass-id.
2. `tx.get(hittaRattPacks/{id})` i transaktionen.
   - Saknas packen → `not-found`.
   - `classIds ∩ elevens klasser = ∅` → `permission-denied`.
   - `attempt.startedAt < pack.facitAt` → `failed-precondition` "Läraren har
     ändrat kartan – starta en ny omgång". Det sker innan `raknaOmgang`, så
     eleven aldrig får det obegripliga "svara på alla frågor".
3. `kompaktFacit(pack, GEO_OMRADEN[pack.geo])` och samma `raknaOmgang`.
4. `lb = pack.leaderboard === true`. Personbästa skrivs **alltid** (även AV),
   med `v`. `bestNu` med fel `v` räknas som `null`.
5. Topplisteposten får klassen ur elevens klasser **∩ packens** `classIds`
   (sorterad på namn), så att "5E" visas och inte en klass där packen inte
   delas.
6. Är topplistans `v` ≠ packens `version` räknas entries som tomma
   (försvarsrad, ska inte hända).
7. Ledarposten får `scope` (`ledare.packs.{id} = { uids, titel, typ, scope }`),
   så att pokalens motiv blir rätt (§11.5).
8. Coins: 1 per godkänt svar, som i officiella pack (§26).

**Personbästa och topplista vid redigering – valt: versionsnollställning**
(alternativen var version i nyckeln, nollställning eller låsning):

| Alternativ | Bedömning |
| --- | --- |
| Version i nyckeln (`<id>~v3`) | Varje version får ny topplista, ny pokalnyckel `hrpokal-…` och nya placeringar i huset. Gamla nycklar blir skräp överallt. Mest kod och mest att städa. Avvisat. |
| Lås redigering när resultat finns | Läraren kan inte rätta en felplacerad punkt. Det är dåligt i ett verktyg vars hela poäng är att det ska vara enkelt. Avvisat. |
| **Nollställ vid ändrat facit** ✔ | Id, pokalnyckel och topplistedokument är stabila. Bara ändringar av svaren (punkter, områden, nya eller borttagna frågor) nollställer. Rättade stavfel, nya bilder, beskrivning och klasser nollställer inget. Personbästa nollställs **lat** via `v`, utan att skriva i alla elevers dokument. |

Lärarvyn varnar före sparning när facit ändrats på ett befintligt pack:
"Du har ändrat platser eller frågor. Elevernas rekord och skolans topplista för
kartan börjar om från noll."

**Levererat i B #633:**
- Delad kod `src/hitta-ratt/delat/{scope,facit,egna}.js` (synkas till
  `functions/hitta-ratt/`). `facitNyckel` ger den kanoniska strängen och
  servern hashar den (`facitHash`, sha1). `nyttPackId()` och `slugId()` finns
  för lärarvyn (C). Frågor utan `id` får ett slug-id ur namnet (`on`, `on-2`).
- `functions/hitta-ratt-egna.js`: `sparaPack`, `raderaPack`, `lasEgetPack`,
  `katalogPost`, `tomTopplista`. Callables `hittaRattSparaPack` och
  `hittaRattRaderaPack` i `functions/index.js` (`token.teacher`, `ownerNamn` =
  tokenens namn eller användarnamnet före `@`).
- `hittaRattSubmit` för `e-`-pack enligt §11.4. `elevInfo` returnerar även
  `klasser` ([{ id, name }] sorterade på namn).
- Regeln `hittaRattPacks` (läs inloggade, skriv `false`).
- Elevsidan: `hr-egna.js` (ren), `hr-egna-data.js` (läsningarna),
  "Från din lärare" i `hr-start-vy.js`, `?pack=e-…` i `page-hitta-ratt.js`,
  `deps.pack` i `hr-spel.js` (pack eller laddare), egna felvyer.
- Tester: `test/hitta-ratt-egna.test.js`, `test/functions-hitta-ratt-egna.test.mjs`,
  `test/firestore-rules-hitta-ratt-egna.test.js` (i `test:rules`/`test:functions`).
  Preview: `admin/qa-hitta-ratt-egna-seed.mjs` (körs av `qa-hitta-ratt-preview.sh`,
  `--andra` = ändrat facit live). `admin/qa-hitta-ratt-input.mjs --packfil <json>`
  spelar egna pack (facit ur en dump av packdokumentet).

**Avvikelser från §11 i B:**
- `GEO_OMRADEN` är `geo → { områdes-id: källnyckel }` (ur `<geo>.nycklar.json`),
  inte bara en id-lista. Då sätter servern `key` själv och litar inte på
  klientens. `normaliseraPack` tar även emot en id-lista (då används klientens `key`).
- Läsningarna ligger i en ny fil `hr-egna-data.js` (dynamisk). `hr-egna.js` är
  ren så att testerna kan importera den i Node.
- `?pack=e-…` läser **bara** packdokumentet (1 läsning), inte katalogposten.
  Synligheten kontrolleras mot `pack.classIds` och elevens klasser ur `getClasses()`.
- `bild` tas bort av `normaliseraPack` tills F bygger bildkontrollen.
- Startvyns "30 % luft" = spannet × 1,3 (15 % på var sida), inpassat i scope-rutan.
- Ett försök på ett borttaget pack ger `not-found` även vid omförsök av ett
  redan avslutat försök (sällsynt; resultatet och coins är redan sparade).

**Levererat i C #634:**
- Fliken "Hitta rätt!" är en rad i `TEACHER_TABS`. Allt i `src/hitta-ratt/larare/`
  laddas dynamiskt (bootgrafen är kvar på 107):
  - `page-larare-hitta-ratt.js`: underflikar `?vy=fardiga|mina|ny`, `&id=` (redigera),
    `&kopia=` (duplicera) och `?prov=<packId>&fran=<vy>` (provspel).
  - `lhr-fardiga.js`, `lhr-mina.js`, `lhr-redigera.js`, `lhr-data.js`, `lhr-provspel.js`
    och `hitta-ratt-larare.css`.
- Provspel: `hr-spel.js` tar `deps.prov` och `deps.hem`. Då visas inga coins, och
  resultatet säger "Provspel – sparas inte". Rättningen sker med `raknaOmgang` i klienten.
- Varningen om ändrat facit visas direkt i formuläret och frågas igen vid Spara.
  Lämna-vakten (`armeraLamnaVakt` med egen text) skyddar osparade ändringar.
- `admin/hitta-ratt-namn.mjs` skriver `<geo>.namn.json`. Namnen kommer från packen
  (154 st) och Natural Earth (104), med rättningen Swaziland → Eswatini.
- Tester: `test/hitta-ratt-larare.test.js` och `test/hitta-ratt-namn.test.js`.
  Skärmdumpar finns i `docs/hitta-ratt-634/`.
- `admin/qa-emulator-proxy.mjs` skickar nu vidare `hittaRattSparaPack`, `hittaRattRaderaPack`
  och `hittaRattSattTopplista` (D). `qa-hitta-ratt-input.mjs` förstår `prov=` i hashen.

**Avvikelser från §11 i C:**
- Två filer till:
  - `lhr-modell.js`: den rena logiken, som testas i Node.
  - `lhr-fragor.js`: frågelistan. Den hölls utanför `lhr-redigera.js` för att filen
    skulle hålla sig under 400 rader.
- **Duplicera sparar inte direkt.** Kopian öppnas osparad i formuläret, med
  "(kopia)", inga klasser och inga bilder. Där kan läraren byta karta och typ innan
  första sparningen ("Duplicera för att byta", §11.0).
  - Byter läraren typ töms frågorna.
  - Områdesfrågor följer med till en ny karta via källnyckeln, till exempel mellan
    Europa och världen.
  - Frågor som inte kan följa med tas bort efter en bekräftelse.
- Startvyn "auto" heter "Anpassad" i formuläret, och "hel" heter "Hela kartan".
- `lhr-data.js` har ännu ingen `sattTopplista`. Den läggs till i D.
  Kryssrutan har en plats i formuläret (`[data-plats="topplista"]`, dold).
- Lärarvyn läser katalogen färskt vid varje besök (1 läsning), inte ur 60-sekunderscachen.

**Levererat i D #635:**
- `sattTopplista` i `functions/hitta-ratt-egna.js` och callablen `hittaRattSattTopplista`
  (`token.teacher` + ägaren). Svar: `{ leaderboard, tillagda }`.
  - AV: en transaktion. `stangTopplistaTx(tx, deps, packId)` i `hitta-ratt-core.js`
    tar bort topplistan och ledarna. `stangTopplista` använder den och finns kvar.
  - PÅ: tx 1, frågan `hittaRattBest` (`FieldPath("packs", id, "v") == version`),
    `students` och packens `classes` via `getAll`, och sist tx 2 enligt §11.5.
    Har packen stängts eller fått ny version mellan stegen gör tx 2 ingenting.
- Kryssrutan "Skoltopplista / Gör till skolutmaning" i `lhr-redigera.js` med
  förklaringen för PÅ och AV (`TOPPLISTA_TEXT` i `lhr-modell.js`). `sattTopplista`
  finns i `lhr-data.js`.
- 🏆-vyn: `topplisteGrupper(index, egna)` i `hr-topplista-vy.js`. Gruppen "Från din
  lärare" ligger först och läses ur samma cachade katalog som startsidan.
- `motivFor(packId, scope)` och `minaPokaler` tar med `scope` för `e-`-pack.
- Tester: `test/functions-hitta-ratt-egna-topplista.test.mjs` (8 st), plus tillägg i
  `hitta-ratt-pokal`, `hitta-ratt-egna` och `hitta-ratt-larare`.
- Preview: `admin/qa-hitta-ratt-toggle-seed.mjs` (körs av `qa-hitta-ratt-preview.sh`,
  `--pa`/`--av` utan UI). Skärmdumparna ligger i `docs/hitta-ratt-635/`.

**Avvikelser från §11 i D:**
- **Kryssrutan gäller vid Spara**, inte direkt. Den hör till formuläret, så lämna-vakten
  ser den. Efter `hittaRattSparaPack` anropas `hittaRattSattTopplista`, men bara om
  rutan ändrats. Det fungerar även för ett nytt område. Går anropet fel är området
  ändå sparat, och felet visas.
- **Klassen vid återuppbyggnaden** tas ur `classes.studentIds` för packens `classIds`.
  Den sorteras på namn, som i `lasEgetPack`. Elever som inte längre går i någon av
  packens klasser hoppas över. `enabledModules` kontrolleras inte, eftersom
  personbästat redan krävde det.
- `test:functions` kör nu filerna **en i taget** (`--test-concurrency=1`). B:s test
  raderade hela katalogdokumentet och fyllde det till 800 kB medan andra filer körde
  mot samma emulator. Nu städar B:s test bara sina egna poster.
- **Testrecept:** callable-testerna kräver `FUNCTIONS_EMULATOR_HOST=127.0.0.1:<fn-port>`
  när emulatorn inte går på 5001. Annars blir svaret `internal`.
- Cykeln mellan `hitta-ratt-core.js` och `hitta-ratt-egna.js` (via `stangTopplistaTx`)
  är ofarlig, eftersom bara funktioner anropas efter laddningen.

### 11.5 Togglen "Skoltopplista / Gör till skolutmaning"

Callable **`hittaRattSattTopplista({ packId, pa })`**. Bara ägaren
(`token.teacher` + `ownerUid`).

- **AV (`pa: false`):**
  1. EN transaktion: `pack.leaderboard = false` och katalogens
     `leaderboard = false`.
  2. Samma transaktion gör vad befintliga `stangTopplista` gör: topplistan
     raderas och `ledare.packs.{id}` tas bort.
     - `stangTopplista` delas upp i en del som tar emot `tx`, så att den kan
       köras inne i den här transaktionen.
     - Den fristående funktionen behålls (den har tester från G #610).
  3. Pokalen försvinner vid nästa husrendering (`rensaPokaler`).
  4. Personbästa ligger kvar.
- **PÅ (`pa: true`): återuppbygg ur personbästa.** Valt, eftersom:
  - specen kräver att "topplistan ska använda elevens personbästa"
  - personbästa sparas redan när togglen är AV (§21)
  - en tom start skulle visa en elev med rekordet 1943 p på startsidan men inte
    i topplistan, och ge pokalen till fel elev tills alla spelat igen

  Flödet:
  1. **Tx 1:** `leaderboard = true` (pack och katalog), och en tom topplista
     `{ packId, typ, titel, max, v, entries: {}, leaders: [] }` skapas om den
     saknas.
  2. **Fråga:** `hittaRattBest.where(new FieldPath("packs", packId, "v"), "==",
     version)`.
     - Firestore indexerar map-underfält automatiskt, och `firestore.indexes.json`
       har inga undantag för `hittaRattBest`, så frågan behöver inget eget index.
     - Det kostar en läsning per elev som spelat packen (en klass ≈ 30). Det
       sker en gång per påslag och inte per visning, så #231 gäller inte.
  3. Namn och klass hämtas med samma logik som `elevInfo`: `students` via
     `getAll`, plus en fråga mot `classes`.
  4. **Tx 2:** läs topplistan, lägg till poster **bara för uid som saknas**,
     räkna om `leaders` och skriv topplistan och `ledare.packs.{id}`.
  5. **Inget kapplopp:** en omgång som sparas efter tx 1 ser `leaderboard: true`
     och skriver sin egen post. Den är alltid elevens nuvarande personbästa, så
     återuppbyggnaden får aldrig skriva över en befintlig post.
  6. Idempotent. Ett andra PÅ fyller bara på det som saknas.
- **🏆-vyn** (`page-hitta-ratt.js` → `visaTopplistor`):
  - Grupperna = officiella pack med topplista + en grupp **"Från din lärare"**
    ur katalogen (`leaderboard && classIds ∩ elevens klasser`).
  - Katalogen är samma cachade läsning som på startsidan, så det blir 0 extra
    läsningar. Varje vald topplista är 1 läsning, som förut.
  - Elever i andra klasser ser inte lärarens egna topplistor. En "skolutmaning"
    för hela skolan = läraren kryssar i alla klasser (§11.11 fråga 1).
- **Pokalen:** `motivFor(packId, scope)` i `hr-pokal-art.js` får en valfri scope
  för `e-`-pack, som läses ur `ledare.packs.{id}.scope`. Rosettfärgen räknas
  redan ur packId. Ingen ny pokallogik behövs, eftersom pokalen ritas ur
  ledarna.
- **Radering med topplista PÅ:** `raderaPack` stänger topplistan i samma
  transaktion (§11.4). Om pokalen står utställd städas den bort av
  `rensaPokaler` vid nästa husbesök, som vid ledarbyte.

### 11.6 Platssökning för punktfrågor

**Spik:** `admin/hitta-ratt-sok-spik.mjs` (Node) och
`preview/preview-hitta-ratt-egna-spik.html` (webbläsare), körda 2026-10-12.
Skärmdump: `docs/hitta-ratt-632/spik-sok-och-bild.png`.

**CORS från webbläsaren, utan nyckel:**

| Tjänst | CORS | Resultat |
| --- | --- | --- |
| Wikidata (`origin=*`) | `ACAO: *` | Fungerar |
| Nominatim | `ACAO: *` | Fungerar |
| Photon | `ACAO: *` | Fungerar, men **saknar svenska** (`lang` = de/en/fr) |

**Testade sökord (12 st):**

| Sökord | Wikidata | Nominatim |
| --- | --- | --- |
| Gävle | "tätort i Gävle kommun, Sverige" | `boundary/administrative` |
| Höga kusten | "kustområde i Ångermanland" | **Höga Kusten Airport** (fel) |
| Visby ringmur | ✓ | – (ingen träff) |
| Sarek | ✓ med limit 10, ✗ med limit 7 | `national_park` |

- Wikidata hittade **11 av 12** (Sarek först med `limit=10`, i webbläsaren).
  Nominatim hittade 11 av 12.
- Skillnaden mellan tjänsterna var 0–33 km, och mittpunkten för sjöar och berg
  skiljer sig naturligt.
- Wikidata tog ≈ 0,8 s per sökning (två anrop).
- Wikidata ger också **P18** (Commons-bild), som blir första bildförslaget i
  §11.8.

**Beslut:**
1. **Wikidata först.**
   1. `wbsearchentities` (`language=sv&uselang=sv&limit=10&type=item&origin=*`).
   2. Sedan `wbgetentities` (`props=claims`) för P625 och P18.
   3. Bara träffar med koordinat visas. Svenska beskrivningar skiljer "Lund –
      tätort i Skåne" från andra Lund.
   - CC0, ingen attribution krävs.
   - Sparas som `kalla: "wikidata:Q…"`, samma koordinatkälla som officiella
     pack (#607).
2. **Nominatim som reserv**, automatiskt när Wikidata ger 0 träffar, och via
   knappen "Sök i OpenStreetMap".
   - `format=jsonv2&accept-language=sv&limit=5`.
   - Användarvillkoren följs: högst **1 anrop/s** (strypning i klienten), ingen
     autocomplete (bara knapp eller Enter), svar cachas per sökord i sessionen,
     och webbläsaren skickar `Referer` (sajtens origin) som identifiering.
   - Sparas som `kalla: "osm:relation/…"`, och lärarvyn visar "Platsdata ©
     OpenStreetMap-bidragsgivare (ODbL)" vid träffarna.
3. **Felhantering:**
   - Nätfel, 429 eller 5xx → "Sökningen fungerar inte just nu. Försök igen om
     en stund – eller klicka direkt på kartan."
   - Kartan fungerar alltid utan sökning.
   - 0 träffar → "Inget hittades. Prova ett annat namn eller klicka på kartan."
4. **Flöde:**
   1. Sök → förslag i en lista. Förslag utanför packets scope är gråa med
      texten "utanför kartan".
   2. Val → markören sätts och kartan zoomar dit (`satGissning`).
   3. Läraren kan **dra markören** eller klicka om.
   4. "Använd denna plats" sparar `lat`/`lon`, avrundade till 5 decimaler
      (≈ 1 m).
   5. "Avancerat" visar lat/lon-fält.
   6. Servern kontrollerar `inomScope` igen.
5. **Kartmotorn** (`kartmotor.js`) får två API-anrop för redigering:
   - `satGissning({ lon, lat }, { zooma: true })` sätter nålen programmatiskt.
     Dragning av nålen finns redan i punktläget.
   - `markera(ids)` (§11.7).
   - `kartmotor.js` har 383 rader. Lägg anropen i en liten
     `karta/redigering.js` som får motorns interna delar via en
     `opts.redigering`-krok, eller flytta `visaOmraden`/`ruta` till
     `kamera.js`, så att filen håller sig under 400.
   - Spelflödet påverkas inte.

### 11.7 Polygonval för områdesfrågor

- Lärarvyn öppnar kartmotorn i `lage: "omrade"` på packets geofil. Varje
  `val`-händelse **växlar** en fråga: finns området redan tas frågan bort,
  annars läggs en ny till med föreslaget namn.
  - `k.markera(ids)` ritar alla valda områden med klassen `markerad` (blå
    fyllning + kontur, `--bla`).
  - Senast klickade området får sitt namn som etikett (`skarm.satEtikett`).
    Lärarvyn får visa namn – det är bara eleven som inte får det.
- **Namnen:** ny fil `src/hitta-ratt/content/geo/<geo>.namn.json`
  (källnyckel → svenskt namn). Lärarvyn kombinerar den med
  `<geo>.nycklar.json` till id → `{ key, namn }`.
  - Byggs av ett nytt litet skript **`admin/hitta-ratt-namn.mjs`** (C), som
    varken behöver mapshaper eller ändrar geofilerna. Namnen tas i den här
    ordningen:
    1. de officiella packens `name` per `key` (Europa 46, landskap 25, län 21,
       redan granskade)
    2. Natural Earth `NAME_SV` (admin-0, kontrollerat: "Elfenbenskusten",
       "Nordmakedonien", "Tjeckien") för världens övriga ≈ 136 länder
    3. källnyckeln, om inget annat finns
  - Ett test kontrollerar att varje id i geofilen har ett namn.
  - **Eleven laddar aldrig namnfilen.** Inga namn hamnar i DOM:en i spelet
    (§4.2).
- **Tillgängligt alternativ:** en sökbar namnlista ("Lägg till område …") bredvid
  kartan, för tangentbord och för små länder. Den byggs i C och är kvar även
  när E lagt till kartklicket.

### 11.8 Bilder

**Beslut: Firestore-dokument per bild, nedskalad i klienten. Inget Storage.**

| | Firebase Storage | **Firestore `hittaRattBilder/{id}`** ✔ |
| --- | --- | --- |
| Infrastruktur | Ny produkt: bucket, `storage.rules` i ett eget regelspråk, egen deploy, SDK (≈ 30 kB, dynamisk import) | Befintlig SDK och regelfil, en ny `match` |
| Behörighet | Klass och ägare kräver `firestore.get()` från Storage-regler (extra läsningar, krånglig test) | Samma regelmiljö och emulator som resten |
| Kostnad | Lagring + egress | ≈ 120 kB/bild. 1 läsning per bildfråga (0,06 USD/100 000). En skola med 50 bildpack × 20 bilder = 120 MB, långt inom kvoten |
| #231 | 1 hämtning per bild | 1 läsning per bild, alltså O(1) per fråga, aldrig per elev. Bara aktuell och nästa fråga hämtas |
| Gräns | GB | 1 MiB per dokument räcker gott för ≤ 150 kB |

**Nedskalningen** (bevisad i spiken):
1. `createImageBitmap` → `OffscreenCanvas`, längsta sidan ≤ 800 px.
2. `convertToBlob` WebP med kvalitet 0,82 → 0,72 → 0,62 → 0,5. Saknar
   webbläsaren WebP-kodning (`blob.type` ≠ webp, äldre Safari) blir det JPEG.
3. Fortfarande > 120 kB → 640 px, sedan 480 px.
4. Spikens Commons-bild (134 kB JPEG) blev **800 × 533 WebP, 55 kB** i Chrome.

Ren logik i `src/hitta-ratt/larare/lhr-skala.js` (testbar med en
canvas-stub).

**De tre valen per fråga (alla frivilliga):**
1. **"Sök bild online"** (Wikimedia Commons, från lärarens webbläsare)
   1. Första förslaget är Wikidatas P18 om platsen kom därifrån.
   2. Sökningen:
      - `generator=search&gsrnamespace=6&gsrsearch=<namn> filetype:bitmap`
      - `prop=imageinfo&iiprop=url|size|mime|extmetadata`
      - `iiurlwidth=330` för rutnätet (Commons standardsteg, ovanliga bredder
        stryps)
   3. **Licensvitlistan** = samma funktion som `admin/hitta-ratt-bilder.mjs`:
      PD, CC0, CC BY och CC BY-SA. Den lyfts till
      `src/hitta-ratt/larare/commons.js`, och adminskriptet importerar den.
      Spiken: 20 av 21 filer godkändes för "Gävle rådhus".
   4. Vid val hämtas 960-miniatyren (`thumb.wikimedia.org`, `ACAO: *`, ingen
      "tainted canvas" – bevisat), skalas ned och sparas som eget
      bilddokument.
   5. `fotograf` (Artist rensat från HTML), `licens`, `licensUrl`, `fil` och
      `kallaUrl` sparas automatiskt i itemets `bild`.
2. **"Ladda upp egen"**
   - Filväljare med `accept="image/*"`, samma nedskalning.
   - Kräver kryssrutan **"Jag har rätt att använda bilden"** (upphovsrätt).
   - `bild.kalla = "egen"`, ingen attribution.
3. **"Ingen bild"**, som är standard.

**Commons: kopiera, inte hotlänka.** Regeln "inga externa bildtjänster vid
speltid" (§0) gäller även egna pack:
- Elevens webbläsare gör inga anrop till tredje part. Det är bättre för
  integriteten (elevens IP), fungerar i skolor med filter och påverkas inte av
  Commons strypning (429, sett i D #607).
- Bilden visas i samma storlek och väg som uppladdade bilder.

**Attribution:**
- Under bilden i spelet: "Foto: {fotograf}, {licens}, Wikimedia Commons" (med
  länk till `kallaUrl`), samma rad som de officiella sevärdhetsbilderna.
- Egna bilder: ingen rad.
- Lärarvyn visar raden vid varje bild.

**Spelet** (`src/hitta-ratt/hr-bild.js`, dynamisk):
- `bildUrl(bild)` → `bild.fil` (repo, officiell) eller `bild.id` →
  `getDoc(hittaRattBilder/{id})` → `Blob` → `URL.createObjectURL`.
- Cachen är en `Map` per omgång och frigörs (`revokeObjectURL`) när omgången
  lämnas. Nästa frågas bild förhämtas som idag.
- Saknad bild → frågan visas utan bild. Ingen krasch.

**Index:** `firestore.indexes.json` får `fieldOverrides` för
`hittaRattBilder.data` med `indexes: []`. Fältet behöver aldrig sökas, och
utan indexering blir skrivningen billigare.

**Föräldralösa bilder:**
- `sparaPack` raderar packens bilder som inte längre används.
- `raderaPack` raderar alla bilder för packen.
- Kvar blir bara bilder i pack som aldrig sparades (läraren avbröt). De är få
  och små. Ett adminskript kan städa senare (inte i den här epicen).

### 11.9 Lärarvyn

- **Var:** en ny rad i `TEACHER_TABS` (`src/teacher-shared.js`).

  ```js
  { key: "hittaratt", hash: "#/larare/hitta-ratt", label: "Hitta rätt!", title: "Hitta rätt!",
    icon: "pin", page: lazyPage(() => import("./hitta-ratt/larare/page-larare-hitta-ratt.js"), "pageLarareHittaRatt") },
  ```

  - Ikonen `pin` finns redan i `ICONS`.
  - Innehållsstudion valdes bort:
    - Den handlar om ämnen och arbetsområden (`subjects/areas`), med wizard,
      AI-flöde och tabell per ämne. Hitta rätt! har en egen datamodell, en egen
      karta och egen förhandsgranskning.
    - Att tvinga in den i studion skulle göra båda svårare.
    - Mattematchen och Live har egna flikar på samma sätt.
- **Bootgrafen:**
  - `teacher-shared.js` ligger i den statiska grafen men får bara en registerrad
    med `import()`. Inga nya statiska importer.
  - Allt annat ligger i `src/hitta-ratt/larare/` och laddas dynamiskt.
    `hitta-ratt-larare.css` laddas lat, som `hitta-ratt.css`.
  - `admin/qa-bootgraf-bfs.mjs` ska fortfarande ge **107**.
- **Design:** `teacher-page teacher-dark` (mörk lärardesign, så heter klassen i
  koden), med de befintliga lärarkomponenterna (`teacherNav`, `teacherHead`,
  `emptyState`, `icon`). Kartan själv behåller sina ljusa färger.
- **Struktur** (tre flikar i sidan, `?vy=fardiga|mina|ny`):
  1. **Färdiga områden:**
     - de 12 officiella packen ur `index.json`, grupperade som på elevens
       startsida
     - "Visa innehåll" listar frågorna ur `packs/<id>.json`
     - **"Provspela"** kör `spelaPack` med lokala deps: `startaForsok` → `"prov"`,
       `skickaOmgang` → `raknaOmgang` i klienten. Inget sparas, inga coins.
       Resultatskärmen visar "Provspel – sparas inte".
     - **"Duplicera till Mina områden"** blir ett eget pack.
  2. **Mina områden:**
     - katalogen filtrerad på `ownerUid` (0 extra läsningar)
     - tabell: namn, typ, antal frågor, klasser, topplista PÅ/AV
     - åtgärder: Redigera, Provspela, Duplicera, Radera (bekräftelse, och
       varning om topplistan är på)
     - **Kollegors områden** (samma katalog, andra `ownerUid`) visas
       hopfällda och kan provspelas och dupliceras, men inte redigeras
  3. **Skapa nytt / Redigera** (samma formulär):
     1. namn, kort beskrivning och ikon
     2. karta: Sverige (landskap), Sverige (län), Europa eller världen.
        **Kartan väljs bara när packet skapas.**
     3. frågetyp punkt eller område (bara när packet skapas)
     4. klasser (kryssrutor ur `getClasses()`)
     5. startvy auto/hel
     6. frågelistan med kartan bredvid (§11.6/§11.7) och bild per fråga
        (§11.8)
     7. kryssrutan **"☐ Skoltopplista / Gör till skolutmaning"** (AV som
        standard), som anropar `hittaRattSattTopplista` direkt. Den finns
        först när packet sparats en gång.
     8. **Spara** = `hittaRattSparaPack`.
     - Osparade ändringar → varning vid lämna (samma mönster som wizarden).
- **Klient-API:** `src/hitta-ratt/larare/lhr-data.js`
  (`sparaPack/raderaPack/sattTopplista/hamtaKatalog/hamtaPack`) med
  `httpsCallable` som i `hr-data.js`. Felmeddelandena på svenska kommer från
  servern.

### 11.10 Uppdelning (sub-issues, körs seriellt – 8 GB RAM, högst en worker med webbläsare eller emulator)

Leadens förslag behålls, med två justeringar:
- **B** tar all serverkod för spara och radera, så att C bara är UI.
- **C** får en enkel frågeinmatning (lat/lon under "Avancerat" och en namnlista
  för områden), så att CRUD kan testas innan E finns.

| # | Innehåll | Filer | Tester | Beror på |
| --- | --- | --- | --- | --- |
| **B** data, regler, server, elevsida | `delat/{scope,facit,egna}.js`. Sync-skriptet använder `kompaktFacit` och exporterar `GEO_OMRADEN`. `functions/hitta-ratt-egna.js` (`sparaPack`, `raderaPack`) + exporterna `hittaRattSparaPack` och `hittaRattRaderaPack`. `hittaRattSubmit` för `e-`-pack (klass, `facitAt`, `v`, `leaderboard`, klass ∩ `classIds`, `scope` i ledarna). Regeln för `hittaRattPacks`. Elevsidan: `hr-egna.js` (katalog, filter, startvy auto), "Från din lärare" på startsidan, `?pack=e-…` → `hittaRattPacks`, `hr-spel.js` tar `pack` i deps, nya felmeddelanden. Seed `admin/qa-hitta-ratt-egna-seed.mjs` (ett punkt- och ett områdespack via kärnan). | `src/hitta-ratt/delat/*`, `functions/*`, `admin/sync-hitta-ratt-functions.mjs`, `firestore.rules`, `src/hitta-ratt/{hr-egna,page-hitta-ratt,hr-start-vy,hr-spel}.js`, `package.json` | `test/hitta-ratt-egna.test.js` (normalisering, gränser, scope, facitnyckel, startvy). `test/functions-hitta-ratt-egna.test.mjs` (spara ny/befintlig, fel ägare, låst geo/typ, version + nollställning, katalog, radera, submit: klass nekad, ändrad karta, `v`, AV skriver personbästa men ingen topplista). `test/firestore-rules-hitta-ratt-egna.test.js`. Befintliga Hitta rätt!-sviter gröna, bootgraf 107. | – |
| **C** lärarvy CRUD | `TEACHER_TABS`-raden. `src/hitta-ratt/larare/{page-larare-hitta-ratt,lhr-fardiga,lhr-mina,lhr-redigera,lhr-data,lhr-provspel}.js` + `hitta-ratt-larare.css`. Frågeinmatning: lat/lon under "Avancerat" (punkt) och sökbar namnlista (område). `admin/hitta-ratt-namn.mjs` → `geo/<geo>.namn.json`. Duplicera (utan bilder), radera, klass-synlighet, provspel och varning om ändrat facit. | `src/teacher-shared.js` (1 rad), `src/hitta-ratt/larare/*`, `src/hitta-ratt/content/geo/*.namn.json`, `admin/hitta-ratt-namn.mjs` | `test/hitta-ratt-larare.test.js` (ren vy-logik: formulär → indata, facit-varning, duplicera). `test/hitta-ratt-namn.test.js` (varje område har ett namn). Bootgraf 107. Preview med emulatorn (`qa-hitta-ratt-preview.sh` + lärarkonto). | B |
| **D** toggle skoltopplista | `sattTopplista` (AV: `stangTopplista` i tx; PÅ: tx 1 + fråga + tx 2) + export `hittaRattSattTopplista`. Kryssrutan i C:s formulär. 🏆-vyn får gruppen "Från din lärare". `motivFor(packId, scope)`. | `functions/hitta-ratt-egna.js`, `functions/hitta-ratt-core.js` (tx-variant av `stangTopplista`), `functions/index.js`, `src/hitta-ratt/{page-hitta-ratt,hr-topplista-vy,hr-pokal-art}.js`, `src/hitta-ratt/larare/lhr-redigera.js` | `test/functions-hitta-ratt-egna-topplista.test.mjs` (PÅ återuppbygger ur personbästa med rätt `v`, kapplopp med submit, PÅ två gånger, AV tar bort topplista och ledare, radera med topplista PÅ, fel ägare). Pokal-testet för scope-motivet. | B, C |
| **E** platssökning + polygonval | `lhr-platssok.js` (Wikidata → Nominatim, strypning 1 s, cache, fel, scope-markering, källa och OSM-attribution). Kartmotorns `satGissning` och `markera` (`karta/redigering.js`, `kartmotor.js` < 400 rader). `lhr-kartval.js` (punkt: sök → markör → dra → "Använd denna plats"; område: klick växlar fråga, namn ur `namn.json`). | `src/hitta-ratt/larare/*`, `src/hitta-ratt/karta/*` | `test/hitta-ratt-platssok.test.js` (fetch-stub: Wikidata-svar, P625-filter, reserv vid 0 träffar, 429-text, strypning). `test/hitta-ratt-karta.test.js` utökas (`satGissning` tur och retur, `markera`). Webbläsare: sök "Gävle" → markör, Europa: klicka 3 länder → 3 frågor, klicka igen → bort. | C |
| **F** bilder | Regeln och indexundantaget för `hittaRattBilder`. `larare/{commons,lhr-skala,lhr-bilder}.js` (P18-förslag, Commons-sök med vitlistan, kopiering, uppladdning med upphovsrättsruta). `admin/hitta-ratt-bilder.mjs` importerar `commons.js`. `hr-bild.js` (spelet: `Bytes` → `objectURL`, förhämtning, revoke). `hr-spel.js` använder `bildUrl(bild)`. Servern: kontroll av `bild.id`, städning i `sparaPack`, radering i `raderaPack`, `kopieraFran` vid duplicering. | `firestore.rules`, `firestore.indexes.json`, `src/hitta-ratt/larare/*`, `src/hitta-ratt/{hr-bild,hr-spel}.js`, `functions/hitta-ratt-egna.js`, `admin/hitta-ratt-bilder.mjs` | `test/firestore-rules-hitta-ratt-bilder.test.js`. `test/hitta-ratt-bilder-egna.test.js` (vitlista, Artist-rensning, skalstegen med stub). Function-testet utökas (okänd eller fel bild-id nekas, städning, kopiering). Webbläsare: välj Commons-bild → ≤ 120 kB → syns i spelet med attribution, utan nätanrop till wikimedia från elevsidan. | C (körs efter E) |
| **G** slut-QA | Spec §35 **test 8** steg för steg (punktområde via sökning, visuell bekräftelse, fråga med och utan bild, AV → spela → ingen topplista, PÅ → spela → 🏆-vyn + Top 15 + egen rad + pokal, AV → borta + pokal borta). Plus ändrat facit → nollställt, radera med topplista, områdespack via klick. Regression test 1–7 och 9–12, bootgraf 107, deploylista. | `docs/QA-RAPPORT-hitta-ratt-2.md`, eventuella små rättningar | alla sviter (`test`, `test:rules`, `test:functions` i färsk emulator), CDP-kartklick (`admin/qa-hitta-ratt-input.mjs`) | B–F |

**Ordning:** B → C → D → E → F → G. Inget går parallellt (RAM). D före E så att
test 8:s toppliste- och pokaldel kan provas tidigt med C:s "Avancerat"-inmatning.

### 11.11 Deploy och öppna frågor

**Deploy före live**, i ordning (ingen deploy i epicen utan Elias OK):
1. `firebase deploy --only firestore:rules` (`hittaRattPacks`, `hittaRattBilder`).
2. `firebase deploy --only firestore:indexes` (undantaget för
   `hittaRattBilder.data`).
3. `firebase deploy --only functions`:
   - `hittaRattSubmit` (ändrad)
   - `hittaRattSparaPack`, `hittaRattRaderaPack`, `hittaRattSattTopplista`
     (nya)
   - Predeployen synkar `delat/`.
4. Pages.

- **Inget Storage**, och ingen `storage.rules`.
- Epic 1/2:s deploy (rules + functions, PR #631) måste ha gått först eller
  samtidigt.

**Öppna frågor till Elias:**
1. **Vem ser en egen topplista?** Förslaget: bara elever i packets klasser
   (`classIds`). En "skolutmaning" för hela skolan = läraren kryssar i alla
   klasser. Alternativet är att alla elever ser alla egna topplistor i 🏆-vyn,
   även för kartor de inte kan spela.
2. **Ändrade platser nollställer rekord och topplista** (texter och bilder gör
   det inte). Okej?
3. **Påslagen topplista byggs upp ur befintliga personbästa** och startar alltså
   inte tom. Okej?
4. **Kollegors kartor:** alla lärare ser och kan provspela och duplicera
   varandras kartor, men bara ägaren redigerar. Okej, eller ska de vara
   privata?
5. **Externa tjänster i lärarvyn:**
   - Lärarens sökord går till Wikidata (Wikimedia, USA) och vid behov till
     Nominatim (OSMF, Storbritannien).
   - Bildsökningen går till Commons.
   - Inga elevdata skickas, och eleverna gör inga sådana anrop.
   - Okej ur GDPR-synpunkt för skolan?
6. **Uppladdade bilder** kräver kryssrutan "Jag har rätt att använda bilden".
   Räcker det?
7. **Gräns 60 frågor per eget område** (1 coin per godkänt svar, som officiella
   pack). Okej?

### 11.12 Spikarna – hur de körs

| Spik | Kör | Visar |
| --- | --- | --- |
| Platssökning (Node) | `node admin/hitta-ratt-sok-spik.mjs` (eller egna sökord som argument) | Tabell Wikidata mot Nominatim: träff, beskrivning, antal, avstånd. Följer Nominatims 1 anrop/s. |
| Webbläsare | `PORT=8632 node server.mjs` → `/preview/preview-hitta-ratt-egna-spik.html` | Sök (Wikidata → Nominatim) → markör på kartmotorn + scope-kontroll (Eiffeltornet på Sverigekartan → "utanför"). Commons-sök med vitlistan → hämtning med CORS → WebP-nedskalning med storlek. "Ladda upp egen" med samma pipeline. |

Uppmätt i Chrome 2026-10-12:

| Mätning | Resultat |
| --- | --- |
| "Gävle" | 6 träffar |
| "Eiffeltornet" | 2 träffar, utanför Sverige |
| "Sarek" | 2 träffar |
| Wikidata, tid per sökning | 0,7–0,9 s (första 2,9 s, kall anslutning) |
| Commons "Gävle rådhus" | 21 filer, 20 med godkänd licens |
| Vald bild | 800 × 533 `image/webp`, 55 kB, från 134 kB |
