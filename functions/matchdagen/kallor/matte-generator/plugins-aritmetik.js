// ============================================================================
// Matte­generator FAS 2 (issue #295) – aritmetik-utökningar (INTERN modul)
// ----------------------------------------------------------------------------
// Portade ur klassrummatte: procent, avrundning, prioritetsregler, öppna
// utsagor, ekvationer. Ren beräkning; källans råa Math.random()/sort-shuffle är
// utbytta mot rnd()/PluginUtils.shuffle(). FORCING via settings.variantType.
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { rnd } from "./prng.js";
import { PluginUtils } from "./plugin-utils.js";
import { BasePlugin } from "./plugin-base.js";

const U = PluginUtils;

// ── Procent (åk 4–6). ───────────────────────────────────────────────────────
// Spelbar variant: pct-of-whole (numeric, självbärande). Övriga (omvandling/
// baklänges) har bråk-/procent-/kr-svar – porteras men exponeras ej i räkna.
const PROCENT_SIMPLE = [
  { percent: 10, fraction: [1, 10], decimal: 0.1 }, { percent: 25, fraction: [1, 4], decimal: 0.25 },
  { percent: 50, fraction: [1, 2], decimal: 0.5 }, { percent: 75, fraction: [3, 4], decimal: 0.75 },
  { percent: 100, fraction: [1, 1], decimal: 1.0 },
];
const PROCENT_FULL = [
  { percent: 10, fraction: [1, 10], decimal: 0.1 }, { percent: 20, fraction: [1, 5], decimal: 0.2 },
  { percent: 25, fraction: [1, 4], decimal: 0.25 }, { percent: 30, fraction: [3, 10], decimal: 0.3 },
  { percent: 40, fraction: [2, 5], decimal: 0.4 }, { percent: 50, fraction: [1, 2], decimal: 0.5 },
  { percent: 60, fraction: [3, 5], decimal: 0.6 }, { percent: 70, fraction: [7, 10], decimal: 0.7 },
  { percent: 75, fraction: [3, 4], decimal: 0.75 }, { percent: 80, fraction: [4, 5], decimal: 0.8 },
  { percent: 90, fraction: [9, 10], decimal: 0.9 }, { percent: 100, fraction: [1, 1], decimal: 1.0 },
];
const PCT_OF_WHOLE_SIMPLE = [
  { percent: 10, wholes: [10, 20, 30, 40, 50, 60, 70, 80, 100] },
  { percent: 25, wholes: [4, 8, 12, 16, 20, 24, 40, 60, 80, 100] },
  { percent: 50, wholes: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 30, 40, 50] },
];
const PCT_OF_WHOLE_FULL = [
  { percent: 10, wholes: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200] },
  { percent: 20, wholes: [5, 10, 15, 20, 25, 30, 35, 40, 50, 100] },
  { percent: 25, wholes: [4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 60, 80, 100] },
  { percent: 50, wholes: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 30, 40, 50, 100] },
  { percent: 75, wholes: [4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 60, 80] },
];
const PCT_REVERSE = [
  { percent: 10, originals: [10, 20, 30, 40, 50, 60, 70, 80, 100, 200] },
  { percent: 20, originals: [5, 10, 15, 20, 25, 30, 40, 50, 100] },
  { percent: 25, originals: [4, 8, 12, 16, 20, 24, 40, 60, 80, 100, 200] },
  { percent: 50, originals: [2, 4, 6, 8, 10, 20, 30, 40, 50, 100] },
];
class ProcentPlugin extends BasePlugin {
  constructor() { super(); this.type = 'procent'; }
  generate(settings) {
    const grade = Math.max(settings.grade, 4);
    let qt = settings.variantType;
    if (!qt) {
      const pool = grade >= 6
        ? ['pct-to-frac', 'pct-to-dec', 'frac-to-pct', 'dec-to-pct', 'pct-of-whole', 'part-to-pct', 'reverse-pct']
        : grade >= 5
          ? ['pct-to-frac', 'pct-to-dec', 'frac-to-pct', 'dec-to-pct', 'pct-of-whole', 'part-to-pct']
          : ['pct-to-frac', 'frac-to-pct', 'pct-of-whole'];
      qt = U.pickRandom(pool);
    }
    switch (qt) {
      case 'pct-to-frac': case 'pct-to-dec': case 'frac-to-pct': case 'dec-to-pct': return this._genConvert(qt, grade);
      case 'part-to-pct': return this._genPartToPct(grade);
      case 'reverse-pct': return this._genReversePct();
      case 'pct-of-whole': default: return this._genPctOfWhole(grade);
    }
  }
  _genConvert(qt, grade) {
    const val = U.pickRandom(grade >= 5 ? PROCENT_FULL : PROCENT_SIMPLE);
    const [num, den] = val.fraction;
    const decStr = String(val.decimal).replace('.', ',');
    const fracStr = `${num}/${den}`;
    const answer = qt === 'pct-to-frac' ? fracStr : qt === 'pct-to-dec' ? decStr : `${val.percent}%`;
    const text = qt === 'pct-to-frac' ? `${val.percent}% = ? (bråkform)`
      : qt === 'pct-to-dec' ? `${val.percent}% = ? (decimalform)`
      : qt === 'frac-to-pct' ? `${fracStr} = ? %` : `${decStr} = ? %`;
    return { type: 'procent', questionType: qt, percent: val.percent, numerator: num, denominator: den, decimal: val.decimal, decStr, text, answer };
  }
  _genPctOfWhole(grade) {
    const row = U.pickRandom(grade >= 5 ? PCT_OF_WHOLE_FULL : PCT_OF_WHOLE_SIMPLE);
    const whole = U.pickRandom(row.wholes);
    return { type: 'procent', questionType: 'pct-of-whole', percent: row.percent, whole, text: `Vad är ${row.percent}% av ${whole}?`, answer: (row.percent * whole) / 100 };
  }
  _genPartToPct(grade) {
    const row = U.pickRandom(grade >= 5 ? PCT_OF_WHOLE_FULL : PCT_OF_WHOLE_SIMPLE);
    const whole = U.pickRandom(row.wholes);
    const part = (row.percent * whole) / 100;
    return { type: 'procent', questionType: 'part-to-pct', percent: row.percent, whole, part, text: `${part} av ${whole} = ? %`, answer: `${row.percent}%` };
  }
  _genReversePct() {
    const row = U.pickRandom(PCT_REVERSE);
    const orig = U.pickRandom(row.originals);
    const final_ = orig * (1 - row.percent / 100);
    return { type: 'procent', questionType: 'reverse-pct', percent: row.percent, originalPrice: orig, finalPrice: final_, text: `Priset är ${final_} kr efter ${row.percent}% rabatt. Vad var originalpriset?`, answer: `${orig} kr` };
  }
}

