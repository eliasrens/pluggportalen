// ============================================================================
// Läsresan – utvecklings-seed (src/lasresan/content/dev-seed.js)
// ----------------------------------------------------------------------------
// Spec:ens fyra REFERENSTEXTER (gamla nivå 1/3/5/7 = nya 4/6/8/10, spec §17) i Innehållskontraktets
// format, kompletterade så att varje text har minst 5 frågor och rätt svars
// position varierar. Loadern (content/loader.js) faller tillbaka hit när
// innehållsbanken (content/bank/, ägs av innehållsepicet #404) saknas – så
// motorn går att utveckla och testa utan banken.
//
// Används ALDRIG samtidigt som banken: finns bank/manifest.json används den.
// Texterna här får inte kopieras in i banken (innehållsepicet skriver nya).
// ============================================================================

export const DEV_SEED = [
  {
    id: "lr-n1-katten-i-regnet",
    title: "Katten i regnet",
    level: 4,
    textType: "story",
    topic: "djur",
    body: [
      "Maja har en liten katt som heter Bosse.",
      "En dag börjar det regna. Bosse sitter ute på trappan och blir blöt.",
      "Maja öppnar dörren.",
      "”Kom in, Bosse!” säger hon.",
      "Bosse springer in i huset. Maja hämtar en handduk och torkar honom.",
      "Sedan lägger sig Bosse i sin korg. Där är det varmt och torrt.",
      "Maja ger honom lite mat.",
      "Bosse spinner och somnar.",
    ].join("\n\n"),
    questions: [
      {
        id: "q1",
        question: "Var satt Bosse när det började regna?",
        options: ["I sin korg", "På trappan", "Under bordet", "I ett träd"],
        answerIndex: 1,
        category: "fakta",
      },
      {
        id: "q2",
        question: "Varför hämtade Maja en handduk?",
        options: ["Bosse var smutsig av mat", "Bosse skulle sova", "Bosse var blöt", "Handduken låg i vägen"],
        answerIndex: 2,
        category: "helhet_slutsats",
      },
      {
        id: "q3",
        question: "Vad betyder att Bosse spinner?",
        options: ["Katten gör ett mjukt ljud", "Katten springer snabbt", "Katten äter", "Katten klöser"],
        answerIndex: 0,
        category: "ordforstaelse",
      },
      {
        id: "q4",
        question: "Vad gav Maja till Bosse när han låg i korgen?",
        options: ["En leksak", "En filt", "Lite vatten", "Lite mat"],
        answerIndex: 3,
        category: "fakta",
      },
      {
        id: "q5",
        question: "Hur mådde Bosse när han somnade?",
        options: ["Han var rädd", "Han var arg", "Han var nöjd och lugn", "Han var hungrig"],
        answerIndex: 2,
        category: "mellan_raderna",
      },
    ],
  },
  {
    id: "lr-n3-bollen-som-forsvann",
    title: "Bollen som försvann",
    level: 6,
    textType: "story",
    topic: "skola",
    body: [
      "Det var rast och nästan hela 4E spelade fotboll på den stora planen. Erik stod i mål och Helmer skulle precis skjuta straff. Alla runt omkring höll andan.",
      "Precis när Helmer tog sats rullade bollen iväg av sig själv, som om någon osynlig sparkat till den. Bollen rullade nerför en liten backe och försvann bakom förrådet.",
      "”Jag hämtar den!” ropade Clara och sprang efter. Ines och Hussein följde efter för att hjälpa till. Men bakom förrådet fanns ingen boll, bara ett gammalt lövblåsar-aggregat och några hoprullade nät.",
      "”Den kan inte bara försvinna”, sa Ines och tittade sig omkring.",
      "Till slut hörde de ett skratt från andra sidan staketet. Där stod Leo B och Leo S, som hade varit på den lilla planen. Bollen hade rullat hela vägen genom ett hål i staketet och hamnat vid deras fötter. Alla började skratta åt hur dramatisk situationen känts.",
    ].join("\n\n"),
    questions: [
      {
        id: "q1",
        question: "Vem skulle skjuta straffen?",
        options: ["Erik", "Helmer", "Hussein", "Leo"],
        answerIndex: 1,
        category: "fakta",
      },
      {
        id: "q2",
        question: "Vad betyder uttrycket ”alla höll andan” i texten?",
        options: ["Alla hade sprungit länge", "Alla var nervösa eller spända", "Ingen fick prata", "Det var svårt att andas"],
        answerIndex: 1,
        category: "ordforstaelse",
      },
      {
        id: "q3",
        question: "Varför trodde barnen först att bollen nästan hade försvunnit?",
        options: ["Den syntes inte bakom förrådet", "Erik hade gömt den", "Den hade gått sönder", "Läraren hade tagit den"],
        answerIndex: 0,
        category: "mellan_raderna",
      },
      {
        id: "q4",
        question: "Varför skrattade alla i slutet?",
        options: ["Matchen var slut", "Leo hade berättat ett skämt", "Det mystiska hade fått en enkel förklaring", "Helmer hade gjort mål"],
        answerIndex: 2,
        category: "helhet_slutsats",
      },
      {
        id: "q5",
        question: "Var hamnade bollen till slut?",
        options: ["Bakom förrådet", "I målet", "Under lövblåsaren", "Hos två elever på andra sidan staketet"],
        answerIndex: 3,
        category: "fakta",
      },
      {
        id: "q6",
        question: "Vad betyder det att Helmer ”tog sats”?",
        options: ["Han sprang fram för att sparka", "Han satte sig ner", "Han tog upp bollen", "Han bytte plats med målvakten"],
        answerIndex: 0,
        category: "ordforstaelse",
      },
    ],
  },
  {
    id: "lr-n5-den-tomma-platsen",
    title: "Den tomma platsen",
    level: 8,
    textType: "story",
    topic: "relationer",
    body: [
      "När Mira kom in i klassrummet på morgonen märkte hon direkt att något var annorlunda. Stolen bredvid hennes plats stod tom. Amir brukade alltid vara där före henne, ofta med pennfodralet öppet och matteboken redan framme.",
      "”Är Amir sjuk?” frågade Mira.",
      "Läraren skakade på huvudet. ”Han kommer tillbaka i morgon.”",
      "Mira tänkte inte mer på saken förrän det blev dags för grupparbete. Hon, Amir och Nora hade arbetat med en presentation om Östersjön hela veckan. Nu saknades flera av bilderna som Amir hade ansvar för.",
      "”Typiskt”, muttrade Nora. ”Nu får vi göra om allt.”",
      "Mira sa inget. Hon mindes hur Amir dagen innan hade suttit kvar efter lektionen och försökt få datorn att fungera. Han hade sett ovanligt tyst ut.",
      "Efter lunch kom läraren fram med ett USB-minne.",
      "”Amir lämnade det här till er i morse”, sa hon. ”Hans familj skulle åka till sjukhuset tidigt, men han ville inte att ni skulle behöva börja om.”",
      "På USB-minnet fanns både bilderna och en färdig text till presentationen.",
      "Nora tittade ner i bordet.",
      "”Jag kanske var lite snabb att bli arg”, sa hon.",
      "Mira log. ”Lite.”",
    ].join("\n\n"),
    questions: [
      {
        id: "q1",
        question: "Varför blev Nora irriterad?",
        options: ["Presentationen handlade om fel ämne", "Hon trodde att de skulle behöva göra om Amirs arbete", "Mira kom för sent", "Läraren hade tagit datorn"],
        answerIndex: 1,
        category: "fakta",
      },
      {
        id: "q2",
        question: "Vad kan man förstå om Amir som person?",
        options: ["Han tar ansvar för gruppens arbete", "Han tycker inte om Nora", "Han brukar undvika skolan", "Han vill arbeta ensam"],
        answerIndex: 0,
        category: "mellan_raderna",
      },
      {
        id: "q3",
        question: "Varför tittade Nora ner i bordet i slutet?",
        options: ["Hon var trött", "Hon hade tappat något", "Hon förstod att hon hade dömt Amir för snabbt", "Hon läste texten på USB-minnet"],
        answerIndex: 2,
        category: "mellan_raderna",
      },
      {
        id: "q4",
        question: "Vad betyder uttrycket ”var lite snabb att bli arg”?",
        options: ["Att Nora sprang iväg när hon blev arg", "Att hon blev arg innan hon visste hela situationen", "Att hon snabbt slutade vara arg", "Att hon alltid blir arg"],
        answerIndex: 1,
        category: "ordforstaelse",
      },
      {
        id: "q5",
        question: "Vad är den troligaste förklaringen till att Amir såg ovanligt tyst ut dagen innan?",
        options: ["Han var arg på Nora", "Han hade glömt bort bilderna", "Han tyckte inte om presentationen", "Han var orolig för något hemma"],
        answerIndex: 3,
        category: "mellan_raderna",
      },
      {
        id: "q6",
        question: "Vad handlar texten framför allt om?",
        options: ["Att man kan döma någon för snabbt innan man vet hela situationen", "Att presentationer är svåra att göra i grupp", "Att Östersjön är ett viktigt hav", "Att datorer ofta krånglar i skolan"],
        answerIndex: 0,
        category: "helhet_slutsats",
      },
    ],
  },
  {
    id: "lr-n7-nar-alven-andrar-vag",
    title: "När älven ändrar väg",
    level: 10,
    textType: "fact",
    topic: "natur",
    body: [
      "När människor bygger samhällen nära en älv kan vattnet verka pålitligt. Det rinner genom samma dal år efter år, och på kartan ser dess väg nästan oföränderlig ut. I verkligheten är en älv ständigt i rörelse.",
      "Vatten för med sig sand, grus och jord. Där strömmen är stark kan marken nötas bort, medan material i lugnare delar sjunker till botten. Under lång tid kan detta göra att älvens lopp förändras. En liten sväng kan bli större, stranden kan flyttas flera meter och gamla flodfåror kan lämnas kvar som små sjöar.",
      "För människor som bor nära vattnet kan förändringen få stora konsekvenser. En åker som tidigare låg långt från stranden kan börja rasa ner i älven. Hus, vägar och broar kan behöva skyddas eller flyttas. Samtidigt är det svårt att helt stoppa en älvs naturliga rörelse.",
      "Förr byggde man ofta vallar och förstärkte stränder med sten för att hålla vattnet på plats. Sådana lösningar kan skydda ett område, men ibland leder de till att problemet flyttas längre nedströms. När vattnet inte längre kan breda ut sig på ett ställe ökar kraften någon annanstans.",
      "Därför försöker man i dag på vissa platser arbeta med naturen i stället för mot den. Genom att låta vissa områden översvämmas kan man minska trycket på tätorter. Det kan innebära att mark inte längre kan användas på samma sätt som tidigare, men samtidigt kan våtmarker skapas och risken för allvarliga översvämningar minska.",
      "Att skydda människor från vatten handlar alltså inte alltid om att bygga högre murar. Ibland är den säkraste lösningen att ge älven mer plats.",
    ].join("\n\n"),
    questions: [
      {
        id: "q1",
        question: "Varför kan en älvs lopp förändras med tiden?",
        options: ["Vattnet förflyttar och avsätter material", "Kartor över älvar blir gamla", "Människor gräver nya floder", "Vattnet blir varmare varje år"],
        answerIndex: 0,
        category: "helhet_slutsats",
      },
      {
        id: "q2",
        question: "Varför kan förstärkning av en strand skapa problem längre nedströms?",
        options: ["Vattnet försvinner snabbare", "Vattnets kraft kan flyttas till ett annat område", "Stranden blir för hög", "Det bildas alltid en ny sjö"],
        answerIndex: 1,
        category: "mellan_raderna",
      },
      {
        id: "q3",
        question: "Vad menas med att ”arbeta med naturen i stället för mot den”?",
        options: ["Att aldrig bygga nära vatten", "Att försöka använda naturliga processer som en del av lösningen", "Att ta bort alla vallar", "Att låta alla samhällen översvämmas"],
        answerIndex: 1,
        category: "helhet_slutsats",
      },
      {
        id: "q4",
        question: "Vilken motsättning beskriver texten framför allt?",
        options: ["Mellan jordbruk och fiske", "Mellan att kontrollera vattnet och att ge det utrymme", "Mellan stad och landsbygd", "Mellan nya och gamla kartor"],
        answerIndex: 1,
        category: "helhet_slutsats",
      },
      {
        id: "q5",
        question: "Vilket påstående sammanfattar textens huvudbudskap bäst?",
        options: ["Alla vallar bör tas bort", "Älvar förändras bara under översvämningar", "Skydd mot vatten kan ibland bli bättre om naturen får mer utrymme", "Människor bör inte bo i närheten av vatten"],
        answerIndex: 2,
        category: "helhet_slutsats",
      },
      {
        id: "q6",
        question: "Vad betyder ”nedströms” i texten?",
        options: ["Längre upp mot älvens källa", "På andra sidan älven", "Under vattenytan", "Längre bort i den riktning vattnet rinner"],
        answerIndex: 3,
        category: "ordforstaelse",
      },
    ],
  },
];

export default DEV_SEED;
