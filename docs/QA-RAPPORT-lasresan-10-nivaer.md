# QA-rapport – Läsresan 10 läsnivåer (epic #516, issue #525)

Testat 2026-10-08. Grenen är epic-grenen vid `0edec79` (A–E landade, #518–#524).
Allt kördes mot **Firestore- och Auth-EMULATORN** med grenens `firestore.rules`, via `admin/qa-emulator-proxy.mjs`.
Webbläsaren var headless Chrome med en flik. Inga skrivningar mot live, ingen deploy och inget till main.
Utdata och skärmdumpar ligger i `docs/qa-lasresan-10/`. Klickguiden för Elias finns i `docs/preview-lasresan-10-nivaer.md`.

## Sammanfattning

Specens §5–§8 är uppfyllda. Jag hittade **ett avsteg från specen** och rättade det med en rad (F1). I övrigt hittades inga buggar.

| Spec | Kontroll | Resultat |
|---|---|---|
| §1, §3, §8 | **Bank** | ✅ 370 texter: nivå 1–3 har 30 st vardera och nivå 4–10 har 40 st vardera (krav ≥ 30 per nivå och ≥ 300 totalt). `validateBank` ger **0 fel och 0 varningar**. Varje text har rätt antal frågor för sin nivå: nivå 1 har 3–4, nivå 2 har 4–5, nivå 3 har 6 och nivå 4–10 har 6–9. Varje fråga har 4 olika alternativ och exakt ett giltigt `answerIndex`. Id:t stämmer med nivån, och `pickText` ger rätt nivå. Varje nivå har lika många berättelser och faktatexter |
| §8 | **Gamla texter orörda** | ✅ Jag jämförde mot `origin/epic/l-sresan-40-texter-per-niv-l-rarstyrda-n-7ef183`. Alla **280** gamla id:n finns kvar. Varje gammal text ligger på sin gamla nivå + 3 och är **identisk utöver `level`**: samma titel, brödtext, frågor och facit. De 90 nya texterna har prefixet `lr-g1/2/3-` |
| §5 | **Migrering** (gammal skala, lat) | ✅ Gammal nivå 1, 3 och 7 blir **4, 6 och 10**, både i elevens och i lärarens klient. Gammal nivå 3 med väntande 2 blir **6 → 5**. Den påbörjade texten läses klart på nivå 6, och därefter gäller 5. Klassens gamla startnivå 3 blir **6**, och en elev som inte har börjat får en nivå 6-text. Försök i subkollektionen och fallback-försök i gammal skala visas +3. Efter första skrivningen är **totals, catStats, seenTextIds, världar, coins, försök och fallback identiska**, och bara nivåfälten har ändrats. Lagringen är `level10` plus spegeln `level`. **Idempotent:** en ny läsning efter skrivningen, en ny inloggning och en ny text ger samma nivå, och dubbel normalisering ändrar ingenting. Om läraren sparar om startnivå 6 lagras 6/3, och den läses som 6, inte 9 |
| §5 | **Ny elev / startnivå** | ✅ En elev utan klass får nivå **4**. En klass med lärarvald startnivå **2** eller **9** ger den nya eleven nivå 2 respektive 9, och första texten kommer från den nivån |
| §6 | **Progression** | ✅ 27 höga texter i rad ger 1→2→…→**10**, alltså ett steg per tre höga. Varje text kom från elevens aktuella nivå. Fyra höga till på nivå 10 ger fortfarande 10 (**tak**). På nivå 10 ger en låg text ingen ändring, och två låga i rad ger 9. Från nivå 2 ger två låga 1, och två låga till ger fortfarande 1 (**golv**). Enhetstesterna (`lasresan-level`, `lasresan-tio-nivaer`) är gröna |
| §5, §7 | **Lärar-UI** (webbläsare) | ✅ Klassöversikten visar 4, 6, 10, "6 → 5", 9, 2 och startnivå 6 för de elever som inte har börjat (se `1-klassoversikt-1-10.png`). Väljarna har nivå 1–10 och förklarar de nya nivåerna. I elevdetaljen visas "1/10", och ett gammalt försök visas på nivå 4. Enskild elev sattes till **1** och **3**, startnivån till **9** (Ej Elin visar 9) och **hela klassen** (2 elever) till **7**. Lagringen blev `level10` plus spegel, och startnivån 9/6 |
| §4, §7 | **Elevflöde** (webbläsare) | ✅ med F1. Jag läste texter på nivå **1** (*Var är mössan?*, 3/4, +9), **2** (*Ljus innan elen*, 4/5, +12), **3** (*Korna på vägen*, 5/6, +15) och **10** (*Sex dagar på älven*, 8/9, +24). Texten syntes under varje fråga, och ✅/❌ visades direkt. Coins ökade i sidomenyn, och kartan gick ett steg (Öknen för Greta). Försöken sparades med `levelScale: 10` och rätt `textLevel`. Inga fel eller varningar i konsolen. Eleven ser ingen nivå |
| §5 | **Regler** | ✅ `firestore-rules-lasresan-niva` och `firestore-rules-lasresan` gav 18/18 mot emulatorn. End-to-end (`behorighet`) gav samma resultat: eleven kan inte sätta startnivån och kan inte ändra en annan elevs nivå. Läraren nekas `lasresaStartLevel10` 0, 11 och `"5"` samt spegeln 8. Startnivå 1 och 10 och elevnivå 10 tillåts. ⚠️ **`firestore.rules` kräver deploy med Elias OK**, se O1 |
| B-beslut | **Gammal cachad klient** | ✅ Jag körde den riktiga gamla koden (#482-grenen, LEVEL_MAX 7) mot ny data. Den korrumperar inte nivå 8–10, se avsnittet nedan |
| #271 | **Bootgraf** | ✅ BFS från `app.js` ger **110 filer både före (`41a671b`) och efter (`HEAD`), identiska**, och ingen av dem ligger under `lasresan/`. F1 ändrar bara en dynamiskt laddad modul |
| – | **Hela testsviten** | ✅ `node --test` gav 1504 tester. 1493 gick igenom mot Firestore-jaren. De 11 återstående är e2e-auth (5) och functions-update-login (6), som kräver egna emulatorer. De kördes separat med `emulators:exec` och gav **5/5** och **6/6**. Efter F1 gav `node --test test/lasresan-*.test.js` 130/130 |

## Fynd

### F1 – rätt svar visades inte vid fel (rättat, 1 rad)
Specen §4 säger "Visa rätt svar (som idag)", och issuen kräver "rätt svar visas". Läsvyn visade bara **❌ Fel**. Det var ett medvetet beslut i #401 (`docs/LASRESAN.md`: "Rätt svar avslöjas inte vid fel"). Jag rättade det i `src/lasresan/ui-reader.js`: vid fel får det rätta alternativet också klassen `chosen-correct`, så att bokstaven blir grön bredvid det röda valet under de 1,6 s innan nästa fråga. Det är verifierat i webbläsaren på nivå 10 (`rattGron: true`). `docs/LASRESAN.md` är uppdaterad.
**Elias bör bekräfta** att det var så han menade. Om "som idag" betyder att rätt svar *inte* ska visas räcker det att ta bort raden.

## Gammal cachad klient (B:s beslut i `docs/LASRESAN.md` "Nivåskala 1–10")
`admin/qa-lasresan-10-gammal-klient.mjs` packar upp den gamla koden och låter den läsa och skriva via sina egna bryggfunktioner. Den skriver normaliserade objekt rakt av. Därefter läser den nya klienten resultatet:

| Fall | Resultat |
|---|---|
| a) Ny nivå 9 (spegel 6). Den gamla klienten läser en text | Den gamla klienten ser 6, och `level10` följer med orört. Den nya klienten läser **9**. Det gamla försöket saknar `levelScale` men får rätt nivå via text-id:t |
| b) Den gamla klienten ger tre höga texter (spegel 6 → 7) | Den nya klienten läser **10** (9 + 1). Nästa skrivning från den nya klienten synkar `level10` 10 och spegeln 7 |
| c) Ny nivå 10 och tre höga texter i den gamla klienten | Fortfarande **10**. Nivån klampas inte bort |
| d) En gammal lärarvy sätter 7 eller 1 | Den nya klienten läser **10** respektive **4** |
| e) Ny väntande nivå 2 läggs på plats av den gamla klienten | Den nya klienten läser **2** |
| f) En gammal lärarvy sätter startnivå 2 eller tar bort den | Den läses som **5** respektive standard (4) |
| g) Ny nivå 2 (spegel 1) och tre höga texter i den gamla klienten | **5**, inte 3. Det är den dokumenterade grovheten: nivå 1–4 har samma spegel |
| h) Den gamla laddaren läser den nya banken | Den kraschar inte. Gammal nivå *N* hämtar den nya filen `level-N.json`, alltså texter som är **3 nivåer lättare**. Gammal nivå 1 får dev-seed, eftersom de nya nivå 1-texterna har för få frågor för den gamla validatorn. En påbörjad `lr-n7`-text hittas inte, och den gamla sidan startar då en ny text |

