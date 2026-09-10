// ============================================================================
// Pluggportalen – math-generator/plugin-utils.js  (INTERN modul-del)
// ----------------------------------------------------------------------------
// Portad från klassrummattes js/plugins/_math-utils.js (PluginMathUtils). Enda
// ändringarna:
//   • ES-modul i stället för global IIFE (PluginUtils läcker aldrig ut ur
//     math-generator – bara index.js är appens gränssnitt).
//   • Rå Math.random utbytt mot en INJICERBAR slumpkälla (setRandom) så att
//     generatorerna blir deterministiska per seed.
//   • INGET render-/DOM-lager (klassrummattes _render-utils.js portas inte).
// Talmatematik och generator-logik är oförändrad så facit förblir korrekt.
// ============================================================================

// --- Injicerbar slumpkälla ---------------------------------------------------
// index.js sätter en seedad PRNG före varje generate(); default är Math.random
// så modulen även fungerar utan seed (men då icke-reproducerbart).
let _rand = Math.random;
export function setRandom(fn) {
  _rand = typeof fn === "function" ? fn : Math.random;
}
function random() {
  return _rand();
}

// =========================================================
//  Slumptal
// =========================================================
function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}
function pickRandom(arr) {
  return arr[Math.floor(random() * arr.length)];
}
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a, b) {
  return (a * b) / gcd(a, b);
}

// =========================================================
//  Konfiguration per årskurs
// =========================================================
const GRADE_CONFIG = {
  1: { addMax: 20,   subMax: 20,   multTables: [2],                          divTables: [],                          fractions: false,      geometry: "basic",         decimals: false, clockMinuteStep: 30 },
  2: { addMax: 100,  subMax: 100,  multTables: [2, 3, 4, 5],                 divTables: [2, 3, 4, 5],                fractions: false,      geometry: "basic",         decimals: false, clockMinuteStep: 15 },
  3: { addMax: 1000, subMax: 1000, multTables: [2, 3, 4, 5, 6, 7, 8, 9, 10], divTables: [2, 3, 4, 5, 6, 7, 8, 9, 10], fractions: "intro",    geometry: "basic",         decimals: false, clockMinuteStep: 5 },
  4: { addMax: 1000, subMax: 1000, multTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], divTables: [2, 3, 4, 5, 6, 7, 8, 9, 10], fractions: "same-den", geometry: "basic",         decimals: false, clockMinuteStep: 1 },
  5: { addMax: 1000, subMax: 1000, multTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], divTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fractions: "diff-den", geometry: "with-triangle", decimals: true,  clockMinuteStep: 1 },
  6: { addMax: 1000, subMax: 1000, multTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], divTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fractions: "full",     geometry: "with-circle",   decimals: true,  clockMinuteStep: 1 },
};
function cfg(grade) {
  return GRADE_CONFIG[grade] || GRADE_CONFIG[3];
}

