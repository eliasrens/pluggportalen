// 35. Subtrahera olika nämnare – egna kontroller · #711
// Nämnare 2–8, mgn ≤ 24, a/n ≥ b/m, alla gemensamma nämnare ≤ 24 godtas, minst en
// noll-uppgift med olika skrivna likvärdiga bråk, olika nämnare/subtraherade nämnare avvisas.
import { q, sub, eq, lcm, cmp } from "../../src/brakresan/math/index.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { a, n, b, m } = task.params;
  const L = lcm(n, m);
  if (n === m || n < 2 || n > 8 || m < 2 || m > 8 || L > 24) p.push("nämnarna är utanför ramen");
  if (cmp(q(a, n), q(b, m)) < 0) p.push("första bråket är mindre än det andra");
  if (a >= n || b >= m) p.push("bråken ska vara högst 1 (äkta)");
  const D = sub(q(a, n), q(b, m));
  for (let G = L; G <= 24; G += L) {
    const x = (a * G) / n;
    const y = (b * G) / m;
    const r = grade(task, { parts: { a: falt(x, G), b: falt(y, G), skillnad: falt(x - y, G) } });
    if (!r.correct) p.push(`gemensam nämnare ${G} underkändes`);
  }
  const x = (a * L) / n;
  const y = (b * L) / m;
  const olika = grade(task, { parts: { a: falt(a, n), b: falt(b, m), skillnad: falt(D.n, D.d) } });
  if (olika.correct || olika.reason !== "olika-namnare") p.push("olika nämnare ska vara fel");
  if (x > y && Math.abs(n - m) >= 1) {
    const r = grade(task, { parts: { a: falt(x, L), b: falt(y, L), skillnad: falt(x - y, Math.abs(n - m)) } });
    if (r.correct && !eq(q(x - y, Math.abs(n - m)), D)) p.push("subtraherade nämnare godkändes");
  }
  const s1 = task.view.stavar[0];
  if (!s1.verktyg.includes("bort") || !s1.verktyg.includes("dela")) p.push("utgångsstaven saknar dela/ta bort");
  if (task.view.stavar.some((s) => s.parts * s.maxDela > 24)) p.push("delningsverktyget går över 24");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const noll = tasks.filter((t) => t.values.diff.n === 0);
    if (!noll.length) p.push("ingen uppgift som ger 0");
    if (noll.some((t) => t.params.n === t.params.m)) p.push("noll-uppgiften ska ha olika skrivna bråk");
  }
  return [...new Set(p)];
}
