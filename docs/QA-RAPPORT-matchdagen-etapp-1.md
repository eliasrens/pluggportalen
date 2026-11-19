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

(fylls i nedan)
