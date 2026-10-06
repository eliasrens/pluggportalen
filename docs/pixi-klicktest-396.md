# Pixi-rörelsen: helhetsklicktest T1–T10 + slutpreview (epic #396, I1 #426)

**Datum:** 2026-10-06. **Gren:** `coder/issue-426-…` = epic-grenen (S1–S6, G1 inkl. uppföljning eab4c93) + I1:s ändringar.
**Miljö:** desk-browsern (headless Chromium, **SwiftShader**, viewport 780×437, scen 725×420, dpr 1, budgetklass
"svag"), maskinlast ~1,7. Riktiga appen mot produktions-Firestore som **elev1/lilla123** (inga medvetna
skrivningar; appen gör sina vanliga skrivningar vid sidladdning). Stub-previews (in-memory Firebase) för det elev1
saknar: kamrater i egna byn (T4) och dolda byar (#391).

> **Mjukhet kan inte bedömas här.** SwiftShader ritar på CPU. Det här protokollet bevisar *funktionen*
> (rätt väg, rätt nivå, inga fel, ingen pop, samma Firestore-trafik). Jämnheten bedömer Elias på sin riktiga GPU
> med previewn, se sist i dokumentet.

## 1. Sammanfattning

| Krav | Resultat |
|---|---|
| T1–T10 via Pixi (`data-pixi-spel="pixi"`) | **Ja**: alla tio, med riktiga klick. Undantag på desk: *kall* T5 (första besöket i en 23-husby) och T5/T6 via bakåt utan hover → `css:vanta` (se §6) |
| Alla via CSS med `pp:pixi:av` | **Ja**: 14/14 resor `css:av`, T10-overlayn `css:av` (1407 ms), samma inline-stilar som kameran sätter idag |
| Reduced-motion = direkthopp | **Ja**: 8/8 resor byter nivå inom 120 ms, ingen motorkörning, renderaren rapporterar `reduced-motion` |
| Hopp > 1 steg, djuplänkar | **Direkthopp som idag**: skola→hus, hus→skola, `#/elev/rum`, `#/elev/laggard`, `#/elev/grannhus?…`, `#/elev/kompis?id=…`. Första resan efter en djuplänk går via Pixi |
| Bakåt ×5 / framåt ×5 | **OK**: rätt nivå varje gång, 1-stegsresor via Pixi, 2-stegs direkt, inga kvarhängande `varld-pixi-spelar`/`-vilar` |
| Gömd flik mitt i en resa | **Fixad i I1**: direkthopp till slutläget (`css:dold-flik`), nästa resa via Pixi igen |
| BFS från `src/app.js` | **133**. Inga Pixi-/motor-/profil-/gårdsfiler i den statiska bootgrafen |
| Moduler < 400 rader | **Ja**: största `varld-motor.js` 399, `varld-profil-port.js` 389, `varld-render.js` 387 |
| `node --test` | **726/731**. De 5 som faller är emulator-testerna (`@firebase/rules-unit-testing` saknas). De faller likadant på epic-grenen |
| Ingen ny Firestore-läsning | **Ja**: samma resa (14 steg) med Pixi och med `av` gav **identiska** 6 förfrågningar på samma tre steg. Hover-förvärmning: 0 läsningar (stub: räknaren oförändrad 5 → 5) |
| #391 by-synlighet | **Ja**: dolda byar (Specgrupp + 5A) finns varken i DOM eller i någon av 79 fångade textur-SVG:er. Djuplänk till en dold by ger skolan |
| `pp:pixi:frys` mot DOM per nivå | **Ingen synlig skillnad** (§5). Kantpixlar skiljer någon procent (subpixel), ambient (moln, djur) står i frusen pose |

## 2. Ändringar i I1 (delade filer, en samlad ändring)

| Fil | Ändring | Varför |
|---|---|---|
| `src/varld-motor-forbered.js` | `RESERV_MAX_MS = 120` + `vantaTexturer()`: finns en reserv-pyramid för båda lagren och bara omspeglingen saknas slutar motorn vänta efter 120 ms och spelar på reserven. Kall övergång: oförändrat 250 ms. `vantan`/`vantaMs` i loggen/HUD:en | Leadens beslut enligt G1 §6.6.1 |
| `src/varld-motor.js` | Skickar `reservTill` till `forbered`. **Gömd flik mitt i en rörelse** → `avbryt()` + `css:dold-flik` (workerns rAF pausar med fliken, annars stod DOM:en osynlig tills fliken kom tillbaka). Exponerar `forvarmOvergang` på `__ppPixi.motor` | Klicktestets "gömd flik" (#374-lärdomen: gömd flik = direkthopp) |
| `src/varld-motor-mal.js` | `forvarmOvergang(Y, I)`: förvärm EN känd övergång direkt (prio "nu") för mål som inte ligger i ett lager. Idle-loopens rollbygge utbrutet till `byggPar` | Rest 1 (gården) |
| `src/varld-gard.js` | `forvarm()`: ytterrollen (huset kring gårdens fokus) förvärms alltid. Scenerna + gårdskameran byggs bara om studentData ligger **färsk i cachen** | Rest 1 utan nya läsningar |
| `src/data.js`, `src/data-farm.js` | `getCachedStudentData()` / `getCachedFarm()`: läser aldrig, ger bara den färska cache-posten | Gården får inte läsa vid hover |
| `src/pages-varld.js` (+9) | `pointerenter`/`focusin` på "Till gården" → `laddaGardVy().then(vy => vy.forvarm())`, bara när motorn är aktiv (inte `av`/död) | Rest 1 |
| `test/varld-motor-vanta.test.js` (ny) | 7 tester av två-väntetidsregeln | Leadens krav |

`styles.css` behövde ingen ändring. Inga scen-items rapporterade önskemål om delade filer utöver rest 1–3.

## 3. Helhetsklicktest, riktiga appen (elev1, ingen flagga)

Varje steg är ett riktigt klick, hover eller tangent i desk-browsern. Efter varje steg läste `evaluate_script`
`stage.dataset.pixiSpel`, `stage.dataset.niva`, `document.activeElement` och motorns `senaste`.
Knappar inne i scenens SVG (huset, klasskylten, tomter) nåddes med verbose-snapshot-uid:n, alltså riktiga pekarklick.
Laggårdsdörren nåddes med Tab-fokus + Enter. Det testar även `focusin`-förvärmningen.

| # | Steg | Övergång | `pixiSpel` | `niva` | Detalj (väntan före start) |
|---|---|---|---|---|---|
| 1 | Logga in (T10) | port → hus | overlay `pixi` | hus | 22 frames, maxDt 150 ms (SwiftShader), overlay 1413 ms |
| 2 | Klick på huset | T3 in | `pixi` | rum | reserv efter 133 ms (huset inaktuellt) |
| 3 | Gå ut → Gå till gården | T9 = T3 ut + T7 in | `pixi` + `pixi` | gard | kall första gård: `klart` 77 ms |
| 4 | Tab-fokus laggårdsdörren (mål I-klar) + Enter | T8 in | `pixi` | laggard | klart 60 ms |
| 5 | ⬅ Ut till gården | T8 ut | `pixi` | gard | klart 62 ms, fokus `ut-btn` |
| 6 | ⬅ Tillbaka till huset | T7 ut | `pixi` | hus | klart 66 ms |
| 7 | Klasskylten | T2 ut | `pixi` | by | klart 73 ms (byn: 1 tomt, "Andra byar" synlig) |
| 8 | Andra byar | T1 ut | `pixi` | skola | klart 85 ms, 9 klasser |
| 9 | Hovra 4A (mål Y-klar) + klick | T5 in | **`css:vanta`** | grannby | kall 23-husby, se §6 |
| 10 | Hovra Egon (Y+I klara) + klick | T6 in | `pixi` | grannbyhus | klart 129 ms |
| 11 | ← Till byn | T6 ut | `pixi` | grannby | klart 122 ms, fokus `ut-btn` |
| 12 | ← Till skolan | T5 ut | `pixi` | skola | klart 88 ms |
| 13 | "Egen by" | – | – | – | elev1 har ingen klass i skolans lista och ut-knappen är dold på skolnivån (**inte Pixi**, samma på main). Vägen hem blev sidomenyn → Hem: skola→hus = **hopp > 1 steg, direkthopp**, ingen motorkörning |
| 14 | Klasskylten | T2 ut | `pixi` | by | klart 32 ms |
| 15 | Ditt hus | T2 in | `pixi` | hus | klart 50 ms |

**Bakåt ×5:** by (T2 ut `pixi`) → hus (T2 in `pixi`) → skolan (2 steg: direkt) → grannby (T5 in `css:vanta`)
→ grannhus (T6 in `css:vanta`, ingen hover före). **Framåt ×5:** grannby (T6 ut `pixi`, reserv 140 ms) → skolan
(T5 ut `pixi`) → hus (direkt) → by (T2 ut `pixi`) → hus (T2 in `pixi`). Efteråt: 0 element med `varld-pixi-spelar`/`-vilar`.

**Djuplänkar (med omladdning):** `#/elev/rum`, `#/elev/laggard` och `#/elev/grannhus?id=…&klass=4a` startar direkt på
nivån, bara det lagret synligt (opacity 1), ingen motorkörning. Efter `#/elev/laggard` → "Ut till gården":
T8 ut `pixi` (klart 56 ms). `#/elev/kompis?id=…` testades i stub-byn (§4).

**Gömd flik:** headless döljer inte en flik vid flikbyte (`visibilityState` förblir `visible`), så den
emulerades (`document.hidden`/`visibilityState` + `visibilitychange`) 250 ms in i en T2-ut-resa:

| Läge | `spelar` | `pixiSpel` | `.varld-pixi-spelar` | DOM |
|---|---|---|---|---|
| mitt i | `spelar` | `pixi` | ja | lagren osynliga (canvasen spelar) |
| direkt efter dold | `null` | `css:dold-flik` | nej | slutläget (by 1/scale(1), hus 0) |
| synlig igen → "Ditt hus" | – | `pixi` | – | T2 in via Pixi, klart 51 ms |

**`pp:pixi:av` (riktiga klick + 14 resor med route-byten):** alla `css:av`. Huset → rummet ger husets inline-stilar
`transform-origin: 48.5% 52%; transform: scale(6); opacity: 0` (kamerans `apply()` som idag). T10: overlay `css:av`,
1407 ms. Pixi-vendorfilen och workern laddas aldrig. Motorns egna JS-moduler laddas i idle men säger nej i
`kanSpela` (F4:s bit-för-bit-test täcker detta).

**Reduced-motion** (matchMedia emulerat via initScript): rum, hus, by, hus, gård, laggård, gård, hus. Varje nivå är
satt efter ≤ 120 ms (första gården efter modul-laddningen), `pixiSpel` saknas, historiken är 0 och
`__ppPixi.orsak = "reduced-motion"`.

## 4. Stub-previews (det elev1 inte har)

**`preview-pixi-by.html` (25-husby):** hovra Ebba (mål `I-klar`, båda rollerna, **0 nya läsningar**) → klick: T4 in
`pixi` (klart 77 ms, byn återanvänd) → "← Till byn": T4 ut `pixi` (55 ms). Djuplänk `#/elev/kompis?id=elev05` med
omladdning: startar i Ebbas hus (bara kompis-lagret synligt, ingen motorkörning).

**`preview-pixi-skola.html?dold=spec,5a`:** Andra byar (T1 ut `pixi`) → skolan visar 3 byar (4A egen, 4B, 6A) →
hovra + klick 4B (T5 in `pixi`, 116 ms) → hovra + klick Ines (T6 in `pixi`) → ← Till byn (T6 ut `pixi`) → ← Till
skolan (T5 ut `pixi`) → **klick på egna byn (T1 in `pixi`)**. **#391:** sökning i alla 79 fångade textur-SVG:er:
"Specgrupp", "Lugna hörnet", `data-id="spec"`, `data-id="5a"`, Pia, Rut, Kim, Lova, Malte, Nora, Olle → **0**.
Kontroll att sökningen fungerar: synliga "Ekdal" 2 och "Sjöstad" 1. DOM: 0 noder för de dolda. Djuplänk
`#/elev/grannby?id=spec` → skolan, 3 byar, 0 träffar.

## 5. `pp:pixi:frys`: canvas (Pixis sista frame) mot DOM per nivå

Direkt efter resan fryses DOM:ens ambient (WAAPI-paus + promenaden sover). Sedan tas skärmdump av DOM:en och av
canvasen (`__ppPixi.motor.jamfor(true)`), och de jämförs pixel för pixel i sidan. Andel = pixlar vars kanal
skiljer > 40 av 255 i scenytan.

| Nivå (resa) | Andel > 40 | Bedömning |
|---|---|---|
| by (T2 ut) | 0,61 % | ingen synlig skillnad (kanter ±1 px) |
| hus (T2 in, ny spegel) | 0,79 % | ingen synlig skillnad |
| hus (T3 ut, **reserv**) | 1,66 % | molnen ~30 px förskjutna, solstrålarna lite vridna. Allt annat identiskt |
| rum (T3 in) | 2,72 % | ingen synlig skillnad. Djuren hann gå/vicka några px innan frysningen |
| gård (T7 in) | 0,19 % | ingen synlig skillnad |
| laggård (T8 in) | 0,75 % | skillnaden ligger bara i grisens ruta (promenerande djur) |
| skola (T1 ut) | 0,77 % | ingen synlig skillnad |
| grannby (T6 ut) | 3,11 % | ingen synlig skillnad (23 hus och namnpiller ger många kantpixlar) |
| grannbyhus (T6 in, reserv) | 0,18 % | ingen synlig skillnad |

Port (T10) jämfördes av S6 och inget av I1:s ändringar rör den. Desken saknar färg-emoji (🔒 och 🏠 blir rutor i *både* DOM
och textur). G1:s emoji-reserv gäller på Chromebook.

## 6. Kvarvarande och mätningar (rest 1–3 från leaden + nya)

**Rest 1: första gårdsbesöket.** Löst i I1: hover/fokus på "Till gården" laddar gårdsgrenen dynamiskt och förvärmer
husets T7-roll (30–49 ms) utan någon läsning. Gårdsscenen och kameran byggs bara om studentData är färsk i cachen.
Mätning: appens egna skrivningar vid sidladdning (3 transaktioner) ogiltigförklarar cachen, så i praktiken byggs
oftast bara ytterrollen. Desk (låg last): första gården gick via Pixi både utan hover (77 ms) och med hover (73 ms).
Under last ger reserven för huset en snabbare start. Gårdens inre roll speglas ändå om vid handoff (levande ambient).

**Rest 2: husets omspegling mot väntetiden.** Mätt före/efter två-väntetidsregeln (20 resor T2/T3 i följd, desk):

| | T2 by↔hus (10) | T3 hus↔rum (10) |
|---|---|---|
| Ny spegel klar efter | 30–67 ms | 114–206 ms |
| **Före** (en gräns 250 ms) | 10 ny spegel | 10 ny spegel, väntan 114–206 ms |
| **Efter** (reserv 120 ms) | 10 ny spegel | **6 reserv** (väntan 127–141 ms), 4 ny (119–130 ms) |

Avvägning: på desken sparar regeln 0–80 ms per T3, men 6 av 10 resor visar reservbilden med molnen ~30 px fel. Det syns
som ett litet molnhopp vid start (T3 in) eller slut (T3 ut). Allt annat i bilden är identiskt (§5). På en
långsam Chromebook (omspegling 270–430 ms) spelade även den gamla regeln på reserven, så där är vinsten 130 ms
kortare väntan utan visuell kostnad. På en snabb dator hinner den nya spegeln före 120 ms och båda reglerna ger samma
resultat. **Förslag på uppföljning:** sätt DOM-ambientens `currentTime` till reservens pose när reserven spelas
(tar bort sluthoppet helt), eller låt Elias avgöra 120 mot ~180 ms med HUD:ens `vantan`/`vantaMs`.

**Rest 3: port-overlayn 1536 ms.** Reproducerades inte: overlayns livstid var 1413 ms (Pixi) och 1407 ms (`av`) mot
1410 ms. Timern ligger på main-tråden och kan alltså försenas av världsbygget under last, likadant i CSS-vägen.

**Nytt: kall T5/T6 på "svag" klass.** Första besöket i en stor grannby (23 hus) faller till `css:vanta`, eftersom
grannbyns innerroll (speglas först när klassens data laddats vid klicket) tar ~317 ms > 250 ms. Via bakåt/framåt
utan hover finns inget mål att förvärma, och på "svag" (`maxPar` 1) förvärmer idle bara T1 från skolan. Det
är oförändrat dagens CSS-övergång, alltså ingen regression. Datan förhämtas medvetet inte (Firestore). På "normal"
(`maxPar` 3) är träffbilden bättre.

**Nytt: elev1 utan klass.** Skolan visar inte elev1:s egen by och ut-knappen är dold på skolnivån. Vägen hem är
sidomenyn. Det är appens beteende för en elev utan klass och inte Pixi (T1 in verifierades i stubben).

## 7. Slutpreview för Elias

> **Pixi är AV som standard** (§9). Previewn och produktionen visar dagens CSS-övergångar tills Pixi slås på
> med `?pixi=pa` (sparas i webbläsaren). Elevernas sida påverkas alltså inte av mergen.

Previewn kör **riktiga appen** från den här grenen (epic-innehållet + I1) mot den riktiga databasen. Logga in som
vanligt (t.ex. elev1). Klicka runt som en elev men undvik att köpa saker, eftersom det skrivs på riktigt.

**Slå på Pixi + mät-HUD:en:** lägg till `?pixi=pa,debug` före `#` i adressen (t.ex. `…/?pixi=pa,debug#/elev/hus`)
och ladda om.
Flaggan sparas i webbläsaren tills du tar bort den. En ruta nere till vänster (efter första övergången) visar:
- raden `övergång`: 🟢 pixi eller 🟠 css:<orsak>,
- raden `frame-dt` + grafen: workerns bildtider (snitt, max, tappade > 25 ms; 16,7 ms = 60 fps),
- raden `handoff`: förberedelsetid och `väntan klart|reserv|deadline <ms>` (`klart` = ny bild, `reserv` = förvärmd bild),
- texturcachen och budgeten (G1, se `docs/pixi-gpu-budget-396.md`).

**Jämför mot dagens CSS-övergång:** `?pixi=av` (ladda om) → samma klick, nu exakt som på main. Tillbaka till
Pixi: `?pixi=normal,pa`. Allt av igen (standardläget): `?pixi=normal`. Bra resor att jämföra: hus ↔ by (klasskylten), hus ↔ rum (dörren), hus → gården →
laggården, by → Andra byar → en grannby → ett hus.

**Pixel-jämförelse (valfritt):** `?pixi=frys` håller Pixis sista bild kvar under DOM:en. Konsolen:
`__ppPixi.motor.jamfor(true)` visar Pixis bild och `jamfor(false)` visar DOM:en.

Det Elias avgör: är övergångarna mjuka på riktig GPU (HUD:en ska mest visa ~16–17 ms), syns något hopp vid start
eller slut (särskilt moln vid hus ↔ rum, se rest 2), och ska reservgränsen vara 120 ms.

## 8. F5 (#431): reservens ambient-pose på DOM:en

**Ändring.** `sakra()` sparar lagrets bas-ambient-pose i samma task som speglingen: `currentTime` per animation,
utan sprites och utan lagrets egen animation (`varld-motor-pose.js`, `post.pose`). Spelas ett lager på reserven
sätter `forb.sattPose()` de av vilan pausade animationerna till den posen. Det sker i samma task som
`.varld-pixi-spelar` läggs på, så tillbakaspolningen syns aldrig. Vilan släpps med `play()` och ambienten fortsätter
från reservens pose. Vid färsk spegel eller alias görs ingenting. Loggen och `senaste` får
`pose: {<lager>: {satta, borta, nya, alderMs}}` (borta/nya = animationer som försvunnit eller tillkommit sedan
speglingen; de lämnas orörda).

**Mätmetod (desk, stub-preview, `?pixi=frys,debug`).** Reserven tvingades fram genom att `HTMLImageElement.decode`
fördröjdes 400 ms för stora bilder (bara nya speglingar påverkas, reserven är redan avkodad). En sid-instrumentering
läste molnens `translateX` (lagrets egna enheter) vid vilans `pause()` (DOM före), när `.varld-pixi-spelar` läggs på
(= canvasens pose) och när den tas bort (DOM efter). Klick med riktig mus (T3: huset, Gå ut → framsidan) och
fokus + Enter (T2: klasskylten, "Ditt hus" i byn).

| # | Resa | Väg | pose | Slut-hopp (DOM efter − canvas) |
|---|---|---|---|---|
| 1 | T3 in hus→rum | reserv hus+rum | hus 7/7, rum 2/2 | 0 |
| 2 | T3 ut | reserv hus+rum | 7/7, 2/2 | 0 |
| 3 | T3 in | reserv hus+rum | 7/7, 2/2 | 0 |
| 4 | T3 ut | färsk hus, reserv rum | rum 2/2 | 0 |
| 5 | T3 in | färsk hus, reserv rum | rum 2/2 | 0 |
| 6 | T3 ut | färsk hus, reserv rum | rum 2/2 | 0 |
| 7–10 | T3 in/ut ×2 | reserv hus+rum | 7/7, 2/2 | 0 |
| 11 | T2 ut hus→by | färsk (`klart` 196 ms) | – | 0 |
| 12 | T2 in by→hus | reserv hus | 7/7 | 0 |
| 13 | T2 ut | reserv hus | 7/7 | 0 |
| 14 | T2 in | reserv hus | 7/7 | 0 |
| 15 | T2 ut | färsk (`klart` 75 ms) | – | 0 |
| 16 | T2 in | färsk (`klart` 108 ms) | – | 0 |

**Pixel (canvas i vila mot DOM, `jamfor`).** DOM:ens animationer frystes i exakt den pose de hade när DOM:en
visades igen. Molnens förskjutning togs som bästa horisontella förskjutning (±60 px) inom molnets ruta:
- hus (T2 in, reserv): alla moln och all rök **0 px**, hela scenen 0,14 % > 40 (mot 1,66 % och ~30 px i §5),
- rum (T3 in, reserv): synligt moln **0 px**,
- hus (T3 ut, reserv) och rum-preview med djur: molnen 0 px. Rest, se nedan.

`pp:pixi:av`: `css:av`, 0 skrivningar till `currentTime`, 0 pyramider. Spårning av alla `currentTime`-skrivningar:
bara `sattPose` skriver, och bara på bas-ambienten (hus 7, rum 2). Djurens `ps-*`/`pet-*` (sprites) rörs aldrig.

**Kvar (utanför F5):**
- **Start-hoppet finns kvar.** Vid start visar DOM:en posen vid klicket och canvasen reservens pose. Hoppet är
  molnens drift sedan reserven speglades (~24 enheter/s för husmolnen), alltså obegränsat med elevens väntetid (11–42 s i
  testet gav 90–1280 enheter, med varv). Det syns på lagret som är synligt vid start: hus vid T3 in och T2 ut. Det
  går inte att ta bort genom att sätta DOM-posen, eftersom canvasen inte kan visa en annan pose än den inbakade.
  Förslag: förnya ytterrollens reserv vid hover/fokus på målet (`tak` 4000 gäller redan där), eller rita husets
  moln som sprites (överlägg i frusen pose).
- **Hovrat hus inbakat i en handoff-reserv.** Efter T3 in blir handoffens omspegling (huset i hover-skala) reserv
  för nästa T3 ut. Idle-förvärmningen bygger inte om den, eftersom den är yngre än `tak` 4000. Huset (och röken
  vid skorstenen) blir då ~6 px större i canvas än i DOM vid slutet (sannolikt hover-skalan; med en idle-reserv
  var skillnaden 0,14 %). Husprofilen har `objekt: []` med flit (S1).

## 9. F6 (#432): noll pop vid START – tillstånd i nyckeln, avsikts-spegling, färskt startlager

**Vald väg.** Förslagen a) och b), plus en regel för startlagret. Sandwich-vägen valdes bort: husets ambient ligger på
tre z-nivåer (solstrålar under solen, moln bakom silhuetterna, röken *inuti* husskalet under takkant/torn). Det kräver
minst fyra statiska skivor per roll, alltså ~2× GPU och en intervall-spegling i `varld-spegel*.js`.
- **Tillstånd i nyckeln** (`varld-motor-tillstand.js`). Pyramidnyckeln = roll + `#<signatur>` för hovrade/fokuserade
  noder bland profilens nya `neutralisera` (hus: `[id$="husgrupp"]`, `[id$="klasskylt"]`). `i:h` = hover, `i:f` =
  `:focus-visible`, `~` = en transition pågår eller är pausad. Neutralt ger samma nyckel som tidigare. Idle speglar
  neutralt, med `neutralisera` i vila-läge via F4b:s kloner. En reserv kan därför bara spelas i samma tillstånd som
  DOM:en visar. Tillstånds-poster som inte längre gäller släpps när pekaren lämnar och i idle.
