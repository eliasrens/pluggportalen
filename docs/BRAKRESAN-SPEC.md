# BRÅKRESAN – SLUTLIG BYGGPROMPT TILL ELIAS AI-TEAM

Bygg en komplett ny modul i den befintliga Pluggporten: Bråkresan. Läs hela specifikationen innan ni börjar. Undersök först projektets kod, instruktioner, design och datamodell. Implementera sedan modulen hela vägen: elevvy, alla 50 utmaningar, matematiska modeller, hjälp, resultat, belöningar, Bråkdraken, inventory, elevhus, guldjakt och lärarstatistik. Detta är en implementation, inte en fristående prototyp eller en presentation av ett förslag.

## 1. Mål och prioriteringar

Bråkresan ska vara ett visuellt vackert, pedagogiskt och variationsrikt träningssystem för elever främst i årskurs 3–6. Eleven ska förstå vad bråk, decimaltal och procent betyder, kunna växla mellan representationer, jämföra värden, beräkna och resonera. Belöningarna stödjer träningen; de får aldrig skymma matematiken.

Prioritera i denna ordning:
1. Matematisk korrekthet och tillförlitlig svarskontroll.
2. Begriplig visuell förståelse och genomtänkt hjälp.
3. Välfungerande, tillgänglig interaktion.
4. Variation och kunskapsprogression.
5. Snygg sammanhållen grafik, drake och belöningskänsla.
6. Tillförlitlig integration, statistik och prestanda.

Samtliga punkter ingår i leveransen. Ordningen anger hur konflikter ska lösas, inte vad som får utelämnas.

Inspirationskällorna är flera likvärdiga kort som matchas ihop, och en lång lista med olika matematikutmaningar. Skapa egen formgivning och egna tillgångar. Återge inte andra spels grafik eller varumärken.

## 2. Låsta produktbeslut

- Exakt 50 utmaningar med stabila ID 01–50 och namn enligt avsnitt 8.
- En sammanhängande lista, med diskreta ämnesrubriker. Inga kartvärldar och inga låsta steg.
- Alla 50 utmaningar är tillgängliga från början. Ordningen är en rekommendation.
- Ingen automatisk nivåanpassning, inget krav att klara föregående utmaning.
- Exakt 10 bedömda uppgifter per omgång, även i kort-, sorterings- och flerstegsspel.
- Minst 8/10 rätt ger en stjärna, tills utmaningen har tre stjärnor.
- En ny stjärna ger 40 befintliga Pluggporten-mynt.
- Högst 150 stjärnor och 6 000 mynt från stjärnor.
- En bemästrad utmaning får repeteras fritt men ger inga fler stjärnor, stjärnmynt eller tröstmynt.
- Ingen timer, tidsbonus eller hastighetsranking.
- En personlig drake: ägg vid 0–9 stjärnor, kläckning vid 10, sedan 15 nivåer fram till 150.
- Manuell guldjakt en gång per svensk kalenderdag, tillgänglig från draknivå 1.
- Inga elevtopplistor i Bråkresan. Läraren följer lärandet genom statistik.

### Beslut om de tidigare öppna detaljerna

Implementera följande som standard; fråga inte om dessa rutinval innan ni bygger.

TRÖSTMYNT: Vid en avslutad omgång med 6–7 rätt får eleven 10 uppmuntransmynt om utmaningen ännu inte är bemästrad och eleven aldrig tidigare fått uppmuntransmynt för just den utmaningen. Högst en sådan utbetalning per elev och utmaning under modulens livstid, totalt högst 500. Vid 0–5 rätt inga mynt. Vid 8–10 rätt endast stjärnbelöningen, aldrig båda. Jaktmynt är separata. Texten ska säga ”10 mynt för ditt arbete” eller ”Uppmuntransmynt”, inte ”tröstpris”.

HJÄLP: Visuella ledtrådar och begreppsstöd får användas före svar och medför inget poängavdrag. Registrera användningen så att läraren kan skilja mellan självständiga svar och svar med stöd. Hjälpen får inte ange den aktuella uppgiftens slutliga svar före inlämning. Ett genomräknat exempel ska ha andra tal än den bedömda uppgiften.

BEDÖMNING: Det första giltiga svaret som eleven bekräftar med ”Kontrollera” låser uppgiftens rätt/fel-resultat. Eleven får ändra val och bygga om före kontroll. Efter ett fel får eleven bearbeta samma uppgift med stöd, men detta ändrar inte poängen. Fortsätt-knappen fungerar även om eleven ännu inte lyckats i bearbetningen. Inga extra bedömda uppgifter läggs till.

STJÄRNORNAS NIVÅ: Alla tre stjärnor avser tre nya godkända omgångar på samma matematiska nivå. Stjärna två och tre inför inte dold högre svårighet. Variera tal, situationer, kort och modeller, men behåll utmaningens mål.

## 3. Pedagogisk ram och avgränsning

Utmaningarna ska utveckla förståelse för del och helhet, likvärdighet, jämförelse, tal på tallinje, enkla beräkningar, decimalernas positionsvärde, procent och vardaglig problemlösning. Resonemang och rimlighetsbedömning ska återkomma på flera nivåer.

Årskursangivelserna är våra pedagogiska rekommendationer, inte individuella betygsgränser eller påståenden om exakt när alla elever måste behärska varje metod. Markera 38, 47 och 48 som ”Extra utmaning”, och 50 som ”Extra utmaning – blandade kluringar”. Enkla visuella varianter kan användas på mellanstadiet, men generell multiplikation/division med två bråk är inte modulens baskrav.

Bråkresan täcker sitt bråk-, decimal- och procentområde; den ska inte marknadsföras som hela matematikens centrala innehåll för årskurs 3–6. Fullständig träning av negativa tal, alla decimalalgoritmer, algebra och övrig matematik ingår inte. Inom de 50 utmaningarna ska dock tiondel/hundradel, del–andel–helhet, proportionalitet i enkla situationer och rimlighet synliggöras.

Referens för denna avgränsning: Skolverkets kursplan i matematik, särskilt centralt innehåll för årskurs 1–3 och 4–6. Kursplanen behandlar bland annat samband mellan bråk-, decimal- och procentform, positionssystemet, enkla beräkningar och proportionalitet. Specifikationens detaljordning och spelmekaniker är egna designbeslut.
Källa: https://www.skolverket.se/undervisning/grundskolan/laroplan-lgr22-for-grundskolan-samt-for-forskoleklassen-och-fritidshemmet/curriculums/LGR22/GRGRMAT01?hasSubjects=true&schoolType=GR&tosHeading=Kursplaner&v=5

## 4. Visuell riktning – gör förståelsen synlig

Skapa känslan av ett varmt, magiskt matematikverkstadslaboratorium med en charmig drake. Använd Pluggportens befintliga designspråk, med turkos, blått, lila och små gulddetaljer. Mjuka kort, läsbara rubriker, tydliga illustrationer och god kontrast. Grafiken ska kännas omsorgsfull och professionell, tilltalande även för årskurs 6. Undvik en plottrig instrumentpanel eller ett alltför småbarnslikt uttryck.

Lägg störst visuell omsorg på arbetsytan för matematiken. Illustrationen ska vara stor, tydlig och central, med kort instruktion direkt ovanför och svar/kontroll under. På mindre skärm ska dessa rymmas i en tydlig följd utan att verktyg flyter ovanpå figuren.

Använd riktiga matematiska modeller, helst parametrisk SVG/DOM. Matematikbilder får inte vara AI-genererade rasterbilder med inritade, opålitliga delningar eller siffror. Dekor och drake kan vara illustrerade bildtillgångar. Etiketter, andelar, skalor och delningar ska alltid skapas ur uppgiftens matematiska data.

### Gemensamma visuella regler

- Markera helheten uttryckligen, exempelvis ”Hela staven = 1”, ”Hela samlingen = 12 kulor” eller ”Hela priset = 200 kr”.
- Bråkdelar av en area har lika stor area. De behöver inte alltid ha identisk form. Grunduppgifter använder vanligen kongruenta delar; minst någon uppgift i 01 visar lika stora delar med olika form, med begripligt stöd.
- Cirkelsektorer använder exakt vinkel 360°/n; stavar exakt längd helhet/n; rutnätsceller lika stor area. Inga dekorativa skeva sektorer som påstås vara lika stora.
- Vid visuella storleksjämförelser har helheterna samma storlek och form när det är relevant. Om helheterna avsiktligt skiljer sig anges det och är själva uppgiftens poäng.
- Samma matematiska modell behåller helhetsstorlek och nollpunkt under omdelning, addition och förkortning.
- Tallinjer har linjär skala: x(v)=x0+(v-min)/(max-min)·bredd. Exempelvis är 1/4 på 25 % av sträckan från 0 till 1.
- En tallinje skiljer mellan antal delsträckor och antal markeringar: fyra delar behöver fem markeringar inklusive ändpunkter.
- Bråk större än 1 visas med flera lika stora helheter eller en skala som går över 1, aldrig genom att fylla mer än en enda cirkel.
- Konturer och mönster kompletterar färg. Rätt/fel ska aldrig förmedlas enbart med rött/grönt.
- Matematiktext visas som riktig text. Vågrätt bråkstreck, rätt baslinje och tydliga täljare/nämnare. För skärmläsare används exempelvis ”tre fjärdedelar”.
- Decimaler visas med svensk decimal­komma. Procent visas med mellanrum före %, multiplikation med · eller ×, division med ÷ där det förtydligar. Undvik x som multiplikationstecken.
- Förklaringsanimationer ska förändra modellen stegvis. Att bara glittra fram rätt svar är ingen pedagogisk animation.

### Komponentbibliotek som måste byggas och återanvändas

1. Bråknotation: vanligt bråk, blandad form, uttryck, jämförelsetecken och tillgänglig text. Bråkinmatning har separata fält för täljare/nämnare; blandad form har heltalsfält. Enter får kontrollera när inmatningen är giltig.
2. Bråkstav: indelning, markering, omdelning, gruppering, flyttbara delar, sammansättning och borttagning. Omdelning 1/2 → 2/4 visar hur varje gammal del delas, samtidigt som markerad total längd är oförändrad.
3. Bråkcirkel: exakta sektorer, klickval, avmarkering och flera helheter. Begränsa till läsbara nämnare, normalt högst 12.
4. Rektangel/rutnät: lika stora celler, grupperingskonturer, möjlighet att visa olika indelningar av samma area och tvåfärgad överlappning.
5. Hundraruta: 10×10, markerade hela rader/enskilda celler, synlig koppling 1 cell = 1/100 = 0,01 = 1 %. Radsvep och klick ska båda fungera.
6. Tallinje: varierande intervall, markeringar, bråketiketter, punkter, dragning och klickplacering. Snäppning till uppgiftens tillåtna rationella värden. Zooma aldrig om skalan så att den matematiska relationen försvinner.
7. Mängdbild: räkningsbara föremål, urval, gruppering i lika stora grupper, tydlig helhet. Identiska föremål i grunduppgifter; olikheter får inte antyda olika vikt om bara antal avses.
8. Matchningskort: blandade representationer, tydligt valtillstånd, ”välj tre”, parning och avvikande kort. Värde ska inte avslöjas av kortbakgrund, filnamn, ordning eller dekor.
9. Sorteringsyta: ordning och kategorier med både dragning och klick/kontroller. Kategorier visar inte automatiskt korrekt svar före kontroll.
10. Areal modell för produkt: lodrät och vågrät uppdelning, separata färger/mönster för två andelar och tydlig överlappning, alltid relaterad till ursprunglig helhet.
11. Hjälppanel: komponentnära ledtrådar, kort text, olika tal i genomräknade exempel, tydlig återgång till uppgiften.
12. Resultat och belöning: samma enkla språk och stjärnlogik i alla speltyper.

Varje komponent ska stödja responsiv storlek, tangentbord, pekplatta och touch. En draguppgift får inte kräva perfekt musprecision. Alla dragmål får klickalternativ. Normal klickyta minst cirka 44×44 CSS-pixlar; små hundraruteceller kompletteras av tangentbordsstyrning och val av rader/antal.

