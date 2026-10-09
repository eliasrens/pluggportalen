# Live-format – analys av klass-mot-klass i dagens Live (#547, epic #546)

Underlag till epicens PR-beskrivning (spec §2). "Före" = koden på
`0f7097a`; "Nu" = efter #547.

## Var klass mot klass satt hårdkodat (före)

| Var | Vad | Nu |
| --- | --- | --- |
| `live-core.js` `classStandings` / `divisorFor` / `sumCounters` | ställning per klass = rätt (summa av shardade räknare) ÷ `classDivisors[klass]`; "redo per klass" = spelare med färsk puls (75 s) | `formats/klassmatch/klassmatch-core.js`, via `KLASSMATCH.computeStandings` |
| `live-core.js` `decideWinner` / `buildResult` | vinnare = högst poäng, lika = `"draw"`; `result.perClass`, `winnerClasses` (#526), kooperativt `goalReached` (#495) | samma fil, `KLASSMATCH.buildResult` |
| `live-core.js` pris (`parsePrize`, `sessionPrize`, `prizeShare`, `prizeText`) | mynt-pris till vinnarklassens klasskassa | `klassmatch-core.js` (live-core re-exporterar namnen) |
| `live-core.js` `validateSessionInput` / `buildSessionDoc` | "minst två klasser (klass mot klass)", max 8, nämnare, pris, `counterShards`, `wizards` vid två klasser | kärnan kontrollerar namn/spelläge/klassantal (formatets `minClasses`/`maxClasses`)/matchlängd (`pacing: "tid"`), formatets `validateSetup` + `buildSessionFields` resten; `format: "klassmatch"` skrivs |
| `live-feed.js` | lyssnade alltid på `counters`, räknade `classStandings` + `decideWinner`, skrev `buildResult` | slår upp `formatOf(session)`: `computeStandings`, `buildResult`, räknare bara om `classCounters` |
| `projector.js` `VIEWS` + lobby + vinnarskärm + "÷ Nämnare" | Raketrace, Statistik, Dragkamp, Trollkarlsduellen; `proj-lobby` (redo/nämnare/trollkarlar per klass); `proj-winner` | formatets `projectorViews()` (latt) → `klassmatch-projector.js`; skalet behåller timer, 3-2-1-KÖR!, ljud, fullskärm, elevskärm (#533) |
| `page-elev-live.js` | rubrik "4B MOT 5E", prisrad i lobbyn, slutskärm med klassernas poäng/elev | `sessionTitle` + `studentView()` → `klassmatch-student.js` |
| `teacher-live-history.js` | vinnartext, klasstabell (rätt/nämnare/poäng), prisutbetalning, Statistik → Live-kolumner | `historyRenderer()` → `klassmatch-history.js`; `ensureResult` via formatet |
| `teacher-live.js` | "Ändra nämnare" på varje aktiv session | bara om formatets `classDivisors` |
| `teacher-live-form.js` | klassval (max 8), nämnare, pris, trollkarlar | oförändrat UI = Klassmatchens inställningar; skapar med `format: "klassmatch"`, max ur formatet, bara kompatibla spellägen |

## Kvar i kärnan som fortfarande antar Klassmatchen (medvetet, nästa steg)

1. **`firestore.rules`**: `validLiveSessionShape` kräver `classDivisors` (map)
   och `counterShards`; `liveAnswerCreate` kräver att ett RÄTT svar ökar
   klassens räknarshard (`getAfter(counters/…)`); `liveDivisorChangeOk`.
   Ett format utan klassräknare/nämnare behöver en regelgren här.
2. **`src/tavling/answer-writes.js` `planLiveAnswerWrites`** skriver alltid
   en räknarshard per rätt svar (delas med regeltesterna).
3. **`live-data.js`**: `setClassDivisor`, `setLiveWizards`, `getCounters`,
   `watchCounters` är Klassmatchens dataoperationer (ligger kvar i det enda
   Firestore-lagret, dokumenterat).
4. **`kc-koppling.js`** (anropas av `writeResultIfMissing` för alla sessioner):
   Live-bonus, pokalerna `live-vinst`/`live-avklarat` och mynt-priset läser
   `result.perClass`/`winner`/`winnerClasses`/`goalReached` – Klassmatchens
   resultatform. Nya format måste ge kompatibelt `result` eller routas här.
5. **Elevens spelfas** (`page-elev-live.js`): snabbsvarsflödet (fast-answer,
   "N rätt" i rubriken) är `pacing: "tid"`. `studentView()` äger i dag bara
   lobbyraden och slutskärmen – Snilleblixten (lärarstyrd, en fråga i taget)
   behöver att `studentView` även tar över spelfasen.
6. **Formatväljaren** (spec §3.4) finns inte än: formuläret är Klassmatchens
   och `setupFields` är tom. Kärnans validering/dokument tar redan `format`.
7. **Statistik → Live per klass** visar formatets kolumner (första matchens
   format); matcher i andra format listas utan kolumner tills en blandad vy behövs.
8. Projektorns märke "⚡ MATTEMATCH LIVE" och ljudhändelserna (`totalCorrect`,
   `leaderIds` ur `computeStandings`) är generiska fält men klass-präglade.

## Bakåtkompatibilitet

- `formatIdOf(session) = session.format ?? "klassmatch"` – ingen migrering,
  inga fält omdöpta. Regler: `format` frånvarande eller `"klassmatch"`, byts
  aldrig (`liveFormatOk`, `test/firestore-rules-live-format.test.js`).
- Reglerna före #547 hade ingen `hasOnly` på sessionen, så nya klienter med
  `format` fungerar även innan regeländringen deployats.
- Identiskt resultat: `test/live-formats.test.js` jämför `computeStandings`,
  `buildResult`, `buildSessionDoc` och felmeddelandena mot en fryst kopia av
  live-core före refaktorn (`test/fixtures/live-core-fore-547.js`), 2 000
  slumpfall vardera.
