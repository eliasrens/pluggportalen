// 09. Vilket är störst? – egna kontroller · #710
// Bilderna visar exakt A och B, helheterna är lika stora, facit = exakt jämförelse,
// minst två likheter med olika indelning per omgång.
import { q, relation } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const { slot, A, B } = task.params;
  const rel = relation(q(A[0], A[1]), q(B[0], B[1]));
  if (task.key.correct !== rel) p.push("facit är inte den exakta jämförelsen");
  if (A[1] > 12 || B[1] > 12 || A[0] < 1 || B[0] < 1 || A[0] > A[1] || B[0] > B[1]) p.push(`talen ${A} ${B} utanför ramen`);
  if (slot === "lika" && (rel !== "=" || A[1] === B[1])) p.push("likheten ska ha olika indelning");
  if (slot === "samma" && (A[1] !== B[1] || rel === "=")) p.push("samma nämnare med olika täljare krävs");
  if (slot === "halv" && !((A[0] === 1 && A[1] === 2) || (B[0] === 1 && B[1] === 2))) p.push("en halv saknas");
  const bild = task.view.delar[0].view.delar;
  const visar = bild.length === 1 ? bild[0].view.bars.map((b) => [b.marked, b.parts]) : bild.map((d) => [d.view.marked, d.view.parts]);
  if (JSON.stringify(visar) !== JSON.stringify([A, B])) p.push(`bilden visar ${JSON.stringify(visar)}`);
  if (/\d\/\d/.test(JSON.stringify(task.view))) p.push("bilden har bråketiketter före kontroll");
  for (const value of ["<", "=", ">"]) {
    const r = grade(task, { value });
    if (r.status !== "graded" || r.correct !== (value === rel)) p.push(`${value} bedömdes fel`);
  }
  if (grade(task, {}).status !== "invalid") p.push("tomt svar ska vara inmatningsfel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.key.correct === "=" && t.params.A[1] !== t.params.B[1]).length < 2) p.push("färre än två likheter med olika indelning");
  }
  return [...new Set(p)];
}
