// ============================================================================
// Matte­generator FAS 2 (issue #295) – visuella plugins II (INTERN modul)
// ----------------------------------------------------------------------------
// Portade ur klassrummatte: geometri, symmetri, mönster ("monster"), bråk.
// generate() porteras & enhetstestas men topicen exponeras INTE i räkna-läget:
// figur/bild krävs för att kunna besvara (mått i figuren, symmetrilinjer,
// figurmönster) eller svaret är bråkform/text. Se PLAYABLE i matte-generator.js.
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { rnd } from "./prng.js";
import { PluginUtils } from "./plugin-utils.js";
import { BasePlugin } from "./plugin-base.js";

const U = PluginUtils;

// ── Geometri (åk 1–6). ───────────────────────────────────────────────────────
const GEO_BODY_NAMES = { kub: 'Kub', cylinder: 'Cylinder', klot: 'Klot', kon: 'Kon', pyramid: 'Pyramid', ratblock: 'Rätblock' };
const GEO_CLASSIFY_NAMES = { liksidig: 'Liksidig triangel', likbent: 'Likbent triangel', ratvinklig: 'Rätvinklig triangel', oliksidig: 'Oliksidig triangel', parallellogram: 'Parallellogram', trapets: 'Trapets', romb: 'Romb', rektangel: 'Rektangel', kvadrat: 'Kvadrat' };
class GeometriPlugin extends BasePlugin {
  constructor() { super(); this.type = 'geometri'; }
  generate(settings) {
    const grade = settings.grade;
    const level = U.cfg(grade).geometry;
    const gTypes = (settings.geometriTypes && settings.geometriTypes.length > 0) ? settings.geometriTypes : ['area', 'perimeter'];
    const hasArea = gTypes.includes('area'), hasPerimeter = gTypes.includes('perimeter');
    const shapePool = [];
    if (hasArea || hasPerimeter) {
      shapePool.push('square', 'rectangle');
      if (hasArea && (level === 'with-triangle' || level === 'with-circle')) shapePool.push('triangle');
      if (level === 'with-circle') shapePool.push('circle');
    }
    if (gTypes.includes('kropp') && grade >= 3) shapePool.push('kropp');
    if (gTypes.includes('klassificering') && grade >= 4) shapePool.push('classify');
    if (gTypes.includes('vinklar') && grade >= 4) shapePool.push('angle');
    if (gTypes.includes('vinklar') && grade >= 5) shapePool.push('angle-sum', 'angle-sum-quad');
    if (gTypes.includes('volym') && grade >= 5) shapePool.push('cuboid');
    if (shapePool.length === 0) shapePool.push('square', 'rectangle');
    const shape = settings.variantType && shapePool.includes(settings.variantType) ? settings.variantType : U.pickRandom(shapePool);

    if (shape === 'classify') {
      const pool4 = ['liksidig', 'likbent', 'ratvinklig', 'rektangel', 'kvadrat'];
      const pool5 = [...pool4, 'oliksidig', 'parallellogram', 'trapets', 'romb'];
      const subShape = U.pickRandom(grade >= 5 ? pool5 : pool4);
      return { type: 'geometri', shape: 'classify', dimensions: { subShape }, geoQuestion: 'classify', text: 'Vad heter denna figur?', answer: GEO_CLASSIFY_NAMES[subShape] };
    }
    if (shape === 'angle-sum') {
      const a = U.randInt(20, 80), b = U.randInt(20, Math.min(80, 159 - a));
      return { type: 'geometri', shape: 'angle-sum', dimensions: { a, b }, geoQuestion: 'angle-sum', text: `Vinkeln A = ${a}°, vinkeln B = ${b}°. Hur stor är vinkeln C?`, answer: 180 - a - b };
    }
    if (shape === 'angle-sum-quad') {
      let a, b, c, d4;
      do { a = U.randInt(40, 150); b = U.randInt(40, 150); c = U.randInt(40, 150); d4 = 360 - a - b - c; } while (d4 < 40 || d4 > 150);
      return { type: 'geometri', shape: 'angle-sum-quad', dimensions: { a, b, c }, geoQuestion: 'angle-sum-quad', text: `A = ${a}°, B = ${b}°, C = ${c}°. Hur stor är vinkeln D?`, answer: d4 };
    }
    const maxSide = grade <= 2 ? 5 : grade <= 4 ? 20 : 50;
    const types = hasArea && hasPerimeter ? ['area', 'perimeter'] : hasArea ? ['area'] : ['perimeter'];
    if (shape === 'angle') {
      const angleType = U.pickRandom(['spetsig', 'rät', 'trubbig']);
      let degrees;
      if (angleType === 'spetsig') degrees = U.pickRandom([20, 30, 40, 45, 55, 60, 70, 80]);
      else if (angleType === 'rät') degrees = 90;
      else degrees = U.pickRandom([100, 110, 120, 130, 135, 145, 155]);
      return { type: 'geometri', shape: 'angle', dimensions: { degrees }, geoQuestion: 'identify-type', text: 'Vad är det för typ av vinkel?', answer: angleType.charAt(0).toUpperCase() + angleType.slice(1) };
    }
    if (shape === 'kropp') {
      const pool = grade >= 4 ? ['kub', 'cylinder', 'klot', 'kon', 'pyramid', 'ratblock'] : ['kub', 'cylinder', 'klot', 'kon'];
      const body = U.pickRandom(pool);
      return { type: 'geometri', shape: 'kropp', dimensions: { body }, geoQuestion: 'identify-body', text: 'Vad heter denna geometriska kropp?', answer: GEO_BODY_NAMES[body] };
    }
    if (shape === 'cuboid') {
      const l = U.randInt(2, 10), b = U.randInt(2, 10), h = U.randInt(2, 10);
      return { type: 'geometri', shape: 'cuboid', dimensions: { l, b, h }, geoQuestion: 'volume', text: `Ett rätblock är ${l} × ${b} × ${h} cm. Vad är volymen?`, answer: l * b * h };
    }
    const question = shape === 'triangle' ? 'area' : U.pickRandom(types);
    let dimensions, area, perimeter;
    if (shape === 'square') {
      const side = U.randInt(2, maxSide);
      dimensions = { side }; area = side * side; perimeter = 4 * side;
    } else if (shape === 'rectangle') {
      const minSide = Math.max(2, Math.floor(maxSide * 0.15));
      const short = U.randInt(minSide, Math.floor(maxSide * 0.6));
      const minLong = short + Math.max(1, Math.ceil(short * 0.3));
      const maxLong = Math.min(maxSide, short * 3);
      const long = U.randInt(Math.min(minLong, maxLong), maxLong);
      dimensions = { width: long, height: short }; area = long * short; perimeter = 2 * (long + short);
    } else if (shape === 'triangle') {
      const evenBase = U.randInt(2, 15) * 2, h = U.randInt(3, 20);
      dimensions = { base: evenBase, height: h }; area = (evenBase * h) / 2; perimeter = null;
    } else {
      const r = U.randInt(2, 15);
      dimensions = { radius: r }; area = parseFloat((Math.PI * r * r).toFixed(1)); perimeter = parseFloat((2 * Math.PI * r).toFixed(1));
    }
    return { type: 'geometri', shape, dimensions, geoQuestion: question, text: question === 'area' ? 'Vad är arean?' : 'Vad är omkretsen?', answer: question === 'area' ? area : perimeter };
  }
}

