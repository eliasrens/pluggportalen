# UTVECKLINGSUPPDRAG: KURRAGÖMMA – NYTT LIVE-FORMAT I 3D

**Uppdrag till AI-utvecklingsteamet**

Bygg ett nytt Live-format: **Kurragömma** (id `kurragomma`).

Det är Pluggportens första format i **3D**. Klassen spelar kurragömma på en liten ö i Pluggportens stil:

1. **Gömfasen.** Sökarna blundar. Alla andra går runt på ön i **tredjeperson** med sin egen avatar, gömmer sig **var de vill** och **låser** sin plats.
2. **Letfasen.** De gömda får frågor. **Fel svar gör att det visslar** från gömstället. Sökarna går runt i tredjeperson och letar. Den som hittas blir själv **sökare**, så ingen åker ut.
3. **Finalen.** Prispall och pluggmynt som i övriga format.

Det finns en spelbar skiss i `docs/kurragomma/skiss.html` (öppna med `npm start` → `http://localhost:8000/docs/kurragomma/skiss.html`). Den visar känslan: ön, stilen, tredjepersonsvyn, låsningen, visslingen och sökarna. Den är fristående kod med three.js från CDN. Använd den som **bild av målet**, inte som kod att kopiera. Där skissen och det här uppdraget skiljer sig gäller uppdraget.

**Detta är ett implementeringsuppdrag, inte ett uppdrag att bara skriva en plan.** Bygg formatet **enligt `docs/LIVE-FORMAT.md`**. Den guiden gäller i allt som inte står här. Arbetet görs i **två etapper** (avsnitt 12).

---

# 0. LÄS FÖRST

- **`docs/LIVE-FORMAT.md`, hela**, särskilt §1 (filerna), §2 (format-objektet), §4 (regelgren), §6 (pluggmynt), §7 (projektorvyer), §8 (demoläge), §9 (tester) och §10 (checklistan).
- **`src/live/live-formats.js`:** API-kommentaren, som är det gällande gränssnittet.
- **Förebilder:**
  - `src/live/formats/meteorstorm/` och `docs/UTVECKLINGSUPPDRAG_METEORSTORMEN.md` – det senaste formatet med egen server, delad motor (`delat/`) och kvotbudget.
  - `src/live/formats/datakuppen/` – hemligheter per elev (`dkSelf`/`dkSecret`), samma mönster behövs för gömställena.
  - `src/live/kistspel/ks-fraga.js` (`createQuestionFlow`) – frågeflödet med skriv själv, flerval och tidslinje. **Återanvänd det**, kopiera det inte.
  - `functions/kistspel-rattning.js` – rättningen på servern.
