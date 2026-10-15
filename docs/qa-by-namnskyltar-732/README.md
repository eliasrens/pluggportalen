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
`preview/preview-by-namnskyltar-732.html?elever=N&skarm=1366x768|1920x1080|1280x720|mobil&kc=0|1`
räknar skyltar som täcks av andra element (`elementFromPoint`, 9 punkter/skylt).
3/10/15/20/25/30 elever × 4 skärmar × med/utan Klasscentrum = 48 fall.

| | fall med täckta skyltar |
|---|---|
| main före fixen | 23 av 48 |
| f42a2bf (före #689), 12 stickprov (10/20/30 elever, 1366 + mobil, med/utan KC) | samma skyltar som main |
| efter fixen | 0 av 48 |

Fallande löv (`.sz-lov-lager`, scen-overlay) ritas fortfarande över hela scenen, men de är
tillfälliga och klickgenomsläppliga.
