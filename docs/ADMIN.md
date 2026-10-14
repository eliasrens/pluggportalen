# Admin & drift – auth-härdningen (Alt A)

Den här sidan beskriver de **lokala** verktygen som hör till säkerhetshärdningen
(se `docs/security-plan.md`): hur du aktiverar Firebase Auth, skapar ett
lärarkonto, migrerar de gamla klartextlösenorden till Auth, seedar data mot
stängda regler, och den **exakta ordningen** för att gå live utan att login
slutar fungera.

> Alla skript här körs **lokalt på din dator** med **Admin SDK** (ett hemligt
> service-account), aldrig i drift. De kringgår `firestore.rules` legitimt.

---

## 0. Förutsättningar (engångs)

1. **Node ≥ 18** och `npm install` i projektroten (installerar `firebase-admin`,
   `firebase`, `@firebase/rules-unit-testing` som devDependencies).
2. **Java 21+** (Firestore/Auth-emulatorn är en JVM-process). Kolla med
   `java -version`. Utan Java går emulator-testerna (`npm run test:rules`,
   `npm run test:e2e`) inte att köra.
3. **Firebase CLI** (`firebase --version`). Logga in: `firebase login`.
4. **Service-account-nyckel** (för att köra skripten mot LIVE):
   - Firebase Console → **Projektinställningar → Tjänstekonton** →
     **"Generera ny privat nyckel"**.
   - Spara som `admin/serviceAccountKey.json` (den är `.gitignore`:ad – checka
     **aldrig** in den). Alternativt: peka ut den med
     `GOOGLE_APPLICATION_CREDENTIALS=/väg/till/nyckel.json`.
   - **Utan nyckel (#677):** en `authorized_user`-JSON (ADC, t.ex. efter
     `gcloud auth application-default login`) fungerar också – via
     `GOOGLE_APPLICATION_CREDENTIALS` eller gcloud:s standardplats. Sätt gärna
     projektet explicit: `GOOGLE_CLOUD_PROJECT=<projekt-id>` (annars filens
     `quota_project_id`, annars `pluggportalen-so-2026`). Väljaren:
     `admin/credential.mjs`; skripten skriver ut vilken credential som används.

---

## 1. Aktivera Firebase Auth (KRÄVER människans konsol)

Detta kan **inte** göras programmatiskt utan konsol/inloggning:

1. Firebase Console → **Authentication** → **Get started** (om inte påslaget).
2. **Sign-in method** → aktivera providern **Email/Password**. (Lämna
   "Email link / passwordless" **av**.)

> Restrisk (dokumenterad i security-plan §3.1): med Email/Password på kan vem som
> helst självregistrera ett Auth-konto. Ett sådant konto utan `students`-dokument
> och utan `teacher`-claim kommer **inte** åt någon annans data (reglerna gatar på
> `isSelf`/`isTeacher`), så det är ofarligt i den här lågrisk-appen.

---

## 2. Lärarkonton: admin och årskurskonto (#677)

Två roller (spec `docs/UTVECKLINGSUPPDRAG_LARARKONTON.md` §1):

| Roll | Custom claims | `teacherAccounts/{uid}` |
| --- | --- | --- |
| Admin | `teacher: true`, `admin: true` | `role: "admin"`, `classIds: []` |
| Årskurskonto | `teacher: true`, `role: "arskurs"` | `role: "arskurs"`, `classIds: [...]` |

Vanligast: skapa och hantera konton på lärarsidan, fliken **Lärarkonton** (bara
admin). Den anropar Cloud Functions `adminCreateTeacher`, `adminUpdateTeacher`,
`adminSetTeacherPassword`, `adminSetTeacherActive` och `adminDeleteTeacher`
(`functions/teacher-accounts-core.js`).

### Migrering: alla befintliga lärare blir admin

