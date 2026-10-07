# QA-rapport – Klasscentret 1/4 (epic #476, issue #481)

Testat 2026-10-07 av Tester-agenten. Gren: epic-grenen vid `bce686b` (inkl. #480:s
"centret i mitten av översta raden", `6315035`, som landade under testet och mergades
in i testgrenen). Allt kördes mot **Firestore- och Auth-EMULATORN** via
`admin/qa-emulator-proxy.mjs` (samma origin). Inga skrivningar mot live, ingen deploy.
Skärmdumpar: `docs/qa-klasscentret-1/`.

## Sammanfattning

| # | Kontroll | Resultat |
|---|----------|----------|
| 1 | Boot + bootgraf | ✅ 0 konsolfel; BFS från `src/app.js` = **110 filer, identisk med `origin/main`**; alla nätverksanrop 200 |
| 2 | Placering (acceptans 1), 5/14/28 elever | ✅ alla hus kvar, ingen överlappning, centret mitt i översta raden · ⚠️ **F1** skylten täcker hus vid 28 elever |
| 3 | EXP-uppgradering (acceptans 2), Nivå 10, normalisering | ✅ |
| 4 | Spelkopplingar quiz/memory/räkna | ✅ classTotalExp rätt, elevens mynt opåverkade |
| 5 | Säkerhet | ✅ 140/140 regeltester; 8/8 manipulationsförsök från klienten nekas |
| 6 | Pixi `?pixi=pa` | ✅ på denna bas: ofarlig no-op (Pixi är inte mergad) · ✅ provmerge med Pixi-epicen: ritas, zoom fungerar, 0 konsolfel (se O5) |
| 7 | Grannby | ✅ visar deras center + nivå, placeholder-klick är view-only |
| 8 | Testsviten | ✅ 975/975 enhet + 140/140 regler + 5/5 e2e-auth |

**Buggar: 1 (F1, medel).** Övrigt är observationer.

## Miljö

