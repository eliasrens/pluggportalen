# QA-rapport – Matchdagen Etapp 1 (epic #866)

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) §16 (rapport efter varje etapp).
Arkitekturen: [`MATCHDAGEN.md`](MATCHDAGEN.md).

## Etapp 1a – moduler per elev och "Anpassningar per elev" (#867)

### Vad som byggts

- **Moduler per elev.** Nytt fält `classes/{classId}.elevModuler = { [uid]: ["matchdagen"] }` och `perElev: true`
  i modulregistret (`STUDENT_MODULES`, `src/gamemode-visibility.js`). Matchdagen är `perElev`, `optIn` och
  `learning`, ligger i "Öva" med en egen SVG-fotboll som ikon och kan bara slås på per elev: den står inte i
  lärarens klassvisa modullista (`TOGGLABLE_MODULES`), och `enabledModules` med `matchdagen` normaliseras bort i
  klienten och nekas i reglerna.
- **Synligheten.** `modulesHiddenForStudent` släpper fram en opt-in-modul när någon av elevens klasser har den i
  `enabledModules` **eller** har eleven i `elevModuler`. Menyn (`ui.js`) och routern (`app.js`) använder samma
  funktion, så en klasskamrat varken ser länken eller når `#/elev/matchdagen` via direktlänk.
- **Fokusläget** stänger Matchdagen som andra inlärningsmoduler (`learning: true`).
- **Regler.** `validElevModuler` (lärare med `hasClass`, ≤ 100 elever, bara klassens elever, bara
  `["matchdagen"]`), `enabledModules` utan `matchdagen`, och `matchdagenInst/{uid}` (läraren med `hasStudent`
  läser/skriver/raderar med validerad form, eleven läser sitt eget).
- **Anpassningar per elev** i Mina klasser → Elever (båda rollerna): en rad per elev med Matchdagen på/av;
  klick fäller ut en panel med alla inställningar i §1.2 (frågekällor: Plugga-områden, tabellerna 0–10 och
  Räkna-områden; svarssätt; klocka; lugnt läge; påminnelse om paus; Återställ lagnamn). Spara skriver
  `elevModuler` och `matchdagenInst/{uid}` i en batch.
- **Elevens sida** `#/elev/matchdagen`: en platshållare i skissens kvällsarena som visar vilka frågor läraren
  valt, eller "Din lärare har inte valt några frågor än". Den läser `matchdagenInst/{uid}` en gång.
- Spec och skiss kopierade: `docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md` (LF) och `preview/preview-matchdagen-skiss.html`.
- Docs: `DATAMODELL.md`, `BEHORIGHETER.md` (nyckel MI), `LARARSIDAN_STRUKTUR.md`, `LARARSIDAN_INVENTERING.md`,
  nytt `MATCHDAGEN.md`.

### Tester

- `test/matchdagen-modul.test.js` (node): registret, `normalizeElevModuler`, synligheten (vald elev ser,
  klasskamrat och elev i annan klass ser inte, lista i fel klass räknas inte, `enabledModules` slår inte på den),
  fokuslåset, `md-inst.js` (standard, normalisering, rundresa, saknade frågor), bootgrafen 107 och
  `import()`-laddningen, panelens alla inställningar och 400-radersgränsen.
- `test/firestore-rules-matchdagen-inst.test.js` (emulator, i `npm run test:rules`): `elevModuler` (skrivare
  admin/årskurskonto med och utan klassen/avstängt, elev nekas, formen, oförändrad map, 100/101 elever),
  `enabledModules` utan `matchdagen`, `matchdagenInst` läs/skriv per roll, formen och lärarpanelens batch.
- Uppdaterade: `test/module-visibility.test.js` (opt-in-listan), `test/lararsida-mina-klasser.test.js`
  (Elever-flikens sektioner).
- Resultat: se avsnittet *Körningar* nedan.

### Skärmdumpar

Tagna i förhandsvisningen mot emulatorn (`admin/qa-matchdagen-867-preview.sh`), årskurskontot `qaarskurs4`:

| Bild | Vad |
| --- | --- |
| [`01-larare-anpassningar-alva-1366.png`](qa-matchdagen-1a/01-larare-anpassningar-alva-1366.png) | Mina klasser → 4A → Elever → Anpassningar per elev, Alvas panel efter Spara (Matchdagen på, Vikingatiden, tabell 3 och 7, Räkna: addition, klocka 30 s) |
| [`02-elev-alva-matchdagen-1366.png`](qa-matchdagen-1a/02-elev-alva-matchdagen-1366.png) | Alva: Matchdagen med fotbollsikonen under Öva och platshållarsidan med hennes frågor |
| [`03-elev-bilal-utan-matchdagen-1366.png`](qa-matchdagen-1a/03-elev-bilal-utan-matchdagen-1366.png) | Bilal (samma klass): ingen Matchdagen i menyn; direktlänken skickade honom hem |
| [`04-larare-panel-375.png`](qa-matchdagen-1a/04-larare-panel-375.png) | Panelen på 375 px (ingen sidledsscroll) |

