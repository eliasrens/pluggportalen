// 12. Hitta tre lika bråk – egna kontroller · #709
// Exakt en trippel: alla 20 sätt att välja tre kort bedöms, bara den rätta godtas.
import { q, eq, valueKey } from "../../src/brakresan/math/index.js";

function* tripplar(ids) {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) yield [ids[i], ids[j], ids[k]];
}

export function audit(task, { grade }) {
  const p = [];
  const { p: tp, q: tq, faktorer, kort } = task.params;
  const target = q(tp, tq);
  if (target.d !== tq || tq < 2 || tq > 6 || tp < 1 || tp >= tq) p.push(`basbråket ${tp}/${tq} är inte ett reducerat äkta bråk med nämnare 2–6`);
  if (new Set(faktorer).size !== 3 || faktorer.some((f) => f < 1 || f > 5)) p.push(`faktorerna ${faktorer} ska vara tre olika 1–5`);
  if (task.view.cards.length !== 6) p.push("ska vara sex kort");
  for (const c of kort) if (c.d > 30 || c.n < 1 || c.n >= c.d) p.push(`kortet ${c.n}/${c.d} är utanför ramen`);
  const ratt = kort.filter((c) => eq(q(c.n, c.d), target));
  if (ratt.length !== 3) p.push(`${ratt.length} kort har målvärdet, inte 3`);
  const andra = kort.filter((c) => !eq(q(c.n, c.d), target)).map((c) => valueKey(q(c.n, c.d)));
  if (new Set(andra).size !== andra.length) p.push("två distraktorer har samma värde (dold trippel möjlig)");
  if (new Set(kort.map((c) => `${c.n}/${c.d}`)).size !== 6) p.push("två kort är identiska");
  if (task.view.cards.some((c, i) => c.id !== `k${i + 1}`)) p.push("kort-id följer inte visningsordningen");
  const ids = task.view.cards.map((c) => c.id);
  let godkanda = 0;
  for (const t of tripplar(ids)) {
    const r = grade(task, { ids: t });
    if (r.status !== "graded") p.push(`trippeln ${t} blev ${r.status}`);
    else if (r.correct) godkanda++;
  }
  if (godkanda !== 1) p.push(`${godkanda} tripplar godkändes, inte exakt 1`);
  if (grade(task, { ids: ids.slice(0, 2) }).status !== "invalid") p.push("två kort ska vara ofullständigt, inte fel");
  if (!task.misconceptions.length) p.push("distraktorerna saknar missuppfattningstaggar");
  return p;
}

/** Facit får inte sitta på fasta platser: de rätta korten sprids över alla sex lägen. */
export function plan(omgangar) {
  const lagen = new Set();
  for (const tasks of omgangar) for (const t of tasks) t.key.groups[0].ids.forEach((id) => lagen.add(id));
  return lagen.size === 6 ? [] : [`rätta kort bara på ${[...lagen]}`];
}
