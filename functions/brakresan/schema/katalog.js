// ============================================================================
// Bråkresan – utmaningskatalogen (src/brakresan/schema/katalog.js) · #706
// ----------------------------------------------------------------------------
// Spec §8: exakt 50 utmaningar med STABILA id "01"–"50" och fasta namn. Här
// bor bara METADATA (lätt, ingen generator): huvudvyns lista (H), lärarvyns
// matris och kunskapstaggar (K) och serverns kontroll av utmanings-id (C).
// Generatorerna bor i ../utmaningar/uNN.js och laddas med loadChallenge().
//
// Fält per utmaning:
//   id, nr, name     "03", 3, "Måla bråket"  (namn exakt enligt spec §8)
//   section          ämnesrubrikens id (SECTIONS)
//   grade            rekommenderad årskurs ("3–4") – rekommendation, ingen spärr
//   extra            null | "extra" | "extra-blandade" (§3: 38, 47, 48 resp. 50)
//   goal             kort målmening för listkortet ("Här tränar du …")
//   tags             kunskapstaggar (TAGS) – lärarens momentöversikt
//   components       komponenter ur biblioteket (B, docs/BRAKRESAN.md §5)
//   owner            sub-issue som bygger generatorn
// ============================================================================

export const SECTIONS = Object.freeze([
  { id: "upptack", name: "Upptäck bråk", grade: "3–4", from: 1, to: 10 },
  { id: "likvardiga", name: "Likvärdiga bråk och tallinjer", grade: "3–4", from: 11, to: 20 },
  { id: "jamfora", name: "Jämföra, förkorta och större bråk", grade: "4–5", from: 21, to: 30 },
  { id: "rakna", name: "Räkna med bråk och decimaler", grade: "4–6", from: 31, to: 40 },
  { id: "procent", name: "Procent och mer avancerade utmaningar", grade: "5–6", from: 41, to: 50 },
]);

/** Kunskapstaggar → lärarens etikett (§12 "Momentöversikt grupperad med kunskapstaggar"). */
export const TAGS = Object.freeze({
  "lika-delar": "Lika stora delar",
  "del-helhet": "Del och helhet",
  "brak-bild": "Bråk i bild",
  "brak-ord": "Bråk i ord",
  "andel-av-antal": "Andel av antal",
  likvardighet: "Likvärdiga bråk",
  jamforelse: "Jämföra och ordna",
  tallinje: "Tallinjen",
  forkortning: "Förlänga och förkorta",
  "storre-an-1": "Bråk större än 1",
  "addition-subtraktion": "Addition och subtraktion",
  "multiplikation-division": "Multiplikation och division",
  decimal: "Decimaltal",
  procent: "Procent",
  problemlosning: "Problemlösning",
  resonemang: "Resonemang och rimlighet",
});

/** Komponentbiblioteket (spec §4, sub-issue B #707) – id → namn. */
export const COMPONENTS = Object.freeze({
  notation: "Bråknotation och bråkinmatning",
  stav: "Bråkstav",
  cirkel: "Bråkcirkel",
  rutnat: "Rektangel/rutnät",
  hundraruta: "Hundraruta",
  tallinje: "Tallinje",
  mangd: "Mängdbild",
  kort: "Matchningskort",
  sortering: "Sorteringsyta",
  areamodell: "Areal modell för produkt",
  hjalp: "Hjälppanel",
  resultat: "Resultat och belöning",
});

const E = "#710 E";
const F = "#711 F";
const G = "#712 G";
const D = "#709 D";

