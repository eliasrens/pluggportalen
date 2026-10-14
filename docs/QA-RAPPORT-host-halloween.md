# QA-rapport – Höst & Halloween (#696, epic #689)

Slut-QA av epic-grenen (bas `2d11bca`, A–F #690–#695 landade). Spec:
`UTVECKLINGSUPPDRAG_HOST_HALLOWEEN.md` §7 (test 1–18) och §8. Allt kördes mot
Firebase-emulatorerna (`admin/qa-sasong-preview.sh` + `admin/qa-klasscenter-by-seed.mjs`,
eleven kc01) i headless Chromium. Läget byttes live med `admin/qa-sasong-satt.mjs`.
För pixeljämförelser kördes en kopia av `origin/main` (`f42a2bf`) mot samma emulator.
Skärmdumpar finns i `docs/qa-host-halloween-696/`.

## Sammanfattning

- **Alla 18 tester är gröna.** Regression: `node --test` 2397/2398 och
  `test:rules` 597/597. Det enda felet är ett slumpberoende äventyrstest
  (`adventure-flee`, "pickRespawn"). Det är grönt 6/6 vid omkörning och epicen rör det inte.
  Boot-grafen har 107 filer. `test:functions` kördes inte: epicen ändrar inga functions.
- **Ett fynd (låg), F2.** Live-projektorns avatarpool kan visa en platshållare i
  stället för en kostym eller köpavatar. Det är rapporterat till leaden.
- **En observation, F1.** Löven kostar cirka 2 ms stilberäkning per bildruta vid 4×
  strypning. Bildfrekvensen skiljer sig inte mätbart på den här maskinen. Bekräfta
  gärna på en Chromebook.
- **Barnvänligt.** Ingen grafik är otäck. Alla tio djur i tre steg, kostymerna,
  avatarerna och de tre husen har stora ögon och mjuka former.
- **Inga nya emojier från Emoji 13 eller senare** (`admin/qa-halloween-emoji.mjs`, mot Unicodes tabeller).
  Den enda träffen är 🛖 i `pages-shop-kopt.js`. Det är befintlig text som flyttats
  från `pages-shop.js` på main.

## Tester (§7)

| Test | Resultat | Hur |
| --- | --- | --- |
| 1 Utan `config/season` = som i dag | ✅ | Pixeldiff mot main (animationer frysta, 1366×768): hus 0 px, by 0 px, rum 0 px |
| 2 Höst live, Plugga/Live/lärarsidan oförändrade | ✅ | `qa-sasong-satt host` på öppen sida: `data-sasong=host`, palett + 16 löv utan omladdning. Under höst + Halloween är skillnaden mot main 0 px för Plugga, Live, Läsresan och lärarsidan (översikt/klasser/statistik, årskurskonto) |
| 3 Elev/årskurskonto ändrar säsongen → nekas | ✅ | `test/firestore-rules-season.test.js` (elev, årskurs, utloggad, avstängd admin och falskt claim nekas). Årskurskontot ser ingen Säsong-flik. Admin sparar via bekräftelsen "Ja, ändra för alla" (dokumentet skrivet med `updatedBy` = admin-uid) |
| 4b Inloggningen sommar/höst/Halloween, ingen blink, samma kontrast | ✅ | Live-byte på utloggad sida. Vid omladdning ritas porten första gången redan i rätt tema (MutationObserver: porten och `data-sasong` kommer i samma mutation). Rutans, fältens och knappens färger är identiska i alla tre lägena. Lärarinloggningen följer temat |
| 4 Löven: bildfrekvens, dold flik, reducerad rörelse, klick | ✅ (se F1) | 16 löv. `elementFromPoint` träffar aldrig ett löv (`pointer-events:none`). Reducerad rörelse ger `display:none`. Dold flik ger `.sz-paus` och `animation-play-state: paused`. Löven är dolda i rummet. Mätningen står nedan |
| 5 Halloween på/av → sektionen syns/döljs | ✅ | Fliken 🎃 Halloween har 6 undergrupper. Med Halloween av finns ingen flik, och inga Halloween-varor syns i de vanliga flikarna |
| 5b Slutdatum passerar medan eleven är inne; datorklockan påverkar inget | ✅ | Slutdatum om 40 s. Elevens `Date` flyttades +30 dygn (init-skript) och `serverNow()` stod ändå rätt. Halloween var på tills den riktiga tiden passerat, sedan försvann fliken och kostymerna (3/3 → 0/3) utan omladdning |
| 6 Köpt lykta, trädgårdssak och spökhus fungerar när Halloween är av | ✅ | Med Halloween av: pumpalyktan placerad i rummet, pumpahögen utställd i trädgården, Gulligt spökhus valt (`husSkalId=hw-spokhus`) |
| 7 Placera, flytta, ta bort | ✅ | Pumpalykta (rum) och pumpahög (trädgård): placerad, flyttad med dra-och-släpp och plockad bort. Varje steg verifierades i Firestore |
| 8 Kostym bärs och syns i rum/by/Live | ✅ | 4 kostymer påtagna i garderoben. Synliga i sidomenyn, framför huset, i byn och på Live-sidan |
| 9 Halloween av: osynlig, gråad, kan inte tas på, ingen data omskriven | ✅ | 0 synliga i hus/by/Live. Garderoben är gråad ("🎃 Ta av"). Avtagen kostym: "Kan bäras igen nästa Halloween", och ett nytt klick ger samma meddelande utan att kostymen tas på. `avatarItems` var orört tills eleven själv tog av |
| 10 Halloween på igen → syns igen | ✅ | Live och efter omladdning: 6/6 synliga |
| 11 Varje kostym på varje avatar, även de nya | ✅ | `preview/preview-kostymer.html` visar nu också de 6 köpbara avatarerna: 11 × 36 = 396 celler, 0 platshållare. Bilder: `kostym-matris-1…4.png`, förstorat `kostym-zoom.png` |
| 12 Köpt Halloween-avatar kan väljas och finns kvar när Halloween är av | ✅ | Köpte Litet spöke (400). Med Halloween av valdes den i avatarvalet och sparades som `avatarId=hw-av-spoke` |
| 13 Ej köpt kan inte väljas, befintliga gratis | ✅ | De 5 ej köpta visas låsta: klick väljer inget. De 30 gratis visas olåsta som förut. Regeln `kopAvatarOk` testas i `test/firestore-rules-avatarer.test.js` (gratis väljs fritt, ej köpt nekas) |
| 14 Köp Spökis → pumpaägg → Spökis | ✅ | 500 mynt, `pets[].eggSpecies=spokis`. Efter ett simulerat dygn kläcktes det till Spökis steg 1 (Dimfjun) via det vanliga flödet |
| 15 Spökis hungrig, äter Mysterymat, tre steg | ✅ | Mysterymaten lades ut och Spökis gick dit och åt (feedCount 0→2). Vid 9→10 blev det steg 2 och vid 19→20 steg 3 (krona och stjärnkedja). Fullvuxen söker inte mat |
| 16 Bildbaserade mysteriedjur som förut | ✅ | En kläckt Eldis åt Mysterymat (3→4). `test/halloween-djur.test.js` test 16: alla 13 sprite-arter har `mystery:true`, och det mystiska ägget slumpar bara sprite-arter |
| 17 Förhandsvisningen 10 × 3 × 4 utan fel | ✅ | `preview/preview-halloween-djur.html`: 0 konsolfel, alla tio djur i tre steg med glad/nyfiken/äter/sömnig/vila samt äggen |
| 18 Regression | ✅ | Testsviterna enligt sammanfattningen. 0 konsolfel i hus/by/rum/shop/plugga/läsresan/profil/live under Halloween. Mysterybox (Lyktglob) och Mysterymat-köp fungerar. Mysteryboxens pool innehåller inga Halloween-varor |

## Fynd

### F2 (låg) – Live-avatarpoolen läker inte en figur som ritats frånkopplad

`src/live/design/live-avatar-pool.js` ritar varje figur en gång med `avatarMarkup`.
Kostymer (`hw-*`) och köpavatarer laddas lazy. Före laddningen blir de platshållare
(`.af-kostym-vantar` resp. `svg[data-av-vantar]`), och efter laddningen byts de ut via
`document.querySelectorAll`. Ett pool-element som ritats medan det inte satt i
dokumentet missas därför, och poolen ritar inte om det (samma `looksKey`).

Det är reproducerat: `pool.el("u2")` utan append, append efter 4 s, och platshållaren
står kvar. I lobbyn (`el()` och `append` i samma tick) fungerar det. Risken gäller vyer
som skapar en figur före visning (t.ex. reaktioner i `live-regi.js` eller pall/notis)
under den första laddningen. Förslag: exportera ett "konsten klar"-löfte ur
`avatars.js` och rita om i `draw()` när markup innehöll en platshållare.

### F1 (observation) – lövens kostnad

Löven animeras bara med `transform`/`opacity` och kompositeras (inget `compositeFailed`
i spåret). Keyframes med `var()`/`calc()` gör ändå att Blink räknar om stilen varje
bildruta.

## Lövmätning (§1.4)

Headless Chromium på en delad och hårt belastad maskin (load 5–8), 1366×768, hus-vyn i
höst och requestAnimationFrame-intervall. Den här Chromium saknar GPU (SwiftShader).

| Mätning | Med löv (16) | Utan löv |
| --- | --- | --- |
| 1× CPU, 3 × 6 s | 58,8 / 59,3 / 59,0 fps | 60,0 / 60,0 / 59,7 fps |
| 4× strypning, 5 × 6 s växelvis | 53,5 / 51,7 / 53,9 / 50,2 / 55,3 (snitt 52,9) | 53,0 / 36,2 / 53,2 / 59,5 / 55,3 (snitt 51,4) |
| 4× strypning, stilberäkning per 3 s (spår, 4 omgångar) | 870–930 ms (≈ 4,9 ms/bildruta) | 470–530 ms (≈ 2,8 ms/bildruta) |

Bildfrekvensen skiljer sig inte mätbart, eftersom bruset från maskinen är större än
skillnaden. En tidigare omgång under högre last visade 44–54 mot 60 fps, och en annan
lika med och utan löv. Med 4× strypning lägger löven till cirka 2 ms stilberäkning per
bildruta (budgeten är 16,7 ms). En möjlig förbättring är keyframes utan `var()` (några
fasta varianter), som gav ungefär en tredjedel av kostnaden i ett A/B-test.
**Bekräfta på en riktig Chromebook:** DevTools → Rendering → Frame rendering stats, i
hus-vyn med Höst, med och utan löv.

## Priser (§8)

| Grupp | Varor och pris (mynt) |
| --- | --- |
| Dekor & möbler (12) | Spindelnät 40, Fladdermusgirlang 45, Skål med godis 50, Häxkvast 55, Pumpalykta 60, Ljusstake 75, Halloweenmatta 85, Spökgardin 95, Skelettfigur 110, Spöklampa 120, Kristallkula 150, Häxkittel 180 |
| Trädgård (8) | Pumpahög 60, Lövhög 70, Buu!-skylt 80, Halmbal med pumpor 110, Häxhattsbrevlåda 130, Fågelskrämma 140, Lyktstolpe med pumpa 180, Lysande svampar 300 |
| Hus (3) | Gulligt spökhus, Pumpahus och Snällt döskallehus, 4 000 var (Elias val) |
| Kostymer (11) | Godispåse 50, Kattöron 60, Mumiebandage 70, Monsterhorn 80, Spökmask 90, Vampyrkrage 100, Häxstav 110, Häxhatt 120, Pumpahuvud 150, Fladdermusvingar 200, Vampyrmantel 250 |
| Avatarer (6) | Litet spöke 400, Fladdermus 450, Pumpgubbe 500, Gullig mumie 600, Häxkatt 700, Liten vampyr 800 |
| Djur (10) | Spökis, Pumpis, Fladdis, Gruffe, Svartis, Mumme, Spindis, Skelli, Uggli, Slemmis, 500 var |

## Säkerhet

- **`config/season`:** bara admin skriver, och fälten valideras. Elev, årskurskonto,
  utloggad användare, avstängd admin och påhittat claim nekas (regeltester).
- **Välja en ej ägd avatar:** reglerna nekar `avatarId=hw-av-*` som inte finns i
  `ownedItems` (`kopAvatarOk`).
- **Kvarstående, samma förtroendemodell som hela butiken i dag:**
  - **Köp utanför Halloween:** stoppas bara i klienten (`pages-shop.js` vägrar köpet
    när Halloween är av).
  - **Ägg som kläcks till fel djur:** pumpaäggets `eggSpecies` skrivs av klienten.
  - **`ownedItems`, `coins` och `pets`:** eleven skriver dem själv, så en elev med
    DevTools kan ge sig själv varor, en köpavatar eller ett valfritt djur. Det gällde
    redan före epicen för alla butiksvaror. Att stänga det kräver köp via en server
    (functions).

## Elias scope-ändringar (verifierade)

- **Tre hus à 4000:** Gulligt spökhus, Pumpahus och Snällt döskallehus finns i
  Halloween → Hus (`butik-halloween-hus-*.png`). Spökhuset köptes och valdes.
- **Gladare höst (417e6a1):** krispig blå himmel, grönt gräs med guldstänk och kronor
  i orange, rött och gult (`varld-host-*.png`, `by-host-*.png`, `login-host-*.png`).
- **Spökis vinkar på Halloween-inloggningen:** visas nere till vänster om porten
  (`login-halloween-*.png`) och laddas lazy. Bootgrafen har kvar 107 filer, och
  `shop-items.js` har exakt 400 rader.

## Kända begränsningar

- **Halloween-köpspärren finns bara i klienten** (se Säkerhet).
- **Löven är mätta i SwiftShader, inte på en riktig Chromebook** (se F1 och
  Lövmätning).
- **Grannbyn ("Andra byar") är inte testad i emulatorn.** Säsongspaletten gäller där
  via samma `.varld-stage`-variabler som i den egna byn, som är testad.

## Kantfall att känna till

- **Säsongsdekor finns bara i världen.** Plugga/Live sätter inte `data-sasong`. Där
  sätts `data-halloween` först när en avatar med kostym ritas (`ensureTheme`), så det
  är rätt för kostymerna.
- **Första bilden använder elevens klocka.** `applyCachedTheme` räknar
  `halloweenActive` med klientklockan. Därefter rättar `season.js` mot serverklockan
  inom någon sekund.
- **Mindre text- och ritdetaljer:**
  - Vampyrmanteln syns knappt bakom pingvinens breda kropp. Det beror på en befintlig
    ankarpunkt för rygg-slotten.
  - Kläckningsrutan säger "Mata 10 äpplen" om Mysterymat. Det är befintlig text.
  - Köpmeddelandet "Sätt på den" används även för Fladdermusvingar.

## Vad Elias behöver göra

1. **Deploya Firestore-reglerna** (`firebase deploy --only firestore:rules`). De
   innehåller `config/season`, som utloggade måste kunna läsa, och `kopAvatarOk`.
   Ingen deploy behövs för functions eller indexes.
2. **Logga in som admin** → Admin → Säsong. Välj **Höst** och **Halloween på**.
   Slutdatumet är förvalt till 2 nov 23.59. Spara och bekräfta "Ja, ändra för alla".
3. **Gärna:** mät löven på en riktig Chromebook (F1) och titta på skärmdumparna nedan.

## Skärmdumpar (`docs/qa-host-halloween-696/`)

- **Inloggningen:**
  - `login-{sommar,host,halloween}-{1366,1920}.png`
  - `login-larare-halloween-1366.png`
- **Världen:**
  - Sommar: `varld-sommar-{1366,1920}.png`
  - Höst: `varld-host-{1366,1920}.png` och `by-host-{1366,1920}.png`
  - Spökhus och pumpahög med Halloween av: `hus-spokhus-pumpahog-hw-av-{1366,1920}.png`
- **Halloween-sektionen:**
  - `butik-halloween-{inne,tradgard,hus,djur,avatarer,kostymer}-{1366,1920}.png`
  - Mysterybox: `mysterybox-regression-1366.png`
- **Kostymer:**
  - `kostym-hus-halloween-{pa,av}-{1366,1920}.png`, `kostym-by-halloween-pa-1366.png`
  - Garderoben: `garderob-kostym-pa-1366.png` och `garderob-halloween-av*.png`
  - Matrisen: `kostym-matris-1…4.png`, förstorat `kostym-zoom.png`
- **Avatarer:**
  - Avatarval med låsta köpavatarer: `avatarval-utan-halloween-1366.png`
  - Spöket valt: `avatarval-spoke-vald-1366.png`
  - Butiken: `butik-halloween-avatarer-*.png`
- **Djur:**
  - Förhandsvisningen: `djur-forhandsvisning-{1366,1920}.png` och `djur-alla-1…4.png`
  - Rummet: `rum-pumpaagg`, `rum-spokis-klackt`, `rum-spokis-ater`, `rum-spokis-steg2`,
    `rum-spokis-steg3`, `rum-eldis-och-spokis` och `rum-pumpalykta-placerad-hw-av`
- **Admin:** `admin-sasong-{1366,1920}.png`
