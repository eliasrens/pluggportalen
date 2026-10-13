// ============================================================================
// Sådd för preview/preview-amneslasning.html (#672): eleven Alva i klass 4A,
// tre ämnen med ämnestexter (readingTexts):
//   * SO  Vikingatiden – quiz + par + 9 ämnestexter (3 per nivå), 4 redan lästa
//   * NO  Fotosyntesen – BARA ämnestexter (spec §6.4)
//   * Engelska  Animals – ämnestexter på engelska (test 21)
//   * SO  Riksdagen – inga ämnestexter (kortet syns inte, test 13)
// Alvas läsnivå 4 (level10) → ämnesnivå 2. Nollställs vid omladdning.
// ============================================================================

const NOW = Date.now();
const q = (id, question, options, answerIndex, category) => ({ id, question, options, answerIndex, category });
const t = (id, level, title, body, questions, textType = "fact") => ({ id, title, level, textType, body, questions });

const VIKINGAR = [
  t("vik-1-skepp", 1, "Vikingarnas skepp",
    "Vikingarna byggde långa skepp av trä. Skeppen hade ett stort segel och många åror.\n\nNär det blåste seglade de. När det var stilla rodde de. Skeppen var smala och snabba. De kunde åka både på havet och i floder.",
    [
      q("q1", "Vad var skeppen byggda av?", ["Trä", "Sten", "Järn", "Glas"], 0, "fakta"),
      q("q2", "Vad gjorde vikingarna när det var stilla?", ["De sov", "De rodde", "De fiskade", "De sjöng"], 1, "fakta"),
      q("q3", "Varför kunde skeppen åka i floder?", ["De var smala", "De var tunga", "De hade hjul", "De var korta"], 0, "mellan_raderna"),
    ]),
  t("vik-1-hem", 1, "Ett vikingahem",
    "Många vikingar bodde i ett långhus. Där bodde hela familjen tillsammans.\n\nMitt i huset fanns en eld. Elden gav värme och ljus. Över elden lagade de mat. Röken gick ut genom ett hål i taket.",
    [
      q("q1", "Vad hette huset där vikingarna bodde?", ["Stuga", "Långhus", "Slott", "Torn"], 1, "fakta"),
      q("q2", "Vad gav elden?", ["Vatten", "Mat och dryck", "Värme och ljus", "Musik"], 2, "fakta"),
      q("q3", "Vad betyder att röken gick ut genom ett hål?", ["Det var ett fönster", "Det fanns en öppning i taket", "Taket var trasigt", "Det regnade in"], 1, "ordforstaelse"),
    ]),
  t("vik-1-mat", 1, "Vad åt vikingarna?",
    "Vikingarna åt mycket fisk och kött. De odlade korn och havre. Av kornet bakade de bröd.\n\nPå vintern fanns det lite mat. Därför torkade och saltade de fisk och kött på hösten.",
    [
      q("q1", "Vad bakade de av kornet?", ["Kakor", "Bröd", "Pizza", "Pannkakor"], 1, "fakta"),
      q("q2", "Varför saltade de fisk på hösten?", ["Det smakade godare", "Så att maten räckte på vintern", "För att sälja den", "För att fiska mer"], 1, "helhet_slutsats"),
      q("q3", "Vad odlade vikingarna?", ["Ris och majs", "Korn och havre", "Bananer", "Potatis"], 1, "fakta"),
    ]),
  t("vik-2-handel", 2, "Vikingarna köper och säljer",
    "Vikingarna var inte bara krigare. Många av dem var handelsmän som reste långt för att köpa och sälja varor.\n\nDe sålde päls, järn och slavar. I utbyte fick de silver, siden och kryddor. Silvret vägde de på små vågar, eftersom de inte använde mynt på samma sätt som vi gör i dag.\n\nBirka i Mälaren var en viktig handelsplats. Dit kom köpmän från många länder.",
    [
      q("q1", "Vad fick vikingarna i utbyte mot päls och järn?", ["Silver, siden och kryddor", "Hästar", "Böcker", "Guld och diamanter"], 0, "fakta"),
      q("q2", "Varför vägde de silvret?", ["Det var för tungt att bära", "De betalade efter hur mycket silvret vägde", "För att se om det var falskt", "För att det var vackert"], 1, "mellan_raderna"),
      q("q3", "Vad betyder ordet handelsplats?", ["En plats där man handlar", "En hamn för krigsskepp", "En kyrka", "En borg"], 0, "ordforstaelse"),
      q("q4", "Vad vill texten säga om vikingarna?", ["De var bara krigare", "Handel var viktigt för dem", "De bodde i städer", "De var fattiga"], 1, "helhet_slutsats"),
    ]),
  t("vik-2-gudar", 2, "Asagudarna",
    "Vikingarna trodde på många gudar. De kallas asagudar. Den mäktigaste var Oden, som var klok och bara hade ett öga.\n\nTor var åskans gud. När det åskade trodde vikingarna att Tor slog med sin hammare Mjölner. Freja var kärlekens och fruktbarhetens gudinna.\n\nBerättelserna om gudarna berättades muntligt i flera hundra år innan någon skrev ner dem.",
    [
      q("q1", "Vem var åskans gud?", ["Oden", "Freja", "Tor", "Loke"], 2, "fakta"),
      q("q2", "Vad hette Tors hammare?", ["Mjölner", "Gungner", "Draupner", "Bifrost"], 0, "fakta"),
      q("q3", "Vad betyder att berättelserna fördes vidare muntligt?", ["De skrevs i böcker", "De berättades med ord", "De målades", "De glömdes bort"], 1, "ordforstaelse"),
      q("q4", "Hur förklarade vikingarna åska?", ["Med väder och vind", "Med Tors hammare", "Med Odens öga", "De kunde inte förklara den"], 1, "mellan_raderna"),
    ]),
  t("vik-2-runor", 2, "Runorna",
    "Vikingarna skrev med runor. Runorna ristades, det vill säga skars in, i sten, trä eller ben. Därför har runor många raka streck och inga runda former.\n\nPå runstenar kan man läsa vem som reste stenen och vem den var till minne av. I Sverige finns fler runstenar än i något annat land.",
    [
      q("q1", "Vad betyder ristades?", ["Målades", "Skars in", "Skrevs med bläck", "Sjöngs"], 1, "ordforstaelse"),
      q("q2", "Varför har runor raka streck?", ["Det var lättare att skära raka streck", "De var lata", "Det var en regel från kungen", "De kunde inte rita cirklar"], 0, "mellan_raderna"),
      q("q3", "Vad kan man läsa på runstenar?", ["Recept", "Vem stenen restes till minne av", "Väderleken", "Kartor"], 1, "fakta"),
      q("q4", "Var finns flest runstenar?", ["Norge", "Danmark", "Sverige", "Island"], 2, "fakta"),
    ]),
  t("vik-3-resor", 3, "Från Birka till Konstantinopel",
    "Svenska vikingar reste framför allt österut. De seglade över Östersjön och vidare längs de stora floderna i det som i dag är Ryssland och Ukraina.\n\nResan var farlig. Vid forsar fick vikingarna dra skeppen på land, ibland långa sträckor. Det kallas att släpa skeppen över ett ed. Trots riskerna lockade rikedomarna i söder: i Konstantinopel, dagens Istanbul, fanns silver, siden och vin.\n\nNågra vikingar stannade och blev livvakter åt kejsaren. De kallades väringar. Att resan lönade sig syns i fynden: i svensk jord har man hittat tusentals arabiska silvermynt.",
    [
      q("q1", "Åt vilket håll reste svenska vikingar framför allt?", ["Västerut", "Österut", "Norrut", "Söderut till Afrika"], 1, "fakta"),
      q("q2", "Varför drog vikingarna skeppen på land?", ["För att laga dem", "För att ta sig förbi forsar", "För att gömma dem", "För att sälja dem"], 1, "helhet_slutsats"),
      q("q3", "Vad var väringar?", ["Handelsmän", "Kejsarens livvakter", "Skeppsbyggare", "Präster"], 1, "fakta"),
      q("q4", "Vad visar de arabiska silvermynten?", ["Att vikingarna var fattiga", "Att handeln österut gav rikedomar", "Att araber bodde i Sverige", "Att mynten var falska"], 1, "mellan_raderna"),
      q("q5", "Vad betyder att resan lönade sig?", ["Den var gratis", "Den gav mer än den kostade", "Den tog lång tid", "Den var farlig"], 1, "ordforstaelse"),
    ]),
  t("vik-3-samhalle", 3, "Ting och lag",
    "Vikingasamhället saknade polis och domstolar som vi känner dem. I stället samlades de fria männen på tinget, ett möte där man löste konflikter och bestämde gemensamma regler.\n\nLagarna var inte nedskrivna. En lagman lärde sig dem utantill och läste upp dem på tinget. Den som bröt mot lagen kunde få böta, men den värsta straffet var att bli fredlös. Då fick vem som helst skada personen utan att straffas.\n\nKvinnor, barn och trälar fick inte bestämma på tinget. Men kvinnor kunde äga mark och styra gården när mannen var på resa.",
    [
      q("q1", "Vad var tinget?", ["En marknad", "Ett möte där man löste konflikter", "En kyrka", "Ett skepp"], 1, "fakta"),
      q("q2", "Varför behövdes en lagman?", ["Lagarna var inte nedskrivna", "Han var kung", "Han dömde till döden", "Han samlade in skatt"], 0, "helhet_slutsats"),
      q("q3", "Varför var det så hårt att bli fredlös?", ["Man fick inte gå på tinget", "Ingen skyddade en längre", "Man fick betala mycket", "Man måste flytta till en ö"], 1, "mellan_raderna"),
      q("q4", "Vem fick INTE bestämma på tinget?", ["Fria män", "Lagmannen", "Trälar", "Bönder"], 2, "fakta"),
      q("q5", "Vad säger texten om kvinnornas makt?", ["De hade ingen makt alls", "De kunde styra gården", "De var lagmän", "De bestämde på tinget"], 1, "mellan_raderna"),
    ]),
  t("vik-3-dag", 3, "En dag i en vikingaby",
    "Sigrid vaknade av att elden sprakade. Hennes mor hade redan lagt på ny ved och satt vid vävstolen. – Hämta vatten innan solen går upp, sa hon.\n\nUte var luften kall. Sigrid bar hinkarna till bäcken och tänkte på sin bror Ulf, som seglat österut i våras. Om han kom hem före vintern skulle han ha silver med sig, kanske en pärla till henne.\n\nPå eftermiddagen hjälpte hon till att salta fisk. Alla visste att det som inte saltades nu skulle saknas i februari. När mörkret föll satt familjen vid elden och farfar berättade om Tor och jättarna.",
    [
      q("q1", "Vad gjorde Sigrids mor när Sigrid vaknade?", ["Lagade mat", "Satt vid vävstolen", "Sov", "Var vid bäcken"], 1, "fakta"),
      q("q2", "Varför hoppades Sigrid att Ulf skulle komma hem?", ["Hon saknade honom och han kunde ha med sig gåvor", "Han skulle hämta vatten", "Han var sjuk", "Han skulle gifta sig"], 0, "mellan_raderna"),
      q("q3", "Varför var det viktigt att salta fisk på hösten?", ["Annars skulle maten ta slut på vintern", "Fisken smakade bättre", "Det var en fest", "Farfar ville det"], 0, "helhet_slutsats"),
      q("q4", "Vad betyder att mörkret föll?", ["Det blev kväll", "Det regnade", "Något föll ner", "Elden slocknade"], 0, "ordforstaelse"),
      q("q5", "Vad handlar texten mest om?", ["Ett krig", "Vardagen i en vikingafamilj", "En resa till Konstantinopel", "Gudarna"], 1, "helhet_slutsats"),
    ], "story"),
];

