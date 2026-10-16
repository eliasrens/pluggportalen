// ============================================================================
// Prov (#745, spec §10): "Hämta från område" – ett Plugga-områdes saker blir
// provfrågor. DOM-fri och testad (test/prov-fran-omrade.test.js).
//
//   omradetsSaker(area)              → grupperna med kryssrutor, per sort:
//                                       [{ sort, rubrik, saker: [{ nyckel, etikett, info?, del?, problem? }] }]
//   fragorFranOmrade(area, valda)    → { fragor, varningar } – valda = nycklarna
//
//   I området                    Blir i provet
//   Quizfråga                    flerval
//   Quizfråga med passage        ett text-block med texten (en gång) + flerval under
//   Par (pairs)                  en para-fråga med de valda paren (3–10; fler delas upp)
//   Tidslinje (timeline)         en ordna-fråga, händelserna sorterade efter år (3–10; fler delas upp)
//   Ämnesläsningstext            ett text-block + textens frågor som flerval
//
// Saker som inte kan bli en giltig provfråga (par med bara en bild, för många
// alternativ, för lång text …) har `problem` i listan och hoppas över med en
// varning. Frågorna som returneras har gått genom validateProv (id f1, f2 …;
// laggTillFragor i prov-redigera-ops.js byter id som krockar med provets).
// Ämnestexterna läses med readingTextsOf – gamla nivåtexter (#152) ligger
// under samma fältnamn men har inga egna frågor och tas aldrig med.
// ============================================================================

import { readingTextsOf } from "../amneslasning/content.js";
import { validateProv } from "./prov-validera.js";
import { GRANS, tecken } from "./typer/delat.js";

export const PAR_MIN = 3;
export const PAR_MAX = 10;
export const PARA_FRAGA = "Para ihop varje begrepp med rätt förklaring.";
export const ORDNA_FRAGA = "Sätt händelserna i rätt ordning.";

const str = (v) => (typeof v === "string" ? v.trim() : "");
const lista = (v) => (Array.isArray(v) ? v : []);
const nyckelDel = (n) => n.split(":");

/** Varför en flervalsfråga inte går att ta med (null = den går). */
function flervalProblem(fraga, options, answerIndex) {
  const alt = lista(options).map((o) => (o == null ? "" : String(o).trim()));
  if (!str(fraga)) return "frågetexten saknas";
  if (tecken(str(fraga)) > GRANS.fragetext) return `frågetexten är längre än ${GRANS.fragetext} tecken`;
  if (alt.length < 2 || alt.length > 6) return `har ${alt.length} alternativ – ett prov tar 2–6`;
  if (alt.some((a) => !a)) return "ett alternativ är tomt";
  if (alt.some((a) => tecken(a) > GRANS.alternativ)) return `ett alternativ är längre än ${GRANS.alternativ} tecken`;
  if (new Set(alt.map((a) => a.toLowerCase())).size !== alt.length) return "två alternativ är likadana";
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= alt.length) return "rätt svar saknas";
  return null;
}

const flerval = (fraga, options, answerIndex) => ({
  typ: "flerval",
  fraga: str(fraga),
  alternativ: options.map((o) => String(o).trim()),
  ratt: answerIndex,
  poang: 1,
});

function textProblem(brodtext) {
  if (!str(brodtext)) return "texten är tom";
  if (tecken(str(brodtext)) > GRANS.textblock) return `texten är längre än ${GRANS.textblock} tecken`;
  return null;
}

/** Ett par: vänster = term, höger = definition. Bara bild på en sida → kan inte tas med. */
function parProblem(p) {
  const term = str(p?.term);
  const def = str(p?.definition);
  if (!term || !def) return (p?.termImage || p?.defImage) ? "bara bild – ett prov visar text" : "en sida är tom";
  if (tecken(term) > GRANS.alternativ || tecken(def) > GRANS.alternativ) return `längre än ${GRANS.alternativ} tecken`;
  return null;
}

