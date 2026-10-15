// 02. Vilket bråk visar bilden? – egna kontroller · #710
// Tillåtna tal, bildens andel = facit, fyra olika värden, ombytt/omarkerade
// med när de ger andra värden, bara rätt kort godtas.
import { q, eq, valueKey } from "../../src/brakresan/math/index.js";

const NAMNARE = [2, 3, 4, 5, 6, 8, 10];

export function audit(task, { grade }) {
  const p = [];
  const { n, a, kort, spridd } = task.params;
  if (!NAMNARE.includes(n)) p.push(`nämnare ${n} är inte tillåten`);
  if (a < 1 || a > n) p.push(`täljare ${a} utanför 1–n`);
  const bild = task.view.delar[0].view;
  const delar = bild.component === "rutnat" ? bild.rows * bild.cols : bild.parts;
  const markerade = Array.isArray(bild.marked) ? bild.marked.length : bild.marked;
  if (delar !== n || markerade !== a) p.push(`bilden visar ${markerade}/${delar}, inte ${a}/${n}`);
  if (spridd && (new Set(spridd).size !== a || spridd.some((i) => i < 0 || i >= n))) p.push("spridda markeringar fel");
  if (kort.length !== 4) p.push("ska vara fyra kort");
  const varden = kort.map((c) => valueKey(q(c.n, c.d)));
  if (new Set(varden).size !== 4) p.push("två kort har samma värde");
  if (kort.filter((c) => eq(q(c.n, c.d), q(a, n))).length !== 1) p.push("inte exakt ett kort med bildens värde");
  const finns = (x, y) => kort.some((c) => c.n === x && c.d === y);
  if (a !== n && !finns(n, a)) p.push("ombytta tal saknas");
  if (n - a >= 1 && !eq(q(n - a, n), q(a, n)) && !finns(n - a, n)) p.push("omarkerade delar saknas");
  for (const id of task.answer.options) {
    const r = grade(task, { id });
    if (r.status !== "graded" || r.correct !== (id === task.key.correct)) p.push(`kort ${id} bedömdes fel`);
  }
  if (grade(task, {}).status !== "invalid") p.push("tomt svar ska vara inmatningsfel");
  const ex = task.help.find((h) => h.step === "modellering").view;
  const exD = ex.component === "rutnat" ? ex.rows * ex.cols : ex.parts;
  if (eq(q(ex.marked, exD), q(a, n))) p.push("hjälpens exempel har samma värde");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.a === t.params.n).length < 2) p.push("färre än två hela i en omgång");
    const former = new Set(tasks.map((t) => t.params.shape));
    if (former.size < 2) p.push("bara en modellform i en omgång");
  }
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) lagen.add(t.key.correct);
  if (lagen.size !== 4) p.push(`rätt kort bara på ${[...lagen]}`);
  return [...new Set(p)];
}