## 5. Omgång, bedömning och hjälp

### Före omgången

Visa namn, träningsmål, kort exempelbild och knappar ”Starta 10 uppgifter”, ”Prova ett exempel” och ”Tillbaka”. Exemplet är ett frivilligt, obelönat demonstrationsläge med andra tal. Det ändrar inte statistik, stjärnor eller jakt.

### Under omgången

Visa ”Uppgift 3 av 10”, tydlig instruktion, central modell, svarsyta, ”Kontrollera” och ”Visa hjälp”. Visa inga stressande nedräkningar. ”Fortsätt” är ett medvetet klick efter återkoppling, aldrig en snabb automatisk växling som avbryter läsningen.

Alla kort kan väljas/avväljas och alla drag kan göras om före kontroll. En ofullständig struktur är inte ett felaktigt matematiskt svar: vid två val när tre krävs säger gränssnittet ”Välj ett kort till” och låser inte bedömningen. Ogiltig notation, tomt fält eller nämnare 0 ger begriplig inmatningshjälp. Ett fullständigt giltigt men matematiskt fel svar räknas däremot som fel.

En uppgift kan innehålla flera sammanhängande delsteg. Dessa bildar ett enda av de tio resultaten. Då visas det från början vad som ska lämnas in, och alla obligatoriska delar måste vara rätt för ett rätt resultat. Använd inte dolda delpoäng. Spara gärna delsvar för lärarens analys men rapportera omgången konsekvent som 0–10 rätt.

Efter ett korrekt svar: kort bekräftelse och en begriplig koppling till modellen, exempelvis ”Ja! Tre av fyra lika stora delar är tre fjärdedelar.” Efter ett fel: ”Inte riktigt ännu”, aktuell modell, saklig förklaring av missförståndet, och möjlighet att bearbeta. Undvik skam, förlorade liv och straffljud.

### Hjälp i fyra steg

1. Orientering: peka ut helheten, vad som är givet och vad frågan gäller.
2. Princip: visa relevant begrepp eller operation i bild och kort text.
3. Modellering: visa ett motsvarande exempel med andra tal, eller föreslå en handling på elevens modell utan att ange slutresultatet.
4. Återgång: ”Nu provar du själv” och lämna den bedömda uppgiften olöst.

Stegen är möjliga ledtrådar, inte ett tvång att visa alla. Första grunduppgifterna kan ha två korta stöd. I hjälpen till en bildidentifiering får man exempelvis visa var helheten finns och hur delarna räknas, men inte skriva aktuellt facit. I additionshjälp får man omdela stavarna men inte automatiskt fylla i aktuellt slutsvar före inlämning.

Registrera hjälp före första kontroll separat från hjälp efter ett fel. Resultatet räknas likadant med hjälp, men lärarvyn visar exempelvis ”8/10 rätt, stöd använt i 4 uppgifter”. En stjärna betyder genomförd godkänd träning, inte bevis på full självständig behärskning.

### Avslutning

- 8–10 rätt, färre än tre tidigare stjärnor: ”Du klarade omgången! 8 av 10 rätt”, ny stjärna, +40 mynt, uppdaterad progression och eventuell evolution.
- 6–7 rätt: positiv men ärlig återkoppling: ”Du fick 6 av 10 rätt. Två rätt till behövs för en stjärna. Titta på hjälpen och prova en ny omgång.” Visa uppmuntransmynt endast om eleven verkligen får dem.
- 0–5 rätt: ”Bra att du tränade. Vi hjälper dig vidare”, två relevanta moment/utmaningar att prova och tydliga knappar. Ingen automatisk förflyttning.
- Repetition efter tre stjärnor: visa resultat och ”Repetition – du har redan alla tre stjärnor”, utan belöningslöften.
- Visa en genomgång av de felaktiga uppgifterna, utan att de blir nya poänggivande frågor.

Eleven kan lämna en omgång och återuppta exakt samma uppgifter och sparade resultat. Omladdning genererar inte ett nytt prov och nollställer inte första svar. En uttryckligt avbruten omgång ger inga belöningar; redan besvarade uppgifter sparas som delvis genomförd träning. Ingen belöning innan alla tio bedömts. Välj en tydlig ”Avsluta omgången”-funktion och låt normalt ”Tillbaka” spara för återupptagning.

## 6. Frågegenerering och matematikmotor

Matematik ska genereras deterministiskt från lagrade parametrar och kontrolleras med exakta rationella tal, inte med bildtolkning, fritext-AI eller ungefärliga flyttalsjämförelser.

Representera rationellt värde som heltal täljare/nämnare med positiv nämnare; använd största gemensamma delare för normalisering. Behåll dessutom uppgiftens presentationsform: 2/4 behöver visas som 2/4 även om värdet lagras som 1/2. Skilj värdelikhet från krav på skrivform. För 14 gäller angiven nämnare; för 21 enklaste form; för 28 begärd blandad form. Ett likvärdigt men formmässigt ofullständigt svar får tydlig förklaring.

För generella bråksvar accepteras matematiskt likvärdiga svar om uppgiften inte uttryckligen kräver enklaste form eller särskild representation. Exempel: 3/4 och 6/8 är båda rätt på ”Hur mycket är det?”, men endast 3/4 uppfyller ”Skriv i enklaste form”. Svenska decimaler visas med komma; inmatningen får acceptera både komma och punkt, samt onödiga slutnollor som 0,50. Procentkontroll och decimalomvandling ska bygga på samma exakta värde.

### Genereringskontrakt

Varje utmaning registreras med ID, namn, mål, rekommenderad nivå, extra-markering, kunskapstaggar, uppgiftstyper, tillåtna tal, generator, validator, renderer, hjälp och genomgång. Samma parametrar ger samma problem, illustration, korrekt svar och förklaring.

En uppgift innehåller minst: unikt ID, utmanings-ID, generatorversion, seed/parametrar, textmall, matematiska värden, representationer, tillåten svarstyp, bedömningsregel, eventuella korrekta val, hjälpsteg och missuppfattningstaggar. Facit och belöningsbeslut ska hållas i betrodd miljö enligt avsnitt 13.

Skapa de tio uppgifterna när omgången börjar och lagra deras identitet. För varje utmaning ska det finnas minst 60 kvalitetsgranskade meningsfulla uppgiftsvarianter och tillräckligt många mallar/parametrar för fortsatt variation. Enbart annan kortordning, färg eller namn räknas inte som ny matematik.

Inom en omgång: tio olika semantiska uppgifter. I de första tre belöningsomgångarna undviks samma matematiska kärna och facitstruktur från tidigare slutförda omgångar så långt den validerade banken medger. Säkerställ minst 30 olika kärnuppgifter för dessa omgångar. En misslyckad omgång får återkomma senare som repetition, men nästa omgång får inte bli en kopia. Ha begränsat antal försök att generera och en validerad reservbank, aldrig en oändlig genereringsloop.

Normalt fördelas tio uppgifter som tre introducerande, fyra normala och tre med lätt överföring till annan bild/situation inom samma mål. Ingen automatisk upp- eller nedflyttning baserat på eleven. Specifika blandningar i katalogen har företräde. Ingen uppgift får förutsätta ett senare begrepp utan förklaring; allt är fritt tillgängligt, så varje utmaning behöver en självständig introduktion.

### Alternativ, matchning och sortering

- Envalsfrågor har exakt ett matematiskt korrekt svar och olika värden på övriga alternativ.
- Kortuppgifter får ha flera likvärdiga kort när det är mekaniken. Definiera då exakt vilken vald grupp som godtas.
- I ”hitta tre” visas normalt sex kort: exakt tre representerar målvärdet, och övriga bildar ingen ytterligare trippel. Alla permutationer av samma tre val är rätt.
- I parning godtas varje parning som uppfyller samtliga värderelationer; tvinga inte ett godtyckligt kort-ID om flera kopplingar är korrekta. Generera helst unika parvärden.
- I avvikande-kort-uppgifter är exakt tre av fyra lika mycket och ett avvikande. Inga alternativa tolkningar av helheten.
- I sortering ska genererade värden vara olika om strikt ordning krävs. Om lika värden uttryckligen ingår godtas valfri intern ordning mellan dem.
- Färg, storlek på kort, placering eller ikon får inte systematiskt koda facit.
- Felalternativ bygger på identifierbara missuppfattningar och kontrolleras så att de inte råkar bli rätt för de valda talen.

### Tal och representationer

Grundnivån använder vanligen nämnare 2, 3, 4, 5, 6, 8 och 10. Nämnare 12 införs när modellen fortfarande är läsbar. Nämnare 20, 25, 50 och 100 visas företrädesvis med stav/rutnät, inte pyttesmå cirkelsektorer. Beräkningsuppgifter får gemensam nämnare högst 24 om inget annat anges. Samlingar är normalt 6–30 föremål, högst 36 i bild. Större antal behandlas genom grupper eller symbolisk mängd.

Decimalomvandling utan avrundning använder bara bråk med ändlig decimalutveckling inom aktuell precision. Efter förkortning består nämnaren då endast av faktorer 2 och 5. Använd inte 1/3=0,33 eller 2/3=0,67. Avrundning införs inte dolt. Procentuppgifter använder i grundläget exakta heltalsprocent. Undvik tvetydiga valutaavrundningar.

## 7. Så läses utmaningskatalogen

Varje punkt nedan är en bindande innehållsspecifikation. Den anger mål/nivå, spelmekanik, generering, bildmodell, svarskontroll, exempel och hjälp. Alla omfattas också av gemensamma regler ovan. Variation ska byggas inom målet; ersätt inte en angiven interaktiv mekanik med tio textbaserade flervalsfrågor.

I kort- och sorteringsspel räknas en färdig kortgrupp eller komplett sortering som EN uppgift. Spelbrädan återställs mellan uppgifterna. I en uppgift med tre matchade kort räknas alltså inte varje kort som en egen poäng.

## 8. De 50 utmaningarna

### Upptäck bråk – ungefär årskurs 3–4

### 01. Lika stora delar
Mål: Förstå att bråkdelar av en area måste vara lika stora. Mekanik: Tio bildrundor. I varje visas tre figurer; välj den som är delad i angivet antal lika stora delar. Blanda cirklar, rektanglar och stavar. Generera 2–6 delar, med lika area i rätt bild och verifierbart olika area i de andra. Minst två rundor frågar i stället om en enskild indelning är rätt eller behöver ändras. Visuellt: Jämför delar genom att flytta/överlappa i hjälpen; skeva gränser ska vara tydliga utan att vara karikatyrer. Kontroll: Exakt rätt figur eller korrekt ja/nej. Exempel: Vilken rektangel visar fyra lika stora delar? Hjälp: ”Fyra bitar räcker inte. Varje bit måste vara lika stor.” Minst en runda visar lika stora areor med olika form; förklaringen klargör att lika stor inte alltid betyder samma form.

### 02. Vilket bråk visar bilden?
Mål: Koppla markerade delar till täljare och alla lika delar till nämnare. Mekanik: Bild + fyra bråkkort. Generera a/n med 1≤a≤n, n∈{2,3,4,5,6,8,10}. Blanda cirkel, stav och rutnät; minst två uppgifter visar en hel. Kontroll: Värdet måste stämma; alternativens värden är olika. Exempel: Tre av fem lika stora stavdelar är markerade → 3/5. Visuellt: Tydlig yttre helhetskontur och gränser även i omarkerade delar. Hjälp: Peka på alla delarna, sedan de markerade, och visa ett annat exempel med täljare/nämnare. Felalternativ inkluderar ombytta tal och antal omarkerade delar när dessa verkligen ger andra värden.

