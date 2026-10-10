# Trollkarlsduellen del D (#539) – arbetslogg

Attack 9–15 (§8) + två extraattacker (§8 kreativ frihet) + kompletterade
småhändelser (§10) och matchreaktioner. Screenshots tagna i demoläget
(`preview/preview-trollkarlsduellen.html`), frysta mitt i attacken.

| Fil | Attack |
|---|---|
| 09-snurrus-yrus.jpeg | SNURRUS YRUS! – offret snurrar, stjärnor kring huvudet |
| 10-hattus-gigantus.jpeg | HATTUS GIGANTUS! – jättehatten har slukat offret |
| 11-bubblus-flygus.jpeg | BUBBLUS FLYGUS! – offret svävar i såpbubblan |
| 12-blixtus-hoppus.jpeg | BLIXTUS HOPPUS! – blixt + helskärmsblink |
| 13-nysus-megus.jpeg | NYSUS MEGUS! – rosa nysmoln på väg mot näsan |
| 14-drakus-minius.jpeg | DRAKUS MINIUS! – minidraken cirklar offret |
| 15-studsus-maximus.jpeg | STUDSUS MAXIMUS! – offret högt i luften över plattan |
| 16-farus-rammus.jpeg | FÅRUS RAMMUS! (extra) – fåret galopperar mot offret |
| 17-dansus-discus.jpeg | DANSUS DISCUS! (extra) – discoljus + dansförbannelse |

## Verifierat i webbläsare (headless Chrome)

- Alla 17 attacker listas i demolägets väljare.
- Varje ny attack körd i BÅDA riktningar (vänster→höger och höger→vänster);
  efteråt: 0 kvarvarande effektlager, båda slots `data-state="IDLE"`,
  figurens rot-svg `transform: none`, overlay dold.
- Burst: 5 nya attacker köade på en gång – alla spelades i ordning och städades.
- Alla 12 idle-småhändelser (8 gamla + 4 nya) körda direkt utan fel.
- Matchreaktioner: ledningsbyte → jubelpos; sista minuten → båda huvuden
  får klock-glänt-animation (verifierat via `getAnimations()`).
- Konsolen ren (enda 404 = favicon i demoservern).

## Tester

`node --test test/trollkarl-*.test.js` → 46/46 gröna (registret ≥ 15 unika id,
namn/varaktighet/ljudnycklar/run per attack, aldrig samma attack två gånger i
rad, bootgrafs-vakt). Firestore-regeltester kräver emulator (opåverkade).
