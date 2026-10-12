# Etapp 2-rapport – Ekvationsresan (#628, epic #622)

Slut-QA av epicgrenen `f77959b` (`epic/ekvationsresan-etapp-2-…`, med `main` inmergad i `117a9f6`)
mot spec E2.7, plus hela Etapp 1:s testlista (E1.14, test 1–28) som regression.
Spec: `UTVECKLINGSUPPDRAG_EKVATIONSRESAN.md`. Teknisk dokumentation: `docs/EKVATIONSRESAN.md` §7–§11.

**Resultat:** alla punkter i E2.7 är gröna, och Etapp 1:s test 1–28 är gröna som regression.

- QA:n hittade **en liten språkbugg** i en av lärarens meningar. Den är rättad i `7b720cd`.
- QA-skriptet `qa-ekvationsresan-uppgift.mjs` skrev "undefined" i loggen. Det är också rättat (`9118a13`).
- Inga större buggar.
- Bootgrafen är kvar på **107** filer och är identisk med `origin/main`.
- Iakttagelserna O1–O6 nedan blockerar inte landningen.

## Deploy före live

1. `firebase deploy --only firestore:rules`. Reglerna har ändrats på tre ställen:
   - **#625:** `ekvAttemptOk` tillåter `answers` (elevens svar i C–F, högst 40). Utan deployen kan C–F-försök inte sparas. A/B påverkas inte.
   - **#627:** `ekvProgressOk` tillåter `extra` (map) och `ekvAttemptOk` tillåter `extra == true`. Utan deployen kan extrautmaningar inte sparas.
   - **#643:** `maxLevel` får skrivas av läraren (`ekvTeacherLevelOk`). Ändringen kom in via `main`. Om reglerna från main redan är deployade är den punkten klar.
2. Merge till `main` (Pages). **Index och functions är oförändrade** i epicen (`git diff origin/main...HEAD` rör bara `firestore.rules` utanför `src/`, `test/`, `admin/`, `docs/` och `preview/`).

Modulen är fortfarande **av som standard** (`optIn`). Slå inte på den för någon klass innan reglerna är deployade.

## Vad har byggts (och var)

Inga PR:er är öppnade. Allt ligger på epicgrenen:

| Issue | Commit | Innehåll |
| --- | --- | --- |
| #623 A | `04f9632`, `7198b5c` | Nivå 7–12: x-termer i talfältet, x i båda leden, minustal i mellanled från nivå 9, exakta decimaler från nivå 10, BFS med x-termsoperander. |
| #624 B | `0927dca` | Vågen: −x lyfter x-block från båda sidor, minustal som skuld (skuldbrickor och skuld-x-block), stiliserad våg för decimaler, hjälpbilder med x-termer. |
| #625 C | `41c7593`, `1d053cd` | Uppgiftstyperna C–F (nästa rad, bild → ekvation, hitta felet, problemlösning från nivå 3) och de kompletterande stjärnreglerna (`config.TYPE_STARS`). |
| #626 D | `961aca1` | Färdighetsmodellen som styr nästa uppgift, och lärarvyns sammanfattningar och indikatorer. |
| #627 E | `3f0def3`, `c6553e3`, `5dc6599` | Extrautmaningar: negativa x, bråk, svårare decimaler, parenteser och kluriga uppgifter. Ger 7 mynt och påverkar inte nivån. |
| #643 | (via `main`) | Mörkare ÷-bricka, nådd nivå visas ✓ (`maxLevel`), x ≥ 2 från nivå 3. |
| #645 | `aa8578f` | x ≥ 2 även på nivå 7–12. |
| #628 F | denna gren | Slut-QA, skärmdumpar, den här rapporten och två små rättningar. |

