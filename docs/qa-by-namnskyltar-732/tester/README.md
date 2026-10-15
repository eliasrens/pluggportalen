# #732 – Testarens kontroll i riktiga appen (emulatorerna)

Emulatorer (auth + firestore) via `admin/qa-sasong-preview.sh`. Tre egna klasser med 10, 20 och 30
elever, med långa namn (Alexandra, Maximilian, Vilhelmina). Säsongen sattes med `admin/qa-sasong-satt.mjs`.
Grenen (port 8691) och main före fixen (32b0e0b, egen worktree, port 8692) kördes mot samma emulator.

Mätning: varje synlig `.by-namn`, 9 punkter per skylt med `elementFromPoint`. Under mätningen fick
alla scenelement `pointer-events:auto`, så att dekor också räknas. Löven räknades inte.
Mobil = 390×844.

## Resultat (antal täckta skyltar)

| Elever | Skärm | main sommar | gren sommar | gren höst + Halloween |
|---|---|---|---|---|
| 10 | 1920×1080 | 1 (dekor) | 0 | 0 |
| 10 | 1366×768 | 1 | 0 | 0 |
| 10 | 1280×720 | 2 | 0 | 0 |
| 10 | mobil | 7 | 2* | 2* |
| 20 | 1920×1080 | 2 | 0 | 0 |
| 20 | 1366×768 | 5 | 0 | 0 |
| 20 | 1280×720 | 5 | 0 | 0 |
| 20 | mobil | 16 | 1* | 1* |
| 30 | 1920×1080 | 4 | 0 | 0 |
| 30 | 1366×768 | 13 (13 i Halloween också) | 0 | 0 |
| 30 | 1280×720 | 14 | 0 | 0 |
| 30 | mobil | 26 | 5* | 5* |

\* Bara **skylt mot grannskylt**, 1–2 av 9 punkter i kanten, t.ex. "Vilhelmina" mot "Vincent".
Inga hus, ingen dekor. Alla namn går att läsa (se `efter-*-mobil.png`). Det händer med långa namn på 390 px.

Grannbyn (30 elever, Halloween, 1366): 0 täckta. Höst och Halloween ger samma täckning som sommar,
både på main och på grenen. Säsongen är alltså inte orsaken, vilket bekräftar Coderns analys.

## Funktion
- Klick på ett hus (Ella) öppnar `#/elev/kompis?id=…`. Skylten och huset träffar samma tomt.
- "Du!" sitter på exakt samma pixel som på main (623,285 i 1920). Att den svävar ovanför huset fanns redan före fixen.
- Enhetstester (alla utom rules/functions/e2e): 2424 pass, 0 fail. Bootgrafen: 107 (main 107).