const FOTOSYNTES = [
  t("fs-1-vaxter", 1, "Växter gör sin egen mat",
    "Växter behöver inte äta som vi. De gör sin egen mat.\n\nTill det behöver de ljus från solen, vatten och luft. Maten görs i de gröna bladen. Det kallas fotosyntes.",
    [
      q("q1", "Var görs växtens mat?", ["I roten", "I de gröna bladen", "I blomman", "I jorden"], 1, "fakta"),
      q("q2", "Vad behöver växten för att göra mat?", ["Ljus, vatten och luft", "Bara jord", "Socker", "Mörker"], 0, "fakta"),
      q("q3", "Vad heter det när växter gör sin mat?", ["Fotosyntes", "Fotografi", "Andning", "Kompost"], 0, "ordforstaelse"),
    ]),
  t("fs-2-syre", 2, "Syret vi andas",
    "När växter gör fotosyntes tar de upp koldioxid ur luften. Med hjälp av solljus och vatten blir koldioxiden till socker, som växten använder som energi.\n\nSamtidigt släpper växten ut syre. Det är samma syre som vi människor och djuren behöver för att andas. Därför brukar man säga att skogar och hav fulla av alger är jordens lungor.",
    [
      q("q1", "Vad tar växten upp ur luften?", ["Syre", "Koldioxid", "Vatten", "Kväve"], 1, "fakta"),
      q("q2", "Vad blir koldioxiden till?", ["Socker", "Salt", "Sten", "Rök"], 0, "fakta"),
      q("q3", "Varför kallas skogar för jordens lungor?", ["De ser ut som lungor", "De ger oss syre att andas", "De är stora", "De växer snabbt"], 1, "mellan_raderna"),
      q("q4", "Vad behöver människor och djur som växten släpper ut?", ["Socker", "Koldioxid", "Syre", "Ljus"], 2, "fakta"),
    ]),
  t("fs-3-klorofyll", 3, "Det gröna i bladen",
    "Bladen är gröna på grund av klorofyll, ett ämne som fångar solens ljus. Klorofyllet fungerar ungefär som en solpanel: det tar emot ljusenergi och gör det möjligt för växten att bygga socker av vatten och koldioxid.\n\nPå hösten blir dagarna kortare och ljuset svagare. Många träd slutar då att tillverka klorofyll och bryter ner det som finns. När det gröna försvinner syns de gula och röda färgerna som funnits i bladen hela tiden.\n\nUtan klorofyll ingen fotosyntes – och utan fotosyntes skulle nästan allt liv på jorden sakna både mat och syre.",
    [
      q("q1", "Varför är bladen gröna?", ["På grund av klorofyll", "På grund av vatten", "För att de är unga", "För att de är kalla"], 0, "fakta"),
      q("q2", "Varför jämförs klorofyll med en solpanel?", ["Det är tillverkat av metall", "Det fångar ljusenergi", "Det sitter på taket", "Det ger elektricitet"], 1, "mellan_raderna"),
      q("q3", "Varför blir löven gula och röda på hösten?", ["De målas av regnet", "Det gröna bryts ner så att andra färger syns", "De fryser", "De blir sjuka"], 1, "helhet_slutsats"),
      q("q4", "Vad betyder att bryta ner något?", ["Att bygga upp", "Att dela upp det i mindre delar tills det försvinner", "Att laga", "Att gömma"], 1, "ordforstaelse"),
      q("q5", "Vad vill texten visa i sista stycket?", ["Att klorofyll är onödigt", "Att fotosyntesen är livsviktig", "Att hösten är vacker", "Att solpaneler är bra"], 1, "helhet_slutsats"),
    ]),
];

