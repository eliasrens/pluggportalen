# Säkerhetsplan – inloggning, auth & Firestore-härdning

> **Status:** SPIKE / kartläggning. Detta dokument ändrar **ingen** app-kod och rör **ingen** data i
> Firestore. Det är beslutsunderlag för en kommande implementations-epic.
>
> **Scope:** elevinloggning, lärarens kontoskapande, dataskrivningar och `firestore.rules`.
> **Kontext:** lågrisk-skolapp (SO-övningar för en klass). Vi väger enkelhet mot säkerhet –
> målet är "rimligt säkert utan att göra appen krånglig", inte banknivå.
>
> **Hårt krav (från beställaren):** härdningen får **inte** göra onboarding tungrott. Läraren ska
> snabbt kunna skapa elevkonton – **helst i bulk för en hel klass** – och eleven ska kunna logga in
> lika enkelt som idag (användarnamn + lösenord, inget mejl, ingen verifieringslänk). Varje
> alternativ nedan bedöms därför även mot detta krav, och §5 beskriver det konkreta lågfriktions-
> flödet. **Auth-lösningen och reglerna är valda just för att tillåta det flödet.**

---

## 1. Flödeskarta – så fungerar det idag

### 1.1 Elevinloggning
`src/pages-elev.js → pageElevLogin()` renderar formuläret (användarnamn + lösenord + "kom ihåg mig")
och anropar `data.login()`.

`src/data.js → login()` (rad ~92):
1. Normaliserar användarnamnet (`trim().toLowerCase()`).
2. Kör en **klientsidig Firestore-query**: `collection("students") where username == uname`.
3. Läser tillbaka elevdokumentet, inkl. `password`-fältet **i klartext**.
4. Jämför `student.password !== pw` **i webbläsaren**.
5. Vid träff: sparar en session i `localStorage` (kom-ihåg) eller `sessionStorage`
   (`{ studentId, namn, username }`) och kör `ensureStudentData()`.

Det finns **ingen Firebase Auth**. `src/firebase-config.js` initierar bara `getFirestore(app)` –
`request.auth` är alltid `null`. "Session" = ett JSON-objekt i browser-storage, ingen server vet
vem som är inloggad.

### 1.2 Lärarläge & kontoskapande
- **Lärarspärr** (`src/teacher-shared.js`): hårdkodat lösenord `TEACHER_PASSWORD = "larare2026"`
  jämförs i klienten; en flagga sätts i `sessionStorage`. Kommentaren i koden säger själv "EJ
  säkerhetskritiskt – bara en tröskel". Lösenordet ligger dessutom i klartext i JS-bundlen **och**
  skrivs ut på gate-sidan ("Standardlösenord: **larare2026**").
- **Skapa/redigera elever** (`src/teacher-students.js → data.upsertStudent()` i
  `src/data-content.js`): skriver `students/{id} = { namn, username, password, avatarId }` direkt
  från klienten (`setDoc … merge`) och `ensureStudentData()`. Radera = `deleteStudent()`
  (`deleteDoc` på `students/{id}` + `studentData/{id}`).
- **Ge coins** (`teacher-students.js → data.addCoins()`): transaktion på `studentData/{id}`.
- **Klasser** (`data-content.js`): `upsertClass` / `setClassStudents` / `setClassAssignments` /
  `deleteClass` skriver `classes/{id}` direkt.
- **Innehåll** (`teacher-content.js → saveArea/deleteArea/upsertSubject`): skriver
  `subjects/{id}` och `subjects/{id}/areas/{id}` direkt.

### 1.3 Dataskrivningar – vem skriver vad, var
| Aktör | Väg | Skriver |
|---|---|---|
| Elev (inloggad) | `data.js` (klient-SDK) | `studentData/{id}` – coins, xp, progress, ownedItems, avatar, rum |
| "Lärare" (soft-gate) | `data-content.js` (klient-SDK) | `students/{id}`, `studentData/{id}`, `classes/{id}`, `subjects/{id}/areas/{id}` |
| Seed-skript | `seed/seed.mjs` (Node, REST PATCH + web-API-nyckel) | `subjects`, `areas`, `students`, `studentData` |
| Seed-tillägg | `seed/seed-party-pairs.mjs` (`--write`) | patchar ett `areas`-dokument |
| Granskning | `seed/audit-areas.mjs` | **läser** allt, skriver inget |

