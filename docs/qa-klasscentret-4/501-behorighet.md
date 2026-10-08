# #501 – Gästläge/behörighet i klienten + O1 + O3 + O4

Emulator (Firestore 8501, Auth 9501, proxy 8502), seeds `qa-klasscenter-by` → `-rum` → `-larare` → `qa-klasscentrum-shop seed`.

| Fall | Resultat | Bild |
|---|---|---|
| Hemmaelev kc01 (4A), egna byn | Verktyg synliga, drag på, ingen statusrad | `501-01-hemmaelev-verktyg.png` |
| Bockad elev kc03 (4A) | Verktyg dolda, `inredning-las`, "läraren har stängt av inredning" | `501-02-bockad-elev-laslage.png` |
| Gäst kd01 (4B) i 4A:s center via grannbyn | Verktyg dolda, låda tom, läsläge, "på besök"; pokal-hover visar rutan; tavlan öppnar panelen | `501-03-gast-pokal-hover.png`, `501-04-gast-tavla-oppen.png` |
| O1: `exp qa-kc 263` med rummet öppet | Rubrik "Nivå 2 Tält" → "Nivå 3 Träkoja", mätare "263 / 448 …" direkt, hallens tema ritas om | – |
| O4: `signOutCurrent()` + `signInStudent("kc03")` med kc01:s rum öppet | Rummet stängs direkt vid utloggningen (lagret tömt, nivå "by") | – |
| O4: riktiga "Logga ut"-knappen med rummet öppet | Rummet stängs, inloggningssidan visas | – |
| O4: byte av användare med shoppens Klasscentrum-flik öppen | Insamlingen stängs: "Du har bytt användare – öppna shoppen igen …" | – |
| Shoppen som kd01 | Bara egna klassen (4B), ingen klassväljare | – |
| O3 | Tavlan har `z-index: 1` över placerade saker (under saken som dras) | – |

Konsolen: 0 fel/varningar. Bootgraf: 110 filer, identisk med `../qa-klasscentret-3/bootgraf-bfs-499.txt` (`bootgraf-bfs-501.txt`).
Enhet 1147/1147, regler 254/254.
