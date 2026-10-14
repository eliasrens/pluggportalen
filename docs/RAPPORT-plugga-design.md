# Slutrapport – Plugga-design (#701–#704)

Underlag för PR-kommentaren enligt spec "PR-ORDNING OCH RAPPORT"
(`UTVECKLINGSUPPDRAG_PLUGGA_DESIGN.md`). Skärmdumpar läggs i PR:en.

## Vad som har byggts

1. **Sidomenyn (#701):** profilrad med avatar, namn och "Min profil ›";
   stjärnor och mynt (tusental med mellanslag) under namnet; menyn i grupper
   (`"mitt"` utan rubrik, `"ova"` med rubriken ÖVA); Live som rosa ruta högst
   upp i stället för länk; diskret "Logga ut".
2. **Plugga-startsidan (#702):** rubrik direkt på bakgrunden, "Dina områden",
   kompakta kort i ämnets färg (`subjectColor`), framstegsrad "★ X av Y"
   (`areaStarCount`, samma siffror som "Ditt framsteg") och "Ny!"-märke.
3. **Områdessidan (#703):** rubrikrad med "← Plugga", emoji, titel och
   stjärnpiller; sektionerna "Öva" och "Äventyr" med kompakta kort;
   "Fortsätt här"; buggen där namn och beskrivning hamnade på samma rad är
   rättad i alla kort.
4. **Bilderna på äventyrskorten (#704):** `oversikt.scen()` för Skattjakten,
   Spökjakten och Gruvan (i temafilerna, lazy med temaregistret). Reservläget
   (färgyta + emoji) finns kvar för teman utan bild.
   Förhandsvisning: `preview/preview-aventyr-kort.html`. Dokumentation:
   `docs/DESIGNSYSTEM.md` §4 och `design/DESIGNBESLUT-meny-sidebar.md` §5.

## Fältet för "Ny!"

`isAreaNew` (`src/plugga-framsteg.js`): det nyaste av områdets
`createdAt` och klassens `assignedAreas[].assignedAt`. Märket visas om den
tidsstämpeln är mindre än 7 dagar gammal **och** eleven inte har någon
progress alls i området. Saknas båda tidsstämplarna visas inget märke.

## Hur "Fortsätt här" väljs

`continueHereMode` (`src/plugga-framsteg.js`): bland korten som visas på
sidan (övningar och äventyr, `aventyr:<id>`) väljs det med senast
`progress[areaId][mode].lastPlayed`. Har det läget redan 3 stjärnor, eller är
kortet låst, blir det ingen markering alls (vi hoppar inte vidare till näst
senaste). Aldrig spelat → ingen markering.

## Scroll på 1366 × 768

Inget behöver scrollas. På områdessidan (Vikingatiden, 6 övningar + 3
äventyr) slutar äventyrsraden på 697 px i alla datorstorlekar
(1920×1080, 1440×900, 1366×768, 1280×720), alltså även på 1280×720.

## Avvikelse från facit

Äventyrsbilden är 78 px hög i tre kolumner som i facit, men växer med
kortets bredd (`clamp(78px, 25cqi, 120px)`) på surfplatta och mobil. Annars
skulle bilden zoomas in och kapas när kortet blir brett (krav: snygg
beskärning i alla kortbredder). Se `docs/DESIGNSYSTEM.md` §4.6.
