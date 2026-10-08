# QA-rapport – Klasscentret 3/4 (epic #474, issue #499)

Testat 2026-10-08 av Coder-agenten (QA). Gren: epic-grenen vid `df5853c` (A–E, #494–#498
landade). Allt kördes mot **Firestore- och Auth-EMULATORN** via `admin/qa-emulator-proxy.mjs`
(samma origin), headless Chrome 780×437, en flik. Inga skrivningar mot live, ingen deploy.
Skärmdumpar: `docs/qa-klasscentret-3/499-*.png`.

## Sammanfattning

| # | Kontroll | Resultat |
|---|----------|----------|
| 1 | Boot + bootgraf | ✅ BFS från `src/app.js` = **110 filer, identisk med epic 2 (`c4d9fa2`)**, inga `klasscenter/*`; kall boot 119 anrop alla 200, 0 konsolfel/varningar under hela körningen |
| 2 | Pokaler delas ut automatiskt | ✅ MM "Avsluta" (UI) → vinnarklassen får pokal; archiveIfEnded (UI) → pokal; avsluta/arkivera igen → fortfarande EN; två samtidiga lärare → EN; oavgjort → alla delade vinnare. Live: vinst → `live-vinst`; kooperativt + mål nått → `live-avklarat`; draw → ingen. **F1 hittad och rättad** (Live-historiken gav aldrig pokal) |
| 3 | Säkerhet | ✅ 214/214 regeltester + 34 manuella försök i emulatorn: elev kan inte skapa/ändra/radera, lärare kan inte ändra/radera eller ge pokal till fel klass/ej avslutad källa/fel typ; manipulerade fält nekas; layoutnycklar `pokal-…` valideras (16 kontroller) |
| 4 | Rummet | ✅ auto-placering på hyllan, identisk för kc01 och kc02; flytta → Spara → v17; Historik → Återställ → v18 (pokalen tillbaka på hyllan); spärrad kc03: inga verktyg, drag gör inget, regeln nekar; tooltip titel/text/detalj/datum vid hover och tryck; inga tomma platshållare |
| 5 | Statistiktavlan | ✅ klick → panel; 263 EXP, 917 lösta, "Nivå 3 Träkoja → Nivå 4 Timmerstuga, 263 / 448 EXP · 185 kvar" = exakt seedade/beräknade värden; Escape stänger och fokus går tillbaka; läsning per panelöppning = **1 dokument** (`classProjections/{klass}`) + den delade klasslistan (se O2) |
| 6 | Regression + testsviter | ✅ epic 1+2: Klass-EXP live på tavlan, donationer (28 samtidiga → 0 nekade), layout/historik/spärr, lärarsektionen; **1132/1132** enhet, **214/214** regler, **5/5** e2e-auth (`npm test` finns inte – se Miljö) |

**Buggar: 1 i appen (F1, medel) – rättad i den här grenen (en rad).** F2 var ett fel i ett QA-skript och är rättat.

## Miljö och recept

