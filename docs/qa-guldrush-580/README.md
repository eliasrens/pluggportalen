# #580 – QA-fynd F1 och F2 från #567

## F1: omförsök i payLiveRewards

`src/live/live-rewards-pay.js` använder `medKrockOmforsok` från `kc-omforsok.js` (#493).
En utbetalning som nekas av en krock körs om med backoff och jitter, högst
`KROCK_FORSOK` = 8 gånger. Om nästa försök läser samma läge (inget kvitto och samma
saldo) är nekandet verkligt, och omförsöken slutar. Kvittot är oförändrat
create-only, så "redan" gäller fortfarande.

Emulatorn (`admin/qa-guldrush-utbetalning-krock.mjs`): två avslutade matcher med samma
42 elever (4B + 5E). elias betalar match A och rasmus match B, samtidigt. Sedan kommer
en "omladdning" där båda kör båda matcherna igen.

| Läge | Varv | Resultat |
| --- | --- | --- |
| `kontroll` (forsok = 1, som före #580) | 3 | 22, 11 och 26 av 84 utbetalningar **nekade** (F1 återskapat). Saldot stämde ändå mot kvittona |
| `omforsok` (appens standard) | 5 | **84/84 betalda varje varv** trots 5–18 krockar per varv. 42 + 42 kvitton, saldot = exakt summan, omladdningen gav bara "redan" |

`qa-guldrush-slut-pris.mjs pris` följt av två samtidiga `qa-guldrush-larare.mjs`
(elias + rasmus) och sedan `prisKolla` (utan omladdning och utan historikvyn):
**14/14 gröna**, 20g inräknat. rasmus betalade 31 kvitton, och inga "Pluggmynt nekades".

Enhetstest: `test/live-rewards-pay.test.js` (falsk Firestore som räknar regeln mot det
senast sparade saldot).

## F2: kistorna följer behållaren

`guldrush-kistor.css`: `.grk` är en container (`container-type: inline-size`).
Kistan har `min(26cqi, 37vh)` och mellanrummet `4cqi`, alltså 86 % av panelens bredd.
vw-raderna finns kvar som reserv. Riktiga appen (elev b01, emulatorn) gav
`getBoundingClientRect` mot alla förfäder med overflow: **ingen kista och ingen siffra
klipps** i någon storlek.

| Fil | Storlek |
| --- | --- |
| [k01](k01-kistor-chromebook-1366x768.png) | Chromebook 1366×768 (var klippt i #564 emu-02) |
| [k02](k02-kistor-surfplatta-1024x768.png) | Surfplatta 1024×768 |
| [k03](k03-kistor-surfplatta-768x1024.png) | Surfplatta 768×1024 |
| [k04](k04-kistor-1920x1080.png) | 1920×1080 (gamla 270 px × 3 + 64 px × 2 = 938 px rymdes inte heller här, eftersom panelen är 796 px) |

Den blå ramen i k02/k03 är appens fokusring på kista 2 (tangentbord). Den klipps inte heller.
