// ============================================================================
// Matte­generator FAS 2 (issue #295) – mått-plugins (INTERN modul)
// ----------------------------------------------------------------------------
// Portade ur klassrummatte: matt-langd, matt-vikt, matt-tid, matt-area,
// matt-volym. Ren enhetsomvandling – självbärande, numeriska svar (spelbara).
// matt-volym har även addition/subtraktion/öppen utsaga (settings.variantType).
//
// Privat bakom src/matte-generator.js.
// ============================================================================

import { PluginUtils } from "./plugin-utils.js";
import { BasePlugin } from "./plugin-base.js";

const U = PluginUtils;

/** Text för en enkel omvandling: "3 cm = ? mm". */
function convText(conv) { return `${conv.from} ${conv.fromUnit} = ? ${conv.toUnit}`; }

class MattLangdPlugin extends BasePlugin {
  constructor() { super(); this.type = 'matt-langd'; }
  generate(settings) {
    const grade = settings.grade;
    const allowedUnits = settings.langdUnits?.length ? settings.langdUnits : ['mm', 'cm', 'dm', 'm', 'km'];
    const has = u => allowedUnits.includes(u);
    const hasPair = (a, b) => has(a) && has(b);
    const allPairs = grade <= 3
      ? [
        hasPair('cm', 'mm') && (() => ({ from: U.randInt(1, 20), fromUnit: 'cm', toUnit: 'mm', factor: 10 })),
        hasPair('m', 'cm') && (() => ({ from: U.randInt(2, 10), fromUnit: 'm', toUnit: 'cm', factor: 100 })),
        hasPair('mm', 'cm') && (() => ({ from: U.randInt(20, 200), fromUnit: 'mm', toUnit: 'cm', factor: 0.1 })),
        hasPair('dm', 'cm') && (() => ({ from: U.randInt(1, 10), fromUnit: 'dm', toUnit: 'cm', factor: 10 })),
        hasPair('cm', 'dm') && (() => ({ from: U.randInt(10, 100), fromUnit: 'cm', toUnit: 'dm', factor: 0.1 })),
        hasPair('m', 'dm') && (() => ({ from: U.randInt(1, 10), fromUnit: 'm', toUnit: 'dm', factor: 10 })),
        hasPair('dm', 'm') && (() => ({ from: U.randInt(10, 50), fromUnit: 'dm', toUnit: 'm', factor: 0.1 })),
      ]
      : grade <= 5
        ? [
          hasPair('km', 'm') && (() => ({ from: U.randInt(1, 10), fromUnit: 'km', toUnit: 'm', factor: 1000 })),
          hasPair('m', 'cm') && (() => ({ from: U.randInt(1, 50), fromUnit: 'm', toUnit: 'cm', factor: 100 })),
          hasPair('m', 'km') && (() => ({ from: U.randInt(500, 5000), fromUnit: 'm', toUnit: 'km', factor: 0.001 })),
          hasPair('m', 'mm') && (() => ({ from: U.randInt(1, 10), fromUnit: 'm', toUnit: 'mm', factor: 1000 })),
          hasPair('cm', 'mm') && (() => ({ from: U.randInt(1, 20), fromUnit: 'cm', toUnit: 'mm', factor: 10 })),
          hasPair('dm', 'cm') && (() => ({ from: U.randInt(1, 20), fromUnit: 'dm', toUnit: 'cm', factor: 10 })),
          hasPair('cm', 'dm') && (() => ({ from: U.randInt(10, 200), fromUnit: 'cm', toUnit: 'dm', factor: 0.1 })),
          hasPair('m', 'dm') && (() => ({ from: U.randInt(1, 20), fromUnit: 'm', toUnit: 'dm', factor: 10 })),
          hasPair('dm', 'm') && (() => ({ from: U.randInt(10, 100), fromUnit: 'dm', toUnit: 'm', factor: 0.1 })),
        ]
        : [
          hasPair('km', 'm') && (() => ({ from: U.randInt(1, 10) + U.randInt(0, 9) * 0.1, fromUnit: 'km', toUnit: 'm', factor: 1000 })),
          hasPair('m', 'cm') && (() => ({ from: U.randInt(1, 5) + U.randInt(0, 9) * 0.1, fromUnit: 'm', toUnit: 'cm', factor: 100 })),
          hasPair('cm', 'mm') && (() => ({ from: U.randInt(1, 20), fromUnit: 'cm', toUnit: 'mm', factor: 10 })),
          hasPair('m', 'mm') && (() => ({ from: U.randInt(1, 10), fromUnit: 'm', toUnit: 'mm', factor: 1000 })),
          hasPair('dm', 'cm') && (() => ({ from: U.randInt(1, 20), fromUnit: 'dm', toUnit: 'cm', factor: 10 })),
          hasPair('m', 'dm') && (() => ({ from: U.randInt(1, 10) + U.randInt(0, 9) * 0.1, fromUnit: 'm', toUnit: 'dm', factor: 10 })),
        ];
    const pairs = allPairs.filter(Boolean);
    const conv = pairs.length === 0
      ? { from: U.randInt(2, 10), fromUnit: 'm', toUnit: 'cm', factor: 100 }
      : U.pickRandom(pairs)();
    return { type: 'matt-langd', conversion: conv, text: convText(conv), answer: parseFloat((conv.from * conv.factor).toFixed(3)) };
  }
}