### 03. Måla bråket
Mål: Konstruera given andel. Mekanik: Klicka/avmarkera delar i cirkel eller rektangel, sedan kontrollera. Generera nämnare 2–10 och täljare 1–n; modellen är redan indelad i n lika delar. Minst fyra uppgifter vardera med cirkel och rektangel, två fria variationer. Kontroll: Antalet markerade delar är a, oavsett vilka delar eleven väljer. Exempel: Måla 3/5 → valfria tre av fem delar. Visa inte automatiskt ”3/5 markerat” före kontroll eftersom det i detta identifieringsmoment avslöjar svaret; neutralt urvalsstöd kan visas. Hjälp: Markera helheten och förklara att nämnaren anger antalet lika delar. Efter kontroll kan modellen märkas med det bråk eleven faktiskt byggde.

### 04. Bråk med ord
Mål: Läsa och förstå bråkbenämningar. Mekanik: Matcha tre kort: symbol, svensk text och bild. Tre målkort samt tre distraktorer. Generera enkla a/n, n∈{2,3,4,5,6,8,10}; korrekt böjning ”en halv”, ”tre fjärdedelar”, ”två tredjedelar”. Kontroll: Alla tre val visar samma målvärde och den avsedda benämningen. Exempel: 2/3 ↔ två tredjedelar ↔ två markerade sektorer av tre. Visuellt: Rikta ordet för nämnaren mot indelningen, ordet för täljaren mot antalet markerade delar i hjälpen. Använd här huvudsakligen samma skrivna a/n, så att språkmålet inte kräver förlängning. Hjälp: Ett exempel med andra tal och uppläsningsvänliga etiketter.

### 05. Hitta helheten
Mål: Återskapa en helhet utifrån en given enhetsbråkdel. Mekanik: Eleven kopierar/drar den givna biten till en helhetsyta tills en hel byggts. Frågan anger ”Den här biten är 1/4 av en hel stav”. Generera 1/n, n=2–6, även samlingar i några rundor. Den tänkta helheten är bestämd av informationen; fråga inte hur stor helheten är utan given andel. Kontroll: n kongruenta bitar eller korrekt totalantal. Exempel: En bit på 1/3 kräver totalt tre sådana bitar, inklusive den första. Visuellt: Visa ursprungsbiten separat och ett byggområde; avslöja inte antalet med förritade platser. Hjälp: ”Hur många tredjedelar behövs för en hel?” med annan nämnare i demonstrationen. Förklara skillnaden mellan antal totalt och antal fler.

### 06. Hitta tre som hör ihop
Mål: Se samma andel i olika modeller. Mekanik: Välj tre av sex kort som visar lika mycket. En uppgift per komplett trippel. Generera enkla bråk och använd tre av symbol, cirkel, stav, rutnät och text. Här används samma synliga indelning snarare än avancerad likvärdighet. Kontroll: De tre kortens exakta värden är lika; endast en möjlig trippel. Exempel: 3/4, stav med tre av fyra delar, cirkel med tre av fyra sektorer. Visuellt: Ingen färgkodad familj; jämförbara helheter. Hjälp: ”Formen kan ändras, men hur stor del av helheten är markerad?” Låt eleven öppna två kort sida vid sida utan att få ett automatisk likhetssvar.

### 07. Bråk av en samling
Mål: Förstå andel av diskreta föremål. Mekanik: Räkningsbar samling och bråkinmatning; i några rundor markeras föremål först. Generera N=6–24, markerat antal k=1–N, med enkla reducerade värden. Kontroll: Alla likvärdiga bråksvar godtas, eftersom förkortning inte är kravet. Exempel: 4 av 12 kulor är blå → 4/12 eller 1/3. Modellen räknar kulor, inte färgad area; lika stora kulor underlättar. Hjälp: Omslut hela samlingen och visa ”del av alla”, därefter gruppera i lika stora grupper om det hjälper. Variation: föremålen flyttas och sprids utan att värdet ändras. Undvik överlappning eller dekor som kan misstolkas som ytterligare föremål.

### 08. Vilket kort är fel?
Mål: Granska representationer och upptäcka avvikelse. Mekanik: Välj avvikande kort bland fyra. Tre visar samma enkla bråk, ett annat. Generera n=2–8 och blanda symbol, text, cirkel, stav, mängd. Kontroll: Endast den avvikande värdeklassen godtas. Exempel: 1/2, ”en halv”, två av fyra kulor, stav med en av fyra delar → sista kortet avviker. Likvärdighet i bilder hålls här mycket konkret och kan jämföras genom överläggning. Hjälp: ”Jämför hur mycket av varje helhet som visas” och modelljämförelse utan utpekning. Efter svar visa varför tre hör ihop och vilket värde det fjärde faktiskt har.

### 09. Vilket är störst?
Mål: Jämföra bråk genom storlek, inte enbart siffror. Mekanik: Välj <, = eller > mellan två bildmodeller. Generera enkla bråk, främst samma nämnare eller jämförelser mot 1/2. Tio rundor inkluderar minst två likheter med olika indelning. Kontroll: Exakt rationell jämförelse. Exempel: 3/4 > 1/4; 1/2 = 2/4. Visuellt: Samma stora helheter, gemensam startpunkt på stavar, jämförbara cirklar. Hjälp: Lägg stavar ovanför varandra och följ markerad längd. Visa inte en automatisk storleksrangordning före kontroll. Introducera relationstecknen med kort text ”är större än” och tillåt klick på textalternativ.

### 10. Bråk i vardagen
Mål: Använda del–helhet i korta bildbaserade situationer. Mekanik: Fyra bilduppgifter med val, tre målningsuppgifter och tre enkla tal/bråksvar. Generera delad smörgås, band, gemensam frukt eller kulor, nämnare 2–6 och små heltalsmängder. Exempel: Ett band delas i fyra lika långa bitar. Två används. Vilken andel återstår? → 2/4 eller 1/2. Kontroll: Värde eller korrekt markering; likvärdiga bråk godtas. Visuellt: Visa den ursprungliga helheten och skillnad mellan använd och kvarvarande del. Hjälp: ”Frågar vi om det som används eller det som finns kvar?” Alla texter håller högst några korta meningar. Minst två frågor behandlar kvarvarande andel, utan att kräva senare beräkningsregler.

### Likvärdiga bråk och tallinjer – ungefär årskurs 3–4

### 11. Lika mycket – olika bilder
Mål: Förstå oförändrat värde vid olika indelning. Mekanik: Matcha fyra bildkort i två par; en komplett parning är en uppgift. Generera värden 1/2, 1/3, 2/3, 1/4, 3/4 och 1/5 med läsbara multiplar, nämnare högst 12. Exempel: Halvfärgad cirkel i två delar ↔ fyra av åtta markerade stavdelar. Kontroll: Varje par har samma värde; två olika parvärden. Visuellt: Samma area/längd för jämförda helheter; olika figurformer förklaras som andel av respektive helhet. Hjälp: Överläggning av två stavar eller omdelning av samma figur. Inga decimalsiffror eller procent ännu.

### 12. Hitta tre lika bråk
Mål: Upptäcka likvärdiga symboliska bråk, inspirerat av kortmatchning. Mekanik: Sex bråkkort; välj exakt tre som har samma värde. Generera reducerat basbråk med nämnare 2–6 och förlängningsfaktorer 1–5, presentationsnämnare högst 30. Exempel: 2/10, 20/100, 3/15 är en tillåten särskild variant med hundrarutestöd för 20/100; annars håll talen små. Kontroll: Endast en likvärdig trippel, övriga värden olika och inget dolt andravärde med tre kort. Visuellt: Varje kort kan få en jämförelsestav via hjälp, men inte en facitetikett. Hjälp: ”Dela samma helhet i fler delar. Hur ändras antalet markerade delar?” Ingen tidtagning eller tävling.

### 13. Dela bråkstaven
Mål: Se varför täljare och nämnare multipliceras med samma faktor. Mekanik: En markerad stav och instruktion att dela varje gammal del i k nya delar; eleven väljer delningsverktyg och fyller i det nya bråket. Generera a/n med n=2–6, k=2–4, ny nämnare högst 24. Exempel: 2/3, dela varje tredjedel i två → 4/6. Kontroll: Både omdelning och angivet bråk stämmer med begärd struktur. Visuellt: Gamla gränser behålls som kraftigare streck, nya tunnare. Markerad längd förblir exakt densamma. Hjälp: Följ en markerad gammal del och dess nya delbitar; förklara att fler bitar inte betyder mer innehåll.

### 14. Förläng bråket
Mål: Bestämma likvärdigt bråk med given nämnare. Mekanik: Fyll saknad täljare och välj/visa samma multiplikationsfaktor över och under bråkstrecket. Generera reducerad nämnare 2–10 och faktor 2–5, målnämnare högst 40; undantagsvis 100 med hundraruta. Exempel: 3/4 = ?/12 → 9/12. Kontroll: Angiven nämnare och rätt täljare; 3/4 som slutsvar uppfyller inte instruktionen. Visuellt: Omdelningsstav visas frivilligt men lätt tillgängligt. Hjälp: ”Hur många gånger fler delar blir det totalt? Gör samma förändring i de markerade delarna.” Visa en faktorberäkning med andra tal. Behåll begreppet lika mycket i återkopplingen, inte bara en regel.

### 15. Sortera bråkfamiljer
Mål: Organisera flera likvärdiga bråk. Mekanik: Dra sex kort till tre familjer med två kort per familj; alla sex sorteras innan kontroll. Generera tre olika reducerade värden och två förlängningar per värde, nämnare högst 24. Familjerna har ett ankarkort som symbol eller bild. Exempel: 1/2-familjen tar 2/4 och 3/6; 1/3 tar 2/6 och 3/9. Kontroll: Varje kort har samma värde som sitt ankare, ordning inom fack saknar betydelse. Visuellt: Facken skiljs genom position/etikett, inte värdekodande färg. Hjälp: Tillfällig jämförelsestav för ett valt kort och ankaret. Ge konkret återkoppling om en missortering efter kontroll.

### 16. Samma nämnare
Mål: Förstå jämförelse när delarna är lika stora. Mekanik: Välj relationssymbol och i tre av tio uppgifter även en kort korrekt förklaring. Generera nämnare 3–12, täljare 1–n och minst två likhetsuppgifter. Exempel: 3/8 < 5/8, eftersom fem åttondelar är fler lika stora delar än tre. Kontroll: Alla obligatoriska svar korrekta, en uppgift ger en poäng. Visuellt: Parallella stavar med gemensam helhet. Bilden är synlig på tre introduktionsuppgifter, frivillig på övriga. Hjälp: ”Delarna är lika stora. Vad skiljer?” Fel förklaringar kan vara ”större nämnare” när nämnaren faktiskt är densamma, men språket ska vara enkelt.

### 17. Samma täljare
Mål: Förstå att större nämnare ger mindre delar av samma helhet. Mekanik: Välj större/mindre/lika och i tre rundor korrekt bildförklaring. Generera samma täljare a=1–4, olika nämnare n,m>a med max 12, och enstaka likheter. Exempel: 2/3 > 2/5. Kontroll: Exakt jämförelse och eventuell förklaring. Visuellt: Samma helhetslängd; delarnas storlek framgår tydligt och båda markerar a delar. Hjälp: Dela ett lika långt band i tre respektive fem bitar och jämför en bit först. Undvik formuleringen ”större nämnare ger alltid mindre bråk” utan villkoret samma positiva täljare och samma helhet.

### 18. Vilken punkt är rätt?
Mål: Läsa bråk som tal och avstånd från noll. Mekanik: Välj en av fyra märkta punkter på tallinjen 0–1. Generera a/n med n=2–10 och synlig gradering i n eller en enkel multipel av n. Minst en uppgift med 0 och en med 1. Exempel: 3/4 ligger tre fjärdedelssteg från 0. Kontroll: Punktens exakta koordinatvärde, inte visuell pixelnärhet. Visuellt: Likstora delsträckor, läsbara ändpunkter, ingen extramarkering som avslöjar facit. Hjälp: Räkna mellanrum snarare än streck, med ett annat exempel. Visa att bråket anger en position och inte antalet färgade streck.