- **Avsikt** (`varld-motor-avsikt.js`). Hover/fokus på något klickbart i staget, också `.varld-ui` ("Gå ut",
  "Till gården"), speglar om det aktiva lagrets förvärmda roller. Det sker efter att hover-transitionen landat, i
  aktuellt tillstånd och med aktuell ambient-pose (prio "nu", en spegling per task). Bara roller i lagrets aktuella
  geometri förnyas.
- **Startlagret färskt** (`varld-motor-forbered.js`). Lagret som syns före klicket (ytter vid "in", inner vid "ut")
  spelas på reserv först vid `VANTA_MAX_MS` (250 ms), inte vid `RESERV_MAX_MS` (120). Det dolda lagret får fortfarande
  reserv efter 120 ms, och F5 synkar dess pose. Väntan pollas, så rörelsen startar så fort startlagret är färskt.
  En pågående spegling (t.ex. avsiktens) får bli reserv om ingen klar finns.

**Mätmetod.** Desk med SwiftShader, `preview-pixi-hus.html` med stub. En sid-harness höll handoffen vid START (efter
`visaVila`: DOM synlig i klickets frusna pose, canvasen under) och vid SLUT (efter `spela`). Vid varje hållning togs
skärmdumpar av DOM och av canvas (`.varld-pixi-spelar` växlad). Två mått:
- **Ambient (exakt):** för varje moln, solstrålar och rök i startlagret, största förflyttningen av nodens hörn (getBBox
  × getScreenCTM i startens kameraskala) mellan klickets pose och canvasens pose.
