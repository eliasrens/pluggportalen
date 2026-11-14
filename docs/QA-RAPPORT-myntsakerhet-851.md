# QA-rapport Myntsäkerhet: elever ska inte kunna skriva sitt eget saldo (#857, epic #851)

Testat 2026-11-14 på epic-grenen `epic/s-kerhet-elever-ska-inte-kunna-skriva-si-1e96a3`
(HEAD `a0305cc`, B1 #853 + B2 #854 + B3 #855 + B4 #856 landade) mot `main` = `origin/main`
`6a3b16b` och fas 1-taggen `mynt-fas1` (`110a784`). Plan och hotmodell:
[`docs/SAKERHET-MYNT.md`](SAKERHET-MYNT.md).

Riggen är ny i den här issuen: [`admin/qa-myntsakerhet-857/`](../admin/qa-myntsakerhet-857/).
**En** emulator (functions + auth + firestore, grenens functions) kör genom hela övergången.
Reglerna byts medan emulatorn kör (regelfilen skrivs om på plats, emulatorn läser om den),
och webben byts mellan tre `git archive`-exporter (`main`, `mynt-fas1`, HEAD) bakom samma
proxy. Samma data följer med genom alla steg. Allt kördes i webbläsaren med appens egna
funktioner (`awardExercise`, `completeText`, `claimFarmAnimalGift`, `addCoins`,
`settleLiveRewards`) eller genom UI:t (butiken och Mattematchen). Databasen lästes med Admin
SDK före och efter varje steg.

## Sammanfattning

**Alla acceptanspunkter är PASS.** Inga fel i produktkoden som stoppar en merge. Fynden:
två luckor i driftordningen (F1, F2) som nu står i docs, ett gammalt e2e-test som B3 gjorde
inaktuellt (F3, rättat här) och tre små avvikelser (F4–F6).

| # | Acceptanspunkt | Resultat | Bevis |
|---|---|---|---|
| 1 | Sviterna: enhet, `test:rules`, `test:functions`, `test:e2e` gröna. Bootgrafen = 107 | **PASS** | §1, §2 (e2e efter testfixen F3) |
| 2 | Quiz/övning, Läsresan, köp (möbel + mysterylåda), Live, Ge mynt och Mattematchen ger exakt samma belopp som på `main` | **PASS** | §3 |
| 3 | M1–M6 från devtools nekas. Artbyte, kopierade djur och uid i fel lista syns ingenstans. Gåvan = 8 per ägt gårdsdjur och dag, även med uppblåst lista | **PASS** | §4 |
| 4 | Övergången: alla steg i §6 B5 körda och dokumenterade | **PASS** | §5 |
| 5 | Migreringen: torrkörning → `--commit` → torrkörning visar 0 | **PASS** | §5 (fas 1 och fas 2) |
| 6 | Kvoten för en skoldag uppmätt och inskriven i §5 | **PASS** | §6, `SAKERHET-MYNT.md` §5.1 |
| 7 | `BEHORIGHETER.md`, `DATAMODELL.md`, `ADMIN.md` uppdaterade, deploy-ordningen dokumenterad | **PASS** | §7 |
| – | `npm run test:rules` innehåller testet där eleven kör `update studentData {coins: 99999}` och nekas | **PASS** | `test/firestore-rules-mynt-las.test.js:97` |

## 1. Sviterna

Repot har inget `npm test`. "Enhet" = `node --test` på alla `test/*.test.js`/`.test.mjs` som
inte körs av ett emulatorskript i `package.json` och inte startar en emulator (301 filer).
Emulatorsviterna kördes med exakt fillistan ur `package.json`, i bitar om 10–12 filer
(`emulators:exec` på slumpportar, `flock /tmp/pp-emulator.lock`), eftersom Barista startades
om flera gånger under körningen.

| Svit | Resultat |
|---|---|
| Enhet (301 filer) | **4422 pass / 0 fail**, 1 skip (`demo: en stubbe vägras`, redan markerad) |
| `npm run test:rules` (91 filer, 8 bitar) | **1066 pass / 0 fail** (151 + 129 + 197 + 145 + 148 + 109 + 84 + 103) |
| `npm run test:functions` (51 filer, 6 bitar) | **573 pass / 0 fail**, 2 `todo` (schack F9, kända) |
| `npm run test:e2e` | före fixen **3/5** (F3), efter **5/5 pass** |
| `node --test test/behorigheter-doc.test.js` (efter docs-ändringen) | 4/4 pass |

## 2. Bootgrafen

```
node admin/qa-bootgraf-bfs.mjs origin/main   # 107 filer, sha256 c1c84bdad08026dc…
node admin/qa-bootgraf-bfs.mjs mynt-fas1     # 107 filer, samma sha256
node admin/qa-bootgraf-bfs.mjs HEAD          # 107 filer, samma sha256
```

Mängden är identisk. 18 av epicens ändrade filer ligger i bootgrafen (t.ex. `data.js`,
`data-farm.js`, `game-shared.js`), men inga nya statiska importer: `data-mynt.js` och
`butik-kop.js` laddas dynamiskt.

## 3. Beloppen: samma förlopp på `main` och på epicen

Två identiska elever (`q857m`/`q857e`: 1000 mynt, 120 XP, ett gårdsdjur, en spelad quiz;
`q857m2`/`q857e2` för Mattematchen). `main`-körningen: main-webb mot main-regler.
Epic-körningen: fas 2-webb mot låsreglerna, efter migreringen.

| Händelse (anropare) | `main` | Epic |
|---|---|---|
| Quiz, spelad förut, `baseCoins` 30, 3★ (`awardExercise`) | +30 mynt, +50 XP | +30, +50 |
| Match, första gången, 20, 2★ | +20, +40 XP | +20, +40 |
| Läsresan, 7 frågor, 4 rätt (`nextTextFor` + `completeText`) | +12 | +12 |
| Gårdens gåva (`claimFarmAnimalGift`), igen samma dag | +8, sedan 0 ("ingen gåva att hämta") | +8, sedan 0 |
| Ge mynt, admin (`addCoins(25, elev)`) | +25 | +25 |
| Live, Snilleblixten 50 (`settleLiveRewards`), igen | +50 "betald", 0 "redan" | +50, 0 |
| Butiken, Pall (`stol`), klick i UI:t | −30 "Du köpte Pall!" | −30, samma text |
| Mysterybox mini, klick i UI:t (ny vara) | −250 (`myst-blomkrans`) | −250 (`myst-svamplykta`) |
| Mattematchen, 3 rätt + 1 fel i UI:t | +3, "3 mynt idag" | +3, "3 mynt idag" |
| **Slutsaldo** | **865** mynt, 210 XP / 1003 | **865**, 210 / 1003 |

Skoldagen i §6 (14 övningar, 4 texter, 2 gåvor, 3 köp) gav också samma belopp per händelse
(övningarna identiska i båda; Läsresan slumpar texten, 3 mynt per rätt i båda).

## 4. Attackerna (fas 2-regler, eleven `q857x` med appens SDK i devtools)

| Kod | Försök | Resultat |
|---|---|---|
| M1 | `updateDoc {coins: 99999}`, `setDoc {coins: 99999}, {merge}`, `increment(50)` | nekad ×3 |
| M2 | Eget kvitto med 501 (> 500 per gång), kvitto 10 men saldo +50, kvitto för i går | nekad ×3 |
| M2 | Appens `tjanaMynt("ovning", 500)` × 5 och `tjanaMynt("lasresa", 60)` × 15 | 500, 500, 500, 0, 0 och 13 × 60, 20, 0: dagstaken 1500 och 800 håller (R1: takt, inte bevis) |
| M3 | Kompisens `coins: 0`, `increment(-100)`, kompisens `myntDag` | nekad ×3 |
| M4 | `ownedItems` + krona, `ownedCounts.stol` 5, frö uppåt med `lastFro`, `appleCount` 10, äpplen på golvet ur intet, `barnLevel` 5, `gardenTier` 3, `barnSkin` som inte ägs, `avatarItems` krona, `husSkalId` slott, egen post i `agdaDjur`, `lastLiveReceipt` | nekad ×13 |
| M5 | `butikKop("myst-blomkrans")` / `{itemId: "stol", price: 0, item: "krona", coins: 99999}` / okänd vara | "Varan säljs inte." / köper bara stolen för 30, extrafälten ignoreras / "Varan finns inte." |
| M6 | `deleteDoc` av sitt dokument, `setDoc` av hela dokumentet med 99999, radera `myntDag` | nekad ×3 |
| M7 | `xp: 99999` | nekad |

Saldo, XP och alla varufält var oförändrade efter M1–M7 (jämförda fält för fält).

**Djurlistorna** är tillstånd och får skrivas, men läsfunktionerna visar bara djur med en
post i `agdaDjur`, med postens art:

| Lista | Skrivet av angriparen | Syns (`animalsFromData` / `farmFromData` / `petsFromData`) |
|---|---|---|
| `roomAnimals` | `fisk#x1` som dinosaurie, två kopior av fisken, `hund#fejk`, gårdsgrisens uid | bara `fisk#x1 = fisk` |
| `farm.animals` | grisen som häst, en kopia, `animal_horse#fejk`, `animal_cow#fejk`, fiskens uid som ko | bara `animal_pig#x1 = animal_pig` |
| `pets` | ägget som Halloween-art (`pumpis`), `pfejk1`, en kopia, fiskens och grisens uid, `hasHeatLamp` utan lampa | bara `px1`, utan lampa, med en vanlig art (R5, se F6) |

Klasskamraten `q857k` som tittar in i angriparens rum ser bara "Pingio" och "Akvariefisk"
([skärmbild](qa-myntsakerhet-851/kompisrum-angriparen.png)).

**Gåvan med uppblåst lista:** grisen +8; `animal_horse#fejk`, `animal_cow#fejk` och fiskens
uid 0 ("okänt djur"); grisen igen 0. Ett handgjort gåvokvitto för `animal_horse#fejk` nekas.
Dagens kvitto: `gard: 8, gavor: {animal_pig#x1: true}`.

## 5. Övergången i två faser (samma emulatordata genom alla steg)

| Steg | Webb / regler | Vad som kördes | Resultat |
|---|---|---|---|
| 0 | `main` / `main` | baslinjen i §3 | se §3 |
| 1 | `main` / fas 1 | gammalt dokument utan `xp`/`agdaDjur` (`q857t`): quiz, Läsresan, gåva, stol, ägg, hund, frö, Live (lärare), Ge mynt, MM | allt som förut: +30, +12, +8, −30, −200, −160, −25, +40, +5, +2. Inga nekanden |
| Fas 1-migrering | – / fas 1 | `--djur` (torr) → `--commit --djur` → `--djur` (torr) | 10 dokument, 9 att skriva (xp 3, rumsdjur 4, gårdsdjur 7, ägg 3) → 9 skrivna → **0** |
| (extra) | `main`, gammal flik / fas 1 efter migreringen | samma flöden | fungerar; ett ägg köpt här får ingen `agdaDjur`-post (väntat, fångas i fas 2 steg 1) |
| 2 | fas 1 / fas 1 | quiz, Läsresan, stol/ägg/frö via `butikKop`, sådd, gåva | +30/+50 XP, +12, −30, −200 (med post i `agdaDjur`), −20; sådden: frö 4 → 3 och `lastFro`; gåva +8 med `myntDag.gavor` |
| Fas 2 steg 1 | – / fas 1 | `--commit --djur` | 1 dokument (ägget från den gamla fliken) |
| 3 | fas 1 / **fas 2**, före migreringen | dokument utan `xp` (`q857n`, skapat efter steg 1): quiz, Läsresan. `q857t`: match, sådd, flytta rumsdjur/husdjur/gårdsdjur, fisk, minilåda, MM | `q857n`: +30 utan XP (inget `xp`-fält skrivs), +12. `q857t`: +20/+40 XP, sådd OK, alla tre positionssparningar OK, −70, −250, +2. Inga nekanden |
| Fas 2 steg 3–4 | – / fas 2 | utan `--djur`: torr → `--commit` → torr | 11 dokument, 1 att skriva (`xp` för `q857n`) → 1 → **0**. Skriptet listar "1 djur UTAN post: q857n: animal_cow#b1" (dokumentet skapades efter steg 1, rättas för hand enligt §9 F7) |
| 4 | fas 2 / fas 2 | `q857t` efter omladdning; epic-körningen i §3 | alla djur syns (4 rumsdjur, 4 husdjur inklusive den gamla flikens ägg, ko + gris). XP 270 = samma som före. `q857n` XP 50 = det härledda värdet |
| 5 | `main` / fas 2 | quiz, Läsresan, stol, gåva, MM | quiz och Läsresan 0 mynt utan krasch (inga ohanterade fel). Stol: "Något gick fel vid köpet: …", saldot oförändrat. Gåva 0. MM +2 (MM-batchen har sitt kvitto) |
| 5, omladdad | fas 2 / fas 2 | quiz, stol | +30/+50 XP, −30 "Du köpte Pall!" |

Avvikelse från produktionen: emulatorn körde grenens functions (B4:s `butikKop`) i alla steg,
även i steg 1–3 där produktionen har fas 1-versionen. Skillnaden gäller bara djur utan
kartpost, och de fanns inte i de stegen.

## 6. Kvoten (skoldag)

En elev på `main` och en på epicen gjorde samma dag: 14 övningar, 4 Läsresan-texter,
2 gåvor och 3 köp. Klientens läsningar och skrivningar räknades i webbläsaren (XHR-logg av
`batchGet`/`commit`) och i proxyn (`Listen`/`Write`).

| | `main` | Epic |
|---|---|---|
| `batchGet`-dokument (transaktioner) | 42 + 3 (köp) | 48 + 0 |
| skrivna dokument i `commit` | 45 + 3 (köp) | 50 + 0 |
| `Listen`-dokument / `Write`-strömmen | 73 / 28 | 73 / 28 |
| `butikKop`-anrop | 0 | 3 |
| regelläsningar (räknade ur regelkoden) | 0 | ≈ 40 (högst 60) |

Per elev och skoldag ≈ 46–66 extra läsningar och 6 extra skrivningar. För 400 elever
≈ 18 000–26 000 läsningar, 2 400 skrivningar och 1 200 anrop per dag, under uppskattningen
28 000 i §5. Detaljer per händelse: `SAKERHET-MYNT.md` §5.1. En `commit` per körning saknades
i XHR-loggen i båda körningarna (samma fel på båda sidor, skillnaden påverkas inte).
Regelläsningarna syns inte i emulatorn (`ruleCoverage` ger inga räknare efter en omladdning
av reglerna), så de är räknade ur koden: `getAfter(myntDag)` i `studentData`-regeln och
`get`/`getAfter(studentData)` i `myntDagOk`.

## 7. Docs

- `BEHORIGHETER.md`: nytt avsnitt "Elevens egen `studentData`" (fält för fält: kvitton,
  varugrenar, djurlistor, skapa/radera) och testnycklarna LÅ/VA. Kontrolltestet är grönt.
- `DATAMODELL.md`: `agdaDjur`, `lastFro`, `lastLiveReceipt`/`lastProvMynt` och
  `studentData/{id}/myntDag/{dag}` med alla fält.
- `ADMIN.md` §9: driftordningen. Fas 1: regler → `butikKop` → migrering `--djur`
  (torr, `--commit`, torr = 0) → webb. Fas 2: `--commit --djur` → låsregler + `butikKop` →
  `--commit` → torr = 0 → webb.
- `SAKERHET-MYNT.md`: §5.1 (uppmätt), B5 Genomfört, §7 (F1, F2), §9 F8 och F9.

## 8. Fynd

1. **F1 – fas 2 deployade inte om `butikKop`** (medel, docs, rättat i docs). B4 ändrade
   `functions/butik/` (`butik-core.js`, `farm-core.js`, `klass-membership.js`: djur utan
   kartpost bevaras vid köp, svaret räknar bara ägda djur), men §7 fas 2 hade inget
   functions-steg. Utan det kör produktionen fas 1-callablen efter låset. Bevis:
   `git diff mynt-fas1..HEAD --stat -- functions/butik`. Nu i `ADMIN.md` §9 och
   `SAKERHET-MYNT.md` §7 (fas 2 steg 2).
2. **F2 – fas 1-webben kräver en egen merge** (medel, driftordning, dokumenterat). GitHub Pages
   deployar `main`, så "fas 1-webben" (`mynt-fas1`) måste mergas till main före epic-PR:en,
   och taggen är bara lokal (`git push origin mynt-fas1`). Nu i `ADMIN.md` §9.
3. **F3 – `test:e2e` föll efter B3** (låg, test, rättat). `test/e2e-auth.test.mjs` test 3
   förväntade att eleven kan skriva `coins: 305` (det stänger B3); test 4 föll som följdfel
   (ingen `signOut`). Fixen: eleven skriver `husLast` (tillåtet), `coins` och kompisens
   dokument nekas, `signOut` i `finally`. 5/5.
4. **F4 – saldot kan sänkas med en påhittad `kcDonation`** (låg, bara självskada). `updateDoc
   {coins: 0, kcDonation: "x/y"}` tillåts (2369 → 0). Utan markör nekas sänkningen.
   §9 F3 sa "bara via donation och köp". Ingen tjänar på det, så förslaget är att godta det
   (§9 F9).
5. **F5 – gamla flikar efter låset** (låg, väntat enligt §7). `main`-webben mot fas 2: övningens
   resultatdata säger +30 fast saldot står still, och köpfelet visar regelns råtext
   ("Något gick fel vid köpet: evaluation error at L213…"). Försvinner vid omladdning.
6. **F6 – ett artbytt mystiskt ägg visas som en annan vanlig art** (info, R5). `px1` sparades
   som `robob`; efter att angriparen skrev `pumpis` (Halloween) visas det som `pingio`.
   Halloween-arten syns inte, och alla vanliga arter kommer ur samma ägg för 200.

**Inte kontrollerat:** Ämnesläsning och Ekvationsresan i jämförelsen (inte i acceptansen;
samma `tjanaMynt` som Läsresan och testade i #853). Mysterylådans dubblettretur (lottningen
slumpas; täcks av `test/functions-butik*.test.mjs`). Prov-mynt (oförändrad väg, testad i
#855). Riktig produktionsdebitering av regelläsningar.

## 9. Köra om

```bash
bash admin/qa-myntsakerhet-857/qa857.sh init               # exporterar main, mynt-fas1, HEAD
PORT=8857 bash admin/qa-myntsakerhet-857/qa857.sh          # emulator + seed + proxy (förgrund)
bash admin/qa-myntsakerhet-857/qa857.sh regler fas1        # main | fas1 | head
bash admin/qa-myntsakerhet-857/qa857.sh webb fas1          # ladda om sidan efteråt
. admin/qa-myntsakerhet-857/q.sh; q m1 "node admin/migrera-mynt-las.mjs --djur"
```

I sidan: `const h = await import('/qa857-h.js')`, sedan `h.loggaIn('q857e')`, `h.ovning()`,
`h.lasresan(4)`, `h.gava(uid)`, `h.shopKop('Möbler', 'stol')` (butiken öppen), `h.mm(3, 1)`
(Mattematchen öppen) och `h.skoldag()`. Konton (lösenord `lilla123`): `q857m`/`q857e` (baslinjen),
`q857m2`/`q857e2` (MM), `q857t` (övergången), `q857x` (angriparen), `q857k` (kompisen),
`qalarare` (admin).
