# Trollkarlsduellen – arkitektur (#536, epic #535)

Analys enligt spec §18 + modulkarta + kontrakt för del C (attackmotor) och E
(ljud/final). Spec: `docs/spec-trollkarlsduellen.md`.

## §18 – hur Live fungerar idag

1. **Uppbyggnad.** Allt i `src/live/` (bara dynamiskt importerat, aldrig i
   bootgrafen). Firestore: `liveSessions/{sid}` (status `lobby → live →
   finished`, `startedAt`, `endsAt`, `classDivisors`, `result` …) med
   `players/`, `answers/` och shardade `counters/`. `live-data.js` = enda
   Firestore-lagret, `live-core.js` = ren logik, `live-feed.js`
   (`subscribeLiveSession`) räknar ett färdigt tillstånd ~4 ggr/s och vid
   varje ändring.
2. **Projektorvyer registreras** i `VIEWS` i `projector.js`:
   `{ id, label, create, only2? }`. `create(host, { st, colors }) → {
   update(st), destroy() }`. Vyn monteras om bara när nyckeln
   `vy|klass-id:n` ändras, annars `update(st)`.
3. **Läraren väljer vy** i projektorns verktygsrad (flikar + tangent 1–n).
   Valet är LOKALT per webbläsare (`localStorage pp:live:vy`). Elevskärmen
   (#533, `&skarm=elev`) följer panelens vyval/ljud via BroadcastChannel och
   hämtar matchen själv ur Firestore.
4. **Matchdata** = `st` från `subscribeLiveSession`: `session, phase, msLeft,
   clock, classes[{classId, name, correct, divisor, score, joined, ready}],
   leaderIds, winnerId, draw, result, now`.
5. **Snittet**: `classStandings` – `score = correct / divisor`, där
   `divisor` = lärarens nämnare (förifylld med klassens elevantal, kan ändras
   under matchen). Visas med en decimal (`formatScore`, "24,6").
6. **Matchklockan**: `phaseAt(session, serverNow())` ur `startedAt +
   countdownSeconds + durationSeconds` mot server-korrigerad tid
   (`live-clock.js`). Projektorn tickar sin timer 10 ggr/s; `st.clock`/
   `st.msLeft` uppdateras minst varje sekund.
7. **Matchslut**: vid 00:00 blir fasen `ended` (status fortfarande `live`) →
   `autoFinish` sätter `finished`. Läraren kan också "Avsluta". 2,5 s senare
   skriver en lärarklient `result` en gång (`writeResultIfMissing`,
   `result.winner` = klass-id eller `"draw"`). `decideWinner`: exakt högst
   poäng vinner, lika = oavgjort. Projektorn byter till `proj-winner.js`.
8. **Ljud/fullskärm**: `proj-sound.js` syntetiserar med Web Audio (inga
   filer), på/av lokalt (`pp:live:ljud`), låses upp av första användargesten,
   tystas på panelen när en elevskärm spelar. Fullskärm =
   `root.requestFullscreen()`, verktygsraden göms när musen står still.

## Beslut

- **Ingen ny poänglogik.** Matchpoäng/ledare/vinnare kommer ur `st`
  (`classStandings`/`decideWinner`), slutresultatet ur `st.result.winner`
  (fallback `st.winnerId/draw` om result dröjer > 4 s).
- **Magipoäng** = klassens absoluta `correct` i matchen. `attacker =
  floor(correct/100)`, `mätare = correct % 100`. Påverkar aldrig något i
  Firestore.
- **Vyn äger sin final.** `VIEWS`-posten har `finale: true` → vid `finished`
  ligger Trollkarlsduellen kvar (samma nyckel, ingen ommontering) och spelar
  sin final + resultatskärm i stället för `proj-winner.js`. Projektorns egen
  vinnarfanfar hoppas över för sådana vyer.
- **Lat laddning.** `projector.js` pekar bara på en loader som gör
  `import("./trollkarl/trollkarl-vy.js")`; inga filer i bootgrafen.
- **Trollkarlsval** sparas i sessionen: `wizards: { classId: "rasmus" |
  "elias" }` (bara tvåklassmatcher, alltid en av varje, ändras bara i
  lobbyn – firestore.rules). Saknas/ogiltigt → klass 1 = Rasmus, klass 2 =
  Elias. Väljs i "Skapa Live-match" och kan bytas i lobbyn.
- **Omladdning spelar inget igen.** Första renderingen efter montering hoppar
  till nuvarande läge (inga gamla attacker). "Senast sedda attackindex" och
  "finalen visad" sparas i `sessionStorage` per session (per FÖNSTER – panel
  och elevskärm i samma webbläsare stör inte varandra).

## Modulkarta – `src/live/trollkarl/`

| Fil | Ansvar (spec §19) |
|---|---|
| `trollkarl-val.js` | Trollkarlsval: `WIZARDS`, namn, `resolveWizards`, `swapWizards` (ren) |
| `trollkarl-data.js` | **Matchdata**-adapter `duelData(st)` (ren) |
| `trollkarl-magi.js` | **MagicSystem**: `magicState`, `createMagicTracker`, `attackSeed`, `seededRandom` (ren) |
| `trollkarl-register.js` | Attack-/final-/ljudregister (C, D, E fyller) |
| `trollkarl-regi.js` | Händelsebuss + **animationskö** med prioritet (ren, utan DOM) |
| `trollkarl-arena.js` | **ArenaRenderer**: bakgrund, ljus, dekor, partiklar |
| `trollkarl-hud.js` | Klassnamn, trollkarlsnamn, matchpoäng, ledning, klocka |
| `trollkarl-matare.js` | Magimätarna (§7) |
| `trollkarl-scen.js` | Scenobjektet attacker/finaler får (lager, ankarpunkter, banner, ljud) |
| `trollkarl-figurval.js` | EN rad: vilken figur som används (platshållare → B:s `trollkarl-figur.js`) |
| `trollkarl-platshallare.js` | Platshållarfigur med B:s `createWizard`-API |
| `trollkarl-platshallare-effekter.js` | Platshållar-attack + platshållar-finaler |
| `trollkarl-innehall.js` | Manifest: importerar alla attack-/finalmoduler |
| `trollkarl-vy.js` | Vyn: sätter ihop allt (`createTrollkarlView`) |
| `trollkarl.css` | Stilar (scopat `.tk`) |

Arenan ritas i ett fast designrum **1600 × 900** som skalas in (letterbox,
inget klipps). Alla koordinater i scenen (ankarpunkter, effekter) är i
designrummet.

## Kontrakt för del C (attacker) och D

```js
import { registerAttack } from "./trollkarl-register.js";
registerAttack({
  id: "grodifix",            // unikt
  name: "GRODIFIX!",         // visas som attackbanner
  durationMs: 6500,          // ungefärlig längd; kön avbryter efter durationMs + 4 s
  async run(scene, a) { ... } // se nedan
});
```
Lägg modulen i `trollkarl-innehall.js` (en importrad). `run` får:

- `a.from`, `a.to`: `{ classId, who: "rasmus"|"elias", side: "left"|"right",
  wizard }` där `wizard` = `createWizard`-API:t (B).
- `a.index` (klassens attacknummer 1, 2, 3 …), `a.seed` (uint32,
  deterministiskt ur session + klass + index), `a.rng()` (seedad 0–1).
- `a.signal` (AbortSignal) – avbryts vid matchslut. Kolla `signal.aborted`
  mellan stegen / använd `scene.wait(ms, signal)` (kastar vid abort).
- `scene.fx` = effektlager OVANFÖR figurerna (under HUD), `scene.fxBack` =
  bakom figurerna. Varje attack får ett eget barn-lager (`scene.layer()`) som
  tas bort automatiskt efteråt.
- `scene.point(wizard, "wandTip"|"head"|"hat"|"body"|"feet")` → `{x, y}` i
  designrummet.
- `scene.banner(text, side)` attacknamn, `scene.state(side, STATE)` sätter
  §11-tillstånd (för CSS/test), `scene.sound(name)` spelar ett registrerat
  ljud, `scene.reducedMotion`.

Kön garanterar: en attack i taget (FIFO, båda klasserna köas), uppladdning
(`charge`-pose + glödande mätare) före `run`, och efter `run` (klar, kastad,
avbruten eller timeout) `reset()` på båda figurerna, effektlagret rensat och
idle på igen. Valet av attack: `pickAttack(seed, avoidId)` –
deterministiskt, aldrig samma två gånger i följd för samma klass (om ≥ 2
attacker finns). Platshållaren (`placeholder: true`) används bara tills
riktiga attacker registrerats.

### Burst-komprimering (#538)

Vid lång kö tappas inget – allt spelas, men snabbare: `rushFor(pending)`
(`trollkarl-regi.js`) ger `{ speed, skipCharge }`. Vyn hoppar över
uppladdningen vid `skipCharge` och ger attacken `a.speed` (≥ 1) plus
`a.wait(ms)` (= `scene.wait(ms / speed, signal)`). Skriv därför ALLA pauser
med `a.wait(ms)` och alla WAAPI-tider med `dur(scene, a, ms)` ur
`attacker/attack-verktyg.js` – då komprimeras attacken automatiskt (och
respekterar `prefers-reduced-motion`). Timeouten i kön skalas också med
`speed`.

### Attacker 1–8 och hur del D lägger till 9–15 (#538)

Attackerna ligger i `src/live/trollkarl/attacker/` – en modul per GRUPP som
bara registrerar sig (`registerAttack`) och importeras med EN rad i
`trollkarl-innehall.js`:

| Modul | Attacker |
|---|---|
| `attacker-forvandling.js` | 1 GRODIFIX! · 2 HÖNUS PANIKUS! · 3 POTATUS TOTALUS! |
| `attacker-vader.js` | 4 REGNUS MAXIMUS! · 8 FJÄDRUS STORMUS! |
| `attacker-kladd.js` | 5 STINKUS MAXIMUS! · 6 BANANUS HALKUS! · 7 SLEMMUS BLÄÄÄUS! |

Så lägger del D till attack 9–15: ny modul (t.ex. `attacker-rorelse.js`)
som registrerar sina attacker + en importrad i manifestet – klart (demot,
slumpvalet och kön hittar dem via registret). Byggstenar:

- `attack-verktyg.js`: `dur`, `spawn`, `anim`, `fly` (projektil med
  båge/rotation), `poff` (POOF-moln + text), `burst` (partiklar, globalt
  tak `PARTIKEL_TAK` = 120, färre vid reducedMotion), `upptakt`
  (standardupptakt kastare/offer), `riggaOverlay`.
- `attack-figurer.js`: groda/höna/potatis som SVG-strängar till
  `wizard.transform()` (identitetsdrag per trollkarl + hatt i klassfärg).
- `attacker.css`: effektklasser (`.tk-layer > *` är redan absolut
  positionerat). Laddas av vyn via `ensureLiveCss`.
- Attackdefinitionen har `sounds: ["swisch", …]` – nycklarna attacken
  spelar via `scene.sound(namn)`. Del E registrerar ljuden; tills dess är
  de tysta. Använda nycklar: `uppladdning`, `swisch`, `poff`, `kvack`,
  `virvel`, `kackel`, `suck`, `regn`, `plask`, `tornado`, `nys`, `stank`,
  `halk`, `duns`, `splatt`.
- Kolla `a.signal.aborted` mellan stegen och städa egna "kvarlämnade"
  element (lagret tas bort automatiskt, men `fill: forwards`-element som
  ska bort mitt i attacken tar du bort själv).

## Kontrakt för del E (final + ljud)

```js
registerFinale({ id: "energikula", kind: "win", async run(scene, f) { ... } });
registerFinale({ id: "krock",      kind: "draw", async run(scene, f) { ... } });
registerSound("grodifix-kvack", (ac, out, t) => { /* Web Audio-noder → out */ });
```
- `f.winner`/`f.loser` (som `a.from`/`a.to`, null vid oavgjort), `f.draw`,
  `f.sides` (båda), `f.rng`, `f.signal` (bara vid destroy).
- Finalen startas EXAKT EN gång per session och fönster (`onFinale`); vid
  omladdning efter slutet visas resultatskärmen direkt. Efter `run` visar vyn
  resultatkortet ("🏆 5E VINNER!" / "OAVGJORT!", poäng, mynt-pris). Figurerna
  återställs INTE efter finalen (segerposen ligger kvar).
- `pickFinale(seed, kind)` väljer variant deterministiskt.
- Ljud: `scene.sound(name)` → `proj-sound.js` `fx(fn)` som bara spelar när
  ljudet är på, upplåst och inte tystat (elevskärmen spelar i stället).
  Ingen egen AudioContext.

### Del E är byggd (#540)

- **Ljuden** ligger i `trollkarl-ljud.js`: alla nycklar ur listan ovan + HUD/
  klocka (`matare-full`, `spanning`, `nedrakning`) + finalens (`final-mork`,
  `final-laddning`, `final-skott`, `final-explosion`, `forvandling`,
  `segerfanfar`, `jubel`, `fyrverkeri`, `konfetti`, `oavgjort-krock`,
  `skratt`, `drake`, `grat`). Okänd nyckel (t.ex. en ny attack i del D)
  faller tillbaka på det generiska glittret `"*"` (`getSound`), så nya
  attacker aldrig är helt tysta. Kaosskydd: per-ljud-spärr (minGap), globalt
  tak på ljudstarter per 300 ms och en gemensam kompressorbuss med volymtak.
- **Finalerna** i `final/`: vinst `energikula` · `potatis-gigantus` ·
  `drakus-finalus` (§14.3), oavgjort `magisk-krock` (§14.4); delade
  byggstenar i `final-verktyg.js`, stilar i `final.css` (prefix `tkf-`).
- **En gång-valet**: omladdning efter slutet visar resultatskärmen DIREKT
  utan att spela om finalen (`tracker.finaleSeen()` i sessionStorage per
  fönster + `STALE_FINALE_MS` för gamla matcher) – inte proj-winners
  CELEBRATE-fönster, eftersom finalen är lång och elevskärm/panel i samma
  webbläsare inte ska triggas om varandra.

## Händelsebuss och prioritet (§11, §14, §16)

`createDirector()` i `trollkarl-regi.js`:

- `attack({from, to, index, seed})` → köas (prioritet ATTACK 3).
- `finale({winnerId | draw})` → EN gång; avbryter pågående attack, tömmer kön
  (FINALE 4).
- `stop()` vid 00:00: inga nya attacker, pågående avbryts kontrollerat.
- Uppladdning (CHARGE 2): mätare ≥ 90 → "fokuserad" figur, bara när inget
  annat pågår. Idle (1): figurens egna småhändelser (`idleEvents(on)`) är
  avslagna så fort något högre pågår.
- `on("attack"|"attack:end"|"finale"|"finale:end"|"state", fn)` för loggning/
  test/ljud.

Poäng och mätare uppdateras alltid direkt i HUD:en – kön blockerar aldrig
dem.

## Demoläge

`preview/preview-trollkarlsduellen.html` (rot): riktiga `mountProjector` med
simulerade deps (ingen Firestore, ingenting sparas utanför webbläsaren).
Knappar för allt i §21 + omladdningstest och trollkarlsbyte.
