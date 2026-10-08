# Klasscentret – säkerhetsgranskning av reglerna (#500, epic #473)

Granskat: allt under `match /classCenters/{classId}` i `firestore.rules`
(rad 544–882) – klass-EXP (`expShards`/`expMembers`), crowdfunding
(`fund`/`donations`), layout (`layout/current` + `layoutHistory`),
klassprofilen (`inredningSparr`) och pokaler (`trophies`). Allt är bevisat
med regeltester i emulatorn. Inget är deployat.

**Resultat:** 2 hål hittade och rättade (H1 allvarligt, H2 integritet).
`npm run test:rules` **254/254** (var 214; +40 nya), enhetssviten
**1132/1132**. ⚠️ `firebase deploy --only firestore:rules` krävs före live
(gällde redan för hela Klasscentret).

## Hittade hål

### H1 (allvarligt, rättat) – flera donationer på ett myntavdrag

`kcCoinsPaid(n)` kontrollerade bara att `studentData.coins` efter batchen är
`före − n`. Varje donationspost i en batch jämfördes mot **samma**
saldo-skrivning. Det gick alltså att lägga flera donationer (olika föremål,
eller samma id i två klasser för en elev som går i båda) i en batch med ETT
avdrag. Bevisat i emulatorn: 100 mynt gav 200 insamlat. Med alla 8 föremål
blir det 8 × beloppet. Appen gör aldrig så, men vem som helst med devtools
kan.

**Rättelse:** donationen kräver nu dessutom
`getAfter(studentData/{uid}).kcDonation == "<classId>/<donationId>"`
(`kcCoinsPaid(n, donationId)`, rad 673–682). En saldo-skrivning har bara ett
värde i fältet, så den kan betala **en** donation. Klassprefixet gör att
samma id i två klasser inte räcker. Klienten (`planDonationWrites` i
`src/klasscenter/kc-fund-plan.js`) sätter fältet i samma `merge`-skrivning
som `coins`. Fältet finns dokumenterat i `docs/DATAMODELL.md`.
`admin/qa-klasscentret-2-kontroll.mjs` sätter fältet i sina råa batchar, så
att de fortfarande nekas av rätt orsak.

### H2 (integritet, rättat) – spärrlistan var läsbar för andra klasser

Klassprofilen `classCenters/{classId}` (= `inredningSparr`, de elever läraren
bockat ur) var läsbar för alla inloggade. Gästläget behöver den inte, och
den visar vilka elever som fått inredningen avstängd.

**Rättelse:** `allow read: if isTeacher() || isClassMember(classId)`
(rad 864–867). `kanInreda` i `src/klasscenter/kc-layout-data.js` läser nu
klassen först och läser profilen bara för medlemmar. Gäster får direkt
`false`, utan något nekat anrop och utan varning i konsolen. Spärrkontrollen
i reglerna (`kcSparrad`, `get()`) berörs inte av läsregeln.

## Garantier → regel → test

Testfiler (alla i `npm run test:rules`): **EXP** =
`firestore-rules-klasscenter.test.js`, **FUND** = `-fund`, **FUND-S** =
`-fund-sakerhet` (ny), **LAY** = `-layout`, **LAY-P** = `-layout-pokal`,
**POK** = `-pokal`, **GAST** = `-gast` (ny), **SAK** = `-sakerhet` (ny).
Radnumren gäller `firestore.rules` i den här grenen.