class MattViktPlugin extends BasePlugin {
  constructor() { super(); this.type = 'matt-vikt'; }
  generate(settings) {
    const grade = settings.grade;
    const pairs = grade <= 3
      ? [
        () => ({ from: U.randInt(1, 9) * 100, fromUnit: 'g', toUnit: 'hg', factor: 0.01 }),
        () => ({ from: U.randInt(1, 9), fromUnit: 'hg', toUnit: 'g', factor: 100 }),
        () => ({ from: U.randInt(1, 5), fromUnit: 'kg', toUnit: 'hg', factor: 10 }),
        () => ({ from: U.randInt(1, 5) * 10, fromUnit: 'hg', toUnit: 'kg', factor: 0.1 }),
      ]
      : grade <= 5
        ? [
          () => ({ from: U.randInt(1, 5) * 1000, fromUnit: 'g', toUnit: 'kg', factor: 0.001 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'kg', toUnit: 'g', factor: 1000 }),
          () => ({ from: U.randInt(1, 9) * 100, fromUnit: 'g', toUnit: 'hg', factor: 0.01 }),
          () => ({ from: U.randInt(1, 9), fromUnit: 'hg', toUnit: 'g', factor: 100 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'kg', toUnit: 'hg', factor: 10 }),
        ]
        : [
          () => ({ from: U.randInt(1, 5) * 1000, fromUnit: 'g', toUnit: 'kg', factor: 0.001 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'kg', toUnit: 'g', factor: 1000 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'ton', toUnit: 'kg', factor: 1000 }),
          () => ({ from: U.randInt(1, 5) * 1000, fromUnit: 'kg', toUnit: 'ton', factor: 0.001 }),
        ];
    const conv = U.pickRandom(pairs)();
    return { type: 'matt-vikt', conversion: conv, text: convText(conv), answer: parseFloat((conv.from * conv.factor).toFixed(3)) };
  }
}

