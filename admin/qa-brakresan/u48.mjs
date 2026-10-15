// 48. Hur många får plats? – egna kontroller · #712
// A ≤ 2, bit 1/m (m 2–8), A/B helt antal 2–8; målsträcka och måttbitar på samma
// skala (lika många stavar); exakt c bitar och antalet c.
import { q, div, eq, cmp } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const { c, m } = task.params;
  const A = q(c, m);
  if (m < 2 || m > 8 || c < 2 || c > 8 || cmp(A, q(2)) > 0) p.push("utanför ramen");
  if (!eq(div(A, q(1, m)), q(c))) p.push("antalet är inte A ÷ B");
  const [mal, matt] = task.view.delar;
  if ((mal.view.wholes ?? 1) !== (matt.view.wholes ?? 1)) p.push("målsträckan och måttbitarna har olika skala");
  if (!eq(q(mal.view.marked, mal.view.parts), A)) p.push("målsträckan visar fel längd");
  const delar = task.answer.parts.bitar.parts;
  const ok = grade(task, { parts: { bitar: { selected: delar.slice(0, c) }, antal: { text: String(c) } } });
  if (!ok.correct) p.push("rätt fyllning underkändes");
  if (grade(task, { parts: { bitar: { selected: delar.slice(0, c) }, antal: { text: String(m) } } }).correct && m !== c) p.push("bitar per hel godkändes");
  return p;
}