| # | Garanti | Regel (rad / funktion) | Positiva tester | Negativa tester | Status |
|---|---------|------------------------|-----------------|-----------------|--------|
| 1a | Elev ökar klass-EXP bara +1..+3 och bara ihop med den egna elevposten i samma batch | 576–585 `kcShardStudent`, 594–607 `kcMemberAward` (getAfter åt båda hållen) | EXP "medlem ökar +1", "+3 (max)", "andra utdelningen efter spärren" | EXP "för stor ökning", "shard-ökning utan elevpost", "elevpost och shard som inte stämmer"; SAK "två shardar på EN elevpost", "påhittat startvärde" | ✅ |
| 1b | Inte sätta godtyckligt värde, inte minska | `kcDelta() >= 1`, `bumped('exp', n)`, `changedOnly` | EXP "+1" | EXP "sänkning och godtycklig set", "räknar-skrivning kan inte smyga in EXP"; SAK "påhittat startvärde" | ✅ |
| 1c | Inte skriva i en annan klass shardar/elevposter | `isClassMember(classId)`, `kcPath` (samma klass) | SAK "egen batch per klass går" | EXP "icke-medlem", "påhittad klass"; SAK "elevpost i en ANNAN klass bär ingen shard-ökning"; GAST "klass-EXP: gäst nej" | ✅ |
| 1d | Inte skriva en annan elevs elevpost (inte heller läraren) | `isSelf(uid)`, `d.lastUid == request.auth.uid` | EXP "medlem ökar +1" | EXP "skriva i en klasskamrats elevpost"; SAK "klasskamratens lastUid", "läraren skriver inga elevposter" | ✅ |
| 1e | Takt-spärr 15 s går inte att kringgå | 600–602 (`request.time > lastAt + 15 s`), delete bara lärare | SAK "räknare med merge går" | EXP "tät upprepning"; SAK "spärren går inte att nollställa genom att tömma/radera elevposten" | ✅ |
| 2a | Donation atomär: avdrag + post + fund-ökning i samma batch | 656–672 `kcFundWrite`, 677–682 `kcCoinsPaid`, 683–691 `kcDonationCreate` | FUND "elev A donerar 100"; FUND-S "skrivplanen sätter markören" | FUND "ökning utan donationspost", "utan myntavdrag", "fund-ökning ≠ belopp" | ✅ |
| 2b | **Ett avdrag = en donation** (H1) | `kcCoinsPaid(n, donationId)` → `kcDonation` | FUND-S "skrivplanen sätter markören", "elev i två klasser … egna batchar" | FUND-S "två donationer i samma batch", "samma id i två klasser", "markören saknas/fel", "gammal markör" | ✅ rättat |
| 2c | Bara till den EGNA klassen | `isClassMember(classId)` (fund + post), `kcPath` | FUND "elev A donerar" | FUND "annan klass och påhittad klass"; FUND-S "fund i en annan klass än posten"; GAST "donation: gäst nej" | ✅ |
| 2d | Inte mer än saldot, inte 0 eller negativt, heltal | `efter >= 0`, `d.amount is int && >= 1` | FUND-S "hela saldot går (0 kvar)" | FUND "negativt saldo"; FUND-S "belopp 0 och negativt", "decimalbelopp", "en mynt mer" | ✅ |
| 2e | Ingen donation efter köp, köpt kan inte nollställas | `resource.data.isUnlocked != true`, ingen delete-regel | FUND "cappas till det som saknas → köpt" | FUND "sedan nekas mer"; FUND-S "köpt föremål kan inte nollställas eller fyllas på" | ✅ |
| 2f | Överskott cappas (aldrig över målet) | `fundedAmount <= targetPrice`, `isUnlocked == (fundedAmount == targetPrice)`; cappningen görs i `planDonation` | FUND "cappas", "12 samtidiga förbi målet: exakt målet" | FUND "överdonation", "fel isUnlocked", "ändrat pris" | ✅ |
| 2g | Donationsposten kan inte ändras eller raderas | bara `allow create` | – | FUND "går inte att ändra/radera"; FUND-S "kan inte raderas eller skrivas över – av givaren, klassen eller läraren" | ✅ |
| 2h | Anonymitet: klassen ser bara totalsumman, läraren ser vem | 698 `read: isTeacher()`; fund har ingen uid | FUND "donations läses bara av lärare"; FUND-S "läraren ja" | FUND-S "läses varken av givaren, klasskamrat, gäst eller utloggad", "fund bär ingen givare" | ✅ (se R4) |
| 3a | Layout skrivs bara av hemmaklassen (ej bockad) + lärare | 725–729 `kcSparrad`/`kcKanInreda`, 782–792 `kcLayoutCurrent` | LAY "klassmedlem sparar", "lärare sparar"; GAST "hemmaklassens elev ja" | LAY "bockad elev", "annan klass och utloggad"; GAST "layout: gäst och utloggad nej" | ✅ |
| 3b | Historik kan inte förfalskas eller raderas av elev | 793–802 `kcLayoutHistory` (getAfter mot current), delete bara lärare | SAK "lärare får nollställa" | LAY "ensam historikslot", "fel slot / annan layout"; SAK "elev raderar varken current eller historik", "gammal historikpost går inte att förfalska" | ✅ |
| 3c | Återställning följer samma regler | samma regler (blir ny version) | LAY "återställning blir en ny version", "lärare återställer"; SAK "medlem ja" | LAY "bockad elev nekas"; SAK "gäst och bockad elev nej" | ✅ |
| 3d | Fullt rum som ELEV ryms i 1000-uttryckstaket | 735–781 `kcPosOk`/`kcPlaced` (regex) | LAY-P "fullt rum: alla 8 föremål + 8 pokaler (elev och lärare)" | LAY-P "9 pokaler nekas" | ✅ (layoutreglerna oförändrade) |
| 4a | inredningSparr skrivs bara av lärare | 868–870 | LAY "lärare sätter listan"; SAK "lärare tar bort spärren" | LAY "elev kan inte ändra inredningSparr"; GAST "klassprofil: gäst nej" | ✅ |
| 4b | Bockad elev kan inte ta bort sig själv (inte heller genom att radera eller ersätta profilen) | `isTeacher()`, ingen delete-regel | – | LAY "inte ens ta bort sig själv"; SAK "kan inte radera eller ersätta klassprofilen" | ✅ |
| 4c | Bockad elev får fortfarande donera och tjäna EXP (spec §5) | spärren finns bara i `kcKanInreda` | SAK "bockad elev får fortfarande donera och tjäna EXP" | – | ✅ |
| 5 | Pokaler bara av lärare, create-only, verifierade mot källans result | 845–862 `kcPokalCreate`/`kcPokalVerifierad` | POK "mm-klasskamp till vinnaren", "i SAMMA batch som result" | POK "elev och utloggad nekas", "dubblett/ändring/radering", "fel vinnare", "pågående/saknad källa", "fel typ", "främmande fält"; GAST "gäst nej" | ✅ fanns redan – bara gäst- och lärarfall tillagda |
| 6a | Gäst läser det gästläget behöver | `read: signedIn()` på expShards, fund, layout, layoutHistory, trophies | GAST "gäst läser klass-EXP, insamling, layout, historik och pokaler" | GAST "gäst läser inte elevposter, donationsposter eller klassprofilen" | ✅ |
| 6b | Gäst skriver och raderar ingenting i classCenters/Y | `isClassMember` / `isTeacher` överallt | GAST positiva kontroller (hemmaklassen) | GAST "klass-EXP/donation/layout/pokal och profil: gäst nej", "gäst raderar ingenting", "kan inte göra sig till medlem" | ✅ |
| 6c | Utloggad läser och skriver ingenting | `signedIn()` i alla regler | – | GAST "utloggad läser ingenting", "raderar ingenting"; SAK "utloggad skapar varken shard eller elevpost" | ✅ |
| 7 | Lärare i en annan klass | `isTeacher()` = globalt anspråk | GAST "vilken lärare som helst får inreda, spärra och dela ut verifierad pokal" | GAST "inte heller en lärare får gå förbi verifieringen eller fejka en elev", "en uid som heter som läraren hjälper inte" | ⚠️ förtroendemodell (R1) |

