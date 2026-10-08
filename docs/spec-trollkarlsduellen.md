# UTVECKLINGSUPPDRAG: TROLLKARLSDUELLEN
## Ny avancerad projektorvy för Pluggportalens Live-läge

**Uppdrag till AI-utvecklingsteamet**

Bygg och färdigställ en helt ny livevy med namnet **Trollkarlsduellen**.

Detta ska vara den hittills mest ambitiösa, visuellt avancerade och underhållande projektorvyn i Pluggportalen.

Ni får stor kreativ frihet när det gäller grafik, karaktärsdesign, animationer, ljudeffekter och magiska detaljer. Däremot ska de funktionella kraven nedan följas noggrant.

**Detta är ett implementeringsuppdrag, inte ett uppdrag att enbart skriva en plan eller skapa en prototyp. Målet är en fullt fungerande, integrerad och testad livevy.**

Vi bifogar referensbilder av Rasmus och Elias som ska användas för karaktärerna.

---

# 1. ABSOLUT VIKTIGAST – BEVARA LIVE-SYSTEMET

Trollkarlsduellen är ENDAST en ny projektorvy till det befintliga Live-systemet.

Det befintliga Live-systemet ska fortsätta fungera precis som tidigare.

Behåll bland annat:

- Befintliga elevkonton och klasskopplingar.
- Befintlig lärarstyrd lobby och matchstart.
- Samma tidsbaserade tävling med 5, 10, 15, 20, 25 eller 30 minuter.
- Befintlig registrering av rätta och felaktiga svar.
- Befintlig beräkning av klassernas resultat.
- Befintlig hantering av klassernas genomsnittliga resultat och lärarens eventuella inställningar för elevantal.
- Befintlig nedräkning och tidshantering.
- Befintliga projektorvyer, exempelvis Raketrace, Dragkamp, Tornbygget och Drakmatningen.
- Befintlig hantering av deltagare som ansluter eller lämnar.

**VIKTIGT: Klassernas resultat och vinnaren ska avgöras med exakt samma poängmodell som övriga Live-systemet använder.**

Om den befintliga modellen använder klassens genomsnittliga antal rätt, ska även Trollkarlsduellen visa och använda detta genomsnitt.

Blanda inte ihop två separata värden:

1. **Matchpoäng:** Klassens officiella resultat enligt befintlig Live-logik. Detta avgör vinnaren.
2. **Magipoäng:** Klassens ackumulerade antal korrekta svar under matchen. Detta används endast för att ladda trollkarlens attacker.

Magipoängen får aldrig påverka matchställningen eller avgöra vinnaren.

Ingen separat hälsomätare, skadesystem eller egen vinstlogik ska införas.

Trollkarlsduellen är en spektakulär VISUALISERING av den befintliga tävlingen.

---

# 2. MÅLBILD – ETT LITET ANIMERAT DATORSPEL

Vi vill inte ha en enkel webbsida med två bilder som studsar lite.

Vi vill ha känslan av ett riktigt, välarbetat tecknat datorspel.

Föreställ er:

Två charmiga och ganska klantiga trollkarlar står i en magisk duellarena. De småbråkar, utmanar varandra, laddar trollstavar, reagerar på motståndarens attacker och råkar ut för mängder av komiska missöden.

Eleverna sitter med sina datorer och arbetar med multiplikation.

Varje korrekt svar bidrar till klassens magiska energi.

När energimätaren är full kastar klassens trollkarl en magisk attack mot motståndaren.

Under matchen kan det hända att:

- Rasmus förvandlar Elias till en höna.
- Elias får Rasmus att halka på ett bananskal.
- Rasmus blir en gråtande potatis.
- Elias blir instängd i en gigantisk såpbubbla.
- En liten drake flyger in och nyser rök över någon.
- Ett regnmoln börjar regna över den ena trollkarlen.
- En trollkarl blir tillfälligt en hoppande groda.

Sedan återgår de till sina vanliga former och fortsätter duellen.

Det ska hela tiden hända små saker som gör arenan levande, utan att den blir rörig.

**Målet är att eleverna verkligen ska vilja fylla sin klass magimätare för att se vilken attack som kommer härnäst.**

---

# 3. REFERENSBILDER OCH KARAKTÄRSDESIGN

Vi bifogar illustrationer av två personer:

- Rasmus
- Elias

Använd dessa som tydliga identitetsreferenser.

Skapa två riktiga helkroppsfigurer som trollkarlar i samma genomarbetade grafiska stil.

Det räcker INTE att klistra ett huvud ovanpå en generisk trollkarlskropp.

Ansikte, kroppsproportioner, klädsel och animationer ska fungera som en sammanhängande karaktärsdesign.

## 3.1 RASMUS – den kaotiske trollkarlen

Utseende som ska bevaras:

- Rufsigt, spretigt brunt hår.
- Svarta glasögon med ganska markerade bågar.
- Blå ögon.
- Kort brunt skägg/skäggstubb runt mun och haka.
- Uttrycksfullt ansikte.
- Stort leende.
- Tydliga arga och ledsna uttryck.

Personlighet:

Rasmus är energisk, lite övermodig och charmigt klantig.

Han kanske svingar trollstaven lite väl kraftigt, tappar nästan balansen när han kastar en besvärjelse eller gör överdrivet självsäkra segerposer.

Designförslag:

- Blå/turkos magi.
- Mörkblå trollkarlsmantel med färgglada detaljer.
- Lite sned trollkarlshatt som låter håret synas.
- Magisk stav med lysande kristall.
- Några stjärnor eller andra mystiska detaljer på manteln.

