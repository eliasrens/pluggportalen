# Guldrushen 💰 – slut-QA (#567, epic #562)

Slutverifiering mot emulatorerna (functions + auth + firestore, grenens egna
regler och Cloud Functions) och en riktig webbläsare (EN flik). Fler elever
kördes som egna klienter: firebase-SDK:t inloggat som varje elev och de
riktiga Cloud Functions-anropen, så reglerna och servern gäller precis som i
klassrummet. Skärmdumpar: [`qa-guldrush-567/`](qa-guldrush-567/), rådata i
[`qa-guldrush-567/data/`](qa-guldrush-567/data/).

**Sammanfattning:** Allt i funktionsspecen §10 (3c, 13–20, 20b–20i) och
designspecen §14 (designtest 1–13) är grönt, och Elias elevregel håller. Tre
fynd: **F1** (medel) gäller utbetalningens omförsök och berör även
Snilleblixten. **F2** och **F3** (låga) är visuella. Ingen regression i
Klassmatchen eller Snilleblixten.

## Testsviter (samma gren, efter all QA)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test test/*.test.{js,mjs}` utan emulatorsviterna) | ✅ 1547/1547 |
| `npm run test:rules` | ✅ 399/399 |
| `test:functions` (update-login + guldrush-core/stöld/e2e) | ✅ 34/34 |
| `npm run test:e2e` | ✅ 5/5 |
| Kall boot (`#/`, utloggad) | ✅ inga konsolfel |
| Bootgrafen (BFS från `src/app.js`) | ✅ 107 filer, inga Guldrush-filer statiskt |

⚠️ **Test:functions**: kör med den lokala firebase-tools (`~/.npm/_npx/…/firebase`).
Firebase-tools från Windows-disken (`/host/AppData/…`) gör att varje
funktionsworker tar ~47 s att starta, vilket ger "Failed to load function"
och `deadline-exceeded`. Det är inget kodfel.

## Metod och verktyg (nya i #567)

| Fil | Vad |
| --- | --- |
| `admin/qa-guldrush-slut-rigg.mjs` | Riggen: en firebase-klient per elev (inloggad, riktiga callables), sessioner, rapport |
| `admin/qa-guldrush-slut-kontroll.mjs` | `attack` (50 kontroller: test 13–19, 20, 3d, facit, trygghet), `av` (test 18), `nollstall` (200 000 slumpade effekter) |
| `admin/qa-guldrush-slut-pris.mjs` | `svarm` (prestanda + 20f), `pris` + `prisKolla` (20b–20i, 20g) |
| `admin/qa-guldrush-larare.mjs` | En lärarprojektor utan skärm: APPENS `live-feed` (markerar slut, skriver result, betalar). Används två samtidigt + `--omladdning` för 20g |
| `admin/qa-guldrush-preview.sh` | Ny flagga `FN_SEKVENS=1` = functions-emulatorn kör en worker åt gången (`--inspect-functions`). Utan den startar emulatorn en nodprocess (~140 MB) per samtidigt anrop, och RAM:et (8 GB) tog slut vid 20 samtidiga elever. Svarstiderna blir då **köade** (pessimistiska); i produktionen skalar Cloud Functions själv |

## Funktion (funktionsspec §10)

