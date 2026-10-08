# Live: elevskärm / utvidgad skärm (#533) – testlogg

Mot emulatorn (`bash admin/qa-live-elevskarm-preview.sh`, inloggad som lärare elias), headless Chrome, 2 flikar:

| Steg | Resultat |
|---|---|
| Projektorvyn utan elevskärm | som förut + "Ingen elevskärm" / "📺 Öppna elevskärm" |
| Öppna elevskärm | nytt fönster `#/larare/live?id=<sid>&skarm=elev`, lobby UTAN STARTA/nämnare/avbryt, startkort "klicka här – helskärm + ljud" |
| Klick på elevskärmen | helskärm, ljud upplåst; panelen: "Elevskärm ansluten ✓" (innan: "– klicka en gång på elevskärmen för ljud") |
| STARTA i panelen | 3-2-1-KÖR! + timer på elevskärmen |
| Vybyte ×3 (Statistik, Dragkamp, Raketrace) | elevskärmen följde på 31 / 19 / 20 ms |
| 00:00 | vinnarskärm på elevskärmen, enda knappen = diskret ⛶ |
| Omladdad panel | hittar den öppna elevskärmen direkt |
| Omladdad elevskärm | återansluter, får panelens vy (Dragkamp) fast localStorage sa Raketrace |
| Stäng elevskärm (efter panel-omladdning) | fönstret stängs via kanalen, panelen: "Ingen elevskärm" |
| Bootgraf (qa-bootgraf-bfs) | identisk, 110 filer – allt nytt laddas dynamiskt |

Ljud: panelen tystnar bara när elevskärmen är ansluten OCH har upplåst ljud – annars spelar panelen som förut (aldrig dubbelt).

Skärmdumpar: `panel-dragkamp.png` (kontrollpanel) vs `skarm-dragkamp.png` (elevskärm), `skarm-start.png`, `skarm-vinnare.png`.
