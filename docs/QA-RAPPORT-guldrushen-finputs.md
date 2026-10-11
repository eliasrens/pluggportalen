# QA-rapport – Guldrushen finputs (epic #587, slut-QA #594)

Kört 2026-10-11 på epicgrenen `154f3a3` (#588–#593 sammanslagna).
Spec: UTVECKLINGSUPPDRAG_GULDRUSHEN_FINPUTS.md, avsnitten "Tester" och "Visuell kontroll".

Miljö:
- Emulatorer (functions + auth + firestore) via `admin/qa-guldrush-preview.sh` med `FN_SEKVENS=1`
  (FS 8596, proxy 8597), riggen `admin/qa-guldrush-elev.mjs`.
- Demosidan `preview/preview-guldrush-demo.html` för projektorvyn, finalen och musiken.
- En headless Chrome-flik. Skärmdumpar i `docs/qa-guldrush-594/`.

## Sammanfattning

**Allt grönt: test 1–16, 18–27 och regressionen.** Test 17 (elevskärmsfönstret) kördes inte om,
eftersom uppdraget bara tillåter EN webbläsarflik. Det är verifierat i #593.
Inga buggar som stoppar landning. Fem små iakttagelser (O1–O5) står längst ned.

**Deploy före live (i den här ordningen):**
1. `firebase deploy --only firestore:rules` – **reglerna ÄR ändrade** (#589): `durationSeconds`
   gick från `in [300, 600, 900, 1200]` till hela minuter 60–3600. Specen trodde att ingen
   regeländring behövdes, men utan den nekas 3, 7 och 30 min i produktion (`permission-denied`).
2. `firebase deploy --only functions` – sköldregeln (`guldrush-core.js`, `guldrush/guldrush-regler.js`,
   `guldrush/chests-config.js`). Predeploy-kroken kör `sync-guldrush-functions.mjs`.
3. Därefter merge till main (Pages). Index är oförändrade.

Ordningen spelar roll: ny klient mot gamla functions = gamla sköldregeln (`shield`) på servern.

## Sviter (test 14)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test` utom regler/functions/e2e) | ✅ 1617/1617 |
| `npm run test:rules` | ✅ 400/400 |
| `npm run test:functions` | ✅ 42/42 (sköld test 1–8 mot functions-emulatorn ingår) |
| `npm run test:e2e` | ✅ 5/5 |
| `npm run sync:guldrush` | ✅ kopiorna i `functions/guldrush/` identiska med `src/` (git diff tom) → en version av regeln |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | ✅ 107 filer, identisk lista före (58c01ed) och efter epicen |
| Test 26 `grep -r "🪙" src` | ✅ 0 träffar |

## Sköld (test 1–8)

Servernivå: `test/functions-guldrush-stold.test.mjs` "ETT tidsbegränsat skydd" test 1–8 (mot
functions-emulatorn) och `test/live-guldrush.test.js` (delade regeln) – alla gröna. Dessutom i
webbläsaren mot emulatorn, eleven b01 (Saga 4B) i en pågående match:

| Test | Resultat |
| --- | --- |
| 1 Sköldkista → 60 s | ✅ `skold b01` (riktig Sköld-kista genom serverkärnan) 20:26:19 → elevskärmen "🛡️ Skyddad 0:56" 5 s senare, avataren får bubblan. 20:28:03 (efter förlängningen nedan) ingen skyddsrad längre. |
| 2 Ny sköld efter 40 s | ✅ ny Sköld 20:26:59 → `protectedUntil` 20:27:59 (60 s från nu), elevskärmen "Skyddad 0:57" 20:27:03. |
| 3 Bestulen → 30 s | ✅ Nora stals på 20:28:06 → `protectedUntil` kvar 17,4 s vid 20:28:19 (= 30 s). |
| 4 Vänta ut skyddet | ✅ Nora skyddad 6 s, b01 får Stöld: Nora gråad "🛡️ 0:04", blev valbar när nedräkningen nådde noll (5 s kvar på väljaren), klick → stölden gick igenom (Nora 125 → 107, b01 +18). |
| 5 Offret hinner skaffa sköld | ✅ Ivar fick en riktig Sköld under väljartiden → listan uppdaterades direkt ("🛡️ 1:00", gråad). Anrop mot Ivar ändå → servern nekar `failed-precondition` "🛡️ Ivar hann skaffa en sköld!"; väljaren låg kvar (7 s), b01 valde Siri → stöld 18 guld. |
| 6 Väljartiden går ut | ✅ I webbläsaren: väljaren gick ut medan Ivar var skyddad → servern slumpade Sam. Rigg: 10 av 19 skyddade, 12 utgångna väljare genom `chooseVictim(null)` → 0 skyddade valda. |
| 7 Alla skyddade | ✅ `skydd alla 60` + Stöld → 0 valbara, vid 0 s "Ingen att välja – +25 guld" (vanlig guldkista). |
| 8 Manipulerat anrop | ✅ `chooseVictim({victimUid: skyddad})` direkt från elevens klient → nekas av servern (se test 5). |

## Layout (test 9–13) – demosidan, 1920×1080 och 1280×720

| Test | Resultat |
| --- | --- |
| 9 Gemensam skatt | ✅ Ingen notis. Inga notis-/banderollelement skär den översta raden (0 träffar, topraden slutar 223 px/182 px). Guldrutan: mätaren fylls till 100 %, "🎉 Skatt: 2 000 guld!", klassen `grk-fira` (puls) + 22 konfettibitar runt rutan, sedan börjar mätaren om ("Nästa skatt: 3 000"). |
| 10 20 händelser snabbt | ✅ 20 kistor med 60 ms mellanrum + ledningsbyte, mätt var 100:e ms i ~5 s (63/53 prov): högst 4 rader, 0 radbrytningar (`white-space: nowrap`, ellips, 0 avklippta), 0 rader ovanför den översta raden. Korta texter: "💎 Signe +50", "🔄 Malte ↔ Vera", "👑 Juni +100", "⭐ Liam leder!". "Ny ledare"-banderollen ligger i luften under topraden. |
| 11 ✖️2 | ✅ Flödet visar "[SVG] Clara +89" – bricka-SVG, inte "X 2". |
| 12 Final 2/3/25 | ✅ Rubriken exakt "🏆 Guldrushen – Prispall" i alla sex. Pallens mitt = skärmens mitt (960/640 px) för 2, 3 och 25. 2 spelare: 2:an vänster + 1:an, ingen tom plats. Inga klassnamn i finalen. Mynt-SVG framför alla "+N pluggmynt", ingen mynt-emoji. 25: publiken i 2 rader (13+12), under totalraden (883→912 px / 589→608 px), slutar före gruvvagnen (1361 < 1602 px / 908 < 1068 px). |
| 13 Topplistan | ✅ Oförändrad: topp 10 vid guldhögar med placering/👑, namn, guld, 🛡️ + bubbla bara för skyddade (bubblorna försvinner när skyddet går ut). |

## Musik (test 15–21) – demosidan, Web Audio instrumenterat (initScript)

| Test | Resultat |
| --- | --- |
| Lobby | `guldrushen-loop.ogg` (1,7 MB) hämtas och avkodas i lobbyn, ingen källa startar, kontexten väntar på gest → tyst. |
| 15 Start + loop | ✅ Riktigt klick på STARTA → nedräkning tyst → EN källa `loop = true`, `loopStart/loopEnd 0` (hela bufferten 84,21 s) → sampelexakt skarv. Fade 0 → 0,3 på 1,5 s när matchen blir live. (Lyssning förbi 1:24 går inte i headless – skarven bedöms ur loop-inställningen och #593:s sampelanalys.) |
| 16 Musik av, ljud på | ✅ Fade 0,3 → 0 på 0,4 s, `pp:live:musik = av`, "🔊 Ljud på" kvar och en kista spelar fortfarande effekter. |
| 17 Elevskärmsfönster | ⏭️ Ej omkört (kräver ett andra fönster; uppdraget säger EN flik). Verifierat i #593 (docs/qa-guldrush-593) + `test/live-music.test.js`. |
| 19 Fanfar → duck | ✅ Gemensam skatt: duck 1 → 0,7 (kistan) → 0,35 (fanfaren), hålls, tillbaka till 1 linjärt på 0,9 s. |
| 19b Effekter av | ✅ "🔇 Ljud av" + gemensam skatt → 0 ramper på musikens gainer, kontexten igång → jämn volym. |
| 20 00:00 | ✅ Fade 0,3 → 0 på 1,0 s startar när klockan når 00:00 (ctx 38,44 → 39,44 s); trumvirveln börjar ctx 39,69 s – efter uttoningen. Källan stoppas sedan. |
| 21 Omladdning | ✅ "🎵 Musik av" kvar efter omladdning (localStorage). |

## Speltid (test 22–24) – riktig lärarvy mot emulatorn

| Test | Resultat |
| --- | --- |
| Formuläret | ✅ Snabbknappar 3/5/10/15/20/30 min + "Egen tid", förval 10 min (`t22-formular-speltid`). |
| 22 Egen tid 7 | ✅ Lobbyn "⏱ 7 min", `durationSeconds 420`, klockan startar på 07:00 efter nedräkningen, historiken "· 7 min –". |
| 23 Ogiltigt | ✅ 0 och 61 → "Speltiden måste vara hela minuter mellan 1 och 60." · 2.5 → samma text · tomt → "Skriv in hur många minuter matchen ska vara (1–60)." Ingen session skapas. Se O1 om "2,5". |
| 24 30 min | ✅ Lobbyn "⏱ 30 min" (lobbyn raderades sedan). |

## Mynt-ikonen (test 25–27)

| Test | Resultat |
| --- | --- |
| 25 | ✅ Sökt i den renderade DOM:en (text + `::before/::after`) efter mynt-emojin och alla tecken i U+1FA70–1FAFF: **0 träffar** i Guldrushens lobby, spel, final och elevens slutskärm, i Snilleblixtens formulär, lobby och final, i Klassmatchens lobby och vinnarvy, och i historiken för alla tre formaten. Myntet är överallt `svg.coin-svg`/Pluggcoin-SVG (1–2 per vy där pluggmynt visas). |
| 26 | ✅ `grep -r "🪙" src` → 0 (även `test/mynt-ikon.test.js`). |
| 27 | ✅ Riktig match: b01 1:a med 9 rätt, förstapris 300, 5/rätt → slutskärmen "Placeringspris 300" (egen rad, överst), "9 rätt svar 45", "Totalt: 345 pluggmynt". `result.rewards.b01 = {prize 300, correctCoins 45, total 345}`, saldot 100 → 445. |

## Regression (test 14)

| Vad | Resultat |
| --- | --- |
| Sviter, bootgraf | ✅ se tabellen överst. |
| Snilleblixten | ✅ Lobby (10 frågor, 20 s, mynt-SVG), 12 sim-elever, 10 frågor autospelade, Avsluta → final "🏆 4B – vilken final!" med pall och "+N pluggmynt", `result.rewards` skrivet (1:a 100+45). Musikknappen finns men är dold (`hidden`) – formatet saknar `music`. |
| Klassmatchen | ✅ 4B mot 5E, 5 min, 12 sim-elever via klient-SDK (reglerna prövar varje svar), 54 rätt → "VINNARE – 4B!", nämnare, matchens stjärnor, "Resultatet är sparat i historiken". Ingen musikknapp synlig. |
| Test 18 elevdator | ✅ Elevens Guldrush-vy efter hård omladdning: 250 resurser, ingen `.ogg`, ingen `proj-music.js`/`projector.js` (bara `proj-sound.js`, som elevens kistljud använt sedan förut). |
| Riktig projektor | ✅ Guldrushens projektorvy och final mot emulatorn (`r01`, `r02`): topp 10, guldrutan med mätare, finalen centrerad. |

I konsolen syntes två `failed-precondition` på Snilleblixtens sessionsdokument när simulatorn
och läraren skrev samtidigt. Det är transaktioner som försöker igen, och flödet gick klart.

## Iakttagelser (inga stoppar landning)

| # | Vikt | Vad | Förslag |
| --- | --- | --- | --- |
| O1 | Låg | "Egen tid": i en webbläsare med engelsk locale filtrerar `<input type=number>` bort kommatecknet, så att "2,5" blir **25** och en 25-minutersmatch skapas utan fel. I svensk locale tolkas "2,5" som 2,5 och nekas. | Låt det vara, eller använd `type=text inputmode=numeric` med egen tolkning. |
| O2 | Låg | Offerväljaren när ALLA är skyddade säger "Ingen har tillräckligt med guld att knycka just nu", fast orsaken är skydden (rutorna visar 🛡️). | Egen text när alla rader är skyddade. |
| O3 | Info | Projektorns pall visar placeringspriset ("+300 pluggmynt"), elevens slutskärm totalen (345). Det är oförändrat sedan tidigare, men samma elev ser två olika tal. | Elias avgör. |
| O4 | Info | Spindeln (ambient dekor) hänger från taket ner i glappet mellan timern och guldrutan. Den täcker inget i topraden. | – |
| O5 | Info | 1280×720: fälten "Pris till 1:a plats"/"Tak per elev" är så smala att platshållaren och "300" klipps ("30("). Det är inte nytt i epicen. | – |

## Skärmdumpar (`docs/qa-guldrush-594/`)

| Fil | Vad |
| --- | --- |
| `p01-spel-fore-skatt-{1920x1080,1280x720}` | projektorn under spel, före en gemensam skatt (mätare, flöde) |
| `p02-spel-under-skatt-*` | firandet i guldrutan (mätaren full, puls, konfetti). Tagna med sidans timers 8× långsammare och animationerna pausade, därför står några figurer mitt i en förflyttning i 1920-bilden |
| `p03-spel-efter-skatt-*` | mätaren har börjat om mot nästa skatt |
| `p04-flode-storm-*` | händelseflödet med många händelser (högst 4 rader) + "Ny ledare"-banderollen |
| `f02/f03/f25-final-{2,3,25}-spelare-*` | finalskärmen med 2, 3 och 25 spelare |
| `e01-elev-utan-skydd-*`, `e02-elev-med-skydd-*` | elevens skärm utan och med "🛡️ Skyddad 0:47" |
| `o01-offervaljare-skyddad-kompis-*` | offerväljaren med en skyddad kompis ("🛡️ 0:03"/"0:06", gråad) |
| `e03-elev-slutskarm-test27-*` | test 27: Placeringspris 300, 9 rätt svar 45, Totalt 345 |
| `r01-riktig-projektor-emulator-1920x1080`, `r02-riktig-final-emulator-1920x1080` | appens projektor mot emulatorn |
| `t22-formular-speltid`, `t22-lobby-7-min`, `t22-historik-7-min` | valfri speltid |
| `reg-snilleblixten-final`, `reg-klassmatchen-vinnare` | regression |
