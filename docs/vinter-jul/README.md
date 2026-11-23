# Vinter och Jul – bilder och mätningar

`forslag/` är Elias godkända riktning, förhandsvisningen "Vinter i byn – färgtest"
(`mjuk.jpg` och `port-vinter.jpg`). `b-vinter/` är Del B (#908) i den riktiga appen.

## Del B (#908): vintern i världen, på porten och i lärarspärren

Skärmdumparna kommer från `preview/preview-vinter-908-app.html`. Det är den riktiga
appen (`src/app.js`) med Firebase utbytt mot en Firestore i minnet, så ingen emulator
behövs. `config/season` styrs med `?sasong=vinter|host|sommar|halloween|jul|bort`.
`?ut` ger utloggat läge (porten och lärarspärren) och `?elever=N` sätter antalet hus.
Matrisen och fönstret kommer från `preview/preview-vinter-908.html?vy=matris|fonster`.

| Vy | Bild |
| --- | --- |
| Byn (20 hus) | `b-vinter/by.png` |
| Byn (5 hus, mest mark) | `b-vinter/by-5hus.png` |
| Huset ute | `b-vinter/hus.png` |
| Gården | `b-vinter/gard.png` |
| Rummet och fönstret | `b-vinter/rum.png`, `b-vinter/fonster.png` |
| Porten | `b-vinter/port.png` |
| Lärarspärren | `b-vinter/gate.png` |
| Snö på alla husskal (QA 24) | `b-vinter/hus-matris.png` (sommar: `hus-matris-sommar.png`) |

### QA 19 – bländtestet (1366×768, hela skärmen inklusive sidomenyn)

Kommandot är `node admin/qa-vinter-blandtest.mjs docs/vinter-jul/b-vinter/{by,by-1hus,by-5hus,hus,gard,port,gate}.png`.

| Vy | Medelluminans (≤ 215) | Pixlar ≥ 245 (≤ 5 %) | |
| --- | --- | --- | --- |
| by | 208.7 | 2.36 % | OK |
| by-1hus | 212.3 | 0.90 % | OK |
| by-5hus | 210.3 | 1.23 % | OK |
| hus | 204.5 | 1.23 % | OK |
| gard | 203.4 | 1.67 % | OK |
| port | 183.4 | 3.31 % | OK |
| gate | 50.2 | 0.00 % | OK |

Luminansen räknas med Rec. 709 (0,2126 R + 0,7152 G + 0,0722 B).

Paletten fick en justering. Med `hill: #D3E1EE` från B.1 landade byn på 215,9 på hela
skärmen, eftersom den ljusa sidomenyn är med. Utan sidomenyn var värdet 211,4. En liten
by med mycket mark låg ännu högre: med `#CAD8E8` hamnade en by med 1 hus på 215,5
(testarens F3). Därför är `hill` nu `#C4D3E4`, och byar med 1–5 hus ligger på
210,3–212,3.

### QA 20 – sommar och höst är oförändrade

Pixeldiffen mot epic-grenen (`ce94ba36`) gav 0 px i alla 24 jämförelser:
by, hus, gård, rum, port och lärarspärr i sommar, höst, höst + Halloween och utan
`config/season`. Animationerna var frysta.

### Val där uppdraget inte räckte till

- **Snö på taken.** Husen har 43 olika takformer, så snön görs generiskt med `snoTak`
  i `art-style.js`. Ett SVG-filter tar fram allt i husets silhuett som vänder uppåt,
  rundar av det, ger det droppande underkant och mörk kontur. Det fungerar för alla
  husskal, laggårdarna, porten och framtida hus (julhusen i D) utan att något ritas för
  hand.
- **Filtret körs inte i scenen.** Ett levande filter kördes om varje bildruta så fort
  något i samma SVG rörde sig, och byn föll till cirka 14 fps. Som SVG-bild rastrerades
  det om vid varje kamerazoom, vilket gav en frysning på cirka 1 s. Nu körs filtret en
  gång per husskal till en beskuren PNG (blob-URL) som ritas som `<image>`. Byn
  ligger då på 60 fps i vila och har samma zoom-tider som sommaren.
- **Snöbitmappens upplösning** följer `devicePixelRatio` (högst 2): 1,25 px per
  konstenhet gånger DPR, med ett tak på 4 Mpx per bild. Filtret rastreras på
  huvudtråden, och utan tak frös porten i cirka 21 s vid DPR 2 i headless (mot
  0,9 s förut); med taket blir det cirka 3 s där. Snökanten har också en brantare
  tröskel, så den är skarp i stället för mjuk.
- **Vimpelstängerna och krönkloten** på porten är inte med i snökopian. De fick
  annars snöklumpar.
- **"← Tillbaka" i lärarspärren** är `#B4C1CF` på vintern (5,6:1 mot `#2E4066`).
  Lärarsidans `--t-muted` gav bara 4,0:1 mot den ljusare blå bakgrunden.
- **Vintersolen** på porten och huset ute är samma sol, men med opacitet 0,8, lite lägre
  och utan strålar.
- **Granarna i byn** följer `--sz-gran` och blir mörkgröna på vintern. Det gäller också
  stigen (`--sz-stig` och `--sz-stig-kant`).
- **Snögubben** står i byn vid Klasscentrets högerkant, alltså vid lägerelden. Utan
  klass står han på första fria plats. Han tar ingen plats från övrig dekor.
- **Köpta trädgårdssaker.** Blomrabatter som eleven har köpt döljs inte, eftersom de är
  elevens egna saker. Bara byns och gårdens egna tuvor och rabatter göms.