- **Skärmdump:** bästa förskjutning (±6 px) för hus och skylt och andel > 40 i rutan. 0 = ingen förskjutning; kvarvarande
  andel ≤ 0,5 % är kantbrus i SwiftShader. Molnrutornas skärmdumpsmått är brusiga (tunna vita kanter, rökpuffar i rutan),
  så där gäller det exakta måttet.

Resorna kördes med riktig mus (hover → klick) och med tangentbord (Tab → Enter, `:focus-visible`), och pekaren stod
still 0,5, 3 eller 10 s utanför målet före hover/fokus. Klick verifierades efter varje resa med `evaluate_script`
(hash, `senaste`).

**Normalläge** (ingen fördröjning, alla startlager färska):

| # | Resa | Input / still | hover→klick | Väntan | Tillstånd [Y, I] | START ambient (moln/sol/rök) | START hus · skylt | SLUT hus · skylt · moln |
|---|---|---|---|---|---|---|---|---|
| n1 | T3 in | mus / 0,5 s | 1489 ms | klart 109 | `0:h`, – | 0 / 0 / 0 px | 0 · 0 px | rum-moln 0 |
| n2 | T3 ut | mus ("Gå ut" → menyval) / 3 s | – | klart 82 | – | rum-moln 0 | – | 0 · 0 · 0 px |
| n3 | T3 in | mus / 3 s | 306 ms | klart 91 | `0:h`, – | 0 / 0 / 0 | 0 · 0 | rum-moln 0 |
| n4 | T3 ut | Enter / 10 s | – | klart 98 | – | rum-moln 0 | – | se ¹ |
| n5 | T3 in | Enter / 10 s | 3159 ms | klart 99 | `0:f`, – | 0 / 0 / 0 | 0 · 0 | rum-moln 0 |
| n6 | T3 ut | Enter, pekaren över husets slutplats | – | klart 94 | – | rum-moln 0 | – | se ¹ |
| n7 | T2 ut | mus på skylten / 3 s | 9 s | klart 148 | –, `1:h` | 0 / 0 / 0 | ² | ² |
| n8 | T2 in | mus på tomten / 0,5 s | – | klart 88 | – | by (rök = sprites) 0 | – | 0 · 0 · 0, rök 0 |
| n9 | T2 ut | Enter / 10 s | 5598 ms | klart 64 | –, `1:f` | 0 / 0 / 0 | 0 · 0 | by 0 |
| n10 | T3 in | mus / 10 s | 989 ms | klart 119 | `0:h`, – | 0 / 0 / 0 | 0 · 0 | rum-moln 0 |