- Emulator: firebase-tools + JRE (`/tmp/kc481/firebase.json`, Firestore 8483, Auth 9483), regler = `firestore.rules` i grenen.
- Proxy: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8483 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9483 PORT=8484 node admin/qa-emulator-proxy.mjs`
- Seed: `admin/qa-klasscenter-by-seed.mjs` – **utökad i #481** med klass `qa-kc3` "QA-klass 4C", 28 elever (`ke01…ke28`). Nu: `qa-kc` 14 elever (`kc01…`), `qa-kc2` 5 elever (`kd01…`), `qa-kc3` 28 elever. Lösenord `lilla123`. `exp <klass> <antal>` sätter shard 0.
- Viewport i headless: 780×437.

## 1. Boot och bootgraf

- BFS över statiska `import`/`export … from` från `src/app.js`: `origin/main` 110 filer, HEAD 110 filer, `diff` tom. Inga `src/klasscenter/*` i grafen (listan finns i `docs/qa-klasscentret-1/bootgraf-bfs-head.txt`).
- Kall boot (utloggad): 120 anrop, alla 200, 0 fel/varningar i konsolen.
- Varm boot (inloggad, landar på `#/elev/hus`): 143 resurser, inget som inte är 200 (fonts.googleapis visar status 0 = korsorigin utan TAO, inget fel). `kc-*` laddas **inte** förrän byn visas.
- Det betyder att Pages-risken från incidenten 2026-09-10 (en ny fil i bootgrafen = vit sida) inte gäller här.

## 2. Placering (acceptans 1)

| Klass | Elever | Hus i DOM | "Du!" | Överlapp hus↔center | Överlapp hus↔hus | Skärmdump |
|-------|--------|-----------|-------|---------------------|------------------|-----------|
| qa-kc2 | 5 | 5 | 1 | 0 | 0 | 05 |
| qa-kc | 14 | 14 | 1 | 0 | 0 | 01 (före mitt-ändringen) |
| qa-kc3 | 28 | 28 | 1 | 0 | 0 | 04 |

- Centret står mitt i översta raden (`left:50%`) med högst 2 hus på varje sida. Alla elevnamn finns kvar.
- Klick på eget hus ("Du!") → `#/elev/hus`, bakåt → byn med centret kvar. Klick på kamrat (Alice) → `#/elev/kompis?id=kc06` ("Alices hus"). Inga fel.
- Klick på centret (`role=button`, `tabindex=0`) → bubblan "Klasscentret – Nivå 3 Träkoja · inredning kommer snart" (03). Ingen navigering.

### F1 (medel): "Andra byar"-skylten täcker hus i nedre vänstra hörnet

- **Repro:** logga in som `ke01` (28 elever) → `#/elev/by`. Skylten "Andra byar" (`.varld-navskylt`, nere till vänster) täcker de två första tomterna i sista raden ("Saga"). Uppmätt med `getBoundingClientRect`: 2 tomter under skylten på grenen, **0 på `origin/main`** med samma data (04 jämfört med 13).
- **Orsak:** `byLayout` (`src/varld-by.js`) reserverar inte hörnet. På main klarar sig 28 elever av en slump: sista raden blir 8, 8, 8, 4 och de fyra husen hamnar till höger (slingan går åt andra hållet). Med centret blir raderna 4+C, 8, 8, 8, så sista raden är full och börjar i vänsterkanten.
- **Omfattning (beräknat med byParams/byLayout, ungefärligt hörn x < 22 %, botten > 82 %):** grenen 10, 11, 17, 18, 27, 28 elever. Main 18, 20, 21, 31, 32. Det är alltså en befintlig svaghet, men epicen flyttar den till realistiska klasstorlekar (27–28).
- **Förslag:** reservera hörnet i `byLayout`. Hoppa till exempel över kolumn 0 i den nedersta raden när den börjar till vänster, eller ge raden ett större `margX` till vänster.

## 3. EXP-uppgradering (acceptans 2) och normalisering

Live i egna byn (`kd01`, 5 elever, `subscribeClassExp`), utan att ladda om:

| Klass-EXP | Visat | Skärmdump |
|-----------|-------|-----------|
| 34 | Nivå 1 · Lägereld – "34 / 35 övningar till Nivå 2" | 06 |
| 35 | **Nivå 2 · Tält** (bilden byts, `data-niva=2`) – "35 / 80 övningar till Nivå 3" | 07 |
| 1349 | Nivå 9 · Högkvarter – "1 349 / 1 350 övningar till Nivå 10" | – |
| 1350 | **Nivå 10 · Kristallpalats – "Maxnivå"** | 08 |

Normalisering (samma EXP per elev ger samma nivå):

| Klass | Elever | EXP | Nivå | Mätare |
|-------|--------|-----|------|--------|
| qa-kc | 14 | 230 | 3 | 230 / 392 |
| qa-kc3 | 28 | 460 | 3 | 460 / 784 |
| qa-kc | 14 | 98 (= 7/elev) | 2 | 98 / 224 |
| qa-kc3 | 28 | 196 (= 7/elev) | 2 | 196 / 448 |
| qa-kc3 | 28 | 195 | 1 | 195 / 196 |

## 4. Spelkopplingar

Den riktiga `awardExercise` (`src/game-shared.js`) anropades i webbläsaren som `kd01`, med samma `classResult` som spellägena skickar. Resultatet lästes sedan ur emulatorn med firebase-admin (summan av alla shards plus `expMembers/kd01`). Varje anrop gjordes med minst 17 s mellanrum.

| Omgång | Förväntat | classTotalExp | Elevens mynt (returnerat → studentData) |
|--------|-----------|---------------|------------------------------------------|
| quiz 4/10 | 0 | 1350 → 1350 | +10 → 110 |
| quiz 49/100 | 0 | 1350 | +10 → 120 |
| quiz 50/100 | +1 | **1351** | +10 → 130 |
| memory ×4 (samma område) | +1, +1, +1, 0 | **1352, 1353, 1354, 1354** (`counts.memory\|qa-omr-2 = 3`) | +5, +4, +3, +2 → 144 |
| räkna 10 rätt | +1 | **1355** | +5 |
| räkna 7 rätt | 0 (rest 7 sparas) | 1355 (`rakna\|ratt = 7`) | +4 |
| räkna 3 rätt | +1 (7+3) | **1356** (`rakna\|ratt = 0`) | +3 → 156 |
| quiz 5/10 + 6/10 med 2 s mellanrum | +2 | **1358** (andra väntar ut spärren i bakgrunden) | +10 +10 → 176 |

- Elevens mynt blev exakt 100 + summan av de returnerade belöningarna. Klass-EXP rör alltså aldrig `coins`/`xp`. Koddiffen mot main för `awardExercise`/`showResult`/quiz/räkna är bara `classResult`-parametern och en dynamisk fire-and-forget-import. Mynt- och stjärnberäkningen är orörd.
- Inga `[klasscenter]`-varningar i konsolen.

## 5. Säkerhet

- `node --test test/firestore-rules*.test.js` mot emulatorn: **140/140**. Det inkluderar `firestore-rules-klasscenter.test.js`.
- Manuella försök från klienten (appens egen `db`, inloggad som `kd01`). Alla gav `permission-denied`:
  `expShards/0 {exp: 999999}` · shard `increment(500)` · `classCenters/qa-kc2 {classTotalExp}` · `classes/qa-kc2 {classTotalExp}` · egen `expMembers {exp: 1000}` · +1 till en annan klass (`qa-kc`, ej medlem) · radera shard · annan elevs `expMembers` · en förfalskad parad batch på **+4** · +1 direkt efter en godkänd skrivning (< 15 s).
- Avsiktligt tillåtet (se O3): en förfalskad parad batch på **+3** med valfri `lastKalla`, och att skriva om sina egna `counts`.

## 6. Pixi

- Pixi (#396, PR #435) finns **inte** på den här basen. Det finns ingen `pixi` i `src/`, så `?pixi=pa` gör ingenting. Byn renderas som vanligt utan konsolfel.
- **Provmerge** (temporär worktree, togs bort efteråt): `origin/epic/v-rldsvyerna-pixijs-renderare-perfekta-v-3679d6` mergar **utan konflikter** in i grenen. Med `?pixi=pa` som `kc01`:
  - byn ritas med centret och 14 hus, och `canvas.varld-pixi` finns;
  - by→eget hus→bakåt och by→kompis→bakåt fungerar; grannbyn 4C (28 hus) visar centret och bubblan;
  - 0 fel eller varningar i konsolen. Mitt i zoomen syns centret med mätaren i Pixi-bilden (11, 12).
- Provmergens enhetstester: 1092/1095. De 3 som failar (`varld-motor`, `varld-profil-gard`, `varld-render-anim`) hårdkodar "bootgrafen = 133 filer", men main är 110 sedan #452. Det beror inte på klasscentret, men det måste rättas vid Pixi-mergen.

## 7. Grannby

- `kd01` (4B) → skolan → "Klass QA-klass 4A, 14 hus" → `#/elev/grannby?id=qa-kc`: centret visar *"Klasscentret i QA-klass 4A, Nivå 2 Tält. 98 / 224 …"* och 14 hus (09). Klick ger bubblan "Klasscentret i QA-klass 4A – … · inredning kommer snart". Inga knappar, ingen navigering.
- 4C (28 hus): visar Nivå 2, och efter EXP 195 och omladdning Nivå 1 (10).

## 8. Testsviten

- Enhetstester (79 filer, utan regler/e2e): **975/975** efter mergen av `6315035` (972/972 före).
- Regeltester: **140/140**. e2e-auth (`test/e2e-auth.test.mjs`, Auth- och Firestore-emulator): **5/5**.

## Observationer (inte buggar)

- **O1 Mätaren:** stapeln visar andelen *inom* nivån, medan texten visar klassens totala tal. "35 / 80" har tom stapel och "230 / 392" bara ~4 % stapel. Det är konsekvent (`progressTillNasta.andel`), men kan läsas som en motsägelse. Designfråga för Elias.
- **O2 Grannbyn uppdateras inte live:** centret läses en gång (`getClassExp`, `kc-by.js:94`). Det är avsiktligt (view-only, färre läsningar).
- **O3 Klient-betrodd EXP:** en elev kan själv skriva +3 per 15 s med valfri källa (≈ 720/h) och nollställa sina `counts`, till exempel Memorys "3 första gångerna". Det följer designen i `docs/klasscentret-analys.md` (ingen backend) och begränsas av takt-spärren. Bör nämnas inför live.
- **O4 Snabb omspelning:** EXP från en omgång inom 15 s köas i bakgrunden och landar. Stänger eleven fliken innan spärren gått ut försvinner den. Liten påverkan.
- **O5 Pixi-merge:** lägg `.kc-bubbla` i `ignorera` i `varld-profil-by.js`, så en öppen placeholder-bubbla inte bakas in i by-texturen. Uppdatera de tre bootgraf-testerna (133 → 110). Centret bakas korrekt in i texturen.
- **O6** Placeholder-bubblan ligger över själva byggnaden (03). Det är kosmetiskt.
- **O7** Seedens 28-elevsklass har dubblettnamn (19 namn i listan). Det gäller bara testdata.
- **O8** Nivån härleds ur nuvarande elevantal (öppet beslut i epicen) och kan alltså sjunka om elever läggs till. Det testades inte vidare.
- Emojis i rubriker och mynt-ikoner visas som ▯ i headless-Chrome. Det är en känd miljöbegränsning, inte en bugg.
