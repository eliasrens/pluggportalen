# QA-rapport – Datakuppen: ändringar från klassrådet (#832)

Uppdrag: `datakuppen-klassradet.md` (filer, virus, hackning). Rapporten följer
uppdragets §14.

---

## 1. Nuläget (§0.2) – före ändringarna

Läst på `main` @ 34cad9d: `src/live/formats/datakuppen/delat/files-config.js`
(filtabellen), `delat/datakuppen-regler.js` + kistmotorn
`src/live/kistspel/delat/ks-regler.js` (slump, effekter, skydd),
`functions/kistspel-core.js` (svar + filöppning), `functions/datakuppen-hack.js`
(målval + gissning), `functions/datakuppen-koder.js` (koderna).

### 1.1 Alla filtyper

Vikterna summerar till **97** (inte 100) – sannolikheten är vikt/97.

| Fil (id) | Etikett | Vikt | Sannolikhet | Värde | Villkor |
| --- | --- | ---: | ---: | --- | --- |
| `liten_fil` | Liten fil | 22 | 22,7 % | +10 MB | – |
| `mapp` | Mapp | 20 | 20,6 % | +25 MB | – |
| `stor_fil` | Stor fil | 9 | 9,3 % | +50 MB | – |
| `serverhall` | Serverhall | 3 | 3,1 % | +100 MB | – |
| `overklockning` | Överklockning | 7 | 7,2 % | dubblar saldot, högst +150 MB | – |
| `virus` | Virus | 8 | 8,2 % | −10 % av saldot (avrundat nedåt) | ingen förlorar allt |
| `tom_mapp` | Tom mapp | 13 | 13,4 % | ingenting | – |
| `brandvagg` | Brandvägg | 6 | 6,2 % | skydd 60 s | – |
| `hack` | Hack | 9 | 9,3 % | välj mål → knäck koden → 15 % av målets data | bara när Hackning är på; ingen att välja → **Mapp (+25 MB)** |

Hackning av: Hackens vikt (9) fördelas på datafilerna (`effect: "gold"`) i
proportion till deras vikter (kistmotorns `chestTable`, samma regel som
Guldrushens "Stöld och byte av").

**Namnen i uppdraget ↔ koden.** Uppdraget talar om *liten mapp*, *vanlig
mapp* och *tom mapp*. Spelet har fyra datafiler (Liten fil 10, Mapp 25, Stor
fil 50, Serverhall 100). Vi läser *liten mapp* = **Liten fil** (`liten_fil`)
och *vanlig mapp* = **Mapp** (`mapp`). Se §7 (avvikelser) och §8 (frågor):
§3.2:s stoppregel "vanlig mapp ≤ 50 MB" slår till för varje tolkning.

### 1.2 Överklockning

- **Multiplikator ×2** – men den gäller **saldot**, inte kommande filer:
  `effect { kind: "double", cap: 150 }` dubblar elevens data direkt när filen
  öppnas, högst +150 MB.
- **Varaktighet:** ingen – den verkar i ögonblicket (inget tillstånd, inga
  svar eller sekunder).
- **Stapling:** nej (två Överklockningar = två separata dubblingar).

### 1.3 Virus

`effect { kind: "lose", share: 0.1 }` – tappar `floor(10 % × saldot)`. Taket i
motorn är 10 % (`loseCap`). Ingen kan hamna under 0. Kan komma på varje fil
(vikt 8). Viruset skrivs i händelseflödet och syns på projektorn ("🐛
Hoppsan! … fick ett virus").

### 1.4 Byta kod efter hack

**Fungerar inte enligt uppdraget.** Issue #719 (2026-10-15) tog medvetet bort
kodbytet: "koden behålls hela matchen". `guessCode` ger inga nya förslag,
`pickCode` avvisar ett nytt val (`failed-precondition` "Du har redan din kod –
den gäller hela matchen.") och elevvyn saknar "Välj ny kod". Bekräftat i den
befintliga testsviten (`test/functions-datakuppen-hack.test.mjs` "test 5 …
koden ligger kvar", "test 8 … efter skyddet hackar samma kod igen"). Uppdraget
§6.1 kallar regeln den viktigaste, så den återinförs (se §4 nedan).

### 1.5 Minnesmomentet

`liveSessions/{sid}/dkSecret/{hackarensUid}.hacks[målUid] = { codeVersion,
decoys[2], struck[], shown[] }`, bara servern läser (reglerna: `read: false`).
`codeVersion` ligger i målets `dkSecret/{målUid}`. Byter målet kod
(`codeVersion` +1) börjar minnet om vid nästa målval. "Känner till koden" =
`struck` innehåller båda `decoys` för målets aktuella `codeVersion`.

### 1.6 Skyddskontrollen (`protectedUntil`)

- **Målval** (`chooseTarget`): `victimProblem` → `isProtected` i transaktionen,
  i valets ögonblick. Skyddad → nekas (eget val) eller hoppas över (servern
  slumpar).
- **Gissning** (`guessCode`): `isProtected(mål, t)` i transaktionen. Skyddad
  → `result: "protected"`, och **hacket förbrukas** (`pending: null`). Det är
  det klassrådet upplevde som orättvist.
- Brandväggen (`openChest`) och gissningen skriver båda målets
  `dkPlayers`-dokument i varsin transaktion och serialiseras därför av
  Firestore.