¹ Med pekaren över husets slutplats visade slut-skärmdumpen huset i hover-skala. Det var ett harness-fel: skärmdumpen
togs ~200 ms efter bytet. En rAF-sond i verkligt flöde utan hållning visar `:hover = false` under hela rörelsen
(`.varld-pixi-spelar` har `pointer-events:none`). Vid bytet är `#husgrupp` `matrix(1,0,0,1,0,0)`, alltså samma neutrala
bild som canvasen. Chrome lägger på hovern ~200 ms senare, och den tonar in via husets egen transition (0,25 s). Det
är inget hopp. I harnessen spärras nu pekaren under slut-skärmdumpen.
² n7 kördes med dokumentet scrollat (64 px) för att nå skylten i ett 437 px högt fönster. Då ritade canvasen lagret
förskjutet (se "Kvar"), så skärmdumparna är ogiltiga. Den exakta ambient-posen var 0. n8–n10 kördes i 900×700 utan scroll.

**Reservläge** (handoff-speglingens avkodning fördröjd 400 ms, så att reserven tvingas fram):

| # | Resa | Input | Väntan | Spelat | START | SLUT |
|---|---|---|---|---|---|---|
| r1 | T2 in | mus / 3 s | reserv 116 ms (startlagret byn färskt) | hus-reserv 36 s, F5-pose 7/7 | 0 px | hus 0 · skylt 0 · rök 0 |
| r2 | T2 ut | Enter / 3 s | deadline 252 ms | hus-reserv `1:f`, 854 ms (= fokus→Enter) | skylt **0 px** (tillståndet stämmer); moln 10,8–17,6 px, sol 5,5 px, rök 48–125 px | 0 |
| b1 | T3 ut (före startlager-regeln) | mus / 3 s | reserv 117 ms | rum-reserv (avsikt) 1679 ms | rum-moln 11,1 / 8,1 px | 0 |

