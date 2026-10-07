# QA-rapport Mattematchen + Live (issue #462, epic #456)

Testat 2026-10-07 på `epic/mattematchen-live-…` (55903ce) mot Firebase-emulatorerna
(Auth + Firestore, riktiga `firestore.rules`) via `admin/qa-emulator-proxy.mjs`.
Flera isolerade browserkontexter: lärarna **rasmus** och **elias**, eleverna b01/b02/b16 (4B),
e01 (5E), a01/a02 (4A), c02 (3A), k01 (4C) och f01 (6A). "Många elever" simulerades med
`admin/qa-mm-live-sim.mjs`. Den loggar in som riktiga elever och skriver exakt appens batcher,
så **varje svar prövas av reglerna**. Seed: `admin/qa-mm-live-seed.mjs`.
Skärmdumpar finns i `docs/qa-mattematchen-live/`. Klickguide: [preview-mattematchen-live.md](preview-mattematchen-live.md).

## Sammanfattning

**Alla 15 acceptanstester är PASS** (MM 1–6, Live 1–9). Fynden nedan gäller layout (F1),
ett befintligt inloggningsproblem som slår hårt mot Live (F2) och småsaker (F3–F7).

## Acceptanstester

| Test | Resultat | Belägg |
|---|---|---|
| MM 1 – ingen aktiv tävling → dold | **PASS** | f01 (6A): ingen Mattematchen i menyn. Direkt-URL `#/elev/mattematchen` → skickas till Hem. [mm1](qa-mattematchen-live/mm1-f01-ingen.jpg) |
| MM 2 – perioden börjar → visas automatiskt | **PASS** | k01 (4C): länken dök upp 04:32:05.47, startAt var 04:32:05, ingen omladdning. Lärarskapad tävling för 6A: dök upp 04:43:00.3. Stoppa → dold efter 80 ms, Fortsätt → syns igen. |
| MM 3 – 100 rätt = 100 poäng, ingen valuta | **PASS** | e01: 100 rätta svar i UI:t (form-submit, 9,3 s) gav `scores.correct = 100`, 100 svarsdokument och 100 % per tabell. `coins` var 100 före och efter. Ingen fråga upprepades direkt, ingen spegelvänd direkt efter. |
| MM 4 – 60+ på listan → bara Topp 25 | **PASS** | 67 elever på listan, 25 rader visas plus "Du: 100 poäng". Lika poäng får delad placering (🥇🥇🥉, 16./16./18.). [mm4](qa-mattematchen-live/mm4-topp25.jpg) |
| MM 5 – 20 elever, 4000 rätt → 200,0 | **PASS** | 4B 200,0. 5E (4433+100)/22 = 206,0. 4A 4600/25 = 184,0. Alla klasser visas, med 1 decimal och komma. [mm5](qa-mattematchen-live/mm5-klasskamp.jpg) |
| MM 6 – 📊 bara egen statistik + per tabell | **PASS** | Visar rätt/fel/totalt/%, tabellerna 0–10 och texten "Bara du ser din statistik". Fokus går tillbaka till svarsfältet när panelen stängs. [mm6](qa-mattematchen-live/mm6-egen-statistik.jpg) |
| Live 1 – skapa lobby 4B vs 5E 20 min | **PASS** | `status: lobby`, `classDivisors {4b:17, 5e:22}`, `durationSeconds 1200`. b01 och e01 ser ⚡ Live, f01 (6A) ser det inte. [formulär](qa-mattematchen-live/live1-skapa-formular.jpg), [lobby](qa-mattematchen-live/live1-projektor-lobby.jpg) |
| Live 2 – 15 + 18 ansluter → "15 redo / 18 redo" | **PASS** | 2 elever gick med i UI:t och 31 via simulatorn (genom reglerna). Projektorn visade 15 och 18. [live2](qa-mattematchen-live/live2-lobby-15-18-redo.jpg) |
| Live 3 – andra läraren | **PASS** | elias såg "4B mot 5E · skapad av rasmus" under Aktiva Live-sessioner och öppnade samma projektorvy (15/18 redo). |
| Live 4 – STARTA → 3-2-1-KÖR, första talet, timer | **PASS** | Elias tryckte STARTA. Båda eleverna fick 3/2/1/KÖR med ~10 ms skillnad och första talet efter +4,2 s med autofokus. Rasmus projektor bytte till spelvyn efter 170 ms. Timern räknar ned från 20:00. |
| Live 5 – 7×8, 56, ENTER | **PASS** | Riktiga tangenttryck: "✅ RÄTT!" och nästa tal kom i samma bildruta (20 ms). Fältet var tomt och fokuserat. Fel svar gav "❌ FEL – rätt svar var 35". [live5](qa-mattematchen-live/live5-elev-fel-feedback.jpg) |
| Live 6 – 340/17 vs 418/22 | **PASS** | 830 batcher på 17,5 s gav 4B 20,0 och 5E 19,0, och 4B leder (statistik, raket och dragkamp). |
| Live 7 – lokalt vyval | **PASS** | Rasmus valde Raketrace och Elias Statistik, med samma siffror. Vyvalet ligger bara i `localStorage pp:live:vy` och inget vy-fält finns i sessionsdokumentet. [raket](qa-mattematchen-live/live7-rasmus-raketrace.jpg), [statistik](qa-mattematchen-live/live7-elias-statistik.jpg), [dragkamp](qa-mattematchen-live/live7-dragkamp.jpg) |
| Live 8 – sen elev | **PASS** | b16 loggade in 5 min 15 s efter start och kom direkt till spelvyn (ingen lobby). Svaret räknades och nämnaren låg kvar på 17. |
| Live 9 – 00:00 | **PASS** | 4A mot 3A (5 min): `finished` 0,4 s efter `endsAt`. Eleven skickade svar varannan halvsekund över gränsen, men 0 svarsdokument har tid ≥ endsAt. Simulerade svar efter slut gav `permission-denied`. Vinnarskärmen visades på projektor och elev, och `result` sparades. 20-min-matchen avslutades på samma sätt (4B 20,2 mot 19,1). [projektor](qa-mattematchen-live/live9-vinnarskarm-projektor.jpg), [elev](qa-mattematchen-live/live9-vinnarskarm-elev.jpg) |

