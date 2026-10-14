# UTVECKLINGSUPPDRAG: LÄRARKONTON OCH BEHÖRIGHETER
## Admin och årskurskonton i Pluggporten – och en enklare lärarsida

**Uppdrag till AI-utvecklingsteamet**

I dag finns bara **en sorts lärarkonto** (custom claim `teacher: true`), och `firestore.rules` ger varje lärare full behörighet till allt. Fler kollegor ska nu börja använda Pluggporten, och alla ska inte kunna radera och ändra allt.

Bygg därför två sorters lärarkonton:

1. **Admin** – full behörighet, som i dag. Elias och Rasmus.
2. **Årskurskonto** – ett konto per årskurs (till exempel "Årskurs 4"), som delas av lärarna i den årskursen. Det får arbeta med undervisningen i **de klasser admin har gett kontot**, men inte ändra konton, klasser eller ekonomi.

Samtidigt ska **lärarsidan ses över** så att den blir enklare och tydligare ordnad, och så att varje konto bara ser det det får använda.

**Detta är ett implementeringsuppdrag, inte ett uppdrag att bara skriva en plan.**

---

# 0. VIKTIGASTE PRINCIPERNA

1. **Ingen ska bli utelåst.** Alla befintliga lärarkonton blir admin, och migreringen sker innan nya regler gäller.
2. **Behörigheten avgörs på servern.** Att dölja en knapp räcker inte. Varje begränsning ska gälla i `firestore.rules` och i Cloud Functions, och testas där.
3. **Tillåtelselista, inte spärrlista.** Ett årskurskonto får **bara** det som står i avsnitt 2. Allt annat, även saker som inte nämns här och nya funktioner i framtiden, är förbehållet admin tills det uttryckligen tillåts.
4. **Admin fungerar exakt som i dag.**

---

# 1. ROLLER OCH DATAMODELL

## 1.1 Roller

| Roll | Custom claims | Vad |
| --- | --- | --- |
| **Admin** | `teacher: true`, `admin: true` | Allt, som i dag. |
| **Årskurskonto** | `teacher: true`, `role: "arskurs"` | Begränsat enligt avsnitt 2, och bara för sina klasser. |

## 1.2 Kontona

Spara kontona i en ny samling, exempelvis `teacherAccounts/{uid}`:

| Fält | Beskrivning |
| --- | --- |
| `username` | Inloggningsnamn, till exempel `arskurs4` |
| `displayName` | Visningsnamn, till exempel "Årskurs 4" |
| `role` | `"admin"` eller `"arskurs"` |
| `classIds` | Klasserna kontot har tillgång till (bara för årskurskonton). **Admin väljer.** |
| `active` | `false` = avstängt konto (kan inte logga in eller göra något) |
| `createdAt`, `createdBy`, `updatedAt` | |

- Bara admin får läsa och skriva samlingen, förutom att ett årskurskonto får läsa sitt **eget** dokument.
- `firestore.rules` avgör ett årskurskontos klasser genom att läsa kontots dokument (`get()`), eller genom att lägga `classIds` i claims. Välj den lösning som ger korrekta regler med rimlig kostnad, och redovisa valet. Tänk på att ändrade claims slår igenom först när token förnyas, så klassändringar ska slå igenom utan att läraren behöver vänta länge eller logga ut.

## 1.3 Hjälpfunktioner i reglerna

Ungefär:

- `isAdmin()` – admin-claim
- `isGradeTeacher()` – årskurskonto och aktivt
- `hasClass(classId)` – admin, eller klassen finns i kontots `classIds`
- `hasStudent(studentId)` – admin, eller elevens `students/{id}.classIds` har minst en av kontots klasser (`hasAny`). Fältet `classIds` på eleven finns redan (denormaliserat).

---

# 2. VAD ETT ÅRSKURSKONTO FÅR GÖRA

Allt gäller **bara de klasser admin har gett kontot**, och eleverna i dem.

## 2.1 Tillåtet

| Område | Får göra |
| --- | --- |
| **Statistik** | Se **all** statistik för sina klasser och elever: Plugga, Läsresan, Ekvationsresan, Mattematchen-statistik, Live-historik, Klasscentrets statistik och övrig statistik. Endast läsa. |
| **Material i Plugga** | **Skapa** nya arbetsområden (med AI-prompten, guiden, "mer innehåll"). **Ändra och radera sitt eget** material. **Se och använda** allt material, även andras, men inte ändra eller radera det. |
| **Områden** | Välja vilka områden klassen ser (`assignedAreas`). |
| **Lägen per område** | Välja vilka spellägen klassen ser per område. |
| **Moduler** | Välja vilka moduler klassen ser (modulvalet). |
| **Fokusläge** | Ställa in och låsa upp fokusläge för sina klasser. |
| **Elevlösenord** | **Ändra** lösenord för elever i sina klasser, **se sparade lösenord** och **skriva ut inloggningskort**. |
| **Läs- och mattnivå** | Ändra elevers nivå i Läsresan och Ekvationsresan, och klassens startnivå i Läsresan. |
| **Live** | Skapa och styra Live-matcher (alla format) med **sina klasser**. I Klassmatchen får de bjuda in **valfri motståndarklass**, även en klass de inte har tillgång till. Pluggmynt i Live ställs in **som vanligt**. De får styra (starta, avsluta) matcher där minst en av deras klasser deltar. |

