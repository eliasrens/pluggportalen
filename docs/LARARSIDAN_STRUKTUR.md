# Lärarsidan – struktur och synlighet efter roll (#679)

Del D av epic Lärarkonton (spec `docs/UTVECKLINGSUPPDRAG_LARARKONTON.md` §5).
Funktionerna är **flyttade, inte ändrade**. Behörigheten avgörs av reglerna och
Cloud Functions (#678); gränssnittet döljer bara det kontot inte får använda.

## Före

Toppnav: Klasser & elever · Innehåll · Mattematchen · Live · Hitta rätt! · Lärarkonton (admin).
Klassvyn hade sektionerna Elever · Områden · Lägen per område · Synlighet (moduler + byar) ·
Fokusläge · Klasscentret · Statistik. Döp om, Ta bort och Skapa klass låg i samma vy.

## Efter

| Huvuddel | Underflikar / innehåll | Admin | Årskurs |
| --- | --- | --- | --- |
| **Översikt** `#/larare/oversikt` | Mina klasser (elevantal, fokusläge på/av, snabbval Fokusläge · Inloggning · Statistik), Pågående Live | ✓ | ✓ bara egna klasser och matcher där en egen klass deltar |
| **Klasser** `#/larare/klasser` | Områden · Lägen per område · Synlighet (moduler; byar bara admin) · Fokusläge · Inloggning (lösenord + inloggningskort) | ✓ | ✓ bara egna klasser |
| **Material** | Plugga-material `#/larare/innehall` (Allt material / Mitt material, "Skapat av …", Använd, Duplicera) · Bråkresan `#/larare/brakresan` (testläge, #716) · Hitta rätt! | ✓ | Plugga-material ✓, Bråkresan ✓, Hitta rätt! dold |
| **Live och tävlingar** | Live `#/larare/live` · Mattematchen | ✓ | Live ✓, Mattematchen dold |
| **Statistik** `#/larare/statistik` | Per klass: Ämnen · Per område · Läsresan · Ekvationsresan · Bråkresan (översikt, matris, rekommendationer, #716) · Mattematchen · Live (+ nivåstyrning) | ✓ | ✓ bara egna klasser |
| **Admin** | Klasser & elevkonton `#/larare/admin/klasser` (skapa/döp om/ta bort klass, elevkonton, mynt, Klasscentret) · Lärarkonton | ✓ | hela delen dold |

- Gamla länkar: `#/larare` → Översikt, `#/larare/klass` → Statistik, `#/larare/elever` → Klasser.
- Inloggning landar på Översikt (eller på den lärarsida man försökte öppna).
- Rubriken visar "Inloggad som …" (kontots `displayName`, annars Admin/Årskurskonto).
- En admin-route som öppnas direkt av ett årskurskonto visar "Det här kan bara admin göra."
  Nekar servern något visas samma besked i stället för ett tekniskt fel (`errText` i teacher-shared.js).

## Synlighet för årskurskonton (§5.2)

- Klasslistor (Översikt, Klasser, Statistik) filtreras på `teacherAccounts/{uid}.classIds`
  (eget dokument, 20 s cache så att admins ändringar slår igenom utan utloggning).
- Inloggning: bara knappen Inloggning (lösenord, användarnamnet låst) och Skriv ut inloggningskort.
  Namn, avatar, mynt, Ta ur klassen, Ta bort konto och Skapa/Lägg till elever döljs.
- Material: "Skapat av …" under namnet. Andras material visar **Använd** (→ Klasser › Områden)
  och **Duplicera**; Ändra, Granska/underrader, Lägg till, Ämnestexter och Ta bort bara på eget.
  Material utan `createdBy` räknas som admins. "Nytt ämne" döljs.
- Läsresans pokalutdelning vid klassbyte körs bara för admin (pokaler = ekonomi).

## Krokar för #680 (ägarskap)

- `createdBy` / `createdByName` på området läses tåligt (`teacher-role-core.js`).
- **Duplicera** visas när `data.duplicateArea(subjectId, areaId)` finns (exporteras via `data.js`);
  efter anropet laddas listan om. Utan den funktionen visas ingen Duplicera-knapp.
- **Byggt i #680:** `data.saveArea` stämplar ägaren för ALLA skapa-flöden (guiden, AI-prompten,
  "mer innehåll", importen, ämnestexter): finns dokumentet behålls dess `createdBy`/`createdByName`
  (eller att de saknas = admins), annars får det kontots uid och visningsnamn (`withOwner`).
  `data.duplicateArea` kopierar allt innehåll till `<id>-kopia` med namnet "… (kopia)", sist i
  ordningen, ägd av anroparen (`duplicateValue`). Radering av konto: `deleteTeacher` (#677) tar
  bort ägarfälten, så materialet blir admins.

## Oklart – valt det strängaste

- **Hitta rätt!** (egna kartområden) står inte i §2.1 → bara admin.
- **Klasscentret** (vem får inreda, insamling, historik) ligger under Admin; Klasscentrets
  statistik för årskurskonton finns alltså inte i lärarvyn än.
- **Live-formuläret** visar alla klasser (motståndare får vara vilken klass som helst, §2.1);
  reglerna kräver att minst en egen klass deltar.

## Skärmdumpar (test 28)

`docs/lararsidan-679/` – `admin-*` och `arskurs4-*` i 1366×768 och 1920×1080.
Preview: `bash admin/qa-larkonton-roller-preview.sh` (qaadmin / qaarskurs4, lösenord lilla123, bara emulator).
