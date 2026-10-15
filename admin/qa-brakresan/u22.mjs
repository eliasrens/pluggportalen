// 22. Det saknade talet – egna kontroller · #711
// Exakt ett positivt heltal fullbordar likheten, fem täljar- och fem nämnaruppgifter,
// både förlängning och förkortning, inga nollbråk.
import { q, eq } from "../../src/brakresan/math/index.js";

const tal = (v) => ({ text: String(v) });

export function audit(task, { grade }) {
  const p = [];
  const { p: tp, q: tq, k } = task.params;
  if (tp < 1 || tp >= tq || tq < 2 || tq > 10 || k < 2 || k > 6) p.push("basbråk eller faktor utanför ramen");
  const [v, , h] = task.view.expr;
  const lika = (x) => {
    const f = (b) => (b.kind ? b : { n: b.brak.n.input ? x : b.brak.n, d: b.brak.d.input ? x : b.brak.d });
    const A = f(v);
    const B = f(h);
    return A.d > 0 && B.d > 0 && eq(q(A.n, A.d), q(B.n, B.d));
  };
  const losningar = [];
  for (let x = 1; x <= 400; x++) if (lika(x)) losningar.push(x);
  if (losningar.length !== 1) p.push(`${losningar.length} heltal fullbordar likheten`);
  const x = losningar[0];
  if (x !== task.values.missing) p.push("facit stämmer inte med likheten");
  if (!grade(task, tal(x)).correct) p.push("rätt tal underkändes");
  for (const y of [x - 1, x + 1, k]) if (y >= 0 && y !== x && grade(task, tal(y)).correct) p.push(`${y} godkändes`);
  if (grade(task, tal("")).status !== "invalid") p.push("tom ruta ska vara inmatningsfel");
  const rutor = [v, h].filter((b) => b.brak);
  if (rutor.length !== 1) p.push("exakt ett bråk ska ha en ruta");
  if (task.view.expr[1].pilar !== ((task.params.i === "stor") === task.params.helaVanster ? "×" : "÷")) p.push("pilens riktning stämmer inte");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const t = tasks.filter((x) => x.params.saknas === "t").length;
    const forl = tasks.filter((x) => x.params.i === "stor").length;
    if (t !== 5) p.push("inte fem täljaruppgifter");
    if (forl < 2 || forl > 8) p.push("förlängning/förkortning är inte blandade");
  }
  return [...new Set(p)];
}
