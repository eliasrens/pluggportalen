# Preview: Läsresan – 40 texter per nivå + lärarstyrda nivåer (epic #482)

Previewn körs mot Firestore-/Auth-**emulatorn**, så inget når produktionen.
Starta om den så här (ren data på ~30 s):

```bash
JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-482-preview.sh   # proxy på :8516
RESEED=1 bash admin/qa-lasresan-482-preview.sh                     # återställ data i en körande preview
```

Alla har lösenordet **lilla123**. Läraren heter **qalarare**. Logga in som eleven i ett **inkognitofönster**, så kan du vara inloggad som lärare samtidigt.

## Konton

| konto | vem | läge från start |
|---|---|---|
| `qalarare` | lärare | – |
| `qa-olast` | Oläst Olle, 4A | igång, nivå 3 |
| `qa-pagaende` | Pågående Pia, 4A | nivå 4, har en **påbörjad** text ("Myntet som vägrade försvinna") |
| `qa-oken` | Öken Ella, 4A | igång, nivå 5 |
| `elev1`, `qa-ny` | Astrid, Ny Nora, 4A | har **inte** börjat |
| `qa-b-anna`, `qa-b-bertil`, `qa-b-cesar` | QA-klass 5B | nivå 5, nivå 2 och ej börjat |
| `qa-6c-ny` | Ny Nils, 6C | har **inte** börjat |
| `qa-6c-igang` | Igång Ines, 6C | igång, nivå 5 |
| `qa-6c-sen` | Sen Sara | finns, men är **inte med i någon klass** än ("ny elev") |

Läsresan-nivån visas aldrig för eleven. Du ser vilken nivå en text kom från i lärarvyn: klicka på eleven och titta under **Senaste texterna → Nivå**.

## 1. Var finns det?
**Lärare →** logga in som `qalarare` → välj klass → fliken **Statistik** → **Läsresan**.
Ovanför tabellen finns två kort: **Ändra klassens startnivå** och **Ändra nivå för hela klassen**. Om du klickar på en elev i tabellen visas **Ändra nivå**.
(Obs: "📖 Läsnivå" under fliken Elever är den gamla läsförståelsens 3 nivåer och har inget med Läsresan att göra.)

## 2. En elev
1. QA-klass 4A → klicka **Oläst Olle** → välj Nivå 6 → **Spara nivå**. Du får "✓ Sparat … nivå 6".
2. Klicka **Pågående Pia** → välj Nivå 1 → Spara. Du får "Väntande nivå 1", och tabellen visar **4 → 1**.
3. Ladda om sidan. Båda ändringarna finns kvar.
4. Logga in (inkognito) som `qa-olast` → **Läsresan** → tryck på nästa steg. Texten kommer från nivå 6, t.ex. "Ön under isen". Svara på frågorna. Sammanfattningen visar rätt antal och pluggcoins.
5. Logga in som `qa-pagaende`. Först kommer den påbörjade nivå 4-texten. Läs klart den, tryck **Gå vidare** och sedan nästa steg. Nu kommer en nivå 1-text.
6. Tillbaka hos läraren: Pias detalj visar båda texterna under "Senaste texterna" (nivå 4 och 1). Lästa texter, rätt svar och pluggcoins har räknats vidare.

## 3. Hela klassen
1. I kortet **Ändra nivå för hela klassen**: välj **QA-klass 5B** och **Nivå 1** → **Ändra nivå för klassen…**
2. Dialogen visar **klass, antal elever (3) och nivå**. Tryck **Ja, sätt 3 elever till nivå 1**.
3. Välj QA-klass 5B i listan till vänster → Statistik → Läsresan. Alla tre har nu nivå 1, men deras texter och procent finns kvar.
4. Klicka på **Bertil B** och sätt nivå 4. Enskilda elever går att ändra efteråt.

## 4. Klassens startnivå (QA-klass 6C)
1. Välj **QA-klass 6C** → Statistik → Läsresan → **Startnivå: Nivå 1** → **Spara startnivå**. Ny Nils visar nu 1, och Igång Ines har kvar 5.
2. Ny elev: fliken **Elever** → **Lägg till befintliga elever** → bocka **Sen Sara** → **Lägg till valda**.
3. Logga in som `qa-6c-ny` och `qa-6c-sen`. Den första texten kommer från **nivå 1**. Logga in som `qa-6c-igang`. Hennes text kommer från **nivå 5**, så startnivån påverkar inte den som redan är igång.
4. Exemplet i specen: sätt nu även **hela klassen** 6C till Nivå 1. Ines visar "5 → 1". Hon läser klart sin påbörjade text och får sedan nivå 1.

## 5. Automatisk progression
Den fungerar som förut: 3 höga resultat i rad (≥ 70 %) ger +1 nivå, och 2 låga i rad (< 50 %) ger −1. Den börjar räkna från lärarens nivå.
Det är omständligt att klicka igenom, så det kontrolleras av `node admin/qa-lasresan-482-kontroll.mjs progression` (se QA-rapporten).

Mer: `docs/QA-RAPPORT-lasresan-482.md`.