Också kontrollerat i webbläsaren: panelen läser tillbaka det sparade efter omladdning, och när 4A låstes till
Vikingatiden försvann Alvas Matchdagen-länk och `#/elev/matchdagen` gick till målet (låset hävt efteråt).
(Emojiikonerna i menyn är rutor i den huvudlösa webbläsaren – den saknar emojitypsnitt; inget med #867 att göra.)

### Deploy

1. `firebase deploy --only firestore:rules` (nya `elevModuler`-regeln, `enabledModules` utan `matchdagen` och
   samlingen `matchdagenInst`) – **före** webben, annars nekas lärarens Spara.
2. Webben (Pages).

Inga index och inga functions i 1a.

### Kvoten (1a)

Inga nya läsningar i heta flöden: `elevModuler` ligger på klassdokumentet som menyn redan läser (TTL-cache). En
getDoc när eleven öppnar Matchdagen, en när läraren fäller ut en elev, en batch med två skrivningar per Spara.
Tabell i `MATCHDAGEN.md` §4.

### Val där dokumentet inte räckte till

1. **`perElev` = bara per elev.** En `perElev`-modul står inte i `TOGGLABLE_MODULES` (klassens av/på) utan i
   `PER_ELEV_MODULES`; `moduleForRoute` grindar alla modulers rutter (även per elev). Klasskolumnen "class-enabled
   ELLER listad" finns kvar i synlighetsfunktionen men kan aldrig bli sann för Matchdagen.
2. **Inte låsmål.** `lockable: false` (som Schack): klassen kan inte låsas *till* en modul som bara vissa elever
   har. `validLockShape` är oförändrad. Den går att välja under "Välj själv" efter ett prov (#788) men syns ändå
   bara för de valda eleverna.
3. **`elevModuler` på klassdokumentet** som specen säger. Klassdokumentet läses av alla inloggade, så en elev med
   utvecklarverktyg kan se vilka klasskamrater som har Matchdagen (samma kända begränsning som provets `extraTid`,
   `PROV.md`). Inställningarna (`matchdagenInst`) ligger per elev och läses bara av eleven själv och läraren.
4. **Regelns form för `elevModuler`.** Reglerna kan inte loopa över mapen: värdena prövas med
   `values().hasOnly([['matchdagen']])` och nycklarna med `keys().hasOnly(studentIds)`. Bara en *ändrad* map
   valideras, så en elev som tagits ur klassen stoppar inte andra klass-skrivningar; klienten rensar bort hen
   nästa gång läraren sparar (hela mapen skrivs med `updateDoc`).
5. **"Lärarens synliga områden"** = biblioteket som läraren redan ser i Vad eleverna ser (alla ämnen), grupperat per
   ämne i hopfällbara rutor. Klassens tilldelade och redan valda områden står överst och deras ämnen är utfällda,
   så listan blir kort i praktiken. Plugga = områden med quiz eller par, Räkna = områden med generator
   (`areaContentFlags`, samma grind som elevens lägen).
6. **Räkna-ämnen** väljs per **område** (alla områdets räknesätt), inte per räknesätt. Sparas som
   `rakna: ["ämne/område"]`.
7. **Återställ lagnamn** visas men är avstängd med förklaringen "Går att använda när eleven har startat sitt lag" –
   `matchdagen/{uid}` och regeln för lagnamnet kommer i Etapp 1c.
8. **Matchdagen av men inställningarna kvar.** Att stänga av sparar ändå panelens val i `matchdagenInst`, så de finns
   kvar om läraren slår på igen.
9. **Platshållarsidan** visar antal källor (inte områdesnamn) för att inte läsa områdesdokument; typsnittet Barlow
   Condensed laddas inte än (systemets smala typsnitt som reserv) – det kommer med matchvyn i 1c.
10. **Radgränsen.** `src/gamemode-visibility.js` (486 → 532 rader) och `src/app.js` (407 → 409) låg redan över 400
    rader före #867. Per-elev-logiken måste ligga i bootfilen (menyn och routern), och en ny bootfil är förbjuden
    (#271), så de växte i stället för att delas. Alla nya filer är under 400 rader.

11. **Hela `elevModuler` skrivs om** vid varje Spara (ur lärarens inlästa klass). Två lärare som sparar samma klass
    exakt samtidigt kan skriva över varandras på/av – osannolikt med en lärare per klass; en fältväg per elev
    (`elevModuler.<uid>`) skulle kräva att reglerna prövar bara ändrade nycklar. Har admin tagit en elev ur klassen
    efter att sidan laddades nekas Spara ("Kunde inte spara") tills sidan laddas om.
12. **Sparade områden som inte syns** i panelen (borttagna eller utan quiz/par/generator just nu) behålls vid Spara i
    stället för att tyst försvinna; frågekällorna (1b) hoppar över det som saknas.

### Så testas det (förhandsvisning mot emulatorn)

```
PORT=8867 bash admin/qa-matchdagen-867-preview.sh          # Firestore/Auth på slumpportar
```

1. Logga in som lärare `qaarskurs4` / `lilla123` → Mina klasser → 4A → Elever → **Anpassningar per elev**.
2. Klicka **Alva**, kryssa i **Matchdagen**, välj t.ex. tabellerna 3 och 7 och ett Räkna-område → **Spara**
   ("Sparat ✓ …"). Raden visar "Matchdagen på".
3. Logga ut, logga in som eleven `4a01` (Alva) / `lilla123`: **Matchdagen** med fotbollsikonen står under Öva;
   sidan säger "Dina frågor kommer från tabellerna 3 och 7 samt ett Räkna-område."
4. Logga in som `4a02` (Bilal, samma klass): ingen Matchdagen i menyn, och `#/elev/matchdagen` skickar hem
   ("Den delen är stängd för din klass just nu.").
5. Fokusläge: lås 4A till ett område → Alvas Matchdagen-länk försvinner och direktlänken går till målet.

`MD_PA=1` i förhandsvisningen slår på Matchdagen för Alva redan i seeden.

### Körningar

Testaren (867-tester) på 6bcd320, rigg `admin/qa-matchdagen-867-svit.sh` (npm-sviterna på slumpportar med
`FUNCTIONS_EMULATOR_HOST`, en emulator åt gången):

| Svit | Resultat |
| --- | --- |
| `node --test` (filerna utan emulator) | 4443 pass, 0 fail, 1 skipped (`importera-elever.test.mjs` kräver emulatorn och körs inte här) |
| `npm run test:rules` | 1015 pass, 0 fail |
| `npm run test:functions` | 573 pass, 0 fail, 2 todo |
| `npm run test:e2e` | 5/5 |
| Elever-stubbe e2e | `qa-elever-admin` 64/64, `qa-mina-klasser` 59/59 |
| I appen mot emulatorn | PASS: lärare slår på för Alva → Alva ser Matchdagen, Bilal inte; fokuslåset stänger den; reglerna nekar |

En tidigare körning av `test:functions` gav 416/157 (`internal` från callablarna). Den saknade
`FUNCTIONS_EMULATOR_HOST` med egna portar – miljön, inte #867 (inga filer i `functions/` är ändrade).

### Noteringar

- **N1.** `src/gamemode-visibility.js` är nu 532 rader och `src/app.js` 409; båda låg över 400 redan före #867
  (se val 10).
- **N2.** "Sparat ✓"-sammanfattningen visade inte pauspåminnelsen. Rättat: den visas när den avviker från
  standarden 60 min ("paus 30 min", "paus av"), som klockan och lugnt läge.

## Etapp 1b – frågekällorna, den rena matchmotorn och balansen (#868)

### Vad som byggts

- **Frågekällorna** (`src/matchdagen/md-fragor.js`, `md-kallor.js`, spec §2): en frågeström ur `matchdagenInst`.
  Plugga-områden ger quiz utan passage (`plainQuizPool`) och par som "Vad betyder X?". Giltigheten kommer från
  `omradetsSaker` i provet. Multiplikationen använder Live-läget `multiplication_0_10`, begränsat till de valda
  tabellerna. Räkna använder `rakna-core.js`. Källorna blandas jämnt med `createTopicBag`, och varje källa har en
  egen påse i `localStorage` som inte upprepar något förrän källan är slut. Saknas källor visas "Din lärare har
  inte valt några frågor än".
- **Frågekortet** (`md-svar.js`): stora knappar och tangenterna 1–6, eller skriv själv med Enter. Rätt svar blir
  grönt. Fel svar visar det rätta svaret i 1,5 s. Klockan på 30/60 s räknar en tid som har gått ut som fel.
- **Matchmotorn** (`src/matchdagen/delat/md-motor.js`, §3): en ren tillståndsmaskin med klocka och halvlekar.
  Den har våra val med sannolikhetstabellen, skotten med formeln, hörna efter räddning, motståndarens
  automatiska pass, Tackla/Täck och "Kan målvakten rädda?", avspark och inspark, kommentatorn (`md-texter.js`) och
  statistiken per match (§3.6). Kroken för två frågor per skott från Division 3 (§7.3) och `lagbonus` (§8.1) är
  också med. Straffarna kommer i 2a.
- **Ligan** (`md-liga.js`): round robin med cirkelmetoden, `styrkaFor(div)`, `simMal` och tabellen (poäng,
  målskillnad, gjorda mål).
- **Alla tal** står i `md-config.js`.
- **Balansen:** `admin/md-balans-sim.mjs` och `npm run balans:matchdagen`, med testet
  `test/matchdagen-balans.test.js`.
- **Tester:** `test/matchdagen-motor.test.js` (val, skott, hörnor, tacklingar, räddningar, klocka, halvtid,
  determinism), `test/matchdagen-liga.test.js` (schemat för 6/8/10/12 lag, tabellen, renheten och tal bara i
  config) och `test/matchdagen-fragor.test.js` (källorna, påsen, blandningen och de saknade frågorna).
- **Förhandsvisning:** `preview/preview-matchdagen-fragor.html` visar frågekortet och motorn som en textmatch,
  utan plan (`PORT=8868 node server.mjs`).
- **Docs:** `MATCHDAGEN.md` §5–§9.

### Balansen (Division 6, 1 000 säsonger per rad)

| Rätt | Vinst | Oavgj. | Förlust | Ligan | Mål/match | ≥1 eget mål | Förlust ≥4 | Skillnad ≥6 | Match (min) | Säsong (min) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 70 % | 61 % | 25 % | 14 % | 59 % | 2,56 | 87 % | 0 % | 0,0 % | 7,0 | 46 |
| 50 % | 34 % | 30 % | 36 % | 14 % | 2,38 | 73 % | 0 % | 0,0 % | 7,0 | 47 |
| 30 % | 12 % | 24 % | 64 % | 1 % | 2,39 | 53 % | 2 % | 0,0 % | 7,0 | 47 |

Alla mål i §12 för Division 6 nås. Med specens startvärden vann 70 %-eleven 16 %, matchen hade 0,8 mål och tog
4 minuter. Vilka tal som ändrades och varför står i `MATCHDAGEN.md` §7. Raderna för Superligan och Mästarcupen
(§12, rad 3) hör till Etapp 2–3.

### Skärmdumpar

| Bild | Vad |
| --- | --- |
| [`qa-matchdagen-1b/fragekort-flerval-fel-1366.png`](qa-matchdagen-1b/fragekort-flerval-fel-1366.png) | Multiplikation, flerval, fel svar med tangent 1: valet rött, det rätta grönt, "Rätt svar: 8" (1366 × 768) |
| [`qa-matchdagen-1b/fragekort-vad-betyder.png`](qa-matchdagen-1b/fragekort-vad-betyder.png) | Ett par från ett Plugga-område som "Vad betyder socken?" med klockan på 30 s |
| [`qa-matchdagen-1b/fragekort-rakna-klocka-bild-1366.png`](qa-matchdagen-1b/fragekort-rakna-klocka-bild-1366.png) | Räkna-räknesättet klocka: urtavlan från `matte-visuals.js` och tipset "Svara med klockslag" (1366 × 768) |
| [`qa-matchdagen-1b/fragekort-skriv-rakna-klocka.png`](qa-matchdagen-1b/fragekort-skriv-rakna-klocka.png) | Räkna, skriv själv, fel svar: "Rätt svar: 585", klockan räknar ned |

### Körningar (Codern, c82fa3e)

| Svit | Resultat |
| --- | --- |
| `node --test` (filerna utan emulator, 306 filer) | 4500 pass, 0 fail, 1 skipped |
| Matchdagen 1b (`test/matchdagen-{motor,liga,fragor,balans}.test.js`) | 57 pass, 0 fail (ingår ovan) |
| `npm run test:rules` (`admin/qa-matchdagen-867-svit.sh`) | 1015 pass, 0 fail |
| `npm run test:functions` (samma rigg, `FUNCTIONS_EMULATOR_HOST`) | 573 pass, 0 fail, 2 todo |
| `npm run test:e2e` | 5/5 |
| `npm run balans:matchdagen` | alla rader "ja" (tabellen ovan) |
| Bootgrafen | 107 filer (oförändrad, `test/matchdagen-modul.test.js`) |
| Förhandsvisningen i webbläsaren | flerval (tangent 1, fel, facit), "Vad betyder X?", skriv själv med klocka, Räkna-klocka med bild, inga källor; inga konsolfel |

### Deploy

Ingen. Det finns inga regler, index, functions eller nya samlingar. Motorn och källorna används först i 1c.

### Kvoten (1b)

Inga Firestore-läsningar eller -skrivningar i 1b. Påsen ligger i `localStorage`. I 1c läser strömmen varje valt
område en gång när Matchdagen öppnas, via `getArea` med cache (samma läsning som Plugga). Det tas med i 1c:s
budget (§13).

### Val där dokumentet inte räckte till

1. **Balansen ändrade tio grupper av specens tal** (`MATCHDAGEN.md` §7). Specens 8–10 lägen per halvlek och 6–8 minuter per match
   går inte ihop när ett svar tar 8–12 s. Därför gäller §12, och klockan går 1,8–2,9 minuter per läge, vilket ger
   ~19 lägen per halvlek och ~28 frågor per match. Ett fel svar på ett kort pass lyckas nu i 60 % av fallen (specen
   har 25 %) och ett skott efter fel svar går in i 15 % (specen har 3 %), dock aldrig oftare än ett rätt svar från samma avstånd (F1 nedan). Annars når 30 %-eleven aldrig målet "minst
   ett mål i hälften av matcherna". Rätt svar ger fortfarande mest: 0,90 mot 0,60 för pass och 0,50 mot 0,15 för
   skott från 20 m. Styrkeformeln för divisionerna är oförändrad.
2. **Tidsmodellen:** "varje svar räknas som 8–12 sekunder och animationerna ingår" tolkas som 8–12 s per svar,
   plus 2 s för valet och skissens animationer (`TID.anim`, 1–4,5 s per händelse). Halvtiden räknas som 12 s,
   rutorna runt en match som 30 s och ett träningsläger som 8 frågor + 30 s (säsongslängden §12).
3. **Robotarnas spelstil** (`ROBOT` i simuleringen) är ett antagande: de skjuter vid "Bra läge", och på egen
   planhalva spelar de kort, långt och dribblar 40/40/20.
4. **Hörna** blir det bara efter en räddning vid rätt svar, som specen säger. Skissen gav hörna efter alla missar
   vid rätt svar. En hörna är ett vanligt anfallsläge på x = 92 med "Hörna till oss! Bollen slås in högt." och
   `horna: true` för 1c:s höga boll.
5. **Deras planhalva** = `x ≥ 50` (specen säger "på motståndarens planhalva", skissen har 55). Deras avspark från
   mitten blir alltså ett automatiskt pass.
6. **Andra halvlek:** laget som inte gjorde avspark i första halvleken börjar, det vill säga motståndarna, som i
   skissen.
7. **Multiplikation är EN källa** för alla valda tabeller. Annars skulle nio valda tabeller och ett område ge 90 %
   multiplikation. `perKalla` räknas ändå per tabell (`tabell:7`), som `kallNycklar` i 1a.
8. **Live-läget `createSource` används inte.** Det kan inte begränsas till vissa tabeller och har ingen påse som
   går att spara. Frågan kommer i stället ur samma motor (`makeQuestion`), och Live-lägets `choices`/`checkAnswer`
   ger alternativen och rättningen.
9. **Svarssätt per källa:** Plugga-områden är bara flerval (quiz har alternativ, par blir flerval). Räkna är bara
   skriv själv, eftersom generatorn saknar felalternativ. Multiplikationen följer lärarens val.
10. **Passagefrågor tas aldrig med**, inte heller via `plainQuizPool`s reserv, som ger hela poolen när alla frågor
    har passage. Matchdagen visar ingen källtext.
11. **Valda områden som saknas eller är tomma** ger ett eget meddelande: "Frågorna din lärare valt går inte att
    hitta just nu. Säg till din lärare!" Ingen match kan startas.
12. **Räkna-påsen:** generatorn tar aldrig slut. Därför sparas bara hur många uppgifter som har dragits, och nästa
    session startar en ny ström med ett frö ur det talet. Det blir inga upprepningar i praktiken.
13. **`createQuestionFlow` passade inte**, eftersom det skickar varje svar till servern och tar sina frågor ur ett
    GameMode. `md-svar.js` har samma beteende. Vid flerval får kortet fokus, inte första knappen, så att Enter
    inte råkar svara 1.
14. **`md-prng.js`** är en egen kopia av `kg-prng.js`, eftersom `delat/` bara importerar inom `delat/` och ska
    kunna kopieras till `functions/` i Etapp 4.
15. **game-shared.js i node:** den drar in Firebase och DOM. Testet byter den mot en modul med de riktiga
    `plainQuizPool`/`hasPassage`, utklippta ur källkoden. Förhandsvisningen stubbar den med importmap.
16. **Visuella Räkna-uppgifter** (klocka, statistik, sannolikhet och koordinatsystem) får sin bild ur
    `matte-visuals.js` och samma tips om svarsformatet som i Räkna. Granskningen hittade att de annars inte gick
    att besvara. Kladdytan från Räkna finns inte på frågekortet.
17. **Räkna-strömmens frö** blandar in sessionens slump. Annars skulle en elev med blockerad `localStorage` få
    samma uppgifter i varje match.

### Rättningsrunda 1 (testarens fynd på f4422a5)

- **F1 (medel), rättat.** Ett fel svar på ett långskott gav större målchans än ett rätt svar, eftersom
  `SKOTT.fel` (0,15) var platt. Vid 44 m gav fel svar 15 % och rätt svar 2,7 %. Nu ger fel svar
  `min(SKOTT.fel, chansen vid rätt svar från samma avstånd)`. Testarens F1-test
  (`test/matchdagen-tester-868.test.js`) är inte längre todo. Balansen efteråt, med 1 000 säsonger:
  70 % vinner 61 % och ligan 59 %, 50 % vinner 34 %, 30 % gör minst ett mål i 53 % av matcherna. Alla mål nås.
- **F2 (låg), rättat.** Skriv själv-kortet flödade över vid 375 px: `scrollWidth` 543 och Svara-knappen utanför
  skärmen. Fältets egen bredd (size=20) gav kortet en minsta bredd. `.md-fraga-input { width: 0 }` löste det,
  nu är `scrollWidth` 375 och Svara slutar vid 341 px.

## Etapp 1c – 3D-planen, matchvyn, säsongen i Division 6, sparning och statistik (#869)

Med 1c är **Etapp 1 klar**: en vald elev skapar en klubb och spelar en hel säsong i Division 6 i 3D (eller
2D-reserven), framstegen sparas, och eleven och läraren ser statistiken. Arkitekturen står i `MATCHDAGEN.md`
§10–13.

### Vad som byggts

- **3D-planen** (`src/matchdagen/plan/`, spec §4): three.js ur `src/vendor/three/` via den nya delade
  `src/tre/tre-ladda.js` (`harWebGL`/`laddaThree` utbrutna ur Kurragömmas `kg-tre.js`, som re-exporterar dem –
  Kurragömmas beteende och tester oförändrade). Plan med gräsränder och linjer, mål med nät som buktar vid mål,
  reklamskyltar PLUGGPORTEN/MATCHDAGEN, läktare med publik, kvällsljus. 7 spelare per lag av enkla former med
  springanimation, målvakter i egna färger, blob-skuggor, kaptensbindel och elevens avatar som bricka över
  kaptenen. Bollen rullar, går i båge eller flyger mot mål efter motorns händelse. Tv-kamera från långsidan som
  följer bollen och zoomar kort vid mål; "MÅÅÅL!", "RÄDDNING!", jubel, firande och vissla. three laddas först
  när matchen startar.
- **2D-reserven** (`md-plan-2d.js`): planen ovanifrån i SVG som skissens första version – utan WebGL, om three
  inte laddas och med `?2d=1`. Samma ritar-gränssnitt, så matchen är identisk.
- **Lugnt läge** (`matchdagenInst.lugnt`) och `prefers-reduced-motion`: fast kamera, ingen zoom eller
  skakning, spelare och boll hoppar direkt, inget jubel eller sorl.
- **Ljud** (`md-ljud.js`): Web Audio utan ljudfiler (vissla, spark, jubel, räddning, sorl), knappen
  "Ljud på/av" kommer ihåg valet.
- **Säsongen** (`delat/md-sasong.js`, ren): ny klubb (namn 1–24 tecken, 8 tröjfärger), sju grundpelare med
  färdiga namn, 6 lag med påhittade motståndare (66 namn) och dold styrka, cirkelmetoden, övriga matcher med
  `simMal`, tabellen (3/1/0, poäng → målskillnad → gjorda), kassan, rutan före avspark ("Säsong 1 · Division 6 ·
  Omgång 2 av 5"), rutan efter matchen (resultat, rätt svar, skott, lyckade pass, kronor) med "Till tabellen"
  eller "Se hur säsongen slutade", och nästa säsong.
- **Fortsätta senare:** den pågående matchen sparas i `localStorage` efter varje läge; efter omladdning visar
  Match-fliken "Matchen pågår: 0 – 0 efter 4 minuter. Fortsätt matchen".
- **Sparningen** (`md-data.js`): `matchdagen/{uid}` läses en gång när Matchdagen öppnas; efter varje match EN
  batch (karriären + `matcher/{id}`). En match som inte gick att spara ligger kvar lokalt och sparas om.
- **Regler** för `matchdagen/{uid}` och `matcher/{id}` (spec §6.1) med tester.
- **Elevens app** (`md-app.js`, `vy/`): sidhuvud med klubbkassan, flikarna Match, Tabell, Truppen (döp om
  laget, tröjfärg, startelvan) och Statistik (siffror, rätt per källa, de 20 senaste matcherna med detaljer,
  säsongerna, pokalskåpet). Kvällsarenan med Barlow Condensed + Nunito. Halvtid med paus, pauspåminnelsen ur
  `matchdagenInst.paus`.
- **Läraren:** underfliken **Matchdagen** i Hur går det? (bara när någon elev har Matchdagen), tabell per elev,
  klick → senaste matcherna, veckolinje och **Återställ lagnamn** (också kopplad i 1a-panelen).
- **Förhandsvisningen** `preview/preview-matchdagen.html` med stubbad data (`?vy`, `?omg`, `?klubb=ny`, `?2d=1`,
  `?lugnt=1`, `?fps=1`, `?auto=1`).

### Skärmdumpar

Tagna i appen mot emulatorn (`MD_PA=1 admin/qa-matchdagen-867-preview.sh`), Alva (4a01) och `qaarskurs4`.
Fönstret 1366 × 657 är vad en 1366 × 768-skärm visar i Chrome (flikar, adressfält och aktivitetsfält borträknade).

| Bild | Vad |
| --- | --- |
| [`01-match-3d-1366.png`](qa-matchdagen-1c/01-match-3d-1366.png) | Match i 3D med appens sidomeny: skylt, plan, kommentar och frågekort syns utan scroll (1366 × 657) |
| [`02-match-2d-1366.png`](qa-matchdagen-1c/02-match-2d-1366.png) | Samma app med `?2d=1`: 2D-reserven i SVG |
| [`03-efter-matchen.png`](qa-matchdagen-1c/03-efter-matchen.png) | Rutan efter matchen: "Förlust – nästa gång! 0 – 1", 12/30 rätt, 1 skott, 7/14 pass, +260 kr |
| [`04-tabell.png`](qa-matchdagen-1c/04-tabell.png) | Tabellen efter omgång 1, eget lag markerat |
| [`05-truppen.png`](qa-matchdagen-1c/05-truppen.png) | Truppen efter lärarens återställning: namnet är "Pluggporten FC" |
| [`06-statistik-elev.png`](qa-matchdagen-1c/06-statistik-elev.png) | Elevens Statistik |
| [`07-larare-matchdagen.png`](qa-matchdagen-1c/07-larare-matchdagen.png) | Lärarens Hur går det? → Matchdagen med Alvas rad, historik och Återställ lagnamn |

### Bilder per sekund

| Miljö | Upplösning | Resultat |
| --- | --- | --- |
| Huvudlös Chromium med **SwiftShader** (WebGL i mjukvara på CPU:n, lastad server) | 1366 × 768, appen med sidomeny | **24,7 fps i snitt, lägst 15** (`?fps=1`), pixelvakten sänker pixeltätheten till 0,6 |
| Samma, förhandsvisningen (Codern före) | 1366 × 768 | 20–32 fps, 94–103 ritanrop per bild |

**Specens krav, ≥ 50 fps på skolans HP-datorer, är inte uppmätt** – den här miljön har ingen GPU, så siffran
ovan är ett golv för mjukvarurendering, inte HP-datorns. Vad som gjorts för att nå kravet: ingen kantutjämning,
pixeltäthet högst 1,5, pixelvakten (fps < 45 → ×0,75, aldrig under 0,6), figurerna sammanslagna med
vertexfärger till 6 ritanrop per spelare och ett delat material (≈ 100 ritanrop för hela scenen). **Mät på en
HP-dator:** öppna `#/elev/matchdagen` med `?fps=1` före `#` (t.ex. `/?fps=1#/elev/matchdagen`), spela en
minut och läs rutan uppe till vänster. Under 50 fps → kör `?2d=1` för de eleverna eller sänk taket för
pixeltätheten i `md-tre-ritare.js`.

### Balansen

Oförändrad från 1b (tabellen ovan, `MATCHDAGEN.md` §7): 70 % rätt vinner 61 % och ligan 59 %, 50 % vinner 34 %,
30 % gör minst ett mål i 53 % av matcherna, ~7 minuter per match och ~46 minuter per säsong. 1c lägger bara
till klubbkassan (`KASSA`: 300/150/80 + 15 per rätt + 25 per mål) som inte påverkar matchen.

### Kvoten (1c)

Budgeten i `MATCHDAGEN.md` §11. Kort: **eleven under en timme** (~7 matcher, 3 valda Plugga-områden, ny klubb,
ett namnbyte, 3 matchdetaljer) ≈ **8 läsningar och 16 skrivningar** (mål < 20 och < 50). Träningsläger kommer i
2b. **Läraren** som öppnar Matchdagen för en klass med 2 elever: **2 läsningar**; klick på en elev ≤ 20;
Återställ lagnamn 1 skrivning. Inga lyssnare.

### Deploy

1. `firebase deploy --only firestore:rules` – samlingen `matchdagen/{uid}` med `matcher` – **före** webben,
   annars nekas elevens första sparning (matchen ligger då kvar lokalt och sparas om senare).
2. Webben (Pages).

Inga index (lärarens historik sorterar på `datum` inom en undersamling – automatiskt enfältsindex) och inga
functions.

### Val där dokumentet inte räckte till

1. **Inget kval i Etapp 1.** Ligavinnaren får pokalen "Vinnare Division 6" och laget stannar i Division 6
   nästa säsong (kval och uppflyttning kommer i 2a).
2. **Extra fält i karriären:** `senaste` (20 matcher), `sasonger` och `dagar` (70 dagar). Då kostar elevens
   Statistik och lärarens tabell (7 dagars speltid, veckolinje) inga läsningar av `matcher`.
3. **Schemat lagras som strängar** `"a:b|c:d|e:f"` per omgång – Firestore tillåter inga listor i listor.
4. **Vårt lag i ligan är `{ id: "oss" }`**; namn och färg kommer ur `klubb`, så lärarens återställning rör bara
   `klubb.namn` och tabellen följer med.
5. **Läraren får bara sätta `klubb.namn` till "Pluggporten FC"** (standardnamnet), inget annat namn.
6. **Reglerna prövar bara de fält som ändras** (som `schackOk`): att pröva hela dokumentet sprängde gränsen
   på 1000 uttryck. Truppen prövas bara på stjärnorna per plats (exakt 7, `st` 1–5).
7. **200 kB kan inte mätas i reglerna.** Taken på listorna och mapparna håller appens dokument under ~61 kB med
   allt fyllt (en ny klubb ~2 kB). En elev som skriver förbi appen kan bara blåsa upp sitt eget dokument.
8. **Ny säsong lottas med ett frö** (`sasongFro`), så samma liga visas efter omladdning, och sparas först med
   nästa match (0 extra skrivningar).
9. **Kassan** (`KASSA` i `md-config.js`) är specens §8.3-idé med egna tal: start 600, vinst 300, oavgjort 150,
   förlust 80, +15 per rätt svar, +25 per mål, ×(1 + 0,25 × div). Den används först av marknaden i 2b.
10. **Datumnyckeln är svensk tid** (`Intl` med `Europe/Stockholm`), inte webbläsarens tidszon, så samma dag
    gäller i appen och i Etapp 4 på servern, och `delat/` förblir ren (ingen `new Date`).
11. **Planens höjd följer fönstret** (220–420 px, `passaPlanen` i `md-match-spel.js`): med appens sidhuvud och
    en vanlig webbläsare vid 1366 × 768 blir planen ~257 px hög och allt syns utan scroll. Svarsknapparna ligger
    fyra i rad i matchen.
12. **Pauspåminnelsen** visas i rutan efter matchen när `matchdagenInst.paus` minuter har gått sedan sessionen
    började, aldrig mitt i ett läge.
13. **Spelarnas namn** är påhittade för- och efternamn (svenska och vanliga i svenska skolor), lottade per klubb;
    lagkaptenen är aldrig målvakten.

### Körningar (Codern, 869-coder-2)

| Svit | Resultat |
| --- | --- |
| `node --test` (de 313 filerna som inte kräver emulatorn) | 4538 pass, 0 fail, 1 skipped |
| Matchdagen 1c (`test/matchdagen-sasong.test.js`, `test/matchdagen-plan.test.js`) | 27 pass (ingår ovan) |
| `npm run test:rules` (`admin/qa-matchdagen-867-svit.sh`) | 1025 pass, 0 fail (10 nya i `firestore-rules-matchdagen.test.js`) |
| `npm run test:functions` (samma rigg) | 572 pass, 1 fail, 2 todo – felet är `functions-kurragomma.test.mjs` "letfasen" (två slumpvis placerade gömda på samma ställe); filen ensam: 7/7. Inga filer i `functions/` är ändrade |
| `npm run test:e2e` | 5/5 |
| Bootgrafen | 107 filer (oförändrad) |
| I appen mot emulatorn | se nedan |

**I appen mot emulatorn** (Alva, 1366 × 657 och 1366 × 768): ny klubb → avspark → omladdning mitt i matchen →
"Fortsätt matchen" → hela matchen i 3D → rutan efter matchen → tabellen; läraren ser Alvas rad, historiken och
återställer lagnamnet → Alva ser "Pluggporten FC"; en hel match med `?2d=1` sparades (omgång 3 av 5 nästa).
