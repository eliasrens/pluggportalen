# Designbeslut – Husdjur & Hem 2.0 (UTKAST – väntar på användarens godkännande)

> Källa: den interaktiva prototypen i `design/husdjur-hem-2.0-prototyp.html`
> (Artifact: https://claude.ai/code/artifact/22c7207f-a582-48bb-90c5-5d2aaa57a8bd).
> När användaren godkänt prototypen blir detta facit för implementations-uppgifterna 2–7.
> Status: **UTKAST** – kan ändras under iterationen.

## Färger

| Roll | Värde | Not |
|---|---|---|
| Kontur | `#3B3350`, stroke 3 (tunt 2.2), round cap/join | oförändrat från `src/art-style.js` |
| Golv | `#C9996B` plankor, linjer `#B0805A`, skarvar opacity 0.55–0.7 | färgas **aldrig** om |
| Himmel | gradient `#9AD3F0 → #E8F6FD`, sol `#F7C948` | samma ute och i fönstret |
| Kontaktskugga | `#3B3350` opacity 0.09, ellips ry ≈ 0.22·rx | under varje möbel/husdjur |

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
- Fönster i rummet: yttermått 228×196 vid (96,76), spröjs i kors (stroke 5), karm stroke 6,
  fönsterbräda 252×16. Moln bakom `clipPath`.
- Husets fönster (utifrån): 150×130 vid (440,330) – visar väggfärgen + en glimt av rummet
  (lampa + husdjursöron). Zoom-origin för övergången: **48.5 % / 52 %**.
- Husdjur: bas-bredd **11,5 %** av scenbredden; promenadzon x 10–78 %; fötter vid bottom 6 %.
- Namnskylt: pill ovanför huvudet, 2px kontur, max ~12 tecken, ⭐-prefix vid steg 3.

## Animationstajming

| Vad | Värde |
|---|---|
| In/ut ur huset | 900 ms, `cubic-bezier(.55,0,.2,1)`; ute zoomas mot fönstret (scale 6) medan rummet tonas in från scale 1.14 |
| Moln ute | 46–75 s per varv, linjärt, 3 moln i olika skala/hastighet |
| Moln i fönstret | 34–52 s per varv, 2 moln |
| Solstrålar | rotation 70 s/varv |
| Skorstensrök | puff 4 s, 3 puffar med 1,3 s fasförskjutning |
| Promenad | ~7 %/s; vaggning ±3,5° i 0,55 s-takt; riktningsbyte vid zonkant (flip via `scaleX(-1)`) |
| Ramla på rygg | 700 ms med studs till rot. 157° kring fotpunkten (origin 50 %/92 %); ligger 2,6 s; reser sig 550 ms |
| Matning | mums-puls 450 ms → tillväxt-pop 450 ms `cubic-bezier(.34,1.56,.64,1)` |
| Evolution (steg 3) | ✨-burst ~900 ms + 🌟 + namnskylt får ⭐ |

## Husdjursregler (produktion)

- Tillväxtskala per steg: **0.75 / 1.0 / 1.25** (transform-origin i fotpunkten).
- Matning 1 gång/dag per husdjur; steg 2 vid **3** matningar, steg 3 vid **7**
  (som `src/data-pet.js` idag). Prototypen använder 2/4 för demo.
- Flera husdjur: varje köpt ägg blir ett eget husdjur med eget namn
  (namnges vid kläckning, förslag + fritext, max 12 tecken).
- Uttryck styrs av humör: `hungrig` när inte matad idag, `somnig` på kvällen,
  `matt` direkt efter matning, annars `glad`; `yr` medan den ligger på rygg.
- Klick på husdjur → ramlar på rygg (ofarligt, bara kul). Uttryck är utbytbara
  ansiktslager ovanpå samma kropp – funkar för alla arter utan ny ritkod.

## Möbelstil 2.0

Samma stilguide som figurerna men rikare: tvåtonat trä (`#B0805A`/`#8A6242`/`#E0B98C`),
textilier med volang/sömmar (dash-linjer), växter, ljusslinga, mjuk kontaktskugga.
Referensmöbler i prototypen: Himmelsäng, Bokhylla (växt/pokal/vimpel), Pluggöhörna
(skrivbord+lampa+pall), Mysfåtölj (pläd+kudde), Solmatta (volangkant+stjärnor), Krukväxt.