// ── Avrundning (åk 2–6). ─────────────────────────────────────────────────────
// Spelbara varianter: round-ten / round-hundred (numeric, otvetydiga). estimate/
// nearest porteras men exponeras ej (uppskattning ⇒ diskutabel exakthet).
class AvrundningPlugin extends BasePlugin {
  constructor() { super(); this.type = 'avrundning'; }
  generate(settings) {
    const grade = settings.grade;
    const qt = settings.variantType || U.pickRandom(this._getPool(grade));
    switch (qt) {
      case 'round-ten': return this._roundTo(grade <= 2 ? U.randInt(11, 99) : U.randInt(11, 999), 10);
      case 'round-hundred': return this._roundTo(grade <= 3 ? U.randInt(101, 999) : U.randInt(101, 9999), 100);
      case 'round-thousand': return this._roundTo(U.randInt(1001, 9999), 1000);
      case 'round-decimal': return this._roundToDecimal();
      case 'estimate-sum': return this._estimateSum(grade);
      case 'estimate-diff': return this._estimateDiff(grade);
      case 'estimate-prod': return this._estimateProd();
      case 'nearest': return this._nearestChoice(grade);
      default: return this._roundTo(U.randInt(11, 99), 10);
    }
  }
  _getPool(grade) {
    if (grade <= 2) return ['round-ten', 'nearest'];
    if (grade <= 3) return ['round-ten', 'round-hundred', 'estimate-sum', 'nearest'];
    if (grade <= 4) return ['round-ten', 'round-hundred', 'round-thousand', 'estimate-sum', 'estimate-diff'];
    return ['round-hundred', 'round-thousand', 'round-decimal', 'estimate-sum', 'estimate-diff', 'estimate-prod'];
  }
  _roundTo(num, unit) {
    const unitTxt = unit === 10 ? 'tiotal' : unit === 100 ? 'hundratal' : 'tusental';
    return { type: 'avrundning', questionType: 'round', number: num, target: unitTxt, text: `Avrunda ${num} till närmaste ${unitTxt}.`, answer: Math.round(num / unit) * unit };
  }
  _roundToDecimal() {
    const num = U.randInt(1, 99) + U.randInt(1, 9) / 10;
    return { type: 'avrundning', questionType: 'round', number: num, target: 'heltal', text: `Avrunda ${num.toFixed(1)} till närmaste heltal.`, answer: Math.round(num) };
  }
  _estimateSum(grade) {
    let a, b;
    if (grade <= 3) { a = U.randInt(12, 98); b = U.randInt(12, 98); } else { a = U.randInt(102, 998); b = U.randInt(102, 998); }
    const roundTo = grade <= 3 ? 10 : 100;
    const est = Math.round(a / roundTo) * roundTo + Math.round(b / roundTo) * roundTo;
    return { type: 'avrundning', questionType: 'estimate', expression: `${a} + ${b}`, exact: a + b, isEstimate: true, text: `Ungefär hur mycket är ${a} + ${b}?`, answer: est };
  }
  _estimateDiff(grade) {
    let a, b, est;
    const roundTo = grade <= 4 ? 10 : 100;
    for (let tries = 0; tries < 20; tries++) {
      if (grade <= 4) { a = U.randInt(50, 998); b = U.randInt(12, a - 10); } else { a = U.randInt(200, 9999); b = U.randInt(100, a - 50); }
      est = Math.round(a / roundTo) * roundTo - Math.round(b / roundTo) * roundTo;
      if (est > 0) break;
    }
    return { type: 'avrundning', questionType: 'estimate', expression: `${a} − ${b}`, isEstimate: true, text: `Ungefär hur mycket är ${a} − ${b}?`, answer: est };
  }
  _estimateProd() {
    const a = U.randInt(11, 99), b = U.randInt(3, 9);
    return { type: 'avrundning', questionType: 'estimate', expression: `${a} · ${b}`, isEstimate: true, text: `Ungefär hur mycket är ${a} · ${b}?`, answer: Math.round(a / 10) * 10 * b };
  }
  _nearestChoice(grade) {
    const target = grade <= 2 ? U.randInt(15, 85) : U.randInt(100, 900);
    const roundTo = grade <= 2 ? 10 : 100;
    const nearest = Math.round(target / roundTo) * roundTo;
    const offsets = grade <= 2 ? [-20, -10, 10, 20] : [-200, -100, 100, 200];
    const distractors = [];
    for (const off of offsets) {
      const d = nearest + off;
      if (d > 0 && d !== nearest && !distractors.includes(d)) distractors.push(d);
      if (distractors.length >= 2) break;
    }
    const choices = U.shuffle([nearest, ...distractors]);
    return { type: 'avrundning', questionType: 'nearest', target, choices, text: `Vilket tal är närmast ${target}? (${choices.join(', ')})`, answer: nearest };
  }
}

