# Pluggportalen 📚

En glad, barnvänlig studiesida för åk 4. Eleverna övar SO genom spel, samlar
**pluggcoins** och pyntar sitt eget rum. Läraren lägger in innehåll.

Sajten är en **statisk sida** (ren HTML/CSS/JS – inget byggsteg) som ligger på
**GitHub Pages** och använder **Firebase/Firestore** som databas via Firebase
JS SDK. Inloggning sker via **Firebase Auth** (se `docs/security-plan.md` och
`docs/ADMIN.md`).

> **Testkonto (live):** användarnamn `elev1`.
> **Före** lösenordsmigreringen (nuvarande live): lösenord `123`.
> **Efter** migreringen: lösenord `lilla123` (elev1 har < 6 tecken och får det
> nya lösenordet via `--short=set:lilla123`, se `docs/ADMIN.md`).
> (Läraren loggar in med sitt eget lärarkonto – **användarnamn** (t.ex.
> `teacher26`) + lösenord, precis som eleverna. Kontot skapas med
> `node admin/set-teacher-claim.mjs --username=teacher26 --password=<minst6>`.)

## Innehåll

```
index.html              Startsida + hash-router (elev/lärare)
src/
  firebase-config.js    Firebase-init (publik webbconfig) → exporterar db
  data.js               Datamodulen – ALLA Firestore-anrop går här
  app.js                Router + sidor + gemensam layout
  styles.css            Gemensam barnvänlig design
  auth.js               Firebase Auth: elev-/lärarinloggning + session
seed/
  seed-data.js          Exempeldata (SO → Vikingatiden + exempelelev)
  seed.mjs              Seed:a databasen från terminalen (node, Admin SDK)
  seed.html             (avstängd – webbläsar-seeding funkar ej mot stängda regler)
admin/
  set-teacher-claim.mjs Skapa lärarkonto + custom claim teacher:true
  migrate-passwords.mjs Engångs: klartextlösenord → Firebase Auth-konton
  reset-student-password.mjs / delete-student.mjs  Per-elev-underhåll
test/
  firestore-rules.test.js  Regel-tester (Firestore-emulator)
  e2e-auth.test.mjs        E2E auth→regler→data (emulator)
docs/
  DATAMODELL.md         Dokumentation av Firestore-datamodellen
  security-plan.md      Säkerhets-/auth-plan (Alt A)
  ADMIN.md              Drift: Auth-aktivering, migrering, live-deploy-ordning
firestore.rules         Säkerhetsregler (härdade – kräver inloggning)
firebase.json           Firebase-konfiguration (inkl. emulatorer)
.github/workflows/deploy.yml   Auto-deploy till GitHub Pages
```

## Hur läraren uppdaterar sidan

Sidan uppdateras automatiskt: **varje gång ändringar sparas (pushas) till
`main`-grenen på GitHub** bygger GitHub Pages om sidan (via
`.github/workflows/deploy.yml`). Det tar ungefär en minut.

Man kan också starta en deploy manuellt: gå till fliken **Actions** på GitHub,
välj **"Deploy till GitHub Pages"** och klicka **"Run workflow"**.

### Första gången: slå på GitHub Pages

1. Gå till repots **Settings → Pages**.
2. Under **Build and deployment → Source**, välj **GitHub Actions**.
3. Klart. Nästa push till `main` publicerar sidan.

## Köra lokalt

Eftersom sidan använder ES-moduler måste den serveras via en webbserver
(inte öppnas som `file://`):

```bash
npx serve .
# eller
python -m http.server 8000
```

Öppna sedan `http://localhost:8000`.

## Fylla databasen med exempeldata (seed)

Sedan säkerhetshärdningen är Firestore-reglerna **stängda**, så seeding går via
**Admin SDK** med ett service-account (webbläsar-seedern är avstängd). Se
`docs/ADMIN.md` för hur du hämtar nyckeln / kör mot emulatorn.

```bash
node seed/seed.mjs
```

Skriver in ämnet **SO → Vikingatiden** (3 faktatexter, 5 quizfrågor, 6 fakta-par)
och exempeleleven (och skapar elevens Auth-konto). Säkert att köra flera gånger.

## Tester

```bash
npm install          # engångs (devDependencies)
npm run test:rules   # firestore.rules mot Firestore-emulatorn
npm run test:e2e     # auth→regler→data end-to-end mot emulatorerna
```

Emulatorerna kräver **Java 21+**. `firebase emulators:exec` startar/river dem
automatiskt.

## Firebase

- **Projekt:** `pluggportalen-so-2026` (Spark/gratisnivå)
- **Databas:** Cloud Firestore (region `eur3`)
- Webbconfigen i `src/firebase-config.js` är publik – det är så Firebase
  fungerar. Skyddet ligger i säkerhetsreglerna (`firestore.rules`).

Deploya om säkerhetsreglerna (reglerna aktiveras **bara** av detta – en
repo-ändring räcker inte):

```bash
firebase deploy --only firestore:rules
```

> **Ordning vid live-gång:** kör lösenordsmigreringen **innan** reglerna
> deployas, annars slutar befintliga elever kunna logga in. Se den exakta
> sekvensen i **[docs/ADMIN.md](docs/ADMIN.md) §7**.

## Datamodell

Se **[docs/DATAMODELL.md](docs/DATAMODELL.md)** för full dokumentation av
collections, fält och datamodulens API. Övriga delar av projektet
(gamemodes, shop, elevrum, lärarsida) bygger på den modellen och använder
`src/data.js`.
