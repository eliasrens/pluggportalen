# Rapport: Schack – Etapp 2, elev mot elev (epic #773)

Slut-QA (#782) av Etapp 2 i [`UTVECKLINGSUPPDRAG_SCHACK.md`](UTVECKLINGSUPPDRAG_SCHACK.md)
§6–§11: lobbyn, partiet mot en kompis, klockan, topplistan, lärarens sektion och helskärmen
(Elias tillägg). Arkitektur, callables och datamodell står i [`SCHACK.md`](SCHACK.md) §12–§14.
QA gjord 2026-10-19 på epic-grenen 782aafd (allt från #779, #780, #781 och #783 inmergat).

**Kort:** allt i §11 och i issue-listan fungerar i den riktiga appen mot emulatorerna: två elever
och läraren i var sitt fönster spelade partier till matt, remi, ge upp, tiden slut och "verkar ha
gått". Säkerheten håller: alla fuskförsök via regler och callables nekades (31 kontroller). Kvoten blev precis
den beräknade: **80 halvdrag med klocka = 80 skrivningar och 160 läsningar** hos spelarna
(+80 för lärarens åskådarläge). Inget skrivs eller läses per sekund. QA:n hittade **inga fel i
schackkoden**. Ett gammalt fel på main (F1) och några iakttagelser står i avsnitt 6.
**Deploy:** rules → functions → webb, och main ska mergas in först (avsnitt 8).

---

## 1. Vad som byggts

| Del | Issue | Innehåll |
| --- | --- | --- |
| 2A | #779 | Datamodellen `schackKlass/{classId}` + `schackPartier/{id}`, reglerna (läsning för klassen/spelarna/läraren, ingen klientskrivning, `schackOk` på `studentData.schack`), 11 callables (`schackVanta` … `schackLarareTopplista`), serverlogiken med chess.js (`admin/sync-schack-functions.mjs`), klockan och poängen med serverns tid, 24 h-städningen, klient-API:t `schack-moln.js` |
| 2B | #780 | Lobbyn "Spela mot en kompis" (vänta, Spela!, utmana, svara, pågående partier, topplistan), partiet mot en kompis (samma bräde, "Skickar…", klockorna, §7.3, Ge upp/Föreslå remi med bekräftelse på sidan, slutrutan med Spela igen/Till lobbyn), utmaningsrutan överallt på schacksidan, lyssnarna som stängs |
| 2C | #781 | Lärarens sektion **Schack** under Klasser: modulen på/av, pågående partier, åskådarläget live (vit nederst, ingen inmatning), Avsluta (avbrutet), topplistan (dölj, nollställ), statistik kompis/dator per elev |
| 2E | #783 | Helskärmsknappen mot datorn och mot kompis (`src/schack/schack-helskarm.js`), delad helper `src/helskarm.js` som Live/Datakuppen och elevskärmen nu också använder |
| 2D | #782 | Den här QA:n: riggen och skripten i `admin/qa-schack-2/`, rapporten och skärmdumparna `design/schack/qa782-*.png` |

## 2. Testsviter

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test` på alla 232 `test/*.test.*` utom rules/functions/e2e) | **3264 pass, 0 fail, 1 skip** (skippen är den gamla Live-demo-stubben, inte schack) |
| Firestore-regler (`test:rules`-listan mot emulatorn) | **725 / 725** |
| Cloud Functions (`test:functions`-listan mot functions + auth + firestore) | **348 pass, 0 fail, 2 todo**. De två todo är det accepterade F9 från #779: den som raderar sitt eget `studentData` tappar spärren "ett parti åt gången", och `avslutaParti` nollar spärren villkorslöst. |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs HEAD`) | **107 filer**, inget under `src/schack/` |
| Webbläsar-QA Etapp 2 (`admin/qa-schack-2/qa.mjs`, 11 steg) | **236 OK, 0 FEL** (avsnitt 3–5) |
| Etapp 1 i webbläsaren (`admin/qa-schack-app.mjs`, eleven `4a04`) | nivaer **192/192**, bradet **50/50**, hjalp **36/36**, layout **31/31**, kvot **2/2** (se F4) |

Alla sviter kördes på 782aafd, en emulator åt gången (`flock /tmp/schack-773-emulator.lock`, slumpade
portar). Emulatorn är nedstängd efteråt.

## 3. QA i webbläsaren – riggen

```
bash admin/qa-schack-2/rigg.sh <p-Alva> <p-Bilal> <p-lärare> <p-Cleo> <p-Ebba> <p-extra>
source /tmp/qa-schack-2/env
node admin/qa-schack-2/qa.mjs <steg> <samma portar> [bildmapp]
   steg: partier lobby larare sakerhet kvot kvotlobby latens helskarm layout extra gammalt
node admin/qa-schack-2/kvot-server.mjs          # serverns läsningar/skrivningar (avsnitt 5)
```

`rigg.sh` startar EN emulator (auth + firestore + functions, slumpade portar) med de riktiga
callables, seedar lärarkontona och klasserna (`qaarskurs4` har 4A och 4B, `qaarskurs5` har 5A;
eleverna `4a01`–`4a04` = Alva, Bilal, Cleo, Dante och `4b01` = Ebba; schack påslaget för 4A och
4B) och startar **en räknande proxy per användare** (`QA_RAKNA=1`). Varje användare har alltså sin
egen origin: egen inloggning och egna räknare för läsningar och skrivningar. Skripten kör headless
Chromium via CDP med riktiga mus-, touch- och tangenthändelser. De läser bara av DOM:en, anropar
callables precis som appen gör (`schack-moln.js` eller SDK:t i sidan) och läser facit med Admin-SDK:t.
Tid fejkas genom att skriva `senastDragAt`, `klocka` eller `sedan` i emulatorn.

Två fällor i riggen (inte i appen): en flik som inte ligger överst får sina mushändelser först vid
nästa bildruta (~5 s per händelse i headless). `lib.mjs` lägger därför fliken överst före varje
inmatning. Dessutom har Chrome högst 6 HTTP/1.1-anslutningar per host, och proxyn kör Firestore
som long-poll. 25 lobbysidor körs därför på `t1.localhost` … `t24.localhost`. I produktionen går
Firestore över HTTP/2, och där finns inte den gränsen.

## 4. Resultat per punkt

### 4.1 Två elever, hela partier (§11 "Två webbläsare") – `partier` 50/50

| Kontroll | Resultat |
| --- | --- |
| Alva väntar (10 min), Bilal ser "Alva väntar · 10 min" och trycker **Spela!** → båda hamnar i samma parti, båda klockorna 10:00 | ✅ (bild 1, 4) |
| **Matt** (f3 e5 g4 Dh4#) med tryck–tryck i UI:t. Motståndarens bräde och lärarens åskådarbräde följer varje drag live. Slutrutan "Schack matt – du vann! 🎉" / "Schack matt – Alva vann." med Spela igen och Till lobbyn. Servern: `0-1 matt` | ✅ (bild 8, 12, 13) |
| Tabellen efter matt: vinnaren 1000 → **1020**, förloraren 1000 → **987** (−round(5 + 15·0,5)) | ✅ (se fråga 1 i avsnitt 9) |
| **Remi:** Spela igen → Bilal får rutan "Alva vill spela schack med dig (10 min)" → Spela!. Alva föreslår remi (bekräftelse på sidan) → Bilal ser frågan och säger nej → Alva får "Bilal sa nej tack till remi. Spela vidare!". Bilal föreslår → Alva säger ja → "Remi – ingen vann" hos båda, `½-½ remi` | ✅ (bild 3) |
| **Ge upp:** Till lobbyn → Utmana (5 min) → "Nej tack" (utmaningen försvinner hos utmanaren) → Utmana igen → Spela! → Ge upp (bekräftelse) → "Du vann! Alva gav upp. 🎉" / "Du gav upp – Bilal vann." | ✅ (bild 9) |
| **Tiden slut:** krav innan tiden är slut nekas av servern ("Motståndarens tid är inte slut."). Svart får 2 s kvar → vit ser "Bilals tid är slut!" + **Kräv vinsten**, svart ser "Din tid är slut." → krav → "Du vann! Bilals tid tog slut. 🎉", `1-0 tid` | ✅ (bild 5) |
| **Utan klocka, §7.3:** ingen text direkt. Efter 4 min ser den på tur "Din tur! Om en minut kan din motståndare avsluta partiet.", motståndaren har ingen knapp och servern nekar kravet. Efter 5 min: "Alva verkar ha gått. Avsluta partiet och ta vinsten?" → "Du vann! Alva verkar ha gått. 🎉" / "Bilal avslutade partiet och vann.", `lamnade` | ✅ (bild 6, 7) |
| Topplistan efter 5 partier: båda 5 partier, egen rad markerad, förklaringen "Du får mer poäng om du vinner mot någon som har många poäng." | ✅ |
| Golvet: Alva på 805 förlorar mot 1000 → **800** (inte 796), syns på egen rad | ✅ (`gammalt`) |

### 4.2 Lobbyn – `lobby` 25/25, `gammalt` 10/10

| Kontroll | Resultat |
| --- | --- |
| Vänta utan klocka ("Alva väntar · ingen klocka") / Sluta vänta → kortet försvinner hos Bilal | ✅ |
| Utmaningen försvinner **efter 2 min** av lokal timer, utan någon ny ändring i dokumentet (3,6 s efter fejkad utgång), hos båda. Ett svar på den utgångna nekas (`not-found`). | ✅ |
| Väntan försvinner **efter 10 min** hos de andra och hos den som väntar. "Gå med" i den nekas. | ✅ |
| **Ett parti åt gången:** Cleo ser Alva och Bilal som "spelar just nu" (Utmana avstängd) och "Pågående partier: Alva – Bilal". Utmana/gå med/vänta medan man spelar nekas ("… spelar redan ett parti"). | ✅ (bild 2) |
| **Samtidigt:** Alva och Bilal trycker Spela! på Cleos väntan i samma ögonblick → exakt en får partiet, den andra `failed-precondition`. En elev går med i två väntan samtidigt → bara ett parti. | ✅ |
| **Återkomst:** `#/elev/hem` → `#/elev/schack` tar eleven tillbaka till partiet; en omladdning stannar i partiet | ✅ |
| Spela igen / Till lobbyn | ✅ (4.1) |
| **Annan klass:** Ebba (4B) ser ingenting från 4A, kan inte läsa `schackKlass/4a` (`permission-denied`) och kan inte gå med (`Du går inte i den klassen.`) | ✅ |
| En utmaning mitt i ett parti mot datorn: rutan visas, Spela! öppnar kompispartiet, och datorpartiet finns kvar efteråt ("Fortsätt partiet") | ✅ (bild 23) |

### 4.3 Lärarvyn – `larare` 24/24, del av `partier`/`extra`

| Kontroll | Resultat |
| --- | --- |
| Sektionen Schack under Klasser, "Schack är på för 4A", topplistan uppdateras live | ✅ (bild 11) |
| Pågående partier med namn och klocktyp. **Titta** → åskådarläget: vit nederst (a1 nere till vänster), inte interaktivt (tryck ger inga mål), **uppdateras live** vid varje drag, slutrutan när partiet tar slut, laddar ett parti mitt i (9 drag) | ✅ (bild 12, 13) |
| **Avsluta** (från listan och inifrån åskådarläget), bekräftelse på sidan → "Partiet avbröts" hos båda eleverna, `avbrutet` utan resultat, **tabellen orörd**, partiet bort ur listan | ✅ (bild 10) |
| Statistik: "Alva 1 (0–1–0) · 3 mot datorn · 4" efter "Hämta partier mot datorn" | ✅ |
| Dölj för eleverna → topplistan borta hos eleven (`dold: true`), Visa → tillbaka. Nollställ (bekräftelse) → tom hos eleven. | ✅ |
| **Modul av** → `enabledModules` utan schack. Callables nekar ("Schack är inte påslaget för din klass."), eleven kommer inte in i lobbyn. **Mitt i ett parti:** draget nekas med samma text och pjäsen hoppar tillbaka. På igen → fungerar. | ✅ |
| **Fokusläge** (4A låst till Läsresan) → callables nekar ("Din klass har fokusläge just nu – schacket är stängt."), eleven skickas till `#/elev/lasresan` | ✅ |

### 4.4 Säkerhet – `sakerhet` 31/31, `extra`

| Försök (som elev i webbläsaren, klient-SDK:t) | Resultat |
| --- | --- |
| Skriva `schackKlass/4a` (tabell 5000), ändra eget partis `fen` eller `klocka.vitMs`, skapa ett parti, radera partiet, nolla `studentData.schack.aktivtParti`, `datorPartier` +5 | ✅ alla `permission-denied`, partiet orört |
| Läsa ett parti där man inte spelar (klasskompis, annan klass), lista klassens partier | ✅ `permission-denied`. Läraren med klassen kan läsa. Klasskompisar kan läsa klassdokumentet (lobbyn). |
| `schackDrag`: fel tur, olagligt drag (e2–e5), motståndarens pjäs, utomstående spelare | ✅ "Det är inte din tur." / "Olagligt drag." / "Du spelar inte i det partiet." |
| **Falsk klocka:** draget skickat med `klocka`, `nu`, `senastDragAt`, `tur`, `fen`, `drag` i anropet | ✅ fälten ignoreras. Klockan räknas med serverns tid (vit 4:58, svart 5:00). |
| Konstiga id:n (`../schackKlass/4a`, `__proto__`), remi-acceptera utan erbjudande, ge upp åt någon annan, utmana sig själv / elev i annan klass, klocka 7 min, vänta i annan klass | ✅ alla nekas (`invalid-argument` / `failed-precondition` / `permission-denied`), aldrig `internal`, och lobbyn är orörd |
| Elev mot `schackLarareAvsluta` / `schackLarareTopplista` (dölj, nollställ) | ✅ "Det här kan bara en lärare göra." |
| Lärare mot elevcallables (vänta, dra). Lärare **utan** klassen (`qaarskurs5`) mot Avsluta, partiet och klassdokumentet | ✅ alla `permission-denied` |
| Två samtidiga drag från samma spelare | ✅ exakt ett sparas, det andra nekas, båda brädena visar serverns drag |

### 4.5 Inga tips, ingen varning, ingen ångra mot kompis (§7.2)

✅ Hos båda spelarna finns inga `angra`/`tips`/`varna`-knappar, ingen kryssruta och ingen text
"Ångra", "Tips" eller "Varna mig" i kompisvyn (`layout`). Förvandlingen fungerar mot kompis:
väljaren visas, Springare skickas som `bxa8=N` och motståndaren ser en vit springare (bild 22).

### 4.6 Helskärm (2E) – `helskarm` 32/32

| Kontroll | Resultat |
| --- | --- |
| Knappen finns mot kompis (verktygsraden ovanför brädet) och mot datorn | ✅ |
| I helskärm fyller brädet skärmen, och spelarraderna med klockorna samt knapparna ryms på skärmen utan sidledsskroll: mobil stående 390×844 → bräde 370 px (95 % av kortsidan), mobil liggande 844×390 → 254 px (65 %, panelen bredvid), surfplatta 820×1180 → 800 px (98 %), Chromebook 1366×768 → 522 px (kompis) / 568 px (dator), liten Chromebook 1280×650 → 404/450 px | ✅ (bild 14–17) |
| Knappen går ut ur helskärm. Webbläsarens utgång (Esc) tar bort helskärmsklassen och knappen säger "Helskärm" igen. | ✅ (Esc, se F3) |
| Slutrutan syns i helskärm. "Till lobbyn" och byte till en annan sida lämnar helskärm. | ✅ (bild 18) |
| Utan Fullscreen API (t.ex. Safari på iPhone): ingen knapp mot datorn eller kompis, verktygsraden dold | ✅ |
| **Live:** Datakuppens elevvy (`preview-datakuppen-elev.html`): ⛶ går in, knappen byter till "Lämna helskärm", och knappen går ut. Live-elevskärmens ⛶ (`createScreenChrome`) går in och ut. | ✅ som förut |

### 4.7 Layout – `layout` 24/24

320 px, 360 px, surfplatta 820×1180 och Chromebook 1366×768 för lobbyn, partiet, slutrutan,
lärarens sektion och åskådarläget: ingen sidledsskroll och inga knappar utanför skärmen. Brädet är
320 px på 320/360, 640 px på surfplatta och 518 px på Chromebook. "Kräv vinsten" syns på 320 px
(bild 19, 20). Åskådarbrädet är 237 px på 320 px (bild 21, iakttagelse F2).

### 4.8 Datorläget från Etapp 1 och övrigt (`extra` 23/23)

Etapp 1-skripten är gröna (avsnitt 2). Datorpartier räknas nu: en skrivning per avslutat parti
(`studentData.schack.datorPartier`, `schackOk` tillåter +1), och lärarens statistik visar dem.
Övrigt som provades utöver listan, med resultat:

- En elevdator som går 3 min före visar ändå rätt: väntan är inte utgången, ingen falsk
  4-/5-min-text och klockorna står på 10:00 (`serverNow`).
- Samma elev i två flikar: båda går till partiet, och ett drag i den ena syns i den andra.
- Logga ut i väntan → väntan borta hos kompisen.
- Latens mot emulatorn: tryck–tryck 117 ms, servern har draget 34 ms efter släppet, motståndarens
  bräde 63 ms efter (median av 10). Ett nekat anrop tar 25 ms.

## 5. Kvot (§9) – uppmätt

**Klienten** (räknande proxy per användare, dokument som Firestore levererar respektive tar emot):

| Mätning | Alva | Bilal | Läraren (åskådare) |
| --- | --- | --- | --- |
| 80 halvdrag med klocka (40 drag per spelare), spelade i UI:t | **80 läsningar** (partiet), 0 klassdokumentet, 0 skrivningar | **80** / 0 / 0 | **80** / 0 / 0 |
| 20 s utan drag med klockan igång | 0 / 0 | 0 / 0 | 0 / 0 – partidokumentet orört |
| Partislut (Ge upp) | 2 (partiet + lobbyn öppnas igen) | 2 | 2 |
| Efter att ha lämnat schacksidan/sektionen: 3 ändringar i partiet + 3 i klassdokumentet | **0** | 3 (kvar i partiet, kontroll) | **0** |

**Servern** (`kvot-server.mjs`: samma kärnfunktioner som callables, räknare på Admin-SDK:t):

| Steg | Läsningar | Skrivningar |
| --- | --- | --- |
| Alva väntar (`schackVanta`) | 4 | 1 |
| Bilal går med, partiet startar (`schackGaMed`) | 5 | 4 |
| 80 × `schackDrag` | 160 (partiet + `classes/` för grinden) | 80 (partiet) |
| Slut (`schackGeUpp`: partiet, klassdokumentet, 2 × spärren) | 3 | 4 |
| **Summa servern** | **172** | **89** |

**Ett parti med 40 drag per spelare och klocka** = 89 skrivningar (alla av servern) och 160 läsningar
hos spelarnas lyssnare (+172 läsningar på servern, +80 per åskådande lärare). Det stämmer med spec-riktvärdet ≈ 80/160 och med
SCHACK.md §12.7 (≈ 87/165 + 166). Klassdokumentet skrivs inte per drag, bara vid start och slut.

**Lobbyn med 25 öppna sidor:** 2 ändringar (vänta + sluta vänta) = **50 läsningar** (25 per ändring).
15 s utan händelser = 0 läsningar och 0 skrivningar, alltså ingen närvaro-ping.

**Lyssnarna stängs** när eleven lämnar schacksidan och när läraren lämnar sektionen (mätt ovan: 0
läsningar). Medan ett kompisparti pågår är spelarnas lobbylyssnare stängd (0 läsningar på
klassdokumentet under 80 halvdrag).

## 6. Fel och iakttagelser

| # | Allvar | Vad | Status |
| --- | --- | --- | --- |
| **F1** | 🟡 låg, **finns på main** | `src/pages-varld.js:76` gör `new URL(e.oldURL)` i en `hashchange`-lyssnare. Lärarinloggningen (`src/teacher-shared.js:384`) skickar en egen `new HashChangeEvent("hashchange")` utan `oldURL` när den redan står på målet → `TypeError: Failed to construct 'URL': Invalid URL` i konsolen. Steg: öppna `#/larare/klasser?klass=4a&sektion=schack` utloggad, logga in. Förväntat: ingen konsolfel. Faktiskt: TypeError (ofarligt – andra lyssnare körs ändå, sidan fungerar). | Inte rättad (utanför schack). Förslag: `new URL(e.oldURL \|\| location.href)` eller `oldURL` i den syntetiska händelsen. |
| F2 | ⚪ kosmetisk | Lärarens åskådarbräde är 237 px på en 320 px-skärm (två panellager med padding), 276 px på 360 px. Elevens bräde är 320 px. | Inte rättad – läraren tittar sällan på 320 px |
| F3 | ⚪ test-begränsning | Esc går inte att trycka via CDP i headless (webbläsaren hanterar Esc, inte sidan). Webbläsarens utgång (`exitFullscreen` utan knapptryck) är verifierad: klassen tas bort och knappen synkas. | Verifiera Esc en gång för hand på en riktig Chromebook/iPad |
| F4 | ⚪ QA-skript | Etapp 1-skriptets `kvot`-steg (`admin/qa-schack/steg-kvot.mjs`) väntade 0 skrivningar. Sedan 2C skrivs räknaren `datorPartier` (+1) när ett datorparti tar slut. | **Rättat** i skriptet: väntar nu exakt 1 skrivning (`studentData/*`) för ett avslutat + ett påbörjat parti |
| F5 | ⚪ QA-miljö | Etapp 1:s `hjalp` gav 22/23 när det körde samtidigt som ett annat QA-steg (brädet hann inte ritas på 20 s efter `injicera`). Ensamt: 36/36. | Ingen åtgärd (lastberoende tidsgräns i skriptet) |

## 7. 24 h-städningen – valet

**Städning när klassdokumentet skrivs + i varje partianrop, ingen schemalagd funktion** (SCHACK.md
§12.6). Verifierat i webbläsaren (`gammalt`): ett parti utan drag på 25 h står kvar i "Pågående
partier" tills nästa lobbyanrop i klassen. Då avbryts det ("Partiet avbröts" hos båda), det tas
bort ur listan, ingen tabellrad skapas och spelarna är fria i samma anrop. Ett drag i ett 25 h-parti
nekas med "Partiet avbröts – ingen hade dragit på 24 timmar." och partiet avbryts. Skäl: ingen
Cloud Scheduler och ingen extra deploy, inga läsningar när ingen spelar. Konsekvensen är att ett
gammalt parti syns i listan tills någon i klassen öppnar lobbyn och gör något.

## 8. Deploy – ordning och varför

Ändrat mot main: `firestore.rules` (schack-reglerna + `schackOk`), `functions/` (11 callables +
`functions/schack/`), `firebase.json` (predeploy `sync-schack-functions.mjs`) och webben. **Inga
index** (`firestore.indexes.json` är orörd; lärarvyn läser klassdokumentet, ingen fråga).

0. **Merga in main i epic-grenen först.** Main har fått Prov Etapp 3 (#784) sedan epicen
   startade, med ändringar i `firestore.rules`. Reglerna slås ihop utan konflikt, men
   `docs/BEHORIGHETER.md` och `package.json` (`test:rules`-listan) har konflikter (`git merge-tree`).
   Reglerna **måste** deployas från den sammanslagna versionen, annars rullas Prov 3:s regler tillbaka.
1. **`firebase deploy --only firestore:rules`.** Den nya webben lyssnar på `schackKlass`/`schackPartier`,
   och utan de nya reglerna nekas de (allt annat är `false`). `schackOk` hindrar också eleven från
   att nolla spärren `aktivtParti`. Reglerna är säkra för den gamla webben, som aldrig skriver
   `studentData.schack`.
2. **`firebase deploy --only functions`** (predeploy kör `sync:schack`). 11 nya callables, inget
   befintligt ändras. Admin-SDK:t går förbi reglerna, så ordningen mot 1 är inte kritisk. Men de
   ska finnas innan webben anropar dem.
3. **Webben sist:** merga PR:en till main → GitHub Pages. Vänta ~10 min (Pages + Fastly) innan
   lärarna testar. Klasser som redan har schack påslaget från Etapp 1 får "Spela mot en kompis"
   direkt. Bootgrafen är 107 filer, så ingen vit sida (incidenten 2026-09-10).

Rollback: webben först (revert av PR:en). Callables och regler kan ligga kvar, eftersom ingen
gammal klient använder dem.

## 9. Öppna frågor till Elias

1. **Poängen växer i snitt:** vid lika poäng får vinnaren +20 och förloraren −13 (spec: vinst
   +10…+30, förlust −5…−20). Klassens summa ökar alltså med ~7 per avgjort parti, och alla
   klättrar över tid. Snällt och avsiktligt, eller ska förlusten spegla vinsten?
2. **Esc i helskärm (F3):** testa gärna en gång på en riktig Chromebook och en iPad. På iPhone
   finns inget Fullscreen API, och då visas ingen knapp.
3. **F1** (konsolfel vid lärarinloggning, finns på main): egen liten issue?
4. **Lärarens åskådarläge på mobil (F2):** brädet är 237 px på 320 px. Räcker det?
5. **24 h-valet:** ett övergivet parti syns i "Pågående partier" tills någon i klassen gör något i
   lobbyn (avsnitt 7). Okej, eller vill du ha en schemalagd städning (kräver Cloud Scheduler)?
6. **Väntan när fliken stängs** (från #780): webbläsaren hinner oftast inte ta bort väntan, så den
   står kvar i högst 10 min (alla filtrerar bort den efter det). Okej?

## 10. Skärmdumpar

`design/schack/qa782-*.png`, från den riktiga appen mot emulatorn (emoji saknas i
headless-Chromium och ser ut som rutor – det gäller bara testmiljön):

1 lobbyn med en väntande kompis · 2 pågående partier (Utmana avstängd) · 3 utmaningsrutan ·
4 partiet med klocka · 5 Kräv vinsten · 6 varningen efter 4 min · 7 "verkar ha gått" ·
8 slutrutan matt · 9 slutrutan ge upp · 10 avbrutet av läraren · 11 lärarens sektion ·
12 lärarens åskådarläge live · 13 åskådarläget vid matt · 14 helskärm Chromebook ·
15 helskärm mobil stående · 16 helskärm mobil liggande · 17 helskärm mot datorn, surfplatta ·
18 slutrutan i helskärm · 19 partiet 320 px · 20 Kräv vinsten 320 px · 21 åskådarläget 320 px ·
22 förvandling mot kompis · 23 utmaning mitt i ett parti mot datorn.
