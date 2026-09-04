// ============================================================================
// Seed-data för Pluggportalen (exempelinnehåll).
// Enda källan för exempeldata – används av seed/seed.html för att fylla
// Firestore. Kör om sidan när du vill återställa exempeldatan.
// ============================================================================

export const subjects = [
  { id: "so", name: "SO", order: 1, icon: "🌍", description: "Historia, geografi, samhälle och religion." },
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
