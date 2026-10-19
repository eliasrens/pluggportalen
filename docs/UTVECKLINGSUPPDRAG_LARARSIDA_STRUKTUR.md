# UTVECKLINGSUPPDRAG: LÄRARSIDAN – ENKLARE STRUKTUR FÖR NYA LÄRARE

**Uppdrag till AI-utvecklingsteamet**

Lärarsidan fungerar, men den är svår för nya lärare. Särskilt svår är den för årskurslärare som inte är admin, och de är de flesta. Problemen:

- **Klasserna finns på tre ställen.** Det som rör en klass ligger utspritt under Klasser, Statistik och Admin.
- **Översikten säger nästan ingenting**, eftersom den bara visar likadana klasskort.
- **Logga ut ligger på en egen rad** i toppmenyn.
- **Det är svårt att veta var Läsresan, Ekvationsresan, Bråkresan, Hitta rätt! och Schack hanteras.**

**Uppdraget är att göra om strukturen och navigeringen, inte komponenterna.**

- **Tabellerna och vyerna som finns i dag är bra och ska vara kvar som de är.** Det gäller statistiktabellen med staplar och stjärnor, materialtabellen, Live-sidan, provsidorna och nivåtabellerna för Läsresan och Ekvationsresan. De ska bara **flyttas** till rätt ställe i den nya strukturen.
- **Stilen är oförändrad:** mörkt tema, grön accent och linjeikoner.

Elias har godkänt strukturen i en klickbar förhandsvisning, `preview-lararsida-struktur.html` (bifogad). **Förhandsvisningen visar menyerna, flikarna, Hem-sidan och var allt ligger. Tabellerna i den ska inte kopieras**, eftersom de befintliga tabellerna är bättre.

**Detta är ett implementeringsuppdrag.** Gör det i PR:erna som listas i slutet.

---

# 0. LÄS FÖRST

