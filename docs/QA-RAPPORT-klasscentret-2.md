# QA-rapport – Klasscentret 2/4 (epic #475, issue #492)

Testat 2026-10-07 av Coder-agenten (QA). Gren: epic-grenen vid `4ddc305` (A–F, #486–#491
landade). Allt kördes mot **Firestore- och Auth-EMULATORN** via `admin/qa-emulator-proxy.mjs`
(samma origin), headless Chrome 780×437. Inga skrivningar mot live, ingen deploy.
Skärmdumpar: `docs/qa-klasscentret-2/`.

## Sammanfattning

| # | Kontroll | Resultat |
|---|----------|----------|
| 1 | Boot + bootgraf | ✅ BFS från `src/app.js` = **110 filer, identisk med epic 1 (`b70d84a`)**, inga `klasscenter/*`; kall boot 118 anrop alla 200, inloggad 134 alla 200, `kc-*` laddas först vid behov; 0 konsolfel |
| 2 | Shop "Klasscentrum" + crowdfunding | ✅ 8 föremål 2 000–10 000 med konst; A donerar 100 → "100 / 5 000"; B (annan session) ser det i realtid och tvärtom; cappning mot saldo och mot det som saknas; 100 % → "Köpt", inga fler donationer, i möbellådan |
| 3 | Samtidighet | ✅ summan stämmer **exakt** och aldrig över mål · ✅ **F1 åtgärdat i #493**: 28 samtidiga → 0 nekade |
| 4 | Anonymt | ✅ elev kan inte läsa `donations` (regel) och UI visar bara totalsumman + "du har bidragit"; läraren ser vem som donerat |
| 5 | Rummet | ✅ klick i byn öppnar rummet; möbellåda → placera → dra → Spara; annan elev och gäst ser samma layout; två samtidiga sparningar → två versioner, ingen sammanslagning; Historik/Återställ (elev och lärare) |
| 6 | Behörighet | ✅ lärare bockar ur → inga verktyg, drag gör inget, regeln nekar spara/återställa, donation fungerar; annan klass: inga verktyg + regeln nekar |
| 7 | Regression | ✅ Mitt rum (placera, dra, autospar, omladdning, extra rum), vanliga shoppen (Pall + Extra rum), byn + mätaren (live Nivå 6 → 7) |
| 8 | Testsviten + 400-raderskap | ✅ **1065/1065** enhet + **181/181** regler + **5/5** e2e-auth; inga nya filer > 400 (se O3) |

**Buggar: 1 i appen (F1, medel) – åtgärdat i #493.** F2 var ett fel i testdatan och är rättat. O1 är också åtgärdat i #493.

## Miljö och recept

- Emulator: firebase-tools + JRE (`/tmp/kc492/firebase.json`: Firestore 8492, Auth 9492, hub 4492), regler = grenens `firestore.rules`.
- Proxy: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8492 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9492 PORT=8493 node admin/qa-emulator-proxy.mjs`
- Seed (i ordning): `qa-klasscenter-by-seed.mjs` → `qa-klasscenter-rum-seed.mjs` → `qa-klasscenter-larare-seed.mjs` → `qa-klasscentrum-shop.mjs seed`. Lösenord `lilla123` (endast emulator), lärare `qalarare`.
- **Nytt:** `admin/qa-klasscentret-2-kontroll.mjs samtidighet [elever] [perElev] | regler | layout` – skriptade kontroller (klient-SDK + regler, som eleven/läraren). Avslutar med exit 1 om något failar.
- Byte av användare i samma flik: `import("/src/auth.js")` → `signOutCurrent()` + `signInStudent()` / `signInTeacher()` i `evaluate_script`.

## 1. Boot och bootgraf

- BFS över statiska `import`/`export … from` från `src/app.js`: HEAD 110 filer, epic 1 (`b70d84a`) 110 filer, `diff` tom (listan: `docs/qa-klasscentret-2/bootgraf-bfs-head.txt`). Alla nya filer (`src/klasscenter/kc-*`, `art-klasscenter-hall/inredning*`, `rum-inredning.js`, `teacher-class-klasscenter.js`) nås bara via `import()`.
- #490:s delade drag-kärna ligger i den redan befintliga bootfilen `rum-promenad-golv.js` – ingen ny fil i grafen.
- Kall boot: 118 anrop, alla 200. Inloggad (`#/elev/hus`): 134, alla 200, inga `kc-*`. 0 fel/varningar i konsolen (utom de avsiktliga `permission-denied` i F1/F2-testerna).

