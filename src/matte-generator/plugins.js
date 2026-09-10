// ============================================================================
// Matte­generator (issue #278) – BasePlugin + plugin-klasser (INTERN modul)
// ----------------------------------------------------------------------------
// Portade från klassrummattes js/plugins/{addition,subtraktion,multiplikation,
// division}.js. Bara generate() (ren beräkning) portas – render/showAnswer/
// hasBildstodSupport/buildBildstod var DOM och ingår inte i sömmen. Källans tre
// råa Math.random()-anrop i multiplikation.js är utbytta mot rnd() (seedbart).
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { rnd } from "./prng.js";
import { PluginUtils } from "./plugin-utils.js";

class BasePlugin {
  constructor() {
    this.type = '';
  }
  generate(settings) { return null; }
}

class AdditionPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = 'addition';
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const modes = (settings.addSubMode?.length ? settings.addSubMode : ['standard']).filter(m => {
      if (m === 'uppstallning' && grade < 2) return false;
      if (m === 'decimaler'    && grade < 4) return false;
      if (m === 'decimaler-2'  && grade < 5) return false;
      if (m === 'decimaler-3'  && grade < 6) return false;
      if (m === 'flersteg'     && grade < 3) return false;
      return true;
    });
    const mode = modes.length > 0 ? PluginUtils.pickRandom(modes) : 'standard';

    if (mode === 'uppstallning') return PluginUtils.genUppstallningAdd(grade, settings.addSubVaxling || ['med']);
    if (mode && mode.startsWith('decimaler')) {
      const dec = mode === 'decimaler' ? 1 : parseInt(mode.split('-')[1], 10);
      return PluginUtils.genDecimaler(grade, '+', dec);
    }
    if (mode === 'flersteg') return PluginUtils.genFlersteg(grade);

    const max = c.addMax;
    const a = PluginUtils.randInt(1, Math.floor(max * 0.6));
    const b = PluginUtils.randInt(1, max - a);
    return { type: 'addition', a, b, operator: '+', answer: a + b };
  }
}

class SubtraktionPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = 'subtraktion';
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const modes = (settings.addSubMode?.length ? settings.addSubMode : ['standard']).filter(m => {
      if (m === 'uppstallning' && grade < 2) return false;
      if (m === 'decimaler'    && grade < 4) return false;
      if (m === 'decimaler-2'  && grade < 5) return false;
      if (m === 'decimaler-3'  && grade < 6) return false;
      if (m === 'flersteg') return false; // Ingen flerstegs-subtraktion
      return true;
    });
    const mode = modes.length > 0 ? PluginUtils.pickRandom(modes) : 'standard';

    if (mode === 'uppstallning') return PluginUtils.genUppstallningSub(grade, settings.addSubVaxling || ['med']);
    if (mode && mode.startsWith('decimaler')) {
      const dec = mode === 'decimaler' ? 1 : parseInt(mode.split('-')[1], 10);
      return PluginUtils.genDecimaler(grade, '−', dec);
    }

    const max = c.subMax;
    const a = PluginUtils.randInt(1, max);
    const b = PluginUtils.randInt(0, a);
    return { type: 'subtraktion', a, b, operator: '−', answer: a - b };
  }
}

class MultiplikationPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = 'multiplikation';
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const multDivMode    = settings.multDivMode?.length ? settings.multDivMode : ['tables-basic'];
    const specificTables = settings.specificTables || [1,2,3,4,5,6,7,8,9];
    const mode = PluginUtils.pickRandom(multDivMode);

    if (mode && mode.startsWith('decimaler') && grade >= 4) {
      const dec = mode === 'decimaler' ? 1 : parseInt(mode.split('-')[1], 10);
      if ((dec === 2 && grade < 5) || (dec === 3 && grade < 6)) { /* faller igenom */ }
      else return PluginUtils.genDecimaler(grade, '·', dec);
    }

    if (mode === 'bild-mult') {
      const rows = PluginUtils.randInt(2, grade <= 2 ? 5 : 7);
      const cols = PluginUtils.randInt(2, grade <= 2 ? 5 : 7);
      return {
        type: 'multiplikation', a: rows, b: cols, operator: '·', answer: rows * cols,
        questionType: 'bild-mult', rows, cols,
      };
    }

    if (mode === 'double-half') {
      const a = PluginUtils.randInt(grade <= 2 ? 1 : 2, grade <= 2 ? 10 : grade <= 4 ? 50 : 500);
      return {
        type: 'multiplikation', a, b: 2, operator: '·', answer: a * 2,
        questionType: 'double', questionText: 'Hur mycket är dubbelt så mycket som ' + a + '?',
      };
    }

    if (mode === 'tables-ten') {
      const tenPow = grade >= 5 ? PluginUtils.pickRandom([10, 100]) : 10;
      const factor = PluginUtils.randInt(2, grade <= 3 ? 9 : grade <= 5 ? 99 : 999);
      const [a, b] = rnd() < 0.5 ? [factor, tenPow] : [tenPow, factor];
      return { type: 'multiplikation', a, b, operator: '·', answer: a * b };
    }

    if (mode === 'tables-large') {
      if (grade >= 6) {
        const a = PluginUtils.randInt(11, 99), b = PluginUtils.randInt(11, 99);
        return { type: 'multiplikation', a, b, operator: '·', answer: a * b };
      }
      const a = PluginUtils.randInt(11, grade <= 4 ? 99 : 999);
      const b = PluginUtils.randInt(2, 9);
      const [x, y] = rnd() < 0.5 ? [a, b] : [b, a];
      return { type: 'multiplikation', a: x, b: y, operator: '·', answer: x * y };
    }

    // tables-basic – tak vid 9
    const allTables = (c.multTables === 'all'
      ? [2,3,4,5,6,7,8,9,10,11,12] : c.multTables).filter(t => t <= 9);
    let tables = specificTables ? allTables.filter(t => specificTables.includes(t)) : allTables;
    if (tables.length === 0) tables = allTables;
    if (tables.length === 0) return { type: 'multiplikation', a: 2, b: 2, operator: '·', answer: 4 };
    const table  = PluginUtils.pickRandom(tables);
    const factor = PluginUtils.randInt(1, 12);
    const [a, b] = rnd() < 0.5 ? [table, factor] : [factor, table];
    return { type: 'multiplikation', a, b, operator: '·', answer: a * b };
  }
}

class DivisionPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = 'division';
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const tables = c.divTables;

    if (!tables || tables.length === 0) {
      // Åk 1 har inga divisionstabeller – addition som fallback (som källan).
      const max = c.addMax;
      const a = PluginUtils.randInt(1, Math.floor(max * 0.6));
      const b = PluginUtils.randInt(1, max - a);
      return { type: 'addition', a, b, operator: '+', answer: a + b };
    }

    const multDivMode    = settings.multDivMode?.length ? settings.multDivMode : ['tables-basic'];
    const specificTables = settings.specificTables || [1,2,3,4,5,6,7,8,9];
    const withRest       = settings.divisionRest   || false;
    const mode = PluginUtils.pickRandom(multDivMode);

    if (mode && mode.startsWith('decimaler') && grade >= 4) {
      const dec = mode === 'decimaler' ? 1 : parseInt(mode.split('-')[1], 10);
      if ((dec === 2 && grade < 5) || (dec === 3 && grade < 6)) { /* faller igenom */ }
      else return PluginUtils.genDecimaler(grade, '÷', dec);
    }

    if (mode === 'double-half') {
      const half = PluginUtils.randInt(grade <= 2 ? 1 : 2, grade <= 2 ? 10 : grade <= 4 ? 50 : 500);
      const a = half * 2;
      return {
        type: 'division', a, b: 2, operator: 'division', answer: half,
        bildstodEligible: a <= 20, rows: 2, cols: half,
        questionType: 'half', questionText: 'Hur mycket är hälften av ' + a + '?',
      };
    }

    if (mode === 'tables-ten') {
      const tenPow   = grade >= 5 ? PluginUtils.pickRandom([10, 100]) : 10;
      const quotient = PluginUtils.randInt(2, grade <= 3 ? 9 : grade <= 5 ? 99 : 999);
      const dividend = quotient * tenPow;
      return { type: 'division', a: dividend, b: tenPow, operator: 'division', answer: quotient, bildstodEligible: false, rows: tenPow, cols: quotient };
    }

    if (mode === 'tables-large') {
      const divisor  = PluginUtils.randInt(2, grade <= 4 ? 9 : 12);
      const quotient = PluginUtils.randInt(10, grade <= 4 ? 20 : grade <= 5 ? 50 : 100);
      const dividend = divisor * quotient;
      return { type: 'division', a: dividend, b: divisor, operator: 'division', answer: quotient, bildstodEligible: false, rows: divisor, cols: quotient };
    }

    // tables-basic
    const allRealTables = (tables === 'all' ? [2,3,4,5,6,7,8,9,10] : tables).filter(t => t <= 9);
    let realTables = specificTables ? allRealTables.filter(t => specificTables.includes(t)) : allRealTables;
    if (realTables.length === 0) realTables = allRealTables;
    if (realTables.length === 0) {
      const max = c.addMax;
      const a = PluginUtils.randInt(1, Math.floor(max * 0.6));
      const b = PluginUtils.randInt(1, max - a);
      return { type: 'addition', a, b, operator: '+', answer: a + b };
    }

    const divisor = PluginUtils.pickRandom(realTables);
    if (withRest && divisor >= 2) {
      const quotient  = PluginUtils.randInt(1, 9);
      const remainder = PluginUtils.randInt(1, divisor - 1);
      const dividend  = divisor * quotient + remainder;
      return { type: 'division', a: dividend, b: divisor, operator: '÷', answer: quotient, remainder, hasRemainder: true, bildstodEligible: (grade || 3) <= 4 && dividend <= 50, rows: divisor, cols: quotient };
    }

    const quotient = PluginUtils.randInt(1, 10);
    const dividend = divisor * quotient;
    return {
      type: 'division', a: dividend, b: divisor, operator: 'division', answer: quotient,
      bildstodEligible: (grade || 3) <= 4 && dividend <= 50,
      rows: divisor, cols: quotient,
    };
  }
}

// Intern registry (portad PluginManager, ingen global).
const registry = new Map();
for (const p of [new AdditionPlugin(), new SubtraktionPlugin(), new MultiplikationPlugin(), new DivisionPlugin()]) {
  registry.set(p.type, p);
}

/** Hämta plugin för ett topic, eller null. */
export function getPlugin(topic) {
  return registry.get(topic) || null;
}
