# Rapport: Matchdagen – visa lästext till frågorna (#905)

Spec: `UTVECKLINGSUPPDRAG_MATCHDAGEN_LASNING.md`. Arkitekturen: [MATCHDAGEN.md §26](MATCHDAGEN.md#26-lästext-till-frågorna-905).
Datamodellen: [DATAMODELL.md](DATAMODELL.md) `matchdagenInst.lastext`.

## Vad som är gjort

- **Urvalet** (§1): Live-lägets lästext-regel är utbruten ur `plugga-quiz-core.js` till den rena
  `src/live/modes/quiz-passage.js` (`passageCheck`), som Live, klienten och servern nu delar. Matchdagens urval är
  `quizUrval` i `src/matchdagen/md-lastext.js` – samma fil på servern via `npm run sync:matchdagen`.
  Av = som i dag, på = alla frågor med lästexten, 300 tecken bara i vänskapsmatcherna.
- **Frågekortet** (§2): lästexten i ett lugnt block ovanför frågan, +15 s på klockan (`LASTEXT_EXTRA_S`),
  förklaringen efter ett fel svar (alla Plugga-quizfrågor), planen krymper så att frågan och knapparna syns.
- **Lärarens val** (§3): "Visa lästext till frågorna" i Anpassningar per elev (elev och Hela klassen),
  `matchdagenInst.lastext` (saknas = true), `normalizeInst`, `sammaInst`, `sammanfattning` ("· med lästext"),
  reglernas `validMatchdagenInst`.
- **Tester** (§5): `test/matchdagen-lastext-905.test.js` (urvalet AV mot en ögonblicksbild av det gamla
  urvalet, PÅ, texthänvisningar, område med bara lästextfrågor, 300-gränsen, klient = server, klockan,
  förklaringen, `lastext`), `test/firestore-rules-matchdagen-lastext-905.test.js` (i `test:rules`).
  Befintliga tester som beskrev "utan lästext" har fått `lastext: false` uttryckligen.
- **Förhandsvisning:** `preview/preview-matchdagen.html?lastext=1` (och `?lastext=0`, `&klocka=30`);
  kryssrutan i `preview/preview-matchdagen-anpassningar-899.html` (`?lage=tom` = gråad).

## Skärmdumpar (`docs/lastext-905/`)

| Fil | Vad |
| --- | --- |
| `3d-1366x768.png` | 3D, 1366 × 768, klocka 30 + 15 = 45 s – frågan och knapparna utan att rulla |
| `3d-1366x768-fel-svar.png` | 3D, fel svar: rätt svar + förklaringen |
| `2d-1366x768.png` | 2D-reserven, 1366 × 768, den längsta texten (~280 tecken) |
| `2d-1366x768-fel-svar.png` | 2D, fel svar med förklaringen |
| `3d-smal-390x844.png` | smal skärm 390 × 844 – allt syns |
| `3d-smal-375x667-rullad.png` | smal skärm 375 × 667 – kortet rullas fram, knapparna syns |
| `larare-ikryssad.png` | lärarens panel – rutan ikryssad (ett område med lästexter används) |
| `larare-grad.png` | lärarens panel – gråad, "Inga valda områden har lästexter" |

## Deploy

**Regler → functions → webb.**
1. `firebase deploy --only firestore:rules` – annars nekas lärarens sparning (fältet `lastext`).
2. `firebase deploy --only functions` (predeploy kör `sync:matchdagen`) – vänskapsmatchens bank och `mdSvar`
   (förklaringen). Vänskapsmatcherna är pausade (#894).
3. Webben.

## Val där specen inte räckte

1. **"AV = exakt som i dag".** Matchdagen hoppade tidigare över *alla* frågor med lästext, även i ett område med
   bara sådana (Live tar då med dem utan texten, utom texthänvisningar). Vi behöll Matchdagens beteende – specens
   krav på en ögonblicksbild mot dagens urval väger tyngst. "Frågor som kräver texten hoppas över" gäller därmed
   automatiskt.
2. **Lästexten normaliseras som i Live** (blanksteg och radbrytningar ihop) – samma `passageCheck`.
3. **Ingen extra tid i vänskapsmatcherna.** Tiden där är serverns synkade läge-tid (`fasSekunder`); specen ger
   300-gränsen just för det. +15 s gäller elevens egna matcher, straffar och träningslägret.
4. **Förklaringen** visas under "Rätt svar" i mindre, dämpad text; kortet står då kvar 1,5 s + 35 ms per tecken,
   högst 5 s (`FORKLARING_MS` i `md-config.js`), så att den hinner läsas. I vänskapsmatchen kommer den med
   `mdSvar`:s svar (bara vid fel) och ligger annars i facit-dokumentet.
5. **Planen krymper** med lästextens höjd (ned till 120 px) i stället för att kortet läggs över planen; på mycket
   låga skärmar rullas kortet fram (`scrollIntoView`) så att knapparna syns.
6. **Kryssrutan gråad** räknar bara områdena som faktiskt används (`effektivaKallor`: dolda för klassen räknas
   inte, "Samma som Plugga" = de synliga). Ett gråat val sparas oförändrat. Rutan står under områdena och gäller
   både "Samma som Plugga" och "Välj områden själv".
7. **`sammanfattning`** skriver "med lästext" bara när det finns Plugga-källor (inte för en elev med bara tabeller).
