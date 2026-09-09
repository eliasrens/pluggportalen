# Äventyrsteman – motor↔tema-kontraktet

Den gemensamma äventyrsmotorn (`src/adventure/engine.js`, `startAdventure`) är
**temaoberoende**. Ett tema är **ren data + en handfull HTML/inline-SVG-strängar**
– ingen spellogik. Motorn läser bara fälten nedan; allt spelbeteende (rörelse,
kollision, frågor, progress, belöning, avatar, loop, städning) ägs av motorn.

> **Ett nytt tema = EN ny `themes/<x>.js`-fil** som exporterar ett config-objekt.
> Rör aldrig motorn för att lägga till en bana. Registrera temat i `THEMES`-tabellen
> (se `test-tema.js`) så en route kan välja det med `#/elev/aventyr?...&tema=<id>`.

## Fält motorn läser

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `id` | `string` | Unikt tema-id. Blir belöningsläget `"aventyr:<id>"` som går genom `awardExercise`/`showResult` – grind-trappan gäller (omspel ger mindre), och banan ger **1–3 stjärnor** (ur antal felförsök). |
| `namn` | `string` | Visningsnamn (intro-rubrik + speltitel). |
| `stamning` | `{ himmel, mark }` | Bakgrundsfärger på scenen (CSS-variabler `--adv-himmel` / `--adv-mark`). |
| `map` | `string[]` | ASCII-karta. Standardtecken: `#` hinder, `.` golv, `S` start, `?` frågestation, `M` mål. Blanksteg + utanför kartan = hinder. **Håll alla golvrutor sammanhängande.** |
| `legend` | `{ [char]: type }` | *Valfri.* Egen teckenuppsättning (skriver över `DEFAULT_LEGEND` i `grid.js`). Typer: `wall`, `floor`, `start`, `station`, `goal`, `void`. |
| `goal` | `number` | *Valfritt.* Antal rätt som krävs för att slutmålet ska dyka upp. Default = antal `?`-stationer på kartan. |
| `progressIcon` | `string` | Ikon i framstegsräknaren (`x / mål`). Används även som default-stationsmarkör. |
| `stationArt` | `() => htmlString` | *Valfri.* Grafik för en station (default = `progressIcon`). Kan vara emoji eller inline-SVG. |
| `goalArt` | `() => htmlString` | *Valfri.* Slutmålets grafik (default = `🏆`). |
| `tileArt` | `{ [type]: (tile) => htmlString }` | *Valfri.* Grafik per tiletyp (`floor`/`wall`/`void`/…). Utelämnas → motorn ritar enkla färgrutor via CSS. Följ stilguiden `art-style.js` (kontur `#3B3350`, palett) för SVG. |
| `avatarScale` | `number` | *Valfritt.* Avatarens `font-size` i `cqw` (procent av scenbredden). Default ≈ en rutstorlek. |
| `texter` | se nedan | Text-UI (alla valfria, motorn har fallbacks). |
| `questionKinds` | `string[]` | Frågekällor stationerna drar från: `"quiz"`, `"lasforstaelse"`, `"para"`. Adaptern (`question-adapter.js`) mappar dem mot områdets innehåll. |

### `texter`

| Nyckel | När den visas |
|--------|---------------|
| `intro` | På startskärmen innan banan börjar. |
| `stationPrompt` | Remsan när avataren står bredvid en station. |
| `stationTitle` | Rubrik i frågemodalen. |
| `goalPrompt` | Remsan när avataren står vid det framme-spawnade slutmålet. |
| `klart` | Inleder resultatraden på firande-skärmen. |

## Gemensamt (motorn) vs unikt (temat)

**Motorn** äger: rörelse, kollision, grid-tolkning, frågeadapter + frågemodal,
station-interaktion, progress, completion/belöning (1–3 stjärnor, grind-trappa),
avatar-rendering & gå-studs, rAF-loop med självstädning och `prefers-reduced-motion`.

**Temat** äger: kartan, tile-/objektgrafiken, slutmålet, stämning/färger,
namn/ikon och intro-/klart-texter.

## Minsta möjliga nya tema

```js
// src/adventure/themes/spokjakten.js
export const spokjaktenTheme = {
  id: "spokjakten",
  namn: "Spökjakten",
  stamning: { himmel: "#2A2440", mark: "#4A4466" },
  map: ["#######", "#S..?.#", "#.###.#", "#.?..M#", "#######"],
  progressIcon: "👻",
  goalArt: () => "🔮",
  texter: {
    intro: "Fånga kunskapen i det mörka slottet!",
    stationPrompt: "Ett spöke med en fråga! Tryck E för att svara.",
    stationTitle: "Spökfråga",
    goalPrompt: "Kristallkulan! Tryck E för att avsluta.",
    klart: "Du klarade Spökjakten!",
  },
  questionKinds: ["quiz", "para"],
};
```

Registrera det i `THEMES`-tabellen (`test-tema.js`) och starta med
`#/elev/aventyr?subj=<ämne>&area=<område>&tema=spokjakten`. Inget annat behövs –
motorn är oförändrad.
