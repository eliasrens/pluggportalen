# QA-rapport – Läsresan: 7 världar och 280 nya texter (#668)

Slut-QA av epic-grenen `epic/l-sresan-5-nya-v-rldar-havet-djungeln-be-de01e6` (bas `1c27bdb`), 2026-10-13.
Epicen innehåller världarna i #659/#660 och texterna i #661–#667.

**Resultat:** grenen fungerar. Två små fel i världsbytet är rättade på den här grenen (F1, F2).
Ett större innehållsfynd (F3) är inte rättat. Det gäller nya texter som liknar texter på andra nivåer.

## Sammanfattning

| Kontroll | Resultat |
|---|---|
| 7 världar i ordning, 20 steg var, `unlockAfter`-kedja | ✅ Skogen → Öknen → Havet → Djungeln → Bergen → Vulkanlandet → Månen |
| Världsbyten i appen (emulatorn) | ✅ alla 6 byten, plus Månen klar och läsning efter Månen. Skärmdumpar finns nedan |
| Bevarade framsteg, med elever byggda av **gamla** klienten | ✅ 65/65 kontroller (`admin/qa-lasresan-varldar-kontroll.mjs`) |
| Antal texter | ✅ nivå 1–3: 70 var, nivå 4–7: 80 var (40 nya `-b` per nivå = 280) |
| Validatorn (`validateBank`, alla 650 texter) | ✅ 0 fel, 0 varningar |
| Stickprov: 5 nya texter per nivå (35 texter) | ✅ exakt ett rätt svar per fråga, språk och nivå stämmer (se nedan) |
| Nya texter dras i läsflödet | ✅ se avsnittet "Nya texter dras" |
| Lärarvyn | ✅ alla 7 världar visas med namn, steg, nivå och statistik. Sortering på Värld stämmer |
| `node --test` (163 filer, utan regler/functions/e2e) | ✅ **2168/2168**, både före och efter fixarna |
| `npm run test:rules` (38 filer i en `emulators:exec`, `--test-concurrency=1`) | ✅ **478/478** |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`, `4fbf4c9` mot HEAD) | ✅ identisk, 107 filer |
| Datamodell och `firestore.rules` | ✅ inte ändrade av epicen. Ingen deploy behövs |

## Fynd

### F1 – "Havet är klar!" (rättat, `94e77c9`)
Sammanfattningen och firandet skrev `<värld> är klar!`. Det blir fel böjning för Havet och Vulkanlandet ("klart") och för Bergen ("klara").
Texten är nu **"Du har klarat Havet!"** och fungerar för alla världar.
Efter sista världen står det "Hela Läsresan är klar!".
Ändrat i `ui-summary.js`, `ui-map.js` och `docs/LASRESAN.md`.

### F2 – Firandet efter Månen kom tillbaka efter varje text (rättat, `f5118c0`)
När hela resan var klar visades "Du har klarat Månen!" med konfetti igen efter **varje** ny text.
Orsaken: gången 20 → 20 räknades som en ny gång.
Villkoret i `ui-map.js` kräver nu att avataren faktiskt har gått (`fran < at`), eller att världen just blev klar.
Kontrollerat i appen: firandet kommer när Månen blir klar, men inte efter nästa text. Rutan "Du har klarat hela Läsresan!" med knappen "Läs en text" visas fortfarande.

### F3 – Nya texter liknar texter på andra nivåer (inte rättat, beslut behövs)
`node admin/qa-lasresan-varldar-overlapp.mjs` jämför alla texter med varandra (andel gemensamma ord-trigram).
- **27 par** ligger över gränsen 0,12, och i alla par är minst en text ny.
- Bland de gamla texterna finns **0** sådana par.
- **9 par har samma titel**, till exempel "Månen byter form", "Myrornas stack", "Den röda planeten", "Bina gör honung" och "Varför är havet salt?".

Värst är nivå 2 ↔ 4. `lr-g2-solen` (ny) har 49 % gemensamma trigram med `lr-n1-solen`, och nästan samma meningar.
Några par mellan nivå 3 och 6 börjar nästan likadant, till exempel `lr-g3-havssaltet` ↔ `lr-n3-havets-salt` och `lr-g3-andningen` ↔ `lr-n3-lungorna`.

Varför det spelar roll: nivån flyttas ±1 efter resultat. En elev som går 4 → 3 → 2 kan alltså få nästan samma text igen, med en annan titel eller samma titel.
`seenTextIds` hindrar inte det, eftersom id:na är olika.

Förslag: skriv om eller byt ut de 13 värsta paren (≥ 0,19) och byt titel på de 9 med samma titel. Det är ett innehållsjobb, ungefär en coder-omgång.
Hela listan skrivs ut av skriptet.

## Iakttagelser (inget fel, men värt att veta)

- **O1 – En gammal cachad klient under deploy-fönstret:**
  - En elev kan ha en flik med den gamla appen öppen (Pages cachar i ca 10 min) efter att nya klienten redan flyttat eleven till Havet.
  - Den gamla klienten känner inte till Havet. Den visar därför Öknen steg 0, och om eleven läser klart en text där sparas `oknen` steg 1.
  - Nya klienten läser sedan **Havet steg 0**, så de Havet-steg som eleven tagit under fönstret går förlorade.
  - Nivå, statistik, mynt och `completedWorlds` påverkas inte.
  - Det är låg risk och gäller bara under deployen. Kontrollerat i kontrollskriptet, avsnitt 3.
- **O2 – Elever som klarat Öknen flyttas till Havet först när de läser:** "Klar med Öknen" läses som Havet steg 0 utan att något skrivs. Det lagrade `worldId` är `oknen` tills nästa text är klar. Det är avsiktligt (`normalizeProgress`), och lärarvyn visar redan Havet.
- **O3 – Kartdetaljer under världsknapparna:** Öknens palm ligger under knappen "Månen", och Djungelns tempel och vattenfall ligger under knapparna "Bergen" och "Vulkanlandet". Det är bara kosmetiskt, inget klickbart döljs (`01-oknen-steg19.png`, `09-djungeln-steg19.png`).
- **O4 – Nivå 3 är fortfarande längre än nivå 4:** nya nivå 3 har i snitt 123 ord och nya nivå 4 har 93. Det följer de befintliga texterna (116 och 98), alltså samma öppna fråga som i #525.
- **O5 – Frågetyperna följer nivåerna:** andelen faktafrågor är 86 % på nivå 1, 83 % på nivå 2, 62 % på nivå 3, 55 % på nivå 4, 57 % på nivå 5, 29 % på nivå 6 och 27 % på nivå 7. De nya texterna har något fler slutsatsfrågor än de gamla på nivå 1–3, vilket är rimligt.
- **O6 – Ett tveksamt alternativ i stickprovet:** `lr-g3-stjarnfall`, frågan "Varför behöver man inte vara rädd…". Alternativet "De är långt bort i rymden" kan uppfattas som delvis rätt. Det är inte fel, men det går att skärpa.

## Bevarade framsteg – så testades det

`admin/qa-lasresan-varldar-seed.mjs` bygger elevdata med den **gamla klientens kod** från före epicen (`git archive 4fbf4c9 src`): gamla progress, picker, level-scale och bank, med bara Skogen och Öknen.
Eleverna "läser" texter på riktigt, så `lasresa`, försök och mynt ser ut som i produktion:

| Elev | Lagrat (gammal klient) | Ny klient läser | Efter en text till |
|---|---|---|---|
| Skogs-Sam | Skogen 9, nivå 7, 9 texter | Skogen 9, nivå 7 | Skogen 10, +24 mynt |
| Öken-Olle | Öknen 7, nivå 1, 27 texter | Öknen 7, nivå 1 | Öknen 8, ny `-b`-text |
| Klar-Klara | Öknen 20, klara [skogen, oknen], nivå 10, 40 texter | **Havet 0** | **Havet 1** |
| Extra-Elsa | Öknen 20 + 6 texter efter, nivå 1, 46 texter | **Havet 0** | **Havet 1**, ny `-b`-text |

För varje elev kontrollerades följande som eleven själv, via klient-SDK:t med reglerna aktiva:
- nivå, statistik, `catStats`, `seenTextIds` och `lastTextId` är oförändrade
- läsningen skriver ingenting
- en text till räknar vidare
- `moneyEarned` och saldot ökar med `coinsFor`
- gamla försök är orörda
- `completedWorlds` och `ownedItems` finns kvar

## Nya texter dras

- **Picker** med hela banken: på varje nivå 1–7 är första valet en ny text i 49–58 % av fallen, ungefär i proportion till andelen nya texter. Alla 40 nya texter dras innan nivåns pool är slut.
- **I appen** (emulatorn): Öken-Olle och Extra-Elsa på nivå 1 fick nya texter (`lr-g1-djungeln`, `lr-g1-pyjamas`). Under världsbytena fick nivå 6-eleverna både `level-6.json` och `level-6-b.json`.

## Stickprov (5 nya texter per nivå)

Urvalet är seedat och slumpat ur `level-N-b.json`. Alla har exakt ett rätt svar, och nivån stämmer med de befintliga texterna i ordantal, meningslängd och antal frågor.

- **Nivå 1:** `lr-g1-oronen`, `-finland`, `-nasan`, `-kon`, `-snigeln`. Korta meningar och nästan bara faktafrågor, som på nivå 1.
- **Nivå 2:** `lr-g2-papegojan`, `-kartan-vinden`, `-vikingaskeppen`, `-olympiska`, `-bilnyckeln`. Bra blandning av berättelser och fakta.
- **Nivå 3:** `lr-g3-kanada`, `-orientering`, `-andningen` (se F3), `-larmnumret`, `-stjarnfall` (se O6).
- **Nivå 4:** `lr-n1-frukost-till-mamma`, `-farfars-ora`, `-orienteringen`, `-fel-gympapase`, `-strommen-gick`.
  - `-orienteringen` (nivå 4) och `lr-g3-orientering` (nivå 3) förklarar kontrollen med samma mening, se F3.
- **Nivå 5:** `lr-n2-manens-baksida`, `-bokbytet`, `-sengangaren` (se F3), `-dansen`, `-hemlig-kompis`.
- **Nivå 6:** `lr-n3-kolibrin`, `-hjarnan`, `-nattvandringen`, `-skrapet-i-vaggen`, `-jordbavningar`. Starka texter med bra slutsatsfrågor.
- **Nivå 7:** `lr-n4-mullvaden`, `-bollplanen`, `-honan-gullan`, `-jattetraden`, `-fjallraven`.

## Skärmdumpar (1366×768, `docs/qa-lasresan-varldar/`)

Bilderna togs i den riktiga appen mot emulatorn, med elever på steg 19 i varje värld. Emoji-ikonerna saknas i den headless webbläsarens typsnitt.

| Fil | Visar |
|---|---|
| `01-oknen-steg19.png` | Öknen före världsbytet |
| `02`–`04` | Öknen → Havet: sammanfattning, firande och knappen "Vidare till Havet", Havet steg 0 |
| `05-havet-steg19.png` | Havet |
| `06`–`08` | Havet → Djungeln |
| `09-djungeln-steg19.png` | Djungeln |
| `10`–`11` | Djungeln → Bergen |
| `12-bergen-steg19.png` | Bergen |
| `13`–`14` | Bergen → Vulkanlandet |
| `15-vulkanlandet-steg19.png` | Vulkanlandet |
| `16`–`17` | Vulkanlandet → Månen |
| `18-manen-steg19.png` | Månen |
| `19-manen-klar-sammanfattning.png`, `20-manen-klar-firande.png` | Månen klar: "Hela Läsresan är klar!" |
| `21-efter-manen-las-vidare.png` | En text till efter Månen: inget nytt firande (F2), rutan "Läs en text" |
| `22-lararvy-lasresan-varldar.png` | Lärarvyn, Statistik → Läsresan, sorterad på Värld |

## Köra om

```bash
git archive 4fbf4c9 src | (mkdir -p /tmp/q668-gammal && tar -x -C /tmp/q668-gammal)
JAVA_BIN=… FIREBASE_BIN=… FS=8668 AUTH=9668 PROXY=8669 bash admin/qa-lasresan-niva-preview.sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8668 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9668 GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-lasresan-varldar-seed.mjs       # QA-klass Världar (12 elever, lösenord lilla123)
node admin/qa-lasresan-varldar-kontroll.mjs   # muterar – seeda om efteråt
node admin/qa-lasresan-varldar-overlapp.mjs   # F3
```

Appen finns på `http://127.0.0.1:8669/`. Logga in som `qa-v-w-<värld>` för att se ett världsbyte, eller som läraren `qalarare`.

## Öppna frågor till Elias

1. **F3:** ska de ~13 värsta textparen skrivas om och de 9 dubbeltitlarna bytas innan merge, eller efteråt i en egen omgång?
2. **F1:** är "Du har klarat Havet!" okej som formulering, eller vill du ha "Havet är klart!" med böjning per värld (ett nytt fält i varje värld)?
3. **O4:** nivå 3 har fortfarande längre texter än nivå 4. Ska det vara så?
4. **Efter Månen:** eleven läser vidare och får mynt, men avataren står still. Räcker det, eller ska det komma en åttonde värld eller någon annan belöning?