// [nr, namn, extra, mål, taggar, komponenter, ägare]
const RADER = [
  [1, "Lika stora delar", null, "Förstå att bråkdelar av en area måste vara lika stora.",
    ["lika-delar", "del-helhet"], ["cirkel", "rutnat", "stav"], E],
  [2, "Vilket bråk visar bilden?", null, "Koppla markerade delar till täljaren och alla lika delar till nämnaren.",
    ["brak-bild", "del-helhet"], ["cirkel", "stav", "rutnat", "kort", "notation"], E],
  [3, "Måla bråket", null, "Bygg en given andel genom att markera delar.",
    ["brak-bild", "del-helhet"], ["cirkel", "rutnat", "notation"], D],
  [4, "Bråk med ord", null, "Läs och förstå bråkens namn.",
    ["brak-ord", "brak-bild"], ["kort", "notation", "cirkel", "stav"], E],
  [5, "Hitta helheten", null, "Bygg en hel utifrån en given enhetsbråkdel.",
    ["del-helhet", "brak-bild"], ["stav", "mangd", "notation"], E],
  [6, "Hitta tre som hör ihop", null, "Se samma andel i olika modeller.",
    ["brak-bild", "likvardighet"], ["kort", "cirkel", "stav", "rutnat", "notation"], E],
  [7, "Bråk av en samling", null, "Förstå andel av ett antal föremål.",
    ["andel-av-antal", "del-helhet"], ["mangd", "notation"], E],
  [8, "Vilket kort är fel?", null, "Granska representationer och hitta den som avviker.",
    ["brak-bild", "resonemang"], ["kort", "cirkel", "stav", "mangd", "notation"], E],
  [9, "Vilket är störst?", null, "Jämför bråk genom deras storlek, inte bara siffrorna.",
    ["jamforelse", "brak-bild"], ["stav", "cirkel", "notation"], E],
  [10, "Bråk i vardagen", null, "Använd del och helhet i korta vardagssituationer.",
    ["del-helhet", "problemlosning"], ["stav", "cirkel", "mangd", "notation"], E],
  [11, "Lika mycket – olika bilder", null, "Förstå att värdet är detsamma fast indelningen ändras.",
    ["likvardighet", "brak-bild"], ["kort", "cirkel", "stav", "rutnat"], E],
  [12, "Hitta tre lika bråk", null, "Upptäck likvärdiga bråk bland symbolkort.",
    ["likvardighet"], ["kort", "notation", "stav", "hundraruta"], D],
  [13, "Dela bråkstaven", null, "Se varför täljare och nämnare multipliceras med samma tal.",
    ["likvardighet", "forkortning"], ["stav", "notation"], E],
  [14, "Förläng bråket", null, "Skriv ett likvärdigt bråk med en given nämnare.",
    ["likvardighet", "forkortning"], ["notation", "stav", "hundraruta"], E],
  [15, "Sortera bråkfamiljer", null, "Ordna likvärdiga bråk i familjer.",
    ["likvardighet"], ["sortering", "kort", "notation", "stav"], E],
  [16, "Samma nämnare", null, "Jämför bråk när delarna är lika stora.",
    ["jamforelse", "resonemang"], ["stav", "notation"], E],
  [17, "Samma täljare", null, "Förstå att fler delar av samma helhet gör varje del mindre.",
    ["jamforelse", "resonemang"], ["stav", "notation"], E],
  [18, "Vilken punkt är rätt?", null, "Läs bråk som tal och avstånd från noll.",
    ["tallinje"], ["tallinje", "notation"], E],
  [19, "Placera på tallinjen", null, "Placera ett bråk på rätt plats på tallinjen.",
    ["tallinje"], ["tallinje", "notation"], D],
  [20, "Hälften, tredjedelen, fjärdedelen", null, "Beräkna en halv, en tredjedel eller en fjärdedel av ett antal.",
    ["andel-av-antal"], ["mangd", "notation"], E],
  [21, "Förkorta bråket", null, "Se förkortning som gruppering och skriv bråket i enklaste form.",
    ["forkortning", "likvardighet"], ["stav", "rutnat", "notation"], F],
  [22, "Det saknade talet", null, "Resonera om likvärdiga bråk åt båda hållen.",
    ["likvardighet", "forkortning"], ["notation", "stav"], F],
  [23, "Bråkkompisar – blandade kort", null, "Se samma värde i symbol, text, mängd och bild.",
    ["likvardighet", "brak-bild"], ["kort", "mangd", "stav", "cirkel", "notation"], F],
  [24, "Mer eller mindre än en halv?", null, "Använd en halv som jämförelsepunkt.",
    ["jamforelse"], ["sortering", "kort", "stav", "notation"], F],
  [25, "Olika nämnare", null, "Jämför bråk med olika stora delar.",
    ["jamforelse", "resonemang"], ["stav", "notation"], F],
  [26, "Sortera bråk i ordning", null, "Ordna flera bråk från minst till störst.",
    ["jamforelse", "tallinje"], ["sortering", "kort", "stav", "tallinje", "notation"], F],
  [27, "Mer än en hel", null, "Förstå bråk som är större än 1.",
    ["storre-an-1", "brak-bild"], ["cirkel", "stav", "tallinje", "notation"], F],
  [28, "Blandad form", null, "Växla mellan bråkform och blandad form.",
    ["storre-an-1"], ["stav", "cirkel", "notation"], F],
  [29, "Tre fjärdedelar av ett antal", null, "Beräkna en andel av ett antal.",
    ["andel-av-antal"], ["mangd", "stav", "notation"], F],
  [30, "Kluriga andelar", null, "Lös problem om del, andel, helhet och det som blir kvar.",
    ["andel-av-antal", "problemlosning"], ["stav", "mangd", "notation"], F],
  [31, "Addera lika nämnare", null, "Addera delar av samma storlek.",
    ["addition-subtraktion"], ["stav", "notation"], F],
  [32, "Subtrahera lika nämnare", null, "Ta bort delar av samma storlek.",
    ["addition-subtraktion"], ["stav", "notation"], F],
  [33, "Hitta räknefelet", null, "Upptäck och förklara vanliga missförstånd.",
    ["addition-subtraktion", "resonemang"], ["stav", "notation"], F],
  [34, "Addera olika nämnare", null, "Gör delarna lika stora innan du adderar.",
    ["addition-subtraktion", "likvardighet"], ["stav", "notation"], D],
  [35, "Subtrahera olika nämnare", null, "Subtrahera med gemensam delstorlek.",
    ["addition-subtraktion", "likvardighet"], ["stav", "notation"], F],
  [36, "Räkna över en hel", null, "Räkna när svaret behöver flera helheter.",
    ["addition-subtraktion", "storre-an-1"], ["stav", "notation"], G],
  [37, "Multiplicera med heltal", null, "Förstå heltal gånger bråk som upprepad addition.",
    ["multiplikation-division", "storre-an-1"], ["stav", "notation"], G],
  [38, "En del av en del", "extra", "Förstå bråk gånger bråk som en andel av en andel.",
    ["multiplikation-division"], ["areamodell", "notation"], G],
  [39, "Decimaler på bild", null, "Förstå tiondelar, hundradelar och positionsvärde.",
    ["decimal"], ["hundraruta", "stav", "notation"], G],
  [40, "Bråk till decimal", null, "Skriv bråk som decimaltal och tillbaka.",
    ["decimal", "likvardighet"], ["kort", "hundraruta", "tallinje", "notation"], G],
  [41, "Procent i hundrarutan", null, "Förstå procent som hundradelar.",
    ["procent"], ["hundraruta", "notation"], G],
  [42, "Tre former – samma värde", null, "Förbind bråk, decimaltal och procent.",
    ["procent", "decimal", "likvardighet"], ["kort", "hundraruta", "stav", "notation"], G],
  [43, "Vilken passar inte?", null, "Granska bråk, decimaltal, procent och bild.",
    ["procent", "decimal", "resonemang"], ["kort", "hundraruta", "mangd", "notation"], G],
  [44, "Procent av antal", null, "Beräkna procent av ett känt antal.",
    ["procent", "andel-av-antal"], ["stav", "mangd", "hundraruta", "notation"], G],
  [45, "Hur många procent?", null, "Bestäm procentandelen när delen och helheten är kända.",
    ["procent", "andel-av-antal"], ["stav", "mangd", "hundraruta", "notation"], G],
  [46, "Blandad storleksordning", null, "Jämför tal oavsett om de skrivs som bråk, decimal eller procent.",
    ["jamforelse", "procent", "decimal"], ["sortering", "kort", "tallinje", "notation"], G],
  [47, "Dela ett bråk", "extra", "Förstå ett bråk delat med ett heltal som lika delning.",
    ["multiplikation-division"], ["stav", "notation"], G],
  [48, "Hur många får plats?", "extra", "Förstå division som att mäta med en bråkdel.",
    ["multiplikation-division"], ["stav", "notation"], G],
  [49, "Rabatter och procentproblem", null, "Använd procent och skilj rabatten från det nya priset.",
    ["procent", "problemlosning"], ["stav", "notation"], G],
  [50, "Mästarkluringarna", "extra-blandade", "Välj strategi, lös problem i flera steg och bedöm rimlighet.",
    ["problemlosning", "resonemang"], ["stav", "mangd", "notation"], G],
];

/** "3" → "03". */
export const challengeId = (nr) => String(nr).padStart(2, "0");

const sectionOf = (nr) => SECTIONS.find((s) => nr >= s.from && nr <= s.to);

export const CHALLENGES = Object.freeze(RADER.map(([nr, name, extra, goal, tags, components, owner]) =>
  Object.freeze({
    id: challengeId(nr), nr, name, section: sectionOf(nr).id, grade: sectionOf(nr).grade,
    extra, goal, tags: Object.freeze(tags), components: Object.freeze(components), owner,
  })));

export const CHALLENGE_IDS = Object.freeze(CHALLENGES.map((c) => c.id));

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

/** Metadata för "03" (eller 3). Null för okända id. */
export function challengeMeta(id) {
  return BY_ID.get(typeof id === "number" ? challengeId(id) : String(id)) || null;
}

export const isChallengeId = (id) => typeof id === "string" && BY_ID.has(id);

/** Extra-etiketten (§3): "Extra utmaning" / "Extra utmaning – blandade kluringar" / null. */
export function extraLabel(c) {
  if (c?.extra === "extra") return "Extra utmaning";
  if (c?.extra === "extra-blandade") return "Extra utmaning – blandade kluringar";
  return null;
}
