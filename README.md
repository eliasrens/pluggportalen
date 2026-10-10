# Pluggporten 📚

**Pluggporten** är en glad, spelifierad lärplattform för mellanstadiet
(åk 2–6). Eleverna övar i alla ämnen genom spel, tjänar **Pluggmynt** och
bygger sitt eget hus, rum och gård i klassens by. Läraren lägger in innehåll,
styr vad klassen ser och kör Live-matcher på projektorn.

Live: **<https://www.pluggporten.se>** (GitHub Pages).

Sajten är **statisk** (ren HTML/CSS/JS med ES-moduler – inget byggsteg) och
använder **Firebase** (Firestore, Auth och några Cloud Functions). Skyddet
ligger i säkerhetsreglerna (`firestore.rules`).

> **Testkonto:** testkontots uppgifter finns hos läraren – inga lösenord står
> i repot (repot och sajten är publika). Lärarkonton skapas med
> `node admin/set-teacher-claim.mjs` och elevlösenord byts med
> `node admin/reset-student-password.mjs` (se [`docs/ADMIN.md`](docs/ADMIN.md)).

## Moduler

| Modul | Vad | Kod |
| --- | --- | --- |
| **Plugga** | Ämnen → arbetsområden → spellägen: quiz, läsförståelse, kunskapsjakt, fånga sanningar, para ihop/memory, bildpar och räknegeneratorn (matte). Stjärnor per kategori | `src/games*.js`, `src/gamemodes.js`, `src/exercise-types.js`, `src/matte-generator/` |
| **Äventyren** | Egenritade äventyrsvärldar (Gruvan, Skattjakten, Spökjakten) med frågor ur området | `src/adventure/` |
| **Läsresan** | Läsförståelse i 10 nivåer längs en karta, lärarstyrd nivå | `src/lasresan/`, [`docs/LASRESAN.md`](docs/LASRESAN.md) |
| **Mattematchen** | Tävling över flera dagar: topplista + klasskamp | `src/tavling/` |
| **Live** | Realtidsmatcher på projektorn i tre format: 🏁 **Klassmatchen** (klass mot klass), ⚡ **Snilleblixten** (hela klassen, samma fråga) och 💰 **Guldrushen** (samla guld, öppna kistor). Svarssätt skriv själv eller flerval; Pluggmynt efter matchen | `src/live/`, [`docs/LIVE-FORMAT.md`](docs/LIVE-FORMAT.md) |
| **Klasscentret** | Klassens gemensamma byggnad: klass-EXP, crowdfunding, inredning, pokaler, klasskassa | `src/klasscenter/` |
| **Byn, huset och rummet** | Elevens hus i klassens by, rum att inreda, avatar, husdjur, butik och mysterylådor | `src/pages-varld.js`, `src/varld-*.js`, `src/pages-shop*.js`, `src/art-*.js` |
| **Gården** | Odling, bondgårdsdjur och ladugård | `src/varld-gard.js`, `src/farm-core.js`, `src/data-farm.js` |
| **Lärarsidan** | Klasser och elevkonton, innehållsstudion, synlighet per klass och område, klasslås, statistik | `src/teacher*.js` |

## Mappstruktur

```
index.html               Startsida + hash-router (elev/lärare)
src/
  app.js                 Router + gemensam layout (bootfil – se nedan)
  firebase-config.js     Firebase-init (publik webbconfig)
  data*.js               Datamodulen – Firestore-anropen
  auth.js                Inloggning (Firebase Auth)
  styles/                Gemensam design per område (01-grund … 27-larare-wizard)
  styles.css             GENERERAD av styles/ (npm run build:css) – redigera inte
  games.css              Spelens gemensamma design
  live/                  Live: kärnan, format/ (klassmatch, snilleblixt, guldrush), modes/
  klasscenter/           Klasscentret
  lasresan/              Läsresan
  tavling/               Mattematchen
  adventure/             Äventyrsmotorn + teman
  matte-generator/       Räknegeneratorns plugins
  mult/                  Multiplikationsgenerator + snabbsvarsfält
functions/               Cloud Functions (elevinloggning, Guldrushens server)
firestore.rules          Säkerhetsregler
firestore.indexes.json   Index
firebase.json            Firebase-konfiguration (inkl. emulatorer)
test/                    Enhets-, regel-, functions- och e2e-tester
seed/                    Exempeldata (Admin SDK)
admin/                   Drift- och QA-skript (konton, migreringar, emulator-seeds)
preview/                 Förhandsvisnings- och demosidor (t.ex. Live-demolägena)
docs/                    Dokumentation, specar, QA-rapporter, skärmdumpar (docs/screens/)
design/                  Designbeslut och prototyper
server.mjs               Liten statisk webbserver för lokal utveckling
.github/workflows/deploy.yml  Auto-deploy till GitHub Pages
```

