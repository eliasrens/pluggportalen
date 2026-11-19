# Matchdagen – fotbollsspel per elev

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) (epic #866). Godkänd skiss:
[`preview/preview-matchdagen-skiss.html`](../preview/preview-matchdagen-skiss.html). Rapporten per etapp:
[`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md).

Matchdagen är ett fotbollsspel där varje drag kräver ett rätt svar. Läraren slår på det för **enskilda
elever**, aldrig för en hel klass. Det här dokumentet växer med etapperna:

| Etapp | Innehåll | Status |
| --- | --- | --- |
| 1a (#867) | Moduler per elev (`elevModuler`, `perElev`), lärarens "Anpassningar per elev" (`matchdagenInst`), platshållarsida | klar |
| 1b | Frågekällorna (`md-fragor.js`) och den rena matchmotorn (`src/matchdagen/delat/`) | – |
| 1c | 3D-planen med 2D-reserv, matchvyn, säsongen i Division 6, sparning och statistik | – |

## 1. Moduler per elev (Etapp 1a)

### 1.1 Registret

`STUDENT_MODULES` i `src/gamemode-visibility.js` har fältet **`perElev: true`**: modulen slås på för
enskilda elever i `classes/{classId}.elevModuler = { [uid]: ["matchdagen"] }`. Matchdagen:

```js
{ id: "matchdagen", label: "Matchdagen", ikon: MATCHDAGEN_IKON, grupp: "ova", learning: true, lockable: false,
  optIn: true, perElev: true, routes: ["/elev/matchdagen"] }
```

- `MATCHDAGEN_IKON` är en SVG-fotboll (samma som skissens logga), ingen emoji.
- En per-elev-modul står **inte** i `TOGGLABLE_MODULES` (lärarens klassvisa av/på i Vad eleverna ser) och
  `normalizeEnabledModules`/`normalizeHiddenModules` släpper den. Den ligger i `PER_ELEV_MODULES`, och
  `moduleForRoute` grindar dess route som för andra moduler. `OPT_IN_MODULES` innehåller den (dold när
  klasslistan inte går att läsa).
- `normalizeElevModuler(map, studentIds?)`: bara kända per-elev-moduler, inga tomma listor, högst 100 elever
  (`ELEV_MODULER_MAX`), och med `studentIds` bara klassens elever.

### 1.2 Synligheten

`modulesHiddenForStudent(classes, meId)` (sidomenyn i `ui.js` och routern i `app.js`): en opt-in-modul syns om
någon av elevens klasser har den i `enabledModules` **eller** har eleven i `elevModuler` för den. Bara klasser
där eleven står i `studentIds` räknas, så en lista i en annan klass gör ingenting. Eftersom `enabledModules`
aldrig innehåller `matchdagen` syns den bara för de valda eleverna. Testat i `test/matchdagen-modul.test.js`.

### 1.3 Fokusläget

Matchdagen är `learning: true`: ett klasslås till något annat (område, modul eller prov) stänger den, även
via direktlänk (`class-lock.js lockAllowsRoute`). `lockable: false` – klassen kan inte låsas *till* Matchdagen
(den är per elev), så `validLockShape` i reglerna är oförändrad. Efter ett inlämnat prov med "Välj själv"
(#788) kan läraren välja Matchdagen bland modulerna; den syns ändå bara för de valda eleverna.

### 1.4 Regler

- `classes/{id}.elevModuler` (`validElevModuler`): skrivs av lärare med `hasClass(classId)` (fältet finns i
  årskurskontots tillåtna fält). En **ändrad** map: högst 100 nycklar, bara klassens `studentIds`, och varje
  värde exakt `["matchdagen"]` (`values().hasOnly([['matchdagen']])` – en ny per-elev-modul lägger till sina
  listor där). En oförändrad map stoppar inte andra klass-skrivningar.
- `enabledModules` får aldrig innehålla `"matchdagen"` (`validEnabledModules`, gäller även admin).
- `matchdagenInst/{uid}`: läsa `isSelf(uid) || hasStudent(uid)`, skriva och radera `hasStudent(uid)` med
  formen i `validMatchdagenInst`. Eleven skriver aldrig.
- Tester: `test/firestore-rules-matchdagen-inst.test.js` (nyckel MI i `docs/BEHORIGHETER.md`).

## 2. Lärarens inställningar per elev (Etapp 1a)

**Mina klasser → Elever → Anpassningar per elev** (`src/matchdagen/larare/md-anpassningar.js` + `-panel.js`,
sektionen `anpassningar` i `CLASS_SECTIONS`, laddas med `import()`). Beskrivning av gränssnittet:
`docs/LARARSIDAN_STRUKTUR.md`.

`matchdagenInst/{uid}` (formen och standardvärdena i `src/matchdagen/md-inst.js`):

| Fält | Värden | Standard |
| --- | --- | --- |
| `omraden` | `"ämne/område"`, ≤ 60 (Plugga: quiz utan passage + par) | `[]` |
| `tabeller` | 0–10 | `[]` |
| `rakna` | `"ämne/område"`, ≤ 60 (områden med generator) | `[]` |
| `svarssatt` | `"flerval"`, `"skriv"` | `"flerval"` |
| `klocka` | 0, 30, 60 (sekunder) | 0 |
| `lugnt` | bool | false |
| `paus` | 0, 30, 45, 60 (minuter) | 60 |

`harKallor(inst)` – utan källor visas "Din lärare har inte valt några frågor än" och ingen match kan startas.
`kallNycklar(inst)` ger statistikens nycklar (`omrade:ä/o`, `tabell:7`, `rakna:ä/o`) för `perKalla` i §6.1.

Sparningen (`md-inst-data.js sparaAnpassning`) skriver `classes/{id}.elevModuler` (hela mapen, gamla elever
rensas) och `matchdagenInst/{uid}` i **en** batch.

## 3. Elevens sida (Etapp 1a)

`#/elev/matchdagen` → `src/matchdagen/page-matchdagen.js` (dynamisk import i `app.js`). I Etapp 1a en
platshållare i skissens kvällsarena: "Snart blåser domaren i visslan!" och vilka frågor läraren valt
(`fragorText`), eller meddelandet om saknade frågor.

## 4. Kvoten (Etapp 1a)

| Flöde | Läsningar | Skrivningar | Lyssnare |
| --- | --- | --- | --- |
| Elevens meny | 0 nya (`elevModuler` ligger på klassdokumentet som redan läses, TTL-cache) | 0 | 0 |
| Eleven öppnar Matchdagen | 1 (`matchdagenInst/{uid}`) | 0 | 0 |
| Läraren öppnar Anpassningar per elev | 0 nya (klasser + elever ur sidans store) | 0 | 0 |
| Läraren fäller ut en elev | 1 (`matchdagenInst/{uid}`) + biblioteket en gång per sida (delas med Vad eleverna ser) | 0 | 0 |
| Läraren sparar | 0 | 2 (en batch) | 0 |

## 5. Filer och bootgrafen

Allt nytt ligger i `src/matchdagen/` och laddas med `import()` – bootgrafen är oförändrad (107 filer, testat i
`test/matchdagen-modul.test.js`). I bootfilerna ändrades bara registret (`gamemode-visibility.js`), en route i
`app.js` och lärarens sektions-/flikregister (`teacher-classes-sections.js`, `teacher-mina-val.js`,
`teacher-struktur.js`). Stilarna: `src/styles/48-matchdagen.css` (+ `npm run build:css`).

| Fil | Vad |
| --- | --- |
| `src/matchdagen/md-inst.js` | ren: formen på `matchdagenInst`, `normalizeInst`, `harKallor`, `kallNycklar`, `nyaElevModuler`, `sammanfattning`, `fragorText` |
| `src/matchdagen/md-inst-data.js` | Firestore: `lasInst(uid)`, `sparaAnpassning(cls, uid, { pa, inst })` |
| `src/matchdagen/page-matchdagen.js` | elevens sida (platshållare i 1a) |
| `src/matchdagen/larare/md-anpassningar.js` | lärarens lista per elev |
| `src/matchdagen/larare/md-anpassningar-panel.js` | panelen för en elev |

## 6. Deploy

Etapp 1a: **`firebase deploy --only firestore:rules` före webben** (nya fält och samlingen `matchdagenInst`).
Inga index, inga functions.
