# QA-rapport – Live svarssätt (#554, epic #550)

Slutverifiering av A (#551 answerKind), B (#552 flerval multiplikation) och
C (#553 quiz från Plugga) på epic-grenen `5c1165e`. Spec §1 + §10 test 2, 3b, 3c, 3d.

**Resultat: allt grönt, 0 buggar.** Inga konsolfel i någon flik.

## Testsviter

| Svit | Resultat |
| --- | --- |
| `test/` (alla enhetstester, utom regel/e2e/functions) | 1369 / 1369 |
| `npm run test:rules` (26 filer, ny `firestore-rules-live-answerkind`) | 357 / 357 |
| `npm run test:e2e` | 5 / 5 |
| `npm run test:functions` | 6 / 6 |

## Metod: testformat i registret

Snilleblixten/Guldrushen finns inte än, och Klassmatchen stöder bara "free".
`admin/qa-live-svarssatt-preview.sh` kör därför samma emulator (FS 8554 / Auth 9554) med två proxys:

- **8555 – testformat:** en `git archive`-kopia där Klassmatchen har
  `answerKinds: ["free", "choice"]` (spec §4: "kan slås på där senare"). Repot ändras inte.
  Grenens egna regler gäller (format-vitlistan släpper bara `klassmatch`).
- **8556 – orörd gren:** Klassmatchen som den levereras (test 2).

Seed: `qa-mm-live-seed.mjs` (4B/5E, lärare elias) + `seed/seed.mjs` (Plugga-innehåll).
Elevsvar kommer från en riktig elev (b18, egen webbläsarkontext) och från `qa-mm-live-sim.mjs`,
som gör riktiga klientskrivningar som reglerna prövar.

## 3b – svarssätt, multiplikation (testformat)

| Steg | Resultat |
| --- | --- |
| Formuläret: multiplikation → "Välj svarssätt" ✍️ Skriv själv / 🔘 Flerval, förval Skriv själv | ✅ [01](qa-live-svarssatt-554/01-3b-svarssatt-val.jpeg) |
| Flerval valt → sessionsdokumentet | ✅ `answerKind: "choice"`, `format: "klassmatch"` |
| Efter start: läraren (riktig klient) sätter `answerKind: "free"` / tar bort fältet | ✅ båda `permission-denied` |
| Eleven får fyra färgade knappar med form + siffra 1–4 | ✅ [02](qa-live-svarssatt-554/02-elev-flerval.jpeg) |
| Matchslut → vinnarskärm, elevens slutskärm "Du fick 2 rätt!" | ✅ |

## 3c – svarssätt, quiz (testformat)

| Steg | Resultat |
| --- | --- |
| Quiz från Plugga → inget svarssättsval visas (`.live-answerkind` dold) | ✅ [03](qa-live-svarssatt-554/03-3c-quiz-inget-val.jpeg) |
| Ämne/område-väljaren: Matematik → Talsorter "✅ 10 frågor kan användas" | ✅ |
| SO → Vikingatiden: "⛔ Inga av områdets 5 frågor passar … 5 läsförståelsefrågor" | ✅ för-få-varning + passage hoppas över |
| Sparad session | ✅ `gameMode: "plugga_quiz"`, `answerKind: "choice"`, `quiz: {…, passagePolicy: "skip"}` |
| Orörd gren (8556): Klassmatchen erbjuder **inte** quiz, inget svarssättsval | ✅ |

## 3d – fel svarssätt nekas

- Regeltester (`test/firestore-rules-live-answerkind.test.js`): flervalssession + svar i formen
  skriv själv nekas (även med bara `choiceIndex` eller bara `answerKind`); skriv själv-session +
  flervalssvar nekas; choiceIndex utanför 0–3, påhittat facit och extra fält nekas.
- Riktig klient i webbläsar-emulatorn: `qa-mm-live-sim.mjs prova` (svar i formen skriv själv)
  mot flervalssessionen → **NEKAT permission-denied**; samma kommando mot Klassmatchen-sessionen
  (skriv själv) → GODKÄNT.

## Flervalskomponenten (riktig elev)

| Steg | Resultat |
| --- | --- |
| Tangent `4` (rätt) | ✅ 1 rätt |
| Dubbelklick på rätt knapp | ✅ bara ETT svar sparat (2 rätt, nästa fråga orörd) |
| Tangent `2` (fel) | ✅ |
| Svarsdokumenten | exakt 3: `answerKind: "choice"`, `choiceIndex` 3/1/1, `isCorrect` rätt; spelaren 2 rätt / 1 fel |
| Färg + form | röd triangel, blå romb, gul cirkel, grön kvadrat; a11y-namn "1: 36 (Röd triangel)", `keyshortcuts` |

## Multiplikationsdistraktorer

Stickprov (frö 554): 7×8 → 56, 64, 63, 49 · 6×7 → 49, 36, 48, 42 · 9×9 → 90, 70, 81, 72 ·
0×0 → 3, 2, 4, 0 · 10×10 → 90, 100, 110, 80. 26 400 frågor (200 varv × alla 121):
facits plats jämn (6065/6084/6072/5979), 96 % av felen är tabellprodukter, största avstånd
20 (10×10). Inga dubbletter eller negativa (också bevisat för alla a×b i `test/mult-choices.test.js`).

## Test 2 – Klassmatchen oförändrad (orörd gren, 4B mot 5E, 20 min, pris 300)

| Steg | Resultat |
| --- | --- |
| Formuläret: bara multiplikation, inget formatval, inget svarssättsval; samma som #549 | ✅ [04](qa-live-svarssatt-554/04-test2-larformular.jpeg) |
| Sessionen | `format: "klassmatch"`, `answerKind: "free"`, alla gamla fält oförändrade |
| Lobby redo per klass (16/18), pris i elevens lobby | ✅ |
| STARTA MATCH → 3–2–1–KÖR! | ✅ (MutationObserver: 3, 2, 1, KÖR!) |
| Raketrace / Statistik / Dragkamp / Trollkarlsduellen | ✅ 162÷20 = 8,1 och 150÷22 = 6,8 [05](qa-live-svarssatt-554/05-test2-trollkarlsduellen.jpeg) |
| Riktig elev skriver svar + ENTER | ✅ |
| Automatiskt matchslut → vinnarskärm | ✅ [06](qa-live-svarssatt-554/06-test2-vinnarskarm.jpeg); eleven ser "VINNARE – 4B! … Du fick 11 rätt!" |
| Mynt-pris | ✅ `classCenters/4b/kassaHistorik/live-<sid>` belopp 300 |
| Pokal | ✅ `live-vinst-<sid>` |

## Boot

- Kall laddning (cache tömd) av elevstart (`b18`, `#/elev/hus`) och `#/larare/live`: inga konsolfel.
- Statiska bootgrafen från `src/app.js`: identisk med före epicen (`3ace9ed`), ingen ny fil.
- Elevstartens dynamiska `live-watch` laddar inte `choice-*`, `answer-kinds.js` eller `plugga-quiz*`.

## Observationer (inga buggar)

- Lobbyn och listan "Aktiva Live-sessioner" visar inte svarssättet. När flerval är på syns
  det inte för läraren efter att lobbyn skapats. Det kan vara värt en etikett när Snilleblixten/Guldrushen byggs.
- Reglerna låter läraren byta svarssätt i lobbyn, men det finns inget UI för det (bara i formuläret).
- Quiz-sessionen sparar bara områdesvalet. Ögonblicksbilden/facit och regelgrenen för
  `plugga_quiz`-svar kommer med formaten (dokumenterat i `plugga-quiz.js`). I dag nekas alla quizsvar.
- Emojis i lärarformuläret visas som rutor i headless-Chrome (typsnitt saknas), inte i appen.
