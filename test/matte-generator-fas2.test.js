// ============================================================================
// Enhetstest för matte­generator FAS 2 (issue #295).
// ----------------------------------------------------------------------------
// LÄRDOM (talsorter live-bugg): varje genererad uppgift MÅSTE ha exakt ETT
// otvetydigt rätt svar. Detta test räknar OBEROENDE fram facit ur problemets
// egna fält – för VARJE portat topic + variant, över många frön – och jämför med
// adapterns answer. Dessutom: determinism (samma seed → samma resultat) och att
// answerType stämmer med svarets form.
//
//   node --test test/matte-generator-fas2.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateProblem, listAllTopics, listAllVariants,
  listTopics, listVariants, topicAnswerType, isTopicPlayable,
} from "../src/matte-generator.js";

// --- Hjälpare ---------------------------------------------------------------

const PLACE_NAMES = ['ental', 'tiotal', 'hundratal', 'tusental'];
const UNIT_VOL = { ml: 1, cl: 10, dl: 100, l: 1000 };

/** Tolka ett tal som kan ha svensk decimalkomma. */
function num(x) { return Number(String(x).replace(',', '.')); }

/** Tolka "a/b", "n a/b" (blandat) eller heltal → decimalvärde. */
function fracVal(s) {
  s = String(s).trim();
  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  if (s.includes('/')) { const [n, d] = s.split('/').map(Number); return n / d; }
  return Number(s);
}

/** Oberoende arab→romersk (egen kopia, matchar plugin). */
function toRoman(n) {
  const MAP = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = ''; for (const [v, r] of MAP) while (n >= v) { s += r; n -= v; } return s;
}
function romanToArabic(r) {
  const V = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const cur = V[r[i]], next = V[r[i + 1]];
    total += next > cur ? -cur : cur;
  }
  return total;
}

