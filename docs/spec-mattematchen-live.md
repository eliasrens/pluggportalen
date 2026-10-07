BYGG TVÅ NYA MODULER I PLUGGPORTALEN: **MATTEMATCHEN** OCH **LIVE**

Vi vill bygga två nya funktioner i den befintliga Pluggportalen:

1. **Mattematchen**
2. **Live**

De ska använda Pluggportalens befintliga system för:

* elevkonton
* lärarkonton
* klasser
* autentisering
* behörigheter
* statistikstruktur

Ni känner redan Pluggportalens befintliga arkitektur. Återanvänd befintliga system där det är lämpligt och bygg inte separata användar- eller klassystem.

Det är mycket viktigt att dessa funktioner byggs **modulärt, skalbart och lätt att bygga ut**.

Mattematchen och Live delar i första versionen samma snabba multiplikationsmotor, men är två olika produkter med olika syften och separata tävlingsresultat.

---

# ÖVERGRIPANDE STRUKTUR

## Mattematchen

En långvarig multiplikationstävling mellan elever och klasser.

Exempel:

* hela skolan tävlar under två veckor
* elever tränar när de vill under perioden
* individuell topplista
* Klasskamp
* lärarstatistik

Syftet är att få eleverna att **nöta multiplikationstabellerna mycket**.

---

## Live

En generell motor för korta realtidstävlingar mellan klasser.

Exempel:

**4B mot 5E under 20 minuter**

Eleverna sitter i varsitt klassrum och tävlar samtidigt.

Lärarna visar en gemensam livevy på projektorn.

Första spelläget i Live är:

**Multiplikation 0–10 – snabbmatch**

Men arkitekturen ska redan från början byggas så att Live senare kan få fler modes, exempelvis:

* addition
* subtraktion
* division
* huvudräkning
* geografi
* SO
* NO
* ordkunskap
* engelska
* quiz
* innehåll från andra delar av Pluggportalen

Bygg därför Live runt ett tydligt system för exempelvis:

`gameMode`

och undvik att hårdkoda hela Live-systemet specifikt för multiplikation.

---

# GEMENSAM MULTIPLIKATIONSMOTOR

Både Mattematchen och Lives första spelläge ska använda samma välbyggda multiplikationsmotor.

## Innehåll

Multiplikationstabellerna:

**0–10**

Exempel:

`7 × 8 = ?`

---

# FRÅGEGENERATOR

Frågorna ska genereras dynamiskt.

Använd inte en manuell frågebank.

Alla kombinationer inom 0–10 ska kunna förekomma.

Urvalet ska kännas slumpmässigt men vara balanserat över tid.

Undvik dålig slump där eleven exempelvis får väldigt många enkla tal och nästan aldrig svårare kombinationer.

Undvik också:

* exakt samma fråga två gånger direkt efter varandra
* gärna även spegelvänd fråga direkt efter, exempelvis `7×8` följt direkt av `8×7`

Över tid ska däremot både `7×8` och `8×7` kunna förekomma.

---

# SNABBT ELEVFLÖDE

Detta är mycket viktigt.

Multiplikationsläget ska vara byggt för **mycket snabb träning**.

På dator/Chromebook ska eleven kunna göra följande utan mus:

1. se talet
2. skriva siffrorna
3. trycka ENTER
4. få omedelbar feedback
5. nästa tal visas
6. skriva nästa svar direkt
7. ENTER igen

Svarsfältet ska automatiskt ha fokus hela tiden.

Eleven ska inte behöva klicka tillbaka i svarsfältet efter varje fråga.

---

# FEEDBACK

Efter ett svar:

Rätt svar:

**✅ RÄTT!**

Fel svar:

**❌ FEL – rätt svar var 56**

Feedbacken ska visas mycket kort.

Därefter ska nästa uppgift komma automatiskt.

Elevens tempo ska inte stoppas av:

* popupfönster
* extra knappar
* långa animationer
* ”Nästa fråga”-knapp

