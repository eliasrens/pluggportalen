# QA-rapport – Matchdagen Etapp 3 (epic #866, #873)

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) §10, §12–§16. Arkitekturen:
[`MATCHDAGEN.md`](MATCHDAGEN.md) §17. Etapp 1–2: [`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md),
[`QA-RAPPORT-matchdagen-etapp-2.md`](QA-RAPPORT-matchdagen-etapp-2.md).

## Sammanfattning

Etapp 3 är byggd: den som vinner Superligan blir **mästare** (stor pokal, firande med fyrverkerier, guldkant på
klubbmärket) och bjuds in till **Mästarcupen** nästa säsong – kvartsfinal, semifinal och final mot påhittade
toppklubbar (styrka 0,86–0,95), med en egen **finalscen** ("FINALEN", fullsatt läktare med flaggor, större jubel,
silverpokalen som lyfts). Efter en vunnen Mästarcup erbjuds **"Starta en legendklubb"**: en ny klubb i Division 6
där pokalskåpet, rekorden och statistiken följer med och klubbmärket får en guldstjärna; den gamla klubben står i
klubbhistoriken under Statistik. **Pokalskåpet** är en egen flik med en tecknad pokal per sort. Allt nytt ligger i
`src/matchdagen/` (motorn ren i `delat/`), bootgrafen är oförändrad och ingen fil är över 400 rader.

- **Balansen:** 80 % rätt med ett tränat lag (4★) vinner Mästarcupen i **22 %** av försöken (§12: "ungefär var
  femte", gränsen 15–25 % testad). Superligan oförändrad: 47 % vinster (§12: 45–55 %).
- **Kvoten:** inga nya läsningar, inga lyssnare. En match i Mästarcupen är en match (2 skrivningar); legendklubben
  är EN skrivning.
- **Reglerna:** `mastarcup`, `klubbhistorik`, `klubb.legendStjarnor` och två nya pokaltyper prövas. **Codern 2 hittade
  att legendklubbens skrivning spräckte 1000-uttrycksgränsen** (nekad – en elev hade aldrig kunnat starta en
  legendklubb). Rättat med billiga likheter i legendgrenen (§ Reglerna), mätt med marginal.
- **Bilder per sekund** (SwiftShader, ingen GPU): finalen 20–27 fps, firandet 18–21 – samma nivå som Etapp 1–2 i
  samma miljö. Specens ≥ 50 fps på skolans HP-datorer är fortfarande inte uppmätt.
- **Deploy:** `firebase deploy --only firestore:rules` och webben i samma omgång, reglerna först. Inga index, inga
  functions.

## Vad som byggts

- **Mästare i Superligan** (`delat/md-sasong.js matchKlar`): pokalen `superliga` "Mästare i Superligan", inget
  kval, `K.mastarcup = "säsong+1-0"` (inbjudan). Rutan efter matchen visar titeln och laget lyfter guldpokalen.
  Klubbmärket får guldkant (`md-legend.js guldkant`) så länge klubben har vunnit Superligan.
- **Mästarcupen** (`delat/md-mastarcup.js`, ren): tre rundor efter Superligans omgång 3, 6 och 8 (Silverpokalen
  2, 4, 7, 9 – de krockar aldrig), lottningen per säsong (samma efter omladdning), oavgjort → straffar, förlust →
  ute, vunnen final → pokalen `mastarcup` och 500 kr × multiplikatorn (~1 500 kr). Divisionen ändras aldrig.
  Match-fliken visar matchen före nästa ligamatch med vad som står på spel, Tabell-fliken rundorna under ligan,
  Statistik märker matcherna, lärarens elevpanel visar titlarna och läget.
- **Finalscenen:** introt "FINALEN" över planen, en fullsatt läktare med viftande flaggor (EN `InstancedMesh`),
  skyltar "FINALEN · MÄSTARCUPEN", ett större jubel och sorl (`md-ljud.js final`). **Firandet**
  (`plan.fest(pokal)`, `plan/md-tre-fest.js`): laget samlas vid mittcirkeln, kaptenen lyfter pokalen (Superligans
  guldpokal eller Mästarcupens större silverpokal med guldkanter), fyrverkerier (EN `Points`-mesh) i lugnt tempo
  och en fanfar. Lugnt läge: inga fyrverkerier, inga uppsträckta armar, dämpad fanfar. 2D-reserven har flaggor,
  pokalen och stjärnor som SVG.
- **Legendklubben** (`delat/md-legend.js`, `vy/md-vy-legend.js`): erbjudandet efter den vunna finalen, på
  Match-fliken och vid säsongsslut; formuläret för namn och tröjfärg; först sparas kön av osparade matcher, sedan
  EN skrivning av hela den nya karriären. Säsongerna räknas vidare (pokalernas säsonger blandas aldrig ihop).
  Den gamla klubben blir en rad i `klubbhistorik`, som Statistik visar med märke, säsonger och pokaler.
- **Pokalskåpet** (`vy/md-vy-pokaler.js`, `vy/md-pokal-svg.js`): fem hyllor (divisionsvinst, uppflyttning genom
  kval, Silverpokalen, Superligan, Mästarcupen) med tecknade SVG-pokaler, antal och säsonger; en tom hylla säger
  vad som krävs. Klubbmärket (sköld med initialer, guldkant, stjärnor) står överst och i sidhuvudet.
- **Reglerna:** se nedan. Nyckel **MM** i `BEHORIGHETER.md`.
- **Balansen:** `admin/md-balans-mastarcup.mjs` i `npm run balans:matchdagen`.
- **Förhandsvisningarna:** `preview/preview-matchdagen-pokaler.html` (skåpet och finalscenen utan Firebase) och
  Etapp 3-parametrar i `preview/preview-matchdagen.html` (`?mastare=1`, `?mc=1|final|vunnen`, `&slut=1`, `?legend=1`).

## Tester

- `test/matchdagen-mastarcup.test.js` (node, 22): mästartiteln och inbjudan (inte för tvåan, inte under
  Superligan), schemat 3/6/8, lottningen (styrka, svagast först, samma vid omladdning), hela vägen till pokalen och
  pengarna, straffar (en straffförlust bryter sviten), ingen Mästarcup utan inbjudan eller i fel säsong, **ingen
  flyttas ned** (en hel karriär i Superligan), `mastarcup`-texten = reglernas uttryck, legendklubben (erbjudandet,
  den nya klubben, det som följer med, stjärnorna, en andra legendklubb, taket, trasiga rader), skåpet och
  pokalerna som rader; efter granskningen: `"13-0-u"` nekas och `mcLage` tål det, en legendklubb på servern kastar
  den gamla klubbens kö (vid start och när en match nekas – ingen hybrid), en pågående match i Mästarcupen stoppar
  köp och läger.
- `test/matchdagen-balans.test.js`: Mästarcupen 15–25 % för 80 % rätt med 4★, bättre svar lönar sig.
- `test/firestore-rules-matchdagen-mastarcup.test.js` (emulator, ny, i `npm run test:rules`, 13 – med granskningens
  fall: den gamla truppen oförändrad, historikens ordning, `"13-0-u"`): mästartiteln och
  matchdokumentet, en match i Mästarcupen och finalen med pokalen, `mastarcup` i fel form, de nya pokaltyperna;
  legendklubben sparas (första och andra), nekas utan Mästarcupen den här säsongen, med fel antal stjärnor, utan
  att börja om (division, säsong, kassa, reserver, marknad, tränad trupp), med fel historik (två rader, ingen rad,
  HTML, fel form, en gammal rad ändrad, 51 rader – 49 går), stjärnorna kan inte ändras utan legendklubb, historiken
  kan inte strykas, en ny karriär börjar utan stjärnor och historik, läraren rör bara lagnamnet.
- Uppdaterade: `firestore-rules-matchdagen-cup.test.js` och `-cup-tester-872.test.js` (`mastarcup`/`superliga` är nu
  giltiga pokaltyper; en okänd typ nekas fortfarande), `matchdagen-liga.test.js`, `matchdagen-kval.test.js`.

## Skärmdumpar

`docs/qa-matchdagen-3/`, 1366 × 768 om inget annat står (förhandsvisningarna, huvudlös Chromium med SwiftShader).

| Bild | Vad |
| --- | --- |
| [`01-final-mastarcupen-lyfts-3d.png`](qa-matchdagen-3/01-final-mastarcupen-lyfts-3d.png) | Finalscenen i 3D: silverpokalen lyfts, fyrverkerier, flaggor på läktaren, "MÄSTARCUPEN ÄR ER!" |
| [`02-superliga-mastare-2d.png`](qa-matchdagen-3/02-superliga-mastare-2d.png) | Mästare i Superligan i 2D-reserven: laget samlat, pokalen, fyrverkerier, "MÄSTARE!" |
| [`03-final-lugnt.png`](qa-matchdagen-3/03-final-lugnt.png) | Lugnt läge: inga fyrverkerier, armarna nere |
| [`04-pokalskapet-legend.png`](qa-matchdagen-3/04-pokalskapet-legend.png) | Pokalskåpet (`?legend=1`): fem hyllor, 16 pokaler, två guldstjärnor, pokaler från två gamla klubbar |
| [`05-mc-final-slut.png`](qa-matchdagen-3/05-mc-final-slut.png) | Match-fliken: finalen pågår (2 – 0 efter 88 min) |
| [`06-mc-final-arena.png`](qa-matchdagen-3/06-mc-final-arena.png) | Finalens arena under matchen: flaggor, skyltar "FINALEN · MÄSTARCUPEN" |
| [`07-mc-vunnen-match.png`](qa-matchdagen-3/07-mc-vunnen-match.png) | Efter vunnen Mästarcup: raden "Starta en legendklubb" på Match-fliken |
| [`08-legendklubb-start.png`](qa-matchdagen-3/08-legendklubb-start.png) | "Starta en legendklubb": namn, tröjfärg, "Nej tack – fortsätt i Superligan" |
| [`09-legendklubb-fodd.png`](qa-matchdagen-3/09-legendklubb-fodd.png) | "En ny legend föds!" – Norrsken FF i Division 6, märket med en stjärna |
| [`10-statistik-klubbhistorik.png`](qa-matchdagen-3/10-statistik-klubbhistorik.png) | Statistik för den nya klubben: matcherna märkta "Mästarcupen", rekorden följde med, klubbhistoriken |
| [`11-mobil-pokalskapet.png`](qa-matchdagen-3/11-mobil-pokalskapet.png) | 375 px: Pokalskåpet, alla fem flikar ryms (se Rättat), ingen sidledsscroll |
| [`12-tabell-mastarcupen.png`](qa-matchdagen-3/12-tabell-mastarcupen.png) | Tabell: Silverpokalen och Mästarcupens tre rundor under Superligan |
| [`13-superliga-mastare-3d.png`](qa-matchdagen-3/13-superliga-mastare-3d.png) | Mästare i Superligan i 3D (`?scen=mastare`): guldpokalen lyfts, fyrverkerier, vanlig arena (inga finalflaggor) |

## Balansen (`npm run balans:matchdagen`, Mästarcupen)

400 försök per rad, tre toppklubbar 0,86–0,95 (svagast först), oavgjort → straffar.

| Rätt | Laget | Ute i kvart | Ute i semi | Förlorad final | **Vunnen** | Vinst kvart / semi / final | Straffar | Matcher/försök | Min/försök |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 % | 4★ | 38 % | 25 % | 16 % | **22 %** | 62 / 60 / 58 % | 28 % | 2,0 | 18 |
| 80 % | 5★ | 21 % | 14 % | 18 % | 47 % | 79 / 83 / 72 % | 25 % | 2,4 | 21 |
| 70 % | 4★ | 59 % | 24 % | 10 % | 7 % | 41 / 41 / 39 % | 29 % | 1,6 | 14 |
| 90 % | 4★ | 19 % | 16 % | 16 % | 49 % | 81 / 80 / 75 % | 23 % | 2,5 | 22 |
| 70 % | 5★ | 37 % | 20 % | 21 % | 22 % | 63 / 69 / 51 % | 26 % | 2,1 | 18 |

§12 säger "Mästarcupen vinns sällan, ungefär var femte försök" – gränsen 15–25 % (80 % rätt, 4★) fälls av
`test/matchdagen-balans.test.js`. Superligans, ligans, kvalets, cupens och ekonomins tabeller är oförändrade.

## Kvoten (§13)

Inga nya läsningar och inga lyssnare: Pokalskåpet, klubbmärket och klubbhistoriken läses ur karriären, som redan
läses en gång när Matchdagen öppnas. En match i Mästarcupen är en match (en batch = 2 skrivningar), 0–3 per säsong
(i snitt 2,0 med 80 % rätt och 4★) – de tar ligamatchernas plats i timmen, så eleven under en timme ligger kvar på
**≈ 8 läsningar och ≈ 26 skrivningar** (2c). Legendklubben är EN skrivning (efter kön). Dokumentet växer med högst
~4 kB (klubbhistoriken, 50 rader) och en rad text för Mästarcupen.

## Reglerna och 1000-uttrycksgränsen

- `mastarcup`: `null` eller `'[0-9]{1,5}-([0-3]|[1-3]-u)'` (`MC_MONSTER`), bara när fältet ändras.
- `pokaler`: typerna `superliga` och `mastarcup` i det enda uttrycket.
- `klubb.legendStjarnor` (`mdKlubbOk(k, st)`): exakt det sparade värdet (0 i en ny klubb), +1 bara när
  `klubbhistorik` ändras.
- **Legendklubben** (`mdLegendOk`, bara när `klubbhistorik` ändras): historiken växer med exakt en rad i
  `HISTORIK_MONSTER`s form (de gamla orörda, ≤ 50 rader, ≤ 4 000 tecken), den sparade klubben har en
  `mastarcup`-pokal från den sparade säsongen, och den nya klubben har Division 6, nästa säsong, 600 kr, inga
  reserver, ingen marknad och en **ny** trupp med sju otränade grundpelare (`'trupp' in a` + `mdNyTruppOk`).
  Historiken växer med en rad sist (`h[0:gh.size()] == gh`) och kan inte strykas.
- **Fyndet:** med Coderns första regler nekades legendklubbens skrivning – `validMatchdagen` prövade både de
  vanliga kontrollerna (`mdHeltal` för division och säsong, `mdKassaOk` med summans räkning, `mdReserverOk`,
  `mdMarknadOk`) och `mdLegendOk`, och skrivningen (som en ny klubb + historiken + rekorden) gick över 1000
  uttryck. Ingen test hade sparat en legendklubb mot emulatorn. **Rättat:** `let L = 'klubbhistorik' in a;` – i
  legendgrenen hoppas de vanliga kontrollerna över och `mdLegendOk` prövar samma sak med likheter (`div == 0`,
  `sasong == g.sasong + 1`, `kassa == 600`, `reserver == []`, `marknad == []`). Kassan är nu **exakt** startkassan
  (appen skriver alltid `KASSA.start`, testat).
- **Inte prövat** (eget spel, inga pluggmynt): att mästartiteln, Mästarcupens rundor eller pokalerna stämmer med
  matcherna. En elev som skriver förbi appen kan ge sig själv en inbjudan, en `mastarcup`-pokal och därmed en
  legendklubb (som börjar om från Division 6 med 600 kr – ingen vinning). Ändras inte klubben i den skrivningen
  blir det ingen stjärna.

**Marginalen** (`admin/qa-matchdagen-marginal.test.js` via `admin/qa-matchdagen-marginal.sh`: hur många extra `(d.div == d.div) &&` som ryms i `validMatchdagen` innan
skrivningen nekas, karriärer byggda av de riktiga modulerna; mätt upp till 60). 2c = de slutliga reglerna i
#872 (rapporten Etapp 2), 3 = de slutliga reglerna här:

| Skrivning | 2c | 3 |
| --- | --- | --- |
| Ny klubb (`create`) | 9 | 4 |
| En match | ≥ 60 | 50 |
| Ett träningsläger | 35 | 30 |
| Lägrets start (`"-p"`) | ≥ 60 | ≥ 60 |
| Ett köp | 26 | 22 |
| Ett köp med fulla reserver | 22 | 18 |
| Ett byte | ≥ 60 | ≥ 60 |
| Resten av säsongen med cupen i en skrivning (kön) | 30–35 | 26 |
| Kvalet | 28–30 | 22 |
| **Hela säsongen + cupen + kvalet i en skrivning** (ny klubb offline) | 16–18 | **12** |
| En cupmatch / cupfinalen | ≥ 60 | ≥ 60 |
| Läger + match i samma skrivning | nekas | nekas (oförändrat – Match-fliken väntar på lägret, 2b) |
| **Mästare** (sista matchen i Superligan: pokalen + inbjudan) | – | 50 |
| En match i Mästarcupen / finalen med pokalen | – | ≥ 60 |
| **Legendklubben** (den första) | – | **12** (−1 = nekad med Coderns första regler) |
| Legendklubben med 48 gamla klubbar i historiken | – | 10 |

Etapp 3 kostar 4–9 uttryck i varje skrivning (två nya fält i nyckellistan, `mastarcup`- och legendraderna, `L`).
Den tunnaste är fortfarande en ny klubb (4) – den prövar allt. Mätt på de slutliga reglerna; legendraderna efter
granskningens rättningar. Ett fynd på vägen: `h[0:0]` (en tom del av listan) spräckte gränsen för den första
legendklubben – därför `gh.size() == 0 ||` före jämförelsen.

## Deploy

**`firebase deploy --only firestore:rules` och webben i samma omgång – reglerna först, webben direkt efter.**

- Gamla regler + ny webb: `mastarcup` och `klubbhistorik` är okända fält och `superliga`/`mastarcup` okända
  pokaltyper – sista matchen i Superligan (mästare) och varje match i Mästarcupen blir liggande i den lokala kön, och
  en legendklubb kan inte startas (appen säger "prova igen").
- Nya regler + gammal webb: inget nekas (den gamla webben skriver inga av de nya fälten och har inga stjärnor).
- Inga index, inga functions, ingen datamigrering. Äldre "liga|Vinnare Superligan"-pokaler räknas som Superligan i
  skåpet.

## Val där dokumentet inte räckte till

1. **Inbjudan gäller bara säsongen efter titeln** (`"S+1-0"`); vinner laget Superligan igen bjuds det in igen.
   Mästarcupen spelas efter omgång 3, 6 och 8 – aldrig samtidigt som Silverpokalen, alltid före sista omgången.
2. **Prispengarna 500 kr × multiplikatorn** (~1 500 kr i Superligan) – större än Silverpokalens 200 × mult., i
   samma halverade ekonomi som 2b.
3. **Motståndarnas namn** (`TOPPKLUBBAR`): specens fyra exempel och tolv till med generiska förled (Real, AC,
   Sporting, Dynamo …) och påhittade orter – inga riktiga klubbar.
4. **Legendklubben:** säsongerna räknas vidare (den nya klubbens första säsong är nästa nummer) så att pokalernas
   och rekordens säsonger aldrig blandas ihop; summan, de senaste matcherna, säsongerna och dagarna följer med
   (lärarens historik ska inte försvinna); rekorden följer med men den löpande säsongen nollas (sviterna hör till
   den gamla klubben). "Nollställd kassa" = startkassan 600 kr (som en ny klubb) – med 0 kr kan klubben inte göra
   något i början.
5. **Erbjudandet** visas efter den vunna finalen, på Match-fliken och vid säsongsslut, och gäller resten av den
   säsongen. Ett pågående träningsläger måste göras klart först.
6. **Klubbhistoriken som rader** `"namn|#färg|från-till|liga.kval.cup.superliga.mastarcup"` (ett reguljärt
   uttryck i reglerna, som pokalerna i 2c), högst 50 rader.
7. **Guldkanten** gäller den nuvarande klubben (en legendklubb börjar utan guldkant tills den vinner Superligan).
8. **"Flest ligatitlar i rad"** följs redan av rekorden (2c) – mästartitlarna räknas där.

## Öppna frågor till Elias

1. **Nollställd kassa** = 600 kr (startkassan), inte 0. OK?
2. **Prispengarna** för Mästarcupen: 500 kr × multiplikatorn (~1 500 kr). OK?
3. **Fps på skolans HP-datorer** är fortfarande inte uppmätt (ingen GPU här) – finalscenen har ~98 ritanrop som en
   vanlig match.

## Kända gränser

- Att mästartiteln, Mästarcupen och pokalerna stämmer med matcherna prövas inte i reglerna (eget spel, se ovan).
- Storleken: strängarna i ligans lag, `senaste` och `sasonger` prövas fortfarande inte (F8, 2b); klubbhistoriken
  gör det (≤ 4 000 tecken).

## Så testas det

- **Förhandsvisningen:** `PORT=8873 node server.mjs` →
  - `preview/preview-matchdagen-pokaler.html` (skåpet och finalscenen; `?scen=final|mastare|skap`,
    `?lyft=mastarcup|superliga`, `?2d=1`, `?lugnt=1`, `?fps=1`, `?skap=tomt|fullt|legend`)
  - `preview/preview-matchdagen.html?mastare=1` (sista ligamatchen i Superligan, 3 – 0 i 88:e minuten – spela klart:
    mästare, pokalen lyfts), `?mc=1&vy=tabell` (Mästarcupens rundor), `?mc=final&slut=1` (finalen 2 – 0 i 88:e
    minuten – spela klart: introt, pokalen, legendrutan), `?mc=vunnen` (erbjudandet på Match-fliken →
    "Starta en legendklubb"), `?legend=1&vy=pokaler` (skåpet med två stjärnor), `?legend=1&vy=stat` (klubbhistoriken).
- **Reglerna:** `npm run test:rules` (eller bara Matchdagen: `MDTEST="$(ls test/firestore-rules-matchdagen*.test.js)"
  bash admin/qa-matchdagen-marginal.sh` – rigg med slumpportar, en emulator åt gången; marginalen: `MDTEST=admin/qa-matchdagen-marginal.test.js SCEN=legend,skapa`).

## Körningar (Codern)

| Svit | Resultat |
| --- | --- |
| `node --test` (alla filer som inte kräver emulatorn, 324 st) | 4724 pass, 1 fail (`importera-elever.test.mjs` – kräver emulatorn, "kör mot emulatorn"), 1 skipped – före granskningens tester |
| Matchdagen (`test/matchdagen-*.test.js`) | 309 pass, 0 fail (22 i `matchdagen-mastarcup.test.js`) |
| Matchdagens regeltester (alla 10 `firestore-rules-matchdagen*.test.js`, emulatorn) | 124 pass, 0 fail (13 i `firestore-rules-matchdagen-mastarcup.test.js`) |
| `npm run test:rules` (hela) | 1126 pass, 0 fail (`admin/qa-matchdagen-867-svit.sh test:rules`) |
| `npm run test:functions` | inga filer i `functions/` ändrade – lämnas till Testern (minnet) |
| `npm run test:e2e` | 5 pass, 0 fail (samma rigg) |
| `npm run balans:matchdagen` | 112 s – tabellen ovan |
| Marginalen mot 1000-gränsen | alla skrivningar mätta (tabellen ovan) |
| Bilder per sekund | finalen 20–27 fps (lägst 15), firandet 18–21 (lägst 12), ~98 ritanrop (SwiftShader, 1366 × 768) |

## Rättat av Codern 2 (efter skärmdumparna och regeltesterna)

- **Legendklubben nekades av reglerna** (1000-uttrycksgränsen, se Reglerna) – blocker, rättad och testad.
- **Fem flikar sprängde 375 px:** med Pokalskåpet fick flikraden inte plats (Pokalskåpet klipptes, sidledsscroll).
  Nu smalare flikar i mobil (13 px, 4 px luft) – alla fem på en rad i 375 px, och i 320 px bryts Pokalskåpet till en
  egen rad utan sidledsscroll (mätt).
- **"Sparar …" stod i rött** (felfärgen) medan legendklubben sparades – nu i svag färg, och raden töms när den nya
  klubben är sparad.

## Granskningen (code review på a919a905..arbetskopian) – rättat

- **En legendklubb kunde behålla det tränade laget** (medel, reglerna): truppen prövades bara om den ändrades, och
  legendgrenen krävde inte att den ändrades – `{ ...nyLegendklubb(K), trupp: g.trupp }` gick igenom. Nu kräver
  legendgrenen `'trupp' in a` (och `mdNyTruppOk`). Regeltest.
- **En legendsparning som gick fram efter tidsgränsen** (medel, sparningen): appen trodde att den misslyckades och
  behöll den gamla klubben; nästa match lades "ovanpå servern" och gav en hybrid (Superligan med den nya
  truppen och en stjärna till – och erbjudandet igen). Nu läser legendvyn serverns karriär när sparningen fallerar
  och tar den nya klubben om den finns, och `md-spara.js` kastar den gamla klubbens kö när serverns klubbhistorik är
  längre (vid start och när en match nekas). Samma sak skyddar två datorer. Enhetstester.
- **`"13-0-u"` kraschade Tabell och lärarens elevpanel** (låg–medel, bara förbi appen): `rundor[-1]`. Uttrycket är nu
  `[0-9]{1,5}-([0-3]|[1-3]-u)` i reglerna och `MC_MONSTER`, och `mcLage` behandlar "-u" utan spelad runda som inte
  inbjuden. Tester.
- **En pågående match i Mästarcupen stoppade inte köp och läger** (låg–medel): `hinderMatch` saknade
  `"mastarcup"` (cupen hade det sedan #872). Rättat, enhetstest (fäller utan rättningen).
- **Historikens ordning** (nit): `hasAll` tillät att raderna byttes om; nu exakt prefix `h[0:gh.size()] == gh`.
- **Inte rättat:** en elev som skriver förbi appen kan lägga till en `mastarcup`-pokal och sedan starta en
  legendklubb (+1 stjärna, klubben börjar om i Division 6 med 600 kr) – samma förtroendenivå som pokalerna och
  divisionen sedan Etapp 2, kosmetiskt. Granskaren fann i övrigt inget i motorn (schemat, ordningen mot
  Silverpokalen, ingen nedflyttning, det som följer med en legendklubb, köns pengar), XSS (allt ur dokumentet
  `esc()`:as eller är tal) eller firandets livscykel (`dispose`, lugnt läge).
