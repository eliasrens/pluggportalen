// 42. Tre former – samma värde – egna kontroller · #712
// Sex kort, två av varje form; exakt EN grupp bråk + decimal + procent med samma
// värde (unik trippel); värde 0–1, hel procent, högst två decimaler; alla ordningar godtas.
import { q, eq, valueOf, fitsDecimals } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const kort = task.view.cards;
  const av = (kind) => kort.filter((c) => c.face.kind === kind);
  if (av("fraction").length !== 2 || av("decimal").length !== 2 || av("percent").length !== 2) p.push("inte två kort av varje form");
  let tripplar = 0;
  for (const f of av("fraction")) for (const d of av("decimal")) for (const c of av("percent")) {
    if (eq(valueOf(f.face), valueOf(d.face)) && eq(valueOf(d.face), valueOf(c.face))) tripplar++;
  }
  if (tripplar !== 1) p.push(`${tripplar} tripplar med samma värde`);
  const v = q(task.params.p, 100);
  if (!fitsDecimals(v, 2) || task.params.p < 0 || task.params.p > 100) p.push("målvärdet utanför ramen");
  const ratt = task.key.groups[0].ids;
  for (const ids of [ratt, [...ratt].reverse(), [ratt[1], ratt[2], ratt[0]]]) if (!grade(task, { ids }).correct) p.push("en ordning av rätt trippel underkändes");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (!tasks.some((t) => t.params.p === 0)) p.push("ingen uppgift med värdet 0");
    if (!tasks.some((t) => t.params.p === 100)) p.push("ingen uppgift med värdet 1");
  }
  return [...new Set(p)];
}
