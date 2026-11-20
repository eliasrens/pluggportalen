# Matchdagen – fotbollsspel per elev

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) (epic #866). Godkänd skiss:
[`preview/preview-matchdagen-skiss.html`](../preview/preview-matchdagen-skiss.html). Rapporten per etapp:
[`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md), [`QA-RAPPORT-matchdagen-etapp-2.md`](QA-RAPPORT-matchdagen-etapp-2.md).

Matchdagen är ett fotbollsspel där varje drag kräver ett rätt svar. Läraren slår på det för **enskilda
elever**, aldrig för en hel klass. Det här dokumentet växer med etapperna:

| Etapp | Innehåll | Status |
| --- | --- | --- |
| 1a (#867) | Moduler per elev (`elevModuler`, `perElev`), lärarens "Anpassningar per elev" (`matchdagenInst`), platshållarsida | klar |
| 1b (#868) | Frågekällorna (`md-fragor.js`), frågekortet (`md-svar.js`), den rena matchmotorn och ligan (`src/matchdagen/delat/`), balanssimuleringen | klar |
| 1c (#869) | 3D-planen med 2D-reserv (§12), matchvyn, säsongen i Division 6 (§10), sparning, kvot (§11) och statistik för elev och lärare (§13) | klar |
| 2a (#870) | Alla divisioner, kvalet och straffarna, finten från Division 3 (§14), balansen i alla divisioner (§7.1) | klar |

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
  Straffarna (§7.4) och finten kom i 2a (§14).

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
| 70 % | 61 % | 25 % | 14 % | 59 % | 2,56 | 1,73 | 0,82 | 87 % | 0 % | 0,0 % | 27,9 | 7,0 | 46 |
| 50 % | 34 % | 30 % | 36 % | 14 % | 2,38 | 1,18 | 1,21 | 73 % | 0 % | 0,0 % | 28,2 | 7,0 | 47 |
| 30 % | 12 % | 24 % | 64 % | 1 % | 2,39 | 0,72 | 1,67 | 53 % | 2 % | 0,0 % | 28,6 | 7,0 | 47 |

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
| `SKOTT.bas` / `SKOTT.fel` | 0,85 / 0,03 | 1,0 / 0,15 | fler mål från bra lägen; ett långskott (40 m) är fortfarande 7 % och ett perfekt avslut högst 0,8 × 0,93. Fel svar ger `min(SKOTT.fel, chansen vid rätt svar)`, så ett fel svar går aldrig bättre än ett rätt från samma avstånd (#868 F1) |
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

### 7.1 Alla divisioner och karriären (Etapp 2a, #870)

`npm run balans:matchdagen` skriver nu tre tabeller: Division 6 (som ovan, samma frön), **alla divisioner** med
startlaget (400 säsonger per rad, ligavinnaren spelar kvalet mot `styrka(div + 1)`, oavgjort → straffar) plus
Superligan-raden ur §12 (80 % rätt, tränat lag med snitt 4★), och **karriären** (100 elever × 30 säsonger: hur
långt de når och hur snabbt). `test/matchdagen-balans.test.js` fäller Superligan-raden utanför 45–55 %. Inga tal i
`md-config.js` behövde ändras för 2a; kvalet lägger ~5 minuter till säsongen för den som vinner ligan (Division 6:
70 % → 51 min, fortfarande inom 45–60).

| Rad (1 000/400 säsonger) | Vinst | Ligan | Kval vunna | Mål/match | Match (min) | Säsong (min) |
| --- | --- | --- | --- | --- | --- | --- |
| Division 6, 70 % | 61 % | 59 % | 65 % | 2,56 | 7,0 | 51 |
| Division 4, 70 % | 43 % | 21 % | 53 % | 2,60 | 7,1 | 68 |
| Division 3, 70 % (finten) | 25 % | 2 % | – | 2,28 | 7,4 | 69 |
| Division 2, 80 % | 33 % | 7 % | 38 % | 2,51 | 7,6 | 90 |
| Superligan, 80 %, 4★ (§12-målet 45–55 %) | **47 %** | 28 % | – | 2,68 | 7,7 | 111 |

**Karriären** (median säsonger · speltimmar till divisionen, andelen som når den inom 30 säsonger):

| Rätt | Laget | Division 5 | Division 3 | Division 1 | Superligan |
| --- | --- | --- | --- | --- | --- |
| 80 % | startlaget 2★ | 1 · 0,9 h (100 %) | 6 · 5,9 h (100 %) | 22 · 26 h (25 %) | – |
| 70 % | startlaget 2★ | 2 · 1,7 h (100 %) | 13 · 12 h (93 %) | – | – |
| 80 % | tränas 2★ → 4★ | 1 · 0,9 h | 5 · 4,7 h | 10 · 12 h | 18 · 26 h (97 %) |
| 70 % | tränas 2★ → 4★ | 2 · 1,7 h | 8 · 7,6 h | 23 · 29 h (42 %) | 1 % |

Med startlaget tar det stopp kring Division 3–2: högre upp krävs ett bättre lag, och det kommer med truppen,
marknaden och träningslägret i Etapp 2b. "Tränas 2★ → 4★" är ett **antagande** för 2b (snittet växer jämnt med
divisionen, `tranadStjarnor`). Hela utskriften: rapporten.

## 8. Filer och bootgrafen


Allt nytt ligger i `src/matchdagen/` och laddas med `import()` – bootgrafen är oförändrad (107 filer, testat i
`test/matchdagen-modul.test.js`). I bootfilerna ändrades bara registret (`gamemode-visibility.js`), en route i
`app.js` och lärarens sektions-/flikregister (`teacher-classes-sections.js`, `teacher-mina-val.js`,
`teacher-struktur.js`, och i 1c `STATS_TABS` i `teacher-class.js` med en dynamisk `import()`). three.js och
allt i `src/matchdagen/plan/` laddas först när matchen startar. Stilarna: `src/styles/48-matchdagen.css` (+ `npm run build:css`).

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
| `src/tre/tre-ladda.js` | delad three-laddning (`harWebGL`, `laddaThree`), utbruten ur Kurragömmas `kg-tre.js` (som re-exporterar) |
| `src/matchdagen/delat/md-namn.js`, `md-sasong.js` | ren: namnen och färgerna, klubben/säsongen/karriären (§10) |
| `src/matchdagen/md-app.js` | elevens app: sidhuvud med klubbkassan, flikarna, tillståndet och sparningen |
| `src/matchdagen/md-data.js`, `md-lokal.js`, `md-spara.js` | Firestore (§10), det som sparas lokalt (pågående match, kön av osparade matcher) och kön + valet av karriär |
| `src/matchdagen/vy/` | flikarna: `md-vy-match` (före avspark, ny klubb, säsongsslut), `md-match-spel` (matchen), `md-vy-tabell`, `md-vy-trupp`, `md-vy-stat`, `md-vy-klubb`, `md-vy-delat` |
| `src/matchdagen/plan/` | planen (§12): `md-plan` (väljer 3D/2D, spelar upp händelserna), `md-formation` (ren), `md-tre-ritare`/`-arena`/`-figur` (3D), `md-plan-2d` (SVG-reserven), `md-ljud` (Web Audio) |
| `src/matchdagen/larare/md-larare-stat.js`, `md-lagnamn.js` | lärarens underflik Matchdagen i Hur går det? och Återställ lagnamn (§13) |
| `src/styles/49-matchdagen-match.css` | elevens app och matchvyn (kvällsarenan) |
| `src/matchdagen/delat/md-straffar.js`, `md-kval.js` | ren: straffläggningen och kvalet (§14, #870) |
| `src/matchdagen/vy/md-straff-spel.js` | straffläggningen i matchvyn (#870) |
| `preview/preview-matchdagen.html` | förhandsvisning 1c med stubbad data (`PORT=8869 node server.mjs`; `?vy=match\|tabell\|trupp\|stat`, `?omg=0–5`, `?klubb=ny`, `?ny=1`, `?2d=1`, `?lugnt=1`, `?fps=1`, `?auto=1`, `?svar=skriv`, `?klocka=30`, `?kallor=inga`; 2a: `?div=0–7`, `?kval=1`, `?straffar=1`; 2b: `?kassa=N`, `?trupp=visa`) |
| `src/matchdagen/delat/md-trupp.js` | ren: truppen, reserverna, marknaden och träningslägret (§15, #871) |
| `src/matchdagen/vy/md-vy-marknad.js`, `md-vy-lager.js`, `md-strom.js` | Truppens kort, köpen och bytena; träningslägret; frågeströmmen (delad av matchen och lägret) (#871) |
| `admin/md-balans-trupp.mjs` | balansen för ekonomin och karriären med truppen (§15.2) |
| `preview/preview-matchdagen-fragor.html` | förhandsvisning 1b: frågekortet + motorn som textmatch (`PORT=8868 node server.mjs`; `?svar=skriv`, `?klocka=30`, `?kallor=tabell\|omrade\|rakna\|klocka\|inga`) |

## 9. Deploy

Etapp 1a: **`firebase deploy --only firestore:rules` före webben** (nya fält och samlingen `matchdagenInst`).
Inga index, inga functions.

Etapp 1b: **ingen deploy**. Inga regler, index eller functions, och ingen ny samling. Motorn används först i 1c.

Etapp 1c: **`firebase deploy --only firestore:rules` före webben** (samlingen `matchdagen/{uid}` med
`matcher`). Inga index (lärarens historik sorterar bara på `datum` i en undersamling – automatiskt index),
inga functions.

Etapp 2a: **`firebase deploy --only firestore:rules` före webben** – `kval` i karriären och `straffar` i
`matcher` prövas nu (`mdKvalOk`, `mdStraffarOk`). De gamla reglerna nekar `kval: null`, som webben nu skickar
med en ny klubb och med första matchen efter en ny säsong – med webben först kan en ny klubb inte sparas
(sparas med första matchen) och matcherna blir liggande i den lokala kön tills reglerna är ute. Inga index,
inga functions.

Etapp 2b: **`firebase deploy --only firestore:rules` före webben** – `reserver`, `marknad` och `lager` i
karriären och kontrollen av truppen, reserverna och kassan mot det sparade dokumentet (§15.4). De gamla reglerna
nekar `lager` (okänt fält) – med webben först kan inget träningsläger sparas. De nya reglerna godtar äldre
dokument (Etapp 1–2a) utan `reserver`/`marknad`/`lager`. Inga index, inga functions.

## 10. Säsongen och sparningen (Etapp 1c)

### 10.1 Säsongen i Division 6

`src/matchdagen/delat/md-sasong.js` (ren, testad i `test/matchdagen-sasong.test.js`):

- **Ny klubb:** `nyKarriar({ namn, farg, rng })` – namn 1–24 tecken (`lagnamnOk`), en av 8 tröjfärger
  (`TROJFARGER`), sju grundpelare med färdiga namn ur `FORNAMN`/`EFTERNAMN` (2★, en av utespelarna är lagkapten).
  Namnen går inte att ändra. Kassan börjar på `KASSA.start`.
- **Ligan:** `nyLiga(div, trojfarg, rng)` – 6 lag (vi + 5 ur `MOTSTANDARE`, 66 påhittade namn) med egna färger
  och dold `styrkaFor(div)`; schemat med cirkelmetoden (`md-liga.js schema`) lagras som strängar
  `"a:b|c:d|e:f"` per omgång (Firestore tillåter inga listor i listor). Vårt lag är `{ id: "oss" }` – namn och
  färg kommer ur `klubb`, så lärarens återställning rör bara `klubb.namn`.
- **Efter elevens match:** `matchKlar(K, { res, rng, nu, matchId, kallNamn })` räknar omgångens övriga matcher
  med `simMal`, tabellen (3/1/0, sorterad på poäng, målskillnad, gjorda mål), kassan (`pengarFor`: grund
  150/75/40 + 8 per rätt + 12 per mål, × (1 + div × 0,25) – specens belopp halverade i 2b, §15.2), summan, `senaste`, `dagar` – och efter sista
  omgången placeringen och pokalen "Vinnare Division 6".
- **Nästa säsong:** `nySasong(K, rng)` – ny liga, samma division. Etapp 1 har inget kval (kommer i 2a); laget
  stannar i Division 6. Lottningen seedas med `sasongFro(K, uid)`, så samma liga visas vid omladdning innan den
  sparas (den sparas med nästa match).
- **Fortsätta senare** (`md-lokal.js`): den pågående matchen (`m` ur motorn, ren JSON) sparas i `localStorage`
  (`matchdagen-match:{uid}`) efter varje läge och tas upp igen om den hör till nästa match. Färdiga matcher
  läggs först i en **kö** (`matchdagen-osparad:{uid}` = `{ K, koe }`, högst 30) och sparas i ordning
  (`md-spara.js sparaKon`) direkt efter matchen och när Matchdagen öppnas. `hamtaKarriar` väljer den sparade
  eller den lokala karriären (flest matcher – men alltid serverns `klubb`) och skriver ingenting om
  karriären inte gick att läsa.

### 10.2 Datamodellen

Fälten står i [`DATAMODELL.md`](DATAMODELL.md#matchdagenuid--elevens-karriär-869). Utöver specens §6.1:

- `senaste` (≤ 20) och `sasonger` – elevens Statistik läser inga `matcher` (bara en vid klick på en match).
- `dagar` (≤ 70 dagar, `{ m, sek, fragor, ratt }`) – lärarens speltid de senaste 7 dagarna och veckolinjen
  utan att läsa `matcher`.
- `summa.perKalla[k].namn` – källans namn ("Vikingatiden", "7:ans tabell") för staplarna.

**Regler** (`firestore.rules`, `validMatchdagen`, `mdBaraLagnamn`, `validMdMatch`; tester i
`test/firestore-rules-matchdagen.test.js`, nyckel MK):

- Läsa: `isSelf(uid) || hasStudent(uid)` (karriären och `matcher`).
- Eleven skapar/ändrar sitt dokument: kända fält, `div` 0–7, truppen exakt 7 med `st` 1–5, `summa` med kända
  nycklar och bara heltal (`mdSummaOk` – summan visas i lärarens vy), lagnamn 1–24, färg
  `#rrggbb`, `senast` = serverns tid, tak på alla listor och mappar. **Bara de fält som ändras prövas**
  (`diff().affectedKeys()`, som `schackOk`) – annars spräcks gränsen på 1000 uttryck per begäran.
- Läraren (`hasStudent`): bara `klubb.namn` och bara till "Pluggporten FC" (`STANDARD_LAGNAMN`).
- `matcher/{id}`: bara `create` av eleven själv, id ≤ 64 tecken, kända fält, `datum` = serverns tid,
  `ratt ≤ fragor`, `mal` ≤ 80, `stat` ≤ 20 nycklar, `perKalla` ≤ 70. Ingen ändring; radering bara admin.
- **Storleken:** reglerna kan inte mäta byte. Taken på listorna och mapparna (`senaste` 20, `dagar` 70,
  `sasonger` 200, `pokaler` 300, `perKalla` 150, ligan 12 lag) håller ett dokument skrivet av appen under
  ~61 kB med allt fyllt (en ny klubb ~2 kB), under specens 200 kB. En elev som skriver förbi appen kan bara
  blåsa upp sitt eget dokument (Firestores tak 1 MiB).

### 10.3 När det sparas

| Händelse | Skrivningar |
| --- | --- |
| Ny klubb | 1 (`sparaKarriar`) |
| Döpa om laget / byta tröjfärg (Truppen) | 1 |
| Köp, byte eller träningsläger (Truppen, #871) | 1 (`sparaTrupp`, utan `klubb`) |
| Efter varje match | 1 batch = 2 (karriären + `matcher/{id}`) – `sparaMatch` |
| Ny säsong | 0 (sparas med nästa match) |
| Läraren: Återställ lagnamn | 1 (`aterstallLagnamn`, bara `klubb.namn`) |

Matchsparningen skriver allt **utom `klubb`** (`mergeFields`), så lärarens Återställ lagnamn står kvar; `klubb`
skrivs bara av ny klubb och Truppen. Nekas batchen läses de två dokumenten: finns `matcher/{id}` redan (ett
tidigare försök gick fram men svaret kom aldrig) sparas bara karriären, och saknas karriären (den nya klubben
hann aldrig sparas) skapas den först från noll (`forstaDokument`, #871 – reglerna skapar bara en ny klubb) och
batchen skickas igen. Varje läsning och skrivning har en tidsgräns (8 s,
`medTidsgrans`) – offline löser Firestore aldrig skrivningens promise; matchen ligger kvar i kön. Matchdagen ger **inga pluggmynt** – klubbkassan är spelets egen valuta.

## 11. Kvoten (Etapp 1c, spec §13)

Inga lyssnare. Elevens dokument läses en gång när Matchdagen öppnas.

**Eleven under en timme** (~7 matcher; med truppen och träningslägret, #871: se §15.5):

| Vad | Läsningar | Skrivningar |
| --- | --- | --- |
| Öppna Matchdagen | 2 (`matchdagenInst/{uid}`, `matchdagen/{uid}`) | 0 |
| Frågekällorna | 1 per valt Plugga-område (`getArea`, cachat i sessionen); tabeller och Räkna 0 | 0 |
| 7 matcher | 0 | 14 (7 batchar à 2) |
| Ny klubb + ett namnbyte | 0 | 2 |
| Statistik, 3 matchdetaljer | 3 | 0 |
| **Summa** (3 Plugga-områden) | **≈ 8** (mål < 20) | **≈ 16** (mål < 50) |

**Läraren öppnar Hur går det? → Matchdagen** för en klass med 2 elever med åtkomst: 2 läsningar
(`matchdagen/{uid}` per elev; `elevModuler` ligger på klassdokumentet som redan är läst). Klick på en elev:
högst 20 läsningar (de 20 senaste `matcher`, minst 1 om inga finns). Återställ lagnamn: 1 skrivning.
Vänskapsmatcher: Etapp 4.

## 12. 3D-planen och 2D-reserven (Etapp 1c, spec §4)

- **Laddningen:** `src/tre/tre-ladda.js` (`harWebGL`, `laddaThree`) är den enda vägen till
  `src/vendor/three/`; Kurragömmas `kg-tre.js` re-exporterar den (beteendet oförändrat). `md-plan.js` laddar
  three först när matchen startar.
- **Ritar-gränssnittet:** `md-tre-ritare.js` och `md-plan-2d.js` har samma API (`lag`, `spelare`, `boll`,
  `firar`, `malEffekt`, `zoom`, `avatar`, `fps`, `dispose`). `md-plan.js` spelar upp motorns händelse `h` (passets bana mark/båge/skott,
  mål, räddning, halvtid) mot vilken ritare som helst – utan WebGL, om three inte laddas och med `?2d=1` tar
  2D-reserven över och matchen är identisk. Positionerna kommer ur den rena `md-formation.js`.
- **Scenen** (`md-tre-arena.js`): gräsränder och linjer (canvas-textur), mål med nät som buktar vid mål,
  reklamskyltar PLUGGPORTEN/MATCHDAGEN, läktare med publik som jublar, kvällsljus med strålkastarmaster.
- **Spelarna** (`md-tre-figur.js`): ben, skor, strumpor, shorts, tröja, armar, huvud och hår ur enkla former,
  sammanslagna med vertexfärger till **6 ritanrop per spelare**, blob-skugga, springanimation, vänder sig mot
  bollen, målvakter i egna färger, kaptensbindel och elevens avatarbricka (`kg-avatar-bild.js`) över kaptenen.
- **Kameran:** tv-kamera från långsidan som mjukt följer bollen och zoomar in kort vid mål.
- **Lugnt läge** (`matchdagenInst.lugnt`) **och `prefers-reduced-motion`:** fast kamera över hela planen,
  ingen zoom eller skakning, spelare och boll hoppar direkt till sina platser, inget jubel eller sorl.
- **Prestandan:** ingen kantutjämning, pixeltäthet högst 1,5 och en pixelvakt som sänker den (×0,75, aldrig
  under 0,6) när fps < 45. Mätningarna står i rapporten.
- **Ljudet** (`md-ljud.js`): Web Audio, inga ljudfiler – vissla, spark, jubel, räddning, publikens sorl. Knappen
  av/på kommer ihåg valet i `localStorage`.
- Testat i `test/matchdagen-plan.test.js` (2D utan WebGL och när three inte laddas, lugnt läge, bootgrafen).

## 13. Elevens app och lärarens statistik (Etapp 1c, spec §6.3, §6.4, §14)

- **Eleven** (`md-app.js`): sidhuvud med klubbens namn och klubbkassan; flikarna **Match** (ny klubb, rutan före
  avspark "Säsong 1 · Division 6 · Omgång 2 av 5", matchen, rutan efter matchen med "Till tabellen" / "Se hur
  säsongen slutade"), **Tabell**, **Truppen** (döp om laget, tröjfärg, startelvan) och **Statistik** (siffror,
  rätt per källa som staplar, de 20 senaste matcherna med detaljer, säsongshistoriken, pokalskåpet). Matchen:
  tv-skylten (lagkort, resultat, minut), planen, kommentatorns rad och frågekortet direkt under (tangenterna
  1–4). Halvtid med paus, pauspåminnelsen ur `matchdagenInst.paus` i rutan efter matchen. Kvällsarenan med
  Barlow Condensed + Nunito som skissen; allt syns i 1366 × 768 under en match.
- **Läraren** (`md-larare-stat.js`): underfliken **Matchdagen** i klassens Hur går det? (`STATS_TABS` i
  `teacher-class.js`) visas bara när någon elev i klassen har Matchdagen. En rad per elev med åtkomst: speltid
  7 dagar och totalt, matcher, andel rätt totalt och per källa, division och säsong, senast spelat. Klick på en
  elev: de senaste matcherna (läses då), andel rätt per vecka som en liten linje (8 veckor ur `dagar`) och
  lagnamnet med **Återställ lagnamn** (`md-lagnamn.js`, samma knapp i panelen Anpassningar per elev).

## 14. Divisionerna, kvalet och straffarna (Etapp 2a, #870, spec §7)

### 14.1 Stegen och ligorna

- **Åtta nivåer** (`DIVISIONER`, `LAGANTAL` i `md-config.js`): Division 6, 5 (6 lag, 5 omgångar), 4, 3 (8 lag,
  7 omgångar), 2, 1 (10 lag, 9 omgångar), Elitligan och Superligan (12 lag, 11 omgångar). `nyLiga(div)` lottar
  divisionens antal lag med `styrkaFor(div)`; schemat är cirkelmetoden för 6/8/10/12 lag.
- **Stegen överst i Tabell-fliken** (`stegHtml` i `md-vy-tabell.js`, ren `stegen(div)` i `md-kval.js`): alla åtta
  nivåer med antalet lag; den nuvarande är gul (`aria-current="step"`), de passerade ljusa. Under stegen skissens
  rad "Ettan får kvala upp. Man kan bara gå uppåt …" och från Division 3 "Här krävs två rätt i rad …".
- **Tuffare utan svårare frågor** (§7.3): starkare motståndare (`styrkaFor`), fler lag och omgångar, och
  **finten** från Division 3: skottet ställer först frågan "Finta bort försvararen – sedan skottet!". Fel på
  finten avgör direkt med `SKOTT.fintFel` = 0,03 (aldrig mer än ett rätt avslut från samma avstånd) – **ingen
  andra fråga** (skissen). Rätt på finten → "Rätt – försvararen är bortfintad! Nu skottet!" och skottfrågan med
  vanliga chanser (fel på den = `SKOTT.fel`). Motorn: `behoverFraga(m, valId, svar)`; `spela` tar ett svar när
  finten blev fel.

### 14.2 Kvalet (`md-kval.js`, §7.2)

- **Bara ligavinnaren:** när sista omgången är spelad och laget är etta under Superligan får karriären
  `kval = { div, sasong, mot: { namn, farg, styrka }, spelad: false }` (i `matchKlar`). Motståndaren är ett lag
  ur namnlistan som inte är med i ligan, med `styrkaFor(div + 1)`. Superligans ettan får pokalen men inget kval
  (Mästarcupen kommer i Etapp 3).
- **Matchen:** Match-fliken visar "KVAL till Division 5 · Ödmårdens BK är ett lag från divisionen ovanför"
  (skissen) och Avspark. Kvalet är en vanlig match med `nyMatch({ avgor: true })` – oavgjort efter 90 minuter →
  straffar.
- **`kvalKlar(K, { res, nu, matchId })`:** bokför matchen som en ligamatch (`bokforMatch`: kassa, summa,
  senaste, dagar, matchdokumentet med `typ: "kval"` och `straffar`). **Vinst** → `div + 1`, pokalen
  "Kvalade upp till Division 5" (`typ: "kval"`) och `KASSA.uppflyttning` (300 × (1 + div × 0,25)). **Förlust** →
  samma division. `div` sätts till `max(nuvarande, …)` – ett trasigt dokument kan aldrig flytta laget ned.
  `sasonger[0].kval` = "upp" | "kvar".
- **Efter kvalet:** rutan "Uppflyttning! 1 – 1 (straffar 3 – 0)" eller "Nära!" med skissens text och knappen
  **Starta nästa säsong**, som lottar en ny liga i den (nya) divisionen (`nySasong`, `kval: null`). Nästa säsong
  kan inte startas innan kvalet är spelat.

### 14.3 Straffarna (`md-straffar.js`, §7.4)

- **Fem var, sedan sudden death.** Vi skjuter först i varje omgång. Vår straff: en fråga, mål 0,82 vid rätt och
  0,20 vid fel. Deras: "Kan målvakten rädda?", mål 0,45 vid rätt och 0,85 vid fel (`STRAFFAR` i `md-config.js`).
- **Tidigt avgörande** (`avgjord`): så fort ena laget inte kan komma ikapp med sina återstående straffar (3 – 0
  efter tre var, 2 – 4 när vi bara har en kvar). I sudden death avgörs det när en omgång är slut och det skiljer.
  Efter 30 omgångar (praktiskt taget omöjligt) vinner vi – aldrig ändlöst.
- **Tillståndet** ligger i `m.straffar = { oss: [bool…], dem: [bool…], klar, vinnare }` (ren JSON), så en omladdning
  mitt i straffläggningen fortsätter där den var ("Straffläggningen pågår: 2 – 1 (1 – 1 efter full tid)").
  Svaren räknas i matchens statistik som alla frågor. `resultat(m)` ger `straffar: [vi, de]` och `vann`;
  `utfall` är fortfarande "oavgjort" (på mål) i summan.
- **Visningen** (`md-straff-spel.js`, `md-plan.js straffStall/straff/straffSlut`): rutan "Straffläggning!", skylten
  visar hela tiden **"Straffar 3 – 2"**, skytten bakom bollen på straffpunkten, målvakten på linjen och alla andra
  i mittcirkeln (`straffUppstallning` i `md-formation.js`, samma i 3D och 2D). **3D:** kameran snett bakom
  skytten mot målet (`straffVy`). **2D:** en mindre viewBox kring straffområdet (`straffVy`). Lugnt läge: fast
  kamera/hela planen, inga zoomningar. Målvakten kastar sig – åt rätt håll vid en räddning. Utrop "MÅL!",
  "RÄDDNING!", "I STOLPEN!", "UTANFÖR!".

### 14.4 Sparningen, reglerna och vyerna

- `kval` hör till `KARRIAR_FALT` och skrivs med varje matchsparning (mergeFields); en ny säsong skickar `kval: null`.
- **Reglerna** (`mdKvalOk`, `mdStraffarOk`, tester `firestore-rules-matchdagen-kval.test.js`, nyckel MQ): `kval`
  är `null` eller en map med kända nycklar – `div` 0–6, `sasong`, `oss`/`dem` 0–40 och `straffar` (två heltal 0–40)
  som heltal, `spelad`/`vann` bool, `mot.namn` 1–40 tecken, `mot.farg` `#rrggbb`, `mot.styrka` 0–1. `matcher.straffar`
  är två heltal 0–40. Prövas bara när fältet ändras (1000-uttrycksgränsen).
- **Bara tal i HTML:** elevens Statistik (`resText`, kval-etikett, säsongernas "kvalade upp") och lärarens vy
  ("Kval till Division 5 väntar" – divisionens namn ur listan, aldrig text ur dokumentet; matchradernas "(kval)"
  och "str. 4–3") skriver straffarna och resultaten med `tal()`/`Number()`; namnen med `esc()`.
- **Kvoten:** oförändrad – kvalet är en match till per säsong (1 batch = 2 skrivningar), inga nya läsningar.

## 15. Truppen, marknaden och träningslägret (Etapp 2b, #871, spec §8)

### 15.1 Motorn (`md-trupp.js`, ren)

- **Startelvan** är `trupp` i fast ordning (MV, FÖR, FÖR, MIT, MIT, ANF, ANF – samma index som formationen).
  Lagbonusen per lagdel `(snitt − 2) × 0,05` (`md-motor.js lagbonus`) räknas ur startelvan när matchen börjar.
  Truppen visar lagdelarnas snitt och effekt ("räddningar +10 %": målvaktens bonus räknas dubbelt i
  `chansRaddning`, `RADDNING.bonus`).
- **Grundpelarna** (`grundpelare: true`, 2★) säljs aldrig. Kaptensbindeln: lagkaptenen, eller – när kaptenen
  sitter bland reserverna – den första grundpelaren ute på planen (`kaptenPlats`).
- **Marknaden:** `nyMarknad(K, rng)` – 6 spelare (id `k…`, namn och tröjnummer som klubben inte har, `xp` 0,
  ingen `grundpelare`), stjärnorna `kl(avrunda(slump(2; 3,2 + div × 0,3)); 2; 5)` (taket per division
  `marknadMaxSt`: 3, 4, 4, 4, 4, 5, 5, 5). Ny marknad efter **varje** match och kval (`matchKlar`/`kvalKlar` med
  `rng`); en ny klubb har ingen (den första kommer efter första matchen).
- **Priset** `avrunda(150 × st^1,9; 10)`: 560, 1 210, 2 090, 3 190 kr (specen skriver "ungefär 3 150" för 5★ –
  formeln gäller). En köpt spelare säljs för halva priset (`saljPris`).
- **Köpet** (`kopInfo`, `kop`): den köpta ersätter den **sämsta på samma position** (lägst `st × 100 + xp`; vid
  lika en grundpelare). En köpt som ersätts säljs, en grundpelare flyttas till reserverna (högst 5). Är
  reserverna fulla väljer eleven först en **köpt** reserv som släpps (säljs för halva priset); är alla fem
  grundpelare går köpet inte. Köpet går inte heller när den nya inte har fler stjärnor än den som ersätts,
  eller när kassan (plus återbetalningen för en såld) inte räcker.
- **Byten** (`bytIn`): en reserv och en startspelare på samma position byter plats – när som helst.
- **Träningslägret** (`lagerNyckel`, `tranaSpelare`, `lagerResultat`): ett läger per spelad omgång
  (`"säsong-omgång"`, från omgång 1) och ett extra före kvalet (`"säsong-k"`). Ett läger som inte används före
  nästa match går förlorat. Eleven väljer en startspelare under 5★ och får alltid 8 frågor; rätt ger 12 poäng,
  vid 100 en stjärna till och resten följer med (`xp −= 100`, som skissen), vid 5★ nollas poängen. Frågorna
  räknas i `summa` och `dagar` som källan `traning` ("Träning"), inte som en match.
- **Påbörjat läger** (`lagerStart`, `lagerPaborjat`, `lagerAvbrutet`): när lägret startar sparas
  `lager = nyckel + "-p"` (`"1-3-p"`, `"1-k-p"`). `lagerNyckel` ger då samma läger tills det är klart (`lager =
  nyckel` med träningen) eller avbrutet (`lager = nyckel` utan träning – räknas som använt). Ett påbörjat läger
  från en tidigare omgång gäller inte: nästa match öppnar ett nytt som vanligt.

### 15.2 Ekonomin och balansen (§12)

Med specens belopp har 60 % rätt råd med en 3★ redan efter 1,74 matcher i snitt (496 kr/match; 300 elever). **Alla inkomster halverades**
(`KASSA`: vinst 150, oavgjort 75, förlust 40, 8 per rätt, 12 per mål, uppflyttningen 300 – multiplikatorn
`1 + div × 0,25` som i specen). `npm run balans:matchdagen` (`admin/md-balans-trupp.mjs`), 1 000 elever per rad
– efter hur många matcher i Division 6 har eleven råd med en 3★ som finns till salu:

| Rätt | kr/match | Matcher (snitt) | Median | Inom 3 matcher | Mål (2,5–3,5) |
| --- | --- | --- | --- | --- | --- |
| 50 % | 214 | 3,42 | 3 | 57 % | – |
| **60 %** | 254 | **2,94** | 3 | 89 % | **ja** |
| 70 % | 291 | 2,65 | 3 | 98 % | – |

**Superligan** (80 % rätt, 400 säsonger): tränat lag med snitt 4★ vinner **47 %** (målet 45–55 %, fälls av
`test/matchdagen-balans.test.js`); helt tränat (5★) 69 %.

**Karriären med truppen** (100 robotklubbar × 30 säsonger som tränar i varje läger – den sämsta spelaren under
5★ – och köper den största förbättringen de har råd med): andel som når divisionen · median säsonger ·
speltimmar · lagets snitt då.

| Rätt | Division 3 | Division 1 | Superligan |
| --- | --- | --- | --- |
| 80 % | 100 % · 3 · 3,2 h · 4,1★ | 100 % · 6 · 6,8 h · 5,0★ | 100 % · 8 · 11,3 h · 5,0★ |
| 70 % | 100 % · 4 · 4,1 h · 4,4★ | 100 % · 7 · 8,5 h · 5,0★ | 100 % · 12 · 17,1 h · 5,0★ |
| 60 % | 100 % · 6 · 6,0 h · 5,0★ | 100 % · 12 · 13,7 h · 5,0★ | 44 % · 25 · 34,8 h · 5,0★ |
| 50 % | 100 % · 10 · 8,6 h · 5,0★ | 40 % · 21 · 23,3 h · 5,0★ | – |

Träningens tal är specens (12 poäng, 100 per stjärna). Med ett läger per omgång är laget helt tränat (5★) kring
Division 2, så i Superligan spelar en flitig elev med 5★ och vinner ~69 % på 80 % rätt – §12-målet (4★, 45–55 %)
gäller laget på väg upp. Frågorna fortsätter att avgöra: 50 % rätt kommer sällan förbi Division 1. Ändras
träningen (färre poäng per rätt, ett läger varannan omgång) bör balansen köras om – en öppen fråga till Elias i
rapporten. Robotklubbens beteende (`KLUBB` i `md-balans-trupp.mjs`) är ett antagande, inte en spelregel.

### 15.3 Appen

- **Truppen** (`vy/md-vy-trupp.js`): namn och tröjfärg, klubbkassan, lagdelarna med lagbonusen, träningslägret,
  startelvan (stjärnor, stapeln "x/100 träning", Grundpelare, C), reserverna ("Byt in för X") och marknaden
  ("Köp för N kr" och vem som ersätts – annars varför det inte går). Korten och köpen: `vy/md-vy-marknad.js`
  (rena strängar, allt ur dokumentet `esc()`/tal); rutan "Reserverna är fulla" när en reserv måste släppas.
- **Sidhuvudets kassa** uppdateras efter köp och match (`S.kassa()`).
- **Träningslägret** (`vy/md-vy-lager.js`): välj spelare (under 5★), 8 frågor ur samma frågeström som matchen
  (`vy/md-strom.js`), stjärnorna och stapeln växer vid varje rätt svar, och "Selma Lind fick en stjärna till!".
  Varje svar sparas **lokalt direkt vid klicket** (`vidSvar` → `md-lokal.js sparaLager`,
  `matchdagen-lager:{uid}` = `{ v, nyckel, spelareId, svar: [{ ratt }], sek }`), så en omladdning fortsätter på
  nästa fråga och ger aldrig en ny chans på samma (#870 F1). När alla 8 är besvarade sparas lägret med EN
  skrivning; misslyckas den ligger svaren kvar ("Spara träningen"). En fråga som avbryts av ett flikbyte
  (`S.flik`, en AbortController per flikbyte i `md-app.js`) visas igen när eleven kommer tillbaka.
- **Omladdning, stängd flik, rensad lagring:** lägret märks som påbörjat **på servern** innan första frågan
  (`lagerStart`, EN skrivning – går den inte fram startar lägret inte). Kommer eleven tillbaka och svaren finns
  lokalt fortsätter lägret med dem. Finns de **inte** (lokal lagring rensad, en annan dator) räknas lägret som
  **använt**: "Träningslägret avbröts innan det var klart – det räknas som använt." (`lagerAvbrutet`, EN
  skrivning, ingen träning) – aldrig ett nytt läger eller nya frågor. Utan lokal lagring (privat fönster) gäller
  lägret i minnet (`S.lagerMinne`, `md-lokal.js pagaendeLager`) tills sidan laddas om.
- **Spärrarna:** köp, byten och lägret väntar medan en match pågår (också en sparad lokalt) och tills kön av
  osparade matcher är sparad (`sparaKon` först – annars skulle köpet sparas före matchen det kom ur). Köp och
  byten väntar på ett påbörjat läger, och **Match-fliken** visar "Gör klart träningen först" medan ett läger är
  påbörjat eller osparat (lägret och matchen i samma skrivning ryms inte i reglerna, och nästa match stänger
  lägret). Före avspark påminner Match-fliken om ett ledigt läger (inte om ett påbörjat utan svar – det är använt).
- **Äldre dokument** (Etapp 1–2a) får tomma `reserver`/`marknad` (`truppFalt`); marknaden fylls efter nästa match.
- **Förhandsvisningen:** `?kassa=N`, `?trupp=visa` (två köpta spelare, grundpelare bland reserverna, träning).

### 15.4 Sparningen och reglerna

- `reserver`, `marknad` och `lager` hör till `KARRIAR_FALT`. Köp, byte och läger sparas med `sparaTrupp(uid, K)`
  (EN skrivning, `mergeFields` utan `klubb`).
- **Marknaden i dokumentet** är rader `"id|namn|pos|nr|st"` (`md-trupp.js saluRad`, `marknadTillDok` i `md-data.js`
  vid varje skrivning, `marknadFranDok` vid läsningen och i `truppFalt`) – så att reglerna prövar hela marknaden
  med ETT reguljärt uttryck i varje matchsparning. I appen och i den lokala kön är spelarna objekt.
- **Reglerna** (`firestore.rules`, tester `firestore-rules-matchdagen-trupp.test.js`). Gränsen på 1000 uttryck
  per begäran styr allt (en ny klubb låg redan nära i 2a), så spelarnas **form** prövas bara där de kommer in
  utifrån, och vid en uppdatering prövas **varifrån** varje startspelare kommer, jämfört med det sparade
  dokumentet `g`:
  - **Ny klubb** (`create`): sju nya grundpelare `g1`–`g7` i ordning, exakt de åtta fälten, `st` 2, `xp` 0,
    `nr` ≤ 3 siffror, namn 1–40 tecken utan `| / < > & "`, en känd position, `grundpelare`/`kapten` sanningsvärden
    (ett reguljärt uttryck över alla sju, `mdNyTruppOk`), inga reserver, ingen marknad, kassan ≤ 600 och summan
    från noll (`mdTomSumma`). Hann den nya klubben aldrig sparas skapar `sparaMatch`
    den först från noll (`forstaDokument`) och sparar sedan matchen.
  - **En plats i startelvan** (`mdPlatsOk`) är oförändrad, en reserv ur `g.reserver` som byts in, köpt ur
    `g.marknad` (`mdKopOk`: exakt raden ur marknaden och bara dess fält, `xp` 0, heltal, 2★ till divisionens tak,
    raden borta ur `d.marknad`, ingen match i samma skrivning, och kassan ≤ `g.kassa − pris + återbetalning`) –
    eller samma spelare tränad (bara `st`/`xp`, heltal, `xp` 0–99, +1–96 poäng, `lager` byts i samma skrivning,
    reserverna inte). En reserv kommer in bara när reserverna ändras.
  - **Ingen spelare två gånger, grundpelarna kvar** (`mdUnikaOk`, vid ett byte eller köp): truppen + reserverna
    har inga dubbletter, och högst EN spelare lämnar klubben – aldrig en grundpelare.
  - **Reserverna** ≤ 5, alla ur `g.trupp` + `g.reserver` (`hasAll`). **Marknaden** (`mdMarknadOk`): när summan
    ändras (en match) högst 6 rader som matchar `k[0-9a-z]{1,6}|namn 1–40|MV/FÖR/MIT/ANF|nr 0–99|1–5`; annars
    den sparade minus exakt EN rad (ett köp per skrivning).
  - **Kassan** per skrivning: högst 5 000 kr per bokförd match (Δ`summa.matcher` ≤ 500), plus 400 kr bara när
    reserverna ändras (ett köp där en släppt köpt reserv ger mer än köpet kostar).
  - **Lägret:** `"säsong-omgång"` (omgång 1 till ligans spelade) eller `"säsong-k"`, påbörjat med `"-p"` efter
    (`[0-9]{1,5}-([1-9][0-9]?|k)(-p)?`, den här säsongen).
- **Gränser som inte prövas** (bara elevens eget spel – Matchdagen ger inga pluggmynt; vad en elev som skriver
  förbi appen kan göra):
  - **Matcherna:** att en match verkligen spelats – `summa.matcher` +1 ger upp till 5 000 kr och en ny marknad.
  - **Marknaden:** när summan ändras (t.ex. bara `summa.fragor` +1) kan eleven skriva en egen marknad i rätt form –
    och sedan köpa ur den till fullt pris, högst divisionens stjärntak. Ingen gratis spelare, bara valet av vem.
  - **Kassan utan match:** +400 kr när reserverna ändras – att stryka en köpt reserv ger 400 kr men spelaren
    kostade minst 560 (förlust); ett köp med släppt reserv ger högst 1 600 − priset (som i appen).
  - **Lägret:** att det är nyare än det sparade (växlar man lägret fram och tillbaka kan man träna mer).
  - **Positionerna** (en elev kan bara förstöra sin egen formation). Vyerna `esc()`:ar och `Number()`:ar allt ur
    dokumentet.
- **Marginalen** mot 1000-gränsen (extra `(d.div == d.div) &&` som ryms, efter rättningsrunda 1): ny klubb 8,
  match 40, läger 16, lägrets start ≥ 50, köp 28, köp med fulla reserver 26, byte ≥ 50, 4 matcher i en skrivning 18,
  kvalet 12, hela säsongen + kvalet i en skrivning (en ny klubb offline en hel säsong) 2 (lika som före runda 1); läger + match i en skrivning
  nekas (därför spärren). Mätningen: rapporten (Etapp 2b).
- **En kö som ändrats någon annanstans** (en annan dator, eller ett köp vars svar aldrig kom men som gick fram):
  reglerna nekar spelare som inte finns i det sparade dokumentet. `sparaKon` läser då serverns karriär EN gång och
  lägger kön ovanpå dess trupp, reserver och läger (`ovanpaServern`: matcherna och tabellen lokala, kassan
  serverns + köns pengar, högst den lokala) – annars skulle sparningen låsas för alltid.

### 15.5 Kvoten (§13)

| Vad | Läsningar | Skrivningar |
| --- | --- | --- |
| Ett träningsläger | 0 (samma frågeström, områdena redan lästa) | 2 (start + klart) |
| Ett köp eller byte | 0 | 1 |
| En nekad kö (ovanpå servern, sällsynt) | 1 | 0 |

**Eleven under en timme** med 5 träningsläger (~6 matcher, ett läger tar ~1,5 min) och 3 köp/byten: ≈ 8
läsningar (som 1c) och ≈ 12 + 10 + 3 + 1 (namnbyte) = **26 skrivningar** (mål < 50).

### 15.6 Deploy

Se §9: **`firestore:rules` före webben**. Inga index, inga functions.
