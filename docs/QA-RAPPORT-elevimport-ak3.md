# QA-rapport: elevimport åk 3 (#831)

Klasserna 3A–3D och 91 elevkonton är skapade i produktion (`pluggportalen-so-2026`)
med `admin/importera-elever.mjs`, 2026-11-09. Rapporten innehåller inga elevnamn,
användarnamn eller lösenord.

## 1. Vad en klass och ett elevkonto består av

Lärarsidan skapar allt i klienten (Admin SDK används inte, och ingen Cloud Function
är inblandad). `updateStudentLogin` används bara när läraren byter användarnamn eller
lösenord, inte när ett konto skapas.

**Klass, "Skapa klass"** (`teacher-classes-create.js` → `data.upsertClass`):

- `classes/{id}` = `{ name, order, createdAt, studentIds: [] }`.
- `id` = `slugify(namn)`, så "3A" blir `3a`.
- `order` = största befintliga `order` + 1, så klassen hamnar sist i listan.
- Inga inställningsfält skrivs. Saknat fält betyder standard (se §5).

**Elevkonto, "Lägg till elev"** (`data.upsertStudent(null, …)` + `data.setClassStudents`):

- **Firebase Auth-användare:** e-post `<användarnamn i gemener>@elev.pluggportalen.local`
  och lösenordet. Inget visningsnamn och inga custom claims (elever har inga claims).
- **`students/{uid}`:** `{ namn, username (gemener), avatarId: "fox", classIds: [klassId] }`.
- **`studentData/{uid}`:** standardvärden med 0 mynt, 0 XP, tomma samlingar, rävavatar och
  standardgård (`defaultStudentData`).
- **`studentCredentials/{uid}`:** `{ username, password, updatedAt }`. Bara lärare kan läsa
  den. Det är härifrån inloggningskorten tar lösenordet.
- **Klassens elevlista:** uid:t läggs i `classes/{id}.studentIds`.
- **Ingen klassprojektion:** `classProjections` skapas inte. Den fylls när eleverna börjar
  använda appen, precis som för handskapade konton.

**Användarnamn:**

- Användarnamnet sparas och loggar in med **gemener**. Inloggningen gör om det till
  gemener, så "Abc123" och "abc123" fungerar båda.
- Tillåtna tecken är `a–z 0–9 . _ -`, 3–40 tecken.
- Lösenordet måste vara 6–64 tecken.
- Lärarvyn och korten visar användarnamnet med gemener, som för alla konton.

## 2. Logik som bröts ut till en gemensam funktion

Formen på dokumenten finns nu på **ett** ställe, i `src/klass-membership.js` (ren modul,
inga Firebase-importer):

- `defaultStudentData`
- `newStudentDoc`
- `studentCredentialsDoc`
- `newClassDoc`
- `nextClassOrder`
- `normalizeUsername`
- `USERNAME_RE`
- `MIN_PASSWORD_LEN`

Klienten (`data.js`, `data-content.js`, `data-classes.js`, `teacher-classes-create.js`)
och importskriptet använder samma funktioner. Beteendet är oförändrat, vilket
emulatortest 2 visar: klientens riktiga kod körs där mot emulatorn och jämförs med
importen.

