# QA-rapport – Hitta rätt! 1/2 slut-QA (#611, epic #603)

Slutverifiering av epicgrenen `0e970b8` (#604 arkitektur, #605 modul, #606 kartmotor, #607 12 pack,
#608 spelflöden, #609 topplistor, #610 pokaler) mot spec §35, test 1–7 och 9–12. Test 8 (egna
områden) hör till epic 2/2.

**Resultat: alla acceptanstest är gröna efter en rättning.** Ett fynd (F1, lämna-vakten vid
utloggning) är rättat på grenen och verifierat i webbläsaren. Övriga iakttagelser (O1–O5) blockerar
inte landningen.

## Deploy före live (i den här ordningen)

1. `firebase deploy --only firestore:rules`. **Reglerna är ändrade** (#605/#609/#610):
   `validEnabledModules` på `classes` (läraren slår på Hitta rätt!), `hittaRattAttempts` (eleven skapar
   sitt försök = serverns starttid, ändras aldrig av klienten) samt läsregler för `hittaRattBest`,
   `hittaRattBoards` och `hittaRattMeta` (`write: if false` – bara functionen skriver). Utan
   deployen nekas lärarens "Spara moduler" när Hitta rätt! är ikryssat, ingen omgång kan startas,
   och eleven ser varken personbästa eller topplistor.
2. `firebase deploy --only functions`. **Ny callable `hittaRattSubmit`** (`functions/index.js` +
   `functions/hitta-ratt-core.js` + genererade `functions/hitta-ratt/`). Predeploy-kroken kör nu
   även `sync-hitta-ratt-functions.mjs` (packfacit + delad poäng/rank). Utan deployen sparas inget
   resultat ("Resultatet kunde inte sparas") och inga coins delas ut.
3. Därefter merge till main (Pages). **Index är oförändrade.**

Modulen är **av som standard** (opt-in per klass), så en Pages-utrullning före 1–2 syns inte för
elever förrän en lärare aktiverar den. Epic #595 (Tidsjakten), som den här grenen står på, har egna
deploysteg (rules + functions) – se `docs/QA-RAPPORT-tidsjakten.md`. En rules- och en
functions-deploy av den här grenen täcker båda.

## Sviter och bootgraf

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test`, 141 filer utom regler/functions/e2e) | ✅ 1812/1812 (1811 + nytt regressionstest för F1) |
| `test:rules` (35 filer, bl.a. `hitta-ratt`, `hitta-ratt-pokal`, `class-enabled-modules`) | ✅ 440/440 |
| `test:functions` (inkl. `functions-hitta-ratt-core`, `-hitta-ratt`, `-hitta-ratt-pokal`) | ✅ 73/73 |
| `test:e2e` | ✅ 5/5 |
| `sync:hitta-ratt` + `sync:guldrush` | ✅ kopiorna identiska (git diff tom) |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | ✅ **107** filer, identisk lista med `origin/main`, även efter F1-rättningen. Ingen `hitta-ratt/`-fil i den statiska grafen |

Recept: sviterna kördes en i taget i färska `emulators:exec` med egen config
(`/tmp/hr611-suite/firebase.json`, portar 8631/9631/5631). `test:functions` kräver
`FUNCTIONS_EMULATOR_HOST` i kommandot.

## Miljö och metod

- Emulatorer (functions + auth + firestore) via `admin/qa-hitta-ratt-preview.sh`
  (FS 8641, Auth 9641, FN 5641, proxy 8642). Seed: `qa-lasresan-seed`,
  `qa-hitta-ratt-topplista-seed` (40 elever i 5A/5E/6B som spelat via serverkärnan) och
  `qa-hitta-ratt-pokal-seed`.
- **EN** headless Chrome-flik som växlades mellan elev1 (Astrid, QA-klass 4A), hr-elev39 (Ines,
  5A) och läraren `qalarare`.
- Riktig inmatning: NYA `admin/qa-hitta-ratt-input.mjs` skickar CDP `Input.dispatchMouseEvent`,
  `mouseWheel` och `dispatchTouchEvent` till samma flik (klick, hjul, drag, nyp, tryck). Facit läses
  ur packfilen på disk, aldrig ur sidan. Skärmpunkten räknas ur kartans egen kamera
  (`g.hr-kamera` `getScreenCTM`) och projektionen i geo-filen. Kommandona `kontroll` och `spela`
  kör packkontrollen och hela omgångar.
- Mitt i QA:n dog sessionen (minnet tog slut i WSL, 8 GB). Emulatorn startades om med ny seed.
  Test 1–6 och 11 kördes före omstarten, resten efter.

## Acceptanstest (spec §35)

### Test 1 – punktkarta (Sveriges städer)

| Kontroll | Resultat |
| --- | --- |
| Första frågan visas, ingen nål | ✅ "Var ligger Linköping?", inga synliga `.hr-nal`, "Lås svar" avstängd ([01](qa-hitta-ratt-611/hr611-01-startsida.png), [02](qa-hitta-ratt-611/hr611-02-punkt-zoom-ingen-nal.png)) |
| Scroll-zoom och drag före gissning | ✅ 4 hjulsteg: skala 0,040 → 0,087. Drag 150,60 px flyttade kameran exakt 150,60. Fortfarande ingen nål |
| Klick → nål, flytta gissningen | ✅ Klick satte nålen och aktiverade "Lås svar". Nytt klick flyttade den, och ett musdrag på själva nålen flyttade nålen men inte kartan |
| Lås → rätt plats, min plats, linje, km, 0–100 p | ✅ "Bra försök! Du var 96 km från rätt plats – Linköping. 46 / 100 p", två nålar och en streckad linje med "96 km" ([03](qa-hitta-ratt-611/hr611-03-punkt-feedback.png)) |
| Studera svaret, själv trycka Nästa | ✅ Efter 7 s stod den kvar på fråga 1 med "Nästa →". Ingen automatisk vidaregång |

### Test 2 – inga kartledtrådar

✅ Maxzoom (10× helvy, både över Bottenviken och över Vänern/Vättern): de enda textnoderna i kartan
är `+`, `−`, `⤢` och attributionen. Det finns 0 `<title>`, och områdena har ogenomskinliga id (`o1`…).
Sjöar, vattendrag, kust, öar och gränser syns ([04](qa-hitta-ratt-611/hr611-04-maxzoom-inga-etiketter.png)).
Samma resultat i alla 12 pack (se nedan).

### Test 3 – punkt-topplista

✅ Clara (5A) och Omar (5E) har båda 1966 p och står som **1.** respektive **1.**, och nästa elev
står som 2. (tät placering, se O1). Det finns ingen tid i listan, bara "Högst poäng vinner. Lika
poäng = delad plats.". Namn och klass visas ([10](qa-hitta-ratt-611/hr611-10-topplista-punkt-delad.png)).

### Test 4 – områdeskarta (Europas länder – 20)

| Kontroll | Resultat |
| --- | --- |
| Klicka ett land → markeras | ✅ Frankrike valt, konturen ritas ([07](qa-hitta-ratt-611/hr611-07-omrade-valt.png)) |
| Byt val | ✅ Irland valt i stället |
| Lås → rätt/fel + rätt land | ✅ "❌ Inte riktigt. Du valde Irland. Storbritannien är markerat i grönt." Fel land med randigt mönster, rätt land grönt med namn ([08](qa-hitta-ratt-611/hr611-08-omrade-fel-pausad.png)) |
| Tiden pausad under feedback | ✅ "⏱️ 0:12 · pausad" även 4 s senare |
| Nästa startar nästa aktiva svarstid | ✅ Fråga 2: 0:12 → 0:16 efter 3 s |
| Hela omgången | ✅ 16/20 (3 avsiktliga fel + fråga 1), aktiv tid 0:58 ([09](qa-hitta-ratt-611/hr611-09-omrade-resultat.png)) |

### Test 5 – områdes-topplista

✅ Sveriges landskap (25 frågor, seedat genom serverkärnan): **1. Deniz 25/25 1:39**, **2. Alma
25/25 1:45**, **3. Hugo 24/25 1:00**. Flest rätt går före tid, och tid används bara vid lika antal
rätt ([11](qa-hitta-ratt-611/hr611-11-topplista-omrade.png)). Specens exempel med 44/44 är samma regel
(`rank.js`, täckt i `hitta-ratt-delat.test.js`).

### Test 6 – personbästa

✅ Sveriges städer gav först 1946 p (nytt personbästa) och sedan 420 p. Resultatskärmen visar
"Ditt personbästa: 1946 p", och `hittaRattBest/elev1.packs.sverige-stader.s` är fortfarande 1946
([06](qa-hitta-ratt-611/hr611-06-personbasta-kvar.png)). Områdespacket gick också att kontrollera:
16/20 på 0:58 slog **inte** 18/20 på 1:20 (antal rätt först).

### Test 7 – klassaktivering

✅ Läraren gick till Synlighet, bockade ur "Hitta rätt! (av som standard)" och tryckte "Spara
moduler". `classes/qa-klass.enabledModules` blev `[]` ([18](qa-hitta-ratt-611/hr611-18-larare-synlighet-av.png)).
För elev1 försvann "Hitta rätt!" ur menyn, och direktlänken `#/elev/hitta-ratt?pack=…` ledde till
huset ([19](qa-hitta-ratt-611/hr611-19-elev-modul-dold.png)). När modulen aktiverades igen blev
värdet `["hittaratt"]`, och den syntes i menyn och startsidan.

### Test 9 – responsivitet

| Enhet | Resultat |
| --- | --- |
| Dator 1920×1080, mus | ✅ hjul, drag, klick på Kina → "Rätt!" ([16](qa-hitta-ratt-611/hr611-16-dator-1920-varlden.png)) |
| Chromebook 1366×768, mus | ✅ test 1–6, 11 och 12 kördes här |
| Surfplatta 820×1180, touch | ✅ Nypet zoomade **kartan** (`visualViewport.scale` = 1), enfingersdrag panorerade, tryck satte nålen. Hela omgången spelades med touch, 2000 p ([14](qa-hitta-ratt-611/hr611-14-surfplatta-touch-nal.png)) |
| Mobil 390×844, touch | ✅ Sveriges landskap: nyp och tryck på Västerbotten → "Rätt!" ([17](qa-hitta-ratt-611/hr611-17-mobil-landskap.png)) |
| Dubbelklicksfälla | ✅ "Nästa" ignorerar klick de första 450 ms (syns som grå knapp i 17) |

### Test 10 – topplisteåtkomst

✅ Startsidan har bara knappen 🏆 Topplistor och inga listor ([01](qa-hitta-ratt-611/hr611-01-startsida.png)).
Knappen öppnar en separat vy med alla 12 officiella områden.
- Ines (plats 39) ser Top 15 = 15 rader (ranker 1–14 eftersom ettan är delad). Under dem står "⋯"
  och sedan "39. Ines, 5A du", plus "Ditt rekord: 956 p · Plats 39 av 41"
  ([13](qa-hitta-ratt-611/hr611-13-surfplatta-topplista-egen-rad.png)).
- Astrid på plats 4 visas en gång, inne i listan med "du" och utan extra rad.

### Test 11 – coins

| Omgång | Godkända | Coins (Firestore `studentData.coins`) |
| --- | --- | --- |
| Sveriges städer 1946 p | 20 av 20 | 419 → 439 ✅ "Du fick 20 coins!" ([05](qa-hitta-ratt-611/hr611-05-punkt-resultat-coins.png)) |
| Sveriges städer 420 p (sämre) | 20 av 20 (alla > 0 p) | 439 → 459 ✅ |
| Europas länder – 20, 16/20 | 16 | 459 → 475 ✅ "16 av 20 godkända svar" |

Räknaren i spelet (+1 per godkänt svar) stämde med summeringen och med sidomenyn.

### Test 12 – huspokal

| Kontroll | Resultat |
| --- | --- |
| Elev går upp i ledning | ✅ Astrid spelade Kända platser i Europa (1980 p) och blev ensam etta. Pokalen kom i Möbler-lådan med titeln "Kartmästare – Skolrekord Kända platser i Europa" |
| Placera och flytta som möbel | ✅ Klick i lådan ställde den på golvet. Ett musdrag flyttade den till 53,5 % / 72,3 %, och det sparades i `room.placements["hrpokal-europa-kanda-platser"]` |
| Hover visar rätt titel | ✅ Skylten "🏆 Kartmästare – Skolrekord Kända platser i Europa" ([12](qa-hitta-ratt-611/hr611-12-pokal-placerad-hover.png)) |
| Ny ledare tar över | ✅ Ines (touch) tog 2000 p och fick pokalen. När Astrid öppnade sitt rum var hennes **utställda** pokal borta och placeringen städad ur Firestore. `hittaRattMeta/ledare` = `[hr-elev39]` |
| Delad etta på punktkarta | ✅ Astrid tog också 2000 p → `uids: [elev1, hr-elev39]` och pokalen tillbaka i hennes låda. Kompisvyn visar Sagas pokal för den seedade delade ettan i Europas huvudstäder – 20 ([15](qa-hitta-ratt-611/hr611-15-kompis-delad-pokal.png)) |

## Alla 12 officiella pack

Kontrollen startade varje pack via `?pack=` i 1366×768 och körde därefter `kontroll` och ett riktigt
svar. Kontrollen ser efter tre saker: att kartan saknar etiketter, att varje fråga ligger inom
startvyn (punkt) och att varje fråga har ett klickbart område som `elementFromPoint` träffar rätt
(område).

| Pack | Typ / geo | Frågor | Etiketter | Startvy / träffytor | Riktigt svar |
| --- | --- | --- | --- | --- | --- |
| Sveriges städer | punkt / sverige-landskap | 20 | 0 | alla 20 inom vyn | Stockholm 100 p |
| Sveriges landskap | område / sverige-landskap | 25 | 0 | 25/25 träffar rätt | Öland rätt |
| Sveriges län | område / sverige-lan | 21 | 0 | 21/21 | Norrbotten rätt |
| Sveriges geografi | punkt / sverige-landskap | 20 | 0 | alla inom vyn | Mälaren 100 p |
| Europas länder – 20 | område / europa | 20 | 0 | 20/20 | ✅ |
| Europas länder – alla | område / europa | 46 | 0 | 46/46 (mikrostater via ringar) | Danmark rätt |
| Europas huvudstäder – 20 | punkt / europa | 20 | 0 | alla inom vyn | Rom 100 p |
| Europas huvudstäder – alla | punkt / europa | 46 | 0 | alla inom vyn | Sofia 100 p |
| Världens länder – 30 | område / varlden | 30 | 0 | 29/30 i grovsök, Frankrike träffas vid finare rutnät (50 träffar) | Australien rätt |
| Världens huvudstäder – 30 | punkt / varlden | 30 | 0 | alla inom vyn | Mexico City 100 p |
| Kända platser i Europa | punkt + bild / europa | 20 | 0 | alla inom vyn | Big Ben 100 p |
| Kända platser i världen | punkt + bild / varlden | 20 | 0 | alla inom vyn | Frihetsgudinnan 100 p |

Skärmdumpar: `qa-hitta-ratt-611/pack-<id>.png`. Bilder (namn + Commons-licens + fotograf) visas
bara i sevärdhetspacken. Stad- och landpack har ingen bild.

## Prestanda

✅ En svensk fråga laddar inte världen. Resursloggen efter start av Sveriges städer:
`packs/index.json`, `packs/sverige-stader.json`, `geo/sverige-landskap.json` – inget mer. När
spelaren sedan bytte till Europas länder tillkom bara `packs/europa-lander-20.json` och
`geo/europa.json`. Geofilernas storlek (rå / gzip): Sverige-landskap 176/70 kB, Sverige-län
167/67 kB, Europa 166/68 kB, Världen 133/50 kB – inom budgeten ≤ 90 kB gzip.

## Regression

| Del | Resultat |
| --- | --- |
| Plugga | ✅ renderar ("Välj ett arbetsområde …") |
| Läsresan | ✅ kartan Skogen/Öknen, steg 1 öppnar texten "Ekorrens gömmor" |
| Mattematchen (elev) | ✅ utan aktiv period → till huset (oförändrat beteende); lärarfliken renderar |
| Live | ✅ elev: "Ingen Live-match just nu"; lärare: "Skapa Live-match" med formaten |
| Shoppen, Hus, Innehållsstudion | ✅ renderar |
| Konsolen | ✅ inga fel (`error`/`unhandledrejection`) under elev- och lärarrundorna |
| Kod | Epiken ändrar utanför `hitta-ratt/` bara routerkroken i `app.js` (körs bara när vakten är armerad), nav-raden och `getHiddenModules` i `ui.js`, opt-in i `gamemode-visibility.js`, lärarens modulsektion, `pages-klasskamrat.js` och `varld-rum.js` (pokaler) |

## Fynd

### F1 – "Logga ut" mitt i en omgång loggade ut även när eleven svarade Avbryt (RÄTTAD)

`ui.js` körde `data.logout()` före `go("#/")`, och lämna-vakten frågade först vid hash-bytet. Om
eleven svarade "Avbryt" blev hen kvar i omgången men var redan utloggad. När omgången var klar
visades "Resultatet kunde inte sparas – Logga in först." och omgången var förlorad
([20](qa-hitta-ratt-611/hr611-20-F1-utloggad-mitt-i-omgang.png)). Nu frågar knappen
`window.__ppLamnaVakt` **före** utloggningen.
- Verifierat i webbläsaren: "Avbryt" → eleven är kvar i omgången och inloggad. "OK" → en enda fråga,
  sedan utloggad.
- Utan omgång är vakten inte armerad, och utloggningen fungerar som förut.
- Regressionstest finns i `test/hitta-ratt-start.test.js`. Bootgrafen är oförändrad (107).

## Iakttagelser (inga blockerare)

- **O1** – Delad plats ger tät placering 1, 1, 2 (inte 1, 1, 3). Det följer specens exempel och
  arkitekturbeslutet, men står kvar som fråga 1 till Elias i arkitekturdokumentet §10.
- **O2** – Tiderna i områdestopplistan visar tiondelar bara när det behövs för att skilja två
  elever åt ("2:30,0" och "2:30,7"). Det ser avsiktligt ut men kan se ojämnt ut bredvid "1:39".
- **O3** – På mobil (390 px) radbryts spelets toppfält till tre rader (tid, rätt, coins och
  Avsluta). Kartan får ändå ~414 px höjd och allt fungerar.
- **O4** – När ett fönster är mycket lågt (≈ 440 px) hamnar södra Sverige under sidans kant och
  måste scrollas fram. Det gäller inte de testade enhetsstorlekarna.
- **O5** – Efter inloggning landar elev1 i den här seeden på `#/elev/avatar`. Det har inget med
  Hitta rätt! att göra (seedens elevdata).

## Klickbar preview

```
JAVA_BIN=/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin FIREBASE_BIN=~/.npm/_npx/ba4f1959e38407b5/node_modules/.bin \
FS=8641 AUTH=9641 FN=5641 PROXY=8642 bash admin/qa-hitta-ratt-preview.sh
```
Elev `elev1` eller `hr-elev39`, lärare `qalarare` (lösen `lilla123`, bara emulatorn). Med
`node admin/qa-hitta-ratt-input.mjs --url 127.0.0.1:8642 [--touch] oppna|kontroll|spela …` kan
samma rundor köras om i den öppna fliken.
