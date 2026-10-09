# Preview: Läsresan 10 nivåer i lärarvyn (#520, epic #516)

Körs mot Firestore-/Auth-**emulatorn** (inget når produktion):

```bash
JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-10-preview.sh   # proxy på :8541
RESEED=1 bash admin/qa-lasresan-10-preview.sh                    # återställ data
```

Lösenord **lilla123** för alla (endast emulator). Läraren heter **qalarare**. Gammal skala = lagrad
före #519 (inga `level10`-fält). Gammal nivå N visas som N+3.

## Läraren
1. **Lärare →**, logga in som `qalarare`. Välj **QA-klass 10N** → **Statistik** → **Läsresan**.
2. Kortet **Ändra klassens startnivå** visar **Nivå 6** (klassen har gammal startnivå 3).
   Väljaren har nivå 1–10, och texten förklarar att 1–3 är nya, enklare nivåer och att standard är 4.
3. Kolumnen **Läsresan-nivå**:

   | Elev | Lagrat | Visas |
   | ---- | ------ | ----- |
   | Gammal Gun | gammal 1 | 4 |
   | Gammal Gösta | gammal 3 | 6 |
   | Gammal Greta | gammal 7 | 10 |
   | Väntande Vera | gammal 3, väntande 2, påbörjad text | 6 → 5 |
   | Nio Nadja | ny 9 | 9 |
   | Lätt Lisa | ny 2 | 2 |
   | Ej Elin | har inte börjat | 6 (klassens startnivå) |

4. Klicka på **Gammal Greta**: nyckeltalet är 10/10 med 10 fyllda prickar. Under **Senaste texterna**
   har två gamla nivå 7-försök nivå **10** och ett gammalt försök utan id-konvention nivå **9**.
5. Klicka på **Gammal Gun**, välj **Nivå 9** och tryck **Spara nivå**. Svaret är "nästa text hämtas
   från nivå 9", och tabellen visar 9. Lagrat: `level10: 9` + spegeln `level: 6`.
6. Spara startnivå **Nivå 1**. Ej Elin visar 1. (`RESEED=1` återställer.)
7. **QA-klass 4A** (äldre seed, också gammal skala) visar "Nivå 4 (standard)". Eleverna där visas +3.

## Eleven
8. Logga in som `qa-10-g3` (Gammal Gösta) → **Läsresan**. Ingen nivå syns för eleven. Ett klick på
   nästa steg ger en nivå 6-text (t.ex. "Bråket i tvättstugan").