## Sviter och bootgraf

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test`, allt utom regler, functions och e2e, 156 filer) | ✅ **2107/2107**, varav **184** i `ekvationsresan-*` |
| `test:rules` (alla 38 filer i en `emulators:exec`, `--test-concurrency=1`) | ✅ **456/456**. Inga RAM-timeouts den här gången |
| `test:e2e` | ✅ 5/5 |
| `test:functions` | Inte körd. `functions/` är oförändrad i epicen. Den var grön (73/73) i Etapp 1-QA:n |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | ✅ **107** filer, identisk med `origin/main` (`4300fec`). 0 `ekvationsresan`-filer i den statiska grafen |
| Laddning i webbläsaren | ✅ Kall laddning av `#/elev/hus` gav 0 Ekvationsresan-filer. När modulen öppnades kom 37 filer (34 js + 3 css), alla från egen origin. Inga nya värdar: `fonts.googleapis.com`, `fonts.gstatic.com` och `www.gstatic.com` fanns redan före epicen |
| Egen generatorkontroll (`docs/qa-ekvationsresan-628/kontroll-generator-modell.txt`) | ✅ 12 000 uppgifter (1 000 per nivå), **0 fel**, se E2.7 nedan |

Ändringen i `7b720cd` kördes om: `ekvationsresan-*` gav 184/184.

## Miljö och metod

- Preview mot emulatorn med `admin/qa-ekvationsresan-preview.sh` (FS 8618, Auth 9618, proxy 8619). Seed med `qa-lasresan-seed` och `qa-ekvationsresan-seed --larare`.
- **En** headless Chromium-flik som styrdes via CDP. Den växlade mellan `elev1` (Astrid), `ekv-av`, `qa-text` och läraren `qalarare`.
  - Desk-webbläsarens MCP kopplade inte i början och nådde sedan inte sandlådans port (`ERR_CONNECTION_REFUSED`).
  - Drag gjordes med riktiga tangenttryck (`Input.dispatchKeyEvent`, t.ex. `-2x` ENTER), och knapparna klickades med riktiga musklick.
- Bestämda ekvationer lades in med `admin/qa-ekvationsresan-uppgift.mjs "3x+17=5x+5" --niva 9 --form ax+b=cx+d`. Etapp 2-formerna gissas inte ur texten, så `--form` behövs för att "Försök igen" ska fungera. Uppgiftstyper lades in med `qa-ekvationsresan-seed --typ C|D|E|F --niva N`.
- Varje påstående om sparad data kontrollerades mot Firestore-emulatorn: progress, försök, saldo och `answers`.
- Lärarvyns tabell kontrollerades mot en **oberoende omräkning** ur elevernas försöksdokument (skript i `/tmp`, inte incheckat):
  - Stjärnfördelning, lösta %, hjälp %, drag och "I korthet" stämmer.
  - `progress.skills` stämmer med `modellUrForsok(försöken)`.
- Mitt i körningen dog emulatorn, proxyn och webbläsaren (exit 137, troligen minnesbrist eller omstart). Allt startades om, och skärmdumparna var redan committade som wip.

## E2.7 – tester i Etapp 2

