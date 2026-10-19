# Rapport: Lärarsidan – enklare struktur (epic #802)

Slutrapport enligt specens "PR-ORDNING OCH RAPPORT" ([`UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md`](UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md)).
Underlag: slut-QA #809 (2026-10-20) i en riktig webbläsare mot Firestore-emulatorn, som **årskurslärare (qaarskurs4) och admin
(qaadmin)**, på **desktop (1366 px) och mobil (375 px och 320 px)**, efter A–F (#803–#808) och main-mergen H (#812, #810 helskärmsläget).

**Slutsats:** hela TESTER-listan i specen är grön. Inga regressioner hittades i epicen. Två iakttagelser fanns redan på main
(se §7). Ingen funktion har försvunnit.

## 1. Vad som har flyttats var

Varje funktion finns i [`LARARSIDAN_INVENTERING.md`](LARARSIDAN_INVENTERING.md) (plats före/efter, roll, klick). Strukturen beskrivs i [`LARARSIDAN_STRUKTUR.md`](LARARSIDAN_STRUKTUR.md).

| Före (main) | Efter (epic #802) | Del |
| --- | --- | --- |
| Toppmeny Översikt · Klasser · Material · Prov · Live och tävlingar · Statistik · Admin + egen rad "Logga ut" | **Hem · Mina klasser · Material · Prov · Live** (+ **Admin** bara för admin). Logga ut, "Inloggad som …", Hjälp och guide (och Admin för admin) ligger i **profilmenyn** (namn ▾). Smal skärm: ☰ | A #803 |
| Översikt (likadana klasskort) | **Hem**: Kom igång (årskurs), Att göra, Snabbval, Mina klasser (kort med "Övat den här veckan", fokusläge, "Jobbar med") | E #807 |
| Klasser (lista till vänster + sektioner), Statistik (egen flik), Admin → Klasser & elevkonton | **Mina klasser**: klassväljare (knappar, >8 klasser = sök + rullgardin) och flikarna **Hur går det?** (all statistik + Schack som underflik, avstängda moduler "· av") · **Vad eleverna ser** (3 steg) · **Fokusläge** · **Elever** | B #804, C #805 |
| Elevkort (höga) under Admin → Klasser & elevkonton, Inloggning under Klasser | **Elever**: kompakt tabell, en rad per elev, menyn ⋯ (Byt lösenord; admin även Ändra namn och avatar, Ge mynt, Ta ur klassen, Ta bort konto) med bekräftelse i rutan på sidan. Knappar överst: Skriv ut inloggningskort, Ge hela klassen mynt (admin), Lägg till elev (admin). Klasscentret (admin) under tabellen | C #805 |
| Admin → Klasser & elevkonton (skapa/döp om/ta bort klass) | **Admin**: kort Skapa klass · Döp om klass · Ta bort klass · Lärarkonton · Säsong · Hitta rätt! · Mattematchen | C #805 |
| Material → Plugga-material · Bråkresan · Hitta rätt! | **Material**: Plugga-områden (tabellen oförändrad, ikonknappar har title + aria-label) · Läsresan · Ekvationsresan (testläge) · Bråkresan (testläge) · Hitta rätt! (admin) · Schack (prova mot datorn) | D #806 |
| Prov → Mina prov | Samma, med rutan **Att rätta** överst och **märket** på Prov ("Prov 5") | E #807 |
| – | Hjälptexter (hopfällbara) i varje flik i Mina klasser och Material, sidan **Hjälp och guide** (7 guider) | F #808 |

Gamla länkar (DEL 7) omdirigeras, se §5.

## 2. Vilka läsningar Hem gör – mätt mot emulatorn

Mätt i slut-QA med `admin/qa-lararsida-slut-preview.sh`. Proxyn räknar varje dokument som Firestore levererar (`QA_RAKNA`) och
varje Listen-mål. En fråga som ger 0 dokument debiteras som 1 läsning. Räknaren nollades före inloggningen, så siffrorna gäller
inloggning + första Hem-besöket. "Före" = origin/main (Översikt) mot samma emulator och samma konton.

| Konto | Före (main, Översikt) | Efter (Hem) | Nya läsningar |
| --- | --- | --- | --- |
| **Årskurs** (4A + 4B), första besöket | 15 (config 2 · classes 10 · teacherAccounts 1 · liveSessions 2) | **20** | **+6**: classProjections 2 (en per klass) · provTillfallen 2 frågor (att rätta + öppna prov) · prov 1 + liveSessions 1 (Kom igång steg 3/4, bara tills stegen är klara) |
| **Admin** (10 klasser) | 15 | **26** | **+12**: classProjections 10 (en per klass) · provTillfallen 2 frågor |
| Admin, nytt Hem-besök inom 30 s | – | **1** | bara frågan om öppna prov (projektionerna och klasserna är cachade 30 s, att rätta 5 min) |
| Admin, nytt besök efter > 30 s | – | 22 | classes 10 + konto 1 + 10 projektioner + 1 fråga |

**Hem läser alltså en gång per klass (classProjections), plus två frågor per lärare (högst 30 klasser per fråga) för provräknarna.**
Inga `students`, `studentData`, `svar` eller `rattning` läses. Varje fråga om tillfällen med `attRatta` läser ett dokument per
tillfälle som har prov att rätta, högst 50 per fråga. Detaljer och kostnadsresonemang: [`LARARSIDAN_HEM_LASNINGAR.md`](LARARSIDAN_HEM_LASNINGAR.md).
Siffrorna stämmer med E:s egen mätning (6 nya läsningar för årskurs första gången, 12 för admin med 10 klasser).

Med specens ord "högst en läsning per klass plus det som redan lästes" tillkommer två frågor per lärare. Det är räknarna i §1.3
(märket och Att rätta) och raden "Provet är öppet". Specen tillåter uttryckligen räknarna "om det går billigt". Frågorna är
oberoende av antalet elever.

## 3. "Inte aktiv på 14 dagar" och "Övat den här veckan" – byggdes billigt

Båda raderna finns. Varje elev i `classProjections/{klass}.members` har fått fältet **`members.<uid>.ovat`** = dagen eleven
senast fick en övning godkänd (`"YYYY-MM-DD"`).

- **Kostnad: 0 extra skrivningar.** Fältet följer med den projektionsskrivning som `awardExercise` redan gör efter varje övning.
  Specens gräns "högst en skrivning per elev och dag" hålls.
- **Läsning:** samma `classProjections/{klass}` som klasskortet läser, en per klass.
- **Verifierat i webbläsaren:** eleven Alva (4A) gjorde ett Quiz → projektionen fick `ovat`. Hems kort för 4A visade sedan
  "Övat den här veckan: 1 av 4". För 4B (sådd: en elev för 20 dagar sedan, en i dag, en utan datum) visade Att göra raden
  "2 elever i 4B har inte övat på 2 veckor – Ebba och Gry" med knappen **Visa** (→ Mina klasser → Elever).
- Raden säger "övat", inte "loggat in": inloggningar sparas inte någonstans billigt. "Övat" räknar övningar via
  `awardExercise` (Plugga, äventyr, Tidsjakten, Räkna), inte Läsresan, Ekvationsresan, Bråkresan, Prov eller Live.
- Raderna syns först när klassens projektion har datum, alltså efter deployen och första övningen.

## 4. Räknarna för prov att rätta – verifierat genom hela flödet

Flödet kördes i webbläsaren med riktiga elevinloggningar (4A, prov med 4 frågor, helskärm på). Efter varje steg lästes
`provTillfallen/{t}`:

| Steg | rattStatus (antal/rättade/tillbaka) · attRatta | Märket / Hem |
| --- | --- | --- |
| Öppna provet, Alva + Bilal lämnar in, Dante går ur helskärm → **pausad** | – (inga räknare) | Hem: "Provet är öppet i 4A" (beslut, se §6) |
| Läraren **Släpp in** → Dante fortsätter och lämnar in | – (oförändrat, rätt) | – |
| **Stäng** | 3/0/0 · true | "Prov 3", Hem "3 prov att rätta", Mina prov → Att rätta "3 inlämnade · 0 rättade" |
| **Rätta alla automatiska frågor** (fritext kvar) | 3/0/0 · true | oförändrat (rätt: fritexten väntar) |
| Rätta fritexten för Alva och Bilal | 3/2/0 · true | – |
| **Lämna tillbaka** till alla rättade | 3/2/2 · true | "Prov 1" efter sidbyte |
| **Öppna igen**, Cleo skriver och lämnar in | 3/2/2 (de som lämnat in räknas inte om) | Hem: "1 prov att rätta" + "Provet är öppet i 4A" |
| **Stäng** igen | 4/2/2 · true | "Prov 2" |
| Rätta alla + fritext för Dante och Cleo | 4/4/2 · **false** | märket borta, Att göra och Att rätta tomma |

**Engångsskriptet** `admin/backfill-att-ratta.mjs` kördes mot emulatorn med två gamla tillfällen, ett stängt utan räkneverk och
ett med räkneverk men utan flagga. Torrkörningen visade planen och skrev inget. `--commit` skrev 2 tillfällen (count-fråga på
svaren gav antal 2). En tredje körning skrev 0 (idempotent). Admin såg sedan "Prov 5" och två rader i Att göra. Årskurskontots
märke uppdaterades först när cachen på 5 minuter gick ut, eller vid omladdning. Det är som avsett.

## 5. Övrigt som verifierades i webbläsaren

- **Meny årskurs:** exakt Hem, Mina klasser, Material, Prov, Live. Profilmenyn: Inloggad som Årskurs 4 · Hjälp och guide · Logga ut.
  Inga adminkontroller på någon av 21 lärarsidor (Ta bort konto, Ge mynt, Skapa klass, Lägg till elev, Ta bort klass, Döp om klass,
  Ta ur klassen, Lärarkonton, Säsong, Nytt ämne …). Raden "Mattematchen" i Hur går det? och i Fokuslägets mållista är statistik
  och lås, som förut, inte adminverktyg. Admin, Lärarkonton, Säsong, Mattematchen och Material → Hitta rätt! visar
  "Det här kan bara admin göra.". Elevtabellens ⋯ innehåller bara Byt lösenord (användarnamnet är låst). **Reglerna stoppar**
  `addCoins`, `deleteClass` och `deleteStudent` från årskurskontots webbläsare (permission-denied).
- **Meny admin:** samma val + Admin. Profilmenyn: … · Hjälp och guide · Admin · Logga ut. Logga ut → startsidan. En skyddad adress
  öppnar inloggningen, och efter inloggningen landar man på adressen.
- **Gamla länkar (DEL 7):** `#/larare`, `/oversikt` → Hem · `/klasser` → Vad eleverna ser · `/statistik`, `/klass` → Hur går det? ·
  `/elever` → Elever · `/admin/klasser` → Admin, med `?klass=4b` → Mina klasser → Elever för 4B · `/innehall`, `/prompter` →
  Plugga-områden · `/brakresan` → Bråkresan · `/hitta-ratt` → Hitta rätt! · `/hitta-ratt?prov=sverige-stader` → provspelet i
  helskärm (admin). Gamla `?sektion=fokus` och `?sektion=inloggning` väljer rätt flik.
- **Kommer ihåg:** vald klass och statistikens underflik är kvar efter sidbyte och efter omladdning (`?klass=4b&flik=hur&del=lasresan`).
- **Avstängda moduler:** 4B visar "Ekvationsresan · av" och "Bråkresan · av", 4A "Schack · av". Ett klick visar "Schack är avstängd
  för 4A. Eleverna ser den inte. Slå på den under **Vad eleverna ser**". Länken leder till fliken.
- **Hela områdesnamn** i Vad eleverna ser ("Svensk historia under stormaktstiden", "Skiljetecken, vokaler och dubbelteckning") bryts
  på två rader och kapas inte (desktop, 375 och 320 px). Steg 3 är ihopfällt. "Sparat ✓" visas efter Spara områden.
- **Mobil:** ☰ fäller ut samma val, inklusive märket, och stänger sig vid val. Klassknapparna och flikarna fungerar. Ingen
  horisontell sidrullning på 375 och 320 px på Hem, Mina klasser (alla flikar), Material, Live, Hjälp och Admin (undantag: §7).
- **Stickprov på knappar:** Duplicera (→ `vikingatiden-kopia`, ägd av Årskurs 4) · Använd (→ Vad eleverna ser) · Kör i klass /
  Öppna nu / Stäng / Öppna igen / Rätta / Rätta alla / Lämna tillbaka / Släpp in (#810) · Skriv ut inloggningskort (Kom igång steg 1
  bockas av) · Visa lösenord · Byt lösenord (dialogen når Cloud Functions; i riggen körs inga functions, så meddelandet "Kunde inte
  nå inloggningstjänsten" kom som väntat) · Ge mynt (+10, nytt saldo visas) · Ge hela klassen mynt / Lägg till elev (panelerna) ·
  Ta ur klassen / Ta bort konto / Ändra namn och avatar (bekräftelse i rutan, avbrutet) · Döp om klass (sparat) · Ta bort klass
  (bekräftelse → borttagen) · Skapa klass med 2 elever (→ Mina klasser → Elever) · Nollställ topplistan (finns i Hur går det? →
  Schack) · Hitta rätt! Provspela · Fokusläge Lås klassen → Hem "Fokusläge är på i 4B" → **Stäng av** · Skapa lobby (Kom igång
  steg 4, rutan försvann när alla steg var klara) · Admin Dölj den här / Visa alla / Visa igen.
- **Hjälp:** hjälprutan finns i varje flik. Ihopfälld ruta förblir ihopfälld efter omladdning (`pp:larare:hjalp:mina-hur`), och en
  annan flik har sin egen ruta. Hjälp och guide visar de 7 guiderna.
- Inga fel eller varningar i konsolen på lärarsidorna under hela körningen.

## 6. Avvikelser från specen och kända punkter (verifierade)

- **Klick:** Byt lösenord 4 → 5 och Ge mynt 3 → 5, eftersom specen §3.4 lägger valen i menyn ⋯ med bekräftelse (inventeringen §3.1).
  Från Hem är Fokusläge och Inloggning ett klick längre bort än från Översiktens snabbknappar, men att stänga av fokusläget går
  direkt i Att göra (inventeringen §12). Skapa/döp om/ta bort klass: Admin → kort (1 → 2 till verktyget).
- **Ingen Hitta rätt!-underflik i Hur går det?**, eftersom det inte finns någon klasstatistik för Hitta rätt!. Verifierat: underflikarna är Ämnen, Per område,
  Läsresan, Ekvationsresan, Prov, Bråkresan, Mattematchen, Live och Schack.
- **Elevinlämning på ett ÖPPET prov ändrar inte räknarna** (beslut, #807). Verifierat: Hem visar "Provet är öppet i 4A", och
  räknarna uppdateras vid Stäng.
- **E F5 (kosmetisk):** efter admins "Dölj den här" på Hem står märket kvar ("Prov 5") tills man byter sida. Verifierat: efter
  sidbytet visar det rätt. Samma sak efter rättning: märket i toppmenyn uppdateras vid nästa sidbyte.
- **Stubbade lärar-previews** (`preview/*`) laddar riktiga `prov-att-ratta.js`, som gör en utloggad Listen mot prod (400, skriver inget).
  Detta berör inte riggen mot emulatorn.
- **Läsresan** har ingen lärarvy för texterna. Material → Läsresan är därför en förklaring och en länk till nivåerna (D).
- **Dolda klasser** sparas i `localStorage`, inte i `teacherAccounts`, och följer därför inte med till en annan dator (E).

## 7. Iakttagelser i slut-QA (fanns redan på main, inte i epicen)

1. **Prov → Mina prov rullar i sidled på smal skärm:** 353 px bred vid 320 px (årskurs) och 419 px vid 375 px (admin, med
   kolumnen Ägare). Orsak: `<span class="sr-only">Åtgärder</span>` i tabellhuvudet (`src/prov/larare/provl-lista.js:53`) är
   `position: absolute`, men `.table-scroll` är inte positionerad, så spannet hamnar utanför rullningsrutan. Samma mått på origin/main.
   Förslag på rättning (en rad): `position: relative` på tabellens rullningsruta (`.provl-mina .table-scroll`). Liten och kosmetisk.
2. **Lärarkonton (`#/larare/konton`) är 555 px bred vid 375 px**, på main likaså. Kosmetisk.
3. Fokusläget i "Kör i klass" föreslår "om en timme". Efter kl. 23 hamnar det klockslaget efter midnatt och avvisas ("Välj ett
   klockslag senare idag"). Det är provets befintliga beteende (#740), inte epicens. Kosmetisk.

Epicen förbättrade samtidigt två sidor som rullade i sidled på main: Översikt (371 px vid 320) och Statistik (960 px vid 320/375)
rullar inte längre som Hem och Hur går det?.

## 8. Vad som behöver deployas – i den här ordningen

1. **Firestore-reglerna från main:s #810** (helskärmsläget: paus, Släpp in, `extraTid`, flikbyten). De kom in med main-mergen
   (#812). Epicen själv ändrar **inte** reglerna, functions eller index.
   `firebase deploy --only firestore:rules`
2. **Webben** (Pages).
3. **En gång efter webben:** `node admin/backfill-att-ratta.mjs` (torrkörning) och sedan `node admin/backfill-att-ratta.mjs --commit`.
   Annars syns äldre stängda, orättade prov i märket, i Att göra och i Att rätta först när en lärare öppnar Provtillfällen eller
   rättningen. Idempotent, verifierat mot emulatorn (§4).

Inga index, inga functions. Märkets fråga och frågan om öppna prov är två likhetsvillkor som klaras av de automatiska fältindexen.

## 9. Sviter (slut-QA, epic-grenen + main inmergad)

| Svit | Resultat |
| --- | --- |
| node (alla `test/*.test.{js,mjs}` utom rules/functions/e2e) | **3888 pass, 0 fail**, 1 skipped (3889 tester) |
| `npm run test:rules` (emulatorn, slumpade portar) | **851 pass, 0 fail** |
| functions (`npm run test:functions`-listan, slumpade portar) | **364 pass, 0 fail**, 2 todo |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | **107** moduler (oförändrat) |
| 400-radersgränsen | testerna gröna. `teacher-shared.js` 399. Inga nya filer över 400 |
| `npm run build:css` | ingen diff |
| Inventeringstestet `test/lararsida-inventering.test.js` | grönt (ingår i node) |

## 10. Skärmdumpar

[`skarmdumpar/lararsida-qa/`](skarmdumpar/lararsida-qa/): `fore-*` = origin/main, `efter-*` = epic-grenen, båda mot samma emulator
och data. Uppsättningen täcker årskurs och admin, desktop (1366 px), mobil 375 px och (efter) 320 px. Sidorna är Hem/Översikt,
profilmenyn, ☰-menyn, Mina klasser (Hur går det?, Vad eleverna ser, Elever) mot Klasser/Statistik/Admin → Klasser & elevkonton,
Material mot Plugga-material, Prov med Att rätta och märket, och Admin-sidan med kort. Emojier syns som rutor i den headless
webbläsaren (typsnitt saknas i riggen), inte i appen.

Rigg: `bash admin/qa-lararsida-slut-preview.sh` (`JAVA_BIN`/`FIREBASE_BIN` som i `/tmp/j742`). Den kör efter-appen på
`APP_PORT` och före-appen (`git archive origin/main`) på `APP_PORT+10` mot samma emulator, med `QA_RAKNA`.