| Test | Resultat |
| --- | --- |
| **3c** Guldrushen + quiz | ✅ I lärarformuläret (webbläsaren) försvinner "Välj svarssätt" när Quiz från Plugga väljs. Den skapade sessionen fick `answerKind: "choice"`, facit bara i `grPrivate/snapshot`, publika frågor utan `answerIndex`. (Vikingatiden visar "0 frågor" eftersom alla dess frågor har lästext, vilket hoppas över medvetet i Live) |
| **13** Rätt svar → kista | ✅ Klient: rätt → en kista öppnas, guldet kommer från servern. Webbläsaren: 9 × 7 = 63 → tre kistor → 212 → 237 guld (+25) och nästa fråga på under 1 s. [e02](qa-guldrush-567/e02-kistor-chromebook.jpeg) |
| **14** Fel svar | ✅ `correct: false`, kista på fel svar nekas (`failed-precondition`) |
| **15** Stöld 100 → 85/+15 | ✅ Alma 100 → 85, Omar 40 → 55, summan bevarad (140 = 140), stöldskydd + `lastHit` på Alma, händelsen `steal 15` med båda namnen i `grEvents`. I webbläsaren: "🦝 Ivar knyckte 47 guld från dig!" med avatar. [e06](qa-guldrush-567/e06-notis-bestulen-chromebook.jpeg) |
| **16** Stöldskydd | ✅ Servern nekar ett manipulerat anrop mot en skyddad elev ("Den eleven har stöldskydd en liten stund till 🛡️") och guldet är orört. Att välja sig själv eller någon som inte är med nekas. Inget val inom tiden → servern slumpar bland tillåtna, aldrig den skyddade. UI: skyddade/sköldade är gråade och avstängda (18 av 27 i en lång match). [e04](qa-guldrush-567/e04-offer-stold-chromebook.jpeg) |
| **17** Byte bara mot rikare | ✅ Servern nekar byte med någon som har mindre guld. Byte med en rikare byter 5 ↔ 300 i en transaktion. Byte med 0 eget guld nekas. Finns ingen giltig blir det en vanlig guldkista. UI: bara rikare visas. [e09](qa-guldrush-567/e09-offer-byte-surfplatta.jpeg) |
| **18** Stöld av | ✅ 20 elever × 8 kistor = 160 kistor: ingen Stöld/Byte, inga offerval, inga `steal`/`swap`-händelser. Stöld- och bytevikten flyttas till guldkistorna (samma totalvikt) |
| **19** Manipulation | ✅ Nekas: samma kista ×2 (`already-exists`), påhittat svar-id, en klasskamrats svar, kistnummer utanför 0–2, två kistor inom 1 s ("En kista i taget!"), återanvänt svar-id. Reglerna nekar att skriva eget/annans guld, `grEvents`, `grMeta`, ett eget "rätt svar" förbi servern, att ta bort `chest` för att öppna igen, `result`, Pluggmynt-kvitto, falskt namn vid anslutning, fel klass och att räkna upp `players.correct` |
| **20** Tiden ute | ✅ Efter 00:00 nekas svar, kistor (även på ett redan rätt svar) och stöld ("Tiden är ute! ⏰"). I webbläsaren avslutade projektorn själv, pallen visades med "Tillsammans samlade 4B + 5E 17 122 guld!" och `result` sparades med 28 kvitton för 28 elever. [p07](qa-guldrush-567/p07-pall-1920.jpeg) |
| **20b** Förstapris 300, 25 elever | ✅ 300, 255, 217, 184, 157 … 6 (plats 25), alla ≥ 1 |
| **20c/20d** Förstapris 100, delad 2:a | ✅ 100, 85, 85, 61, 52, 44 |
| **20e** Trappa 5/rätt, tak 300 | ✅ 15 → 75, 50 → 210, 100 → 300, 400 → 300 |
| **20f** Stöld rör aldrig pluggmynt | ✅ `studentData.coins` oförändrat för alla 28 elever under 640 + 499 + 224 kistor/stölder. Elevens sidomeny visar samma saldo under hela matchen |
| **20g** Exakt en gång | ✅ Två lärarprojektorer (elias + rasmus, appens egen kod) när två matcher slutade samtidigt, plus en tredje "omladdning". Varje elevs saldo ökade exakt en gång med rätt belopp, ett kvitto per elev (31). ⚠️ Se **F1** |
| **20h** Ansluten men aldrig svarat | ✅ Inget pris, inga mynt, inget kvitto |
| **20i** 2:a med 42 rätt | ✅ 255 + 186 = 441 i result. Slutskärmen visar "🥈 Du kom 2:a! · Placeringspris 255 · 42 rätt svar 186 · Totalt: 441 pluggmynt 🎉". Saldot ökade med 441 (+ eleven var också med i 100-matchen). [e11](qa-guldrush-567/e11-slutskarm-2a-chromebook.jpeg) |

### Elias elevregel (2026-10-10)

