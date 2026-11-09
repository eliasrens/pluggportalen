# QA-rapport – Datakuppen: ändringar från klassrådet (#832)

Uppdrag: `datakuppen-klassradet.md` (filer, virus, hackning). Rapporten följer
uppdragets §14.

---

## 1. Nuläget (§0.2) – före ändringarna

Läst på `main` @ 34cad9d: `src/live/formats/datakuppen/delat/files-config.js`
(filtabellen), `delat/datakuppen-regler.js` + kistmotorn
`src/live/kistspel/delat/ks-regler.js` (slump, effekter, skydd),
`functions/kistspel-core.js` (svar + filöppning), `functions/datakuppen-hack.js`
(målval + gissning), `functions/datakuppen-koder.js` (koderna).

### 1.1 Alla filtyper

Vikterna summerar till **97** (inte 100) – sannolikheten är vikt/97.

| Fil (id) | Etikett | Vikt | Sannolikhet | Värde | Villkor |
| --- | --- | ---: | ---: | --- | --- |
| `liten_fil` | Liten fil | 22 | 22,7 % | +10 MB | – |
| `mapp` | Mapp | 20 | 20,6 % | +25 MB | – |
| `stor_fil` | Stor fil | 9 | 9,3 % | +50 MB | – |
| `serverhall` | Serverhall | 3 | 3,1 % | +100 MB | – |
| `overklockning` | Överklockning | 7 | 7,2 % | dubblar saldot, högst +150 MB | – |
| `virus` | Virus | 8 | 8,2 % | −10 % av saldot (avrundat nedåt) | ingen förlorar allt |
| `tom_mapp` | Tom mapp | 13 | 13,4 % | ingenting | – |
| `brandvagg` | Brandvägg | 6 | 6,2 % | skydd 60 s | – |
| `hack` | Hack | 9 | 9,3 % | välj mål → knäck koden → 15 % av målets data | bara när Hackning är på; ingen att välja → **Mapp (+25 MB)** |

Hackning av: Hackens vikt (9) fördelas på datafilerna (`effect: "gold"`) i
proportion till deras vikter (kistmotorns `chestTable`, samma regel som
Guldrushens "Stöld och byte av").

**Namnen i uppdraget ↔ koden.** Uppdraget talar om *liten mapp*, *vanlig
mapp* och *tom mapp*. Spelet har fyra datafiler (Liten fil 10, Mapp 25, Stor
fil 50, Serverhall 100). Vi läser *liten mapp* = **Liten fil** (`liten_fil`)
och *vanlig mapp* = **Mapp** (`mapp`). Se §7 (avvikelser) och §8 (frågor):
§3.2:s stoppregel "vanlig mapp ≤ 50 MB" slår till för varje tolkning.

### 1.2 Överklockning

- **Multiplikator ×2** – men den gäller **saldot**, inte kommande filer:
  `effect { kind: "double", cap: 150 }` dubblar elevens data direkt när filen
  öppnas, högst +150 MB.
- **Varaktighet:** ingen – den verkar i ögonblicket (inget tillstånd, inga
  svar eller sekunder).
- **Stapling:** nej (två Överklockningar = två separata dubblingar).

### 1.3 Virus