**Slutsats.** När startlagrets omspegling hinner inom 250 ms (alla normalresor: 64–148 ms) är START och SLUT 0 px för
hus, skylt, moln, rök och solstrålar, med och utan hover, med mus och med Enter. Missar omspeglingen 250 ms (bara
med tvingad fördröjning här) spelas reserven. Tillståndet (hover-/fokus-skala) är då alltid rätt, men ambienten
hoppar så mycket som den hunnit driva sedan hover/fokus: moln ~13–20 px/s, rök mer. Före F6 var reserven 11–42 s
gammal. ≤ 1 px för ambient i det fallet kräver sandwich eller frusen ambient; se "Kvar".

**Kostnad.** Hover på huset (desk, 596×550, dpr 1):
- En förvärmd roll: 5,1 ms synkront på main + 6,8 ms asynkron spegling, klar efter 40 ms. GPU 17,2 → 31,5 MB
  (+14,3 MB) under hovern, tillbaka till 17,2 MB när pekaren lämnar.
- Två roller (byn laddad): 5,7 ms synkront, klar efter 72 ms, +17,1 MB (33,9 → 51,0 MB), tillbaka efter.
- Idle: oförändrat antal speglingar, plus en `querySelectorAll`/`matches` per lager (< 0,1 ms).
- Handoff: väntan kan bli upp till 250 ms i stället för 120 ms, men bara när startlagrets omspegling tar 120–250 ms.

