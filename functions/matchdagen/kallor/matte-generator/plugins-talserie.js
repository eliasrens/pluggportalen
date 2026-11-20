// ============================================================================
// Matte­generator FAS 2 (issue #295) – talförståelse-plugins (INTERN modul)
// ----------------------------------------------------------------------------
// Portade ur klassrummatte: talsorter, tallinje, talföljd, negativa tal,
// romerska siffror. Ren beräkning; källans råa Math.random()/sort-shuffle är
// utbytta mot rnd()/PluginUtils.shuffle() (seedbart). Se plugins-classroom.js
// för helheten och FORCING/answerType-kontraktet (settings.variantType).
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { rnd } from "./prng.js";
import { PluginUtils } from "./plugin-utils.js";
import { BasePlugin } from "./plugin-base.js";

const U = PluginUtils;

// ── Talsorter (åk 1–3) – identifiera talsort för en siffra. [text] ──────────
const PLACE_NAMES = ['ental', 'tiotal', 'hundratal', 'tusental'];
class TalsorterPlugin extends BasePlugin {
  constructor() { super(); this.type = 'talsorter'; }
  generate(settings) {
    const grade = Math.min(settings.grade, 3);
    let num;
    if (grade <= 1) num = U.randInt(11, 99);
    else if (grade <= 2) num = U.pickRandom([() => U.randInt(11, 99), () => U.randInt(100, 999)])();
    else num = U.pickRandom([() => U.randInt(100, 999), () => U.randInt(1000, 9999)])();
    const digitPos = U.randInt(0, String(num).length - 1);
    const targetDigit = Math.floor(num / Math.pow(10, digitPos)) % 10;
    return {
      type: 'talsorter', number: num, targetDigit, digitPosition: digitPos,
      text: `Vilken talsort har den markerade siffran i talet ${num}?`,
      answer: PLACE_NAMES[digitPos],
    };
  }
}

// ── Tallinje (åk 1–3) – ett saknat tal i en aritmetisk följd. [numeric] ─────
class TallinjePlugin extends BasePlugin {
  constructor() { super(); this.type = 'tallinje'; }
  generate(settings) {
    const grade = Math.min(settings.grade, 3);
    const stepOptions = grade <= 1 ? [1] : grade <= 2 ? [1, 2, 5, 10] : [2, 5, 10, 100];
    const step = U.pickRandom(stepOptions);
    const maxNum = grade <= 1 ? 20 : grade <= 2 ? 100 : 1000;
    const length = grade <= 1 ? 5 : 6;
    const maxStart = maxNum - step * (length - 1);
    const startBase = Math.floor(U.randInt(0, Math.max(0, maxStart)) / step) * step;
    const blankIndex = U.randInt(1, length - 1);
    const sequence = [];
    for (let i = 0; i < length; i++) sequence.push(startBase + i * step);
    const display = sequence.map((v, i) => (i === blankIndex ? null : v));
    return {
      type: 'tallinje', display, step,
      text: `${display.map(v => (v === null ? '_' : v)).join(', ')} — vilket tal saknas?`,
      answer: sequence[blankIndex],
    };
  }
}

// ── Talföljd (åk 1–6) – nästa tal / saknat tal / regel. ─────────────────────
// Spelbara varianter: next & missing (numeric). rule ger text-svar (ej spelbar).
function _nextVal(ruleType, ruleValue, last) {
  if (ruleType === '+') return last + ruleValue;
  if (ruleType === '−') return last - ruleValue;
  return last * ruleValue;
}
class TalfoljdPlugin extends BasePlugin {
  constructor() { super(); this.type = 'talfoljd'; }
  generate(settings) {
    const grade = settings.grade;
    let ruleType, ruleValue, start;
    const length = 5;
    if (grade <= 2) {
      ruleType = '+'; ruleValue = U.pickRandom([1, 2, 5, 10]); start = U.randInt(0, 15);
    } else if (grade <= 4) {
      if (rnd() < 0.6) { ruleType = '+'; ruleValue = U.pickRandom([2, 3, 4, 5, 10, 25, 100]); start = U.randInt(0, 20); }
      else { ruleType = '×'; ruleValue = U.pickRandom([2, 3, 5, 10]); start = U.randInt(1, 5); }
    } else {
      ruleType = U.pickRandom(['+', '×', '−']);
      if (ruleType === '+') { ruleValue = U.pickRandom([3, 4, 5, 6, 7, 8, 9, 11, 15, 20, 50]); start = U.randInt(0, 50); }
      else if (ruleType === '×') { ruleValue = U.pickRandom([2, 3, 4, 5]); start = U.randInt(1, 5); }
      else { ruleValue = U.pickRandom([2, 3, 5, 10]); start = ruleValue * U.randInt(5, 15); }
    }
    const sequence = [start];
    for (let i = 1; i < length; i++) {
      const prev = sequence[i - 1];
      if (ruleType === '+') sequence.push(prev + ruleValue);
      else if (ruleType === '−') sequence.push(prev - ruleValue);
      else sequence.push(prev * ruleValue);
    }
    const qtOpts = grade <= 2 ? ['next', 'missing'] : ['next', 'missing', 'rule'];
    const qt = settings.variantType && qtOpts.includes(settings.variantType) ? settings.variantType : U.pickRandom(qtOpts);
    if (qt === 'next') {
      return { type: 'talfoljd', questionType: 'next', sequence, text: `${sequence.join(', ')}, _ — vad är nästa tal?`, answer: _nextVal(ruleType, ruleValue, sequence[length - 1]) };
    }
    if (qt === 'missing') {
      const blankIdx = U.randInt(1, length - 2);
      const display = sequence.map((v, i) => (i === blankIdx ? null : v));
      return { type: 'talfoljd', questionType: 'missing', display, sequence, text: `${display.map(v => (v === null ? '_' : v)).join(', ')} — vilket tal saknas?`, answer: sequence[blankIdx] };
    }
    return { type: 'talfoljd', questionType: 'rule', sequence, text: `${sequence.join(', ')} — vad är regeln?`, answer: `${ruleType} ${ruleValue}` };
  }
}

