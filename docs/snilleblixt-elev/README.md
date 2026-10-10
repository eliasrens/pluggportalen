# Snilleblixten – elevens skärm (#558): QA i webbläsare mot emulatorn

Preview: `admin/qa-snilleblixt-preview.sh` + `admin/qa-snilleblixt-elev-sim.mjs`
(låtsaselever, `utoka`, `autoplay`). Lärarens steg kördes i appen
(snilleblixt-data.js: open/close/reveal, live-feed skriver result + pluggmynt).
Chromebook = 1366×768, surfplatta = 820×1180.

| Test | Utfall | Bild |
| --- | --- | --- |
| 4 (elevdel) – 24 anslutna, alla får fråga 1 samtidigt | ✅ | 02 |
| 6 – fel svar: 0 poäng, ❌ först vid avslöjandet (flerval + skriv själv) | ✅ | 03, 05, 09, 10 |
| 7 – två snabba klick (2 → 1 → tangent 4) / ENTER två gånger | ✅ bara första svaret i sbAnswers | 03, 09 |
| 11 – omladdning efter svar: "Svar inskickat", nytt klick ignoreras | ✅ | 04 |
| Sen anslutning (§5.7) – in från nästa fråga | ✅ "Du är med! … nästa fråga", sedan rätt svar utan omdöme | 12 |
| "Visa frågan på elevskärm" av – bara knapparna | ✅ | 14 |
| 20i – 2:a, 42 rätt, 5/rätt, förstapris 300 → 255 + 186 = 441, saldot +441 | ✅ 492 → 933 | 15, 16 |

Emoji (✅ ❌ 🥈 🪙) visas som rutor i den headless-webbläsaren (saknar emoji-
typsnitt – menyns ikoner likaså); i vanliga webbläsare syns de.
