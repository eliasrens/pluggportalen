// Hjälpare för Meteorstormens motortester (#820) – inte en testfil själv.
import { stormPlan } from "../src/live/formats/meteorstorm/delat/ms-agera.js";

export const START = 1_000_000;
export const MIN10 = 600_000;

/** En sessions indata. Standard: Klass mot klass, 4B mot 4D, 25 aktiva var. */
export function cfg(over = {}) {
  return {
    seed: "test",
    startMs: START,
    varaktighetMs: MIN10,
    stationer: [{ classId: "4B", aktiva: 25 }, { classId: "4D", aktiva: 25 }],
    installningar: { lage: "klass-mot-klass", attacker: "milda" },
    handlingar: [],
    ...over,
  };
}

export const enKlass = (over = {}) => cfg({
  stationer: [{ classId: "4B", aktiva: 25 }], installningar: { lage: "en-klass" }, ...over,
});

/** n tryck av typ vid relativ tid rel (ms), id prefix-0001 … */
export function tryck(n, rel, classId, typ, prefix = `${classId}-${typ}-${rel}`, uid = "u1") {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${String(i).padStart(4, "0")}`, t: START + rel, classId, typ, uid,
  }));
}

/** Planens meteorer (relativt start) för ett frö. */
export const planFor = (seed, varaktighetMs = MIN10) => stormPlan({ seed, varaktighetMs }).meteorer;

/**
 * En meteor (ej jätte) som är ensam i luften – ingen annan meteor flyger under
 * dess färd – och som uppfyller pred. Söker frö för frö.
 * → { seed, m, plan }
 */
export function ensamMeteor(pred = () => true, { fran = 10_000 } = {}) {
  for (let s = 0; s < 400; s++) {
    const seed = `ensam-${s}`;
    const plan = planFor(seed);
    for (const m of plan) {
      if (m.jatte || m.spawnMs < fran || !pred(m)) continue;
      const krock = plan.some((o) => o !== m && o.spawnMs < m.ankomstMs + 6000 && o.ankomstMs > m.spawnMs - 100);
      if (!krock) return { seed, m, plan };
    }
  }
  throw new Error("hittade ingen ensam meteor");
}

/** Sista loggposten som uppfyller pred, eller undefined. */
export const sista = (logg, pred) => [...logg].reverse().find(pred);