Alla skrivningar går genom **exakt samma öppna dörr**: `firestore.rules` tillåter
`allow read, write: if true` för `subjects`, `areas`, `students`, `studentData` och `classes`.
Seed-skripten fungerar bara *tack vare* att reglerna är öppna – de autentiserar inte, de skickar
bara den publika web-API-nyckeln (`AIzaSyB34…`, samma som ligger i `firebase-config.js`) till
Firestore REST-API:t.

### 1.4 Datamodell (nuläge)
```
students/{id}      = { namn, username, password (KLARTEXT), avatarId }
studentData/{id}   = { coins, xp, progress, ownedItems, avatarItems, room, husSkalId, avatarId }
subjects/{id}      = { name, order, icon, description }
subjects/{id}/areas/{id} = { name, order, coverEmoji, texts[], quiz[], pairs[] }
classes/{id}       = { name, order, createdAt, studentIds[], assignedAreas[] }
```

---

## 2. Hotbild – vad en utomstående kan göra idag

Med bara projekt-ID:t (publikt) och den publika web-API-nyckeln, från valfri dator, **utan konto**:

1. **Läsa ut alla elevers lösenord i klartext.** `students` är världsläsbar och `password` ligger i
   dokumentet. En enda ohämmad `getDocs(collection("students"))` ger namn + användarnamn + lösenord
   för hela skolan. Barn återanvänder ofta lösenord → spридning utanför appen.
2. **Logga in som vilken elev som helst** (följdeffekt av 1), eller strunta i login helt och skriva
   direkt mot `studentData`.
3. **Ändra/radera vad som helst:** nolla eller pumpa coins, skriva om progress, **radera elevkonton
   och deras speldata**, radera/vandalisera arbetsområden (`texts`, `quiz`, `pairs`), döpa om/radera
   klasser. Allt är `write: if true`.
4. **Sätta godtycklig data** i alla fem collections (skräp, stötande innehåll som visas för elever).
5. **Kringgå lärarspärren trivialt** – lösenordet står i klartext i JS-bundlen och skrivs t.o.m. ut
   på gate-sidan. (Spelar dock ingen roll: reglerna är öppna ändå, så gaten skyddar ingenting.)

**Sammanfattning:** appen har i praktiken *ingen* åtkomstkontroll. Den enda "säkerheten" är att en
angripare måste veta projekt-ID:t – vilket det står i den publika källkoden. Den allvarligaste
enskilda bristen är **klartext-lösenord i en världsläsbar collection**.

---

## 3. Arkitekturalternativ

Grundinsikt: en ren klientapp **utan** serverkomponent kan omöjligt både (a) verifiera ett lösenord
och (b) hindra klienten från att läsa det. Alla trovärdiga lösningar bygger därför på **Firebase
Auth** (Google hashar/lagrar lösenordet åt oss) och/eller en **Cloud Function**. Nedan tre nivåer.

Gemensamt för alla tre:
- `password`-fältet försvinner ur `students`-dokumentet (lösenordet lever bara i Firebase Auth).
- Firestore-dokumentens id:n behålls (`elev1` osv.) genom att Auth-uid sätts = befintligt id vid
  migrering (Admin SDK tillåter `createUser({ uid })`).
- Reglerna byts från "öppet" till auth-baserat (skiss i §3.4).
- Lärar-identitet får en **custom claim** `teacher: true` så reglerna kan skilja lärare från elev.

### 3.1 Alternativ A – Firebase Auth med syntetisk e-post, **utan** Cloud Functions *(lättast)*

**Idé:** använd Firebase Auth "Email/Password". Användarnamnet mappas deterministiskt till en
syntetisk adress i klienten: `email = ${username}@elev.pluggportalen.local`. Eleven ser aldrig någon
e-post.

- **Elevens login-UX:** *oförändrad.* Formuläret är exakt likadant. `data.login()` byter internt
  `getDocs(...)` + klartextjämförelse mot
  `signInWithEmailAndPassword(auth, usernameToEmail(uname), pw)`. Ingen förhandsläsning av
  `students` behövs (mappningen är ren strängbygge). Efter login: `auth.currentUser.uid == studentId`,
  läs `students/{uid}` för `namn`. "Kom ihåg mig" mappas till Firebase Auth persistence
  (`local` vs `session`).
