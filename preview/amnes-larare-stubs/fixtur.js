// Fixtur för preview-amnes-larare.html (#673): ett SO-område med några
// ämnestexter (nivå 3 saknas → varning) och ett AI-svar att klistra in
// (9 texter, en med fel, en med varning). Allt påhittat för förhandsvisningen.
const q = (id, question, options, answerIndex, category) => ({ id, question, options, answerIndex, category });

const L1_SKEPP = `Vikingarna byggde långa och smala skepp av trä. Skeppen hade ett stort segel och många åror.

När det blåste seglade de. När det var stilla rodde de. Skeppen gick fort och kunde åka både på havet och i floder. Därför kunde vikingarna resa långt bort, ända till England och Ryssland.`;

const L1_BY = `I en vikingaby bodde många familjer. Husen kallades långhus. De var byggda av trä och lera och hade tak av gräs eller vass.

Mitt i huset brann en eld. Den gav värme och ljus, och över elden lagade man mat. Djuren bodde ofta i ena änden av huset, så att de också fick det varmt på vintern.`;

const L2_HANDEL = `Vikingarna var inte bara krigare. Många av dem var handelsmän som reste långa vägar för att köpa och sälja varor. De sålde päls, järn och valrosstand. I utbyte fick de silver, glas, kryddor och fina tyger.

Handeln skedde ofta på marknadsplatser, till exempel i Birka i Mälaren. Där möttes människor från många länder. Eftersom man inte alltid hade mynt vägde man silvret på en liten våg. Ibland klippte man sönder smycken för att få rätt vikt. Det kallas hacksilver.`;

const EXISTING = [
  { id: "vikingar-skepp-1", title: "Vikingarnas skepp", level: 1, textType: "fact", body: L1_SKEPP, questions: [
    q("q1", "Vad var vikingarnas skepp byggda av?", ["Trä", "Järn", "Sten", "Plast"], 0, "fakta"),
    q("q2", "Vad gjorde vikingarna när det var stilla?", ["De sov", "De rodde", "De fiskade", "De seglade"], 1, "fakta"),
    q("q3", "Varför kunde vikingarna resa så långt?", ["De hade kartor", "Skeppen var snabba", "De hade hästar", "De flög"], 1, "helhet_slutsats"),
  ] },
  { id: "vikingar-by-1", title: "Ett hus i vikingabyn", level: 1, textType: "fact", body: L1_BY, questions: [
    q("q1", "Vad kallades vikingarnas hus?", ["Torn", "Långhus", "Slott", "Tält"], 1, "fakta"),
    q("q2", "Vad gav elden i huset?", ["Vatten", "Mat och kläder", "Värme och ljus", "Frisk luft"], 2, "fakta"),
    q("q3", "Varför bodde djuren inne i huset?", ["För att de skulle bli varma", "För att de var sjuka", "För att de skulle äta", "För att de var vilda"], 0, "mellan_raderna"),
  ] },
  { id: "vikingar-handel-2", title: "Vikingarna köper och säljer", level: 2, textType: "fact", body: L2_HANDEL, questions: [
    q("q1", "Vad sålde vikingarna?", ["Päls och järn", "Bilar", "Bananer", "Papper"], 0, "fakta"),
    q("q2", "Var låg marknadsplatsen Birka?", ["I Mälaren", "I Rom", "I Norrland", "På Gotland"], 0, "fakta"),
    q("q3", "Vad betyder ordet hacksilver i texten?", ["Silver som klippts i bitar", "Ett vapen", "Ett mynt från Rom", "Ett verktyg"], 0, "ordforstaelse"),
    q("q4", "Varför vägde man silvret?", ["För att veta hur mycket det var värt", "För att det var tungt", "För att det var vackert", "För att det var smutsigt"], 0, "mellan_raderna"),
  ] },
  // Gammal nivåtext (#152) i samma fält – ska ignoreras, aldrig visas.
  { id: "rt1", title: "GAMMAL NIVÅTEXT (ska inte synas)", levels: { 1: { body: "x", questions: [] } } },
];

