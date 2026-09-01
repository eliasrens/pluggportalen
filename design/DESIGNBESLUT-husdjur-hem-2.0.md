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
  Exempel-linjer i prototypen (samma system för alla arter):
  - Gnistra-linjen: **Gnizt → Gnistra → Stjärnglans** (enhörningskatt: hornknopp → spiralhorn → vingar & man)
  - Taggen-linjen: **Knytt → Taggen → Eldvakt** (drake: hornknoppar → taggar & vingknoppar → stora vingar & eldsvans)
  - Snurran-linjen: **Plutt → Snurran → Månglans** (månhare: korta öron → långa öron → månmärke & stjärngnistor)
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

## Djurdesign 2.0 (putsprinciper för ALLA arter)

- Stadium 1 gulligast (huvud r≈23, rund blob-kropp), stadium 2 mer karaktär (r≈20,
  sittande kropp med ben), stadium 3 ståtligast (r≈17.5, stående högre kropp, smalare siluett).
- Skuggpass (`#3B3350` op 0.07) på kroppens ena sida + detaljpass (fjäderlinjer i vingar,
  spirallinjer i horn, plattor på drakmage, innerteckning i öron) höjer kvaliteten
  utan att lämna den platta stilen.
- Sekundärfärg används som accent (man/tofs/taggar), max 3 färger + kontur per djur.

## Animationstajming

| Vad | Värde |
|---|---|
| In/ut ur huset | 900 ms, `cubic-bezier(.55,0,.2,1)`; ute zoomas mot fönstret (scale 6) medan rummet tonas in från scale 1.14 |
| Moln ute | 46–75 s per varv, linjärt, 3 moln i olika skala/hastighet |
| Moln i fönstret | 34–52 s per varv, 2 moln |
| Solstrålar | rotation 70 s/varv |
| Skorstensrök | puff 4 s, 3 puffar med 1,3 s fasförskjutning |
| Promenad | ~7 %/s; mot mat ~11 %/s; vaggning ±3,5° i 0,55 s-takt; flip via `scaleX(-1)` |
| Ramla på rygg | 700 ms med studs till rot. 157° kring fotpunkten (origin 50 %/92 %); ligger 2,6 s; reser sig 550 ms |
| Äta | mums-puls 450 ms → tillväxt-pop 450 ms `cubic-bezier(.34,1.56,.64,1)` |
| Evolution | vit blink 3×250 ms → formbyte → ✨🌟-burst ~900 ms, namnskylt får ⭐ |
| Mat landar | studs 400 ms `cubic-bezier(.3,1.6,.5,1)` |

## Möbelstil 2.0

Samma stilguide som figurerna men rikare: tvåtonat trä (`#B0805A`/`#8A6242`/`#E0B98C`),
textilier med volang/sömmar (dash-linjer), växter, ljusslinga, mjuk kontaktskugga.
Referensmöbler i prototypen: Himmelsäng, Bokhylla (växt/pokal/vimpel), Pluggöhörna
(skrivbord+lampa+pall), Mysfåtölj (pläd+kudde), Solmatta (volangkant+stjärnor), Krukväxt.
Alla möbler flyttbara i rummet (drag & drop, procentpositioner).
