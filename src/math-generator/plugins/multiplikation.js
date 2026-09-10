// ============================================================================
// math-generator/plugins/multiplikation.js  (INTERN) – portad från klassrummatte.
// Bara generate() + isSameProblem() (ren beräkning). Render-lagret portas inte.
// Rå Math.random() (val av a/b-ordning m.m.) utbytt mot PluginUtils.random()
// så generatorn blir deterministisk per seed.
// ============================================================================

import { BasePlugin } from "../base-plugin.js";
import { PluginUtils } from "../plugin-utils.js";
import { PluginManager } from "../plugin-manager.js";

class MultiplikationPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = "multiplikation";
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const multDivMode = settings.multDivMode?.length ? settings.multDivMode : ["tables-basic"];
    const specificTables = settings.specificTables || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const mode = PluginUtils.pickRandom(multDivMode);

    if (mode && mode.startsWith("decimaler") && grade >= 4) {
      const dec = mode === "decimaler" ? 1 : parseInt(mode.split("-")[1], 10);
      if ((dec === 2 && grade < 5) || (dec === 3 && grade < 6)) {
        /* faller igenom */
      } else return PluginUtils.genDecimaler(grade, "·", dec);
    }

    if (mode === "bild-mult") {
      // Visa rutnät, eleven identifierar multiplikationen
      const rows = PluginUtils.randInt(2, grade <= 2 ? 5 : 7);
      const cols = PluginUtils.randInt(2, grade <= 2 ? 5 : 7);
      return {
        type: "multiplikation", a: rows, b: cols, operator: "·", answer: rows * cols,
        questionType: "bild-mult", rows, cols,
      };
    }

    if (mode === "double-half") {
      const a = PluginUtils.randInt(grade <= 2 ? 1 : 2, grade <= 2 ? 10 : grade <= 4 ? 50 : 500);
      return {
        type: "multiplikation", a, b: 2, operator: "·", answer: a * 2,
        questionType: "double", questionText: "Hur mycket är dubbelt så mycket som " + a + "?",
      };
    }

    if (mode === "tables-ten") {
      const tenPow = grade >= 5 ? PluginUtils.pickRandom([10, 100]) : 10;
      const factor = PluginUtils.randInt(2, grade <= 3 ? 9 : grade <= 5 ? 99 : 999);
      const [a, b] = PluginUtils.random() < 0.5 ? [factor, tenPow] : [tenPow, factor];
      return { type: "multiplikation", a, b, operator: "·", answer: a * b };
    }

    if (mode === "tables-large") {
      if (grade >= 6) {
        const a = PluginUtils.randInt(11, 99), b = PluginUtils.randInt(11, 99);
        return { type: "multiplikation", a, b, operator: "·", answer: a * b };
      }
      const a = PluginUtils.randInt(11, grade <= 4 ? 99 : 999);
      const b = PluginUtils.randInt(2, 9);
      const [x, y] = PluginUtils.random() < 0.5 ? [a, b] : [b, a];
      return { type: "multiplikation", a: x, b: y, operator: "·", answer: x * y };
    }

    // tables-basic – cap at 9
    const allTables = (c.multTables === "all" ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : c.multTables).filter((t) => t <= 9);
    let tables = specificTables ? allTables.filter((t) => specificTables.includes(t)) : allTables;
    if (tables.length === 0) tables = allTables;
    if (tables.length === 0) return { type: "multiplikation", a: 2, b: 2, operator: "·", answer: 4 };
    const table = PluginUtils.pickRandom(tables);
    const factor = PluginUtils.randInt(1, 12);
    const [a, b] = PluginUtils.random() < 0.5 ? [table, factor] : [factor, table];
    return { type: "multiplikation", a, b, operator: "·", answer: a * b };
  }

  isSameProblem(a, b) {
    return a.a === b.a && a.b === b.b;
  }
}

PluginManager.register(new MultiplikationPlugin());