Dessa färger är förslag. Anpassa vid behov för bästa visuella helhet.

## 3.2 ELIAS – den elegante trollkarlen

Utseende som ska bevaras:

- Brunt, snyggt bakåtkammat hår med tydlig form.
- Runda guldfärgade glasögon.
- Blå ögon.
- Tydlig brun mustasch.
- Slätrakat på övriga delar av ansiktet.
- Uttrycksfulla ögonbryn.
- Ett självsäkert, något finurligt leende.

Personlighet:

Elias är lite mer kontrollerad, elegant och metodisk.

Han försöker se professionell ut, även när hans trollformler går fullständigt fel.

När han blir träffad kan han reagera med överdriven förvåning, irritation eller förtvivlan.

Designförslag:

- Lila/guldfärgad magi.
- Elegant lila trollkarlsmantel med gulddetaljer.
- Lite ståtligare hatt.
- Vackert utsmyckad trollstav.
- Något mer prydlig klädsel än Rasmus.

## 3.3 Gemensamma designkrav

Båda trollkarlarna ska:

- Vara fullfigurer.
- Ha armar, ben och kroppar som kan animeras.
- Vara tydligt igenkännbara.
- Ha samma övergripande illustrationsstil.
- Kunna visa olika ansiktsuttryck.
- Kunna förvandlas till andra figurer.
- Kunna utföra tydliga kroppsrörelser.
- Ha tillräckligt stora ansikten för att mimiken ska synas på projektor.

VIKTIGT:

Rasmus får aldrig av misstag få Elias runda guldglasögon eller mustasch. Elias får inte få Rasmus svarta glasögon eller skägg.

Även om samma animationssystem återanvänds måste deras utseenden vara konsekventa.

---

# 4. GRAFISKA ASSETS OCH ANIMATIONSTEKNIK

Detta är en särskilt viktig del av uppdraget.

Referensbilderna är startmaterial, inte färdiga spelkaraktärer.

Ni ska skapa eller integrera de bildresurser som faktiskt behövs för att få välanimerade trollkarlar.

Välj den animationslösning som fungerar bäst med projektets befintliga teknikstack.

Det kan exempelvis vara:

- Karaktärer uppbyggda i separata bildlager.
- Sprite sheets.
- 2D-riggade karaktärer.
- Canvas-animationer.
- SVG-baserade animationer.
- Annan etablerad webbanimationsteknik.

Ni får själva välja teknisk lösning.

Men den måste ge ett visuellt genomarbetat resultat.

**Viktigt: Förlita er inte enbart på CSS-rotationer och skakningar av två statiska helkroppsbilder.**

Vi vill se verkliga karaktärsrörelser med exempelvis:

- Armar som höjs.
- Trollstavar som svingas.
- Kroppar som lutar sig.
- Hattar och mantlar som rör sig.
- Ansikten som byter uttryck.
- Trollkarlar som hoppar, snurrar och faller.
- Figurer som förvandlas till andra varelser.

Om bildgenerering finns tillgänglig för teamet ska den användas för att skapa konsekventa karaktärsresurser.

Om den inte finns tillgänglig ska ni välja bästa möjliga tekniska metod och tydligt redovisa eventuella begränsningar.

Använd inte färdiga generiska figurer som helt saknar likhet med referenspersonerna.

---

# 5. MATCHINSTÄLLNINGAR – VÄLJ TROLLKARL

När läraren skapar en Live-match med Trollkarlsduellen som projektorvy ska det finnas en enkel inställning för att koppla trollkarlarna till klasserna.

Exempel:

**Klass 5E: Rasmus**

**Klass 4B: Elias**

Det ska också gå att byta:

**Klass 5E: Elias**

**Klass 4B: Rasmus**

Krav:

- Varje klass ska kunna tilldelas en trollkarl.
- Samma trollkarl får inte tilldelas båda klasserna i samma duell.
- Valet ska vara tydligt och enkelt.
- Valet ska sparas i matchens inställningar.
- Kopplingen ska vara konsekvent under hela matchen.
- Namn, poäng, magimätare, färger och animationer ska alltid följa rätt klass och trollkarl.
- Ingen klass ska vara permanent kopplad till en viss person.

Detta är en vy för dueller mellan två klasser.

Om Live-systemet tillåter fler klasser i samma match, ska befintlig funktionalitet för detta bevaras. Trollkarlsduellen ska då antingen kunna väljas för en tydligt definierad tvåklassduell eller begränsas till matcher med två klasser. Inför inga tysta ändringar av deltagande klasser.

Ändra inte övriga projektorvyers inställningar i onödan.

---

# 6. ARENA OCH SKÄRMLAYOUT

Skapa en visuellt imponerande magisk duellarena.

## 6.1 Miljö

Förslag:

En stor fantasysal eller magisk arena med:

- Stengolv.
- Lysande magiska symboler på golvet.
- Facklor eller svävande ljuskulor.
- Mystiska detaljer i bakgrunden.
- Stora valvbågar eller pelare.
- Mjuk magisk dimma.
- Små svävande partiklar och stjärnor.

Miljön får gärna innehålla subtila animationer även när ingen attack pågår.

Det ska kännas som en levande spelvärld.

Men bakgrunden får aldrig dominera över trollkarlar, poäng eller matchklocka.

## 6.2 Layout

Vänster sida:

