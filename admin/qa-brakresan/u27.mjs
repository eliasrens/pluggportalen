// 27. Mer än en hel – egna kontroller · #711
// a/n med n = 2–8, n < a ≤ 3n; bilden har lika stora helheter med n delar var
// (aldrig fler än n delar i en cirkel); bråk och blandad form godtas; tallinjen 0–3.
import { q, eq } from "../../src/brakresan/math/index.js";

const falt = (n, d, w) => ({ fields: { n: String(n), d: String(d), ...(w ? { whole: String(w) } : {}) } });

export function audit(task, { grade }) {
  const p = [];
  const { typ, n, a } = task.params;
  if (n < 2 || n > 8 || a <= n || a > 3 * n) p.push(`${a}/${n} är utanför ramen`);
  const v = task.view;
  if (typ === "bygg") {
    if (v.wholes !== 3 || v.parts !== n) p.push("byggytan ska vara tre helheter med n delar");
    const ids = task.answer.parts;
    if (!grade(task, { selected: ids.slice(0, a) }).correct || !grade(task, { selected: ids.slice(ids.length - a) }).correct) p.push("rätt antal underkändes");
    if (grade(task, { selected: ids.slice(0, a - 1) }).correct) p.push("för få godkändes");
  } else if (typ === "bild") {
    if (v.parts !== n || v.marked !== a || v.wholes !== Math.ceil(a / n)) p.push("bilden visar inte a/n på hela helheter");
    if (!grade(task, falt(a, n)).correct) p.push("bråkform underkändes");
    if (a % n && !grade(task, falt(a % n, n, Math.floor(a / n))).correct) p.push("blandad form underkändes");
    if (grade(task, falt(a, v.wholes * n)).correct) p.push("nämnaren som växer med helheterna godkändes");
  } else {
    if (v.min !== 0 || v.max !== 3 || v.ticks !== n || task.answer.snap !== n) p.push("tallinjen ska gå 0–3 med steget 1/n");
    if (!grade(task, { value: { n: a, d: n } }).correct) p.push("rätt punkt underkändes");
    if (grade(task, { value: { n: a - 1, d: n } }).correct) p.push("fel punkt godkändes");
    if (!eq(q(task.key.value.n, task.key.value.d), q(a, n))) p.push("facit stämmer inte");
  }
  if (v.component === "cirkel" && v.parts > 12) p.push("cirkel med fler än 12 delar");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const typer = new Set(tasks.map((t) => t.params.typ));
    if (typer.size !== 3) p.push("omgången växlar inte mellan bygg, bild och tallinje");
  }
  return [...new Set(p)];
}
