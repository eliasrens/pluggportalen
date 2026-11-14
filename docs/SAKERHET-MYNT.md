# Myntsäkerhet – kartläggning och plan (epic #851, steg 1 = #852)

**Läge:** kartläggning och plan. Ingen produktkod, inga regler och inga tester är ändrade.
Radnumren gäller `main` vid `6a3b16b` (efter merge av #850).

## 0. Sammanfattning

- **Hålet.** `studentData/{uid}` får skrivas av eleven själv utan fältkontroll
  (`firestore.rules:209–212`: `isSelf(studentId) && kopAvatarOk() && brakdrakeOk() && schackOk()`).
  Från devtools går det alltså att göra `updateDoc(studentData/{mig}, { coins: 99999 })`.
  Samma sak gäller allt annat som har ett värde: `ownedItems`, `ownedCounts`, `pets`,
  `roomAnimals`, `farm.*`-nivåer, `appleCount` och `xp`. Eleven kan dessutom radera sitt
  eget dokument och skapa det på nytt med vilka värden som helst (`allow create/delete: if isSelf`).
- **Vem skriver i dag.** Intjäning sker från 13 vägar och köp från 10 (tabell §2). Fem
  intjäningsvägar och nio köpvägar är rena klienttransaktioner som reglerna inte granskar.
- **Valt angreppssätt: (c) en mix.**
  1. **Intjäning i klientspelen** (övningar, Läsresan, Ämnesläsning, Ekvationsresan och
     gårdens gåva) använder ett **dagskvitto** `studentData/{uid}/myntDag/{dag}`. Det är
     samma mönster som `mmMynt` (#846): reglerna godtar en höjning av `coins`/`xp` bara om
     kvittot ökar lika mycket i samma skrivning, inom ett tak per gång och ett tak per dag.
  2. **Alla köp** går via en ny callable, `butikKop`. Servern läser priset ur katalogen,
     lottar mysterylådan och lägger till varan.
  3. **Låset.** Elevens egen gren av `studentData`-regeln får inte längre ändra `coins`
     annat än via kvittona (dagskvittot, `mmMynt`) eller som ett avdrag ihop med en ny
     `kcDonation`. Varufälten får aldrig växa från klienten, och `create`/`delete` stängs.
     Vilka djur eleven äger, och vilken art de har, läses ur en ny serverkarta
     `agdaDjur` (`{ uid: varu-id }`). Listorna `pets`/`roomAnimals`/`farm.animals` blir
     bara tillstånd (position, namn, matning) och kan inte längre skapa eller byta djur.
  4. Lärar- och servervägarna rörs inte: Live, Prov, Ge mynt (admin), Bråkresan, Hitta
     rätt! och Schack.
- **Steg 2** består av fem issues i §6: B1 dagskvitto, B2 butiken på servern, B3 låset på
  saldot, B4 låset på varor och utseende, B5 slut-QA. B1 och B2 kan köras parallellt.
- **Deploy i två faser** (§7). Fas 1 lägger till kvitton och callable utan att något
  låses: rules → functions → migreringsskriptet → webb. Fas 2 kommer minst en skoldag senare, så att inga gamla
  flikar finns kvar: låsreglerna → migreringsskriptet (`xp` och `agdaDjur` för gamla
  dokument) → webb.

## 1. Hotmodell

Angriparen är en inloggad elev med devtools. Hen har sin egen ID-token och kan skicka
vilken Firestore-skrivning som helst som eleven själv. Det är just detta som gör hen
"isSelf" i reglerna.

| Kod | Missbruk | Möjligt i dag? |
|---|---|---|
| M1 | Sätta ett godtyckligt saldo (`coins: 99999`) | **Ja**, via varje elevskrivning till `studentData` |
| M2 | Höja saldot över modulens gräns (t.ex. betala ut "+50" i en loop) | **Ja** |
| M3 | Sänka en annan elevs saldo | Nej. `isSelf` gäller bara det egna dokumentet. Bara admin/årskurs (kvitto) skriver andras |
| M4 | Få varor gratis (`ownedItems`, `ownedCounts`, djur, ägg, äpplen, gårdsnivåer), eller byta ett ägt djur till en dyrare art (fisk 70 → dinosaurie 190, gris 180 → häst 250, vanligt ägg 200 → Halloween-art 500, `src/shop-items.js:116–127`, `hw-djur.js:29`) | **Ja** |
| M5 | Välja vinsten i mysterylådan | **Ja**, lottningen sker i klienten (`data-mystery.js:45`) |
| M6 | Radera sitt dokument och skapa det igen med valfria värden | **Ja** (`create`/`delete: isSelf`) |
| M7 | Höja `xp`, stjärnor och statistik | **Ja** (det rör inte ekonomin, men det rör lärarens statistik) |

Det här skyddar vi **inte** mot, och det är inte möjligt med den här arkitekturen:
spelen körs i klienten. Varken reglerna eller en callable kan se om ett quiz faktiskt
spelades. För övningar går det därför bara att **begränsa takten** (tak per gång och per
dag), inte att bevisa resultatet. Det gäller båda alternativen, se §4.

## 2. Alla skrivvägar för `coins` och andra känsliga fält

Förklaring av kolumnerna:

- **Typ:** K = klientskrivning med elevens token, L = klientskrivning med lärarens token,
  S = server (Cloud Function, Admin SDK, förbi reglerna).
- **Regel i dag:** den gren i `firestore.rules` som släpper igenom skrivningen.
  "Öppen" betyder `studentData`-regeln rad 209–212 utan fältkontroll.
- **Risk:** M-koderna i §1. ✔ betyder att vägen redan är skyddad.

### 2.1 Intjäning (`coins` upp)

| # | Väg (anropare → skrivning) | Fält | Typ | Regel i dag | Risk |
|---|---|---|---|---|---|
| E1 | Övningar: `awardExercise` `src/game-shared.js:194`. Mynt `:224` → `addCoins` `src/data.js:158`, XP `:227` → `addXp` `src/data-xp.js:32`, framsteg `:231` → `saveProgress` `src/data-progress.js:37`. Anropas via `showResult` från `games-quiz.js:53,138`, `games-match.js:134,232`, `games-jakt.js:173`, `games-rakna.js:314`, `games-sanningsjakt.js:364`, `games-tidsjakt.js:118` och `adventure/reward.js:53` | `coins`, `xp`, `progress.<area>.<mode>` (stjärnor, `plays`, `cat`) | K, tre separata skrivningar | Öppen | M1, M2, M7. Beloppet (`baseCoins`) räknas i klienten. `plays` kan nollställas, så att avtrappningen i `grindMultiplier` aldrig slår in |
| E2 | Läsresan: `completeText` `src/data-lasresan.js:146`. Tillståndet och försöket sparas i en transaktion (`:122,127`). Mynten betalas efteråt `:169` → `award` `src/lasresan/rewards.js:28` → `addCoins` | `lasresa.*`, `lasresaAttempts/{auto}`, `coins` (3/rätt) | K | Öppen (`lasresaAttempts`: `isSelf`) | M1, M2. Mynten betalas i en egen transaktion efter försöket och är inte knutna till det |
| E3 | Ämnesläsning: `completeAmnesText` `src/data-amneslasning.js:130`. Transaktion `:111,116`, sedan `:153` → `award(…, { coins: earnedMoney })` → `addCoins` | `amneslasning.*`, `lasresa` (nivå), försök, `coins` (5/rätt med omläsningstrappa) | K | Öppen | M1, M2 |
| E4 | Ekvationsresan: `completeTask` `src/ekvationsresan/ekv-data.js:107`. Försök och progress i en transaktion, sedan `:132` → `award` `src/ekvationsresan/mynt.js:28` → `addCoins` | `ekvationsresaAttempts/{taskId}`, `ekvationsresa/progress`, `coins` (1–7) | K | Försöket: `ekvAttemptOk` (create-only, mynt 0–7). Saldot: öppen | M1, M2. Försöks-id:t kan hittas på (8–64 tecken), så create-only spärrar inte |
| E5 | Gårdens gåva: `claimFarmAnimalGift` `src/data-farm.js:322`, från `varld-foder.js:137` | `coins` (+`FARM_GIFT_COINS` = 8), `farm.animals[].lastGiftAt` | K | Öppen | M1, M2. `lastGiftAt` kan nollställas, och spärren "en gång per dygn" ligger bara i klienten |
| E6 | Mysterylådans dubblettretur: `openMysteryBox` `src/data-mystery.js:40` (från `pages-shop-mystery.js:55`) | `coins` − pris + `dupCoins` (40–400), `ownedItems` | K | Öppen | M1, M5. Kan **öka** saldot: minilådan kostar 250 och en legendarisk dubblett ger 400 |
| E7 | Mattematchen: MM-svarets batch `src/tavling/answer-writes.js:156` (`mmMynt/{dag}` +1) och `:159` (`studentData.coins` `increment(1)`) | `coins` +1, `mmMynt/{dag}` | K | `mmMynt`: `mmMyntOk` (`firestore.rules:479`). `studentData`: öppen | Kvittot är tätt. Saldot kan ändå skrivas fritt bredvid (M1) |
| E8 | Live: `payLiveRewards` `src/live/live-rewards-pay.js:58` (lärarklienten) | `coins` + `lastLiveReceipt`, kvitto `liveSessions/{sid}/coinReceipts/{uid}` | L | Admin: `isAdmin()`. Årskurskonto: `gradeStudentDataOk` → `liveReceiptPaid` (`:444`) | ✔ (kvitto). Rörs inte |
| E9 | Prov: `betalaProvMynt` `src/prov/prov-mynt-pay.js:71` | `coins` + `lastProvMynt`, kvitto `provMynt/{t}` | L | `provMyntBetalt` (`:450`) + `provMyntKvittoOk` | ✔. Rörs inte |
| E10 | Lärarens "Ge mynt": `src/teacher-class-accounts.js:139` (en elev) och `src/teacher-elever-atgarder.js:134` (hela klassen) → `addCoins(n, elevId)` | `coins` | L | Bara `isAdmin()`. Årskurskontot nekas (`gradeStudentDataOk` har ingen gren för detta, #678 §2.2) | ✔. Se fråga F2 |
| E11 | Bråkresan: `functions/brakresan-avslut.js:127` (stjärna/uppmuntran) och `functions/brakresan-jakt.js:84` (guldjakt) | `coins` `increment`, `brakresaRewards/{eventId}` | S | Admin SDK | ✔ |
| E12 | Hitta rätt!: `functions/hitta-ratt-core.js:193` | `coins` `increment(godkanda)` | S | Admin SDK | ✔ |
| E13 | Schack: `functions/schack-mynt.js:82` (+ `schack.pokaler`, kvitto `schackMynt/{uid}`) | `coins` `increment` | S | Admin SDK | ✔ |

Live-formaten som räknas på servern (Guldrushen, Datakuppen, Meteorstormen och
Kurragömma: `functions/*-mynt.js`, `*-resultat.js`) skriver **inte** `studentData`. De
skriver `result.rewards`, och sedan betalar E8. `src/live/formats/**` visar bara beloppen.

### 2.2 Köp och avdrag (`coins` ned)

Alla köp går från `src/pages-shop.js:271–279` (mysterylådan från `pages-shop-mystery.js:55`).
**Priset skickas från klienten** (`item.price`) och kontrolleras inte mot katalogen.

| # | Väg | Fält | Typ | Regel i dag | Risk |
|---|---|---|---|---|---|
| K1 | `buyItem` `src/data.js:209` (kläder, möbler, dekor, hus, trädgård, frön, avatarer och Halloween-varor) | `coins` − pris, `ownedItems`, `ownedCounts` | K | Öppen (+ `kopAvatarOk` för köpavatarer) | M4. Priset kommer från klienten. Mystery-varor har pris 0 i katalogen och kan "köpas" gratis |
| K2 | `openMysteryBox` `src/data-mystery.js:40` | `coins`, `ownedItems` | K | Öppen | M4, M5 (se E6) |
| K3 | `buyEgg` `src/data-pet.js:193` (även Halloween-ägg, `eggSpecies`) | `pets` (+1), `coins` | K | Öppen | M4 |
| K4 | `buyHeatLamp` `src/data-pet.js:229` | `ownedItems`, `pets[].hasHeatLamp`, `coins` | K | Öppen | M4 |
| K5 | `buyApple` `src/data-pet-mat.js:43` | `appleCount` +1, `coins` | K | Öppen | M4 |
| K6 | `buyAnimal` `src/data-animals.js:101` | `roomAnimals` (+1), `coins` | K | Öppen | M4 |
| K7 | `buyFarmAnimal` `src/data-farm.js:224` | `farm.animals` (+1), `coins` | K | Öppen | M4 |
| K8 | `buyFarmUpgrade` `src/data-farm.js:279` | `farm.gardenTier` / `farm.barnLevel`, `coins` | K | Öppen | M4 |
| K9 | Klasscentrets donation: `planDonationWrites` `src/klasscenter/kc-fund-plan.js:104` | `coins` − n, `kcDonation` | K | `studentData`: öppen. `classCenters/…/donations` + `fund`: `kcCoinsPaid` med `kcDonation`-markören (SAKERHET-klasscentret H1) | ✔ på klassidan. Avdraget är kopplat till exakt en donation |
| K10 | `donateToClassProject` `src/data-classes.js:373` | `coins` − n, `classProjects` | K | Öppen | **Död kod**: inget anropar den (bara en re-export i `data.js:313`) |

Klasskassan (`src/klasscenter/kc-kassa-plan.js`) flyttar klassens kassa. Den rör aldrig
elevens `coins`.

### 2.3 Andra känsliga fält (inga mynt, men värde eller utseende)

| # | Väg | Fält | Typ | Regel i dag | Risk |
|---|---|---|---|---|---|
| F1 | `plantSeed` `src/data-farm.js:110` | `ownedCounts.<frö>` −1, `farm.gardenSlots` | K | Öppen | M4 om räknaren kan **höjas** |
| F2 | `placeApple` / `pickUpApple` `src/data-pet-mat.js:73,100` | `appleCount` ±1, `floorApples` | K | Öppen | M4 (äpplen ur tomma intet) |
| F3 | Husdjur via `updatePets` `src/data-pet.js:143`: `hatchReadyPets :254`, `eatApple :282`, `feedPetBerry :321`, `setPetName :355`, `setPetStowed :373`, `savePetPositions :387`. Migrering av den gamla `pet` `:157` | `pets[]` (art, `feedCount`, position, namn) | K | Öppen | M4: ägg ur tomma intet, och ett vanligt ägg (200) som får en Halloween-art (`eggSpecies`/`speciesId`, 500). `hasHeatLamp` utan lampa. Tillväxten är kosmetisk |
| F4 | Vanliga djur: `saveAnimalPositions/Name/Stowed` `src/data-animals.js:131,160,186`. `animalsFromData` `:66` slår ihop äldre djur från `ownedItems` (`:84–90`), så sparningen skriver en **längre** lista än den som finns sparad | `roomAnimals[]` | K | Öppen | M4: djur ur tomma intet och artbyte (`id` på ett befintligt `uid`, fisk → dinosaurie) |
| F5 | Gården via `updateFarm` `src/data-farm.js:72`: `plantCrop`, `advanceCropGrowth`, `growCropsFromExercise`, `harvestCrop`, `adjustHarvestInventory`, `setAnimalPlacement`, `saveFarmAnimalPositions/Name`, `feedFarmAnimal :311`, `setBarnSkin :364`. Samt `setBarnLevel :346` och `setGardenTier :378`, som inte anropas någonstans | `farm.*` | K | Öppen | M4 (`barnLevel`/`gardenTier`/`animals` gratis, artbyte gris → häst). Skörd och trivsel påverkar bara gåvan (E5) |
| F6 | `saveAvatarItems` `src/data-room.js:39` (från `varld-rum-wear.js:71`) | `avatarItems` | K | Öppen | Bära kläder man inte äger (M4, syns för klasskamrater) |
| F7 | `saveHusSkal` `src/data-room.js:219` (`pages-varld.js:976`) | `husSkalId` | K | Öppen | Hus man inte äger (M4, syns i byn) |
| F8 | `saveRoom` / `saveRoomAt` / `saveGarden` `src/data-room.js:64,187,107` | `room`, `extraRooms`, `garden` (placeringar) | K | Öppen | Placera möbler man inte äger. Kosmetiskt, men syns i kompisrummet (rest R3) |
| F9 | `setAvatar` `src/data-room.js:285` | `avatarId`, `avatarChosen` | K | `kopAvatarOk` | ✔ |
| F10 | `setHusLast` `src/data-room.js:264`, `saveQuestionRotation` `src/data-progress.js:82` | `husLast`, `questionRotation` | K | Öppen | Ingen (elevens eget val) |
| F11 | Läsresan/Ämnesläsning: `startText` `src/data-lasresan.js:78`, `startAmnesText` `src/data-amneslasning.js:70` + E2/E3 | `lasresa.*` (dold nivå, totaler, `moneyEarned`), `amneslasning.*`, `lasresaAttemptsFallback` | K | Öppen | M7 (egen nivå och statistik), rest R2 |
| F12 | Lärarens Läsresan-nivå: `src/data-lasresan-niva.js:68` | `lasresa.level*` | L | `gradeStudentDataOk` → `lasresaLevelOnly` | ✔ |
| F13 | Schack: `src/schack/schack-moln.js:148,166,184` | `schack.datorPartier/lektioner/pussel` | K | `schackOk` | ✔ (`pokaler`/`aktivtParti` bara servern: `functions/schack-mynt.js:82`, `schack-lobby.js:104`, `schack-parti.js:58`) |
| F14 | Bråkdraken: `src/brakresan/rum-drake.js:125` | `brakdrake.pos/room/stowed` | K | `brakdrakeOk` | ✔ |
| F15 | `ensureStudentData` `src/data.js:122` + `tx.set`-reserverna när dokumentet saknas (t.ex. `data.js:166`, `data-farm.js:238`, `data-lasresan.js:93,128`) | hela dokumentet | K | `create: isSelf` | **M6**: create godtar `coins: 99999` |
| F16 | `deleteStudent` `src/data-content.js:293` (lärarsidan) | radera dokumentet | L | `delete: isSelf \|\| isAdmin` | **M6**: eleven får radera sitt eget dokument (appen gör det aldrig) |
| F17 | `kcDonation` (K9) | markör | K | Öppen (verifieras på klasssidan) | ✔ |
| F18 | `lastLiveReceipt` / `lastProvMynt` (E8/E9) | markörer | L | Bara tillsammans med kvittot för årskurskontot | Eleven kan skriva dem, men det är ofarligt. De blir serverfält i låset |

Projektionen `classProjections/{classId}.members.<uid>` (stjärnor, `xp`, `plays`, `ovat`)
speglas från E1 och är skrivbar för klassmedlemmar (`firestore.rules:672`). Den är en
kosmetisk cache som återställer sig själv, och den ingår inte i den här epicen. Se rest R4.

### 2.4 Stickprov mot `git grep`

`git grep -nE 'coins' -- src functions` ger 452 träffar. Alla träffar som **skriver**
saldot finns ovan: E1–E13, K1–K10 och F15. Resten är visning (`coinIcon`, resultatskärmar
i `src/live/formats/**` och butikskort), beräkning av belopp (`rewards-config`,
`regler.js`, `mm-config`, `ekvationsresan/config`), statistikfält som inte är saldot
(`ekvationsresa/progress.coins`, `brakresa/state.hunts.coins`, `hitta-ratt …coins` i
försöket) eller CSS. Skrivprimitiverna har kontrollerats med
`git grep -nE "doc\(db, \"studentData\""` och `tx.(update|set)` i alla `src/data-*.js`.

## 3. Varför vi inte kan låsa ett fält i taget

Reglerna ser bara dokumentets nya tillstånd. `affectedKeys()` säger **vilka** fält som
ändras, men inte **varför**. En klient som får sänka `coins` för att köpa något kan också
lägga till en vara utan att betala, om inte både varan och avdraget kontrolleras ihop. Ett
lås på `coins` kräver därför att:

1. varje legitim **höjning** har ett kvitto som reglerna kan läsa i samma skrivning,
2. varje **köp** antingen sker på servern eller att reglerna kan räkna fram priset, och
3. `create`/`delete` inte kan användas för att börja om.

## 4. Alternativen

| | (a) Bara regler + kvitton | (b) Bara callables | **(c) Mix (valt)** |
|---|---|---|---|
| **Intjäning i klientspel (E1–E5)** | Dagskvitto per källa, tak per gång och per dag | `tjanaMynt`-callable med samma tak | Dagskvitto (som a) |
| **Köp (K1–K8)** | Reglerna måste känna till priset för ca 230 varor (204 statiska, Halloween-katalogen laddas lazy och mystery-varorna har pris 0). Ett tillagt objekt i `pets[]`/`roomAnimals[]`/`farm.animals[]` måste valideras, och lottningen i mysterylådan går **inte** att verifiera | `butikKop`-callable: katalogen och lottningen på servern | `butikKop` (som b) |
| **Skydd** | Intjäning: takt. Köp: svårt att få tätt, M5 olöst | Intjäning: samma takt (servern kan inte heller se spelet). Köp: tätt | Intjäning: takt. Köp: tätt |
| **Kvot per intjäning** (se §5) | ~5 läsningar + 2 skrivningar | ~2 läsningar + 2 skrivningar + 1 anrop | ~5 läsningar + 2 skrivningar |
| **Latens vid resultatskärmen** | Som i dag (en klienttransaktion) | +0,3–3 s (kallstart i `europe-west1`) | Som i dag |
| **Kod att ändra** | Regler: stort (pristabell, listdiffar). Klient: litet | Regler: litet. Functions: stort (5 intjäningar + 9 köp + synk av spelkonfig). Klient: medel | Regler: medel. Functions: en callable. Klient: medel |
| **Deploy-beroende** | Bara regler | Functions för **varje** övning, ett functions-fel stoppar alla mynt | Functions bara för köp |

**Varför (c):**

- **Intjäning med regler.** En callable skulle inte skydda bättre: spelen körs i klienten
  och servern kan inte se dem heller. Däremot skulle den lägga en kallstart och ett
  functions-beroende på varje övning, i den vanligaste vägen i appen. Dagskvittot finns
  redan och är testat i produktion (`mmMynt`, #846), med samma svenska dag
  (`svenskDag(request.time)`) och samma hantering av midnatt (fynden F1/F5 i #848/#849).
- **Köp på servern.** Katalogen är stor och växer (Halloween laddas lazy). Mysterylådan
  måste lottas på servern för att M5 ska gå att stänga. Varuändringarna är listor som
  reglerna inte kan diffa robust inom taket på 1000 uttryck. Köp är sällsynta (några per
  elev och dag), så callablens kostnad och latens märks inte. "Köper…"-knappen finns
  redan.
- **Lås på regelsidan.** Det kostar **0 extra läsningar** för alla vanliga skrivningar
  (flytta möbler, mata djur och så vidare), eftersom grenarna bara körs när `coins`, `xp`
  eller ett varufält faktiskt ändras (`diff().affectedKeys()`, regeln om 1000 uttryck).

## 5. Kvotkostnad (räkneexempel)

Antaganden: 400 elever, 20 utbetalningar per elev och skoldag, 3 köp per elev och dag.
Regelns `get()`/`getAfter()`/`exists()` debiteras som läsningar. Upprepade anrop mot samma
dokument i samma begäran räknas en gång (uppskattning, mät i B5).

| Händelse | I dag | Efter (c) | Skillnad |
|---|---|---|---|
| Övning (E1): mynt + XP | `addCoins` 1L+1S, `addXp` 1L+1S = **2L+2S** | `tjanaMynt` i **en** transaktion: läser `studentData` + `myntDag` (2L), skriver båda (2S), regler: `getAfter(myntDag)` på `studentData` + `get`/`getAfter(studentData)` på `myntDag` (≈3L) = **5L+2S** | +3L, ±0S |
| Läsresan/Ämnesläsning/Ekvationsresan/gåva (E2–E5) | 1L+1S | 5L+2S | +4L, +1S |
| Köp (K1–K8) | 1L+1S (klient) | Callable: 1L (+1L `config/season` för Halloween-varor) + 1S + 1 anrop | ±0 (+1 anrop) |
| MM-svar (E7) | oförändrat + regeln på `studentData` läser `getAfter(mmMynt)` (+1L) | | +1L |
| Allt annat (möbler, djur, schack …) | 0 regelläsningar | 0 (grenarna körs inte) | 0 |

Per dag: ca 400 × 20 × 3,5 L ≈ **28 000 extra läsningar** och ≈ 4 000 extra skrivningar
(E2–E5). Dessutom ≈ 1 200 anrop för köp. I Blaze-pris är det under 0,05 USD per dag.
Alternativ (b) hade gett ungefär lika många läsningar men ≈ 8 000 anrop per dag och en
kallstart vid varje resultatskärm.

### 5.1 Uppmätt i slut-QA (B5, #857)

Samma skoldag för en elev på `main` (main-webb + main-regler) och på epic-grenen
(fas 2-webb + låsregler), mot emulatorn: 14 övningar, 4 Läsresan-texter, 2 gåvor
(= 20 utbetalningar) och 3 köp (möbel, ägg, minilåda). Klientens dokumentläsningar och
skrivningar räknades i webbläsaren (XHR-logg av `batchGet`/`commit`) och i proxyn
(`Listen`/`Write`-strömmarna). Regelns `get()`/`getAfter()` syns inte i emulatorn; de är
räknade ur regelkoden (markerat "regel").

| Per händelse | `main` | Epic | Skillnad |
| --- | --- | --- | --- |
| Övning (mynt + XP) | `addCoins` 1L+1S, `addXp` 1L+1S = 2L+2S i 2 commits | `tjanaMynt`: 2L (`studentData`, `myntDag`) + 2S i 1 commit; regel ≈ 2L (`getAfter(myntDag)`, `get`/`getAfter(studentData)`) | ±0 klient, +≈2L regel, −1 commit |
| Läsresan/gåva (utbetalningen) | 1L+1S | 2L+2S; regel ≈ 2L | +1L +1S, +≈2L regel |
| Läsresans `startText` + försöket | 1L+1S, 1L+2S | samma | 0 |
| Köp | 1L+1S i klienten | 0 i klienten, 1 anrop `butikKop` (servern 1L(+1L `config/season`)+1S) | ±0, +1 anrop |
| Listen-läsningar (sidan, projektionen) och `Write`-strömmen | 73 L, 28 S | 73 L, 28 S | 0 |

Hela skoldagen: `main` 42 `batchGet`-dokument, epic 48 (+6); skrivningar +6;
regelläsningar ≈ 20 × 2 = 40 (högst 60 om `get` och `getAfter` av samma dokument
debiteras var för sig); 3 anrop. Alltså ≈ **46–66 extra läsningar och 6 extra skrivningar
per elev och skoldag**, för 400 elever ≈ **18 000–26 000 läsningar**, 2 400 skrivningar och
1 200 anrop per dag. Det ligger under uppskattningen ovan (28 000), eftersom övningen inte
ökar klientens läsningar (mynt och XP i en transaktion i stället för två). Saldot efter
dagen: lika belopp per händelse (övningarna identiska; Läsresan 3 per rätt, texterna slumpas).

## 6. Steg 2: uppdelning i issues (riskordning)

Låset (B3) stänger det största hålet, M1/M2/M6. Det kan inte landa först: med kvar­
varande klientköp och klientintjäning skulle alla mynt och köp sluta fungera. B1 och B2
är därför förutsättningar, utan risk (additiva), och kan köras **parallellt** (max två
arbetare). Ordningen B3 → B4 följer hålens storlek: saldot först, varorna sedan.
Ingenting deployas förrän allt har landat (§7).

```
B1 dagskvitto ─┐
               ├─► B3 låset på saldot ─► B4 låset på varor/utseende ─► B5 slut-QA
B2 butikKop ───┘                                    ▲
               └────────────────────────────────────┘ (B4 kräver B2)
```

Gemensamt för alla issues: max 400 rader per fil, bootgrafen stannar på 107
(`admin/qa-bootgraf-bfs.mjs`), en emulator åt gången (`flock /tmp/pp-emulator.lock`), nya
regeltester läggs till i `test:rules` i `package.json` och nya functions-tester i
`test:functions`. Regler: validera bara ändrade nycklar.

### B1 – Intjäning med dagskvitto `myntDag` (M2-förutsättning, additivt)

**Mål.** Alla intjäningar i klienten (E1–E5) skriver saldot och ett dagskvitto i **en**
transaktion. Reglerna för kvittot läggs till. `studentData`-regeln ändras **inte** än, så
gamla klienter fungerar som förut.

**Datamodell.** `studentData/{uid}/myntDag/{dag}` (svensk dag `ÅÅÅÅ-MM-DD`, samma
funktion som `myntDag()` i `src/tavling/mm-config.js:39` och `svenskDag()` i reglerna):

```
{ dag, kalla, lastAt, senastMynt, senastXp,
  ovning, lasresa, amnes, ekv, gard,   // mynt per källa i dag
  xp,                                  // XP i dag (bara övningar ger XP)
  gardUid, gavor: { <djur-uid>: true } }  // gåvor i dag, en per ägt gårdsdjur
```

**Regel** (`match /myntDag/{dag}` under `studentData/{studentId}`, funktionen `myntDagOk`,
samma mönster som `mmMyntOk` `firestore.rules:479`):

- `isSelf(uid)`, `dag == svenskDag(request.time) && d.dag == dag`, `d.lastAt == request.time`.
- `d.kalla in ['ovning','lasresa','amnes','ekv','gard']`, och bara `dag`, `kalla`,
  `lastAt`, `senastMynt`, `senastXp`, `d.kalla` och `xp` får ändras (`changedOnly`). För
  `gard` får även `gardUid` och `gavor` ändras.
- `senastMynt == d[kalla] − o.get(kalla, 0)`, `0 ≤ senastMynt ≤ PER_GANG[kalla]` och
  `d[kalla] ≤ PER_DAG[kalla]` (för `ovning`, `lasresa`, `amnes`, `ekv`).
- **Gåvan (`gard`)** knyts till ett **ägt** djur och inte till listan `farm.animals`.
  Listan är fritt skrivbar (B4), så ett tak räknat ur den skulle kunna blåsas upp med
  fejkade djur. Därför:
  - `senastMynt == 8` (`FARM_GIFT_COINS`),
  - `d.gavor.diff(o.get('gavor', {})).affectedKeys() == [d.gardUid].toSet()` och
    `!(d.gardUid in o.get('gavor', {}))`, alltså ett nytt djur och högst en gåva per djur
    och dag,
  - `getAfter(studentData).data.get('agdaDjur', {}).get(d.gardUid, '') in
    ['animal_horse', 'animal_cow', 'animal_pig']`. `agdaDjur` skrivs bara av servern
    (B2/migreringen, låst i B4).

  Dagstaket blir därmed exakt 8 × antal **ägda** gårdsdjur, utan något eget `PER_DAG`.
  Listan över gårdsdjurens varu-id speglas i `src/mynt-dag.js` och hålls i synk med
  katalogen av samma synktest.
- `senastXp == d.xp − o.get('xp', 0)`, `0 ≤ senastXp ≤ XP_PER_GANG`, `d.xp ≤ XP_PER_DAG`,
  och `senastXp > 0` bara när `kalla == 'ovning'`.
- `senastMynt + senastXp ≥ 1`.
- Bindning: `getAfter(studentData).coins == (exists ? get(...).coins : 0) + senastMynt`
  och detsamma för `xp`. En räknare kan alltså inte höjas utan att saldot höjs lika mycket.
- `read: isSelf || hasStudent`, `delete: isAdmin()`.

**Talen** ligger i en ny, ren modul `src/mynt-dag.js` (`KALLOR`, `PER_GANG`, `PER_DAG`,
`XP_PER_GANG`, `XP_PER_DAG`). Ett enhetstest håller dem i synk med `firestore.rules`, som
`test/mm-mynt.test.js`. **Krav:** `PER_GANG[k]` får aldrig skära en legitim utbetalning.
Ett enhetstest räknar ut det största möjliga beloppet för varje källa ur koden
(`baseCoins`-formlerna i `games-*.js`/`adventure/reward.js`/`tidsjakt-core.js`,
`COINS_PER_CORRECT` × max antal frågor, Ämnesläsningens trappa och `COINS.byLevel`) och
kontrollerar `≤ PER_GANG`. Övningsquizens längd beror på lärarens innehåll, så taket måste
täcka det största quiz som redigeraren tillåter. Starttalen står i fråga F1.

**Klient.**

- Ny `src/data-mynt.js` med `tjanaMynt(kalla, mynt, { xp = 0, extra = null })`, en
  transaktion: läs `studentData` och `myntDag/{idag}`, klipp beloppet mot taken och skriv
  båda. `extra` är fältvägar som ska med i samma skrivning (gåvans `farm.animals`).
  Returnerar `{ mynt, xp, tak: bool, saldo }`. Om kvittot nekas (midnatt): läs om och
  försök **en** gång till med den nya dagen, annars `{ mynt: 0 }`. Samma lärdom som F5 i
  #848: anta aldrig att taket är nått bara för att skrivningen nekades.
- `src/game-shared.js` `awardExercise` ersätter `addCoins` + `addXp` med
  `tjanaMynt('ovning', coins, { xp })`. `saveProgress` står kvar.
- `src/lasresan/rewards.js` och `src/ekvationsresan/mynt.js`: `award` tar emot `kalla`
  och anropar `tjanaMynt` (`'lasresa'`, `'amnes'` från `data-amneslasning.js:153`,
  `'ekv'`). Testkroken `addCoins` i signaturen behålls som `betala`.
- `src/data-farm.js` `claimFarmAnimalGift` skriver via `tjanaMynt('gard', 8, { extra,
  gardUid: uid })`. `tjanaMynt` sätter `gardUid` och `gavor.<uid>` i kvittot.
- När taket nås visar resultatskärmen det verkliga beloppet (som i dag) och en rad:
  "Du har fått dagens alla mynt härifrån – resultatet sparas ändå." Det ger ingen ny
  funktion, bara en sann siffra.
- **XP i gamla dokument.** `addXp` skriver i dag `xpFromProgress(progress) + vinst` när
  `xp` saknas (`src/data-xp.js:38`, `src/leveling.js:139–141`). Låset i B3 nekar det, och
  eftersom mynt och XP skrivs i samma transaktion skulle eleven då få 0 mynt för alltid.
  Därför: `tjanaMynt` skriver `xp` **bara när fältet redan finns** (`typeof sd.xp ===
  "number"`). Saknas det skrivs bara mynten och kvittot, och en varning loggas. Det
  härledda XP:t sätts av migreringen (B2, §7) och går inte förlorat. Den här
  försiktigheten ligger i B1 så att fas 1-klienten redan klarar låset.
- `data.addCoins` blir kvar **bara** för lärarens Ge mynt (E10). Inget elevflöde anropar
  den längre (`git grep "addCoins("` visar bara `teacher-*`).

**Tester.**

- `test/firestore-rules-mynt-dag.test.js`. Tillåtet: +n inom taket med `coins` +n i samma
  batch, ny dag, `xp` ihop med `ovning`, `gard` för ett gårdsdjur i `agdaDjur` (och ett
  andra ägt djur samma dag). Nekat: kvitto utan `coins`-höjning, `coins`-höjning ≠
  `senastMynt`, över `PER_GANG`, över `PER_DAG`, gårdagens eller morgondagens id, `d.dag`
  ≠ id, `lastAt` ≠ `request.time`, en annan elevs kvitto, lärare, sänkt räknare, okänd
  källa, två källor i samma skrivning, XP från `lasresa` och radering av eleven. För
  `gard` dessutom: samma djur två gånger samma dag, ett `gardUid` som bara finns i
  `farm.animals`, **`gard` med en uppblåst `farm.animals`-lista** (1 000 fejkade djur, 1
  ägt: bara en gåva går igenom), ett `gardUid` vars `agdaDjur`-värde är ett husdjur, två
  `gavor`-nycklar i samma skrivning, och `senastMynt` ≠ 8.
- `test/mynt-dag.test.js` (enhet): synk mot reglerna, max-belopp ≤ `PER_GANG`,
  klippningen i `tjanaMynt` med injicerat SDK, och att ett dokument utan `xp` får mynt
  men ingen `xp`-skrivning.
- Befintliga enhetstester för `lasresan/rewards`, `ekvationsresan/mynt` och `game-shared`
  uppdateras.

**QA (emulator, `admin/qa-emulator-proxy.mjs`).** Spela ett quiz, en Läsresan-text, en
Ämnesläsning och en Ekvationsresan-uppgift, och hämta en gåva. Saldot ska stiga med samma
belopp som före ändringen, och `myntDag/{idag}` ska visa summorna. Sätt räknaren nära
taket med Admin SDK och kontrollera att utbetalningen klipps och att texten visas.
Gåvan kräver att gårdsdjuret har en post i `agdaDjur`. I QA sätts den med Admin SDK (eller
via `butikKop`/migreringen när B2 har landat).

### B2 – Butiken på servern: callable `butikKop` (M4/M5-förutsättning, additivt)

**Mål.** Alla köp K1–K8 och mysterylådan (E6) går via **en** callable. Priset tas ur
katalogen på servern, och lottningen sker där. Reglerna ändras inte.

**Server.**

- `functions/butik-kop.js`: `butikKop = onCall({ region: "europe-west1", maxInstances: 3,
  memory: "256MiB" })`, exporteras i `functions/index.js`. Indata `{ itemId }`. Svaret har
  samma form som klientfunktionerna i dag: `{ ok, coins, owned?, counts?, pets?, animals?,
  farm?, appleCount?, item?, duplicate?, refund? }`, så att `pages-shop.js:280–288` kan stå kvar.
- En transaktion per köp. Läs `studentData/{uid}` (och `config/season` om varan har
  `collection`). Kontrollera och skriv sedan:
  - Okänd vara, `comingSoon`, mystery-vara direkt (pris 0, `myst-*`) och säsongsvara
    utanför säsong ger `ok:false`.
  - Single-vara som redan ägs ger no-op `ok:true` (som `data.js:219`).
  - Saldo < pris ger `ok:false`.
  - Sedan samma ändringar som K1–K8 gör i dag. **Nytt:** ägg (K3), vanliga djur (K6) och
    gårdsdjur (K7) skriver också `agdaDjur.<uid> = <varu-id>` i samma skrivning
    (`"mystery-egg"`, `"hw-djur-spokis"`, `"hund"`, `"animal_horse"` …). Det är
    ägarbeviset som B4 läser. Kartan används inte förrän B4, så B2 förblir additiv.
  - Mysterylådan: `rollMysteryItem(Math.random, { legendaryChance })` på servern och
    dubblettretur enligt `dupCoins`.
- Eleven måste vara inloggad utan lärar-claim. Ingen klass- eller låskontroll, eftersom
  butiken inte är låsgrindad i dag. **Inga belopp eller odds ändras.**
- Delad ren kod via synk, som `admin/sync-schack-functions.mjs`: ny
  `admin/sync-butik-functions.mjs` + `npm run sync:butik` + predeploy i `firebase.json` +
  `--check`-test. Filerna är `src/shop-items.js`, `src/mystery-items.js`, köpavatarernas
  katalograder (bryts ut ur `src/avatars.js` om filen drar in konst), Halloween-katalogen
  (`src/halloween/hw-kostymer.js` och djurens katalograder i en ny ren fil, bruten ur
  `hw-djur.js`, som importerar konst), `src/season-config.js` och de rena delarna av
  farm-, ägg- och djurlogiken (`farm-core.js` + en ny ren `src/butik-core.js` med
  `kopVara(data, item, { nu, rng, sasong })` → `{ ok, patch, result }`, som både servern
  och enhetstesterna använder).

**Klient.**

- Ny `src/butik-kop.js` (`kop(itemId)`), som laddar `firebase-functions` **dynamiskt**
  (som `src/hitta-ratt/hr-data.js:24,42`), så att bootgrafen inte växer.
- `buyItem`, `openMysteryBox`, `buyEgg`, `buyHeatLamp`, `buyApple`, `buyAnimal`,
  `buyFarmAnimal` och `buyFarmUpgrade` blir tunna omslag runt `kop` (samma signatur, och
  priset ignoreras), eller också anropar `pages-shop.js` `kop` direkt. Efter ett köp körs
  `invalidateStudentData`.
- `plantSeed` (`data-farm.js:110`) skriver också markören `lastFro: cropId` (B4:s regel för
  `ownedCounts`). Ändringen är additiv och ligger här så att fas 1-klienten klarar låset.
- Död kod tas bort: `donateToClassProject` (`data-classes.js:373`, `data.js:313`),
  `setBarnLevel`/`setGardenTier` (`data-farm.js:346,378`, `data.js:333,335`).

**Migrering (ny, Admin SDK).** `admin/migrera-mynt-las.mjs` gör en torrkörning som
standard och skriver med `--commit`. Den är idempotent och går igenom alla
`studentData`-dokument. Logiken ligger i en ren funktion, `planeraMigrering(sd)` →
`patch | null`, i `admin/migrera-mynt-las-core.mjs`, så att den går att enhetstesta. Den
byggs här, eftersom `agdaDjur` införs här och B1:s gåvoregel behöver kartan. Den körs i
**båda** faserna (§7). Skriptet skriver ut antalet dokument per åtgärd, och efter
`--commit` ska en ny torrkörning visa 0.

- **`xp`:** saknas fältet (eller är det inte ett tal ≥ 0) sätts `xp =
  xpFromProgress(progress)` (`src/leveling.js`), samma värde som `xpFromStudentData` visar
  i dag.
- **`agdaDjur`:** för varje djur som saknar en post i kartan gäller följande. Bara
  **första** posten per `uid` (husdjur: per `id`) räknas, samma regel som B4:s
  läsfunktioner. Listorna gås igenom i fast ordning (`roomAnimals`, äldre djur i
  `ownedItems`, `farm.animals`, `pets`). Ett `uid`/`id` som redan har en post i kartan
  (från ett köp, en tidigare lista eller en tidigare körning) får aldrig en ny eller
  ändrad post. Ett uid som är kopierat till en annan lista får alltså fel kategori där och
  syns inte (B4, regel 1). Ett befintligt värde skrivs aldrig över.
  - Varje `roomAnimals`-post får `agdaDjur[uid] = id`. Äldre djur som bara finns i
    `ownedItems` skrivs först in som riktiga `roomAnimals`-poster, med samma `uid` = art-id
    som `animalsFromData` ger i dag, och får sedan en post i kartan.
  - Varje `farm.animals`-post får `agdaDjur[uid] = id`.
  - Varje husdjur i `pets` (och den gamla `pet`, som först migreras till `pets[0]` med
    `petsFromData`, `src/data-pet.js:130`, och skrivs tillbaka) får `agdaDjur[id] = eggSpecies ?
    "hw-djur-" + eggSpecies : "mystery-egg"`.

Tillståndet vid migreringen godtas som utgångsläge (se R6).

**Tester.**

- `test/butik-core.test.js` (enhet): varje kategori, priset ur katalogen (klientens pris
  ignoreras), för lite pengar, okänd vara, `comingSoon`, mystery-vara direkt, säsong
  av/på, single som redan ägs, multi-räknaren +1, ägget med `hatchSpecies` ur katalogen,
  gårdsuppgraderingar i ordning, djurplats och mysterylådan med en fast `rng` (ny vara och
  dubblett).
- `test/functions-butik.test.mjs` (emulator, `FUNCTIONS_EMULATOR_HOST`): ett köp per typ
  sänker saldot med katalogpriset, oinloggad och lärare nekas, och två parallella köp av
  samma single-vara drar bara en gång. Ägg, djur och gårdsdjur får sin post i `agdaDjur`.
- `test/migrera-mynt-las.test.js` (enhet):
  - ett dokument utan `xp` får det härledda värdet, ett dokument med `xp` lämnas orört,
    och `xp: "x"`/negativt rättas,
  - kartan byggs för `roomAnimals`, för äldre djur i `ownedItems`, för `farm.animals`, för
    `pets` och för den gamla `pet`,
  - en duplicerad `uid` ger en enda post,
  - ett `uid` som finns i två listor får bara en post (den första listans), och en
    befintlig post skrivs aldrig över,
  - en andra körning ändrar ingenting.
- Synktestet (`--check`).

**QA.** Köp en möbel, en klädsak, ett ägg, en värmelampa, ett äpple, ett djur, ett gårdsdjur
och en gårdsuppgradering, och öppna en mysterylåda (ny vara och dubblett). Försök med en
Halloween-vara utanför säsong. Kontrollera saldot, butikens "Köpt"-status, rummet och
gården.

### B3 – Låset på saldot (stänger M1, M2, M6) · beroende: B1, B2

**Mål.** Eleven kan inte längre ändra `coins` eller `xp` utan kvitto, och kan inte börja om
genom att radera eller skapa dokumentet.

**Regler** (`firestore.rules:206–212`):

```
allow create: if (isSelf(studentId) && kopAvatarOk() && brakdrakeOk() && schackOk() && elevNyttDokOk()) || isAdmin();
allow update: if (isSelf(studentId) && kopAvatarOk() && brakdrakeOk() && schackOk() && elevVardeOk(studentId)) || isAdmin() ||
  (gradeStudent(studentId) && gradeStudentDataOk(studentId));
allow delete: if isAdmin();
```

- `elevVardeOk(uid)`: `k = n.diff(o).affectedKeys()`.
  - `!k.hasAny(['lastLiveReceipt', 'lastProvMynt'])`.
  - `'coins' in k` ⇒ `n.coins is int && n.coins >= 0` och **ett** av följande:
    - (i) **höjning** med `getAfter(myntDag/{svenskDag(request.time)}).lastAt ==
      request.time && senastMynt == n.coins − o.coins`, eller
      `n.coins − o.coins == 1 && getAfter(mmMynt/{svenskDag(request.time)}).lastAt ==
      request.time` (E7, ingen ändring i MM-klienten),
    - (ii) **sänkning** bara ihop med en ändrad `kcDonation` (K9). Klasscentrets regler
      kontrollerar redan att avdraget = donationen.
  - `'xp' in k` ⇒ `'xp' in o` och höjning med `senastXp == n.xp − o.xp` ur samma
    `myntDag`. `xp` får aldrig tas bort. Ett dokument **utan** `xp` kan alltså inte få XP
    från klienten. Det får sitt startvärde av migreringen nedan, och fram till dess ger
    B1-klienten mynt utan XP.
- Med dessa grenar körs inga `get` för skrivningar som inte rör `coins`/`xp`.
- `elevNyttDokOk()`: `coins`, `xp` och `appleCount` är 0 eller saknas, och `ownedItems`,
  `ownedCounts`, `pets`, `roomAnimals` och `farm.animals` är tomma eller saknas, med
  `farm`-nivåerna ≤ 1. Det är vad `defaultStudentData()` (`src/klass-membership.js:79`)
  ger.

**Klient.** Ta bort `tx.set(…{ coins: n })`-reserverna som skapar ett dokument med mynt
(F15). Dokumentet finns alltid efter `ensureStudentData` vid inloggningen. `admin/qa-*`
som skriver elevens `coins`/`xp` som eleven (t.ex. `admin/qa-lararkonton-drift.mjs:155`)
uppdateras.

**Migrering.** `xp`-delen av `admin/migrera-mynt-las.mjs` (byggs i B2) gör låset ofarligt
för gamla dokument utan `xp`.

**Tester.**

- `test/firestore-rules-mynt-las.test.js`. Nekat: `update {coins: 99999}`,
  `increment(1)` utan kvitto, `setDoc` av hela dokumentet med högre saldo, kvitto + saldo
  som inte stämmer, gårdagens kvitto, en annan elevs kvitto, MM-kvitto med +2, `coins` som
  sträng eller decimaltal, negativt saldo, sänkning utan `kcDonation`, `xp` utan kvitto,
  borttagen `xp`, `xp` som sätts i ett dokument utan `xp` (även med kvitto), `create`
  med `coins: 5`, `delete` av eget dokument och en annan elevs
  saldo (M3). Tillåtet: utbetalning via `myntDag`, utbetalning med bara mynt (ingen
  `xp`) för ett dokument utan `xp`, MM-svar (de befintliga MM-sviterna ska
  vara gröna), donation (de befintliga `-fund*`-sviterna), Live och Prov som admin och
  årskurs (de befintliga `-live-rewards`, `-roller-*`, `-prov-mynt*`), admin Ge mynt,
  ny elev med standarddokument, och alla andra fält (möbler, schack, Läsresan) som förut.
- `test/firestore-rules.test.js:110` ("kan … skriva sin egen studentData (coins …)")
  ändras till att neka saldot och tillåta `progress`.
- **Gränstest**, som `test/firestore-rules-schack-uttryck-792.test.js`: en fullt fylld elev
  (schack, alla fält, största `myntDag`) skriver mynt, och MM-svarets batch går fortfarande
  igenom. Det fångar taket på 1000 uttryck och gränsen på 20 dokumentåtkomster per batch.

**QA.** Kör `updateDoc(studentData/{mig}, { coins: 99999 })` från devtools mot emulatorn:
det ska nekas. Spela ett quiz, svara rätt i MM, donera i Klasscentret, betala ut Live som
årskurskonto och ge mynt som admin. Allt ska fortsätta fungera.

**Genomfört (#855).** Reglerna `elevVardeOk`/`elevMyntOk`/`elevXpOk` och `elevNyttDokOk`
i `firestore.rules`, testerna `test/firestore-rules-mynt-las.test.js` och
`test/firestore-rules-mynt-las-grans.test.js`. Två avvikelser från texten ovan:

- `elevNyttDokOk` godtar också `coins > 0` om ett kvitto betalar exakt det beloppet i
  samma begäran (samma regel som en höjning från 0). MM-svarets batch skriver saldot
  med `set(merge)` och skapar därför dokumentet om det saknas; utan undantaget skulle
  de befintliga MM-sviterna (`-mattematchen-live-847-tester`) nekas. `create` med
  `coins: 5` utan kvitto nekas som förut.
- Gränstestet: en fullt fylld elev tjänar mynt + XP, också ihop med schackskrivningar
  (lektioner, pussel, `datorPartier`) i samma skrivning. Schackets **värsta** fall (alla
  12 lektioner + båda pusslen + `datorPartier`) ihop med mynt i **samma** skrivning når
  taket på 1000 uttryck och nekas. Ingen klient gör så (schackets mynt betalas av
  servern), och schackets värsta fall utan mynt går igenom som förut.

- `elevNyttDokOk` kräver `xp: 0` (testarens F1: annars räknas nivån ur `progress`, som
  eleven skriver fritt, och `xp` kan aldrig sättas). `setAvatar` och MM-svarets saldo,
  som kan skapa dokumentet utan `defaultStudentData`, skickar därför `xp: increment(0)`
  (orört när `xp` finns). I ett gammalt dokument utan `xp` godtas `xp: 0` bara om
  `progress` är tomt; annars nekas de två skrivningarna tills migreringen satt `xp`.
  Fas 2-webben måste alltså gå ut **efter** migreringen (§7 steg 2–4).

`tjanaMynt` skriver ingenting om `studentData` saknas (F15). `data.addCoins` (bara admins
Ge mynt) behåller sin reserv: admin får skapa dokumentet.

### B4 – Låset på varor och utseende (stänger M4, resten av M7-XP) · beroende: B2, B3

**Mål.** Klienten kan inte längre skapa varor och inte heller byta art på ett djur den
äger. Det klienten själv gör (flytta, mata, så, lägga ut äpplen) fungerar som förut.

**Djuren: ägandet flyttar till serverkartan `agdaDjur`.** Reglerna kan inte gå igenom en
lista. En kontroll som "`id` för varje `uid` är oförändrat" går därför inte att uttrycka
för `pets[]`/`roomAnimals[]`/`farm.animals[]`, och "`size()` får inte öka" skulle neka en
vanlig sparning, eftersom `animalsFromData` (`src/data-animals.js:84–90`) slår ihop äldre
djur från `ownedItems` och sparar en längre lista. Ägandet läggs i stället i en karta som
bara servern skriver, `agdaDjur: { <uid>: <varu-id> }` (B2 skriver den vid köp och
migreringen för gamla djur). De tre läsfunktionerna som all ritning går igenom läser den:

- **Gemensam regel 1, egen kategori:** en post räknas bara om kartans värde hör till
  **listans** kategori. `animalsFromData` godtar `isAnimalItem(v)`, `farmFromData` godtar
  `isFarmAnimalItem(v)` och `petsFromData` godtar `v == "mystery-egg"` eller
  `v.startsWith("hw-djur-")` (`src/shop-items.js`). Annars skulle ett ägt rumsdjurs `uid`
  (värde `dinosaurie`) kunna kopieras in i `farm.animals`, eller en gårdshäst in i
  `roomAnimals`, och ett köp synas på två ställen.
- **Gemensam regel 2:** bara den **första** posten per `uid` (husdjur: per `id`) räknas.
  Senare dubbletter tas bort och får inget nytt `uid`. I dag ger `animalsFromData`
  (`:74`) en dubblett ett nytt uid, och `petsFromData`/`farmFromData` behåller dem. Utan
  den här regeln skulle en enda ägd post (en häst, ett Halloween-ägg) kunna kopieras N
  gånger i listan.
- `animalsFromData` (`src/data-animals.js:66`): returnerar bara djur vars `uid` finns i
  `agdaDjur` och tar arten (`id`) ur kartan. Listans `id` ignoreras. Sammanslagningen av
  äldre djur från `ownedItems` tas bort, eftersom migreringen har gjort dem till riktiga
  poster.
- `farmFromData` (`src/farm-core.js:134`): samma regel för `animals`. (`farm-core.js` är ren
  och får därför kategorikontrollen som en injicerad eller lokal lista över gårdsdjurens
  id. Den ska inte importera hela `shop-items.js` om bootgrafen då växer. Kontrollera med
  `admin/qa-bootgraf-bfs.mjs`.)
- `petsFromData` (`src/data-pet.js:130`): bara ägg och djur vars `id` finns i kartan.
  Värdet `hw-djur-<art>` ger arten (`eggSpecies` och `speciesId` i listan ignoreras).
  Värdet `mystery-egg` får bara en vanlig art. En Halloween-art i `speciesId` ersätts med
  en vanlig art som räknas fram deterministiskt ur djurets `id`. `hasHeatLamp` gäller bara
  om `varmelampa` finns i `ownedItems`.

Eftersom alla vyer (rummet, gården, byn och kompisrummet) går genom de här funktionerna
syns ett fejkat eller artbytt djur ingenstans. Listorna blir fritt skrivbart tillstånd, så
reglerna behöver inga storleksregler för dem.

**Regler** (läggs till i `elevVardeOk`, varje gren bara när fältet finns i `k`):

- `ownedItems` och `agdaDjur`: får inte ändras (bara servern).
- `ownedCounts`: bara `plantSeed` får röra fältet, och bara med markören `lastFro`. Det är
  samma idé som `kcDonation`. Ändringen måste gälla precis nyckeln `n.lastFro` och sänka
  den: `n.ownedCounts[n.lastFro] < oldCount(o, n.lastFro)`, där `oldCount` = `o.ownedCounts`
  eller 1 om id:t finns i `ownedItems`, och värdet måste vara ≥ 0. (`plantSeed` skriver
  `lastFro` sedan B2.)
- `pets`, `roomAnimals`, `farm.animals`: ingen regel (se `agdaDjur` ovan).
- `appleCount` + `floorApples.size()`: summan får inte öka.
- `farm`: inuti `farm.diff(o.farm).affectedKeys()` får `barnLevel`/`gardenTier` inte ändras,
  och `barnSkin` ska vara `null` eller finnas i `ownedItems`.
- `avatarItems` ⊆ `ownedItems` och `husSkalId` ∈ `ownedItems ∪ {null}`. **Kontrollera
  först** att inga gratisplagg eller gratishus saknas i `ownedItems` (grundavatarens kläder,
  standardhus). Finns de ska de stå i en uttrycklig lista.
- `elevNyttDokOk()` (B3) kräver dessutom att `agdaDjur` är tom eller saknas.

**Migrering.** `agdaDjur`-delen av `admin/migrera-mynt-las.mjs` (byggs i B2) ger alla
befintliga djur en post i kartan innan de nya läsfunktionerna går ut.

**Tester.**

- `test/firestore-rules-mynt-varor.test.js`.
  - Nekat: `arrayUnion` i `ownedItems`, varje skrivning till `agdaDjur` (ny post och
    byte av art), en höjd `appleCount`, ett äpple som läggs ut utan att `appleCount`
    sjunker, `ownedCounts` +1, `ownedCounts` −1 på en annan nyckel än `lastFro`, en höjd
    `barnLevel`/`gardenTier`, ett plagg eller hus man inte äger och en `barnSkin` man inte
    äger.
  - Tillåtet: att flytta, döpa och lägga undan djur, **också när listan är längre än den
    sparade** (den gamla sammanslagningen från `ownedItems` i `saveAnimalPositions`), mata,
    kläcka, lägga ut och plocka upp äpplen, så ett frö, mata gårdsdjur, bära ett ägt plagg
    och byta till ett ägt hus.
- `test/djur-agande.test.js` (enhet) för de tre läsfunktionerna:
  - ett djur utan post i kartan syns inte,
  - ett ändrat `id` (fisk → dinosaurie, gris → häst) ger kartans art,
  - ett vanligt ägg med `eggSpecies`/`speciesId` = Halloween-art blir en vanlig art,
  - ett Halloween-ägg behåller sin art,
  - `hasHeatLamp` utan lampa ger ingen effekt,
  - ett migrerat äldre djur syns som förut,
  - **ett `uid` från en annan lista syns inte**: ett ägt rumsdjurs `uid` (`dinosaurie`)
    kopierat till `farm.animals`, en gårdshäst kopierad till `roomAnimals` och ett
    Halloween-äggs `id` som `uid` i `roomAnimals` syns bara i sin egen lista,
  - **en duplicerad `uid`/`id` syns en gång**: en häst i `farm.animals`, ett Halloween-ägg
    i `pets` och ett djur i `roomAnimals`, var och en kopierade 5 gånger, ger ett enda djur.
- `test/firestore-rules-avatarer.test.js:39` (eleven köper med `arrayUnion` själv) skrivs
  om, så att köpet sker med regler avstängda eller via callable-testet, och regeltestet
  bara byter avatar.
- Gränstest som i B3.

**QA.** Gå igenom rummet, gården och husdjuren med en elev som äger allt (inredning,
djur, äpplen, frön, kläder och hus), och med en äldre elev som har djur i `ownedItems`
före och efter migreringen. Inget får nekas i konsolen och inget djur får försvinna.
Försök med devtools: `ownedItems` + vara, `agdaDjur` + djur och `appleCount: 99` ska
nekas. Ett nytt ägg i `pets` och att byta `roomAnimals[0].id` till `dinosaurie` går att
skriva, men det syns inte i rummet, i byn eller i kompisrummet.

**Genomfört (#856).** Läsfunktionerna (`animalsFromData`, `farmFromData`, `petsFromData`
i `src/data-pet.js`) går via de rena hjälparna `agdaPoster`/`medDoldaPoster` i
`src/farm-core.js` (gårdsdjurens id som lokal lista `GARDSDJUR`, bootgrafen 107). Reglerna
är grenarna i `elevVardeOk` (`elevFroOk`, `elevApplenOk`, `elevGardOk`, `elevKladerOk`, husets
villkor) och tilläggen i `elevNyttDokOk`. Testerna: `test/firestore-rules-mynt-varor.test.js`,
`test/djur-agande.test.js` och varufälten i gränstestet. Avvikelser och tillägg:

- **Inget djur försvinner vid sparning.** Sparningen (`saveAnimal*`, `updatePets`,
  `updateFarm`, gåvan och butikens gårdsdjursköp) skriver tillbaka den sparade listan med
  de ändrade ägda posterna på sin plats (`medDoldaPoster`). Poster utan kartpost ligger
  kvar orörda, så ett djur som saknar kartpost inte raderas (det kan rättas för hand, §7).
- **Migreringen ger djur poster bara med `--djur` (löst i #856).** Granskningen visade att
  migreringen bygger `agdaDjur` ur listorna, som är fritt skrivbara efter låset: en körning
  efter låsreglerna skulle ge en inskjuten post (en extra häst i `farm.animals`, ett ägg i
  `pets`) en kartpost. Därför skriver skriptet bara `xp`/`coins` utan flaggan. Djur utan
  post listas då (antal + dokument: uid) men får ingen. `--djur` körs bara **före**
  låsreglerna (§7). Kärnan: `planeraMigrering(sd, rakna, { djur })`.
- `klass-membership.js` `petsFromData` heter nu `sparadePets` (listan som den är sparad).
  Butiken och migreringen läser den, och migreringen läser `farm.animals` rått, eftersom
  de nya läsfunktionerna döljer djur utan kartpost.
- Butikens svar `animals` för ett vanligt djur är de ägda djuren (butikens antal per art).
- `avatarItems`: det som **tas på** måste vara ägt. Att ta av går alltid, också en sak som
  sedan förr saknas i `ownedItems`. Gratishuset är `"stuga"` (väljaren skriver det), så
  `husSkalId` ∈ `ownedItems ∪ {null, "stuga"}`. Gratiskläder finns inte: klädlådan visar
  bara `ownedItems`.
- `elevNyttDokOk` kräver dessutom tomma `avatarItems`, `husSkalId` null/`"stuga"` och
  `farm.barnSkin` null, så att ett nytt dokument inte kan bära köpt utseende.
- Gränstestet: den fulla eleven skriver alla varufält (möbler, djur, äpplen, frö, kläder,
  hus, lada) ihop med mynt + xp och vanliga schackskrivningar, och utan mynt ihop med
  schackets värsta fall. Marginalen till 1000 uttryck är liten. Därför har grenarna inga
  typkontroller som reglerna ändå fångar (`diff`/`toSet` på fel typ nekar).

### B5 – Slut-QA · beroende: B1–B4

- Alla sviter ska vara gröna: enhet (`node --test` på `test/*.test.js` utom emulator­testerna),
  `npm run test:rules`, `npm run test:functions` och `npm run test:e2e`. Bootgrafen ska vara
  107.
- E2E/manuellt mot emulatorn (epicens acceptans): ett quiz/övning, Läsresan, ett köp
  (möbel + mysterylåda), en Live-utbetalning, lärarens Ge mynt (admin) och Mattematchen.
  Saldot ska stiga och sjunka med exakt samma belopp som på `main`. Gör en jämförelse med
  samma förlopp på `main`.
- Attackerna i §1 körs från devtools. M1–M6 ska nekas. Artbytet i M4 (fisk → dinosaurie,
  gris → häst, vanligt ägg → Halloween-art), kopierade poster av ett ägt djur och ett
  `uid` som flyttats till en annan lista syns ingenstans. Gåvan ger 8 per **ägt** gårdsdjur och dag, även om listan blåses upp.
- **Övergången**, med samma emulatordata genom alla fyra stegen:
  - `main`-webben mot fas 1-reglerna: allt ska fungera som förut.
  - Fas 1-webben (taggen `mynt-fas1`) mot fas 1-reglerna efter migreringen: allt ska
    fungera, gåvan också.
  - Fas 1-webben mot fas 2-reglerna före migreringen: mynt ska fungera, även för ett
    dokument utan `xp` (då utan XP), och köp, frön och djursparning ska fungera.
  - Fas 2-webben efter migreringen: alla djur syns, XP finns och visas som förut.
  - Dessutom `main`-webben mot fas 2-reglerna: övningar ger 0 mynt utan krasch, köp visar
    "Något gick fel vid köpet" utan att mynt försvinner, och efter en omladdning fungerar
    allt.
- Migreringsskriptet mot emulatorn: torrkörning, sedan `--commit`, sedan en ny
  torrkörning som ska visa 0.
- Mät kvoten för ett skoldagsscenario (§5) och skriv in de verkliga talen här.
- Uppdatera `docs/BEHORIGHETER.md` (rad `studentData` + nya rader för `myntDag` och
  `butikKop`), `docs/DATAMODELL.md` (`myntDag`, `lastFro`, `agdaDjur`) och `docs/ADMIN.md`
  (driftordningen i §7).

**Genomfört (#857).** Rapport med bevis: `docs/QA-RAPPORT-myntsakerhet-851.md`. Sviterna
gröna (enhet 4422, `test:rules` 1066, `test:functions` 573, `test:e2e` 5 efter en testfix),
bootgrafen 107. Övergången kördes i en emulator genom alla stegen ovan, beloppen är
desamma som på `main`, M1–M6 nekas och kvoten står i §5.1. Två tillägg i §7: fas 2
deployar om `butikKop` (B4 ändrade `functions/butik/`), och fas 1-webben kräver en egen
merge av `mynt-fas1` till main eftersom Pages deployar main.

## 7. Deploy-ordning och övergång

Grundordningen är **rules → functions → webb**. Den räcker dock inte: elever har
flikar öppna hela dagen, och GitHub Pages cachar moduler i ungefär 10 minuter. Om låset
deployas samtidigt som den nya webben nekas alla gamla flikar (övningar ger 0 mynt och
köp misslyckas) tills eleven laddar om. Därför används två faser:

| Fas | Vad | Ordning | Effekt på gamla klienter |
|---|---|---|---|
| **1** (taggen `mynt-fas1`, efter B1 + B2) | Reglerna med bara `myntDag`-matchen tillagd (additivt). `studentData`-regeln är oförändrad. Webben: kvittot, `butikKop`, `lastFro` och XP bara när fältet finns | 1. `firebase deploy --only firestore:rules` 2. `npm run sync:butik && firebase deploy --only functions:butikKop` 3. `node admin/migrera-mynt-las.mjs --djur` (torrkörning) och sedan `--commit --djur` 4. webben | Ingen. Gamla flikar skriver som förut, nya använder kvitto och callable |
| **2** (epicens slut, minst en skoldag efter fas 1) | Hela låset (B3 + B4) och de nya läsfunktionerna för djur | 1. `node admin/migrera-mynt-las.mjs --commit --djur` precis **före** låsreglerna (fångar djur som köpts av gamla flikar sedan fas 1) 2. `firebase deploy --only firestore:rules`, sedan `npm run sync:butik && firebase deploy --only functions:butikKop` (B4 ändrade `functions/butik/`, #857) 3. `node admin/migrera-mynt-las.mjs --commit` **utan** `--djur` (`xp` för dokument som fortfarande saknar det) 4. torrkörning = 0 `xp`-ändringar 5. webben | Fas 1-flikar klarar låset (se B5). Flikar som varit öppna sedan före fas 1 förlorar mynt och köp tills de laddar om, men data går aldrig förlorad |

Praktiskt: leaden taggar commiten efter B2 som `mynt-fas1`. Ingenting av detta görs i
epicen, eftersom Elias deployar. GitHub Pages deployar `main` automatiskt, så fas 1-webben kräver en
egen merge av `mynt-fas1` till main före epic-PR:en (#857, `docs/ADMIN.md` §9). Beroenden:

- `butikKop` och `myntDag`-regeln måste finnas innan fas 1-webben går ut. Annars
  misslyckas alla köp och övningar ger 0 mynt. Migreringen körs i fas 1 **före** webben,
  så att B1:s gåvoregel (som kräver en post i `agdaDjur`) fungerar för befintliga
  gårdsdjur från första början.
- Fas 2 måste köras i ordningen **`--djur` → låsreglerna → migrering utan `--djur` → webb**:
  - `--djur` körs **precis före** låsreglerna. Fram till låset kan eleven ändå skriva
    `agdaDjur` själv, så det som finns då räknas som utgångsläge (R6). Körningen ger djur
    som gamla flikar köpt sedan fas 1 (utan kartpost) sin post.
  - Kör **aldrig** `--djur` efter låsreglerna. Listorna `pets`/`roomAnimals`/`farm.animals`
    är fritt skrivbara för eleven, så ett inskjutet djur skulle få en post. Ett djur som
    saknar post efter låset (skriptet utan `--djur` listar dem) rättas för hand med Admin
    SDK, aldrig med `--djur`.
  - Körningen utan `--djur` efter låset ger `xp` till dokument som fortfarande saknar det.
    Den skriver aldrig `agdaDjur`, så den får köras när som helst.
  - Båda körs **efter** att alla flikar från före fas 1 är borta, och **före** fas
    2-webben, som döljer djur utan kartpost.
- Mellan steg 2 och 5 i fas 2 kör eleverna fas 1-webben. Den klarar låset: mynt utan XP om
  `xp` saknas, `lastFro` skrivs, och den gamla djurläsningen gäller fortfarande.

**Migrering** (`admin/migrera-mynt-las.mjs`, byggs i B2, körs i båda faserna; djuren bara
med `--djur`, #856) gör följande:

- Gamla dokument utan `xp` får `xpFromProgress(progress)`. Det är samma värde som visas i
  dag, så ingen elev tappar eller får XP.
- Med `--djur`: alla befintliga djur (`roomAnimals`, äldre djur i `ownedItems`,
  `farm.animals`, `pets` och den gamla `pet`) får en post i `agdaDjur` med den art de har i
  dag. Utan flaggan listas djur som saknar post, men inget skrivs.
- Saldon och varor ändras inte.

Om skriptet glöms bort, eller missar ett dokument: eleven får mynt men ingen XP, djur utan
kartpost syns inte, och gårdsdjur utan kartpost ger ingen gåva. Inget går förlorat. `xp`
rättas genom att köra skriptet igen. Djuren rättas med `--djur` bara före låsreglerna;
efter låset rättas de för hand (se ovan).

## 8. Kvarvarande risker (accepterade, skrivs in i rapporten)

- **R1 – takten, inte beviset.** En elev som skriptar kan ta ut hela dagstaket för varje
  källa varje dag, utan att spela. Det är summan av `PER_DAG` i stället för obegränsat.
  Övningar körs i klienten, och mer än så går inte utan att flytta spelen till servern.
- **R2 – egen statistik.** `progress` (stjärnor, `plays`, `cat`), `lasresa` (dold nivå,
  totaler) och `amneslasning` är fortfarande fritt skrivbara för eleven själv. De påverkar
  inte saldot (varje utbetalning är ändå begränsad), men lärarens statistik kan förfalskas
  av eleven själv. Det kan bli en egen epic.
- **R3 – kosmetiska placeringar.** `room`/`extraRooms`/`garden`-placeringar kan peka på
  möbler man inte äger, eftersom nycklarna (`soffa#2`) inte går att kontrollera mot
  `ownedCounts` i reglerna. Det kan åtgärdas billigt vid ritningen: kompisrummet och byn
  ritar bara ägda saker. Det ingår inte i den här epicen.
- **R4 – `classProjections` och `classProjects`.** Båda är skrivbara för klassmedlemmar
  (`firestore.rules:672,693`) och visar stjärnor och XP. Det är kosmetiska cachar som
  återställer sig själva. `classProjects` används inte längre (K10).
- **R5 – husdjurens inre fält** (`feedCount`/tillväxt, namn, position, och vilken
  **vanlig** art ett vanligt ägg kläcks till) och gårdens skörd och trivsel kan sättas av
  eleven. Det är kosmetiskt och kostar inget i butiken: alla vanliga arter kommer ur samma
  ägg för 200. Artbyte till en dyrare vara och `hasHeatLamp` stängs i B4. Gåvan (E5)
  ges bara en gång per **ägt** gårdsdjur (`agdaDjur`) och dag (`myntDag.gavor`).
- **R6 – låset gäller framåt.** Mynt, varor och djur som någon redan har fuskat till sig
  före fas 2 finns kvar. Det finns ingen historik att jämföra mot, så migreringen tar
  dagens tillstånd som utgångsläge.

## 9. Öppna frågor till Elias (med antagna beslut)

| # | Fråga | Antaget beslut (gäller tills du säger annat) |
|---|---|---|
| F1 | Vilka tak per gång och per dag? | Ska aldrig märkas för en ivrig elev. Starttal: **per gång** = största legitima beloppet (testet i B1 räknar fram det, uppskattning: övning ≤ 200, Läsresan ≤ 60, Ämnesläsning ≤ 100, Ekvationsresan 7, gåva 8). **Per dag**: övning 1 500, Läsresan 400, Ämnesläsning 400, Ekvationsresan 300, gåva 8 per ägt gårdsdjur (ett kvitto per djur och dag, inget eget tak), XP 3 000. Talen står i en fil (`src/mynt-dag.js`) och speglas i reglerna, så de är lätta att ändra. **Justerat i B1 (#853):** per gång övning 500 (Fånga sanningar har inget slut), Ämnesläsning högst 20 frågor per text (fel i valideringen) så 100 räcker. Per dag Ekvationsresan 600 (testaren nådde 300 på en ivrig dag), Läsresan 800 (≈ 30 texter à 27) och Ämnesläsning 800 (≈ 23 nya nivå 3-texter à 35), eftersom 400 kunde nås på en tung men normal läsdag |
| F2 | Epicen säger att "lärare med klassen" får justera. #678 §2.2 sa att bara admin får ge pluggmynt direkt, och årskurskontot nekas i dag (Test 18). Ska årskurskontot få Ge mynt? | **Nej, oförändrat.** Admin har alla klasser och uppfyller kravet. Knappen visas för årskurskonton men nekas. Det är ett befintligt UI-fel som kan bli en egen issue |
| F3 | Får saldot sjunka bara via donation (som i B3) eller också fritt (eleven skadar bara sig själv)? | **Bara via donation och köp** (köp sker på servern). Det är striktare och billigt |
| F4 | Är resterna R1–R6 acceptabla för den här epicen? | **Ja.** R2 (statistiken) och R3 (ritfiltret) föreslås som egna issues senare |
| F5 | Är det OK med deploy i två faser (§7)? | **Ja.** Det är det enda sättet att undvika att elever med öppna flikar förlorar mynt under övergången |
| F6 | Ska mysterylådans odds och dubblettretur ändras nu när de ligger på servern? | **Nej.** Samma tal, samma `rollMysteryItem`. Epicen ändrar inga belopp |
| F7 | Ett djur som en gammal flik köper (fas 1-webben går via `butikKop` och får alltid en post, men en flik från före fas 1 gör det inte) under minuterna mellan fas 2 steg 1 (`--djur`) och steg 2 (låsreglerna) får ingen kartpost och syns inte efter fas 2-webben. Hur ska det hanteras? | **För hand.** Skriptet utan `--djur` listar djur som saknar post (dokument: uid). Kontrollera köpet (saldot sjönk) och lägg posten med Admin SDK. Kör aldrig `--djur` efter låset (#856) |
| F8 | Klassprojektionen `classProjections/{classId}.members.<uid>` är skrivbar för klassmedlemmar (R4). Där speglas också `avatarItems` och `husSkalId`, så en elev kan visa kläder och hus i byn som hen inte äger (#856, fynd F2). Ska byn läsa utseendet ur `studentData` i stället, eller räcker det att projektionen återställs vid nästa egna sparning? | **Ingen ändring i epicen.** Kosmetiskt (inga mynt eller varor), syns bara i byn. Föreslås som egen issue ihop med R3 (rita bara ägda saker) |
| F9 | Saldot får sänkas av eleven själv ihop med vilken `kcDonation`-markör som helst. Reglerna för `studentData` kontrollerar inte att donationen finns (det gör klassidan). Eleven skadar bara sig själv (#857). Räcker det? | **Ja.** Att kräva donationsposten i samma regel kostar en läsning per donation och ger inget skydd mot fusk, eftersom ingen tjänar på att sänka sitt saldo |
