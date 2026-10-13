// ============================================================================
// Läsresan – källtexter för nivå 2 del b, fact (issue #662)
// ----------------------------------------------------------------------------
// 20 fakta-texter, 60–90 ord, 4–5 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g2b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-2-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g2-myrstacken", title: "Myrornas stack", textType: "fact", topic: "djur",
    body: [
      "En myrstack kan se ut som en hög med barr. Men den är ett hem för väldigt många myror.",
      "Inne i stacken finns många gångar och rum. Där bor en eller flera drottningar. De lägger äggen.",
      "De andra myrorna kallas arbetare. De hämtar mat, bär barr och tar hand om äggen.",
      "Myror är små, men de är starka. En myra kan bära saker som är tyngre än den själv. Myrorna hjälper varandra hela tiden.",
    ],
    q: [
      ["Vad liknar en myrstack?", ["En hög med barr", "En stor sten", "Ett fågelbo", "En snöhög"], "fakta"],
      ["Vad finns inne i stacken?", ["Gångar och rum", "Vatten och sand", "Blommor och gräs", "Stenar och lera"], "fakta"],
      ["Vad gör drottningarna?", ["Lägger ägg", "Hämtar mat", "Bär barr", "Bygger gångar"], "fakta"],
      ["Vad kallas de andra myrorna?", ["Arbetare", "Drottningar", "Vakter", "Larver"], "fakta"],
      ["Vad kan en myra bära?", ["Saker som är tyngre än den", "Bara ett barr i taget", "Inga saker alls", "Bara saker som flyter"], "fakta"],
    ],
  },
  {
    id: "lr-g2-pingvinen", title: "Fågeln som simmar", textType: "fact", topic: "djur",
    body: [
      "Pingvinen är en fågel. Den har vingar, men den kan inte flyga. I stället är den mycket bra på att simma.",
      "Under vattnet använder pingvinen vingarna som paddlar. Den simmar snabbt och fångar fisk.",
      "De flesta pingviner bor på den södra delen av jorden. Många bor där det är kallt, till exempel i Antarktis.",
      "Pingvinen har tjocka fjädrar och ett lager fett under huden. Det håller den varm i det iskalla vattnet.",
    ],
    q: [
      ["Vad kan pingvinen inte göra?", ["Flyga", "Simma", "Gå", "Äta fisk"], "fakta"],
      ["Hur använder pingvinen vingarna i vattnet?", ["Som paddlar", "Som ett tak", "Som en mössa", "Som fötter"], "fakta"],
      ["Var bor de flesta pingviner?", ["På södra delen av jorden", "I skogarna i Sverige", "I varma öknar", "På norra delen av jorden"], "fakta"],
      ["Vad håller pingvinen varm?", ["Fjädrar och fett", "En tjock päls", "Solen på isen", "Varmt vatten"], "fakta"],
      ["Vattnet är iskallt. Vad betyder iskallt?", ["Väldigt kallt", "Lite ljummet", "Mycket smutsigt", "Ganska grunt"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-regnbagen", title: "Färgerna på himlen", textType: "fact", topic: "natur",
    body: [
      "En regnbåge kan synas när solen lyser samtidigt som det regnar. Då ser man en stor båge med färger på himlen.",
      "Solljuset ser vitt ut. Men egentligen finns många färger i det. När ljuset går in i regndropparna delas det upp i färger.",
      "Färgerna kommer alltid i samma ordning. Först kommer rött, sedan orange, gult, grönt, blått och lila.",
      "För att se regnbågen ska man ha solen bakom sig. Då tittar man mot regnet.",
    ],
    q: [
      ["När kan en regnbåge synas?", ["När solen lyser och det regnar", "När det är mulet och blåser kallt", "När det är mörkt ute", "När det snöar"], "fakta"],
      ["Vad finns egentligen i solljuset?", ["Många färger", "Små regndroppar", "Bara vitt ljus", "Lite rök"], "fakta"],
      ["Vilken färg kommer först i regnbågen?", ["Rött", "Blått", "Gult", "Lila"], "fakta"],
      ["Var ska solen vara när man tittar på regnbågen?", ["Bakom en", "Framför en", "Rakt ovanför", "Under marken"], "fakta"],
      ["Det finns egentligen många färger. Vad betyder egentligen?", ["I själva verket", "Kanske", "Aldrig", "Ibland"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-hjartat", title: "Hjärtat slår", textType: "fact", topic: "vetenskap",
    body: [
      "Hjärtat är en muskel. Det sitter i bröstet, lite till vänster. Ditt hjärta är ungefär lika stort som din knutna hand.",
      "Hjärtat pumpar blod runt i hela kroppen. Blodet går i rör som heter blodådror. Det tar med sig syre och näring till kroppen.",
      "När du springer slår hjärtat snabbare. Då behöver musklerna mer syre.",
      "Du kan känna hjärtat slå. Lägg handen på bröstet och var tyst en stund.",
    ],
    q: [
      ["Vad är hjärtat?", ["En muskel", "Ett ben", "En lunga", "Ett blodkärl"], "fakta"],
      ["Hur stort är hjärtat ungefär?", ["Som en knuten hand", "Som en fotboll", "Som en ärta", "Som ett huvud"], "fakta"],
      ["Vad heter rören som blodet går i?", ["Blodådror", "Muskler", "Lungor", "Nervtrådar"], "fakta"],
      ["Varför slår hjärtat snabbare när du springer?", ["Musklerna behöver mer syre", "Du blir rädd", "Du blir trött och hungrig", "Blodet börjar ta slut"], "fakta"],
      ["Hjärtat pumpar blod. Vad betyder det?", ["Det trycker runt blodet", "Det gör blodet kallt", "Det äter upp blodet", "Det sparar blodet"], "ordforstaelse"],
    ],
  },
  {
    id: "lr-g2-manen", title: "Månen byter form", textType: "fact", topic: "rymden",
    body: [
      "Månen åker runt jorden. Ett varv tar ungefär en månad.",
      "Månen lyser inte själv. Det är solen som lyser på den. Vi ser bara den del av månen som solen lyser på.",
      "Därför ser månen olika ut. Ibland ser vi en smal skära. Ibland ser vi en hel rund måne. Den kallas fullmåne.",
      "Ibland syns månen inte alls. Men månen är alltid lika rund. Det är bara ljuset på den som ändras.",
    ],
    q: [
      ["Vad åker månen runt?", ["Jorden", "Solen", "Stjärnorna", "Mars"], "fakta"],
      ["Hur lång tid tar ett varv?", ["Ungefär en månad", "En dag", "Ett helt år", "En vecka"], "fakta"],
      ["Varför lyser månen?", ["Solen lyser på den", "Den brinner", "Den har lampor", "Den är gjord av is"], "fakta"],
      ["Vad kallas det när vi ser hela månen?", ["Fullmåne", "Halvmåne", "Nymåne", "Månskära"], "fakta"],
      ["Vad är sant om månen?", ["Den är alltid rund", "Den krymper varje natt", "Den går sönder ibland", "Den byter färg varje natt"], "helhet_slutsats"],
    ],
  },
];
