# Schackpusslen (#791, spec §13)

`matt-i-ett.json` (200 pussel "Matt i ett drag") och `matt-i-tva.json` (200 pussel "Matt i två drag")
är byggda av `admin/schack-pussel.mjs` och laddas **lat** av `src/schack/schack-pussel.js` (`fetch`
först när pusselvyn öppnas – aldrig statiskt importerade).

## Källan och licensen

- **Källa:** Lichess öppna pusseldatabas, <https://database.lichess.org/#puzzles>
  (`lichess_db_puzzle.csv.zst`, filen daterad 2026-10-02).
- **Licens:** **CC0 1.0** (allmän egendom) – fri att använda på en publik sajt, även utan
  namngivning. Licenstexten ligger i [`LICENSE`](LICENSE). Vi nämner ändå Lichess i pusselvyn.
- **Hämtad:** 2026-10-19 (fältet `hamtad` i JSON-filerna).
- Ingen rådata är incheckad – bara resultatet.

## Filtret

Skriptet strömmar filen (zstd-programmet, bara i `admin/`) och läser de första **2 000 000** raderna
(pusslen ligger i slumpmässig ordning efter `PuzzleId`, så det är ett slumpmässigt urval av hela
banken på ~5,8 miljoner). En rad blir kandidat när:

| Villkor | Matt i ett | Matt i två |
| --- | --- | --- |
| Tema (`Themes`) | `mateIn1` | `mateIn2` |
| Antal drag i `Moves` | 2 (motståndaren + eleven) | 4 (motståndaren + vit, svart, vit) |
| Rating | ≤ 1000 | ≤ 1100 |
| `RatingDeviation` (säkert rating) | ≤ 90 | ≤ 90 |
| `Popularity` | ≥ 80 | ≥ 80 |
| `NbPlays` | ≥ 300 | ≥ 300 |
| Vid draget efter motståndarens drag | vit | vit |

Kandidater: 19 565 (matt i ett) och 18 029 (matt i två). Lichess lägsta rating är ~400 och
medel ~1500 – alla pussel här är alltså lätta. Tusentals pussel ligger på 400–460, så de 200
valdes **jämnt över ratingen** (mål 400 → 1000 resp. 1100 i 200 steg, närmaste giltiga pussel
uppåt) och sorterades **lätt → svårt** (rating, sedan flest spelningar):

| Fil | Antal | Rating (först – mitten – sist) |
| --- | --- | --- |
| `matt-i-ett.json` | 200 | 399 – ~690 – 1000 |
| `matt-i-tva.json` | 200 | 399 – ~740 – 1100 |

**Bara vit vid draget.** Spec-texten är "Vit drar och gör matt i ett drag" och brädet står som i
partierna mot datorn (vit nederst). För 9–12-åringar är ett bräde som ibland är vänt och en text
som byter färg ett onödigt hinder; det finns tusentals vita pussel, så inget går förlorat.

## Normaliseringen

Lichess FEN är ställningen **före** motståndarens första drag, och det första draget i `Moves`
görs av motståndaren. Skriptet gör det draget, så varje pussel är:

```json
{ "id": "HiVCC", "fen": "<vit vid draget>", "senast": "d8d4", "losning": ["c1c8", "d4d8", "c8d8"], "rating": 399 }
```

- `fen` – ställningen där eleven (vit) är vid draget.
- `senast` – motståndarens drag som just gjordes (UCI); markeras som senaste draget på brädet.
- `losning` – UCI-drag: `[vitt]` (matt i ett) eller `[vitt, svart försvar, vitt]` (matt i två).
- `id` – Lichess PuzzleId (`https://lichess.org/training/<id>`).

## Kontrollen (chess.js, `src/schack/vendor/chess.js`)

- **Matt i ett:** lösningsdraget är lagligt och ger matt. Finns flera mattdrag räknar pusselvyn
  **varje drag som ger matt** som rätt.
- **Matt i två:** ingen matt i ett finns; alla tre dragen är lagliga och det andra vita draget
  ger matt; och lösningens första drag är det **enda** vita drag som tvingar fram matt i två
  (mot varje svart svar finns ett mattdrag) – annars tas pusslet bort. Andra vita draget: varje
  mattdrag är rätt.
- `test/schack-pussel.test.js` gör om kontrollen med en egen implementation (antal, sortering,
  lösningarna).

## Bygga om

Skriptet väljer båda sorterna först och skriver **inget** om någon fick färre än `--antal`
(avbruten nedladdning, för få rader) – då står den gamla banken kvar.

```sh
node admin/schack-pussel.mjs                        # strömmar från lichess.org (~2 min)
node admin/schack-pussel.mjs --fil lichess_db_puzzle.csv.zst --max-rader 3000000 --antal 200
```

Elevernas framsteg är numret på senast lösta pusslet – byggs banken om med en annan ordning
börjar eleverna på samma nummer i den nya listan.
