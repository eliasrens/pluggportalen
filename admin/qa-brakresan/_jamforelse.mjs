// Delade kontroller för jämförelse + förklaring (16, 17) · #710
import { q, relation } from "../../src/brakresan/math/index.js";

export function auditJamforelse(task, grade) {
  const p = [];
  const { A, B, relation: rel } = task.values;
  if (relation(q(A.n, A.d), q(B.n, B.d)) !== rel) p.push("values.relation stämmer inte");
  const multi = task.answer.type === "multi";
  const facit = multi ? task.key.parts.rel.correct : task.key.correct;
  if (facit !== rel) p.push("facit är inte den exakta jämförelsen");
  const forkl = multi ? task.answer.parts.forkl.options : [null];
  let ratt = 0;
  for (const value of ["<", "=", ">"]) {
    for (const id of forkl) {
      const svar = multi ? { parts: { rel: { value }, forkl: { id } } } : { value };
      const r = grade(task, svar);
      if (r.status !== "graded") p.push(`${value}/${id} blev ${r.status}`);
      else if (r.correct) {
        ratt++;
        if (value !== rel) p.push(`fel tecken ${value} godkändes`);
      }
    }
  }
  if (ratt !== 1) p.push(`${ratt} kombinationer godkändes, inte exakt 1`);
  if (multi && grade(task, { parts: { rel: { value: rel }, forkl: null } }).status !== "invalid") p.push("saknad förklaring ska vara ofullständig, inte fel");
  if (multi) {
    const texter = task.view.delar.find((d) => d.svar === "forkl").view.cards.map((c) => c.face.text);
    if (new Set(texter).size !== 3) p.push("förklaringarna är inte tre olika");
  }
  return p;
}

export function planJamforelse(omgangar, { lika = 2, forkl = 3, bildForst = 0 }) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.values.relation === "=").length < lika) p.push(`färre än ${lika} likheter`);
    if (tasks.filter((t) => t.answer.type === "multi").length !== forkl) p.push(`inte ${forkl} förklaringsuppgifter`);
    for (const t of tasks.slice(0, bildForst)) if (!t.view.delar.some((d) => d.view.component === "stav")) p.push("introduktionen saknar bild");
  }
  return [...new Set(p)];
}
