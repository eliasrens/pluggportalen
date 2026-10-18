# QA-rapport – Prov Etapp 3 (#766)

Slut-QA av epicen Prov Etapp 3 (#762–#765: halvpoäng, avsnitt, poängkriterier, ordna/para
med få tryck, "Rätta alla automatiska frågor", statistik per avsnitt) på epic-grenen
`78873b4` (origin/main `ad98509` redan inmergad – inget att merga). Spec:
`docs/UTVECKLINGSUPPDRAG_PROV.md` §2.2, §2.3, §2.3.1, §2.5, §6.0–6.3, §7.5, §9. Kontraktet:
`docs/PROV.md`. Allt kördes mot Firebase-emulatorerna i en riktig webbläsare: lärare +
sju elever i egna inloggningar (4A: Alva, Bilal, Cleo, Dante; 4B: Ebba, Fadi, Gry), och
**två appar mot samma emulator** – den nya (epic-grenen) och den gamla (origin/main =
Etapp 2) – så att "gamla prov" verkligen skapades, kördes och rättades före Etapp 3. Inget
skrevs mot live.

## Sammanfattning

- **Hela Etapp 3-flödet fungerar i webbläsaren:** prov med tre avsnitt, halvpoäng (0,5 p,
  1,5 p, 4 p, 7 p), fritext med kriterier, ordna, para, kortsvar och lucktext → tillfälle
  → elever svarar (mobil 390 px med touch, desktop med tangentbord) → stäng → "Rätta alla
  automatiska frågor" → manuell rättning i halvpoäng → facit i efterhand → kör igen →
  tillbakalämning → elevresultat → statistik per avsnitt → utskrift.
- **Gamla prov (Etapp 2, heltal, utan avsnitt) fungerar oförändrat** i alla vyer i den nya
  appen, även "Rätta alla" på ett tillfälle som öppnades och delrättades i den gamla appen.
- **Samspelet med #759 håller:** "Rätta stavfel själv" + Rätta alla lämnar nästan-rätt helt
  orört ("? Inte rättad"); färggränserna 50/75 slår rätt på halvpoäng (3 av 4 = 75 % grön,
  2 av 4 = 50 % gul).
- **Kvoten (§9):** "Rätta alla" = **0 läsningar** och **1 skrivning per ändrad elev** (+1
  räkneverk) – mätt.
- **Två buggar hittade och rättade här med test** (F1 avrundning av snitt/procent, F2
  etiketten över frågetexten i resultatet på mobil). F3 (kosmetisk) står kvar; F4–F8 är info.
- **Sviterna gröna:** unit **3210/3210** (+ 1 skip), `test:rules` **750/750**, bootgrafen
  **107** filer utan `src/prov/`. Functions rördes inte i epicen (ingen diff mot main) –
  inte körda.

## Automatiska sviter

| Svit | Resultat | Hur |
| --- | --- | --- |
| Unit | **3205 pass, 0 fail** (1 skip) på `78873b4`; efter F1/F2 **3210 pass** | `node --test $(ls test/*.test.js \| grep -v firestore-rules) test/admin-credential.test.mjs test/brakresan-drake-art.test.mjs` |
| `test:rules` (alla filer i package.json) | **750/750** | Firestore-emulatorn (jar) på slumpport, `-Xmx1200m`, `FIRESTORE_EMULATOR_HOST=… node --test <listan>` |
| `test:functions` | inte körd | `git diff ad98509..78873b4 -- functions` är tom |
| Bootgrafen | **107 filer**, ingen `src/prov/` | `node admin/qa-bootgraf-bfs.mjs` |

## Fynd

