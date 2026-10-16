// 44. Procent av antal – egna kontroller · #712
// Delen är ett exakt heltal, N ≤ 200, procent 10/20/25/50/75 (5 % bara i de två
// sista rundorna); procentsiffran och resten avvisas; rimlighetsvalet följer p.
import { percentOf } from "../../src/brakresan/math/index.js";

const svar = (task, x, rimlig) => (task.answer.type === "multi" ? { parts: { antal: { text: String(x) }, rimlig: { id: rimlig } } } : { text: String(x) });

export function audit(task, { grade }) {
  const p = [];
  const { p: pr, N } = task.params;
  const del = percentOf(pr, N);
  if (del.d !== 1 || N > 200 || N < 8) p.push(`${pr} % av ${N} ger inget heltal eller N utanför ramen`);
  if (![5, 10, 20, 25, 50, 75].includes(pr)) p.push("otillåten procent");
  if (pr === 5 && task.index < 8) p.push("5 % före de två sista rundorna");
  const r = task.answer.type === "multi" ? task.key.parts.rimlig.correct : null;
  if (!grade(task, svar(task, del.n, r)).correct) p.push("rätt del underkändes");
  if (pr !== del.n && grade(task, svar(task, pr, r)).correct) p.push("procentsiffran godkändes");
  if (grade(task, svar(task, N - del.n, r)).correct && N - del.n !== del.n) p.push("resten godkändes");
  if (r) {
    const kort = task.view.delar[2].view.cards;
    const text = kort.find((c) => c.id === r).face.text;
    const vantat = pr < 50 ? /Mindre än hälften/ : pr === 50 ? /Precis hälften/ : /Mer än hälften men mindre/;
    if (!vantat.test(text)) p.push("rimlighetsvalet stämmer inte med procenten");
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.answer.type === "multi").length !== 2) p.push("inte två rundor med rimlighetsfråga");
    if (tasks.filter((t) => t.params.situation).length !== 4) p.push("inte fyra vardagssituationer");
  }
  return [...new Set(p)];
}
