# UTVECKLINGSUPPDRAG: ÄMNESLÄSNING 📖
## Läsförståelse i arbetsområdena – med Läsresans motor, utseende och läsnivå

**Uppdrag till AI-utvecklingsteamet**

Bygg ett nytt övningsläge i arbetsområdena: **Ämnesläsning**.

Ämnesläsning är läsförståelse med texter som hör till ett **arbetsområde i vilket ämne som helst**: SO, NO, svenska, engelska, teknik, idrott och hälsa och så vidare. Det är framför allt tänkt för SO och NO, men ska inte vara låst till dem.

Ämnesläsningen använder **samma motor, samma läsvy och samma dolda läsnivå som Läsresan**. En elev som har läst i Läsresan får direkt texter på rätt nivå i ämnesläsningen, och läsning i ämnesläsningen räknas in i samma läsnivå.

Läraren ska kunna **skapa texter till ett område enkelt**, med en egen AI-prompt för just ämnesläsning.

**Detta är ett implementeringsuppdrag, inte ett uppdrag att bara skriva en plan.**

---

# 0. ÖVERSIKT

| | Läsresan | Ämnesläsning |
| --- | --- | --- |
| Var | Egen huvudmodul | Övningsläge i ett arbetsområde |
| Texter | Gemensam textbank, nivå 1–10 | Områdets egna texter, **nivå 1–3** |
| Karta och steg | Ja | **Nej** |
| Läsvy (text + en fråga i taget, 4 alternativ) | Ja | **Samma** |
| Frågekategorier | fakta, ordförståelse, mellan raderna, helhet/slutsats | **Samma** |
| Dold läsnivå | Ja | **Samma nivå, delad** |
| Statistik | Ja | **Samma statistik**, märkt med källa |
| Pluggmynt | 3 per rätt | **5 per rätt**, lägre vid omläsning |

---

# 1. ÅTERANVÄND LÄSRESAN

Läs och återanvänd, bygg inte om:

- `src/lasresan/ui-reader.js` – `renderReader(container, { text, onDone, initialAnswers, onAnswer })`. Samma läsvy, samma utseende, samma återkoppling.
- `src/lasresan/ui-summary.js` – resultatskärmen efter en text (utan kartan).
- `src/lasresan/reader-logic.js` – rättning, visningsordning, påbörjad text som återupptas.
- `src/lasresan/level.js` – reglerna för nivå upp och ner (≥ 70 % hög, < 50 % låg, 3 höga i rad upp, 2 låga i rad ner).
- `src/lasresan/level-scale.js` och `src/lasresan/progress.js` – hur nivån lagras (`level10` + spegelfält för gamla klienter). **Ämnesläsningen får aldrig skriva nivåfälten direkt**, utan ska gå via samma funktioner som Läsresan.
- `src/lasresan/stats.js`, `src/lasresan/teacher-rows.js`, `src/data-lasresan.js` – statistik och försök (`lasresaAttempts`).
- `src/lasresan/content/validate.js` – kvalitetskontrollen av texter och frågor.
- `src/lasresan/config.js` – alla tal på ett ställe. Lägg ämnesläsningens tal bredvid, i samma stil.
- `src/exercise-types.js`, `src/prompt-parts.js`, `src/prompts.js` – övningstyper och AI-prompter för arbetsområden.
- `src/teacher-content-merge.js` – flödet "Kopiera AI-prompt för mer innehåll" → klistra in svar.
- `src/game-shared.js` – trappan för omspel (`grindMultiplier`).

**Det som inte återanvänds:** kartan, världarna, stegen och resan (`journey.js`, `worlds/`, `ui-map*.js`). Ämnesläsningen flyttar aldrig elevens steg i Läsresan.

