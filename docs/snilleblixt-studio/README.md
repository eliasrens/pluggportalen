# Snilleblixten – TV-studion på projektorn (#559)

Skärmdumparna är tagna ur `preview/preview-snilleblixt-studio.html`. Förhandsvisningen kör låtsasdata med 30 elever som har kläder på sig, och avatarerna kommer ur en fejkad klassprojektion. Bilderna finns i 1920×1080 (`-1920`) och 1280×720 (`-1280`). Emoji visas som rutor eftersom testwebbläsaren saknar ett typsnitt för färg-emoji. I en vanlig webbläsare syns de.

## Ingen uthängning (Elias, 2026-10-10)

Projektorn får inte hänga ut elever. Hela klassen ska inte kunna se hur många rätt varje elev hade. Därför gäller detta:

- **Ingen topplista mellan frågorna.** Efter avslöjandet visas en neutral mellanbild, till exempel "✔ Fråga 4 av 10 klar · 15 av 24 svarade rätt · Nästa fråga kommer snart …". Mellanbilden visar inga namn.
- **Ingen ledarbanderoll, ingen klättring och inga poäng per elev.** Regin får aldrig någon ställning mellan frågorna.
- **Publiken visar vem som har svarat, aldrig vem som svarade rätt.** Eleverna med rätt svar gör alltså ingen Glad-reaktion vid avslöjandet.
- **Pallen (topp 3) är den enda namnlistan.** Resultatskärmen efter pallen visar pallen och en anonym rad, till exempel "Hela klassen: 62 % rätt svar". Den visar inte hela klassens topplista.
- **📊 Statistik är anonym.** Den visar andel rätt per fråga och klassens totala andel rätt. Den visar också svarsfördelningen för frågan, men först efter avslöjandet så att den inte påverkar svaren. Dessutom visas "N av M har svarat" och tid kvar. Statistiken visar inga namn, poäng eller rätt per elev.
- **Hela listan per elev finns bara i lärarens historik (#560).** Elevens egen placering och poäng på den egna skärmen (#558) finns kvar.

## Skärmdumpar

| Fil | Vy |
| --- | --- |
| 01-lobby | Lobbyn: logga, klass, "30 elever i studion", STARTA och publiken |
| 02-fraga-flerval | Fråga 4 av 10 med cirkulär nedräkning, 2×2-alternativ med färg och form, och publiken med bockar för "har svarat" |
| 03-spanning | De sista 5 sekunderna: nedräkningen är röd och pulserar |
| 04-avslojande-flerval | Rätt alternativ är tänt, felalternativen är tonade och staplarna visar antal svar |
| 05a-fraga-skriv / 05-avslojande-skriv | Skriv själv, test 7b (7 × 8): 56 rätt, andel rätt och "54 (5 st) · 64 (3 st)" utan namn |
| 08-pallplats | Finalen: vinnaren jublar under strålkastaren, konfetti och pluggmyntpris under varje steg |
| 06-mellanbild | Efter avslöjandet visas "✔ Fråga 4 av 10 klar · 19 av 28 svarade rätt · Nästa fråga kommer snart …" utan namn |
| 07-statistik-anonym | Statistiken visar svarsfördelning med färg och form (rätt alternativ markerat), andel rätt per fråga och "Hela klassen: 63 % rätt svar". Inga namn |
| 09-resultat-topp3 | Resultatet visar bara pallen (delad 2:a på samma steg) och raden "Hela klassen: 63 % rätt svar – bra kämpat!" |

**Elevskärmen (avslöjande och slutskärm med texterna "bakom", "leder" och topp 3) saknar skärmdumpar.** Koden och node-testerna är klara. Försöken att ta bilder mot emulatorn avbröts: emulatorn (Java) och testwebbläsaren stängdes tre gånger utifrån med SIGTERM efter ungefär 2 minuter, troligen av en minnesvakt eftersom ledigt RAM var under 1 GB.

## Elevskärmen: ingen placering som nummer (Elias, 2026-10-10)

- Avslöjandet efter varje fråga visar elevens läge i förhållande till eleven närmast framför, aldrig en plats:
  - "X poäng bakom <Namn>", där Namn är eleven närmast framför. Om flera har samma poäng visas en av dem, i namnordning.
  - "Du leder! ⚡" för den som leder ensam.
  - "Lika med <Namn>" när någon annan har exakt samma poäng.
  - "Lika med <Namn> – ni leder! ⚡" när flera delar ledningen.
- Slutskärmen visar pallplatsen ("🥈 Du kom 2:a!") bara för topp 3, även vid delad placering. Alla andra får rubriken "⚡ Bra kämpat!" och raden "X poäng bakom <Namn>". Pluggmynt-raderna finns kvar.
- Poängen räknas ur sbScores, som eleven redan får läsa. Förnamnen hämtas ur klassprojektionen, som är samma cachade läsning som avatarerna. Inga regler har ändrats. Om ett namn saknas står det "en klasskompis".
- Testerna i `test/live-snilleblixt-elev.test.js` täcker fallen ledare, mitten, sist (ingen placering syns), lika poäng, delad ledning och topp 3 på slutskärmen.

## Verifierat

- **Före ändringen, i webbläsare.** Följande verifierades:
  - Funktionstest 4: "0 av 30" räknar upp.
  - Test 7b och test 9.
  - Test 12: delad placering på samma pallsteg.
  - Designtest 4: 30 avatarer i 1280×720.
  - Designtest 8, 9, 11 och 12.
  - Omladdning visar inget en gång till.
  - Elevskärmsfönstret fungerar.
  - Designtest 13: Klassmatchen är oförändrad.
  - Den riktiga appen mot emulatorn tillsammans med elevvyn (#558).
- **Gäller inte längre:**
  - Designtest 5 (klättring med "Ny ledare") är medvetet borttaget.
  - Delar av designtest 8–9 som gällde resultatlistan har ersatts av att pallen är den enda namnlistan.
- **Efter ändringen.** Node-testerna är gröna, bland annat `test/live-snilleblixt-studio.test.js` med mellanscenen och den anonyma klassummeringen. Webbläsarkontrollen görs när leaden ger klartecken.

## Designbeslut

- **Tidslinje efter en fråga:** avslöjandet visas i 5,5 s, sedan mellanbilden. Mellanbilden står kvar tills läraren trycker NÄSTA FRÅGA eller "🏆 Till pallen!". Tidpunkten räknas ur serverstämpeln `closedAt`, så kontrollpanelen och elevskärmen byter samtidigt.
- **Lärarautomatik:** projektorn öppnar själv fråga 1 efter KÖR!. Den stänger frågan när tiden är ute eller alla har svarat, och avslöjar efter trumvirveln. Varje steg är en transaktion.
- **Två vyer:** ⚡ Studion och 📊 Statistik. Båda har egna lärarkontroller. Pallplatsen spelas i Studion.
- **Text:** namnen under publikens avatarer är under 28 px i 1280×720. Allt annat viktigt är minst 28 px.
- **Ljud:** syntetiserat med Web Audio via den befintliga ljudkön. Nya ljud är `tick` och `tickSnabb`. Swoosh används inte längre, eftersom det inte finns något ledarbyte på projektorn.
