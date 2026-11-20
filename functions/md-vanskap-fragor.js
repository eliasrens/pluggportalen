// ============================================================================
// Matchdagen på SERVERN – frågorna i en vänskapsmatch (functions/md-vanskap-fragor.js, #874)
// ----------------------------------------------------------------------------
// Spec §11.3: varje elev får frågor ur SINA EGNA frågekällor (matchdagenInst/{uid}; saknas de:
// klassens, annars tabellerna 0–10 – #876 effektivInst), och
// servern rättar med samma rättning som Live. När matchen startar (mdSvara ja) byggs en
// BANK per elev – lika många frågor som en match kan ha lägen – som ligger i det lärar-
// skyddade facit-dokumentet (mdVanskap/{id}/facit/{uid}). mdFraga skriver läge n:s fråga
// (bank[n − 1], utan facit) till elevens privata dokument; mdSvar rättar mot banken.
//
// Källorna är solospelets (src/matchdagen/md-kallor.js), med samma urval och ordning:
//   Plugga-område  quiz utan passage + par ("Vad betyder X?" med tre andra förklaringar som fel-
//                  alternativ). omradePool är omradeKalla:s urval utan sidans moduler (game-shared.js
//                  och prov-fran-omrade.js kan inte följa med till servern) – test/matchdagen-vanskap-
//                  server.test.js jämför de två på samma områden. Rättas med gradeQuiz (kistspel-rattning.js).
//   Multiplikation makeQuestion + multChoices (mult/generator.js, Live-läget multiplication_0_10),
//                  flerval eller skriv själv efter svarssatt. Rättas med gradeMult (kistspel-rattning.js).
//   Räkna          rakna-core.js createProblemSource; rättas med Räknas checkAnswer. Bara skriv själv.
//                  Ett visuellt räknesätt (klocka, statistik …) skickar uppgiften (problem, utan facit)
//                  som JSON i `bild` – klienten ritar den med matte-visuals.js som i solospelet.
// Källorna turas om med createTopicBag; en ändlig källa upprepar inget förrän den är slut.
//
//   normInst(raw) · effektivInst(egen, klass) · harKallor(inst) · omradePool(area) · omradesNycklar(inst)
//   byggKallor(inst, omraden) → källor          omraden: { "ämne/område": area | null }
//   byggBank(kallor, { antal, rng, fro, svarssatt }) → [post]   post = { pub, kalla, r }
//   ratta(post, svar) → { giltig, ratt, facit }   svar: index (flerval) eller text (skriv själv)
// ============================================================================

import { checkAnswer as raknaRatta, createProblemSource, createTopicBag, expectedAnswerText, hashSeed, problemDisplay } from "./matchdagen/kallor/rakna-core.js";
import { normalizeGenerator } from "./matchdagen/kallor/exercise-types.js";
import { makeQuestion, multChoices } from "./matchdagen/kallor/mult/generator.js";
import { gradeMult, gradeQuiz, KsError } from "./kistspel-rattning.js";

/** Samma gränser som provets "Hämta från område" (src/prov/typer/delat.js GRANS) – testat. */
export const GRANS = { fragetext: 1000, alternativ: 300 };
export const MAX_OMRADEN = 60;
const PAR_ALTERNATIV = 4;
const FAKTORER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Samma hjälptexter som solospelet (md-kallor.js TIPS). */
const TIPS = {
  rest: "Svara med kvot och rest, t.ex. 3 rest 1.",
  fraction: "Svara i bråkform, t.ex. 1/2.",
  coord: "Svara med koordinater, t.ex. (3, 4).",
  time: "Svara med klockslag, t.ex. 07:30.",
  text: "Skriv ditt svar – ett ord eller en siffra.",
  numeric: "Använd komma för decimaler, t.ex. 3,5.",
};

const str = (v) => (typeof v === "string" ? v.trim() : "");
const lista = (v) => (Array.isArray(v) ? v : []);
const tecken = (s) => Array.from(String(s ?? "")).length;

function nycklar(v) {
  const ut = [];
  for (const x of lista(v)) {
    const s = typeof x === "string" ? x.trim() : "";
    if (/^[^/\s]+\/[^/\s]+$/.test(s) && s.length <= 200 && !ut.includes(s)) ut.push(s);
    if (ut.length >= MAX_OMRADEN) break;
  }
  return ut;
}