## 2. Shop "Klasscentrum" och crowdfunding

Klass `qa-ks` (ks01 "Alva" och ks02 "Ebbe", 3 000 mynt var).

| Steg | Resultat | Bild |
|------|----------|------|
| Fliken "Klasscentrum" | 8 kort med SVG-konst: fana 2 000, troféhylla 2 500, lounge 3 000, akvarium 4 000, guldstaty 5 000, flygel 6 000, fontän 8 000, kristallkrona 10 000 | 01 |
| ks01 (webbläsare) donerar 100 till guldstatyn | "**100 / 5 000** mynt insamlade", "Du har bidragit med 100 mynt" | – |
| ks02 lyssnar (`qa-klasscentrum-shop.mjs lyssna ks02`, egen session) | `[20:46:19] ks02 ser: guldstaty 100 / 5000` – samma sekund | – |
| ks02 donerar 400 (skript) | ks01:s flik visar **500 / 5 000** (10 %) utan omladdning | 02 |
| Eget belopp 9 999 i fältet | fältet kläms till 2 900 (= saldot), "Du kan skänka högst 2 900 mynt" | – |
| Fanan 1 800 / 2 000: panelen | "Bara 200 mynt saknas!", chip 500 avstängt, "Resten (200)" | – |
| "Resten (200)" → Skänk | **2 000 / 2 000 – "✓ Köpt! Finns i klassens möbellåda"**, inga knappar kvar | 03 |
| `donate()` direkt (förbi UI:t) | köpt → `redan-kopt`; 9 999 → **cappat till 2 700** (hela saldot), saldo 0; igen → `for-lite-mynt`; −5 → `ogiltigt-belopp`; okänt id → `okant-foremal` | – |

Ingen förlorar mynt: i alla körningar är dragna mynt = summan av donationsposterna (se 3).
Lärarvyn (08) visar efteråt: fana "Ebbe 1 800 · Alva 200", guldstaty "Alva 2 800 (2 gånger) · Ebbe 400".

## 3. Samtidighet

`node admin/qa-klasscentret-2-kontroll.mjs samtidighet [elever] [perElev]`: ks03…ks12 (1 000 mynt var) donerar samtidigt till troféhyllan (300 per donation, mål 2 500) och akvariet (100 per donation, mål 4 000).

| Körning | Lyckade | Nekade | Insamlat = poster = lyckade svar | Över mål? |
|---------|---------|--------|----------------------------------|-----------|
| 10 × 3 troféhylla | 9 (1 cappad) | 5 `redan-kopt`, **16 `permission-denied`** | 2 500 = 2 500 = 2 500 ✅ (köpt) | nej |
| 10 × 3 akvarium | 10 | 4 `for-lite-mynt`, **16 `permission-denied`** | 1 000 = 1 000 = 1 000 ✅ | nej |
| 5 × 1 (två gånger) | 4 | **1 `permission-denied`** | ✅ | nej |
| 10 × 1 | 5–6 | **4–5 `permission-denied`** | ✅ | nej |

Dragna mynt = summan av alla poster (3 500 = 3 500) – nekade donationer drar ingenting.

### F1 (medel): samtidiga donationer nekas ofta – eleven får "Försök igen" – ✅ Åtgärdat i #493

