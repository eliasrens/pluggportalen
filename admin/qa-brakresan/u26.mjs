// 26. Sortera bråk i ordning – egna kontroller · #711
// Fyra olika värden 0–1, nämnare 2–12, gemensam nämnare ≤ 24; bara den kompletta
// stigande ordningen godtas, aldrig poäng per kort; stavar bara i hjälpen.
import { q, cmp, lcm } from "../../src/brakresan/math/index.js";

function* permutationer(l) {
  if (l.length <= 1) { yield l; return; }
  for (let i = 0; i < l.length; i++) for (const r of permutationer([...l.slice(0, i), ...l.slice(i + 1)])) yield [l[i], ...r];
}

export function audit(task, { grade }) {
  const p = [];
  const { kort } = task.params;
  const v = kort.map((c) => q(c.n, c.d));
  if (kort.length !== 4) p.push("ska vara fyra kort");
  if (kort.some((c) => c.d < 2 || c.d > 12 || c.n < 1 || c.n >= c.d)) p.push("ett kort är utanför ramen");
  if (kort.reduce((L, c) => lcm(L, c.d), 1) > 24) p.push("gemensam nämnare > 24");
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (cmp(v[i], v[j]) === 0) p.push("två kort har samma värde");
  const ids = task.view.cards.map((c) => c.id);
  let godkanda = 0;
  for (const perm of permutationer(ids)) if (grade(task, { ids: perm }).correct) godkanda++;
  if (godkanda !== 1) p.push(`${godkanda} ordningar godkändes`);
  if (grade(task, { ids: ids.slice(0, 3) }).status !== "invalid") p.push("tre kort ska vara ofullständigt");
  if (!task.view.stavar) p.push("jämförelsestavarna saknas i hjälpen");
  return p;
}
