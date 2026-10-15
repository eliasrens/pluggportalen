// 25. Olika nämnare – egna kontroller · #711
// Exakt jämförelse, nämnare 2–10 med gemensam nämnare ≤ 24, tre uppgifter med
// resonemang (båda delarna krävs), exakt ett sant resonemang, stavarna bara i hjälpen.
import { q, lcm, relation } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const { a, n, b, m, sort } = task.params;
  if (n === m || n < 2 || n > 10 || m < 2 || m > 10 || lcm(n, m) > 24) p.push("nämnarna är utanför ramen");
  if (a < 1 || a >= n || b < 1 || b >= m) p.push("inte äkta bråk");
  const rel = relation(q(a, n), q(b, m));
  if ((rel === "=") !== (sort === "likvardig")) p.push("likvärdighetssorten stämmer inte");
  if (task.view.stavar.some((s) => !s.iHjalp)) p.push("stavarna får bara synas i hjälpen");
  const multi = task.answer.type === "multi";
  const svar = (r, v) => (multi ? { parts: { rel: { value: r }, varfor: { id: v } } } : { value: r });
  const ratt = multi ? task.key.parts.varfor.correct : null;
  for (const r of ["<", "=", ">"]) {
    const g = grade(task, svar(r, ratt));
    if (g.status !== "graded" || g.correct !== (r === rel)) p.push(`relationen ${r} bedömdes ${g.correct}`);
  }
  if (multi) {
    const opts = task.answer.parts.varfor.options;
    const godkanda = opts.filter((id) => grade(task, svar(rel, id)).correct);
    if (godkanda.length !== 1) p.push(`${godkanda.length} resonemang godkändes`);
    if (grade(task, { parts: { rel: { value: rel } } }).status !== "invalid") p.push("saknat resonemang ska vara inmatningsfel");
    const texter = task.view.fragor[0].options.map((o) => o.text);
    if (new Set(texter).size !== texter.length) p.push("två resonemang har samma text");
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.answer.type === "multi").length !== 3) p.push("inte tre uppgifter med resonemang");
    for (const s of ["halv", "likvardig", "omdelning"]) if (!tasks.some((t) => t.params.sort === s)) p.push(`ingen uppgift av sorten ${s}`);
  }
  return [...new Set(p)];
}
