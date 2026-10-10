# Guldrushen · Skattkammaren (#565, #578) – projektorvyer, verifiering

Skärmdumpar: [`qa-guldrush-565/`](qa-guldrush-565/). `p*` = förhandsvisningen
(`preview-guldrush-skattkammare.html`, 30 påhittade elever med kläder, kistorna
slumpas med formatets riktiga regler). `e*` = riktiga appen mot emulatorerna
(`admin/qa-guldrush-preview.sh` + `qa-snilleblixt-slut-seed.mjs` för kläder),
matchen spelad genom serverkärnan (`admin/qa-guldrush-projektor-emu.mjs`).
Bilderna togs med `admin/qa-guldrush-projektor.mjs` (Chromium via DevTools,
realtid).

## #578: Skattkammaren enligt specen (Elias 2026-10-10)

#565 byggdes först utan rangordning (guldberg per klass, anonym statistik,
ingen ledarbanderoll). Elias beslutade 2026-10-10 att Guldrushen körs **enligt
specen** – Snilleblixtens "ingen uthängning" gäller inte här. #578 tog bort
de avstegen:

| Specen | Nu |
| --- | --- |
| Topp 10 som avatarer vid egna guldhögar som växer/krymper | ✅ `gr-hogar.js`: två rader (1–5 fram, 6–10 bak), rikast i mitten. Skylt under varje hög: placering (👑 för ensam ledare), namn, guld, 🛡️ vid sköld/stöldskydd (§6.5). Högen växer/krymper med elevens guld; ordningen glider vid stöld/byte. [p02](qa-guldrush-578/p02-skattkammaren-1920.jpeg) |
| Stor timer + klassens totala guld överst | ✅ oförändrat + "Nästa skatt: 2 000" (klassens delmål) i samma ruta. Guldberget togs bort – topp 10-högarna fyller golvet |
| Händelseflöde med namn och små avatarer | ✅ kistkonfigens mallar: "🦝 Alma knyckte 30 guld från Omar!", "🔄 Hussein och Ines bytte guld!" – avatar för den som gjorde det och (stöld/byte/sköld) klasskamraten |
| "Namn i händelseflödet" av | ✅ "Någon …"/"en klasskamrat", inga avatarer i flödet. [p06](qa-guldrush-578/p06-namn-av-1280.jpeg) |
| Banderoll vid Skattkammare, Byte och **ledningsbyte** ≤ ~2 s | ✅ serverns `lead`-händelse → "⭐ Ny ledare: Juni!" + swoosh + jubel på ledarens avatar, via banderollkön (bara den senaste ledaren om flera väntar). [p03](qa-guldrush-578/p03-ny-ledare-1920.jpeg) |
| Final: pall 3 → 2 → 1, sedan klassens totala guld | ✅ oförändrat från #565 (D8) |
| Statistik: exakt ställning för alla elever | ✅ alla elever: placering, namn (🛡️), guld, antal rätt, andel rätt – 1–3 kolumner, textstorlek efter rutans höjd. Ovanför: tillsammans-guld, rätt svar, andel rätt, svarsfrekvens, skattjägare (+ per klass). [p04](qa-guldrush-578/p04-statistik-1920.jpeg), [p05](qa-guldrush-578/p05-statistik-tva-klasser-1280.jpeg) |

Skärmdumparna `p02`, `p04`, `p07`, `p09` i `qa-guldrush-565/` visar den
gamla anonyma versionen (guldberget) och är ersatta av `qa-guldrush-578/`.

### Fynd under #578 (åtgärdat)

- **Händelserna spelades i omvänd ordning** när flera kom samtidigt:
  `grEvents` kommer nyast först, regin tog dem i den ordningen → "Ny ledare"
  före Skattkammaren som gav ledningen (i flödet och i banderollkön). Nu får
  regin dem äldst först (`gr-skattkammare.js`).

### Kvarvarande avsteg / att bekräfta

| Specen säger | Byggt | Varför |
| --- | --- | --- |
| Namn av → "visa avatarer och händelser, men inga namn" (designspec §6.3) | Namn av → inga avatarer i flödet heller | Uttryckligt i #578 punkt 2 |
| "Namn i händelseflödet" | Gäller bara flödet (och banderollerna). Topp 10-skyltarna, statistiken och pallen visar namn även när den är av | Inställningen heter "i händelseflödet"; topplistan/ställningen saknar mening utan namn. Elias bekräftar |
| Ingen viktig text < ~28 px | Statistikens ställning: 30 elever i 1280×720 ger 27 px (en klass) / 23 px (två klasser + klassrad); 40 px i 1920×1080 | 30 rader + klassens siffror ska rymmas utan att scrolla |
| Exakt ställning | Elever med 0 guld får "–" i stället för placeringsnummer | Samma regel som pallen (bara guld > 0 placeras) |

