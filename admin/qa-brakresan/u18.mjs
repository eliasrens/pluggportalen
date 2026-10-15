// 18. Vilken punkt är rätt? – egna kontroller · #710
// Fyra olika punkter på strecken, exakt en har målvärdet, graderingen är n
// eller en multipel, etiketter bara på 0 och 1, minst en 0 och en 1 per omgång.
import { q, eq } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const { n, a, ticks } = task.params;
  if (n < 2 || n > 10 || a < 0 || a > n) p.push(`${a}/${n} utanför ramen`);
  if (ticks % n !== 0 || ticks > 12) p.push(`graderingen ${ticks} är ingen enkel multipel av ${n}`);
  const pts = task.view.points;
  if (pts.length !== 4 || new Set(pts.map((x) => `${x.value.n}/${x.value.d}`)).size !== 4) p.push("ska vara fyra olika punkter");
  const ratta = pts.filter((x) => eq(q(x.value.n, x.value.d), q(a, n)));
  if (ratta.length !== 1 || ratta[0].id !== task.key.correct) p.push("facit är inte punkten med exakt målvärde");
  for (const x of pts) if (x.value.d !== ticks || x.value.n < 0 || x.value.n > ticks) p.push(`punkt ${x.id} ligger inte på ett streck`);
  const xs = pts.map((x) => x.value.n);
  if (xs.join() !== [...xs].sort((u, v) => u - v).join()) p.push("bokstäverna går inte från vänster");
  if (task.view.labels !== "hela") p.push("strecken får inte ha bråketiketter");
  for (const id of task.answer.options) {
    const r = grade(task, { id });
    if (r.status !== "graded" || r.correct !== (id === task.key.correct)) p.push(`punkt ${id} bedömdes fel`);
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (!tasks.some((t) => t.params.a === 0)) p.push("ingen uppgift med 0");
    if (!tasks.some((t) => t.params.a === t.params.n)) p.push("ingen uppgift med 1");
  }
  const lagen = new Set();
  let klunga = 0;
  let alla = 0;
  for (const tasks of omgangar) for (const t of tasks) {
    lagen.add(t.key.correct);
    const s = t.params.streck;
    const k = (t.params.a * t.params.ticks) / t.params.n;
    alla++;
    if (t.params.ticks >= 6 && s.includes(k - 1) && s.includes(k + 1)) klunga++; // kort linje: alla streck används ändå
  }
  if (klunga) p.push(`facit mitt i en klunga av tre i ${klunga}/${alla} uppgifter`);
  if (lagen.size !== 4) p.push(`rätt punkt bara på ${[...lagen]}`);
  return [...new Set(p)];
}
