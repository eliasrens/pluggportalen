# QA-rapport – Prov Etapp 2 (#749)

Slut-QA av epicen Prov Etapp 2 (#745–#748) på epic-grenen `6ca546f`. Spec:
`docs/UTVECKLINGSUPPDRAG_PROV.md` §10–15 + "Dokumentation och rapport". Kontraktet:
`docs/PROV.md`. Allt kördes mot Firebase-emulatorerna i en riktig webbläsare (lärare
+ upp till sex samtidiga elever i egna inloggningar). Inget skrevs mot live.

## Sammanfattning

- **Hela Etapp 2 fungerar i webbläsaren:** Hämta från område (alla fem sorter +
  bildpar-varningen), pluggmynt (per poäng, tak 200, ångra + ny tillbakalämning,
  dubbelklick, två flikar, omprov som delar kvittot), fördjupad statistik + CSV +
  jämförelse, utskrift av prov och resultat (riktig A4-PDF), extra tid (före och
  under provet, live hos eleven), omprov för valda elever (elev utanför nekas) och
  flikbyte-info i rättningen.
- **Etapp 1-flödet är oförändrat** (regression): skapa → kör i klass med fokuslås →
  autosparning → lämna in → stäng → rätta per fråga/per elev → lämna tillbaka →
  resultatvy → klassens Prov-flik (en fråga).
- **Säkerheten håller:** elevens försök att skapa kvitto + mynt, höja kvittot, ändra
  `myntUtbetalt`, ändra flikbyten efter inlämning, radera kvittot, läsa en annan
  klass tillfälle och starta ett omprov hen inte är vald till → alla
  `permission-denied`.
- **Inga buggar som blockerar.** F1–F5 (en låg, fyra kosmetiska) är **rättade på
  tester-grenen och verifierade i webbläsaren** (epic-leadens beslut). F6–F9 är info
  och står kvar som kända begränsningar.
- **Sviterna gröna:** unit 2968/2968 efter rättningarna (2966 före, +2 nya tester),
  `test:rules` 703/703 och `test:functions` 232/232 (reglerna och functions rördes
  inte av rättningarna), bootgrafen 107 filer (ingen `src/prov/`).

## Automatiska sviter

| Svit | Resultat | Hur |
| --- | --- | --- |
| Unit | **2966 pass, 0 fail** (1 skip); efter F1–F5 **2968 pass** | `node --test $(ls test/*.test.js \| grep -v firestore-rules) test/admin-credential.test.mjs test/brakresan-drake-art.test.mjs` (filerna `firestore-rules*.test.js` kräver emulatorn och körs i nästa rad) |
| `test:rules` (56 filer) | **703/703** | en Firestore-emulator på slumpport, `-Xmx1200m`, `FIRESTORE_EMULATOR_HOST=… node --test <listan i package.json>` |
| `test:functions` (22 filer) | **232/232** | `firebase emulators:exec --only functions,auth,firestore` med egen `.qa-*.firebase.json` (slumpportar) och `FUNCTIONS_EMULATOR_HOST` hämtad ur hubben (functions-emulatorn tar inte alltid den port man ger den) |
| Bootgrafen | **107 filer**, ingen `src/prov/` | `node admin/qa-bootgraf-bfs.mjs` |

En emulator åt gången. Etapp 2 rör inga functions.

## Fynd

| # | Allvar | Var | Vad |
| --- | --- | --- | --- |
| F1 | låg (UX) – ✅ rättad `f5e8f71` | `src/prov/prov-tillfalle-rutor.js:149–153`, `prov-tillfalle-logik.js:130` | **Fokuslåsets förval räknade inte med extra tid.** Tidsgräns 40 min → låset förvalt till +50 min. Dante fick +15 (sedan +30) men låset släpper ändå vid +50 – han kan skriva klart men är olåst de sista 5–20 minuterna. Lärarens "Extra tid" under provet förlänger inte heller låset. **Rättat:** `standardLasMinuter(tidsgräns, extraTid)` = tidsgräns + längsta giltiga extra tid + 10; Kör i klass och Öppna räknar om förvalet när extra tid ändras (tills läraren själv rört klockslaget). Verifierat 09:39: 40 min → 10:30, Dante +30 → 11:00, bara Alva +15 → 10:45; låset sparades till 11:00 (`f1-las-extra-tid-1366.png`). Nytt test i `test/prov-tillfalle.test.js`. Kvar: "Extra tid" under ett pågående prov förlänger inte ett redan satt lås – läraren ändrar låset under Klasser. |
| F2 | kosmetisk – ✅ rättad `c9decee` | `prov-elev-sida.js:111`, `prov-resultat-vy.js:31`, `prov-klass-statistik.js`, `prov-statistik-fordjupad.js:116` | **Omprovet såg ut som ett eget prov utanför lärarens lista.** Elevens lista visar två "Vikingaprovet QA2"; resultatet visar "+12 mynt" på ursprunget och "+50 mynt" på omprovet – Cleo fick 50 totalt, men det ser ut som 62 (omprovets `myntUtbetalt` speglar provets sammanlagda mynt, som avsett i #748). Klassens Prov-flik har två rader med samma namn, och jämförelsen kallar omprovet "4A (2)". Lärarens tillfällelista säger rätt "– omprov (2 elever)". **Rättat (ingen ändring i datamodellen):** `elevProvNamn(tf)` = "Vikingaprovet F (omprov)" – elevens listor och provsida, resultatet och rättningens `provNamn` (som klassens Prov-flik läser); jämförelsen säger "4A omprov"; omprovets resultat visar "Totalt 16 mynt för provet" i stället för "+16" (ursprunget "+4"). Verifierat i webbläsaren (`f2-elev-resultat-omprov.png`); tester i `prov-anpassningar`, `prov-mynt` och `prov-statistik-fordjupad`. Rättningar som skapades före rättelsen behåller sitt gamla namn. |
| F3 | kosmetisk – ✅ rättad `6c13bf2` | `src/prov/larare/provl-mynt.js:52` | Med "Mynt per poäng" valt: stäng av "Poängsätt frågorna" → valet byts tyst till "Inga mynt" (radioknappen blir grå med "– kräver att frågorna poängsätts"). Slog man på poängsättningen igen kom valet inte tillbaka. **Rättat:** "per poäng" kommer tillbaka när poängsättningen slås på igen, om läraren inte valt något annat under tiden. Verifierat: per poäng → av (Inga, grå) → på (per poäng igen); av → välj Fast → på (Fast kvar). |
| F4 | kosmetisk – ✅ rättad `e1d2d4b` | `src/prov/prov-utskrift.js:32–56` | Utskriftsvyn (helskärm) stängs bara med Stäng/Esc – inte när sidan byts (webbläsarens Bakåt eller hash-byte). Den låg kvar över statistiksidan. **Rättat:** vyn stängs vid `hashchange`. Verifierat: Skriv ut resultat → Bakåt → ingen `.provl-utskrift` kvar. (Inloggningskorten har samma mönster kvar.) |
| F5 | kosmetisk – ✅ rättad `5603118` + `67710cb` | "Hämta från område"-rutan | Två scrollnivåer (listan scrollar i rutan som också scrollar). På 1366×900 med ett stort område hamnade "Lägg till i provet" under kanten tills man scrollade rutan (före: `hamta-fran-omrade-1366.png`). **Rättat:** rutan är en kolumn där bara listan scrollar; sammanfattningen, varningarna och knapparna ligger alltid synliga. Verifierat med alla 29 saker valda: 1366×900 knappen slutar på 862 px, 1366×768 på 730 px, enda scrollytan är listan (`f5-hamta-1366x900.png`). Bara på mycket låga skärmar (≈ 700 px) scrollar rutan som reserv. |
| F6 | info | `firestore.rules` `provMyntKvittoOk` | Taket 200 och kvittot gäller **per tillfälle** (plus dess omprov). Kör läraren samma prov som ett nytt vanligt tillfälle i samma klass börjar ett nytt kvitto – eleven kan få upp till 200 till. Spec: "per prov och elev". Läraren styr det själv; omprov är rätt väg. |
| F7 | info (känd avvikelse #748) | `provTillfallen/{omprov}` | Omprovets tillfälle är läsbart för hela klassen, med `extraTid`. Bilal (inte vald) läste `{ <Dantes uid>: 30 }` från konsolen. Inget facit, inga namn, och han kan inte starta eller skriva (nekad). Dokumenterat i PROV.md. |
| F8 | info | statistiken | Omprovets resultat räknas inte in i ursprungets Översikt, CSV eller utskrift – de syns i omprovets egen Översikt och som en kolumn i jämförelsen. |
| F9 | info (kvot) | §9 | Värsta fallet för skrivningar går precis över 3 000 med mynt: Etapp 1 ≈ 2 950 + 75 (mynt) + några (extra tid) ≈ **3 030**. Det kräver att alla 25 elever ändrar ett svar var 24:e sekund i 40 minuter. Realistiskt ≈ 1 500. Se kvoten nedan. |

Från Etapp 1 (kvar, sågs igen): F7 – tillbakalämnade prov syns först efter
omladdning; F8 – "Sparar…" står kvar upp till 24 s.

Rättelserna ändrar inte reglerna, indexen eller functions. Bootgrafen är oförändrad (107).

## Vad som testades

Konton (emulator): `qaarskurs4` (4A, 4B); elever 4A Alva, Bilal, Cleo, Dante; 4B
Ebba, Fadi. Området "QA Prov 2 – alla sorter" (`admin/qa-prov2-seed.mjs`) har alla
sorter och kantfall.

**§10 Hämta från område – grönt.** Ämne SO → området listar 5 grupper med kryssrutor:
Quizfrågor (4, varav 2 grå: "har 7 alternativ – ett prov tar 2–6", "två
alternativ är likadana"), Läsförståelse (2 texter, 3 frågor), Par (14, varav 2 grå
"bara bild" + varningen "2 par har bara en bild och hoppas över – ett prov visar
bara text"), Tidslinje (6, med f.Kr.), Ämnesläsningstexter (1 – den gamla
nivåtexten visas inte). "Välj alla" i alla → "Det blir 11 frågor och 3 textblock" +
"12 par blev 2 Para ihop-frågor" + "Jellingstenen … också från 965 … hoppades över".
Resultatet i provet: 2 flerval, textblock + 2 flerval, textblock + 1 flerval, para
6 + 6 ("del 1 av 2"), ordna 5 händelser (sorterade efter år, blandade hos
eleven), textblock (ämnestexten med titel) + 3 flerval = 25 p. Sparat och kört.

**§11 Pluggmynt – grönt.** Mynt per poäng (2):

| Steg | Förväntat | Kvitto / coins |
| --- | --- | --- |
| Lämna tillbaka till alla (knappen klickad **två gånger** direkt) | Alva 25 p → 50, Bilal 12 → 24, Cleo 6 → 12, Dante 3 (stängt) → 6, **en gång** | 50 / 24 / 12 / 6 ✓ |
| Alvas resultatvy | "+50 mynt", saldo 50 | ✓ (`resultat-alva-mynt-1920.png`) |
| Ångra Bilal | mynten kvar | 24 ✓ |
| Bilal rättas upp till 14 p, **två flikar** lämnar tillbaka samtidigt (samma millisekund) | skillnaden 4, en gång | 28 ✓ (båda flikarna visar "28 pluggmynt utbetalda") |
| Ångra, ner till 13 p, lämna tillbaka | inget dras, inget betalas | 28 ✓, `myntUtbetalt` 28 |
| Ångra, kommentarer, lämna tillbaka en tredje gång | inget betalas | 28 ✓ |
| Omprov Cleo 25 p, Dante 5 p | ett kvitto (ursprungets), `senast` = omprovet; Cleo 12 → 50 (betalar 38), Dante 6 → 10 | ✓ |
| 20 mynt per poäng, Fadi 25 p (500) | taket | 200 ✓ |

Redigeraren: 25 per poäng → "Mynt: mynt per poäng måste vara ett heltal 1–20."
Tillbakalämningsrutan säger "Pluggmynt: 2 pluggmynt per poäng (högst 200). Har en
elev redan fått mynt för provet betalas bara skillnaden ut." Rättningen per elev:
"✓ Tillbakalämnat … · med facit · 28 pluggmynt utbetalda." Se F2, F3, F6.

**§12 Fördjupad statistik – grönt.** Per fråga sorterad svårast först (Fråga 4
25 %, 7 33 %, 8 40 %, … 3 100 %) med staplar rätt/delvis/fel; fördelningen i steg om
10 % och nivåerna; färgerna stämmer (Alva 100 % grön, Bilal 52 % gul, Cleo 24 %
och Dante 12 % röda). **Jämförelsen** läser först på knapptryck: mätt **6
läsningar** (3 tillfällen + 3 rättningar) – Översikten själv 0. Kolumnerna 4A, 4A (2)
= omprovet (F2), 4B, 4B (2), bara egna klasser. **CSV**:
`Vikingaprovet QA2 – 4A.csv`, UTF-8 med BOM, `;`, rubriker "Fråga N (p)", Poäng,
Av (rättade), Procent, Färg, Nivå, Status – rätt värden för alla fyra.

**§13 Utskrift – grönt.** Riktig A4-PDF ur den riktiga appen
(`admin/qa-prov2-utskrift.mjs`, Chromium `Page.printToPDF`): resultat 4 elever →
11 sidor (varje elev börjar på en ny sida, `break-before: page`), med/utan facit
(32 resp. 0 "Rätt svar" i vyn); provet 3 sidor, med facit på eget blad 4 sidor.
Bilder i print-media: `utskrift-prov.png` (namn-, klass-, datumrad, kryssrutor,
para med bokstäver och skrivlinjer), `utskrift-resultat-bilal.png`
(helhetskommentar, frågekommentar, symbol + text för svartvitt). Se F4.

**§14 Anpassningar – grönt.**
- *Extra tid:* Kör i klass → Dante +15 → elevens start "Du har 55 minuter";
  översikten "Dante +15 min … 55 min". Under provet "Extra tid" → +30 → Dantes
  nedräkning blev 69 min utan omladdning. Regeln (tidsgräns + extra + 2 min, bara
  för den eleven) täcks av `firestore-rules-prov-anpassningar` (6 tester); den
  automatiska inlämningen när tiden tar slut testades i Etapp 1 och väntades inte ut
  här. Se F1.
- *Omprov:* "Omprov" → Cleo + Dante → "Vikingaprovet QA2 – omprov (2 elever)",
  inget fokuslås ("låser hela klassen och används inte för omprov"), tidsgräns och
  extra tid förifyllda från ursprunget. Bilal (inte vald) ser inget i sin lista;
  `setDoc` på `svar/{bilal}` → **permission-denied**. Omprov av omprovet erbjuder
  bara Cleo och Dante och sparar `omprovAv` = ursprunget.
- *Flikbyten:* två `visibilitychange` (dold → synlig) hos Alva → rättningen per
  elev: "Alva · Lämnade provet 2 gånger" (`rattning-per-elev-flikbyten-1366.png`).
  Inga extra skrivningar (följer autosparningen).

**Regression Etapp 1 – grönt.** Fokuslås (elev direkt till provet efter
inloggning, "Fokus: Vikingaprovet QA2 till 01:55"), autosparning, "Du har svarat på
10 av 11 frågor", inlämning, stäng → "Inlämnat (stängt)", rättning per fråga med
"Godkänn alla förslag", per elev, nivå, kommentarer, tillbakalämning, resultatvy med
facit, klassens Prov-flik = **en** fråga (6 rättningar), "Lämna tillbaka till alla
rättade". Inga konsolfel hos lärare eller elev.

**Säkerhet (elevens konsol, Fadi efter tillbakalämningen):** kvitto + coins i en
transaktion, höja eget kvitto, `rattning.myntUtbetalt`, `flikbyten` efter inlämning,
radera kvittot, läsa 4A:s tillfälle → alla nekade; läsa eget kvitto → tillåtet.
Regeltesterna täcker resten (annan klass lärare, avstängt konto, årskurskontots
`lastProvMynt`, omprovets kvitto, taket).

**Skärmar.** Elev 390 × 844 (mobil, `elev-mobil-390-*.png`, ingen horisontell
scroll), 1366 (`elev-provsida-1366.png`), 1920 (`resultat-alva-mynt-1920.png`);
lärare 1366 och 1920.

## Kvot (§9) – vad Etapp 2 lägger till

Mätt med `QA_RAKNA=1` där det gick (proxyn räknar levererade och skrivna dokument;
transaktionernas commit räknas inte av proxyn – därför räknat ur koden för mynten).

| Del | Läsningar | Skrivningar | Källa |
| --- | --- | --- | --- |
| Hämta från område | ämnen + områdena i ett ämne (här 2 + 5), cachat | 0 | mätt |
| Mynt vid tillbakalämning | 4 per elev (kvitto, rättning, svar, saldo) = **100** | 3 per elev = **75** | `prov-mynt-pay.js`, PROV.md |
| Ny tillbakalämning (skillnad/redan) | 4 per elev | 0–3 per elev | dito |
| Extra tid | 0 för eleven; läraren namn ≤ 25 när listan fälls ut | 1 per ändring | mätt + PROV.md |
| Omprov | namn + ursprungets svar ≤ 50 | tillfälle + facit | PROV.md |
| Flikbyten | 0 | 0 extra (inom autosparningens tak) | koden |
| Fördjupad statistik, CSV, utskrift | **0** | 0 | mätt |
| Jämförelse (på knapptryck) | tillfällena + rättningar per annat tillfälle (mätt 6; 3 klasser × 25 ≈ 78) | 0 | mätt |

**Summa för ett prov med mynt** (25 elever, 12 frågor, 40 min, med rättning och
statistik): läsningar ≈ 1 500 + 100 ≈ **1 600**; skrivningar realistiskt
≈ 1 400 + 75 ≈ **1 500**, värsta fall ≈ **3 030** (F9).

## Deploy

1. `firebase deploy --only firestore:rules` – **före webben.** Nya: `provMynt`
   (kvittot), `provMyntBetalt`/`provMyntKvittoOk`/`provMyntFaltOk`,
   `myntUtbetalt` i rättningen, `extraTid`/`elevIds`/`omprovAv` på tillfället,
   `provGallerElev`/`provElevMinuter`, `flikbyten` i svaret. Den gamla regeln känner
   inte `flikbyten` → med ny webb och gamla regler nekas elevens autosparning.
2. Webben (merge till main → GitHub Pages).
3. Inga nya index (bara Etapp 1:s, redan i main via PR #758), inga functions.

Före regel-deployen nekas utbetalningen tyst och görs om när rättningen öppnas igen.

## Kända begränsningar

- F6–F9 ovan, och resten av F1 (extra tid under provet förlänger inte låset).
- Taket 200 är per tillfälle + omprov, inte per prov över flera tillfällen (F6).
- Omprovets tillfälle läses av hela klassen (F7) – reglerna kan inte filtrera
  elevens lyssnare på `elevIds`.
- Flikbyten är information, inte bevis: eleven kan inte sänka siffran efter
  inlämning, men under provet är fältet inte monotont (två flikar skulle annars
  få sparningen nekad).
- Emojis visas som rutor i den huvudlösa testwebbläsaren (saknat typsnitt).

## Skärmdumpar (`docs/qa-prov-749/`)

| Fil | Visar |
| --- | --- |
| `hamta-fran-omrade-1366.png` | Hämta från område: grupper, "Det blir 11 frågor och 3 textblock" |
| `elev-provsida-1366.png` | elevens provsida (ordna + para) |
| `elev-mobil-390-dante.png`, `elev-mobil-390-para.png` | elev på mobil, 55 min (extra tid), para-frågan |
| `rattning-per-elev-flikbyten-1366.png` | rättning per elev: "Lämnade provet 2 gånger" |
| `resultat-alva-mynt-1920.png` | resultatvyn med "+50 mynt" och saldo 50 |
| `statistik-fordjupad-1366.png` | per fråga (svårast först) + fördelningen |
| `jamfor-klasser-1920.png` | jämförelsen 4A / 4A (2) / 4B / 4B (2) |
| `provtillfallen-omprov-1366.png` | tillfällelistan med "– omprov (2 elever)" |
| `utskrift-prov.png`, `utskrift-resultat-bilal.png` | utskrifterna i print-media (A4-bredd) |
| `f1-las-extra-tid-1366.png` | F1 rättad: låset förvalt till 11:00 med Dante +30 (40 min) |
| `f2-elev-resultat-omprov.png` | F2 rättad: "Vikingaprovet F (omprov)", "Totalt 16 mynt för provet" |
| `f5-hamta-1366x900.png` | F5 rättad: bara listan scrollar, knappen syns |

## Rigg och verktyg

- `admin/qa-prov2-preview.sh` – i förgrunden (för `barista_serve`): emulatorer
  (FS 8949, Auth 9949, `-Xmx1200m`), seed (`qa-larkonton-seed`,
  `qa-larkonton-roller-seed`, `qa-prov2-seed`) och appen på 8749–8752 med
  `QA_RAKNA=1`. `JAVA_BIN`/`FIREBASE_BIN` läggs först på PATH.
- `admin/qa-prov2-seed.mjs` – området "QA Prov 2 – alla sorter" med alla kantfall,
  tar bort 4A:s Live-lobby.
- `admin/qa-prov2-utskrift.mjs <origin> <tillfälle> <ut-mapp>` – riktig A4-PDF av
  de fyra utskrifterna ur den riktiga appen + sidantal.
- `admin/qa-prov-svara.js` (#743) fyller i elevens provsida.
- Dokument läses i webbläsaren via proxyn med `Authorization: Bearer owner`
  (`/v1/projects/pluggportalen-so-2026/databases/(default)/documents/…`).
- Fälla: `/__qa/rakna?nollstall` returnerar siffrorna EFTER nollningen – läs först.
