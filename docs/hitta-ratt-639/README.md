# #639 – färre klickringar (Hitta rätt!)

Regel: `src/hitta-ratt/karta/ringregel.js`. Geodatan har `liten` bara för
områden vars största del är under 12 000 km². Ringen syns när den delen är
under 12 px på skärmen. Mätt med `preview/preview-hitta-ratt-ringar.html`,
som har den riktiga motorn och geodatan och spelvyns kartmått.

## Ringar i helvy (områdesläge)

| Pack | 1800×1000 | 1366×768 | 1024×768 | 900×800 |
|---|---|---|---|---|
| Världen före | 71 | 84 | 85 | 95 |
| Världen efter | 12 | 12 | 12 | 12 |
| Europa före | 7 | 11 | 11 | 10 |
| Europa efter | 8 | 9 | 9 | 9 |
| Sverige landskap före → efter | 0 → 0 | 0 → 1 (Öland) | 0 → 1 | 0 → 1 |
| Sverige län före → efter | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |

- Världen efter: BHS, BRN, CYP, FJI, GMB, JAM, KOS, LBN, PSX, QAT, SLB, VUT.
- Europa efter: AND, CYP, KOS, LIE, LUX, MCO, MLT, SMR, VAT (KOS faller
  bort vid 1800, CYP får ring där). Nordmakedonien och Montenegro har inte längre ring.

## Klick (riktiga CDP-händelser, `admin/qa-hitta-ratt-ringar.mjs`)

- Mus 1366: Europa MLT, LUX, AND, VAT via ring; BEL och NLD via ytan; MLT
  och LUX efter zoom 1,9× och 5–7×. Världen JAM, QAT, BHS, VUT, PSX, LBN
  och CYP via ring; BEL, NLD och RWA via ytan. Allt OK.
- Touch 1024×768: Europa MLT, LUX, VAT och SMR via ring, BEL och NLD via
  ytan. Världen JAM, PSX, LBN, BHS och FJI via ring, NLD och RWA via ytan.
  Allt OK.
- Singapore och Bahrain finns inte på världskartan. Byggskriptet gör länder
  under 5 000 km² till bakgrund (`VARLD_MIN_KM2`), så de kan inte testas.
- Israel har ingen ring. I världens helvy täcks landet nästan helt av
  Palestinas och Libanons ringar, så det går att välja först från ungefär
  3× zoom. Före ändringen hade Israel en egen ring.
- I emulerad touch blir två snabba tryck på grannländer (NLD sedan BEL i
  världen vid 1,9×) ibland fel land. Det kommer från touch-justeringen och
  inte från ringarna.

## Bilder

`fore-*.png` och `efter-*.png` visar världen och Europa vid 1366×768.
`efter-europa-1366-vald-ratt-fel.png` visar MLT som vald (streckad), LUX
som rätt (heldragen) och AND som fel (prickad). Klasserna för rätt och fel
sattes för hand i bilden.