### 19. Placera på tallinjen
Mål: Konstruera bråkets position. Mekanik: Dra en punkt/bråketikett eller klicka på tallinjen och bekräfta. Generera nämnare 2,3,4,5,6,8,10, skala 0–1 och lämpligt snäppnät. Exempel: Placera 2/5 på linjen delad i fem lika sträckor. Kontroll: Snäppvärdet är exakt 2/5; alla tillåtna punkter går att nå med piltangenter. Visuellt: Pekaren följer eleven men värdeetikett före kontroll visar inte bråknamnet om det skulle lösa uppgiften. Minst tre rundor använder en finare indelning som också rymmer målvärdet, exempelvis fjärdedelar på åttondelsgradering. Hjälp: Nollpunkt, hela sträckan och antalet lika mellanrum.

### 20. Hälften, tredjedelen, fjärdedelen
Mål: Beräkna enhetsbråk av antal. Mekanik: Gruppera föremål i n lika grupper och ange antalet i en grupp. Generera n∈{2,3,4}, N=n·k, k=2–8, N≤24. Exempel: 1/3 av 18 äpplen → 6. Kontroll: Numeriskt antal; eventuell gruppfördelning måste vara jämn om den ingår i inlämningen. Visuellt: Flyttbara föremål och tomma gruppytor; inga förifyllda gruppstorlekar som avslöjar svaret. Hjälp: ”Dela hela samlingen i tre lika stora grupper. En tredjedel är en sådan grupp.” Blanda minst två korta vardagssituationer. Återkopplingen skiljer antal föremål från bråket som anger andelen.

### Jämföra, förkorta och större bråk – ungefär årskurs 4–5

### 21. Förkorta bråket
Mål: Se gruppering som motsats till omdelning och skriva enklaste form. Mekanik: Slå ihop lika många smådelar i en stav/rutnätsbild och skriv reducerat bråk. Generera basbråk med nämnare 2–10, förlängt med faktor 2–5, ursprunglig nämnare högst 40. Exempel: 6/8 → 3/4. Kontroll: Värdet är oförändrat och täljare/nämnare saknar gemensam faktor över 1. Flera förkortningssteg tillåts. Visuellt: Gruppera både markerade och alla delar med samma faktor; en grupp får inte delvis vara markerad i en modell som påstår en färdig förkortning. Hjälp: ”Hur många små delar kan bli en ny del?” Visa oförändrad markerad längd och varför 2/3 inte kan förkortas mer.

### 22. Det saknade talet
Mål: Resonera om likvärdighet i båda riktningar. Mekanik: Fyll ett saknat heltal i en bråklikhet. Fem täljar- och fem nämnaruppgifter, blandat förlängning/förkortning. Generera från ett känt basbråk och heltalsfaktor så att ett enda positivt heltal är rätt. Exempel: 2/3 = 8/? → 12; ?/15 = 2/5 → 6. Kontroll: Angivet heltal fullbordar exakt likhet och är tillåtet enligt mallen. Visuellt: Omdelningsstav och pilar mellan motsvarande tal kan öppnas. Hjälp: ”Vilket tal har ändrats och med vilken faktor? Samma förändring behövs på andra sidan bråkstrecket.” Undvik nollbråk i nämnaruppgifter, där svaret annars kan bli obestämt.

### 23. Bråkkompisar – blandade kort
Mål: Överföra likvärdighet mellan symbol, text, mängd och geometriska bilder. Mekanik: Välj tre av sex kort; minst två olika representationstyper och minst två olika synliga indelningar i trippeln. Generera värden med reducerad nämnare 2–8 och presentationsnämnare högst 24. Exempel: 2/3, fyra markerade av sex delar, åtta markerade av tolv kulor. Kontroll: Exakt gemensamt värde och unik trippel. Visuellt: Samlingens alla föremål tydligt avgränsade; stavens helhet märkt. Hjälp: Omgruppera föremålen eller omdela staven och jämför andel, inte rått antal markerade bitar. Ingen decimal/procent här; det är en integrationsutmaning för tidigare bråkmodeller.

### 24. Mer eller mindre än en halv?
Mål: Använda 1/2 som referens. Mekanik: Sortera sex kort i ”Mindre än 1/2”, ”Lika med 1/2”, ”Större än 1/2”. Generera bråk mellan 0 och 1, nämnare 2–12, med minst ett kort i varje kategori per uppgift. Exempel: 3/8, 2/4, 5/6. Kontroll: Varje korts exakta relation till 1/2; ordning inom fack fri. Visuellt: Hälftmarkering kan tändas på jämförelsestav i hjälp. Hjälp: ”Hur många delar skulle motsvara hälften?” Visa att 5/10 och 1/2 är samma gränsvärde. Efter kontroll får eleven se jämförelsen 2·täljare mot nämnare, men bildförståelsen kommer först.

### 25. Olika nämnare
Mål: Jämföra bråk med olika delstorlek. Mekanik: Välj <, = eller >; i tre rundor välj dessutom korrekt resonemang. Generera bråk 0–1 med nämnare 2–10, gemensam nämnare högst 24. Inkludera jämförelse via 1/2, omdelning och likvärdighet. Exempel: 2/3 > 3/5, eftersom 10/15 > 9/15. Kontroll: Exakt rationell jämförelse, båda obligatoriska svar krävs. Visuellt: Två lika långa stavar med omdelningsverktyg som inte förändrar helheten. Hjälp: ”Kan vi beskriva båda med lika stora delar?” Undvik korsmultiplikation som enda förklaring. Felalternativ fångar ”störst nämnare”, ”störst täljare” och felaktig jämförelse av olika stora helheter.

### 26. Sortera bråk i ordning
Mål: Jämföra flera värden samtidigt. Mekanik: Dra fyra bråkkort från minst till störst; alternativt flytta med knappar/tangentbord. Generera fyra olika värden mellan 0 och 1, nämnare 2–12, med läsbara jämförelser och gemensam nämnare högst 24. Exempel: 1/4 < 1/3 < 1/2 < 3/4. Kontroll: Hela ordningen, en poäng för en komplett korrekt ordning. Visuellt: Frivilliga jämförelsestavar; efter kontroll kan korten placeras på gemensam tallinje. Hjälp: ”Börja med det minsta. Vilka ligger på varsin sida om en halv?” Undvik att dragområdet automatiskt placerar korten rätt eller ger poäng för varje enskilt korrekt kort.

### 27. Mer än en hel
Mål: Förstå bråk större än 1. Mekanik: Växla mellan bygg upp a/n med flera helheter och identifiera bråket i en bild. Generera n=2–8 och a=n+1 till 3n, värde högst 3. Exempel: 7/4 = en hel och tre fjärdedelar. Kontroll: Byggd totalandel eller likvärdigt bråksvar, ännu inget tvång på blandad form. Visuellt: Flera lika stora cirklar/stavar, och tallinje 0–3 i några rundor. Hjälp: ”Fyra fjärdedelar fyller en hel. Hur många fjärdedelar finns kvar?” Nämnaren anger fortsatt delarnas storlek; den ökar inte när fler helheter tillkommer. Ingen bild får visa sju sektorer i en fyrdelad enda cirkel.

### 28. Blandad form
Mål: Växla mellan bråkform och blandad form. Mekanik: Fem uppgifter åt vardera hållet, med byggmodell och rätt inmatningsfält. Generera nämnare 2–10, heltalsdel 1–3 och 0<rest<n; minst två förkortningsbara rester. Exempel: 11/4 → 2 3/4; 1 2/3 → 5/3. Kontroll: Begärd representation; blandad forms bråkdel är mindre än 1 och i enklaste form när instruktionen anger det. Använd normalt ”Skriv i blandad form med bråkdelen förkortad”. Visuellt: Samla n smådelar till en hel eller bryt upp helheter. Hjälp: ”Hur många hela grupper om n delar? Vad återstår?” Visa att 2 3/4 betyder 2 + 3/4, inte 2·3/4.

### 29. Tre fjärdedelar av ett antal
Mål: Beräkna a/n av en mängd. Mekanik: Gruppera hela mängden i n lika grupper, markera a grupper och skriv antal föremål. Generera n=3–8, 1<a<n, N=n·k med k=2–10; N≤80, bild med alla föremål bara när N≤36. Exempel: 3/4 av 20 → 15. Kontroll: Numeriskt delantal, och korrekt antal valda grupper när det är en obligatorisk del. Visuellt: Gruppmodeller, band eller behållare med tydliga antal. Hjälp: ”Hitta en fjärdedel först. Hur mycket blir tre sådana grupper?” Variera med elevnära texter om böcker, kulor och deltagare. Jämför resultatet med helheten: en äkta andel måste ge färre än alla.

### 30. Kluriga andelar
Mål: Förstå del, andel, helhet och återstående mängd i två steg. Mekanik: Fyra uppgifter beräknar del, tre återstående antal och tre hela antalet från känd del. Generera små positiva heltal och andelar med nämnare 2–6; välj parametrar baklänges så alla antal blir heltal. Exempel: 3/4 av kulorna är 18. Hur många finns totalt? → 24. Exempel: 2/3 av 24 böcker lånas ut. Hur många står kvar? → 8. Kontroll: Slutantal med tydligt angiven enhet; stöd för delsteg utan dold extra poäng. Visuellt: Band med känt/okänt och markerad ursprunglig helhet. Hjälp: Identifiera vad som är givet, hitta en andelsgrupp och bygg helheten. Ingen omärkt ändring av helheten mitt i problemet.

### Räkna med bråk och decimaler – ungefär årskurs 4–6

### 31. Addera lika nämnare
Mål: Addera antal delar av samma storlek. Mekanik: Flytta två markerade stavbitar till en gemensam helhetsmall och skriv summan. Generera samma nämnare 3–12, positiva täljare, summa högst 1. Exempel: 2/7 + 3/7 = 5/7. Kontroll: Numeriskt rationellt värde; likvärdigt bråk godtas om enklaste form inte begärs. Byggresultat måste motsvara båda addenderna när byggandet bedöms. Visuellt: Addenderna har olika mönster, samma helhet och identiska delstorlekar. Hjälp: ”Det är fortfarande sjundedelar. Hur många sådana delar tillsammans?” Visa uttrycket som ett korrekt likhetsled, aldrig addera nämnarna. Två vardagsfrågor handlar om delar av samma ursprungliga band/helhet.

### 32. Subtrahera lika nämnare
Mål: Ta bort delar av samma storlek. Mekanik: Utgångsstav med a/n markerat; klicka bort b delar och skriv vad som återstår. Generera n=3–12, 0≤b≤a≤n, minst en uppgift ger 0. Exempel: 5/8 − 2/8 = 3/8. Kontroll: Exakt återstående värde och korrekt borttagning där den ingår. Visuellt: Borttagna delar markeras med kontur eller tonas bort; de försvinner inte tillsammans med helhetsramen. Hjälp: ”Vilken storlek har delarna som tas bort?” och annat exempel. Förklara efter svar att delarnas antal ändras, inte hur helheten är delad. Undvik negativa resultat i denna utmaning.

### 33. Hitta räknefelet
Mål: Upptäcka och förklara vanliga missuppfattningar innan svårare beräkningar. Mekanik: Granska en kort elevlösning, välj felsteg och korrekt bildförklaring; i några uppgifter är lösningen helt rätt. Generera tio rundor fördelat på addition/subtraktion med samma nämnare, likvärdighet och jämförelse. Exempel: ”1/5 + 2/5 = 3/10” → delstorleken får inte ändras så. Kontroll: Rätt felsteg eller ”inget fel” samt korrekt förklaring. Visuellt: Före/efter-stavar avslöjar om mängden bevaras. Hjälp: ”Stämmer räkningen med bilden?” Använd inte oförklarad addition av olika nämnare här; den kommer i 34. Ingen okontrollerad AI-bedömning av elevfritext; eventuellt frivilligt resonemang sparas för läraren.