| Punkt | Resultat |
| --- | --- |
| **Nivå 7–12 genereras korrekt, positiv lösning** | ✅ Egen kontroll med 1 000 uppgifter per nivå, 0 fel. Den kontrollerade att x > 0, att x ≥ 2 från nivå 3, att decimal-x bara finns på nivå 10–11 (216 resp. 67 st, högst två decimaler), att den sparade lösningen = `solve`, att den optimala vägen går att spela med nivåns spärrar och löser ekvationen, och att BFS-stickproven gav 480/480. x-spann: nivå 7: 2–10, 8: 2–12, 9: 2–12, 10: 2–20, 11: 2–135 (x/a-formerna), 12: 2–20. I webbläsaren spelades nivå 7 (`3x + 5 = x + 9`), 8, 9, 10, 11 (`2x + 26 = 4x − 4`) och 12 ([01](qa-ekvationsresan-628/ekv628-01-niva7-1366.png), [02](qa-ekvationsresan-628/ekv628-02-niva7-lost-1366.png), [05](qa-ekvationsresan-628/ekv628-05-niva11-1366.png)). Efter 5 bra uppgifter på nivå 7 kom "🎉 NY NIVÅ! NIVÅ 8 – Fler steg" ([18](qa-ekvationsresan-628/ekv628-18-nivaupp-8-1366.png)) |
| **`−x` och `−2x`** | ✅ Tangentbordet: `-x` ENTER ger `3x + 5 − x = x + 9 − x` → `2x + 5 = 9`. `-2x` ENTER ger `5x − 7 − 2x = 2x + 20 − 2x` → `3x − 7 = 20` → … → `x = 9`, ⭐⭐⭐. Operationen är röd i båda leden. På vågen lyfts x-blocken från båda sidor |
| **Negativa mellanled från nivå 9, stoppas före** | ✅ Nivå 8, `3x + 17 = 5x + 5`, −5x: "Då blir det minustal. Prova ett annat drag!" ([20](qa-ekvationsresan-628/ekv628-20-niva8-minus-stoppas-1366.png)). Nivå 9, samma drag: `−2x + 17 = 5` → −17 → `−2x = −12`. Vågen visar skuld-x-block ([21](qa-ekvationsresan-628/ekv628-21-niva9-negativt-mellanled-1366.png), [03 1920](qa-ekvationsresan-628/ekv628-03-niva9-1920.png)). Hjälpen leder vidare: "Det står minus framför x. Vad kan du lägga till …" → "Addera 2x till båda leden." ([22](qa-ekvationsresan-628/ekv628-22-niva9-hjalp-1366.png)). +2x, +12, ÷2 ger `6 = x` → `x = 6`. Spärrens definition: ett led som *börjar* med minus eller har negativt värde vid lösningen. `3x = 5x − 12` är tillåtet på nivå 8, eftersom det är subtraktion och inget minustal (som "x − 3" i Etapp 1). Generatorns optimala väg innehåller aldrig minustal, inte heller på nivå 9. Där uppstår de bara genom elevens egen strategi (se O3) |
| **Exakta decimaler med decimalkomma** | ✅ `2,5x + 4 = 19`: −4, `/2.5` (punkt godtas) → `2,5x ÷ 2,5 = 15 ÷ 2,5` → `x = 6` ([04](qa-ekvationsresan-628/ekv628-04-niva10-1366.png)). Flyttalsfällor räknas exakt: `0,7x + 0,2 = 1,6` → `0,7x = 1,4` → `x = 2` (i JS ger 1,4 + 0,2 = 1,5999…) ([23](qa-ekvationsresan-628/ekv628-23-niva10-exakta-decimaler-1366.png)). `x + 0,1 = 0,4` → `x = 0,3` (i JS 0,30000000000000004). `1,25x + 0,75 = 5,75` → `x = 4`. `2x + 3 = 8` → `x = 2,5`. Fler än två decimaler (`-0,125`): "Skriv högst två decimaler …". ÷3 på `2,5x + 4 = 19`: "då får du bråk" |
| **Typerna C–F, inklusive "Vad betyder x?"** | ✅ **C** (nivå 7): ett fel svar (`8x + 10 = 24`) gav "Höger led stämmer. Räkna vänster led igen: 5x + 10 − 3x = ?". Sedan rätt på tre rader → ⭐⭐ "ett fel på vägen", +4. `answers` sparade 4 svar ([10](qa-ekvationsresan-628/ekv628-10-typC-niva7-1366.png), [11](qa-ekvationsresan-628/ekv628-11-typC-fel-ledtrad-1366.png)). **D** (nivå 7, "Fyra burkar och en kula …"): svaret med omvända led `x + 13 = 4x + 1` godtogs → ⭐⭐⭐ ([12](qa-ekvationsresan-628/ekv628-12-typD-niva7-1366.png)). **E** (nivå 7, Omars räknefel 15 ÷ 3 = 15): ett klick på följdraden gav "Den raden blev fel, men felet började tidigare" (räknas inte som fel, `senare: true`). Rätt rad gav ⭐⭐⭐ och "Räknefel: 15 ÷ 3 blir 5" ([16](qa-ekvationsresan-628/ekv628-16-typE-niva7-1366.png), [17](qa-ekvationsresan-628/ekv628-17-typE-niva7-svar-1366.png)). **F** (nivå 7 och 12): text → ekvation → vanliga lösningsvyn → "Du fick x = 9. Vad betyder x i uppgiften?" med tre meningar → "Svar: Efter 9 veckor har de lika mycket pengar." skrivs grönt i häftet. Ett fel (ekvation eller betydelse) gav ⭐⭐ ([13](qa-ekvationsresan-628/ekv628-13-typF-niva7-text-1366.png)–[15](qa-ekvationsresan-628/ekv628-15-typF-niva7-svar-1366.png), [24](qa-ekvationsresan-628/ekv628-24-niva12-vad-betyder-x-1366.png), [25](qa-ekvationsresan-628/ekv628-25-niva12-svar-1366.png)) |
| **Problemlösning från nivå 3** | ✅ F-andel per 1 000 uppgifter: nivå 1–2: 0 %, nivå 3: 11,4 %, nivå 4–11: 10,6–15,7 %, nivå 12: 49,9 %. `--typ F --niva 3` gav "Två likadana påsar och 10 lösa kulor är tillsammans 28 kulor …" ([13 1920](qa-ekvationsresan-628/ekv628-13-typF-niva3-1920.png)) |
| **Färdighetsmodellen påverkar nästa uppgift** | ✅ Egen körning av `nastaUppgift`, 1 000 uppgifter per profil (`kontroll-generator-modell.txt`). Nivå 8: neutral F 12 % → "stark på ekvationer, svag på text" F 41 % (nivå 1–2: D i stället). "Vågen stark, symbolerna svaga" gav D 31 % och C 25 %. Nivå 9 och uppåt har ingen D, där ökar A med vågen i fokus (11: A 5 % → 35 %). "Svag på två steg" på nivå 11 gav tvåstegsformer 29 % → 44 %. På nivå 6 gav "svag på x med koefficient" multDiv-former 84 % → 91 %. Modellen ändrade aldrig nivån. **I appen** med `qa-text`:s riktiga progressdokument gav 500 dragningar 39 % F mot 14 % på nivån utan modell. Att en misslyckad fokusuppgift inte räknas i nivåfönstret är testat i enheten ("scenario 1"), inte i webbläsaren |
| **Extrautmaningar, frivilliga** | ✅ Nivåöversikten har raden "✨ Extrautmaningar – Frivilligt … Påverkar inte din nivå" vid maxLevel ≥ 7. Vid nivå 6 står "Extrautmaningar öppnas när du nått nivå 7." ([30](qa-ekvationsresan-628/ekv628-30-nivaoversikt-extra-oppen-1366.png), [35](qa-ekvationsresan-628/ekv628-35-extra-last-niva6-1366.png)). Parentes: `4(x + 3) − 2x = 2x + 14 − 2x` → `2x + 12 = 14` → `x = 1` ([31](qa-ekvationsresan-628/ekv628-31-extra-1366.png), [32](qa-ekvationsresan-628/ekv628-32-extra-lost-1366.png)). Klurig: `53 − 6x = 23 − x` → `x = 6`. Negativ: `4x + 9 = 2x − 9` → `x = −9` ([33](qa-ekvationsresan-628/ekv628-33-extra-negativ-x-1366.png)). Bråk: `7x = 5` → `x = 5/7` med bråkstreck i rubriken, på vågen och i häftet ([34](qa-ekvationsresan-628/ekv628-34-extra-brak-1366.png)). Efter 4 extraförsök var `level`, `window`, `tasks` och huvuduppgiften (`131 = 5x + 41`, typ E) oförändrade. Försökens `skills.obs` = `{}`, och "← Tillbaka till nivå 12" gav samma huvuduppgift |
| **Mynt för 7–12 och extra** | ✅ I webbläsaren: nivå 7: +4, 9: +5, 10: +5, 11: +6, 12: +6, extra: +7, och Visa lösningen i extra: 0. Nivå 8 lästes inte av i webbläsaren: `config.COINS` ger 4, och enhetstestet täcker det. Saldot = summan av försökens `coins` = `progress.coins` (t.ex. 333 = 306 + 27). `extra.coins` = 21 för 3 lösta |
| **Lärarvyns sammanfattningar stämmer** | ✅ Den oberoende omräkningen gav **0 avvikelser för alla 9 elever med försök**: tabellens 5 sifferkolumner, att `progress.skills` = modellen ur försöken, och att "I korthet" kommer ur de meningar som modellen ger. Det gäller även Astrid, vars 15 försök jag spelade själv i webbläsaren (4 × ⭐⭐⭐ på nivå 1, 3 × ⭐ med hjälp steg 4, 7 × Visa lösningen och 1 × ⭐⭐⭐): `15 · 5/0/3 · 53 % · 20 % · ±0` och "Behöver ofta hjälp när x har en koefficient.". Elevdetaljen visar "Vad eleven kan", behärskar/har svårt för, problemlösning (Text Tova: "Text → ekvation: 0 % · 3 uppgifter · ofta med hjälp") och indikatorerna. Räknegången visar F-svaren ✗ ✗ ✗ 👁 ([40](qa-ekvationsresan-628/ekv628-40-larare-oversikt-1366.png), [41](qa-ekvationsresan-628/ekv628-41-larare-elevdetalj-vad-eleven-kan-1920.png), [42](qa-ekvationsresan-628/ekv628-42-larare-raknegang-F-svar-1366.png)). Nivåväljarna går till 12. Se O1 och O2 |
| **Allt från Etapp 1 fungerar som förut** | ✅ Se nästa avsnitt |

