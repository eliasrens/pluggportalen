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

## Next steps
1. Client (task 7): `src/matchdagen/vanskap/md-vanskap-moln.js` (callables like src/schack/schack-moln.js, onSnapshot lobby +
   match, getDoc own privat), `md-vy-vanskap.js` (lobby: classmates with matchdagen via getClasses()+harMatchdagen, names via
   ensureClassProjection; challenge/accept/decline/withdraw; inbordes list with inbordesText, esc everything), `md-vanskap-spel.js`
   (match view: reuse md-plan skapaPlan with spegla/vy, md-svar visaFraga). md-svar: support async ratta WITHOUT breaking the sync
   test in test/matchdagen-kval-vy.test.js (`let r = ratta(); if (r?.then) r = await r;`, guard double click).
   Add tab ["vanskap","Vänskap"] in md-app.js; page-matchdagen passes classId/kompisar. Require empty queue (sparaKon) before
   challenge/accept; after the match re-read career (lasKarriar) → S.K. Teacher: MATCH_TAGG vanskap " (vänskap)" in md-larare-stat.
   CSS in src/styles/49-matchdagen-match.css (+ npm run build:css). Bootgraph test must stay 107.
2. Callable e2e test (functions emulator) test/functions-matchdagen-vanskap-anrop.test.mjs like test/functions-schack.test.mjs;
   add both functions tests to package.json test:functions and the rules test to test:rules.
3. Two-browser e2e (max two headless pages) against emulator, screenshots to docs/qa-matchdagen-4/ (3D and ?2d=1).
4. Docs: docs/QA-RAPPORT-matchdagen-etapp-4.md (built, choices above, quota for one friendly, margins, deploy rules→functions→web,
   whole-epic deploy section), MATCHDAGEN.md §18, DATAMODELL.md, BEHORIGHETER.md (collections + 6 callables).
5. Full suites: node --test, test:rules, test:functions (via admin/qa-matchdagen-867-svit.sh), then report to lead.
