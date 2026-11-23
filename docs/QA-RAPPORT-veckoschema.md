# QA-rapport – Veckoschema per klass, och Matchdagen följer det som är synligt (epic #898)

Slut-QA för #904, Del F i `UTVECKLINGSUPPDRAG_VECKOSCHEMA.md` (F.1–F.5).
Testat på epic-grenen @ `636e55f5`, där A–E (#899–#903) är sammanslagna. Jämförelsen är `origin/main` @ `5bd29054`.
Skärmdumparna ligger i [`docs/veckoschema-904/`](veckoschema-904/).

**Resultat:** allt är grönt.
- Stegen 1–7 i F.1 klarar sig i appen mot emulatorn, och sommar- och vintertiden stämmer.
- Alla sviter är gröna.
- Bootgrafen är oförändrad: 107 filer, identisk med `main`.
- C.4 håller: 4 klick för att lägga in "Matte 8.20–9.00 alla dagar" och 1 klick för att aktivera.
- QA hittade inga nya buggar i epicen. Kvar finns fyra kända låga fynd (§7) och en avvikelse i kvoten (§5.1).

---

## 1. Vad som har byggts, per del

| Del | Issue (merge) | Innehåll |
| --- | --- | --- |
| A – Matchdagen följer synligheten | #899 (`638cd76d`) | A.1: frågekällorna = de valda ∩ elevens synliga områden (klient och server via `delat/md-synlighet.js`). A.2: "Samma som Plugga" (`matchdagenInst.foljPlugga`) och ny standard för elever utan inställningar. A.3: lärarens panel visar ett valt men dolt område gråat med "Dolt för klassen – används inte just nu" och "Byt till Samma som Plugga" när inget ger frågor. Regeln `foljPlugga` i `validMatchdagenInst`. Docs: MATCHDAGEN §24. |
| B – kärnan | #900 (`70509ecc`) | `src/klass-schema.js` och `klass-schema-tid.js` med ren logik: `normalizeSchema`, `aktivLektion` (svensk tid via Intl), `schemaForStudent` (unionen över klasser, "inga synliga områden = allt"), `gateForSchema`, `kombineradGrind` (låset går före) och `nastaSchemaAndring`. `classes/{id}.schema` i datamodellen och reglerna (`hasClass`, ≤ 60 lektioner, kända kopplingsnycklar). `amnesTips` i modulregistret. |
| C – lärarsidan | #901 (`d9938cd1`) | Sektionen "Veckoschema" längst ned i fliken Fokusläge. Den har kryssrutan "Aktivera veckoschemat", raden om läget, veckan Mån–Fre, "+ Lägg till lektion" (ämne, från, till, fem dagar) och kort med Ändra / Ta bort. Kopplingen ligger ihopfälld och visas bara om gissningen misslyckas. 📅 på klassväljaren. Allt sparas direkt. Guiden "Veckoschema" finns i Hjälp. |
| D – elevsidan | #902 (`954bdeca`) | `class-lock-watch.js` räknar fram den kombinerade grinden. Timern går till nästa ändring, med 15 s-intervall och flik-återkomst som skyddsnät. Menyn och Plugga-listan visar bara lektionens ämne ("📅 Nu är det NO till 4.00"). Direktlänk ger en toast, och lektionsslut ger "Lektionen är slut – nu syns allt igen. 🎉". |
| E – Matchdagen under en lektion | #903 (`636e55f5`) | Ämnesfiltret, reserven "Samma som Plugga inom ämnet" och spärren med gråad menylänk ("Öppnar 10.00"). Servern (`md-vanskap-lobby.js`) tillämpar samma regler med serverns tid när en vänskapsmatch startar. En pågående match spelas klart. |
| F – QA | #904 (denna) | Den här rapporten och skärmdumparna. Ingen produktionskod har ändrats. |

## 2. Testresultat

### 2.1 Sviterna (HEAD `636e55f5`)

| Svit | Kommando | Resultat |
| --- | --- | --- |
| Enhetstester (Node, ren logik) | `node --test <343 filer>` (alla `test/*.test.*` utom emulatorfilerna i `test:rules`, `test:functions`, `test:import` och `test:e2e`) | **5033 pass av 5041**, 1 skipped. De två röda är inte epicens och blev gröna ensamma (§9). |
| Regler | `bash admin/qa-matchdagen-867-svit.sh test:rules` (slumpportar, ensam emulator) | **1216 / 1216 pass**, 0 fail |
| Functions | `bash admin/qa-matchdagen-867-svit.sh test:functions` | **651 pass**, 0 fail, 2 todo (Schack F9, accepterat sedan tidigare) |
| Bootgrafen | `node admin/qa-bootgraf-bfs.mjs origin/main` mot `HEAD`, diff | **107 = 107, identisk** |

Ingen flake behövde köras om: båda emulatorsviterna gick gröna i första körningen, under det delade låset `/tmp/pp-emulator.lock`.

### 2.2 Sommar- och vintertid, och andra tidszoner

1. **`test/klass-schema.test.mjs`** (från #900) testar fyra saker:
   - sommartidshelgen: söndag 29 mars 2026. Fredag 09:00 = 08:00 UTC och måndag 09:00 = 07:00 UTC.
   - vintertidshelgen: söndag 25 oktober 2026. Fredag 09:00 = 07:00 UTC och måndag 09:00 = 08:00 UTC.
   - "nästa ändring" över båda helgerna.
   - en dator i en annan tidszon.

   Alla fyra är `ok`. Schemats egna tester körs här under fyra `TZ`: `klass-schema`, `klass-schema-larare`, `matchdagen-lektion-903` och `matchdagen-synlighet-899`, med 136 tester per körning.

   | `TZ` | pass / fail |
   | --- | --- |
   | Europe/Stockholm | 136 / 0 |
   | UTC | 136 / 0 |
   | America/New_York | 136 / 0 |
   | Asia/Tokyo | 136 / 0 |

2. **Oberoende svep (QA, utanför repot).** Facit kommer från en egen CET/CEST-tabell enligt EU-regeln, inte från Intl.
   - Lektionen 08:10–09:00 alla vardagar.
   - `aktivLektion` prövas var 10:e minut genom hela 2026 och 2027, alltså 104 976 tidpunkter.
   - Både `src/klass-schema.js` och serverns kopia `functions/matchdagen/kallor/klass-schema.js` prövas. Kopian är byte-identisk med `src`.
   - Sju tidszoner prövas: Stockholm, UTC, New York, Tokyo, Lord Howe (halvtimmes sommartid), Kiritimati (+14) och St John's (−3:30).

   Resultat: **0 fel** i alla tidszoner. `nastaSchemaAndring` gav rätt svar i fyra fall:
   - fredag 10:00 före sommartiden → måndag 08:10 CEST (06:10Z)
   - fredag 10:00 före vintertiden → måndag 08:10 CET (07:10Z)
   - mitt i natten när klockan ställs fram
   - under den dubbla timmen när klockan ställs tillbaka

3. **I appen:** webbläsaren i riggen går i **UTC**, alltså en dator i en annan tidszon. Läraren och eleven fick ändå svensk tid hela vägen:
   - lektionen 1.00–4.00 svensk tid var aktiv kl. 02.2x svensk tid (01.2x UTC)
   - "Nu: NO till 4.00"
   - slutet ändrades till 2.24 och gick ut 02:24:02 svensk tid

### 2.3 F.1 i appen mot emulatorn (stegen 1–7)

**Riggen:**
- Webbläsaren styrdes via Chrome DevTools (barista-browser), med samma flöde som Playwright skulle köra. Playwright finns inte i rigg-cachen.
- Riggen var en kopia av `admin/qa-matchdagen-874-preview.sh` med functions, auth och firestore, plus `admin/qa-matchdagen-903-seed.mjs`.
- Läraren var `qaarskurs4` (4A/4B) och eleven Alva (`4a01`, har Matchdagen).
- Tiden var måndag 23 november 2026, cirka 02.05–02.45 svensk tid.

| # | Steg | Resultat |
| --- | --- | --- |
| 1 | Läraren lägger in **NO 1.00–4.00 mån** i lärarsektionen och bockar i "Aktivera veckoschemat". | **PASS.** "Sparat ✓", "Nu: **NO** till 4.00 – eleverna ser NO." och klassknappen "4A 📅". |
| 2 | Eleven ser bara lektionens områden, och en spärrad direktlänk ger toasten. | **PASS.** Plugga-listan visar bara "🫀 NO Kroppen" under "📅 Nu är det NO till 4.00". Menyn visar Hem, Shoppen, Plugga och Matchdagen; Läsresan och Bråkresan är borta. Direktlänkarna `#/elev/omrade?subj=so&area=vikingatiden`, `#/elev/lasresan` och `#/elev/brakresan` går till `#/elev/plugga` med "Just nu är det NO-lektion. Det här öppnas igen klockan 4.00." Shoppen, Hus, Matchdagen och NO-området öppnas (B.5). |
| 3 | Lektionens slut ändras till om en minut (Ändra → Till 02:24). | **PASS.** Kl. 02:24:02 kom Läsresan, Bråkresan och alla tre områdena tillbaka i menyn, med toasten "Lektionen är slut – nu syns allt igen. 🎉" (en gång). Sidan laddades inte om: samma dokument och `performance.now()` 164 s. När slutet sattes tillbaka till 4.00 slog lektionen igenom igen utan omladdning. |
| 4 | Läraren låser klassen med fokusläget under lektionen (Vikingatiden +15 min) och låser sedan upp. | **PASS.** Låset gäller: "🎯 Fokus: Vikingatiden", bara Vikingatiden visas och NO-lektionen ignoreras. Efter "Lås upp nu" gäller schemat igen ("📅 Nu är det NO till 4.00", bara Kroppen), utan omladdning. |
| 5 | "Aktivera veckoschemat" bockas ur och sedan i igen. | **PASS.** Urbockat syns alla tre områdena och modulerna direkt. Ibockat igen gäller samma 26 lektioner: "NO till 4.00", bara Kroppen. Ingen omladdning. |
| 6 | Matchdagen spelas under NO-lektionen. | **PASS.** En hel match (till 90') gav 16 frågor, och alla kom ur NO/Kroppen: "Vad betyder lungor?", "Vilket organ pumpar blodet?", "Vad andas vi in?" och fler. Inga matte- eller SO-frågor. |
| 7 | Bootgrafen | **PASS.** 107 filer, identisk med `main` (§2.1). |

**Fler kontroller i appen:**
- Utan lektioner och ibockat står det "Lägg till lektioner så börjar schemat gälla." (4B).
- Krockmeddelandet lyder "Lektionen krockar med SO 9.10–10.00 på måndag."
- Ingen horisontell scroll på 375 px: `scrollWidth` 360 = `clientWidth`.

Vänskapsmatchernas serverregler (E.5) kördes inte om i webbläsaren, eftersom vänskapsfliken är pausad (#894). De täcks av `functions-matchdagen-lektion-903.test.mjs`, som ingår i de 651 gröna testerna, och av #903-testarens körning via `md-vanskap-moln.js`.

## 3. Skärmdumpar

### 3.1 Lärarsektionen (C.4)

| Läge | Bred (1920) | Smal (375) |
| --- | --- | --- |
| Utan lektioner | [c4-1-tom-bred.png](veckoschema-904/c4-1-tom-bred.png) | [c4-1b-tom-375.png](veckoschema-904/c4-1b-tom-375.png) |
| Full vecka (25 lektioner), **inte** aktiverad | [c4-3-vecka-av-bred.png](veckoschema-904/c4-3-vecka-av-bred.png) | [c4-6-vecka-av-375.png](veckoschema-904/c4-6-vecka-av-375.png) |
| Samma vecka (+ NO 1.00–4.00), **aktiverad** | [c4-4-vecka-pa-bred.png](veckoschema-904/c4-4-vecka-pa-bred.png) | [c4-5-vecka-pa-375.png](veckoschema-904/c4-5-vecka-pa-375.png) |
| Rutan "Lägg till lektion" | [c4-2-lagg-till-ruta.png](veckoschema-904/c4-2-lagg-till-ruta.png) | – |

Den headless webbläsaren saknar emoji-typsnitt, så emojierna (📅, 🔓) syns som rutor på skärmdumparna. Appens text innehåller dem.

### 3.2 Eleven

- Plugga-listan under en lektion: [d-1-plugga-under-lektion.png](veckoschema-904/d-1-plugga-under-lektion.png)
- Toasten efter en spärrad direktlänk: [d-2-direktlank-toast.png](veckoschema-904/d-2-direktlank-toast.png)
- Fokuslåset går före lektionen: [d-3-las-gar-fore.png](veckoschema-904/d-3-las-gar-fore.png)
- Matchdagen efter en NO-match: [e-1-matchdagen-slut.png](veckoschema-904/e-1-matchdagen-slut.png)

### 3.3 Matchdagen-panelen (A.3)

- "Samma som Plugga" ("Just nu: 2 Plugga-områden och 1 Räkna-område som klassen ser."): [a-2-matchdagen-panel-samma-som-plugga.png](veckoschema-904/a-2-matchdagen-panel-samma-som-plugga.png)
- "Välj områden själv" med det valda men dolda området "Vikingatiden – repetition" gråat (opacitet 0,6) och texten "Dolt för klassen – används inte just nu": [a-1-matchdagen-panel-dolt-gratt.png](veckoschema-904/a-1-matchdagen-panel-dolt-gratt.png)

## 4. Enkelhetsgranskningen (C.4)

**Klicktestet**, från fliken Fokusläge:

| Uppgift | Klick | Mål | |
| --- | --- | --- | --- |
| Lägg in "Matte 8.20–9.00 alla dagar" | **4**, plus att skriva "20" i minutfältet | ≤ 6 | ✅ |
| Aktivera schemat | **1** (kryssrutan) | 1 | ✅ |
| Stäng av schemat | **1** | 1 | ✅ |

De fyra klicken är:
1. "+ Lägg till lektion"
2. Ämne → Matematik
3. Från, minutfältet → 20
4. "Lägg till"

Två standardvärden sparar klick: Till är redan 09:00 och alla fem dagar är ibockade. Resultatet blev fem kort "Matematik 8.20–9.00" och "Sparat ✓".

**Inget annat på lärarsidan har ändrats.** Före och efter kördes mot samma emulator och samma data:
- Före: `main` @ `5bd29054`, serverad med `QA_ROOT` i en egen förhandsvisning.
- Efter: HEAD.

Texten i `main` jämfördes rad för rad för Hem, Mina klasser (alla fyra flikarna, 4A och 4B), Material, Prov och Live. Skärmdumparna av Hem är [c4-7-hem-fore.png](veckoschema-904/c4-7-hem-fore.png) och [c4-8-hem-efter.png](veckoschema-904/c4-8-hem-efter.png).

| Sida | Skillnad |
| --- | --- |
| Hem, Material, Prov, Live | **ingen** (Hem: "Jobbar med" visade först id-namn i `main` medan biblioteket laddades; efter 8 s identiskt) |
| Mina klasser, flikarna Hur går det? / Vad eleverna ser / Elever | bara 📅 på klassknappen "4A" ("Veckoschemat är aktiverat") – C.1 |
| Mina klasser, fliken Fokusläge | 📅 på klassknappen + sektionen Veckoschema längst ned – C.1 |

C.3 följs: det finns ingen förhandsvisning som elev, inga veckonummer eller datum, ingen import och ingen statistik. Sektionen har inga tekniska ord ("filter", "grind" eller "koppling"). Den ihopfällda länken heter "Vilket ämne hör Läsresan, Mattematchen och de andra till?"

## 5. Kvoten (F.2)

Läsningarna räknades i webbläsaren som `documentChange` i Firestores `Listen/channel`. Skrivningarna räknades som `update` i `Write/channel`. Datat är 4A i riggen: 4 ämnen och 9 områden i biblioteket, och 26 lektioner på måndagen fördelade på alla fyra ämnena.

| Situation | Läsningar | Jämfört med utan schema |
| --- | --- | --- |
| Alva (har Matchdagen), schemat **av**: Hem efter inloggning | 10 (classes 7, studentData 1, liveSessions 2) | – |
| … sedan Plugga | +14 (subjects 4, areas 9, studentData 1) → **24** | – |
| Alva, schemat **på**, NO-lektion pågår: Hem | **23** (+ subjects 4, areas 9) | **+13 vid start** |
| … sedan Plugga | +1 (studentData) → **24** | **±0 för sessionen** |
| Cleo (utan Matchdagen), schemat på, lektion pågår: Hem | 14 (+ subjects 4) | **+4 vid start** |
| … sedan Plugga | +2 (bara `qano`-områdena + studentData) | färre än utan schema |
| Matchdagen under lektionen: avspark + 6 frågor | **0** vid start, **0** per fråga | ±0 |
| Lärarsidan: aktivera, avaktivera, lägg till lektion (3 sparningar) | 3 `Write/channel`-POST, var och en **1 update** på `classes/4a` med `updateMask` `["schema"]` | **1 skrivning per sparning** ✅ |
| Servern, vänskapsmatchens start | högst `MAX_OMRADEN` (60) områden per elev, + `classes` (1) som sedan #899 | oförändrat mot #899 (`functions-matchdagen-synlig-899*` testar taket) |

### 5.1 Avvikelse mot F.2 ("0 nya läsningar" på elevsidan)

Schemat ligger på klassdokumentet och ger själv 0 läsningar. Men när en lektion pågår eller återstår **i dag** gör bevakaren ändå extra läsningar vid start:
- Den hämtar ämnena (4).
- För elever med Matchdagen hämtar den också lektionsämnenas områdeslistor (här 9).

Läsningarna går genom Plugga-listans TTL-cache, och den som sedan öppnar Plugga läser inte om dem. Under en session med Plugga blir det alltså lika många läsningar som utan schema, eller färre.

Utan lektion kvar i dag, på helgen, och för en klass utan schema eller med schemat avstängt blir det 0 extra. Det är dokumenterat i VECKOSCHEMA.md §Elevsidan/Kvot och MATCHDAGEN §25.2, och är fyndet "#902 ~6 extra läsningar per lektionsdag" (§7). Med 4 ämnen blev det här 4 respektive 13.

## 6. Deploy

Ordningen för hela epicen är **regler → functions → webben**:
1. `firebase deploy --only firestore:rules`. Reglerna gäller `classes.schema` (#900) och `foljPlugga` i `validMatchdagenInst` (#899). Utan dem nekas lärarens sparning och "Samma som Plugga".
2. `firebase deploy --only functions`. #899 och #903 ändrar `md-vanskap-lobby.js` och `md-vanskap-fragor.js` och kopiorna i `functions/matchdagen/kallor/` (`klass-schema*.js`, `md-synlighet.js`). Vänskapsmatcherna följer då synligheten och lektionen.
3. Webben (Pages).

Inga nya index, inga RTDB-regler och ingen migrering. Bootgrafen är oförändrad, så det finns ingen risk för en vit sida under Pages-deployen.

## 7. Fynd

QA hittade inga nya buggar i epicen. De kända låga fynden står kvar, och ingen av dem blockerar:

| Fynd | Var | Allvar |
| --- | --- | --- |
| #899 F2 – panelens synlighet för en elev i **flera klasser**: panelen prövar den öppna klassen, medan eleven spelar med Plugga-listans klass. De kan skilja sig. Dokumenterat val (MATCHDAGEN §24.3). | `md-anpassningar-panel.js` | låg |
| #901 F1 – Ändra-rutan hamnar långt från kortet på 375 px. | `teacher-class-schema.js:83` | låg |
| #901 F2 – `errText` säger "kan bara admin" när en sparning nekas. | lärarsektionen | låg |
| #902 – cirka 6 extra läsningar per lektionsdag efter 30 s-cachen (här 4 utan och 13 med Matchdagen vid start, ±0 över en session med Plugga), §5.1. | `class-lock-watch.js` (`schemaInfoBehov`) | låg |
| #903 – "Öppnar"-tiden med **lektioner i följd** som båda spärrar Matchdagen: menylänken visar den första lektionens slut, inte när Matchdagen faktiskt öppnar. | gråad Matchdagen-länk | låg |

Observationer utanför epicen:
- **Fokuslåsets klockslag visas i datorns lokala tid** (`formatKlockslag` i `class-lock.js`, `getHours`, oförändrad sedan `main`). Schemat visar svensk tid. På en dator i UTC visade eleven samtidigt "Fokus: … till 01:40" och "NO till 4.00". Det spelar ingen roll på svenska skoldatorer.
- `docs/VECKOSCHEMA.md` är fortfarande märkt "Utkast" överst. Märkningen kan tas bort när epicen landar.

## 8. Val där uppdraget inte räckte till

Valen är dokumenterade i respektive del:
- **Lektionernas innehåll prövas bara i klienten** (`normalizeSchema`, `lektionKrock`). En kontroll per lektion når reglernas gräns på 1000 uttryck redan vid cirka 10 lektioner (uppmätt i #900). Reglerna prövar vem som skriver, fälten, listans längd (≤ 60) och kopplingens nycklar. En ogiltig lektion som skrivits förbi klienten gör ingenting hos eleven (VECKOSCHEMA §Datamodellen).
- **Elevens grind hämtar ämnen och lektionsämnenas områden vid start** när en lektion pågår eller återstår i dag (§5.1). Annars kan menyn och "Öppnar"-tiden inte veta ämnets namn och kopplingen. Allt går genom Plugga-listans cache.
- **E.2, reserven:** ger lektionsämnet inga områden med underlag men tabellerna är kopplade blir det tabellerna 0–10. Tabellerna hör då till lektionen (MATCHDAGEN §25).
- **Panelen prövar den öppna klassen** för en elev i flera klasser (#899 F2).
- **"Samma som Plugga" är ny standard** bara för elever utan inställningar. Gamla inställningar läses som `foljPlugga: false` (MATCHDAGEN §24.2).
- **En pågående vänskapsmatch** lämnas orörd när en lektion börjar, och servern prövar fokuslåset före schemat (#903-granskningen).
- **Lärarens sparade koppling går före gissningen** (`effektivKoppling`). En ny modul behöver bara en rad `amnesTips` i registret (VECKOSCHEMA §Ämneskopplingen).

## 9. Enhetstesterna – resultat

`node --test` kördes på 343 filer: alla `test/*.test.*` utom de 175 emulatorfilerna i `test:rules`, `test:functions`, `test:import`, `test:e2e` och `test:rules:rtdb`. Resultatet: **5041 tester, 5033 pass, 1 skipped**. Två saker var röda, och ingen av dem gäller epicen:

| Röd | Orsak | Omkörning |
| --- | --- | --- |
| `firestore-rules-amneslasning-texter.test.js` (1 fail + 6 avbrutna) | Det är ett emulatortest från #673 som aldrig registrerades i `test:rules`. Utan emulator säger det "host and port … must be specified". Det finns så redan på `main`. | Kördes ensamt mot en egen Firestore-emulator: **6 / 6 pass** |
| `schack-motor.test.js` "tidsgränsen (§3.1): högst ~1 s per drag, mätt" | En tidsmätning som flakar under last (känt sedan #901) | Kördes ensam på HEAD: **25 / 25 pass** |

Därmed är alla enhetstester gröna. Att `firestore-rules-amneslasning-texter.test.js` saknas i `test:rules` hör till `main`, inte till epicen. Det kan läggas till i en senare städning.
