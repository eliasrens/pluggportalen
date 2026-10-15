// 38. En del av en del – egna kontroller · #712
// Äkta bråk med nämnare 2–5, n · m ≤ 20; målningen ska ligga i den randiga
// delen (valfria rutor där), produkten ab/nm (likvärdigt godtas), "andel av
// delen" (b/m) och målning utanför avvisas; produkten < båda faktorerna.
import { q, mul, eq, lt } from "../../src/brakresan/math/index.js";
import { createRng } from "../../src/brakresan/schema/prng.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { a, n, b, m } = task.params;
  if (n < 2 || n > 5 || m < 2 || m > 5 || n * m > 20 || a >= n || b >= m) p.push("bråken utanför ramen");
  const P = mul(q(a, n), q(b, m));
  if (!eq(task.key.parts.svar.value, P)) p.push("facit stämmer inte");
  if (!lt(P, q(a, n)) || !lt(P, q(b, m))) p.push("produkten är inte mindre än båda");
  const am = task.view.delar[0].view;
  if (am.vertical.n !== a || am.vertical.d !== n || am.horizontal.d !== m || am.horizontal.n !== 0) p.push("modellen visar fel indelning");
  const delar = task.answer.parts.mala.parts;
  const randiga = delar.filter((id) => Number(id.slice(1)) % n < a);
  const utanfor = delar.filter((id) => Number(id.slice(1)) % n >= a);
  const sel = createRng(`u38-${task.core}`).sample(randiga, a * b);
  if (!grade(task, { parts: { mala: { selected: sel }, svar: falt(2 * P.n, 2 * P.d) } }).correct) p.push("valfria randiga rutor + likvärdigt bråk underkändes");
  const ut = grade(task, { parts: { mala: { selected: [...sel.slice(1), utanfor[0]] }, svar: falt(P.n, P.d) } });
  if (ut.correct || ut.reason !== "utanfor") p.push("målning utanför den randiga delen godkändes");
  if (!eq(q(b, m), P) && grade(task, { parts: { mala: { selected: sel }, svar: falt(b, m) } }).correct) p.push("andel av delen godkändes");
  return p;
}
