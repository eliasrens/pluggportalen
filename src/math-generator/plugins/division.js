// ============================================================================
// math-generator/plugins/division.js  (INTERN) – portad från klassrummatte.
// Bara generate() + isSameProblem() (ren beräkning). Render-lagret portas inte.
// ============================================================================

import { BasePlugin } from "../base-plugin.js";
import { PluginUtils } from "../plugin-utils.js";
import { PluginManager } from "../plugin-manager.js";

class DivisionPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = "division";
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const tables = c.divTables;

    if (!tables || tables.length === 0) {
      // Åk 1 har inga divisionstabeller – generera addition som fallback
      const max = c.addMax;
      const a = PluginUtils.randInt(1, Math.floor(max * 0.6));
      const b = PluginUtils.randInt(1, max - a);
      return { type: "addition", a, b, operator: "+", answer: a + b };
    }

    const multDivMode = settings.multDivMode?.length ? settings.multDivMode : ["tables-basic"];
    const specificTables = settings.specificTables || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const withRest = settings.divisionRest || false;
    const mode = PluginUtils.pickRandom(multDivMode);

    if (mode && mode.startsWith("decimaler") && grade >= 4) {
      const dec = mode === "decimaler" ? 1 : parseInt(mode.split("-")[1], 10);
      if ((dec === 2 && grade < 5) || (dec === 3 && grade < 6)) {
        /* faller igenom */
      } else return PluginUtils.genDecimaler(grade, "÷", dec);
    }

    if (mode === "double-half") {
      const half = PluginUtils.randInt(grade <= 2 ? 1 : 2, grade <= 2 ? 10 : grade <= 4 ? 50 : 500);
      const a = half * 2;
      return {
        type: "division", a, b: 2, operator: "division", answer: half,
        bildstodEligible: a <= 20, rows: 2, cols: half,
        questionType: "half", questionText: "Hur mycket är hälften av " + a + "?",
      };
    }

    if (mode === "tables-ten") {
      const tenPow = grade >= 5 ? PluginUtils.pickRandom([10, 100]) : 10;
      const quotient = PluginUtils.randInt(2, grade <= 3 ? 9 : grade <= 5 ? 99 : 999);
      const dividend = quotient * tenPow;
      return { type: "division", a: dividend, b: tenPow, operator: "division", answer: quotient, bildstodEligible: false, rows: tenPow, cols: quotient };
    }

    if (mode === "tables-large") {
      const divisor = PluginUtils.randInt(2, grade <= 4 ? 9 : 12);
      const quotient = PluginUtils.randInt(10, grade <= 4 ? 20 : grade <= 5 ? 50 : 100);
      const dividend = divisor * quotient;
      return { type: "division", a: dividend, b: divisor, operator: "division", answer: quotient, bildstodEligible: false, rows: divisor, cols: quotient };
    }

    // tables-basic
    const allRealTables = (tables === "all" ? [2, 3, 4, 5, 6, 7, 8, 9, 10] : tables).filter((t) => t <= 9);
    let realTables = specificTables ? allRealTables.filter((t) => specificTables.includes(t)) : allRealTables;
    if (realTables.length === 0) realTables = allRealTables;
    if (realTables.length === 0) {
      const max = c.addMax;
      const a = PluginUtils.randInt(1, Math.floor(max * 0.6));
      const b = PluginUtils.randInt(1, max - a);
      return { type: "addition", a, b, operator: "+", answer: a + b };
    }

    const divisor = PluginUtils.pickRandom(realTables);
    if (withRest && divisor >= 2) {
      const quotient = PluginUtils.randInt(1, 9);
      const remainder = PluginUtils.randInt(1, divisor - 1);
      const dividend = divisor * quotient + remainder;
      return { type: "division", a: dividend, b: divisor, operator: "÷", answer: quotient, remainder, hasRemainder: true, bildstodEligible: (grade || 3) <= 4 && dividend <= 50, rows: divisor, cols: quotient };
    }

    const quotient = PluginUtils.randInt(1, 10);
    const dividend = divisor * quotient;
    return {
      type: "division", a: dividend, b: divisor, operator: "division", answer: quotient,
      bildstodEligible: (grade || 3) <= 4 && dividend <= 50,
      rows: divisor, cols: quotient,
    };
  }

  isSameProblem(a, b) {
    return a.a === b.a && a.b === b.b;
  }
}

PluginManager.register(new DivisionPlugin());