```bash
node admin/migrate-teacher-admins.mjs           # torrkörning: skriver bara ut listan
node admin/migrate-teacher-admins.mjs --apply   # skriver + verifierar (✓ admin:true per konto)
```

Alla med `teacher: true` som inte är årskurskonton får `admin: true` och ett
`teacherAccounts`-dokument. Idempotent. Kör det **efter** `firebase deploy --only
functions` och **före** de nya Firestore-reglerna. Hela driftordningen står i
**§8** nedan.

### Reserv: skriptet `set-teacher-claim.mjs`

```bash
node admin/set-teacher-claim.mjs --username=teacher26 --password=<minst6>            # admin
node admin/set-teacher-claim.mjs --username=arskurs4 --role=arskurs \
     --name="Årskurs 4" --classes=4a,4b --password=<minst6>                          # årskurskonto
```

- Läraren loggar in med enbart ett **användarnamn** (t.ex. `teacher26`) – ingen
  e-post syns. Skriptet bygger internt e-posten
  `teacher26@larare.pluggportalen.local` (Firebase Auth kräver e-postformat).
- Skapar kontot om det inte finns, sätter claims och skriver `teacherAccounts`.
- Redan skapat konto? Kör utan `--password` för att bara sätta rollen.
- Ta bort lärarrollen: `--off` (claims och dokumentet tas bort).
- Avancerat: `--email=<riktig adress>` finns kvar för specialfall i stället för
  `--username`.

Läraren loggar sedan in i lärarläget (📚-sidan) med **användarnamn + lösenord**
(precis som eleverna). `isTeacher()`/`isAdmin()` i `src/auth.js` läser claimen ur
ID-token. **Obs:** efter att claims satts med skriptet måste läraren logga ut/in
en gång. Fliken Lärarkonton förnyar själv token, och ett årskurskontos klasser
läses ur dokumentet – de slår igenom direkt.

---

## 3. Migrera befintliga elevers lösenord → Auth

De gamla eleverna har **ännu inga Auth-konton** – deras lösenord ligger i klartext
i `students/{id}.password`. Migreringen skapar Auth-konton (uid = befintligt
doc-id, så kopplingen till `studentData` behålls) och tar sedan bort
`password`-fältet.

**Torrkörning först (default, skriver inget):**

```bash
node admin/migrate-passwords.mjs
```

**Skarpt (det avsedda kommandot – se beslutet om korta lösenord nedan):**

```bash
node admin/migrate-passwords.mjs --commit --short=set:<nytt-lösen>
```

### Korta lösenord (< 6 tecken) – VIKTIGT

Firebase Auth kräver **minst 6 tecken** i `createUser`. Testeleven **elev1** hade
ett lösenord under 6 tecken i live och kunde därför **inte** skapas på den
vanliga vägen. Välj strategi:

| Strategi | Flagga | Effekt |
|---|---|---|
| Stoppa (default) | `--short=stop` | Avbryter och listar berörda elever. |
| Behåll exakt lösenord | `--short=preserve` | Importerar via SCRYPT så det korta lösenordet fortsätter funka. Kräver `admin/firebase-hash-config.json` (se nedan) och **verifiering av en inloggning efteråt**. |
| Sätt nytt lösenord | `--short=set:<pw>` | Ger alla kort-lösenords-elever ett nytt gemensamt lösenord (≥ 6). Skriptet skriver ut listan så läraren kan meddela dem. |

**`--short=preserve` behöver projektets hash-parametrar.** Hämta dem i Console →
**Authentication → (⋮-menyn på Users-fliken) → "Password hash parameters"** och
lägg i `admin/firebase-hash-config.json` (också `.gitignore`:ad):

```json
{
  "signerKey": "<base64_signer_key>",
  "saltSeparator": "<base64_salt_separator>",
  "rounds": 8,
  "memCost": 14
}
```

