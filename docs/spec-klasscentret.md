# Klasscentret (Citycenter / Class hall) — spec + beslut (Elias 2026-10-07)

En ny, integrerad modul i Pluggporten: en gemensam byggnad i varje klassby som hela klassen hjälps åt att uppgradera och inreda. Syfte: vi-känsla, samarbete, gemensam drivkraft — individuellt plugg OCH gemensamma utmaningar bidrar till klassens mål.

Pluggporten används av många klasser → byggs modulärt och dynamiskt, fungerar oavsett klasstorlek, inga hårdkodade placeringar mot elevnamn. Hela strukturen ska kunna återanvändas av 100 klasser oberoende av varandra.

## Analysera FÖRST (innan implementation)
- Hur klassbyns layout genereras (grid-systemet / slingan).
- Hur "Mitt rum" laddar, sparar och hanterar möblers X/Y-koordinater (drag-and-drop).
- Elevens ekonomi (mynt) och hur köp genomförs i shoppen.
- Återanvänd "Mitt rum"-logiken för inredning men peka sparningen mot ett gemensamt klassobjekt i stället för eleven.
- Befintlig art-pipeline: kodritad SVG i `src/art-*.js` (t.ex. art-hus-lyx.js, art-hus-legendary.js) + `preview-*.html`. Klasscentrets grafik görs på samma sätt (art-klasscenter-*.js), i samma stil.
- PixiJS-världsrenderaren (#396) finns opt-in (`?pixi=pa`) – Klasscentret ska fungera i standardvägen och inte bryta Pixi-vägen.

## 1. Placering & karta
- Klasscentret är byns hjärta: alltid på den mest framträdande platsen, centralt i början av byns slinga.
- Tar större yta, t.ex. `grid-column: span 2` eller `span 3`.
- Elevhusen fyller dynamiskt platserna efter centret; tar raden slut slingrar vägen ner till nästa rad som byns logik redan gör. Inga elever får försvinna – de skjuts bara fram i rutnätet.

## 2. Gemensam EXP & progression
- Klass-EXP-pool (`classTotalExp`), räknad i "avklarade övningar".
- **BESLUT: Normaliseras per elev** (som Klasskampen): nivåtrösklar räknas mot klassens EXP / antal elever (eller trösklar skalade med elevantalet), så en klass med 14 elever inte är dömd att gå långsammare än en med 28.
- **BESLUT: Inget dagstak.** I stället ett **EXP-regelregister per modul** – varje modul registrerar när något räknas som "en avklarad övning"; nya moduler lägger bara till sin regel:
  - Quiz + Läsförståelse: ger EXP varje gång (krav: minst 50 % rätt på omgången, så gissningsspam inte lönar sig).
  - Para ihop / Memory / liknande: EXP bara de första 3 gångerna per område och elev.
  - Läsresan: en text räknas vid ≥ 5/7 rätt.
  - Mattematchen: var 20:e rätt svar = 1 avklarad.
  - Räkna-läget (generatorn): t.ex. 10 rätt = 1 avklarad.
  - Live / klassutmaningar (lärarledda): större klassbonus.
  - Individuellt plugg ger poäng BÅDE till elevens egna framsteg (oförändrat) och till Klass-EXP.
- Diskret men tydlig mätare över byggnaden i byvyn: t.ex. "50 / 200 övningar till Nivå 2".
- Säkerhet: klienten får inte kunna skriva godtycklig Klass-EXP – öka bara via verifierade/regelkontrollerade skrivningar (Firestore-regler, jfr Mattematchen #456: +1 i samma batch som verifierat resultat), shardade räknare om många skriver samtidigt.

## 3. Uppgraderingstrappan (10 nivåer)
Jämn takt, byggnadens utseende byts automatiskt, trösklar ökar exponentiellt så det räcker hela läsåret.
1 Lägereld med stockar · 2 Tält av grenar och tyg · 3 Liten enkel träkoja · 4 Stabil timmerstuga med rykande skorsten · 5 Byhus i sten med tegelpannor + liten anslagstavla · 6 Rådhus med pelare och klocktorn · 7 Mindre borg med stenmurar och klassens fana · 8 Ståtligt slott med tinnar och torn · 9 Modernt skinande högkvarter i glas och stål · 10 Episkt futuristiskt kristallpalats.

## 4. Shoppen & crowdfunding
- Ny kategori "Klasscentrum" i befintliga shoppen.
- Priser i nivå med husuppgraderingar: ca 2 000 – 10 000 mynt (exklusiva statyer, pampiga fontäner, gigantiska kristallkronor …). (Jfr: säng 120, dator 200, husuppgraderingar upp mot 12 000.)
- Crowdfunding: föremål (t.ex. Guldstaty 5 000) har progress bar + "Donera"-knapp; eleven väljer belopp (t.ex. 50), mynten dras från eleven, mätaren uppdateras för alla i klassen i realtid ("150 / 5000 mynt insamlade").
- Vid 100 % → "Köpt", inga fler donationer, landar i **Klassens gemensamma möbellåda**. Överskjutande donation får inte gå förlorad (cappa beloppet / ge tillbaka resten).
- **BESLUT: Donationer visas anonymt** – bara totalsumman syns för klassen (ingen donatorlista/topplista), så elever med få mynt inte känner press. (Läraren får gärna kunna se vem som donerat.)
- Atomärt: myntavdrag + ökning av insamlat i samma transaktion/batch, regler förhindrar fusk (dra mer än man har, donera till annan klass, öka utan avdrag).

## 5. Insidan: gemensamt inredningsläge (City Hall)
- Klick på Klasscentret i byn öppnar rummet. Samma drag-and-drop som "Mitt rum", med möbler från klassens gemensamma möbellåda.
- "Spara" sparar koordinaterna till klassens gemensamma layout.
- **BESLUT: Alla i klassen får inreda som standard. Läraren kan bocka ur enskilda elever** (lärarsidan, under klassen) – de kan fortfarande titta, donera och hovra men inte flytta/spara.
- **BESLUT: Historik + "Återställ"**: tidigare layouter sparas (t.ex. de senaste ~10) så läraren (och gärna klassen) kan återställa om någon förstört.

## 6. Pokaler & statistik
- Pokaler delas ut AUTOMATISKT när klassen vinner utmaningar (t.ex. vinnare i Mattematchen – Klasskampen när perioden avslutas, vinst i en Live-match, "Liveläge avklarat") och placeras i rummet.
- Hover-tooltip: snygg informationsruta, t.ex. "Vinnare av Mattematchen! Klassen kämpade stenhårt tillsammans."
- Statistiktavla: fast, klickbar möbel i rummet som visar klassens totala EXP, totalt antal lösta uppgifter tillsammans, progress till nästa byggnadsnivå.

## 7. Besöka andra klasser (gästläge / view-only)
- Elever kan gå in i andra klassers byar och in i deras Klasscenter för att se inredning och pokaler.
- Behörighet: om inloggad elevs klassId !== centrets klassId → gäst: inredningsverktyget renderas inte, drag-and-drop av, inga köp/donationer; kan se sig omkring, hovra pokaler, titta på tavlan. Hemmaklass: allt upplåst (utom elever som läraren bockat ur för inredning).
- Säkras i Firestore-reglerna, inte bara i UI:t.

## 8. Datamodell (förslag – anpassa efter befintlig struktur)
- ClassProfile: classId, classTotalExp, currentCenterLevel (1–10), trophies[].
- ClassCenterShopItems: itemId, targetPrice, currentFundedAmount, isUnlocked.
- ClassCenterLayout: classId, placedItems[] (id, itemName, x, y, z-index) + historik.

## 9. Acceptanstester
1. Placering: Klasscentret ligger först i slingan och tar extra plats; övriga elevhus flyttas korrekt utan att elevdata försvinner.
2. EXP-uppgradering: ge klassen poäng nog för Nivå 2 → bilden byts, mätaren räknar mot nästa nivå.
3. Crowdfunding: Elev A donerar 100 till staty för 5000 → "100 / 5000"; Elev B ser också "100 / 5000".
4. Upplåsning: mätaren når 100 % → prylen tar inga fler donationer och landar direkt i klassens möbellåda.
5. Gästläge: elev besöker annan klass by → kan gå in i deras Klasscenter, läsa pokaler via hover, men INTE se inredningsknappar eller flytta möbler.
Plus (beslut): per-elev-normalisering, EXP-regler per modul, anonyma donationer, lärarens inrednings-bockar, återställ-historik.

## Slutmål
Ett centralt samarbetsnav där eleverna gemensamt offrar sina egna mynt för att bygga något stort ihop, och där klassens gemensamma ansträngningar automatiskt belönas med uppgraderingar och pokaler. Återanvändbart för 100 klasser oberoende av varandra.
