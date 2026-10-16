// 45. Hur många procent? – egna kontroller · #712
// N ≤ 100, 100k/N heltal, bråket k/N eller likvärdigt godtas, antalet som
// procent avvisas; jämförelserna har samma k och olika procent.
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { k, N, N2 } = task.params;
  for (const n of [N, N2].filter(Boolean)) if (n > 100 || (100 * k) % n !== 0 || k >= n) p.push(`${k} av ${n} ger ingen hel procent`);
  if (N2) {
    const a = (100 * k) / N;
    const b = (100 * k) / N2;
    if (a === b) p.push("jämförelsen har samma procent");
    if (!grade(task, { parts: { a: { text: String(a) }, b: { text: String(b) } } }).correct) p.push("rätt jämförelse underkändes");
    if (grade(task, { parts: { a: { text: String(b) }, b: { text: String(a) } } }).correct) p.push("ombytta procent godkändes");
    return p;
  }
  const P = (100 * k) / N;
  for (const [n, d] of [[k, N], [P, 100], [2 * k, 2 * N]]) if (!grade(task, { parts: { brak: falt(n, d), procent: { text: String(P) } } }).correct) p.push(`${n}/${d} underkändes`);
  if (k !== P && grade(task, { parts: { brak: falt(k, N), procent: { text: String(k) } } }).correct) p.push("antalet som procent godkändes");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.N2).length < 2) p.push("färre än två jämförelser av olika stora helheter");
    if (new Set(tasks.map((t) => t.params.N)).size < 4) p.push("för få olika helheter");
  }
  return [...new Set(p)];
}
