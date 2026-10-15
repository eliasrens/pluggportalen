// 08. Vilket kort är fel? – egna kontroller · #710
// Tre kort har exakt målvärdet (läst ur kortens framsidor), ett har ett annat;
// fyra olika korttyper; bara det avvikande kortet godtas.
import { q, eq, fractionWords } from "../../src/brakresan/math/index.js";
import { kortVarde } from "./u04.mjs";

export function audit(task, { grade }) {
  const p = [];
  const { p: tp, d, kort } = task.params;
  const target = q(tp, d);
  if (target.d !== d || d < 2 || d > 8) p.push(`${tp}/${d} är inte ett enkelt reducerat bråk med q 2–8`);
  const cards = task.view.cards;
  if (cards.length !== 4) p.push("ska vara fyra kort");
  const typ = (c) => (c.face.kind ? "symbol" : c.face.text !== undefined ? "text" : c.face.component);
  if (new Set(cards.map(typ)).size !== 4) p.push("korttyperna ska vara fyra olika");
  const varde = (c) => (typ(c) === "text" ? cards.length && null : kortVarde(c.face));
  let lika = 0;
  cards.forEach((c, i) => {
    const k = kort[i];
    if (typ(c) === "text") {
      if (c.face.text !== fractionWords(k.n, k.d)) p.push(`texten ${c.face.text} ≠ ${k.n}/${k.d}`);
      if (eq(q(k.n, k.d), target)) lika++;
    } else {
      const v = varde(c);
      if (!eq(v, q(k.n, k.d))) p.push(`kort ${c.id} visar inte ${k.n}/${k.d}`);
      if (eq(v, target)) lika++;
      if (c.face.component === "mangd" && c.face.count > 12) p.push("för stor mängd");
    }
  });
  if (lika !== 3) p.push(`${lika} kort har målvärdet, inte 3`);
  for (const id of task.answer.options) {
    const r = grade(task, { id });
    if (r.status !== "graded" || r.correct !== (id === task.key.correct)) p.push(`kort ${id} bedömdes fel`);
  }
  return p;
}

export function plan(omgangar) {
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) lagen.add(t.key.correct);
  return lagen.size === 4 ? [] : [`avvikande kort bara på ${[...lagen]}`];
}
