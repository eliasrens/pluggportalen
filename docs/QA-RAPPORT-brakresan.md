# QA-rapport – Bråkresan (#717, epic #705)

Slut-QA av epic-grenen enligt `docs/BRAKRESAN-SPEC.md` §14, §15 och §16. Grenen är testad
med A–K och M (#706–#716, #718, #735) och fixarna för fynden (O #751 = F2, N #750 = F1).
Allt kördes mot Firebase-emulatorerna (Auth + Firestore + Functions, grenens regler och
callables) via `admin/qa-brakresan-preview.sh` och `admin/qa-emulator-proxy.mjs`, i headless
Chromium. Skärmdumpar och kontaktark finns i `docs/qa-brakresan-717/`.

## Sammanfattning

- **Två fynd, båda rättade och verifierade.**
  - F1 (medel): eleven kunde själv skapa och uppgradera husets drake. Rättad i #750 (regel).
  - F2 (låg): texten "null" syntes i ägg-panelen och i omdelningsbilden. Rättad i #751.
- **Automatiska sviter på HEAD är gröna.**
  - Enhetstester: 2735/2736, 1 avsiktlig skip.
  - `test:rules`: 625/625.
  - `test:functions`: 232/232.
  - Generatorgranskningen: 50/50 utmaningar, 10 000 exempel.
  - Boot-grafen: 107 filer, samma som main.
- **Alla 50 utmaningar är spelade i webbläsaren** med riktig server, en hel omgång var.
  Varje omgång har skärmdumpar av uppgiften, ifyllt svar, rätt svar, hjälp före svar, fel svar och resultat.
  Konsolen hade 0 fel.
- **Belöningarna stämmer.**
  - Full progression gav exakt 150 stjärnor och 6 000 stjärnmynt.
  - En fjärde omgång gav 0 mynt.
  - Uppmuntran (6–7 rätt) betalas en gång per utmaning.
  - Avbrutna omgångar ger 0 mynt.
  - Dubbelklick, omladdning och två flikar ger ingen dubbelbelöning.
  - Jakten ger en jaktpost per dag.
- **Fokusläget fungerar** i alla tre fallen i issuen: lås till Bråkresan, lås till annat och dold modul.
- Inga kvarvarande blockerare från QA. Se "Kvar att göra och begränsningar" längst ner.

## Vad som byggts (§16)

- **Elevvyn:** `#/elev/brakresan` visar huvudvyn med alla 50 utmaningar i fem ämnesgrupper.
  - Den har sök, filter, "Börja här" (lärarens rekommendationer), X/150 stjärnor, Y/50
    bemästrade och drakkortet.
  - `#/elev/brakresan?u=NN` öppnar utmaningsvyn: Starta/Fortsätt, Prova ett exempel, tio
    uppgifter, hjälp i fyra steg och resultat med genomgång.
  - Draken finns i drakpanelen (namn, nivå, guldjakt) och i elevens hus. Den kan flyttas,
    vila i Mina djur och öppnas med ett klick.
- **Lärarvyn:**
  - Statistik → klassen → fliken Bråkresan: Översikt, Matris (elev × 50) och Rekommendationer.
  - Material → Bråkresan (`#/larare/brakresan`) är testläget. "Granska" visar tio uppgifter
    med facit, "Spela" kör omgången som en elev. Inget sparas.
- **Servern:** callables `brakresa*` (start, svar, omförsök, avslut, avbryt, ack, namnbyte och
  jakt). Facit finns i `brakresaSecrets`, som ingen klient kan läsa.
- **Fokusläget:** Bråkresan finns i modulregistret (`STUDENT_MODULES`) och är låsbar.
- **Öppna mot emulatorn:** kör `bash admin/qa-brakresan-preview.sh` och logga in som elev1 / lilla123.
  Läraren är qalarare / lilla123. Java och firebase-tools behövs, se skriptets huvud.
  Sätt `JAVA_TOOL_OPTIONS=-Xmx1200m` vid långa körningar (O5).

## Kontroller som körts

| Område | Resultat | Underlag |
| --- | --- | --- |
| Enhetstester (allt utom rules/functions/e2e) | ✅ 2735/2736, 1 skip | `node --test` över 204 filer. Skippen är "demo: en stubbe vägras", som inte gäller längre eftersom alla 50 är byggda |
| Firestore-regler | ✅ 625/625 | `test:rules` + `test/firestore-rules-amneslasning-texter.test.js`, som saknas i npm-skriptet (O6) |
| Cloud Functions | ✅ 232/232 | `test:functions` med egen port-config, en emulator åt gången (`flock`). functions/ är oförändrat efter körningen |
| Matematikmotorn §15 | ✅ | `test/brakresan-math.test.js` (alla specens exempel: 2/4=1/2, 0,50=0,5, 25 %=1/4, …, nämnare 0, 6/8 som enklaste form, 1/3≠0,33) |
| Generatorgranskning | ✅ 50/50, 10 000 exempel | `node admin/qa-brakresan-generatorer.mjs`: 200 seeds per utmaning, egna kontroller i `admin/qa-brakresan/uNN.mjs`, 100 omgångsplaner utan semantiska dubbletter. 05, 13, 34 och 48 har 40–43 kärnor med motiverad `minVariants` (specens talgränser ger inte 60 kärnor) |
| Boot-grafen | ✅ 107 | `admin/qa-bootgraf-bfs.mjs`: HEAD och main har samma 107 filer, alltså inga nya bootfiler |
| En riktig omgång per utmaning, 01–50 | ✅ 50/50 | Elev1 i appen. Svaren lades som elevens utkast, och Kontrollera klickades så att servern bedömde. Resultatskärm visades för alla 50, och konsolen hade 0 fel. Kontaktark `ark-u01/13/25/37/49.png` |
| Resultat 0/6/7/8/10 | ✅ | `ark-res.png`: 10 och 8 ger stjärna +40, 7 ger +10 "Ett rätt till", 6 ger +10 "Två rätt till", 0 ger "Bra att du tränade" + förslag |
| Hjälp och felåterkoppling | ✅ | Hjälpen före svar (steg 1–2) avslöjar inte facit. Felåterkopplingen förklarar elevens svar, t.ex. "Du målade 2/5" |
| Bildkontroller §15 | ✅ stickprov | Cirkeln har exakt lika sektorer (03), tallinjen har rätt antal mellanrum (18: 3, 19: 5), hundrarutan är 10×10 med femlinje (39/41), omdelningen behåller helheten (13/14/34). Facit stämmer i 02, 07–10, 12, 15–19, 21–22, 40, 42, 43, 45 och 46 |
| Tangentbord | ✅ | Tallinjen: Home/→ ger "streck 2 av 3", klick och drag fungerar. Aria-texten avslöjar inget bråknamn. Målning: mellanslag. Sortering: Enter lägger kortet, → flyttar det. Fokus återgår efter hjälpen (komponenttest) |
| Skärmstorlekar | ✅ | 1366×768, 1920×1080, mobil 390×844 och zoom 200 % (683×384): ingen horisontell överflöd i huvudvy, uppgifter (19, 29, 41) eller drakpanel. Panelen scrollar vid zoom |
| Huvudvyn med alla 50 + trestjärnstatus | ✅ | `huvudvy-150-full.png`: 150/150, 50/50, alla kort "Bemästrad". Inga "kommer snart"-rader |
| 15 drakformer i huvudvy och elevhus | ✅ | `ark-kort.png` (ägg + 1–15), `ark-hus.png` (1–15 i ett riktigt rum). Draken står på golvet med skugga och transparent kant. Klick på draken öppnar panelen, klick på golvet gör det inte |
| Reducerad rörelse | ✅ | Med `prefers-reduced-motion: reduce` körs 0 animationer i huvudvy, panel och rum. Utan den körs 2, 4 och 1 |
| Kläckning avbruten | ✅ | Omladdning mitt i kläckningen spelar upp den igen. "Hoppa över" leder till namnfrågan, och när panelen stängs blir levelShown 0→1. Draken, namnet och stjärnorna är oförändrade |
| Lärarvyn | ✅ | Översikt (siffrorna stämmer med spelat), Matris (`larare-matris.png`), individdata, Rekommendation till elev1 → eleven ser "Börja här: 19". Elevnamnet `Bo <b>Svag</b>` visas som text |
| Lärarens testläge muterar inget | ✅ | Ögonblicksbild av hela Firestore (735 dokument) före och efter Granska 34 + en hel testomgång i 03: 0 ändrade |
| Fokusläge | ✅ | Se nästa avsnitt |
| Regression | ✅ | 22 elevsidor (hus, rum, gård, ladugård, by, shop, Plugga, Läsresan, Live, profil, avatar, klasskamrat …) och 10 lärarsidor: 0 konsolfel. Inloggning för elev och lärare fungerar. Mattematchen, Hitta rätt! och Ekvationsresan är opt-in och skickar som väntat eleven till huset |

## Belöningar och gränsfall (§15) – riktiga omgångar via callables

`admin/qa-brakresan-spela.mjs` loggar in som eleven och anropar callables som klienten gör.
Efter varje omgång kontrollerar skriptet utfall, belöning, saldo, stjärnor, drakens nivå, id och namn,
att första svaret är låst och att `finishRound` är idempotent.

| Fall | Resultat |
| --- | --- |
| Tio uppgifter per omgång, alla 50 (`round.tasks.length`) | ✅ |
| Publika uppgifter saknar `key` (facit) | ✅ |
| Första svaret är låst (nytt svar → `already`, samma utfall) | ✅ i 160 omgångar |
| 6/10 → +10 en gång, sedan 7 och 6 → 0, 8 → stjärna +40 (05) | ✅ |
| 0/10 och 5/10 → 0 | ✅ |
| Avbruten omgång (4 besvarade) → 0 mynt, stjärnorna oförändrade | ✅ |
| Full progression: 150 omgångar 10/10 + en fjärde | ✅ 150 stjärnor, 150 belöningsdokument, stjärnmynt 6 000, fjärde omgången "repetition" 0 |
| Draktrösklar 0/9/10/19/20/149/150 | ✅ ägg, ägg, nivå 1 (kläckt), 1, 2, 14, 15. Samma `id` och namn hela vägen. `brakdrake.level` speglar nivån |
| Dubbelklick på Kontrollera, dubbelklick på Se resultatet, omladdning direkt efter och en andra flik som avslutar samma omgång | ✅ exakt +1 stjärna, +40 mynt, ett nytt belöningsdokument (elev1, 19) |
| Jakt från huset + tre samtidiga anrop | ✅ en jaktpost, en belöning, +1 mynt. Övriga fick `already`. Panelen visar "Dagens jakt är redan gjord" |
| Jaktens gränser per nivå, midnatt, sommar/vintertid och klientens klocka | ✅ `test/functions-brakresan-jakt.test.mjs` (en del av 232/232). Kontrollerades inte live |

## Säkerhet

`admin/qa-brakresan-attack.mjs` (riktig klient mot reglerna och callables): **alla prober som väntat**.

- Utloggad: callables ger `unauthenticated`, och läsning nekas.
- Eleven kan inte skriva `brakresa/state` (stjärnor), belöningar, jaktposter eller omgångar.
  Eleven kan inte heller ändra eller ta bort egna omgångar, läsa `brakresaSecrets` eller läsa en
  annan elevs state, omgångar eller belöningar. Svar i en annans omgång ger `not-found`.
- Jaktens klientfält (`amount: 9999`) ignoreras: fyndet blev 24 (nivå 15, max 200).
  Ett namn med HTML rensas till `img src=x onerro`.
- **Efter #750:** eleven kan inte skapa, uppgradera eller ta bort `studentData.brakdrake`.
  Nivå, id och namn nekas, men `pos`/`room`/`stowed` är tillåtna. Huset sparar fortfarande
  drag och vila i Mina djur utan behörighetsfel.
- Läraren (admin) kan läsa elevens state men inte skriva det och inte läsa facit.
  Alla `brakresa*`-anrop ger `permission-denied`.
- Känt och dokumenterat (BRAKRESAN.md §8.2): `studentData.coins` är elevskrivbart i hela appen.

## Fokusläge och klass-lås (item M)

Låset sattes via lärar-UI:t (Klasser → Fokusläge) i en egen klass, så att andra körningar inte störs.

| Fall | Resultat |
| --- | --- |
| Lås till Bråkresan | Menyn visar Hem, Shoppen och Bråkresan. `#/elev/brakresan`, `?u=03` och `?u=12` öppnas. Plugga, Läsresan och Ekvationsresan → `#/elev/brakresan`. Shop och hus är öppna (doljOvrigt av) |
| Lås till Läsresan, bytt live medan eleven står i `?u=03` | Eleven flyttas till `#/elev/lasresan` utan omladdning. `#/elev/brakresan`, `?u=03` och `?u=12` → Läsresan. Bråkresan finns inte i menyn (även vid 390 px). `brakresaStartRound` → `permission-denied` "Din klass har fokusläge på något annat just nu." |
| Klass med dold Bråkresan (`hiddenModules`) | Bråkresan finns inte i menyn, och direktlänkarna → huset. Servern svarar "Bråkresan är stängd för din klass just nu." I målväljaren är "🐉 Bråkresan (dold för klassen)" gråad |
| `#/elev/brakresan/12` | Ingen route → "Hoppsan!" (öppnar inget). Utmaningarna är `?u=NN` |

## Fynd

### F1 (medel) – eleven kunde skapa och uppgradera husets drake – ✅ rättad (#750)

`studentData` är elevskrivbart. En elev med 0 stjärnor skrev `brakdrake = {id, level: 15, name}`
och fick en fullvuxen drake i sitt hus, synlig även för klasskamrater (`hus-fejk.png`).
Stjärnor, mynt och jakt var aldrig påverkade, eftersom de utgår från `brakresa/state`.
Fix: en regel som tillåter elevens ändringar av `brakdrake` bara i `pos`/`room`/`stowed`.
Verifierat i emulatorn: att skapa och att ändra nivå, id, namn eller ta bort nekas, medan drag
och vila fungerar. Regeltesterna är 625/625.

### F2 (låg) – texten "null" i UI:t – ✅ rättad (#751)

`replaceChildren`/`append` gjorde om `null` till texten "null". Det syntes i ägg-panelen
("Drakägget null", `drake-00-panel.png`) och under omdelningsbilden i 13/14/34/47
(`u13-0-start.png`). Efter fixen visar ägg-panelen bara "Drakägget" (`f2-agg-panel.png`).
En textsökning efter null/undefined/NaN i huvudvyn och alla 50 startvyer är ren.

## Observationer (ingen åtgärd krävs för release)

- **O1 – 1366×768:** för större modeller (03, 10, 11, 27, 29, 31 …) hamnar Kontrollera/Visa
  hjälp precis under kanten, så eleven behöver scrolla. Sidan scrollar normalt (§14 uppfylls).
  Mindre marginaler eller mindre modellhöjd vid låg skärmhöjd vore en förbättring.
- **O2 – på main, inte Bråkresan:** efter lärarinloggningen kastar `src/pages-varld.js:76`
  `TypeError: Failed to construct 'URL'`. Felet kommer från den syntetiska
  `HashChangeEvent` utan `oldURL` (`src/teacher-shared.js:384`). Det är ofarligt, men syns i konsolen.
- **O3 – drakens storlek i huset:** nivå 13–15 tar upp ungefär 490–585 × 390–455 px av ett rum
  på 1366×768 (cirka 40 % av bredden, `ark-hus.png`). Nivå 1–7 är 40–210 px. Det är avsiktligt
  enligt #714 (stor drake = stolthet), men nivå 15 skymmer möbler i mitten av rummet. Elias får avgöra.
- **O4 – känd begränsning (§8.1):** en omgång som redan pågår när läraren låser kan i teorin
  avslutas via direkta callable-anrop. Klientens grind stänger vyn.
- **O5 – testverktyg:** `qa-brakresan-preview.sh` sätter `-Xmx384m`. Efter cirka 4 000 anrop
  blev emulatorn långsam och ett anrop fick timeout efter 60 s. Med `-Xmx1200m` var allt stabilt.
- **O6 – testverktyg:** `test/firestore-rules-amneslasning-texter.test.js` (#673, finns på main)
  saknas i `npm run test:rules`. Den kördes separat: 6/6.

## Kvar att göra och begränsningar

- Riktig Chromebook och pekskärm är inte testade. Pekläget är bara emulerat (390×844, mobil)
  med mus- och tangenthändelser.
- Ingen riktig skärmläsare är testad. Aria-texterna är bara granskade (tallinjen, delar, kort).
- Prestanda med CPU-strypning (huset med draken) är inte mätt. Antalet samtidiga animationer
  är litet (1 i rummet, 0 vid reducerad rörelse).
- Midnatt och sommar-/vintertid täcks bara av functions-testerna, inte live.
- Deploy krävs vid release: `firebase deploy --only firestore:rules,firestore:indexes,functions`
  (brakresa*-callables, `validLockShape` med `brakresan` och regeln för `brakdrake`).

## Skript (nya)

- `admin/qa-brakresan-spela.mjs`: spelar riktiga omgångar via callables och kontrollerar
  belöningar, stjärnor och drake efter varje omgång. `all=10,10,10` = full progression.
- `admin/qa-brakresan-attack.mjs`: säkerhetsprober som elev, lärare och utloggad.
