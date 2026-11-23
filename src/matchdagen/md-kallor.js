// ============================================================================
// Matchdagen (#868, Etapp 1b): frågekällorna (spec §2) – hur ett Plugga-område,
// multiplikationstabellerna och ett Räkna-område blir frågor. Återanvänder,
// kopierar inte:
//   Plugga-område  quizUrval (md-lastext.js, #905: lärarens "Visa lästext till
//                  frågorna" – av = bara frågor utan lästext, på = alla, med
//                  lästexten i Fraga.kontext; samma regel som Live) + omradetsSaker
//                  (prov/prov-fran-omrade.js: samma giltighetskontroll som
//                  "Hämta från område"). Par → "Vad betyder X?" med de andra
//                  parens förklaringar som felalternativ. Bara flerval.
//   Multiplikation Live-läget multiplication_0_10 (rättning och flervals-
//                  alternativ), frågan ur samma motor (mult/generator.js
//                  makeQuestion), begränsat till de valda tabellerna. Flerval
//                  eller skriv själv.
//   Räkna          rakna-core.js: createProblemSource (generatorn, där
//                  createTopicBag blandar räknesätten jämnt), checkAnswer,
//                  problemDisplay och expectedAnswerText. Bara skriv själv.
//                  De visuella räknesätten (klocka, statistik, sannolikhet,
//                  koordinatsystem) får sin bild ur matte-visuals.js, som i Räkna.
//
// En källa = { id, kalla(nyckel) → perKalla-nyckel, nycklar: [...] | null (oändlig),
//   fraga(nyckel, rng, svarssatt) → Fraga, nasta?(rng) → nyckel (oändliga) }.
// En Fraga = { id, kalla, text, typ: "flerval"|"skriv", alternativ?, facit,
//   inputMode, bild?, tips?, kontext?, forklaring?, data } – data är källans egen
//   (rättningen, aldrig visad); bild = SVG-markup ur vår egen ritare, tips = hur
//   svaret skrivs, kontext = lästexten ovanför frågan (#905), forklaring = quiz-
//   frågans explanation (visas efter fel svar, #905).
// Laddas bara med import() (md-fragor.js) – aldrig i bootgrafen (#271).
// ============================================================================

import { quizUrval } from "./md-lastext.js";
import { omradetsSaker } from "../prov/prov-fran-omrade.js";
import MULTIPLICATION_0_10 from "../live/modes/multiplication-0-10.js";
import { makeQuestion } from "../mult/generator.js";
import { checkAnswer as raknaRatta, createProblemSource, expectedAnswerText, hashSeed, problemDisplay } from "../rakna-core.js";
import { normalizeGenerator } from "../exercise-types.js";
import { renderTopicVisual } from "../matte-visuals.js";

export const VAD_BETYDER = (term) => `Vad betyder ${term}?`;
/** "Vad betyder X?" har högst så här många alternativ (rätt + tre andra förklaringar). */
const PAR_ALTERNATIV = 4;
const TABELL_FAKTORER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Hur svaret skrivs, per svarstyp – samma hjälptexter som Räkna (games-rakna.js). */
const TIPS = {
  rest: "Svara med kvot och rest, t.ex. 3 rest 1.",
  fraction: "Svara i bråkform, t.ex. 1/2.",
  coord: "Svara med koordinater, t.ex. (3, 4).",
  time: "Svara med klockslag, t.ex. 07:30.",
  text: "Skriv ditt svar – ett ord eller en siffra.",
  numeric: "Använd komma för decimaler, t.ex. 3,5.",
};

const str = (v) => (typeof v === "string" ? v.trim() : "");

function blanda(lista, rng) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ett flervalsalternativ-paket med rätt svar på slumpad plats. */
function flerval(rattText, fel, rng) {
  const alternativ = blanda([rattText, ...fel], rng);
  return { alternativ, ratt: alternativ.indexOf(rattText) };
}

// ---- Plugga-område -------------------------------------------------------------

/**
 * Plugga-området som källa: quizfrågorna (quizUrval – med lästexterna om lastext) och par.
 * Saker som inte går att visa (omradetsSaker säger problem) tas inte med.
 * @param {string} nyckel "ämne/område"
 * @param {object|null} area
 * @param {{ lastext?: boolean, maxPassage?: number }} [o]  lastext = lärarens "Visa lästext till
 *   frågorna"; maxPassage = längsta lästext (elevens egna matcher: ingen gräns)
 */
