# Handoff – #874 Matchdagen 4 (Coder)

## Goal
Real-time friendly matches (spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §11, §13, §15, §16; lead's brief in issue 874).
Done = engine + sync + callables + rules + client "Vänskap" tab + docs/report, all suites green, then report to `874-issue-lead`
(HEAD sha, built, runs, margins, left for Tester). No deploy/merge.

## Done (branch coder/issue-874-…, pushed)
- 6324fe52 pure engine `src/matchdagen/delat/md-vanskap.js` (nyVanskap, vLage, vSpela, vAndraHalvlek, vWalkover, vResultat,
  spegla(h, sida), vy(V, sida), fasSekunder, inaktivUtfall, kassaFor, inbordesText), `VANSKAP` in md-config (forsvar 0.5,
  raddning 0.55, steg 2.6–3.8, tid 60, anim 6, inaktiv 180, halvtid 60, utmaning 120, kassa 100/100/3 per day),
  texts VANSKAP_TEXT/VANSKAP_KOMMENTAR in md-texter, `viktat` exported from md-motor, balance `admin/md-balans-vanskap.mjs`
  (hooked into md-balans-sim: 70/70 → 36/31/33 %, 2.2 goals, 29 phases, 7.3 min), tests test/matchdagen-vanskap.test.js.
- next commit: `admin/sync-matchdagen-functions.mjs` (delat → functions/matchdagen/, rakna-core+matte-generator+exercise-types+
  grades+mult/generator → functions/matchdagen/kallor/), npm `sync:matchdagen`, firebase.json predeploy;
  `functions/md-vanskap-fragor.js` (server bank: omradePool = client omradeKalla selection, tabell, rakna; ratta via
  kistspel-rattning gradeMult/gradeQuiz + rakna checkAnswer); test/matchdagen-vanskap-server.test.js (7 pass).
- 1de95b3c callables: functions/md-vanskap-state.js, -lobby.js (utmana, svara, BANK=36), -spel.js (fraga, svar, tick, geUpp,
  avsluta), -anrop.js (onCall wrappers, teachers denied), index.js re-export (still 400 lines);
  test/functions-matchdagen-vanskap.test.mjs + test/helpers/md-vanskap-rig.js (14 pass vs firestore emulator).
- UNCOMMITTED at handoff time → committed with this file: firestore.rules (mdLobby/mdVanskap(+privat,facit)/mdVanskapElev,
  mdHarMatchdagen; matchdagen hasOnly + 'inbordes' and `!('inbordes' in a)`), test/firestore-rules-matchdagen-vanskap.test.js
  (rules run: 35 pass incl. old matchdagen + mastarcup files), src/matchdagen/md-data.js sparaKarriar writes HELA_FALT
  (KARRIAR_FALT + inbordes) so rename/legend keep inbordes, admin/qa-matchdagen-marginal.test.js INB=1 option.

## State
- node_modules + functions/node_modules hard-link copied (cp -al) from the #873 checkout (gitignored).
- Margin run was started in background: logs `.scratch/marg-utan.log` (all scenarios, new rules) and `.scratch/marg-inb.log`
  (INB=1, doc already has inbordes). Grep `MARGINAL`. Previous (Etapp 3): ny klubb 5, match 50, läger 30, köp 22, köp full 18,
  sistaOmg 26, kval 22, säsong+cup+kval 12, mästare 50, legend 12, legend49 10. If the emulator lock is busy, wait for it.
- Emulator helper: `bash .scratch/emu.sh firestore "node --test <files>"` (random ports, lock /tmp/pp-emulator.lock).

## Data model (server-only writes)
mdLobby/{classId} {utmaningar{id:{fran,franNamn,franLag,till,sedan}}, matcher{id:{a,b,aNamn,bNamn,aLag,bLag,start}}};
mdVanskap/{id} {classId,a,b,spelare,namn{a,b},tid{a,b},status pagar|slut|avbruten,V,h,fas{nr,start},halvtid{start,redo},resultat{vinnare,walkover,stallning,kassa},skapad,uppdaterad};
privat/{uid} {classId,sida,fas,roll,val,fraga(pub, no facit),kalla,svar{ratt,facit,tidenUte?},aktiv}; facit/{uid} {classId,sida,bank};
mdVanskapElev/{uid} {aktiv,dag,antal}; matchdagen/{uid}.inbordes{opp:{v,o,f,namn}} + kassa increment; matcher/{id} typ "vanskap".
Deadline per side = fas.start + (tid[s] + anim) s. Question for phase n = bank[(n-1) % len].

## Decisions (put in report)
Every phase both answer (no automatic phases) → longer steps; defender's answer = keeper save on a shot; one question per shot
(no Div-3 feint in friendlies); no choice = kort/tack; walkover keeps score, loser gets 0 kr; both inactive → "avbruten"
(no result/coins), resolved lazily on next lobby call; halftime ends when both press or after 60 s; purse 100+100 for first
3 friendlies/day (counted on Stockholm day, mdVanskapElev.antal), more matches allowed without money; inbordes stores opp team
`namn` too; friendlies don't touch summa/dagar/senaste (teacher sees them via matcher typ vanskap); challenger = side a, kickoff.

## Coder 2 (after 3349190e)
- a63691a7 client: src/matchdagen/vanskap/{md-vanskap-moln,md-vy-vanskap,md-vanskap-spel}.js, tab in md-app (only with deps.vanskap),
  page-matchdagen vanskapFor(getClasses, harMatchdagen, ensureClassProjection), md-svar async ratta + ute(), mdSvar svar:null = time out
  (server + test), vakt (bevaka) mirrors server kassa/inbordes into S.K, teacher tag + inbördes, CSS 51-matchdagen-vanskap.css,
  test/matchdagen-vanskap-vy.test.js (12 pass).
- b37fcf70 test/functions-matchdagen-vanskap-anrop.test.mjs (callable e2e), package.json test:rules/test:functions, proxy whitelist,
  admin/qa-matchdagen-874-preview.sh + seed MD_VANSKAP=1 (Alva 4a01 + Bilal 4a02).
- next commit: docs MATCHDAGEN §18, DATAMODELL, BEHORIGHETER (doc test green).
- Margins base run (coarse): skapa 4, match 50, lager 30, kop 18, kopFull 15, sistaOmg 26, kval 22, sasongKval 10, legend 12,
  legend49 10, mastare 50, mc/mcFinal/cup/cupFinal/lagerStart/byt >=60, lagerMatch -1 (was already "nekas" in Etapp 3).
- Running: .scratch/kor-874.sh (fine margins fore/efter/INB → .scratch/marg-{fore,efter,inb}.log, then functions tests →
  .scratch/fn-vanskap.log, then writes .scratch/kor-874.klar).

## Next steps
1. Read margins + fn-vanskap.log; fix failures.
2. Two-browser e2e: barista_serve "PORT=8874 bash admin/qa-matchdagen-874-preview.sh" (needs emulator lock), log in 4a01 + 4a02
   (lilla123) in two isolated pages, Vänskap → challenge/accept → play phases; screenshots to docs/qa-matchdagen-4/ (3D + ?2d=1).
3. docs/QA-RAPPORT-matchdagen-etapp-4.md (built, choices, quota §18.7, margins, deploy rules→functions→web, whole-epic deploy).
4. Full suites: node --test, test:rules (svit), test:functions (svit); code review (foreground Agent); report to 874-issue-lead.
