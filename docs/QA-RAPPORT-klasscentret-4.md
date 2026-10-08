# QA-rapport – Klasscentret 4/4: slut-QA av hela Klasscentret (epic #473, issue #502)

Testat 2026-10-08 av Tester-agenten. Gren: epic-grenen vid `fe01ce2`, med epic 1–4 och #500 + #501 landade.
Allt kördes mot **Firestore- och Auth-EMULATORN** via `admin/qa-emulator-proxy.mjs` (samma origin) i headless Chrome 780×437, en flik.
Inga skrivningar mot live, ingen deploy, inget till main. Skärmdumpar finns i `docs/qa-klasscentret-4/502-*.png`.
Klickguide för Elias: `docs/preview-klasscentret.md`.

## Sammanfattning

| # | Kontroll | Resultat |
|---|----------|----------|
| 1 | Placering (spec §9.1) | ✅ Testat för 0–30 elever i `byLayout`: centret står mitt i översta raden (x = 50), med högst 2 hus per sida. Varje elev får en egen tomt, och ingen tomt hamnar i centret, i skylten eller utanför byn. I UI:t med 5, 14 och 28 elever: 2 + center + 2, med 5/14/28 hus. Alla seedade elever har kvar sin `studentData` |
| 2 | EXP-uppgradering (§9.2) | ✅ Byn bytte från Tält till Träkoja **live** (238 EXP), och rummets rubrik/mätare bytte till Nivå 4 Timmerstuga, "448 / 770", **live** med rummet öppet. Skriptat: elevens +1 EXP passerar tröskeln, gästen nekas. Riktiga `awardExercise`: quiz 4/10 ger 0 EXP och 8/10 ger +1, egen progress sparas, och `plays` (tavlans "lösta") ökar |
| 3 | Crowdfunding (§9.3) | ✅ A (ks01, UI) donerar 100 och kortet visar "100 / 5 000". B (ks02, egen session) ser `100 / 5000`. Därefter donerar B 400 och A:s flik visar 500 / 5 000 utan omladdning. Eleverna ser bara summan och "du har bidragit med …" |
| 4 | Upplåsning (§9.4) | ✅ A skriver 9 999 och fältet kläms till 1 900 (det som saknas). Kortet visar 5 000 / 5 000 "✓ Köpt! Finns i klassens möbellåda" och inga knappar finns kvar. Saldot gick från 2 980 till 980, så exakt 1 900 drogs. Statyn finns i Möbellådan, placerades och sparades (v1). Skriptat: ett överskott cappas och fler donationer ger `redan-kopt` utan att några mynt dras |
| 5 | Gästläge (§9.5) | ✅ kd01 (4B) gick via "Andra byar" till 4A:s center. Där syns inga Möbellåda/Historik/Spara och besöksraden visas. Pokal-hover visar rutan och tavlan öppnar panelen. Ett drag flyttar ingenting. **Råa skrivningar nekas** (layout, historik, spärrlista, pokal, donation, EXP). Gästen läser inte spärrlistan eller donationsposterna |
| 6 | Beslutspunkter | ✅ Normalisering per elev (14 och 28 elever), EXP-regel per modul, anonyma donationer (läraren ser vem), lärarens bockar (UI + regler), återställ-historik, pokaler + tavla, utloggning med rummet öppet (rummet stängs) |
| 7 | Regression | ✅ Byn, Mitt rum (placera + dra → autosparat), shoppen (vanligt köp Keps 20 och Pall 30), Mattematchen (3 rätt), Läsresan, lärarsidan (Klasser/Klasscentret/MM/Live/Innehåll) |
| 8 | Bootgraf + boot | ✅ BFS från `src/app.js` = **110 filer, identisk med #499 och #501**, inga `klasscenter/*`. Kall boot: 119 anrop, alla 200, 0 konsolfel. ⚠️ Vid utloggning kommer 3–4 varningar från lyssnare som också finns på main (O1) |
| 9 | Testsviter | ✅ Enhet **1147/1147** (92 filer), regler **254/254**, e2e-auth **5/5**. Kontrollskripten för epic 2 (regler 14, layout 8, samtidighet 28×1) och epic 3 (pokaler 35, layout 16, placering 5) är gröna. Nya `qa-klasscentret-4-kontroll.mjs`: `alla` **38/38** + `insamling` **9/9** ✓ |

