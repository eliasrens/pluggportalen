# QA #592 – Guldrushen finputs E: finalskärmen

Demosidan `preview/preview-guldrush-demo.html?fas=final&antal=N` (ny parameter
`antal` + knapparna **Pall: 2/3/25 spelare**), 1920×1080 och 1280×720.
"före" = epicgrenen före #592 (cd889cd), "efter" = #592. Guldet slumpas per
körning, så pallens namn skiljer mellan bilderna.

| Test | Resultat |
| ---- | -------- |
| 12 – 2 spelare | ✅ Rubriken "🏆 Guldrushen – Prispall". Tvåpallen (2:an vänster, 1:an höger om den) står centrerad, ingen tom plats. Före: en tom plats till höger, pallen förskjuten åt vänster. |
| 12 – 3 spelare | ✅ 2:an vänster, 1:an mitten, 3:an höger, pallen centrerad (1920: steg 329–1591 px, mitt 960). |
| 12 – 25 spelare | ✅ Publiken i två jämna rader (13 + 12) med större figurer, 2,6vh luft under totalraden, slutar före gruvvagnen (1920: publiken 559–1361 px, vagnen från 1602 px). Före: en lång rad som gick in i vagnen. |
| Inga klassnamn | ✅ Även med två klasser (`klasser=2`): ingen synlig text "4B"/"5E" i finalen. Före: "Guldrushen 4B + 5E – skattjägarnas final!" och "Tillsammans samlade 4B + 5E … guld!". |
| Totalraden | ✅ Liten och lugn: "Tillsammans: **3 359 guld** 💰" (krämfärgad text, guldfärgad siffra, ingen ram). |
| Mynt-ikonen | ✅ `coinIcon()` framför "+N pluggmynt" (från #590), ingen trasig ikon. |
| Delad 1:a + en 3:a | ✅ Pallen placeras efter placering, inte ordning: 3:an står till höger om 1:an. |
| Finalen en gång | ✅ Oförändrat (designtest 10 i `test/live-guldrush-projektor.test.js`). |
| Sviter | ✅ enhet 1589/1589 · test:rules 400/400 · test:functions 42/42 · test:e2e 5/5 |

Bilder: `fore-{2,25}-*.jpg`, `fore-25-2klasser-1920x1080.jpg`,
`efter-{2,3,25}-{1920x1080,1280x720}.jpg`, `efter-25-2klasser-1920x1080.jpg`.
