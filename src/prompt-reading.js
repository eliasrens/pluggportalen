// ============================================================================
// Pluggportalen – AI-prompt för läsförståelse i 3 nivåer (prompt-reading.js)
// ----------------------------------------------------------------------------
// Läsförståelse 2.0 (issue #152): läraren genererar EN läs-text där samma tema
// finns i tre språkliga svårighetsnivåer. AI:n svarar med JSON i exakt det format
// som src/validate-reading.js validerar. Prompten ber om ALLA tre nivåerna i ett
// svep – nivå 1 kortare/enklare språk, nivå 3 längre/mer avancerat, men SAMMA
// fakta – och egna kryssfrågor anpassade till respektive nivås text.
//
// Fragmenten hålls här; prompts.js re-exporterar buildReadingPrompt så lärar-UI:t
// har en enda import-yta.
// ============================================================================

// Exempel-JSON: en komplett läs-text i tre nivåer (visas som mall i lärar-UI:t
// och stoppas in i prompten så AI:ns svar passerar valideringen direkt).
export const READING_EXAMPLE_JSON = `{
  "title": "Vikingarnas resor",
  "levels": {
    "1": {
      "body": "Vikingarna bodde i Norden för länge sedan. De var bra på att bygga båtar.\\n\\nMed sina båtar reste de långt bort. Ibland handlade de med andra folk. Ibland tog de saker med våld.",
      "questions": [
        { "question": "Var bodde vikingarna?", "options": ["I Norden", "I Afrika", "I Kina", "I Amerika"], "answerIndex": 0 },
        { "question": "Vad var vikingarna bra på att bygga?", "options": ["Båtar", "Bilar", "Hus av glas", "Flygplan"], "answerIndex": 0 },
        { "question": "Vad gjorde vikingarna ibland när de reste?", "options": ["Handlade med andra", "Sov hela tiden", "Byggde skolor", "Odlade ris"], "answerIndex": 0 }
      ]
    },
    "2": {
      "body": "Vikingarna levde i Norden för mer än tusen år sedan. De var skickliga båtbyggare och byggde snabba, smala skepp.\\n\\nMed skeppen kunde de resa långa sträckor över havet. På resorna handlade de med varor som pälsar och silver, men de plundrade också byar längs kusterna.",
      "questions": [
        { "question": "Ungefär hur länge sedan levde vikingarna?", "options": ["Mer än tusen år sedan", "För hundra år sedan", "För tio år sedan", "I framtiden"], "answerIndex": 0 },
        { "question": "Vad kännetecknade vikingarnas skepp?", "options": ["Snabba och smala", "Stora och långsamma", "Gjorda av sten", "Utan segel"], "answerIndex": 0 },
        { "question": "Vilka varor handlade vikingarna med?", "options": ["Pälsar och silver", "Datorer", "Bananer", "Glasögon"], "answerIndex": 0 },
        { "question": "Vad gjorde vikingarna förutom att handla?", "options": ["Plundrade byar", "Byggde tåg", "Spelade fotboll", "Målade tavlor"], "answerIndex": 0 }
      ]
    },
    "3": {
      "body": "Vikingarna levde i Norden under perioden ungefär år 800 till 1050. De var kända som ovanligt skickliga skeppsbyggare och konstruerade långskepp som var både snabba och sjövärdiga.\\n\\nTack vare skeppen kunde vikingarna företa långa expeditioner över öppet hav, ända till platser som England, Ryssland och till och med Nordamerika. Resorna hade flera syften: de bedrev handel med eftertraktade varor som pälsverk och silver, koloniserade nya områden, men genomförde också plundringståg mot kloster och kustsamhällen.",
      "questions": [
        { "question": "Under vilken period räknas vikingatiden?", "options": ["Cirka år 800–1050", "Cirka år 1500–1700", "Cirka år 0–200", "Cirka år 1900–2000"], "answerIndex": 0 },
        { "question": "Vad menas med att långskeppen var sjövärdiga?", "options": ["De klarade att segla på öppet hav", "De kunde flyga", "De var byggda av guld", "De sjönk lätt"], "answerIndex": 0 },
        { "question": "Vilka platser kunde vikingarna nå med sina skepp?", "options": ["England, Ryssland och Nordamerika", "Bara sin egen by", "Månen", "Australien"], "answerIndex": 0 },
        { "question": "Vilka olika syften hade vikingarnas resor?", "options": ["Handel, kolonisation och plundring", "Enbart semester", "Enbart fiske", "Enbart krig mot varandra"], "answerIndex": 0 }
      ]
    }
  }
}`;

