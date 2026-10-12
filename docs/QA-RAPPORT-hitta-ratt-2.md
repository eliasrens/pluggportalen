# QA-rapport – Hitta rätt! 2/2 slut-QA (#638, epic #612)

Slutverifiering av epicgrenen `3c29a53`: B #633 data och server, ring-fixen #639, C #634 lärarvy,
D #635 toggle, E #636 platssökning och polygonval, F #637 bilder. Testerna följer spec §35 test 8
och issuens extrafall. Som regression kördes test 1–7 och 9–12 för de officiella packen.

**Resultat: alla test är gröna. Inga buggar i produktkoden.** Två QA-hjälpare är förbättrade (se
O1). Iakttagelserna O1–O5 blockerar inte landningen.

## Deploy före live (i den här ordningen)

Epic 1/2:s deploy (rules + functions, PR #631) ska ha gått först, eller göras samtidigt. En deploy
av den här grenen täcker båda.

1. `firebase deploy --only firestore:rules`. Två nya regler:
   - `hittaRattPacks` (läs för inloggade, skriv `false`).
   - `hittaRattBilder` (läraren skapar sina egna bilder ≤ 150 kB, raderar bara egna).

   Utan deployen kan eleverna inte läsa egna kartor, och bilduppladdningen nekas.
2. `firebase deploy --only firestore:indexes`. Indexundantaget för `hittaRattBilder.data`
   (Bytes-fältet ska inte indexeras).
3. `firebase deploy --only functions`:
   - `hittaRattSubmit` är ändrad (egna pack: klass, `facitAt`, `v`, togglen).
   - Tre nya callables: `hittaRattSparaPack`, `hittaRattRaderaPack` och `hittaRattSattTopplista`.

   Predeployen synkar `delat/`. Utan den här deployen svarar Spara i lärarvyn "not-found", och
   egna kartor går inte att skicka in.
4. Pages (merge till main). Bootgrafen är oförändrad (107), så risken för vit sida under
   utrullningen är densamma som förut (incident 2026-09-10).

Ingen Storage-deploy behövs (bilderna ligger i Firestore).

## Sviter och bootgraf

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test`, 144 filer utom regler/functions/e2e) | ✅ 1918/1918 |
| `test:rules` (37 filer, bl.a. `hitta-ratt-egna`, `hitta-ratt-bilder`) | ✅ 456/456 |
| `test:functions` (11 filer, seriellt, inkl. `-egna`, `-egna-topplista`, `-egna-bilder`) | ✅ 106/106 |
| `test:e2e` | ✅ 5/5 |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | ✅ **107** filer, samma lista som `origin/main` (`4ad608a`). Ingen fil från `hitta-ratt/larare/` i den statiska grafen |

Recept: varje svit kördes i en egen, färsk `emulators:exec` med egen config
(`/tmp/hr638/suite/firebase.json`, portar 8681/9681/5681). `test:functions` kördes med
`FUNCTIONS_EMULATOR_HOST=127.0.0.1:5681`.

F #637 rapporterade 1924 enhetstester. 1918 gäller med filurvalet ovan (alla `test/*.test.{js,mjs}`
utom `firestore-rules-*`, `functions-*` och `e2e-*`). Inget test faller.

## Miljö och metod

- Emulator-preview: `admin/qa-hitta-ratt-preview.sh` med FS 8648, Auth 9648, FN 5648 och proxy
  8649, plus seedsen. **En** headless Chrome-flik växlade mellan konton:
  - lärarna `qalarare` och `qalarare2` (kollega, skapad i Auth-emulatorn med `teacher: true`)
  - eleverna `elev1` (Astrid, QA-klass 4A) och `hr-elev00` (Omar, 5E)
- Kartklick gjordes med CDP via `admin/qa-hitta-ratt-input.mjs`. Facit lästes ur en dump av
  packdokumentet (`--packfil`), aldrig ur sidan.
- Nytt: `admin/qa-hitta-ratt-dump.mjs <packId> [uid …] [--packfil=…]`. Det läser
  packen, katalogposten, topplistan, ledarna, bilderna och personbästa direkt ur emulatorn.
  Alla "Firestore:"-rader nedan kommer därifrån.
- Sessionen startades om en gång (emulatorn och fliken försvann). Previewn startades om med ny
  seed. Test 8 kördes i sin helhet efter omstarten.

## Test 8 – egna områden (spec §35)

| Steg | Resultat |
| --- | --- |
| 1. Skapa ett eget punktområde | ✅ "QA Gävleborg" 🏞️ på Sverige (landskap), punkt, startvy Anpassad, klasserna QA-klass 4A, 5A och 5E |
| 2. Plats via sökning + visuell bekräftelse | ✅ "Gävle" → 6 Wikidata-träffar (tätort, kommun, län …). Vald träff satte markören vid Gävle vid kusten och zoomade dit, med texten "📍 Gävle · 60.67483, 17.14439" ([01](qa-hitta-ratt-638/hr638-01-sok-gavle-markor.png)). "Använd denna plats" lade till frågan. Sandviken, Hudiksvall, Söderhamn och Ljusdal lades till på samma sätt. Firestore: `kalla: wikidata:Q25748` m.fl. |
| 3. Frågor utan bild, med Commons-bild och med egen bild | ✅ Gävle: Wikidatas förslag först, "Foto: I99pema, CC BY-SA 4.0" 800×532, 77 kB. Hudiksvall: egen PNG → "Egen bild" 800×450, 20 kB. Uppladdningen kräver kryssrutan (knappen är avstängd utan den). Övriga tre frågor saknar bild ([02](qa-hitta-ratt-638/hr638-02-fragor-med-och-utan-bild.png)). Firestore: två `hittaRattBilder` med `image/webp` och ägaren `qalarare` |
| 4. Skoltopplistan AV | ✅ Kryssrutan är av som standard. Firestore: `leaderboard: false` i pack och katalog |
| 5. Spela som elev, AV | ✅ elev1 såg kartan under "Från din lärare", spelade 460/500 p och fick "🎉 Nytt personbästa!" och 5 coins ([03](qa-hitta-ratt-638/hr638-03-elev-av-resultat-personbasta.png)). Firestore: **ingen** topplista och inga ledare. Personbästat `{ s: 460, v: 1 }` sparades. Kartan syntes inte i 🏆-vyn. Därefter spelade 20 elever i 5A/5E kartan via serverkärnan (`toggle-seed --pack=…`) |
| 6a. Redigera → togglen PÅ | ✅ Texten för PÅ visades. "Sparat! … Skoltopplistan är på – eleverna ser den under 🏆 Topplistor." ([04](qa-hitta-ratt-638/hr638-04-larare-topplista-pa.png)). Firestore: topplistan `v: 1` byggdes upp ur **21** personbästa, med ledaren `hr-elev00` och scope `sverige` |
| 6b. Spela igen | ✅ Ny sidladdning, egen bild utan attribution ([05](qa-hitta-ratt-638/hr638-05-elev-egen-bild.png)), Commons-bild med attribution ([06](qa-hitta-ratt-638/hr638-06-elev-commons-bild-attribution.png)). 415 p (sämre): "Ditt personbästa: 460 p", "#18 på skolan av 21 elever" |
| 6c. 🏆-vyn | ✅ Gruppen "🧑‍🏫 Från din lärare" visas först med QA Gävleborg. Top 15 (Omar 500 … Agnes 466), sedan "⋯" och **"18. Astrid, QA-klass 4A du – 460 p"**. Astrid förekommer en gång. "Ditt rekord: 460 p · Plats 18 av 21" ([07](qa-hitta-ratt-638/hr638-07-topplista-top15-egen-rad.png)) |
| 6d. Dynamisk huspokal | ✅ Omar fick "Kartmästare – Skolrekord QA Gävleborg" i Möbler-lådan. Placerad på golvet visar hovern skylten med titeln ([08](qa-hitta-ratt-638/hr638-08-omar-pokal-tooltip.png)). Motivet stämmer: SVG:n är identisk med `kartmastareMarkup({ scope: "sverige", typ: "point" })` och skiljer sig från europa och varlden |
| 7. Togglen AV igen | ✅ "Skoltopplistan är avstängd – topplistan och pokalen är borttagna." Firestore: topplista och ledare borta, båda personbästa kvar. Omars placerade pokal är borta ur rummet, och `room.placements` har ingen `hrpokal-e-…` kvar ([09](qa-hitta-ratt-638/hr638-09-omar-pokal-borta-efter-av.png)). För elev1 finns ingen "Från din lärare"-grupp i 🏆, och startsidan visar fortfarande "Ditt bästa: 460 p" |

## Extrafall

| Fall | Resultat |
| --- | --- |
| Ändrad text/bild nollställer inte | ✅ Med topplistan PÅ ändrades en frågetext, ett namn ("Söderhamn stad") och Gävles bild togs bort ("Ingen bild"). Ingen varning och ingen bekräftelse. Firestore: `version` är kvar på 1, topplistan har kvar 21 poster och ledaren `hr-elev00`. Den oanvända Commons-bilden städades bort (2 → 1 bild) |
| Ändrat facit nollställer | ✅ Ljusdals latitud ändrades. Varningen "⚠️ Du har ändrat platser eller frågor …" syntes direkt ([10](qa-hitta-ratt-638/hr638-10-facitvarning.png)), och Spara frågade "Spara ändå?". "Sparat! Rekorden och topplistan började om från noll." Firestore: `version` 2 i pack och katalog, tom topplista `v: 2`, ledaren borttagen. elev1:s startsida visar inte längre "Ditt bästa" (personbästat har `v: 1`). Seeden visade också att ett försök som startats före ändringen nekas med "Läraren har ändrat kartan – starta en ny omgång." |
| Radera med topplistan PÅ | ✅ Först spelade 20 elever version 2 (Omar blev ledare). Bekräftelsen sa "Radera "QA Gävleborg"? Det går inte att ångra. Skolans topplista för kartan är påslagen – den och pokalen tas också bort." Firestore: pack, katalogpost, topplista, ledare och bilder är borta. Kopian (eget id och egna bilder) finns kvar. Omars pokal är borta, och kartan syns inte längre på startsidan |
| Områdespack via kartklick | ✅ "QA Östersjön", Europa, område. CDP-klick på Sverige, Finland, Estland, Lettland och Litauen, och sedan Lettland igen → "Tog bort Lettland", 4 frågor och 4 blå områden ([11](qa-hitta-ratt-638/hr638-11-omradespack-kartklick.png)). elev1: `kontroll` utan etiketter med 4/4 träffbara, 4/4 rätt, nytt personbästa och 4 coins |
| Duplicera | ✅ "Kopia av "QA Gävleborg"" öppnas **osparad** med "(kopia)", inga klasser och bilden kvar. Efter Spara: nytt id, `leaderboard: false`, `version: 1`, och bilden kopierad till ett nytt id (`e-al72…--kr2cuy48`) |
| Klass-synlighet | ✅ elev1 (QA-klass 4A) ser inte "Bara 6B" eller kopian (6B). Direktlänken `?pack=e-qaegna6b0001` visar "Kartan finns inte längre". Ett riktigt försök + `hittaRattSubmit` från elev1:s session gav **permission-denied: "Kartan är inte delad med din klass."** |
| Kollegas pack | ✅ `qalarare2` har "Inga egna områden ännu" och "Kollegors områden (6)" med bara Visa innehåll, Provspela och Duplicera ([14](qa-hitta-ratt-638/hr638-14-kollegors-omraden.png)). Redigeringslänken visar "… kan ändra den. Duplicera den i stället." och har ingen Spara-knapp. Direktanrop till servern nekas alla tre: spara ("Bara läraren som skapade kartan kan ändra den."), topplista och radera. Kollegans duplicering blev ett eget pack (`ownerUid`/`ownerNamn` = `qalarare2`), och bilden kopierades med kollegan som ägare |
| Inga anrop från elevsidan | ✅ Efter en ren sidladdning som elev1 och en hel omgång med Commons-bild och egen bild var värdarna bara `127.0.0.1:8649`, `fonts.googleapis.com`, `fonts.gstatic.com` och `www.gstatic.com`. Inga anrop till wikimedia, wikidata eller nominatim. Bilderna kom som `blob:` ur Firestore |
| Platssökning: inga träffar | ✅ "xqzvbnmqqzz" → "Inget hittades. Prova ett annat namn eller klicka på kartan." |
| Platssökning: inget nät | ✅ Med nätet emulerat offline: "Falun" → "Sökningen når inte ut – kontrollera internetanslutningen. Du kan också klicka direkt på kartan." ([12](qa-hitta-ratt-638/hr638-12-platssok-utan-nat.png)) |
| Färdiga områden: förhandsgranska | ✅ 12 kort, var och ett med Visa innehåll, Provspela och Duplicera till Mina områden. Sveriges län listar alla 21 frågor |
| Färdiga områden: provspel | ✅ Sveriges län 21/21: "Provspel – sparas inte. 21 av 21 godkända svar = 21 coins för en elev." ([13](qa-hitta-ratt-638/hr638-13-provspel-sparas-inte.png)). Firestore: 0 försök, inget `hittaRattBest` och inget `studentData` för läraren |

## Regression (officiella pack, spec §35 test 1–7, 9–12)

Epiken ändrar utanför `src/hitta-ratt/`, `functions/`, regler och index bara **en rad** i
`src/teacher-shared.js` (fliken). Spelet (`hr-spel.js`), startsidan, 🏆-vyn och pokalerna är
däremot ändrade, så de kördes om.

| Test | Resultat |
| --- | --- |
| 1, 2 – punktkarta, inga ledtrådar | ✅ Sveriges städer: hjulzoom och nål → "Fullträff! … Norrköping 100 / 100 p". `kontroll` i **alla 12 pack**: 0 textnoder, 0 `<title>`, alla punktfrågor inom startvyn, alla områden träffbara (Världens länder – 30 nu 30/30, efter ring-fixen #639) |
| 3, 10 – punkt-topplista och åtkomst | ✅ Delad etta (Clara och Omar, 1966 p, båda "1."). Astrid står en gång som "4. … du" inne i Top 15 |
| 4 – områdeskarta | ✅ Europas länder – 20: valde Island på "Hitta Tyskland" → "❌ Inte riktigt. Du valde Island. Tyskland är markerat i grönt.", "0:04 · pausad" även 4 s senare ([15](qa-hitta-ratt-638/hr638-15-regr-omrade-fel-pausad.png)). Hel omgång 15/20 |
| 5 – områdes-topplista | ✅ Resultatskärmen efter Europas länder – 20 visar skolans topplista med regeln "Flest rätt …". Rangordningen (`rank.js`) är oförändrad i epiken och täcks av `hitta-ratt-delat.test.js` |
| 6 – personbästa | ✅ 1940 p slog 688 p. 420 p och 15/20 slog inte 1940 p resp. 18/20 1:20 |
| 7 – klassaktivering | ✅ Läraren bockade ur Hitta rätt! i Synlighet → "✓ Sparat – dolt för klassen: Hitta rätt!". elev1:s direktlänk (även till ett eget pack) gick till `#/elev/hus`. Påslaget igen syns modulen |
| 9 – responsivitet | ✅ Mobil 390×844 med touch: egna områdespacket med nyp och tryck på Finland → "Rätt!" ([17](qa-hitta-ratt-638/hr638-17-mobil-touch-eget-omradespack.png)), `visualViewport.scale` 1. Sveriges städer med nyp, drag och tryck → 100 p. Dator 1366×768 med mus i resten av QA:n |
| 11 – coins | ✅ elev1: 439 → 459 (20/20) → 479 (20/20, 420 p) → 494 (15/20) → 514 (20/20). Egna pack ger också 1 coin per godkänt svar (5 och 4) |
| 12 – huspokal | ✅ elev1 tog 2000 p på Kända platser i Europa och blev ensam ledare. Pokalen kom i Möbler-lådan bredvid de befintliga |
| Lärarsidans övriga flikar | ✅ Klasser & elever, Innehållsstudion, Mattematchen, Live och Hitta rätt! renderar med `teacher-dark` ([16](qa-hitta-ratt-638/hr638-16-larare-fardiga-mork.png)). Inga `error`/`unhandledrejection` under lärarrundan, och inga konsolfel |
| Lämna-vakten | ✅ Navigering mitt i en omgång frågar "Du är mitt i en omgång …" |

## Fynd

Inga buggar i produktkoden.

## Iakttagelser (inga blockerare)

- **O1 – QA-seeden rättad.** `admin/qa-hitta-ratt-toggle-seed.mjs` satte försökens `startedAt` 10
  minuter bakåt. Om facit hade ändrats under de senaste 10 minuterna nekade servern alla försök
  ("Läraren har ändrat kartan"), helt korrekt. Nu startar försöken efter `facitAt`. Ny flagga
  `--pack=<id>` gör att samma seed fungerar för vilket eget pack som helst, och utskriften visar
  PÅ eller AV. Bara QA-verktyg ändrades.
- **O2 – Emulatorlås efter krasch.** När seeden kraschade mitt i en transaktion gav nästa körning
  "Transaction lock timeout". Efter ~20 s gick det igen. Det gäller bara emulatorn.
- **O3 – Katalogcachen på 60 s.** En elev som har sidan öppen kan i upp till 60 s se en karta i
  🏆-gruppen efter att togglen slagits av (enligt §11.3). Själva topplistan är redan raderad, så
  listan blir tom. Det testades inte särskilt. Efter ny inloggning försvann kartan direkt.
- **O4 – `?vy=topplistor&lista=e-…` utan topplista** faller tyst tillbaka till den första
  officiella listan. Det är rimligt, men ingen text säger att kartan inte längre har en topplista.
- **O5 – Wikidata-träffar.** "Gävle" ger även kommun, län, församling, kyrkogård och högskola. Den
  första träffen (tätorten) är rätt, och läraren ser markören innan hen bekräftar. Inget att
  ändra, men skolor bör veta att den första träffen inte alltid är orten.

## Öppna frågor till Elias (§11.11)

1. **Vem ser en egen topplista?** Nu: bara elever i packets klasser. "Skolutmaning" = kryssa i
   alla klasser. Okej?
2. **Ändrade platser nollställer rekord och topplista** (texter och bilder gör det inte). Verifierat
   ovan. Okej?
3. **En påslagen topplista byggs upp ur befintliga personbästa** (21 poster direkt i testet). Okej?
4. **Kollegors kartor** kan ses, provspelas och dupliceras av alla lärare. Bara ägaren
   redigerar. Okej, eller ska de vara privata?
5. **Externa tjänster i lärarvyn** (Wikidata, Nominatim, Commons). Bara lärarens sökord skickas,
   och eleverna gör inga sådana anrop (verifierat). Okej ur GDPR-synpunkt?
6. **Uppladdade bilder** kräver kryssrutan "Jag har rätt att använda bilden". Räcker det?
7. **Gräns 60 frågor per eget område** (1 coin per godkänt svar). Okej?

Från epic 1/2 kvarstår frågan om tät placering (1, 1, 2), samt Israel/mikrostater på världskartan
(#639).

## Klickbar preview

```
JAVA_BIN=/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin FIREBASE_BIN=~/.npm/_npx/ba4f1959e38407b5/node_modules/.bin \
FS=8648 AUTH=9648 FN=5648 PROXY=8649 bash admin/qa-hitta-ratt-preview.sh
```

Lärare `qalarare`, elever `elev1` och `hr-elev00` (lösen `lilla123`, bara emulatorn). För test 8
utan UI: skapa kartan i lärarvyn, sedan
`node admin/qa-hitta-ratt-toggle-seed.mjs --pack=<id>` (20 elever spelar) och `--pa`/`--av`
tillsammans med `--pack=<id>`. Kontrollera med `node admin/qa-hitta-ratt-dump.mjs <id> elev1`.