Slutsats: inget går förlorat och inga nivåer blir korrupta. Det som kan hända under fönstret med en gammal klient (Pages cachar i ~10 min, eller en flik står öppen) är grovt men övergående: eleven kan få lättare texter, en påbörjad text kan bytas ut och nivå 1–3 kan hoppa till 5. Det rättar sig vid nästa skrivning från en ny klient.

## Iakttagelser (inga buggar)
- **O1 – deploy.** De nya reglerna (`lasresaStartLevel10` 1–10 och spegeln 1–7) behöver `firebase deploy --only firestore:rules`. Klienten fungerar före deployen: den gamla klassregeln tillåter okända fält, och spegeln är 1–7. Men `lasresaStartLevel10` valideras inte innan reglerna är deployade. **Gör ingen deploy utan Elias OK.** Regeln för `lasresaAttempts` från #398 behöver fortfarande en deploy, liksom tidigare.
- **O2 – nivå 3 har alltid 6 frågor.** Specen tillåter 5–7. Alla 30 texter har exakt 6 frågor, vilket är inom kravet.
- **O3 – två "läsnivåer" i lärarvyn** (som O1 i #515). "📖 Läsnivå 1–3" under Elever hör till Läsuppdragen och inte till Läsresan 1–10.

## Bevis
- `docs/qa-lasresan-10/bank-utdata.txt`: utdata från `node admin/qa-lasresan-10-bank.mjs`. Bank, frågor, facit och jämförelse med gamla texter, **alla ✓**.
- `docs/qa-lasresan-10/kontroll-utdata.txt`: utdata från `node admin/qa-lasresan-10-kontroll.mjs`. Migrering, ny elev, progression, behörighet och gammal klient, **75 ✓, 0 ✗**.
- `docs/qa-lasresan-10/kontroll-482-utdata.txt`: utdata från #515:s `qa-lasresan-482-kontroll.mjs`, med **förväntningarna uppdaterade till skala 1–10** (leadens uppdrag). **59 ✓, 0 ✗**.
- `docs/qa-lasresan-10/testsvit.txt`: testsviten.
- Skärmdumpar: `1-klassoversikt-1-10.png`, `2-lasvy-niva10-fel-ratt-svar-visas.png` (nästa fråga, där texten syns), `3-karta-efter-niva1.png` och `4-sammanfattning-niva10.png`.

## Miljö och recept
- **Emulator:** firebase-tools ur npx-cachen (`~/.npm/_npx/7750544ccf494d8b`) och JRE `/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin`. Previewn startas med `JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-10-preview.sh` (FS 8540, Auth 9540, proxy 8541). Seeden har nu också Etta Ebba (nivå 1) och Trea Tore (nivå 3).
- **Kontroll:**
  ```bash
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8540 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9540 GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-lasresan-10-kontroll.mjs [migrering|nyelev|progression|behorighet|gammalklient]
  ```
  `gammalklient` kräver `git archive <#482-rev> src | tar -x -C /tmp/q525-gammal`. Skriptet seedar egna `qa-525-*`-elever och klasser. Kör `RESEED=1`, eller starta om emulatorn, för en ren preview.
- **Testsviten:**
  - Kör Firestore-jaren på en egen port och sedan `FIRESTORE_EMULATOR_HOST=127.0.0.1:<port> node --test`.
  - Kör e2e-auth med `firebase emulators:exec --only auth,firestore` (egen config).
  - Functions kräver `functions/node_modules` och `FUNCTIONS_EMULATOR_HOST=127.0.0.1:<port>` inne i `emulators:exec`. Utan den pekar testet på 5001.
- `node_modules` och `functions/node_modules` är symlänkar till andra worktrees och är **inte** incheckade.
