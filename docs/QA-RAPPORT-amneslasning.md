# QA-rapport Ämnesläsning (#675) – DELRAPPORT

Status: **ofullständig** (användningsgränsen nåddes mitt i QA). Gren: epic/mnesl-sning-… @ 7261f6c, origin/main (4540578) redan inmergad.

## Körda sviter (2026-10-13)
- `node --test` (alla enhetstester utom rules/functions/e2e): **2238/2238 gröna**.
- `npm run test:rules` (egen config, port 8675): **490/490 gröna**, inkl. firestore-rules-amneslasning*.

## Test 1–24 (belägg = automatiska tester, ej manuellt verifierade i UI än)
| Test | Status | Belägg |
| --- | --- | --- |
| 1–9 | ✅ | test/amneslasning-level.test.js |
| 10–13, 21 | ✅ | test/amneslasning-picker.test.js |
| 14–15 | ✅ | test/amneslasning-progress.test.js |
| 16–20 | ✅ | test/amneslasning-content.test.js |
| 22–23 | ✅ | test/amneslasning-teacher-stats.test.js |
| 24 | ✅ (enhet) | hela sviten grön; manuell regression Läsresan/Plugga `passage` ej gjord |

## Återstår
- Hela flödet i UI (prompt → AI-svar → elev läser → nivå → mynt → statistik).
- Manuell regression Läsresan/Plugga + bootgraf-kontroll.
- Skärmdumpar 1366×768 och 1920×1080 i docs/qa-amneslasning/.
- §3-frågan (vikta ämnestexter annorlunda?) och frågor till Elias.