// ── Prioritetsregler (åk 2–6). Varianter: utan-parentes / med-parentes. [numeric]
class PrioritetPlugin extends BasePlugin {
  constructor() { super(); this.type = 'prioritet'; }
  generate(settings) {
    const grade = settings.grade;
    const useParens = settings.variantType === 'med-parentes' ? true
      : settings.variantType === 'utan-parentes' ? false : (grade >= 5 && rnd() < 0.5);
    const maxFactor = grade <= 3 ? 9 : grade <= 5 ? 12 : 20;
    const rawOps = settings.prioritetOps && settings.prioritetOps.length > 0 ? settings.prioritetOps : ['mult', 'div'];
    const availOps = grade < 3 ? rawOps.filter(o => o !== 'div') : rawOps;
    const ops = availOps.length > 0 ? availOps : ['mult'];
    for (let attempt = 0; attempt < 30; attempt++) {
      let expr, answer;
      const op = U.pickRandom(ops);
      if (!useParens) {
        if (op === 'mult') {
          const a = U.randInt(2, maxFactor), b = U.randInt(2, maxFactor), c = U.randInt(2, maxFactor);
          const t = U.randInt(0, 3);
          if (t === 0) { expr = `${c} + ${a} · ${b}`; answer = c + a * b; }
          else if (t === 1) { expr = `${a} · ${b} + ${c}`; answer = a * b + c; }
          else if (t === 2 && c > a * b) { expr = `${c} − ${a} · ${b}`; answer = c - a * b; }
          else if (t === 3 && a * b > c) { expr = `${a} · ${b} − ${c}`; answer = a * b - c; }
          else continue;
        } else {
          const divisor = U.randInt(2, Math.min(9, maxFactor));
          const quotient = U.randInt(2, Math.floor(maxFactor / divisor));
          const dividend = divisor * quotient;
          const c = U.randInt(2, maxFactor);
          const t = U.randInt(0, 3);
          if (t === 0) { expr = `${c} + ${dividend} ÷ ${divisor}`; answer = c + quotient; }
          else if (t === 1) { expr = `${dividend} ÷ ${divisor} + ${c}`; answer = quotient + c; }
          else if (t === 2 && c > quotient) { expr = `${c} − ${dividend} ÷ ${divisor}`; answer = c - quotient; }
          else if (t === 3 && quotient > c) { expr = `${dividend} ÷ ${divisor} − ${c}`; answer = quotient - c; }
          else continue;
        }
      } else {
        if (op === 'mult') {
          const a = U.randInt(2, maxFactor), b = U.randInt(2, maxFactor), c = U.randInt(2, maxFactor);
          const t = U.randInt(0, 3);
          if (t === 0) { expr = `(${a} + ${b}) · ${c}`; answer = (a + b) * c; }
          else if (t === 1) { expr = `${a} · (${b} + ${c})`; answer = a * (b + c); }
          else if (t === 2 && a > b) { expr = `(${a} − ${b}) · ${c}`; answer = (a - b) * c; }
          else if (t === 3 && a > b) { expr = `${c} · (${a} − ${b})`; answer = c * (a - b); }
          else continue;
        } else {
          const divisor = U.randInt(2, Math.min(9, maxFactor));
          const t = U.randInt(0, 1);
          if (t === 0) {
            const quotient = U.randInt(2, Math.floor(maxFactor * 2 / divisor));
            const sum = divisor * quotient;
            const da = U.randInt(1, sum - 1);
            expr = `(${da} + ${sum - da}) ÷ ${divisor}`; answer = quotient;
          } else {
            const quotient = U.randInt(2, Math.floor(maxFactor / divisor));
            const diff = divisor * quotient;
            const b2 = U.randInt(1, maxFactor - diff);
            const a2 = b2 + diff;
            if (a2 > maxFactor * 2) continue;
            expr = `(${a2} − ${b2}) ÷ ${divisor}`; answer = quotient;
          }
        }
      }
      if (answer !== undefined && answer > 0 && Number.isInteger(answer)) {
        return { type: 'prioritet', expression: expr, hasParentheses: useParens, text: expr, answer };
      }
    }
    return { type: 'prioritet', expression: '3 + 4 · 2', hasParentheses: false, text: '3 + 4 · 2', answer: 11 };
  }
}