- **Grafik:**
  - `src/art-style.js` – stilguiden: palett, kontur `#3B3350`, rundade former.
  - `src/avatars.js` (`avatarMarkup(avatarId, equipped)`) och `src/art-characters.js` – elevernas avatarer.
  - `src/live/design/live-avatars.js` (`createAvatarRoster`) – **enda tillåtna sättet** att läsa avatarerna (kvotregeln från incident #231: en läsning per klass).
  - `src/art-gard.js` och `src/art-hus-ute.js` – trä, gräs, moln och lador i 2D. 3D-världen ska kännas som samma värld.
- **`src/live/live-clock.js`, `proj-music.js`, `proj-sound.js`, `live-rewards*.js`.**
- **`docs/BEHORIGHETER.md`** – uppdatera tabellen med formatets samlingar.

**Regler från början:**

- **Bootgrafen (#271):** allt i formatet, inklusive 3D-biblioteket, laddas med `import()`. Testet i `test/live-formats.test.js` ska vara grönt.
- **Ingen kod utanför `src/live/formats/kurragomma/`** känner till formatet. Undantagen är regelgrenen i `firestore.rules`, reglerna för Realtime Database (avsnitt 5), `functions/` och tillägg i `firebase.json`/`package.json`.
- **Egna CSS-prefix:** `kg-` (gemensamt), `kgp-` (projektorn), `kge-` (elevskärmen). Inga klasser delas med andra format.
- **Inga befintliga format får ändra beteende.** Alla befintliga tester ska vara gröna.

## 0.1 Format-objektet i korthet

| Fält | Värde |
| --- | --- |
| `id` | `kurragomma` |
| `displayName`, `icon` | "Kurragömma", 🙈 |
| `scope`, `minClasses`, `maxClasses` | `"inom-klass"`, 1, 1 (fler klasser kan bli aktuellt senare; lägg inget i vägen för det) |
| `answerKinds` | `["free", "choice"]`, plus `timelineQuestions: true` |
| `compatibleGameModes` | samma spellägen som Guldrushen (`GR_MODES`), eftersom servern rättar |
| `pacing` | `"tid"`. **Kärnans matchklocka ska täcka både gömfasen och letfasen** (`durationSeconds` = gömtid + speltid). Läs i `live-core.js` hur `durationSeconds` sätts. Om formatet inte kan sätta det själv: gör den minsta möjliga ändringen i kärnan, med test som visar att andra format inte påverkas, och redovisa. Formatet visar sin egen klocka (`ownTimer: true`). |
| `music` | se avsnitt 8 |

Elevens 3D-yta monteras via `createStage` (LIVE-FORMAT §7). Kärnan sköter lobby → 3-2-1-KÖR! → spel → slut. **Gömfasen börjar efter KÖR!**

## 0.2 Lärdomar som gäller från början

| Område | Regel |
| --- | --- |
| Projektorn | Översta raden (logga, timer, "Gömda 14 · Sökare 6") är fredad. Händelseflödet högst 4 korta rader. Inga notiser över timern. Dekor aldrig bakom text. |
| Final | Rubrik exakt "🏆 Kurragömma – Prispall". Inga klassnamn. Pallen centrerad efter placering, utan tomma platser. |
| Ikoner | Inga emojier från Emoji 13 eller senare i gränssnittet (de blir ▯ på Windows 10). Använd SVG. |
| Speltid | Snabbknappar 3, 5, 10, 15, 20, 30 min och "Egen tid" 1–60 hela minuter. Rekommendera 8 minuter i gränssnittet. Gömfasen räknas inte in i speltiden. |
| Facit | Elever kan aldrig läsa facit. |
| Frågor | Samma frågekällor som Guldrushen: multiplikation (skriv själv eller flerval), quiz från Plugga och tidslinjefrågor. |
| Pluggmynt | Gemensamma `live-rewards`. Poängen i spelet är spelvaluta och kan aldrig bli pluggmynt under matchen. |
| Musik | `format.music`, knappen 🎵 Musik på/av, tyst lobby, ducking bara när effekten hörs. Ingen musik på elevdatorerna. |
| Namn | Lärarens inställning "namn i händelseflödet" gäller. Av = "Någon". |
| Konfiguration | Alla värden i formatets konfiguration (`delat/kg-config.js`), delad mellan klient och server via synken. |
| Varumärken | Inga riktiga spel, figurer, märken eller logotyper. |

---

# 1. SPELREGLERNA

## 1.1 Roller

- **Gömmare:** gömmer sig, låser sin plats och svarar på frågor.
- **Sökare:** letar. Startsökarna dras av servern när matchen startar (`kgStarta`, 5.2).
- **Antal startsökare:** lärarens val "Auto" (standard: 1 per påbörjat 10-tal elever, minst 1, högst 4) eller 1–4.
- **Den som hittas blir sökare** och börjar leta från platsen där den hittades.
- En elev som ansluter **efter gömfasen** blir sökare. En elev som ansluter under gömfasen blir gömmare.
- **Startsökarna** börjar vid kartans `sokarStart` (brunnen mitt på ön).
- **Om ingen sökare är ansluten** (ingen puls på 30 sekunder) under letfasen blir en slumpad gömmare sökare, med flödesraden "Ny sökare!". Spelet får aldrig stå still.

## 1.2 Gömfasen

- Längd: lärarens val 20, 30, 45 eller 60 sekunder (standard 30). Visas som stor nedräkning på alla skärmar.
- **Gömmarna** startar på slumpade platser i kanten av ön, vända inåt, och går runt fritt (avsnitt 3). Ingen annan ser var de går.
- **Gömmaren låser** med knappen "🔒 Lås gömstället här". Låsningen kan inte ångras.
- Klienten skickar den låsta platsen till servern (`kgLas`). Servern kontrollerar att platsen är giltig: inom ön, inte inuti ett fast föremål, och att gömfasen pågår. En ogiltig plats flyttas till närmaste giltiga punkt.
- **Om tiden tar slut** innan eleven har låst skickar klienten automatiskt sin nuvarande plats. Har servern inte fått någon plats när gömfasen är slut (eleven är frånkopplad) väljer servern ett giltigt gömställe nära ett slumpat föremål.
- **Laddar gömmaren om sidan under gömfasen** fortsätter den från sin senaste plats (sparad i `sessionStorage`, aldrig på servern).
- **Sökarna blundar.** Deras skärm är täckt med "🙈 Du blundar – räkna till 30!" (gömtiden) och nedräkningen. Under tiden får de frågor och kan ladda ficklampan (1.4) i förväg.
- Projektorn visar ön från ovan och visar **aldrig** var någon går under gömfasen. Den visar bara antalet låsta, till exempel "Låsta 12/21".

## 1.3 Letfasen: gömmarna

- Den gömda står still på sin låsta plats. Kameran ligger kvar bakom avataren, och eleven kan titta runt (dra eller A/D), men inte gå.
- Eleven får frågor i en panel bredvid 3D-vyn (avsnitt 6).
- **Rätt svar:** +10 poäng.
- **Fel svar:** det **visslar** från gömstället (1.5). +0 poäng.
- **Vissling har en spärrtid**, standard 20 sekunder per elev (konfig). Fel svar under spärrtiden ger ingen ny vissling. Det skyddar elever som har en svår stund.
- **Tystnadsregeln** (lärarens val, standard på): den som inte har svarat på 45 sekunder (konfig) visslar. Den gäller inte en frånkopplad elev (pulsen i `players` har inte uppdaterats på 30 sekunder). 45 sekunder, inte kortare, eftersom en quizfråga kan ta tid att läsa för en trea.
- **Överlevnadspoäng:** +2 poäng per hela 10 sekunder som gömd under letfasen, räknat av servern när eleven hittas eller när matchen tar slut.
- **Gömd när tiden tar slut:** +50 poäng.
- **Hjärtslag:** när en sökare är inom 6 meter pulserar kanten av gömmarens skärm mjukt. Det räknas på klienten ur sökarnas positioner (avsnitt 5). Inget ljud.

## 1.4 Letfasen: sökarna

- Sökaren går runt fritt i tredjeperson (avsnitt 3), med samma styrning som gömmarna i gömfasen.
- **Ficklampan:** varje sökning kostar en laddning. Sökaren har högst 3 laddningar och börjar letfasen med 1 plus det som laddades under blundandet. Varje rätt svar ger 1 laddning.
- När laddningarna är slut kan sökaren fortfarande gå, men knappen "Leta" är grå och frågepanelen markeras: "Svara rätt för att ladda ficklampan".
- **Leta:** knappen "🔦 Leta" (mellanslag eller E). Spärrtid 2 sekunder mellan sökningar (konfig).
- **Rätt svar:** +10 poäng och 1 laddning. **Fel svar:** ingenting händer, ingen vissling. **Hittad gömmare:** +40 poäng till sökaren.
- Sökaren ser andra sökare som figurer (med namn om namninställningen är på). Sökaren ser aldrig gömmarna, bara visslingarna.

## 1.5 Visslingen

- Servern skriver en händelse `vissling` med en **ungefärlig** plats: ett slumpat centrum inom 2,5 meter från gömstället (konfig `visslingOsakerhet`). Den exakta platsen lämnar aldrig servern.
- **På projektorn:** ljud med riktning (avsnitt 8), ringar och noter som stiger från platsen, och texten "Vissling!". Kameran glider kort mot platsen (avsnitt 7). **Ingen avatar och inget namn**, så att ingen kan se vem som visslade.
- **Hos sökarna:** inget ljud. En tydlig markör syns på platsen i 4 sekunder, även genom dimman. Om platsen är utanför bilden visas en pil i skärmkanten.
- **Hos den som visslade:** "Fel svar – det visslade där du gömmer dig!" och den egna avataren hoppar till. Bara på elevens egen skärm.
- **Hos övriga gömmare:** bara en kort rad överst, "Det visslar vid ladan", i 3 sekunder.
- Flödet på projektorn: "🎵 Det visslar vid ladan!" (platsens namn ur kartan, se 2.2). **Aldrig namnet** på den som visslade, oavsett namninställning.

## 1.6 Sökningen

Sökningen är **deterministisk**, inte slumpad. Eleverna ska förstå varför de blev hittade.

- Sökaren skickar `kgLeta({ sid, x, z })` med sin plats.
- Servern kontrollerar att sökaren är sökare, har en laddning, att spärrtiden är ute och att platsen är **rimlig**: avståndet från förra sökningen (eller från startpunkten) får inte vara större än `maxFart × förfluten tid + 2 m`. Annars nekas sökningen utan att laddningen dras.
- Varje gömmare har en **sökradie** som beror på hur bra gömstället är (`skydd`, 2.3):

| Skydd | Text på skärmen | Sökradie |
| --- | --- | --- |
| 0 | Syns lätt | 3,5 m |
| 1 | Okej gömställe | 3,0 m |
| 2 | Bra gömställe | 2,2 m |
| 3 | Mycket bra gömställe | 1,5 m |

- **Den som har visslat** de senaste 10 sekunderna har 1,5 gånger större sökradie.
- Alla gömmare inom sin sökradie från sökpunkten **hittas**. En sökning kan hitta flera.
- En sökning som inte hittar någon ger flödesraden "Leo letade vid brunnen men hittade ingen" (namn av: "En sökare letade vid brunnen …") högst var 15:e sekund per sökare, så flödet inte fylls.
- Hittad: "🔎 Leo hittade Sara vid ladan! Sara blir sökare." (Namn av: "🔎 Någon hittade någon vid ladan!")

## 1.7 Slutet

- Matchen slutar när speltiden är slut **eller** när alla gömmare är hittade.
- **Placering:** efter poäng. Lika poäng ger delad placering (1, 1, 3).
- Pluggmynt via `live-rewards` (avsnitt 10).

## 1.8 Trygghet

- Ingen åker ut. Alla är med hela matchen.
- Ingen visas som sist, och ingen pekas ut för fel svar. Visslingen nämner bara platsen.
- Inga skrämmande inslag: ingen mörker-effekt, inget jump scare, inget "fångad". Ord som används: "hittad", "gömd", "letar".
- Den som har svårt med frågorna skyddas av spärrtiden för visslingar, och blir hittad i värsta fall sökare och fortsätter spela.

---

# 2. VÄRLDEN OCH KARTAN

## 2.1 Ön

- Etapp 1 har **en karta: "Ön"**, ungefär som skissen. Radie 30 meter, 1 enhet = 1 meter.
- Kartan är **data**, inte kod: `delat/kg-karta.js` med öns radie, startplatser och en lista över föremål `{ id, typ, namn, x, z, rot, r, fast, lov }`.
  - `r`: föremålets radie för skyddet.
  - `fast`: radie man inte kan gå in i (ladan, stenen, brunnen, stammar), eller `0`.
  - `lov`: `true` för det man kan gå in i och gömma sig inne i (buskage, höstack, granens och ekens krona).
- Föremål i etapp 1: lada, höstack, stor sten, gran, ek, vanliga träd, buskage, bro över en damm, brunn, vedtrave, vagn, tunnor, tält, staket, blommor och moln. Minst 30 föremål totalt, så det finns många bra gömställen.
- Kartan är samma för klient och server (synken till `functions/`).

## 2.2 Platsnamn

`platsNamn(x, z)` i `delat/` ger "vid ladan", "i buskaget", "vid ett träd" eller "ute på ängen". Den används i flödet och på elevskärmen ("Du är gömd i buskaget").

## 2.3 Skydd och kollision (delat, ren logik)

- `skydd(x, z, karta) → 0–3` enligt tabellen i 1.6:
  - 3: inne i ett `lov`-föremål
  - 2: högst 0,6 m från ett föremåls kant
  - 1: högst 2 m från ett föremåls kant
  - 0: annars
- `kollidera(x, z, karta) → { x, z }` knuffar ut ur `fast`-radier och håller platsen inom ön.
- `giltigtGomstalle(x, z, karta)` används av servern i `kgLas`.
- **Samma funktioner** används av klienten (mätaren, rörelsen) och servern (låsningen, sökningen).

---

# 3. RÖRELSE OCH KAMERA (TREDJEPERSON)

- **Kameran** följer avataren bakifrån: cirka 8,5 m bakom, 4,5 m upp, tittar på avatarens överkropp. Mjuk följning, ingen gungning av kameran (åksjuka). Synfält cirka 60°.
- **Styrning, dator:** W/S eller pil upp/ned framåt och bakåt, A/D eller pil vänster/höger vänder. Dra med musen för att titta runt.
- **Styrning, pekskärm:** en joystick nere till vänster, dra på bilden för att titta runt.
- **Tryck på marken** för att gå dit (bra för de yngre).
- **Fart:** cirka 6 m/s (konfig `maxFart`, används också av serverns rimlighetskontroll).
- **Kollision** med `fast`-föremål. Man kan gå in i `lov`-föremål. Ingen kollision mellan figurer (det ger hack när positionerna kommer över nätet).
- **Kameran får aldrig hamna inne i ett träd eller en vägg.** Antingen blir föremål mellan kameran och avataren halvgenomskinliga, eller så dras kameran närmare avataren. Välj det som är billigast för prestandan och redovisa.
- **Skyddsmätaren** överst i mitten: "🟢 Mycket bra gömställe" och så vidare. Använd SVG-prickar, inte emojier, om de färgade cirklarna inte är säkra på Windows 10.
- **Fokusregeln:** när frågepanelen har fokus styr tangenterna svaret, inte figuren. Det måste fungera för "skriv själv" med siffror.
- **Gömmarens rörelse sparas aldrig någonstans** under gömfasen. Den finns bara i elevens webbläsare tills låsningen.

---

# 4. 3D-GRAFIKEN

## 4.1 Biblioteket

- Använd **three.js**, en fast version (r160 eller senare), **lagd i repot** under `src/vendor/three/` med licensfilen. Inget CDN vid körning, eftersom skolnätverk kan blockera det.
- Det är det **enda nya beroendet** som är tillåtet i uppdraget. Det laddas bara med `import()` när formatet används.
- Använd inga tilläggsmoduler som inte behövs. Kameran och styrningen skrivs själva (ingen OrbitControls behövs).

## 4.2 Stilen

3D-världen ska se ut som Pluggportens 2D-konst, fast i 3D:

- **Palett** ur `art-style.js` (gräs, trä, sol-gul, himmelsblå, röd och så vidare). Inga nya färger utan skäl.
- **Kontur** `#3B3350` runt föremålen (till exempel en bakåtvänd, lite större kopia av formen). Den är det som får det att kännas som Pluggporten.
- **Tecknad skuggning** med 3 steg (`MeshToonMaterial` med en egen gradientkarta). Inga realistiska texturer och inga riktiga skuggor. Använd mjuka "blob-skuggor" under föremål och figurer.
- **Low-poly** och rundade former, inga skarpa eller hotfulla.
- **Typsnitt:** Baloo 2 som resten av Live.

## 4.3 Avatarerna

- Varje elev visas med **sin riktiga avatar**, med kläder och tillbehör: `avatarMarkup(avatarId, avatarItems)` ur projektionen via `createAvatarRoster`.
- SVG:n ritas **en gång** per elev till en canvas och används som textur på en figur som alltid vänder sig mot kameran (billboard). Cachea per elev.
- Figuren går med en liten studs. Namnet syns ovanför sökare i en liten blå skylt (bara när namninställningen är på, annars ingen skylt). Gömmaren ser sin egen figur men ingen skylt.
- Elevdatorerna läser avatarerna på samma sätt som projektorn: en läsning av klassprojektionen per dator, inte per elev.
- En elev utan avatar i projektionen visas med standardavataren (live-avatars sköter det).
- **Etapp 2:** avatarerna sedda bakifrån (se 12).

## 4.4 Prestanda

Eleverna har **bärbara HP-datorer** med inbyggd grafik. Det styr allt.

- **Mål:** minst 30 bilder per sekund på elevernas datorer på nivån "Mellan", och minst 40 på projektordatorn.
- **Tre nivåer:** Låg (upplösning ×0,6, ingen kontur, färre träd), Mellan (×1,0), Hög (upp till skärmens upplösning, högst ×2). Standard: Mellan.
- **Automatisk sänkning:** om bilderna per sekund ligger under 24 i 3 sekunder sänks nivån ett steg, och eleven ser en liten rad om det. Valet sparas lokalt.
- **Inga skuggor i realtid,** ingen kantutjämning, inga efterbehandlingseffekter.
- **Slå ihop** likadana föremål (instancing eller sammanslagen geometri) så att antalet ritanrop hålls under 150.
- Rendera bara när fliken syns. Pausa när fliken är dold.
- **Utan WebGL** (eller om nivån Låg ändå ligger under 15 bilder per sekund): en **2D-karta ovanifrån** med samma karta, samma logik och samma knappar. Spelet ska alltid gå att spela.
- **Prestandasida:** `preview/preview-kurragomma-prestanda.html` kör scenen med 30 figurer och visar bilder per sekund, ritanrop och nivå. Elias kör den på elevernas HP-datorer innan formatet släpps.

---

# 5. DATAMODELLEN, SERVERN OCH RÖRELSEKANALEN

## 5.1 Firestore

Följ mönstret i Meteorstormen och Datakuppen, med egna samlingar:

```
liveSessions/{sid}                        ← sessionen (kärnan), plus:
  format: "kurragomma", kgInstallningar: { gomtid, startsokare, tystnad, karta }
  kgFas: "gom" | "leta"                    (kärnans status styr lobby och slut)
  kgGomSlut: Timestamp                     (serverns tid när gömfasen slutar)

liveSessions/{sid}/kgPlayers/{uid}        ← per elev (bara servern skriver)
  classId, roll: "gomd" | "sokare", poang, ratt, besvarade, hittade, hittadAv?,
  laddningar, harLast: bool, senastSvarAt

liveSessions/{sid}/kgSelf/{uid}           ← bara eleven själv läser (bara servern skriver)
  gomstalle: { x, z, skydd, namn }

liveSessions/{sid}/kgSecret/{uid}         ← ingen klient läser
  x, z, lastAt, senastVisslingAt, senasteSok: { x, z, at }

liveSessions/{sid}/kgEvents/{id}          ← serverns logg för historik och statistik
  t (serverns tid), typ: "vissling" | "hittad" | "nySokare", x, z, plats,
  sokare?, hittad? (uid, bara vid "hittad")
```

**Ingen klient lyssnar på `kgEvents` under matchen.** Det som måste ut i realtid går via rörelsekanalen (5.3). Det håller Firestore-läsningarna nere: en vissling som 25 elever lyssnar på i Firestore kostar 25 läsningar.

- **Den exakta gömplatsen** finns bara i `kgSecret` och i elevens egen `kgSelf`. Den publika `kgPlayers` bär den aldrig.
- `kgEvents` och realtidshändelsen för en vissling bär bara den ungefärliga platsen.
- Elevens svar loggas för statistiken på samma sätt som i Guldrushen (andel rätt per uppgift), så att historiken fungerar.

## 5.2 Callables (`europe-west1`)

Samma mönster som `createKistServer` och Meteorstormens callables:

- **`kgStarta({ sid })`:** anropas av värdlärarens projektor när sessionen har gått till spel (efter KÖR!). Drar startsökare, sätter `kgFas: "gom"` och `kgGomSlut`, och skriver `roll` och `med` i rörelsekanalen. Idempotent, och görs också lat i första anropet nedan om projektorn inte hann.
- **`kgAnslut({ sid })`:** anropas av eleven när spelytan monteras, också vid återanslutning. Ger elevens roll, fas, laddningar och (för en låst gömmare) det egna gömstället. Lägger till eleven i `med`. En ny elev under letfasen blir sökare här.
- **`kgLas({ sid, x, z })`** (gömmare, under gömfasen): se 1.2.
- **`kgSvara({ sid, svar })`:** rättar med kistspelets rättning. Gömmare: poäng eller vissling. Sökare: poäng och laddning.
- **`kgLeta({ sid, x, z })`:** se 1.6. Gör allt i **en transaktion** så att två sökare som hittar samma elev samtidigt inte båda får poängen.
- **`kgTick({ sid })`:** körs av **värdlärarens projektor** var 5:e sekund. Den byter fas från `gom` till `leta` när `kgGomSlut` har passerat (och placerar elever som inte har låst), går igenom tystnadsregeln och regeln om att det alltid finns en sökare. Använd **frågor** (till exempel gömda med `senastSvarAt` äldre än 45 sekunder), så att ett anrop som inte hittar något kostar en läsning och inte 25. Idempotent: flera anrop samtidigt ger samma resultat.
- **Fasbytet görs också lat** i `kgAnslut`, `kgLas`, `kgSvara` och `kgLeta`, så att spelet går vidare även om projektorn har stängts.
- **`kgAvsluta({ sid })`:** när tiden är ute, när alla är hittade eller av läraren. Räknar överlevnadspoängen och sparar `result`. Samma väg som Meteorstormens avslut.

## 5.3 Rörelsekanalen: Realtime Database

Sökarna måste se varandra, gömmarna måste se sökarna komma, och alla måste få visslingarna direkt. Positioner flera gånger per sekund och händelser som alla lyssnar på är **för dyrt i Firestore**, där varje skrivning läses av varje lyssnare. Därför används **Firebase Realtime Database**, som tar betalt för datamängd och inte per läsning, för **tre saker och inget annat**: sökarnas positioner, realtidshändelserna och en kort status.

```
/kg/{sid}/roll/{uid}: "sokare"            ← bara servern skriver (Admin SDK)
/kg/{sid}/med/{uid}: true                 ← bara servern skriver (alla deltagare)
/kg/{sid}/pos/{uid}: { x, z, yaw, t }     ← sökaren skriver sin egen
/kg/{sid}/hand/{id}: { typ, x, z, plats, t, namn? }   ← bara servern skriver
/kg/{sid}/status: { fas, lasta, gomda, sokare }        ← bara servern skriver
```

- `hand`: vissling, hittad och ny sökare, med samma innehåll som i 1.5 och 1.6 (namn bara enligt namninställningen, aldrig för visslingar). Klienterna lyssnar med `limitToLast` och struntar i händelser äldre än 10 sekunder. Servern rensar händelser äldre än 60 sekunder.
- `status`: det projektorn och elevskärmarna visar överst ("Låsta 12/21", "Gömda 14 · Sökare 6").

- **Sökaren skriver** högst 5 gånger per sekund, och bara om den har flyttat sig mer än 0,15 m eller vänt sig. `onDisconnect().remove()`.
- **Klienterna interpolerar** mellan positionerna (cirka 150 ms bakåt), så rörelsen ser mjuk ut.
- **Regler** (`database.rules.json`):
  - skriva `pos/{uid}`: bara `auth.uid == uid` och `roll/{uid} == "sokare"`, och bara fälten x, z, yaw, t inom rimliga gränser
  - läsa `pos`, `hand` och `status`: den som finns i `med`, eller en lärare (använd den befintliga custom claim för lärare)
  - `roll`, `med`, `hand` och `status`: ingen klient skriver
- **Gömmarnas positioner** skrivs **aldrig** i Realtime Database.
- `kgAvsluta` tar bort `/kg/{sid}`.
- **Ett gränssnitt** `kg-rorelse.js` med två implementationer: Realtime Database och en lokal för demoläget. Resten av koden känner inte till vilken som används.
- **Emulatorn:** lägg till database-emulatorn i `firebase.json` och regeltester mot den.
- **Elias skapar databasen** (europe-west1) i Firebase-konsolen innan deploy. Bygg och testa mot emulatorn. Skriv stegen i rapporten.

## 5.4 Regler i Firestore

En egen gren enligt LIVE-FORMAT §4:

- Klienten får inte skriva i någon av formatets samlingar.
- **Eleven** läser sitt eget `kgPlayers` och sitt eget `kgSelf`. Inte `kgEvents`.
- **Ingen klient** läser `kgSecret`.
- **Läraren och projektorn** (`hasClass` för någon av sessionens klasser) läser `kgPlayers` och `kgEvents` (för historiken), men inte `kgSelf` eller `kgSecret`. Inte ens läraren ska kunna se var eleverna gömmer sig under matchen, så att projektorn aldrig kan avslöja det av misstag.

## 5.5 Kvotbudget

Räkna och redovisa för en match på 10 minuter med 25 elever i en klass:

- **Firestore:** under **8 000 läsningar** och **6 000 skrivningar** per match. Räkna med serverns läsningar i functions, de kostar också.
- Eleverna lyssnar bara på sitt eget `kgPlayers` och sitt eget `kgSelf` i Firestore. Allt annat i realtid kommer från rörelsekanalen.
- Projektorn lyssnar inte på `kgPlayers` under matchen. Siffrorna överst kommer från `status`.
- **Realtime Database:** under **50 MB** nedladdat per match.
- Mät i emulatorn med demots robotar och redovisa siffrorna.

---

# 6. ELEVSKÄRMEN

- **3D-vyn** fyller skärmen. Ovanpå: timer och fas överst, skyddsmätaren i mitten, joystick och låsknapp under gömfasen.
- **Frågepanelen** (`createQuestionFlow`):
  - bredare än 1100 px: en panel till höger, cirka 360 px bred
  - smalare: ett kort längst ned som kan fällas ihop
- **Gömfasen, gömmare:** "Göm dig! Ingen annan ser var du går." Nedräkning, mätaren och "🔒 Lås gömstället här". Inga frågor.
- **Gömfasen, sökare:** täckt skärm "🙈 Du blundar", nedräkning och frågor för att ladda ficklampan.
- **Letfasen, gömd:** frågor, "Du är gömd i buskaget", poäng, hjärtslaget och en kort rad överst när det visslar någon annanstans.
- **Letfasen, sökare:** frågor, laddningarna som tre ficklamps-ikoner, "🔦 Leta" och pilen mot senaste visslingen.
- **Hittad:** en kort, glad ruta (högst 2 sekunder): "Leo hittade dig! Nu letar du också." Sedan sökarvyn, med start där eleven var gömd.
- **Ljud:** inget ljud på elevdatorerna, som i övriga format.
- Ska fungera på elevernas HP-datorer, på 1366 × 768 och på en smal skärm (cirka 380 px).

---

# 7. PROJEKTORN

- **Bilden:** ön sedd snett ovanifrån, med långsam rotation. Sökarna syns som figurer (med namn om namninställningen är på) ur rörelsekanalen. **Gömmarna syns aldrig.**
- **Kameran glider** till en vissling eller en hittad elev i cirka 3 sekunder och tillbaka. Flera händelser tätt efter varandra ger en glidning, inte flera.
- **Översta raden (fredad):** logga "Kurragömma", timer (under gömfasen "Göm: 0:24"), "Gömda 14 · Sökare 6" (under gömfasen "Låsta 12/21").
- **Händelseflödet:** högst 4 rader: visslingar, hittade, "Alla har gömt sig – nu letar sökarna!", "1 minut kvar".
- **Effekter:** vissling (ringar, noter, "Vissling!"), hittad (konfetti, "Hittad!"). Inga effekter över översta raden.
- **Ingen topplista under matchen.** Poängen syns först i finalen.
- **Elevskärmsfönstret** visar samma vy utan kontroller.
- `prefers-reduced-motion`: ingen rotation och ingen glidning, bara effekterna.

---

# 8. LJUD OCH MUSIK

- **Visslingen** spelas på projektorn med **riktning**: höger eller vänster högtalare beroende på var platsen syns i bilden, och svagare längre bort. Använd Web Audio (`StereoPannerNode` och volym). Ljudet ska vara en glad, kort vissling, inte gäll.
- **Övriga ljud:** mjukt "pling" när någon hittas, ett lugnt ljud när gömfasen slutar. Inget som skrämmer.
- **Musik:** levereras separat som `kurragomma-loop.ogg` i `src/live/formats/kurragomma/assets/`. Bygg så att formatet fungerar utan filen (tyst) och att filen bara behöver läggas på plats. Under gömfasen lägre volym.

---

# 9. LÄRARENS INSTÄLLNINGAR

Samma som Guldrushen (frågor, speltid, namn i flödet, pluggmynt, musik), plus:

- **Gömtid:** 20, 30, 45 eller 60 sekunder (standard 30).
- **Startsökare:** Auto (standard) eller 1–4.
- **Tystnadsregeln:** på (standard) eller av.
- **Karta:** bara "Ön" i etapp 1 (fältet finns ändå, så att fler kartor kan läggas till).

---

# 10. PLUGGMYNT

- Kopplas in enligt LIVE-FORMAT §6, med `withRewards(s, result, rows)` där `rows = [{ uid, score: poang, correct: ratt, answered }]` ur **serverns** data.
- `winner: null` (individuellt format).

---

# 11. LOBBY, FINAL, HISTORIK OCH DEMO

## 11.1 Lobby

- Ön syns på projektorn. Varje elev som ansluter dyker upp som figur på bryggan eller stranden.
- Kort förklaring: "Göm dig var du vill och lås platsen. Svara rätt – annars visslar det! Den som hittas blir sökare."

## 11.2 Final

- Först en lugn rad: "8 av 24 klarade sig gömda hela matchen" (eller "Sökarna hittade alla!").
- Sedan "🏆 Kurragömma – Prispall", pallen centrerad, pluggmyntpriset under varje plats.
- Sist kan projektorn visa **var alla var gömda** som små figurer på kartan. Det är roligt efteråt och avslöjar inget, eftersom matchen är slut. (Servern skriver gömställena till `result` i `kgAvsluta`.)

## 11.3 Historik och statistik

- Som Guldrushens: pallplats, topplista med pluggmynt, andel rätt per uppgift och kategori via `statKeys`.
- Plus: hur många som klarade sig, antal visslingar och den som hittade flest.

## 11.4 Demoläge

- Isolerat enligt LIVE-FORMAT §8: 30 påhittade elever, robotar som gömmer sig nära föremål, svarar rätt och fel och letar (som skissen).
- **Kopplad demo** som Datakuppens: `preview/preview-kurragomma-demolage.html` med projektorn och en elevvy sida vid sida. I elevvyn kan man styra en gömmare eller en sökare själv.
- Demot ska kunna visa: anslutning, gömfasen, låsning, visslingar, sökningar, hittad → sökare, tystnadsregeln, "1 minut kvar", alla hittade, final och 2D-kartan.
- Demot använder den lokala rörelsekanalen och rör aldrig riktig data eller pluggmynt.

## 11.5 Balanssimulering

Skriv ett skript, `npm run balans:kurragomma`, som simulerar en match med 25 elever i 8 minuter vid olika träffsäkerhet (60, 75 och 90 % rätt) och skriver ut:

- genomsnittlig poäng för startsökare, för gömmare som hittas och för gömmare som klarar sig
- hur många som är gömda kvar vid slutet (riktmärke: 15–40 %)
- hur många visslingar per minut klassen gör (riktmärke: högst 6, annars blir projektorn rörig)
- hur stor del av poängen som kommer från rätt svar (riktmärke: minst 60 %, så att det lönar sig att plugga oavsett roll)

Om riktmärkena inte nås: justera **bara** värdena i `kg-config.js` och redovisa.

---

# 12. ETAPPER

| | Innehåll |
| --- | --- |
| **ETAPP 1** | Allt i avsnitt 1–11 med kartan Ön. |
| **ETAPP 2** | Avatarer sedda bakifrån, en karta till (till exempel skolgården eller vinterbyn), "byt gömställe" som belöning efter 5 rätt i rad, ljud i hörlurar för sökarna (lärarens val) och balansjustering efter test i klassrum. |

1. **Etapp 1 ska färdigställas, testas och redovisas innan etapp 2 påbörjas.**
2. När etapp 1 är klar: **stanna**, lämna rapporten och vänta.
3. **Påbörja inte etapp 2** förrän Elias uttryckligen har gett klartecken.

## 12.1 PR-ordning i etapp 1

1. **Motorn:** `delat/` med karta, skydd, kollision, sökning, poäng och konfiguration, plus alla motortester och balanssimuleringen. Inget gränssnitt än.
2. **3D-scenen:** three.js i repot, världen, avatarerna, kameran och styrningen, prestandanivåerna, 2D-reserven och prestandasidan. Körs i en förhandsvisning utan server.
3. **Servern:** callables, datamodell, regelgren i Firestore, Realtime Database med regler, synk och tester.
4. **Projektorn och elevskärmen:** alla vyer, flödet, ljudet, lobbyn och finalen, med demoläget.
5. **Lärarformuläret, historiken och pluggmynten.**

---

# 13. TESTER

## 13.1 Motorn (node, ingen emulator)

- `skydd` ger rätt nivå inne i, nära och långt från föremål.
- `kollidera` knuffar ut ur fasta föremål och håller platsen inom ön.
- `giltigtGomstalle` nekar platser utanför ön och inuti fasta föremål, och den närmaste giltiga punkten är giltig.
- Sökningen hittar exakt de gömmare som är inom sin sökradie, och radien är 1,5 gånger större efter en vissling.
- Rimlighetskontrollen nekar en sökning för långt bort.
- Spärrtiden för visslingar och tystnadsregeln (inklusive frånkopplad elev).
- Poäng: rätt svar, hittad, överlevnad och gömd vid slutet. Delad placering.
- Platsnamnen.
- Kartan: alla föremål ligger inom ön och överlappar inte så att man kan fastna.

## 13.2 Servern (functions och emulator)

- `kgLas` nekar efter gömfasen och flyttar en ogiltig plats.
- `kgSvara` rättar på servern. Fel svar under spärrtiden ger ingen vissling. En sökares fel svar ger aldrig vissling.
- `kgAnslut` ger samma roll och gömställe efter återanslutning, och gör en elev som ansluter under letfasen till sökare.
- `kgLeta` nekar utan laddning, under spärrtiden och vid orimlig plats. Två samtidiga sökningar på samma elev ger poäng till en.
- Vissling: händelsen bär aldrig den exakta platsen eller namnet.
- `kgTick` byter fas, placerar elever utan låsning, gör en gömmare till sökare när ingen sökare är ansluten och är idempotent.
- Fasbytet sker även när ingen `kgTick` körs (lat i de andra anropen).
- Kärnans matchklocka täcker gömfas och letfas, och andra formats klocka är oförändrad.
- `kgAvsluta` ger rätt `result` och tar bort `/kg/{sid}`.

## 13.3 Regler

- **Firestore:** klienten kan inte skriva. Eleven kan inte läsa andras `kgPlayers` eller `kgSelf`. Ingen kan läsa `kgSecret`. Läraren kan inte läsa `kgSelf`.
- **Realtime Database:** en gömmare kan inte skriva `pos`. En sökare kan bara skriva sin egen. Ingen klient kan skriva `roll`, `med`, `hand` eller `status`. Den som inte är med kan inte läsa.
- Lägg till testfilerna i `test:rules` i `package.json`.

## 13.4 Gränssnitt och prestanda

- Bootgrafen: varken formatet eller three.js nås statiskt.
- Inga emojier från Emoji 13 eller senare.
- Översta raden på projektorn täcks aldrig (1920 × 1080 och 1280 × 720).
- Namn av → "Någon" i flödet och inga namnskyltar. Visslingen visar aldrig namn eller avatar.
- 2D-reserven startar när WebGL saknas.

---

# 14. MANUELL QA

Gör följande med en lärarflik, en projektorflik och minst tre elevflikar mot emulatorn, och lägg skärmbilder i `docs/qa-kurragomma/`:

1. Lobby → STARTA → gömfasen: gå runt, kontrollera mätaren, lås.
2. En elev som inte låser: platsen skickas eller väljs av servern.
3. Letfasen: svara fel → vissling på projektorn och markör hos sökaren. Svara fel igen inom spärrtiden → ingen vissling.
4. Sök: miss, träff, och en elev i ett buskage som kräver att man kommer nära.
5. Hittad → sökare, med start på gömstället.
6. Stäng en elevflik och öppna igen: samma roll och plats.
7. Final med gömställena på kartan.
8. Elevvyn på 1366 × 768 och 380 px. Projektorn på 1920 × 1080.
9. Prestandasidan på den här datorn, med siffror i rapporten.

---

# 15. RAPPORT

I `docs/QA-RAPPORT-kurragomma.md` och i PR-beskrivningen:

1. Vad som byggdes och vad som återanvändes (frågeflödet, rättningen, avatarerna, pluggmynten, demoramverket).
2. Kvotbudgeten med uppmätta siffror för Firestore och Realtime Database, och balanssimuleringen med de slutliga värdena.
3. Bilder per sekund på prestandasidan och vilka nivåer som behövdes.
4. Testresultat och skärmbilder.
5. **Vad som ska deployas och i vilken ordning:** skapa Realtime Database, regler för Firestore och Realtime Database, functions, index.
6. Avvikelser från uppdraget och öppna frågor till Elias.

---

# 16. DETTA SKA INTE GÖRAS

- Gömmarnas exakta platser får aldrig nå projektorn, läraren eller andra elever under matchen. Inte heller vem som visslade.
- Inga positioner för gömmare i Realtime Database eller Firestore under gömfasen.
- Ingen ska åka ut, och inget får vara läskigt.
- Inget CDN vid körning och inga nya beroenden utöver three.js.
- Ändra inte befintliga formats beteende.
- Inga emojier från Emoji 13 eller senare.
- Påbörja inte etapp 2 utan klartecken.
