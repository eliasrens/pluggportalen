# QA-rapport – Prov Etapp 1 (#743)

Slut-QA av epicen Prov Etapp 1 (#738–#742) på epic-grenen `42be601`. Spec:
`docs/UTVECKLINGSUPPDRAG_PROV.md` (Etapp 1 + "Dokumentation och rapport").
Kontraktet: `docs/PROV.md`. Allt kördes mot Firebase-emulatorerna i en riktig
webbläsare (lärare + tre samtidiga elever i egna inloggningar). Inget skrevs mot live.

## Sammanfattning

- **Hela flödet fungerar i webbläsaren.** Skapa prov med alla 9 typer (formulär och
  AI-inklistring), kör i klass med fokuslås, tre elever skriver samtidigt (dator,
  surfplatta, mobil) med omladdning, nätfel, stängd flik, tidsgräns och läraren som
  stänger, rättning per fråga (grupperade kortsvar/luckor, fritext, tangentbord) och
  per elev (nivå, helhetskommentar), lämna tillbaka (en, alla rättade, med/utan
  facit, ångra), elevens resultatvy och statistiken (Översikt + klassens Prov-flik).
- **Säkerheten håller.** 30 direktanrop från konsolen (elev, annan elev, annat
  årskurskonto) nekades som de ska. Inget facit i elevens tillfälle.
- **Två buggar (texten "null") och ett integritetsfel vid "Öppna igen"** – se F1, F2, F4.
  Övriga fynd är kosmetiska eller förslag.
- **Kvoten håller:** ≈ 1 500 läsningar och ≈ 1 300 skrivningar för ett realistiskt prov
  (25 elever, 12 frågor, 40 min) inklusive rättning och statistik. Värsta fallet för
  skrivningar ≈ 2 950 – under 3 000, men med liten marginal.
- **Regression grön:** `node --test` 2597/2597 (inkl. `behorigheter-doc` och
  `prov-grund` med bootgrafen), `test:rules` 647/647 (52 filer, en emulator),
  BFS från `app.js` = 107 filer, ingen från `src/prov/`.

## Fynd

| # | Allvar | Var | Vad |
| --- | --- | --- | --- |
| F1 | 🐞 bugg | `src/prov/prov-elev-vy.js:131` | Lämna in-rutan visar texten **"null"** när alla frågor är besvarade. `replaceChildren()` skriver ut `null` (det gör inte `h()`). Bild: `qa-prov-743/F-null-lamna-in.png` |
| F2 | 🐞 bugg | `src/prov/prov-stat-vy.js:131` | Översikten visar **"null"** under klassens snitt när inget är rättat än (`svarast = null`). Bild: `qa-prov-743/F-null-oversikt.png` |
| F3 | kosmetisk | elevens provsida, 390 px | Den klistrade provrubriken glider in under den fasta ☰-knappen när man scrollar – början av namnet täcks. Bild: `qa-prov-743/elev-mobil-390.png` |
| F4 | ⚠️ integritet | Öppna igen (`attOppnaIgen`) | Stäng → rätta → lämna tillbaka → **Öppna igen**: elever som fick `inlamnadNar: "stangt"` får `inlamnad: false` och kan skriva om sina svar (verifierat: `updateDoc` tillåten, listan visar "Fortsätt provet") – samtidigt som deras tillbakalämnade rättning, ev. med facit, syns. Rättningen speglar inte de nya svaren. Förslag: hoppa över elever vars rättning är tillbakalämnad (och/eller neka i regeln), och varna i rutan. |
| F5 | kosmetisk | `src/prov/typer/delat.js:47` | Formuläret visar fältnamnet: *Frågetexten ("fraga") saknas eller är tom.* Namnet hjälper vid AI-granskningen men inte i formuläret. |
| F6 | kosmetisk | `src/prov/prov-redigera-ops.js:254` | Frågekortet visar "1 luckor" (ska vara "1 lucka"). |
| F7 | känd begränsning | `prov-watch.js` | Ett tillbakalämnat prov syns i elevens lista först efter omladdning/ny inloggning (ett `getDocs` per inloggning enligt §5.5). Eleven som sitter inloggad ser "Just nu finns inget prov att skriva" tills hen laddar om. |
| F8 | förslag | `prov-sparning.js` | Under taket (en skrivning per 24 s) står det "Sparar…" i upp till 24 s fast svaret redan ligger lokalt. Kan oroa en elev; t.ex. "Sparat på datorn – skickas snart". |
| F9 | förslag | fokusläget | Med klassen låst till provet visade Alvas sida ändå "⚡ En Live-match väntar på din klass – tryck på Live pågår! i menyn!" (en öppen Live-lobby för 4A i testdatan). Under ett prov borde Live-uppmaningen döljas. |

F1, F2 och F4 är rapporterade till leaden.

## Vad som testades

Konton (emulator): `qaarskurs4` (4A, 4B), `qaarskurs5` (5A), elever 4A: Alva, Bilal,
Cleo, Dante; 4B: Ebba, Fadi, Gry. Rigg: `bash admin/qa-prov-preview.sh` (se nedan).

**Skapa (§8).** Nytt prov med alla 9 typer via formulären (textblock, flerval,
flerval-flera, sant/falskt, kortsvar med "ett stavfel = delvis", lucktext med
alternativa svar, para, ordna, fritext med bedömningsstöd). Tomt formulär ger
svenska fel per fält. "Skapa med AI": ogiltig JSON → "Fråga 1 (Flerval): "ratt" …
saknas", giltig JSON i kodstaket med alla 9 typer → granskas och läggs **sist**,
krockande id byts (f10–f17). Flytta upp/ned, duplicera, ta bort + Ångra.
Förhandsvisa som elev visar elevens vy utan att något sparas. Sparat dokument:
`createdBy`, ägarnamn, årskurs, inställningar och 18 poster. Kollegan (`qaarskurs5`)
ser provet under "Kollegors prov", kan Kör i klass/Kopiera men inte redigera/radera;
Kopiera → osparat utkast → sparas som eget.

**Köra (§5).** Kör i klass: bara egna klasser i listan (4A, 4B; kollegan bara 5A),
tidsgräns 40 → låset förvalt till +50 min, Öppna nu. "Spara och öppna senare" ger
Förberett – eleven ser ingenting (lista och direktläsning nekas). Fokuslås: eleven
hamnar direkt i provet efter inloggning. Lärarens översikt: Inte börjat / Skriver /
Inlämnat / Inlämnat (tiden) / Inlämnat (stängt), "12 av 16", tid kvar, Uppdatera nu.
Stäng: oinlämnade markeras, låset tas bort, eleven ser "Provet är stängt. Dina
sparade svar gäller." och kan inte skriva. Öppna igen (se F4). Radera tillfälle:
tillfället, `svar`, `rattning` och `privat/facit` borta.

**Eleverna.** Alva (1366): halva provet → omladdning mitt i → alla svar tillbaka
(även osparade, från `localStorage`); nätet av → "Kunde inte spara – kontrollera
internet. Dina svar finns kvar här." efter ~4 s; nätet på → sparat inom 15 s.
Bilal (mobil 390): allt besvarat → Lämna in (F1). Cleo (surfplatta): stängde
fliken mitt i → svaren var sparade på servern direkt → "Fortsätt provet" återställde
allt; läraren stängde medan hon satt i provet. Ebba och Gry (5 min): nedräkningen
gul → röd (43 s) → "Tiden är slut – ditt prov är inlämnat." med `inlamnadNar: "tid"`
exakt vid startad + 5 min. Rutan "Du har svarat på 15 av 16 frågor. Fråga 16 är
obesvarad." + Gå tillbaka fungerar. Stavningshjälpen är av (`spellcheck`,
`autocorrect`, `autocapitalize`, `autocomplete`).