---

# FEL SVAR

Fel svar:

* ger 0 poäng
* ger ingen minuspoäng
* räknas som ett fel i statistiken
* eleven får inte försöka om samma fråga

Nästa fråga kommer direkt.

---

# RESPONSIV DESIGN

Allt viktigt ska rymmas på en vanlig Chromebook/laptopskärm utan scroll.

Fråga, svarsfält och feedback ska alltid vara synliga.

Mobil/surfplatta ska också fungera, men dator/Chromebook är primärt fokus.

---

# DEL 1 – MATTEMATCHEN

# SYFTE

Mattematchen är den långvariga tävlingen.

Det är medvetet ett system där **mängdträning premieras**.

Vi vill att eleverna ska gå in och träna mycket.

---

# SYNLIGHET

Mattematchen ska endast synas för eleven när det finns en aktiv Mattematchen-period där elevens klass deltar.

Ingen aktiv tävling:

→ Mattematchen är dold i elevmenyn.

Aktiv tävling för elevens klass:

→ Mattematchen visas.

---

# INGEN AVATARVALUTA

Mattematchen ska INTE ge Pluggportalens pengar.

Ingen avatarbelöning ska delas ut.

Tävlingspoäng är den enda belöningen i nuläget.

---

# INDIVIDUELL POÄNG

Varje rätt svar:

**1 rätt = 1 individuell poäng**

Fel:

**0 poäng**

Individens tävlingspoäng är alltså helt enkelt:

**totalt antal rätt under aktuell tävlingsperiod**

Vi vill medvetet premiera elever som tränar mycket.

---

# INDIVIDUELL TOPPLISTA

Visa:

**TOPP 25**

Endast de 25 elever som har flest rätt under aktuell Mattematchen-period visas.

Exempel:

1. Alma – 1842
2. Omar – 1751
3. Clara – 1698
   ...
4. Elias – 622

Visa inte fler än 25.

---

# KLASSKAMP

Mattematchen ska också ha en tävling mellan klasser.

Eftersom klasser kan vara olika stora ska klassens resultat baseras på:

**klassens totala antal rätt / antal elever i klassen**

Exempel:

5A:

5000 rätt
25 elever

= **200,0**

5B:

4300 rätt
20 elever

= **215,0**

5B leder alltså Klasskampen.

---

# KLASSENS NÄMNARE

För den långvariga Mattematchen kan klassens vanliga elevantal användas.

Poängen ska visas med:

**1 decimal**

Exempel:

**184,7**

---

# KLASSKAMPENS TOPPLISTA

Klasskampens topplista ska visa:

**samtliga deltagande klasser**

Inte bara topp 3.

Exempel:

1. 5E – 212,4
2. 4B – 208,1
3. 5A – 196,7
4. 4C – 171,2
5. 6A – 162,5

---

# ELEVENS HIGHscore-KNAPP

I Mattematchen ska eleven ha en tydlig knapp för topplistor.

Använd gärna:

**🏆**

eller annan tydlig pokal/highscore-symbol.

När eleven trycker på den visas:

## Individuellt

Topp 25 elever.

## Klasskamp

Alla deltagande klasser.

---

# ELEVENS STATISTIKKNAPP

Eleven ska även ha en tydlig statistikknapp.

Använd exempelvis:

**📊**

När eleven klickar där ser eleven **sin egen statistik**.

Visa exempelvis:

* antal rätt
* antal fel
* totalt antal svar
* % rätt
* % fel

Dessutom statistik per multiplikationstabell.

Exempel:

0:ans tabell – 100 %
1:ans tabell – 98 %
2:ans tabell – 94 %
3:ans tabell – 91 %
4:ans tabell – 84 %
5:ans tabell – 96 %
6:ans tabell – 72 %
7:ans tabell – 64 %
8:ans tabell – 69 %
9:ans tabell – 78 %
10:ans tabell – 97 %

Eleven ska bara se sin egen statistik.

---