class MattTidPlugin extends BasePlugin {
  constructor() { super(); this.type = 'matt-tid'; }
  generate(settings) {
    const grade = settings.grade;
    const pairs = grade <= 3
      ? [
        () => ({ from: U.randInt(1, 5) * 60, fromUnit: 'min', toUnit: 'h', factor: 1 / 60 }),
        () => ({ from: U.randInt(1, 5), fromUnit: 'h', toUnit: 'min', factor: 60 }),
        () => ({ from: U.randInt(1, 7), fromUnit: 'dygn', toUnit: 'h', factor: 24 }),
        () => ({ from: U.randInt(1, 4), fromUnit: 'veckor', toUnit: 'dygn', factor: 7 }),
      ]
      : grade <= 5
        ? [
          () => ({ from: U.randInt(1, 5) * 60, fromUnit: 'sek', toUnit: 'min', factor: 1 / 60 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'min', toUnit: 'sek', factor: 60 }),
          () => ({ from: U.randInt(1, 5) * 60, fromUnit: 'min', toUnit: 'h', factor: 1 / 60 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'h', toUnit: 'min', factor: 60 }),
          () => ({ from: U.randInt(1, 7), fromUnit: 'dygn', toUnit: 'h', factor: 24 }),
          () => ({ from: U.randInt(1, 4), fromUnit: 'veckor', toUnit: 'dygn', factor: 7 }),
        ]
        : [
          () => ({ from: U.randInt(1, 5) * 60, fromUnit: 'sek', toUnit: 'min', factor: 1 / 60 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'min', toUnit: 'sek', factor: 60 }),
          () => ({ from: U.randInt(1, 5) * 60, fromUnit: 'min', toUnit: 'h', factor: 1 / 60 }),
          () => ({ from: U.randInt(1, 5), fromUnit: 'h', toUnit: 'min', factor: 60 }),
          () => ({ from: U.randInt(1, 7), fromUnit: 'dygn', toUnit: 'h', factor: 24 }),
          () => ({ from: U.randInt(2, 5) * 7, fromUnit: 'dygn', toUnit: 'veckor', factor: 1 / 7 }),
          () => ({ from: U.randInt(1, 4), fromUnit: 'veckor', toUnit: 'dygn', factor: 7 }),
        ];
    const conv = U.pickRandom(pairs)();
    return { type: 'matt-tid', conversion: conv, text: convText(conv), answer: parseFloat((conv.from * conv.factor).toFixed(3)) };
  }
}

class MattAreaPlugin extends BasePlugin {
  constructor() { super(); this.type = 'matt-area'; }
  generate(settings) {
    const grade = Math.max(settings.grade, 4);
    const pairs = [];
    if (grade >= 4) pairs.push(
      () => ({ from: U.pickRandom([100, 200, 300, 400, 500, 600, 800, 1000]), fromUnit: 'cm²', toUnit: 'dm²', factor: 0.01 }),
      () => ({ from: U.pickRandom([1, 2, 3, 4, 5, 6, 8, 10]), fromUnit: 'dm²', toUnit: 'cm²', factor: 100 }),
    );
    if (grade >= 5) pairs.push(
      () => ({ from: U.pickRandom([100, 200, 300, 400, 500]), fromUnit: 'dm²', toUnit: 'm²', factor: 0.01 }),
      () => ({ from: U.pickRandom([1, 2, 3, 4, 5]), fromUnit: 'm²', toUnit: 'dm²', factor: 100 }),
    );
    if (grade >= 6) pairs.push(
      () => ({ from: U.pickRandom([10000, 20000, 30000, 40000, 50000]), fromUnit: 'm²', toUnit: 'ha', factor: 0.0001 }),
      () => ({ from: U.pickRandom([1, 2, 3, 4, 5]), fromUnit: 'ha', toUnit: 'm²', factor: 10000 }),
      () => ({ from: U.pickRandom([100, 200, 300, 400, 500]), fromUnit: 'ha', toUnit: 'km²', factor: 0.01 }),
      () => ({ from: U.pickRandom([1, 2, 3, 4, 5]), fromUnit: 'km²', toUnit: 'ha', factor: 100 }),
    );
    const conv = U.pickRandom(pairs)();
    return { type: 'matt-area', conversion: conv, text: convText(conv), answer: parseFloat((conv.from * conv.factor).toFixed(4)) };
  }
}

