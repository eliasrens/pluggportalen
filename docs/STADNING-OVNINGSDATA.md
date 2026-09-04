# Städning av redan inmatad övningsdata (läsförståelse m.m.)

**Datum:** 2026-09-03
**Databas:** Firestore `pluggportalen-so-2026` `(default)`, `subjects/*/areas/*`
**Kontrakt:** `src/validate.js` (samma regler som lärarens JSON-inklistring)
**Granskningsverktyg:** `seed/audit-areas.mjs` (read-only; kör `node seed/audit-areas.mjs`)

## Vad som granskades

Hela innehållsträdet inventerades: **1 ämne** (`so` – SO) med **2 arbetsområden**.
Varje arbetsområde kördes genom `validateArea()` från `src/validate.js`, plus
heuristiska kontroller för:

- läsförståelsefrågor vars text förutsätter en synlig källtext ("enligt texten",
  "i stycket ovan", "i materialet" …) men som saknar per-fråga-`passage`,
- tomma svarsalternativ,
- dubblerade svarsalternativ.

Facit (`answerIndex`) mot alternativ + förklaring granskades manuellt för samtliga
30 frågor.

## Resultat

| Arbetsområde | Texter | Frågor | Par | `validate.js` | Läsförståelse | Flaggor |
|---|---|---|---|---|---|---|
| `subjects/so/areas/valet-och-demokrati-stort` ("Valet och demokrati") | 20 | 25 | 25 | ✅ OK | JA (passage per fråga) | inga |
| `subjects/so/areas/vikingatiden` ("Vikingatiden") | 3 | 5 | 6 | ✅ OK | JA (passage per fråga) | inga |

- **Rättade poster:** 0 – ingen post behövde ändras.
- **Flaggade för manuell åtgärd:** 0.

## Slutsats

All redan inmatad övningsdata följer redan läsförståelse-kontraktet från issue #1:
**varje** fråga i båda arbetsområdena har en egen, självbärande `passage`, och
båda dokumenten validerar rent mot `src/validate.js`. Det finns **inga**
läsförståelsefrågor som hänvisar till en osynlig källtext, inga tomma eller
dubblerade svarsalternativ, och samtliga 30 facit stämmer mot sina alternativ och
förklaringar.

Inga skrivningar gjordes mot live-Firestore (granskningen är read-only).
Dokumenten skrevs senast om 2026-09-01, dvs. efter att #1 landade – datan är alltså
redan i linje med det nya kontraktet.

## Om ny data flaggas i framtiden

`seed/audit-areas.mjs` kan köras när som helst för att verifiera hela innehållet.
Om en fråga hänvisar till en källtext som saknas och texten inte går att härleda
(t.ex. ur en gammal `texts`-array) ska posten **flaggas till läraren – inte gissas
fram**, i enlighet med issue-beskrivningen.