`pp:pixi:av`: `css:av`, 0 pyramider och ingen avsikts-spegling vid hover. Reduced-motion: oförändrat (direkthopp i
kameran). Ingen Firestore: avsikten läser bara DOM. Klicktest även i `preview-pixi-rum.html` (T3 ut: startlagret
rummet färskt efter 123 ms, husets reserv bara för det dolda lagret; T3 in `0:h`), `preview-pixi-by.html` (T4:
målförvärmningen orörd, byn utan levande bas-ambient → ingen avsikts-spegling) och T7 i hus-previewn (avsikt på
"Till gården", färsk på 104 ms).

**Kvar (utanför F6):**
- **Scrollat dokument förskjuter canvasen.** I ett fönster lägre än sidan (437 px) scrollade dokumentet 64 px. Då fick
  samma roll två nycklar (`vy.y` 89 resp. −75, alltså 164 px isär) och canvasen ritade husets lager ~164 px för högt
  vid start (n7). Utrett och åtgärdat i F7, se §10: det var stagets EGEN scroll, inte dokumentets.
- **Ambient vid reserv efter 250 ms.** Restfelet = driften sedan hover/fokus (r2: 854 ms ⇒ moln ≤ 18 px). Exakt 0
  även där kräver sandwich (ambient-skivor i rätt z-ordning, ~2× GPU) eller att ambienten pausas medan målet är
  hovrat. Det sista är en synlig beteendeändring och kräver Elias OK.

## 10. F7 (#433): scroll – stagets egen scroll, inte dokumentets

**Rotorsak.** `.varld-stage` är `overflow:hidden`, men det är ändå en scroll-container. Den kan scrollas av
`scrollIntoView` och av fokus på ett delvis klippt element. Riktigt exempel: 1000×360 (desktop, scenen 360 px men
scen-boxen min 420 px), där Tab till klasskylten ger `stage.scrollTop = 10`. Lagren och canvasen (`position:absolute`
i staget) flyttas då båda med −scroll. Lagrets box mättes mot stagets ruta (`getBoundingClientRect`), så boxen fick
också −scroll. Canvasen ritade alltså lagret dubbelt förskjutet, och rollnyckeln (`vy`) ändrades med scrollen.
F6:s nycklar (`vy.y` −75 → 89) motsvarar exakt en stage-scroll på 164 px. **Dokumentets scroll påverkar ingenting:** lager, stage
och canvas mäts i viewport-px i samma ögonblick, och samma nyckel ges före och efter dokument-scroll (mätt).

**Åtgärd** (bara motor-filerna, ingen CSS):
- `TX.stageRam(stage)` (`varld-motor-textur.js`) nollar stagets egen scroll och ger sedan stagets ruta. Den används för
  all geometri: handoff (`forbered`), mål-, idle- och övergångsförvärmning (`varld-motor-mal.js`) och avsikten.
- Scroll-vakt i `koppla()` (`varld-motor-mal.js`): staget nollas så fort det scrollats, när Pixi kan spela. Scroll-
  händelsen kommer före paint, så den scrollade bilden syns aldrig. Fokus-ringen på ett delvis klippt element (kanten
  på klasskylten i ett 360 px högt fönster) förblir då klippt, precis som innan fokus.
- `pp:pixi:av` och reduced-motion (CSS-vägen): orörda. Staget kan scrollas som idag (mätt: `scrollTop` 30 kvar, `css:av`).
- F6:s skydd i avsikten (bara roller i lagrets aktuella geometri) ligger kvar: scroll ger inte längre några inaktuella
  roller, men en lagerbox kan ändras utan att stagets mått gör det (layout-/klassbyte utan resize).

**Mätmetod.** Desk (SwiftShader), `preview-pixi-hus.html?pixi=frys,debug` med stub. En init-script-harness höll
workerns `spela`-meddelande vid START: canvasen visar då `fran` och DOM:en är gömd. Skärmdump av DOM före klicket,
av canvasen vid START, och av DOM respektive canvas (`jamfor`) efter SLUT. Diff = bästa förskjutning (±6–14 px) i
rutor runt hus/skylt (START) och hela scenen utom HUD (SLUT), samt andel pixlar > 40. Kvarvarande ≤ 2 % är kantbrus,
molndrift mellan skärmdump och klick, och `.varld-ui` (rubrik/knappar byts vid navigeringen och speglas inte).
Varje klick/tangent verifierades med `evaluate_script` (hash, `pixiSpel`, `senaste`).