## Klasskassan (#526)

Regler: `kcKassaSaldo`, `kcKassaIn`, `kcKassaUt`, `kcKassaBetald` i
`firestore.rules` + Live-sessionens `livePrizeOk` och låsningen av `coinPrize`
och `result` i `liveSessionUpdateOk`. Tester: **KASSA** =
`firestore-rules-klasscenter-kassa.test.js` (30 st).

| # | Garanti | Regel | Status |
|---|---------|-------|--------|
| K1 | Priset sätts bara av lärare vid skapandet (heltal 0–100 000), ändras aldrig efter | `livePrizeOk`, `coinPrize` oförändrat i update, `liveAutoFinishOk` rör bara status | ✅ |
| K2 | `result` skrivs aldrig om (vinnaren kan inte bytas efter utbetalning) | `o.result == null \|\| n.result == o.result` | ✅ |
| K3 | Utbetalning bara efter avslutad match, bara till vinnarklass(er), exakt priset/andelen, en gång | `kcKassaIn` (status finished + startedAt, `winnerClasses`, `math.floor`), id `live-<sid>` create-only | ✅ |
| K4 | Saldot ändras bara ihop med en ny historikpost och exakt ±beloppet, aldrig < 0 | `kcKassaSaldo` | ✅ |
| K5 | Uttag bara av kassör (klassmedlem i `kassorer`) eller lärare, atomärt med fund-ökningen, samma cap | `kcKassaUt` + `kcDonationCreate` (kassa-gren) + `kcFundWrite` | ✅ |
| K6 | Aldrig till/från en annan klass | `kcKassor` = `isClassMember(classId)`, alla sökvägar via `kcPath` | ✅ |
| K7 | Gäster/utloggade ser varken saldo eller historik; historiken kan inte ändras/raderas | `read: isTeacher() \|\| isClassMember`, bara `create` | ✅ |
| K8 | Elevens egna mynt och Live-poängen rörs inte | utbetalningen skriver bara `classCenters/…/kassa*` | ✅ |

