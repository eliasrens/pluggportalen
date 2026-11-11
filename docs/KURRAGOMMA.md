# Kurragömma 🙈 – motorn, kartan, reglerna och balansen

Kurragömma är ett Live-format i 3D (`format: "kurragomma"`, epic #835). Specen:
[`UTVECKLINGSUPPDRAG_KURRAGOMMA.md`](UTVECKLINGSUPPDRAG_KURRAGOMMA.md), skissen:
[`kurragomma/skiss.html`](kurragomma/skiss.html). Där skissen och specen skiljer
sig gäller specen.

Det här är **formatets kontraktsdokument**. Del A (#836) beskriver den delade
motorn i `delat/`. B (3D-scenen), C (servern) och D (projektorn och elevskärmen)
bygger mot API:t i §2–§4 och lägger till sina egna avsnitt längre ned.

---

## 1. Filerna (del A)

| Fil | Innehåll |
| --- | --- |
| `src/live/formats/kurragomma/delat/kg-config.js` | **Alla tal**: fart, skydd, sökradier, visslingar, spärrtider, poäng, lärarens val, klientens tal (hjärtslag, rörelsekanalen, flödet) och kameran |
| `delat/kg-karta.js` | Kartan **Ön** som data: radie, startplatser, 40 föremål |
| `delat/kg-geometri.js` | `skydd`, `kollidera`, `giltigtGomstalle`, `narmasteGiltiga`, `platsNamn`, `gomstalleNaraForemal` |
| `delat/kg-regler.js` | Sökningen, rimlighetskontrollen, visslingar (spärrtid, tystnad, frånkopplad), poäng, överlevnad, placering, startsökare, inställningar och matchklockan |
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
| `POS_MIN_INTERVALL_MS`, `POS_MIN_FLYTT_M`, `POS_INTERPOLERING_MS` | 200 ms (5/s), 0,15 m, 150 ms | samma | rörelsekanalen (C/D) |
| `HAND_MAX_ALDER_MS`, `HAND_RENSA_MS` | 10 s, 60 s | samma | |
| `VISSLING_MARKOR_MS`, `VISSLING_RAD_MS`, `HITTAD_RUTA_MS`, `KAMERA_GLID_MS` | 4 s, 3 s, 2 s, 3 s | samma | |
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
| `scen.on("flytt", fn)` | `{ x, z, yaw }` varje bildruta figuren rör sig – D skriver `pos` (högst 5/s, se `POS_*`) |
| `scen.sokare([{ uid, x, z, yaw, t, namn }])` | Sökarnas positioner ur rörelsekanalen (`t` = avsändarens `Date.now()`; scenen räknar om till sin klocka). Ritas ~150 ms bakåt och interpoleras. Skylt med namn bara när namn är på |
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