class MattVolymPlugin extends BasePlugin {
  constructor() { super(); this.type = 'matt-volym'; }
  static UNIT_CHAIN = [
    { from: 'ml', to: 'cl', factor: 10 }, { from: 'cl', to: 'dl', factor: 10 }, { from: 'dl', to: 'l', factor: 10 },
  ];
  _getUnits(settings) { const units = settings.volymUnits; return units && units.length >= 2 ? units : ['dl', 'l']; }
  _getConversionPairs(units, grade) {
    const pairs = [];
    for (const link of MattVolymPlugin.UNIT_CHAIN) {
      if (units.includes(link.from) && units.includes(link.to)) {
        pairs.push(() => ({ from: U.randInt(1, 9), fromUnit: link.from, toUnit: link.to, factor: 1 / link.factor }));
        pairs.push(() => ({ from: U.randInt(1, 5), fromUnit: link.to, toUnit: link.from, factor: link.factor }));
      }
    }
    if (grade >= 4) {
      if (units.includes('ml') && units.includes('dl')) {
        pairs.push(() => ({ from: U.randInt(1, 5), fromUnit: 'dl', toUnit: 'ml', factor: 100 }));
        pairs.push(() => ({ from: U.randInt(100, 500), fromUnit: 'ml', toUnit: 'dl', factor: 0.01 }));
      }
      if (units.includes('cl') && units.includes('l')) {
        pairs.push(() => ({ from: U.randInt(1, 3), fromUnit: 'l', toUnit: 'cl', factor: 100 }));
        pairs.push(() => ({ from: U.randInt(10, 100), fromUnit: 'cl', toUnit: 'l', factor: 0.01 }));
      }
      if (units.includes('ml') && units.includes('l')) pairs.push(() => ({ from: U.randInt(1, 3), fromUnit: 'l', toUnit: 'ml', factor: 1000 }));
    }
    return pairs;
  }
  generate(settings) {
    const grade = settings.grade;
    const units = this._getUnits(settings);
    const mode = settings.variantType || U.pickRandom(settings.volymModes?.length ? settings.volymModes : ['convert']);
    if (mode === 'addition') return this._genAddition(units);
    if (mode === 'subtraction') return this._genSubtraction(units);
    if (mode === 'open') return this._genOpen(units);
    return this._genConvert(units, grade);
  }
  _genConvert(units, grade) {
    const pairs = this._getConversionPairs(units, grade);
    const conv = pairs.length === 0 ? { from: U.randInt(1, 5), fromUnit: 'dl', toUnit: 'l', factor: 0.1 } : U.pickRandom(pairs)();
    return { type: 'matt-volym', questionType: 'convert', conversion: conv, text: convText(conv), answer: parseFloat((conv.from * conv.factor).toFixed(3)) };
  }
  _genAddition(units) {
    const unit = U.pickRandom(units);
    const max = unit === 'l' ? 5 : unit === 'dl' ? 9 : unit === 'cl' ? 50 : 500;
    const a = U.randInt(1, max), b = U.randInt(1, max);
    return { type: 'matt-volym', questionType: 'addition', a, b, unit, text: `${a} ${unit} + ${b} ${unit} = ? ${unit}`, answer: a + b };
  }
  _genSubtraction(units) {
    const unit = U.pickRandom(units);
    const max = unit === 'l' ? 5 : unit === 'dl' ? 9 : unit === 'cl' ? 50 : 500;
    const a = U.randInt(2, max), b = U.randInt(1, a - 1);
    return { type: 'matt-volym', questionType: 'subtraction', a, b, unit, text: `${a} ${unit} − ${b} ${unit} = ? ${unit}`, answer: a - b };
  }
  _genOpen(units) {
    const unitPairs = [];
    for (const link of MattVolymPlugin.UNIT_CHAIN) {
      if (units.includes(link.from) && units.includes(link.to)) unitPairs.push({ small: link.from, big: link.to, factor: link.factor });
    }
    if (unitPairs.length === 0) {
      const unit = U.pickRandom(units);
      const total = U.randInt(5, 15);
      const a = U.randInt(1, total - 1);
      const e = `${a} ${unit} + _ = ${total} ${unit}`;
      return { type: 'matt-volym', questionType: 'open', expression: e, blankUnit: unit, text: e, answer: total - a };
    }
    const pair = U.pickRandom(unitPairs);
    const bigVal = U.randInt(1, 3);
    const totalSmall = bigVal * pair.factor;
    const aSmall = U.randInt(1, totalSmall - 1);
    const answer = totalSmall - aSmall;
    const fmt = U.pickRandom([
      { expr: `${aSmall} ${pair.small} + _ = ${bigVal} ${pair.big}`, blankUnit: pair.small },
      { expr: `${bigVal} ${pair.big} − ${aSmall} ${pair.small} = _`, blankUnit: pair.small },
    ]);
    return { type: 'matt-volym', questionType: 'open', expression: fmt.expr, blankUnit: fmt.blankUnit, text: fmt.expr, answer };
  }
}

export const MATT_PLUGINS = [
  new MattLangdPlugin(),
  new MattViktPlugin(),
  new MattTidPlugin(),
  new MattAreaPlugin(),
  new MattVolymPlugin(),
];