> **Åtgärdat i #493.** Orsaken låg inte i ett återanvänt `donationId` eller en läsning utanför transaktionen. Emulatorn räknar reglerna mot det **senast sparade** `fund` när commit kommer, inte mot det transaktionen läste. Om en klasskamrat hann före stämmer inte "ökar exakt `amount`" längre, och svaret blir `permission-denied` (som SDK:t inte försöker igen). Dessutom köade transaktionerna på `fund`-dokumentets lås, 1–2 s per försök. Med 28 givare hann bara ~17 igenom på 12 försök.
>
> **Ny lösning:** `korDonation` läser `fund` och saldot från servern och skriver sedan **en atomär batch** utan lås. `coins` blir `increment(−n)` och `fundedAmount` `increment(+n)`, så reglerna räknar mot det aktuella läget och samtidiga givare under målet går alla igenom direkt. Reglerna är oförändrade och garanterar fortfarande exakt summa, aldrig över målet och att saldot inte går under 0. Om någon hann fylla målet nekar reglerna, och då läser `kc-omforsok.js` om, cappar om och försöker igen: upp till 10 gånger, med exponentiell backoff och jitter. Är målet nått blir svaret "redan köpt" utan att några mynt dras. Om ett nekat försök följs av ett försök som läser **exakt samma läge** är det ett verkligt nej (t.ex. inte klassmedlem). Då slutar den direkt, och eleven får "du kan bara skänka till din egen klass" i stället för "försök igen". Layouten använder samma omförsök (8 försök, transaktionen behålls eftersom version + 1 kräver det).
>
> **Mätvärden efter #493** (samma skript, emulatorn):
>
> | Körning | Lyckade | Nekade | Tid | Kontroller |
> |---------|---------|--------|-----|------------|
> | 5 × 1 | 5 + 5 | 0 | 0,2–0,7 s | ✅ |
> | 10 × 1 akvarium | 10 | **0** | 0,2 s | ✅ |
> | 10 × 1 troféhylla (förbi målet) | 9 (1 cappad) | 1 `redan-kopt` (inget dras) | 0,7 s | ✅ köpt, exakt 2 500 |
> | **28 × 1 akvarium** | **28** | **0** | 0,4 s | ✅ |
> | 28 × 1 troféhylla (förbi målet) | 9 (1 cappad) | 19 `redan-kopt` (inget dras) | 7–10 s | ✅ köpt, exakt 2 500 |
> | 10 × 3 akvarium | 30 | 0 | 0,3 s | ✅ |
> | 10 × 3 troféhylla | 9 | 9 `redan-kopt`, 12 `for-lite-mynt` | 7 s | ✅ |
>
> 0 `permission-denied` i alla körningar, och dragna mynt = summan av posterna i alla. Det som fortfarande är långsamt är när många tävlar om de sista mynten till ett mål. I emulatorn tar ett **nekat** commit 1–6 s (ett godkänt tar ~0,1 s), så "Köpt"-svaret kan dröja några sekunder för dem som kom för sent. I riktiga Firestore bör ett nekat commit gå snabbare, men det kan inte verifieras utan deploy. Automatiskt test: `test/firestore-rules-klasscenter-fund.test.js` ("12 samtidiga …", två fall) och `test/kc-omforsok.test.js`.

