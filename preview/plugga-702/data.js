// Minnesdata för preview-plugga-702.html (#702). Bygger på sidomenyns stubbar
// (#701) + det Plugga-startsidan läser: ämnen, områden, klass och progress.
// URL-parametrar: ?tilldelat=1 (klassen har tilldelning), ?tom=1 (inga områden),
// ?lock=omrade (fokusläge på Bråk), ?dolt=quiz (läraren döljer quiz för klassen).
export * from "../sidomeny-701/data.js";
import { S } from "../sidomeny-701/state.js";

const q = new URLSearchParams(location.search);
const quiz = (n) => Array.from({ length: n }, (_, i) => ({ question: `Fråga ${i + 1}?`, options: ["A", "B", "C", "D"], answerIndex: 0 }));
const pairs = (n) => Array.from({ length: n }, (_, i) => ({ term: `T${i}`, definition: `D${i}` }));
const texts = [{ title: "Text", body: "Lite text att läsa." }];
const DAG = 864e5;

const SUBJECTS = [
  { id: "so", name: "SO" },
  { id: "matte", name: "Matematik" },
  { id: "no", name: "NO" },
  { id: "sv", name: "Svenska" },
  { id: "musik", name: "Musik" }, // okänt ämne → färg efter plats i listan
];
const AREAS = {
  so: [
    { id: "vikingatiden", name: "Vikingatiden 2.0", coverEmoji: "⚔️", texts, quiz: quiz(10), pairs: pairs(8) },
  ],
  matte: [
    { id: "brak", name: "Bråk", coverEmoji: "🍕", generator: { topic: "subtraktion", variants: ["enkel"] }, createdAt: Date.now() - 2 * DAG },
    { id: "addition", name: "Träna på addition", coverEmoji: "➕", generator: { topic: "addition", variants: ["enkel"] } },
  ],
  no: [{ id: "skogen", name: "Skogen", coverEmoji: "🌲", texts, quiz: quiz(10), pairs: pairs(6) }],
  sv: [
    { id: "skiljetecken", name: "Skiljetecken, vokaler och dubbelteckning", coverEmoji: "✏️", texts, quiz: quiz(10), createdAt: Date.now() - DAG },
  ],
  musik: [{ id: "noter", name: "Noter", coverEmoji: "🎵", quiz: quiz(10) }],
};

const PROGRESS = {
  vikingatiden: { quiz: { stars: 3 }, para: { stars: 2 }, lasforstaelse: { stars: 2 } },
  addition: { rakna: { stars: 2 } },
  skogen: { quiz: { stars: 1 } },
  skiljetecken: { quiz: { stars: 5 } }, // >3 kapas till 3 – och området är "spelat" → inget Ny!
};

const klass = {
  id: "4a", name: "4A", studentIds: ["alva"], hiddenModules: S.dolda, enabledModules: S.enabled,
  assignedAreas: q.get("tilldelat") === "1"
    ? [{ subjectId: "so", areaId: "vikingatiden" }, { subjectId: "matte", areaId: "brak" }, { subjectId: "sv", areaId: "skiljetecken" }]
    : [],
  hiddenModes: q.get("dolt") ? [q.get("dolt")] : [],
};

export const isLoggedIn = () => true;
export async function getStudentData() { return { coins: S.coins, avatarItems: [], progress: PROGRESS }; }
export async function getProgress() { return PROGRESS; }
export async function getSubjects() { return q.get("tom") === "1" ? [] : SUBJECTS; }
export async function getAreas(id) { return AREAS[id] || []; }
export async function getClassForStudent() { return klass; }
export async function getClasses() { return [klass]; }