## Regression: Etapp 1 (E1.14, test 1–28)

| Test | Resultat |
| --- | --- |
| **1** `2x + 4 = 14`, −4 och ÷2 | ✅ `2x + 4 − 4 = 14 − 4` / `2x = 10` / `2x ÷ 2 = 10 ÷ 2` / `x = 5`. "− 4" och "÷ 2" är röda (rgb 214,48,49), ⭐⭐⭐, +2 ([50](qa-ekvationsresan-628/ekv628-50-e1-test1-niva3-1366.png)) |
| **2** ÷2 först | ✅ `(2x + 4) ÷ 2 = 14 ÷ 2` → `2x ÷ 2 + 4 ÷ 2 = 7` → `x + 2 = 7` |
| **3** ÷0, ·0 | ✅ "Man kan inte dela med noll." / "Om du gångrar med noll …". Draget räknas inte (`moveCount 2`, ⭐⭐⭐) |
| **4** ÷3 | ✅ "Det fungerar matematiskt, men då får du bråk." |
| **5** Minustal | ✅ −10 på `x + 2 = 7`: "Då blir det minustal." |
| **6** +6, −10, ÷2 | ✅ "Det fungerar, men ekvationen blev inte enklare än." → ⭐⭐, FÖRSÖK IGEN FÖR ⭐⭐⭐ ([51](qa-ekvationsresan-628/ekv628-51-e1-test6-omvag-1366.png)) |
| **7** `14 = 2x + 4` | ✅ `5 = x` och sedan `x = 5`, ⭐⭐⭐, +3 (nivå 6) |
| **8** 1 000 per nivå | ✅ Enhetstest och den egna kontrollen (se ovan) |
| **9** `2x + 3 = 11` | ✅ `L:x0 L:x1 L:i0–2` / `R:i0–10` ([52](qa-ekvationsresan-628/ekv628-52-e1-test9-2x+3=11-1366.png)) |
| **10** −3 och ÷2 | ✅ Fryst mitt i animationen: mynten lyfts, och vid delningen syns två streckade grupper. Den mörkblå ÷-brickan från #643 är tydlig ([53](qa-ekvationsresan-628/ekv628-53-e1-test10-minus3-anim-1366.png), [54](qa-ekvationsresan-628/ekv628-54-e1-test10-dela2-anim-1366.png)) |
| **11** `5x + 13 = 48` | ✅ `L:x0–x4 L:t:13 R:t:48`, block ([55](qa-ekvationsresan-628/ekv628-55-e1-test11-block-1366.png)) |
| **12** Steg 1 + optimalt | ✅ "💡 1/4 x vill stå ensamt …" → ⭐⭐⭐ |
| **13** Steg 2 + optimalt | ✅ ⭐⭐ "Nästa gång klarar du den kanske med mindre hjälp." |
| **14** Steg 4 (`4x = 20`) | ✅ De fyra stegen är ordagranna, och ett femte tryck stannar på 4/4 → ⭐, +2 |
| **15** Visa lösningen | ✅ Två klick ("Säker? …"), "Ej löst", 0 mynt, `revealed: true` |
| **16** Försök igen | ✅ `2x + 4 = 14` → `3x + 10 = 16` (samma form, ny ekvation) |
| **17** 4 × ⭐⭐⭐ på nivå 1 | ✅ "NY NIVÅ! NIVÅ 2" ([56](qa-ekvationsresan-628/ekv628-56-e1-test17-nivaupp-1366.png)) |
| **18** 4,2 → upp | ✅ Enhetstest. Även i webbläsaren på nivå 7: 3,2,3,2,3 → nivå 8 |
| **19** En ej löst efter bra | ✅ Enhetstest |
| **20** ⭐ ⭐ ej ⭐ ej | ✅ Nivå 2 → 1, fönstret tomt, inget meddelande (0 träffar på "nivå ner/åkt ner/lägre nivå") |
| **21** Nivå 1, dåliga resultat | ✅ Fönster `[0,0,0,0,0]`, kvar på nivå 1 |
| **22** Mynt 1/2/3 | ✅ +1 på nivå 1, +2 på nivå 3, +3 på nivå 5 |
| **23** Klassynlighet | ✅ `ekv-av`: menylänkarna är hus, plugga, läsresan och shop. `#/elev/ekvationsresan` stoppas → `#/elev/hus`. elev1 ser ⚖️ Ekvationsresan. Synlighetsfliken har inte ändrats i epicen |
| **24** Nivå för en elev / hela klassen | ✅ Astrid → nivå 4: `window []`, `current null`, statistiken (15 uppgifter, 10 mynt) finns kvar. Hela klassen → 2 via bekräftelsen "Ja, sätt 14 elever till nivå 2" → "✓ 14 elever i QA-klass 4A satta till nivå 2." Alla dokument fick ett tomt fönster, och `maxLevel` sänktes inte ([58](qa-ekvationsresan-628/ekv628-58-e1-test24-hela-klassen-1366.png)). När läraren höjer nivån höjs `maxLevel` |
| **25** Översikt och elevdetalj | ✅ Se "Lärarvyns sammanfattningar" ovan. XSS-namnet `Bo <b>Svag</b>` visas escapat |
| **26** Bara tangentbordet | ✅ Enskilda tangenttryck `-`, `4`, ENTER, `/`, `2`, ENTER löste uppgiften. Fokus låg sedan på NÄSTA UPPGIFT |
| **27** 1366×768 | ✅ `scrollHeight` 768 och `scrollWidth` 1366, och inga element utanför fönstret. Kontrollerat på nivå 7–12 och typ C (8), D (5), E (11), F (12) och F (3) |
| **28** Regression | ✅ Sviterna är gröna (se ovan). Hem, Plugga, Läsresan, Shoppen, Profil och Ekvationsresan öppnades i följd, och 0 fel eller varningar fångades i konsolen. Bootgrafen är oförändrad. Nivåöversikten visar 12 nivåer ([57](qa-ekvationsresan-628/ekv628-57-nivaoversikt-niva5-1366.png)) |

