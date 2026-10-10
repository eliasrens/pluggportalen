# Klasscentret – analys av befintlig kod (#477, epic #476)

Underlag för epic 1–4 enligt `docs/spec-klasscentret.md` "Analysera FÖRST".
Radnummer gäller epic-grenens bas (08659b2). Datamodellen: `docs/DATAMODELL.md`
"Klasscentret". EXP-kärnan: `src/klasscenter/` (se slutet).

## 1. Byns layout (epic 1 · karta)

- **Ingen CSS-grid.** Byn är absolut positionerade tomter i procent av by-lagret.
  - `src/varld-by.js:39` `byParams(antalHus)` → `husPerRad` (3–8, ≈ √(1,9·n)), `radHojd`, `vagHojd`, `toppY`.
  - `src/varld-by.js:79` `byLayout(...)` → `tomter[i] = {x, y, skala, rad, kol}` (mittpunkt i %), `cellW` (tomtbredd i %), `radHojd`, `vagY(rad, x)` och slingerkurvan `sling(x, rad)` (`:88`). Väg = serpentin (`byVagarSvg`, `:136`); dekor kollisionstestas mot tomterna (`byDekor`, `:212`).
  - Tomterna fylls rad för rad, vänster→höger, ofull sista rad centreras (`:99-105`). Vägen U-svänger ner till nästa rad.