- **Lärarens kontoskapande-UX:** i stort oförändrad tabellvy. Skapa elev = skapa Auth-användare.
  För att lärarens *egen* inloggning inte ska kastas ut när ett elevkonto skapas används en
  **sekundär Firebase-app-instans** (`initializeApp(config, "admin")`) i klienten för
  `createUserWithEmailAndPassword`. Därefter skrivs `students/{uid}`/`studentData/{uid}` som vanligt.
- **Lärar-identitet:** en riktig lärar-Auth-användare loggar in i lärarläget (ersätter det
  hårdkodade `larare2026`). Custom claim `teacher:true` sätts **en gång** via ett litet lokalt
  Admin-skript eller `gcloud`/konsolen – inget deployat i drift.
- **Migrering av befintliga elever:** engångs-**lokalt** Admin-skript (service-account, körs på
  utvecklarens dator): för varje `students/{id}` → `admin.auth().createUser({ uid: id, email:
  usernameToEmail(username), password })` med det *befintliga klartextlösenordet*, ta sedan bort
  `password`-fältet ur dokumentet. Eleverna behåller samma användarnamn/lösenord.
- **Påverkan på seed-skripten:** de kan inte längre skriva mot öppna regler. Innehålls-seed
  (`subjects`/`areas`) och elev-seed byggs om till **Admin SDK med service-account** (kringgår regler
  legitimt) i stället för REST + web-nyckel. `seed-party-pairs.mjs` och `audit-areas.mjs` (läser)
  följer samma väg. Alternativt: kör innehålls-seed som en inloggad lärare.
- **firestore.rules:** se §3.4.
- **Restrisk:** (1) Email/Password-provider påslagen gör att *vem som helst* kan skapa ett
  Auth-konto – men ett nytt konto utan `students`-dokument och utan `teacher`-claim kommer inte åt
  någon annans data, så det är ofarligt (kan strypas senare). (2) En elev kan fortfarande skriva sin
  *egen* `studentData` och därmed fuska till sig coins – acceptabelt i en lågrisk-skolapp
  (se Alt C för fix). (3) Syntetisk e-post kan inte återställas via mejl – lärare återställer i stället
  lösenord (kräver privilegierad väg; se restrisk-not).
- **Grov insats:** **medel.** Ingen Blaze/billing, inga deployade functions. Mest arbete: byta
  `login()`/lärarskapande till Auth, migrerings- och seed-skript, nya regler + test.

### 3.2 Alternativ B – Firebase Auth med syntetisk e-post, kontoskapande via **Cloud Function**

Som Alt A, men elevkonton skapas/hanteras genom en **callable Cloud Function** (Admin SDK) i stället
för den sekundära klient-appen.

- **Elevens login-UX:** oförändrad (identiskt med Alt A).
- **Lärarens kontoskapande-UX:** oförändrad tabellvy; "Spara alla" anropar
  `httpsCallable("upsertStudents")`. Funktionen verifierar att anroparen har `teacher`-claim, skapar
  Auth-användare och skriver dokumenten server-side.
- **Migrering:** engångsskript eller en tillfällig admin-funktion (Admin SDK), som i Alt A.
- **Seed:** Admin SDK, som i Alt A.
- **firestore.rules:** som §3.4, men `students`-skrivning kan låsas ännu hårdare (bara funktionens
  service-identitet), vilket stänger restrisk (1) i Alt A helt.
- **Fördel över A:** ingen Email/Password-självbetjäning öppen; all kontohantering går genom en
  kontrollerad, claim-verifierad server-endpoint; renare separation.
- **Nackdel:** kräver **Blaze-plan (billing)**, en deploy-pipeline för functions och `functions/`-kod.
- **Grov insats:** **medel–hög** (Alt A + functions-setup, deploy, callable-klientkod).

### 3.3 Alternativ C – Cloud Function-login → custom token *(mest kontroll)*

**Idé:** ingen syntetisk e-post – behåll `username` exakt som schema. Login POSTar
`{ username, password }` till en HTTPS/callable-funktion; funktionen slår upp eleven, verifierar mot
ett **hashat** lösenord (bcrypt/scrypt) i en **server-only** collection, och mintar en
`createCustomToken(uid, { student: true })`. Klienten kör `signInWithCustomToken`.

