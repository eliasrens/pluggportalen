# Guldrushen · Skattkammaren (#565) – projektorvyer, verifiering

Skärmdumpar: [`qa-guldrush-565/`](qa-guldrush-565/). `p*` = förhandsvisningen
(`preview-guldrush-skattkammare.html`, 30 påhittade elever med kläder, kistorna
slumpas med formatets riktiga regler). `e*` = riktiga appen mot emulatorerna
(`admin/qa-guldrush-preview.sh` + `qa-snilleblixt-slut-seed.mjs` för kläder),
matchen spelad genom serverkärnan (`admin/qa-guldrush-projektor-emu.mjs`).
Bilderna togs med `admin/qa-guldrush-projektor.mjs` (Chromium via DevTools,
realtid).

## Avsteg från specen (Elias 2026-10-10 + leaden #562: ingen uthängning)

| Specen säger | Byggt i stället | Varför |
| --- | --- | --- |
| Topp 10 som avatarer vid egna guldhögar | Klassens **guldberg** (ett per klass) som växer med guldet + "Nästa skatt: 3 000 guld" (gemensamma delmål med banderoll "🎉 Tillsammans 1 000 guld!") | Avatarer i rangordning = topplista ändå |
| Banderoll vid ledningsbyte | Ingen ledarbanderoll, ingen "tog ledningen" i flödet | Det är en rangordning |
| Statistik: exakt ställning för alla elever | Anonym: tillsammans-guld, rätt svar, andel rätt, svarsfrekvens, kistor, antal skattjägare, guldets fördelning (antal elever per guldintervall), per klass | Hela listan finns i lärarens historik |
| "🦝 Alma knyckte 30 guld från Omar!" | "🦝 Alma knyckte 30 guld från en klasskamrat!" – offret, den som tappar guld och den som hittar ett löv namnges aldrig; sköld lyfter den skyddade ("Toves sköld stoppade en tjuv!") | Bara den som haft tur namnges |
| Namn av → avatarer utan namn | Namn av → inga avatarer heller | Avatarerna känns igen |

Namn och avatarer syns i lobbyn, i flödet (om läraren valt "Visa namn") och på pallen (topp 3).

## Tester

| Test | Resultat |
| --- | --- |
| 15 Stöld | ✅ Emulator: Ali 100 → 85, Nora +15 i samma transaktion, händelsen `steal 15` i grEvents och i projektorns flöde ("Nora knyckte 15 guld från en klasskamrat!"). [e02](qa-guldrush-565/e02-emulator-test15-stold-1920.jpg) |
| 20 Tiden ute | ✅ Svar efter 00:00 nekas ("Tiden är ute! ⏰"), projektorn avslutar, result sparas (totalGold, classGold, topp 3 = pallen). [e04](qa-guldrush-565/e04-emulator-pall-1920.jpg) |
| D4 Trängsel | ✅ 30 avatarer i lobbyn i 1280×720, rubrik + STARTA syns. [p01](qa-guldrush-565/p01-lobby-1280.jpg) |
| D5 Klättring | ➖ Medvetet borttaget (ingen rangordning). Guldberget växer/krymper bara med guldet |
| D7 Händelsestorm | ✅ 42 elever öppnar kistor samtidigt (2 omgångar): högst 1 banderoll åt gången, högst 5 poster i flödet, tempo 1 post/0,65 s, kön gallras (småguld först) – ligger aldrig efter |
| D8 Pallplats | ✅ 3:an → 2:an → 1:an med kläder, vinnaren jublar, guldregn + konfetti, "Tillsammans samlade 4B … guld!" med alla avatarer. [p05](qa-guldrush-565/p05-pall-1920.jpg) |
| D9 Delad placering | ✅ Två på 2:a = samma pallsteg (preview och emulator). [p06](qa-guldrush-565/p06-pall-delad-2a-1920.jpg) |
| D10 Omladdning | ✅ Mitt i matchen: 0 gamla händelser på 9 s, rätt guld direkt. Efter finalen: resultatet direkt, 0 pallanimationer. [e05](qa-guldrush-565/e05-emulator-pall-efter-omladdning-1280.jpg) |
| D11 Ljud | ✅ Bara projektorn (ljudkön): 30 stölder på 0,6 s → högst 2 ljud; grottljudet stoppar inte trumvirveln (enhetstest) |
| D12 Reducerad rörelse | ✅ Spindel/fladdermus/dropp borta, stilla facklor, inga fallande mynt, toningar. [p08](qa-guldrush-565/p08-reducerad-rorelse-1920.jpg) |
| D13 Regressioner | ✅ Klassmatchen (Raketrace m.fl.), Snilleblixten och Trollkarlsduellen laddar som förut; skalets ändring är bara `ownTimer` (göms för Guldrushen) |
| Enhetstester | ✅ 1527/1527 (`test/live-guldrush-projektor.test.js` 13 st nya) |

## Fynd under QA (åtgärdade)

- **Gamla händelser spelades upp när projektorn öppnades** mot riktig Firestore: första ögonblicksbilden kom ur cachen. Baslinjen väntar nu på serverns ögonblicksbild (`fromCache`, `gr-koppling.js`).
- "Hoppsan! Någon tappade 0 guld." / "dubblade (+0)" visas inte längre.