### 34. Addera olika nämnare
Mål: Förstå och använda gemensam delstorlek. Mekanik: Omdela två stavar, fyll de två omskrivna bråken och summan. Generera nämnare 2–8 med minsta gemensamma nämnare ≤24, summan ≤1; minst tre par där en nämnare är multipel av den andra. Exempel: 1/2 + 1/4 = 2/4 + 1/4 = 3/4. Kontroll: Omskrivna bråk likvärdiga och samma nämnare, korrekt summa; annan gemensam nämnare godtas om inom verktygets läsbara intervall. Slutbråket får vara likvärdigt om förkortning inte uttryckligen begärs. Visuellt: Ursprungliga delgränser syns svagt efter omdelning. Hjälp: ”Gör bitarna lika stora innan du räknar dem tillsammans”, demonstrerat med andra tal. Inga felaktiga likhetskedjor.

### 35. Subtrahera olika nämnare
Mål: Subtrahera med gemensam delstorlek. Mekanik: Omdela utgångs- och borttagningsstav, markera borttagningen och skriv skillnaden. Generera nämnare 2–8, minsta gemensamma nämnare ≤24, första bråket minst lika stort som det andra, båda ≤1. Exempel: 3/4 − 1/6 = 9/12 − 2/12 = 7/12. Kontroll: Exakt skillnad; korrekt omdelning och borttagning när obligatoriska. Visuellt: Flytta en borttagningslängd mot samma helhet, inte hela olika referensstavar. Hjälp: Jämför delstorlekar, skapa gemensamma delar, ta bort rätt antal. Minst en uppgift ger noll med olika skrivna men likvärdiga bråk. Återkoppling får inte hävda att man alltid subtraherar nämnare.

### 36. Räkna över en hel
Mål: Räkna när flera helheter och bråkdelar behövs. Mekanik: Bygg addition/subtraktion på flera stavhelheter och ange svar i begärd form. Fem additioner och fem subtraktioner. Generera värden 0–3, nämnare 2–8, gemensam nämnare ≤24, icke-negativa svar. Minst fyra resultat är större än 1 och minst tre subtraktioner kräver att en hel bryts upp. Exempel: 3/4 + 3/4 = 1 1/2; 2 1/4 − 3/4 = 1 1/2. Kontroll: Värde och tydligt uttalat formkrav; använd huvudsakligen blandad form. Visuellt: Samla smådelar till hela stavar eller bryt en hel i nämnardelar. Hjälp: ”En hel kan skrivas som fyra fjärdedelar.” Ingen osynlig låning.

### 37. Multiplicera med heltal
Mål: Förstå heltal gånger bråk som upprepad addition. Mekanik: Bygg k lika kopior av en bråkstav, gruppera hela delar och skriv produkt. Generera k=2–5, bråk a/n med n=2–8, produkt ≤4. Exempel: 3·2/5 = 2/5 + 2/5 + 2/5 = 6/5 = 1 1/5. Kontroll: Exakt produkt; likvärdiga svar godtas om inget formkrav. Visuellt: Visa varje kopia mot samma helhet och sammansätt dem på flera stavramar. Hjälp: ”Tre gånger betyder tre lika stora portioner.” Minst två vardagsproblem använder längd eller volym. Förklara att multiplikation med ett heltal större än 1 här ökar en positiv mängd; generalisera inte detta till all multiplikation.

### 38. En del av en del – EXTRA UTMANING
Mål: Förstå bråk·bråk som andel av en andel. Mekanik: Markera först ena andelen i en rektangel, sedan en andel av den markerade delen, och skriv andel av den ursprungliga helheten. Generera två äkta bråk med nämnare 2–5, produktnämnare ≤20. Exempel: 1/2 av 3/4 = 3/8. Kontroll: Slutvärde och rätt överlappning av den ursprungliga arean. Visuellt: Ena indelningen lodrät, andra vågrät; två mönster och tydlig överlappning. Hjälp: ”Av vilken helhet är detta en halv? Hur stor del av den ursprungliga hela rektangeln blir det?” Visa varför produkten kan bli mindre än båda faktorerna. Aldrig två markeringar av hela ytan utan att förklara överlappningens betydelse.

### 39. Decimaler på bild
Mål: Förstå tiondelar, hundradelar och positionsvärde. Mekanik: Tre uppgifter målar decimal i modell, tre identifierar decimal, två jämför 0,3/0,30-likheter och två bygger decimal av heltal, tiondelar och hundradelar. Generera 0–2 med högst två decimaler; modeller över 1 har flera hela rutor. Exempel: 0,37 = tre tiondelar och sju hundradelar = 37/100. Kontroll: Exakt decimalvärde, valfri korrekt cellkonfiguration och korrekta positionsdelar. Visuellt: Stavdelar kopplas till hela rader i hundrarutan och enskilda hundradelar. Hjälp: ”En tiondel är tio hundradelar.” Minst två frågor prövar 0,5 mot 0,05. Avslöja inte målnumret i målningsmodellens automatiska etikett före kontroll.

### 40. Bråk till decimal
Mål: Omvandla exakta vanliga bråk till decimal och tillbaka. Mekanik: Fyra matchningsuppgifter, fyra inmatningar och två val av rimlig omvandling. Generera reducerade nämnare 2,4,5,10,20,25,50,100, värden 0–2, högst två decimaler. Exempel: 3/4 ↔ 0,75; 7/20 ↔ 0,35; 0,6 ↔ 3/5 eller 6/10. Kontroll: Exakt värde; alla likvärdiga bråk godtas om ingen form krävs. Visuellt: Omdela till tion-/hundradelar, använd hundraruta och tallinje. Hjälp: ”Kan bråket skrivas med nämnaren 10 eller 100?” Uppgifter med 1/8 och tre decimaler tillhör inte detta standardläge. Repetera att 0,50 och 0,5 är samma tal och att slutnollor inte ökar värdet.

### Procent och mer avancerade utmaningar – ungefär årskurs 5–6

### 41. Procent i hundrarutan
Mål: Förstå procent som hundradelar. Mekanik: Fem målningsuppgifter och fem identifieringsuppgifter, med hela rader, enskilda celler och ibland en enkel omgrupperad bild. Generera hela procent 0–100, med tyngd på 1,10,20,25,50,75 och 100 samt varierade mellanvärden. Exempel: 37 % motsvarar 37 av 100 celler. Kontroll: Antal celler eller korrekt procentvärde, alla lika stora cellurval godtas. Visuellt: Tio rader med tio celler; 10 % kan kopplas till en rad och 1 % till en cell. Hjälp: ”Procent betyder hundradelar.” Visa ett annat exempel, och låt eleven bygga aktuellt svar själv. Ingen sekundär timer eller poäng för effektiv målning.

### 42. Tre former – samma värde
Mål: Förbinda bråk, decimal och procent. Mekanik: Välj tre kort av sex, ett i varje form. Generera värden mellan 0 och 1 med heltalsprocent och ändlig decimal med högst två decimaler. Inkludera 0 och 1 i minst en runda vardera; övriga varierar. Exempel: 3/4, 0,75, 75 %. Kontroll: Ett kort av varje typ, samma exakta värde och unik trippel. Visuellt: Hundraruta eller stav kan öppnas som stöd; korten har neutrala bakgrunder. Hjälp: ”Hur många hundradelar visar varje kort?” Blanda vanliga bråk med mindre självklara, exempelvis 7/20, 0,35, 35 %. Visa korrekt likhetskedja efter svar.

### 43. Vilken passar inte?
Mål: Granska samband mellan fyra representationsformer. Mekanik: Fyra kort: bråk, decimal, procent, bild; välj avvikaren. Generera tre lika värden och ett annat, exakta högst två decimaler och heltalsprocent. Exempel: 1/4, 0,25, 25 %, bild med 50/100 markerat → bilden avviker. Kontroll: Unikt avvikande värde. Variation: Ibland avviker bråket, ibland bilden, ibland procent/decimal. Visuellt: Mängd- eller områdeshelhet alltid explicit. Hjälp: ”Beskriv korten som hundradelar eller på samma tallinje.” Felvärden kan använda 0,5/0,05, 25/75 eller 1/4/4/1 när inom vald uppgift. Kontrollera automatiskt att missuppfattningsalternativ inte sammanfaller med målvärdet.

### 44. Procent av antal
Mål: Beräkna procentdelen av ett känt antal. Mekanik: Sex taluppgifter med grupp-/bandmodell och fyra vardagssituationer. Generera främst 10,20,25,50,75 %, samt 5 % i de sista två rundorna. N väljs så delen är ett heltal, N≤200. Exempel: 25 % av 80 → 20; 75 % av 40 → 30. Kontroll: Exakt delantal, inte procentsiffra. Visuellt: Band eller grupper som motsvarar hela antalet; hundrarutan visar andelen men påstår inte att det faktiskt finns hundra föremål. Hjälp: ”25 % är en fjärdedel” eller ”Hitta 10 % först”. Rimlighetsfråga kan vara obligatorisk i två rundor: delen ska vara mindre än hela antalet när procenten är under 100.

### 45. Hur många procent?
Mål: Bestämma procentandelen när del och helhet är givna. Mekanik: Bild/situation med bråkuppställning och procentfält. Generera del k och helhet N≤100 där 100·k/N blir heltal; ha flera olika helheter, inte bara 100. Exempel: 6 av 24 elever → 1/4 → 25 %. Kontroll: Procentvärdet; bråkfält får innehålla k/N eller likvärdigt bråk. Visuellt: Gruppering och band med tydlig total, därefter motsvarande hundraruta. Hjälp: ”Vilket bråk av hela gruppen är delen?” Minst två uppgifter jämför samma antal delar i olika stora helheter, exempelvis 6 av 12 och 6 av 24. Klargör att samma antal inte alltid är samma procentandel.

### 46. Blandad storleksordning
Mål: Jämföra tal oavsett skrivform. Mekanik: Sortera fyra kort med minst ett bråk, ett decimaltal och ett procenttal; några uppgifter placerar därefter hela ordningen på tallinjen. Generera olika värden 0–1, nämnare som ger högst två decimaler, hela procent. Exempel: 20 % < 1/4 < 0,4 < 75 %. Kontroll: Exakt fullständig ordning och placering om den ingår i instruktionen. Visuellt: Gemensam tallinje 0–1 kan visa hjälpreferenser 0, 1/2, 1, men inte automatiskt omvandla korten före kontroll. Hjälp: ”Skriv två av talen i samma form. Vilket ligger närmast noll?” Inga strikt sorterade uppgifter med oavsiktligt lika värden.

### 47. Dela ett bråk – EXTRA UTMANING
Mål: Förstå bråk dividerat med ett positivt heltal som lika delning. Mekanik: Dela given markerad mängd i k lika portioner och skriv storleken på en portion av ursprungshelheten. Generera a/n, n=2–8, k=2–4, produktnämnare n·k≤24, främst fall där täljaren kan delas jämnt och några som kräver omdelning. Exempel: 3/4 ÷ 3 = 1/4; 1/2 ÷ 3 = 1/6. Kontroll: Exakt a/(n·k), eventuellt reducerat, och jämn fördelning. Visuellt: Dela hela den markerade längden, inte bara flytta ursprungliga bitar när de är otillräckliga. Hjälp: ”Vi delar tre fjärdedelar i tre lika stora portioner. Vilken andel av den första hela staven är en portion?”

### 48. Hur många får plats? – EXTRA UTMANING
Mål: Förstå division som mätning med en given bråkstorlek. Mekanik: Fyll en given längd med lika stora bråkbitar, skriv antal bitar. Generera positivt A≤2 och bitstorlek B mellan 1/2 och 1/8, A/B positivt heltal ≤8. Exempel: 1/2 ÷ 1/4 = 2, eftersom två fjärdedelar fyller en halv. Kontroll: Exakt antal, konsekvent referenshelhet och helt antal placerade bitar. Visuellt: Visa målsträckan och måttbiten på samma skala. Hjälp: ”Frågan är hur många bitar, inte hur stor varje portion blir.” Jämför med 47 i introduktionen. Generell reciprokregel och kvoter med rest är inte obligatoriska här; inga dolda halva måttbitar eller avrundningsfall.

