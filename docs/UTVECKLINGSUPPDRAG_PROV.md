# UTVECKLINGSUPPDRAG: PROV – SKAPA, SKRIVA, RÄTTA OCH LÄMNA TILLBAKA

**Uppdrag till AI-utvecklingsteamet**

Lärarna ska kunna göra prov i Pluggporten:

- **Skapa** ett prov med blandade frågetyper.
- **Öppna** det för en klass. Eleverna skriver provet på sajten.
- **Rätta** det på lärarsidan. Frågor som kan rättas automatiskt får ett **förslag** på rättning, och fritextfrågor rättar läraren själv.
- **Lämna tillbaka** provet till en elev i taget eller till alla. Först då ser eleven sitt resultat.

Proven ska kännas lugna och seriösa: inga spel, inga ljud och inga belöningar under själva provet.

**Detta är ett implementeringsuppdrag i två etapper.**

- **Etapp 1** är kärnan: skapa, skriva, rätta och lämna tillbaka. Den ska byggas, testas och användas på riktigt innan **Etapp 2** påbörjas.
- **Etapp 2** innehåller det som gör proven smidigare: hämta frågor från ett Plugga-område, mynt, statistik, utskrift och anpassningar.

---

# 0. LÄS FÖRST

- `docs/BEHORIGHETER.md`, `firestore.rules` (rad 11–91): `hasClass()`, `hasStudent()`, `isSelf()`, `isClassMember()`, `isAdmin()` och `isGradeTeacher()`.
- `src/teacher-role-core.js`: `canEditArea`, `withOwner` och `filterClasses`. Proven ska följa **samma mönster för ägarskap** som områdena.
- `src/teacher-shared.js`: `TEACHER_GROUPS` och `TEACHER_TABS`. `app.js` registrerar flikarna automatiskt.
- `src/gamemode-visibility.js`: `STUDENT_MODULES`. `src/ui.js`: `NAV_LANKAR` och `NAV_VILLKOR`.
- `src/live/live-watch.js`: `liveVisibleFor`. Det är mönstret för "visa länken bara när något pågår".
- `docs/FOKUSLAGE.md`, `src/class-lock.js`, `src/teacher-class-lock.js` och `validLockShape` i `firestore.rules`.
- `src/validate.js` och `src/validate-timeline.js`: felmeddelanden på svenska som säger var felet är ("Fråga 3: …").
- `src/prompt-parts.js` och `src/prompts.js`: flödet där läraren kopierar en prompt och klistrar in JSON.
- `src/teacher-area-items-forms.js` och `src/teacher-area-items-ops.js`: de manuella formulären och den DOM-fria logiken.
- `src/live/formats/snilleblixt/snilleblixt-poang.js` (`normFree`) och `src/rakna-core.js` (`normText`): hur fria svar normaliseras i dag.
- `src/teacher-login-print.js`: mönstret för utskrift (Etapp 2).
- Lärarvyernas kommentarer om kvoten (#114/#231) i `teacher-class.js` och `teacher-lasresan.js`, samt `test/RAPPORT-231.md`.

**Regler:**

- **Bootgrafen (#271):** inga nya filer får importeras statiskt från bootgrafen. Allt nytt ligger i `src/prov/` och laddas med `import()`. Lägg till ett källkodstest av samma slag som i `test/ekvationsresan-larare.test.js`.
- **Namnkrock:** Hitta rätt! använder redan namnen `provspel`, `?prov=`, `.lhr-prov` och `.hr-spel-prov`. Använd inte dem. Använd prefixet `prov-` eller mappen `src/prov/`, och CSS-klasser som börjar med `.provv-` (elev) och `.provl-` (lärare).
- **Behörigheter:** varje ny samling och varje ny callable ska in i tabellerna i `docs/BEHORIGHETER.md`. Det testet (`test/behorigheter-doc.test.js`) annars fallerar.
- **Regeltester:** varje ny testfil för reglerna ska in i listan `test:rules` i `package.json`.

---

# ETAPP 1 – KÄRNAN

## 1. Ord och begrepp

| Ord | Betyder |
| --- | --- |
| **Prov** | Själva provet: frågorna, facit och inställningarna. Det ägs av läraren som skapade det och kan användas i flera klasser. |
| **Provtillfälle** | Ett prov som körs i **en** klass vid ett visst tillfälle. Där finns elevernas svar och lärarens rättning. |
| **Svar** | Det en elev har skrivit på ett provtillfälle. |
| **Rättning** | Lärarens bedömning av en elevs svar: poäng, rätt eller fel, kommentarer och nivå. |
| **Lämna tillbaka** | Läraren gör rättningen synlig för eleven. |

## 2. Frågetyperna

Alla frågetyper ska kunna **blandas fritt** i samma prov. Bygg dem som ett **register**, `src/prov/prov-fragetyper.js`, där varje typ är ett objekt:

```js
{
  id: "kortsvar",
  namn: "Kort svar",
  autoratt: true,                 // kan få ett automatiskt rättningsförslag
  validera(fraga) {},             // → { ok, fel: [] } – svenska felmeddelanden
  utanFacit(fraga) {},            // → det eleven får se (facit borttaget)
  tomtSvar() {},                  // → startvärde för elevens svar
  arBesvarad(svar) {},            // → true/false (för "3 obesvarade")
  forslag(svar, facit, fraga) {}, // → { poang, maxPoang, ratt: true|false|"delvis" } eller null
  renderElev(...) {},             // elevens svarsruta
  renderRattning(...) {},         // lärarens vy av svaret + facit
  renderResultat(...) {},         // elevens vy efter tillbakalämning
}
```

**Målet är att en ny frågetyp ska kräva en rad i registret och en ny fil, och ingenting annat.** Det är viktigt eftersom nya typer snart kommer, till exempel "skriv om meningen rätt" och glosor till kommande språklägen.

### 2.1 Typerna i Etapp 1

| Typ | Eleven gör | Facit | Automatisk rättning |
| --- | --- | --- | --- |
| `flerval` | Väljer **ett** alternativ (2–6 st) | Index för rätt alternativ | Ja |
| `flerval-flera` | Kryssar **alla** rätta alternativ | Lista med index | Ja. Delpoäng: rätt kryss minus fel kryss, aldrig under 0 |
| `santfalskt` | Väljer Sant eller Falskt | true eller false | Ja |
| `kortsvar` | Skriver ett ord, tal eller kort fras (högst 100 tecken) | **Lista** med godkända svar | Ja, efter normalisering (se 2.4) |
| `lucktext` | Fyller i luckor i en text, skrivna som `[[svar]]` eller `[[svar\|annat svar]]` | Godkända svar per lucka | Ja, per lucka. Delpoäng per lucka |
| `para` | Parar ihop begrepp och förklaringar (3–10 par) | Paren | Ja. Delpoäng per rätt par |
| `ordna` | Sätter saker i rätt ordning (3–10 st), till exempel händelser i tid eller steg i en process | Rätt ordning | Ja. Delpoäng per sak på rätt plats |
| `fritext` | Skriver ett längre svar (högst 4000 tecken, med en teckenräknare) | Valfritt **bedömningsstöd** som bara läraren ser: ett exempelsvar och/eller **poängkriterier** (se 2.2) | **Nej**. Läraren rättar alltid |
| `text` | *Ingen fråga.* Ett textblock som frågorna efter refererar till, till exempel för läsförståelse eller en källa | – | – |
| `avsnitt` | *Ingen fråga.* En rubrik som delar in provet i delar, till exempel "Del 1 – Begrepp" eller "Del 2 – Skriv och förklara", med en valfri instruktion till eleven | – | – |

**Alla frågor:**

- har `id`, `typ` och `fraga` (frågetexten; `text`-blocket har i stället `titel` och `brodtext`)
- har `poang`, maxpoängen för frågan (se 2.2)
- kan ha `hjalptext`, som eleven ser under frågan

### 2.2 Poäng

- **Halvpoäng:** maxpoängen per fråga sätts av läraren i steg om **0,5**, från 0,5 till 20 och med 1 som standard. En skrivfråga kan alltså vara värd 4 poäng och en flervalsfråga 1.
- **Vid rättningen** kan läraren ge **valfri poäng i steg om 0,5** mellan 0 och maxpoängen. En fråga värd 4 poäng kan alltså få 3,5.
- **Lagras som tal** (`3.5`), men visas med svenskt decimalkomma överallt ("3,5 p", "17,5 av 24 poäng").
- **Kontrollera med test** att summor av halvpoäng aldrig ger avrundningsfel som "17.499999". Räkna internt i halva poäng som heltal, eller avrunda till närmaste 0,5 efter varje summering.
- **Delpoäng från automatiken** avrundas **nedåt** till närmaste 0,5. Exempel: en para-fråga värd 2 poäng med 3 av 5 par rätt ger 2 × 3/5 = 1,2, vilket blir **1 p**.
- **Poängkriterier för fritextfrågor (valfritt):** läraren kan skriva en lista, till exempel:
  - "1 p: nämner en orsak"
  - "2 p: nämner två orsaker"
  - "+1 p: förklarar varför"
  - "+1 p: använder begreppen handel och plundring"

  Kriterierna visas för läraren bredvid svaret vid rättningen. Det är bara stöd, och läraren sätter poängen själv. Om läraren väljer det visas de också för eleven i resultatvyn efter tillbakalämningen.
- **Eleven ser poängen under provet:** frågan visar sin maxpoäng ("(4 p)") och överst står provets totala maxpoäng ("Provet ger högst 32 poäng"). Läraren kan stänga av det per prov med `visaPoangForElev`, som är på som standard.

### 2.3 Provets struktur

- **Avsnitt:** ett prov kan delas in med `avsnitt`-block. Frågorna numreras **löpande genom hela provet** (1, 2, 3 …), inte om från början i varje avsnitt.
- **Elevens sida:** varje avsnitt visas som en tydlig rubrik med instruktionen under. Frågelistan i sidan grupperas per avsnitt.
- **Rättning och statistik:** avsnitten syns som grupper. Statistiken visar även **poäng per avsnitt**, till exempel "Del 1: 8 av 10 · Del 2: 9,5 av 14", så att läraren ser om det var faktakunskaperna eller skrivandet som var svårt.
- **Redigeraren:** avsnitt läggs till som en "fråga" och kan flyttas som de andra korten. Varje avsnitt visar sin poängsumma, och summan för hela provet syns överst ("12 frågor · 32 p").

### 2.3.1 Ordna och para ihop: få tryck

Ordningsfrågor får inte kräva många tryck på pilar upp och ned. Bygg dem så här:

**`ordna` för eleven: "tryck i tur och ordning"**

```
Sätt händelserna i rätt ordning – tryck på den som kom först, sen nästa …

Ditt svar:   1. Vikingatiden börjar      ← tryck för att ta bort
             2. Birka grundas
             3. ___
             4. ___

Kvar:  [ Sverige blir kristet ]  [ Slaget vid Svolder ]
```

- **Sakerna ligger blandade i en ruta, "Kvar".** Ett tryck på en sak lägger den på **nästa lediga plats** i svaret. Med 5 saker räcker alltså 5 tryck för att svara.
- **Ett tryck på en sak i svaret** lägger tillbaka den bland "Kvar", och sakerna under flyttar upp ett steg.
- **Med mus eller finger** går det också att **dra** en sak till en annan plats i svaret. Dra och släpp är ett extra sätt, inte det enda.
- **Knappen "Börja om"** lägger tillbaka allt i rutan "Kvar".
- **Tangentbord:** Tab till en sak och Enter för att lägga till eller ta bort den.
- **Frågan räknas som besvarad** först när alla platser är fyllda. Annars visas "3 av 5 placerade".
- **Stora tryckytor**, minst 44 px höga.

**`para` för eleven: tryck på två saker**

- **Para ihop:** tryck på ett begrepp till vänster och sedan på en förklaring till höger. De två får samma färg och samma siffra, med en tunn linje mellan dem.
- **Ett tryck på ett par** tar isär det.
- **Dra ett begrepp till en förklaring** fungerar också.
- **Två tryck per par** och inga menyer.

**Redigeraren för läraren**

- **Ordningsfrågor:** läraren skriver sakerna **i rätt ordning**, en per rad. Det är facit. Eleverna får dem i blandad ordning, som är olika för varje elev men densamma om eleven laddar om sidan.
- **Para ihop:** läraren skriver paren rad för rad, som "begrepp – förklaring". Eleverna får förklaringarna i blandad ordning.
- **Flytta frågor i provet:**
  - **Dra i handtaget ⋮⋮** på frågekortet.
  - **Skriv en ny plats:** knappen "Flytta till…" öppnar ett litet fält där läraren skriver till exempel "3". Frågan hamnar då där med **ett** tryck, i stället för många klick på upp och ned.
  - **Tangentbord:** Alt + pil upp eller ned flyttar frågan ett steg.

### 2.4 Kortsvar och luckor: normalisering

- **Standard:** jämför efter normalisering:
  - NFC
  - trimma och slå ihop mellanslag
  - gemener
  - ta bort en punkt sist
  - decimalkomma och decimalpunkt räknas som samma sak, och "7" ska bli rätt mot "7,0"
- **Läraren kan välja per fråga:**
  - **"Exakt stavning krävs"** (på som standard). Är det avstängt räknas även ett svar som skiljer sig med **en** bokstav, och då blir förslaget **"delvis"**. Lägg en liten, testad Levenshtein-funktion i `prov-rattning.js`. Någon sådan finns inte i projektet i dag.
  - **"Stor och liten bokstav spelar roll"** (av som standard). Det behövs till exempel i ett svenskaprov om egennamn.
- **Automatiken ger alltid ett förslag och aldrig ett slutgiltigt beslut.** Läraren kan ändra allt (se 6).

### 2.5 Validering

Skriv `validateProv(obj)` i `src/prov/prov-validera.js`. Den ska bete sig som `validateArea`: returnera `{ ok, errors, warnings, value }`, ge svenska fel med plats ("Fråga 4 (Kort svar): minst ett godkänt svar krävs") och anropa varje typs `validera`.

Gränser:

- högst 60 frågor
- poäng per fråga: 0,5–20 i steg om 0,5
- frågetexten högst 1000 tecken
- `text`-blocket högst 6000 tecken
- provnamnet 1–80 tecken

## 3. Datamodellen

```
prov/{provId}                          ← läraren (ägaren). Innehåller FACIT.
  namn, beskrivning?, amne?, arskurs?
  fragor: [ ...frågor med facit... ]
  installningar: {
    poang: true|false,          // poängsätta? (av → bara rätt/fel/delvis + kommentar)
    visaPoangForElev: true,     // visa "(4 p)" per fråga och totalen för eleven
    nivaer: true|false,         // använda nivåerna EG / G / MG?
    visaFacit: true|false,      // visa facit vid tillbakalämning (standard: true)
    stavningskontroll: false,   // webbläsarens stavningskontroll i elevens svarsrutor
    tidsgransMin: null|number   // standard för nya tillfällen (5–240)
  }
  createdBy, createdByName, skapad, uppdaterad

provTillfallen/{tillfalleId}           ← ett prov i en klass
  provId, provNamn, classId, createdBy, createdByName
  status: "forberett" | "oppet" | "stangt"
  fragor: [ ...UTAN facit... ]         // kopieras från provet när provet öppnas
  installningar: { ...kopia... }
  tidsgransMin: null|number
  oppnad?, stangd?

provTillfallen/{t}/privat/facit        ← bara lärare med hasClass(classId)
  facit: { [fragaId]: ... }, bedomningsstod: { [fragaId]: "..." }

provTillfallen/{t}/svar/{elevUid}      ← eleven skriver, läraren läser
  elevId, classId, startad (serverTime), uppdaterad,
  svar: { [fragaId]: ... }, inlamnad: bool, inlamnadAt?, inlamnadNar: "elev"|"tid"|"stangt"

provTillfallen/{t}/rattning/{elevUid}  ← läraren skriver, eleven läser EFTER tillbakalämning
  elevId, classId, provNamn,
  fragor: { [fragaId]: { poang?, ratt?: true|false|"delvis", kommentar?, auto: bool } },
  totalPoang?, maxPoang?, niva?: "EG"|"G"|"MG"|null, helhetskommentar?,
  aterlamnad: bool, aterlamnadAt?,
  facit?: { ... }                       // kopieras in vid tillbakalämning om visaFacit
```

- **Facit lämnar aldrig lärarens dokument** förrän provet har lämnats tillbaka. Eleverna kan alltså inte hitta facit i nätverkstrafiken.
- **Ett prov kan köras i flera klasser.** Varje klass får ett eget provtillfälle.
- **Raderas ett tillfälle** raderas också alla svar och rättningar till det. Använd en callable eller en klientbatch och redovisa vilket ni valde. Läraren får frågan "Radera provtillfället och alla elevsvar? Det går inte att ångra." som en ruta på sidan, inte med `confirm()`.

## 4. Firestore-reglerna

**`prov/{id}`**

- **Läsa:** lärare. Årskurslärare får läsa alla prov, så att de kan kopiera kollegors prov, precis som med områden.
- **Skapa:** lärare, och `createdBy` måste vara den egna uid:n.
- **Ändra och radera:** bara ägaren eller admin.
- **Elever får aldrig läsa provet.**

**`provTillfallen/{t}`**

- **Läsa:**
  - en lärare med `hasClass(classId)`
  - en elev med `isClassMember(classId)`, men bara när status är `"oppet"` eller `"stangt"`
  - ett tillfälle som är `"forberett"` kan eleverna inte se
- **Skapa och ändra:** en lärare med `hasClass(classId)`. Bara tillåtna statusövergångar: `forberett → oppet → stangt`, och `stangt → oppet` för att öppna igen.

**`privat/facit`**

- Bara en lärare med `hasClass(classId)`.

**`svar/{elevUid}`**

- **Skapa:** bara `isSelf(elevUid)` och bara när:
  - eleven är medlem i klassen
  - tillfället är `"oppet"`
  - `startad == request.time`
- **Ändra:** bara eleven själv, och bara när:
  - tillfället fortfarande är `"oppet"`
  - `inlamnad` var `false`
  - tidsgränsen inte har passerats, `request.time <= startad + tidsgransMin + 2 min` (2 minuters marginal). Utan tidsgräns gäller bara villkoren ovan.
- **Fält som inte får ändras:** `elevId`, `classId` och `startad`.
- **Efter inlämning:** `inlamnad` får bara gå från `false` till `true`, och sedan får eleven inte ändra något mer.
- **Storlek:** begränsa dokumentet. `svar` får ha högst 60 nycklar och fritextsvar högst 4000 tecken. Kontrollera det i reglerna så långt det går, och annars i klienten.
- **Läsa:** eleven själv och en lärare med `hasClass(classId)`.
- **Läraren** får markera `inlamnad: true, inlamnadNar: "stangt"` när provet stängs (se 5.4), men **får inte ändra elevens svar**.

**`rattning/{elevUid}`**

- **Skriva:** bara en lärare med `hasClass(classId)`.
- **Läsa:** läraren, och eleven själv (`isSelf`) **bara när `aterlamnad == true`**.

**Fokusläget**

- Lägg till målet `"prov"` i `validLockShape`.
- För typen `"prov"` ska `mal.id` krävas, och det ska vara id för ett tillfälle (fler än 2 tecken), precis som för `"omrade"`.

Skriv regeltester i `test/firestore-rules-prov.test.js`, med `createRollerEnv`, för:

- eleven läser ett tillfälle i sin egen klass men inte i en annan klass
- eleven kan inte läsa ett tillfälle som är `"forberett"`
- eleven kan inte läsa `facit`, `prov/{id}` eller andra elevers svar och rättningar
- eleven kan inte skriva efter inlämning, efter tidsgränsen eller när provet är stängt
- eleven kan inte läsa sin rättning före tillbakalämningen
- en årskurslärare kan inte läsa eller rätta tillfällen i andra klasser
- läraren kan inte ändra elevens svar

## 5. Provtillfället

### 5.1 Lärarsidan: ny grupp "Prov"

Lägg till en egen grupp, **Prov**, i `TEACHER_GROUPS` med två flikar:

- **"Mina prov"** listar prov: namn, antal frågor, senast ändrat och ägare. Här finns knapparna **Nytt prov**, **Redigera**, **Kopiera**, **Radera** och **Kör i klass**. Årskurslärare ser sina egna prov och kan kopiera andras, enligt samma regler som för områden.
- **"Provtillfällen"** listar tillfällen per klass. Läraren ser bara sina egna klasser.
  - **Status** visas med en etikett: *Förberett*, *Öppet* eller *Stängt*.
  - **Rättningen** visas som "18 av 24 rättade" och "Tillbakalämnat: 0 av 24".
  - **Knappar:** Öppna, Stäng, Rätta och Radera.

### 5.2 Öppna provet

**Kör i klass** skapar ett tillfälle i status `"forberett"`. En ruta frågar:

- **Klass:** bland lärarens egna klasser.
- **Tidsgräns:** "Ingen" eller ett antal minuter.
- **Lås klassen till provet:** på som standard. Då används fokusläget med målet `{typ:"prov", id: tillfalleId, namn: provNamn}`, och låset gäller till det klockslag läraren väljer. Standard är tidsgränsen plus 10 minuter, annars 60 minuter.
- **Öppna nu**, eller **Spara och öppna senare**.

När provet öppnas:

- Frågorna kopieras **utan facit** till tillfället (med `utanFacit`).
- Facit och bedömningsstödet skrivs till `privat/facit`.
- Status sätts till `"oppet"` och `oppnad` till serverns tid.
- Fokusläget sätts, om det är valt.

### 5.3 Lärarens översikt under provet

Medan provet pågår ser läraren en tabell över eleverna:

- namn
- status: *Inte börjat*, *Skriver* eller *Inlämnat*
- besvarade frågor, till exempel "7 av 12"
- tid kvar, om det finns en tidsgräns

Uppdatera **var 60:e sekund och med knappen "Uppdatera nu"**. **Använd ingen `onSnapshot` på svaren**: varje sparning i bakgrunden skulle då kosta en läsning för läraren. Räkna ut och redovisa hur många läsningar ett prov på 40 minuter med 25 elever kostar (se 9.1).

### 5.4 Stäng provet

**Stäng provet** sätter status till `"stangt"` och tar bort fokusläget, om det sattes av provet. Alla svar som inte har lämnats in markeras som inlämnade med `inlamnadNar: "stangt"`. Elevens senast sparade svar gäller.

Läraren kan **öppna igen** vid behov, till exempel om provet stängdes av misstag.

### 5.5 Eleven

**Navigering:**

- Lägg till modulen `prov` i `STUDENT_MODULES` med `villkor: "prov"` och `toggle: false`. Den ska inte kunna stängas av, eftersom länken bara syns när något finns att visa.
- `NAV_VILLKOR.prov` är sant när:
  - elevens klass har ett tillfälle med status `"oppet"`. Använd samma mönster som `live-watch.js`: **en** `onSnapshot` med `where("classId","in", classIds)` och `where("status","==","oppet")`.
  - eller eleven har en rättning som har lämnats tillbaka de senaste 14 dagarna. Det kollas med **ett** `getDocs` per inloggning: en collection group-fråga på `rattning` med `elevId == uid`, `aterlamnad == true`, sorterad på `aterlamnadAt`, `limit(10)`. Lägg till index och regel för collection group-frågan.
- Länken heter **"Prov"** och har emojin 📝. Den ligger överst i gruppen "Öva" i sidomenyn (se `UTVECKLINGSUPPDRAG_PLUGGA_DESIGN.md`).
- Är klassen låst till provet hamnar eleven direkt i provet (`lockHomeHash`).

**Sidan "Prov"** (`#/elev/prov`):

- **Pågående prov:** ett kort med provets namn, antal frågor, eventuell tidsgräns och knappen **Starta provet**. Har eleven redan börjat står det **Fortsätt provet**.
- **Tillbakalämnade prov:** namn, datum och resultat. Ett klick öppnar resultatet (se 7).

**Själva provet** (`#/elev/prov/skriv?t=<tillfalleId>`):

- **Lugn design:** vit panel, stor och tydlig text och inga spelinslag.
- **Sidan:**
  - **Överst:** provets namn och, om det finns en tidsgräns, en **nedräkning** ("23 min kvar"). Nedräkningen blir gul vid 5 minuter kvar och röd vid 1 minut.
  - **Alla frågor** på en sida som man scrollar, numrerade 1, 2, 3 osv. `text`-block får inget nummer.
  - **Till höger**, på smala skärmar överst, en liten **frågelista** som visar besvarade och obesvarade frågor. Den går att klicka för att hoppa till en fråga.
  - **Knappen "Lämna in"** längst ner.
- **Webbläsaren:** `spellcheck`, `autocorrect`, `autocapitalize` och `autocomplete` följer provets inställning `stavningskontroll`, som är **av** som standard. Ett stavningsprov med stavningskontroll vore meningslöst.
- **Sparning:**
  - Svaren sparas **automatiskt**, högst var 4:e sekund efter en ändring, och direkt när eleven lämnar en svarsruta eller byter fråga.
  - En liten text visar "Sparat 10:42" eller "Sparar…".
  - Svaren sparas även i `localStorage` (inom try/catch). Det betyder att en omladdning eller en krasch aldrig tappar något.
  - Misslyckas sparningen visas **"Kunde inte spara – kontrollera internet. Dina svar finns kvar här."**, och sajten försöker igen.
- **Tidsgränsen:**
  - Räkna från `startad` med serverns tid (`serverNow`).
  - När tiden är slut sparas det sista och provet lämnas in automatiskt (`inlamnadNar: "tid"`).
  - Eleven ser "Tiden är slut – ditt prov är inlämnat."
- **Lämna in:** en ruta på sidan (inte `confirm()`) säger:
  - "Du har svarat på 10 av 12 frågor."
  - "Fråga 4 och 9 är obesvarade."
  - knapparna "Gå tillbaka" och "Lämna in".
- **Efter inlämningen** visas "Ditt prov är inlämnat! Din lärare rättar det och lämnar tillbaka det sen."
- **Provet ger inga mynt, stjärnor eller XP**, och inga spelljud.

## 6. Rättningen

Rättningsvyn (`#/larare/prov/ratta?t=<tillfalleId>`) har två lägen, med flikar.

### 6.0 Rätta allt som kan rättas automatiskt, med en knapp

Överst i rättningsvyn, och i översikten över tillfället, finns knappen **"Rätta alla automatiska frågor"**. Den rättar **alla frågor som kan rättas automatiskt, för alla elever, på en gång**:

- **Säkra fall godkänns direkt:**
  - flerval, flera rätt och sant/falskt
  - para ihop och ordna, med delpoäng enligt 2.2
  - kortsvar och luckor som stämmer **exakt** med facit efter normaliseringen
- **Osäkra fall lämnas åt läraren:** kortsvar och luckor som bara **nästan** stämmer (en bokstav fel, när exakt stavning inte krävs) och svar som inte stämmer med facit men kanske ändå är rätt. Det gäller till exempel ett kortsvar som inte finns i listan med godkända svar. Rimliga gränsfall ska inte markeras som fel automatiskt.
  - **Där svaret inte stämmer alls**: om läraren har valt "Fel svar på kortsvar rättas som fel" (på som standard) markeras det som fel. Annars lämnas det åt läraren.
- **Fritextfrågor rörs aldrig.**
- **Frågor som läraren redan har bedömt** skrivs inte över. Läraren behöver alltså inte vara rädd att knappen förstör hens egen rättning.
- **Rättningen** markeras `auto: true` och syns med en liten etikett "Auto" i vyn. Läraren kan ändra den som vanligt.
- **Efteråt** visas en sammanfattning, till exempel:
  - "312 svar rättades automatiskt."
  - "9 kortsvar behöver din bedömning." (med länk till dem)
  - "24 fritextsvar väntar på rättning."
- **Knappen går att trycka igen**, till exempel om läraren har lagt till ett nytt godkänt svar i facit. Då rättas bara de svar som inte har bedömts manuellt.
- **Facit kan kompletteras i efterhand:** i rättningsvyn kan läraren lägga till ett godkänt svar ("Godkänn även 'Björkö'"). Det sparas i `privat/facit` och används nästa gång knappen trycks.
- **Sparningen:** allt skrivs i **en** batch per elev, med högst 500 skrivningar per batch. Det blir alltså ungefär en skrivning per elev, inte en per fråga.

### 6.1 Per fråga (standardläget, går snabbast)

- **Visningen:** en fråga i taget, med facit och bedömningsstöd överst och **alla elevers svar** under.
- **Automatiska förslag:**
  - Frågor som kan rättas automatiskt är **förifyllda** med förslaget, markerat "Auto".
  - Knappen **"Godkänn alla förslag på den här frågan"** godkänner dem i ett svep.
- **Kortsvar och luckor:** **identiska svar grupperas** efter normalisering, till exempel "Birka – 12 elever" och "Bjärka – 1 elev". Läraren bedömer gruppen en gång och bedömningen gäller alla i gruppen.
- **För varje svar:**
  - rätt, delvis eller fel, med stora knappar
  - poäng, om provet poängsätts: ett sifferfält i steg om 0,5 och snabbknappar för 0, ½, 1, 1½ … upp till max. För frågor värda mer än 6 poäng ersätts snabbknapparna av knapparna − och + i steg om 0,5. Poängen kan inte bli högre än max eller lägre än 0.
  - för fritextfrågor visas poängkriterierna (2.2) bredvid svaret
  - en kommentar (valfri)
- **Tangentbord:** 1 = rätt, 2 = delvis, 3 = fel, Tab = nästa elev, N = nästa fråga, + och − ändrar poängen med 0,5.
- **Poäng och markering hänger ihop:** full poäng blir "rätt", 0 blir "fel" och allt däremellan blir "delvis". Läraren kan ändra markeringen själv. Om provet inte poängsätts gäller bara markeringen.
- **Namn kan döljas** för opartisk rättning (en kryssruta "Dölj namn"). Då visas eleverna som Elev 1, Elev 2 osv.

### 6.2 Per elev

- **Visningen:** en elev i taget med hela provet, och samma rättningsfält som per fråga.
- **Längst ner:**
  - **totalen**, uträknad automatiskt
  - **nivå**, om provet använder nivåer: *Ej godtagbart*, *Godtagbart*, *Mer än godtagbart* eller *Ingen nivå*. Läraren väljer själv, och det är alltid frivilligt.
  - **helhetskommentar**
- **Bläddra:** knapparna "Föregående elev" och "Nästa elev".

### 6.3 Sparning och status

- **Rättningen sparas automatiskt**, med samma slags avvägning mellan sparningar som för eleven.
- **Status per elev:**
  - *Ej rättad*
  - *Delvis rättad*
  - *Rättad*: alla frågor har en bedömning
  - *Tillbakalämnad*
- **Automatiska förslag sparas** med `auto: true` tills läraren godkänner eller ändrar dem.
- **Läsningar:** ladda **en gång** när vyn öppnas, det vill säga tillfället, facit, alla `svar` och alla `rattning` för klassen. Inga lyssnare.

## 7. Lämna tillbaka

- **Lämna tillbaka** finns per elev (i lägget Per elev) och som **"Lämna tillbaka till alla rättade"** i översikten.
- **Elever som inte är färdigrättade** hoppas över, och läraren ser hur många det gäller ("3 elever är inte färdigrättade och lämnas inte tillbaka än").
- **Vid tillbakalämning:**
  - `aterlamnad` blir `true` och `aterlamnadAt` får serverns tid.
  - Har provet `visaFacit` kopieras facit in i elevens rättningsdokument.
  - Låt läraren ändra valet "Visa facit" i rutan innan tillbakalämningen, med provets inställning som förval.
- **Ångra tillbakalämning** (per elev) sätter `aterlamnad` till `false` igen. Ta i så fall också bort `facit` från dokumentet.

**Elevens resultatvy** (`#/elev/prov/resultat?t=<tillfalleId>`):

- **Överst:** provets namn och datum.
- **Resultatet:** totalpoäng ("18 av 24 poäng") om provet poängsätts, och nivån om läraren har satt en.
- **Lärarens helhetskommentar.**
- **Varje fråga med:**
  - elevens svar
  - en markering för rätt, delvis eller fel och eventuella poäng
  - lärarens kommentar
  - facit, om det visas
- **Färgerna:** grönt för rätt, gult för delvis och en mjuk röd för fel, aldrig skrikigt. Markeringarna är ikoner med text, så att de inte bara bygger på färg.
- **Uppmuntrande ton** utan skam. Inga fyrverkerier.

## 7.5 Enkel statistik: hela klassen och en elev

Läraren ska snabbt se hur det gick, med **grönt, gult och rött**. Allt räknas ut ur de data som redan har lästs in för rättningen (se 6.3), så det blir inga extra läsningar.

### Färgerna

**Per fråga och elev:**

| Färg | Betyder |
| --- | --- |
| Grön | Rätt |
| Gul | Delvis rätt |
| Röd | Fel |
| Grå, streckad | Obesvarad |
| Grå med ett frågetecken | Inte rättad än |

**Per elev (totalt):** andelen poäng av max. Poängsätts inte provet används andelen rätt, där "delvis" räknas som ½.

| Färg | Andel |
| --- | --- |
| Grön | 70 % eller mer |
| Gul | 40–69 % |
| Röd | Under 40 % |

- Läraren kan ändra gränserna per prov med två reglage, så att de passar provets svårighet.
- **Har läraren satt en nivå** (Ej godtagbart / Godtagbart / Mer än godtagbart) visas den **bredvid** färgen. Nivån ändrar inte färgen, eftersom färgen är räknad och nivån är lärarens bedömning.
- Färgerna har alltid en **symbol eller text** också (✓, ½, ✗), så att de fungerar för färgblinda och vid utskrift.

### Hela klassen (flik "Översikt" på provtillfället)

- **Ett rutnät:** en rad per elev och en kolumn per fråga, med en liten färgad ruta i varje cell.
  - **Längst till vänster:** elevens namn och en totalbricka med färg, till exempel "18/24 · 75 %", plus nivån om den är satt.
  - **Längst ner:** en sammanfattning per fråga, till exempel "64 % rätt", i frågans färg. Gränserna är desamma som för eleverna.
- **Överst:**
  - en rad som räknar eleverna: "🟢 12 · 🟡 7 · 🔴 4 · ej rättade 1"
  - klassens snitt
  - **de tre svåraste frågorna**, med länk till frågan i rättningsvyn
- **Klick:**
  - på en elev öppnas elevvyn
  - på en cell öppnas just det svaret i rättningsvyn
- **Sortering:** eleverna kan sorteras efter namn eller resultat.
- **Mobil:** på smala skärmar kan rutnätet scrollas i sidled inuti sin egen ruta, med namnkolumnen fast till vänster.

### En elev

- **I provtillfället:** elevens rad uppförstorad, med fråga för fråga i färg, elevens svar, kommentarerna, totalen och nivån. Det är samma vy som rättningen per elev, men bara att läsa.
- **Över tid, i klassens statistik:** lägg till fliken **"Prov"** i `STATS_TABS` (`teacher-class.js`). Den visar:
  - **Klassens provtillfällen** i en lista med datum, prov, klassens snitt och fördelningen 🟢/🟡/🔴.
  - **Varje elev:** när läraren väljer en elev visas **alla prov eleven har skrivit**, med datum, resultat i procent, färg och nivå, och en liten linje som visar utvecklingen.

  Läs in det med **en** collection group-fråga på `rattning` med `where("classId","==",classId)`, en gång när fliken öppnas. Det följer kvotregeln: en klass i taget och ingen läsning per elev.

## 8. Skapa och redigera prov

### 8.1 Formulär

- **Provets uppgifter:** namn, ämne, årskurs, beskrivning och inställningarna från avsnitt 3.
- **Frågelistan:** varje fråga visas som ett kort med typ, fråga och poäng. Korten kan dupliceras och raderas, och de flyttas genom att man drar dem eller använder "Flytta till…" (se 2.3.1).
- **"Lägg till fråga"** öppnar en väljare med frågetyperna (ikon, namn och en rad som beskriver typen) och därefter typens formulär.
- **Varje typ** har ett eget formulär, med samma mönster som `teacher-area-items-forms.js`: `onSubmit(fields)` returnerar `{ ok, errors }`.
- **Förhandsvisa som elev** visar provet exakt som eleven ser det, men utan att något sparas.
- **Logiken** ska vara DOM-fri och testad, i `prov-redigera-ops.js`. Följ mönstret i `teacher-area-items-ops.js`.

### 8.2 Klistra in från AI

- Använd samma flöde som för Plugga-områden. Knappen **"Skapa med AI"** öppnar en ruta där läraren anger:
  - ämne och årskurs
  - antal frågor
  - vilka frågetyper som ska ingå (kryssrutor)
  - poängsättning (på eller av)
  - önskemål
  - eventuellt material att utgå från
- `buildProvPrompt(...)` i `src/prov/prov-prompt.js` bygger prompten. Den ska innehålla:
  - JSON-schemat för de valda typerna
  - ett kort exempel per typ
  - reglerna: svensk text, åldersanpassat, flervalsalternativ av rimlig och lika längd, inget facit i frågetexten, rimliga alternativa svar för kortsvar, och bedömningsstöd för fritextfrågor
- **Läraren klistrar in JSON.** Den går genom `validateProv`, och läraren ser fel och varningar innan hen sparar.
- **Klistras JSON in i ett befintligt prov** läggs frågorna till sist.

## 9. Kvot och prestanda

### 9.1 Budget

**Räkna och redovisa i rapporten:**

- skrivningar per elev under ett prov på 40 minuter
- läsningar för läraren under provet
- läsningar vid rättningen

Ett mål att jämföra med är 25 elever, 12 frågor och 40 minuter. Det ska stanna under **3 000 läsningar och 3 000 skrivningar totalt**. Justera sparintervallet om det behövs, och skriv hur ni räknade.

### 9.2 Inga läsningar per elev i heta flöden

- Eleven läser bara sitt eget tillfälle och sitt eget `svar`-dokument.
- Läraren läser en klass i taget.

---

# ETAPP 1 – PR-ORDNING OCH TESTER

1. **Grunden:**
   - frågetypsregistret och `validateProv`
   - normaliseringen och förslagsfunktionerna i `prov-rattning.js`
   - datamodellen och reglerna
   - enhetstester och regeltester
   - inget UI än
2. **Skapa och redigera:**
   - lärarfliken "Mina prov"
   - formulären och "Förhandsvisa som elev"
   - flödet för att klistra in från AI
3. **Provtillfället:**
   - "Kör i klass", öppna och stäng, och fokusläget
   - lärarens översikt
   - elevens provsida med automatisk sparning, tidsgräns och inlämning
   - villkoret för länken i sidomenyn
4. **Rättning och tillbakalämning:**
   - knappen "Rätta alla automatiska frågor" (6.0)
   - de två rättningslägena, grupperingen av kortsvar och halvpoängen
   - nivåerna
   - tillbakalämning och ångra tillbakalämning
   - elevens resultatvy
5. **Enkel statistik** (7.5):
   - översikten över hela klassen i grönt, gult och rött
   - elevvyn i provtillfället
   - fliken "Prov" i klassens statistik med elevens prov över tid
   - en indexfil för collection group-frågan

**Tester (utöver regeltesterna i 4):**

- **Varje frågetyp:**
  - `validera` (giltigt och ogiltigt)
  - `utanFacit` (att inget facit läcker, testat genom att söka efter facitvärdena i resultatet)
  - `forslag` med delpoäng
  - `arBesvarad`
- **Normaliseringen:** decimalkomma, punkt sist, gemener, Levenshtein = 1 ger "delvis" och skiftlägeskänslighet.
- **Automatisk sparning:** omladdning mitt i provet återställer alla svar, och ett nätverksfel visar felraden och försöker igen.
- **Tidsgränsen:** provet lämnas in automatiskt, och reglerna nekar skrivningar efter gränsen plus marginalen.
- **Stängt prov:** att stänga markerar alla som inlämnade, och eleven kan inte skriva mer.
- **Rättning:** rättningen av en grupp gäller alla i gruppen.
- **Tillbakalämning:** "Lämna tillbaka till alla rättade" hoppar över elever som inte är färdigrättade.
- **Resultatet:** eleven ser rättningen först efter tillbakalämningen, och facit bara om det är valt.
- **Fokusläget:** låset med `typ: "prov"` och `id` skickar eleven direkt till provet.
- **Poängen:**
  - halvpoäng sparas och summeras exakt, till exempel 3,5 + 4 + 0,5 = 8
  - delpoäng avrundas nedåt till 0,5
  - poängen kan inte bli högre än max eller lägre än 0
  - decimalkomma visas överallt
- **"Rätta alla automatiska frågor":**
  - säkra fall godkänns
  - nästan rätta kortsvar lämnas åt läraren
  - fritextfrågor rörs inte
  - manuellt bedömda svar skrivs inte över
  - en andra körning efter ett tillägg i facit rättar bara det som inte har bedömts manuellt
  - ungefär en skrivning per elev
- **Ordna och para ihop:**
  - ett fullständigt svar på en `ordna`-fråga med n saker kräver exakt n tryck
  - ett tryck tar bort en sak och resten flyttar upp
  - blandningen är densamma för samma elev efter omladdning
  - "Flytta till…" i redigeraren flyttar en fråga rätt
- **Avsnitten:** frågorna numreras löpande genom hela provet, och statistiken visar poäng per avsnitt.
- **Statistiken:**
  - färgerna räknas rätt vid gränserna 39/40 % och 69/70 %
  - "delvis" räknas som ½ när provet inte poängsätts
  - obesvarade och orättade frågor räknas inte som fel i färgen förrän de är rättade
  - fliken "Prov" i klassens statistik gör exakt **en** fråga mot databasen
- **Förhandsvisning av statistiken:** `preview/preview-prov-statistik.html` med 25 påhittade elever och 12 frågor.
- **Bootgrafen:** källkodstestet för `src/prov/`.
- **Förhandsvisningssidor med stubbar** (mönstret i `preview/`):
  - `preview/preview-prov-elev.html`: elevens provsida med alla frågetyper.
  - `preview/preview-prov-rattning.html`: rättningsvyn med 8 påhittade elever.
  - Skärmdumpar i PR-beskrivningen.

**Etapp 1 är klar när** Elias har kört ett riktigt prov i en klass, rättat det och lämnat tillbaka det, och allt har fungerat. Först då börjar Etapp 2.

---

# ETAPP 2 – SMIDIGARE PROV

## 10. Hämta frågor från ett Plugga-område

I provredigeraren finns knappen **"Hämta från område"**:

1. Läraren väljer ett område bland dem hen får se.
2. Läraren väljer vilka saker som ska med. De visas i en lista med kryssrutor, grupperade per sort.
3. Sakerna görs om till frågor så här:

| I området | Blir i provet |
| --- | --- |
| Quizfråga | `flerval` |
| Quizfråga med `passage` | Ett `text`-block med texten (en gång) och `flerval`-frågor under |
| Par (`pairs`) | En `para`-fråga med de valda paren (3–10 st) |
| Tidslinje (`timeline`) | En `ordna`-fråga ("Sätt händelserna i rätt ordning") |
| Ämnesläsningstext | Ett `text`-block och dess frågor som `flerval` |

Lägg omvandlingen i `prov-fran-omrade.js`, DOM-fri och testad. Par som bara har en bild hoppas över, och läraren får en varning.

## 11. Pluggmynt (frivilligt per prov)

En ny inställning per prov, **Mynt**:

- **Inga mynt** (standard)
- **Fast summa för inlämnat prov**, till exempel 20 mynt
- **Mynt per poäng**, till exempel 2 mynt per poäng. Det kräver att provet poängsätts.

**Regler för utbetalningen:**

- **När:** mynten betalas ut **först vid tillbakalämning**, aldrig under provet. Då påverkar de inte svaren och summan blir rätt efter rättningen.
- **Hur:** använd **samma mekanism som Live-mynten** (`live-rewards`), så att utbetalningen går genom servern och inte kan fuskas fram av en elev. Undersök den och redovisa hur den återanvändes.
- **Bara en gång:** rättningen får `myntUtbetalt: number`.
  - "Ångra tillbakalämning" drar **inte** tillbaka mynten.
  - En ny tillbakalämning betalar bara ut **skillnaden**, om summan har ökat.
- **Tak:** högst 200 mynt per prov och elev.
- **Eleven** ser "+36 mynt" i sin resultatvy.

## 12. Fördjupad statistik

Den enkla statistiken i grönt, gult och rött finns redan sedan Etapp 1 (7.5). Bygg vidare på den:

- **Per fråga:** staplar som visar andelen rätt, delvis och fel, sorterade så att de svåraste frågorna syns först.
- **Fördelning:** ett diagram över hur totalpoängen och nivåerna fördelar sig.
- **Jämförelse:** samma prov i flera klasser sida vid sida, till exempel 4A och 4B. Läraren ser då bara sina egna klasser.
- **Export:** klassens resultat som CSV, med elev, poäng per fråga, total och nivå, för lärarens egna anteckningar.

Allt räknas ut ur de data som redan har lästs in för rättningen. Det ska inte bli några extra läsningar.

## 13. Utskrift

- **Skriv ut provet** gör provet till pappersformat med namnrad, frågorna och skrivlinjer, till elever som behöver skriva på papper. Ett val avgör om facit skrivs ut separat.
- **Skriv ut resultat** skriver ut elevens rättade prov, med kommentarer och eventuellt facit, en elev per sida.
- **Följ mönstret** i `teacher-login-print.js`, med A4 stående och `@media print`.

## 14. Anpassningar

- **Extra tid per elev:** när ett tillfälle öppnas kan läraren ge enskilda elever mer tid, till exempel +15 minuter.
  - Spara det i `provTillfallen/{t}.extraTid: { [elevUid]: minuter }`.
  - Reglerna tar hänsyn till det.
- **Öppna för valda elever:** ett nytt tillfälle av samma prov för bara några elever, till exempel sådana som var sjuka.
  - Fältet heter `elevIds` (en valfri lista).
  - Reglerna kräver då att eleven finns i listan.
  - I listan över tillfällen visas det som "Vikingaprovet – omprov (3 elever)".
- **Uppgift om flikbyte (valfritt, bara information):** räkna hur många gånger eleven lämnade provfliken (`visibilitychange`) och visa det diskret för läraren vid rättningen, till exempel "Lämnade provet 2 gånger". Det ska inte straffa något automatiskt.

## 15. Etapp 2 – PR-ordning

5. Hämta från område.
6. Pluggmynt.
7. Fördjupad statistik och utskrift.
8. Anpassningar: extra tid, valda elever och flikbyte.

---

# DOKUMENTATION OCH RAPPORT

- **Nytt dokument `docs/PROV.md`:**
  - begreppen
  - datamodellen
  - statusflödet
  - frågetypsregistret och hur man lägger till en ny typ
  - budgeten för läsningar och skrivningar
- **`docs/BEHORIGHETER.md`:** de nya samlingarna, regeltesterna och eventuella callables.
- **`docs/DATAMODELL.md`:** de nya samlingarna.
- **`docs/FOKUSLAGE.md`:** målet `"prov"`.

**Rapporten efter varje etapp:**

- vad som har byggts
- skärmdumpar på elevens provsida, rättningsvyn och resultatvyn
- de uträknade läsningarna och skrivningarna
- om reglerna, index eller functions behöver deployas, och i vilken ordning
- kända begränsningar

Alla befintliga tester ska vara gröna.
