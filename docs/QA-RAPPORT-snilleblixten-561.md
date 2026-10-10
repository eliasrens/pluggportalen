# QA-rapport – Snilleblixten slut-QA (#561, epic #555)

Slutverifiering av epic-grenen `665f5d7` (A #556, B #557, design #571, elevvy #558, TV-studion #559 och historik/demo #560).
Funktionsspec §1, §10 och §12 samt designspec §14, §16 och §17.

**Resultat: allt funktionellt är grönt, och Klassmatchen är oförändrad.**
Fynden är 1 bugg (F1, designtest 10) och 2 mindre (F2 och F3). Inga konsolfel uppstod vid kall boot och inte heller i elevvyn.
Designen ändrar varken poäng, placering, facit eller tid. Pallen och belöningarna stämmer mot en oberoende omräkning av ställningen ur serverstämplarna.

## Testsviter (efter all QA, samma gren)

| Svit | Resultat |
| --- | --- |
| `test/*.test.js` (enhetstester, utom regel/e2e/functions) | 1484 / 1484 |
| `npm run test:rules` (28 filer, bl.a. `live-snilleblixt` och `live-rewards`) | 385 / 385 |
| `npm run test:e2e` | grönt (exit 0) |
| `npm run test:functions` | 6 / 6 |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | 107 filer, ingen Live-fil i den statiska grafen |

## Metod

- **Emulatorn** körs med grenens egna regler via `admin/qa-snilleblixt-preview.sh` (8564/9564, proxy 8565). Seeden är `qa-mm-live-seed` + `seed/seed.mjs` + NYA `admin/qa-snilleblixt-slut-seed.mjs`. Den nya seeden ger 4B och 5E (42 elever) djur och kläder i både studentData och klassprojektionen. b02 har trollkarlshatt och mantel och b03 har låst hus.
- **EN webbläsarflik.** Fliken är antingen läraren (projektorn) eller eleven b01, aldrig båda samtidigt.
- **Låtsaselever** körs med NYA `admin/qa-snilleblixt-slut-kontroll.mjs elever`. Varje elev är en egen klient-SDK-instans som är inloggad som sig själv, så reglerna prövar varje skrivning. Skrivplanerna är appens egna (`planLiveJoin`, `planLiveHeartbeat` och `planAnswer`). Rollerna är styrda per scenario. Facit läses bara av testriggen (admin).
- **"En andra lärare"** körs med NYA `admin/qa-snilleblixt-larare.mjs`. Det är **appens egen kod** i node (`live-feed` som lärare + `sb-koppling`, alltså samma automatik som projektorn, + result-skrivning och utbetalning). Den körs via `admin/qa-node-app-loader.mjs`, som mappar gstatic-SDK:t till npm-firebase och `firebase-config.js` till emulatorn. Två sådana klienter, eller en klient + webbläsaren, tävlar om varje steg.
- **Verifieringen** görs med NYA `admin/qa-snilleblixt-slut-verifiera.mjs`. Den räknar **oberoende** av appens kod, med egna formler ur spec §5.5 och §7.2, och jämför med det som sparats: sbScores, `result.rewards`, kvitton och saldon före och efter.
- **Klassmatchen** jämförs med `origin/main` (`bec8943`) sida vid sida. En `git archive`-kopia körs på proxy 8566 mot SAMMA emulator, och samma sessioner hashas i båda.

| Körning | Session | Innehåll |
| --- | --- | --- |
| A | `ORKy17nC8rcr2t7e5HBh` | Flerval, 24 elever (+1 sen), 10 frågor à 20 s, förstapris 300. Webbläsaren är projektor, rasmus är andra lärare |
| B | `xnnKwGUKXkyVSAQ7NQEO` | Skriv själv, 28 elever, fråga 1 = 7 × 8, förstapris **100** (20c). Webbläsaren är projektor |
| C | `Yl6i0byZq2pcaoxahOsN` | Skriv själv, 30 elever, **50 frågor** (20i). Webbläsaren är eleven b01, rasmus och elias är två lärare i node |
| D | `EHLMsBgJ0tJHZBVnbH9t` | Flerval utan frågetext på elevskärmen. Webbläsaren är b01 (tangent 1–4, dubbelklick, omladdning, ljud) |
| K | `0LYDeKUe3p6HkbE1JWBG` | Klassmatchen 4B mot 5E, 5 min, mynt-pris 100 |

Två tidigare körningar (`JTtnhPo9…` och `PZVWV79T…`) fick riggfel i mitt skript (rollerna och namnet vid sen anslutning) och kördes om som A. De gav ändå extra data. I `JTtnhPo9…` avbröts spelet mitt i, och fyra elever delade 1:a plats. Utbetalningen blev rätt, se x01. I `PZVWV79T…` bekräftades utbetalningen exakt en gång med två lärarklienter och en omladdning, och där hittades F1.

## Funktion (funktionsspec §10)

| Test | Resultat |
| --- | --- |
| **3b** Snilleblixten + multiplikation | ✅ Formuläret visar Skriv själv / Flerval (förval Skriv själv, 20 s). Flerval byter förvalet till 10 s. Valet sparas (`answerKind`). Efter start nekas lärarens `answerKind`, `questionSeconds` och `questionCount` (`permission-denied`) |
| **3c** Quiz från Plugga | ✅ Inget svarssättsval visas |
| Högst 3 klasser | ✅ Den fjärde kryssrutan går inte att kryssa |
| **4** Gemensam fråga | ✅ "0 av 24 har svarat" räknar upp till 23 av 24. Alla får fråga 1 samtidigt. [p03](qa-snilleblixt-561/p03-fraga-flerval-1280.jpg) |
| **5** 900 poäng | ✅ Svaret kom 3,988 s efter öppning (servertid) och gav **900** |
| **6** Fel svar | ✅ 0 poäng. ❌ visas först vid avslöjandet. [e06](qa-snilleblixt-561/e06-avslojande-fel-surfplatta.jpg) |
| **7** Dubbelklick / dubbel-ENTER | ✅ Klient: två olika val samtidigt ger `ok` + `permission-denied` och ett dokument. UI flerval: två klick direkt efter varandra sparar bara det första. UI skriv: ENTER två gånger ger ett svar |
| **7b** 7 × 8 | ✅ "Rätt svar 56 · 71 % rätt (20 av 28) · Vanliga felsvar: 54 (5 st) · 64 (3 st)", utan namn. " 056 " räknas rätt. [p10](qa-snilleblixt-561/p10-avslojande-skriv-7b-1280.jpg) |
| **8** Facit | ✅ På alla 10 frågor nekades eleven att läsa sbPrivate/snapshot, alla svar och någon annans svar, att skriva sbScores och `q.phase`, och att skicka fel svarsform (3d). Sessionen innehöll aldrig facit eller kommande frågor före avslöjandet |
| **9** Alla svarat | ✅ Frågan stängdes 21–26 ms efter sista svaret (28 svar på 2,4 s) |
| **10** Två lärare | ✅ I C tävlade två lärarklienter om alla 50 frågor (95 försök): exakt 50 steg, sbScores 0–49 i följd, inget överhopp. I A klickades NÄSTA två gånger samtidigt med rasmus |
| **11** Omladdning | ✅ Skriv: "Svar inskickat · Ditt svar: 27", fältet dolt och avstängt. Flerval: det valda alternativet lyser kvar |
| **12** Final, delad placering | ✅ Delningen stämmer på samma pallsteg: A delad 3:e (975 = 975), demot delad 2:a, x01 fyra delar 1:a. ⚠️ I A hamnade delningen på 3:e och inte 2:a plats på grund av min scenarioplan. 2:a-fallet täcks av enhetstesterna och demot |
| Svar efter stängning | ✅ Nekas |
| Sen anslutning (§5.7) | ✅ Svar på pågående fråga nekas, eleven deltar från nästa fråga |
| Lärarknappar | ✅ Hoppa över ("⏭ Hoppades över"), Avsluta spelet (bekräftelse) och Till pallen |
| **20b** Placeringspris 300 | ✅ Pris = round(300 × 0,85^(plats−1)), minst 1, för alla deltagare i A, C och x01 (egen omräkning) |
| **20c** Förstapris 100 | ✅ B: 100 / 85 / 72 / 61 / 52 + rätt-mynten |
| **20d** Delad placering | ✅ Delad plats ger samma pris, och nästa elev hoppar över platserna. A: två 3:or får 217 var och nästa är 5:a med 157. Två 2:or med 255/184 täcks av `test/live-rewards.test.js` |
| **20e** Trappa | ✅ 50 rätt ger 210, 42 rätt 186, 24 rätt 116 och 20 rätt 100 (egen omräkning för alla elever) |
| **20g** Exakt en gång | ✅ Två lärarklienter + en omladdning under finalen gav ett kvitto per elev, och saldot efter = före + total för alla 42 elever (A, B, C och PZVWV79T) |
| **20h** Ej deltagit | ✅ Eleven som anslöt men aldrig svarade fick inget pris, inga mynt och inget kvitto |
| **20i** Slutskärm | ✅ "🥈 Du kom 2:a! · Placeringspris 255 · 42 rätt svar 186 · Totalt: 441 pluggmynt". Saldochippet gick 100 → 541. [e07](qa-snilleblixt-561/e07-final-20i-chromebook.jpg), [e08](qa-snilleblixt-561/e08-final-20i-surfplatta.jpg) |
| Prestanda | ✅ 28 svar på ~2,1 s. Svarsskrivningens median är 13–16 ms och p95 25–44 ms (1500 svar i C). Projektorn höll 56 fps under skuren, längsta bildrutan var 67 ms och ingen var över 100 ms. Räknaren gick 0→28 utan att stanna |
| Demoläget skriver ingen data | ✅ Inga Firestore-anrop. Se observation O1 om Auth |

## Design (designspec §14.2)

| Test | Resultat |
| --- | --- |
| **1** Hatt + mantel | ✅ b02 (Ali) har `af-rygg` före `af-base` i lobby, publik och pall, så manteln hänger bakom figuren. [p08](qa-snilleblixt-561/p08-pallplats-resultat-1920.jpg) |
| **2** Få läsningar | ✅ Kall laddning av projektorn med 28 elever i två klasser gav exakt 1 läsning av `classProjections/4b` och 1 av `5e`, och 0 läsningar av studentData/students (räknat i webbläsarens nätverkskroppar) |
| **3** Huslås | ✅ b03 (låst hus) visas med projektionens avatar, precis som byn. Inget mer läses |
| **4** Trängsel 1280×720 | ✅ 28 avatarer i två rader. Timer, rubrik och knappar döljs inte. [p09](qa-snilleblixt-561/p09-fraga-skriv-28-1280.jpg) |
| **5** Klättring / Ny ledare | ➖ Medvetet borttaget (Elias 2026-10-10, ingen uthängning). Verifierat att ingen topplista eller banderoll visas |
| **8** Pallplats | ✅ 3:an, 2:an och 1:an i rätt ordning med kläder. Topp 3 = ställningen ur serverstämplarna (A, B, C) |
| **9** Delad placering | ✅ Samma pallsteg ("Ines & Leo", "Ivar & Nora") |
| **10** Omladdning | ✅ Mitt i en fråga visas rätt fråga och "22 av 23" direkt, utan gamla händelser. Finalen spelas inte om. ❌ **F1:** Efter finalen blir pallen tom |
| **11** Ljud | ✅ Elevvyn skapade 0 AudioContext och 0 uppspelningar under en hel match. Projektorns ljudkö är inte omprovad här (#559 + enhetstester) |
| **12** Reducerad rörelse | ✅ I finalen fanns 0 translate/scale-animationer och ingen konfetti, bara toningar. All information syns. [p11](qa-snilleblixt-561/p11-pallplats-delad-andra-reducerad-rorelse-1280-demo.jpg) |
| **13** Klassmatchen | ✅ Se nedan |

## Regression: Klassmatchen (test 2, designtest 13, test 1)

- Lobby, nämnare, Radera (bekräftelse), STARTA MATCH, Raketrace (120/20 = 6,0 mot 90/22 = 4,1), Statistik, Dragkamp och Trollkarlsduellen fungerar. Vinnarskärmen visar "VINNARE – 4B!". Skärmdumpar k01–k05.
- 4B:s klasskassa fick +100 (`kassaHistorik/live-…`) och pokalen `live-vinst-…`. Inga elevkvitton skapades (Klassmatchen har inga pluggmynt per elev).
- **Jämfört med `origin/main` på samma session:** Vinnarskärmens DOM-struktur har samma hash. Texten är identisk utom ljudknappen ("Klicka för ljud" / "Ljud på"), som speglar webbläsarens tillstånd och inte koden. Trollkarlsduellens text är identisk (runpartiklarna varierar).
- **Test 1:** Historikdetaljen för en gammal session utan `format` har samma hash i main och grenen.

## Fynd till leaden

| # | Allvar | Fynd |
| --- | --- | --- |
| **F1** | Bugg (prio 1, designtest 10) | **Omladdning efter eller under finalen ger en tom pall.** Pallen visar tre tomma steg utan klassrad och fylls aldrig i. Orsak: `sb-studio.js:215` anropar `final.showResult(finalData())` vid första renderingen, innan `watchScores` har levererat sbScores (`koppling.scores = []`). Därefter sätts `sb-resultat`, så resultatet ritas aldrig om. Förslag: rita om `showResult` när poängen ändras och scenen är final, eller vänta på första poängsnapshoten. Data påverkas inte: result, utbetalning och saldo stämmer. [F1](qa-snilleblixt-561/F1-omladdning-efter-final-tom-pall-1920.jpg) |
| F2 | Mindre (designspec §5.8) | Elevens **lobby** visar bara "Du är med! Väntar på start …" utan elevens egen avatar i mitten. Avataren syns bara i sidomenyn. Läget "Har svarat" och finalen har avatar. [e01](qa-snilleblixt-561/e01-lobby-chromebook.jpg) |
| F3 | Mindre (demo) | Demopanelen har kvar knapparna **Topplista**, **Ledningsbyte** och **Klättring 4 → 1**. De gör ingenting synligt längre, eftersom funktionerna togs bort på Elias begäran. Ta bort dem eller märk dem som borttagna |

**Observationer (inte buggar)**

- **O1:** Demosidan laddar `firebase-config.js` (via projektorn). Är man inloggad i appen i samma webbläsare försöker Auth slå upp kontot (`accounts:lookup`). Spärren blockerar det och panelen visar "1 BLOCKERADE" i rött, vilket kan oroa. Ingen Firestore-läsning eller -skrivning sker.
- **O2:** Mitt QA-skript behövde importera `modes/index.js` före `createLiveSession`, annars stöds inte "choice". Lärarformuläret laddar alltid registret, så det påverkar inte appen.
- Två lärarklienter gav ofarliga `permission-denied`-loggar i konsolen för den förlorande transaktionen, vilket är väntat (#559).

## Skärmdumpar

Alla bilder är JPEG i [`qa-snilleblixt-561/`](qa-snilleblixt-561/). Emoji visas som rutor eftersom testwebbläsaren saknar färg-emoji. "-demo" betyder ur demoläget med 30 påhittade elever, övriga är riktiga emulatorkörningar med 24–30 elever med kläder.

| Vy | 1920×1080 | 1280×720 |
| --- | --- | --- |
| Lobby (24 elever) | [p01](qa-snilleblixt-561/p01-lobby-1920.jpg) | [p01](qa-snilleblixt-561/p01-lobby-1280.jpg) |
| 3-2-1 | – | [p02](qa-snilleblixt-561/p02-nedrakning-1280.jpg) |
| Fråga, flerval | [p03](qa-snilleblixt-561/p03-fraga-flerval-1920.jpg) · [p03b](qa-snilleblixt-561/p03b-fraga2-flerval-1920.jpg) | [p03](qa-snilleblixt-561/p03-fraga-flerval-1280.jpg) |
| Avslöjande, flerval | [p04](qa-snilleblixt-561/p04-avslojande-flerval-1920.jpg) | [p04](qa-snilleblixt-561/p04-avslojande-flerval-1280.jpg) |
| Fråga, skriv själv | [p09 (demo, 30)](qa-snilleblixt-561/p09-fraga-skriv-30-1920-demo.jpg) | [p09 (28)](qa-snilleblixt-561/p09-fraga-skriv-28-1280.jpg) |
| Avslöjande, skriv själv | [p10 (demo)](qa-snilleblixt-561/p10-avslojande-skriv-1920-demo.jpg) | [p10 – 7b](qa-snilleblixt-561/p10-avslojande-skriv-7b-1280.jpg) |
| Mellanbild (ersätter topplistan) | [p05](qa-snilleblixt-561/p05-mellanbild-1920.jpg) | [p05](qa-snilleblixt-561/p05-mellanbild-1280.jpg) |
| Statistik (anonym) | [p06](qa-snilleblixt-561/p06-statistik-1920.jpg) | [p06 (demo)](qa-snilleblixt-561/p06-statistik-1280-demo.jpg) |
| Pallplats | [p08](qa-snilleblixt-561/p08-pallplats-resultat-1920.jpg) | [p07 uppbyggnad](qa-snilleblixt-561/p07-pallplats-uppbyggnad-1280.jpg) · [p08](qa-snilleblixt-561/p08-pallplats-resultat-1280.jpg) · [p11 delad 2:a, reducerad rörelse](qa-snilleblixt-561/p11-pallplats-delad-andra-reducerad-rorelse-1280-demo.jpg) · [x01 fyra delar 1:a](qa-snilleblixt-561/x01-avbruten-fyra-delar-forsta-1280.jpg) |

| Elevvy | Chromebook 1366×768 | Surfplatta 820×1180 |
| --- | --- | --- |
| Lobby | [e01](qa-snilleblixt-561/e01-lobby-chromebook.jpg) | – |
| Fråga, skriv själv | [e02](qa-snilleblixt-561/e02-fraga-skriv-chromebook.jpg) | [e05](qa-snilleblixt-561/e05-fraga-skriv-surfplatta.jpg) |
| Har svarat (skriv / flerval via tangent 3) | [e03](qa-snilleblixt-561/e03-har-svarat-skriv-chromebook.jpg) · [e10](qa-snilleblixt-561/e10-har-svarat-flerval-tangent3-chromebook.jpg) | – |
| Fråga, flerval utan frågetext | [e09](qa-snilleblixt-561/e09-fraga-flerval-utan-fragetext-chromebook.jpg) | – |
| Avslöjande rätt / fel | [e04](qa-snilleblixt-561/e04-avslojande-ratt-chromebook.jpg) | [e06](qa-snilleblixt-561/e06-avslojande-fel-surfplatta.jpg) |
| Final 20i | [e07](qa-snilleblixt-561/e07-final-20i-chromebook.jpg) | [e08](qa-snilleblixt-561/e08-final-20i-surfplatta.jpg) |

Klassmatchen: [k01 Raketrace](qa-snilleblixt-561/k01-raketrace-1280.jpg) · [k02 Statistik](qa-snilleblixt-561/k02-statistik-1280.jpg) · [k03 Dragkamp](qa-snilleblixt-561/k03-dragkamp-1280.jpg) · [k04 Trollkarlsduellen](qa-snilleblixt-561/k04-trollkarlsduellen-1280.jpg) · [k05 vinnare](qa-snilleblixt-561/k05-vinnare-trollkarl-1280.jpg)

## Klickguide för Elias: se designen snabbast i demoläget

Demot behöver ingen inloggning och ingen emulator. Det skriver aldrig något.

1. Öppna `preview-snilleblixt-demo.html` från sajtens rot, lokalt eller i förhandsvisningen.
2. Panelen nere till vänster är demopanelen. Studion fyller resten av skärmen. Tryck **⛶ Fullskärm** för projektorkänsla.
3. **Lobbyn:** "Tom lobby" → "+30 elever ansluter" (avatarerna poppar upp med kläder). Tryck **⚡ STARTA** i studion.
4. **Frågan:** "Fråga 4 pågår". Byt svarssätt med 🔘 Flerval / ✍️ Skriv själv. "Tid snart slut" visar den röda nedräkningen.
5. **Avslöjandet:** "Avslöja nu". Vid Skriv själv: "Test 7b" ger 56 och de vanligaste felsvaren. Därefter NÄSTA FRÅGA i studion.
6. **Statistik:** fliken 📊 Statistik överst.
7. **Pallplatsen:** "Hoppa till pallplats", "Delad 2:a" eller "Oavgjort om 1:a".
8. **Tillgänglighet:** "Reducerad rörelse" (följer med till pallen). "Frys tiden" låser nedräkningen för skärmdumpar.

Hoppa över knapparna Topplista, Ledningsbyte och Klättring. De gör ingenting längre (F3).

## Köra om

```bash
JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-snilleblixt-preview.sh          # emulator + proxy :8565
E="FIRESTORE_EMULATOR_HOST=127.0.0.1:8564 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9564 GCLOUD_PROJECT=pluggportalen-so-2026"
env $E node admin/qa-snilleblixt-slut-seed.mjs                         # kläder i projektionen
# skapa sessionen i appen (eller admin/qa-sb561-skapa.mjs), sedan:
env $E node admin/qa-snilleblixt-slut-kontroll.mjs saldo <sid>
env $E node admin/qa-snilleblixt-slut-kontroll.mjs elever <sid> 24 A    # (B: fraga78 först; C: utoka 50, --b01 rätt)
env $E QA_UID=rasmus QA_ROLL=larare node --import ./admin/qa-node-app-loader.mjs \
  admin/qa-snilleblixt-larare.mjs <sid> --nasta 7000 --pall [--start]
env $E node admin/qa-snilleblixt-slut-verifiera.mjs <sid> A
```