const READING_SCHEMA = `Svaret ska vara EN läs-text som JSON med exakt dessa fält:
- "title": string – temat/rubriken (samma tema för alla tre nivåerna), t.ex. "Vikingarnas resor".
- "levels": objekt med nycklarna "1", "2" och "3" (alla tre OBLIGATORISKA). Varje nivå:
    { "body": string, "questions": [ ... ] }
    * "body" är läs-texten för den nivån. Skriv den i FLERA stycken – separera stycken
      med en tom rad (skrivs som \\n\\n i JSON-strängen).
    * SAMMA fakta och samma tema i alla tre nivåerna – bara språket och längden skiljer:
        · Nivå 1: kortast, enklast språk. Korta meningar, mycket vanliga ord.
        · Nivå 2: mellannivå. Lite längre text och något mer avancerade ord.
        · Nivå 3: längst och mest avancerad. Fler detaljer, längre meningar, rikare ordförråd.
    * "questions" är 3–5 KRYSSFRÅGOR (flerval) till just den nivåns text. Varje fråga:
        { "question": string, "options": [string, ...], "answerIndex": number, "explanation": string }
        - "options": 4 svarsalternativ (minst 2), alla olika och rimliga.
        - "answerIndex": 0-baserat index i "options" för det RÄTTA svaret (0 = första).
        - "explanation": VALFRI kort motivering (1–2 meningar).
    * Frågorna ska vara EGNA per nivå (nivå 1:s frågor ≠ nivå 3:s) och gå att besvara
      enbart utifrån den nivåns egen text. Anpassa frågornas svårighet till nivåns språk.`;

const READING_REGLER = `Viktiga regler:
- Svara med ENBART giltig JSON – ingen förklarande text före eller efter, inga \`\`\`-kodstaket.
- Använd dubbla citattecken runt alla nycklar och strängar. Inga avslutande kommatecken.
- Skriv på svenska. Nivå 1 riktar sig till de yngsta/svagaste läsarna, nivå 3 till de starkaste.
- Hitta INTE på fakta – håll dig till materialet nedan. Samma fakta i alla tre nivåerna.
- Skriv INTE ledtrådar i själva frågan om vilket alternativ som är rätt.
- Nya rader/stycken i "body" skrivs som \\n (tom rad mellan stycken = \\n\\n).`;

/**
 * Bygg AI-prompten som skapar EN läs-text i tre nivåer.
 * @param {string} [onskemal] – valfritt fritext-önskemål (tema/omfattning). Utan
 *   önskemål används en platshållare för bifogat material (PDF/lektionstext).
 * @returns {string} färdig prompt att kopiera.
 */
export function buildReadingPrompt(onskemal) {
  const text = (onskemal || "").trim();
  const material = text
    ? `Lärarens önskemål (inget material bifogas – utgå från beskrivningen nedan):
"${text}"
Skapa faktakorrekt, åldersanpassat innehåll om detta. Du får använda allmän, korrekt ämneskunskap – men hitta inte på felaktiga fakta.`
    : `Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

  return `Du hjälper en lärare att skapa en läsförståelse-övning för en studiesajt (grundskolan).

Skapa EN läs-text om samma tema i TRE språkliga svårighetsnivåer, som JSON i exakt det här formatet.
Målet är att samma klass ska kunna läsa om samma sak men på olika nivå: en svag läsare tar nivå 1,
en stark läsare nivå 3. Fakta och tema är identiska – bara språket och längden skiljer sig.

${READING_SCHEMA}

${READING_REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
${READING_EXAMPLE_JSON}

${material}`;
}