// ── Öppna utsagor (åk 1–6). Varianter: add / sub / mult / div. [numeric] ─────
class OppnaUtsagaPlugin extends BasePlugin {
  constructor() { super(); this.type = 'oppna-utsaga'; }
  generate(settings) {
    const grade = settings.grade;
    const c = U.cfg(grade);
    const specificTables = settings.specificTables || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ops = ['add', 'sub'];
    if (grade >= 2) ops.push('mult');
    if (grade >= 3) ops.push('div');
    const op = settings.variantType && ops.includes(settings.variantType) ? settings.variantType : U.pickRandom(ops);
    if (op === 'add') {
      const max = Math.min(c.addMax, grade <= 2 ? 20 : grade <= 3 ? 100 : 1000);
      const total = U.randInt(3, Math.floor(max * 0.7));
      const known = U.randInt(1, total - 1);
      const e = rnd() < 0.5 ? `${known} + _ = ${total}` : `_ + ${known} = ${total}`;
      return { type: 'oppna-utsaga', expression: e, text: e, answer: total - known };
    }
    if (op === 'sub') {
      const max = Math.min(c.subMax, grade <= 2 ? 20 : grade <= 3 ? 100 : 1000);
      const a = U.randInt(4, Math.floor(max * 0.8));
      const b = U.randInt(1, a - 1);
      if (rnd() < 0.5) { const e = `${a} − _ = ${a - b}`; return { type: 'oppna-utsaga', expression: e, text: e, answer: b }; }
      const e = `_ − ${b} = ${a - b}`; return { type: 'oppna-utsaga', expression: e, text: e, answer: a };
    }
    if (op === 'mult') {
      const allMultTables = (c.multTables === 'all' ? [2, 3, 4, 5, 6, 7, 8, 9, 10] : c.multTables).filter(t => t <= 9);
      let multTables = specificTables ? allMultTables.filter(t => specificTables.includes(t)) : allMultTables;
      if (multTables.length === 0) multTables = allMultTables;
      const table = U.pickRandom(multTables);
      const factor = U.randInt(2, grade <= 3 ? 9 : 12);
      if (rnd() < 0.5) { const e = `${table} · _ = ${table * factor}`; return { type: 'oppna-utsaga', expression: e, text: e, answer: factor }; }
      const e = `_ · ${factor} = ${table * factor}`; return { type: 'oppna-utsaga', expression: e, text: e, answer: table };
    }
    const allDivTables = (c.divTables === 'all' ? [2, 3, 4, 5, 6, 7, 8, 9, 10] : (c.divTables || [2, 3, 4, 5])).filter(t => t <= 9);
    let divTables = specificTables ? allDivTables.filter(t => specificTables.includes(t)) : allDivTables;
    if (divTables.length === 0) divTables = allDivTables;
    if (!divTables || divTables.length === 0) {
      const max = Math.min(c.addMax, grade <= 2 ? 20 : grade <= 3 ? 100 : 1000);
      const total = U.randInt(3, Math.floor(max * 0.7));
      const known = U.randInt(1, total - 1);
      const e = `${known} + _ = ${total}`;
      return { type: 'oppna-utsaga', expression: e, text: e, answer: total - known };
    }
    const divisor = U.pickRandom(divTables);
    const quotient = U.randInt(2, grade <= 3 ? 9 : 12);
    const dividend = divisor * quotient;
    if (rnd() < 0.5) { const e = `${dividend} / _ = ${quotient}`; return { type: 'oppna-utsaga', expression: e, text: e, answer: divisor }; }
    const e = `_ / ${divisor} = ${quotient}`; return { type: 'oppna-utsaga', expression: e, text: e, answer: dividend };
  }
}