/** Säker uttrycks-eval: byt matte-symboler mot JS-operatorer, tillåt bara siffror/operatorer. */
function evalMath(expr) {
  const js = expr.replace(/·|×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!/^[-+*/(). \d]+$/.test(js)) throw new Error(`osäkert uttryck: ${expr}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${js});`)();
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const SYM_LINES = { kvadrat: 4, rektangel: 2, liksidig: 3, likbent: 1, cirkel: 0, romb: 2, 'trapets-sym': 1, 'trapets-asym': -1, parallellogram: -1, oliksidig: -1, pentagon: 5 };
const GEO_BODY = { kub: 'Kub', cylinder: 'Cylinder', klot: 'Klot', kon: 'Kon', pyramid: 'Pyramid', ratblock: 'Rätblock' };
const GEO_CLASSIFY = { liksidig: 'Liksidig triangel', likbent: 'Likbent triangel', ratvinklig: 'Rätvinklig triangel', oliksidig: 'Oliksidig triangel', parallellogram: 'Parallellogram', trapets: 'Trapets', romb: 'Romb', rektangel: 'Rektangel', kvadrat: 'Kvadrat' };

// --- Oberoende facit-verifiering per topic ----------------------------------
// Returnerar true om answer stämmer mot problemets egna fält. Kastar/false vid fel.

function verify(topic, res) {
  const p = res.problem;
  const a = res.answer;
  switch (topic) {
    case 'talsorter':
      return a === PLACE_NAMES[p.digitPosition]
        && p.targetDigit === Math.floor(p.number / Math.pow(10, p.digitPosition)) % 10;

    case 'tallinje': {
      const j = p.display.findIndex(v => v !== null);
      const base = p.display[j] - j * p.step;
      const missIdx = p.display.findIndex(v => v === null);
      // alla synliga ska ligga på följden, och svaret fylla luckan
      return p.display.every((v, i) => v === null || v === base + i * p.step)
        && a === base + missIdx * p.step;
    }

    case 'talfoljd': {
      const seq = p.sequence;
      const diffs = seq.slice(1).map((v, i) => v - seq[i]);
      const ratios = seq.slice(1).map((v, i) => v / seq[i]);
      const isArith = diffs.every(d => d === diffs[0]);
      const isGeo = ratios.every(r => r === ratios[0]);
      if (!isArith && !isGeo) return false;
      if (p.questionType === 'next') {
        return a === (isArith ? seq[seq.length - 1] + diffs[0] : seq[seq.length - 1] * ratios[0]);
      }
      if (p.questionType === 'missing') {
        const idx = p.display.findIndex(v => v === null);
        return a === seq[idx] && p.display.every((v, i) => v === null || v === seq[i]);
      }
      // rule: "op value" – applicera och verifiera följden
      const [op, valStr] = String(a).split(' ');
      const val = Number(valStr);
      return seq.slice(1).every((v, i) => {
        if (op === '+') return v === seq[i] + val;
        if (op === '−') return v === seq[i] - val;
        return v === seq[i] * val;
      });
    }

    case 'negativa-tal':
      if (p.questionType === 'temp') return a === (p.dir === 'stiger' ? p.start + p.change : p.start - p.change);
      if (p.questionType === 'add-sub') return a === (p.op === '+' ? p.a + p.b : p.a - p.b);
      return a === p.value;

    case 'romerska':
      if (p.questionType === 'arabic-to-roman') return a === toRoman(p.number) && a === p.roman;
      return a === romanToArabic(p.roman) && a === p.number;

    case 'procent':
      if (p.questionType === 'pct-of-whole') return a === (p.percent * p.whole) / 100;
      if (p.questionType === 'part-to-pct') return a === `${p.percent}%` && p.part === (p.percent * p.whole) / 100;
      if (p.questionType === 'pct-to-frac') return a === `${p.numerator}/${p.denominator}` && Math.abs(fracVal(a) - p.percent / 100) < 1e-9;
      if (p.questionType === 'pct-to-dec') return Math.abs(num(a) - p.percent / 100) < 1e-9;
      if (p.questionType === 'frac-to-pct' || p.questionType === 'dec-to-pct') return a === `${p.percent}%`;
      if (p.questionType === 'reverse-pct') return a === `${p.originalPrice} kr` && Math.abs(p.finalPrice - p.originalPrice * (1 - p.percent / 100)) < 1e-9;
      return false;

    case 'avrundning':
      if (p.questionType === 'round') {
        const unit = p.target === 'tiotal' ? 10 : p.target === 'hundratal' ? 100 : p.target === 'tusental' ? 1000 : 1;
        return a === Math.round(p.number / unit) * unit;
      }
      if (p.questionType === 'estimate') {
        // est = avrundade termer, avrundning 10 eller 100 (grade-beroende)
        const nums = p.expression.match(/\d+/g).map(Number);
        const cands = [];
        for (const rt of [10, 100]) {
          if (p.expression.includes('+')) cands.push(Math.round(nums[0] / rt) * rt + Math.round(nums[1] / rt) * rt);
          else if (p.expression.includes('−')) cands.push(Math.round(nums[0] / rt) * rt - Math.round(nums[1] / rt) * rt);
          else cands.push(Math.round(nums[0] / rt) * rt * nums[1]);
        }
        return cands.includes(a);
      }
      // nearest
      return [10, 100].some(rt => a === Math.round(p.target / rt) * rt) && p.choices.includes(a);

    case 'prioritet':
      return a === evalMath(p.expression);

    case 'oppna-utsaga': {
      const filled = p.expression.replace('_', `(${a})`);
      const [lhs, rhs] = filled.split('=');
      return evalMath(lhs) === evalMath(rhs);
    }

    case 'ekvationer': {
      let eq = p.equation.replace(/·|×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      eq = eq.replace(/(\d)\s*\(/g, '$1*(');          // 2( → 2*(
      eq = eq.replace(/(\d)x/g, `$1*(${a})`);          // 4x → 4*(ans)
      eq = eq.replace(/x/g, `(${a})`);                 // ensam x
      const [lhs, rhs] = eq.split('=');
      return Math.abs(evalMath(lhs) - evalMath(rhs)) < 1e-9;
    }

    case 'matt-langd': case 'matt-vikt': case 'matt-tid': case 'matt-area':
      return Math.abs(a - p.conversion.from * p.conversion.factor) < 1e-3;

    case 'matt-volym':
      if (p.questionType === 'convert') return Math.abs(a - p.conversion.from * p.conversion.factor) < 1e-3;
      if (p.questionType === 'addition') return a === p.a + p.b;
      if (p.questionType === 'subtraction') return a === p.a - p.b;
      // open: balansera i basenheter (ml=1..l=1000)
      {
        let e = p.expression.replace(/(\d+)\s*(ml|cl|dl|l)\b/g, (_, n, u) => `(${Number(n) * UNIT_VOL[u]})`);
        e = e.replace('_', `(${a * UNIT_VOL[p.blankUnit]})`).replace(/−/g, '-');
        const [lhs, rhs] = e.split('=');
        return Math.abs(evalMath(lhs) - evalMath(rhs)) < 1e-6;
      }

    case 'sannolikhet':
      if (p.questionType === 'frac') return Math.abs(fracVal(a) - p.red / p.total) < 1e-9;
      return typeof a === 'string' && a.length > 0;

    case 'statistik': {
      const vals = p.items.map(d => d.value);
      if (p.questionType === 'read-val') return vals.map(String).includes(a);
      if (p.questionType === 'most') return p.items.find(d => d.label === a).value === Math.max(...vals);
      if (p.questionType === 'least') return p.items.find(d => d.label === a).value === Math.min(...vals);
      if (p.questionType === 'diff') { const s = [...vals].sort((x, y) => y - x); return num(a) === s[0] - s[1]; }
      if (p.questionType === 'mean') return num(a) === parseFloat((vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(1));
      if (p.questionType === 'mode') { const f = {}; vals.forEach(v => f[v] = (f[v] || 0) + 1); return f[num(a)] === Math.max(...Object.values(f)); }
      if (p.questionType === 'median') { const s = [...vals].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return num(a) === (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); }
      return true;
    }

    case 'koordinatsystem': {
      const t = p.points[p.targetIdx];
      return a === `(${t.x}, ${t.y})`;
    }

    case 'klocka': {
      const pad = n => String(n).padStart(2, '0');
      if (p.questionType === 'read') return a === `${pad(p.hours)}:${pad(p.minutes)}`;
      if (p.questionType === 'add-minutes') {
        const tot = p.hours * 60 + p.minutes + p.minutesToAdd;
        return a === `${pad(Math.floor(tot / 60) % 12 || 12)}:${pad(tot % 60)}`;
      }
      // diff: rekonstruera svarssträngen ur diff
      const h = Math.floor(p.diff / 60), m = p.diff % 60;
      let exp;
      if (h === 0) exp = `${m} minuter`;
      else if (m === 0) exp = h === 1 ? '1 timme' : `${h} timmar`;
      else exp = h === 1 ? `1 timme och ${m} minuter` : `${h} timmar och ${m} minuter`;
      return a === exp;
    }

    case 'geometri': {
      const d = p.dimensions;
      switch (p.geoQuestion) {
        case 'area':
          if (p.shape === 'square') return a === d.side * d.side;
          if (p.shape === 'rectangle') return a === d.width * d.height;
          if (p.shape === 'triangle') return a === (d.base * d.height) / 2;
          if (p.shape === 'circle') return a === parseFloat((Math.PI * d.radius * d.radius).toFixed(1));
          return false;
        case 'perimeter':
          if (p.shape === 'square') return a === 4 * d.side;
          if (p.shape === 'rectangle') return a === 2 * (d.width + d.height);
          if (p.shape === 'circle') return a === parseFloat((2 * Math.PI * d.radius).toFixed(1));
          return false;
        case 'volume': return a === d.l * d.b * d.h;
        case 'angle-sum': return a === 180 - d.a - d.b;
        case 'angle-sum-quad': return a === 360 - d.a - d.b - d.c;
        case 'classify': return a === GEO_CLASSIFY[d.subShape];
        case 'identify-body': return a === GEO_BODY[d.body];
        case 'identify-type': {
          const deg = d.degrees;
          const exp = deg < 90 ? 'Spetsig' : deg === 90 ? 'Rät' : 'Trubbig';
          return a === exp;
        }
        default: return false;
      }
    }

    case 'symmetri':
      if (p.questionType === 'identify-non-sym') return SYM_LINES[p.shapes[p.correctIndex]] === -1;
      return a === (p.lines === 0 ? 'Oändligt många' : p.lines === -1 ? '0' : String(p.lines));

    case 'monster': {
      if (p.questionType === 'growing') {
        const step = p.groups[1] - p.groups[0];
        return p.groups.every((g, i) => g === p.groups[0] + i * step) && a === p.groups[2] + step;
      }
      const seq = p.sequence;
      const patternLen = seq.length / 4;
      const key = p.questionType === 'repeat-shape' ? 'shape' : 'color';
      const hiddenIdx = seq.findIndex(s => s.hidden);
      const periodic = seq.every((s, i) => s[key] === seq[i % patternLen][key]);
      return periodic && a === seq[hiddenIdx][key];
    }

    case 'brak': {
      const q = p.questionType;
      if (q === 'name') return p.nameStyle === 'word-to-frac' ? a === `${p.numerator}/${p.denominator}` : a === p.wordName;
      if (q === 'add-same-den') return a === `${p.a + p.b}/${p.denominator}`;
      if (q === 'sub-same-den') return a === `${p.a - p.b}/${p.denominator}`;
      if (q === 'fraction-of-whole') return num(a) === (p.numerator * p.whole) / p.denominator;
      if (q === 'compare') { const va = p.a.numerator / p.a.denominator, vb = p.b.numerator / p.b.denominator; return Math.abs(fracVal(a) - Math.max(va, vb)) < 1e-9; }
      if (q === 'simplify') { const g = gcd(p.numerator, p.denominator); return a === `${p.numerator / g}/${p.denominator / g}`; }
      if (q === 'to-mixed') { const [w, f] = a.split(' '); const [rn, rd] = f.split('/').map(Number); return Number(w) * rd + rn === p.numerator && rd === p.denominator; }
      if (q === 'add-diff-den' || q === 'sub-diff-den') {
        const va = p.a.numerator / p.a.denominator, vb = p.b.numerator / p.b.denominator;
        return Math.abs(fracVal(a) - (q === 'add-diff-den' ? va + vb : va - vb)) < 1e-9;
      }
      if (q === 'order-same-den' || q === 'order-diff-den') {
        const parts = a.split(' < ').map(fracVal);
        const sortedOk = parts.every((v, i) => i === 0 || parts[i - 1] <= v);
        // display ska vara samma multimängd som sorterad svarslista
        const dispKeys = p.fractions.map(f => `${f.numerator}/${f.denominator}`).sort();
        const ansKeys = a.split(' < ').sort();
        return sortedOk && JSON.stringify(dispKeys) === JSON.stringify(ansKeys);
      }
      return false;
    }

    default:
      return false;
  }
}

// De fyra fas 1-topics har egen facit-verifiering i matte-generator.test.js.
const FAS1 = new Set(['addition', 'subtraktion', 'multiplikation', 'division']);
const FAS2_TOPICS = listAllTopics().filter(t => !FAS1.has(t));

// --- 1. Facit stämmer (oberoende) för VARJE topic + variant, över många frön -

for (const topic of FAS2_TOPICS) {
  for (const variant of listAllVariants(topic)) {
    test(`facit stämmer: ${topic}/${variant}`, () => {
      for (let seed = 0; seed < 120; seed++) {
        const res = generateProblem(topic, { variant }, seed);
        assert.equal(res.variant, variant, `variant-eko seed ${seed}`);
        assert.ok(res.answer !== undefined && res.answer !== null && res.answer !== '',
          `${topic}/${variant} seed ${seed}: svar saknas`);
        assert.ok(
          verify(topic, res),
          `fel/otvetydigt facit ${topic}/${variant} seed ${seed}: ` +
          `problem=${JSON.stringify(res.problem)} answer=${JSON.stringify(res.answer)}`
        );
      }
    });
  }
}

// --- 2. Determinism: samma (topic, settings, seed) → identiskt resultat ------

test("determinism för alla fas 2-topics/varianter", () => {
  for (const topic of FAS2_TOPICS) {
    for (const variant of listAllVariants(topic)) {
      for (const seed of [0, 1, 7, 123, 9999]) {
        const a = generateProblem(topic, { variant }, seed);
        const b = generateProblem(topic, { variant }, seed);
        assert.deepEqual(a, b, `${topic}/${variant} seed ${seed} ej reproducerbart`);
      }
    }
  }
});

// --- 3. Variation: olika frön ger olika uppgifter (PRNG verkligen seedad) ----

test("olika frön ger variation för fas 2-topics", () => {
  for (const topic of FAS2_TOPICS) {
    for (const variant of listAllVariants(topic)) {
      // Signaturen = hela uppgiften (problem + svar). Några icke-spelbara
      // varianter har konstant frågetext men varierande figurer/värden (t.ex.
      // symmetri/ej-symmetrisk: bara en icke-symmetrisk figur i åk 4, men trion
      // som visas varierar), så hela problemet är rätt mått på variation.
      const sigs = new Set();
      for (let seed = 0; seed < 40; seed++) {
        const r = generateProblem(topic, { variant }, seed);
        sigs.add(`${JSON.stringify(r.problem)}|${JSON.stringify(r.answer)}`);
      }
      assert.ok(sigs.size > 1, `${topic}/${variant}: ingen variation (${sigs.size})`);
    }
  }
});

// --- 4. answerType stämmer med svarets form ---------------------------------

test("spelbara topics ger numeriskt svar; answerType satt på problemet", () => {
  for (const topic of listTopics()) {
    for (const variant of listVariants(topic)) {
      const res = generateProblem(topic, { variant }, 3);
      assert.equal(res.problem.answerType, 'numeric', `${topic}/${variant} borde vara numeric`);
      assert.equal(typeof res.answer, 'number');
      assert.ok(Number.isFinite(res.answer));
      assert.ok(!('answer' in res.problem), `${topic}: answer läckte in i problem`);
      assert.equal(typeof res.problem.text, 'string');
      assert.ok(res.problem.text.length > 0);
    }
  }
});

test("icke-spelbara topics är korrekt markerade (answerType != numeric ELLER ej surfade)", () => {
  const surfaced = new Set(listTopics());
  for (const topic of FAS2_TOPICS) {
    if (surfaced.has(topic)) {
      assert.ok(isTopicPlayable(topic), `${topic} surfas men är ej markerat spelbart`);
      assert.equal(topicAnswerType(topic), 'numeric');
    } else {
      assert.ok(!isTopicPlayable(topic), `${topic} surfas ej men markerat spelbart`);
    }
  }
});