## Skärmdumpar (`docs/qa-ekvationsresan-628/`)

| Vy | 1366×768 | 1920×1080 |
| --- | --- | --- |
| Nivå 7 | [01](qa-ekvationsresan-628/ekv628-01-niva7-1366.png), [02](qa-ekvationsresan-628/ekv628-02-niva7-lost-1366.png) | [01](qa-ekvationsresan-628/ekv628-01-niva7-1920.png) |
| Nivå 9 | [03](qa-ekvationsresan-628/ekv628-03-niva9-1366.png), [21](qa-ekvationsresan-628/ekv628-21-niva9-negativt-mellanled-1366.png), [22](qa-ekvationsresan-628/ekv628-22-niva9-hjalp-1366.png) | [03](qa-ekvationsresan-628/ekv628-03-niva9-1920.png) |
| Nivå 10 | [04](qa-ekvationsresan-628/ekv628-04-niva10-1366.png), [23](qa-ekvationsresan-628/ekv628-23-niva10-exakta-decimaler-1366.png) | [04](qa-ekvationsresan-628/ekv628-04-niva10-1920.png) |
| Nivå 11 | [05](qa-ekvationsresan-628/ekv628-05-niva11-1366.png) | [05](qa-ekvationsresan-628/ekv628-05-niva11-1920.png) |
| Nivå 12 | [06](qa-ekvationsresan-628/ekv628-06-niva12-typF-1366.png), [24](qa-ekvationsresan-628/ekv628-24-niva12-vad-betyder-x-1366.png), [25](qa-ekvationsresan-628/ekv628-25-niva12-svar-1366.png) | [06](qa-ekvationsresan-628/ekv628-06-niva12-typF-1920.png) |
| Typ C | [10](qa-ekvationsresan-628/ekv628-10-typC-niva7-1366.png), [11](qa-ekvationsresan-628/ekv628-11-typC-fel-ledtrad-1366.png) | [10](qa-ekvationsresan-628/ekv628-10-typC-niva8-1920.png) |
| Typ D | [12](qa-ekvationsresan-628/ekv628-12-typD-niva7-1366.png) | [12](qa-ekvationsresan-628/ekv628-12-typD-niva5-1920.png) |
| Typ E | [16](qa-ekvationsresan-628/ekv628-16-typE-niva7-1366.png), [17](qa-ekvationsresan-628/ekv628-17-typE-niva7-svar-1366.png) | [16](qa-ekvationsresan-628/ekv628-16-typE-niva9-1920.png) |
| Typ F | [13](qa-ekvationsresan-628/ekv628-13-typF-niva7-text-1366.png), [14](qa-ekvationsresan-628/ekv628-14-typF-niva7-vad-betyder-x-1366.png), [15](qa-ekvationsresan-628/ekv628-15-typF-niva7-svar-1366.png) | [13](qa-ekvationsresan-628/ekv628-13-typF-niva3-1920.png) (nivå 3) |
| Lärarvyn – översikt | [40](qa-ekvationsresan-628/ekv628-40-larare-oversikt-1366.png) | [40](qa-ekvationsresan-628/ekv628-40-larare-oversikt-1920.png) |
| Lärarvyn – elevdetalj | [41](qa-ekvationsresan-628/ekv628-41-larare-elevdetalj-vad-eleven-kan-1366.png), [42](qa-ekvationsresan-628/ekv628-42-larare-raknegang-F-svar-1366.png) | [41](qa-ekvationsresan-628/ekv628-41-larare-elevdetalj-vad-eleven-kan-1920.png) |
| Övrigt | Nivå upp till 8 [18](qa-ekvationsresan-628/ekv628-18-nivaupp-8-1366.png), nivå 8 minus stoppas [20](qa-ekvationsresan-628/ekv628-20-niva8-minus-stoppas-1366.png), extra [30](qa-ekvationsresan-628/ekv628-30-nivaoversikt-extra-oppen-1366.png)–[35](qa-ekvationsresan-628/ekv628-35-extra-last-niva6-1366.png), Etapp 1-regression [50](qa-ekvationsresan-628/ekv628-50-e1-test1-niva3-1366.png)–[58](qa-ekvationsresan-628/ekv628-58-e1-test24-hela-klassen-1366.png) | |

