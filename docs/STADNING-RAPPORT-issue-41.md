# Städ-rapport – issue #41 (död kod, onödigt lagrat & uppenbara buggar)

Audit av hela `src/`, `admin/`, `seed/`, `test/` + config. Nedan: (A) trygga
ändringar som redan gjorts i denna commit, och (B) misstänkt men osäkert som
bör beslutas i ledarepicen (behåller nuvarande beteende tills vidare).

## A. Tillämpade trygga ändringar

**Borttagen bevisligen oanvänd kod** (0 referenser i hela kodbasen – app, admin,
seed, test, html; verifierat med import-/referensgraf + syntaxkontroll + enhetstester):

| Fil | Borttaget | Notering |
|-----|-----------|----------|
| `src/data.js` | `spendCoins`, `getOwnedItems`, `addOwnedItem` | Ersatta av `buyItem()` (transaktion) resp. `getStudentData().ownedItems`. |
| `src/shop-items.js` | `WEARABLE_SLOTS`, `isHouseItem` | Ingen läsare; wear-slot läses direkt från item-objektet. |
| `src/art-hus-ute.js` | `husSkalInfo` | Aldrig anropad (`listHusSkal`/`husSkalPreview` täcker behovet). |
| `src/art-pet-sprites.js` | `isSpriteSpecies` | Aldrig anropad (`BY_ID` behålls – används på annat håll). |
| `docs/DATAMODELL.md` | – | Synkad så den inte längre listar de borttagna funktionerna. |

**Fixad uppenbar bugg (isolerad, utanför appens kritiska väg):**

- `admin/_shared.mjs` `parseArgs`: `a.slice(2).split("=")` splittade på *varje*
  `=` och destrukturerade bort allt efter det andra – dvs ett lösenord som
  innehåller `=` trunkerades tyst (t.ex. `--password=ab=cd` blev `ab`). Nu delas
  bara på första `=`. Påverkar `reset-student-password`, `set-teacher-claim`,
  `migrate-passwords`. Ingen beteendeändring för värden utan `=`.

## B. Misstänkt men osäkert – lämnat orört, rekommendation för beslut

1. **Grind-skydd betalar 80 % i stället för ~30 %** — `src/game-shared.js:124`
   ```js
   coins = Math.max(1, Math.round(baseCoins * 0.8));
   xp    = Math.max(1, Math.round(xp * 0.8));
   ```
   Tre oberoende kommentarer/dokument (`game-shared.js` docstring, `leveling.js`,
   `docs/DATAMODELL.md`) säger alla "~30 %". Med `0.8` är grind-skyddet i praktiken
   verkningslöst. **Rekommendation:** ändra `0.8` → `0.3`. Lämnat orört eftersom
   det ändrar spelekonomin (beteende) – bör bekräftas.

2. **Avatar-evolution: kvarleva från oavslutad epic** — `src/data-room.js`
   (`getEvolution`, `setEvolutionChoice`, re-exporterade i `data.js`) +
   `evolution: {}` i `defaultStudentData` (`src/data.js:89`). Ingen läsare/anropare
   finns, och den refererade `evolution.js` skapades aldrig. `evolution: {}` skrivs
   till varje nytt elevdokument utan att någonsin läsas ("onödigt lagrat").
   **Rekommendation:** ta bort funktionerna + fältet – men först bekräfta att ingen
   pågående epic tänker slutföra evolutionen. Datamodell-ändring → beslut i F.

3. **Tom `if`-gren (oavslutad order-tilldelning)** — `src/teacher-content.js:289`
   ```js
   if (typeof res.value.order !== "number" || res.value.order === 1) {
     // Behåll uttryckligt order om användaren angav ett annat än standard.
   }
   ```
   Tomt block; kommentaren antyder att nya arbetsområden skulle få nästa lediga
   `order` (`data.nextAreaOrder` finns) men logiken implementerades aldrig.
   **Rekommendation:** antingen implementera auto-order eller ta bort den döda
   grenen. Lämnad för att inte råka ändra sorteringsbeteende.

4. **Läckt `document`-keydown-lyssnare i placeringsläge** — `src/varld-rum-mat.js:78`
   `setPlacing(true)` fäster en capture-fas `keydown` på `document` som bara tas
   bort av `setPlacing(false)`. Lämnar man rumsscenen (t.ex. klick på "Plugga" i
   sidomenyn) medan Mysterymat-placering är aktiv, avregistreras den aldrig – den
   ackumuleras och håller den detacherade scenen vid liv. **Rekommendation:** gör
   `onKeyDown` självstädande (kontrollera `stage.isConnected`, som `rum-promenad.js`)
   eller fäst lyssnaren på `stage` i stället för `document`. Lämnad orörd eftersom
   den ligger i aktiv rums-/husvärld-kod (annan epic) och kräver livscykel-teardown.

### Övrigt (endast noteringar, ingen åtgärd)
- `src/varld-rum.js:143` `scheduleSavePets` läser `p.pos.x` utan `if (p.pos)`-vakt
  som `saveWalkPositions` har. Kastar inte i praktiken (alla husdjur får `pos` vid
  skapande/migrering) – latent inkonsekvens, ej live-bugg.
- `legacy`-migreringar i `data-pet.js`/`data-animals.js`/`pages-varld.js` är
  avsiktlig kompatibilitetskod (migrerar gammal datastruktur) – **ej** död kod.
- `preview-djur.html`, `design/husdjur-hem-2.0-prototyp.html`, `seed/seed.html` är
  fristående dev-/prototypverktyg (laddas inte av `index.html`) – behållna.
