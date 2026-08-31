# Pluggportalen 📚

En glad, barnvänlig studiesida för åk 4. Eleverna övar SO genom spel, samlar
**pluggcoins** och pyntar sitt eget rum. Läraren lägger in innehåll.

Sajten är en **statisk sida** (ren HTML/CSS/JS – inget byggsteg) som ligger på
**GitHub Pages** och använder **Firebase/Firestore** som databas via Firebase
JS SDK.

> **Testkonto:** användarnamn `elev1`, lösenord `passa123`.

## Innehåll

```
index.html              Startsida + hash-router (elev/lärare)
src/
  firebase-config.js    Firebase-init (publik webbconfig) → exporterar db
  data.js               Datamodulen – ALLA Firestore-anrop går här
  app.js                Router + sidor + gemensam layout
  styles.css            Gemensam barnvänlig design
seed/
  seed-data.js          Exempeldata (SO → Vikingatiden + exempelelev)
  seed.html             Seed:a databasen från webbläsaren
  seed.mjs              Seed:a databasen från terminalen (node)
docs/
  DATAMODELL.md         Dokumentation av Firestore-datamodellen
firestore.rules         Säkerhetsregler
firebase.json           Firebase-konfiguration
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

**Från webbläsaren:** öppna `seed/seed.html` och klicka på knappen.

**Från terminalen:**

```bash
node seed/seed.mjs
```

Båda skriver in ämnet **SO → Vikingatiden** (3 faktatexter, 5 quizfrågor,
6 fakta-par) och exempeleleven. Säkert att köra flera gånger.

## Firebase

- **Projekt:** `pluggportalen-so-2026` (Spark/gratisnivå)
- **Databas:** Cloud Firestore (region `eur3`)
- Webbconfigen i `src/firebase-config.js` är publik – det är så Firebase
  fungerar. Skyddet ligger i säkerhetsreglerna (`firestore.rules`).

Deploya om säkerhetsreglerna:

```bash
firebase deploy --only firestore:rules
```

## Datamodell

Se **[docs/DATAMODELL.md](docs/DATAMODELL.md)** för full dokumentation av
collections, fält och datamodulens API. Övriga delar av projektet
(gamemodes, shop, elevrum, lärarsida) bygger på den modellen och använder
`src/data.js`.
