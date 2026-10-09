# Klickguide – Klasscentret (epic 1–4) i previewn

Previewn kör hela Klasscentret mot **emulatorn**, alltså testdata i minnet. Inget du gör här når de riktiga eleverna, och allt nollställs när previewn startas om.
Den fullständiga testrapporten finns i `docs/QA-RAPPORT-klasscentret-4.md`.

## Starta previewn

Från repots rot (grenen för epic #473):

```bash
JAVA_BIN=/tmp/mm457/jdkdl/jdk-21.0.12.1+1-jre/bin \
FIREBASE_BIN=/home/barista/.npm/_npx/7750544ccf494d8b/node_modules/.bin \
bash admin/qa-klasscentret-preview.sh
```

- Skriptet startar Firestore (8520) och Auth (9520), seedar allt och startar proxyn på **http://127.0.0.1:8521/**. Det tar ca 20 s.
- Andra portar: `FS=8600 AUTH=9600 PROXY=8601 bash admin/qa-klasscentret-preview.sh`.
- Loggar: `/tmp/kc-preview-8520/{emu,proxy}.log`.
- **Stoppa:** döda processerna `qa-emulator-proxy.mjs` (PORT 8521) och `firebase emulators:start --config /tmp/kc-preview-8520/firebase.json` (+ dess java). En omstart ger ren testdata.
- För hjälpkommandona nedan behöver terminalen:
  `export FIRESTORE_EMULATOR_HOST=127.0.0.1:8520 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9520 GCLOUD_PROJECT=pluggportalen-so-2026`

## Inloggningar (lösenord för alla: `lilla123` – endast emulator)

| Roll | Användarnamn | Vem / klass | Att titta på |
|------|--------------|-------------|--------------|
| Hemmaelev | `kc01` | Noah, QA-klass 4A (14 elever) | Centret i byn, rummet med alla verktyg, 8 pokaler, tavlan |
| Bockad elev | `kc03` | Liam, QA-klass 4A | Ser rummet men får inte inreda |
| Gäst | `kd01` | Alice, QA-klass 4B (5 elever, Rådhus N6) | Besöker 4A:s center via "Andra byar" |
| Stor klass | `ke01` | Elias, QA-klass 4C (28 elever) | Placeringen med 28 hus |
| Givare A | `ks01` | Alva, QA-klass 5A (3 000 mynt) | Shoppen → Klasscentrum |
| Givare B | `ks02` | Ebbe, QA-klass 5A (3 000 mynt) | Samma insamling i en annan flik |
| Lärare | `qalarare` | (via "Lärare →") | Klasser → QA-klass 4A → **Klasscentret** |
| Övrigt | `elev1` (Mattematchen), lärare `rasmus` (Live) | – | Regression |

Elever loggar in på startsidan. Läraren klickar "Lärare →" uppe till höger.
Två elever samtidigt: använd en vanlig flik och ett privat fönster, eller två webbläsare. Två flikar i samma fönster delar inloggning.

## Acceptanstest 1 – Placering

1. Logga in som **`kc01`** och gå till **Hem**, zooma ut till byn (`#/elev/by`). Klasscentret (ett tält) står **mitt i översta raden** med 2 hus på varje sida. Det är bredare än ett hus, och resten av de 14 husen står i raderna under.
2. Logga ut och logga in som **`kd01`** (5 elever): 2 hus, Rådhuset, 2 hus, och det femte huset under.
3. Logga in som **`ke01`** (28 elever): 2 + tält + 2, och alla 28 hus syns. "Andra byar"-skylten täcker inget hus.
4. Mätaren ("230 / 238 övningar till Nivå 3") visas när du **hovrar** över centret. På en pekskärm visas den i bubblan när du trycker (beslut #484).

## Acceptanstest 2 – EXP-uppgradering (bilden byts live)

1. Logga in som **`kc01`** och ha byn öppen (4A har 230 EXP, Nivå 2 Tält).
2. Kör i terminalen: `node admin/qa-klasscenter-by-seed.mjs exp qa-kc 238`. Tältet blir en **Träkoja** direkt, utan omladdning, och hover visar "238 / 448 till Nivå 4".
3. Klicka på centret så att rummet öppnas. Kör `node admin/qa-klasscenter-by-seed.mjs exp qa-kc 448`. Rubriken blir "Nivå 4 Timmerstuga" och "448 / 770 övningar till Nivå 5", och tavlan visar 448.
4. (Riktigt flöde) Gör ett quiz med minst 50 % rätt som `kc01`. Klass-EXP ökar med 1 inom ~15 s. Under 50 % ger 0.

## Acceptanstest 3 – Crowdfunding

1. Flik 1: **`ks01`**, gå till **Shoppen → 🏛️ Klasscentrum**. Flik 2 (privat fönster): **`ks02`**, samma flik i shoppen.
2. ks01: tryck **Guldstaty → Donera 💛 → 100 → Skänk 100**. Kortet visar "**100 / 5 000** mynt insamlade" och "Du har bidragit med 100 mynt".
3. ks02 ser **100 / 5 000** utan att ladda om. Donera 400 där, så visar ks01 500 / 5 000.
4. Inga namn syns för eleverna, bara summan (anonymt).

## Acceptanstest 4 – Upplåsning

1. Fortsätt i guldstatyn och fyll på tills nästan allt är insamlat (ks02 kan skänka resten av sina mynt).
2. Skriv ett för stort belopp i "Eget belopp". Fältet kläms till det som saknas, och du kan aldrig skänka mer.
3. När mätaren når 100 % visas "✓ **Köpt!** Finns i klassens möbellåda", och knapparna försvinner.
4. Gå till byn och klicka på centret, sedan **📦 Möbellådan**. **Guldstaty** finns där. Klicka på den, dra den till rätt plats och tryck **💾 Spara**.

## Acceptanstest 5 – Gästläge

1. Logga in som **`kd01`** och gå till byn. Välj **Andra byar** och sedan **"Klass QA-klass 4A, 14 hus"** (det finns två klasser med det namnet; välj den med **14** hus). Klicka på 4A:s Klasscenter.
2. Rubriken är "Klasscentret i QA-klass 4A" och raden säger "👀 Du är på besök …". Det finns **ingen** Möbellåda, Historik eller Spara.
3. Hovra över en pokal på hyllan för att se informationsrutan (titel, text, källa, datum).
4. Försök dra en pokal eller möbel. Ingenting flyttas.
5. Klicka på statistiktavlan för att öppna panelen (EXP, lösta uppgifter, nivå).
6. Shoppen visar bara Alices egen klass (4B). Hon kan inte donera till 4A.
7. Att reglerna nekar även **råa** skrivningar visas av skriptet: `node admin/qa-klasscentret-4-kontroll.mjs gast` (ska sluta med "Alla kontroller OK").

## Beslutspunkter

- **Lärarens bockar:** logga in som **`qalarare`** och gå till **Klasser & elever → QA-klass 4A (14) → Klasscentret**. Under "Vem får inreda?" är Liam urbockad. Bocka ur någon mer och tryck Spara. Logga sedan in som den eleven och öppna rummet: verktygen saknas och raden säger "läraren har stängt av inredning för dig".
- **Bockad elev:** **`kc03`** (Liam) ser rummet och kan donera, men inte inreda.
- **Anonyma donationer:** i samma lärarsektion visar "Insamling" vem som donerat till varje föremål (t.ex. "Guldstaty – Alice 2 500 · Oskar 2 500"). Eleverna ser bara summan.
- **Återställ-historik:** öppna rummet som `kc01` och tryck **🕘 Historik**. Där finns v1–v3. Välj en äldre version och tryck **Återställ**, så sparas den som en ny version.
- **Pokaler + statistiktavla:** 4A har 3 pokaler (2 Mattematchen, 1 Live) på hyllan. Hovra för att se texten och klicka på tavlan. Tavlan visar 1 050 lösta uppgifter (seedat).
- **Normalisering per elev:** 4C (28 elever) har 460 EXP och står på Nivå 2 ("460 / 476"). 4A (14 elever) når Nivå 3 redan vid 238. Samma EXP per elev ger samma nivå.
- **EXP-regler per modul:** `node admin/qa-klasscentret-4-kontroll.mjs regler` skriver ut alla regler med testfall.
- **Utloggning med rummet öppet:** öppna rummet och tryck **Logga ut**. Rummet stängs och inloggningen visas.

## Frågor till Elias

1. Statistiktavlans "lösta uppgifter" räknar bara övningsomgångar, inte Läsresan, Mattematchen eller Live. Ska de räknas in?
2. Rummet har en gratis pokalhylla **och** shoppens Troféhylla (2 500 mynt). Är det dubbelt?
3. `live-avklarat`-pokalen ("Liveläge avklarat") delas aldrig ut, eftersom det inte finns något kooperativt Live-läge. Ska den vara kvar eller tas bort?
4. Befintliga klasser startar på Nivå 1 (0 EXP). Ska klasser som redan pluggat få en startbonus? Det kräver ett nytt adminskript.

## Före merge till main

Se listan i `docs/QA-RAPPORT-klasscentret-4.md` (§ Före merge). Det viktigaste: **`firebase deploy --only firestore:rules`** före eller samtidigt med mergen. Inga nya index behövs, och ingen migrering krävs.

## #528 – Fler pokaler + Troféhyllan

Efter preview-skriptet: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8520 node admin/qa-pokal-528-seed.mjs`
(samma FS-port som previewn). Den låser upp Troféhyllan för QA-klass 4A, ger 4A fler pokaler
(silver, brons, Liveläge, lärarens hjärta), 260 godkända Läsresan-texter, och en Mattematch med
4 klasser vars tid tog slut.

1. **Mattematchen guld/silver/brons:** `qalarare` → Mattematchen → öppna "Mattematchen #528 (4 klasser)".
   Den arkiveras och delar ut: guld till QA-klass 4B, silver till 4A, brons till 4C, inget till 5A.
2. **Läsresan-milstolpar:** `qalarare` → Klasser & elever → QA-klass 4A → Klasscentret → Pokaler.
   Raden säger "260 godkända Läsresan-texter … Nästa pokal vid 500", och listan har "Läsresan: 100 texter"
   och "Läsresan: 250 texter" (en gång var, hur många gånger du än öppnar).
3. **Lärarens pokal:** i samma block – välj motiv, skriv titel + text, "Dela ut pokalen". Den syns i listan
   (med Ta bort) och i rummet med din text i hover-rutan.
4. **Troféhyllan:** `kc01` → byn → klicka centret → 📦 Möbellådan → Troféhylla → Spara. De 6 finaste
   pokalerna står i den med belysning; gratis-hyllan har 3, resten står på väggen. Håll musen över en
   pokal i Troféhyllan → rutan med titel/text.
5. **Shoppen:** `ks01` → Shoppen → Klasscentrum: Troféhyllans kort förklarar att den är hedershyllan.
