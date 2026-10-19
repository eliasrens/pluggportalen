# Lärarsidan – inventering före omgörningen (epic #802, #803)

Spec: [`UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md`](UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md) §0.1 "Ingen funktion får försvinna".
Godkänd förhandsvisning: [`preview/preview-lararsida-struktur.html`](../preview/preview-lararsida-struktur.html).

**Så läses tabellen**

- **Var i dag** = före #803 (toppnav Översikt · Klasser · Material · Prov · Live och tävlingar · Statistik · Admin + Logga ut).
- **Var efter** = planerad plats enligt specen DEL 1–8. Bokstaven i hakparentes säger vilken sub-issue som flyttar den:
  **A** #803 (toppmeny, profilmeny, omdirigeringar) · **B** Mina klasser · **C** Elever och Admin · **D** Material · **E** Hem + Prov-räknare · **F** Hjälp. "–" = ligger redan rätt.
- **Vem**: *alla* = årskurslärare och admin, *admin* = bara admin. Behörigheterna ändras inte (reglerna och Cloud Functions spärrar på riktigt, se [`BEHORIGHETER.md`](BEHORIGHETER.md)).
- **Klick** räknas från en annan lärarsida (toppmenyn syns), med klassen redan vald där klassen kommer ihåg. "A:" = efter #803, "slut:" = efter hela epicen.
- Koderna (`flikar.…`, `sektioner.…`, `statistik.…`) är raderna i placeringskartan [`src/teacher-struktur.js`](../src/teacher-struktur.js).
  `test/lararsida-inventering.test.js` kräver att varje flik i `TEACHER_TABS`, sektion i `CLASS_SECTIONS` och flik i `STATS_TABS`
  har en rad där, att rollen stämmer och att den går att nå i toppmenyn – och att varje kod står i det här dokumentet.