- `src/teacher-shared.js`: `TEACHER_GROUPS`, `TEACHER_TABS`, `teacherNav()` och `teacherHead()`. Naven byggs från de här listorna, och `app.js` registrerar rutterna automatiskt.
- `src/teacher-classes-sections.js`: `CLASS_SECTIONS` och `CLASS_PAGE_MODES` (#679). Klassens sektioner fördelas här på sidorna Klasser, Statistik och Admin.
- `src/teacher-class.js`: `renderClassStats` och `STATS_TABS` (Ämnen, Per område, Läsresan, Ekvationsresan, Prov, Bråkresan, Mattematchen och Live).
- `src/teacher-overview.js`: dagens översikt.
- `src/teacher-classes.js`: `pageLarareKlasser`, `pageLarareStatistik` och `pageLarareAdminKlasser`.
- `src/teacher-role.js` och `src/teacher-role-core.js`: `myRole()`, `filterClasses()` och vad årskurskonton får göra. `docs/BEHORIGHETER.md`.
- `src/teacher-lasresan-niva.js` och `src/teacher-ekvationsresan-elev.js`: nivåerna per elev.
- Schacksektionen i `CLASS_SECTIONS` och `src/teacher-schack-ikon.js`.
- `docs/LARARSIDAN_STRUKTUR.md`: ska skrivas om när arbetet är klart.

**Regler:**

- **Bootgrafen (#271):** inga nya statiska importer i bootgrafen, och nya vyer laddas med `import()`.
- **Kvoten (#114/#231):** inga nya läsningar per elev. Hem-sidan får bara läsa sådant som redan läses billigt, alltså en läsning per klass och inte en per elev. Varje ny läsning ska redovisas i PR:en.
- **Behörigheterna ändras inte.** Det här gäller bara vad som **visas** var. Kontrollera ändå i varje PR att en årskurslärare aldrig ser admin-kontroller, och att reglerna fortfarande stoppar dem.
- **Gamla länkar** fortsätter att fungera genom omdirigering (se DEL 7).

## 0.1 Ingen funktion får försvinna

Det här är det viktigaste kravet i uppdraget. **Allt som går att göra på lärarsidan i dag ska gå att göra efteråt, med samma roller och lika många klick eller färre.**

1. **Inventera först.** Innan något flyttas, skapa `docs/LARARSIDAN_INVENTERING.md` med en tabell över **varje funktion som finns i dag**. Utgå från:
   - varje rad i `TEACHER_TABS`
   - varje sektion i `CLASS_SECTIONS`
   - varje flik i `STATS_TABS`
   - varje knapp och åtgärd på sidorna, till exempel Duplicera, Använd, Förhandsvisa, Lägg till innehåll, Skriv ut, Ge mynt, Döp om, Ta bort klass, Byt lösenord och Nollställ topplistan

   **Kolumnerna:**

   | Funktion | Var i dag | Vem (admin/årskurs) | Var efter omgörningen | Klick i dag → efter |
   | --- | --- | --- | --- | --- |

2. **Lägg tabellen i PR 1** så att Elias kan granska den innan något flyttas.
3. **Skriv ett test**, `test/lararsida-inventering.test.js`, som kontrollerar att varje flik i `TEACHER_TABS`, varje sektion i `CLASS_SECTIONS` och varje flik i `STATS_TABS` fortfarande går att nå i den nya strukturen för samma roller.
   - Lägger någon till en ny flik eller sektion i framtiden utan att placera den, ska testet gå rött.
4. **Om en funktion inte passar** i den nya strukturen: **ta inte bort den.** Lägg den där den passar bäst, och skriv det i rapporten.

---

# DEL 1 – TOPPMENYN

## 1.1 Fem huvudval

| Val | Innehåll |
| --- | --- |
| **Hem** | Den nya översikten (DEL 2) |
| **Mina klasser** | Allt om en klass (DEL 3) |
| **Material** | Innehållet: Plugga-områden och modulernas testlägen (DEL 4) |
| **Prov** | Som i dag, men med "Att rätta" överst (DEL 5) |
| **Live** | Som i dag, inklusive Mattematchen för admin |
| **Admin** | **Bara för admin** |

- **Statistik är inte längre ett eget val.** Statistiken ligger i klassen (DEL 3.2).
- **"Klasser"** byter namn till **"Mina klasser"**. För admin visar listan alla klasser, men testklasserna kan döljas (se 2.4).

## 1.2 Profilmenyn

- **Rutan "Inloggad som teacher26"** blir en knapp med kontots namn och en pil ▾.
- **Menyn innehåller:**
  - "Inloggad som …"
  - **Hjälp och guide** (DEL 8)
  - **Admin** (bara för admin, som ett alternativ till toppmenyn på smala skärmar)
  - **Logga ut**
- **Logga ut tas bort ur toppmenyn**, så att menyn får plats på en rad på en vanlig datorskärm.

## 1.3 Märket på Prov

Visa ett litet gult märke med **antalet prov som väntar på rättning**, till exempel "Prov 18".

- **Bara om det går billigt:** lägg in räknare på provtillfället (`inlamnade` och `rattade`) som uppdateras när rättningen sparas. Läs **inga** svar- eller rättningsdokument för att räkna fram siffran.
- **Annars:** visa inget märke, och skriv det i rapporten.

## 1.4 Mobil

På smala skärmar fälls toppmenyn ihop till en meny ☰ med samma val.

---

# DEL 2 – HEM

Hem-sidan ska svara på frågan **"vad behöver jag göra, och hur går det?"**. Följ förhandsvisningen.

## 2.1 Kom igång (bara för nya årskurslärare)

En ruta med fyra steg som bockas av automatiskt:

1. **Skriv ut inloggningskort till eleverna.** Räknas som klart när läraren har öppnat utskriften en gång. Spara det i `localStorage`.
2. **Välj vilka områden din klass ska jobba med.** Klart när minst en av lärarens klasser har tilldelade områden.
3. **Skapa eller kör ett prov.** Klart när läraren har ett eget prov.
4. **Testa Live med klassen.** Klart när läraren har startat en Live-match.

- **Varje steg** har en knapp "Gör det nu" som leder rätt.
- **Rutan kan döljas** med "Dölj", och valet sparas i `localStorage`. Den försvinner av sig själv när alla steg är klara.
- **Admin ser inte rutan.**

## 2.2 Att göra

En lista med **bara det som behöver göras just nu**. Varje rad har en knapp:

- **"18 prov att rätta"** med provets namn och klass, och knappen **Rätta**. Siffrorna kommer från räknarna i 1.3.
- **"Fokusläge är på i 4A"** med mål och sluttid, och knappen **Stäng av**. Det läses från klassdokumenten, som redan läses.
- **"Live-match pågår"** med knappen **Öppna** (om det gäller).
- **Elever som inte har varit aktiva på 14 dagar** ("3 elever i 4B har inte loggat in på 2 veckor") med knappen **Visa**. **Bara om det går billigt:** visas bara om det redan finns ett datum för senaste aktivitet i `classProjections` eller i något annat som läses med en läsning per klass. Annars hoppas raden över, och det redovisas.
  - **Om ni lägger till ett sådant fält:** högst **en skrivning per elev och dag**, och redovisa kostnaden.

**Finns inget att göra** visas "Inget att göra just nu 👍".

## 2.3 Snabbval

Fyra knappar:

- **Välj områden åt en klass** (till Mina klasser → Vad eleverna ser)
- **Skapa nytt område**
- **Skapa ett prov**
- **Starta Live**

## 2.4 Mina klasser

Kompakta kort, ett per klass som läraren har tillgång till.

- **Varje kort visar:** klassens namn, antal elever, om fokusläget är på och vilka områden klassen jobbar med (de tilldelade områdena).
- **Raden "Övat den här veckan: 18 av 23"** visas bara om den kan räknas fram utan läsningar per elev. Annars visas den inte.
- **Ett klick** på kortet öppnar klassen.
- **Admin** kan dölja klasser, till exempel testklasserna, med "Visa alla" och "Dölj den här". Valet sparas per lärare i `localStorage` eller i `teacherAccounts/{uid}`, och ni redovisar vilket.

---

# DEL 3 – MINA KLASSER

## 3.1 Klassväljaren och flikarna

- **Klassväljaren:** överst en rad med klasserna som knappar, i stället för dagens lista till vänster. Har läraren många klasser (fler än 8) blir det en sökbar rullgardinsmeny.
- **Den valda klassen kommer ihåg**, både i URL:en (`?klass=4B`) och i `localStorage`. Läraren kommer alltså tillbaka till samma klass när hen byter sida.
- **Under klassen finns fyra flikar.** Varje flik har en liten undertext som förklarar vad den gör:

| Flik | Undertext | Innehåll (befintliga sektioner) |
| --- | --- | --- |
| **Hur går det?** | Statistik | `renderClassStats` med alla `STATS_TABS` (se 3.2) |
| **Vad eleverna ser** | Områden och moduler | `omraden` + `synlighet` + `lagen` (se 3.3) |
| **Fokusläge** | Lås till en sak | `fokus` |
| **Elever** | Inloggning och konton | `inloggning`. För admin även `elever` och `klasscenter` (se 3.4) |

## 3.2 Hur går det?

- **Dagens statistik flyttas hit, oförändrad.** Det gäller underflikarna Ämnen, Per område, Läsresan, Ekvationsresan, Prov, Bråkresan, Mattematchen och Live, med **samma tabeller som i dag**.
- **Lägg till underfliken "Schack"** med det som i dag ligger i schacksektionen: topplistan, pågående partier, att avsluta ett parti och att nollställa. Lägg på samma sätt till **"Hitta rätt!"** om det finns statistik för den.
- **Varje del har sina klassinställningar här, bredvid statistiken.** Nivåerna per elev i Läsresan och Ekvationsresan ligger redan i dessa vyer och ska vara kvar där.
- **Avstängda delar:** om en modul är avstängd för klassen visas dess underflik nedtonad med "· av". Ett klick visar texten "Ekvationsresan är avstängd för 4B. Eleverna ser den inte. Slå på den under **Vad eleverna ser**", med en länk dit.
- **Underfliken som läraren senast valde kommer ihåg**, som i dag (`lastStatsTab`).

## 3.3 Vad eleverna ser

De tre befintliga sektionerna blir **en sida med numrerade steg**:

1. **"Vilka områden jobbar ni med nu?"**, alltså sektionen `omraden`.
   - **Hela områdesnamnen ska synas.** I dag kapas de ("Svensk His…"). Gör rutorna bredare eller låt namnen gå på två rader.
   - Behåll grupperingen per ämne.
   - Hjälptexten överst: "Kryssar du inte i några områden ser eleverna alla."
2. **"Vilka delar ska finnas i elevernas meny?"**, alltså sektionen `synlighet`, med modulerna som strömbrytare. Schacket slås också på här.
   - Under rubriken står: "Det du slår på här får sin statistik och sina inställningar under Hur går det?".
3. **"Avancerat: dölj vissa övningslägen i ett område"**, alltså sektionen `lagen`, **ihopfälld** som standard. Den behövs sällan.

**Sparningen fungerar som i dag.** Om sektionerna sparar var för sig får de göra det, men det ska vara tydligt för läraren vad som har sparats, till exempel med "Sparat ✓" vid varje steg.

## 3.4 Elever

- **För årskurslärare:** sektionen `inloggning` (användarnamn, lösenord och utskrift av inloggningskort), med samma funktioner som i dag.
- **För admin tillkommer:** det som i dag finns under Admin → Klasser & elevkonton → Elever (konton och mynt) och Klasscentret.
- **Kompakt tabell:** gör elevlistan till **en rad per elev** i stället för dagens höga kort. Kolumner:
  - namn
  - användarnamn
  - lösenord (Visa)
  - mynt (admin)
  - en meny **⋯**
- **Meny ⋯:** **Byt lösenord**, och för admin **Ge mynt**, **Ta ur klassen** och **Ta bort konto**.
  - Destruktiva val ligger alltid i menyn, aldrig framme på raden.
  - De bekräftas i en ruta på sidan.
- **Knappar för hela klassen överst:**
  - **Skriv ut inloggningskort**
  - **Ge hela klassen mynt** (admin)
  - **Lägg till elev** (admin)
- **Sökfält** för namn.

## 3.5 Admin-sidan

- **Kvar på Admin-sidan:** skapa klass, döp om klass, ta bort klass, Lärarkonton, Säsong, Hitta rätt! (adminverktyget för paket och bilder) och länken till Mattematchen.
- **Sida med kort:** Admin blir en sida med stora kort för varje verktyg.
- **Det som gäller en befintlig klass** (elever, mynt och Klasscentret) flyttas till klassens flik **Elever**.

---

# DEL 4 – MATERIAL

Material får underflikar, en per sorts innehåll:

| Flik | Innehåll |
| --- | --- |
| **Plugga-områden** | **Dagens materialtabell, oförändrad**, med ämnesflikar, filter och åtgärder |
| **Läsresan** | Bläddra bland texterna och frågorna per nivå, om det finns en lärarvy för det. Annars visas en förklaring och en länk till nivåerna under Mina klasser. |
| **Ekvationsresan** | Prova uppgifterna som lärare, om det finns ett testläge. |
| **Bråkresan** | Dagens testläge (`#/larare/brakresan`) |
| **Hitta rätt!** | Dagens lärarsida för Hitta rätt!. Den är bara admin i dag. Visa fliken för årskurslärare endast om de har något att göra där. Annars visas den bara för admin. |
| **Schack** | "Prova mot datorn": öppnar schackläget i testläge, om det finns. |

- **En flik utan innehåll** för lärarens roll visas inte.
- **Varje flik har en rad överst** som säger var klassinställningarna finns, till exempel: "Elevernas nivåer ändrar du under Mina klasser → Hur går det? → Läsresan."

**Materialtabellen:** inga ändringar i layouten. En liten förbättring är tillåten: ge ikonknapparna (redigera, förhandsvisa, lägg till och ta bort) en `title` och en `aria-label` med text, så att läraren ser vad de gör när hen håller muspekaren över dem.

---

# DEL 5 – PROV

- **Överst på "Mina prov"** en ruta **"Att rätta"** med de tillfällen som har orättade prov och knappen **Rätta**. Siffrorna kommer från räknarna i 1.3.
- **I övrigt** som i dag.

---

# DEL 6 – LIVE

Som i dag. Mattematchen ligger kvar under Live, och bara för admin.

---

# DEL 7 – GAMLA LÄNKAR

Omdirigera de gamla adresserna, så att bokmärken och länkar i dokumentation fortsätter att fungera:

| Gammal | Ny |
| --- | --- |
| `#/larare/oversikt` | Hem |
| `#/larare/klasser` | Mina klasser → Vad eleverna ser |
| `#/larare/statistik` | Mina klasser → Hur går det? |
| `#/larare/admin/klasser` | Admin, och för en vald klass Mina klasser → Elever |
| `#/larare/innehall` | Material → Plugga-områden |
| `#/larare/brakresan` | Material → Bråkresan |
| `#/larare/hitta-ratt` | Material → Hitta rätt! (`?prov=` fungerar som förut) |

---

# DEL 8 – HJÄLP

- **Hjälptexter:** varje flik i Mina klasser och varje underflik i Material får en **kort hjälptext** på en till två meningar överst, som i förhandsvisningen. Den ska kunna fällas ihop, och valet sparas i `localStorage`.
- **"Hjälp och guide"** i profilmenyn öppnar en enkel sida med korta guider:
  - Kom igång med en ny klass
  - Välj vad eleverna ser
  - Fokusläge
  - Skapa ett område med AI
  - Gör ett prov och rätta det
  - Starta Live
  - Ändra elevernas nivåer i Läsresan och Ekvationsresan

  Varje guide består av tre till fem steg med länkar direkt till rätt ställe.

---

# TESTER

- **Menyn för en årskurslärare:** exakt Hem, Mina klasser, Material, Prov och Live. Ingen Admin, och inga admin-kontroller någonstans, till exempel Ta bort konto, Ge mynt eller Skapa klass.
- **Menyn för admin:** samma val plus Admin.
- **Gamla länkar** i DEL 7 hamnar rätt.
- **Den valda klassen och statistikens underflik** kommer ihåg efter sidbyte och omladdning.
- **Avstängda moduler** visas nedtonade i "Hur går det?" med länk till "Vad eleverna ser".
- **Läsningar:** Hem-sidan gör högst en läsning per klass plus det som redan lästes i dag. Räkna och redovisa.
- **Räknarna** för prov att rätta stämmer efter att man rättat och lämnat tillbaka.
- **Hela områdesnamn** syns i "Vad eleverna ser".
- **Mobil:** toppmenyn fälls ihop, klassväljaren och flikarna fungerar.
- **Inventeringstestet** (0.1) är grönt, och varje funktion i `docs/LARARSIDAN_INVENTERING.md` har en plats efter omgörningen.
- **Alla befintliga tester** för statistik, Läsresan, Ekvationsresan, Schack och Prov är gröna.

---

# PR-ORDNING OCH RAPPORT

1. **Inventeringen** (0.1) och dess test, **toppmenyn och profilmenyn:** de fem huvudvalen, Logga ut i profilmenyn och omdirigeringarna. Mina klasser kan ännu använda dagens sida.
2. **Mina klasser:** klassväljaren, de fyra flikarna, statistiken som "Hur går det?" med schack och avstängda moduler, och "Vad eleverna ser" i tre steg.
3. **Elever och Admin:** den kompakta elevtabellen med menyn ⋯, adminfunktionerna flyttade till klassen och Admin-sidan med kort.
4. **Material:** underflikarna.
5. **Hem:** Kom igång, Att göra, Snabbval och Mina klasser, samt räknarna för prov och rutan "Att rätta" under Prov.
6. **Hjälp:** hjälptexterna och "Hjälp och guide". Skriv om `docs/LARARSIDAN_STRUKTUR.md`.

**Varje PR** ska ha skärmdumpar före och efter, både som årskurslärare och som admin.

**Avsluta med en rapport:**

- vad som har flyttats var
- vilka läsningar Hem-sidan gör
- om raderna "inte aktiv på 14 dagar" och "Övat den här veckan" kunde byggas billigt, och i så fall hur
- vad som behöver deployas

Alla befintliga tester ska vara gröna.