### 49. Rabatter och procentproblem
Mål: Använda procent och skilja rabattbelopp från nytt pris. Mekanik: Fyra frågor om rabattens kronor, fyra om nytt pris, två om prisökning. Generera priser 40–800 kr och 10,20,25,50 %, välj kombinationer som ger hela kronor. Exempel: Pris 200 kr, rabatt 25 % → rabatt 50 kr, nytt pris 150 kr. Kontroll: Det som faktiskt efterfrågas, rätt belopp och eventuell obligatorisk rimlighetsbedömning. Visuellt: Prisband med ursprungspris, borttagen del och kvarvarande pris; ökning får en tillagd del med samma ursprungsbas. Hjälp: ”Vad är 100 % här? Frågar vi efter rabatten eller priset efter rabatt?” Ingen moms, ränta, successiva rabatter eller procentenheter i standardläget.

### 50. Mästarkluringarna – EXTRA UTMANING
Mål: Välja strategi, hantera flera steg och bedöma rimlighet. Mekanik: Tio olika problemfamiljer per omgång, parameteriserade med validerade exakta svar. Familjer: återstående bråkdel; del av en del; helhet från given del; jämförelse av olika stora helheter; procentdel + återstående antal; enkel rabatt + given budget; blandad längdberäkning; måttdivision; upptäckt av felaktigt resonemang; proportionalitet genom dubblering/halvering. Exempel: 3/4 av 24 kulor är röda. Hälften av de röda ges bort. Hur många kulor finns kvar totalt? → 15. Kontroll: Numeriskt/bråksvar plus högst ett tydligt strategi-/rimlighetsval; en poäng för hela uppgiften. Visuellt: Valbart band, samling eller stav. Hjälp: Identifiera helheten i varje steg och synliggör vad som förändras. Ingen godtycklig fritext-AI. Utmaningen är svår genom resonemang, inte långa texter eller stora tal. Alla tio familjer har minst sex meningsfulla validerade varianter.

## 9. Bråkdraken – identitet, 15 evolutioner och animation

Draken är modulens stora långsiktiga belöning. Skapa en egen igenkännbar fantasykaraktär i Pluggportens stil, med turkos grundfärg, blå/lila skuggor och gradvis ökande guldinslag. Den ska kännas vänlig, uttrycksfull och efter hand majestätisk. Ingen exakt kopia av en känd spelkaraktär.

Samma individ finns i Bråkresan och elevhuset. Utveckling ersätter utseendet på samma drake; den skapar inte femton inventoryföremål. Namn, drak-ID, jakthistorik och husplacering består.

### Nivåberäkning

Totala stjärnor S beräknas från summan av de femtio utmaningarnas stjärnor.
- S=0–9: ägg, ingen jakt och ingen utplaceringsbar drake.
- S≥10: nivå=min(15, floor(S/10)).
- Nästa nivå nås vid 10·(nivå+1), fram till nivå 15.
- Vid 150 visas ”Fullt utvecklad” i stället för ”0 stjärnor kvar till nästa nivå”.
- Äggets progress visar stjärnor kvar till 10, därefter intervallet mellan nuvarande och nästa tröskel.

### Formgivning av samtliga stadier

Storleksfaktorn nedan avser ungefärlig logisk kroppsstorlek relativt en häst i det befintliga huset. Anpassa till faktisk tillgångsstil, perspektiv och utrymme. Nivå 1 är cirka en sjundedel av slutstorleken; nivå 15 ungefär tre häststorlekar. Modellstorlek och skärmvisning är separata: huvudvyn får rama in hela draken utan att första nivån blir osynlig.

| Stadium | Stjärnor | Faktor mot häst | Karaktär och synlig förändring | Rörelse/effekt |
| Ägg | 0–9 | cirka 0,35 | Turkost ägg, lila skimrande mönster, liten guldruna. Vid 5–9 syns fina sprickor. | Lugn glöd, liten vickning, subtil puls. |
| 1 | 10–19 | 0,43 | Rund drakunge, stort huvud, kort svans, små vingknoppar, mjuk ljus mage. | Blinkar, andas, nyfiket huvudlut. |
| 2 | 20–29 | 0,50 | Två små hornknoppar, längre svans, tydligare öron/ansiktsprofil. | Svansvick och liten nosrörelse. |
| 3 | 30–39 | 0,60 | Små öppningsbara vingar med lila insida, första ryggfjällen. | Sträcker ena vingen, sätter sig. |
| 4 | 40–49 | 0,72 | Längre kropp och ben, fler ryggfjäll, blåare svansspets. | Tar ett litet steg, tittar omkring. |
| 5 | 50–59 | 0,86 | Tydlig ungdomsdrake, större vingar, första fina guldmarkeringen. | Kort vingfladder och stolt hållning. |
| 6 | 60–69 | 1,02 | Mer markerade horn, bredare bröst, första svansfenan. | Kontrollerad svanssväng, nospuff. |
| 7 | 70–79 | 1,20 | Vingspannet ökar, guldkant på vissa fjäll, mer uttrycksfull ansiktsform. | Vilar med hopvikta vingar, långsam blinkning. |
| 8 | 80–89 | 1,40 | Längre hals, ett sekundärt hornpar börjar synas, tydligare ryggkam. | Lugnt huvudlyft och vingsstretch. |
| 9 | 90–99 | 1,62 | Kraftigare ben, större svansfena, distinkta lila vingmönster. | Kort stolt resning, mild glöd i fjäll. |
| 10 | 100–109 | 1,85 | Vuxen drakform, stora men vikbara vingar, tydliga guldhornspetsar. | Ett sällsynt litet svävningslyft i huvudvyn. |
| 11 | 110–119 | 2,08 | Fler guldfjäll, magiska vinglinjer, starkare silhuett. | Få långsamma ljuspartiklar vid vingspetsar. |
| 12 | 120–129 | 2,31 | Fullt sekundärt hornpar, mer sammanhängande fjällmönster och svansornament. | Diskret magisk andedräkt, inte stor eldattack. |
| 13 | 130–139 | 2,54 | Majestätisk hals och huvud, rikare guldmönster, större vingsegel. | Långsam vingöppning och subtil aura. |
| 14 | 140–149 | 2,77 | Nästan legendarisk, tydlig kronlik hornstruktur, glödande runor i vingarna. | Ett sällsynt svep av ljus längs fjällen. |
| 15 | 150 | 3,00 | Legendarisk vuxen drake: full kronsilhuett, stora turkos-lila vingar, balanserade guldornament. | Ståtlig vilorörelse, sällsynt magisk gest och mjuk aura. |

Varje nivå ska kunna urskiljas genom form, detaljer eller pose, inte bara färgfilter och skalning. Det går att dela animationsteknik inom åldersfamiljerna unge 1–4, ungdom 5–9, vuxen 10–14 och legendarisk 15, men varje nivå behöver egen bildmässig identitet. Gör först en sammanhållen modellöversikt för alla stadier och håll ansikte, grundfärg och karaktär konsekventa. Denna interna designöversikt får inte ersätta fungerande nivåer i spelet.

Tillgångar ska ha transparent bakgrund där husrenderaren kräver det, korrekt pivot vid fötter/markkontakt, definierad logisk storlek och tillräcklig marginal för vingrörelser. Undvik hela bildrutor med stort tomrum som gör klickytan fel. Använd projektets befintliga sprite/animationsteknik eller lätta riggade delar; inför inte tung 3D enbart för draken.

### Kläckning och evolution

Vid exakt första övergången till 10 stjärnor registreras upplåsningen, inventoryföremålet skapas säkert och ägget kläcks i en fin cirka 3–5 sekunders animation. Eleven får välja namn eller använda ett standardnamn och byta senare. Namnval får inte blockera skapandet eller kräva omladdning.

Vid senare tiostjärnströsklar visas en evolution på cirka 2–4 sekunder: mjuk glöd, silhuettförändring, nya detaljer och nivåtext. Visa en ”Hoppa över”-knapp. Reducerad rörelse ersätter animationen med en lugn övergång. Progressionen sparas före effekten, så en avbruten animation inte orsakar förlorad belöning eller en ny drake.

### Draken i huset

- Återanvänd inventory, placering, flyttning och djurnamngivning.
- Draken blir utplaceringsbar från nivå 1, men behöver inte stå i huset för att jakt ska fungera.
- Nivåbyte uppdaterar den placerade individen utan att duplicera eller radera den.
- Ge vuxna drakar hopvikta vingar i normal huspose och lämplig visningsskala. Klickyta och placering ska fortfarande fungera i små hus.
- Försök bevara befintlig position. Om ny storlek gör platsen omöjlig, anpassa renderingsstorlek/ankare enligt husets regler och meddela begripligt; teleportera inte godtyckligt.
- Inget hunger-, skötsel- eller straffsystem. Draken minskar inte i nivå om eleven inte loggar in.
- Lågmälda tomgångsrörelser, ungefär en extra gest var 8–20 sekund. Andning kan vara kontinuerlig men svag. Anpassa till verklig enhetsprestanda.
- Förladda aktuell form; ladda andra nivåer och större animationer vid behov. Pausa rörelser när vyn är dold.

### Gemensam drakpanel

Klick i huset eller Bråkresan öppnar samma informationspanel: namn/redigera namn, nivå, stjärnor totalt, nästa tröskel, dagens jaktstatus, intervall för jaktfynd, genomförda jakter och totalt funna mynt. Nivå 15 har tydlig slutstatus. Äggpanelen visar kläckningsmål men ingen aktiv jaktknapp.

## 10. Daglig guldjakt

Jakten är en snabb, manuell aktivitet, aldrig en bakgrundsprocess. Den kan startas från drakpanelen i huset eller Bråkresan. Det är samma dagliga jakt, inte en jakt per vy.

Svensk kalenderdag i tidszonen Europe/Stockholm avgör tillgängligheten, med sommar-/vintertid. Det betyder en gång mellan två svenska midnätter, inte 24 timmar efter senaste jakt. Använd betrodd servertid; användarens ändrade klocka får inte ge fler jakter.

| Nivå | Slumpintervall, heltalsmynt |
| 1 | 1–10 |
| 2 | 1–20 |
| 3 | 1–30 |
| 4 | 1–40 |
| 5 | 1–50 |
| 6 | 1–60 |
| 7 | 1–70 |
| 8 | 1–80 |
| 9 | 1–90 |
| 10 | 1–100 |
| 11 | 1–120 |
| 12 | 1–140 |
| 13 | 1–160 |
| 14 | 1–180 |
| 15 | 1–200 |

Välj likformigt slumpmässigt ett heltal från 1 till och med maxvärdet i betrodd miljö. Även nivå 15 kan ge 1 mynt. Gör ingen dold utjämning, lyckoserie, insats eller betalning för omjakt. Nivån när jakten startar låser dagens intervall; en evolution senare samma dag ger inte en extra jakt.

### Säkert och begripligt jaktflöde

1. Eleven trycker ”Skicka på guldjakt”. Klienten låser knappen direkt medan begäran hanteras.
2. Betrodd funktion kontrollerar elev, upplåst drake, datum och tidigare jakt. En unik dagspost skapas, beloppet bestäms och mynt överförs exakt en gång i samma säkra operation eller motsvarande transaktionsflöde.
3. När resultatet är bekräftat visas en 3–6 sekunders animation: draken lyfter, flyger iväg och återkommer med kista. I huset kan den tonas ur tillfälligt, men inventory/placering tas aldrig bort.
4. Kistan öppnas och visar det redan fastställda fyndet. Statistik och saldo uppdateras från betrodd data. Vid reducerad rörelse visas fyndet direkt.
5. Status ”Dagens jakt är klar – tillbaka imorgon”.

Det är inte animationens slut som skapar pengarna. Vid omladdning eller nätavbrott hämtas samma jaktpost och samma fynd kan visas igen utan en ny utbetalning. Dubbla klick, två flikar och jakt från huset samtidigt med jakt från Bråkresan ger exakt en post och en överföring. Misslyckad begäran visar sakligt fel och säker återhämtning; ingen framgångsanimation när resultatet är okänt.

