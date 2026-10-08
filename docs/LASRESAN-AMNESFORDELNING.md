# Läsresan — ämnesfördelning för innehållsbanken

## Aktuell bank: 280 texter, 40 per nivå (epic #482)

Banken utökades till 40 texter per nivå i epic #482. Planen och vinkeln för varje text finns per nivå, med id, titel, huvudperson och vinkel:
[`lasresan-bank40/niva-1.md`](lasresan-bank40/niva-1.md) · [`niva-2.md`](lasresan-bank40/niva-2.md) · [`niva-3.md`](lasresan-bank40/niva-3.md) · [`niva-4.md`](lasresan-bank40/niva-4.md) · [`niva-5.md`](lasresan-bank40/niva-5.md) · [`niva-6.md`](lasresan-bank40/niva-6.md) · [`niva-7.md`](lasresan-bank40/niva-7.md).
Helhetsgranskningen över alla nivåer (dubbletter, trappa, frågestatistik) finns i [`QA-LASRESAN-BANK40.md`](QA-LASRESAN-BANK40.md) (#514).

Varje nivå har 20 story och 20 fact. Antal texter per ämne:

| nivå | skola | vardag | mysterier | roliga sit. | relationer | äventyr | sport | djur | natur | historia | rymden | teknik | geografi | vetenskap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 4 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 5 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 6 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| 7 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| **totalt** | 21 | 21 | 21 | 21 | 20 | 21 | 15 | 21 | 21 | 21 | 21 | 21 | 21 | 14 |

**Regler för nya texter.** De gäller fortfarande, och #514 visade varför:
- Ett faktaämne (djurart, plats, händelse, uppfinning) finns på EN nivå. Sök i alla `level-*.json` innan du väljer ämne. Nivå 2 och 3 skrevs parallellt och fick sex identiska faktaämnen, som fick skrivas om.
- En berättelsepremiss finns på EN nivå. Ett gemensamt motiv går bra (till exempel ”första gången ensam”), men inte samma konflikt och lösning.
- Huvud- och bipersonernas namn är unika i hela banken. Använd inte namnen ur referenstexterna (Maja, Bosse, Erik, Helmer, Clara, Ines, Hussein, Leo, Mira, Amir, Nora).

---

## Historik: ursprunglig plan för de första 42 texterna (epic #404)


Lead-planerad fördelning av alla 42 texter så att inga ämnen/vinklar dubbleras.
Varje coder skriver bara sina egna nivåer, men läser HELA listan för att inte råka glida in på någon annans vinkel.

Spec (med de fyra referenstexterna i sin helhet): `/var/lib/barista/data/plugins/sessions/uploads/5a6cf25f-5ce2-404f-8230-6c5548f04f5b/BYGG_EN_NY_MODUL_I_PLUGGPORTALEN.txt` (§12–17, §24–25).

### Princip
- Specens 14 ämneskategorier används **exakt 3 gånger var** i banken, på tre olika nivåer.
- Berättande (story): skola, vardag, mysterier, roliga situationer, relationer, äventyr, sport.
- Fakta (fact): djur, natur, historia, rymden, teknik, geografi, vetenskap.
- Varje nivå: 3 story + 3 fact.
- Huvudpersonernas namn är förbestämda och unika i hela banken. Använd inte namnen ur referenstexterna (Maja, Bosse, Erik, Helmer, Clara, Ines, Hussein, Leo, Mira, Amir, Nora). Bipersoner får du hitta på, men undvik namnen i tabellen nedan.
- Föreslagna slugs (`lr-n{N}-{slug}`) får justeras, men de ska vara unika, korta, gemener, ascii (å→a, ä→a, ö→o).
- Vinkeln är en riktning, inte ett manus. Ändra detaljer fritt så länge ämnet och vinkeln håller.

### Nivå 1 (#405) — 60–110 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | vardag | Noah tappar en mjölktand vid frukosten, den försvinner, hittas till slut (t.ex. i yoghurten) | Noah | lr-n1-tanden |
| story | roliga situationer | Pappa går till jobbet i två olika skor, Alva upptäcker det | Alva | lr-n1-olika-skor |
| story | äventyr | Ebba sover i tält i trädgården, hör ett prasslande ljud, det är en igelkott | Ebba | lr-n1-taltet |
| fact | djur | Ekorren samlar och gömmer nötter inför vintern | — | lr-n1-ekorren |
| fact | rymden | Månen: varför den ser olika ut olika kvällar, den lyser inte själv | — | lr-n1-manen |
| fact | natur | Snö: hur snöflingor bildas, alla är olika, sexuddiga | — | lr-n1-snoflingor |

### Nivå 2 (#405) — 80–140 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | skola | Klassen får en fisk till akvariet och röstar om namnet, oväntat vinnarnamn | Lucas | lr-n2-klassens-fisk |
| story | mysterier | Någon äter farmors jordgubbar i landet, spår och ledtrådar, det är en koltrast | Wilma | lr-n2-jordgubbarna |
| story | sport | Yusuf vågar hoppa från kanten/startpallen på simlektionen för första gången | Yusuf | lr-n2-simhoppet |
| fact | teknik | Hur en cykel fungerar: pedaler, kedja, bromsar, varför den rullar | — | lr-n2-cykeln |
| fact | djur | Kejsarpingvinen: pappan håller ägget varmt på fötterna hela vintern | — | lr-n2-pingvinen |
| fact | historia | Förr fanns inga kylskåp: jordkällare, is från sjön, saltad och torkad mat | — | lr-n2-utan-kylskap |

### Nivå 3 (#406) — 120–190 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | relationer | Samira är ny i klassen och pratar lite svenska; Ella visar henne biblioteket, de hittar ett gemensamt intresse | Samira, Ella | lr-n3-nya-eleven |
| story | roliga situationer | Skolfotograferingen, alla ska sitta still, en geting stör och bilden blir oväntad | Hugo | lr-n3-skolfotot |
| story | äventyr | Kanottur på sjön, en paddel glider iväg, de måste lösa det tillsammans | Tindra | lr-n3-kanoten |
| fact | vetenskap | Varför flyter en stor båt men en liten sten sjunker | — | lr-n3-flyta-sjunka |
| fact | geografi | Världens öknar: inte bara sand och värme (stenöken, kall öken, Antarktis) | — | lr-n3-oknar |
| fact | historia | Vikingarnas skepp och resor: handel, inte bara plundring | — | lr-n3-vikingaskepp |

### Nivå 4 (#406) — 150–230 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | skola | Talangshowen: Oskars trolleritrick misslyckas på scen, han improviserar och publiken älskar det | Oskar | lr-n4-talangshowen |
| story | mysterier | En återlämnad biblioteksbok innehåller en gammal lapp/kod; Selma och Adam spårar vem som skrev den | Selma, Adam | lr-n4-lappen-i-boken |
| story | sport | Orienteringstävling: Elin springer fel, måste läsa kartan och tänka om | Elin | lr-n4-orienteringen |
| fact | rymden | Livet på rymdstationen ISS: sova, äta, träna, varför tyngdlöshet påverkar kroppen | — | lr-n4-rymdstationen |
| fact | teknik | Hur ett meddelande färdas från en mobil till en annan (master, kablar under havet) | — | lr-n4-meddelandet |
| fact | natur | Bin och pollinering: varför bin är viktiga för maten vi äter | — | lr-n4-bina |

### Nivå 5 (#407) — 180–300 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | vardag | Felicia är barnvakt åt lillebror Vide för första gången, strömmen går, hon hanterar oron, båda hans och sin egen | Felicia | lr-n5-stromavbrottet |
| story | relationer | Morfar har börjat glömma saker; Jonatan blir irriterad men förstår mer under en fisketur | Jonatan | lr-n5-morfars-minne |
| story | äventyr | Fjällvandring när dimman kommer, Aisha tar ansvar och följer rösena | Aisha | lr-n5-dimman |
| fact | vetenskap | Varför vi måste sova: hjärnan sorterar minnen och "städar", följder av för lite sömn | — | lr-n5-somnen |
| fact | geografi | Kiruna, staden som flyttar: gruvan, sprickor i marken, vad flytten betyder för invånarna | — | lr-n5-kiruna |
| fact | djur | Flyttfåglar: varför de flyttar och hur de hittar (sol, stjärnor, jordens magnetfält) | — | lr-n5-flyttfaglar |

### Nivå 6 (#408) — 220–380 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | skola | Elevrådet ska välja hur en summa pengar ska användas; Liv och Kevin har olika förslag, perspektiv och kompromiss | Liv, Kevin | lr-n6-elevradet |
| story | mysterier | Ljus i det övergivna stationshuset; Malte och Saga misstänker något, det visar sig vara en äldre man med en modelljärnväg (förutfattade meningar) | Malte, Saga | lr-n6-stationshuset |
| story | sport | Innebandykaptenen Nelly måste välja mellan att vinna finalen och att låta alla i laget spela | Nelly | lr-n6-finalen |
| fact | historia | Boktryckarkonsten: hur Gutenbergs tryckpress förändrade kunskap och samhälle | — | lr-n6-tryckpressen |
| fact | teknik | Hur datorer "lär sig" av exempel (AI), möjligheter och problem | — | lr-n6-larande-datorer |
| fact | rymden | Kan människor bo på Mars? För- och nackdelar som vägs mot varandra | — | lr-n6-mars |

### Nivå 7 (#408) — 280–500 ord
| typ | ämne | vinkel | huvudperson | slug |
|---|---|---|---|---|
| story | vardag | Två grannar bråkar om en gammal ek; Idun förstår att båda har rätt på olika sätt | Idun | lr-n7-eken |
| story | relationer | En elak bild sprids i klassens chatt; Arvid vet vem som skickade den, lojalitet mot vad som är rätt | Arvid | lr-n7-bilden-i-chatten |
| story | roliga situationer | Vera planerar den perfekta överraskningsfesten åt mamma, allt går fel, ironin och slutet ger ett nytt perspektiv | Vera | lr-n7-overraskningen |
| fact | natur | Invasiva arter: när en art hamnar på fel plats (t.ex. mink, spansk skogssnigel, lupiner), orsak och följder | — | lr-n7-invasiva-arter |
| fact | vetenskap | Hur vet vi att något är sant? Vetenskaplig metod, kontrollgrupp, placeboeffekten | — | lr-n7-vetenskaplig-metod |
| fact | geografi | Varför flyttar allt fler till städer? Urbanisering, orsaker och följder för stad och landsbygd | — | lr-n7-staderna |

### Kontroll: varje kategori 3 gånger
skola 2,4,6 · vardag 1,5,7 · mysterier 2,4,6 · roliga situationer 1,3,7 · relationer 3,5,7 · äventyr 1,3,5 · sport 2,4,6 ·
djur 1,2,5 · natur 1,4,7 · historia 2,3,6 · rymden 1,4,6 · teknik 2,4,6 · geografi 3,5,7 · vetenskap 3,5,7