## 2.2 Inte tillåtet (bara admin)

- **Lärarkonton:** se, skapa, ändra, stänga av eller radera.
- **Elevkonton:** skapa, radera, byta namn eller användarnamn, flytta mellan klasser. (Byta lösenord är tillåtet, se ovan.)
- **Klasser:** skapa, radera, byta namn, ändra elevlistan.
- **Mattematchen:** skapa, starta, stoppa, avsluta eller nollställa tävlingar. (Se statistiken är tillåtet.)
- **Ekonomi:** ge pluggmynt direkt, hantera klasskassan, pokaler och insamlingar i Klasscentret.
- **Andras material:** ändra eller radera material som någon annan har skapat.
- **Ämnen:** skapa, byta namn på eller radera ämnen. (Områden i befintliga ämnen får skapas.)
- **Nollställa eller radera elevdata** av något slag.
- **Klassbyar, hus och liknande** inställningar som inte nämns i 2.1.
- **Allt som inte uttryckligen står i 2.1.**

## 2.3 Ägarskap för material

- Nytt material får fälten `createdBy` (uid) och `createdByName` (till exempel "Årskurs 4").
- Befintligt material utan `createdBy` räknas som **admins**.
- I materiallistan visas vem som skapat materialet, och om kontot kan ändra det eller bara använda det.
- Ett årskurskonto kan **duplicera** andras material och få en egen kopia att ändra. (Det är ofta det läraren egentligen vill.)

---

# 3. ADMINSIDA: "LÄRARKONTON"

En ny sida i lärarvyn, **bara synlig för admin**.

## 3.1 Lista

En tabell med alla lärarkonton: visningsnamn, användarnamn, roll, klasser, aktiv/avstängd.

## 3.2 Skapa årskurskonto

1. Visningsnamn (till exempel "Årskurs 4") och användarnamn (förslag: `arskurs4`).
2. Lösenord (minst 6 tecken), eller "Skapa ett lösenord åt mig".
3. **Klasser:** en lista med kryssrutor över alla klasser. En hjälpknapp "Välj klasser som börjar på 4" gör det snabbt.
4. **Spara** skapar inloggningen (Firebase Auth), claims och `teacherAccounts`-dokumentet.

## 3.3 Hantera ett konto

- Ändra visningsnamn och klasser.
- Byta lösenord.
- Stänga av och aktivera.
- Radera (med tydlig bekräftelse). Material kontot skapat raderas **inte**; det blir admins.
- Ändra roll mellan årskurskonto och admin (med bekräftelse). Admin kan aldrig ta bort sin **egen** adminroll eller stänga av sig själv, och det måste alltid finnas minst ett aktivt adminkonto.

## 3.4 Tekniskt

- Allt som rör Firebase Auth och claims görs i **Cloud Functions** (Admin SDK), till exempel `adminCreateTeacher`, `adminUpdateTeacher`, `adminSetTeacherPassword`, `adminSetTeacherActive`, `adminDeleteTeacher`. Varje funktion kontrollerar att anroparen är admin.
- Följ mönstret från `updateStudentLogin` (region `europe-west1`).
- Ett avstängt konto: sätt `disabled` i Auth och `active: false`, så att det varken kan logga in eller använda en gammal token mot reglerna.

---

# 4. SERVERSIDAN: REGLER OCH FUNKTIONER

## 4.1 Firestore-reglerna

Gå igenom **alla** ställen i `firestore.rules` där `isTeacher()` används (cirka 80) och avgör för varje:

- **Läsning av statistik och elevdata:** årskurskonto bara för sina klasser och elever (`hasClass`, `hasStudent`).
- **Skrivning:** admin, eller årskurskonto bara där avsnitt 2.1 tillåter det.
- **Fältnivå där det behövs.** Till exempel får ett årskurskonto ändra Läsresans nivåfält i `studentData`, men inte `coins` eller annat. Använd `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`.
- `studentCredentials`: årskurskonto får läsa för elever i sina klasser, men inte skriva (lösenordsbyte går via Cloud Functionen).
- `classes`: årskurskonto får bara ändra de fält som styr synlighet, fokusläge och startnivå (`assignedAreas`, lägen, moduler, `lock`, `lasresaStartLevel10` + spegeln) på sina klasser. Aldrig `name`, `studentIds` eller annat.
- Material (`subjects/{s}/areas/{a}`): skapa med `createdBy == request.auth.uid`; ändra och radera bara om `resource.data.createdBy == request.auth.uid`. Ämnesdokumentet: bara admin.
- Live (`liveSessions`): skapa om minst en deltagande klass är kontots; styra om minst en deltagande klass är kontots. Lägg till `createdByRole` om det behövs.
- Mattematchen (`mathCompetitions`): skapa och ändra bara admin. Läsa statistik: som annan statistik.
- Klasscentrets kassa, pokaler, insamlingar: inga skrivningar för årskurskonton.

**Gör en tabell i `docs/BEHORIGHETER.md`** med varje samling och vad admin och årskurskonto får läsa och skriva. Den ska stämma med reglerna och testerna.

## 4.2 Cloud Functions

Varje befintlig funktion som en lärare kan anropa ska kontrollera rollen:

- `updateStudentLogin`: årskurskonto får bara byta **lösenord** för elever i sina klasser, inte användarnamn eller annat.
- Live-funktionerna (Guldrushen, Datakuppen m.fl.): som reglerna i 4.1.
- Alla nya admin-funktioner: bara admin.

---

# 5. LÄRARSIDAN – ENKLARE ORDNAD

Lärarsidan har vuxit med många funktioner. Se över den så att den blir lättare att hitta i, både för admin och för årskurskonton.

## 5.1 Förslag på struktur

Gruppera i några tydliga huvuddelar, till exempel:

1. **Översikt** – det läraren gör oftast: mina klasser, pågående Live, snabbval för fokusläge.
2. **Klasser** – per klass: vad klassen ser (områden, lägen, moduler), fokusläge, nivåer, elevlösenord och inloggningskort, statistik.
3. **Material** – Plugga-material: skapa, mitt material, allt material.
4. **Live och tävlingar** – Live, Mattematchen (bara admin).
5. **Statistik** – samlad statistik per modul.
6. **Admin** (bara admin) – lärarkonton, klasser och elevkonton, Klasscentrets ekonomi.

Analysera först dagens flikar och sidor (`src/teacher-*.js`) och föreslå den slutliga strukturen i PR-beskrivningen. Flytta funktioner, ändra inte hur de fungerar.

## 5.2 Synlighet efter roll

- Ett årskurskonto ser **bara** det det får använda. Funktioner som inte är tillåtna **döljs** (inte bara gråas).
- Klasslistor visar bara kontots klasser.
- Material som kontot inte får ändra visas med "Skapat av …" och knapparna **Använd** och **Duplicera**, men inte Ändra och Radera.
- Överst i lärarvyn visas vem som är inloggad, till exempel "Inloggad som Årskurs 4".
- Om servern ändå nekar något visas ett vänligt besked ("Det här kan bara admin göra"), aldrig ett tekniskt felmeddelande.

---

# 6. MIGRERING OCH DRIFT

## 6.1 Befintliga konton

- **Alla befintliga lärarkonton blir admin.** Skriv ett admin-skript (i stil med `admin/set-teacher-claim.mjs`) som sätter `admin: true` och skapar `teacherAccounts`-dokument för alla konton med `teacher: true`.
- Uppdatera `admin/set-teacher-claim.mjs` så att det kan skapa både admin och årskurskonto, som reserv om adminsidan inte går att nå.

## 6.2 Ordningen vid driftsättning

Utelåsning måste vara omöjlig. Dokumentera i `docs/ADMIN.md` och följ:

1. Deploya Cloud Functions.
2. Kör migreringsskriptet (alla befintliga lärare blir admin).
3. Verifiera att adminkontona har `admin: true` (skriptet skriver ut en lista).
4. Deploya Firestore-reglerna.
5. Deploya webbplatsen.

Reglerna ska under en övergångsperiod behandla ett konto med `teacher: true` **utan** `role` som admin, så att en gammal token inte låses ute innan den förnyas. Ta bort övergången när migreringen är verifierad, och redovisa hur länge den behövs.

---

# 7. TESTER

Reglerna ska testas med Firestore-emulatorn, i samma stil som befintliga regeltester (`test/firestore-rules-*.test.js`). Skapa minst tre testanvändare: **admin**, **Årskurs 4** (klasserna 4A, 4B) och **Årskurs 5** (klassen 5A).

## Statistik och synlighet
- **Test 1:** Årskurs 4 läser statistik för 4A. Tillåtet.
- **Test 2:** Årskurs 4 läser statistik och sparade lösenord för en elev i 5A. Nekas.
- **Test 3:** Admin läser allt. Tillåtet.