# MATTEMATCHEN – LÄRARSIDA

Lärarsidan ska få en ny huvudmodul:

**Mattematchen**

bredvid befintliga delar såsom Innehåll och Klasser.

Här ska läraren kunna skapa och administrera en lång tävlingsperiod.

---

# SKAPA MATTEMATCH

Läraren ska kunna välja:

* tävlingsnamn
* deltagande klasser
* startdatum
* starttid
* slutdatum
* sluttid

Exempel:

**Mattematchen oktober 2026**

Start:
12 oktober 08:00

Slut:
23 oktober 15:00

---

# TÄVLINGSSTATUS

Använd tydliga statuslägen:

* kommande
* aktiv
* avslutad

När tävlingen går in i aktiv status ska den automatiskt visas för deltagande elever.

När perioden är slut ska den automatiskt försvinna från elevmenyn.

---

# LÄRARKONTROLLER

Läraren ska kunna:

* skapa tävling
* välja klasser
* starta
* stoppa
* avsluta
* vid behov nollställa/teståterställa

Nollställning ska kräva tydlig bekräftelse så att statistik inte försvinner av misstag.

---

# HISTORIK

Avslutade Mattematchen-perioder ska sparas.

Vi vill senare kunna öppna äldre tävlingar och se resultat.

Spara exempelvis:

* tävlingsnamn
* datum
* deltagande klasser
* vinnare individuellt
* klassresultat
* elevresultat
* statistik

---

# MATTEMATCHEN I BEFINTLIGA STATISTIKDELEN

Pluggportalens befintliga lärarstatistik har exempelvis Plugga och Läsresan.

Lägg till en ny statistikdel:

**Mattematchen**

---

# KLASSÖVERSIKT

Läraren ska kunna välja klass och få en tabell.

Exempel:

| Elev | Rätt | Fel | Totalt | Rätt % | Fel % |

Läraren ska kunna klicka på en elev för mer detaljer.

---

# DETALJERAD MATTEMATCH-STATISTIK

För en enskild elev visa:

* totalt antal rätt
* totalt antal fel
* totalt antal svar
* rätt %
* fel %

Visa också statistik för varje multiplikationstabell 0–10.

Spara därför varje svar på ett sätt som gör det möjligt att veta vilken tabell/fråga resultatet tillhör.

---

# DEL 2 – LIVE

# ÖVERGRIPANDE IDÉ

Live ska vara en separat huvudmodul i Pluggportalen.

Live ska inte ligga inne i Mattematchen.

Detta är viktigt eftersom Live i framtiden ska kunna användas för många olika moment.

---

# SYNLIGHET FÖR ELEVER

Live ska bara synas för en elev när det finns:

* en lobby
  eller
* en pågående Live-session

som elevens klass är inbjuden till.

Ingen relevant Live-session:

→ Live är dold.

---

# FÖRSTA LIVE-MODE

Första implementerade spelläget:

**Multiplikation – snabbmatch**

Använd exakt samma snabba multiplikationsmotor som Mattematchen.

Tabeller:

**0–10**

---

# LIVE – SKAPA SESSION

På lärarsidan ska det finnas en egen huvudmodul:

**Live**

Läraren ska kunna skapa en Live-session.

---

# VÄLJ MODE

Först väljer läraren spelläge.

I beta finns:

**Multiplikation – snabbmatch**

Men strukturen ska vara gjord så att fler game modes enkelt kan läggas till senare.

---

# VÄLJ KLASSER

För första versionen fokuserar vi primärt på:

**klass mot klass**

Exempel:

4B mot 5E.

Arkitekturen får gärna kunna hantera fler klasser senare.

---

# VÄLJ MATCHLÄNGD

Läraren väljer:

* 5 minuter
* 10 minuter
* 15 minuter
* 20 minuter
* 25 minuter
* 30 minuter

---

# KLASSENS NÄMNARE I LIVE

Eftersom olika antal elever kan vara närvarande ska deltagarna INTE låsas.