| Kontroll | Resultat |
| --- | --- |
| Under matchen | ✅ Topraden visar bara "X guld bakom <Namn>", "Du leder! 💰" eller "Lika med Siri – ni leder! 💰". Inget placeringsnummer, inget "ligger" (DOM-sökning) |
| Slutskärm topp 3 | ✅ "🥈 Du kom 2:a!" |
| Slutskärm plats 4 | ✅ "💰 Bra kämpat! · 10 guld bakom Nora", ingen siffra. [e12](qa-guldrush-567/e12-slutskarm-4a-chromebook.jpeg). ⚠️ Placeringspriset (184) avslöjar platsen indirekt, samma som Snilleblixtens F4 i #561. Det är Elias beslut |

### Trygghet (§6.5)

| Kontroll | Resultat |
| --- | --- |
| Inget nollställer | ✅ 200 000 slumpade effekter på guld > 0: ingen hamnar på 0. Stöld ≤ 15 %, hål i fickan ≤ 10 %. Stöld från elev med ≤ 6 guld nekas ("för lite guld"), byte kräver eget guld |
| Samma offer två gånger i rad | ✅ Servern nekar ("Du kan inte välja samma elev två gånger i rad"). UI visar "Nyss vald" gråad |
| Sköld | ✅ Stoppar stölden (0 guld flyttas) och förbrukas |
| Lekfulla texter | ✅ Inga hånfulla ord i kistkonfigens händelsetexter. Flödet: "🦝 Ali 4B knyckte 49 guld från Ebba 4B!", "🍃 Ella 4B hittade ett löv." |

### Prestanda (§7.5)

| Mätning | Resultat |
| --- | --- |
| 28 elever (4B + 8 i 5E), 150 s | ✅ 779 svar, 640 kistor = **9,1 kistor/elev/min**, 0 fel. Kistanrop p50 67 ms, p95 242 ms. Svarsanrop p50 47 ms, p95 233 ms (functions i sekventiellt läge = köade) |
| Projektorn hänger med | ✅ Statistikvyn (1920×1080) visade nytt guld **p50 32 ms, p95 246 ms** efter att serverns svar kom tillbaka, för 562/562 uppdateringar. Längsta bildrutegap 217 ms (5 gap > 100 ms på 120 s): UI:t fryser inte |
| Storm med Skattkammaren öppen | ✅ 28 elever × 8 kistor/min: högst 1 banderoll åt gången (~2,0 s var), högst 5 poster i flödet. Varje ledningsbyte visades exakt en gång (5/5). Kistanropen p95 1,4 s när webbläsaren + emulatorn delade CPU (sekventiell functions-emulator) |
| Facit | ✅ Eleven kan inte läsa `grPrivate`, publika frågor saknar rätt svar, servern väljer nästa quizfråga (att prova sig fram nekas), Skriv själv-svar på en Flerval-session nekas (3d). Eleven läser sitt eget svar (omladdning) men inte andras |
| Demoläget rör ingen data | ✅ Antal sessioner, underdokument och summan av alla pluggmynt i emulatorn är identiska före och efter en hel demo (ansluta, storm, ledningsbyte, oavgjort om 1:a, reducerad rörelse) |

## Design (designspec §14)

