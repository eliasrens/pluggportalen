// ============================================================================
// Matte­generator FAS 2 (issue #295) – visuella plugins I (INTERN modul)
// ----------------------------------------------------------------------------
// Portade ur klassrummatte: sannolikhet, statistik, koordinatsystem, klocka.
// generate() porteras & enhetstestas (svaret stämmer + reproducerbart) men
// topicen exponeras INTE i räkna-läget: uppgifterna kräver visuell rendering
// (kulpåse, stapeldiagram, rutnät, urtavla) eller ger icke-numeriska svar.
// Se PLAYABLE i matte-generator.js.
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { PluginUtils } from "./plugin-utils.js";
import { BasePlugin } from "./plugin-base.js";

const U = PluginUtils;

// ── Sannolikhet (åk 5–6). ────────────────────────────────────────────────────
class SannolikhetPlugin extends BasePlugin {
  constructor() { super(); this.type = 'sannolikhet'; }
  generate(settings) {
    const qt = settings.variantType || U.pickRandom(['frac', 'frac', 'word', 'compare']);
    if (qt === 'word') return this._genWord();
    if (qt === 'compare') return this._genCompare();
    return this._genFrac();
  }
  _genFrac() {
    const total = U.pickRandom([6, 8, 10, 12]);
    const red = U.randInt(1, total - 1);
    const blue = total - red;
    const g = U.gcd(red, total);
    const answer = red === total ? '1' : g > 1 ? `${red / g}/${total / g}` : `${red}/${total}`;
    return { type: 'sannolikhet', questionType: 'frac', red, blue, total, text: `Påsen har ${red} röda och ${blue} blå kulor. Hur sannolikt är det att du drar en röd kula?`, answer };
  }
  _genWord() {
    const scenarios = [
      { text: 'En tärning visar 7.', answer: 'Omöjligt' },
      { text: 'En tärning visar ett tal under 7.', answer: 'Säkert' },
      { text: 'Kasta krona med ett mynt.', answer: 'Lika sannolikt' },
      { text: 'En tärning visar en 6.', answer: 'Osannolikt' },
      { text: 'En tärning visar ett jämnt tal.', answer: 'Lika sannolikt' },
      { text: 'Du drar en röd kula ur en påse med 9 röda och 1 blå.', answer: 'Sannolikt' },
      { text: 'Du drar en blå kula ur en påse med 9 röda och 1 blå.', answer: 'Osannolikt' },
      { text: 'En tärning visar mer än 1.', answer: 'Sannolikt' },
      { text: 'En tärning visar 0.', answer: 'Omöjligt' },
    ];
    const s = U.pickRandom(scenarios);
    return { type: 'sannolikhet', questionType: 'word', text: s.text, answer: s.answer };
  }
  _genCompare() {
    const pairs = [
      { a: { label: 'Tärningen visar en 6', red: 1, total: 6 }, b: { label: 'Tärningen visar ett jämnt tal', red: 3, total: 6 }, answer: 'Tärningen visar ett jämnt tal' },
      { a: { label: '3 röda av 10 kulor', red: 3, total: 10 }, b: { label: '7 röda av 10 kulor', red: 7, total: 10 }, answer: '7 röda av 10 kulor' },
      { a: { label: '1 röd av 4 kulor', red: 1, total: 4 }, b: { label: '2 röda av 4 kulor', red: 2, total: 4 }, answer: '2 röda av 4 kulor' },
      { a: { label: '5 röda av 8 kulor', red: 5, total: 8 }, b: { label: '3 röda av 8 kulor', red: 3, total: 8 }, answer: '5 röda av 8 kulor' },
    ];
    const p = U.pickRandom(pairs);
    return { type: 'sannolikhet', questionType: 'compare', a: p.a, b: p.b, text: `Vilket är mest sannolikt: ${p.a.label} eller ${p.b.label}?`, answer: p.answer };
  }
}

