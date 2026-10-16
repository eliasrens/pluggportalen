# Fokusläget (klass-lås) och modulregistret

Läraren kan låsa en klass till **ett mål** fram till ett klockslag (lärarsidan →
Klasser → Fokusläge). Målet är antingen ett Plugga-område eller en låsbar modul
(Läsresan, Mattematchen, Hitta rätt!, Ekvationsresan, Bråkresan). Datamodellen står i
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