Spara jakt-ID, elev/drak-ID, svenskt datum, starttid, nivå vid start, maxvärde, fyndbelopp, valutatransaktions-ID och bekräftad status. Summeringar för antal jakter och funna mynt baseras på bekräftade poster. Ingen extra ”hämta belöning”-knapp krävs; utbetalningen är automatisk när den manuella jakten accepterats.

## 11. Elevvy och arbetsflöde

### Huvudvy

Överst: ”Bråkresan” med kort, begriplig introduktion. En kompakt översikt visar stjärnor X/150 och bemästrade utmaningar Y/50. En vacker drakpanel visar ägg/aktuell form, nivå, nästa mål och en liten ingång till jakt/statistik. På elevdator får draken gärna finnas vid sidan av sammanfattningen; på mindre skärm flyttas panelen ovanför listan. Den får inte ta upp hela första skärmen så att utmaningarna blir svåra att hitta.

Under detta finns en enda lång lista med alla 50 utmaningar, i föreskriven ordning. Lägg de fem ämnesrubrikerna som diskreta avdelare och använd korta ankarlänkar för snabb navigering. Låt eleven söka namn/moment och tillfälligt filtrera ”Alla”, ”Inte bemästrade”, ”Bemästrade” och ”Rekommenderade”. Standardläget visar alla, och ingen filtrering skapar låsta världar.

Varje rad/kort innehåller nummer, namn, egen relevant miniatyr av matematiken, en kort målmening, nivå/ungefärlig årskurs, eventuell Extra-markering och tre stjärnplatser. Status ska kunna läsas utan färg:
- ”Inte påbörjad”: ingen bedömd uppgift ännu och ingen aktiv omgång.
- ”Pågående omgång”: sparad omgång, exempelvis 4/10 svarade.
- ”Tränar”: har försökt men ännu ingen stjärna.
- ”1 av 3 stjärnor” eller ”2 av 3 stjärnor”.
- ”Bemästrad”: tre stjärnor och diskret mästarstämpel.

Bemästrad betecknar spelets trestjärnstatus. Beskriv inte automatiskt eleven som fullt kunnig utan hänsyn till stöd och resultat. Ett litet senare resultat kan visas men listan får inte bli en tabell av siffror.

Lärarrekommendationer syns som en liten etikett och en frivillig ”Börja här”-sektion som länkar till ordinarie listkort. De spärrar inte andra moment. Behåll listans läge och scrollposition när eleven återvänder från en utmaning.

### Utmaningsvy

Ingången visar ett konkret exempel och ”Här tränar du …”. Aktiva omgångar har ”Fortsätt din omgång”; en ny omgång kräver uttryckligt val om en gammal redan finns för samma utmaning. Håll högst en aktiv omgång per elev och utmaning, men eleven kan ha påbörjade omgångar i olika utmaningar utan att dessa försvinner.

Arbetsytan har lugn bakgrund, kort instruktion, stor matematisk modell och tydligt svar. Draken får vara en liten stödfigur men inte ligga över figurer, distrahera med ständig flygning eller berätta flera långa stycken. En enkel ordlista för täljare, nämnare, helhet, andel, tiondel, hundradel och procent kan nås från hjälp.

Använd befintlig uppläsningsfunktion om Pluggporten har en. Om sådan saknas måste åtminstone all text och notation vara tillgängligt strukturerad. Inför inte externa tjänster eller en ny AI-anropskostnad för att läsa vanliga instruktioner.

### Belöningskänsla

En ny stjärna fylls med kort ljusanimation och tydlig text. En liten myntanimation kan följa. Övergången till en ny draknivå får vara ett särskilt ögonblick, men normal träning ska inte stanna för långa scener. Ljud följer användarens befintliga inställningar och ska kunna stängas av. Inga autoplay-ljud om webbläsaren eller användarens inställningar hindrar dem. Ljudfrånvaro påverkar aldrig resultatet.

## 12. Lärarvy – praktisk undervisningsstatistik

Integrera under Pluggportens befintliga klass- och elevhantering. Visa endast elever läraren har behörighet till. Klassval, elevval och datumintervall ska fungera enligt projektets befintliga mönster.

### Klassöversikt

- Elevlista: namn, stjärnor/150, bemästrade/50, antal avslutade omgångar, första-svars-träffsäkerhet, stödanvändning och senaste aktivitet.
- Klassens sammanlagda stjärnor och antal bemästrade; visa även antal elever som ingår så summan kan förstås.
- Momentöversikt grupperad med kunskapstaggar, inte bara spelets namn.
- Utmaningar med många försök och låg träffsäkerhet samt utmaningar med goda resultat. Visa alltid underlag: antal elever och antal besvarade uppgifter.
- ”Inte tränat” är en egen status, aldrig 0 % rätt. Undvik slutsatser om klassens svårigheter när bara en elev svarat på en fråga. Standard för en tydlig klassindikator: minst tre elever och totalt minst 20 bedömda svar; mindre underlag kan visas neutralt med ”Litet underlag”.

### Matris

Elever i rader, de 50 utmaningarna i kolumner. Sticky namnkolumn, ämnesgrupper i kolumnhuvud och horisontell scroll på mindre skärm. Varje cell visar 0–3 stjärnor och symbol/status; färg är ett komplement. Klick öppnar elevens resultat för den utmaningen. Komprimera inte femtio kolumner till oläsbara prickar. Filtrering på ämne och fast nivåordning hjälper.

### Individvy

Visa totalt antal stjärnor, bemästrade, avslutade/avbrutna/aktiva omgångar var för sig, rätt/fel på första inlämning, träffsäkerhet, stöd före svar, progression över tid och senaste aktivitet. Utmaningslistan visar stjärnor, historiska omgångar, senaste och bästa resultat, samt försökt utan stjärna/inte försökt/bemästrad.

Varje omgång kan öppnas: datum, tio uppgifter med ursprunglig modell, första svar, rätt/fel, stöd före kontroll och efterföljande bearbetning. Återge rätt generatorversion så historiska bilder inte ändras när en uppgiftsmall senare förbättras. Om historikformatet behöver en lagrad presentationssnapshot, använd det.

Visa förslag på träning som tydligt baseras på resultat, exempelvis ”Öva likvärdiga bråk: 5 av 12 första svar rätt i 12 och 14”. Låt läraren själv tolka detta; skapa inte automatiska diagnoser eller betyg. Hjälpanvändning är information, inte ett fel eller straff.

### Exakta definitioner

- Ett bedömt svar är uppgiftens första giltiga inlämning. Övningskorrigeringar räknas inte en gång till.
- Träffsäkerhet = rätta första svar / alla bedömda första svar ×100. När inga svar finns visas ”–”.
- Visa total första-svars-träffsäkerhet, inklusive besvarade uppgifter i delvis genomförda omgångar, med tydlig etikett. Antal avslutade omgångar redovisas separat.
- Klassens sammanvägda träffsäkerhet bygger på summan av rätt och bedömda svar, inte oviktat medel av elevprocent. Om ett elevmedel visas måste det uttryckligen märkas som det.
- Stödanvändning före svar = andel bedömda uppgifter där eleven öppnade ledtråd före första kontroll. Registrera efterhjälp separat.
- Bemästrade = antal utmaningar med exakt tre stjärnor.
- Senaste aktivitet avser riktig sparad spelaktivitet, inte enbart öppnad startsida.
- Historisk repetitionsaktivitet får förbättra träningsöversikten men skapar inga nya stjärnor.

### Lärarfunktioner

Läraren kan förhandsgranska och testspela alla 50 utmaningar. Använd tydligt avskilt demonstrationsläge: inga elevresultat, mynt, stjärnor, draknivåer eller jaktdagar ändras. Testverktyget ska kunna byta seed/variant och visa facit/hjälp för granskning.

Läraren kan rekommendera en eller flera utmaningar till en elev eller hela vald klass, med valfri kort kommentar. En klassrekommendation gäller klassen enligt befintlig medlemskapsmodell och bör visas även för senare tillkomna elever så länge den är aktiv. Individrekommendationer kan tas bort. Rekommendationer är inte tilldelad svårighet, låsning eller ändring av belöning.

Implementera inte en elevåtkomlig stjärnredigerare eller en enkel statistikåterställning som låser upp mynt igen. Följ projektets befintliga administrativa rutiner om korrigering krävs.

## 13. Integration och säker datalagring

### Undersök först, återanvänd sedan

Identifiera verklig router, modulsystem, auth, elevidentitet, klassbehörigheter, backend/databas, valutafunktion, inventory, husrendering, djurnamn, grafik och testverktyg. Gör inga antaganden om ramverk eller databastyp. Återanvänd gemensamma funktioner; bygg inte parallella elevkonton, separat plånbok eller separat djurhus.

Dokumentera kort vilka befintliga delar ni använder och vilka ni behöver komplettera. Bråkresan ska nås naturligt från befintlig elev- och lärarnavigation. Namnet på den befintliga appen/varumärket ska följa kodbasen om det skiljer sig från denna text.

### Betrodd bedömning och valuta

Klienten får inte skicka ”jag fick åtta rätt”, ”lägg till 40 mynt”, ”nivå 15” eller ”dagens fynd 200” som auktoritativa uppgifter. Den skickar elevens giltiga svar till en betrodd validator. Auth, ägarskap, första inlämning, resultat och belöningsrätt kontrolleras i backend eller motsvarande serverfunktion.

Om projektet i dag saknar tillräcklig betrodd väg för belöningar, komplettera den med dess befintliga backendteknik. Om nödvändig servermiljö inte kan implementeras utan projektägarens medverkan, dokumentera det som blockerare och gör inte en manipulerbar klientlösning som påstås vara säker. Påbörja inte en godtycklig migrering av hela Pluggporten.

Alla myntutbetalningar ska använda befintligt valutabokföringsflöde med unikt händelse-ID. Stjärna, omgångens slutförande och valutakoppling ska uppdateras atomärt eller via robust idempotent transaktion enligt projektets arkitektur. Inte bara disabled-knappar.

### Logiska dataobjekt – anpassa namn till kodbasen

- Elevprogress per utmaning: stjärnor 0–3, status, referenser till tilldelade stjärnor, uppmuntransbelöning redan utbetald, senaste aktivitet.
- Omgång: ID, elev, utmaning, mode (elev/repetition/lärartest), version, starttid, status, tio uppgifts-ID/parametrar, svar, slutresultat, slutförandetid, belöningshändelse.
- Uppgiftssvar: uppgiftsindex, första giltiga svar, första bedömning, tid, stöd före svar, stöd efter fel, eventuell bearbetning. Slutresultatet härleds från de tio första bedömningarna.
- Belöningsbokföring: unikt händelse-ID, typ (stjärna/uppmuntran/jakt), mottagare, belopp, omgång/jakt, tidsstämpel och valutareferens.
- Drake: unikt personligt drak-ID, elev/ägare, inventoryreferens, namn, kläckningstid och eventuella visade evolutioner. Nivå härleds från stjärnor; om nivån cachas måste den hållas konsekvent.
- Jakt: en unik post per elev och svenskt kalenderdatum, enligt avsnitt 10.
- Rekommendation: lärare, mål-elev eller klass, utmanings-ID, eventuell kommentar, skapad/avslutad status.

Minimala invarianta regler:
- Unik första bedömning per omgång och uppgiftsindex.
- Högst tre stjärnbelöningar per elev/utmaning, med unikt stjärnordinal 1–3.
- Högst en stjärna från samma omgång.
- Högst en uppmuntransbelöning per elev/utmaning, inga efter bemästring.
- Unik jakt per elev/datum.
- Unik valutahändelse per belöning.
- En Bråkdrake per elev.
- 0≤totala stjärnor≤150 och korrekt nivåformel.

