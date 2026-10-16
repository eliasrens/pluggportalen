// 23. Bråkkompisar – egna kontroller · #711
// Exakt en trippel (alla 20 val bedöms), minst två representationstyper och två
// indelningar i trippeln, kortens bilder visar exakt sina värden, nämnare ≤ 24.
import { q, eq, valueKey } from "../../src/brakresan/math/index.js";

function* tripplar(ids) {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) yield [ids[i], ids[j], ids[k]];
}
const TEXT = /^(En|Ett|[A-ZÅÄÖ][a-zåäö]+) /;

export function audit(task, { grade }) {
  const p = [];
  const { p: tp, q: tq, kort } = task.params;
  if (tq < 2 || tq > 8) p.push("målvärdets nämnare är utanför 2–8");
  const target = q(tp, tq);
  const ratt = kort.filter((c) => c.ratt);
  if (ratt.length !== 3) p.push("inte tre rätta kort");
  if (new Set(ratt.map((c) => c.typ)).size < 2) p.push("trippeln har färre än två representationstyper");
  if (new Set(ratt.map((c) => c.d)).size < 2) p.push("trippeln har färre än två indelningar");
  for (const c of kort) {
    if (c.d > 24 || c.n < 1 || c.n >= c.d) p.push(`kortet ${c.n}/${c.d} är utanför ramen`);
    if (c.ratt && !eq(q(c.n, c.d), target)) p.push("ett rätt kort har fel värde");
    if (!c.ratt && eq(q(c.n, c.d), target)) p.push("en distraktor har målvärdet");
  }
  const andra = kort.filter((c) => !c.ratt).map((c) => valueKey(q(c.n, c.d)));
  if (new Set(andra).size !== andra.length) p.push("två distraktorer har samma värde");
  task.view.cards.forEach((c, i) => {
    const k = kort[i];
    const f = c.face;
    const ok = f.kind ? f.n === k.n && f.d === k.d
      : f.component === "mangd" ? f.count === k.d && f.marked === k.n
        : f.component === "rutnat" ? f.rows * f.cols === k.d && f.marked === k.n
          : f.component ? f.parts === k.d && f.marked === k.n
            : TEXT.test(f.text);
    if (!ok) p.push(`kort ${c.id} visar inte sitt värde`);
    if (f.component === "cirkel" && f.parts > 12) p.push("cirkel med fler än 12 delar");
    if (f.component === "mangd" && f.count > 16) p.push("för många föremål i ett kort");
    if (f.kind === "decimal" || f.kind === "percent" || /\d,\d|%/.test(f.text ?? "")) p.push("decimal eller procent på ett kort");
  });
  const ids = task.view.cards.map((c) => c.id);
  let n = 0;
  for (const t of tripplar(ids)) if (grade(task, { ids: t }).correct) n++;
  if (n !== 1) p.push(`${n} tripplar godkändes`);
  if (grade(task, { ids: ids.slice(0, 2) }).status !== "invalid") p.push("två kort ska vara ofullständigt");
  return p;
}

export function plan(omgangar) {
  const typer = new Set();
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) {
    t.params.kort.forEach((c) => typer.add(c.typ));
    t.key.groups[0].ids.forEach((id) => lagen.add(id));
  }
  const p = [];
  if (typer.size !== 6) p.push(`bara typerna ${[...typer]}`);
  if (lagen.size !== 6) p.push(`rätta kort bara på ${[...lagen]}`);
  return p;
}
