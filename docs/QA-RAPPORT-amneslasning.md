# QA-rapport: Ämnesläsning (epic #670, slut-QA #675)

Datum: 2026-10-13. Gren: `epic/mnesl-sning-…` @ 93a5cc3 (inklusive #674:s 581f109), med origin/main (4540578) redan inmergad.
Spec: `docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md`.

**Sammanfattning:** test 1–24 är gröna. Hela flödet fungerar från lärarens prompt till statistiken, och regressionen är ren. **Inga buggar hittades**, så inga kodändringar gjordes i QA. Det finns en rekommendation om viktningen (§3) och fem frågor till Elias längst ned.

## Sviter

| Svit | Resultat |
| --- | --- |
| `node --test` (alla enhetstester utom rules/functions/e2e), körd efter mergen av 93a5cc3 | **2238/2238 gröna** |
| `npm run test:rules` (egen config, port 8675, inklusive `firestore-rules-amneslasning*.test.js`) | **490/490 gröna** |
| Bootgraf: statiska importer från `src/app.js`, BFS, HEAD jämfört med origin/main | **identisk, 107 filer**. Ämnesläsningen laddas bara via `import()`. |
| Konsolfel i elevappen under hela flödet | inga |

Emulatorn startades via `emulators:exec` och stängdes automatiskt efteråt. Inga emulatorer är kvar.

## Hur testerna gjordes

- **Elev:** den riktiga appen i `preview/preview-amneslasning.html`, med Firebase-SDK:t ersatt av en minnes-stubbe. Eleven Alva börjar på läsnivå 4, och 4 av 9 vikingatexter är redan lästa. Jag läste texterna genom att klicka i appen och läste sedan av `studentData` och `lasresaAttempts` i stubbens minne (`window.__ppStub`).
- **Lärare:** `preview/preview-amnes-larare.html` (studion med panelen), `preview/preview-lasresan-larare.html` (källfiltret) och `preview/preview-plugga-larare.html` (Per område).
- **AI-svaret:** jag skrev ett eget realistiskt svar, `docs/qa-amneslasning/ai-svar-realistiskt.txt`. Det innehåller 9 texter om handel och resor och har de fel som AI-svar brukar ha:
  - en inledande mening före JSON:en, en kodruta med ```` ```json ```` och en avslutande mening efter
  - ett id som krockar med en befintlig text
  - rätt svar oftast på B
  - två nivå 3-texter som är för korta

## Test 1–24

✅ = godkänt, ❌ = fel, ⚠️ = godkänt med anmärkning.
- **E** = enhetstest.
- **UI** = kontrollerat i appen.

| # | Test | Status | Belägg |
| --- | --- | --- | --- |
| 1 | Läsnivå → ämnesnivå | ✅ | E: `amneslasning-level.test.js` |
| 2 | Ingen historik → startnivå → ämnesnivå 2 | ✅ | E. UI: Alva på nivå 4 fick en nivå 2-text (Runorna). |
| 3 | 3 höga ämnestexter → +1 | ✅ | E. UI: nivå 4 → 5 efter tre texter med 100 %, sedan 5 → 6 efter tre till. Streaken nollställdes. |
| 4 | 2 låga → −1 | ✅ | E. UI: två texter med 0/4 gav nivå 6 → 5. |
| 5 | En hög i Läsresan + två höga ämnestexter → upp | ✅ | E. UI: en Läsresan-text med 6/6 (streak 1), sedan Runorna och Vad åt vikingarna? → nivå 4 → 5. |
| 6 | Taket 7 | ✅ | E |
| 7 | Nivå 9 + två låga → 8 | ✅ | E |
| 8 | Avataren flyttas aldrig | ✅ | E. UI: `stepInWorld` och `seenTextIds` var oförändrade efter 10 ämnestexter. Läsresan-texten gav +1 steg som vanligt. |
| 9 | `level10` och spegelfältet | ✅ | E. UI: `level10` 4→5→6→5 med spegeln `level` 1→2→3→2. |
| 10 | Oläst text på elevens nivå | ✅ | E. UI: den enda olästa nivå 2-texten (Runorna) valdes först. |
| 11 | Närmaste nivå, sedan den som lästes längst tillbaka | ✅ | E. UI: först nivå 1 (lättare först) och sedan nivå 3. När allt var läst kom den äldsta texten (Vikingarnas skepp) med beskedet "Du har läst alla texter i området! Här är en du läste för ett tag sedan." |
| 12 | Påbörjad text återupptas | ✅ | E. UI: efter en omladdning mitt i Runorna stod vyn på "Fråga 2 av 4". |
| 13 | Kortet syns bara med ämnestexter, i alla ämnen | ✅ | E. UI: Riksdagen hade inget kort. Fotosyntesen (NO) och Animals (Engelska) visade bara 📖 Ämnesläsning, utan framstegspanel. |
| 14 | 6/7 på en ny text → 30 mynt | ✅ | E. UI: 4/4 gav +20, 3/3 gav +15 och 5/5 gav +25, alltså 5 mynt per rätt. |
| 15 | Andra läsningen med 6 rätt → 24 mynt (80 %) | ✅ | E. UI: omläsning med 3/3 gav +12 och med 2/3 gav +8. |
| 16 | Prompten innehåller namn, ämne, årskurs, önskemål och befintliga titlar | ✅ | E. UI: den kopierade prompten innehöll "Vikingatiden", SO, årskurs 5, önskemålet och de 3 titlarna. Den gamla #152-texten kom inte med. |
| 17 | Giltigt svar → förhandsgranskning per nivå → spara utan överskrivning | ✅ | E. UI: 9 texter kontrollerades, varav en togs bort. "Spara 8 texter" gav 3 befintliga + 8 nya. Krockande id döptes om till `vikingar-skepp-1-2`. |
| 18 | Fel stoppar, varningar gör det inte | ✅ | E. UI: 3 alternativ, `answerIndex` 5 och kategorin "analys" gav tre tydliga fel. Den giltiga texten i samma svar gick att spara. |
| 19 | Redigera en fråga och ta bort en text | ✅ | E. UI: frågetexten ändrades och sparades, och "Ett hus i vikingabyn" togs bort (12 → 11 i området). |
| 20 | Bara Ämnesläsning → prompten ber bara om ämnestexter | ✅ | E. Node: `buildAreaPrompt(["amneslasning"])` ber om INGA quiz/par/texter. Mitt AI-svar som område gick igenom `validateArea` med exerciseTypes `["amneslasning"]`. |
| 21 | Annat ämne (engelska) | ✅ | E. UI: Animals (Engelska) visar kortet. Node: ett engelskt område validerar. |
| 22 | Försöket i `lasresaAttempts` + Läsresans lärarvy + filtret | ✅ | UI: försöket har `source:"amnesläsning"`, `subjectId`, `areaId`, `amnesLevel:2`, `textLevel:4`, `readNumber` och `perCategory`. Filtret: Läsresan (79) + Ämnesläsning (17) = Alla (96), och det stämmer per elev. |
| 23 | Områdets lärarvy | ✅ | E. UI: under Per område finns sektionen "📖 Ämnesläsning" med lästa texter (x av 6), läsningar, rätt % och staplar per frågetyp. |
| 24 | Pluggas Läsförståelse + Läsresan oförändrade, alla tester gröna | ✅ | Se Regression. |

## Hela flödet från början till slut

1. **Läraren skapar ämnestexter:** panelen öppnades och prompten kopierades. Jag klistrade in mitt AI-svar. Panelen tålde inledningen och kodrutan, visade texterna per nivå med varningar, och 8 texter sparades.
2. **Eleven läser:** kortet visar "Du har läst 4 av 9 texter i området". Därefter kommer läsvyn, en fråga i taget med ✅/❌, och sist resultatskärmen med mynt och "Läs nästa text 📖".
3. **Nivån ändras både i Läsresan och i Ämnesläsningen:** test 3, 4 och 5 ovan. Steget i Läsresan rörs inte.
4. **Mynten delas ut:** 5 per rätt och 80 % vid omläsning. Saldot i sidomenyn uppdaterades.
5. **Statistiken visas:** försöket sparas med källa. Lärarvyerna kontrollerades med previewernas fixturdata.

Två saker fick inte plats i den här QA:n:
- Steg 1 och steg 2–5 körs i olika previews, eftersom minnes-stubbarna inte delar data mellan sidor. Kedjan "sparad text → syns för eleven" täcks därför av fältformatet (samma `readingTexts`) och enhetstesterna, inte av en enda sammanhängande körning.
- Ingen körning mot riktig Firestore eller emulator med inloggning.

## Regression

- **Läsresan (elev):** en text med 6/6 gav +18 mynt (3 per rätt), +1 steg, `seenTextIds` uppdaterades och streaken gick upp. Kartan och världsväljaren renderas som förut.
- **Läsresan (lärare):** filtret "Läsresan" ger bara Läsresans siffror. Enligt #674 är de identiska med bas-commitens rader, och `amneslasning-teacher-stats.test.js` testar det.
- **Pluggas Läsförståelse (`passage`):** jag lade till `passage` på 2 av 4 frågor i Riksdagen. Läget körde bara de 2 frågorna och visade texten ovanför varje fråga. `games-quiz.js` och `game-questions.js` är inte ändrade i epicen.
- **Vanliga arbetsområden:** Vikingatiden visar alla gamla lägen och framstegspanelen "0 av 24 ★" som förut. Panelen döljs bara när ett område saknar stjärnlägen, alltså i rena ämnesläsningsområden.
- **Gamla #152-texter** (`{levels:{…}}`) i `readingTexts` visas aldrig och följer inte med i prompten. De ligger kvar orörda i fältet.

## Skärmdumpar (`docs/qa-amneslasning/`)

| Vy | 1366×768 | 1920×1080 |
| --- | --- | --- |
| Elevens kort | `e1-kort-1366.png` | `e1-kort-1920.png` |
| Läsvyn | `e2-lasvy-1366.png` | `e2-lasvy-fel-1920.png` (fel svar + omläsningsbesked) |
| Resultatskärmen | `e3-resultat-1366.png` (4/4, +20) | `e3-resultat-1920.png` (omläsning 2/3, +8) |
| Panelen "Skapa ämnestexter" | `l1-skapa-panel-1366.png` | `l1-skapa-panel-1920.png` |
| Förhandsgranskningen per nivå | `l2-forhandsgranskning-1366.png` | `l2-forhandsgranskning-1920.png` |
| Förhandsgranskning av en text (Läsresans läsvy) | `l3-forhandsgranska-text-1366.png` | `l3-forhandsgranska-text-1920.png` |
| Lärarstatistik, Läsresan med källfilter | `l4-lasresan-filter-amnes-1366.png` | `l4-lasresan-filter-alla-1920.png` |
| Lärarstatistik, Per område → Ämnesläsning | `l5-per-omrade-amnes-1366.png` | `l5-per-omrade-amnes-1920.png` |

## §3: Ska ämnestexterna vägas annorlunda?

Ja, jag ser tre skäl utöver taket på nivå 7.

1. **Omläsningar räknas fullt mot nivån.** När eleven har läst allt får hen gamla texter igen, och då kan svaren redan vara kända. Mynten trappas ned, men nivån gör det inte. I testet höjdes Alva från nivå 5 till 6 av en omläsning av en nivå 1-text. Varken `readNumber` eller textens nivå påverkar `applyAmnesLevel`.
2. **Texter under elevens nivå räknas lika mycket uppåt.** Områden har ofta 3 texter per nivå. En elev på ämnesnivå 3 får därför snabbt nivå 2- och nivå 1-texter, och 100 % på en lätt text räknas som "hög" mot Läsresans streak.
3. **Lärar- och AI-skrivna texter har sämre kalibrerade frågor än Läsresans granskade bank.** Varningarna i panelen visade att rätt svar var unikt längst i 65–82 % av frågorna per nivå (mitt realistiska svar plus de befintliga texterna). Eleven har dessutom ofta förkunskap från lektionerna, så faktafrågor går att svara på utan att läsa. Båda drar upp procenten.

**Rekommendation:** behåll nedåt som i spec (test 7). Låt en ämnestext bara räknas **uppåt** när det är **första läsningen** (`readNumber === 1`) och textens ämnesnivå är **minst** elevens ämnesnivå. I övriga fall nollställs inte streaken; texten räknas bara inte. Ändringen är liten och ligger i `applyAmnesCompletion`/`applyAmnesLevel`. Den bryter test 3 och 5 bara om testerna använder omläsningar. Jag har inte byggt den, eftersom beslutet ska tas av Elias (fråga 1).

## Mindre iakttagelser (inte buggar)

- Klistrar man in ett svar med en mening före JSON:en, eller en kodruta, i guiden "Nytt område" eller i "Lägg till innehåll", blir det "Texten är inte giltig JSON". Så har det fungerat sedan tidigare, och prompten säger "Svara ENDAST med JSON". Den nya panelen klarar det däremot.
- Varningarna om svarsposition och längdledtråd i panelen räknar på **hela** nivån, alltså befintliga och nya texter tillsammans. Läraren kan få varningar som gäller texter hen inte klistrade in.
- Felmeddelandet "answerIndex måste vara 0–3" använder fältnamnet. Det är begripligt men tekniskt.
- 📖 används både för Pluggas "Läsförståelse" och för "Ämnesläsning" i samma områdesvy. Namnen skiljer sig, men korten ser likadana ut.
- I Läsresans lärarvy med filtret "Läsresan" visas en elev som bara läst ämnestexter med nollor ("0 | 0 | –"), inte "ej börjat".

## Deploy

Inga ändringar i `firestore.rules`, `firestore.indexes.json` eller `functions/` mellan origin/main och epicen. **Det räcker att merga till main**, som Pages-workflowet deployar. Inga nya filer i bootgrafen, så det finns ingen risk för vit sida under Pages-fönstret (#271).

## Frågor till Elias

1. **Viktning (§3):** ska omläsningar och texter under elevens nivå sluta räknas **uppåt** mot läsnivån? Jag rekommenderar ja.
2. Ska guiden "Nytt område" och "Lägg till innehåll" också tåla inledande text och kodrutor i AI-svaret, som den nya panelen gör?
3. Ska varningarna om svarsposition och längdledtråd bara gälla de **inklistrade** texterna, inte hela nivån?
4. Ska Ämnesläsning få en egen ikon, så att den inte förväxlas med Pluggas 📖 Läsförståelse i samma områdesvy?
5. När eleven har läst alla texter får hen omläsningar i en loop. Ska läraren se en tydlig signal i studion, till exempel "N elever har läst allt – skapa fler texter"?