// ── Statistik (åk 4–6). ──────────────────────────────────────────────────────
const _STAT_TEMAN = [
  { kategori: 'Sport', items: ['Fotboll', 'Simning', 'Tennis', 'Cykling', 'Löpning'] },
  { kategori: 'Djur', items: ['Katter', 'Hundar', 'Fåglar', 'Fiskar', 'Kaniner'] },
  { kategori: 'Frukt', items: ['Äpplen', 'Bananer', 'Apelsiner', 'Päron', 'Plommon'] },
  { kategori: 'Färger', items: ['Röd', 'Blå', 'Grön', 'Gul', 'Lila'] },
  { kategori: 'Väder', items: ['Sol', 'Moln', 'Regn', 'Snö', 'Åska'] },
];
class StatistikPlugin extends BasePlugin {
  constructor() { super(); this.type = 'statistik'; }
  generate(settings) {
    const tema = U.pickRandom(_STAT_TEMAN);
    const n = U.randInt(4, 5);
    const items = tema.items.slice(0, n).map(lbl => ({ label: lbl, value: U.randInt(2, 18) }));
    let qt = settings.variantType;
    if (!qt) {
      const qtPool = ['read-val', 'read-val', 'most', 'least', 'diff'];
      if (settings.grade >= 5) qtPool.push('mean', 'mode');
      if (settings.grade >= 6) qtPool.push('median');
      qt = U.pickRandom(qtPool);
    }
    return this._buildProblem(tema.kategori, items, qt);
  }
  _buildProblem(kategori, items, qt) {
    const chartType = 'bar';
    const vals = items.map(d => d.value);
    if (qt === 'read-pct') {
      const total = vals.reduce((a, b) => a + b, 0);
      const target = U.pickRandom(items);
      return { type: 'statistik', questionType: 'read-pct', chartType, kategori, items, text: `Ungefär hur många procent utgör "${target.label}"?`, answer: Math.round((target.value / total) * 100) + '%' };
    }
    if (qt === 'read-val') {
      const target = U.pickRandom(items);
      return { type: 'statistik', questionType: 'read-val', chartType, kategori, items, text: `Hur många röstar på "${target.label}"?`, answer: String(target.value) };
    }
    if (qt === 'most') {
      const best = items.find(d => d.value === Math.max(...vals));
      return { type: 'statistik', questionType: 'most', chartType, kategori, items, text: 'Vilket alternativ har flest?', answer: best.label };
    }
    if (qt === 'least') {
      const least = items.find(d => d.value === Math.min(...vals));
      return { type: 'statistik', questionType: 'least', chartType, kategori, items, text: 'Vilket alternativ har minst?', answer: least.label };
    }
    if (qt === 'diff') {
      const sorted = [...items].sort((a, b) => b.value - a.value);
      return { type: 'statistik', questionType: 'diff', chartType, kategori, items, text: `Hur många fler har "${sorted[0].label}" än "${sorted[1].label}"?`, answer: String(sorted[0].value - sorted[1].value) };
    }
    if (qt === 'mean') {
      const sum = vals.reduce((a, b) => a + b, 0);
      return { type: 'statistik', questionType: 'mean', chartType, kategori, items, text: 'Vad är medelvärdet?', answer: String(parseFloat((sum / vals.length).toFixed(1))) };
    }
    if (qt === 'mode') {
      const freq = {};
      vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      const maxF = Math.max(...Object.values(freq));
      if (maxF === 1) return this._buildProblem(kategori, items, 'mean');
      const mode = vals.find(v => freq[v] === maxF);
      return { type: 'statistik', questionType: 'mode', chartType, kategori, items, text: 'Vad är typvärdet?', answer: String(mode) };
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return { type: 'statistik', questionType: 'median', chartType, kategori, items, text: 'Vad är medianen?', answer: String(median) };
  }
}

// ── Koordinatsystem (åk 4–6). ────────────────────────────────────────────────
class KoordinatsystemPlugin extends BasePlugin {
  constructor() { super(); this.type = 'koordinatsystem'; }
  generate(settings) {
    const grade = settings.grade;
    const allQuadrants = settings.variantType === 'alla-kvadranter' ? true
      : settings.variantType === 'forsta-kvadrant' ? false : grade >= 6;
    const range = allQuadrants ? 5 : 8;
    const min = allQuadrants ? -range : 0;
    const points = [];
    const used = new Set();
    while (points.length < 3) {
      const x = U.randInt(min, range), y = U.randInt(min, range);
      const key = `${x},${y}`;
      if (!used.has(key) && !(x === 0 && y === 0)) { used.add(key); points.push({ x, y }); }
    }
    const targetIdx = U.randInt(0, points.length - 1);
    const target = points[targetIdx];
    const lbl = String.fromCharCode(65 + targetIdx);
    return { type: 'koordinatsystem', points, targetIdx, allQuadrants, range, text: `Vilka koordinater har punkten ${lbl}?`, answer: `(${target.x}, ${target.y})` };
  }
}

// ── Klocka (åk 1–6). ─────────────────────────────────────────────────────────
class KlockaPlugin extends BasePlugin {
  constructor() { super(); this.type = 'klocka'; }
  generate(settings) {
    const c = U.cfg(settings.grade);
    const step = c.clockMinuteStep;
    const possibleMinutes = [];
    for (let m = 0; m < 60; m += step) possibleMinutes.push(m);
    const displayMode = 'analog';
    const types = settings.grade >= 3 ? ['read', 'read', 'add-minutes', 'diff'] : ['read', 'add-minutes'];
    const questionType = settings.variantType && types.includes(settings.variantType) ? settings.variantType : U.pickRandom(types);

    if (questionType === 'diff') {
      const startH = U.randInt(7, 14);
      const startM = U.pickRandom(possibleMinutes);
      const stepForDiff = Math.max(step, 5);
      const maxDiff = settings.grade <= 3 ? 60 : 120;
      const diffOptions = [];
      for (let d = stepForDiff * 3; d <= maxDiff; d += stepForDiff) diffOptions.push(d);
      const diff = U.pickRandom(diffOptions);
      const totalEnd = startH * 60 + startM + diff;
      const endH = Math.floor(totalEnd / 60), endM = totalEnd % 60;
      const hPart = Math.floor(diff / 60), mPart = diff % 60;
      let answer;
      if (hPart === 0) answer = `${mPart} minuter`;
      else if (mPart === 0) answer = hPart === 1 ? '1 timme' : `${hPart} timmar`;
      else answer = hPart === 1 ? `1 timme och ${mPart} minuter` : `${hPart} timmar och ${mPart} minuter`;
      const context = U.pickRandom(['Lektionen slutar', 'Rasten börjar', 'Skolan slutar', 'Filmen börjar', 'Matrasten börjar']);
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      return { type: 'klocka', questionType: 'diff', displayMode, hours: startH % 12 || 12, minutes: startM, endStr, context, diff, text: `${context} klockan ${endStr}. Hur lång tid är det?`, answer };
    }
    const hours = U.randInt(1, 12);
    const minutes = U.pickRandom(possibleMinutes);
    let minutesToAdd = null;
    if (questionType === 'add-minutes') {
      const opts = [5, 10, 15, 20, 30].filter(m => m % step === 0);
      minutesToAdd = opts.length > 0 ? U.pickRandom(opts) : 15;
    }
    let answer;
    if (questionType === 'read') {
      answer = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else {
      const totalMin = hours * 60 + minutes + minutesToAdd;
      answer = `${String(Math.floor(totalMin / 60) % 12 || 12).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    }
    const text = questionType === 'read' ? 'Vad är klockan?' : `Vad är klockan om ${minutesToAdd} minuter?`;
    return { type: 'klocka', hours, minutes, questionType, displayMode, minutesToAdd, text, answer };
  }
}

export const VISUAL_PLUGINS = [
  new SannolikhetPlugin(),
  new StatistikPlugin(),
  new KoordinatsystemPlugin(),
  new KlockaPlugin(),
];