**Inga buggar i Klasscentret.** Inget i appen är ändrat i den här issuen. Nytt är två QA-skript (`admin/qa-klasscentret-4-kontroll.mjs` och `admin/qa-klasscentret-preview.sh`) och dokumentation.

## Miljö och recept

- **Emulator:** firebase-tools (npx-cache) + JRE `/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin`, `JAVA_TOOL_OPTIONS=-Xmx384m`. Firestore 8520, Auth 9520, hub 4520. Reglerna är grenens `firestore.rules`.
- **Allt i ett:** `bash admin/qa-klasscentret-preview.sh` startar emulatorn, kör alla seeds och startar proxyn på 8521. Exakt kommando och konton finns i `docs/preview-klasscentret.md`.
- **Testsviter:** regler `npm run test:rules -- --config <egen firebase.json med 8530/9530>`. E2E `firebase emulators:exec --config … --only auth,firestore "node test/e2e-auth.test.mjs"`. Enhet `node --test` på `test/*.test.*` utom `firestore-rules*`/`e2e*`. `npm test` finns inte.
- **Worktreen saknade `node_modules`.** Jag länkade in #499:s (`ln -s …/499-…/node_modules`, git-ignorerad).
- **Nytt:** `node admin/qa-klasscentret-4-kontroll.mjs alla | placering | normalisering | regler | niva | gast | insamling`. Skriptet skriver via klient-SDK:n som eleven/läraren, så reglerna gäller. `insamling` kräver en nyss seedad qa-ks (`qa-klasscentrum-shop.mjs seed`).

## 1. Placering (5, 14, 28 elever)

| Elever | Klass / konto | Centret | Översta raden | Rader | Bild |
|--------|---------------|---------|---------------|-------|------|
| 5 | QA-klass 4B / kd01 | span 2, 28 % brett (cell 14 %) – Rådhus N6 | 2 + center + 2, femte huset under | 2 | `502-04-by-5-elever.png` |
| 14 | QA-klass 4A / kc01 | span 3, 36 % brett (cell 12 %) – Tält N2 | 2 + center + 2 | 3 | `502-01-by-14-elever.png` |
| 28 | QA-klass 4C / ke01 | span 3, 31,5 % brett (cell 10,5 %) – Tält N2 | 2 + center + 2 | 4 (+ skylten) | `502-07-by-28-elever.png` |

- Skriptat (`placering`): för **varje** antal 0–30 ligger centret på x = 50 i rad 0, med högst 2 hus per sida och skillnad högst 1 mellan sidorna. Det finns `n` unika tomter, och ingen ligger i centrets ruta, i skylten eller utanför 0–100 %.
- "Andra byar"-skylten täcker inget hus med 28 elever (F1 från QA 1 är fortfarande åtgärdad).
- Alla 5/14/28 elever i de seedade klasserna har sin `studentData`. Centret flyttar bara husens plats.

## 2. EXP-uppgradering

