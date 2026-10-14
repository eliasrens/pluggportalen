# Datakuppen 💾 – regler, konfiguration, koder och filtyper

Datakuppen är ett Live-format (`format: "datakuppen"`, epic Datakuppen
#651–#655). Eleverna svarar i egen takt, öppnar filer, samlar **data (MB)** och
kan **hacka** en klasskamrat genom att knäcka hens hemliga kod. Mest data när
tiden är ute vinner. Formatet bygger på den gemensamma kistspelsmotorn
(`src/live/kistspel/`, samma som Guldrushen) – se
[`LIVE-FORMAT.md` §1.1–1.2](LIVE-FORMAT.md). Uppdraget (specen):
[`UTVECKLINGSUPPDRAG_DATAKUPPEN.md`](UTVECKLINGSUPPDRAG_DATAKUPPEN.md).
Datamodellen och vem som får läsa vad: [`DATAMODELL.md`](DATAMODELL.md),
avsnittet *Datakuppen*.

---

## 1. Reglerna

| Moment | Vad händer | Var det avgörs |
| --- | --- | --- |
| **Kod** | I lobbyn väljer eleven en hemlig kod bland **4 förslag** ur kodlistan. Eleven skriver aldrig in en egen kod. Inget val före start → servern väljer en | `pickCode` (server), `dk-kodval.js` / `dk-kod-vy.js` |
| **Rätt svar** | Tre krypterade filer – eleven öppnar en. Servern avgör innehållet (vikterna i filtabellen) | `openFile` (server), `dk-filer.js` |
| **Filerna** | Data (+MB), Överklockning (dubblar, högst +150), Virus (−10 %, aldrig allt), Tom mapp, Brandvägg (skydd 60 s), Hack | `delat/files-config.js` |
| **Hack, steg 1** | Välj en klasskamrat (~10 s, annars slumpar servern). Skyddade, den du hackade senast och de med för lite data går inte att välja. Ingen att välja → Mapp i stället | `chooseTarget`, `dk-offer.js` |
| **Hack, steg 2** | Tre koder – en är rätt. **En gissning.** Rätt → 15 % av målets data flyttas i en transaktion, målet får 30 s skydd och "Välj ny kod". Fel → inget flyttas, koden **stryks** | `guessCode`, `dk-kodkort.js` |
| **Minnesmomentet** | Nästa gång samma elev hackar samma mål visas samma koder **minus de strukna**, i ny ordning. Byter målet kod börjar det om (nya lockkoder, inga strukna) | `dkSecret/{hackare}.hacks[mål]` (server), `createHackMemory` i `dk-elev.js` |
| **Bli hackad** | Notis ("Omar knäckte din kod och tog 45 MB!"), 30 s skydd och 4 nya kodförslag (~10 s, annars väljer servern). Spelet stannar aldrig | `dk-notis.js`, `dk-kod-vy.js` |
| **Trygghet** | Inget nollställer, ingen förlorar allt, ingen kan hackas när den är skyddad, inte samma mål två gånger i rad. Ingen placering som nummer på elevskärmen | kistmotorns `victimProblem` (delad med servern) |
| **Lockkoderna** | Kommer ur samma lista, har ungefär samma längd som rätt kod och är aldrig någon spelares aktuella kod. Klienten kan inte se vilken som är rätt | `pickDecoys`, `hackOptions` i `delat/datakuppen-regler.js` |
| **Pluggmynt** | Bara efter matchen, enligt `live-rewards` (placering ur data + rätt svar). Data blir aldrig pluggmynt under matchen | `src/live/live-rewards.js` |

Säkerhetstipsen (spec §1.7) roterar i lobbyn och på finalskärmen
(`DK_TIPS` i `files-config.js`).

---

## 2. Lärarens inställningar

Sätts i Live-formuläret (`setupFields` i `src/live/formats/datakuppen/index.js`)
och låses vid skapandet – utom *Visa namn*, som läraren får slå av och på under
matchen.

| Inställning | Fält på sessionen | Standard |
| --- | --- | --- |
| Innehåll: Multiplikation 0–10 eller quiz ur ett arbetsområde (+ tidslinjefrågor) | `gameMode`, `quiz` | – |
| Svarssätt: skriv själv / flerval (quiz = flerval) | `answerKind` | skriv själv |
| Speltid: 3, 5, 10, 15, 20, 30 min eller egen tid 1–60 min | `durationSeconds` | 10 min |
| Hackning på/av (av = bara datafiler, Hack-filens vikt fördelas på datafilerna) | `hacking` | på |
| Visa namn i händelseflödet på projektorn | `showNames` | på |
| Pluggmynt (förstapris, per rätt, tak) | `rewards` | se `rewards-config.js` |
| 1–3 klasser | `participatingClassIds` | – |

---

## 3. Konfiguration – var rattarna sitter

Allt som rör reglerna sitter i **`src/live/formats/datakuppen/delat/`** och delas
med servern. `functions/datakuppen/` är en **genererad kopia** – ändra bara i
`src/` och kör `npm run sync:kistspel` (`firebase deploy` gör det som
`predeploy`; `test/live-datakuppen.test.js` fäller en kopia som glidit isär).
Ändrade regler kräver **functions-deploy** för att gälla på riktigt.

| Fil | Innehåll |
| --- | --- |
| `delat/files-config.js` | `DK_FILES` (filtabellen), `DK_CURRENCY` (namn/enhet/ikon), `DK_EVENT_TEXTS`, `DK_ANON`, `DK_RULES`, `DK_TIPS` |
| `delat/koder.json` | Kodlistan (§4) |
| `delat/datakuppen-regler.js` | Spelreglerna som ren logik: kistmotorn med Datakuppens tabell (`DK_REGLER`), `codeOk`, `codeList`, `codeOffers`, `pickDecoys`, `hackOptions` |

`DK_RULES` – tiderna och gränserna (servern kontrollerar alla):

| Ratt | Värde | Betyder |
| --- | --- | --- |
| `chestsOffered` | 3 | filer att välja mellan efter ett rätt svar |
| `shieldMs` | 60 000 | Brandväggens skydd |
| `protectionMs` | 30 000 | skydd efter att ha blivit hackad |
| `victimPickMs` | 10 000 | tid att välja mål (steg 1) |
| `codeGuessMs` | 10 000 | tid att välja kod (steg 2); ute = misslyckat |
| `codePickMs` | 10 000 | tid att välja ny kod efter att ha blivit hackad |
| `victimGraceMs` | 5 000 | nätverksmarginal efter varje nedräkning |
| `codeOffers` | 4 | kodförslag (lobbyn + efter hack) |
| `codeOptions` | 3 | koder i ett hackförsök (1 rätt + 2 lockkoder) |
| `minChestGapMs` | 1 000 | minsta tid mellan två filer per elev |
| `maxGold` | 1 000 000 | tak för data |

Andelarna sitter på filerna: Hack `effect.share` 0.15, Virus `effect.share`
0.1, Överklockning `effect.cap` 150.

---

## 4. Lägga till eller ta bort koder

Koderna står i `src/live/formats/datakuppen/delat/koder.json`:

```json
{ "koder": [ { "kod": "f0tb01l", "ord": "fotboll" }, … ] }
```

- En kod gäller bara om den har **bara a–z och 0–9**, **minst en siffra** och
  **minst tre bokstäver** (inga å/ä/ö, inga stora bokstäver, inga tecken).
  Ogiltiga koder och dubbletter hoppas över tyst (`codeList`), men *Test 2b*
  (`test/live-datakuppen.test.js`) kräver att **alla** poster är giltiga och
  unika – och att listan har **exakt 100** koder (specen). Byter du ut en kod
  behåller du antalet; vill du ha fler, ändra talet i testet samtidigt.
- Gör koden av ett roligt, barnvänligt ord med 2–3 bokstäver utbytta mot
  siffror (o→0, i/l→1, e→3, a→4, s→5, b→8 …). Inga namn, inga varumärken.
  `ord` är bara en anteckning – den visas aldrig.
- Håll längderna blandade men inte extrema: lockkoderna väljs med ungefär samma
  längd som rätt kod, och elevvyn skalar koder upp till 11 tecken.
- Efter ändringen: `npm run sync:kistspel`, kör enhetstesterna, och
  functions-deploy (servern läser sin kopia).

---

## 5. Lägga till en filtyp

En filtyp är **en post i `DK_FILES`** (`delat/files-config.js`) – servern,
elevvyn och projektorn läser samma post:

```js
{
  id: "molnet", icon: "☁️", label: "Molnet", rarity: "ovanlig", weight: 5,
  effect: { kind: "gold", amount: 40 },
  look: "molnet", sound: "beep-dubbel",
  eventText: "☁️ {namn} hämtade {belopp} MB ur molnet",
  feedText: "> {namn}: molnet +{belopp} MB",
}
```

1. **Effekten** (`effect.kind`) måste vara en som kistmotorn redan kan:
   `gold` { amount }, `double` { cap }, `lose` { share }, `empty`, `shield`,
   `steal` { share } (+ `fallback`). En helt ny sorts effekt kräver ändringar i
   `src/live/kistspel/delat/ks-regler.js` och i servern
   (`functions/kistspel-core.js`) – och i Guldrushen, som delar motorn.
2. **Vikten** (`weight`) är relativ – sannolikheten = vikten / summan av alla
   vikter. Med Hackning av fördelas Hack-filens vikt på `gold`-filerna.
3. **Texterna:** `eventText` (elevens notis, händelsen) och `feedText`
   (projektorns terminalrad, **högst ~32 tecken** med ett sexbokstavsnamn – testat
   i `test/live-datakuppen-projektor.test.js`). `{namn}`, `{belopp}`, `{offer}`
   byts; med *Visa namn* av blir de "Någon" / "en klasskamrat". Emoji ska vara
   äldre än Emoji 13 (`test/mynt-ikon.test.js`).
4. **Ikonen:** lägg en SVG under filens `id` i `FILES` i
   `src/live/formats/datakuppen/dk-ikoner.js` (annars ritas Liten fil). Emojin i
   `icon` är bara beskrivning.
5. **Utseendet:** `look` blir `data-look` på filen i elevvyn – lägg eventuell
   särskild stil i `datakuppen-filer.css` (`.dkf-fil[data-look="molnet"]`).
6. **Ljudet:** `sound` är en nyckel i `DK_SOUNDS` (`dk-ljud.js`); en ny nyckel =
   en ny rad där.
7. **Projektorn:** stora filer kan få eget ljud (`bigChests` i
   `dk-proj-scen.js`), små filer gallras först vid trängsel (`small`).
8. Kör `npm run sync:kistspel`, enhetstesterna och `npm run test:functions`,
   och prova filen i demoläget (§6) – filknapparna byggs ur `DK_FILES`.
9. Functions-deploy innan filen kan komma i en riktig match.

**Ta bort** en filtyp: ta bort posten. `id`:n står i gamla händelser och svar
(`answers.chest`) – vyerna faller tillbaka på Liten fil-ikonen, så gamla
matcher går fortfarande att öppna. Byt aldrig namn på ett `id` som använts.

---

## 6. Demoläge och förhandsvisningar

Ingen Firestore, inga Cloud Functions, inga pluggmynt (sessionen har
`demo: true`; sidorna blockerar och räknar alla Firebase-anrop). Öppna med
`npm start` → `http://localhost:8000/preview/…`.

| Sida | Vad |
| --- | --- |
| `preview-datakuppen-demolage.html` | **Demoläget (#655)**: projektorn och Almas elevskärm sida vid sida i samma påhittade match, med en guidad genomgång – 30 elever med avatarer, hemlig kod, varje filtyp, ett misslyckat och ett lyckat hack, minnesmomentet, bli hackad → byt kod, brandvägg och skydd, milstolpe, tid snart slut, pallen och historiken i lärarvyn. `?auto=1` spelar upp allt direkt |
| `preview-datakuppen-demo.html` | Projektorn ensam med kontrollpanel (#654) – lobby, 1/5/25 elever, statistik, två klasser, varje fil, händelsestorm, pall med delad placering |
| `preview-datakuppen-elev.html` | Elevvyn ensam mot låtsasservern (#653) – serverns svarstid, tvinga nästa fil, bli hackad |
| `preview-datakuppen-historik.html` | Historiken och Statistik → Live för en demomatch (#655) |

Koden: `dk-demo.js` (projektorn, på `src/live/kistspel/ks-demo.js`) och
`preview/datakuppen-elev-sim.js` (låtsasservern med formatets delade regler).
I demoläget delar de **samma spelardokument** (`shared: true`): eleven på
elevskärmen är en av de 30, data som flyttas där syns på projektorn, och
projektorn får händelsen (`logFile`, `logHack`, `logHackFail`). Demots
`skip`-mängd håller den automatiska svarsströmmen borta från henne.

---

## 7. Historik och lärarstatistik

Lärarsidan → Live → en Datakuppen-match (`datakuppen-history.js`, på den
gemensamma kistspelsmallen `src/live/kistspel/ks-historik.js`):

- vinnaren, **pallplats** (delad placering), **klassens data** tillsammans
- **hackrutan**: antal hackförsök, andel lyckade och misslyckade – för hela
  klassen, aldrig per elev (`result.hacks`)
- **topplista** med rätt/fel/filer/data, **Pluggmynt** och varje elevs felsvar
- **andel rätt per uppgift/fråga** och **per kategori/tabell** (spellägets
  `statKeys`)

Statistik → Live (en klass): matchraden får Rätt · Data · **Hack** (lyckade /
försök och andel, `result.hacksByClass`) och en sammanfattning per tabell /
kategori med klassens svåraste uppgifter.

---

## 8. Tester

| Svit | Fil |
| --- | --- |
| Format, filtabell, kodlista, lockkoder, synk | `test/live-datakuppen.test.js` |
| Elevvyns logik | `test/live-datakuppen-elev.test.js` |
| Projektorns logik, ljud, musik | `test/live-datakuppen-projektor.test.js` |
| Historik + lärarstatistik | `test/live-datakuppen-historik.test.js` |
| Demoläget (filtyper, hack, minnet, byt kod, isolering) | `test/live-datakuppen-demo.test.js` |
| Regler (vem läser vad) | `test/firestore-rules-live-datakuppen.test.js` (`npm run test:rules`) |
| Servern + attacktesterna | `test/functions-datakuppen*.test.mjs` (`npm run test:functions`) |

Enhetstesterna körs utan emulator: `node --test test/live-*.test.js`.
