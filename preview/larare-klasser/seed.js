// ============================================================================
// Sådd för preview-larare-klasser.html (#440): fyra klasser (5E, 4B, 4A och en
// tom 6C) med elever, två ämnen med områden, lite progress och läsnivåer, så
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
    so: [["vikingar", "Vikingatiden", "⚔️"], ["sverige", "Sveriges landskap", "🗺️"]],
    no: [["kroppen", "Människokroppen", "🫀"]],
  };
  satt("subjects/so", { name: "SO", icon: "🌍", order: 1 });
  satt("subjects/no", { name: "NO", icon: "🔬", order: 2 });
  for (const [subj, list] of Object.entries(omraden)) {
    list.forEach(([id, name, coverEmoji], i) =>
      satt(`subjects/${subj}/areas/${id}`, {
        name, coverEmoji, order: i + 1, exerciseTypes: ["quiz", "pairs"],
        quiz: [0, 1, 2, 3].map((n) => ({ q: `Fråga ${n + 1} om ${name}?`, options: ["A", "B", "C", "D"], answer: n })),
        pairs: [["ord", "förklaring"], ["sak", "beskrivning"], ["namn", "betydelse"]].map(([term, def]) => ({ term, def })),
      })
    );
  }
  let nr = 0;
  for (const [id, name, order, namn] of klasser) {
    const ids = namn.map((n) => {
      const sid = `stub-${n.toLowerCase()}`;
      const avatarId = AVATARER[nr++ % AVATARER.length];
      satt(`students/${sid}`, { namn: n, username: `${id}${String(nr).padStart(2, "0")}`, avatarId, classIds: [id] });
      satt(`studentData/${sid}`, {
        coins: 40 + nr * 7, xp: nr * 30, readingLevel: (nr % 3) + 1, avatarId,
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
