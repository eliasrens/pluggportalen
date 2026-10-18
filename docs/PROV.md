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
| `arFraga` | `false` för `text` och `avsnitt` (inget nummer, ingen poäng, inget svar, aldrig obesvarad) |
| `validera(fraga)` | `{ ok, fel, varningar, value }` – fel utan plats; `validateProv` sätter "Fråga 4 (Kort svar): " |
| `facit(fraga)` | facit för `privat/facit.facit[id]` (`null` = inget) |
| `bedomningsstod?(fraga)` | text för `privat/facit.bedomningsstod[id]` (bara `fritext`) |
| `kriterier?(fraga)` | lista för `privat/facit.kriterier[id]` (bara `fritext`, #762) |
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
| `fritext` | `bedomningsstod?`, `kriterier?` (≤ 20 rader à ≤ 300 tecken, #762) | `maxTecken` (4000) | text ≤ 4000 |
| `text` | `titel`, `brodtext` (≤ 6000) | `titel`, `brodtext` | – |
| `avsnitt` (#762) | `titel` (1–200), `instruktion?` (≤ 1000) | `titel`, `instruktion?` | – |

Alla frågor har `id` (a–z, 0–9, `-`, `_`; fylls i som `f1, f2 …`), `typ`,
`fraga` (≤ 1000), `poang` (0,5–20 i steg om 0,5, standard 1, lagras som tal `3.5` – #762;
gamla heltal 1–20 är giltiga) och kan ha `hjalptext`.
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
- Delpoäng (`delpoang` = `delpoangNed`, #762) avrundas **nedåt** till halva poäng
  (para 2 p, 3 av 5 rätt → 1,2 → 1 p) – se "Halvpoäng" nedan. Ett stavfel ger
  halva poängen (`DELVIS_STAVFEL_ANDEL = 0.5`) – läraren justerar i rättningen.
  Med provets val **Rätta stavfel själv** (`installningar.stavfel: "sjalv"`, #759)
  får stavfelssvaret inget förslag alls – se "Inställningar per prov" nedan.
- `gruppNyckel(svar, { skiftlage })` grupperar identiska kortsvar/luckor (§6.1).
- `fragetyp("lucktext").luckResultat(svar, facit)` → förslaget per lucka.

## Modellen (`src/prov/prov-modell.js`)

`STATUS`, `STATUS_NAMN`, `statusOvergangOk`, `INLAMNAD_NAR`, `TIDSMARGINAL_MS`,
`NIVAER`, `delaUppProv(prov)`, `fragaNummer(fragor)`, `tomtSvar(fragor)`,
`rensaSvar(svar, fragor)`, `besvarat(fragor, svar)` →
`{ besvarade, antal, obesvarade: [nr] }`, `fragaLista([4, 9])` → "Fråga 4 och 9",
`maxPoang(fragor)`, `autoForslag(fragor, svar, facit, { stavfel })` →
`{ [fragaId]: { poang, ratt, auto: true } }` (inte fritext, inte stavfel med "sjalv").

`validateProv(obj)` i `prov-validera.js` → `{ ok, errors, warnings, value }`
(`value` = `null` vid fel, som `validateArea`). Standardinställningar:
`STANDARD_INSTALLNINGAR` (inkl. `stavfel: "auto"` och färggränserna
`granser: { gul: 60, gron: 85 }`, #759). `tolkaTidsgrans(v)` → `null` | 5–240 |
`undefined` (ogiltig). `stavfelFor(installningar)`, `granserOk(g)` och
`granserText(g)` – se "Inställningar per prov".

## Inställningar per prov (Etapp 2, #759)

Två val i redigeraren (`src/prov/larare/provl-bedomning.js`, fältet **Stavfel
och färggränser** under Pluggmynt). De sparas i `prov.installningar` och följer
med till tillfället när det skapas och öppnas (`tillfalleInstallningar` i
prov-validera.js: standarden för det som saknas, ogiltiga gränser från ett äldre
tillfälle → 60/85, så att reglerna godtar t.ex. ett omprov av det).

- **Stavfel** `stavfel: "auto" | "sjalv"` (standard `"auto"`; saknat = auto, så
  gamla prov fungerar som förut). Gäller frågor där **Exakt stavning krävs** är
  av (kortsvar och lucktext). `"auto"`: ett stavfel ger halva poängen som förslag
  (`auto: true`). `"sjalv"`: typens `forslag(svar, facit, f, { stavfel })` ger
  `null` för ett svar med stavfel – kortsvaret, eller hela lucktexten om någon
  lucka har ett stavfel – så frågan står som **? Inte rättad** hos eleven tills
  läraren bedömt den (Godkänn alla förslag räcker inte). Rätt stavat och helt
  fel får förslag som vanligt; med exakt stavning är ett stavfel fortfarande fel.
  Rättningsvyn läser valet ur **tillfällets** inställningar
  (`stavfelFor(tf.installningar)` → `nyRattning`/`kompletteraForslag`) och
  facitraden säger "stavfel rättar du själv" i stället för "ett stavfel ger delvis".
  Förslag som redan sparats ändras inte om valet ändras efteråt.
- **Färggränser** `granser: { gul, gron }` i hela procent av maxpoängen (utan
  poäng: andelen rätt), standard **60/85**: röd under gul, gul från gul, grön
  från grön. Validering: `0 < gul < grön ≤ 100` (`granserOk`, samma i reglerna
  `provGranserOk`). Gamla prov och tillfällen **utan** gränser får 60/85; ett prov
  som sparats med Etapp 1:s standard (40/70 lagrat i dokumentet) behåller sina
  40/70 tills läraren ändrar dem. **En** hjälpare för alla vyer:
  `granserFor(installningar)` (prov-statistik.js) → giltiga gränser eller
  standarden, och `fargFor(andel, granser)` (avrundningsregeln från Etapp 1
  står kvar). **Kedjan**: tillfällets gränser → provets → 60/85
  (`granserFor(tf.installningar, prov.installningar)`, första giltiga vinner).
  Prov sparade före #759 behåller sina sparade gränser (40/70); bara prov utan gränser får 60/85.
  Provets gränser är standard och kopieras till tillfället när det skapas och
  öppnas; reglaget i Översikten sparar på **tillfället** och gäller bara den
  körningen (provet ändras inte). Används i översikten, elevvyn, CSV,
  fördelningen, klassjämförelsen, utskriften och historiken (via
  `provInfo.granser`). Översiktens reglage ändrar tillfällets kopia (1–99 / 2–100).
- Reglerna (`provInstOk`): `stavfel` bara `"auto"`/`"sjalv"`, `granser` bara
  `{ gul, gron }` heltal enligt ovan – på provet, när ett tillfälle skapas och när
  ett tillfälles inställningar **ändras** (ett äldre tillfälle med gränser som inte
  längre godtas kan ändå stängas/öppnas).

Tester: `test/prov-installningar.test.js`, regler
`test/firestore-rules-prov-installningar.test.js`. Förhandsvisning utan Firebase:
fältet i `preview/preview-prov-larare.html` (Redigera ett prov); rättningen och
statistiken i `preview/preview-prov-rattning.html` och
`preview/preview-prov-statistik.html` med `?stavfel=sjalv`, `?granser=50-75`
eller `?gammalt` (tillfälle utan fälten) – länkar i kontrollraden,
`preview/prov-installningar-pv.js`. I rättningspreviewn har Cleo stavfelet
"Birkka" på fråga 4.

## Halvpoäng, avsnitt och poängkriterier (Etapp 3, #762, spec §2.2–§2.3)

**Poäng-kärnan** `src/prov/prov-poang.js` – ALL räkning och visning av poäng går
hit (test: `test/prov-poang-avsnitt.test.js`):

| Funktion | Gör |
| --- | --- |
| `halvor(p)` / `franHalvor(n)` | tal ↔ halva poäng som heltal (3.5 ↔ 7) |
| `summaPoang(lista)` | exakt summa i halva poäng (3,5 + 4 + 0,5 = 8) – `maxPoang`, `summera` |
| `delpoangNed(andel, max)` | automatikens delpoäng, **nedåt** till 0,5 (flyttalsbruset tippar aldrig nedåt) |
| `klamPoang(p, max)` | lärarens poäng 0 … max i steg om 0,5 (`tolkaPoang`, `bedom`) |
| `arGiltigMaxpoang(p)` | 0,5–20 i steg om 0,5 (`valideraGemensamt`) |
| `poangTal(p)` / `poangP(p)` / `poangAv(p, max)` | "3,5" / "3,5 p" / "17,5 av 24 poäng" – decimalkomma i elevsidan, rättningen, resultatet, statistiken, CSV:n och utskriften |
| `POANG_MIN`, `POANG_MAX`, `POANG_STEG`, `POANG_STANDARD` | 0,5 / 20 / 0,5 / 1 |

Validering (§2.5): `poang` som tal eller text med komma/punkt ("3,5"); fel
"Fråga 4 (Kort svar): poängen ("poang") måste vara 0,5–20 i steg om 0,5." ⚠️ Ett
gammalt prov med en fråga på 0 eller över 20 poäng (gick förr) måste ändras innan det
sparas igen – att köra och rätta det fungerar som förut. Redigerarens sifferfält:
`step 0.5`, `min 0.5`, `max 20`; ett ogiltigt fält blir ett fel, aldrig tyst 1.
AI-prompten ber om 0.5–20 i steg om 0.5.

**`visaPoangForElev`** (`installningar`, standard `true`, kryssrutan "Visa poängen
för eleven" under "Poängsätt frågorna"): elevsidan visar "(4 p)" vid varje fråga och
"Provet ger högst 32 poäng" under namnet. Av – eller `poang: false` – visar inget av det.
Gamla prov utan fältet får standarden (på), alltså nu även totalen överst.

**Avsnitt** – typen `avsnitt` (`src/prov/typer/avsnitt.js`, `arFraga: false`):
`{ id, typ: "avsnitt", titel, instruktion? }`, ingen fråga, inget svar, ingen poäng.
Läggs till via "Lägg till fråga" och flyttas som de andra korten.

- Frågorna numreras **löpande** genom hela provet (`fragaNummer` – avsnitt och
  textblock får inget nummer); `validateProv` säger "Avsnitt 1: …" för sig.
- `avsnittsGrupper(fragor)` (`prov-modell.js`) → `[{ avsnitt, poster, fragor, maxPoang }]`:
  en grupp per avsnitt, poster före första avsnittet i en grupp med `avsnitt: null`
  (bara om den har något), ett prov utan avsnitt = en grupp. **C och D grupperar
  rättningen och statistiken (poäng per avsnitt) med den här.**
- Elevsidan: rubrik + instruktion (`.provv-avsnitt`), frågelistan grupperad per
  avsnitt (`.provv-lista-grupp`/`.provv-lista-avsnitt`).
- Redigeraren: överst "Frågor: 12 frågor · 32 p" (`provSumma`), avsnittskortet
  (`.provl-kort-avsnitt`) visar "3 frågor · 8 p" (`avsnittSummor`).
- Allt annat hoppar över avsnitten via `arFraga`/`rattFragor`: `tomtSvar`,
  `rensaSvar`, `besvarat` ("obesvarade"), `autoForslag`, `maxPoang`, `summera`,
  statistiken, CSV:n, pluggmynten, anpassningarna. Per elev (rättningen),
  resultatvyn och utskrifterna visar avsnittet som en rubrik.
  `arAvsnitt(f)` i `prov-fragetyper.js`.

**Poängkriterier** (fritext, valfritt): `kriterier: ["1 p: nämner en orsak", …]`
på frågan i provet (fältet "Poängkriterier – ett per rad" under bedömningsstödet).
När provet öppnas → `privat/facit.kriterier: { [fragaId]: [...] }` (bara om provet
har några – ett gammalt prov ger samma facitdokument som förr); `laddaRattning`
returnerar `kriterier`. **C** visar dem vid rättningen.
`installningar.visaKriterier` (standard `false`, kryssrutan "Visa poängkriterierna"):
vid tillbakalämningen kopierar `aterlamnadDok(r, { visaFacit, facit, kriterier })`
dem till `rattning.kriterier` (rättningslagret skickar dem bara när valet är på);
ångra tar bort dem. **D** visar dem i resultatvyn. Eleven kan aldrig läsa dem före
tillbakalämningen: `privat/facit` läser hen aldrig, och reglerna tillåter
`rattning.kriterier` bara när `aterlamnad == true` (som `facit`).
Utskriftens facitblad visar dem efter bedömningsstödet.

Förhandsvisning (port 8762 i #762): `preview/preview-prov-elev.html#/elev/prov/skriv?t=tf-demo`
(Del 1/Del 2 + halvpoäng; `?utanpoang`, `?gammalt`), `preview/preview-prov-larare.html`
→ "Prov med avsnitt (#762)" (`?#/larare/prov?vy=ny&id=avsnitt`; "Återställ proven" om
det saknas), och `preview/preview-prov-rattning.html` (avsnitt + kriterier i provet).

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

- **prov**: `createdBy` = egen uid vid skapande, `namn` 1–80, `fragor` ≤ 60;
  #762: `installningar.visaPoangForElev`/`visaKriterier` true/false;
  #759: `installningar.stavfel` `"auto"`/`"sjalv"`, `installningar.granser`
  `{ gul, gron }` heltal med `0 < gul < gron ≤ 100` (samma på tillfället).
- **provTillfallen**: `classId`, `provId` (text), `status`, `fragor` (lista,
  får vara tom som förberett), `tidsgransMin` null eller heltal 5–240;
  `createdBy` = egen uid vid skapande. `classId`, `provId`, `createdBy` byts aldrig.
  #748: `extraTid` en map (≤ 100 elever), `elevIds` en lista med 1–100 elever
  som aldrig byts (inte heller läggs till eller tas bort efter skapandet);
  `omprovAv` likaså, och vid skapandet samma prov och klass som ursprunget.
- **svar** (eleven): nycklar bara `elevId, classId, startad, uppdaterad, svar,
  inlamnad, inlamnadAt, inlamnadNar, flikbyten` (#748: heltal 0–10 000). Skapa med `startad` och `uppdaterad` =
  `serverTimestamp()`; **varje** sparning sätter `uppdaterad: serverTimestamp()`.
  Inlämning: `inlamnad: true, inlamnadNar: "elev" | "tid", inlamnadAt: serverTimestamp()`.
  Efter `startad + tidsgransMin + extraTid[uid] + 2 min` nekas allt – lämna in i tid.
  Ett omprov (`elevIds`): bara eleverna i listan får skapa och spara.
  Fritextens 4000 tecken och kortsvarens 100 kontrolleras bara i klienten
  (`rensaSvar`) – reglerna kan inte gå igenom en map.
- **rattning**: `elevId` = dokument-id, `classId` = tillfällets, `fragor` (map,
  ≤ 60), `aterlamnad` (bool), `niva` null/`EG`/`G`/`MG`. Ångra = `aterlamnad: false`
  + `deleteField()` på `facit`, `kriterier` (#762) och `aterlamnadAt`. Eleven får `getDoc` på en
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
den längsta extra tiden (#749) + 10 min, annars 60 min, "Dölj allt annat" ikryssat.

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
- **Färgen**: grön ≥ `granser.gron`, gul ≥ `granser.gul`, annars röd – provets
  gränser (#759, standard 60/85) – räknat på hela procent med flyttalsbruset bort
  (7 av 10 = 70 % = grön med gränsen 70).
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

## Hämta från område (Etapp 2, #745, §10)

Knappen **Hämta från område** i redigeraren öppnar `provl-fran-omrade.js`
(lat): ämne → område (alla områden läraren får läsa, "Visa: Mina områden" som i
Innehållsstudion, ägaren via `createdByLabel`) → kryssrutor per sort →
"Lägg till i provet" (`laggTillFragor`: sist, nya id vid krock). Läser
`getSubjects`/`getAreas` (session-cachen i `data-content.js`) – inga nya
samlingar, inga regler.

Omvandlingen är DOM-fri i `prov-fran-omrade.js` (`omradetsSaker`,
`fragorFranOmrade`, testad i `test/prov-fran-omrade.test.js`); allt som kommer ut
har gått genom `validateProv`.

| I området | Blir i provet |
| --- | --- |
| Quizfråga | `flerval`, 1 poäng |
| Quizfråga med `passage` | ett `text`-block per text (en gång, utan titel) + `flerval` under |
| Par (`pairs`) | `para` med de valda paren, 1 poäng per par; fler än 10 delas jämnt (11 → 6 + 5), färre än 3 hoppas över |
| Tidslinje (`timeline`) | `ordna` sorterad efter år ("Sätt händelserna i rätt ordning."), 1 poäng per händelse; samma år två gånger → bara den första; delas som paren |
| Ämnesläsningstext (`readingTextsOf`) | `text`-block med titeln + frågorna som `flerval` |

Saker som inte kan bli en provfråga är gråade i listan med orsaken och hoppas
över med en varning: par med bara en bild, quizfrågor med fler än 6 (eller
likadana) alternativ, texter över 6000 tecken. Gamla nivåtexter (#152) under
`readingTexts` syns aldrig.

## Pluggmynt (#746, §11)

Provets inställning `installningar.mynt` (kopieras till tillfället som de andra
inställningarna): `{ typ: "inga" }` (standard, även prov utan fältet),
`{ typ: "fast", antal: 1–200 }` för ett inlämnat prov eller
`{ typ: "poang", antal: 1–20 }` per poäng (kräver `poang: true`; per poäng
avrundas nedåt). Väljs under **Pluggmynt** i redigeraren (`larare/provl-mynt.js`).
Beloppet räknas först vid tillbakalämningen, ur rättningens `totalPoang`, och är
**högst 200 per prov och elev** (`src/prov/prov-mynt.js`).

| Fil | Vad |
| --- | --- |
| `prov-mynt.js` | DOM-fri: `valideraMynt`, `provMyntBelopp`, texterna (`test/prov-mynt.test.js`) |
| `prov-mynt-pay.js` | utbetalningen, SDK:t injicerat (samma kod i `test/firestore-rules-prov-mynt.test.js`) |
| `prov-mynt-data.js` | Firebase-sidan, laddas dynamiskt av rättningslagret bara när tillfället har mynt |

**Samma mekanism som Live-mynten** (`src/live/live-rewards-pay.js`): ingen Cloud
Function, utan en transaktion per elev från lärarens klient där saldot
(`studentData.coins`) och ett **kvitto** skrivs tillsammans, och reglerna godkänner
bara kvittot om saldot ökar med exakt beloppet. Krockar (två flikar, två lärare)
körs om med `medKrockOmforsok` (`kc-omforsok.js`), och årskurskontots
coins-skrivning knyts till kvittot på samma sätt (`lastProvMynt` som Live:s
`lastLiveReceipt`, `gradeStudentDataOk`). Skillnaden: ett prov kan lämnas tillbaka
flera gånger, så kvittot är en **löpande summa** i stället för create-only:

- `studentData/{elev}/provMynt/{t}` `{ total, tillfalleId, classId, at, by }` –
  `total` får bara öka, högst 200 och högst vad tillfällets inställning ger.
  Kvittot ligger hos eleven, så att radera rättningen eller tillfället nollställer
  ingenting. Läraren raderar det aldrig.
- `rattning.myntUtbetalt` speglar `total` (det eleven ser: **"+36 mynt"** i
  resultatvyn). Bara utbetalningen ändrar det, ensamt och till exakt kvittots
  total; en vanlig sparning (hela dokumentet) får behålla eller utelämna det
  (ingen extra `get()` i batcharna).
- **Ångra tillbakalämning** rör varken kvittot eller `myntUtbetalt`. En ny
  tillbakalämning betalar `nytt belopp − total` om summan ökat, annars inget.
- **När**: rättningslagret betalar direkt efter tillbakalämningsbatchen
  (`lager.lamnaTillbaka` → `betalaMynt`), och igen när rättningsvyn öppnas för
  tillbakalämnade elever som inte fått allt (`lager.betalaKvar`, avbrott/nekad).
  Utfallet syns i sparraden; Per elev visar "N pluggmynt utbetalda".
- Reglerna (`provMyntKvittoOk`, `provMyntTakOk`, `provMyntFaltOk`,
  `provMyntBetalt`) kräver dessutom att rättningen är tillbakalämnad, att elevens
  `svar` är inlämnat (svar skapas bara av eleven själv i klassen) och att den som
  skriver har klassen – även admin. Eleven kan inte skriva kvittot.
- Precis som Live: årskurskontot får inte skapa `studentData`, så en elev utan
  dokument får mynten först när hen loggat in en gång (utbetalningen nekas och
  görs om nästa gång rättningen öppnas).

Förhandsvisning: `preview/preview-prov-rattning.html` (2 mynt per poäng; stubben
`prov-ratta-stubs/prov-mynt-data.js` kör den riktiga `betalaProvMynt` mot ett
minnes-SDK, saldot syns i kontrollraden). Skärmdumpar: `docs/qa-prov-746/`.

**Omprov (#748)**: ett omprov delar ursprungets kvitto. `betalaProvMynt` skriver
`provMynt/{omprovAv}` (inte `provMynt/{omprovet}`) med `senast` = omprovet, och
betalar bara det omprovets belopp överstiger kvittots `total` – ursprunget gav 20,
ett omprov värt 30 betalar 10, ett värt 15 betalar 0. Taket 200 gäller provet som
helhet. Reglerna (`provMyntKvittoOk`) läser rättning, svar och inställning från
`senast` och kräver att det är ett omprov av just kvittots tillfälle; ett kvitto
med ett omprovs eget id nekas alltid. `lastProvMynt` = ursprunget.
Omprovets `rattning.myntUtbetalt` speglar **provets sammanlagda** mynt (kvittots
total), även när omprovet självt betalade 0 – Per elev visar alltså "20
pluggmynt utbetalda" för provet, och `betalaKvar` försöker inte igen.
`omprovAv` sätts alltid till roten (omprov av ett omprov pekar på ursprunget) och
reglerna nekar ett `omprovAv` med annat prov, annan klass eller som självt är ett
omprov (`provOmprovAvOk`); det byts aldrig. Tester: `test/firestore-rules-prov-mynt-omprov.test.js`.

Läsningar/skrivningar per elev och utbetalning: 4 läsningar (kvitto, rättning,
svar, saldo) + 3 skrivningar i en transaktion. 25 elever = 100 + 75.

## Anpassningar (Etapp 2, #748, §14)

| Fil | Vad |
| --- | --- |
| `prov-anpassningar.js` | DOM-fri: `extraMin`, `tidsgransFor`, `gallerElev`, `tillfalleNamn`, `elevProvNamn`, `rensaExtraTid`, `omprovForval`, `flikbyteText` (`test/prov-anpassningar.test.js`) |
| `prov-anpassningar-falt.js` | lärarens fält: `extraTidFalt` (utfällbar, läser namnen först när den fälls ut) och `elevLista` (kryssruta + extra tid per elev) |
| `prov-anpassningar-rutor.js` | rutorna **Omprov** och **Extra tid** (översikten under provet) |

**Extra tid per elev.** `provTillfallen/{t}.extraTid: { [elevUid]: minuter }`
(heltal 1–240; +5 … +60 i listan). Sätts i **Kör i klass** och **Öppna**
("Extra tid för enskilda elever") och med knappen **Extra tid** i översikten
medan provet pågår (`sparaExtraTid` ersätter hela mapen). Elevens egen
tidsgräns är `tidsgransMin + extraTid[uid]` – i reglerna (`provElevMinuter`:
`startad + egen gräns + 2 min`), i elevens läge och nedräkning (`elevLage`,
`tidsgransFor`) och i lärarens "tid kvar". Utan tidsgräns gör extra tid
ingenting. Ett ogiltigt värde (text, > 240) räknas som 0, också i reglerna.
Eleven ser bara sin egen tid ("Du har 55 minuter") i gränssnittet. ⚠️ Känd
begränsning: `extraTid` (och omprovets `elevIds`) ligger på tillfället, som hela
klassen läser – en elev som öppnar utvecklarverktygen kan se vilka klasskamrater
som har extra tid. Spec §14 anger just den platsen; vill man dölja det flyttas
`extraTid` till ett dokument per elev (en `get()` till i `provSvarUpdateOk`).
Tar läraren bort extra tid från en elev som redan skrivit längre än den nya
gränsen + 2 min nekas elevens "tid"-inlämning en gång; provsidan visar då
"Tiden är slut" och det senast sparade gäller (inget nytt försök).
Ger läraren mer tid under provet når den eleven via lyssnaren
(`onProvChange`) – nedräkningen räknas om utan omladdning. Översikten visar
"+15 min" vid namnet och "Extra tid: Alva +15 min" i faktaraden; listan
"(2 med extra tid)".

**Omprov för valda elever.** Knappen **Omprov** på ett öppnat eller stängt
tillfälle skapar ett NYTT tillfälle av samma prov i samma klass med
`elevIds` och `omprovAv` = ursprunget (alltid roten, även för omprov av ett
omprov; pluggmynten delar ursprungets kvitto, se "Pluggmynt"). Förvalda är de som
inte skrev provet (`omprovForval`: inget svar, eller inlämnat av stängningen
utan ett enda svar); extra tid väljs på samma rad. Omprovet låser aldrig klassen
(fokusläget gäller hela klassen) – rutan har inget låsval. Listan och rubrikerna
visar **"Vikingaprovet – omprov (3 elever)"** (`tillfalleNamn`); översikten och
rättningen visar bara de valda eleverna. Eleven och statistiken ser
**"Vikingaprovet – omprov"** (`elevProvNamn`, även rättningens `provNamn`),
jämförelsen "4A – omprov", och omprovets resultat "Totalt N mynt för provet" (#749). Frågorna kopieras när omprovet öppnas,
precis som förut (provets senaste version).

- **Reglerna**: `provGallerElev` – med `elevIds` får bara eleverna i listan skapa
  och spara `svar` (dessutom som förut: medlem i klassen). `elevIds` byts aldrig.
- **Läsning – avsiktlig avvikelse från "reglerna kräver att eleven finns i
  listan"**: hela klassen kan fortfarande *läsa* omprovets tillfälle.
  Elevens lyssnare (`where classId in … + status == "oppet"`) kan inte filtrera
  på `elevIds`, och regler är inga filter – en läsregel på `elevIds` skulle
  neka hela frågan för alla elever. Tillfället saknar facit (det ligger i
  `privat/facit`), och eleverna utanför listan har redan skrivit samma prov.
  `prov-watch.js` filtrerar bort omprov som inte gäller eleven, så det syns
  varken i menyn eller på provsidan, och en direktlänk säger "Det här provet
  är inte öppet för dig".

**Flikbyten (bara information).** Provsidan räknar varje gång fliken döljs
(`visibilitychange` → `document.hidden`) medan provet pågår, också en omladdning.
Räknaren (`svar.flikbyten`) ligger i `localStorage` med svaren och följer med
**nästa vanliga sparning** och inlämningen – aldrig en egen skrivning per byte:
har eleven osparade svar sparas de direkt som förut, annars schemaläggs en
sparning inom 24 s-taket. Rättningen visar diskret "Lämnade provet 2 gånger"
under **Per elev** (med en förklaring vid hovring). Inget straffas, inget
påverkar poängen. Reglerna godtar ett heltal 0–10 000 och kräver inte att det
ökar (två flikar får inte få sparningen nekad).

Kostnad: extra tid 0 läsningar för eleven (fältet finns redan på tillfället),
läraren 1 skrivning per ändring och namnen (≤ 25 läsningar) bara om listan
fälls ut. Omprovet: klassens namn + ursprungets svar (≤ 50 läsningar) en gång.
Flikbyten: 0 extra skrivningar utöver autosparningens tak.

Förhandsvisning: `preview/preview-prov-tillfallen.html` (tf-oppet har Dante
+15 och Klara +10, ett stängt omprov för tre elever; Omprov och Extra tid
fungerar mot minnet), `preview/preview-prov-elev.html?extra=15` (55 minuter;
byt flik → "flikbyten" i kontrollraden), `preview/preview-prov-rattning.html?nollstall`
(Bo lämnade provet 2 gånger, under Per elev).

## Fördjupad statistik och utskrift (Etapp 2, #747, §12–§13)

Under rutnätet i fliken **Översikt** (rättningsvyn) – laddas med `import()` när
fliken ritas, inga nya filer i bootgrafen. Färg har alltid symbol och text.

| Fil | Gör |
| --- | --- |
| `prov-statistik-fordjupad.js` | ren logik: `perFragaStaplar`, `poangFordelning`, `nivaFordelning`, `jamforKlasser`, `resultatCsv`/`csvFalt`/`csvFilnamn` (test: `test/prov-statistik-fordjupad.test.js`) |
| `prov-fordjupad-vy.js` | verktygsraden (CSV, Skriv ut provet, Skriv ut resultat) och sektionerna under rutnätet; `skrivUtElever(v, uids)` |
| `prov-jamfor-data.js` | jämförelsens läsningar (först på knapptryck) |
| `prov-utskrift.js` / `prov-utskrift-papper.js` / `prov-utskrift.css` | utskriften (`.provl-ut-`) |

- **Per fråga – svårast först**: en staplad stapel per fråga med antal ✓ rätt,
  ½ delvis, ✗ fel, – obesvarade och ? ej rättade (siffran i segmentet) och
  andelen av poängen (samma tal som i rutnätets sista rad). Lägst andel överst,
  frågor utan något bedömt sist. Klick → frågan i Per fråga.
- **Fördelning**: tio staplar à 10 % (0–9 … 90–100 %, samma flyttalsregel som
  färgen) i provets gränsfärger med ✗/½/✓ under; ej rättade räknas för sig.
  Nivåerna (EG/G/MG/ingen) visas om provet har nivåer eller någon nivå är satt.
- **Jämför klasser**: knappen läser lärarens tillfällen (`listaTillfallen` med
  `filterClasses` – bara egna klasser, som Provtillfällen), behåller öppnade
  tillfällen av samma `provId` och läser `rattning` för vart och ett. Tabell:
  elever (rättade), snitt, fördelning och andel per fråga, med **det här**
  provets gränser i alla kolumner. En fråga som saknas i en äldre version → `–`.
  Inga nya regler eller index (`provId` filtreras i klienten för att slippa ett
  sammansatt index).
- **Exportera CSV**: en rad per elev (A–Ö), poäng per fråga (utan poäng:
  rätt/delvis/fel), Poäng, Av (rättade), Procent, Färg, Nivå, Status. Orättat =
  tomt. Semikolon, decimalkomma, BOM (åäö i Excel), CRLF; fält med `;` `"`
  radbrytning eller kantblanksteg citeras, text som börjar med `= + - @` får en
  apostrof (formelskydd). Filnamn "Prov – Klass.csv". Riktiga namn även med
  "Dölj namn" på (`v.riktigtNamn`) – det är lärarens egna anteckningar.
- **Skriv ut provet** (Översikten, Mina prov 🖨 och redigeraren): rubrik,
  namnrad (Namn/Klass/Datum), "Provet ger högst N p", frågorna med svarsyta per
  typ – ○/☐ att kryssa, linjer för kortsvar och luckor (numrerade), bokstäver
  för para, rutor för ordna, 6–16 linjer för fritext efter poängen, textblocken
  inramade. En okänd typ får skrivlinjer. Kryssrutan **Skriv ut facit på ett
  eget blad** (av som standard) lägger facit (para med bokstäverna, fritext med
  bedömningsstödet) efter en sidbrytning.
- **Skriv ut resultat** (Översikten = alla inlämnade, elevvyn 🖨 = en elev): en
  elev per sida – totalen "✓ 18 av 24 p · 75 % · Grön", nivån, helhetskommentaren,
  varje fråga med elevens svar (typens `renderRattning`), bedömningen ✓/½/✗ med
  text och poäng, kommentaren; **Med facit** (förvalt enligt `visaFacit`).
  Orättade frågor står som "? Inte rättad".
- Utskriften följer `teacher-login-print.js`: helskärmsvy med verktygsrad och
  vita A4-blad, `@media print` med `@page { size: A4 portrait }` som döljer allt
  annat. ⚠️ Inloggningskortens print-regel i `styles.css` döljer alla andra barn
  till `body` – `prov-utskrift.css` vinner med `html body > div.provl-utskrift`.

**Läsningar**: allt utom jämförelsen räknas ur rättningsvyns laddning (0 extra).

⚠️ **Avvikelse från spec §12 ("inga extra läsningar")** – godkänd av epic-leaden:
jämförelsen behöver de ANDRA klassernas rättningar, och de är inte inlästa i
rättningsvyn (den läser bara sin egen klass). Därför läser den **bara på knapptryck**
("Jämför med mina andra klasser") och lägger **aldrig** till läsningar när
Översikten ritas normalt. Inga lyssnare. Kostnad per klick: **1 fråga**
`listaTillfallen` (en läsning per tillfälle i lärarens klasser, som listan
Provtillfällen; en fråga per 30 klasser) **+ ett `rattning`-dokument per elev i
varje jämfört tillfälle** – t.ex. 3 andra klasser × 25 elever ≈ 75 läsningar.
Resultatet cachas (`v.stat.jamfor`) resten av vyn: gränsreglagen och omritningar
läser inte igen.

Förhandsvisning: `preview/preview-prov-fordjupad.html` (#742:s stubbar +
`preview/prov-fordjupad-stubs/prov-jamfor-data.js` med 4A och 4C; `?pv=prov`,
`?pv=facit`, `?pv=resultat` öppnar utskriften direkt, t.ex. för
`chromium --headless --print-to-pdf`).

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
Pluggmynten (#746) kräver bara regel-deployen – innan dess nekas utbetalningen
och görs om när rättningen öppnas efter deployen.
Inställningarna per prov (#759) kräver regel-deployen för valideringen av
`stavfel`/`granser` (`provInstOk`). Ordningen spelar ingen roll: de gamla
reglerna godtar vilken `installningar`-map som helst, och de nya godtar allt
den nya och den gamla webben skriver (utom ett gammalt reglage som drogs till
gul 0 – det nekas och visas som sparfel).
Halvpoäng/avsnitt/kriterier (#762) kräver regel-deployen för `rattning.kriterier`
(de gamla reglerna nekar fältet – en tillbakalämning med "Visa poängkriterierna"
skulle nekas) och valideringen av `visaPoangForElev`/`visaKriterier`. Deploya
reglerna FÖRE webben; de nya reglerna godtar allt den gamla webben skriver.
Anpassningarna (#748) kräver regel-deployen: innan den nekas varje sparning med
`flikbyten` (den gamla `validSvarFalt` känner inte fältet) och extra tid
förlänger inte reglernas gräns. Deploya reglerna FÖRE webben.
