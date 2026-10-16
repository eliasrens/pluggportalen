// 10. Bråk i vardagen – egna kontroller · #710
// Nämnare 2–6, bilden visar hela helheten med de använda delarna markerade,
// facit = använt eller kvar enligt frågan, likvärdiga bråk godtas, blandningen 4/3/3.
import { q, eq, valueKey } from "../../src/brakresan/math/index.js";
import { createRng } from "../../src/brakresan/schema/prng.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });
const marked = (v) => (Array.isArray(v.marked) ? v.marked.length : v.marked || 0);
const delar = (v) => (v.component === "rutnat" ? v.rows * v.cols : v.component === "mangd" ? v.count : v.parts);

export function audit(task, { grade }) {
  const p = [];
  const { typ, fraga, n, k } = task.params;
  if (n < 2 || n > 6 || k < 1 || k >= n) p.push(`${k}/${n} utanför ramen`);
  const m = fraga === "kvar" ? n - k : k;
  if (!eq(q(task.values.target.n, task.values.target.d), q(m, n))) p.push("facit följer inte frågan");
  const bild = typ === "bild" ? task.view.delar[0].view : task.view;
  if (delar(bild) !== n) p.push("bilden visar inte hela helheten");
  if (typ === "mala" ? marked(bild) !== 0 : marked(bild) !== k) p.push("fel antal markerade (använda) delar i bilden");
  if (typ === "mala") {
    const rng = createRng(`u10-${task.core}`);
    for (let i = 0; i < 10; i++) {
      const c = rng.int(1, n);
      const r = grade(task, { selected: rng.sample(task.answer.parts, c) });
      if (r.status !== "graded" || r.correct !== (c === m)) p.push(`${c} målade bedömdes ${r.correct}`);
    }
  } else if (typ === "tal") {
    for (let f = 1; f <= 3; f++) if (!grade(task, falt(m * f, n * f)).correct) p.push(`${m * f}/${n * f} underkändes`);
    if (n - m !== m && grade(task, falt(n - m, n)).correct) p.push("använt/kvar förväxlat godkändes");
  } else {
    const cards = task.view.delar[1].view.cards;
    if (cards.length !== 4 || new Set(cards.map((c) => valueKey(q(c.face.n, c.face.d)))).size !== 4) p.push("fyra kort med olika värden krävs");
    for (const c of cards) {
      const r = grade(task, { id: c.id });
      if (r.correct !== eq(q(c.face.n, c.face.d), q(m, n))) p.push(`kort ${c.id} bedömdes fel`);
    }
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const antal = (t) => tasks.filter((x) => x.params.typ === t).length;
    if (antal("bild") !== 4 || antal("mala") !== 3 || antal("tal") !== 3) p.push("blandningen är inte 4 bild, 3 måla, 3 tal");
    if (tasks.filter((x) => x.params.fraga === "kvar").length < 2) p.push("färre än två frågor om det som finns kvar");
  }
  return [...new Set(p)];
}
