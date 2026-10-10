# Guldrushen – elevvyn (#564): verifiering

Mot emulatorerna (functions + auth + firestore, `admin/qa-guldrush-preview.sh`) med
grenens Cloud Functions, avatarer med kläder (`admin/qa-snilleblixt-slut-seed.mjs`)
och styrskriptet `admin/qa-guldrush-elev.mjs` (start/stjal/offer/tvaa). Eleven b01
(Saga 4B, lilla123) i Chromebook-storlek 1366×657 och surfplatta 768×1024.

| Test | Resultat | Bild |
| --- | --- | --- |
| Sen anslutning (§6.9) | 0 guld, frågan direkt | emu-01 |
| 13 Rätt svar → kista | tre kistor, val (klick/1–3/pilar), servern avgör, guldet räknas upp; varmt 1,1–1,2 s från val till nästa fråga (server 50–80 ms) | emu-02 |
| 14 Fel svar | ❌ + rätt svar, ingen kista, nästa fråga direkt, fokus kvar; servern: 0 kistor på fel svar | emu-03 |
| Omladdning | oöppnad kista visas igen och går att öppna; väntande stöld öppnar offerväljaren | – |
| Offerväljare (stöld) | sorterad på guld, sköld/stöldskydd/för lite guld gråade, ~10 s → servern slumpar | emu-04, offer-30-chromebook |
| 17 Byte (UI) | bara de med mer guld; ingen valbar → serverns guldkista (+25) | emu-05, offer-byte-bara-mer-guld |
| Bestulen-notis | "🦝 Ali knyckte 25 guld från dig!" med avatar, pointer-events none, fokus kvar | emu-06, notis-bestulen |
| Flerval mult + quiz | 1–4, ✓/✗, quiz: servern rättar och väljer nästa fråga | emu-07, emu-08 |
| 20i Slutskärm | "🥈 Du kom 2:a!", 255 + 186 = 441 pluggmynt, saldo 100 → 541 (kvitto) | emu-11 |
| Designtest 6 | tio kisttyper, eget utseende + ljud (unika look/sound, test), 1,1–1,25 s inkl. 150 ms server | kista-01…10 |
| Reducerad rörelse | toningar på plats, ingen förflyttning | reducerad-rorelse-dubbla |

Sviter: node 1514/1514, `test:rules` 399/399, `test:functions` 34/34.
Emoji visas som rutor i den headless-webbläsaren (saknar emoji-typsnitt) – inte i appen.
