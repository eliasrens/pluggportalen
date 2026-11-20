# Handoff – #874 Matchdagen 4 (Coder 2 → next)

## Goal
Real-time friendlies (spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §11). Done = engine + sync + callables + rules + client
Vänskap tab + docs/report, suites green, report to `874-issue-lead`. No deploy/merge.

## Done (branch coder/issue-874-…, pushed, HEAD 540d286d)
- Coder 1: 6324fe52 engine, cbb97dea sync+bank, 1de95b3c callables, 3349190e rules (see .scratch/handoff-874-coder.md).
- a63691a7 client: src/matchdagen/vanskap/{md-vanskap-moln,md-vy-vanskap,md-vanskap-spel}.js, Vänskap tab (md-app, only with
  deps.vanskap from page-matchdagen), md-svar async ratta + ute(), mdSvar `svar: null` = time out (server + test), vakt
  mirrors server kassa/inbordes into S.K, teacher "(vänskapsmatch)" + inbördes, CSS 51-matchdagen-vanskap.css, vy tests.
- b37fcf70 callable e2e test/functions-matchdagen-vanskap-anrop.test.mjs, package.json test:rules/test:functions, proxy
  whitelist md*, admin/qa-matchdagen-874-preview.sh + seed MD_VANSKAP=1.
- 3a026fdf docs MATCHDAGEN §18, DATAMODELL, BEHORIGHETER (doc test green).
- de53269d review fixes H1/H2/M1–M4/L1/L2/L5 (foreground review agent on cfda7646..79ce4681).
- 47a64781 + 096527f2 + 540d286d report docs/QA-RAPPORT-matchdagen-etapp-4.md (margins, runs, screenshots
  docs/qa-matchdagen-4/01–12).

## Verified
- matchdagen node tests 360/0; behorigheter-doc 4/0; functions vanskap 19/0 (`bash .scratch/emu.sh functions,auth,firestore
  "node --test --test-concurrency=1 test/functions-matchdagen-vanskap*.test.mjs"`); margins fine (before/after/INB) in report:
  skapa 5→4, kop 22→21, kopFull 18→17, sasongKval 12→11, legend 13→12, legend49 11→10, kval 25→24; INB no extra cost.
- Two full matches in the app (3D, then ?2d=1) Alva 4a01 vs Bilal 4a02: challenge/accept, timeout resolution, halftime,
  server grading (Räkna "Rätt!"), end screens, kassa 600→800→1000 / 600→700→800 consistent after reload, inbördes shown.

## State
- Preview running: barista_serve port 8874 (`PORT=8874 bash admin/qa-matchdagen-874-preview.sh`) holds the emulator lock
  /tmp/pp-emulator.lock — stop it (barista_serve restart/close) before running any suite.
- Browser pages 46 (874-alva) and 47 (874-bilal) still open – close them.
- Unchecked: renaming the team after a friendly (sparaKarriar with mirrored inbordes) – my scripted form submit didn't fire;
  check by hand in Truppen (expect "Sparat!"; a denial would mean S.K.inbordes ≠ server's).

## Next steps
1. Close pages 46/47, stop the 8874 preview.
2. Check the rename after a friendly (above) – or leave to the Tester.
3. Re-run test/schack-*.test.js alone (1 timing fail under load, "högst ~1 s per drag" – unrelated).
4. Full suites (node --test, test:rules, test:functions) – or leave to Tester (OOM risk); update report "Körningar".
5. barista_done + SendMessage 874-issue-lead (HEAD sha, outcome, open questions: walkover kassa farming, per-student clock).

## Decisions (in report)
Both answer every phase; one question per shot; no choice = kort/tack; client clock ≤ tid from card shown, never past server
deadline − 1.5 s; `svar: null` = time out; walkover keeps score, loser 0 kr; both away → avbruten; lobby hides matches > 20 min;
pending challenge watched from other tabs (auto-switch to Vänskap on accept); vakt re-reads career once if match already ended.
