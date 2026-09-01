# Designbeslut – Husdjur & Hem 2.0 (UTKAST – väntar på användarens godkännande)

> Källa: den interaktiva prototypen i `design/husdjur-hem-2.0-prototyp.html`
> (Artifact: https://claude.ai/code/artifact/22c7207f-a582-48bb-90c5-5d2aaa57a8bd).
> När användaren godkänt prototypen blir detta facit för implementations-uppgifterna 2–7.
> Status: **UTKAST v2** – uppdaterad efter användarens feedback (flyttbara möbler,
> Pokémon-evolution 10 matningar, putsad djurdesign, mat på golvet via shoppen).

## Färger

| Roll | Värde | Not |
|---|---|---|
| Kontur | `#3B3350`, stroke 3 (tunt 2.2), round cap/join | oförändrat från `src/art-style.js` |
| Golv | `#C9996B` plankor, linjer `#B0805A`, skarvar opacity 0.55–0.7 | färgas **aldrig** om |
| Himmel | gradient `#9AD3F0 → #E8F6FD`, sol `#F7C948` | samma ute och i fönstret |
| Kontaktskugga | `#3B3350` opacity 0.09, ellips ry ≈ 0.22·rx | under varje möbel/husdjur |
| Skuggpass på djur | `#3B3350` opacity 0.07, halvmåne på kroppens högersida | del av "putsad" stil |

### Paletter (hus & väggar) – sparas som `room.paletteId`

Fyra roller per palett: `house` (fasad), `roof` (tak), `wall` (vägg), `wall2` (panelband).

| id | namn | house | roof | wall | wall2 |
|---|---|---|---|---|---|
| persika | Persika (default) | `#F49E4C` | `#EF6F6C` | `#FFE9CC` | `#FBD9A6` |
| mint | Mintgrön | `#58C6A9` | `#46557A` | `#D7F2E4` | `#AFE3CB` |
| himmel | Himmelsblå | `#7FC7E8` | `#46557A` | `#DDF0FB` | `#B7E0F5` |
| rosa | Rosa dröm | `#F890B7` | `#B79BE0` | `#FDE4EE` | `#F9C8DD` |
| sol | Solgul | `#F7C948` | `#F08A3C` | `#FDF0C8` | `#FAE29B` |

Inga fria färgval – bara paletter (blir alltid snyggt, enkel datamodell).

## Mått & layout

- Scen (både ute och inne): viewBox **960×600**, skalas till 100 % bredd (aspect-ratio 96/60).
- Rummet: vägglinje y=430 (72 %), panelband y=340–430, golvplankor med 3 rader skarvar.
- Fönster i rummet: 228×196 vid (96,76), spröjs i kors (stroke 5), karm stroke 6,
  fönsterbräda 252×16. Moln bakom `clipPath`.
- Husets fönster (utifrån): 150×130 vid (440,330) – visar väggfärgen + glimt av rummet.
  Zoom-origin för övergången: **48.5 % / 52 %**.
- **Möbler: flyttbara med drag & drop.** Position i procent med ankare i mitt-bottenkant
  (`translate(-50%,-100%)`), sparas som `room.placements` (samma modell som idag).
  Matta ligger i eget bakgrundslager (z 1), möbler z 2, husdjur z 3, dragen möbel z 6.
- Husdjur: bas-bredd **13 %** av scenbredden; promenadzon x 10–78 %; fötter vid bottom 6 %.
- Mat: äpple 4.2 % bredd, placeras fritt i golvzonen (y 64–90 %).
- Namnskylt: pill ovanför huvudet, 2px kontur, max ~12 tecken, en ⭐ per uppnått stadium.

## Evolution & matning (Pokémon-modellen)

- **3 stadier per art**, var och en med egen form och eget stadienamn.
  **Evolutionen ska synas (Pokémon-principen): ny siluett + färgskifte + nya element per stadium.**
  Stadium 1 = gullig unge, stadium 2 = mer karaktär, stadium 3 = cool slutform med bestämd blick
  (ögonbryn), vingar/eld/blixtar/kosmisk päls. Exempel-linjer i prototypen:
  - Gnistra-linjen: **Gnizt → Gnistra → Stjärnglans** (vit kattunge med hornknopp → slank katt med
    spiralhorn & stjärnsvans → kosmisk alicorn: rymdmörk `#46557A` päls, galax-vingar i gradient
    marin→lila→mint med stjärnprickar, norrskensman, guldkrage med gem, guldhovar)
  - Taggen-linjen: **Knytt → Taggen → Eldvakt** (grön drakunge med magplattor & nos → stående drake
    med vingar, horn & klor → pansarklädd elddrake: röd `#C9534E` kropp, enorma röda vingar med
    guldspar, segmenterat guldpansar + axelplattor, hornkrona med regnbågskam, pannplåt med gem, eldsvans)
  - Snurran-linjen: **Plutt → Snurran → Blixtlopp** (rund lila unge → smäcker sprinter med
    fjädersvans-spiral & blixtmärke → blixtvarg: mörklila `#9C7ED0`, mörk ansiktsmask `#4C4661`,
    svarta örontoppar med blixtar, stor blixtformad svans i guld, gnistor)
- **Tillväxt:** varje matning ger +0.022 i skala. Stadiebas-skala: **0.66 / 0.90 / 1.18**
  (10 matningar ≈ +22 % → nästa stadiebas tar vid nästan sömlöst).
- **Evolution: efter 10 matningar** → nästa stadium, maträknaren nollas.
  Fullvuxen = stadium 3 med 10 matningar; därefter ignorerar djuret mat.
- **Mat köps i shoppen:** vara `apple` (Äpple), **5 mynt**, läggs i matförrådet
  (`studentData.foodInventory`), obegränsat antal i förråd.
- **Utplacering:** eleven väljer "Lägg ut mat" och klickar på golvet i rummet →
  äpplet landar med studs (400 ms). Närmast lediga, icke-fullvuxna husdjur går själv dit
  (promenad-AI:n växlar till "seek", ~1.6× promenadfart), äter (mums-puls) och räknaren ökar.
- **Dagsgräns i produktion:** 1 matning per husdjur och dag (prototypen obegränsad för demo).
- Uttryck styrs av humör: `hungrig` när inte matad idag, `somnig` på kvällen,
  `matt` direkt efter matning, annars `glad`; `yr` medan den ligger på rygg.
  Uttryck är utbytbara ansiktslager – funkar för alla arter och stadier utan ny ritkod.
- Klick på husdjur → ramlar på rygg (ofarligt, bara kul).

## Djurdesign 2.0 (principer för ALLA arter — kalibrerade mot Pokémon-referens)

- **Riktig anatomi, inte blob-med-huvud:** fyra ben (eller ben+armar för tvåbenta),
  tassar/klor, nos/mun-parti, kindtofsar, haunches. Stadium 1 sittande unge (huvud r≈19),
  stadium 2 smäcker sittande/stående (r≈16–17), stadium 3 stående med full siluett (r≈16
  men mycket större kropp/vingspann).
- **Ögon: mandelformade med iris** — vit ögonvita, bärnstensiris `#F2A93B`
  (guld `#F7C948` på el-arter), mörk pupill, ljusglimt. Rosa kinder ENDAST på stadium 1.
- **Stadium 2–3 får bestämda ögonbryn**; stadium 3 dessutom tydligt **färgskifte**
  (vit → rymdmörk, grön → röd, ljuslila → mörklila med mask).
- **Detaljpass per djur:** fjäderlinjer + stjärnprickar i vingar, spiralräfflor i horn,
  segmenterat guldpansar (gradient `#F7C948→#F2A93B`), magplattor, klor i benvit,
  mörk ansiktsmask, gnistor/blixtar. Gradients är tillåtna för vingar/manar/pansar
  (t.ex. norrsken `#F890B7→#B79BE0→#58C6A9`).
- Skuggpass (`#3B3350` op 0.07) på kroppens ena sida behålls.
- Ton: blanda gulligt och coolt över artbeståndet — stadium 1 får vara sött,
  slutformerna ska kännas mäktiga.

### Rigg för animation (alla arter)

Varje djur-SVG grupperas för CSS-animation: `g.benA`/`g.benB` (ben i motfas),
`g.svans` (svans), `g.face` (utbytbart ansikte). Transform-origin via
`transform-box:fill-box` (höft = 50 % 8 %, svansfäste = 12 % 60 %).

## Animationstajming

| Vad | Värde |
|---|---|
| In/ut ur huset | 900 ms, `cubic-bezier(.55,0,.2,1)`; ute zoomas mot fönstret (scale 6) medan rummet tonas in från scale 1.14 |
| Moln ute | 46–75 s per varv, linjärt, 3 moln i olika skala/hastighet |
| Moln i fönstret | 34–52 s per varv, 2 moln |
| Solstrålar | rotation 70 s/varv |
| Skorstensrök | puff 4 s, 3 puffar med 1,3 s fasförskjutning |
| Gångcykel | bensteg ±8° i 0,5 s (benA/benB i motfas), kroppen gungar ±1,4° och lyfter 2,8 % två gånger per cykel; ~7 %/s (mot mat ~11 %/s); flip via `scaleX(-1)` |
| Svans | vajar ±4–5° kontinuerligt, 2,8 s per cykel |
| Vila (andning) | kroppen skalas 1,8 % i höjdled kring fotpunkten, 3,4 s per andetag |
| Ramla på rygg | 700 ms med studs till rot. 157° kring fotpunkten (origin 50 %/92 %); ligger 2,6 s; reser sig 550 ms |
| Äta | mums-puls 450 ms → tillväxt-pop 450 ms `cubic-bezier(.34,1.56,.64,1)` |
| Evolution | vit blink 3×250 ms → formbyte → ✨🌟-burst ~900 ms, namnskylt får ⭐ |
| Mat landar | studs 400 ms `cubic-bezier(.3,1.6,.5,1)` |

## Möbelstil 2.0

Samma stilguide som figurerna men rikare: tvåtonat trä (`#B0805A`/`#8A6242`/`#E0B98C`),
textilier med sömmar (dash-linjer), växter, ljusslinga, mjuk kontaktskugga.

**Stilmix-princip:** varje möbeltyp får minst 2–3 stilvarianter i shoppen — mysigt OCH coolt —
så rummet inte blir "gulligull" om man inte vill. Sängexemplen i prototypen:
- **Rymdsäng** (cool, default i rummet): marin `#46557A` gavel med planet, mörkt stjärntäcke `#46405C`, stålben
- **Racersäng** (cool): bilform `#EF6F6C` med spoiler, hjul, startnummer och strålkastare
- **Himmelsäng** (mysig): volangtäcke, hjärtgavel — det gulliga alternativet finns kvar att köpa

Övriga referensmöbler: Bokhylla (växt/pokal/vimpel), Pluggöhörna (skrivbord+lampa+pall),
Mysfåtölj (pläd+kudde+stjärna), Solmatta, Krukväxt.
Alla möbler flyttbara i rummet (drag & drop, procentpositioner).