**Ursprunglig rapport (#492):**

- **Repro:** `node admin/qa-klasscentret-2-kontroll.mjs samtidighet 5 1` (5 elever donerar samma sekund) → ungefär 1 av 5 nekas. Med 10 samtidiga nekas ungefär hälften. I appen syns det som toasten "Donationen gick inte igenom. Försök igen." (`kc-shop-vy.js:246`).
- **Orsak:** `korDonation` (`src/klasscenter/kc-fund-plan.js:107`) försöker högst `KROCK_FORSOK = 4` gånger med 40–200 ms × varv backoff. Emulatorn svarar `permission-denied` (reglerna räknas mot en nyare `fund`) i stället för en vanlig transaktionskrock. När många skriver samtidigt räcker fyra försök inte.
- **Konsekvens:** datan är alltid rätt och ingen förlorar mynt. Det är bara upplevelsen: när läraren säger "nu donerar alla!" får en del elever ett fel och måste trycka igen.
- **Osäkerhet:** riktiga Firestore kan uppföra sig annorlunda än emulatorn (krock-svar i stället för `permission-denied`, med SDK:ns egna omförsök). Det går inte att verifiera utan deploy.
- **Förslag (till leaden/kodaren):** fler försök (t.ex. 8) med jitter, eller i UI:t: försök automatiskt igen tyst en gång till innan toasten visas. Layouten har samma mönster (`kc-layout-plan.js` `KROCK_FORSOK = 4`), men där krockar i praktiken bara 2–3 samtidigt (testat 2 – fungerade).

## 4. Anonymt

- Regler (`kontroll.mjs regler`): elev läser `donations` (lista och enskild post) → `permission-denied`; elev läser `fund` → ok (bara totalsumman); lärare läser `donations` → ok med `uid`.
- UI elev: shopkortet visar bara "X / Y mynt insamlade" och "Du har bidragit med N mynt" (bara ens eget). Inga namn i hela `.kc-shop` (kontrollerat som kc01, 11).
- UI lärare: Klasser → klass → **Klasscentret** → "Insamling": per föremål "Donerat: Ebbe 1 800 mynt · Alva 200 mynt" (08).

## 5. Rummet (City Hall)

Klass `qa-kc` (kc01 "Noah", kc02 m.fl.).

| Steg | Resultat | Bild |
|------|----------|------|
| Byn → klick på Klasscentret | rummet öppnas (`data-niva=kcrum`), titel "Klasscentret · Nivå 2 Tält", mätare, verktyg Möbellådan/Historik/Spara | 04 |
| Möbellådan | bara upplåsta föremål (fana, lounge, akvarium, kristallkrona; guldstatyn redan placerad) | – |
| Akvarium från lådan, drag 30 %,78 % → 9,7 %,83,2 % | status "✏️ Ändringar som inte är sparade", Spara markeras | – |
| Spara | "✓ Sparat! Alla i klassen ser nu rummet så här." → v7 | 05 |
| kc02 och gästen kd01 läser (klient-SDK, egna sessioner) | båda ser v7 av kc01 med samma koordinater | – |
| Annan elev sparar medan rummet är öppet (inga osparade ändringar) | rummet byts live | – |
| Osparad ändring + kc02 sparar | "🔔 Någon i klassen sparade rummet nyss. **Visa deras** – eller tryck Spara …"; Spara → min version vinner, deras finns i Historik | 06 |
| Två samtidiga sparningar (kc01 + kc02, skript) | v8 och v9 i följd, current = en hel layout (ingen sammanslagning av kartorna), båda oförändrade i historiken | – |
| Historik (elev) | 10 senaste (ringbuffert), "Visas nu" + "↩ Återställ" | 07 |
| Återställ (elev) | ny version (v13) med den gamla layouten | – |
| Återställ (lärare) | ny version (v15 = v12:s layout), "du (lärare)" överst i listan; en bekräftelse per klick | – |

## 6. Behörighet

- **Lärare bockar ur Noah (kc01)** i "Vem får inreda?" → "✓ Sparat – får inte inreda: Liam, Noah" (09).
- Regel: kc01 sparar (skript) → `permission-denied`; kc02 sparar direkt efter → ok (v14).
- UI kc01: verktygen är dolda, status "👀 Du kan titta på rummet, men läraren har stängt av inredning för dig."; ett drag av loungen flyttar ingenting (10).
- kc01 kan fortfarande donera: flygel 1 850 → 1 860 (11).
- Spärrad kc03 (seed): spara och återställa → `permission-denied`. Eleven kan inte ta bort sig själv ur `inredningSparr` (`permission-denied`).
- **Annan klass:** kd01 (4B) → grannbyn 4A → centret: "Klasscentret i QA-klass 4A", inga verktyg, "👀 Du är på besök – bara klassen själv kan inreda här." (12). Regel: spara → `permission-denied`, läsa layouten → ok (gästläge).
- Övriga manipulationsförsök (`kontroll.mjs regler`, alla nekade): elev utan klass donerar; donation till annan klass; `fund` ökar utan donationspost; fund + post utan myntavdrag; mer än saldot (negativa mynt); donation till köpt föremål; eget lågt pris (`targetPrice 100`); radera donationspost (elev **och** lärare).

### F2 (testdata, rättad): lärar-seeden blockerade flygeln

- Först nekades kc01:s donation till flygeln (`permission-denied`, fyra försök). Orsaken var att `admin/qa-klasscenter-larare-seed.mjs` skrev `unlockedAt: null` i `fund/flygel`. Reglerna kräver att fältet **saknas** tills föremålet är köpt (`!('unlockedAt' in d)`), och klienten skriver med merge, så null-fältet ligger kvar. Appen själv skriver aldrig null.
- **Rättat i seeden** (fältet utelämnas) och i emulatordatan. Efter det gick donationen igenom (11).
- Notering: ett `fund`-dokument med `unlockedAt: null` (bara möjligt via admin/konsol) låser föremålet för gott. Gäller inte appen.

## 7. Regression

- **Mitt rum** (kd01): köpte Pall (30) och Extra rum (250) i vanliga shoppen. Saldot gick 5 000 → 4 720, "✓ Köpt" på Extra rum. I rummet: Verktyg → Möbler → Pall placeras, drag 50 %,78 % → 66,6 %,82,8 % → autospar till `studentData.room.placements.stol` → kvar efter omladdning. Rum 1/Rum 2-flikarna fungerar och Rum 2 är tomt och separat (13).
- **Vanliga shoppen**: alla flikar finns (Kläder, Möbler, Husdjur, Djurmat, Dekor, Hus, Baksidan, Klasscentrum, Mysterybox). Köp fungerar.
- **Byn + mätaren**: 4B visar Klasscentret "Nivå 6 · Rådhus 500 / 705". När shard-EXP höjdes till 705 bytte centret live till **Nivå 7 · Borg, 705 / 1 095** (14). Fem hus, en "Du!".
- 0 fel/varningar i konsolen efter omladdning genom hela regressionsrundan.

## 8. Testsviten och filstorlek

- Enhetstester (86 filer, utan regler/e2e): **1065/1065**.
- Regeltester (13 filer, alla listade i `npm run test:rules`), mot emulatorn: **181/181**.
- e2e-auth (`test/e2e-auth.test.mjs`, Auth- och Firestore-emulatorn): **5/5**.
- **Efter #493:** enhet **1075/1075** (87 filer, ny `test/kc-omforsok.test.js`), regler **185/185** (+4: 12 samtidiga ×2, icke-medlem/spärrad slutar direkt, O1), e2e-auth **5/5**. Bootgrafen oförändrad (den nya `kc-omforsok.js` importeras bara av de dynamiska `kc-fund-plan.js`/`kc-layout-plan.js`). En körning hade ett slumpfel i `adventure-flee.test.js` ("pickRespawn …"), som inte har med detta att göra. Testet var grönt 5/5 vid omkörning.
- **Ingen ny fil > 400 rader.** Största nya är `kc-layout-plan.js` (297); `pages-shop.js` 398.

## Observationer (inte buggar)

- **O1 – ✅ Åtgärdat i #493.** Återställ skickar nu med versionen som listan visade (`historikVersion`, både elevens rum och lärarsidan). Innehåller slotten en annan version nekas återställningen ("Historiken har ändrats – listan laddas om."), ingenting skrivs och listan ritas om. Test: `test/kc-layout-plan.test.js` + `test/firestore-rules-klasscenter-layout.test.js` ("O1: …"). Ursprungligt fynd: **Lärarens historiklista uppdateras inte live.** Återställ pekar på en *slot* (`version % 10`). Om listan är gammal och ringbufferten hunnit skriva över slotten (≥ 10 nya sparningar sedan listan ritades) återställs en annan version än den läraren klickade på. Låg risk. Kan lösas med `forvantadVersion` eller genom att slotten kontrolleras mot den version som visades.
- **O2** Rummets status "✓ Sparat!" står kvar när en annan elev sparar och rummet byts live. Kosmetiskt.
- **O3 Gamla filer > 400**: `pages-varld.js` växte 1 065 → 1 068 och `styles.css` 6 967 → 6 986 (båda var redan långt över 400). `varld-rum.js` krympte 869 → 788. Inga nya överträdelser.
- **O4** En gång syntes en kvarhängande `confirm` ("Återställ rummet …") i fliken efter att läraren loggat ut. Det gick inte att återskapa: två nya försök gav exakt en bekräftelse per klick. Troligen en artefakt av testverktygets dialoghantering.
- **O5** På 780 px bredd trycks rummets titel och mätartext ihop under verktygsknapparna (06). Det är läsbart.
- Emojis visas som ▯ i headless-Chrome. Det är en känd miljöbegränsning.