Funktionerna ligger i en befintlig modul i stället för en ny fil, så att bootgrafen
stannar på 107 filer (#271).

Importen lägger till ett fält utöver detta: `importBatch: "ak3-2026-11"` på
`students/{uid}` och på klasserna som importen skapade.

## 3. Produktionskörningen

**Torrkörningen före** visade:

- Fyra klasser att skapa och 91 elever att skapa.
- 0 krockar.
- Inga befintliga 3-klasser.
- Befintliga klasser: 4A–4D, 5A, 5B, 5D, 5E, Flex, Flexstudio, Studion, Testklass 1–2.
- 206 elever totalt i produktion.

**`--kor`:**

```
Klass  Skapad         Fanns redan  Fel
3A     21             0            0
3B     24             0            0
3C     23             0            0
3D     23             0            0
Totalt 91             0            0
```

Inga fel. Skapade klasser: 3A, 3B, 3C, 3D (`order` 14–17).

**Torrkörningen efteråt** visar 0 att skapa och 91 som redan finns, så en ny körning ändrar
ingenting.

## 4. Visningsnamn som ändrades

Två elever i **3C** har samma förnamn. De fick visningsnamnet **förnamn + mellanslag +
siffrorna i användarnamnet**, det andra särfallet i spec §0.2. Inga andra namn ändrades.
Elever med samma namn i olika klasser behåller sitt namn.

Elias kan byta namnen under Mina klasser → 3C → Elever → ⋯ → Namn.

## 5. Klassernas standardinställningar

Klasserna skapades exakt som med "Skapa klass", alltså utan inställningsfält. Det betyder:

- **Moduler:** standardmodulerna är på: Plugga, Läsresan, Butiken, Bråkresan, plus Prov och
  Mattematchen när de används. Hitta rätt!, Ekvationsresan och Schack är **av**, eftersom de
  är opt-in.
- **Områden:** ingen tilldelning, så eleverna ser hela biblioteket.
- **Läsresans startnivå:** inte satt, så standardnivå **4** (skala 1–10) gäller. För åk 3 kan
  en lägre startnivå (1–3) passa bättre. Ändra den under Mina klasser → klassen → Vad
  eleverna ser.
- **Fokusläge, dolda lägen och byar:** inget satt.
- **Klasscentret:** inget skapat. Det skapas vid första användningen, som för andra klasser.

## 6. Lärarkonton och årskurs 3

Inga lärarkonton skapades eller ändrades. Konton i produktion:

| Konto | Roll | Klasser |
|---|---|---|
| `teacher26` | admin | ser allt, även 3A–3D |
| `arskurs4` | årskurskonto | 4A–4D |
| `hawbir` | årskurskonto | 4A–4D |

Det finns **inget årskurskonto för åk 3**. Admin ser och hanterar redan 3A–3D.

Om en åk 3-lärare ska få ett eget konto: Admin → Lärarkonton → Nytt lärarkonto, roll
**Årskurskonto**, och kryssa i 3A, 3B, 3C och 3D. För ett befintligt konto: Redigera →
kryssa i klasserna.

## 7. Tester och kontroller

**Emulatortester, `npm run test:import`** (`test/importera-elever.test.mjs`, påhittade
elever): **15/15 gröna.** De täcker spec §5 test 1–14:

- 1: torrkörning
- 2: identiskt med "Lägg till elev", där klientens riktiga kod körs mot emulatorn
- 3, 7, 8: inloggning, inledande nollor, fyrsiffrigt användarnamn
- 4: omkörning
- 5: krock
- 6: dubblett
- 9: samma namn i samma klass
- 10: befintlig klass
- 11: fel mitt i körningen, och svarsfel efter landad skrivning
- 12: ångra
- 13: inga lösenord i utskrifterna
- 14: git-ignore

Testerna täcker också en elev utan inloggningskonto, en halv emulatormiljö och blanksteg
runt lösenordet.

**Test 15, befintliga sviter:**

| Svit | Resultat |
|---|---|
| Enhetstester | 4081/4081 |
| test:rules | 886/886 |
| test:functions | 441/441 (2 kända TODO) |
| test:e2e | 5/5 |
| Enhetstest `test/klass-membership-nytt-konto.test.js` | grönt |

**Riktiga filen mot emulatorn:** 91 skapade, 0 fel. Andra körningen gav 0 skapade och 91
som redan fanns. Inga lösenord fanns i någon utskrift.

**Kontroll i produktion (§6.5):**

- **Dokumenten:**
  - Alla 91 konton stämmer mot filen: Auth-e-post, `students`, `studentData` med 0 mynt,
    `studentCredentials` med rätt lösenord, och rätt klass.
  - Klasserna har 21, 24, 23 och 23 elever.
- **Inloggning:**
  - Testat på www.pluggporten.se som första eleven i varje klass och som de fyra särfallen
    i spec §6.5 (fyrsiffrigt namn, inledande nolla, rättat stavfel, en av de omdöpta i 3C).
  - Alla 8 kom in, landade på "Välj din figur" och loggades ut direkt.
  - Inget i elevkontona ändrades. `students`/`studentData` är oförändrade efter
    inloggningarna, och inga klassprojektionsposter skapades.
- **Lärarvyn och "Skriv ut inloggningskort":**
  - Produktionens lärarlösenord fanns inte, så detta kontrollerades mot emulatorn med samma
    import av samma fil.
  - Mina klasser visar 3A–3D med 21, 24, 23 och 23 elever.
  - Inloggningskorten gav 21, 24, 23 och 23 kort. Varje kort har användarnamn och lösenord
    som hör ihop.
  - **Elias bör titta på 3A–3D i produktionens lärarvy en gång.**

## 8. Elevdatan

- `admin/import/` är .gitignore:ad, och CSV-filen har aldrig committats.
- Filen är **raderad** ur arbetskatalogen efter kontrollen.
- Inga elevnamn, användarnamn eller lösenord finns i kod, tester, dokumentation eller
  commits. `git log -p` på grenens commits ger ingen träff på lösenordsprefixet.
- Originalet i `~/.barista/elevimport-ak3/` är orört. Leaden raderar det.

## 9. Ångra och förslag

**Ångra hela importen:**

```
node admin/importera-elever.mjs --angra --batch ak3-2026-11 --kor
```

Kräver `ja`. Kommandot tar bort:

- elevernas Auth-konto, `students`, `studentData` (med underkollektioner) och
  `studentCredentials`
- platsen i klasslistor och klassprojektioner
- Hitta rätt!-rader
- de fyra klasserna, om inga andra elever har lagts till i dem

Det är tänkt att köras snart efter importen. Data som eleverna skapar i till exempel Live
eller Prov städas inte, samma gräns som för `admin/delete-student.mjs`.

**Förslag:** en importvy under Admin, där man klistrar in en CSV, ser torrkörningen och
klickar Skapa. Den skulle kunna anropa samma kontroller via en Cloud Function, som
återanvänder `admin/importera-elever-core.mjs`.
