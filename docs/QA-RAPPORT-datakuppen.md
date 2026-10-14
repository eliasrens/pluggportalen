# Datakuppen 💾 – slut-QA (#656, epic Datakuppen A–E)

Slutverifiering av epic-grenen efter #651–#655, mot spec
`docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md` §6 (test 1–25), §8 och §9.
Körningen gjordes mot emulatorerna (functions + auth + firestore, grenens egna
regler och Cloud Functions) med den **riktiga appen** för elevvyn, och mot
demoläget för projektorn. En webbläsarflik användes, i 1920×1080, 1280×720 och
1366×768. Skärmdumparna ligger i [`qa-datakuppen/`](qa-datakuppen/).

**Sammanfattning:** Alla tester 1–25 är gröna. Två fynd rättades under QA:n
med en commit var. **F1** (medel): i appen på 1920×1080 behövde målväljaren
scroll, och den sista raden klipptes. **F2** (låg): datapaket gled bakom
finalens medalj och mynt. Inget större fel hittades. Guldrushen, Snilleblixten
och Klassmatchen fungerar som förut, och bootgrafen har inte vuxit
(107 = main). Det finns fem öppna frågor till Elias.

## Testsviter (samma gren, efter rättningarna)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test test/*.test.{js,mjs}`, utan regel-, functions- och e2e-sviterna) | ✅ 2197/2197 |
| `npm run test:rules` | ✅ 498/498 |
| `npm run test:functions` (med nya `functions-datakuppen-fragor.test.mjs`) | ✅ 160/160 (se not) |
| `npm run test:e2e` | ✅ 5/5 |
| Bootgrafen (BFS från `src/app.js`, `admin/qa-bootgraf-bfs.mjs`) | ✅ 107 filer, samma som main och epicens bas; inga kistspels-, Guldrush- eller Datakuppen-filer statiskt |
| Synk `functions/kistspel`, `functions/guldrush`, `functions/datakuppen` | ✅ ingen diff efter `sync-guldrush-functions.mjs` |

Not: `test:functions` kördes två gånger. Första gången: 156/156 (utan det nya
testet). Andra gången: 159/160. Felet var `auth/network-request-failed` i
`functions-update-login` och har inget med Datakuppen att göra. Filen
kördes om och blev grön (10/10). Felet beror på belastning i auth-emulatorn.
Ett blankt `node --test` tar också med regel- och functions-sviterna, och de
kräver emulatorn. Därför körs de via `npm run test:rules` och
`test:functions`.

Recept (8 GB RAM, egna portar): firebase-tools från
`~/.npm/_npx/…/node_modules/.bin` och Java `/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin`.
Lägg en gitignorerad `.qa-656.firebase.json` med portarna 8656/9656/5656 och
sätt `FUNCTIONS_EMULATOR_HOST`. `node_modules` installeras utanför repot och
symlänkas in.

## Metod och verktyg (nya i #656)