## Extra kontroller (issue-listan)

| Kontroll | Resultat |
|---|---|
| ENTER-flöde utan mus, autofokus | PASS – riktiga tangenttryck i både MM och Live, och fältet har alltid fokus |
| Dubbel-ENTER | PASS – `Enter` + `Enter` gav 1 svar. Två `requestSubmit()` per fråga i 10 frågor gav 10 svar. Ett svar med samma `attemptId` nekas av servern (`permission-denied`) |
| Svar efter 00:00 räknas inte | PASS (Live 9) |
| Live ger inte MM-poäng | PASS – e01 hade 36 Live-rätt och ingen MM-score/studentStats. MM-klassräknarna var oförändrade (4B 4000) |
| Ingen avatarvaluta | PASS – `coins` 100 före och efter för b01, e01 och f01 |
| Topp 25-gräns, 1 decimal med komma | PASS |
| Återanslutning | PASS – elev och projektor laddades om mitt i matchen och kom direkt tillbaka (samma vy, tid och poäng). 3 svar under offline (DevTools) synkades när nätet kom tillbaka |
| Två samtidiga sessioner | PASS – 160 svar i 4A mot 3A ändrade inte 4B mot 5E (340/421 före och efter) |
| Lärarsidan MM | PASS – skapa (Kommande → Aktiv), Stoppa/Fortsätt, Avsluta (resultat i historiken), Nollställ (knappen är spärrad tills hela namnet är skrivet och raderar bara den tävlingen), Topp 25, Klasskamp, klasstabell, elevdetalj per tabell och "Totalt i multiplikation (MM + Live)". [detalj](qa-mattematchen-live/mm-larare-elevdetalj.jpg) |
| Statistik → Mattematchen / Live (klassvy) | PASS, men se F4 |
| Chromebook 1366×768 | MM-spelvyn och alla projektorvyer har ingen scroll. **Live-elevvyn har det – se F1** |
| Mobil 390×844 | PASS – MM ryms och fältet har `inputmode=numeric`. [mobil](qa-mattematchen-live/mobil-mattematchen.jpg) |

## Tester och regression

