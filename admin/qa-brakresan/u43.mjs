// 43. Vilken passar inte? – egna kontroller · #712
// Fyra kort (bråk, decimal, procent, bild), exakt tre lika och ett avvikande värde
// som aldrig sammanfaller med målet; bildens helhet är utskriven; avvikarens form varierar.
import { q, eq, valueOf } from "../../src/brakresan/math/index.js";

const bildVarde = (f) => (f.component === "hundraruta" ? q(Array.isArray(f.marked) ? f.marked.length : f.marked, 100) : q(f.marked, f.parts));

export function audit(task, { grade }) {
  const p = [];
  const kort = task.view.cards;
  const varden = kort.map((c) => (c.face.component ? bildVarde(c.face) : valueOf(c.face)));
  const former = kort.map((c) => c.face.component ? "bild" : c.face.kind);
  if (new Set(former).size !== 4) p.push("inte en av varje form");
  const mal = q(task.params.p, 100);
  const lika = varden.filter((v) => eq(v, mal)).length;
  if (lika !== 3) p.push(`${lika} kort har målvärdet`);
  const udda = kort.find((_, i) => !eq(varden[i], mal));
  if (!udda || task.key.correct !== udda.id) p.push("facit pekar inte på avvikaren");
  const bild = kort.find((c) => c.face.component);
  if (!/= 1$/.test(bild.face.label || "") || !task.view.helhet) p.push("bildens helhet är inte uttalad");
  for (const c of kort) if (c.id !== task.key.correct && grade(task, { id: c.id }).correct) p.push("ett lika kort godkändes");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (new Set(tasks.map((t) => t.params.udda)).size < 4) p.push("alla fyra former avviker inte i omgången");
  return [...new Set(p)];
}
