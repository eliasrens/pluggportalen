// ============================================================================
// Sådd för preview/preview-larare-klasser.html (#440): fyra klasser (5E, 4B, 4A och en
// tom 6C) med elever, två ämnen med områden, lite progress, så
// alla sektioner i klassdetaljen har något att visa. 4A har ett aktivt fokusläge
// (🔒 i master-listan).
// ============================================================================

const NAMN = [
  "Alva", "Bo", "Cleo", "Dino", "Ella", "Filip", "Greta", "Hugo", "Ines", "Jonas",
  "Klara", "Liam", "Maja", "Nils", "Olivia", "Pelle", "Quinn", "Rut", "Sixten", "Tove",
];
const AVATARER = ["fox", "cat", "panda", "frog", "rabbit", "owl", "bjorn"];

/** @param {(path:string, data:object) => void} satt */
export function seed(satt) {
  const klasser = [
    ["5e", "5E", 1, NAMN.slice(0, 9)],
    ["4b", "4B", 2, NAMN.slice(9, 15)],
    ["4a", "4A", 3, NAMN.slice(15, 20)],
    ["6c", "6C", 4, []],
  ];
  const omraden = {
    so: [["vikingar", "Vikingatiden", "⚔️"], ["sverige", "Sveriges landskap", "🗺️"], ["riksdagen", "Riksdagen & partierna", "🏛️"]],
    no: [["kroppen", "Människokroppen", "🫀"]],
  };
  satt("subjects/so", { name: "SO", icon: "🌍", order: 1 });
  satt("subjects/no", { name: "NO", icon: "🔬", order: 2 });
  satt("subjects/ma", { name: "Matematik", icon: "🔢", order: 3 });
  // #454: giltiga områden (validateArea går igenom) så underraderna kan sparas
  // i previewn – vanliga frågor, läsförståelse (passage), bildpar, lästexter,
  // grupp, plus ett räknegenerator-område.
  for (const [subj, list] of Object.entries(omraden)) {
    list.forEach(([id, name, coverEmoji], i) => {
      const doc = {
        name, coverEmoji, order: i + 1, grade: "4", exerciseTypes: ["quiz", "pairs"], hiddenModes: [],
        quiz: [0, 1, 2, 3].map((n) => ({
          id: `q${n + 1}`, question: `Fråga ${n + 1} om ${name}?`, options: ["Alfa", "Beta", "Gamma", "Delta"],
          answerIndex: n, explanation: n === 0 ? "För att det står i boken." : "",
        })),
        pairs: [["ord", "förklaring"], ["sak", "beskrivning"], ["namn", "betydelse"]].map(([term, definition], n) =>
          ({ id: `p${n + 1}`, term, definition })),
      };
      if (id === "vikingar") {
        doc.quiz[1].passage = "Vikingarna seglade i långskepp över haven och handlade med andra länder.";
        doc.quiz[3].passage = "Birka var en viktig handelsstad i Mälaren under vikingatiden.";
        doc.texts = [{ id: "t1", title: "Vikingarnas resor", body: "Vikingarna reste långt – till Island, Grönland och ända till Konstantinopel." }];
        doc.pairs[2].group = "namn";
      }
      if (id === "riksdagen") {
        doc.exerciseTypes = ["quiz", "pairs", "bildpar"];
        doc.pairs.push({ id: "p4", term: "", termImage: "partier/s", definition: "Socialdemokraterna" },
          { id: "p5", term: "Moderaterna", definition: "", defImage: "partier/m" });
      }
      satt(`subjects/${subj}/areas/${id}`, doc);
    });
  }
  satt("subjects/ma/areas/addition", {
    name: "Addition", coverEmoji: "➕", order: 1, grade: "4", exerciseTypes: ["generator"], hiddenModes: [],
    generator: { topic: "addition", variants: ["enkel", "uppstallning"] },
  });
  let nr = 0;
  for (const [id, name, order, namn] of klasser) {
    const ids = namn.map((n) => {
      const sid = `stub-${n.toLowerCase()}`;
      const avatarId = AVATARER[nr++ % AVATARER.length];
      satt(`students/${sid}`, { namn: n, username: `${id}${String(nr).padStart(2, "0")}`, avatarId, classIds: [id] });
      satt(`studentData/${sid}`, {
        coins: 40 + nr * 7, xp: nr * 30, avatarId,
        progress: nr % 4 === 0 ? {} : { vikingar: { quiz: { completed: true, stars: (nr % 3) + 1 }, pairs: { completed: true, stars: 2 } } },
      });
      return sid;
    });
    const doc = { name, order, studentIds: ids };
    if (id === "4a") {
      doc.lock = { mal: { typ: "omrade", id: "so/vikingar", namn: "Vikingatiden" }, till: Date.now() + 40 * 60000, doljOvrigt: false };
    }
    satt(`classes/${id}`, doc);
  }
}