## 1. Toppmenyns flikar (`TEACHER_TABS`)

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Översikt/Hem `flikar.hem` (`#/larare/hem`, förr `#/larare/oversikt`) | Översikt | alla | **Hem** [A: byter namn och adress; E: ny Hem-sida] | 1 → 1 |
| Statistik `flikar.statistik` (`#/larare/statistik`) | Statistik (eget toppval) | alla | Mina klasser → **Hur går det?** [A: Mina klasser öppnar statistiken; B: fliken] | 1 → 1 |
| Klasser `flikar.klasser` (`#/larare/klasser`) | Klasser | alla | Mina klasser → Vad eleverna ser · Fokusläge · Elever [A: underfliken Klassinställningar; B: flikarna] | 1 → A: 2 (Hem-korten: 1) · slut: 2 |
| Material `flikar.material` (`#/larare/material?flik=…`), förr Plugga-material `#/larare/innehall`, Bråkresan testläge `#/larare/brakresan` och Hitta rätt! `#/larare/hitta-ratt` | Material → Plugga-material · Bråkresan · Hitta rätt! (tre flikar) | alla (Hitta rätt!: admin) | **Material** med underflikar Plugga-områden · Läsresan · Ekvationsresan · Bråkresan · Hitta rätt! · Schack; de gamla adresserna omdirigeras (`?prov=` följer med) [D #806] | 1–2 → 1–2 |
| Mina prov `flikar.prov` (`#/larare/prov`) | Prov → Mina prov | alla | Prov → Mina prov, "Att rätta" överst [E] | 1 → 1 |
| Provtillfällen `flikar.provtillfallen` (`#/larare/prov/tillfallen`) | Prov → Provtillfällen | alla | Prov → Provtillfällen | 2 → 2 |
| Live `flikar.live` (`#/larare/live`) | Live och tävlingar → Live | alla | **Live** (byter namn) | 1 → 1 |
| Mattematchen `flikar.mattematchen` (`#/larare/mattematchen`) | Live och tävlingar → Mattematchen | admin | Live → Mattematchen + kort på Admin [C] | 2 → 2 |
| Klasser & elevkonton `flikar.adminklasser` (`#/larare/admin/klasser`) | Admin → Klasser & elevkonton | admin | Admin (skapa/döp om/ta bort klass) + Mina klasser → Elever (elever, mynt, Klasscentret) [C] | 1 → 1 |
| Lärarkonton `flikar.konton` (`#/larare/konton`) | Admin → Lärarkonton | admin | Admin → Lärarkonton (kort) [C] | 2 → 2 |
| Säsong och Halloween `flikar.sasong` (`#/larare/admin/sasong`) | Admin → Säsong | admin | Admin → Säsong (kort) [C] | 2 → 2 |
| Hjälp och guide `flikar.hjalp` (`#/larare/hjalp`) | – (ny) | alla | Profilmenyn → Hjälp och guide [A: platshållare; F: guiderna] | – → 2 |

## 2. Toppmenyns ram

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| "Inloggad som …" | Ruta i toppnaven (dold under 900 px) | alla | Profilmenyn: knapp med kontots namn ▾ → "Inloggad som …" [A] | 0 → 1 (namnet syns på knappen: 0) |
| Logga ut | Eget val sist i toppnaven | alla | Profilmenyn → Logga ut [A] | 1 → 2 |
| Admin (genväg) | Toppval Admin | admin | Toppval Admin + Profilmenyn → Admin (smala skärmar) [A] | 1 → 1 |
| Smal skärm | Flikarna scrollar i sidled | alla | ☰ Meny med samma val [A] | 1 → 2 |
| Lärarinloggningen (spärren) | `#/larare`, alla lärarsidor | – | Oförändrad; landar på Hem (eller sidan man ville till) [A] | – |
| "Det här kan bara admin göra." | Admin-route öppnad av årskurskonto | årskurs | Oförändrad | – |

## 3. Klassens sektioner (`CLASS_SECTIONS`)

I dag: klasslista till vänster, sektionsflikar till höger. Klasser (`#/larare/klasser`) visar Områden · Lägen per område · Synlighet · Fokusläge · Schack · Inloggning; Statistik visar Statistik; Admin → Klasser & elevkonton visar Elever · Klasscentret (+ skapa/döp om/ta bort).

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Inloggning `sektioner.inloggning`: användarnamn, lösenord (Visa, Sätt nytt lösenord, Generera enkelt lösenord), Skriv ut inloggningskort (Markera alla/Avmarkera alla, Skriv ut) | Klasser → klass → Inloggning | alla (årskurs: användarnamnet låst) | Mina klasser → **Elever** [B; kompakt tabell + ⋯ Byt lösenord i C] | 2 → slut: 2 |
| Elever `sektioner.elever`: elevkonton, namn/avatar, +10/+50/Ge mynt, Ta ur klassen, Ta bort konto, Förbered konton/Generera alla/Skapa N konton/Kopiera alla, Lägg till valda | Admin → Klasser & elevkonton → klass → Elever | admin | Mina klasser → **Elever** (admin: mynt-kolumn, ⋯ Ge mynt/Ta ur klassen/Ta bort konto, Ge hela klassen mynt, Lägg till elev) [C] | 3 → slut: 2 |
| Områden `sektioner.omraden`: tilldela arbetsområden (Spara områden, Rensa – visa allt) | Klasser → klass → Områden | alla | Mina klasser → Vad eleverna ser → **1. Områden** (hela namn) [B] | 2 → 2 |
| Lägen per område `sektioner.lagen`: dölj övningslägen (Visa alla, Spara lägen per område) | Klasser → klass → Lägen per område | alla | Mina klasser → Vad eleverna ser → **3. Avancerat** (ihopfällt) [B] | 2 → 3 |
| Synlighet `sektioner.synlighet`: moduler på/av (Spara moduler, Visa alla); byar (Spara byar, Dölj för alla andra klasser, Visa för alla) bara admin | Klasser → klass → Synlighet | alla (byar: admin) | Mina klasser → Vad eleverna ser → **2. Delar i elevernas meny** [B] | 2 → 2 |
| Fokusläge `sektioner.fokus`: Lås klassen (mål, sluttid, vad eleven får göra efter inlämning #788), +N min, Lås upp nu | Klasser → klass → Fokusläge | alla | Mina klasser → **Fokusläge** [B] | 2 → 2 |
| Schack `sektioner.schack`: Slå på/Stäng av schack, pågående partier (Titta = åskådarläge, Avsluta partiet), topplistan (Dölj/Visa för eleverna, Nollställ topplistan), statistik | Klasser → klass → Schack | alla | Mina klasser → Hur går det? → **Schack**; på/av även i Vad eleverna ser [B] | 2 → 3 |
| Klasscentret `sektioner.klasscenter`: vem får inreda (Alla får inreda, Spara), kassörer (Spara kassörer), Lägg från klasskassan, insamling med donatorer, pokaler, historik | Admin → Klasser & elevkonton → klass → Klasscentret | admin | Mina klasser → **Elever** (admin) [C] | 3 → slut: 2 |
| Statistik `sektioner.statistik` (matrisen + underflikarna nedan) | Statistik → klass | alla | Mina klasser → **Hur går det?** [B] | 1 → 1 |
| Skapa en ny klass (+ N elevkonton) | Admin → Klasser & elevkonton → Skapa en ny klass | admin | Admin → Klasser [C] | 2 → 2 |
| Döp om klass | Admin → Klasser & elevkonton → klass → Döp om | admin | Admin → Klasser [C] | 3 → 3 |
| Ta bort klassen | Admin → Klasser & elevkonton → klass → Ta bort klassen | admin | Admin → Klasser [C] | 3 → 3 |
| Vald klass kommer ihåg (`?klass=&sektion=`) | Per sidläge i URL:en | alla | `?klass=` + `localStorage`, gemensam för hela Mina klasser [B] | – |

## 4. Statistikens underflikar (`STATS_TABS`)

Alla ligger i dag under Statistik → klass → underflik, och efter B under Mina klasser → Hur går det? → underflik (samma tabeller, oförändrade). Senast valda underflik kommer ihåg (`lastStatsTab`). Avstängd modul → underfliken nedtonad "· av" med länk till Vad eleverna ser [B].

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Ämnen `statistik.amnen`: stjärnmatris elever × områden, elevdetalj | Statistik → Ämnen | alla | Mina klasser → Hur går det? → Ämnen [B] | 2 → 2 |
| Per område `statistik.omraden`: klasstabell per ämne/område, frågekategorier | Statistik → Per område | alla | Hur går det? → Per område [B] | 2 → 2 |
| Läsresan `statistik.lasresan`: översikt, elevdetalj, Ändra nivå för klassen…, Spara nivå/Spara startnivå per elev, Ämnesläsning | Statistik → Läsresan | alla (pokalutdelning vid klassbyte: admin) | Hur går det? → Läsresan (nivåerna kvar här) [B] | 2 → 2 |
| Ekvationsresan `statistik.ekvationsresan`: översikt, räknegång, Ändra nivå för klassen…, Spara nivå | Statistik → Ekvationsresan | alla | Hur går det? → Ekvationsresan [B] | 2 → 2 |
| Prov `statistik.prov`: klassens provtillfällen + varje elevs prov över tid (tillfällets färggränser, #796) | Statistik → Prov | alla | Hur går det? → Prov [B] | 2 → 2 |
| Bråkresan `statistik.brakresan`: Översikt, Matris, Rekommendationer (Rekommendera, Avsluta/Ta bort), elevdetalj, Testa utmaningarna | Statistik → Bråkresan | alla | Hur går det? → Bråkresan [B] | 2 → 2 |
| Mattematchen `statistik.mattematchen`: välj period → klassens tabell | Statistik → Mattematchen | alla | Hur går det? → Mattematchen [B] | 2 → 2 |
| Live `statistik.live`: klassens Live-matcher + elevernas summa | Statistik → Live | alla | Hur går det? → Live [B] | 2 → 2 |
| Hitta rätt! (klassens statistik) | – (finns inte i dag) | – | Hur går det? → Hitta rätt! om det finns statistik [B] | – |

## 5. Hem (dagens Översikt)

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Klasskort (elevantal, fokusläge på/av) med snabbval Fokusläge · Inloggning · Statistik | Översikt → Mina klasser | alla (årskurs: egna klasser) | Hem → Mina klasser (kompakta kort, klick öppnar klassen) [E] | 1 → 1 |
| Pågående Live → Öppna projektorvy | Översikt → Pågående Live | alla (årskurs: där en egen klass deltar) | Hem → Att göra: "Live-match pågår" → Öppna [E] | 1 → 1 |
| Skapa Live-match | Översikt | alla | Hem → Snabbval: Starta Live [E] | 1 → 1 |
| Kom igång, Att göra, Snabbval, dölj testklasser | – (nytt) | årskurs / alla / admin | Hem [E] | – |

## 6. Material

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Ämnesflikar, Allt material / Mitt material, årskursfilter, sortering (Område/Årskurs) | Material → Plugga-material | alla | Material → Plugga-områden, oförändrad (`material.plugga`) [D #806] | 1 → 1 |
| Nytt ämne | Plugga-material | admin | Plugga-områden [D] | 1 → 1 |
| Skapa nytt område (guiden steg 1–4, AI-verkstad: Kopiera AI-prompt, Infoga exempel, Kontrollera, Spara) | Plugga-material | alla | Plugga-områden [D] | 2 → 2 |
| Använd (→ klassens Områden) | Plugga-material → rad | alla | Plugga-områden → rad (→ Mina klasser → Vad eleverna ser) [D] | 2 → 2 |
| Duplicera (egen kopia) | Plugga-material → rad | alla | Plugga-områden → rad [D] | 2 → 2 |
| Redigera (guiden) | Plugga-material → rad (eget material) | alla (admin: allt) | Plugga-områden → rad, ikonknapp med `title`/`aria-label` (med områdets namn) [D #806] | 2 → 2 |
| Granska innehållet / underrader: redigera, lägg till, ta bort frågor, par, texter, spann (Ångra) | Plugga-material → rad | alla (eget) | Plugga-områden → rad [D] | 2 → 2 |
| Lägg till innehåll (Kopiera AI-prompt för mer innehåll, Visa exempel, Kontrollera, Lägg till i området) | Plugga-material → rad | alla (eget) | Plugga-områden → rad [D] | 2 → 2 |
| Skapa ämnestexter (Kopiera AI-prompt, Kontrollera, Förhandsgranska, Spara) | Plugga-material → rad | alla (eget) | Plugga-områden → rad [D] | 2 → 2 |
| Ta bort område (med bekräftelse) | Plugga-material → rad | alla (eget) | Plugga-områden → rad [D] | 2 → 2 |
| Bråkresan testläge `material.brakresan`: Granska med facit, Spela som elev, Kontrollera, Visa hjälp, Ny variant | Material → Bråkresan | alla | Material → Bråkresan (`material.brakresan`) [D #806] | 2 → 2 |
| Hitta rätt! `material.hitta-ratt`: Färdiga områden (Visa innehåll, Provspela, Duplicera till Mina områden), Mina områden (Redigera, Provspela, Duplicera, Skapa nytt), redigeraren (kartval, platssök i OpenStreetMap, bilder: Sök bild online/Ladda upp egen, frågor, Spara, Radera), provspel `?prov=` | Material → Hitta rätt! | admin | Material → Hitta rätt! (`material.hitta-ratt`, `?prov=` som förut) [D #806] | 2 → 2 |
| Läsresan: texter per nivå `material.lasresan` | – (lärarvy saknas) | – | Material → Läsresan: förklaring, nivåtabell och länk till nivåerna (Mina klasser → Hur går det? → Läsresan) [D #806] | – |
| Ekvationsresan: prova som lärare `material.ekvationsresan` | – (testläge saknas) | alla | Material → Ekvationsresan: nytt testläge på vald nivå, samma spelvy i ett minneslager, inget sparas [D #806] | – → 2 |
| Schack: prova mot datorn `material.schack` | – (testläge saknas) | alla | Material → Schack: nivåval och parti mot datorn, bara lokalt pågående parti, inga mynt/räknare [D #806] | – → 2 |

## 7. Prov

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Nytt prov, Redigera, Kör i klass, Kopiera (kollegors prov), Radera | Prov → Mina prov | alla (årskurs: ändrar egna) | Prov → Mina prov [E: "Att rätta" överst] | 1 → 1 |
| Redigeraren: Lägg till fråga (alla frågetyper), avsnitt, Flytta till…, Hämta från område, Skapa med AI (Kopiera prompten, Granska, Lägg till i provet), Förhandsvisa som elev, Skriv ut, Spara provet, inställningar (stavfel, färggränser #759, fråga om körda tillfällen #796), vad eleven får göra efter inlämning (#788) | Prov → Mina prov → prov | alla | Oförändrad | 2 → 2 |
| Provtillfällen: Öppna (nu/senare), Stäng, Öppna igen, Radera, Extra tid och anpassningar, Omprov, Kör ett prov i klass, Vidare (efter inlämning, #788), Uppdatera nu | Prov → Provtillfällen | alla | Prov → Provtillfällen | 2 → 2 |
| Översikt/Resultat för ett tillfälle (`#/larare/prov/tillfalle?t=`), fördjupad statistik och utskrift (#747) | Provtillfällen → Översikt | alla | Oförändrad | 3 → 3 |
| Rätta (`#/larare/prov/ratta?t=`): per fråga/per elev, Rätta alla automatiska frågor, halvpoäng, Lämna tillbaka, Avbryt, färggränser i efterhand (#796), pluggmynt vid återlämning (#746) | Provtillfällen → Rätta | alla | Prov → Att rätta → Rätta [E] (gamla vägen kvar) | 3 → slut: 2 |
| Märket "Prov 18" (prov som väntar på rättning) | – (nytt) | alla | Toppmenyn Prov [E, bara om räknarna är billiga] | – |

## 8. Live och Mattematchen

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Skapa lobby (Klassmatchen, Snilleblixten, Guldrushen, Datakuppen, Trollkarlen …), belöningar, Ändra nämnare | Live och tävlingar → Live | alla (motståndare valfri, en egen klass måste delta) | Live | 1 → 1 |
| Aktiva matcher: Öppna projektorvy (`?id=`), Radera; historik (← Till Live) | Live | alla | Live | 1 → 1 |
| Mattematchen: Skapa Mattematch, Spara ändringar, start/paus/avsluta, Nollställ tävlingen, resultat (Uppdatera) | Live och tävlingar → Mattematchen | admin | Live → Mattematchen + kort på Admin [C] | 2 → 2 |

## 9. Admin

| Funktion | Var i dag | Vem | Var efter omgörningen | Klick i dag → efter |
| --- | --- | --- | --- | --- |
| Lärarkonton: Nytt konto (klasser, Skapa ett lösenord åt mig), Hantera, Byt lösenord, Gör till admin/årskurskonto, Aktivera/Stäng av kontot, Radera kontot | Admin → Lärarkonton | admin | Admin → Lärarkonton (kort) [C] | 2 → 2 |
| Säsong: Sommar/Höst, Halloween på/av, slutdatum (Förval: 2 nov 23.59), Spara (Ja, ändra för alla) | Admin → Säsong | admin | Admin → Säsong (kort) [C] | 2 → 2 |
| Klasser och elevkonton (skapa/döp om/ta bort klass) | Admin → Klasser & elevkonton | admin | Admin → Klasser (kort) [C] | 1 → 2 |
| Hitta rätt! (paket och bilder), Mattematchen | Material resp. Live | admin | Kort på Admin + kvar i Material/Live [C] | 2 → 2 |

## 10. Gamla adresser (DEL 7)

Kartan ligger på ett ställe: `TEACHER_REDIRECTS` i [`src/teacher-shared.js`](../src/teacher-shared.js). `app.js` slår upp den
i `router()` innan rutten väljs (`location.replace`, så bakåtknappen inte studsar). Parametrar följer med (`?prov=`, `?klass=` …).
Ett mål som är samma route betyder "dagens sida är fortfarande platsen" – B–D byter bara målet när den nya platsen finns.

| Gammal | Ny (planerad) | Mål efter #803 |
| --- | --- | --- |
| `#/larare/oversikt` (och `#/larare`) | Hem | `#/larare/hem` |
| `#/larare/klasser` | Mina klasser → Vad eleverna ser | `#/larare/klasser` (Mina klasser → Klassinställningar) |
| `#/larare/statistik` (och `#/larare/klass`) | Mina klasser → Hur går det? | `#/larare/statistik` (Mina klasser → Statistik) |
| `#/larare/admin/klasser` | Admin, och för en vald klass Mina klasser → Elever | `#/larare/admin/klasser` |
| `#/larare/innehall` (och `#/larare/prompter`) | Material → Plugga-områden | `#/larare/material?flik=plugga` (#806) |
| `#/larare/brakresan` | Material → Bråkresan | `#/larare/material?flik=brakresan` (#806) |
| `#/larare/hitta-ratt` | Material → Hitta rätt! (`?prov=` fungerar som förut) | `#/larare/material?flik=hitta-ratt` (#806; `?prov=`, `?vy=` följer med) |
| `#/larare/elever` | Mina klasser | `#/larare/klasser` |

## 11. Att veta (rapport)

- **Klick i #803:** Klassinställningar (dagens Klasser) är ett klick längre bort i toppmenyn (Mina klasser → Klassinställningar),
  eftersom Mina klasser öppnar statistiken som blir "Hur går det?" i B. Från Hem är Fokusläge och Inloggning fortfarande ett klick
  (klasskortens snabbval). Logga ut är ett klick längre bort (profilmenyn) – det är det specen ber om.
- **Funktioner som inte passar perfekt:** inga borttagna. Lägen per område hamnar i ett ihopfällt steg (ett klick till), Schack
  får sin statistik i Hur går det? men på/av ligger kvar i Vad eleverna ser.
- **Iakttagelse:** schackets lärarsektion säger "Inga pluggmynt delas ut för schack", men sedan #798 ger första vinsten mot datorn
  mynt. Texten flyttas i B – rättas där (eller separat).
