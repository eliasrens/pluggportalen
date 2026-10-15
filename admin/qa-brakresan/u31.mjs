// 31. Addera lika nämnare – egna kontroller · #711
// Samma nämnare 3–12, summa ≤ 1, båda bitarna i mallen krävs, likvärdig summa
// godtas, adderade nämnare avvisas med egen förklaring.
import { q } from "../../src/brakresan/math/index.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { n, a, b } = task.params;
  if (n < 3 || n > 12 || a < 1 || b < 1 || a + b > n) p.push("talen är utanför ramen");
  const mall = task.answer.parts.mall.parts;
  const s = a + b;
  const svar = (sel, sum) => ({ parts: { mall: { selected: mall.slice(0, sel) }, summa: sum } });
  if (!grade(task, svar(s, falt(s, n))).correct) p.push("rätt summa underkändes");
  if (s * 2 <= 24 && !grade(task, svar(s, falt(2 * s, 2 * n))).correct) p.push("likvärdig summa underkändes");
  const ad = grade(task, svar(s, falt(s, 2 * n)));
  if (ad.correct || ad.reason !== "adderar-namnarna") p.push("adderade nämnare ska vara fel med egen förklaring");
  for (const sel of [a, b]) if (grade(task, svar(sel, falt(s, n))).status !== "invalid") p.push("en bit i mallen ska vara inmatningshjälp");
  const [s1, s2] = task.view.stavar;
  if (s1.parts !== n || s2.parts !== n || s1.marked !== a || s2.marked !== b || s1.monster === s2.monster) p.push("addenderna ska ha samma delstorlek och olika mönster");
  if (task.view.mall.parts !== n) p.push("mallen har fel indelning");
  if (!q(s, n)) p.push("summan saknas");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (tasks.filter((t) => t.params.vardag).length < 2) p.push("färre än två vardagsfrågor");
  return [...new Set(p)];
}
