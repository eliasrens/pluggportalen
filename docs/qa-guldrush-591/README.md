# QA #591 – Guldrushen finputs D: projektorvyn under spelet

Demosidan `preview/preview-guldrush-demo.html?fas=kammare` (ny knapp **🎉 Gemensam skatt**)
i 1920×1080 och 1280×720. "före" = epicgrenen före #591 (542442d), "efter" = #591.

| Test | Resultat |
| ---- | -------- |
| 9 – gemensam skatt | ✅ Ingen notis över timern. Guldrutan pulserar, mätaren fylls till 100 %, kort konfetti runt rutan och ljudet `fanfarKort`. Sedan börjar mätaren om mot nästa skatt. "Nästa skatt: 3 000" står kvar som liten text. Före: notisen nådde timerns underkant (1280: notisens överkant 154,6 px, timerns underkant 154,9 px) och gled in över timern. |
| 10 – 20 händelser snabbt | ✅ 20 kistor med 60 ms mellanrum + ledningsbyte, mätt var 100:e ms i 5 s: högst 4 rader och varje rad en textrad (höjden = en rad). Banderollen syntes i 45 av 50 prov, aldrig ovanför den översta raden (luften klipper den). |
| 11 – "✖️2"-kista | ✅ Bricka-SVG (`gr-ikoner.js` x2Icon) i flödet, elevens kistkort och demots knappar. Före: tecknet "✖2" som text. |
| 13 – topplistan | ✅ Oförändrad: samma 10 platser, skyltar och figurstorlek (118 px i 1920). Högarna ligger 5 px lägre i 1920, eftersom guldrutan med mätaren gör den översta raden lite högre. |
| Dekor | ✅ Kristaller, facklor och ådror ligger i fria ytor. Dekor-vakten gömmer det som ändå hamnar bakom text, namn eller avatarer: 0 av 13 bitar dolda i båda upplösningarna. Rälsen ligger under skyltarna. |
| Sviter | ✅ enhet 1588/1588 · test:rules 400/400 · test:functions 42/42 · test:e2e 5/5 |

| Fil | Vad |
| --- | --- |
| `fore-1920-spel.jpg` | före: radbrutna rader, kristall bakom avatar/flöde |
| `fore-1920-skatt.jpg`, `fore-1280-skatt.jpg` | före: skattnotisen, "✖2", radbrytning |
| `efter-1920-fore-skatt.jpg`, `efter-1280-fore-skatt.jpg` | efter: före en skatt, mätaren, ✖️2-ikonen |
| `efter-1920-under-skatt.jpg`, `efter-1280-under-skatt.jpg` | efter: firandet i guldrutan |
| `efter-1920-storm.jpg`, `efter-1280-storm.jpg` | efter: händelsestorm + banderoll i luften |

Skärmdumparna under firandet togs med sidans timers 8× långsammare och
animationerna pausade, eftersom firandet bara tar ~2 s.
