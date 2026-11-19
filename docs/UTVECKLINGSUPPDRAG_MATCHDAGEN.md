# UTVECKLINGSUPPDRAG: MATCHDAGEN – FOTBOLLSSPEL PER ELEV

**Uppdrag till AI-utvecklingsteamet**

Bygg **Matchdagen**, ett fotbollsspel i 3D där eleven leder sin egen klubb genom ligor, kval, cuper och till slut Mästarcupen. **Varje drag på planen kräver att eleven svarar rätt på en fråga** ur det ämnesinnehåll läraren har valt.

**Bakgrund:** Elias har två elever med anpassning som behöver sitta med datorn en stor del av dagen och som älskar fotboll mer än något annat. Matchdagen ska kunna hålla dem engagerade **en timme i taget** och samtidigt ge riktig träning i skolans ämnen. Därför:

- **Bara utvalda elever:** läraren slår på Matchdagen för **enskilda elever**, inte för en hel klass.
- **Frågor på elevens egen nivå:** frågorna blir **aldrig svårare** högre upp i divisionerna. Det som blir tuffare är motståndet, antalet lag och matcher, och att det krävs fler rätt svar per mål.
- **Man kan bara gå uppåt.** Ingen åker ur.
- **Ingen tidspress som standard,** och en inbyggd paus i halvtid.
- **All statistik sparas.** Eleven ser sina matcher, pokaler och rekord, och läraren ser tid, rätt svar och utveckling.

**Förhandsvisningen** `preview-matchdagen-skiss.html` (bifogad) är Elias godkända skiss. Den visar känslan, flödet, 3D-planen, tabellen, truppen, träningslägret och kvalet. **Den är facit för upplevelsen**, men den riktiga implementationen följer det här dokumentet där de skiljer sig. Lägg filen i `preview/`.

**Detta är ett implementeringsuppdrag.** Allt som behöver bestämmas är bestämt här. **Ställ inga frågor.** Där något är oklart väljer ni det som ligger närmast skissen och andan i dokumentet, och skriver valet i rapporten.

Arbetet görs i fyra etapper. Varje etapp ska vara klar, testad och användbar innan nästa påbörjas.

| Etapp | Innehåll |
| --- | --- |
| **1** | Grunden: modulen per elev, lärarens inställningar, frågekällorna, matchmotorn, 3D-planen (med 2D-reserv), en säsong i Division 6, sparning och statistik |
| **2** | Hela karriären: alla divisioner, kval med straffar, truppen och marknaden, grundpelarna och träningslägret, cupen och rekorden |
| **3** | Toppen: Superligan, Mästarcupen, legendklubb och pokalskåpet |
| **4** | Mot varandra: vänskapsmatcher mellan elever i realtid |

---

# 0. LÄS FÖRST

**Moduler och åtkomst:**
- `src/gamemode-visibility.js`: `STUDENT_MODULES`, `optIn`, `enabledModules` och `normalizeEnabledModules`, med kommentaren om modulregistret överst.
- `src/ui.js`: `NAV_LANKAR`, `NAV_GRUPPER` och `NAV_VILLKOR`.

**Frågor:**
- `src/live/game-modes.js` (registret och `GameMode`-interfacet: `createSource`, `checkAnswer`, `answerKinds`), `src/live/modes/` (`multiplication-0-10.js`, `plugga-quiz*.js`) och `src/live/kistspel/ks-fraga.js` (`createQuestionFlow`).
- `src/rakna-core.js` (generatorn: `generatorTopics`, `createTopicBag`, `checkAnswer`) och `src/game-shared.js` (`plainQuizPool`, `hasPassage`).
- `src/prov/prov-fran-omrade.js`: hur ett område görs om till frågor.

**3D:**
- `src/vendor/three/three.module.min.js` och `src/live/formats/kurragomma/scen/` (`kg-tre.js`: `harWebGL`, `laddaThree`; `kg-figur.js`; `kg-avatar-bild.js`; `kg-2d.js` som mönster för en 2D-reserv).
- `docs/KURRAGOMMA.md`: hur 3D-scenen är byggd och hur den delade, rena motorn i `delat/` synkas till `functions/`.

**Lärarsidan, regler och mönster:**
- `src/teacher-class.js` (`STATS_TABS`), `src/teacher-classes-sections.js` (`CLASS_SECTIONS`) och `docs/LARARSIDAN_STRUKTUR.md`.
- `docs/SCHACK.md` (lobby, utmaningar och callables mot klasskompisar, används i Etapp 4) och `docs/PROV.md` (anpassningar per elev).
- `firestore.rules` (`isSelf`, `hasStudent`, `hasClass`, `isClassMember`) och `docs/BEHORIGHETER.md`.
- `docs/DESIGNSYSTEM.md`.

