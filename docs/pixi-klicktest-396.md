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

Previewn kör **riktiga appen** från den här grenen (epic-innehållet + I1) mot den riktiga databasen. Logga in som
vanligt (t.ex. elev1). Klicka runt som en elev men undvik att köpa saker, eftersom det skrivs på riktigt.

**Slå på mät-HUD:en:** lägg till `?pixi=debug` före `#` i adressen (t.ex. `…/?pixi=debug#/elev/hus`) och ladda om.
Flaggan sparas i webbläsaren tills du tar bort den. En ruta nere till vänster (efter första övergången) visar:
- raden `övergång`: 🟢 pixi eller 🟠 css:<orsak>,
- raden `frame-dt` + grafen: workerns bildtider (snitt, max, tappade > 25 ms; 16,7 ms = 60 fps),
- raden `handoff`: förberedelsetid och `väntan klart|reserv|deadline <ms>` (`klart` = ny bild, `reserv` = förvärmd bild),
- texturcachen och budgeten (G1, se `docs/pixi-gpu-budget-396.md`).

**Jämför mot dagens CSS-övergång:** `?pixi=av` (ladda om) → samma klick, nu exakt som på main. Tillbaka till
Pixi: `?pixi=normal`. Bra resor att jämföra: hus ↔ by (klasskylten), hus ↔ rum (dörren), hus → gården →
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
