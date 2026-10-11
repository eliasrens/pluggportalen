# QA #593 – Guldrushens bakgrundsmusik

Kört 2026-10-11 i headless Chrome mot `preview/preview-guldrush-demo.html`
(`PORT=8593 node server.mjs`), Web Audio instrumenterat (AudioContext,
källor, gainer, AnalyserNode efter fade-gainen).

| Test | Resultat |
| --- | --- |
| Skarven 1:24 | Avkodad fil: 84,21 s, 48 kHz, stereo. Hopp sista→första sampel 0,004 / 0,015 (v/h) – mindre än ett normalt steg mellan två sampel (medel 0,012 / 0,014). Ingen tystnad i början/slutet (RMS 50 ms: 0,26 / 0,09). Källan: `loop = true`, `loopStart 0`, `loopEnd 0` (hela bufferten) → sampelexakt, inget hack. |
| Lobby | Filen hämtas i lobbyn (1,7 MB), kontexten väntar på gest, ingen källa – **tyst** (valt: läraren pratar, och ljud får ändå inte starta före STARTA). |
| 15 Start | STARTA (gest) → 3-2-1-KÖR! tyst → fade 0 → 0,30 på 1,5 s när fasen blir live. RMS efter fade ≈ 0,04–0,06. EN AudioContext (delad med effekterna). |
| 16 Musik av | Fade → 0, `pp:live:musik = av`, effekterna spelar fortfarande. |
| 17 Elevskärm | Elevskärmen spelar (1 källa, fade 0,3), panelen har 0 källor. 🎵-knappen och raden dolda i fönstret. Musik av i panelen → elevskärmen fade 0. |
| 18 Elevdator | Elevvyerna når aldrig proj-music.js/projector.js (test/live-music.test.js). |
| 19 Fanfar | Gemensam skatt → duck 1 → 0,35 på 80 ms, hålls under fanfaren, tillbaka till 1 på 0,9 s. |
| 19b Effekter av | Gemensam skatt firas, ingen duck-ramp, fade kvar på 0,30, kontexten igång. |
| 20 00:00 | Uttoningen startar exakt när klockan visar 00:00; 1,0 s (klar före trumvirveln 1,1 s in i finalen). Källan stoppas efteråt. |
| 21 Omladdning | Musik av överlever omladdning; knappen göms i helskärm (`.lp-fs`). |

Volym: musiken går via effekternas huvudvolym (0,5) × 0,3. Filens RMS 0,16 →
≈ 0,024 i utgången, mot ≈ 0,06 för fanfarens toner – bakgrundsnivå.

`panel-musikknapp-1920.jpeg`: lärarens rad med 🎵 Musik på bredvid ljudknappen.
