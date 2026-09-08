// ============================================================================
// Pluggportalen – fristående läsförståelse-texter om talsorter (åk4)
// ----------------------------------------------------------------------------
// Statiskt textinnehåll (title + body) enligt datamodellens texts[] (se
// src/validate.js). Skilt från den programmatiska frågegeneratorn
// (talsorter-generator.mjs) eftersom detta är handskriven faktatext, inte
// beräknade facit. Texterna driver läs-vyn och Läsförståelse-läget.
// ============================================================================

export const TALSORTER_TEXTS = [
  {
    id: "t-vad-ar-talsorter",
    title: "Vad är talsorter?",
    body:
      "Ett tal byggs upp av talsorter. De fyra vanligaste är ental, tiotal, hundratal och " +
      "tusental. Varje siffra i ett tal står på en bestämd plats, och platsen bestämmer siffrans " +
      "värde. I talet 3 482 står 3 på tusentalsplatsen, 4 på hundratalsplatsen, 8 på tiotalsplatsen " +
      "och 2 på entalsplatsen. Siffran 4 är alltså värd 400, eftersom den står på hundratalsplatsen. " +
      "Samma siffra kan vara värd olika mycket beroende på var den står.",
  },
  {
    id: "t-platsvarde",
    title: "Platsvärde",
    body:
      "Platsvärdet talar om hur mycket en siffra är värd utifrån sin plats. Längst till höger står " +
      "entalen, som är värda 1 styck. Nästa plats är tiotalen (värda 10), sedan hundratalen (värda " +
      "100) och sedan tusentalen (värda 1 000). För att räkna ut värdet av en siffra multiplicerar " +
      "du siffran med platsens värde. Siffran 6 på hundratalsplatsen är därför värd 6 × 100 = 600.",
  },
  {
    id: "t-vaxla",
    title: "Att växla mellan talsorter",
    body:
      "Talsorterna hänger ihop tio och tio. Tio ental blir ett tiotal, tio tiotal blir ett hundratal " +
      "och tio hundratal blir ett tusental. Det kallas att växla. När du räknar och kommer upp i tio " +
      "av en talsort växlar du upp till nästa. Har du 10 tiotal kan du växla dem till 1 hundratal. " +
      "Det är därför vårt talsystem kallas tiosystemet.",
  },
  {
    id: "t-jamfora",
    title: "Att jämföra tal",
    body:
      "När du jämför två tal börjar du med den största talsorten längst till vänster. Det tal som " +
      "har flest tusental är störst. Är tusentalen lika jämför du hundratalen, sedan tiotalen och " +
      "sist entalen. Talet 4 300 är större än 4 030, för fastän båda har 4 tusental har 4 300 fler " +
      "hundratal. Tecknet > betyder 'större än' och < betyder 'mindre än'.",
  },
  {
    id: "t-bygga-tal",
    title: "Att bygga tal av talsorter",
    body:
      "Du kan bygga ett tal genom att lägga ihop talsorterna. 2 tusental, 5 hundratal, 0 tiotal och " +
      "3 ental blir 2 000 + 500 + 0 + 3 = 2 503. Det är viktigt att skriva en nolla på de platser " +
      "där en talsort saknas, annars hamnar de andra siffrorna på fel plats. Utan nollan skulle " +
      "2 503 bli 253, ett helt annat tal.",
  },
  {
    id: "t-nollan",
    title: "Nollans roll",
    body:
      "Nollan är en platshållare. Den visar att en talsort saknas, men håller ändå de andra " +
      "siffrorna på rätt plats. I talet 5 070 finns inga hundratal och inga ental, men nollorna gör " +
      "att 5 hamnar på tusentalsplatsen och 7 på tiotalsplatsen. Tar man bort nollorna blir talet 57, " +
      "vilket är fel. Därför skriver vi alltid ut nollorna inuti ett tal.",
  },
];