const ANIMALS = [
  t("en-1-dog", 1, "My dog Max",
    "I have a dog. His name is Max. Max is brown and white.\n\nEvery morning we go to the park. Max likes to run and play with a ball. When we come home, he drinks a lot of water and then he sleeps.",
    [
      q("q1", "What colour is Max?", ["Black", "Brown and white", "Grey", "Yellow"], 1, "fakta"),
      q("q2", "Where do they go every morning?", ["To school", "To the shop", "To the park", "To the beach"], 2, "fakta"),
      q("q3", "Why does Max sleep when they come home?", ["He is tired after playing", "He is sick", "It is night", "He is bored"], 0, "mellan_raderna"),
    ], "story"),
  t("en-2-pets", 2, "Pets in Britain",
    "Almost half of all homes in Britain have a pet. The most popular pets are dogs and cats, but many children also have rabbits, guinea pigs or fish.\n\nHaving a pet is fun, but it is also a big responsibility. A dog needs a walk every day, and a rabbit needs fresh hay and a clean cage. Before you get a pet, you should think about how much time you have.",
    [
      q("q1", "Which pets are the most popular?", ["Fish and birds", "Dogs and cats", "Rabbits and mice", "Horses"], 1, "fakta"),
      q("q2", "What does the word responsibility mean here?", ["Something you must take care of", "A kind of food", "A game", "A holiday"], 0, "ordforstaelse"),
      q("q3", "What does a rabbit need?", ["A walk every day", "Fresh hay and a clean cage", "A swimming pool", "Chocolate"], 1, "fakta"),
      q("q4", "What is the main message of the text?", ["Pets are boring", "Pets are fun but need care", "Everyone must have a dog", "Fish are the best pets"], 1, "helhet_slutsats"),
    ]),
  t("en-3-wild", 3, "Wild animals in the city",
    "Cities are not only for people. Foxes, hedgehogs and many kinds of birds have learned to live close to us. In London, there are thought to be more than ten thousand foxes.\n\nWhy do wild animals move into cities? One reason is food: rubbish bins and gardens are full of things to eat. Another reason is that cities are often warmer than the countryside, which helps animals survive the winter.\n\nLiving in a city is not always easy, though. Traffic is dangerous, and some people see the animals as pests. Scientists study city animals to learn how humans and wildlife can share the same space.",
    [
      q("q1", "How many foxes are there thought to be in London?", ["About a hundred", "More than ten thousand", "None", "Exactly one thousand"], 1, "fakta"),
      q("q2", "Why do cities help animals in winter?", ["Cities are warmer", "There is more snow", "People feed all animals", "There are no cars"], 0, "helhet_slutsats"),
      q("q3", "What does the word pests mean in the text?", ["Animals people find annoying", "Pets", "Wild birds", "Scientists"], 0, "ordforstaelse"),
      q("q4", "Why do scientists study city animals?", ["To catch them", "To learn how people and animals can live together", "To sell them", "To move them to the zoo"], 1, "mellan_raderna"),
      q("q5", "What is the text mostly about?", ["How to keep a fox as a pet", "Why and how wild animals live in cities", "The history of London", "Traffic rules"], 1, "helhet_slutsats"),
    ]),
];

