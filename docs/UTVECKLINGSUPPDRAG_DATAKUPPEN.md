# UTVECKLINGSUPPDRAG: DATAKUPPEN 💾
## Ett nytt Live-format i Pluggporten – samla data, knäck koder, skydda dig med brandvägg

**Uppdrag till AI-utvecklingsteamet**

Bygg ett nytt Live-format: **Datakuppen**.

Datakuppen spelas **inom en klass**, i egen takt, på samma sätt som Guldrushen. Eleverna svarar på frågor och samlar **data** (MB). Ett rätt svar låter eleven öppna en av tre dolda **filer**. I en fil kan det finnas data, en brandvägg, ett virus, eller en chans att **hacka en klasskamrat** genom att gissa hens **kod**, ett roligt ord med siffror i, som `p4nnk4k4`.

Det nya jämfört med Guldrushen är:

- **Koder**: roliga ord med siffror i, som `f0tb01l`, som skyddar elevens data
- **Hacka** = välja en klasskamrat och gissa rätt kod bland tre alternativ
- **Ett minnesmoment**: en fel gissning stryker det alternativet, så nästa försök mot samma kompis blir lättare för den som minns
- **Byt kod**: den som blir hackad väljer en ny kod, eftersom den gamla nu är känd
- **Helt ny design**: ett mörkt, neonfärgat nätverk i stället för grottan, men fortfarande barnvänligt

**Detta är ett implementeringsuppdrag, inte ett uppdrag att bara skriva en plan.**

---

# 0. LÄS FÖRST – BYGG PÅ GULDRUSHEN

Guldrushen är färdig, testad i klassrum och finputsad. **Datakuppen ska återanvända allt som går**, och bara det som verkligen skiljer sig ska byggas nytt.

Läs innan ni börjar:

