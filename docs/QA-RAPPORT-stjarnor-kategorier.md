# QA-rapport Stjärnor & kategoristatistik (issue #448, epic #444)

Testat 2026-10-07 på `epic/tydligare-stj-rnor-statistik-per-kategor-…` (ebe05bc) mot Firebase-emulatorerna
(Auth + Firestore, riktiga `firestore.rules`) via `admin/qa-emulator-proxy.mjs`. Main (41fe69e) kördes
sida vid sida mot SAMMA emulator för ekonomijämförelsen. Seed: `admin/qa-kategori-seed.mjs`.
AI-svaret som klistrades in i wizarden: [qa-stjarnor/qa-kategori-omrade.json](qa-stjarnor/qa-kategori-omrade.json).
Ingen produktionsdata lästes eller skrevs. (Emojis visas som rutor i skärmdumparna: headless-Chrome saknar emoji-font.)

## Sammanfattning

**Alla 7 testpunkter PASS.** Räkningen per kategori stämmer exakt mot rådata i Firestore, i elevvyn
och i lärarvyn. Ekonomin (coins, XP, nivå, stjärnor, plays) är **identisk med main**. Bakåtkompatibiliteten
håller. Inga JS-fel. Fynden nedan är UX/konsekvens, inga datafel. **F2 bör Lead ta ställning till före merge.**

## Fynd

