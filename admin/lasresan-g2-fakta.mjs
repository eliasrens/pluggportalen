// ============================================================================
// Läsresan – källtexter för nivå 2, fact (issue #522, epic #516)
// ----------------------------------------------------------------------------
// 15 fakta-texter, 60–90 ord, 4–5 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g2-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-2.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g2-fjarilen", title: "Från larv till fjäril", textType: "fact", topic: "djur",
    body: [
      "En fjäril börjar sitt liv som ett litet ägg på ett blad.",
      "Ur ägget kryper en larv. Larven äter och äter. Den äter blad hela dagarna och blir större och större.",
      "Sedan gör larven ett hårt skal runt sig själv. Nu kallas den puppa. Puppan ser ut att sova, men inuti händer mycket.",
      "Efter några veckor spricker skalet. Ut kommer en fjäril med blöta vingar. När vingarna har torkat flyger den iväg.",
    ],
    q: [
      ["Var lägger fjärilen sitt ägg?", ["På ett blad", "I jorden", "I vattnet", "På en sten"], "fakta"],
      ["Vad kryper ut ur ägget?", ["En larv", "En fjäril", "En puppa", "En mask"], "fakta"],
      ["Vad äter larven?", ["Blad", "Myror", "Frön", "Bär"], "fakta"],
      ["Vad kallas larven när den har ett hårt skal?", ["Puppa", "Ägg", "Skal", "Fjäril"], "ordforstaelse"],
      ["Vad måste hända innan fjärilen kan flyga?", ["Vingarna måste torka", "Den måste äta mer blad", "Den måste sova", "Det måste bli kväll"], "fakta"],
    ],
  },
  {
    id: "lr-g2-skoldpaddan", title: "Huset på ryggen", textType: "fact", topic: "djur",
    body: [
      "En sköldpadda har ett hårt skal på ryggen. Skalet är som ett hus som den alltid bär med sig.",
      "Om sköldpaddan blir rädd drar den in huvudet och benen i skalet. Då är den skyddad.",
      "Sköldpaddor som lever på land går mycket långsamt. De äter gräs, blad och blommor. De har inga tänder, men munnen är vass som en näbb.",
      "Sköldpaddor kan bli väldigt gamla. Vissa lever i över hundra år!",
    ],
    q: [
      ["Vad har sköldpaddan på ryggen?", ["Ett hårt skal", "Mjuk päls", "Stora vingar", "Vassa taggar"], "fakta"],
      ["Vad gör sköldpaddan när den blir rädd?", ["Drar in huvudet", "Springer iväg", "Klättrar i ett träd", "Gräver ett hål"], "fakta"],
      ["Vad äter sköldpaddor som lever på land?", ["Gräs och blad", "Fisk och kött", "Bröd och ost", "Myror och maskar"], "fakta"],
      ["Vad har sköldpaddan i stället för tänder?", ["En vass mun", "Små taggar", "En lång tunga", "Vassa klor"], "fakta"],
      ["Den är skyddad. Vad betyder skyddad?", ["Att inget kan skada den", "Att den är hungrig", "Att den sover", "Att den är ensam"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-tranan", title: "Fåglarna som dansar", textType: "fact", topic: "djur",
    body: [
      "Tranan är en stor grå fågel med långa ben och lång hals. På huvudet har den en röd fläck.",
      "På vintern bor tranorna i varmare länder. På våren flyger de tillbaka till Sverige.",
      "Då händer något roligt. Tranorna dansar! De hoppar, slår med vingarna och bugar mot varandra.",
      "Tranan har ett högt läte som låter som en trumpet. Det hörs långt bort. Många människor åker ut för att titta på dansen.",
    ],
    q: [
      ["Vilken färg har tranan?", ["Grå", "Vit", "Svart", "Brun"], "fakta"],
      ["Vad har tranan på huvudet?", ["En röd fläck", "En gul fjäder", "En blå kam", "En svart prick"], "fakta"],
      ["Var bor tranorna på vintern?", ["I varmare länder", "I skogen i Sverige", "Uppe på fjället", "Vid havet i norr"], "fakta"],
      ["Vad gör tranorna på våren?", ["Dansar", "Sover", "Simmar", "Gräver"], "fakta"],
      ["Vad låter tranans läte som?", ["En trumpet", "En trumma", "En fiol", "En flöjt"], "fakta"],
    ],
  },
  {
    id: "lr-g2-blabar", title: "Blåbär i skogen", textType: "fact", topic: "natur",
    body: [
      "I skogen växer blåbärsris. Riset är lågt och har små gröna blad.",
      "På våren får riset små blommor som ser ut som lyktor. Bina flyger till blommorna. Sedan blir blommorna till bär.",
      "Först är bären gröna och hårda. I juli och augusti blir de blå och mjuka. Då kan man plocka dem.",
      "Blåbär är goda och nyttiga. Man kan äta dem i gröt eller baka paj. Men akta dig: munnen och fingrarna blir blå!",
    ],
    q: [
      ["Hur ser blåbärsriset ut?", ["Lågt med små blad", "Högt med stora blad", "Tjockt med taggar", "Långt med vita blad"], "fakta"],
      ["Vad liknar blommorna?", ["Lyktor", "Stjärnor", "Bollar", "Hjärtan"], "fakta"],
      ["Hur är bären först?", ["Gröna och hårda", "Blå och mjuka", "Röda och söta", "Svarta och stora"], "fakta"],
      ["När kan man plocka blåbär?", ["I juli och augusti", "I april och maj", "I oktober", "Mitt i vintern"], "fakta"],
      ["Vad blir blått när man äter blåbär?", ["Munnen och fingrarna", "Håret och öronen", "Kläderna och skorna", "Näsan och ögonen"], "fakta"],
    ],
  },
  {
    id: "lr-g2-granen", title: "Granen är alltid grön", textType: "fact", topic: "natur",
    body: [
      "På hösten tappar många träd sina löv. Men granen är grön hela året.",
      "Granen har inga vanliga löv. Den har barr. Barren är smala som nålar och sticks lite. De klarar kyla och snö.",
      "Högt upp i granen hänger kottar. I kottarna finns små frön. Ekorrar och fåglar tycker om att äta fröna.",
      "I december tar många hem en gran. De klär den med kulor och ljus. Då kallas den julgran.",
    ],
    q: [
      ["När är granen grön?", ["Hela året", "Bara på sommaren", "Bara på våren", "Bara i december"], "fakta"],
      ["Vad har granen i stället för löv?", ["Barr", "Blommor", "Kottar", "Grenar"], "fakta"],
      ["Barren är smala. Vad betyder smala?", ["Tunna", "Tjocka", "Mjuka", "Långa"], "ordforstaelse"],
      ["Vad finns i kottarna?", ["Små frön", "Små bär", "Små ägg", "Små maskar"], "fakta"],
      ["Vad kallas granen när man klär den i december?", ["Julgran", "Vintergran", "Tomtegran", "Snögran"], "fakta"],
    ],
  },
  {
    id: "lr-g2-skelettet", title: "Benen i kroppen", textType: "fact", topic: "vetenskap",
    body: [
      "Inne i din kropp finns ett skelett. Det är gjort av ben. En vuxen människa har ungefär tvåhundra ben.",
      "Skelettet håller kroppen uppe. Utan det skulle du vara mjuk som en trasdocka.",
      "Skelettet skyddar också kroppen. Skallen är som en hjälm runt hjärnan. Revbenen är som ett staket runt hjärtat.",
      "Det minsta benet sitter inne i örat. Det största sitter i låret. Om ett ben går av kan det växa ihop igen.",
    ],
    q: [
      ["Vad är skelettet gjort av?", ["Ben", "Muskler", "Hud", "Blod"], "fakta"],
      ["Hur många ben har en vuxen?", ["Ungefär tvåhundra", "Ungefär tjugo", "Ungefär tusen", "Ungefär hundra"], "fakta"],
      ["Vad skyddar skallen?", ["Hjärnan", "Hjärtat", "Magen", "Ögonen"], "fakta"],
      ["Var sitter det största benet?", ["I låret", "I armen", "I örat", "I ryggen"], "fakta"],
      ["Vad kan hända med ett ben som går av?", ["Det kan växa ihop", "Det försvinner", "Det blir mjukt som gummi", "Det blir längre"], "fakta"],
    ],
  },
  {
    id: "lr-g2-magen", title: "Matens resa", textType: "fact", topic: "vetenskap",
    body: [
      "När du äter börjar maten en lång resa genom kroppen.",
      "Först tuggar du maten med tänderna. Saliven i munnen gör maten mjuk. Sedan sväljer du.",
      "Maten åker ner i ett rör till magen. I magen blandas maten och blir som en gröt.",
      "Efter magen kommer tarmarna. De är långa och ligger hoprullade i magen. Där tar kroppen hand om allt nyttigt i maten. Det som blir över kommer ut när du går på toaletten.",
    ],
    q: [
      ["Vad gör du först med maten?", ["Tuggar den", "Sväljer den", "Luktar på den", "Kyler den"], "fakta"],
      ["Vad gör maten mjuk i munnen?", ["Saliven", "Tungan", "Vattnet", "Läpparna"], "fakta"],
      ["Vad blir maten som i magen?", ["En gröt", "En soppa", "En sten", "En kaka"], "fakta"],
      ["Vad kommer efter magen?", ["Tarmarna", "Munnen", "Hjärtat", "Lungorna"], "fakta"],
      ["Du sväljer maten. Vad betyder sväljer?", ["Låter maten åka ner i halsen", "Spottar ut maten", "Skär maten i bitar", "Tuggar maten länge och noga"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-ubaten", title: "Båten som dyker", textType: "fact", topic: "teknik",
    body: [
      "En ubåt är en båt som kan åka under vattnet.",
      "Ubåten har stora tankar inuti. När den ska dyka släpper den in vatten i tankarna. Då blir den tung och sjunker.",
      "När ubåten ska upp igen trycker den ut vattnet med luft. Då blir den lätt och stiger mot ytan.",
      "Ibland vill de som är i ubåten se vad som finns ovanför vattnet. Då skjuter de upp ett långt rör med speglar. Det kallas periskop.",
    ],
    q: [
      ["Var kan en ubåt åka?", ["Under vattnet", "I luften", "På isen", "På land"], "fakta"],
      ["Vad släpper ubåten in i tankarna för att dyka?", ["Vatten", "Luft", "Sand", "Olja"], "fakta"],
      ["Vad händer när ubåten blir tung?", ["Den sjunker", "Den flyter upp", "Den åker fortare", "Den stannar"], "fakta"],
      ["Vad trycker ut vattnet?", ["Luft", "Motorn", "Fiskar", "Propellern"], "fakta"],
      ["Vad heter röret med speglar?", ["Periskop", "Teleskop", "Mikroskop", "Kikare"], "fakta"],
    ],
  },
  {
    id: "lr-g2-gravmaskinen", title: "Grävmaskinen", textType: "fact", topic: "teknik",
    body: [
      "När man ska bygga ett hus behöver man först gräva ett stort hål. Då kommer grävmaskinen.",
      "Grävmaskinen har en lång arm. Längst ut på armen sitter en skopa med vassa tänder. Skopan gräver i jorden och lyfter upp den.",
      "Föraren sitter i en hytt och styr med spakar. Hytten kan snurra runt.",
      "Många grävmaskiner har larvband i stället för hjul. Larvbanden gör att maskinen inte sjunker ner i lera.",
    ],
    q: [
      ["Varför gräver man ett hål först?", ["För att bygga ett hus", "För att hitta vatten", "För att plantera träd", "För att leta skatter"], "fakta"],
      ["Vad sitter längst ut på armen?", ["En skopa", "En lampa", "En krok", "En hammare"], "fakta"],
      ["Var sitter föraren?", ["I en hytt", "På taket", "På armen", "Bredvid maskinen"], "fakta"],
      ["Vad styr föraren med?", ["Spakar", "En ratt", "Knappar", "En fjärrkontroll"], "fakta"],
      ["Varför har grävmaskinen larvband?", ["Så att den inte sjunker i lera", "Så att den kan åka mycket fortare", "Så att den låter mindre", "Så att den kan simma"], "fakta"],
    ],
  },
  {
    id: "lr-g2-merkurius", title: "Planeten närmast solen", textType: "fact", topic: "rymden",
    body: [
      "Merkurius är den planet som ligger närmast solen. Den är också den minsta planeten.",
      "Merkurius har ingen luft runt sig, som vi har på jorden. Därför blir det väldigt varmt på dagen. Men på natten blir det iskallt.",
      "Merkurius är grå och full av gropar. Den liknar vår måne.",
      "Merkurius åker snabbt runt solen. Ett år där är bara ungefär tre månader långt. Ingen människa har varit där.",
    ],
    q: [
      ["Var ligger Merkurius?", ["Närmast solen", "Längst bort från solen", "Bredvid månen", "Mitt i jorden"], "fakta"],
      ["Hur stor är Merkurius?", ["Den minsta planeten", "Den största planeten", "Lika stor som solen", "Större än jorden"], "fakta"],
      ["Hur är det på natten på Merkurius?", ["Iskallt", "Väldigt varmt", "Ljust", "Blåsigt"], "fakta"],
      ["Vad liknar Merkurius?", ["Vår måne", "Solen", "Mars", "Jorden"], "fakta"],
      ["Varför blir det så kallt på natten?", ["Det finns ingen luft", "Planeten är liten", "Planeten är grå", "Solen slocknar på natten"], "fakta"],
    ],
  },
  {
    id: "lr-g2-lajka", title: "Hunden i rymden", textType: "fact", topic: "rymden",
    body: [
      "För länge sedan visste ingen om ett djur kunde åka till rymden. Kunde man andas och äta där uppe?",
      "År 1957 skickade Sovjetunionen upp en liten hund i en rymdfarkost. Hunden hette Lajka. Hon hade bott på gatan i Moskva innan.",
      "Lajka satt i en liten kapsel. Den hade luft och mat. Hon åkte runt jorden flera gånger.",
      "Tack vare Lajka lärde sig forskarna mycket. Några år senare kunde den första människan åka till rymden.",
    ],
    q: [
      ["Vilket år åkte Lajka upp?", ["1957", "1975", "1907", "1997"], "fakta"],
      ["Vad var Lajka?", ["En hund", "En katt", "En apa", "En mus"], "fakta"],
      ["Var bodde Lajka innan?", ["På gatan", "I ett zoo", "Hos en forskare", "På en bondgård"], "fakta"],
      ["Vad fanns i kapseln?", ["Luft och mat", "Leksaker och en boll", "En säng och en lampa", "Vatten och sand"], "fakta"],
      ["Varför var Lajkas resa viktig?", ["Forskarna lärde sig mycket", "Hon blev en filmstjärna", "Hon hittade en ny planet i rymden", "Hon fick en medalj"], "helhet_slutsats"],
    ],
  },
  {
    id: "lr-g2-oland", title: "Ön med den långa bron", textType: "fact", topic: "geografi",
    body: [
      "Öland är en lång och smal ö i Östersjön. Den ligger utanför Kalmar.",
      "För att komma dit kan man åka över Ölandsbron. Bron är över sex kilometer lång. Den var länge Sveriges längsta bro.",
      "På Öland står många gamla väderkvarnar. Förr malde de säd till mjöl med hjälp av vinden.",
      "Kungen har ett sommarhus på Öland. Det heter Solliden. På sommaren kommer många turister för att bada och cykla.",
    ],
    q: [
      ["I vilket hav ligger Öland?", ["Östersjön", "Västerhavet", "Nordsjön", "Bottenviken"], "fakta"],
      ["Hur lång är Ölandsbron?", ["Över sex kilometer", "Över tio kilometer", "Under en kilometer", "Hundra meter"], "fakta"],
      ["Vad malde väderkvarnarna?", ["Säd", "Sten", "Kaffe", "Salt"], "fakta"],
      ["Vem har ett sommarhus på Öland?", ["Kungen", "Statsministern", "En känd sångare", "En stor forskare"], "fakta"],
      ["Vad heter kungens sommarhus?", ["Solliden", "Solhem", "Sommarro", "Solvik"], "fakta"],
    ],
  },
  {
    id: "lr-g2-skane", title: "Sveriges sydspets", textType: "fact", topic: "geografi",
    body: [
      "Skåne ligger längst ner i Sverige. Där är det ofta varmare än i resten av landet.",
      "Skåne är platt. Det finns nästan inga höga berg. I stället finns stora åkrar så långt man kan se.",
      "På våren blommar rapsen. Då blir åkrarna knallgula. Av rapsens frön gör man olja.",
      "Bönderna i Skåne odlar också sockerbetor, vete och potatis. Därför kallas Skåne ibland Sveriges skafferi.",
    ],
    q: [
      ["Var i Sverige ligger Skåne?", ["Längst ner", "Längst upp", "I mitten", "Längst ut i väster"], "fakta"],
      ["Hur ser landet ut i Skåne?", ["Platt", "Bergigt", "Fullt av sjöar", "Täckt av skog"], "fakta"],
      ["Vilken färg får rapsåkrarna?", ["Gul", "Röd", "Blå", "Vit"], "fakta"],
      ["Vad gör man av rapsens frön?", ["Olja", "Mjöl", "Socker", "Te"], "fakta"],
      ["Varför kallas Skåne Sveriges skafferi?", ["Där odlas mycket mat", "Där finns många affärer", "Där bor många kockar", "Där är det kallt"], "mellan_raderna"],
    ],
  },
  {
    id: "lr-g2-ljus-forr", title: "Ljus innan elen", textType: "fact", topic: "historia",
    body: [
      "Förr fanns det ingen el i husen. Det fanns inga lampor att tända med en knapp.",
      "När det blev mörkt tände man stearinljus. Ännu tidigare gjorde man ljus av fett från djur. Barnen fick hjälpa till att göra ljusen.",
      "Senare kom fotogenlampan. Den lyste starkare än ett ljus, men den luktade och sotade.",
      "Ljus var dyra. Därför gick många människor och lade sig tidigt. På vintern var kvällarna långa och mörka.",
    ],
    q: [
      ["Vad fanns inte i husen förr?", ["El", "Fönster", "Dörrar", "Sängar"], "fakta"],
      ["Vad tände man när det blev mörkt?", ["Stearinljus", "Lampor", "Ficklampor", "Fyrverkerier"], "fakta"],
      ["Vad gjorde man ljus av ännu tidigare?", ["Fett från djur", "Sand och vatten", "Gräs och halm", "Trä från granen"], "fakta"],
      ["Vad var dåligt med fotogenlampan?", ["Den luktade och sotade", "Den var för liten", "Den lyste för svagt", "Den gick inte att bära"], "fakta"],
      ["Varför gick många och lade sig tidigt?", ["Ljusen var dyra", "De var sjuka", "De hade inga sängar", "Barnen var trötta"], "fakta"],
    ],
  },
  {
    id: "lr-g2-leksaker-forr", title: "Leksaker förr", textType: "fact", topic: "historia",
    body: [
      "För hundra år sedan fanns det inga affärer fulla med leksaker. Många barn fick göra sina egna.",
      "Av kottar och pinnar gjorde barnen kor och får. Kottkorna stod i en hage av stenar.",
      "Pappa eller farfar kunde tälja en häst i trä. Mamma eller farmor sydde dockor av gamla tygbitar.",
      "Barnen lekte också mycket ute. De hoppade hage, lekte kurragömma och spelade kula. Många av lekarna leker barn än i dag.",
    ],
    q: [
      ["Vad gjorde barnen kor av?", ["Kottar och pinnar", "Lera och sten", "Papper och lim", "Snö och is"], "fakta"],
      ["Var stod kottkorna?", ["I en hage av stenar", "I en låda", "På ett bord", "I en ladugård"], "fakta"],
      ["Vad kunde pappa eller farfar tälja?", ["En häst", "En båt", "En bil", "En docka"], "fakta"],
      ["Vad sydde man dockor av?", ["Gamla tygbitar", "Nya strumpor", "Ull från fåren", "Gamla tidningar"], "fakta"],
      ["Vad betyder tälja?", ["Skära ut något i trä", "Måla något fint", "Sy med nål", "Bygga av sten"], "ordforstaelse"],
    ],
  },
];