1. `docs/LIVE-FORMAT.md` – hur ett nytt format byggs. Följ den.
2. `src/live/formats/guldrush/` – hela formatet, särskilt `index.js`, `guldrush-core.js`, `delat/chests-config.js`, `delat/guldrush-regler.js`, `gr-offer.js`, `gr-hogar.js`, `gr-guldruta.js`, `gr-flode.js`, `gr-pall.js`, `gr-demo.js`.
3. `functions/guldrush-core.js` och `functions/index.js` – serverns rättning, kistor och stöld (`guldrushAnswer`, `guldrushOpenChest`, `guldrushChooseVictim`).
4. `npm run sync:guldrush` – hur den delade mappen kopieras till `functions/`.
5. QA-rapporterna `docs/QA-RAPPORT-guldrushen-567.md` och `docs/QA-RAPPORT-guldrushen-finputs.md`, och mapparna `docs/qa-guldrush-*`.
6. `src/live/live-rewards*.js` – pluggmynt efter matchen.
7. `src/live/proj-music.js` – bakgrundsmusiken via `format.music`.
8. `src/timeline/timeline-answer.js` – tidslinjefrågorna (#601).

## 0.1 Gemensam motor i stället för kopia

Mycket av Guldrushen är inte specifikt för guld: kistmotorn, skyddet, offerväljaren, servern som rättar och slumpar, händelseflödet, ledningsbytet, topplistan, guldrutan, pallen och demoläget.

- **Bryt ut det som båda formaten behöver** till en gemensam modul, exempelvis `src/live/kistspel/` (och motsvarande i `functions/`), som både Guldrushen och Datakuppen använder.
- **Guldrushen får inte ändra beteende.** Alla Guldrushens befintliga tester ska vara gröna efter utbrytningen, före något Datakuppen-specifikt byggs. Gör utbrytningen som en egen PR.
- Utöka synk-skriptet (`sync:guldrush`) så att den gemensamma, delade koden kopieras till `functions/` på samma sätt, med samma test som fäller en kopia som glidit isär.
- Om en utbrytning visar sig för riskabel: redovisa varför, och kopiera hellre ett avgränsat stycke än att riskera Guldrushen.

## 0.2 Lärdomar från Guldrushen som gäller från början

Allt detta är redan beslutat och ska gälla i Datakuppen direkt:

| Område | Regel |
| --- | --- |
| Skydd | **Ett** tidsbegränsat skydd (`protectedUntil`). Brandvägg från fil = 60 s. Efter att ha blivit hackad = 30 s. |
| Offerväljaren | Levande: skyddade kompisar gråade med 🛡️ och nedräkning, valbara direkt när skyddet går ut. Servern kontrollerar i det ögonblick valet görs. |
| Trygghet | Ingen kan förlora allt. Inte samma offer två gånger i rad. Stöld högst 15 %. |
| Projektorn | Topp 10 som avatarer. Översta raden (logga, timer, klassens totala data) är fredad. Händelseflödet högst 4 korta rader, en rad per händelse. Inga notiser över timern. Gemensamma milstolpar firas i totalrutan med förloppsmätare. Dekor aldrig bakom text eller avatarer. |
| Final | Rubrik exakt "🏆 Datakuppen – Prispall". Inga klassnamn. Pallen centrerad efter placering, utan tomma platser. Lugn totalrad, till exempel "Tillsammans: 12 400 MB". |
| Ikoner | Inga emojier från Emoji 13 eller senare i gränssnittet (de blir ▯ på Windows 10). Använd SVG, som `coinIcon()` och `gr-ikoner.js`. |
| Speltid | Snabbknappar 3, 5, 10, 15, 20, 30 min och "Egen tid" 1–60 hela minuter. |
| Facit | Elever kan aldrig läsa facit (privat dokument, som `grPrivate`). |
| Frågor | Multiplikation (skriv själv eller flerval), quiz från Plugga och tidslinjefrågor, precis som i Guldrushen. |
| Pluggmynt | Gemensamma `live-rewards`: placeringspris (−15 % per plats) och mynt per rätt med trappa och tak. Data är spelvaluta och kan aldrig bli pluggmynt under matchen. |
| Musik | `format.music`, egen knapp 🎵 Musik på/av hos läraren, tyst lobby, ducking bara när effekten faktiskt hörs. |
| Elevens placering | Följ samma regel som i Guldrushens elevvy för hur placering visas. |

---

# 1. SPELREGLER

## 1.1 Valutan: data

- Eleverna samlar **data**, som visas i **MB**, till exempel "💾 250 MB".
- Ikonen 💾 får användas (den är gammal och fungerar överallt), men ritas gärna som SVG för enhetligt utseende.
- Lägg valutans namn och enhet i konfigurationen, så att de kan bytas.
- Mest data när tiden är slut vinner.

## 1.2 Koden

Varje elev har en **kod** som skyddar hens data.

**Format: roliga ord med siffror**

Koderna är **roliga, barnvänliga ord där några bokstäver bytts mot siffror**, till exempel `f0tb01l`, `p4nnk4k4`, `r0b0t`, `kan315nurra`.

- Utbytena: o→0, i→1, l→1, e→3, a→4, s→5, t→7, g→9. Varje kod har 2–3 utbyten (2 i korta ord), så att ordet fortfarande går att känna igen.
- Alltid minst en siffra och minst tre bokstäver. Bara gemener. Inga å, ä, ö.
- Den färdiga listan med **100 koder** bifogas som `datakuppen-koder.json`. Lägg den i formatets konfiguration (till exempel `src/live/formats/datakuppen/delat/koder.json`, delad med servern på samma sätt som kisttabellen).
- Koderna kommer **bara ur listan**. Inga slumpade teckenkombinationer.
- Orden i listan ska vara barnvänliga, utan namn på personer och utan varumärken. Nya ord kan läggas till i listan utan kodändring.
- Koderna visas i ett **tydligt monospace-typsnitt**, så att 0 och o, 1 och l går att skilja åt.
- Inom en match ska koderna helst vara **unika**. Om listan tar slut (fler än 100 spelare eller många kodbyten) får en kod återanvändas.

**Eleven väljer, men skriver aldrig själv**

- När eleven går med i lobbyn visar systemet **4 slumpade koder ur listan**, och eleven väljer den hen tycker är roligast.
- Eleven får **aldrig skriva in en egen kod**. Det är viktigt: elever i den här åldern skriver annars in sitt riktiga lösenord till Pluggporten eller något annat konto.
- Hinner eleven inte välja innan matchen startar, väljer systemet en åt hen.
- Elevens egen kod visas diskret på elevens skärm ("Din kod: f0tb01l").

**Koden är hemlig**

- Koden lagras **bara på servern** och i ett dokument som bara eleven själv får läsa (som Guldrushens privata dokument). Ingen annan elev kan läsa den, inte heller via utvecklarverktygen.
- Firestore-reglerna ska testa detta.

## 1.3 Rätt svar → tre filer

Efter ett rätt svar visas **tre dolda filer** (mappar eller filikoner). Eleven väljer en. Servern avgör innehållet, precis som Guldrushens kistor.

Förslag på filtabell (lägg den i en konfiguration i samma stil som `chests-config.js`):

| Fil | Effekt | Ungefärlig sannolikhet |
| --- | --- | --- |
| 📄 Liten fil | +10 MB | vanlig |
| 📁 Mapp | +25 MB | vanlig |
| 💽 Stor fil | +50 MB | ovanlig |
| 🖥️ Serverhall | +100 MB | sällsynt |
| ⚡ Överklockning | dubblar elevens data (högst +150 MB) | ovanlig |
| 🐛 Virus | tappar 10 % av sin data | ovanlig |
| 🗂️ Tom mapp | ingenting | vanlig |
| 🧱 Brandvägg | skyddad i 60 s (samma skydd som efter hackning) | ovanlig |
| 💻 Hack | hacka en klasskamrat (se 1.4) | ovanlig |

Emojierna är bara beskrivning. Varje fil ska ha en egen SVG-ikon, ett eget utseende och ett eget ljud, precis som kistorna.

Med **Hackning av** (lärarens val) kan Hack inte komma, och dess sannolikhet går till datafilerna, på samma sätt som Guldrushens "Stöld och byte av".

## 1.4 Hacka en klasskamrat

**Steg 1 – välj mål (återanvänd Guldrushens offerväljare)**

- Klasskamraterna visas som avatarknappar med namn och data, sorterade efter data.
- Skyddade kompisar (brandvägg eller nyss hackade) är gråade med 🛡️ och nedräkning, och blir valbara när skyddet går ut.
- Inte samma kompis två gånger i rad. Ingen kompis med för lite data att hacka.
- Cirka 10 sekunder att välja, annars slumpar servern bland dem som går.
- Servern kontrollerar skyddet i det ögonblick valet görs.

**Steg 2 – knäck koden**

- Eleven ser kompisens namn och **tre koder**. En är rätt.
- Eleven väljer en kod. Cirka 10 sekunder; om tiden tar slut misslyckas hacket utan annan påföljd.
- **Rätt kod:** eleven tar **15 %** av kompisens data (samma regel och tak som Guldrushens stöld). Händelseflödet: "💻 Alma hackade Omar: +45 MB".
- **Fel kod:** ingenting tas. Eleven får se "Fel kod!", och den felaktiga koden **stryks för just den här kompisen**.

**Minnesmomentet**

- Servern sparar för varje par (hackare, mål) vilka kodalternativ hackaren har fått och vilka som strukits.
- Nästa gång samma elev hackar samma kompis visas **samma koder, minus de strukna**, i **ny ordning**. Den som minns koderna har alltså en fördel. Efter två fel finns bara rätt kod kvar.
- När kompisen byter kod (se 1.5) börjar allt om för alla mot den kompisen.

**Lockkoderna**

- De två felaktiga koderna är **andra koder ur listan**, gärna av ungefär samma längd som den rätta, så att den rätta inte sticker ut. Eftersom koderna är ord är de lätta att minnas, vilket gör minnesmomentet roligt.
- Lockkoderna för ett visst par (hackare, mål) är desamma vid varje försök tills målet byter kod (se minnesmomentet).
- En lockkod får aldrig vara en kod som någon annan elev i matchen faktiskt har just nu, så att ingen kan lista ut andras koder genom att hacka.
- Servern skapar dem. Klienten får bara koderna i slumpad ordning och skickar tillbaka vilken som valdes. Det får inte gå att se i klienten vilken som är rätt.

## 1.5 Bli hackad → byt kod

Den som blir hackad:

1. Får en kort, lekfull notis som inte blockerar spelet: "💻 Omar knäckte din kod och tog 45 MB!"
2. Får automatiskt **skydd i 30 sekunder**.
3. Får **välja en ny kod** bland 4 nya förslag, eftersom den gamla nu är känd. Det tar ett klick. Väljer eleven inte inom cirka 10 sekunder väljer systemet åt hen. Under tiden kan eleven fortsätta svara.

Detta ersätter Blookets "säkerhetsuppgift" och är vår egen twist: det är logiskt (koden har ju läckt), går snabbt och straffar inte eleven.

Om läraren har stängt av **namn i händelseflödet** visas "Någon" i stället för namnet, precis som i Guldrushen.

## 1.6 Trygghet

Samma principer som Guldrushen, utan undantag:

- Ingen kan förlora allt: virus högst 10 %, hack högst 15 %.
- Skydd efter att ha blivit hackad (30 s), och inte samma mål två gånger i rad.
- Formuleringarna är lekfulla, aldrig hånfulla.
- Hacket är ett påhittat spel i en påhittad värld. Inga riktiga lösenord, inga riktiga konton.

## 1.7 Säkerhetstips (pedagogisk bonus)

Datakuppen är ett bra tillfälle att prata om riktiga lösenord. Visa ett kort, roterande **säkerhetstips** i lobbyn och på finalskärmen, till exempel:

- "Ett bra lösenord är långt och svårt att gissa."
- "Berätta aldrig ditt lösenord för någon, inte ens för en kompis."
- "Använd inte samma lösenord överallt."
- "Om någon frågar efter ditt lösenord – säg nej och berätta för en vuxen."

Lägg tipsen i konfigurationen så att läraren kan se dem och de kan bytas.

---

# 2. SERVERN

Allt som rör data, filer, koder och hackning avgörs **på servern**, precis som i Guldrushen.

- Återanvänd Guldrushens rättning (`answerQuestion`) och kistmotor via den gemensamma modulen.
- Nya callable-funktioner, exempelvis:
  - `datakuppAnswer` – rättar svaret
  - `datakuppOpenFile` – ett rätt svar → en fil
  - `datakuppChooseTarget` – väljer mål, returnerar tre kodalternativ i slumpad ordning
  - `datakuppGuessCode` – gissningen; rätt → data flyttas i en transaktion
  - `datakuppPickCode` – eleven väljer kod vid start eller efter att ha blivit hackad
- Koder, lockkoder och strukna alternativ lagras i privata dokument som bara servern läser.
- Data flyttas i **en transaktion** som ändrar båda elevernas data, så att data aldrig försvinner eller dupliceras.
- Samma spärrar som Guldrushen: ett svar per fråga, en fil per rätt svar, minsta tid mellan filer, tak för data, inga svar efter sluttiden.

## Attacktester (i samma anda som Guldrushens)

- öppna samma fil två gånger
- öppna en fil utan rätt svar
- skriva data direkt
- läsa en annan elevs kod
- gissa kod utan att ha fått ett Hack
- gissa kod mot ett annat mål än det som valdes
- gissa flera gånger på samma hackförsök
- hacka en skyddad elev
- skicka en egen påhittad kod som "vald kod"
- svara efter att tiden tagit slut

---

# 3. LÄRARENS INSTÄLLNINGAR

- Innehåll: multiplikation, quiz från Plugga, tidslinjefrågor (som Guldrushen).
- Svarssätt: skriv själv eller flerval (som Guldrushen).
- Speltid: snabbknappar + egen tid 1–60 min.
- **Hackning:** på/av. Standard: på. Av = bara datafiler, en snällare variant.
- Visa namn i händelseflödet: på/av. Standard: på.
- Pluggmynt efter matchen: placeringspris och mynt per rätt (gemensamma `live-rewards`).
- 1–3 klasser, som Guldrushen.

---

# 4. DESIGN – HELT NY VISUELL IDENTITET

Datakuppen ska se **helt annorlunda** ut än Guldrushen, men vara byggd på samma komponenter. Tänk "ett hemligt kontrollrum i ett lekfullt dataspel", inte en skrämmande hackerfilm.

## 4.1 Stil

- **Mörkt:** djup marinblå eller nästan svart bakgrund.
- **Neon:** grönt och cyan som huvudfärger, med en varm accent (till exempel orange eller magenta) för viktiga händelser.
- **Nätverk:** kretsbanor, noder som lyser, datapaket som rör sig längs linjerna.
- **Typsnitt:** ett monospace-typsnitt för koder, siffror och händelseflödet. Vanligt Pluggporten-typsnitt för rubriker och namn.
- **Barnvänligt:** inga dödskallar, inga hotfulla bilder, inga röda "VARNING"-skärmar. Gärna små, vänliga robotar eller pixel-detaljer.
- **Ingen blinkning eller strobe.** Glitch-effekter ska vara korta och diskreta (risk för ljuskänslighet). Stöd reducerad rörelse.
- Lägg stilarna i egna CSS-filer för formatet.

## 4.2 Projektorn – "Nätverket"

Återanvänd Guldrushens layout och logik, med ny grafik:

- **Översta raden (fredad):** Datakuppen-logga, timer, klassens totala data med förloppsmätare mot nästa milstolpe.
- **Topp 10:** avatarerna står vid var sin **server** (ett serverskåp vars lysdioder fylls på när datan växer), i samma läsordning som Guldrushens högar.
- **Händelseflöde:** som en terminal, högst 4 rader, till exempel:
  - `> Alma laddade ner 50 MB`
  - `> Omar hackade Leo: +45 MB`
  - `> Ines aktiverade brandvägg`
  - `> Clara fick ett virus: −12 MB`
- **Hack-händelse:** en kort ljuslinje (cirka 1 s) som löper från hackarens server till målets. Den får aldrig skymma timer, topplista eller text.
- **Milstolpar:** firas i totalrutan (puls, mätaren fylls, lite "datakonfetti" i form av ettor och nollor), aldrig som notis över timern.
- **Statistikvy:** som Guldrushens, i Datakuppens färger.

## 4.3 Elevens skärm

- Överst: elevens data, elevens kod (diskret) och skyddsstatus ("🛡️ Skyddad 0:42").
- Mitten: frågan, och efter rätt svar de **tre filerna**.
- **Öppna en fil:** en kort "dekrypterings"-animation (en förloppsstapel och tecken som rullar fram), högst cirka 1,5 sekunder, sedan effekten. Varje filtyp har eget utseende och ljud.
- **Hacka:** först målväljaren (Guldrushens offerväljare i ny stil), sedan tre stora kodkort i monospace. Vid fel kod stryks kortet med en tydlig animation.
- **Bli hackad:** en kort notis (cirka 2 s), sedan "Välj ny kod" som ett litet kort med fyra koder, utan att spelet stoppas.

## 4.4 Lobby och final

- **Lobby:** eleverna "loggar in" i nätverket. Varje avatar dyker upp vid en nod, och eleven väljer sin kod. Ett säkerhetstips roterar.
- **Final:** "🏆 Datakuppen – Prispall", pallen centrerad, "Tillsammans: 12 400 MB", pluggmyntpriset under varje plats, och ett säkerhetstips.

## 4.5 Ljud och musik

- **Musik:** `hackerlaget-dark-loop.ogg` (bifogas) som `format.music`, i `src/live/formats/datakuppen/assets/`. Tyst lobby, cirka 30 % volym under matchen, samma ducking och 🎵-knapp som Guldrushen.
- **Effekter:** korta, digitala och dämpade: ett "dekrypterings"-svep, ett mjukt "beep" vid data, ett lågt "access granted"-ljud vid lyckat hack, ett mjukt "nekad"-ljud vid fel kod. Inget gällt och inget som ringer kvar.
- Musiken spelas bara på projektorn och i elevskärmsfönstret. På elevernas datorer finns högst ett diskret effektljud, avstängt som standard (som i Guldrushen).

---

# 5. HISTORIK, STATISTIK OCH DEMO

- **Historik:** som Guldrushens (pallplats, klassens data, topplista med pluggmynt, andel rätt per uppgift och per kategori via `statKeys`).
- **Lärarstatistik:** dessutom antal hackförsök och andel lyckade (hela klassen, inte per elev på projektorn).
- **Demoläge:** utgå från `gr-demo.js`. Det ska gå att simulera 30 elever med avatarer, varje filtyp, ett lyckat hack, ett misslyckat hack, minnesmomentet (andra försöket mot samma mål med en kod struken), byt kod, brandvägg och skydd, milstolpe, tid snart slut och pallplats. Demoläget får aldrig röra riktig data eller dela ut pluggmynt.

---

# 6. TESTER

## Spelregler

- **Test 1:** Eleven går med i lobbyn. Förväntat: 4 koder ur listan att välja bland, olika varandra och helst inte tagna av någon annan i matchen.
- **Test 2:** Eleven väljer ingen kod före start. Förväntat: systemet väljer en ur listan.
- **Test 2b:** Listan innehåller 100 giltiga koder (minst en siffra, minst tre bokstäver, inga å/ä/ö, inga dubbletter).
- **Test 3:** En annan elev försöker läsa elevens kod via Firestore. Förväntat: nekas.
- **Test 4:** Rätt svar → tre filer, servern avgör innehållet.
- **Test 5:** Hack, rätt kod. Förväntat: 15 % flyttas i en transaktion, målet får skydd 30 s och "Välj ny kod".
- **Test 6:** Hack, fel kod. Förväntat: inget flyttas, den koden stryks.
- **Test 7:** Samma elev hackar samma mål igen (inte direkt efter). Förväntat: samma koder minus den strukna, i ny ordning.
- **Test 8:** Målet byter kod. Förväntat: nya koder vid nästa hack mot det målet, inga strukna.
- **Test 9:** Mål med brandvägg. Förväntat: gråat med nedräkning, valbart när skyddet går ut, servern nekar ett manipulerat val.
- **Test 10:** Hackning av. Förväntat: inga Hack-filer.
- **Test 11:** Virus. Förväntat: högst 10 %, aldrig allt.
- **Test 12:** Lockkoderna kommer ur listan, har ungefär samma längd som rätt kod, är inte någon annan spelares aktuella kod, och klienten kan inte se vilken som är rätt.
- **Test 13:** Alla attacktester i avsnitt 2 nekas.

## Gemensamt med Guldrushen

- **Test 14:** Utbrytningen till den gemensamma modulen: alla Guldrushens befintliga tester är gröna.
- **Test 15:** Pluggmynt efter matchen enligt `live-rewards`, och data kan aldrig bli pluggmynt under matchen.
- **Test 16:** Tidslinjefrågor, quiz och multiplikation fungerar.
- **Test 17:** Valfri speltid 1–60 min.
- **Test 18:** Musiken loopar utan hack, 🎵-knappen fungerar, ingen ducking när effekterna är avstängda.
- **Test 19:** Inga Emoji 13+ i Datakuppens gränssnitt.

## Design

- **Test 20:** Projektorn i 1920×1080 och 1280×720 med 1, 5 och 25 elever: översta raden fri, högst 4 rader i flödet, inget över timern.
- **Test 21:** Hack-linjen och milstolpar skymmer aldrig text eller topplista.
- **Test 22:** Elevens skärm på Chromebook (1366×768): fråga, filer, kodkort och skydd syns utan scroll.
- **Test 23:** Reducerad rörelse: glitch och ljuslinjer ersätts av toningar.
- **Test 24:** Finalskärmen: rätt rubrik, inga klassnamn, centrerad pall, säkerhetstips.

## Regression

- **Test 25:** Guldrushen, Snilleblixten och Klassmatchen fungerar som förut. Alla befintliga tester gröna.

Ta skärmdumpar av lobby, spel, hack (båda stegen), bli hackad, final och statistik, i 1920×1080, 1280×720 och 1366×768. Lägg dem i PR-beskrivningen.

---

# 7. PR-ORDNING

1. **Gemensam kistspelsmodul** utbruten ur Guldrushen. Ingen synlig förändring. Alla Guldrushen-tester gröna.
2. **Datakuppen: format, datamodell, server och regler** (koder, filer, hack, minnesmoment, byt kod) med attacktester.
3. **Datakuppen: elevvyn.**
4. **Datakuppen: projektorn** (Nätverket, lobby, final, statistik) och musiken.
5. **Historik, demoläge och dokumentation** (uppdatera `docs/LIVE-FORMAT.md` och `docs/DATAMODELL.md`).

---

# 8. PRIORITERING VID TIDSBRIST

**PRIORITET 1 – MÅSTE FUNGERA**
- Guldrushen oförändrad.
- Koder ur listan som är hemliga och föreslås av systemet.
- Filer avgjorda av servern, data som inte kan manipuleras.
- Hack med tre koder, minnesmomentet, byt kod.
- Skydd och trygghetsregler.
- Final och pluggmynt.

**PRIORITET 2 – MYCKET VIKTIGT**
- Nätverket på projektorn med topp 10 och terminalflöde.
- Elevvyns dekrypteringsanimation och kodkort.
- Musik och effekter.
- Demoläge.

**PRIORITET 3 – EXTRA**
- Hack-ljuslinjen.
- Säkerhetstipsen.
- Små robotar och detaljer i nätverket.

Markera aldrig något som färdigt om det bara är en platshållare.

---

# 9. RAPPORT

Avsluta med en kort rapport:

- Vad har byggts, och i vilka PR:er?
- Vad bröts ut ur Guldrushen till den gemensamma modulen, och hur verifierades att Guldrushen är oförändrad?
- Hur skyddas koderna, och hur fungerar minnesmomentet tekniskt?
- Vilka tester har körts, och med vilket resultat?
- Skärmdumpar.
- Vad behöver Elias göra själv (till exempel deploya Cloud Functions och Firestore-regler)?

---

# SLUTLIG RIKTLINJE

Datakuppen ska kännas som en egen, spännande värld: ett mörkt, lysande nätverk där eleverna laddar ner data, knäcker koder och bygger brandväggar, och där den som minns koderna har ett försprång.

Samtidigt gäller samma tre principer som i Guldrushen:

1. **Det som fungerar i dag ska fortsätta fungera.**
2. **Eleverna kan aldrig fuska till sig data eller läsa någon annans kod.**
3. **Leken är snäll.** Ingen förlorar allt, ingen blir måltavla, och ingen skriver någonsin in ett riktigt lösenord.

**NU BYGGER VI DATAKUPPEN!** 💾