Kvarvarande (samma förtroendemodell som R1): lärare är globala, och `result`
skrivs av lärarklienten – en lärare kan alltså ange vem som vann, men bara
EN gång per session, och priset är låst sedan skapandet. En lärare som raderar
en session och skapar om den med samma id kan inte betala samma klass igen
(historikposten finns kvar), men en annan klass skulle kunna få priset.

## Förtroendemodell och kvarvarande risker

- **R1 – lärare är globala.** `teacher:true` (custom claim,
  `admin/set-teacher-claim.mjs`) gäller alla klasser, och klassdokumentet har
  ingen lärarkoppling (`classes/{id}` har bara `studentIds`). Därför får alla
  lärare inreda, spärra, ge klassbonus (+1..+1000 EXP) och dela ut pokaler i
  alla klasser. Det är samma förtroende som i resten av appen: alla lärare
  skriver redan `classes`, `students` och elevers `studentData`. Även en
  lärare kan inte fejka en pokal utan ett avslutat result där klassen vann,
  inte skriva elevposter och inte skapa donationer. Att begränsa per klass
  kräver ett nytt fält (t.ex. `classes.teacherUids`) + migrering – det är ett
  produktbeslut. GAST-testerna låser dagens beteende, så en ändring syns.
- **R2 – mynt och spelresultat räknas i klienten.** `studentData` skrivs av
  eleven själv (`isSelf`, utan fältvalidering). Reglerna garanterar att
  *insamlat == summan av donationerna == summan av avdragen*, inte att
  mynten är förtjänade. Klass-EXP: reglerna ser inte vilken omgång som
  spelades. Taket är 3 EXP per 15 s per elev och klass, och allt syns per
  elev i `expMembers` (läraren kan radera). Gäller sedan epic 1/2.
- **R3 – regelräknarna (`counts`) skrivs av klienten.** "Minskande
  avkastning" per område (`kc-exp-regler.js`) kan nollställas av den som
  skriver direkt. Det hårda taket (R2) gäller ändå.
- **R4 – anonymiteten gäller i appen, inte mot den som använder devtools.**
  Donationsposterna kan bara lärare läsa, och `fund` saknar givare. Men
  `studentData` är läsbart för alla inloggade (beslut #114, utom vid
  `husLast`). En klasskamrat som läser rådata kan se att ett saldo sjönk
  samtidigt som `fund` ökade, och H1:s markör `kcDonation` visar elevens
  senaste donation. Appen visar aldrig detta. Att stänga det kräver att
  läsningen av `studentData` stramas åt (rör byn och grannbyn, #114) – det
  ligger utanför den här granskningen.
- **R5 – metadata som gäster kan läsa:** `expShards.lastUid/lastKalla` och
  `layout.updatedBy`/`layoutHistory.savedBy` (uid:n). Elevnamn är redan
  läsbara (`students`), så risken är låg. Lämnat som det är, eftersom
  historiken visar vem som sparade.
- **R6 – två medvetna avvägningar från epic 2/3 som kvarstår:** att ett
  föremål i layouten är *upplåst*, och att en `pokal-…`-nyckel *finns*,
  kontrolleras i klienten, inte i reglerna (budget för uttryck och anrop).
  Ett fusk ger bara en möbel som ritas fel eller inte alls – inga mynt och
  ingen EXP.
- **R7 – en elev som går i flera klasser** får EXP-taket och donationerna
  per klass. Det är avsiktligt, och SAK/FUND-S testar det.

## Hur testerna körs

`npm run test:rules` (firebase `emulators:exec`, JRE i PATH – recept i
`docs/QA-RAPPORT-klasscentret-3.md` §Miljö). Enhetssviten är `node --test`
på `test/*.test.*` utom `firestore-rules*`/`e2e*`. Varje ny testfil har sitt
eget projectId, sin egen seed och en positiv kontroll per negativt fall, så
att ett nej beror på regeln och inte på en trasig skrivplan.
