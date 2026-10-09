# Snilleblixten – TV-studion på projektorn (#559)

Skärmdumparna är tagna ur `preview-snilleblixt-studio.html`, som kör låtsasdata med 30 elever med kläder (avatarerna kommer ur en fejkad klassprojektion). Bilderna finns i 1920×1080 (`-1920`) och 1280×720 (`-1280`). Emoji visas som rutor eftersom testwebbläsaren saknar ett typsnitt för färg-emoji. I en vanlig webbläsare syns de.

| Fil | Vy |
| --- | --- |
| 01-lobby | Lobbyn: logga, klass, "30 elever i studion", STARTA och publiken |
| 02-fraga-flerval | Fråga 4 av 10 med cirkulär nedräkning, 2×2-alternativ med färg och form, publiken med bockar och "N av 30 har svarat" |
| 03-spanning | De sista 5 sekunderna: nedräkningen är röd och pulserar |
| 04-avslojande-flerval | Rätt alternativ tänt, felalternativen tonade, staplar med antal |
| 05a-fraga-skriv / 05-avslojande-skriv | Skriv själv, test 7b (7 × 8): 56 rätt, andel rätt, "54 (5 st) · 64 (3 st)" utan namn |
| 06-topplista | Topp 5 som avatarer med namn och poäng, 🔥 vid flera rätt i rad |
| 07-statistik | Statistikvyn: alla elever, poäng, rätt, andel rätt, tid kvar och andel rätt per fråga |
| 08-pallplats | Finalen: vinnaren jublar under strålkastaren, konfetti, pluggmyntpris under varje steg |
| 09-resultat-delad | Resultatskärmen med delad 2:a på samma pallsteg och hela klassens topplista |

## Verifierat i webbläsare

Alla tester är gröna.

- **Förhandsvisningen:**
  - Funktionstest 4: "0 av 30" räknar upp.
  - 7b, 9 och 12 (delad placering).
  - Designtest 4: 30 avatarer i 1280×720, inget döljs.
  - Designtest 5: plats 4 → 1 med FLIP och banderollen "Ny ledare" exakt en gång.
  - Designtest 8 och 9.
  - Designtest 11: 30 svar på 1,2 s gav bara några få bock-toner.
  - Designtest 12: reducerad rörelse, 0 animationer med förflyttning, ingen konfetti, stilla strålkastare.
  - Omladdning mitt i spelet och efter finalen: finalen spelas inte om.
  - Elevskärmsfönstret följer vyvalet och visar inga kontroller.
- **Riktiga appen mot emulatorn** (`admin/qa-snilleblixt-preview.sh` med elevsimulatorn från #558):
  - Session med 19 elever.
  - 3-2-1 leder till att fråga 1 öppnas automatiskt.
  - Alla svarar: frågan stängs och avslöjas.
  - NÄSTA FRÅGA, Hoppa över, Avsluta frågan nu och Avsluta spelet (med bekräftelse) fungerar.
  - Pallplatsen spelas, sedan skrivs result.
  - Efter omladdning visas resultatet direkt.
- **Designtest 13 (Klassmatchen):** Raketrace, Statistik, Dragkamp, Trollkarlsduellen, timern och Avsluta fungerar som förut. Vinnarskärmen visas även när ett vyval från Snilleblixten finns sparat.
- **Test 10 (två lärare):** täcks av ett enhetstest (`test/live-snilleblixt-studio.test.js`) och av transaktionerna och reglerna från #556.

## Designbeslut

- **Tidslinje efter en fråga:** först avslöjandet i 5,5 s, sedan glider topplistan in. Listan visar först ställningen före frågan och klättrar sedan till den nya. Tidpunkten räknas ur serverstämpeln `closedAt`, så kontrollpanelen och elevskärmen visar samma sak samtidigt.
- **Lärarautomatik:** projektorn öppnar själv fråga 1 efter KÖR!, stänger frågan när tiden är ute eller alla har svarat och avslöjar efter trumvirveln. Varje steg är en transaktion, så flera fönster ger ändå exakt ett steg.
- **Två vyer:** ⚡ Studion och 📊 Statistik. Båda har egna lärarkontroller, så spelet går vidare även när statistiken visas. Pallplatsen spelas i Studion.
- **🔥 + antal** visar bara rätt svar i rad. Spelet har ingen svitbonus.
- **Textstorlek:** namnen under publikens avatarer och statistiktabellen med 30 elever är under 28 px i 1280×720. Allt annat viktigt (fråga, alternativ, nedräkning, "N av M har svarat", topplistan och pallen) är minst 28 px.
- **Ljud:** syntetiserat med Web Audio i den befintliga ljudkön, inga ljudfiler. Nya ljud är `tick` (sista 10 s) och `tickSnabb` (sista 5 s).
