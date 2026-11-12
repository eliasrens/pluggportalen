# Kurragömma 🙈 – motorn, kartan, reglerna och balansen

Kurragömma är ett Live-format i 3D (`format: "kurragomma"`, epic #835). Specen:
[`UTVECKLINGSUPPDRAG_KURRAGOMMA.md`](UTVECKLINGSUPPDRAG_KURRAGOMMA.md), skissen:
[`kurragomma/skiss.html`](kurragomma/skiss.html). Där skissen och specen skiljer
sig gäller specen.

Det här är **formatets kontraktsdokument**. Del A (#836) beskriver den delade
motorn i `delat/`. B (3D-scenen), C (servern), D (projektorn och elevskärmen) och
E (lärarformuläret, historiken, pluggmynten och lärarens vissling, §12) bygger mot
API:t i §2–§4 och lägger till sina egna avsnitt längre ned.

---

## 1. Filerna (del A)

| Fil | Innehåll |
| --- | --- |
| `src/live/formats/kurragomma/delat/kg-config.js` | **Alla tal**: fart, skydd, sökradier, visslingar, spärrtider, poäng, lärarens val, klientens tal (hjärtslag, rörelsekanalen, flödet) och kameran |
| `delat/kg-karta.js` | Kartan **Ön** som data: radie, startplatser, 40 föremål |
| `delat/kg-geometri.js` | `skydd`, `kollidera`, `giltigtGomstalle`, `narmasteGiltiga`, `platsNamn`, `gomstalleNaraForemal` |
| `delat/kg-regler.js` | Sökningen, rimlighetskontrollen, visslingar (spärrtid, tystnad, frånkopplad), poäng, överlevnad, placering, startsökare, inställningar, matchklockan och `deltog` (pluggmyntens deltagare, §12.3) |
| `delat/kg-prng.js` | Seedad slump för simuleringen, testerna och demots robotar |
| `functions/kurragomma/` | **Genererad** kopia av `delat/` (`npm run sync:kurragomma`, körs också som predeploy). Redigera den aldrig |
| `admin/kg-balans-sim.mjs` | Balanssimuleringen (`npm run balans:kurragomma`, §6) |
| `test/live-kurragomma-karta.test.js` | Kartan och geometrin (spec §13.1) |
| `test/live-kurragomma-regler.test.js` | Reglerna, poängen, renheten, "alla tal i konfigen" och synken |
| `test/live-kurragomma-balans.test.js` | En kort balanskörning (30 frön) som fäller en konfig utanför riktmärkena |

`delat/` är ren: ingen DOM, ingen Firebase, ingen three.js, ingen
`Math.random`/`Date.now`, och bara importer inom `delat/` (testat). Tider och
slump **skickas in**. Servern skickar `Date.now()`/serverns tid och
`Math.random`, demot och simuleringen skickar `skapaPrng(frö).tal`.

Inget registreras i Live i del A. Bootgrafen (`test/live-formats.test.js`) är orörd.

---

## 2. API:t

Alla funktioner tar en valfri `karta` som sista argument (standard är Ön). Enheten
är meter, och 1 enhet i 3D-scenen är 1 m. Tider anges i ms med serverns klocka. Riktningen
(`yaw`) anges i radianer, där framåt är `(x: sin yaw, z: cos yaw)`.

### 2.1 Kartan – `kg-karta.js`

```js
import { ON, KARTOR, hamtaKarta } from "./delat/kg-karta.js";
ON = { id: "on", namn: "Ön", radie: 30, sokarStart: { x, z }, gomStart: [{ x, z, yaw }], foremal: [...] }
```

| Fält i ett föremål | |
| --- | --- |
| `id`, `typ` | `typ` ∈ lada, hostack, sten, gran, ek, trad, buskage, bro, damm, brunn, vedtrave, vagn, tunnor, talt, staket, blommor, moln. **B väljer modell efter `typ`** |
| `namn` | bestämd form för flödet ("ladan"), `null` för dekor utan namn |
| `x`, `z`, `rot` | mitten och vridningen runt y. `rot` påverkar bara ritningen |
| `r` | radien för **skyddet**. `0` ger inget skydd (dammen, blommor, moln) |
| `fast` | radien man **inte kan gå in i** (kollisionen). `0` betyder att man går igenom |
| `lov` | `true` = man kan gå in och gömma sig (skydd 3 innanför `r`). Gäller buskage, höstacken, granen och eken |
| `yta` | valfri: radien för **platsnamnet** när den skiljer sig från `r` (dammen 5,9, bron 4) |

- `sokarStart` ligger vid brunnen, mitt på ön. Där börjar startsökarna.
- `gomStart` innehåller 32 platser i kanten (27 m från mitten), vända inåt. C
  delar ut dem, till exempel i tur och ordning eller slumpat.
- Kartan är fryst (`Object.freeze`), så den får inte ändras på klienten.
- Allt är cirklar kring `(x, z)`. Avlånga saker (bron, staketet) har därför ingen
  kollision. Staketet är lågt, och B ska rita det så att man ser att man kliver
  över det.

### 2.2 Geometrin – `kg-geometri.js` (B, C, D)

| Funktion | Ger | Vem |
| --- | --- | --- |
| `skydd(x, z)` | 0–3: 3 inne i ett lov-föremål, 2 högst 0,6 m från ett föremåls kant (`r`), 1 högst 2 m, annars 0 | B/D mätaren, C i `kgLas` (sparas i `kgSelf.gomstalle.skydd`) |
| `skyddText(n)` | "Syns lätt", "Okej gömställe", "Bra gömställe", "Mycket bra gömställe" | D mätaren |
| `kollidera(x, z)` | `{ x, z }` knuffad ut ur `fast`-radier och in på ön | B rörelsen, varje bildruta |
| `innanforOn(x, z)` | bool | C |
| `giltigtGomstalle(x, z)` | bool: på ön (≤ radien) och inte inuti ett fast föremål | C `kgLas` |
| `narmasteGiltiga(x, z)` | `{ x, z }`: samma punkt om den är giltig, annars närmaste giltiga punkt. Resultatet är **alltid** giltigt, även för NaN | C `kgLas` |
| `platsNamn(x, z)` | "i buskaget", "vid ladan", "vid ett träd", "vid bron" eller "ute på ängen" | C flödet/`hand`, D "Du är gömd i buskaget" |
| `gomstalleNaraForemal(karta, slump)` | ett giltigt gömställe nära ett slumpat föremål som ger skydd | C `kgTick` för frånkopplade som inte låst |
| `avstand(a, b)` | meter mellan `{ x, z }` | alla |

Platsnamnet väljs så här:

1. Inne i ett lov-föremål ger "i …" (det minsta vinner).
2. Inne i ett föremåls `yta ?? r` ger "vid …" (minsta ytan vinner, så mitt på bron blir det "vid bron" och inte "vid dammen").
3. Högst `PLATS_VID_M` (2,5 m) från en kant ger "vid …" (den närmaste).
4. Annars blir det "ute på ängen".

### 2.3 Reglerna – `kg-regler.js` (C, D)

**Sökningen (§1.6)**

| Funktion | |
| --- | --- |
| `kontrolleraSokning({ roll, laddningar, x, z, nu, senasteSok, startpunkt })` | `{ ok }` eller `{ ok: false, skal }`, där `skal` ∈ `inte-sokare`, `ingen-laddning`, `sparr`, `utanfor`, `orimlig`. `senasteSok` = `{ x, z, at }` eller `null`. `startpunkt` = `{ x, z, at }` där och när eleven blev sökare. **Dra laddningen bara vid `ok`** |
| `rimligPlats({ x, z, nu }, fran)` | avståndet ≤ `MAX_FART` × sekunder + `RIMLIG_MARGINAL_M` |
| `sok({ x, z, nu }, gomda)` | uid för **alla** gömda inom sin sökradie (≤). `gomda: [{ uid, x, z, skydd?, senastVisslingAt? }]`. Saknas `skydd` räknas det ur kartan. Ordningen är indatans |
| `sokradie(skydd, { senastVisslingAt, nu })` | tabellen `SOKRADIE`, ×1,5 om eleven visslat inom 10 s |
| `missFlodeTillats(senastMissFlodeAt, nu)` | "… letade vid brunnen men hittade ingen" högst var 15:e s per sökare |

**Svaren och visslingarna (§1.3–§1.5)**

| Funktion | |
| --- | --- |
| `svarsEffekt({ roll, ratt, fas, laddningar, senastVisslingAt, nu })` | `{ poang, laddningar, vissling }`. Gömd: rätt ger +10, fel ger vissling om spärren tillåter. Sökare: rätt ger +10 och +1 laddning (tak 3), fel ger ingenting. Gäller också sökaren under blundandet |
| `visslarVidFel({ roll, fas, senastVisslingAt, nu })` | bool: bara gömda, bara i letfasen och bara efter spärrtiden |
| `tystnadVisslar({ roll, fas, tystnadPa, senastSvarAt, senastVisslingAt, letStartAt, pulsAt, nu })` | bool. Tiden räknas från det **senaste** av svaret, visslingen och letfasens början. Gäller aldrig en frånkopplad elev |
| `arFrankopplad(pulsAt, nu)` | pulsen saknas eller är minst 30 s gammal |
| `visslingsplats(x, z, u1, u2)` | den **ungefärliga** platsen: likformigt inom `VISSLING_OSAKERHET_M` och hållen inom ön. `u1, u2` ∈ [0, 1) (C: `Math.random()`). Den exakta platsen lämnar aldrig servern |
| `hjartslag(gom, sokare)` | någon sökare finns inom 6 m (D, på klienten ur rörelsekanalen) |
| `laddningarVidLetStart(laddade)` | 1 + det som laddats under blundandet, tak 3 |
| `laddningarNySokare()` | 1. Gäller den som hittats och den som ansluter under letfasen |

**Poängen och slutet (§1.3, §1.7, §10)**

| Funktion | |
| --- | --- |
| `poangForHittad()` | 40 till sökaren |
| `overlevnadsPoang(ms)` | +2 per **hela** 10 s |
| `poangVidHittad({ letStartAt, hittadAt })` | överlevnaden för den som hittas |
| `poangGomdVidSlut({ letStartAt, slutAt })` | överlevnaden + 50 |
| `placering(rader)` | `[{ …, plats }]` med högst poäng först. Lika poäng ger delad placering (1, 1, 3) och ordnas sedan på uid |
| `rewardRader(spelare)` | `[{ uid, score, correct, answered }]` ur `{ uid, poang, ratt, besvarade }` |
| `deltog(p)` | pluggmyntens deltagare (E, §12.3): `besvarade > 0`, eller `harLast`, eller `hittade > 0` |
| `arSlut({ fas, nu, slutAt, gomdaKvar })` | tiden är ute, eller alla är hittade i letfasen |

**Rollerna, inställningarna och klockan (§1.1, §9, §0.1)**

| Funktion | |
| --- | --- |
| `antalStartsokare(antalElever, val)` | `"auto"` ger 1 per påbörjat 10-tal, minst 1, högst 4. Ett tal klämms till 1–4. **Aldrig fler än elever − 1** |
| `valjSlumpade(uids, antal, slump)` | dragningen av startsökare, utan återläggning |
| `rollVidAnslutning(fas)` | `"gom"` ger `"gomd"`, annars `"sokare"` |
| `behoverNySokare({ fas, sokare: [{ pulsAt }], gomdaKvar, nu })` | i letfasen, när ingen sökare har puls och det finns gömda kvar |
| `normInstallningar(inst)` | `{ gomtid ∈ 20/30/45/60 (30), startsokare "auto"\|1–4, tystnad (true), karta ("on") }` |
| `normSpeltidMin(min)` | 1–60 hela minuter. Saknat värde (`undefined`, `null`, `""`) eller inte ett tal ger `null` |
| `matchSekunder({ gomtid, speltidMin })` | kärnans `durationSeconds` = gömtid + speltid |

---

## 3. Talen (`kg-config.js`)

| Tal | Värde | Spec | |
| --- | --- | --- | --- |
| `MAX_FART` | 6 m/s | 6 | rörelsen och rimligheten |
| `RIMLIG_MARGINAL_M` | 2 m | 2 | |
| `SOKRADIE` | **2,0 / 1,7 / 1,3 / 0,9** | 3,5 / 3,0 / 2,2 / 1,5 | **balanserad**, se §6 |
| `VISSLING_RADIE_FAKTOR`, `VISSLING_FONSTER_MS` | 1,5, 10 s | 1,5, 10 s | |
| `VISSLING_OSAKERHET_M` | **5 m** | 2,5 | **balanserad** |
| `VISSLING_SPARR_MS` | **200 s** | 20 s | **balanserad** |
| `TYSTNAD_MS`, `FRANKOPPLAD_MS` | 45 s, 30 s | 45, 30 | |
| `LETA_SPARR_MS` | 2 s | 2 | |
| `LADDNING_MAX`, `LADDNING_START`, `LADDNING_PER_RATT` | 3, 1, 1 | 3, 1, 1 | |
| `POANG` | rätt 10, hittade 40, 2 per 10 s, gömd vid slutet 50 | samma | |
| `SKYDD_BRA_M`, `SKYDD_OKEJ_M` | 0,6 m, 2 m | 0,6, 2 | |
| `GOMTIDER_S`, `GOMTID_STANDARD_S` | 20/30/45/60, 30 | samma | |
| `SPELTIDER_MIN`, `SPELTID_REKOMMENDERAD_MIN`, `SPELTID_EGEN_MIN` | 3/5/10/15/20/30, 8, 1–60 | samma | |
| `STARTSOKARE` | 1 per 10, 1–4 | samma | |
| `HJARTSLAG_M` | 6 m | 6 | |
| `FLODE_MISS_SPARR_MS`, `FLODE_MAX_RADER` | 15 s, 4 | samma | |
| `POS_MIN_INTERVALL_MS`, `POS_MIN_FLYTT_M`, `POS_INTERPOLERING_MS` | 333 ms (3/s, F #841 – var 200 ms/5 s), 0,15 m, 400 ms (F #841 – var 150 ms; måste vara > takten + jitter, annars står figuren still mellan proverna) | samma | rörelsekanalen (C/D); `pos` skrivs med två decimaler |
| `HAND_MAX_ALDER_MS`, `HAND_RENSA_MS` | 10 s, 60 s | samma | |
| `VISSLING_MARKOR_MS`, `VISSLING_RAD_MS`, `HITTAD_RUTA_MS`, `KAMERA_GLID_MS` | 4 s, 3 s, 2 s, 3 s | samma | |
| `LARARE_VISSLA_SPARR_MS` | 5 s | – | lärarens vissling, spamskydd per elev (E, §12.4) |
| `KAMERA` | 8,5 m bakom, 4,5 m upp, 60° | samma | B |
| `FIGUR_RADIE_M` | 0,5 m | – | minsta passage mellan fasta föremål är 1 m (testat) |

Ett test fäller geometrin och reglerna om de innehåller ett speltal i stället för
att läsa det ur konfigen.

---

## 4. För servern (C) – hur motorn används

- **`kgStarta`**: `antalStartsokare(n, inst.startsokare)` och
  `valjSlumpade(uids, antal, Math.random)`. Startsökarna placeras på `ON.sokarStart`.
  Klockan: `durationSeconds = matchSekunder({ gomtid, speltidMin })`.
- **`kgLas`**: `narmasteGiltiga(x, z)`, och sedan `skydd` och `platsNamn` på den
  flyttade punkten. Resultatet skrivs till `kgSelf.gomstalle = { x, z, skydd, namn }` och `kgSecret`.
- **Fasbytet** (`kgTick` och lat): den som inte låst och är frånkopplad får
  `gomstalleNaraForemal(ON, Math.random)`. Startsökarna får
  `laddningarVidLetStart(laddningar)`. Varje sökares startpunkt blir
  `{ ...sokarStart, at: letStart }`.
- **`kgSvara`**: `svarsEffekt(...)`. När `vissling` är sann skrivs
  `senastVisslingAt = nu`, och sedan händelsen med `visslingsplats(x, z, Math.random(), Math.random())`
  och `platsNamn` på **den ungefärliga** platsen. Varken namnet eller den exakta platsen följer med.
- **`kgLeta`** (i en transaktion): `kontrolleraSokning`, sedan `sok` på de gömda
  (läses ur `kgSecret` och `kgSelf.skydd`). Varje hittad får `poangVidHittad` och blir sökare
  med `laddningarNySokare()` och startpunkten = gömstället vid `nu`. Sökaren får
  `poangForHittad()` per hittad. `senasteSok = { x, z, at: nu }`.
- **`kgTick`**: `tystnadVisslar` (frågan: gömda med `senastSvarAt` äldre än
  `TYSTNAD_MS`; filtrera sedan med funktionen), och `behoverNySokare`.
- **`kgAvsluta`**: `poangGomdVidSlut` för dem som är kvar, `placering`, `rewardRader`.

---

## 5. För klienten (B, D)

- Rörelsen: `kollidera(nyX, nyZ)` varje bildruta med farten `MAX_FART`.
- Mätaren: `skyddText(skydd(x, z))`.
- Hjärtslaget: `hjartslag(egetGomstalle, sokarnasPositioner)`.
- Demot (D): robotar med `skapaPrng(frö)`. `admin/kg-balans-sim.mjs` visar ett sätt
  att låta robotar gömma sig, svara och leta med reglerna.

---

## 6. Balansen (spec §11.5)

Kör `npm run balans:kurragomma` (200 frön per rad). Det finns också `--n 50` för en snabbare körning,
`--md` för markdown och `--takt 15,20` för att sätta robotarnas takt (s/fråga för gömd och sökare). Simuleringen har 25 elever, 8 minuters speltid, 30 s gömtid och Auto-startsökare (3). Den
kör de riktiga funktionerna i `delat/`.

**Med de slutliga värdena (200 frön per rad):**

| Rätt | Startsökare (p) | Hittade gömmare (p) | Klarade gömmare (p) | Gömda kvar (p10–p90) | Visslingar/min | Poäng från rätt svar | Hittade efter vissling |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 60 % | 324 | 361 | 499 | 32 % (14 %–55 %) | 5,6 | 77 % | 53 % |
| 75 % | 392 | 426 | 586 | 26 % (9 %–45 %) | 4,8 | 81 % | 53 % |
| 90 % | 458 | 485 | 673 | 22 % (5 %–41 %) | 3,6 | 84 % | 55 % |

Riktmärkena är gömda kvar 15–40 %, högst 6 visslingar per minut och minst 60 % av poängen från rätt svar.
**Alla nås i medel vid alla tre nivåerna, men bara med robotarnas takt (8 s per fråga för en gömd, 12 s för en sökare).**
Andelen gömda kvar beror starkt på hur snabbt klassen svarar (se känsligheten nedan).

**Känsligheten för takten (slutliga värden, 200 frön per rad, `--takt gömd,sökare`):**

| Takt (s/fråga, gömd/sökare) | Gömda kvar 60 / 75 / 90 % | Visslingar/min 60 / 75 / 90 % | Från rätt svar 60 / 75 / 90 % |
| --- | --- | --- | --- |
| 6 / 10 | 28 / 21 / 17 % | 5,6 / 4,8 / 3,7 | 81 / 85 / 87 % |
| **8 / 12 (tabellen ovan)** | **32 / 26 / 22 %** | **5,6 / 4,8 / 3,6** | **77 / 81 / 84 %** |
| 12 / 16 | 44 / 37 / 32 % | 5,7 / 4,8 / 3,5 | 68 / 73 / 77 % |
| 15 / 20 | **54 / 45 / 43 %** | 5,6 / 4,7 / 3,3 | 62 / 68 / 72 % |

- **Gömda kvar** går över 40 % när klassen svarar långsamt (quizfrågor för en trea kan ta
  15 s). Sökarna får färre laddningar, och då hittar de färre. Riktmärket 15–40 % nås alltså bara
  för snabba frågor, till exempel multiplikation. Med långsamma frågor behöver sökradierna eller
  laddningarna justeras efter testet i klassrum.
- **Visslingar per minut** påverkas nästan inte av takten. Med 200 s spärr bestäms takten av
  spärren och inte av svaren: ungefär antalet gömda ÷ 200 s. Med ~18–20 gömda i snitt
  blir det ~5,5/min. Siffran sjunker vid 90 % bara för att fler blir hittade.

**Med specens värden (100 frön):**

| Rätt | Startsökare | Hittade gömmare | Klarade | Gömda kvar | Visslingar/min | Från rätt svar |
| --- | --- | --- | --- | --- | --- | --- |
| 60 % | 160 | 92 | – | 0 % | 19,4 | 58 % |
| 75 % | 192 | 122 | – | 0 % | 12,8 | 67 % |
| 90 % | 258 | 186 | – | 0 % | 5,6 | 77 % |

Med specens värden hittades alla. I medianmatchen var hälften hittade efter 40–50 s och alla efter 2–3 minuter.
Klassen visslade 13–19 gånger per minut vid 60–75 % rätt. Med specens värden och den långsamma takten
15/20 s blev det 11,9 visslingar/min vid 60 % (7,3 vid 75 %), och fortfarande 0 % gömda kvar (100 frön).

**Vad som justerades och varför (bara `kg-config.js`):**

1. **`VISSLING_SPARR_MS` 20 s → 200 s.** En gömd som svarar en fråga per
   ~8 s och har 40 % fel visslar ungefär var 20:e sekund efter spärren. Med ~18 gömda
   blir det snabbt för mycket. Bara spärren räckte för att komma under 6/min (150 s
   gav ~7/min vid 60 %), men då hittades fortfarande alla.
2. **`SOKRADIE` ×~0,6 (2,0/1,7/1,3/0,9).** Med specens radier hittade sökarna nästan alla
   bara genom att leta vid buskar och träd, eftersom gömmarna samlas vid föremålen. Det gällde
   även när visslingarna gjordes helt oprecisa (8 m). Ordningen mellan nivåerna är
   oförändrad.
3. **`VISSLING_OSAKERHET_M` 2,5 → 5 m.** Med 2,5 m och ×1,5-radien ledde nästan varje
   vissling till att någon hittades, även med de mindre radierna (1 % gömda kvar).
   Med 5 m hittas ungefär hälften av de gömda efter en vissling, och resten när någon letar på måfå.

Ett par saker att lägga märke till i tabellen:

- En bättre klass har **färre** gömda kvar. Sökarna laddar ficklampan snabbare och hittar fler,
  vilket väger tyngre än att gömmarna visslar mindre. Alla roller tjänar ändå på
  rätt svar (testat): poängen stiger med andelen rätt för startsökare, hittade och klarade.
- Den som klarar sig får mest (~500–670 p), men den som hittas och blir sökare tar
  igen en del genom att hitta andra. Startsökarna får minst, eftersom de inte får någon överlevnadspoäng.
- Spridningen är stor (p10–p90 5–55 %). Det beror på slumpen i vem som gömmer sig var.

**Robotarna (antaganden, inte spelregler – `ROBOT` i simuleringen):**

- En gömd svarar en fråga per ~8 s (±25 %), som i Meteorstormens simulering. En sökare
  svarar en per ~12 s, eftersom den också går omkring.
- Robotarna går med effektivt 4 m/s, eftersom barn inte går raka vägen.
- Gömställen: 35 % inne i ett lov-föremål, 35 % vid en kant, 20 % 0,6–2 m från en kant
  och 10 % ute på ängen.
- En sökare går mot den senaste visslingen om den är högst 15 s gammal och högst 18 m bort.
  Där letar den vid markören (±1 m) och en gång till (±2,5 m) om den har laddning.
- Annars går sökaren till ett slumpat föremål. Hälften av sökarna letar vid varje föremål,
  och resten sparar tills ficklampan är full.
- Ingen robot är tyst eller frånkopplad, så tystnadsregeln påverkar inte tabellen.

Riktmärkena hänger på robotarnas beteende. Specen planerar redan en balansjustering
efter test i klassrum (etapp 2). Det är där siffrorna ska bekräftas.

---

## 7. Antaganden och avvikelser (del A)

- **Balansen** ändrade tre värden mot specen (§6). Spärren på 200 s betyder att en gömd som
  svarar fel visslar högst ungefär var 3:e minut.
- **Risk med 200 s spärr: fri gissning.** Bara det **första** felet i varje 200 s-fönster
  visslar. Efter en vissling kan en gömd gissa fritt i 200 s, vilket är ~42 % av en runda på
  8 minuter, utan att det kostar något mer än uteblivna +10. Den som svarar fel ofta tillbringar
  alltså större delen av rundan i spärr. Visslingarna styrs då av spärren (≈ gömda ÷ 200 s) och
  inte av hur många fel klassen gör, så ett fel säger sökarna lite om **vem** som har svårt.
  Spärren skyddar en elev som har det svårt, men den tar också bort det mesta av
  visslingens poäng ("svara rätt, annars visslar det"). Det är en fråga till Elias (§8, fråga 2).
- **Tystnadsregeln** räknas från det senaste av svaret, visslingen och letfasens början.
  En tyst elev visslar därför högst var 45:e s, och aldrig de första 45 s av letfasen.
  Med spärren på 200 s visslar en tyst elev oftare än en som svarar fel. Det är
  avsiktligt, eftersom det är att svara som ska löna sig. Det är en fråga till Elias (§8, fråga 4).
- **Vanliga träd är inte `lov`.** Specen §2.1 nämner bara buskage, höstack, granens och ekens
  krona. Skissen räknade alla träd som lov. Nära ett träd ger skydd 2 och namnet "vid ett träd".
- **Dammen går att gå i.** Den har ingen kollision och inget skydd (`r: 0`), bara ett
  platsnamn. Bron ger litet skydd (`r: 2`).
- **Staketet har ingen kollision**, eftersom cirkelmodellen inte kan forma en lång linje.
- **Startsökare:** aldrig fler än elever − 1. En ensam elev får 0, och regeln
  "det finns alltid en sökare" tar över i letfasen.
- **Laddningar för en ny sökare** (hittad eller sent ansluten): 1, samma som
  startsökarnas grund. Specen säger inget om detta.
- **Visslingsplatsen** är likformig över cirkeln. Med `u1 = 0` hamnar den exakt på
  gömstället, men sannolikheten för det är försumbar med `Math.random()`.
- **Platsnamnet för visslingen** räknas på den ungefärliga platsen, inte på gömstället.
  Annars skulle namnet avslöja mer än markören.
- `skydd` och `sok` tål flyttalsavrundning vid gränserna (1e-9).

## 8. Frågor till Elias

1. **Specens 20 s spärr och riktmärket ≤ 6 visslingar/min går inte att nå samtidigt** med ~22
   gömmare. Varje gömd kan vissla en gång per spärrtid, så taket är ungefär gömda ÷ spärrtid.
   Med 20 s och ~20 gömda blir taket ~60/min. I simuleringen gav specens värden 19,4/min vid 60 % rätt
   (8 s/fråga) och 11,9/min även med långsam takt (15 s/fråga). För ≤ 6/min krävs en spärr på
   minst ~180–200 s. **Vilket ska gälla: spärren på 20 s eller ≤ 6 visslingar/min?** Ett alternativ
   som bara kan göras med en regeländring och inte i konfigen är ett tak för hela klassen,
   till exempel högst en vissling per 10 s på projektorn.
2. **Fri gissning med 200 s spärr** (§7): efter en vissling är fel svar gratis i 200 s, ~42 % av
   en runda på 8 min. Är det okej, eller ska spärren vara kortare och riktmärket för
   visslingar högre?
3. Balansen (§6): är sökradierna 2,0/1,7/1,3/0,9 och en visslingsosäkerhet på 5 m okej som
   start? Med långsamma quizfrågor (15 s) blir 43–54 % gömda kvar, alltså över 40 %. Ska
   balansen ställas för multiplikation eller för quiz?
4. Ska en tyst elev (45 s utan svar) få vissla oftare än den som svarar fel (200 s)?
5. **En deltagande elev får anropa `kgStarta` och `kgTick`** (§10.1) – de gör bara det lata
   fasbytet och tick-frågorna, som ändå körs i varje elevanrop. Det gör att en match med en
   projektor som tappat kontakten ändå rullar vidare. Är det okej, eller ska bara läraren få?
6. **Hittad-händelsen bär namnen** (sökarens och den hittades, enligt `showNames`) och
   gömställets plats, eftersom den hittade just blivit sökare och platsen inte längre är hemlig
   (§10.4). Visslingen bär aldrig namn. Okej?
7. **Kvoten** (§10.8): uppskattningen är ≈ 7 500–7 800 Firestore-läsningar för 10 min/25 elever (budget
   8 000) – under, men med liten marginal och det är en räkning, inte en mätning; slut-QA (F, #841) mäter.
   Om den landar över: ska `perQuestion` räknas ur en aggregering i `kgSvara` (−1 000) i stället för att
   `answers` läses vid slutet?
8. **"Alltid en sökare"-befordran räknas som hittad** (`hittad: true` i `result.gomstallen`, C): den
   gömmare som befordras när ingen sökare finns har inte hittats av någon men får inte
   överlevnadspoängen och visas som hittad i finalen. Ska `result` skilja på "hittad" och
   "befordrad" (en ändring i functions), eller är det okej så?
10. **Pluggmyntens deltagare** (E, §12.3): live-rewards betalar bara den som svarat, så den som gömde
   sig hela matchen utan att svara (guldplats på överlevnaden) fick 0 mynt i D:s test. Kurragömma räknar nu
   **svarat, låst ett gömställe eller hittat någon** som deltagare (`deltog` i `kg-regler.js` + Kurragömma-grenen
   av `liveCoinPlayerOk`; den gemensamma regeln för andra format är orörd). Den som placerades av servern
   (frånkopplad under gömfasen, `harLast: true`) räknas alltså också; den som anslöt sent som sökare och varken
   svarade eller hittade någon får inget. **Är det rätt avgränsning**, eller ska bara den som svarat minst en
   gång få placeringspriset (då står 0 mynt till den som gömde sig tyst hela matchen)?
11. **Lärarens vissling och elevens egen rad** (E, §12.4): den visslade eleven ser samma rad som vid
   tystnadsregeln – D:s id-matchning (`kgPlayers.tystVissling`) utan någon ny text. Raden är sedan
   E:s rättningsrunda 1 (F2) den neutrala "Det visslade där du gömmer dig!" för båda (den gamla
   "Du var tyst länge – …" avslöjade läraren direkt efter ett rätt svar eller med tystnadsregeln av).
   "Fel svar – det visslade där du gömmer dig!" står kvar för fel svar. **Beslutat av issue-leaden** (rättningsrunda 1) –
   Elias kan byta ordalydelsen (`TEXT.tystVissling` i `kge-logik.js`, ett ställe; testet i `live-kurragomma-format.test.js`).
9. **Klassbonusen** (§11.5): betalas av projektorn vars `kgTick` avslutade matchen (eller Avsluta-knappen),
   med `perClass` byggt på klienten ur sessionen eftersom Kurragömmas `result` saknar det. Är projektorn
   stängd vid slutet (en elevs `kgTick` avslutar) går klassbonusen förlorad – samma reserv som Meteorstormen.
   Vill du ha den garanterad behöver `kgAvsluta`/ticken dela ut den på servern (eller `perClass` + ett
   idempotent märke i `result`). Okej med Meteorstormens reserv?

---

## 9. 3D-scenen (del B, #837)

Scenen är en fristående modul i `src/live/formats/kurragomma/scen/` som D monterar i en
container. Den körs utan server i `preview/preview-kurragomma-scen.html` (`?2d=1` tvingar
2D-reserven, `?lage=projektor`, `?niva=0|1|2`, `?namn=0`, `?auto=0`) och
`preview/preview-kurragomma-prestanda.html` (30 figurer, fps, ritanrop, nivå).

### 9.1 Filerna

| Fil | Innehåll |
| --- | --- |
| `scen/kg-scen.js` | **API:t** (§9.2): tillståndet, bildrutans loop, pausen vid dold flik, nivåvakten och bytet till 2D |
| `scen/kg-ritare-3d.js` | 3D-ritaren: sätter ihop kg-tre, kg-figur, kg-effekter och kg-kamera till ritar-gränssnittet |
| `scen/kg-2d.js` | **2D-reserven**: samma ritar-gränssnitt på en vanlig canvas (ovanifrån) |
| `scen/kg-tre.js` | `laddaThree()` – **den enda** platsen som når `src/vendor/three/` (med `import()`); renderer, ljus, dimma, gradientkartan |
| `scen/kg-varld.js` | Ön och alla föremål ur `kg-karta.js` sammanslagna till få ritanrop (vertexfärger, kontur, blob-skuggor) |
| `scen/kg-modeller.js` | Modellerna per `typ` som ren data (ingen three.js), paletten ur `art-style.js`/`art-gard.js` |
| `scen/kg-figur.js` | Figurerna: billboard-sprite med avatarbilden, studs, namnskylt, blob-skuggor (ett InstancedMesh) |
| `scen/kg-avatar-bild.js` | `avatarMarkup(avatarId, avatarItems)` → **en canvas per elev** (cache), delas av 3D och 2D |
| `scen/kg-effekter.js` | Vissling (ringar, noter, "Vissling!", sökarens markör), hittad (konfetti), gömställena i finalen |
| `scen/kg-kamera.js` | Ren kameralogik: tredjeperson, "aldrig inne i ett träd", projektorns rotation och glidning |
| `scen/kg-rorelse.js` | Ren rörelselogik: steget, "gå dit", interpoleringen av sökarnas positioner |
| `scen/kg-styrning.js` | Tangenter, dra, joystick, tryck på marken, fokusregeln |
| `scen/kg-niva.js` | Nivåerna Låg/Mellan/Hög, automatisk sänkning, localStorage (try/catch), valet 3D/2D |
| `scen/kg-overlagg.js` | DOM ovanpå bilden: pilen i kanten, hjärtslagets kant, notisraden |
| `scen/kurragomma-scen.css` | Klasserna `kg-*` (D laddar filen) |
| `src/vendor/three/` | three.js **r170** (`three@0.170.0`, MIT, `LICENSE`), bara `three.module.min.js` – inget CDN, inte i `package.json` |
| `test/live-kurragomma-scen.test.js` | Rörelsen, kameran, nivåerna, modellerna, filerna (≤ 400 rader, bara `import()`, inga Emoji 13+) |
| `test/live-kurragomma-scen-reserv.test.js` | §13.4: hela `kg-scen.js` mot en mini-DOM utan WebGL → 2D, tangenter, fokusregeln |
| `test/live-kurragomma-kamera.test.js` | Kameran mot modellerna (raycast med three): aldrig inne i ett föremål, figuren aldrig inne i ett fast föremål |

`test/live-formats.test.js` bevisar att `src/vendor/` aldrig nås statiskt från `app.js`, och att
`kg-tre.js` är den enda filen i `src/` som laddar three (dynamiskt).

### 9.2 API:t (`kg-scen.js`)

```js
import { skapaKgScen } from "./scen/kg-scen.js";
const scen = await skapaKgScen({
  yta,                 // containern (får klassen kg-scen; canvasen fyller den)
  lage: "elev-gom",    // elev-gom | elev-gomd | elev-sokare | projektor
  roster,              // createAvatarRoster(...) – scenen läser roster.info(uid) och lyssnar på onChange
  jagUid: "jag",       // den egna elevens uid (för avatarbilden)
  namnPa: true,        // lärarens namninställning (skyltar ovanför sökare)
  tvinga2d: false,     // ?2d=1
  niva: null,          // 0–2, annars localStorage, annars Mellan
  karta: ON,           // valfri, standard Ön
});
```

| Anrop | |
| --- | --- |
| `scen.typ` | `"3d"` eller `"2d"` – D behöver inte bry sig, API:t är detsamma |
| `scen.lage(l?)` | Lägena: **elev-gom** fri rörelse (tangenter, joystick, tryck på marken, dra), **elev-gomd** stilla, bara titta runt, **elev-sokare** fri rörelse, **projektor** ovanifrån med rotation och glidning; ingen egen figur |
| `scen.jag(p?)` | Sätt startplatsen `{ x, z, yaw }` (ur `gomStart`, eller gömstället efter en omladdning) / läs var figuren står. Kameran hoppar dit |
| `scen.skydd()` | Mätarens värde 0–3 (`skydd` ur motorn). Händelsen `"skydd"` när det ändras |
| `scen.on("flytt", fn)` | `{ x, z, yaw }` varje bildruta figuren rör sig – D skriver `pos` (högst 3/s, se `POS_*`) |
| `scen.sokare([{ uid, x, z, yaw, t, namn }])` | Sökarnas positioner ur rörelsekanalen (`t` = avsändarens `Date.now()`; scenen räknar om till sin klocka). Ritas `POS_INTERPOLERING_MS` (400 ms) bakåt och interpoleras. Skylt med namn bara när namn är på |
| `scen.sokareBort(uid)` | |
| `scen.vissling({ x, z })` | Den **ungefärliga** platsen. Projektorn: ringar, noter, "Vissling!" och en glidning. Sökaren: markör som syns genom dimman i 4 s och en pil i skärmkanten när platsen är utanför bilden. Gömda: inget (D visar raden överst) |
| `scen.hopp()` | Den egna figuren hoppar till (egen vissling) |
| `scen.hittad({ x, z })` | Konfetti; "Hittad!" och glidning på projektorn |
| `scen.gomstallen([{ uid, x, z }])` | Finalen på projektorn: elevernas figurer på sina gömställen med en gyllene ring |
| `scen.hjartslag(bool)` | Kanten pulserar. D räknar med `hjartslag(gomstalle, sokare)` ur motorn |
| `scen.namnPa(bool)` | |
| `scen.niva(n?)`, `scen.nivaInfo()` | Nivån 0–2; `{ niva, namn, fps, ritanrop, typ }` |
| `scen.on("niva" \| "reserv", fn)` | Automatisk sänkning (`{ niva, namn, automatisk }`), bytet till 2D (`{ typ, fps }`) |
| `scen.paus(bool)`, `scen.destroy()` | Loopen pausar själv när fliken är dold |

Scenen äger **joysticken**, pilen i kanten, hjärtslagskanten och notisraden vid sänkning.
Mätaren, låsknappen, timern och frågepanelen är D:s (utanför ytan eller ovanpå den).
Tangenterna styr inte figuren när ett formulärfält har fokus (`formularHarFokus`).

### 9.3 Val och avvikelser

- **Kameran inne i träd/vägg: kameran dras in** (billigast: ingen genomskinlighet, inga
  materialbyten, ingen sortering av genomskinliga ytor). `kg-kamera.js` har en tabell per typ
  med **modellens verkliga fotavtryck** (cirkel + höjd, ladan en vriden låda) och klipper
  sträckan figur→kamera mot dem med 0,45 m marginal (near-planet), minst 2 m. Står figuren
  intill ett hinder och kameran skulle hamna i det, lyfts kameran över det. Den mjuka följningen
  (lerp i `kg-ritare-3d.js`) klipps en gång till, så inte heller mellanlägena skär genom en krona.
  Undantaget är **lov-föremål** figuren står inne i (buskage, höstack, granen, eken): de hindrar
  inte, och i stället ritas just det föremålet halvgenomskinligt (de ligger som egna meshar – 6 st).
  `test/live-kurragomma-kamera.test.js` bygger modellerna med three och raycastar: kameran och
  near-planet är aldrig inne i någon del (statiskt och under en slumpvandring).
- **Modellerna ryms i motorns kollisionscirklar** (A:s geometri är kanon): ladan 4,6 × 3,8 m
  (hörnet 2,98 < fast 3,3), stenen 0,9 × fast, vagnen, vedtraven och tältet nedskalade, buskagens
  lövklot inom `r`, och trädkronorna börjar över huvudhöjd. Bron har ingen kollision (man går på
  den och kan stå i en räckesstolpe) – det är motorns val, inte scenens.
- **Ritanrop:** världen är ett vertexfärgat `MeshToonMaterial`-mesh + ett konturmesh (bakåtvänd,
  0,085 m större kopia per del) + dekor (+ kontur) + ett skuggmesh + lov-föremålen (6 × 2).
  Figurerna är en sprite var (egen textur = eget ritanrop) + en skylt var + **ett** instanserat
  skuggmesh. **Prestandasidan med 30 figurer på Mellan: 60–62 ritanrop** (gränsen är 150).
- **Nivåvakten gäller bara 3D.** I 2D-reserven mäts fps för `nivaInfo`, men nivån sänks inte och
  inget sparas i `localStorage` – reserven är redan sista steget.
- **Nivåerna:** Låg ×0,6 utan kontur och utan dekor (blommor, moln, stigen), Mellan ×1, Hög upp
  till skärmens `devicePixelRatio` (högst 2). "Färre träd" på Låg är **inte** gjort: träden är
  spelföremål (kollision, skydd, platsnamn) och får inte försvinna ur bilden; dekoren tas bort i
  stället. Sänkning efter 3 s under 24 fps med en rad till eleven; Låg under 15 fps i 3 s → 2D.
  Valet sparas i `localStorage` (`pp:kg:niva`) i try/catch.
- **2D-reserven** (`kg-2d.js`) delar karta, rörelse, kollision, skydd, interpolering, styrning
  och API med 3D – bara ritandet skiljer. Startar utan WebGL, vid `?2d=1`, om three inte kan
  laddas, eller när Låg ligger under 15 fps.
- **Avatarbilden:** `avatarMarkup` läggs i ett `<foreignObject>` med CSS-reglerna för
  `.avatar-figure`/`.af-*` ur sidans stilmallar (reserv: en inbyggd kopia av slot-måtten) och
  ritas till en 256 × 308-canvas. Kan webbläsaren inte rita foreignObject till canvas (Safari)
  ritas figuren utan kläder (`avatarSvg`) – aldrig tom.
- **Figurhöjd** 2,6 m (skissen hade 3,4) så att figurerna står i proportion till brunnen och ladan.
- Ingen kollision mellan figurer (spec §3). En sökare som går rakt in i kameran kan täcka bilden ett ögonblick.

### 9.4 Uppmätt på den här maskinen

Utvecklingsmaskinen saknar GPU: Chromium faller tillbaka på **SwiftShader (mjukvaru-WebGL)**, så
siffrorna säger inget om elevernas HP-datorer – bara att allt renderar och att ritanropen håller:

| Sida | Nivå | fps | Ritanrop |
| --- | --- | --- | --- |
| prestanda (30 figurer, elevvy 1366 × 768) | Mellan | **1–7** (SwiftShader) | **60–62** |
| scen (6 robotar, elevvy) | Mellan | 2 | 27–41 (med effekter) |
| scen 2D-reserven | Låg | 39–47 | – |

Den automatiska sänkningen gick här hela vägen Mellan → Låg → 2D inom ~8 s, vilket är avsett
beteende på en dator utan GPU. **Elias kör prestandasidan på elevernas HP-datorer** (spec §4.4) –
med inbyggd grafik förväntas Mellan ligga klart över 30 fps vid 60 ritanrop.

---

## 10. Servern (del C, #838)

Servern avgör allt som påverkar spelet (spec §5): rollerna, gömställena, rättningen,
visslingarna, sökningen, poängen och slutet. Klienten skriver **aldrig** i `kg*`-samlingarna
och i Realtime Database bara sin egen `pos`. Motorn är samma kod som klientens
(`functions/kurragomma/` = kopia av `delat/`, `npm run sync:kurragomma`; `sync:guldrush`-skriptet
skriver om importvägarna). Filerna:

| Fil | Innehåll |
| --- | --- |
| `functions/kurragomma-core.js` | `kgStarta`, `kgAnslut`, `kgLas`, `kgSvara`, `kgLeta` |
| `functions/kurragomma-fas.js` | starten (`startaIntern`), fasbytet (`bytTillLeta`), placering av olåsta, `redo` (lat fasbyte), `gorTillSokare` |
| `functions/kurragomma-tick.js` | `kgTick`: tystnaden, "alltid en sökare", städning, slutet |
| `functions/kurragomma-resultat.js` | `kgAvsluta`, `byggResultat` |
| `functions/kurragomma-vissling.js` | **visslingen** (E, #840): `visslingsHandelse` (händelsens form, delas med `kgSvara`), `visslaGomd` (tystnadsregeln och läraren – en transaktion + `hand` under vald nyckel), `kgLarareVissla` |
| `functions/kurragomma-sess.js` | sessionen, referenserna, tiderna, minnet per instans, behörigheten |
| `functions/kurragomma-rtdb.js` | Realtime Database via Admin SDK (`kgDatabaseUrl`) |
| `functions/index.js` | exporten (`kurragommaCall`, `KG_OPTS`: europe-west1, 512 MiB, 80 samtidiga, högst 4 instanser) |
| `firestore.rules` | `kgFormat`, `kgSettingsOk`, `kgSessionCreateOk/UpdateOk`, match `kg*`, `liveCoinPlayerOk` |
| `database.rules.json` | Realtime Database-reglerna (§10.4) |
| `src/live/formats/kurragomma/kg-kanal.js` | rörelsekanalen i klienten (§10.5) – inte att blanda ihop med `scen/kg-rorelse.js` (B: gåendet i scenen) |

### 10.1 Anropen (callables, `europe-west1`)

Alla kräver inloggning. **Lat fasbyte**: varje anrop kör `redo` först – startar matchen om
`kgFas` saknas (KÖR! har kommit), byter till letfasen när `kgGomSlut` passerats, och placerar
olåsta gömmare efter `kgGomSlut + LAS_MARGINAL_MS` (2 s). Fel kastas som `HttpsError`
(`failed-precondition`, `invalid-argument`, `not-found`, `permission-denied`, `resource-exhausted`), med
`details.skal` där klienten behöver skilja (`kgLeta`: `inte-sokare`, `ingen-laddning`, `sparr` + `vantaMs`,
`orimlig`, `utanfor`).

| Anrop | Vem | Gör | Svar |
| --- | --- | --- | --- |
| `kgStarta({ sid })` | läraren som styr matchen (admin: alla; årskurskonto: en egen klass) eller en deltagare | drar startsökarna (`antalStartsokare`, `valjSlumpade`), skriver `kgPlayers` + `kgSecret` för alla som gått med, `kgFas: "gom"`, `kgGomSlut = t0 + gomtid`, och `/kg/{sid}` (roll, med, pos för sökarna, status). Idempotent. | `{ fas, tider }` |
| `kgAnslut({ sid })` | deltagare (`players/{uid}` i en av sessionens klasser) | den som inte fanns vid starten får `rollVidAnslutning` (gömd i gömfasen, sökare i letfasen – en sen sökare får startpunkten `sokarStart`); läggs i `med`. | `{ roll, fas, laddningar, poang, ratt, besvarade, harLast, gomstalle, start, nextQ, hittadAvNamn, tider: { t0, gomSlut, letStart, slut }, inst, showNames }` |
| `kgLas({ sid, x, z })` | gömmare, i gömfasen (+ 2 s marginal) | `narmasteGiltiga` → `skydd` + `platsNamn`; skriver `kgSelf.gomstalle`, `kgSecret` (x, z, skydd, gomd, lastAt) och `kgPlayers.harLast`; `status.lasta` +1. Redan låst → samma gömställe tillbaka. | `{ gomstalle: { x, z, skydd, namn }, flyttad, redan }` |
| `kgSvara({ sid, attemptId, factorA, factorB, answer, choiceIndex?, q?, year? })` | deltagare, letfasen (en gömmare i gömfasen nekas; en sökare får ladda under blundandet) | rättas som kistspelen (`gradeMult`/`gradeQuiz`, `answers/{attemptId}` för statistiken, `pickNextQ`); `svarsEffekt` ger poäng/laddning/vissling. Vid vissling: `visslingsplats` (osäkerhet `VISSLING_OSAKERHET_M`), `platsNamn` på den ungefärliga platsen, `kgEvents` + `hand`. Samma `attemptId` igen → samma svar (`igen: true`). | `{ attemptId, correct, correctAnswer, nextQ, poang, laddningar, vissling, plats?, correctYear? }` |
| `kgLeta({ sid, x, z })` | sökare, letfasen | **en transaktion**: `kontrolleraSokning` (laddning, 2 s spärr, rimlighet från startpunkten/senaste sökningen), `sok` mot de gömda inom `maxSokradie` (kandidaterna ur instansens minne av gömställena, `gomstallenFor` – läses en gång per instans när `kgPlacerade` är satt; dessförinnan alla `kgSecret.gomd == true`; färska `kgSecret`/`kgPlayers` avgör, F #841), varje hittad blir sökare (`gorTillSokare`: `poangVidHittad`, `laddningarNySokare`, startpunkt = gömstället), sökaren får `poangForHittad` per hittad. Efteråt `nySokare` + `hittad`-händelser i RTDB; en miss ger `miss`-händelse högst var `FLODE_MISS_SPARR_MS`. | `{ hittade: [{ uid, namn, x, z, plats }], laddningar, poang, plats, flode }` |
| `kgTick({ sid })` | som `kgStarta` (projektorn var `TICK_MS` = 5 s; en deltagare får också) | letfasen: tystnadsregeln, "alltid en sökare", `hand`-städning; slutet (`arSlut`: tiden ute eller alla hittade) → `kgAvsluta` internt. | `{ fas, klart, visslade, nySokare, rensade }` eller `{ fas, klart: true, result, avslutade }` – `avslutade: true` bara i det anrop vars transaktion skrev `result` (klassbonusens engångsgate, §11.5); `kgAvsluta` svarar likadant |
| `kgAvsluta({ sid })` | läraren som styr matchen när som helst; en deltagare först när tiden är ute, alla är hittade eller matchen redan är avslutad | `status: "finished"` + `finishedAt`, `result` på sessionen (§10.3), `klar: true` + sluttotaler i `kgPlayers`, tar bort `/kg/{sid}`. Idempotent (`redan`). | `{ result, redan }` |
| `kgLarareVissla({ sid, uid })` (E, #840, §12.4) | **bara** läraren som styr matchen | visslar åt en gömd elev (`roll: "gomd"`, `kgSecret.gomd`) under letfasen – samma väg som tystnadsvisslingen (`visslaGomd`): `senastVisslingAt` (1,5× sökradie), `tystRef`, `tystVissling` = hand-nyckeln, `kgEvents` med `larare: true`, `hand` utan något som avslöjar. Inte gömd/fel fas → `failed-precondition`; elev → `permission-denied`; samma elev inom `LARARE_VISSLA_SPARR_MS` → `resource-exhausted` (`details.skal: "sparr"`, `vantaMs`). `VISSLING_SPARR_MS` gäller inte. | `{ visslade: true, plats }` |

### 10.2 Datamodellen i Firestore (spec §5.1)

Tider lagras som **ms-tal på serverns klocka**, utom `kgGomSlut`/`kgLetStart` (Timestamp, som
kärnans `startedAt`). `letStart = kgGomSlut` (inte tiden då fasbytet råkade köras).

- **Sessionen** (`liveSessions/{sid}`): kärnans fält + `kgInstallningar { gomtid, startsokare, tystnad, karta }`
  (läraren), och serverns `kgFas` (`"gom"` | `"leta"`), `kgGomSlut`, `kgLetStart`, `kgPlacerade`
  (olåsta placerade), `kgNySokareAt` (spärren för "alltid en sökare", §10.9), `result`. Reglerna (`kgSettingsOk`): 1–4 klasser, `gomtid ∈ {20,30,45,60}`,
  `karta == "on"`, `durationSeconds − gomtid` = 60–3600 s och delbart med 60, `showNames` valfri bool.
- **`kgPlayers/{uid}`** (eleven läser sitt eget, läraren/projektorn alla): `uid, classId, name, roll,
  poang, ratt, besvarade, hittade, laddningar, harLast, senastSvarAt, sokareSedan, nextQ`; gömda har
  `tystRef` (tystnadsregelns referens – tas bort när de blir sökare) och `tystVissling` (hand-nyckeln för den senaste
  tystnads- **eller lärarvisslingen** – sätts bara när servern visslade, så eleven känner igen sin egen vissling på id:t); `autoPlacerad` (placerad av servern);
  `hittadAv, hittadAvNamn, hittadAt` eller `nySokareAt` ("Ny sökare"); efter slutet `klar: true`,
  `klaradeSig` och slutpoängen. Pluggmyntskvittot får högst `perCorrect × ratt`.
- **`kgSelf/{uid}`** (bara eleven själv): `gomstalle { x, z, skydd, namn }` (sätts av `kgLas`).
- **`kgSecret/{uid}`** (ingen klient, inte ens läraren): `x, z, skydd, gomd, lastAt, auto`
  (gömstället), `senastVisslingAt`, `larareVisslaAt` (lärarens spamskydd, E), `startpunkt { x, z, at }` och
  `senasteSok { x, z, at }` (sökaren), `senastMissFlodeAt`.
- **`kgEvents/{id}`** (bara lärare – historiken): `{ t, typ: "vissling" | "hittad" | "nySokare", x, z, plats,
  tyst?, larare?, sokare?, hittad? }`. Visslingens `x, z` är den **ungefärliga** platsen. `larare: true` = utlöst av
  läraren (E) – markeringen finns **bara** här (historiken räknar den, §12.2), aldrig i `hand` eller `result`.
- **`kgPublic/questions`, `kgPrivate/snapshot`**: quizet, som i Guldrushen (`kistQuizDocCreate`).
- Kärnans `players/{uid}` (närvaropulsen `lastSeenAt`) och `answers/{attemptId}` (statistiken) används som
  i de andra kistspelen.

### 10.3 Resultatet (`result`, spec §10–§11.2)

```
{ format: "kurragomma", winner: null, draw: false, startMs, letStartMs, slutMs,
  players,                                           // deltagare: svarat, låst eller hittat (deltog, E §12.3)
  totalCorrect, totalAnswered, klaradeSig, hittade, visslingar,
  flestHittade: { uid, name, antal } | null,
  ranking: [{ uid, name, classId, poang, ratt, besvarade, hittade, roll, klaradeSig, rank }],
  gomstallen: [{ uid, x, z, skydd, namn, hittad }],   // exakta platser – matchen är slut
  perQuestion: [...],                                 // fragestatistik (meteorstorm-resultat.js)
  rewards?: { ... } }                                 // som live-rewards: meteorstorm-mynt.js
```

`poang` i rankingen är slutpoängen inklusive `poangGomdVidSlut` för dem som klarade sig; `rank` =
`placering` (delad). `rewards` räknas på servern ur `rewardRader(rader.filter(deltog))` och kvittona skrivs av klienten
(`withRewards`, regeln `liveCoinPlayerOk` kontrollerar mot `kgPlayers.ratt` och att eleven deltog – §12.3).

### 10.4 Realtime Database (`/kg/{sid}`, spec §5.3)

| Väg | Skrivs av | Innehåll |
| --- | --- | --- |
| `roll/{uid}` | servern | `"sokare"` för sökarna (gömda saknas – rollen går inte att läsa ut) |
| `med/{uid}` | servern | `true` för alla som gått med (läsrätten) |
| `pos/{uid}` | **sökaren själv** (reglerna: `roll/{uid} == "sokare"`, exakt `x, z, yaw, t`, ±40 m, yaw ±7, `t` ±2 min); att **ta bort sin egen** pos får alla (`onDisconnect().remove()` och `stang()`); servern skriver den **första** posten (`yaw: 0`) för varje ny sökare, och sätter om startsökarnas `t` vid letfasens början | positionen – också pulsen för "alltid en sökare" |
| `hand/{autoId}` | servern | `{ typ: "vissling" \| "hittad" \| "miss" \| "nySokare", x, z, plats, t, namn?, hittad? }` – `namn` = sökaren (`hittad`, `miss`, `nySokare`: den nya sökaren), `hittad` = den hittades namn; båda enligt `showNames`. **Visslingen bär aldrig namn eller uid.** Fält som är null **saknas** i RTDB. Rensas efter `HAND_RENSA_MS` (60 s) av `kgTick`; klienten ignorerar händelser äldre än `HAND_MAX_ALDER_MS` (10 s). `.indexOn: t`. |
| `status` | servern | `{ fas, lasta, gomda, sokare }` (räknare med `ServerValue.increment`) |

Läsa `roll`, `med`, `pos`, `hand`, `status`: den som står i `med/{uid}` eller ett konto med
Auth-claimet `teacher` (projektorn). Utloggad nekas allt. `kgAvsluta` tar bort hela `/kg/{sid}`.
Databasen i prod: instansen `pluggportalen-so-2026-default-rtdb` i **europe-west1**,
`https://pluggportalen-so-2026-default-rtdb.europe-west1.firebasedatabase.app` (reglerna är låsta tills
`database.rules.json` deployats). Klienten använder den adressen (`KG_DATABASE_URL` i `kg-kanal.js`) och
servern når den med Admin SDK via `kgDatabaseUrl()`: `KG_DATABASE_URL` (functions/.env, bara som reserv)
→ i emulatorn `http://{FIREBASE_DATABASE_EMULATOR_HOST}/?ns={projekt}-default-rtdb` (namnrymden som
`firebase emulators` laddar `database.rules.json` i) → `FIREBASE_CONFIG.databaseURL` →
`https://{projekt}-default-rtdb.europe-west1.firebasedatabase.app` (= prod-adressen). Testerna kör mot emulatorn.

### 10.5 Rörelsekanalen i klienten (`kg-kanal.js`)

`skapaRorelsekanal({ sid, uid, lage: "rtdb" | "lokal", app, url?, sdk?, buss?, nu? })` →
`{ start(), skickaPos({ x, z, yaw }) → bool, paPos(cb), paHandelse(cb), paStatus(cb), stang() }`.

- **rtdb**: SDK:n (`firebase-database.js`, samma gstatic-källa och version som appens övriga
  Firebase-moduler) laddas med `import()` först i `start()` – bootgrafen rörs inte. `start()` skriver
  inget (gömmare och projektor saknar skrivrätt); det **första** `skickaPos` armerar `onDisconnect().remove()`
  på egen `pos`, så även den som blir sökare mitt i matchen får sin pos städad; ett onDisconnect gäller bara
  den anslutningen, så det armeras om varje gång `.info/connected` blir sann igen (nätavbrott – annars blir
  nästa avbrott en frusen figur för de andra). Klockan: kanalen lyssnar på
  `.info/serverTimeOffset` och skriver `t` samt räknar åldersgränsen på **serverns** klocka – en elevdator
  som går fel sparkar inte bort händelserna. `hand` lyssnas med `limitToLast(HAND_LIMIT)` och händelser äldre än
  `HAND_MAX_ALDER_MS` ignoreras. `skickaPos` följer `skapaPosFilter`: högst var `POS_MIN_INTERVALL_MS`
  (3/s), bara vid flytt ≥ `POS_MIN_FLYTT_M` eller vridning ≥ `POS_MIN_VRID_RAD` – men **minst var
  `POS_PULS_MS`** (10 s) så att pulsen för "alltid en sökare" hålls vid liv när sökaren står still.
- **lokal**: `skapaLokalBuss({ nu })` → `{ kanalFor(uid), server: { roll, med, handelse, status, pos } }` –
  demolägets "server" (D) skriver via `buss.server`, varje robot/elev har sin `kanalFor(uid)`.
  Samma gränssnitt, samma filter.

### 10.6 Matchklockan (spec §0.1)

Ingen kärnändring. `buildSessionDoc` (`live-core.js`) sätter `durationSeconds` ur `durationMin` och sprider
**sedan** formatets `buildSessionFields`, så Kurragömma sätter `durationSeconds = matchSekunder({ gomtid, speltidMin })`
själv (E). Kärnans klocka (`sessionTimes`, `phaseAt`, `endsAt`) täcker då gömfasen + letfasen.
`test/live-kurragomma-klocka.test.js` visar det för ett Kurragömma-likt format och att Klassmatchens,
Guldrushens och Meteorstormens klocka är oförändrad.

### 10.7 Deployordning

Realtime Database finns redan i prod (`pluggportalen-so-2026-default-rtdb`, europe-west1, §10.4) –
den skapas inte igen.

1. `firebase deploy --only firestore:rules,database` (Firestore-grenen + `database.rules.json` – låser upp RTDB).
2. `firebase deploy --only functions:kgStarta,functions:kgAnslut,functions:kgLas,functions:kgSvara,functions:kgLeta,functions:kgTick,functions:kgAvsluta,functions:kgLarareVissla` (E: `kgLarareVissla` är ny, `kgTick`/`kgSvara`/`kgAvsluta` ändrade).
3. Index: inga nya (`kgPlayers`-frågorna är enfältsfrågor; `hand`-indexet ligger i `database.rules.json`).
4. Webben (B/D/E) sist.

Reserv: pekar `FIREBASE_CONFIG.databaseURL` i prod på fel instans, sätt
`KG_DATABASE_URL=https://pluggportalen-so-2026-default-rtdb.europe-west1.firebasedatabase.app` i `functions/.env`.

### 10.8 Kvoten – uppskattning för 10 min och 25 elever (spec §5.5)

Antaganden: ~1 000 svar (25 elever × ~8 s per fråga, men inte alla svarar hela tiden), ~100 sökningar,
120 ticks (var 5:e s), 20 gömda som mest, sessionen skrivs ~5 gånger (start, letfas, placering,
slut, resultat) och alla 25 lyssnar på den. Sessionen och quizet ligger i serverns minne (5 s TTL).

| Del | Läsningar före | Läsningar nu | Skrivningar |
| --- | --- | --- | --- |
| `kgSvara` 1 000 × (kgPlayers; kgSecret bara för gömmare ~60 %; svaret läses inte i förväg – `tx.create` fäller ett upprepat attemptId och först då läses det) | ~3 000 | ~1 600 | ~2 300 |
| `kgLeta` ~500 × (kgPlayers + kgSecret + kandidater inom 3 m ur minnet ~0–2; +1 per hittad) + gömställena 1 × ~20 per instans (F #841; förr alla gömda ~15 per sökning = 4 600–15 000 uppmätt) | ~1 800 | ~1 500 | ~700 |
| `kgTick` 120 × (räknefråga 1 + tystnadsfråga 1 (oftast 0 träffar) + ~2 kandidater × 4: puls + kgSecret, sedan båda igen i transaktionen) | ~900 | ~1 200 | ~150 |
| Sessionen i serverns minne: 5 s TTL, en läsning per instans och TTL-fönster – 120 per instans, upp till 4 instanser | ~120 | ~120–480 | – |
| `kgStarta`/`kgAnslut` 25–50 × ~3 (spelarna och quizet ligger i minnet) | ~150 | ~150 | ~110 |
| `kgAvsluta` (kgPlayers 25, kgSecret 25, kgEvents ~150, **answers ~1 000** för `perQuestion`) | ~1 200 | ~1 200 | ~30 |
| Klientlyssnare: sessionen 6 × 25, eget `kgPlayers` ~1 200, `kgSelf` 25 (projektorn lyssnar **inte** på `kgPlayers` – §5.5; ställningen kommer ur RTDB `status` och `hand`) | ~2 700 | ~1 400 | – |
| **Summa Firestore** | **≈ 9 900** | **≈ 7 500–7 800** | **≈ 2 900** |

"Före" = första versionen (svaret och kgSecret lästes i varje `kgSvara`, projektorn lyssnade på `kgPlayers`).
Nu ligger uppskattningen under §5.5:s 8 000, men marginalen är bara ~200–500 läsningar och beror på hur
många instanser som är varma och hur många tysta kandidater tystnadsfrågan ger (en tyst gömmare kostar
4 läsningar per 45 s, en som svarar inget). Det är en räkning, inte en mätning: slut-QA (F, #841) mäter.
Nästa besparing om den landar över: räkna `perQuestion` ur en liten aggregering som `kgSvara` uppdaterar i
stället för att läsa `answers` vid slutet (−1 000).

Realtime Database: `pos` – i snitt ~8 sökare × ≤ 2 skrivningar/s (filtret) × 600 s ≈ 10 000 skrivningar
à ~60 B, var och en till ~25 lyssnare ≈ **15 MB** nedladdning; `hand` ~200 händelser × 25 × ~120 B ≈ 0,6 MB;
`status` försumbart. Serverns tick-läsning (`roll` + `pos`) ≈ 120 × 1 kB. Totalt under 20 MB per match –
gratisnivån (10 GB/mån) räcker för hundratals matcher. Slut-QA mäter.

### 10.9 Antaganden och beslut (del C)

- **Lat fasbyte överallt**: `kgTick` behövs inte för att matchen ska gå framåt, bara för tystnaden,
  "alltid en sökare", städningen och slutet. Därför får även en deltagare anropa `kgStarta`/`kgTick` (§8 fråga 5).
- **Låsning tas emot till `kgGomSlut + LAS_MARGINAL_MS`** (2 s); olåsta placeras av servern först efter
  marginalen (`kgPlacerade` på sessionen hindrar att frågan körs igen).
- **Tystnadsregeln** frågar på `kgPlayers.tystRef` (bara gömda har fältet; svar, vissling och letfasens
  början flyttar fram det). En frånkopplad kandidat får `tystRef = nu` och prövas igen efter 45 s.
  Pulsen är kärnans `players.lastSeenAt`.
- **"Alltid en sökare" läser RTDB `pos.t`** – inga Firestore-läsningar. Servern skriver första `pos` för varje
  ny sökare och sätter om startsökarnas `pos.t` vid letfasens början; klienten pulsar minst var
  `POS_PULS_MS`. Den som blir "Ny sökare" får överlevnadspoäng som om hittad nu. Pulserna läses utanför
  transaktionen, så sessionens `kgNySokareAt` sätts i transaktionen och spärrar samtidiga ticks: en ny
  sökare räknas som vid liv i `FRANKOPPLAD_MS` (30 s) innan regeln får slå till igen.
- **Hittad/nySokare-händelsen bär gömställets plats** (eleven är nu sökare, platsen är inte längre hemlig)
  och namn enligt `showNames`; visslingen aldrig namn (§8 fråga 6).
- **`rewards` räknas på servern** (`meteorstorm-mynt.js`), `rank` = `placering` (delad).
- **Gömtiden är högst 60 s** (`GOMTIDER_S`), så fasbytet kommer tidigt; e2e-testet skapar matchen i
  gömfasen i samma test som använder den.
- **Ingen kärnändring för klockan** (§10.6).

### 10.10 Testerna (spec §13.2–§13.3)

| Fil | Kör | Visar |
| --- | --- | --- |
| `test/functions-kurragomma-core.test.mjs` | `test:functions` | starta/anslut/lås/svara med styrd klocka och slump (13) |
| `test/functions-kurragomma-leta.test.mjs` | `test:functions` | sökning, fasbyte, placering, tick, avslut (12) |
| `test/functions-kurragomma.test.mjs` | `test:functions` | e2e genom callables, Auth, Firestore- och RTDB-reglerna (5) |
| `test/functions-kurragomma-tester-838.test.mjs` | `test:functions` | testarens: samtidiga kgTick/kgStarta/kgLeta/kgAvsluta, visslingen med riktig slump |
| `test/functions-kurragomma-vissla.test.mjs` | `test:functions` | E: `kgLarareVissla` (behörighet, bara gömd, bara letfasen, identisk händelse, id-matchning, spamskydd, `VISSLING_SPARR_MS` spärrar inte, statistiken) + pluggmynt åt gömd utan svar (§12) |
| `test/firestore-rules-live-kurragomma-840.test.js` | `test:rules` | E: formulärets sessionsdokument släpps igenom; kvittot för deltagare utan svar (låst/hittat), nekat för den som inte deltog; "varav lärarens" (F1): eleven nekas kgEvents och räknefrågan, läraren räknar |
| `test/live-kurragomma-larare.test.js` | `node --test` | E: formulärets fält → `kgInstallningar`, `deltog`, historiken, Vissla-panelens logik, filkraven |
| `test/firestore-rules-live-kurragomma.test.js` | `test:rules` | Firestore-grenen (§5.4) |
| `test/firestore-rules-live-kurragomma-tester-838.test.js` | `test:rules` | testarens: hemligheten i Firestore-reglerna |
| `test/rtdb-rules-kurragomma.test.js` | `test:rules:rtdb` | `database.rules.json` (§5.3) |
| `test/rtdb-rules-kurragomma-tester-838.test.js` | `test:rules:rtdb` | testarens: den riktiga kanalen (modulära SDK:n) mot reglerna |
| `test/live-kurragomma-kanal.test.js` | `node --test` | `skapaPosFilter`, lokal buss, rtdb-kanalen mot en SDK-stub, serverklockan (12) |
| `test/live-kurragomma-klocka.test.js` | `node --test` | matchklockan (§10.6) |

Emulatorerna (functions, auth, firestore, **database**) startas av `npm run test:functions`;
`firebase.json` har `emulators.database` på port 9000 och `database.rules` → `database.rules.json`.
## 11. Projektorn, elevskärmen och demot (del D, #839)

D kopplar ihop motorn (A), scenen (B) och servern (C) till ett spelbart Live-format.
Formatet är registrerat sist i `src/live/formats/index.js`; bootgrafen når bara
`index.js`, `kg-setup.js`, `kg-avslut.js` och `delat/` – allt med DOM, Firebase, scen eller
rörelsekanal laddas med `import()` (`projectorViews`/`studentView`/`historyRenderer`).

### 11.1 Filerna

| Fil | Innehåll |
| --- | --- |
| `index.js` | format-objektet (spec §0.1): 🙈, `inom-klass` 1–1, free + choice, tidslinje, pacing `tid`, `music` (`assets/kurragomma-loop.ogg` – **filen levereras separat**; saknas den är formatet tyst, proj-music sväljer 404), `emitOnPlayers`, `resultInputs`/`buildResult` |
| `kg-setup.js` | speltid 3/5/10/15/20/30 + Egen 1–60 (standard 10, ledtexten rekommenderar 8), gömtid, startsökare, tystnad, karta (E, §12.1) → `kgInstallningar`, namn i flödet, `durationSeconds = gömtid + speltid` (§10.6), quiz-dokumenten, `computeStandings` |
| `kg-avslut.js` | `resultInputs` = `kgAvsluta` (med två nya försök) → `settleLiveRewards` bara när `result.rewards` finns; `s.demo` betalar aldrig; klasscentret som Meteorstormen |
| `kurragomma-data.js` | callables (`europe-west1`), `getQuestions`, `watchMe` (eget `kgPlayers`), `kanal()` = `kg-kanal.js` i rtdb-läge mot prod-instansen (`KG_DATABASE_URL`) – `globalThis.__PP_RTDB_URL`/`__PP_RTDB_EMULATOR` i QA |
| `kurragomma-projector.js` | `views` = [🙈 Ön (`finale: true`)], `createLobby`, `createWinner`, `ownTimer` |
| `kgp-on.js` | huvudvyn: toppraden, scenen (projektorläge), händelseflödet (≤ 4 rader), effekter + ljud, `kgStarta` efter KÖR! och `kgTick` var 5 s (bara projektorn, aldrig elevskärmsfönstret), finalen |
| `kgp-logik.js` | ren: `toppText`, `flodesRad`, `finalModell`, `lobbyPlatser`, `FINAL_TITLE`, `LOBBY_TEXT`, `minutKvar` |
| `kgp-ljud.js` | riktad vissling (`StereoPannerNode` + volym efter plats i bilden, `visslingPan` ren), pling, gömfasens slut, ny sökare, fanfar; ducking bara när effekten hördes |
| `kgp-final.js` | finalen i tre steg: lugn rad → pall → gömställena på kartan (`scen.gomstallen`) |
| `kgp-lobby.js` | lobbyn: ön + en figur per ansluten elev på stranden vid bron, förklaringen, STARTA |
| `kurragomma-projektor.css` | `kgp-*`, enheten `--kgp-u` = bredd/1920 |
| `kurragomma-student.js` | elevens koppling: `createStage` → `kge-elev-vy.js` med callables, `serverNow`, avatar-roster, pluggmynt-uppdatering |
| `kge-elev-vy.js` | elevens spelyta utan Firebase (api injiceras): faserna, 🔒 Lås, auto-lås vid 0:00, hittad-rutan (≤ 2 s), sessionStorage för platsen, reserv-avsluta |
| `kge-spel.js` | `createQuestionFlow` (kistspelet, återanvänd) med `kgSvara` som `send`, sökningen med 2 s spärr, rörelsekanalen → scenen, hjärtslaget |
| `kge-logik.js` | ren: texterna, `elevLage`, `laddningarHtml` (SVG), `startplats`, `sparaPos`/`lasPos`, `letaTangent`, `panelLage` |
| `kge-skarmar.js` | lobby- och slutskärmens HTML (ingen placering som nummer utanför pallen) |
| `kurragomma-elev.css` | `kge-*`, frågepanelen till höger över 1100 px, annars ett hopfällbart kort längst ned |
| `kurragomma-history.js` | historiken och Statistik → Live (E, §12.2) + `kurragomma-historik.css` (`kgh-*`) |
| `kgp-vissla.js` | lärarens Vissla-panel (E, §12.4), laddas lätt av `kgp-on.js` i lärarens fönster |
| `kg-demo.js`, `kg-demo-server.js`, `kg-demo-robotar.js`, `kg-demo-resultat.js` | demoläget (§11.4) |

### 11.2 Faserna som vyerna ser dem

- **Lobby** – projektorn: ön roterar, figurer på stranden, "N elever redo", STARTA; elevskärmen: kärnans lobby + förklaringen. Tyst.
- **KÖR!** – kärnans 3-2-1. Projektorn anropar `kgStarta` när `phase === "live"`; elevskärmen monterar spelytan och `kgAnslut` ger roll, fas, tider, gömställe.
- **Gömfasen** – toppraden "Göm: 0:24" · "Låsta 12/21" (RTDB `status`); musiken sänks till hälften (`music.skala(0.5)`). Eleven: gömmare går (platsen sparas i `sessionStorage` `pp:kg:pos:{sid}`, aldrig på servern) och låser; vid 0:00 skickas platsen automatiskt (`LAS_MARGINAL_MS`). Sökare: täckt skärm "🙈 Du blundar – räkna till N!" + frågor som laddar lampan.
- **Letfasen** – fasbytet kommer ur RTDB `status.fas` eller klientklockan (gömslut + `LAS_MARGINAL_MS` + 0,5 s). Projektorn: klockan · "Gömda 14 · Sökare 6", visslingar (ringar + riktat ljud, aldrig namn), hittade (konfetti, pling), missar, "1 minut kvar!". Eleven: frågor; gömd → poäng/egen vissling/"Det visslar vid …"/hjärtslag; sökare → tre ficklampor, 🔦 Leta (mellanslag/E, 2 s spärr), pil mot senaste visslingen. Hittad → ruta ≤ 2 s → sökare från gömstället (rollbytet kommer ur det egna `kgPlayers`).
- **Slutet** – 00:00/alla hittade (`kgTick` → `kgAvsluta` på servern) eller Avsluta-knappen → kärnan `status finished` → `resultInputs` → `kgAvsluta` + `settleLiveRewards`. Finalen: lugn rad → "🏆 Kurragömma – Prispall" (pallen utan tomma platser, mynt under) → gömställena på kartan ur `result.gomstallen`. Eleven: slutskärmen ur samma `result`.

### 11.3 Ljud och musik (spec §8)

Bara projektorn låter. Visslingen pannas efter var platsen syns i bilden (`scen.skarm(p)` →
`visslingPan`): vänster/höger, svagare mot kanten och utanför bilden, speglad bakom kameran.
Musiken är `format.music` (🎵-knappen är skalets), tyst i lobbyn, 30 % i matchen, 15 % under
gömfasen, ducking bara när en effekt faktiskt hördes. Utan `assets/kurragomma-loop.ogg` är det tyst.

### 11.4 Demoläget (spec §11.4, LIVE-FORMAT §8)

`createKgDemo()` är en hel match i minnet: 30 påhittade elever (Snilleblixtens demonamn),
en **låtsasserver** (`kg-demo-server.js`) som fattar samma beslut som `functions/kurragomma-*.js`
med de riktiga reglerna i `delat/`, **robotar** (`kg-demo-robotar.js`) som går till ett gömställe nära
ett föremål och låser, svarar rätt/fel (fel → vissling), vandrar som sökare mot visslingar och letar,
och den **lokala rörelsekanalen** (`skapaLokalBuss`). Resultatet byggs som serverns
(`kg-demo-resultat.js`, med `result.rewards`) men sessionen är `demo: true` – ingenting betalas,
ingen Firestore, inga Cloud Functions, ingen RTDB (sidorna blockerar och räknar varje försök).

- `preview/preview-kurragomma-demo.html` – projektorn (`mountProjector` med `demo.deps`): lobby/gömfas/letfas/final, namn av, 2D-reserven, knappar för varje moment i §11.4 (vissling, sökning, hittad, tystnad, "sökarna borta" → ny sökare, 1 min kvar, alla hittade, tiden ute).
- `preview/preview-kurragomma-elev.html` – elevskärmen (`createKgStage` med `demo.api`): `?roll=sokare`, `?2d=1`, `?svar=choice`, `?quiz=1`; svara/lås/leta/bli hittad.
- `preview/preview-kurragomma-demolage.html` – **kopplat demo**: projektorn och elevskärmen i samma match (elevsidan skapar demot i `parent.__kgKoppling`, projektorn läser det). `?roll=sokare`, `?2d=1`, `?elev=380`.

### 11.5 Val och avvikelser (del D)

- **Scenen ligger under toppraden i DOM:en** (`.kgp-scen { top: var(--kgp-topp) }`), inte bakom – ingen effekt kan täcka raden (§0.2). Finalen ritas i samma yta.
- **Projektorn lyssnar inte på `kgPlayers`/`kgEvents`** under matchen (§5.5): siffrorna kommer ur RTDB `status`, händelserna ur `hand`. Hittad-beskedet till den hittade går via det egna `kgPlayers` (`watchMe`), eftersom `hand` bär namn men inte uid.
- **Skriv själv** (`fast-answer.js`) håller fokus i svarsfältet permanent. Sökaren går därför med klick på marken/joystick/drag (scenens styrning) – pilarna/WASD går inte när fältet har fokus. Mellanslag och E letar även med fokus i fältet (siffrorna rörs inte); E i ett annat textfält lämnas i fred.
- **Kärnändringar**: `proj-music.js` fick `music.skala(k)` (vyns faktor på matchnivån, nollställs vid `load`) och `projector.js` ger vyerna `music` i `create`-opts; `scen/kg-scen.js` fick `scen.skarm(p)` (B:s fil) för det riktade ljudet. Inget annat i kärnan rördes.
- **Speltidens standard är 10 min** (kistspelens fält) med rekommendationen 8 min i ledtexten tills E bygger lärarformulärets egna fält; `kgInstallningar` får standardvärden ur `kg-config.js`.
- **Demots "Tystnad"-knapp** flyttar bara den valda gömmarens tystnadsreferens – inte letfasens start – så exakt en visslar.
- **Musikfilen** `assets/kurragomma-loop.ogg` finns inte i repot; formatet behöver bara filen på plats.
- **Pluggmynten när servern avslutar matchen** (00:00 / alla hittade via `kgTick` → `kgAvsluta`): servern skriver `finished` + `result` i samma transaktion, så kärnans `resultInputs`-väg (bara när `result` saknas) körs aldrig. Projektorn (`kgp-on.js betala()`, inte elevskärmsfönstret) anropar då `avslutaOchBetala` en gång – `kgAvsluta` svarar `redan`, `settleLiveRewards` är idempotent via `coinReceipts/{uid}`, så dubbel utbetalning är omöjlig. **Klassbonusen** (`liveKlassBonus`, ökar klassens EXP – inte idempotent) betalas som i Meteorstormen bara av den som AVSLUTADE: `kgAvsluta` med `redan === false` (Avsluta-knappen) eller projektorn vars eget `kgTick` avslutade matchen (svaret `avslutade: true`). Engångsgaten är `result`-skrivningen själv: `kgTick`/`kgAvsluta` svarar `avslutade: true` enbart i det anrop vars transaktion skrev `result`, alla andra (andra projektorflikar, tick + Avsluta samtidigt, omladdning, historiken) får `false`/`redan` – samma mönster som pluggmyntkvittot, fast kvittot är `result` och skrivs av servern, så ingen klientskrivning och ingen regeländring behövs. Snapshoten med `result` når projektorn före tick-svaret (servern städar RTDB först), så `betala()` väntar in den pågående ticken innan utbetalningen avgör om bonusen ska med. Kurragömmas `result` saknar `perClass` (en klass), så `kg-avslut.js medPerClass` bygger det ur sessionen (`{ classId: { name, players } }`) – bara deltagarbonusen "live", ingen vinstbonus (`winner: null`). Är projektorn stängd vid slutet (en elevs `kgTick` avslutar) går klassbonusen förlorad – som Meteorstormens elevavslut (§8.9).
- **Återanslutning till RTDB** (`kg-kanal.js`): `connectDatabaseEmulator` körs en gång per db-instans (WeakSet); projektorn försöker starta om rörelsekanalen efter 4 s vid fel. Ingen kärnändring.
- **Egen vissling (tystnadsregeln)**: visslingen i `hand` bär aldrig uid, så eleven känner igen sin egen på händelsens **id**: ticken väljer hand-nyckeln i förväg (`rt.handelseId`) och skriver den i den visslades `kgPlayers.tystVissling` i samma transaktion som visslingen – bara i visslingsgrenen (`tystRef` duger inte: den flyttas även utan vissling, och tidsstämplar delas av alla kandidater i en tick, N1b). Referensen ensam visar inget: raden "Det visslade där du gömmer dig!" (`TEXT.tystVissling`, neutral – samma vid lärarens vissling, #840 F2) och hoppet kommer först när hand-visslingen med exakt samma id finns (`kge-logik.js egenVisslingsReferens` + `skapaEgenVisslingar`, i valfri ordning, en gång). Händelsen avslöjar fortfarande ingen: id:t är en slumpnyckel. Fel svar ger "Fel svar – det visslade där du gömmer dig!" direkt ur kgSvara-svaret.
- **Sökare som står stilla** pulsar sin plats var `POS_PULS_MS` (kge-spel.js) så servern inte befordrar en ny sökare var 30 s.
- **Elevskärmsfönstret** (`&skarm=elev`) kör kärnans `resultInputs`-flöde som alla lärarfeeds, men Kurragömmas `resultInputs` ser fönstret (`arElevskarmsfonster`) och varken anropar `kgAvsluta` eller betalar där – det väntar in `result` (`vantaPaResult`, högst 60 s) som projektorn/servern skriver (N9). Ingen kärnändring.
- **Omladdning i finalen**: projektorns scen laddas asynkront, så finalen får scenen som getter och `scenKlar()` ritar gömställena när scenen (eller återanslutningen) är klar (N8). **Egen vissling-raden** står kvar hela `VISSLING_RAD_MS` även om andras visslingar ur samma tick kommer strax efter (`radFarBytas`, N7).
- **Lobbyrutan** (`.kgp-lobbyruta`) ligger på den sida av bilden där bron och figurerna på stranden inte är (`lobbyrutaSida`, kontrolleras varje sekund eftersom ön roterar). **Finalen** gör pallen till en kompakt lista i vänstra hörnet vid steg 3 (`.kgp-karta-visas`: en rad per elev – medalj · namn · poäng · mynt, delad plats = flera rader, namn ≈ 31 px på 1280×720) så ön med gömställena syns; "Här var alla gömda" står i nederkanten.
- **Elevskärmens kort** (under 1100 px, t.ex. 1366×768 med sidomenyn): kortet är högst 52 % av ytan (`52cqh` – `minmax(auto, 46 %)` gav ingen gräns eftersom min vinner över max) och fast-answer skalas ned i kortet; i sidopanelen skalas frågan efter panelens bredd (`cqi`) i stället för viewporten.

### 11.6 Testerna (spec §13.4)

| Fil | Täcker |
| --- | --- |
| `test/live-kurragomma-format.test.js` | registreringen, sessionsdokumentet (gömtid + speltid), avslutet (settle bara med rewards, demo betalar aldrig, nya försök), toppraden, flödet (namn av → "Någon", visslingen aldrig med namn), finalen (exakt rubrik, pall utan tomma platser), lobbyplatserna inom ön, det riktade ljudet, elevens texter/lägen/sessionStorage/tangenter, ≤ 400 rader, inga Emoji 13+, bootgrafen |
| `test/live-kurragomma-demo.test.js` | en hel match i node: 30 ansluter, KÖR!, låsning, fasbyte, fel svar → vissling utan namn/uid, leta → hittad → sökare (`watchMe`), tystnadsregeln, "alltid en sökare", alla hittade/tiden ute → result + rewards; låtsasserverns fel; isoleringen |
| `test/live-music.test.js` | `musicTarget` med `skala` |
| `test/live-formats.test.js`, `test/live-kurragomma-scen.test.js` | bootgrafen (formatet + three nås inte statiskt), 2D-reserven utan WebGL |

Verifierat i webbläsaren (headless Chromium): projektorn 1920×1080 och 1280×720 (toppraden täcks aldrig av scen,
flöde eller final), elevskärmen 1366×768 (panel till höger) och 380 px (hopfällbart kort), det kopplade demot
lobby → KÖR! → gömfas → letfas (vissling från elevens fel svar syns i projektorns flöde) → hittad → final.

---

## 12. Lärarformulär, historik, mynt och lärarens vissling (del E, #840)

E gör Kurragömma komplett som Live-format enligt LIVE-FORMAT §2, §6 och §10, och lägger till
lärarens vissling (nytt krav från Elias 2026-11-11). Inga ändringar i 3D-scenen eller i
projektorns/elevskärmens spelvyer utöver Vissla-panelen (§12.4).

### 12.1 Lärarformuläret (spec §0.2, §9)

Fälten ritas generiskt av `live-setup-fields.js` ur `KURRAGOMMA.setupFields` (`kg-setup.js`):

| Fält | Nyckel | Sort | Värden | Standard |
| --- | --- | --- | --- | --- |
| Speltid | `durationMin` | chips + Egen tid | 3/5/10/15/20/30 min, Egen 1–60 (`SPELTIDER_MIN`, `SPELTID_EGEN_MIN`) | 10 (ledtexten rekommenderar 8 – 8 är ingen snabbknapp enligt specen, så det står i ledtexten) |
| Gömtid | `gomtid` | chips | 20/30/45/60 s (`GOMTIDER_S`) | 30 |
| Startsökare | `startsokare` | chips | Auto, 1–4 (strängar i formuläret – `normInstallningar` gör tal) | Auto |
| Tystnadsregeln | `tystnad` | kryssruta | på/av | på |
| Karta | `karta` | chips | bara Ön (`KARTOR`) – fältet finns så fler kartor kan läggas till | Ön |
| Namn i händelseflödet | `showNames` | kryssruta | | på |
| Pluggmynt | `rewards` | live-rewards | | |

Frågorna (spelläge, svarssätt, quizområde, tidslinjefrågor) är kärnans steg – samma källor som
Guldrushen (`KG_MODES`). `buildSessionFields` → `installningarUr(input)`: fälten vinner över ett
färdigt `input.kgInstallningar` (äldre anropare/tester), allt normaliseras med `normInstallningar`,
och `durationSeconds = matchSekunder({ gomtid, speltidMin })` (§10.6). Servern läser
`kgInstallningar` (`instFor`) – gömtid i `kgStarta`, startsökare i dragningen, tystnad i `kgTick`,
karta i `kartaFor`. Reglerna (`kgSettingsOk`, C) släppte redan igenom exakt dessa värden – ingen
regeländring för formuläret (`test/firestore-rules-live-kurragomma-840.test.js` skriver
`buildSessionDoc`-dokumentet som läraren).

### 12.2 Historiken (spec §11.3)

`kurragomma-history.js` (lätt, `historyRenderer`) – allt ur serverns `result` utom **varav läraren**:
den summan skrivs aldrig till `result` (sessionen läses av eleverna, F1) utan räknas ur `kgEvents` med
`larare: true` (`kurragomma-data.js antalLarareVisslingar`, `getCountFromServer` = **1 läsning** per öppnad
match; eleven nekas samlingen av reglerna, misslyckas läsningen visas "–"). Inga andra extra läsningar:

- Matchraden: "N av M klarade sig gömda hela matchen" / "Sökarna hittade alla!" + svarssätt, gömtid,
  startsökare, tystnadsregeln, rätt av svar.
- Rutorna: klarade sig (av M), hittade, visslingar **varav N av läraren** (ur `kgEvents`), den som hittade flest.
- Pallplats (delad placering, `podiumGroups` på poängen) och topplistan: plats, elev, utfall
  (🙈 Klarade sig / 🔎 Hittad / 🔦 Sökare), poäng, rätt, svar, hittade, pluggmynt (`result.rewards`).
- Andel rätt per uppgift/fråga (`result.perQuestion`, svårast markerade) och per tabell/kategori
  (`categoryRates` på `statKeys`).
- Statistik → Live: klassens rad Rätt · Klarade sig · Hittade · Visslingar, sammanfattningen per
  tabell/kategori och klassens svåraste frågor (`classSummaryHtml`).
- `settle(s)` = `avslutaOchBetala` (kgAvsluta + pluggmynten om lärarfliken stängdes vid slutet).

"Varav av läraren" visas **bara** här – inte i finalen och inte på elevens slutskärm (de läser
samma `result` men ritar inte fältet; summan avslöjar inte vilken vissling det gällde).

### 12.3 Pluggmynten (spec §10, LIVE-FORMAT §6)

`withRewards`-vägen är D:s (`kg-avslut.js`): servern räknar `result.rewards` ur
`rewardRader(rader)` (rows ur **serverns** `kgPlayers`), `winner: null`, klienten skriver kvittona
(`settleLiveRewards`, idempotent), demot betalar aldrig, elevskärmsfönstret avslutar/betalar aldrig.

**D:s fråga – gömd med 0 besvarade fick 0 mynt.** Orsaken var båda: serverns `rewardsFor`
kopierade live-rewards regel "bara den som svarat" (`answered > 0`), **och** Kurragömma-grenen av
`liveCoinPlayerOk` krävde `kgPlayers.besvarade >= 1`. Lösningen är lokal för Kurragömma (den
gemensamma regeln för Guldrushen/Datakuppen/Meteorstormen/Snilleblixten är orörd): deltagare =
`deltog(p)` i `kg-regler.js` – **svarat, låst ett gömställe (`harLast`, även serverns placering) eller
hittat någon** – i `byggResultat` (`result.players`, `result.rewards`) och i reglernas Kurragömma-gren
(`besvarade >= 1 || harLast == true || hittade >= 1`). Rätt-mynten är fortfarande `perCorrect × ratt`
(0 utan svar), placeringspriset räknas bland deltagarna. Specens §0.2 ("poängen kan aldrig bli
pluggmynt under matchen") gäller oförändrat – allt räknas i `kgAvsluta`. Avgränsningen är en fråga
till Elias (§8 fråga 10). Deploy: `firestore:rules` före webben (§10.7).

### 12.4 Lärarens vissling (Elias 2026-11-11)

Lagd i E (inte #838) eftersom #838 redan var i slutverifiering. Servern: `functions/kurragomma-vissling.js`
(§10.1 `kgLarareVissla`). Tystnadsregeln i `kgTick` går nu genom samma `visslaGomd`, och `kgSvara`
bygger sin händelse med samma `visslingsHandelse` – det finns en enda form på en vissling:

- `hand/{id}`: `{ typ: "vissling", x, z, plats, t }` – den ungefärliga platsen (`VISSLING_OSAKERHET_M`),
  platsnamnet på den, inget uid, inget namn, ingen lärarmarkering. Projektorn (ringar, noter, riktat
  ljud), sökarna (markör + pil) och gömmarna ("Det visslar vid …") ser exakt en vanlig vissling.
- Den visslade: `kgSecret.senastVisslingAt = nu` (1,5× sökradie i 10 s), `kgPlayers.tystRef = nu` och
  `kgPlayers.tystVissling = id` (hand-nyckeln vald i förväg, i samma transaktion – D:s N1b), så elevens
  egen skärm visar den neutrala raden "Det visslade där du gömmer dig!" (`TEXT.tystVissling` – samma för
  tystnadsregeln, F2) + hoppet, aldrig "Fel svar". `VISSLING_SPARR_MS` blockerar inte läraren, men lärarens vissling sätter elevens
  spärr (ett fel svar direkt efteråt visslar inte igen – samma som efter en tystnadsvissling).
- Markeringen: `kgEvents` får `larare: true` (bara lärare läser samlingen) – **bara där**. Summan "varav
  läraren" står inte i `result` (sessionen läses av varje inloggad elev, F1) utan räknas av historiken
  (§12.2). Aldrig i `hand`, aldrig i `kgPlayers`, aldrig i något svar till en elev.
- Spamskydd: `LARARE_VISSLA_SPARR_MS` (5 s, `kg-config.js`, synkad) per elev via `kgSecret.larareVisslaAt`;
  ett andra anrop inom tiden → `resource-exhausted` med `details { skal: "sparr", vantaMs }`.
- Behörighet och fas: `larareFor` (admin, eller årskurskonto med klassen) annars `permission-denied`;
  `assertLive` + `kgFas === "leta"` + eleven `roll: "gomd"` med `kgSecret.gomd` annars `failed-precondition`
  (sökare, hittad, okänd, gömfasen, avslutad).

**Panelen** (`kgp-vissla.js`, CSS `kgp-vissla*` i `kurragomma-projektor.css`): D lämnade ingen egen
krok utöver `createOn(host, { screen, deps })` – panelen monteras där, av `kgp-on.js`, **bara när
`screen` är falskt** (lärarens fönster `#/larare/live?id=…`, aldrig elevskärmsfönstret `&skarm=elev`
som klassen ser) och bara när kopplingen har `larareVissla` (demot har det inte). Den syns i letfasen
medan matchen pågår (`visslaPanelSynlig`): en diskret knapp "🔔 Vissla" nere till höger (ovanför inget –
händelseflödet ligger i mitten, toppraden rörs inte) som fäller ut listan över de gömda med en
Vissla-knapp var, ↻ och ✕. Px-mått, `min(340px, 100vw − 24px)` bred och rullbar – fungerar på ~380 px.
Efter ett tryck står "Visslade ✓" i 5 s; "Vänta några sekunder" / "Inte gömd längre" (raden tas bort)
vid fel.

**Kvoten (§10.8):** panelen har **ingen lyssnare** och projektorn lyssnar fortfarande inte på
`kgPlayers`. Listan läses vid öppning och vid ↻: `kgPlayers where roll == "gomd"` = en läsning per
gömd (≤ ~20 i en klass på 25). Öppnar läraren panelen 3–5 gånger per match blir det ~50–100
läsningar, inom §10.8:s marginal; `panel.lasningar()` håller räkningen för slut-QA:s mätning.
`kgLarareVissla` själv kostar 1 sessionsläsning (minnet) + 2 i transaktionen + 1 `kgEvents`-skrivning.

### 12.5 LIVE-FORMAT §10 – checklistan

- [x] `src/live/formats/kurragomma/` med `index.js`, ren logik (`kg-setup.js`, `kg-avslut.js`, `kgp-logik.js`, `kge-logik.js`, `delat/`), lata vyer
- [x] Inget kistformat – ingen kistmotor (egen 3D-motor i `delat/` + `scen/`)
- [x] En rad sist i `BUILTIN_FORMATS`
- [x] Regelgren i `firestore.rules` (+ `database.rules.json`) + routning i `allow create`/`allow update`
- [x] `test/live-kurragomma-*.test.js` + `test/firestore-rules-live-kurragomma*.test.js` (i `test:rules`), `test/rtdb-rules-kurragomma*.test.js` (`test:rules:rtdb`)
- [x] Pluggmynt kopplat (§6): `rewardsSetupField`, `validateRewards`, `rewardSessionFields`, `withRewards`-rows ur serverns data, `winner: null`, demot betalar aldrig
- [x] Projektorvyer, elevskärm och historik
- [x] Demoläge + `preview/preview-kurragomma-demo.html` (+ elev, kopplat)
- [x] Egen CSS per format (`kurragomma-*.css`, `scen/kurragomma-scen.css`), reducerad rörelse
- [x] `docs/KURRAGOMMA.md` §10.2–§10.3: formatets fält, underdokument och `result` (DATAMODELL pekar hit via LIVE-FORMAT)
- [x] Bootgrafen orörd (`node --test test/live-formats.test.js`)
- [x] Alla sviter gröna: `node --test`, `npm run test:rules`, `npm run test:rules:rtdb`, `npm run test:functions`
- [ ] Rules-deploy (Firestore + RTDB) → functions-deploy (inkl. `kgLarareVissla`) → webb **före** merge till `main` – kräver Elias OK (§10.7)
- [x] Serverstyrt format: mönstren i §11 (deterministisk motor i `delat/`, synkad till `functions/`, hopslagna anrop, serverskriven status)

### 12.6 Testerna (del E)

| Fil | Kör | Visar |
| --- | --- | --- |
| `test/live-kurragomma-larare.test.js` | `node --test` | fälten och deras värden → `kgInstallningar`/`durationSeconds` (även via `buildSessionDoc`), `deltog`, historiken (pall, varav läraren ur `deps`/kgEvents, pluggmynt, per uppgift/tabell, Statistik → Live), Vissla-panelens logik, ≤ 400 rader, CSS-prefix `kg-`, synken, lata importer |
| `test/functions-kurragomma-vissla.test.mjs` | `test:functions` | `kgLarareVissla`: elev nekas, sökare/hittad/okänd nekas, gömfasen/efter slutet nekas, händelsen identisk med en fel-svar-vissling (fält i `hand` och `kgEvents`), id-matchningen, 1,5× sökradie, spamskyddet (inom 5 s nekat, efter 5 s OK, annan elev OK), `VISSLING_SPARR_MS` spärrar inte, `visslingar` räknar alla och `visslingarLarare` finns inte i `result` (bara `larare: true` i `kgEvents`); pluggmynt åt gömd utan svar och åt serverplacerad, inget åt den som inte deltog |
| `test/functions-kurragomma.test.mjs` (tillägg) | `test:functions` | e2e genom callables: elev nekas, läraren visslar, `hand` har exakt `{ plats, t, typ, x, z }`, spamskyddet |
| `test/firestore-rules-live-kurragomma-840.test.js` | `test:rules` | formulärets dokument (gömtid 20, startsökare 2, tystnad av, 3 min) släpps igenom; kvittot för gömd utan svar (låst) och sökare utan svar (hittade) betalas, den som inte deltog nekas, rätt-mynt > `perCorrect × ratt` nekas; F1: elevens session saknar `visslingarLarare`, eleven nekas `kgEvents` (listning, filtrerad fråga, `getCountFromServer`, enskilt dokument), läraren räknar 2 |
| `test/functions-kurragomma-leta.test.mjs` (ändrat) | `test:functions` | `players`/`rewards` räknar låsta gömmare utan svar |
