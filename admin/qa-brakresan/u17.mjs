// 17. Samma täljare – egna kontroller · #710
import { auditJamforelse, planJamforelse } from "./_jamforelse.mjs";

export function audit(task, { grade }) {
  const p = auditJamforelse(task, grade);
  const { a, n, m } = task.params;
  if (a < 1 || a > 4 || n <= a || m <= a || n > 12 || m > 12) p.push(`${a}/${n}, ${a}/${m} utanför ramen`);
  if (task.answer.type === "multi" && !task.view.delar.some((d) => d.view.component === "stav")) p.push("förklaringsrundan saknar bild");
  const t = JSON.stringify(task.view);
  if (/större nämnare ger/.test(t)) p.push("regeln utan villkor");
  return p;
}
export const plan = (omg) => planJamforelse(omg, { lika: 1, forkl: 3, bildForst: 2 });
