// Minnesdata för preview-plugga-703.html (#703, områdessidan). Bygger på
// sidomenyns stubbar (#701) + det pageElevOmrade läser: området, progress, klass.
// Område väljs i hashen (#/elev/omrade?subj=so&area=vikingatiden). URL-parametrar:
// ?dolt=quiz (klassen döljer quiz), ?tre=1 (senast spelade läget har 3 ★ →
// ingen "Fortsätt här"), ?ny=1 (inget spelat än).
export * from "../sidomeny-701/data.js";
import { S } from "../sidomeny-701/state.js";

const q = new URLSearchParams(location.search);
const quiz = (n) => Array.from({ length: n }, (_, i) => ({ question: `Fråga ${i + 1}?`, options: ["A", "B", "C", "D"], answerIndex: 0 }));
const pairs = (n) => Array.from({ length: n }, (_, i) => ({ term: `T${i}`, definition: `D${i}` }));
const amnes = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, title: `Text ${i + 1}`, level: 1 + (i % 3), body: "Text.", questions: [{ q: "?", options: ["a", "b"], answer: 0 }] }));
const H = 36e5;
const tid = (h) => ({ seconds: Math.floor((Date.now() - h * H) / 1000) });

const AREAS = {
  so: {
    vikingatiden: {
      id: "vikingatiden", name: "Vikingatiden 2.0", coverEmoji: "⚔️", quiz: quiz(10), pairs: pairs(8),
      description: "Lär dig hur människor levde på vikingatiden – på gården, på vikingatåg, som trälar och kring elden med sagor.",
    },
    // Bara par → inga äventyr som kräver quiz; para-äventyr kan finnas.
    lasfokus: {
      id: "lasfokus", name: "Medeltiden", coverEmoji: "🏰", quiz: quiz(10), pairs: pairs(6), readingPrereq: true,
      description: "Läs först – sen låses resten upp.",
    },
    amnes: { id: "amnes", name: "Rymden", coverEmoji: "🚀", readingTexts: amnes(6), description: "Läs om planeterna." },
    langt: {
      id: "langt", name: "Skiljetecken, vokaler och dubbelteckning i långa ord", coverEmoji: "✏️", quiz: quiz(10),
      description: "Ett område med ett riktigt långt namn för att se att rubriken bryts snyggt på alla skärmar.",
    },
  },
  matte: {
    brak: { id: "brak", name: "Bråk", coverEmoji: "🍕", generator: { topic: "subtraktion", variants: ["enkel"] } },
  },
};

const PROGRESS = q.get("ny") === "1" ? {} : {
  vikingatiden: {
    lasforstaelse: { stars: 3, lastPlayed: tid(48) },
    para: { stars: 2, lastPlayed: tid(30) },
    quiz: { stars: q.get("tre") === "1" ? 3 : 1, lastPlayed: tid(2) },
    kunskapsjakt: { stars: 1, lastPlayed: tid(20) },
    "aventyr:skattjakten": { stars: 2, lastPlayed: tid(10) },
  },
  // Senast spelat = ett låst läge → ingen markering.
  lasfokus: { quiz: { stars: 1, lastPlayed: tid(1) }, lasforstaelse: { stars: 0, lastPlayed: tid(5) } },
  brak: { rakna: { stars: 1, lastPlayed: tid(3) } },
  langt: { "aventyr:skattjakten": { stars: 1, lastPlayed: tid(1) } },
};

const klass = {
  id: "4a", name: "4A", studentIds: ["alva"], hiddenModules: S.dolda, enabledModules: S.enabled,
  assignedAreas: [], hiddenModes: q.get("dolt") ? [q.get("dolt")] : [],
};

export const isLoggedIn = () => true;
export async function getStudentData() { return { coins: S.coins, avatarItems: [], progress: PROGRESS }; }
export async function getProgress() { return PROGRESS; }
export async function getArea(subj, area) { return AREAS[subj]?.[area] || null; }
export async function getClassForStudent() { return klass; }
export async function getClasses() { return [klass]; }
// "← Plugga" går till startsidan – samma områden där.
export async function getSubjects() { return [{ id: "so", name: "SO" }, { id: "matte", name: "Matematik" }]; }
export async function getAreas(id) { return Object.values(AREAS[id] || {}); }
