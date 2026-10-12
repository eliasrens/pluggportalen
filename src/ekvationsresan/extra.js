// ============================================================================
// Ekvationsresan – extrautmaningar (src/ekvationsresan/extra.js) · #627, E2.6
// ----------------------------------------------------------------------------
// Frivilliga uppgifter för starka elever: negativa x, bråk, svårare decimaler,
// enkla parenteser och kluriga flerstegsekvationer. Krävs ALDRIG för
// huvudprogressionen och påverkar inte nivån (framsteg.applyExtraCompletion).
//
// Samma uppgiftsform som generator.js, plus:
//   task.extra    true – spärrarna är config.EXTRA_RULES (rulesForTask)
//   task.category negativ | brak | decimal | parentes | klurig (config.EXTRA)
//   task.level    elevens nivå när uppgiften skapades (bara som sammanhang –
//                 försöket måste ha en nivå 1–12 i firestore.rules)
// Exakt aritmetik som överallt (rational.js). Formerna väljer x först och
// räknar fram talen; solve() kontrollerar lösningen exakt. Alla drag på den
// optimala vägen går att skriva i talfältet (heltal, högst två decimaler,
// x-termer) – eleven behöver aldrig skriva ett bråk.
// ============================================================================

import { EXTRA, EXTRA_RULES, LEVEL_MIN, LEVEL_MAX } from "./config.js";
import { randInt } from "./forms.js";
import { seededRng } from "./generator.js";
import { q, toQ, add, mul, eq as same, isInteger, isDecimal } from "./rational.js";
import { term, makeEquation, withParens, toJSON, equationKey, solve } from "./equation.js";
import { optimalPath } from "./solver.js";
import { equationRow } from "./notation.js";
import { chooseView, statesAlong } from "./vag-visning.js";

export { seededRng };

const X = (a = 1) => term(q(a), 1);
const XQ = (c) => term(c, 1);
const C = (n) => term(q(n), 0);
const CQ = (c) => term(c, 0);
const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];
const neg = (rng, min, max) => -randInt(rng, min, max);

/** Decimaler med två siffror (svårare än nivå 10:s 2,5). Aldrig täljaren 1 – 0,25x skrivs x/4. */
const HARD_DECIMALS = Object.freeze([[5, 4], [3, 4], [7, 4], [9, 4], [2, 5], [8, 5], [6, 5], [12, 5]]);
const pickHard = (rng) => {
  const [n, d] = pick(rng, HARD_DECIMALS);
  return q(n, d);
};
/** a/b som inte är en ändlig decimal – 2x/3 skrivs med bråkstreck (aldrig 0,8x). */
const FRACTION_COEFS = Object.freeze([[2, 3], [4, 3], [5, 3], [5, 6], [2, 7], [3, 7], [4, 7]]);
/** Ett "äkta" bråk: lösningen n/d går inte att skriva som en ändlig decimal. */
const trueFraction = (x) => !isInteger(x) && !isDecimal(x, EXTRA_RULES.maxDecimals);

/**
 * Formerna per kategori. build(rng) → { equation, solution } eller null.
 * `moves` = formens strukturella optimum (testerna jämför med BFS), `parens` =
 * faktorerna som skrivs utanför parentesen (equation.withParens).
 */
