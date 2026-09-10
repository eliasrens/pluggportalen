// ============================================================================
// math-generator/plugins/addition.js  (INTERN) – portad från klassrummatte.
// Bara generate() + isSameProblem() (ren beräkning). Render-lagret portas inte.
// ============================================================================

import { BasePlugin } from "../base-plugin.js";
import { PluginUtils } from "../plugin-utils.js";
import { PluginManager } from "../plugin-manager.js";

class AdditionPlugin extends BasePlugin {
  constructor() {
    super();
    this.type = "addition";
  }

  generate(settings) {
    const grade = settings.grade;
    const c = PluginUtils.cfg(grade);
    const modes = (settings.addSubMode?.length ? settings.addSubMode : ["standard"]).filter((m) => {
      if (m === "uppstallning" && grade < 2) return false;
      if (m === "decimaler" && grade < 4) return false;
      if (m === "decimaler-2" && grade < 5) return false;
      if (m === "decimaler-3" && grade < 6) return false;
      if (m === "flersteg" && grade < 3) return false;
      return true;
    });
    const mode = modes.length > 0 ? PluginUtils.pickRandom(modes) : "standard";

    if (mode === "uppstallning") return PluginUtils.genUppstallningAdd(grade, settings.addSubVaxling || ["med"]);
    if (mode && mode.startsWith("decimaler")) {
      const dec = mode === "decimaler" ? 1 : parseInt(mode.split("-")[1], 10);
      return PluginUtils.genDecimaler(grade, "+", dec);
    }
    if (mode === "flersteg") return PluginUtils.genFlersteg(grade);

    const max = c.addMax;
    const a = PluginUtils.randInt(1, Math.floor(max * 0.6));
    const b = PluginUtils.randInt(1, max - a);
    return { type: "addition", a, b, operator: "+", answer: a + b };
  }

  isSameProblem(a, b) {
    return a.a === b.a && a.b === b.b && a.c === b.c;
  }
}

PluginManager.register(new AdditionPlugin());