| Svit | Resultat |
|---|---|
| `npm run test:rules` (10 filer) | **118/118 PASS** (kördes på egna portar: samma kommando med `--config`) |
| Enhetstester (`node --test` på alla test/*.test.js utom regler) | **825/825 PASS** i 15 av 16 körningar. En körning hade 1 fel som inte gick att återskapa (flaky, okänt vilket test) |
| `test/e2e-auth.test.mjs` | 4/5 – test 2 faller. **Fanns redan före epic:en**, se F7 |
| Elev: Hem, Plugga → Läsförståelse, Läsresan-kartan, Shoppen, Profil | PASS, inga JS-fel. [läsresan](qa-mattematchen-live/reg-lasresan-elev.jpg) |
| Lärare: Klasser, Statistik (Ämnen/Läsresan/MM/Live), Synlighet | PASS |
| Modul-synlighet (6A, Plugga av) | PASS – länken försvinner och direkt-URL skickas till Hem. Återställt |
| Klass-lås (6A → Vikingatiden) | PASS – Läsresan och andra områden skickas om till målet, och sidan visar "Fokus just nu". Upplåst igen |

## Fynd till lead (förslag på fix-issues)

**F1 – Live-elevvyn scrollar 4 px på 1366×768 (krav: ingen scroll).**
Gäller lobby, nedräkning, spel och vinnarskärm, och en scrollbar syns i högerkanten.
Orsak: `src/live/live.css:12` `.live-elev { min-height: calc(100vh - 80px) }`. Main har padding 24 + 60 = 84 px, så sidan blir 772 px.
Fix: `calc(100vh - 84px)`, eller ännu bättre en höjd som inte är hårdkodad mot main-paddingen.

**F2 – En andra flik loggar ut den första fliken tyst (fanns redan före epic:en, men slår hårt mot Live).**
Repro: logga in en elev, öppna appen i en flik till med samma webbläsarprofil. Efter cirka 3 s blir `auth.currentUser = null` i flik 1, men UI:t står kvar.
I Live visar flik 1 "😕 Kunde inte läsa Live-matcher". Svar och närvaro slutar sparas, och alla lyssnare får `permission-denied`.
Det hände 3 gånger av 4 (e01, b02, a02, c02). c02 stod på `#/elev/hus`, så det beror inte på MM/Live.
Det är bara sett i emulator- och proxy-miljön och inte prövat i produktion. Förslag: utred orsaken. Gör också så att `onAuthStateChanged(null)` under en elevsida leder till inloggningen i stället för en trasig sida.

**F3 – Elevdetalj-modalen i lärar-MM ligger kvar vid Tillbaka/hash-byte.**
`.cx-modal-overlay` läggs i `body` och tas inte bort när man byter rutt. Överlägg staplas och täcker nästa sida.
Samma mönster finns redan i `teacher-class-detail.js` och `teacher-lasresan-elev.js`. Liten sak.

**F4 – Statistik → Live visar "–" för en avslutad match utan `result`.**
`result` skrivs bara av en lärarklient: en projektor som är öppen vid slutet, eller när någon öppnar matchen under Live → Historik.
Om ingen lärare tittar blir klassstatistiken tom tills någon öppnar historiken. Det syntes med seedens `historik-demo`.
Förslag: räkna ut värdet från `counters` när `result` saknas (`getCounters` finns redan).

**F5 – Observation:** en klass med Fokusläge (klass-lås) kommer ändå in i Live-lobbyn. Det är troligen önskat, eftersom läraren själv bjuder in, men lead bör bekräfta.

**F6 – Observation:** "Följ tävlingen" i lärar-MM uppdateras med knappen *Uppdatera* och inte i realtid. Det går enligt specen, men det är bra att veta.

**F7 – Testskuld (fanns redan):** `test/e2e-auth.test.mjs` test 2 ("elev1 ska INTE kunna läsa elev2:s studentData") faller både här och på `origin/main`.
Orsaken är att #114 öppnade läsning av `studentData` för inloggade (`signedIn() && !husLast`), så testet är inaktuellt.
Testet ingår inte i `test:rules`.

## Inte verifierat

- Fullskärm och ljud på riktigt. Knapparna finns och ljudetiketten byts ("Klicka för ljud" → "Ljud på"), men headless Chromium kan inte visa fullskärm och spelar inget ljud.
- Riktig Chromebook-hårdvara och prestanda med 60 riktiga klienter. Simulatorn klarade cirka 47 svar/s mot emulatorn.
- Produktion. Inga regler eller index är deployade (enligt issue-reglerna).
- Emoji visas som rutor i skärmdumparna eftersom headless saknar emoji-typsnitt. Det är miljön och inte en bugg.