export const EXTRA_FORMS = Object.freeze({
  // --- negativa x ------------------------------------------------------------
  "x+a=b:neg": { //                    x + 9 = 4 → x = −5
    category: "negativ", moves: 1,
    build(rng) {
      const x = neg(rng, 1, 15);
      const a = randInt(rng, 1, 20);
      return { equation: makeEquation([X(), C(a)], [C(x + a)]), solution: x };
    },
  },
  "ax+b=c:neg": { //                   3x + 20 = 5 → x = −5
    category: "negativ", moves: 2,
    build(rng) {
      const a = randInt(rng, 2, 7);
      const x = neg(rng, 1, 10);
      const b = randInt(rng, 1, 40);
      if (a * x + b === 0) return null;
      return { equation: makeEquation([X(a), C(b)], [C(a * x + b)]), solution: x };
    },
  },
  "ax+b=cx+d:neg": { //                5x + 3 = 2x − 9 → x = −4
    category: "negativ", moves: 3,
    build(rng) {
      const a = randInt(rng, 3, 8);
      const c = randInt(rng, 1, a - 2);
      const x = neg(rng, 1, 10);
      const b = randInt(rng, 1, 25);
      const d = (a - c) * x + b;
      if (d === 0) return null;
      return { equation: makeEquation([X(a), C(b)], [X(c), C(d)]), solution: x };
    },
  },

  // --- bråk ----------------------------------------------------------------------
  "ax=b:frac": { //                    3x = 5 → x = 5/3
    category: "brak", moves: 1,
    build(rng) {
      const a = pick(rng, [3, 6, 7, 9]);
      const b = randInt(rng, 1, 20);
      const x = q(b, a);
      if (!trueFraction(x)) return null;
      return { equation: makeEquation([X(a)], [C(b)]), solution: x };
    },
  },
  "ax+b=c:frac": { //                  3x + 2 = 7 → x = 5/3
    category: "brak", moves: 2,
    build(rng) {
      const a = pick(rng, [3, 6, 7, 9]);
      const k = randInt(rng, 1, 20);
      const b = randInt(rng, 1, 15);
      const x = q(k, a);
      if (!trueFraction(x)) return null;
      return { equation: makeEquation([X(a), C(b)], [C(k + b)]), solution: x };
    },
  },
  "ax/b=c": { //                       2x/3 = 8 → ·3, ÷2 → x = 12
    category: "brak", moves: 2,
    build(rng) {
      const [a, b] = pick(rng, FRACTION_COEFS);
      const k = randInt(rng, 1, 8);
      return { equation: makeEquation([XQ(q(a, b))], [C(a * k)]), solution: b * k };
    },
  },
  "ax/b+c=d": { //                     2x/3 + 4 = 10 → x = 9
    category: "brak", moves: 3,
    build(rng) {
      const [a, b] = pick(rng, FRACTION_COEFS);
      const k = randInt(rng, 1, 6);
      const c = randInt(rng, 1, 15);
      return { equation: makeEquation([XQ(q(a, b)), C(c)], [C(a * k + c)]), solution: b * k };
    },
  },

  // --- svårare decimaler ---------------------------------------------------------
  "dx+e=f": { //                       1,25x + 0,75 = 5,75 → x = 4
    category: "decimal", moves: 2,
    build(rng) {
      const a = pickHard(rng);
      const x = randInt(rng, 2, 12);
      const b = q(randInt(rng, 1, 40), 4);
      if (isInteger(b)) return null;
      return { equation: makeEquation([XQ(a), CQ(b)], [CQ(add(mul(a, q(x)), b))]), solution: x };
    },
  },
  "dx-e=f:xdec": { //                  0,4x − 1,2 = 0,6 → x = 4,5
    category: "decimal", moves: 2,
    build(rng) {
      const a = pickHard(rng);
      const x = q(randInt(rng, 3, 39), 2);
      const b = q(randInt(rng, 1, 30), 5);
      const right = add(mul(a, x), q(-b.n, b.d));
      if (isInteger(x) || right.n <= 0 || !isDecimal(right, 2)) return null;
      return { equation: makeEquation([XQ(a), CQ(q(-b.n, b.d))], [CQ(right)]), solution: x };
    },
  },
  "dx+e=fx+g": { //                    2,75x + 1,5 = 0,75x + 7,5 → x = 3
    category: "decimal", moves: 3,
    build(rng) {
      const c = pickHard(rng);
      const diff = randInt(rng, 2, 4);
      const x = randInt(rng, 1, 10);
      const b = q(randInt(rng, 1, 20), 2);
      const d = add(q(diff * x), b);
      return { equation: makeEquation([XQ(add(c, q(diff))), CQ(b)], [XQ(c), CQ(d)]), solution: x };
    },
  },

  // --- enkla parenteser ----------------------------------------------------------
  "a(x+b)=c": { //                     3(x + 2) = 21 → x = 5
    category: "parentes", moves: 2,
    build(rng) {
      const a = randInt(rng, 2, 9);
      const x = randInt(rng, 1, 12);
      const b = randInt(rng, 1, 12);
      return { equation: makeEquation([X(a), C(a * b)], [C(a * (x + b))]), solution: x, parens: { left: a } };
    },
  },
  "a(x-b)=c": { //                     4(x − 3) = 20 → x = 8
    category: "parentes", moves: 2,
    build(rng) {
      const a = randInt(rng, 2, 9);
      const b = randInt(rng, 1, 12);
      const x = randInt(rng, b + 1, b + 12);
      return { equation: makeEquation([X(a), C(-a * b)], [C(a * (x - b))]), solution: x, parens: { left: a } };
    },
  },
  "a(x+b)=cx+d": { //                  4(x + 2) = x + 20 → −x, −8, ÷3 → x = 4
    category: "parentes", moves: 3,
    build(rng) {
      const a = randInt(rng, 3, 6);
      const b = randInt(rng, 1, 8);
      const c = randInt(rng, 1, a - 2);
      const x = randInt(rng, 1, 12);
      const d = (a - c) * x + a * b;
      return { equation: makeEquation([X(a), C(a * b)], [X(c), C(d)]), solution: x, parens: { left: a } };
    },
  },

  // --- klurigt: fler steg, x på "fel" sida, minus framför x ------------------
  "b-ax=c-dx": { //                    20 − 3x = 2 − x → x = 9
    category: "klurig", moves: 3,
    build(rng) {
      const a = randInt(rng, 3, 8);
      const d = randInt(rng, 1, a - 2);
      const x = randInt(rng, 1, 12);
      const c = randInt(rng, 1, 30);
      return { equation: makeEquation([C((a - d) * x + c), X(-a)], [C(c), X(-d)]), solution: x };
    },
  },
  "b-ax=c:neg": { //                   4 − 3x = 19 → +3x, −19, ÷3 → x = −5
    category: "klurig", moves: 3, // talfältet har inga negativa tal, så ÷(−3) finns inte
    build(rng) {
      const a = randInt(rng, 2, 8);
      const x = neg(rng, 1, 10);
      const b = randInt(rng, 1, 30);
      return { equation: makeEquation([C(b), X(-a)], [C(b - a * x)]), solution: x };
    },
  },
  "a(x+b)=c(x-d)": { //                3(x + 4) = 5(x − 2) → x = 11
    category: "klurig", moves: 3,
    build(rng) {
      const a = randInt(rng, 2, 5);
      const c = randInt(rng, a + 2, a + 5);
      const x = randInt(rng, 2, 20);
      // a(x + b) = c(x − d) ⇔ ab + cd = (c − a)x – välj b, räkna d.
      const b = randInt(rng, 1, 8);
      const rest = (c - a) * x - a * b;
      if (rest <= 0 || rest % c) return null;
      const d = rest / c;
      return { equation: makeEquation([X(a), C(a * b)], [X(c), C(-c * d)]), solution: x, parens: { left: a, right: c } };
    },
  },
});

