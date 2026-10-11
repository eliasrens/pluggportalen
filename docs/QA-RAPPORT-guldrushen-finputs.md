# QA-rapport – Guldrushen finputs (epic #587, slut-QA #594)

Kört 2026-10-11 på epicgrenen `154f3a3` (#588–#593 sammanslagna).
Spec: UTVECKLINGSUPPDRAG_GULDRUSHEN_FINPUTS.md, avsnitten "Tester" och "Visuell kontroll".

Miljö:
- Emulatorer (functions + auth + firestore) via `admin/qa-guldrush-preview.sh` med `FN_SEKVENS=1`
  (FS 8596, proxy 8597), riggen `admin/qa-guldrush-elev.mjs`.
- Demosidan `preview/preview-guldrush-demo.html` för projektorvyn, finalen och musiken.
- En headless Chrome-flik. Skärmdumpar i `docs/qa-guldrush-594/`.

## Sammanfattning

UTKAST – fylls på under körningen.

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