- Trollkarl 1.
- Klassnamn.
- Aktuellt matchresultat.
- Magimätare.

Höger sida:

- Trollkarl 2.
- Klassnamn.
- Aktuellt matchresultat.
- Magimätare.

Centralt eller upptill:

- Stor matchklocka.
- Tydlig VS-markering.
- Eventuellt en diskret markering av vilket lag som leder.

Trollkarlarna ska vara tillräckligt stora för att animationerna verkligen syns.

Använd skärmytan effektivt.

Projektorvyn ska i första hand optimeras för 16:9-format och stora skärmar, men kunna anpassas till andra vanliga bildformat utan att viktig information klipps bort.

## 6.3 Tydlig ställning

Ställningen ska hämtas direkt från befintlig Live-logik.

Om resultatet bygger på klassens genomsnitt ska genomsnittet visas, gärna med en decimal enligt samma princip som befintliga Live-vyer.

Exempel:

5E – 24,6

4B – 22,3

Det ska vara tydligt vad siffrorna betyder.

Viktig information får inte försvinna bakom attackanimationer.

Matchklocka och ställning ska fortsätta vara läsbara under hela matchen, även när trollkarlarna förvandlas.

---

# 7. MAGIMÄTARNA

Varje trollkarl har en egen färgstark magimätare.

Mätaren ska visuellt representera klassens framsteg mot nästa attack.

**Standardinställning: 100 korrekta svar = en magisk attack.**

## 7.1 Uppladdning

När en elev i klassen svarar rätt:

- Klassens magimätare ökar med 1.
- Mätaren fylls mjukt och tydligt.
- Små magiska partiklar kan fladdra upp från mätaren.
- När den närmar sig full ska den börja glöda lite extra.

Exempel:

0/100 → 38/100 → 76/100 → 99/100 → 100/100.

Vid 100/100 sker följande:

1. Magimätaren lyser starkt.
2. Trollkarlens stav börjar glöda.
3. Trollkarlen gör en kort uppladdningsrörelse.
4. En slumpad magisk attack utförs.
5. Mätaren börjar laddas inför nästa attack.

## 7.2 Visuell kvalitet

Mätaren ska inte bara hoppa mellan siffror.

Använd snygga övergångar och effekter, till exempel:

- Lysande energivätska.
- Bubblor.
- Gnistor.
- Små magiska stjärnor.
- Pulsande ljus när attacken är redo.

Ge Rasmus och Elias olika färgteman.

## 7.3 Viktig poänglogik

Magimätaren ska baseras på klassens sammanlagda korrekta svar under aktuell match, inte klassens genomsnitt.

Exempel:

Vid 99 rätt är mätaren nästan full.

Vid 100 rätt triggas attack nummer 1.

Vid 200 rätt triggas attack nummer 2.

Vid 300 rätt triggas attack nummer 3.

Och så vidare.

Om flera rätta svar kommer samtidigt måste systemet hantera dessa korrekt.

Exempel:

Klassen går från 98 till 103 rätt.

Då ska exakt en ny attack registreras, samtidigt som nästa mätare redan har 3/100.

Systemet får inte tappa bort framsteg.

Attackräkningen ska härledas från den aktuella matchens bekräftade svar, så att omladdning av projektorvyn inte nollställer eller duplicerar attacker.

Ni får gärna göra attackgränsen konfigurerbar i matchinställningarna med exempelvis 50, 100 och 150 svar, men standardvärdet ska vara 100.

Detta är en valfri förbättring och får inte försena huvudfunktionen.

---

# 8. ATTACKSYSTEMET – MINST 15 OLIKA ATTACKER

Detta är en av projektets viktigaste delar.

Det ska finnas minst 15 visuellt olika magiska attacker.

Varje attack ska kännas som en egen liten komisk scen.

Det räcker inte att byta färg på samma projektil.

Varje attack ska ha:

1. En unik upptaktsanimation.
2. En tydlig magisk handling från den attackerande trollkarlen.
3. En synlig effekt som färdas eller uppstår hos motståndaren.
4. En rolig reaktion.
5. En tydlig återställningsanimation.

Attackernas effekter ska normalt pågå ungefär 2–5 sekunder, med utrymme för något längre specialanimationer.

## ATTACK 1: GRODIFIX!

Grodförvandling.

- Trollkarlen svingar sin stav.
- En grön magisk stråle flyger över arenan.
- Motståndaren förvandlas med ett tydligt magiskt POOF.
- En liten groda med motståndarens kännetecken dyker upp.
- Grodan hoppar runt ett par gånger.
- Sedan förvandlas den tillbaka till trollkarlen.

Behåll gärna något identifierande drag, exempelvis glasögon eller mustasch, även i grodformen.

## ATTACK 2: HÖNUS PANIKUS!

Hönsförvandling.

- En magisk virvel träffar motståndaren.
- Motståndaren blir en höna.
- Hönan flaxar panikartat och springer omkring.
- Fjädrar flyger åt alla håll.
- Den återgår till vanlig trollkarl.

## ATTACK 3: POTATUS TOTALUS!

Potatisförvandling.

- En brun/guldig magisk projektil träffar motståndaren.
- Motståndaren förvandlas till en stor rund potatis.
- Potatisen har ett komiskt ansikte och kanske glasögon.
- Den vaggar uppgivet från sida till sida.
- En magisk puff återställer trollkarlen.

Detta får gärna vara en av de allra roligaste attackerna.

## ATTACK 4: REGNUS MAXIMUS!

