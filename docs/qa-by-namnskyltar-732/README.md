# #732 – namnskyltar i klassbyn

## Orsak
Inte ny. By-layouten (`src/varld-by.js`) och by-CSS:en är oförändrade sedan före epic #689
(f42a2bf); #689 ändrade bara färger (`sz()`). Mätningen nedan ger samma täckta skyltar på f42a2bf
som på main. Säsong, löv, pumpor, kostymer och sidomenyn påverkar inte radhöjden.

Själva felet: varje `.by-tomt` hade eget `z-index` + `transform` och blev en egen
staplingskontext. Skylten (barn till tomten) kunde därför aldrig hamna över nästa rads tomt, som
har högre z-index. Raderna sitter tätast i byar **med Klasscentrum** (sedan #480 tar centret
extra höjd, `KC_EXTRA`), därav "tightare än förut".
På mobil krockade dessutom grannskyltar i sidled, eftersom cellerna är smalare än namnen.

## Fix
- Tomten är ingen staplingskontext längre: `left`/`top` = hörnet, ingen transform och ingen
  z-index. Huset (`svg`) staplas efter markpunkten via `--by-z`.
- Skylt, "Du!", 🔒 och låst-bubblan ligger på `--z-by-skylt` (1100), över alla hus och all dekor
  (z = markpunkt-y·10 ≤ 1000).
- Smal by (container ≤ 760 px): mindre skylt, och varannan kolumns skylt hänger ett steg lägre.

## Mätning
`preview/preview-by-namnskyltar-732.html?elever=N&skarm=1366x768|1920x1080|1280x720|mobil&kc=0|1&sasong=sommar|host|halloween`
(season.js stubbad via importmap, `preview/by-namnskyltar-732/season.js`)
räknar skyltar som täcks av andra element (`elementFromPoint`, 9 punkter/skylt).
3/10/15/20/25/30 elever × 4 skärmar × med/utan Klasscentrum = 48 fall.

| | fall med täckta skyltar |
|---|---|
| main före fixen | 23 av 48 |
| f42a2bf (före #689), 12 stickprov (10/20/30 elever, 1366 + mobil, med/utan KC) | samma skyltar som main |
| efter fixen | 0 av 48 |

## Det som höst/Halloween tillförde (andra varvet, Elias: "bra innan halloweentemat")
Avstånd och radhöjd är oförändrade (se ovan). Det som är nytt sedan #689 och som syns över
namnen:
- **Fallande löv** (`.sz-lov-lager`, #691) låg som scen-overlay (z 11) över HELA by-lagret, och
  därmed över skyltarna. Skärmdumpens blad över "Wilma" är ett sådant. Fix: i by- och
  grannby-nivån döljs scenens löv, och byn får egna löv INNE i by-lagret (`mountVarldSasong`
  monterar dem, `mountByScen` bevarar dem vid omritning). De ligger på `--z-by-lov` (1050),
  alltså över hus och dekor men under skyltarna.
- **Pumpor vid lyktstolparna och lövhögar vid träden** (`art-by-dekor.js`) är by-dekor med
  z = markpunkt-y·10 ≤ 1000. De ligger nu alltid under skyltarna (1100). Placeringen är
  oförändrad, och `byDekor` ställer redan ingen dekor på hus eller väg.

Mätsidan tar med dekor och löv (pointer-events slås på under mätningen) och mäter 12 gånger
under 3,6 s eftersom löven rör sig. Med scenens gamla löv: 1–5 täckta namn per by (Halloween,
1366, 10/20/30 elever). Efter: **0 av 144** (sommar/höst/Halloween × 48 fall).
