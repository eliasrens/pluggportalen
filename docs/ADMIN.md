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

## 2. Skapa lärarkonto + sätt `teacher`-claim

```bash
node admin/set-teacher-claim.mjs --username=teacher26 --password=<minst6>
```

- Läraren loggar in med enbart ett **användarnamn** (t.ex. `teacher26`) – ingen
  e-post syns. Skriptet bygger internt e-posten
  `teacher26@larare.pluggportalen.local` (Firebase Auth kräver e-postformat).
- Skapar kontot om det inte finns och sätter custom claim `teacher:true`.
- Redan skapat konto? Kör utan `--password` för att bara sätta claimen.
- Ta bort behörighet: `--off`.
- Avancerat: `--email=<riktig adress>` finns kvar för specialfall i stället för
  `--username`.

Läraren loggar sedan in i lärarläget (📚-sidan) med **användarnamn + lösenord**
(precis som eleverna). `isTeacher()` i `src/auth.js` läser claimen ur ID-token.
**Obs:** efter att claimen satts måste läraren logga ut/in en gång för att den
ska hamna i token.

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
node admin/migrate-passwords.mjs --commit --short=set:lilla123
```

### Korta lösenord (< 6 tecken) – VIKTIGT

Firebase Auth kräver **minst 6 tecken** i `createUser`. Testeleven **elev1** har
lösenordet **`123`** (3 tecken) i live och kan därför **inte** skapas på den
vanliga vägen. Välj strategi:

| Strategi | Flagga | Effekt |
|---|---|---|
| Stoppa (default) | `--short=stop` | Avbryter och listar berörda elever. |
| Behåll exakt lösenord | `--short=preserve` | Importerar via SCRYPT så `123` fortsätter funka. Kräver `admin/firebase-hash-config.json` (se nedan) och **verifiering av en inloggning efteråt**. |
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

> **BESLUT (beställaren):** använd **`--short=set:lilla123`**. Elever med lösenord
> under 6 tecken (t.ex. **elev1**) får det nya lösenordet **`lilla123`**. Elever
> med ≥ 6 tecken behåller sitt. Meddela de berörda eleverna det nya lösenordet.
> (Alternativet `--short=preserve` – behåll exakt `123` via SCRYPT – finns kvar i
> skriptet men används alltså inte här.)

---

## 4. Seeda / verktyg (Admin SDK)

Sedan reglerna är stängda funkar inte den gamla REST + webb-nyckel-vägen. Alla
seed-/verktygsskript går nu via Admin SDK:

```bash
node seed/seed.mjs              # exempelämne + exempelelev (skapar Auth-konto)
node seed/seed-party-pairs.mjs  # torrkörning; --write för att spara
node seed/audit-areas.mjs       # read-only granskning
```

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
```

Båda startar/river emulatorerna själva via `firebase emulators:exec`. Kräver
**Java 21+**.

---

## 6. Lösenordsåterställning & radering (per elev)

Klienten kan inte byta/radera **andras** Auth-konton, så det görs lokalt:

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
   node admin/migrate-passwords.mjs --commit --short=set:lilla123
   ```
   Nu har alla Auth-konton och `password`-fälten är borta. Elever med lösenord
   under 6 tecken (t.ex. **elev1**) har fått det nya lösenordet **`lilla123`** –
   meddela dem.
4. **Deploya koden** (auth-lagret) till hosting – i samma veva som:
5. **Deploya reglerna:**
   ```bash
   firebase deploy --only firestore:rules
   ```
6. **Rök-test:** logga in som **elev1 / lilla123** (nytt lösenord efter
   migreringen; ser bara egen data) och som läraren (skapar/ger coins). Kolla att
   inga konsolfel syns.

> Steg 3 och 5 hör ihop: migrering **före** regel-deploy. Gör man tvärtom slutar
> befintliga elever kunna logga in tills migreringen är klar.
