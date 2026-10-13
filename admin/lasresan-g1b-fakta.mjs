// ============================================================================
// Läsresan – källtexter för nivå 1, fact, del B (issue #661)
// ----------------------------------------------------------------------------
// 20 fact-texter, 30–50 ord, 3–4 frågor. Rätt svar står FÖRST i varje
// options-lista; admin/lasresan-g1b-bygg.mjs flyttar det till en balanserad
// position och skriver src/lasresan/content/bank/level-1-b.json.
// ============================================================================

// [fråga, [rätt, fel, fel, fel], kategori]
export const FAKTA = [
  {
    id: "lr-g1-fisken", title: "Fisken", textType: "fact", topic: "djur",
    body: [
      "Fisken bor i vatten. Där letar den efter mat.",
      "Fisken andas med gälar. Gälarna sitter på sidan av huvudet.",
      "Fisken har fenor. Med fenorna simmar den. Kroppen är ofta täckt av fjäll.",
      "Vissa fiskar bor i sjöar. Andra bor i havet.",
    ],
    q: [
      ["Vad andas fisken med?", ["Gälar", "Fenor", "Fjäll", "Näsan"], "fakta"],
      ["Vad gör fisken med fenorna?", ["Simmar", "Äter", "Andas", "Sover"], "fakta"],
      ["Vad är fiskens kropp ofta täckt av?", ["Fjäll", "Päls", "Fjädrar", "Taggar"], "fakta"],
      ["Var sitter gälarna?", ["På sidan av huvudet", "Längst ut på svansen", "Mitt på ryggen", "Under magen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-kon", title: "Kon", textType: "fact", topic: "djur",
    body: [
      "Kon bor på en bondgård. Den äter gräs och hö.",
      "Kon ger mjölk. Bonden mjölkar kon varje dag. Av mjölken kan man göra ost och smör.",
      "En kalv är en liten ko.",
      "Kon säger ”mu”. På sommaren går korna ute i hagen.",
    ],
    q: [
      ["Vad äter kon?", ["Gräs och hö", "Kött och fisk", "Frukt och bär", "Bröd och kakor"], "fakta"],
      ["Vad kan man göra av mjölken?", ["Ost och smör", "Saft och sylt", "Mjöl och gryn", "Te och honung"], "fakta"],
      ["Vad är en kalv?", ["En liten ko", "En stor häst", "En sorts ost", "En gammal bonde"], "ordforstaelse"],
      ["Var går korna på sommaren?", ["Ute i hagen", "Inne i ladan", "I skogen", "På vägen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-snigeln", title: "Snigeln", textType: "fact", topic: "djur",
    body: [
      "Snigeln är ett litet djur. Den rör sig mycket sakta.",
      "Vissa sniglar har ett hus på ryggen. Huset är ett hårt skal. Där kan snigeln gömma sig.",
      "Snigeln lämnar ett spår av slem. Slemmet gör att den glider fram.",
      "Sniglar tycker om när det är blött.",
    ],
    q: [
      ["Hur rör sig snigeln?", ["Mycket sakta", "Mycket fort", "Med stora hopp", "Med vingar"], "fakta"],
      ["Vad kan vissa sniglar ha på ryggen?", ["Ett hus", "Taggar", "Fjädrar", "En svans"], "fakta"],
      ["Vad lämnar snigeln efter sig?", ["Ett spår av slem", "Ett spår av sand", "Små fjädrar", "Små hål"], "fakta"],
      ["Vilket väder tycker sniglar om?", ["Blött väder", "Torrt väder", "Snöigt väder", "Blåsigt väder"], "fakta"],
    ],
  },
  {
    id: "lr-g1-salen", title: "Sälen", textType: "fact", topic: "djur",
    body: [
      "Sälen bor i havet. Den är en bra simmare.",
      "Sälen har tjockt fett under huden. Fettet håller den varm. Vattnet är ofta kallt.",
      "Sälen äter fisk. Den kan dyka djupt.",
      "Ibland ligger sälen på en sten. Där vilar den i solen.",
    ],
    q: [
      ["Var bor sälen?", ["I havet", "I skogen", "I öknen", "På berget"], "fakta"],
      ["Vad håller sälen varm?", ["Fettet under huden", "Ett varmt bo", "Ett tjockt täcke", "Varmt vatten"], "fakta"],
      ["Vad äter sälen?", ["Fisk", "Gräs", "Bär", "Nötter"], "fakta"],
      ["Var vilar sälen ibland?", ["På en sten", "I ett träd", "I en båt", "Under isen"], "fakta"],
    ],
  },
  {
    id: "lr-g1-humlan", title: "Humlan", textType: "fact", topic: "djur",
    body: [
      "Humlan är en insekt. Den är rund och har mjukt hår. Den har ofta gula och svarta ränder.",
      "Humlan flyger från blomma till blomma. Den suger nektar. Nektar är en söt saft i blomman.",
      "Humlan surrar när den flyger. Den stickas nästan aldrig.",
    ],
    q: [
      ["Vad är humlan?", ["En insekt", "En fågel", "En fisk", "En groda"], "fakta"],
      ["Vad är nektar?", ["En söt saft", "Ett sorts blad", "En liten frukt", "Ett sorts frö"], "ordforstaelse"],
      ["Vad gör humlan när den flyger?", ["Surrar", "Sjunger", "Visslar", "Piper"], "fakta"],
      ["Vad handlar texten mest om?", ["Hur humlan lever", "Hur man odlar blommor", "Hur bin gör honung", "Hur fåglar flyger"], "helhet_slutsats"],
    ],
  },
];