## Rättat i QA:n

- **`7b720cd`:** lärarmeningen "Har svårt **med att** göra samma sak i båda leden." ändrad till "Har svårt att göra samma sak i båda leden." (`sammanfattning.js`). Ingen test låste den gamla texten. Den syntes för Astrid efter flera Visa lösningen på nivå 1.
- **`9118a13`:** `admin/qa-ekvationsresan-uppgift.mjs` skrev "undefined" för x-terms- och decimalsteg i loggen. Nu står t.ex. `-3x -5 /2` och `-4 /2,5`. Bara loggen, uppgiften byggdes rätt redan tidigare.

## Iakttagelser (inte buggar, blockerar inte)

- **O1 – "I korthet" ligger bakom horisontell scroll, både i 1366 och 1920.**
  - Klasskortet är 962 px brett i båda storlekarna, och `.ekt-tbl` har `min-width: 1080px`. Den nya kolumnen klipps alltså mitt i meningen, och läraren måste scrolla tabellen i sidled ([40](qa-ekvationsresan-628/ekv628-40-larare-oversikt-1366.png)).
  - Ett prov i sidan: med radbruten rubrik "Drag jämfört med optimalt" och `min-width: 0` blev tabellen 991 px, alltså fortfarande 29 px för bred.
  - Förslag: bryt rubriken, ge "I korthet" `min-width` ≈ 190 px eller flytta kolumnen direkt efter Elev. Jag ändrade inget, eftersom det är ett layoutval från #626.
