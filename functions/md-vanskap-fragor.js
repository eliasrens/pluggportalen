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
//   Plugga-område  quiz + par ("Vad betyder X?" med tre andra förklaringar som fel-
//                  alternativ). omradePool är omradeKalla:s urval utan sidans moduler (prov-fran-omrade.js
//                  kan inte följa med till servern) – test/matchdagen-vanskap-server.test.js jämför de två
//                  på samma områden. Vilka quizfrågor och lästexter (#905): quizUrval (matchdagen/md-lastext.js,
//                  samma rena kod som klienten) – lastext av = bara frågor utan lästext, på = alla med
//                  lästexten i pub.kontext, men högst VANSKAP_LASTEXT_MAX (300, Live) tecken: tiden är synkad
//                  mellan eleverna. Förklaringen (explanation) ligger i r och kommer med mdSvar:s svar.
//                  Rättas med gradeQuiz (kistspel-rattning.js).
//   Multiplikation makeQuestion + multChoices (mult/generator.js, Live-läget multiplication_0_10),
//                  flerval eller skriv själv efter svarssatt. Rättas med gradeMult (kistspel-rattning.js).
//   Räkna          rakna-core.js createProblemSource; rättas med Räknas checkAnswer. Bara skriv själv.
//                  Ett visuellt räknesätt (klocka, statistik …) skickar uppgiften (problem, utan facit)
//                  som JSON i `bild` – klienten ritar den med matte-visuals.js som i solospelet.
// Källorna turas om med createTopicBag; en ändlig källa upprepar inget förrän den är slut.
// #899: källorna = de valda ∩ elevens synliga områden, och "Samma som Plugga" (foljPlugga) räknas
// fram ur synligheten – med SAMMA rena kod som klienten (matchdagen/md-synlighet.js, en kopia av
// src/matchdagen/delat/). Utan några inställningar alls: "Samma som Plugga", annars tabellerna 0–10.
//
//   normInst(raw) · effektivInst(egen, klass) · arStandard(egen, klass) · harKallor(inst) · omradePool(area, lastext)
//   omradesNycklar(inst) · flaggor(area) (= gamemode-visibility.js areaContentFlags för källorna)
//   byggKallor(inst, omraden) → källor          omraden: { "ämne/område": area | null }
//   byggBank(kallor, { antal, rng, fro, svarssatt }) → [post]   post = { pub, kalla, r }
//   ratta(post, svar) → { giltig, ratt, facit, forklaring? }   svar: index (flerval) eller text (skriv själv)
// ============================================================================

import { checkAnswer as raknaRatta, createProblemSource, createTopicBag, expectedAnswerText, hashSeed, problemDisplay } from "./matchdagen/kallor/rakna-core.js";
import { hasGeneratorContent, normalizeGenerator } from "./matchdagen/kallor/exercise-types.js";
import { MAX_OMRADEN } from "./matchdagen/md-synlighet.js";
import { makeQuestion, multChoices } from "./matchdagen/kallor/mult/generator.js";
import { VANSKAP_LASTEXT_MAX, quizUrval } from "./matchdagen/kallor/matchdagen/md-lastext.js";
import { gradeMult, gradeQuiz, KsError } from "./kistspel-rattning.js";

/** Samma gränser som provets "Hämta från område" (src/prov/typer/delat.js GRANS) – testat. */
export const GRANS = { fragetext: 1000, alternativ: 300 };
export { MAX_OMRADEN };
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
    foljPlugga: r.foljPlugga === true,
    lastext: r.lastext !== false, // #905: saknas = på
  };
}
/** Konkreta källor (efter effektivaKallor) – "Samma som Plugga" räknas inte förrän den är uträknad. */
export const harKallor = (i) => i.omraden.length + i.tabeller.length + i.rakna.length > 0;
const klassensInst = (k) => {
  const ki = k?.matchdagenInst;
  return ki && typeof ki === "object" && !Array.isArray(ki) ? ki : null;
};
/**
 * Inställningarna eleven spelar med (#876, som md-inst.js effektivInst): egna, annars klassens
 * (classes/{id}.matchdagenInst), annars standard = "Samma som Plugga" (#899).
 * @param {object|null} egen  matchdagenInst/{uid} (null = saknas)
 * @param {object|null} k     klassdokumentet
 */
export function effektivInst(egen, k) {
  if (egen) return normInst(egen);
  return normInst(klassensInst(k) || { foljPlugga: true });
}
/** Inga inställningar alls – då blir det tabellerna 0–10 om eleven inte ser något med underlag. */
export const arStandard = (egen, k) => !egen && !klassensInst(k);
/** Källornas underlag (gamemode-visibility.js areaContentFlags: quiz, pairs, generator). */
export const flaggor = (area) => ({
  quiz: lista(area?.quiz).length > 0, pairs: lista(area?.pairs).length > 0, generator: hasGeneratorContent(area),
});
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
/**
 * Områdets frågor som solospelets omradeKalla: { quiz: [index], par: [index], kontext: { index: lästext } }
 * (par bara om minst två). lastext = lärarens "Visa lästext till frågorna" (#905), lästexten högst 300 tecken.
 */
export function omradePool(area, lastext = false) {
  const quiz = lista(area?.quiz);
  const urval = quizUrval(quiz, { lastext, maxPassage: VANSKAP_LASTEXT_MAX, giltig: (i) => flervalOk(quiz[i]) });
  const q = urval.map((x) => x.i);
  const kontext = Object.fromEntries(urval.filter((x) => x.kontext).map((x) => [x.i, x.kontext]));
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
  return { quiz: q, par: par.length >= 2 ? par : [], kontext };
}

function blanda(a0, rng) {
  const a = a0.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** En flervalsfråga i bankens form – rättas med gradeQuiz mot r.ai. extra: { kontext?, forklaring? } (#905). */
function quizPost(text, ratt, fel, rng, kalla, { kontext = "", forklaring = "" } = {}) {
  const alternativ = blanda([ratt, ...fel], rng);
  return {
    pub: { text, typ: "flerval", alternativ, inputMode: "text", ...(kontext ? { kontext } : {}) },
    kalla,
    r: { s: "quiz", ai: alternativ.indexOf(ratt), facit: ratt, ...(forklaring ? { forklaring } : {}) },
  };
}

function omradeKalla(nyckel, area, lastext) {
  const { quiz, par, kontext } = omradePool(area, lastext);
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
        return quizPost(str(q.question), alt[q.answerIndex], alt.filter((_, j) => j !== q.answerIndex), rng, kalla,
          { kontext: kontext[nr], forklaring: str(q.explanation) });
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
    ...inst.omraden.map((k) => omradeKalla(k, omraden[k] || null, inst.lastext)),
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
      return { giltig: true, ratt: g.isCorrect, facit, ...(r.forklaring ? { forklaring: String(r.forklaring) } : {}) };
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
