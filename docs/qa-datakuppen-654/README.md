# QA #654 – Datakuppen D: projektorn "Nätverket"

Skärmdumpar från demosidan `preview/preview-datakuppen-demo.html` (demodata i minnet,
inga Firebase-anrop). Varje scen i **1920×1080** och **1280×720** med **1, 5 och 25 elever**:
`<scen>-<antal>-<bredd>x<höjd>.jpg`.

| Scen | Vad bilden visar |
| --- | --- |
| `lobby-*` | Eleverna "loggar in" vid noder (`> namn`), säkerhetstipset roterar, STARTA. Tyst lobby. |
| `spel-*` | Fredad översta rad (logga, timer, totalruta med mätare), topp 10 vid serverskåp (lysdioder), terminalen med 4 rader. |
| `hack-*` | Hack-ljuslinjen mitt i animationen (pausad vid ~0,7 s). Saknas för 1 elev – ingen att hacka. |
| `milstolpe-*` | Totalrutan firar (puls, mätaren fylls, ettor/nollor runt rutan) – inget över timern. |
| `final-*` | "🏆 Datakuppen – Prispall", centrerad pall utan tomma platser, MB + pluggmynt under varje plats, "Tillsammans: … MB", säkerhetstips. |
| `statistik-*` | Klassens siffror inkl. hackförsök och andel lyckade (hela klassen) + exakt ställning. |

## Mätt i webbläsaren (headless Chrome, samma sida)

- Hack-linjens överkant 224 px, den fredade raden slutar 183 px (1280×720, 25 elever). Linjen ligger i golvet,
  under serverplatserna; skyltarna har egen platta.
- Milstolpens konfetti: vänsterkant ≥ 936 px, timerns högerkant 785 px (1280×720) – aldrig över timern.
- Lobbyn 25 elever 1280×720: tipset slutar 490 px, de inloggade börjar 538 px.
- Terminalen: 0 rader med "…" (långa rader krymps lite i stället).
- Statistiken 25 elever: 0 avkortade namn i 1280×720.
- Reducerad rörelse: hack-linjen = bara opacitet, ingen konfetti, inga datapaket, totalrutan tonar (`dknk-fira-lugn`).
- Visa namn av: terminalen "> Någon hackade en klasskamrat: +16 MB", inga avatarer.
- Musiken: `hackerlaget-dark-loop.ogg` avkodas i Chrome (85,7 s, 44,1 kHz, stereo), level 0,3, lobby 0.
- Enda "4B" på finalskärmen är lärarens kontrollrad i projektorskalet (som i Guldrushen), inte finalvyn.

Emoji: headless-Chrome saknar emoji-typsnitt. Demosidan lägger `qa-fonts/NotoColorEmoji.ttf`
(finns inte i repot) sist i Datakuppens typsnittslistor, bara på demosidan.