// ── Ekvationer (åk 3–6). Varianter: enstegs / tvastegs / geometri. [numeric] ─
class EkvationerPlugin extends BasePlugin {
  constructor() { super(); this.type = 'ekvationer'; }
  generate(settings) {
    const grade = settings.grade || 3;
    if (grade < 3) {
      const c = U.cfg(grade);
      const a = U.randInt(1, Math.floor(c.addMax * 0.6));
      const b = U.randInt(1, c.addMax - a);
      return { type: 'ekvationer', equation: `x − ${a} = ${b}`, text: `x − ${a} = ${b}`, answer: a + b };
    }
    const R = U.randInt, P = U.pickRandom;
    let mode = settings.variantType || P(grade >= 5 ? ['enstegs', 'tvastegs'] : ['enstegs']);
    if (mode === 'tvastegs' && grade < 5) mode = 'enstegs';
    if (mode === 'geometri' && grade < 4) mode = 'enstegs';
    if (mode === 'geometri') {
      const variant = P(['kvadrat-omkrets', 'kvadrat-area', 'rektangel-omkrets', 'rektangel-area']);
      if (variant === 'kvadrat-omkrets') {
        const x = R(2, 25), omkrets = 4 * x;
        const q = `Omkretsen på en kvadrat är ${omkrets} cm. Hur lång är varje sida?`;
        return { type: 'ekvationer', isGeometri: true, questionText: q, text: q, equation: `4x = ${omkrets}`, unit: 'cm', answer: x };
      }
      if (variant === 'kvadrat-area') {
        const x = R(2, 12), area = x * x;
        const q = `Arean på en kvadrat är ${area} cm². Hur lång är varje sida?`;
        return { type: 'ekvationer', isGeometri: true, questionText: q, text: q, equation: `x · x = ${area}`, unit: 'cm', answer: x };
      }
      if (variant === 'rektangel-omkrets') {
        const lang = R(5, 25), x = R(2, lang - 1), omkrets = 2 * (lang + x);
        const q = `Omkretsen på en rektangel är ${omkrets} cm. Den långa sidan är ${lang} cm. Hur lång är den korta sidan?`;
        return { type: 'ekvationer', isGeometri: true, questionText: q, text: q, equation: `2(${lang} + x) = ${omkrets}`, unit: 'cm', answer: x };
      }
      const lang = R(3, 12), x = R(2, 9), area = lang * x;
      const q = `Arean på en rektangel är ${area} cm². Den ena sidan är ${lang} cm. Hur lång är den andra sidan?`;
      return { type: 'ekvationer', isGeometri: true, questionText: q, text: q, equation: `${lang}x = ${area}`, unit: 'cm', answer: x };
    }
    if (mode === 'tvastegs') {
      const a = R(2, 9), x = R(1, grade >= 6 ? 15 : 10), b = R(1, 15);
      const sign = P(['+', '-']);
      const c = sign === '+' ? a * x + b : a * x - b;
      const eq = `${a}x ${sign} ${b} = ${c}`;
      return { type: 'ekvationer', equation: eq, text: eq, answer: x };
    }
    const op = P(['+', '-', '*', '/']);
    const maxNum = grade <= 3 ? 20 : grade <= 4 ? 50 : 100;
    if (op === '+') {
      const a = R(1, Math.floor(maxNum / 2)), x = R(1, Math.floor(maxNum / 2));
      const eq = `x + ${a} = ${a + x}`; return { type: 'ekvationer', equation: eq, text: eq, answer: x };
    }
    if (op === '-') {
      if (P(['x-a', 'a-x']) === 'x-a') {
        const a = R(1, Math.floor(maxNum / 2)), x = R(a + 1, maxNum);
        const eq = `x − ${a} = ${x - a}`; return { type: 'ekvationer', equation: eq, text: eq, answer: x };
      }
      const x = R(1, Math.floor(maxNum / 2)), a = R(x + 1, maxNum);
      const eq = `${a} − x = ${a - x}`; return { type: 'ekvationer', equation: eq, text: eq, answer: x };
    }
    if (op === '*') {
      const maxFactor = grade <= 3 ? 9 : 12;
      const a = R(2, maxFactor), x = R(2, maxFactor);
      const eq = `${a}x = ${a * x}`; return { type: 'ekvationer', equation: eq, text: eq, answer: x };
    }
    const a = R(2, grade <= 3 ? 9 : 12), b = R(2, 9);
    const eq = `x / ${a} = ${b}`; return { type: 'ekvationer', equation: eq, text: eq, answer: a * b };
  }
}

export const ARITMETIK_PLUGINS = [
  new ProcentPlugin(),
  new AvrundningPlugin(),
  new PrioritetPlugin(),
  new OppnaUtsagaPlugin(),
  new EkvationerPlugin(),
];
