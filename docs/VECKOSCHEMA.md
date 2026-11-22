# Veckoschema per klass

> **Utkast (#900, Del B – kärnan).** Lärarsidan (C), elevsidan (D) och Matchdagen under en
> lektion (E) byggs i egna issues och fyller på det här dokumentet.

Läraren lägger in klassens lektioner (dag, tid och ämne). Under en lektion ser eleverna
**bara det som hör till lektionens ämne**. Står det ingenting på schemat just nu syns allt
som vanligt. Schemat är **samma varje vecka**, och funktionen är **frivillig per klass**:
planeringen sparas, och kryssrutan "Aktivera veckoschemat" slår på och av när som helst.
Utan aktiverat schema märker eleverna ingenting.

Det är ett slags fokusläge, fast ändå inte: det låser inte till ett mål utan filtrerar på
ämne ([FOKUSLAGE.md](FOKUSLAGE.md)).

## Datamodellen

`classes/{id}.schema` (se [DATAMODELL.md](DATAMODELL.md), ClassSchema):

```
{
  pa:        bool,                                   // "Aktivera veckoschemat" (saknas = av)
  lektioner: [ { id, dag, start, slut, amne } ],     // högst 60
  koppling:  { [modulId | "matchdagen:tabeller"]: subjectId | null },
  updatedAt, updatedBy
}
```

- `dag` 1–5 (måndag–fredag), `start`/`slut` `"HH:MM"` (24 h, svensk tid), `start < slut`,
  `amne` = ett `subjects/{id}`. Lektioner samma dag överlappar inte (klienten nekar med ett
  tydligt besked, `lektionKrock`).
- **Kryssrutan och planeringen är två saker.** Att bocka ur (`pa: false`) raderar aldrig
  några lektioner.
- Ett ämne som tagits bort gör lektionen overksam.

**Behörighet** ([BEHORIGHETER.md](BEHORIGHETER.md)): samma lärare som får ändra klassens
fokusläge (`hasClass`, även årskurskontot för sina klasser). Eleverna läser klassdokumentet
som i dag och skriver det aldrig.

| Gräns | Var den prövas |
| --- | --- |
| vem som skriver (`hasClass`) | reglerna |
| exakt fälten `pa`, `lektioner`, `koppling`, `updatedAt`, `updatedBy`; `pa` bool | reglerna |
| `lektioner` en lista med högst 60 | reglerna (+ klienten: fler = inget schema) |
| `koppling`: bara kända nycklar, värdet ett ämnes-id ≤ 100 tecken eller `null` | reglerna (+ klienten) |
| `updatedAt` = serverns tid, `updatedBy` = den som skriver | reglerna |
| varje lektion: exakt fälten, `id`, `dag` 1–5, `"HH:MM"`, `start < slut`, `amne` ≤ 100 tecken | **bara klienten** (`normalizeSchema`) |
| inget överlapp samma dag | **bara klienten** (`lektionKrock`, lärarsidan) |

**Varför lektionerna bara prövas i klienten:** reglerna kan inte loopa, och en kontroll per
lektion, utrullad 60 gånger, når reglernas gräns på 1000 uttryck redan vid cirka tio
lektioner (uppmätt i emulatorn, #900). Samma sak gäller Prov `fragor`, som också prövas i
klienten (`validateProv`). `normalizeSchema` släpper en ogiltig lektion – fel typer,
saknade fält, `start ≥ slut`, `dag` utanför 1–5 – utan att kasta, så en lektion som skrivits
förbi klienten gör ingenting hos eleven. Bara klassens lärare kan skriva.

## Tiden

- Schemat gäller i **svensk tid (Europe/Stockholm)** oavsett datorns tidszon. Veckodag och
  klockslag räknas med `Intl.DateTimeFormat` (`timeZone: "Europe/Stockholm"`) på
  `serverNow()` – aldrig med `new Date().getHours()` (`src/klass-schema-tid.js`).
- **Start räknas med, slut räknas inte med:** 09:00–10:00 är aktiv från 09:00:00 till
  09:59:59.
- **Sommar- och vintertid** sköts av Intl; `nastaSvenskTid` rättar dessutom en omställning
  mellan nu och nästa ändring (fredag → måndag över omställningshelgen). Testat i
  `test/klass-schema.test.mjs`, även med `TZ` satt till en annan tidszon.

## Vad som är tillåtet under en lektion

| | Under en lektion |
| --- | --- |
| Plugga-områden i lektionens ämne som är synliga för klassen | öppna |
| Andra Plugga-områden | spärrade i meny **och** via direktlänk |
| Inlärningsmoduler (`learning: true`) kopplade till lektionens ämne | öppna, om de annars är synliga för eleven |
| Andra inlärningsmoduler, och moduler utan koppling (Schack) | spärrade |
| Matchdagen (för elever som har den) | öppen, med frågor bara ur lektionens ämne (Del E) |
| Hem/hus/värld, Shoppen, profil | öppna (som fokuslägets grundlås) |
| Prov, Live | som vanligt, påverkas inte |
| Avatarvalet | öppet |

**Synligheten bestäms aldrig av schemat.** Schemat kan bara minska det eleven ser: grindens
`isTarget` är alltid falsk, så modulgrinden (dolda/opt-in-moduler) gäller som vanligt.

**"Har man inte kryssat i ett NO-område, då är allt":** har lektionens ämne inga synliga
områden för klassen **och** ingen modul (som eleven annars ser) kopplad till ämnet,
filtrerar lektionen inget (`amnetsInnehall`). Synliga områden = klassens `assignedAreas`,
eller hela biblioteket när listan är tom (`amnenMedOmraden` = ämnen som har områden).

**En elev i flera klasser:** har någon av klasserna en aktiv lektion gäller filtret, och de
tillåtna ämnena är **unionen** av de aktiva lektionernas ämnen. Filtrerar en av lektionerna
inget blir unionen "allt". Synliga områden följer Plugga-listans regel (första klassen,
`getClassForStudent`) – både när grinden släpper in ett område och när det prövas om
lektionens ämne har några områden, så eleven aldrig får en helt stängd vy. Klockslaget är
det tidigaste slutet.

**Konsumenter av grinden:** `gate.lock` är `null` under en lektion. Den som läser
`gate.lock` prövar det först (provets väg vidare, `src/prov/prov-vidare.js`, visar då
"Till startsidan" som utan lås).

## Ämneskopplingen

Plugga-områden har ett ämne (`subjects/{subjectId}/areas`), modulerna har inget. Därför
har schemat en `koppling`:

| Nyckel | Förifylld (gissas ur ämnenas namn) |
| --- | --- |
| `lasresan` | "Svenska" / "Sv" |
| `brakresan`, `ekvationsresan`, `mattematchen` | "Matte" / "Matematik" / "Ma" |
| `hittaratt` | "SO" / "Geografi" |
| `matchdagen:tabeller` (Matchdagens multiplikationstabeller) | samma som matte |
| `schack` | ingen koppling (alltid `null`) |

- Gissningen (`gissaKoppling`) jämför tipsorden med ämnets namn och id: ett helt ord, eller
  början av namnet för tips på minst tre tecken ("Matematik åk 4" → matte, men inte
  "Mat och hälsa"). Första tipset som något ämne liknar vinner, i ämnenas ordning.
- **Lärarens sparade val går före gissningen** (`effektivKoppling`). En nyckel läraren inte
  valt gissas; ett sparat `null` betyder "inget ämne". En modul med `null` syns inte under
  en lektion. `okandaKopplingar` säger vilka moduler gissningen inte hittade något ämne för
  (lärarsidans "Vi vet inte vilket ämne … hör till – välj").
- **En ny modul** får en rad `amnesTips: [...]` i `STUDENT_MODULES`
  (`src/gamemode-visibility.js`) – och nyckeln i `firestore.rules` → `validSchemaKoppling`
  (`test/klass-schema.test.mjs` jämför listorna). `amnesTips: null` = aldrig något ämne.

Schemat ändrar aldrig *när* Mattematchen finns (bara under en aktiv period); det avgör bara
om den visas under just den lektionen.

## Samspelet med fokusläget

**Fokuslåset går alltid före schemat** (`kombineradGrind(lock, lage)`): har klassen ett
aktivt lås gäller låset och schemat ignoreras – även ett inlämnat prov med "klassens
vanliga läge" (där låsgrinden är `null`). När låset upphör och en lektion fortfarande pågår
tar schemat över direkt.

## Elevsidan (#902)

**Grinden.** `src/class-lock-watch.js` lyssnar redan på elevens klassdokument (fokusläget).
Samma omräkning ger nu låset **och** `schemaForStudent`, och `ui.getLockGate()` svarar med
**en** kombinerad grind (`kombineradGrind`: låset, annars schemat, annars `null`) – samma
form som förut, så routern och menyn frågar som vanligt. `onLockChange`-lyssnarna får
`(grind, förraLåset, nyttLåset, förraSchemat, nyttSchemat)`; schemaläget är `null` medan ett
lås gäller.

**Timern.** Som låset har en timer till `till` har schemat en timer till nästa ändring
(`nastaSchemaAndring`: nästa lektions start eller den pågående lektionens slut; den
tidigaste av lås- och schematiden vinner), med samma skyddsnät: 15 s-intervall och
flik-återkomst. Lektionens start och slut slår igenom utan omladdning, och lärarens
"Aktivera veckoschemat" i/ur slår igenom direkt via klassdokumentets onSnapshot.

**Det eleven märker.**

| Händelse | Det eleven ser |
| --- | --- |
| Lektionen pågår | Menyn visar inte det som är spärrat (ingen 🎯-ruta, ingen låsikon). Plugga-listan visar bara lektionens ämnesområden, överst "📅 Nu är det **NO** till 10.00" |
| Lektionen börjar | toasten "📅 Nu är det **NO** till 10.00." – står eleven i något spärrat skickas den till Plugga-listan (som när ett lås slår på). Ett pågående spel i ett tillåtet område lämnas orört |
| Direktlänk till något spärrat | Plugga-listan + "Just nu är det NO-lektion. Det här öppnas igen klockan 10.00." |
| Lektionen slutar | "Lektionen är slut – nu syns allt igen. 🎉" – en gång per lektion, bara för den som är inloggad då |
| Läraren bockar ur mitt i en lektion | "Nu syns allt igen." (lektionen tog inte slut) |
| Fokuslåset slår på / upphör under en lektion | fokuslägets toaster; när låset upphör: "Fokusläget är slut – nu är det NO till 10.00." |

En dold modul (modulgrinden, #412) leder som förut till huset med "Den delen är stängd för
din klass just nu." – schemat visar aldrig något som annars är dolt.

**Alla vägar in** går genom samma grind:

| Ingång | Hur |
| --- | --- |
| Menyn (sidomenyn, Live-rutan) | `renderTopbar` filtrerar länkarna med `gate.allows` (samma väg som låset) |
| Plugga-listan | `pageElevPlugga` listar bara `gate.allowsArea` (andra ämnen läses inte ens) |
| Områdessidan, spelen, äventyren (`/elev/omrade`, `/elev/spela`, `/elev/aventyr` med `subj`/`area`) | routern (`sparrMal` i `app.js`) → `schemaAllowsRoute` prövar området |
| Modulerna (Läsresan, Bråkresan, Ekvationsresan, Hitta rätt!, Mattematchen, Schack, Matchdagen) | routern – bara moduler kopplade till lektionens ämne öppnas |
| Genvägar på Hem/i husvärlden, "fortsätt där du var", områdeskort, länkar inne i modulerna | alla byter hash → routern grindar varje ny route |
| Grindbyte medan eleven står kvar | `onLockChange` i `app.js` grindar om den aktuella routen |
| Prov, Live, avatarvalet, hus/värld, Shoppen, profil | påverkas inte (B.5) |

**Kvot.** En klass utan aktiverat schema: **0 nya läsningar** (`schemaInfoBehov` → `null`,
inget hämtas). Med aktiverat schema hämtar bevakaren en gång per ändrat behov ämneslistan
(för ämnesnamnet och den gissade kopplingen) och – bara när klassen ser hela biblioteket –
lektionsämnenas områdeslistor, genom **samma TTL-cache som Plugga-listan** (`getSubjects`,
`getAreas`). Det är exakt läsningarna Plugga-listan gör, och under lektionen läser
Plugga-listan i stället bara lektionens ämnen. Inga nya lyssnare.

QA mot emulatorn: `admin/qa-veckoschema-902.mjs` sätter schema/lås via QA-proxyn
(`admin/qa-matchdagen-867-preview.sh`). Lärarsidans sektion är Del C (#901).

## Den rena logiken – `src/klass-schema.js`

Ingen Firebase, ingen DOM; laddas bara med `import()` (bootgrafen oförändrad, #271).

| Funktion | Gör |
| --- | --- |
| `normalizeSchema(v)` | säker form `{ pa, lektioner, koppling }` eller `null` (okänd form, > 60 lektioner). Ogiltiga lektioner, dubblerade id och okända kopplingsnycklar släpps |
| `aktivLektion(klass, now)` | lektionen som gäller just nu (`pa`, svensk tid, dag), annars `null` |
| `schemaForStudent(classes, meId, now, opts?)` | elevens schemaläge `{ amnen, moduler, tabeller, omraden, lektioner, label, klockslag, till, home }` eller `null`. `opts.subjects` ger ämnesnamnen och gissad koppling, `opts.amnenMedOmraden` vilka ämnen biblioteket har områden i |
| `gateForSchema(lage)` | samma gränssnitt som `gateFor`: `allows(path, query)`, `isTarget` (alltid falsk), `allowsArea(subjectId, areaId)`, `label`, `klockslag` (lektionens slut, `"HH:MM"`), `home` (Plugga-listan, eller huset om Plugga är dold), `fri: null`, `lock: null`, `schema` = läget |
| `kombineradGrind(lock, lage)` | låset om det finns, annars schemat, annars `null` |
| `nastaSchemaAndring(classes, meId, now)` | epoch-ms för nästa lektions start eller den pågående lektionens slut (D:s timer) |
| `schemaInfoBehov(classes, meId)` | vad elevens bevakare behöver hämta (ämnen, ev. lektionsämnenas områden), eller `null` – 0 läsningar utan aktiverat schema |
| `lektionKrock`, `nyttLektionsId`, `sorteradeLektioner`, `gissaKoppling`, `effektivKoppling`, `okandaKopplingar` | hjälp till lärarsidan |

`lage.matchdagen === false` spärrar Matchdagen under lektionen (sätts i Del E när ämnet
inte kan ge några frågor). Utan fältet är Matchdagen öppen.

## Kvot

Elevsidan: **0 nya läsningar** för en klass utan aktiverat schema – schemat ligger på
klassdokumentet som `class-lock-watch.js` redan bevakar. Med aktiverat schema: ämnena (och ev.
lektionsämnenas områden) ur Plugga-listans TTL-cache, se §Elevsidan. Lärarsidan: en skrivning per sparning.

## Deploy

⚠️ `firebase deploy --only firestore:rules` **före** webben (annars nekas lärarens
sparning av `schema`).
