# UTVECKLINGSUPPDRAG: METEORSTORMEN – NYTT LIVE-FORMAT

**Uppdrag till AI-utvecklingsteamet**

Bygg ett nytt Live-format: **Meteorstormen** (id `meteorstorm`).

En eller flera klasser försvarar var sin **rymdstation** mot en meteorstorm. Varje rätt svar ger **energi**, och eleven väljer själv vad energin ska göra:

- 🛡️ **Sköld** skyddar den egna stationen.
- 🔫 **Laser** skjuter sönder meteorer på väg mot den egna stationen.
- 🌀 **Dragstråle** fångar en meteor och slungar den mot en annan klass station. Den andra klassen kan skjuta ner den.

**Formatet ska kännas stökigt och spännande, men vara rättvist och snällt:**

- Klassen samarbetar, och det är **stationen** som vinner eller förlorar, aldrig en enskild elev.
- **Ingen elev pekas ut** som sämst. Händelseflödet på projektorn nämner bara det som är bra.
- Klassens storlek spelar ingen roll, eftersom energin räknas **per elev**.
- Den som ligger efter får hjälp (se 4.5).

**Formatet fungerar på två sätt:**

| Läge | Mål |
| --- | --- |
| **En klass** | Överleva stormen tillsammans. 1–3 stjärnor efter hur mycket skrov som är kvar. |
| **Klass mot klass** (2 klasser) | Den station som har mest skrov kvar när tiden är ute vinner. |

Gör arkitekturen så att **3–4 stationer** går att lägga till senare utan att bygga om.

**Detta är ett implementeringsuppdrag.** Bygg formatet **enligt `docs/LIVE-FORMAT.md`**. Den guiden gäller i allt som inte står här.

---

# 0. LÄS FÖRST

- **`docs/LIVE-FORMAT.md`, hela.** Det gäller särskilt §1 (filerna), §2 (format-objektet), §4 (regelgren), §6 (pluggmynt), §7 (projektorvyer), §8 (demoläge), §9 (tester) och §10 (checklistan).
- **`src/live/live-formats.js`:** API-kommentaren, som är det gällande gränssnittet.
- **Förebilder:**
  - `src/live/formats/klassmatch/` för klass mot klass och "per elev"
  - `src/live/formats/guldrush/` och `src/live/kistspel/` för elever i egen takt, servern, delad kod och synk till `functions/`
- **`src/live/kistspel/ks-fraga.js` (`createQuestionFlow`):** frågeflödet med skriv själv, flerval och tidslinje. **Återanvänd det**, kopiera det inte.
- **`src/live/live-clock.js`:** klockan som korrigeras mot serverns tid.
- **`proj-music.js`** och **`proj-sound.js`:** musik och ljud. Musiken levereras separat (se 9).
- **`live-rewards*.js`:** pluggmynten efter matchen.

**Regler:**