/** @param {(path:string, data:object) => void} satt */
export function seed(satt) {
  satt("subjects/so", { name: "SO", icon: "🌍", order: 1 });
  satt("subjects/no", { name: "NO", icon: "🔬", order: 2 });
  satt("subjects/engelska", { name: "Engelska", icon: "🇬🇧", order: 3 });
  const quiz = [0, 1, 2, 3].map((n) => ({
    id: `q${n + 1}`, question: `Fråga ${n + 1} om vikingarna?`, options: ["Alfa", "Beta", "Gamma", "Delta"], answerIndex: n,
  }));
  const pairs = [["Oden", "Asagudarnas ledare"], ["Birka", "Handelsstad"], ["Runor", "Vikingarnas skrift"]].map(([term, definition], n) => ({ id: `p${n + 1}`, term, definition }));
  satt("subjects/so/areas/vikingar", {
    name: "Vikingatiden", coverEmoji: "⚔️", order: 1, grade: "4", description: "Hur levde vikingarna?",
    exerciseTypes: ["quiz", "pairs"], hiddenModes: [], quiz, pairs, readingTexts: VIKINGAR,
  });
  satt("subjects/so/areas/riksdagen", {
    name: "Riksdagen", coverEmoji: "🏛️", order: 2, grade: "4", exerciseTypes: ["quiz"], hiddenModes: [],
    quiz: quiz.map((x) => ({ ...x, question: x.question.replace("vikingarna", "riksdagen") })),
  });
  satt("subjects/no/areas/fotosyntes", {
    name: "Fotosyntesen", coverEmoji: "🌱", order: 1, grade: "4", description: "Hur gör växter sin mat?",
    exerciseTypes: [], hiddenModes: [], readingTexts: FOTOSYNTES,
  });
  satt("subjects/engelska/areas/animals", {
    name: "Animals", coverEmoji: "🦊", order: 1, grade: "4", description: "Read about animals in English!",
    exerciseTypes: [], hiddenModes: [], readingTexts: ANIMALS,
  });
  satt("students/stub-alva", { namn: "Alva", username: "alva", avatarId: "fox", classIds: ["4a"] });
  satt("studentData/stub-alva", {
    coins: 120, xp: 60, avatarId: "fox", progress: {},
    // Läsnivå 4 (skala 1–10) → ämnesnivå 2. Spegeln level = 1 (gammal skala).
    lasresa: { level10: 4, level: 1, highStreak: 0, lowStreak: 0, worldId: "skogen", stepInWorld: 0, completedWorlds: [], seenTextIds: [] },
    amneslasning: {
      areas: {
        vikingar: {
          subjectId: "so", currentTextId: null, currentStartedAt: null,
          read: {
            "vik-1-skepp": { count: 1, lastAt: NOW - 5 * 864e5 },
            "vik-2-handel": { count: 1, lastAt: NOW - 3 * 864e5 },
            "vik-2-gudar": { count: 2, lastAt: NOW - 2 * 864e5 },
            "vik-1-hem": { count: 1, lastAt: NOW - 864e5 },
          },
        },
      },
      updatedAt: NOW,
    },
  });
  satt("classes/4a", { name: "4A", order: 1, studentIds: ["stub-alva"] });
}
