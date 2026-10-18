# Fokusläget (klass-lås) och modulregistret

Läraren kan låsa en klass till **ett mål** fram till ett klockslag (lärarsidan →
Klasser → Fokusläge). Målet är antingen ett Plugga-område eller en låsbar modul
(Läsresan, Mattematchen, Hitta rätt!, Ekvationsresan, Bråkresan) – eller ett **provtillfälle**
(#740), som bara sätts från provets "Kör i klass"/"Öppna". Datamodellen står i
`docs/DATAMODELL.md` (ClassLock), logiken i `src/class-lock.js`.

## Under låset

| | Grundlås | + "Dölj allt annat" |
|---|---|---|
| Målet | öppet (även om modulen annars är dold) | öppet |
| Andra inlärningsmoduler (`learning: true`) | spärrade – meny **och** direktlänk | spärrade |
| Hus/värld, Shoppen, profil, Live | öppna | dolda |
| Avatarvalet (första inloggningen) | öppet | öppet |

Lägen *inom* ett Plugga-område (Quiz, Tidsjakten, Ämnesläsning, äventyr …) följer
områdeslåset: målområdets lägen är öppna, alla andra områden spärrade. Live styrs
som förut av sin egen synlighet och av "Dölj allt annat".

## Modulregistret

`STUDENT_MODULES` i `src/gamemode-visibility.js` är källan för elevens
top-nivå-moduler. **Ny modul = en rad där**, så följer:

- **sidomenyn** (`ui.js` NAV_LANKAR härleds ur registret, grupp `"ova"`),
- **modul av/på per klass** (`TOGGLABLE_MODULES` = registret utan `toggle: false`;
  `optIn: true` = av tills läraren slår på den),
- **routerns grind** (dold modul nås inte via direktlänk, `moduleForRoute`),
- **fokusläget**: `learning: true` gör att låset spärrar modulen när den inte är
  målet; `lockable: true` gör den valbar som mål (låstypen = modulens id).

Fälten beskrivs i kommentaren ovanför registret.

En modul som klassen har **dolt** (`hiddenModules`) eller inte slagit på (opt-in) är
gråad i målväljaren (#735) – utom om den redan är målet, så läraren kan flytta sluttiden.

**Schack** (#776, `docs/SCHACK.md`) är opt-in och `learning: true` men `lockable: false`:
fokusläget stänger schacket som alla andra moduler, men klassen kan inte låsas *till*
schack (det är bara för skojs skull och ger inga mynt).

## Så registreras en ny modul (Bråkresan, #735, är gjord så här)

1. Routen i `src/app.js` (`"/elev/brakresan": pageElevBrakresan`, dynamisk import – #271).
2. En rad i `STUDENT_MODULES`, t.ex.

   ```js
   { id: "brakresan", label: "Bråkresan", ikon: "🐉", grupp: "ova", learning: true, lockable: true,
     routes: ["/elev/brakresan"] },
   ```

3. Låsmål (`lockable: true`): lägg `'brakresan'` i `l.mal.typ in [...]` i
   `firestore.rules` → `validLockShape`. `test/class-lock.test.js` jämför
   reglernas lista med registret och fallerar om typen saknas.
   ⚠️ Kräver `firebase deploy --only firestore:rules` **innan** lärare kan låsa
   till modulen (annars nekas skrivningen). Uppdatera även listan i
   `docs/DATAMODELL.md` (ClassLock).
4. Opt-in-moduler: inget mer behövs – målväljaren gråar ut modulen tills klassen
   slagit på den. En modul som bara finns ibland (som Mattematchen) får
   `villkor:` + en rad i `ui.js` NAV_VILLKOR (menyn) och i
   `src/teacher-class-lock.js` MAL_VILLKOR (är målet valbart just nu?).
5. Uppdatera förväntningarna i `test/class-lock.test.js` och
   `test/module-visibility.test.js` (listorna är uttryckliga med flit).

Ett lås till en typ som klienten inte känner igen (t.ex. en gammal cachad klient)
räknas som **inget lås** – eleven låses aldrig ute.

## Prov: låset till ett tillfälle (#740)

Modulen `prov` har `lockId: "t"` och `lockRoute: "/elev/prov/skriv"` i registret.
Det betyder:

- `mal.id` **krävs** (provtillfällets id, 3–200 tecken) – i `normalizeLock` och i
  `validLockShape` (`l.mal.typ in ['omrade', 'prov']` ⇒ id). Utan id = inget lås.
- `lockHomeHash` = `#/elev/prov/skriv?t=<id>`: eleven hamnar **direkt i provet**.
- `lockLabel` = provets namn (`mal.namn`) i Fokus-rutan.
- Målet sätts inte i lärarens målväljare (Klasser → Fokusläge) utan från
  "Kör i klass" (§5.2): standardtid = tidsgränsen + 10 min, annars 60 min,
  "Dölj allt annat" ikryssat. Målväljaren visar ett aktivt provlås och kan flytta
  sluttiden. **Stäng provet** och **Radera** tar bort låset om det är just det
  tillfällets (`arProvetsLas`).
- ⚠️ Kräver `firebase deploy --only firestore:rules` innan "Lås klassen till provet"
  fungerar (annars nekas låset – provet öppnas ändå, läraren ser ett fel).