/** matchdagenInst som i md-inst.js normalizeInst (bara det servern behöver). */
export function normInst(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    omraden: nycklar(r.omraden),
    tabeller: FAKTORER.filter((t) => lista(r.tabeller).includes(t)),
    rakna: nycklar(r.rakna),
    svarssatt: r.svarssatt === "skriv" ? "skriv" : "flerval",
    klocka: [30, 60].includes(r.klocka) ? r.klocka : 0,
  };
}
export const harKallor = (i) => i.omraden.length + i.tabeller.length + i.rakna.length > 0;
/**
 * Inställningarna eleven spelar med (#876, som md-inst.js effektivInst): egna, annars klassens
 * (classes/{id}.matchdagenInst), annars multiplikationstabellerna 0–10.
 * @param {object|null} egen  matchdagenInst/{uid} (null = saknas)
 * @param {object|null} k     klassdokumentet
 */
export function effektivInst(egen, k) {
  if (egen) return normInst(egen);
  const ki = k?.matchdagenInst;
  if (ki && typeof ki === "object" && !Array.isArray(ki)) return normInst(ki);
  return normInst({ tabeller: FAKTORER });
}
/** Områdena som ska läsas (subjects/{s}/areas/{a}) – Plugga och Räkna. */
export const omradesNycklar = (i) => [...new Set([...i.omraden, ...i.rakna])];

function flervalOk(q) {
  const alt = lista(q?.options).map((o) => (o == null ? "" : String(o).trim()));
  const ai = q?.answerIndex;
  return !!str(q?.question) && tecken(str(q.question)) <= GRANS.fragetext && alt.length >= 2 && alt.length <= 6 &&
    alt.every((a) => a && tecken(a) <= GRANS.alternativ) && new Set(alt.map((a) => a.toLowerCase())).size === alt.length &&
    Number.isInteger(ai) && ai >= 0 && ai < alt.length;
}
const parOk = (p) => !!str(p?.term) && !!str(p?.definition) && tecken(str(p.term)) <= GRANS.alternativ && tecken(str(p.definition)) <= GRANS.alternativ;
const harPassage = (q) => !!str(q?.passage);

/** Områdets frågor som solospelets omradeKalla: { quiz: [index], par: [index] } (par bara om minst två). */
export function omradePool(area) {
  const quiz = lista(area?.quiz);
  const plain = quiz.filter((q) => !harPassage(q));
  const pool = plain.length ? plain : quiz; // plainQuizPool – men frågor med passage tas aldrig med
  const q = pool.map((x) => quiz.indexOf(x)).filter((i) => !harPassage(quiz[i]) && flervalOk(quiz[i]));
  const sett = new Set();
  const par = [];
  lista(area?.pairs).forEach((p, i) => {
    if (!parOk(p)) return;
    const t = `t:${str(p.term).toLowerCase()}`;
    const d = `d:${str(p.definition).toLowerCase()}`;
    if (sett.has(t) || sett.has(d)) return;
    sett.add(t);
    sett.add(d);
    par.push(i);
  });
  return { quiz: q, par: par.length >= 2 ? par : [] };
}

