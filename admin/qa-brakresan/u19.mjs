// 19. Placera på tallinjen – egna kontroller · #709
// Varje streck på linjen bedöms: bara målets värde är rätt, punkter mellan streck är inmatningsfel.
import { q, eq } from "../../src/brakresan/math/index.js";

const NAMNARE = [2, 3, 4, 5, 6, 8, 10];

export function audit(task, { grade }) {
  const p = [];
  const { a, n, ticks } = task.params;
  const target = q(a, n);
  if (!NAMNARE.includes(n)) p.push(`nämnaren ${n} är inte tillåten`);
  if (a < 1 || a >= n) p.push(`${a}/${n} ligger inte mellan 0 och 1`);
  if (ticks > 12 || ticks < 2) p.push(`indelningen ${ticks} är oläslig`);
  if ((target.n * ticks) % target.d !== 0) p.push("målet ligger inte på ett streck");
  const v = task.view;
  if (v.min !== 0 || v.max !== 1 || v.ticks !== ticks || task.answer.snap !== ticks) p.push("skalan är inte 0–1 med snäpp = indelning");
  if (v.labels !== "hela" || v.points?.length) p.push("etiketter/punkter på linjen kan avslöja svaret");
  for (let k = 0; k <= ticks; k++) {
    const r = grade(task, { value: { n: k, d: ticks } });
    if (r.status !== "graded" || r.correct !== eq(q(k, ticks), target)) p.push(`strecket ${k}/${ticks} bedömdes ${r.status}/${r.correct}`);
  }
  const mellan = grade(task, { value: { n: 1, d: 2 * ticks } });
  if (mellan.status !== "invalid") p.push("en punkt mellan strecken ska vara inmatningsfel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.ticks > t.params.n).length < 3) p.push("färre än tre rundor med finare indelning");
    if (!tasks.some((t) => t.params.ticks === t.params.n)) p.push("ingen runda på bråkets egen indelning");
  }
  return [...new Set(p)];
}
