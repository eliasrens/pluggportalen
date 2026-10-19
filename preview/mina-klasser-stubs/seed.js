// ============================================================================
// Sådd för preview/preview-mina-klasser.html (#804) – ersätter
// preview/larare-klasser/seed.js via importmappen.
//   * 10 klasser → admin får sökbar rullgardin; årskurskontot (4A + 4B) knappar
//   * områden med långa namn (hela namnen ska synas i Vad eleverna ser)
//   * moduler: 4A har Ekvationsresan på och fokusläge; 4B har Bråkresan dold och
//     Schack på; övriga opt-in-moduler är av (nedtonade "· av" i Hur går det?)
// ============================================================================

const NAMN = [
  "Alva", "Bilal", "Cleo", "Dante", "Ebba", "Fadi", "Gry", "Hugo", "Ines", "Jonas",
  "Klara", "Liam", "Maja", "Nils", "Olivia", "Pelle", "Rut", "Sixten", "Tove", "Ville",
];
const AVATARER = ["fox", "cat", "panda", "frog", "rabbit", "owl", "bjorn"];

/** @param {(path:string, data:object) => void} satt */
export function seed(satt) {
  satt("teacherAccounts/stub-admin", { username: "qaadmin", displayName: "Elias", role: "admin", classIds: [], active: true });
  satt("teacherAccounts/stub-arskurs", { username: "qaarskurs4", displayName: "Årskurs 4", role: "arskurs", classIds: ["4a", "4b"], active: true });

  satt("subjects/so", { name: "SO", icon: "🌍", order: 1 });
  satt("subjects/sv", { name: "Svenska", icon: "✏️", order: 2 });
  satt("subjects/ma", { name: "Matematik", icon: "🔢", order: 3 });
  const omraden = {
    so: [["vikingar", "Vikingatiden", "⚔️"], ["svensk-historia", "Svensk historia under stormaktstiden", "🦕"],
      ["valet", "Valet och demokratin i Sverige", "🗳️"], ["vasatiden", "Vasatiden och reformationen", "📜"]],
    sv: [["skiljetecken", "Skiljetecken, vokaler och dubbelteckning", "✏️"], ["sambandsord", "Tidsord och sambandsord", "📝"]],
    ma: [["talsorter", "Talsorter och positionssystemet", "🔢"], ["overslag", "Överslagsräkning", "🧮"]],
  };
  for (const [subj, list] of Object.entries(omraden)) {
    list.forEach(([id, name, coverEmoji], i) => satt(`subjects/${subj}/areas/${id}`, {
      name, coverEmoji, order: i + 1, grade: "4", exerciseTypes: ["quiz", "pairs"], hiddenModes: [],
      quiz: [0, 1, 2, 3].map((n) => ({ id: `q${n + 1}`, question: `Fråga ${n + 1} om ${name}?`, options: ["Alfa", "Beta", "Gamma", "Delta"], answerIndex: n })),
      pairs: [["ord", "förklaring"], ["sak", "beskrivning"], ["namn", "betydelse"]].map(([term, definition], n) => ({ id: `p${n + 1}`, term, definition })),
    }));
  }

  const klasser = [
    ["4a", "4A", 1, NAMN.slice(0, 7)], ["4b", "4B", 2, NAMN.slice(7, 13)], ["4c", "4C", 3, []], ["4d", "4D", 4, []],
    ["5a", "5A", 5, NAMN.slice(13, 17)], ["5b", "5B", 6, []], ["5d", "5D", 7, []], ["5e", "5E", 8, NAMN.slice(17, 20)],
    ["studion", "Studion", 20, []], ["flex", "Flex", 21, []],
  ];
  let nr = 0;
  for (const [id, name, order, namn] of klasser) {
    const ids = namn.map((n) => {
      const sid = `stub-${n.toLowerCase()}`;
      const avatarId = AVATARER[nr++ % AVATARER.length];
      satt(`students/${sid}`, { namn: n, username: `${id}${String(nr).padStart(2, "0")}`, avatarId, classIds: [id] });
      satt(`studentCredentials/${sid}`, { username: `${id}${String(nr).padStart(2, "0")}`, password: "lilla123" });
      satt(`studentData/${sid}`, {
        coins: 40 + nr * 7, xp: nr * 30, avatarId,
        progress: nr % 4 === 0 ? {} : {
          vikingar: { quiz: { completed: true, stars: (nr % 3) + 1 }, pairs: { completed: true, stars: 2 } },
          "svensk-historia": { quiz: { completed: true, stars: nr % 3 } },
        },
      });
      return sid;
    });
    const doc = { name, order, studentIds: ids };
    if (id === "4a") {
      doc.enabledModules = ["ekvationsresan"];
      doc.lock = { mal: { typ: "omrade", id: "so/vikingar", namn: "Vikingatiden" }, till: Date.now() + 40 * 60000, doljOvrigt: false };
    }
    if (id === "4b") Object.assign(doc, { enabledModules: ["schack"], hiddenModules: ["brakresan"] });
    satt(`classes/${id}`, doc);
  }
}
