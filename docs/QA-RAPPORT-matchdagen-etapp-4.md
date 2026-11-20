# QA-rapport – Matchdagen Etapp 4 (epic #866, #874)

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) §11, §13, §15, §16. Arkitekturen:
[`MATCHDAGEN.md`](MATCHDAGEN.md) §18. Etapp 1–3: [`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md),
[`QA-RAPPORT-matchdagen-etapp-2.md`](QA-RAPPORT-matchdagen-etapp-2.md), [`QA-RAPPORT-matchdagen-etapp-3.md`](QA-RAPPORT-matchdagen-etapp-3.md).

## Sammanfattning

Etapp 4 är byggd: **vänskapsmatcher i realtid** mellan två elever i samma klass som båda har Matchdagen. Fliken
**Vänskap** visar klasskompisarna, utmaningarna (2 minuter), pågående matcher och de inbördes mötena
("Blixtarna IF – FC Omar: 3–1–2"). Varje elev spelar med sitt eget lag; i varje läge väljer anfallaren och
försvararen var sitt drag och svarar på var sin fråga ur **sina egna** frågekällor. **Servern** har frågorna och
facit, rättar svaren (Live:s rättning) och avgör läget med samma motor (synkad till `functions/matchdagen/`); båda
klienterna lyssnar på matchdokumentet och spelar animationen på samma 3D-plan (2D-reserv). Tiden, halvtiden,
walkover efter 3 minuter, klubbkassan (100 + 100 kr, 3 per dag) och de inbördes mötena sköts av servern.

- **Balansen:** lika lag och lika rätt → 36 / 31 / 33 % (vinst a / oavgjort / vinst b), 2,2 mål och 7,3 minuter per
  match; den som svarar bättre vinner oftare (70 % mot 50 % → 52 / 28 / 19 %).
- **Kvoten för en vänskapsmatch:** ~118 callables, ~160 skrivningar och ~430 läsningar på servern, 2 lyssnare per elev
  (§ Kvoten). Solospelet är oförändrat utom EN läsning när Matchdagen öppnas.
- **Reglerna:** klienten skriver ingenting i `mdLobby`, `mdVanskap` (med `privat`/`facit`) och `mdVanskapElev`;
  motståndarens fråga och facit går inte att läsa. `inbordes` i karriären skrivs bara av servern – ETT uttryck
  (`!('inbordes' in a)`); marginalen mot 1000-gränsen minskar med högst en enhet (§ Reglerna).
- **Deploy:** `firestore:rules` → `functions` (`mdUtmana` … `mdGeUpp`) → webben. Inga index.

## Vad som byggts

- **Motorn** `src/matchdagen/delat/md-vanskap.js` (ren, delad med servern): `nyVanskap`, `vLage`, `vSpela` (båda
  svaren och lagbonusarna), halvtid, walkover, resultatet, `spegla`/`vy` (händelsen och planen sett från en elev),
  tiden, inaktivitet, kassan och `inbordesText`. Talen i `VANSKAP` (`md-config.js`), texterna i `md-texter.js`.
- **Synken** `admin/sync-matchdagen-functions.mjs` (`npm run sync:matchdagen`, predeploy för functions, `--check` i
  testerna): motorn och frågekällornas rena kod till `functions/matchdagen/`.
- **Frågebanken på servern** `functions/md-vanskap-fragor.js`: elevens källor (Plugga-områden, tabeller, Räkna) som
  i solospelet, 36 frågor per elev och match, rättningen ur `kistspel-rattning.js` och `rakna-core.js`.
- **Callables** (`functions/md-vanskap-anrop.js`, europe-west1): `mdUtmana`, `mdSvara`, `mdFraga`, `mdSvar`, `mdTick`,
  `mdGeUpp`. Logiken i `md-vanskap-state.js`, `-lobby.js`, `-spel.js`; `functions/index.js` re-exporterar (400 rader).
- **Reglerna:** de tre samlingarna (bara läsning, se § Reglerna) och `inbordes` i `matchdagen/{uid}`.
- **Klienten** `src/matchdagen/vanskap/`: `md-vanskap-moln.js` (callables, två lyssnare), `md-vy-vanskap.js` (lobbyn och
  vakten som räknar in kassan och de inbördes mötena i appens karriär), `md-vanskap-spel.js` (matchvyn). Frågekortet
  `md-svar.js` tar serverns rättning (ett Promise). Fliken finns bara när eleven har en klass med Matchdagen.
- **Läraren:** vänskapsmatcherna i elevens matchlista ("(vänskapsmatch)") och de inbördes mötena i elevpanelen.
- **QA-riggen:** `admin/qa-matchdagen-874-preview.sh` (functions + auth + firestore, slumpportar, Alva och Bilal med
  var sin klubb – `MD_VANSKAP=1` i `admin/qa-matchdagen-867-seed.mjs`); proxyn släpper fram `md*`-callables.

## Tester

| Fil | Vad |
| --- | --- |
| `test/matchdagen-vanskap.test.js` | motorn: lägena, båda svaren, chanserna, mål och räddningar, halvtid, walkover, determinism, spegling, tiden, inaktivitet, kassan, balansgränserna |
| `test/matchdagen-vanskap-server.test.js` | synken (`--check`), frågebanken (källorna, inget facit i frågan, påsen), rättningen |
| `test/functions-matchdagen-vanskap.test.mjs` | serverkärnan mot Firestore-emulatorn med styrd klocka: grinden, en utmaning åt gången, 2 minuter, anta/nej/ta tillbaka, en match åt gången, frågor, rättning, avgörandet, tiden ute, `svar: null`, halvtid, walkover, avbruten, inbördes, kassan och dagstaket |
| `test/functions-matchdagen-vanskap-anrop.test.mjs` | callables som klienten (Auth + Functions + Firestore): utloggad, lärare, elev utan Matchdagen, lobbyn och matchen läses av rätt elever, frågan bara av eleven själv, facit av ingen, ett läge, walkover med kassa och inbördes, sedan nytt lagnamn (hela dokumentet) efter matchen |
| `test/firestore-rules-matchdagen-vanskap.test.js` | reglerna: ingen klientskrivning i duellsamlingarna, läsrätterna (spelarna, eleven själv, läraren, inte klasskamrater utan Matchdagen), `inbordes` bara för servern |
| `test/matchdagen-vanskap-vy.test.js` | lobbyns HTML (escaping, utmaningar, kompisar, inbördes, dagens matcher), vakten (räknar in en gång, läser om när matchen redan var slut), frågekortet med serverns rättning |

## Skärmdumpar

`docs/qa-matchdagen-4/` (appen mot emulatorerna, `admin/qa-matchdagen-874-preview.sh`, två isolerade sidor 1366 × 768: Alva 4a01 och Bilal 4a02):
01 lobbyn, 02 utmaningen hos Bilal, 03 Alvas val (3D), 04 Bilals försvar (3D), 05 Alvas fråga (tabell, flerval, 3D),
06 Bilals läge avgjort när hans tid (30 s) gick ut, 07/08 slutet hos båda (1 – 0, +200 / +100 kr, inbördes 1–0–0 / 0–0–1),
09 lobbyn med inbördes möten, 10 Bilals Räkna-fråga i 2D (`?2d=1`, rättad på servern: "Rätt!"), 11 Alva i 2D,
12 slutet i 2D (inbördes 0–0–2). Två hela matcher spelades till 90:e minuten (en i 3D, en i 2D) med halvtid; kassan i
sidhuvudet och efter omladdning stämde med serverns (Alva 600 → 800 → 1 000, Bilal 600 → 700 → 800).

## Kvoten (§13) – en vänskapsmatch

Se [`MATCHDAGEN.md`](MATCHDAGEN.md) §18.7. Räknat för ~29 lägen (balansen) där båda svarar:

| | Antal |
| --- | --- |
| Callables | ~118 (2 per elev och läge + utmana och svara), + 2 vid halvtid; `mdTick` bara när någons tid går ut |
| Skrivningar (servern) | ~160 (5 per läge: 2 privata vid valet, 2 vid svaret, matchen; start 6 + utmaning 1, slutet 8) |
| Läsningar (servern, i transaktionerna) | ~430 (~14 per läge, start ~15, slutet 5) |
| Lyssnare | lobbyn (bara medan fliken Vänskap är öppen, eller medan en egen utmaning väntar) och matchen – 1 + 1 per elev, ~31 uppdateringar per elev och match |
| Klientens egna läsningar | `mdVanskapElev` 1–2, `classProjections` 1, `privat` 0–1 (tillbaka i en match), karriären 0–1 (bara om en match slutade medan appen öppnades) |

Solospelet: oförändrat, utom EN läsning av `mdVanskapElev/{uid}` när Matchdagen öppnas (för en elev med klass) – en
vänskapsmatch som pågår bevakas då, så att appens nästa sparning inte skriver över serverns kassa.

## Reglerna och 1000-uttrycksgränsen

- `mdLobby/{classId}`: läsning för läraren med klassen (`hasClass`) och för klassens elever som har Matchdagen
  (`isClassMember` + `mdHarMatchdagen`, en `get` av klassdokumentet). Skrivning: aldrig.
- `mdVanskap/{id}`: spelarna (`spelare`) och läraren; ett saknat dokument får varje inloggad hämta (som
  `schackPartier`). `privat/{uid}`: eleven själv och läraren. `facit/{uid}`: bara läraren. `mdVanskapElev/{uid}`: eleven
  själv och läraren (`hasStudent`). Skrivning: aldrig – Admin SDK i callablarna går förbi reglerna.
- `matchdagen/{uid}`: `inbordes` står i `hasOnly`, och `validMatchdagen` nekar en ändring från klienten med ETT uttryck,
  `!('inbordes' in a)` (`a` = de ändrade nycklarna, som redan räknas ut). En ny klubb får inte ha fältet.

**Marginalen** (`admin/qa-matchdagen-marginal.test.js`, extra `(d.div == d.div) &&` som ryms, fina steg 2–30, samma frön):
"före" = reglerna på `cfda7646` (Etapp 3), "efter" = de här, "efter + inbördes" = dokumentet har redan inbördes möten
före och efter skrivningen (`INB=1`):

| Skrivning | Före | Efter | Efter + inbördes |
| --- | --- | --- | --- |
| **Ny klubb** (`create`, den tunnaste) | 5 | **4** | – (en ny klubb har inga) |
| Ett köp | 22 | 21 | 21 |
| Ett köp med fulla reserver | 18 | 17 | 17 |
| Hela säsongen + cupen + kvalet i en skrivning | 12 | 11 | 11 |
| Legendklubben | 13 | 12 | 12 |
| Legendklubben med 48 gamla klubbar | 11 | 10 | 10 |
| Kvalet | 25 | 24 | 24 |
| Resten av säsongen i en skrivning | 28 | 28 | 28 |
| Ett träningsläger | 30 | 30 (grovt) | 30 |
| En match / mästare | 50 / 50 | 50 / 50 (grovt) | – |
| Cup, cupfinal, Mästarcupen, final, lägrets start, byte | ≥ 60 | ≥ 60 (grovt) | – |
| Läger + match i en skrivning | nekas | nekas (oförändrat sedan 2b) | – |

Inbördes kostar **en enhet** i varje skrivning och ingenting extra när dokumentet redan har möten. Ingen skrivning
går över gränsen; den tunnaste (ny klubb) har 4 kvar. ("Grovt" = standardlistan 0, 2, 4 … 60 i den första körningen.)

## Deploy

**`firebase deploy --only firestore:rules` → `firebase deploy --only functions:mdUtmana,functions:mdSvara,functions:mdFraga,functions:mdSvar,functions:mdTick,functions:mdGeUpp`
(predeploy kör `sync:matchdagen`) → webben.** Inga index.

- Regler först: utan dem nekas klientens läsning av lobbyn och matchen (samlingarna finns inte i de gamla reglerna →
  "Allt annat nekas"), och de gamla reglerna nekar en karriär som har `inbordes` – appens nästa sparning (ny match)
  efter en vänskapsmatch skulle nekas. Nya regler + gammal webb: inget nekas (den gamla webben har ingen Vänskap-flik).
- Functions före webben: annars svarar callablarna `not-found`/`internal` och lobbyn går inte att använda.
- **Hela epicen (#866, Etapp 1–4) i en omgång:** `firestore:rules` → `functions` (bara `md*` i den här epicen) → webben.
  Inga index, ingen datamigrering.

## Val där dokumentet inte räckte till

1. **Båda svarar i varje läge** (inga automatiska lägen som i solospelets "deras pass") – det är det som gör matchen
   rättvis och interaktiv, och ger ~29 lägen à ~15 s (7,3 min). Försvararens svar är målvaktens räddning vid ett skott.
2. **En fråga per skott** – ingen finta från Division 3 (lagen kan ligga i olika divisioner).
3. **Inget val i tid** = standardvalet (kort pass / täck); ett uteblivet svar = fel. Elevens klocka tar slut → klienten
   skickar `svar: null` (fel med facit) så att läget kan avgöras direkt.
4. **Walkover:** ställningen står kvar, vinnaren får 100 + 100 kr, förloraren ingenting. Båda borta lika länge →
   **avbruten** (inget resultat, ingen kassa, inga inbördes). En match som ingen spelar längre avslutas när någon av dem
   utmanar eller antar nästa gång (och visas inte i lobbyn efter 20 minuter).
5. **Halvtiden** slutar när båda tryckt "Andra halvlek" eller efter 60 s.
6. **Dagstaket** räknas per Stockholmsdygn i `mdVanskapElev.antal`; fler matcher får spelas men ger inga pengar. En
   walkover-förlust räknas som en spelad match.
7. **Inbördes** sparar också motståndarlagets namn (för texten) – nyckeln är motståndarens uid.
8. **Vänskapsmatcherna rör inte** `summa`, `dagar` eller `senaste` (ligans statistik); läraren ser dem i matchlistan.
9. **Den som utmanade är sidan a** och gör avspark; andra halvleken börjar den andra.
10. **En utmaning per elev** – en ny ersätter den gamla. Lobbyn bevakas även från andra flikar medan den egna
    utmaningen väntar; antas den visas Vänskap med matchen direkt.

## Öppna frågor till Elias

1. **Walkover och kassan:** två elever som samarbetar kan ge den ena 200 kr per match (3 per dag) genom att den andra
   lämnar direkt. Ska en walkover före t.ex. 10 lägen ge pengar? (Lätt att lägga till i `avsluta`.)
2. **Klockan:** den kortaste av 60 s och elevens inställda klocka gäller per elev (två elever kan ha olika tider). OK?

## Kända gränser

- **Karriären i appen och serverns ökningar:** kassan sparas av appen som ett tal. Vakten räknar in varje vänskapsmatch
  som slutar medan Matchdagen är öppen (också i andra flikar), och läser om karriären EN gång om matchen redan var slut
  när vakten startade. Kvar: en elev med osparade solomatcher i den lokala kön (offline) som samtidigt spelar en
  vänskapsmatch i en annan flik/dator kan förlora vänskapsmatchens pengar när kön sparas. Före en utmaning och ett ja
  sparas kön (annars nekas knappen).
- Ett fokuslås eller att läraren stänger av Matchdagen mitt i en match stoppar inte matchen (grinden prövas vid
  utmaningen och starten).
- Fliken byts av eleven mitt i en match → matchen fortsätter på servern; eleven som inte gör något på 3 minuter förlorar
  på walkover. Vänskap öppnar matchen igen.

## Så testas det

- `PORT=8874 bash admin/qa-matchdagen-874-preview.sh` → två webbläsare (eller ett inkognitofönster): 4a01 Alva och 4a02
  Bilal (lilla123) → Matchdagen → **Vänskap**. Alva utmanar Bilal, Bilal antar, båda spelar. `?2d=1` tvingar 2D.
- Reglerna och callables: `bash admin/qa-matchdagen-867-svit.sh test:rules` och
  `bash admin/qa-matchdagen-867-svit.sh functions,auth,firestore "node --test --test-concurrency=1 test/functions-matchdagen-vanskap.test.mjs test/functions-matchdagen-vanskap-anrop.test.mjs"`.
- Marginalen: `INB=1 SCEN=kop,legend MDTEST=admin/qa-matchdagen-marginal.test.js bash admin/qa-matchdagen-marginal.sh`.

## Körningar (Codern)

| Svit | Resultat |
| --- | --- |
| Matchdagen (`node --test test/matchdagen-*.test.js`) | 360 pass, 0 fail |
| `test/behorigheter-doc.test.js` | 4 pass |
| Delade tester (schack, stilar, butik, kurragömma-lärare …) | 526 pass, 1 fail: schackmotorns tidsgräns ("högst ~1 s per drag") under last med emulatorn igång – orörd kod |
| Functions (`functions-matchdagen-vanskap*.test.mjs`, functions + auth + firestore) | 19 pass, 0 fail |
| Nytt lagnamn efter en vänskapsmatch (`functions-matchdagen-vanskap-anrop.test.mjs` test 6: vakten räknar in slutet lokalt, sedan `sparaKarriar`-formen, hela dokumentet) | 6 pass, 0 fail – S.K:s kassa och inbördes = serverns, namnet sparas, inbördes orörda |
| Reglerna (`firestore-rules-matchdagen*`, Coder 1) | 35 pass |
| Marginalen | tabellen ovan |
| Hela `node --test`, `test:rules`, `test:functions` | lämnas till Testern (minnet: OOM-risk, en emulator åt gången) |

## Granskningen (code review på cfda7646..79ce4681) – rättat

- **H1** den som antog fick två matchvyer (lobbyns ögonblicksbild öppnade matchen före callablens svar) – en vakt i `gor`.
- **H2** när elevens eget svar avgjorde läget stängdes kortet innan "Rätt!"/facit visades – kortet stängs inte medan
  svaret är på väg.
- **M1** en match som slutade mellan karriärens läsning och vaktens första ögonblicksbild räknades aldrig in – vakten
  läser om karriären EN gång och jämför antalet inbördes möten.
- **M2** den som utmanade och bytte flik missade starten och förlorade på walkover – lobbyn bevakas medan utmaningen väntar.
- **M3** elevens klocka räknade bort animationstiden – nu högst `tid` från att frågan visas, aldrig förbi serverns gräns.
- **M4** övergivna matcher stod kvar i lobbyn – visas inte efter 20 minuter (servern städar när någon av dem anropar).
- **L1/L2** `mdTick` bara när den egna sidan är klar och den andras tid gått (inte under animationerna); lyssnare tas bort.
- **L5** serverns feltext visas på frågekortet.
- **Inte rättat:** L3 (walkover-kassan – fråga 1 ovan), L4 (lås mitt i matchen – Kända gränser).

## Testern (a1f0f1b4 + testfiler 1ddbc1f6)

Alla punkter **PASS**. Inga fynd som stoppar en merge, bara låga (F1–F4).

| # | Punkt | Resultat |
| --- | --- | --- |
| 1 | Hela sviterna | **PASS**: enhet 4 785/0 (de 327 filer som inte står i något `emulators:exec`-skript – vanlig `node --test` hänger på e2e-auth), `test:rules` 1 151/0, `test:functions` 593/0 (2 todo), `test:e2e` 5/0. Schackets "högst ~1 s per drag" grönt i hela körningen. Bootgrafen 107 (`matchdagen-modul.test.js`). |
| 2 | Synken | **PASS**: `npm run sync:matchdagen` ger ingen diff; en ändrad kopia fäller `--check` (exit 1) och `matchdagen-vanskap-server.test.js`. |
| 3 | Serverrättning och säkerhet | **PASS**: `test/functions-matchdagen-vanskap-tester-874.test.mjs` (12) och `test/firestore-rules-matchdagen-vanskap-tester-874.test.js` (8) – se nedan. |
| 4 | Marginalen | **PASS**, oberoende körning (fina steg 0–32, grova 40–80): ny klubb 4, köp 21, köp fulla reserver 17, säsong+cup+kval 11, legend 12 (48 gamla 10), kval 24, resten av säsongen 28, läger 31, match 58, mästare 52, cup/cupfinal/Mästarcupen/Mästarcupfinal ≥ 65 (vid 70 vägrar kompilatorn reglerna, "too complex"), lägrets start ≥ 65, byte 60, läger + match nekas (som förut). Med inbördes (`INB=1`): samma tal. |
| 5 | Kassan och inbördes | **PASS**: 100 + 100 vid vinst, oavgjort 100/100, dagstaket (också för walkover-förloraren), walkover på millisekunden (179 999 ms pågår, 180 000 ms förlorar den frånvarande, förloraren 0 kr), båda borta → avbruten. "Alvas Blixtar – FC Bilal: 1–1–0" hos eleven, i lobbyn efter omladdning och i lärarvyn; allt escapat (lagnamnen `<i>Alva</i> & 'Co"` och `<img src=x onerror=1>` syns som text överallt). |
| 6 | Två webbläsare | **PASS**: Alva (4a01) – Bilal (4a02), två hela matcher med halvtid: 3D 2–0 (Bilal laddade om mitt i andra halvlek och spelade vidare), `?2d=1` 0–0. Kassan 600 → 800 → 900 / 600 → 700 → 800, samma i sidhuvudet, efter omladdning och på servern. Skärmdumpar `docs/qa-matchdagen-4/t20`–`t27`. |
| 7 | Nytt lagnamn efter en vänskapsmatch | **PASS** i appen: Alva "Sparat!" (vakten räknade in matchen), Bilal sparat efter omladdning mitt i matchen (servern: FC Bilal, kassan 700 och inbördes orörda). |
| 8 | Kvoten | **PASS**: match 2 i nätverkslistan: Alva 29 `mdFraga` + 29 `mdSvar` + `mdSvara` + `mdTick` (halvtid), Bilal `mdUtmana` + 29 + 29 + `mdTick` = 120 callables för 29 lägen – som rapportens ~118 + 2. Skrivningar/läsningar per läge stämmer med koden (5 skrivningar, 14 läsningar; start 6 + 1, slut 8). |

**Attackproven (functions):** den som svarar måste ha Matchdagen (läraren stänger av mellan utmaning och ja → `failed-precondition`, för båda sidor);
elev utanför klassen kan inte utmana i den, svara på dess utmaningar eller bli utmanad; konstiga id:n (`../`, `__x__`) nekas; en match åt
gången även över två klasser; utmaningen gäller 119 999 ms men inte 120 000 ms (och kan då inte tas tillbaka); ingen kan anta sin egen eller
någon annans utmaning. Inget facit lämnar servern före rättningen (mdFraga-svaret, det privata dokumentet och matchdokumentet saknar
facit/bank/answerIndex; Räknas `bild` innehåller bara bildens data – kontrollerat för alla 22 räknesätt, `.scratch/tester/bild-lacka.mjs`).
Förfalskade svar (`{}`, `[]`, `true`, `1.5`, 201 tecken) → `invalid-argument`; index utanför → `{ giltig: false }` utan rättning; ett avgivet
svar går inte att ändra (fel → rätt ger fortfarande fel); svar efter serverns gräns = fel med `tidenUte`, drag efter gränsen nekas;
`mdTick`/`mdGeUpp`/`mdSvar`/`mdFraga` för den som inte spelar → `permission-denied`.
**Attackproven (regler):** listningar och collection group-frågor på `privat`/`facit`, alla matcher, alla spärrar och alla lobbyer nekas
(egen `spelare`-fråga går); en elev med Matchdagen i en annan klass läser inget; lärare utan klassen och utloggade nekas, läraren med klassen
läser men skriver inget; eleven kan inte höja kassan med 100/200 utan bokförd match, inte tömma/byta namn på/nolla/ta bort inbördes (också
via `mergeFields` och `deleteField`), inte skriva en `vanskap`-match själv.

### Fynd

- **F1 (låg)** – Omladdning mitt i en vänskapsmatch öppnar fliken **Match**, inte Vänskap (`src/matchdagen/md-app.js:96`, `S.visa("match")`
  även när `vanskapPagar` hittar en pågående match). Matchen går vidare på servern och klockan tickar – eleven måste själv klicka Vänskap
  (annars walkover efter 3 min). Repro: starta en match, ladda om ena sidan → Match-fliken visas; Vänskap öppnar matchen med rätt
  fråga och återstående tid.
- **F2 (låg, kosmetiskt)** – De inbördes mötena visar motståndarlagets namn från den SENASTE vänskapsmatchen (val 7). Byter kompisen namn
  står det gamla kvar tills nästa match (Alva såg `<img src=x onerror=1>` efter Bilals namnbyte till FC Bilal).
- **F3 (låg)** – Walkover-farmning (öppen fråga 1): två elever kan ge den ena 200 kr per match genom att den andra lämnar direkt, men
  dagstaket håller – högst 3 betalda matcher per elev och dag (600 kr), också den som förlorar på walkover förbrukar sina tre. Bara
  spelpengar; prövat i `dagstaket gäller förloraren också`.
- **F4 (låg)** – En övergiven match (båda borta) står kvar i `mdLobby.matcher` tills någon av dem anropar servern igen (klienten döljer den
  efter 20 min). Lobbydokumentet växer bara med sådana, högst en per elev.
- Info: en elevskrivning som BARA höjer kassan nekas genom att 1000-gränsen nås (inte av logiken) – nekad ändå; ingen appväg skriver så.
