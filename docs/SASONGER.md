# Säsonger och tillägg

Världen, porten (elevernas inloggning), lärarspärren och butiken byter utseende med
**säsongen** (Sommar, Höst, Vinter) och med **tilläggen** (Halloween, Jul) som ligger
ovanpå valfri säsong. Admin styr läget i Admin → Säsong. Byggt i epic #689 (Höst och
Halloween) och epic #906 (Vinter och Jul).

## Läget: `config/season`

Ett enda dokument som bara admin skriver och alla läser, även utloggade
(`firestore.rules`, `validSeasonDoc`). Formen står i [DATAMODELL.md](DATAMODELL.md).
Klienten har **en** lyssnare på dokumentet (`src/season.js`, kvoten #231) och jämför
slutdatum mot en server-korrigerad klocka (`serverNow()`), så elevens datorklocka
påverkar inget. Senaste läget cachas i `localStorage` (`pp:season`) så att första
bilden ritas i rätt tema utan blink (`applyCachedTheme`).

Saknas dokumentet, eller är det sommar utan tillägg, ser allt ut exakt som före
säsongerna. Det verifieras med pixeldiff mot main i varje slut-QA.

## Lägga till en säsong

1. **En rad i `SEASONS`** i `src/season-config.js`: `label`, `palette` (blir
   `--sz-*`-variabler på `.varld-stage`, `.room-window`, `.port-scen`,
   `.port-overgang` och lärarspärren), `dekor` (`leaves`, `sno` …) och `preview`
   (adminflikens förhandsvisning).
2. **Nyckeln i reglerna:** `d.season in ['sommar', 'host', 'vinter', …]` i
   `validSeasonDoc`.
3. **Dekorklasserna** i `src/styles/32-sasong.css`: `.sz-bara-<säsong>` (visas bara
   då) och `.sz-dolj-<säsong>` (göms då), styrda av `<html data-sasong>`. Konsten
   läser färgerna med `sz()` i `src/art-style.js`, med dagens färg som reserv.
4. **Knappen** i adminfliken kommer automatiskt ur `SEASONS`.

## Lägga till ett tillägg (t.ex. Påsk)

1. **En rad i `TILLAGG`** i `src/season-config.js`: `id`, `label`, `emoji`, `falt`
   och `tillFalt` (på/av och slutdatum i dokumentet), `standardTill` (förvalt
   slutdatum), `loginPalett` och `samling`. Allt som frågar efter ett tillägg går
   via registret: `tillaggAktivt`, `aktivaTillagg`, `nextSeasonBoundary`,
   `describeSeason`, `themeFor` och `<html data-<id>>`.
2. **Fälten i reglerna:** `falt` (bool) och `tillFalt` (timestamp eller null) i
   `validSeasonDoc`, både i `hasOnly` och i typkontrollen.
3. **Dekor:** `.sz-bara-<id>` och `.sz-dolj-<id>`, styrda av `<html data-<id>>`.
   Tilläggets världsdekor laddas lazy (Jul: `src/jul/jul-varld.js`).
4. **En samling och en flik:** varorna får `collection: "<samling>"` och registreras
   lazy (`registerShopItems`). Fliken är en rad i `src/butik-samlingar.js` med
   `skapaSamlingsFlik` (`src/samling-butik.js`). Servern läser samma katalograder
   vid köp: kör `npm run sync:butik` och deploya `butikKop`.
5. **Adminfliken** får en På/Av-rad med slutdatum automatiskt ur registret.

**Båda tilläggen på samtidigt** är tillåtet. Dekoren visas för båda. På inloggningen
vinner den **senare raden** i registret, alltså Jul över Halloween (`themeFor`).

**Bakåtkompatibelt:** fälten `halloween` och `halloweenUntil` heter som förut och
`isHalloweenActive()` finns kvar. En gammal klient som inte känner `jul` ignorerar
fältet. Men en gammal **admin**sida som sparar skriver hela dokumentet utan `jul`
och stänger därmed av julen: ladda om admin efter en deploy.

## Regler mot bländning (vintern)

- **Ingen stor yta är `#FFFFFF`.** Snö är som ljusast `#EEF3F8`, highlights på
  snötäcken `#F7FAFD`.
- **Mörka konturer runt all snö,** som runt allt annat.
- **Färgklickar kvar:** husens färger ändras inte, granar och kronor blir mörkgröna,
  lägerelden, lyktorna och fönstren lyser varmt.
- **Mätbart:** i skärmdumpar på 1366 × 768 av byn, huset ute, gården, porten och
  lärarspärren ska medelluminansen vara högst 215 av 255 och högst 5 % av pixlarna
  ha luminans ≥ 245 (Rec. 709). Kommandot är
  `node admin/qa-vinter-blandtest.mjs <png …>`.

## Partikellagret

`PARTIKLAR` i `src/season-world.js` har en typ per partikel: `lov` (hösten, 16 löv)
och `sno` (vintern, 18 flingor, högst 20). Samma kod sköter montering, paus i dold
flik (`html.sz-paus`), reducerad rörelse (`display: none`) och klick
(`pointer-events: none`). Varje partikel har en enda CSS-animation med bara
`transform` och `opacity`. Lagret ligger i världen (i byn mellan husen och
namnskyltarna), på porten och genom port-övergången, men aldrig i rummet. En ny typ
är en rad i `PARTIKLAR` och en regel `html[data-<attr>] .sz-<typ>-lager` i CSS:en.

Halloween har också fladdermöss, men bara på inloggningen.

**Snö på taken** görs generiskt (`snoTak` i `src/art-style.js`): ett SVG-filter tar
fram det som vänder uppåt i husets silhuett. Filtret körs en gång per husskal till en
PNG (`rastreraSnoTak`), i rutor på huvudtråden, så att det fungerar för alla husskal,
även köpta Halloween-, jul- och legendariska hus.

## Bootgrafen

Allt säsongs- och tilläggsspecifikt laddas med `import()`. Bootgrafen har kvar
107 filer (`node admin/qa-bootgraf-bfs.mjs`).