- **O2 – "Hjälp %" och meningarna om hjälp mäter olika saker.**
  - Kolumnen räknar bara 💡. Modellen räknar också Visa lösningen och visade svar som hjälp.
  - Exempel: Låg Lova har Hjälp 11 % men "Behöver ofta hjälp när x har en koefficient.". Text Tova har Hjälp 0 % men "Text → ekvation … ofta med hjälp".
  - Elevdetaljen förklarar det ("💡 = andel uppgifter med hjälp eller visat svar"), men klassöversikten gör det inte. Läraren kan uppfatta det som en motsägelse.
- **O3 – Eleven kan inte dela med ett negativt tal.**
  - `/-2` ger "Det där kan jag inte läsa." Från `−2x = −12` (nivå 9) tar sig eleven vidare med +2x (hjälpens väg) eller ÷2 och sedan +x.
  - Det fungerar och är pedagogiskt försvarbart, men en elev som tänker "÷(−2)" blir stoppad med ett meddelande om tolkning, inte om matematik.
- **O4 – Typ F utan bild lämnar ett tomt fält.** När vågen inte visar föremål (t.ex. 28 kulor på nivå 3) står texten och talfältet mitt i spelytan med mycket tom yta ovanför ([13 1920](qa-ekvationsresan-628/ekv628-13-typF-niva3-1920.png)). Det är bara kosmetiskt.
- **O5 – Hitta felet: första raden har fokusramen från start.**
  - Fokus läggs på första klickbara raden för tangentbordet, vilket är rätt i sig. När felet *är* på första raden ser det ut som att svaret är markerat ([16 1920](qa-ekvationsresan-628/ekv628-16-typE-niva9-1920.png), Liam).
  - Förslag: visa ramen bara vid tangentbordsanvändning (`:focus-visible`) eller lägg fokus på rubriken.