- **Elevens login-UX:** oförändrad.
- **Lärarens kontoskapande-UX:** oförändrad tabellvy; callable-funktion hashar och skriver.
- **Krav tekniskt:** Cloud Functions (Blaze), en hash-lib, en server-only collection för
  credentials (t.ex. `studentAuth/{uid}` som reglerna nekar all klientåtkomst till), samt
  custom-token-flödet. Fler rörliga delar än A/B.
- **Migrering:** hash-a befintliga klartextlösenord i ett engångsskript (eller "lazy rehash" vid
  första lyckade login). Klartextfältet tas bort.
- **Seed:** Admin SDK.
- **firestore.rules:** som §3.4 (custom claim `student`/`teacher`), plus `studentAuth/**`
  `allow read, write: if false` (bara Admin SDK rör den).
- **Fördel:** total kontroll, inget syntetiskt e-postschema, lätt att lägga på t.ex. inloggnings-
  spärr/rate-limit; coin-utdelning kan flyttas in i funktioner → eleven kan inte fuska.
- **Nackdel:** mest kod och drift att underhålla; overkill för behovet.
- **Grov insats:** **hög** (två+ funktioner, hash-hantering, custom-token-flöde, migrering).

### 3.4 Skiss – härdade `firestore.rules` (gäller Alt A/B/C)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function isTeacher() { return signedIn() && request.auth.token.teacher == true; }
    function isSelf(id)  { return signedIn() && request.auth.uid == id; }

    // Kunskapsinnehåll: alla inloggade läser; bara lärare skriver.
    match /subjects/{subjectId} {
      allow read:  if signedIn();
      allow write: if isTeacher();
      match /areas/{areaId} {
        allow read:  if signedIn();
        allow write: if isTeacher();
      }
    }

    // Elevkonton: eleven läser SITT eget, lärare läser/skriver alla.
    // Inga lösenord finns kvar här (de bor i Firebase Auth) → ingen world-read.
    match /students/{studentId} {
      allow read:  if isTeacher() || isSelf(studentId);
      allow write: if isTeacher();            // (Alt B/C: kan låsas till bara service-identitet)
    }

    // Elevdata: eleven äger sitt eget; lärare läser alla (klassöversikt) + skriver (ge coins).
    match /studentData/{studentId} {
      allow read:  if isTeacher() || isSelf(studentId);
      allow write: if isTeacher() || isSelf(studentId);   // Alt C kan flytta coin-skriv till function
    }

    // Klasser: alla inloggade läser (eleven behöver sin tilldelning); bara lärare skriver.
    match /classes/{classId} {
      allow read:  if signedIn();
      allow write: if isTeacher();
    }

    // Server-only credential-store (BARA Alt C).
    // match /studentAuth/{uid} { allow read, write: if false; }

    match /{document=**} { allow read, write: if false; }
  }
}
```
> **OBS – regler måste deployas separat:** en ändring i `firestore.rules` i repot räcker inte;
> reglerna aktiveras först vid `firebase deploy --only firestore:rules`. Annars ger de nya spärrarna
> "Missing or insufficient permissions" i drift medan repot ser "klart" ut. Deploya reglerna i
> **samma** steg som Auth-koden går live, annars slutar appen fungera.

---

## 4. Rekommendation

**Välj Alternativ A (Firebase Auth, syntetisk e-post, utan Cloud Functions).**

Motivering (enkelhet vs. säkerhet för en lågrisk-skolapp):
- **Löser den allvarligaste bristen helt:** inga klartext-lösenord någonstans, ingen world-readable
  lösenordslista – Google hashar och lagrar. Det är 90 % av säkerhetsvinsten.
- **Ger `request.auth`**, vilket är själva förutsättningen för meningsfulla Firestore-regler. Efter
  det stängs write-if-true och all vandalisering/radering i §2 punkt 3–4.
- **Uppfyller kravet på enkel onboarding:** både elevens login **och** lärarens bulk-skapande
  förblir i princip oförändrade (samma formulär, samma "Spara alla"-tabell) – Auth ligger bakom.
  Se §5 för det konkreta flödet. Viktigt för yngre elever och för läraren som ska mata in en hel klass.
- **Minsta driftbörda:** ingen Blaze-plan, inga deployade functions att övervaka/uppdatera. En
  skola vill inte drifta molnfunktioner. Custom claim + migrering är engångs-lokala skript.
- Restriskerna (öppen self-signup utan dataåtkomst; elev kan justera sin egen coins) är **låg** i den
  här kontexten och kan åtgärdas senare genom att lyfta in Alt B:s function eller Alt C:s
  coin-hantering – utan att bygga om grunden.

Gå till **Alt B** om/ när ni ändå tar in en Blaze-plan eller vill stänga self-signup helt. Ta **Alt C**
bara om ni behöver server-verifierad coin-ekonomi eller vill undvika det syntetiska e-postschemat –
troligen onödigt här.

---

## 5. Lågfriktions-onboarding – lärarens bulk-skapande & elevens login

Detta är kärnan i beställarens krav. Kort svar: **den valda lösningen (Alt A) behåller dagens
onboarding-UX i princip oförändrad** – Firebase Auth ligger *bakom* samma formulär och samma
"Spara alla"-tabell. Nedan det konkreta flödet plus två onboarding-modeller att välja mellan.

### 5.1 Konkret flöde (Alt A)

**Läraren skapar en hel klass (bulk):**
1. Lärare loggar in i lärarläget (en gång) → får `teacher`-claim.
2. Går till **Elevkonton** – *samma tabellvy som idag* (`teacher-students.js`): en rad per elev med
   namn, användarnamn (autogenereras från namnet), lösenord, avatar. "➕ 5 rader" / "Spara alla".
3. "Spara alla" loopar raderna och skapar för varje elev ett Firebase Auth-konto **via en sekundär
   Firebase-app-instans** (så lärarens egen session inte påverkas) + skriver `students/{uid}` och
   `studentData/{uid}`. Precis lika många klick som idag.
4. Läraren delar ut användarnamn + lösenord till eleverna (som idag; ev. utskriftsvänlig lista).

**Eleven loggar in:** *helt oförändrat.* Skriver användarnamn + lösenord i samma formulär.
Klienten mappar `username → username@elev.pluggportalen.local` och kör
`signInWithEmailAndPassword`. Ingen e-post, ingen länk, ingen extra ruta. "Kom ihåg mig" funkar
via Auth-persistence.

**Att reglerna tillåter flödet:** kontoskapandet sker med lärarens `teacher`-claim, och §3.4:s
regler ger `isTeacher()` full skrivrätt på `students`/`studentData`/`classes`/innehåll – alltså
inget som blockerar bulk-skapande. Elevens login kräver bara att Email/Password-providern är på;
inloggningen läser inte `students` i förväg, så den fungerar även när `students` inte längre är
world-readable.

### 5.2 Två onboarding-modeller (välj en)

**Modell 1 – Lärare sätter användarnamn + lösenord i bulk-tabellen (dagens flöde).** *Rekommenderas.*
- **För:** noll inlärning – identisk UX med idag; läraren styr lösenorden; funkar offline i huvudet
  ("alla får `passa123` first, byt sen"); minst kod (bara byta backend bakom "Spara alla").
- **Emot:** läraren måste hitta på lösenord (kan lösas med en "🎲 Generera"-knapp per rad som
  föreslår ett enkelt lösenord).

**Modell 2 – Systemgenererade engångskoder.**
- Läraren fyller bara i namn; systemet genererar användarnamn **och** en enkel kod (t.ex.
  `blå-katt-42`) per elev, visar en utskriftsvänlig klasslista. Eleven loggar in med koden; kan
  (frivilligt) byta lösenord vid första login.
- **För:** minst att fylla i för läraren; snygga, barnvänliga koder; inga återanvända lösenord.
- **Emot:** mer ny UI (kodgenerator, utskriftsvy, ev. "byt lösenord"-flöde) → större insats; koden
  måste ändå distribueras på papper.

**Rekommendation:** börja med **Modell 1** (den är i praktiken redan byggd – bara byt datalagret
bakom tabellen) och lägg ev. till Modell 2:s "🎲 Generera lösenord"-knapp som en liten
bekvämlighet. Modell 2:s fulla kodflöde är en trevlig men icke-nödvändig senare förbättring.

> **Not om "behåll enkel kod-inloggning men härda bara reglerna":** det låter frestande men är inte
> möjligt att göra säkert. Meningsfulla Firestore-regler kräver `request.auth`, som bara finns med
> riktig Auth. Den goda nyheten är att "den enkla koden" *blir* elevens Auth-lösenord i Alt A – vi
> behåller alltså den enkla kod-/lösenordskänslan, men nu backad av riktig auth. Man får inte det
> ena utan det andra.

---

## 6. Uppgiftsnedbrytning (issues lead kan skapa)

**Implementations-epic: "Härda auth & Firestore-regler (Alt A)"**

1. **Aktivera Firebase Auth (Email/Password) + lärar-identitet.** Slå på providern i konsolen; skapa
   ett lärarkonto; sätt custom claim `teacher:true` via ett litet lokalt Admin-skript (dokumentera i
   `docs/`). *Ingen app-kod.*
2. **`usernameToEmail()`-helper + Auth-init.** Lägg till `getAuth`/persistence i
   `src/firebase-config.js` och en delad `usernameToEmail(username)` (t.ex.
   `→ ${u}@elev.pluggportalen.local`). Enhetstesta mappningen.
3. **Bygg om elev-`login()`/`logout()`/session** i `src/data.js` till `signInWithEmailAndPassword` /
   `signOut`, härled `currentStudentId()` ur `auth.currentUser.uid`, mappa "kom ihåg mig" till Auth
   persistence. Behåll `pages-elev.js`-formuläret oförändrat.
4. **Ersätt lärarspärren** (`teacher-shared.js`): byt hårdkodat `larare2026` mot lärar-Auth-login;
   `isTeacher()` läser Auth-claim i stället för `sessionStorage`. Ta bort utskriften av lösenordet.
5. **Elevkonto-CRUD via sekundär Firebase-app** i `data-content.js`/`teacher-students.js`:
   `upsertStudent` skapar/uppdaterar Auth-användare (sekundär app-instans) + skriver `students`/
   `studentData` på `uid`; `deleteStudent` raderar även Auth-användaren; lösenordsåterställning för
   lärare. Ta bort `password` ur `students`-skrivningen.
6. **Migreringsskript (engångs, lokalt Admin SDK):** skapa Auth-användare för alla befintliga elever
   med `uid = befintligt doc-id` och nuvarande klartextlösenord; ta därefter bort `password`-fältet
   ur alla `students`-dokument. Torrkörnings-läge + tydlig logg. Kör mot live efter test.
7. **Nya `firestore.rules`** enligt §3.4 + regler-tester (emulator). **Deploya reglerna i samma steg
   som koden går live.**
8. **Bygg om seed-/verktygsskript** (`seed.mjs`, `seed-party-pairs.mjs`, `audit-areas.mjs`) till
   Admin SDK med service-account (ta bort beroendet av öppna regler + web-nyckel). Uppdatera
   `seed/seed.html`-vägen om den behålls.
9. **Sluttest E2E:** elev loggar in (oförändrad UX), ser bara egen data; lärare skapar/redigerar/ger
   coins/raderar; obehörig direktskrivning nekas; verifiera med Firestore-emulator + headless.
   *(Notera: README/testkontot elev1 – bekräfta faktiskt lösenord i live innan test.)*
10. **(Följd-issue, valfritt)** Lyft self-signup-strypning/coin-verifiering till Alt B/C om behovet
    växer.

---

## Bilaga – filreferenser

| Ämne | Fil(er) |
|---|---|
| Elev-login + session | `src/data.js` (`login`, `getSession`, `setSession`) |
| Login-formulär | `src/pages-elev.js` (`pageElevLogin`) |
| Firebase-init (publik config) | `src/firebase-config.js` |
| Lärarspärr (hårdkodat lösen) | `src/teacher-shared.js` (`TEACHER_PASSWORD`, `isTeacher`, `renderGate`) |
| Elev-/klass-CRUD | `src/data-content.js`, `src/teacher-students.js`, `src/teacher-class*.js`, `src/teacher-classes.js` |
| Innehålls-CRUD | `src/data-content.js`, `src/teacher-content.js` |
| Nuvarande regler (öppna) | `firestore.rules` |
| Hosting/regler-config | `firebase.json` |
| Seed / verktyg | `seed/seed.mjs`, `seed/seed-party-pairs.mjs`, `seed/audit-areas.mjs`, `seed/seed-data.js` |
| Cloud Functions | *finns inte idag (ingen `functions/`)* |
