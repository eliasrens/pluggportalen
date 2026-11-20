// ============================================================================
// Pluggporten – gemensam multiplikationsmotor: frågegenerator (#457)
// ----------------------------------------------------------------------------
// Ren modul (inga DOM-/Firebase-beroenden) som delas av Mattematchen och
// Live-läget `multiplication_0_10`. Testas i Node: test/mult-generator.test.js.
//
// API
//   createMultGenerator(opts?) → { next(), peekBagSize(), drawn }
//     opts.min/max   tabellintervall (default 0–10 → alla 121 kombinationer)
//     opts.rng       () => [0,1) (default Math.random; ge seededRng(n) i test)
//     opts.weight    (a, b) => heltal ≥ 1, antal kopior per påse (default
//                    DEFAULT_WEIGHT: ×0/×1 en gång, övriga två gånger)
//     next()         → MultQuestion { key, a, b, answer, tables, text }
//   makeQuestion(a, b)       → MultQuestion (samma form, för tester/återspel)
//   tablesOf(a, b)           → [a, b] utan dubblett (7×7 → [7])
//   isMirror(q1, q2)         → true om 7×8 / 8×7 (olika ordning, samma par)
//   checkMultAnswer(q, raw)  → { valid, correct, given, correctAnswer }
//   seededRng(seed)          → deterministisk mulberry32-ström
//   multDistractors(q, rng?) → 3 rimliga felalternativ (se FLERVAL nedan)
//   multChoices(q, rng?)     → { options: number[4], answerIndex } – samma
//                              form som Pluggas quiz (options/answerIndex)
//
// URVAL – "shuffle-bag": en påse innehåller VARJE kombination (a, b) inom
// intervallet, `weight(a, b)` gånger, och blandas. Frågor dras ur påsen tills
// den är tom, sedan fylls en ny. Det ger exakt balans över varje påse (ingen
// "dålig slump" där svåra tal uteblir) men känns ändå slumpmässigt. Före varje
// dragning byts kandidaten mot en senare post i påsen om den är SAMMA fråga
// som förra eller dess SPEGEL (7×8 → 8×7). Hittas ingen giltig post i resten
// av påsen (bara i påsens sista dragningar) skjuts resten in i nästa påse –
// balansen bevaras, posterna dras bara lite senare.
//
// VIKTNING: tabellerna 0 och 1 är "gratis" – med rak likafördelning är var
// tredje fråga ×0 eller ×1. DEFAULT_WEIGHT ger varje kombination där en
// faktor är 0 eller 1 vikt 1 och övriga vikt 2 → ca 20 % lätta frågor, men
// alla 121 kombinationer förekommer i varje påse.
//
// FLERVAL (#552): felalternativen ska vara RIMLIGA, inte slumptal. I tur och
// ordning: (1) grannar i tabellen a×(b±1), (a±1)×b; (2) andra produkter i
// 0–10-tabellen nära facit (7×8 → 54, 49 …); (3) facit ±1, ±2 … som sista
// utväg (bara 0×0 och liknande behöver den). Aldrig negativt, aldrig dubblett,
// aldrig facit. Rätt svars plats blandas med rng (seedbar).
// ============================================================================

/** Default-vikt: lätta kombinationer (en faktor 0 eller 1) en gång per påse. */
export function DEFAULT_WEIGHT(a, b) {
  return a <= 1 || b <= 1 ? 1 : 2;
}

/**
 * mulberry32 – liten deterministisk PRNG (för tester/återspel).
 * @param {number} seed
 * @returns {() => number} ström i [0, 1)
 */
export function seededRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tabellerna en fråga tillhör (för statistik per tabell). 7×7 → [7]. */
export function tablesOf(a, b) {
  return a === b ? [a] : [a, b];
}

/**
 * @typedef {object} MultQuestion
 * @property {string} key      "7x8" – stabil nyckel (ordningen spelar roll)
 * @property {number} a        första faktorn
 * @property {number} b        andra faktorn
 * @property {number} answer   facit a·b
 * @property {number[]} tables tabellerna frågan räknas till (tablesOf)
 * @property {string} text     "7 × 8" (utan "= ?", UI:t lägger till)
 */

/** Bygg en fråga ur två faktorer. */
export function makeQuestion(a, b) {
  return { key: `${a}x${b}`, a, b, answer: a * b, tables: tablesOf(a, b), text: `${a} × ${b}` };
}

/** Samma fråga (exakt samma ordning). */
function sameQ(p, q) {
  return !!p && !!q && p.a === q.a && p.b === q.b;
}

/** Spegelvänd fråga: 7×8 ↔ 8×7 (7×7 räknas inte som spegel, det är samma). */
export function isMirror(p, q) {
  return !!p && !!q && p.a === q.b && p.b === q.a && p.a !== p.b;
}

/** Krockar kandidaten med förra frågan (samma eller spegel)? */
function conflicts(prev, cand) {
  return sameQ(prev, cand) || isMirror(prev, cand);
}