Personligt regnmoln.

- Ett litet mörkt moln materialiseras ovanför motståndaren.
- Kraftigt regn faller enbart på den trollkarlen.
- Han blir genomblöt och ser olycklig ut.
- Han försöker skydda sig med sin hatt eller trollstav.
- Molnet försvinner och trollkarlen skakar av sig vattnet.

## ATTACK 5: STINKUS MAXIMUS!

Stinkbomb.

- Attackerande trollkarl skickar iväg en bubblande grön bomb.
- Bomben exploderar i ett stort grönt stinkmoln.
- Motståndaren håller för näsan.
- Han viftar undan luften och vinglar.
- Molnet löses upp.

## ATTACK 6: BANANUS HALKUS!

Bananskal.

- Ett magiskt bananskal dyker upp på golvet.
- Motståndaren tar några ofrivilliga steg.
- Han halkar med benen sprattlande i luften.
- Han landar komiskt och ofarligt på rumpan.
- Han reser sig förvirrat och rättar till hatten.

## ATTACK 7: SLEMMUS BLÄÄÄUS!

Slimeattack.

- Trollkarlen kastar en stor kladdig slemboll.
- Bollen flyger över arenan.
- SPLATT!
- Motståndaren täcks av färgglatt slime.
- Han försöker torka bort slem från ansiktet.
- Slemmet glider av och han blir normal igen.

## ATTACK 8: FJÄDRUS STORMUS!

Fjäderstorm.

- En magisk liten tornado fylls med fjädrar.
- Den snurrar runt motståndaren.
- Han vifftar, nyser och försöker se genom fjädrarna.
- Tornadon försvinner.
- En sista fjäder landar på hans näsa och får honom att nysa igen.

## ATTACK 9: SNURRUS YRUS!

Snurrförbannelse.

- En magisk spiral träffar motståndaren.
- Han börjar snurra allt snabbare.
- Stjärnor och små spiraler syns runt huvudet.
- Han stannar och stapplar omkring några steg.
- Han återfår balansen.

## ATTACK 10: HATTUS GIGANTUS!

Jättehatt.

- En enorm trollkarlshatt faller ner från himlen.
- Hatten landar över motståndaren.
- Bara fötterna sticker fram.
- Hatten skakar och vinglar omkring.
- Motståndaren lyckas till slut krypa ut.

## ATTACK 11: BUBBLUS FLYGUS!

Såpbubbla.

- En gigantisk skimrande bubbla uppstår.
- Motståndaren fångas inuti.
- Han svävar sakta upp i luften.
- Han trycker händer och ansikte mot bubblans vägg.
- Bubblan spricker med ett stort PLOPP.
- Han landar mjukt och komiskt på marken.

## ATTACK 12: BLIXTUS HOPPUS!

Komisk blixt.

- Trollkarlen höjer sin stav mot skyn.
- En liten blixt slår ner intill motståndaren.
- Han hoppar rakt upp av förvåning.
- Håret står på ända och lite rök stiger från hatten.
- Han skakar på huvudet och återhämtar sig.

Ingen realistisk skada, enbart slapstick-humor.

## ATTACK 13: NYSUS MEGUS!

Förkylningsförbannelse.

- Ett rosa eller blått magiskt moln träffar motståndaren.
- Hans näsa börjar kittla.
- Han försöker hålla tillbaka en nysning.
- Sedan kommer en jättestor komisk ATJOOO!
- Hatten flyger tillfälligt av.
- Hatten landar tillbaka och allt blir normalt.

## ATTACK 14: DRAKUS MINIUS!

Mini-drake.

- En liten söt drake flyger in.
- Draken cirklar runt motståndaren.
- Den blåser en överdrivet stor rökring i ansiktet på honom.
- Trollkarlen hostar komiskt och blir lite sotig.
- Draken flyger iväg.

## ATTACK 15: STUDSUS MAXIMUS!

Studsförbannelse.

- Golvet under motståndaren börjar lysa.
- Han börjar studsa som på en studsmatta.
- Varje studs blir lite högre.
- Hatten och manteln hoppar med.
- Efter några studsar landar han mjukt, yr och förvirrad.

## EXTRA KREATIV FRIHET

Ni får gärna skapa ytterligare attacker, till exempel:

- En trollkarl som blir jätteliten.
- En trollkarl som får ett enormt huvud.
- Ett magiskt får som springer in och välter honom.
- Ett överdimensionerat snöbollskast.
- En trollkarl som fastnar i en geléklump.
- En magisk dansförbannelse.

Men de 15 huvudsakliga attackerna ovan ska prioriteras.

**KVALITETSKRAV:**

Varje attack ska innehålla visuellt igenkännbara moment. Exempelvis ska grodförvandlingen faktiskt visa en groda och såpbubbleattacken faktiskt visa en bubbla med trollkarlen inuti.

Ersätt inte specifika animationer med enbart färgblinkningar eller generiska skakeffekter.

---

# 9. SLUMPMÄSSIGA ATTACKER

När en magimätare är full ska en av attackerna väljas slumpmässigt.

Krav:

- Minst 15 attackvarianter.
- Samma attack ska helst inte väljas två gånger i direkt följd för samma trollkarl.
- Båda trollkarlarna ska kunna använda samtliga attacker.
- Attackens avsändare och mottagare ska alltid bli rätt.
- Animationer ska återställas ordentligt efter genomförd attack.