| # | Allvar | Fynd | Repro |
|---|---|---|---|
| F1 | Låg | **Varningen för okänd kategori visas aldrig.** `validateArea` ger `warnings` och `mergeAreaContent` skickar dem vidare, men ingen vy läser dem. Kategorin tas bort tyst. Issue #445 säger "okända värden varnar". | Wizard steg 3: klistra in JSON med ett par som har `"category": "minne"` → Kontrollera → "✓ Ser bra ut!" utan varning. I Firestore saknar p5 `category`. |
| F2 | Medel | **Tre olika tal för "möjliga stjärnor" för samma område.** Eleven ser "X av **24** ★" (alla synliga lägen + äventyr, utan Memory). Matrisen (Ämnen, finns redan på main) räknar `areaMaxStars` = 5 lägen = **15**, men räknar in äventyrens stjärnor i "intjänat", så den kan visa **över 100 %**. Per område (#446) sätter `max(15, intjänat)`, så nämnaren skiljer sig mellan raderna. | Elev med 3★ i alla 8 lägen på Rymden QA: eleven ser 24/24, Per område visar **24/24**, Ämnen visar **24/15 ★**, och en annan elev på samma rad visar x/15. Förslag: EN gemensam definition, t.ex. elevpanelens `starModes`. |
| F3 | Låg | **Stjärnor och kategorier säger emot varandra på resultatkortet.** Quiz ger ★★★, "Du hade 10 av 10 rätt" och "Du kunde allt" även om eleven svarade fel först (frågan kommer tillbaka och räknas som rätt). Precis under står det "Analys **0 av 3** rätt". Stjärnlogiken är oförändrad från main, men nu syns motsägelsen. | Quiz på Rymden QA, fel första gången på q8–q10. [skärmdump](qa-stjarnor/f4-tre-stjarnor-men-0-av-3.jpeg) |
| F4 | Kosmetisk | Listan på tre kategorier blir "Du blev bättre på 💡 Begrepp **och** 📌 Fakta **och** 🧠 Analys", men ska vara "A, B och C". | Spela quiz med alla rätt efter en omgång med fel i alla tre kategorierna. |
| F5 | Observation | Prompten ber AI:n tagga **par** med kategori, men bara äventyren (frågeadaptern) räknar par-kategorier. Para ihop, Memory och Fånga sanningar räknar inga kategorier. I djupdykningen visas Memory som "0 av 3 stjärnor", men Memory ger aldrig stjärnor. | – |

Fanns redan före epicen (inte #444): lärarsidan på mobil (390 px) scrollar i sidled, och orsaken är
sektionsflikarna `.cls-tab` (epic #438). Klasstabellen scrollar själv inuti kortet, vilket är OK.
`/favicon.ico` ger 404 i QA-proxyn, vilket är brus.

## Testpunkter

| # | Test | Resultat | Belägg |
|---|---|---|---|
| 1 | **End-to-end**: wizard → elev spelar → lärarvyer | **PASS** | Wizard (qalarare): steg 1–4, "Kopiera AI-prompt" innehåller `"category"` + regeln "Ge varje quizfråga och varje par ett category ("begrepp", "fakta", "analys")". Sparat: q1–q4=fakta, q5–q7=begrepp (q7 `"Begreppsförståelse"` → normaliserat), q8–q10=analys (q10 `"Analys/resonemang"` → normaliserat), p5 `"minne"` → borttagen (F1). Nina spelade Quiz ×2, Läsförståelse, Kunskapsjakt, Para ihop, Memory och Skattjakten-adaptern. Rådata i Firestore: quiz `{fakta 7/8, begrepp 5/6, analys 4/6}`, läsf `{3/4, 2/3, 3/3}`, jakt `{5/5, 4/4, 0/3}`, äventyr `{f 3/3, b 0/2, a 1/2}`. Summa begrepp 11/15 = 73 %, fakta 18/20 = 90 %, analys 8/14 = 57 %, totalt 37/49 = 76 %. **Elevpanelen, klasstabellen och djupdykningen visar exakt dessa tal.** Rätt % per läge i djupdykningen: 57/75/80/80 = rådata. Klassummering Rymden: 78 %, B 76 / F 89 / A 65 = (Nina + Ebbe) räknat för hand. [tabell](qa-stjarnor/larare-per-omrade-1366.jpeg), [djupdykning](qa-stjarnor/larare-djupdykning-1366.jpeg) |
| | Räkneregler | **PASS** | Quiz/läsf: första svaret per unik fråga (repetitioner räknas inte). Kunskapsjakt: varje svar. Äventyr: varje försök. Par utan kategori räknas inte. `cat` adderas mellan omgångar och ersätts aldrig. |
| 2 | **Elevvyn** | **PASS** | "⭐ Ditt framsteg" (11 av 24 ★ + tre kategorikort med r/t), "Så gick det" efter varje spel, "📈 Du blev bättre på …", "💡 Nästa gång: …" och "⭐ Vad betyder stjärnorna?" (★☆☆/★★☆/★★★ + "din bästa gång sparas"). Tonen är positiv: 0/3 heter "🌱 Växer". Memory visar ingen stjärnhjälp (noStars). [1366](qa-stjarnor/elev-framsteg-1366.jpeg), [mobil](qa-stjarnor/elev-framsteg-mobil.jpeg) |
| 3 | **Bakåtkompatibilitet** | **PASS** | Gustav (progress utan `cat`/`plays`) och Mira (med en `reading`-nod): elevpanelen visar bara stjärnor ("6 av 24 ★", ingen kategoritext). Lärartabellen visar "–" i Rätt % och kategorier, och djupdykningen visar "Inga frågor med kategori besvarade här än" + per spelläge. `reading` räknas inte som ett läge. Gustav spelade quiz på det gamla området: `plays` 1 (härledd) → 2, stjärnor max(2,3) = 3, +30 coins / +50 XP, ingen `cat` skrevs, para/läsf orörda. |
| 4 | **Ekonomin orörd** | **PASS** | Samma elev (kat-eko, återställd mellan körningarna) och samma svarsmönster på main och epic: quiz vik (1 fel) och quiz vik (allt rätt), läsf vik (2 fel), quiz Rymden (3 fel), läsf Rymden, para vik ×2 (grind-trappan 80 %). Varje resultatrad är identisk. Slutläget är **337 coins / 322 XP / nivå 5** på båda. stars/bestScore/plays är identiska per nod. Epic lägger bara till `cat`. |
| 5 | **Rules** | **PASS** | `npm run test:rules` (10 filer) **120/120**, inklusive #445:s "kan spara cat på egen / INTE i annan elevs progress". Enhetstester **870/870**. |
| 6 | **Regression** | **PASS** | Quiz, Para ihop, Bildpar (4 partisymboler, ★★★), Läsförståelse (passage per fråga), **Läsuppdrag**/lastext (nivåtext, ★★★), Kunskapsjakt, Fånga sanningar (startar, poäng räknas), Memory, Räkna (8 uppgifter, 7/8 → ★★☆), äventyrsadaptern. Läsresan-kartan, Hem och Shoppen. Klass-lås: lås till Rymden QA → elev på `vikingatiden` skickas till Rymden, panelen fungerar, lås upp OK. Lärarinventeringen, berörda rader: S-01–S-13 (Ämnen-matris, gammal elevdetalj S-07, Läsresan, Mattematchen, Live, Per område, djupdykning, Esc stänger), wizard WZ1–4 + Spara + TAB-raden "Årskurs 5 · 10 frågor · 6 par · 1 texter", Fokusläge. Statisk bootgraf från app.js: **110 filer = main** (inga nya bootfiler, #271). Alla JS-filer ≤ 400 rader (validate.js 397). |
| 7 | **Skärmar / konsol** | **PASS** | 1366×768, 390×844 (ingen sidscroll i elevvyn) och 1920×1080 ([desktop](qa-stjarnor/elev-framsteg-1920.jpeg), [lärare mobil](qa-stjarnor/larare-per-omrade-mobil.jpeg)). 0 JS-fel/varningar i 6 browserkontexter (lärare + 5 elever). |

## Inte testat

- Riktiga äventyrsbanor med rörelse: frågeadaptern + `awardAdventure` kördes direkt (engine.js-ändringen är en rad: `questions.categoryStats()`).
- `test:e2e` kördes inte. Epicen rör inte auth, och testet hade redan ett känt fel (#462 F7).
- Hela inventeringen (605 rader) kördes inte om, bara raderna som epicen rör.

## Städning

All testdata finns bara i emulatorn, i minnet (ingen export), så den försvinner när emulatorn stoppas.
Inget skrevs till produktion. Main-checkouten och de tillfälliga skripten är borttagna. Kvar i grenen:
`admin/qa-kategori-seed.mjs` (vägrar köra utan emulator-variablerna) och området i `docs/qa-stjarnor/`.

Återskapa (från repo-roten):

    firebase emulators:start --only auth,firestore --project pluggportalen-so-2026
    FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
      GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-kategori-seed.mjs
    PORT=8000 node admin/qa-emulator-proxy.mjs

Lärare `qalarare`, elever `kat-ny`/`kat-gammal`/`kat-mix`/`kat-ingen`/`kat-eko`, lösenord `lilla123`.
Skapa "Rymden QA" i wizarden genom att klistra in `docs/qa-stjarnor/qa-kategori-omrade.json`.