**Rätta (§6).** Förslag sparas när vyn öppnas (3 dokument). "Godkänn alla förslag på
den här frågan". Kortsvar: "Birka" + "BIRKA" grupperas (2 elever), "Birca" eget
(Auto · Delvis). Tangenter 1/2/3, Tab, N (inga nya läsningar vid byte av fråga).
Fritext med poäng + kommentar per elev, bedömningsstödet överst. Per elev: total,
nivå MG, helhetskommentar. Dölj namn → Elev 1–3.

**Lämna tillbaka (§7).** En elev (med facit, förvalt), alla rättade (2 elever, facit
avkryssat → rättningen saknar `facit`, eleven ser "Din lärare visar inte facit"),
hoppar över ej färdigrättade ("1 elev är inte färdigrättad och lämnas inte tillbaka
än."), Ångra (Alva → "Inte tillbakalämnat än", rättningen nekas igen, `facit` och
`aterlamnadAt` borta) och tillbaka igen. Resultatvyn: namn, datum, "28 av 29 poäng",
nivån, helhetskommentar, varje fråga med ✓/½/✗ + text, lärarens kommentar och facit.

**Statistik (§7.5).** Översikt: 2 gröna · 1 gul · 0 röda, snitt 76 %, tre svåraste med
länk, rutnätet med fast namnkolumn och sidoscroll (1920: frågorna 15–16 scrollas fram),
klick på elev → elevvyn. Klassens statistik → Prov: tillfället med snitt och
fördelning, Bilal över tid 55 % gul. Fliken läste **exakt en fråga** (3 rättningar).