> **BESLUT (beställaren):** använd **`--short=set:<nytt-lösen>`**. Elever med
> lösenord under 6 tecken (t.ex. **elev1**) får det nya lösenordet. Elever med
> ≥ 6 tecken behåller sitt. Meddela de berörda eleverna det nya lösenordet.
> Skriv **aldrig** in live-lösenord här – repot är publikt.
> (Alternativet `--short=preserve` – behåll exakt det korta lösenordet via
> SCRYPT – finns kvar i skriptet men används alltså inte här.)

---

## 4. Seeda / verktyg (Admin SDK)

Sedan reglerna är stängda funkar inte den gamla REST + webb-nyckel-vägen. Alla
seed-/verktygsskript går nu via Admin SDK:

```bash
node seed/seed.mjs              # exempelämne + exempelelev (skapar Auth-konto)
node seed/seed-party-pairs.mjs  # torrkörning; --write för att spara
node seed/audit-areas.mjs       # read-only granskning
```

**Engångs-backfill av klass-projektionens namn (#316).** En gammal partiell
skriv-väg kunde skapa `classProjections/{klass}.members[uid]`-poster UTAN `namn`,
så kartan/byn ritade en trasig platshållare (bekräftat i live: klass 4D, 10/22
poster). Klienten läker detta framåt, men befintliga glapp-poster fylls med:

```bash
node admin/backfill-projection-names.mjs           # TORRKÖRNING (visar plan)
node admin/backfill-projection-names.mjs --commit  # fyller saknat namn
```

Idempotent (bara namnlösa poster rörs, källa = `students/{uid}.namn`), säkert att
köra om. Kör helst mot emulatorn först (§5). Kräver ingen regel-deploy.

`seed/seed.html` (webbläsar-seedern) är **avstängd** – den kan inte skriva mot
stängda regler eller skapa Auth-konton.

---

## 5. Köra mot EMULATORN i stället för live

Testa allt riskfritt utan att röra live-data. Sätt emulator-env, så använder
skripten emulatorn (och behöver ingen service-account):

```bash
# starta emulatorerna i en terminal
npm run emulators

# i en annan terminal – peka skripten mot emulatorn
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
node seed/seed.mjs
node admin/migrate-passwords.mjs --commit
```

### Automatiska tester

```bash
npm run test:rules   # regel-tester mot Firestore-emulatorn (bevisar §3.4)
npm run test:e2e     # auth→regler→data end-to-end mot emulatorerna
npm --prefix functions install   # en gång (Cloud Functions-beroenden)
npm run test:functions           # updateStudentLogin + Guldrushen mot functions+auth+firestore
```

Båda startar/river emulatorerna själva via `firebase emulators:exec`. Kräver
**Java 21+**.

---

## 6. Lösenordsåterställning & radering (per elev)

**I lärarsidan (efter deploy av Cloud Functions):** Klasser & elever → klassen →
**Inloggning** på elevraden. Där ser läraren användarnamn + sparat lösenord
(`studentCredentials`), kan byta användarnamn och sätta nytt lösenord ("Generera
enkelt lösenord" = ord + 3 siffror). Bytet görs av Cloud Functionen
`updateStudentLogin` (europe-west1): Auth-e-post + lösenord, `students.username`,
klassprojektionerna och det sparade lösenordet – samma sak som gjordes för hand
för Omar i 4B (omar861 → omar851). **Skriv ut inloggningskort** (överst i
elevlistan) ger A4-kort, 8 per sida, med namn, användarnamn, lösenord (tom rad
om okänt) och **pluggporten.se**.

**Deploy (kräver Elias OK, Blaze-planen):**

```bash
npm --prefix functions install
firebase deploy --only functions,firestore:rules
```

Samma deploy tar med **Guldrushens** funktioner (`guldrushAnswer`,
`guldrushOpenChest`, `guldrushChooseVictim`, #563) – utan dem kan ingen elev
svara i en Guldrush-match. Predeploy-steget kopierar kistkonfigen
(`npm run sync:guldrush`) till `functions/guldrush/`.

Första gången aktiverar CLI:t Cloud Functions-, Cloud Build-, Artifact Registry-
och Cloud Run-API:erna (godkänn frågan, eller aktivera dem i Google Cloud
Console). Före deployen visar dialogen "Kunde inte nå inloggningstjänsten" och
nya konton får inget sparat lösenord (regeln saknas) – kontoskapandet fungerar
ändå.

**QA mot emulatorerna:** `bash admin/qa-inloggning-preview.sh` startar
functions+auth+firestore (5533/9533/8533), seedar `admin/qa-inloggning-seed.mjs`
(qalarare / lilla123 – endast emulator, klass 4B, två elever utan sparat lösenord) och kör
`admin/qa-emulator-proxy.mjs` på 8531 – proxyn routar `POST /updateStudentLogin`
till Functions-emulatorn.

**Lokalt (Admin SDK)** – klienten kan inte byta/radera **andras** Auth-konton:

```bash
node admin/reset-student-password.mjs --id=elev1 --password=<minst6>
node admin/reset-student-password.mjs --username=elev1 --password=<minst6>

node admin/delete-student.mjs --id=elev1            # torrkörning
node admin/delete-student.mjs --id=elev1 --commit   # raderar Auth + dokument
```

---

## 7. LIVE-gång – EXAKT ordning (annars slutar login funka)

Reglerna aktiveras **bara** av en separat deploy. Deployar man de stängda
reglerna *innan* eleverna fått Auth-konton kan ingen logga in. Rätt ordning:

1. **Aktivera Email/Password** i Console (steg 1) – gör detta först.
2. **Skapa lärarkonto + claim** (steg 2).
3. **Migrera** eleverna med det avsedda kommandot:
   ```bash
   node admin/migrate-passwords.mjs --commit --short=set:<nytt-lösen>
   ```
   Nu har alla Auth-konton och `password`-fälten är borta. Elever med lösenord
   under 6 tecken (t.ex. **elev1**) har fått det nya lösenordet – meddela dem.
4. **Deploya koden** (auth-lagret) till hosting – i samma veva som:
5. **Deploya reglerna:**
   ```bash
   firebase deploy --only firestore:rules
   ```
6. **Rök-test:** logga in som **elev1** (nytt lösenord efter
   migreringen, finns hos läraren; ser bara egen data) och som läraren (skapar/ger coins). Kolla att
   inga konsolfel syns.

> Steg 3 och 5 hör ihop: migrering **före** regel-deploy. Gör man tvärtom slutar
> befintliga elever kunna logga in tills migreringen är klar.

---

## 8. Lärarkonton – driftordning utan utelåsning (#681)

Gäller epicen Lärarkonton (spec `docs/UTVECKLINGSUPPDRAG_LARARKONTON.md` §6.2).
Vem som får vad står i `docs/BEHORIGHETER.md`, och vad varje roll ser på
lärarsidan i `docs/LARARSIDAN_STRUKTUR.md`. Följ stegen i ordning. Inget steg
låser ute en lärare så länge ordningen hålls: reglerna (steg 4) kommer först när
alla lärare har `admin: true`, och tills dess räknas en lärare utan roll som
admin (övergången, §8.2).

**Före start**

- Kör allt från en utcheckning av epic-grenen, som innehåller main och epicen.
  **Merga inte PR:en till main förrän steg 5.** GitHub Pages deployar main
  automatiskt, och klienten ska ut sist.
- Lokalt behövs Firebase CLI (`firebase login`), Node 22 och Java 21+.
  Projektet är `pluggportalen-so-2026`.
- Admin-skripten i steg 2–3 behöver en credential för Admin SDK
  (`admin/credential.mjs` väljer, §0 punkt 4). Utan service-account-nyckel går
  det med en `authorized_user`-JSON från gcloud. Sätt projektet explicit, så att
  skripten inte tar `quota_project_id` ur filen:
  ```bash
  gcloud auth application-default login
  export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/application_default_credentials.json"
  export GOOGLE_CLOUD_PROJECT=pluggportalen-so-2026
  ```
  Skripten skriver ut vilken credential och vilket mål (LIVE/EMULATOR) de
  använder. Kolla att det står LIVE och rätt projekt innan du kör `--apply`.
- Kolla att testerna är gröna (§5):
  ```bash
  npm run test:rules
  npm run test:functions
  node --test test/behorigheter-doc.test.js
  ```
- Valfritt: repetera steg 2–3 mot emulatorn först (§5,
  `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`).

### Steg 1: Cloud Functions

```bash
cd functions
npm install            # INTE npm ci – det finns ingen package-lock.json i functions/
cd ..
firebase deploy --only functions --project pluggportalen-so-2026
```

- Predeploy-stegen kopierar Guldrushens/Datakuppens och Hitta rätt!:s delade kod
  till `functions/` (se `firebase.json`).
- Nytt: `adminCreateTeacher`, `adminUpdateTeacher`, `adminSetTeacherPassword`,
  `adminSetTeacherActive` och `adminDeleteTeacher`. `updateStudentLogin` och
  Hitta rätt!-funktionerna kontrollerar nu rollen. Med övergången fungerar de
  som förut för alla befintliga lärare.
- Frågar CLI:t om att **radera** funktioner som inte finns i koden: svara **nej**
  och ta reda på varför (troligen en annan gren som inte är mergad). Använd inte
  `--force`.

### Steg 2: Migreringsskriptet – torrkörning, sedan `--apply`

```bash
node admin/migrate-teacher-admins.mjs           # torrkörning, skriver inget
```

Läs listan. Varje lärarkonto står med användarnamn, namn och uid. "blir admin" =
får `admin: true` och ett `teacherAccounts`-dokument. Kolla att alla som ska vara
lärare finns med och att inget okänt konto står där. Sedan:

```bash
node admin/migrate-teacher-admins.mjs --apply   # skriver och verifierar
```

Skriptet slutar med "✓ Klart" och en rad "✓ admin:true" per konto. Står det
"✗ SAKNAR admin": kör `--apply` igen och gå **inte** vidare till steg 4.

### Steg 3: Verifiera adminlistan

```bash
node admin/migrate-teacher-admins.mjs           # torrkörning igen
```

Godkänt när varje rad är "redan admin" (eller "hoppas över (årskurskonto)") och
skriptet säger **"0 konto(n) blir admin."** Kontrollera också att minst ett
adminkonto är ditt eget och att du kan logga in med det. Fliken
**Lärarkonton** på lärarsidan visar samma lista när klienten är ute (steg 5).

### Steg 4: Firestore-regler och index

```bash
firebase deploy --only firestore:rules,firestore:indexes --project pluggportalen-so-2026
```

Frågar CLI:t om att radera index som inte finns i `firestore.indexes.json`:
svara **nej**. Efter detta gäller rollerna på servern. Logga in som admin och
kolla att lärarsidan fungerar som förut (klasser, statistik, ge mynt).

### Steg 5: Webbplatsen

1. Merga epic-PR:en till main. GitHub Pages
   (https://www.pluggporten.se) deployar automatiskt via
   `.github/workflows/deploy.yml`. Vänta tills jobbet är grönt och sedan tio
   minuter till: Pages cachar filer i upp till tio minuter, så revertera inte
   på symptom inom den tiden.
2. Firebase Hosting (web.app) deployas för hand, från main:
   ```bash
   firebase deploy --only hosting --project pluggportalen-so-2026
   ```
3. Rök-test: logga in som admin (allt syns, fliken **Lärarkonton** finns),
   skapa ett årskurskonto där med en klass, logga in med det och kolla att bara
   den klassen syns. Logga in som en elev och kolla att inget ändrats.

### 8.1 Hur länge övergången behövs – och hur den tas bort

Övergången gör ett lärarkonto med `teacher: true` **utan** `role` och `admin`
till admin, så att en token från före migreringen inte låses ute. En ID-token
lever högst en timme. Övergången behövs alltså bara i **en timme efter steg 2**.
Ta bort den tidigast en timme efter steg 2, och när steg 3 visar
"0 konto(n) blir admin". Kör torrkörningen en gång till precis innan. Om ett
konto skapats sedan dess utan roll (det gör inget nuvarande verktyg) syns det där.

Ta bort övergången på en egen gren, i en egen PR:

1. `firestore.rules`: radera funktionen `isLegacyTeacher()` och
   `|| isLegacyTeacher()` i `isAdmin()`.
2. `functions/teacher-role.js`: radera raden med `!("role" in token) && !("admin" in token)`
   i `claimRole()`.
3. `src/auth.js`: `adminFromClaims` blir
   `c?.teacher === true && (c.admin === true || c.role === "admin")`.
4. Testerna: `test/firestore-rules-roller-overgang.test.js` test 25 ska nu
   **neka** `gammal()`. `test/functions-roller.test.mjs` (claimRole och
   "lärare utan roll") och `test/teacher-role.test.js` (adminFromClaims) ska
   ge "inte admin" för `{ teacher: true }`.
5. Deploya i samma ordning: `firebase deploy --only functions …`, sedan
   `firebase deploy --only firestore:rules …`, sist main/hosting.

### 8.2 Om någon blir utelåst

Allt nedan körs lokalt med Admin SDK och går förbi reglerna och appen. Det
fungerar alltså även om lärarsidan inte gör det.

- **En lärare får "saknar behörighet" efter steg 4.** Kör torrkörningen
  (`node admin/migrate-teacher-admins.mjs`). Står kontot som "blir admin": kör
  `--apply`. Eller gör kontot till admin direkt:
  `node admin/set-teacher-claim.mjs --username=<namn>`. Läraren loggar sedan ut
  och in en gång (ny token).
- **Det finns inget fungerande adminkonto.** Skapa ett nytt:
  `node admin/set-teacher-claim.mjs --username=<nytt-namn> --password=<minst6>`.
  Logga in med det och rätta resten i fliken **Lärarkonton**.
- **Ett adminkonto är avstängt.** Firebase Console → Authentication → kontot →
  ⋮ → **Enable account**. Kör sedan `node admin/set-teacher-claim.mjs --username=<namn>`
  så att `teacherAccounts.active` blir `true` igen. (Det sista aktiva adminkontot
  kan inte stängas av via appen, §7 test 23.)
- **Ett årskurskonto ser fel klasser eller inget alls.** Kolla dokumentet
  `teacherAccounts/{uid}`: `role: "arskurs"`, `active: true` och rätt `classIds`.
  Rätta i fliken Lärarkonton eller med
  `node admin/set-teacher-claim.mjs --username=<namn> --role=arskurs --classes=4a,4b`.
  Klassändringar gäller direkt, utan ny inloggning.
- **Nödläge: allt är låst och inget ovan hjälper.** Återställ förra reglerna:
  Firebase Console → Firestore → **Regler** → versionshistoriken → välj
  versionen före steg 4 → publicera. Det är säkrast, eftersom den versionen är
  exakt det som var live. Från git går också, med main före epicen
  (`origin/main` före steg 5, `origin/main^1` direkt efter mergen):
  ```bash
  git checkout origin/main -- firestore.rules
  firebase deploy --only firestore:rules --project pluggportalen-so-2026
  git checkout HEAD -- firestore.rules
  ```
  Med de gamla reglerna gör alla lärare allt som förut. Fliken Lärarkonton och
  årskurskontona fungerar däremot inte, eftersom de gamla reglerna inte känner
  till `teacherAccounts`. Hitta felet och gör sedan om steg 2–4.
