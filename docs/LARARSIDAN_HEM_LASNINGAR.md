# Lärarsidans Hem – läsningar, räknare och deploy (#807)

Epic #802, spec [`UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md`](UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md) DEL 2, §1.3 och DEL 5.
Kvoten (#114/#231): Hem läser **högst en gång per klass** plus det som redan lästes, och **aldrig per elev**.

Koden: `src/teacher-hem.js` (sidan), `src/teacher-hem-logik.js` (ren logik), `src/teacher-hem-data.js` (alla läsningar),
`src/prov/prov-raknare.js` (räknarna) och `src/prov/prov-att-ratta.js` (märket och "Att rätta").
Testerna: `test/lararsida-hem.test.js` och `test/prov-raknare.test.js` (node, minnes-Firestore),
`test/firestore-rules-prov-raknare.test.js` (reglerna) och `test/firestore-prov-raknare-emulator.test.js` (de riktiga
src-modulerna mot emulatorn med de riktiga reglerna, inloggad som årskurskonto – räknarna genom hela flödet och Hems läsningar).

## 1. Vad Hem läser

Mätt i förhandsvisningen (`preview/preview-hem.html`, minnes-Firestore som loggar varje läsning i `window.__ppStub.rakna.logg`)
och i `test/lararsida-hem.test.js` (räknande adapter + de riktiga läsningarna mot minnes-Firestore).

| # | Läsning | Ny? | Antal | När |
| --- | --- | --- | --- | --- |
| 1 | `classes` (alla klasser, `getClasses`) | nej, lästes redan av översikten (session-cache) | 1 fråga | varje besök (cache 30 s) |
| 2 | `teacherAccounts/{uid}` (`myRole`) | nej, toppmenyn läser den ändå | 1 | cachad i sessionen |
| 3 | `liveSessions` where status in [lobby, live] (lyssnare) | nej, samma lyssnare som översikten hade | 1 + ändringar | så länge Hem är öppet |
| 4 | `classProjections/{classId}` | **ja – den enda läsningen per klass** | 1 per synlig klass | varje besök (cache 30 s); admin: inte för dolda klasser (läses först vid "Visa alla") |
| 5 | `provTillfallen` where classId in [klasserna] + attRatta == true | **ja – per lärare, inte per klass** | 1 fråga per 30 klasser; en läsning per tillfälle med orättade prov (minst 1) | delas med märket på Prov, cache 5 min, töms när räknarna skrivs |
| 6 | `provTillfallen` where classId in [klasserna] + status == "oppet" | **ja – per lärare** | 1 fråga per 30 klasser; en läsning per öppet prov (minst 1) | varje besök |
| 7 | `prov` where createdBy == uid, limit 1 | **ja – Kom igång steg 3** | 1 | bara årskurslärare, bara medan rutan visas och steget inte är klart; "klart" sparas i localStorage och läses aldrig om |
| 8 | `liveSessions` where createdBy == uid, limit 1 | **ja – Kom igång steg 4** | 1 | som 7 (lyssnaren i 3 bockar också av steget) |

**Exempel (förhandsvisningen, admin, 10 klasser):** `classes` · `teacherAccounts/stub-admin` · 10 × `classProjections/<klass>` ·
`provTillfallen (1 dok)` (öppna prov) · `provTillfallen (2 dok)` (att rätta) · `liveSessions (1 dok)` = **15 läsningar, varav 12 nya**
(10 klasser + 2 frågor). Två dolda klasser → 8 projektioner; "Visa alla" läser de två efteråt.
**Årskurslärare (4A + 4B), ny:** 2 projektioner + 2 frågor + Kom igång 2 = 6 nya läsningar första gången, sedan 4.
**Mot emulatorn (årskurskontot ak4, 4A + 4B, `firestore-prov-raknare-emulator.test.js`):** `doc classProjections/4a` ·
`doc classProjections/4b` · `fråga provTillfallen (0 dok)` (öppna prov) · `fråga prov (0 dok)` · `fråga liveSessions (0 dok)`
(Kom igång) · `fråga provTillfallen (2 dok)` (att rätta) = 6 läsningar enligt Firestores debitering (tom fråga = 1).

Inga `students`, `studentData`, `svar`, `rattning` eller `expMembers` läses (testet kontrollerar det). Toppmenyns märke på varje
annan lärarsida är fråga 5 – högst en gång per 5 minuter (och direkt efter att läraren själv ändrat räknarna).

## 2. Räknarna "prov att rätta" (§1.3) – gick billigt

Räknarna är tillfällets räkneverk från #741, plus en flagga – **inga nya dokument, ingen regeländring**:

| Fält på `provTillfallen/{t}` | Betyder | Spec |
| --- | --- | --- |
| `rattStatus.antal` | inlämnade prov | `inlamnade` |
| `rattStatus.rattade` | färdigrättade (tillbakalämnade inräknade) | `rattade` |
| `rattStatus.tillbaka` | tillbakalämnade | – |
| `attRatta` | `antal > rattade` – så att märket hittar tillfällena med en likhetsfråga (inget sammansatt index) | – |

Prov att rätta på ett tillfälle = `antal − rattade`. Märket = summan över lärarens klasser (årskurskonto: kontots klasser, admin: alla).

**Var de skrivs – alltid av lärarens webbläsare, när siffrorna redan finns:**

| Händelse | Vad som skrivs | Extra läsningar | Extra skrivningar |
| --- | --- | --- | --- |
| **Stäng** | `antal` = antalet svar (alla är inlämnade efter stängningen); rättade/tillbaka står kvar | 0 (svaren läses redan för att markera dem) | 1 |
| **Öppna igen** | hela räkneverket ur svaren och rättningarna som redan läses; de som får skriva igen räknas inte | 0 | 1 |
| **Rättningsvyn öppnas** | räkneverket rättas om det inte stämmer (t.ex. elever som lämnat in sedan förra gången) | 0 (vyn läser allt ändå) | högst 1 |
| **Bedömning, Rätta alla, Lämna tillbaka, Ångra** | som sedan #741 (`rattStatusSumma` i samma batch som rättningarna) + `attRatta` | 0 | 0 (fältet följer med) |
| **Omprov** | ett eget tillfälle med egna räknare (samma flöde); ursprunget rörs inte | 0 | – |
| **Radera** | tillfället försvinner ur frågan | 0 | 0 |

**Beslut (godkänt av epic-leaden 2026-10-19): inlämning medan provet är öppet räknas inte direkt.** Specen §1.3
förbjuder att läsa svar för att räkna, och att eleven ökade en räknare på tillfället vid varje inlämning skulle
kräva en ny elevregel på tillfället, och – värre – varje sådan skrivning går ut till **alla elevers lyssnare** på öppna prov
(`prov-watch.js`): 25 inlämningar × ~25 lyssnare ≈ 625 läsningar per prov. I stället visar Att göra **"Provet är öppet i 4A"**
(Öppna → översikten där provet stängs); när läraren stänger, eller öppnar rättningen, räknas de inlämnade. Ett prov som rättas
medan det är öppet räknas med rättningsvyns siffror (de som lämnat in när vyn öppnades).

Äldre tillfällen (före deployen) saknar `attRatta` och syns inte i märket förrän läraren öppnar rättningen eller stänger provet
igen – då skrivs flaggan.

## 3. "Inte övat på 14 dagar" och "Övat den här veckan" – gick billigt

Datumet fanns inte någonstans som läses per klass (`classProjections` hade bara stjärnor, XP, lösta uppgifter m.m.). Därför har
varje medlem i projektionen fått **`members.<uid>.ovat`** = dagen eleven senast fick en övning godkänd (`"YYYY-MM-DD"`, lokal tid,
`ovatIdag` i `projection-sync.js`).

- **Kostnad: 0 extra skrivningar.** Fältet följer med den skrivning som `awardExercise` (`game-shared.js`) redan gör efter varje
  övning (`{ ...awardProjectionPatch(sd), ovat }`). Specens gräns "högst en skrivning per elev och dag" hålls med marginal.
- **Läsning:** samma `classProjections/{classId}` som Hem läser för klasskortet – en per klass.
- **"Övat den här veckan: 18 av 23"** = klassens elever (`studentIds`) med `ovat` ≥ måndagen. Raden visas bara när klassens
  projektion har datum alls (första övningen efter deployen).
- **"3 elever i 4B har inte övat på 2 veckor"** = `ovat` äldre än 14 dagar. En elev **utan** datum räknas bara när datumen bevisligen
  sparats längre än 14 dagar i klassen (någon annan elev har ett äldre datum) – annars vet vi inte, och raden hoppas över.
  Raden säger "övat", inte "loggat in": inloggningar sparas inte någonstans billigt.
- "Övat" = övningar som går genom `awardExercise` (Plugga-lägena, äventyren, Tidsjakten, Räkna). Läsresan, Ekvationsresan,
  Bråkresan, Prov och Live räknas inte.

## 4. Övrigt som redovisas

- **Dolda klasser (admin):** sparas per lärare i webbläsarens **localStorage** (`pp:larare:<uid>:doldaKlasser`), inte i
  `teacherAccounts/{uid}`: ingen skrivning till Firestore, inget nytt fält i kontodokumentet (som admin-sidan Lärarkonton och
  Cloud Functions skriver), och valet gäller bara Hem. Nackdel: valet följer inte med till en annan dator.
- **Kom igång:** utskriften av inloggningskort sätter `pp:larare:kortUtskrivna`; "Dölj" och avbockade steg sparas per lärare
  (`pp:larare:<uid>:komIgangDold`, `…:komIgangKlart`). Admin ser aldrig rutan.
- **"Jobbar med: …"** på klasskorten: områdenas namn sparas i webbläsaren (`pp:larare:omradesnamn`) när biblioteket ändå laddas
  (Mina klasser → Vad eleverna ser). Saknas namnet visas id:t snyggat ("vasatiden" → "Vasatiden") – Hem läser aldrig biblioteket.
- **Bootgrafen:** oförändrad (107 moduler, `admin/qa-bootgraf-bfs.mjs`). Hem, märket och "Att rätta" laddas med `import()`.
- **Årskurslärare** ser inga admin-kontroller på Hem (Dölj den här/Visa alla, adminlänkar); behörigheterna är oförändrade.

## 5. Deploy

- **Webben** (Pages) – det är allt som krävs.
- **Inga regler, inga index, inga functions.** Lärarens uppdatering av tillfället har ingen fältlista i reglerna (bara
  `validTillfalle` + oförändrat `classId`/`provId`/`createdBy`/`elevIds`/`omprovAv`), och klassmedlemmar skriver redan sin egen
  projektionspost fritt. `test/firestore-rules-prov-raknare.test.js` visar att skrivningarna och frågorna går med dagens regler, och
  att eleven och en lärare utan klassen nekas.
- Märkets fråga (`classId in …` + `attRatta ==`) och "öppna prov" (`classId in …` + `status ==`) är två likhetsvillkor – samma form
  som elevens lyssnare – och klaras av Firestores automatiska fältindex.

## 6. Förhandsvisning och skärmdumpar

`preview/preview-hem.html` (stub, ingen prod): `?roll=arskurs` = Årskurs 4 (4A + 4B), utan = admin (10 klasser),
`?nollstall` tömmer Hem-valen i localStorage. Sådden: `preview/hem-stubs/seed.js`. Skärmdumpar före (c9b16bf) och efter,
årskurs + admin, desktop 1366 px + mobil 375 px: [`qa-lararsida-807/`](qa-lararsida-807/).
