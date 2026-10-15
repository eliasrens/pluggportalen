// 16. Samma nämnare – egna kontroller · #710
import { auditJamforelse, planJamforelse } from "./_jamforelse.mjs";

export function audit(task, { grade }) {
  const p = auditJamforelse(task, grade);
  const { n, a, b } = task.params;
  if (n < 3 || n > 12 || a < 1 || b < 1 || a > n || b > n) p.push(`${a}/${n}, ${b}/${n} utanför ramen`);
  return p;
}
export const plan = (omg) => planJamforelse(omg, { lika: 2, forkl: 3, bildForst: 3 });