function handelseProblem(e) {
  if (!str(e?.event)) return "händelsen saknar namn";
  if (!Number.isInteger(e?.year)) return "årtalet saknas";
  if (tecken(str(e.event)) > GRANS.alternativ) return `längre än ${GRANS.alternativ} tecken`;
  return null;
}

const arsText = (y) => (y < 0 ? `${-y} f.Kr.` : String(y));
const kort = (s, n = 60) => {
  const t = str(s).replace(/\s+/g, " ");
  return tecken(t) > n ? `${Array.from(t).slice(0, n - 1).join("")}…` : t;
};

/** Quizfrågorna med passage, grupperade per text (samma text = samma grupp, i områdets ordning). */
function passageGrupper(quiz) {
  const grupper = new Map();
  quiz.forEach((q, i) => {
    const p = str(q?.passage);
    if (!p) return;
    if (!grupper.has(p)) grupper.set(p, { passage: p, nr: grupper.size + 1, index: [] });
    grupper.get(p).index.push(i);
  });
  return [...grupper.values()];
}

/**
 * Områdets saker som läraren kan kryssa i, grupperade per sort. Tomma sorter
 * tas inte med.
 * @param {object} area ett arbetsområde (subjects/{s}/areas/{a})
 */
export function omradetsSaker(area) {
  const quiz = lista(area?.quiz);
  const grupper = [];
  const lagg = (sort, rubrik, saker) => { if (saker.length) grupper.push({ sort, rubrik, saker }); };

  lagg("quiz", "Quizfrågor", quiz.flatMap((q, i) => (str(q?.passage) ? [] : [{
    nyckel: `quiz:${i}`,
    etikett: str(q?.question),
    problem: flervalProblem(q?.question, q?.options, q?.answerIndex),
  }])));

  lagg("lasning", "Läsförståelse (frågor till en text)", passageGrupper(quiz).flatMap((g) => {
    const tp = textProblem(g.passage);
    return g.index.map((i) => ({
      nyckel: `quiz:${i}`,
      etikett: str(quiz[i].question),
      del: `Text ${g.nr}: ${kort(g.passage)}`,
      problem: tp || flervalProblem(quiz[i].question, quiz[i].options, quiz[i].answerIndex),
    }));
  }));

  lagg("par", "Par", lista(area?.pairs).map((p, i) => ({
    nyckel: `par:${i}`,
    etikett: `${str(p?.term) || "🖼️ bild"} → ${str(p?.definition) || "🖼️ bild"}`,
    problem: parProblem(p),
  })));

  lagg("tidslinje", "Tidslinje", lista(area?.timeline).map((e, i) => ({
    nyckel: `tid:${i}`,
    etikett: str(e?.event),
    info: Number.isInteger(e?.year) ? arsText(e.year) : "",
    problem: handelseProblem(e),
  })));

  lagg("amnes", "Ämnesläsningstexter", readingTextsOf(area).map((t, i) => {
    const n = lista(t.questions).length;
    const fragorOk = lista(t.questions).filter((q) => !flervalProblem(q?.question, q?.options, q?.answerIndex)).length;
    return {
      nyckel: `amnes:${i}`,
      etikett: str(t.title) || `Text ${i + 1}`,
      info: `${n} ${n === 1 ? "fråga" : "frågor"}${t.level ? ` · nivå ${t.level}` : ""}`,
      problem: textProblem(t.body) || (fragorOk ? null : "inga frågor som går att ta med"),
    };
  }));
  return grupper;
}

/** Dela en lista i bitar om högst `max`, så jämnt som möjligt (11 → 6 + 5). */
export function delaJamnt(xs, max = PAR_MAX) {
  const antal = Math.ceil(xs.length / max);
  const ut = [];
  let start = 0;
  for (let k = 0; k < antal; k++) {
    const n = Math.ceil((xs.length - start) / (antal - k));
    ut.push(xs.slice(start, start + n));
    start += n;
  }
  return ut;
}

