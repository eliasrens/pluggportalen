// 47. Dela ett bråk – egna kontroller · #712
// n 2–8, k 2–4, n · k ≤ 24; portionen a/(n·k) (förkortat eller inte); varje
// delning j där a·j är delbart med k godtas, annars "ojämn"; multiplikation avvisas.
import { q, div, eq } from "../../src/brakresan/math/index.js";

const svar = (j, n, d) => ({ parts: { dela: { text: String(j) }, svar: { fields: { n: String(n), d: String(d) } } } });

export function audit(task, { grade }) {
  const p = [];
  const { a, n, k } = task.params;
  if (n < 2 || n > 8 || k < 2 || k > 4 || n * k > 24 || a >= n) p.push("utanför ramen");
  const P = div(q(a, n), q(k));
  if (!eq(P, q(a, n * k))) p.push("portionen är inte a/(n·k)");
  const max = Math.floor(24 / n);
  for (let j = 1; j <= max; j++) {
    const r = grade(task, svar(j, P.n, P.d));
    const jamn = (a * j) % k === 0;
    if (r.correct !== jamn) p.push(`delning ${j} bedömdes ${r.correct}`);
    if (!jamn && r.reason !== "ojamn") p.push(`delning ${j}: fel orsak ${r.reason}`);
  }
  const j = k / gcdOf(a, k);
  if (!grade(task, svar(j, a, n * k)).correct) p.push("oförkortad portion underkändes");
  if (grade(task, svar(j, a * k, n)).correct) p.push("multiplikation godkändes");
  return p;
}
const gcdOf = (x, y) => (y ? gcdOf(y, x % y) : x);

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const jamn = tasks.filter((t) => t.params.a % t.params.k === 0).length;
    if (jamn < 5 || jamn > 7) p.push("inte främst jämna fall med några omdelningar");
  }
  return [...new Set(p)];
}
