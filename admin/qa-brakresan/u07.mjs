// 07. Bråk av en samling – egna kontroller · #710
// N 6–24, enkla förkortade värden, alla likvärdiga bråk godtas, del-mot-del
// och omarkerade avvisas, föremålen räknas exakt en gång, flera markeringsmönster.
import { q } from "../../src/brakresan/math/index.js";
import { createRng } from "../../src/brakresan/schema/prng.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { mode, k, N } = task.params;
  if (N < 6 || N > 24 || k < 1 || k >= N) p.push(`${k}/${N} utanför ramen`);
  if (q(k, N).d > 12) p.push(`${k}/${N} har inget enkelt förkortat värde`);
  const mangd = mode === "markera" ? task.view.delar[0].view : task.view;
  if (mangd.count !== N || mangd.count > 36) p.push("samlingen har fel antal föremål");
  if (mode !== "markera" && mangd.marked !== k) p.push("fel antal markerade i bilden");
  if (mode === "grupper" && N % mangd.groups !== 0) p.push("grupperna är inte lika stora");
  const svar = (s, sel) => (mode === "markera" ? { parts: { markera: { selected: sel }, svar: s } } : s);
  const delar = mode === "markera" ? task.answer.parts.markera.parts : [];
  if (mode === "markera" && delar.length !== N) p.push("föremålen räknas inte exakt en gång");
  const rng = createRng(`u07-${task.core}`);
  for (let m = 1; m <= 4; m++) {
    const sel = mode === "markera" ? rng.sample(delar, k) : null;
    const r = grade(task, svar(falt(k * m, N * m), sel));
    if (r.status !== "graded" || !r.correct) p.push(`${k * m}/${N * m} underkändes`);
  }
  const red = q(k, N);
  if (!grade(task, svar(falt(red.n, red.d), mode === "markera" ? rng.sample(delar, k) : null)).correct) p.push("förkortat bråk underkändes");
  for (const [a, b] of [[k, N - k], [N - k, N]]) {
    if (a * N === k * b) continue;
    const r = grade(task, svar(falt(a, b), mode === "markera" ? delar.slice(0, k) : null));
    if (r.status !== "graded" || r.correct) p.push(`${a}/${b} godkändes eller blev inmatningsfel`);
  }
  if (grade(task, svar(falt(k, 0), mode === "markera" ? delar.slice(0, k) : null)).status !== "invalid") p.push("nämnare 0 ska vara inmatningsfel");
  if (mode === "markera" && grade(task, svar(falt(k, N), delar.slice(0, k + 1 < N ? k + 1 : k - 1))).correct) p.push("fel antal markerade godkändes");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (tasks.filter((t) => t.params.mode === "markera").length < 2) p.push("färre än två markeringsrundor");
  return [...new Set(p)];
}
