// 24. Mer eller mindre än en halv? – egna kontroller · #711
// Exakt relation mot 1/2 för varje kort, minst ett kort per fack, sex olika kort,
// nämnare 2–12, ordningen inom fack fri.
import { q, relation } from "../../src/brakresan/math/index.js";

const KAT = { "<": "mindre", "=": "lika", ">": "storre" };

export function audit(task, { grade }) {
  const p = [];
  const { kort } = task.params;
  if (kort.length !== 6 || new Set(kort.map((c) => `${c.n}/${c.d}`)).size !== 6) p.push("ska vara sex olika kort");
  const bins = { mindre: [], lika: [], storre: [] };
  kort.forEach((c, i) => {
    if (c.d < 2 || c.d > 12 || c.n < 1 || c.n >= c.d) p.push(`kortet ${c.n}/${c.d} är utanför ramen`);
    const fack = KAT[relation(q(c.n, c.d), q(1, 2))];
    if (task.key.bins[`k${i + 1}`] !== fack) p.push(`kortet ${c.n}/${c.d} ligger i fel fack i facit`);
    bins[fack].push(`k${i + 1}`);
  });
  if (Object.values(bins).some((l) => !l.length)) p.push("ett fack saknar kort");
  if (!grade(task, { bins }).correct) p.push("rätt sortering underkändes");
  const omvand = { mindre: [...bins.mindre].reverse(), lika: [...bins.lika].reverse(), storre: [...bins.storre].reverse() };
  if (!grade(task, { bins: omvand }).correct) p.push("ordningen inom facket ska inte spela roll");
  if (grade(task, { bins: { mindre: bins.mindre, lika: [], storre: [] } }).status !== "invalid") p.push("halv sortering ska vara ofullständig");
  return p;
}