- `src/varld-by-scen.js:42` `mountByScen({lager, meId, students})`: tomt `i` ↔ `students[i]` (`:77-106`); varje `.by-tomt` får `left/top/width = cellW/height = radHojd` inline. Returnerar `fokusById` (kamerafokus per elev).
- **Elevordningen**: `src/pages-varld.js:331-347` – `data.getOwnVillageOverview` (klassprojektionen, `src/class-projection.js:255`, 1 läsning/klass) → sorteras: egen tomt först, sedan namn (sv-kollation). Grannby: `pages-varld.js:465`.
- **En tomt som tar 2–3 platser** (förslag, epic 1 C/D):
  - Lägg en *platsbredd* per tomt i `byLayout` (t.ex. `byLayout({ antalHus, husPerRad, ..., breda: { 0: 2 } })`) och räkna tomterna i *platser* i stället för hus: `byParams(antalElever + extraPlatser)`.
  - Centret = plats 0–1 (eller 0–2) i rad 0 → `x` = mitten av platserna, `width = cellW × span`. Eleverna börjar på nästa lediga plats; radbrytning/slinga oförändrad → ingen elev försvinner, de skjuts bara fram.
  - `byDekor` kollisionstestar mot `tomter` med `cellW` – den måste läsa tomtens egen bredd (annars hamnar träd i centret).
  - `fokusById` behöver en nyckel för centret (t.ex. `"__klasscenter"`) så kameran kan zooma dit; klick-hanteringen i `pages-varld.js:371` går på `.by-tomt[data-id]`.
  - Pixi-profilen (`varld-profil-by.js` på epic #396-grenen) har `malSelektor: ".by-tomt[data-fokus-x]:not(.last)"` – centret bör vara en `.by-tomt` med `data-fokus-x/y` (eller egen klass som läggs till i profilen) så det förvärms och inte "poppar".

## 2. "Mitt rum" – möbler, X/Y, drag-and-drop (epic 2 · inredning)

- Data: `studentData.room.placements` (rum 0) och `studentData.extraRooms.<i>.placements`; `placements = { "<itemId>" | "<itemId>#<n>": { x, y } }` i **procent** av scenen (`src/data-room.js:140` `normalizeRoom`, `:170` `getRooms`).
- **Inget z sparas.** Ritordningen = nyckelordning, platta golvsaker (mattor) först (`src/varld-rum.js:389-391`). Specens z-index måste alltså införas som nytt fält (eller härledas från y).
- Sparning: `src/varld-rum.js:187-211` `scheduleSaveRoom` (debounce 250 ms) → `data.saveRoomAt(idx, { placements })` (`src/data-room.js:187`, dot-path-`updateDoc` på studentData). Drag: `pointerdown` `:687`, flytt `:751` (`placements[drag.id] = {x, y}`, klamrat till golv-/väggzon), `endDrag` `:757`.
- Lådan: ägda exemplar − placerade (`src/varld-rum.js:449-464`, `data.ownedCount`).
- **Peka sparningen mot ett klassobjekt** (epic 2): `mountRumScen` (`src/varld-rum.js:63`) är hårt kopplad till `sd` (studentData), `data.saveRoomAt` och elevens husdjur/kläder. Rimligast: bryt ut drag/klamring/ritning bakom ett litet adapter-interface `{ placements, lada(id) → antal, spara(placements) }` och låt Klasscentret skicka en adapter mot `classCenters/{classId}/layout/current`; djur/kläder/fönster/rumsväxlare utelämnas. `varld-rum.js` är 869 rader – utbrytningen bör göras i nya filer.
- Gästläge/bockade elever: adaptern exponerar `kanInreda` → ingen pointer-hantering och ingen låda.

## 3. Ekonomin – mynt och köp (epic 2/3 · crowdfunding)

- Mynt = `studentData.coins`. `src/data.js:183` `addCoins` och `:233` `buyItem` = klient-transaktioner (läs saldo → dra/öka → skriv) på elevens eget dokument.
- **Viktigt:** `studentData` skrivs med `isSelf` utan fältvalidering (`firestore.rules:84`) → mynt är i praktiken klient-betrodda redan i dag. Regler för crowdfunding kan garantera *insamlat == summan av donationsposter* och att donationen kommer från en klassmedlem, men inte att eleven "hade" mynten.
- Butiken: `src/shop-items.js:15` `CATEGORIES`, `:365` `MULTI_CATEGORIES`; **`shop-items.js` är 400/400 rader och `pages-shop.js` 396** → kategorin "Klasscentrum" kräver nya filer (dynamiskt laddade) eller en lead-planerad split (#271-bootgraf: båda ligger i bootgrafen).
- Befintlig scaffold: `classProjects/{classId}` (#331) – `src/data-classes.js:375` `donateToClassProject` (EN transaktion: elevens coins − n, `collected` + n) och `src/class-projection-entries.js:328` `applyProjectDonation` (nekar överdonation). **Återanvänd inte rakt av:** `contributions.{studentId}` ligger i ett dokument som alla inloggade läser (`firestore.rules:202-205`) → bryter beslutet om anonyma donationer. Mönstret (transaktion + ren övergångsfunktion + cappning) är däremot rätt.

## 4. Art-pipelinen (epic 1 B)

- Kodritad SVG i `src/art-hus-*.js` (t.ex. `art-hus-lyx.js:268` `LYX_HUS_SKAL`), koordinatsystem x 300–660, marklinje y ≈ 512, färger via `--hus-house/--hus-roof/--hus-wall/--hus-wall2`. Register spreadas in i `HUS_SKAL` (`src/art-hus-ute.js:167-171`); minihuset i byn = `husMini` (`art-hus-ute.js:387`).
- Förhandsvisning: `preview-*.html` i roten (t.ex. `preview/preview-hus-lyx.html` importerar `./src/art-hus-ute.js` direkt i en `<script type="module">`).
- Klasscentrets 10 nivåer → `art-klasscenter-*.js` med eget register keyat på `NIVAER[i].id` (`src/klasscenter/kc-niva.js`) – aldrig i `HUS_SKAL` (de är inte köpbara elevhus).

## 5. Pixi-vägen (#396, `?pixi=pa`)

- Finns bara på epic-grenen `epic/v-rldsvyerna-pixijs-renderare-perfekta-v-3679d6` (PR #435, ej mergad), **inte på den här basen**. Av som standard; utan flagga laddas ingen Pixi-modul.
- Där fångas byns DOM till textur generiskt: `varld-spegel.js` serialiserar lagret (`#by-lager`, `data-spegel-profil="by"`) till EN SVG → rastreras (`varld-textur.js`) → Pixi ritar bara rörelsen, DOM i vila.
- Profilen `varld-profil-by.js`: `sprites: [".hus-rok"]`, `objekt: ".by-tomt"`, `malSelektor: ".by-tomt[data-fokus-x]:not(.last)"`, `fangst: "stage"`.
- **En större tomt kräver:** att centret ritas som vanlig DOM/SVG i by-lagret (inget `<canvas>`, ingen extern bild-URL – annars taint/ingen spegling), ev. animerade delar (rök, eld) listas som `sprites` i profilen, och klickbart mål med `data-fokus-x/y` så hover-förvärmningen fungerar. Mätaren ovanför bör ligga i ett överlägg/`ignorera`-selektor om den uppdateras live (annars bakas ett gammalt värde in i texturen).

## 6. Klasskampen-normaliseringen + "+1 i samma batch"

- `src/tavling/mm-core.js:115` `classStandings`: klassens poäng = summan av shards ÷ `classes/{id}.studentIds.length` → samma princip används för nivåtrösklarna (`kc-niva.js`, trösklar × elevantal).
- `src/tavling/answer-writes.js` + `firestore.rules:243-316`: ett svar = svarsdokument (create-only, facit räknat i reglerna) + räknare som bara får öka +1 i SAMMA batch (`getAfter`/`existsAfter`, `lastAttemptId`), shardad klassräknare `{classId}_{shard}`.
- **Skillnad för Klass-EXP:** de flesta lägen (quiz, memory, para …) räknar resultatet i klienten – det finns inget verifierbart svarsdokument. Därför: begränsad ökning (+1..+3) + egen elevpost i samma batch (spårbarhet) + takt-spärr 15 s mot `request.time` + klassmedlemskap. Mattematchen kan i nästa steg koppla EXP till ett verifierat svarsdokument (var 20:e rätt) om man vill skärpa.

## Vad epic 1 A levererar (API för övriga sub-issues)

| Fil | API |
| --- | --- |
| `src/klasscenter/kc-niva.js` (ren) | `NIVAER`, `TROSKLAR_PER_ELEV`, `troskelFor(niva, antalElever)`, `nivaFor(exp, antalElever)`, `progressTillNasta(exp, antalElever)` → `{niva, namn, nuvarande, mal, kvar, nasta, nastaNamn, andel, max}`, `matarText(p)` |
| `src/klasscenter/kc-exp-regler.js` (ren) | `registreraRegel(modul, regel)`, `klassExpFor(modul, resultat, ctx)`, `planKlassExp(...)`, `modulFor(mode)`, `klassBonusFor(kalla, antalElever)`, `listaRegler()` |
| `src/klasscenter/kc-exp-skriv.js` (ren) | `planKlassExpWrites`, `planRaknareWrite`, `planKlassBonusWrite`, `sumKlassExp`, konstanter |
| `src/klasscenter/kc-exp-data.js` (Firestore, **bara dynamiskt**) | `awardClassExp({modul, resultat, area?})`, `awardClassBonus(classId, kalla, mangd?)`, `getClassExp(classId)`, `subscribeClassExp(classId, cb, onErr?)` |

Anropspunkt för spellägena (eget sub-issue): efter `awardExercise` i `src/game-shared.js:217` / `showResult` (`:306`), fire-and-forget:
`import("./klasscenter/kc-exp-data.js").then((m) => m.awardClassExp({ modul: mode, resultat, area })).catch(() => {})`.
Läsresan, Mattematchen (`src/tavling/mm-data.js`) och Räkna (`src/games-rakna.js`) anropar på samma sätt med sina resultatformer.
