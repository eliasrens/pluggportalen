# Preview: Läsresan 10 nivåer (slut-QA #525, epic #516)

Previewn körs mot Firestore- och Auth-**emulatorn**, så inget når produktion. Om du ändrar något
kan du återställa allt med `RESEED=1`.

```bash
JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-10-preview.sh   # FS 8540, Auth 9540, proxy 8541
RESEED=1 bash admin/qa-lasresan-10-preview.sh                    # återställ data
```

Alla konton har lösenordet **lilla123** (endast emulator). Läraren heter **qalarare**.
"Gammal skala" betyder data som sparades före 10 nivåer. Den gamla nivån N visas som N+3.

## 1. Läraren (Lärare → qalarare)
Välj **QA-klass 10N** → **Statistik** → **Läsresan**.

| Vad du ska se | Var |
| --- | --- |
| **Ändra klassens startnivå** visar **Nivå 6**. Klassen har den gamla startnivån 3, och 3 + 3 = 6. Väljaren har nivå 1–10, och texten förklarar att 1–3 är nya, enklare nivåer och att standard är 4 | kortet överst |
| Kolumnen **Läsresan-nivå**: Gammal Gun **4**, Gammal Gösta **6**, Gammal Greta **10**, Väntande Vera **6 → 5**, Nio Nadja **9**, Lätt Lisa **2**, Etta Ebba **1**, Trea Tore **3** och Ej Elin **6** (klassens startnivå) | tabellen |
| Klicka på **Gammal Greta**. Nivån är 10/10, och resultat, världar och pengar finns kvar. Under **Senaste texterna** har de gamla nivå 7-försöken nivå **10** | elevdetaljen |
| Välj **Nivå 1** för en elev och tryck **Spara nivå**. Du får svaret "nästa text hämtas från nivå 1", och tabellen visar 1 | elevdetaljen |
| Sätt startnivå **9** och tryck **Spara startnivå**. Ej Elin visar då 9, men eleverna som redan är igång ändras inte | startnivå |
| Välj **Ändra nivå för hela klassen**, till exempel **QA-klass 5B → Nivå 10**. Bekräfta. Alla tre eleverna får 10. Den som har en påbörjad text visar "x → 10" | hela klassen |

## 2. Eleven: läs en text på nivå 1, 2, 3 och 10
Logga ut och logga in som eleven. Gå sedan till **Läsresan** och klicka på det pulserande steget på kartan.

| Konto | Nivå | Vad du ska se |
| --- | --- | --- |
| `qa-10-n1` (Etta Ebba) | 1 | En kort text på ca 30–50 ord med 3–4 enkla frågor. Id:t börjar med `lr-g1-` |
| `qa-10-n2` (Lätt Lisa) | 2 | En text på ca 60–90 ord med 4–5 frågor |
| `qa-10-n3` (Trea Tore) | 3 | En text på ca 100–140 ord med 5–7 frågor |
| `qa-10-g7` (Gammal Greta) | 10 | En lång text med 9 frågor. Hon sparades som gammal nivå 7 |

För varje text ska du se följande:
- Texten syns hela tiden medan du svarar.
- När du svarar visas **✅ Rätt!** eller **❌ Fel** direkt.
- **Nytt:** svarar du fel blir ditt val rött och det **rätta svaret grönt** under 1,6 s innan nästa fråga kommer.
- Sammanfattningen visar till exempel "✅ 3 av 4 rätt +9", och pluggcoins i sidomenyn ökar med 3 per rätt svar.
- När du trycker **Gå vidare** går avataren ett steg på kartan. Greta är i Öknen och har Skogen klar.

Eleven ser aldrig sin nivå.

## 3. Gammal data blir rätt (migrering)
- Logga in som `qa-10-g3` (Gammal Gösta, gammal nivå 3). Han får en **nivå 6**-text.
- `qa-10-gp` (Väntande Vera) läser först klart sin påbörjade text. Den är på nivå 6. Nästa text kommer från nivå **5**, som var lärarens väntande nivå 2 i den gamla skalan.

## Bra att veta
- Under **Elever** finns också "📖 Läsnivå 1–3". Den hör till de gamla Läsuppdragen och **inte** till Läsresan.
- Emoji kan visas som rutor i headless Chrome. Det beror på fonten och är inget fel.
- Hela QA-rapporten finns i `docs/QA-RAPPORT-lasresan-10-nivaer.md`.
