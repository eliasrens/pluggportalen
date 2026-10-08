# Epic #516 – Läsresan 10 läsnivåer: worklog (lead)

Spec: `docs/spec-lasresan-10-nivaer.md`. Grenen innehåller även epic #482 (inmergad först, 41a671b) och ersätter därmed PR #517.

## Sub-issues (alla landade)
| # | Del | Resultat |
|---|---|---|
| #518 | A – omnumrering + konfig | Bank 1–7 → 4–10 (`level` +3, id:n oförändrade), tomma nivå 1–3, `LEVEL_MAX 10`, `START_LEVEL 4`, frågeantal per nivå |
| #519 | B – lat migrering + regler | `src/lasresan/level-scale.js`: nya fält `level10`/`pendingLevel10`/`lasresaStartLevel10`, gamla fält = spegel i gammal skala (gamla cachade klienter ofarliga). Regler tillåter båda |
| #520 | C – UI 1–10 + preview | Lärarvyer/statistik/startnivå 1–10, preview `admin/qa-lasresan-10-preview.sh` |
| #521–#523 | D1–D3 – 90 nya texter | 30 per nivå 1/2/3 (`lr-g1-`/`lr-g2-`/`lr-g3-`), byggda från `admin/lasresan-g{N}-*.mjs` |
| #524 | E – granskning | 14 fynd rättade, `docs/lasresan-10/GRANSKNING-niva-1-3.md` |
| #525 | F – slut-QA | Spec §5–§8 gröna, `docs/QA-RAPPORT-lasresan-10-nivaer.md`, klickguide `docs/preview-lasresan-10-nivaer.md` |

## Verifierat av lead före PR
- `origin/main` (d37a393) och #482-grenen är förfäder.
- 1211/1211 enhetstester, `validateBank` på 370 texter: 0 fel / 0 varningar.
- Regeltester (alla firestore-rules-filer) gröna mot emulatorn enligt B/F.

## Öppet för Elias
1. **Deploy av firestore.rules** krävs för validering av `lasresaStartLevel10` (klienten fungerar före deploy).
2. **F1 (ui-reader.js, 1 rad):** vid fel svar markeras rätt alternativ grönt (spec §4 "visa rätt svar"). Tidigare (#401) visades bara ❌. Bekräfta eller ta bort raden.
3. **Nivå 3 längre än nivå 4** (snitt 115 vs 98 ord) eftersom spec §2 säger 100–140 ord; meningslängd lika (6,8). Rapporten föreslår 90–110 ord om jämnare stegring önskas.