Skapa ett tydligt attackregister där varje attack har ett unikt ID och definierade animationer, ljud och varaktighet.

Detta ska göra det enkelt att lägga till fler attacker i framtiden.

---

# 10. KARAKTÄRERNAS GRUNDANIMATIONER

En mycket viktig del av upplevelsen är att trollkarlarna känns levande även mellan attackerna.

De ska inte stå helt stilla i flera minuter.

## Grundanimationer

Skapa bland annat:

- Lugn andning.
- Blinkningar.
- Små huvudrörelser.
- Mantlar som rör sig lite.
- Trollstavar som glöder eller rör sig.
- Små viktförskjutningar.
- Blickar mot motståndaren.
- Små otåliga fotrörelser.

## Slumpmässiga småhändelser

Lägg gärna till ett antal komiska idle-animationer som aktiveras ibland.

Exempel:

- Rasmus försöker trolla fram något ur hatten men får bara en liten rökmolnspuff.
- Elias putsar stolt sina glasögon.
- Rasmus tappar nästan trollstaven och fångar den i sista sekunden.
- Elias rättar till manteln och ställer sig extra självsäkert.
- En liten magisk fjäril flyger förbi.
- En trollkarl får en stjärna på näsan och nyser.
- En trollkarl tittar på motståndaren och gör en utmanande gest.

Dessa ska vara relativt sällsynta, korta och subtila.

De får aldrig störa en aktiv attack.

---

# 11. ANIMATIONSTILLSTÅND OCH PRIORITERING

Båda karaktärerna ska ha ett genomtänkt animationssystem.

Minst följande tillstånd ska hanteras:

- IDLE
- IDLE_VARIATION
- CHARGING
- CASTING
- ANTICIPATING_HIT
- HIT
- TRANSFORMED
- RECOVERING
- VICTORY
- DEFEAT

Lägg gärna till fler om det förbättrar animationerna.

## Viktig teknisk princip

En trollkarl ska inte samtidigt kunna vara exempelvis groda, snurra i luften och kasta en ny trollformel på ett sätt som förstör vyn.

Skapa därför ett system för animationsprioritering.

Exempel:

1. Matchfinal har högst prioritet.
2. Aktiv attack och träffreaktion har hög prioritet.
3. Uppladdning har lägre prioritet.
4. Idle-animationer har lägst prioritet.

Om flera attacker triggas tätt inpå varandra ska de köas eller hanteras sekventiellt.

De får inte försvinna eller skapa trasiga animationstillstånd.

Poängräkning och magiladdning ska däremot fortsätta i bakgrunden utan att blockeras.

---

# 12. LJUDDESIGN

Vi vill gärna ha riktiga ljudeffekter.

Ljuden ska passa den tecknade, humoristiska stilen.

## Exempel på ljud

- Magisk uppladdning.
- Glittrande trollformler.
- Svischande magiska projektiler.
- POOF vid förvandling.
- Kvackande groda.
- Kacklande höna.
- Komiskt halkljud.
- Bubblor som spricker.
- SPLATT vid slimeattack.
- Komisk blixt.
- Draken som nyser.
- Trollkarlar som reagerar.
- Jubel vid seger.
- Ett kort magiskt segerfanfar.

## Ljudkrav

- Ljud ska kunna slås på och av i lärarens projektorvy.
- Ljudvolymen ska vara behaglig i ett klassrum.
- Flera ljud får inte orsaka kaotiskt överlapp.
- Ljud ska startas enligt webbläsarens regler för användarinteraktion.
- Om ljud inte kan spelas ska animationerna fungera ändå.
- Använd egna, tillåtna eller korrekt licensierade ljudresurser.

Gärna en diskret bakgrundsatmosfär om det fungerar, men ingen störande loopad musik behövs.

---

# 13. MATCHKLOCKA OCH LEDNING

Matchklockan ska vara stor, tydlig och central.

Den ska använda den befintliga matchens verkliga återstående tid, inte en separat fristående timer.

När det återstår exempelvis 30 sekunder kan arenan bli lite mer dramatisk.

Förslag:

- Klockan får en mer intensiv glöd.
- En kort subtil ljudsignal kan spelas.
- Några extra partiklar kan synas.
- Trollkarlarna får mer fokuserade uttryck.

De sista 10 sekunderna får gärna vara extra spännande.

Men detta ska endast vara en visuell effekt.

Matchens verkliga klocka ska alltid styra.

Ledande klass ska vara tydligt markerad, utan att den andra trollkarlen framstår som besegrad före slutsignalen.

Ledningen kan ändras många gånger under matchen.

---

# 14. DEN STORA FINALEN – EXTRA VIKTIGT

När matchklockan når noll ska Trollkarlsduellen avslutas med en riktig, genomarbetad finalsekvens.

Detta är ett av de viktigaste momenten.

**Vi vill ha en riktigt spektakulär, rolig och tillfredsställande avslutning.**

Finalen ska inte bara vara att vinnaren lyfter en arm och att lite konfetti faller.

## 14.1 Matchen avgörs

När matchen är slut:

- Nya attacker ska inte startas.
- Pågående vanliga attackanimationer ska avslutas eller avbrytas kontrollerat.
- Det officiella slutresultatet ska hämtas från befintlig Live-logik.
- Vinnaren ska bestämmas av den officiella ställningen.
- Slutsekvensen ska startas en gång.

## 14.2 Vinnaren laddar en gigantisk slutförtrollning

Förslag till finalanimation:

1. Matchklockan når 00:00.
2. Arenan mörknar tillfälligt lite.
3. Båda trollkarlarna stannar upp.
4. Vinnaren höjer sin trollstav.
5. En enorm magisk energikula byggs upp.
6. Stjärnor, partiklar och magiska cirklar fyller luften.
7. Vinnaren avfyrar en spektakulär slutattack.
8. Motståndaren träffas av en stor men barnvänlig magisk explosion.
9. Förloraren förvandlas till exempelvis en liten gråtande potatis, en snurrig groda eller en sotig trollkarl med krokig hatt.
10. Vinnaren gör en triumferande segerpose.
11. Konfetti, magiskt fyrverkeri och segermusik spelas.
12. Den vinnande klassens namn visas stort och tydligt.

Exempel:

**🏆 5E VINNER!**

Visa också slutresultatet.

Finalen får gärna vara ungefär 6–10 sekunder och därefter stanna på en fin resultatskärm.

## 14.3 Variera finalanimationerna

Om möjligt:

Skapa 2–3 olika finalvarianter så att det inte alltid blir exakt samma avslut.

Till exempel:

- Final A: Gigantisk magisk energikula.
- Final B: Förloraren blir en enorm gråtande potatis.
- Final C: Vinnaren framkallar en jättedrake som skrämmer iväg motståndaren.

Vinnarens identitet ska styra vem som attackerar och vem som besegras.

## 14.4 Oavgjort

Om matchresultatet är lika:

Skapa en särskild oavgjord final.

Exempel:

- Båda trollkarlarna laddar sina stavar.
- Båda kastar en besvärjelse samtidigt.
- Trollformlerna kolliderar i mitten.
- Ett stort magiskt POOF uppstår.
- Båda blir sotiga och snurriga.
- De tittar på varandra och skrattar.
- Text: OAVGJORT!

Ingen av trollkarlarna ska utses till vinnare vid lika resultat.

---

# 15. ANVÄNDARUPPLEVELSE UNDER MATCHEN

Vi vill att detta läge ska vara riktigt roligt, men också fungera smidigt under en hel lektion.

Därför gäller:

- Trollkarlarna ska vara tydliga även på projektor.
- Ansiktsuttrycken ska vara överdrivna nog för att synas.
- Poäng och tid ska alltid vara läsbara.
- Attacknamn kan visas kort med snygga textanimationer.
- Attackanimationer får inte ta över hela gränssnittet så att matchställningen försvinner.
- Ingen animation får blockera nya svar från eleverna.
- Matchen ska fortsätta fungera även om ljud stängs av.
- Effekterna ska kännas varierade och inte bli monotona under en 30-minutersmatch.

Det får gärna finnas små överraskningar och humoristiska detaljer som inte beskrivits ovan.

Här uppmuntras kreativitet.

---

# 16. REALTID, SYNKRONISERING OCH ROBUSTHET

Eftersom detta är en riktig livefunktion måste vyn fungera även när många elever svarar samtidigt.

## Realtidskrav

- Använd befintlig matchdata som enda källa till resultat och tid.
- Registrera inte samma svar eller attack två gånger.
- Hantera snabba förändringar av poängen.
- Hantera att båda klasserna fyller sina magimätare nästan samtidigt.
- Hantera att deltagare ansluter och lämnar.
- Hantera korta nätverksavbrott.
- Hantera att projektorvyn laddas om mitt i matchen.
- Behåll korrekt koppling mellan klasser och trollkarlar.
- Säkerställ att matchfinalen inte spelas flera gånger på grund av dubbla uppdateringar.

Om projektorvyn återansluter ska den kunna återställa:

- aktuell ställning
- återstående tid
- magimätarnas korrekta nivåer
- antal redan uppladdade attacker
- vilken trollkarl som hör till vilken klass

Tidigare utförda attacker ska inte spelas upp igen bara för att sidan laddas om.

Skapa ett robust system för animationsköer och tillståndshantering.

Det visuella systemet ska aldrig kunna påverka de faktiska matchresultaten.

---

# 17. PRESTANDA OCH TEKNISK KVALITET

Denna vy ska fungera i en vanlig modern webbläsare på en skoldator kopplad till projektor.

Optimera därför:

- Grafikresurser.
- Animationer.
- Partikeleffekter.
- Minnesanvändning.
- Rendering.
- Ljuduppspelning.
- Laddningstider.

Sträva efter mjuka animationer, gärna 60 FPS på lämplig hårdvara, och prioritera stabilitet framför överdrivet tunga effekter.

Ladda gärna in nödvändiga karaktärsresurser innan matchstart.

Se till att:

- Bakgrunden inte flimrar.
- Karaktärerna inte hoppar mellan fel positioner.
- Bildresurser inte försvinner.
- Animationer inte fastnar.
- Ljud inte upprepas okontrollerat.
- Slutsekvensen alltid visas korrekt.

Stöd gärna webbläsarens inställning för reducerad rörelse utan att dölja matchens viktigaste information.

---

# 18. INTEGRATION I BEFINTLIGT SYSTEM

Innan ni börjar bygga ska ni undersöka den befintliga kodbasen.

Identifiera:

1. Hur nuvarande Live-system är uppbyggt.
2. Hur projektorvyer registreras.
3. Hur läraren väljer livevy.
4. Hur matchdata och resultat förmedlas.
5. Hur klassernas snitt beräknas.
6. Hur matchklockan fungerar.
7. Hur matchen avslutas.
8. Hur befintliga ljud- och helskärmsfunktioner fungerar.