| # | Allvar | Var | Vad |
| --- | --- | --- | --- |
| F1 | låg – ✅ rättad `65abc80` | `src/prov/prov-statistik.js` (`snittTal`, `procent`), `prov-statistik-fordjupad.js` (CSV) | **Klassens snittpoäng per avsnitt avrundades fel.** Del 3 (11 p): 9 + 3,5 + 2,5 + 0 = 15 → snitt 3,75, men Översikten visade **"Del 3 – Skriv: 3,7 av 11"** (andel × max = 15/44 × 11 = 3.7499999…), medan 8,25 blir "8,3". Samma brus i procenten (0,285 → "28 %") och CSV:ns procentkolumn. **Rättat:** flyttalsbruset tas bort före avrundningen (som `fargFor` redan gör); `procentTal` delas med CSV:n. Verifierat i webbläsaren: "3,8 av 11". Test: `test/prov-766-slut-qa.test.js` (det verkliga fallet + alla snitt h/2/n för n ≤ 30 och alla p/m ≤ 120 mot heltalsräkning). |
| F2 | låg (UX) – ✅ rättad `088dcab` | `src/prov/prov-resultat.css` | **Elevens resultat på mobil: etiketten låg över frågetexten.** Med "½ Delvis rätt · 3,5 av 4 p" (227 px, `nowrap`) krympte frågetexten till 25 px och raderna "Varf / åkte / vikingarna …" låg under etiketten (390 px). Fanns redan i Etapp 1, men blir värre med decimalpoängen. **Rättat:** i mobil-mediafrågan får frågetexten minst 12em, annars radbryts etiketten under (indragen som svaret). Verifierat 320/390/540 px: ingen överlappning, ingen sidledsscroll (`resultat-alva-mobil-390-kriterier.png`). Desktop orörd. |
| F3 | kosmetisk – kvar | `src/prov/prov-ratta-sida.js` `godkannAven` | Efter **Godkänn även ”Birkaön”** står facit-raden överst kvar som "Facit: Björkö" tills vyn laddas om (då "Björkö · Birkaön"). Knappen själv säger "✓ ”Birkaön” finns i facit" och sparraden förklarar, så inget går fel. Förslag: rita om innehållet när tillägget sparats (`ritaInnehall()` före sparraden). |
| F4 | info | pluggmynt (#746) × halvpoäng | Mynt per poäng med halvpoäng avrundas **nedåt**: Cleo 8,5 p × 3 = 25,5 → **25 mynt** (Alva 21 × 3 = 63, Dante 5 × 3 = 15). Rimligt, men specen säger inget – nämns för Elias. |
| F5 | info (övergången) | gamla webben mot Etapp 3-data | Den gamla appen (Etapp 2) visar ett Etapp 3-tillfälle utan att krascha, men räknar avsnitten som frågor (12 kolumner i stället för 9) och "Rätta alla"-posterna (`autoRattad`) som "? ej rättad". En lärare med en gammal flik öppen under deployen bör ladda om. *Ej provat:* vad den gamla klientens autosparning gör om läraren rättar i en sådan flik. |
| F6 | info (avsiktligt, #763) | elevens resultat, `ordna` | En påbörjad ordning (3 av 5 placerade) räknas som obesvarad → "✗ Fel · 0 av 2 p", men resultatet visar ✓ vid de tre placerade sakerna. Stämmer med PROV.md, men kan förvirra eleven. Förslag: skriv "Inte färdig – 3 av 5 placerade" i resultatet. |
| F7 | info (känd, Etapp 1 F7) | elevens provlista | Tillbakalämnade prov syns först efter omladdning (Cleo: "Just nu finns inget prov att skriva" tills F5). |
| F8 | info (avsiktligt, #762) | elevsidan | Gamla prov visar nu också "Provet ger högst 17 poäng" överst (`visaPoangForElev` saknas = på). |

Rättelserna ändrar inte reglerna, indexen eller functions. Bootgrafen är oförändrad (107).

## Vad som testades

Rigg: `admin/qa-prov3-preview.sh` (ny, se nedan). Konton `qaarskurs4` (4A, 4B). Proven
skapades via "Skapa med AI" (JSON) och redigerades sedan i formulären.

**Skapa och redigera (§2.2, §2.3, §2.3.1, §2.5) – grönt.**
"Vikingaprovet E3": Del 1 – Fakta (flerval 1 p, flera rätt 2 p, sant/falskt, kortsvar 1,5 p
utan exakt stavning, lucktext 2 p), Del 2 – Ordna och para (ordna 5 saker 2 p, para 4 par
3 p), Del 3 – Skriv (fritext 4 p med kriterier, fritext 7 p med kriterier).
- Sant/falskt ändrat 1 → **0,5** i formuläret: kortet "0,5 p", överst "9 frågor · 23 p",
  Del 1 "5 frågor · 7 p".
- Ett tredje kriterium lagt till i formuläret ("3 poängkriterier").
- **Del 3 tillagd via "Lägg till fråga" → Avsnitt**, hamnade sist ("0 frågor") och flyttades
  med **Flytta till… → 8 + Enter**: hamnade före fråga 8 ("2 frågor · 11 p"), numreringen
  löpande 1–9.
- **Alt + pil upp / ned** på fråga 7 bytte plats med fråga 6 och tillbaka; fokus följde med.
- Inställningar: visa poängen (på), **Visa poängkriterierna** (på), nivåer (på), mynt 3 per
  poäng, "Fel svar på kortsvar rättas som fel" (på, standard). Sparat utan fel.

**Eleverna (§2.3.1, §5.5) – grönt.**
- **Alva, mobil 390 × 844 med touch** (`emulate … mobile,touch`, riktiga klick via CDP):
  "Provet ger högst 23 poäng", frågelistan grupperad per avsnitt, "(0,5 p)"/"(1,5 p)".
  Ordna: tryck på fel sak → plats 2; tryck på plats 1 → **de under flyttar upp**; **Börja om**
  → "0 av 5 placerade"; därefter **exakt 5 tryck** → "Alla 5 placerade". Para: **2 tryck per
  par**, samma färg + siffra + linje, tryck på ett par tar isär det, förklaring först sedan
  begrepp fungerar också; "4 av 4 par klara". Tryckytor 48 px. Ingen sidledsscroll.
- **Omladdning ⇒ samma blandning:** Bilal (desktop) Kvar `börjar, Svolder, kristet, slutar,
  Birka` / para `Åska, Kärlek, Visdom, List` före och efter omladdning; Alva hade en annan
  ordning (`slutar, Birka, börjar, kristet, Svolder`). Alvas svar återställdes efter
  omladdning.
- **Bilal, desktop 1366, tangentbord:** Enter lägger till (fokus till nästa i Kvar), Tab /
  Shift+Tab mellan sakerna, para med Enter → Tab ×4 → Enter.
- Cleo: ordna 3 av 5 → inlämningsrutan "Fråga 6 och 8 är obesvarade". Dante lämnade inte in
  → "Inlämnat (stängt)" när provet stängdes.

**Rätta alla automatiska frågor (§6.0) – grönt.**
- Från tillfällets översikt (öppnar rättningen med `&rattaAlla=1`): **"27 svar rättades
  automatiskt. 1 kortsvar behöver din bedömning. 8 fritextsvar väntar på rättning."**
  (4 elever × 7 auto-frågor = 28, minus Bilals "Björkön").
- Kortsvaret grupperat: "”Björkö” – 2 elever (Alva, Dante: "björkö")" ✓ Auto · "”Birkaön”"
  ✗ Fel Auto (fel svar → fel, standard) · "”Björkön”" **Auto · ½ Delvis rätt** (förslaget
  ligger kvar, inte rättat) (`rattning-kortsvar-grupper-1366.png`).
- Fritexten orörd ("? Inte rättad"); obesvarad fritext har bara ett förslag (Auto · ✗).
- Andra trycket direkt: "Inga nya svar att rätta automatiskt." – 0 skrivningar.
- **Facit i efterhand:** "Godkänn även ”Birkaön”" → 1 skrivning (`privat/facit`) → Rätta
  alla igen: "1 svar rättades automatiskt", Cleo ✓ Rätt Auto. Se F3.
- **Manuellt orört:** Bilals "Björkön" satt till Rätt med tangenten **1** → Rätta alla igen:
  "Inga nya svar…", Bilal kvar ✓ Rätt utan Auto, 0 skrivningar.
- **Öppet prov:** Rätta alla medan Fadi fortfarande skrev → bara Ebba (inlämnad) rättades
  ("1 skriver fortfarande"); efter Stäng + nytt tryck rättades Fadi (obesvarat = fel).

**Halvpoäng i rättningen (§6.1–6.2) – grönt.**
- 4 p-fritext: snabbknapparna 0, ½, 1 … 3½, 4 (Alva 3½, Bilal 1½), "Godkänn alla förslag (2)".
- 7 p-fritext: **− och +** i stället för snabbknappar; tangenten **N** till nästa fråga,
  **+ + + −** på Alvas kort → 1; +-knappen ×9 → 5,5; Bilal +×20 → **7 och + inaktiv**
  (✓ Rätt); Cleo − från tomt → 0 (✗); sifferfältet "2,5" → 2,5 (½), "9,3" → **7** (klämt).
- Sant/falskt på 0,5 p: ingen Delvis-knapp (bara Rätt, Fel, 0, ½).
- Per elev: summorna exakta – Alva 21, Bilal 11, Cleo 8,5, Dante 5 av 23 (räknat för hand),
  delpoäng nedåt (Bilal ordna 3/5 → 1 p, para 2/4 → 1,5 p; Dante ordna baklänges → 0 = Fel).

**Tillbakalämning, resultat, statistik, utskrift – grönt.**
- "Lämna tillbaka till alla rättade" → "4 av 4 rättade · 4 tillbakalämnade", "Pluggmynt
  utbetalda till 4 elever". Se F4.
- **Elevens resultat** (Alva mobil, Cleo desktop): "21 av 23 poäng", "+63 mynt", "Del 1 –
  Fakta: 7 av 7 · Del 2 – Ordna och para: 5 av 5 · Del 3 – Skriv: 9 av 11", avsnittsrubriker
  med "9 av 11 poäng", "3,5 av 4 p", **Poängkriterier** under fritextsvaren, ingen "Auto".
  Cleo: "8,5 av 23 poäng", "Godkända svar: Björkö · Birkaön". Se F2, F6.
- **Översikten:** "Per avsnitt (klassens snitt): Del 1 5,4 av 7 · Del 2 2,3 av 5 · Del 3
  3,8 av 11" (efter F1), rutnät med avsnittsrubriker och Σ-kolumn per avsnitt, klassens
  snitt 49 % (`oversikt-avsnitt-1366.png`). Fördjupad: "Per avsnitt" och avsnittets namn på
  varje fråga i "Per fråga".
- **Utskrift:** provet med "Del 1 – Fakta (7 p)", "(0,5 p)", "(1,5 p)"; facitbladet grupperat
  per avsnitt med "Björkö · Birkaön" och poängkriterierna. Riktig A4-PDF via
  `admin/qa-prov2-utskrift.mjs`: resultat 4 elever 12/11 sidor (med/utan facit), provet 4
  sidor, med facit 5.
- **Klassens Prov-flik:** två tillfällen, Bilal över tid 63 % / 48 % – en fråga (7 rättningar).

**#759 i samspel – grönt.** "Stavfelsprovet E3" (kortsvar 1,5 p + lucktext 1 p utan exakt
stavning, flerval 0,5 p, sant/falskt 1 p), **Rätta stavfel själv**, gränser **50/75**.
Rätta alla: "10 svar rättades automatiskt. 2 kortsvar och lucktexter behöver din
bedömning" – Cleo "Bjorkö" och Alva "Mälarn" **"? Inte rättad"** (ingen post), facit-raden
"stavfel rättar du själv". Efter manuell rättning (Alva lucka Fel, Cleo Delvis = 0,5):
Alva **3/4 · 75 % grön**, Bilal 2,5/4 · 63 % gul, Cleo **2/4 · 50 % gul**,
"Färggränser: röd under 50 %, gul 50–74 %, grön 75 % eller mer"
(`759-stavfel-granser-50-75-1366.png`).

**Gamla prov – grönt.** I den **gamla appen** (origin/main): "Gamla provet E2" (8 frågor,
heltal, 17 p, inga avsnitt) kördes i 4B; Ebba och Fadi lämnade in, Gry stängdes; läraren
godkände fråga 1 för alla, rättade Ebba helt och lämnade tillbaka henne. I den **nya appen**:
- Rättningen läser det: "1 av 3 rättade · 1 tillbakalämnade"; Rätta alla → "12 svar
  rättades automatiskt. 2 fritextsvar väntar. **1 tillbakalämnat prov rördes inte.**" –
  2 skrivningar (Fadi, Gry), Ebba orörd.
- Översikten: kolumner 1–8, inga avsnitt/Σ, "15/17 · 88 %" för Ebba.
- Ebbas resultat: "15 av 17 poäng", inga avsnittsrader eller kriterier.
- Redigeraren: "Frågor: 8 frågor · 17 p", inga avsnitt, sparas utan fel.
- **Ett tillfälle öppnat i den gamla appen** (utan `blandningar`) besvarat i den nya: ordna
  visar samma ordning som den gamla appen (4 tryck), para 6 tryck; Rätta alla 7/7 rätt.

**Säkerhet (elevens konsol, Alva):** läsa egen rättning före tillbakalämning, läsa
`privat/facit`, ändra egen `totalPoang`, skriva ett facit-tillägg, lista klassens
rättningar → alla `permission-denied`; läsa egen tillbakalämnade rättning (med `kriterier`)
→ tillåtet.

**Ett steg längre (utöver listan):** gamla appen mot Etapp 3-data (F5), mynt × halvpoäng
(F4), konsolförsök (ovan), Rätta alla på ett öppet prov, avrundning av alla snitt/procent
(F1), 320/540 px för resultatet (F2). Drag och släpp med finger (långtryck) provades inte –
täcks av `test/prov-ordna-para.test.js` och #763:s förhandsvisning.

## Kvot (§9) – vad Etapp 3 lägger till

Mätt med `QA_RAKNA=1` i proxyn (levererade och skrivna dokument per port; transaktionernas
commit räknas inte – mynten är därför räknade ur PROV.md).

| Del | Läsningar | Skrivningar | Källa |
| --- | --- | --- | --- |
| Rättningsvyn öppnas (4 elever, nytt tillfälle) | 17 (tillfälle, facit, 4 svar, 4 namn, …) | 0 | mätt |
| Rättningsvyn öppnas (3 elever, gammalt tillfälle med rättningar) | 12 | 0 | mätt |
| **Rätta alla**, första trycket (4 elever) | **0** | **5** = 4 rättningar + räkneverket | mätt |
| Rätta alla igen utan ändring | 0 | **0** | mätt |
| Facit i efterhand ("Godkänn även") | 0 | 1 (`privat/facit`) | mätt |
| Rätta alla efter tillägget | 0 | 1 (bara den ändrade eleven) | mätt |
| Gammalt tillfälle, 2 ej rättade + 1 tillbakalämnad | 0 | 2 | mätt |
| Tillbakalämning (4) | 0 | 5 + mynten (3 per elev) | mätt + PROV.md |
| Statistik per avsnitt, resultat, utskrift | 0 | 0 | mätt / koden |
| Klassens Prov-flik | 1 fråga (7 rättningar) | 0 | mätt |

**25 elever:** Rätta alla ≈ **26 skrivningar** per tryck (≈ 1 per elev, §6.0), 0 extra
läsningar. Etapp 3 ändrar inte elevens autosparning. Summan för ett prov med rättning och
statistik stannar på Etapp 2:s nivå: läsningar ≈ 1 600, skrivningar realistiskt ≈ 1 550
(värsta fallet ≈ 3 060), under 3 000/3 000 i praktiken.

## Deploy

1. `firebase deploy --only firestore:rules` – **före webben.** Etapp 3 ändrar
   `firestore.rules` (+46/−9 mot main): `provHalvpoang` (halva poäng, total ≤ max),
   `provInstOk` (`visaPoangForElev`, `visaKriterier`, `felKortsvarFel`), fälten i
   `privat/facit` (`facit`, `bedomningsstod`, `kriterier`), `provKriterierOk` och
   `rattning.kriterier` bara efter tillbakalämning. Med ny webb och gamla regler nekas en
   tillbakalämning med "Visa poängkriterierna" (#762).
2. Webben (merge till main → GitHub Pages). Be lärare ladda om sidan (F5).
3. **Inga index, inga functions.**

Ordningen: **regler först, sedan webben.** De nya reglerna godtar allt den gamla webben
skriver (testat i `test:rules`).

## Kända begränsningar

- F3 (facit-raden uppdateras först vid omladdning), F4–F8 ovan.
- Från Etapp 1/2: tillbakalämnade prov syns först efter omladdning; "Sparar…" upp till 24 s.
- Emojis visas som rutor i den huvudlösa testwebbläsaren (saknat typsnitt).

## Skärmdumpar (`docs/qa-prov-766/`)

| Fil | Visar |
| --- | --- |
| `redigerare-avsnitt-1366.png` | redigeraren: avsnittskort med "5 frågor · 7 p", 0,5 p och 1,5 p |
| `elev-mobil-390-start.png` | elev på mobil: "Provet ger högst 23 poäng", frågelistan per avsnitt |
| `elev-mobil-390-ordna-para.png`, `elev-mobil-390-para.png` | ordna efter 5 tryck, para med färg/siffra/linje |
| `elev-desktop-1366-ordna-para.png` | Bilal på desktop (tangentbord), avsnittsgrupperad frågelista |
| `rattning-kortsvar-grupper-1366.png` | efter Rätta alla: grupper, Auto, förslaget "Björkön", "Godkänn även" |
| `rattning-fritext-7p-kriterier-1366.png` | 7 p-fritext: − / +, 5,5, kriterierna bredvid svaret, + inaktiv vid max |
| `rattning-mobil-390.png` | rättningen på mobil: halvpoängsknapparna, kriterierna under svaret |
| `oversikt-avsnitt-1366.png` | Översikten med avsnitt, Σ-kolumner, "3,8 av 11" (F1 rättad) |
| `resultat-alva-mobil-390.png` | elevens resultat: poäng per avsnitt, mynt |
| `resultat-alva-mobil-390-kriterier.png` | poängkriterierna i resultatet + F2 rättad (etiketten under texten) |
| `utskrift-prov-1366.png` | utskriften av provet med avsnitt och halvpoäng |
| `759-stavfel-granser-50-75-1366.png` | #759: rätta stavfel själv + gränserna 50/75 på halvpoäng |

## Rigg och verktyg

- `admin/qa-prov3-preview.sh` – i förgrunden (för `barista_serve`): emulatorer (FS 8966,
  Auth 9966, `-Xmx1200m`), seed (`qa-larkonton-seed`, `qa-larkonton-roller-seed`), den nya
  appen på **8766** och den **gamla appen** (`OLD_REF`, standard `origin/main`, via
  `git archive`) på **8767** – båda med `QA_RAKNA=1`. `JAVA_BIN`/`FIREBASE_BIN` läggs först
  på PATH. En inloggning per `isolatedContext` i webbläsaren.
- `admin/qa-prov3-svara.js` – fyller elevens provsida med Etapp 3-rutorna (ordna = ett
  tryck per sak, para = två tryck per par) och returnerar antalet tryck.
- `admin/qa-prov2-utskrift.mjs` – riktig A4-PDF; i den här riggen behövs längre väntan
  efter inloggningen (annars "Sajten uppdateras just nu").
- Fälla: `/__qa/rakna?nollstall` returnerar siffrorna EFTER nollningen – läs först.