// ── Symmetri (åk 1–5). ───────────────────────────────────────────────────────
const SYM_POOL4 = [
  { shape: 'kvadrat', lines: 4, label: 'kvadrat' }, { shape: 'rektangel', lines: 2, label: 'rektangel' },
  { shape: 'liksidig', lines: 3, label: 'liksidig triangel' }, { shape: 'likbent', lines: 1, label: 'likbent triangel' },
  { shape: 'cirkel', lines: 0, label: 'cirkel' }, { shape: 'romb', lines: 2, label: 'romb' },
  { shape: 'trapets-sym', lines: 1, label: 'symmetrisk trapets' }, { shape: 'trapets-asym', lines: -1, label: 'trapets' },
];
const SYM_POOL5 = [
  ...SYM_POOL4,
  { shape: 'parallellogram', lines: -1, label: 'parallellogram' },
  { shape: 'oliksidig', lines: -1, label: 'oliksidig triangel' },
  { shape: 'pentagon', lines: 5, label: 'femhörning' },
];
const SYM_NEUTRAL = { kvadrat: 'kvadrat', rektangel: 'rektangel', liksidig: 'triangel', likbent: 'triangel', cirkel: 'cirkel', romb: 'romb', 'trapets-sym': 'trapets', 'trapets-asym': 'trapets', parallellogram: 'parallellogram', oliksidig: 'triangel', pentagon: 'femhörning' };
class SymmetriPlugin extends BasePlugin {
  constructor() { super(); this.type = 'symmetri'; }
  generate(settings) {
    const grade = settings.grade;
    const pool = grade >= 5 ? SYM_POOL5 : SYM_POOL4;
    const nonSymPool = pool.filter(f => f.lines === -1);
    const symPool = pool.filter(f => f.lines !== -1);
    const wantIdentify = settings.variantType === 'identify-non-sym';
    const wantCount = settings.variantType === 'count';
    if (!wantCount && nonSymPool.length > 0 && symPool.length >= 2 && (wantIdentify || rnd() < 0.3)) {
      const shuffledSym = U.shuffle(symPool);
      const nonSym = U.pickRandom(nonSymPool);
      const trio = U.shuffle([shuffledSym[0], shuffledSym[1], nonSym]);
      const neutral = s => SYM_NEUTRAL[s.shape] || s.label;
      return { type: 'symmetri', questionType: 'identify-non-sym', shapes: trio.map(f => f.shape), labels: trio.map(neutral), correctIndex: trio.indexOf(nonSym), shape: nonSym.shape, text: 'Vilken figur är inte symmetrisk?', answer: neutral(nonSym) };
    }
    const item = U.pickRandom(pool);
    const answer = item.lines === 0 ? 'Oändligt många' : item.lines === -1 ? '0' : String(item.lines);
    return { type: 'symmetri', questionType: 'count', shape: item.shape, label: item.label, lines: item.lines, text: `Hur många symmetrilinjer har en ${item.label}?`, answer };
  }
}

