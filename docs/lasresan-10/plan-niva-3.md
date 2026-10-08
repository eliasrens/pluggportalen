# Läsresan – plan nivå 3 (30 nya texter, issue #523, epic #516)

Nivå 3 = grundläggande läsförståelse: 100–140 ord, korta meningar (≈ 6 ord), enkla sambandsord (därför, sedan, plötsligt), 5–6 frågor (mest fakta, några ordförståelse, mellan raderna och helhet/slutsats). Brygga till nivå 4 (gamla nivå 1: 87–109 ord, 6 frågor, ≈ 7 ord/mening).
15 story + 15 fact. Id-prefix `lr-g3-`. Namnen är kontrollerade mot alla `level-*.json` och mot nivå 1-planen (0 träffar).

**Syskon (nivå 1 och 2):** ta inte dessa faktaämnen, premisser eller namn.

**Krockkontroll mot `plan-niva-2.md` (#522, committad före denna plan):** första versionen delade fjäril, blåbär, gran, skelett, Lajka, ljus förr, leksaker förr, saknad pusselbit och mormors videosamtal samt namnen Deniz, Amina och Felix med nivå 2. Allt detta är utbytt här; nivå 2 behåller sina.

## Story
| id | topic | titel | huvudperson(er) | handling |
|---|---|---|---|---|
| lr-g3-museet | skola | Vilse bland dinosaurierna | Ilias | Ilias tappar bort klassen på museet, minns regeln och går till informationsdisken |
| lr-g3-klasskaninen | skola | Kaninen på sommarlov | Arvin | Arvin har klassens kanin Smulan hemma på lovet; den rymmer i lägenheten och hittas i tvättkorgen |
| lr-g3-boken | relationer | Den lånade boken | Layla, Hodan | Layla lånar Hodans bok, lillebror spiller saft på den; Layla berättar sanningen och köper en ny |
| lr-g3-handslaget | relationer | Det hemliga handslaget | Melina, Aya | Vännernas hemliga handslag; Aya bryter armen, de hittar på ett nytt med armbågar och fötter |
| lr-g3-valpen | vardag | Valpen som inte ville sitta | Samuel | Samuel tränar valpen Kex att sitta, med tålamod och godis |
| lr-g3-fagelungen | äventyr | Ungen på gräsmattan | Esra | Esra hittar en fågelunge; mormor säger att de ska låta den vara; föräldrarna kommer och matar |
| lr-g3-badmintonen | sport | Badminton i blåsten | Khalid | Khalid spelar badminton med morfar, vinden tar bollen, de hittar på egna regler |
| lr-g3-langdhoppet | sport | Hoppet över linjen | Linn | Linn trampar över i längdhopp, tränaren lär henne räkna stegen, hon klarar ett giltigt hopp |
| lr-g3-picknicken | vardag | Picknick i regnet | Tea | Tea och pappa har picknick, regnet kommer, de äter under en bro och matar änder |
| lr-g3-dammen | äventyr | Dammen i bäcken | Darius | Darius bygger en stendamm i bäcken, ser en liten fisk som inte kommer förbi och öppnar dammen |
| lr-g3-knackningen | mysterier | Vem knackar på fönstret? | Leah | Det knackar på fönstret varje morgon; det är en talgoxe som hackar på sin egen spegelbild |
| lr-g3-vanten | mysterier | Vanten som vandrade | Mohammed, Joline | En röd vante dyker upp på nya ställen varje morgon; grannens hund Ruffen bär runt den |
| lr-g3-visselpipan | äventyr | Visselpipan | Pedro | Pedro kommer bort på bärplockning, stannar vid ett stort träd och blåser i visselpipan |
| lr-g3-korna | äventyr | Korna på vägen | Hawa | Korna har rymt ut på vägen; Hawa ringer bonden Ragnar och hjälper till att driva in dem |
| lr-g3-hatten | roliga situationer | Hatten som flög | Ismail | Pappas nya hatt blåser av på torget och landar i fiskdisken |

## Fact
| id | topic | titel | ämne |
|---|---|---|---|
| lr-g3-raven | djur | Räven i snön | räven: lya, ungar, hör möss under snön och hoppar |
| lr-g3-gravlingen | djur | Grävlingen i grytet | gryt med många gångar, vaken på natten, äter maskar, vilar mycket på vintern |
| lr-g3-delfinen | djur | Delfinen andas luft | däggdjur, andas genom hål, visslar, vilar halva hjärnan |
| lr-g3-snoharen | djur | Haren som byter päls | skogsharen: brun på sommaren, vit på vintern, stora fötter |
| lr-g3-bjorken | natur | Björken med vit bark | vit bark (näver), hängen på våren, sav, små frön |
| lr-g3-istapparna | natur | Istapparna | solen smälter snö på taket, vattnet droppar och fryser, farliga att gå under |
| lr-g3-stenarna | natur | Stenarna som blev runda | vågor och is slipar stenar runda på stranden |
| lr-g3-rymddrakten | rymden | Rymddräkten | ingen luft, kyla och hetta, syrgas i ryggsäcken, visir mot solen |
| lr-g3-trafikljuset | teknik | Rött, gult och grönt | trafikljuset: färgerna, givare i vägen, knappen för gående |
| lr-g3-blixtlaset | teknik | Blixtlåset | tänder som hakar i varandra, löparen, hur det uppfanns |
| lr-g3-tvatt-forr | historia | Tvättdagen förr | tvätta för hand, tvättbräda, bära vatten, skölja i sjön, torka på lina |
| lr-g3-brevduvan | historia | Brevduvan | duvor som hittar hem bar meddelanden förr, lappen i en hylsa på benet |
| lr-g3-fjordarna | geografi | Norges fjordar | isen grävde dalar, havet fyllde dem, branta berg, båtar |
| lr-g3-jasten | vetenskap | Varför degen växer | jäst är små svampar som äter socker och gör gasbubblor, värme hjälper |
| lr-g3-svetten | vetenskap | Därför svettas vi | kroppen kyls av svett, drick vatten |

## Resultat
- Byggs med `node admin/lasresan-g3-bygg.mjs` (källtexter i `admin/lasresan-g3-story.mjs` och `admin/lasresan-g3-fakta.mjs`, rätt svar först; skriptet balanserar positionerna seedat). Test: `test/lasresan-bank-niva3.test.js`.
- 30 texter, 15 story + 15 fact. 180 frågor, 6 per text.
- Kategorier: fakta 125, ordforstaelse 29, mellan_raderna 13, helhet_slutsats 13.
- Rätt svars position: A 45, B 45, C 45, D 45.
- Rätt svar unikt längst: 31 av 180 (17 %).
- Ordantal: min 108, medel 116,2, max 125. Ord per mening: medel 6,7, max 14 (nivå 4: 87–109 ord, 6,8 ord/mening, 6 frågor).
- Varje text har minst ett av sambandsorden därför, sedan eller plötsligt.
- Bipersoner: Birgit (lärare), Smulan (kanin), Musa (lillebror), Kex (valp), Kenneth (tränare), Joline, Ruffen (hund), Edit, Ragnar (bonde).
- Slutkontroll mot färdiga `level-2.json` (#522, f3b3b6f), `level-1.json` och nivå 4–10: 0 namnkrockar, 0 id-krockar, inga delade faktaämnen eller premisser.
- `validateBank` på hela banken: 0 fel, 0 varningar.