## Tester

| Test | Resultat |
| --- | --- |
| 15 Stöld | ✅ Emulator (#565): Ali 100 → 85, Nora +15 i samma transaktion, händelsen `steal 15` i grEvents och i projektorns flöde. Sedan #578 lyder posten enligt specen "🦝 Nora knyckte 15 guld från Ali!" med båda avatarerna (enhetstest + förhandsvisning; servern oförändrad). [e02](qa-guldrush-565/e02-emulator-test15-stold-1920.jpg) |
| 20 Tiden ute | ✅ Svar efter 00:00 nekas ("Tiden är ute! ⏰"), projektorn avslutar, result sparas (totalGold, classGold, topp 3 = pallen). [e04](qa-guldrush-565/e04-emulator-pall-1920.jpg) |
| D4 Trängsel | ✅ 30 avatarer i lobbyn i 1280×720, rubrik + STARTA syns. [p01](qa-guldrush-565/p01-lobby-1280.jpg) |
| D5 Klättring | ✅ (#578, förhandsvisning) Juni 5:a → guld + 100 → avataren glider till mitten fram (1:a), "⭐ Ny ledare: Juni!" en gång, jubel; flödet visar Skattkammaren före ledningsbytet. [p03](qa-guldrush-578/p03-ny-ledare-1920.jpeg) |
| D7 Händelsestorm | ✅ #578: 2 × 30 kistor på 0,3 s i förhandsvisningen → högst 1 banderoll, högst 5 poster, 10 högar kvar. #565: 42 elever öppnar kistor samtidigt (2 omgångar): högst 1 banderoll åt gången, högst 5 poster i flödet, tempo 1 post/0,65 s, kön gallras (småguld först) – ligger aldrig efter |
| D8 Pallplats | ✅ 3:an → 2:an → 1:an med kläder, vinnaren jublar, guldregn + konfetti, "Tillsammans samlade 4B … guld!" med alla avatarer. [p05](qa-guldrush-565/p05-pall-1920.jpg) |
| D9 Delad placering | ✅ Två på 2:a = samma pallsteg (preview och emulator). [p06](qa-guldrush-565/p06-pall-delad-2a-1920.jpg) |
| D10 Omladdning | ✅ Mitt i matchen: 0 gamla händelser på 9 s, rätt guld direkt. Efter finalen: resultatet direkt, 0 pallanimationer. [e05](qa-guldrush-565/e05-emulator-pall-efter-omladdning-1280.jpg) |
| D11 Ljud | ✅ Bara projektorn (ljudkön): 30 stölder på 0,6 s → högst 2 ljud; grottljudet stoppar inte trumvirveln (enhetstest) |
| D12 Reducerad rörelse | ✅ Spindel/fladdermus/dropp borta, stilla facklor, inga fallande mynt, toningar. [p08](qa-guldrush-565/p08-reducerad-rorelse-1920.jpg) |
| D13 Regressioner | ✅ Klassmatchen (Raketrace m.fl.), Snilleblixten och Trollkarlsduellen laddar som förut; skalets ändring är bara `ownTimer` (göms för Guldrushen) |
| Enhetstester | ✅ #578: 1529/1529 utan emulator (`test/live-guldrush-projektor.test.js` 15 st: topp 10, högarnas skala, sköld vid namnet, flödets texter/avatarer namn på/av, banderoll vid ledningsbyte, exakt ställning). Bootgrafen (BFS från `src/app.js`): 107 |
| Emulator (#578) | ➖ Inte omkörd: bara projektorvyerna ändrades (servern, reglerna och händelserna är desamma); förhandsvisningen skapar `lead`-händelser exakt som `noteLeader` och levererar dem nyast först som `watchEvents` |

## Fynd under QA (åtgärdade)

- **Gamla händelser spelades upp när projektorn öppnades** mot riktig Firestore: första ögonblicksbilden kom ur cachen. Baslinjen väntar nu på serverns ögonblicksbild (`fromCache`, `gr-koppling.js`).
- "Hoppsan! Någon tappade 0 guld." / "dubblade (+0)" visas inte längre.
