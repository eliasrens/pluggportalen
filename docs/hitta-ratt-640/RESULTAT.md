# #640 – träffregeln för klickringar: före/efter

Regel (`src/hitta-ratt/karta/traff.js`): en ring tar klick över hav/bakgrund med hela sin
radie (12 px), alltid på sitt eget område, men över ett **annat** område bara inom
`0,4 × det områdets smalaste mått på skärmen` (högst 12 px). Stora grannländer (Frankrike,
Italien, Saudiarabien) ger alltså hela ringen; små (Israel, 3,8 px brett i helvy) nästan
ingen. Ringen kan därmed aldrig täcka mer än 80 % av grannens bredd. Överlappande ringar:
närmaste mitt vinner.

Mätt med `admin/qa-hitta-ratt-traff.mjs` (riktiga CDP-klick) mot
`preview/preview-hitta-ratt-ringar.html`, fönster 1366 × 900 (karta 1200 × 570).
`:yta` = rutnät över landets inre yta, `:ring` = ringens skiva r ≤ 11 px (88 punkter),
`:karna` = r ≤ 6 px (113 punkter).

| Prov | Före | Efter |
| --- | --- | --- |
| ISR yta helvy (mus) | 0/29 | **28/29** |
| ISR yta helvy (touch) | 0/29 | **28/29** |
| ISR yta 2,16× | 5/43 | **43/43** |
| ISR yta 4,22× | 52/67 | **65/67** |
| PSX / LBN / CYP mittklick (mus + touch) | OK | OK |
| PSX kärna r ≤ 6 | 102/113 | 75/113 (resten Israels och Jordaniens yta) |
| LBN kärna | 95/113 | 96/113 |
| CYP kärna | 106/113 | 106/113 |
| QAT / JAM / BHS kärna | 113/113 ×3 | 112 / 113 / 113 |
| QAT / JAM / BHS hela ringen | 88/88 ×3 | 82 / 82 / 86 (kanten över Förenade Arabemiraten, Kuba, Haiti) |
| MLT LUX AND VAT SMR MCO LIE hela ringen | 88/88 alla | 88/88 alla |
| LUX LIE AND MCO kärna | ej mätt | 113/113 alla (VAT, LUX även touch) |
| Europa mittklick touch, alla 7 | ej mätt | OK |
| Öland ring / kärna / yta | 88/88 / ej mätt / 21/21 | 88/88 / 113/113 / 21/21 |

Skärmdumpar: `hr640-1-israel-helvy-vald.png`, `hr640-2-israel-4x-vald.png`.
