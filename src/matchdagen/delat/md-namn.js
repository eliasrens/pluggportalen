// ============================================================================
// Matchdagen (#869, Etapp 1c): namnen och färgerna – ren data (spec §5).
// Allt är PÅHITTAT: inga riktiga klubbar, ligor eller spelare (§0 Varumärken).
//   MOTSTANDARE  ≥ 60 motståndarlag ("Ekebacka IF", "FC Stjärnbo", …)
//   FORNAMN, EFTERNAMN  spelarnas färdiga namn (går inte att döpa om, §5) – 120 × 100 (#878).
//                       Bara bokstäver (reglerna: inga | / < > & "), inga dubbletter
//                       (test/matchdagen-namn-878.test.js). Namnen lottas bara när en klubb
//                       eller marknaden skapas och SPARAS i dokumentet (truppen, reserverna,
//                       marknadens rader) – inget räknas om ur ett index, så längre listor
//                       rör inga sparade karriärer. Nya namn läggs ändå till i slutet.
//                       #916: ett förnamn bytt på sin plats (Salihom) – de sparade spelarna
//                       döps om av admin/migrera-md-salihom.mjs.
//   TROJFARGER   de 8 tröjfärgerna eleven väljer bland
//   LAGFARGER    motståndarnas färger
// ============================================================================

export const MOTSTANDARE = [
  "Ekebacka IF", "FC Stjärnbo", "Sjöviks BK", "Granåsens IK", "Björkhagen United", "Hälleberga FF",
  "Tallmo SK", "Norrbäcks AIK", "Älvdalens BoIS", "Kvarnby FC", "Lindö GoIF", "Stenbrottets IF",
  "Västerängs FK", "Ugglans BK", "Mossbo United", "Sandmons Lejon", "Rävlyckans IF", "Fjällnäs FF",
  "Kärrbo SK", "Ängsbacka BK", "Solhöjdens IK", "Bäckeby FC", "Hagalunds Örnar", "Blåklintens IF",
  "Strandmo BK", "Ekholmens FF", "Klippans Vargar", "Månvikens IK", "Svanholms SK", "Tornby United",
  "Lövsta GoIF", "Myrbackens FC", "Ringdalens IF", "Höstvikens BK", "Grusbacka FF", "Stjärnvallens IK",
  "Älgmyrens SK", "Vindhamns FC", "Kullaby IF", "Björnvikens BK", "Furuhöjdens FF", "Sävsjöns IK",
  "Norrskogens United", "Gläntans SK", "Hjortby FC", "Sjöbergs IF", "Brovalla BK", "Ljungdalens FF",
  "Eksätra IK", "Skogsbo SK", "Rönnängens FC", "Vårbyns IF", "Lärkbackens BK", "Snöbergs FF",
  "Mälarviks IK", "Tranåsens SK", "Granvikens FC", "Kronbackens IF", "Ödmårdens BK", "Fågelsta FF",
  "Hamreängs IK", "Valleby SK", "Bergsjöns Falkar", "Smedjebacka United", "Östanbäcks IF", "Lillåns BK",
];

/**
 * Mästarcupens toppklubbar (§10.2, Etapp 3): påhittade klubbar "från andra länder" – inga
 * riktiga klubbar, bara namnformer som låter utländska (Real, AC, Atlético, Sporting …).
 */
export const TOPPKLUBBAR = [
  "Real Solvik", "AC Nordstjärna", "Atlético Vindmar", "Sporting Kustby", "Dynamo Fjällby", "Olympique Havsbo",
  "Inter Ljusdal", "Racing Bergvik", "Union Stenhamn", "Athletic Granfors", "Lokomotiv Isvik", "Royal Dimmaby",
  "Rapid Solhamn", "Estrela Strandvik", "Deportivo Ekudden", "Spartak Vinterö",
];