| Steg | Resultat | Bild |
|------|----------|------|
| kc01 i byn, qa-kc 230 EXP | aria "Nivå 2 Tält. 230 / 238 övningar till Nivå 3" | 01 |
| `qa-klasscenter-by-seed.mjs exp qa-kc 238` (byn öppen) | Tältet byts till **Träkoja** utan omladdning (`kc-nyniva`), "238 / 448 till Nivå 4" | 02 |
| Rummet öppet, `exp qa-kc 448` | Rubriken blir "Klasscentret · Nivå 4 Timmerstuga" och mätaren "448 / 770 övningar till Nivå 5" **live** (O1 i #499 är åtgärdat i #501) | 03 |
| Skriptat `niva` | kc01 (elev) +1 EXP via `planKlassExpWrites` ger 237 → 238 och N2 → N3, mätaren "238 / 448 till Nivå 4". Gästen kd01 → `permission-denied` | – |
| Riktiga `awardExercise` som kc01 | quiz 4/10 ger 0 EXP och 8/10 ger +1 (shard 4, `lastKalla quiz`). `progress.qa502-omrade.quiz.plays = 1` och `classProjections.qa-kc.members.kc01.plays = 1`, så tavlan visar 1 löst | – |

## 3–4. Crowdfunding och upplåsning

Klass `qa-ks` "QA-klass 5A", ks01 (Alva) och ks02 (Ebbe), 3 000 mynt var.

| Steg | Resultat | Bild |
|------|----------|------|
| ks01 köper först Keps (20) – vanligt köp | Saldot går från 3 000 till 2 980, "✓ Köpt" | – |
| Klasscentrum-fliken | 8 kort, 0 / X | – |
| ks01: Guldstaty → 100 → "Skänk 100" | "100 / 5 000 mynt insamlade" | – |
| ks02 lyssnar (`qa-klasscentrum-shop.mjs lyssna ks02`) | `ks02 ser: guldstaty 100 / 5000` | – |
| ks02 donerar 400 (skript) | ks01:s flik: **500 / 5 000** + "Du har bidragit med 100 mynt" (ingen givarlista) | – |
| ks02 donerar 2 600, ks01 skriver 9 999 | Fältet kläms till **1 900**, och knappen visar "Skänk 1 900" | – |
| Skänk | "5 000 / 5 000 – ✓ Köpt! Finns i klassens möbellåda", inga knappar. Saldot gick från 2 980 till 980 | 08 |
| ks01 → rummet → Möbellådan | "Guldstaty" finns. Placera + Spara ger `layout/current` v1, `guldstaty {x50,y78}`, `updatedBy ks01` | 09 |
| Skriptat `insamling` (9/9) | Realtid hos B, överskottet cappas (begärt 2 900, dragit 1 900), `isUnlocked` exakt 5000, mer → `redan-kopt`, `unlockedItems` innehåller statyn, dragna mynt = poster | – |
| Samtidighet `qa-klasscentret-2-kontroll.mjs samtidighet 28 1` | Akvariet: 28 ok, 0 nekade (0,3 s). Troféhyllan förbi målet: 9 ok + 19 `redan-kopt`, exakt 2 500, 5 300 dragna = 5 300 i poster (se O4) | – |

## 5. Gästläge

| Steg | Resultat | Bild |
|------|----------|------|
| kd01 (4B) → "Andra byar" → "QA-klass 4A, 14 hus" → centret | Rubriken "Klasscentret i QA-klass 4A", bara knappen "← Till byn", raden "👀 Du är på besök – bara klassen själv kan inreda här", klass `inredning-las` | 05 |
| Hover på "Live-segrare" | "🏆 Live-segrare · Klassen vann Live-matchen! … · 🏁 Live: Multiplikationsracet · 📅 29 september 2026" | – |
| Drag av pokalen (pointer-händelser) | Pokalen flyttas inte | – |
| Klick på tavlan | Panelen "Klassens statistik": 448 EXP, Nivå 4 → 5, 448 / 770 · 322 kvar, 14 elever | 06 |
| Skriptat `gast` (12/12) | Läser layout, pokaler, insamling och EXP. Läser **inte** profilen (spärrlistan) eller donationsposterna. Råa skrivningar av `layout/current`, `layoutHistory`, `inredningSparr`, pokal och donation (appens `korDonation`) → **nekas**. EXP till en annan klass → nekas (`niva`) | – |

## 6. Beslutspunkter

- **Normalisering per elev** (`normalisering`, 3/3): trösklarna är proportionella mot elevantalet (N2 98/196, N3 238/476 … N10 7 126/14 252 för 14/28 elever). 300 EXP med 14 elever och 600 EXP med 28 ger samma nivå (N3) och samma stapel (30 %). Samma totala 300 EXP ger 28 elever en lägre nivå.
- **EXP-regler per modul** (`regler`, 13/13), samma registry som appen:

  | Modul | Regel | Testat |
  |-------|-------|--------|
  | quiz, läsförståelse | ≥ 50 % | 5/10 → 1, 4/10 → 0, 10/10 → 1 |
  | memory, para, kunskapsjakt, sanningsjakt, äventyr | 3 första per område och elev | 5 gånger → 1,1,1,0,0, nytt område → 1 |
  | Läsresan | ≥ 5/7 | 5/7 → 1, 4/7 → 0 |
  | Mattematchen | var 20:e rätt | 19→20 = 1, 20→21 = 0, 0→40 = 2 |
  | Räkna | 10 rätt = 1, resten sparas | 7+7+7 → 0,1,1 (rest 1), 25 → 2 |
  | Live-bonus | per elev × elevantal | live 14 el = 42, 28 el = 84, live-vinst 14 el = 70 |
  | Okänd modul | – | 0 |

- **Anonyma donationer:** eleven ser bara totalsumman och sitt eget bidrag. `fund` har inget givarfält. En hemmaelev kan inte läsa `donations` (nekas), men läraren kan (13 poster). Lärarsektionen visar t.ex. "Guldstaty – Alice 2 500 · Oskar 2 500".
- **Lärarens bockar:** "Vem får inreda?" listar 14 elever, och Liam (kc03) är urbockad. När Wilma bockas ur och sparas blir `inredningSparr` `["kc03","kc04"]` (rätt elev-id). Bockas hon i igen återställs listan. kc03 i rummet: bara "← Till byn" och tavlan, plus "läraren har stängt av inredning för dig".
- **Återställ-historik:** `qa-klasscentret-2-kontroll.mjs layout` 8/8 (två samtidiga sparningar, återställ, spärr, gäst). Seeden lämnar v1–v3 i historiken för klickguiden.
- **Pokaler + statistiktavla:** `qa-klasscentret-3-kontroll.mjs pokaler` 35/35, `layout` 16/16, `placering` 5/5. I UI:t finns 8 pokaler på hyllan, tooltip och panelen.
- **Byte av användare / utloggning med rummet öppet:** riktiga "Logga ut" med kc01:s rum öppet stänger rummet och visar inloggningen. Byte av användare i samma flik (`signOutCurrent` + ny inloggning) gav rätt behörighet direkt (kd01 = gäst, kc03 = låst) utan omladdning.

## 7. Regression

| Område | Resultat |
|--------|----------|
| Byn | 5/14/28 hus, grannbyns lista, "Andra byar" |
| Mitt rum | ks01 köper Pall (30), Verktyg → Möbler → placera → dra ger `studentData.placements.stol {66.6, 68.5}`, autosparat |
| Shoppen | Keps 20 och Pall 30 drar rätt belopp, "Du har: 1 st" |
| Mattematchen | elev1: "Mattematchen oktober · slutar om 8 dagar", 3 rätt svar → "Nu: 3 rätt · 0 fel" |
| Läsresan | qa-oken: "Min läsning ✓ Skogen Öknen" (bara i testkörningen; seeden ingår inte i previewn) |
| Lärarsidan | Klasser (alla klasser), sektionen Klasscentret, Mattematchen, Live, Innehållsstudion laddar. 0 fel |
| Live | Lärarsidan "Skapa Live-match" laddar. Pokal/bonus via Live testades i `kontroll-3 pokaler` |

## Fynd

Inga buggar i Klasscentret (F-listan är tom).

## Observationer

- **O1 – varningar i konsolen vid utloggning (finns redan på main, gäller inte Klasscentret).** "Logga ut" ger `Fokusläget: kunde inte bevaka klassen …`, `Mattematchen: kunde inte bevaka tävlingar` och `Live: kunde inte bevaka sessioner`. Orsak: lyssnarna i `class-lock-watch.js`, `tavling/mm-watch.js` och `live/live-watch.js` stoppas inte innan Auth loggar ut, så Firestore säger nej till dem och de skriver en varning. Filerna är identiska med `origin/main`. Det är ofarligt (lyssnaren dör av felet) och blir ett enkelt uppföljningsärende om konsolen ska vara helt tyst. Klasscentrets egna lyssnare stängs rätt (#501).
- **O2 – formulering:** donationspanelen säger "**Bara** 5 000 mynt saknas!" även när inget har samlats in. Det är kosmetiskt.
- **O3 – byns mätare visas vid hover/fokus** (beslut i #484). Med pekskärm visas texten i bubblan vid tryck. I klickguiden står det att man ska hovra.
- **O4 – när 28 elever donerar samtidigt till samma föremål och målet fylls** fick den långsammaste eleven svaret "redan köpt" efter ~11 s i emulatorn (omförsök med backoff, 1–6 s per nekat commit i emulatorn, känt från #493). Inga mynt förlorades. I produktion är nekade commits snabbare.
- **O5 – testdata:** `qa-lasresan-seed` skapar en andra klass som också heter "QA-klass 4A" (`qa-klass`). Den ingår därför inte i preview-skriptet.
- **O6 – lärare får se och göra allt i alla klasser** (R1 i `SAKERHET-klasscentret.md`). Det är oförändrat och ett produktbeslut.
- Emojis visas som ▯ i headless Chrome (känd miljöbegränsning).

## Frågor till Elias (designfrågor från epic 3 – inte buggar, inget är ändrat)

1. **Statistiktavlans "lösta uppgifter"** räknar bara övningsomgångar (`awardExercise` → `classProjections.members.plays`), inte Läsresan, Mattematchen eller Live. Ska de räknas in? Det kräver en räknare per modul.
2. **Rummet har både en gratis pokalhylla och shoppens Troféhylla** (2 500 mynt via crowdfunding). Är det dubbelt? Alternativ: ta bort Troféhyllan ur shoppen, eller låt den köpta hyllan ge plats för fler pokaler. → **Besvarad i #528:** Troféhyllan är nu klassens hedershylla (6 finaste pokalerna automatiskt), gratis-hyllan rymmer 3.
3. **`live-avklarat`-pokalen ("Liveläge avklarat") delas aldrig ut i dag**, eftersom det inte finns något kooperativt Live-läge. Den finns bara som konstruerad testdata. Ska den vara kvar som förberedelse eller tas bort?
4. (Ny) **Startnivå för befintliga klasser:** alla klasser startar på 0 Klass-EXP, alltså Nivå 1 Lägereld. Ska klasser som redan pluggat få en startbonus (backfill ur historiska `plays`)? Det kräver ett adminskript som inte finns i dag.

## Före merge till main

1. **`firebase deploy --only firestore:rules`** (projekt `pluggportalen-so-2026`), FÖRE eller samtidigt med mergen. Grenen har +340 rader regler (`classCenters/**`: EXP-shards och elevposter, fund/donations, layout + historik, klassprofil, pokaler, rättelserna H1/H2 från #500). Utan deployen nekas alla Klasscentret-skrivningar (byn och appen startar ändå, men centret står på Nivå 1 och donationer/sparning misslyckas).
2. **Index:** `firestore.indexes.json` är **oförändrad** mot main, så det behövs ingen ny index-deploy för Klasscentret. Kontrollera att indexen från Mattematchen #459 (redan på main) faktiskt är deployade.
3. **Migrering/backfill:** krävs inte tekniskt. Saknade `classCenters`-dokument betyder 0 EXP och Nivå 1, och tavlans "lösta" använder befintliga `completed` som reserv tills `plays` fylls på. Startbonus är beslut 4 ovan.
4. **Mattematchen/Live-reglerna** (`mathCompetitions`, `liveSessions`) ligger redan på main. Kontrollera att de är deployade, eftersom pokal-reglerna läser deras `result`.
5. **Bootgrafen är oförändrad (110 filer)**, så det finns ingen risk för en vit sida från Pages/Fastly-cache (#271). Kontrollera ändå en kall boot på live efter deployen (bootvakten).
6. Lärarkontona behöver `teacher:true` (finns redan, `admin/set-teacher-claim.mjs`).
7. Previewn körs på emulatorn. Kör inga seed-skript mot produktion (de vägrar utan emulator-variablerna).