export function omradeKalla(nyckel, area, { lastext = false, maxPassage = Infinity } = {}) {
  const quiz = Array.isArray(area?.quiz) ? area.quiz : [];
  const grupper = omradetsSaker(area || {});
  const giltiga = new Set(grupper.filter((g) => g.sort === "quiz" || g.sort === "lasning" || g.sort === "par")
    .flatMap((g) => g.saker).filter((s) => !s.problem).map((s) => s.nyckel));

  const kontext = new Map();
  for (const { i, kontext: k } of quizUrval(quiz, { lastext, maxPassage, giltig: (i) => giltiga.has(`quiz:${i}`) })) kontext.set(i, k);
  const nycklar = [...kontext.keys()].map((i) => `quiz:${i}`);
  // Par: samma term eller förklaring två gånger blir inte entydigt (som i provet).
  const pairs = Array.isArray(area?.pairs) ? area.pairs : [];
  const sett = new Set();
  const par = [];
  pairs.forEach((p, i) => {
    if (!giltiga.has(`par:${i}`)) return;
    const t = str(p.term).toLowerCase();
    const d = str(p.definition).toLowerCase();
    if (sett.has(`t:${t}`) || sett.has(`d:${d}`)) return;
    sett.add(`t:${t}`);
    sett.add(`d:${d}`);
    par.push(i);
  });
  if (par.length >= 2) nycklar.push(...par.map((i) => `par:${i}`));
  const forklaringar = par.map((i) => str(pairs[i].definition));

  return {
    id: `omrade:${nyckel}`,
    kalla: () => `omrade:${nyckel}`,
    nycklar,
    fraga(k, rng) {
      const [sort, nr] = k.split(":");
      const i = Number(nr);
      if (sort === "quiz") {
        const q = quiz[i];
        const alt = q.options.map((o) => String(o).trim());
        const f = flerval(alt[q.answerIndex], alt.filter((_, j) => j !== q.answerIndex), rng);
        const forklaring = str(q.explanation);
        return {
          text: str(q.question), typ: "flerval", ...f, facit: alt[q.answerIndex], data: { ratt: f.ratt },
          ...(kontext.get(i) ? { kontext: kontext.get(i) } : {}), ...(forklaring ? { forklaring } : {}),
        };
      }
      const p = pairs[i];
      const ratt = str(p.definition);
      const fel = blanda(forklaringar.filter((d) => d !== ratt), rng).slice(0, PAR_ALTERNATIV - 1);
      const f = flerval(ratt, fel, rng);
      return { text: VAD_BETYDER(str(p.term)), typ: "flerval", ...f, facit: ratt, data: { ratt: f.ratt } };
    },
  };
}

// ---- Multiplikation ------------------------------------------------------------

/**
 * Multiplikationstabellerna som EN källa (Live-läget multiplication_0_10,
 * begränsat till tabellerna). Nyckeln "7x3" = tabell 7 gånger 3; texten visas i
 * slumpad ordning (7 × 3 eller 3 × 7). perKalla räknas per tabell (tabell:7).
 * @param {number[]} tabeller
 */
export function tabellKalla(tabeller) {
  const nycklar = [];
  for (const t of tabeller) for (const b of TABELL_FAKTORER) nycklar.push(`${t}x${b}`);
  return {
    id: "multiplikation",
    kalla: (k) => `tabell:${k.split("x")[0]}`,
    nycklar,
    fraga(k, rng, svarssatt) {
      const [t, b] = k.split("x").map(Number);
      const q = rng() < 0.5 ? makeQuestion(t, b) : makeQuestion(b, t);
      const ut = { text: `${q.text} = ?`, facit: String(q.answer), inputMode: "numeric", data: { q } };
      if (svarssatt === "skriv") return { ...ut, typ: "skriv" };
      const { options, answerIndex } = MULTIPLICATION_0_10.choices(q, rng);
      return { ...ut, typ: "flerval", alternativ: options.map(String), ratt: answerIndex, data: { q, options } };
    },
  };
}

// ---- Räkna ---------------------------------------------------------------------

/**
 * Ett Räkna-område som källa: generatorn är oändlig, så "påsen" är strömmens
 * position – en ny session fortsätter med ett frö ur hur många som dragits.
 * @param {string} nyckel "ämne/område"
 * @param {object|null} area
 */
export function raknaKalla(nyckel, area) {
  const gen = normalizeGenerator(area?.generator);
  let strom = null;
  return {
    id: `rakna:${nyckel}`,
    kalla: () => `rakna:${nyckel}`,
    nycklar: gen ? null : [],
    /**
     * Starta strömmen: n = antal dragna hittills (sparat), fro = sessionens slump –
     * så blir det nya uppgifter även när localStorage är blockerat.
     */
    starta(n, uid, fro) {
      if (gen) strom = createProblemSource(gen, hashSeed(`matchdagen|${uid}|${nyckel}|${n}|${fro}`));
    },
    fraga() {
      const item = strom.next();
      const typ = item.problem?.answerType || "numeric";
      let bild = null;
      if (typ !== "numeric") {
        try { bild = renderTopicVisual(item.problem); } catch { bild = null; }
      }
      return {
        text: problemDisplay(item.problem),
        typ: "skriv",
        facit: expectedAnswerText(item.problem, item.answer),
        inputMode: typ === "numeric" ? "decimal" : "text",
        tips: item.problem?.hasRemainder ? TIPS.rest : TIPS[typ],
        ...(bild ? { bild } : {}),
        data: { problem: item.problem, answer: item.answer },
      };
    },
  };
}

/**
 * Rätta ett svar: index (flerval) eller text (skriv själv).
 * @returns {{ giltig: boolean, ratt: boolean, facit: string }}
 */
export function rattaFraga(fraga, svar) {
  const facit = fraga.facit;
  if (fraga.typ === "flerval") {
    const i = Number(svar);
    if (!Number.isInteger(i) || i < 0 || i >= fraga.alternativ.length) return { giltig: false, ratt: false, facit };
    if (fraga.kallTyp === "tabell") {
      const r = MULTIPLICATION_0_10.checkAnswer(fraga.data.q, String(fraga.data.options[i]));
      return { giltig: true, ratt: r.correct, facit };
    }
    return { giltig: true, ratt: i === fraga.data.ratt, facit };
  }
  const raw = String(svar ?? "").trim();
  if (!raw) return { giltig: false, ratt: false, facit };
  if (fraga.kallTyp === "tabell") {
    const r = MULTIPLICATION_0_10.checkAnswer(fraga.data.q, raw);
    return { giltig: r.valid, ratt: r.correct, facit };
  }
  return { giltig: true, ratt: raknaRatta(fraga.data.problem, fraga.data.answer, raw), facit };
}