| Fil | Vad |
| --- | --- |
| `test/functions-datakuppen-fragor.test.mjs` | **Nytt (test 16).** Servern rättar multiplikation (skriv själv och flerval), quiz från Plugga och tidslinjefrågor i en Datakupp. Rätt svar ger en fil, fel svar ger ingen. Fel form nekas. Datakuppen saknade tidigare ett eget tidslinjetest. |
| `admin/qa-datakuppen-emoji.mjs` | **Test 19.** Jämför Datakuppens alla UI-filer (formatet, kistspelsmodulen, `src/live/*`, serverkopian, förhandsvisningarna) mot Unicodes egna `emoji-test.txt` och `DerivedAge.txt`. Det fångar också E13.1-sekvenser som 😮‍💨. Skannern provades med 🪙 😮‍💨 ❤️‍🔥 🫠, och alla fyra fälldes. |
| `admin/qa-datakuppen-koll.mjs` | Elevens kodförslag och kod mot listan och mot andras koder (test 1 och 2 i matchen) |
| `admin/qa-datakuppen-hemlig.mjs` | Serverns hemliga läge: allas koder, minnet per par (lockkoder och strukna) och kontrollen av lockkoderna (test 12 i matchen) |
| `admin/qa-guldrush-preview.sh` + `admin/qa-datakuppen-elev.mjs` (från #653) | Emulatorerna med seed. Matchen styrs runt b01 genom serverkärnan: lobby, start, hack [igen], hackad, skydd, slut. |
| `admin/qa-guldrush-larare.mjs` (från #567) | En lärarprojektor utan skärm, alltså appens `live-feed`. Den skriver `result` och betalar ut Pluggmynt, nu för en Datakupp (test 15). |

## Spelregler (spec §6 test 1–13)

| Test | Resultat | Belägg |
| --- | --- | --- |
| **1** Lobbyn → 4 koder | ✅ | `functions-datakuppen-core` "test 1". **I appen:** b01 fick `astr0n4u7 · ka1a5 · t4c0s · ba5k3t`. Alla fyra fanns i listan och ingen var tagen av de 19 andra (`qa-datakuppen-koll`). [e-lobby-kodval-1366](qa-datakuppen/e-lobby-kodval-1366x768.jpg) |
| **2** Ingen kod vald före start | ✅ | Testet "test 2" (båda varianterna). **I appen:** b01 valde ingen kod. Vid start fick hen `ka1a5` ur sina förslag, och koden fanns i listan och var unik. |
| **2b** 100 giltiga koder | ✅ | `live-datakuppen.test.js` "test 2b" |
| **3** Annan elev läser koden | ✅ | `firestore-rules-live-datakuppen` "koden är hemlig" (5 tester: dkSelf bara eleven, dkSecret ingen klient, ingen samlingsfråga, dkPlayers utan kod) + `functions-datakuppen` "§2.4" |
| **4** Rätt svar → tre filer, servern avgör | ✅ | "test 4" (samma slump ger samma fil, oavsett vilken fil eleven klickar på). **I appen:** 2 × 9 = 18 → tre krypterade filer → Brandvägg (Skyddad 0:54). Svar till filer tog 122 ms och dekrypteringen till effekten 1 283 ms (≤ 1,5 s). [e-spel-filer-1366](qa-datakuppen/e-spel-filer-1366x768.jpg) |
| **5** Hack, rätt kod | ✅ | "test 5" (två tester). **I appen:** Saga hackade Ivar med `p4nnk4k4`. Ivar gick från 25 till 22 MB och Saga från 0 till 3 MB (15 %, avrundat nedåt), så summan bevarades. Ivar fick skydd 30 s, `lastHit` och 4 nya kodförslag (giltiga i 10 s). Händelsen `steal/hack` skrevs. [e-hack-ratt-kod-1366](qa-datakuppen/e-hack-ratt-kod-1366x768.jpg) |
| **6** Hack, fel kod | ✅ | "test 6". **I appen:** Saga gissade `1nn3b4ndy`. Inget flyttades, svaret blev "Fel kod! Koden stryks. Nästa gång mot Ivar är det lättare." och servern sparade `struck: ["1nn3b4ndy"]`. Att tiden gick ut strök ingen kod. |
| **7** Samma mål igen | ✅ | "test 7" (två tester). **I appen:** samma tre koder visades i ny ordning (`1nn3b4ndy, p4nnk4k4, 70ffl0r` → `70ffl0r, p4nnk4k4, 1nn3b4ndy`). Vid tredje försöket var den strukna koden "STRUKEN" och tom, och två koder fanns kvar. [e-hack-minne-1366](qa-datakuppen/e-hack-minne-1366x768.jpg). Se fråga 4. |
| **8** Målet byter kod | ✅ | "test 8" (nya koder, inga strukna). I appen syns det på att Sagas minne mot ett mål följer `codeVersion`. |
| **9** Mål med brandvägg | ✅ | "test 9" (två tester) + "§2.8". **I appen:** de skyddade är gråade med 🛡️ och nedräkning (0:35). En kamrat med skydd 0:01 blev valbar och slumpades fram när tiden gick ut. Förra målet visas som "Nyss hackad". [e-hack-steg1-1366](qa-datakuppen/e-hack-steg1-1366x768.jpg) |
| **10** Hackning av | ✅ | "test 10" i `functions-datakuppen-core` och i `live-datakuppen` (vikten går till datafilerna, ett manipulerat Hack ger en Mapp) |
| **11** Virus högst 10 % | ✅ | "test 11" (100 → 90, 255 → 230, 9 → 9, 0 → 0) |
| **12** Lockkoderna | ✅ | "lockkoderna (test 12)" (3 tester) + `live-datakuppen` "test 12". **I matchen:** 13 par hackare–mål, och ingen lockkod var någons aktuella kod. Längdskillnaden var högst 2 tecken, eftersom målet kan ha bytt kod sedan lockkoderna skapades. Klienten får bara koderna (`dkSelf.hack.options`), inte vilken som är rätt. |
| **13** Attackerna i §2 | ✅ | `functions-datakuppen.test.mjs` §2.1–2.10 (E2E mot de riktiga callable-funktionerna) + spärrarna i `functions-datakuppen-core`/`-hack` + reglerna "eleven skriver ingen data" |

## Gemensamt med Guldrushen (test 14–19)

| Test | Resultat | Belägg |
| --- | --- | --- |
| **14** Utbrytningen | ✅ | Alla Guldrush-sviter är gröna (enhet, regler, functions). Guldrushens testfiler har bara fått nya importvägar och nya tester (`git diff` mot epicens bas), inga borttagna. Historiken är bevisad byte-identisk (#655) och demo och DOM utan diff (#651). |
| **15** Pluggmynt | ✅ | **I matchen:** appens lärarprojektor skrev `result` (20 elever, 725 MB, hack 9/17) och betalade ut. Varje elevs saldo ökade med exakt `result.rewards[uid].total`, 20 av 20 (1:a 300 + 25 = 325, 2:a 255 + 20, delad 5:e). Alla hade 100 mynt under hela matchen, så data blev aldrig mynt. Elevens slutskärm visar "Placeringspris 157 · 5 rätt svar 25 · Totalt 182" och menyn visar 282. [e-final-1366](qa-datakuppen/e-final-1366x768.jpg) |
| **16** Tidslinje, quiz, multiplikation | ✅ | **Nytt** `functions-datakuppen-fragor.test.mjs` (4/4). Multiplikation spelades i appen. Quiz och tidslinje i elevvyn är Guldrushens delade `ks-fraga` (quiz-skärmdump i #653), men de klickades inte i appen här. |
| **17** Speltid 1–60 min | ✅ | `live-datakuppen` "test 17" + `firestore-rules-live-datakuppen` "test 17" (30 s, 61 min, 1,5 min och 0 nekas) |
| **18** Musiken | ✅ | `live-music.test.js`: loop över hela bufferten, tyst lobby och "test 19b: effekterna av → ingen ducking". `hackerlaget-dark-loop.ogg` avkodas i Chrome: 85,714 s, vilket är exakt 50 takter i 140 bpm. Skarven är liten (0,05 mot sampelsprång upp till 0,39). Ljudet kunde inte avlyssnas i den huvudlösa webbläsaren. |
| **19** Inga Emoji 13+ | ✅ | `admin/qa-datakuppen-emoji.mjs`: 57 olika emojier i 111 filer, högsta version E11 (🧱), **0** Emoji 13+. `mynt-ikon.test.js` (urvalet) är också grönt. |

## Design (test 20–24)

| Test | Resultat | Belägg |
| --- | --- | --- |
| **20** Projektorn 1920/1280 med 1, 5 och 25 elever | ✅ | Mätt i demoläget. Inget utanför den översta raden når in i den (raden slutar vid 183 px i 1280). Flödet har högst 4 rader efter 6–8 snabba händelser. Inget över timern (milstolpens konfetti: 0 av 22 bitar). 1 och 5 elever i 1280 mättes här. Bilderna med 1 och 5 elever finns i [`qa-datakuppen-654/`](qa-datakuppen-654/). |
| **21** Hack-linjen och milstolpar | ✅ | Linjens överkant ligger på 224 px och den fredade raden slutar på 183 px (1280). Linjen korsar inga skyltar. Datapaketen överlappade ingen text i spelvyn eller lobbyn (8 s, var 100:e ms). **F2** gällde finalen och är rättad. [p-hack-1280](qa-datakuppen/p-hack-1280x720.jpg) |
| **22** Chromebook 1366×768 utan scroll | ✅ | I appen var `scrollHeight` 768 i alla lägen: kodval, fråga, filer, målväljaren (19 kamrater, 5 kolumner), kodkort, "välj ny kod" och slutskärmen. 1280×720 gav 720 i samma lägen. **F1** gällde 1920×1080 och är rättad. |
| **23** Reducerad rörelse | ✅ | Projektorn har bara animationer på `opacity`/`color`. Hack-linjen och totalrutan tonar, och datapaketen har `display: none`. Elevvyns filer och kodkort har egna `prefers-reduced-motion`-regler (toningar). |
| **24** Finalskärmen | ✅ | Rubriken är exakt "🏆 Datakuppen – Prispall". Det finns inga klassnamn i finalvyn. Pallens mitt ligger på 960/640/683 px, alltså skärmens mitt. Raden "Tillsammans: 3 701 MB" och ett säkerhetstips finns med. [p-final-1920](qa-datakuppen/p-final-1920x1080.jpg) |

## Regression (test 25)

| Kontroll | Resultat |
| --- | --- |
| Alla befintliga tester | ✅ se testsviterna ovan |
| Bootgrafen | ✅ 107 filer på HEAD, epicens bas (4fbf4c9) och `origin/main`, identiska listor |
| Guldrushen | ✅ Demoläget (Skattkammaren) ritas utan konsolfel. [r-guldrushen](qa-datakuppen/r-guldrushen-1280x720.jpg) |
| Snilleblixten | ✅ Demoläget (fråga pågår, 27 av 30 har svarat) ritas utan fel. [r-snilleblixten](qa-datakuppen/r-snilleblixten-1280x720.jpg) |
| Klassmatchen | ✅ Trollkarlsduellen ritas utan konsolfel. [r-klassmatchen](qa-datakuppen/r-klassmatchen-1280x720.jpg). Runorna blir ▯ i den huvudlösa webbläsaren eftersom typsnittet saknas, och så var det redan före epicen. |
| Guldrushens servrar efter utbrytningen | ✅ `functions-guldrush*` 4 sviter gröna i samma emulatorkörning |

## Fynd

**F1 (medel, rättad i 1d3515e): målväljaren fick scroll i appen på 1920×1080.**
Regeln `@media (min-width: 1500px)` gav målkorten 200 px bredd. Den var tänkt
för helskärm, men i appen är elevytan lika smal (~840 px) som på en
Chromebook. Det gav 3 kolumner, så 19 kamrater tog 7 rader. Sidan blev
1144 px hög, och den sista raden (Sam) låg under skärmkanten medan
nedräkningen på 10 s pågick. Rättat: de breda korten gäller bara i
helskärm (`.dk-elev-vy:fullscreen`). Efter rättningen blev det 5 kolumner, den
sista kortet slutar på 741 px och sidan är 1080 px hög.
Efter: [e-hack-steg1-1920](qa-datakuppen/e-hack-steg1-1920x1080.jpg).

**F2 (låg, rättad i 3fcf609): datapaket gled bakom finalens pall.** Projektorns
dekorvakt (`createDekorVakt`) visste inte om pallen, så på finalskärmen
korsade ett datapaket 1:a-platsens 🥇 och mynt ungefär 1 s av 7,5 s. Det
bryter mot §0.2 (dekor aldrig bakom text eller avatarer). Rättat: pallen,
rubriken, totalraden, tipset och folket räknas nu som hinder. Mätning efteråt:
0 synliga paket över finalen.

## Observationer (inte rättade)

- **O1 "Välj ny kod" har ungefär 7 s, inte 10.** Serverns fönster är 10 s
  från hacket, men först visas notisen i 2,2 s. Kortet dök upp efter 2,9–3,0 s
  med 0:07–0:08 kvar. Vid ett tillfälle när emulatorn var belastad visades det
  först med 0:04 kvar. Därefter väljer servern en kod. Inget går förlorat, men
  den som läser långsamt hinner sällan välja själv. Se fråga 1.
- **O2 Långa namn i terminalen.** I 1280×720 ryms ungefär 35 tecken innan en
  rad krymps till 75 % och sedan kortas med "…". `> Maximilian hackade
  Alexandra: +45 MB` (38 tecken) skulle tappa "MB". Demonamnen (≤ 6 tecken)
  ryms alltid.
- **O3 Lärarstatistiken:** rutan "Misslyckade · Fel kod – strukna" räknar
  också hack där tiden tog slut, och då stryks ingen kod (hackförsök minus
  lyckade). Texten borde vara "fel kod eller tiden ute".
  [l-historik-statistik](qa-datakuppen/l-historik-statistik-1920x1080.jpg)
- **O4 Ordningen vid minnesmomentet:** ordningen är alltid ny, men den rätta
  koden kan ligga kvar på samma plats (`p4nnk4k4` låg på plats 2 båda
  gångerna). Se fråga 4.
- **O5 Demosidorna** visar "Firebase-anrop: 1 BLOCKERADE" om man är inloggad i
  appen i samma webbläsare (`accounts:lookup`). Ingen data läses. Samma som
  #567 O6.
- **QA-artefakt (inte ett fel):** under QA:n sträcktes webbläsarens
  `setTimeout` ut för att hinna fånga korta lägen. Då fastnade en
  dekryptering, och emulatorn gav en gång `ABORTED: Transaction lock timeout`
  på `datakuppAnswer`. Efter en omladdning med vanliga timers fungerade allt
  (svar på 122 ms, fil på 1,3 s). Elevvyn har redan omförsök och 15 s timeout
  på anropen.

## Skärmdumpar ([`qa-datakuppen/`](qa-datakuppen/))

Namn: `p-` projektor (demoläget, 25 elever), `e-` elev (**riktiga appen** mot
emulatorn, inloggad som b01), `l-` lärarhistorik, `r-` regression.

| Läge | 1920×1080 | 1280×720 | 1366×768 |
| --- | --- | --- | --- |
| Lobby (projektor) | [p-lobby](qa-datakuppen/p-lobby-1920x1080.jpg) | [p-lobby](qa-datakuppen/p-lobby-1280x720.jpg) | [p-lobby](qa-datakuppen/p-lobby-1366x768.jpg) |
| Lobby, kodval (elev) | [e-lobby-kodval](qa-datakuppen/e-lobby-kodval-1920x1080.jpg) | [e-lobby-kodval](qa-datakuppen/e-lobby-kodval-1280x720.jpg) | [e-lobby-kodval](qa-datakuppen/e-lobby-kodval-1366x768.jpg) |
| Spel (projektor) | [p-spel](qa-datakuppen/p-spel-1920x1080.jpg) | [p-spel](qa-datakuppen/p-spel-1280x720.jpg) | [p-spel](qa-datakuppen/p-spel-1366x768.jpg) |
| Spel, fråga (elev) | [e-spel-fraga](qa-datakuppen/e-spel-fraga-1920x1080.jpg) | [e-spel-fraga](qa-datakuppen/e-spel-fraga-1280x720.jpg) | [e-spel-fraga](qa-datakuppen/e-spel-fraga-1366x768.jpg) |
| Spel, tre filer (elev) | [e-spel-filer](qa-datakuppen/e-spel-filer-1920x1080.jpg) | [e-spel-filer](qa-datakuppen/e-spel-filer-1280x720.jpg) | [e-spel-filer](qa-datakuppen/e-spel-filer-1366x768.jpg) |
| Hack, ljuslinje (projektor) | [p-hack](qa-datakuppen/p-hack-1920x1080.jpg) | [p-hack](qa-datakuppen/p-hack-1280x720.jpg) | [p-hack](qa-datakuppen/p-hack-1366x768.jpg) |
| Hack steg 1, målväljaren | [e-hack-steg1](qa-datakuppen/e-hack-steg1-1920x1080.jpg) (efter F1) | [e-hack-steg1](qa-datakuppen/e-hack-steg1-1280x720.jpg) | [e-hack-steg1](qa-datakuppen/e-hack-steg1-1366x768.jpg) |
| Hack steg 2, kodkorten | [e-hack-steg2](qa-datakuppen/e-hack-steg2-1920x1080.jpg) | [e-hack-steg2](qa-datakuppen/e-hack-steg2-1280x720.jpg) | [e-hack-steg2](qa-datakuppen/e-hack-steg2-1366x768.jpg) |
| Bli hackad → välj ny kod | [e-valj-ny-kod](qa-datakuppen/e-valj-ny-kod-1920x1080.jpg) | [e-ny-kod-autovald](qa-datakuppen/e-ny-kod-autovald-1280x720.jpg) (efter 10 s) | [e-valj-ny-kod](qa-datakuppen/e-valj-ny-kod-1366x768.jpg) |
| Final (projektor) | [p-final](qa-datakuppen/p-final-1920x1080.jpg) (efter F2) | [p-final](qa-datakuppen/p-final-1280x720.jpg) | [p-final](qa-datakuppen/p-final-1366x768.jpg) |
| Slutskärm (elev) | [e-final](qa-datakuppen/e-final-1920x1080.jpg) | [e-final](qa-datakuppen/e-final-1280x720.jpg) | [e-final](qa-datakuppen/e-final-1366x768.jpg) |
| Statistik (projektor) | [p-statistik](qa-datakuppen/p-statistik-1920x1080.jpg) | [p-statistik](qa-datakuppen/p-statistik-1280x720.jpg) | [p-statistik](qa-datakuppen/p-statistik-1366x768.jpg) |

Fler bilder från 1366×768: [skyddad efter brandvägg](qa-datakuppen/e-spel-skyddad-1366x768.jpg),
[minnesmomentet med den strukna koden borta](qa-datakuppen/e-hack-minne-1366x768.jpg) och
[rätt kod +3 MB](qa-datakuppen/e-hack-ratt-kod-1366x768.jpg). Lärarstatistiken (historiken) finns i
[1920](qa-datakuppen/l-historik-statistik-1920x1080.jpg).

Notisen "💻 Ivar knäckte din kod och tog 16 MB!" visades i appen efter
0,6–0,8 s och låg kvar i 2,2 s (den lästes ur DOM:en). Den hann inte fångas på
bild, eftersom skärmdumpsverktyget tar 2–6 s. Bilden från #653 visar den:
[`qa-datakuppen-elev/dk653-10-bli-hackad-notis-1366.png`](qa-datakuppen-elev/dk653-10-bli-hackad-notis-1366.png).

Avatarerna i elevbilderna är alla samma räv, eftersom seed-eleverna saknar egna
avatarer. Det är seed-data och inget fel.

## Spec §9: rapportens frågor

- **Vad har byggts, och i vilka PR:er?** #651 kistspelsmodulen, #652 format,
  server och regler, #653 elevvyn, #654 projektorn och musiken, #655 historik,
  demoläget och dokumentationen, #656 slut-QA (den här). Allt ligger på
  epic-grenen. Ingen PR mot main finns ännu.
- **Vad bröts ut ur Guldrushen?** `src/live/kistspel/` (ks-core, ks-demo,
  ks-elev, ks-flode, ks-fraga, ks-helskarm, ks-historik(-data), ks-hogar,
  ks-koppling, ks-offer, ks-pall, ks-proj-scen, ks-totalruta,
  delat/ks-regler) och `functions/kistspel-core.js` + `kistspel-rattning.js`.
  Guldrushens `gr-*.js` är nu teman. Verifiering: alla Guldrush-tester är
  gröna, gammal och ny DOM och demo jämfördes utan diff (#651), historiken är
  byte-identisk (#655) och synktestet fäller en kopia som glidit isär.
- **Hur skyddas koderna?** `dkSecret/{uid}` läses bara av servern (kod,
  `codeVersion`, minnet per mål). `dkSelf/{uid}` läses bara av eleven själv
  (egen kod, förslag, hackets tre alternativ). `dkPlayers` innehåller ingen
  kod. Eleven skickar bara ett index, aldrig en kodtext. Minnesmomentet:
  `dkSecret[hackare].hacks[mål] = { codeVersion, decoys, struck, shown }`.
  Ett nytt `codeVersion` hos målet nollställer minnet.
- **Tester:** se tabellerna ovan.
- **Vad behöver Elias göra?** Se nästa avsnitt.

## Vad Elias måste deploya

Inget av detta är gjort. Datakuppen fungerar inte i produktionen förrän
**functions + rules** är ute. Guldrushens funktioner har också ny kod
(kistspelsmotorn) och måste deployas om i samma veva.

```bash
# 1. Cloud Functions (predeploy kör synken själv). Projektet måste ha Blaze.
firebase deploy --only functions:datakuppAnswer,functions:datakuppOpenFile,functions:datakuppChooseTarget,functions:datakuppGuessCode,functions:datakuppPickCode,functions:guldrushAnswer,functions:guldrushOpenChest,functions:guldrushChooseVictim --project pluggportalen-so-2026

# 2. Firestore-reglerna (dkPlayers/dkSelf/dkSecret/dkEvents/dkMeta/dkPublic/dkPrivate)
firebase deploy --only firestore:rules --project pluggportalen-so-2026
```

- Inga nya index (`firestore.indexes.json` är oförändrad mot epicens bas).
- Deploya funktionerna och reglerna **före** Pages, eller samtidigt. Datakuppen
  syns bara i den nya appen, så gamla klienter påverkas inte.

## Öppna frågor till Elias

1. **"Välj ny kod" (O1):** räcker ungefär 7 s efter notisen, eller ska
   serverns fönster bli 12–13 s så att eleven får sina 10 s?
2. **Långa namn i terminalen (O2):** är det okej att `MB` kan försvinna med
   "…" när båda namnen är långa? Alternativet är att visa bara 6–8 tecken av
   varje namn.
3. **Lärarstatistiken (O3):** ska vi byta "Fel kod – strukna" mot "fel kod
   eller tiden ute"? Det är en textändring på en rad.
4. **Minnesmomentet (O4):** räcker "ny ordning", eller ska den rätta koden
   alltid flytta sig till en ny plats? Annars kan en elev minnas platsen i
   stället för ordet.
5. **Deploy:** ska Datakuppen deployas tillsammans med Guldrushens
   functions-deploy (samma funktionsfiler), eller vänta tills epic-PR:en är
   mergad?
