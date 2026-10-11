# #621 – långa quiztexter i Live: före/efter

Skärmdumpar av den delade flervalskomponenten (`src/live/choice-answer.js`) i
Guldrushens och Snilleblixtens elevvy samt Snilleblixtens projektor (frågeschakt
+ 2×2). "fore" = `main` (dcbca68), "efter" = den här grenen.

| Fil | Vad |
| --- | --- |
| `*-1366-guldrushen-mult` | Chromebook, multiplikation – **oförändrad** |
| `*-1366-guldrushen-quiz` | Chromebook, lång quizfråga + långa alternativ |
| `*-1366-guldrushen-lastext` | Chromebook, samma fråga med lästext (#582) |
| `*-1366-snilleblixten-lastext` | Chromebook, Snilleblixten, vikingafrågan med lästext |
| `*-1024-guldrushen-mult` / `-lastext` | surfplatta 1024×768 |
| `efter-1024-snilleblixten-quiz` | surfplatta, Snilleblixten utan lästext |
| `*-1920-projektor-mult` / `-quiz` / `-lastext` | projektorn 1920×1080 |

## Så gjordes de

- Elevvyerna: `preview/preview-live-langtext.html?vy=gr|sb&fragor=mult|quiz|lastext&nr=0–3&panel=av`.
  Sidan har samma ram som appens elevsida i Live: sidomeny 264 px + `.container`
  max 880 px. Formatets riktiga CSS används, och spelytans mall är kopierad från `createStage`.
- Projektorn: `preview/preview-snilleblixt-demo.html?fas=fraga&fragor=quiz|lastext&nr=…`
  (ny parameter `fragor`, tiden fryst).
- Frågorna finns i `src/live/demo-quiz.js`.

## Kontroll (automatisk mätning i webbläsaren)

Mätningen gällde elevvyerna i 1366×768, 1024×768, 1920×1080 och 1280×720, med alla fyra
quizfrågor, med och utan lästext, samt multiplikation. Resultatet:

- ingen sidscroll
- alla fyra knappar, frågan och lästexten syns helt i fönstret
- inga ord bryts mitt i, kontrollerat per tecken med `Range.getClientRects`

Projektorn mättes i 1920×1080, 1366×768 och 1280×720. Kortet krockar varken med
klockan eller med raden "har svarat", och inga ord bryts.

Multiplikationen ger identiska mått före och efter för alla synliga element i Guldrushens
och Snilleblixtens elevvy (1366×768). På projektorn är teckenstorlekarna oförändrade:
fråga 108 px och alternativ 69 px.

Uppmätta storlekar efter fixen:

| Vy | Fråga (lang) | Alternativ (lang) | Lästext |
| --- | --- | --- | --- |
| Elev, Chromebook 1366×768 | 25 px | 24 px | 16 px |
| Elev, surfplatta 1024×768 | 22 px | 21 px | 14 px |
| Projektor 1920×1080 | 41–50 px | 32 px | 28 px |
