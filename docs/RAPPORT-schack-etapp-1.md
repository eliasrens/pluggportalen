# Rapport: Schack – Etapp 1 (epic #772)

Slut-QA (#777) av Etapp 1 i [`UTVECKLINGSUPPDRAG_SCHACK.md`](UTVECKLINGSUPPDRAG_SCHACK.md)
§0–§5: brädet, reglerna och datorn. Arkitekturen och API:t står i [`SCHACK.md`](SCHACK.md).
QA gjord 2026-10-18 på epic-grenen (0117511) + rättningarna i den här grenen.

**Kort:** allt i §5 fungerar i den riktiga appen. QA:n hittade två fel som gjorde brädet
oanvändbart på mobil och stående surfplatta (F2, F3). Båda är rättade och har fått
regressionstester. Motorn håller 1 s per drag även med 4–6× CPU-strypning. Etapp 1
läser och skriver **ingenting** i Firestore. Bara webben ska deployas.

---

## 1. Vad som byggts

| Del | Issue | Innehåll |
| --- | --- | --- |
| A | #775 | chess.js 1.4.0 vendorad (BSD-2), brädkomponenten (tryck, dra-och-släpp, tangentbord, förvandlingsväljare, animation, slutruta), egna SVG-pjäser, `preview/preview-schack.html` |
| B | #776 | motorn (alfa-beta + quiescence i en Web Worker, 4 nivåer), "Varna mig", Ångra, Tips, partiet i `localStorage`, modulen `schack` (opt-in per klass), sidan `#/elev/schack` |
| C | #777 | den här QA:n, rättningarna F2/F3 och QA-skripten `admin/qa-schack-app.mjs` och `admin/qa-schack-strypt.mjs` |

Flödet: läraren kryssar i **Schack** under Klasser → Synlighet. Eleven ser då **Schack** med en
bonde som ikon i gruppen **Öva**. `#/elev/schack` är startsidan med fyra kort (bara "Spela mot
datorn" är öppet, de andra tre "Kommer snart"). Eleven väljer nivå och färg och spelar. Partiet
finns kvar efter en omladdning.

## 2. Testsviter

| Svit | Resultat |
| --- | --- |
| Enhetstester (`node --test` på alla `test/*.test.*` utom rules/functions/e2e) | **3150 pass, 0 fail, 1 skip** (skippen är en gammal Live-demo-stubbe, inte schack). 160 av testerna är schack-tester i 8 filer. |
| Firestore-regler (`test:rules`-listan mot emulatorn) | **711 / 711** |
| Cloud Functions | körs inte: Etapp 1 rör inte `functions/` (`git diff main -- functions/` är tomt) |
| Bootgrafen (`admin/qa-bootgraf-bfs.mjs`) | **107 filer, identisk med main** (ad98509). Inget ur `src/schack/`. |
| QA i webbläsaren (`admin/qa-schack-app.mjs`, riktiga appen mot emulatorerna) | nivaer **191/191**, bradet **50/50**, hjalp **36/36**, layout **31/31**, kvot **1/1** |

**Miljö:** rules-sviten och webbläsar-QA:n kördes mot Firestore- och Auth-emulatorerna
(Java-jar, slumpade portar). Emulatorerna är nedstängda efteråt. Körs sviterna **utan** emulator
är det väntat att `test:rules`, `test:functions`, `test:e2e` och admin-credential-testerna (som
behöver `firebase-admin`) blir röda. De kräver emulator eller är röda även på basen, och är inga
schack-buggar. Allt annat är grönt utan emulator. För en körning utan emulator finns
`preview/preview-schack.html`, `preview/preview-schack-dator.html`,
`preview/preview-schack-matning.html` och `node admin/qa-schack-matning.mjs`.

## 3. QA i webbläsaren

**Riggen.** Firestore-emulatorn (jar) och Auth-emulatorn startades på slumpade portar. De seedades
med `admin/qa-larkonton-seed.mjs` och `qa-larkonton-roller-seed.mjs` (läraren `qaarskurs4`,
eleverna `4a01`–`4a04`). Appen kördes via `admin/qa-emulator-proxy.mjs` med `QA_RAKNA=1`.
Lärarflödet och fokusläget kördes för hand i webbläsaren. Elevflödet kördes med
`admin/qa-schack-app.mjs`: headless Chromium via CDP med riktiga mus-, touch- och
tangenthändelser (inga interna API:er). Skriptet läser bara av DOM:en och `localStorage`.

```
PORT=<p> FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… QA_RAKNA=1 node admin/qa-emulator-proxy.mjs
node admin/qa-schack-app.mjs http://127.0.0.1:<p> <nivaer|bradet|hjalp|layout|kvot> <elev> [bildmapp]
node admin/qa-schack-strypt.mjs http://127.0.0.1:<p>
```

| Kontroll (spec) | Resultat |
| --- | --- |
| Läraren slår på `schack` för 4A (§4) | ✅ "Schack (av som standard)" med bondeikon. Efter Spara: "dolt för klassen: Hitta rätt!, Ekvationsresan". |
| Innan dess: ingen länk, och en direktlänk till `#/elev/schack` skickas till `#/elev/hus` | ✅ |
| Eleven ser **Schack** med SVG-bonde i gruppen **Öva** (sist, efter Bråkresan) | ✅ syns efter omladdning eller nästa inloggning. Det är samma beteende som för de andra modulerna: klasslistan läses en gång per session. |
| `#/elev/schack`: fyra stora kort, tre "Kommer snart" (`aria-disabled`) | ✅ |
| Alla 4 nivåer × vit/svart/slumpad: brädet vänt (a1 resp. h8 nere till vänster), egen spelarrad nederst | ✅ 12/12 kombinationer, 4 drag var |
| "Varna mig" på som standard för Bonden och Springaren, av för Tornet och Damen | ✅ |
| §2.2 tryck: markering, prick på tom ruta, ring på slag, byta markering, avmarkera (samma pjäs eller någon annanstans), olaglig ruta gör inget | ✅ |
| §2.2 dra-och-släpp med **mus** och **finger** (touch-emulering), olagligt släpp → pjäsen tillbaka och fortfarande markerad, `touch-action: none` | ✅ |
| §2.2 senaste draget (2 rutor, gul ton), röd glöd på kungen i schack + aria "i schack" | ✅ |
| §2.2 förvandling: väljaren med Dam (först, förvald, har fokus), Torn, Löpare, Springare som SVG-bilder. Escape ångrar. Enter tar damen. Springare går att välja. | ✅ |
| §2.2 animation: 150 ms glidning. Med `prefers-reduced-motion: reduce` ingen animation. | ✅ (uppmätt med Web Animations API) |
| §2.2 tangentbord: en tabbstopp (e2), pilarna flyttar, Enter väljer och flyttar. `aria-label` t.ex. "g1, vit springare, markerad", "f3, tom, möjligt drag", "e4, vit bonde, senaste draget". | ✅ |
| §2.3 draglistan dold, "Visa drag" (`aria-expanded`) visar "1. e4 e5 2. Sf3" (svensk notation) | ✅ |
| §2.3 statusraden: "Din tur", "Datorn tänker…", "Schack! Din tur – rädda kungen!", "Schack matt – du vann! 🎉", "Schack matt – datorn vann.", "Du gav upp – datorn vann." | ✅ |
| §5 rockad kort (tryck, vit), kort (dra, svart), lång (tryck); en passant (d6 visas som ring) | ✅ |
| §5 olagliga drag visas inte och går inte: en bunden springare har inga mål och kan inte dras. I schack räddar bara g7–g6. | ✅ |
| §3.3 Varna mig: g4?? (matt i ett) och damen till h6 (kan tas gratis) varnar. Pjäsen står halvgenomskinlig, status "Vänta – läs varningen!". Ångra och Flytta ändå fungerar. Vanligt drag (d3) varnar inte. Tornet utan varning: ingen ruta. Kryssrutan går att slå på och sparas. | ✅ |
| §5 motorn: Damen hittar Dh4# i appen | ✅ |
| §3.3 Ångra (elevens drag + datorns svar), Ångra medan datorn tänker (inget sent svar), Ångra efter matt, Tips (pil + "Tips: Sc3", pilen försvinner vid nästa drag) | ✅ |
| Slutrutan: Spela igen (samma nivå och färg), Byt nivå, Titta på brädet. Ge upp frågar i en ruta på sidan, aldrig `confirm()`. | ✅ |
| §4 parti kvar efter omladdning. Startsidan visar "Du har ett pågående parti … Fortsätt partiet" överst. Omladdning direkt på `?vy=dator` fortsätter partiet. Ett avslutat parti visas inte som pågående. | ✅ |
| Fokusläget: lås 4A till Läsresan medan eleven är på Schack | ✅ eleven flyttas direkt till Läsresan, Schack försvinner ur menyn och direktlänken spärras. Schack finns inte som låsmål (`lockable: false`). |
| 320 px mobil, 360 px, surfplatta 768 × 1024 och 1024 × 768, Chromebook 1366 × 768: brädet ≥ 320 px, 64 rutor på plats, ingen sidledsskroll, varningsrutan syns utan att skrolla | ✅ efter F2/F3 (före: ❌, se nedan) |

**Skärmdumpar** (`design/schack/qa777-*.png`, från appen mot emulatorn; emoji saknas i
headless-Chromium och ser ut som rutor – det gäller bara testmiljön):
lärarens Synlighet (1), elevens meny (2), startsidan (3), nivåvalet (4), schack med röd glöd (5),
förvandlingsväljaren (6), Varna mig (7), slutrutan vid vinst (8), 320 px mobil med varningen (9),
F2 före och efter på 360 px (10, 11) och surfplatta 768 px (12). Brädet, pjäserna och
slutrutorna från förhandsvisningen finns sedan A/B i `design/schack/`.

## 4. Fel och iakttagelser

| # | Allvar | Vad | Status |
| --- | --- | --- | --- |
| **F2** | 🔴 hög | Varnings- och ge upp-rutan i panelen hade klassen `.schack-ruta`, samma klass som brädets 64 rutor. Varje ruta fick därför gul ram, padding och rundade hörn (syns på alla skärmar). Under 820 px fick de dessutom `position: fixed` från F1-rättningen i #776, så **brädet var tomt på mobil och stående surfplatta** (bild 10). | **Rättad** (bf65cd0): panelrutorna heter nu `.schack-fraga`. Test: sidans CSS och panelens markup får inte använda `.schack-ruta`. |
| **F3** | 🟠 medel | På en 320 px-skärm gav sidans marginal (2 × 20 px) bara 280 px åt det minst 320 px breda brädet. Sidan skrollade 40 px i sidled och tryck träffade fel. | **Rättad** (bf65cd0): under 820 px får brädet gå ut i marginalen, `margin-inline: min(0px, (100% - 320px) / 2)`. Test i `schack-sida.test.js`. |
| **F1** | 🟡 låg–medel, **finns även på main** | Husvärlden (`#/elev/hus`) ritar klart asynkront. Byter eleven route inom ungefär 0,5 s efter att hus-vyn öppnats, skriver husvärlden över den nya sidan: adressen säger `#/elev/schack` men skärmen visar huset. Återskapat även med `#/elev/brakresan`, så det gäller inte bara schack. På en långsam Chromebook är fönstret troligen större. | Inte rättad (utanför Etapp 1) – förslag på uppföljning: husvärlden ska kolla `routeSeq` innan den ritar. |
| F4 | 🟡 iakttagelse | Med 4–6× CPU-strypning når **Damen djup 3** (i en ställning 2) i alla tunga mittspel. Det är samma djup som Tornet. Springaren och Tornet håller sina djup med bara ett undantag. Tidsgränsen håller alltid (se §5). | Fråga till Elias (§8) |
| F5 | ⚪ låg | Appens flash-ruta (t.ex. "En Live-match väntar…") ligger nederst och kan en kort stund täcka varningsrutans knappar på mobil (bild 9, där seeden har en Live-lobby). | Inte rättad (flash är appgemensam) |
| F6 | ⚪ kosmetisk | Nivåvalet på bred skärm: tre kort på första raden och Damen ensam på andra (bild 4). | Inte rättad |
| F7 | ⚪ kod | `schack-flode.js` `visaNivaval` lägger en klicklyssnare på `host` som ligger kvar när partivyn tar över. Följden är att "‹ Till Schack" anropar `go()` två gånger, vilket inte gör någon skada. | Inte rättad |

## 5. Tid per drag (§3.1, krav ≤ 1 s)

`admin/qa-schack-strypt.mjs`: headless Chromium med CDP `Emulation.setCPUThrottlingRate`. Fyra
nivåer × 14 ställningar: de sju i `preview/schack/matning.js` och sju egna (italienskt mittspel,
Najdorf, damgambit, Scheveningen, bondeslutspel, tornslutspel med Td8#, dam mot kung).
Strypningen biter bara på huvudtråden (kalibreringsloopen: huvudtråd 129 → 394 → 536 ms,
workern oförändrad 65–78 ms). Därför körs motorn i huvudtråden för Chromebook-uppskattningen.
Det är samma kod som workern kör.

| Nivå | 1× medel / max | 4× medel / max | 6× medel / max | Djup vid 6× |
| --- | --- | --- | --- | --- |
| Bonden | 7 / 17 ms | 14 / 39 ms | 19 / 52 ms | 1 |
| Springaren | 26 / 82 ms | 97 / 313 ms | 143 / 517 ms | 2 |
| Tornet | 34 / 169 ms | 143 / 621 ms | 214 / **856** ms | 3 (2 i Scheveningen) |
| Damen | 404 / 851 ms | 595 / 863 ms | 584 / **871** ms | 3 i mittspel (2 i Scheveningen), 4–7 i slutspel |

Uppdelat på öppning, mittspel och slutspel vid 6×: Damen 866, 871 och 856 ms max. Tornet 401,
856 och 61 ms max.

- **Den riktiga workern** (`schack-dator.js`, sidan strypt 6×), inklusive meddelandena fram och
  tillbaka: max 54, 109, 166 och 861 ms.
- **I appen** (ostrypt, elevens drag sparat → datorns drag sparat, inklusive den medvetna tänkpausen
  på 350 ms): Bonden 381/470, Springaren 381/496, Tornet 374/429, Damen 607/885 ms (medel/max).
- **Marginal mot 1 s:** värsta draget var 871 ms (Damen, 6×), alltså 129 ms kvar. Ostrypt var det 851 ms (149 ms kvar), och genom den riktiga workern 861 ms (139 ms kvar). Inget drag gick över 1 s, i någon nivå eller strypning. B mätte tidigare 853 ms headless och 869 ms vid 6×, vilket stämmer. `node admin/qa-schack-matning.mjs` (utan webbläsare) gav Damen max 852 ms (148 ms kvar), Tornet 225, Springaren 47 och Bonden 26 ms. Taket är motorns `TIDSGRANS_MS = 850`
  plus kontrollglappet. Maskinen hade en load average på 4–16 av andra jobb under mätningarna,
  så siffrorna är snarare pessimistiska. Mät gärna om på en riktig Chromebook med
  `preview/preview-schack-matning.html`.

**Uppgraderingsrisk – chess.js interna delar:** motorn använder chess.js icke-publika metoder
(`_moves`, `_makeMove`, `_undoMove`, `_isKingAttacked`, `_getPositionCount`). Utan dem blir det
~4 k i stället för 130–190 k noder/s. `MOTOR_KRAV` i `schack-motor.js` listar dem, och
`test/schack-motor.test.js` fäller en chess.js-uppgradering som tar bort eller döper om någon av
dem. En uppgradering av chess.js kan alltså kräva att motorn skrivs om. Pinna versionen (1.4.0)
och kör testet vid varje byte.

## 6. Bootgrafen och licenser

- **Bootgrafen:** BFS från `src/app.js` ger 107 filer, samma som main. 0 filer ur `src/schack/`.
  Nätverksloggen: en inloggad elev i `#/elev/hus` och lärarens Klasser-sida (187 `src/`-filer)
  hämtar **inget** under `/src/schack/`. Först klicket på Schack laddar `page-schack.js` och
  sedan resten (10 filer på startsidan, plus brädet och workern i partiet). Testet
  `test/schack-grund.test.js` kontrollerar samma sak.
- **chess.js:** `src/schack/vendor/chess.js` är byte för byte paketets `chess.js@1.4.0`
  `dist/esm/chess.js` (kontrollerat mot `npm pack`), bara med en versionskommentar överst och
  utan `sourceMappingURL`. `vendor/LICENSE` är identisk med paketets BSD-2-Clause.
- **Inga GPL-beroenden:** inga träffar på Stockfish, chessground, lichess eller GPL i
  `src/schack/` och förhandsvisningarna. Inga npm-beroenden har lagts till.
- **Pjäserna** är egna SVG:er (`schack-pjaser.js`). Inga unicode-schacktecken (♔–♟) finns i
  `src/`, förhandsvisningarna eller förvandlingsväljaren.

## 7. Firestore-budget och deploy

**Etapp 1 har ingen läs- eller skrivbudget i Firestore. Bekräftat:**

- Partiet, valet och "Varna mig" ligger bara i `localStorage` (`pp:schack:dator:<elevId>`),
  inom try/catch. `test/schack-sida.test.js` fäller `firebase`, `firestore`, `setDoc` och
  `coins` i `src/schack/`.
- Uppmätt: proxyn räknade dokumenten som Firestore skickade och tog emot (`QA_RAKNA=1`, steget
  `kvot`). Ett helt parti mot Springaren (6 drag, Ångra, Tips, Ge upp), tillbaka till
  startsidan och ett nytt parti mot Damen som svart gav **0 läsningar och 0 skrivningar**.
  (Som jämförelse gav en inloggning 12 läsningar, så räknaren fungerar.)
- Den enda Firestore-ändringen är lärarens befintliga `enabledModules`-fält på klassdokumentet:
  en skrivning när läraren sparar Synlighet. Inga nya läsningar per elev.

**Deploy – bara webben:**

- `firestore.rules`, `firestore.indexes.json`, `firebase.json` och `functions/` är orörda
  jämfört med main. Inga regler, index eller functions ska deployas.
- **Ordning:** (1) merga epic-PR:en till main, så att GitHub Pages deployar webben. (2) Vänta
  ~10 minuter tills Pages och Fastly-cachen är klara. (3) Först därefter slår lärarna på Schack
  per klass.
- Bootgrafen är oförändrad, så deployen kan inte ge en vit sida (incidenten 2026-09-10). Men en
  elev som klickar på Schack mitt i utrullningen kan få 404 på en lat modul. Därför steg 3.

## 8. Öppna frågor till Elias

1. **Damens djup på Chromebook (F4):** med 4–6× strypning spelar Damen på djup 3 i mittspelet,
   som Tornet. Räcker det, eller vill du att Damen får mer tid (t.ex. 1,5 s – spec säger ≤ 1 s)
   eller att Tornet sänks till djup 2 på långsamma maskiner? Mät gärna på en riktig Chromebook
   först (`preview/preview-schack-matning.html` → Kör mätningen).
2. **Pjäsdesignen – kräver ditt godkännande i PR:en (spec §5).** Skärmdumparna:
   `design/schack/pjaser-120px.png` (alla pjäser i 120 px), `pjaser-56-40-28px.png` (56/40/28 px –
   känns varje pjäs igen i 40 px på Chromebook?), `bradet-parti.png`, `forvandling-och-slutrutor.png`,
   och i appen `qa777-5-schack-glod.png`, `qa777-6-forvandling.png`, `qa777-8-slut-vinst.png`.
   Godkänner du formen och färgerna (kräm `#FFF3DC`, skiffergrå `#555C6E`, kontur `#3B3350`)?
3. **F1** finns även på main (husvärlden skriver över en route som öppnas direkt efter
   inloggningen). Ska den rättas som egen issue före eller efter schack-PR:en?
4. **Synlighet utan omladdning:** när läraren slår på Schack syns länken hos en inloggad elev
   först efter en omladdning eller nästa inloggning, precis som för de andra modulerna
   (fokusläget slår däremot igenom direkt). Är det okej?
