# UTVECKLINGSUPPDRAG: SCHACK – MOT DATORN OCH MOT KLASSKOMPISAR

**Uppdrag till AI-utvecklingsteamet**

Pluggporten ska få ett schackläge där eleverna kan:

- spela **mot datorn** på olika svårighetsnivåer
- spela **mot en klasskompis** i realtid: se vem som väntar i lobbyn, gå med eller utmana någon
- **lära sig schack** steg för steg och lösa **schackpussel** ("Matt i ett drag")

~~Schack är **bara för skojs skull** och ger inga pluggmynt.~~ **Ändrat 2026-10-19 (#798, Elias):** första vinsten
mot datorn per nivå ger pluggmynt (Bonden 200, Springaren 400, Tornet 500, Damen 500 + pokal), och varje lektion i
"Lär dig schack" och varje pussel ger 5 mynt en gång – se `docs/SCHACK.md` §18. Partier mot kompisar ger fortfarande
inga mynt. Eleverna möter bara sin **egen klass**.

**Detta är ett implementeringsuppdrag i tre etapper.** Varje etapp ska vara klar och testad innan nästa påbörjas.

1. **Etapp 1:** brädet, reglerna och datormotståndaren.
2. **Etapp 2:** elev mot elev, med lobby, schackklocka, topplista och lärarvy.
3. **Etapp 3:** guiden "Lär dig schack" och pusslen.

---

# 0. LÄS FÖRST

- `src/gamemode-visibility.js`: `STUDENT_MODULES`, `optIn` och `enabledModules`. Schack blir en **opt-in-modul** per klass.
- `src/ui.js`: `NAV_LANKAR`. `docs/FOKUSLAGE.md`: hur moduler stängs av fokusläget.
- `src/teacher-shared.js`: `TEACHER_TABS`. `src/teacher-classes-sections.js`: `CLASS_SECTIONS`.
- `firestore.rules`: `isClassMember()`, `hasClass()` och `isSelf()`.
- `functions/index.js` (`onCall`, region `europe-west1`) och `admin/sync-guldrush-functions.mjs`. Det är mönstret för att dela kod mellan klienten och Cloud Functions.
- `src/class-projection.js`: elevnamn för hela klassen med **en** läsning (#231).
- `docs/BEHORIGHETER.md`: varje ny samling och varje ny callable ska in i tabellerna, och testerna kräver det.
- `docs/DESIGNSYSTEM.md`: stilen för brädet och pjäserna.

**Regler:**

- **Bootgrafen (#271):** allt nytt ligger i `src/schack/` och laddas med `import()`. Skriv ett källkodstest för det.
- **Kvoten (#231):** inga läsningar per elev i heta flöden. Räkna ut och redovisa läsningarna och skrivningarna för ett parti och för lobbyn (se 9).
- **Licenser:** allt tredjepartsmaterial ska ha en licens som tillåter användning på en publik sajt. Licensfilerna läggs bredvid koden.
  - `chess.js` har BSD-2-licens och går bra.
  - **Använd inte** Stockfish, chessground eller andra GPL-licensierade bibliotek, och inga pjäsbilder med oklar licens.

---

# ETAPP 1 – BRÄDET, REGLERNA OCH DATORN

## 1. Reglerna: chess.js

- **Lägg in** en fast version av `chess.js` (ESM-bygget) i `src/schack/vendor/` tillsammans med `LICENSE`. Skriv versionen i en kommentar.
- **All regelkontroll går genom chess.js:**
  - lagliga drag
  - rockad, en passant och bondeförvandling
  - schack, schack matt och patt
  - remi genom trefaldig upprepning, 50-dragsregeln och för lite material
- **Ingen egen regelkod.** Det minskar risken för buggar.
- **Bara lagliga drag går att göra.** Ett drag som ställer eller lämnar den egna kungen i schack går inte att göra och visas inte heller som möjligt. Eleven kan alltså aldrig "råka" ställa sig i schack.

## 2. Brädet

### 2.1 Utseendet

- **Pjäserna** ritas som egna SVG-bilder i Pluggportens stil: mjuka former, mörklila kontur och tydliga siluetter. Vita pjäser är ljust krämvita och svarta är mörkt skiffergrå. Lägg dem i `src/schack/schack-pjaser.js`.
  - **Varje pjästyp** ska gå att känna igen direkt även i 40 px storlek. Testa på Chromebook.
  - **Använd inte** de vanliga schacktecknen i text (♔♕♖…). De ser olika ut på olika datorer.
- **Rutorna** har mjuka färger, till exempel ljus sand och dämpad grön. Kontrasten mot pjäserna ska vara god.
- **Koordinaterna** a–h och 1–8 visas i kanten, eftersom de hjälper eleverna att lära sig.
- **Brädet vänds** så att den egna färgen alltid står närmast eleven.
- **Storleken** följer skärmen, men brädet blir aldrig mindre än 320 px. Det fungerar på Chromebook, surfplatta och mobil.

### 2.2 Att flytta pjäser (som på chess.com)

- **Tryck på en egen pjäs.** Den markeras, och alla **möjliga drag** visas: en prick på tomma rutor och en ring på rutor där pjäsen kan ta en pjäs.
- **Tryck på en markerad ruta** för att flytta dit. Ett tryck på en annan egen pjäs byter markering, och ett tryck någon annanstans avmarkerar.
- **Dra och släpp** fungerar också, med mus eller finger.
- **Senaste draget** markeras på båda rutorna, som en svag gul ton.
- **En kung i schack** får en röd glöd.
- **Bondeförvandling:** en liten väljare visar dam, torn, löpare och springare som bilder. Dam är förvald och ligger först.
- **Animation:** pjäserna glider kort (cirka 150 ms). Står `prefers-reduced-motion` på hoppar de direkt.
- **Tangentbord:** piltangenterna flyttar mellan rutorna och Enter väljer. Rutorna har `aria-label`, till exempel "e4, vit springare".

### 2.3 Runt brädet

- **Spelarnas namn** visas med en liten avatar, och den spelare som är på tur markeras.
- **Tagna pjäser** visas för varje spelare.
- **Draglistan** visas i enkel notation, till exempel "1. e4 e5 2. Sf3". Den är dold som standard och fälls ut med "Visa drag".
- **Statusraden** visar till exempel "Din tur", "Datorn tänker…", "Schack!", "Schack matt – du vann! 🎉" eller "Remi – ingen vann".

## 3. Datormotståndaren

### 3.1 Motorn

- **En egen liten motor** i `src/schack/schack-motor.js`:
  - alfa-beta-sökning, alltså några drag framåt
  - värdering av material och av var pjäserna står
  - dragen genereras med chess.js
- **Motorn körs i en Web Worker**, så att brädet aldrig fryser.
- **Tidsgräns:** högst 1 sekund per drag på en Chromebook. Mät och redovisa.

### 3.2 Fyra nivåer

| Nivå | Beteende |
| --- | --- |
| **Bonden** | Mycket snäll. Ser 1 drag framåt och väljer ofta ett slumpmässigt bra drag i stället för det bästa. Missar ibland att ta en pjäs med flit. |
| **Springaren** | Ser 2 drag framåt, med lite slump. |
| **Tornet** | Ser 3 drag framåt. |
| **Damen** | Ser 4 drag framåt eller mer, inom tidsgränsen, utan slump. |

Eleven väljer nivå och färg: vit, svart eller slumpad.

### 3.3 Hjälp mot datorn

- **Ångra:** tar tillbaka elevens senaste drag och datorns svar. Det finns bara mot datorn.
- **Tips:** motorn markerar ett bra drag med en pil. Det finns bara mot datorn.
- **Varna mig** (på som standard för Bonden och Springaren, går att stänga av):
  - **Pjäs i fara:** om eleven är på väg att ställa sin dam eller ett torn så att det kan tas gratis, eller göra ett drag som ger **schack matt i nästa drag**, visas en ruta på sidan: "Om du flyttar dit kan datorn ta din dam. Vill du ändå?" med knapparna "Ångra" och "Flytta ändå".
  - **Bara ett stöd:** varningen gäller enbart mot datorn och i pusslen. Den är aldrig med mot klasskompisar.
- **Partiet sparas** i `localStorage` (inom try/catch), så att eleven kan fortsätta efter en omladdning.

## 4. Eleven: sidan "Schack"

- **Modulen:** lägg till `schack` i `STUDENT_MODULES` med `optIn: true` (läraren slår på den per klass) och `lockable: false`.
  - Länken heter **"Schack"** och har en egen SVG-ikon, en bonde.
  - Den ligger i gruppen **"Öva"** i sidomenyn (se `UTVECKLINGSUPPDRAG_PLUGGA_DESIGN.md`).
- **Fokusläget** stänger schacket som alla andra moduler.
- **Startsidan för schack** (`#/elev/schack`) har stora kort för:
  - **Spela mot datorn**
  - **Spela mot en kompis** (Etapp 2)
  - **Lär dig schack** (Etapp 3)
  - **Pussel** (Etapp 3)
- **Ett pågående parti mot datorn** visas överst med knappen **Fortsätt partiet**.

## 5. Etapp 1 – tester

- **Reglerna** går genom chess.js. Testa att:
  - rockad, en passant och förvandling går att göra i gränssnittet
  - drag som ställer kungen i schack inte visas och inte går att göra
- **Motorn:**
  - hittar matt i ett drag på nivåerna Tornet och Damen
  - Bonden väljer inte alltid det bästa draget, testat med fast slumptal
  - håller tidsgränsen
- **"Varna mig"** varnar för ett drag som ger matt i ett och för en dam som kan tas, men inte för vanliga drag.
- **Ångra och tips** fungerar.
- **Partiet** finns kvar efter en omladdning.
- **Förhandsvisningssida** `preview/preview-schack.html` med brädet, alla pjäser, bondeförvandlingen och slutrutorna. Lägg skärmdumpar på pjäserna i PR:en så att Elias kan godkänna dem.

---

# ETAPP 2 – ELEV MOT ELEV

## 6. Datamodellen

```
schackKlass/{classId}                  ← EN doc per klass (lobbyn + pågående + tabell)
  vantar:  { [uid]: { namn, klocka: null|5|10|15, sedan } }
  utmaningar: { [utmaningId]: { fran, franNamn, till, klocka, sedan } }
  partier: { [partiId]: { vit, svart, vitNamn, svartNamn, klocka, start } }   // bara pågående
  tabell:  { [uid]: { poang, vinster, forluster, remier, partier } }
  dold: false                                                               // läraren kan dölja topplistan

schackPartier/{partiId}
  classId, vit, svart, vitNamn, svartNamn
  fen, drag: ["e4","e5",...], tur: "w"|"b"
  status: "pagar"|"slut"
  resultat?: "1-0"|"0-1"|"½-½", orsak?: "matt"|"patt"|"remi"|"gav-upp"|"tid"|"lamnade"|"avbrutet"
  klocka?: { minuter, vitMs, svartMs, senastDragAt }
  remiErbjudenAv?: uid
  skapad, uppdaterad
```

**Alla skrivningar går genom Cloud Functions** (callables). Eleverna skriver aldrig direkt i de här samlingarna.

- **Lobbyn:**
  - `schackVanta({classId, klocka})` och `schackSlutaVanta()`
  - `schackGaMed({classId, motstandare})`: man går med i någons väntan, och partiet startar
  - `schackUtmana({classId, till, klocka})` och `schackSvara({utmaningId, ja})`
- **Partiet:**
  - `schackDrag({partiId, from, to, promotion})`
  - `schackGeUpp({partiId})`
  - `schackRemi({partiId, handling: "erbjud"|"acceptera"|"neka"})`
  - `schackKravaVinst({partiId})` (se 7.3)

**Varje callable kontrollerar att:**

- den som anropar är medlem i klassen
- modulen `schack` är påslagen för klassen
- fokusläget inte är aktivt för klassen

**Draget kontrolleras på servern** med samma chess.js, som synkas till `functions/` med ett `admin/sync-schack-functions.mjs` enligt Guldrushens mönster. Servern:

- kontrollerar att det är spelarens tur och att draget är lagligt
- uppdaterar FEN, draglistan och klockan med **serverns tid**
- avgör om partiet är slut

Ingen kan fuska in ett ogiltigt drag eller ändra klockan.

**När partiet är slut** gör funktionen allt i **en transaktion**: tar bort partiet ur `partier` och uppdaterar `tabell` för båda spelarna.

**Regler:**

- `schackKlass/{classId}`: läsbar för `isClassMember(classId)` och `hasClass(classId)`.
- `schackPartier/{id}`: läsbar för de två spelarna och för en lärare med `hasClass(classId)`.
- Klienten får inte skriva i någon av dem.

## 7. Lobbyn och partiet

### 7.1 Lobbyn ("Spela mot en kompis")

- **Läsning:** **en** `onSnapshot` på `schackKlass/{classId}`, och bara medan eleven är på schacksidan.
- **Sidan visar:**
  - **Väntar på motståndare:** kort med namn, avatar och klocka ("Elias väntar · 10 min") och knappen **Spela!**
  - **Knappen "Vänta på en motståndare"** med val av klocka: ingen, 5, 10 eller 15 minuter per spelare.
  - **Utmana en kompis:** klasslistan med knappen "Utmana". Namnen kommer från `classProjections`, med en läsning.
  - **Pågående partier i klassen:** "Elias – Sara", bara för information.
  - **Topplistan** (se 8).
- **En utmaning** visas för den utmanade som en tydlig ruta: "Sara vill spela schack med dig (10 min)" med knapparna "Spela!" och "Nej tack". Utmaningen försvinner efter 2 minuter.
- **Bara ett parti mot en kompis åt gången** per elev.
- **Väntan** tas bort efter 10 minuter, eller när eleven lämnar sidan om det går.

### 7.2 Partiet

- **Samma bräde och samma hjälp** som i Etapp 1, alltså med möjliga drag när man trycker på en pjäs. **Utan ångra, tips och varningar.**
- **Läsning:** **en** `onSnapshot` på partiet.
- **Väntan på servern:** medan draget skickas visas pjäsen direkt på den nya rutan, men lite genomskinlig, och "Skickar…" visas. Nekar servern hoppar pjäsen tillbaka.
- **Klockan** (om den används):
  - Båda klockorna syns och räknar ned hos den som är på tur.
  - Visningen räknas ut lokalt från `senastDragAt` och serverns tid (`serverNow`), så att det inte behövs någon skrivning varje sekund.
  - När tiden har tagit slut kan motståndaren kräva vinst. Servern kontrollerar tiden.
- **Knappar:** **Ge upp** och **Föreslå remi**, båda med en bekräftelseruta på sidan, inte `confirm()`.
- **Slutrutan:** "Du vann! Sara gav upp." eller "Schack matt – Elias vann." med knapparna **Spela igen** (som utmanar samma kompis) och **Till lobbyn**.

### 7.3 Om någon lämnar

- **Med klocka:** tiden räknar ned som vanligt.
- **Utan klocka:**
  - Om den spelare som är på tur inte har gjort något drag på **5 minuter** visas en knapp för motståndaren: **"Sara verkar ha gått. Avsluta partiet och ta vinsten?"** Den kör `schackKravaVinst`, och servern kontrollerar tiden.
  - Spelaren som är på tur ser en varning efter 4 minuter: "Din tur! Om en minut kan din motståndare avsluta partiet."
- **Gamla partier:** ett parti utan drag på 24 timmar avslutas som **avbrutet**, utan att tabellen påverkas. Det görs av en schemalagd funktion eller när klassdokumentet läses. Redovisa vilket ni valde.

## 8. Topplistan

- **Poängen räknas enkelt och snällt:** alla börjar på **1000 poäng**.
  - Vinst ger +10 till +30 poäng och förlust −5 till −20, beroende på motståndarens poäng. Använd en Elo-liknande formel med låg K-faktor.
  - Remi ger en liten justering.
  - **Ingen kan få under 800 poäng**, så att ingen sjunker hur lågt som helst.
- **Topplistan** visar placering, namn, poäng och vinster/förluster/remier. Den egna raden markeras.
- **Förklaringen** för eleven: "Du får mer poäng om du vinner mot någon som har många poäng."
- **Bara partier mot kompisar räknas**, inte partier mot datorn.
- **Läraren** kan dölja topplistan för klassen (`dold: true`) och nollställa den.

## 9. Kvot

Räkna och redovisa i rapporten:

- **Ett parti** med 40 drag och klocka, inklusive båda spelarnas lyssnare. Ungefär 80 skrivningar och 160 läsningar är rimligt.
- **Lobbyn:** när 25 elever har lobbyn öppen ger varje ändring i klassdokumentet 25 läsningar. Håll ändringarna få, alltså inga skrivningar per sekund och ingen närvaro-ping.
- **Stängda lyssnare:** lyssnarna stängs när eleven lämnar schacksidan.

## 10. Läraren

Lägg till en sektion **"Schack"** i klassens sidor (`CLASS_SECTIONS`):

- **Modulen** slås på eller av för klassen (via `enabledModules`).
- **Pågående partier:** en lista. Ett klick visar partiet **live** som åskådare, med samma bräde, bara att titta på och vänt så att vit står nederst.
- **Läraren kan avsluta ett parti**, till exempel när lektionen är slut. Det avslutas som avbrutet och påverkar inte tabellen.
- **Topplistan:** att se, dölja för eleverna eller nollställa.
- **Statistik:** antal spelade partier per elev, mot kompisar och mot datorn. Datorpartier räknas lokalt och behöver inte sparas.

## 11. Etapp 2 – tester

- **Regeltester** för `schackKlass` och `schackPartier`:
  - elever i andra klasser kan inte läsa
  - klienten kan inte skriva
  - läraren med `hasClass` kan läsa
- **Functions-tester:**
  - fel spelare, fel tur och olagligt drag nekas
  - klockan räknas med serverns tid
  - `schackKravaVinst` nekas före 5 minuter och när tiden inte har tagit slut
  - topplistan uppdateras i samma transaktion, och poängen kan inte gå under 800
  - lobbyn kan inte skapa två parallella partier för samma elev
- **Två webbläsare:** ett helt parti spelas fram till matt, ett till remi, ett där någon ger upp och ett där tiden tar slut.
- **Lärarvyn:** åskådarläget uppdateras live, och läraren kan avsluta ett parti.

---

# ETAPP 3 – LÄR DIG SCHACK OCH PUSSEL

## 12. Guiden "Lär dig schack"

En steg-för-steg-kurs med små interaktiva bräden:

1. **Brädet:** rader, kolumner och var pjäserna står från början.
2. **Tornet**, 3. **Löparen**, 4. **Damen**, 5. **Kungen**, 6. **Springaren**, 7. **Bonden**:
   - Varje lektion är **ett bräde med bara den pjäsen** och några **stjärnor** att samla. Eleven flyttar pjäsen och tar stjärnorna på så få drag som möjligt.
   - En kort text förklarar hur pjäsen går, och de möjliga dragen visas som vanligt.
8. **Ta pjäser.**
9. **Schack:** hur man skyddar kungen.
10. **Schack matt och patt.**
11. **Specialdragen:** rockad, en passant och bondeförvandling.
12. **Ditt första parti** mot Bonden.

- **Framsteg:** varje lektion får 1–3 stjärnor, efter antal drag. Framstegen sparas i `studentData.schack.lektioner` med få skrivningar, en per avklarad lektion.
- **Ingen tidspress och inga mynt.**

## 13. Pussel

- **Pusselbanken:** Lichess öppna pusseldatabas har licensen **CC0** (allmän egendom). Ett skript i `admin/` filtrerar ut cirka **200 "Matt i ett drag"** och **200 "Matt i två drag"** med låg svårighet, och sparar dem som statisk JSON i `src/schack/pussel/`.
  - Redovisa filtret och källan i en `README` i samma mapp.
  - Pusslen laddas lazy.
- **Ordningen:** pusslen kommer från lätt till svårt. Eleven får ett pussel i taget med texten **"Vit drar och gör matt i ett drag"**.
- **Rätt drag:** "Snyggt! Schack matt! ⭐", och nästa pussel visas.
- **Fel drag:** "Inte riktigt – prova igen!" och pjäsen hoppar tillbaka.
- **Tips:** knappen **Tips** markerar vilken pjäs som ska flyttas.
- **Matt i två:** när eleven har gjort ett rätt första drag gör datorn motståndarens försvar, och sedan gör eleven matt.
- **Framsteg:** antal lösta pussel och det senaste pusslet sparas i `studentData.schack.pussel`.
- **Inga mynt.**

## 14. Etapp 3 – tester

- **Lektionerna:** varje lektion går att klara, och stjärnorna räknas efter antal drag.
- **Pusselskriptet:** varje pussel har exakt rätt lösning enligt chess.js. Matt i ett ska verkligen vara matt efter lösningsdraget.
- **Fel drag:** ett fel drag hoppar tillbaka, och tipset visar rätt pjäs.
- **Framstegen:** de sparas och finns kvar efter omladdning.

---

# DOKUMENTATION, PR-ORDNING OCH RAPPORT

- **Nytt dokument `docs/SCHACK.md`:**
  - arkitekturen
  - motorn och nivåerna
  - callables och datamodellen
  - kvotbudgeten
  - licenserna (chess.js BSD-2, Lichess-pusslen CC0 och egna pjäsbilder)
- **`docs/BEHORIGHETER.md`:** samlingarna och alla callables.
- **`docs/DATAMODELL.md`:** samlingarna och `studentData.schack`.

**PR-ordning:**

1. Etapp 1: chess.js, brädet och pjäserna, som en PR med förhandsvisningssidan.
2. Etapp 1: motorn, nivåerna, hjälpen mot datorn och elevens schacksida.
3. Etapp 2: datamodellen, reglerna och alla callables med tester.
4. Etapp 2: lobbyn, partiet, klockan och topplistan.
5. Etapp 2: lärarens sektion med åskådarläget.
6. Etapp 3: guiden "Lär dig schack".
7. Etapp 3: pusslen.

**Rapporten efter varje etapp:**

- vad som har byggts
- skärmdumpar på brädet, lobbyn och slutrutan
- uppmätt tid per drag för motorn på Chromebook
- den uträknade budgeten för läsningar och skrivningar
- vad som behöver deployas (regler, functions, index) och i vilken ordning

Alla befintliga tester ska vara gröna.