// ── Mönster ("monster", åk 1–4). ─────────────────────────────────────────────
const MONSTER_SHAPES = ['cirkel', 'kvadrat', 'triangel', 'stjarna', 'romb', 'hjarta'];
const MONSTER_COLORS = ['röd', 'blå', 'grön', 'gul', 'orange', 'lila'];
class MonsterPlugin extends BasePlugin {
  constructor() { super(); this.type = 'monster'; }
  generate(settings) {
    const grade = settings.grade;
    let qt = settings.variantType;
    if (!qt) {
      if (grade <= 2) qt = rnd() < 0.5 ? 'repeat-shape' : 'repeat-color';
      else if (grade <= 4) qt = U.pickRandom(['repeat-shape', 'repeat-color', 'growing']);
      else qt = rnd() < 0.3 ? 'repeat-shape' : 'growing';
    }
    if (qt === 'growing') return this._genGrowing();
    if (qt === 'repeat-color') return this._buildRepeat('color', grade);
    return this._buildRepeat('shape', grade);
  }
  _pickPattern(pool, patternLen) {
    const available = pool.slice();
    const picked = [];
    for (let i = 0; i < patternLen; i++) picked.push(available.splice(Math.floor(rnd() * available.length), 1)[0]);
    return picked;
  }
  _buildRepeat(kind, grade) {
    const patternLen = grade <= 1 ? 2 : U.pickRandom([2, 3]);
    const reps = 3;
    const idxOpts = len => [len - 1, reps * patternLen, reps * patternLen + Math.min(1, patternLen - 1)];
    if (kind === 'shape') {
      const shapes = this._pickPattern(MONSTER_SHAPES, patternLen);
      const color = U.pickRandom(MONSTER_COLORS);
      const full = [];
      for (let r = 0; r < reps; r++) for (let s = 0; s < patternLen; s++) full.push({ shape: shapes[s], color });
      for (let s = 0; s < patternLen; s++) full.push({ shape: shapes[s], color });
      const questionIdx = U.pickRandom(idxOpts(full.length));
      return { type: 'monster', questionType: 'repeat-shape', sequence: full.map((it, i) => ({ shape: it.shape, color: it.color, hidden: i === questionIdx })), text: 'Vilken figur saknas i mönstret?', answer: full[questionIdx].shape };
    }
    const colors = this._pickPattern(MONSTER_COLORS, patternLen);
    const shape = U.pickRandom(MONSTER_SHAPES);
    const full = [];
    for (let r = 0; r < reps; r++) for (let c = 0; c < patternLen; c++) full.push({ shape, color: colors[c] });
    for (let c = 0; c < patternLen; c++) full.push({ shape, color: colors[c] });
    const questionIdx = U.pickRandom(idxOpts(full.length));
    return { type: 'monster', questionType: 'repeat-color', sequence: full.map((it, i) => ({ shape: it.shape, color: it.color, hidden: i === questionIdx })), text: 'Vilken färg saknas i mönstret?', answer: full[questionIdx].color };
  }
  _genGrowing() {
    const shape = U.pickRandom(MONSTER_SHAPES);
    const color = U.pickRandom(MONSTER_COLORS);
    const step = U.pickRandom([1, 2]);
    const start = step === 1 ? 1 : U.pickRandom([1, 2]);
    const groups = [];
    for (let i = 0; i < 4; i++) groups.push(start + i * step);
    return { type: 'monster', questionType: 'growing', shape, color, step, groups: groups.slice(0, 3), text: 'Hur många figurer ska det vara i nästa grupp?', answer: groups[3] };
  }
}