const delRubrik = (fraga, k, antal) => (antal > 1 ? `${fraga} (del ${k + 1} av ${antal})` : fraga);
const nr = (n) => Number(nyckelDel(n)[1]);

/**
 * Gör om de valda sakerna till provfrågor.
 * @param {object} area
 * @param {Iterable<string>} valda nycklarna ur omradetsSaker ("quiz:3", "par:0" …)
 * @returns {{ fragor: object[], varningar: string[] }} fragor = validerade (validateProv)
 */
export function fragorFranOmrade(area, valda) {
  const val = new Set(valda || []);
  const varningar = [];
  const ut = [];
  const quiz = lista(area?.quiz);
  const sorterade = (prefix) => [...val].filter((n) => nyckelDel(n)[0] === prefix).map(nr)
    .filter((i) => Number.isInteger(i)).sort((a, b) => a - b);

  // --- Quiz utan passage → flerval -------------------------------------------------
  const valdaQuiz = new Set(sorterade("quiz").filter((i) => quiz[i]));
  for (const i of valdaQuiz) {
    const q = quiz[i];
    if (str(q.passage)) continue;
    const p = flervalProblem(q.question, q.options, q.answerIndex);
    if (p) varningar.push(`Quizfrågan "${kort(q.question, 40)}" hoppades över: ${p}.`);
    else ut.push(flerval(q.question, q.options, q.answerIndex));
  }

  // --- Quiz med passage → textblock (en gång) + flerval -------------------------------
  for (const g of passageGrupper(quiz)) {
    const valdaHar = g.index.filter((i) => valdaQuiz.has(i));
    if (!valdaHar.length) continue;
    const tp = textProblem(g.passage);
    if (tp) {
      varningar.push(`Text ${g.nr} och ${valdaHar.length === 1 ? "dess fråga" : `dess ${valdaHar.length} frågor`} hoppades över: ${tp}.`);
      continue;
    }
    const fragor = [];
    for (const i of valdaHar) {
      const q = quiz[i];
      const p = flervalProblem(q.question, q.options, q.answerIndex);
      if (p) varningar.push(`Frågan "${kort(q.question, 40)}" (text ${g.nr}) hoppades över: ${p}.`);
      else fragor.push(flerval(q.question, q.options, q.answerIndex));
    }
    if (fragor.length) ut.push({ typ: "text", titel: "", brodtext: g.passage }, ...fragor);
  }

  // --- Par → para (3–10 per fråga) --------------------------------------------------
  const pairs = lista(area?.pairs);
  const par = [];
  const settV = new Set();
  const settH = new Set();
  let baraBild = 0;
  for (const i of sorterade("par")) {
    const p = pairs[i];
    if (!p) continue;
    const problem = parProblem(p);
    if (problem) {
      if (/^bara bild/.test(problem)) baraBild++;
      else varningar.push(`Paret "${kort(p.term || p.definition, 40)}" hoppades över: ${problem}.`);
      continue;
    }
    const v = str(p.term);
    const h = str(p.definition);
    if (settV.has(v.toLowerCase()) || settH.has(h.toLowerCase())) {
      varningar.push(`Paret "${kort(v, 40)} → ${kort(h, 40)}" hoppades över: samma begrepp eller förklaring finns redan.`);
      continue;
    }
    settV.add(v.toLowerCase());
    settH.add(h.toLowerCase());
    par.push({ vanster: v, hoger: h });
  }
  if (baraBild) varningar.push(`${baraBild} par har bara en bild och hoppades över – ett prov visar bara text.`);
  if (par.length && par.length < PAR_MIN) {
    varningar.push(`Paren hoppades över: en "Para ihop"-fråga behöver minst ${PAR_MIN} par (${par.length} gick att ta med).`);
  } else if (par.length) {
    const bitar = delaJamnt(par);
    if (bitar.length > 1) varningar.push(`${par.length} par blev ${bitar.length} "Para ihop"-frågor (högst ${PAR_MAX} par i varje).`);
    bitar.forEach((b, k) => ut.push({ typ: "para", fraga: delRubrik(PARA_FRAGA, k, bitar.length), par: b, poang: b.length }));
  }

  // --- Tidslinje → ordna (sorterad efter år) -------------------------------------------
  const timeline = lista(area?.timeline);
  const handelser = [];
  for (const i of sorterade("tid")) {
    const e = timeline[i];
    if (!e) continue;
    const problem = handelseProblem(e);
    if (problem) varningar.push(`Händelsen "${kort(e.event, 40)}" hoppades över: ${problem}.`);
    else handelser.push({ text: str(e.event), year: e.year, i });
  }
  handelser.sort((a, b) => a.year - b.year || a.i - b.i);
  const saker = [];
  const ar = new Set();
  const namn = new Set();
  for (const e of handelser) {
    // Samma år (eller samma namn) har ingen entydig ordning → bara den första.
    if (ar.has(e.year) || namn.has(e.text.toLowerCase())) {
      varningar.push(`Händelsen "${kort(e.text, 40)}" hoppades över: ${ar.has(e.year) ? `en annan vald händelse är också från ${arsText(e.year)}` : "samma händelse finns redan"}, så ordningen blir inte entydig.`);
      continue;
    }
    ar.add(e.year);
    namn.add(e.text.toLowerCase());
    saker.push(e.text);
  }
  if (saker.length && saker.length < PAR_MIN) {
    varningar.push(`Tidslinjen hoppades över: en "Sätt i ordning"-fråga behöver minst ${PAR_MIN} händelser (${saker.length} gick att ta med).`);
  } else if (saker.length) {
    const bitar = delaJamnt(saker);
    if (bitar.length > 1) varningar.push(`${saker.length} händelser blev ${bitar.length} "Sätt i ordning"-frågor (högst ${PAR_MAX} i varje).`);
    bitar.forEach((b, k) => ut.push({ typ: "ordna", fraga: delRubrik(ORDNA_FRAGA, k, bitar.length), saker: b, poang: b.length }));
  }

  // --- Ämnesläsningstexter → textblock + flerval ---------------------------------------
  const texter = readingTextsOf(area);
  for (const i of sorterade("amnes")) {
    const t = texter[i];
    if (!t) continue;
    const titel = str(t.title) || `Text ${i + 1}`;
    const tp = textProblem(t.body);
    if (tp) {
      varningar.push(`Ämnestexten "${kort(titel, 40)}" hoppades över: ${tp}.`);
      continue;
    }
    const fragor = [];
    for (const q of lista(t.questions)) {
      const p = flervalProblem(q?.question, q?.options, q?.answerIndex);
      if (p) varningar.push(`Frågan "${kort(q?.question, 40)}" (${kort(titel, 30)}) hoppades över: ${p}.`);
      else fragor.push(flerval(q.question, q.options, q.answerIndex));
    }
    if (!fragor.length) {
      varningar.push(`Ämnestexten "${kort(titel, 40)}" hoppades över: den har inga frågor som går att ta med.`);
      continue;
    }
    ut.push({ typ: "text", titel: tecken(titel) > GRANS.titel ? kort(titel, GRANS.titel) : titel, brodtext: str(t.body) }, ...fragor);
  }

  if (!ut.length) return { fragor: [], varningar };
  // Samma validering som allt annat som kommer in i ett prov (id f1, f2 …, trimmat).
  const r = validateProv({ namn: "Hämtat", fragor: ut });
  if (!r.ok) return { fragor: [], varningar: [...varningar, ...r.errors] };
  return { fragor: r.value.fragor, varningar };
}

/** "8 frågor och 2 textblock" – sammanfattningen i rutan. */
export function antalText(fragor) {
  const text = fragor.filter((f) => f.typ === "text").length;
  const n = fragor.length - text;
  return `${n} ${n === 1 ? "fråga" : "frågor"}${text ? ` och ${text} textblock` : ""}`;
}
