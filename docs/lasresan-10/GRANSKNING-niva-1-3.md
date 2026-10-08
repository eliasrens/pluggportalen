# Läsresan – granskning av nivå 1–3 (issue #524, epic #516)

Granskning av de 90 nya texterna (`lr-g1-…`, `lr-g2-…`, `lr-g3-…`) från D1–D3 (#521–#523). Nivå 4–10 är inte ändrade.

## Resultat i korthet
- Tre texter på nivå 3 är **ersatta** eftersom de var nära dubbletter (en inom nivå 3, två mot nivå 4–5).
- Två svar kunde läsas på två sätt. Ett ord var fel och en mening hade fel ordföljd. En faktatext lämnade ut något viktigt. Allt detta är rättat.
- På nivå 1 är sex frågor omskrivna så att svaret står direkt i texten.
- Nivå 2:s faktatexter har kortare meningar, och nivå 3:s faktatexter enklare ord. Det ger jämnare stegring.
- `validateBank` på hela banken ger 0 fel och 0 varningar. `node --test` (alla tester utom regeltesterna, som kräver emulatorn) ger 1217 godkända och 0 underkända.
- Rätt svars position är oförändrad i varje fråga. Ändringarna rör bara text och alternativ, så A–D-fördelningen är densamma som förut.
- **Öppen punkt för leaden:** spec §2 säger 100–140 ord för nivå 3. Därför blir nivå 3 längre än nivå 4 (gamla nivå 1, 87–109 ord). Se *Stegring*.

## Så gjordes granskningen
- Jag läste alla 90 texter och alla 443 frågor, med rätt svar markerat, i källfilerna `admin/lasresan-g{1,2,3}-{story,fakta}.mjs`.
- Ändringar görs i källfilerna. JSON byggs om med `node admin/lasresan-g{N}-bygg.mjs`. Bygget är deterministiskt och samma frågeantal ger samma svarspositioner.
- Mätvärden och namnkoll tas fram med det nya skriptet `node admin/lasresan-granskning-matt.mjs [nivåer]`.
- Ämnen och handlingar jämförde jag mot titlar och brödtext på nivå 4–10, med sökord för varje ämne.

## Fynd och åtgärder

| # | Text | Vad | Varför | Åtgärd |
|---|---|---|---|---|
| F1 | `lr-g3-visselpipan` | Samma handling som `lr-g3-museet` | Båda: barnet kommer bort, blir rädd, vill springa, ”kommer ihåg vad X sa”, väntar och den vuxne kommer. Fråga 5 var nästan ordagrant samma (”Varför springer … inte …?” → ”Han minns vad … sa”). Även nära `lr-n5-dimman` (vilse) | **Ersatt** av `lr-g3-fossilet` ”Djuret i stenen” (äventyr). Nora hittar en ortoceratit på stranden och får veta vad det är i ett naturhus |
| F2 | `lr-g3-picknicken` | Nära dubblett mot nivå 4 `lr-n1-on-i-sjon` ”Ovädret på ön” | Båda: utflykt med en vuxen och mat, himlen mörknar, regn, skydd ”där det är torrt” (under bro / under gran), ”Regnet smattrar på …”, och det blir ändå mysigt | **Ersatt** av `lr-g3-hissen` ”Stopp i hissen” (vardag). Tiam och grannen Edvard fastnar i hissen, larmar och spelar kort medan de väntar |
| F3 | `lr-g3-vanten` | Nära dubblett mot nivå 5 `lr-n2-strumporna`, och samma lösning som `lr-g2-pusselbiten` | Ett husdjur samlar på sig saker som sin ”skatt” (hunden och vanten / kattungen och strumporna). Det blev tredje mysteriet där husdjuret är svaret | **Ersatt** av `lr-g3-musiken` ”Musiken genom väggen” (mysterier). Samma låt med samma fel varje kväll; Henny väntar i trappan och hittar nya grannen Asif som övar fiol |
| F4 | `lr-g2-snoskottning` q1 | Två alternativ kunde vara rätt | ”Hela natten” är rätt, men ”Sedan i går kväll” stämmer också med att det har snöat hela natten | Det felaktiga alternativet är bytt till ”Hela dagen” |
| F5 | `lr-g2-ljus-forr` q2 | Ett felaktigt alternativ kunde ses som rätt | ”Lampor” var fel svar, men texten säger att man senare tände fotogenlampor | Bytt till ”Lampor med el” |
| F6 | `lr-g2-lajka` | Faktatexten utelämnade något viktigt | Texten fick det att låta som att Lajka kom hem igen. Hon dog under färden | Meningen ”Men Lajka kom aldrig tillbaka till jorden.” är tillagd, i en lugn ton som passar åldern |
| F7 | `lr-g2-sista-biten` | Ett kön antogs och en mening hade fel ordföljd | Frågan sa ”pojkarna”, men texten säger aldrig att Deniz är en pojke. ”Nästan ramlar biten på golvet” är fel ordföljd | Frågan lyder nu ”Vad har Jacob och Deniz bakat?” och meningen ”Biten ramlar nästan i golvet.” |
| F8 | `lr-g1-ugglan` | Ljudet var engelskt | ”hoo, hoo” är engelska. På svenska skriver man ”hu, hu” | Ändrat i texten och i alternativet |
| F9 | `lr-g1-brandbilen` | Ett ”de” som inte syftade på någon | ”Med slangen sprutar **de** vatten”. Ingen person har nämnts | Ändrat till ”Ur slangen sprutar vatten på elden.” och frågan till ”Vad sprutar ur slangen?” |
| F10 | Nivå 1, 6 frågor | Svaret stod inte i texten | Spec: på nivå 1 ska svaret gå att hitta direkt i texten. Dessa ordfrågor krävde att man kunde ordet sedan innan: ”viftar”, ”tillsammans”, ”jublar”, ”fnissar”, ”fuktiga”, ”annorlunda” | Ersatta av frågor vars svar står i texten: `lashunden` q4, `tornet` q4, `forsta-malet` q3, `kakorna` q4, `ogonen` q3, `telefonen-forr` q4. ”Vad kallas en älgunge?” och ”Vad heter små barns tänder?” är kvar, eftersom svaret står i texten |
| F11 | `lr-g3-rymddrakten` q6 | Svaret byggde på ett ord som inte fanns i texten | Rätt svar var ”… har många **delar**”, men texten säger ”många **lager**” | Ändrat till ”Den är tung och har många lager” |
| F12 | Nivå 2, faktatexter | Långa meningar | Faktatexterna hade 7,2 ord per mening och meningar på upp till 13 ord. Det är längre än nivå 4:s berättelser (6,1) och för långt för ”korta och tydliga meningar” | Ett tjugotal meningar är delade eller förenklade (fjäril, sköldpadda, trana, blåbär, ubåt, grävmaskin, Merkurius, Lajka, ljus förr). Nu 6,6 ord per mening, max 11. Några långa meningar i berättelserna är också delade |
| F13 | Nivå 3, faktatexter | Svårare ordförråd än på nivå 4 | Faktatexterna hade LIX 23,0 mot 18,2 på nivå 4. Skillnaden kom från andelen långa ord, inte från meningslängden | Långa ord som gick att byta är bytta mot enklare: björk, tvätt förr, brevduva, delfin, fjordar, rymddräkt, svett och trafikljus. Exempel: ”elektricitet” → ”ström”, ”människor” → ”folk”, ”inomhus” → ”inne”. LIX är nu 21,4 |
| F14 | Nivå 3, längd | Längre än nivå 4 | Se *Stegring* | De längsta texterna är kortade (klasskaninen, dammen, knackningen, stenarna, trafikljuset). Ersättningstexterna är på 117–123 ord. Snittet är nu 115,5 ord |

### Kontrollerat utan anmärkning
- **Exakt ett rätt svar:** utöver F4 och F5 har jag inte hittat något alternativ som också stämmer med texten. Det finns inga dubblettalternativ efter trimning och normalisering (testerna kontrollerar detta).
- **Nivåkrav:** nivå 1 har 39–50 ord och 3–4 frågor. Nivå 2 har 64–80 ord, 5 frågor, och alla berättelser har början, mitt och slut. Nivå 3 har 108–123 ord, 6 frågor, och sambandsord (”därför”, ”sedan”, ”plötsligt”) finns i varje text, också i de tre nya.
- **Namn:** inga huvudpersoners namn förekommer två gånger i hela banken (nivå 1–10). Inte heller de nya namnen (Tiam, Edvard, Henny, Asif, Nora). Skriptet hittar bara ortnamn som delas (Sverige, Norge, Östersjön, Kalmar, Merkurius), och det är avsiktligt.
- **Faktauppgifterna stämmer.** Exempel: Merkurius är minst och ett år där är cirka 88 dygn. Ölandsbron är cirka 6 km. Skelettet har cirka 206 ben. Sognefjorden är cirka 205 km, alltså över tjugo mil. Rymddräkten (EMU) väger cirka 145 kg. Fjällharen har svarta örontoppar. Räven gör musehopp i snön. Ortoceratiter levde för cirka 470 miljoner år sedan.
- **Innehållet passar lågstadiet.** Lajka (F6) är det enda som rör döden, och det står lugnt och sakligt.

### Liknande teman som behålls (dokumenterade, ingen åtgärd)
- `lr-g2-mormors-nasa` (mormor lär sig videosamtal) har samma utgångsläge som `lr-n3-mormors-meddelanden` på nivå 6 (mormor lär sig emojier). Handlingen och skämtet är olika, och nivåerna ligger fyra steg isär.
- `lr-g3-klasskaninen` (klasskaninen gömmer sig hemma) och `lr-n4-vandrande-pinnen` på nivå 7 (en vandrande pinne rymmer i klassrummet) har liknande upplägg men olika handling.
- Sporttexterna har ofta samma båge: man övar och lyckas till slut (hopprepet, korgen, hjulningen, längdhoppet). Sporterna och vad som avgör är olika. Jag lät dem vara men nämner det.
- ”Förr”-texterna har olika ämnen: telefon, ljus, leksaker och tvätt på nivå 1–3, skolan på nivå 4 och kylskåp på nivå 5.

## Mätvärden per nivå (efter rättning)

`node admin/lasresan-granskning-matt.mjs`. Ord per mening räknas efter meningsslut (`.!?”`). Långa ord är ord med fler än 6 bokstäver. LIX = ord per mening + andelen långa ord i procent.

| | Nivå 1 | Nivå 2 | Nivå 3 | Nivå 4 (gamla 1) |
|---|---|---|---|---|
| Texter | 30 | 30 | 30 | 40 |
| Ord per text, min/medel/max | 39 / 43,6 / 50 | 64 / 71,8 / 80 | 108 / 115,5 / 123 | 87 / 97,7 / 109 |
| Ord per mening | 4,5 | 5,9 | 6,8 | 6,8 |
| Meningar över 6 ord | 11 % | 41 % | 54 % | 50 % |
| Långa ord (> 6 bokstäver) | 11 % | 12 % | 13 % | 11 % |
| LIX | 15 | 17 | 20 | 17 |
| Frågor per text | 3,8 | 5,0 | 6,0 | 6,0 |
| Ord per fråga | 4,4 | 5,0 | 5,6 | 5,9 |
| Andel slutsatsfrågor (mellan raderna och helhet) | 0 % | 6 % | 15 % | 24 % |
| Ordförståelsefrågor | 2 % | 6 % | 17 % | 16 % |
| A–D | 29/29/28/28 | 38/37/37/37 | 45/45/45/45 | 60/60/60/60 |
| Rätt svar unikt längst | 18 % | 19 % | 18 % | 24 % |

Uppdelat på berättelser och faktatexter (ord / ord per mening / LIX):

| | Nivå 1 | Nivå 2 | Nivå 3 | Nivå 4 | Nivå 5 |
|---|---|---|---|---|---|
| story | 44 / 4,0 / 12 | 72 / 5,5 / 16 | 116 / 6,3 / 18 | 100 / 6,1 / 17 | 124 / 6,8 / 21 |
| fact | 43 / 5,2 / 18 | 72 / 6,6 / 19 | 115 / 7,4 / 21 | 95 / 7,9 / 18 | 119 / 8,6 / 25 |

Före rättningen hade nivå 2 5,7 och 7,2 ord per mening (berättelser och fakta), och nivå 3:s faktatexter hade LIX 23,0.

## Stegring 1 → 2 → 3 → 4
- **Meningslängd, frågor och frågetyper ökar jämnt.** Meningslängden går 4,5 → 5,9 → 6,8 → 6,8. Antalet frågor går 3,8 → 5 → 6 → 6. Slutsatsfrågorna går 0 → 6 → 15 → 24 %. Övergången från nivå 3 till 4 sker alltså i frågornas svårighet, inte i texternas längd.
- **Texternas längd ökar inte jämnt: nivå 3 är längre än nivå 4** (115,5 mot 97,7 ord). Det beror på specen. §2 säger 100–140 ord för nivå 3, men gamla nivå 1 ligger på 87–109 ord. Även med kortade texter går det inte att komma under nivå 4:s snitt utan att bryta mot specen. Det är ingen plötslig ökning uppåt utan en liten sänkning: den som flyttas upp till nivå 4 får kortare texter men svårare frågor.
- **Ordförrådet i nivå 3:s faktatexter** (LIX 21) ligger fortfarande lite över nivå 4:s (18) men under nivå 5:s (25). Det som är kvar är mest ämnesorden själva (”delfinen”, ”svettkörtlar”, ”trafikljuset”), som inte går att byta ut.
- **Förslag (beslut för leaden eller Elias):** om nivå 3 ska vara tydligt lättare än nivå 4 i längd kan intervallet ändras till cirka 90–110 ord. Då behöver ungefär 20 texter kortas med 5–15 ord var, och `LEVEL_WORD_RANGES[3]` samt testet för nivå 3 ändras. Det är inte gjort här, eftersom det går emot spec §2.

## Ändrade filer
- `admin/lasresan-g1-story.mjs`, `admin/lasresan-g1-fakta.mjs`, `admin/lasresan-g2-story.mjs`, `admin/lasresan-g2-fakta.mjs`, `admin/lasresan-g3-story.mjs`, `admin/lasresan-g3-fakta.mjs` (källtexter)
- `src/lasresan/content/bank/level-1.json`–`level-3.json` (ombyggda)
- `docs/lasresan-10/plan-niva-3.md` (de tre ersatta raderna) och `plan-niva-1..3.md` (hänvisning hit)
- `admin/lasresan-granskning-matt.mjs` (nytt mätskript)
- Id som försvunnit: `lr-g3-visselpipan`, `lr-g3-picknicken`, `lr-g3-vanten`. Id som tillkommit: `lr-g3-fossilet`, `lr-g3-hissen`, `lr-g3-musiken`. Inga elevdata pekar på de gamla id:na, eftersom nivå 1–3 inte är driftsatta.
