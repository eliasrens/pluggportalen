# Prov (epic #737) – utkast efter grunden (#738)

Spec: [`UTVECKLINGSUPPDRAG_PROV.md`](UTVECKLINGSUPPDRAG_PROV.md) (bara Etapp 1,
avsnitt 0–9). Grunden (A, #738) har byggt logiken, datamodellen och reglerna –
inget UI. Det här dokumentet är kontraktet för B–E och fylls på av dem.

Allt ligger i `src/prov/` och laddas **bara med `import()`** (#271).
`test/prov-grund.test.js` fäller om någon fil därifrån hamnar i den statiska
bootgrafen (107 filer). CSS-prefix: `.provv-` (elev), `.provl-` (lärare).
Använd inte Hitta rätt!:s namn `provspel`, `?prov=`, `.lhr-prov`, `.hr-spel-prov`.

## Begrepp

| Ord | Betyder | Var |
| --- | --- | --- |
| Prov | Frågorna, facit och inställningarna. Ägs av läraren som skapade det. | `prov/{provId}` |
| Provtillfälle | Ett prov i **en** klass. Frågorna utan facit. | `provTillfallen/{t}` |
| Facit | Facit + bedömningsstöd för tillfället, bara lärare. | `provTillfallen/{t}/privat/facit` |
| Svar | Det en elev skrivit. | `provTillfallen/{t}/svar/{elevUid}` |
| Rättning | Lärarens bedömning. Eleven ser den efter tillbakalämning. | `provTillfallen/{t}/rattning/{elevUid}` |

Fälten: [`DATAMODELL.md` "Prov"](DATAMODELL.md). Behörigheterna:
[`BEHORIGHETER.md`](BEHORIGHETER.md) (testnyckel PV, `test/firestore-rules-prov.test.js`).

## Statusflödet

```
forberett ──Öppna──▶ oppet ──Stäng──▶ stangt
                       ▲                 │
                       └───Öppna igen────┘
```

- Tillfället **skapas** alltid som `forberett` (reglerna nekar annat).
  "Öppna nu" = skapa + uppdatera till `oppet` i samma flöde.
- **Öppna** (§5.2): `delaUppProv(prov)` → `fragor` till tillfället,
  `{ facit, bedomningsstod }` till `privat/facit`, `status: "oppet"`,
  `oppnad: serverTimestamp()`.
- **Stäng** (§5.4): `status: "stangt"`, och för varje svar som inte är inlämnat
  `{ inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() }`
  (det enda läraren får skriva i ett svar).
- **Öppna igen**: läraren får ta tillbaka just stängningens markering
  (`inlamnad: false` + `deleteField()` på `inlamnadNar`/`inlamnadAt`). En elevs
  egen inlämning (`elev`/`tid`) är slutgiltig.
- **Radera** (§3): **klientbatch** – alla `svar`, alla `rattning`,
  `privat/facit` och tillfället i en `writeBatch` (högst 500 skrivningar räcker
  för en klass). Ingen callable, så ingen functions-deploy. Svar och rättning
  bär `classId`, så de kan raderas även om tillfället redan är borta.
- `statusOvergangOk(fore, efter)` i `prov-modell.js` speglar reglernas `provStatusOk`.

## Frågetypsregistret

`src/prov/prov-fragetyper.js` – `FRAGETYPER`, `TYP_IDS`, `fragetyp(id)`,
`arFraga(f)`. En fil per typ i `src/prov/typer/`; det delade (gränser,
gemensamma fält, stabil blandning) i `typer/delat.js`.

| Medlem | Gör |
| --- | --- |
| `id`, `namn`, `ikon`, `beskrivning` | väljaren "Lägg till fråga" (`typValjare()` i `prov-validera.js`) |
| `autoratt` | kan få ett automatiskt förslag (alla utom `fritext`, `text`) |
| `arFraga` | `false` bara för `text` (inget nummer, ingen poäng, aldrig obesvarad) |
| `validera(fraga)` | `{ ok, fel, varningar, value }` – fel utan plats; `validateProv` sätter "Fråga 4 (Kort svar): " |
| `facit(fraga)` | facit för `privat/facit.facit[id]` (`null` = inget) |
| `bedomningsstod?(fraga)` | text för `privat/facit.bedomningsstod[id]` (bara `fritext`) |
| `utanFacit(fraga)` | elevens fråga – inget facit kvar (testat genom att söka efter facitvärdena) |
| `tomtSvar(elevFraga)` | startvärde |
| `arBesvarad(svar, elevFraga)` | för "Fråga 4 och 9 är obesvarade" |
| `rensaSvar(svar, elevFraga)` | svaret i giltig form innan det sparas (klippt, okända val bort) |
| `forslag(svar, facit, elevFraga)` | `{ poang, maxPoang, ratt: true \| false \| "delvis" }` eller `null` |
| `renderElev(elevFraga, svar, { onChange, lasLage })` | elevens svarsruta → HTMLElement (#740) – kontraktet i `prov-vy.js` |

**Typerna och svarens form:**

| Typ | Lärarens fält (med facit) | Eleven får | Svar |
| --- | --- | --- | --- |
| `flerval` | `alternativ` (2–6), `ratt` (index) | `alternativ` | index eller `null` |
| `flerval-flera` | `alternativ` (2–8), `ratt` (lista med index) | `alternativ` | lista med index |
| `santfalskt` | `ratt` (bool) | – | `true`/`false`/`null` |
| `kortsvar` | `godkanda` (1–20), `exaktStavning` (true), `skiftlage` (false) | – | text ≤ 100 |
| `lucktext` | `lucktext` med `[[svar]]`/`[[svar\|annat]]`, `exaktStavning`, `skiftlage` | `delar: [{ t } \| { lucka: n }]`, `antalLuckor` | lista med text per lucka |
| `para` | `par: [{ vanster, hoger }]` (3–10) | `vanster`, `hoger` (blandade) | valt högerled per vänsterled (`""` = inget) |
| `ordna` | `saker` (3–10, i rätt ordning) | `saker` (blandade) | elevens ordning, `[]` = inte rörd |
| `fritext` | `bedomningsstod?` | `maxTecken` (4000) | text ≤ 4000 |
| `text` | `titel`, `brodtext` (≤ 6000) | `titel`, `brodtext` | – |

Alla frågor har `id` (a–z, 0–9, `-`, `_`; fylls i som `f1, f2 …`), `typ`,
`fraga` (≤ 1000), `poang` (heltal 0–100, standard 1) och kan ha `hjalptext`.
Blandningen (`para`, `ordna`) är stabil per fråge-id och aldrig facit-ordningen.

### Lägga till en ny frågetyp

1. En ny fil `src/prov/typer/<typ>.js` som exporterar objektet ovan
   (börja med `valideraGemensamt` och `elevFalt` ur `typer/delat.js`).
2. En rad i `FRAGETYPER` (+ dess import) i `prov-fragetyper.js`.
3. Ett exempel i `test/helpers/prov-exempel.js` – testerna i
   `test/prov-fragetyper.test.js` går då igenom typen automatiskt.
4. Lärarsidan (#739): formuläret – en post i `KROPP` i
   `src/prov/larare/provl-fragaform.js` och ett fall i `fragaFranFalt`
   (`prov-redigera-ops.js`); AI-prompten – en rad i `SCHEMA_TYP` och
   `EXEMPEL_TYP` (`prov-prompt.js`). `test/prov-redigera.test.js` fäller om
   något av dem saknas.

Vyerna ligger i samma typfil: `renderElev` (C, #740, se nedan); `renderRattning`
och `renderResultat` läggs till av D (rättningen/resultatet). Inga listor i listor
(Firestore) – använd en map per post.

## Rättningen (`src/prov/prov-rattning.js`)

- `normSvar(s, { skiftlage })`: NFC, trim, hopslagna mellanslag, gemener (utom
  med skiftläge), en punkt sist bort, tal kanoniskt (`"7,0"` = `"7"`,
  `"3,50"` = `"3.5"`, `"1 000"` = `"1000"`, `−` = `-`).
- `matchaText(svar, godkanda, { exaktStavning, skiftlage })` → `true` /
  `"delvis"` / `false`. Utan exakt stavning blir **ett** stavfel
  (`levenshtein == 1`) `"delvis"` – men aldrig för tal (`7` mot `8`) eller
  godkända svar kortare än 4 tecken (`ek`/`ok`).
- Delpoäng (`delpoang`) avrundas till **närmaste halva poäng**. Ett stavfel ger
  halva poängen (`DELVIS_STAVFEL_ANDEL = 0.5`) – läraren justerar i rättningen.
- `gruppNyckel(svar, { skiftlage })` grupperar identiska kortsvar/luckor (§6.1).
- `fragetyp("lucktext").luckResultat(svar, facit)` → förslaget per lucka.

## Modellen (`src/prov/prov-modell.js`)

`STATUS`, `STATUS_NAMN`, `statusOvergangOk`, `INLAMNAD_NAR`, `TIDSMARGINAL_MS`,
`NIVAER`, `delaUppProv(prov)`, `fragaNummer(fragor)`, `tomtSvar(fragor)`,
`rensaSvar(svar, fragor)`, `besvarat(fragor, svar)` →
`{ besvarade, antal, obesvarade: [nr] }`, `fragaLista([4, 9])` → "Fråga 4 och 9",
`maxPoang(fragor)`, `autoForslag(fragor, svar, facit)` →
`{ [fragaId]: { poang, ratt, auto: true } }` (inte fritext).

`validateProv(obj)` i `prov-validera.js` → `{ ok, errors, warnings, value }`
(`value` = `null` vid fel, som `validateArea`). Standardinställningar:
`STANDARD_INSTALLNINGAR` (inkl. färggränserna `granser: { gul: 40, gron: 70 }`
för §7.5). `tolkaTidsgrans(v)` → `null` | 5–240 | `undefined` (ogiltig).

## Skapa och redigera (B, #739)

Lärarsidans grupp **Prov** (`TEACHER_GROUPS`) med fliken **Mina prov**
(`TEACHER_TABS`, `#/larare/prov`). Allt i `src/prov/larare/`, laddat lat:

| Fil | Gör |
| --- | --- |
| `page-larare-prov.js` | route: `?vy=mina` (standard), `?vy=ny`, `&id=` (redigera), `&kopia=` (kopiera → osparat utkast); laddar `prov-larare.css` |
| `provl-lista.js` | Mina prov + kollegors (hopfällda): namn, frågor, senast ändrat, ägare. Redigera/Radera bara med `canEditArea`; Kör i klass, Förhandsvisa och Kopiera för alla. Radera bekräftas i en ruta på sidan |
| `provl-redigera.js` | uppgifter + inställningar (§3), frågekort (↑ ↓ Redigera Duplicera Ta bort + Ångra), "Lägg till fråga" (typväljaren → formuläret), Spara (`tillDokument` → `setDoc`), lämna-vakt vid osparat |
| `provl-fragaform.js` | ett formulär per typ, `onSubmit(falt) → { ok, errors }` |
| `provl-ai.js` | "Skapa med AI" (§8.2): val → `buildProvPrompt` → klistra in → Granska (`tolkaAiJson` = `validateProv`) → frågorna läggs sist |
| `provl-forhandsvisa.js` | "Förhandsvisa som elev": `delaUppProv` (inget facit) + C:s `renderaFragor`, inget sparas |
| `provl-data.js` | `listaProv`, `hamtaProv`, `sparaProv` (hela dokumentet, `skapad` behålls, `uppdaterad` = servertid), `raderaProv` |

DOM-fri logik (testad i `test/prov-redigera.test.js`): `prov-redigera-ops.js`
(fält → fråga, spara/flytta/duplicera/ta bort, `tillDokument` med
`withOwner`, kopiera, AI-JSON med/utan kodstaket, frågor sist med nya id vid
krock), `prov-lista-ops.js` (listan per ägare) och `prov-prompt.js`.

**Gränssnittet mot C (#740)** – en implementation, i C:s moduler:
- Förhandsvisningen anropar `renderaFragor(container, fragor, { namn, installningar, onLamnaIn })`
  ur `src/prov/prov-elev-vy.js` – elevens egen provvy med typernas `renderElev`.
- "Kör i klass" (listan och redigeraren) anropar
  `korIKlass(ctx, provId, { onKlar })` ur `src/prov/prov-tillfallen-sida.js`
  (hämtar provet själv). Ett osparat prov måste sparas först.
- Gruppen `prov` (ikon `pencil`): "Mina prov" `#/larare/prov` först, C:s
  "Provtillfällen" `#/larare/prov/tillfallen` efter.

Förhandsvisning utan Firebase: `preview/preview-prov-larare.html`
(`?roll=admin` = admin; proven i `localStorage`, stubbar i `preview/prov-larare-stubs/`).

## Vad reglerna kräver av klienten (B–E)

- **prov**: `createdBy` = egen uid vid skapande, `namn` 1–80, `fragor` ≤ 60.
- **provTillfallen**: `classId`, `provId` (text), `status`, `fragor` (lista,
  får vara tom som förberett), `tidsgransMin` null eller heltal 5–240;
  `createdBy` = egen uid vid skapande. `classId`, `provId`, `createdBy` byts aldrig.
- **svar** (eleven): nycklar bara `elevId, classId, startad, uppdaterad, svar,
  inlamnad, inlamnadAt, inlamnadNar`. Skapa med `startad` och `uppdaterad` =
  `serverTimestamp()`; **varje** sparning sätter `uppdaterad: serverTimestamp()`.
  Inlämning: `inlamnad: true, inlamnadNar: "elev" | "tid", inlamnadAt: serverTimestamp()`.
  Efter `startad + tidsgransMin + 2 min` nekas allt – lämna in i tid.
  Fritextens 4000 tecken och kortsvarens 100 kontrolleras bara i klienten
  (`rensaSvar`) – reglerna kan inte gå igenom en map.
- **rattning**: `elevId` = dokument-id, `classId` = tillfällets, `fragor` (map,
  ≤ 60), `aterlamnad` (bool), `niva` null/`EG`/`G`/`MG`. Ångra = `aterlamnad: false`
  + `deleteField()` på `facit` och `aterlamnadAt`. Eleven får `getDoc` på en
  rättning som inte finns (ingen behörighetsfel) men nekas en som inte är återlämnad.
- **Elevens lyssnare** (§5.5): `where("classId", "in", classIds)` +
  `where("status", "==", "oppet")` är testad i reglerna. Utan statusfiltret nekas listan.
- **Lärarens listor**: `where("classId", "in", egnaKlasser)` på `provTillfallen`;
  `svar`/`rattning` under ett tillfälle listas utan filter.

## Provtillfället (C, #740)

| Fil | Gör |
| --- | --- |
| `prov-tillfalle-logik.js` | ren logik: `slutTid`, `kvarText`/`kvarNiva` (gul ≤ 5 min, röd ≤ 1 min), `elevLage`, `valjStartSvar` (localStorage mot servern), `oversiktRader`, `standardLasMinuter`, `attStangaIn`/`attOppnaIgen`, `provSynligt` |
| `prov-sparning.js` | `skapaSparare({ spara, onStatus, onSlutgiltigt })` – autosparningen (se Budget) |
| `prov-vy.js` | DOM-hjälpare för typvyerna: `h`, `stavAttr`, `valLista`, `textFalt`, `laddaCss` |
| `prov-elev-vy.js` | `renderaProv({ namn, fragor, installningar, svar, onAndrat, onLamnat, onLamnaIn })` – hela provet utan Firebase |
| `prov-elev-sida.js` | `#/elev/prov` (lista), `#/elev/prov/skriv?t=`, `#/elev/prov/resultat?t=` (platshållare för D) |
| `prov-elev-data.js` | elevens skrivningar: `startaProv`, `sparaSvar`, `lamnaIn` |
| `prov-watch.js` | menylänken + elevens lista: EN `onSnapshot` på öppna tillfällen, ETT `getDocs` på tillbakalämnade |
| `prov-tillfalle-data.js` | lärarens skrivningar: `skapaTillfalle`, `oppnaTillfalle`, `stangTillfalle`, `raderaTillfalle`, `hamtaSvar` |
| `prov-tillfalle-rutor.js` | rutorna Kör i klass / Öppna / Stäng / Radera (aldrig `confirm()`) |
| `prov-tillfallen-sida.js` | fliken `#/larare/prov/tillfallen` och översikten `#/larare/prov/tillfalle?t=` |

Förhandsvisning utan Firebase: `preview/preview-prov-elev.html` (alla frågetyper,
nätfel, offline, "läraren stänger", `?kvar=4`) och `preview/preview-prov-tillfallen.html`
(25 elever skriver). Skärmdumpar: `docs/qa-prov-740/`.

**För B (#739)** (gränssnittet låst av leaden):

- **Kör i klass:** `(await import("./prov-tillfallen-sida.js")).korIKlass(ctx, provId, { onKlar })`
  – `provId` (sträng) eller provobjektet `{ id, namn, fragor, installningar }`.
  Öppnar rutan klass/tidsgräns/lås → "Öppna nu" eller "Spara och öppna senare";
  `onKlar(tillfalleId, oppnat)` efteråt. Fliken Provtillfällen är C:s.
- **Förhandsvisa som elev:** `renderaFragor(container, fragor, { namn, svar, installningar, lasLage, onAndrat, onLamnaIn })`
  ur `prov-elev-vy.js` (`fragor` = `delaUppProv(prov).fragor`; laddar `prov-elev.css`
  själv). `onAndrat(svarMap)` får hela svar-mapen; utan den sparas inget.
  Returnerar vyn (`svar()`, `las()`, `satTid()`).

**För D (#741):** rättningsräknaren ("18 av 24 rättade") och Rätta-knappen hör
hemma i `ritaLista` (`prov-tillfallen-sida.js`, kommentaren vid raden);
resultatvyn ersätter `pageProvResultat` i `prov-elev-sida.js`.

**Typernas `renderElev(elevFraga, svar, { onChange, lasLage })` → HTMLElement**
(en per typfil, låst signatur, kommentaren i `prov-vy.js`): `onChange(nyttSvar)`
ger svaret i formen ovan; `lasLage: true` = visning utan kontroller som ändrar
något. Valfritt även `onLamna()` (lämnade rutan → spara snart), `attr`
(stavningsattributen) och `uid` (id-prefix). `ordna` är obesvarad tills eleven
flyttat något eller tryckt "Behåll den här ordningen".

**Flödet** (statusflödet ovan): "Kör i klass" skapar `forberett` (+ `fokus`,
`skapad`); Öppna kopierar provets **senaste** version; Stäng sätter status först
(då nekar reglerna eleverna) och markerar sedan svaren; Öppna igen tar tillbaka
stängningens markeringar. Läraren väljer låset i rutan: standard tidsgränsen +
10 min, annars 60 min, "Dölj allt annat" ikryssat.

**Eleven:** sparar till `localStorage` vid varje ändring (`pp:prov:<t>:<uid>`);
omladdning väljer den lokala kopian om den är minst lika ny som serverns
`uppdaterad`. Nedräkningen räknas från serverns `startad` mot `serverNow()`;
vid noll lämnas provet in (`inlamnadNar: "tid"`, nya försök var 5–20 s inom
reglernas 2 minuter). Läraren stänger → elevens lista tappar tillfället →
sidan läser läget en gång och visar "Provet är stängt. Dina sparade svar gäller."

**Fokusläget:** `typ: "prov"` + `id` = tillfället, se [`FOKUSLAGE.md`](FOKUSLAGE.md).

## Budget (§9) – 25 elever, 12 frågor, 40 minuter

Autosparningen (`prov-sparning.js`): första sparningen 4 s efter en ändring,
direkt när eleven lämnar en ruta – men **högst en skrivning per 24 s**. Utan
tak skulle en elev som skriver hela tiden ge 600 skrivningar (15 000 för
klassen). Inlämning, "eleven lämnar sidan/fliken" och "nätet tillbaka" sparar
direkt. Misslyckade försök (nätfel) kostar inget och görs om efter 5/10/20/30 s;
en sparning som hänger > 8 s visar felraden.

| Del | Räkning | Läsningar | Skrivningar |
| --- | --- | --- | --- |
| Elev: lyssnaren (1 + ändringar) + tillbakalämnade (≥ 1) + eget svar + start | ~6 per elev | 150 | – |
| Elev: start + autosparning + inlämning | ≤ 1 + 101 + 1 per elev (tak) | – | ≤ 2 575 (värsta fall) |
| Lärarens översikt | namn 25 + tillfället 1 + 25 svar var 60:e s × 40 | 1 026 | – |
| Öppna/stänga | tillfälle + facit + lås + stäng + 25 markeringar + lås av | 25 (svaren vid stäng) | ~30 |
| **Summa** | | **≈ 1 200** | **≤ 2 605** |

Översikten läser inte medan fliken är dold och inte när provet är stängt (bara
"Uppdatera nu"). En vanlig elev ändrar inte något var 24:e sekund i 40 minuter –
i praktiken blir det några hundra skrivningar för klassen. Uträkningen finns
som test i `test/prov-tillfalle.test.js` ("budgeten"). Rättningens läsningar
(52) räknar D.

## Deploy

`firebase deploy --only firestore:rules,firestore:indexes` (regler + det
sammansatta indexet och fältundantaget för `rattning`). Inga functions.