export const AREAS = {
  "so/vikingatiden": {
    id: "vikingatiden", name: "Vikingatiden", order: 1, coverEmoji: "🛶", grade: "ak5",
    exerciseTypes: ["quiz", "amneslasning"],
    texts: [{ id: "t1", title: "Vilka var vikingarna?", body: "Vikingarna levde i Norden för mer än tusen år sedan." }],
    quiz: [
      { id: "q1", question: "Ungefär när levde vikingarna?", options: ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"], answerIndex: 0, explanation: "", passage: "Vikingatiden räknas från cirka år 800 till 1050.", category: "fakta" },
      { id: "q2", question: "Vad hette vikingarnas skepp?", options: ["Långskepp", "Kogg", "Galär", "Fregatt"], answerIndex: 0, explanation: "", category: "begrepp" },
    ],
    pairs: [], hiddenModes: [], readingTexts: EXISTING,
  },
  "so/fotosyntes": {
    id: "fotosyntes", name: "Växterna och solen", order: 2, coverEmoji: "🌱", grade: "ak4",
    exerciseTypes: ["amneslasning"], texts: [], quiz: [], pairs: [], hiddenModes: [], readingTexts: [],
  },
};

// --- AI-svaret att klistra in (som Claude skulle svara på prompten) ----------
const L1_RUNOR = `Vikingarna skrev med tecken som kallas runor. Runorna ristade de in i sten och trä.

En runsten är en stor sten med runor på. Ofta skrev man om en person som hade dött. Det finns många runstenar kvar i Sverige i dag. Du kan se dem vid vägar och kyrkor.`;
const L2_GUDAR = `Vikingarna trodde på många gudar. Den viktigaste guden var Oden. Han var klok och visste mycket. Tor var stark och hade en hammare som hette Mjölner. När det åskade trodde vikingarna att Tor körde sin vagn över himlen.

Freja var gudinna för kärlek och fruktbarhet. Vikingarna offrade mat och djur till gudarna för att få en bra skörd och lycka i strid. Berättelserna om gudarna kallas myter. Många av dem skrevs ner långt senare, på Island.`;
const L2_RESOR = `Vikingarna reste åt olika håll beroende på var de bodde. Danska vikingar seglade ofta till England och Frankrike. Norska vikingar reste västerut till Skottland, Irland och Island. Svenska vikingar åkte österut, över Östersjön och vidare längs Rysslands floder.

På floderna kunde skeppen inte alltid segla. Ibland fick vikingarna bära skeppen över land mellan två floder. Långt i öster kom de ända till Miklagård, som i dag heter Istanbul. Där fanns stora rikedomar och en mäktig kejsare.`;
const L3_SLUTET = `Vikingatiden tog slut ungefär år 1050, men den slutade inte på en enda dag. Det var flera förändringar som tillsammans gjorde att samhället blev annorlunda.

En viktig förändring var att kristendomen spred sig i Norden. Munkar och präster reste hit och berättade om den kristna guden. Kungarna såg att det kunde löna sig att bli kristna, eftersom det gav dem vänner och handelspartner bland de mäktiga kungarna i Europa. När kungarna blev kristna följde ofta många andra efter.

Samtidigt blev kungarna starkare. I stället för många små hövdingar som styrde var sitt område växte det fram större riken, som Danmark, Norge och Sverige. Kungarna ville ha lugn och ordning i sina länder och tyckte inte om att krigare for iväg på plundringståg.

Dessutom hade folken i Europa lärt sig att försvara sig bättre. De byggde borgar och höll soldater redo vid kusterna. Då blev det svårare och farligare att plundra. Handel blev ett säkrare sätt att bli rik än krig.`;
const L3_KVINNOR = `Kvinnorna hade en viktig roll i vikingasamhället. När männen var ute på långa resor var det ofta kvinnorna som skötte gården. De bestämde över djuren, maten och förråden och såg till att familjen klarade vintern.

Husfrun bar nycklarna till gårdens kistor i ett bälte. Nycklarna visade att hon hade ansvar och makt i hemmet. Kvinnorna vävde också tyg till kläder och segel. Ett segel till ett stort skepp kunde ta flera år att väva, så deras arbete var nödvändigt för att vikingarna skulle kunna resa alls.

Vissa kvinnor var rika och mäktiga. I gravar har arkeologer hittat kvinnor som begravts med dyrbara smycken, hästar och till och med skepp. Det visar att de hade hög ställning. På några runstenar står det att en kvinna lät resa stenen efter sin man eller son, och ibland att hon ärvde gården.`;

const fyra = (o) => o;
export const AI_SVAR = {
  readingTexts: [
    { id: "vikingar-runor-1", title: "Runor och runstenar", level: 1, textType: "fact", body: L1_RUNOR, questions: [
      q("q1", "Vad kallas vikingarnas skrivtecken?", fyra(["Bokstäver", "Runor", "Siffror", "Bilder"]), 1, "fakta"),
      q("q2", "Vad är en runsten?", ["En sten med runor på", "En sten i en flod", "Ett hus av sten", "En vikingabåt"], 0, "ordforstaelse"),
      q("q3", "Var kan man se runstenar i dag?", ["Bara på museum", "I havet", "Vid vägar och kyrkor", "I skolan"], 2, "fakta"),
      q("q4", "Varför ristade man ofta en runsten?", ["För att minnas någon som dött", "För att leka", "För att sälja den", "För att bygga ett hus"], 0, "mellan_raderna"),
    ] },
    { id: "vikingar-skepp-1", title: "En dag på ett vikingaskepp", level: 1, textType: "story", body: L1_SKEPP.replace("Vikingarna byggde", "Olof och hans pappa såg hur vikingarna byggde"), questions: [
      q("q1", "Vad hade skeppen?", ["Motor", "Segel och åror", "Hjul", "Vingar"], 1, "fakta"),
      q("q2", "Vart kunde vikingarna resa?", ["Till månen", "Till England och Ryssland", "Bara till grannbyn", "Till Australien"], 1, "fakta"),
      q("q3", "Vad gjorde man när det var stilla?", ["Rodde", "Sov", "Sjöng", "Seglade"], 0, "fakta"),
    ] },
    { id: "vikingar-mat-1", title: "Vad åt vikingarna?", level: 1, textType: "fact", body: `Vikingarna åt mest det de odlade och fångade själva. De åt gröt, bröd och fisk. De hade kor, får och grisar som gav mjölk, kött och ull.\n\nPå hösten torkade och saltade de maten, så att den skulle räcka hela vintern. Socker hade de inte. I stället blev maten söt av honung och bär.`, questions: [
      q("q1", "Vad gjorde maten söt?", ["Socker", "Honung och bär", "Godis", "Salt"], 1, "fakta"),
      q("q2", "Varför saltade de maten?", ["För att den skulle räcka hela vintern", "För att den skulle bli söt", "För att den var för varm", "För att sälja den"], 0, "mellan_raderna"),
      q("q3", "Vad gav fåren?", ["Ägg", "Ull", "Honung", "Fisk"], 1, "fakta"),
    ] },
    { id: "vikingar-gudar-2", title: "Vikingarnas gudar", level: 2, textType: "fact", body: L2_GUDAR, questions: [
      q("q1", "Vem var den viktigaste guden?", ["Tor", "Oden", "Freja", "Loke"], 1, "fakta"),
      q("q2", "Vad trodde vikingarna hände när det åskade?", ["Oden red", "Tor körde sin vagn", "Freja grät", "Havet kokade"], 1, "fakta"),
      q("q3", "Vad betyder ordet myter i texten?", ["Berättelser om gudarna", "Vapen", "Skepp", "Runor"], 0, "ordforstaelse"),
      q("q4", "Varför offrade vikingarna till gudarna?", ["För att få lycka och bra skörd", "För att gudarna var hungriga", "För att det var roligt", "För att sälja mat"], 0, "mellan_raderna"),
    ] },
    { id: "vikingar-resor-2", title: "Åt vilket håll reste vikingarna?", level: 2, textType: "fact", body: L2_RESOR, questions: [
      q("q1", "Vart reste svenska vikingar oftast?", ["Västerut", "Österut", "Söderut till Afrika", "Norrut"], 1, "fakta"),
      q("q2", "Vad heter Miklagård i dag?", ["Istanbul", "Rom", "London", "Kiev"], 0, "fakta"),
      q("q3", "Varför fick de ibland bära skeppen?", ["För att skeppen gick sönder", "För att det inte fanns vatten mellan floderna", "För att det var kallt", "För att de var trötta"], 1, "helhet_slutsats"),
      // Fel: bara 3 alternativ och en Plugga-kategori.
      q("q4", "Vilka reste till Island?", ["Norska vikingar", "Danska vikingar", "Svenska vikingar"], 0, "analys"),
    ] },
    { id: "vikingar-handel-2", title: "Silver från öst", level: 2, textType: "fact", body: L2_HANDEL.replace("Vikingarna var inte bara krigare.", "Silvret kom ofta från länder långt österut."), questions: [
      q("q1", "Vad är hacksilver?", ["Silver i bitar", "Ett mynt", "Ett skepp", "En stad"], 0, "ordforstaelse"),
      q("q2", "Var möttes människor från många länder?", ["I Birka", "I skogen", "På Island", "I Rom"], 0, "fakta"),
      q("q3", "Vad fick vikingarna i utbyte?", ["Silver, glas och kryddor", "Bilar", "Hästar och kor", "Papper"], 0, "fakta"),
      q("q4", "Varför använde man en våg?", ["För att mynt inte alltid fanns", "För att väga fisk", "För att leka", "För att mäta vind"], 0, "mellan_raderna"),
    ] },
    { id: "vikingar-slutet-3", title: "Hur vikingatiden tog slut", level: 3, textType: "fact", body: L3_SLUTET, questions: [
      q("q1", "Ungefär när tog vikingatiden slut?", ["År 1050", "År 500", "År 1500", "År 1900"], 0, "fakta"),
      q("q2", "Varför ville kungarna bli kristna?", ["Det gav dem vänner i Europa", "De var rädda för Tor", "De ville bli munkar", "De tyckte om kyrkor"], 0, "mellan_raderna"),
      q("q3", "Vad betyder plundringståg?", ["Resor för att råna och ta saker", "En sorts tåg", "Handel med silver", "En fest"], 0, "ordforstaelse"),
      q("q4", "Vad är textens huvudbudskap?", ["Flera förändringar fick vikingatiden att ta slut", "Vikingarna förlorade ett stort krig", "Alla vikingar flyttade", "Kyrkan förbjöd skepp"], 0, "helhet_slutsats"),
      q("q5", "Varför blev handel bättre än krig?", ["Det blev farligare att plundra", "Krig var förbjudet", "Silver fanns inte längre", "Skeppen var för små"], 0, "helhet_slutsats"),
    ] },
    { id: "vikingar-kvinnor-3", title: "Kvinnorna på vikingagården", level: 3, textType: "fact", body: L3_KVINNOR, questions: [
      q("q1", "Vad visade nycklarna i husfruns bälte?", ["Att hon hade ansvar och makt", "Att hon var fattig", "Att hon skulle resa", "Att hon var gift med kungen"], 0, "mellan_raderna"),
      q("q2", "Varför var vävningen så viktig?", ["Utan segel kunde man inte resa", "Tyg var vackert", "Man sålde mattor", "Det var kallt"], 0, "helhet_slutsats"),
      q("q3", "Vad har arkeologer hittat i vissa kvinnogravar?", ["Smycken, hästar och skepp", "Bilar", "Böcker", "Ingenting"], 0, "fakta"),
      q("q4", "Vem skötte gården när männen reste?", ["Kvinnorna", "Kungen", "Munkarna", "Grannarna"], 0, "fakta"),
      q("q5", "Vad visar runstenarna om kvinnor?", ["Att en del kvinnor ärvde gårdar", "Att kvinnor inte fick läsa", "Att kvinnor var vikingar på skeppen", "Att alla kvinnor var rika"], 0, "helhet_slutsats"),
    ] },
    { id: "vikingar-tinget-3", title: "Tinget", level: 3, textType: "fact", body: `Vikingarna hade ett möte som kallades ting. Där bestämde de fria männen om lagar och löste bråk.`, questions: [
      q("q1", "Vad hette vikingarnas möte?", ["Ting", "Riksdag", "Marknad", "Fest"], 0, "fakta"),
      q("q2", "Vad gjorde man på tinget?", ["Bestämde om lagar", "Byggde skepp", "Offrade", "Handlade"], 0, "fakta"),
      q("q3", "Vilka bestämde på tinget?", ["De fria männen", "Barnen", "Trälarna", "Munkarna"], 0, "fakta"),
      q("q4", "Vad betyder att lösa bråk?", ["Att reda ut en konflikt", "Att slåss", "Att springa", "Att sjunga"], 0, "ordforstaelse"),
      q("q5", "Varför behövdes tinget?", ["För att ha ordning i samhället", "För att leka", "För att segla", "För att äta"], 0, "helhet_slutsats"),
    ] },
  ],
};