## Säkerhet (konsolen, direkt mot Firestore)

| Vem | Försök | Resultat |
| --- | --- | --- |
| Elev (öppet prov) | läsa `privat/facit`, `prov`, ett `prov/{id}`, alla `svar`, alla `rattning`, alla tillfällen, CG `rattning` för klassen, CG `svar` | nekad (9/9) |
| Elev | tillfällets `fragor` | inga facitvärden (godkända svar, luckor, rätt ordning, paren) – ordna/para blandade |
| Elev (inlämnad) | ändra svar, `inlamnad: false`, skriva annans svar, skriva egen rättning, stänga tillfället, läsa annans svar | nekad (6/6) |
| Elev (stängt prov) | ändra svar | nekad |
| Elev (inte tillbakalämnat) | egen rättning, annans rättning, CG utan `elevId`, CG med annans `elevId` | nekad (egen CG ger 0 träffar) |
| Elev (tillbakalämnat utan facit) | `privat/facit` | nekad; rättningen saknar `facit` |
| Elev i 4B | lista 4B utan statusfilter, förberett tillfälle, stängt i 4A | nekad (3/3) |
| Årskurs 5 (5A) | läsa/lista tillfälle i 4A, facit, svar, rättning, CG rättning 4A, skriva rättning, stänga 4B, skapa tillfälle i 4A, redigera/radera kollegans prov | nekad (11/11) |
| Årskurs 5 | läsa kollegans prov | tillåten (avsiktligt – för Kopiera, §4) |

## Kvot (§9)

Mätt med räknande proxy (`QA_RAKNA=1`, se nedan): dokument som Firestore levererar
till webbläsaren (= debiterade läsningar) och dokument i skrivanropen, per inloggning.

| Flöde | Mätt i testet | Räknat för 25 elever, 12 frågor, 40 min |
| --- | --- | --- |
| Elevens autosparning | taket syns: ändringar 22:25:55 → nästa skrivning 22:26:19 (24 s); 5-min-prov: 3–4 skrivningar per elev (start + 1–2 sparningar + inlämning) | högst 1 + 101 + 1 = 103 per elev → **≤ 2 575**; realistiskt ~1 per aktiv minut → ~1 000 |
| Elevens läsningar | lyssnaren + tillfället + eget svar + tillbakalämnade (CG, ≤ 10) | ~6 per elev → **~150** |
| Lärarens översikt | Uppdatera = ett dokument per elev som börjat (3) + namn | 25 × 40 + 25 + 1 = **1 026** |
| Öppna/stäng | tillfälle + facit + lås, stängningens markeringar | **~30** skrivningar |
| Rättningen, laddning | tillfälle 1 + facit 1 + svar N + rättning N + namn N (mätt 1+1+2+1+3) | 1 + 1 + 25 + 25 + 25 = **77** (+ ~8 för lärarsidans skal) |
| Rättningen, skrivningar | 3 elever × 16 frågor: 28 rättningsskrivningar + 6 på tillfället (`rattStatus`) | förslag 25 + 12 × 25 + 25 tillbaka ≈ **350** |
| Klassens Prov-flik | **1** fråga, 3 dokument | 25 × antal prov (10 prov = 250) |
| **Summa** | | läsningar **≈ 1 500**, skrivningar realistiskt **≈ 1 400**, värsta fall **≈ 2 950** |

