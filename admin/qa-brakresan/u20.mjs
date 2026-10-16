// 20. Hälften, tredjedelen, fjärdedelen – egna kontroller · #710
// n ∈ {2,3,4}, k 2–8, N ≤ 24; rätt tal = k; vid fördelning måste alla föremål
// ligga i grupperna och grupperna vara lika stora (flera jämna mönster godtas).
import { createRng } from "../../src/brakresan/schema/prng.js";

export function audit(task, { grade }) {
  const p = [];
  const { mode, n, k } = task.params;
  const N = n * k;
  if (![2, 3, 4].includes(n) || k < 2 || k > 8 || N > 24) p.push(`1/${n} av ${N} utanför ramen`);
  const gv = task.view.delar[0].view;
  if (gv.count !== N || gv.groups !== n) p.push("grupperingen har fel antal");
  if (mode === "tal") {
    for (let x = 1; x <= N; x++) {
      const r = grade(task, { text: String(x) });
      if (r.status !== "graded" || r.correct !== (x === k)) p.push(`${x} bedömdes ${r.correct}`);
    }
    return p;
  }
  const ids = Array.from({ length: N }, (_, i) => `p${i}`);
  const bins = task.answer.parts.grupper.bins;
  const rng = createRng(`u20-${task.core}`);
  for (let t = 0; t < 10; t++) {
    const bl = rng.shuffle(ids);
    const jamn = Object.fromEntries(bins.map((b, i) => [b, bl.slice(i * k, (i + 1) * k)]));
    if (!grade(task, { parts: { grupper: { bins: jamn }, svar: { text: String(k) } } }).correct) p.push("jämn fördelning underkändes");
    if (grade(task, { parts: { grupper: { bins: jamn }, svar: { text: String(k + 1) } } }).correct) p.push("fel tal godkändes");
  }
  const ojamn = Object.fromEntries(bins.map((b, i) => [b, i === 0 ? ids.slice(0, k + 1) : i === 1 ? ids.slice(k + 1, 2 * k) : ids.slice(i * k, (i + 1) * k)]));
  const r = grade(task, { parts: { grupper: { bins: ojamn }, svar: { text: String(k) } } });
  if (r.status !== "graded" || r.correct) p.push("ojämn fördelning godkändes");
  if (grade(task, { parts: { grupper: { bins: { [bins[0]]: ids.slice(0, k) } }, svar: { text: String(k) } } }).status !== "invalid") p.push("ofullständig fördelning ska vara inmatningsfel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (new Set(tasks.map((t) => t.params.sit)).size < 2) p.push("färre än två situationer");
    if (tasks.filter((t) => t.params.mode === "fordela").length !== 3) p.push("inte tre fördelningsuppgifter");
  }
  return [...new Set(p)];
}
