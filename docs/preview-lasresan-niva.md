# Preview: Läsresans nivåstyrning (#506)

> Sedan epic #516 är skalan 1–10. Seedens elever är lagrade i **gammal skala** och
> visas +3 (t.ex. Pågående Pia: gammal 4 → **7**). Se även `docs/preview-lasresan-10.md`.

Körs mot Firestore-/Auth-**emulatorn** (inget når produktion):

```bash
JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-niva-preview.sh   # proxy på :8507
```

Lösenord **lilla123** för alla. Läraren heter **qalarare**.

## Läraren
1. Gå till **Lärare →** och logga in som `qalarare`. Välj **QA-klass 4A** → **Statistik** → **Läsresan**.
2. Ovanför tabellen finns två kort:
   - **Ändra klassens startnivå**. Den gäller nya elever och elever som inte har börjat. Just nu står det "Nivå 4 (standard)". Väljaren har nivå 1–10 (epic #516).
   - **Ändra nivå för hela klassen**. Den ändrar även elever som redan är igång.

### En elev
3. Klicka på **Oläst Olle**. Under **Ändra nivå** väljer du t.ex. Nivå 6 och trycker **Spara nivå**.
   Du får "✓ Sparat …", och nivån i tabellen blir 6.
4. Klicka på **Pågående Pia** (hon har en påbörjad nivå 4-text). Välj Nivå 1 och tryck Spara.
   Du får "väntande nivå 1", och tabellen visar **4 → 1**.
5. Ladda om sidan. Ändringarna finns kvar.

### Hela klassen
6. Välj klass (**QA-klass 4A** är förvald, men **QA-klass 5B** går också att välja), välj **Nivå 1** och tryck
   **Ändra nivå för klassen…**. Dialogen visar klassen, antalet elever och nivån. Bekräfta.
   Resultatet blir t.ex. "11 elever i QA-klass 4A satta till nivå 1" + "1 elev läser klart sin påbörjade text först".
7. Enskilda elever kan ändras efteråt, som i steg 3.

### Startnivå
8. Sätt startnivån till t.ex. **Nivå 2** och tryck **Spara startnivå**. Elever som inte har börjat
   (de som saknar egen nivå) visar då 2 i nivå-kolumnen.
   Exemplet i specen fungerar: sätt först startnivå 1 och därefter "hela klassen" till nivå 1.

## Eleven (gärna i ett inkognitofönster)
- **qa-pagaende**: Läsresan → nästa steg. Den påbörjade nivå 4-texten ("Myntet som vägrade försvinna")
  kommer först. När den är klar kommer nästa text från lärarens nivå (t.ex. nivå 1).
  Texter, rätt svar och pluggcoins räknas vidare.
- **elev1** (Astrid, har inte börjat): görs steg 8 FÖRE steg 6 hämtas hennes första text från klassens startnivå.
  Efter steg 6 har hon en egen lärarsatt nivå, och den vinner över startnivån.
- **qa-oken** (Öken Ella) m.fl.: nästa text kommer från den nivå läraren valde.

Nivån visas aldrig för eleven.