- Emulator: firebase-tools (npx-cache) + JRE `/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin`, `JAVA_TOOL_OPTIONS=-Xmx384m`. Temporär config med egna portar (Firestore 8510, Auth 9510, hub 4510), regler = grenens `firestore.rules`. Configfilen är borttagen efteråt.
- Proxy: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8510 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9510 PORT=8511 node admin/qa-emulator-proxy.mjs`
- Seed (i ordning): `qa-klasscenter-by-seed` → `qa-klasscenter-rum-seed` → `qa-klasscenter-larare-seed` → `qa-klasscentrum-shop seed` → `qa-mattematchen-seed` → `qa-mattematchen-larare-seed` → `qa-live-seed`. Lösenord `lilla123`.
- **`npm test` finns inte** i `package.json`. Motsvarande körning: enhet = `node --test` på `test/*.test.*` utom `firestore-rules*`/`e2e*`; regler = `npm run test:rules` (här med `--config` mot egna portar); e2e = `test/e2e-auth.test.mjs` under `emulators:exec --only auth,firestore`.
- **Nytt:** `admin/qa-klasscentret-3-kontroll.mjs pokaler | layout | placering` – skriptade kontroller via klient-SDK:n (som läraren/eleven, reglerna gäller), samma kod som appen (`korPokalUtdelning`, `pokalerUrKalla`, `placeraPokaler`). Avslutar med exit 1 om något failar. `layout` återställer rummets layout efteråt.
- Byte av användare i samma flik: `import("/src/auth.js")` → `signOutCurrent()` + `signInStudent(u, pw, true)` / `signInTeacher()`. Se O4: ladda om sidan innan behörighet i rummet bedöms.

## 1. Boot och bootgraf

- BFS över statiska `import`/`export … from` från `src/app.js`: HEAD **110** filer, epic 2 (`c4d9fa2`) 110, `diff` tom, identisk med epic 2:s lista (`docs/qa-klasscentret-2/bootgraf-bfs-head.txt`). Listan: `docs/qa-klasscentret-3/bootgraf-bfs-499.txt`. Inga `klasscenter/*`, inga `art-klasscenter-pokaler*`.
- Epicens ändringar i bootfiler (`leveling.js`, `class-projection-entries.js`, `projection-sync.js`, `rum-inredning.js`, `styles.css`) lägger inte till några importer.
- Kall boot: 119 anrop, alla 200, 0 `kc-*`. 0 fel/varningar i konsolen genom hela körningen (lärare, elever, rum, panel).
- Inga ändrade `.js` över 400 rader (största nya: `kc-pokal-typer.js` 276).

## 2. Pokaler delas ut automatiskt

### I appen (lärarens UI)

| Steg | Resultat |
|------|----------|
| qalarare öppnar "Mattematchen september" (tiden slut, ej avslutad) | `archiveIfEnded` sparar result (vinnare 4A) → `classCenters/mm-4a/trophies/mm-klasskamp-mm-qa-september` ("Mattematchens mästare", detalj "Mattematchen september", awardedBy qalarare) |
| "Avsluta" på "Mattematchen oktober" | result (vinnare 4B, 67,0 p) → `mm-4b/trophies/mm-klasskamp-mm-qa-oktober`. Efter avslut finns ingen Avsluta-knapp |
| `finishCompetition` + `archiveIfEnded` igen (direkt, samma modul) | fortfarande **en** pokal i `mm-4b` (`ny:false`), inga varningar |
| rasmus öppnar Live-historiken "4B mot 5E" (result saknas, räknas vid första visning) | **före rättelsen: ingen pokal** (F1). **Efter:** result `players` 3/3 → `classCenters/4b/trophies/live-vinst-historik-demo`, 5E ingen. Live-bonusen (+EXP `live` båda, `live-vinst` 4B) delas också ut |

### Skriptat (`kontroll.mjs pokaler`, 34/34 ✓)

- MM: vinnaren får `mm-klasskamp`, förloraren ingen; igen → `ny:false`, en pokal; titel/detalj/wonAt/awardedBy rätt.
- **Två lärarklienter samtidigt** → en `ny:true` + en `ny:false`, ett dokument.
- **Oavgjort** (`winnerClasses: [qa-kc, qa-kc3]`) → båda får pokal, tredje ingen. Ingen som svarat rätt → ingen pokal.
- Live tävling: vinnaren får `live-vinst`; `live-avklarat` nekas (inget kooperativt mål); förloraren nekas; draw → ingen.
- Live kooperativt + `goalReached` → `live-avklarat` till båda deltagande klasser; mål ej nått → ingen; klass med 0 spelare nekas; ingen `live-vinst` i kooperativt läge; vinnare som inte deltog nekas.
- Notera: inget kooperativt Live-läge finns ännu (#495) → `live-avklarat` kan bara testas med konstruerad data.

### F1 (medel): Live-match som avslutas utan öppen projektor ger ingen pokal och ingen Live-bonus – ✅ rättad här

- **Repro (före rättelsen):** `node admin/qa-live-seed.mjs` → logga in som `rasmus` → Live → Historik → "4B mot 5E". Result skrivs med `perClass.4b.players = 0` och `5e.players = 0`. Ingen `trophies`-post, inga `expShards` för 4b/5e.
- **Orsak:** `ensureResult` i `src/live/teacher-live-history.js` (finns sedan #460) anropade `classStandings(s, sumCounters(...))` **utan spelarlistan**. Därför blev `joined` 0 och `result.perClass[k].players` 0. Pokalen (`liveDeltar`, reglernas `players > 0`) och Live-bonusen (`liveBonusar`) kräver spelare > 0. Projektorvägen (`live-feed.js`) skickar med spelarna och påverkas inte.
- **Konsekvens:** när ingen lärarprojektor var öppen vid matchslut och läraren öppnar matchen i historiken räknas resultatet. Det sparas permanent (create-once) utan spelare, så klassen får varken pokal eller Live-EXP, och det går inte att rätta i efterhand.
- **Rättelse (i den här grenen):** `classStandings(s, sumCounters(await getCounters(s.id)), players)`. Det är ett extra argument och `players` fanns redan i funktionen. Verifierat i UI:t efter omladdning: players 3/3, pokal och bonus. Inget enhetstest, eftersom `ensureResult` inte exporteras och modulen kräver DOM och Firebase. Leaden kan vilja ha ett test som en uppföljning.

## 3. Säkerhet

- **Regeltester:** `npm run test:rules` **214/214** (inkl. `firestore-rules-klasscenter-pokal.test.js` och `-layout-pokal.test.js`).
- **Manuellt i emulatorn** (`kontroll.mjs pokaler`): elev i vinnande klass skapar → nekas; elev ändrar/raderar → nekas; lärare ändrar/raderar/skriver över med `set` → nekas (create-only); lärare ger pokal till förlorande klass, till ej avslutad tävling, för källa som inte finns, eller MM-källa som `live-vinst` → nekas. Rått dokument med fel id, `awardedBy` ≠ inloggad, `wonAt` = klientens tid, extra fält, okänd typ, titel > 80 eller detalj > 120 → nekas; korrekt rått dokument → ok (kontroll av basfallet). Elev får läsa annan klass pokaler (gästläge).
- **Layoutnycklar** (`kontroll.mjs layout`, 16/16 ✓, råa skrivningar förbi klientvalideringen): **som ELEV** sparas fullt rum (8 möbler + 8 pokaler, 1000-uttryckstaket håller); 9 pokaler eller 10 blandade nekas; blandade typer ok; `pokal-guld-x`, `hackad`, `'/'`-tricket (två nycklar som en), `å`, tomt kallaId, x = 101, z = 1.5, extra fält och x som text nekas. Spärrad kc03 och kd01 från en annan klass nekas när de flyttar bara en pokal.
- **Förtroendemodell (ingen bugg):** reglerna verifierar mot källans `result`, men `result` skrivs av lärarklienten och `validCompetition` validerar inte vinnaren mot räknarna. En (vilken som helst) lärare kan alltså i teorin skriva ett påhittat result och sedan dela ut en pokal. Det är samma lärarförtroende som i resten av appen. Elever kan inte skriva `result` (`liveAutoFinishOk` tillåter bara `status`/`finishedAt`).

## 4. Rummet

Klass `qa-kc`, 8 pokaler (3 från seeden + 5 från skriptet), hyllan full (01).

| Steg | Resultat | Bild |
|------|----------|------|
| kc01 öppnar rummet | 8 pokaler auto-placerade på hyllan (äldst först), tavlan till höger, inga tomma platshållare | 01 |
| Hover på "Live-segrare" | "🏆 Live-segrare · Klassen vann Live-matchen! … · 🏁 Live: Multiplikationsracet · 📅 29 september 2026"; pointerout → döljs | 02 |
| Tryck (touch) på "Oktobermatchen" | samma ruta: titel, text, "🏁 Oktobermatchen · 📅 6 oktober 2026" | – |
| Dra pokalen till 73 %, 59 % → Spara | "✓ Sparat!" → v17, `placedItems` = `guldstaty` + `pokal-mm-klasskamp-qa-mm-okt` (de oflyttade sparas inte), hyllan packas om (7 kvar, ingen lucka i mitten) | 03 |
| kc02 (andra klienten) öppnar rummet | alla 8 pokaler på **exakt samma** positioner som hos kc01 | – |
| kc02: Historik → Återställ (v16) | v18 av kc02, pokalen tillbaka på hyllan | – |
| kc03 (spärrad), efter omladdning | bara "← Till byn", "👀 … läraren har stängt av inredning för dig.", drag av pokal flyttar ingenting; tooltip fungerar | – |
| `kontroll.mjs placering` (5/5) | samma placering oavsett ordning/klient; äldst först, lika `wonAt` → id; 11 pokaler → 8 på hyllan + 3 på väggen, inte på upptagen plats; flyttad pokal auto-placeras inte; platsvalet beror inte på skärmstorleken | – |

## 5. Statistiktavlan

Seedat för `qa-kc`: `expShards` 0/1/3 = 230 + 20 + 13 = **263**. `classProjections.members.plays` för kc01–kc13 är 10·i, och kc14 har bara `completed: 7` (gammal post) → 910 + 7 = **917**. Ex-eleven `kc99` (inte i `studentIds`, plays 500) ska **inte** räknas. Förväntad nivå enligt `progressTillNasta(263, 14)`: Nivå 3 Träkoja → 4 Timmerstuga, 263/448, 185 kvar.

- Tavlan bytte från 230 till **263 EXP i realtid** (shard-ändring utan omladdning).
- Klick → panelen "Klassens statistik" (04): **263** EXP, **917** lösta, "🏛️ Nivå 3 Träkoja → Nivå 4 Timmerstuga · 263 / 448 EXP · 185 kvar", "14 elever tillsammans". Alla värden stämmer exakt, och ex-eleven är exkluderad.
- Escape stänger panelen, och fokus går tillbaka till tavlan (`.kc-statistiktavla`).
- **Läsningar** (Listen-kanalens svar fångade i nätverket under panelöppningen): `addTarget` för **ett** dokument, `classProjections/qa-kc` (1 `documentChange`), plus klasslistan `classes` (12 dokument i emulatorn) eftersom `getClasses()`-cachen var äldre än 30 s. EXP kommer från den redan öppna `expShards`-lyssnaren (≤ 5 dokument, öppnas en gång per rum). **Ingenting per elev.** Se O2 om klasslistan. Websocketen för emulatorns request-logg (9150) svarade inte, så räkningen gjordes i nätverket.

## 6. Regression och testsviter

- `node admin/qa-klasscentret-2-kontroll.mjs samtidighet 28 1`: 28 → **28 ok, 0 nekade** (akvarium), troféhylla 9 ok + 19 `redan-kopt`, exakt 2 500. `samtidighet 10 3`: alla kontroller ✓, dragna mynt = poster.
- `… regler`: 14/14 ✓ efter F2-rättelsen. `… layout`: 8/8 ✓ (två samtidiga sparningar, återställ, spärr, gäst).
- City Hall-drag och Spara/Historik/Återställ: se 4 (samma drag-kärna).
- Lärarsektionen: Klasser → klass → **Klasscentret** visar "Vem får inreda?" + Insamling.
- Klass-EXP: tavlan och panelen följer `expShards` live.
- Enhet **1132/1132** (91 filer), regler **214/214**, e2e-auth **5/5**. Efter F1-rättelsen kördes enhetstesterna igen: 1132/1132.

### F2 (QA-skript, rättat): `qa-klasscentret-2-kontroll.mjs regler` byggde på en befintlig insamling

Efter en ny `qa-klasscentrum-shop seed` finns ingen `fund/guldstaty`. Två kontroller ("fund + post utan myntavdrag", "donation mer än saldot") failade därför med ett JS-fel i stället för `permission-denied`. Skriptet startar nu insamlingen med en riktig donation på 100 om den saknas. Appen påverkas inte.

## Observationer (inte buggar)

- **O1 – Rummets rubrik/mätare är inte realtid.** Efter EXP-ändringen visade tavlan och panelen 263 (Nivå 3), men rummets rubrik stod kvar på "Nivå 2 Tält · 230 / 238" tills rummet öppnades igen (04). Det är kosmetiskt.
- **O2 – Panelen läser klasslistan.** `hamtaLosta` anropar `getClasses()` för att filtrera på `studentIds`. När 30 s-cachen har gått ut läses hela `classes`-samlingen (alla klasser, inte elever). Det är appens befintliga mönster (byn gör samma sak), så det är O(antal klasser) och inte per elev. Det kan undvikas med rummets redan kända medlemslista om kvoten blir trång.
- **O3 – Möbler kan ställas över tavlan.** En flyttad pokal/möbel kan ställas ovanpå statistiktavlan (03) och täcka knappen. Tavlan ligger i bakgrunden, så den går inte att klicka där den är täckt.
- **O4 – Byte av användare utan omladdning (testartefakt).** Efter `signOutCurrent()` + `signInStudent("kc03")` i samma flik, med kc02:s rum öppet, behöll rummet kc02:s verktyg, och ett drag flyttade pokalen lokalt. Reglerna hade ändå nekat Spara. Efter en omladdning var allt rätt. Den riktiga "Logga ut"-knappen testades inte för just det här flödet.
- **O5** Vid omladdning med `signInTeacher` (utan "kom ihåg") loggades sessionen ut. Det är väntat beteende för sessionspersistens.
- **O6** En kvarhängande `confirm` ("Avsluta …") listades av testverktyget efter att avslutet redan gått igenom. Samma artefakt som O4 i epic 2:s rapport.
- **O7** `live-avklarat` delas inte ut i dag, eftersom det inte finns något kooperativt Live-läge (beslut i #495, flaggat till Elias).
- Emojis visas som ▯ i headless-Chrome (känd miljöbegränsning).