**Regler:**
- **Bootgrafen (#271):** allt nytt ligger i `src/matchdagen/` och laddas med `import()`. three.js laddas bara när matchen startar. Skriv ett källkodstest.
- **Kvoten (#114/#231):** inga läsningar per elev i heta flöden. Räkna ut och redovisa budgeten (se 13).
- **Varumärken:** inga riktiga klubbar, ligor, spelare eller turneringar. Undvik alltså Allsvenskan, Superettan, Champions League och FIFA, och inga riktiga spelarnamn. Allt i det här dokumentet är påhittat.
- **Ren motor:** all spellogik ligger i en **ren** modul (`src/matchdagen/delat/`) utan DOM, Firebase, three.js, `Math.random()` och `Date.now()`. Slump och tid skickas in som i Kurragömma. Motorn testas i node och delas med servern i Etapp 4.
- **Tal i konfigurationen:** alla tal i det här dokumentet är **startvärden** och samlas i `src/matchdagen/delat/md-config.js`. Balansen justeras där (se 12).

---

# ETAPP 1 – GRUNDEN

## 1. Modulen per elev

### 1.1 Åtkomst för enskilda elever

I dag kan en modul bara slås på för en hel klass. Bygg stöd för **moduler per elev**:

- Nytt fält: `classes/{classId}.elevModuler: { [uid]: ["matchdagen", ...] }`, med högst 100 elever och bara kända modul-id som tillåter det.
- Nytt fält i `STUDENT_MODULES`: `perElev: true`. Matchdagen har `perElev: true` och `optIn: true`. **Matchdagen kan bara slås på per elev**, aldrig för hela klassen.
- **Synlighet:** en modul syns för eleven om den är påslagen för klassen **eller** om eleven finns i `elevModuler` för den modulen. Uppdatera funktionen som räknar ut dolda moduler (den som använder `enabledModules`) och testa den.
- **Fokusläget** fungerar som för andra inlärningsmoduler (`learning: true`). Matchdagen är spärrad när klassen är låst till något annat.
- **Regler:** `elevModuler` får skrivas av en lärare med `hasClass(classId)`. Validera formen.
- **Elevens meny:** modulen heter **Matchdagen**. Den har en egen SVG-ikon i form av en fotboll (ingen emoji) och ligger i gruppen "Öva".

### 1.2 Lärarens inställningar per elev

Lägg till en ny sektion, **"Anpassningar per elev"**, i klassens flik **Elever** (se `UTVECKLINGSUPPDRAG_LARARSIDA_STRUKTUR.md`). Klicka på en elev för att få en panel med:

- **Matchdagen på/av** för eleven.
- **Frågekällor:** en eller flera (se 2).
  - Plugga-områden (kryssrutor bland lärarens synliga områden)
  - Multiplikationstabeller (kryssrutor 0–10)
  - Räkna-ämnen, om området har en generator
- **Svarssätt:** flerval eller skriv själv, där källan stödjer det. Flerval är standard.
- **Klocka på frågorna:** av (standard), 30 eller 60 sekunder.
- **Lugnt läge:** av eller på. Det ger färre effekter, ingen publik som jublar, inga skakningar och dämpade ljud.
- **Påminnelse om paus:** av, 30, 45 eller 60 minuter (standard 60). Efter den tiden visas "Bra jobbat! Dags för en paus." efter nästa slutsignal. Det är bara en påminnelse och spärrar ingenting.
- **Återställ lagnamn:** om eleven har skrivit något olämpligt.

Spara i `matchdagenInst/{uid}`. Den kan skrivas av en lärare med `hasStudent(uid)` och läsas av eleven själv.

---

## 2. Frågekällorna

Bygg `src/matchdagen/md-fragor.js`: en ström av frågor för eleven utifrån `matchdagenInst`.

- **Återanvänd det som finns, och kopiera inte:**
  - **Plugga-områden:** quiz utan passage via `plainQuizPool`. Par blir flervalsfrågor av typen "Vad betyder X?", med samma omvandling som i `prov-fran-omrade.js`.
  - **Multiplikation:** Live-läget `multiplication_0_10` (`createSource`/`checkAnswer`), begränsat till de valda tabellerna.
  - **Räkna:** `rakna-core.js` (`createTopicBag`, `checkAnswer`).
- **Blandning:** källorna blandas jämnt. Samma fråga kommer inte tillbaka förrän eleven har gått igenom källans alla frågor (en "påse" per källa, sparad i `localStorage`).
- **Gränssnittet för svaren:** använd `createQuestionFlow` (`ks-fraga.js`) om det passar. Annars bygger ni en egen liten komponent med samma beteende:
  - **Stora knappar**, och tangenterna 1–4.
  - **Rätt svar:** visas grönt.
  - **Fel svar:** visar det rätta svaret i 1,5 sekunder innan spelet fortsätter. Eleven ska lära sig av felet.
- **Svårigheten är alltid elevens egen.** Inga nivåer kopplas till divisionen.
- **Saknas frågekällor** (läraren har inte valt något) visas "Din lärare har inte valt några frågor än" och ingen match kan startas.

---

## 3. Matchmotorn (ren)

`src/matchdagen/delat/md-motor.js`: en **tillståndsmaskin** som skissen. Ingen DOM.

### 3.1 Matchen

- **Matchklockan:** två halvlekar på 45 matchminuter. Varje läge flyttar klockan fram 3,5–6 minuter, vilket ger ungefär 8–10 lägen per halvlek och 6–8 minuter per match i verklig tid.
- **Halvtid:** en pausruta med ställningen och rätt svar hittills, och knappen **"Andra halvlek"**.
- **Planen:** bollens position är `x` 0–100 (0 = eget mål, 100 = motståndarens mål) och `y` 0–68.
- **Bollinnehav:** `oss` eller `dem`.

### 3.2 När vi har bollen: eleven väljer

| Val | Fråga | Lyckas (rätt svar / fel svar) | Effekt |
| --- | --- | --- | --- |
| **Kort pass** "Säkert" | 1 | 0,90 / 0,25 | Bollen 10–16 framåt |
| **Långt pass** "Riskabelt" | 1 | 0,72 / 0,10 | 22–32 framåt, hög båge |
| **Dribbla** | 1 | 0,68 / 0,12 | 12–16 framåt |
| **Skjut** | 1 (2 från Division 3, se 6.3) | se nedan | Mål, räddning, stolpe, utanför eller hörna |

- Sannolikheterna justeras med `+ lagbonus` och `− motståndarens styrka × faktor` (mittfältet för pass, anfallet för skott).
- **Misslyckas ett pass** tar motståndaren bollen där den är.
- **Skott:** man kan bara skjuta när avståndet till mål `d = 100 − x` är högst 45 meter. Knappens text beskriver läget: "För långt bort", "Långt skott – liten chans", "Bra läge" eller "Jätteläge!".
  - **Med rätt svar** är chansen till mål `kl(0,85 − d × 0,023; 0,03; 0,80) × (1 − motståndarstyrka × 0,35) + anfallsbonus`. Ett långskott går alltså nästan aldrig in, och **även ett perfekt avslut kan räddas**.
  - **Med fel svar** är chansen 0,03.
  - **Blir det inte mål** är det slumpen som avgör: målvaktsräddning, stolpe eller utanför. Efter en räddning efter rätt svar blir det **hörna** i 30 % av fallen: ett nytt skottläge nära mål, med en hög boll in.

### 3.3 När motståndarna har bollen

- **På motståndarens planhalva:** de spelar framåt automatiskt med 12–20 × (0,7 + styrka × 0,6). Det finns en liten chans (0,18 − styrka × 0,1 + mittfältsbonus) att deras pass går snett och bollen blir vår.
- **På vår planhalva:** eleven väljer **Tackla** (vinner bollen med 0,66 vid rätt svar, 0,12 vid fel) eller **Täck** (0,38 vid rätt, 0,08 vid fel, men stoppar farten vid rätt svar). Justera med försvarsbonus och motståndarstyrka.
- **Motståndarnas skott** (när de är inom 24 meter från mål): **"Kan målvakten rädda?"** ger en fråga.
  - **Chansen att de gör mål** är `(0,5 + styrka × 0,3) × (1 − räddning)`.
  - **Räddningen** är `kl(0,62 + målvaktsbonus × 2 − styrka × 0,3; 0,2; 0,9)` vid rätt svar och 0,15 vid fel.

### 3.4 Efter mål och inspark

- **Efter ett mål** gör det andra laget avspark från mitten.
- **Efter en räddning eller ett skott utanför** blir det inspark från det egna målområdet.

### 3.5 Kommentatorn

Varje händelse ger en kort rad, och flera varianter slumpas. Exempel:

- "Snyggt passat!"
- "Rakt upp i krysset!"
- "Målvakten räddar med en fantastisk parad!"
- "Rätt svar, men motståndaren bröt passningen."

**Aldrig hånfullt.** Vid fel svar: "Fel svar – motståndaren tar bollen." Därefter visas det rätta svaret.

### 3.6 Statistik per match

Motorn räknar:

- ställningen och målen med matchminut
- skott och skott på mål
- pass och lyckade pass
- tacklingar och vunna bollar
- räddningar
- frågor och rätt svar per källa
- matchens längd i verklig tid

---

## 4. 3D-planen

- **three.js:** använd versionen som redan finns i repot (`src/vendor/three/`) och laddningen i `kg-tre.js`. Bryt ut `harWebGL` och `laddaThree` till en delad modul om det behövs, utan att ändra Kurragömmas beteende.
- **Scenen**, som i skissen:
  - en plan med gräsränder och linjer (canvas-textur)
  - mål med nät
  - reklamskyltar med texterna "PLUGGPORTEN" och "MATCHDAGEN"
  - en läktare med publik (canvas-textur)
  - kvällsljus
- **Spelarna:** 7 per lag (7-mannafotboll), byggda av enkla former: ben med skor och strumpor, shorts, tröja i lagets färg, armar, huvud och hår. Målvakterna har egna färger. Varje spelare har en blob-skugga.
  - **Springanimation:** ben och armar svänger när spelaren rör sig.
  - **Spelarna vänder sig** mot bollen eller mot sitt mål.
  - **Den som har bollen** springer fram till den.
- **Lagkaptenen** (en av grundpelarna) bär kaptensbindel, och elevens **avatar** visas som en liten bricka ovanför kaptenen (`kg-avatar-bild.js`).
- **Bollen** rullar längs marken vid korta pass, går i en hög båge vid långa pass och hörnor, och flyger mot målet vid skott. Den har en egen skugga.
- **Kameran:** en tv-kamera från långsidan som mjukt följer bollen. Vid mål zoomar den in en kort stund.
- **Effekter:**
  - **Vid mål:** stort utrop "MÅÅÅL!", nätet buktar, publiken jublar och spelarna firar. Firandet är en kort animation.
  - **Vid räddning:** "RÄDDNING!".
  - **Vid halvtid och slutsignal:** en vissla.
- **Lugnt läge och `prefers-reduced-motion`:** inga zoomningar eller skakningar, och spelarna och bollen hoppar direkt till sina platser i stället för att animeras.
- **Prestanda:** minst 50 bilder per sekund på skolans HP-datorer i 1366 × 768. Mät och redovisa.
- **2D-reserv:** utan WebGL (`harWebGL() === false`) eller om laddningen misslyckas visas planen ovanifrån i SVG, som i skissens första version. Spelet fungerar identiskt.
- **Ljud:** korta, mjuka ljud (vissla, spark, jubel, publikens sorl i bakgrunden), med en knapp för av och på som kommer ihåg valet. I lugnt läge är jubel och sorl avstängda.

---

## 5. Säsongen i Division 6 (Etapp 1)

- **Ny klubb:** första gången får eleven döpa sitt lag (1–24 tecken) och välja en av 8 tröjfärger. Laget går att döpa om senare under **Truppen**.
- **Spelarna har färdiga namn**, som i Football Manager. De går **inte** att döpa om.
- **Ligan:** Division 6 har **6 lag** och spelar en enkelserie, alltså **5 omgångar**. Schemat görs med round robin enligt cirkelmetoden.
- **Motståndarlagen** har påhittade namn ur en lista med minst 60 namn (som "Ekebacka IF", "FC Stjärnbo" och "Sjöviks BK") och egna färger. De har en dold styrka: `styrka(div) = kl(0,20 + div × 0,09 ± 0,05; 0,12; 0,92)`, där `div` är 0 för Division 6.
- **Övriga matcher** i omgången räknas fram med `simMal(styrka, motståndarstyrka)` efter elevens match.
- **Tabellen:** placering, lag, spelade, vunna, oavgjorda, förlorade, mål och poäng (3, 1, 0). Den sorteras på poäng, målskillnad och gjorda mål. Det egna laget markeras.
- **Före avspark:** en ruta visar "Säsong 1 · Division 6 · Omgång 2 av 5", lagen och knappen **Avspark!**.
- **Efter matchen:** en ruta visar resultatet, rätt svar, skott, lyckade pass och pengar till klubbkassan, och knappen **"Till tabellen"**. Efter sista omgången visas i stället **"Se hur säsongen slutade"**.
- **Fortsätta senare:** en pågående match sparas lokalt (`localStorage`) efter varje läge. Om eleven laddar om sidan eller går därifrån kan matchen fortsätta där den slutade.

---

## 6. Sparning och statistik

### 6.1 Datamodellen

```
matchdagen/{uid}                         ← elevens karriär (eleven skriver)
  klubb: { namn, farg, legendStjarnor }
  div, sasong, kassa
  trupp: [{ id, namn, pos: "MV"|"FÖR"|"MIT"|"ANF", st: 1..5, xp: 0..99, grundpelare, kapten }]
  reserver: [...]                        (Etapp 2, högst 5)
  marknad: [...]                         (Etapp 2)
  liga: { lag: [{ id, namn, farg, styrka }], schema, tabell, omg }
  kval?, cup?, mastarcup?                (Etapp 2–3)
  pokaler: [{ typ, namn, sasong, datum }]
  rekord: { ... }                        (Etapp 2)
  summa: { matcher, v, o, f, gjorda, inslappta, fragor, ratt, perKalla: { [nyckel]: { fragor, ratt } }, spelminuter }
  senast: timestamp
  version

matchdagen/{uid}/matcher/{id}            ← en per spelad match (skrivs en gång)
  datum, sasong, div, typ: "liga"|"kval"|"cup"|"mastarcup"|"vanskap",
  mot, oss, dem, straffar?, mal: [{ min, lag }], stat: { ...3.6 }, fragor, ratt, perKalla, sekunder
```

**Regler:**

- **Läsa:** eleven själv (`isSelf`) och en lärare med `hasStudent(uid)`.
- **Skriva `matchdagen/{uid}`:** bara eleven själv.
  - **Validera form och storlek:** högst 200 kB, kända fält, `div` 0–7 och `st` 1–5.
  - **Läraren** får ändra **endast** `klubb.namn`, alltså återställa lagnamnet.
- **`matcher`:** bara `create` av eleven själv. Ingen ändring, och radering bara av admin.

Klubbkassan är spelets egen valuta. Den har inget med pluggmynt att göra, och Matchdagen ger **inga pluggmynt**.

### 6.2 När det sparas

- `matchdagen/{uid}` uppdateras **en gång** efter varje match, efter varje träningsläger och vid köp på marknaden.
- `matcher/{id}` skapas **en gång** per match.
- Spelminuter räknas lokalt och sparas med matchen.

### 6.3 Elevens statistik (fliken "Statistik")

- **Siffror:** matcher, vinster–oavgjorda–förluster, gjorda mål, andel rätt svar och spelade timmar.
- **Rätt per ämne och källa:** staplar.
- **De senaste 20 matcherna:** datum, motståndare, resultat och rätt svar. En match går att klicka på för detaljer.
- **Säsongshistorik:** säsong, division och placering.
- **Pokalskåpet** (se 9) och **rekorden** (Etapp 2).

### 6.4 Lärarens statistik

- **Underfliken "Matchdagen"** i klassens **Hur går det?** visas bara om någon elev i klassen har Matchdagen.
- **Tabellen**, med en rad per elev som har åtkomst:
  - speltid de senaste 7 dagarna och totalt
  - matcher
  - andel rätt totalt och per källa
  - division och säsong
  - senast spelat
- **Ett klick på en elev** öppnar historiken: de senaste matcherna (läses först då), utvecklingen av andelen rätt per vecka som en liten linje, och lagnamnet med knappen **Återställ lagnamn**.

---

# ETAPP 2 – HELA KARRIÄREN

## 7. Divisionerna, kvalet och straffarna

### 7.1 Stegen

| Nivå (`div`) | Namn | Lag | Omgångar |
| --- | --- | --- | --- |
| 0 | Division 6 | 6 | 5 |
| 1 | Division 5 | 6 | 5 |
| 2 | Division 4 | 8 | 7 |
| 3 | Division 3 | 8 | 7 |
| 4 | Division 2 | 10 | 9 |
| 5 | Division 1 | 10 | 9 |
| 6 | Elitligan | 12 | 11 |
| 7 | Superligan | 12 | 11 |

**Stegen visas överst i tabellen**, med den nuvarande divisionen markerad.

### 7.2 Upp, aldrig ned

- **Bara ligavinnaren** får gå vidare. Den får en pokal och spelar en **kvalmatch** mot ett lag från divisionen ovanför, med styrkan `styrka(div + 1)`.
- **Vinner man kvalet** går man upp en division och får en pokal ("Kvalade upp till Division 3").
- **Förlorar man kvalet** stannar man kvar och får en ny chans nästa säsong.
- **Ingen åker ner**, oavsett placering.
- **Efter säsongen** visas rutan **"Starta nästa säsong"**, och den nya ligan lottas med nya motståndare.

### 7.3 Det blir tuffare utan svårare frågor

Högre upp blir det tuffare på fyra sätt, men **frågorna blir aldrig svårare**:

- **Starkare motståndare:** fler chanser, fler räddningar och fler brutna pass.
- **Fler lag och fler omgångar** (tabellen ovan).
- **Från Division 3 kräver ett skott två rätt i rad:** först "Finta bort försvararen!" och sedan skottet. Fel på den första frågan ger skottchansen 0,03.
- **Dyrare och bättre spelare på marknaden** (se 8).

### 7.4 Straffar

Om ett kval, en cupmatch eller en match i Mästarcupen slutar oavgjort blir det straffläggning:

- **Fem straffar var**, och därefter sudden death.
- **Elevens straffar:** varje straff ger en fråga. Chansen till mål är 0,82 vid rätt svar och 0,20 vid fel.
- **Motståndarens straffar:** "Kan målvakten rädda?" ger en fråga. Chansen att de gör mål är 0,45 vid rätt svar och 0,85 vid fel.
- **Visningen:** ställningen syns hela tiden, till exempel "Straffar 3 – 2". Kameran visar straffpunkten.
- **Avgörandet:** tävlingen avgörs så fort ena laget inte längre kan komma ikapp.

---

## 8. Truppen, marknaden och träningslägret

### 8.1 Truppen

- **Startelvan:** 7 spelare, med 1 målvakt, 2 försvarare, 2 mittfältare och 2 anfallare.
- **Varje spelare har:** ett namn, en position, 1–5 stjärnor och träningspoäng (`xp`).
- **Lagbonus per lagdel:** `(snittstjärnor − 2) × 0,05`. Den påverkar pass (mittfältet), skott (anfallet), tacklingar (försvaret) och räddningar (målvakten).
- **Visning:** en förklaring står i Truppen: "Bättre spelare ger bättre chans, men rätt svar avgör ändå mest."

### 8.2 Grundpelarna

- **De sju spelarna man börjar med** är klubbens **grundpelare**, alla med 2 stjärnor. De märks med "Grundpelare".
- **En av dem är lagkapten** (se 4).
- **Grundpelarna säljs aldrig.** Ersätts en grundpelare av en köpt spelare flyttas grundpelaren till **reserverna** (högst 5) och kan byta tillbaka in när som helst.

### 8.3 Marknaden

- **Utbudet:** 6 spelare till salu, som byts ut efter varje match.
- **Stjärnor:** `kl(avrunda(slump(2; 3,2 + div × 0,3)); 2; 5)`.
- **Priset:** `avrunda(150 × st^1,9; 10)`, vilket ger ungefär 560, 1 210, 2 080 respektive 3 150 kr för 2–5 stjärnor.
- **Köp:** den köpta spelaren ersätter den sämsta på samma position. Är det en köpt spelare säljs den för halva priset, och är det en grundpelare flyttas den till reserverna. Om reserverna är fulla måste eleven först välja vem som släpps (bara köpta spelare kan släppas).
- **Klubbkassan:** startar på 600 kr.
  - **Varje match ger** grundbelopp (300 vid vinst, 150 vid oavgjort, 80 vid förlust), plus 15 per rätt svar och 25 per mål, multiplicerat med `(1 + div × 0,25)`.
  - **Ett vunnet kval** ger 600 × multiplikatorn.

### 8.4 Träningslägret

- **Ett träningsläger per spelad omgång**, och ett extra före kvalet. Det gör att eleven varvar match och träning.
- **Gången:** eleven väljer en spelare med färre än 5 stjärnor och svarar på **8 frågor**.
- **Belöning:** varje rätt svar ger **12 träningspoäng**, och vid 100 får spelaren en stjärna till och poängen räknas om från 0.
- **Visning:** stjärnan firas med texten "Selma Lind fick en stjärna till!". En stapel per spelare visar hur långt det är till nästa stjärna.
- **Sparning:** frågorna räknas in i statistiken som källan "träning".

## 9. Cupen och rekorden

### 9.1 Silverpokalen, en cup varje säsong

- **Upplägg:** en utslagsturnering med **4 omgångar** (sextondel, kvart, semi och final).
- **Schemat:** cupmatcherna läggs in mellan ligamatcherna. Med 5 omgångar i ligan spelas en cupmatch efter omgång 1, 2, 3 och 4, och fördelningen blir på samma sätt jämn med fler omgångar.
- **Motståndarna** lottas från divisioner inom ±2 från elevens egen, alltså även från högre divisioner. **Skrällar ska vara möjliga.**
- **Oavgjort** avgörs på straffar.
- **Förlorar man** åker man ur för den säsongen.
- **Vinner man** får man en pokal och 400 kr × multiplikatorn.

### 9.2 Rekorden

Rekorden sparas i `rekord` och visas i Statistik:

- flest mål på en match och på en säsong
- största seger
- längsta svit utan förlust
- flest ligatitlar i rad
- obesegrad säsong (ja/nej)
- bästa andel rätt svar på en säsong (minst 3 matcher)
- snabbaste mål (matchminut)

**När eleven slår ett rekord** visas det direkt efter matchen: "Nytt rekord: 5 mål i en match!".

---

# ETAPP 3 – TOPPEN

## 10. Superligan, Mästarcupen och legendklubben

### 10.1 Superligan

**När man vinner Superligan** blir man **mästare**. Det ger en stor pokal, en firandescen med fyrverkerier i lugnt tempo och en guldkant på klubbmärket. Därefter spelar man vidare i Superligan säsong efter säsong för att **försvara titeln**. Rekordet "flest ligatitlar i rad" följs.

### 10.2 Mästarcupen

- **Inbjudan:** efter en vunnen Superliga blir klubben inbjuden till **Mästarcupen** nästa säsong. Den spelas vid sidan av ligan.
- **Motståndarna** är påhittade toppklubbar från andra länder, till exempel "Real Solvik", "AC Nordstjärna", "Atlético Vindmar" och "Sporting Kustby". Deras styrka är 0,86–0,95.
- **Upplägg:** utslagning med kvartsfinal, semifinal och final. Oavgjort avgörs på straffar.
- **Finalen** får en egen känsla:
  - ett särskilt intro med "FINALEN"
  - fullsatt läktare med flaggor
  - ett större jubel
  - en egen pokal som lyfts i slutscenen
- **Vinnaren** får den största pokalen i spelet.

### 10.3 Legendklubb

- **När den visas:** efter en vunnen Mästarcup erbjuds eleven: **"Starta en legendklubb"**.
- **Vad som händer:** en ny klubb startar från Division 6, med nytt namn, nya grundpelare, nollställd kassa och ny marknad.
- **Det som följer med:**
  - pokalskåpet
  - rekorden
  - en **guldstjärna** på klubbmärket för varje klubb eleven har tagit hela vägen
- **Den gamla klubben** sparas i `klubbhistorik` med namn, säsonger och pokaler, och visas i Statistik.
- **Inget tvång:** eleven kan också välja att fortsätta i Superligan.

### 10.4 Pokalskåpet

- **Skåpet** är en egen vy med tecknade pokaler (SVG), en per sort:
  - divisionsvinst
  - uppflyttning genom kval
  - Silverpokalen
  - Superligan
  - Mästarcupen
- **Antal:** varje pokal visar hur många gånger den har vunnits, och vilka säsonger det var.

---

# ETAPP 4 – MOT VARANDRA

## 11. Vänskapsmatcher i realtid

### 11.1 Vem kan möta vem

En elev kan bara utmana elever **i samma klass som också har Matchdagen**. Med två elever med åtkomst blir det alltså de två.

### 11.2 Lobbyn och utmaningen

Följ mönstret från schacket (`docs/SCHACK.md`) med callables i `europe-west1`:

- `mdUtmana({ classId, till })` och `mdSvara({ utmaningId, ja })`. En utmaning försvinner efter 2 minuter.
- **Bara en vänskapsmatch åt gången** per elev.

### 11.3 Matchen

- **Samma motor** (`md-motor.js`, synkad till `functions/matchdagen/` med ett `admin/sync-matchdagen-functions.mjs` enligt Kurragömmas mönster) och samma 3D-plan.
- **Lagen:** varje elev spelar med **sitt eget lag**, med sin egen trupp och lagbonus. Motståndarens lag visas med det namnet och den färgen.
- **Varje läge:**
  1. Servern skapar läget och avgör vem som anfaller.
  2. **Anfallaren** väljer kort pass, långt pass, dribbling eller skott, och **försvararen** väljer tackla eller täck. Ett skott ger målvaktsräddning automatiskt.
  3. **Båda får varsin fråga** ur **sina egna** frågekällor: `mdFraga` skriver frågan till spelarens privata dokument, utan facit.
  4. **Båda svarar** med `mdSvar`, och **servern rättar svaret** med samma rättning som Live (`functions/kistspel-rattning.js` för multiplikation och quiz, och rakna-rättningen för generatorn).
  5. **Servern avgör läget** med motorn, där både anfallarens och försvararens svar och lagbonus räknas in. Den skriver resultatet till matchdokumentet. Båda klienterna lyssnar på det dokumentet (`onSnapshot`) och visar animationen.
- **Rättvist för båda:** var och en svarar på frågor på sin egen nivå och i sina egna ämnen.
- **Tid per läge:** 60 sekunder som standard, eller elevens inställda klocka om den är kortare. Ett uteblivet svar räknas som fel. Den som inte har gjort något på 3 minuter förlorar matchen på walkover.
- **Halvtid och straffar** som i solospelet. Oavgjort är tillåtet i vänskapsmatcher, så de har inga straffar.

### 11.4 Efteråt

- **Påverkar inte ligan.** Matchen sparas som `typ: "vanskap"` i båda elevernas `matcher`. Servern skriver det, eftersom den känner båda.
- **Inbördes möten:** `inbordes: { [motståndarUid]: { v, o, f } }` i `matchdagen/{uid}`, skrivet av servern. Det visas som "Blixtarna IF – FC Omar: 3–1–2".
- **Klubbkassan:** 100 kr för deltagande och 100 kr extra vid vinst, för högst 3 vänskapsmatcher per dag och elev.

### 11.5 Regler

- Klienten skriver ingenting i duellsamlingarna. Allt går via callables.
- **Spelarna** läser matchdokumentet och sitt eget privata dokument. **Läraren** med `hasClass` läser allt.

---

# 12. Balans

Skriv ett simuleringsskript, `admin/md-balans-sim.mjs` (`npm run balans:matchdagen`). Det spelar tusentals matcher med motorn och påhittade elever som svarar rätt med en viss sannolikhet. **Målen:**

| Simulerad elev | Mål |
| --- | --- |
| 70 % rätt, startlag, Division 6 | Vinner cirka 55–65 % av matcherna. Vinner ligan ungefär varannan säsong. |
| 50 % rätt, startlag, Division 6 | Vinner cirka 30–40 %. Kan vinna ligan med lite tur och träning. |
| 80 % rätt, tränat lag (snitt 4★), Superligan | Vinner cirka 45–55 %. Mästarcupen vinns sällan, ungefär var femte försök. |
| 30 % rätt | Gör minst ett mål i hälften av matcherna. Ingen ska förlora varje match med stora siffror. |

**Övriga mål:**

- **Antal mål:** i snitt 1,5–4 mål totalt per match. Inga resultat som 9–0, utom vid extremt stora skillnader.
- **Matchlängden:** 6–8 minuter, där varje svar räknas som 8–12 sekunder och animationerna ingår.
- **Säsongslängden i Division 6:** cirka 45–60 minuter med träningslägren inräknade.
- **Ekonomin:** en elev med 60 % rätt ska kunna köpa en 3-stjärnig spelare efter ungefär 3 matcher i Division 6.

Justera talen i `md-config.js` tills målen nås, och redovisa resultatet. Skriv ett kort balanstest (som i Kurragömma) som fäller en konfiguration utanför målen.

---

# 13. Kvot

**Räkna och redovisa:**

- **Eleven under en timme**, med cirka 7 matcher och 5 träningsläger. Målet är under 50 skrivningar och 20 läsningar.
- **Läraren** som öppnar fliken Matchdagen för en klass med 2 elever som har åtkomst.
- **En vänskapsmatch:** callables, skrivningar och lyssnare.

**Regler för kvoten:**

- Inga lyssnare i solospelet.
- Elevens dokument läses en gång när Matchdagen öppnas.

---

# 14. Elevens sidor och utseende

**Följ skissen:**

- **Flikarna** Match, Tabell, Truppen och Statistik, plus Pokalskåpet i Etapp 3.
- **Klubbkassan** i sidhuvudet.
- **Resultatskylten** som på tv: lagkort, resultat och matchminut.
- **Frågekortet** direkt under planen, och kommentatorns rad mellan.

**Stil och tillgänglighet:**

- **Kvällsarena:** djup marin, gräsgrönt och skyltgult. Typsnitt Barlow Condensed och Nunito, som i skissen. Stilen bryter medvetet mot Pluggportens ljusa elevsidor, eftersom det ska kännas som en egen tv-sänd värld.
- **Tydlighet och tillgänglighet:**
  - stora knappar (minst 48 px)
  - tangenterna 1–4
  - tydlig fokusmarkering
  - god kontrast
- **Allt fungerar i 1366 × 768** utan att man behöver scrolla under en match: skylt, plan, kommentar och frågekort syns samtidigt.
- **Tonen:** uppmuntrande och lugn. Inga förolämpningar, och ingen skam vid förlust ("Förlust – nästa gång!").
- **Lagnamnet:** högst 24 tecken. Läraren kan återställa det (1.2).

---

# 15. Tester

**Motorn (node):**

- alla val med sina sannolikheter (med seedad slump)
- skott: långskott går nästan aldrig in, och ett perfekt avslut kan räddas
- hörnor, tacklingar, täckningar och räddningar
- matchklockan och halvtid
- straffläggningen med sudden death och tidigt avgörande
- två frågor för skott från Division 3
- schemat för 6, 8, 10 och 12 lag (alla möter alla exakt en gång)
- tabellsorteringen
- att kval, cup och uppflyttning aldrig flyttar ner ett lag
- marknaden, priserna och reserverna (grundpelare säljs aldrig)
- träningslägret, där 100 träningspoäng ger en stjärna och 5 stjärnor är taket
- rekorden
- legendklubben, där pokaler och rekord följer med
- determinism, så att samma frö ger samma match

**Frågekällorna:**

- varje källa ger giltiga frågor
- påsen upprepar inget förrän källan är slut
- inga valda källor ger meddelandet om saknade frågor

**Modulen per elev:**

- syns bara för valda elever, och aldrig för klasskamrater
- fokusläget spärrar den
- lärarens inställningar sparas och läses

**Regler (emulator):**

- eleven läser och skriver bara sitt eget dokument
- läraren med `hasStudent` läser och kan bara återställa lagnamnet
- `matcher` går bara att skapa, och storleksgränserna gäller
- i Etapp 4: klienten kan inte skriva i duellsamlingarna och kan inte läsa motståndarens fråga

**Functions (Etapp 4):**

- utmaning, svar, frågor, rättning och avgörande av läget
- walkover
- inbördes möten och dagstaket för kassan

**3D:** 2D-reserven utan WebGL, lugnt läge och bootgrafen.

**Förhandsvisningar:**

- `preview/preview-matchdagen.html` med stubbade data: en hel match, tabellen, truppen och straffar.
- `preview/preview-matchdagen-pokaler.html`: pokalskåpet och finalscenen.

---

# 16. Dokumentation, PR-ordning och rapport

**Dokumentation:**

- **Nytt dokument `docs/MATCHDAGEN.md`:**
  - arkitekturen och motorns API
  - alla tal och hur de balanserades
  - datamodellen och kvotbudgeten
  - hur en ny frågekälla läggs till
- **`docs/BEHORIGHETER.md`:** de nya samlingarna, `elevModuler` och alla callables.
- **`docs/DATAMODELL.md`** och **`docs/LARARSIDAN_STRUKTUR.md`:** fältet `elevModuler` och sektionen "Anpassningar per elev".

**PR-ordning:**

1. **Etapp 1a:** moduler per elev (`elevModuler`, synlighet, regler, tester) och sektionen "Anpassningar per elev" med `matchdagenInst`.
2. **Etapp 1b:** frågekällorna och matchmotorn (ren, med tester och första balanssimuleringen).
3. **Etapp 1c:** 3D-planen med 2D-reserv, matchvyn, säsongen i Division 6, sparningen och statistiken för elev och lärare.
4. **Etapp 2a:** alla divisioner, kval och straffar.
5. **Etapp 2b:** truppen, reserverna, marknaden och träningslägret.
6. **Etapp 2c:** Silverpokalen och rekorden.
7. **Etapp 3:** Superligan, Mästarcupen med finalscen, legendklubben och pokalskåpet.
8. **Etapp 4:** vänskapsmatcher (lobby, callables, synkad motor, rättning på servern, inbördes möten).

**Rapporten efter varje etapp:**

- vad som har byggts
- skärmdumpar (match i 3D och 2D, tabell, trupp, träningsläger, straffar och pokalskåp)
- uppmätta bilder per sekund på HP-datorn
- balanssimuleringens resultat
- kvotbudgeten
- vad som ska deployas (regler, index, functions) och i vilken ordning
- de val ni gjorde där dokumentet inte räckte till

Alla befintliga tester ska vara gröna.
