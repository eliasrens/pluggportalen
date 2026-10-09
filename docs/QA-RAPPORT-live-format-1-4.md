# QA-rapport – Live format 1/4 (#549, epic #546)

Regressions-QA av formatregistret (#547) + formatväljaren (#548) på
epic-grenen `ed6f39a`. Frågan: är Klassmatchen **oförändrad**?

**Resultat: allt grönt, 0 buggar.** Inga konsolfel i någon flik under hela körningen.

## Testsviter

| Svit | Resultat |
| --- | --- |
| `test/` (alla enhetstester, utom regel/e2e/functions) | 1315 / 1315 |
| `npm run test:rules` (25 filer) | 345 / 345 |
| `npm run test:e2e` | 5 / 5 |
| `npm run test:functions` | 6 / 6 |

## Metod: jämförelse mot main sida vid sida

Samma emulator (Firestore 8549 / Auth 9549, `admin/qa-trollkarlsduellen-preview.sh`)
serverades av två proxys: epic-grenen på 8550 och **main före epicen**
(`0f7097a`, `git archive`) på 8551. Samma data, samma lärare. Det gör "exakt som
förut" mätbart: HTML-hashar och skärmdumpar jämförs direkt.

## Acceptanstest 1 – gammal session utan `format`

Två avslutade sessioner utan `format`: `historik-demo` (seed, utan `result` →
räknas om ur räknarna) och `gammal-pris` (result + `coinPrize: 300`, byggt med
main:s `live-core.buildResult`).

| Vy | epic vs main |
| --- | --- |
| Historiklistan | identisk HTML (sha `af8406ce…`) |
| Detaljvy `historik-demo` (omräknad, 340/17 mot 418/22) | identisk HTML (`43cdf205…`) |
| Detaljvy `gammal-pris` (pris-raden) | identisk HTML (`9668397e…`) |
| Statistik → Live (klass 4B) | identisk HTML (`e4b37973…`) |

Ej utbetalt pris i en gammal session betalas när historiken öppnas, en gång (+300 till 4B).

## Acceptanstest 2 – Klassmatchen 4B mot 5E, 20 min, multiplikation

Allt skapat via UI:t, elevsvar via `admin/qa-mm-live-sim.mjs` (riktiga
klientskrivningar som reglerna prövar) plus en riktig elev (b18) i en egen
webbläsarkontext.

| Steg | Resultat |
| --- | --- |
| Lärarformuläret: tomt och med 4B+5E (nämnare, trollkarlsval, längd, pris) | pixel- och textidentiskt med main ([01](qa-live-format-549/01-larformular-4b-5e.jpg), [01b main](qa-live-format-549/01b-larformular-main-jamforelse.jpg)) |
| Sessionsdokumentet | alla gamla fält oförändrade + `format: "klassmatch"`, `durationSeconds: 1200`, `coinPrize: 1000` |
| Lobby: redo per klass (15/18), nämnare, trollkarlar, pris | ✅ [02](qa-live-format-549/02-lobby.jpg) |
| STARTA MATCH → 3–2–1–KÖR! | ✅ (fångad med MutationObserver: 3, 2, 1, KÖR!) |
| Serverstyrd timer | ✅ räknar ur `startedAt` + längd |
| Raketrace / Statistik / Dragkamp / Trollkarlsduellen | ✅ [03](qa-live-format-549/03-raketrace.jpg) [04](qa-live-format-549/04-statistik.jpg) [05](qa-live-format-549/05-dragkamp.jpg) [06](qa-live-format-549/06-trollkarlsduellen.jpg); 160÷20 = 8,0 och 150÷22 = 6,8 |
| Elevskärm i eget fönster (#533) | ✅ vybyte och ljud på/av når skärmen via BroadcastChannel (`state`-meddelanden avlyssnade) |
| Ändra nämnare under match (#543) | ✅ 4B 20→16: 10,0 direkt på elevskärmen |
| Sen anslutning + omladdning (riktig elev) | ✅ gick med under match, 3 rätt + 1 fel; efter omladdning kvar med 3 rätt |
| Automatiskt matchslut → vinnarskärm | ✅ [07](qa-live-format-549/07-vinnarskarm.jpg); `result` skrivs, eleven ser "VINNARE – 4B! Du fick 3 rätt!" |
| Mynt-pris (#526) | ✅ +1000 till 4B:s kassa en gång (`kassaHistorik/live-<sid>`) |
| Pokal `live-vinst` | ✅ `classCenters/4b/trophies/live-vinst-<sid>` |
| Radera ej startad session (#543) | ✅ "4A mot 3A" borttagen (bekräftelsedialog) |
| **Lobby utan `format` (`trollkarl-demo`) startad och spelad** | ✅ 3–2–1–KÖR!, Trollkarlsfinal "4B VINNER!", pris 50 ([08](qa-live-format-549/08-trollkarl-final-gammal-session.jpg)); dokumentet får **inget** `format` skrivet |
| Mattematchen | ✅ elev svarar (274→275 poäng), lärarfliken listar tävlingen |

**Kooperativt läge / `live-avklarat` (#495):** inget spelläge har `cooperative: true`
i dag, så det går inte att köra i UI:t. Det täcks av `test/live-formats.test.js`
(buildResult tävling + kooperativt, mål nått/ej = före refaktorn, 2 000 slumpfall)
och av regeltesterna för pokalen.

## Boot

- Kall laddning (cache tömd) av elevstart (`b05`, `#/elev/hus`) och lärarsidan: inga konsolfel.
- Statiska bootgrafen: oförändrad mot main (samma antal filer, ingen `src/live/`-fil).
- Observation (ingen bugg): `live-watch.js` laddas **dynamiskt** vid varje elevstart och drar nu
  med sig 6 fler moduler än förut (29 → 35: `formats/*`, `live-formats.js`,
  `live-setup-fields.js`, `live-time.js`). Det är fångat (try/catch i `ui.js`), så det
  kan inte ge vit sida, men det är lite extra laddning på varje elevstart.

## Att veta före merge

- Ingen regel-deploy krävs för att Klassmatchen ska fungera: gamla regler har ingen
  nyckel-vitlista på `liveSessions`, så fältet `format` accepteras redan. Den nya
  `liveFormatOk` bara stramar åt.
- QA-sätt att förkorta en pågående match: flytta `startedAt` (och `endsAt`) bakåt.
  Bara `endsAt` påverkar inte – tiden räknas ur `startedAt` (som i main).
