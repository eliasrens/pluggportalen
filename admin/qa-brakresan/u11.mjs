// 11. Lika mycket – olika bilder – egna kontroller · #710
// Två par med två olika värden ur specens lista, olika indelning inom paret,
// nämnare ≤ 12; alla tre parningar av fyra kort prövas – exakt en godtas.
import { q, eq, valueKey } from "../../src/brakresan/math/index.js";
import { kortVarde } from "./u04.mjs";

const TILLATNA = ["1/2", "1/3", "2/3", "1/4", "3/4", "1/5"];

export function audit(task, { grade }) {
  const p = [];
  const cards = task.view.cards;
  if (cards.length !== 4) p.push("ska vara fyra kort");
  const v = cards.map((c) => kortVarde(c.face));
  const nycklar = v.map(valueKey);
  const grupper = {};
  cards.forEach((c, i) => (grupper[nycklar[i]] ||= []).push(i));
  const g = Object.entries(grupper);
  if (g.length !== 2 || g.some(([, l]) => l.length !== 2)) p.push("inte två par med olika värden");
  for (const [, l] of g) {
    const [i, j] = l;
    const vi = v[i];
    if (!TILLATNA.includes(`${vi.n}/${vi.d}`)) p.push(`värdet ${vi.n}/${vi.d} är inte tillåtet`);
    const di = cards[i].face.parts ?? cards[i].face.rows * cards[i].face.cols;
    const dj = cards[j].face.parts ?? cards[j].face.rows * cards[j].face.cols;
    if (di === dj) p.push("paret har samma indelning");
    if (di > 12 || dj > 12) p.push("nämnare över 12");
  }
  const ids = cards.map((c) => c.id);
  const parningar = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  let ok = 0;
  for (const par of parningar) {
    const r = grade(task, { pairs: par.map(([a, b]) => ({ a: ids[a], b: ids[b] })) });
    if (r.status !== "graded") p.push("en hel parning blev inmatningsfel");
    else if (r.correct) {
      ok++;
      if (!par.every(([a, b]) => eq(v[a], v[b]))) p.push("en parning med olika värden godtogs");
    }
  }
  if (ok !== 1) p.push(`${ok} parningar godkändes`);
  if (grade(task, { pairs: [{ a: ids[0], b: ids[1] }] }).status !== "invalid") p.push("ett par ska vara ofullständigt");
  if (/%|,\d/.test(JSON.stringify(task.view))) p.push("decimal/procent i bilderna");
  return p;
}