| # | Viewport | Scroll | Resa / input | Väg, väntan | START | SLUT |
|---|---|---|---|---|---|---|
| f1 | 1000×360 | **före fixen**: Tab → stage 10 px | T2 ut, Enter | pixi, klart | **dy −10 px** | **dy −10 px** |
| f2 | 1000×360 | Tab → stage 10 px, vakten nollar | T2 ut, Enter (`1:f`) | pixi, klart | 0 px (hus 0,14 %) | 0 px (1,4 %) |
| f3 | 1366×600 | stage 64 px (före fixen, idle-nyckel `vy.y` −75 → −11) | T2 ut, klick | pixi, klart | – | **dy −64 px** |
| f4 | 1366×600 | stage 64 px + `scrollIntoView`, vakten nollar; nycklar identiska | T3 in, Enter (`0:f`) | pixi, klart | 0 px (0,8 %) | 0 px (1,1 %) |
| f5 | 1366×600 | som f4 | T2 ut, Enter | pixi, klart | 0 px (0,5 %) | 0 px (1,4 %) |
| f6 | 1366×600 | som f4 | T7 in, hover → klick | pixi, klart (mål) | 0 px (0,1 %) | 0 px (0,1 %) |
| f7 | 390×700 | dokument 28 px; nycklar identiska | T2 ut, klick | pixi, klart | 0 px (0,7 %) | 0 px (1,2 %) |
| f8 | 390×700 | dokument 28 → 0 px **mitt i rörelsen** + stage 40 px (nollad) | T7 in, klick | pixi, klart | 0 px (0,4 %) | 0 px (0,3 %) |
| f9 | 390×700 (`preview-pixi-by`) | dokument 28 px + stage 40 px (nollad) | T4 in, hover → klick | pixi, klart, målets pyramid återanvänd | – | – |

Dokumentet går bara att scrolla på smal skärm (≤ 820 px, staget är `clamp(…)` högt). På desktop är staget `100dvh`,
så där scrollas bara staget själv. **Scroll under pågående rörelse** (f8): canvasen ligger i staget och flyttar med
dokumentet precis som DOM-lagren. Rörelsen och slutbilden påverkas inte, och CSS-vägen beter sig likadant.

**Hittat på vägen (utanför F7, ej åtgärdat):** på mobil (≤ 700 px) krymper staget när `data-niva="rum"` sätts
(`styles.css`, rum-regeln: 580 → 452 px vid 390×700). T3 in spelas klart via Pixi, men vid landningen ger
ResizeObserver `avbryt()` + `rensaAllt()`, så loggen (`senaste`) tappas och alla pyramider byggs om i idle efter
landningen. Samma sak med och utan scroll.


## 11. F8 (#434): mobil – stagets höjd byts vid rum-landningen

**Vad som händer.** På mobil (≤ 700 px) har rummet en egen stage-höjd (`styles.css`, rum-regeln: 390×700 → 580/452 px,
360×640 → 520/418 px). Höjden byts när kameran landar: `onNiva` → `updateUi` → `stage[data-niva]`, KAMERA_MS efter
`tillampaDom`. Rörelsen spelar alltså alltid i startnivåns geometri, och höjden byts vid slutet, aldrig mitt i eller vid
start. CSS-vägen gör exakt samma sak: DOM-lagren fyller staget, som behåller sin höjd tills landningen. Workern har då
1–2 frames kvar. Före fixen syntes canvasen (gammal bild) uttöjd till den nya höjden i ~2 frames (mätt: `data-niva=hus`
vid 1259 ms, ResizeObserver först vid 1297 ms). Sedan körde ResizeObserver `avbryt()` + `rensaAllt()`, så loggen tappades
och alla pyramider byggdes om.

**Val: känn igen nivåns resize, invalidera ingenting (variant av (a) + (b)).**
- *Klassning* (`varld-motor-resize.js`, `klassa()`): en stage-resize med samma viewport (`innerWidth/innerHeight`) och
  dpr som förra mätningen, där `data-niva` har bytts (eller inom 1 s efter bytet), är `niva`. Allt annat är `akta`.
  Rotation och fönsterstorlek ändrar alltid viewporten. Kombinationen nivåbyte + fönsterändring räknas som äkta.
- *Ingen förmätning av målnivån.* Att mäta målnivåns höjd före rörelsen hade krävt att `data-niva` växlas och lagret
  layoutas om i klicket. Den förväntade resizen känns igen på nivåbytet i stället, och slutläget är ändå DOM:en.
- *(b) gratis:* rollnyckeln kodar redan lagrets box, stagets vy och dpr. Därför kastas inget vid `niva`: rummets
  452-roller byggs i idle efter landningen, och husets 580-roller ligger kvar till nästa gång staget är 580. En
  pyramid kan aldrig spelas i fel geometri, eftersom nyckeln då inte matchar. LRU:n tar minnet.
- *Landning före paint:* `data-niva`-mutationen (mikrotask direkt efter `updateUi`) mäter staget. Har storleken bytts
  under en rörelse som spelar, tas `.varld-pixi-spelar` bort och canvasen göms i samma task. Den första målade framen
  med ny höjd är alltså DOM:en i slutläget, samma bild som CSS-vägen. `avsluta()` loggar som vanligt med
  `landad: {till, ms}`. Förbereds rörelsen fortfarande (mätt i den gamla storleken) avbryts den som idag.
- `pp:pixi:av`: ingen yta, och motorn rör ingenting (mätt: `css:av`, ingen resize-post, 0 pyramider).

**Mätmetod.** Desk (SwiftShader), `preview-pixi-rum.html?pixi=tvinga,frys` (riktiga appen med minnes-Firestore), i
viewport 390×700 och 360×640 (`emulate`). All input var riktig: `Enter` på `#husgrupp` för T3 in, och `Enter` → `Tab` →
`Enter` i "Gå ut"-menyn (respektive klick på 🚪 och menyvalet) för T3 ut. Varje steg verifierades med
`evaluate_script` (hash, `data-niva`, `pixiSpel`, `senaste`, `resize`). Harnessen (`.f8tmp/`, ej incheckad) höll
workerns `spela` vid START: canvasen visar då `fran` och DOM:en är gömd. Den jämfördes med en DOM-skärmdump före
klicket. Vid SLUT fördröjdes `onNiva` (25 s), så att canvasens sista frame kunde jämföras med DOM:en i samma geometri
(`jamfor`). Idle spärrades under slut-skärmdumpen, för en idle-förvärmning (texturuppladdning) får workern att committa
en tom buffer. Diff = bästa förskjutning ±6 px, andel pixlar > 40. Allt som återstår är husdjurens promenad, ✏️-etiketter
(hover/fokus före klicket), moln/rök och kantbrus i speglingen.