Återanvänd befintliga system där det är lämpligt.

Bygg Trollkarlsduellen som en tydligt avgränsad modul, så att gamla projektorvyer inte riskerar att gå sönder.

Undvik duplicerad poänglogik.

Om det behövs nya inställningar, till exempel klassens valda trollkarl, ska de läggas till på ett sätt som fungerar tillsammans med befintliga matchinställningar.

Om läraren växlar mellan projektorvyer under en aktiv match ska matchens faktiska status inte påverkas.

Trollkarlsduellens lokala animationssystem ska kunna synkroniseras till matchens aktuella läge.

---

# 19. FÖRESLAGEN TEKNISK ARKITEKTUR

Välj lösning efter befintlig kodbas, men separera helst följande ansvarsområden:

## Matchdata

Läser befintligt Live-system och tillhandahåller:

- klassnamn
- matchresultat
- återstående tid
- rätta svar per klass
- matchstatus
- officiell vinnare

## CharacterManager

Hanterar:

- Rasmus
- Elias
- respektive animationsstate
- positioner
- rörelser
- uttryck
- återställning

## MagicSystem

Hanterar:

- magimätare
- attackgränser
- antal uppladdade attacker
- effekter vid full mätare

## AttackManager

Hanterar:

- slumpmässigt attackval
- attackanimationer
- effektanimationer
- animationskö
- ljudkoppling
- förhindrande av överlappande eller dubbla attacker

## ArenaRenderer

Hanterar:

- bakgrund
- ljuseffekter
- partiklar
- dekorativa animationer

## MatchFinale

Hanterar:

- stoppsignal vid matchslut
- korrekt vinnare
- slutanimation
- konfetti
- resultatskärm
- oavgjort

Detta är ett arkitekturförslag, inte ett krav på specifika filnamn eller ramverk.

Välj den lösning som passar bäst med den befintliga applikationen.

---

# 20. TESTNING OCH KVALITETSSÄKRING

Uppdraget ska inte betraktas som färdigt enbart för att koden kompilerar.

Testa faktiskt funktionerna.

## Funktionella tester

Verifiera:

- Rasmus kan representera valfri klass.
- Elias kan representera valfri klass.
- Kopplingen kan bytas före matchstart.
- Rätt klassresultat visas.
- Matchklockan använder befintlig tid.
- Rätta svar fyller rätt magimätare.
- 100 rätt utlöser en attack.
- 200 rätt utlöser nästa attack.
- Enbart den korrekta trollkarlen attackerar.
- Motståndaren får rätt effekt.
- Figuren återgår till normal form.
- Båda klasserna kan attackera.
- Slumpgeneratorn väljer mellan samtliga tillgängliga attacker.
- Alla 15 attacker faktiskt fungerar.
- Två samtidiga attacker hanteras korrekt.
- Omladdning orsakar inte dubbla attacker.
- Matchslut fungerar korrekt.
- Rätt vinnare visas.
- Oavgjort hanteras.
- Slutanimationen spelas exakt en gång.
- Befintliga livevyer fortsätter fungera.
- Befintlig elevupplevelse fungerar som tidigare.

## Visuell kontroll

Kontrollera också:

- Att Rasmus faktiskt liknar referensbilderna.
- Att Elias faktiskt liknar referensbilderna.
- Att båda har hela animerade kroppar.
- Att attackerna har tydligt olika visuella förlopp.
- Att ansiktsuttrycken syns.
- Att trollkarlarna inte överlappar poängen.
- Att animationerna fungerar i 16:9.
- Att matchklockan alltid är läsbar.
- Att finalen ser genomarbetad ut.

Om verktyg för automatiserad webbläsartestning finns tillgängliga, använd dem även för visuell kontroll av projektorvyn.

---

# 21. DEMOLÄGE FÖR TESTNING

Det vore mycket värdefullt att kunna testa Trollkarlsduellen utan att behöva samla två riktiga klasser.

Bygg därför gärna ett isolerat utvecklar-/testläge.

Där ska man kunna simulera:

- +10 rätt för klass A.
- +10 rätt för klass B.
- Full magimätare.
- Slumpmässig attack.
- Valfri specifik attack.
- Ledningsbyte.
- 10 sekunder kvar.
- Matchslut.
- Oavgjort.
- Rasmus som vinnare.
- Elias som vinnare.

Ett sådant läge gör det mycket enklare att testa och förbättra animationerna.

VIKTIGT:

Testläget får inte påverka riktiga elevresultat eller riktiga matchdata.

Det ska vara tydligt avskilt från produktion och får inte innebära att elever kan manipulera poäng.

---

# 22. ARBETSSÄTT FÖR AI-TEAMET

Detta uppdrag lämnas till er för självständigt utvecklingsarbete.

Vi vill att ni arbetar metodiskt och slutför så mycket som möjligt utan att behöva ställa följdfrågor om mindre designbeslut.

Arbeta gärna i följande ordning:

**FAS 1 – ANALYS**

- Inspektera befintlig Live-arkitektur.
- Identifiera relevanta integrationspunkter.
- Identifiera tillgängliga bild- och animationsverktyg.
- Säkerställ att ni förstår den befintliga matchlogiken.

**FAS 2 – KARAKTÄRER OCH GRAFIK**

- Skapa Rasmus och Elias som igenkännbara spelkaraktärer.
- Skapa nödvändiga bildresurser och animationstillstånd.
- Skapa arenan och det visuella gränssnittet.
- Säkerställ en enhetlig grafisk stil.

