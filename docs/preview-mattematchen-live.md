# Klickguide: Mattematchen + Live (preview)

Den här previewn är **riktiga Pluggportalen** mot Firebase-**emulatorn**. Inget skrivs till produktion,
och du kan klicka hur mycket du vill. QA-resultat: [QA-RAPPORT-mattematchen-live.md](QA-RAPPORT-mattematchen-live.md).

## 1. Öppna previewn

- **Enklast:** öppna fliken *Preview* på #462 i Barista. Där körs allt redan.
- **Själv, i repot:** du behöver Java och firebase-tools.
  ```bash
  firebase emulators:start --only auth,firestore --project pluggportalen-so-2026      # 8080 / 9099
  export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=pluggportalen-so-2026
  node seed/seed.mjs                                  # ämnen/områden (Plugga)
  START_OM_S=300 node admin/qa-mm-live-seed.mjs       # klasser, elever, tävlingar, Live
  PORT=8000 node admin/qa-emulator-proxy.mjs          # öppna http://localhost:8000
  ```
  Om du kör seeden igen återställs allt: lösenord, tävlingar och Live-matcher. De som är inloggade loggas då ut.

**Flera personer samtidigt:** en webbläsarprofil har bara EN inloggad elev åt gången. Två flikar som
**samma** elev förblir båda inloggade (F2 är fixat i #464). Om sessionen ändå tappas visas inloggningen med
"Du har loggats ut". För **olika** elever använder du ett vanligt fönster, ett inkognitofönster och en annan webbläsare.
Lärare loggar in **per flik**, vilket är så det fungerar redan i dag.

## 2. Inloggningar (lösenord för alla: `lilla123` – endast emulator)

| Vem | Användarnamn | Vad den ser |
|---|---|---|
| Lärare | `rasmus`, `elias` | Logga in via **Lärare →** på startsidan |
| 4B (20 elever) | `b01` … `b20` | Mattematchen oktober + Live 4B mot 5E (när den skapats) |
| 5E (22 elever) | `e01` … `e22` | Som 4B. **`e01` har 0 poäng** – bra för att testa poäng från noll |
| 4A (25 elever) | `a01` … `a25` | Mattematchen + Live-lobbyn **4A mot 3A** |
| 3A (5 elever) | `c01` … `c05` | Bara Live-lobbyn 4A mot 3A |
| 4C | `k01` | Mattematchen dyker upp av sig själv **START_OM_S sekunder efter seeden** |
| 6A | `f01` | Ingenting – varken Mattematchen eller Live |

## 3. Mattematchen – eleven

1. Logga in som `f01`. Menyn har **ingen** Mattematchen (MM-test 1).
2. Logga in som `k01` och vänta på Hem. När starttiden passerar dyker **🧮 Mattematchen** upp i menyn
   utan att du laddar om (MM-test 2).
3. Logga in som `e01` och öppna **Mattematchen**:
   - Skriv svaret och tryck **ENTER**, utan mus. "✅ RÄTT!" eller "❌ FEL – rätt svar var …" syns kort,
     och nästa tal kommer direkt. Fältet har alltid fokus.
   - Tryck ENTER två gånger snabbt. Bara ett svar räknas.
   - Poängen uppe till vänster ökar med 1 per rätt svar. Coins i sidomenyn ändras **inte**.
4. **🏆** visar *Individuellt* (Topp 25 av 67 elever) och *Klasskamp*: 5E, 4B **200,0** och 4A, med 1 decimal.
5. **📊** visar din egen statistik och procent per tabell 0–10.

## 4. Mattematchen – läraren

1. Logga in som `elias` och klicka **Mattematchen** i lärarmenyn.
2. Öppna **Mattematchen oktober**: Topp 25, Klasskamp och elevtabellen per klass. Klicka på en elev för att se
   detaljer per tabell och "Totalt i multiplikation (MM + Live)".
3. **Skapa Mattematch**: ange namn, kryssa i klass 6A, välj start om ett par minuter och spara.
   Status blir *Kommande* och sedan *Aktiv*. Är `f01` inloggad i ett annat fönster dyker tävlingen upp där av sig själv.
4. **Stoppa** gör att eleven inte längre ser den. **Fortsätt** visar den igen. **Avsluta** sparar resultatet
   och flyttar tävlingen till *Historik*.
5. **Nollställ / teståterställ** längst ned: knappen går bara att trycka på när du har skrivit tävlingens exakta namn.
6. **Mattematchen september** i Historik arkiveras första gången du öppnar den.
7. Under **Klasser & elever → 4B → Statistik** finns flikarna *Mattematchen* och *Live*.

## 5. Live – två lärare och två klassrum

Du behöver fyra fönster eller webbläsare: **A** rasmus, **B** elias, **C** `b01` (4B) och **D** `e01` (5E).

1. **A (rasmus):** klicka **Live**, välj 4B och 5E och ändra 4B:s nämnare till **17**. Låt det stå 20 min
   och tryck **Skapa lobby**. Projektorvyn öppnas med "0 elever redo".
2. **C och D:** **⚡ Live** dyker upp i menyn. Klicka **Gå med i Live-match**, så visas "4B MOT 5E – Väntar på start…".
   I A står det nu 1 redo per klass.
   - Vill du se "15 / 18 redo" kör du i repot:
     `node admin/qa-mm-live-sim.mjs join <sessions-id> 4b:15 5e:18`. Sessions-id:t står i adressfältet (`?id=`).
     Kör det med emulator-variablerna från avsnitt 1.
3. **B (elias):** klicka **Live**. Under *Aktiva Live-sessioner* syns "4B mot 5E · skapad av rasmus".
   Klicka **Öppna projektorvy**, så ser du samma lobby.
4. **B:** tryck **▶ STARTA MATCH**. Alla fönster visar 3 – 2 – 1 – KÖR!, och sedan får C och D sitt första tal.
5. **C och D:** svara med siffror och ENTER. Projektorerna rör sig nästan direkt.
   - Vill du få 340 mot 418 (20,0 mot 19,0) kör du `node admin/qa-mm-live-sim.mjs svar <id> 4b=340 5e=418`.
6. **A:** välj 🚀 **Raketrace**. **B:** välj 📊 **Statistik**. Var och en behåller sin vy, eftersom vyvalet är lokalt.
   Prova också 🪢 **Dragkamp**, 🔊 ljud och ⛶ fullskärm.
7. **Sen elev:** logga in som `b16` i ett nytt fönster och öppna Live. Du hamnar direkt i spelet.
8. **Återanslutning:** ladda om C eller A mitt i matchen. Allt kommer tillbaka.
9. **Slut:** vänta tills tiden tar slut, eller tryck **Avsluta**. Vinnarskärmen visas på projektorerna och hos eleverna,
   och resultatet hamnar under *Historik*.
   - Vill du se slutet snabbare: välj **5 min** när du skapar lobbyn, eller använd lobbyn **4A mot 3A**
     (5 min, eleverna `a01` och `c01`).
10. **Samtidiga matcher:** starta 4A mot 3A medan 4B mot 5E pågår. De påverkar inte varandra.

## 6. Bra att veta

- Live-poäng ger **inte** Mattematchen-poäng och inga coins.
- QA-fynden är fixade. #463: F1 (Live-elevvyn utan scroll på 1366×768), F3 (lärarmodaler stängs vid Tillbaka),
  F4 (Statistik → Live räknar ut resultatet ur räknarna) och F7 (e2e-auth-testet). #464: F2 (flera flikar).
- Ingenting här är deployat. Regler och index kräver `firebase deploy --only firestore:rules,firestore:indexes`
  först när epic:en går till main.
