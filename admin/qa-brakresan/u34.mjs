// 34. Addera olika nämnare – egna kontroller · #709
// Alla gemensamma nämnare ≤ 24 godtas, olika nämnare och "adderade nämnare" avvisas.
import { q, add, eq, lcm, gcd } from "../../src/brakresan/math/index.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { a, n, b, m } = task.params;
  const L = lcm(n, m);
  if (n === m || n < 2 || n > 8 || m < 2 || m > 8) p.push(`nämnarna ${n}, ${m} är utanför ramen`);
  if (L > 24) p.push(`minsta gemensamma nämnare ${L} > 24`);
  if (gcd(a, n) !== 1 || gcd(b, m) !== 1 || a >= n || b >= m) p.push("addenderna ska vara äkta förkortade bråk");
  const S = add(q(a, n), q(b, m));
  if (S.n > S.d) p.push("summan är större än 1");
  for (let D = L; D <= 24; D += L) {
    const x = (a * D) / n;
    const y = (b * D) / m;
    const r = grade(task, { parts: { a: falt(x, D), b: falt(y, D), summa: falt(x + y, D) } });
    if (r.status !== "graded" || !r.correct) p.push(`gemensam nämnare ${D} underkändes`);
  }
  const x = (a * L) / n;
  const y = (b * L) / m;
  const fall = [
    [{ a: falt(a, n), b: falt(b, m), summa: falt(S.n, S.d) }, "olika-namnare"],
    [{ a: falt(x, L), b: falt(y, L), summa: falt(a + b, n + m) }, "fel-summa"],
    [{ a: falt(x + 1, L), b: falt(y, L), summa: falt(x + y + 1, L) }, "fel-omskrivning"],
  ];
  for (const [parts, reason] of fall) {
    const r = grade(task, { parts });
    if (r.status !== "graded" || r.correct || r.reason !== reason) p.push(`${reason}-fallet bedömdes ${r.status}/${r.correct}/${r.reason}`);
  }
  const tom = grade(task, { parts: { a: falt(x, L), b: falt(y, L) } });
  if (tom.status !== "invalid" || tom.part !== "summa") p.push("saknad summa ska vara inmatningsfel");
  const noll = grade(task, { parts: { a: falt(x, 0), b: falt(y, L), summa: falt(x + y, L) } });
  if (noll.status !== "invalid") p.push("nämnaren 0 ska vara inmatningsfel");
  const bars = task.view.bars;
  if (!eq(q(bars[0].marked, bars[0].parts), q(a, n)) || !eq(q(bars[1].marked, bars[1].parts), q(b, m))) p.push("stavarna visar inte addenderna");
  if (bars.some((bar) => bar.parts * bar.maxDela > 24 || bar.parts * (bar.maxDela + 1) <= 24)) p.push("delningsverktygets gräns är fel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const multipel = tasks.filter((t) => t.params.n % t.params.m === 0 || t.params.m % t.params.n === 0).length;
    if (multipel < 3) p.push("färre än tre par där en nämnare är multipel av den andra");
  }
  return [...new Set(p)];
}
