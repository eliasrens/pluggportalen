# Testrapport – #231-kedjan (klass-projektion, O(1)-läsning i byn/grannbyn)

**Item:** #235 – QA + integrationsverifiering: läs-antal, self-heal, huslås, preview
**Feature-branch:** `epic/firestore-kvot-sluta-l-sa-ett-studentdat-65e2e1`
**Datum:** 2026-09-09

Verifierar hela #231-kedjan END-TO-END efter att skriv- (#233) och läs-itemet
(#234) landats på feature-branchen. Bakgrund: prod-incidenten 2026-09-09 där
by-/grannby-översikten läste ett `studentData`-dok **per elev** vid varje
öppning → N läsningar/klass → Firestore-kvoten sprack. Fix: en förberäknad
projektion i **ett** dokument per klass (`classProjections/{classId}`), keyad på
`members.<uid>`, som en `getDoc` hämtar hel = **1 läsning/klass oavsett antal
elever**.

---

## 1. Testsvit

Kört: `node --test 'test/*.test.js'`

| | Antal |
|---|---|
| **Tester totalt** | **232** |
| **Gröna** | **231** |
| Röda | 1 |
| Skipped | 0 |

Den enda röda är `test/firestore-rules.test.js` — **inte en kodregression**: den
kräver Firebase-emulatorn + dev-beroendet `@firebase/rules-unit-testing`, som
inte är installerat i denna sandlåda (inget `node_modules`). Den körs via
`npm run test:rules` (`firebase emulators:exec …`) i en miljö med emulatorn.
Alla rena, browser-fria enhetstester är gröna.

Nya i detta item: `test/integration-231.test.js` (5 tester, alla gröna) — se nedan.

---

## 2. Läs-antal per scenario (bevisat med siffror)

Bevisat av en **fejk-Firestore som räknar `getDoc`/`getDocs`** (samma mönster i
alla projektions-tester). Källa: `test/by-overview-reads.test.js`,
`test/class-projection.test.js`, `test/integration-231.test.js`.

| Scenario | Uppmätt | Krav | Test |
|---|---|---|---|
| **(a)** Öppna egna byn, projektion finns (1 klass) | **2 dok** (egna `studentData` färskt + 1 projektion) | ≤2 | `by-overview-reads`: "egna byn läser egna studentData + 1 projektion (=2)" |
| Egna byn, 2 klasser | 3 dok (egen `studentData` + 1/klass) | O(1)/klass | `by-overview-reads`: "flera klasser → O(1)/klass" |
| **(b)** Öppna en grannklass | **1 dok/klass** (0 `getDocs`), även vid 30 elever | 1/klass | `by-overview-reads`: "läs-antalet är O(1), inte O(elever)" |
| **(c)** Self-heal (projektion saknas) | Engångs per-elev (1 projektions-getDoc + 2/elev) **+ 1 setDoc en gång**, därefter **1 dok** | engång, sen 1 | `by-overview-reads` / `class-projection`: "self-healar EN gång, sen 1 dok" |

`getClassProjection` session-cachar dessutom inom en TTL (30 s), så
zooma-ut/-in läser inte om (`class-projection`: "cachar inom TTL").

---

## 3. Konsistens (mutation → projektion == färsk per-elev-läsning)

`test/integration-231.test.js` kopplar ihop **skriv-sidan**
(`mirrorStudentProjection` + `awardProjectionPatch`, som `game-shared.js`/
`data-room.js` anropar) med **läs-sidan** (`getClassOverview`) genom en gemensam
fejk-db och bevisar att översikten visar EXAKT det en färsk per-elev-läsning
(`projectionEntryFrom` över den skrivna `studentData`) skulle gett — efter:

- **awardExercise** → `stars`/`xp`/`completed` speglas rätt,
- **setAvatar** → `avatarId`,
- **saveAvatarItems** → `avatarItems`,
- **saveRoom(paletteId)** → `paletteId`,
- **saveHusSkal** → `husSkalId`.

Även award mot en klass **utan** projektion verifierat: mirror faller på
`updateDoc → not-found → setDoc merge`, `ensureClassProjection` self-healar
resten, siffrorna landar rätt.

Fält-drift-skyddet (`projection-sync.test.js`: "varje skriv-punkts patch-fält är
en giltig projektions-entry-nyckel") garanterar dessutom att ingen mutator kan
skriva ett fält som översikten inte läser.

**Bekräftad wiring i src** (läst, ej omskriven): alla mutationspunkter speglar —
`game-shared.js` (award), `data-room.js` (`saveAvatarItems`, `saveRoom`,
`saveHusSkal`, `setHusLast`, `setAvatar`), `data-content.js` (`upsertStudent`).
Speglingen är **aldrig kastande** — en misslyckad projektions-skrivning fäller
aldrig själva sparet (self-heal-läsaren täcker upp).

---

## 4. Huslås

- En elev med `husLast=true` ritas **låst (`locked=true`)** i by-/grannby-
  översikten, härlett ur `members.<uid>.husLast` via `entryToBoende` — **UTAN**
  en per-elev-läsning: uppmätt **0 `studentData`-getDoc** under render
  (`integration-231`: "setHusLast speglas → låst hus ritas locked, 0 per-elev-läsningar").
- `setHusLast` speglar `husLast` in i projektionen, så låset syns i byn direkt.
- **Inträde gate:as fortsatt:** by-vyns klick på ett låst hus visar en "🔒"-bubbla
  (`pages-varld.js`) i stället för att navigera in; `pages-klasskamrat.js` har
  dessutom ett andra försvarslager via den delade `isHouseLocked`-hjälparen +
  en `permission-denied`-fallback. By-vyns lås och rums-inträdes-gaten härleds
  ur **samma** `husLast`-fält, så de kan aldrig glida isär.

---

## 5. Regression

- **Rums-inträde `#/elev/kompis?id=<id>`** läser fortfarande **full**
  `studentData` (`data.getStudentData(otherId)` i `pages-klasskamrat.js`) — den
  gamla vägen är orörd. `test/integration-231.test.js` bevisar att
  översiktsformen (`projectionEntryFrom`) ur full `studentData` är oförändrad
  (avatar, klädsel, palett, hus-skal, stjärnor summerade per läge, `completed`).
- Quiz/läsförståelse/spel: inga projektions-relaterade ändringar; hela den rena
  testsviten (leveling, exercise-types, reading, sanningsjakt, adventure, m.fl.)
  är grön.

---

## Kvarvarande risker / påminnelser

> ⚠️ **(a) firestore.rules måste deployas separat av människan.** Regeln för
> `classProjections` (läs för klasskamrater, skriv bara egen entry) träder INTE
> i kraft förrän du kör:
> ```
> firebase deploy --only firestore:rules
> ```
> Utan deploy får den live-appen "Missing or insufficient permissions" på
> projektionsläsningen. `firestore-rules.test.js` (emulator) täcker regeln men
> kunde inte köras här (saknar emulator/`@firebase/rules-unit-testing`) — kör
> den lokalt med `npm run test:rules` innan deploy.

> ⚠️ **(b) INGEN merge till main utan användarens uttryckliga OK + preview-test.**
> Preview är igång (se nedan) så människan kan klicka runt i byn/grannbyn först.

- Emulator-testerna (`firestore-rules`, `e2e-auth`) kördes inte i sandlådan
  (inget `node_modules`/emulator). Bör köras i CI/lokalt före deploy.

---

## Preview

Dev-servern (`node server.mjs`) körs på port **8235** och är registrerad som
item-preview. Föreslagen klickrunda: logga in som elev → **Byn** (egna klassen)
→ zooma ut till **Skolan** → klicka en grannklass (**grannbyn**) → klicka ett
hus (läs-vy) → testa ett låst hus (🔒-bubbla).