// ── Bråk (åk 3–6). ───────────────────────────────────────────────────────────
const FRACTION_NAMES = {
  '1/2': 'en halv', '1/3': 'en tredjedel', '2/3': 'två tredjedelar', '1/4': 'en fjärdedel', '3/4': 'tre fjärdedelar',
  '1/5': 'en femtedel', '2/5': 'två femtedelar', '3/5': 'tre femtedelar', '4/5': 'fyra femtedelar', '1/6': 'en sjättedel', '5/6': 'fem sjättedelar',
};
class BrakPlugin extends BasePlugin {
  constructor() { super(); this.type = 'brak'; }
  generate(settings) {
    const level = U.cfg(settings.grade).fractions;
    let pool;
    if (!level) pool = ['name'];
    else if (level === 'intro') pool = ['name', 'order-same-den', 'order-diff-den'];
    else if (level === 'same-den') pool = ['name', 'order-same-den', 'order-diff-den', 'add-same-den', 'sub-same-den', 'compare', 'simplify', 'fraction-of-whole'];
    else if (level === 'diff-den') pool = ['name', 'order-same-den', 'order-diff-den', 'add-same-den', 'sub-same-den', 'add-diff-den', 'sub-diff-den', 'compare', 'simplify', 'fraction-of-whole'];
    else pool = ['name', 'order-same-den', 'order-diff-den', 'add-same-den', 'sub-same-den', 'add-diff-den', 'sub-diff-den', 'compare', 'simplify', 'fraction-of-whole', 'to-mixed'];
    const qt = settings.variantType && pool.includes(settings.variantType) ? settings.variantType : U.pickRandom(pool);
    if (qt === 'order-same-den' || qt === 'order-diff-den') return this._genOrder(qt, settings.grade);
    return this._genByType(qt);
  }
  _genOrder(type, grade) {
    const count = grade <= 3 ? 3 : grade <= 5 ? 4 : 5;
    let picked;
    if (type === 'order-same-den') {
      const den = U.pickRandom([4, 5, 6, 8, 10].filter(d => d > count));
      picked = U.shuffle(Array.from({ length: den - 1 }, (_, i) => i + 1)).slice(0, count).map(n => [n, den]);
    } else if (grade <= 3) {
      const families = [
        [[1, 2], [1, 4], [3, 4]],
        [[1, 2], [1, 6], [5, 6]],
        [[1, 3], [2, 3], [1, 6], [5, 6]],
        [[1, 4], [3, 4], [1, 8], [3, 8], [5, 8], [7, 8]],
        [[1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10]],
      ];
      picked = U.shuffle(U.pickRandom(families)).slice(0, count);
    } else {
      const fracPool = grade <= 5
        ? [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6]]
        : [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8], [1, 10], [3, 10], [7, 10]];
      picked = U.shuffle(fracPool).slice(0, count);
    }
    const sorted = [...picked].sort((a, b) => a[0] / a[1] - b[0] / b[1]);
    let display = U.shuffle(picked);
    let tries = 0;
    while (tries++ < 8 && display.every((f, i) => f[0] === sorted[i][0] && f[1] === sorted[i][1])) display = U.shuffle(picked);
    return {
      type: 'brak', questionType: type,
      fractions: display.map(([n, d]) => ({ numerator: n, denominator: d })),
      sortedFractions: sorted.map(([n, d]) => ({ numerator: n, denominator: d })),
      text: `Ordna i storleksordning (minst först): ${display.map(([n, d]) => `${n}/${d}`).join(', ')}`,
      answer: sorted.map(([n, d]) => `${n}/${d}`).join(' < '),
    };
  }
  _genByType(qt) {
    switch (qt) {
      case 'add-same-den': return this._genAddSubSameDen('+');
      case 'sub-same-den': return this._genAddSubSameDen('-');
      case 'compare': return this._genCompare();
      case 'add-diff-den': return this._genAddSubDiffDen('+');
      case 'sub-diff-den': return this._genAddSubDiffDen('-');
      case 'fraction-of-whole': return this._genFractionOfWhole();
      case 'simplify': return this._genSimplify();
      case 'to-mixed': return this._genToMixed();
      default: return this._genName();
    }
  }
  _genName() {
    const [num, den] = U.pickRandom([[1, 2], [1, 4], [3, 4], [1, 3], [2, 3], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6]]);
    const fracKey = `${num}/${den}`;
    const wordName = FRACTION_NAMES[fracKey];
    const nameStyle = U.pickRandom(['frac-to-word', 'word-to-frac']);
    const text = nameStyle === 'word-to-frac' ? `Skriv "${wordName}" i bråkform.` : `Vad heter bråket ${fracKey} i ord?`;
    return { type: 'brak', questionType: 'name', nameStyle, numerator: num, denominator: den, wordName, text, answer: nameStyle === 'word-to-frac' ? fracKey : wordName };
  }
  _genAddSubSameDen(op) {
    const den = U.pickRandom([2, 3, 4, 5, 6, 8, 10]);
    let a, b;
    if (op === '+') { a = U.randInt(1, Math.max(1, den - 2)); b = U.randInt(1, den - a); }
    else { a = U.randInt(2, den - 1); b = U.randInt(1, a - 1); }
    const resultNum = op === '+' ? a + b : a - b;
    const qt = op === '+' ? 'add-same-den' : 'sub-same-den';
    const opSym = op === '+' ? '+' : '−';
    return { type: 'brak', questionType: qt, a, b, denominator: den, text: `${a}/${den} ${opSym} ${b}/${den} = ?`, answer: `${resultNum}/${den}` };
  }
  _genCompare() {
    const dens = [2, 3, 4, 5, 6, 8, 10];
    let num1, den1, num2, den2, attempts = 0;
    do { den1 = U.pickRandom(dens); den2 = U.pickRandom(dens); num1 = U.randInt(1, den1 - 1); num2 = U.randInt(1, den2 - 1); attempts++; }
    while (num1 * den2 === num2 * den1 && attempts < 20);
    const answer = num1 * den2 > num2 * den1 ? `${num1}/${den1}` : `${num2}/${den2}`;
    return { type: 'brak', questionType: 'compare', a: { numerator: num1, denominator: den1 }, b: { numerator: num2, denominator: den2 }, text: `Vilket bråk är störst: ${num1}/${den1} eller ${num2}/${den2}?`, answer };
  }
  _genAddSubDiffDen(op) {
    const dens = [2, 3, 4, 5, 6, 8, 10];
    let den1, den2, num1, num2, attempts = 0;
    do { den1 = U.pickRandom(dens); den2 = U.pickRandom(dens.filter(d => d !== den1)); num1 = U.randInt(1, den1 - 1); num2 = U.randInt(1, den2 - 1); attempts++; }
    while (op === '-' && num1 * den2 <= num2 * den1 && attempts < 20);
    const LCD = U.lcm(den1, den2);
    const ansN = op === '+' ? num1 * (LCD / den1) + num2 * (LCD / den2) : num1 * (LCD / den1) - num2 * (LCD / den2);
    const g = U.gcd(Math.abs(ansN), LCD);
    const rN = ansN / g, rD = LCD / g;
    const answer = rD === 1 ? `${rN}` : `${rN}/${rD}`;
    const qt = op === '+' ? 'add-diff-den' : 'sub-diff-den';
    const opSym = op === '+' ? '+' : '−';
    return { type: 'brak', questionType: qt, a: { numerator: num1, denominator: den1 }, b: { numerator: num2, denominator: den2 }, text: `${num1}/${den1} ${opSym} ${num2}/${den2} = ?`, answer };
  }
  _genFractionOfWhole() {
    const options = [
      { num: 1, den: 2, multiples: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
      { num: 1, den: 3, multiples: [3, 6, 9, 12, 15, 18, 21] },
      { num: 2, den: 3, multiples: [3, 6, 9, 12, 15, 18, 21] },
      { num: 1, den: 4, multiples: [4, 8, 12, 16, 20, 24] },
      { num: 3, den: 4, multiples: [4, 8, 12, 16, 20, 24] },
      { num: 1, den: 5, multiples: [5, 10, 15, 20, 25, 30] },
      { num: 2, den: 5, multiples: [5, 10, 15, 20, 25, 30] },
      { num: 3, den: 5, multiples: [5, 10, 15, 20, 25, 30] },
    ];
    const opt = U.pickRandom(options);
    const whole = U.pickRandom(opt.multiples);
    return { type: 'brak', questionType: 'fraction-of-whole', numerator: opt.num, denominator: opt.den, whole, text: `Vad är ${opt.num}/${opt.den} av ${whole}?`, answer: String((opt.num * whole) / opt.den) };
  }
  _genSimplify() {
    const [num, den] = U.pickRandom([
      [2, 4], [2, 6], [2, 8], [2, 10], [3, 6], [3, 9], [3, 12], [4, 6], [4, 8], [4, 10], [4, 12],
      [5, 10], [5, 15], [5, 20], [6, 8], [6, 9], [6, 10], [6, 12], [8, 10], [8, 12],
    ]);
    const g = U.gcd(num, den);
    return { type: 'brak', questionType: 'simplify', numerator: num, denominator: den, text: `Förenkla ${num}/${den}.`, answer: `${num / g}/${den / g}` };
  }
  _genToMixed() {
    const den = U.pickRandom([2, 3, 4, 5, 6, 8]);
    const wholes = U.randInt(1, 2);
    const rem = U.randInt(1, den - 1);
    return { type: 'brak', questionType: 'to-mixed', numerator: wholes * den + rem, denominator: den, text: `Skriv ${wholes * den + rem}/${den} som blandat tal.`, answer: `${wholes} ${rem}/${den}` };
  }
}

export const GEOMETRI_PLUGINS = [
  new GeometriPlugin(),
  new SymmetriPlugin(),
  new MonsterPlugin(),
  new BrakPlugin(),
];