export const FORNAMN = [
  "Alvin", "Selma", "Omar", "Wilma", "Leo", "Nora", "Ali", "Alva", "Hugo", "Juni", "Sami", "Ines",
  "Liam", "Maja", "Noah", "Saga", "Adam", "Ebba", "Theo", "Lova", "Isak", "Tilde", "Melvin", "Siri",
  "Yusuf", "Elsa", "Vincent", "Salihom", "Malte", "Ronja", "Aron", "Leah", "Edvin", "Mira", "Jonatan", "Amira",
  // #878: fler namn, hälften flickor och hälften pojkar, vanliga i svenska skolor i dag.
  "Astrid", "Oscar", "Alice", "William", "Olivia", "Lucas", "Ella", "Elton", "Freja", "Viggo", "Agnes", "Charlie",
  "Vera", "Ludvig", "Stella", "Arvid", "Signe", "Axel", "Ellen", "Frans", "Elvira", "Sixten", "Klara", "Otto",
  "Märta", "Folke", "Ellie", "Harry", "Iris", "Nils", "Linnea", "Gustav", "Tyra", "Albin", "Ester", "Oliver",
  "Hanna", "Vidar", "Moa", "Loke", "Sofia", "Melker", "Emilia", "Ivar", "Lea", "Kevin", "Majken", "Anton",
  "Idun", "Filip", "Edith", "Emil", "Greta", "Milo", "Svea", "Ibrahim", "Nova", "Hamza", "Thea", "Yassin",
  "Lina", "Mustafa", "Yasmin", "Ahmed", "Sara", "Kerem", "Hiba", "Emir", "Zainab", "Mikael", "Aya", "Daniel",
  "Fatima", "Samuel", "Noor", "Benjamin", "Mariam", "Elis", "Nadia", "Jakob", "Elif", "Valter", "Zeynep", "Sigge",
];

export const EFTERNAMN = [
  "Berg", "Ek", "Lind", "Ström", "Holm", "Sund", "Dahl", "Falk", "Nyberg", "Ahmadi", "Kaya", "Nilsson",
  "Virtanen", "Hassan", "Lund", "Kovač", "Sandberg", "Björk", "Hedlund", "Öberg", "Mohammed", "Lindqvist",
  "Ali", "Engström", "Fors", "Wikström", "Nyström", "Åberg", "Berglund", "Sjöberg", "Yilmaz", "Hammar",
  // #878
  "Andersson", "Johansson", "Karlsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson",
  "Pettersson", "Jonsson", "Jansson", "Hansson", "Bengtsson", "Lindberg", "Lindström", "Axelsson", "Lundberg",
  "Jakobsson", "Magnusson", "Mattsson", "Lindgren", "Lundgren", "Bergström", "Lundqvist", "Mårtensson",
  "Fredriksson", "Sandström", "Nordin", "Holmberg", "Forsberg", "Söderberg", "Ekström", "Hellström", "Sundberg",
  "Blom", "Wallin", "Strand", "Månsson", "Isaksson", "Nordström", "Hosseini", "Mohamud", "Abdi", "Haddad",
  "Karimi", "Rahimi", "Demir", "Öztürk", "Korhonen", "Nieminen", "Mäkinen", "Nowak", "Kowalski", "Popović",
  "Hodžić", "Novak", "Jovanović", "Nguyen", "Tran", "Haidari", "Farah", "Warsame", "Osman", "Rossi", "García",
  "Silva", "Costa",
];

/** Elevens 8 tröjfärger (§5). Den första är standard. */
export const TROJFARGER = ["#2f6fe8", "#e8473f", "#2ecc71", "#f59f1a", "#8e5cf7", "#11a3a3", "#e84a9a", "#f2f2f2"];
export const TROJFARG_NAMN = ["Blå", "Röd", "Grön", "Orange", "Lila", "Turkos", "Rosa", "Vit"];

/** Motståndarnas färger (lottas, aldrig samma som elevens tröja). */
export const LAGFARGER = [
  "#e8473f", "#f59f1a", "#8e5cf7", "#e84a9a", "#11a3a3", "#f2f2f2", "#7a8899", "#c0392b",
  "#2ecc71", "#d35400", "#9b59b6", "#16a085", "#2f6fe8", "#b8860b",
];

/** Startelvan i 7-mannafotboll (§8.1): 1 MV, 2 FÖR, 2 MIT, 2 ANF – med tröjnummer. */
export const STARTELVA = [
  { pos: "MV", nr: 1 }, { pos: "FÖR", nr: 2 }, { pos: "FÖR", nr: 3 }, { pos: "MIT", nr: 6 },
  { pos: "MIT", nr: 8 }, { pos: "ANF", nr: 9 }, { pos: "ANF", nr: 10 },
];
export const POS_NAMN = { MV: "Målvakt", "FÖR": "Försvar", MIT: "Mittfält", ANF: "Anfall" };

/** Standardnamnet – också det läraren återställer till (§1.2, §6.1). */
export const STANDARD_LAGNAMN = "Pluggporten FC";