Säkerställ även samtidighet när två olika omgångar nästan samtidigt försöker tilldela tredje stjärnan. Låt betrodd transaktion avgöra faktisk stjärnordinal och maxgräns; respektera sparade belöningsbeslut vid återförsök. En omgångs status som repetition behöver inte ensam vara säkerhetsgaranti, eftersom stjärnläget kan ha ändrats i en annan flik.

### Nätverk och återhämtning

- Spara första svar löpande, inte först efter tio frågor.
- Visa ”Sparar …”/”Sparat” eller ett diskret motsvarande tillstånd. Bekräfta inte belöning innan betrodd operation lyckats.
- Om nätet försvinner får modellen fortfarande gå att undersöka, men nya bedömningar/belöningar ska inte bekräftas osäkert. Visa tydlig återanslutning och bevara elevens aktuella inmatning lokalt för försök igen.
- Vid återförsök används samma omgångs-/uppgifts-ID; inga dubbla svar eller mynt.
- Återuppta en sparad omgång med samma problem och redan låsta resultat.
- Ändringar av generatorer ska versionshanteras; en gammal aktiv omgång ska kunna slutföras med sina ursprungliga regler eller uttryckligen avbrytas utan förlorade intjänade belöningar.
- Lärartest får aldrig dela muterande elevoperationer av misstag. Behörighetskontroll sker på betrodd sida.

Lagra inga personuppgifter utöver vad den befintliga modularkitekturen behöver. Elevdata får inte vara offentligt läsbar genom en gissningsbar URL. Läsning och ändring av draknamn ska kontrollera ägaren och hantera text säkert.

## 14. Tillgänglighet och prestanda

Målet är vanliga elevdatorer och Chromebooks, med tangentbord, pekplatta och pekskärm. Kontrollera minst en mindre laptopvy, en normal laptopvy, en mobil/pekvy och förstoring i webbläsaren. Ingen viktig information får ligga utanför skärmen utan en begriplig scrolllösning.

- Använd semantiska knappar och fokusmarkering. Fokus ska flyttas begripligt efter kontroll/fortsättning och återgå efter stängd hjälp.
- Tangentbordsalternativ för målning, kortval, sortering och tallinjer. Skärmläsarbeskrivningar ska göra uppgiften användbar utan att oavsiktligt ge facit.
- Kontrast och läsbara storlekar. Ingen instruktion enbart som text i bild.
- Reducerad rörelse och avstängt ljud ska stödjas fullt ut. Ingen blinkande dekor.
- Undvik omfattande partikelsystem och ständiga samtidiga animationer. Husets drake får inte försämra befintliga husprestanda.
- Inga externa bild-/matematik-/AI-anrop per uppgift. Generering och matematikmodellering ska fungera med projektets egna tillgångar.
- Begränsa initial laddning till nödvändigt UI, aktuella komponenter och drakform. Lazyloada tunga drakstadier/testverktyg och statistikdetaljer.
- Lärarmatris laddas/beräknas effektivt; inga femtio separata databasfrågor per elev.

## 15. Kvalitetssäkring – matematik, bild och system

Det här är en stor modul med valuta och elevdata. Genomför meningsfulla automatiska och manuella kontroller, inte bara en lyckad build. Anpassa testverktygen till kodbasen. Brister ska åtgärdas innan leverans.

### Matematikmotor

Testa exakta operationer, normalisering, värdejämförelse, formkrav och inmatning. Exempel som ska passera:
- 2/4=1/2; 0,50=0,5; 25 %=1/4.
- 1/2+1/4=3/4.
- 3/4−1/6=7/12.
- 3·2/5=6/5=1 1/5.
- 1/2·3/4=3/8.
- 3/4÷3=1/4.
- 1/2÷1/4=2.
- 25 % av 80=20; 6 av 24=25 %; nytt pris efter 25 % rabatt på 200=150.
- 2/3=8/12 och 11/4=2 3/4.
- Nämnare 0 och ogiltiga tomma strukturer avvisas utan en registrerad felpoäng.
- 6/8 godtas på värdefråga om 3/4 men inte som färdig enklaste form när det begärs.
- 1/3 får aldrig behandlas som exakt 0,33.

### Generatorgranskning för alla 50

Skapa minst 200 deterministiska granskningsexempel per utmaning från olika seeds/parametrar, totalt minst 10 000. Samma kärnvariant kan ingå i olika testfall; detta ersätter inte kravet på minst 60 meningsfulla varianter.

För varje exempel verifieras tillåtna tal, korrekta svar, giltiga alternativa svar, unikhet när den krävs, mönsterfel, representationens andel och att förklaringen följer samma data. Tio-frågorsplanerna ska sakna semantiska dubbletter inom omgången. Kontrollera särskilt korttrippel, avvikande kort, sortering med lika värden och decimaltalens precision.

Testa både att korrekta svar godtas och att rimliga fel faktiskt avvisas. För målaruppgifter prova flera olika korrekta markeringsmönster. För tallinje prova klick, drag och piltangenter. För omdelning prova att helhetsstorlek och färgad total längd/area bevaras. I samlingar kontrollera att alla föremål räknas exakt en gång.

### Visuell och pedagogisk granskning

Granska manuellt minst en verklig speluppgift från varje utmaning och alla dess centrala mekanikvarianter. Granska dessutom första, normal och svåraste tillåtna bildfall för varje återanvändbar komponent. Kontrollera med skärmbilder att:
- Cirklar har exakta lika sektorer och inga tomma/vinkelfelaktiga kilar.
- Tallinjer har rätt skala, rätt antal mellanrum och läsbara etiketter.
- Helheter har konsekvent storlek vid jämförelse/beräkning.
- Förkortning och förlängning bevarar samma markerade värde.
- Hundrarutor har exakt 100 celler och korrekta kopplingar till decimal/procent.
- Produktens överlappning motsvarar rätt del av ursprungshelheten.
- Illustration, instruktion, svar och facit är samstämmiga.
- Hjälp före svar undervisar utan att fylla aktuellt facit; hjälpen efter fel förklarar det faktiska missförståndet.
- Varje uppgift går att förstå utan att läsa kod, och spelsättet varierar enligt katalogen.

Granska även startsidan med alla femtio kort, resultat med 0,6,7,8,10 rätt, trestjärnstatus, lärarmatris och drakpanel på flera skärmstorlekar. Alla femton drakformer ska visuellt kontrolleras i huvudvyn och i ett faktiskt elevhus, inklusive transparent kant, markkontakt, skala, klickyta och animation.

### Belöningar och gränsfall

- Omgången innehåller alltid exakt tio bedömda uppgifter, även kort-/sorteringsspel och flerstegsuppgifter.
- 7/10 ger ingen stjärna; 8/10 ger en; 10/10 ger fortfarande endast en.
- Två nya godkända omgångar ger två stjärnor; tre ger tre; fjärde ger inga fler mynt.
- Första giltiga svaret är låst; hjälp/bearbetning räknas inte som fler frågor eller ändrad poäng.
- 6/10 eller 7/10 ger uppmuntransmynt högst en gång per utmaning, med korrekt livstidsgräns.
- Avbrutna omgångar ger inga mynt. Återupptagna använder samma tio frågor.
- Dubbla knapptryckningar, omladdning under resultat och samtidiga flikar ger inga dubbla belöningar.
- Full progression ger exakt 150 stjärnor och 6 000 stjärnmynt. Uppmuntran/jakt redovisas separat.
- Testa draktrösklar 0,9,10,19,20,149,150; rätt namn och inventory-ID bevaras.
- Kläckning/evolution kan avbrytas utan att progression eller drake går förlorad.
- Jaktens alla min-/maxgränser inklusive nivå 11 och 15 testas. Fyndet väljs endast en gång.
- Jakt från huset och Bråkresan samtidigt ger en dagspost och en överföring.
- Svenska datum runt midnatt, sommartidsövergång och vintertidsövergång fungerar korrekt. Clientklockan påverkar inte tillgänglighet.
- En jakt precis före svensk midnatt och en precis efter kan vara två giltiga jakter på olika kalenderdagar; detta är avsiktlig policy.
- Lärartest och obehöriga anrop kan inte skapa elevbelöningar eller läsa andras resultat.

### Regression

Kör projektets relevanta lint-, typ-, build- och testkontroller. Verifiera särskilt befintlig inloggning, valuta, inventory, elevhus och navigation. Befintliga Läsresan, Mattematchen, livevyer och övriga moduler ska fortsätta fungera. Ändra gemensam kod bara när integrationen kräver det, med kontroller för påverkade flöden.

## 16. Genomförande för AI-teamet

Arbeta i tydliga etapper med en sammanhängande implementation och gemensamma kontrakt:
1. Kartlägg kodbas och befintliga instruktioner; fastställ integrationspunkter, behörigheter och valutatransaktioner.
2. Bygg matematikmotor, uppgiftsschema och visuella grundkomponenter. Verifiera en vertikal kedja med 03, 12, 19 och 34: generering → interaktion → hjälp → första svar → resultat → säker stjärna/mynt.
3. Implementera alla 50 med rätt mekaniker, innehållsgränser och varierade generatorer. Säkerställ att decimal/procent inte läggs ovanpå som enbart textkort.
4. Implementera huvudvy, återupptagning, drakprogression, de femton tillgångarna, inventory/hus och guldjakt.
5. Implementera lärarvyer, matris, historik, rekommendation och isolerat testläge.
6. Granska generatorer, bilder, pedagogik och tillgänglighet. Korrigera, testa integration och slutför leveransen.

Om arbetet fördelas mellan agenter ska de dela schema och komponent-API innan parallella ändringar. Utse tydligt ansvar för matematik, UI-komponenter, utmaningsinnehåll, drake/hus, data/valuta och integration/kvalitet. Integrationsansvaret får inte lämnas till sist. En agent ska inte på egen hand ersätta en beslutad interaktion med flervalsfrågor för att spara tid.

Gör självständiga rutinval enligt befintliga mönster. Om det finns en verklig konflikt med befintlig arkitektur eller en saknad nödvändig förutsättning, dokumentera problemet och föreslå minsta hållbara lösning. Dölj inte begränsningar bakom placeholderkort. En fungerande tidig delkedja är en arbetsmilstolpe, inte slutleveransen.

### Leveranskrav

Leverera körbar integration med:
- Alla 50 utmaningar spelbara och inga ”kommer snart”-rader.
- Ett sammanhållet visuellt komponentbibliotek som används i verkliga frågor.
- Relevanta exempel, ledtrådar och återkoppling för samtliga uppgiftstyper.
- Exakt tio uppgifter, korrekt första-svars-bedömning, trestjärnsgräns och säkra mynt.
- Ägg, kläckning, alla femton visuellt urskiljbara evolutioner och fungerande animation.
- Samma personliga drake i modul och inventory/hus, med namngivning och uppdatering.
- Manuell daglig jakt med korrekt slumpintervall och dubbleringsskydd.
- Klass-/individstatistik, matris, rekommendationer och isolerat lärartest.
- Responsiv/tillgänglig interaktion som fungerar på elevdatorer.
- Genomförda matematik-, generator-, integrations- och visuella kontroller.

I slutrapporten: ange konkret vad som byggts, hur man öppnar elev-/lärarvyerna, vilka kontroller som faktiskt körts och eventuella kvarvarande blockerare. Påstå inte ”allt testat” utan underlag. Skriv inga framgångspåståenden om ännu oimplementerade drakstadier eller statistikflöden.

## 17. Sista kvalitetsprincipen

En elev ska kunna se varför tre fjärdedelar är samma mängd som sex åttondelar, varför två bråk behöver lika stora delar innan de adderas, varför en halv av tre fjärdedelar blir tre åttondelar och varför 0,75 och 75 % hör ihop.

Det räcker inte att eleven klickar rätt och får en stjärna. Bilden, handlingen och det matematiska skrivsättet ska stödja samma förståelse. Bygg Bråkresan så att träningen känns lockande, att modellerna går att utforska och att drakens utveckling gör eleven stolt över arbetet.

Matematisk förståelse är alltid viktigast. Gör den både synlig och rolig.