/** Formerna i en kategori. */
export const formsIn = (category) => Object.keys(EXTRA_FORMS).filter((id) => EXTRA_FORMS[id].category === category);

function pickWeighted(weights, rng) {
  const entries = Object.entries(weights);
  let r = rng() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of entries) if ((r -= w) < 0) return id;
  return entries[entries.length - 1][0];
}

const MAX_TRIES = 200;

function buildExtra(formId, rng, level) {
  const form = EXTRA_FORMS[formId];
  const built = form.build(rng);
  if (!built) return null;
  const equation = built.parens ? withParens(built.equation, built.parens) : built.equation;
  const solution = solve(equation);
  if (!solution || !same(solution, toQ(built.solution))) return null;
  const best = optimalPath(equation, EXTRA_RULES);
  if (!best || best.moves === 0) return null;
  return {
    schema: 1,
    level: Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Number.isInteger(level) ? level : LEVEL_MIN)),
    extra: true,
    category: form.category,
    form: formId,
    type: "B",
    key: equationKey(equation),
    equation: toJSON(equation),
    text: equationRow(equation, "start").text,
    solution: { n: solution.n, d: solution.d },
    optimalMoves: best.moves,
    optimalPath: best.path,
    swapped: false,
    display: chooseView(statesAlong(equation, best.path, EXTRA_RULES)),
  };
}

/**
 * En ny extrautmaning.
 * @param {{rng?:()=>number, level?:number, previous?:object|string, category?:string,
 *   form?:string, avoidSolution?:object|number}} [opts]
 *   level = elevens nivå (sammanhang), previous = förra uppgiften (aldrig samma
 *   ekvation två gånger), category/form = tvinga (similarExtraTask, tester).
 */
export function generateExtraTask({ rng = Math.random, level = LEVEL_MIN, previous = null, category = null, form = null, avoidSolution = null } = {}) {
  const prevKey = typeof previous === "string" ? previous : previous?.key || null;
  const avoid = avoidSolution === null ? null : toQ(avoidSolution);
  for (let i = 0; i < MAX_TRIES; i++) {
    const cat = category || pickWeighted(EXTRA.categories, rng);
    const formId = form || pick(rng, formsIn(cat));
    const task = buildExtra(formId, rng, level);
    if (!task || task.key === prevKey) continue;
    if (avoid && same(toQ(task.solution), avoid)) continue;
    return task;
  }
  throw new Error("Ekvationsresan: kunde inte generera en extrautmaning");
}

/** "Försök igen" för en extrautmaning: samma form, ny ekvation och lösning. */
export function similarExtraTask(task, { rng = Math.random } = {}) {
  return generateExtraTask({ rng, level: task.level, previous: task, form: task.form, avoidSolution: task.solution });
}

/** Rubriken i spelvyn: "EXTRAUTMANING – NEGATIVA X". */
export function extraTitle(task) {
  const name = EXTRA.names[task?.category];
  return `${EXTRA.title.toUpperCase().replace(/AR$/, "")}${name ? ` – ${name.toUpperCase()}` : ""}`;
}

/** Är extrautmaningarna öppna för eleven? (högsta nådda nivån) */
export const extraUnlocked = (progress) => (progress?.maxLevel ?? 0) >= EXTRA.minLevel;