function blanda(a0, rng) {
  const a = a0.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** En flervalsfråga i bankens form – rättas med gradeQuiz mot r.ai. */
function quizPost(text, ratt, fel, rng, kalla) {
  const alternativ = blanda([ratt, ...fel], rng);
  return { pub: { text, typ: "flerval", alternativ, inputMode: "text" }, kalla, r: { s: "quiz", ai: alternativ.indexOf(ratt), facit: ratt } };
}

function omradeKalla(nyckel, area) {
  const { quiz, par } = omradePool(area);
  const pairs = lista(area?.pairs);
  const forklaringar = par.map((i) => str(pairs[i].definition));
  const kalla = `omrade:${nyckel}`;
  return {
    id: kalla,
    nycklar: [...quiz.map((i) => `quiz:${i}`), ...par.map((i) => `par:${i}`)],
    fraga(k, rng) {
      const [sort, nr] = k.split(":");
      if (sort === "quiz") {
        const q = area.quiz[Number(nr)];
        const alt = q.options.map((o) => String(o).trim());
        return quizPost(str(q.question), alt[q.answerIndex], alt.filter((_, j) => j !== q.answerIndex), rng, kalla);
      }
      const p = pairs[Number(nr)];
      const ratt = str(p.definition);
      return quizPost(`Vad betyder ${str(p.term)}?`, ratt, blanda(forklaringar.filter((d) => d !== ratt), rng).slice(0, PAR_ALTERNATIV - 1), rng, kalla);
    },
  };
}

function tabellKalla(tabeller, svarssatt) {
  return {
    id: "multiplikation",
    nycklar: tabeller.flatMap((t) => FAKTORER.map((b) => `${t}x${b}`)),
    fraga(k, rng) {
      const [t, b] = k.split("x").map(Number);
      const q = rng() < 0.5 ? makeQuestion(t, b) : makeQuestion(b, t);
      const kalla = `tabell:${t}`;
      const r = { s: "mult", a: q.a, b: q.b, facit: String(q.answer) };
      const pub = { text: `${q.text} = ?`, inputMode: "numeric" };
      if (svarssatt === "skriv") return { pub: { ...pub, typ: "skriv" }, kalla, r };
      const { options } = multChoices(q, rng);
      return { pub: { ...pub, typ: "flerval", alternativ: options.map(String) }, kalla, r: { ...r, alternativ: options } };
    },
  };
}

function raknaKalla(nyckel, area, fro) {
  const gen = normalizeGenerator(area?.generator);
  const strom = gen ? createProblemSource(gen, hashSeed(`vanskap|${nyckel}|${fro}`)) : null;
  return {
    id: `rakna:${nyckel}`,
    nycklar: gen ? null : [],
    fraga() {
      const { problem, answer } = strom.next();
      const typ = problem?.answerType || "numeric";
      return {
        pub: {
          text: problemDisplay(problem), typ: "skriv", inputMode: typ === "numeric" ? "decimal" : "text",
          tips: problem?.hasRemainder ? TIPS.rest : TIPS[typ] || "",
          ...(typ !== "numeric" ? { bild: JSON.stringify(problem) } : {}),
        },
        kalla: `rakna:${nyckel}`,
        r: { s: "rakna", problem: JSON.stringify(problem), answer: JSON.stringify(answer), facit: expectedAnswerText(problem, answer) },
      };
    },
  };
}

/** Elevens källor i solospelets ordning (Plugga, tabellerna, Räkna); tomma tas bort. */
export function byggKallor(inst, omraden, fro = 0) {
  const alla = [
    ...inst.omraden.map((k) => omradeKalla(k, omraden[k] || null)),
    ...(inst.tabeller.length ? [tabellKalla(inst.tabeller, inst.svarssatt)] : []),
    ...inst.rakna.map((k) => raknaKalla(k, omraden[k] || null, fro)),
  ];
  return alla.filter((k) => k.nycklar === null || k.nycklar.length > 0);
}

/** antal frågor: källorna turas om (createTopicBag), varje ändlig källa ur en blandad påse. */
export function byggBank(kallor, { antal, rng, fro = 0 }) {
  if (!kallor.length) return [];
  const blandning = createTopicBag(kallor, fro >>> 0);
  const pasar = new Map();
  const bank = [];
  for (let n = 0; n < antal; n++) {
    const k = blandning.next();
    let nyckel = null;
    if (k.nycklar) {
      let pase = pasar.get(k.id);
      if (!pase?.length) pasar.set(k.id, (pase = blanda(k.nycklar, rng)));
      nyckel = pase.shift();
    }
    bank.push(k.fraga(nyckel, rng));
  }
  return bank;
}

/** Rätta ett svar mot bankens post. Ett ogiltigt svar (tomt, utanför alternativen) räknas inte. */
export function ratta(post, svar) {
  const r = post?.r || {};
  const facit = String(r.facit ?? "");
  const flerval = post?.pub?.typ === "flerval";
  try {
    if (r.s === "mult") {
      const raw = flerval
        ? { factorA: r.a, factorB: r.b, answer: lista(r.alternativ)[svar], choiceIndex: svar }
        : { factorA: r.a, factorB: r.b, answer: typeof svar === "string" ? svar : null };
      return { giltig: true, ratt: gradeMult({ answerKind: flerval ? "choice" : "free" }, raw).isCorrect, facit };
    }
    if (r.s === "quiz") {
      const g = gradeQuiz({ answerKind: "choice" }, { q: 0, choiceIndex: svar }, { nextQ: 0 },
        { questions: [{ id: "0", options: lista(post.pub.alternativ) }] }, { facit: [{ answerIndex: r.ai }] });
      return { giltig: true, ratt: g.isCorrect, facit };
    }
    if (r.s === "rakna") {
      if (typeof svar !== "string" || !svar.trim() || svar.length > 200) return { giltig: false, ratt: false, facit };
      return { giltig: true, ratt: raknaRatta(JSON.parse(r.problem), JSON.parse(r.answer), svar), facit };
    }
  } catch (err) {
    if (err instanceof KsError) return { giltig: false, ratt: false, facit };
    throw err;
  }
  return { giltig: false, ratt: false, facit };
}
