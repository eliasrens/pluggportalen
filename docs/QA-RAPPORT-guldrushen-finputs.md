# QA-rapport – Guldrushen finputs (epic #587, slut-QA #594)

Kört 2026-10-11 på epicgrenen `154f3a3` (#588–#593 sammanslagna).
Spec: UTVECKLINGSUPPDRAG_GULDRUSHEN_FINPUTS.md, avsnitten "Tester" och "Visuell kontroll".

Miljö:
- Emulatorer (functions + auth + firestore) via `admin/qa-guldrush-preview.sh` med `FN_SEKVENS=1`
  (FS 8596, proxy 8597), riggen `admin/qa-guldrush-elev.mjs`.
- Demosidan `preview/preview-guldrush-demo.html` för projektorvyn, finalen och musiken.
- En headless Chrome-flik. Skärmdumpar i `docs/qa-guldrush-594/`.

## Sammanfattning

UTKAST – fylls på under körningen.

## Sviter (test 14)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test` utom regler/functions/e2e) | ✅ 1617/1617 |
| `npm run test:rules` | ✅ 400/400 |
| `npm run test:functions` | ✅ 42/42 (sköld test 1–8 mot functions-emulatorn ingår) |
| `npm run test:e2e` | ✅ 5/5 |
| `npm run sync:guldrush` | ✅ kopiorna i `functions/guldrush/` identiska med `src/` (git diff tom) → en version av regeln |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | ✅ 107 filer, identisk lista före (58c01ed) och efter epicen |
| Test 26 `grep -r "🪙" src` | ✅ 0 träffar |