Iakttagelser utanför provet (inte från Etapp 1): varje inladdning av appen läser
alla `classes`-dokument (6 i testdatan) både för elever och lärare, och lärarsidans
skal läser `teacherAccounts`. Det är befintligt beteende, men det ligger ovanpå
provets siffror.

## Deploy

1. `firebase deploy --only firestore:indexes` – det sammansatta indexet
   `rattning (elevId, aterlamnad, aterlamnadAt desc)` och fältundantaget
   `rattning.classId` (collection group). Vänta tills indexet är byggt (konsolen).
2. `firebase deploy --only firestore:rules` – `prov`, `provTillfallen` med
   undersamlingar, CG-regeln för `rattning`, `validLockShape` med `"prov"`.
3. Därefter webben (merge till main → GitHub Pages). Inga functions.

Ordningen spelar roll: utan reglerna nekas lärarens första "Kör i klass" och låset
`typ: "prov"`; utan indexet misslyckas elevens fråga om tillbakalämnade prov.

## Kända begränsningar

- F7: tillbakalämnade prov syns först efter omladdning (spec §5.5: ett `getDocs` per inloggning).
- Fritextens 4 000 och kortsvarets 100 tecken kontrolleras bara i klienten (reglerna kan inte gå igenom en map).
- Tidsgränsen räknas med `serverNow`; en elev vars dator går fel ser fel nedräkning men reglerna avgör (startad + tid + 2 min).
- Emojis visas som rutor i den huvudlösa testwebbläsaren (saknat typsnitt) – inte i riktiga webbläsare.
- Statistiken visar en bedömd obesvarad fråga som ✗ (fel), inte som streckad – efter lärarens bedömning gäller bedömningen.

## Skärmdumpar (`docs/qa-prov-743/`)

| Fil | Visar |
| --- | --- |
| `elev-provsida-1920.png`, `-1366.png`, `-surfplatta.png`, `-390.png` | elevens provsida (frågelistan till höger / överst) |
| `elev-rod-nedrakning.png` | nedräkningen röd (43 s kvar) |
| `elev-mobil-390.png` | F3 – rubriken under ☰ |
| `elev-resultat-1920.png`, `-surfplatta.png`, `-390.png` | resultatvyn med nivå, kommentar och facit |
| `larare-redigera-1920.png` | redigera prov |
| `larare-oversikt-1366.png`, `-1920.png` | lärarens översikt under provet |
| `rattning-perfraga-1366.png` | rättning per fråga, grupperade kortsvar |
| `oversikt-1366.png`, `oversikt-1920.png` | statistikens Översikt |
| `F-null-lamna-in.png`, `F-null-oversikt.png` | F1, F2 |

## Rigg och verktyg

- `admin/qa-prov-preview.sh` – emulatorer (FS 8843, Auth 9843), seed (lärarkonton,
  klasser, elever) och appen på fyra portar 8743–8746 (en origin per samtidig
  inloggning). Kräver Java 21 + firebase-CLI (`JAVA_BIN`/`FIREBASE_BIN`) och
  firebase-admin.
- `admin/qa-prov-svara.js` – fyller i elevens provsida som en användare
  (`await import("/admin/qa-prov-svara.js")`, `__svara({ f2: 0, f5: "Birka", … })`).
- `admin/qa-emulator-proxy.mjs` med `QA_RAKNA=1` – räknar levererade dokument
  (Listen) och skrivna dokument (Write) per port; `GET /__qa/rakna`
  (`?nollstall` nollar). Försök som reglerna nekar räknas också som skrivningar.
