# Testrapport #734 – fokusläget täcker alla moduler (Tester, 2026-10-15)

Testat på 4dbd4b9 mot Firestore+Auth-emulatorn (admin/qa-ekvationsresan-preview.sh,
FS 8734 / proxy 8735, + qa-tidsjakt-seed för områdena so/vasatiden, so/vikingatiden).
Lås satta både via lärar-UI:t (Ekvationsresan) och direkt på `classes/qa-klass.lock`.
Varje rad: direktlänk till varje route från avatarsidan, slutlig hash avläst.

| Lås | Målet | Andra inlärningsmoduler (meny + direktlänk) | Shop/hus/profil |
|---|---|---|---|
| Ekvationsresan (via lärar-UI) | öppet | spärrade → målet | öppna |
| Hitta rätt! (live-byte, ingen omladdning) | öppet | spärrade | öppna |
| Mattematchen + Dölj allt annat | öppet | spärrade | spärrade |
| Läsresan (gammal typ), 390×844 | öppet | spärrade | öppna |
| omrade so/vasatiden (gammal typ) | öppet, Plugga-listan visar bara Vasatiden | Vikingatiden + moduler spärrade | öppna |
| omrade so/vikingatiden + Dölj allt annat | öppet | spärrade | spärrade |
| Sluttid passerad (45 s-lås) | – | allt öppet igen, menyn full, utan omladdning | öppna |
| Okänd typ `brakresan` (förbi reglerna) | – | räknas som inget lås | öppna |

- Målväljaren: grupper "Plugga · SO", "Läsning", "Moduler". Mattematchen utan aktiv
  period → "(ingen aktiv period)" gråad; Hitta rätt! ej påslagen → "(inte påslagen för klassen)" gråad.
- Modul-av utan lås (#412, regression): ekvationsresan/hitta-ratt → #/elev/hus, dolda i menyn.
- Avatarvalet nås under lås.
- Enhet 2431/2431, test:rules 599/599, bootgraf 107 (class-lock.js inte i den).
- Observation (fanns före #734): profilkortet i menyn länkar till #/elev/profil även med
  "Dölj allt annat"; klick studsar tillbaka till målet.
- Emoji visas som rutor i headless-skärmdumparna (saknad font), inte en bugg.