// =========================================================
//  Carry/borrow-kontroll
// =========================================================
function hasCarry(a, b) {
  let carry = 0;
  while (a > 0 || b > 0) {
    const sum = (a % 10) + (b % 10) + carry;
    carry = Math.floor(sum / 10);
    if (carry > 0) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}
function hasBorrow(a, b) {
  while (a > 0 || b > 0) {
    if (b % 10 > a % 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

// =========================================================
//  Generators – addition / subtraktion
// =========================================================
function genNoCarryAdd(digits) {
  let a = 0, b = 0, mult = 1;
  for (let i = 0; i < digits; i++) {
    const isLeading = i === digits - 1;
    const aDigit = isLeading ? randInt(1, 9) : randInt(0, 9);
    const bDigit = isLeading ? randInt(1, 9 - aDigit) : randInt(0, 9 - aDigit);
    a += aDigit * mult;
    b += bDigit * mult;
    mult *= 10;
  }
  return { a, b };
}
function genNoCarrySub(digits) {
  let a = 0, b = 0, mult = 1;
  for (let i = 0; i < digits; i++) {
    const isLeading = i === digits - 1;
    const aDigit = isLeading ? randInt(2, 9) : randInt(0, 9);
    const bDigit = isLeading ? randInt(1, aDigit - 1) : randInt(0, aDigit);
    a += aDigit * mult;
    b += bDigit * mult;
    mult *= 10;
  }
  return { a, b };
}

function genDecimaler(grade, operator, decPlacesOverride) {
  const decPlaces = Math.max(1, Math.min(3, decPlacesOverride || (grade >= 5 ? 2 : 1)));
  const mult = Math.pow(10, decPlaces);
  const maxRaw = grade >= 5 ? 9999 : 999;
  const round = (v) => Math.round(v * mult) / mult;

  if (operator === "+") {
    const aRaw = randInt(mult, Math.floor(maxRaw * 0.6));
    const bRaw = randInt(mult, maxRaw - aRaw);
    return { type: "addition", a: aRaw / mult, b: bRaw / mult, operator: "+", answer: (aRaw + bRaw) / mult, mode: "decimaler", decimalDigits: decPlaces };
  }
  if (operator === "−" || operator === "-") {
    const aRaw = randInt(mult * 2, maxRaw);
    const bRaw = randInt(mult, aRaw - mult);
    return { type: "subtraktion", a: aRaw / mult, b: bRaw / mult, operator: "−", answer: (aRaw - bRaw) / mult, mode: "decimaler", decimalDigits: decPlaces };
  }
  if (operator === "·" || operator === "*" || operator === "×") {
    const aRaw = randInt(mult, grade >= 5 ? 9999 : 1999);
    const b = randInt(2, grade <= 3 ? 5 : grade <= 5 ? 9 : 12);
    return { type: "multiplikation", a: aRaw / mult, b, operator: "·", answer: round((aRaw / mult) * b), mode: "decimaler", decimalDigits: decPlaces };
  }
  if (operator === "÷" || operator === "/") {
    const b = randInt(2, grade <= 3 ? 5 : grade <= 5 ? 9 : 12);
    const answerRaw = randInt(mult, grade >= 5 ? 2999 : 999);
    const aRaw = answerRaw * b;
    return { type: "division", a: aRaw / mult, b, operator: "÷", answer: round(aRaw / mult / b), mode: "decimaler", decimalDigits: decPlaces };
  }

  // fallback: addition
  const aRaw = randInt(mult, Math.floor(maxRaw * 0.6));
  const bRaw = randInt(mult, maxRaw - aRaw);
  return { type: "addition", a: aRaw / mult, b: bRaw / mult, operator: "+", answer: (aRaw + bRaw) / mult, mode: "decimaler", decimalDigits: decPlaces };
}

function genFlersteg(grade) {
  const max = grade >= 5 ? 499 : 199;
  const a = randInt(10, Math.floor(max * 0.4));
  const b = randInt(10, Math.floor(max * 0.4));
  const c = randInt(10, Math.max(10, max - a - b));
  return { type: "addition", a, b, c, operator: "+", answer: a + b + c, mode: "flersteg" };
}

function genUppstallningAdd(grade, addSubVaxling) {
  const vaxlingar = addSubVaxling && addSubVaxling.length > 0 ? addSubVaxling : ["med"];
  const vaxling = pickRandom(vaxlingar);
  const digits = grade <= 2 ? 2 : grade <= 3 ? 3 : 4;
  if (vaxling === "utan") {
    const { a, b } = genNoCarryAdd(digits);
    return { type: "addition", a, b, operator: "+", answer: a + b, mode: "uppstallning", vaxling: false };
  }
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  let a, b, attempts = 0;
  do {
    a = randInt(min, Math.floor(max * 0.7));
    b = randInt(min, max - a);
    attempts++;
  } while (!hasCarry(a, b) && attempts < 20);
  return { type: "addition", a, b, operator: "+", answer: a + b, mode: "uppstallning", vaxling: true };
}

function genUppstallningSub(grade, addSubVaxling) {
  const vaxlingar = addSubVaxling && addSubVaxling.length > 0 ? addSubVaxling : ["med"];
  const vaxling = pickRandom(vaxlingar);
  const digits = grade <= 2 ? 2 : grade <= 3 ? 3 : 4;
  if (vaxling === "utan") {
    const { a, b } = genNoCarrySub(digits);
    return { type: "subtraktion", a, b, operator: "−", answer: a - b, mode: "uppstallning", vaxling: false };
  }
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  let a, b, attempts = 0;
  do {
    a = randInt(Math.floor(min * 1.5), max);
    b = randInt(min, Math.max(min, a - min));
    attempts++;
  } while (!hasBorrow(a, b) && attempts < 20);
  return { type: "subtraktion", a, b, operator: "−", answer: a - b, mode: "uppstallning", vaxling: true };
}

// Uppställning för extra-panelen.
// opts.vaxling: null = random, 'med' = kräv växling, 'utan' = utan växling
function genUppstallning(subtype, c, opts) {
  const maxVal = Math.min(c.addMax || 10000, 9999);
  const minVal = Math.max(10, Math.floor(maxVal / 20));
  const vaxling = (opts && opts.vaxling) || null;

  if (subtype === "add") {
    for (let tries = 0; tries < 50; tries++) {
      const a = randInt(minVal, Math.floor(maxVal * 0.6));
      const b = randInt(minVal, maxVal - a);
      if (vaxling === "med" && !hasCarry(a, b)) continue;
      if (vaxling === "utan" && hasCarry(a, b)) continue;
      return { type: "uppstallning-add", a, b, operator: "+", answer: a + b };
    }
    const a = randInt(minVal, Math.floor(maxVal * 0.6));
    const b = randInt(minVal, maxVal - a);
    return { type: "uppstallning-add", a, b, operator: "+", answer: a + b };
  }
  if (subtype === "sub") {
    for (let tries = 0; tries < 50; tries++) {
      const a = randInt(Math.floor(maxVal / 2), maxVal);
      const b = randInt(minVal, a - minVal > 0 ? a - minVal : a);
      if (vaxling === "med" && !hasBorrow(a, b)) continue;
      if (vaxling === "utan" && hasBorrow(a, b)) continue;
      return { type: "uppstallning-sub", a, b, operator: "−", answer: a - b };
    }
    const a = randInt(Math.floor(maxVal / 2), maxVal);
    const b = randInt(minVal, a - minVal > 0 ? a - minVal : a);
    return { type: "uppstallning-sub", a, b, operator: "−", answer: a - b };
  }
  if (subtype === "div") {
    const b = randInt(2, 9);
    const answer = randInt(2, Math.min(99, Math.floor(maxVal / b)));
    const a = b * answer;
    return { type: "uppstallning-div", a, b, operator: "÷", answer };
  }
  const a = randInt(11, Math.min(99, maxVal));
  const b = randInt(2, 9);
  return { type: "uppstallning-mult", a, b, operator: "·", answer: a * b };
}

// =========================================================
//  Publik API (intern för math-generator)
// =========================================================
export const PluginUtils = {
  random,
  randInt,
  pickRandom,
  gcd,
  lcm,
  GRADE_CONFIG,
  cfg,
  hasCarry,
  hasBorrow,
  genNoCarryAdd,
  genNoCarrySub,
  genDecimaler,
  genFlersteg,
  genUppstallningAdd,
  genUppstallningSub,
  genUppstallning,
};