## Material
- **Test 4:** Årskurs 4 skapar ett område. Tillåtet, `createdBy` sätts.
- **Test 5:** Årskurs 4 ändrar och raderar sitt eget område. Tillåtet.
- **Test 6:** Årskurs 4 ändrar eller raderar Årskurs 5:s område eller admins område. Nekas.
- **Test 7:** Årskurs 4 duplicerar admins område. Tillåtet, kopian ägs av Årskurs 4.
- **Test 8:** Årskurs 4 skapar eller ändrar ett ämne. Nekas.

## Klasser och elever
- **Test 9:** Årskurs 4 ändrar `assignedAreas`, lägen, moduler, fokusläge och startnivå för 4A. Tillåtet.
- **Test 10:** Årskurs 4 ändrar samma sak för 5A. Nekas.
- **Test 11:** Årskurs 4 ändrar `name` eller `studentIds` för 4A. Nekas.
- **Test 12:** Årskurs 4 skapar eller raderar en klass eller ett elevkonto. Nekas.
- **Test 13:** Årskurs 4 byter lösenord för en elev i 4A. Tillåtet. För en elev i 5A: nekas. Byter användarnamn: nekas.
- **Test 14:** Årskurs 4 ändrar Läsresan- och Ekvationsresan-nivå för en elev i 4A. Tillåtet. Ändrar `coins` på samma elev: nekas.

## Live, Mattematchen och ekonomi
- **Test 15:** Årskurs 4 skapar Klassmatchen 4A mot 5A. Tillåtet. 5A mot 6A: nekas.
- **Test 16:** Årskurs 4 startar och avslutar en match där 4A deltar. Tillåtet.
- **Test 17:** Årskurs 4 skapar eller nollställer en Mattematchen. Nekas.
- **Test 18:** Årskurs 4 ger mynt, ändrar klasskassan eller delar ut en pokal. Nekas.

## Konton
- **Test 19:** Årskurs 4 läser eller ändrar `teacherAccounts` (utom sitt eget dokument att läsa), eller anropar en admin-funktion. Nekas.
- **Test 20:** Admin skapar ett årskurskonto med klasser via adminsidan. Kontot kan logga in och ser bara sina klasser.
- **Test 21:** Admin tar bort 4B från Årskurs 4. Ändringen slår igenom utan att läraren måste logga ut.
- **Test 22:** Admin stänger av Årskurs 4. Kontot kan inte logga in eller skriva något.
- **Test 23:** Admin försöker ta bort sin egen adminroll, eller stänga av det sista adminkontot. Nekas.

## Migrering och regression
- **Test 24:** Migreringsskriptet gör alla befintliga lärare till admin, och de kan göra allt som förut.
- **Test 25:** Ett konto med `teacher: true` utan `role` behandlas som admin under övergången.
- **Test 26:** Alla befintliga regeltester, funktionstester och e2e-tester är gröna (med admin som lärare).

## Lärarsidan
- **Test 27:** Årskurs 4 ser bara tillåtna delar. Admin-delen, lärarkonton, Mattematchen-administration, ekonomi och klass- och elevhantering syns inte.
- **Test 28:** Skärmdumpar av lärarsidan som admin och som årskurskonto (1366×768 och 1920×1080) i PR-beskrivningen.

---

# 8. PR-ORDNING

1. **Roller, datamodell, migreringsskript och admin-funktioner** (inga regeländringar ännu). Admin-sidan "Lärarkonton".
2. **Firestore-reglerna och Cloud Functions-kontrollerna**, med alla regeltester. Övergången för konton utan `role`.
3. **Ägarskap för material** (`createdBy`, duplicera).
4. **Lärarsidan:** ny struktur och synlighet efter roll.
5. **Dokumentation:** `docs/BEHORIGHETER.md` och driftordningen i `docs/ADMIN.md`.

---

# 9. RAPPORT

Avsluta med en kort rapport:

- Vad har byggts, och i vilka PR:er?
- Hur avgörs ett kontos klasser i reglerna (dokument eller claims), och varför?
- Tabellen i `docs/BEHORIGHETER.md`.
- Vilka tester har körts, och med vilket resultat?
- Skärmdumpar av lärarsidan för båda rollerna.
- **Exakt vad Elias behöver göra**, i ordning, för att driftsätta utan utelåsning.
- Ställen där det var oklart om något skulle vara tillåtet, och vad ni valde.

---

# SLUTLIG PRINCIP

Fler lärare ska kunna använda Pluggporten fullt ut i sin undervisning: skapa material, styra vad klassen ser, följa statistik, starta Live och hjälpa elever med inloggningen.

Men **konton, klasser, ekonomi och andras material** ägs av admin. Och varje begränsning ska gälla på servern, inte bara i gränssnittet.
