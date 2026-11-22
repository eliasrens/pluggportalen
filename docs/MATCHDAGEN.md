# Matchdagen – fotbollsspel per elev

Spec: [`UTVECKLINGSUPPDRAG_MATCHDAGEN.md`](UTVECKLINGSUPPDRAG_MATCHDAGEN.md) (epic #866). Godkänd skiss:
[`preview/preview-matchdagen-skiss.html`](../preview/preview-matchdagen-skiss.html). Rapporten per etapp:
[`QA-RAPPORT-matchdagen-etapp-1.md`](QA-RAPPORT-matchdagen-etapp-1.md), [`QA-RAPPORT-matchdagen-etapp-2.md`](QA-RAPPORT-matchdagen-etapp-2.md),
[`QA-RAPPORT-matchdagen-etapp-3.md`](QA-RAPPORT-matchdagen-etapp-3.md), [`QA-RAPPORT-matchdagen-etapp-4.md`](QA-RAPPORT-matchdagen-etapp-4.md).

Matchdagen är ett fotbollsspel där varje drag kräver ett rätt svar. Läraren slår på det för **enskilda
elever** eller (#876, §19) för **hela klassen**. Det här dokumentet växer med etapperna:

| Etapp | Innehåll | Status |
| --- | --- | --- |
| 1a (#867) | Moduler per elev (`elevModuler`, `perElev`), lärarens "Anpassningar per elev" (`matchdagenInst`), platshållarsida | klar |
| 1b (#868) | Frågekällorna (`md-fragor.js`), frågekortet (`md-svar.js`), den rena matchmotorn och ligan (`src/matchdagen/delat/`), balanssimuleringen | klar |
| 1c (#869) | 3D-planen med 2D-reserv (§12), matchvyn, säsongen i Division 6 (§10), sparning, kvot (§11) och statistik för elev och lärare (§13) | klar |
| 2a (#870) | Alla divisioner, kvalet och straffarna, finten från Division 3 (§14), balansen i alla divisioner (§7.1) | klar |
| 2b (#871) | Truppen, reserverna, marknaden och träningslägret, ekonomin (§15) | klar |
| 2c (#872) | Silverpokalen, rekorden och pokalerna som rader (§16) | klar |
| 3 (#873) | Superligans mästare, Mästarcupen med finalscen, legendklubben och Pokalskåpet (§17) | klar |
| 4 (#874) | Vänskapsmatcher i realtid: lobbyn, callables, den synkade motorn, rättning på servern, inbördes möten (§18) | klar |
| #876 | Hela klassen: `enabledModules`, klassens inställningar (`classes/{id}.matchdagenInst`), "Välj alla" (§19) | klar |
| #878 | Hotfix: versionsglapp efter deploy, klassens frågor i Vad eleverna ser, helskärm (§19.6) | klar |
| #879 | Mattematchen räknas in: multiplikationssvaren (§20) | klar |
| #880 | Topplistan per årskurs: topp 5 i hela skolan, byggd av servern varje timme (§21) | klar |
| #883 | Nya karriärer börjar på 1★, stjärnorna kostar 50/100/250/500 poäng, tre träningsläger per omgång, balansen (§22) | klar |
| #895 | Vänskapsmatcherna snabbare: klockfelet, EN callable (`mdVanskap`), krockar utan väntan, svaret kvar under animationen (§23) | klar |

## 1. Moduler per elev (Etapp 1a)

### 1.1 Registret

`STUDENT_MODULES` i `src/gamemode-visibility.js` har fältet **`perElev: true`**: modulen slås på för
enskilda elever i `classes/{classId}.elevModuler = { [uid]: ["matchdagen"] }`. Matchdagen:

```js
{ id: "matchdagen", label: "Matchdagen", ikon: MATCHDAGEN_IKON, grupp: "ova", learning: true, lockable: false,
  optIn: true, perElev: true, routes: ["/elev/matchdagen"] }
```

- `MATCHDAGEN_IKON` är en SVG-fotboll (samma som skissens logga), ingen emoji.
- Sedan #876 står en per-elev-modul **också** i `TOGGLABLE_MODULES` (lärarens klassvisa av/på i Vad eleverna
  ser, `enabledModules`) – se §19. Den ligger i `PER_ELEV_MODULES`, och
  `moduleForRoute` grindar dess route som för andra moduler. `OPT_IN_MODULES` innehåller den (dold när
  klasslistan inte går att läsa).
- `normalizeElevModuler(map, studentIds?)`: bara kända per-elev-moduler, inga tomma listor, högst 100 elever
  (`ELEV_MODULER_MAX`), och med `studentIds` bara klassens elever.

### 1.2 Synligheten

`modulesHiddenForStudent(classes, meId)` (sidomenyn i `ui.js` och routern i `app.js`): en opt-in-modul syns om
någon av elevens klasser har den i `enabledModules` **eller** har eleven i `elevModuler` för den. Bara klasser
där eleven står i `studentIds` räknas, så en lista i en annan klass gör ingenting. Med `matchdagen` i klassens
`enabledModules` (#876) ser alla klassens elever den. Testat i `test/matchdagen-modul.test.js` och
`test/matchdagen-klass.test.js`.

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
- `enabledModules` får innehålla `"matchdagen"` sedan #876 (förut nekat). Klassens inställningar: §19.
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
rensas) och `matchdagenInst/{uid}` i **en** batch. Sedan #876 skrivs `matchdagenInst/{uid}` bara om läraren
ändrat något för en elev som följer klassen (§19).

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
marknaden och träningslägret i Etapp 2b. "Tränas 2★ → 4★" var ett **antagande** för 2b (snittet växer jämnt med
divisionen). Hela utskriften: rapporten.

**Realistiskt (#883, §22.3):** laget börjar på 1★ och tränas med tre läger per omgång. Med 70 % rätt har laget
~3★ när det når Division 5, ~4★ i Division 4–3 och 5★ först från Division 2 (8–10 säsonger, 11–15 speltimmar);
med 50 % rätt 4★ i Division 4 och 5★ från Division 3. Tabellerna ovan (otränat 2★-lag) gäller oförändrat.

## 8. Filer och bootgrafen


Allt nytt ligger i `src/matchdagen/` och laddas med `import()` – bootgrafen är oförändrad (107 filer, testat i
`test/matchdagen-modul.test.js`). I bootfilerna ändrades bara registret (`gamemode-visibility.js`), en route i
`app.js` och lärarens sektions-/flikregister (`teacher-classes-sections.js`, `teacher-mina-val.js`,
`teacher-struktur.js`, och i 1c `STATS_TABS` i `teacher-class.js` med en dynamisk `import()`). three.js och
allt i `src/matchdagen/plan/` laddas först när matchen startar. Stilarna: `src/styles/48-matchdagen.css` (+ `npm run build:css`).

| Fil | Vad |
| --- | --- |
| `src/matchdagen/md-inst.js` | ren: formen på `matchdagenInst`, `normalizeInst`, `harKallor`, `kallNycklar`, `nyaElevModuler`, `sammanfattning`, `fragorText`; #876: `klassPa`, `elevPa`, `harMatchdagen`, `klassInst`, `effektivInst`, `STANDARD_FRAGOR`, `nyaEnabledModules`, `sammaInst` |
| `src/matchdagen/md-inst-data.js` | Firestore: `lasInst(uid)`, `sparaAnpassning(cls, uid, { pa, inst })`; #876: `sparaKlass`, `sparaElevModuler`, `foljKlassen` |
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
| `src/matchdagen/plan/` | planen (§12): `md-plan` (väljer 3D/2D, spelar upp händelserna), `md-formation` (ren), `md-tre-ritare`/`-arena`/`-figur` (3D), `md-plan-2d` (SVG-reserven), `md-tre-kamera` (kamerans mål, ren), `md-tre-publik` (läktaren, #882) |
| `src/matchdagen/larare/md-larare-stat.js`, `md-lagnamn.js` | lärarens underflik Matchdagen i Hur går det? och Återställ lagnamn (§13) |
| `src/styles/49-matchdagen-match.css` | elevens app och matchvyn (kvällsarenan) |
| `src/matchdagen/delat/md-straffar.js`, `md-kval.js` | ren: straffläggningen och kvalet (§14, #870) |
| `src/matchdagen/vy/md-straff-spel.js` | straffläggningen i matchvyn (#870) |
| `preview/preview-matchdagen.html` | förhandsvisning 1c med stubbad data (`PORT=8869 node server.mjs`; `?vy=match\|tabell\|trupp\|stat`, `?omg=0–5`, `?klubb=ny`, `?ny=1`, `?2d=1`, `?lugnt=1`, `?fps=1`, `?auto=1`, `?svar=skriv`, `?klocka=30`, `?kallor=inga`; 2a: `?div=0–7`, `?kval=1`, `?straffar=1`; 2b: `?kassa=N`, `?trupp=visa`; 2c: `?cup=ute` (utslagna i kvartsfinalen), `?rekord=1` (ligamatchen står 6 – 0 i 88:e minuten)) |
| `src/matchdagen/delat/md-trupp.js` | ren: truppen, reserverna, marknaden och träningslägret (§15, #871) |
| `src/matchdagen/vy/md-vy-marknad.js`, `md-vy-lager.js`, `md-strom.js` | Truppens kort, köpen och bytena; träningslägret; frågeströmmen (delad av matchen och lägret) (#871) |
| `admin/md-balans-trupp.mjs` | balansen för ekonomin och karriären med truppen (§15.2) |
| `src/matchdagen/delat/md-cup.js`, `md-rekord.js` | ren: Silverpokalen och rekorden (§16, #872) |
| `src/matchdagen/vy/md-vy-cup.js`, `md-efter-match.js` | cupens rundor under tabellen och rekorden i Statistik; rutan efter matchen med "Nytt rekord: …" (#872) |
| `admin/md-balans-cup.mjs` | balansen för Silverpokalen (§16.3) |
| `src/matchdagen/delat/md-mastarcup.js`, `md-legend.js` | ren: Mästarcupen, legendklubben, klubbhistoriken och pokalskåpets sorter (§17, #873) |
| `src/matchdagen/vy/md-vy-pokaler.js`, `md-pokal-svg.js` | fliken Pokalskåpet, pokalerna och klubbmärket som SVG (§17.4, #873) |
| `src/matchdagen/vy/md-vy-mastarcup.js`, `md-vy-legend.js` | Mästarcupens texter, rundorna under tabellen och finalens intro; "Starta en legendklubb" (§17, #873) |
| `src/matchdagen/plan/md-tre-fest.js` | firandet i 3D: pokalen lyfts, fyrverkerier (§17.3, #873); 2D-firandet i `md-plan-2d.js` |
| `src/styles/50-matchdagen-pokaler.css` | Pokalskåpet, klubbmärket, finalens intro, firandet i 2D (#873) |
| `admin/md-balans-mastarcup.mjs` | balansen för Mästarcupen (§17.5) |
| `preview/preview-matchdagen-pokaler.html` | förhandsvisning 3: skåpet och finalscenen utan Firebase (`PORT=8873 node server.mjs`; `?scen=skap\|final\|mastare`, `?lyft=mastarcup\|superliga`, `?skap=tomt\|fullt\|legend`, `?2d=1`, `?lugnt=1`, `?fps=1`); i `preview-matchdagen.html` (3): `?mastare=1` (sista omgången i Superligan), `?mc=1\|final\|vunnen` (`&slut=1`: finalen står 2 – 0 i 88:e minuten), `?legend=1` (en legendklubb med fullt skåp) |
| `preview/preview-matchdagen-fragor.html` | förhandsvisning 1b: frågekortet + motorn som textmatch (`PORT=8868 node server.mjs`; `?svar=skriv`, `?klocka=30`, `?kallor=tabell\|omrade\|rakna\|klocka\|inga`) |
| `src/matchdagen/delat/md-topplista.js`, `vy/md-vy-topplista.js`, `functions/md-topplista-bygg.js` | topplistan per årskurs (§21, #880): ren rangordning + rimlighetskontroll, fliken Topplista, serverns bygge (`mdTopplista`, schemalagd) |
| `src/matchdagen/md-mm.js` | ren: `mmSvar` – ett tabellsvar som Mattematchens svar; skrivningen i `md-data.js mmRaknaIn` → `src/tavling/mm-live.js` (§20, #879) |

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

Etapp 2c: **`firebase deploy --only firestore:rules` och webben i samma omgång, reglerna först.** Gamla regler +
ny webb: `cup` och `rekord` är text, som de gamla reglerna nekar (de väntade en map) – varje match efter den
första cupmatchen eller det första rekordet blir liggande i den lokala kön. Nya regler + gammal webb: den gamla
webben skriver `pokaler` som objekt, som de nya reglerna nekar när listan ändras (en ligavinst eller ett kval) –
den matchen ligger kvar i kön tills sidan laddas om med den nya webben (som gör om pokalerna till rader).
Inget går förlorat, men glappet ska vara kort. Inga index, inga functions.

Etapp 3: **`firebase deploy --only firestore:rules` och webben i samma omgång, reglerna först.** Gamla regler +
ny webb: `mastarcup` och `klubbhistorik` är okända fält, och pokalerna `superliga`/`mastarcup` är okända typer –
den sista matchen i Superligan (mästare) och varje match i Mästarcupen blir liggande i den lokala kön, och en
legendklubb kan inte startas (appen säger "prova igen"). Nya regler + gammal webb: inget nekas (den gamla webben
skriver inga av de nya fälten och har aldrig `legendStjarnor` > 0). Inga index, inga functions.

**Hela Matchdagen är ännu inte i drift** (Etapp 1–3 deployas tillsammans): `firebase deploy --only firestore:rules`,
direkt därefter webben. Inga index, inga functions, ingen datamigrering.

## 10. Säsongen och sparningen (Etapp 1c)

### 10.1 Säsongen i Division 6

`src/matchdagen/delat/md-sasong.js` (ren, testad i `test/matchdagen-sasong.test.js`):

- **Ny klubb:** `nyKarriar({ namn, farg, rng })` – namn 1–24 tecken (`lagnamnOk`), en av 8 tröjfärger
  (`TROJFARGER`), sju grundpelare med färdiga namn ur `FORNAMN`/`EFTERNAMN` (1★ sedan #883 – förut 2★ –, en av
  utespelarna är lagkapten).
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
  ~61 kB med allt fyllt (en ny klubb ~2 kB; `cup` + `rekord` < 200 byte, 2c), under specens 200 kB. **Reglerna
  håller INTE 200 kB:** de begränsar antalet, inte strängarnas längd, i ligans lag (`liga.lag[].namn`), `senaste`,
  `sasonger` och källnamnen (`pokaler` är sedan 2c rader, hela listan ≤ 20 000 tecken). En elev som skriver förbi appen kan blåsa upp sitt eget dokument till Firestores tak 1 MiB (Testern
  #871: ~900 kB gick igenom) – och lärarens Hur går det? läser det. Det som prövas strängt är klubben, truppen,
  reserverna, marknaden (#871), summan och kvalet.

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
- **Kameran** (`md-tre-kamera.js`, ren): tv-kamera från långsidan som mjukt följer bollen – dit den är på väg – längs
  planen och på tvären, och zoomar in kort vid mål. #882: bollen och spelarna runt den ska alltid synas, också vid den
  närmaste långsidan och i alla ytors proportioner (`test/matchdagen-kamera-882.test.js` projicerar med three).
- **Läktaren** (`md-tre-publik.js`, #882): bänkrader i trappsteg och publiken som små figurer i spelarnas stil (kropp +
  huvud), tre `InstancedMesh` = tre ritanrop, ingen textur. Vänstra halvan bär vår tröjfärg, högra motståndarnas, blandat
  med neutrala jackor; finalen fullsatt. Vid mål hoppar den halva vars lag gjorde mål (inte i lugnt läge).
- **Lugnt läge** (`matchdagenInst.lugnt`) **och `prefers-reduced-motion`:** fast kamera över hela planen,
  ingen zoom eller skakning, spelare och boll hoppar direkt till sina platser. Den fasta vyn backar på smala ytor så att
  hela planen ryms (`lugnVy`).
- **Prestandan:** ingen kantutjämning, pixeltäthet högst 1,5 och en pixelvakt som sänker den (×0,75, aldrig
  under 0,6) när fps < 45. Mätningarna står i rapporten.
- **Inget ljud** (#882, beslut av Elias): Matchdagen spelar inga ljud och har ingen ljudknapp (`md-ljud.js` borttagen).
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
  Lagbonusen per lagdel `(snitt − 2) × 0,05` (`md-motor.js lagbonus`) räknas ur startelvan när matchen börjar –
  startlaget (1★, #883) har −5 %.
  Truppen visar lagdelarnas snitt och effekt ("räddningar +10 %": målvaktens bonus räknas dubbelt i
  `chansRaddning`, `RADDNING.bonus`).
- **Grundpelarna** (`grundpelare: true`, 1★ i en ny karriär, 2★ i en från före #883) säljs aldrig. Kaptensbindeln: lagkaptenen, eller – när kaptenen
  sitter bland reserverna – den första grundpelaren ute på planen (`kaptenPlats`).
- **Marknaden:** `nyMarknad(K, rng)` – 6 spelare (id `k…`, namn och tröjnummer som klubben inte har, `xp` 0,
  ingen `grundpelare`), stjärnorna `kl(avrunda(slump(1; 3,2 + div × 0,3)); 1; 5)` (#883: från 1★; taket per division
  `marknadMaxSt`: 3, 4, 4, 4, 4, 5, 5, 5). Ny marknad efter **varje** match och kval (`matchKlar`/`kvalKlar` med
  `rng`); en ny klubb har ingen (den första kommer efter första matchen).
- **Priset** – en tabell per stjärnor (`MARKNAD.pris`, #890): 150, 560, 1 210, **3 150**, **5 200** kr för 1★–5★
  (förut `avrunda(150 × st^1,9; 10)`, 2 090 och 3 190 för 4★/5★ – se §22.3). En köpt spelare säljs för halva
  priset (`saljPris`).
- **Köpet** (`kopInfo`, `kop`): den köpta ersätter den **sämsta på samma position** (lägst `traningsVarde`; vid
  lika en grundpelare). En köpt som ersätts säljs, en grundpelare flyttas till reserverna (högst 5). Är
  reserverna fulla väljer eleven först en **köpt** reserv som släpps (säljs för halva priset); är alla fem
  grundpelare går köpet inte. Köpet går inte heller när den nya inte har fler stjärnor än den som ersätts,
  eller när kassan (plus återbetalningen för en såld) inte räcker.
- **Byten** (`bytIn`): en reserv och en startspelare på samma position byter plats – när som helst.
- **Träningslägret** (`lagerNyckel`, `tranaSpelare`, `lagerResultat`): sedan #883 upp till **tre läger per
  spelad omgång** (`"säsong-omgång-1"` … `"-3"`, från omgång 1) och inget extra före kvalet – se §22. Läger som
  inte används före nästa match går förlorade. Eleven väljer en startspelare under 5★ och får alltid 8 frågor;
  rätt ger 12 poäng, vid **50/100/250/500** (till 2★/3★/4★/5★, `TRANING.xpTillStjarna`) en stjärna till och
  resten följer med (`xp −= kostnaden`), vid 5★ nollas poängen. Frågorna räknas i `summa` och `dagar` som
  källan `traning` ("Träning"), inte som en match.
- **Påbörjat läger** (`lagerStart`, `lagerPaborjat`, `lagerAvbrutet`): när lägret startar sparas
  `lager = nyckel + "-p"` (`"1-3-2-p"`; före #883 `"1-3-p"`, `"1-k-p"`). `lagerNyckel` ger då samma läger tills det är klart (`lager =
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
  startelvan (stjärnor, stapeln "143 / 250 till ★★★★" – #883, Grundpelare, C), reserverna ("Byt in för X") och marknaden
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
  - **Ny klubb** (`create`): sju nya grundpelare `g1`–`g7` i ordning, exakt de åtta fälten, `st` 1 (#883; 2 från en äldre app godtas), `xp` 0,
    `nr` ≤ 3 siffror, namn 1–40 tecken utan `| / < > & "`, en känd position, `grundpelare`/`kapten` sanningsvärden
    (ett reguljärt uttryck över alla sju, `mdNyTruppOk`), inga reserver, ingen marknad, kassan ≤ 600 och summan
    från noll (`mdTomSumma`). Hann den nya klubben aldrig sparas skapar `sparaMatch`
    den först från noll (`forstaDokument`) och sparar sedan matchen.
  - **En plats i startelvan** (`mdPlatsOk`) är oförändrad, en reserv ur `g.reserver` som byts in, köpt ur
    `g.marknad` (`mdKopOk`: exakt raden ur marknaden och bara dess fält, `xp` 0, heltal, 1★ till divisionens tak,
    raden borta ur `d.marknad`, ingen match i samma skrivning, och kassan ≤ `g.kassa − pris + återbetalning`) –
    eller samma spelare tränad (bara `st`/`xp`, heltal, `xp` under poängen till nästa stjärna, +1–96 poäng räknat
    som `mdTranVarde` – #883 –, `lager` byts i samma skrivning, reserverna inte). En reserv kommer in bara när reserverna ändras.
  - **Ingen spelare två gånger, grundpelarna kvar** (`mdUnikaOk`, vid ett byte eller köp): truppen + reserverna
    har inga dubbletter, och högst EN spelare lämnar klubben – aldrig en grundpelare.
  - **Reserverna** ≤ 5, alla ur `g.trupp` + `g.reserver` (`hasAll`). **Marknaden** (`mdMarknadOk`): när summan
    ändras (en match) högst 6 rader som matchar `k[0-9a-z]{1,6}|namn 1–40|MV/FÖR/MIT/ANF|nr 0–99|1–5`; annars
    den sparade minus exakt EN rad (ett köp per skrivning).
  - **Kassan** per skrivning: högst 5 000 kr per bokförd match (Δ`summa.matcher` ≤ 500), plus 2 040 kr (#890; förut 400) bara i ett
    köp (`mdKopTillagg`: reserverna och marknaden ändras, inget läger, och en spelare i truppen är ny för klubben)
    – där en släppt köpt reserv ger mer än köpet kostar. Köpet självt (`mdKopOk`) räknar exakt: tillbaka halva
    priset för den ersatta köpta spelaren, eller för just den reserv som släpps (`mdSlapptPris`).
  - **Lägret:** `"säsong-omgång-nummer"` (omgång 1 till ligans spelade, nummer 1–3 – #883), de äldre formerna
    `"säsong-omgång"` och `"säsong-k"`, påbörjat med `"-p"` efter (`[0-9]{1,5}-([1-9][0-9]?(-[1-3])?|k)(-p)?`, den
    här säsongen).
- **Gränser som inte prövas** (bara elevens eget spel – Matchdagen ger inga pluggmynt; vad en elev som skriver
  förbi appen kan göra):
  - **Matcherna:** att en match verkligen spelats – `summa.matcher` +1 ger upp till 5 000 kr och en ny marknad.
  - **Marknaden:** när summan ändras (t.ex. bara `summa.fragor` +1) kan eleven skriva en egen marknad i rätt form –
    och sedan köpa ur den till fullt pris, högst divisionens stjärntak. Ingen gratis spelare, bara valet av vem.
  - **Lägret:** att det är nyare än det sparade (växlar man lägret fram och tillbaka kan man träna mer).
  - **Storleken:** strängarna i ligans lag, `senaste` och `sasonger` (§10) – upp till 1 MiB (`pokaler` prövas sedan 2c, §16.4).
  - **Köp + inbytt reserv i samma skrivning** (Testern F9): `mdSlapptPris` räknar den som finns i `g.reserver` men
    inte i `d.reserver` som släppt – också en köpt reserv som i samma skrivning byts in på planen. Ett köp med fulla
    reserver ger då (#890: en köpt 5★-reserv, 2 600) +1 390 kr i stället för −1 210 (högst +2 040 per köp, `mdKassaOk`). Rättas senare genom att bara
    räkna spelare som lämnar klubben (inte finns i `d.trupp` + `d.reserver`), som `mdUnikaOk`.
  - **Positionerna** (en elev kan bara förstöra sin egen formation). Vyerna `esc()`:ar och `Number()`:ar allt ur
    dokumentet.
- **Marginalen** mot 1000-gränsen (extra `(d.div == d.div) &&` som ryms, efter rättningsrunda 2 i 2b – efter 2c se §16.4): ny klubb 8,
  match 40, läger 16, lägrets start ≥ 50, köp 22, köp med fulla reserver 18, byte ≥ 50, 4 matcher i en skrivning 18,
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

## 16. Silverpokalen och rekorden (Etapp 2c, #872, spec §9)

### 16.1 Silverpokalen (`md-cup.js`, ren)

- **En utslagscup per säsong** i fyra rundor (`CUP.rundor`: sextondelsfinal, kvartsfinal, semifinal, final),
  spelad **mellan ligaomgångarna**: `cupSchema(antal)` delar ligan i fem jämna bitar, `round((i + 1) × n / 5)`,
  aldrig efter sista omgången – 5 omgångar → efter 1, 2, 3, 4 · 7 → 1, 3, 4, 6 · 9 → 2, 4, 5, 7 · 11 → 2, 4, 7, 9.
  En cupmatch som väntar spelas **före** nästa ligamatch (`cupMatch(K, uid)`; Match-fliken, `nastaSpel` i
  `md-vy-match.js`). Ligan är aldrig blockerad längre än en match.
- **Lottningen** (`cupLottning(K, uid)`, fröet `uid|säsong|div|cup` – samma motståndare efter en omladdning):
  fyra lag ur namnlistan som inte är med i ligan, var och en från en division inom ±2 (`CUP.spridning`, aldrig
  under Division 6 eller över Superligan), sorterade svagast först – finalen är oftast tuffast. Styrkan är
  divisionens (`styrkaFor`), så ett lag från en högre division är starkare men går att slå (skrällar, §16.3).
- **Matchen** är en vanlig match med `avgor: true` (oavgjort → straffar, som kvalet). Vinst → nästa runda;
  förlust → ute för säsongen; vunnen final → pokalen `{ typ: "cup", namn: "Silverpokalen" }` och
  `CUP.seger × (1 + div × 0,25)` kr (`cupKlar`). Cupen ändrar **aldrig** `div` (testat).
- **Sparningen:** `K.cup` är EN rad text `"säsong-spelade"` (`"3-2"` = två rundor vunna säsong 3), `"-u"` efter
  när laget åkte ut i den rundan (`"3-2-u"`), `"säsong-4"` = vunnen. Ett annat säsongsnummer (eller inget fält)
  = ingen runda spelad. Matchdokumentet har `typ: "cup"` och `omg` = rundan 1–4; `senaste` får `typ: "cup"`.
  Cupmatchen bokförs som en match (`bokforMatch`: kassan, summan, dagarna, rekorden) och ger en ny marknad.
  Träningslägret förbrukas **inte** av en cupmatch (lägret gäller ligaomgången).
- **Påbörjad cupmatch:** `md-lokal.js` sparar `runda` med den pågående matchen, så en omladdning fortsätter
  rätt runda; kön (`konsPengar`) räknar prispengarna efter en vunnen final.

### 16.2 Rekorden (`md-rekord.js`, ren)

Specens sju sorter + obesegrad säsong som egen rad (åtta): flest mål i en match (`mm`), flest mål på en säsong
(`ms`), största seger (`ss`), längsta svit utan förlust (`sv`), flest ligatitlar i rad (`lt`), obesegrade
säsonger (`os`), bästa andel rätt på en säsong med minst 3 matcher (`ar`) och snabbaste mål (`sm`).

- **Efter varje match** (liga, cup och kval – `rekordEfterMatch`): `mm`, `ss`, `sm` och sviten. En straffseger
  är ingen förlust, en straffförlust är det (`res.vann === false`: utslagna ur cupen, förlorat kval – Testern F3). **Efter sista ligaomgången** (`rekordEfterSasong`): `ms` och `ar` (ligan + cupen den
  säsongen; kvalet efteråt räknas inte), `lt` (etta i ligan) och `os` (ingen förlust i ligan).
- **Annonsen** "Nytt rekord: 5 mål i en match!" visas i rutan efter matchen (`md-efter-match.js`), en rad per
  rekord. Ett rekord som sätts **första gången** annonseras inte (då vore varje tidig match ett rekord) – bara när
  ett gammalt slås. Sviten annonseras EN gång: när den går förbi rekordet från innan sviten började (minst 3).
- **Sparningen:** `K.rekord` är EN rad text i formen `REKORD_MONSTER` – `"mm5.3|ms30.2|ss6-0.3|sv12.4|lt|os|ar85.2|sm2.1|nu…"`
  (värde.säsong, tomt = inget rekord än) plus `nu` = den här säsongens löpande mål, frågor, rätt, matcher,
  pågående svit, ligatitlar i rad och svitrekordet före sviten. `lasRekord` är tålig: en trasig del hoppas över.
- **Statistik** listar alla åtta (`md-vy-cup.js rekordLista`, "–" för ett rekord som inte finns än, "säsong N").
  Lärarens elevpanel visar cupens läge och de satta rekorden (bara tal och fasta texter).

### 16.3 Balansen (§12)

Specen sätter inga tal för cupen, bara att skrällar ska vara möjliga. `admin/md-balans-cup.mjs` (i
`npm run balans:matchdagen`, 400 säsonger per rad) och gränserna `CUP_MAL` (testade i
`test/matchdagen-balans.test.js`): Division 6, startlaget, 70 % rätt vinner cupen i 10–50 % av säsongerna och
slår ett lag från en högre division i 30–90 % av mötena; med 50 % rätt 5–60 %.

| Division | Rätt | Laget | Vunnen | Ute i första | Skrällar | Straffar | Cupmatcher/säsong | Säsong utan → med cupen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Division 6 | 70 % | 2★ | **25 %** | 29 % | **64 %** | 24 % | 2,6 | 51 → 72 min |
| Division 6 | 50 % | 2★ | 1 % | 58 % | 19 % | 30 % | 1,6 | 48 → 61 min |
| Division 6 | 30 % | 2★ | 0 % | 85 % | 12 % | 23 % | 1,2 | 47 → 56 min |
| Division 3 | 70 % | 4★ | 36 % | 15 % | 69 % | 25 % | 3,1 | 74 → 100 min |
| Superligan | 80 % | 4★ | 27 % | 20 % | – | 26 % | 2,8 | 111 → 136 min |
| Superligan | 80 % | 5★ | 54 % | 12 % | – | 19 % | 3,3 | 112 → 140 min |

Prispengarna är **200 kr × multiplikatorn** (specens 400 halverat, som alla inkomster i 2b) – en vunnen cup i
Division 6 är ~0,8 matchers inkomst. Säsongen i Division 6 blir ~20 min längre med cupen (72 min; §12 säger
45–60 min för en säsong) – en öppen fråga i rapporten.

### 16.4 Reglerna

- `cup`: `'[0-9]{1,5}-[1-4](-u)?'`, prövas bara när fältet ändras. `rekord`: `REKORD_MONSTER` (ETT reguljärt
  uttryck, samma text i `md-rekord.js` och `firestore.rules`, testat). Båda är text, så ett objekt eller en lista
  nekas.
- `pokaler` sparas sedan 2c som **rader** `"typ|namn|säsong|ÅÅÅÅ-MM-DD"` (`md-sasong.js pokalRad`,
  `pokalerTillDok` i varje skrivning, `pokalerFranDok` vid läsningen – i appen är de objekt) och prövas med ETT
  uttryck över `join('/')` när listan ändras: typ `liga`/`kval`/`cup`, namn 1–40 tecken utan `| / < > & "`,
  högst 300 – och hela listan högst 20 000 tecken (`join('/').size()`; ett element kan innehålla `/` och bära
  flera rader, Testern F1 – appens största lista är 300 × 62 tecken). Det stänger storleksgapet (F8, #871) för
  pokalerna.
- `mastarcup` är borttaget ur de tillåtna fälten (Etapp 3 lägger till det med en riktig kontroll).
- **`mdSummaOk` med ett uttryck:** summans åtta heltal prövas som `[string(x + 0), …].join('|').matches(…)` –
  `+ 0` ger ett fel för text, ett flyttal blir `"5.0"` och ett negativt `"-1"`, som uttrycket nekar. Taken är
  antalet siffror (matcher/v/o/f 7, gjorda/insläppta 8, frågor/rätt 9). Det gav plats åt cupen, rekorden och
  pokalerna i den tunnaste skrivningen (hela säsongen + kvalet i en skrivning).
- **Inte prövat** (bara elevens eget spel, inga pluggmynt): att cupens rundor eller rekorden stämmer med
  matcherna – en elev som skriver förbi appen kan ge sig själv en vunnen cup (pokalen + 200 kr × mult., inom
  kassans tak per match) eller vilka rekord som helst i rätt form.
- **Marginalen** mot 1000-gränsen (extra `(d.div == d.div) &&` som ryms, mätt på de slutliga reglerna, upp till 60):
  ny klubb 9, match ≥ 60, läger 35, lägrets start ≥ 60, köp 26, köp med fulla reserver 22, byte ≥ 60, 4 matcher i
  en skrivning 30, kvalet 28, hela säsongen + cupen + kvalet i en skrivning 16 (var 2 före 2c), cupmatch ≥ 60,
  cupfinalen ≥ 60; läger + match i en skrivning nekas fortfarande (spärren i §15.3). Mätningen: rapporten (Etapp 2c).

### 16.5 Kvoten (§13)

Inga nya läsningar och inga lyssnare. En cupmatch är en match (en batch = 2 skrivningar); 1–4 cupmatcher per
säsong, i snitt 2,6 i Division 6 med 70 % rätt. Rekorden och pokalerna skrivs med matchen. Eleven under en timme
(~6 matcher varav ~2 cupmatcher, 5 läger, 3 köp/byten): ≈ 8 läsningar och ≈ 26 skrivningar – oförändrat mot 2b,
eftersom en cupmatch tar en ligamatchs plats i timmen.

## 17. Superligan, Mästarcupen, legendklubben och Pokalskåpet (Etapp 3, #873, spec §10)

### 17.1 Mästare i Superligan (`md-sasong.js matchKlar`, §10.1)

- Ligavinnaren i Superligan kvalar inte (det finns inget ovanför): den blir **mästare** – pokalen
  `{ typ: "superliga", namn: "Mästare i Superligan" }` (`SUPERLIGA.pokal`) och en **inbjudan till Mästarcupen nästa
  säsong** (`K.mastarcup = "säsong+1-0"`). `matchKlar` svarar `mastare: true`; rutan efter matchen visar titeln
  och laget lyfter pokalen på planen (§17.4).
- **Guldkanten** på klubbmärket (`md-legend.js guldkant`): den nuvarande klubben har vunnit Superligan (en
  `superliga`-pokal från säsongen klubben startade eller senare). En äldre ligapokal "Vinnare Superligan"
  (`typ` "liga", före Etapp 3) räknas som Superligan (`pokalSort`).

### 17.2 Mästarcupen (`md-mastarcup.js`, ren, §10.2)

- **Tre rundor** (kvartsfinal, semifinal, final) mot påhittade toppklubbar från andra länder
  (`md-namn.js TOPPKLUBBAR`, bara generiska förled som "Real", "AC", "Sporting" – inga riktiga klubbar), styrka
  **0,86–0,95** (`MASTARCUP.styrka`), svagast först. Lottningen har fröet `uid|säsong|mastarcup` (samma efter en
  omladdning).
- **Mellan Superligans omgångar:** `mcSchema(11)` → efter omgång 3, 6 och 8 (Silverpokalen spelas efter 2, 4, 7, 9;
  de krockar aldrig). Den som väntar spelas före nästa ligamatch, Silverpokalen först (`md-vy-match.js nastaSpel`).
- **Matchen** är en vanlig match med `avgor: true` (oavgjort → straffar). Förlust → ute; vunnen final → pokalen
  `{ typ: "mastarcup", namn: "Mästarcupen" }` och **500 kr × multiplikatorn** (`MASTARCUP.seger`, 1 375 kr i
  Superligan). Divisionen ändras aldrig. Matchdokumentet har `typ: "mastarcup"` och `omg` = rundan 1–3.
- **Sparningen:** `K.mastarcup` är EN rad text `"säsong-spelade(-u)"` (`MC_MONSTER`, samma uttryck i reglerna):
  `"13-0"` inbjudna, `"13-2"` två rundor vunna, `"13-1-u"` utslagna i semifinalen, `"13-3"` vunnen. En annan
  säsong, `null` eller inget fält = inte inbjudna. Inbjudan gäller bara säsongen efter mästartiteln – vinner laget
  Superligan igen bjuds det in igen.
- **Påbörjad match:** `md-lokal.js` sparar `runda` även för Mästarcupen; kön (`md-spara.js konsPengar`) räknar
  prispengarna efter en vunnen final.
- **Vyerna:** rutan före avspark säger vad som står på spel (`mcFore`), Tabell-fliken visar de tre rundorna under
  ligan (`mcHtml`), Statistik märker matcherna "Mästarcupen", lärarens elevpanel visar titlarna, läget i
  Mästarcupen och guldstjärnorna (`md-larare-stat.js toppRader`, bara tal och fasta texter).

### 17.3 Legendklubben (`md-legend.js`, ren, §10.3)

- **Erbjudandet** (`legendErbjudande`): i Superligan, en `mastarcup`-pokal från DEN HÄR säsongen och plats kvar i
  historiken (< 50). Det visas i rutan efter den vunna finalen, som en rad på Match-fliken och när säsongen är
  slut – aldrig tvång ("Nej tack – fortsätt i Superligan"). Nästa säsong är erbjudandet borta tills Mästarcupen
  vinns igen.
- **Den nya klubben** (`nyLegendklubb`, `md-vy-legend.js`): nytt namn och tröjfärg, Division 6, **nästa
  säsongsnummer** (säsongerna räknas vidare så att pokalernas och rekordens säsonger aldrig blandas ihop), sju nya
  grundpelare, 600 kr, ingen marknad, inga reserver, ny liga, `kval` och `mastarcup` `null`, och en
  **guldstjärna** till på klubbmärket (`klubb.legendStjarnor`). **Med följer** pokalskåpet, rekorden (den löpande
  säsongen nollas – sviterna hör till den gamla klubben), summan, de senaste matcherna, säsongerna och dagarna
  (lärarens historik försvinner aldrig).
- **Klubbhistoriken:** den gamla klubben blir EN rad `"namn|#färg|från-till|liga.kval.cup.superliga.mastarcup"`
  i `K.klubbhistorik` (högst 50 rader, 4 000 tecken – `HISTORIK_MONSTER`, samma uttryck i reglerna). Statistik
  listar de gamla klubbarna med märke, säsonger och pokaler.
- **Sparningen:** först kön av osparade matcher (den gamla klubbens matcher ska in före den nya), sedan EN
  skrivning av hela den nya karriären (`sparaKarriar`). Går den inte fram blir det ingen ny klubb – eleven kan
  prova igen (inget halvt läge). Kom svaret efter tidsgränsen (8 s) läses serverns karriär: gick skrivningen fram
  ändå gäller den nya klubben. Ett pågående träningsläger måste göras klart först.
- **En legendklubb på servern vinner** (`md-spara.js legender`): har serverns karriär en längre klubbhistorik än
  den lokala kön (en annan dator, eller en sparning som gick fram efter tidsgränsen) hör kön till den gamla klubben
  – den kastas (vid start i `hamtaKarriar`, och i `sparaKon` när en match nekas) och serverns nya klubb gäller.
  Annars hade kön skrivit tillbaka den gamla klubbens division och säsong över den nya (granskningen).

### 17.4 Pokalskåpet, klubbmärket och finalscenen (§10.1, §10.2, §10.4)

- **Fliken Pokalskåpet** (`md-vy-pokaler.js`): en tecknad pokal per sort (`md-pokal-svg.js`, SVG, inga bilder) –
  divisionsvinst, uppflyttning genom kval, Silverpokalen, Superligan, Mästarcupen – med antal och säsonger; en tom
  hylla har pokalens skugga och vad som krävs för den ("Vinn en division …"). Överst klubbmärket (guldkant + stjärnor) och, efter en vunnen
  Mästarcup, ett tips om legendklubben under Match. Kostar inga läsningar.
- **Sidhuvudet** visar klubbmärket (initialerna på en sköld i tröjfärgen) bredvid lagnamnet; märkets `aria-label` säger guldkanten och
  stjärnorna i ord.
- **Finalen** (`skapaPlan({ final: true })`): finalens intro "FINALEN" över planen (`finalIntro`), en fullsatt
  läktare med viftande flaggor (EN `InstancedMesh`, `md-tre-arena.js`), skyltar "FINALEN · MÄSTARCUPEN". 2D-reserven har flaggorna som SVG.
- **Firandet** (`plan.fest(pokal)`, §10.1–10.2): laget samlas vid mittcirkeln (`md-formation.js
  festUppstallning`), kaptenen lyfter pokalen (Superligans guldpokal eller Mästarcupens större silverpokal,
  `md-tre-fest.js`) och fyrverkerier (EN `Points`-mesh) i lugnt tempo, med en fanfar. **Lugnt läge:** inga
  fyrverkerier, inga uppsträckta armar, pokalen står stilla, fanfaren dämpad. 2D: pokalen och stjärnor som SVG.
- **Bilder per sekund** (huvudlös Chromium med SwiftShader, 1366 × 768, ingen GPU): finalen under match 20–27 fps
  (lägst 15), firandet 18–21 fps (lägst 12 efter starten), ~98 ritanrop – samma nivå som en vanlig match i samma
  miljö (Etapp 1–2). Specens ≥ 50 fps på skolans HP-datorer är inte uppmätt.

### 17.5 Balansen (§12)

`admin/md-balans-mastarcup.mjs` (i `npm run balans:matchdagen`, 400 försök per rad) och gränsen `MC_MAL` (testad i
`test/matchdagen-balans.test.js`): 80 % rätt med ett tränat lag (snitt 4★) vinner Mästarcupen **15–25 %** av
försöken ("ungefär var femte").

| Rätt | Laget | Ute i kvart | Ute i semi | Förlorad final | **Vunnen** | Vinst per runda | Straffar | Matcher/försök |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 % | 4★ | 38 % | 25 % | 16 % | **22 %** | 62 / 60 / 58 % | 28 % | 2,0 |
| 80 % | 5★ | 21 % | 14 % | 18 % | 47 % | 79 / 83 / 72 % | 25 % | 2,4 |
| 70 % | 4★ | 59 % | 24 % | 10 % | 7 % | 41 / 41 / 39 % | 29 % | 1,6 |
| 90 % | 4★ | 19 % | 16 % | 16 % | 49 % | 81 / 80 / 75 % | 23 % | 2,5 |
| 70 % | 5★ | 37 % | 20 % | 21 % | 22 % | 63 / 69 / 51 % | 26 % | 2,1 |

Superligan själv är oförändrad: 80 % rätt med 4★ vinner 47 % av matcherna (§12: 45–55 %).

### 17.6 Reglerna

- `mastarcup`: `null` eller `'[0-9]{1,5}-([0-3]|[1-3]-u)'` ("-u" bara efter en spelad runda), prövas bara när fältet ändras.
- `pokaler`: typerna `superliga` och `mastarcup` är tillagda i det enda uttrycket (`mdPokalerOk`).
- `klubb.legendStjarnor` (`mdKlubbOk(k, st)`): exakt `st` – 0 i en ny klubb, annars den sparade klubbens, och +1
  bara när `klubbhistorik` ändras. Stjärnorna kan alltså aldrig skrivas fritt.
- **Legendklubben** (`mdLegendOk`, bara när `klubbhistorik` ändras – `let L` i `validMatchdagen`): historiken
  växer med exakt en rad i rätt form (de gamla orörda, högst 50, 4 000 tecken), den sparade klubben har en
  `mastarcup`-pokal från den sparade säsongen, och den nya klubben har `div == 0`, `sasong == g.sasong + 1`,
  `kassa == 600`, `reserver == []` och `marknad == []` – **likheter i stället för** `mdHeltal`/`mdKassaOk`/
  `mdReserverOk`/`mdMarknadOk`, som hoppas över med `L`. Truppen **måste ändras** (annars prövas den inte alls – en
  elev kunde ha behållit sitt tränade lag, granskningen) och prövas som i en ny klubb (`mdNyTruppOk`: sju otränade
  grundpelare). Historiken växer med en rad **sist**: `h[0:gh.size()] == gh` (samma rader i samma ordning). Utan likheterna spräckte en legendklubb 1000-uttrycksgränsen (nekad – hittat av
  `test/firestore-rules-matchdagen-mastarcup.test.js`).
- Historiken kan inte strykas eller skrivas om (en ändrad lista måste växa med exakt en rad sist).
- **Inte prövat** (eget spel, inga pluggmynt): att mästartiteln, rundorna eller pokalerna stämmer med matcherna – en
  elev som skriver förbi appen kan ge sig själv en inbjudan, en `mastarcup`-pokal och därmed en legendklubb. En
  sådan elev som behåller klubben oförändrad får ingen stjärna.
- **Marginalen** mot 1000-gränsen: se §17.7.

### 17.7 Kvoten och marginalen (§13)

Inga nya läsningar, inga lyssnare. En match i Mästarcupen är en match (en batch = 2 skrivningar), 0–3 per säsong
(i snitt 2 med 80 % rätt). Legendklubben är EN skrivning (efter kön). Pokalskåpet och klubbhistoriken läses ur
karriären, som redan läses en gång när Matchdagen öppnas. Dokumentet växer med högst ~4 kB (historiken) och en
rad text för Mästarcupen.

**Marginalen** mot 1000-gränsen (extra `(d.div == d.div) &&` som ryms, mätt på de slutliga reglerna, upp till 60):
ny klubb 5, match 50, läger 30, lägrets start ≥ 60, köp 22, köp med fulla reserver 18, byte ≥ 60, resten av
säsongen i en skrivning 26, kvalet 22, hela säsongen + cupen + kvalet i en skrivning 12, cupmatch och cupfinal ≥ 60,
mästare 50, match och final i Mästarcupen ≥ 60, **legendklubben 12** (48 gamla klubbar: 10); läger + match i en
skrivning nekas fortfarande. Etapp 3 kostar 4–9 uttryck per skrivning. ⚠️ `h[0:0]` (en tom del av en lista)
spräckte gränsen – jämför bara när listan inte är tom. Mätningen: rapporten (Etapp 3).

## 18. Vänskapsmatcher i realtid (Etapp 4, #874, spec §11)

Två elever i samma klass som båda har Matchdagen spelar mot varandra med **sina egna lag** (namn, färg, lagbonus ur
truppen). Servern spelar matchen: klienterna väljer, svarar och visar animationerna. Ligan påverkas inte.

### 18.1 Flödet

1. **Lobbyn** (fliken **Vänskap**, `src/matchdagen/vanskap/md-vy-vanskap.js`): klasskompisarna med Matchdagen
   (`classes/{id}.elevModuler`, namnen ur `classProjections`), "Utmana", en inkommande utmaning med "Anta"/"Nej tack",
   "Ta tillbaka", pågående matcher i klassen, dagens betalda matcher och de inbördes mötena
   ("Blixtarna IF – FC Omar: 3–1–2", vinster–oavgjorda–förluster).
2. `mdUtmana({ classId, till })` → en utmaning i `mdLobby/{classId}` (en per utmanare – en ny ersätter den gamla).
   Den försvinner efter **2 minuter** (`VANSKAP.utmaning`). `mdSvara({ utmaningId, ja })`: den utmanade antar eller
   tackar nej; den som utmanade tar tillbaka med `ja: false`.
3. Antagen → matchen skapas (`mdVanskap/{matchId}`), båda elevernas `matchdagenInst` och valda områden läses EN gång
   och en **frågebank per elev** (36 frågor ur elevens egna källor, `functions/md-vanskap-fragor.js`) läggs i
   `facit/{uid}`. Den som utmanade är sidan `a` och gör avspark. Båda klienterna ser matchen i lobbyn och öppnar den.
4. **Varje läge** (`md-vanskap.js vLage`): anfallaren väljer kort pass, långt pass, dribbling eller skott (≤ 45 m),
   försvararen tackla eller täck – vid ett skott blir försvararens svar målvaktens räddning. `mdFraga({ matchId, val })`
   skriver frågan **utan facit** i elevens `privat/{uid}` och svarar med den; `mdSvar({ matchId, svar })` rättas på
   servern (Live:s rättning: `kistspel-rattning.js` för multiplikation och quiz, `rakna-core.js checkAnswer` för
   Räkna) och svarar `{ ratt, facit }`. När **båda** har svarat avgörs läget med motorn (`vSpela`: anfallarens och
   försvararens svar och lagbonus) och händelsen skrivs till matchdokumentet. Båda klienterna lyssnar (`onSnapshot`)
   och spelar animationen sett från sitt lag (`spegla`, `vy`).
5. **Tiden:** 60 s per läge (`VANSKAP.tid`) eller elevens klocka om den är kortare, + 6 s för animationen
   (`VANSKAP.anim`). Tar elevens klocka slut skickar klienten `svar: null` (fel). Har den andra inte svarat när serverns
   tid gått anropar klienterna `mdTick` – uteblivet svar = fel, inget val = standardvalet (kort pass / täck).
6. **Halvtid:** "Andra halvlek" (`mdTick({ redo: true })`); den andra halvleken börjar när båda är redo, senast efter
   60 s. Laget som inte började gör avspark. Inga straffar – oavgjort är tillåtet.
7. **Walkover:** den som inte gjort något på **3 minuter** (`VANSKAP.inaktiv`, räknat på elevens senaste
   `mdFraga`/`mdSvar`/redo) förlorar; "Lämna" (`mdGeUpp`) är en walkover direkt. Är båda borta lika länge blir matchen
   **avbruten** (inget resultat, ingen kassa). En match som ingen längre spelar avslutas när någon av eleverna utmanar
   eller antar nästa gång.
8. **Slutet** (`md-vanskap-spel.js avsluta`, EN transaktion): resultatet i matchdokumentet, båda elevernas spärr och
   dagsräkning (`mdVanskapElev`), kassan och de inbördes mötena (`FieldValue.increment` i `matchdagen/{uid}`) och
   matchen i båda elevernas `matcher/{matchId}` med `typ: "vanskap"`. Klubbkassan: **100 kr** för att spela och
   **100 kr** extra vid vinst, för högst **3 vänskapsmatcher per dag** (Stockholmsdygnet, `dagNyckel`); den som förlorar
   på walkover får ingenting. Fler matcher får spelas, utan pengar.

### 18.2 Motorn (`src/matchdagen/delat/md-vanskap.js`, ren)

Synkad till `functions/matchdagen/` med `admin/sync-matchdagen-functions.mjs` (`npm run sync:matchdagen`, predeploy för
functions, `--check` i testerna) tillsammans med frågekällornas rena kod (`functions/matchdagen/kallor/`). API:

`nyVanskap({ a, b, avspark })`, `vLage(V)`, `vSpela(V, { a: { val, ratt, kalla }, b }, rng) → { V, h }`, `vAndraHalvlek`,
`vWalkover(V, forlorare)`, `vResultat(V)`, `spegla(h, sida)` (händelsen för `md-plan.js spela`), `vy(V, sida)` (för
`plan.stall`), `fasSekunder(klocka)`, `inaktivUtfall({ a, b }, nu)`, `kassaFor(vann, betaldaIdag)`, `inbordesText(eget, mot, r)`.
Chanserna är solospelets (`chansPass`, `chansForsvar`, `chansSkott`, `chansRaddning`) med motståndarstyrkan 0 och lagens
egna bonusar; försvarets vikt `VANSKAP.forsvar` = 0,5 och räddningens `VANSKAP.raddning` = 0,55. En fråga per skott
(ingen finta från Division 3 i en vänskapsmatch).

**Balansen** (`admin/md-balans-vanskap.mjs`, i `npm run balans:matchdagen`, gränserna `VANSKAP_MAL` testade):

| Rätt a / b | Stjärnor a / b | Vinst a | Oavgj. | Vinst b | Mål/match | Lägen | Match (min) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 70 % / 70 % | 2 / 2 | 36 % | 31 % | 33 % | 2,21 | 29,1 | 7,3 |
| 70 % / 50 % | 2 / 2 | 52 % | 28 % | 19 % | 2,07 | 29,2 | 7,3 |
| 50 % / 50 % | 2 / 2 | 34 % | 33 % | 33 % | 1,86 | 29,1 | 7,3 |
| 90 % / 30 % | 2 / 2 | 87 % | 11 % | 2 % | 2,59 | 29,2 | 7,3 |
| 70 % / 70 % | 4 / 2 | 56 % | 27 % | 17 % | 2,39 | 29,1 | 7,3 |

### 18.3 Datamodellen (bara Cloud Functions skriver)

| Dokument | Innehåll | Läses av |
| --- | --- | --- |
| `mdLobby/{classId}` | `utmaningar { id: { fran, franNamn, franLag, till, sedan } }`, `matcher { id: { a, b, aNamn, bNamn, aLag, bLag, start } }` | klassens elever med Matchdagen (live), läraren med klassen |
| `mdVanskap/{matchId}` | `classId, a, b, spelare, namn, tid { a, b }, status` (`pagar`/`slut`/`avbruten`), `V` (motorns tillstånd), `h` (senaste händelsen), `fas { nr, start }`, `halvtid { start, redo }`, `resultat { vinnare, walkover, stallning, kassa }`, `skapad, uppdaterad` | de två spelarna (live), läraren |
| `mdVanskap/{id}/privat/{uid}` | elevens läge: `sida, fas, roll, val, fraga` (utan facit), `kalla, svar { ratt, facit, tidenUte? }, aktiv` | eleven själv, läraren – aldrig motståndaren |
| `mdVanskap/{id}/facit/{uid}` | frågebanken MED facit: `sida, bank [{ pub, kalla, r }]` | bara läraren |
| `mdVanskapElev/{uid}` | spärren och dagstaket: `aktiv` (matchId eller null), `dag`, `antal` | eleven själv, läraren |
| `matchdagen/{uid}.inbordes` | `{ [motståndarUid]: { v, o, f, namn } }` – motståndarlagets namn ≤ 24 tecken | som karriären |

Alla tider är serverns epoch-ms; klienten jämför mot `serverNow()` (`data-class-lock.js`). Frågan för läge `n` är
`bank[(n − 1) % 36]`. Elevens tid i läget: `fas.start + (tid[sida] + anim) s`.

### 18.4 Callables (`functions/md-vanskap-anrop.js`, europe-west1)

`mdUtmana`, `mdSvara`, `mdFraga`, `mdSvar`, `mdTick`, `mdGeUpp` – bara inloggade elever (lärare: `permission-denied`).
**Sedan #895 anropar klienten bara `mdVanskap({ op, ...data })`** med `op` = `utmana`/`svara`/`fraga`/`svar`/`tick`/`geUpp`/`varm`
(samma kärna – en Cloud Run-tjänst i stället för sex, §23); de sex namnen finns kvar för webben som redan är ute.
Grinden (`hamtaKlass`): eleven (och kompisen) står i klassens `studentIds`, har Matchdagen i `elevModuler`, inget aktivt
fokuslås, och båda har en klubb och minst en frågekälla. Bara en vänskapsmatch åt gången per elev
(`mdVanskapElev.aktiv`, läst i transaktionen – gäller över klasser, självläkande). EN transaktion per anrop.
Logiken: `md-vanskap-state.js` (det gemensamma), `md-vanskap-lobby.js`, `md-vanskap-spel.js`, `md-vanskap-fragor.js`.

### 18.5 Klienten

- `md-vanskap-moln.js`: callables och två lyssnare (`lyssnaLobby`, `lyssnaMatch`), `lasPrivat` (bara när eleven kommer
  tillbaka till en match), `lasElev` (dagens matcher). Skriver aldrig i duellsamlingarna.
- `md-vy-vanskap.js`: lobbyn och **vakten** (`bevaka`): EN lyssnare per match, kvar över flikbyten. När matchen slutar
  räknas kassan och de inbördes mötena in i `S.K` precis som servern skrev dem – annars skulle appens nästa sparning
  (karriären, `sparaMatch`/`sparaTrupp`) skriva över serverns kassa. Pågår en match när Matchdagen öppnas
  (`mdVanskapElev.aktiv`) startar vakten direkt. Före en utmaning eller ett ja sparas kön (en osparad match offline
  skulle annars skriva över kassan efteråt).
- `md-vanskap-spel.js`: matchvyn – samma skylt, plan, kommentar och frågekort som solospelet (`md-match-spel.js layout`),
  frågekortet `md-svar.js` med serverns rättning (ett Promise: kortet väntar, inga dubbelklick, ett nätfel → "försök
  igen"). Bilden till en Räkna-fråga (klockan, figurer) ritas i klienten ur problemet (`matte-visuals.js`).
- `page-matchdagen.js` hittar elevens klass med Matchdagen i `getClasses()` (klasslistans cache) och skickar
  `vanskap: { classId, kompisar(), moln() }`; utan klass finns ingen Vänskap-flik.
- Lärarens statistik: vänskapsmatcherna märks "(vänskapsmatch)" i matchlistan och de inbördes mötena står i elevpanelen.

### 18.6 Reglerna

Klienten skriver ingenting i `mdLobby`, `mdVanskap` (med `privat` och `facit`) och `mdVanskapElev`. Läsning:
lobbyn – läraren med klassen (`hasClass`) och klassens elever som har Matchdagen (`mdHarMatchdagen`: en `get` av
klassen); matchen – spelarna och läraren (ett saknat dokument får varje inloggad hämta, som `schackPartier`);
`privat/{uid}` – eleven själv och läraren; `facit` – bara läraren; `mdVanskapElev/{uid}` – eleven själv och läraren.
I `matchdagen/{uid}` får `inbordes` finnas (`hasOnly`), men en skrivning från klienten får inte ändra det:
`!('inbordes' in a)` – ett enda billigt uttryck. Appen skickar fältet oförändrat när hela dokumentet skrivs
(`sparaKarriar`, nytt namn, legendklubb) och utelämnar det i matchsparningen (`mergeFields`).
**Marginalen** mot 1000-gränsen: inbördes kostar en enhet i varje skrivning – ny klubb 4 (var 5), köp 21, köp med
fulla reserver 17, hela säsongen + cupen + kvalet 11, legendklubben 12 (48 gamla: 10), kvalet 24; oförändrat med möten
i dokumentet. Mätningen: rapporten (Etapp 4).

### 18.7 Kvoten (§13) – en vänskapsmatch

Räknat för en match med ~29 lägen (balansen) där båda svarar i varje läge:

| | Antal |
| --- | --- |
| Callables | 2 (utmana, svara) + 2 × 2 per läge (fråga + svar per elev) ≈ **118**, + 2 vid halvtid; `mdTick` bara när någons tid går ut; + 1 `varm` per öppnad lobby (#895). Alla går till `mdVanskap` |
| Skrivningar (servern) | utmaning 1, start 6 (match, 2 facit, 2 spärrar, lobbyn), per läge ~5 (2 privata vid valet, 2 vid svaret, matchen), slutet 8 ≈ **160** |
| Läsningar (servern, i transaktionerna) | start ~15 (klass, karriärer, inställningar, områden), per läge ~14, slutet 5 ≈ **430** |
| Lyssnare | lobbyn (1 per elev, bara medan fliken är öppen) och matchen (1 per elev) – ~31 uppdateringar per elev |
| Klientens egna läsningar | `mdVanskapElev` 1–2, `classProjections` 1, `privat` 0–1 (bara när eleven kommer tillbaka) |

Solospelet är oförändrat (inga lyssnare, karriären läses en gång) – utom EN läsning av `mdVanskapElev/{uid}` när
Matchdagen öppnas för en elev i en klass (vakten för en pågående vänskapsmatch).

## 19. Hela klassen (#876)

Matchdagen kan slås på för **hela klassen** utöver enskilda elever. Spelet är oförändrat.

### 19.1 Åtkomsten

- Matchdagen står i `TOGGLABLE_MODULES` (Vad eleverna ser, "av som standard") och får ligga i
  `classes/{id}.enabledModules`. Eleven ser den om klassen har den påslagen **eller** eleven står i
  `elevModuler` (`modulesHiddenForStudent`; `md-inst.js harMatchdagen`, servern `md-vanskap-state.js
  harMatchdagen`). Fokusläget och låset fungerar som förut (`learning`, inget låsmål).
- Samma av/på finns i panelen **Hela klassen** överst i Elever → Anpassningar per elev (skriver
  `enabledModules` + klassens inställningar i en skrivning, `sparaKlass`).
- **Välj alla:** en kryssruta per elev, "Välj alla"/"Avmarkera alla" och "Slå på/av för valda" – EN skrivning
  av `elevModuler` (`sparaElevModuler`). Elever som slås på så får inga egna inställningar (de följer klassen).

### 19.2 Inställningarna (`effektivInst`)

`classes/{id}.matchdagenInst` har samma form som `matchdagenInst/{uid}` (§2, med `updatedAt`/`updatedBy`).
Eleven spelar med:

1. sina **egna** (`matchdagenInst/{uid}` finns) – gäller alltid före klassens;
2. annars **klassens** – från den första av elevens klasser där eleven har Matchdagen och som har inställningar
   (annars den första med inställningar);
3. annars **standard** (`STANDARD_FRAGOR`): multiplikationstabellerna 0–10, flerval, ingen klocka, paus 60 min.

Klienten (`page-matchdagen.js`) och servern (`functions/md-vanskap-fragor.js effektivInst`, vänskapsmatchen –
den använder matchens klass) räknar likadant. Gick elevens egna inte att läsa används inget av det (meddelandet
"Inställningarna kunde inte läsas" som förut).

Lärarens panel för en elev **utan** egna visar klassens (eller standard) och säger det. Sparar läraren utan att
ändra något skrivs bara på/av; ändrar läraren något får eleven egna. En elev **med** egna har knappen "Följ
klassens inställningar" (raderar `matchdagenInst/{uid}`).

### 19.3 Reglerna

- `validEnabledModules` nekar inte längre `matchdagen`.
- `validKlassMatchdagenInst`: en **ändrad** `matchdagenInst` på klassen är en map som klarar `validMatchdagenInst`
  (serverns tid, egen uid). En oförändrad map stoppar inte andra klass-skrivningar; fältet får tas bort.
  `matchdagenInst` står i årskurskontots tillåtna klassfält.
- `mdHarMatchdagen` (vänskapslobbyn): `enabledModules` **eller** `elevModuler`.
- Tester: `test/firestore-rules-matchdagen-klass.test.js` (+ `-inst`), rena: `test/matchdagen-klass.test.js`.

### 19.4 Kvoten per extra spelare

Klassens inställningar ligger på klassdokumentet som eleven och läraren redan läser – **0 nya läsningar**. En elev
utan egna sparar en läsning ändå (`matchdagenInst/{uid}` läses och saknas – det räknas som en läsning).

Varje elev som får Matchdagen genom klassen kostar som en elev per elev (§11, §15.5, §17.7):

| Per extra spelare | Läsningar | Skrivningar |
| --- | --- | --- |
| En timmes spel (~6–7 matcher, läger, köp) | ≈ 8 + 1 (`mdVanskapElev`) | ≈ 26 |
| Lärarens Hur går det? → Matchdagen | 1 (`matchdagen/{uid}`) | 0 |
| En vänskapsmatch (två spelare, servern) | ≈ 215 per spelare | ≈ 80 per spelare |

**Exempel:** en klass med 25 elever som spelar en lektion (1 h) solo ≈ 225 läsningar och ≈ 650 skrivningar; med
en vänskapsmatch per elev dessutom ≈ 5 400 läsningar och ≈ 2 000 skrivningar. Gratiskvoten (50 000 läsningar och
20 000 skrivningar per dag) räcker alltså för ~30 klasslektioner solo per dag, men vänskapsmatcherna är det dyra –
några klasser per dag. Inga lyssnare i solospelet.

### 19.5 Deploy

**`firebase deploy --only firestore:rules` före webben och functions** (`enabledModules` med `matchdagen` och
`matchdagenInst` på klassen nekas av de gamla reglerna – lärarens Spara misslyckas då), därefter
Matchdagens functions (`mdUtmana`, `mdSvara`, `mdFraga`, `mdSvar`, `mdTick`, `mdGeUpp` – grinden och klassens
inställningar i vänskapsmatchen; utan dem nekas en elev som bara har Matchdagen via klassen "Matchdagen är inte påslaget för
dig"), sist webben. Inga index, ingen datamigrering.

### 19.6 Hotfix (#878): versionsglapp, klassens frågor i Vad eleverna ser och helskärm

- **"Matchdagen kunde inte laddas" direkt efter deployen** gick inte att återskapa i emulatorn (alla fall: klassen,
  per elev, egna, utan inställningar). Felet kom fyra minuter efter deployen av #876: Pages-filerna har
  `max-age=600`, och en flik som varit öppen håller sina moduler i modulkartan – en **gammal** `md-inst.js` (utan
  `effektivInst`) bredvid den nya `page-matchdagen.js` gav `TypeError: effektivInst is not a function`.
  `page-matchdagen.js` startar nu ändå (de egna inställningarna; utan egna "Pluggporten uppdaterades nyss…").
  `dynSida` i `app.js` känner igen versionsglapp (`versionsGlapp`: SyntaxError vid länkningen, "is not a function",
  en modul som inte gick att hämta) och visar "Pluggporten uppdaterades nyss" med **Ladda om** för alla lata elevsidor.
- **Klassens frågor syns där Matchdagen slås på:** Vad eleverna ser → modullistan har knappen
  **Matchdagen: välj frågor för hela klassen** – samma panel som Hela klassen i Anpassningar per elev
  (`renderPanel` med `elev = null`, lat). Panelens på/av och kryssrutan i listan speglar varandra.
- **Helskärm i elevens vy:** knappen **Helskärm** före flikarna (`md-helskarm.js`, monteras i `md-app.js`). Med
  Fullscreen-API:t (dator, Chromebook, iPad; `src/helskarm.js`) visas hela appen i helskärm. Utan API:t (Safari på
  iPhone) blir det en reserv: sidomenyn, hamburgaren och överlägget döljs (`html.md-helskarm-sida`) och appen fyller
  fönstret (`.md-helskarm-reserv`, `position: fixed`). Esc eller knappen lämnar; att lämna sidan också. Planens höjd
  räknas om vid bytet (resize). CSS: `49-matchdagen-match.css`.
- **Fler spelarnamn:** `md-namn.js` har 120 förnamn och 100 efternamn (≈ 12 000 kombinationer, förut 1 152), bara
  bokstäver, inga dubbletter, de gamla först. Namnen sparas i karriären när de lottas – längre listor rör inga sparade
  trupper eller marknader. Serverns kopia via `npm run sync:matchdagen`. Test: `test/matchdagen-namn-878.test.js`.
- Inga ändringar i reglerna; functions bara via den synkade `md-namn.js`. Test: `test/matchdagen-sida-878.test.js` (sidan med stubbar, även
  med en "gammal" `md-inst.js`) och `test/matchdagen-helskarm-878.test.js`.

## 20. Mattematchen räknas in (#879)

Pågår en **Mattematch** för elevens klass räknas Matchdagens **multiplikationssvar** (tabellkällan `tabell:N`,
faktorer 0–10 = `multiplication_0_10`) i Mattematchen – exakt som ett svar på MM-sidan och som Live (#847):
rätt = +1 i `scores`, `studentStats` (`correct` + `c{t}`) och en shard i `classCounters`; fel = `incorrect` + `w{t}`.
**Inga mynt** – varken MM-mynt eller pluggmynt; Matchdagens klubbkassa är oförändrad. Plugga- och Räkna-frågor
räknas inte, inte heller en fråga där tiden tog slut (inget svar). Utan aktiv match (eller utanför perioden, pausad
tävling, klassen inte med) händer ingenting. Spelkänslan är oförändrad – skrivningen väntas aldrig in.

### 20.1 Solospelet (klienten)

- Alla solofrågor (match, straffar, träningslägret) rättas i frågeströmmens `ratta` (`vy/md-strom.js`). Den skickar
  varje **giltigt** tabellsvar till `S.data.mmRaknaIn` (`md-data.js`, laddar `src/tavling/mm-live.js` först då);
  förhandsvisningens stubbe saknar funktionen → ingenting skickas.
- `md-mm.js mmSvar(fraga, svar)` gör svaret till Live-lägets `answerRecord` `{ factorA, factorB, answer,
  correctAnswer }` + `isCorrect` (samma rättning som spelet), annars `null`.
- `mm-live.js mmRaknaIn`: aktiv match ur elevens bevakare (`mm-watch.js`, sidomenyn – inga läsningar), sedan
  `planLiveMmWrites` med ett nytt `attemptId` och ankaret `mathCompetitions/{cid}/liveAnswers/{attemptId}`, i EN batch.
- **Reglerna är oförändrade** – #847:s `liveAnswers`-regler godtar MM-delen ensam: aktiv tävling, perioden mot
  `request.time`, klassen deltar, facit räknas om, räknarna exakt +1 i samma batch. Eleven kan alltså inte ge sig
  själv mer än MM-sidan redan tillåter (där kan hen ändå svara på vilken tabellfråga som helst). Ankaret kan bara
  skapas → ett omförsök räknas aldrig två gånger. `mmMyntOk` betalar bara mot `answers` → aldrig mynt.
- Offline: batchen köas av Firestore och prövas av reglerna när den når servern (är perioden slut nekas den).

### 20.2 Vänskapsmatchen (servern)

`functions/md-vanskap-spel.js svar`: ett besvarat multiplikationsläge (bankens `r.s === "mult"`, inte tiden ute)
anropar `mmForLive` (cachad, `functions/mattematchen-live.js`) och `mmLiveWrites` i **svarets transaktion**, efter
lägets avgörande (läsningarna först). Svaret sparas i elevens privata dokument i samma transaktion och ett omförsök
svarar ur det utan att skriva → aldrig dubbelt. Klassen = matchens klass, namnet = matchens namn för eleven,
`lastAttemptId` = `md_{matchId}_{sida}{läge}`. Känd gräns: matchen räknas bara i en Mattematch där
**matchens** klass deltar – går eleven i två klasser och tävlingen gäller den andra räknas vänskapssvaren inte
(solospelet tar bevakarens klass). Namnet i `scores` är klassens projektionsnamn (`namnFor`); reglerna godtar
ändå MM-sidans `students/{uid}.namn` vid nästa svar där.

### 20.3 Kvoten

| Väg | Läsningar | Skrivningar |
| --- | --- | --- |
| Solo, per tabellsvar | 0 i klienten (bevakaren finns redan); reglerna läser tävlingen, elevens namn och ankaret | rätt 4 (ankare, `studentStats`, `scores`, `classCounters`), fel 2 |
| Vänskap, per tabellsvar | 0 per svar; aktiva matcher 1 fråga per instans och minut | rätt 3, fel 1 – i svarets transaktion |

Svar utan aktiv match kostar ingenting. **Exempel:** en solomatch har ~28 frågor; med bara tabellerna (standard,
`STANDARD_FRAGOR`) och ~80 % rätt ≈ 100 skrivningar per match. En klass med 25 elever som spelar en lektion (~6–7
matcher) under en aktiv Mattematch ≈ **17 000 skrivningar** – lika mycket som om de svarat lika många gånger på
MM-sidan, men nära gratiskvotens 20 000 per dag. Blandas källorna (Plugga, Räkna) blir det färre.

Tester: `test/matchdagen-mm-879.test.js` (rena), `test/firestore-rules-matchdagen-mm-879.test.js`,
`test/functions-matchdagen-mm-879.test.mjs`.

### 20.4 Deploy

**functions först** (`mdSvar` – vänskapsmatchen räknas in), sedan webben. Inga regler, inga index.

## 21. Topplistan per årskurs (#880)

Fliken **Topplista** i elevens app visar de **5 bästa lagen i elevens årskurs på hela skolan** – och knappar för
de andra årskurserna (Åk 3, Åk 4, Åk 6 … Övriga sist). Varje rad: plats, elevens namn (som på de andra listorna:
klassprojektionens namn, reserv `students/{uid}.namn`), lagets namn och tröjfärg, klassen, **bästa division**,
**vinster** och **mål** (gjorda–insläppta). Den egna raden är markerad ("(du)"). Fliken finns även innan klubben är
skapad. Ingen lärarvy än (önskemålet i issuen – inte gjort).

### 21.1 Rangordningen (`delat/md-topplista.js`, ren)

1. **Bästa division** som klubben nått (den nuvarande, säsongshistoriken `sasonger[].div`; en legendklubb = Superligan),
2. **legendstjärnor** (`klubb.legendStjarnor`, klubbar tagna hela vägen, §17.3),
3. **vinster totalt** (`summa.v`),
4. **målskillnad totalt** (`summa.gjorda − summa.inslappta`).

Lika på alla fyra = **delad plats** (1, 2, 2, 4), inom platsen i namnordning. Listan har platserna 1–5; en delad
femteplats tas med (högst 8 rader). Varför totalt och inte "den här säsongen": säsongerna är olika långa i olika
divisioner och nollställs i olika takt – totalen är enkel att förstå och belönar den som spelar och vinner. Divisionen
först gör att den som tagit sig högst alltid leder.

**Årskursen** härleds ur klassnamnet precis som Mattematchens årskursfilter (#845, `arskursAvKlass`: "4B" → 4,
"Fritids" → Övriga). Bara klasser där eleven **har Matchdagen** räknas (hela klassen `enabledModules` eller
`elevModuler`, `harMatchdagen`); går eleven i flera sådana gäller den **lägsta** årskursen (en siffra före Övriga).
En elev utan Matchdagen syns aldrig, inte heller en karriär utan klubb eller utan spelade matcher.

**Placeringspolicyn** (som Guldrushen): bara topp 5 med namn står i dokumentet. Elevens egen placering utanför
topp 5 räknas aldrig ut och visas aldrig – i den egna årskursen står "Du är inte på topp 5 än – fortsätt kämpa!".
Är elevens egen karriär (redan läst, `S.K`) minst lika bra som listans sista rad – en delad plats som inte fick
plats bland de 8 raderna, eller bättre sedan bygget – står i stället "Ditt lag är lika bra som de bästa – listan
uppdateras varje timme" (`paVagIn`, bara ja/nej, ingen placering).

### 21.2 Rimlighetskontrollen (`rimligKarriar`)

Karriären skrivs av eleven själv; reglerna prövar formen men inte att talen hänger ihop. En karriär som inte är
rimlig **kommer inte med på listan** (servern loggar antalet, eleven märker inget):

- summans tal är heltal ≥ 0, vunna + oavgjorda + förlorade = matcher, rätt ≤ frågor, frågor ≥ matcher,
  mål (gjorda och insläppta) ≤ 20 per match;
- **inga omöjliga hopp:** varje uppflyttning kräver en hel säsong och ett kval, så Division *d* kräver minst
  `minMatcherTill(d)` = Σ `LAGANTAL[k]` (k < d) matcher (Superligan: 60) – plus 60 per legendstjärna – och
  `sasong` ≥ antalet uppflyttningar (division + 7 per legendstjärna); bästa division i historiken prövas likadant;
- `div` 0–7, legendstjärnor ≤ 50, högst 120 matcher en dag i `dagar` och dagarnas matcher ≤ alla matcher.

Testat mot en riktig karriär genom två kval (precis efter kvalet står `div` på nästa division i samma säsong).
Den som skriver förbi appen kan fortfarande hitta på *rimliga* tal (till exempel fler vinster) – kontrollen tar bort
det omöjliga, inte allt fusk. Matchdagen ger inga pluggmynt, så insatsen är en plats på listan.

### 21.3 Servern (`functions/md-topplista-bygg.js`) och datamodellen

`mdTopplista` (onSchedule, `every 60 minutes`, Europe/Stockholm, europe-west1, en instans) bygger
`mdTopplista/skolan` = `{ version: 1, byggd, arskurser: { "3": [rad…], "ovriga": [...] }, antal: { "3": n } }`,
rad = `{ uid, n, lag, f, k, d, ls, v, gm, im, m, plats }`. Alla årskurser i **ett** dokument – byta årskurs kostar
ingen läsning. Bygget:

1. läser topplistan och frågar `matchdagen where senast > byggd limit 1` (bara id), och läser lagnamnen för lagen
   på listan (fältmask `klubb.namn` – lärarens Återställ lagnamn skriver bara namnet, inte `senast`, som är lärarens
   "senast spelat"). Ingen karriär sparad, inget namn ändrat, och bygget är yngre än 6 timmar → klart, ingen skrivning;
2. annars alla `classes`, `classProjections` för klasserna med Matchdagen och karriärerna för eleverna med Matchdagen
   (`getAll` med fältmask: `klubb`, `div`, `sasong`, `summa`, `sasonger`, `dagar`), `students/{uid}` bara för den som
   saknar namn i projektionen → **en** skrivning. Var 6:e timme byggs listan om ändå: elevnamn, klassnamn och
   Matchdagen på/av ändrar inga karriärer – **känd gräns:** slår läraren av Matchdagen syns eleven på listan i
   högst 6 timmar till.

Reglerna: `mdTopplista/{docId}` läses av varje inloggad (som `hittaRattBoards` – namn, lag och klass för topp 5) och
skrivs aldrig av någon klient (`test/firestore-rules-matchdagen-topplista.test.js`). Servern:
`test/functions-matchdagen-topplista.test.mjs`; det rena: `test/matchdagen-topplista.test.js`.
Förhandsvisning: `preview/preview-matchdagen.html?vy=topplista` (`&ak=3|4|6|ovriga`, `&topp=utanfor|tom`).

### 21.4 Kvoten

| Vem | Läsningar | Skrivningar |
| --- | --- | --- |
| Eleven öppnar Topplista | **1** (första gången i besöket; byta årskurs och flik 0) | 0 |
| Servern, en timme utan sparade matcher | 2 (topplistan + frågan, som kostar 1 läsning även tom) + en per rad på listan (lagnamnen, ~5 per årskurs) | 0 |
| Servern, ett bygge | 2 + klasserna + projektionerna + eleverna med Matchdagen (+ elever utan namn) | 1 |

**Exempel:** 40 klasser, 10 med Matchdagen, 250 elever med Matchdagen → ~300 läsningar per bygge. Spel varje timme
8–17 (10 byggen) + ett par tvingade → ~3 600 läsningar och ≤ 24 skrivningar per dag; nätter och helger ~2 + 30
läsningar i timmen (sex årskurser à 5 rader) ≈ 800 per dygn. 250 elever som öppnar Topplista en gång om dagen = 250 läsningar. Cloud Scheduler: ett jobb (gratis upp till 3
per konto), ~720 körningar i månaden.

### 21.5 Deploy

**Reglerna först** (`mdTopplista` – utan dem nekas elevens läsning och fliken säger "kunde inte hämtas"), sedan
**functions** (`firebase deploy --only functions:mdTopplista` – skapar Cloud Scheduler-jobbet, Blaze; predeploy kör
`sync:matchdagen`), sedan webben. Inga index (frågan på `senast` använder det automatiska enfältsindexet). Innan första
bygget (upp till en timme) visar fliken "Topplistan byggs en gång i timmen".

## 22. Svårare stjärnor och tre träningsläger (#883)

Att uppgradera spelare ska vara **svårt, särskilt på toppen** – och mer träning betyder fler frågor.

### 22.1 Reglerna i spelet (`md-config.js TRANING`, `md-trupp.js`, `md-sasong.js nyTrupp`)

- **En ny karriär börjar på 1★** (de sju grundpelarna i `nyTrupp`, också en ny legendklubb). Lagbonusen
  `(snitt − 2) × 0,05` ger startlaget −5 % per lagdel tills det är tränat.
- **Poängen per stjärna ökar:** `xpTillStjarna: { 2: 50, 3: 100, 4: 250, 5: 500 }` (nyckeln = stjärnan man når;
  100/250/500 är Elias tal, 50 för 1★ → 2★ valde assistenten). `xpTill(st)` är kostnaden till nästa stjärna och
  `traningsVarde(p)` stjärnorna + poängen som ett tal (0, 50, 150, 400, 900 + xp) – samma tal som reglerna
  jämför och som köpet använder för "den sämsta på positionen". Från 1★ till 5★: 900 poäng = 75 rätt svar
  (2★ efter 5, 3★ efter 13, 4★ efter 34). Resten följer med (`xp −= kostnaden`), vid 5★ nollas poängen.
- **Upp till tre läger mellan två ligamatcher** (`TRANING.perOmgang`): nyckeln `"säsong-omgång-nummer"`
  (`lagerNyckel`, `lagerNummer`, `lagerKvar`), varje läger 8 frågor. Nästa ligamatch nollar räknaren; en
  cupmatch gör det inte (som förut). Det extra lägret före kvalet finns inte längre – omgångens tre räcker – och
  när kvalet är spelat är säsongens läger slut. Efter det tredje visar Truppen "Laget har tränat i alla 3
  träningsläger …" och en **avstängd** "Starta träningen".
- **Marknaden** lottar från 1★: `kl(avrunda(slump(1; 3,2 + div × 0,3)); 1; 5)` (Division 6: 1★–3★). En 1★ kan
  aldrig köpas in i ett 1★-lag (bara bättre spelare går att köpa), så den fyller bara ut marknaden.
- **Appen:** "Träningsläger 2/3" över lägret och i frågorna, stapeln **"143 / 250 till ★★★★"** på spelarkorten
  (`traningsStapel`, `aria-valuemax` = kostnaden), "x/250" i spelarvalet, "Nästa träningsläger (Träningsläger
  3/3)" efter ett klart läger, och Match-fliken säger "Ni har 2 träningsläger lediga".
- **Förhandsvisningen:** `?gammal=1` – en karriär från före #883 (2★-grundpelare, 0–99 poäng, lägret `"1-N"`).

### 22.2 Äldre karriärer (ingen migrering)

En karriär från före #883 behåller sina spelare – **ingen nedgradering, ingen migrering**:

- 2★–4★ med 0–99 poäng ligger alltid under det nya taket (100/250/500), så poängen är fortfarande giltig
  träning mot nästa stjärna (en 2★ med 99 poäng får 3★ efter ett rätt svar, en 3★ med 60 poäng har 60/250).
- Lägret i gamla formen gäller: `"säsong-omgång"` = det första lägret i omgången (två till är lediga),
  `"säsong-omgång-p"` fortsätter med samma nyckel (de lokalt sparade svaren hör till den), `"säsong-k"` = slut
  för säsongen och `"säsong-k-p"` fortsätter.
- Reglerna godtar en ny klubb med 2★ (en flik med den gamla appen öppen). Testat: `test/matchdagen-trupp.test.js`
  ("en äldre spelare …", "äldre nycklar …") och `test/firestore-rules-matchdagen-traning-883.test.js`
  ("en äldre karriär …").
- **Versionsglapp:** en flik med den **gamla** appen (≤ 10 min efter deployen) räknar 100 poäng per stjärna. Tränar
  den en 1★ förbi 49 poäng, eller en 3★/4★ över en stjärna, nekar de nya reglerna sparningen. Svaren ligger kvar lokalt
  ("Spara träningen"); efter en omladdning räknar den nya appen om samma svar med de nya kostnaderna och sparar.

### 22.3 Balansen (`npm run balans:matchdagen`)

**Division 6 = nybörjaren:** raderna med §12-målen spelas nu av en ny klubb per säsong (1★-laget, `KASSA.start`)
som tränar den sämsta spelaren i alla tre lägren efter varje ligamatch och köper den största förbättringen den
har råd med (`md-balans-trupp.mjs nyborjare`, `korBalans({ klubb })`). Med den gamla motståndarstyrkan vann
nybörjaren för sällan (70 % rätt: 56 % i första säsongen mot 64 % förut), så **Division 6 är svagare**:
`STYRKA.avdrag = [0,08]` och golvet `STYRKA.min` 0,12 → 0,06 (Division 6: 0,12 ± 0,05 i stället för 0,20 ± 0,05).
Högre divisioner har inget avdrag (Superligan och Mästarcupen oförändrade). Gäller nya ligor – en sparad liga
behåller sina styrkor.

| Division 6, nybörjaren (1 000 säsonger) | Vinst | Oavgj. | Ligan | ≥1 eget mål | Förlust ≥4 | Mål/match | Säsong (min) | Mål |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 70 % | **63 %** | 23 % | 60 % | 86 % | 0 % | 2,50 | 69 | ja |
| 50 % | **33 %** | 30 % | 11 % | 71 % | 0 % | 2,29 | 66 | ja |
| 30 % | 11 % | 21 % | 1 % | **49 %** | 3 % | 2,37 | 65 | ja |

Förut (otränat 2★-lag, gamla styrkan): 61 % / 34 % / 12 %, ≥1 eget mål 53 % på 30 %. Samma säsonger med ett
otränat 2★-lag mot den nya styrkan: 69 % / 41 % / 17 % (redovisas, inga mål). **Målen ändrade:** säsongen
55–75 min (förut 45–60 – tre läger per omgång är ~18 min träning, förut ett), och 30 % rätt gör minst ett mål i
≥ 45 % av matcherna (förut 50 %: 1★-laget gör mål i 49 %; efter de första lägren som förut).

**Nybörjarens första säsonger** (400 klubbar, med Silverpokalen; vinst · lagets snitt efter säsongen):

| Rätt | Säsong 1 förut → nu | Säsong 2 förut → nu |
| --- | --- | --- |
| 80 % | 77 % · 2,5★ → 78 % · 3,0★ | 87 % → 92 % |
| 70 % | 65 % · 2,3★ → **64 %** · 2,7★ | 74 % → 85 % |
| 60 % | 49 % · 2,2★ → 47 % · 2,3★ | 56 % → 70 % |
| 50 % | 36 % · 2,2★ → 34 % · 2,1★ | 36 % → 53 % |
| 30 % | 13 % · 2,1★ → 11 % · 1,9★ | 14 % → 18 % |

Första säsongen är som förut. Den andra blir lättare: 1★ → 3★ är billigt (150 poäng, ~2 läger per spelare med
70 % rätt) och tre läger per omgång ger tre gånger så mycket träning, så laget har 3★ efter en säsong – men
Division 6:s marknad ger högst 3★ och 3★ → 4★ kostar 250. Den som stannar i Division 6 vinner alltså oftare
andra säsongen än förut.

**Karriären med truppen** (100 robotklubbar × 30 säsonger, 1★, alla tre lägren; andel · median säsonger ·
speltimmar · lagets snitt · vinst där). Förut (2★, ett läger, §15.2) inom parentes:

| Rätt | Division 6 vinst | Division 3 | Division 1 | Superligan |
| --- | --- | --- | --- | --- |
| 80 % | 81 % (78 %) | 100 % · 3 · 5,7 h · 4,0★ · 81 % (3 · 3,2 h · 4,1★) | 100 % · 6 · 12,0 h · 5,0★ (6 · 6,8 h) | 100 % · 8 · 19,3 h (8 · 11,3 h) |
| 70 % | 73 % (66 %) | 100 % · 4 · 7,0 h · 4,0★ · 69 % (4 · 4,1 h · 4,4★) | 100 % · 7 · 14,8 h · 5,0★ (7 · 8,5 h) | 100 % · 12 · 28,3 h (12 · 17,1 h) |
| 60 % | 63 % (59 %) | 100 % · 6 · 10,1 h · 4,0★ · 57 % (6 · 6,0 h · 5,0★) | 100 % · 12 · 22,6 h · 5,0★ (12 · 13,7 h) | 44 % · 25 · 57 h (44 % · 25 · 34,8 h) |
| 50 % | 54 % (49 %) | 100 % · 9 · 14,5 h · 5,0★ · 43 % (10 · 8,6 h · 5,0★) | 43 % · 20 · 36,7 h (40 % · 21 · 23,3 h) | – |

Samma säsonger till toppen, men **~65–70 % fler speltimmar** – det är frågorna i lägren (en säsong i Division 6 tar
69 min i stället för 51). Laget når 5★ först kring Division 2 (förut Division 3–2), och i Division 3 vinner 70 %
rätt 69 % i stället för 78 % – mellandivisionerna är tuffare, men fortfarande rättvisa. Ekonomin (§15.2) och
Superligan-målet (4★, 47 %) är oförändrade.

**Marknadens priser (#890, Elias godkände förslaget):** förut `150 × st^1,9` = 150/560/1 210/2 090/3 190 kr – med
de dyra stjärnorna på toppen blev köpet relativt billigt (en 5★ för 3 190 kr sparar 900 träningspoäng, ~13 läger
med 70 % rätt). Nu en tabell (`MARKNAD.pris`, `md-trupp.js pris`, reglernas `mdPris`):

| Stjärnor | 1★ | 2★ | 3★ | 4★ | 5★ |
| --- | --- | --- | --- | --- | --- |
| Pris | 150 | 560 | 1 210 | **3 150** (2 090) | **5 200** (3 190) |
| Säljs för (halva) | 75 | 280 | 605 | 1 575 | 2 600 |

1★–3★ är oförändrade, så §12-ekonomin håller: en 3★ efter i snitt 2,96 matcher med 60 % rätt (`npm run
balans:matchdagen`, 1 000 elever per rad: 50 % 3,41 · 60 % 2,96 · 70 % 2,64 – samma som förut). En 1★ till
salu går aldrig att köpa in (laget har redan 1★).

**Karriären med truppen** efter #890 (samma körning, 100 robotklubbar × 30 säsonger; andel · median säsonger ·
speltimmar · lagets snitt · vinst där):

| Rätt | Division 3 | Division 1 | Superligan |
| --- | --- | --- | --- |
| 80 % | 100 % · 3 · 5,7 h · 4,0★ · 81 % | 100 % · 6 · 11,9 h · 5,0★ · 81 % | 100 % · 8 · 19,3 h |
| 70 % | 100 % · 4 · 7,0 h · 4,0★ · 69 % | 100 % · 7 · 14,8 h · 5,0★ · 64 % | 100 % · 12 · 28,5 h |
| 60 % | 100 % · 6 · 10,1 h · 4,0★ · 57 % | 100 % · 12 · 22,6 h · 5,0★ · 48 % | 44 % · 25 · 57,0 h |
| 50 % | 100 % · 9 · 14,5 h · 5,0★ · 43 % | 43 % · 20 · 36,7 h · 5,0★ · 29 % | – |

Samma som tabellen ovan (±0,2 h): robotklubben tränar i alla tre lägren och når 4★–5★ genom träningen innan
kassan räcker till en 4★/5★ på marknaden, så de dyrare toppspelarna ändrar inte karriären – de gör bara att
pengar inte är en genväg förbi träningen. Superligan-målet (4★, 47 %) och Mästarcupen påverkas inte (inga köp i
de körningarna).

**Sparade marknader:** raden `"id|namn|pos|nr|st"` har inget pris, så en marknad sparad före #890 kostar det nya
priset i appen, och reglerna nekar ett köp till det gamla (`test/firestore-rules-matchdagen-pris-890.test.js`).
Spelare som redan köpts behåller sina stjärnor; säljs de senare får eleven halva det **nya** priset (en köpt 5★
från förr ger 2 600 i stället för 1 595).

**Kassatillägget vid ett köp** (`mdKopTillagg`): en släppt köpt reserv kan ge mer än köpet kostar. Största
överskottet är nu en släppt 5★ (2 600) mot en 2★ som ersätter en 1★-grundpelare (560): **+2 040** (förut 400 –
som redan efter #883 var för lite för en släppt 5★ mot en 2★). Köpet självt räknas fortfarande exakt i `mdKopOk`;
tillägget är bara taket per skrivning. Luckan F9 (§15.4) blir därmed högst +2 040 per köp i elevens eget spel.

### 22.4 Reglerna och marginalen

- **Ny klubb:** `mdNyTruppOk` godtar `st` 1 eller 2 (`[12]`), resten som förut.
- **Tränad spelare** (`mdPlatsOk`): `xp` under poängen till nästa stjärna (`n.xp < [0, 50, 100, 250, 500, 1][n.st]`
  – vid 5★ bara 0) och `mdTranVarde` (`[0, 0, 50, 150, 400, 900][st] + xp`) +1–96 per skrivning. Den gamla regeln
  `st × 100 + xp` hade gett en 3★ → 4★ för 100 poäng.
- **Köpt spelare:** 1★ till divisionens tak (`n.st >= 1`).
- **Lägret:** `[0-9]{1,5}-([1-9][0-9]?(-[1-3])?|k)(-p)?`, högst 16 tecken – ett fjärde läger (`"-4"`) nekas.
  Fortfarande prövas inte att lägret är nyare än det sparade (§15.4): den som skriver förbi appen kan växla
  tillbaka och träna mer – bara i sitt eget spel.
- Tester: `test/firestore-rules-matchdagen-traning-883.test.js` (ny klubb 1★/2★, tre läger + fjärde nekat,
  kostnaderna 50/100/250/500 och kanterna 49/99/249/499, äldre karriärer).
- **Marginalen** (`admin/qa-matchdagen-marginal.test.js`, extra `(d.div == d.div) &&`): läger 24 (förut 30 –
  tabellerna kostar ~6 uttryck för den tränade spelaren), lägrets start 50, ny klubb 4, köp med fulla reserver 16,
  hela säsongen + kvalet 10, legendklubben 12, match 50; läger + match i en skrivning nekas som förut.

### 22.5 Deploy

**`firebase deploy --only firestore:rules` före webben.** Gamla regler + ny webb: en ny klubb (1★) och varje
läger med den nya nyckeln (`"1-3-2"`) nekas. Nya regler + gammal webb: se versionsglappet i §22.2. Functions
bara via den synkade kopian (`npm run sync:matchdagen`; vänskapsmatchen läser bara lagbonusen). Inga index.

**#890 (priserna):** reglerna kräver kassan ≤ den sparade − priset + återbetalningen. Gamla regler + ny webb: ett
vanligt köp går (den nya webben betalar mer), men ett köp med fulla reserver som släpper en köpt 4★/5★-reserv nekas
(den nya webben räknar med halva det nya priset, 1 575/2 600, de gamla reglerna med 1 045/1 595 och taket 400).
Nya regler + gammal webb: varje 4★/5★-köp till det gamla priset nekas (sparningen misslyckas, eleven får ladda om).
Det första glappet är ovanligare, så är #883:s regler redan ute: **webben först, sedan
`firebase deploy --only firestore:rules` direkt efter** – annars gäller §22.5 ovan (reglerna först, samma glapp för
den som har en gammal flik öppen). Functions bara via den synkade kopian.

## 23. Vänskapsmatcherna laggade (#895)

Elias provade en vänskapsmatch i två fönster på samma dator (www.pluggporten.se, 2026-11-22 08:22): långa väntetider,
och matchen lämnades efter ett läge. Orsakerna är **mätta** – Cloud Logging för den matchen (Cloud Run-loggarna för
`md*`), matchdokumentet i Firestore, sajtens HTTP-huvuden och emulatorn (`npm run bench:vanskap`, två klienter).

### 23.1 Orsakerna

1. **Klockan gick upp till 10 minuter för fort** (huvudorsaken). `syncServerClock` (`src/data-class-lock.js`) räknade
   serverns tid som `Date + Age`. Sajten ligger bakom GitHub Pages/Fastly (`cache-control: max-age=600`): `Date` sätts
   när svaret levereras och `Age` är hur länge sidan legat i cachen – så klockan blev `Age` sekunder för snabb
   (mätt: Age 0/20/40/60/80/100 s → gammal avvikelse 0/+21/+41/+61/+81/+101 s, ny 0). I en vänskapsmatch med 66 s per
   läge (60 + 6) var lägets tid "ute" direkt så fort Age > ~65 s: valet stängdes ("Tiden är ute – nästa läge kommer"),
   klienten anropade `mdTick` var 4:e sekund (loggen: 7 tick på 26 s, alla utan verkan) och läget väntade på
   serverns riktiga tid, upp till en minut. Med Age < 65 s blev elevens klocka i stället kortare. Samma fel gällde
   allt som använder `serverNow()` (fokuslåsen, proven, schackklockan, myntdagen).
2. **Kallstarter.** De sex callables är sex Cloud Run-tjänster som skalar till noll; första anropet till var och en
   startar en instans. I loggen: CORS-förfrågan (OPTIONS) **2,2–3,0 s** + första POST **0,4–0,7 s** för `mdUtmana`,
   `mdSvara`, `mdFraga`, `mdTick`, `mdSvar` och `mdGeUpp` – alltså ~3 s extra på varje nytt steg i den första matchen
   (och efter ~15 minuter utan anrop). Varma anrop: **63–171 ms** (`mdTick`).
3. **Transaktionskrockar.** Två svar (eller två `mdTick`) samtidigt läser varandras dokument; Firestore avbryter den
   ena (ABORTED) och SDK:t (`@google-cloud/firestore` 7.11, `backoff.js`) väntar **1 s ± 50 %** innan nästa försök
   (1,5 s därefter). Båda klienterna anropade `mdTick` på exakt samma tid (lägets gräns + 300 ms) – en säker krock.
   Emulatorn löser krockar med en låstimeout (2 s), så dess tider för samtidiga svar är inget mått på driften.
4. **Pauser i klienten.** Efter det sista svaret: kortets paus (0,6 s rätt / 1,5 s fel) och SEDAN animationen
   (pass 1,2 s, skott/mål längre). Mätt i webbläsaren: det sista svaret → nästa val **3,0 s** i median.

Ingen ändring behövdes för antalet anrop per läge: varma `fraga`/`svar` tar ~30–60 ms i emulatorn och 60–170 ms i drift.

### 23.2 Ändringarna

| Orsak | Ändring | Fil |
| --- | --- | --- |
| 1 | `syncServerClock` räknar bara `Date` (inte `Age`) | `src/data-class-lock.js`, test `test/server-klocka-895.test.js` |
| 2 | EN callable `mdVanskap({ op })` (samma kärna, samma grind) – utmana, svara och hela matchen håller samma instans varm. Lobbyn anropar `op: "varm"` när fliken Vänskap öppnas, så kallstarten sker medan eleven tittar på lobbyn | `functions/md-vanskap-anrop.js`, `src/matchdagen/vanskap/md-vanskap-moln.js`, `md-vy-vanskap.js` |
| 3 | `snabbTx`: en krock (ABORTED) görs om **direkt**, upp till 5 gånger, sedan SDK:ts vanliga omförsök; nätfel som förut. Alla vänskapstransaktioner. Sidan b anropar `mdTick` 1 s efter sidan a (1 300 i stället för 300 ms) | `functions/md-vanskap-state.js`, `-spel.js`, `-lobby.js`, `src/matchdagen/vanskap/md-vanskap-spel.js` |
| 4 | Är läget redan avgjort när svaret visas spelas animationen direkt – rätt svar står kvar på kortet under animationen | `src/matchdagen/vanskap/md-vanskap-spel.js` |

`snabbTx` gör om med en ny transaktion – den förlorar Firestores företräde för ett omförsök (wound-wait) och kan
avbrytas igen; efter fem försök tar SDK:ts omförsök (med företräde och väntan) över.

Spelregler, balans, frågor, tider och datamodell är oförändrade. Reglerna (`firestore.rules`) är oförändrade.

### 23.3 Före och efter

**Drift, före** (Cloud Logging, Elias match 2026-11-22; ms): första anropet per callable = kallstart.

| Steg | OPTIONS (kall) | POST | Varmt |
| --- | --- | --- | --- |
| mdUtmana | 2 971 | 671 | – |
| mdSvara | 2 265 | 687 | – |
| mdFraga | 2 237 | 414 | – |
| mdSvar | 2 868 | 518 | – |
| mdTick | 2 456 | 464 | 63–171 |
| mdGeUpp | 2 447 | 536 | – |

Efter: en kallstart (`varm`, medan lobbyn visas) i stället för sex; resten är varma anrop (63–171 ms enligt `mdTick`).

**Emulatorn** (`npm run bench:vanskap`, två klienter, 9 lägen, ms; "första" = kall worker, som en ny Cloud Run-instans):

| Steg | Före: första | Före: median | Efter: första | Efter: median |
| --- | --- | --- | --- | --- |
| lobbyn öppnas (`varm`) | – | – | 1 150–1 850 | – |
| utmana | 1 370–1 860 | – | 180–226 | – |
| svara (anta) | 1 330–1 690 | – | 108–131 | – |
| fraga | 1 190–1 440 | 35–38 | 34–46 | 26–36 |
| svar | 1 250–1 560 | 34–84 | 45–94 | 28–73 |
| svar → nästa läge hos den andra | – | 68–119 | – | 54–111 |
| tick | 1 250–2 380 | – | 20–37 | – |
| geUpp | 1 210–2 100 | – | 55–101 | – |

**Webbläsaren** (två elever i två fönster spelar en hel match mot emulatorerna, robot som väljer efter 0,5/1,5 s och
svarar efter 0,75/2,25 s; ms, median (max)):

| Steg | Före | Efter |
| --- | --- | --- |
| valet → frågan syns (`fraga`) | 275–285 (703) | 443–449 (2 925)¹ |
| svaret → rättat (`svar`) | 186–262 (697) | 249–279 (514) |
| det sista svaret → nästa val | **3 013** (4 039) | **1 883** (3 098) |
| hela matchen (robotar) | 211 s | 187 s |
| callables (resurstid) | 55–68 | 53–65 |

¹ Spridningen kommer från att båda fönstren delar en processor och animationen nu spelas samtidigt; ett anrop tog
2,7 s (emulatorns låstimeout vid en krock). I drift är klockfelet (orsak 1) borta helt, och de ~3 s kallstart per steg
blir en enda, medan lobbyn visas. Det som återstår mellan två lägen är animationen (~1,2 s) + ett varmt anrop.

Skärmbilder: [`qa-matchdagen-895/`](qa-matchdagen-895/) – svaret står kvar under animationen, slutet för båda.

### 23.4 minInstances – inte påslaget

`minInstances: 1` på `mdVanskap` skulle ta bort den sista kallstarten (~3 s när ingen spelat på ~15 minuter).
Uppskattning (Cloud Run, europe-west1, priser för en vilande min-instans med debitering per förfrågan: 0,0000025 USD per
vCPU-sekund och per GiB-sekund): 1 vCPU + 0,25 GiB × 2 628 000 s/månad ≈ 6,6 + 1,6 ≈ **8 USD (~90 kr) per månad**,
dygnet runt. Det är inte påslaget: `varm` när lobbyn öppnas ger samma effekt gratis för den som spelar. Vill Elias ha
det: `minInstances: 1` i `MD_OPTS` (gäller då alla sju md-callables – lägg det bara på `mdVanskap`). Kontrollera priset
i Cloud Run-prislistan först.

### 23.5 Deploy

**Functions först (`firebase deploy --only functions`), sedan webben.** Den nya webben anropar `mdVanskap`, som inte
finns förrän functions är ute. Den gamla webben fortsätter med de sex gamla namnen (kvar, samma kärna, nu med
`snabbTx`). Klockfelet rättas med webben. Inga regler, inga index. De sex gamla callables kan tas bort i en senare
deploy när ingen gammal flik längre kan vara öppen (`firebase functions:delete mdUtmana mdSvara mdFraga mdSvar mdTick
mdGeUpp --region europe-west1`). Mät igen efter deploy: `admin/md-vanskap-latens-895.mjs` (emulatorn) och Cloud
Logging-filtret `resource.type="cloud_run_revision" AND resource.labels.service_name="mdvanskap"`.

