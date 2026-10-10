# Trollkarlsduellen – slut-QA (#541, epic #535)

Slut-QA av epic-grenen efter A–E (#536–#540), 2026-10-08. Spec:
`docs/spec-trollkarlsduellen.md` (§16, §17, §20, §23, §24). Arkitektur:
`docs/trollkarlsduellen-arkitektur.md`.

**Resultat: allt grönt efter två små fixar (se "Buggar"). Inga kända
regressioner i övriga Live-vyer.** Tre observationer till leaden längst ner.

## Klickguide för Elias

### 1. Demoläget (ingen inloggning, ingen Firestore)
Öppna `preview/preview-trollkarlsduellen.html` (i previewn: `/preview/preview-trollkarlsduellen.html`).
Panelen nere till vänster har allt från spec §21: +10 rätt A/B, full mätare,
98 → 103, båda fulla samtidigt, slumpattack, valfri attack från vänster/höger,
ledningsbyte, 35 s / 10 s kvar, byt trollkarlar, matchslut, oavgjort, Rasmus
vinner, Elias vinner, omladdningstest. Klicka en gång i bilden för ljud.
Figurerna separat: `preview/preview-trollkarl-figurer.html`.

### 2. Riktig match i emulatorn
Starta (eller låt den gå – den lämnades igång på port **8542**):

```bash
JAVA_BIN=/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin \
FIREBASE_BIN=~/.npm/_npx/7750544ccf494d8b/node_modules/.bin \
bash admin/qa-trollkarlsduellen-preview.sh      # Firestore 8541, Auth 9541, proxy 8542
```

1. Öppna previewn → **Lärare →** → logga in `elias` / `lilla123` (endast emulator).
2. Meny **Live** → under "Aktiva Live-sessioner" finns **4B mot 5E**
   (`trollkarl-demo`, 5 min, 4B = Elias, 5E = Rasmus, nämnare 10/22) →
   **Öppna projektorvy**. (Eller skapa en egen: kryssa 4B + 5E → rutan
   "🧙 Trollkarlsduellen" dyker upp med ⇄ Byt.)
3. I lobbyn: **⇄ Byt trollkarlar** byter direkt (sparas i matchen).
4. Simulera elever i en terminal (riktiga elevskrivningar, reglerna prövar varje svar):
   ```bash
   E="FIRESTORE_EMULATOR_HOST=127.0.0.1:8541 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9541"
   env $E node admin/qa-mm-live-sim.mjs join trollkarl-demo 4b:10 5e:22   # eleverna "redo"
   ```
5. **▶ STARTA MATCH**, välj fliken **🧙 Trollkarlsduellen** (eller tangent 4).
6. Efter nedräkningen (4 s):
   ```bash
   env $E node admin/qa-mm-live-sim.mjs svar trollkarl-demo 4b=98 5e=60    # ingen attack
   env $E node admin/qa-mm-live-sim.mjs svar trollkarl-demo 4b=103         # exakt EN attack, mätaren 3/100
   env $E node admin/qa-mm-live-sim.mjs svar trollkarl-demo 4b=250 5e=500  # 5E har flest rätt …
   ```
   … men 4B leder på snittet (25,0 mot 22,7) → 4B (Elias) vinner när tiden tar slut.
7. "📺 Öppna elevskärm" i verktygsraden ger den utvidgade skärmen (följer vyvalet).
8. Kontrollera matchen: `env $E node admin/qa-trollkarlsduellen-kontroll.mjs visa trollkarl-demo`.
   Ny kort match: `… kontroll.mjs ny min-match 60 4b:10,5e:22 4b=rasmus` → öppna
   `#/larare/live?id=min-match`.
9. Matchen **4B, 5E och 4A** (`tre-klasser`) visar att Trollkarlsduellen inte är
   valbar med fler än två klasser.

## Verktyg som byggts i #541

| Fil | Vad |
|---|---|
| `admin/qa-trollkarlsduellen-preview.sh` | Emulator + seed (qa-mm-live-seed) + två lobby-matcher + proxy 8542 |
| `admin/qa-trollkarlsduellen-kontroll.mjs` | `visa` / `ny` / `starta` / `regler` (wizards-reglerna som lärare) |
| `admin/qa-trollkarlsduellen-visuell.mjs` | Puppeteer mot demoläget: alla attacker × båda håll (skärmdumpar, återställning, ljud, bildrutor), alla finalvarianter × båda vinnarna + oavgjort, minne före/efter. `--reduced`, `--size`, `--varv` |

Kör det visuella skriptet med `NODE_PATH=<mapp med puppeteer-core + sharp>`
(puppeteer-core finns inte i repots beroenden – medvetet, det är ett QA-verktyg).

## Testsviter

| Svit | Resultat |
|---|---|
| Enhetstester (`node --test test/*.test.js`, 106 filer) | **1285/1285** |
| Regeltester (`npm run test:rules`, inkl. `firestore-rules-live-trollkarl`) | **328/328** |
| e2e (`npm run test:e2e`) | **5/5** |
| Bootgraf (`admin/qa-bootgraf-bfs.mjs`) main 4fdd7d1 vs HEAD | **107 = 107, identisk** (alla nya filer bara dynamiska) |
| App-boot i riktig browser (headless Chrome via proxy) | ✅ startsidan, lärarinloggning, elevinloggning, Live, MM utan konsolfel |

## §20 Funktionella tester

Emulator = riktig match via proxyn (lärarklient + `qa-mm-live-sim`), Demo =
`preview/preview-trollkarlsduellen.html`, Pupp = `qa-trollkarlsduellen-visuell.mjs`.

| Krav | Resultat | Bevis |
|---|---|---|
| Rasmus kan representera valfri klass | ✅ | Emulator: `qa-avsluta` 4B = Rasmus (vänster); demo 4B = Rasmus |
| Elias kan representera valfri klass | ✅ | Emulator: UI-skapad match 4B = Elias, `qa-avsluta` 5E = Elias |
| Kopplingen kan bytas före matchstart | ✅ | Formuläret (⇄ Byt, behålls när en 3:e klass kryssas i/ur), lobbyn (⇄ Byt trollkarlar → Firestore uppdateras, elevskärmen visar nya kopplingen). Regler: byte i lobby godkänt; samma trollkarl på båda / okänd klass / okänd trollkarl / wizards i 3-klassmatch / byte när `live` eller `finished` **nekas** (`kontroll.mjs regler`) |
| Rätt klassresultat visas | ✅ | HUD = `rätt ÷ nämnare` med en decimal, t.ex. 320 ÷ 10 = 32,0 och 500 ÷ 22 = 22,7; nämnaren ändrad i lobbyn (20 → 10) slog igenom |
| Matchklockan använder befintlig tid | ✅ | HUD-klockan = `startedAt + 4 s + längd` mot klockan (02:53 när 172,8 s återstod), samma som verktygsradens timer |
| Rätta svar fyller rätt magimätare | ✅ | 98/60 → mätare 98/100 och 60/100 på rätt sida |
| 100 rätt utlöser en attack | ✅ | 98 → 103: exakt 1 attack (4B #1), mätaren 3/100 ⚡1 – på panel OCH elevskärm, samma attack (seedad) |
| 200 rätt utlöser nästa attack | ✅ | 199 → 200: 4B #2 |
| Enbart rätt trollkarl attackerar | ✅ | `attack`-händelserna har rätt `from`; skärmdumparna: vänster-attack träffar höger och tvärtom (alla 17) |
| Motståndaren får rätt effekt | ✅ | Pupp: 34 körningar, offret på motsatt sida i varje skärmdump (ark i `/tmp/qa541/vis-1920`) |
| Figuren återgår till normal form | ✅ | Pupp: efter varje attack båda `data-state=IDLE`, effektlagren tomma, DOM-noder ±0 |
| Båda klasserna kan attackera | ✅ | Emulator: 4B #1–3, 5E #1–5 |
| Slumpgeneratorn väljer mellan samtliga | ✅ | `pickAttack` över 200 sessioner × 2 klasser × 30 attacker: alla 17 valda (667–738 ggr), 0 upprepningar i följd |
| Alla 15 (17) attacker fungerar | ✅ | Pupp 1920×1080 + 1280×720 (reducerad rörelse): 17 × 2 håll, inga konsolfel, alla återställda |
| Två samtidiga attacker | ✅ | Emulator: 4B 199→200 och 5E 99→100 parallellt → båda köade, spelade efter varandra (5E #1, sedan 4B #2). 5E 230→500 = 3 attacker i kö, komprimerade (rushFor) |
| Omladdning orsakar inte dubbla attacker | ✅ | Omladdning mitt i match: 0 attackhändelser, mätare 0/100 ⚡2 och 0/100 ⚡1, rätt ställning, klocka, trollkarl per sida. Vybyte Raket → Statistik → Trollkarl: ingen omspelning |
| Matchslut fungerar | ✅ | 00:00 → stopp, final efter historikens `result` (~2,5 s); lärarens **Avsluta** mitt i en attack: attacken avbröts, kön tömdes, finalen startade |
| Rätt vinnare visas | ✅ | 4B 320 rätt/10 = 32,0 mot 5E 500/22 = 22,7 → "🏆 4B VINNER!" (= `result.winner: "4b"`, färre absoluta rätt men högre snitt). `qa-avsluta`: 5E 9,1 mot 5,0 → 5E/Elias |
| Oavgjort hanteras | ✅ | 150/10 mot 150/10 → `result.winner: "draw"`, finalen `magisk-krock`, "OAVGJORT!", båda IDLE (ingen VICTORY) |
| Slutanimationen spelas exakt en gång | ✅ | `finale`-händelse 1 gång per fönster; omladdning efter slut → resultatskärm direkt utan final; Pupp: `antalKorningar = 1` i alla 22 finalkörningar |
| Befintliga livevyer fungerar | ✅ | Se Regression |
| Elevupplevelsen som tidigare | ✅ | Elev e22 i egen browserkontext: Live-listan, "Gå med", 5 svar i UI:t räknades, vinnarbesked "🏆 VINNARE – 5E!" |

### §16 robusthet (utöver tabellen)
- **Kort nätverksavbrott**: panelen offline (CDP) medan 4B 200 → 310 och 5E 100 → 230;
  mätarna frös, klockan gick vidare; online igen → ikapp på < 1 s med exakt EN
  attack var (4B #3, 5E #2) och rätt mätare (10/100, 30/100).
- **Deltagare ansluter/lämnar**: elever joinade under lobby och match (sim + UI) utan störning.
- **Vybyte under aktiv match** påverkar inte matchen (vyvalet är lokalt; Firestore orört) och
  elevskärmen följer vyvalet.
- **Efter final → annan vyflik** = vanliga vinnarskärmen (`proj-winner`) ✅ (se observation 1).

## §20 Visuell kontroll

| Krav | Resultat | Bevis |
|---|---|---|
| Rasmus/Elias liknar referenserna | ✅ (Elias godkänt) | |
| Identitet | ✅ | Rasmus: svarta glasögon + skägg, blå/turkos; Elias: guldglasögon + mustasch, lila/guld – även som groda/höna/potatis (förvandlingarna bär rätt drag och hattfärg). Aldrig omvänt i någon av 34 attack- eller 22 finalbilder |
| Hela animerade kroppar | ✅ | |
| Attackerna har olika förlopp | ✅ | Kontaktark `/tmp/qa541/vis-1920/ark-01..02.jpg` |
| Ansiktsuttryck syns | ✅ | gråt/sur/glad/förvånad i skärmdumparna |
| Trollkarlarna överlappar inte poängen | ✅ | HUD ligger ovanpå (z-index); håret går in under panelens nederkant, siffrorna fria |
| 16:9 | ✅ | 1920×1080 och 1280×720 (letterbox, inget klipps) |
| Matchklockan alltid läsbar | ✅ | även under attacker/final; röd glöd sista 10 s |
| Finalen genomarbetad | ✅ | Alla 3 vinstvarianter (energikula, potatis-gigantus, drakus-finalus) × båda vinnarna + oavgjort, mitt-i-bilder 1,5/3,5/5,5/7,5 s |
| Verktygsraden vid 1280×720 | ✅ efter fix | Raden täckte "👑 LEDER"-märket och klockramens överkant (~16 px) – och tonade bara bort efter en musrörelse. Nu tonar den bort efter 3,5 s även utan mus |
| Reducerad rörelse (första browsertestet) | ✅ efter fix | `prefers-reduced-motion` emulerat i Chromium: 0 oändliga animationer, alla 17 × 2 attacker + alla finaler körs och återställs, HUD/klocka/poäng intakta. Attacknamnet syntes ALDRIG (fixat) |

## §17 Prestanda (headless – SwiftShader, ingen riktig GPU)

- **Bildrutor** (rAF-intervall under varje attack, 1920×1080): p50 16,7 ms (60 fps) för
  15 av 17 attacker; **HATTUS GIGANTUS och DANSUS DISCUS p50 33 ms** (30 fps, 13–20
  intervall > 50 ms). Trace (HATTUS + DANSUS, 19 s): huvudtråden 18 % upptagen, en
  lång task 75 ms (attackstart), 9 % tappade bildrutor → raster/GPU-bundet i
  SwiftShader, inte JS. Bör ses på en riktig skoldator; inget åtgärdat.
- **Minne**: JS-heap efter GC 2,37 → 2,82 MB efter 34 attacker, DOM-noder 940 → 947,
  lyssnare 52 → 52. **Långkörning 102 attacker** (3 varv × 17 × 2 håll, 1280×720, ~13 min):
  heap 2,36 → 2,98 MB, noder 940 → 959 (dokumentets totala, inkl. frikopplade),
  lyssnare 52 → 52; scenens DOM ±0 efter varje attack, 1644/1644 ljudkällor avslutade,
  alla 102 återställda, bildrutor p50 16,7 ms i alla tre varven (ingen försämring).
  Tillväxten är avtagande (+0,45 MB efter 34, +0,62 MB efter 102) → ingen läcka att tala
  om; en 30-minutersmatch har typiskt 5–20 attacker.
- **Ljud**: 548 Web Audio-källor startade, 548 avslutade (inget hänger); med reducerad
  rörelse 528/528. Ljud av → matchen påverkas inte (ljud går bara via `fx()`).
- **Inga hängande animationer**: antalet oändliga animationer (58 = arena + idle) är
  detsamma före och efter varje attack.
- **Laddning**: vyn laddas lat (`import()`), ansiktsbilderna förladdas i lobbyn.

## Regression (§1, §24.14)

| Vy/flöde | Resultat |
|---|---|
| Raketrace (3 klasser), Statistik, Dragkamp (2 klasser) | ✅ ritar, uppdateras live |
| Lobby (2 och 3 klasser), nämnarfält, Avbryt | ✅ (3 klasser: ingen trollkarlsrad) |
| Vinnarskärm (`proj-winner`) efter Dragkamp-match | ✅ konfetti, stjärnor, "Resultatet är sparat" |
| Match med 3 klasser | ✅ Trollkarlsduellen + Dragkamp dolda, tangent 3/4 gör inget, sparat vyval "trollkarl" faller tillbaka på Raketrace |
| Live-ljudknappen i övriga vyer | ✅ "🔊 Ljud på"; blips + slut + vinnarfanfar spelades i Dragkamp (12 källor) |
| Elevskärm (#534) / duplicerat läge | ✅ följer vyval, spelar samma seedade attacker, ingen byt-knapp i readonly-lobbyn |
| Elevsidan live | ✅ |
| Mattematchen (lärarsidan) | ✅ inga konsolfel |
| Produktionsregler före deploy | ✅ Gamla reglerna begränsar inte fälten vid create/lobby-update → tvåklassmatcher med `wizards` fungerar även innan `firestore:rules` deployats (men utan validering/låsning) |

## §24 Definition av färdig leverans

| # | Punkt | Status |
|---|---|---|
| 1 | Vyn "Trollkarlsduellen" går att välja i Live | ✅ flik + tangent 4, bara tvåklassmatcher |
| 2 | Två igenkännbara trollkarlar | ✅ (Elias godkänt; utan hattar – beslut) |
| 3 | Rasmus/Elias till valfria två klasser | ✅ formulär + lobby, regler testade |
| 4 | Tydlig klocka, ställning, klassnamn | ✅ 1920×1080 och 1280×720 |
| 5 | Magimätare kopplade till rätta svar | ✅ absoluta rätt, 98 → 103 = 1 attack + 3/100 |
| 6 | Robust attacksystem | ✅ kö, burst, avbrott, omladdning, nätavbrott |
| 7 | ≥ 15 varierade attacker | ✅ 17 |
| 8 | Levande karaktärer mellan attackerna | ✅ idle + småhändelser |
| 9 | Ljud med av/på | ✅ alla ljud via `proj-sound.fx`, inget hänger |
| 10 | Spektakulär final, rätt vinnare | ✅ 3 varianter, officiellt `result.winner` (snitt) |
| 11 | Korrekt oavgjord final | ✅ |
| 12 | Integration med Live | ✅ bootgraf oförändrad, lat laddning |
| 13 | Genomförda tester | ✅ denna fil |
| 14 | Inga kända regressioner | ✅ |

## Buggar – fixade i #541

1. **Attacknamnet osynligt med reducerad rörelse** (`trollkarl.css`): regeln
   `.tk * { animation-duration: .001s }` gjorde att bannerns `forwards`-animation
   direkt slutade på `opacity: 0`. Nu står namnet stilla i 2,4 s. Verifierat med
   opacitetssampling (0,00 → 1,00) och att normalläget är oförändrat.
2. **Verktygsraden tonade aldrig bort utan musrörelse** (`projector.js`): idle-timern
   startade först vid `pointermove`, så vid 1280×720 täckte raden HUD:ens överkant
   tills läraren rörde musen. Nu startar timern vid montering (alla vyer; raden
   kommer tillbaka vid musrörelse som förut).

## Observationer till leaden (inte åtgärdade)

1. **Envägs efter finalen**: väljer läraren en annan vyflik efter Trollkarlsduellens
   final visas vanliga vinnarskärmen – men då döljs vyflikarna (`kind = winner`), så
   man kan inte gå tillbaka till trollkarlsresultatet utan att ladda om. Liten sak;
   fix vore att visa flikarna i `finished` när en `finale`-vy är tillgänglig.
2. **Reducerad rörelse komprimerar hela förloppet**: `scene.wait` klampas till 400 ms
   och `dur()` till 250 ms, så förvandlingen syns ~1 s och finalen ~2 s innan
   resultatkortet. Inget döljs (HUD, namn, resultat), men pauser är ingen rörelse –
   man kunde behålla vänttiderna. Designval i #538/#540.
3. **Deploy**: `firestore:rules` (liveSessions.wizards) behöver deployas för
   valideringen och låsningen efter lobbyn. Inget deployat här.
4. Miljö, inte buggar: emoji ritas som rutor i headless (saknar emoji-typsnitt);
   demosidan ger en 404 på `favicon.ico`.