Läraren väljer istället en nämnare för varje klass när matchen skapas.

Systemet kan förifylla klassens vanliga elevantal.

Läraren ska kunna justera manuellt.

Exempel:

4B normalt:
20 elever

Idag:
17 elever

Läraren anger:

**4B nämnare = 17**

5E:

**5E nämnare = 22**

---

# LIVE-POÄNG

Varje rätt svar:

**1 poäng**

Fel:

**0 poäng**

Klassens matchpoäng:

**totalt antal rätt / lärarens valda nämnare**

Exempel:

4B:

340 rätt / 17 elever = **20,0**

5E:

418 rätt / 22 elever = **19,0**

4B leder.

---

# ELEVER FÅR ANSLUTA SENT

Deltagarlistan låses inte.

Om en elev kommer sent ska eleven kunna öppna den pågående matchen och börja spela.

Nämnaren ändras inte automatiskt.

---

# LIVE-SESSIONENS STATUS

En Live-session ska minst ha:

## LOBBY

Session skapad men ännu inte startad.

## LIVE

Matchen pågår.

## AVSLUTAD

Matchen är klar.

---

# LOBBY – MYCKET VIKTIGT

När en lärare skapar en Live-session ska sessionen direkt bli synlig för eleverna i deltagande klasser.

Eleverna ska kunna klicka:

**Gå med i Live-match**

och komma in i en lobby.

Eleven får INTE börja svara än.

Visa exempelvis:

**4B MOT 5E**

**Väntar på start...**

---

# ELEVER I LOBBYN

Eleverna ska kunna gå in i förväg och vänta.

När läraren senare trycker Start ska deras vy automatiskt övergå till spelläget.

Elever ska inte behöva ladda om sidan.

---

# LÄRARLOBBY / PROJEKTORVY

När sessionen är skapad ska läraren direkt kunna öppna den grafiska Live-vyn på projektorn.

Projektorvyn ska i lobbyläget visa:

* matchnamn
* klasser
* matchlängd
* antal anslutna elever från respektive klass
* tydlig status: väntar på start
* STARTA-knapp

Exempel:

# MATTEMATCH LIVE

**4B VS 5E**

4B
15 elever redo

5E
19 elever redo

Matchtid: 20 min

**STARTA MATCH**

---

# START-KNAPPEN SKA FINNAS I PROJEKTORVYN

Detta är viktigt.

Läraren ska kunna duplicera sin datorskärm till projektorn.

Läraren visar alltså själva lobbyn på projektorn.

När båda klassrummen är redo ska läraren direkt kunna klicka:

**STARTA MATCH**

från samma vy.

Läraren ska inte behöva gå tillbaka till någon separat administrationssida.

---

# FLERA LÄRARE SKA KUNNA ÖPPNA SAMMA SESSION

Alla lärare använder samma Pluggportal/lärarsystem.

Om en Live-session är skapad ska andra lärare kunna se den under:

**Aktiva Live-sessioner**

även om de inte skapade sessionen.

Exempel:

Rasmus skapar:

4B vs 5E

Elias ska kunna öppna samma session från sitt klassrum.

Båda lärarna ska kunna visa Live-vyn på sina projektorer.

---

# SESSIONEN FÅR INTE VARA BUNDEN TILL SKAPARENS WEBBLÄSARE

Sessionen ska leva centralt i systemet.

Den får inte bero på:

* en viss dator
* en viss browser-tab
* läraren som skapade den
* lokal state

Alla anslutna klienter ska läsa samma centrala matchstatus.

---

# STARTA FRÅN VILKET KLASSRUM SOM HELST

Vilken behörig lärare som helst som öppnat Live-sessionen ska kunna trycka:

**STARTA**

När en lärare startar:

* matchen startar för alla elever
* projektorvyer uppdateras
* serverns timer startar

---

# NEDRÄKNING

När Start trycks:

Visa gemensamt:

**3**

**2**

**1**

**KÖR!**