- **Bootgrafen (#271):** allt laddas med `import()`. Testet i `test/live-formats.test.js` ska vara grönt.
- **Ingen kod utanför `src/live/formats/meteorstorm/`** känner till formatet. Undantagen är regelgrenen i `firestore.rules` och `functions/`.
- **Egna CSS-prefix** (`ms-`, `msp-`, `mse-` …), och inga klasser delas med andra format.

---

# 1. Kärnan: en deterministisk storm

**Idén:** meteorstormen är **förutbestämd** av ett slumpfrö (`seed`) som sparas på sessionen. Stationernas tillstånd räknas sedan fram av en **ren funktion** utifrån:

- fröet och speltiden
- klasserna och deras antal aktiva elever
- **händelseloggen**: alla elevers handlingar, var och en med serverns tidsstämpel

```js
// src/live/formats/meteorstorm/delat/ms-motor.js  (REN – ingen DOM, ingen Firebase, delas med servern)
simulera({ seed, startMs, varaktighetMs, stationer, handlingar, installningar }, tMs)
  → { stationer: [{ classId, skrov, skold, laddning, … }],
      meteorer: [{ id, mal, pos, storlek, kastadAv? }],
      handelser: [...],          // "Solstorm!", "Jättemeteor!" …
      klart: bool, vinnare? }
```

**Så används motorn:**

- **Alla projektorer räknar själva fram exakt samma bild** av fröet och loggen. Ingen skickar tillståndet bild för bild, och de behöver inte skriva något varje sekund.
- **Servern räknar fram slutresultatet** med samma funktion, när matchen avslutas. Det resultatet gäller, så ingen klient kan fuska fram en vinst.
- **Motorn ligger i `delat/`** och synkas till `functions/meteorstorm/`. Använd mönstret i `admin/sync-guldrush-functions.mjs`: lägg till en rad i `PAIRS`, så fångar testet en kopia som har glidit isär.
- **Simuleringen går i fasta steg** (till exempel 100 ms). Slump får bara komma från fröet, med en egen liten seedad PRNG. Använd aldrig `Math.random()` eller `Date.now()` inne i motorn.

**Tester för determinism:**

- Samma indata ska ge **identiskt** resultat, i node och i webbläsaren.
- Ordningen på handlingar med samma tidsstämpel avgörs av id, så att resultatet alltid blir detsamma.

---

# 2. Spelreglerna

## 2.1 Stationen

- **Skrovet** börjar på 100.
- **Skölden** börjar på 0 och har ett tak på 60. Den tar skadan först.
- **Lasrar:** varje laserskott förstör en meteor som är på väg mot den egna stationen. Skott som inte behövs direkt **laddas** och avfyras automatiskt mot nästa inkommande meteor. Laddningen har ett tak på 10.

## 2.2 Stormen

- **Rättvis för alla:** stormen är **spegelvänd**, så alla stationer får exakt samma meteorer vid samma tid, i samma storlek och med samma skada.
- **Den blir intensivare med tiden:** lugn start, en topp mot slutet och en kort final.
- **Storlekar:** liten (5 skada), mellan (10) och stor (20). En stor meteor kräver 2 laserskott.

## 2.3 Energi och handlingar

- **Energin:** varje **rätt svar** ger eleven **1 energi**. Fel svar kostar ingenting, och eleven får förklaringen eller rätt svar som i övriga format.
- **Efter ett rätt svar** visas tre stora knappar. Energin kan också sparas, med ett tak på 5:

| Knapp | Kostnad | Effekt |
| --- | --- | --- |
| 🛡️ **Sköld** | 1 | +S sköld |
| 🔫 **Laser** | 1 | +1 laserskott |
| 🌀 **Dragstråle** | 3 | Fångar nästa meteor som är på väg mot den egna stationen och slungar den mot en annan station. Den flyger i 6 sekunder och syns hela vägen. |

- **Effekten räknas per elev.** Effekten S och laserns effektivitet skalas med klassens antal **aktiva elever**, så att en klass med 19 elever har samma chans som en med 23. Använd samma "per elev"-tanke som Klassmatchen och dokumentera formeln.
- **Dragstrålen:**
  - Varje station har **en** dragstråle i taget och **10 sekunders** väntetid mellan kasten.
  - En slungad meteor kan skjutas ner av den mottagande klassens lasrar.
  - I läget **En klass** finns ingen dragstråle.

## 2.3.1 Skölden är klassens gemensamma mätare

Skölden är **en mätare för hela stationen**, inte något som en enskild elev "har". Varje tryck på 🛡️ fyller på mätaren lite grand, och varje meteor som träffar tömmer den. När skölden är tom tar skrovet skadan.

- **Ett tryck räcker inte.** En liten meteor (5 skada) äter upp ungefär 5 tryck. Klassen måste alltså **fylla på hela tiden**, och skölden går upp och ner som en mätare under hela matchen. Det är meningen.
- **Taket på 60** gör att det inte lönar sig att bara bygga sköld i början och sedan vila.
- **Laser och sköld kompletterar varandra:**
  - Skölden tar emot **allt**, men slits.
  - Lasern stoppar **en** meteor helt och sparas tills den behövs.

  En klass som bara kör sköld eller bara laser klarar sig sämre än en som blandar.
- **Elevskärmen visar mätaren** och reagerar direkt: "🛡️ +1 – skölden 34/60". Projektorn visar bubblan runt stationen. Den lyser starkare när skölden är full och blir svagare och sprucken när den är nästan slut. När den är tom står det tydligt "⚠️ Skölden är nere!".

## 2.3.2 Balansen

Alla tal i reglerna samlas i **en konfigurationsfil**, `ms-balans.js`: skada, sköldens effekt, laserns effekt, stormens intensitet över tid och händelsernas styrka. Då går spelet att justera utan att röra motorn.

Ställ in balansen med **simulerade klasser** i ett testskript, `admin/ms-balans-sim.mjs`. Det kör motorn med påhittade klasser som svarar olika bra. Målen:

| Simulerad klass (25 elever, en fråga per ~8 s) | Mål efter 10 minuter, läget En klass |
| --- | --- |
| 80 % rätt, blandar sköld och laser | Cirka 70–90 skrov kvar (⭐⭐⭐) |
| 60 % rätt | Cirka 45–65 skrov kvar (⭐⭐) |
| 40 % rätt | Överlever med cirka 10–30 skrov (⭐) |
| Svarar nästan inte alls | Skrovet tar slut efter ungefär halva tiden |

**I läget Klass mot klass** ska en klass med 60 % rätt **kunna vinna** mot en klass med 70 % rätt om den spelar smartare, till exempel blandar rätt och använder dragstrålen vid rätt tillfälle, i minst var fjärde simulerad match.

Redovisa simuleringens resultat i PR:en för motorn.

## 2.4 Händelser

Händelserna är förutbestämda av fröet och kommer samtidigt för alla stationer:

- **☀️ Solstorm:** dubbel energi för alla svar i 20 sekunder.
- **☄️ Jättemeteor:** en enorm meteor på väg mot **alla** stationer. Den kräver 6 laserskott, annars gör den 30 skada. Klassen ser en nedräkning.
- **✨ Kometsvans:** +1 energi till alla som svarar rätt de närmaste 10 sekunderna.
- **🌌 Lugnet:** inga meteorer i 15 sekunder. Andas!

Högst en händelse i taget, och ungefär en per 90 sekunder.

## 2.5 Hjälp till den som ligger efter

Om en station har **minst 20 skrov mindre** än den andra:

- dragstrålen kostar 2 i stället för 3
- skölden får +25 % effekt

Det visas på projektorn som "🚀 4D får extra kraft!".

## 2.6 Lärarens inställningar

- **Läge:** En klass eller Klass mot klass.
- **Attacker:** **Av** (ingen dragstråle), **Milda** (som ovan, standard) eller **Vilda** (dragstrålen kostar 2, väntetiden är 6 sekunder och slungade meteorer är en storlek större).
- **Speltid:** 5–20 minuter, med 10 som standard.
- **Spelläge och svarssätt:** som i övriga format, med Multiplikation eller Plugga-quiz och skriv själv, flerval eller tidslinje.
- **Pluggmynt:** som i övriga format (se 7).

## 2.7 Slutet

- **Klass mot klass:** högst andel kvarvarande skrov vinner. Vid lika avgör antalet nedskjutna meteorer, och är även det lika blir det oavgjort. **Står det 0 i skrov** för en station före tiden är ute "flyter den i rymden": klassen fortsätter svara och skjuta, så att ingen sitter sysslolös, men den kan inte ta mer skada.
- **En klass:** ⭐ med skrovet kvar, ⭐⭐ med minst 50 i skrov och ⭐⭐⭐ med minst 80.

---

# 3. Datamodellen och servern

Följ mönstret i Guldrushen och kistspelet, men med egna samlingar.

```
liveSessions/{sid}                    ← sessionen (kärnan), plus:
  format: "meteorstorm", msSeed, msInstallningar: { lage, attacker, ... }

liveSessions/{sid}/msPlayers/{uid}    ← elevens energi (bara servern skriver)
  classId, energi, ratt, handlingar: { skold, laser, drag }

liveSessions/{sid}/msEvents/{id}      ← händelseloggen (bara servern skriver)
  t (serverTime), classId, uid, typ: "skold"|"laser"|"drag", namn

liveSessions/{sid}/msPublic/status    ← kort sammanfattning till elevskärmarna
  stationer: [{ classId, skrov, skold }], uppdaterad
```

**Callables** (`europe-west1`), med samma mönster som `createKistServer`:

- **`msSvara({sid, svar})`:** servern rättar svaret, med samma rättning som kistspelet (`functions/kistspel-rattning.js`) och samma frågeflöde. Ett rätt svar ger energi, och Solstorm och Kometsvans räknas med.
- **`msAgera({sid, typ})`:** kontrollerar att det finns energi, att väntetiden är ute och att dragstrålen är tillåten. Drar energin och skriver en händelse med serverns tid.
- **`msAvsluta({sid})`:** körs när tiden är ute (eller av läraren). Kör `simulera` på servern med hela loggen och sparar `result`.

**Regler** (en egen gren i `firestore.rules` enligt LIVE-FORMAT §4):

- Klienten får inte skriva i någon av samlingarna.
- **Eleven** läser sitt eget `msPlayers` och `msPublic/status`.
- **Läraren och projektorn** (`hasClass` för någon av sessionens klasser) läser allt.

**Status till elevskärmarna:** `msPublic/status` skrivs av **värdlärarens projektor** var **10:e sekund**. Projektorn räknar ändå fram tillståndet. Alternativt skriver servern det i `msAvsluta` och vid händelser. Välj det som blir billigast och redovisa.

**Kvot:** räkna och redovisa läsningarna och skrivningarna för en match på 10 minuter med 2 klasser och 25 elever i varje.

- **Projektorerna** lyssnar på `msEvents`, alltså en läsning per händelse och projektor.
- **Eleverna lyssnar inte på `msEvents`.**
- **Mål:** under cirka **6 000 läsningar** och **3 000 skrivningar** per match.

---

# 4. Projektorn

## 4.1 Bilden

- **Klass mot klass:** två stationer sida vid sida på en mörkblå rymdbakgrund med stjärnor. Varje station har klassens färg och namn.
- **En klass:** stationen står i mitten.
- **Stationerna** är tecknade i Pluggportens stil: mjuka former, en tydlig kontur och fönster som lyser. Varje station har en **skrovmätare** och en **sköldmätare**. Skölden syns som en halvgenomskinlig bubbla runt stationen, och den blir svagare när den tar skada.
- **Meteorerna** kommer från kanterna. Lasrar syns som korta strålar.
  - En slungad meteor drar en **färgad svans** i den kastande klassens färg, med texten "från 4B".
- **Explosionerna** är mjuka, med gnistor och ett litet "puff". **Inget blinkande och inga vita blixtar över hela skärmen**, med tanke på ljuskänsliga elever. Med `prefers-reduced-motion` blir animationerna enklare.
- **Prestandan:** bilden ritas med Canvas 2D eller WebGL och ska hålla 60 bilder per sekund på en vanlig lärardator. Mät och redovisa.

## 4.1.1 Stationen tar synlig skada

Det ska **synas tydligt** hur stationen mår, utan att man behöver läsa siffror.

**Vid varje träff:**

- **Träff i skölden:** skölden får en våg som sprids från träffpunkten, och bubblan blir lite svagare. Stationen klarar sig.
- **Träff i skrovet:** en mjuk explosion vid träffpunkten, och stationen **gungar till** lite (en kort, liten rörelse). En **buckla eller ett märke** blir kvar där meteoren träffade.
- Med `prefers-reduced-motion` gungar stationen inte. Märket och explosionen syns ändå, men utan rörelse.

**Skadenivåer**, så att stationen ser sämre ut ju mer skrov den förlorar:

| Skrov | Hur stationen ser ut |
| --- | --- |
| 100–76 | Hel och blank, alla fönster lyser |
| 75–51 | Repor och små bucklor, lite rök från ett hörn |
| 50–26 | Sprickor, gnistor då och då, en panel hänger snett, en röd varningslampa som pulserar **långsamt** (inget blinkande) |
| 25–1 | Mer rök, ett par fönster släckta, en antenn har böjts. Mätaren och texten blir orange |
| 0 | "Flyter i rymden": ljuset dämpat och stationen driver långsamt. Den går fortfarande att försvara (se 2.7) |

**Besättningen (valfritt men rekommenderat):** i fönstren syns små tecknade astronauter, gärna med klassens färg på dräkterna.

- De **jublar** när en laser spränger en meteor.
- De **duckar** vid en träff.
- De **torkar svetten** när skölden har hållit för en jättemeteor.
- Vid 0 i skrov sitter de i rymddräkter och vinkar.

Besättningen ger känslor åt stationen utan att visa vem som har gjort fel.

**Slutet:** den vinnande stationen tänder alla lampor och besättningen jublar. Den andra stationen får också en snäll avslutning: "4D:s station klarade sig igenom stormen!" med vinkande besättning.

**Tester och förhandsvisning:** `preview/preview-meteorstorm-motor.html` får ett reglage för skrovet (0–100), så att alla skadenivåer går att se. Lägg skärmdumpar på varje nivå i PR:en.

## 4.2 Överst och i flödet

- **Överst:** nedräkningen och en banderoll för händelser, till exempel "☀️ SOLSTORM! Dubbel energi i 20 sekunder!" eller "☄️ JÄTTEMETEOR – skjut ner den!" med en nedräkning.
- **Flödet** har högst 4 rader, som i `ks-flode.js`, och visar **bara det som är bra**:
  - "🔫 Ahlaam sköt ner en stor meteor!"
  - "🌀 4B slungade en meteor mot 4D!"
  - "🛡️ 4D:s sköld höll!"
  - **Aldrig** något om fel svar.

## 4.3 Slutet

- **Klass mot klass:** den vinnande stationen jublar med fyrverkerier i lugnt tempo. Rutan visar:
  - "4B vann Meteorstormen!" med skrov kvar i procent för båda klasserna
  - antal nedskjutna meteorer per klass
  - klassernas tre bästa ögonblick, som "Flest laserskott: Ahlaam" och "Räddade stationen i sista sekunden: Omar"
- **En klass:** stjärnorna och "Stationen överlevde!".
- **Ingen lista** över alla elever med placering på projektorn.

## 4.4 Två klassrum

Båda lärarna öppnar projektorvyn för samma session, som i Klassmatchen. Bilden är identisk eftersom stormen är deterministisk.

## 4.5 Ljud

Använd `proj-sound.js` för korta, mjuka ljud: laser, explosion och händelsebanderoll. Musiken spelas via `format.music` (se 9).

---

# 5. Elevskärmen

- **Frågeflödet** byggs med `createQuestionFlow` (`ks-fraga.js`).
- **Efter ett rätt svar** visas de tre knapparna (🛡️ Sköld · 🔫 Laser · 🌀 Dragstråle), stora och tydliga, med kostnaden på varje.
  - Knappar man inte har råd med är gråa, och dragstrålen visar sin nedräkning.
  - Eleven kan också trycka **"Spara energin"** och svara på nästa fråga direkt.
  - Mellanslag och siffrorna 1, 2, 3 fungerar som genvägar.
- **Hela tiden syns:**
  - elevens egen energi (⚡ 3)
  - en liten bild av den egna stationen med skrov och sköld, från `msPublic/status`
  - den andra stationens skrov som en liten mätare
- **Kvittens** när en handling gör nytta, som i Guldrushen: "💥 Din laser sprängde en meteor!" eller "🌀 Din dragstråle kastade en meteor mot 4D!". Kvittensen kommer från svaret på callablen.
- **Ingen placering som nummer** på elevskärmen.
- **Slutet:** "Ni vann! 🚀" eller "Bra kämpat – 4D vann den här gången", och elevens eget bidrag ("Du sköt ner 7 meteorer och laddade skölden 5 gånger"), plus pluggmynten.

---

# 6. Lärarvyer

- **Formuläret:** inställningarna i 2.6 via `live-setup-fields.js`.
- **Projektorns kontroller:** paus, avsluta och fullskärm, som i övriga format.
- **Historiken och Statistik → Live** (`meteorstorm-history.js`) visar:
  - vinnaren och skrovet per klass
  - antal handlingar per sort
  - andel rätt per fråga och per elev, som i kistspelets historik

---

# 7. Pluggmynt

Följ LIVE-FORMAT §6 och `live-rewards`:

- **Placeringspris per klass.** Läraren sätter förstapriset, och lägre placeringar får 15 % mindre per plats, avrundat.
- **Mynt per rätt svar** för varje elev, som i övriga format.
- **I läget En klass:** priset beror på antalet stjärnor.
- **Mynten betalas ut efter matchen.**

---

# 8. Demoläge och förhandsvisning

- **Demoläget** (LIVE-FORMAT §8) är en isolerad match med 2 påhittade klasser och simulerade elever som svarar i olika takt, för både projektorn och elevskärmen.
- **Förhandsvisningssidor:**
  - `preview/preview-meteorstorm-demo.html` visar hela matchen.
  - `preview/preview-meteorstorm-motor.html` visar ett reglage för tiden och en knapp för samma frö, så att man kan se att två körningar blir identiska.
- **Skärmdumpar i PR:en:** stationerna, en händelse, en slungad meteor och slutrutan.

---

# 9. Musik

Elias får en loopande musikfil till Meteorstormen (rymd, pulserande och spännande men inte stressig). Den läggs i `src/live/formats/meteorstorm/assets/` och kopplas via `format.music`, som i Guldrushen. Lärarens knapp för musik av och på (i lärarvyn, inte på projektorn) fungerar som i övriga format.

---

# 10. Tester

**Motorn (node, ingen emulator):**

- **Determinism:** samma frö och samma logg ger samma resultat, och handlingarnas ordning avgörs alltid likadant.
- **Spegelvänd storm:** utan handlingar får alla stationer exakt samma skada.
- **Sköld, laser och dragstråle:**
  - skölden tar skada först
  - laserladdningen förstör inkommande meteorer
  - en stor meteor kräver 2 skott
  - dragstrålen flyttar en meteor och respekterar väntetiden
  - en slungad meteor kan skjutas ner
- **Per elev:** två klasser med olika storlek och samma andel rätt svar får samma utfall.
- **Hjälpen till den som ligger efter** slår på vid 20 i skillnad och av igen när skillnaden är mindre.
- **Händelser:** Solstorm, Jättemeteor, Kometsvans och Lugnet fungerar.
- **Attacker av:** ingen dragstråle. **Vilda:** rätt kostnad och väntetid.
- **Slutet:** vinnaren, oavgjort och stjärnorna i läget En klass.

**Regler (emulator):** klienten kan inte skriva, och eleven kan inte läsa andras `msPlayers` eller `msEvents`.

**Functions:**

- `msSvara` rättar på servern.
- `msAgera` nekar utan energi, under väntetiden och när dragstrålen inte är tillåten.
- `msAvsluta` ger samma resultat som projektorn för samma logg.

**Bootgrafen och synken:** testerna i LIVE-FORMAT §9 är gröna, och kopian i `functions/` har inte glidit isär.

---

# PR-ORDNING OCH RAPPORT

1. **Motorn:** `ms-motor.js` med PRNG, storm, regler och händelser, `ms-balans.js` och balanssimuleringen (2.3.2), plus alla motortester och förhandsvisningen av motorn. **Inget gränssnitt än.**
2. **Servern:** callables, datamodell, regelgren och synk, med tester.
3. **Projektorn:** grafiken, flödet, banderollerna och slutrutan, med demoläget.
4. **Elevskärmen och lärarvyerna:** formuläret, historiken och pluggmynten.
5. **Musiken och finputsningen.**

**Rapporten:**

- vad som har byggts
- formeln för "per elev"
- uppmätta bilder per sekund på projektorn
- kvotbudgeten
- skärmdumpar
- vad som ska deployas (regler, functions, index) och i vilken ordning

Alla befintliga tester ska vara gröna.