| # | Viewport | Resa | Väg | START (scen · hus/dörr) | SLUT (scen · hus/dörr) | Landning |
|---|---|---|---|---|---|---|
| a1 | 390×700 | T3 ut (klick) | pixi, klart | 0 px (4,1 % husdjur) · dörr 0 px | – (idle tömde canvasen, se c1) | `niva`, ingen `rensaAllt` |
| b1 | 390×700 | T3 in (Enter) | pixi, klart | 0 px (0,2 %) · hus 0 px (0,4 %) | – (`onNiva` hann före, se d1) | `niva`, stats 30 → 30 tex |
| c1 | 390×700 | T3 ut (Enter) | pixi, klart | 0 px (4,9 %) · dörr 0 px | 0 px (0,7 %) · hus 0 px (0,4 %) | `niva`, ingen `rensaAllt` |
| d1 | 390×700 | T3 in (Enter) | pixi, klart | 0 px (0,3 %) · hus 0 px (1,0 %) | 0 px (4,3 %, moln i fönstret) · dörr 0 px | `niva`, stats 30 → 30 tex |
| e1 | 360×640 | T3 ut (Enter) | pixi, klart | 0 px (7,2 % husdjur) · dörr 0 px | 0 px (2,1 %) · hus 0 px (5,0 % moln/rök) | `niva`, ingen `rensaAllt` |
| f1 | 360×640 | T3 in (Enter) | pixi, klart | 0 px (0,4 %) · hus 0 px (1,1 %) | 0 px (6,9 % husdjur) · dörr 0 px | `niva`, stats 24 → 24 tex |

**Utan hållning (frame-sond, rAF).** T3 ut och T3 in på båda viewporterna: den första framen med ny höjd har
`.varld-pixi-spelar` borta och canvasen gömd (`[1215 ms, 520 px, -, spelar, hus, hidden]`, 360×640). Workern blir klar
~25 ms senare och loggen behålls (`landad: {till:"305x520@1", ms:1093}`). `Yta.stats()` 24 tex / 11,3 MB före = efter.
520-rollen `p9` (idle, byggd i huset) överlevde rum-landningen (f1) och återanvändes vid nästa hus-landning. Före fixen fanns en frame med uttöjd canvas, `senaste = null`, och
alla poster var nybyggda.

**Slutbild Pixi = CSS** (360×640, T3 in, `pp:pixi:av` som referens, efter landningen): dörren 0 %, övre väggen 0,9 %,
0 px förskjutning. Det som återstår är husdjurens och molnens slumpade positioner.

**Äkta resize mitt i en rörelse** (T3 in hållen vid START, `emulate` 360×640 → 640×360): `typ:"akta"`, `rensaAllt:true`,
rörelsen avbruten (`.varld-pixi-spelar` borta, DOM i slutläget), texturer 30 → 12 (idle-förvärmt i den nya storleken).
Samma beteende som idag.

**Kvar / utanför F8.** Höjdbytet syns fortfarande som ett hopp vid landningen, i båda vägarna, eftersom det är appens CSS.
Pixi skulle kunna dölja det genom att spegla det synliga slutlagret i målnivåns geometri. Det kräver dock `data-niva`-
växling vid spegling, och zoomens centrum skulle avvika från CSS-vägens under rörelsen. Det är en synlig
beteendeändring och kräver Elias OK.

## 9. Pixi AV som standard (opt-in `pp:pixi:pa`, Elias beslut 2026-10-06)

Inför mergen till main vändes grinden: **utan flagga är allt dagens CSS/DOM-väg**, och Pixi kräver uttrycklig opt-in.

| Var | Ändring |
|---|---|
| `src/varld-kamera.js` (statisk, ingen ny import) | `pixiPaslagen()`: sant bara med `pp:pixi:pa` och utan `pp:pixi:av`. `?pixi=pa` sparar opt-in, `?pixi=normal` tar bort den. Kastar aldrig |
| `src/pages-varld.js` | Motorn (`import("./varld-motor.js")`) laddas bara om `pixiPaslagen()`. `<canvas class="varld-pixi">` renderas bara då (motorn skapar den annars själv) |
| `src/port-overgang.js` | `forladdaPortPixi` gör inget utan opt-in (ingen förladdning på login-sidan). Overlayn märks `css:av` |
| `src/varld-render.js` | Central grind: `pixiFlaggor().av = av || !pa`, `hinder()` = `"ej-paslagen"`. Även en modul som laddats på annat sätt säger nej |
| `src/varld-motor-hud.js` | `?pixi=pa` i URL-flaggorna (`pa` med i `normal`-städningen) |
| `test/varld-pixi-optin.test.js` (ny) | Standard av, `pa` på, `av` vinner, 0/false = av, URL sparar/tar bort, trasig localStorage = av, laddningsställena grindade |

**Verifierat i desk-browsern (riktiga appen, elev1):**

| Läge | Login-sidan | Inloggning (T10) | Världen (4 resor rum/hus/by/hus) |
|---|---|---|---|
| Färsk webbläsare, **ingen flagga** | inga Pixi-filer, ingen `__ppPixi` | overlay `css:av`, 1405 ms | `data-pixi-spel` sätts aldrig, CSS-transition 0.9 s/0.55 s, **ingen canvas**, 0 Pixi-filer efter 8 s idle |
| `?pixi=pa` | renderaren förladdad (`vag: pixi`) | overlay `pixi`, 1413 ms | 4/4 `pixi`, canvas finns, `pp:pixi:pa=1` sparad |
| `?pixi=normal` | – | – | flaggan borta, `pixiSpel` null, ingen canvas, 0 Pixi-filer |

BFS 133. `node --test`: 834/841. De 7 som faller är emulator-/regeltesterna, som kräver Firestore-emulatorn.