Därefter startar multiplikationsfrågorna.

---

# ELEVSIDAN UNDER LIVE

Elevens skärm ska vara extremt enkel.

Visa primärt:

* multiplikation
* svarsfält
* snabb rätt/fel-feedback

Ingen matchtimer behövs på elevens skärm.

Ingen stor Live-statistik behövs där.

Fokus ska vara:

**SVARA SÅ SNABBT SOM MÖJLIGT.**

---

# MATCHTIMER

Matchtimern visas på:

**projektorvyn**

Inte på elevskärmen.

Timern ska vara tydlig och stor.

Exempel:

**12:43 kvar**

---

# SERVERSTYRD TID

Matchtiden ska vara central/serverstyrd.

Den får inte baseras på en enskild lärardators lokala timer.

Alla:

* projektorer
* lärare
* elever

ska förhålla sig till samma officiella start/sluttid.

---

# LIVE-UPPDATERING

Projektorvyn ska uppdateras:

**automatiskt, ofta och snabbt**

När elever svarar rätt ska man nästan direkt se rörelse i Live-vyn.

Använd lämplig realtime-teknik utifrån Pluggportalens befintliga stack.

Undvik en lösning där resultatsidan bara uppdateras var 10:e eller 20:e sekund.

Det ska kännas LIVE.

---

# PROJEKTORVYER

Det ska finnas tre grafiska Live-vyer.

Läraren ska kunna växla mellan dem manuellt under matchen.

---

# VY 1 – RAKETRACE

Detta är huvudvyn.

Varje klass har en egen raket.

Raketerna stiger upp genom himlen/rymden i takt med klassens resultat.

Visa exempelvis:

* klassnamn
* raket
* liten exakt poängsiffra
* matchtimer

Grafiken ska vara:

* färgglad
* spelifierad
* barnvänlig
* tydlig på projektor
* animerad

---

# VISUELL KOMPRIMERING I RAKETRACE

Den faktiska vinnaren avgörs alltid av de riktiga poängen.

Men den grafiska raketpositionen får **komprimera stora skillnader**.

Syftet är att matchen ska fortsätta kännas spännande även om en klass leder ganska tydligt.

Exempel:

Om ena laget har 20 % högre poäng behöver raketen inte vara 20 % längre fram.

Raketerna får visuellt ligga närmare varandra.

Visa däremot gärna den riktiga poängen i mindre text.

Tävlingsresultatet får aldrig manipuleras.

Det är endast den grafiska visualiseringen som komprimeras.

---

# VY 2 – STATISTIKVY

Denna vy ska vara exakt.

Visa exempelvis:

* stora grafiska staplar
* poäng/elev
* totalt antal rätt
* klasser
* individuell topplista
* tid kvar

Ingen visuell komprimering här.

Statistikvyn visar den riktiga ställningen tydligt.

---

# VY 3 – DRAGKAMP

När exakt två klasser tävlar ska läraren kunna välja:

**Dragkamp**

Visa två roliga figurer/lag som drar i ett rep.

Mittmarkören flyttas beroende på klassernas resultat.

Även här får visualiseringen komprimera stora skillnader så matchen känns spännande längre.

Visa små exakta siffror bredvid.

---

# VYVAL SKA VARA LOKALT

Mycket viktigt:

Rasmus projektor ska kunna visa:

**Raketrace**

samtidigt som Elias projektor visar:

**Statistik**

Att en lärare byter projektorvy får INTE byta vy för den andra läraren.

Vyvalet är alltså lokalt per projektor/browser.

---

# MATCHSTATUS ÄR DÄREMOT GEMENSAM

Följande är globalt för sessionen:

* lobby/live/avslutad
* start
* timer
* poäng
* paus om sådan funktion används
* avslut

---

# FULLSKÄRMSLÄGE

Projektorvyn ska ha:

**Fullskärm**

så den kan användas snyggt på klassrumsprojektor.

---

# LJUD

Projektorvyn ska ha:

**Ljud på/av**

Ljud får gärna användas för:

* 3–2–1
* KÖR
* små diskreta matchhändelser
* slutsignal
* vinnare

Men ljud måste gå att stänga av.

---

# ANIMATIONER

När poängen förändras ska vyn kännas levande.

Exempel:

Raketer:

* liten boost
* flamma
* mjuk rörelse

Dragkamp:

* rep/figurer rör sig

Staplar:

* mjuk animation

Undvik blinkande/rörig grafik.

---

# MATCHSLUT

När tiden når:

**00:00**

ska matchen stoppas automatiskt.

Svar som skickas efter officiell sluttid ska inte räknas.

---

# VINNARSKÄRM

Efter matchen:

Visa en tydlig vinnarskärm.

Exempel:

🏆 **VINNARE – 4B!**

4B:
20,3 poäng/elev

5E:
19,7 poäng/elev

Visa gärna:

* konfetti
* pokal
* vinnaranimation
* totalsiffror

Vid oavgjort:

**OAVGJORT!**

Fira båda klasserna.

---

# ELEVER SOM ANSLUTER SENT

Om sessionen redan är LIVE:

Eleven ska kunna gå in och börja spela direkt.

Ingen lobby behövs för den eleven.

---

# ÅTERANSLUTNING

Om:

* elev laddar om sidan
* lärare laddar om sidan
* projektor tappar anslutningen kort

ska klienten kunna återansluta till samma session.

Aktuell:

* matchstatus
* tid
* poäng
* session

ska hämtas igen automatiskt.

---

# FLERA LIVE-MATCHER SAMTIDIGT

Arkitekturen ska stödja flera samtidiga Live-sessioner.

Exempel:

4B vs 5E

kan pågå samtidigt som:

3A vs 3B

Sessionerna får inte påverka varandra.

---

# LIVE-HISTORIK

Avslutade Live-matcher ska sparas.

Spara exempelvis:

* datum
* matchnamn
* gameMode
* klasser
* nämnare
* matchlängd
* slutresultat
* totalt antal rätt
* elevresultat

---

# LIVE OCH MATTEMATCHEN SKA HÅLLAS SEPARATA

Om en elev svarar rätt i en Live-match ska detta INTE ge tävlingspoäng i den långvariga Mattematchen.

Exempel:

Live-match:

Omar gör 150 rätt.

Det ska inte automatiskt lägga +150 på hans Mattematchen-topplista.

Tävlingssystemen ska vara separata.

---

# MEN STATISTIK KAN ÅTERANVÄNDAS

Multiplikationsresultat från båda systemen kan gärna sparas i en gemensam underliggande träningsstatistik, om det passar arkitekturen.

Det kan senare göra det möjligt för läraren att se:

”Totalt i multiplikation”

oavsett om eleven tränat i:

* Mattematchen
* Live

Men själva tävlingspoängen ska hållas separata.

---

# FÖRSLAG PÅ DATAMODELL – MATTEMATCHEN

Anpassa efter nuvarande backend.

## MathCompetition

Exempel:

* id
* name
* participatingClassIds
* startAt
* endAt
* status
* createdBy
* createdAt

## MathAnswer

* userId
* competitionId
* factorA
* factorB
* answer
* correctAnswer
* isCorrect
* timestamp

## CompetitionStudentStats

Kan beräknas eller cachas:

* correct
* incorrect
* total
* percentageCorrect
* statsByTable

---

# FÖRSLAG PÅ DATAMODELL – LIVE

## LiveSession

Exempel:

* id
* name
* gameMode
* participatingClassIds
* classDivisors
* durationSeconds
* status
* createdBy
* createdAt
* startedAt
* endsAt
* finishedAt

## LiveAnswer

* sessionId
* userId
* classId
* factorA
* factorB
* submittedAnswer
* correctAnswer
* isCorrect
* timestamp

---

# GAME MODE-ARKITEKTUR

Live-systemet ska kunna fråga sitt valda gameMode:

* hur skapas nästa fråga?
* hur valideras svar?
* hur många poäng ger ett korrekt svar?
* vilken statistik ska sparas?

Första mode:

`multiplication_0_10`

Men vi ska senare kunna lägga till exempelvis:

`addition`

`division`

`geography`

utan att bygga om hela Live-systemet.

---

# LÄRARSIDANS STRUKTUR

Vi vill ungefär ha:

**Innehåll**

**Klasser**

**Mattematchen**

**Live**

**Statistik**

---

# STATISTIKSIDA

Under Statistik finns exempelvis:

**Plugga**

**Läsresan**

**Mattematchen**

Live-statistik kan antingen ligga:

* under Mattematchen/multiplikationsstatistik
  eller
* som separat Live-statistik

Välj den struktur som passar befintlig Pluggportal bäst, men Live-resultaten ska kunna analyseras i efterhand.

---

# SÄKERHET OCH POÄNGVALIDERING

Klienten får inte själv kunna säga:

”lägg till 100 poäng”

Backend/server ska validera:

* vilken fråga eleven fick
* vilket svar som lämnades
* om svaret är korrekt
* vilken session/tävling det tillhör
* om tävlingen fortfarande är aktiv

Poäng ska skapas från verifierade svar.

---

# SKYDD MOT DUBBLA SVAR

ENTER-flödet är snabbt.

Se till att dubbeltryck på ENTER eller dålig nätverkslatens inte kan registrera samma fråga flera gånger.

Varje fråga/försök ska ha en unik identitet eller annan säker mekanism.

---

# PRESTANDA

Live kan innebära att många elever skickar svar samtidigt.

Exempel:

40–60 elever

kan svara flera gånger per minut.

Systemet ska därför byggas så att:

* svar registreras snabbt
* projektorvyn uppdateras snabbt
* UI:t inte fryser
* statistikberäkning inte blockerar spelandet

---

# ACCEPTANCE TESTS – MATTEMATCHEN

## Test 1

Aktiv tävling finns inte.

Förväntat:

Mattematchen syns inte för eleven.

---

## Test 2

Tävlingsperiod börjar.

Elevens klass deltar.

Förväntat:

Mattematchen visas automatiskt.

---

## Test 3

Eleven svarar korrekt på 100 frågor.

Förväntat:

100 rätt
100 individuella poäng

Ingen avatarvaluta delas ut.

---

## Test 4

Individuella topplistan innehåller 60 elever.

Förväntat:

Endast topp 25 visas.

---

## Test 5

Klass:

20 elever
4000 rätt

Förväntat Klasskamp-resultat:

**200,0**

---

## Test 6

Elev öppnar 📊 Statistik.

Förväntat:

Eleven ser endast sin egen statistik samt resultat per tabell.

---

# ACCEPTANCE TESTS – LIVE

## Test 1 – Skapa lobby

Lärare skapar:

4B vs 5E
20 minuter
Multiplikation 0–10

Förväntat:

session status = lobby.

Elever i 4B och 5E ser Live.

---

## Test 2 – Elever går in

15 elever från 4B ansluter.

18 elever från 5E ansluter.

Förväntat på projektorvyn:

4B: 15 redo
5E: 18 redo

---

## Test 3 – Andra läraren

Rasmus har skapat sessionen.

Elias loggar in på lärarsidan.

Förväntat:

Elias ser sessionen under Aktiva Live-sessioner och kan öppna samma projektorvy.

---

## Test 4 – Start

Lärare klickar STARTA MATCH i projektorvyn.

Förväntat:

3–2–1–KÖR.

Alla elever får sitt första tal.

Matchtimern startar.

---

## Test 5 – Svar

Elev ser:

7 × 8

skriver:

56

ENTER.

Förväntat:

omedelbar RÄTT-feedback.

Nästa tal visas.

Svarsfältet är automatiskt redo.

---

## Test 6 – Klassresultat

4B:

340 rätt
nämnare 17

