# QA-rapport – Tidsjakten slut-QA (#602, epic #595)

Slutverifiering av epicgrenen `c1cb391` (#596 innehåll/AI, #597 tidslinjekomponent, #598 lärarflöde,
#599 Tidsjakten + Quiz, #600 Snilleblixten, #601 Guldrushen). Spec §9: hela kedjan A–I med ett
Vasatiden-område.

**Resultat: hela kedjan A–I är grön efter en rättning.** Ett fynd (F1) i Quiz är rättat och
verifierat på grenen (`4e3e4f3`). Övriga iakttagelser (O1–O5) påverkar inte landningen.

## Deploy före live (i den här ordningen)

1. `firebase deploy --only firestore:rules`. **Reglerna är ändrade** (#600): Snilleblixtens
   `sbAnswers` tar emot svarssättet `timeline` per fråga (`year` = heltal inom frågans spann), och
   `sbScores` får fältet `guesses`. Utan deployen nekas varje tidslinjesvar i Snilleblixten
   (`permission-denied`).
2. `firebase deploy --only functions`. **Guldrushens rättning är ändrad** (#601):
   `functions/guldrush-rattning.js` (nytt) + `functions/guldrush-core.js`. Utan deployen rättar den
   gamla servern inte tidslinjesvar. Predeploy-kroken kör `sync-guldrush-functions.mjs`.
3. Därefter merge till main (Pages). **Index är oförändrade.** Tidsjaktens progress
   (`studentData.progress.<område>.tidsjakt`) ryms i de befintliga reglerna.

Ordningen spelar roll: ny klient mot gamla regler/functions = tidslinjefrågor i Live går inte att
besvara.

## Sviter och bootgraf (I)

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test`, 132 filer utom regler/functions/e2e) | ✅ 1733/1733 (1732 + nytt regressionstest för F1) |
| `test:rules` (32 filer, bl.a. `live-snilleblixt-tidslinje`, `live-guldrush-tidslinje`, `tidsjakt`) | ✅ 418/418 |
| `test:functions` (inkl. `functions-guldrush-tidslinje`) | ✅ 47/47 |
| `test:e2e` | ✅ 5/5 |
| `sync:guldrush` | ✅ kopiorna identiska (git diff tom) |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | ✅ **107** filer, identisk lista med `origin/main`; ingen `timeline/`- eller `tidsjakt`-fil i den statiska grafen |

Recept: `test:functions` kräver `FUNCTIONS_EMULATOR_HOST` i kommandot (annars ringer testerna
port 5001 och får `internal`). Sviterna kördes en i taget mot egen config (`/tmp/tj602-suite`,
portar 8612/9612/5612, `--inspect-functions` = en functions-worker åt gången, 8 GB RAM).

## Miljö och metod

- Emulatorer (functions + auth + firestore) via `admin/qa-guldrush-preview.sh` med `FN_SEKVENS=1`
  (FS 8622, Auth 9622, FN 5622, proxy 8623). Seed: `qa-mm-live-seed` + `seed/seed.mjs`. **Vasatiden
  seedades INTE** – området skapades i lärarguiden (A–C).
- **EN** headless Chrome-flik, växlad mellan lärare (`elias`) och elev (`b01`, Saga 4B).
- Riktig inmatning: NYA `admin/qa-tidslinje-input.mjs` skickar CDP `Input.dispatchMouseEvent`/
  `dispatchTouchEvent` till samma flik (dra, klick, tryck, nyp, knappar). Koordinaterna räknas ur
  linjens egen skala. Facit läses ur emulatorn (`qa-tidslinje-fraga.mjs`), aldrig ur sidan.
- Spelriggar (samma flik, riktiga klick/drag): `qa-tidslinje-quiz.mjs`, `qa-tidslinje-guldrush.mjs`,
  `qa-tidslinje-snilleblixt.mjs`. Snilleblixtens lärare kördes huvudlöst med den befintliga
  `qa-snilleblixt-larare.mjs` (appens egna moduler: start, stäng, avslöja, nästa, pall).

## A–C: skapa, AI-prompt, validera, spara, granska, redigera

| Steg | Resultat |
| --- | --- |
| Guiden: Vasatiden, åk 5, kort Quiz + Para ihop & memory + Tidsjakten, 10 händelser | ✅ antalsväljaren visas bara när Tidsjakten är vald ([01](qa-tidsjakt-602/tj602-01-wizard-typer.png)) |
| AI-prompten | ✅ nämner "tidslinjefrågor (Tidsjakten …)", `timeline`-schemat (heltalsår, f.Kr. negativt, inga alternativ, beskrivning utan årtal), "Skapa EXAKT 10 händelser", kvalitetskraven och ett exempel med `timeline` + `timelineSpan` |
| AI-svar | Skrivet efter prompten: [`ai-svar-vasatiden.json`](qa-tidsjakt-602/ai-svar-vasatiden.json) (4 texter, 8 frågor, 8 par, 10 händelser 1520–1593, spann 1500–1620) |
| Trasigt svar ([`ai-svar-trasigt.json`](qa-tidsjakt-602/ai-svar-trasigt.json)) | ✅ nekas: "Tidslinjehändelse 1: "description" avslöjar årtalet 1520 – skriv om utan årtalet." |
| Dubblett + år som sträng ([`ai-svar-dubblett.json`](qa-tidsjakt-602/ai-svar-dubblett.json)) | ✅ dubbletten hoppas över med varning, `"1523"` sparas som heltal 1523 ([02](qa-tidsjakt-602/tj602-02-validering.png)) |
| Sparat | ✅ `subjects/so/areas/vasatiden`: `exerciseTypes [quiz, pairs, tidsjakt]`, 10 händelser med `integerValue`, `timelineSpan {1500, 1620}` |
| Lärarens lista + minitidslinje + spann | ✅ ([03](qa-tidsjakt-602/tj602-03-larare-lista.png)) |
| Redigera händelse 8 | ✅ årtal i beskrivningen nekas ("avslöjar årtalet 1560"); namn/beskrivning/förklaring sparas |
| Lägg till (Erik XIV avsätts 1568) / ta bort | ✅ 11 → 10 i Firestore |
| "Lägg till innehåll" (Skapa fler) | ✅ prompten har Tidsjakten + alla befintliga händelser; inklistring: 1 ny (Johan III 1568), 1 dubblett hoppas över → 11 händelser |

## D: Tidsjakten som elev

| Kontroll | Resultat |
| --- | --- |
| Kortet på områdessidan | ✅ ([04](qa-tidsjakt-602/tj602-04-elev-omrade.png)) |
| Startläge | ✅ "?" och avstängt lås; markören vilar mitt i spannet (1560) för **varje** fråga; rätt år finns **inte** i DOM:en ([05](qa-tidsjakt-602/tj602-05-tidsjakt-start.png)) |
| Musdrag 1535 → +10 +1 −1 +1 = 1546, lås (rätt 1542) | ✅ "+4 felpoäng", två markörer "Du: 1546" / "Rätt: 1542", "4 år för sent" + förklaring ([06](qa-tidsjakt-602/tj602-06-tidsjakt-avslojat.png)) |
| Exakt (drag 1530, −1 ×3 → 1527) | ✅ "0 felpoäng – exakt rätt! 🎯" + fest ([07](qa-tidsjakt-602/tj602-07-tidsjakt-exakt.png)) |
| Zoom in ×2 → skala 1545–1575 (kring mitten, inte svaret), drag 1568, Enter | ✅ ([08](qa-tidsjakt-602/tj602-08-tidsjakt-zoom.png)); nästa fråga börjar utzoomad |
| Tangentbord → / Shift+→ / ← / Enter → 1590 (rätt 1593) | ✅ +3 |
| Resten: klick 1560 (0), drag −12, +1, klick −5, drag +20, 0 | ✅ alla år landade exakt |
| Resultat | ✅ **45 felpoäng, 10 händelser, 4 exakt, 4,5 år i snitt, 5 av 10 träffar** = oberoende uträkning ([09](qa-tidsjakt-602/tj602-09-tidsjakt-resultat.png)); `progress.vasatiden.tidsjakt` stars 2, bestScore 5 |
| Dubbletter i omgången | ✅ 10 olika händelser av 11 (rotation) |

## E: tidslinjefrågor i vanligt Quiz

| Kontroll | Resultat |
| --- | --- |
| Blandning | ✅ 3 tidslinjefrågor bland 7 flerval, inblandade (inte sist) |
| Inga alternativ | ✅ `.quiz-opt` = 0 på varje tidslinjekort ([10](qa-tidsjakt-602/tj602-10-quiz-tidslinje.png)) |
| Låst = bedömt | ✅ visat "Du: 1535" = draget; fel → "Inte riktigt", köas om (Quizets befintliga repetition), rätt nästa gång |
| Resultat | ✅ 10/10 till slut, kategorin Fakta 7 av 8 på första försöket (tidslinje räknas som fakta) |

## F: Guldrushen (functions-emulatorn)

| Kontroll | Resultat |
| --- | --- |
| Lärarformuläret | ✅ "Ta med tidslinjefrågor" på; "19 frågor kan användas (… varav 11 tidslinjefrågor)" |
| Avslöjar inget | ✅ `grPublic/questions`: 19 unika frågor, tidslinjefrågorna har bara `text/event/description/span` – inget år, ingen förklaring, inga alternativ. Åren finns bara i `grPrivate` |
| Elevvyn | ✅ kompakt tidslinje direkt i spelet ([13](qa-tidsjakt-602/tj602-13-guldrush-elev-tidslinje.png)); flervalsknapparna 1–4 är `display:none` och tangent "1" skickar inget |
| Låst år = skickat år | ✅ servern sparade `year: 1530` (rätt 1523, `isCorrect: false`) |
| Exakt → kista | ✅ 4 exakta tidslinjesvar → "Rätt! Välj en kista"; kistorna gav guld (+25/+50/+125), sköld (Skyddad 0:55) och Stöld (ingen att välja → +25) |
| Fel → avslöjat | ✅ "Rätt: 1520 / Du: 1513", "7 år för tidigt", ingen kista ([14](qa-tidsjakt-602/tj602-14-guldrush-fel-avslojat.png)) |
| Statistik + slut | ✅ 9 rätt av 11 (båda felen = tidslinje) ([15](qa-tidsjakt-602/tj602-15-guldrush-statistik.png)); Avsluta → `result`, **+45 Pluggmynt = 9 × 5** (226 → 271) |

## G: Snilleblixten

| Kontroll | Resultat |
| --- | --- |
| Lärarformuläret + ögonblicksbilden | ✅ sessionsdokumentet utan årtal; facit bara i `sbPrivate/snapshot`; publik `q.question` för tidslinje = text/event/span/beskrivning |
| Plan per tidslinjefråga: exakt, +3, tid ute, exakt, +5, exakt | ✅ `sbAnswers.year` = 1523, 1523 (rätt 1520), *inget svar*, 1527, 1531 (rätt 1526), 1593 – exakt som låst |
| Poäng | ✅ exakt → ~970–990 p (snabbhet), fel → 0, tid ute → inget svar; `sbScores.guesses` = elevens år |
| Final | ✅ 6 rätt, 5873 p = summan av sbScores; **+30 Pluggmynt = 6 × 5** (271 → 301) ([16](qa-tidsjakt-602/tj602-16-snilleblixt-elev-final.png)) |
| Projektorn (demosidan `?fragor=tidslinje`) | ✅ under frågan bara linjen; efter avslöjandet "Rätt år 1520 · 62 % exakt rätt (13 av 21) · Gissningarna 1513–1540" |

## H: mus, touch, storlekar, zoom

| Kontroll | Resultat |
| --- | --- |
| Mobil 390×844 touch (Quiz) | ✅ touchdrag 1540, tryck 1600, nyp ×2,5 zoomar **linjen** (sidans skala förblir 1) utan att ändra året, tryck i inzoomad vy, stegknappar panorerar vyn ([11](qa-tidsjakt-602/tj602-11-mobil-quiz-zoom.png)) – efter F1-fixen |
| Surfplatta 768×1024 touch (Tidsjakten) | ✅ touch, nyp, −10/+1 ([18](qa-tidsjakt-602/tj602-18-surfplatta-tidsjakt.png)) |
| 1920×1080, tangentbord i Quiz vid kallstart | ✅ → Shift+← ×2 → 1541, Enter → "Rätt!" ([19](qa-tidsjakt-602/tj602-19-quiz-1920-tangentbord.png)) |
| 1366×900 mus (Tidsjakten, Guldrushen) | ✅ se D och F |

## I: gamla områden och lägen

| Kontroll | Resultat |
| --- | --- |
| Vikingatiden (utan tidslinje) | ✅ inget Tidsjakten-kort; Quiz = 5 flervalsfrågor, ingen tidslinje |
| Vasatiden: Memory, Para ihop, Kunskapsjakt, Läsförståelse | ✅ startar som förut, ingen tidslinje i dem |
| Konsolen | ✅ inga fel eller varningar |
| Sviter + bootgraf | ✅ se ovan |

## Extra

- **Tidslinjen avslöjar aldrig rätt svar:** ✅ inte i DOM (D), inte i Guldrushens `grPublic` (F), inte i Snilleblixtens session (G); startläge och spann är samma för alla frågor i området, zoom centreras kring markören.
- **Låst år = skickat år:** ✅ Quiz (visat = draget), Guldrushen (`answers.year`), Snilleblixten (`sbAnswers.year`).
- **Ingen dubblering:** ✅ validatorn hoppar över dubbletter (A, Skapa fler); Tidsjaktens omgång 10 olika; Guldrushens pool 19 unika id/texter. Se O2 om Guldrushens upprepning.
- **Inga fyra alternativ:** ✅ Quiz 0 `.quiz-opt`, Guldrushen knapparna dolda (`display:none`), Snilleblixten `answerKind: timeline` per fråga.

## Fynd

### F1 – Quiz-tidslinjen saknade CSS och tangentbord vid direktstart (RÄTTAD, `4e3e4f3`)

`src/timeline/quiz-tidslinje.js` byggde kortet i en `<template>`. Noder i `template.content` har ett
inert `ownerDocument` utan `<head>`/`defaultView`, så komponenten laddade aldrig
`timeline-answer.css`, kopplade tangentbordet till fel dokument och fick ingen ResizeObserver.
Det syntes bara när eleven gick **direkt** till Quiz utan att ha spelat Tidsjakten i samma
sidladdning: ostylad linje, och på mobil zoomade ett nyp hela sidan. Kortet byggs nu i sidans
dokument (som `gr-fraga.js`), och ett regressionstest finns i `test/tidsjakt-spel.test.js`.
Verifierat i webbläsaren efter fixen (mobil + 1920, tangentbord).

## Iakttagelser (inga blockerare)

- **O1** – Guiden använder lärarens emoji (⚔️) i stället för AI-svarets `coverEmoji` (👑). Troligen avsiktligt.
- **O2** – Guldrushen slumpar nästa fråga ur hela poolen (bara inte samma som nyss, `pickNextQ`, oförändrat sedan #563). Med 11 tidslinje- + 8 quizfrågor blev ungefär 6 av 10 frågor tidslinje, och samma tidslinjefråga kunde komma igen efter 2–3 frågor. Det är inte dubblering men kan kännas tjatigt. Leaden avgör om tidslinjeandelen ska begränsas.
- **O3** – I den huvudlösa lärarriggen stängdes en Snilleblixtfråga där tiden gick ut 5–23 s efter 20 s-gränsen (stängning sker först vid nästa ändring i flödet). Svar efter fönstret nekas ändå av reglerna, så bara avslöjandet fördröjs. Det är inte tidslinjespecifikt och är inte prövat i en riktig projektor här.
- **O4** – Zoomknapparna går fortfarande att använda efter att svaret är låst. Det är avsiktligt (koden), så att eleven kan zooma in på de två markörerna.
- **O5** – Snilleblixtens slutskärm visar "Du kom 1:a!" för pallplats 1–3. Det är oförändrat från main (#558) och ligger utanför epiken.

## Klickbar preview

```
JAVA_BIN=/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin FIREBASE_BIN=~/.npm/_npx/ba4f1959e38407b5/node_modules/.bin \
FS=8622 AUTH=9622 FN=5622 PROXY=8623 FN_SEKVENS=1 bash admin/qa-guldrush-preview.sh
```
Lärare `elias` / elev `b01` (lösen `lilla123`, bara emulatorn). Skapa Vasatiden i guiden med
[`ai-svar-vasatiden.json`](qa-tidsjakt-602/ai-svar-vasatiden.json) (eller kör `admin/qa-tidsjakt-live-seed.mjs`).