`effect { kind: "lose", share: 0.1 }` – tappar `floor(10 % × saldot)`. Taket i
motorn är 10 % (`loseCap`). Ingen kan hamna under 0. Kan komma på varje fil
(vikt 8). Viruset skrivs i händelseflödet och syns på projektorn ("🐛
Hoppsan! … fick ett virus").

### 1.4 Byta kod efter hack

**Fungerar inte enligt uppdraget.** Issue #719 (2026-10-15) tog medvetet bort
kodbytet: "koden behålls hela matchen". `guessCode` ger inga nya förslag,
`pickCode` avvisar ett nytt val (`failed-precondition` "Du har redan din kod –
den gäller hela matchen.") och elevvyn saknar "Välj ny kod". Bekräftat i den
befintliga testsviten (`test/functions-datakuppen-hack.test.mjs` "test 5 …
koden ligger kvar", "test 8 … efter skyddet hackar samma kod igen"). Uppdraget
§6.1 kallar regeln den viktigaste, så den återinförs (se §4 nedan).

### 1.5 Minnesmomentet

`liveSessions/{sid}/dkSecret/{hackarensUid}.hacks[målUid] = { codeVersion,
decoys[2], struck[], shown[] }`, bara servern läser (reglerna: `read: false`).
`codeVersion` ligger i målets `dkSecret/{målUid}`. Byter målet kod
(`codeVersion` +1) börjar minnet om vid nästa målval. "Känner till koden" =
`struck` innehåller båda `decoys` för målets aktuella `codeVersion`.

### 1.6 Skyddskontrollen (`protectedUntil`)

- **Målval** (`chooseTarget`): `victimProblem` → `isProtected` i transaktionen,
  i valets ögonblick. Skyddad → nekas (eget val) eller hoppas över (servern
  slumpar).
- **Gissning** (`guessCode`): `isProtected(mål, t)` i transaktionen. Skyddad
  → `result: "protected"`, och **hacket förbrukas** (`pending: null`). Det är
  det klassrådet upplevde som orättvist.
- Brandväggen (`openChest`) och gissningen skriver båda målets
  `dkPlayers`-dokument i varsin transaktion och serialiseras därför av
  Firestore.

---

## 2. Gamla och nya värden

Alla nya värden står samlade i `DK_BALANS` (`delat/files-config.js`).
Sannolikheterna nedan gäller med hackning på; "utan felsvit" = svaret kom
inte efter minst 3 fel i rad (viruset finns då inte i tabellen).

| Fil | Före | Efter | Sannolikhet före | Efter (felsvit) | Efter (utan felsvit) |
| --- | --- | --- | ---: | ---: | ---: |
| Liten fil ("liten mapp") | +10 MB | **+50 MB** | 22,7 % | 29,7 % | 34,0 % |
| Mapp ("vanlig mapp") | +25 MB | +25 MB (oförändrad) | 20,6 % | 26,0 % | 29,9 % |
| Stor fil | +50 MB | +50 MB | 9,3 % | 9,3 % | 9,3 % |
| Serverhall | +100 MB | +100 MB | 3,1 % | 3,1 % | 3,1 % |
| **Superserver** (ny) | – | **+1 000 MB**, påverkas aldrig av Överklockning | – | 1,0 % | 1,0 % |
| Överklockning | saldot ×2, högst +150 | **saldot ×3, högst +300** | 7,2 % | 7,2 % | 7,2 % |
| Virus | −10 % av saldot, varje fil | **−10–20 MB fast** (aldrig under 0), **bara efter ≥ 3 fel i rad**, inte på projektorn | 8,2 % | 8,2 % | – |
| Tom mapp | ingenting | **borttagen** | 13,4 % | – | – |
| Brandvägg | skydd 60 s | skydd 60 s | 6,2 % | 6,2 % | 6,2 % |
| Hack | 15 % av målets data | 15 % (oförändrat) | 9,3 % | 9,3 % | 9,3 % |
| Hack, ingen att välja | Mapp (+25 MB) | **Liten fil (+50 MB)** | | | |

Tomma mappens vikt (13) gick proportionellt till liten och vanlig mapp
(22 : 20). Superserverns 1 % tas från vanlig mapp (§3.3). Utan felsvit
fördelas virusets andel på datafilerna (utom Superservern) i proportion till
deras vikter – samma regel som när hackning är av.

---

## 3. Överklockningen

Den befintliga överklockningen är en **direkt multiplikation av saldot** (ingen
varaktighet, ingen stapling, §1.2). "Ett steg högre" blev därför **×2 → ×3**.
Taket höjdes från +150 till **+300 MB** så att brytpunkten är densamma (150 MB
saldo) – annars hade ×3 bara märkts för elever under 75 MB. Ingen ny
statusrad behövs eftersom effekten är omedelbar. Superservern multipliceras
aldrig (`overklockas: false`), §7.8.

---

## 4. Kodbyte efter hack

**Fungerade inte innan** – #719 hade medvetet tagit bort det (§1.4). Rättat:

- `guessCode` (rätt kod) → målet får "Välj ny kod" (`giveOffers`, orsak
  `"hack"`): 4 nya förslag, ~10 s, aldrig en tidigare egen kod
  (`tidigareKoder`) eller någons aktuella. Inget val → servern väljer.
- Nytt val → `codeVersion` +1 (minnet mot eleven börjar om för alla),
  `kodKannsAv` töms, gamla koden läggs i `tidigareKoder`.
- `pickCode` tar emot ett index även under matchen när det finns förslag.
- Elevvyn: raden "Välj ny kod" (`dk-kod-vy.js`), "Visa kod" behålls.
- Samma flöde används vid kodläcka (orsak `"lacka"`, §6.4).
- De gamla #719-testerna är omskrivna efter den nya regeln
  (`functions-datakuppen-hack.test.mjs` test 26, `functions-datakuppen.test.mjs`
  "hela flödet").

---

## 5. Balanssimuleringen

`npm run balans:datakuppen` (`admin/datakuppen-balans.mjs`, `--md` för
tabellerna). Simulerar 10-minutersmatcher med 25 elever (FÖRE-värdena är
frysta i skriptet). Test 40 kör båda regeluppsättningarna.

#### FÖRE

| Mått | Värde |
| --- | ---: |
| MB per rätt svar (utan hack) | 22,4 |
| Virus vid 50 % rätt | 8,3 % av filerna, 2,90/elev och match |
| Virus vid 70 % rätt | 8,3 % av filerna, 4,05/elev och match |
| Virus vid 90 % rätt | 8,2 % av filerna, 5,16/elev och match |
| Superserver: andel av all data | 0,0 % |
| Superserver: andel av vinnarens | 0,0 % |
| Vinnaren hade ≥ 1 Superserver | 0,0 % |
| Hack/match (lyckade) | 115,0 (37,0) |
| Avbrutna hack/match | 0,0 |
| Kodläckor/match | 0,0 |

| Fil | Andel (hackning på) |
| --- | ---: |
| liten_fil | 22,7 % |
| mapp | 20,6 % |
| stor_fil | 9,3 % |
| serverhall | 3,1 % |
| overklockning | 7,2 % |
| virus | 8,2 % |
| tom_mapp | 13,4 % |
| brandvagg | 6,2 % |
| hack | 9,3 % |
#### EFTER

| Mått | Värde |
| --- | ---: |
| MB per rätt svar (utan hack) | 66,3 |
| Virus vid 50 % rätt | 1,0 % av filerna, 0,33/elev och match |
| Virus vid 70 % rätt | 0,2 % av filerna, 0,10/elev och match |
| Virus vid 90 % rätt | 0,0 % av filerna, 0,01/elev och match |
| Superserver: andel av all data | 16,0 % |
| Superserver: andel av vinnarens | 26,9 % |
| Vinnaren hade ≥ 1 Superserver | 89,5 % |
| Hack/match (lyckade) | 114,8 (38,6) |
| Avbrutna hack/match | 5,3 |
| Kodläckor/match | 0,0 |

| Fil | Andel (hackning på) | Utan felsvit |
| --- | ---: | ---: |
| liten_fil | 29,7 % | 34,0 % |
| mapp | 26,0 % | 29,9 % |
| stor_fil | 9,3 % | 9,3 % |
| serverhall | 3,1 % | 3,1 % |
| overklockning | 7,2 % | 7,2 % |
| virus | 8,2 % | – |
| brandvagg | 6,2 % | 6,2 % |
| hack | 9,3 % | 9,3 % |
| superserver | 1,0 % | 1,0 % |
⚠️ Superservrar står för mer än 25 % av vinnarens poäng (26,9 %) – redovisas, värdet ändras inte (§11).

**Slutsatser**

- MB per rätt svar (utan hack) går från 22,4 till 66,3. Det mesta kommer från
  Superservern (1 000 MB × 1 %) och den större lilla mappen. Det gör även
  hackets 15 % värt mer i absoluta tal.
- Virus: från 8 % av alla filer till ~1 % för en elev med 50 % rätt och
  nästan 0 för den som har 90 % rätt – viruset träffar nu bara gissande.
- **Riktmärket överskrids:** Superservrar står i snitt för **26,9 %** av
  vinnarens poäng (gränsen är 25 %), och vinnaren hade minst en Superserver i
  89,5 % av matcherna. Enligt §11 redovisas det och värdet ändras inte – se
  fråga F3 i §8.
- Kodläckor blir sällsynta med gränsen 5 (simuleringen ser i snitt 0,0 per
  match). Avbrutna hack: ~5 per match.

---

## 6. Testresultat och skärmbilder

### 6.1 Automatiska tester (2026-11-09, gren `coder/issue-832-…`)

| Svit | Kommando | Resultat |
| --- | --- | --- |
| Enhetstester (allt utom rules/functions/e2e) | `node --test $(ls test/*.test.* \| grep -v -e firestore-rules -e functions- -e e2e)` | **4 092 pass, 0 fail**, 1 skippad |
| Datakuppen/Guldrush/kistspel (klient) | `node --test test/live-datakuppen*.test.js test/live-kistspel*.test.js test/live-guldrush*.test.js` | 179 pass, 0 fail |
| Rules, Datakuppen | emulator (firestore): `test/firestore-rules-live-datakuppen.test.js` | 22 pass, 0 fail |
| Functions (bara firestore) | `functions-datakuppen-core/-hack/-klassradet/-kodlacka`, `functions-guldrush-core/-stold` | gröna |
| Functions (functions-emulatorn) | `functions-guldrush`, `-guldrush-tidslinje`, `-datakuppen`, `-datakuppen-fragor` | **31 pass, 0 fail** |
| Bootgrafen | `admin/qa-bootgraf-bfs.mjs` 34cad9d vs HEAD | oförändrad (107 filer) |

Uppdragets testnummer:

| Test | Var |
| --- | --- |
| 1–7 (filtabellen, liten mapp, Superserver, Överklockning) | `test/live-datakuppen-klassradet.test.js`, `test/functions-datakuppen-klassradet.test.mjs` |
| 8–14 (viruset) | `test/functions-datakuppen-klassradet.test.mjs` ("viruset"), `test/live-datakuppen-klassradet.test.js` (test 12–14) |
| 15 (felsviten hemlig) | `test/firestore-rules-live-datakuppen.test.js` |
| 16–19 (brandvägg under hack, ingen att hacka, atomärt) | `test/functions-datakuppen-klassradet.test.mjs`, `test/functions-datakuppen-hack.test.mjs` |
| 20–25 (kodläckan) | `test/functions-datakuppen-kodlacka.test.mjs` |
| 26 (kodbyte efter hack) | `test/functions-datakuppen-hack.test.mjs` |
| 27 (integritet) | `test/firestore-rules-live-datakuppen.test.js` |
| 28–37 (kantfall §7) | §7.1–7.3, 7.6: `functions-datakuppen-kodlacka.test.mjs` "kantfall"; §7.3 även `functions-datakuppen-hack.test.mjs`; §7.7, 7.9, 7.10: `functions-datakuppen-klassradet.test.mjs`; §7.8: test 5 (`overklockas: false`); §7.5: befintliga timeout-testerna (§2.10 i `functions-datakuppen.test.mjs`); §7.4: inget eget test (se §7) |
| 38 (Guldrushen) | `functions-guldrush*`, `live-guldrush*` – gröna |
| 39 (demoläget) | `test/live-datakuppen-demo.test.js` |
| 40 (balansskriptet) | `test/live-datakuppen-klassradet.test.js` |

### 6.2 Manuell QA

Gjord i demoläget (`preview/preview-datakuppen-demolage.html`, låtsasserver,
ingen riktig data) och lärarhistorikens förhandsvisning. Elevvyn i 380 × 800,
projektorn i 1920 × 1080. Skärmbilder i `docs/qa-datakuppen-klassradet/`:

| QA-punkt (§13) | Skärmbild | Utfall |
| --- | --- | --- |
| 1. Ingen tom mapp | `demolage-1920-filer.png` | ingen tom mapp i filerna eller demostegen (test "inga ikoner, texter, ljud eller demosteg för tom mapp") |
| 2. Superserver – elev | `380-superserver.png` | "🚀 Superserver! +1000 MB", glöd + treklang, saldot +1000 |
| 2. Superserver – projektor | `1920-projektor-superserver.png` | "🚀 Alma hittade en Superserver: +1 000 MB!" i flödet, täcker varken timern eller topplistan. **Rättat under QA:** raden kortades med "…" (`…-FORE-fix-avkortad.png`), se §7 |
| 3. Virus efter felsvit | `380-virus-efter-felsvit.png` | 3 fel → rätt → "🦠 Ett virus åt upp 11 MB. Det kan hända när man gissar många gånger i rad. Läs frågan noga!" |
| 4. Brandvägg under hack | `380-brandvagg-under-hack.png`, `380-brandvagg-tillbaka-till-malvaljaren.png` | beskedet, sedan samma målväljare med ny nedräkning; målet visas skyddat |
| 5. Kodläcka | `380-kodlacka-valj-ny-kod.png` | "🔓 Din kod har läckt! Välj en ny." + raden "Välj ny kod" (4 förslag, 0:08); inget på projektorn |
| 6. Målet byter kod | `380-malet-bytte-kod.png` | "Alva bytte kod precis! Välj igen." → tillbaka till målväljaren |
| Ingen går att hacka | `380-ingen-gick-att-hacka.png` | "Ingen gick att hacka just nu, du fick 50 MB i stället." |
| Överklockning | `380-overklockning-x3.png` | "⚡ ×3: +300 MB" |
| Lärarens räknare | `1920-historik-klassens-raknare.png` | Superservrar, Virus, Avbrutna hack, Kodläckor – hela klassen |
| 8. Ikoner på Windows 10 | – | 🚀 🔓 🛡️ ⚡ är gamla emoji (Unicode ≤ 7) och filkorten använder SVG (`dk-ikoner.js`). Uppdragets 🦠 är Emoji 11 och kräver Windows 10 1809 eller senare – på äldre Windows 10 blir det en ruta (fråga F5). Testmaskinen saknar emojitypsnitt, därför syns rutor i skärmbilderna |

Punkt 5 med sänkt gräns (2) i flera riktiga elevflikar är inte gjord i
webbläsaren. Kodläckan med flera hackare täcks av functions-testerna mot
emulatorn (test 20–25).

---

## 7. Avvikelser

- **Liten/vanlig mapp** tolkas som Liten fil / Mapp (§1.1). §3.2:s stoppregel
  slår till för varje tolkning. Det rapporterades till leaden och arbetet
  fortsatte med denna tolkning.
- **#719 återkallat** för kodbytet efter hack (§6.1 går före). "Visa kod"
  (koden dold) från #719 behålls.
- **§7.1 nås knappt i praktiken:** skyddet efter hack (30 s) är längre än
  kodvalet (10 s). Testat genom att ställa upp läget direkt.
- **§7.4 (målet lämnar matchen):** servern har ingen närvaro, så det finns
  inget eget fall. Ett mål som byter kod/får skydd hanteras som §7.3.
- **Klasstorleken för kodläckans gräns** = antal spelardokument när gissningen
  görs (inte frusen vid start).
- **Ingen lärarregelöversikt finns** (§9.3) – ingen har lagts till.
- **Projektorns terminal:** Superserverns exakta text ryms inte på en rad i
  1920 × 1080 vid den tidigare minsta textstorleken (75 %), så "+1 000 MB!"
  kortades till "+1 000 M…". `MIN_FIT` i `dk-terminal.js` sänktes till 65 %
  (bara Datakuppen, och bara rader som inte ryms). Namn längre än ~10 tecken
  kortas fortfarande i slutet.
- **Befintligt, inte ändrat:** i elevens öppnade filkort klipps långa
  filnamn ("Superserver", "Överklockning") i 380 px. Beskedet under korten
  visar ändå rätt text.
- **Deploy:** inga ändringar i reglerna. Functions måste deployas (`datakupp*`
  och `guldrush*`, eftersom `kistspel-core.js` fick svarskroken), sedan webben.

---

## 8. Öppna frågor till Elias

- **F1.** Är "liten mapp" = Liten fil (10 → 50 MB) och "vanlig mapp" = Mapp
  (25 MB) rätt tolkning? Liten mapp ger nu mer än vanlig mapp.
- **F2.** Räcker Överklockning ×3 direkt på saldot (tak +300), eller ska den bli
  en effekt med varaktighet?
- **F3.** Superservrar står för 26,9 % av vinnarens poäng (över riktmärket
  25 %). Ska 1 000 MB eller 1 % sänkas?
- **F4.** Ska viruset synas på projektorn igen någon gång? (Nu bara för eleven
  och i lärarens räknare, enligt §9.1.)
- **F5.** 🦠 (uppdragets virustext) syns inte på Windows 10 äldre än 1809. Behålla, eller byta till 🐛 som förut?