Resultat:

20,0

5E:

418 rätt
nämnare 22

Resultat:

19,0

Förväntat:

4B leder.

---

## Test 7 – Projektorvyer

Rasmus väljer Raketrace.

Elias väljer Statistik.

Förväntat:

båda vyerna visar samma matchdata men vyvalet påverkar inte den andra projektorn.

---

## Test 8 – Sen elev

Elev går in 5 minuter efter start.

Förväntat:

eleven kommer direkt till spelvyn och kan börja bidra.

---

## Test 9 – Slut

Timern når 00:00.

Förväntat:

nya svar räknas inte.

vinnarskärm visas.

resultatet sparas.

---

# DESIGN

Både Mattematchen och Live ska visuellt kännas som en naturlig del av Pluggportalen.

Designen ska vara:

* modern
* varm
* grafisk
* färgglad
* rolig
* tydlig
* snabb

Mattematchens spelvy ska vara relativt ren eftersom hastighet är viktigast.

Live-projektorvyn får däremot gärna vara betydligt mer grafisk och spektakulär.

---

# PRIORITERINGSORDNING

Om uppgiften behöver delas upp i implementation bör följande prioriteras:

## 1.

Gemensam snabb och stabil multiplikationsmotor.

## 2.

Mattematchen med tävlingsperiod, Topp 25 och Klasskamp.

## 3.

Mattematchens elevstatistik och lärarstatistik.

## 4.

Live-session + fungerande lobby.

## 5.

Gemensam serverstyrd start och timer.

## 6.

Realtime-poäng.

## 7.

Raketrace.

## 8.

Statistikprojektorvy.

## 9.

Dragkamp.

## 10.

Historik, polish, animationer och ljud.

Men slutresultatet ska innehålla samtliga delar i denna specifikation.

---

# VIKTIG PRINCIP

Bygg inte detta som två snabba engångsfunktioner.

Vi vill att:

**Mattematchen** ska kunna utvecklas till fler långvariga mattetävlingar.

Och:

**Live** ska kunna utvecklas till en generell realtidstävlingsplattform inne i Pluggportalen.

Separera därför tydligt:

* tävlingsmotor
* multiplikationsmotor
* statistik
* Live-sessioner
* game modes
* UI
* realtime-data
* projektorvyer

Återanvänd det som bör återanvändas, men håll Mattematchens och Lives tävlingsresultat separata.

---

# SLUTMÅL – MATTEMATCHEN

En elev ska kunna:

1. se Mattematchen när en aktiv tävling pågår
2. öppna den
3. svara snabbt på multiplikation 0–10
4. använda ENTER utan mus
5. samla 1 poäng per rätt
6. öppna 🏆 och se Topp 25 + Klasskamp
7. öppna 📊 och se sin egen statistik

Läraren ska kunna:

1. skapa tävlingsperiod
2. välja klasser
3. välja start och slut
4. följa tävlingen
5. se klass- och elevstatistik
6. se resultat per multiplikationstabell

---

# SLUTMÅL – LIVE

En lärare ska kunna:

1. skapa Live-session
2. välja Multiplikation – snabbmatch
3. välja två klasser
4. ange nämnare
5. välja 5–30 minuter
6. öppna projektorlobby
7. låta elever gå in
8. se antal elever redo
9. låta den andra läraren öppna samma session
10. trycka STARTA direkt i projektorvyn
11. få 3–2–1–KÖR
12. följa matchen live
13. växla mellan Raketrace, Statistik och Dragkamp
14. se matchklockan
15. få automatisk vinnarskärm vid slut

Eleven ska samtidigt kunna:

1. gå in i lobbyn
2. vänta på start
3. automatiskt få första frågan när matchen börjar
4. skriva svar
5. trycka ENTER
6. få direkt feedback
7. fortsätta utan avbrott tills matchen är slut

**Fokus: snabbt, stabilt, grafiskt roligt och mycket lätt att använda i ett riktigt klassrum.**
