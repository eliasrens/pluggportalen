# QA-rapport – Gruvan 2.0 (issue #226)

Slut-QA av Gruvan 2.0 efter den egna Diablo-lika grott-kartan (#224) + pickhacke-
avataren med hack-animation (#225). Verifierat mot `preview-gruvan.html` i headless-
browsern (riktig sida, inte about:blank) samt ren matte via enhetstester. **Inga
buggar hittade** – banan är komplett och spelbar från gruvöppning till jättekristall.
Ingen kodändring behövd; nåbarheten är redan låst med flood-fill-tester (från #224).

## Testresultat
- `node --check` rent på **hela** `src/**`, `test/**` och `server.mjs`.
- Äventyrs- + kart- + lägessynlighets-testerna gröna: **81/81**
  (`adventure-camera/grid/movement/world`, `gruvan-map`, `skattjakten-map`,
  `gamemode-visibility`).
- Övriga pure-tester gröna per fil; endast `firestore-rules` "failar" – den kräver
  Firebase-emulatorn och kan inte köras headless här (ej i scope för detta issue).

## Live-verifiering (headless Chrome mot preview-gruvan.html)
| Krav | Utfall |
| --- | --- |
| Start vänster vid gruvöppningen | ✅ start (175, 500) px = normaliserat (0.073, 0.5), på gångbar mark |
| Kameran centrerar avataren, ~1/6 (här 1/4) syns, clampad | ✅ zoom 1.155 → 600 px av 2400 = **1/4** synligt (temats avsiktliga val, #224); kameran clampad vid vänsterkanten vid start (tx=0, ingen "utanför-berget"-yta) |
| Mjuk scroll djupare in åt höger | ✅ kameran börjar scrolla först när avataren passerar mitten (lerpad följning, snäpp på första rutan) |
| Generös kollision – fastnar i bergväggar | ✅ upp/ned från gången stoppas mot berget (y 500→297 upp, →520 ned); avataren kan aldrig lämna grott-ytan eller bild-kanten |
| Smidigt i gångar/rum, inga osynliga väggar i gångbar mark | ✅ fri gång i gångar/kammare; kollisionen genereras ur SAMMA geometri som bakgrunds-SVG:n → ingen drift |
| Avataren har pickhacka + hack-animation vid kristall | ✅ `.adv-hand-tool` (pickhacka) i handen; `.adv-hacking` svingar när en kristall bryts |
| 10 kristaller utspridda i lagom rytm | ✅ 10 stationer (av 18 kandidater), min-avstånd > 0.05 (enhetstest); gå→kristall→hack→fråga→vidare |
| Fråga ovanpå, avatar fryst → tillbaka direkt | ✅ 0 px rörelse med piltangenter nedtryckta medan modalen är öppen; modal stängs → spel direkt |
| 10 rätt → slutmål aktiveras längre in med tydlig effekt | ✅ jättekristallen tänds (glow/strålar/gnistor) i slutkammaren efter 10 klarade |
| Gå dit → bana klar + belöning | ✅ resultatskärm: "Du bröt alla kristaller och väckte jättekristallen…", stjärnrad, +50 coins/+40 XP, "Spela igen"/"Till området" |

Full genomspelning kördes end-to-end: alla 10 stationer klarades via riktig
tangentstyrning + riktiga frågemodaler (quiz/läsförståelse/par), jättekristallen
spawnade, nåddes och aktiverades, belöningen delades ut grind-skalat
(mode `aventyr:gruvan`; stjärnorna sänktes korrekt till ★★☆ efter ett felförsök).

## Edge-cases
- **Nåbarhet (flood-fill):** alla 18 kristall-kandidater **och** slutmålet ligger i
  samma sammanhängande gångbara region som gruvöppningen – ingen kan hamna i en
  avskuren ficka. Låst med regressionstester i `test/gruvan-map.test.js` (#224).
- **Område med <10 frågor:** hanteras snällt. Preview-mocken har bara ~9 användbara
  frågor för 10 stationer – poolen fylls på när den tömts (`refillIfEmpty`), så alla
  10 kristaller gick att bryta. Helt tomt/otillräckligt innehåll → `hasQuestions()` =
  false → vänlig "Äventyret är inte redo än"-skärm (`index.js`), inte en trasig bana.
- **Avatar i hörn / trång gång:** rörelsen är axel-separerad (glider längs väggar),
  fastnar inte permanent; verifierat att avataren i varje testat läge kan gå ut åt
  minst ett håll (ingen instängning i konkava hörn). Gruvan har ingen bro.
- **Liten/stor skärm:** kameran räknar om zoomen vid resize (ResizeObserver). Testat
  litet (320-brett, zoom 0.53) och stort (1200-brett, zoom 2.0) – i båda fallen ligger
  hela viewporten inom kartan (vänster/topp-glapp ≤ 0, höger/botten-glapp ≥ 0), ingen
  yta utanför berg-bilden, och ~1/4 av bredden syns.
- **Övriga teman orörda:** Skattjakten (scroll-läge, `adv-map` + 10 stationer) och
  Spökjakten (grid-läge, 176 tiles + 10 stationer) laddar och startar felfritt utan
  konsol-fel – motorns delade flöde och grid-läget intakt efter Gruvans scroll-tillägg.

## Konsol / nätverk
- Inga JS-fel i någon av de tre banorna. Enda 404:n är `favicon.ico` (preview-sidorna
  har ingen favicon) – kosmetiskt, påverkar inte spelet. Grott-kartan
  (`gruvan-karta.svg`) och alla moduler serveras 200.

## Not: viewFraction 1/4 vs "~1/6" i issue-texten
Issue:n nämner "~1/6 synligt" generiskt; Gruvans tema sätter medvetet
`viewFraction: 1/4` (#224: "nära, mysig Diablo-känsla"). Det är ett avsiktligt
tema-val, inte en regression – kameran clampar korrekt oavsett andel. Lämnas som är;
lyft till lead om 1/6 önskas i stället.

## Ändringar i detta issue
- `docs/QA-RAPPORT-issue-226-gruvan-2-0.md`: denna rapport. Ingen kodändring – QA:n
  hittade inga buggar och nåbarheten var redan testtäckt i #224.