/**
 * Rätta ett råsvar. Bara heltal (siffror, ev. omgivande blanksteg) är giltiga;
 * tomt/skräp ger `valid: false` och ska INTE räknas som ett försök.
 * @param {{answer:number}} q
 * @param {string|number} raw
 * @returns {{valid:boolean, correct:boolean, given:number|null, correctAnswer:number}}
 */
export function checkMultAnswer(q, raw) {
  const s = String(raw ?? "").trim();
  if (!/^\d{1,4}$/.test(s)) return { valid: false, correct: false, given: null, correctAnswer: q.answer };
  const given = parseInt(s, 10);
  return { valid: true, correct: given === q.answer, given, correctAnswer: q.answer };
}

/**
 * Skapa en frågeström.
 * @param {{min?:number, max?:number, rng?:() => number, weight?:(a:number,b:number)=>number}} [opts]
 */
export function createMultGenerator(opts = {}) {
  const min = opts.min ?? 0;
  const max = opts.max ?? 10;
  const rng = opts.rng || Math.random;
  const weight = opts.weight || DEFAULT_WEIGHT;
  if (!(Number.isInteger(min) && Number.isInteger(max) && min <= max)) {
    throw new Error(`createMultGenerator: ogiltigt intervall ${min}–${max}`);
  }
  const single = min === max; // 7×7 enda kombinationen → upprepning oundviklig

  let bag = [];
  let prev = null;
  let drawn = 0;

  function freshBag() {
    const out = [];
    for (let a = min; a <= max; a++) {
      for (let b = min; b <= max; b++) {
        const w = Math.max(1, Math.floor(weight(a, b)));
        for (let i = 0; i < w; i++) out.push(makeQuestion(a, b));
      }
    }
    // Fisher–Yates
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Påsen konsumeras bakifrån (pop) – billigt och lika slumpmässigt.
  function next() {
    if (!bag.length) bag = freshBag();
    if (!single) {
      let idx = bag.length - 1;
      while (idx >= 0 && conflicts(prev, bag[idx])) idx--;
      if (idx < 0) {
        // Bara krockande poster kvar: flytta in dem i en ny påse och sök där.
        const rest = bag;
        bag = freshBag();
        for (const q of rest) bag.splice(Math.floor(rng() * (bag.length + 1)), 0, q);
        idx = bag.length - 1;
        while (idx >= 0 && conflicts(prev, bag[idx])) idx--;
      }
      const last = bag.length - 1;
      [bag[idx], bag[last]] = [bag[last], bag[idx]];
    }
    prev = bag.pop();
    drawn++;
    return prev;
  }

  return {
    next,
    /** Antal frågor kvar i aktuell påse (för tester/felsökning). */
    peekBagSize: () => bag.length,
    get drawn() { return drawn; },
  };
}

/** Alla produkter i 0–10-tabellen (0, 1, 2 … 100), sorterade. */
const TABLE_PRODUCTS = (() => {
  const set = new Set();
  for (let x = 0; x <= 10; x++) for (let y = 0; y <= 10; y++) set.add(x * y);
  return [...set].sort((p, q) => p - q);
})();

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Tre rimliga felalternativ till en multiplikationsfråga.
 * @param {{a:number, b:number, answer:number}} q
 * @param {() => number} [rng]
 * @returns {number[]} 3 unika, icke-negativa tal ≠ facit
 */
export function multDistractors(q, rng = Math.random) {
  const { a, b, answer } = q;
  const picked = [];
  const ok = (n) => Number.isInteger(n) && n >= 0 && n !== answer && !picked.includes(n);
  const take = (pool) => {
    for (const n of pool) {
      if (picked.length >= 3) return;
      if (ok(n)) picked.push(n);
    }
  };
  // 1) Tabellgrannar – blandade så samma fråga inte alltid får samma trio.
  take(shuffleInPlace([a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b], rng));
  // 2) Närliggande produkter i tabellen – de närmaste (en reserv extra så
  //    trion varierar), blandade inbördes.
  if (picked.length < 3) {
    const near = TABLE_PRODUCTS.filter(ok)
      .sort((p, r) => Math.abs(p - answer) - Math.abs(r - answer) || p - r)
      .slice(0, 3 - picked.length + 1);
    take(shuffleInPlace(near, rng));
  }
  // 3) Sista utväg: facit ±1, ±2 …
  for (let d = 1; picked.length < 3; d++) take([answer + d, answer - d]);
  return picked;
}

/**
 * Fyra alternativ med facit på slumpad plats.
 * @param {{a:number, b:number, answer:number}} q
 * @param {() => number} [rng]
 * @returns {{options:number[], answerIndex:number}}
 */
export function multChoices(q, rng = Math.random) {
  const options = shuffleInPlace([q.answer, ...multDistractors(q, rng)], rng);
  return { options, answerIndex: options.indexOf(q.answer) };
}
