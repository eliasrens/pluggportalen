// Färdiga ställningar för förhandsvisningen av schackbrädet (#775).
// Varje ställning laddas med brade.loadGame({ fen, drag }) – dragen spelas
// upp med chess.js, så att t.ex. en passant och upprepning fungerar på riktigt.
// test/schack-kontroll.test.js kontrollerar att alla är giltiga.

export const STALLNINGAR = [
  { id: "start", namn: "Utgångsställning", text: "Ett helt nytt parti." },
  {
    id: "rockad", namn: "Rockad",
    fen: "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1",
    text: "Tryck på kungen: g1 och c1 visas som möjliga drag (kort och lång rockad). Tornet hoppar över av sig självt.",
  },
  {
    id: "en-passant", namn: "En passant",
    fen: "rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", drag: ["d5"],
    text: "Svart har just flyttat d7–d5. Vit bonde på e5 kan ta en passant: e5 → d6.",
  },
  {
    id: "forvandling", namn: "Bondeförvandling",
    fen: "r7/1P5k/8/8/8/8/6K1/8 w - - 0 1",
    text: "Flytta bonden till b8 (eller ta tornet på a8). Väljaren visar dam först – Enter väljer dam.",
  },
  {
    id: "schack", namn: "Schack",
    fen: "rnbqk1nr/pppp1ppp/8/4p3/1b1P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 3",
    text: "Vit kung står i schack (röd glöd). Bara drag som räddar kungen visas: c3, Ld2, Dd2, Sc3, Sd2.",
  },
  {
    id: "bunden", namn: "Bunden springare",
    fen: "4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1",
    text: "Springaren på e2 skyddar kungen mot tornet. Den har inga möjliga drag – varje drag skulle ställa kungen i schack.",
  },
  {
    id: "matt", namn: "Matt i ett",
    fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    text: "Vit drar och gör matt: Ta8#.",
  },
  {
    id: "patt", namn: "Patt i ett",
    fen: "7k/8/8/6Q1/8/8/8/K7 w - - 0 1",
    text: "Dg6 gör patt – svart kan inte flytta men står inte i schack. Remi.",
  },
  {
    id: "material", namn: "För lite material",
    fen: "8/8/4k3/8/8/8/3p4/4K3 w - - 0 1",
    text: "Kxd2 lämnar bara två kungar kvar – remi.",
  },
  {
    id: "upprepning", namn: "Trefaldig upprepning",
    drag: ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1"],
    text: "Svart spelar Sg8 – samma ställning för tredje gången ger remi.",
  },
];

/** Slutrutorna: färdiga slutställningar sedda från elevens färg. */
export const SLUT = [
  { namn: "Matt – du vann", fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", egenFarg: "w", motstandare: "dator", senast: { from: "a1", to: "a8" } },
  { namn: "Matt – datorn vann", fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", egenFarg: "b", motstandare: "dator", senast: { from: "a1", to: "a8" } },
  { namn: "Patt", fen: "7k/8/6Q1/8/8/8/8/K7 b - - 1 1", egenFarg: "w", motstandare: "dator", senast: { from: "g5", to: "g6" } },
  { namn: "Remi – för lite material", fen: "8/8/4k3/8/8/8/3K4/8 b - - 0 1", egenFarg: "w", motstandare: "kompis", senast: { from: "e1", to: "d2" } },
  { namn: "Remi – 50 drag", fen: "8/8/4k3/8/8/2B5/2N5/3K4 b - - 100 80", egenFarg: "b", motstandare: "kompis" },
  { namn: "Gav upp (avsluta)", egenFarg: "w", motstandare: "kompis", gavUpp: true },
];
