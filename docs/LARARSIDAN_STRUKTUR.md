# Lärarsidan – struktur och synlighet efter roll

Så är lärarsidan byggd efter omgörningen i epic #802 (Lärarsidan – enklare struktur; spec
[`UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md`](UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md)), ovanpå rollerna från epic #676
(Lärarkonton, #679). Funktionerna är **flyttade, inte ändrade**: behörigheten avgörs av Firestore-reglerna och Cloud
Functions (#678, [`BEHORIGHETER.md`](BEHORIGHETER.md)); gränssnittet döljer bara det kontot inte får använda.
Var varje enskild funktion hamnade står i [`LARARSIDAN_INVENTERING.md`](LARARSIDAN_INVENTERING.md); Hems läsningar i
[`LARARSIDAN_HEM_LASNINGAR.md`](LARARSIDAN_HEM_LASNINGAR.md).

## Toppmenyn och profilmenyn

Fem val för alla lärare och ett för admin (`TEACHER_GROUPS` och `TEACHER_TABS` i `src/teacher-shared.js`):

| Val | Adress | Innehåll | Admin | Årskurs |
| --- | --- | --- | --- | --- |
| **Hem** | `#/larare/hem` | Kom igång, Att göra, Snabbval, Mina klasser | ✓ | ✓ (Kom igång bara för årskurs) |
| **Mina klasser** | `#/larare/mina-klasser` | Klassväljare + fliken Hur går det? · Vad eleverna ser · Fokusläge · Elever | ✓ alla klasser | ✓ bara egna klasser |
| **Material** | `#/larare/material?flik=…` | Plugga-områden · Läsresan · Ekvationsresan · Bråkresan · Hitta rätt! · Schack | ✓ | ✓ utom Hitta rätt! |
| **Prov** | `#/larare/prov` | Mina prov (med Att rätta överst) · Provtillfällen | ✓ ändrar alla prov | ✓ ändrar bara egna, kopierar andras |
| **Live** | `#/larare/live` | Skapa Live-match, pågående matcher, historik · Mattematchen (admin) | ✓ | ✓ (Mattematchen dold) |
| **Admin** | `#/larare/admin` | Kort: Skapa klass · Döp om klass · Ta bort klass · Lärarkonton · Säsong · Hitta rätt! · Mattematchen | ✓ | dold helt |

- **Profilmenyn** (kontots namn ▾ längst till höger): "Inloggad som …", **Hjälp och guide** (`#/larare/hjalp`), för admin
  också Admin och sist **Logga ut**. På smala skärmar fäller ☰ ut samma val som toppmenyn.
- **Märket på Prov** ("Prov 18"): antalet inlämnade prov som väntar på rättning i lärarens klasser. Samma siffror står i
  rutan **Att rätta** överst på Prov → Mina prov och som rader under Att göra på Hem. Räknaren skrivs på provtillfället
  (`rattStatus`, `attRatta`) och räknas ned när man rättar och lämnar tillbaka – se `LARARSIDAN_HEM_LASNINGAR.md`.
- Inloggning landar på Hem (eller på den lärarsida man försökte öppna). Rubriken på varje sida visar sidans namn.
- En admin-sida som öppnas direkt av ett årskurskonto visar "Det här kan bara admin göra." Nekar servern något visas
  samma besked i stället för ett tekniskt fel (`errText` i `teacher-shared.js`).

## Hem (`src/teacher-hem.js`, #807)

Svarar på "vad behöver jag göra, och hur går det?":

- **Kom igång** (bara årskurslärare): fyra steg som bockas av automatiskt, "Gör det nu" per steg, Dölj sparas i `localStorage`.
- **Att göra**: prov att rätta (→ Rätta), öppna prov (→ Öppna), fokusläge på (→ Stäng av), Live som pågår (→ Öppna),
  elever som inte övat på två veckor (→ Visa). Annars "Inget att göra just nu".
- **Snabbval**: Välj områden åt en klass · Skapa nytt område · Skapa ett prov · Starta Live.
- **Mina klasser**: kompakta kort (elever, fokusläge, "Jobbar med …", "Övat den här veckan"); klick öppnar klassen. Admin kan
  dölja testklasser (sparas per lärare i `localStorage`).

## Mina klasser (`src/teacher-mina-klasser.js`, #804)

Överst klassväljaren (knappar; fler än 8 klasser → sökruta + rullgardin; 🔒 på klasser med fokusläge på), under den vald
klass med fyra flikar (`MINA_FLIKAR` i `src/teacher-mina-val.js`). Valet speglas i adressen
`#/larare/mina-klasser?klass=<id eller namn>&flik=hur|ser|fokus|elever[&del=<underflik>]`; klassen och statistikens underflik
ligger också i `localStorage` (`pp:larare:klass`, `pp:larare:statsflik`), så läraren kommer tillbaka till samma ställe.

| Flik | Innehåll | Sektioner (`CLASS_SECTIONS`) |
| --- | --- | --- |
| **Hur går det?** `flik=hur` | Underflikar: Ämnen · Per område · Läsresan · Ekvationsresan · Prov · Bråkresan · Mattematchen · Live · Schack. Läsresans och Ekvationsresans nivåer ändras här. Avstängda moduler visas nedtonade med länk till Vad eleverna ser. | `statistik` (`STATS_TABS`) |
| **Vad eleverna ser** `flik=ser` | Tre numrerade steg: 1. Områden (hela namn) · 2. Delar i elevernas meny (moduler på/av, byar för admin) · 3. Avancerat (ihopfällt: dölj övningslägen). "Sparat ✓" per steg. | `omraden`, `synlighet`, `lagen` |
| **Fokusläge** `flik=fokus` | Lås klassen till en sak till ett klockslag, +N min, Lås upp nu, vad eleven får göra efter inlämning. | `fokus` |
| **Elever** `flik=elever` | Den kompakta elevtabellen (se nedan). Admin får också Klasscentret under tabellen. | `inloggning` (årskurs), `elever` + `klasscenter` (admin) |

### Elever och menyn ⋯ (`src/teacher-elever-tabell.js`, #805)

En rad per elev: namn, användarnamn, lösenord (**Visa** hämtar just den elevens lösenord), senast inloggad och – bara admin –
mynt (**Visa**). Överst: sökfält, **Skriv ut inloggningskort** och för admin **Lägg till elev** och **Ge hela klassen mynt**.
Allt som ändrar något ligger i menyn ⋯ på raden och bekräftas i en ruta under raden (aldrig `confirm()`):

| Val i ⋯ | Årskurs | Admin |
| --- | --- | --- |
| Byt lösenord (Generera enkelt lösenord, Sätt nytt) | ✓ (användarnamnet låst) | ✓ (+ byt användarnamn) |
| Ge mynt, Ändra namn och avatar, Ta ur klassen, Ta bort konto | – | ✓ |

Valen byggs av `menyFor(admin)` i `src/teacher-elever-val.js`; reglerna spärrar dem ändå (test i
`test/lararsida-elever-admin.test.js` och `test/firestore-rules-roller-klasser-elever.test.js`).

## Admin (`src/teacher-admin.js`, #805)

En sida med kort (`ADMIN_KORT`); bara admin. Klassverktygen öppnas i en panel under korten (`?verktyg=skapa|dopom|tabort`),
de andra korten leder till sina sidor. Underraden under Admin: **Översikt** (korten) · **Lärarkonton** (`#/larare/konton`) ·
**Säsong** (`#/larare/admin/sasong`, Sommar/Höst och Halloween). Sidan läser inget när den öppnas; klasserna läses först när
ett klassverktyg öppnas. Skapa klass landar på klassens Elever med lösenorden kvar att skriva ut. Elever, mynt och
Klasscentret för en klass ligger i Mina klasser → Elever (inte på Admin). Det finns ingen "Klasser & elevkonton" längre.

## Material (`src/teacher-material.js`, #806)

`#/larare/material?flik=…`, flikarna står i `src/teacher-material-flikar.js` och laddas med `import()`:

| Flik | Innehåll | Admin | Årskurs |
| --- | --- | --- | --- |
| `plugga` Plugga-områden | Materialtabellen: ämnesflikar, Allt material / Mitt material, Skapa nytt område (guiden och AI-verkstaden), Använd, Duplicera, Redigera, Ta bort | ✓ | ✓ (ändrar bara eget) |
| `lasresan` Läsresan | Förklaring, nivåtabell och länk till nivåerna (Mina klasser → Hur går det? → Läsresan) | ✓ | ✓ |
| `ekvationsresan` Ekvationsresan | Testläge: spelvyn på vald nivå, inget sparas | ✓ | ✓ |
| `brakresan` Bråkresan | Testläge med facit, inget sparas | ✓ | ✓ |
| `hitta-ratt` Hitta rätt! | Kartområden och bilder (`?prov=` är kvar som helskärmsvy) | ✓ | dold |
| `schack` Schack | Prova mot datorn, inga mynt eller serveranrop | ✓ | ✓ |

## Prov och Live

- **Prov** (`#/larare/prov`, [`PROV.md`](PROV.md)): *Mina prov* med rutan **Att rätta** överst (visas bara när något väntar) och
  *Provtillfällen* (`#/larare/prov/tillfallen`). Översikt, rättning och utskrift för ett tillfälle har egna adresser
  (`#/larare/prov/tillfalle?t=`, `#/larare/prov/ratta?t=`).
- **Live** (`#/larare/live`): skapa lobby, belöningar, pågående matcher, projektorvy (`?id=`). **Mattematchen**
  (`#/larare/mattematchen`) är bara admin och nås från Live och från ett kort på Admin.

## Hjälp (`#808`)

- **Hjälptexter**: varje flik i Mina klasser (`hjalp` / `hjalpAdmin` i `MINA_FLIKAR`) och varje underflik i Material utom Plugga-områden (`hint` i
  `MATERIAL_FLIKAR`; utan `hint` ritas ingen ruta, #814) har en kort hjälptext (1–2 meningar) överst. Rutan ritas av `hjalpRuta` i `src/teacher-hjalptext.js`, kan
  fällas ihop och valet sparas per ruta i `localStorage` (`pp:larare:hjalp:<ruta>`, i `try/catch` – utan lagring är rutan öppen).
- **Hjälp och guide** (`#/larare/hjalp`, profilmenyn; `src/teacher-hjalp.js`): sju korta guider med 3–5 steg (Kom igång med en
  ny klass · Välj vad eleverna ser · Fokusläge · Skapa ett område med AI · Gör ett prov och rätta det · Starta Live · Ändra
  elevernas nivåer i Läsresan och Ekvationsresan). Guiderna är data i `src/teacher-hjalp-guider.js`; varje steg länkar direkt
  till rätt flik (`?flik=`, `&del=`), aldrig via en gammal adress. Steg för admin (`roll: "admin"`) visas bara för admin.
  Sidan gör inga läsningar.

## Gamla adresser

`TEACHER_REDIRECTS` i `src/teacher-shared.js` är EN karta; `router()` i `src/app.js` slår upp den (`location.replace`, så
bakåtknappen inte studsar). Parametrar följer med (`?prov=`, `?klass=` …); gamla `?sektion=` väljer rätt flik.

| Gammal | Ny |
| --- | --- |
| `#/larare`, `#/larare/oversikt` | `#/larare/hem` |
| `#/larare/klasser` | `#/larare/mina-klasser?flik=ser` |
| `#/larare/statistik`, `#/larare/klass` | `#/larare/mina-klasser?flik=hur` |
| `#/larare/elever` | `#/larare/mina-klasser?flik=elever` |
| `#/larare/admin/klasser` | `#/larare/admin`; med `?klass=` → `#/larare/mina-klasser?flik=elever` |
| `#/larare/innehall`, `#/larare/prompter` | `#/larare/material?flik=plugga` |
| `#/larare/brakresan` | `#/larare/material?flik=brakresan` |
| `#/larare/hitta-ratt` | `#/larare/material?flik=hitta-ratt` |

Nya länkar i koden ska peka på den nya adressen direkt (`test/lararsida-lankar.test.js`, `test/lararsida-hjalp.test.js`).

## Var ska en ny flik eller sektion placeras?

1. **Ny sida** → en rad i `TEACHER_TABS` (`group` = Hem, Mina klasser, Material, Prov, Live eller Admin; `admin: true` om bara admin).
   Ladda sidan med `import()` – aldrig statiskt i bootgrafen (#271).
2. **Ny flik i Mina klasser** → `MINA_FLIKAR` (med `hjalp`); **ny sektion** → `CLASS_SECTIONS`; **ny statistikflik** → `STATS_TABS`
   (blir en underflik i Hur går det?). **Ny Materialflik** → `MATERIAL_FLIKAR` (med `hint`).
3. **Placeringskartan** `PLACERING` i `src/teacher-struktur.js` ska ha en rad för den (roll, var den ligger, vilken del som flyttade
   den) och raden ska stå i [`LARARSIDAN_INVENTERING.md`](LARARSIDAN_INVENTERING.md). **Inventeringstestet**
   (`test/lararsida-inventering.test.js`) blir rött utan raden, om rollen inte stämmer med registryn eller om fliken inte går
   att nå i toppmenyn för sin roll.
4. Har det en egen adress som ersätter en gammal: lägg den gamla i `TEACHER_REDIRECTS`.
5. Behöver läraren en förklaring: skriv hjälptexten och, om det är ett återkommande arbetsflöde, ett steg i en guide. Testet
   `test/lararsida-hjalp.test.js` kräver att varje länk pekar på en riktig route, flik och underflik.
6. En ny Firestore-samling eller ändrad behörighet → uppdatera [`BEHORIGHETER.md`](BEHORIGHETER.md) (kontrolltestet kräver det).

## Synlighet för årskurskonton (§5.2 i spec för Lärarkonton)

- Klasslistor (Hem, Mina klasser, Hur går det?) filtreras på `teacherAccounts/{uid}.classIds` (eget dokument, 20 s cache så att
  admins ändringar slår igenom utan utloggning).
- Elever: bara Byt lösenord (användarnamnet låst) och Skriv ut inloggningskort. Namn, avatar, mynt, Ta ur klassen, Ta bort konto
  och Skapa/Lägg till elever döljs.
- Material: "Skapat av …" under namnet. Andras material kan man använda och duplicera; Ändra, Granska/underrader, Lägg till,
  Ämnestexter och Ta bort bara på eget. Material utan `createdBy` räknas som admins. "Nytt ämne" döljs.
- Läsresans pokalutdelning vid klassbyte körs bara för admin (pokaler = ekonomi).
- **Hitta rätt!** (egna kartområden), Mattematchen, Lärarkonton, Säsong och Klasscentret är bara admin (det strängaste valet där
  specen var otydlig). **Live-formuläret** visar alla klasser (motståndare får vara vilken klass som helst); reglerna kräver att
  minst en egen klass deltar.

## Ägarskap (#680)

`createdBy` / `createdByName` på området läses tåligt (`teacher-role-core.js`). `data.saveArea` stämplar ägaren för alla
skapa-flöden (guiden, AI-prompten, "mer innehåll", importen, ämnestexter): finns dokumentet behålls dess ägare (eller att den
saknas = admins), annars får det kontots uid och visningsnamn. `data.duplicateArea` kopierar allt innehåll till `<id>-kopia`
("… (kopia)"), sist i ordningen, ägd av den som duplicerar. Radering av konto (`deleteTeacher`, #677) tar bort ägarfälten, så
materialet blir admins.

## Tester och skärmdumpar

`test/lararsida-inventering.test.js` (placeringskartan, menyer per roll, omdirigeringar), `lararsida-lankar.test.js`,
`lararsida-mina-klasser*.test.js`, `lararsida-elever-admin.test.js`, `lararsida-material.test.js`, `lararsida-hem.test.js` och
`lararsida-hjalp.test.js`. Skärmdumpar: `docs/lararsidan-679/` (före omgörningen), `docs/skarmdumpar/lararsida-d/` (Material),
`docs/qa-lararsida-807/` (Hem) och `docs/skarmdumpar/lararsida-f/` (hjälptexter och guider, #808).
Preview med roller: `bash admin/qa-larkonton-roller-preview.sh` (qaadmin / qaarskurs4, lösenord lilla123, bara emulator).
