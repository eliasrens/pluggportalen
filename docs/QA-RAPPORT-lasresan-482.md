# QA-rapport – Läsresan: 40 texter per nivå + lärarstyrda nivåer (epic #482, issue #515)

Testat 2026-10-08 av Tester-agenten. Gren: epic-grenen vid `401b7ba` (#505–#514 landade).
Allt kördes mot **Firestore- och Auth-EMULATORN** via `admin/qa-emulator-proxy.mjs` (samma origin), i headless Chrome 780×437 med högst två flikar.
Inga skrivningar mot live, ingen deploy, inget till main. Skärmdumpar och utdata finns i `docs/qa-lasresan-482/`.
Klickguide för Elias: `docs/preview-lasresan-482.md`.

## Sammanfattning

Specens avsnitt 5 är uppfyllt. **Inga buggar hittades.** Inget i appen är ändrat i den här issuen.

| # | Kontroll | Resultat |
|---|----------|----------|
| 1 | 40 texter per nivå med frågor och facit | ✅ `validateBank` ger **0 fel / 0 varningar** över 280 texter. Varje nivå 1–7 har **40/40 giltiga** texter, och facit ligger inom de 4 alternativen. `pickText` ger alltid rätt nivå. I webbläsaren lästes och besvarades tre nya texter på olika nivåer (se 1b), och rättningen stämde med facit varje gång |
| 2 | Enskild elev | ✅ Olle 3 → 6 sparas och finns kvar efter omladdning. Hans nästa text är *Ön under isen* (nivå 6). Pia har en påbörjad nivå 4-text och sätts till 1. Tabellen visar då "4 → 1". Hon får först sin påbörjade text och läser den klart (nivå 4, 8/8). Nästa text är *Därför blir det natt* (nivå 1) |
| 3 | Hela klassen | ✅ Dialogen visar **Klass QA-klass 5B · 3 elever · Nivå 1**. Före bytet var nivåerna 5, 2 och "ej börjat". Efteråt har alla nivå 1 och får nivå 1-texter. Därefter ändrades Bertil enskilt till 4, och hans text efter den påbörjade kom från nivå 4 |
| 4 | Klassens startnivå | ✅ Startnivå 1 för 6C sparas och finns kvar efter omladdning. **Ej börjad** elev (Nils) får *Världen ovanifrån* (nivå 1). **Ny elev** (Sara, tillagd i klassen via lärar-UI:t efter att startnivån sattes) får *Från källa till hav* (nivå 1). **Igång** elev (Ines, nivå 5) får *Svaret i bänkens kant* (nivå 5) och påverkas alltså inte. Spec-exemplet (startnivå 1 och sedan alla till 1) ger alla nivå 1, och Ines visas som "5 → 1" |
| 5 | Resultat och belöningar finns kvar | ✅ En dump av `studentData` och `lasresaAttempts` före och efter två nivåbyten är **identisk** utom nivåfälten. Kvar finns coins, ägda saker, totaler, `moneyEarned`, sedda texter, världar, `catStats` och alla försök. Efter nästa text räknas allt vidare: totalTexts 5 → 6 och coins 74 → 89. I UI:t gick Olle från 100 till 118 coins och från 3 till 4 texter |
| 6 | Automatisk progression | ✅ Från lärarnivå 2: 2 höga ger fortfarande 2, och en tredje hög i rad ger **3**. Nästa text kommer då från nivå 3. En låg ger fortfarande 3, och en andra låg i rad ger **2**. Varje vald text var oläst, och om en enda nivå 2-text är oläst väljs den 100 av 100 gånger. När en väntande lärarnivå tas i bruk nollställs streaks |
| 7 | Behörighet | ✅ Regeltesterna är gröna, inklusive `firestore-rules-lasresan-niva` ("classes.lasresaStartLevel: bara lärare, heltal 1–7"). Skriptet skriver som eleven: eleven kan **inte** sätta eller ta bort klassens startnivå och kan inte ändra en annan elevs nivå. Läraren nekas startnivå 8 och `"3"` (sträng), men 3 tillåts |
| 8 | Regression | ✅ `node --test`: **1443/1443** (1438 i hela sviten med regel-emulator + e2e-auth 5/5 mot en egen auth-emulator). Bootgrafen är **110 filer både före (`90c7569`) och efter (`401b7ba`), identisk**, utan `lasresan/*`. I UI:t fungerade karta, läsvy, sammanfattning, lärartabell och elevdetalj (per frågetyp, senaste texter med nivå). "Min läsning" klickades inte |

### 1b. Texter lästa i webbläsaren

| elev | text | nivå | svar | visat | facit |
|---|---|---|---|---|---|
| qa-olast | Ön under isen (`lr-n6-gronland`) | 6 | 6 rätt, 2 fel | "6 av 8 rätt", +18 | ✅ |
| qa-pagaende | Myntet som vägrade försvinna (`lr-n4-talangshowen`) | 4 | 8 rätt | "Alla rätt! 8 av 8", +24 | ✅ |
| qa-pagaende | Därför blir det natt (`lr-n1-dag-och-natt`) | 1 | 2 rätt, 4 fel | "2 av 6 rätt", +6 | ✅ |

Alternativen blandas i läsvyn. Jag valde därför svar efter alternativets **text** ur `level-N.json` och inte efter position. Försöken i `lasresaAttempts` och i lärarens "Senaste texterna" visar samma nivå och resultat.

## Bevis

- `docs/qa-lasresan-482/kontroll-utdata.txt` är utdata från `node admin/qa-lasresan-482-kontroll.mjs`: **56 kontroller, alla ✓** (p1–p7).
- `docs/qa-lasresan-482/bootgraf-bfs.txt` innehåller BFS-listan och jämförelsen (`node admin/qa-bootgraf-bfs.mjs <rev>`).
- Skärmdumpar:
  - `1-karta-elev.png`: kartan, nästa steg.
  - `2-sammanfattning-6av8.png`: sammanfattningen efter nivå 6-texten.
  - `3-bekraftelse-hela-klassen.png`: dialogen med klass, antal och nivå.
  - `4-elevdetalj-pia-niva1.png`: Pias detalj efter bytet (nivå 1; försök på nivå 4 och 1).
  - Emoji visas som rutor i headless Chrome. Det beror på fonten och är inget fel.

## Iakttagelser (inga buggar, men bra att veta)

- **O1 – två olika "läsnivåer" i lärarvyn (låg, UX).** Under Elever finns "📖 Läsnivå" med tre nivåer (lättast, mellan, svårast). Den hör till den gamla läsförståelsen (#152/#211) och styr **inte** Läsresan. Läsresans nivå 1–7 ändras under **Statistik → Läsresan**. Elias kan blanda ihop dem. Förslag: döp om den ena (t.ex. "Läsförståelse-nivå") eller lägg till en hänvisning.
- **O2 – en lärarsatt nivå vinner över startnivån.** "Hela klassen" ger också elever som inte har börjat en egen nivå. Om man sedan ändrar startnivån påverkas de inte längre. Det är så #505 är byggt ("individuell nivå vinner"), och det följer specen. Exemplet i specen fungerar.
- **O3 – behörigheten gäller alla lärare.** Regeln är `isTeacher()`, så vilken lärare som helst kan ändra vilken klass som helst. Det är samma modell som i resten av appen, där lärare inte äger klasser. Specen säger "sina elever och klasser". Om det ska tolkas strikt krävs ett ägarskap som inte finns någonstans i appen i dag.
- **O4 – texten efter ett klassbyte (kosmetiskt).** "N elever läser klart sin påbörjade text först" räknar också elever vars påbörjade text redan är på den valda nivån. I 6C gällde det Nils och Sara, som redan läste nivå 1.
- **O5 – deploy.** `lasresaStartLevel`-regeln behöver `firebase deploy --only firestore:rules`. Den gamla klassregeln tillåter okända fält, så utan deploy fungerar startnivån ändå, men **utan validering** (1–7). Gör ingen deploy utan OK.

## Miljö och recept

- **Emulator:** firebase-tools (npx-cache `/home/barista/.npm/_npx/7750544ccf494d8b`) + JRE `/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin`, `JAVA_TOOL_OPTIONS=-Xmx384m`.
- **Preview:** `JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-482-preview.sh` startar Firestore 8515, Auth 9515 och proxyn på 8516. Den kör seedarna `qa-lasresan-seed`, `qa-lasresan-niva-seed` och nya `qa-lasresan-482-seed`. Med `RESEED=1` seedas en körande emulator om.
- **Kontroll:** `node admin/qa-lasresan-482-kontroll.mjs [bank|enskild|klass|startniva|bevarat|progression|behorighet]` (default alla). Skriptet skriver via klient-SDK:n som läraren eller eleven, så reglerna gäller. Det använder samma rena funktioner som appens brygga (speglat i `admin/qa-lasresan-482-app.mjs`). Skriptet ändrar qa-pagaende och 5B, så kör `RESEED=1` efteråt.
- **Testsviter:**
  - Enhet + regler: starta Firestore-jaren på en egen port och kör `FIRESTORE_EMULATOR_HOST=127.0.0.1:<port> node --test`.
  - e2e-auth behöver en **tom** auth-emulator: `firebase emulators:exec --config <egen firebase.json> --only auth,firestore "node --test test/e2e-auth.test.mjs"`.
- **Worktreen saknade `node_modules`.** Jag använde en symlänk till #477:s worktree. Den är inte incheckad.