> ⚠️ **Bootgrafen:** filer som `src/app.js` importerar statiskt laddas vid
> varje sidladdning. Nya moduler ska laddas med dynamisk `import()` – en ny
> fil i bootkedjan kan ge vit sida under GitHub Pages deploy-fönster.

> 🎨 **CSS:** ändra i `src/styles/NN-*.css` och kör `npm run build:css`.
> Sajten laddar fortfarande bara den sammanfogade `src/styles.css` (samma
> skäl som ovan – inga nya filer i boot). Nummerprefixet är laddningsordningen;
> flytta aldrig regler mellan filer utan att tänka på kaskaden. Testet
> `test/styles-delar.test.js` fäller en `styles.css` som inte är ombyggd.

## Köra lokalt

```bash
npm start            # node server.mjs → http://localhost:8000
```

Sajten måste serveras över http (ES-moduler fungerar inte från `file://`).
Utan emulatorer pratar den med det riktiga Firebase-projektet.
Förhandsvisningssidor: `http://localhost:8000/preview/…`.

## Tester

```bash
npm install                                  # engångs (devDependencies)
node --test $(ls test/*.test.* | grep -v -e firestore-rules -e functions- -e e2e)   # enhetstester, ingen emulator
npm run test:rules                           # firestore.rules mot Firestore-emulatorn
npm run test:functions                       # Cloud Functions mot emulatorerna
npm run test:e2e                             # auth → regler → data end-to-end
```

Emulatortesterna kräver **Java 21+** och `firebase-tools`;
`firebase emulators:exec` startar och river emulatorerna själv. En ny
regeltestfil måste läggas till i `test:rules` i `package.json`.

## Emulatorer och exempeldata

```bash
npm run emulators              # auth + firestore
npm run emulators:functions    # + functions (Guldrushen, elevinloggning)
node seed/seed.mjs             # exempeldata via Admin SDK (se docs/ADMIN.md)
```

QA-skript för emulatorn ligger i `admin/` (`qa-*-seed.mjs`,
`qa-emulator-proxy.mjs`, `qa-*-preview.sh`).

## Deploy

- **Sajten:** varje push till `main` publiceras automatiskt på GitHub Pages
  (`.github/workflows/deploy.yml`).
- **Regler, index och functions** aktiveras bara med `firebase deploy`
  (t.ex. `firebase deploy --only firestore:rules`) – en repo-ändring räcker
  inte. Ordning och detaljer: [`docs/ADMIN.md`](docs/ADMIN.md).
- Firebase-projekt: `pluggportalen-so-2026`. Webbconfigen i
  `src/firebase-config.js` är publik – det är så Firebase fungerar.

## Dokumentation

| Dokument | Innehåll |
| --- | --- |
| [`docs/DATAMODELL.md`](docs/DATAMODELL.md) | Alla Firestore-samlingar, fält, regler och bakåtkompatibilitet |
| [`docs/LIVE-FORMAT.md`](docs/LIVE-FORMAT.md) | Så lägger du till ett nytt Live-format |
| [`docs/ADMIN.md`](docs/ADMIN.md) | Drift: konton, migreringar, deploy-ordning |
| [`docs/DESIGNSYSTEM.md`](docs/DESIGNSYSTEM.md) | Färger, typografi, komponenter |
| [`docs/LASRESAN.md`](docs/LASRESAN.md) | Läsresan |
| [`docs/security-plan.md`](docs/security-plan.md) | Säkerhets- och auth-planen |
| `docs/spec-*.md`, `docs/QA-*.md` | Specar och QA-rapporter per funktion |
