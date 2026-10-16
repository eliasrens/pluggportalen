# QA-rapport #753 – Bråkresan: Fortsätt på Kontrollera-knappens plats

Testat 2026-10-16 på 5ff49c8 (efter) mot 5ff49c8~1 (före).
Rigg: `preview/qa-brakresan-753.html?u=NN&svar=rf` (testomgång, varje uppgift förifylld med
`key.examples` rätt/fel) + `admin/qa-brakresan-753.mjs` (headless chromium via CDP: riktig musklick
på Kontrollera, mäter Fortsätt, fokus, Enter, "Försök igen" → "Kontrollera igen").
Utmaningar 01, 03, 12, 15 (sortera familjer), 19 (tallinje), 24 (sortera kort), 34 · skärmar
1920×1080, 1366×768, 1280×720, 390×844 · uppgift 1 rätt, uppgift 2 fel → 56 fall.
Mätdata: `docs/qa-brakresan-753/matt-efter.txt`, `matt-fore.txt`. Skärmdumpar i samma mapp.

## Grönt
- Före: Fortsätt låg 223–250 px under Kontrollera, i 40/56 fall låg redan Kontrollera under vecket
  (`fore-03-1366-fel.png`), och "Rätt!" visades två gånger (16/16 rätt-fall). Efter: aldrig dubbelt "Rätt!".
- Efter: musen (Kontrollera-knappens mitt) träffar Fortsätt i 48/56 fall; Kontrollera byts mot
  Fortsätt i knappraden, "Visa hjälp"/"Försök igen" bredvid (`efter-01-1280-ratt.png`, `efter-03-1366-fel.png`).
- Fokus hamnar på Fortsätt i 56/56. Enter fortsätter till nästa uppgift i 54/56 (de 2 = F3).
- 1366×768 och 1280×720: uppgift + knapprad syns utan scroll i alla testade utmaningar.
- Inga JS-fel. Enhetstester gröna (de 77 röda är emulator/firebase-admin-beroende, som förut).
  Bootgrafen 107.

## Fel
- **F1 (desktop): knappraden flyttar sig när modellen växer efter kontroll.** Resultatramen
  (dubbel kant) gör modellen 4–6 px högre → raden sjunker 4–6 px i alla rätt-fall (musen träffar ändå).
  Värre när innehållet bryts om: 24 @1920 rätt +30 px (korthuvudet "Mindre än 1/2" bryts på två rader,
  `F1-24-1920-*.png`) och 34 @1366 fel −26 px – musen missar Fortsätt. `behallPlats` kompenserar med
  `scrollBy`, vilket inte går när sidan inte kan scrolla. 34 @1280 (trängt läge): +20 / +42 px.
- **F2 (mobil, trängt läge): fastnålade raden växer uppåt.** När återkopplingen är längre än den
  reserverade platsen flyttas Fortsätt 28–55 px uppåt (12, 15, 24, 34 @390×844, `F2-15-390-*.png`).
- **F3 (mobil, trängt läge): "Försök igen" tappar den fastnålade raden.** "Kontrollera igen" och
  sedan Fortsätt hamnar under vecket (y 962 / 1220 i 844-fönster) – scroll krävs (15, 34 @390×844,
  `F3-15-390-forsok-igen.png`).

## Inte testat
- Riktig server-/emulatorkedja (demoBackend räcker för UI:t; samma vy), skärmläsare (bara
  aria-live-attributet granskat), övriga 43 utmaningar.