// ── Negativa tal (åk 5–6) – tallinje / temperatur / add-sub. ────────────────
// Spelbara: temp & add-sub (numeric, självbärande). tallinje kräver SVG.
class NegativaTalPlugin extends BasePlugin {
  constructor() { super(); this.type = 'negativa-tal'; }
  generate(settings) {
    const qt = settings.variantType || U.pickRandom(['tallinje', 'temp', 'temp', 'add-sub', 'add-sub']);
    if (qt === 'tallinje') {
      const val = U.randInt(-9, 9);
      return { type: 'negativa-tal', questionType: 'tallinje', value: val, text: 'Vilket tal visar pilen?', answer: val };
    }
    if (qt === 'temp') {
      const start = U.randInt(-10, 8);
      const change = U.randInt(1, 8);
      const dir = U.pickRandom(['stiger', 'sjunker']);
      const result = dir === 'stiger' ? start + change : start - change;
      const ctx = U.pickRandom(['Det är', 'Termometern visar', 'Temperaturen ute är']);
      return { type: 'negativa-tal', questionType: 'temp', ctx, start, change, dir, text: `${ctx} ${start}°C och temperaturen ${dir} med ${change} grader. Vad är temperaturen nu?`, answer: result };
    }
    const op = U.pickRandom(['+', '+', '-']);
    let a, b;
    if (op === '+') { a = U.randInt(-9, -1); b = U.randInt(1, 9); } else { a = U.randInt(1, 9); b = U.randInt(a + 1, a + 9); }
    const answer = op === '+' ? a + b : a - b;
    return { type: 'negativa-tal', questionType: 'add-sub', a, b, op, text: `${a} ${op} ${b}`, answer };
  }
}

// ── Romerska siffror (åk 4–5). ──────────────────────────────────────────────
// Spelbar variant: roman-to-arabic (numeric). arabic-to-roman ger romersk sträng (ej spelbar).
function _toRoman(n) {
  const MAP = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of MAP) { while (n >= v) { s += r; n -= v; } }
  return s;
}
const ROMAN_VALUES_4 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const ROMAN_VALUES_5 = [...ROMAN_VALUES_4, 110, 120, 130, 140, 150, 200, 300, 400, 500];
class RomerskaPlugin extends BasePlugin {
  constructor() { super(); this.type = 'romerska'; }
  generate(settings) {
    const grade = Math.max(settings.grade, 4);
    const num = U.pickRandom(grade >= 5 ? ROMAN_VALUES_5 : ROMAN_VALUES_4);
    const roman = _toRoman(num);
    const qt = settings.variantType || U.pickRandom(['roman-to-arabic', 'roman-to-arabic', 'arabic-to-roman']);
    if (qt === 'arabic-to-roman') {
      return { type: 'romerska', questionType: 'arabic-to-roman', number: num, roman, text: `Skriv ${num} med romerska siffror.`, answer: roman };
    }
    return { type: 'romerska', questionType: 'roman-to-arabic', number: num, roman, text: `Vilket tal är ${roman}?`, answer: num };
  }
}

export const TALSERIE_PLUGINS = [
  new TalsorterPlugin(),
  new TallinjePlugin(),
  new TalfoljdPlugin(),
  new NegativaTalPlugin(),
  new RomerskaPlugin(),
];