- **O6 – Regelsviten** körde den här gången grön i en enda körning. RAM-känsligheten från Etapp 1 (O5 där) finns kvar som risk när flera agenter kör samtidigt.

## Öppna frågor till Elias

1. **#626:** en misslyckad fokusuppgift (⭐ eller ej löst) räknas inte i nivåfönstret (`FARDIGHET.skyddStjarnor`), så att eleven inte sänks för att modellen gav fler textuppgifter. Är det rätt?
2. **#627:** extrautmaningarna låses upp när eleven har nått nivå 7 (`EXTRA.minLevel`). Ska gränsen vara en annan nivå?
3. **LEVEL_MAX 6 → 12** syns i elevens nivåöversikt och i lärarens nivåväljare. Elever och lärare ser alltså direkt att det finns 12 nivåer. Okej?
4. **#627:** extraförsök påverkar inte färdighetsmodellen. Läraren ser dem i försökslistan men inte i "Vad eleven kan". Är det rätt?
5. (Ny, O1) Ska "I korthet" synas utan sidscroll i klassöversikten, till exempel som kolumnen direkt efter namnet?
6. (Ny, O2) Ska "Hjälp %" även räkna Visa lösningen och visade svar, som meningarna gör, eller ska kolumnen döpas om till "💡 %"?
7. (Ny, O3) Ska talfältet ta emot division med negativa tal (`/-2`) från nivå 9?

## Vad återstår eller bör justeras

- Deploya reglerna (se ovan) och merga till `main`. Ingen PR är öppnad. Leaden avgör ordningen.
- O1, O2, O4 och O5 är små justeringar om Elias vill.
- Inte gjort i webbläsaren: att en misslyckad fokusuppgift inte räknas i fönstret. Det är täckt av enhetstestet "scenario 1", eftersom fokus inte gick att framkalla på `qa-text`:s nivå 2 utan att förstöra fler testdata. `test:functions` kördes inte, eftersom `functions/` är oförändrad.