**FAS 3 – FUNKTIONELL INTEGRATION**

- Koppla projektorvyn till befintliga Live-systemet.
- Implementera klass-trollkarl-koppling.
- Implementera poängvisning, matchtid och magimätare.
- Implementera attacktriggers.

**FAS 4 – ANIMATIONER OCH ATTACKER**

- Bygg attackmotorn.
- Implementera samtliga 15 attacker.
- Implementera reaktioner och återställning.
- Lägg till idle-animationer.
- Lägg till ljus- och partikeleffekter.

**FAS 5 – LJUD OCH FINAL**

- Lägg till lämpliga ljudeffekter.
- Implementera segeranimationer.
- Implementera förlustanimationer.
- Implementera oavgjord final.
- Skapa snygg slutresultatskärm.

**FAS 6 – TEST OCH FINPUTSNING**

- Kontrollera hela matchflödet.
- Testa alla attacker.
- Testa olika klasskopplingar.
- Testa matchslut.
- Testa projektorformat.
- Optimera prestanda.
- Åtgärda visuella eller funktionella problem.

Det är viktigt att faktiskt utföra implementationen och inte stanna vid att föreslå dessa steg.

---

# 23. PRIORITERING VID TIDSBRIST

Vi vill hellre ha ett genomarbetat fungerande system än många halvfärdiga funktioner.

Prioritera därför:

**PRIORITET 1 – MÅSTE FUNGERA**

- Ingen befintlig matchlogik ändras.
- Korrekt klasskoppling.
- Korrekt matchklocka.
- Korrekt ställning.
- Fungerande magimätare.
- Fungerande attacktrigger.
- Korrekt matchvinnare.
- Fungerande slutsekvens.

**PRIORITET 2 – MYCKET VIKTIGT**

- Igenkännbara Rasmus- och Eliaskaraktärer.
- Riktiga karaktärsanimationer.
- 15 tydligt varierade attacker.
- Snygga förvandlingar.
- Levande arena.
- Genomarbetad seger- och förlustanimation.

**PRIORITET 3 – EXTRA POLISH**

- Flera finalvarianter.
- Små idle-skämt.
- Extra partikeleffekter.
- Atmosfäriska ljuseffekter.
- Ytterligare attacker.
- Små visuella överraskningar.

Om något inte hinner implementeras ska det redovisas tydligt. Markera inte en funktion som färdig om den endast är en platshållare.

De 15 attackerna ingår i målbilden för färdig leverans, inte bara som framtida idéer.

---

# 24. DEFINITION AV FÄRDIG LEVERANS

När arbetet är klart förväntar vi oss:

1. En implementerad projektorvy som heter Trollkarlsduellen och går att välja i Live-systemet.
2. Två igenkännbara trollkarlar baserade på bifogade referensbilder.
3. Möjlighet att koppla Rasmus och Elias till valfria två klasser.
4. Tydlig klocka, ställning och klassnamn.
5. Fungerande magimätare kopplade till klassernas korrekta svar.
6. Ett robust system för att utlösa och animera magiska attacker.
7. Minst 15 visuellt varierade attacker.
8. Levande karaktärer även mellan attackerna.
9. Ljudeffekter med möjlighet att stänga av ljudet, om ljudstöd är tekniskt möjligt.
10. En spektakulär final där rätt trollkarl vinner.
11. En korrekt oavgjord final.
12. Fungerande integration med befintligt Live-system.
13. Genomförda tester.
14. Inga kända regressioner i tidigare projektorvyer.

När arbetet avslutas ska ni lämna en kort, konkret rapport:

- Vad har implementerats?
- Vilka bildresurser och animationer har skapats?
- Vilka attacker fungerar?
- Hur är vyn integrerad?
- Vilka tester har körts och med vilket resultat?
- Finns något som återstår eller behöver förbättras?
- Hur kan vi snabbast starta och testa Trollkarlsduellen?

Om någon funktion inte har kunnat färdigställas ska detta sägas uttryckligen.

---

# 25. SLUTLIG KREATIV RIKTLINJE

Det här ska inte kännas som ett vanligt statistikdiagram med lite dekorationer.

Det ska kännas som ett humoristiskt, animerat fantasyspel där två lärare utkämpar en fullständigt absurd magisk duell, driven av elevernas prestationer i matematik.

Rasmus och Elias ska kännas som riktiga personligheter.

Attackerna ska vara roliga att se om och om igen.

Förvandlingarna ska vara tydliga och överdrivna.

Arenan ska kännas levande.

Eleverna ska kunna jubla när deras trollkarl laddar en attack.

Och när matchen tar slut ska vinnaren verkligen få ett ordentligt, roligt och spektakulärt avslut.

**Samtidigt är den viktigaste tekniska principen orubblig:**

Detta är samma befintliga tidsbaserade livematch. Trollkarlsduellen ändrar inte tävlingsreglerna, resultatberäkningen eller elevupplevelsen.

Den skapar ett fantastiskt nytt sätt att uppleva matchen på projektorn.

Ni har stor kreativ frihet kring utseende, animationer och detaljer, så länge de funktionella kraven uppfylls.

**Vi vill inte bara att det ska fungera. Vi vill att det ska kännas färdigt, genomarbetat och riktigt roligt.**

Bygg det bästa ni kan med tillgängliga verktyg och resurser.

**NU SKAPAR VI TROLLKARLSDUELLEN!** 🪄