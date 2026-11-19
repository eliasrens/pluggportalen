# Matchdagen – fotbollsspel per elev

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) (epic #866). Godkänd skiss:
[`preview/preview-matchdagen-skiss.html`](../preview/preview-matchdagen-skiss.html). Rapporten per etapp:
[`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md).

Matchdagen är ett fotbollsspel där varje drag kräver ett rätt svar. Läraren slår på det för **enskilda
elever**, aldrig för en hel klass. Det här dokumentet växer med etapperna:

| Etapp | Innehåll | Status |
| --- | --- | --- |
| 1a (#867) | Moduler per elev (`elevModuler`, `perElev`), lärarens "Anpassningar per elev" (`matchdagenInst`), platshållarsida | klar |
| 1b (#868) | Frågekällorna (`md-fragor.js`), frågekortet (`md-svar.js`), den rena matchmotorn och ligan (`src/matchdagen/delat/`), balanssimuleringen | klar |
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

## 5. Frågekällorna (Etapp 1b)

`src/matchdagen/md-fragor.js` gör en frågeström av `matchdagenInst`. Källorna står i `md-kallor.js` och
återanvänder det som finns:

| Källa (`perKalla`-nyckel) | Var frågorna kommer ifrån | Svarssätt |
| --- | --- | --- |
| Plugga-område (`omrade:ä/o`), en källa per område | Quiz utan passage via `plainQuizPool` (`game-shared.js`). Par blir "Vad betyder X?" med upp till tre andra förklaringar ur samma område som felalternativ. Giltigheten kommer från `omradetsSaker` (`prov/prov-fran-omrade.js`), samma kontroll som "Hämta från område" i provet. Par med samma term eller förklaring tas bara med en gång. | flerval |
| Multiplikation (`tabell:N`), EN källa för alla valda tabeller | Live-läget `multiplication_0_10`: `choices` ger fyra rimliga alternativ och `checkAnswer` rättar. Frågan kommer ur samma motor (`mult/generator.js` `makeQuestion`). Nyckeln `7x3` betyder tabell 7 gånger 3 och visas som 7 × 3 eller 3 × 7. | flerval eller skriv själv |
| Räkna-område (`rakna:ä/o`), en källa per område | `rakna-core.js`: `createProblemSource` (generatorn, där `createTopicBag` blandar räknesätten), `checkAnswer`, `problemDisplay` och `expectedAnswerText` | skriv själv |

- **API:** `skapaFragestrom({ inst, uid, hamtaOmrade, lagring?, rng? })` ger `{ tom: true, meddelande }` eller
  `{ tom: false, kallor, nasta(), ratta(fraga, svar) }`. En fråga är `{ id, kalla, kallTyp, text, typ: "flerval"|"skriv",
  alternativ?, ratt?, facit, inputMode, data }`. `ratta` tar ett index (flerval) eller en text (skriv själv) och
  ger `{ giltig, ratt, facit }`. Ett tomt eller ogiltigt svar räknas inte.
- **Inga frågor:** om läraren inte har valt något blir det `INGA_FRAGOR` ("Din lärare har inte valt några frågor
  än"). Om de valda områdena saknas eller är tomma blir det `SAKNADE_FRAGOR`. I båda fallen kan ingen match startas.
- **Blandningen:** källorna turas om jämnt med `createTopicBag`. Varje källa kommer en gång per varv, och aldrig
  samma källa två gånger i rad.
- **Påsen:** samma fråga kommer inte tillbaka förrän alla frågor i källan har kommit. Påsen sparas i
  `localStorage["matchdagen-pase:{uid}"]` efter varje fråga och håller därför över omladdningar. Om lärarens
  innehåll ändras börjar påsen om, eftersom fingeravtrycket av nycklarna inte längre stämmer. Räkna-källan är
  oändlig, så där sparas bara hur många frågor som har dragits, och nästa session startar strömmen med ett nytt frö.
- **Svårigheten** är alltid elevens egen. Ingenting i källorna beror på divisionen.
- **Frågekortet:** `md-svar.js` `visaFraga(host, fraga, { ratta, klocka?, signal? })` har stora knappar (56 px)
  och tangenterna 1–6, eller ett svarsfält med Enter. Rätt svar blir grönt. Vid fel svar visas "Rätt svar: X" i
  1,5 s. Klockan (30/60 s) räknar en tid som har gått ut som fel. `createQuestionFlow` passade inte, eftersom det
  skickar varje svar till servern och tar sina frågor ur ett GameMode.
- **Områdena läses** med `hamtaOmrade`. På webben blir det `getArea` i `data-content.js`, som har en TTL-cache och
  samma läsning som Plugga. Varje område läses en gång när strömmen skapas (1c, kvoten §13).

### 5.1 Lägga till en ny frågekälla

1. Lägg till en byggare i `md-kallor.js` som returnerar `{ id, kalla(nyckel), nycklar, fraga(nyckel, rng, svarssatt) }`.
   `nycklar` är en ändlig lista (påsen sköts av `md-fragor.js`), eller `null` för en oändlig generator som då
   också har `starta(n, uid)`. `fraga` ger `{ text, typ, alternativ?, ratt?, facit, inputMode?, data }`.
2. Lägg till rättningen i `rattaFraga` om `data` behöver en egen rättning (`kallTyp` är id:ts första del).
3. Lägg till fältet i `matchdagenInst` (`md-inst.js` `normalizeInst`/`kallNycklar`, `validMatchdagenInst` i
   `firestore.rules`) och kryssrutor i lärarpanelen.
4. Koppla in källan i `skapaFragestrom` och testa den i `test/matchdagen-fragor.test.js`, så att den ger giltiga
   frågor och att påsen inte upprepar något.

## 6. Matchmotorn (Etapp 1b)

`src/matchdagen/delat/` är **ren**: ingen DOM, Firebase, three.js, `Math.random`/`Date.now` och bara importer
inom `delat/`. Det testas i `test/matchdagen-liga.test.js`. Slumpen (`rng: () → [0, 1)`) och tiden (`nu`, ms)
skickas in, som i Kurragömma. Klienten skickar `Math.random`, testerna och simuleringen `skapaPrng(frö).tal`
(`md-prng.js`). I Etapp 4 kopieras mappen till `functions/matchdagen/`.

| Fil | Vad |
| --- | --- |
| `md-config.js` | **alla tal** (§7 nedan) |
| `md-motor.js` | tillståndsmaskinen och chanserna |
| `md-liga.js` | schemat (cirkelmetoden), `styrkaFor`, `simMal`, tabellen |
| `md-texter.js` | kommentatorns rader och knapparnas texter. Aldrig hånfullt. Vid fel svar säger raden vad som hände. |
| `md-prng.js` | seedad slump (samma algoritm som `kg-prng.js`) |

```
nyMatch({ mot: { namn, styrka }, bonus?, div?, nu? }) → m      avspark för oss
lage(m) → { typ, val, fragor, rad, d?, horna? }                typ: anfall | forsvar | derasPass | derasSkott | halvtid | slut
antalFragor(m, valId) → 0 | 1 | 2                              skott från Division 3 = 2 (§7.3)
spela(m, valId, svar, rng, nu?) → { m, h }                      m ändras inte; h = händelsen för 1c:s animation
andraHalvlek(m, nu?) → m                                        laget som inte började gör avspark
resultat(m) → { oss, dem, utfall, mal, stat, klar }
chansPass/chansSkott/chansSnett/chansForsvar/chansRaddning/chansDerasMal, skottText, lagbonus(trupp)
```

- **Valen:** `anfall` ger kort pass, långt pass, dribbling och skjut. Skott går bara vid `d = 100 − x ≤ 45`, och
  knappens text är "För långt bort", "Långt skott – liten chans", "Bra läge" eller "Jätteläge!". `forsvar` (deras
  boll på vår planhalva) ger Tackla och Täck. `derasPass` (deras boll på deras planhalva, `x ≥ 50`) spelas utan
  fråga. `derasSkott` (`x ≤ 24`) ställer frågan "Kan målvakten rädda?".
- **`svar`** är en lista med `{ ratt, kalla? }`, en per fråga. `kalla` räknas in i `stat.perKalla`.
- **Händelsen `h`:** `{ typ, val, svar, ratt, min, fran, till, boll, stallning, utfall, rad, hojd?, mal?, horna?,
  inspark? }`. `utfall` är ok, bruten, mal, raddning, stolpe, utanfor, snett, fram, vunnen, stoppad eller forbi.
  `hojd` är mark, bage eller skott. 1c animerar ur den.
- **Statistik per match (§3.6):** `skott`, `skottPaMal`, `pass`, `passOk`, `tacklingar`, `vunnaBollar`,
  `raddningar`, `horner`, `derasSkott`, `fragor`, `ratt`, `perKalla` och `sekunder`. Sekunderna är verklig tid
  mellan anropen med högst `MAX_LAGE_S` per läge. Halvtidspausen räknas inte.
- **Tillståndet** är ren JSON. 1c sparar det i `localStorage` efter varje läge (§5).
- **Med i 1b fast det hör till Etapp 2:** kroken för två frågor per skott från Division 3 och `lagbonus`.
  Straffarna (§7.4) kommer i 2a.

## 7. Alla tal och balansen (§12)

`npm run balans:matchdagen` (`admin/md-balans-sim.mjs`) spelar 1 000 säsonger per rad i Division 6 (6 lag,
5 omgångar, övriga matcher med `simMal`) med den riktiga motorn. `test/matchdagen-balans.test.js` kör 200
säsonger per rad och fäller en konfiguration utanför målen.

**Med specens startvärden** (400 säsonger) gick det inte alls:

| Rätt | Vinst | Mål/match | ≥1 eget mål | Match (min) |
| --- | --- | --- | --- | --- |
| 70 % | 16 % | 0,77 | 27 % | 4,1 |
| 50 % | 7 % | 0,94 | 16 % | 4,2 |
| 30 % | 1 % | 1,28 | 6 % | 4,2 |

Med 8–10 lägen per halvlek hinner laget bara 7–8 anfall per match, och de flesta slutar med ett brutet pass. Ett
skott kräver 2–3 lyckade pass i rad, så nästan inga mål görs. Matchen blir dessutom bara drygt 4 minuter när ett
svar tar 8–12 s.

**Med de slutliga värdena** (1 000 säsonger per rad):

| Rätt | Vinst | Oavgj. | Förlust | Ligan | Mål/match | Gjorda | Insl. | ≥1 eget mål | Förlust ≥4 | Skillnad ≥6 | Frågor/match | Match (min) | Säsong (min) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 70 % | 61 % | 25 % | 14 % | 59 % | 2,56 | 1,74 | 0,82 | 87 % | 0 % | 0,0 % | 27,9 | 7,0 | 46 |
| 50 % | 34 % | 30 % | 36 % | 14 % | 2,39 | 1,18 | 1,21 | 73 % | 0 % | 0,0 % | 28,2 | 7,0 | 47 |
| 30 % | 13 % | 24 % | 64 % | 1 % | 2,40 | 0,73 | 1,67 | 54 % | 2 % | 0,0 % | 28,6 | 7,0 | 47 |

Målen (`MAL` i simuleringen): 70 % vinner 55–65 % och ligan 35–65 % av säsongerna. 50 % vinner 30–40 % och
ligan 3–35 %. 30 % gör minst ett mål i minst 50 % av matcherna och förlorar med 4 mål eller mer i högst 15 %. För
alla gäller 1,5–4 mål per match, högst 1 % matcher med 6 måls skillnad (största skillnaden var 6), en match på
6–8 minuter och en säsong på 45–60 minuter.

**Ändrat mot specen** (allt annat är specens tal):

| Tal | Specen | Nu | Varför |
| --- | --- | --- | --- |
| `STEG_MIN` | 3,5–6 | 1,8–2,9 | fler lägen (~38 per match, 28 frågor) – matchen blir 6–8 min och laget hinner anfalla |
| `PASS` fram (kort/långt/dribbla) | 10–16 / 22–32 / 12–16 | 17–23 / 25–35 / 18–23 | färre pass i rad krävs för ett skottläge |
| `PASS` fel svar (kort/långt/dribbla) | 0,25 / 0,10 / 0,12 | 0,60 / 0,25 / 0,30 | 30 %-eleven ska göra mål i hälften av matcherna; rätt svar ger fortfarande mest |
| `SKOTT.bas` / `SKOTT.fel` | 0,85 / 0,03 | 1,0 / 0,15 | fler mål från bra lägen; ett långskott (40 m) är fortfarande 7 % och ett perfekt avslut högst 0,8 × 0,93 |
| `HORNA_CHANS` | 0,30 | 0,45 | fler skottlägen efter en räddning |
| `SNETT.bas` | 0,18 | 0,25 | fler bollvinster på deras planhalva |
| `TACKLA` | 0,66 / 0,12 | 0,61 / 0,15 | jämnare mellan 70 % och 50 % |
| `RADDNING` bas / fel | 0,62 / 0,15 | 0,53 / 0,20 | jämnare mellan 70 % och 50 % |
| `DERAS_SKOTT.bas` | 0,50 | 0,44 | färre insläppta |
| `DERAS_PASS.fram` | 12–20 | 10–18 | fler lägen att vinna bollen på |
| `TID.anim` | – | 1–4,5 s | tidsmodellen (skissens animationer) |

**Robotarna (antaganden, `ROBOT` i simuleringen):** de skjuter alltid vid "Bra läge" och "Jätteläge" (d ≤ 28)
och tar ett långskott i 10 % av fallen. På egen planhalva spelar de kort, långt och dribblar 40/40/20, på deras
planhalva 60/10/30. De tacklar i 70 % av fallen och täcker annars. Tidsmodellen: ett svar tar 8–12 s, ett val
2 s, animationerna `TID.anim`, halvtiden 12 s, rutorna runt en match 30 s och ett träningsläger 8 frågor + 30 s.

## 8. Filer och bootgrafen


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
| `src/matchdagen/md-fragor.js`, `md-kallor.js` | frågeströmmen och källorna (§5) |
| `src/matchdagen/md-svar.js` | frågekortet (§5) |
| `src/matchdagen/delat/` | den rena motorn och ligan (§6) |
| `admin/md-balans-sim.mjs` | balanssimuleringen (§7) |
| `preview/preview-matchdagen-fragor.html` | förhandsvisning 1b: frågekortet + motorn som textmatch (`PORT=8868 node server.mjs`; `?svar=skriv`, `?klocka=30`, `?kallor=tabell\|omrade\|rakna\|klocka\|inga`) |

## 9. Deploy

Etapp 1a: **`firebase deploy --only firestore:rules` före webben** (nya fält och samlingen `matchdagenInst`).
Inga index, inga functions.

Etapp 1b: **ingen deploy**. Inga regler, index eller functions, och ingen ny samling. Motorn används först i 1c.
