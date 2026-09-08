// ============================================================================
// Seed-data för Pluggportalen (exempelinnehåll).
// Enda källan för exempeldata – används av seed/seed.html för att fylla
// Firestore. Kör om sidan när du vill återställa exempeldatan.
// ============================================================================

export const subjects = [
  { id: "so", name: "SO", order: 1, icon: "🌍", description: "Historia, geografi, samhälle och religion." },
  { id: "matte", name: "Matematik", order: 2, icon: "🔢", description: "Tal, räkning, geometri och problemlösning." },
];

// Arbetsområden per ämne. Varje område har texts[], quiz[], pairs[].
export const areas = {
  so: [
    {
      id: "vikingatiden",
      name: "Vikingatiden",
      order: 1,
      coverEmoji: "🛶",
      description: "Lär dig om vikingarna – hur de levde, reste och trodde.",

      // Faktatexter för läsförståelse.
      texts: [
        {
          id: "vem-var-vikingarna",
          title: "Vilka var vikingarna?",
          body:
            "Vikingarna levde i Norden för mer än tusen år sedan, ungefär mellan år 800 och 1050. " +
            "De bodde i det som idag är Sverige, Norge och Danmark. De flesta vikingar var bönder som " +
            "odlade säd och hade djur som kor, får och grisar. Men vikingarna är mest kända för sina resor. " +
            "Med sina snabba skepp seglade de långt bort för att byta varor, upptäcka nya platser och " +
            "ibland för att plundra. Ordet viking betyder ungefär att fara ut på en resa över havet.",
        },
        {
          id: "vikingaskeppen",
          title: "De snabba skeppen",
          body:
            "Vikingarnas skepp kallas långskepp. De var långa, smala och byggda av trä. Skeppen hade " +
            "ett stort segel av ylle och kunde också ros med åror när det inte blåste. Framme i fören " +
            "satt ofta ett snidat drakhuvud som skulle skrämma bort onda väsen. Skeppen var så bra " +
            "byggda att vikingarna kunde segla ända till Island, England och till och med Amerika, " +
            "långt innan andra européer kom dit.",
        },
        {
          id: "gudar-och-tro",
          title: "Gudar och tro",
          body:
            "Innan vikingarna blev kristna trodde de på många gudar. Oden var gudarnas kung och guden " +
            "för visdom och krig. Tor var stark och åkte i en vagn dragen av bockar. När det åskade " +
            "trodde man att det var Tor som svingade sin hammare Mjölner. Freja var kärlekens gudinna. " +
            "Vikingarna trodde att modiga krigare som dog i strid kom till Valhall, en stor sal hos Oden.",
        },
      ],

      // Quizfrågor (flerval). answerIndex pekar på rätt alternativ i options[].
      // "passage" (valfritt) är en kort text kopplad till JUST den frågan – den
      // visas ovanför frågan i läsförståelse-läget (och byts per fråga).
      quiz: [
        {
          id: "q1",
          question: "Ungefär när levde vikingarna?",
          options: ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"],
          answerIndex: 0,
          explanation: "Vikingatiden brukar räknas från cirka år 800 till 1050.",
          passage:
            "Vikingarna levde i Norden för mer än tusen år sedan. Tiden då de levde kallas för " +
            "vikingatiden. Vikingatiden brukar räknas från ungefär år 800 till år 1050. Det var " +
            "alltså mycket längre sedan än när dina far- och morföräldrar levde.",
        },
        {
          id: "q2",
          question: "Vad kallas vikingarnas skepp?",
          options: ["Ubåtar", "Långskepp", "Kanoter", "Flottar"],
          answerIndex: 1,
          explanation: "De långa, smala träskeppen kallas långskepp.",
          passage:
            "Vikingarna var skickliga på att bygga båtar. Deras skepp kallas för långskepp. De " +
            "var långa, smala och byggda av trä. Skeppen hade ett stort segel av ylle och kunde " +
            "ta sig fram både på hav och i floder.",
        },
        {
          id: "q3",
          question: "Vem var gudarnas kung enligt vikingarna?",
          options: ["Tor", "Freja", "Oden", "Loke"],
          answerIndex: 2,
          explanation: "Oden var gudarnas kung och gud för visdom och krig.",
          passage:
            "Innan vikingarna blev kristna trodde de på många olika gudar. Den högsta guden var " +
            "Oden. Han var gudarnas kung och guden för visdom och krig. Vikingarna trodde att " +
            "Oden bodde i Asgård.",
        },
        {
          id: "q4",
          question: "Vad trodde vikingarna hände när det åskade?",
          options: [
            "Att Freja grät",
            "Att Tor svingade sin hammare",
            "Att skeppen kom hem",
            "Att solen somnade",
          ],
          answerIndex: 1,
          explanation: "Åskan förklarades med att Tor svingade hammaren Mjölner.",
          passage:
            "Tor var en av vikingarnas starkaste gudar. Han åkte i en vagn som drogs av bockar. " +
            "När det åskade trodde vikingarna att det var Tor som svingade sin hammare. Hammaren " +
            "hette Mjölner och var mycket kraftfull.",
        },
        {
          id: "q5",
          question: "Vad arbetade de flesta vikingar med?",
          options: ["De var bönder", "De var kungar", "De var läkare", "De var lärare"],
          answerIndex: 0,
          explanation: "De flesta vikingar var bönder som odlade och hade djur.",
          passage:
            "Vikingarna är mest kända för sina resor med snabba skepp. Men i vardagen var de " +
            "flesta vikingar bönder. De odlade säd och skötte om djur på sina gårdar. Bara ibland " +
            "gav de sig ut på långa resor.",
        },
      ],

      // Fakta-par: begrepp ↔ förklaring (för para ihop / memory).
      pairs: [
        { id: "p1", term: "Oden", definition: "Gudarnas kung, gud för visdom och krig" },
        { id: "p2", term: "Tor", definition: "Åskguden med hammaren Mjölner" },
        { id: "p3", term: "Freja", definition: "Kärlekens gudinna" },
        { id: "p4", term: "Långskepp", definition: "Vikingarnas långa, smala segelskepp" },
        { id: "p5", term: "Valhall", definition: "Salen dit modiga krigare kom efter döden" },
        { id: "p6", term: "Mjölner", definition: "Tors hammare" },
      ],
    },
  ],

  matte: [
    {
      id: "talsorter",
      name: "Talsorter och platsvärde",
      order: 1,
      coverEmoji: "🔢",
      grade: "ak4",
      description:
        "Ental, tiotal, hundratal och tusental. Lär dig vilken talsort en siffra står på, " +
        "bygg tal av talsorter, jämför tal och växla mellan talsorterna.",

      // Faktatexter för läsförståelse / att läsa på innan man övar.
      texts: [
        {
          id: "vad-ar-talsorter",
          title: "Vad är talsorter?",
          body:
            "Ett tal byggs upp av talsorter. De fyra vanligaste talsorterna är ental, tiotal, " +
            "hundratal och tusental. Varje siffra i ett tal står på en bestämd plats, och platsen " +
            "bestämmer siffrans värde. I talet 3 482 står 3:an på tusentalsplatsen, 4:an på " +
            "hundratalsplatsen, 8:an på tiotalsplatsen och 2:an på entalsplatsen. Siffran 4 är alltså " +
            "värd 400, eftersom den står på hundratalsplatsen. Samma siffra kan alltså vara värd olika " +
            "mycket beroende på var den står.",
        },
        {
          id: "att-vaxla",
          title: "Att växla mellan talsorter",
          body:
            "Talsorterna hänger ihop tio och tio. Tio ental blir ett tiotal, tio tiotal blir ett " +
            "hundratal och tio hundratal blir ett tusental. Det kallas att växla. När du räknar och " +
            "kommer upp i tio av en talsort växlar du upp till nästa talsort. Om du till exempel har " +
            "10 tiotal kan du växla dem till 1 hundratal. Det är därför vårt talsystem kallas för " +
            "tiosystemet.",
        },
      ],

      // Quiz (flerval). Rent quiz utan källtext → funkar som Quiz/Kunskapsjakt.
      quiz: [
        {
          id: "q1",
          question: "Vilken siffra står på hundratalsplatsen i talet 3 482?",
          options: ["3", "8", "4", "2"],
          answerIndex: 2,
          explanation: "I 3 482 står 4:an på hundratalsplatsen (den tredje siffran från höger).",
        },
        {
          id: "q2",
          question: "Vilken siffra står på tusentalsplatsen i talet 7 205?",
          options: ["7", "2", "0", "5"],
          answerIndex: 0,
          explanation: "7:an står längst till vänster och är alltså tusentalssiffran.",
        },
        {
          id: "q3",
          question: "Vilken siffra står på tiotalsplatsen i talet 560?",
          options: ["5", "0", "56", "6"],
          answerIndex: 3,
          explanation: "I 560 står 6:an på tiotalsplatsen och 0:an på entalsplatsen.",
        },
        {
          id: "q4",
          question: "Vad är värdet av siffran 4 i talet 3 482?",
          options: ["4", "400", "40", "4 000"],
          answerIndex: 1,
          explanation: "4:an står på hundratalsplatsen, så den är värd 4 hundratal = 400.",
        },
        {
          id: "q5",
          question: "Vilket tal är 2 tusental, 5 hundratal, 0 tiotal och 3 ental?",
          options: ["2 053", "2 530", "2 503", "253"],
          answerIndex: 2,
          explanation: "2 tusental (2000) + 5 hundratal (500) + 0 tiotal + 3 ental = 2 503.",
        },
        {
          id: "q6",
          question: "Hur skrivs 'fyra tusental, noll hundratal, sju tiotal och två ental' med siffror?",
          options: ["472", "4 702", "40 072", "4 072"],
          answerIndex: 3,
          explanation: "4 tusental, 0 hundratal, 7 tiotal och 2 ental skrivs 4 072.",
        },
        {
          id: "q7",
          question: "Hur många ental behöver du växla för att få 1 tiotal?",
          options: ["100", "10", "1", "1 000"],
          answerIndex: 1,
          explanation: "10 ental = 1 tiotal. Talsorterna hänger ihop tio och tio.",
        },
        {
          id: "q8",
          question: "Tio hundratal är lika med …",
          options: ["1 tusental", "1 tiotal", "10 tusental", "100 tiotal"],
          answerIndex: 0,
          explanation: "10 hundratal (10 × 100 = 1000) växlas till 1 tusental.",
        },
        {
          id: "q9",
          question: "Vilket tal är störst?",
          options: ["4 030", "4 003", "3 999", "4 300"],
          answerIndex: 3,
          explanation: "Alla börjar på 4 tusental utom 3 999. Av 4-talen har 4 300 flest hundratal.",
        },
        {
          id: "q10",
          question: "Vilket tal är minst?",
          options: ["1 010", "1 001", "1 100", "1 011"],
          answerIndex: 1,
          explanation: "Alla har 1 tusental. 1 001 har varken hundratal eller tiotal, bara 1 ental.",
        },
      ],

      // Fakta-par: tal ↔ uppdelning i talsorter, och siffra på en plats ↔ dess värde.
      pairs: [
        { id: "p1", term: "2 345", definition: "2 tusental, 3 hundratal, 4 tiotal, 5 ental" },
        { id: "p2", term: "5 070", definition: "5 tusental, 0 hundratal, 7 tiotal, 0 ental" },
        { id: "p3", term: "1 608", definition: "1 tusental, 6 hundratal, 0 tiotal, 8 ental" },
        { id: "p4", term: "9 909", definition: "9 tusental, 9 hundratal, 0 tiotal, 9 ental" },
        { id: "p5", term: "Siffran 7 på hundratalsplatsen", definition: "700" },
        { id: "p6", term: "Siffran 3 på tiotalsplatsen", definition: "30" },
        { id: "p7", term: "Siffran 4 på tusentalsplatsen", definition: "4 000" },
        { id: "p8", term: "Siffran 8 på entalsplatsen", definition: "8" },
      ],
    },
  ],
};

// Exempelelev så att man kan logga in direkt efter seedning (dev/emulator).
// `password` används av seed/seed.mjs för att skapa elevens Firebase Auth-konto
// (Firebase kräver minst 6 tecken → "passa123"). Det skrivs INTE till
// students-dokumentet (bor i Auth). OBS: i LIVE har testeleven elev1 lösenordet
// "123" – seed-datan här gäller en färsk/emulator-databas, inte live.
// Användarnamn: elev1   Lösenord (dev-seed): passa123
export const students = [
  {
    id: "elev1",
    namn: "Astrid",
    username: "elev1",
    password: "passa123",
    avatarId: "fox",
    // Välkomstsaldo så shoppen går att prova innan pluggövningarna (som delar ut
    // coins) är byggda. Justera fritt – riktiga coins tjänas in genom att plugga.
    coins: 300,
  },
];