| Designtest | Resultat |
| --- | --- |
| **1** Kläder | ✅ Alla 28 avatarer har kläder i lobbyn, på pallen och i offerlistan. Ali (b02) bär trollkarlshatt + mantel. [p09](qa-guldrush-567/p09-pall-delad-2a-1920.jpeg) |
| **2** En läsning | ✅ Kall laddning av projektorn med 28 elever i två klasser: exakt 1 läsning av `classProjections/4b` och 1 av `5e`, 0 av `studentData`/`students` (räknat i webbläsarens nätverkskroppar) |
| **3** Huslås | ✅ Nora (b03, `husLast`) ritas ur projektionen precis som byn gör (samma kod som #561 verifierade). Inget låst innehåll finns i projektionen |
| **4** Trängsel 1280×720 | ✅ 28/28 avatarer syns, STARTA och rubriken syns. [p02](qa-guldrush-567/p02-lobby-1280.jpeg) |
| **5** Klättring + banderoll | ✅ Demo "⭐ Ledningsbyte": Liam går från 5:e till 👑, "Ny ledare: Liam!" visas en gång. Fullt synlig ligger banderollen under timern (y 204 mot timerns 203) och ovanför topp 10. ⚠️ Observation O1 |
| **6** Kistor | ✅ Alla 8 kisttyper utan offerval: 1,12–1,26 s från val till nästa fråga (150 ms simulerad server). I appen mot emulatorn tog det under 1 s. Eget utseende/ljud per typ finns i #564:s bilder |
| **7** Händelsestorm | ✅ Se prestanda: aldrig mer än 1 banderoll åt gången, flödet ≤ 5 poster |
| **8** Pallplats | ✅ Pallen = databasens topp 3 (Elias 5E 911, Leo 832, Siri 764) med kläder, pluggmyntpris och klassens totala guld, alla avatarer jublar |
| **9** Delad placering | ✅ Ali och Nora (400 var) på samma 2:a-steg, nästa (4:e) får ingen bronsplats. [p09](qa-guldrush-567/p09-pall-delad-2a-1920.jpeg) |
| **10** Omladdning | ✅ Mitt i matchen: 10 högar direkt, 0 gamla händelser i flödet trots hundratals i `grEvents`. Efter finalen: resultatet direkt (2 ms), finalen spelas inte om, inga nya utbetalningar. [p08](qa-guldrush-567/p08-pall-efter-omladdning-1280.jpeg) |
| **11** Ljud | ✅ Elevens ljudknapp är 🔇 som standard. Projektorns ljudkö är verifierad i #565 |
| **12** Reducerad rörelse | ✅ Demot: 61 → 14 pågående animationer, timer, högar, skyltar och "Tillsammans" syns. [d01](qa-guldrush-567/d01-demo-oavgjort-1a-reducerad-1920.jpeg) |
| **13** Klassmatchen oförändrad | ✅ Se regression |
| Designen ändrar aldrig spelet | ✅ Projektorns guld/ställning = databasen (latensmätningen jämför exakta värden), pallen = `result`, kistorna avgörs av servern |

## Regression

| Test | Resultat |
| --- | --- |
| **Test 2 – Klassmatchen** | ✅ Skapad i formuläret (4B mot 5E, nämnare 20/22, mynt-pris 100), 33 elever via klientsimulatorn, STARTA, Raketrace/Statistik/Dragkamp/Trollkarlsduellen. 120/20 = 6,0 mot 90/22 = 4,1 p/elev. Vid 00:00 visades "VINNARE – 4B! 🪙 4B får 100 mynt till klasskassan!" och matchens stjärnor. Klasskassan 0 → 100, pokalen `live-vinst-<sid>` skapades, `format: klassmatch`. [r03](qa-guldrush-567/r03-klassmatchen-vinnare-1920.jpeg). Delade filer sedan epic 3/4: `createSound` har nya valfria parametrar med samma standardvärden, `projector.js` har `ownTimer` för Guldrushen |
| **Snilleblixten** | ✅ Skapad i formuläret (4B, Flerval, 5 frågor, 20 s, förstapris 300). 18 elever via #561:s rigg, lärarautomatik via appens `sb-koppling`. Hela flödet till pallen gick igenom: 17/17 kvitton, kvitto = `result.rewards`, saldo exakt en gång för alla 20, 20h, dubbelsvar (ett dokument), spionförsök nekade (3d), svar efter stängning och sen anslutning nekade. Två ✗ i #561:s verifierare kommer från scenario A:s plan för 10+ frågor (V svarar på fråga 5, delningen hamnar på 3:e i stället för 2:a). Snilleblixtens kod är oförändrad sedan epic 3/4 |

## Fynd

| # | Allvar | Fynd | Förslag |
| --- | --- | --- | --- |
| **F1** | Medel | `payLiveRewards` (`src/live/live-rewards-pay.js`) gör inget omförsök när en transaktion nekas. När två matcher med samma elever slutade samtidigt nekades 5 av 31 utbetalningar (`permission-denied`, krock på samma `studentData` i emulatorn). De betalades först när en lärare öppnade matchen i historiken (`teacher-live-history.js:107`). Tills dess visar slutskärmen beloppet utan att saldot ökat. Gäller även Snilleblixten. Med en match åt gången nekades inget (28/28) | Omförsök "nekad" 2–3 gånger med paus, som `kc-omforsok.js` (#493). Kvittot gör det redan säkert att försöka igen |
| **F2** | Låg | Chromebook (1366×768): kista 1 och 3 klipps av panelkanten, och siffran på kista 3 syns inte. Kistbredden är i `vw` (`guldrush-kistor.css:27`, gap `4.5vw`), men panelen är smalare än viewporten (sidomenyn). Syns redan i #564:s emu-02. Surfplattan är OK. [e02](qa-guldrush-567/e02-kistor-chromebook.jpeg) | Bredd efter behållaren (container query `cqi` eller `min(…, 30%)`) |
| **F3** | Låg | När flödets poster tonat ut (14 s utan händelser) står "Grottan väntar på första kistan …" mitt i en match med tusentals kistor. [p04](qa-guldrush-567/p04-skattkammaren-1280.jpeg) | Annan text efter första händelsen, t.ex. "Lugnt i grottan just nu …" |

## Observationer (inget fel)

- **O1** Banderollkön slår ihop ledningsbyten på den äldre väntande platsen. Därför kan "Ny ledare: Liam!" visas före "SKATTKAMMARE! Liam hittade 100 guld" som gav ledningen (sett i demot). Flödet har rätt ordning.
- **O2** I matcher med två klasser visar offerlistan och topraden bara förnamnet ("Siri", "Siri"). Avatarerna skiljer dem åt, men "X guld bakom Elias" kan vara tvetydigt.
- **O3** Skattkammaren i 1280×720: namnen i bakre raden kortas ("Agn…", "Ebb…") när klassuffixet finns med. Statistiken har 23 px text med 28 elever i 1280×720 (känt avsteg från ~28 px, #578).
- **O4** Notisen "knyckte … från dig" täcker topradens text under ~2 s på surfplattan. [e10](qa-guldrush-567/e10-notis-surfplatta.jpeg)
- **O5** Multiplikation: klienten väljer själv faktorerna. Ett skript kan alltså svara 0 × 0 = 0 och få en kista per sekund (skriptspärren). Varje kista kräver ändå ett verifierat rätt svar, och Klassmatchen fungerar likadant. Quiz är skyddat (servern väljer frågan).
- **O6** Demosidan visar "Firebase-anrop: 1 BLOCKERADE" om man är inloggad i appen i samma webbläsare (`accounts:lookup`). Ingen data läses eller skrivs. Samma som #561 O1.
- **O7** Statistikens "Svarsfrekvens" visar "– mäts …" en stund efter vybyte.

## Skärmdumpar (25–30 avatarer med kläder)

Projektor: [p01 lobby 1920](qa-guldrush-567/p01-lobby-1920.jpeg) ·
[p02 lobby 1280](qa-guldrush-567/p02-lobby-1280.jpeg) ·
[p03 Skattkammaren 1920](qa-guldrush-567/p03-skattkammaren-1920.jpeg) ·
[p04 Skattkammaren 1280](qa-guldrush-567/p04-skattkammaren-1280.jpeg) ·
[p05 statistik 1280](qa-guldrush-567/p05-statistik-1280.jpeg) ·
[p06 statistik 1920](qa-guldrush-567/p06-statistik-1920.jpeg) ·
[p07 pall 1920](qa-guldrush-567/p07-pall-1920.jpeg) ·
[p08 pall 1280 efter omladdning](qa-guldrush-567/p08-pall-efter-omladdning-1280.jpeg) ·
[p09 delad 2:a 1920](qa-guldrush-567/p09-pall-delad-2a-1920.jpeg) ·
[d01 demo oavgjort om 1:a, reducerad rörelse](qa-guldrush-567/d01-demo-oavgjort-1a-reducerad-1920.jpeg)

Elev, Chromebook 1366×768: [e01 fråga](qa-guldrush-567/e01-fraga-chromebook.jpeg) ·
[e02 kistor](qa-guldrush-567/e02-kistor-chromebook.jpeg) ·
[e03 efter kistan](qa-guldrush-567/e03-kista-oppnad-chromebook.jpeg) ·
[e04 offer stöld](qa-guldrush-567/e04-offer-stold-chromebook.jpeg) ·
[e05 efter stölden](qa-guldrush-567/e05-stold-tvattbjorn-chromebook.jpeg) ·
[e06 notis](qa-guldrush-567/e06-notis-bestulen-chromebook.jpeg) ·
[e11 slutskärm 2:a](qa-guldrush-567/e11-slutskarm-2a-chromebook.jpeg) ·
[e12 slutskärm 4:a](qa-guldrush-567/e12-slutskarm-4a-chromebook.jpeg)

Elev, surfplatta 768×1024: [e07 fråga](qa-guldrush-567/e07-fraga-surfplatta.jpeg) ·
[e08 kistor](qa-guldrush-567/e08-kistor-surfplatta.jpeg) ·
[e09 offer byte](qa-guldrush-567/e09-offer-byte-surfplatta.jpeg) ·
[e10 notis](qa-guldrush-567/e10-notis-surfplatta.jpeg) ·
[e13 slutskärm 4:a](qa-guldrush-567/e13-slutskarm-4a-surfplatta.jpeg)

Klassmatchen: [r01 Trollkarlsduellen](qa-guldrush-567/r01-klassmatchen-trollkarl-1920.jpeg) ·
[r02 Raketrace](qa-guldrush-567/r02-klassmatchen-raketrace-1920.jpeg) ·
[r03 vinnare](qa-guldrush-567/r03-klassmatchen-vinnare-1920.jpeg)

## Klickguide: demoläget (ingen inloggning, ingen data)

Öppna `preview/preview-guldrush-demo.html` i sajtens rot. Panelen nere till vänster:

1. **Tom lobby** → **+30 elever ansluter**: avatarerna studsar in vid grottans ingång. Tryck **⛏️ STARTA** i projektorn (3-2-1).
2. **Svar strömmar in**: högarna växer, flödet "I grottan" fylls.
3. **Kistor (en i taget)**: varje kisttyp ger sin egen händelse. 👑 och 🔄 ger banderoll.
4. **Händelser**: **🦝 Stöld**, **🔄 Byte**, **🛡️ Sköld stoppar stöld**, **⭐ Ledningsbyte** (5:e plats tar ledningen, "Ny ledare" visas en gång).
5. **⚡ Händelsestorm**: 30 kistor samtidigt, högst en banderoll åt gången.
6. **⏰ Tid snart slut** → pallen spelas av sig själv vid 00:00. Eller **Hoppa till pallplats** / **Delad 2:a** / **Oavgjort om 1:a**.
7. **Visning**: **Reducerad rörelse**, **Frys tiden** (skärmdumpar), **Omladdning** (finalen spelas inte om), **📊 Statistik**, **Två klasser**, **Visa namn av**, **Stöld/byte av**.
8. Elevens kistor: länken **Elevens kistor ↗** (`preview/preview-guldrush-kistor.html`) → **▶ Alla tio i följd** visar alla kisttyper och mäter tiden.

## Vad Elias måste deploya

Inget av detta är gjort. Guldrushen fungerar inte i produktionen förrän
**functions + rules** är ute. Deploya i samma veva som epicstacken
(1/4–4/4) landar på main.

```bash
# 1. Cloud Functions (predeploy kör sync:guldrush själv). Projektet måste ha Blaze.
firebase deploy --only functions:guldrushAnswer,functions:guldrushOpenChest,functions:guldrushChooseVictim --project pluggportalen-so-2026

# 2. Firestore-reglerna (hela epicstackens regler: formatregistret, svarssätt,
#    Snilleblixten, Pluggmynt-kvitton, Guldrushen)
firebase deploy --only firestore:rules --project pluggportalen-so-2026
```

- Inga nya index (`firestore.indexes.json` är oförändrad mot main).
- `updateStudentLogin` finns redan på main och behöver inte deployas om.
- Funktionerna: `europe-west1`, 512 MiB, `concurrency: 40`, `maxInstances: 4` (`functions/index.js`). Det räcker gott för 30 elever × ~9 kistor/min (~5 anrop/s).
- Ordning: deploya funktionerna och reglerna **före** eller samtidigt som Pages. Gamla klienter påverkas inte (Guldrushen syns bara i den nya appen).
