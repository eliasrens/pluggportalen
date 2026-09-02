# Designbeslut – Husdjur & Hem 2.0

> Källa: den interaktiva prototypen i `design/husdjur-hem-2.0-prototyp.html`
> (Artifact: https://claude.ai/code/artifact/22c7207f-a582-48bb-90c5-5d2aaa57a8bd).
> Detta är facit för implementations-uppgifterna 2–7.
> Status: v5 – godkänd riktning av användaren genom iteration (v1→v5); användaren har
> delegerat slutrapportering till leden.

## Husdjur = sprite-assets (STORT BESLUT i v5)

Husdjuren ritas INTE längre som genererad SVG. Varje djur (och varje evolutionsstadium)
är ett **set av 6 PNG-bilddelar** (pixelart) som riggas och animeras per del:

| Fil | Del | Rotationspunkt |
|---|---|---|
| `00-head.png` | huvud | nacke: 50 % / 80 % av bilden |
| `01-left-hand.png` | vänster hand (horisontell, tass utåt) | axel = inre (högra) änden: 96 % / 50 % |
| `02-torso.png` | kropp | 50 % / 92 % (andning kring basen) |
| `03-right-hand.png` | höger hand | axel = inre (vänstra) änden: 4 % / 50 % |
| `04-left-foot.png` | vänster fot (vertikal, tår nedåt) | höft = toppen: 50 % / 10 % |
| `05-right-foot.png` | höger fot | höft = toppen: 50 % / 10 % |

- **Rendering:** `image-rendering: pixelated` – aldrig mjuk uppskalning.
- **Montering** (procent av sprite-ytan, referensyta 340×360 px):
  huvud 51,5 % bredd vid (24,3 %, 1,5 %); kropp 45,3 % vid (27,4 %, 29,2 %);
  armar 44,4 % bredd från axlarna med viloläge ±52° (hänger ner-utåt);
  fötter 20,9 % vid (29 % resp. 50,1 %, 60 %).
- **Lagerordning** (bak→fram): armar → fötter → kropp → huvud. Namnskylt ovanpå.
- **Riktning:** spriten är ritad framvänd; vänster-/högergång speglas med `scaleX(-1)`
  på hela riggen (delarna sitter alltid rätt relativt varandra).
- **Uttryck:** bakas i huvud-asseten → ett extra huvud per uttryck kan bytas in som egen
  bild i samma rigg. Humör visas dessutom med partiklar (💤 sömnig, ❤️ mätt, 💫 yr,
  🍎 hungrig) och kroppsspråk (huvudet sjunker när sömnig osv.).
- **Evolution:** eget 6-delars set per stadium (3 stadier/art). Katten är första djuret
  och har än så länge bara steg 1 – steg 2/3 samt övriga arter ritas som nya set i samma
  filnamnskonvention. Assets checkas in under `design/assets/husdjur/<art>/`
  (i appen: `public/pets/<art>/<stadium>/00-head.png` osv.).

## Animation (riggad, per del)

| Vad | Värde |
|---|---|
| Gång | fötter ±14° i motfas (0,5 s/cykel); armar pendlar mot benen (±12° kring vilovinkeln); huvudet nickar ±1,6° + 2,5 % translateY; kroppen gungar ±1° och lyfter 2 % två ggr/cykel; fart ~7 %/s (mot mat ~11 %/s) |
| Vila | kroppen andas (scaleY 1,025, 3,4 s), huvudet tittar runt (±3°, 4,6 s), armarna svajar ±4° |
| Sömnig | huvudet sjunker 6–8° och guppar långsamt + 💤 |
| Äta | huvudet gnager (3 × 0,3 s, 9° dipp) + mums-puls, sedan tillväxt-pop 450 ms med overshoot |
| Ramla på rygg (klick) | hela riggen roterar 157° med studs (700 ms), **ben och armar sprattlar** (0,32 s / 0,4 s i motfas) medan den ligger (2,6 s), reser sig 550 ms; 💫 |
| Evolution | vit blink 3×250 ms → sprite-set byts → ✨🌟-burst ~900 ms, namnskylt får ⭐ |
| In/ut ur huset | 900 ms, `cubic-bezier(.55,0,.2,1)`, zoom mot husets fönster (origin 48,5 % / 52 %) |
| Moln | ute 46–75 s/varv (3 moln), i fönstret 34–52 s (2 moln); solstrålar roterar 70 s/varv; skorstensrök 4 s-puffar |
| Mat landar | studs 400 ms `cubic-bezier(.3,1.6,.5,1)` |
| Reduced motion | alla loop-animationer stängs av under `prefers-reduced-motion` |

## Evolution & matning (Pokémon-modellen)

- 3 stadier per art; **evolution efter 10 matningar**, räknaren nollas per stadium.
- Varje matning: +0.022 i skala. Stadiebas-skala **0.66 / 0.90 / 1.18**.
- **Mat köps i shoppen**: vara `apple` (Äpple), **5 mynt** → matförråd
  (`studentData.foodInventory`), placeras ut på golvet i rummet (golvzon y 62–90 %).
- Närmast lediga, icke-fullvuxna husdjur går själv till maten (seek-läge, 1,6× fart)
  och äter; fullvuxna (stadium 3 + 10 matningar) ignorerar mat.
- **Dagsgräns i produktion: 1 matning per husdjur och dag** (prototypen obegränsad för demo).
- Flera husdjur samtidigt, egna namn (max ~12 tecken), en ⭐ i namnskylten per uppnått stadium.
- Klick på husdjur → ramlar på rygg (ofarligt, bara kul).

## Scen, färger & layout

| Roll | Värde |
|---|---|
| Kontur (SVG-grafik) | `#3B3350`, stroke 3 (tunt 2.2) – oförändrat från `src/art-style.js` |
| Scen | viewBox 960×600, skalas till 100 % bredd (aspect-ratio 96/60) |
| Vägg/golv | vägglinje y=430 (72 %), panelband y=340–430; golv `#C9996B` med plankor `#B0805A` – **färgas aldrig om** |
| Fönster i rummet | 228×196 vid (96,76), spröjs i kors, moln bakom clip-path |
| Husets fönster (ute) | 150×130 vid (440,330), visar väggfärg + glimt av rummet; zoom-origin 48,5 %/52 % |
| Husdjur | bas-bredd 14 % av scenbredden, promenadzon x 10–78 %, fötter vid bottom 6 % |
| Himmel | gradient `#9AD3F0 → #E8F6FD`, sol `#F7C948` |

### Paletter (hus & väggar) – sparas som `room.paletteId`

| id | namn | house | roof | wall | wall2 |
|---|---|---|---|---|---|
| persika | Persika (default) | `#F49E4C` | `#EF6F6C` | `#FFE9CC` | `#FBD9A6` |
| mint | Mintgrön | `#58C6A9` | `#46557A` | `#D7F2E4` | `#AFE3CB` |
| himmel | Himmelsblå | `#7FC7E8` | `#46557A` | `#DDF0FB` | `#B7E0F5` |
| rosa | Rosa dröm | `#F890B7` | `#B79BE0` | `#FDE4EE` | `#F9C8DD` |
| sol | Solgul | `#F7C948` | `#F08A3C` | `#FDF0C8` | `#FAE29B` |

Inga fria färgval – bara paletter. Golv, möbler och husdjur påverkas inte.

## Möbler

- **Flyttbara med drag & drop**: position i procent, ankare mitt-bottenkant
  (`translate(-50%,-100%)`), sparas som `room.placements` (samma modell som idag).
  Z-lager: matta 1, möbler 2, husdjur 3, dragen möbel 6.
- **Stilmix-princip:** varje möbeltyp får minst 2–3 stilvarianter i shoppen — mysigt OCH
  coolt. Sängexempel: **Rymdsäng** (cool, default), **Racersäng** (cool), **Himmelsäng** (mysig).
- Möbelstil: tvåtonat trä (`#B0805A`/`#8A6242`/`#E0B98C`), textilier med sömmar,
  växter, ljusslinga, mjuk kontaktskugga (`#3B3350` op 0.09) under varje sak.
- Referensmöbler i prototypen: 3 sängar, Bokhylla, Pluggöhörna, Mysfåtölj, Solmatta, Krukväxt.