Ämnesläsningen ska laddas först när eleven öppnar den (`import()`, utanför den statiska bootgrafen, #271).

---

# 2. NIVÅER

## 2.1 Från läsnivå till ämnesnivå

Varje område har texter på **tre ämnesnivåer**. Elevens dolda läsnivå (1–10) avgör vilken ämnesnivå eleven får:

| Elevens läsnivå (Läsresan) | Ämnesnivå |
| --- | --- |
| 1–2 | 1 |
| 3–4 | 2 |
| 5–10 | 3 |

- En elev som aldrig läst i Läsresan har Läsresans startnivå (klassens `lasresaStartLevel10`, annars `START_LEVEL` = 4), alltså ämnesnivå 2.
- Eleven ser aldrig sin nivå, precis som i Läsresan. Läraren ser den.
- Lägg mappningen i konfigurationen.

## 2.2 Texternas svårighet

Riktlinjer för AI-prompten och för validatorn (varningar, inte fel, som i Läsresan):

| Ämnesnivå | Motsvarar läsnivå | Ord per text | Frågor per text |
| --- | --- | --- | --- |
| 1 | 1–2 | cirka 40–90 | 3–5 |
| 2 | 3–4 | cirka 80–150 | 4–6 |
| 3 | 5–6 | cirka 130–220 | 5–7 |

Lägg talen i konfigurationen.

---

# 3. DEN GEMENSAMMA LÄSNIVÅN

Ämnesläsningen och Läsresan delar **en** dold läsnivå och **samma** streaks.

1. **Läsa av nivån:** som Läsresan gör (via `normalizeLasresa` och skalan 1–10).
2. **Uppdatera nivån:** efter varje färdig text används Läsresans regler i `level.js`, med samma streaks. En text i ämnesläsningen räknas alltså på samma sätt som en text i Läsresan.
3. **Båda hållen:** ämnesläsningen kan både höja och sänka läsnivån.
4. **Tak uppåt: högst nivå 7.** Ämnesnivå 3 motsvarar läsnivå 5–6, så bra resultat där visar att eleven klarar 6, men inte mer. Ämnesläsningen får därför höja läsnivån till **högst 7**. Läsnivå 8–10 nås bara genom Läsresan. Lägg taket i konfigurationen.
5. **Inga steg i Läsresan:** att läsa en ämnestext flyttar aldrig avataren på Läsresans karta.
6. **Egen "läst"-lista per område:** vilka ämnestexter eleven har läst sparas per område, skilt från Läsresans `seenTextIds`.
7. Läraren kan redan i dag ändra elevens läsnivå i Läsresan (`teacher-niva.js`). Det ändrar automatiskt ämnesnivån också.

Ämnesläsningens texter mäter både läsförståelse och ämneskunskap. Därför finns taket i punkt 4. Redovisa i rapporten om ni ser fler skäl att väga ämnestexterna annorlunda.

---

# 4. ELEVENS FLÖDE

1. I arbetsområdet syns ett nytt kort: **📖 Ämnesläsning**, bara om området har ämnestexter.
2. Eleven klickar och får **direkt nästa text** på sin ämnesnivå. Ingen karta, ingen lista att välja i.
3. Textvalet:
   - först en **oläst** text på elevens ämnesnivå i området
   - finns ingen sådan: en oläst text på närmaste nivå (samma tanke som `levelSearchOrder` i `picker.js`)
   - har eleven läst allt: den text som lästes längst tillbaka, med ett vänligt besked ("Du har läst alla texter i området! Här är en du läste för ett tag sedan.")
4. Läsvyn är **exakt Läsresans**: texten står kvar, en fråga i taget, fyra alternativ, ✅ Rätt / ❌ Fel.
5. Resultatskärmen är Läsresans (utan karta), med mynt och knappen **"Läs nästa text"**.
6. En liten diskret rad visar till exempel **"Du har läst 4 av 9 texter i området"**. Inga nivåsiffror.
7. En påbörjad text återupptas om eleven lämnar och kommer tillbaka (som Läsresan).

---

# 5. PLUGGMYNT

- **5 pluggmynt per rätt svar**, till elevens vanliga saldo, på samma sätt som Läsresan delar ut mynt.
- **Omläsning:** första gången eleven läser en text ges full belöning. Läser eleven samma text igen skalas mynten ned med samma trappa som Plugga (100 % → 80 % → 60 % → 40 % → 20 %, `grindMultiplier`), räknat per text och elev.
- Lägg talen i konfigurationen.

---

# 6. LÄRAREN: SKAPA ÄMNESTEXTER – ENKELT

Detta är en central del. Läraren ska kunna skapa ämnestexter till ett område på två sätt.

## 6.1 När ett område skapas

- Lägg till en ny övningstyp i `src/exercise-types.js`: **"📖 Ämnesläsning"**, med en kort förklaring ("Läsförståelsetexter om området, på tre nivåer").
- Typen finns för **alla ämnen**.
- Kryssar läraren i den ska den vanliga AI-prompten (`buildAreaPrompt`) också be om ämnestexter, och svaret valideras och sparas som allt annat innehåll.

## 6.2 Till ett befintligt område: knappen "Skapa ämnestexter"

I lärarvyn för ett område finns en egen knapp: **📖 Skapa ämnestexter**. Den öppnar en enkel panel:

1. **Antal texter per nivå:** 1–5, förval **3** (alltså 9 texter totalt).
2. **Önskemål (valfritt):** ett fritt fält, till exempel "fokusera på vikingarnas handel" eller "mer om fotosyntesen".
3. **Eget material (valfritt):** läraren kan klistra in egen text, till exempel ur läroboken, som AI:n ska utgå från.
4. Knappen **"Kopiera AI-prompt"** kopierar en färdig prompt (se bilaga A) med områdets namn, ämne, årskurs, önskemål och, om området redan har ämnestexter, **titlarna på de befintliga texterna**, så att AI:n inte skriver samma texter igen.
5. Läraren klistrar in prompten i Claude (eller en annan AI) och klistrar sedan in svaret i rutan.
6. Systemet **validerar** svaret (se avsnitt 7) och visar en **förhandsgranskning** sorterad per nivå, med varningar.
7. Läraren kan **ta bort** enskilda texter innan de sparas.
8. **"Spara"** lägger till texterna i området. Befintliga texter skrivs aldrig över.

## 6.3 Granska och redigera

I områdets lärarvy finns en lista över ämnestexterna, grupperade per nivå. Läraren kan:

- öppna en text och se den som eleven ser den (förhandsgranskning med Läsresans läsvy)
- **redigera** titel, text, frågor, alternativ, rätt svar, kategori och nivå
- **ta bort** en text
- se hur många texter som finns per nivå, med en varning om en nivå saknar texter

## 6.4 Ett område bara för ämnesläsning

Det ska gå att skapa ett område som **bara** har ämnesläsning (till exempel ett NO-område med enbart läsförståelse), utan quiz eller par.

---

# 7. INNEHÅLLSFORMAT OCH KVALITET

## 7.1 Fältet

Ämnestexterna sparas i ett **eget fält** på arbetsområdet, exempelvis `readingTexts`. Det får inte förväxlas med områdets befintliga `texts` (faktatexter utan frågor).

```json
"readingTexts": [
  {
    "id": "vikingar-handel-1",
    "title": "Vikingarna köper och säljer",
    "level": 1,
    "textType": "fact",
    "body": "…",
    "questions": [
      {
        "id": "q1",
        "question": "Vad bytte vikingarna ofta till sig?",
        "options": ["Silver", "Bananer", "Papper", "Glas"],
        "answerIndex": 0,
        "category": "fakta"
      }
    ]
  }
]
```

- `level` är **ämnesnivån** 1, 2 eller 3.
- `textType` är `"fact"` eller `"story"`, som i Läsresan. De flesta ämnestexter är faktatexter, men en berättande text ("En dag i en vikingaby") är välkommen.
- `category` är **Läsresans** kategorier: `"fakta"`, `"ordforstaelse"`, `"mellan_raderna"`, `"helhet_slutsats"`. (Inte Pluggas `begrepp`/`fakta`/`analys`.) Då blir statistiken gemensam.
- Formatet ska ligga så nära Läsresans innehållskontrakt att `renderReader` kan visa en ämnestext utan omvandling, eller med en tunn omvandling.

## 7.2 Validering

Återanvänd `src/lasresan/content/validate.js` så långt det går:

- **Fel** (texten sparas inte): exakt 4 alternativ, ett rätt svar som pekar på ett existerande alternativ, giltig nivå 1–3, giltig kategori, inga tomma fält, unika id:n.
- **Varningar** (texten kan sparas): ordantal utanför riktlinjen, antal frågor utanför riktlinjen, rätt svar ofta på samma position, rätt svar ofta det längsta alternativet, en nivå med för få texter.
- Id:n som krockar med befintliga texter i området görs om automatiskt.

---

# 8. STATISTIK

**Samma lässtatistik som Läsresan.**

- Varje färdig ämnestext sparas som ett försök i `lasresaAttempts`, med extra fält: `source: "amnesläsning"`, `subjectId`, `areaId`, `amnesLevel` (1–3) och textens motsvarande läsnivå på skalan 1–10.
- **Läsresans lärarvy** räknar med ämnestexterna i elevens totala lässtatistik (texter, frågor, rätt, kategorier). Lägg till ett filter: **Alla / Läsresan / Ämnesläsning**.
- **Områdets lärarvy** visar per elev: antal lästa ämnestexter i området, andel rätt och fördelningen per kategori.
- Gamla försök utan `source` räknas som Läsresan.

---

# 9. BEHÅLL DET SOM FINNS

- **Pluggas läge "Läsförståelse"** (korta stycken per quizfråga, fältet `passage`) behålls **oförändrat**. Gamla områden fungerar som förut. Ämnesläsning är ett nytt, separat läge med eget namn, så att de inte blandas ihop.
- **Läsresan** fungerar exakt som förut: karta, steg, världar, nivå, mynt och statistik.
- Läsresans nivålagring med spegelfält för gamla klienter (`level-scale.js`) får inte brytas.
- Rätta gärna den inaktuella kommentaren i `src/lasresan/config.js` som nämner `src/reading-level.js` och "Läsuppdrag" (filen finns inte längre).

---

# 10. TESTER

## Nivå

- **Test 1:** Läsnivå 1, 2, 3, 4, 5, 6, 7 och 10 ger ämnesnivå 1, 1, 2, 2, 3, 3, 3 och 3.
- **Test 2:** Elev utan Läsresan-historik: läsnivå = klassens startnivå (annars 4) → ämnesnivå 2.
- **Test 3:** Tre ämnestexter i rad med ≥ 70 % → läsnivån höjs med 1, på samma sätt som i Läsresan.
- **Test 4:** Två ämnestexter i rad med < 50 % → läsnivån sänks med 1.
- **Test 5:** Blandat: en hög text i Läsresan, sedan två höga ämnestexter → nivå upp (streaken är gemensam).
- **Test 6:** Elev på läsnivå 7 läser tre höga ämnestexter → stannar på 7 (taket).
- **Test 7:** Elev på läsnivå 9 läser två låga ämnestexter → nivå 8 (nedåt fungerar).
- **Test 8:** En ämnestext flyttar aldrig avataren i Läsresan.
- **Test 9:** Nivålagringen: `level10` och spegelfältet uppdateras på samma sätt som när Läsresan ändrar nivån.

## Elevflöde

- **Test 10:** Nästa text är en oläst text på elevens ämnesnivå.
- **Test 11:** Inga olästa på nivån → närmaste nivå. Allt läst → den som lästes längst tillbaka, med vänligt besked.
- **Test 12:** Påbörjad text återupptas efter omladdning.
- **Test 13:** Kortet syns bara i områden som har ämnestexter, i alla ämnen.

## Mynt

- **Test 14:** 6 rätt av 7 på en ny text → 30 pluggmynt.
- **Test 15:** Samma text läst en andra gång med 6 rätt → 24 pluggmynt (80 %).

## Läraren och innehållet

- **Test 16:** "Skapa ämnestexter" med 3 per nivå: prompten innehåller områdets namn, ämne, årskurs, önskemål och befintliga titlar.
- **Test 17:** Ett giltigt AI-svar förhandsgranskas per nivå och sparas utan att befintliga texter skrivs över.
- **Test 18:** Ett svar med fel (3 alternativ, ogiltig kategori, `answerIndex` utanför) stoppas med tydligt felmeddelande. Varningar visas men stoppar inte.
- **Test 19:** Läraren redigerar en fråga och tar bort en text.
- **Test 20:** Ett nytt område med bara Ämnesläsning ikryssat: den vanliga AI-prompten ber bara om ämnestexter.
- **Test 21:** Ett område i ett annat ämne än SO/NO (till exempel engelska) fungerar.

## Statistik och regression

- **Test 22:** Försöket sparas i `lasresaAttempts` med `source`, `areaId` och nivåer. Läsresans lärarvy räknar med det, och filtret fungerar.
- **Test 23:** Områdets lärarvy visar elevernas ämnesläsning.
- **Test 24:** Pluggas Läsförståelse och Läsresan fungerar exakt som förut. Alla befintliga tester är gröna.

Ta skärmdumpar (1366×768 och 1920×1080) av elevens kort, läsvyn, resultatskärmen, panelen "Skapa ämnestexter", förhandsgranskningen och lärarstatistiken.

---

# 11. PR-ORDNING OCH RAPPORT

1. **Motor och nivå:** ämnesnivå-mappningen, den delade nivån med taket, försök med `source`, mynt. Med tester.
2. **Elevflödet:** kortet i området, textvalet, läsvyn och resultatskärmen.
3. **Lärarens innehåll:** övningstypen, AI-prompten (bilaga A), panelen "Skapa ämnestexter", validering, förhandsgranskning och redigering.
4. **Statistik:** filtret i Läsresans lärarvy och områdets lärarvy.

Avsluta med en kort rapport: vad som byggts, hur nivån delas med Läsresan, vilka tester som körts, skärmdumpar, och vad som återstår.

---

# BILAGA A – AI-PROMPTEN FÖR ÄMNESTEXTER

Knappen "Kopiera AI-prompt" ska bygga en prompt enligt mallen nedan. Fälten i `{…}` fylls i av systemet. Delar inom `[[…]]` tas bara med när de finns. Lägg mallen bredvid de andra prompterna (`src/prompts.js` / `src/prompt-parts.js`) och hämta tal och kategorier ur konfigurationen, så att prompten och valideringen aldrig glider isär.

```text
Du skriver läsförståelsetexter till Pluggporten, en lärplattform för elever i
grundskolan. Texterna ska användas i övningen Ämnesläsning i arbetsområdet
"{områdesnamn}" i ämnet {ämne}, för elever i {årskurs}.

UPPDRAG
Skriv {antal} texter per nivå på tre nivåer, alltså {antal × 3} texter totalt,
om arbetsområdet. Varje text har egna flervalsfrågor.
[[Lärarens önskemål: {önskemål}]]
[[Utgå från det här materialet och håll dig till fakta som stämmer med det:
{material}]]
[[Området har redan de här texterna – skriv INTE om samma sak igen:
{befintliga titlar}]]

NIVÅERNA
- Nivå 1 (för elever som är ovana läsare): cirka 40–90 ord, korta meningar,
  vanliga ord, ett tydligt huvudbudskap. 3–5 frågor, nästan alla svar står
  direkt i texten.
- Nivå 2 (för elever som läser på en normal nivå för åldern): cirka 80–150 ord,
  något längre meningar och några ämnesord som förklaras i texten. 4–6 frågor,
  med en eller två frågor där eleven måste dra en enkel slutsats.
- Nivå 3 (för elever som läser bra): cirka 130–220 ord, mer varierat språk och
  fler ämnesbegrepp, information som behöver kopplas ihop. 5–7 frågor, med
  flera frågor om orsak och följd, slutsatser och textens huvudbudskap.
Samma ämnesinnehåll får gärna finnas på flera nivåer, men skrivet på olika
svårighetsnivå. Gör inte språket konstgjort svårt bara för att höja nivån.

TEXTERNA
- Mest faktatexter ("fact"). En berättande text ("story") som gör ämnet levande
  är välkommen, till exempel "En dag i en vikingaby".
- Alla fakta ska vara korrekta och passa elevernas ålder. Undvik osäkra eller
  omstridda uppgifter, och hitta aldrig på årtal, siffror eller namn.
- Engagerande och konkret, inte som en uppslagsbok.
- Inga frågor eller svar inne i själva texten.

FRÅGORNA
- Varje fråga ska gå att besvara med hjälp av texten.
- Exakt 4 svarsalternativ. Exakt ett är rätt. Felalternativen ska vara rimliga,
  inte löjliga, och inte delvis rätta.
- Variera vilket alternativ som är rätt (inte alltid det första eller det
  längsta).
- Avslöja inte svaret i frågans formulering.
- Ange vad frågan testar med "category", exakt en av:
  "fakta"            – svaret står tydligt i texten
  "ordforstaelse"    – förstå ett ord eller uttryck i sammanhanget
  "mellan_raderna"   – dra en slutsats som inte står uttryckligen
  "helhet_slutsats"  – huvudbudskap, orsak och följd, varför något händer
  Sprid kategorierna; på nivå 3 ska det finnas flera "mellan_raderna" och
  "helhet_slutsats".

SVARSFORMAT
Svara ENDAST med JSON, utan förklaringar före eller efter, enligt det här
formatet:

{
  "readingTexts": [
    {
      "id": "kort-id-med-bindestreck",
      "title": "Textens rubrik",
      "level": 1,
      "textType": "fact",
      "body": "Själva texten. Stycken separeras med tom rad.",
      "questions": [
        {
          "id": "q1",
          "question": "Frågan?",
          "options": ["Alternativ A", "Alternativ B", "Alternativ C", "Alternativ D"],
          "answerIndex": 0,
          "category": "fakta"
        }
      ]
    }
  ]
}

"answerIndex" är 0-baserat (0 = första alternativet). Kontrollera att det
pekar på det rätta svaret. Kontrollera innan du svarar att varje nivå har
{antal} texter och att antalet frågor stämmer med nivån.
```

Systemet ska byta ut ordantal, antal frågor, nivåbeskrivningar och kategorier mot värdena i konfigurationen, så att mallen ovan och valideringen alltid säger samma sak.
