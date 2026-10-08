# Spec: Uppdatera Läsresan (epic #482)

_Ordagrann kopia av beställarens spec (Uppdatera_L_sresan.txt)._

Uppdatera den befintliga Läsresan. Den fungerar bra, så behåll nuvarande design, grundfunktioner och progression. Utöka textbanken och lägg till lärarstyrning av elevernas nivåer enligt följande.

**1. Utöka till 40 texter på varje nivå**

* Varje befintlig nivå ska innehålla minst 40 kompletta, unika texter.
* Behåll bra befintliga texter och komplettera till 40 per nivå.
* Följ respektive nivås befintliga krav på textlängd, ordförråd, meningsbyggnad och lässvårighet.
* Variera innehållet mellan exempelvis berättelser, vardagshändelser, djur, natur, fakta, äventyr och mysterier. Anpassa innehållet för mellanstadieelever även på de enklaste läsnivåerna.
* Varje text ska ha färdiga läsförståelsefrågor och korrekta svar enligt det frågeformat som redan används.
* Frågorna ska gå att besvara utifrån texten. Undvik otydliga frågor och flera möjliga rätta svar.
* Skapa hela innehållet, inte exempeltexter, platshållare eller små variationer av samma berättelse.
* Använd den befintliga hanteringen av genomförda texter för att prioritera texter eleven ännu inte har läst.

**2. Lärare ska kunna ändra en enskild elevs nivå**

Lägg till en tydlig funktion i lärarvyn där läraren kan se elevens nuvarande nivå och välja en annan av Läsresans befintliga nivåer.

När ändringen sparas ska den valda nivån styra elevens nästa text. Om eleven redan arbetar med en text ska den kunna slutföras innan ändringen börjar gälla.

En manuell nivåändring ska inte radera tidigare resultat, lästa texter, statistik eller intjänade belöningar. Därefter fortsätter den vanliga progressionen från den valda nivån.

**3. Lärare ska kunna ändra hela klassens nivå**

Lägg till funktionen ”Ändra nivå för hela klassen” i lärarvyn.

Läraren ska kunna:

* Välja klass.
* Välja nivå, exempelvis nivå 1.
* Tillämpa nivån på samtliga elever i den valda klassen.

Visa tydligt vilken klass, hur många elever och vilken nivå ändringen gäller innan läraren bekräftar.

Det ska exempelvis gå att sätta alla elever i en klass till nivå 1, även om de tidigare befunnit sig på olika nivåer. Ändringen ska styra deras nästa text och bevara tidigare resultat, statistik och belöningar. Läraren ska fortfarande kunna ändra enskilda elevers nivå efteråt.

**4. Klassens startnivå**

Läraren ska också kunna ange en standardstartnivå för klassen. Den används för elever som ännu inte har börjat Läsresan och för nya elever i klassen.

Skilj tydligt mellan:

* ”Ändra klassens startnivå” – gäller nya elever och elever som ännu inte börjat.
* ”Ändra nivå för alla elever” – ändrar även nivån för elever som redan är igång.

Exempel: Läraren ska kunna välja nivå 1 som klassens startnivå och samtidigt kunna sätta alla nuvarande elever till nivå 1.

**5. Spara och kontrollera**

Alla nivåinställningar ska sparas beständigt och finnas kvar efter omladdning och ny inloggning. Endast behöriga lärare ska kunna ändra nivåer för sina elever och klasser.

Verifiera att:

* Samtliga befintliga nivåer innehåller minst 40 kompletta texter med fungerande frågor och facit.
* Individuella nivåändringar och klassändringar styr vilken nivå nästa text hämtas från.
* Klassens startnivå används för nya elever och elever som ännu inte börjat.
* Tidigare elevresultat och belöningar finns kvar efter nivåändring.
* Läsresans befintliga funktioner och automatiska progression fortfarande fungerar.

Implementera hela uppdateringen i den befintliga Läsresan.
