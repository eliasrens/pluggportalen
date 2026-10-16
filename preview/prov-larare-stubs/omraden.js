// Preview-fixtur (#745): ämnen och Plugga-områden till "Hämta från område".
// Vikingatiden har allt (quiz, läsförståelse, par med ett bildpar, tidslinje,
// ämnestexter + en gammal nivåtext som inte ska synas); de andra visar ägare,
// "Mina områden" och ett område utan något att hämta.
const q = (question, options, answerIndex, passage) => ({ question, options, answerIndex, ...(passage ? { passage } : {}) });
const BIRKA = "Birka låg på ön Björkö i Mälaren. Hit kom köpmän från många länder för att byta pälsar, silver och pärlor. Staden övergavs omkring år 975.";

export const AMNEN = [
  { id: "so", name: "SO", icon: "🌍", order: 1 },
  { id: "ma", name: "Matematik", icon: "➗", order: 2 },
];

export const OMRADEN = {
  so: [
    {
      id: "vikingatiden", name: "Vikingatiden", coverEmoji: "⚔️", grade: "ak4", order: 1,
      createdBy: "anna", createdByName: "Årskurs 4 (Anna)",
      quiz: [
        q("Vad hette vikingarnas snabba skepp?", ["Långskepp", "Kogg", "Galär", "Ångbåt"], 0),
        q("Vilken gud styrde över åskan?", ["Tor", "Oden", "Freja", "Loke"], 0),
        q("Vad hade vikingarna på hjälmarna?", ["Horn", "Inga horn", "Fjädrar", "Vingar", "Spikar", "Ringar", "Blommor"], 1),
        q("Var låg Birka?", ["På Björkö", "På Gotland", "I Skåne"], 0, BIRKA),
        q("Vad bytte köpmännen?", ["Pälsar och silver", "Bilar", "Potatis"], 0, BIRKA),
        q("När övergavs staden?", ["Omkring 975", "Omkring 1500", "Omkring 1900"], 0, BIRKA),
      ],
      pairs: [
        { term: "Tor", definition: "Åskans gud" },
        { term: "Oden", definition: "Visdomens gud" },
        { term: "Freja", definition: "Kärlekens gudinna" },
        { term: "Loke", definition: "Lurendrejaren" },
        { term: "", termImage: "apple", definition: "Idun vaktar dem" },
      ],
      timeline: [
        { event: "Lindisfarne plundras", year: 793 },
        { event: "Birka grundas", year: 750 },
        { event: "Slaget vid Hastings", year: 1066 },
        { event: "Ansgar kommer till Birka", year: 829 },
        { event: "Leif Eriksson når Amerika", year: 1000 },
        { event: "Olof Skötkonung döps", year: 1008 },
      ],
      readingTexts: [
        { id: "gammal", title: "Gammal nivåtext", levels: { 1: { body: "x", questions: [] } } },
        {
          id: "runstenar", title: "Runstenar", level: 2, textType: "fact",
          body: "Runstenar restes ofta till minne av en död släkting. Texten ristades med runor och stenen målades i starka färger.",
          questions: [
            { id: "q1", question: "Varför restes runstenar?", options: ["Till minne av döda", "Som vägskyltar", "För att sälja", "Som gränser"], answerIndex: 0 },
            { id: "q2", question: "Hur såg stenarna ut från början?", options: ["Målade i starka färger", "Helt grå", "Täckta av guld", "Svarta"], answerIndex: 0 },
          ],
        },
      ],
    },
    {
      id: "medeltiden", name: "Medeltiden", coverEmoji: "🏰", grade: "ak5", order: 2,
      quiz: [q("Vad kallades en riddares häst?", ["Springare", "Ponny", "Åsna"], 0)],
      timeline: [{ event: "Digerdöden", year: 1350 }, { event: "Stockholm grundas", year: 1252 }],
    },
    {
      id: "stenaldern", name: "Stenåldern", coverEmoji: "🪨", grade: "ak4", order: 3,
      createdBy: "bo", createdByName: "Årskurs 5 (Bo)",
      pairs: [{ term: "Flinta", definition: "Sten till yxor" }, { term: "Hällristning", definition: "Bild i berget" }, { term: "Jägare", definition: "Levde av jakt" }],
    },
  ],
  ma: [
    { id: "brak", name: "Bråk", coverEmoji: "🍕", grade: "ak5", order: 1, createdBy: "anna", createdByName: "Årskurs 4 (Anna)", generator: { topics: [] } },
  ],
};
