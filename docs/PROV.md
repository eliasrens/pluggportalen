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
  egen inlämning (`elev`/`tid`) är slutgiltig, och den som redan **fått tillbaka**
  provet (`rattning/{uid}.aterlamnad == true`) öppnas inte igen (#743 F4: regeln
  `provEjTillbakalamnad`, en `exists()`/`get()` per elev). Klienten läser därför
  rättningarna, hoppar över de tillbakalämnade (`attOppnaIgen(svar, tillbaka)`),
  skriver i batchar om `OPPNA_IGEN_BATCH` = 15 (gränsen 20 dokumentåtkomster per
  batch) och varnar i rutan: "N elever har redan fått tillbaka provet …".
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
| `renderRattning(elevFraga, svar, { facit, facitRad })` | lärarens bild av svaret med ✓/½/✗ per del (#741) – `prov-svar-vy.js` |
| `renderResultat(elevFraga, svar, { facit })` | samma bild för eleven efter tillbakalämningen; `facit: null` = inget facit (#741) |
| `facitText(elevFraga, facit)` | facit på en rad överst i rättningen per fråga (#741) |
| `gruppNyckel?(svar, elevFraga, facit)` | finns den grupperas identiska svar i rättningen (kortsvar, lucktext, #741) |

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

Vyerna ligger i samma typfil: `renderElev` (C, #740) och en visningsfunktion
`visa(f, svar, o)` som sprids med `...svarsVyer(visa)` (`prov-svar-vy.js`) till
`renderRattning` och `renderResultat` (D, #741). Inga listor i listor
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

**Rättningen (D, #741)** visar "18 av 24 rättade" och knappen **Rätta** i
`ritaLista` och översikten (ur tillfällets `rattStatus`, ingen extra läsning);
resultatvyn är `pageProvResultat` i `prov-elev-sida.js`.

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

## Rättningen och tillbakalämningen (D, #741)

`#/larare/prov/ratta?t=<tillfälle>` (gruppen Prov, fliken Provtillfällen, knappen
**Rätta**). Bara **inlämnade** prov rättas; är provet fortfarande öppet syns de
som skriver som "skriver fortfarande" och kommer med när vyn laddas om.

| Fil | Gör |
| --- | --- |
| `prov-rattning-logik.js` | ren logik: förslagen (`nyRattning`, `forslagFor`, `kompletteraForslag`), `bedom` (en elev), `svarsGrupper` + `bedomGrupp` (grupp), `godkannFraga`/`godkannAlla`, `elevStatus`, `summera`, `rattStatusSumma`, `aterlamnaPlan`, `aterlamnadDok`/`angratDok`, `sparDok`, `resultatModell` |
| `prov-rattning-data.js` | `laddaRattning` (en gång), `sparaRattningar`, `lamnaTillbaka`, `angraTillbaka` – batchar med hela dokument |
| `prov-ratta-lager.js` | vyns tillstånd + autosparningen (`skapaSparare` med `LARARENS_SPARNING`) |
| `prov-ratta-sida.js` | route, skalet (räknaren, Lämna tillbaka till alla rättade, flikarna, Dölj namn), rutan, tangentbordet |
| `prov-ratta-lagen.js` | `perFraga(v)` och `perElev(v)` |
| `prov-ratta-kort.js` | ett kort: Rätt/Delvis/Fel, poäng (fält + snabbknappar 0 … max), kommentar |
| `prov-svar-vy.js` | typernas svarsbild (alternativ, text, ✓/½/✗) |
| `prov-resultat-vy.js` | elevens resultatvy utan Firebase (`renderaResultat(resultatModell(…))`) |
| `prov-ratta.css`, `prov-resultat.css` | `.provl-r-` (lärare), `.provv-sv-`/`.provv-res-` (svaren, eleven) |

- **Förslag**: när vyn öppnas får varje inlämnat prov utan rättning en med
  typernas förslag (`auto: true`) – obesvarade frågor som typen inte rättar själv
  (fritext) får förslaget *fel*. De sparas direkt. Ett förslag räknas **inte** som
  rättat förrän läraren godkänner det ("Godkänn alla förslag på den här frågan",
  "Godkänn elevens förslag", eller trycker samma bedömning). En kommentar ensam
  ändrar inte förslaget.
- **Bedömning**: rätt = max, fel = 0, delvis = halva (eller den delpoäng som
  redan stod). Skriver läraren poäng följer bedömningen (max = rätt, 0 = fel).
  Prov utan poäng visar bara Rätt/Delvis/Fel.
- **Grupper** (§6.1): typer med `gruppNyckel` (kortsvar, lucktext) grupperas
  efter `normSvar` – "Birka", "birka." och " BIRKA" blir en grupp. Bedömningen och
  kommentaren gäller alla i gruppen; tillbakalämnade hoppas över. En grupp där alla
  har samma bedömning men några bara som förslag visas som förslag.
- **Status per elev** (§6.3): Ej rättad (bara förslag) → Delvis rättad → Rättad
  (alla frågor bedömda) → Tillbakalämnad.
- **Tangenter**: 1 rätt · 2 delvis · 3 fel på kortet i fokus, Tab nästa kort
  (Shift+Tab föregående), Enter till poäng/kommentar, N nästa fråga.
  **Dölj namn** visar Elev 1, Elev 2 … i en blandad ordning (sparas i `localStorage`).
- **Lämna tillbaka** (§7): per elev (Per elev) eller "Lämna tillbaka till alla
  rättade" – de som inte är färdigrättade hoppas över och rutan säger hur många.
  Rutan har "Visa facit" med provets `visaFacit` som förval; facit
  (`privat/facit.facit`, hela) kopieras in bara då. En tillbakalämnad rättning är
  låst i vyn tills läraren trycker **Ångra tillbakalämning** (`aterlamnad: false`,
  `facit` och `aterlamnadAt` bort).
- **Reglerna** (`provAterlamningOk`, `validRattning`): bara kända fält;
  `facit`/`aterlamnadAt` bara när `aterlamnad == true`; att lämna tillbaka kräver
  `aterlamnadAt == request.time`. Batcharna gör en `get()` (tillfället, samma för
  alla) – testat med 25 elever i en batch (`test/firestore-rules-prov-rattning.test.js`).
- **Elevens resultatvy** `#/elev/prov/resultat?t=`: tillfället + eget svar + egen
  rättning (tre läsningar). Före tillbakalämningen nekar reglerna rättningen →
  "Inte tillbakalämnat än". Namn och datum, "18 av 24 poäng" (utan poäng: antal
  rätt/delvis/fel), nivån, helhetskommentaren, varje fråga med svaret, ✓/½/✗ med
  text och poäng, lärarens kommentar och facit om det visas.

Förhandsvisning utan Firebase: `preview/preview-prov-rattning.html` (8 elever,
stubbar i `preview/prov-ratta-stubs/`, `?nollstall` börjar om). Skärmdumpar:
`docs/qa-prov-741/`.

## Statistiken (E, #742, §7.5)

Grönt/gult/rött – **alltid** med symbol och text (✓ ½ ✗, obesvarad `–` streckad,
inte rättad `?`), så att det fungerar för färgblinda och vid utskrift.

| Fil | Gör |
| --- | --- |
| `prov-statistik.js` | ren logik: `cellLage`, `andelFor`, `fargFor`, `granserFor`, `klassOversikt`, `sorteraRader`, `fordelning`/`fordelningText`, `provInfoDok`, `historik`, `linjePunkter` |
| `prov-stat-vy.js` | rättningsvyns flik **Översikt** (`oversiktVy`) och elevvyn (`elevStatVy`, bara att läsa) |
| `prov-klass-statistik.js` | fliken **Prov** i klassens statistik (`renderClassProv`, rad i `STATS_TABS`, `when: classId`) |
| `prov-statistik-data.js` | statistikflikens enda läsning: `hamtaKlassensRattningar(classId)` |
| `prov-statistik.css` | `.provl-st-` |

- **Andelen** räknas bara över **bedömda** frågor (ett förslag med `auto: true` är
  inte bedömt). Obesvarade och orättade blir alltså inte fel förrän läraren rättat
  dem; en elev utan bedömda frågor är "ej rättad". Med poäng: poäng av max för de
  bedömda frågorna. Utan poäng: andelen rätt, "delvis" = ½.
- **Färgen**: grön ≥ `granser.gron` (70), gul ≥ `granser.gul` (40), annars röd –
  räknat på hela procent med flyttalsbruset bort (7 av 10 = 70 % = grön).
  Nivån (EG/G/MG) visas **bredvid** och ändrar aldrig färgen.
- **Översikt** `#/larare/prov/ratta?t=…&lage=oversikt` (knappen **Resultat** i
  Provtillfällen när något är rättat): räknaren "✓ 12 gröna · ½ 7 gula · ✗ 4 röda ·
  ? 1 ej rättade", klassens snitt, de tre svåraste frågorna (länk till Per fråga),
  sortering namn/resultat, två reglage för gränserna (sparas på tillfället:
  `installningar.granser`, `sparaGranser`) och rutnätet elev × fråga med
  totalbricka "18/24 · 75 %" + nivå och "64 %" per fråga längst ner. Rutnätet
  scrollar i sidled i sin egen ruta med namnkolumnen fast. Klick på en elev →
  elevvyn (`&e=<uid>`), på en cell → just det svaret i Per elev (`&lage=elev&e=&f=`).
  **Inga extra läsningar** – allt kommer ur rättningsvyns laddning.
- **Över tid** (klassens statistik → Prov): klassens tillfällen (datum, prov,
  snitt, fördelning, länk till Resultat) och per vald elev alla prov (datum,
  procent, färg, nivå) + en liten linje. **EN** collection group-fråga
  `collectionGroup("rattning")` + `where("classId", "==", klassen)` när fliken
  öppnas (fältundantaget i `firestore.indexes.json`, regeln
  `match /{path=**}/rattning`). Tillfällets id = `ref.parent.parent.id`.
- För att klara sig med den enda frågan sparar rättningsvyn `provInfo:
  { datum, granser, andel }` (`provInfoDok`) i varje rättning vid varje sparning.
  Ändras gränserna markeras alla ej tillbakalämnade rättningar för sparning; de
  redan tillbakalämnade behåller sina gamla gränser i historiken. Rättningar utan `provInfo` (äldre) använder
  `totalPoang/maxPoang` om de är tillbakalämnade.

Förhandsvisning utan Firebase: `preview/preview-prov-statistik.html` (25 elever,
12 frågor, tre äldre prov; stubbar i `preview/prov-statistik-stubs/`,
`?nollstall` börjar om). Skärmdumpar: `docs/qa-prov-742/`. Tester:
`test/prov-statistik.test.js`, regler `test/firestore-rules-prov-statistik.test.js`.

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
som test i `test/prov-tillfalle.test.js` ("budgeten").

**Rättningen (#741)**, en gång när vyn öppnas: tillfället 1 + facit 1 + 25 svar +
25 rättningar + 25 namn = **77 läsningar** (ingen lyssnare; att byta fråga, elev
eller läge läser inget). Skrivningar: förslagen 25 (en batch) + autosparningen –
en batch med de ändrade eleverna högst var 10:e sekund (`LARARENS_SPARNING`).
Per fråga rör varje fråga alla elever en gång: 12 × 25 = 300; tillbakalämningen 25,
räkneverket ett par. **≈ 350 skrivningar** för en hel rättning. Med elevernas
realistiska några hundra skrivningar och ≈ 1 300 läsningar stannar provet + rättningen
långt under 3 000/3 000.

**Statistiken (#742)**: Översikten läser inget (rättningsvyns data). Att ändra
gränserna = 1 skrivning + en sparning av klassens ej tillbakalämnade rättningar
(≤ 25). Fliken Prov i klassens statistik = **en** fråga: lika många läsningar som
klassen har rättningar (25 elever × 10 prov = 250), en gång när fliken öppnas.

## Deploy

`firebase deploy --only firestore:rules,firestore:indexes` (regler + det
sammansatta indexet och fältundantaget för `rattning`). Inga functions.
